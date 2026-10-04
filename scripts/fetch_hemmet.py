"""
Hämtar hela guilden från Blizzards API till HEMMET-sidan.

  python scripts/fetch_hemmet.py                                   (Frienship, Stitches → data/hc)
  python scripts/fetch_hemmet.py --realm nekrosh --guild "HEMMET" --out data/hemmet

Namespace väljs automatiskt: Anniversary (classicann), Era/Hardcore (classic1x) eller
progression (classic). Det som både har guilden och levande profiler vinner.

Per medlem: profil (level, ilvl, senaste inloggning), statistik (HP m.m.),
PvP (honorable kills, rank), utrustning, rykten (Exalted) och porträtt. Skriver till utmappen (standard data/hc):

  members.json           allt sidan visar
  snapshots/<datum>.json levels och HKs just i dag (historiken byggs av dessa)
  items.json             cache: item-ID → item level och ikon
  events.jsonl           dings, in- och utloggningar och HKs med tidsstämpel
  state.json             förra körningens läge (för att hitta nya händelser)

Kör var 30:e minut (schemalagt): snapshoten ersätts under dagen, händelserna läggs till.
Ju tätare körningar, desto exaktare dings och passlängder.
Kräver BNET_ID och BNET_SECRET i .env.
"""
import argparse
import base64
import datetime
import http.client
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "hc"

# ---------- inställningar ----------
# Frienship (Hardcore) är testguilden tills HEMMET finns i spelet
REGION, REALM, GUILD = "eu", "stitches", "frienship"
# Namespace väljs i configure(). "profile-classic" svarar ofta också men kan vara en gammal
# kopia (inloggningar som stannat) utan porträtt.
PROFILE_NS = f"profile-classicann-{REGION}"
STATIC_NS = f"static-classicann-{REGION}"
WORKERS = 8
AVATARS, ICONS = OUT / "avatars", OUT / "icons"

CLASSES = {1: "warrior", 2: "paladin", 3: "hunter", 4: "rogue", 5: "priest", 7: "shaman", 8: "mage", 9: "warlock", 11: "druid"}
HEAL_RE = re.compile(r"(?:healing done|damage and healing done)[^.]*?by up to (\d+)")
ROLES = {"Protection": "tank", "Feral Combat": "tank", "Holy": "healer", "Discipline": "healer", "Restoration": "healer"}
QUALITY = {"POOR": 0, "COMMON": 1, "UNCOMMON": 2, "RARE": 3, "EPIC": 4, "LEGENDARY": 5}
# Blizzards slot-typ → samma slot-index som Warcraft Logs (det build_outfits.py förväntar sig)
SLOTS = {"HEAD": 0, "NECK": 1, "SHOULDER": 2, "SHIRT": 3, "CHEST": 4, "WAIST": 5, "LEGS": 6, "FEET": 7,
         "WRIST": 8, "HANDS": 9, "FINGER_1": 10, "FINGER_2": 11, "TRINKET_1": 12, "TRINKET_2": 13,
         "BACK": 14, "MAIN_HAND": 15, "OFF_HAND": 16, "RANGED": 17, "TABARD": 18}


def env():
    # GitHub Actions har ingen .env: där kommer nycklarna som miljövariabler (Secrets)
    values = {k: os.environ[k] for k in ("BNET_ID", "BNET_SECRET") if os.environ.get(k)}
    if not (ROOT / ".env").exists():
        return values
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()
    return values


def token():
    e = env()
    auth = base64.b64encode(f"{e['BNET_ID']}:{e['BNET_SECRET']}".encode()).decode()
    req = urllib.request.Request("https://oauth.battle.net/token", data=b"grant_type=client_credentials",
                                 headers={"Authorization": f"Basic {auth}", "User-Agent": "guildsite-dev"})
    for attempt in range(4):   # inloggningen får inte fälla hela körningen på ett tillfälligt nätfel
        try:
            return json.load(urllib.request.urlopen(req, timeout=30))["access_token"]
        except (OSError, http.client.HTTPException, ValueError):
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


TOKEN = None


def get(path, namespace=None):
    namespace = namespace or PROFILE_NS
    url = f"https://{REGION}.api.blizzard.com{path}?" + urllib.parse.urlencode({"namespace": namespace, "locale": "en_GB"})
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}", "User-Agent": "guildsite-dev"})
        try:
            return json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except (OSError, http.client.HTTPException, ValueError):
            # nätverksfel, timeout mitt i svaret eller avhugget/trasigt svar: försök igen
            time.sleep(1.5 * (attempt + 1))
    return None


def slug(name):
    return urllib.parse.quote(name.lower())


def download(url, dest, max_age_h=None):
    """Hämtar en bild om den saknas (eller är äldre än max_age_h timmar)."""
    if dest.exists() and (max_age_h is None or time.time() - dest.stat().st_mtime < max_age_h * 3600):
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "guildsite-dev"})
        dest.write_bytes(urllib.request.urlopen(req, timeout=30).read())
        return True
    except (OSError, http.client.HTTPException):
        return False


def fetch_member(entry):
    """Allt om en karaktär. Profilen saknas för karaktärer som inte loggat in på länge."""
    c = entry["character"]
    base = f"/profile/wow/character/{REALM}/{slug(c['name'])}"
    m = {
        "name": c["name"], "id": c["id"], "level": c["level"], "rank": entry.get("rank"),
        "cls": CLASSES.get(c["playable_class"]["id"], "warrior"), "race": c["playable_race"]["id"],
    }
    profile = get(base)
    if not profile:
        m["profile"] = False
        return m
    m.update({
        "profile": True,
        "level": profile.get("level", m["level"]),
        "gender": 1 if (profile.get("gender") or {}).get("type") == "MALE" else 0,
        "lastLogin": profile.get("last_login_timestamp"),
        "ilvl": profile.get("equipped_item_level"),
        "xp": profile.get("experience"),   # ändras när profilen sparas, dvs. vid utloggning
        "title": (profile.get("active_title") or {}).get("display_string"),
    })
    stats = get(base + "/statistics") or {}
    m["hp"] = stats.get("health")
    m["power"], m["powerType"] = stats.get("power"), (stats.get("power_type") or {}).get("name")
    m["stats"] = {k: stats.get(k, {}).get("effective") if isinstance(stats.get(k), dict) else stats.get(k)
                  for k in ("strength", "agility", "stamina", "intellect", "spirit", "attack_power", "spell_power", "armor")}
    for k in ("melee_crit", "ranged_crit", "spell_crit"):
        v = stats.get(k)
        m["stats"][k] = round(v.get("value", 0), 2) if isinstance(v, dict) else v
    pvp = get(base + "/pvp-summary") or {}
    m["hk"], m["pvpRank"] = pvp.get("honorable_kills", 0), pvp.get("pvp_rank", 0)
    equip = get(base + "/equipment") or {}
    m["gear"] = [{
        "slot": SLOTS.get(i["slot"]["type"]), "id": i["item"]["id"], "name": i.get("name"),
        "quality": QUALITY.get((i.get("quality") or {}).get("type"), 1),
    } for i in equip.get("equipped_items", []) if i["slot"]["type"] in SLOTS]
    # Healing power: API:t har inget eget fält, så vi summerar utrustningens "Equip: Increases healing done ... by up to N"
    # (även "damage and healing"). Enchants och setbonusar räknas inte.
    m["heal"] = sum(int(x) for i in equip.get("equipped_items", []) for s in (i.get("spells") or [])
                    for x in HEAL_RE.findall(s.get("description") or ""))
    # Spec och roll: trädet med flest talangpoäng i den aktiva uppsättningen
    specs = get(base + "/specializations") or {}
    active = next((g for g in specs.get("specialization_groups", []) if g.get("is_active")), None) or {}
    trees = sorted(active.get("specializations", []), key=lambda s: -(s.get("spent_points") or 0))
    m["spec"] = trees[0]["specialization_name"] if trees and trees[0].get("spent_points") else None
    m["role"] = ROLES.get(m["spec"], "dps")
    # Rykten: vilka faktioner karaktären är Exalted med (Classic-API:t har inga yrken, men rykten)
    reps = get(base + "/reputations")
    m["exalted"] = None if reps is None else sorted(
        r["faction"]["name"] for r in reps.get("reputations", []) if (r.get("standing") or {}).get("name") == "Exalted")
    # Porträttet: Blizzards egen rendering av karaktären (uppdateras när gearen byts)
    media = get(base + "/character-media") or {}
    avatar = next((a["value"] for a in media.get("assets", []) if a["key"] == "avatar"), None)
    m["avatar"] = bool(avatar) and download(avatar, AVATARS / f"{m['id']}.jpg", max_age_h=20)
    # helkroppsbilden (genomskinlig png, 1600×1200): laddas bara ner för dem som står på en pall, se fetch_renders()
    m["renderUrl"] = next((a["value"] for a in media.get("assets", []) if a["key"] == "main-raw"), None)
    return m


# Topplistorna i sidan (samma urval som BOARDS i app.js): de tre bästa per lista, totalt och per klass, får en helkroppsbild
BOARDS = [lambda m: m.get("ilvl"), lambda m: m.get("hk"), lambda m: m.get("pvpRank"),
          lambda m: (m.get("stats") or {}).get("attack_power"), lambda m: (m.get("stats") or {}).get("spell_power"),
          lambda m: m.get("heal") if m.get("role") == "healer" else None, lambda m: m.get("hp")]


def fetch_renders(members):
    """Helkroppsbilder för alla som kan hamna på en pall. Övriga bilder tas bort så att mappen inte växer."""
    out = OUT / "renders"
    out.mkdir(exist_ok=True)
    wanted = {}
    for board in BOARDS:
        for group in [members] + [[m for m in members if m["cls"] == c] for c in set(CLASSES.values())]:
            ranked = sorted((m for m in group if (board(m) or 0) > 0), key=lambda m: -board(m))
            for m in ranked[:3]:
                if m.get("renderUrl"):
                    wanted[m["id"]] = m["renderUrl"]
    with ThreadPoolExecutor(WORKERS) as ex:
        ok = sum(ex.map(lambda kv: download(kv[1], out / f"{kv[0]}.png", max_age_h=20), wanted.items()))
    for f in out.glob("*.png"):
        if int(f.stem) not in wanted:
            f.unlink()
    print(f"{ok} helkroppsbilder för pallarna")


def item_info(ids, cache):
    """Item level och ikon för items vi inte redan har."""
    todo = [i for i in ids if str(i) not in cache]
    def one(i):
        d = get(f"/data/wow/item/{i}", STATIC_NS) or {}
        media = get(f"/data/wow/media/item/{i}", STATIC_NS) or {}
        url = next((a["value"] for a in media.get("assets", []) if a["key"] == "icon"), None)
        icon = url.rsplit("/", 1)[-1].rsplit(".", 1)[0] if url else None
        if icon:
            download(url, ICONS / f"{icon}.jpg")
        return i, {"itemLevel": d.get("level"), "inventoryType": (d.get("inventory_type") or {}).get("type"), "icon": icon}
    with ThreadPoolExecutor(WORKERS) as ex:
        for n, (i, info) in enumerate(ex.map(one, todo), 1):
            cache[str(i)] = info
            if n % 100 == 0:
                print(f"  items {n}/{len(todo)}")
    return cache


def configure(args):
    """Realm, guild, utmapp och namespace från kommandoraden (standard: Frienship)."""
    global REALM, GUILD, OUT, AVATARS, ICONS, PROFILE_NS, STATIC_NS
    REALM, GUILD = slug(args.realm).replace("%20", "-"), slug(args.guild).replace("%20", "-")
    OUT = (ROOT / args.out) if args.out else OUT
    AVATARS, ICONS = OUT / "avatars", OUT / "icons"
    if args.ns:
        PROFILE_NS, STATIC_NS = f"profile-{args.ns}-{REGION}", f"static-{args.ns}-{REGION}"
        return
    for kind in ("classicann", "classic1x", "classic"):
        roster = get(f"/data/wow/guild/{REALM}/{GUILD}/roster", f"profile-{kind}-{REGION}")
        if not roster:
            print(f"  {kind:<11} ingen guild")
            continue
        # guilden finns: kolla att profilerna lever (gamla kopior har frusna inloggningar)
        sample = sorted(roster["members"], key=lambda e: -e["character"]["level"])[:5]
        logins = [(get(f"/profile/wow/character/{REALM}/{slug(e['character']['name'])}", f"profile-{kind}-{REGION}") or {}).get("last_login_timestamp") or 0 for e in sample]
        age_days = (time.time() * 1000 - max(logins)) / 864e5 if max(logins) else None
        print(f"  {kind:<11} {len(roster['members'])} i rostern, senaste inloggning för {age_days:.0f} dagar sedan" if age_days is not None else f"  {kind:<11} {len(roster['members'])} i rostern, inga profiler")
        if age_days is not None and age_days < 30:
            PROFILE_NS, STATIC_NS = f"profile-{kind}-{REGION}", f"static-{kind}-{REGION}"
            print(f"Använder {PROFILE_NS}")
            return
    sys.exit("Hittar ingen aktiv guild med de namnen. Stavning? Realm skrivs utan mellanslag, t.ex. nekrosh.")


def main():
    global TOKEN
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--realm", default=REALM)
    ap.add_argument("--guild", default=GUILD)
    ap.add_argument("--out", help="utmapp relativt projektet (standard data/hc)")
    ap.add_argument("--ns", help="tvinga namespace, t.ex. classic1x")
    args = ap.parse_args()
    TOKEN = token()
    configure(args)
    for d in (OUT, OUT / "snapshots", AVATARS, ICONS):
        d.mkdir(parents=True, exist_ok=True)

    roster = get(f"/data/wow/guild/{REALM}/{GUILD}/roster")
    entries = roster["members"]
    print(f"{roster['guild']['name']}: {len(entries)} i rostern, hämtar profiler …")
    members = []
    with ThreadPoolExecutor(WORKERS) as ex:
        for n, m in enumerate(ex.map(fetch_member, entries), 1):
            members.append(m)
            if n % 25 == 0:
                print(f"  {n}/{len(entries)}")
    with_profile = [m for m in members if m.get("profile")]
    print(f"{len(with_profile)} med profil, {len(members) - len(with_profile)} utan (inte inloggade på länge)")

    cache_file = OUT / "items.json"
    cache = json.loads(cache_file.read_text(encoding="utf-8")) if cache_file.exists() else {}
    cache = item_info({g["id"] for m in with_profile for g in m["gear"]}, cache)
    cache_file.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    for m in with_profile:
        for g in m["gear"]:
            info = cache.get(str(g["id"])) or {}
            g["itemLevel"], g["icon"] = info.get("itemLevel"), info.get("icon")

    fetch_renders(with_profile)
    members.sort(key=lambda m: (-m["level"], m["name"]))
    now = datetime.datetime.now()
    (OUT / "members.json").write_text(json.dumps({
        "guild": roster["guild"]["name"], "realm": REALM, "generated": now.strftime("%Y-%m-%d %H:%M"), "members": members,
    }, indent=1, ensure_ascii=False), encoding="utf-8")
    (OUT / "snapshots" / f"{now:%Y-%m-%d}.json").write_text(json.dumps(
        {m["name"]: {"level": m["level"], "hk": m.get("hk")} for m in members}, ensure_ascii=False), encoding="utf-8")
    log_events(members, now)
    print(f"Klart: {OUT}")


def log_events(members, now):
    """Jämför med förra körningen och skriver det som hänt till events.jsonl.

    Blizzard sparar profilen när man loggar ut, så en ändrad XP/level efter en ny
    inloggning betyder att passet är slut. Med en körning var 30:e minut blir
    utloggningen känd på ungefär en halvtimme när:
      login   ny last_login_timestamp              (t = inloggningen)
      logout  profilen ändrad efter en inloggning  (t = denna körning, s = inloggningen)
      level   ny level                              (t = denna körning)
      hk      nya honorable kills                   (v = antal)
      rep     ny faktion på Exalted                 (v = faktionens namn)
    """
    state_file, log_file = OUT / "state.json", OUT / "events.jsonl"
    state = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
    t = int(now.timestamp() * 1000)
    events = []
    for m in members:
        if not m.get("profile"):
            continue
        prev = state.get(m["name"])
        cur = {"level": m["level"], "login": m.get("lastLogin"), "xp": m.get("xp"), "hk": m.get("hk") or 0,
               "open": (prev or {}).get("open"),
               # ryktena kunde inte hämtas: behåll förra läget så att inget tolkas som nytt nästa gång
               "exalted": m["exalted"] if m.get("exalted") is not None else (prev or {}).get("exalted")}
        if prev:
            if cur["login"] and cur["login"] != prev.get("login"):
                events.append({"t": cur["login"], "n": m["name"], "k": "login"})
                cur["open"] = cur["login"]                       # ett pass pågår tills profilen ändras
            changed = cur["xp"] != prev.get("xp") or cur["level"] != prev.get("level") or cur["hk"] != prev.get("hk")
            if changed and cur.get("open"):
                events.append({"t": t, "n": m["name"], "k": "logout", "s": cur["open"]})
                cur["open"] = None
            for lvl in range(prev.get("level", cur["level"]) + 1, cur["level"] + 1):
                # XP in i nivån avgör ordningen mellan dem som dingat i samma hämtning.
                # Nivåer som passerats helt (flera dings sedan förra körningen) kom tidigare.
                xp = cur["xp"] if lvl == cur["level"] else 10 ** 9
                events.append({"t": t, "n": m["name"], "k": "level", "v": lvl, "xp": xp})
            if cur["hk"] > prev.get("hk", 0):
                events.append({"t": t, "n": m["name"], "k": "hk", "v": cur["hk"] - prev.get("hk", 0)})
            # Exalted: bara jämfört med ett känt förra läge (första gången är utgångsläget, inte nya rykten)
            if cur["exalted"] is not None and prev.get("exalted") is not None:
                for f in sorted(set(cur["exalted"]) - set(prev["exalted"])):
                    events.append({"t": t, "n": m["name"], "k": "rep", "v": f})
        state[m["name"]] = cur
    with open(log_file, "a", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    state_file.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    print(f"{len(events)} nya händelser sedan förra körningen")


if __name__ == "__main__":
    main()

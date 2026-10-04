"""
Bygger DEMO-sidan: en förhandsvisning med påhittad historik, för guildledningen och för rekrytering.

  python scripts/fetch_hemmet.py --realm spineshatter --guild "gli tch" --out data/demo-bas   (en gång: riktiga namn och porträtt)
  python scripts/build_demo.py                                                                 → DEMO/

Karaktärerna är GLI TCH:s riktiga (namn, klass, porträtt, utrustning). Allt annat är påhittat och seedat,
så att sidan blir likadan varje gång: en guild som börjar på level 1 vid releasen den 5 november och levlar
till den 24 december. Dings med klockslag, spelpass, honorable kills och Exalted.

Hämtningen simuleras som den kommer att gå: var 30:e minut under racet (till 1 december), sedan en gång i timmen.
Dings, utloggningar, kills och rykten får tidpunkten för den hämtning som upptäckte dem; inloggningar har exakt
tid (API:t visar den). Den dagliga ögonblicksbilden räknas fram ur händelserna.

Sidan ska vara fylld överallt: i slutet finns minst en tank, en healer och en dps för varje dungeon, och ett gäng
nya medlemmar har gått med under julveckan.

DEMO/ är fristående: ladda upp hela mappen via FTP. Den riktiga sidan (hemmet/, data/hc) rörs inte.
"""
import datetime
import json
import math
import random
import shutil
import subprocess
import sys
from pathlib import Path

import fetch_hemmet as fh

ROOT = Path(__file__).resolve().parent.parent
BASE, OUT, SITE, DEMO, LIVE = ROOT / "data" / "demo-bas", ROOT / "data" / "demo", ROOT / "hemmet", ROOT / "DEMO", ROOT / "DEMO_LIVE"

START = datetime.datetime(2026, 11, 5)               # releasen i EU: 5 nov 00:00 svensk tid
NOW = datetime.datetime(2026, 12, 24, 21, 30)        # "nu" i demon: julafton kväll
RACE_END = datetime.datetime(2026, 12, 1)            # hämtning var 30:e minut till hit, sedan en gång i timmen
DAYS = (NOW.date() - START.date()).days + 1
MAX = 60
HOURS = 120                                          # speltimmar från level 1 till 60 (sätter takten på hela resan)
SEED = 20261105                                      # samma resa varje gång
NEWCOMERS = 9                                        # går med under sista veckan (syns under "Nya hemma")

FACTIONS = ["Stormwind", "Ironforge", "Darnassus", "Gnomeregan Exiles", "Argent Dawn", "Timbermaw Hold", "Cenarion Circle", "Thorium Brotherhood"]
CLASS_HP = {"warrior": 5300, "paladin": 4700, "hunter": 4200, "rogue": 3900, "priest": 3500, "shaman": 4300, "mage": 3300, "warlock": 4400, "druid": 4300}
# samma nivåspann som gruppsöket i app.js (DUNG_ALL)
DUNGEONS = [(13, 18), (13, 18), (15, 20), (17, 24), (17, 26), (22, 30), (24, 32), (24, 32), (24, 29), (28, 30), (29, 38), (29, 38), (30, 45),
            (35, 50), (37, 46), (40, 55), (41, 51), (44, 54), (46, 55), (48, 53), (50, 60), (52, 60), (55, 60), (55, 60), (55, 60), (58, 60),
            (58, 60), (58, 60), (58, 60)]


def hours_to(level):
    """Speltimmar till en viss level. Går fort i början och segt mot slutet, runt HOURS timmar till 60."""
    return HOURS * ((level - 1) / (MAX - 1)) ** 2.15


def level_at(hours):
    return min(MAX, 1 + int((MAX - 1) * (max(0, hours) / HOURS) ** (1 / 2.15) + 1e-9))


def fetch_after(dt):
    """Första hämtningen efter dt (kl :15 och :45 under racet, sedan :15 varje timme)."""
    step = 30 if dt < RACE_END else 60
    base = dt.replace(minute=15, second=0, microsecond=0)
    while base < dt:
        base += datetime.timedelta(minutes=step)
    return base


LAST_FETCH = fetch_after(NOW) - datetime.timedelta(minutes=60)   # senaste hämtningen före "nu"


def start_hour(R, weekend, nolifer):
    """När på dygnet ett pass börjar: mest kvällar, mer dagtid på helger, och några som aldrig sover."""
    x = R.random()
    if nolifer and x < .22:
        return R.uniform(0, 5)
    if x < .04:
        return R.uniform(0, 3)
    if x < .10:
        return R.uniform(6, 9)
    if x < (.42 if weekend else .24):
        return R.uniform(10, 16.5)
    return R.uniform(17, 22.8)


def sim_member(m, nl, join, cap=MAX):
    """En karaktärs resa. Egen slumpföljd per karaktär, så att en justering inte ändrar någon annans."""
    R = random.Random(f"{SEED}-{m['name']}-{cap}")
    name, ms = m["name"], lambda dt: int(dt.timestamp() * 1000)
    act = min(3.2, R.lognormvariate(0, .65))
    daily = R.uniform(11.5, 14.5) if nl else min(10.5, 2.3 * act + .7)
    p_play = .97 if nl else max(.28, min(.95, .33 + .24 * act))
    speed = R.uniform(1.12, 1.3) if nl else R.uniform(.72, 1.2)
    pvp = R.random() < .34
    pvp_love = R.lognormvariate(0, 1.0) if pvp else 0
    lvl_of = lambda h: min(cap, level_at(h))
    events, hours, hk, last, at60 = [], 0.0, 0, None, None
    for d in range(join, DAYS):
        day = START + datetime.timedelta(days=d)
        done = lvl_of(hours) >= cap
        if not (d == join or R.random() < p_play * (.55 if done and not nl else 1)):
            continue
        budget = max(.4, R.gauss(daily, daily * .35)) * (1.25 if day.weekday() >= 5 else 1) * (.6 if done else 1)
        parts = [budget] if budget < 5 or R.random() < .55 else [budget * .45, budget * .55]
        t0 = None
        for length in parts:
            length = min(length, R.uniform(9.5, 12))          # ingen sitter längre än så i ett svep
            h0 = start_hour(R, day.weekday() >= 5, nl) if t0 is None else max(t0 + .7, R.uniform(18, 21.5))
            begin = day + datetime.timedelta(hours=h0)
            end = min(begin + datetime.timedelta(hours=length), NOW)
            if begin >= NOW:
                break
            length = (end - begin).total_seconds() / 3600
            t0 = h0 + length
            events.append({"t": ms(begin), "n": name, "k": "login"})
            before, after = hours, hours + length * speed
            for lvl in range(lvl_of(before) + 1, lvl_of(after) + 1):
                frac = (hours_to(lvl) - before) / max(1e-9, after - before)
                when = begin + (end - begin) * min(1, max(0, frac))
                events.append({"t": ms(fetch_after(when)), "n": name, "k": "level", "v": lvl, "xp": R.randint(0, 9000)})
                if lvl == MAX:
                    at60 = d
            hours = after
            seen = ms(fetch_after(end))          # utloggningen och det som hänt under passet syns vid nästa hämtning
            if pvp and lvl_of(hours) >= 20 and R.random() < .5:
                kills = int(R.expovariate(1 / (6 * pvp_love * (2.2 if lvl_of(hours) >= MAX else 1))))
                if kills:
                    hk += kills
                    events.append({"t": seen, "n": name, "k": "hk", "v": kills})
            events.append({"t": seen, "n": name, "k": "logout", "s": ms(begin)})
            last = ms(begin)
    if at60 is not None and DAYS - at60 > 9 and R.random() < .3:     # Exalted för några som varit 60 ett tag
        when = START + datetime.timedelta(days=R.randint(at60 + 8, DAYS - 1), hours=R.uniform(18, 23))
        if when < NOW:
            events.append({"t": ms(fetch_after(when)), "n": name, "k": "rep", "v": R.choice(FACTIONS)})
    # det som ännu inte hämtats syns inte; dings i samma hämtning: bara den sista har XP att jämföra (som i verkligheten)
    cutoff = ms(LAST_FETCH)
    events = [e for e in events if e["t"] <= cutoff or e["k"] == "login" and e["t"] <= ms(NOW)]
    by_fetch = {}
    for e in events:
        if e["k"] == "level":
            by_fetch.setdefault(e["t"], []).append(e)
    for group in by_fetch.values():
        for e in group[:-1]:
            e["xp"] = 10 ** 9
    level = max([e["v"] for e in events if e["k"] == "level"], default=1)
    hk = sum(e["v"] for e in events if e["k"] == "hk")
    return events, {"hk": hk, "last": last, "level": level, "join": join}


def daily_snapshots(events, extra, members):
    """Nivå och kills vid dagens sista hämtning, ur händelserna (som den riktiga hämtningen gör)."""
    by = {}
    for e in events:
        by.setdefault(e["n"], []).append(e)
    snaps = []
    for d in range(DAYS):
        cut = int(min(START + datetime.timedelta(days=d + 1), LAST_FETCH).timestamp() * 1000)
        snap = {}
        for m in members:
            evs = by.get(m["name"], [])
            if extra[m["name"]]["join"] > d or not evs or evs[0]["t"] > cut:
                continue
            snap[m["name"]] = {"level": max([e["v"] for e in evs if e["k"] == "level" and e["t"] <= cut], default=1),
                               "hk": sum(e["v"] for e in evs if e["k"] == "hk" and e["t"] <= cut)}
        snaps.append(snap)
    return snaps


def simulate(members):
    R = random.Random(SEED)
    order = sorted(members, key=lambda m: -(m.get("ilvl") or 0))
    nolifers = {m["name"] for m in order[:5]}          # de bäst utrustade i verkligheten får bli resans racers
    rest = [m for m in members if m["name"] not in nolifers]
    newcomers = {m["name"] for m in R.sample(rest, NEWCOMERS)}
    plan = {}
    for m in members:
        x = R.random()
        if m["name"] in newcomers:
            join = R.randint(DAYS - 7, DAYS - 1)
        elif m["name"] in nolifers or x < .74:
            join = 0
        else:
            join = R.randint(1, 3) if x < .86 else R.randint(4, DAYS - 10)
        plan[m["name"]] = {"nl": m["name"] in nolifers, "join": join, "cap": MAX}
    result = {m["name"]: sim_member(m, plan[m["name"]]["nl"], plan[m["name"]]["join"]) for m in members}

    # Varje dungeon ska ha minst en tank, en healer och en dps i rätt nivå: några stannar på en lägre level
    role = lambda m: m.get("role") or "dps"
    capped = set()
    for a, b in DUNGEONS:
        for r in ("tank", "healer", "dps"):
            if any(role(m) == r and a <= result[m["name"]][1]["level"] <= b for m in members):
                continue
            pool = [m for m in members if role(m) == r and m["name"] not in nolifers | capped | newcomers and result[m["name"]][1]["level"] > b]
            if not pool:
                continue
            m = R.choice(sorted(pool, key=lambda m: m["name"]))
            capped.add(m["name"])
            plan[m["name"]]["cap"] = R.randint(a, b)
            result[m["name"]] = sim_member(m, plan[m["name"]]["nl"], plan[m["name"]]["join"], plan[m["name"]]["cap"])
    events = sorted((e for ev, _ in result.values() for e in ev), key=lambda e: e["t"])
    extra = {n: x for n, (_, x) in result.items()}
    gaps = [(a, b, r) for a, b in DUNGEONS for r in ("tank", "healer", "dps") if not any(role(m) == r and a <= extra[m["name"]]["level"] <= b for m in members)]
    return events, extra, len(capped), gaps


def restat(members, extra):
    """Nuläget (item level, HP, AP …) omräknat till Forever: GLI TCH:s siffror är från TBC på level 70."""
    R = random.Random(SEED + 1)
    ranked = sorted(members, key=lambda m: m.get("ilvl") or 0)
    pct = {m["name"]: i / max(1, len(ranked) - 1) for i, m in enumerate(ranked)}
    for m in sorted(members, key=lambda m: m["name"]):
        e, q = extra[m["name"]], pct[m["name"]]
        lvl = e["level"]
        lf = (lvl / MAX) ** 1.6
        old_ilvl = m.get("ilvl") or 1
        m["level"], m["hk"], m["lastLogin"] = lvl, e["hk"], e["last"]
        m["ilvl"] = round(56 + 32 * q) if lvl == MAX else max(1, round(lvl * .93 + R.uniform(-2, 3)))
        m["hp"] = round(CLASS_HP.get(m["cls"], 4000) * (lvl / MAX) ** 1.7 * (.84 + .42 * q) / 10) * 10
        m["pvpRank"] = 0 if e["hk"] < 15 else min(14, 1 + int(math.log(e["hk"] / 15 + 1, 1.62)))
        s = m.get("stats") or {}
        for key, f in (("attack_power", .42), ("spell_power", .5)):
            if s.get(key):
                s[key] = round(s[key] * f * lf)
        for key in ("melee_crit", "ranged_crit", "spell_crit"):
            if s.get(key):
                s[key] = round(s[key] * (.45 + .4 * lvl / MAX), 2)
        m["heal"] = round((m.get("heal") or 0) * .55 * lf)
        for g in m.get("gear", []):
            if g.get("itemLevel"):
                g["itemLevel"] = max(1, round(g["itemLevel"] * m["ilvl"] / old_ilvl))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    base = json.loads((BASE / "members.json").read_text(encoding="utf-8"))
    members = [m for m in base["members"] if m.get("profile") and (BASE / "avatars" / f"{m['id']}.jpg").exists()]
    members.sort(key=lambda m: m["name"])                 # fast ordning, så att slumpen ger samma resa varje gång
    events, extra, capped, gaps = simulate(members)
    snaps = daily_snapshots(events, extra, members)
    restat(members, extra)

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "snapshots").mkdir(parents=True)
    for d, snap in enumerate(snaps):
        (OUT / "snapshots" / f"{START + datetime.timedelta(days=d):%Y-%m-%d}.json").write_text(json.dumps(snap, ensure_ascii=False), encoding="utf-8")
    with open(OUT / "events.jsonl", "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    members.sort(key=lambda m: (-m["level"], m["name"]))
    (OUT / "members.json").write_text(json.dumps(
        {"guild": "HEMMET", "realm": "demo", "generated": f"{LAST_FETCH:%Y-%m-%d %H:%M}", "members": members}, ensure_ascii=False), encoding="utf-8")

    # Helkroppsbilder för demons pallar (samma urval som den riktiga hämtningen), från Blizzard om de saknas
    have = {int(f.stem) for f in (BASE / "renders").glob("*.png")} if (BASE / "renders").exists() else set()
    (BASE / "renders").mkdir(exist_ok=True)
    got = 0
    for board in fh.BOARDS:
        for group in [members] + [[m for m in members if m["cls"] == c] for c in set(fh.CLASSES.values())]:
            for m in sorted((m for m in group if (board(m) or 0) > 0), key=lambda m: -board(m))[:3]:
                if m["id"] not in have and m.get("renderUrl") and fh.download(m["renderUrl"], BASE / "renders" / f"{m['id']}.png"):
                    have.add(m["id"])
                    got += 1
    sixty = sum(1 for m in members if m["level"] == MAX)
    fresh = sum(1 for x in extra.values() if x["join"] >= DAYS - 7)
    print(f"{len(members)} karaktärer · {DAYS} dagar ({START:%d %b} – {NOW:%d %b}) · {len(events)} händelser · {sixty} på level {MAX} · "
          f"{fresh} nya senaste veckan · {capped} stannade för att fylla roller · luckor kvar: {gaps or 'inga'} · {got} nya helkroppsbilder")

    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_hemmet.py"), "--src", "data/demo", "--media", "data/demo-bas", "--name", "demo", "--demo"], check=True)

    # DEMO/: fristående mapp att ladda upp
    if DEMO.exists():
        shutil.rmtree(DEMO)
    DEMO.mkdir()
    shutil.copy2(SITE / "demo.html", DEMO / "index.html")
    for f in ("demo-avatars.webp", "demo-icons.webp", "hero.webp"):
        if (SITE / f).exists():
            shutil.copy2(SITE / f, DEMO / f)
    for d in ("ach", "zones", "demo-renders"):
        shutil.copytree(SITE / d, DEMO / d)
    (DEMO / ".htaccess").write_text("AddType image/webp .webp\n<IfModule mod_deflate.c>\n  AddOutputFilterByType DEFLATE text/html\n</IfModule>\n", encoding="utf-8")
    files = [p for p in DEMO.rglob("*") if p.is_file()]
    print(f"Klart → DEMO/  ({len(files)} filer, {sum(p.stat().st_size for p in files) / 1e6:.1f} MB). Ladda upp hela mappen.")

    # DEMO_LIVE/: rekryteringssidan (hero, FAQ, Flytta in) med demon i en overlay
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_hemmet.py"), "--src", "data/demo", "--media", "data/demo-bas", "--name", "live", "--demo", "--recruit"], check=True)
    if LIVE.exists():
        shutil.rmtree(LIVE)
    LIVE.mkdir()
    shutil.copy2(SITE / "live.html", LIVE / "index.html")
    for f in ("live-avatars.webp", "live-icons.webp", "hero.webp"):
        if (SITE / f).exists():
            shutil.copy2(SITE / f, LIVE / f)
    for d in ("ach", "zones", "live-renders"):
        shutil.copytree(SITE / d, LIVE / d)
    shutil.copy2(DEMO / ".htaccess", LIVE / ".htaccess")
    files = [p for p in LIVE.rglob("*") if p.is_file()]
    print(f"Klart → DEMO_LIVE/  ({len(files)} filer, {sum(p.stat().st_size for p in files) / 1e6:.1f} MB). Rekryteringssidan: ladda upp hela mappen.")


if __name__ == "__main__":
    main()

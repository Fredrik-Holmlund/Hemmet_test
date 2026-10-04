"""
Bygger HEMMET-sidan av det fetch_hemmet.py hämtat.

  python scripts/build_hemmet.py                                   (huvudsidan)
  python scripts/build_hemmet.py --src data/hemmet --name glitch    (en egen testsida)

Läser data/hc/ (Frienship tills HEMMET finns i spelet) och skriver till hemmet/:
  avatars.webp   alla porträtt i en sprite (ett artefakt/CDN-vänligt anrop i stället för hundratals)
  icons.webp     alla item-ikoner i en sprite
  index.html     hemmet.template.html + app.js + datan inbakad
"""
import argparse
import datetime
import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageEnhance

from render_model import render as render_model

ROOT = Path(__file__).resolve().parent.parent
SRC, SITE = ROOT / "data" / "hc", ROOT / "hemmet"
AV, IC = 84, 40          # pixelstorlek per porträtt och ikon i spritarna
AV_COLS, IC_COLS = 16, 32


def sprite(files, size, cols, out):
    rows = max(1, math.ceil(len(files) / cols))
    sheet = Image.new("RGB", (cols * size, rows * size), (6, 10, 20))
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB").resize((size, size), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * size, (i // cols) * size))
    sheet.save(out, "WEBP", quality=82, method=6)
    return rows


RAW = ROOT / "assets" / "raw" / "interface"
# Achievement-ikoner (spelets egna, från wow.export) → en sprite; namnet är nyckeln i sidan
ACH_ICONS = [f"achievement_level_{n}" for n in (10, 20, 30, 40, 50, 60)] + [
    "achievement_reputation_08", "achievement_quests_completed_07", "achievement_zone_westfall_01",
    "achievement_zone_stranglethorn_01", "achievement_zone_dunmorogh", "achievement_zulgurub_jindo",
    "achievement_zone_duskwood", "achievement_zone_tanaris_01", "achievement_pvp_a_01", "achievement_pvp_a_14",
    "achievement_zone_blackrock_01", "achievement_zone_elwynnforest", "achievement_zone_ironforge",
]
EXTRA_ICONS = ["inv_chest_plate03", "inv_sword_04", "inv_wand_07", "inv_jewelry_talisman_07", "inv_shield_05",
               "achievement_pvp_a_03", "achievement_pvp_a_07", "achievement_pvp_a_10"]
# Zonernas målningar som bakgrund på tavlan
ZONE_ICONS = {
    "elwynn": "elwynnforest", "westfall": "westfall_01", "redridge": "redridgemountains", "duskwood": "duskwood",
    "hillsbrad": "hillsbradfoothills", "stv": "stranglethorn_01", "dustwallow": "dustwallowmarsh", "tanaris": "tanaris_01",
    "hinterlands": "hinterlands_01", "ungoro": "ungorocrater_01", "steppes": "burningsteppes_01",
    "wpl": "westernplaguelands_01", "winterspring": "winterspring",
}
RENDER_H = 520           # höjd på pallarnas helkroppsbilder
RENDER_REF = 780         # så många px i Blizzards bild motsvarar hela höjden (en lång night elf)
EYE, EYE_FRAMES = 44, 80   # rutstorlek och antal rutor i ögats animation
FRAMES = ["ui-achievement-achievementbackground", "ui-achievement-iconframe", "ui-achievement-alert-background-mini", "ui-achievement-bling", "ui-achievement-shields"]


def build_wow_art():
    out = SITE / "ach"
    out.mkdir(exist_ok=True)
    # topplistornas ikoner (spelets föremålsikoner, jpg) och rangmärkena för PvP-trappan ligger i samma sprite
    names = ACH_ICONS + EXTRA_ICONS
    files = [next(p for p in (RAW / "icons" / f"{n}.png", RAW / "icons" / f"{n}.jpg") if p.exists()) for n in names]
    onyxia = ROOT / "assets" / "art" / "boss-onyxia.webp"
    names = list(names)
    if onyxia.exists():   # bossporträttet från guildsidan, beskuret till en ikon
        im = Image.open(onyxia).convert("RGB")
        s = min(im.size)
        crop = out / "_onyxia.png"
        im.crop(((im.width - s) // 2, 0, (im.width + s) // 2, s)).resize((64, 64), Image.LANCZOS).save(crop)
        files.append(crop)
        names.append("onyxia")
    sprite(files, 64, 8, out / "icons.webp")
    for zid, icon in ZONE_ICONS.items():
        Image.open(RAW / "icons" / f"achievement_zone_{icon}.png").convert("RGB").save(out / f"zone-{zid}.webp", "WEBP", quality=88)
    for f in FRAMES:
        Image.open(RAW / "achievementframe" / f"{f}.png").save(out / f"{f.replace('ui-achievement-', '')}.webp", "WEBP", quality=88)
    # Dungeon Finder-ögat: 80 rutor ur spelets flipbook (ögat tittar runt och blinkar) → en remsa för CSS-animationen
    book = Image.open(RAW / "hud" / "uigroupfinderflipbook.png").convert("RGBA")
    strip = Image.new("RGBA", (EYE_FRAMES * EYE, EYE))
    for i in range(EYE_FRAMES):
        x, y = 1 + (i % 11) * EYE, 311 + (i // 11) * EYE
        strip.paste(book.crop((x, y, x + EYE, y + EYE)), (i * EYE, 0))
    strip.save(out / "lfg-eye.webp", "WEBP", lossless=True)
    # Group Finder-fönstret ur spelets bildark: panelen med äventyrarna (ljusad, originalet är nästan svart),
    # och de runda rollikonerna (tank, healer, dps i den ordningen)
    lfg = Image.open(RAW / "lfgframe" / "groupfinderc60.png").convert("RGBA")
    ImageEnhance.Brightness(lfg.crop((0, 0, 450, 450)).convert("RGB")).enhance(2.2).save(out / "lfg-panel.webp", "WEBP", quality=86, method=6)
    roles = Image.new("RGBA", (26 * 3, 26))
    for i, box in enumerate(((976, 1, 1002, 27), (948, 1, 974, 27), (903, 45, 929, 71))):
        roles.paste(lfg.crop(box), (i * 26, 0))
    roles.save(out / "lfg-roles.webp", "WEBP", lossless=True)
    # Meeting stone till gruppsöket: spelets 3D-modell ritad till en bild (görs en gång, tar några sekunder)
    stone = out / "meetingstone.webp"
    if not stone.exists():
        d = ROOT / "assets" / "raw" / "world" / "meetingstone"
        render_model(d / "meetingstone01.gltf", {"meetingstone01": d / "meetingstone01.png", "bindstonesign07": d / "bindstonesign07.png"},
                     out_h=560, yaw=90).save(stone, "WEBP", quality=88, method=6)
    # Alliance-bannern (blått och guld, sidans färger) som fond bakom pallens etta
    banner = out / "banner.webp"
    if not banner.exists():
        d = ROOT / "assets" / "raw" / "world" / "banner"
        render_model(d / "tournament_banner_human02_nocol.gltf", {"tournament_banner_human01": d / "tournament_banner_human01.png"},
                     out_h=620, yaw=270, pitch=4).save(banner, "WEBP", quality=88, method=6)
    # Lådan från Explorers' League som pallsteg (ritad lite uppifrån så att locket syns: figurerna står på den)
    crate = out / "crate.webp"
    if not crate.exists():
        d = ROOT / "assets" / "raw" / "world" / "crate"
        render_model(d / "10el_explorersleague_box03.gltf", {"10el_explorersleague_boxstack03_4252503": d / "10el_explorersleague_boxstack03_4252503.png"},
                     out_h=300, yaw=0, pitch=12).save(crate, "WEBP", quality=90, method=6)
    # den handritade pilen (svart på genomskinligt) i guld
    arrow = Image.open(ROOT / "assets" / "raw" / "interface" / "arrow.png").convert("RGBA")
    gold = Image.new("RGBA", arrow.size, (240, 210, 122, 255))
    gold.putalpha(arrow.getchannel("A"))
    gold.save(out / "arrow.webp", "WEBP", lossless=True)
    return {n: i for i, n in enumerate(names)}


def main():
    global SRC
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="datamapp från fetch_hemmet.py (standard data/hc)")
    ap.add_argument("--name", default="", help="egen testsida, t.ex. glitch → hemmet/glitch.html med egna spritar (standard index.html)")
    ap.add_argument("--media", help="mapp med avatars/, icons/ och renders/ om de ligger någon annanstans än i --src (demon lånar GLI TCH:s)")
    ap.add_argument("--demo", action="store_true", help="förhandsvisning med exempeldata: sidan fryser \"nu\" vid datans tidpunkt och byter till \"vad som kommer\"-texter")
    ap.add_argument("--recruit", action="store_true", help="rekryteringssidan (med --demo): hero, FAQ och Flytta in; demon i en overlay")
    args = ap.parse_args()
    if args.src:
        SRC = ROOT / args.src
    MEDIA = ROOT / args.media if args.media else SRC
    pre = f"{args.name}-" if args.name else ""
    page = f"{args.name}.html" if args.name else "index.html"
    data = json.loads((SRC / "members.json").read_text(encoding="utf-8"))
    snaps = sorted((SRC / "snapshots").glob("*.json"))
    dates = [s.stem for s in snaps]
    history = [json.loads(s.read_text(encoding="utf-8")) for s in snaps]

    members = data["members"]
    avatars = [m for m in members if (MEDIA / "avatars" / f"{m['id']}.jpg").exists()]
    av_index = {m["id"]: i for i, m in enumerate(avatars)}
    sprite([MEDIA / "avatars" / f"{m['id']}.jpg" for m in avatars], AV, AV_COLS, SITE / f"{pre}avatars.webp")

    icons = sorted({g["icon"] for m in members for g in m.get("gear", []) if g.get("icon") and (MEDIA / "icons" / f"{g['icon']}.jpg").exists()})
    ic_index = {n: i for i, n in enumerate(icons)}
    sprite([MEDIA / "icons" / f"{n}.jpg" for n in icons], IC, IC_COLS, SITE / f"{pre}icons.webp")

    # Helkroppsbilder för pallarna: beskurna till figuren och nedskalade (originalen är 1600×1200 med mycket luft)
    rdir = SITE / f"{pre}renders"
    rdir.mkdir(exist_ok=True)
    renders = set()
    wanted = {m["id"] for m in members}   # bara bilder för dem som finns med på sidan
    for src in (MEDIA / "renders").glob("*.png") if (MEDIA / "renders").exists() else []:
        if int(src.stem) not in wanted:
            continue
        dst = rdir / f"{src.stem}.webp"
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            im = Image.open(src).convert("RGBA")
            box = im.getbbox()
            if not box:
                continue
            # Behåll Blizzards skala så att en gnome inte blir lika lång som en night elf: alla bilder får samma
            # höjd räknat från fötterna (RENDER_REF px i originalet), med luft ovanför de korta.
            top = min(box[1], box[3] - RENDER_REF)
            im = im.crop((box[0], top, box[2], box[3]))
            im = im.resize((max(1, round(im.width * RENDER_H / im.height)), RENDER_H), Image.LANCZOS)
            im.save(dst, "WEBP", quality=82, method=6)
        renders.add(int(src.stem))
    for f in rdir.glob("*.webp"):
        if int(f.stem) not in renders:
            f.unlink()

    # Kompakt data till sidan
    out = []
    for m in members:
        s = m.get("stats") or {}
        out.append({
            "n": m["name"], "c": m["cls"], "r": m["race"], "g": m.get("gender"), "l": m["level"], "rk": m.get("rank"),
            "ll": m.get("lastLogin"), "il": m.get("ilvl"), "hp": m.get("hp"), "hk": m.get("hk"), "pr": m.get("pvpRank"),
            "t": m.get("title"), "ap": s.get("attack_power"), "sp": s.get("spell_power"),
            "spec": m.get("spec"), "role": m.get("role"), "hl": m.get("heal"), "rd": m["id"] if m["id"] in renders else None,
            "cr": max([v for v in (s.get("melee_crit"), s.get("ranged_crit"), s.get("spell_crit")) if v is not None], default=None),
            "a": av_index.get(m["id"], -1),
            "gear": [[g["slot"], g["name"], g["quality"], g.get("itemLevel"), ic_index.get(g.get("icon"), -1)]
                     for g in sorted(m.get("gear", []), key=lambda g: g["slot"])],
            "h": [(h.get(m["name"]) or {}).get("level") for h in history],
        })
    # Händelser: [tid, medlemsindex, typ, värde]  typ 0 level · 1 login · 2 logout (värde = inloggningen) · 3 hk · 4 rep (värde = faktionen)
    idx = {m["name"]: i for i, m in enumerate(members)}
    kinds = {"level": 0, "login": 1, "logout": 2, "hk": 3, "rep": 4}
    events = []
    log = SRC / "events.jsonl"
    if log.exists():
        for line in log.read_text(encoding="utf-8").splitlines():
            e = json.loads(line)
            if e["n"] in idx:
                events.append([e["t"], idx[e["n"]], kinds[e["k"]], e.get("v", e.get("s")), e.get("xp")])
    payload = {
        "guild": data["guild"], "realm": data["realm"], "generated": data["generated"], "dates": dates, "events": events,
        "max": 60,   # WoW Forever stannar på 60 för gott
        "av": {"size": AV, "cols": AV_COLS}, "ic": {"size": IC, "cols": IC_COLS}, "achIcons": build_wow_art(),
        "members": out,
    }
    if args.recruit:
        payload["recruit"] = True
    if args.demo:   # tidpunkten datan "hämtades": sidan räknar "för 12 min sedan" från den, inte från dagens datum
        payload["demo"] = {"now": int(datetime.datetime.strptime(data["generated"], "%Y-%m-%d %H:%M").timestamp() * 1000)}

    # Heron: första bilden i assets/raw/hero/ (t.ex. en laddningsskärm eller en egen skärmdump från Elwynn)
    hero_src = sorted(p for p in (ROOT / "assets" / "raw" / "hero").glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    if hero_src:
        im = Image.open(hero_src[0]).convert("RGB")
        if im.width > 2400:
            im = im.resize((2400, round(im.height * 2400 / im.width)), Image.LANCZOS)
        im.save(SITE / "hero.webp", "WEBP", quality=82)
        payload["hero"] = True
        print(f"Hero-bild: {hero_src[0].name}")

    # (Outland-konsten behövs inte: Forever har inga levels över 60)

    tpl = (SITE / "hemmet.template.html").read_text(encoding="utf-8")
    app = (SITE / "app.js").read_text(encoding="utf-8")
    html = tpl.replace("__APP__", app).replace("__DATA__", json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    html = html.replace('"renders/"', f'"{pre}renders/"')
    html = html.replace('url("avatars.webp")', f'url("{pre}avatars.webp")').replace('url("icons.webp")', f'url("{pre}icons.webp")')
    if args.name:   # egen sida: guildens namn i titeln så att sidorna går att skilja åt
        html = html.replace("<title>HEMMET</title>", "<title>HEMMET · Förhandsvisning</title>" if args.demo else f"<title>HEMMET · {data['guild']}</title>", 1)
    (SITE / page).write_text(html, encoding="utf-8")
    print(f"{len(members)} medlemmar · {len(avatars)} porträtt · {len(icons)} ikoner · {len(dates)} snapshots · "
          f"{(SITE / page).stat().st_size // 1024} KB {page}")


if __name__ == "__main__":
    main()

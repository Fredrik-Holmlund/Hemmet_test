"""
Testar vad Blizzards API ger för en guild och en karaktär (bara standardbiblioteket).

  python scripts/bnet_probe.py --realm spineshatter --guild "gli tch" --char Bobbox

Läser BNET_ID och BNET_SECRET från .env (skapa en klient på develop.battle.net).
Provar flera namespaces, eftersom Classic-varianterna har olika:
  profile-classic1x-eu  Era / Anniversary / Hardcore
  profile-classic-eu    progression (TBC/Wrath/Cata/MoP Classic)
  profile-eu            retail
Svaren sparas råa i data/bnet-probe/ och en sammanfattning skrivs ut.
"""
import argparse
import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "bnet-probe"
REGION = "eu"
NAMESPACES = ["classic1x", "classic", ""]  # "" = retail


def _env():
    values = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()
    return values


def token():
    env = _env()
    auth = base64.b64encode(f"{env['BNET_ID']}:{env['BNET_SECRET']}".encode()).decode()
    req = urllib.request.Request(
        "https://oauth.battle.net/token",
        data=b"grant_type=client_credentials",
        headers={"Authorization": f"Basic {auth}", "User-Agent": "guildsite-dev"},
    )
    return json.load(urllib.request.urlopen(req, timeout=30))["access_token"]


def get(tok, path, namespace):
    url = f"https://{REGION}.api.blizzard.com{path}?" + urllib.parse.urlencode({"namespace": namespace, "locale": "en_GB"})
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}", "User-Agent": "guildsite-dev"})
    try:
        return 200, json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        return e.code, None


def slug(s):
    return urllib.parse.quote(s.strip().lower().replace(" ", "-"))


def pick(d, *keys):
    """Plocka ut ett nästlat värde, t.ex. pick(p, 'character_class', 'name')."""
    for k in keys:
        if not isinstance(d, dict) or k not in d:
            return None
        d = d[k]
    return d


def summary(name, data):
    """De fält vi bryr oss om för sidan."""
    if name == "roster":
        m = data.get("members", [])
        first = m[0]["character"] if m else {}
        return f"{len(m)} medlemmar, exempel: {first.get('name')} level {first.get('level')}, fält: {sorted(first)}"
    if name == "profile":
        return (f"level {data.get('level')}, {pick(data, 'race', 'name')} {pick(data, 'character_class', 'name')}, "
                f"kön {pick(data, 'gender', 'type')}, senast inloggad {data.get('last_login_timestamp')}, "
                f"ilvl {data.get('equipped_item_level')} (snitt {data.get('average_item_level')})")
    if name == "equipment":
        items = data.get("equipped_items", [])
        return f"{len(items)} föremål, t.ex. " + ", ".join(f"{pick(i, 'slot', 'type')}={i.get('name')} ({pick(i, 'quality', 'type')})" for i in items[:3])
    if name == "media":
        return "bilder: " + ", ".join(f"{a.get('key')}={a.get('value')}" for a in data.get("assets", []))
    if name == "statistics":
        return f"hp {data.get('health')}, {pick(data, 'power_type', 'name')} {data.get('power')}"
    if name == "pvp":
        return f"honorable kills {data.get('honorable_kills')}, övriga fält: {sorted(data)}"
    return f"fält: {sorted(data)}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--realm", required=True)
    ap.add_argument("--guild", required=True)
    ap.add_argument("--char", required=True)
    args = ap.parse_args()
    realm, guild, char = slug(args.realm), slug(args.guild), slug(args.char)
    tok = token()
    OUT.mkdir(parents=True, exist_ok=True)

    base = f"/profile/wow/character/{realm}/{char}"
    endpoints = {
        "roster": f"/data/wow/guild/{realm}/{guild}/roster",
        "profile": base,
        "equipment": f"{base}/equipment",
        "media": f"{base}/character-media",
        "statistics": f"{base}/statistics",
        "pvp": f"{base}/pvp-summary",
        "specializations": f"{base}/specializations",
        "appearance": f"{base}/appearance",
    }
    for kind in NAMESPACES:
        ns = f"profile-{kind}-{REGION}" if kind else f"profile-{REGION}"
        print(f"\n=== {ns} ===")
        for name, path in endpoints.items():
            status, data = get(tok, path, ns)
            if status != 200:
                print(f"  {name:<16} {status}")
                continue
            (OUT / f"{kind or 'retail'}-{name}.json").write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
            print(f"  {name:<16} OK  {summary(name, data)}")
    print(f"\nRåa svar i {OUT}")


if __name__ == "__main__":
    main()

"""
Spanar efter Blizzards API för WoW Forever (bara standardbiblioteket).

  python scripts/api_vakt.py              provar och skriver en rapport
  python scripts/api_vakt.py --spara-bas  sparar dagens realmlistor som jämförelse
  python scripts/api_vakt.py --prov       låtsas att något hittats (för att testa issue och mejl)

Två saker räknas som fynd:
  1. en gissad Forever-namnrymd (classicforever, forever …) svarar i stället för 403
  2. en ny realm har dykt upp i en befintlig namnrymd (classicann, classic1x, classic),
     jämfört med data/api-vakt.json — Forever kan hamna i en av dem

Körs dagligen av .github/workflows/vakt.yml, som skapar ett issue vid fynd.
Kräver BNET_ID och BNET_SECRET (.env lokalt, Secrets i Actions).
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_hemmet import token  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BAS = ROOT / "data" / "api-vakt.json"
REGIONER = ["eu", "us"]
KANDIDATER = ["classicforever", "forever", "classic-forever", "classicfv", "classicfr", "wowforever",
              "classic2x", "classicplus", "classic60", "classicf", "fvr", "classic4", "classicprog"]
KANDA = ["classicann", "classic1x", "classic"]


def realmer(tok, ns, region):
    """Realmnamnen i en namnrymd, eller HTTP-koden om den inte svarar."""
    url = f"https://{region}.api.blizzard.com/data/wow/realm/index?namespace=dynamic-{ns}-{region}&locale=en_GB"
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
        return sorted(r["name"] for r in json.load(urllib.request.urlopen(req, timeout=30))["realms"])
    except urllib.error.HTTPError as e:
        return e.code


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--spara-bas", action="store_true")
    ap.add_argument("--prov", action="store_true")
    args = ap.parse_args()

    tok = token()
    fynd, logg = [], []

    for region in REGIONER:
        for ns in KANDIDATER:
            svar = realmer(tok, ns, region)
            logg.append(f"dynamic-{ns}-{region}: {svar if isinstance(svar, int) else f'{len(svar)} realmer'}")
            if isinstance(svar, list):
                fynd.append(f"**`dynamic-{ns}-{region}` svarar** med {len(svar)} realmer: {', '.join(svar)}")

    bas = json.loads(BAS.read_text(encoding="utf-8")) if BAS.exists() else {}
    nu = {}
    for region in REGIONER:
        for ns in KANDA:
            svar = realmer(tok, ns, region)
            if isinstance(svar, int):
                logg.append(f"dynamic-{ns}-{region}: {svar} (svarade inte)")
                continue
            nu[f"{ns}-{region}"] = svar
            nya = sorted(set(svar) - set(bas.get(f"{ns}-{region}", svar)))
            logg.append(f"dynamic-{ns}-{region}: {len(svar)} realmer" + (f", nya: {', '.join(nya)}" if nya else ""))
            if nya:
                fynd.append(f"**Nya realmer i `dynamic-{ns}-{region}`**: {', '.join(nya)}")

    if args.spara_bas:
        BAS.parent.mkdir(parents=True, exist_ok=True)
        BAS.write_text(json.dumps(nu, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"Bas sparad: {BAS.relative_to(ROOT)}")
    if args.prov:
        fynd.append("**Provlarm** (`--prov`): inget riktigt fynd, bara ett test av issue och mejl.")

    print("\n".join(logg))
    rapport = ("Vakten hittade något som kan vara Forever-API:t:\n\n" + "\n".join(f"- {f}" for f in fynd)
               + "\n\n<details><summary>Alla svar</summary>\n\n```\n" + "\n".join(logg) + "\n```\n</details>\n")
    (ROOT / "vakt-rapport.md").write_text(rapport, encoding="utf-8")
    print(f"\n{len(fynd)} fynd")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"fynd={'ja' if fynd else 'nej'}\n")


if __name__ == "__main__":
    main()

r"""Bygger hemmet.wtf och pushar den till repot hemmet_prerelease, som publicerar den på GitHub Pages.

Sajten sätts ihop i C:\JOBB\Wow Forever\hemmet.wtf_leveling_plus_raiding (bygg.py där): rekryteringssidan (DEMO_LIVE/)
på hemmet.wtf/ och ledningssidan i visningsläge på hemmet.wtf/raiding/. Repot ligger utcheckat bredvid projektet:
C:\JOBB\Wow Forever\hemmet_prerelease. Allt utom .git, .github och README ersätts.
  python scripts/publicera_prerelease.py            # bygg och publicera
  python scripts/publicera_prerelease.py --no-build # hoppa över build_demo.py (DEMO_LIVE/ finns redan)
"""
import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITEDIR = ROOT.parent / "hemmet.wtf_leveling_plus_raiding"
SITE = SITEDIR / "site"
REPO = ROOT.parent / "hemmet_prerelease"
KEEP = {".git", ".github", "README.md"}
OURS = ("hemmet.wtf ", "Rekryteringssidan ")   # commit-meddelanden från det här skriptet


def git(*args):
    return subprocess.run(["git", "-C", str(REPO), *args], check=True, capture_output=True, text=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-build", action="store_true")
    args = ap.parse_args()
    if not (REPO / ".git").exists():
        sys.exit(f"Hittar inte repot i {REPO}")
    # ändringar som gjorts direkt på GitHub skulle skrivas över: stanna hellre och visa dem
    git("fetch", "-q", "origin")
    other = [s for s in git("log", "HEAD..origin/main", "--format=%s").splitlines() if not s.startswith(OURS)]
    if other:
        sys.exit("Någon har ändrat direkt i hemmet_prerelease på GitHub:\n  " + "\n  ".join(other)
                 + "\nFör över ändringen till källan (leveling-projektet eller intranätet) och kör sedan:\n"
                 + f"  git -C \"{REPO}\" reset --hard origin/main")
    git("reset", "-q", "--hard", "origin/main")

    if not args.no_build:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_demo.py")], check=True)
    subprocess.run([sys.executable, str(SITEDIR / "bygg.py")], check=True)

    for p in REPO.iterdir():
        if p.name not in KEEP:
            shutil.rmtree(p) if p.is_dir() else p.unlink()
    for p in SITE.iterdir():
        (shutil.copytree if p.is_dir() else shutil.copy2)(p, REPO / p.name)
    git("add", "-A")
    if not git("status", "--porcelain").strip():
        print("Inget nytt att publicera.")
        return
    git("commit", "-q", "-m", f"hemmet.wtf {datetime.now():%Y-%m-%d %H:%M}")
    git("push", "-q", "origin", "main")
    print("Pushat. Sidan publiceras om en minut: https://hemmet.wtf (och /raiding/)")


if __name__ == "__main__":
    main()

"""Bygger rekryteringssidan (DEMO_LIVE/) och pushar den till repot hemmet_prerelease, som publicerar den på GitHub Pages.

Repot ligger utcheckat bredvid projektet: C:\JOBB\Wow Forever\hemmet_prerelease. Allt utom .git, .github och README ersätts.
  python scripts/publicera_prerelease.py            # bygg och publicera
  python scripts/publicera_prerelease.py --no-build # publicera den DEMO_LIVE/ som redan finns
"""
import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIVE = ROOT / "DEMO_LIVE"
REPO = ROOT.parent / "hemmet_prerelease"
KEEP = {".git", ".github", "README.md"}


def git(*args):
    return subprocess.run(["git", "-C", str(REPO), *args], check=True, capture_output=True, text=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-build", action="store_true")
    args = ap.parse_args()
    if not args.no_build:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_demo.py")], check=True)
    if not (REPO / ".git").exists():
        sys.exit(f"Hittar inte repot i {REPO}")
    for p in REPO.iterdir():
        if p.name not in KEEP:
            shutil.rmtree(p) if p.is_dir() else p.unlink()
    for p in LIVE.iterdir():
        if p.name == ".htaccess":   # bara för Apache-värdar; Pages läser den inte
            continue
        (shutil.copytree if p.is_dir() else shutil.copy2)(p, REPO / p.name)
    git("add", "-A")
    if not git("status", "--porcelain").strip():
        print("Inget nytt att publicera.")
        return
    git("commit", "-q", "-m", f"Rekryteringssidan {datetime.now():%Y-%m-%d %H:%M}")
    git("push", "-q", "origin", "main")
    print("Pushat. Sidan publiceras om en minut: https://fredrik-holmlund.github.io/hemmet_prerelease/")


if __name__ == "__main__":
    main()

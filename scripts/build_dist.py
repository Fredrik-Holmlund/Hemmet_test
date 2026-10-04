"""
Samlar HEMMET-sidan i dist/, redo att ladda upp till ett vanligt webbhotell (FTP) eller statisk hosting.

  python scripts/build_hemmet.py
  python scripts/build_dist.py

Bara det som sidan läser följer med: index.html (datan är inbakad), spritarna och bilderna.
Skript, rådata och .env (hemligheter) följer aldrig med.
En .htaccess läggs med för Apache-webbhotell: rätt MIME-typer, komprimering och cache.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE, DIST = ROOT / "hemmet", ROOT / "dist"

FILES = ["index.html", "avatars.webp", "icons.webp", "hero.webp"]
DIRS = ["ach", "zones", "renders"]

HTACCESS = """# HEMMET — inställningar för Apache-webbhotell

AddType image/webp .webp

# Komprimera text (sidan har datan inbakad och krymper till en bråkdel)
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html
</IfModule>

# Cache: bilderna länge, sidan kort (den byggs om var 30:e minut)
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 1 day"
  ExpiresByType image/jpeg "access plus 30 days"
  ExpiresByType text/html "access plus 5 minutes"
</IfModule>
"""


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    for f in FILES:
        if (SITE / f).exists():   # hero.webp finns bara om det ligger en bild i assets/raw/hero/
            shutil.copy2(SITE / f, DIST / f)
    for d in DIRS:
        shutil.copytree(SITE / d, DIST / d)
    (DIST / ".htaccess").write_text(HTACCESS, encoding="utf-8")
    files = [p for p in DIST.rglob("*") if p.is_file()]
    size = sum(p.stat().st_size for p in files)
    print(f"Klart → dist/  ({len(files)} filer, {size / 1e6:.1f} MB)")
    print("Ladda upp HELA innehållet i dist/ (inklusive .htaccess) till webbhotellets mapp för sidan.")


if __name__ == "__main__":
    main()

"""
Lokal server för HEMMET-sidan.

  python scripts/serve.py          → http://localhost:5173   (dubbelklicka scripts/lokal-server.bat)

Som `python -m http.server`, men med "no-cache" så att webbläsaren alltid hämtar den
senaste byggda sidan (annars kan den visa en gammal index.html efter en ombyggnad).
"""
import http.server
import mimetypes
import sys
from pathlib import Path

mimetypes.add_type("image/webp", ".webp")   # saknas i Windows register på vissa datorer
SITE = Path(__file__).resolve().parent.parent / "hemmet"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass   # tyst: bara adressen skrivs ut


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"HEMMET: http://localhost:{PORT}   (stäng fönstret för att stoppa)")
    server.serve_forever()

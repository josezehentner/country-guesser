#!/usr/bin/env python3
"""Local development server that stops browsers from caching files."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8000
ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"Serving on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()

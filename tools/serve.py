#!/usr/bin/env python3
"""Local development server that stops browsers from caching files.

    npm start           this computer only, at http://localhost:8000
    npm run start:lan   also phones on the same Wi-Fi, at the address it prints
"""
import os
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

# Set PORT to run several servers at once, e.g. one per worktree: PORT=8001 npm start
PORT = int(os.environ.get("PORT", "8000"))
ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # Hidden files and folders such as .git and .claude are no part of the site, and
    # on the Wi-Fi anyone could read them.
    def send_head(self):
        segments = unquote(urlsplit(self.path).path).split("/")
        if any(segment.startswith(".") for segment in segments):
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


# The address other devices on the network reach this computer at. Connecting a UDP
# socket sends nothing, it only picks the network interface.
def lan_address():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        try:
            probe.connect(("10.255.255.255", 1))
            return probe.getsockname()[0]
        except OSError:
            return "127.0.0.1"


if __name__ == "__main__":
    lan = "--lan" in sys.argv[1:]
    server = ThreadingHTTPServer(("0.0.0.0" if lan else "127.0.0.1", PORT), NoCacheHandler)
    port = server.server_address[1]
    print(f"Serving on http://localhost:{port}", flush=True)
    if lan:
        print(f"On a phone in the same Wi-Fi: http://{lan_address()}:{port}", flush=True)
    server.serve_forever()

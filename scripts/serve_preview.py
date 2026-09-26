#!/usr/bin/env python3
"""Simple HTTP server to preview Carrot HA Trip Candidates showcase."""
import http.server
import socketserver
import os
import sys
from pathlib import Path

PORT = 8088
ROOT = Path(__file__).resolve().parents[1]

os.chdir(ROOT)

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving Carrot HA Trip Candidates at http://localhost:{PORT}/preview/trip_candidates/index.html")
        sys.stdout.flush()
        httpd.serve_forever()

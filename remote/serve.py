#!/usr/bin/env python3
"""Serve the ABS Remote app on the local network.

Usage:  python3 serve.py [port]   (default port 8000)
"""
import http.server
import os
import socket
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Dev server: never cache, so edits always land on reload.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
    ip = lan_ip()
    print('ABS Remote is running:')
    print(f'  This machine: http://localhost:{PORT}')
    print(f'  Your phone:   http://{ip}:{PORT}')
    print('Press Ctrl+C to stop.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')

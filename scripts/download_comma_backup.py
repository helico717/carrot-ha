#!/usr/bin/env python3
"""Download an existing private backup through the administrator HA terminal.

Mac-side tool; requires aiohttp. OAuth credentials stay in memory and the refresh
token is revoked on exit. Never restores or modifies Comma files.
"""
import argparse
import asyncio
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re
import secrets
import shlex
import threading
import urllib.parse

import aiohttp

try:
    timeout = asyncio.timeout
except AttributeError:  # macOS system Python 3.9
    from async_timeout import timeout


class Receiver:
    def __init__(self, stream, marker, expected):
        self.stream, self.marker, self.expected = stream, marker, expected
        self.buffer = ''
        self.started = self.done = False
        self.size = self.received = self.sequence = 0
        self.digest = hashlib.sha256()

    def feed(self, data):
        self.buffer += data.decode('ascii', errors='replace')
        if len(self.buffer) > 262144:
            raise RuntimeError('Unexpected terminal output')
        while '\n' in self.buffer:
            line, self.buffer = self.buffer.split('\n', 1)
            line = line.rstrip('\r')
            if not line.startswith(self.marker + ' '):
                continue
            fields = line.split(' ')
            if fields[1] == 'BEGIN' and not self.started:
                self.size = int(fields[2])
                if not 0 < self.size <= 512 * 1024 * 1024:
                    raise RuntimeError('Backup size outside allowed range')
                self.started = True
            elif fields[1] == 'DATA' and self.started and not self.done:
                if int(fields[2]) != self.sequence:
                    raise RuntimeError('Missing or duplicate transfer chunk')
                chunk = base64.b64decode(fields[3], validate=True)
                self.received += len(chunk)
                if self.received > self.size:
                    raise RuntimeError('Transfer exceeded announced size')
                self.stream.write(chunk)
                self.digest.update(chunk)
                self.sequence += 1
            elif fields[1] == 'END' and self.started:
                if self.received != self.size or self.digest.hexdigest() != self.expected:
                    raise RuntimeError('Backup size or SHA256 mismatch')
                self.done = True


def command(filename, marker):
    if not re.fullmatch(r'carrot-[0-9TZ]+\.tar\.gz', filename):
        raise ValueError('Invalid backup filename')
    code = (
        "import os,base64,time;"
        "p='/data/carrot-backups/" + filename + "';"
        "f=open(p,'rb');"
        "print('\\n" + marker + " BEGIN',os.fstat(f.fileno()).st_size,flush=True);"
        "exec(\"for i,b in enumerate(iter(lambda:f.read(3072),b'')):\\n"
        " print('" + marker + " DATA',i,base64.b64encode(b).decode(),flush=True)\\n"
        " time.sleep(0.10)\");"
        "print('" + marker + " END',flush=True)"
    )
    return 'python3 -c ' + shlex.quote(code) + '\n'


async def download(args):
    state = secrets.token_urlsafe(24)
    result = {}
    class Callback(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass
        def do_GET(self):
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            if query.get('state') != [state] or not query.get('code'):
                self.send_error(400)
                return
            result['code'] = query['code'][0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write('HA login received. Return to the backup downloader. 이 창은 닫아도 됩니다.'.encode())
    server = ThreadingHTTPServer(('127.0.0.1', 0), Callback)
    client_id = f'http://127.0.0.1:{server.server_port}/'
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    auth_url = args.url + '/auth/authorize?' + urllib.parse.urlencode({
        'client_id': client_id, 'redirect_uri': client_id, 'state': state})
    print('브라우저에서 본인 HA 계정으로 로그인해주세요. 인증정보는 저장하지 않습니다.', flush=True)
    print(auth_url, flush=True)
    refresh = None
    output = args.output.expanduser()
    output.mkdir(parents=True, exist_ok=True)
    final = output / args.filename
    partial = output / (args.filename + '.partial')
    if final.exists() or partial.exists():
        server.shutdown()
        server.server_close()
        raise RuntimeError('Output already exists; refusing to overwrite')
    try:
        async with timeout(600):
            while 'code' not in result:
                await asyncio.sleep(0.25)
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
            try:
                async with session.post(args.url + '/auth/token', data={
                    'grant_type': 'authorization_code', 'code': result['code'], 'client_id': client_id},
                    allow_redirects=False) as response:
                    response.raise_for_status()
                    token = await response.json()
                refresh = token.get('refresh_token')
                async with session.ws_connect(args.url.replace('https://', 'wss://', 1) + '/api/websocket',
                                              heartbeat=20, max_msg_size=1048576) as ws:
                    await ws.receive_json(timeout=15)
                    await ws.send_json({'type': 'auth', 'access_token': token['access_token']})
                    if (await ws.receive_json(timeout=15)).get('type') != 'auth_ok':
                        raise RuntimeError('HA authentication failed')
                    if not args.device:
                        await ws.send_json({'id': 10, 'type': 'config/device_registry/list'})
                        registry = await ws.receive_json(timeout=15)
                        if registry.get('id') != 10 or not registry.get('success'):
                            raise RuntimeError('Cannot discover configured vehicle')
                        devices = {identity[1] for device in registry['result']
                                   for identity in device.get('identifiers', [])
                                   if len(identity) == 2 and identity[0] == 'carrot_ha'}
                        if len(devices) != 1:
                            raise RuntimeError('Multiple or missing vehicles; select with --device')
                        args.device = devices.pop()
                    marker = 'CB' + secrets.token_hex(12)
                    await ws.send_json({'id': 1, 'type': 'carrot_ha/terminal/subscribe', 'device_id': args.device})
                    with partial.open('xb') as stream:
                        receiver = Receiver(stream, marker, args.sha256)
                        acquired = False
                        last_status = {}
                        try:
                            async with timeout(900):
                                while not receiver.done:
                                    message = await ws.receive_json(timeout=90)
                                    if message.get('type') == 'result':
                                        if not message.get('success'):
                                            raise RuntimeError('HA rejected request; close the browser terminal controller and retry')
                                        if message['id'] == 1:
                                            await ws.send_json({'id': 2, 'type': 'carrot_ha/terminal/acquire', 'device_id': args.device})
                                        elif message['id'] == 2:
                                            acquired = True
                                            await ws.send_json({'id': 3, 'type': 'carrot_ha/terminal/input',
                                                'device_id': args.device, 'message': {'type': 'raw', 'data': command(args.filename, marker)}})
                                    elif message.get('type') == 'event':
                                        event = message.get('event', {})
                                        if event.get('type') == 'status':
                                            last_status = {key: event.get(key) for key in ('connected', 'offroad', 'local_ready', 'ready')}
                                        if event.get('type') == 'ended' and acquired:
                                            reason = str(event.get('reason', 'unknown'))[:80]
                                            raise RuntimeError('Terminal session ended before completion: ' + reason
                                                               + '; status=' + str(last_status))
                                        payload = event.get('message', {})
                                        if event.get('type') == 'terminal' and payload.get('type') == 'pty_output':
                                            receiver.feed(base64.b64decode(payload['b64'], validate=True))
                                stream.flush()
                                os.fsync(stream.fileno())
                        finally:
                            if acquired and not ws.closed:
                                if not receiver.done:
                                    await ws.send_json({'id': 8, 'type': 'carrot_ha/terminal/input', 'device_id': args.device,
                                                       'message': {'type': 'control', 'action': 'ctrl_c'}})
                                await ws.send_json({'id': 9, 'type': 'carrot_ha/terminal/release', 'device_id': args.device})
                                # Wait for release acknowledgement before closing the socket.
                                async with timeout(10):
                                    while True:
                                        if (await ws.receive_json()).get('id') == 9:
                                            break
                    partial.rename(final)
                    print('DOWNLOAD_OK', final, flush=True)
                    print('SHA256', receiver.digest.hexdigest(), flush=True)
            finally:
                if refresh:
                    async with session.post(args.url + '/auth/token', data={'action': 'revoke', 'token': refresh},
                                            allow_redirects=False) as response:
                        response.raise_for_status()
                    print('임시 HA 인증 폐기 완료', flush=True)
    finally:
        server.shutdown()
        server.server_close()
        if partial.exists():
            partial.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--device')
    parser.add_argument('--filename', required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.url = args.url.rstrip('/')
    parsed = urllib.parse.urlsplit(args.url)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.query or parsed.fragment or parsed.username:
        parser.error('Use the HTTPS base URL of your own HA')
    if not re.fullmatch('[0-9a-f]{64}', args.sha256):
        parser.error('Invalid SHA256')
    command(args.filename, 'CBvalidate')
    os.umask(0o077)
    asyncio.run(download(args))

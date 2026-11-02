"""Synthetic transport tests; no HA credentials or vehicle access."""
import base64
import hashlib
import importlib.util
import io
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest
import asyncio
from contextlib import redirect_stdout
from types import SimpleNamespace
from aiohttp import web, ClientSession

spec = importlib.util.spec_from_file_location('transfer', Path(__file__).parents[1] / 'scripts/download_comma_backup.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)


class TransferTests(unittest.TestCase):
    def test_verified_blocks_can_restart_at_last_complete_offset(self):
        data = bytes(range(256)) * 110
        name = 'carrot-20261102T021704563634Z.tar.gz'
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / name
            source.write_bytes(data)
            rebuilt = bytearray()
            while len(rebuilt) < len(data):
                marker = 'CB012345'
                args = shlex.split(transfer.block_command(name, marker, len(rebuilt)))
                args[2] = args[2].replace('/data/carrot-backups/' + name, str(source))
                output = subprocess.check_output(args).replace(b'\n', b'\r\n')
                receiver = transfer.BlockReceiver(marker, len(rebuilt))
                block = None
                for position in range(0, len(output), 113):
                    result = receiver.feed(output[position:position + 113])
                    if result is not None:
                        block = result
                self.assertEqual(block[0], len(data))
                rebuilt.extend(block[1])
        self.assertEqual(rebuilt, data)

    def test_corrupt_block_is_not_accepted(self):
        receiver = transfer.BlockReceiver('CB0123', 0)
        with self.assertRaises(RuntimeError):
            receiver.feed(('CB0123 BLOCK 0 1 YQ== ' + '0' * 64 + '\n').encode())
    def test_producer_to_receiver_fragmented_terminal_stream(self):
        data = bytes(range(256)) * 61
        filename = 'carrot-20261102T021704563634Z.tar.gz'
        marker = 'CBtest'
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / filename
            source.write_bytes(data)
            args = shlex.split(transfer.command(filename, marker))
            args[2] = args[2].replace('/data/carrot-backups/' + filename, str(source))
            output = subprocess.check_output(args).replace(b'\n', b'\r\n')
        stream = io.BytesIO()
        receiver = transfer.Receiver(stream, marker, hashlib.sha256(data).hexdigest())
        receiver.feed(b'command echo and shell prompt\r\n')
        for position in range(0, len(output), 127):
            receiver.feed(output[position:position + 127])
        self.assertTrue(receiver.done)
        self.assertEqual(stream.getvalue(), data)

    def test_hash_mismatch_never_completes(self):
        receiver = transfer.Receiver(io.BytesIO(), 'CBtest', '0' * 64)
        with self.assertRaises(RuntimeError):
            receiver.feed(b'CBtest BEGIN 1\nCBtest DATA 0 YQ==\nCBtest END\n')
        self.assertFalse(receiver.done)

    def test_missing_chunk_rejected(self):
        receiver = transfer.Receiver(io.BytesIO(), 'CBtest', '0' * 64)
        with self.assertRaises(RuntimeError):
            receiver.feed(b'CBtest BEGIN 1\nCBtest DATA 1 YQ==\n')

    def test_paths_and_shell_injection_rejected(self):
        for name in ['../../secret', 'carrot-1.tar.gz;id', 'carrot-$(id).tar.gz']:
            with self.assertRaises(ValueError):
                transfer.command(name, 'CBtest')


class ReconnectTests(unittest.IsolatedAsyncioTestCase):
    async def test_disconnect_preserves_blocks_and_reuses_login(self):
        data = bytes(range(256)) * (transfer.BLOCK_BYTES // 256 + 17)
        name = 'carrot-20261102T021704563634Z.tar.gz'
        connections, offsets = [], []
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / name
            source.write_bytes(data)
            async def handler(request):
                ws = web.WebSocketResponse()
                await ws.prepare(request)
                await ws.send_json({'type': 'auth_required'})
                auth = await ws.receive_json()
                connections.append(auth['access_token'])
                await ws.send_json({'type': 'auth_ok'})
                subscription = None
                async for message in ws:
                    value = message.json()
                    await ws.send_json({'id': value['id'], 'type': 'result', 'success': True})
                    kind = value['type'].rsplit('/', 1)[-1]
                    if kind == 'subscribe':
                        subscription = value['id']
                        await ws.send_json({'id': subscription, 'type': 'event', 'event': {
                            'type': 'status', 'ready': False, 'offroad': False, 'controller': False}})
                        await asyncio.sleep(0.01)
                        await ws.send_json({'id': subscription, 'type': 'event', 'event': {
                            'type': 'status', 'ready': True, 'offroad': True, 'controller': False}})
                    elif kind == 'input' and value['message']['type'] == 'raw':
                        args = shlex.split(value['message']['data'])
                        offset = int(args[2].split('f.seek(')[1].split(')')[0])
                        offsets.append(offset)
                        args[2] = args[2].replace('/data/carrot-backups/' + name, str(source))
                        output = subprocess.check_output(args)
                        await ws.send_json({'id': subscription, 'type': 'event', 'event': {
                            'type': 'terminal', 'message': {'type': 'pty_output',
                            'b64': base64.b64encode(output).decode()}}})
                        if len(connections) == 1:
                            await ws.close()
                            break
                return ws
            app = web.Application()
            app.router.add_get('/api/websocket', handler)
            runner = web.AppRunner(app)
            await runner.setup()
            site = web.TCPSite(runner, '127.0.0.1', 0)
            await site.start()
            port = site._server.sockets[0].getsockname()[1]
            args = SimpleNamespace(url=f'http://127.0.0.1:{port}', device='synthetic', filename=name,
                                   sha256=hashlib.sha256(data).hexdigest())
            partial = Path(directory) / 'download.partial'
            try:
                async with ClientSession() as session:
                    with redirect_stdout(io.StringIO()):
                        actual = await transfer.transfer_blocks(session, 'synthetic-token', args, partial)
                self.assertEqual(actual, args.sha256)
                self.assertEqual(partial.read_bytes(), data)
                self.assertEqual(connections, ['synthetic-token', 'synthetic-token'])
                self.assertEqual(offsets, [0, transfer.BLOCK_BYTES])
            finally:
                await runner.cleanup()


if __name__ == '__main__':
    unittest.main()

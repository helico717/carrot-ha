"""Terminal reverse-relay protocol tests using a real aiohttp WebSocket."""
import asyncio
from pathlib import Path
import sys
import types
import unittest

try:
    import aiohttp
    from aiohttp import web
    from aiohttp.test_utils import TestServer
except ImportError:
    raise unittest.SkipTest('Install aiohttp to run terminal relay tests')


ROOT = Path(__file__).parents[1]
package = types.ModuleType('terminal_transport_test')
package.__path__ = [str(ROOT / 'custom_components/carrot_ha')]
sys.modules[package.__name__] = package
from terminal_transport_test.terminal_relay import TerminalRelay


class TerminalRelayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now = 10.0
        self.relay = TerminalRelay('t' * 64, clock=lambda: self.now)
        await self.relay.start()
        app = web.Application()
        app.router.add_get('/terminal', self.relay.device)
        self.server = TestServer(app)
        await self.server.start_server()
        self.client = aiohttp.ClientSession()

    async def asyncTearDown(self):
        await self.relay.close()
        await self.client.close()
        await self.server.close()

    async def device(self):
        ws = await self.client.ws_connect(
            self.server.make_url('/terminal'),
            headers={'Authorization': 'Bearer ' + 't' * 64},
        )
        self.assertEqual((await ws.receive_json())['type'], 'hello')
        await ws.send_json({'type': 'status', 'protocol': 1, 'offroad': True, 'local_ready': True})
        for _ in range(100):
            if self.relay.ready:
                break
            await asyncio.sleep(.01)
        self.assertTrue(self.relay.ready)
        return ws

    async def test_device_authentication_and_duplicate_rejected(self):
        with self.assertRaises(aiohttp.WSServerHandshakeError) as error:
            await self.client.ws_connect(self.server.make_url('/terminal'))
        self.assertEqual(error.exception.status, 401)
        ws = await self.device()
        with self.assertRaises(aiohttp.WSServerHandshakeError) as error:
            await self.client.ws_connect(
                self.server.make_url('/terminal'),
                headers={'Authorization': 'Bearer ' + 't' * 64},
            )
        self.assertEqual(error.exception.status, 409)
        await ws.close()

    async def test_single_controller_and_terminal_output(self):
        ws = await self.device()
        events = []
        self.relay.subscribe('admin-one', events.append)
        result = await self.relay.acquire('admin-one')
        start = await ws.receive_json(timeout=2)
        self.assertEqual(start['type'], 'start')
        self.assertEqual(start['session_id'], result['session_id'])
        with self.assertRaises(RuntimeError):
            await self.relay.acquire('admin-two')
        await ws.send_json({'type': 'started', 'session_id': start['session_id']})
        await ws.send_json({
            'type': 'terminal',
            'session_id': start['session_id'],
            'message': {'type': 'pty_output', 'b64': 'b2s='},
        })
        for _ in range(100):
            if any(event.get('type') == 'terminal' for event in events):
                break
            await asyncio.sleep(.01)
        self.assertTrue(any(event.get('message', {}).get('b64') == 'b2s=' for event in events))
        await self.relay.input('admin-one', {'type': 'raw', 'data': 'uptime\r'})
        command = await ws.receive_json(timeout=2)
        self.assertEqual(command['message']['data'], 'uptime\r')
        await ws.close()

    async def test_onroad_transition_revokes_session(self):
        ws = await self.device()
        await self.relay.acquire('admin')
        start = await ws.receive_json(timeout=2)
        await ws.send_json({'type': 'status', 'protocol': 1, 'offroad': False, 'local_ready': True})
        stop = await ws.receive_json(timeout=2)
        self.assertEqual(stop['type'], 'stop')
        self.assertEqual(stop['session_id'], start['session_id'])
        self.assertIsNone(self.relay.session_id)
        self.assertIsNone(self.relay.controller)
        await ws.close()

    async def test_input_is_bounded_and_allowlisted(self):
        ws = await self.device()
        await self.relay.acquire('admin')
        await ws.receive_json(timeout=2)
        with self.assertRaises(ValueError):
            await self.relay.input('admin', {'type': 'raw', 'data': 'x' * 5000})
        with self.assertRaises(ValueError):
            await self.relay.input('admin', {'type': 'control', 'action': 'reboot'})
        await ws.close()


if __name__ == '__main__':
    unittest.main()

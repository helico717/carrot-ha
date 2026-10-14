"""Actual WLV1 device/browser sockets, decoding and parked-camera interlocks."""
import asyncio
from fractions import Fraction
from pathlib import Path
import sys
import types
import unittest
import uuid
import aiohttp
from aiohttp import web
from aiohttp.test_utils import TestServer
import av

ROOT = Path(__file__).parents[1]
package = types.ModuleType('camera_transport_test')
package.__path__ = [str(ROOT / 'custom_components/carrot_ha')]
sys.modules[package.__name__] = package
from camera_transport_test.camera_relay import CameraRelay
from camera_transport_test.camera_session import HEADER, MAGIC_WLV1


def encoded_frame():
    encoder = av.CodecContext.create('libx264', 'w')
    encoder.width, encoder.height, encoder.pix_fmt = 320, 180, 'yuv420p'
    encoder.time_base, encoder.framerate = Fraction(1, 20), Fraction(20, 1)
    encoder.options = {'preset': 'ultrafast', 'tune': 'zerolatency'}
    frame = av.VideoFrame(320, 180, 'yuv420p')
    for plane in frame.planes:
        plane.update(bytes([80]) * plane.buffer_size)
    frame.pts = 0
    payload = b''.join(bytes(packet) for packet in encoder.encode(frame) + encoder.encode(None))
    return HEADER.pack(MAGIC_WLV1, 1, 1, b'\x00' * 6, 1000, len(payload)) + payload


class RelayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now = 0
        self.sockets = []
        self.relay = CameraRelay('a' * 64, clock=lambda: self.now)
        await self.relay.start()
        app = web.Application()
        app.router.add_get('/camera', self.relay.device)
        app.router.add_get('/live', self.relay.live_ws)
        self.server = TestServer(app)
        await self.server.start_server()
        self.client = aiohttp.ClientSession()

    async def asyncTearDown(self):
        for socket in self.sockets:
            await socket.close()
        await self.relay.close()
        await self.client.close()
        await self.server.close()

    async def device(self):
        ws = await self.client.ws_connect(self.server.make_url('/camera'),
                                         headers={'Authorization': 'Bearer ' + 'a' * 64})
        self.sockets.append(ws)
        self.assertEqual((await ws.receive_json(timeout=2))['protocol'], 2)
        await ws.send_json({'type': 'status', 'protocol': 1, 'offroad': True})
        for _ in range(100):
            if self.relay.ready:
                break
            await asyncio.sleep(.01)
        self.assertTrue(self.relay.ready)
        return ws

    async def viewer(self):
        socket = await self.client.ws_connect(self.server.make_url('/live'))
        self.sockets.append(socket)
        return socket

    async def test_authentication_and_exclusive_device_before_upgrade(self):
        with self.assertRaises(aiohttp.WSServerHandshakeError) as error:
            await self.client.ws_connect(self.server.make_url('/camera'))
        self.assertEqual(error.exception.status, 401)
        device = await self.device()
        with self.assertRaises(aiohttp.WSServerHandshakeError) as error:
            await self.client.ws_connect(self.server.make_url('/camera'),
                                         headers={'Authorization': 'Bearer ' + 'a' * 64})
        self.assertEqual(error.exception.status, 409)
        self.assertFalse(device.closed)

    async def test_idle_connection_does_not_start_capture(self):
        await self.device()
        self.assertIsNone(self.relay.session.session_id)
        self.assertFalse(self.relay.session.readers)

    async def test_real_wlv1_transport_is_lossless_and_h264_decodes(self):
        device = await self.device()
        viewer = await self.viewer()
        command = await device.receive_json(timeout=2)
        self.assertEqual(command['type'], 'start')
        self.assertEqual(command['protocol'], 2)
        wire = encoded_frame()
        await device.send_bytes(wire)
        message = await viewer.receive(timeout=2)
        self.assertEqual(message.type, aiohttp.WSMsgType.BINARY)
        self.assertEqual(message.data, wire)
        decoder = av.CodecContext.create('h264', 'r')
        frames = []
        for packet in decoder.parse(message.data[HEADER.size:]) + decoder.parse(b''):
            frames.extend(decoder.decode(packet))
        frames.extend(decoder.decode(None))
        self.assertEqual(len(frames), 1)
        self.assertEqual((frames[0].width, frames[0].height), (320, 180))

    async def test_onroad_stops_capture_and_rejects_new_viewers(self):
        device = await self.device()
        viewer = await self.viewer()
        await device.receive_json(timeout=2)
        await device.send_json({'type': 'status', 'protocol': 1, 'offroad': False})
        while (command := await device.receive_json(timeout=2))['type'] != 'stop':
            pass
        self.assertEqual(command['reason'], 'device_not_offroad')
        with self.assertRaises(TimeoutError):
            await viewer.receive(timeout=.05)
        with self.assertRaises(aiohttp.WSServerHandshakeError) as error:
            await self.viewer()
        self.assertEqual(error.exception.status, 503)
        self.assertFalse(self.relay.ready)
        self.assertFalse(self.relay.session.readers)

    async def test_last_viewer_closing_stops_capture(self):
        device = await self.device()
        viewer = await self.viewer()
        await device.receive_json(timeout=2)
        await viewer.close()
        while (command := await device.receive_json(timeout=2))['type'] != 'stop':
            pass
        self.assertEqual(command['reason'], 'viewer_closed')
        self.assertIsNone(self.relay.session.session_id)

    async def test_bad_frame_is_ignored_and_next_good_frame_survives(self):
        device = await self.device()
        viewer = await self.viewer()
        await device.receive_json(timeout=2)
        await device.send_bytes(b'bad')
        wire = encoded_frame()
        await device.send_bytes(wire)
        self.assertEqual((await viewer.receive(timeout=2)).data, wire)
        self.assertFalse(device.closed)

    async def test_late_ended_does_not_close_current_session(self):
        device = await self.device()
        viewer = await self.viewer()
        command = await device.receive_json(timeout=2)
        await device.send_json({'type': 'ended', 'session_id': str(uuid.uuid4())})
        wire = encoded_frame()
        await device.send_bytes(wire)
        self.assertEqual((await viewer.receive(timeout=2)).data, wire)
        self.assertEqual(self.relay.session.session_id, command['session_id'])

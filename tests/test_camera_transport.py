"""Real aiohttp socket and PyAV remux tests; run with camera test dependencies."""
import asyncio
import importlib.util
import io
from pathlib import Path
import sys
import types
import unittest
import uuid
import tempfile
from fractions import Fraction

try:
    import aiohttp
    from aiohttp import web
    from aiohttp.test_utils import TestServer
    import av
except ImportError:
    raise unittest.SkipTest('Install aiohttp and av in the isolated camera test environment')

ROOT = Path(__file__).parents[1]
package = types.ModuleType('camera_transport_test')
package.__path__ = [str(ROOT / 'custom_components/carrot_ha')]
sys.modules[package.__name__] = package
from camera_transport_test.camera_relay import CameraRelay
from camera_transport_test.camera_session import encode_media

spec = importlib.util.spec_from_file_location('camera_media_test', ROOT / 'camera_agent/media.py')
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def encoded_frames():
    codec = av.CodecContext.create('libx264', 'w')
    codec.width, codec.height, codec.pix_fmt = 320, 180, 'yuv420p'
    codec.time_base = Fraction(1, 20)
    codec.framerate = Fraction(20, 1)
    codec.options = {'preset': 'ultrafast', 'tune': 'zerolatency',
                     'x264-params': 'keyint=10:scenecut=0:repeat-headers=1'}
    for index in range(30):
        frame = av.VideoFrame(320, 180, 'yuv420p')
        for plane in frame.planes:
            plane.update(bytes([80 + index]) * plane.buffer_size)
        frame.pts = index
        for packet in codec.encode(frame):
            data = bytes(packet)
            # Entire keyframe is a valid Annex-B bootstrap sample.
            yield data if packet.is_keyframe else b'', b'' if packet.is_keyframe else data, index * 50_000_000


class MuxTests(unittest.TestCase):
    def test_transport_stream_remuxes_to_fragmented_mp4_hls(self):
        mux = media.TransportMux()
        payload = b''.join(mux.push(*frame) for frame in encoded_frames())
        mux.close()
        payload += mux.buffer.take()
        with tempfile.TemporaryDirectory() as directory:
            playlist = Path(directory) / 'index.m3u8'
            with av.open(io.BytesIO(payload), format='mpegts') as source:
                with av.open(playlist.as_posix(), 'w', format='hls', options={
                    'hls_segment_type': 'fmp4', 'hls_time': '1', 'hls_list_size': '0',
                }) as output:
                    video = output.add_stream_from_template(source.streams.video[0])
                    for packet in source.demux(video=0):
                        if packet.dts is not None:
                            packet.stream = video
                            output.mux(packet)
            self.assertIn('#EXT-X-MAP', playlist.read_text())
            with av.open(playlist.as_posix()) as hls:
                self.assertEqual(len(list(hls.decode(video=0))), 30)

    def test_remuxed_ts_decodes_and_preserves_timing(self):
        mux = media.TransportMux()
        chunks = [mux.push(*frame) for frame in encoded_frames()]
        mux.close()
        chunks.append(mux.buffer.take())
        payload = b''.join(chunks)
        self.assertEqual(len(payload) % 188, 0)
        with av.open(io.BytesIO(payload), format='mpegts') as source:
            frames = list(source.decode(video=0))
        self.assertEqual(len(frames), 30)
        self.assertEqual((frames[0].width, frames[0].height), (320, 180))
        self.assertAlmostEqual(float(frames[-1].pts * frames[-1].time_base - frames[0].pts * frames[0].time_base), 1.45, places=2)

    def test_waits_for_header_and_rejects_backwards_time(self):
        mux = media.TransportMux()
        self.assertEqual(mux.push(b'', b'not-a-keyframe', 1), b'')
        first = next(encoded_frames())
        mux.push(*first)
        with self.assertRaises(ValueError):
            mux.push(*first)
        mux.close()

    def test_reader_joining_mid_gop_can_decode_at_next_keyframe(self):
        mux = media.TransportMux()
        chunks = [mux.push(*frame) for frame in encoded_frames()]
        mux.close()
        # A second HA camera can join while the shared capture is already
        # running. It does not receive the first stream header/GOP.
        payload = b''.join(chunks[15:]) + mux.buffer.take()
        decoded = []
        started = False
        with av.open(io.BytesIO(payload), format='mpegts') as source:
            for packet in source.demux(video=0):
                started = started or packet.is_keyframe
                if started:
                    decoded.extend(packet.decode())
        self.assertEqual(len(decoded), 10)


class RelayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now = 0
        self.relay = CameraRelay('a' * 64, clock=lambda: self.now)
        await self.relay.start()
        app = web.Application()
        app.router.add_get('/camera', self.relay.device)
        self.server = TestServer(app)
        await self.server.start_server()
        self.client = aiohttp.ClientSession()

    async def asyncTearDown(self):
        await self.relay.close()
        await self.client.close()
        await self.server.close()

    async def device(self, *, autoping=True):
        ws = await self.client.ws_connect(self.server.make_url('/camera'), headers={'Authorization': 'Bearer ' + 'a' * 64}, autoping=autoping)
        self.assertEqual((await ws.receive_json())['type'], 'hello')
        await ws.send_json({'type': 'status', 'protocol': 1, 'offroad': True})
        for _ in range(100):
            if self.relay.ready:
                break
            await asyncio.sleep(.01)
        self.assertTrue(self.relay.ready)
        return ws

    async def test_authentication_required_before_upgrade(self):
        with self.assertRaises(aiohttp.WSServerHandshakeError) as error:
            await self.client.ws_connect(self.server.make_url('/camera'))
        self.assertEqual(error.exception.status, 401)
        self.assertIsNone(self.relay.ws)

    async def test_idle_source_does_not_start_camera(self):
        ws = await self.device()
        self.relay.source('wide')
        self.assertIsNone(self.relay.session.session_id)
        await ws.close()

    async def test_real_ws_to_loopback_ts_and_decoder(self):
        ws = await self.device()
        url = self.relay.source('wide')
        request = asyncio.create_task(self.client.get(url))
        command = await ws.receive_json(timeout=2)
        self.assertEqual(command['type'], 'start')
        mux = media.TransportMux()
        payload = b''.join(mux.push(*frame) for frame in encoded_frames())
        mux.close()
        payload += mux.buffer.take()
        await ws.send_bytes(encode_media(command['session_id'], 'wide', payload))
        response = await request
        self.assertEqual(response.status, 200)
        received = await response.content.readexactly(len(payload))
        with av.open(io.BytesIO(received), format='mpegts') as source:
            self.assertEqual(len(list(source.decode(video=0))), 30)
        # Onroad transition terminates the feed and invalidates retry URLs.
        await ws.send_json({'type': 'status', 'protocol': 1, 'offroad': False})
        while (command := await ws.receive_json(timeout=2))['type'] != 'stop':
            pass
        self.assertEqual(command['reason'], 'device_not_offroad')
        await asyncio.wait_for(response.read(), 2)
        async with self.client.get(url) as retry:
            self.assertEqual(retry.status, 403)
        await ws.close()

    async def test_invalid_local_capability_and_head_never_start(self):
        ws = await self.device()
        async with self.client.get(self.relay.base_url + '/bad/wide.ts') as response:
            self.assertEqual(response.status, 403)
        async with self.client.head(self.relay.source('wide')) as response:
            self.assertEqual(response.status, 405)
        self.assertIsNone(self.relay.session.session_id)
        await ws.close()

    async def test_duplicate_connection_cannot_replace_device(self):
        ws = await self.device()
        with self.assertRaises(aiohttp.WSServerHandshakeError) as error:
            await self.client.ws_connect(self.server.make_url('/camera'), headers={'Authorization': 'Bearer ' + 'a' * 64})
        self.assertEqual(error.exception.status, 409)
        self.assertFalse(ws.closed)
        await ws.close()

    async def test_disconnect_before_first_frame_releases_reader(self):
        ws = await self.device()
        request = asyncio.create_task(self.client.get(self.relay.source('wide')))
        self.assertEqual((await ws.receive_json(timeout=2))['type'], 'start')
        await ws.close()
        response = await asyncio.wait_for(request, 2)
        self.assertEqual(response.status, 503)
        response.release()
        self.assertFalse(self.relay.session.readers)
        self.assertIsNone(self.relay.session.session_id)

    async def test_same_source_recovers_after_capture_failure_with_bounded_attempts(self):
        ws = await self.device()
        url = self.relay.source('wide')
        sessions = set()
        for attempt in range(3):
            request = asyncio.create_task(self.client.get(url))
            command = await ws.receive_json(timeout=2)
            self.assertEqual(command['type'], 'start')
            sessions.add(command['session_id'])
            await ws.send_json({'type': 'ended', 'session_id': command['session_id']})
            response = await asyncio.wait_for(request, 2)
            self.assertEqual(response.status, 503)
            response.release()
            self.assertEqual((await ws.receive_json(timeout=2))['type'], 'stop')
        self.assertEqual(len(sessions), 3)
        async with self.client.get(url) as exhausted:
            self.assertEqual(exhausted.status, 403)
        self.assertIsNone(self.relay.session.session_id)
        await ws.close()

    async def test_failed_start_then_same_url_retries_and_decodes_real_video(self):
        ws = await self.device()
        url = self.relay.source('wide')
        request = asyncio.create_task(self.client.get(url))
        failed = await ws.receive_json(timeout=2)
        await ws.send_json({'type': 'ended', 'session_id': failed['session_id']})
        response = await asyncio.wait_for(request, 2)
        self.assertEqual(response.status, 503)
        response.release()
        self.assertEqual((await ws.receive_json(timeout=2))['type'], 'stop')
        request = asyncio.create_task(self.client.get(url))
        retry = await ws.receive_json(timeout=2)
        self.assertNotEqual(retry['session_id'], failed['session_id'])
        mux = media.TransportMux()
        payload = b''.join(mux.push(*frame) for frame in encoded_frames())
        mux.close()
        payload += mux.buffer.take()
        await ws.send_bytes(encode_media(retry['session_id'], 'wide', payload))
        response = await asyncio.wait_for(request, 2)
        self.assertEqual(response.status, 200)
        received = await response.content.readexactly(len(payload))
        with av.open(io.BytesIO(received), format='mpegts') as source:
            self.assertEqual(len(list(source.decode(video=0))), 30)
        await self.relay.stop_camera('wide')
        await response.read()
        response.release()
        await ws.close()

    async def test_disconnect_retry_keeps_original_deadline_and_onroad_revokes(self):
        ws = await self.device()
        url = self.relay.source('wide')
        request = asyncio.create_task(self.client.get(url))
        self.assertEqual((await ws.receive_json(timeout=2))['type'], 'start')
        await ws.close()
        response = await asyncio.wait_for(request, 2)
        self.assertEqual(response.status, 503)
        response.release()
        self.now = 290
        ws = await self.device()
        request = asyncio.create_task(self.client.get(url))
        self.assertEqual((await ws.receive_json(timeout=2))['type'], 'start')
        self.assertEqual(self.relay.session.deadline, 300)
        await ws.send_json({'type': 'status', 'protocol': 1, 'offroad': False})
        self.assertEqual((await ws.receive_json(timeout=2))['reason'], 'device_not_offroad')
        response = await asyncio.wait_for(request, 2)
        response.release()
        async with self.client.get(url) as revoked:
            self.assertEqual(revoked.status, 403)
        await ws.close()

    async def test_turn_off_revokes_pending_retry(self):
        ws = await self.device()
        url = self.relay.source('wide')
        request = asyncio.create_task(self.client.get(url))
        command = await ws.receive_json(timeout=2)
        await ws.send_json({'type': 'ended', 'session_id': command['session_id']})
        response = await asyncio.wait_for(request, 2)
        response.release()
        self.assertEqual((await ws.receive_json(timeout=2))['type'], 'stop')
        await self.relay.stop_camera('wide')
        async with self.client.get(url) as revoked:
            self.assertEqual(revoked.status, 403)
        await ws.close()

    async def test_malformed_binary_closes_device_without_crashing_relay(self):
        ws = await self.device()
        await ws.send_bytes(b'bad')
        await asyncio.wait_for(ws.receive(), 2)
        await ws.close()
        for _ in range(100):
            if self.relay.ws is None:
                break
            await asyncio.sleep(.01)
        self.assertIsNone(self.relay.ws)

    async def test_late_ended_from_previous_session_preserves_current_viewer(self):
        ws = await self.device(autoping=False)
        old_reader, _ = self.relay.session.subscribe('wide')
        old_session = self.relay.session.session_id
        self.relay.session.unsubscribe(old_reader)
        reader, _ = self.relay.session.subscribe('driver')
        current_session = self.relay.session.session_id
        await ws.send_json({'type': 'ended', 'session_id': old_session})
        # Ping/pong is a wire-level barrier after the stale message.
        await ws.ping(b'barrier')
        reply = await ws.receive(timeout=2)
        self.assertEqual(reply.type, aiohttp.WSMsgType.PONG)
        self.assertEqual(self.relay.session.session_id, current_session)
        self.assertFalse(reader.closed)
        await ws.close()


if __name__ == '__main__':
    unittest.main()

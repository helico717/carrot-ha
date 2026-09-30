import asyncio
import importlib.util
from pathlib import Path
import struct
import sys
import unittest
import uuid

spec = importlib.util.spec_from_file_location(
    "camera_session_test_module", Path(__file__).parents[1] / "custom_components/carrot_ha/camera_session.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

HEADER = module.HEADER
MAGIC = module.MAGIC_WLV1


def make_wlv1_frame(frame_type, payload, is_key=False, timestamp_us=1000):
    flags = module.FLAG_KEY if is_key else 0
    header = HEADER.pack(MAGIC, frame_type, flags, b"\x00" * 6, int(timestamp_us), len(payload))
    return header + payload


FRAME_WIDE_KEY = make_wlv1_frame(module.FRAME_WIDE, b"\x00\x00\x00\x01\x65key", is_key=True)
FRAME_WIDE_DELTA = make_wlv1_frame(module.FRAME_WIDE, b"\x00\x00\x00\x01\x41delta", is_key=False)
FRAME_DRIVER_KEY = make_wlv1_frame(module.FRAME_DRIVER, b"\x00\x00\x00\x01\x65driver", is_key=True)


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.now = 0
        self.session = module.CameraSession(lambda: self.now)
        self.generation = self.session.connect()
        self.session.device_status(self.generation, offroad=True)

    def tearDown(self):
        self.loop.close()
        asyncio.set_event_loop(None)

    def test_idle_connection_produces_no_start_or_renew(self):
        self.assertEqual(self.session.tick(), [])
        self.assertIsNone(self.session.session_id)

    def test_two_cameras_share_one_start_and_last_reader_stops(self):
        wide, commands = self.session.subscribe("wide")
        driver, second = self.session.subscribe("driver")
        self.assertEqual(commands[0]["type"], "start")
        self.assertEqual(commands[0]["protocol"], 2)
        self.assertEqual(second, [])
        self.assertEqual(self.session.unsubscribe(wide), [])
        self.assertEqual(self.session.unsubscribe(driver)[0]["type"], "stop")

    def test_all_camera_reader_receives_both_streams(self):
        all_reader, commands = self.session.subscribe("all")
        self.assertEqual(commands[0]["type"], "start")
        self.session.accept_media(self.generation, FRAME_WIDE_KEY)
        self.session.accept_media(self.generation, FRAME_DRIVER_KEY)
        self.assertEqual(all_reader.queue.get_nowait(), FRAME_WIDE_KEY)
        self.assertEqual(all_reader.queue.get_nowait(), FRAME_DRIVER_KEY)
        self.assertEqual(self.session.unsubscribe(all_reader)[0]["type"], "stop")

    def test_media_routing_to_specific_camera_reader(self):
        wide, _ = self.session.subscribe("wide")
        driver, _ = self.session.subscribe("driver")
        self.session.accept_media(self.generation, FRAME_WIDE_KEY)
        self.assertEqual(wide.queue.get_nowait(), FRAME_WIDE_KEY)
        self.assertTrue(driver.queue.empty())

    def test_missing_heartbeat_stops_and_closes_readers(self):
        reader, _ = self.session.subscribe("wide")
        self.now = 12
        self.assertEqual(self.session.tick()[0]["type"], "stop")
        self.assertTrue(reader.closed)
        self.assertIsNone(reader.queue.get_nowait())
        self.assertIsNone(self.session.generation)

    def test_absolute_session_limit_not_extended_by_heartbeat(self):
        reader, _ = self.session.subscribe("wide")
        self.now = 300
        self.session.device_status(self.generation, offroad=True)
        self.assertEqual(self.session.tick()[0]["reason"], "session_expired")
        self.assertTrue(reader.closed)

    def test_onroad_stops_session(self):
        for status in (False, None, 1, "true"):
            with self.subTest(status=status):
                self.session.device_status(self.generation, offroad=True)
                reader, _ = self.session.subscribe("wide")
                self.assertEqual(self.session.device_status(self.generation, offroad=status)[0]["type"], "stop")
                self.assertTrue(reader.closed)

    def test_keyframe_congestion_recovery_drops_delta_and_recovers_at_key(self):
        reader, _ = self.session.subscribe("wide")
        # Fill the queue to capacity
        for _ in range(module.QUEUE_CHUNKS):
            self.session.accept_media(self.generation, FRAME_WIDE_DELTA)
        self.assertEqual(reader.queue.qsize(), module.QUEUE_CHUNKS)
        # Next delta should be dropped and mark dropping_until_key
        self.session.accept_media(self.generation, FRAME_WIDE_DELTA)
        self.assertTrue(reader.dropping_until_key)
        # Another delta is still dropped
        self.session.accept_media(self.generation, FRAME_WIDE_DELTA)
        # A keyframe arrives: should clear the backlog and insert keyframe!
        self.session.accept_media(self.generation, FRAME_WIDE_KEY)
        self.assertFalse(reader.dropping_until_key)
        self.assertEqual(reader.queue.qsize(), 1)
        self.assertEqual(reader.queue.get_nowait(), FRAME_WIDE_KEY)

    def test_old_socket_cannot_disconnect_replacement(self):
        self.session.disconnect(self.generation)
        new_generation = self.session.connect()
        self.assertEqual(self.session.disconnect(self.generation), [])
        self.assertEqual(self.session.generation, new_generation)

    def test_duplicate_device_connection_rejected(self):
        with self.assertRaises(RuntimeError):
            self.session.connect()

    def test_viewer_limit(self):
        for _ in range(module.MAX_VIEWERS):
            self.session.subscribe("wide")
        with self.assertRaises(RuntimeError):
            self.session.subscribe("driver")


if __name__ == "__main__":
    unittest.main()

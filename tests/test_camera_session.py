import importlib.util
from pathlib import Path
import sys
import unittest
import uuid

spec = importlib.util.spec_from_file_location(
    "camera_session_test_module", Path(__file__).parents[1] / "custom_components/carrot_ha/camera_session.py")
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
TS = b"\x47" + bytes(187)


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.session = module.CameraSession(lambda: self.now)
        self.generation = self.session.connect()
        self.session.device_status(self.generation, offroad=True)

    def test_idle_connection_produces_no_start_or_renew(self):
        self.assertEqual(self.session.tick(), [])
        self.assertIsNone(self.session.session_id)

    def test_two_cameras_share_one_start_and_last_reader_stops(self):
        wide, commands = self.session.subscribe("wide")
        driver, second = self.session.subscribe("driver")
        self.assertEqual(commands[0]["type"], "start")
        self.assertEqual(second, [])
        self.assertEqual(self.session.unsubscribe(wide), [])
        self.assertEqual(self.session.unsubscribe(driver)[0]["type"], "stop")

    def test_media_routing_and_stale_session_rejection(self):
        wide, _ = self.session.subscribe("wide")
        driver, _ = self.session.subscribe("driver")
        stale = module.encode_media(str(uuid.uuid4()), "wide", TS)
        self.session.accept_media(self.generation, stale)
        self.assertTrue(wide.queue.empty())
        self.session.accept_media(self.generation, module.encode_media(self.session.session_id, "wide", TS))
        self.assertEqual(wide.queue.get_nowait(), TS)
        self.assertTrue(driver.queue.empty())

    def test_missing_heartbeat_stops_and_closes_readers(self):
        reader, _ = self.session.subscribe("wide")
        self.now = 12
        self.assertEqual(self.session.tick()[0]["type"], "stop")
        self.assertTrue(reader.closed)
        self.assertIsNone(reader.queue.get_nowait())
        self.assertIsNone(self.session.generation)

    def test_media_cannot_keep_expired_status_alive(self):
        reader, _ = self.session.subscribe("wide")
        packet = module.encode_media(self.session.session_id, "wide", TS)
        self.now = 12
        self.assertEqual(self.session.accept_media(self.generation, packet)[0]["type"], "stop")
        self.assertTrue(reader.closed)
        self.assertIsNone(reader.queue.get_nowait())

    def test_absolute_session_limit_not_extended_by_heartbeat(self):
        reader, _ = self.session.subscribe("wide")
        self.now = 300
        self.session.device_status(self.generation, offroad=True)
        self.assertEqual(self.session.tick()[0]["reason"], "session_expired")
        self.assertTrue(reader.closed)

    def test_retry_deadline_shortens_capture_and_cannot_be_extended(self):
        reader, _ = self.session.subscribe('wide', deadline=10)
        self.session.subscribe('driver', deadline=100)
        self.now = 10
        self.session.device_status(self.generation, offroad=True)
        self.assertEqual(self.session.tick()[0]['reason'], 'session_expired')
        self.assertTrue(reader.closed)
        with self.assertRaises(RuntimeError):
            self.session.subscribe('wide', deadline=10)

    def test_onroad_or_unknown_status_stops(self):
        for status in (False, None, 1, "true"):
            with self.subTest(status=status):
                self.session.device_status(self.generation, offroad=True)
                reader, _ = self.session.subscribe("wide")
                self.assertEqual(self.session.device_status(self.generation, offroad=status)[0]["type"], "stop")
                self.assertTrue(reader.closed)

    def test_slow_reader_does_not_break_other_camera(self):
        wide, _ = self.session.subscribe("wide")
        driver, _ = self.session.subscribe("driver")
        packet = module.encode_media(self.session.session_id, "wide", TS)
        for _ in range(module.QUEUE_CHUNKS + 1):
            self.session.accept_media(self.generation, packet)
        self.assertEqual(wide.reason, "slow_consumer")
        self.assertFalse(driver.closed)
        self.assertEqual(len(self.session.readers), 1)

    def test_old_socket_cannot_disconnect_replacement(self):
        self.session.disconnect(self.generation)
        new_generation = self.session.connect()
        self.assertEqual(self.session.disconnect(self.generation), [])
        self.assertEqual(self.session.generation, new_generation)

    def test_duplicate_device_connection_rejected(self):
        with self.assertRaises(RuntimeError):
            self.session.connect()

    def test_unready_and_stale_status_reject_new_viewer(self):
        self.now = 12
        with self.assertRaises(RuntimeError):
            self.session.subscribe("wide")

    def test_viewer_limit(self):
        for _ in range(module.MAX_VIEWERS):
            self.session.subscribe("wide")
        with self.assertRaises(RuntimeError):
            self.session.subscribe("driver")

    def test_packet_validation(self):
        session_id = str(uuid.uuid4())
        self.assertEqual(module.decode_media(module.encode_media(session_id, "driver", TS)),
                         (session_id, "driver", TS))
        self.assertEqual(module.decode_media(module.encode_media(session_id, "road", TS)),
                         (session_id, "road", TS))
        for payload in (b"", bytes(188), TS[:-1], TS * 513):
            with self.subTest(size=len(payload)), self.assertRaises(ValueError):
                module.encode_media(session_id, "wide", payload)
        packet = module.encode_media(session_id, "wide", TS)
        for corrupt in (b"", packet[:10], b"bad!" + packet[4:], packet[:20] + b"\x99" + packet[21:]):
            with self.assertRaises(ValueError):
                module.decode_media(corrupt)


if __name__ == "__main__":
    unittest.main()

import importlib.util
import io
import logging
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from aiohttp.test_utils import TestClient, TestServer

sys.path.insert(0, str(Path('addons/carrot_receiver').resolve()))
import diagnostics
import receiver


class DiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    async def test_sensitive_inputs_and_exception_messages_are_never_logged(self):
        with tempfile.TemporaryDirectory() as directory:
            logger = diagnostics.configure(directory, 'DEBUG')
            capture = io.StringIO()
            handler = logging.StreamHandler(capture)
            handler.addFilter(diagnostics.ContextFilter())
            handler.setFormatter(logger.handlers[0].formatter)
            logger.addHandler(handler)
            store = receiver.Store(Path(directory) / 'receiver.sqlite3')
            device, token = 'PRIVATE-DEVICE-ABC', 'PRIVATE-TOKEN-' + 'a' * 40
            client = TestClient(TestServer(receiver.create_app({'devices': [
                {'device_id': device, 'upload_token': token, 'view_token': 'v' * 32}]}, store)))
            await client.start_server()
            try:
                with patch.object(store, 'receive', side_effect=RuntimeError('secret-password gps=37.12345 ' + token)):
                    response = await client.post('/api/telemetry', json={'deviceId': device,
                        'updatedAt': '2026-10-14T10:00:00Z', 'gps': {'latitude': 37.12345}},
                        headers={'Authorization': 'Bearer ' + token})
                    self.assertEqual(response.status, 503)
                await client.get('/unknown/' + token + '?password=secret-password')
            finally:
                await client.close()
            output = capture.getvalue()
            for private in (device, token, 'secret-password', '37.12345', 'Authorization'):
                self.assertNotIn(private, output)
            self.assertIn('error_type=RuntimeError', output)
            self.assertIn('vehicle=vehicle-1', output)
            self.assertIn('storage_error_frames=', output)
            self.assertIn('endpoint=unknown', output)
            logger.removeHandler(handler)
            for h in logger.handlers[:]:
                logger.removeHandler(h)
                h.close()

    async def test_repeated_errors_are_bounded_and_summaries_keep_counts(self):
        capture = io.StringIO()
        logger = logging.Logger('diagnostic-test', logging.INFO)
        logger.addHandler(logging.StreamHandler(capture))
        now = [0]
        collector = diagnostics.Diagnostics(logger, lambda: now[0])
        for _ in range(100):
            collector.record('POST', '/api/telemetry', 503, 5, 'receiver_capacity')
        self.assertEqual(capture.getvalue().count('http_failed'), 1)
        now[0] = 31
        collector.record('POST', '/api/telemetry', 503, 6, 'receiver_capacity')
        self.assertIn('repeated_suppressed=99', capture.getvalue())
        collector.summary()
        self.assertIn('requests=101', capture.getvalue())
        self.assertEqual(len(collector.counts), 0)

    async def test_file_rotation_has_fixed_count(self):
        with tempfile.TemporaryDirectory() as directory:
            logger = diagnostics.configure(directory)
            file = logger.handlers[1]
            file.maxBytes = 200
            for i in range(30):
                logger.info('test_event ordinal=%d', i)
            for h in logger.handlers[:]:
                logger.removeHandler(h)
                h.close()
            files = list((Path(directory) / 'logs').glob('receiver.log*'))
            self.assertLessEqual(len(files), 4)
            self.assertIn('ordinal=29', (Path(directory) / 'logs/receiver.log').read_text())

"""Long cloud routes stay complete without duplicate diagnostic geometry."""
import importlib.util
import json
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'custom_components/carrot_ha'
package = types.ModuleType('trip_payload_test')
package.__path__ = [str(ROOT)]
sys.modules[package.__name__] = package

def load(name):
    spec = importlib.util.spec_from_file_location(package.__name__ + '.' + name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

feed = load('cloud_feed')
protocol = load('protocol')
connectivity = load('connectivity')

class TripPayloadTests(unittest.TestCase):
    def test_large_route_preserved_once_and_source_not_mutated(self):
        route = [{'lat': 37.123456, 'lng': 127.123456, 'time': i} for i in range(2800)]
        for key, value in [('route', route), ('route_json', json.dumps(route))]:
            trip = {'id': 'long', 'device_id': 'car', 'ended_at': '2026-10-06T12:53:14Z',
                    'duration_s': 3678, 'distance_m': 74000, 'sync_sequence': 248, key: value}
            before = json.dumps(trip)
            event = feed.parse_feed({'trips': [trip]}, 'car')[0]
            self.assertEqual(event['data']['route'], route)
            self.assertEqual(event['data']['cloud_raw_trip']['sync_sequence'], 248)
            self.assertNotIn('route', event['data']['cloud_raw_trip'])
            self.assertNotIn('route_json', event['data']['cloud_raw_trip'])
            self.assertEqual(json.dumps(trip), before)
            self.assertLessEqual(len(protocol.validate(event).encode()), protocol.MAX_BYTES)

    def test_real_oversize_and_other_vehicle_still_rejected(self):
        trip = {'id': 'large', 'ended_at': '2026-10-06T12:53:14Z', 'route': ['x' * 300000]}
        with self.assertRaisesRegex(ValueError, 'Payload too large'):
            feed.parse_feed({'trips': [trip]}, 'car')
        with self.assertRaisesRegex(ValueError, 'different vehicle'):
            feed.parse_feed({'trips': [{**trip, 'device_id': 'other'}]}, 'car')

class ConnectivityTests(unittest.TestCase):
    def test_archive_error_does_not_mask_fresh_state(self):
        now = datetime.now(timezone.utc)
        runtime = {'latest': {'observed_at': now.isoformat()}, 'cloud_status': 'error'}
        self.assertIsNone(connectivity.connection_status(runtime, now)['online'])
        for prefix in ('state', 'live'):
            runtime.update({prefix + '_status': 'ok', prefix + '_checked_at': now.isoformat()})
            self.assertTrue(connectivity.connection_status(runtime, now)['online'])
            runtime[prefix + '_checked_at'] = (now - timedelta(seconds=181)).isoformat()
            self.assertIsNone(connectivity.connection_status(runtime, now)['online'])
            runtime.pop(prefix + '_status')

    def test_successful_check_does_not_freshen_old_measurement(self):
        now = datetime.now(timezone.utc)
        runtime = {'latest': {'observed_at': (now - timedelta(seconds=301)).isoformat()},
                   'cloud_status': 'error', 'state_status': 'ok', 'state_checked_at': now.isoformat()}
        self.assertFalse(connectivity.connection_status(runtime, now)['online'])
        runtime['latest']['observed_at'] = 'invalid'
        self.assertIsNone(connectivity.connection_status(runtime, now)['online'])

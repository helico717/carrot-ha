import unittest
import tempfile
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Import Archive
import sys
import types
pkg_cc = types.ModuleType('custom_components')
pkg_ch = types.ModuleType('custom_components.carrot_ha')
pkg_ch.__path__ = ['custom_components/carrot_ha']
sys.modules['custom_components'] = pkg_cc
sys.modules['custom_components.carrot_ha'] = pkg_ch

import importlib.util
spec_protocol = importlib.util.spec_from_file_location('custom_components.carrot_ha.protocol', 'custom_components/carrot_ha/protocol.py')
mod_protocol = importlib.util.module_from_spec(spec_protocol)
sys.modules['custom_components.carrot_ha.protocol'] = mod_protocol
spec_protocol.loader.exec_module(mod_protocol)

spec_storage = importlib.util.spec_from_file_location('custom_components.carrot_ha.storage', 'custom_components/carrot_ha/storage.py')
mod_storage = importlib.util.module_from_spec(spec_storage)
sys.modules['custom_components.carrot_ha.storage'] = mod_storage
spec_storage.loader.exec_module(mod_storage)

Archive = mod_storage.Archive

class TestStoragePurge(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_archive.sqlite3"
        self.archive = Archive(self.db_path)
        self.device = "test_car_1"
        self.now = datetime.now(timezone.utc)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _make_event(self, kind, event_id, days_ago, data=None):
        observed = self.now - timedelta(days=days_ago)
        return {
            'schema': 1,
            'device_id': self.device,
            'event_id': event_id,
            'kind': kind,
            'observed_at': observed.isoformat().replace('+00:00', 'Z'),
            'data': data or {}
        }

    def test_purge_state(self):
        # 5 days ago (should remain)
        self.archive.put(self._make_event('state', 'state_recent', 5, {'battery_wh': 50000}))
        # 10 days ago (should remain with state_days=14)
        self.archive.put(self._make_event('state', 'state_10d', 10, {'battery_wh': 49000}))
        # 20 days ago (should be purged)
        self.archive.put(self._make_event('state', 'state_20d', 20, {'battery_wh': 48000}))

        counts = self.archive.purge_expired(state_days=14, trip_days=90, charge_days=90)
        self.assertEqual(counts['purged_state'], 1)

        # Verify remaining
        states = self.archive.history(self.device, 'state', limit=10)
        remaining_ids = [s['event_id'] for s in states]
        self.assertIn('state_recent', remaining_ids)
        self.assertIn('state_10d', remaining_ids)
        self.assertNotIn('state_20d', remaining_ids)

    def test_purge_and_slim_trips(self):
        # 5 days ago trip with route (should be kept intact)
        trip_recent = {
            'started_at': (self.now - timedelta(days=5, minutes=30)).isoformat(),
            'ended_at': (self.now - timedelta(days=5)).isoformat(),
            'duration_s': 1800,
            'distance_m': 15000,
            'route': [{'latitude': 37.5, 'longitude': 127.0, 'speedMps': 10}]
        }
        self.archive.put(self._make_event('trip', 'trip_5d', 5, trip_recent))

        # 20 days ago trip with route (should be slimmed: route cleared, but distance/duration kept)
        trip_mid = {
            'started_at': (self.now - timedelta(days=20, minutes=40)).isoformat(),
            'ended_at': (self.now - timedelta(days=20)).isoformat(),
            'duration_s': 2400,
            'distance_m': 20000,
            'route': [{'latitude': 37.5, 'longitude': 127.0, 'speedMps': 15}]
        }
        self.archive.put(self._make_event('trip', 'trip_20d', 20, trip_mid))

        # 100 days ago trip (should be completely purged)
        trip_old = {
            'started_at': (self.now - timedelta(days=100, minutes=20)).isoformat(),
            'ended_at': (self.now - timedelta(days=100)).isoformat(),
            'duration_s': 1200,
            'distance_m': 8000,
            'route': [{'latitude': 37.5, 'longitude': 127.0}]
        }
        self.archive.put(self._make_event('trip', 'trip_100d', 100, trip_old))

        counts = self.archive.purge_expired(state_days=14, trip_days=90, charge_days=90, slim_trip_days=14)
        self.assertEqual(counts['purged_trip'], 1)
        self.assertEqual(counts['slimmed_trip'], 1)

        trips = self.archive.history(self.device, 'trip', limit=10)
        trips_by_id = {t['event_id']: t['data'] for t in trips}

        self.assertIn('trip_5d', trips_by_id)
        self.assertIn('trip_20d', trips_by_id)
        self.assertNotIn('trip_100d', trips_by_id)

        # trip_5d retains its route
        self.assertEqual(len(trips_by_id['trip_5d']['route']), 1)

        # trip_20d route is empty list [] to save storage
        self.assertEqual(trips_by_id['trip_20d']['route'], [])
        # but distance and duration are completely preserved for stats
        self.assertEqual(trips_by_id['trip_20d']['distance_m'], 20000)
        self.assertEqual(trips_by_id['trip_20d']['duration_s'], 2400)

    def test_vacuum(self):
        # Insert and delete large records
        for i in range(50):
            self.archive.put(self._make_event('state', f'st_{i}', 20, {'data': 'x' * 1000}))
        self.archive.purge_expired(state_days=14)
        # Vacuum should execute smoothly without errors
        self.archive.vacuum()

if __name__ == '__main__':
    unittest.main()

import unittest
import tempfile
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Import Archive using the same pattern as existing tests
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

class TestTripEnergy(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_archive.sqlite3"
        self.archive = Archive(self.db_path)
        self.device = "test_car_1"
        self.now = datetime.now(timezone.utc)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _make_state(self, event_id, time_offset_s, battery_wh):
        """Create a state event with battery_wh at (now + time_offset_s)."""
        observed = self.now + timedelta(seconds=time_offset_s)
        return {
            'schema': 1,
            'device_id': self.device,
            'event_id': event_id,
            'kind': 'state',
            'observed_at': observed.isoformat().replace('+00:00', 'Z'),
            'data': {
                'battery_wh': battery_wh,
                'field_measured_at': {
                    'battery_wh': observed.isoformat().replace('+00:00', 'Z')
                }
            }
        }

    def _make_trip(self, event_id, start_offset_s, end_offset_s, distance_m):
        """Create a trip event from (now + start_offset_s) to (now + end_offset_s)."""
        started = self.now + timedelta(seconds=start_offset_s)
        ended = self.now + timedelta(seconds=end_offset_s)
        duration = end_offset_s - start_offset_s
        return {
            'schema': 1,
            'device_id': self.device,
            'event_id': event_id,
            'kind': 'trip',
            'observed_at': ended.isoformat().replace('+00:00', 'Z'),
            'data': {
                'started_at': started.isoformat().replace('+00:00', 'Z'),
                'ended_at': ended.isoformat().replace('+00:00', 'Z'),
                'duration_s': duration,
                'distance_m': distance_m,
                'route': [
                    {'latitude': 37.5665, 'longitude': 126.978},
                    {'latitude': 37.5720, 'longitude': 126.985}
                ]
            }
        }

    def test_normal_enrichment(self):
        """Trip with state events at start and end should get correct efficiency."""
        # State at trip start: 50000 Wh
        self.archive.put(self._make_state('s1', 0, 50000))
        # State at trip end: 48000 Wh
        self.archive.put(self._make_state('s2', 900, 48000))
        # Trip: 0s to 900s, 10000m (10km)
        trip = self._make_trip('t1', 0, 900, 10000)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips, capacity_kwh=78.0)

        data = result[0]['data']
        self.assertEqual(data['start_battery_wh'], 50000.0)
        self.assertEqual(data['end_battery_wh'], 48000.0)
        self.assertAlmostEqual(data['start_soc_percent'], 64.1, places=1)
        self.assertAlmostEqual(data['end_soc_percent'], 61.5, places=1)
        self.assertEqual(data['energy_wh'], 2000.0)
        # efficiency = 10km / 2kWh = 5.0 km/kWh
        self.assertEqual(data['efficiency_km_kwh'], 5.0)
        # soc_used = 2000 / (78 * 1000) * 100 = 2.56%
        self.assertAlmostEqual(data['soc_used_percent'], 2.6, places=1)

    def test_no_state_events(self):
        """Trip without any state events should have no energy fields."""
        trip = self._make_trip('t1', 0, 900, 10000)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips)

        data = result[0]['data']
        self.assertNotIn('energy_wh', data)
        self.assertNotIn('efficiency_km_kwh', data)
        self.assertNotIn('soc_used_percent', data)

    def test_state_too_far(self):
        """State events more than 5 minutes from trip should not be used."""
        # State 10 minutes before trip start
        self.archive.put(self._make_state('s1', -600, 50000))
        # State 10 minutes after trip end
        self.archive.put(self._make_state('s2', 1500, 48000))
        trip = self._make_trip('t1', 0, 900, 10000)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips)

        data = result[0]['data']
        self.assertNotIn('energy_wh', data)

    def test_negative_energy(self):
        """If SOC increased during trip (unlikely), efficiency should not be set."""
        # Battery increased during trip (e.g. regen on downhill longer than drive)
        self.archive.put(self._make_state('s1', 0, 48000))
        self.archive.put(self._make_state('s2', 900, 50000))
        trip = self._make_trip('t1', 0, 900, 10000)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips)

        data = result[0]['data']
        self.assertEqual(data['energy_wh'], -2000.0)
        self.assertNotIn('efficiency_km_kwh', data)
        # SOC used should be negative
        self.assertAlmostEqual(data['soc_used_percent'], -3.1, places=1)

    def test_short_trip_small_energy(self):
        """Short trip with very small energy change should still calculate."""
        self.archive.put(self._make_state('s1', 0, 50000))
        self.archive.put(self._make_state('s2', 120, 49900))  # 100 Wh
        trip = self._make_trip('t1', 0, 120, 500)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips)

        data = result[0]['data']
        self.assertEqual(data['energy_wh'], 100.0)
        # 0.5km / 0.1kWh = 5.0 km/kWh
        self.assertEqual(data['efficiency_km_kwh'], 5.0)

    def test_multiple_trips_batch(self):
        """Multiple trips should all be enriched in a single call."""
        # States covering two trips
        self.archive.put(self._make_state('s1', 0, 60000))
        self.archive.put(self._make_state('s2', 600, 58000))
        self.archive.put(self._make_state('s3', 1200, 58000))
        self.archive.put(self._make_state('s4', 1800, 55000))

        trip1 = self._make_trip('t1', 0, 600, 8000)
        trip2 = self._make_trip('t2', 1200, 1800, 12000)
        self.archive.put(trip1)
        self.archive.put(trip2)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips)

        self.assertEqual(len(result), 2)
        # Both trips should have energy data
        for t in result:
            self.assertIn('energy_wh', t['data'])
            self.assertIn('efficiency_km_kwh', t['data'])

    def test_nearest_state_selection(self):
        """Should pick the state event closest in time to trip boundary."""
        # Two state events near trip start, the closer one has 50000
        self.archive.put(self._make_state('s1', -200, 51000))  # 200s before
        self.archive.put(self._make_state('s2', -30, 50000))   # 30s before (closer)
        self.archive.put(self._make_state('s3', 900, 48000))
        trip = self._make_trip('t1', 0, 900, 10000)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips)

        data = result[0]['data']
        self.assertEqual(data['start_battery_wh'], 50000.0)
        self.assertEqual(data['energy_wh'], 2000.0)

    def test_empty_trips_list(self):
        """Empty trips list should return empty list."""
        result = self.archive.enrich_trips_energy(self.device, [])
        self.assertEqual(result, [])

    def test_none_trips(self):
        """None trips should return None."""
        result = self.archive.enrich_trips_energy(self.device, None)
        self.assertIsNone(result)

    def test_custom_capacity(self):
        """SOC calculation should use the provided capacity_kwh."""
        self.archive.put(self._make_state('s1', 0, 50000))
        self.archive.put(self._make_state('s2', 900, 48000))
        trip = self._make_trip('t1', 0, 900, 10000)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        # Use 64 kWh capacity (like Wayon display gauge)
        result = self.archive.enrich_trips_energy(self.device, trips, capacity_kwh=64.0)

        data = result[0]['data']
        # soc_used = 2000 / (64 * 1000) * 100 = 3.125 -> 3.1%
        self.assertAlmostEqual(data['soc_used_percent'], 3.1, places=1)

    def test_zero_distance(self):
        """Trip with zero distance should not produce efficiency."""
        self.archive.put(self._make_state('s1', 0, 50000))
        self.archive.put(self._make_state('s2', 900, 49500))
        trip = self._make_trip('t1', 0, 900, 0)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips)

        data = result[0]['data']
        self.assertEqual(data['energy_wh'], 500.0)
        self.assertNotIn('efficiency_km_kwh', data)
        self.assertAlmostEqual(data['soc_used_percent'], 0.8, places=1)

    def test_soc_percent_direct_enrichment(self):
        """Trip with state events containing soc_percent should enrich start/end SOC."""
        t_start = self.now
        t_end = self.now + timedelta(seconds=900)
        self.archive.put({
            'schema': 1, 'device_id': self.device, 'event_id': 's1', 'kind': 'state',
            'observed_at': t_start.isoformat().replace('+00:00', 'Z'),
            'data': {'soc_percent': 76.2}
        })
        self.archive.put({
            'schema': 1, 'device_id': self.device, 'event_id': 's2', 'kind': 'state',
            'observed_at': t_end.isoformat().replace('+00:00', 'Z'),
            'data': {'soc_percent': 73.5}
        })
        trip = self._make_trip('t1', 0, 900, 10000)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        result = self.archive.enrich_trips_energy(self.device, trips, capacity_kwh=78.0)

        data = result[0]['data']
        self.assertEqual(data['start_soc_percent'], 76.2)
        self.assertEqual(data['end_soc_percent'], 73.5)
        self.assertIn('efficiency_km_kwh', data)

    def test_recalibration_with_capacity_when_wh_present(self):
        """When battery_wh is present alongside soc_percent, capacity_kwh takes precedence."""
        t_start = self.now
        t_end = self.now + timedelta(seconds=900)
        # s1: 39800 Wh, but event has 78kWh-based 51.0%
        self.archive.put({
            'schema': 1, 'device_id': self.device, 'event_id': 's1', 'kind': 'state',
            'observed_at': t_start.isoformat().replace('+00:00', 'Z'),
            'data': {'battery_wh': 39800, 'soc_percent': 51.0}
        })
        # s2: 28800 Wh, but event has 78kWh-based 36.9%
        self.archive.put({
            'schema': 1, 'device_id': self.device, 'event_id': 's2', 'kind': 'state',
            'observed_at': t_end.isoformat().replace('+00:00', 'Z'),
            'data': {'battery_wh': 28800, 'soc_percent': 36.9}
        })
        trip = self._make_trip('t1', 0, 900, 72600)
        self.archive.put(trip)

        trips = self.archive.history(self.device, 'trip', 10)
        # Enrich with 64 kWh capacity (e.g. gauge cluster calibrated)
        result = self.archive.enrich_trips_energy(self.device, trips, capacity_kwh=64.0)

        data = result[0]['data']
        # 39800 / 64000 = 62.1875 -> 62.2%
        self.assertEqual(data['start_soc_percent'], 62.2)
        # 28800 / 64000 = 45.0%
        self.assertEqual(data['end_soc_percent'], 45.0)
        self.assertEqual(data['start_battery_wh'], 39800.0)
        self.assertEqual(data['end_battery_wh'], 28800.0)
        self.assertEqual(data['energy_wh'], 11000.0)
        # 72.6km / 11.0kWh = 6.6 km/kWh
        self.assertEqual(data['efficiency_km_kwh'], 6.6)


if __name__ == '__main__':
    unittest.main()

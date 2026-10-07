"""Rolling windows reuse measured trip energy without additional cloud reads."""
import test_trip_energy as fixtures
from datetime import datetime, timezone, timedelta
import unittest


class TestRollingEnergy(unittest.TestCase):
    _make_state = fixtures.TestTripEnergy._make_state
    _make_trip = fixtures.TestTripEnergy._make_trip
    tearDown = fixtures.TestTripEnergy.tearDown

    def setUp(self):
        fixtures.TestTripEnergy.setUp(self)
        self.now = datetime(2026, 10, 1, 3, tzinfo=timezone.utc)

    def trip(self, name, end, km=10, used=2, device=None):
        for suffix, offset, wh in [('start', end-900, 50000), ('end', end, 50000-used*1000)]:
            event = self._make_state(name+suffix, offset, wh)
            if device:
                event['device_id'] = device
            self.archive.put(event)
        event = self._make_trip(name, end-900, end, km*1000)
        if device:
            event['device_id'] = device
        self.archive.put(event)

    def test_exact_720_hours_cross_month_and_device_isolation(self):
        self.trip('boundary', -30*86400, km=20, used=4)
        self.trip('previous_month', -86400)
        self.trip('outside', -30*86400-1, km=100)
        self.trip('future', 86400, km=100)
        self.trip('other_device', -3600, km=100, device='other')
        result = self.archive.overview(self.device, self.now)
        self.assertEqual(result['rolling30_trip_count'], 2)
        self.assertEqual(result['rolling30_distance_km'], 30)
        self.assertEqual(result['rolling30_drive_energy_kwh'], 6)
        self.assertEqual(result['rolling30_energy_coverage_percent'], 100)
        self.assertEqual(result['month_energy_trip_count'], 1)  # future trip still follows existing month semantics
        later = self.archive.overview(self.device, self.now+timedelta(seconds=1))
        self.assertEqual(later['rolling30_trip_count'], 1)

    def test_signed_energy_missing_short_trips_and_empty_month(self):
        self.trip('drive', -3*86400, km=30, used=6)
        self.trip('recovery', -2*86400, km=10, used=-1)
        self.archive.put(self._make_trip('missing', -86400-900, -86400, 10000))
        self.archive.put(self._make_trip('short', -1000, -900, 500))
        result = self.archive.overview(self.device, self.now)
        self.assertEqual(result['month_trip_count'], 1)  # short trip only
        self.assertEqual(result['rolling30_trip_count'], 4)
        self.assertEqual(result['rolling30_distance_km'], 50.5)
        self.assertEqual(result['rolling30_energy_distance_km'], 40)
        self.assertEqual(result['rolling30_drive_energy_kwh'], 5)
        self.assertEqual(result['rolling30_energy_coverage_percent'], 79.2)

    def test_retained_energy_and_distance_revision(self):
        self.trip('cloud-old', -20*86400)
        initial = self.archive.overview(self.device, self.now)
        with self.archive.connect() as db:
            db.execute("DELETE FROM events WHERE kind='state'")
        reopened = fixtures.Archive(self.db_path)
        self.assertEqual(reopened.overview(self.device, self.now), initial)
        revision = self._make_trip('cloud-old', -20*86400-900, -20*86400, 12000)
        reopened.put_cloud(revision)
        result = reopened.overview(self.device, self.now)
        self.assertEqual(result['rolling30_energy_distance_km'], 12)
        self.assertEqual(result['rolling30_drive_energy_kwh'], 2)
        with reopened.connect() as db:
            generation = db.execute('SELECT generation FROM journal_outbox WHERE device=?', (self.device,)).fetchone()[0]
        reopened.overview(self.device, self.now)
        with reopened.connect() as db:
            self.assertEqual(db.execute('SELECT generation FROM journal_outbox WHERE device=?', (self.device,)).fetchone()[0], generation)

    def test_no_trips(self):
        result = self.archive.overview(self.device, self.now)
        self.assertEqual(result['rolling30_distance_km'], 0)
        self.assertEqual(result['rolling30_trip_count'], 0)
        self.assertIsNone(result['rolling30_drive_energy_kwh'])
        self.assertIsNone(result['rolling30_energy_coverage_percent'])


if __name__ == '__main__':
    unittest.main()

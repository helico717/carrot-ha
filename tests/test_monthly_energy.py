import test_trip_energy as fixtures
Archive = fixtures.Archive
from datetime import datetime, timezone, timedelta
import unittest


class TestMonthlyEnergy(unittest.TestCase):
    _make_state = fixtures.TestTripEnergy._make_state
    _make_trip = fixtures.TestTripEnergy._make_trip
    tearDown = fixtures.TestTripEnergy.tearDown
    # Use a fixed point in the current KST month so month rollover doesn't flake.
    def setUp(self):
        fixtures.TestTripEnergy.setUp(self)
        self.now = datetime.now(timezone(timedelta(hours=9))).replace(day=10, hour=9, minute=0, second=0, microsecond=0)

    def test_monthly_energy_survives_raw_purge(self):
        self.archive.put(self._make_state('s1', 0, 50000))
        self.archive.put(self._make_state('s2', 900, 48000))
        self.archive.put(self._make_trip('t1', 0, 900, 10000))
        initial = self.archive.overview(self.device)
        self.assertEqual(initial['month_drive_energy_kwh'], 2)
        self.assertEqual(initial['month_energy_distance_km'], 10)
        self.assertEqual(initial['month_energy_coverage_percent'], 100)
        with self.archive.connect() as db:
            db.execute("DELETE FROM events WHERE kind='state'")
        reopened = Archive(self.db_path)
        self.assertEqual(reopened.overview(self.device), initial)

    def test_signed_regeneration_and_missing_trip_coverage(self):
        for name, sec, wh in [('s1', 0, 50000), ('s2', 900, 47000),
                              ('s3', 1800, 47000), ('s4', 2700, 48000)]:
            self.archive.put(self._make_state(name, sec, wh))
        for name, start, end in [('t1', 0, 900), ('t2', 1800, 2700), ('t3', 3600, 4500)]:
            self.archive.put(self._make_trip(name, start, end, 10000))
        result = self.archive.overview(self.device)
        self.assertEqual(result['month_drive_energy_kwh'], 2)
        self.assertEqual(result['month_energy_distance_km'], 20)
        self.assertEqual(result['month_energy_coverage_percent'], 66.7)

    def test_reject_charging_outside_boundary_and_partial(self):
        self.archive.put(self._make_state('s1', -30, 50000))
        self.archive.put(self._make_state('s2', 930, 49000))
        self.archive.put(self._make_trip('t1', 0, 900, 10000))
        self.assertIsNone(self.archive.overview(self.device)['month_drive_energy_kwh'])
        self.archive.put(self._make_state('s3', 0, 50000))
        self.archive.put(self._make_state('s4', 900, 48000))
        trip = self._make_trip('cloud-t1', 0, 900, 10000)
        trip['data']['partial'] = True
        self.archive.put_cloud(trip)
        result = self.archive.overview(self.device)
        self.assertEqual(result['month_energy_trip_count'], 1)
        self.assertEqual(result['month_energy_coverage_percent'], 50)

    def test_mutable_trip_invalidates_energy_cache(self):
        self.archive.put(self._make_state('s1', 0, 50000))
        self.archive.put(self._make_state('s2', 900, 48000))
        trip = self._make_trip('cloud-t1', 0, 900, 10000)
        self.archive.put_cloud(trip)
        self.assertEqual(self.archive.overview(self.device)['month_energy_distance_km'], 10)
        trip['data']['distance_m'] = 12000
        self.archive.put_cloud(trip)
        self.assertEqual(self.archive.overview(self.device)['month_energy_distance_km'], 12)


if __name__ == '__main__':
    unittest.main()

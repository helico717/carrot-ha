"""Range efficiency: 30-day trips of 10 km+, energy-weighted mean, 7-day half-life."""
import unittest
from datetime import timedelta
import test_trip_energy as fixtures


class RangeEfficiencyTests(fixtures.TestTripEnergy):
    def put(self, event_id, days_ago, km, kwh):
        observed = (self.now - timedelta(days=days_ago)).isoformat()
        with self.archive.connect() as db:
            db.execute('INSERT INTO events VALUES (?,?,?,?,?)', (self.device, event_id, observed, 'trip', '{}'))
            db.execute('INSERT INTO trip_energy VALUES (?,?,?,?,?)', (self.device, event_id, '[]', km, kwh))

    def test_weighted_mean_ignores_short_and_old_trips(self):
        for i, (km, kwh) in enumerate([(50, 10), (50, 50/6), (50, 50/6.5), (50, 50/7)]):
            self.put(f't{i}', 1, km, kwh)
        self.put('short', 1, 5, 0.1)    # 50 km/kWh quantization artifact
        self.put('old', 40, 200, 100)   # outside 30 days
        result = self.archive._range_efficiency(self.device, self.now)
        self.assertEqual(result['range_efficiency_kpl'], 6.03)  # 200 km / 33.17 kWh
        self.assertEqual(result['range_efficiency_trip_count'], 4)
        self.assertEqual(result['range_efficiency_distance_km'], 200)

    def test_recent_trips_outweigh_older_trips(self):
        self.put('old-a', 28, 100, 100/7)
        self.put('old-b', 28, 100, 100/7)
        self.put('new-a', 0, 30, 30/5)
        self.put('new-b', 0, 30, 30/5.5)
        # Unweighted 260 km / 40 kWh = 6.5; a 7-day half-life follows the recent trips.
        self.assertEqual(self.archive._range_efficiency(self.device, self.now)['range_efficiency_kpl'], 5.48)

    def state(self, name, minutes_ago, wh, odo, **extra):
        event = self._make_state(name, -minutes_ago*60, wh)
        event['data'].update(odometer_km=odo, **extra)
        self.archive.put(event)

    def test_window_uses_last_50km_across_trips(self):
        # Older 40 km at 4 km/kWh falls outside the 50 km window.
        self.state('o0', 300, 70000, 1000, driving=True)
        self.state('o1', 280, 60000, 1040, driving=True)
        # Parked drain and a charge are not driving consumption.
        self.state('p0', 200, 59000, 1040)
        self.state('c0', 190, 59000, 1040, charging=True)
        self.state('c1', 150, 69000, 1040, charging=True)
        # Latest 60 km at 6 km/kWh in 10 km steps, the newest still in progress.
        for i in range(7):
            self.state(f'd{i}', 60-i*10, 69000-i*10000/6, 1040+i*10, driving=True)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['window_efficiency_kpl'], 6.0)
        self.assertEqual(result['window_efficiency_distance_km'], 50)

    def test_window_requires_enough_distance(self):
        self.state('a', 20, 50000, 1000, driving=True)
        self.state('b', 10, 48000, 1010, driving=True)
        self.assertEqual(self.archive._window_efficiency(self.device, self.now), {})

    def test_insufficient_data_returns_nothing(self):
        self.put('a', 1, 20, 4)
        self.put('b', 1, 20, 4)
        self.assertEqual(self.archive._range_efficiency(self.device, self.now), {})


if __name__ == '__main__':
    unittest.main()

"""Range efficiency: last 50 km of odometer travel."""
import unittest
from datetime import timedelta
import test_trip_energy as fixtures


class RangeEfficiencyTests(fixtures.TestTripEnergy):
    def put(self, event_id, days_ago, km, kwh):
        observed = (self.now - timedelta(days=days_ago)).isoformat()
        with self.archive.connect() as db:
            db.execute('INSERT INTO events VALUES (?,?,?,?,?)', (self.device, event_id, observed, 'trip', '{}'))
            db.execute('INSERT INTO trip_energy VALUES (?,?,?,?,?)', (self.device, event_id, '[]', km, kwh))

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

    def test_window_keeps_cold_weather_efficiency_below_3(self):
        # 50 km at 2.5 km/kWh (winter highway) must not be lifted to a higher floor.
        for i in range(6):
            self.state(f'w{i}', 60-i*10, 69000-i*10000/2.5, 1000+i*10, driving=True)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['window_efficiency_kpl'], 2.5)

    def test_window_uses_short_history_as_it_is(self):
        self.state('a', 20, 50000, 1000, driving=True)
        self.state('b', 10, 47000, 1010, driving=True)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['window_efficiency_kpl'], 3.33)  # 10 km / 3 kWh
        self.assertEqual(result['window_efficiency_distance_km'], 10)

    def test_window_has_no_age_limit_on_states(self):
        # Driving ended 10 days ago; the car has been parked since.
        base = 10*24*60
        for i in range(7):
            self.state(f'old{i}', base - i*10, 69000 - i*10000/6, 1040 + i*10, driving=True)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['window_efficiency_kpl'], 6.0)
        self.assertEqual(result['window_efficiency_source'], 'states')

    def test_window_falls_back_to_trips_when_states_lack_distance(self):
        self.put('t_old', 30, 40, 40/5)
        self.put('t_new', 20, 30, 30/6)   # newest: all 30 km; then 20 km of the 40 km trip
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['window_efficiency_source'], 'trips')
        self.assertEqual(result['window_efficiency_distance_km'], 50)
        self.assertEqual(result['window_efficiency_kpl'], 5.56)  # 50 km / (5 + 4) kWh

    def test_baseline_caps_distance_and_excludes_old_trips(self):
        self.put('expired', 31, 300, 150)
        self.put('older', 10, 300, 60)
        self.put('newer', 1, 50, 20)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['window_efficiency_kpl'], 2.5)
        self.assertEqual(result['baseline_efficiency_distance_km'], 300)
        self.assertAlmostEqual(result['baseline_efficiency_kpl'], 300/70, places=4)

    def test_baseline_uses_available_recent_distance(self):
        self.put('expired', 31, 300, 100)
        self.put('recent', 2, 20, 4)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['baseline_efficiency_distance_km'], 20)
        self.assertEqual(result['baseline_efficiency_kpl'], 5)

    def test_expired_history_remains_recent_fallback_only(self):
        self.put('expired', 31, 50, 10)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['window_efficiency_kpl'], 5)
        self.assertNotIn('baseline_efficiency_kpl', result)

    def test_baseline_states_exclude_older_than_30_days(self):
        self.state('old_a', 31*24*60+10, 70000, 1000, driving=True)
        self.state('old_b', 31*24*60, 60000, 1030, driving=True)
        self.state('charge', 30*24*60, 70000, 1030, charging=True)
        self.state('new_a', 20, 50000, 1030, driving=True)
        self.state('new_b', 10, 48000, 1040, driving=True)
        result = self.archive._window_efficiency(self.device, self.now)
        self.assertEqual(result['baseline_efficiency_distance_km'], 10)
        self.assertEqual(result['baseline_efficiency_kpl'], 5)

    def test_state_window_prorates_boundary(self):
        self.state('a', 20, 50000, 1000, driving=True)
        self.state('b', 10, 44000, 1030, driving=True)
        self.state('c', 0, 41000, 1060, driving=True)
        km, wh = self.archive._window_from_states(self.device, 50, 3000, 500)
        self.assertEqual(km, 50)
        self.assertEqual(wh, 7000)

    def test_window_without_any_driving_returns_nothing(self):
        self.assertEqual(self.archive._window_efficiency(self.device, self.now), {})


if __name__ == '__main__':
    unittest.main()

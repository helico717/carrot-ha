import unittest
import importlib.util
import types
import sys
from datetime import datetime, timezone, timedelta

# Mock package modules for custom_components
pkg_cc = sys.modules.get('custom_components') or types.ModuleType('custom_components')
pkg_ch = sys.modules.get('custom_components.carrot_ha') or types.ModuleType('custom_components.carrot_ha')
pkg_ch.__path__ = ['custom_components/carrot_ha']
sys.modules['custom_components'] = pkg_cc
sys.modules['custom_components.carrot_ha'] = pkg_ch

if 'custom_components.carrot_ha.battery' not in sys.modules:
    spec_battery = importlib.util.spec_from_file_location('custom_components.carrot_ha.battery', 'custom_components/carrot_ha/battery.py')
    mod_battery = importlib.util.module_from_spec(spec_battery)
    sys.modules['custom_components.carrot_ha.battery'] = mod_battery
    spec_battery.loader.exec_module(mod_battery)
else:
    mod_battery = sys.modules['custom_components.carrot_ha.battery']

spec_vehicle = importlib.util.spec_from_file_location('custom_components.carrot_ha.vehicle', 'custom_components/carrot_ha/vehicle.py')
mod_vehicle = importlib.util.module_from_spec(spec_vehicle)
sys.modules['custom_components.carrot_ha.vehicle'] = mod_vehicle
spec_vehicle.loader.exec_module(mod_vehicle)

estimate_charging_times = mod_battery.estimate_charging_times
ID4_CHARGING_CURVE_KW = mod_battery.ID4_CHARGING_CURVE_KW
values = mod_vehicle.values

class MockDateTime(datetime):
    current_time = datetime(2026, 9, 22, 10, 0, 0, tzinfo=timezone.utc)
    @classmethod
    def now(cls, tz=None):
        if tz:
            return cls.current_time.astimezone(tz)
        return cls.current_time

mod_vehicle.datetime = MockDateTime

class TestChargingSmoothing(unittest.TestCase):
    def setUp(self):
        self.base_time = datetime(2026, 9, 22, 10, 0, 0, tzinfo=timezone.utc)
        MockDateTime.current_time = self.base_time
        self.capacity_kwh = 78.0

    def test_id4_curve_bottleneck(self):
        # At 20% SOC (15.6 kWh), ID.4 curve allows ~192 kW.
        # Input 350 kW DC charger should be capped by ID.4 curve.
        battery_kwh = 15.6  # 20%
        res_350k = estimate_charging_times(battery_kwh, self.capacity_kwh, 350000, base_time=self.base_time)
        res_200k = estimate_charging_times(battery_kwh, self.capacity_kwh, 200000, base_time=self.base_time)

        # Because curve max is ~192kW, 350kW and 200kW should yield very similar results (difference < 120s)
        self.assertIsNotNone(res_350k['time_to_80_s'])
        self.assertIsNotNone(res_200k['time_to_80_s'])
        diff = abs(res_350k['time_to_80_s'] - res_200k['time_to_80_s'])
        self.assertLess(diff, 120)

    def test_three_stage_smoothing_lifecycle(self):
        # 1. Initial 7 kW AC charging at 50% SOC (39.0 kWh)
        t0 = self.base_time
        battery_kwh = 39.0
        res0 = estimate_charging_times(battery_kwh, self.capacity_kwh, 7000, base_time=t0)
        self.assertIsNotNone(res0['time_to_100_s'])
        sec100_0 = res0['time_to_100_s']
        eta100_0 = datetime.fromisoformat(res0['eta_100'])
        smooth_state = res0['smooth_state']
        self.assertIsNotNone(smooth_state)

        # 2. 30 seconds later: minor power fluctuation to 6.9 kW
        # Minor variation within +/- 120s deadband should preserve previous ETA timestamp!
        t1 = t0 + timedelta(seconds=30)
        res1 = estimate_charging_times(battery_kwh, self.capacity_kwh, 6900, base_time=t1, smooth_state=smooth_state)
        eta100_1 = datetime.fromisoformat(res1['eta_100'])
        # Deadband keeps ETA timestamp steady
        self.assertEqual(eta100_1.timestamp(), eta100_0.timestamp())
        # And remaining duration counts down naturally by elapsed seconds (30s)
        self.assertEqual(res1['time_to_100_s'], sec100_0 - 30)

        # 3. Another 30 seconds later: power dips significantly to 4.8 kW (BMS dip)
        # Without smoothing, raw time would spike by > 1,500s.
        # With slew limiter, shift is clamped to at most 180 seconds.
        t2 = t1 + timedelta(seconds=30)
        res2 = estimate_charging_times(battery_kwh, self.capacity_kwh, 4800, base_time=t2, smooth_state=res1['smooth_state'])
        eta100_2 = datetime.fromisoformat(res2['eta_100'])
        eta_shift = (eta100_2 - eta100_1).total_seconds()
        self.assertLessEqual(eta_shift, 180.0, "ETA shift must be clamped by slew limit (<= 180s)")
        self.assertGreater(eta_shift, 0, "ETA should increase when power drops significantly")

        # 4. Abrupt power jump (> 25 kW): switched from AC to 100 kW DC
        # Slew limiter should immediately reset without lag
        t3 = t2 + timedelta(seconds=60)
        res3 = estimate_charging_times(battery_kwh, self.capacity_kwh, 100000, base_time=t3, smooth_state=res2['smooth_state'])
        self.assertLess(res3['time_to_100_s'], 3600, "100 kW DC should drop remaining time to well under an hour immediately")

    def test_target_soc_boundaries(self):
        # At 85% SOC: time_to_80_s must be 0, time_to_100_s > 0
        battery_kwh = 66.3  # 85%
        res = estimate_charging_times(battery_kwh, self.capacity_kwh, 7000, base_time=self.base_time)
        self.assertEqual(res['time_to_80_s'], 0)
        self.assertGreater(res['time_to_100_s'], 0)

        # At 100% SOC: both 0, smooth_state is None
        battery_kwh_full = 78.0
        res_full = estimate_charging_times(battery_kwh_full, self.capacity_kwh, 7000, base_time=self.base_time)
        self.assertEqual(res_full['time_to_80_s'], 0)
        self.assertEqual(res_full['time_to_100_s'], 0)
        self.assertIsNone(res_full['smooth_state'])

    def test_vehicle_runtime_integration(self):
        runtime = {
            'entry': type('Entry', (), {'options': {'soc_capacity_kwh': 78.0}, 'data': {'device_id': 'test-car'}, 'title': 'Car'}),
            'latest': {
                'data': {
                    'charging': True,
                    'charge_power_w': 7000,
                    'battery_wh': 39000,  # 50%
                    'measured_at': self.base_time.isoformat(),
                    'stale': False
                },
                'observed_at': self.base_time.isoformat()
            },
            'summary': {}
        }

        # First cycle: initializes smooth state in runtime
        v1 = values(runtime)
        self.assertIsNotNone(v1['time_to_100_s'])
        self.assertIn('charging_smooth_state', runtime)
        self.assertIsNotNone(runtime['charging_smooth_state'])
        sec_initial = v1['time_to_100_s']

        # Second cycle 30s later: natural countdown via deadband
        t_next = self.base_time + timedelta(seconds=30)
        MockDateTime.current_time = t_next
        runtime['latest']['data']['measured_at'] = t_next.isoformat()
        runtime['latest']['observed_at'] = t_next.isoformat()
        v2 = values(runtime)
        self.assertEqual(v2['time_to_100_s'], sec_initial - 30)

        # Third cycle: vehicle unplugs (charging = False)
        runtime['latest']['data']['charging'] = False
        runtime['latest']['data']['charge_power_w'] = 0
        v3 = values(runtime)
        self.assertIsNone(v3['time_to_100_s'])
        self.assertIsNone(v3['time_to_80_s'])
        self.assertIsNone(runtime.get('charging_smooth_state'))

class TestChargingRegression(unittest.TestCase):
    setUp = TestChargingSmoothing.setUp
    def runtime(self, wh=60650, measured_capacity=72157):
        return {
            'entry': type('Entry', (), {'options': {'soc_capacity_kwh': 78.0}}),
            'latest': {'observed_at': self.base_time.isoformat(), 'data': {
                'battery_wh': wh, 'measured_capacity_wh': measured_capacity,
                'charging': True, 'charge_power_w': 27987,
                'measured_at': self.base_time.isoformat(), 'stale': False}},
            'summary': {}}

    def test_recorded_capacity_mismatch(self):
        runtime = self.runtime()
        first = values(runtime)
        self.assertEqual(first['soc_percent'], 77.8)
        self.assertGreater(first['time_to_80_s'], 0)
        runtime['latest']['data']['measured_capacity_wh'] = 100518
        second = values(runtime)
        self.assertEqual(first['eta_80'], second['eta_80'])
        self.assertEqual(first['eta_100'], second['eta_100'])

    def test_reads_do_not_train_and_countdown_uses_wall_time(self):
        runtime = self.runtime()
        first = values(runtime)
        state = runtime['charging_smooth_state']
        MockDateTime.current_time += timedelta(seconds=30)
        for _ in range(50):
            result = values(runtime)
            self.assertIs(runtime['charging_smooth_state'], state)
            self.assertEqual(result['eta_100'], first['eta_100'])
        self.assertEqual(result['time_to_100_s'], first['time_to_100_s'] - 30)

    def test_stale_battery_field_overrides_fresh_other_fields(self):
        runtime = self.runtime()
        runtime['latest']['data']['field_measured_at'] = {
            'battery_wh': (self.base_time - timedelta(seconds=181)).isoformat()}
        self.assertIsNone(values(runtime)['time_to_100_s'])
        self.assertIsNone(runtime['charging_smooth_state'])

    def test_future_measurement_and_stopped_clear_prediction(self):
        runtime = self.runtime()
        values(runtime)
        runtime['latest']['data']['measured_at'] = (self.base_time + timedelta(seconds=30)).isoformat()
        self.assertIsNone(values(runtime)['time_to_100_s'])
        runtime = self.runtime()
        values(runtime)
        runtime['latest']['data']['charging'] = False
        self.assertIsNone(values(runtime)['time_to_100_s'])

    def test_invalid_energy_and_nonfinite(self):
        for wh in (102350, float('nan'), float('inf'), -1):
            self.assertIsNone(values(self.runtime(wh=wh))['time_to_100_s'])
        for power in (float('nan'), float('inf'), True):
            self.assertIsNone(estimate_charging_times(39, 78, power)['time_to_100_s'])

    def test_energy_not_rounded_to_target(self):
        result = values(self.runtime(wh=62375))
        self.assertGreater(result['time_to_80_s'], 0)

    def test_near_target_never_false_zero(self):
        first = estimate_charging_times(77.99, 78, 7000, base_time=self.base_time)
        second = estimate_charging_times(77.99, 78, 7000,
            base_time=self.base_time + timedelta(seconds=60), smooth_state=first['smooth_state'])
        self.assertGreater(second['time_to_100_s'], 0)

    def test_implausible_energy_step(self):
        first = estimate_charging_times(39, 78, 7000, base_time=self.base_time)
        second = estimate_charging_times(50, 78, 7000,
            base_time=self.base_time + timedelta(seconds=30), smooth_state=first['smooth_state'])
        self.assertIsNone(second['time_to_100_s'])

    def test_observed_taper_lengthens_prediction(self):
        state = None
        for i, power in enumerate((40000, 36000, 33000, 30000, 27000)):
            energy = 54.6 + i * 0.55
            result = estimate_charging_times(energy, 78, power,
                base_time=self.base_time + timedelta(seconds=i*60), smooth_state=state)
            state = result['smooth_state']
        baseline = estimate_charging_times(energy, 78, power, base_time=self.base_time)
        # Compare the physical estimate without display slew from earlier samples.
        self.assertLessEqual(state['power_smooth'], power / 1000)
        self.assertGreater(state['raw_durations'][100], baseline['time_to_100_s'])

    def test_filter_uses_elapsed_time_not_sample_count(self):
        initial = estimate_charging_times(39, 78, 7000, base_time=self.base_time)
        powers = []
        for interval in (30, 60):
            state = initial['smooth_state']
            for elapsed in range(interval, 121, interval):
                result = estimate_charging_times(39, 78, 6000,
                    base_time=self.base_time + timedelta(seconds=elapsed), smooth_state=state)
                state = result['smooth_state']
            powers.append(state['power_smooth'])
        self.assertAlmostEqual(*powers)

    def test_old_measurement_cannot_rewind_model(self):
        initial = estimate_charging_times(39, 78, 7000, base_time=self.base_time)
        old = estimate_charging_times(38, 78, 6000,
            base_time=self.base_time - timedelta(seconds=60), smooth_state=initial['smooth_state'])
        self.assertIs(old['smooth_state'], initial['smooth_state'])
        self.assertEqual(old['eta_100'], initial['eta_100'])

    def test_constant_rate_ac_energy_slope(self):
        state = None
        for i in range(6):
            result = estimate_charging_times(39 + i*0.1, 78, 6000,
                base_time=self.base_time + timedelta(seconds=i*60), smooth_state=state)
            state = result['smooth_state']
        self.assertAlmostEqual(state['power_smooth'], 6)
        self.assertAlmostEqual(result['time_to_100_s'], (78-39.5)/6*3600, delta=120)

if __name__ == '__main__':
    unittest.main()

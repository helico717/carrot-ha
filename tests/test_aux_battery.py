import importlib.util
import sys
import types
import unittest
from datetime import datetime, timedelta, timezone

pkg_cc = types.ModuleType('custom_components')
pkg_ch = types.ModuleType('custom_components.carrot_ha')
pkg_ch.__path__ = ['custom_components/carrot_ha']
sys.modules.setdefault('custom_components', pkg_cc)
sys.modules['custom_components.carrot_ha'] = pkg_ch


def load(name):
    spec = importlib.util.spec_from_file_location(f'custom_components.carrot_ha.{name}', f'custom_components/carrot_ha/{name}.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[f'custom_components.carrot_ha.{name}'] = module
    spec.loader.exec_module(module)
    return module


aux = load('aux_battery')
T0 = datetime(2026, 10, 28, 3, 0, 0, tzinfo=timezone.utc).timestamp()


def feed(tracker, volts, start=T0, step=60, resting=True):
    out = []
    for i, volt in enumerate(volts):
        out.append(tracker.observe(volt, start + i * step, resting))
    return out


def levels(results):
    return [r['level'] for r in results]


class TestLevels(unittest.TestCase):
    def test_thresholds_use_display_precision(self):
        for volt, expected in ((12.9, 'ok'), (12.2, 'ok'), (12.15, 'ok'), (12.14, 'caution'),
                               (12.05, 'caution'), (12.0, 'caution'), (12.4, 'ok')):
            self.assertEqual(aux.AuxBatteryTracker().observe(volt, T0, True)['level'], expected, volt)

    def test_low_is_pending_until_it_lasts(self):
        t = aux.AuxBatteryTracker()
        results = feed(t, [12.3, 11.9, 11.9, 11.9], step=60)
        self.assertEqual(levels(results), ['ok', 'caution', 'caution', 'caution'])
        self.assertEqual(results[-1]['reason'], 'low-pending')
        self.assertEqual(results[-1]['low_s'], 120)

    def test_observed_hourly_sag_never_warns(self):
        # Longest recorded wake sag was 4 minutes (65 runs, 11.7-11.9 V).
        t = aux.AuxBatteryTracker()
        results = feed(t, [12.3] * 5 + [11.8] * 4 + [12.3] * 5)
        self.assertNotIn('warn', levels(results))
        self.assertEqual(max(r['low_s'] for r in results), 180)

    def test_warn_after_sustained_low_then_recovers_with_hysteresis(self):
        t = aux.AuxBatteryTracker()
        results = feed(t, [12.3] + [11.9] * 12)
        # index 1 is the first low sample (run starts), so index n has been low for (n-1) minutes
        self.assertEqual((results[10]['level'], results[10]['low_s']), ('caution', 9 * 60))   # 9 min: still pending
        self.assertEqual((results[11]['level'], results[11]['low_s']), ('warn', 10 * 60))     # 10 min: warning
        self.assertEqual(results[-1]['level'], 'warn')
        # 12.0 V is no longer "low" but is still inside the recovery step: stay warn
        self.assertEqual(t.observe(12.0, T0 + 13 * 60, True)['level'], 'warn')
        self.assertEqual(t.observe(12.1, T0 + 14 * 60, True)['level'], 'caution')
        self.assertEqual(t.observe(12.2, T0 + 15 * 60, True)['level'], 'caution')   # needs 12.3 to be ok
        self.assertEqual(t.observe(12.3, T0 + 16 * 60, True)['level'], 'ok')

    def test_no_flicker_around_normal_boundary(self):
        # Recorded day-old parking alternates 12.1/12.2; the colour must not follow it.
        t = aux.AuxBatteryTracker()
        start = feed(t, [12.4, 12.1])
        self.assertEqual(levels(start), ['ok', 'caution'])
        wobble = feed(t, [12.2, 12.1, 12.2, 12.2, 12.1], start=T0 + 120)
        self.assertEqual(set(levels(wobble)), {'caution'})
        self.assertEqual(t.observe(12.3, T0 + 600, True)['level'], 'ok')
        # once ok, a 12.2 reading keeps it ok; only 12.1 drops it
        self.assertEqual(t.observe(12.2, T0 + 660, True)['level'], 'ok')
        self.assertEqual(t.observe(12.1, T0 + 720, True)['level'], 'caution')

    def test_driving_charging_and_dcdc_clear_state(self):
        t = aux.AuxBatteryTracker()
        feed(t, [12.1])
        active = t.observe(12.1, T0 + 60, False)
        self.assertEqual((active['level'], active['reason']), (None, 'active'))
        # after activity the next resting sample is judged fresh (no remembered caution)
        self.assertEqual(t.observe(12.2, T0 + 120, True)['level'], 'ok')
        dcdc = t.observe(13.8, T0 + 180, True)
        self.assertEqual((dcdc['level'], dcdc['reason']), (None, 'dcdc'))
        self.assertEqual(t.observe(12.94, T0 + 240, True)['level'], 'ok')       # 12.9 rounds below the DC-DC line
        self.assertEqual(t.observe(12.95, T0 + 300, True)['reason'], 'dcdc')    # displayed as 13.0 V

    def test_gap_ends_low_run_and_level(self):
        t = aux.AuxBatteryTracker()
        feed(t, [11.9, 11.9, 11.9])
        # Comma was off for an hour, a single low reading must start a new run
        late = t.observe(11.9, T0 + 3 * 3600, True)
        self.assertEqual(late['low_s'], 0)
        self.assertEqual(late['level'], 'caution')
        # no hysteresis memory across the gap either
        t2 = aux.AuxBatteryTracker()
        feed(t2, [12.1])
        self.assertEqual(t2.observe(12.2, T0 + 3600, True)['level'], 'ok')

    def test_repeated_and_out_of_order_measurements_do_not_change_state(self):
        t = aux.AuxBatteryTracker()
        first = t.observe(11.9, T0, True)
        t.observe(11.9, T0 + 60, True)
        again = t.observe(13.5, T0 + 60, True)       # same measurement time: ignored
        old = t.observe(13.5, T0 - 60, True)         # older: ignored
        self.assertEqual(again['reason'], 'low-pending')
        self.assertEqual(old, again)
        self.assertEqual(first['level'], 'caution')


class TestApplyAndSeed(unittest.TestCase):
    def data(self, volt, stamp, **extra):
        return {'aux_voltage': volt, 'measured_at': stamp.isoformat(),
                'field_measured_at': {'aux_voltage': stamp.isoformat()}, **extra}

    def test_apply_adds_fields_and_tracks_across_calls(self):
        runtime = {}
        now = datetime(2026, 10, 28, 3, 20, tzinfo=timezone.utc)
        out = None
        for i in range(12):
            stamp = now - timedelta(minutes=11 - i)
            out = aux.apply(runtime, self.data(11.9, stamp), now)
        self.assertEqual(out['aux_level'], 'warn')
        self.assertEqual(out['aux_low_minutes'], 11)
        self.assertEqual(out['aux_age_s'], 0)
        # reading values() again for the same measurement is idempotent
        again = aux.apply(runtime, self.data(11.9, now), now + timedelta(seconds=30))
        self.assertEqual((again['aux_level'], again['aux_low_minutes'], again['aux_age_s']), ('warn', 11, 30))

    def test_stale_measurement_keeps_last_known_value_but_reports_its_age(self):
        runtime = {}
        stamp = datetime(2026, 10, 28, 1, 26, tzinfo=timezone.utc)
        aux.apply(runtime, self.data(11.81, stamp), stamp)
        later = stamp + timedelta(hours=5)
        out = aux.apply(runtime, self.data(11.81, stamp), later)
        self.assertEqual(out['aux_age_s'], 5 * 3600)
        self.assertEqual(out['aux_level'], 'caution')    # frontends show it gray because it is old

    def test_missing_or_invalid_voltage(self):
        for bad in (None, float('nan'), 0, -1, 99, '12.5'):
            out = aux.apply({}, {'aux_voltage': bad, 'measured_at': '2026-10-28T03:00:00+00:00'})
            self.assertIsNone(out['aux_level'])
            self.assertEqual(out['aux_level_reason'], 'no-data')
            self.assertIsNone(out['aux_age_s'])
        out = aux.apply({}, {'aux_voltage': 12.5})
        self.assertEqual(out['aux_level_reason'], 'no-data')

    def test_driving_flag_from_values_blocks_judgement(self):
        stamp = datetime(2026, 10, 28, 3, 0, tzinfo=timezone.utc)
        out = aux.apply({}, self.data(13.8, stamp, onroad=True), stamp)
        self.assertEqual((out['aux_level'], out['aux_level_reason']), (None, 'active'))

    def test_seed_after_restart_matches_streaming(self):
        events = []
        stream = aux.AuxBatteryTracker()
        for i in range(14):
            volt = 12.3 if i == 0 else 11.9
            stamp = datetime(2026, 10, 28, 3, 0, tzinfo=timezone.utc) + timedelta(minutes=i)
            stream.observe(volt, stamp.timestamp(), True)
            events.append({'observed_at': stamp.isoformat(), 'data': {
                'aux_voltage': volt, 'driving': False, 'charging': None,
                'field_measured_at': {'aux_voltage': stamp.isoformat()}}})
        runtime = {}
        seeded = aux.seed(runtime, events + [{'data': {}}, None])    # junk rows are skipped
        self.assertEqual(seeded.result, stream.result)
        self.assertEqual(seeded.result['level'], 'warn')
        self.assertIs(runtime['aux_battery'], seeded)


class TestValuesWiring(unittest.TestCase):
    def test_values_exposes_level_fields_from_the_shared_tracker(self):
        from enum import Enum
        for mod_name in ['homeassistant', 'homeassistant.components', 'homeassistant.const', 'homeassistant.helpers']:
            sys.modules.setdefault(mod_name, types.ModuleType(mod_name))
        load('battery')
        vehicle = load('vehicle')
        now = datetime.now(timezone.utc)

        def runtime(volt, age_s):
            stamp = (now - timedelta(seconds=age_s)).isoformat()
            return {
                'entry': type('Entry', (), {'options': {'soc_capacity_kwh': 77.0}, 'data': {'device_id': 'x'}, 'title': 't'}),
                'latest': {'data': {'aux_voltage': volt, 'battery_wh': 55000.0, 'driving': False, 'measured_at': stamp,
                                    'field_measured_at': {'aux_voltage': stamp}}, 'observed_at': stamp},
                'summary': {}}

        rt = runtime(12.5, 20)
        out = vehicle.values(rt)
        self.assertEqual((out['aux_level'], out['aux_level_reason']), ('ok', 'ok'))
        self.assertAlmostEqual(out['aux_age_s'], 20, delta=3)
        self.assertEqual(out['aux_low_minutes'], 0)
        self.assertIsInstance(rt['aux_battery'], aux.AuxBatteryTracker)
        # last known value is kept (not expired like diagnostics) and reports its age
        old = vehicle.values(runtime(11.81, 3 * 3600))
        self.assertEqual(old['aux_voltage'], 11.81)
        self.assertGreaterEqual(old['aux_age_s'], 3 * 3600 - 3)


if __name__ == '__main__':
    unittest.main()

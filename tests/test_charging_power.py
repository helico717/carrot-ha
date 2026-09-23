import importlib.util
import unittest
from datetime import datetime, timezone, timedelta


def load(name):
    spec = importlib.util.spec_from_file_location(name, 'custom_components/carrot_ha/' + name + '.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


power = load('charging_power').charging_power
lock = load('telemetry').combined_lock_state


class PowerTest(unittest.TestCase):
    def setUp(self):
        self.runtime = {}
        self.start = datetime.now(timezone.utc)

    def sample(self, seconds, watts, **kw):
        now = self.start + timedelta(seconds=seconds)
        data = dict(charging=True, charge_power_w=watts, measured_at=now.isoformat())
        data.update(kw)
        power(data, self.runtime, now)
        return data

    def test_fast_start_and_taper_are_immediate(self):
        for sec, watts in [(0, 150000), (60, 90000), (120, 50000), (180, 6000)]:
            self.assertEqual(self.sample(sec, watts)['charge_power_w'], watts)

    def test_low_power_zero_hold_and_expiry(self):
        self.sample(0, 1500)
        self.assertEqual(self.sample(60, 0)['charge_power_w'], 1500)
        self.assertEqual(self.sample(180, 0)['charge_power_w'], 1500)
        self.assertEqual(self.sample(240, 0)['charge_power_w'], 0)
        self.assertEqual(self.sample(300, 0)['charge_power_w'], 0)
        self.assertEqual(self.sample(360, 2000)['charge_power_w'], 2000)

    def test_fast_hold_shorter(self):
        self.sample(0, 100000)
        self.assertEqual(self.sample(60, 0)['charge_power_w'], 100000)
        self.assertEqual(self.sample(120, 0)['charge_power_w'], 0)

    def test_reset_conditions_and_restart(self):
        for change in ({'charging': False}, {'charging': None}, {'onroad': True}, {'stale': True}):
            self.runtime.clear()
            self.sample(0, 1500)
            self.sample(60, 0, **change)
            self.assertEqual(self.sample(120, 0)['charge_power_w'], 0)
        self.runtime.clear()
        self.assertEqual(self.sample(0, 0)['charge_power_w'], 0)

    def test_gap_missing_and_out_of_order(self):
        self.sample(0, 1500)
        self.assertEqual(self.sample(181, 0)['charge_power_w'], 0)
        self.sample(240, 1500)
        self.assertIsNone(self.sample(250, None)['charge_power_w'])
        self.assertEqual(self.sample(260, 0)['charge_power_w'], 0)
        self.sample(300, 1500)
        self.assertEqual(self.sample(290, 0)['charge_power_w'], 0)

    def test_repeated_reads_do_not_extend_hold(self):
        self.sample(0, 1500)
        stamp = (self.start + timedelta(seconds=60)).isoformat()
        self.sample(60, 0)
        self.assertEqual(self.sample(239, 0, measured_at=stamp)['charge_power_w'], 1500)
        self.assertEqual(self.sample(240, 0, measured_at=stamp)['charge_power_w'], 0)
        self.assertIsNone(self.sample(241, 0, measured_at=stamp)['charge_power_w'])


class LockTest(unittest.TestCase):
    def test_truth_table(self):
        for a, b, expected in [(True, False, True), (False, True, True),
                               (True, True, True), (False, False, False),
                               (None, False, None), (None, None, None)]:
            self.assertIs(lock(dict(doors_locked_external=a, doors_locked_internal=b)), expected)

    def test_parked_last_values_ignore_age_and_timestamp_difference(self):
        self.assertIs(lock(dict(doors_locked_external=True, doors_locked_internal=False,
            stale=True, field_measured_at={'doors_locked_external': 'old', 'doors_locked_internal': 'new'})), True)
        self.assertIs(lock(dict(doors_locked_external=False, doors_locked_internal=False,
            stale=True, field_measured_at={'doors_locked_external': 'old', 'doors_locked_internal': 'new'})), False)


if __name__ == '__main__':
    unittest.main()

import importlib.util
import unittest
from datetime import datetime, timezone, timedelta


def load(name):
    spec = importlib.util.spec_from_file_location('custom_components.carrot_ha.'+name, 'custom_components/carrot_ha/' + name + '.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


power = load('charging_power').charging_power
lock = load('telemetry').combined_lock_state


class PowerTest(unittest.TestCase):
    def setUp(self):
        self.runtime = {}
        self.start = datetime.now(timezone.utc)
    def sample(self, watts, mode=4, age=0, **changes):
        stamp = (self.start-timedelta(seconds=age)).isoformat()
        data = dict(bms_actual_mode_bus1=mode, bms_power_w_bus1=watts, bms_voltage_v_bus1=350,
                    field_measured_at={k:stamp for k in ('bms_actual_mode_bus1','bms_power_w_bus1','bms_voltage_v_bus1')})
        data.update(changes)
        power(data,self.runtime,self.start)
        return data
    def test_low_power_does_not_depend_on_energy_quantization(self):
        self.assertEqual(self.sample(1450)['actual_charge_power_w'],1450)
    def test_actual_zero_is_immediate_without_hold(self):
        self.sample(6500)
        self.assertEqual(self.sample(0)['charge_power_w'],0)
        self.assertNotIn('power_hold',self.runtime)
    def test_missing_init_stale_and_future_are_unknown(self):
        for args in ({'watts':None},{'watts':6500,'mode':7},{'watts':6500,'age':181},{'watts':6500,'age':-1}):
            self.assertIsNone(self.sample(**args)['charge_power_w'])
    def test_delayed_display_is_not_calculation_input(self):
        data = self.sample(9400, age=95)
        self.assertEqual(data['actual_charge_power_w'], 9400)
        self.assertEqual(data['charge_power_source'], 'can_actual_delayed')
        self.assertIsNone(data['charge_power_raw_w'])
        self.assertEqual(self.sample(0, mode=1)['actual_charge_power_w'], 0)

    def test_request_only_does_not_restore_estimated_power(self):
        data={'charge_power_w':6500,'charge_can_bms_request_bus1':4,'field_measured_at':{'charge_can_bms_request_bus1':self.start.isoformat()}}
        self.assertIsNone(power(data,self.runtime,self.start))
    def test_same_frame_required_and_noncharging_is_zero(self):
        self.assertEqual(self.sample(-200,mode=1)['charge_power_w'],0)
        self.assertIsNone(self.sample(6500,field_measured_at={'bms_actual_mode_bus1':self.start.isoformat()})['charge_power_w'])
    def test_driving_cannot_be_charging(self):
        self.assertEqual(self.sample(20000,driving=True)['charge_power_w'],0)


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

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'collector'))
from telemetry_fields import decode_optional, device_health, DOORS, LIGHTS
from engine import Engine, Store
import tempfile


class TestOptionalTelemetry(unittest.TestCase):
    def test_zero_and_missing_are_distinct(self):
        self.assertEqual(decode_optional({}), {})
        result = decode_optional({'ZV_02': {'ZV_FT_offen': [0], 'ZV_HD_offen': [1]},
                                  'Licht_Anf_01': {'BCM1_Abblendlicht_Anf': [0]}})
        self.assertIs(result['door_driver_open'], False)
        self.assertIs(result['trunk_open'], True)
        self.assertIs(result['light_low_beam_requested'], False)
        self.assertNotIn('door_passenger_open', result)
        self.assertNotIn('hood_open', result)
        self.assertNotIn('charge_plug_connected', result)

    def test_bms_and_temperature_sentinels(self):
        result = decode_optional({'BMS_04': {'BMS_IstModus': [7], 'BMS_Soll_SOC_HiRes': [102.3]},
                                  'DCDC_03': {'DC_Temperatur': [214]}})
        self.assertEqual(result['bms_mode'], 'unknown')
        self.assertIsNone(result['bms_target_soc_percent'])
        self.assertIsNone(result['dcdc_temperature_c'])
        result = decode_optional({'BMS_04': {'BMS_IstModus': [6], 'BMS_Soll_SOC_HiRes': [80]},
                                  'DCDC_03': {'DC_Temperatur': [0]}})
        self.assertEqual(result['bms_mode'], 'dc_charging')
        self.assertEqual(result['bms_target_soc_percent'], 80)
        self.assertEqual(result['dcdc_temperature_c'], 0)

    def test_health_reductions_and_fan_semantics(self):
        result = device_health(SimpleNamespace(cpuTempC=[45, 62], gpuTempC=[], cpuUsagePercent=[10, 30],
            freeSpacePercent=0, memoryUsagePercent=40, fanSpeedPercentDesired=75,
            thermalStatus='yellow', networkType='wifi', networkStrength='good'))
        self.assertEqual(result['comma_cpu_temperature_c'], 62)
        self.assertEqual(result['comma_cpu_usage_percent'], 20)
        self.assertEqual(result['comma_storage_free_percent'], 0)
        self.assertEqual(result['comma_fan_requested_percent'], 75)
        self.assertNotIn('comma_gpu_temperature_c', result)

    def test_health_does_not_refresh_vehicle_or_charge_energy(self):
        with tempfile.TemporaryDirectory() as folder:
            engine = Engine(Store(Path(folder)/'store.db'), 'car')
            engine.tick(1800000000, False, sampled={'battery_wh': 50000, 'bms_target_soc_percent': 80})
            stamp = engine.s['field_measured_at']['battery_wh']
            events = engine.tick(1800000200, False, diagnostics={'comma_cpu_temperature_c': 70})
            self.assertEqual(engine.s['field_measured_at']['battery_wh'], stamp)
            self.assertIsNone(engine.s['vehicle']['charging'])
            self.assertEqual(events[-1][1]['vehicle']['comma_cpu_temperature_c'], 70)
            engine.tick(1800000201, False, sampled={'bms_target_soc_percent': None})
            self.assertIsNone(engine.s['vehicle']['bms_target_soc_percent'])


if __name__ == '__main__':
    unittest.main()

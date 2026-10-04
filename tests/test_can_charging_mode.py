import importlib.util
import unittest
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'custom_components/carrot_ha/charging_mode.py'
spec=importlib.util.spec_from_file_location('charging_mode',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ChargingModeTests(unittest.TestCase):
 def sample(self,code):return {'charge_can_bms_request_bus1':code,'field_measured_at':{'charge_can_bms_request_bus1':'2026-10-04T13:30:00+00:00'}}
 def test_documented_states(self):
  for code,mode,active in [(0,'hv_off',False),(1,'hv_on',False),(3,'ac_preparing',False),(4,'ac_charging',True),(6,'dc_charging',True),(7,'initializing',None),(2,'unknown',None),(5,'unknown',None)]:
   with self.subTest(code=code):
    result=m.charging_mode(self.sample(code),1791120601)
    self.assertEqual((result['mode'],result['charging']),(mode,active))
 def test_stale_and_missing_never_infer_from_energy(self):
  self.assertIsNone(m.charging_mode({'battery_wh':50000},1791120601)['charging'])
  self.assertIsNone(m.charging_mode(self.sample(6),1791120700)['charging'])
 def test_init_and_driving(self):
  d=self.sample(6);d['driving']=True
  self.assertFalse(m.charging_mode(d,1791120601)['charging'])
  self.assertIsNone(m.charging_mode(self.sample(7),1791120601)['charging'])
 def test_bus_conflict(self):
  d=self.sample(6);d['charge_can_bms_request_bus0']=1;d['field_measured_at']['charge_can_bms_request_bus0']=d['field_measured_at']['charge_can_bms_request_bus1']
  self.assertIsNone(m.charging_mode(d,1791120601)['charging'])

 def test_confirmed_driving_without_can_is_not_a_charge_gap(self):
  result=m.charging_mode({'driving':True},1791120601)
  self.assertFalse(result['charging'])
  self.assertEqual(result['validation'],'driving')

import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
spec=importlib.util.spec_from_file_location('location',Path(__file__).resolve().parents[1]/'custom_components/carrot_ha/location.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class LocationTests(unittest.TestCase):
 def setUp(self): self.now=datetime(2026,10,10,8,1,tzinfo=timezone.utc)
 def test_stale_gps_speed_never_blocks_charging(self):
  result=m.location_values({'gps':{'measured_at':'2026-10-10T07:58:37Z','speedMps':1.802,'fresh':True}},self.now)
  self.assertIsNone(result['speed_kph']);self.assertFalse(result['gps_fresh'])
 def test_fresh_and_future_speed(self):
  self.assertEqual(m.location_values({'gps':{'measured_at':'2026-10-10T08:00:45Z','speedMps':2}},self.now)['speed_kph'],7.2)
  self.assertIsNone(m.location_values({'gps':{'measured_at':'2026-10-10T08:02:00Z','speedMps':2}},self.now)['speed_kph'])
 def test_new_trip_replaces_old_parking_and_preserves_fix_time(self):
  old={'latitude':37,'longitude':127,'measured_at':'2026-10-10T06:08:15Z'}
  trip={'latitude':38,'longitude':128,'measured_at':'2026-10-10T07:59:27Z','gps_measured_at':'2026-10-10T07:58:36Z'}
  result=m.location_values({'parking':old,'last_trip_parking':trip},self.now)
  self.assertEqual(result['parking_latitude'],38);self.assertTrue(result['parking_estimated'])
  self.assertEqual(result['parking_at'],trip['measured_at']);self.assertEqual(result['parking_gps_at'],trip['gps_measured_at'])
  old['measured_at']='2026-10-10T08:00:00Z'
  self.assertFalse(m.location_values({'parking':old,'last_trip_parking':trip},self.now)['parking_estimated'])
 def test_invalid_and_undated_coordinates_do_not_win(self):
  p={'latitude':999,'longitude':127,'measured_at':'2026-10-10T08:00:00Z'}
  self.assertIsNone(m.location_values({'parking':p},self.now)['parking_at'])
  p['latitude']=37;p.pop('measured_at')
  self.assertIsNone(m.location_values({'parking':p},self.now)['parking_at'])

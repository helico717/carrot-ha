"""Quarter-hour detail preserves daily accounting and real sample boundaries."""
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch
import test_trip_energy as fixtures
from custom_components.carrot_ha import battery_history


class BatteryIntervalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.archive = fixtures.Archive(Path(self.temp.name) / 'archive.sqlite3')
    def tearDown(self):
        self.temp.cleanup()
    def sample(self, stamp, soc, charging=False, driving=False):
        self.archive.put(dict(schema=1, device_id='car', event_id=stamp,
            kind='state', observed_at=stamp, data=dict(battery_wh=soc*640,
                charging=charging, driving=driving,
                field_measured_at={'battery_wh':stamp})))
    def graph(self, now='2026-11-16T23:59:00+00:00', zone='UTC'):
        return battery_history.history(self.archive, 'car', 64, zone, datetime.fromisoformat(now))
    def test_multiple_transitions_within_one_hour_and_last_reading(self):
        for minute,soc,ch,dr in [(0,60,False,True),(10,57,False,True),
                                 (15,58,True,False),(25,70,True,False),
                                 (30,69,False,True),(45,65,False,True)]:
            self.sample(f'2026-11-16T09:{minute:02}:00Z',soc,ch,dr)
        d=self.graph()[-1]
        self.assertEqual(d['interval_minutes'],15)
        self.assertEqual(len(d['hours']),96)
        self.assertEqual([round(x['soc'],6) for x in d['hours'][36:40]],[57,70,69,65])
        self.assertEqual(d['charge_hours'][36:40],[False,True,False,False])
        self.assertTrue(d['hours'][38]['driving'])
    def test_carry_only_elapsed_intervals_and_local_timezone(self):
        self.sample('2026-11-16T00:01:00Z',50)
        d=self.graph('2026-11-16T00:31:00+00:00','Asia/Seoul')[-1]
        self.assertTrue(all(x is None for x in d['hours'][:36]))
        self.assertFalse(d['hours'][36]['last_known'])
        self.assertTrue(d['hours'][37]['last_known'])
        self.assertTrue(d['hours'][38]['last_known'])
        self.assertIsNone(d['hours'][39])
        self.assertIsNone(d['used'])
    def test_session_boundaries_cross_midnight_without_soc(self):
        self.archive.put(dict(schema=1,device_id='car',event_id='charge',kind='charge',
            observed_at='2026-11-16T00:15:00Z',data=dict(
                started_at='2026-11-15T23:50:00Z',ended_at='2026-11-16T00:15:00Z',energy_kwh=10)))
        days=self.graph()
        self.assertTrue(days[-2]['charge_hours'][95])
        self.assertEqual(days[-1]['charge_hours'][:2],[True,False])
        self.assertEqual(days[-2]['charge_s'],600)
        self.assertEqual(days[-1]['charge_s'],900)
        self.assertTrue(all(x is None for x in days[-1]['hours']))
    def test_daily_summary_is_identical_to_hourly_aggregation(self):
        for minute,soc in [(0,60),(2,59),(4,58),(20,57),(22,55)]:
            self.sample(f'2026-11-16T09:{minute:02}:00Z',soc,False,True)
        fine=self.graph()
        with patch.multiple(battery_history,INTERVAL_MINUTES=60,SLOTS_PER_DAY=24):
            hourly=self.graph()
        summary=lambda rows:[{k:v for k,v in d.items() if k not in ('hours','charge_hours','interval_minutes')} for d in rows]
        self.assertEqual(summary(fine),summary(hourly))
        self.assertEqual(fine[-1]['used'],4)

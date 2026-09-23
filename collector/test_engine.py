"""Run with python3 -m unittest discover -s collector -p 'test_*.py'."""
import tempfile
import unittest
from pathlib import Path
from engine import Engine, Store


class ChargingTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store=Store(Path(self.tmp.name)/'collector.sqlite3')
        self.engine=Engine(self.store,'test')
        self.base=1800000000

    def tick(self, seconds, wh=None, onroad=False):
        return self.engine.tick(self.base+seconds,onroad,
                                sampled={'battery_wh':wh} if wh is not None else None,
                                motion={'gear':'drive','speed_mps':10} if onroad else None)

    def test_priority_snapshot_preserves_fifo_backlog(self):
        self.tick(0)
        self.tick(60)
        self.tick(120)
        oldest = self.store.first()
        newest = self.store.latest_telemetry()
        self.assertNotEqual(oldest[0], newest[0])
        self.assertEqual(self.store.count(), 3)
        self.store.acknowledge(newest[0])
        self.assertEqual(self.store.first(), oldest)
        self.store.acknowledge(oldest[0])
        self.assertEqual(self.store.count(), 1)

    def test_priority_snapshot_does_not_select_trip(self):
        self.store.save({}, [('/api/trips', {'id': 'trip'})], self.base)
        self.assertIsNone(self.store.latest_telemetry())
        self.assertEqual(self.store.first()[0], 'trip')

    def test_false_positive_and_missing_measurements(self):
        self.tick(0,17450)
        self.tick(119.628622,17475)
        self.assertFalse(self.engine.s['vehicle']['charging'])
        self.assertEqual(self.engine.s['vehicle']['charge_power_w'],752)
        self.tick(241)
        self.assertIsNone(self.engine.s['vehicle']['charging'])
        self.tick(420)
        self.assertNotIn('charge_candidate',self.engine.s)
        self.assertEqual(self.engine.s['charge_months'],{})
        self.assertEqual(self.engine.s['charge_sessions'],[])

    def test_fast_charge_waits_for_sixty_second_upload(self):
        self.tick(0,20000)
        self.tick(60,21000)
        events=self.tick(90,21500)
        self.assertEqual(events,[])
        self.assertTrue(self.engine.s['vehicle']['charging'])
        self.assertEqual(self.engine.s['vehicle']['charge_power_w'],60000)
        self.assertEqual(self.tick(119,22000),[])
        self.assertEqual(len(self.tick(120)),1)

    def test_driving_keeps_thirty_second_upload(self):
        self.tick(0,20000,onroad=True)
        self.assertEqual(self.tick(29,20000,onroad=True),[])
        self.assertEqual(len(self.tick(30,20000,onroad=True)),1)

    def test_six_hours_parked_keeps_reporting(self):
        uploads=[]
        for t in range(0,21601):
            if self.tick(t):uploads.append(t)
        self.assertEqual(uploads,list(range(0,21601,60)))

    def test_candidate_survives_restart_and_counts_once(self):
        self.tick(0,20000)
        self.tick(90,20025)
        self.engine=Engine(self.store,'test')
        self.tick(180,20050)
        self.assertTrue(self.engine.s['vehicle']['charging'])
        self.assertAlmostEqual(self.engine.s['charge']['energy_kwh'],.05)
        self.tick(210,20050)
        self.assertAlmostEqual(self.engine.s['charge']['energy_kwh'],.05)

    def test_flat_window_cancels_candidate(self):
        self.tick(0,20000)
        self.tick(90,20025)
        self.tick(180,20025)
        self.tick(270,20050)
        self.assertFalse(self.engine.s['vehicle']['charging'])
        self.assertEqual(self.engine.s['charge_months'],{})

    def test_end_keeps_sixty_seconds(self):
        self.tick(0,20000)
        self.tick(60,20250)
        self.tick(90,20500)
        for t in range(120,390,30):
            self.tick(t,20500)
        self.assertTrue(self.engine.s['vehicle']['charging'])
        self.assertEqual(self.tick(390,20500),[])
        self.assertFalse(self.engine.s['vehicle']['charging'])
        self.assertEqual(len(self.tick(420,20500)),1)
        self.assertEqual(self.tick(450,20500),[])
        self.assertEqual(len(self.tick(480,20500)),1)
        self.assertEqual(len(self.engine.s['charge_sessions']),1)

    def test_gap_and_road_reset_candidate(self):
        self.tick(0,20000)
        self.tick(90,20025)
        self.tick(400,20500)
        self.assertFalse(self.engine.s['vehicle']['charging'])
        self.tick(490,20525)
        self.tick(500,onroad=True)
        self.tick(510,21000)
        self.assertFalse(self.engine.s['vehicle']['charging'])
        self.assertEqual(self.engine.s['charge_months'],{})

    def test_candidate_soc_is_uploaded(self):
        self.tick(0,20000)
        events=self.tick(120,20025)
        self.assertEqual(events[0][1]['vehicle']['battery_wh'],20025)
        self.assertAlmostEqual(events[0][1]['vehicle']['soc_percent'],20025/780)
        self.assertFalse(events[0][1]['vehicle']['charging'])

    def test_impossible_jump_not_counted(self):
        self.tick(0,20000)
        self.tick(90,30000)
        self.assertEqual(self.engine.s['charge_months'],{})
        self.assertFalse(self.engine.s['vehicle']['charging'])

class MotionTests(unittest.TestCase):
    setUp=ChargingTests.setUp
    def sample(self,t,wh,gear='park',speed=0,onroad=True):
        motion=None if gear is None else {'gear':gear,'speed_mps':speed}
        return self.engine.tick(self.base+t,onroad,sampled={'battery_wh':wh},motion=motion)

    def test_key_on_park_charges_at_sixty_seconds(self):
        self.sample(0,20000)
        self.sample(60,20000)
        self.assertEqual(self.sample(90,20500),[])
        self.assertTrue(self.engine.s['vehicle']['charging'])
        self.assertIsNone(self.engine.s.get('trip'))
        payload=self.sample(120,20600)[0][1]
        self.assertEqual(payload['onroad'],0)
        self.assertEqual(payload['ignition'],1)
        self.assertIs(payload['vehicle']['driving'],False)
        self.assertTrue(payload['vehicle']['comma_onroad'])

    def test_key_on_does_not_end_parked_charge(self):
        self.sample(0,20000,onroad=False)
        self.sample(90,20500,onroad=False)
        charge_id=self.engine.s['charge']['id']
        self.sample(180,21000)
        self.assertEqual(self.engine.s['charge']['id'],charge_id)
        self.assertAlmostEqual(self.engine.s['charge']['energy_kwh'],1)

    def test_drive_regeneration_and_traffic_stop(self):
        self.sample(0,20000,'drive',10)
        trip_id=self.engine.s['trip']['id']
        self.sample(90,21000,'drive',0)
        self.assertEqual(self.engine.s['trip']['id'],trip_id)
        self.assertFalse(self.engine.s['vehicle']['charging'])
        self.assertEqual(self.engine.s['charge_months'],{})
        self.sample(120,21000,'neutral',0)
        self.assertTrue(self.engine.s['vehicle']['driving'])
        self.sample(150,21000,'park',0)
        self.assertIsNone(self.engine.s['trip'])

    def test_missing_key_on_signal_never_confirms_charging(self):
        self.sample(0,20000)
        self.sample(90,20025)
        self.sample(180,21000,None)
        self.assertIsNone(self.engine.s['vehicle']['driving'])
        self.assertIsNone(self.engine.s['vehicle']['charging'])
        self.assertNotIn('charge_candidate',self.engine.s)
        self.sample(210,22000)
        self.assertEqual(self.engine.s['charge_months'],{})

    def test_unknown_signal_suspends_trip(self):
        self.sample(0,20000,'drive',10)
        trip_id=self.engine.s['trip']['id']
        self.sample(10,20000,None)
        self.assertEqual(self.engine.s['trip']['id'],trip_id)
        self.assertTrue(self.engine.s['trip']['partial'])
        self.sample(20,20000,'drive',10)
        self.assertEqual(self.engine.s['trip']['id'],trip_id)

    def test_motion_overrides_mode_and_bad_signals_are_unknown(self):
        self.sample(0,20000,'park',5,onroad=False)
        self.assertTrue(self.engine.s['vehicle']['driving'])
        self.sample(30,20000,'unknown',0)
        self.assertIsNone(self.engine.s['vehicle']['driving'])
        self.sample(60,20000,'park',float('nan'))
        self.assertIsNone(self.engine.s['vehicle']['driving'])

if __name__=='__main__':unittest.main()

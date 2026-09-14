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
                                sampled={'battery_wh':wh} if wh is not None else None)

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

    def test_fast_charge_immediate_and_thirty_second_upload(self):
        self.tick(0,20000)
        self.tick(60,21000)
        events=self.tick(90,21500)
        self.assertEqual(len(events),1)
        self.assertTrue(events[0][1]['vehicle']['charging'])
        self.assertEqual(events[0][1]['vehicle']['charge_power_w'],60000)
        self.assertEqual(self.tick(119,22000),[])
        self.assertEqual(len(self.tick(120)),1)

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

    def test_end_returns_to_sixty_seconds(self):
        self.tick(0,20000)
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

if __name__=='__main__':unittest.main()

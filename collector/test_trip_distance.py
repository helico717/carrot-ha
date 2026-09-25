import tempfile
import unittest
from pathlib import Path
from engine import Engine,Store


class DistanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.store=Store(Path(self.tmp.name)/'state.db');self.engine=Engine(self.store,'test')
        self.base=1800000000

    def tick(self,t,speed=20,gps=None,odo=None,gear='drive',mono=None):
        return self.engine.tick(self.base+t,True,gps=gps,
            sampled={'odometer_km':odo} if odo is not None else None,
            motion={'speed_mps':speed,'gear':gear},monotonic_now=mono)

    def finish(self,t):
        return [p for path,p in self.tick(t,0,gear='park') if path=='/api/trips'][0]

    def test_long_tunnel_without_any_gps_still_records_distance(self):
        for t in range(601):self.tick(t)
        p=self.finish(601)
        self.assertEqual(p['distanceM'],12000)
        self.assertEqual(p['route'],[])
        self.assertTrue(p['distanceQuality']['complete'])
        self.assertEqual(p['distanceSource'],'can_speed')

    def test_gps_reacquisition_does_not_double_count(self):
        for t in range(601):
            gps={'latitude':37,'longitude':127+t*.0002} if t in (0,600) else None
            self.tick(t,gps=gps)
        self.assertEqual(self.finish(601)['distanceM'],12000)

    def test_restart_gap_is_not_integrated_at_stale_speed(self):
        for t in range(101):self.tick(t)
        self.engine=Engine(self.store,'test')
        self.tick(700)
        self.assertEqual(self.engine.s['trip']['distanceM'],2000)
        self.assertFalse(self.engine.s['trip']['distance_complete'])
        for t in range(701,711):self.tick(t)
        self.assertEqual(self.finish(711)['distanceM'],2200)

    def test_monotonic_integration_ignores_wall_clock_adjustment(self):
        self.tick(0,mono=100)
        self.tick(3601,mono=101)
        self.assertEqual(self.engine.s['trip']['distanceM'],20)
        self.assertEqual(self.engine.s['trip']['durationS'],1)

    def test_valid_odometer_recovers_long_collector_outage(self):
        self.tick(0,odo=1000)
        for t in range(1,301):self.tick(t,odo=1006 if t==300 else None)
        self.engine=Engine(self.store,'test')
        self.tick(600,odo=1012)
        p=self.finish(601)
        self.assertEqual(p['distanceM'],12000)
        self.assertEqual(p['distanceSource'],'odometer_gap_recovery')
        self.assertTrue(p['distanceQuality']['estimated'])

    def test_odometer_reset_cannot_recover_outage(self):
        self.tick(0,odo=1000)
        for t in range(1,301):self.tick(t,odo=1006 if t==300 else None)
        self.engine=Engine(self.store,'test');self.tick(600,odo=500)
        self.assertEqual(self.finish(601)['distanceM'],6000)

    def test_unknown_motion_marks_gap_without_extrapolating(self):
        self.tick(0);self.tick(1)
        self.engine.tick(self.base+2,True,motion=None)
        self.tick(3);self.tick(4)
        self.assertEqual(self.engine.s['trip']['distanceM'],40)
        self.assertFalse(self.engine.s['trip']['distance_complete'])

"""Regression tests for tunnel loss, retained evidence and cloud resync."""
import json
import math
import unittest
import test_trip_energy as fixtures
from custom_components.carrot_ha import trip_repair


class RepairTests(fixtures.TestTripEnergy):
    def corrected_trip(self):
        start = self.now.timestamp()
        # 18 km at 20 m/s, with one five-minute GPS gap.
        point = lambda t: {'latitude':0.,'longitude':math.degrees(20*t/6371000),
                           't':trip_repair.datetime.fromtimestamp(start+t,self.now.tzinfo).isoformat(),
                           'accuracyM':3.0}
        trip = self._make_trip('cloud-tunnel',0,900,12000)
        trip['data'].update(partial=True,route=[point(t) for t in [0,300,305,600,900]])
        for name,t,wh,odo in [('a',0,50000,1000),('b',900,47000,1018)]:
            event=self._make_state(name,t,wh)
            event['data']['odometer_km']=odo
            self.archive.put(event)
        self.archive.put_cloud(trip)
        return trip

    def test_tunnel_repair_is_idempotent_and_raw_unchanged(self):
        trip=self.corrected_trip()
        before=json.dumps(trip['data'],sort_keys=True)
        self.archive.repair_trips(self.device)
        d=self.archive.history(self.device,'trip')[0]['data']
        self.assertAlmostEqual(d['distance_m'],18000,delta=1)
        self.assertEqual(d['distance_raw_m'],12000)
        self.assertTrue(d['partial'])
        self.assertTrue(d['distance_estimated'])
        self.assertEqual(d['energy_wh'],3000)
        self.archive.put_cloud(trip)
        self.archive.repair_trips(self.device)
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data'],d)
        with self.archive.connect() as db:
            raw=json.loads(db.execute("SELECT body FROM events WHERE kind='trip'").fetchone()[0])['data']
        self.assertEqual(json.dumps(raw,sort_keys=True),before)

    def test_derivation_survives_states_and_route_purge(self):
        self.corrected_trip()
        original=self.archive.history(self.device,'trip')[0]['data']
        with self.archive.connect() as db:
            db.execute("DELETE FROM events WHERE kind='state'")
            db.execute("UPDATE events SET body=json_set(body,'$.data.route',json('[]')) WHERE kind='trip'")
        archive=fixtures.Archive(self.db_path)
        after=archive.history(self.device,'trip')[0]['data']
        for k in ['distance_m','energy_wh','distance_raw_m']:self.assertEqual(after[k],original[k])
        self.assertEqual(archive.enrich_trips_energy(self.device,[{'data':after}])[0]['data']['efficiency_km_kwh'],6)

    def test_inconsistent_odometer_and_gps_jump_not_repaired(self):
        trip=self.corrected_trip()
        trip['data']['route'][1]['longitude']=150
        self.archive.put_cloud(trip)
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data']['distance_m'],12000)

    def test_route_change_invalidates_existing_correction(self):
        trip=self.corrected_trip()
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data']['distance_m'],18000)
        trip['data']['route'][2]['t']=trip['data']['route'][0]['t']
        self.archive.put_cloud(trip)
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data']['distance_m'],12000)

    def test_changed_boundaries_cannot_reuse_old_energy(self):
        trip=self.corrected_trip()
        self.archive.repair_trips(self.device)
        trip['data']['ended_at']=trip['data']['started_at']
        self.archive.put_cloud(trip)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertNotIn('energy_verified',data)
        self.assertEqual(data['distance_m'],12000)

    def test_can_distance_not_replaced_by_gps(self):
        trip=self.corrected_trip()
        trip['data']['distance_source']='can_speed'
        self.archive.put_cloud(trip)
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data']['distance_m'],12000)

    def test_distance_only_change_preserves_cached_energy(self):
        trip=self._make_trip('cloud-energy',0,900,10000)
        self.archive.put(self._make_state('a',0,50000))
        self.archive.put(self._make_state('b',900,48000))
        self.archive.put_cloud(trip)
        month=self.now.strftime('%Y-%m')
        a=self.archive.driving_energy_summary(self.device,month,self.now.tzinfo,10)
        self.assertEqual(a['month_drive_energy_kwh'],2)
        with self.archive.connect() as db:db.execute("DELETE FROM events WHERE kind='state'")
        trip['data']['distance_m']=12000
        self.archive.put_cloud(trip)
        a=self.archive.driving_energy_summary(self.device,month,self.now.tzinfo,12)
        self.assertEqual(a['month_drive_energy_kwh'],2)
        self.assertEqual(a['month_energy_distance_km'],12)

    def test_stale_measurements_cannot_authorize_repair(self):
        self.corrected_trip()
        with self.archive.connect() as db:
            db.execute("UPDATE events SET body=json_set(body,'$.data.stale',json('true')) WHERE kind='state'")
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data']['distance_m'],12000)

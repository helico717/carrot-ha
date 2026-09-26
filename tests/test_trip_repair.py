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
        trip['data']['distance_quality']={'complete':True}
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


class RevisionTests(unittest.TestCase):
    setUp = fixtures.TestTripEnergy.setUp
    tearDown = fixtures.TestTripEnergy.tearDown
    _make_trip = fixtures.TestTripEnergy._make_trip
    _make_state = fixtures.TestTripEnergy._make_state
    corrected_trip = RepairTests.corrected_trip

    def revise_state(self, key, field, value):
        with self.archive.connect() as db:
            db.execute("UPDATE events SET body=json_set(body,?,json(?)) WHERE id=?",
                       ('$.data.'+field,json.dumps(value),key))
        self.archive.repair_trips(self.device)

    def test_new_odometer_conflict_revokes_old_distance_and_energy(self):
        self.corrected_trip()
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data']['distance_m'],18000)
        self.archive.overview(self.device)
        self.revise_state('b','odometer_km',1030)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertEqual(data['distance_m'],12000)
        self.assertTrue(data['energy_rejected'])
        self.assertNotIn('energy_verified',data)
        rows=self.archive.enrich_trips_energy(self.device,[{'data':data}])
        self.assertNotIn('energy_wh',rows[0]['data'])
        with self.archive.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM trip_energy').fetchone()[0],0)

    def test_battery_revision_updates_daily_monthly_and_recent(self):
        self.corrected_trip()
        first=self.archive.overview(self.device)
        self.assertEqual(first['month_drive_energy_kwh'],3)
        self.revise_state('b','battery_wh',46000)
        data=self.archive.history(self.device,'trip')[0]['data']
        summary=self.archive.overview(self.device)
        self.assertEqual(data['energy_wh'],4000)
        self.assertEqual(summary['month_drive_energy_kwh'],4)
        self.assertEqual(summary['recent_efficiency_kpl'],4.5)

    def test_charging_evidence_revokes_energy_even_after_cached(self):
        self.corrected_trip();self.archive.overview(self.device)
        self.revise_state('b','charging',True)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertNotIn('energy_verified',data)
        self.assertTrue(data['energy_rejected'])
        self.assertIsNone(self.archive.overview(self.device)['month_drive_energy_kwh'])

    def test_stale_evidence_does_not_look_like_raw_purge(self):
        self.corrected_trip();self.archive.overview(self.device)
        self.revise_state('b','stale',True)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertEqual(data['distance_m'],12000)
        self.assertTrue(data['energy_rejected'])

    def test_version_one_migrates_without_raw_evidence(self):
        self.corrected_trip();self.archive.overview(self.device)
        with self.archive.connect() as db:
            row=db.execute('SELECT id,body FROM trip_derivations').fetchone()
            previous=json.loads(row[1]);previous['version']=1
            for k in ('source_fingerprint','distance_version','energy_version'):
                previous.pop(k,None)
            db.execute('UPDATE trip_derivations SET body=? WHERE id=?',(json.dumps(previous),row[0]))
            db.execute("DELETE FROM events WHERE kind='state'")
            db.execute("UPDATE events SET body=json_set(body,'$.data.route',json('[]')) WHERE kind='trip'")
        from unittest.mock import patch
        with patch.object(trip_repair,'VERSION',3):
            self.archive.repair_trips(self.device)
            data=self.archive.history(self.device,'trip')[0]['data']
            self.assertEqual(data['distance_m'],18000)
            self.assertEqual(data['energy_wh'],3000)
            self.assertEqual(data['distance_correction_version'],1)
        reopened=fixtures.Archive(self.db_path)
        self.assertEqual(reopened.history(self.device,'trip')[0]['data']['distance_m'],18000)

    def test_source_revision_discards_previous_gps_correction(self):
        trip=self.corrected_trip();self.archive.repair_trips(self.device)
        trip['data'].update(distance_source='can_speed',distance_quality={'complete':True})
        self.archive.put_cloud(trip)
        self.assertEqual(self.archive.history(self.device,'trip')[0]['data']['distance_m'],12000)

    def test_incomplete_can_is_reconstructed_without_a_gps_gap(self):
        trip=self.corrected_trip()
        start=self.now.timestamp()
        trip['data']['route']=[{'latitude':0.,'longitude':math.degrees(20*t/6371000),
                               't':trip_repair.datetime.fromtimestamp(start+t,self.now.tzinfo).isoformat()}
                              for t in range(0,901,5)]
        trip['data'].update(distance_source='can_speed',distance_quality={'complete':False})
        self.archive.put_cloud(trip)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertEqual(data['distance_m'],18000)
        self.assertTrue(data['distance_estimated'])
        self.assertFalse(data['distance_incomplete'])

    def test_incomplete_can_without_evidence_does_not_claim_verified_efficiency(self):
        trip=self._make_trip('cloud-incomplete',0,900,12000)
        trip['data'].update(partial=True,distance_source='can_speed',distance_quality={'complete':False})
        self.archive.put_cloud(trip)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertTrue(data['distance_incomplete'])
        self.assertTrue(data['energy_rejected'])

    def test_collector_estimate_propagates_to_display(self):
        trip=self.corrected_trip()
        trip['data'].update(distance_source='odometer_gap_recovery',distance_quality={'complete':False,'estimated':True})
        self.archive.put_cloud(trip)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertEqual(data['distance_m'],12000)
        self.assertTrue(data['distance_estimated'])

    def test_distance_only_revision_retains_daily_energy_after_raw_purge(self):
        trip=self._make_trip('cloud-energy',0,900,10000)
        self.archive.put(self._make_state('a',0,50000))
        self.archive.put(self._make_state('b',900,48000))
        self.archive.put_cloud(trip);self.archive.overview(self.device)
        with self.archive.connect() as db:db.execute("DELETE FROM events WHERE kind='state'")
        trip['data']['distance_m']=12000;self.archive.put_cloud(trip)
        data=self.archive.history(self.device,'trip')[0]['data']
        self.assertEqual(data['energy_wh'],2000)
        self.assertEqual(self.archive.enrich_trips_energy(self.device,[{'data':data}])[0]['data']['efficiency_km_kwh'],6)
        self.assertEqual(self.archive.overview(self.device)['month_drive_energy_kwh'],2)

    def test_prior_month_cache_updates_without_visiting_prior_month(self):
        from datetime import timedelta
        self.now=self.now.replace(day=1)-timedelta(days=3)
        self.corrected_trip();self.archive.repair_trips(self.device)
        self.archive.driving_energy_summary(self.device,self.now.strftime('%Y-%m'),self.now.tzinfo,18)
        self.revise_state('b','battery_wh',46000)
        with self.archive.connect() as db:
            self.assertEqual(db.execute('SELECT energy_kwh FROM trip_energy').fetchone()[0],4)
        self.assertEqual(self.archive.overview(self.device)['recent_efficiency_kpl'],4.5)

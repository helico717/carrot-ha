import unittest
import test_trip_energy as fixtures
from custom_components.carrot_ha import trip_repair

class BoundaryTruthTests(fixtures.TestTripEnergy):
    def test_soc_recovery_independent_of_rejected_energy_and_persisted_after_retention(self):
        self.archive.put(self._make_state('s1',0,50000));self.archive.put(self._make_state('s2',900,48000))
        t=self._make_trip('t',0,900,10000)
        t['data'].update(partial=True,distance_source='can_speed',distance_quality={'complete':False})
        self.archive.put(t)
        data=self.archive.enrich_trips_energy(self.device,self.archive.history(self.device,'trip'),78)[0]['data']
        self.assertTrue(data['energy_rejected']); self.assertEqual(data['start_soc_percent'],64.1)
        self.assertEqual(data['end_soc_percent'],61.5);self.assertNotIn('efficiency_km_kwh',data)
        with self.archive.connect() as db: db.execute("DELETE FROM events WHERE kind='state'")
        archive=fixtures.Archive(self.db_path)
        again=archive.enrich_trips_energy(self.device,archive.history(self.device,'trip'),78)[0]['data']
        self.assertEqual(again['start_soc_percent'],64.1);self.assertEqual(again['end_soc_percent'],61.5)

    def test_measurements_from_daemon_survive_without_state_uploads(self):
        t=self._make_trip('t',0,900,10050)
        t['data'].update(distance_source='can_speed',distance_quality={'complete':True},partial=False,
            trip_measurements={'start':{'at':t['data']['started_at'],'battery_wh':50000},
                'end':{'at':t['data']['ended_at'],'battery_wh':48500},'complete':True})
        self.archive.put(t)
        data=self.archive.enrich_trips_energy(self.device,self.archive.history(self.device,'trip'),78)[0]['data']
        self.assertEqual(data['energy_wh'],1500);self.assertEqual(data['efficiency_km_kwh'],6.7)
        self.assertEqual(data['end_soc_percent'],62.2)

    def test_stale_field_does_not_become_new_boundary(self):
        state=self._make_state('s',900,48000)
        state['data']['field_measured_at']['battery_wh']=self._make_state('old',-600,48000)['observed_at']
        self.archive.put(state);self.archive.put(self._make_trip('t',0,900,10000))
        d=self.archive.enrich_trips_energy(self.device,self.archive.history(self.device,'trip'),78)[0]['data']
        self.assertNotIn('energy_wh',d);self.assertNotIn('end_soc_percent',d)

    def test_boundary_above_capacity_does_not_clamp_to_100(self):
        self.archive.put(self._make_state('s1',0,79000));self.archive.put(self._make_state('s2',900,78000))
        self.archive.put(self._make_trip('t',0,900,10000))
        d=self.archive.enrich_trips_energy(self.device,self.archive.history(self.device,'trip'),64)[0]['data']
        self.assertIsNone(d['start_soc_percent']);self.assertIsNone(d['end_soc_percent'])

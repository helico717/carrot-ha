"""CAN display-SOC migration must not change energy accounting."""
import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from test_trip_energy import TestTripEnergy
from custom_components.carrot_ha import display_soc
from custom_components.carrot_ha.vehicle import values
from custom_components.carrot_ha.battery_history import history


class LiveSocTests(unittest.TestCase):
    def test_existing_live_value_uses_can_while_energy_and_range_stay_wh(self):
        now = datetime.now(timezone.utc).isoformat()
        data = {'battery_wh':37000, display_soc.KEY:58.5,
                'field_measured_at':{display_soc.KEY:now,'battery_wh':now}, 'measured_at':now}
        result = values({'entry':SimpleNamespace(options={}),
                         'latest':{'data':data,'observed_at':now}, 'summary':{}})
        self.assertEqual(result['soc_percent'],58.5)
        self.assertEqual(result['battery_kwh'],37.0)
        self.assertEqual(result['range_km'],185)
        self.assertEqual(result['soc_source'],display_soc.SOURCE)
        self.assertNotIn('soc_percent',data)  # no mutation of received facts

    def test_missing_invalid_future_and_stale_are_not_new_measurements(self):
        now=datetime.now(timezone.utc)
        for value in [None,True,-1,100.5,float('nan')]:
            data={display_soc.KEY:value,'battery_wh':37000,
                  'field_measured_at':{display_soc.KEY:now.isoformat()}}
            display_soc.live(data,now)
            self.assertIsNone(data['soc_percent'])
        data={display_soc.KEY:58.5,'field_measured_at':{display_soc.KEY:(now-timedelta(hours=2)).isoformat()}}
        display_soc.live(data,now)
        self.assertEqual(data['soc_percent'],58.5)
        self.assertTrue(data['soc_stale'])
        data['field_measured_at'][display_soc.KEY]=(now+timedelta(minutes=1)).isoformat()
        display_soc.live(data,now)
        self.assertIsNone(data['soc_percent'])


class TripSocTests(TestTripEnergy):
    def test_soc_history_tracks_can_and_does_not_count_source_switch_as_usage(self):
        self.now=datetime.now(timezone.utc)-timedelta(minutes=10)
        self.archive.put(self._make_state('legacy',-60,64000))
        for name,offset,wh,soc in [('a',0,50000,80),('b',60,48000,78.5)]:
            state=self._make_state(name,offset,wh)
            state['data'][display_soc.KEY]=soc
            state['data']['field_measured_at'][display_soc.KEY]=state['observed_at']
            self.archive.put(state)
        result=history(self.archive,self.device,64)
        self.assertEqual(sum(day['used'] or 0 for day in result),1.5)

    def test_can_boundaries_change_soc_but_not_wh_or_efficiency(self):
        for name,offset,wh,soc in [('a',0,50000,80),('b',900,48000,78.5)]:
            state=self._make_state(name,offset,wh)
            state['data'][display_soc.KEY]=soc
            state['data']['field_measured_at'][display_soc.KEY]=state['observed_at']
            self.archive.put(state)
        trip=self._make_trip('trip',0,900,10000)
        self.archive.put(trip)
        rows=self.archive.enrich_trips_energy(self.device,self.archive.history(self.device,'trip',10),64)
        data=rows[0]['data']
        self.assertEqual((data['start_soc_percent'],data['end_soc_percent']),(80,78.5))
        self.assertEqual(data['soc_used_percent'],1.5)
        self.assertEqual(data['energy_wh'],2000)
        self.assertEqual(data['efficiency_km_kwh'],5)
        self.assertEqual(data['start_soc_source'],display_soc.SOURCE)

    def test_charge_boundaries_use_can_without_changing_charge_kwh(self):
        for name,offset,wh,soc in [('a',0,50000,80),('b',900,52000,83.5)]:
            state=self._make_state(name,offset,wh)
            state['data'][display_soc.KEY]=soc
            state['data']['field_measured_at'][display_soc.KEY]=state['observed_at']
            self.archive.put(state)
        item={'data':{'started_at':self.now.isoformat(),
                      'ended_at':(self.now+timedelta(seconds=900)).isoformat(),'energy_kwh':2}}
        data=self.archive.enrich_charges_soc(self.device,[item],64)[0]['data']
        self.assertEqual((data['start_soc_percent'],data['end_soc_percent']),(80,83.5))
        self.assertEqual(data['soc_charged_percent'],3.5)
        self.assertEqual(data['energy_kwh'],2)

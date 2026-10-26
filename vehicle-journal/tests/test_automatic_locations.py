"""Synthetic parking continuity, vehicle scope and provider coverage regressions."""
import asyncio
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch,AsyncMock
pkg=types.ModuleType('custom_components.carrot_ha');pkg.__path__=['custom_components/carrot_ha']
sys.modules.setdefault('custom_components',types.ModuleType('custom_components'))
sys.modules.setdefault('custom_components.carrot_ha',pkg)
from custom_components.carrot_ha.vehicle_journal import automatic_locations as auto
from custom_components.carrot_ha.vehicle_journal.stations import Stations
from custom_components.carrot_ha.vehicle_journal.store import Journal
from custom_components.carrot_ha.storage import Archive
from custom_components.carrot_ha.vehicle_journal.source import sync

class ParkingTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.a=Archive(Path(self.tmp.name)/'a.db');self.j=Journal(Path(self.tmp.name)/'j.db','entry','car','Asia/Seoul');self.start=datetime(2026,1,1,1,tzinfo=timezone.utc)
    def tearDown(self):self.tmp.cleanup()
    def state(self,seconds,measured=None,device='car',**changes):
        at=self.start+timedelta(seconds=seconds);fix=self.start+timedelta(seconds=seconds if measured is None else measured)
        data={'onroad':False,'vehicle':{'wheel_speed_mps':0},'gps':{'latitude':37.5,'longitude':127.0,'accuracyM':2,'speedMps':0,'fresh':True,'measured_at':fix.isoformat()}}
        gps=changes.pop('gps',{});data.update(changes);data['gps'].update(gps)
        self.a.put({'schema':1,'device_id':device,'event_id':str(seconds)+device,'kind':'state','observed_at':at.isoformat(),'data':data})
    def clear(self):
        with self.a.connect() as db:db.execute('DELETE FROM events')
    def parked(self,age=180,**change):
        for second in range(-age,1,60):self.state(second,-age,**(change if second==-60 else {}))
    def position(self):return auto.position(self.a,self.j,self.start.isoformat())
    def test_fresh_gps_unchanged(self):
        self.state(0);self.assertEqual(self.position()['basis'],'charge_start_fresh_stationary_gps')
    def test_preparation_delays_173_and_143_seconds(self):
        for age in (173,143):
            with self.subTest(age=age):
                self.clear()
                for second in (-age,-age+60,-age+120,0):self.state(second,-age)
                self.assertEqual(self.position()['basis'],'charge_start_verified_parked_gps')
    def test_longer_parked_window(self):
        self.parked(540);self.assertIsNotNone(self.position())
    def test_expired_fix_rejected(self):
        self.parked(660);self.assertIsNone(self.position())
    def test_telemetry_gap_rejected(self):
        self.state(-180);self.state(0,-180);self.assertIsNone(self.position())
    def test_missing_end_coverage_rejected(self):
        self.state(-240);self.state(-180,-240);self.assertIsNone(self.position())
    def test_driving_wheel_speed_and_unknown_state_rejected(self):
        for change in ({'onroad':True},{'onroad':None},{'vehicle':{'wheel_speed_mps':3}}):
            with self.subTest(change=change):
                self.clear();self.parked(**change);self.assertIsNone(self.position())
    def test_gps_movement_or_bad_accuracy_rejected(self):
        for gps in ({'latitude':37.501},{'accuracyM':80},{'speedMps':2},{'speedMps':-1}):
            with self.subTest(gps=gps):
                self.clear();self.parked(gps=gps);self.assertIsNone(self.position())
    def test_other_device_not_used(self):
        self.state(0,device='other');self.assertIsNone(self.position())
    def test_failure_version_retries_once_and_override_preserved(self):
        self.a.put({'schema':1,'device_id':'car','event_id':'charge','kind':'charge','observed_at':(self.start+timedelta(hours=1)).isoformat(),'data':{'started_at':self.start.isoformat(),'ended_at':(self.start+timedelta(hours=1)).isoformat(),'energy_kwh':10,'duration_s':3600}})
        sync(self.a,self.j);item=auto.pending(self.j)[0]
        with self.j.connect() as db:db.execute('UPDATE records SET extra_json=? WHERE id=?',(json.dumps({'location_lookup':{'retry_after':9999999999,'message':'old'}}),item[0]))
        item=auto.pending(self.j)[0];auto.save(self.j,item,None,None,'no position');self.assertEqual(auto.pending(self.j),[])
        with self.j.connect() as db:db.execute('UPDATE records SET extra_json=? WHERE id=?',(json.dumps({'location_user_override':True}),item[0]))
        self.assertEqual(auto.pending(self.j),[])

class ScopeTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_explicit_electric_setting(self):
        for fuel in ('gasoline','diesel','hybrid',None):
            manager=types.SimpleNamespace(automatic_locations=True,kakao_rest_key='test',metadata={'entry':{'fuel':fuel}},entries=lambda:[{'entry_id':'entry','vehicle_id':'vehicle','fuel':manager.metadata['entry'].get('fuel')}])
            with patch.object(auto,'pending',side_effect=AssertionError('must not inspect/search')):
                await auto.enrich(None,manager,None,types.SimpleNamespace(vehicle='vehicle'))
        manager.metadata['entry']['fuel']='electric';self.assertTrue(auto.electric_vehicle(manager,types.SimpleNamespace(vehicle='vehicle')))
        manager.metadata['entry']['fuel']='diesel';self.assertFalse(auto.electric_vehicle(manager,types.SimpleNamespace(vehicle='vehicle')))
    async def test_query_union_category_filter_and_pagination(self):
        calls=[]
        def place(key,category='교통 > 전기차 충전소',lat='37.5'):
            return {'id':key,'place_name':key,'category_name':category,'x':'127','y':lat}
        async def cached(key,service,path,params):
            calls.append((params['query'],params['page']))
            if params['query']=='전기차 충전소':return {'documents':[place('far',lat='37.51')],'meta':{'is_end':True}}
            if params['query']=='전기차충전소' and params['page']==1:return {'documents':[place('gas','LPG충전소')],'meta':{'is_end':False}}
            return {'documents':[place('near')],'meta':{'is_end':True}}
        station=Stations(None);station.cached=cached
        result=await station.nearby('charging',37.5,127)
        self.assertEqual(result['selected']['location']['station_id'],'near');self.assertEqual(len(result['candidates']),2);self.assertIn(('전기차충전소',2),calls)
    async def test_truncated_provider_results_never_auto_select(self):
        station=Stations(None)
        async def cached(*args):return {'documents':[{'id':'near','place_name':'near','category_name':'전기차 충전소','x':'127','y':'37.5'}],'meta':{'is_end':False}}
        station.cached=cached;self.assertIsNone((await station.nearby('charging',37.5,127))['selected'])

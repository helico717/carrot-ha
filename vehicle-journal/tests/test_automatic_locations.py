"""Synthetic parking continuity, vehicle scope and provider coverage regressions."""
import asyncio
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from uuid import uuid4
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


class AddressFallbackTests(unittest.IsolatedAsyncioTestCase):
    def station(self,address_hit=True):
        station=Stations(None)
        async def cached(key,service,path,params,ttl=900):
            if path=='geo/coord2address.json':return {'documents':[{'road_address':{'address_name':'충남 태안군 안면읍 장곡길 1','building_name':''},'address':{'address_name':'lot'}}]}
            if path=='search/address.json':return {'documents':[{'x':'126.3','y':'36.5'}] if address_hit else []}
            raise AssertionError(path)
        station.cached=cached;return station
    async def test_address_location_uses_geocoded_coordinate_not_gps(self):
        place=await self.station().address_location(36.50012,126.30009)
        self.assertEqual((place['latitude'],place['longitude']),(36.5,126.3))
        self.assertEqual((place['selection_source'],place['address'],place['name']),('automatic_address','충남 태안군 안면읍 장곡길 1','충남 태안군 안면읍 장곡길 1'))
        self.assertNotIn('station_id',place);Journal.validate_location(place)
    async def test_address_location_without_geocode_is_not_saved(self):
        self.assertIsNone(await self.station(False).address_location(36.5,126.3))
    async def test_geocoded_address_far_from_gps_is_rejected(self):
        station=self.station()
        self.assertIsNone(await station.address_location(37.5,127.0))
    async def test_ambiguous_and_far_reasons(self):
        station=Stations(None)
        def doc(key,lat):return {'id':key,'place_name':key,'category_name':'교통 > 전기차 충전소','x':'127','y':lat}
        async def cached(key,service,path,params,ttl=900):return {'documents':[doc('a','37.5'),doc('b','37.50005')],'meta':{'is_end':True}}
        station.cached=cached;self.assertEqual((await station.nearby('charging',37.5,127))['reason'],'ambiguous')
        async def far(key,service,path,params,ttl=900):return {'documents':[doc('a','37.51')],'meta':{'is_end':True}}
        station.cached=far;self.assertEqual((await station.nearby('charging',37.5,127))['reason'],'far')

class AddressPropagationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.j=Journal(Path(self.tmp.name)/'j.db','entry','car','Asia/Seoul')
    def tearDown(self):self.tmp.cleanup()
    def test_address_only_charge_reaches_expense_and_trend_map(self):
        from custom_components.carrot_ha.vehicle_journal import station_stats
        address={'name':'장곡길 1','address':'장곡길 1','latitude':36.5,'longitude':126.3,'provider':'kakao','station_type':'charging','selection_source':'automatic_address'}
        now='2026-10-25T00:00:00+00:00'
        with self.j.lock,self.j.connect() as db:
            for rid,kind,origin,extra in (('c1','charge','automatic',{'location':address}),('c2','charge','automatic',{'location':dict(address,latitude=36.5)}),('x1','expense','automatic',{}),('x2','expense','automatic',{})):
                db.execute("INSERT INTO records(vehicle_id,id,kind,origin,source_kind,source_id,source_fingerprint,extra_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",(self.j.vehicle,rid,kind,origin,'t',rid,rid,json.dumps(extra),now,now))
            for rid,start in (('c1','2026-10-25T03:00:00+00:00'),('c2','2026-10-25T04:00:00+00:00')):
                db.execute("INSERT INTO mobility(vehicle_id,record_id,started_at,ended_at,battery_charge_kwh) VALUES (?,?,?,?,5)",(self.j.vehicle,rid,start,start))
            for rid,krw in (('x1',1000),('x2',2000)):
                db.execute("INSERT INTO expenses(vehicle_id,record_id,accounting_date,category,actual_krw,payment_owner,payment_id,payment_version) VALUES (?,?,'2026-10-25','charging',?,'ha_charge_payment',?,1)",(self.j.vehicle,rid,krw,'p'+rid))
            db.execute("INSERT INTO expense_members VALUES (?,'x1','c1')",(self.j.vehicle,));db.execute("INSERT INTO expense_members VALUES (?,'x2','c2')",(self.j.vehicle,))
        auto.propagate(self.j)
        with self.j.connect() as db:
            for rid in ('x1','x2'):self.assertEqual(json.loads(db.execute("SELECT extra_json FROM records WHERE id=?",(rid,)).fetchone()[0])['location']['address'],'장곡길 1')
            facts=station_stats.facts(db,self.j.vehicle,'2026-10-01','2026-10-31')
        self.assertEqual(facts['unlocated_records'],0);self.assertEqual(len(facts['places']),1)
        place=facts['places'][0];self.assertEqual((place['visits'],place['actual_krw'],place['address_only']),(2,3000,True))
        self.assertEqual((place['location']['latitude'],place['location']['longitude']),(36.5,126.3))
    def test_place_filter_returns_the_records_behind_the_map_place(self):
        self.test_address_only_charge_reaches_expense_and_trend_map()
        found=self.j.query('2026-10-01','2026-10-31',place='address:장곡길 1')
        self.assertEqual({r['id'] for r in found['records']},{'x1','x2'})
        self.assertEqual(self.j.query('2026-10-01','2026-10-31',place='kakao:none')['records'],[])
        self.assertEqual(self.j.query('2026-11-01','2026-11-30',place='address:장곡길 1')['records'],[])
    def test_place_filter_rejects_bad_value(self):
        for bad in ('',7,'x'*401):
            with self.assertRaises(ValueError):self.j.query('2026-10-01','2026-10-31',place=bad)
    def test_unit_price_is_whole_won_per_kwh_or_litre(self):
        self.test_address_only_charge_reaches_expense_and_trend_map()
        rows={r['id']:r for r in self.j.query('2026-10-01','2026-10-31')['records']}
        self.assertEqual(rows['x1']['unit_price'],{'krw':200,'unit':'kWh','approximate':True})
        self.assertEqual(rows['x2']['unit_price'],{'krw':400,'unit':'kWh','approximate':True})
        fuel=str(uuid4());wash=str(uuid4());billed=str(uuid4())
        self.j.save_manual(fuel,0,{'kind':'expense','date':'2026-10-20','category':'refueling','actual_krw':50000,'fuel_liters':30,'unit_price_krw':1700})
        self.j.save_manual(wash,0,{'kind':'expense','date':'2026-10-20','category':'washing','actual_krw':9000})
        self.j.save_manual(billed,0,{'kind':'expense','date':'2026-10-20','category':'charging','actual_krw':10000,'billed_charge_kwh':32})
        rows={r['id']:r for r in self.j.query('2026-10-01','2026-10-31')['records']}
        self.assertEqual(rows[fuel]['unit_price'],{'krw':1667,'unit':'L','approximate':False})
        self.assertEqual(rows[billed]['unit_price'],{'krw':313,'unit':'kWh','approximate':False})
        self.assertNotIn('unit_price',rows[wash])


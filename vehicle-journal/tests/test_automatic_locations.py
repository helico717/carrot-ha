"""Synthetic parking continuity, vehicle scope and provider coverage regressions."""
import asyncio
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import sys
import tempfile
import time
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
    async def test_dense_area_still_selects_a_lone_nearby_charger(self):
        """More than 45 results, but everything unseen is beyond the last returned (distance-sorted) place."""
        def doc(key,lat):return {'id':key,'place_name':key,'category_name':'교통 > 전기차 충전소','x':'127','y':lat}
        async def cached(key,service,path,params):
            if params['page']==1:return {'documents':[doc('near','37.5')]+[doc(f'f{i}','37.505') for i in range(14)],'meta':{'is_end':False}}
            return {'documents':[doc(f'f{params["page"]}{i}','37.51') for i in range(15)],'meta':{'is_end':False}}
        station=Stations(None);station.cached=cached
        result=await station.nearby('charging',37.5,127)
        self.assertEqual(result['selected']['location']['station_id'],'near')
        # Truncated while the last returned place is still close: an unseen nearer/ambiguous one is possible.
        async def close(key,service,path,params):return {'documents':[doc('near','37.5')]+[doc(f'c{params["page"]}{i}','37.5001') for i in range(14)],'meta':{'is_end':False}}
        station.cached=close;self.assertEqual((await station.nearby('charging',37.5,127))['reason'],'incomplete')


class ChunkedResponse:
    """aiohttp-like body that arrives in pieces; read(n) returns only the first piece like StreamReader."""
    def __init__(self,chunks,status=200):self.status=status;self.chunks=chunks;self.content=self
    async def __aenter__(self):return self
    async def __aexit__(self,*args):return False
    async def read(self,n=-1):return self.chunks[0]
    async def iter_chunked(self,size):
        for chunk in self.chunks:yield chunk


class ProviderBodyTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        helpers=types.ModuleType('homeassistant.helpers.aiohttp_client');self.reply=None
        helpers.async_get_clientsession=lambda hass:types.SimpleNamespace(get=lambda *a,**k:self.reply)
        self.mods={'homeassistant':types.ModuleType('homeassistant'),'homeassistant.helpers':types.ModuleType('homeassistant.helpers'),'homeassistant.helpers.aiohttp_client':helpers}
        sys.modules.update(self.mods)
        self.station=Stations(types.SimpleNamespace(kakao_rest_key='test',hass=None))
    def tearDown(self):
        for name in self.mods:sys.modules.pop(name,None)
    async def test_body_split_across_network_chunks_is_read_to_the_end(self):
        body=json.dumps({'documents':[{'id':str(i),'place_name':'충전소'*40} for i in range(15)],'meta':{'is_end':True}},ensure_ascii=False).encode()
        self.reply=ChunkedResponse([body[:2838],body[2838:]])
        self.assertEqual(len((await self.station.get('kakao','search/keyword.json',{}))['documents']),15)
    async def test_truncated_or_oversized_body_is_a_transient_provider_error(self):
        from custom_components.carrot_ha.vehicle_journal.stations import ProviderError
        for chunks in ([b'{"documents":[{"id":"1'],[b'x'*700000,b'x'*700000]):
            self.reply=ChunkedResponse(chunks)
            with self.assertRaises(ProviderError):await self.station.get('kakao','search/keyword.json',{})
        self.reply=ChunkedResponse([b'{}'],status=500)
        with self.assertRaises(ProviderError):await self.station.get('kakao','search/keyword.json',{})


class TransientRetryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(ignore_cleanup_errors=True);self.a=Archive(Path(self.tmp.name)/'a.db');self.j=Journal(Path(self.tmp.name)/'j.db','entry','car','Asia/Seoul')
        start=datetime(2026,1,1,1,tzinfo=timezone.utc)
        self.a.put({'schema':1,'device_id':'car','event_id':'charge','kind':'charge','observed_at':(start+timedelta(hours=1)).isoformat(),'data':{'started_at':start.isoformat(),'ended_at':(start+timedelta(hours=1)).isoformat(),'energy_kwh':10,'duration_s':3600}})
        sync(self.a,self.j)
    def tearDown(self):self.tmp.cleanup()
    def lookup(self):
        with self.j.connect() as db:return json.loads(db.execute("SELECT extra_json FROM records WHERE kind='charge'").fetchone()[0])['location_lookup']
    async def run_enrich(self,nearby,address=None):
        from custom_components.carrot_ha.vehicle_journal.stations import ProviderError
        async def address_location(*a):return address
        manager=types.SimpleNamespace(automatic_locations=True,kakao_rest_key='test',entries=lambda:[{'vehicle_id':self.j.vehicle,'fuel':'electric'}],stations=types.SimpleNamespace(nearby=nearby,address_location=address_location))
        hass=types.SimpleNamespace(async_add_executor_job=lambda f,*a:asyncio.sleep(0,f(*a)))
        point={'latitude':37.5,'longitude':127.0,'accuracy_m':2}
        with patch.object(auto,'position',return_value=point):await auto.enrich(hass,manager,self.a,self.j)
        return ProviderError
    async def test_provider_failure_retries_soon_with_backoff_then_succeeds(self):
        async def broken(*a):
            from custom_components.carrot_ha.vehicle_journal.stations import ProviderError
            raise ProviderError('제공사 응답을 끝까지 확인하지 못했어요. 잠시 뒤 다시 조회할게요.')
        await self.run_enrich(broken);first=self.lookup()
        self.assertEqual(first['failures'],1);self.assertLess(first['retry_after']-time.time(),auto.RETRY_TRANSIENT+5)
        self.assertEqual(auto.pending(self.j),[])
        with self.j.connect() as db:
            extra=json.loads(db.execute("SELECT extra_json FROM records WHERE kind='charge'").fetchone()[0]);extra['location_lookup']['retry_after']=0
            db.execute("UPDATE records SET extra_json=? WHERE kind='charge'",(json.dumps(extra),))
        await self.run_enrich(broken);second=self.lookup()
        self.assertEqual(second['failures'],2);self.assertGreater(second['retry_after']-time.time(),auto.RETRY_TRANSIENT*2-5)
        with self.j.connect() as db:
            extra=json.loads(db.execute("SELECT extra_json FROM records WHERE kind='charge'").fetchone()[0]);extra['location_lookup']['retry_after']=0
            db.execute("UPDATE records SET extra_json=? WHERE kind='charge'",(json.dumps(extra),))
        place={'name':'근처 전기차충전소','address':'경기 의왕시 한밭들길 3','latitude':37.5,'longitude':127.0,'provider':'kakao','station_id':'1','station_type':'charging','selection_source':'automatic'}
        async def found(*a):return {'selected':{'location':place},'message':'가장 가까운 후보를 자동 선택했어요.','candidates':[]}
        await self.run_enrich(found)
        with self.j.connect() as db:extra=json.loads(db.execute("SELECT extra_json FROM records WHERE kind='charge'").fetchone()[0])
        self.assertEqual(extra['location']['station_id'],'1');self.assertNotIn('failures',extra['location_lookup'])
    def extra(self):
        with self.j.connect() as db:return json.loads(db.execute("SELECT extra_json FROM records WHERE kind='charge'").fetchone()[0])
    def expire(self):
        extra=self.extra();extra['location_lookup']['retry_after']=0
        with self.j.connect() as db:db.execute("UPDATE records SET extra_json=? WHERE kind='charge'",(json.dumps(extra),))
    async def test_provider_failure_keeps_road_address_then_upgrades_to_station(self):
        from custom_components.carrot_ha.vehicle_journal.stations import ProviderError
        address={'name':'경기 의왕시 한밭들길 3','address':'경기 의왕시 한밭들길 3','latitude':37.5,'longitude':127.0,'provider':'kakao','station_type':'charging','selection_source':'automatic_address'}
        async def broken(*a):raise ProviderError('제공사 응답을 끝까지 확인하지 못했어요. 잠시 뒤 다시 조회할게요.')
        await self.run_enrich(broken,address);extra=self.extra()
        self.assertEqual(extra['location']['address'],'경기 의왕시 한밭들길 3');self.assertEqual(extra['location_lookup']['failures'],1)
        self.assertIn('도로명 주소로 먼저 기록',extra['location_lookup']['message'])
        self.assertEqual(auto.pending(self.j),[]);self.expire();self.assertEqual(len(auto.pending(self.j)),1)
        place=dict(address,name='티스테이션 전기차충전소',station_id='1',selection_source='automatic')
        async def found(*a):return {'selected':{'location':place},'message':'가장 가까운 후보를 자동 선택했어요.','candidates':[]}
        await self.run_enrich(found,address);extra=self.extra()
        self.assertEqual(extra['location']['station_id'],'1');self.assertEqual(auto.pending(self.j),[])
        self.expire();self.assertEqual(auto.pending(self.j),[],'a settled station is never looked up again')
    async def test_every_unsettled_reason_falls_back_to_road_address_and_is_final(self):
        address={'name':'주소','address':'주소','latitude':37.5,'longitude':127.0,'provider':'kakao','station_type':'charging','selection_source':'automatic_address'}
        for reason in ('incomplete',None):
            with self.subTest(reason=reason):
                with self.j.connect() as db:db.execute("UPDATE records SET extra_json='{}' WHERE kind='charge'")
                async def unsettled(*a):return {'reason':reason,'selected':None,'candidates':[],'message':'x'}
                await self.run_enrich(unsettled,address);extra=self.extra()
                self.assertEqual(extra['location']['selection_source'],'automatic_address');self.assertNotIn('failures',extra['location_lookup'])
                self.expire();self.assertEqual(auto.pending(self.j),[])
    def test_records_parked_by_previous_lookup_version_are_retried(self):
        with self.j.connect() as db:db.execute("UPDATE records SET extra_json=? WHERE kind='charge'",(json.dumps({'location_lookup':{'version':3,'retry_after':time.time()+86400,'message':'Unterminated string'}}),))
        self.assertEqual(len(auto.pending(self.j)),1)


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


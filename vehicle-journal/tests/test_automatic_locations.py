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
    def diagnosis(self):return auto.gps_diagnosis(self.a,self.j,self.start.isoformat())
    def test_gps_diagnosis_names_the_rule_the_nearest_fix_broke(self):
        self.assertEqual(self.diagnosis(),('gps_no_samples',{'samples':0,'gps_samples':0}))
        self.a.put({'schema':1,'device_id':'car','event_id':'nogps','kind':'state','observed_at':self.start.isoformat(),'data':{'onroad':False}})
        self.assertEqual(self.diagnosis()[0],'gps_missing')
        for change,code in (({'onroad':True},'gps_moving'),({'gps':{'speedMps':2.8}},'gps_moving'),({'gps':{'accuracyM':180}},'gps_inaccurate'),({'gps':{'fresh':False}},'gps_stale')):
            with self.subTest(code=code,change=change):
                self.clear();self.state(-5,**change);code_found,evidence=self.diagnosis()
                self.assertEqual(code_found,code);self.assertEqual(evidence['nearest_gap_s'],-5);self.assertEqual(evidence['samples'],1)
        self.clear();self.state(0,-340);code,evidence=self.diagnosis()
        self.assertEqual(code,'gps_stale');self.assertEqual(evidence['measured_lag_s'],340)
        self.clear();self.state(-300);self.state(0,-300);code,evidence=self.diagnosis()
        self.assertEqual(code,'gps_parking_unverified');self.assertEqual(evidence['continuity_gap_s'],300)
        self.assertIsNone(self.position(),'diagnosis never relaxes the position rule')
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
        async def address_lookup(*a):return (address,None,{}) if address else (None,'no_result',{})
        manager=types.SimpleNamespace(automatic_locations=True,kakao_rest_key='test',entries=lambda:[{'vehicle_id':self.j.vehicle,'fuel':'electric'}],stations=types.SimpleNamespace(nearby=nearby,address_lookup=address_lookup))
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
    async def test_reason_codes_steps_and_evidence_are_stored(self):
        from custom_components.carrot_ha.vehicle_journal.stations import ProviderError
        async def broken(*a):raise ProviderError('제공사 응답을 끝까지 확인하지 못했어요.')
        await self.run_enrich(broken);lookup=self.lookup()
        self.assertEqual((lookup['code'],lookup['station_code'],lookup['address_reason']),('address_failed','provider_error','no_result'))
        self.assertEqual(lookup['steps'],{'gps':'ok','station':'fail','address':'fail'});self.assertEqual(lookup['provider'],'제공사 응답을 끝까지 확인하지 못했어요.')
        self.assertEqual((lookup['version'],lookup['attempts']),(auto.LOOKUP_VERSION,1));self.assertEqual(lookup['evidence']['accuracy_m'],2)
        self.expire();await self.run_enrich(broken);self.assertEqual(self.lookup()['attempts'],2)
        with self.j.connect() as db:db.execute("UPDATE records SET extra_json='{}' WHERE kind='charge'")
        address={'name':'주소','address':'주소','latitude':37.5,'longitude':127.0,'provider':'kakao','station_type':'charging','selection_source':'automatic_address'}
        near=[{'location':{'name':n},'distance_m':d} for n,d in (('A',41.2),('B',53.7))]
        async def ambiguous(*a):return {'reason':'ambiguous','selected':None,'candidates':near,'message':'x'}
        await self.run_enrich(ambiguous,address);lookup=self.lookup()
        self.assertEqual((lookup['code'],lookup['steps']),('station_ambiguous',{'gps':'ok','station':'warn','address':'ok'}))
        self.assertEqual(lookup['candidates'],[{'name':'A','distance_m':41},{'name':'B','distance_m':54}])
    async def test_gps_failure_stores_diagnosis_without_provider_calls(self):
        async def never(*a):raise AssertionError('no provider call without a verified GPS fix')
        manager=types.SimpleNamespace(automatic_locations=True,kakao_rest_key='test',entries=lambda:[{'vehicle_id':self.j.vehicle,'fuel':'electric'}],stations=types.SimpleNamespace(nearby=never,address_lookup=never))
        hass=types.SimpleNamespace(async_add_executor_job=lambda f,*a:asyncio.sleep(0,f(*a)))
        await auto.enrich(hass,manager,self.a,self.j);lookup=self.lookup()
        self.assertEqual((lookup['code'],lookup['steps']['gps'],lookup['evidence']['samples']),('gps_no_samples','fail',0))
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



class DiagnosticQueryTests(unittest.TestCase):
    """The ledger query explains charging expenses whose linked automatic charge has no settled station."""
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(ignore_cleanup_errors=True);self.j=Journal(Path(self.tmp.name)/'j.db','entry','car','Asia/Seoul')
    def tearDown(self):self.tmp.cleanup()
    def add(self,suffix,extra,expense_extra=None):
        now='2026-10-25T00:00:00+00:00'
        with self.j.lock,self.j.connect() as db:
            for rid,kind,data in (('c'+suffix,'charge',extra),('x'+suffix,'expense',expense_extra or {})):
                db.execute("INSERT INTO records(vehicle_id,id,kind,origin,source_kind,source_id,source_fingerprint,extra_json,created_at,updated_at) VALUES (?,?,?,'automatic','t',?,?,?,?,?)",(self.j.vehicle,rid,kind,rid,rid,json.dumps(data),now,now))
            db.execute("INSERT INTO mobility(vehicle_id,record_id,started_at,ended_at,battery_charge_kwh) VALUES (?,?,'2026-10-25T03:00:00+00:00','2026-10-25T04:00:00+00:00',5)",(self.j.vehicle,'c'+suffix))
            db.execute("INSERT INTO expenses(vehicle_id,record_id,accounting_date,category,actual_krw,payment_owner,payment_id,payment_version) VALUES (?,?,'2026-10-25','charging',1000,'ha_charge_payment',?,1)",(self.j.vehicle,'x'+suffix,'p'+suffix))
            db.execute("INSERT INTO expense_members VALUES (?,?,?)",(self.j.vehicle,'x'+suffix,'c'+suffix))
    def rows(self):return {r['id']:r for r in self.j.query('2026-10-01','2026-10-31')['records']}
    def test_states(self):
        station={'name':'충전소','address':'a','latitude':37.5,'longitude':127.0,'provider':'kakao','station_id':'1','station_type':'charging','selection_source':'automatic'}
        address={'name':'주소','address':'주소','latitude':37.5,'longitude':127.0,'provider':'kakao','station_type':'charging','selection_source':'automatic_address'}
        lookup={'version':5,'code':'gps_moving','steps':{'gps':'fail','station':'skip','address':'skip'},'evidence':{'samples':3},'retry_after':9,'attempted_at':8,'attempts':1,'message':'m'}
        self.add('1',{'location_lookup':lookup})
        self.add('2',{'location':address,'location_lookup':{**lookup,'code':'station_far','candidates':['옛 후보']}},{'location':address})
        self.add('3',{'location':address,'location_lookup':{**lookup,'code':'provider_error','failures':2}},{'location':address})
        self.add('4',{})
        self.add('5',{'location':station,'location_lookup':lookup},{'location':station})
        self.add('6',{'location_lookup':{'version':3,'retry_after':9,'message':'옛 안내'}})
        self.add('7',{'location_user_override':True})
        rows=self.rows()
        self.assertEqual({k:rows[k]['location_diagnostic']['state'] for k in ('x1','x2','x3','x4','x6')},{'x1':'failed','x2':'address','x3':'address','x4':'pending','x6':'failed'})
        failed=rows['x1']['location_diagnostic']
        self.assertEqual((failed['code'],failed['steps']['gps'],failed['retry_after'],failed['charge_started_at']),('gps_moving','fail',9,'2026-10-25T03:00:00+00:00'))
        self.assertEqual(rows['x2']['location_diagnostic']['candidates'],[{'name':'옛 후보'}])
        self.assertIsNone(rows['x2']['location_diagnostic']['retry_after'],'a final road address is not looked up again')
        self.assertTrue(rows['x3']['location_diagnostic']['provisional']);self.assertEqual(rows['x3']['location_diagnostic']['retry_after'],9)
        self.assertEqual((rows['x6']['location_diagnostic']['code'],rows['x6']['location_diagnostic']['message']),('legacy','옛 안내'))
        for key in ('x5','x7'):self.assertNotIn('location_diagnostic',rows[key])
        for key in ('c1','c4'):self.assertNotIn('location_diagnostic',rows.get(key,{}))
    def test_setup_issue(self):
        journal=types.SimpleNamespace(vehicle='v')
        def manager(**changes):
            base=dict(automatic_locations=True,kakao_rest_key='k',entries=lambda:[{'vehicle_id':'v','fuel':'electric'}]);base.update(changes);return types.SimpleNamespace(**base)
        self.assertIsNone(auto.setup_issue(manager(),journal))
        self.assertEqual(auto.setup_issue(manager(automatic_locations=False),journal),'disabled')
        self.assertEqual(auto.setup_issue(manager(kakao_rest_key=''),journal),'no_kakao_key')
        self.assertEqual(auto.setup_issue(manager(entries=lambda:[{'vehicle_id':'v','fuel':'diesel'}]),journal),'not_electric')

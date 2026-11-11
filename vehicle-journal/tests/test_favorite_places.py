"""Favorite chargers: registration, anchors, automatic naming and backfill (synthetic data only)."""
import asyncio
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
pkg=types.ModuleType('custom_components.carrot_ha');pkg.__path__=['custom_components/carrot_ha']
sys.modules.setdefault('custom_components',types.ModuleType('custom_components'))
sys.modules.setdefault('custom_components.carrot_ha',pkg)
from custom_components.carrot_ha.vehicle_journal import automatic_locations as auto
from custom_components.carrot_ha.vehicle_journal.store import Journal,Conflict
from custom_components.carrot_ha.storage import Archive
from custom_components.carrot_ha.vehicle_journal.source import sync

ADDRESS='경기 테스트시 합성로 1'
ROAD={'name':ADDRESS,'address':ADDRESS,'latitude':37.5,'longitude':127.0,'provider':'kakao','station_type':'charging','selection_source':'automatic_address'}
CHARGER={'name':'합성단지B 전기차충전소','address':ADDRESS,'latitude':37.5003,'longitude':127.0,'provider':'kakao','station_id':'77','station_type':'charging','selection_source':'manual'}
POINT={'latitude':37.5,'longitude':127.0,'accuracy_m':2}


class FavoriteTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.a=Archive(Path(self.tmp.name)/'a.db');self.j=Journal(Path(self.tmp.name)/'j.db','entry','car','Asia/Seoul')
        self.start=datetime(2026,1,1,1,tzinfo=timezone.utc);self.count=0
    def tearDown(self):
        try:self.tmp.cleanup()
        except OSError:pass
    def charge(self,hours=0):
        start=self.start+timedelta(hours=hours);self.count+=1
        self.a.put({'schema':1,'device_id':'car','event_id':'charge%d'%self.count,'kind':'charge','observed_at':(start+timedelta(hours=1)).isoformat(),'data':{'started_at':start.isoformat(),'ended_at':(start+timedelta(hours=1)).isoformat(),'energy_kwh':10.04999,'duration_s':3600}})
        sync(self.a,self.j)
    def charges(self):
        with self.j.connect() as db:
            return [(key,json.loads(text)) for key,text in db.execute("SELECT r.id,r.extra_json FROM records r JOIN mobility m ON m.vehicle_id=r.vehicle_id AND m.record_id=r.id WHERE r.kind='charge' ORDER BY m.started_at")]
    def enrich(self,nearby=None,address=ROAD,point=POINT):
        calls=[]
        async def unsettled(*a):calls.append('nearby');return {'reason':'ambiguous','selected':None,'candidates':[],'message':'x'}
        async def lookup(*a):calls.append('address');return (address,None,{}) if address else (None,'no_result',{})
        manager=types.SimpleNamespace(automatic_locations=True,kakao_rest_key='test',entries=lambda:[{'vehicle_id':self.j.vehicle,'fuel':'electric'}],stations=types.SimpleNamespace(nearby=nearby or unsettled,address_lookup=lookup))
        hass=types.SimpleNamespace(async_add_executor_job=lambda f,*a:asyncio.sleep(0,f(*a)))
        async def run():
            with patch.object(auto,'position',return_value=dict(point) if point else None):await auto.enrich(hass,manager,self.a,self.j)
        asyncio.run(run());return calls

    def test_address_only_then_favorite_names_the_next_charge_without_provider_calls(self):
        self.charge();self.enrich();key,extra=self.charges()[0]
        self.assertEqual(extra['location']['selection_source'],'automatic_address')
        saved=self.j.save_favorite(CHARGER,key);self.assertEqual(saved['anchors'],1);self.assertEqual(saved['applied'],0)
        self.charge(24);calls=self.enrich();extra=self.charges()[1][1]
        self.assertEqual(calls,[],'a learned parking spot needs no provider lookup')
        self.assertEqual(extra['location']['name'],CHARGER['name']);self.assertEqual(extra['location']['selection_source'],'favorite')
        self.assertEqual(extra['location_lookup']['code'],'favorite_selected')
        self.assertEqual(auto.pending(self.j),[],'a favorite is final, never looked up again')
        self.assertIsNone(auto.describe(extra,self.start.isoformat()))

    def test_favorite_without_anchor_replaces_address_only_result_but_not_a_settled_station(self):
        self.j.save_favorite(CHARGER)
        self.charge();calls=self.enrich();extra=self.charges()[0][1]
        self.assertEqual(calls,['nearby','address']);self.assertEqual(extra['location']['selection_source'],'favorite')
        self.assertEqual(extra['location_lookup']['station_code'],'station_ambiguous')
        other={'name':'다른 충전소','address':'다른 주소','latitude':37.5,'longitude':127.0,'provider':'kakao','station_id':'1','station_type':'charging','selection_source':'automatic'}
        async def found(*a):return {'selected':{'location':other},'message':'ok','candidates':[]}
        self.charge(24);self.enrich(found)
        self.assertEqual(self.charges()[1][1]['location']['station_id'],'1')

    def test_far_or_competing_favorites_are_not_applied(self):
        self.j.save_favorite(dict(CHARGER,latitude=37.6,address='먼 주소'))
        self.charge();self.enrich()
        self.assertEqual(self.charges()[0][1]['location']['selection_source'],'automatic_address')
        favorites=[{'location':dict(CHARGER,name='A'),'anchors':[{'latitude':37.5,'longitude':127.0}]},{'location':dict(CHARGER,name='B',station_id='78'),'anchors':[{'latitude':37.5001,'longitude':127.0}]}]
        self.assertIsNone(auto.favorite_match(favorites,POINT,anchors_only=True))
        favorites[1]['anchors']=[{'latitude':37.5004,'longitude':127.0}]
        self.assertEqual(auto.favorite_match(favorites,POINT,anchors_only=True)['location']['name'],'A')

    def test_backfill_names_address_only_charges_and_keeps_user_choices(self):
        for hours in (0,24,48):self.charge(hours)
        for _ in range(2):self.enrich()
        rows=self.charges();self.assertTrue(all(e['location']['selection_source']=='automatic_address' for _,e in rows))
        manual=dict(CHARGER,name='직접 고른 곳',station_id='5')
        with self.j.connect() as db:version=db.execute('SELECT version FROM records WHERE id=?',(rows[2][0],)).fetchone()[0]
        self.j.change_location(rows[2][0],version,manual)
        saved=self.j.save_favorite(CHARGER,rows[0][0],apply_past=True);self.assertEqual(saved['applied'],2)
        rows=self.charges()
        self.assertEqual([e['location']['name'] for _,e in rows],[CHARGER['name'],CHARGER['name'],'직접 고른 곳'])
        self.assertEqual(self.j.save_favorite(CHARGER,rows[0][0],apply_past=True)['applied'],0)

    def test_same_place_updates_instead_of_duplicating_and_delete(self):
        first=self.j.save_favorite(CHARGER);second=self.j.save_favorite(dict(CHARGER,name='새 이름'))
        self.assertEqual(first['id'],second['id']);favorites=self.j.favorites()
        self.assertEqual(len(favorites),1);self.assertEqual(favorites[0]['location']['name'],'새 이름');self.assertNotIn('selection_source',favorites[0]['location'])
        self.j.remove_favorite(first['id']);self.assertEqual(self.j.favorites(),[])
        with self.assertRaises(Conflict):self.j.remove_favorite(first['id'])

    def test_validation(self):
        for bad in ({'name':''},{'name':'이름만'},{'name':'x','latitude':1},{'name':'x','address':'a','selection_source':'nope'}):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):self.j.save_favorite(bad)



if __name__=='__main__':unittest.main()

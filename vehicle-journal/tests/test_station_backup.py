import asyncio
from datetime import datetime,timedelta
from pathlib import Path
import json
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
from uuid import uuid4
from zoneinfo import ZoneInfo
pkg=types.ModuleType('custom_components.carrot_ha');pkg.__path__=['custom_components/carrot_ha']
sys.modules.setdefault('custom_components',types.ModuleType('custom_components'));sys.modules.setdefault('custom_components.carrot_ha',pkg)
from custom_components.carrot_ha.vehicle_journal.store import Journal
from custom_components.carrot_ha.vehicle_journal.snapshots import export_snapshot
from custom_components.carrot_ha.vehicle_journal.nas_backup import ManagedStore,verify,network_path
from custom_components.carrot_ha.vehicle_journal.stations import Stations
from custom_components.carrot_ha.vehicle_journal import automatic_locations as auto
from custom_components.carrot_ha.storage import Archive
from custom_components.carrot_ha.vehicle_journal.source import sync

class FactsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.j=Journal(Path(self.temp.name)/'journal.db','entry','car','Asia/Seoul')
    def tearDown(self):self.temp.cleanup()
    def fuel(self,d,odo,liters,full=True,estimated=False):
        p={'kind':'expense','date':d,'category':'refueling','actual_krw':int((liters or 0)*1800),'odometer_km':odo,'full_tank':full,'fuel_quantity_source':'estimated' if estimated else 'reported','location':{'name':'Station A','provider':'opinet','station_id':'A','latitude':37.5,'longitude':127.0}}
        if liters is not None:p['fuel_liters']=liters
        return self.j.save_manual(str(uuid4()),0,p)
    def test_full_intervals_partial_and_weighted_average(self):
        self.fuel('2026-01-01',1000,60);self.fuel('2026-01-05',1200,10,False);self.fuel('2026-01-10',2000,40);self.fuel('2026-01-20',2300,30,estimated=True)
        q=self.j.query('2026-01-01','2026-01-31');e=q['efficiency_facts'];self.assertEqual(e['selected']['distance_km'],1300);self.assertEqual(e['selected']['fuel_liters'],80);self.assertEqual(e['selected']['efficiency_km_l'],16.25);self.assertTrue(e['overall']['estimated']);self.assertEqual(e['intervals'][0]['partial_count'],1)
        g=q['station_stats']['places'][0];self.assertEqual(g['visits'],4);self.assertEqual(g['fuel_liters'],140);self.assertEqual(g['fuel_average_krw'],1800)
    def test_incomplete_and_same_day_full_not_fabricated(self):
        self.fuel('2026-02-01',1000,50);self.fuel('2026-02-05',1100,None,False);self.fuel('2026-02-10',1500,30);self.fuel('2026-02-10',1600,10)
        q=self.j.query('2026-02-01','2026-02-28');self.assertIsNone(q['efficiency_facts']['selected']['efficiency_km_l']);self.assertTrue(q['efficiency_facts']['warnings'])
    def test_snapshot_roundtrip_location_and_quantities(self):
        self.fuel('2026-01-01',1000,40);meta={'vehicle_id':self.j.vehicle,'device_id':'car','title':'Synthetic','fuel':'diesel','timezone':'Asia/Seoul'}
        self.content=export_snapshot(self.j,meta);self.assertTrue(verify(self.content)['restored'])
        directory=Path(self.temp.name)/'vehicle-journal';store=ManagedStore(directory);clock=datetime(2026,1,1,3,tzinfo=ZoneInfo('Asia/Seoul'))
        result=store.write_run([('entry',self.content)],clock);self.assertTrue(result['restore_verified']);name=next(iter(store.load()['objects']));self.assertEqual(store.read(name),self.content)
        (directory/name).write_bytes(b'corrupt')
        with self.assertRaises(ValueError):store.read(name)
    def test_gfs_and_failed_run_keep_existing_index(self):
        self.fuel('2026-01-01',1000,40);content=export_snapshot(self.j,{'vehicle_id':self.j.vehicle,'device_id':'car','title':'Synthetic','fuel':'diesel','timezone':'Asia/Seoul'})
        directory=Path(self.temp.name)/'vehicle-journal';store=ManagedStore(directory)
        # Retention logic uses real verified first snapshot, then synthetic repetition of that proof.
        proof=verify(content)
        with patch('custom_components.carrot_ha.vehicle_journal.nas_backup.verify',return_value=proof):
            for day in range(0,400,3):store.write_run([('entry',content)],datetime(2025,1,1,3,tzinfo=ZoneInfo('Asia/Seoul'))+timedelta(days=day))
        index=store.load();self.assertEqual([len(index['generations'][k]) for k in ('daily','weekly','monthly')],[7,4,12]);before=(directory/'index.json').read_bytes()
        with self.assertRaises(ValueError):store.write_run([('entry',b'bad')],datetime.now(ZoneInfo('Asia/Seoul')))
        self.assertEqual((directory/'index.json').read_bytes(),before)
        unrelated=directory/'ha-backup.tar';unrelated.write_bytes(b'keep')
        with patch('custom_components.carrot_ha.vehicle_journal.nas_backup.verify',return_value=proof):store.write_run([('entry',content)],datetime(2027,1,1,3,tzinfo=ZoneInfo('Asia/Seoul')))
        self.assertEqual(unrelated.read_bytes(),b'keep')
    def test_path_rejects_local_and_unowned_directory(self):
        with self.assertRaises(ValueError):network_path('/tmp/vehicle-journal')
        directory=Path(self.temp.name)/'occupied';directory.mkdir();(directory/'HA.tar').write_bytes(b'keep')
        with self.assertRaises(ValueError):ManagedStore(directory).load()
    def test_automatic_position_fee_unchanged_and_user_override(self):
        archive=Archive(Path(self.temp.name)/'archive.db')
        archive.put({'schema':1,'device_id':'car','event_id':'state1','kind':'state','observed_at':'2026-01-01T01:00:00+00:00','data':{'gps':{'latitude':37.5,'longitude':127.0,'accuracyM':5}}})
        archive.put({'schema':1,'device_id':'car','event_id':'charge1','kind':'charge','observed_at':'2026-01-01T02:00:00+00:00','data':{'started_at':'2026-01-01T01:00:00+00:00','ended_at':'2026-01-01T02:00:00+00:00','duration_s':3600,'energy_kwh':10,'cost_krw':3000,'can_mode':4}})
        sync(archive,self.j);before=self.j.query('2026-01-01','2026-01-31')['totals']['charge_effective_krw'];item=auto.pending(self.j)[0];point=auto.position(archive,self.j,item[3]);self.assertIsNotNone(point)
        location={'name':'Charger','latitude':37.5,'longitude':127.0,'provider':'kakao','station_id':'42','station_type':'charging','selection_source':'automatic'}
        self.assertTrue(auto.save(self.j,item,point,location,'ok'));auto.propagate(self.j)
        after=self.j.query('2026-01-01','2026-01-31');self.assertEqual(after['totals']['charge_effective_krw'],before);self.assertEqual(after['recent_records'][0]['location']['name'],'Charger');self.assertEqual(after['station_stats']['places'][0]['battery_kwh'],10)
        rid,ver=item[:2];self.j.change_location(rid,ver+1,None);self.assertEqual(auto.pending(self.j),[])

class ProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_ev_nearest_and_no_station_tariff(self):
        station=Stations(types.SimpleNamespace())
        async def cached(*args,**kw):return {'documents':[{'id':'far','place_name':'Far','x':'127','y':'37.5','distance':'1000'},{'id':'near','place_name':'Near','x':'127','y':'37.5','distance':'10'}]}
        station.cached=cached;r=await station.nearby('charging',37.5,127);self.assertEqual(r['selected']['location']['station_id'],'near');self.assertIsNone(r['selected']['unit_price_krw']);self.assertEqual(r['selected']['price_basis'],'existing_ev_tariff')

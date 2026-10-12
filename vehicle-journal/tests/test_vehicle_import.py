"""Synthetic imports, durable vehicle lifecycle, snapshots and schema upgrade."""
import asyncio
from copy import deepcopy
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace
import unittest
from uuid import uuid4
from zipfile import ZipFile,ZIP_DEFLATED
from test_journal import Journal,Archive,sync
from custom_components.carrot_ha.vehicle_journal.importers import michael_preview
from custom_components.carrot_ha.vehicle_journal.vehicles import Vehicles
from custom_components.carrot_ha.vehicle_journal.snapshots import export_snapshot,snapshot_preview,restore_snapshot,restore_source


def sample_xlsx():
    stream=BytesIO()
    with ZipFile(stream,'w',ZIP_DEFLATED) as z:
        z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="주유" r:id="r1"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
        rows=[['날짜','구분','금액(￦)','주유량(L)',' 장소명','메모'],['2025.10.01','가득주유','42000','25','시험 주유소','메모'],['2025.10.02','가득주유','0','0','','']]
        xml=[]
        for r,row in enumerate(rows,1):
            xml.append(f'<row r="{r}">'+''.join(f'<c r="{chr(65+c)}{r}" t="inlineStr"><is><t>{v}</t></is></c>' for c,v in enumerate(row))+'</row>')
        z.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(xml)+'</sheetData></worksheet>')
    return stream.getvalue()


class StorageTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'journal.sqlite3';self.j=Journal(self.path,'entry','car','Asia/Seoul')
    def tearDown(self):self.tmp.cleanup()
    def test_import_replay_zero_and_location(self):
        plan=michael_preview(sample_xlsx(),'diesel')
        self.assertEqual(plan['summary']['total_krw'],42000)
        self.assertEqual(self.j.import_michael(plan['records']),{'imported':2,'skipped':0})
        self.assertEqual(self.j.import_michael(plan['records']),{'imported':0,'skipped':2})
        result=self.j.query('2025-10-01','2025-10-31')
        self.assertEqual(result['records'][0]['actual_krw'],0)
        self.assertEqual(result['records'][1]['location']['name'],'시험 주유소')
        self.assertEqual(result['totals']['distance_km'],None)
        record=result['records'][1]
        self.j.change_location(record['id'],record['version'],None)
        self.assertIsNone(self.j.query('2025-10-01','2025-10-31')['records'][1]['location'])
    def test_import_transaction_rollback(self):
        rows=michael_preview(sample_xlsx(),'diesel')['records'];rows[1]['payload']['category']='invalid'
        with self.assertRaises(sqlite3.IntegrityError):self.j.import_michael(rows)
        self.assertEqual(self.j.query('2025-10-01','2025-10-31')['record_count'],0)
    def test_snapshot_roundtrip_and_vehicle_identity(self):
        self.j.import_michael(michael_preview(sample_xlsx(),'diesel')['records'])
        meta={'vehicle_id':self.j.vehicle,'device_id':self.j.device,'title':'시험','fuel':'diesel','timezone':'Asia/Seoul','linked':False}
        content=export_snapshot(self.j,meta);plan=snapshot_preview(content)
        target=Journal(Path(self.tmp.name)/'new.sqlite3','new','car','Asia/Seoul')
        restore_snapshot(target,plan,'new','car')
        self.assertEqual(target.vehicle,self.j.vehicle)
        self.assertEqual(target.query('2025-10-01','2025-10-31')['totals'],self.j.query('2025-10-01','2025-10-31')['totals'])
        with target.connect() as db:self.assertEqual(db.execute('SELECT entry_id FROM vehicles').fetchone()[0],'new')
    def test_snapshot_checksum_and_path_rejected(self):
        content=export_snapshot(self.j,{'vehicle_id':self.j.vehicle,'device_id':'car'})
        for added in ('journal.json','../escape'):
            stream=BytesIO()
            with ZipFile(BytesIO(content)) as original,ZipFile(stream,'w') as corrupt:
                for name in original.namelist():
                    if name!=added:corrupt.writestr(name,original.read(name))
                corrupt.writestr(added,b'{}')
            with self.assertRaises(ValueError):snapshot_preview(stream.getvalue())
    def test_snapshot_original_payments(self):
        archive=Archive(Path(self.tmp.name)/'archive.sqlite3')
        archive.put({'schema':1,'device_id':'car','event_id':'charge','kind':'charge','observed_at':'2025-10-01T00:00:00Z','data':{'started_at':'2025-10-01T00:00:00Z','ended_at':'2025-10-01T01:00:00Z','energy_kwh':10,'cost_krw':3000}})
        sync(archive,self.j,True)
        plan=snapshot_preview(export_snapshot(self.j,{'vehicle_id':self.j.vehicle,'device_id':'car'},archive))
        fresh=Archive(Path(self.tmp.name)/'fresh.sqlite3');restore_source(fresh,plan['source_tables'],'car')
        with fresh.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM charge_summaries').fetchone()[0],1)
    def test_v1_upgrade_preserves_expenses(self):
        self.path.unlink()
        schema=Path('custom_components/carrot_ha/vehicle_journal/schema.sql').read_text().replace("'charging','refueling'","'charging'").replace('VALUES(2)','VALUES(1)')
        with sqlite3.connect(self.path) as db:
            db.executescript(schema)
            vehicle=str(uuid4());record=str(uuid4())
            db.execute('INSERT INTO vehicles VALUES (?,?,?,?,?,?)',(vehicle,'entry','car','Asia/Seoul','KRW','2025-10-01'))
            db.execute("INSERT INTO records(vehicle_id,id,kind,origin,created_at,updated_at) VALUES (?,?,'expense','manual',?,?)",(vehicle,record,'2025-10-01','2025-10-01'))
            db.execute("INSERT INTO expenses(vehicle_id,record_id,accounting_date,category,actual_krw,payment_owner) VALUES (?,?,?,'maintenance',9000,'journal')",(vehicle,record,'2025-10-01'))
            charge=str(uuid4())
            db.execute("INSERT INTO records(vehicle_id,id,kind,origin,created_at,updated_at) VALUES (?,?,'charge','manual',?,?)",(vehicle,charge,'2025-10-01','2025-10-01'))
            db.execute('INSERT INTO mobility(vehicle_id,record_id,started_at,ended_at) VALUES (?,?,?,?)',(vehicle,charge,'2025-10-01T00:00:00Z','2025-10-01T01:00:00Z'))
            db.execute('INSERT INTO expense_members VALUES (?,?,?)',(vehicle,record,charge))
        upgraded=Journal(self.path,'entry','car','Asia/Seoul')
        self.assertTrue(Path(str(self.path)+'.before-schema2.sqlite3').exists())
        with upgraded.connect() as db:
            self.assertEqual(db.execute('SELECT * FROM expense_members').fetchall(),[(vehicle,record,charge)])
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
        upgraded.save_manual(str(uuid4()),0,{'kind':'expense','date':'2025-10-01','category':'refueling','actual_krw':100})
        self.assertEqual(upgraded.query('2025-10-01','2025-10-31')['totals']['total_cost_krw'],9100)
    def test_location_validation_and_conflict(self):
        key=str(uuid4());self.j.save_manual(key,0,{'kind':'expense','date':'2025-10-01','category':'other','actual_krw':0})
        with self.assertRaises(ValueError):self.j.change_location(key,1,{'latitude':999,'longitude':2})
        saved=self.j.change_location(key,1,{'name':'시험','address':'주소','latitude':37.5,'longitude':127})
        with self.assertRaises(Exception):self.j.change_location(key,1,None)
        self.j.change_location(key,saved['version'],None)


class VehicleTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.data={};self.state=None
        async def executor(fn,*args):return await asyncio.to_thread(fn,*args)
        self.hass=SimpleNamespace(data={'carrot_ha':{}},config=SimpleNamespace(time_zone='Asia/Seoul',path=lambda *parts:str(Path(self.tmp.name).joinpath(*parts))),async_add_executor_job=executor)
        async def load():return deepcopy(self.state)
        async def save(state):self.state=deepcopy(state)
        self.store=SimpleNamespace(async_load=load,async_save=save);self.m=Vehicles(self.hass,self.store)
    async def asyncTearDown(self):self.tmp.cleanup()
    async def test_create_trash_restart_restore(self):
        result=await self.m.create('아테온','diesel','', 'admin');key=result['entry_id']
        self.assertEqual(len(self.m.entries()),1)
        await self.m.change(key,'아테온','diesel',True)
        self.assertEqual(self.m.entries(),[]);self.assertEqual(len(self.m.entries(True)),1)
        next_manager=Vehicles(self.hass,self.store);await next_manager.load()
        self.assertEqual(next_manager.entries(),[])
        await next_manager.change(key,'복원','diesel',False)
        self.assertEqual(next_manager.entries()[0]['title'],'복원')
    async def test_preview_owner_replay_and_duplicate_snapshot(self):
        preview=await self.m.preview(sample_xlsx(),'michael','diesel','admin')
        with self.assertRaises(ValueError):await self.m.create('차','diesel',preview['token'],'other')
        result=await self.m.create('차','diesel',preview['token'],'admin')
        self.assertEqual(result['imported'],2)
        self.assertEqual(await self.m.create('차','diesel',preview['token'],'admin'),result)
        content=await self.m.export(result['entry_id']);snapshot=await self.m.preview(content,'snapshot','diesel','admin')
        with self.assertRaises(ValueError):await self.m.create('중복','diesel',snapshot['token'],'admin')
    async def test_linked_metadata_only(self):
        j=Journal(Path(self.tmp.name)/'linked.sqlite3','linked','car','Asia/Seoul');archive=object()
        self.hass.data['carrot_ha']['linked']={'entry':SimpleNamespace(title='연동 차량'),'journal':j,'archive':archive}
        await self.m.change('linked','이름 변경','electric',True)
        self.assertIs(self.hass.data['carrot_ha']['linked']['archive'],archive)
        self.assertEqual(self.m.entries(),[])

class FailedVehicleVisibilityTests(unittest.TestCase):
    def test_failed_device_is_listed_instead_of_disappearing(self):
        hass=SimpleNamespace(data={'carrot_ha':{'entry':{'entry':SimpleNamespace(title='기존 차량'),'journal_error':'초기화 실패'}}})
        m=Vehicles(hass,None)
        entries=m.entries()
        self.assertEqual(len(entries),1)
        self.assertEqual(entries[0]['title'],'기존 차량')
        self.assertTrue(entries[0]['unavailable'])

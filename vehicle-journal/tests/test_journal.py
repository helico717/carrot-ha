import importlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import types
import unittest
from uuid import uuid4

pkg=types.ModuleType('custom_components.carrot_ha')
pkg.__path__=['custom_components/carrot_ha']
sys.modules.setdefault('custom_components',types.ModuleType('custom_components'))
sys.modules.setdefault('custom_components.carrot_ha',pkg)
from custom_components.carrot_ha.storage import Archive
from custom_components.carrot_ha.vehicle_journal.store import Journal, Conflict
from custom_components.carrot_ha.vehicle_journal.source import sync


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.archive=Archive(Path(self.tmp.name)/'archive.sqlite3')
        self.journal=Journal(Path(self.tmp.name)/'journal.sqlite3','entry','car','Asia/Seoul')

    def tearDown(self):self.tmp.cleanup()

    def event(self,kind,key,data):
        return {'schema':1,'device_id':'car','event_id':key,'kind':kind,'observed_at':'2026-09-01T15:30:00Z','data':data}

    def charge(self):
        return self.event('charge','charge1',{'started_at':'2026-09-01T14:30:00Z','ended_at':'2026-09-01T15:30:00Z',
                         'duration_s':3600,'energy_kwh':12,'cost_krw':3600,'can_mode':6})

    def test_backfill_replay_and_retention(self):
        self.archive.put(self.charge())
        self.archive.put(self.event('trip','trip1',{'started_at':'2026-09-01T14:30:00Z','ended_at':'2026-09-01T15:30:00Z','distance_m':60000}))
        self.assertTrue(sync(self.archive,self.journal))
        result=self.journal.query('2026-09-01','2026-09-30')
        self.assertEqual(result['totals']['distance_km'],60)
        self.assertEqual(result['totals']['battery_charge_kwh'],12)
        self.assertEqual(result['totals']['fast_count'],1)
        self.assertEqual(result['totals']['charge_effective_krw'],3600)
        self.assertIsNone(result['totals']['drive_energy_kwh'])
        self.assertEqual([r['distance_km'] for r in result['daily']],[30,30])
        sync(self.archive,self.journal,True)
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals'],result['totals'])
        self.archive.journal_guard=lambda:sync(self.archive,self.journal,True)
        self.archive.purge_expired(trip_days=0,charge_days=0,state_days=0)
        self.assertEqual(self.archive.history('car','trip'),[])
        sync(self.archive,self.journal)
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals']['distance_km'],60)

    def test_zero_payment_and_deletion(self):
        self.archive.put(self.charge())
        sync(self.archive,self.journal)
        group=self.archive.charge_history('car')[0]['data']
        self.archive.set_charge_payment('car',group['payment_id'],group['source_event_ids'],0,0)
        sync(self.archive,self.journal)
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals']['charge_effective_krw'],0)
        self.archive.delete_charge('car',group['payment_id'],group['source_event_ids'],1)
        sync(self.archive,self.journal)
        result=self.journal.query('2026-09-01','2026-09-30')
        self.assertIsNone(result['totals']['battery_charge_kwh'])
        self.assertIsNone(result['totals']['charge_effective_krw'])

    def test_manual_roundtrip_conflicts_and_restore(self):
        key=str(uuid4());payload={'kind':'expense','date':'2026-09-02','category':'maintenance','actual_krw':0,'memo':'와이퍼'}
        result=self.journal.save_manual(key,0,payload)
        self.assertEqual(self.journal.save_manual(key,0,payload),result)
        with self.assertRaises(Conflict):self.journal.save_manual(key,0,dict(payload,actual_krw=1))
        second=self.journal.save_manual(key,1,dict(payload,actual_krw=45000))
        self.assertEqual(second['version'],2)
        row=self.journal.query('2026-09-01','2026-09-30')['records'][0]
        self.assertEqual(row['input']['actual_krw'],45000)
        self.journal.change_status(key,2,'deleted')
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals']['total_cost_krw'],0)
        self.journal.change_status(key,3,'active')
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals']['total_cost_krw'],45000)

    def test_manual_charge_update_remove_cost(self):
        key=str(uuid4());payload={'kind':'charge','date':'2026-09-02','battery_charge_kwh':20,'charge_mode':'slow','actual_krw':5000}
        self.journal.save_manual(key,0,payload)
        totals=self.journal.query('2026-09-01','2026-09-30')['totals']
        self.assertEqual(totals['battery_charge_kwh'],20)
        self.assertEqual(totals['charge_effective_krw'],5000)
        payload.pop('actual_krw');self.journal.save_manual(key,1,payload)
        self.assertIsNone(self.journal.query('2026-09-01','2026-09-30')['totals']['charge_effective_krw'])

    def test_manual_validation(self):
        base={'kind':'trip','date':'2026-09-02','distance_km':10}
        for patch in ({'distance_km':float('nan')},{'distance_km':-1},{'date':'2026-02-30'},
                      {'date':'2099-01-01'},{'actual_krw':0.5},{'source_id':'fake'}):
            with self.assertRaises((ValueError,TypeError)):self.journal.save_manual(str(uuid4()),0,dict(base,**patch))
        with self.assertRaises(ValueError):self.journal.query('2026-09-02','2026-09-01')

    def test_record_filters_apply_before_pagination_without_changing_totals(self):
        for i in range(101):
            self.journal.save_manual(str(uuid4()),0,{'kind':'trip','date':'2026-09-03','distance_km':1})
        for category in ('charging','maintenance','washing'):
            self.journal.save_manual(str(uuid4()),0,{'kind':'expense','date':'2026-09-02','category':category,'actual_krw':1000})
        original=self.journal.query('2026-09-01','2026-09-30')
        hidden=self.journal.query('2026-09-01','2026-09-30',100,0,False,[])
        self.assertEqual(len(hidden['records']),3)
        self.assertFalse(hidden['has_more'])
        self.assertEqual(hidden['totals'],original['totals'])
        self.assertEqual(hidden['record_count'],original['record_count'])
        trip_page=self.journal.query('2026-09-01','2026-09-30',100,0,True,['trip'])
        self.assertTrue(trip_page['has_more'])
        self.assertEqual(len(trip_page['records']),100)
        self.assertEqual(len(self.journal.query('2026-09-01','2026-09-30',100,100,True,['trip'])['records']),1)
        selected=self.journal.query('2026-09-01','2026-09-30',100,0,False,['charging','maintenance'])
        self.assertEqual({r['category'] for r in selected['records']},{'charging','maintenance'})
        self.assertEqual(len(selected['recent_records']),3)
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30',100,0,False,['trip'])['records'],[])
        with self.assertRaises(ValueError):Journal(self.journal.path,'other-entry','other-car','Asia/Seoul')
        other=Journal(Path(self.tmp.name)/'other.sqlite3','other-entry','other-car','Asia/Seoul')
        self.assertEqual(other.query('2026-09-01','2026-09-30',100,0,True,['trip'])['records'],[])
        for include,filters in ((1,[]),(True,"charging"),(True,["bogus"]),(True,["charging' OR 1=1"])):
            with self.assertRaises(ValueError):self.journal.query('2026-09-01','2026-09-30',100,0,include,filters)

    def test_durable_outbox_and_failed_guard(self):
        self.archive.put(self.charge())
        with self.archive.connect() as db:
            generation,ack=db.execute('SELECT generation,acknowledged FROM journal_outbox').fetchone()
        self.assertGreater(generation,ack)
        def fail():raise OSError('simulated disk full')
        self.archive.journal_guard=fail
        with self.assertRaises(OSError):self.archive.purge_expired(charge_days=0)
        self.assertEqual(len(self.archive.history('car','charge')),1)
        sync(self.archive,self.journal)
        with self.archive.connect() as db:
            generation,ack=db.execute('SELECT generation,acknowledged FROM journal_outbox').fetchone()
        self.assertEqual(generation,ack)

    def test_dst_allocations_and_matched_efficiency(self):
        other=Journal(Path(self.tmp.name)/'dst.sqlite3','entry2','car2','America/New_York')
        key=str(uuid4())
        other.save_manual(key,0,{'kind':'trip','date':'2026-03-07','distance_km':100,'drive_energy_kwh':20,
                              'started_at':'2026-03-07T05:00:00Z','ended_at':'2026-03-09T04:00:00Z'})
        result=other.query('2026-03-07','2026-03-09')
        self.assertAlmostEqual(result['totals']['distance_km'],100)
        self.assertEqual(result['totals']['efficiency_km_kwh'],5)
        self.assertAlmostEqual(result['daily'][0]['distance_km'],100*24/47)
        self.assertAlmostEqual(result['daily'][1]['distance_km'],100*23/47)
        self.assertIsNone(result['daily'][0]['total_soc_used_pp'])

    def photo_functions(self):
        import ast
        from io import BytesIO
        from PIL import Image
        from custom_components.carrot_ha.vehicle_journal.store import now
        tree=ast.parse(Path('custom_components/carrot_ha/vehicle_journal/photos.py').read_text())
        tree.body=[n for n in tree.body if isinstance(n,ast.FunctionDef) or isinstance(n,ast.ImportFrom) and n.module in ('hashlib','io','pathlib','uuid')]
        namespace={'now':now}
        exec(compile(tree,'photos.py','exec'),namespace)
        return namespace,Image,BytesIO

    def test_photos_decode_metadata_and_privacy(self):
        ns,Image,BytesIO=self.photo_functions()
        key=str(uuid4());self.journal.save_manual(key,0,{'kind':'expense','date':'2026-09-02','category':'maintenance'})
        original=BytesIO();image=Image.new('RGB',(20,20),'red')
        exif=Image.Exif();exif[270]='private metadata'
        image.save(original,format='JPEG',exif=exif)
        photo=ns['save_photo'](self.journal,key,original.getvalue(),'../private.jpg')
        content,mime=ns['load_photo'](self.journal,photo['attachment_id'])
        with Image.open(BytesIO(content)) as cleaned:self.assertEqual(dict(cleaned.getexif()),{})
        self.assertEqual(mime,'image/jpeg')
        self.assertEqual(ns['save_photo'](self.journal,key,original.getvalue(),'again.jpg'),photo)
        self.journal.change_status(key,1,'deleted')
        with self.assertRaises(FileNotFoundError):ns['load_photo'](self.journal,photo['attachment_id'])
        with self.assertRaises((ValueError,OSError)):ns['save_photo'](self.journal,key,b'<script>bad</script>','file.jpg')

    def test_photo_limit_cleans_failed_file(self):
        ns,Image,BytesIO=self.photo_functions()
        key=str(uuid4());self.journal.save_manual(key,0,{'kind':'expense','date':'2026-09-02','category':'maintenance'})
        for index in range(6):
            output=BytesIO();Image.new('RGB',(20,20),(index*20,0,0)).save(output,format='PNG')
            if index<5:ns['save_photo'](self.journal,key,output.getvalue(),'photo.png')
            else:
                with self.assertRaises(sqlite3.IntegrityError):ns['save_photo'](self.journal,key,output.getvalue(),'photo.png')
        directory=Path(self.journal.path).with_suffix('')/'attachments'
        self.assertEqual(len(list(directory.iterdir())),5)

    def test_schema_packaging_identity(self):
        self.assertEqual(Path('vehicle-journal/schema/001_initial.sql').read_bytes(),
                         Path('custom_components/carrot_ha/vehicle_journal/schema.sql').read_bytes())


if __name__=='__main__':unittest.main(verbosity=2)

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

    def test_manual_odometer_record_reloads_in_linked_vehicle_ledger_and_limits_photos(self):
        key=str(uuid4());self.journal.save_manual(key,0,{'kind':'trip','date':'2026-01-01','odometer_km':123456.7})
        result=self.journal.query('2026-01-01','2026-01-31',include_trips=False,expenses_only=True,manual_records=True)
        record=next(r for r in result['records'] if r['id']==key)
        self.assertEqual(record['odometer_km'],123456.7);self.assertEqual(record['kind'],'trip')
        with self.journal.connect() as db:
            photo=str(uuid4());db.execute('INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?,?,?)',(self.journal.vehicle,photo,key,photo+'.png','synthetic.png','image/png',9,'a'*64,'active','2026-01-01'))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.journal.connect() as db:
                second=str(uuid4());db.execute('INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?,?,?)',(self.journal.vehicle,second,key,second+'.png','synthetic.png','image/png',9,'b'*64,'active','2026-01-01'))
        self.assertEqual(len(next(r for r in self.journal.query('2026-01-01','2026-01-31')['records'] if r['id']==key)['attachments']),1)

    def test_saved_photo_removal_is_owned_versioned_and_atomic(self):
        key,other=str(uuid4()),str(uuid4());photo,foreign=str(uuid4()),str(uuid4())
        payload={'kind':'expense','date':'2026-01-01','category':'maintenance','actual_krw':100}
        for record in (key,other):self.journal.save_manual(record,0,payload)
        with self.journal.connect() as db:
            for record,attachment in [(key,photo),(other,foreign)]:
                db.execute('INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?,?,?)',(self.journal.vehicle,attachment,record,attachment+'.png','synthetic.png','image/png',9,'a'*64,'active','2026-01-01'))
        with self.assertRaises(Conflict):self.journal.save_manual(key,1,dict(payload,remove_attachment_ids=[foreign]))
        with self.assertRaises(Conflict):self.journal.save_manual(key,2,dict(payload,remove_attachment_ids=[photo]))
        with self.assertRaises(ValueError):self.journal.save_manual(key,1,dict(payload,category='',remove_attachment_ids=[photo]))
        with self.journal.connect() as db:self.assertEqual(db.execute('SELECT status FROM attachments WHERE id=?',(photo,)).fetchone()[0],'active')
        result=self.journal.save_manual(key,1,dict(payload,remove_attachment_ids=[photo]));self.assertEqual(result['version'],2)
        with self.journal.connect() as db:
            self.assertEqual(db.execute('SELECT status FROM attachments WHERE id=?',(photo,)).fetchone()[0],'deleted')
            self.assertEqual(db.execute('SELECT status FROM attachments WHERE id=?',(foreign,)).fetchone()[0],'active')
            self.assertNotIn('remove_attachment_ids',json.loads(db.execute('SELECT extra_json FROM records WHERE id=?',(key,)).fetchone()[0])['input'])
        row=next(r for r in self.journal.query('2026-01-01','2026-01-31')['records'] if r['id']==key)
        self.assertEqual(row['attachments'],[])

    def test_purge_requires_deleted_version_confirmation_and_removes_content(self):
        key=str(uuid4());payload={'kind':'expense','date':'2026-01-01','category':'tuning','actual_krw':100,'memo':'private memo','location':{'name':'private place'}}
        self.journal.save_manual(key,0,payload)
        with self.assertRaises(ValueError):self.journal.purge_record(key,1,True)
        self.journal.change_status(key,1,'deleted')
        with self.assertRaises(ValueError):self.journal.purge_record(key,2,False)
        with self.assertRaises(Conflict):self.journal.purge_record(key,1,True)
        result=self.journal.purge_record(key,2,True);self.assertTrue(result['purged'])
        with self.journal.connect() as db:
            row=db.execute('SELECT version,status,extra_json FROM records WHERE id=?',(key,)).fetchone()
            self.assertEqual(row[1],'superseded');self.assertNotIn('private',row[2])
            for table in ('expenses','attachments','change_log','day_parts'):
                self.assertEqual(db.execute('SELECT count(*) FROM '+table+' WHERE record_id=?',(key,)).fetchone()[0],0)
        with self.assertRaises(Conflict):self.journal.change_status(key,row[0],'active')
        with self.assertRaises(Conflict):self.journal.save_manual(key,row[0],payload)
        self.assertFalse(any(r['id']==key for r in self.journal.query('2026-01-01','2026-01-31')['records']))

    def test_purged_automatic_payment_does_not_return_on_sync(self):
        data={'started_at':'2026-09-01T15:00:00Z','ended_at':'2026-09-01T16:00:00Z','duration_s':3600,'energy_kwh':10,'cost_krw':3000,'can_mode':4}
        self.archive.put(self.event('charge','purge-session',data));sync(self.archive,self.journal)
        with self.journal.connect() as db:key,version=db.execute("SELECT id,version FROM records WHERE kind='expense'").fetchone()
        self.journal.change_status(key,version,'deleted');self.journal.purge_record(key,version+1,True)
        sync(self.archive,self.journal)
        with self.journal.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM expenses WHERE record_id=?',(key,)).fetchone()[0],0)
            self.assertEqual(db.execute('SELECT source_fingerprint FROM records WHERE id=?',(key,)).fetchone()[0],'purged')

    def test_parent_edit_does_not_recreate_purged_charge_cost(self):
        key=str(uuid4());payload={'kind':'charge','date':'2026-01-01','battery_charge_kwh':10,'actual_krw':3000}
        self.journal.save_manual(key,0,payload)
        cost=self.journal.identity('manual_charge_cost',key)
        self.journal.change_status(cost,1,'deleted');self.journal.purge_record(cost,2,True)
        self.journal.save_manual(key,1,dict(payload,actual_krw=4000))
        with self.journal.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM expenses WHERE record_id=?',(cost,)).fetchone()[0],0)
            self.assertEqual(db.execute('SELECT status FROM records WHERE id=?',(cost,)).fetchone()[0],'superseded')

    def test_photo_cleanup_queue_retries_after_restart(self):
        from unittest.mock import patch
        key=str(uuid4());self.journal.save_manual(key,0,{'kind':'expense','date':'2026-01-01','category':'other','actual_krw':100})
        base=Path(self.journal.path).with_suffix('')/'attachments';base.mkdir(parents=True);photo=base/'synthetic.png';photo.write_bytes(b'synthetic')
        with self.journal.connect() as db:
            db.execute('INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?,?,?)',(self.journal.vehicle,str(uuid4()),key,photo.name,'synthetic.png','image/png',9,'a'*64,'active','2026-01-01'))
        self.journal.change_status(key,1,'deleted')
        with patch.object(Path,'unlink',side_effect=OSError('locked')):result=self.journal.purge_record(key,2,True)
        self.assertEqual(result['photo_cleanup_pending'],1);self.assertTrue(photo.exists())
        Journal(Path(self.journal.path),'entry','car','Asia/Seoul');self.assertFalse(photo.exists())

    def tearDown(self):self.tmp.cleanup()

    def event(self,kind,key,data):
        return {'schema':1,'device_id':'car','event_id':key,'kind':kind,'observed_at':'2026-09-01T15:30:00Z','data':data}

    def charge(self):
        return self.event('charge','charge1',{'started_at':'2026-09-01T14:30:00Z','ended_at':'2026-09-01T15:30:00Z',
                         'duration_s':3600,'energy_kwh':12,'cost_krw':3600,'can_mode':6})

    def test_automatic_expense_edit_delete_survives_sync(self):
        self.archive.put(self.charge())
        sync(self.archive,self.journal)
        record=self.journal.query('2026-09-01','2026-09-30')['recent_records'][0]
        payload={'kind':'expense','date':'2026-09-02','category':'charging','actual_krw':1234,'memo':'corrected'}
        saved=self.journal.save_manual(record['id'],record['version'],payload)
        sync(self.archive,self.journal,True)
        result=self.journal.query('2026-09-01','2026-09-30')
        self.assertEqual(result['totals']['charge_effective_krw'],1234)
        self.assertEqual(result['recent_records'][0]['memo'],'corrected')
        with self.assertRaises(Conflict):
            self.journal.change_status(record['id'],record['version'],'deleted')
        deleted=self.journal.change_status(record['id'],saved['version'],'deleted')
        sync(self.archive,self.journal,True)
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['recent_records'],[])
        self.journal.change_status(record['id'],deleted['version'],'active')
        self.assertEqual(len(self.journal.query('2026-09-01','2026-09-30')['recent_records']),1)

    def test_recent_records_include_entire_period(self):
        for index in range(12):
            self.journal.save_manual(str(uuid4()),0,{'kind':'expense','date':f'2026-09-{index+1:02d}','category':'washing','actual_krw':1000})
        result=self.journal.query('2026-09-01','2026-09-30',limit=2)
        self.assertEqual(len(result['records']),2)
        self.assertEqual(len(result['recent_records']),12)
        self.assertEqual(result['recent_records'][-1]['accounting_date'],'2026-09-01')

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
        self.journal.save_manual(str(uuid4()),0,{'kind':'charge','date':'2026-09-03','battery_charge_kwh':20})
        financial=self.journal.query('2026-09-01','2026-09-30',100,0,False,[],True)
        self.assertEqual(len(financial['records']),3)
        self.assertTrue(all(r['kind']=='expense' for r in financial['records']))
        self.assertFalse(financial['has_more'])
        self.assertTrue(financial['expense_filters_supported'])
        original=self.journal.query('2026-09-01','2026-09-30')
        hidden=self.journal.query('2026-09-01','2026-09-30',100,0,False,[])
        self.assertEqual(len(hidden['records']),4)
        self.assertFalse(hidden['has_more'])
        self.assertEqual(hidden['totals'],original['totals'])
        self.assertEqual(hidden['record_count'],original['record_count'])
        trip_page=self.journal.query('2026-09-01','2026-09-30',100,0,True,['trip'])
        self.assertTrue(trip_page['has_more'])
        self.assertEqual(len(trip_page['records']),100)
        self.assertEqual(len(self.journal.query('2026-09-01','2026-09-30',100,100,True,['trip'])['records']),1)
        selected=self.journal.query('2026-09-01','2026-09-30',100,0,False,['charging','maintenance'],True)
        self.assertEqual({r['category'] for r in selected['records']},{'charging','maintenance'})
        self.assertEqual(len(selected['recent_records']),3)
        self.journal.save_manual(str(uuid4()),0,{'kind':'expense','date':'2026-09-01','category':'parking','actual_krw':9000})
        high=self.journal.query('2026-09-01','2026-09-30',1,0,False,[],True,'amount_desc')
        low=self.journal.query('2026-09-01','2026-09-30',1,0,False,[],True,'amount_asc')
        self.assertEqual(high['records'][0]['actual_krw'],9000)
        self.assertEqual(low['records'][0]['actual_krw'],1000)
        self.assertTrue(high['has_more'])
        for category in ('insurance','tax','toll','other'):
            self.journal.save_manual(str(uuid4()),0,{'kind':'expense','date':'2026-09-01','category':category,'actual_krw':500})
        grouped=self.journal.query('2026-09-01','2026-09-30',100,0,False,['other'],True)
        self.assertEqual({r['category'] for r in grouped['records']},{'insurance','tax','parking','toll','other'})
        self.assertEqual(len(grouped['records']),5)
        with self.assertRaises(ValueError):self.journal.query('2026-09-01','2026-09-30',100,0,False,[],True,'invalid')
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

    def test_accident_ten_photos_and_snapshot(self):
        ns,Image,BytesIO=self.photo_functions();key=str(uuid4())
        self.journal.save_manual(key,0,{'kind':'expense','date':'2026-09-02','category':'accident'})
        for index in range(11):
            output=BytesIO();Image.new('RGB',(20,20),(index*20,0,0)).save(output,format='PNG')
            if index<10:ns['save_photo'](self.journal,key,output.getvalue(),'photo.png')
            else:
                with self.assertRaises(sqlite3.IntegrityError):ns['save_photo'](self.journal,key,output.getvalue(),'photo.png')
        with self.assertRaises(ValueError):self.journal.save_manual(key,1,{'kind':'expense','date':'2026-09-02','category':'maintenance'})
        self.assertEqual(len(self.journal.query('2026-09-01','2026-09-30')['records'][0]['attachments']),10)
        from custom_components.carrot_ha.vehicle_journal.snapshots import export_snapshot,snapshot_preview,restore_snapshot
        plan=snapshot_preview(export_snapshot(self.journal,{'vehicle_id':self.journal.vehicle,'device_id':'car','timezone':'Asia/Seoul'}))
        restored=Journal(Path(self.tmp.name)/'restored.sqlite3','restored','car','Asia/Seoul');restore_snapshot(restored,plan,'restored','car')
        self.assertEqual(len(restored.query('2026-09-01','2026-09-30')['records'][0]['attachments']),10)

    def test_fuel_manual_fields_and_wash_are_atomic(self):
        key=str(uuid4());data={'kind':'expense','date':'2026-09-02','category':'refueling','actual_krw':50000,'fuel_liters':25,'unit_price_krw':2000,'unit_price_source':'receipt','fuel_type':'diesel','full_tank':True,'wash_cost_krw':5000}
        self.journal.save_manual(key,0,data);q=self.journal.query('2026-09-01','2026-09-30')
        self.assertEqual(q['totals']['total_cost_krw'],55000);self.assertEqual(q['fuel_facts']['totals']['fuel_liters'],25)
        self.assertEqual(q['records'][0]['input']['unit_price_source'],'receipt')
        self.journal.change_status(key,1,'deleted');self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals']['total_cost_krw'],0)
        self.journal.change_status(key,2,'active');self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals']['total_cost_krw'],55000)
        data['wash_cost_krw']=0;self.journal.save_manual(key,3,data);self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['totals']['total_cost_krw'],50000)
    def test_schema_packaging_identity(self):
        self.assertEqual(Path('vehicle-journal/schema/001_initial.sql').read_bytes(),
                         Path('custom_components/carrot_ha/vehicle_journal/schema.sql').read_bytes())


if __name__=='__main__':unittest.main(verbosity=2)

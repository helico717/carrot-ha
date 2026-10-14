"""Synthetic bidirectional payment and interrupted-write regression checks."""
import json
from unittest.mock import patch
import unittest
import test_journal as fixtures
from custom_components.carrot_ha.vehicle_journal.store import Journal,Conflict
from custom_components.carrot_ha.vehicle_journal.source import sync


class PaymentSyncTests(unittest.TestCase):
    setUp=fixtures.JournalTests.setUp
    tearDown=fixtures.JournalTests.tearDown
    event=fixtures.JournalTests.event
    charge=fixtures.JournalTests.charge
    def record(self):
        self.archive.put(self.charge());sync(self.archive,self.journal)
        return self.journal.query('2026-09-01','2026-09-30')['recent_records'][0]

    def edit(self,row,amount):
        return self.journal.save_manual(row['id'],row['version'],{'kind':'expense','date':row['accounting_date'],'category':'charging','actual_krw':amount,'memo':'synthetic'})

    def test_both_directions_and_stale_editor(self):
        row=self.record();self.edit(row,8455);sync(self.archive,self.journal)
        group=self.archive.charge_history('car')[0]['data']
        self.assertEqual(group['actual_cost_krw'],8455)
        self.assertEqual(group['cost_source'],'actual')
        self.archive.set_charge_payment('car',group['payment_id'],group['source_event_ids'],group['payment_version'],4231)
        sync(self.archive,self.journal)
        current=self.journal.query('2026-09-01','2026-09-30')['recent_records'][0]
        self.assertEqual(current['actual_krw'],4231)
        self.assertEqual(current['input']['actual_krw'],4231)
        self.assertEqual(current['memo'],'synthetic')
        with self.assertRaises(Conflict):self.edit(row,9999)

    def test_restart_after_archive_write_before_queue_ack(self):
        row=self.record();self.edit(row,0)
        from custom_components.carrot_ha.vehicle_journal.payment_sync import reconcile
        original=self.archive.set_charge_payment
        def interrupted(*args):
            original(*args)
            raise OSError('synthetic interruption')
        with patch.object(self.archive,'set_charge_payment',side_effect=interrupted):
            with self.assertRaises(OSError):reconcile(self.archive,self.journal)
        restarted=Journal(self.journal.path,'entry','car','Asia/Seoul')
        sync(self.archive,restarted)
        group=self.archive.charge_history('car')[0]['data']
        self.assertEqual(group['actual_cost_krw'],0);self.assertEqual(group['payment_version'],1)
        with restarted.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM payment_outbox').fetchone()[0],0)

    def test_legacy_override_recovers_once_and_later_dashboard_wins(self):
        row=self.record()
        with self.journal.connect() as db:
            extra={'journal_override':True,'input':{'kind':'expense','date':row['accounting_date'],'category':'charging','actual_krw':8455,'memo':'legacy'}}
            db.execute('UPDATE records SET extra_json=? WHERE id=?',(json.dumps(extra),row['id']))
            db.execute("UPDATE expenses SET actual_krw=8455,payment_owner='journal',payment_id=NULL,payment_version=NULL WHERE record_id=?",(row['id'],))
        sync(self.archive,self.journal)
        group=self.archive.charge_history('car')[0]['data'];self.assertEqual(group['actual_cost_krw'],8455)
        self.archive.set_charge_payment('car',group['payment_id'],group['source_event_ids'],group['payment_version'],999)
        sync(self.archive,self.journal)
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['recent_records'][0]['actual_krw'],999)

    def test_delete_actual_reverts_both_to_estimate(self):
        row=self.record();self.edit(row,8455);sync(self.archive,self.journal)
        group=self.archive.charge_history('car')[0]['data']
        self.archive.set_charge_payment('car',group['payment_id'],group['source_event_ids'],group['payment_version'],None)
        sync(self.archive,self.journal)
        current=self.journal.query('2026-09-01','2026-09-30')['recent_records'][0]
        self.assertIsNone(current['actual_krw']);self.assertIsNone(current['input']['actual_krw'])


    def test_older_legacy_override_cannot_replace_newer_dashboard_payment(self):
        row=self.record();group=self.archive.charge_history('car')[0]['data']
        self.archive.set_charge_payment('car',group['payment_id'],group['source_event_ids'],group['payment_version'],4231)
        with self.journal.connect() as db:
            extra={'journal_override':True,'input':{'kind':'expense','date':row['accounting_date'],'category':'charging','actual_krw':8455}}
            db.execute("UPDATE records SET extra_json=?,updated_at='2020-01-01T00:00:00+00:00' WHERE id=?",(json.dumps(extra),row['id']))
        sync(self.archive,self.journal)
        self.assertEqual(self.archive.charge_history('car')[0]['data']['actual_cost_krw'],4231)
        self.assertEqual(self.journal.query('2026-09-01','2026-09-30')['recent_records'][0]['actual_krw'],4231)

    def test_queue_survives_failure_before_archive_write(self):
        row=self.record();self.edit(row,8455)
        with patch.object(self.archive,'set_charge_payment',side_effect=OSError('synthetic unavailable')):
            with self.assertRaises(OSError):sync(self.archive,self.journal)
        restarted=Journal(self.journal.path,'entry','car','Asia/Seoul');sync(self.archive,restarted)
        self.assertEqual(self.archive.charge_history('car')[0]['data']['actual_cost_krw'],8455)

"""Record time of day: real times only, entered times, ordering and validation (synthetic data only)."""
from datetime import datetime,timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo
import unittest
import test_journal as fixtures
from custom_components.carrot_ha.vehicle_journal.source import sync

KST=ZoneInfo('Asia/Seoul')


class RecordTimeTests(unittest.TestCase):
    setUp=fixtures.JournalTests.setUp
    tearDown=fixtures.JournalTests.tearDown
    event=fixtures.JournalTests.event
    charge=fixtures.JournalTests.charge

    def rows(self,start='2026-09-01',end='2026-09-30'):
        return {r['id']:r for r in self.journal.query(start,end)['records']}

    def expense(self,date,time=None,**extra):
        key=str(uuid4());payload={'kind':'expense','date':date,'category':'maintenance','actual_krw':10000,'memo':'',**extra}
        if time:payload['time']=time
        self.journal.save_manual(key,0,payload);return key

    def test_automatic_payment_uses_charge_session_start(self):
        self.archive.put(self.charge());sync(self.archive,self.journal)
        payment=[r for r in self.rows().values() if r['kind']=='expense'][0]
        # Charge started 2026-09-01T14:30Z = 23:30 KST.
        self.assertEqual(datetime.fromisoformat(payment['occurred_at']).astimezone(KST).strftime('%H:%M'),'23:30')

    def test_entered_time_is_stored_shown_and_cleared(self):
        key=self.expense('2026-09-03','09:15')
        row=self.rows()[key]
        self.assertEqual(row['input']['time'],'09:15')
        self.assertEqual(datetime.fromisoformat(row['occurred_at']).astimezone(KST).strftime('%Y-%m-%d %H:%M'),'2026-09-03 09:15')
        self.journal.save_manual(key,row['version'],{'kind':'expense','date':'2026-09-03','category':'maintenance','actual_krw':10000,'memo':''})
        self.assertIsNone(self.rows()[key]['occurred_at'])

    def test_date_only_records_have_no_time(self):
        expense=self.expense('2026-09-04')
        trip=str(uuid4());self.journal.save_manual(trip,0,{'kind':'trip','date':'2026-09-04','odometer_km':1000})
        rows=self.rows()
        self.assertIsNone(rows[expense]['occurred_at'])
        self.assertIsNone(rows[trip]['occurred_at'])  # 00:00 placeholder is not a time

    def test_manual_trip_start_time_is_shown(self):
        trip=str(uuid4());start=datetime(2026,9,5,7,40,tzinfo=KST).isoformat()
        self.journal.save_manual(trip,0,{'kind':'trip','date':'2026-09-05','odometer_km':1000,'started_at':start})
        self.assertEqual(datetime.fromisoformat(self.rows()[trip]['occurred_at']).astimezone(KST).strftime('%H:%M'),'07:40')

    def test_same_day_order_follows_entered_time(self):
        early=self.expense('2026-09-06','08:00');late=self.expense('2026-09-06','20:00')
        order=[r['id'] for r in self.journal.query('2026-09-01','2026-09-30')['records'] if r['id'] in (early,late)]
        self.assertEqual(order,[late,early])

    def test_invalid_or_future_time_is_rejected(self):
        for bad in ('24:00','9:15','12:60','ab:cd',915):
            with self.assertRaises(ValueError):self.expense('2026-09-07',bad)
        with self.assertRaises(ValueError):
            self.journal.save_manual(str(uuid4()),0,{'kind':'trip','date':'2026-09-07','odometer_km':1,'time':'10:00'})
        now=datetime.now(KST)+timedelta(hours=2)
        if now.date()==datetime.now(KST).date():
            with self.assertRaises(ValueError):self.expense(now.date().isoformat(),now.strftime('%H:%M'))


if __name__=='__main__':
    unittest.main()

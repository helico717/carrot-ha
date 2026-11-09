"""Indexed projections preserve state semantics without reading full envelopes."""
import unittest
import tempfile
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import test_trip_energy as fixtures
from custom_components.carrot_ha import state_projection, archive_codec
from custom_components.carrot_ha.battery_history import history

class StateProjectionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.archive=fixtures.Archive(Path(self.temp.name)/'archive.sqlite3')
        self.now=datetime(2026,11,9,12,tzinfo=timezone.utc)
    def tearDown(self):
        self.temp.cleanup()
    def populate(self):
        for i in range(90):
            stamp=(self.now-timedelta(minutes=90-i)).isoformat()
            data={'battery_wh':40000-i*10,'measured_at':stamp,'charging':i%5==0,'onroad':True,
                  'field_measured_at':{'battery_wh':stamp,'display_soc_candidate_percent':stamp},
                  'cloud_raw_state':{'snapshot':'x'*12000}}
            if i%4==0:data['display_soc_candidate_percent']=60-i/10
            if i%4==1:data['display_soc_candidate_percent']=None
            if i%4==2:data['display_soc_candidate_percent']=True
            if i%3==0:data['driving']=None
            if i%7==0:data['stale']=True
            event={'schema':1,'device_id':'car','event_id':str(i),'kind':'state','observed_at':stamp,'data':data}
            self.archive.put(event)
            if i%2==0:
                with self.archive.connect() as db:
                    db.execute('UPDATE events SET body=? WHERE id=?',(archive_codec.pack(json.dumps(event)),str(i)))
    def test_battery_output_matches_full_envelope_reads(self):
        self.populate()
        def original_samples(db,device,since,until=None):
            for received,body in db.execute("SELECT observed,body FROM events WHERE device=? AND kind='state' AND observed>=? ORDER BY observed",(device,since)):
                yield received,archive_codec.calculation_event(body)
        for zone in ('Asia/Seoul','America/New_York'):
            projected=history(self.archive,'car',64,zone,self.now)
            with patch.object(state_projection,'samples',original_samples):
                original=history(self.archive,'car',64,zone,self.now)
            self.assertEqual(projected,original)
    def test_covering_projection_never_reads_table_body(self):
        with self.archive.connect() as db:
            sql=f"SELECT observed,{state_projection.EXPRESSION} FROM events INDEXED BY {state_projection.INDEX} WHERE device=? AND kind='state' AND observed>=? ORDER BY observed"
            program=db.execute('EXPLAIN '+sql,('car','2026')).fetchall()
            table_root=db.execute("SELECT rootpage FROM sqlite_master WHERE name='events'").fetchone()[0]
            table_cursors={op[2] for op in program if op[1]=='OpenRead' and op[3]==table_root}
            self.assertFalse(any(op[1]=='Column' and op[2] in table_cursors for op in program),program)
    def test_index_tracks_updates_and_rollbacks(self):
        self.populate()
        with self.archive.connect() as db:
            before=list(state_projection.samples(db,'car','2026'))
            db.execute('BEGIN')
            db.execute("DELETE FROM events WHERE device='car'")
            self.assertEqual(list(state_projection.samples(db,'car','2026')),[])
            db.rollback()
            self.assertEqual(list(state_projection.samples(db,'car','2026')),before)

    def test_existing_archive_builds_projection_without_changing_events(self):
        self.populate()
        with self.archive.connect() as db:
            before=db.execute('SELECT device,id,observed,kind,body FROM events ORDER BY id').fetchall()
            db.execute(f'DROP INDEX {state_projection.INDEX}')
        reopened=fixtures.Archive(self.archive.path)
        with reopened.connect() as db:
            self.assertEqual(db.execute('SELECT device,id,observed,kind,body FROM events ORDER BY id').fetchall(),before)
            self.assertEqual(len(list(state_projection.samples(db,'car','2026'))),90)

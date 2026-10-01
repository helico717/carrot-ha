import tempfile
from pathlib import Path
import unittest
from test_storage_purge import Archive


class ArchivePerformanceTests(unittest.TestCase):
    def test_identical_cloud_rows_do_not_write_or_invalidate(self):
        with tempfile.TemporaryDirectory() as directory:
            archive=Archive(Path(directory)/'events.sqlite3')
            event={'schema':1,'event_id':'cloud-test','device_id':'car','kind':'state',
                   'observed_at':'2026-10-01T00:00:00Z','data':{'battery_wh':40000}}
            self.assertTrue(archive.put_cloud(event))
            revision=archive.revision
            archive._derived_ready.add('car')
            self.assertFalse(archive.put_cloud(event))
            self.assertEqual(archive.revision,revision)
            self.assertIn('car',archive._derived_ready)
            event['data']['battery_wh']=41000
            self.assertTrue(archive.put_cloud(event))
            self.assertEqual(archive.revision,revision+1)
            self.assertNotIn('car',archive._derived_ready)

    def test_recent_history_uses_expression_index(self):
        with tempfile.TemporaryDirectory() as directory:
            archive=Archive(Path(directory)/'events.sqlite3')
            with archive.connect() as db:
                plan=db.execute("EXPLAIN QUERY PLAN SELECT body FROM events WHERE device=? AND kind=? AND julianday(COALESCE(json_extract(body, '$.data.started_at'), observed)) >= julianday(?) ORDER BY julianday(COALESCE(json_extract(body, '$.data.started_at'), observed)) DESC, rowid DESC LIMIT ? OFFSET ?",('car','trip','2026-10-01T00:00:00Z',100,0)).fetchall()
            self.assertTrue(any('SEARCH' in row[3] and 'events_started' in row[3] for row in plan),plan)

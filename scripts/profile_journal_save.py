"""Profile journal saves on disposable SQLite backups; never write source DBs.

Run on the HA host with --root /config/custom_components/carrot_ha.
Only aggregate timings/counts are printed, never record contents or identities.
"""
import argparse
import calendar
from contextlib import closing
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import time
import types


def backup(source, destination):
    with closing(sqlite3.connect(source.resolve().as_uri()+'?mode=ro', uri=True)) as src:
        with closing(sqlite3.connect(destination)) as dst:
            src.backup(dst, pages=256, sleep=0.01)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--runs', type=int, default=3)
    parser.add_argument('--mode', choices=['baseline', 'incremental', 'compare'], default='baseline')
    args = parser.parse_args()
    package = types.ModuleType('journal_profile')
    package.__path__ = [str(args.root.resolve())]
    sys.modules[package.__name__] = package
    from journal_profile.storage import Archive
    from journal_profile.vehicle_journal.store import Journal
    from journal_profile.vehicle_journal import source
    candidates = [p for p in args.data.glob('*.sqlite3') if 'before-' not in p.name]
    archive_path = max(candidates, key=lambda p: p.stat().st_size)
    journal_path = args.data/'vehicle_journal'/archive_path.name
    if not journal_path.is_file():
        raise SystemExit('Linked journal missing; no source files changed')
    with tempfile.TemporaryDirectory(prefix='carrot-journal-profile-') as temp:
        temp = Path(temp)
        started = time.perf_counter()
        backup(archive_path, temp/'archive.sqlite3')
        backup(journal_path, temp/'journal.sqlite3')
        print(json.dumps({'stage': 'backup', 'seconds': round(time.perf_counter()-started, 4)}), flush=True)
        # All constructors and writes below target disposable backups only.
        archive = Archive(temp/'archive.sqlite3')
        with closing(sqlite3.connect(temp/'journal.sqlite3')) as db:
            vehicle, entry, device, tz = db.execute('SELECT id,entry_id,device_id,accounting_timezone FROM vehicles').fetchone()
        journal = Journal(temp/'journal.sqlite3', entry, device, tz)
        journal.soc_capacity_kwh = journal.synced_soc_basis() or 64.0
        prep = time.perf_counter()
        source.sync(archive, journal)
        print(json.dumps({'stage': 'prepare', 'seconds': round(time.perf_counter()-prep, 4)}), flush=True)
        with journal.connect() as db:
            row = db.execute("""SELECT r.id FROM records r JOIN expenses e
                ON e.vehicle_id=r.vehicle_id AND e.record_id=r.id
                WHERE r.vehicle_id=? AND r.status='active' AND r.origin='automatic'
                AND e.payment_owner='ha_charge_payment' ORDER BY e.accounting_date DESC LIMIT 1""", (vehicle,)).fetchone()
        if not row:
            raise SystemExit('No automatic payment; no source files changed')
        key = row[0]
        original_snapshot, original_import, original_aggregate = source.snapshot, journal.import_snapshot, journal.aggregate
        times = {}
        def timed(label, fn):
            def wrapped(*a, **kw):
                start = time.perf_counter()
                try:
                    return fn(*a, **kw)
                finally:
                    times[label] = times.get(label, 0)+time.perf_counter()-start
            return wrapped
        source.snapshot = timed('snapshot', original_snapshot)
        journal.import_snapshot = timed('import_snapshot', original_import)
        journal.aggregate = timed('aggregate', original_aggregate)
        modes = ['baseline', 'incremental'] if args.mode == 'compare' else [args.mode]
        # Alternate order so both variants encounter warm caches fairly.
        for run, mode in [(n, m) for n in range(args.runs) for m in (modes if n % 2 == 0 else modes[::-1])]:
            times.clear()
            start = time.perf_counter()
            if mode == 'baseline':
                timed('sync_before', source.sync)(archive, journal, True)
            with journal.connect() as db:
                version, text, date = db.execute('''SELECT r.version,r.extra_json,e.accounting_date FROM records r
                    JOIN expenses e ON e.vehicle_id=r.vehicle_id AND e.record_id=r.id WHERE r.id=?''', (key,)).fetchone()
            payload = dict(json.loads(text).get('input') or {}, kind='expense', category='charging', date=date,
                           actual_krw=12345+run*len(modes)+modes.index(mode))
            if mode == 'baseline':
                with journal.lock:
                    timed('save_manual', journal.save_manual)(key, version, payload)
                    timed('sync_after', source.sync)(archive, journal, True)
            else:
                from journal_profile.vehicle_journal.save import SaveTimings, save_linked
                timing = SaveTimings()
                save_linked(archive, journal, key, version, payload, timing, time.perf_counter())
                times.update({k: v/1000 for k, v in timing.stages.items()})
            month = datetime.now(journal.tz).strftime('%Y-%m')
            timed('charge_totals', archive.charge_totals)(device, month)
            times['save_total'] = time.perf_counter()-start
            last_day = calendar.monthrange(int(date[:4]), int(date[5:7]))[1]
            timed('query_current', journal.query)(date[:7]+'-01', date[:7]+f'-{last_day}')
            print(json.dumps({'mode': mode, 'run': run+1, 'seconds': {k: round(v, 4) for k,v in times.items()}}), flush=True)


if __name__ == '__main__':
    main()

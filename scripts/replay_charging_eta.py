"""Read-only ETA replay against observed configured-SOC crossings.

Usage: python3 scripts/replay_charging_eta.py export.sqlite3 --baseline /tmp/battery.py
No GPS, device IDs or raw payloads are printed. Charge end is NOT a full-charge
label. Results are measurement-time replays, not historical dashboard values.
"""
import argparse
import importlib.util
import json
import sqlite3
import statistics
from datetime import datetime, timezone
from pathlib import Path


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.estimate_charging_times


def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    parser.add_argument('--capacity', type=float, default=78)
    parser.add_argument('--baseline', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    models = [('updated', load(root / 'custom_components/carrot_ha/battery.py', 'updated'))]
    if args.baseline:
        models.insert(0, ('baseline', load(args.baseline, 'baseline')))
    samples, sessions, failed = {}, [], 0
    with sqlite3.connect(args.database.resolve().as_uri() + '?mode=ro', uri=True) as db:
        # The export's last table page can be damaged while its primary-key
        # index remains readable. Enumerate existing rowids through that index.
        ids = [r[0] for r in db.execute(
            'SELECT rowid FROM events INDEXED BY sqlite_autoindex_events_1')]
        for rowid in ids:
            try:
                kind, body = db.execute('SELECT kind,body FROM events WHERE rowid=?', (rowid,)).fetchone()
                event = json.loads(body)
            except (sqlite3.DatabaseError, ValueError, TypeError):
                failed += 1
                continue
            data = event['data']
            if kind == 'charge' and data.get('started_at') and data.get('ended_at'):
                sessions.append(data)
            if kind != 'state' or data.get('stale') or not isinstance(data.get('battery_wh'), (int, float)):
                continue
            stamp = (data.get('field_measured_at') or {}).get('battery_wh') or data.get('measured_at') or event['observed_at']
            samples[timestamp(stamp)] = data
    samples = sorted(samples.items())
    report = {'read_rows': len(ids) - failed, 'unreadable_rows': failed,
              'capacity_kwh': args.capacity, 'crossings': []}
    for session in sorted(sessions, key=lambda d: d['started_at']):
        start, end = timestamp(session['started_at']), timestamp(session['ended_at'])
        points = [(t, d) for t, d in samples if start - 35 <= t <= end + 35]
        for target in (80, 100):
            goal = args.capacity * 1000 * target / 100
            crossing = None
            for (t0, d0), (t1, d1) in zip(points, points[1:]):
                gain = d1['battery_wh'] - d0['battery_wh']
                if (d0['battery_wh'] < goal <= d1['battery_wh'] and
                        0 < t1-t0 <= 180 and gain * 3600 / (t1-t0) <= 250000):
                    crossing = t0 + (t1-t0) * (goal-d0['battery_wh']) / gain
                    break
            if crossing is None:
                continue
            metrics = {}
            for name, estimate in models:
                state, errors = None, []
                for t, d in points:
                    if t >= crossing:
                        break
                    if not d.get('charging') or (d.get('charge_power_w') or 0) < 300:
                        state = None
                        continue
                    capacity = args.capacity
                    energy = d['battery_wh'] / 1000
                    if name == 'baseline':
                        capacity = round(d.get('measured_capacity_wh', capacity * 1000) / 1000, 1)
                        energy = round(energy, 1)
                    result = estimate(energy, capacity, d['charge_power_w'],
                                      base_time=datetime.fromtimestamp(t, timezone.utc), smooth_state=state)
                    state = result['smooth_state']
                    predicted = result[f'time_to_{target}_s']
                    if predicted is not None:
                        errors.append((predicted - (crossing-t)) / 60)
                if errors:
                    metrics[name] = dict(samples=len(errors), mae_min=round(statistics.mean(map(abs, errors)), 3),
                                         bias_min=round(statistics.mean(errors), 3))
            report['crossings'].append(dict(session_start=session['started_at'], target=target,
                crossing_utc=datetime.fromtimestamp(crossing, timezone.utc).isoformat(), metrics=metrics))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

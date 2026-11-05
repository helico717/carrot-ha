"""Permanent openpilot assist statistics (docs/OPENPILOT_ASSIST_STATS_PLAN_2026-11-05.md).

Rows in these tables are never removed by trip/state retention, so cumulative
statistics keep growing after the 90-day trip purge. No Home Assistant imports.

Distances follow the plan's three-way split: assisted + manual + unknown. The
usage ratio is assisted / (assisted + manual); unknown is never in the
denominator. Totals are wheel-integrated (basis); the final trip distance only
contributes a separate recovery difference.
"""
import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import archive_codec

CLASSES = (('manualM', 'manual_m'), ('latOnlyM', 'lat_m'), ('longOnlyM', 'long_m'),
           ('bothM', 'both_m'), ('unknownM', 'unknown_m'))
ACTIVE = ('lat_m', 'long_m', 'both_m')
ACTIVE_DAY_M = 1000          # user decision 2026-11-05: a "used day" needs >= 1 km assisted
ODOMETER_ANCHOR_S = 1800     # stats-start odometer must be measured within 30 min before the trip

SCHEMA = (
    '''CREATE TABLE IF NOT EXISTS assist_trips (
        device TEXT NOT NULL, id TEXT NOT NULL, started_at TEXT, ended_at TEXT NOT NULL,
        measured INTEGER NOT NULL, version INTEGER, final_m REAL, basis_m REAL,
        manual_m REAL, lat_m REAL, long_m REAL, both_m REAL, unknown_m REAL,
        enabled_on_m REAL, enabled_off_m REAL, enabled_unknown_m REAL,
        known_s REAL, assist_s REAL, engagements INTEGER, disengagements INTEGER,
        longest_m REAL, longest_s REAL, streak_count INTEGER,
        hash TEXT, conflicts INTEGER NOT NULL DEFAULT 0, conflict_hash TEXT, stored_at TEXT NOT NULL,
        PRIMARY KEY(device, id))''',
    'CREATE INDEX IF NOT EXISTS assist_trips_device_ended ON assist_trips(device, ended_at)',
    '''CREATE TABLE IF NOT EXISTS assist_buckets (
        device TEXT NOT NULL, id TEXT NOT NULL, at TEXT NOT NULL,
        manual_m REAL, lat_m REAL, long_m REAL, both_m REAL, unknown_m REAL,
        PRIMARY KEY(device, id, at))''',
    'CREATE INDEX IF NOT EXISTS assist_buckets_device_at ON assist_buckets(device, at)',
    '''CREATE TABLE IF NOT EXISTS assist_streaks (
        device TEXT NOT NULL, id TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL,
        distance_m REAL NOT NULL, broken INTEGER NOT NULL, PRIMARY KEY(device, id, start_at))''',
    'CREATE INDEX IF NOT EXISTS assist_streaks_device_start ON assist_streaks(device, start_at)',
    '''CREATE TABLE IF NOT EXISTS assist_meta (
        device TEXT PRIMARY KEY, odometer_km REAL, odometer_at TEXT)''',
)


def init(db):
    for statement in SCHEMA:
        db.execute(statement)


def _utc(value):
    try:
        moment = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return moment.astimezone(timezone.utc) if moment.tzinfo else None


def _number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def valid(assist):
    """Defensive re-check of the receiver's validation (receiver 0.1.5 assist_value)."""
    if not isinstance(assist, dict) or assist.get('version') != 1 or type(assist.get('version')) is not int:
        return False
    basis = assist.get('basisDistanceM')
    parts = [assist.get(key) for key, _ in CLASSES]
    if not _number(basis) or not all(_number(v) for v in parts) or abs(basis - sum(parts)) > 1:
        return False
    buckets, streaks = assist.get('buckets'), assist.get('streaks')
    if not isinstance(buckets, list) or not isinstance(streaks, list):
        return False
    for bucket in buckets:
        if not isinstance(bucket, dict) or _utc(bucket.get('at')) is None \
                or not all(_number(bucket.get(key)) for key, _ in CLASSES):
            return False
    for streak in streaks:
        if (not isinstance(streak, dict) or _utc(streak.get('startAt')) is None
                or _utc(streak.get('endAt')) is None or not _number(streak.get('distanceM'))):
            return False
    return all(_number(assist.get(k)) for k in ('knownDurationS', 'assistDurationS', 'longestStreakM', 'longestStreakS')) \
        and all(type(assist.get(k)) is int and assist[k] >= 0 for k in ('engagements', 'disengagements', 'streakCount'))


def trip_assist(data):
    """The receiver's assist, from the event data or its preserved raw trip."""
    if 'assist' in data:
        return data.get('assist')
    return (data.get('cloud_raw_trip') or {}).get('assist')


def _digest(assist):
    return hashlib.sha256(json.dumps(assist, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def _stats_started(db, device, ended_at):
    row = db.execute('SELECT MIN(started_at) FROM assist_trips WHERE device=? AND measured=1', (device,)).fetchone()
    return bool(row and row[0] and ended_at >= row[0])


def store_trip(db, device, trip_id, data, now=None):
    """Store one trip's statistics inside the caller's transaction. Returns True when changed.

    The first valid assist of a trip wins (plan section 9): a missing value
    keeps it, an identical value changes nothing, and a different value is kept
    out while counting one conflict per distinct body. Trips without a valid
    assist are recorded as unmeasured distance only after statistics started.
    """
    ended = _utc(data.get('ended_at'))
    if ended is None:
        return False
    started = _utc(data.get('started_at'))
    ended_at, started_at = ended.isoformat(), started.isoformat() if started else None
    final = data.get('distance_m') if _number(data.get('distance_m')) else None
    stamp = (now or datetime.now(timezone.utc)).isoformat()
    assist = trip_assist(data)
    assist = assist if valid(assist) else None
    row = db.execute('SELECT measured, hash, conflict_hash, final_m, ended_at FROM assist_trips WHERE device=? AND id=?',
                     (device, trip_id)).fetchone()
    if assist is None or (row and row[0] == 1):
        if row is None and not _stats_started(db, device, ended_at):
            return False
        if row is None:
            db.execute('INSERT INTO assist_trips(device,id,started_at,ended_at,measured,final_m,stored_at) VALUES (?,?,?,?,0,?,?)',
                       (device, trip_id, started_at, ended_at, final, stamp))
            return True
        changed = False
        if assist is not None:
            digest = _digest(assist)
            if digest != row[1] and digest != row[2]:
                db.execute('UPDATE assist_trips SET conflicts=conflicts+1, conflict_hash=? WHERE device=? AND id=?',
                           (digest, device, trip_id))
                changed = True
        if (row[3], row[4]) != (final, ended_at):
            db.execute('UPDATE assist_trips SET final_m=?, ended_at=?, started_at=COALESCE(?, started_at) WHERE device=? AND id=?',
                       (final, ended_at, started_at, device, trip_id))
            changed = True
        return changed
    # First valid assist for this trip (new, or previously unmeasured).
    values = {column: assist[key] for key, column in CLASSES}
    enabled = assist.get('enabled') if isinstance(assist.get('enabled'), dict) else {}
    db.execute('DELETE FROM assist_buckets WHERE device=? AND id=?', (device, trip_id))
    db.execute('DELETE FROM assist_streaks WHERE device=? AND id=?', (device, trip_id))
    db.execute('''INSERT OR REPLACE INTO assist_trips(device,id,started_at,ended_at,measured,version,final_m,basis_m,
        manual_m,lat_m,long_m,both_m,unknown_m,enabled_on_m,enabled_off_m,enabled_unknown_m,known_s,assist_s,
        engagements,disengagements,longest_m,longest_s,streak_count,hash,conflicts,conflict_hash,stored_at)
        VALUES (?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,NULL,?)''',
        (device, trip_id, started_at, ended_at, assist['version'], final, assist['basisDistanceM'],
         values['manual_m'], values['lat_m'], values['long_m'], values['both_m'], values['unknown_m'],
         enabled.get('onM'), enabled.get('offM'), enabled.get('unknownM'),
         assist['knownDurationS'], assist['assistDurationS'], assist['engagements'], assist['disengagements'],
         assist['longestStreakM'], assist['longestStreakS'], assist['streakCount'], _digest(assist), stamp))
    for bucket in assist['buckets']:
        db.execute('INSERT OR REPLACE INTO assist_buckets VALUES (?,?,?,?,?,?,?,?)',
                   (device, trip_id, _utc(bucket['at']).isoformat(), *[bucket[key] for key, _ in CLASSES]))
    for streak in assist['streaks']:
        db.execute('INSERT OR REPLACE INTO assist_streaks VALUES (?,?,?,?,?,?)',
                   (device, trip_id, _utc(streak['startAt']).isoformat(), _utc(streak['endAt']).isoformat(),
                    streak['distanceM'], int(streak.get('brokenByGap') is True)))
    _anchor_odometer(db, device, started or ended)
    return True


def _state_odometer(db, device, newest_before=None):
    """(km, measured datetime) from the newest valid state at or before a time."""
    rows = db.execute("SELECT observed, body FROM events WHERE device=? AND kind='state' AND (? IS NULL OR observed<=?) "
                      'ORDER BY observed DESC LIMIT 20',
                      (device, newest_before, newest_before)).fetchall()
    for observed, body in rows:
        data = archive_codec.calculation_event(body).get('data') or {}
        km = data.get('odometer_km')
        if not _number(km) or data.get('stale') is True:
            continue
        at = _utc((data.get('field_measured_at') or {}).get('odometer_km')) or _utc(observed)
        if at is not None and (newest_before is None or at.isoformat() <= newest_before):
            return km, at
    return None


def _anchor_odometer(db, device, trip_start):
    """Record the stats-start odometer once, from state history still retained (14 days)."""
    if db.execute('SELECT odometer_km FROM assist_meta WHERE device=? AND odometer_km IS NOT NULL', (device,)).fetchone():
        return
    reading = _state_odometer(db, device, trip_start.isoformat())
    if reading and (trip_start - reading[1]).total_seconds() <= ODOMETER_ANCHOR_S:
        db.execute('INSERT OR REPLACE INTO assist_meta VALUES (?,?,?)', (device, reading[0], reading[1].isoformat()))


def backfill(db, device):
    """Store assist already kept inside archived raw trips (e.g. synced before this HA version)."""
    rows = db.execute("""SELECT id, body FROM events WHERE device=? AND kind='trip'
        AND id NOT IN (SELECT id FROM assist_trips WHERE device=? AND measured=1)
        AND carrot_unpack(body) LIKE '%"assist":{%'""", (device, device)).fetchall()
    trips = []
    for trip_id, body in rows:
        data = archive_codec.loads(body).get('data') or {}
        trips.append((str(data.get('started_at') or data.get('ended_at')), trip_id, data))
    changed = 0
    for _, trip_id, data in sorted(trips):
        changed += bool(store_trip(db, device, trip_id, data))
    return changed


def _empty():
    return {'assist_m': 0.0, 'manual_m': 0.0, 'lat_only_m': 0.0, 'long_only_m': 0.0, 'both_m': 0.0,
            'unknown_signal_m': 0.0, 'recovery_added_m': 0.0, 'recovery_shortfall_m': 0.0, 'unmeasured_trip_m': 0.0}


def _add(target, key, value):
    target[key] = target.get(key, 0.0) + (value or 0.0)


def _finish(total):
    out = {k: round(v, 1) for k, v in total.items()}
    out['unknown_m'] = round(total['unknown_signal_m'] + total['recovery_added_m'] + total['unmeasured_trip_m'], 1)
    known = total['assist_m'] + total['manual_m']
    out['ratio'] = round(total['assist_m'] / known, 4) if known > 0 else None
    return out


def summary(db, device, time_zone, now=None, period='all', date=None):
    """Statistics for the whole history or one local day/week/month/year.

    Distances come from UTC 15-minute buckets mapped to the HA time zone;
    trip-level values (counts, recovery differences, unmeasured trips) use the
    trip end date; a streak belongs to the period in which it started.
    """
    tz = ZoneInfo(time_zone)
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(tz).date()
    start_row = db.execute('SELECT MIN(started_at), MIN(ended_at) FROM assist_trips WHERE device=? AND measured=1',
                           (device,)).fetchone()
    since = start_row[0] or start_row[1]
    result = {'schema': 1, 'device_id': device, 'time_zone': time_zone, 'since': since,
              'active_day_threshold_m': ACTIVE_DAY_M, 'period': period}
    if not since:
        return {**result, 'measured': False, 'total': _finish(_empty()), 'days': [], 'months': [],
                'current_streak_days': 0, 'best_streak_days': 0, 'active_days': 0,
                'engagements': 0, 'disengagements': 0, 'longest_streak': None, 'trips': 0, 'measured_trips': 0,
                'conflicts': 0, 'unrecorded_estimate_m': None}

    days = {}
    for at, manual, lat, lon, both, unknown in db.execute(
            'SELECT b.at,b.manual_m,b.lat_m,b.long_m,b.both_m,b.unknown_m FROM assist_buckets b '
            'JOIN assist_trips t ON t.device=b.device AND t.id=b.id AND t.measured=1 WHERE b.device=?', (device,)):
        day = days.setdefault(_utc(at).astimezone(tz).date(), _empty())
        _add(day, 'manual_m', manual); _add(day, 'lat_only_m', lat); _add(day, 'long_only_m', lon)
        _add(day, 'both_m', both); _add(day, 'unknown_signal_m', unknown)
        _add(day, 'assist_m', (lat or 0) + (lon or 0) + (both or 0))
    trip_rows = db.execute('SELECT id,ended_at,measured,final_m,basis_m,engagements,disengagements,conflicts '
                           'FROM assist_trips WHERE device=?', (device,)).fetchall()
    trip_days = {}
    for trip_id, ended_at, measured, final, basis, engaged, disengaged, conflicts in trip_rows:
        day_key = _utc(ended_at).astimezone(tz).date()
        day = days.setdefault(day_key, _empty())
        counts = trip_days.setdefault(day_key, {'trips': 0, 'measured_trips': 0, 'engagements': 0,
                                                'disengagements': 0, 'conflicts': 0})
        counts['trips'] += 1
        counts['conflicts'] += conflicts or 0
        if measured:
            counts['measured_trips'] += 1
            counts['engagements'] += engaged or 0
            counts['disengagements'] += disengaged or 0
            if final is not None and basis is not None:
                delta = final - basis
                _add(day, 'recovery_added_m' if delta > 0 else 'recovery_shortfall_m', abs(delta))
        else:
            _add(day, 'unmeasured_trip_m', final)

    lo, hi = _period_bounds(period, date, today)
    selected = {d: v for d, v in days.items() if (lo is None or lo <= d) and (hi is None or d < hi)}
    total = _empty()
    for value in selected.values():
        for key, amount in value.items():
            _add(total, key, amount)
    counts = {'trips': 0, 'measured_trips': 0, 'engagements': 0, 'disengagements': 0, 'conflicts': 0}
    for day_key, value in trip_days.items():
        if (lo is None or lo <= day_key) and (hi is None or day_key < hi):
            for key in counts:
                counts[key] += value[key]

    longest = None
    for trip_id, start_at, end_at, distance, broken in db.execute(
            'SELECT s.id,s.start_at,s.end_at,s.distance_m,s.broken FROM assist_streaks s JOIN assist_trips t '
            'ON t.device=s.device AND t.id=s.id AND t.measured=1 WHERE s.device=? ORDER BY s.distance_m DESC', (device,)):
        start_day = _utc(start_at).astimezone(tz).date()
        if (lo is None or lo <= start_day) and (hi is None or start_day < hi):
            longest = {'distance_m': distance, 'start_at': start_at, 'end_at': end_at,
                       'broken_by_gap': bool(broken), 'trip_id': trip_id}
            break
    if longest is None:
        # Streaks under 100 m are not listed (a trip's longest of 100 m or more always
        # is); only those fall back to the per-trip longest, dated by trip end.
        row = db.execute('SELECT id,longest_m,longest_s FROM assist_trips WHERE device=? AND measured=1 '
                         'AND longest_m < 100 ORDER BY longest_m DESC', (device,)).fetchall()
        for trip_id, distance, seconds in row:
            ended = next(r[1] for r in trip_rows if r[0] == trip_id)
            day_key = _utc(ended).astimezone(tz).date()
            if distance and (lo is None or lo <= day_key) and (hi is None or day_key < hi):
                longest = {'distance_m': distance, 'start_at': None, 'end_at': None, 'broken_by_gap': None,
                           'trip_id': trip_id}
                break

    active = sorted(d for d, v in days.items() if v['assist_m'] >= ACTIVE_DAY_M)
    best = run = 0
    previous = None
    for day in active:
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    active_set = set(active)
    cursor = today if today in active_set else today - timedelta(days=1)
    current = 0
    while cursor in active_set:
        current += 1
        cursor -= timedelta(days=1)

    months = {}
    for day, value in days.items():
        month = months.setdefault(day.strftime('%Y-%m'), _empty())
        for key, amount in value.items():
            _add(month, key, amount)
    return {**result, 'measured': True, 'range': {'start': lo.isoformat() if lo else None,
                                                  'end': hi.isoformat() if hi else None},
            'total': _finish(total), **counts, 'longest_streak': longest,
            'days': [{'date': d.isoformat(), 'active': v['assist_m'] >= ACTIVE_DAY_M, **_finish(v)}
                     for d, v in sorted(selected.items())],
            'months': [{'month': m, **_finish(v)} for m, v in sorted(months.items())],
            'active_days': len([d for d in active if (lo is None or lo <= d) and (hi is None or d < hi)]),
            'current_streak_days': current, 'best_streak_days': best,
            'unrecorded_estimate_m': unrecorded_estimate(db, device)}


def _period_bounds(period, date, today):
    if period in (None, 'all'):
        return None, None
    day = datetime.strptime(date, '%Y-%m-%d').date() if date else today
    if period == 'day':
        return day, day + timedelta(days=1)
    if period == 'week':
        start = day - timedelta(days=day.weekday())
        return start, start + timedelta(days=7)
    if period == 'month':
        start = day.replace(day=1)
        return start, (start + timedelta(days=32)).replace(day=1)
    if period == 'year':
        return day.replace(month=1, day=1), day.replace(year=day.year + 1, month=1, day=1)
    raise ValueError('Invalid period')


def unrecorded_estimate(db, device):
    """Odometer growth since the stats-start anchor minus recorded trip distance (estimate).

    Includes trips under 100 m, trips still waiting to upload and driving with
    Comma off; the odometer has 1 km resolution. None without both readings.
    """
    anchor = db.execute('SELECT odometer_km, odometer_at FROM assist_meta WHERE device=?', (device,)).fetchone()
    latest = _state_odometer(db, device)
    if not anchor or anchor[0] is None or not latest:
        return None
    start_at = anchor[1]
    end_at = latest[1].isoformat()
    driven = (latest[0] - anchor[0]) * 1000
    if driven < 0:
        return None
    recorded = db.execute('SELECT COALESCE(SUM(final_m),0) FROM assist_trips WHERE device=? AND started_at>=? AND ended_at<=?',
                          (device, start_at, end_at)).fetchone()[0]
    return round(max(0.0, driven - recorded), 1)

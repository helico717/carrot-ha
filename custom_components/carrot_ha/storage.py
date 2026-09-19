from contextlib import contextmanager
"""SQLite archive with durable acknowledgements and persistent deduplication."""
import bisect
import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path
from .protocol import validate

class Archive:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS events (device TEXT, id TEXT, observed TEXT, kind TEXT, body TEXT, PRIMARY KEY(device,id))')
            db.execute('CREATE INDEX IF NOT EXISTS history ON events(device,observed)')
            db.execute('CREATE INDEX IF NOT EXISTS idx_events_kind_observed ON events(kind,observed)')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        try:
            with db:
                yield db
        finally:
            db.close()

    def put(self, event):
        body = validate(event)
        with self.connect() as db:
            existing = db.execute('SELECT body FROM events WHERE device=? AND id=?', (event['device_id'], event['event_id'])).fetchone()
            if existing:
                if existing[0] != body:
                    raise ValueError('Event ID reused with different content')
                return False
            observed = datetime.fromisoformat(event['observed_at'].replace('Z', '+00:00')).astimezone(timezone.utc).isoformat()
            db.execute('INSERT INTO events VALUES (?,?,?,?,?)', (event['device_id'], event['event_id'], observed, event['kind'], body))
        return True

    def latest(self, device):
        with self.connect() as db:
            row = db.execute("SELECT body FROM events WHERE device=? AND kind='state' ORDER BY observed DESC, rowid DESC LIMIT 1", (device,)).fetchone()
        return json.loads(row[0]) if row else {}

    def put_cloud(self, event):
        """Cloud trip IDs represent mutable records; direct upload remains immutable."""
        if not event['event_id'].startswith('cloud-'):
            raise ValueError('Not a cloud event')
        body = validate(event)
        observed = datetime.fromisoformat(event['observed_at'].replace('Z', '+00:00')).astimezone(timezone.utc).isoformat()
        with self.connect() as db:
            db.execute('INSERT INTO events VALUES (?,?,?,?,?) ON CONFLICT(device,id) DO UPDATE SET observed=excluded.observed, kind=excluded.kind, body=excluded.body',
                       (event['device_id'], event['event_id'], observed, event['kind'], body))

    def history(self, device, kind, limit=100, offset=0, since=None):
        if kind not in ('state', 'trip', 'charge') or not 1 <= limit <= 500 or offset < 0:
            raise ValueError('Invalid history query')
        if since is not None:
            since = datetime.fromisoformat(since.replace('Z', '+00:00'))
            if since.tzinfo is None:
                raise ValueError('History boundary must include a timezone')
            since = since.astimezone(timezone.utc).isoformat()
        with self.connect() as db:
            if since is None:
                rows = db.execute('SELECT body FROM events WHERE device=? AND kind=? ORDER BY observed DESC, rowid DESC LIMIT ? OFFSET ?', (device, kind, limit, offset)).fetchall()
            else:
                rows = db.execute("SELECT body FROM events WHERE device=? AND kind=? AND julianday(COALESCE(json_extract(body, '$.data.started_at'), observed)) >= julianday(?) ORDER BY julianday(COALESCE(json_extract(body, '$.data.started_at'), observed)) DESC, rowid DESC LIMIT ? OFFSET ?", (device, kind, since, limit, offset)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def overview(self, device):
        try:
            from zoneinfo import ZoneInfo
            kst = ZoneInfo('Asia/Seoul')
        except Exception:
            from datetime import timedelta
            kst = timezone(timedelta(hours=9))
        month = datetime.now(kst).strftime('%Y-%m')
        with self.connect() as db:
            rows = db.execute("SELECT observed,json_extract(body,'$.data.distance_m') FROM events WHERE device=? AND kind='trip'",(device,)).fetchall()
        def _to_kst(ts):
            try: return datetime.fromisoformat(ts).astimezone(kst).strftime('%Y-%m')
            except Exception: return ''
        current = [r for r in rows if _to_kst(r[0])==month]
        summary = {'trip_count':len(rows),'recorded_distance_km':round(sum(r[1] or 0 for r in rows)/1000,2),'month_trip_count':len(current),'month_distance_km':round(sum(r[1] or 0 for r in current)/1000,2)}
        trips = self.history(device,'trip',1)
        if trips:
            trip = trips[0]['data']
            summary.update(last_trip_distance_km=round((trip.get('distance_m') or 0)/1000,2),last_trip_duration_s=int(round(trip['duration_s'])) if trip.get('duration_s') is not None else None,last_trip_at=trips[0]['observed_at'])
            route = trip.get('route') or []
            if route: summary['last_trip_parking'] = dict(route[-1],measured_at=trip.get('ended_at'))
            summary['last_trip_avg_kph'] = round(trip['distance_m']/trip['duration_s']*3.6,1) if trip.get('duration_s') and trip.get('distance_m') is not None else None
            speeds = [p.get('speedMps',p.get('speed_mps')) for p in route]
            speeds = [v for v in speeds if isinstance(v,(int,float))]
            summary['last_trip_max_kph'] = round(max(speeds)*3.6,1) if speeds else None
        return summary

    def cursor(self, name, value=None):
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS cursors (name TEXT PRIMARY KEY,value INTEGER)')
            if value is not None: db.execute('INSERT INTO cursors VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value',(name,value))
            row = db.execute('SELECT value FROM cursors WHERE name=?',(name,)).fetchone()
        return row[0] if row else 0

    def purge_expired(self, state_days=14, trip_days=90, charge_days=90, slim_trip_days=14):
        """Purge expired records while maintaining dashboard and sensor integrity.
        - state: 14 days (covers 7-day battery chart with safety margin)
        - trip: 90 days (covers current and previous month distance/count totals)
        - charge: 90 days (covers history view)
        - slim trips older than slim_trip_days: clears route points to save 95% space while keeping summary stats.
        """
        counts = {'purged_state': 0, 'purged_trip': 0, 'purged_charge': 0, 'slimmed_trip': 0}
        with self.connect() as db:
            cur = db.execute(
                "DELETE FROM events WHERE kind='state' AND julianday('now') - julianday(observed) > ?",
                (state_days,)
            )
            counts['purged_state'] = cur.rowcount

            cur = db.execute(
                "DELETE FROM events WHERE kind='charge' AND julianday('now') - julianday(observed) > ?",
                (charge_days,)
            )
            counts['purged_charge'] = cur.rowcount

            cur = db.execute(
                "DELETE FROM events WHERE kind='trip' AND julianday('now') - julianday(observed) > ?",
                (trip_days,)
            )
            counts['purged_trip'] = cur.rowcount

            if slim_trip_days is not None and slim_trip_days < trip_days:
                cur = db.execute(
                    """
                    UPDATE events
                    SET body = json_set(body, '$.data.route', json('[]'))
                    WHERE kind='trip'
                      AND julianday('now') - julianday(observed) > ?
                      AND json_extract(body, '$.data.route') IS NOT NULL
                      AND json_extract(body, '$.data.route') != '[]'
                    """,
                    (slim_trip_days,)
                )
                counts['slimmed_trip'] = cur.rowcount
        return counts

    def vacuum(self):
        """Reclaim freed database pages from the filesystem."""
        conn = sqlite3.connect(self.path, timeout=30)
        try:
            conn.isolation_level = None
            conn.execute('VACUUM')
        finally:
            conn.close()

    def enrich_trips_energy(self, device, trips, capacity_kwh=78.0):
        """Enrich trip events with energy consumption data from nearby state events.

        For each trip, finds the nearest battery_wh readings around the start and
        end times from state events. Adds energy_wh, efficiency_km_kwh, and
        soc_used_percent to trip data in-memory (does not modify the database).
        """
        if not trips:
            return trips

        # Collect all trip time boundaries to determine query range
        boundaries = []
        for trip in trips:
            data = trip.get('data', {})
            for key in ('started_at', 'ended_at'):
                ts = data.get(key)
                if ts:
                    boundaries.append(ts)
        if not boundaries:
            return trips

        def _parse_ts(ts):
            return datetime.fromisoformat(ts.replace('Z', '+00:00')).astimezone(timezone.utc)

        parsed = []
        for b in boundaries:
            try:
                parsed.append(_parse_ts(b))
            except (ValueError, TypeError):
                continue
        if not parsed:
            return trips

        # Expand range by 5 minutes on each side for nearest-neighbor lookup
        from datetime import timedelta
        min_time = (min(parsed) - timedelta(minutes=5)).isoformat()
        max_time = (max(parsed) + timedelta(minutes=5)).isoformat()

        # Single query: fetch all state events with battery_wh in the range
        with self.connect() as db:
            rows = db.execute(
                """SELECT
                    COALESCE(
                        json_extract(body, '$.data.field_measured_at.battery_wh'),
                        observed
                    ) AS ts,
                    json_extract(body, '$.data.battery_wh') AS wh
                FROM events
                WHERE device=? AND kind='state'
                    AND observed >= ? AND observed <= ?
                    AND json_extract(body, '$.data.battery_wh') IS NOT NULL
                ORDER BY observed""",
                (device, min_time, max_time)
            ).fetchall()

        if not rows:
            return trips

        # Build sorted (epoch, battery_wh) samples
        samples = []
        for ts_str, wh in rows:
            if wh is None:
                continue
            try:
                t = _parse_ts(ts_str).timestamp()
                samples.append((t, float(wh)))
            except (ValueError, TypeError):
                continue
        if not samples:
            return trips

        sample_times = [s[0] for s in samples]

        def _nearest_wh(target_ts, max_gap_s=300):
            """Find battery_wh closest to target_ts within max_gap_s."""
            try:
                t = _parse_ts(target_ts).timestamp()
            except (ValueError, TypeError):
                return None
            idx = bisect.bisect_left(sample_times, t)
            best_wh = None
            best_gap = max_gap_s + 1
            for i in (idx - 1, idx):
                if 0 <= i < len(samples):
                    gap = abs(samples[i][0] - t)
                    if gap < best_gap:
                        best_wh = samples[i][1]
                        best_gap = gap
            return best_wh if best_gap <= max_gap_s else None

        # Enrich each trip
        for trip in trips:
            data = trip.get('data', {})
            started = data.get('started_at')
            ended = data.get('ended_at')
            if not started or not ended:
                continue

            start_wh = _nearest_wh(started)
            end_wh = _nearest_wh(ended)

            if start_wh is not None and end_wh is not None:
                energy_wh = round(start_wh - end_wh, 1)
                data['start_battery_wh'] = round(start_wh, 1)
                data['end_battery_wh'] = round(end_wh, 1)
                data['energy_wh'] = energy_wh
                data['soc_used_percent'] = round(energy_wh / (capacity_kwh * 1000) * 100, 1)

                distance_m = data.get('distance_m')
                if energy_wh > 0 and isinstance(distance_m, (int, float)) and distance_m > 0:
                    data['efficiency_km_kwh'] = round((distance_m / 1000) / (energy_wh / 1000), 1)

        return trips


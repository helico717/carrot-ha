from contextlib import contextmanager
"""SQLite archive with durable acknowledgements and persistent deduplication."""
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


from contextlib import contextmanager
"""SQLite archive with durable acknowledgements and persistent deduplication."""
import bisect
import math
import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path
from .protocol import validate
from . import trip_repair

class Archive:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        self._derived_ready = set()
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS events (device TEXT, id TEXT, observed TEXT, kind TEXT, body TEXT, PRIMARY KEY(device,id))')
            db.execute('CREATE TABLE IF NOT EXISTS trip_derivations (device TEXT, id TEXT, body TEXT, PRIMARY KEY(device,id))')
            db.execute('CREATE TABLE IF NOT EXISTS trip_energy (device TEXT, id TEXT, fingerprint TEXT, distance_km REAL, energy_kwh REAL, PRIMARY KEY(device,id))')
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
        self._derived_ready.discard(event['device_id'])
        return True

    def _ensure_derivations(self, device):
        if device not in self._derived_ready:
            with self.connect() as db:
                trip_repair.refresh(db, device)
                # Update retained caches across month boundaries, not just the
                # currently displayed month. Missing evidence preserves kWh.
                cached_rows = db.execute("""SELECT te.id,te.fingerprint,te.energy_kwh,e.body,d.body
                    FROM trip_energy te JOIN events e ON e.device=te.device AND e.id=te.id
                    JOIN trip_derivations d ON d.device=te.device AND d.id=te.id
                    WHERE te.device=?""", (device,)).fetchall()
                for key, cached_fp, kwh, event_body, derived_body in cached_rows:
                    data = json.loads(event_body)['data']
                    derived = json.loads(derived_body)
                    old_fp = json.loads(cached_fp)
                    new_fp = [data.get(k) for k in ('started_at','ended_at','distance_m','partial')]
                    energy = derived.get('energy')
                    if (old_fp[:2] != new_fp[:2] or old_fp[3:] != new_fp[3:]
                            or derived.get('energy_rejected')
                            or (energy and not energy.get('summary_eligible'))):
                        db.execute('DELETE FROM trip_energy WHERE device=? AND id=?',(device,key))
                        continue
                    km = (derived['distance_m'] if derived.get('distance_m') is not None else data.get('distance_m',0))/1000
                    if energy:
                        kwh = energy['energy_wh']/1000
                    db.execute('UPDATE trip_energy SET fingerprint=?,distance_km=?,energy_kwh=? WHERE device=? AND id=?',
                               (json.dumps(new_fp),km,kwh,device,key))
            self._derived_ready.add(device)

    def repair_trips(self, device):
        """Explicit backfill; source events remain byte-for-byte unchanged."""
        self._derived_ready.discard(device)
        self._ensure_derivations(device)
        with self.connect() as db:
            return [dict(id=key, **json.loads(body)) for key,body in db.execute(
                'SELECT id,body FROM trip_derivations WHERE device=?', (device,))]

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
        self._derived_ready.discard(event['device_id'])

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
        events = [json.loads(row[0]) for row in rows]
        if kind == 'trip':
            self._ensure_derivations(device)
            with self.connect() as db:
                derived = {key:json.loads(body) for key,body in db.execute('SELECT id,body FROM trip_derivations WHERE device=?',(device,))}
            events = [trip_repair.apply(event, derived.get(event['event_id'])) for event in events]
        return events

    def overview(self, device):
        self._ensure_derivations(device)
        try:
            from zoneinfo import ZoneInfo
            kst = ZoneInfo('Asia/Seoul')
        except Exception:
            from datetime import timedelta
            kst = timezone(timedelta(hours=9))
        month = datetime.now(kst).strftime('%Y-%m')
        with self.connect() as db:
            rows = db.execute("SELECT e.observed,COALESCE(json_extract(d.body,'$.distance_m'),json_extract(e.body,'$.data.distance_m')) FROM events e LEFT JOIN trip_derivations d ON e.device=d.device AND e.id=d.id WHERE e.device=? AND e.kind='trip'",(device,)).fetchall()
        def _to_kst(ts):
            try: return datetime.fromisoformat(ts).astimezone(kst).strftime('%Y-%m')
            except Exception: return ''
        current = [r for r in rows if _to_kst(r[0])==month]
        summary = {'trip_count':len(rows),'recorded_distance_km':round(sum(r[1] or 0 for r in rows)/1000,2),'month_trip_count':len(current),'month_distance_km':round(sum(r[1] or 0 for r in current)/1000,2)}
        summary.update(self.driving_energy_summary(device, month, kst, summary['month_distance_km']))
        summary.update(self._recent_efficiency(device))
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

    def _recent_efficiency(self, device, max_trips=20, min_distance_km=5):
        """Compute efficiency from the most recent trips with measured energy.

        Uses the trip_energy cache table which persists across months.
        Returns efficiency only when at least min_distance_km of measured data exists.
        """
        with self.connect() as db:
            # Join trip_energy with events to get ordering by observed time.
            # trip_energy rows are keyed by (device, event_id) matching events.
            rows = db.execute(
                """SELECT te.distance_km, te.energy_kwh
                   FROM trip_energy te
                   JOIN events e ON te.device = e.device AND te.id = e.id
                   WHERE te.device = ? AND te.energy_kwh > 0 AND te.distance_km >= 1
                   ORDER BY e.observed DESC
                   LIMIT ?""",
                (device, max_trips)
            ).fetchall()
        if not rows:
            return {}
        total_km = sum(r[0] for r in rows)
        total_kwh = sum(r[1] for r in rows)
        if total_km < min_distance_km or total_kwh < 0.5:
            return {}
        return {
            'recent_efficiency_kpl': round(total_km / total_kwh, 2),
            'recent_efficiency_trip_count': len(rows),
            'recent_efficiency_distance_km': round(total_km, 1),
        }

    def driving_energy_summary(self, device, month, tz, total_distance):
        """Persist matched trip energy independently of the 14-day raw state retention.

        Only measured Wh within a trip are used (not SOC calibration or charging).
        Keep signed depletion: downhill recovery must offset other trips' consumption.
        Missing/partial/short trips reduce coverage instead of inventing consumption.
        """
        def timestamp(value):
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                raise ValueError('Timezone required')
            return dt.timestamp()

        self._ensure_derivations(device)
        distance = energy = 0.0
        count = 0
        with self.connect() as db:
            rows = db.execute("SELECT id, observed, body FROM events WHERE device=? AND kind='trip'", (device,)).fetchall()
            for event_id, observed, body in rows:
                if datetime.fromisoformat(observed).astimezone(tz).strftime('%Y-%m') != month:
                    continue
                trip = json.loads(body)['data']
                fingerprint = json.dumps([trip.get(k) for k in ('started_at', 'ended_at', 'distance_m', 'partial')])
                derived_row = db.execute('SELECT body FROM trip_derivations WHERE device=? AND id=?',(device,event_id)).fetchone()
                derived = json.loads(derived_row[0]) if derived_row else None
                trip_repair.apply({'data':trip}, derived)
                if trip.get('energy_rejected') or (trip.get('energy_verified') and not trip.get('energy_verified_for_summary')):
                    db.execute('DELETE FROM trip_energy WHERE device=? AND id=?',(device,event_id))
                    continue
                cached = db.execute('SELECT fingerprint,distance_km,energy_kwh FROM trip_energy WHERE device=? AND id=?', (device, event_id)).fetchone()
                if cached and cached[0] != fingerprint:
                    # A distance-only revision must not destroy retained measured kWh.
                    before, after = json.loads(cached[0]), json.loads(fingerprint)
                    if before[:2] == after[:2] and before[3:] == after[3:]:
                        cached = (fingerprint, float(trip.get('distance_m') or 0)/1000, cached[2])
                        db.execute('UPDATE trip_energy SET fingerprint=?,distance_km=? WHERE device=? AND id=?',
                                   (fingerprint,cached[1],device,event_id))
                    else:
                        db.execute('DELETE FROM trip_energy WHERE device=? AND id=?', (device, event_id))
                        cached = None
                if cached:
                    effective_km = float(trip.get('distance_m') or 0)/1000
                    db.execute('UPDATE trip_energy SET distance_km=? WHERE device=? AND id=?',(effective_km,device,event_id))
                    cached = (cached[0], effective_km, cached[2])
                    distance += cached[1]
                    energy += cached[2]
                    count += 1
                    continue
                try:
                    start, end = timestamp(trip['started_at']), timestamp(trip['ended_at'])
                    km = float(trip['distance_m']) / 1000
                except (KeyError, ValueError, TypeError, OverflowError):
                    continue
                if trip.get('energy_verified_for_summary') and end-start >= 300 and math.isfinite(km) and km >= 1:
                    used = trip['energy_wh']/1000
                    db.execute('INSERT OR REPLACE INTO trip_energy VALUES (?,?,?,?,?)',(device,event_id,fingerprint,km,used))
                    distance += km
                    energy += used
                    count += 1
                    continue
                if trip.get('partial') or end-start < 300 or not math.isfinite(km) or km < 1:
                    continue
                # Indexed receive-time range; actual field timestamp determines eligibility.
                lo = datetime.fromtimestamp(start, timezone.utc).isoformat()
                hi = datetime.fromtimestamp(end+180, timezone.utc).isoformat()
                states = db.execute("SELECT body FROM events WHERE device=? AND kind='state' AND observed>=? AND observed<=? ORDER BY observed", (device, lo, hi)).fetchall()
                samples = {}
                contaminated = False
                for (state_body,) in states:
                    state_event = json.loads(state_body)
                    state = state_event['data']
                    try:
                        t = timestamp((state.get('field_measured_at') or {}).get('battery_wh') or state.get('measured_at') or state_event['observed_at'])
                        wh = state.get('battery_wh')
                        if type(wh) not in (int, float) or not math.isfinite(wh) or not 0 <= wh <= 150000:
                            continue
                        if start <= t <= end:
                            if state.get('charging') is True or state.get('stale') is True:
                                contaminated = True
                            samples[t] = wh
                    except (ValueError, TypeError, AttributeError, OverflowError):
                        continue
                if contaminated or len(samples) < 2:
                    continue
                first, last = min(samples), max(samples)
                gaps = (first-start) + (end-last)
                if first-start > 90 or end-last > 90 or gaps > (end-start)*0.1:
                    continue
                used = (samples[first]-samples[last])/1000
                db.execute('INSERT OR REPLACE INTO trip_energy VALUES (?,?,?,?,?)', (device, event_id, fingerprint, km, used))
                distance += km
                energy += used
                count += 1
        return {'month_energy_distance_km': round(distance, 3),
                'month_drive_energy_kwh': round(energy, 3) if count else None,
                'month_energy_trip_count': count,
                'month_energy_coverage_percent': round(min(100, distance/total_distance*100), 1) if total_distance > 0 else None}

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
        # Preserve derivations and energy for every retained month before raw purge.
        with self.connect() as db:
            devices = [r[0] for r in db.execute('SELECT DISTINCT device FROM events')]
        for device in devices:
            self._ensure_derivations(device)
            from zoneinfo import ZoneInfo
            tz = ZoneInfo('Asia/Seoul')
            with self.connect() as db:
                dates = db.execute("SELECT observed FROM events WHERE device=? AND kind='trip'",(device,)).fetchall()
            for month in {datetime.fromisoformat(r[0]).astimezone(tz).strftime('%Y-%m') for r in dates}:
                self.driving_energy_summary(device, month, tz, 0)
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
            db.execute("DELETE FROM trip_energy WHERE NOT EXISTS (SELECT 1 FROM events WHERE events.device=trip_energy.device AND events.id=trip_energy.id AND events.kind='trip')")

            db.execute("DELETE FROM trip_derivations WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.device=trip_derivations.device AND e.id=trip_derivations.id AND e.kind='trip')")

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
        for trip in trips:
            data = trip.get('data', {})
            if data.get('energy_verified'):
                self._format_trip_energy(data, capacity_kwh)

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

        # Single query: fetch all state events with battery_wh or soc_percent in the range
        with self.connect() as db:
            rows = db.execute(
                """SELECT
                    COALESCE(
                        json_extract(body, '$.data.field_measured_at.battery_wh'),
                        json_extract(body, '$.data.field_measured_at.soc_percent'),
                        observed
                    ) AS ts,
                    json_extract(body, '$.data.battery_wh') AS wh,
                    json_extract(body, '$.data.soc_percent') AS soc
                FROM events
                WHERE device=? AND kind='state'
                    AND julianday(observed) >= julianday(?) AND julianday(observed) <= julianday(?)
                    AND (json_extract(body, '$.data.battery_wh') IS NOT NULL
                         OR json_extract(body, '$.data.soc_percent') IS NOT NULL)
                ORDER BY observed""",
                (device, min_time, max_time)
            ).fetchall()

        if not rows:
            return trips

        # Build sorted (epoch, battery_wh, soc_percent) samples
        samples = []
        for ts_str, wh, soc in rows:
            if wh is None and soc is None:
                continue
            try:
                t = _parse_ts(ts_str).timestamp()
                if wh is not None:
                    wh_val = float(wh)
                    soc_val = min(100.0, max(0.0, wh_val / (capacity_kwh * 1000) * 100))
                else:
                    soc_val = float(soc)
                    wh_val = (soc_val / 100.0) * (capacity_kwh * 1000)
                samples.append((t, wh_val, soc_val))
            except (ValueError, TypeError):
                continue
        if not samples:
            return trips

        samples.sort(key=lambda sample: sample[0])
        sample_times = [s[0] for s in samples]

        def _nearest_sample(target_ts, max_gap_s=300):
            """Find (battery_wh, soc_percent) closest to target_ts within max_gap_s."""
            try:
                t = _parse_ts(target_ts).timestamp()
            except (ValueError, TypeError):
                return None
            idx = bisect.bisect_left(sample_times, t)
            best_sample = None
            best_gap = max_gap_s + 1
            for i in (idx - 1, idx):
                if 0 <= i < len(samples):
                    gap = abs(samples[i][0] - t)
                    if gap < best_gap:
                        best_sample = samples[i]
                        best_gap = gap
            return best_sample if best_gap <= max_gap_s else None

        # Enrich each trip
        for trip in trips:
            data = trip.get('data', {})
            if data.get('energy_verified') or data.get('energy_rejected'):
                continue
            started = data.get('started_at')
            ended = data.get('ended_at')
            if not started or not ended:
                continue

            start_sample = _nearest_sample(started)
            end_sample = _nearest_sample(ended)

            if start_sample is not None and end_sample is not None:
                start_wh, start_soc = start_sample[1], start_sample[2]
                end_wh, end_soc = end_sample[1], end_sample[2]
                energy_wh = round(start_wh - end_wh, 1)
                data['start_battery_wh'] = round(start_wh, 1)
                data['end_battery_wh'] = round(end_wh, 1)
                data['start_soc_percent'] = round(min(100.0, max(0.0, start_soc)), 1)
                data['end_soc_percent'] = round(min(100.0, max(0.0, end_soc)), 1)
                data['energy_wh'] = energy_wh
                data['soc_used_percent'] = round(energy_wh / (capacity_kwh * 1000) * 100, 1)

                distance_m = data.get('distance_m')
                if energy_wh > 0 and isinstance(distance_m, (int, float)) and distance_m > 0:
                    data['efficiency_km_kwh'] = round((distance_m / 1000) / (energy_wh / 1000), 1)

        return trips


    @staticmethod
    def _format_trip_energy(data, capacity_kwh):
        for boundary in ('start', 'end'):
            data[boundary+'_soc_percent'] = round(min(100,max(0,data[boundary+'_battery_wh']/(capacity_kwh*1000)*100)),1)
        data['soc_used_percent'] = round(data['energy_wh']/(capacity_kwh*1000)*100,1)
        if data['energy_wh'] > 0 and data.get('distance_m',0) > 0:
            data['efficiency_km_kwh'] = round(data['distance_m']/data['energy_wh'],1)

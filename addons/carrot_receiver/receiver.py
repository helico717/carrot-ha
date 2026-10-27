"""Independent durable vehicle receiver. No Home Assistant or cloud dependency."""
from __future__ import annotations

import asyncio
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import json
import logging
import math
from pathlib import Path
import sqlite3
import time
from urllib.parse import urlsplit
import uuid
import zlib
import traceback

from diagnostics import Diagnostics, configure as configure_logging, request_id, vehicle_label

from aiohttp import web

LOG = logging.getLogger('carrot_receiver')
MAX_BODY = 1048576


def stamp():
    return datetime.now(timezone.utc).isoformat()


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('invalid_timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timezone_required')
    return result.astimezone(timezone.utc).isoformat()


def encoded(value):
    return json.dumps(value, allow_nan=False, sort_keys=True, separators=(',', ':'))


def packed(value):
    return zlib.compress(encoded(value).encode(), 6)


def unpacked(value):
    return json.loads(zlib.decompress(value))


def base_url(value, local=False):
    url = urlsplit(value)
    if (url.scheme not in (('http', 'https') if local else ('https',)) or not url.hostname
            or url.username or url.password or url.query or url.fragment
            or any(ord(c) <= 32 for c in value)):
        raise ValueError('invalid_url')
    return value.rstrip('/')


def healthy_panda(body, previous):
    """Preserve the Worker's counter-delta semantics, including reboot baselines."""
    panda = body.get('panda')
    if not isinstance(panda, dict):
        return
    before = (previous or {}).get('panda') or {}
    if not isinstance(before, dict):
        before = {}
    missing = object()
    def integer(value):
        if value is missing:
            return None
        try:
            number = float(value if value is not None else 0)
            return int(number) if math.isfinite(number) and number >= 0 else None
        except (TypeError, ValueError):
            return None
    fields = ('rxBufferOverflow', 'txBufferOverflow', 'spiErrorCount')
    current = {key: integer(panda.get(key, missing)) for key in fields}
    old = {key: integer(before.get(key, missing)) for key in fields}
    uptime, old_uptime = integer(panda.get('uptimeS', missing)), integer(before.get('uptimeS', missing))
    same = (previous is not None and uptime is not None and old_uptime is not None and uptime >= old_uptime
            and all(current[key] is not None and old[key] is not None and current[key] >= old[key] for key in fields))
    delta = {key: current[key] - old[key] if same else None for key in fields}
    new_overflow = bool(same and (delta['rxBufferOverflow'] > 0 or delta['txBufferOverflow'] > 0))
    fault = (str(panda.get('faultStatus') or '').lower() not in ('', 'none')
             or isinstance(panda.get('faults'), list) and bool(panda['faults'])
             or panda.get('heartbeatLost') is True or panda.get('safetyRxChecksInvalid') is True)
    interval = None
    if previous:
        interval = max(0, math.floor((datetime.fromisoformat(timestamp(body['updatedAt']))
                                     - datetime.fromisoformat(timestamp(previous['updatedAt']))).total_seconds() + 0.5))
    assessment = ('newCanOverflowWithActiveFault' if new_overflow and fault else
                  'newCanOverflowCounterIncrease' if new_overflow else
                  'okNoNewCanOverflow' if same else 'baselineEstablished')
    panda['counterHealth'] = {'assessment': assessment, 'shouldAlert': new_overflow,
        'newCanOverflowObserved': new_overflow, 'activeFaultCorroborated': fault, 'samePandaBoot': bool(same),
        'sampleIntervalSeconds': interval, 'currentUptimeS': uptime, 'previousUptimeS': old_uptime,
        'deltaSincePreviousSample': delta, 'cumulativeSincePandaBoot': current,
        'semantics': 'Alert only when shouldAlert is true. Cumulative totals alone are historical.'}


def has_location(gps):
    return all(type(gps.get(key)) in (int, float) and math.isfinite(gps[key]) and -180 <= gps[key] <= 180
               for key in ('latitude', 'longitude'))


def trip_measurements(raw):
    if not isinstance(raw, dict):
        return None
    def point(value):
        if not isinstance(value, dict) or not isinstance(value.get('at'), str):
            return None
        try:
            datetime.fromisoformat(value['at'].replace('Z', '+00:00'))
        except ValueError:
            return None
        def bounded(key, maximum):
            number = value.get(key)
            return number if type(number) in (int, float) and math.isfinite(number) and 0 <= number <= maximum else None
        wh, soc = bounded('battery_wh', 150000), bounded('soc_percent', 100)
        if wh is None and soc is None:
            return None
        result = {'at': value['at'], 'battery_wh': wh, 'soc_percent': soc}
        # Cluster-SOC candidate (bus1 0x14A) for comparison only. Added only when
        # the collector sent it, so older trips keep their exact API output.
        if 'display_soc_candidate_percent' in value:
            display_at = value.get('display_soc_candidate_measured_at')
            try:
                datetime.fromisoformat(display_at.replace('Z', '+00:00'))
            except (AttributeError, ValueError):
                display_at = None
            display = bounded('display_soc_candidate_percent', 100)
            result.update(display_soc_candidate_percent=display if display_at else None,
                          display_soc_candidate_measured_at=display_at if display is not None else None)
        return result
    return {'start': point(raw.get('start')), 'end': point(raw.get('end')), 'complete': raw.get('complete') is True}


class Store:
    def __init__(self, path, max_bytes=1073741824):
        self.path = str(path)
        self.max_bytes = max_bytes
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS telemetry(
                  sequence INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT NOT NULL,
                  at TEXT NOT NULL, raw BLOB NOT NULL, UNIQUE(device,at));
                CREATE INDEX IF NOT EXISTS telemetry_device_sequence ON telemetry(device,sequence);
                CREATE TABLE IF NOT EXISTS latest(device TEXT PRIMARY KEY,at TEXT NOT NULL,raw BLOB NOT NULL);
                CREATE TABLE IF NOT EXISTS trips(
                  sequence INTEGER PRIMARY KEY AUTOINCREMENT,device TEXT NOT NULL,
                  id TEXT NOT NULL,ended TEXT NOT NULL,raw BLOB NOT NULL,UNIQUE(device,id));
                CREATE INDEX IF NOT EXISTS trips_device_sequence ON trips(device,sequence);
                CREATE TABLE IF NOT EXISTS settings(device TEXT PRIMARY KEY,raw TEXT NOT NULL,at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS commands(
                  id INTEGER PRIMARY KEY AUTOINCREMENT,device TEXT NOT NULL,param_name TEXT NOT NULL,
                  param_value TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
                  created_at TEXT NOT NULL,applied_at TEXT);
                CREATE INDEX IF NOT EXISTS commands_device_status_id ON commands(device,status,id);
                CREATE TABLE IF NOT EXISTS activity(device TEXT PRIMARY KEY,until REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS bootstrap(device TEXT PRIMARY KEY,raw TEXT NOT NULL,until REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS acknowledgements(device TEXT PRIMARY KEY,telemetry INTEGER NOT NULL,
                  trips INTEGER NOT NULL,at TEXT NOT NULL);
            ''')
            db.execute('INSERT OR IGNORE INTO meta VALUES (?,?)', ('identity', str(uuid.uuid4())))
            self.identity = db.execute("SELECT value FROM meta WHERE key='identity'").fetchone()[0]
        self.checkpoint()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA synchronous=FULL')
        try:
            with db:
                yield db
        finally:
            db.close()

    def checkpoint(self):
        with self.connect() as db:
            db.execute('PRAGMA wal_checkpoint(TRUNCATE)')

    def backup(self, path):
        # SQLite online backup includes committed WAL rows; never copy only the DB file.
        with self.connect() as source:
            destination = sqlite3.connect(path)
            try:
                source.backup(destination)
                if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('backup_integrity')
            finally:
                destination.close()

    def capacity(self):
        size = sum(Path(self.path + suffix).stat().st_size for suffix in ('', '-wal')
                   if Path(self.path + suffix).exists())
        if size >= self.max_bytes:
            raise OverflowError('receiver_capacity')

    def receive(self, kind, device, body):
        if kind == 'telemetry':
            at = timestamp(body.get('updatedAt'))
            raw = packed(body)
            with self.connect() as db:
                exists = db.execute('SELECT 1 FROM telemetry WHERE device=? AND at=?', (device, at)).fetchone()
                if not exists:
                    self.capacity()
                    db.execute('INSERT INTO telemetry(device,at,raw) VALUES (?,?,?)', (device, at, raw))
                previous = db.execute('SELECT at,raw FROM latest WHERE device=?', (device,)).fetchone()
                if not previous or at >= previous['at']:
                    enriched = json.loads(encoded(body))
                    before = unpacked(previous['raw']) if previous else None
                    gps = enriched.get('gps') or {}
                    if has_location(gps):
                        enriched['gps'] = {**gps, 'fresh': gps.get('fresh') is not False,
                                           'source': gps.get('source') or 'telemetry'}
                    else:
                        last_trip = db.execute('SELECT raw FROM trips WHERE device=? ORDER BY ended DESC LIMIT 1', (device,)).fetchone()
                        trip = unpacked(last_trip['raw']) if last_trip else {}
                        end = (trip.get('route') or [{}])[-1]
                        last = {'latitude': trip.get('endLat', end.get('latitude')),
                                'longitude': trip.get('endLon', end.get('longitude'))}
                        if has_location(last):
                            enriched['gps'] = {**last, 'fresh': False, 'source': 'latestTrip',
                                'timestampMillis': datetime.fromisoformat(timestamp(trip['endedAt'])).timestamp() * 1000}
                        elif before and has_location(before.get('gps') or {}):
                            enriched['gps'] = {**before['gps'], 'fresh': False, 'source': 'lastKnown'}
                    # Identical latest retries keep the previously computed delta.
                    if previous and at == previous['at']:
                        if exists:
                            stored = db.execute('SELECT raw FROM telemetry WHERE device=? AND at=?', (device, at)).fetchone()
                            if unpacked(stored['raw']) == body:
                                enriched = before
                            elif isinstance(enriched.get('panda'), dict) and isinstance(before.get('panda'), dict):
                                enriched['panda']['counterHealth'] = before['panda'].get('counterHealth')
                    else:
                        healthy_panda(enriched, before)
                    db.execute('''INSERT INTO latest VALUES (?,?,?) ON CONFLICT(device) DO UPDATE
                        SET at=excluded.at,raw=excluded.raw''', (device, at, packed(enriched)))
            LOG.debug('telemetry_committed duplicate=%s', bool(exists))
            return {'ok': True}
        identity = body.get('id')
        if not isinstance(identity, str) or not 1 <= len(identity) <= 128:
            raise ValueError('invalid_trip_id')
        ended = timestamp(body.get('endedAt'))
        timestamp(body.get('startedAt'))
        for field in ('distanceM', 'durationS'):
            value = body.get(field)
            if value is not None and (type(value) not in (int, float) or not math.isfinite(value) or value < 0):
                raise ValueError('invalid_trip_measurement')
        if not isinstance(body.get('route', []), list):
            raise ValueError('invalid_route')
        with self.connect() as db:
            previous = db.execute('SELECT raw FROM trips WHERE device=? AND id=?', (device, identity)).fetchone()
            if previous:
                old = unpacked(previous['raw'])
                # Same COALESCE behavior as the existing trip API.
                if body.get('tripMeasurements') is None and old.get('tripMeasurements') is not None:
                    body = {**body, 'tripMeasurements': old['tripMeasurements']}
                if 'partial' not in body and 'partial' in old:
                    body = {**body, 'partial': old['partial']}
            raw = packed(body)
            if not previous or previous['raw'] != raw:
                self.capacity()
                # New revision on material changes; identical retries do not advance the cursor.
                db.execute('DELETE FROM trips WHERE device=? AND id=?', (device, identity))
                db.execute('INSERT INTO trips(device,id,ended,raw) VALUES (?,?,?,?)', (device, identity, ended, raw))
        LOG.info('trip_committed changed=%s', not previous or previous['raw'] != raw)
        return {'ok': True, 'id': identity}

    @staticmethod
    def trip(row):
        raw = unpacked(row['raw'])
        route = raw.get('route', [])
        result = {'id': raw['id'], 'device_id': row['device'], 'started_at': raw.get('startedAt'),
                  'ended_at': raw['endedAt'], 'duration_s': raw.get('durationS'),
                  'distance_m': raw.get('distanceM'), 'route': route, 'route_point_count': len(route),
                  'partial': raw.get('partial') if type(raw.get('partial')) is bool else None,
                  'trip_measurements': trip_measurements(raw.get('tripMeasurements')),
                  'distance_source': raw.get('distanceSource'), 'distance_quality': raw.get('distanceQuality'),
                  'sync_sequence': row['sequence']}
        speeds = []
        for point in route:
            if not isinstance(point, dict):
                continue
            missing = object()
            value = next((point[key] for key in ('speedMps', 'speed_mps') if point.get(key) is not None),
                         point.get('speed', missing))
            if value is missing:
                continue
            try:
                value = 0 if value is None or isinstance(value, str) and not value.strip() else float(value)
            except (TypeError, ValueError):
                continue
            if math.isfinite(value):
                speeds.append(value)
        result['max_speed_mps'] = max(speeds) if speeds else None
        start, end = route[0] if route else {}, route[-1] if route else {}
        for field, key, point in (('start_lat', 'startLat', start), ('start_lon', 'startLon', start),
                                  ('end_lat', 'endLat', end), ('end_lon', 'endLon', end)):
            result[field] = raw.get(key, point.get('latitude' if field.endswith('lat') else 'longitude'))
        if result['distance_source'] in ('can_speed', 'odometer_gap_recovery', 'legacy_gps'):
            quality = result['distance_quality'] or {}
            result['distance_quality'] = {'complete': quality.get('complete') is True, 'estimated': quality.get('estimated') is True}
        else:
            result['distance_source'] = result['distance_quality'] = None
        return result

    def latest(self, device):
        with self.connect() as db:
            row = db.execute('SELECT * FROM latest WHERE device=?', (device,)).fetchone()
        if not row:
            return {'state': None}
        body = unpacked(row['raw'])
        return {'state': {'device_id': device, 'updated_at': body['updatedAt'],
                          'onroad': body.get('onroad'), 'raw_json': body}}

    def history(self, kind, device, after, limit):
        table = 'telemetry' if kind == 'telemetry' else 'trips'
        with self.connect() as db:
            rows = db.execute(f'SELECT * FROM {table} WHERE device=? AND sequence>? ORDER BY sequence LIMIT ?',
                              (device, after, limit + 1)).fetchall()
        page = rows[:limit]
        if kind == 'telemetry':
            return {'events': [{'sequence': row['sequence'], 'device_id': device,
                                'raw_json': encoded(unpacked(row['raw']))} for row in page],
                    'has_more': len(rows) > limit}
        return {'schema': 'carrot-trip-changes-v1', 'trips': [self.trip(row) for row in page],
                'next_cursor': page[-1]['sequence'] if page else after, 'has_more': len(rows) > limit}

    def ack(self, device, body):
        values = [body.get('telemetry_sequence'), body.get('trip_sequence')]
        if any(type(value) is not int or value < 0 for value in values):
            raise ValueError('invalid_ack')
        with self.connect() as db:
            for table, value in zip(('telemetry', 'trips'), values):
                # sqlite_sequence persists even after pruning all rows.
                maximum = db.execute('SELECT seq FROM sqlite_sequence WHERE name=?', (table,)).fetchone()
                if value > (maximum['seq'] if maximum else 0):
                    raise ValueError('invalid_ack')
            db.execute('''INSERT INTO acknowledgements VALUES (?,?,?,?) ON CONFLICT(device) DO UPDATE
                SET telemetry=MAX(telemetry,excluded.telemetry),trips=MAX(trips,excluded.trips),at=excluded.at''',
                       (device, *values, stamp()))
        LOG.info('archive_ack durable_telemetry=%d durable_trips=%d', *values)
        return {'ok': True}

    def maintenance(self):
        # Only HA-durable, expired records; no unreceived data discarded to make room.
        with self.connect() as db:
            total = 0
            for table, cursor, days, field in (('telemetry', 'telemetry', 14, 'at'), ('trips', 'trips', 90, 'ended')):
                cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
                total += db.execute(f'''DELETE FROM {table} WHERE sequence IN (
                    SELECT t.sequence FROM {table} t JOIN acknowledgements a ON a.device=t.device
                    WHERE t.sequence<=a.{cursor} AND t.{field}<? LIMIT 200)''', (cutoff,)).rowcount
            db.execute("DELETE FROM commands WHERE status!='pending' AND created_at<?",
                       ((datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),))
            db.execute('DELETE FROM bootstrap WHERE until<?', (time.time() * 1000,))
        self.checkpoint()
        return total

    def settings_sync(self, device, body):
        catalog, values = body.get('catalog'), body.get('values')
        if isinstance(catalog, str):
            catalog = json.loads(catalog)
        if isinstance(values, str):
            values = json.loads(values)
        if not isinstance(catalog, dict) or not isinstance(values, dict):
            raise ValueError('invalid_settings')
        data, at = encoded({'catalog': catalog, 'values': values}), stamp()
        with self.connect() as db:
            db.execute('INSERT INTO settings VALUES (?,?,?) ON CONFLICT(device) DO UPDATE SET raw=excluded.raw,at=excluded.at',
                       (device, data, at))
        LOG.info('settings_committed values=%d', len(values))
        return {'ok': True, 'updated_at': at}

    def settings(self, device, query):
        with self.connect() as db:
            row = db.execute('SELECT * FROM settings WHERE device=?', (device,)).fetchone()
            if not row:
                raise LookupError('settings_not_found')
            if query.get('active') == '1':
                db.execute('INSERT INTO activity VALUES (?,?) ON CONFLICT(device) DO UPDATE SET until=excluded.until',
                           (device, time.time() + 120))
            if query.get('known') == row['at']:
                return {'ok': True, 'unchanged': True, 'device_id': device, 'updated_at': row['at']}
            pending = db.execute("SELECT COUNT(*) FROM commands WHERE device=? AND status='pending'", (device,)).fetchone()[0]
        return {'ok': True, **json.loads(row['raw']), 'device_id': device, 'updated_at': row['at'],
                'pending_count': pending, 'param_queue_protocol': 1}

    def queue(self, device, body):
        settings = self.settings(device, {})
        catalog = settings['catalog']
        definitions = [item for group in catalog.get('items_by_group', {}).values() for item in group]
        definitions = definitions or catalog.get('params') or catalog.get('items') or []
        definitions = {item['name']: item for item in definitions}
        entries = ([(body['param_name'], body.get('param_value'))] if 'param_name' in body
                   else list(body.get('params', {}).items()))
        if not 1 <= len(entries) <= 200:
            raise ValueError('invalid_params_payload')
        for name, value in entries:
            definition = definitions.get(name)
            if definition is None or value is None or value == '' or type(value) not in (str, int, float, bool):
                raise ValueError('invalid_parameter')
            number = float(value)
            if not math.isfinite(number) or not float(definition['min']) <= number <= float(definition['max']):
                raise ValueError('invalid_parameter')
        at, ids = stamp(), []
        with self.connect() as db:
            for name, value in entries:
                value = str(int(value)) if isinstance(value, bool) else str(value)
                ids.append(db.execute('INSERT INTO commands(device,param_name,param_value,created_at) VALUES (?,?,?,?)',
                                      (device, name, value, at)).lastrowid)
        LOG.info('commands_queued count=%d', len(ids))
        return {'ok': True, 'queued': len(ids), 'ids': ids, 'at': at}

    def pending(self, device):
        with self.connect() as db:
            db.execute("UPDATE commands SET status='expired' WHERE device=? AND status='pending' AND created_at<?",
                       (device, (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()))
            rows = db.execute("SELECT id,param_name,param_value,created_at FROM commands WHERE device=? AND status='pending' ORDER BY id LIMIT 50",
                              (device,)).fetchall()
            activity = db.execute('SELECT until FROM activity WHERE device=?', (device,)).fetchone()
        return {'ok': True, 'pending': [dict(row) for row in rows], 'queue_namespace': self.identity,
                'poll_after_s': 3 if rows or activity and activity['until'] > time.time() else 15}

    def command_ack(self, device, body):
        groups = [(status, body.get(key, [])) for status, key in (('applied', 'applied_ids'), ('failed', 'failed_ids'))]
        ids = [identity for _, items in groups for identity in items]
        if len(ids) > 200 or any(type(i) is not int or i <= 0 for i in ids):
            raise ValueError('invalid_ack')
        if body.get('queue_namespace') != self.identity:
            raise ValueError('invalid_queue_namespace')
        with self.connect() as db:
            for status, items in groups:
                for identity in items:
                    db.execute("UPDATE commands SET status=?,applied_at=? WHERE device=? AND id=? AND status='pending'",
                               (status, stamp(), device, identity))
        LOG.info('commands_ack applied=%d failed=%d', len(groups[0][1]), len(groups[1][1]))
        return {'ok': True, 'acked': len(ids)}

    def command_status(self, device, query):
        with self.connect() as db:
            if query.get('ids'):
                ids = query['ids'].split(',')
                if len(ids) > 200 or any(not item.isdecimal() for item in ids):
                    raise ValueError('invalid_ids')
                rows = db.execute(f"SELECT * FROM commands WHERE device=? AND id IN ({','.join('?' for _ in ids)})",
                                  (device, *ids)).fetchall()
            else:
                rows = db.execute('SELECT * FROM commands WHERE device=? ORDER BY id DESC LIMIT 20', (device,)).fetchall()
        return {'ok': True, 'queue': [{k: row[k] for k in ('id', 'param_name', 'param_value', 'status', 'created_at', 'applied_at')}
                                     for row in rows]}

    def discovery(self, device, body=None, credentials=()):
        with self.connect() as db:
            if body is not None:
                if body.get('enabled') is False:
                    db.execute('DELETE FROM bootstrap WHERE device=?', (device,))
                    return {'ok': True}
                url = base_url(body['ha_url'])
                token = body['terminal_token']
                if (not isinstance(token, str) or not 32 <= len(token) <= 256 or not token.isascii()
                        or any(c.isspace() for c in token) or token in credentials or urlsplit(url).path):
                    raise ValueError('invalid_config')
                expiry = time.time() * 1000 + 180000
                config = {'ha_url': url, 'terminal_token': token, 'expires_at': expiry}
                db.execute('INSERT INTO bootstrap VALUES (?,?,?) ON CONFLICT(device) DO UPDATE SET raw=excluded.raw,until=excluded.until',
                           (device, encoded(config), expiry))
                return {'ok': True}
            row = db.execute('SELECT raw FROM bootstrap WHERE device=? AND until>?', (device, time.time() * 1000)).fetchone()
        return {'protocol': 1, 'config': json.loads(row['raw']) if row else None}


def create_app(config, store):
    diagnostics = Diagnostics(LOG)
    devices = config['devices']
    for item in devices:
        if not isinstance(item.get('device_id'), str) or not 1 <= len(item['device_id']) <= 128:
            raise ValueError('invalid_device')
        for key in ('upload_token', 'view_token'):
            value = item.get(key, '')
            if not isinstance(value, str) or not 32 <= len(value) <= 256 or not value.isascii() or any(c.isspace() for c in value):
                raise ValueError('invalid_token')
        if item['upload_token'] == item['view_token']:
            raise ValueError('distinct_credentials_required')
        provision = item.get('provision_token')
        if provision and (not isinstance(provision, str) or not 32 <= len(provision) <= 256
                          or not provision.isascii() or any(c.isspace() for c in provision)):
            raise ValueError('invalid_provision_token')
    all_tokens = [item[key] for item in devices for key in ('upload_token', 'view_token')]
    if len(set(all_tokens)) != len(all_tokens):
        raise ValueError('duplicate_credentials')

    async def handler(request):
        path = request.path
        if path == '/health' and request.method == 'GET':
            return web.json_response({'ok': True, 'schema': 'carrot-receiver-v1', 'version': '0.1.4'})
        if path == '/api/source' and request.method != 'GET':
            raise web.HTTPMethodNotAllowed(request.method, ['GET'])
        upload = (path in ('/api/telemetry', '/api/trips', '/api/settings/sync', '/api/params/ack') and request.method == 'POST'
                  or path in ('/api/params/pending', '/api/terminal/bootstrap'))
        key = 'provision_token' if path == '/api/provision' else 'upload_token' if upload else 'view_token'
        credential = request.headers.get('Authorization', '').removeprefix('Bearer ')
        item = next((item for item in devices if item.get(key) and hmac.compare_digest(item[key].encode(), credential.encode())), None)
        if item is None:
            return web.json_response({'error': 'unauthorized'}, status=401)
        device = item['device_id']
        vehicle_label.set('vehicle-' + str(devices.index(item) + 1))
        body = await request.json() if request.method == 'POST' else None
        if body is not None and not isinstance(body, dict):
            raise ValueError('object_required')
        provided = request.query.get('device_id') if body is None else body.get('deviceId', body.get('device_id', request.query.get('device_id')))
        if provided != device:
            return web.json_response({'error': 'device_mismatch'}, status=403)
        q = request.query
        call, args = None, ()
        if path == '/api/provision' and request.method == 'POST':
            public_url = base_url(config.get('public_url', ''))
            LOG.info('connection_provisioned transport=direct')
            return web.json_response({'config': {'transport': 'direct', 'url': public_url,
                'device': device, 'token': item['upload_token']}}, headers={'Cache-Control': 'no-store'})
        if path == '/api/source' and request.method == 'GET':
            return web.json_response({'schema': 'carrot-receiver-v1', 'source_id': store.identity, 'device_id': device})
        if path in ('/api/telemetry', '/api/trips') and request.method == 'POST':
            call, args = store.receive, (path.rsplit('/', 1)[1], device, body)
        elif path == '/api/latest-state' and request.method == 'GET':
            call, args = store.latest, (device,)
        elif path in ('/api/telemetry-history', '/api/trip-changes') and request.method == 'GET':
            after, limit = int(q.get('after', 0)), int(q.get('limit', 100 if path.endswith('history') else 10))
            if after < 0 or not 1 <= limit <= 100:
                raise ValueError('invalid_cursor')
            call, args = store.history, ('telemetry' if path.endswith('history') else 'trips', device, after, limit)
        elif path == '/api/archive-ack' and request.method == 'POST':
            call, args = store.ack, (device, body)
        elif path == '/api/settings/sync' and request.method == 'POST':
            call, args = store.settings_sync, (device, body)
        elif path == '/api/settings' and request.method == 'GET':
            call, args = store.settings, (device, q)
        elif path == '/api/params/queue' and request.method == 'POST':
            call, args = store.queue, (device, body)
        elif path == '/api/params/pending' and request.method == 'GET':
            call, args = store.pending, (device,)
        elif path == '/api/params/ack' and request.method == 'POST':
            call, args = store.command_ack, (device, body)
        elif path == '/api/params/status' and request.method == 'GET':
            call, args = store.command_status, (device, q)
        elif path == '/api/terminal/bootstrap' and request.method in ('GET', 'POST'):
            call, args = store.discovery, (device, body, all_tokens)
        else:
            return web.json_response({'error': 'not_found'}, status=404)
        result = await asyncio.to_thread(call, *args)
        return web.json_response(result, headers={'Cache-Control': 'no-store'})

    @web.middleware
    async def errors(request, handler):
        start = time.perf_counter()
        context = request_id.set(uuid.uuid4().hex[:12])
        vehicle_context = vehicle_label.set('-')
        error_type, status = None, 500
        try:
            response = await handler(request)
            status = response.status
            return response
        except web.HTTPException as error:
            status, error_type = error.status, type(error).__name__
            raise
        except OverflowError:
            status, error_type = 503, 'receiver_capacity'
            return web.json_response({'error': 'receiver_capacity', 'retryable': True}, status=503)
        except LookupError:
            status, error_type = 404, 'settings_not_found'
            return web.json_response({'error': 'settings_not_found'}, status=404)
        except (ValueError, TypeError, KeyError):
            status, error_type = 400, 'invalid_request'
            return web.json_response({'error': 'invalid_request'}, status=400)
        except Exception as error:
            status, error_type = 503, type(error).__name__
            frames = ['%s:%d:%s' % (Path(frame.filename).name, frame.lineno, frame.name)
                      for frame in traceback.extract_tb(error.__traceback__)[-8:]]
            LOG.debug('storage_error_frames=%s', ' '.join(frames))
            return web.json_response({'error': 'storage_unavailable', 'retryable': True}, status=503)
        finally:
            diagnostics.record(request.method, request.path, status, (time.perf_counter() - start) * 1000, error_type)
            vehicle_label.reset(vehicle_context)
            request_id.reset(context)

    app = web.Application(client_max_size=MAX_BODY, middlewares=[errors])
    app.router.add_route('*', '/{path:.*}', handler)

    async def maintenance(app):
        async def summaries():
            deadline = time.monotonic() + config.get('debug_minutes', 15) * 60
            while True:
                await asyncio.sleep(60)
                diagnostics.summary()
                if config.get('log_level') == 'DEBUG' and LOG.level == logging.DEBUG and time.monotonic() >= deadline:
                    LOG.setLevel(logging.INFO)
                    LOG.info('debug_window_expired log_level=INFO')
        async def loop():
            while True:
                await asyncio.sleep(3600)
                try:
                    removed = await asyncio.to_thread(store.maintenance)
                    LOG.info('Maintenance removed %d acknowledged expired records', removed)
                except Exception as error:
                    LOG.error('Maintenance deferred (%s)', type(error).__name__)
        task = asyncio.create_task(loop())
        summary_task = asyncio.create_task(summaries())
        LOG.info('receiver_started version=0.1.4 devices=%d database_limit_mb=%d log_level=%s',
                 len(devices), store.max_bytes // 1048576, logging.getLevelName(LOG.level))
        yield
        task.cancel()
        summary_task.cancel()
        await asyncio.gather(task, summary_task, return_exceptions=True)
        diagnostics.summary()
        await asyncio.to_thread(store.checkpoint)
        LOG.info('receiver_stopped database_checkpoint=complete')
    app.cleanup_ctx.append(maintenance)
    return app


if __name__ == '__main__':
    import os
    data = Path(os.environ.get('CARROT_RECEIVER_DATA', '/data'))
    config = json.loads((data / 'options.json').read_text())
    configure_logging(data, config.get('log_level', 'INFO'))
    store = Store(data / 'receiver.sqlite3', int(config.get('max_database_mb', 1024)) * 1048576)
    web.run_app(create_app(config, store), host='0.0.0.0', port=8099, access_log=None)

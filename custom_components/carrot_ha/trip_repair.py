"""Conservative, reproducible historical trip derivation; never rewrites events."""
import bisect
import hashlib
import json
import math
from datetime import datetime

VERSION = 2


def timestamp(value):
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt.timestamp() if dt.tzinfo else None
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def fingerprint(data):
    return json.dumps([data.get(k) for k in ('started_at', 'ended_at', 'distance_m', 'duration_s', 'partial')])


def route_points(data):
    route = data.get('route') or (data.get('cloud_raw_trip') or {}).get('route') or []
    if isinstance(route, str):
        try:
            route = json.loads(route)
        except (ValueError, TypeError):
            return []
    return route if isinstance(route, list) else []


def route_digest(route):
    return hashlib.sha256(json.dumps(route, sort_keys=True).encode()).hexdigest() if route else None


def haversine(a, b):
    p, q = math.radians(a['latitude']), math.radians(b['latitude'])
    h = math.sin((q-p)/2)**2 + math.cos(p)*math.cos(q)*math.sin(math.radians(b['longitude']-a['longitude'])/2)**2
    return 12742000 * math.asin(min(1, math.sqrt(max(0, h))))


def route_summary(route, start, end):
    """Only use chronological, plausible points; never bridge arbitrary jumps."""
    if len(route) < 2:
        return None
    total = 0.0
    gaps = 0
    previous = None
    for point in route:
        if not isinstance(point, dict):
            return None
        lat, lon = point.get('latitude'), point.get('longitude')
        t = timestamp(point.get('t') or point.get('time'))
        accuracy = point.get('accuracyM')
        if (not finite(lat) or not finite(lon) or abs(lat) > 90 or abs(lon) > 180
                or t is None or not start-5 <= t <= end+5
                or (accuracy is not None and (not finite(accuracy) or not 0 <= accuracy <= 100))):
            return None
        if previous:
            pt, pp = previous
            dt = t-pt
            d = haversine(pp, point)
            if dt <= 0 or d > max(100, dt*60):
                return None
            total += d
            gaps += dt > 20
        previous = t, point
    return {'distance_m': round(total, 1), 'gap_count': gaps,
            'first_at': route[0].get('t') or route[0].get('time'),
            'last_at': route[-1].get('t') or route[-1].get('time')}


class Samples:
    def __init__(self, rows):
        self.fields = {'odometer_km': {}, 'battery_wh': {}}
        self.invalid = {key: set() for key in self.fields}
        for observed, odo, odo_at, wh, wh_at, measured, stale, charging, driving in rows:
            for key, value, at in [('odometer_km', odo, odo_at), ('battery_wh', wh, wh_at)]:
                t = timestamp(at or measured or observed)
                if t is None:
                    continue
                if not finite(value) or value < 0 or stale:
                    if value is not None:
                        self.invalid[key].add(t)
                    continue
                if key == 'battery_wh' and value > 150000:
                    continue
                # A repeated field measurement is one sample, not new evidence.
                self.fields[key].setdefault(t, (value, bool(charging), driving))
        self.times = {k: sorted(v) for k, v in self.fields.items()}
        self.invalid = {k: sorted(v-self.fields[k].keys()) for k,v in self.invalid.items()}

    def has_invalid(self, key, start, end):
        times = self.invalid[key]
        i = bisect.bisect_left(times, start)
        return i < len(times) and times[i] <= end

    def nearest(self, key, target, maximum=90):
        times = self.times[key]
        i = bisect.bisect_left(times, target)
        candidates = times[max(0, i-1):i+1]
        if not candidates:
            return None
        t = min(candidates, key=lambda x: abs(x-target))
        if abs(t-target) > maximum:
            return None
        value, charging, driving = self.fields[key][t]
        return {'at': t, 'value': value, 'gap_s': round(abs(t-target), 3),
                'charging': charging, 'driving': driving}

    def window(self, key, start, end):
        times = self.times[key]
        return [(t, self.fields[key][t]) for t in times[bisect.bisect_left(times,start):bisect.bisect_right(times,end)]]


def source_fingerprint(data):
    return json.dumps([data.get('distance_source'), data.get('distance_quality')], sort_keys=True)


def derive(data, samples, old=None):
    fp = fingerprint(data)
    route = route_points(data)
    digest = route_digest(route)
    source_fp = source_fingerprint(data)
    start, end = timestamp(data.get('started_at')), timestamp(data.get('ended_at'))
    result = {'version': VERSION, 'fingerprint': fp, 'route_digest': digest,
              'source_fingerprint': source_fp, 'status': 'unchanged',
              'reason': 'insufficient_evidence', 'distance_m': None}
    if start is None or end is None or not 0 < end-start <= 86400:
        return result
    # Algorithm upgrades do not erase the last validated result. Source changes
    # and changed available routes do invalidate it. Version-1 records had no
    # source fingerprint, so migrate them only for the legacy GPS source.
    compatible = (old and old.get('fingerprint') == fp
                  and old.get('source_fingerprint', json.dumps([None, None])) == source_fp
                  and (not digest or old.get('route_digest') == digest))
    if compatible:
        result.update(old)
        result.update(version=VERSION, source_fingerprint=source_fp)
        if old.get('distance_m') is not None:
            result['distance_version'] = old.get('distance_version', old.get('version', 1))
        if old.get('energy'):
            result['energy_version'] = old.get('energy_version', old.get('version', 1))

    # Distance-only revisions do not change the battery measurement window.
    # Preserve its endpoints separately from the distance fingerprint.
    if old and old.get('energy'):
        try:
            same_window = json.loads(old['fingerprint'])[:2] == json.loads(fp)[:2]
        except (KeyError, ValueError, TypeError):
            same_window = False
        if same_window:
            result['energy'] = old['energy']
            result['energy_version'] = old.get('energy_version', old.get('version', 1))

    quality = data.get('distance_quality') or {}
    source = data.get('distance_source')
    incomplete_can = source == 'can_speed' and quality.get('complete') is False
    trusted_distance = ((source == 'can_speed' and quality.get('complete') is True)
                        or (source == 'odometer_gap_recovery' and quality.get('estimated') is True))
    summary = route_summary(route, start, end)
    # The retained geometric summary can be checked against late odometer data
    # after route thinning. An available but invalid route cannot use this path.
    if not route and compatible:
        summary = old.get('gps')
    if summary:
        result['gps'] = summary
    a, b = samples.nearest('odometer_km', start), samples.nearest('odometer_km', end)
    has_odometer = a is not None and b is not None
    if has_odometer:
        odo_m = (b['value']-a['value'])*1000
        window = samples.window('odometer_km', a['at'], b['at'])
        monotonic = all(y[1][0] >= x[1][0] for x,y in zip(window,window[1:]))
        result['odometer'] = {'start': a, 'end': b, 'distance_m': odo_m}
        result['route_verified'] = bool(summary and a['at'] < b['at'] and monotonic
            and 0 <= odo_m <= (end-start)*60
            and abs(summary['distance_m']-odo_m) <= max(2000, odo_m*0.03)
            and timestamp(summary['first_at'])-start <= 90
            and end-timestamp(summary['last_at']) <= 90)
    invalid_route = bool(route) and summary is None
    contradicted = (invalid_route or (has_odometer and not result.get('route_verified'))
                    or samples.has_invalid('odometer_km', start, end))
    if contradicted:
        result.update(distance_m=None, status='unchanged', reason='evidence_conflict', route_verified=False)
        result.pop('estimated', None)
        result.pop('distance_version', None)
    elif summary and has_odometer and result.get('route_verified'):
        raw = data.get('distance_m')
        gps_m = summary['distance_m']
        repairable_source = source in (None, 'legacy_gps') or incomplete_can
        if (not trusted_distance and repairable_source and (summary['gap_count'] or incomplete_can)
                and finite(raw) and raw >= 0 and gps_m-raw > max(200, raw*0.01) and gps_m >= 1000):
            result.update(distance_m=gps_m, status='corrected', estimated=True, distance_version=VERSION,
                          reason='gps_gap_reconstruction_odometer_checked')
        elif has_odometer and route:
            result.update(distance_m=None, status='unchanged', reason='no_supported_distance_loss')
            result.pop('estimated', None)
            result.pop('distance_version', None)

    result['distance_incomplete'] = incomplete_can and result.get('distance_m') is None
    energy_eligible = (not result['distance_incomplete']
                       and (not data.get('partial') or trusted_distance or result.get('route_verified', False)))
    a, b = samples.nearest('battery_wh', start), samples.nearest('battery_wh', end)
    window = samples.window('battery_wh', min(start,a['at']) if a else start,
                            max(end,b['at']) if b else end)
    contaminated = any(v[1] for _,v in window) or samples.has_invalid('battery_wh', start, end)
    # Missing raw samples preserve prior evidence. Present conflicting evidence
    # clears it explicitly, including summary caches and legacy UI enrichment.
    result['energy_rejected'] = not energy_eligible or contaminated
    if a and b:
        result.pop('energy', None)
        boundary_gap = a['gap_s']+b['gap_s']
        energy = a['value']-b['value']
        valid = (energy_eligible and not contaminated and a['at'] < b['at']
                 and boundary_gap <= min(90, (end-start)*0.1)
                 and abs(energy)*3600/(end-start) <= 250000)
        result['energy_rejected'] = not valid
        if valid:
            result['energy'] = {'start': a, 'end': b, 'energy_wh': round(energy,1),
                               'summary_eligible': a['at'] >= start and b['at'] <= end}
            result['energy_version'] = VERSION
    if result['energy_rejected']:
        result.pop('energy', None)
        result.pop('energy_version', None)
    return result


def refresh(db, device):
    trips = db.execute("SELECT id,body FROM events WHERE device=? AND kind='trip'", (device,)).fetchall()
    if not trips:
        return
    rows = db.execute("""SELECT observed,
        json_extract(body,'$.data.odometer_km'), json_extract(body,'$.data.field_measured_at.odometer_km'),
        json_extract(body,'$.data.battery_wh'), json_extract(body,'$.data.field_measured_at.battery_wh'),
        json_extract(body,'$.data.measured_at'), json_extract(body,'$.data.stale'),
        json_extract(body,'$.data.charging'), json_extract(body,'$.data.driving')
        FROM events WHERE device=? AND kind='state' ORDER BY observed""", (device,)).fetchall()
    samples = Samples(rows)
    old = {key: json.loads(body) for key,body in db.execute('SELECT id,body FROM trip_derivations WHERE device=?',(device,))}
    for key, body in trips:
        data = json.loads(body)['data']
        result = derive(data, samples, old.get(key))
        db.execute('INSERT INTO trip_derivations VALUES (?,?,?) ON CONFLICT(device,id) DO UPDATE SET body=excluded.body',
                   (device,key,json.dumps(result,allow_nan=False)))


def apply(event, derived):
    data = event['data']
    quality = data.get('distance_quality') or {}
    if quality.get('estimated') is True:
        data['distance_estimated'] = True
    if (not derived or derived.get('fingerprint') != fingerprint(data)
            or derived.get('source_fingerprint', source_fingerprint(data)) != source_fingerprint(data)):
        return event
    data['energy_rejected'] = derived.get('energy_rejected', False)
    data['distance_incomplete'] = derived.get('distance_incomplete', False)
    if derived.get('distance_m') is not None:
        data['distance_raw_m'] = data['distance_m']
        data['distance_m'] = derived['distance_m']
        data['distance_source'] = derived['reason']
        data['distance_estimated'] = True
        data['distance_correction_version'] = derived.get('distance_version', derived['version'])
    if derived.get('energy'):
        energy = derived['energy']
        data['start_battery_wh'] = energy['start']['value']
        data['end_battery_wh'] = energy['end']['value']
        data['energy_wh'] = energy['energy_wh']
        data['energy_verified'] = True
        data['energy_verified_for_summary'] = energy.get('summary_eligible', False)
    return event

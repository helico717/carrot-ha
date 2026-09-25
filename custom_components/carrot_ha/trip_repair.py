"""Conservative, reproducible historical trip derivation; never rewrites events."""
import bisect
import hashlib
import json
import math
from datetime import datetime

VERSION = 1


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
        for observed, odo, odo_at, wh, wh_at, measured, stale, charging, driving in rows:
            for key, value, at in [('odometer_km', odo, odo_at), ('battery_wh', wh, wh_at)]:
                t = timestamp(at or measured or observed)
                if t is None or not finite(value) or value < 0 or stale:
                    continue
                if key == 'battery_wh' and value > 150000:
                    continue
                # A repeated field measurement is one sample, not new evidence.
                self.fields[key].setdefault(t, (value, bool(charging), driving))
        self.times = {k: sorted(v) for k, v in self.fields.items()}

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


def derive(data, samples, old=None):
    fp = fingerprint(data)
    route = route_points(data)
    digest = route_digest(route)
    start, end = timestamp(data.get('started_at')), timestamp(data.get('ended_at'))
    result = {'version': VERSION, 'fingerprint': fp, 'route_digest': digest,
              'status': 'unchanged', 'reason': 'insufficient_evidence', 'distance_m': None}
    if start is None or end is None or not 0 < end-start <= 86400:
        return result
    old_valid = (old and old.get('version') == VERSION and old.get('fingerprint') == fp
                 and (not digest or old.get('route_digest') == digest))
    # Retain validated evidence when the raw retention policy has removed it.
    if old_valid:
        result.update(old)
    summary = route_summary(route, start, end)
    trusted_distance = data.get('distance_source') in ('can_speed', 'odometer_gap_recovery')
    if summary:
        result['gps'] = summary
    a, b = samples.nearest('odometer_km', start), samples.nearest('odometer_km', end)
    if a and b and a['at'] < b['at']:
        odo_m = (b['value']-a['value'])*1000
        window = samples.window('odometer_km', a['at'], b['at'])
        monotonic = all(y[1][0] >= x[1][0] for x,y in zip(window,window[1:]))
        result['odometer'] = {'start': a, 'end': b, 'distance_m': odo_m}
        raw = data.get('distance_m')
        if summary and finite(raw) and raw >= 0 and monotonic and 0 <= odo_m <= (end-start)*60:
            gps_m = summary['distance_m']
            # Quantized odometer is corroboration, not the short-trip distance.
            corroborated = abs(gps_m-odo_m) <= max(2000, odo_m*0.03)
            complete_route = (timestamp(summary['first_at'])-start <= 90
                              and end-timestamp(summary['last_at']) <= 90)
            result['route_verified'] = corroborated and complete_route
            if (not trusted_distance and summary['gap_count'] and gps_m-raw > max(200, raw*0.01)
                    and corroborated and complete_route and gps_m >= 1000):
                result.update(distance_m=gps_m, status='corrected',
                              reason='gps_gap_reconstruction_odometer_checked', estimated=True)
            elif not old_valid:
                result['reason'] = 'no_supported_distance_loss' if corroborated else 'gps_odometer_disagree'
    # Energy is independently verified, even when GPS gaps marked the trip partial.
    # Only certify partial records with the same route + odometer corroboration.
    energy_eligible = not data.get('partial') or result.get('route_verified', False)
    a, b = samples.nearest('battery_wh', start), samples.nearest('battery_wh', end)
    if energy_eligible and a and b and a['at'] < b['at']:
        boundary_gap = a['gap_s']+b['gap_s']
        window = samples.window('battery_wh', min(start,a['at']), max(end,b['at']))
        contaminated = a['charging'] or b['charging'] or any(v[1] for _,v in window)
        if not contaminated and boundary_gap <= min(90, (end-start)*0.1):
            energy = a['value']-b['value']
            if abs(energy)*3600/(end-start) <= 250000:
                result['energy'] = {'start': a, 'end': b, 'energy_wh': round(energy,1),
                                    'summary_eligible': a['at'] >= start and b['at'] <= end}
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
    if not derived or derived.get('fingerprint') != fingerprint(event['data']):
        return event
    data = event['data']
    if derived.get('distance_m') is not None:
        data['distance_raw_m'] = data['distance_m']
        data['distance_m'] = derived['distance_m']
        data['distance_source'] = derived['reason']
        data['distance_estimated'] = True
        data['distance_correction_version'] = derived['version']
    if derived.get('energy'):
        energy = derived['energy']
        data['start_battery_wh'] = energy['start']['value']
        data['end_battery_wh'] = energy['end']['value']
        data['energy_wh'] = energy['energy_wh']
        data['energy_verified'] = True
        data['energy_verified_for_summary'] = energy.get('summary_eligible', False)
    return event

"""Timestamp-aware live speed and parking selection (no extra queries)."""
import math
from datetime import datetime, timezone


def timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.timestamp() if parsed.tzinfo else None
    except (ValueError, TypeError, AttributeError):
        return None


def valid_point(point):
    return all(type(point.get(k)) in (int, float) and math.isfinite(point[k])
               and abs(point[k]) <= limit for k, limit in [('latitude', 90), ('longitude', 180)])


def location_values(data, now):
    gps = data.get('gps') or {}
    at = timestamp(gps.get('measured_at'))
    age = now.timestamp() - at if at is not None else None
    fresh = age is not None and 0 <= age <= 30 and gps.get('fresh') is not False
    speed = gps.get('speedMps')
    result = {'gps_measured_at': gps.get('measured_at'), 'gps_fresh': fresh,
              'speed_kph': round(speed * 3.6, 1) if fresh and type(speed) in (int, float) and math.isfinite(speed) and speed >= 0 else None}
    candidates = []
    for source, point in [('parked_gps', data.get('parking')), ('last_trip_gps', data.get('last_trip_parking'))]:
        point = point or {}
        recorded = timestamp(point.get('measured_at') or point.get('t'))
        if valid_point(point) and recorded is not None and recorded <= now.timestamp():
            candidates.append((recorded, source == 'parked_gps', source, point))
    if not candidates:
        result.update(parking_latitude=None, parking_longitude=None, parking_at=None,
                      parking_gps_at=None, parking_estimated=False, parking_source=None)
        return result
    _, _, source, point = max(candidates, key=lambda item: item[:2])
    gps_at = point.get('gps_measured_at') or point.get('t') or point.get('measured_at')
    result.update(parking_latitude=point['latitude'], parking_longitude=point['longitude'],
                  parking_at=point.get('measured_at') or point.get('t'), parking_gps_at=gps_at,
                  parking_estimated=source == 'last_trip_gps', parking_source=source)
    return result

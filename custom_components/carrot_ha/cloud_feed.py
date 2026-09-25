"""Read the same cloud response as MyID4 v1.20; no vehicle upload logic."""
import hashlib
import json
from datetime import datetime, timedelta
from .protocol import validate

def parse_feed(feed, device_id):
    if not isinstance(feed, dict):
        raise ValueError('Cloud response must be an object')
    events = []
    state = feed.get('state')
    if state:
        raw = state.get('raw_json') or {}
        if isinstance(raw, str):
            raw = json.loads(raw)
        source_device = state.get('device_id') or raw.get('deviceId')
        if source_device and source_device != device_id:
            raise ValueError('Cloud returned a different vehicle')
        data = dict(raw.get('vehicle') or {})
        data.update(gps=raw.get('gps') or {}, onroad=state.get('onroad'), enabled=raw.get('enabled'), cloud_raw_state=state)
        if 'driving' in data:
            data['onroad'] = data['driving']
        stamp = state['updated_at']
        events.append(envelope(device_id, 'state', stamp, stamp, data))
        for session in data.get('charge_sessions') or []:
            fix_session_start(session)
            events.append(envelope(device_id,'charge',session['id'],session['ended_at'],session))
    for trip in feed.get('trips') or []:
        if trip.get('device_id') and trip['device_id'] != device_id:
            raise ValueError('Cloud returned a different vehicle')
        route = trip.get('route', trip.get('route_json', []))
        if isinstance(route, str):
            route = json.loads(route)
        data = {'started_at': trip.get('started_at'), 'ended_at': trip['ended_at'],
                'duration_s': trip.get('duration_s'), 'distance_m': trip.get('distance_m'),
                'route': route, 'partial':trip.get('partial'), 'cloud_raw_trip': trip,
                'distance_source':trip.get('distance_source'), 'distance_quality':trip.get('distance_quality')}
        fix_session_start(data)
        events.append(envelope(device_id, 'trip', trip['id'], trip['ended_at'], data))
    return events

def fix_session_start(data):
    """Sessions uploaded without a real start time carry the upload moment instead;
    rebuild start = end - duration when the stored span cannot match the duration."""
    duration = data.get('duration_s')
    if not isinstance(duration, (int, float)) or duration <= 0:
        return
    try:
        ended = datetime.fromisoformat(str(data.get('ended_at') or '').replace('Z', '+00:00'))
        started = datetime.fromisoformat(str(data.get('started_at') or '').replace('Z', '+00:00')) if data.get('started_at') else None
    except (ValueError, TypeError):
        return
    span = (ended - started).total_seconds() if started else None
    if started is None or span < 0 or span > duration * 4 + 3600:
        data['started_at'] = (ended - timedelta(seconds=duration)).isoformat().replace('+00:00', 'Z')

def envelope(device, kind, identity, timestamp, data):
    key = hashlib.sha256(json.dumps([device, kind, identity],separators=(',', ':')).encode()).hexdigest()
    event = {'schema':1, 'device_id':device, 'event_id':'cloud-'+key, 'kind':kind, 'observed_at':timestamp, 'data':data}
    validate(event)
    return event

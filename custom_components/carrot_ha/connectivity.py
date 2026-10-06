"""Telemetry freshness, not a measurement of the device's physical power state."""
from datetime import datetime, timezone

OFFLINE_AFTER_SECONDS = 300
SYNC_FRESH_SECONDS = 180

def _age(value, now):
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            return None
        age = (now - stamp).total_seconds()
        return max(0, age) if age >= -60 else None
    except (AttributeError, TypeError, ValueError):
        return None

def connection_status(runtime, now=None):
    now = now or datetime.now(timezone.utc)
    last = (runtime.get('latest') or {}).get('observed_at')
    age = _age(last, now)
    sync_age = _age(runtime.get('cloud_last_sync'), now)
    state_ages = [_age(runtime.get(key), now) for key, status in
                  (('state_checked_at', 'state_status'), ('live_checked_at', 'live_status'))
                  if runtime.get(status) == 'ok']
    state_fresh = any(value is not None and value <= SYNC_FRESH_SECONDS for value in state_ages)
    result = {'online': None, 'last_telemetry_at': last, 'telemetry_age_seconds': age,
              'offline_after_seconds': OFFLINE_AFTER_SECONDS, 'reason': 'cloud_unavailable'}
    if not state_fresh and (runtime.get('cloud_status') not in ('ok', 'syncing') or sync_age is None or sync_age > SYNC_FRESH_SECONDS):
        return result
    if age is None:
        result['reason'] = 'missing_or_invalid_device_timestamp'
        return result
    result.update(online=age < OFFLINE_AFTER_SECONDS,
                  reason='recent_telemetry' if age < OFFLINE_AFTER_SECONDS else 'no_recent_telemetry')
    return result

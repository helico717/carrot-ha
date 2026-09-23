"""Bounded display hold for quantized battery-energy power estimates."""
from datetime import datetime
import math


def charging_power(data, runtime, now):
    raw = data.get('charge_power_w')
    if raw is None and type(data.get('charge_power_kw')) in (int, float):
        raw = data['charge_power_kw'] * 1000
    valid = type(raw) in (int, float) and math.isfinite(raw) and raw >= 0
    stamp = (data.get('field_measured_at') or {}).get('battery_wh') or data.get('measured_at')
    try:
        measured = datetime.fromisoformat(stamp.replace('Z', '+00:00')).timestamp()
        fresh = 0 <= now.timestamp() - measured <= 180
    except (ValueError, TypeError, AttributeError):
        measured, fresh = None, False
    active = data.get('charging') is True and not data.get('onroad') and not data.get('stale') and fresh
    state = runtime.get('power_hold', {})
    if state and measured is not None and measured - state['measured'] > 180:
        runtime.pop('power_hold', None)
        state = {}
    source = 'collector'
    power = raw if valid else None
    if not active or not valid:
        runtime.pop('power_hold', None)
        if not fresh or data.get('stale'):
            power = None
    elif state and measured < state['measured']:
        runtime.pop('power_hold', None)
    elif raw > 0:
        runtime['power_hold'] = {'power': raw, 'measured': measured, 'zero_since': None}
    elif state:
        if state['zero_since'] is None:
            state['zero_since'] = measured
        state['measured'] = measured
        limit = 180 if state['power'] <= 11000 else 60
        elapsed = now.timestamp() - state['zero_since']
        if 0 <= elapsed < limit:
            power, source = state['power'], 'held_last_positive'
        data['charge_power_hold_age_s'] = max(0, round(elapsed))
        data['charge_power_hold_limit_s'] = limit
    data['charge_power_raw_w'] = raw
    data['charge_power_source'] = source if power is not None else 'unavailable'
    data['charge_power_w'] = power
    data['charge_power_kw'] = round(power / 1000, 1) if power is not None else None
    return power

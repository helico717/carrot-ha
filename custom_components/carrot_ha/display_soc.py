"""Display SOC from CAN, kept independent of battery energy accounting."""
from datetime import datetime, timezone
import math

KEY = 'display_soc_candidate_percent'
SOURCE = 'can_0x14a_byte19'
VERSION = 1


def valid(value):
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 100


def display_integer(value):
    """Integer shown to users: truncate the 0.5% CAN value (58.5 -> 58), never round up."""
    if not valid(value):
        return None
    return int(math.floor(value + 1e-6))


def timestamp(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result if result.tzinfo else None
    except (ValueError, TypeError, AttributeError):
        return None


def measurement(data, observed=None, max_age=None):
    value = data.get(KEY)
    at = (data.get('field_measured_at') or {}).get(KEY)
    measured = timestamp(at)
    reference = timestamp(observed) if isinstance(observed, str) else observed
    if not valid(value) or measured is None:
        return None
    if reference is not None:
        age = (reference-measured).total_seconds()
        if age < -5 or (max_age is not None and age > max_age):
            return None
    return dict(value=float(value), at=at, source=SOURCE)


def live(data, now=None):
    now = now or datetime.now(timezone.utc)
    point = measurement(data, now)
    data['soc_percent'] = point['value'] if point else None
    data['soc_source'] = SOURCE if point else 'unavailable'
    data['soc_measured_at'] = point['at'] if point else None
    age = (now-timestamp(point['at'])).total_seconds() if point else None
    data['soc_measurement_age_s'] = age
    data['soc_stale'] = age is None or age > 180
    # Keep a sleeping car's last measurement, with its real timestamp and stale flag.
    data['field_measured_at'] = {**(data.get('field_measured_at') or {}),
                                 'soc_percent': data['soc_measured_at']}
    return point

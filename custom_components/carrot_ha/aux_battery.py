"""12V auxiliary battery level for the dashboards (observation only).

The level is judged on the voltage rounded to 0.1 V, the precision the dashboards
display, so a shown number and its colour always agree. Resting levels come from the
Oct 14-28 2026 recordings of one ID.4 (see CHANGELOG): parked voltage settles from ~12.9 V
to ~12.2 V over a day and a half, and the car wakes about hourly for 1-4 minutes with a
sag to ~11.8 V, so a low reading counts as a warning only when it lasts.

State is kept per runtime and advanced once per new measurement time, so any number of
readers/clients share one calculation and no archive query is needed.
"""
import math
from datetime import datetime, timezone

# Thresholds in tenths of a volt (rounded display precision).
NORMAL_MIN = 122        # 12.2 V and above is normal
WARN_BELOW = 120        # below 12.0 V is low
DCDC_ABOVE = 130        # 13.0 V and above: DC-DC is feeding the battery, not a battery state
HYSTERESIS = 1          # 0.1 V: climbing back to a better level needs one more step
SUSTAIN_S = 600         # low must last 10 minutes before it becomes a warning
MAX_GAP_S = 180         # a longer silence ends the run and the remembered level

LEVELS = ('ok', 'caution', 'warn')


def _tenths(voltage):
    # Same rounding as JavaScript Math.round for the positive voltages we accept.
    return int(math.floor(voltage * 10 + 0.5))


def _parse(value):
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError, AttributeError):
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp.timestamp()


class AuxBatteryTracker:
    def __init__(self):
        self.stamp = None       # measurement time of the last accepted sample
        self.level = None       # remembered level (hysteresis input)
        self.low_since = None   # first sample of the current low run
        self.result = {'level': None, 'reason': None, 'low_s': 0}

    def _reset(self):
        self.level = None
        self.low_since = None

    def observe(self, voltage, stamp, resting):
        """Feed one measurement. Out-of-order or repeated measurements are ignored."""
        if self.stamp is not None and stamp <= self.stamp:
            return self.result
        gap = None if self.stamp is None else stamp - self.stamp
        self.stamp = stamp
        if gap is None or gap > MAX_GAP_S:
            self._reset()
        if not resting:
            self._reset()
            self.result = {'level': None, 'reason': 'active', 'low_s': 0}
            return self.result
        tenths = _tenths(voltage)
        if tenths >= DCDC_ABOVE:
            self._reset()
            self.result = {'level': None, 'reason': 'dcdc', 'low_s': 0}
            return self.result

        previous = self.level
        if tenths < WARN_BELOW:
            if self.low_since is None:
                self.low_since = stamp
        else:
            self.low_since = None
        low_s = 0 if self.low_since is None else max(0, int(stamp - self.low_since))

        if previous == 'warn' and tenths < WARN_BELOW + HYSTERESIS:
            level, reason = 'warn', 'warn'
        elif tenths < WARN_BELOW:
            level = 'warn' if low_s >= SUSTAIN_S else 'caution'
            reason = 'warn' if level == 'warn' else 'low-pending'
        else:
            ok_from = NORMAL_MIN if previous in (None, 'ok') else NORMAL_MIN + HYSTERESIS
            level = 'ok' if tenths >= ok_from else 'caution'
            reason = level
        self.level = level
        self.result = {'level': level, 'reason': reason, 'low_s': low_s}
        return self.result


def apply(runtime, data, now=None):
    """Add aux_level / aux_level_reason / aux_low_minutes / aux_age_s to a values() dict."""
    now = now or datetime.now(timezone.utc)
    tracker = runtime.get('aux_battery')
    if tracker is None:
        tracker = runtime['aux_battery'] = AuxBatteryTracker()
    voltage = data.get('aux_voltage')
    stamp_text = (data.get('field_measured_at') or {}).get('aux_voltage') or data.get('measured_at')
    stamp = _parse(stamp_text)
    valid = (type(voltage) in (int, float) and math.isfinite(voltage) and 0 < voltage < 30
             and stamp is not None)
    if valid:
        resting = not (data.get('onroad') or data.get('charging'))
        result = tracker.observe(voltage, stamp, resting)
        data['aux_age_s'] = max(0, int(now.timestamp() - stamp))
    else:
        result = {'level': None, 'reason': 'no-data', 'low_s': 0}
        data['aux_age_s'] = None
    data['aux_level'] = result['level']
    data['aux_level_reason'] = result['reason']
    data['aux_low_minutes'] = result['low_s'] // 60
    return data


def seed(runtime, events):
    """Replay recent archived state events (oldest first) after a restart.

    Without it a restart would forget a low run in progress and the remembered level.
    """
    tracker = runtime.get('aux_battery')
    if tracker is None:
        tracker = runtime['aux_battery'] = AuxBatteryTracker()
    for event in events:
        data = (event or {}).get('data') or {}
        voltage = data.get('aux_voltage')
        stamp = _parse((data.get('field_measured_at') or {}).get('aux_voltage') or data.get('measured_at')
                       or (event or {}).get('observed_at'))
        if type(voltage) not in (int, float) or not math.isfinite(voltage) or not 0 < voltage < 30 or stamp is None:
            continue
        tracker.observe(voltage, stamp, not (data.get('onroad') or data.get('driving') or data.get('charging')))
    return tracker

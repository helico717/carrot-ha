"""Infer a favorite from one continuously observed parking visit, not GPS age."""
from datetime import timedelta
import math

from ..archive_codec import loads
from .stations import coordinates, distance_m
from .store import stamp

# A work budget, not an elapsed-time cutoff. Incomplete visits never qualify.
MAX_SAMPLES = 20000
MAX_GAP_S = 90
ANCHOR_M = 50


def valid_fix(data, observed):
    gps = data.get('gps') or {}
    try:
        coordinates(gps.get('latitude'), gps.get('longitude'))
        measured = stamp(gps.get('measured_at') or (data.get('field_measured_at') or {}).get('gps'))
        accuracy = gps.get('accuracyM')
        speed = gps.get('speedMps')
        if gps.get('fresh') is False or not 0 <= (observed - measured).total_seconds() <= 60:
            return None
        if type(accuracy) not in (int, float) or not math.isfinite(accuracy) or not 0 <= accuracy <= 50:
            return None
        if type(speed) not in (int, float) or not math.isfinite(speed) or speed < 0:
            return None
    except (ValueError, TypeError, AttributeError):
        return None
    return measured, gps


def select_visit(samples, start, fix, favorites):
    """The entrance fix may be moving; after parking, every sample must stay parked."""
    measured, gps = fix
    matches = [f for f in favorites if any(
        distance_m(gps['latitude'], gps['longitude'], a['latitude'], a['longitude']) <= ANCHOR_M
        for a in f.get('anchors') or [])]
    if len(matches) != 1:
        return None
    parked_at = None
    for observed, data in reversed(samples):
        if observed < measured:
            continue
        wheel = (data.get('vehicle') or {}).get('wheel_speed_mps')
        if wheel is not None and (type(wheel) not in (int, float) or not math.isfinite(wheel) or wheel < 0):
            return None
        stopped = data.get('onroad') is False and (wheel is None or wheel <= 1)
        if parked_at is None:
            if stopped:
                parked_at = observed
        elif not stopped:
            return None
    if parked_at is None or parked_at > start:
        return None
    # A newly measured moving fix while already parked contradicts continuity.
    if gps['speedMps'] > 1 and measured >= parked_at:
        return None
    return matches[0], {
        'latitude': gps['latitude'], 'longitude': gps['longitude'],
        'gps_measured_at': measured.isoformat(), 'accuracy_m': gps['accuracyM'],
        'observed_at': samples[0][0].isoformat(),
        'parked_since': parked_at.isoformat(),
        'basis': 'charge_start_continuous_parking_favorite',
    }


def parking_favorite(archive, journal, started, favorites):
    """Only an existing automatic charge calls this path. Never geocode an old fix.

    Read backwards through this device's indexed telemetry until the last normal
    GPS fix. Missing coverage, a later drive, ambiguous favorites or exhausted
    work budget leave the record unassigned. No fixed GPS-age limit applies.
    """
    if not favorites or not any(f.get('anchors') for f in favorites):
        return None
    start = stamp(started)
    high = (start + timedelta(seconds=60)).isoformat()
    samples = []
    fix = None
    with archive.connect() as db:
        rows = db.execute("SELECT observed,body FROM events WHERE device=? AND kind='state' AND observed<=? ORDER BY observed DESC LIMIT ?",
                          (journal.device, high, MAX_SAMPLES))
        for observed, body in rows:
            observed = stamp(observed)
            if not samples:
                if abs((observed - start).total_seconds()) > MAX_GAP_S:
                    return None
            elif (samples[-1][0] - observed).total_seconds() > MAX_GAP_S:
                return None
            data = loads(body).get('data', {})
            samples.append((observed, data))
            if fix is None:
                candidate = valid_fix(data, observed)
                if candidate and candidate[0] <= start:
                    fix = candidate
            if fix and observed <= fix[0]:
                return select_visit(samples, start, fix, favorites)
    return None

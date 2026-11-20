"""Infer a favorite from one continuously observed parking visit, not GPS age."""
from datetime import timedelta
import json
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


def charge_edit_position(archive, journal, record_id):
    """Return the last valid fix as an editor hint for one automatic charge."""
    with journal.connect() as db:
        record = db.execute(
            "SELECT kind,extra_json FROM records WHERE vehicle_id=? AND id=? "
            "AND origin='automatic' AND status='active' AND kind IN ('charge','expense')",
            (journal.vehicle, record_id),
        ).fetchone()
        if not record:
            return None
        kind, raw = record
        if json.loads(raw).get('location'):
            return None
        if kind == 'expense':
            rows = db.execute("""
                SELECT m.started_at FROM expenses e
                JOIN expense_members x ON x.vehicle_id=e.vehicle_id AND x.expense_id=e.record_id
                JOIN records r ON r.vehicle_id=x.vehicle_id AND r.id=x.charge_id
                JOIN mobility m ON m.vehicle_id=r.vehicle_id AND m.record_id=r.id
                WHERE e.vehicle_id=? AND e.record_id=? AND e.category='charging'
                  AND e.payment_owner='ha_charge_payment' AND r.kind='charge'
                  AND r.origin='automatic' AND r.status='active'
                  AND (SELECT count(*) FROM expense_members
                       WHERE vehicle_id=e.vehicle_id AND expense_id=e.record_id)=1
            """, (journal.vehicle, record_id)).fetchall()
        else:
            rows = db.execute(
                "SELECT started_at FROM mobility WHERE vehicle_id=? AND record_id=?",
                (journal.vehicle, record_id),
            ).fetchall()
    if len(rows) != 1:
        return None

    start = stamp(rows[0][0])
    low = start - timedelta(minutes=10)
    best = None
    with archive.connect() as db:
        for observed, body in db.execute(
            "SELECT observed,body FROM events WHERE device=? AND kind='state' "
            "AND observed BETWEEN ? AND ? ORDER BY observed DESC LIMIT 2000",
            (journal.device, low.isoformat(), start.isoformat()),
        ):
            observed = stamp(observed)
            if best and observed <= best[0]:
                break
            fix = valid_fix(loads(body).get('data', {}), observed)
            if fix and low <= fix[0] <= start and (best is None or fix[0] > best[0]):
                best = fix
    if best is None:
        return None
    measured, gps = best
    return {'latitude': gps['latitude'], 'longitude': gps['longitude'], 'measured_at': measured.isoformat()}


def select_visit(samples, start, fix, favorites):
    """Allow brief unknown onroad samples within an otherwise observed parking visit."""
    measured, gps = fix
    matches = [f for f in favorites if any(
        distance_m(gps['latitude'], gps['longitude'], a['latitude'], a['longitude']) <= ANCHOR_M
        for a in f.get('anchors') or [])]
    if len(matches) != 1:
        return None
    parked_at = None
    last_parked = None
    for observed, data in reversed(samples):
        if observed < measured:
            continue
        wheel = (data.get('vehicle') or {}).get('wheel_speed_mps')
        if wheel is not None and (type(wheel) not in (int, float) or not math.isfinite(wheel) or wheel < 0):
            return None
        onroad = data.get('onroad')
        moving = onroad is True or data.get('driving') is True or (wheel is not None and wheel > 1)
        if last_parked is not None and (
            moving or (observed - last_parked).total_seconds() > MAX_GAP_S
        ):
            return None
        if onroad is False and not moving:
            if parked_at is None:
                parked_at = observed
            last_parked = observed
    if parked_at is None or parked_at > start or (start - last_parked).total_seconds() > MAX_GAP_S:
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

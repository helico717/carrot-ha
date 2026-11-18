"""Small indexed state inputs shared by battery and charge calculations."""
import json

PATHS = (
    '$.observed_at', '$.data.stale', '$.data.display_soc_candidate_percent',
    '$.data.field_measured_at.display_soc_candidate_percent',
    '$.data.battery_wh', '$.data.field_measured_at.battery_wh',
    '$.data.measured_at', '$.data.charging', '$.data.driving', '$.data.onroad',
    '$.data.soc_percent', '$.data.field_measured_at.soc_percent',
)
def _expr(col='body'):
    return (
        f"json_array(json_extract({col}," + ','.join("'"+p+"'" for p in PATHS) + "),"
        f"json_type({col},'$.data.display_soc_candidate_percent'),"
        f"json_type({col},'$.data.driving'))"
    )

EXPRESSION = _expr('body')
TABLE = 'events_state_projection'
INDEX = 'events_state_projection_observed'
LEGACY_INDEX = 'events_state_calculation_v1'


def initialize(db):
    # SQLite maintains this small projection transactionally via triggers, including
    # compressed envelopes. Original events remain authoritative and are never rewritten.
    existed = db.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (TABLE,)
    ).fetchone() is not None
    db.execute(f"DROP INDEX IF EXISTS {LEGACY_INDEX}")
    db.execute(
        f"CREATE TABLE IF NOT EXISTS {TABLE} ("
        "device TEXT NOT NULL, id TEXT NOT NULL, observed TEXT NOT NULL, "
        "projected TEXT NOT NULL, PRIMARY KEY(device, id))"
    )
    db.execute(f"CREATE INDEX IF NOT EXISTS {INDEX} ON {TABLE}(device, observed, projected)")
    new_expr = _expr('NEW.body')
    db.execute(
        f"CREATE TRIGGER IF NOT EXISTS {TABLE}_insert AFTER INSERT ON events "
        "WHEN NEW.kind='state' BEGIN "
        f"INSERT OR REPLACE INTO {TABLE}(device, id, observed, projected) "
        f"VALUES (NEW.device, NEW.id, NEW.observed, {new_expr}); END"
    )
    db.execute(
        f"CREATE TRIGGER IF NOT EXISTS {TABLE}_update AFTER UPDATE ON events "
        "WHEN OLD.kind='state' OR NEW.kind='state' BEGIN "
        f"DELETE FROM {TABLE} WHERE device=OLD.device AND id=OLD.id; "
        f"INSERT OR REPLACE INTO {TABLE}(device, id, observed, projected) "
        f"SELECT NEW.device, NEW.id, NEW.observed, {new_expr} WHERE NEW.kind='state'; END"
    )
    db.execute(
        f"CREATE TRIGGER IF NOT EXISTS {TABLE}_delete AFTER DELETE ON events "
        "WHEN OLD.kind='state' BEGIN "
        f"DELETE FROM {TABLE} WHERE device=OLD.device AND id=OLD.id; END"
    )
    if not existed:
        db.execute(
            f"INSERT OR IGNORE INTO {TABLE}(device, id, observed, projected) "
            f"SELECT device, id, observed, {EXPRESSION} FROM events WHERE kind='state'"
        )


def build_query(device, since, until=None, julian_bounds=None):
    query = f"SELECT observed, projected FROM {TABLE} WHERE device=? AND observed>=?"
    args = [device, since]
    if until is not None:
        query += ' AND observed<=?'
        args.append(until)
    if julian_bounds is not None:
        query += ' AND julianday(observed)>=julianday(?) AND julianday(observed)<=julianday(?)'
        args.extend(julian_bounds)
    query += ' ORDER BY observed'
    return query, args


def samples(db, device, since, until=None, julian_bounds=None):
    query, args = build_query(device, since, until, julian_bounds)
    for received, projected in db.execute(query, args):
        values, candidate_type, driving_type = json.loads(projected)
        observed, stale, candidate, candidate_at, wh, wh_at, measured, charging, driving, onroad, soc, soc_at = values
        data = dict(stale=stale, battery_wh=wh, measured_at=measured,
                    charging=charging, soc_percent=soc, onroad=onroad,
                    field_measured_at={'battery_wh':wh_at, 'soc_percent':soc_at,
                                      'display_soc_candidate_percent':candidate_at})
        if candidate_type is not None:
            data['display_soc_candidate_percent'] = candidate
        if driving_type is not None:
            data['driving'] = driving
        yield received, {'observed_at':observed, 'data':data}

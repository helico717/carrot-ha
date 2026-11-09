"""Small indexed state inputs shared by battery and charge calculations."""
import json

PATHS = (
    '$.observed_at', '$.data.stale', '$.data.display_soc_candidate_percent',
    '$.data.field_measured_at.display_soc_candidate_percent',
    '$.data.battery_wh', '$.data.field_measured_at.battery_wh',
    '$.data.measured_at', '$.data.charging', '$.data.driving', '$.data.onroad',
    '$.data.soc_percent', '$.data.field_measured_at.soc_percent',
)
EXPRESSION = "json_array(json_extract(body," + ','.join("'"+p+"'" for p in PATHS) + "),json_type(body,'$.data.display_soc_candidate_percent'),json_type(body,'$.data.driving'))"
INDEX = 'events_state_calculation_v1'


def initialize(db):
    # SQLite maintains this small projection transactionally, including compressed
    # envelopes. Original events remain authoritative and are never rewritten.
    db.execute(f"CREATE INDEX IF NOT EXISTS {INDEX} ON events(device,observed,{EXPRESSION}) WHERE kind='state'")


def samples(db, device, since, until=None, julian_bounds=None):
    query = f"SELECT observed,{EXPRESSION} FROM events INDEXED BY {INDEX} WHERE device=? AND kind='state' AND observed>=?"
    args = [device, since]
    if until is not None:
        query += ' AND observed<=?'
        args.append(until)
    if julian_bounds is not None:
        query += ' AND julianday(observed)>=julianday(?) AND julianday(observed)<=julianday(?)'
        args.extend(julian_bounds)
    query += ' ORDER BY observed'
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

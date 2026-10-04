"""Lossless state storage; SQL projections retain every calculation field."""
import base64
import json
import zlib

MARKER = '_carrot_archive_v1'
MAX_RAW_BYTES = 262144
OMITTED = frozenset(('cloud_raw_state', 'charge_sessions', 'charge_months'))


def _decode(stored):
    encoded = base64.b64decode(stored[MARKER], validate=True)
    decoder = zlib.decompressobj()
    raw = decoder.decompress(encoded, MAX_RAW_BYTES + 1)
    if len(raw) > MAX_RAW_BYTES or decoder.unconsumed_tail or not decoder.eof or decoder.unused_data:
        raise ValueError('Invalid compressed archive payload')
    original = raw.decode('utf-8')
    event = json.loads(original)
    if event.get('schema') != 1 or event.get('kind') != 'state':
        raise ValueError('Invalid compressed archive event')
    projection = dict(event)
    projection.pop('schema')
    projection['data'] = {k: v for k, v in event['data'].items() if k not in OMITTED}
    actual = {k: v for k, v in stored.items() if k != MARKER}
    projection.pop(MARKER, None)
    if actual != projection:
        raise ValueError('Archive projection differs from original event')
    return original, event


def unpack(body):
    """Return the exact original JSON text, including legacy formatting."""
    if MARKER not in body:
        return body
    stored = json.loads(body)
    if 'schema' in stored or MARKER not in stored:
        return body
    return _decode(stored)[0]


def loads(body):
    if MARKER not in body:
        return json.loads(body)
    stored = json.loads(body)
    # Protocol schema distinguishes user fields from internal wrappers.
    if 'schema' in stored or MARKER not in stored:
        return stored
    return _decode(stored)[1]


def pack(body):
    """Keep small/legacy/unsupported events unchanged; no field is discarded."""
    body = unpack(body)
    raw = body.encode('utf-8')
    if not 4096 <= len(raw) <= MAX_RAW_BYTES:
        return body
    event = json.loads(body)
    if event.get('schema') != 1 or event.get('kind') != 'state':
        return body
    projection = dict(event)
    projection.pop('schema')
    projection['data'] = {k: v for k, v in event['data'].items() if k not in OMITTED}
    projection[MARKER] = base64.b64encode(zlib.compress(raw, 6)).decode('ascii')
    encoded = json.dumps(projection, sort_keys=True, separators=(',', ':'))
    return encoded if len(encoded.encode('utf-8')) + 256 < len(raw) else body


def calculation_event(body):
    """Fast read for explicitly audited battery/energy calculation consumers.

    Contains envelope identity/time and all measurement fields, but not the
    three bulky diagnostic fields. Public history/latest must use loads().
    """
    event = json.loads(body)
    if 'schema' not in event and MARKER in event:
        event.pop(MARKER)
        event['schema'] = 1
    return event

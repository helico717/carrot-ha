"""Restore opt-in cloud archive pages on HA, with bounded lossless decoding."""
import base64
import json
import zlib

MAX_RAW = 262144
MARKER = '_carrot_cloud_archive_v1'


def decoded(raw):
    if not isinstance(raw, str) or len(raw) > MAX_RAW * 2:
        raise ValueError('Invalid cloud archive size')
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError('Invalid cloud archive object')
    if value.get(MARKER) != 1:
        return value
    if value.get('codec') != 'gzip' or not isinstance(value.get('data'), str):
        raise ValueError('Unsupported cloud archive codec')
    data = base64.b64decode(value['data'], validate=True)
    unpacker = zlib.decompressobj(31)
    body = unpacker.decompress(data, MAX_RAW + 1)
    if len(body) > MAX_RAW or not unpacker.eof or unpacker.unused_data or unpacker.unconsumed_tail:
        raise ValueError('Invalid compressed cloud archive')
    value = json.loads(body)
    if not isinstance(value, dict):
        raise ValueError('Invalid cloud archive object')
    return value


def restore_page(feed):
    if feed.get('encoding') != 'carrot-cloud-archive-v1':
        if feed.get('encoding') is not None:
            raise ValueError('Unsupported cloud archive page')
        return feed
    contexts = feed.get('contexts') or {}
    if not isinstance(contexts, dict) or len(contexts) > 100:
        raise ValueError('Invalid cloud contexts')
    cache = {}
    events = feed.get('events')
    if not isinstance(events, list) or len(events) > 100:
        raise ValueError('Invalid cloud archive page')
    restored = []
    for row in events:
        payload = decoded(row['raw_json'])
        if row.get('context_hash'):
            key = row['context_hash']
            if key not in contexts:
                raise ValueError('Missing cloud context')
            if key not in cache:
                cache[key] = decoded(contexts[key])
            vehicle = payload.get('vehicle') or {}
            for field in ('charge_sessions', 'charge_months'):
                reference = vehicle.get(field)
                if isinstance(reference, dict) and reference.get('_carrot_context_field') == field:
                    if field not in cache[key]:
                        raise ValueError('Missing cloud context field')
                    vehicle[field] = cache[key][field]
        for field in ('charge_sessions','charge_months'):
            value = (payload.get('vehicle') or {}).get(field)
            if isinstance(value,dict) and value.get('_carrot_context_field') == field:
                raise ValueError('Unresolved cloud context')
        if payload.get('deviceId') != row['device_id']:
            raise ValueError('Cloud archive device mismatch')
        item = {k:v for k,v in row.items() if k != 'context_hash'}
        item['raw_json'] = json.dumps(payload,ensure_ascii=False,separators=(',', ':'))
        restored.append(item)
    return {**feed, 'events':restored}

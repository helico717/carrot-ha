"""Apply an operator-prepared receiver setup once, preserving all other options."""
import json
import re
import threading
from pathlib import Path
from urllib.parse import urlsplit

_write_lock = threading.Lock()


def read_setup(path, entry_id, device_id):
    path = Path(path)
    if not path.is_file():
        return None
    items = json.loads(path.read_text(encoding='utf-8'))
    matches = [item for item in items if item['entry_id'] == entry_id and item['device_id'] == device_id]
    if len(matches) != 1 or matches[0].get('applied'):
        return None
    fields = ('receiver_url', 'receiver_view_token', 'receiver_upload_token')
    options = {key: matches[0][key] for key in fields}
    url = urlsplit(options['receiver_url'])
    if (url.scheme != 'http' or not re.fullmatch(r'(?:[a-f0-9]{8}|local)-carrot-receiver', url.hostname or '')
            or url.port != 8099 or url.path or url.query or url.fragment or url.username or url.password):
        raise ValueError('Invalid prepared local receiver')
    tokens = [options[key] for key in fields[1:]]
    if tokens[0] == tokens[1] or any(not isinstance(token, str) or not 32 <= len(token) <= 256
            or not token.isascii() or any(c.isspace() for c in token) for token in tokens):
        raise ValueError('Invalid receiver credentials')
    return options


def consumed(path, entry_id):
    path = Path(path)
    with _write_lock:
        items = json.loads(path.read_text(encoding='utf-8'))
        for item in items:
            if item['entry_id'] == entry_id:
                item['applied'] = True
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(items), encoding='utf-8')
        temporary.chmod(0o600)
        temporary.replace(path)


async def apply_prepared(hass, entry):
    path = hass.config.path('carrot_ha', 'direct-receiver-setup.json')
    options = await hass.async_add_executor_job(read_setup, path, entry.entry_id, entry.data['device_id'])
    if options:
        hass.config_entries.async_update_entry(entry, options={**entry.options, **options})
        await hass.async_add_executor_job(consumed, path, entry.entry_id)

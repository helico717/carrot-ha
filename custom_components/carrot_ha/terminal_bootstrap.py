"""Publish short-lived terminal discovery without modifying Comma files."""
import asyncio
import logging
from urllib.parse import urlencode

from aiohttp import ClientError, ClientTimeout
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)


async def publish_loop(hass, entry):
    options = entry.options
    base = options.get('cloud_url', '').rstrip('/')
    credential = options.get('terminal_upload_token', '')
    address = options.get('terminal_ha_url', '')
    if not base or not credential or not address:
        return
    url = base + '/api/terminal/bootstrap?' + urlencode({'device_id': entry.data['device_id']})
    session = async_get_clientsession(hass)
    while True:
        try:
            async with session.post(
                url, headers={'Authorization': 'Bearer ' + credential},
                json={'ha_url': address, 'terminal_token': options['terminal_token']},
                timeout=ClientTimeout(total=15), allow_redirects=False,
            ) as response:
                if response.status != 200:
                    _LOGGER.warning('Terminal discovery publication failed: HTTP %s', response.status)
        except (ClientError, OSError, TimeoutError):
            _LOGGER.warning('Terminal discovery publication unavailable; retrying')
        await asyncio.sleep(60)

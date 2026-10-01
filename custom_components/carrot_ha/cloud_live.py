"""Demand-driven latest state, independent of archive catch-up.

One read per entry per 15 seconds, including failed attempts. No D1/KV writes,
route downloads, or local archive work on the dashboard's critical path.
"""
import asyncio
from datetime import datetime, timezone
from urllib.parse import urlencode

from aiohttp import ClientTimeout
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .cloud_feed import parse_feed


async def refresh_live(hass, runtime):
    entry = runtime['entry']
    base = entry.options.get('cloud_url', '').rstrip('/')
    token = entry.options.get('cloud_view_token', '')
    if not base or not token:
        return
    lock = runtime.setdefault('live_lock', asyncio.Lock())
    async with lock:
        now = asyncio.get_running_loop().time()
        if now - runtime.get('live_attempt', float('-inf')) < 15:
            return
        runtime['live_attempt'] = now
        try:
            session = async_get_clientsession(hass)
            path = '/api/latest-state?' + urlencode({'device_id': entry.data['device_id']})
            async with session.get(base + path, headers={
                'Authorization': 'Bearer ' + token, 'Accept': 'application/json',
            }, timeout=ClientTimeout(total=8), allow_redirects=False) as response:
                if response.status != 200:
                    runtime['live_status'] = 'HTTP_' + str(response.status)
                    return
                feed = await response.json()
            if not isinstance(feed, dict) or 'state' not in feed:
                raise ValueError('Invalid latest-state response')
            for event in parse_feed({'state': feed['state']}, entry.data['device_id']):
                if event['kind'] != 'state':
                    continue
                previous = runtime.get('latest')
                if not previous or datetime.fromisoformat(event['observed_at'].replace('Z', '+00:00')) > datetime.fromisoformat(previous['observed_at'].replace('Z', '+00:00')):
                    runtime['latest'] = event
                    async_dispatcher_send(hass, 'carrot_ha' + entry.entry_id)
            runtime['live_status'] = 'ok' if feed['state'] else 'no_data'
            runtime['live_checked_at'] = datetime.now(timezone.utc).isoformat()
        except asyncio.CancelledError:
            raise
        except Exception:
            # Never log credential-bearing response/exception text.
            runtime['live_status'] = 'error'

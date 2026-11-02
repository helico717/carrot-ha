"""Carrot-only features pause while the Comma reports the IQpilot candidate branch."""
import asyncio
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import time
import types
import unittest

from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer

ROOT = Path(__file__).parents[1]
pkg = types.ModuleType('driving_logs_pilot')
pkg.__path__ = [str(ROOT / 'custom_components/carrot_ha/driving_logs')]
sys.modules[pkg.__name__] = pkg
http_stub = types.ModuleType('homeassistant.components.http')
http_stub.HomeAssistantView = object
sys.modules.setdefault('homeassistant.components.http', http_stub)
from driving_logs_pilot.http import DeviceView, SessionView, upload_token
from driving_logs_pilot.pilot import CARROT, IQPILOT, pilot_software
from driving_logs_pilot.store import LogStore
from driving_logs_pilot.transfer_policy import device_policy_for, policy_for, set_enabled


class PilotSoftwareTests(unittest.TestCase):
    def test_branch_decides_pilot(self):
        self.assertEqual(pilot_software({'comma_git_branch': 'iq-ha'}), IQPILOT)
        self.assertEqual(pilot_software({'comma_git_branch': 'iq-ha-next'}), IQPILOT)
        for branch in ('carrot-wip-model_selector-ha', 'ha-back', None, 7, ''):
            self.assertEqual(pilot_software({'comma_git_branch': branch}), CARROT)
        self.assertEqual(pilot_software(None), CARROT)


class PauseTransportTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.entry = types.SimpleNamespace(entry_id='entry', data={'device_id': 'comma'},
                                           options={'terminal_enabled': True, 'terminal_token': 't' * 64})
        self.runtime = {'entry': self.entry, 'driving_log_store': LogStore(self.temp.name),
                        'latest': {'data': {'comma_git_branch': 'carrot-wip-model_selector-ha'}}}

        async def executor(function, *args):
            return await asyncio.to_thread(function, *args)
        self.hass = types.SimpleNamespace(data={'carrot_ha': {'entry': self.runtime}}, async_add_executor_job=executor)
        self.hass.config = types.SimpleNamespace(path=lambda *parts: str(Path(self.temp.name).joinpath(*parts)))

        @web.middleware
        async def user(request, handler):
            request['hass_user'] = types.SimpleNamespace(is_admin=True)
            return await handler(request)
        app = web.Application(middlewares=[user])
        session, device = SessionView(self.hass), DeviceView(self.hass)

        def handler(method):
            async def wrapped(request):
                return await method(request, **request.match_info)
            return wrapped
        app.router.add_post(session.url, handler(session.post))
        for url in [device.url, *device.extra_urls]:
            app.router.add_get(url, handler(device.get))
            app.router.add_post(url, handler(device.post))
        self.server = TestServer(app)
        await self.server.start_server()
        self.client = ClientSession()
        self.auth = {'Authorization': 'Bearer ' + upload_token('t' * 64)}

    async def asyncTearDown(self):
        await self.client.close()
        await self.server.close()
        self.temp.cleanup()

    def iq(self):
        self.runtime['latest']['data']['comma_git_branch'] = 'iq-ha'

    async def test_transfer_pauses_without_changing_saved_choice(self):
        saved = await set_enabled(self.hass, self.runtime, True)
        self.iq()
        effective = await device_policy_for(self.hass, self.runtime)
        self.assertFalse(effective['enabled'])
        self.assertEqual(effective['paused'], IQPILOT)
        self.assertEqual(await policy_for(self.hass, self.runtime), saved)
        state = self.server.make_url('/api/carrot_ha/v1/driving_logs_upload/comma/state')
        async with self.client.get(state, headers=self.auth) as response:
            self.assertEqual(response.status, 200)
            self.assertFalse((await response.json())['transfer']['enabled'])
        begin = self.server.make_url('/api/carrot_ha/v1/driving_logs_upload/comma/begin')
        headers = {**self.auth, 'X-Transfer-Generation': saved['generation'], 'X-Recording-Started': str(time.time())}
        async with self.client.post(begin, headers=headers, json={}) as response:
            self.assertEqual(response.status, 403)
        self.runtime['latest']['data']['comma_git_branch'] = 'ha-back'
        self.assertEqual(await device_policy_for(self.hass, self.runtime), saved)

    async def test_log_screen_session_is_refused(self):
        self.iq()
        url = self.server.make_url('/api/carrot_ha/v1/driving_logs/entry/session')
        async with self.client.post(url) as response:
            self.assertEqual(response.status, 409)
            self.assertEqual(await response.json(), {'paused': IQPILOT})
            self.assertNotIn('carrot_logs', response.cookies)


if __name__ == '__main__':
    unittest.main()

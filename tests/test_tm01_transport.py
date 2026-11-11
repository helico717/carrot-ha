"""Actual reverse-WebSocket trial path; simulated device never touches CAN."""
import asyncio
import base64
import importlib.util
import json
from pathlib import Path
import re
import unittest
try:
    from aiohttp import ClientSession, web
    from aiohttp.test_utils import TestServer
except ImportError:
    raise unittest.SkipTest('aiohttp required for local WebSocket test')

ROOT=Path(__file__).resolve().parents[1]/'custom_components/carrot_ha'
def load(name):
    spec=importlib.util.spec_from_file_location('test_'+name,ROOT/(name+'.py'))
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
Relay=load('terminal_relay').TerminalRelay
Controller=load('tm01_experiment').TrialController

class TransportTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.relay=Relay('t'*64)
        await self.relay.start()
        app=web.Application();app.router.add_get('/terminal',self.relay.device)
        self.server=TestServer(app);await self.server.start_server()
        self.client=ClientSession()
        self.ws=await self.client.ws_connect(self.server.make_url('/terminal'),headers={'Authorization':'Bearer '+'t'*64})
        await self.ws.receive_json()
        await self.ws.send_json({'type':'status','protocol':1,'offroad':True,'local_ready':True})
        for _ in range(100):
            if self.relay.ready:break
            await asyncio.sleep(.005)
        self.assertTrue(self.relay.ready)
    async def asyncTearDown(self):
        await self.ws.close();await self.client.close();await self.relay.close();await self.server.close()
    async def test_button_request_real_lease_fixed_command_result_and_stop(self):
        c=Controller(self.relay);task=asyncio.create_task(c.run('unlock'))
        start=await asyncio.wait_for(self.ws.receive_json(),3)
        self.assertEqual(start['type'],'start');sid=start['session_id']
        await self.ws.send_json({'type':'started','session_id':sid})
        command=await asyncio.wait_for(self.ws.receive_json(),3)
        self.assertEqual(command['type'],'input')
        raw=command['message']['data'];self.assertIn('--action unlock --bus 0',raw)
        nonce=re.search(r'--request-id ([0-9a-f]{32})',raw)[1]
        text='TM01_RESULT '+nonce+' '+json.dumps({'request_id':nonce,'status':'target_state_observed','restored':True})+'\r\n'
        await self.ws.send_json({'type':'terminal','session_id':sid,'message':{'type':'pty_output','b64':base64.b64encode(text.encode()).decode()}})
        result=await asyncio.wait_for(task,3)
        self.assertEqual(result['status'],'target_state_observed')
        self.assertFalse(result['vehicle_acceptance_verified'])
        stop=await asyncio.wait_for(self.ws.receive_json(),3)
        self.assertEqual(stop['type'],'stop');self.assertIsNone(self.relay.controller)
        self.assertFalse(c.busy)
    async def test_existing_administrator_session_is_not_taken_over(self):
        await self.relay.acquire('existing-admin')
        start=await self.ws.receive_json();self.assertEqual(start['type'],'start')
        c=Controller(self.relay)
        with self.assertRaises(RuntimeError):await c.run('lock')
        self.assertEqual(self.relay.controller,'existing-admin')
        self.assertEqual(c.result['status'],'not_tested')
        await self.relay.release('existing-admin')
        stop=await self.ws.receive_json();self.assertEqual(stop['type'],'stop')

if __name__=='__main__':unittest.main()

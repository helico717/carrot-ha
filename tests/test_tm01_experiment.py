import asyncio
import base64
import importlib.util
import json
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('trial_backend',ROOT/'custom_components/carrot_ha/tm01_experiment.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class Relay:
    ready=True;offroad=True;controller=None;session_id=None
    def __init__(self):self.callbacks={};self.commands=[];self.released=0
    def subscribe(self,key,callback):
        self.callbacks[key]=callback
        async def unsubscribe():self.callbacks.pop(key,None)
        return unsubscribe
    async def acquire(self,key):
        self.controller=key;self.session_id='one'
        for callback in self.callbacks.values():callback({'type':'started'})
    async def input(self,key,message):
        command=message['data'];self.commands.append(command)
        nonce=re.search(r'--request-id ([a-f0-9]{32})',command)[1]
        data='\x1b[?2004lTM01_RESULT '+nonce+' '+json.dumps({'request_id':nonce,'status':'panda_echo_no_target_state','tx_echo_requests':3,'restored':True})+'\r\n'
        # Chunking includes a partial marker and JSON across terminal messages.
        for chunk in (data[:17],data[17:61],data[61:]):
            for callback in self.callbacks.values():
                callback({'type':'terminal','message':{'type':'pty_output','b64':base64.b64encode(chunk.encode()).decode()}})
    async def release(self,key,reason):self.released+=1;self.controller=None;self.session_id=None

class Tests(unittest.IsolatedAsyncioTestCase):
    async def test_fixed_lock_unlock_command_result_and_exclusive_cleanup(self):
        for action in ('lock','unlock','control'):
            relay=Relay();c=module.TrialController(relay)
            result=await c.run(action)
            self.assertEqual(result['status'],'panda_echo_no_target_state')
            self.assertFalse(result['vehicle_acceptance_verified'])
            self.assertIn('--action '+action+' --bus 0',relay.commands[0])
            self.assertEqual(relay.released,1)
            self.assertFalse(c.busy)
            self.assertEqual(relay.callbacks,{})
            with self.assertRaises(RuntimeError):await c.run(action)
    async def test_onroad_busy_existing_session_and_invalid_action_no_command(self):
        for field,value in (('offroad',False),('ready',False),('controller','someone'),('session_id','someone')):
            relay=Relay();setattr(relay,field,value);c=module.TrialController(relay)
            with self.assertRaises(RuntimeError):await c.run('lock')
            self.assertEqual(relay.commands,[])
        relay=Relay();c=module.TrialController(relay)
        with self.assertRaises(ValueError):await c.run('unlock; reboot')
        self.assertEqual(relay.commands,[])
    async def test_transport_failure_releases_and_does_not_retry(self):
        relay=Relay()
        async def fail(key,message):raise RuntimeError('disconnected')
        relay.input=fail;c=module.TrialController(relay)
        with self.assertRaises(RuntimeError):await c.run('unlock')
        self.assertEqual(c.result['status'],'delivery_or_result_unconfirmed')
        self.assertEqual(relay.released,1)
        self.assertFalse(c.busy)

if __name__=='__main__':unittest.main()

"""Single explicit TM_01 trial through the existing exclusive terminal relay."""
import asyncio
import base64
import json
import re
import time
import uuid


class TrialController:
    def __init__(self, relay, changed=lambda: None, clock=time.monotonic):
        self.relay = relay
        self.changed = changed
        self.clock = clock
        self.busy = False
        self.next_allowed = 0
        self.result = {'status': 'not_tested', 'vehicle_acceptance_verified': False}

    @property
    def available(self):
        r = self.relay
        return bool(r and r.ready and r.offroad and not r.controller and not r.session_id and not self.busy)

    async def run(self, action):
        if action not in ('lock', 'unlock'):
            raise ValueError('Unknown trial action')
        if not self.available:
            raise RuntimeError('Comma가 오프라인·주행 중이거나 터미널이 사용 중입니다.')
        if self.clock() < self.next_allowed:
            raise RuntimeError('이전 시험 종료 후 15초 뒤 다시 요청하세요.')
        self.busy = True
        self.result = {'status': 'running', 'action': action, 'vehicle_acceptance_verified': False}
        self.changed()
        key = 'tm01-trial-'+uuid.uuid4().hex
        nonce = uuid.uuid4().hex
        loop = asyncio.get_running_loop()
        started, result = loop.create_future(), loop.create_future()
        buffer = ''

        def received(event):
            nonlocal buffer
            if event.get('type') == 'started' and not started.done():
                started.set_result(True)
            if event.get('type') == 'ended':
                for f in (started, result):
                    if not f.done(): f.set_exception(RuntimeError('시험 연결이 종료됐습니다. 차량 결과 미확인.'))
            message = event.get('message', {})
            if event.get('type') != 'terminal' or message.get('type') != 'pty_output':
                return
            try:
                chunk = base64.b64decode(message.get('data', ''), validate=True).decode('utf-8', errors='replace')
            except (ValueError, TypeError):
                return
            buffer = (buffer+chunk)[-32768:]
            text = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', buffer)
            marker = 'TM01_RESULT '+nonce+' '
            for line in text.splitlines():
                pos = line.find(marker)
                if pos < 0: continue
                try:
                    data = json.loads(line[pos+len(marker):])
                except (ValueError, TypeError):
                    continue
                if isinstance(data, dict) and data.get('request_id') == nonce and not result.done():
                    result.set_result(data)

        unsubscribe = self.relay.subscribe(key, received)
        try:
            await self.relay.acquire(key)
            await asyncio.wait_for(started, 5)
            if not self.relay.offroad:
                raise RuntimeError('차량 오프로드 상태가 해제됐습니다.')
            # Only these fixed actions are accepted; no shell text is taken from users.
            command = ('cd /data/openpilot && PYTHONDONTWRITEBYTECODE=1 python3 -m '
                       'openpilot.selfdrive.debug.tm01_trial --action '+action+
                       ' --bus 0 --request-id '+nonce+' --confirm-parked-trial\r')
            await self.relay.input(key, {'type': 'raw', 'data': command})
            self.result = await asyncio.wait_for(result, 22)
            self.result['vehicle_acceptance_verified'] = False
        except asyncio.CancelledError:
            self.result = {'status': 'delivery_or_result_unconfirmed', 'action': action,
                           'error': 'trial_wait_cancelled', 'vehicle_acceptance_verified': False}
            raise
        except Exception as exc:
            self.result = {'status': 'delivery_or_result_unconfirmed', 'action': action,
                           'error': str(exc)[:200], 'vehicle_acceptance_verified': False}
            raise
        finally:
            await self.relay.release(key, 'tm01_trial_finished')
            await unsubscribe()
            for f in (started, result):
                if f.done() and not f.cancelled(): f.exception()
            self.busy = False
            self.next_allowed = self.clock()+15
            self.changed()
        return self.result


def controller(hass, entry):
    from homeassistant.helpers.dispatcher import async_dispatcher_send
    runtime = hass.data['carrot_ha'][entry.entry_id]
    if 'tm01_experiment' not in runtime:
        runtime['tm01_experiment'] = TrialController(runtime.get('terminal_relay'),
            lambda: async_dispatcher_send(hass, 'carrot_tm01_'+entry.entry_id))
    return runtime['tm01_experiment']


def device_info(entry):
    return {'identifiers': {('carrot_ha', entry.data['device_id']+'_tm01_trial')},
            'name': '시험용 기능', 'manufacturer': 'Carrot HA',
            'model': 'ID.4 TM_01 잠금·해제 시험',
            'via_device': ('carrot_ha', entry.data['device_id'])}

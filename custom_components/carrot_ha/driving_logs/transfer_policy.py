"""Persistent, fail-closed permission for newly observed recording segments."""
import asyncio
import json
import math
from pathlib import Path
import time
import uuid


def policy_path(hass, runtime):
    return Path(hass.config.path('carrot_ha', 'driving-log-transfer', runtime['entry'].entry_id + '.json'))


def load(path):
    if not path.exists():
        return {'enabled': False, 'generation': 'disabled', 'since': None}
    data = json.loads(path.read_text(encoding='utf-8'))
    if (not isinstance(data, dict) or type(data.get('enabled')) is not bool or not isinstance(data.get('generation'), str)
            or (data['enabled'] and (not data['generation'] or type(data.get('since')) not in (int, float)
                                    or not math.isfinite(data['since']) or data['since'] <= 0))):
        raise ValueError('Invalid driving log transfer policy')
    return data


async def policy_for(hass, runtime):
    async with runtime.setdefault('driving_log_policy_init_lock', asyncio.Lock()):
        if 'driving_log_transfer_policy' not in runtime:
            runtime['driving_log_transfer_policy'] = await hass.async_add_executor_job(load, policy_path(hass, runtime))
        return runtime['driving_log_transfer_policy']


def save(path, policy):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(policy), encoding='utf-8')
    temporary.replace(path)


async def set_enabled(hass, runtime, enabled):
    if type(enabled) is not bool:
        raise ValueError('enabled must be boolean')
    async with runtime.setdefault('driving_log_lock', asyncio.Lock()):
        old = await policy_for(hass, runtime)
        if old['enabled'] == enabled:
            return old
        policy = {'enabled': enabled, 'generation': uuid.uuid4().hex,
                  'since': time.time() if enabled else None}
        await hass.async_add_executor_job(save, policy_path(hass, runtime), policy)
        runtime['driving_log_transfer_policy'] = policy
        runtime.pop('driving_log_transfer_ack', None)
        return policy


def require_permission(policy, generation, started):
    if (not policy['enabled'] or generation != policy['generation']
            or type(started) not in (int, float) or not math.isfinite(started)
            or not policy['since'] <= started <= time.time() + 60):
        raise ValueError('Driving log transfer disabled or recording predates activation')


def public_status(runtime, policy):
    ack = runtime.get('driving_log_transfer_ack', {})
    applied = (ack.get('generation') == policy['generation']
               and time.monotonic() - ack.get('seen', 0) < 45)
    return {**policy, 'applied': applied}

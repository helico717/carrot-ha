#!/usr/bin/env python3
"""Prepare a review-only HA source overlay from pinned Git commits.

No vehicle access, checkout mutation, installer, or driving-control changes.
Generated sources are NOT an installable IQpilot release.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import subprocess

IQ_SHA = '5c9291b9df6d90007d73ecd749b135bd5008e80d'
CARROT_SHA = '5ec4868a12a9038547b373eb95be3a5fa86d30aa'
PREFIX = 'openpilot/selfdrive/carrot/ha/'


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])


def port_source(text):
    # Change package names and executable paths, never the persistent checkout.
    text = text.replace('from openpilot.', 'from iqpilot.')
    text = text.replace('import openpilot.', 'import iqpilot.')
    text = text.replace('"openpilot.', '"iqpilot.').replace("'openpilot.", "'iqpilot.")
    text = text.replace('opendbc.can.', 'iqdbc.can.')
    text = text.replace('from opendbc.can import CANParser', 'from iqdbc.can.parser import CANParser')
    text = text.replace('openpilot/system/', 'iqpilot/system/')
    text = text.replace("ROOT / 'openpilot' /", "ROOT / 'iqpilot' /")
    return text


def prepare(donor, iq, output):
    if git(donor, 'rev-parse', 'HEAD').decode().strip() != CARROT_SHA:
        raise ValueError('Donor must match the actual vehicle commit')
    if git(iq, 'rev-parse', 'HEAD').decode().strip() != IQ_SHA:
        raise ValueError('IQpilot source commit changed; review again')
    output.mkdir(parents=True, exist_ok=False)
    files = git(donor, 'ls-tree', '-r', '--name-only', 'HEAD', '--', PREFIX).decode().splitlines()
    manifest = {'status': 'REVIEW_ONLY_NOT_INSTALLABLE', 'carrot_sha': CARROT_SHA,
                'iqpilot_sha': IQ_SHA, 'files': {}, 'blockers': [
                    'Replace the Carrot-only localhost:7000 PTY dependency.',
                    'Disable Carrot parameter writes; design an IQ catalog adapter separately.',
                    'Verify iqdbc optional message decoding against recorded CAN.',
                    'Resolve camera ownership with IQ livestream/sentry; preserve onroad interlocks.',
                    'Verify compiled Params keys and camera codec/frame schema on supported hardware.',
                    'Verify IQ.OS install AND return to the current Carrot OS/boot chain.',
                    'Run Linux/device lifecycle tests before publishing an installable Git branch.',
                ]}
    for path in files:
        if not path.endswith('.py'):
            continue
        original = git(donor, 'show', 'HEAD:' + path).decode()
        converted = port_source(original)
        if path == PREFIX + 'terminal.py':
            before = '  agent = TerminalAgent()'
            if converted.count(before) != 1:
                raise ValueError('Terminal entrypoint changed')
            converted = converted.replace(before, '  from .iq_terminal import IQTerminalAgent\n  agent = IQTerminalAgent()')
        if path == PREFIX + 'collector.py':
            before = '        start_param_sync_thread(config)'
            if converted.count(before) != 1:
                raise ValueError('Parameter sync entrypoint changed')
            converted = converted.replace(before,
                "        print('IQpilot: Carrot parameter writes paused; queue not consumed', flush=True)")
        if path.startswith(PREFIX + 'camera/'):
            converted = converted.replace('from iqpilot.common.params import Params', 'from ..iq_camera import CameraParams as Params')
        if path == PREFIX + 'camera/probe.py':
            converted = converted.replace('    if params.get_bool("IsDriverViewEnabled"):',
                '    if getattr(params, "iq_camera_busy", lambda: True)():\n        raise RuntimeError("IQ camera is busy or unavailable")\n    if params.get_bool("IsDriverViewEnabled"):')
        if path == PREFIX + 'camera/agent.py':
            converted = converted.replace("                and not params.get_bool('IsDriverViewEnabled')",
                "                and not params.get_bool('IsDriverViewEnabled')\n                and not params.iq_camera_busy()")
        ast.parse(converted, filename=path)
        relative = 'iqpilot/selfdrive/carrot/ha/' + path[len(PREFIX):]
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(converted)
        manifest['files'][relative] = {'source_sha256': hashlib.sha256(original.encode()).hexdigest(),
                                       'ported_sha256': hashlib.sha256(converted.encode()).hexdigest()}
    for name in ('iq_terminal.py', 'iq_camera.py', 'iq_preflight.py'):
        adapter = Path(__file__).resolve().parents[1] / 'compat/iqpilot' / name
        target = output / 'iqpilot/selfdrive/carrot/ha' / name
        text = adapter.read_text()
        ast.parse(text)
        target.write_text(text)
        manifest['files']['iqpilot/selfdrive/carrot/ha/' + name] = {'adapter_sha256': hashlib.sha256(text.encode()).hexdigest()}
    manifest['blockers'][0] = 'Local PTY adapter prepared; test HA lease, reconnect, and offroad lifecycle on IQ.OS.'
    manager_path = 'iqpilot/system/manager/process_config.py'
    original = git(iq, 'show', 'HEAD:' + manager_path).decode()
    boundary = 'managed_processes = {p.name: p for p in procs}'
    if original.count(boundary) != 1 or '"carrot_ha"' in original:
        raise ValueError('IQ manager registry changed')
    registration = '''# Personal Carrot HA companion: preserve IQ driving process definitions.
def carrot_ha_configured(started, params, CP):
  return not_low_power(started, params, CP) and any(os.path.isfile(path) for path in (
    '/data/id4-collector/connection.json', '/data/carrot_ha/connection.json',
    '/data/carrot_ha/direct-connection.json'))

def carrot_ha_camera_configured(started, params, CP):
  if not not_low_power(started, params, CP):
    return False
  from iqpilot.selfdrive.carrot.ha.camera.service import configured
  return configured()

procs += [
  PythonProcess('carrot_ha', 'iqpilot.selfdrive.carrot.ha.daemon', carrot_ha_configured, restart_if_crash=True),
  PythonProcess('carrot_camera', 'iqpilot.selfdrive.carrot.ha.camera.service', carrot_ha_camera_configured, restart_if_crash=True),
]

'''
    manager = original.replace(boundary, registration + boundary)
    ast.parse(manager)
    target = output / manager_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(manager)
    manifest['files'][manager_path] = {'source_sha256': hashlib.sha256(original.encode()).hexdigest(),
                                     'ported_sha256': hashlib.sha256(manager.encode()).hexdigest()}
    (output / 'PORTABILITY.json').write_text(json.dumps(manifest, indent=2))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--donor', required=True, type=Path)
    parser.add_argument('--iqpilot', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = prepare(args.donor, args.iqpilot, args.output)
    print(result['status'], 'files=', len(result['files']))

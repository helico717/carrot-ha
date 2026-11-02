#!/usr/bin/env python3
"""Send private HA settings directly to the device's Git-managed IQ restore CLI."""
import argparse
import json
from pathlib import Path
import re
import subprocess

REMOTE = ('cd /data/openpilot && '
          'PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/data/openpilot/artifacts/package_runtime:/data/openpilot '
          '/usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_restore')


def restore(host, identity, kit):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,252}', host):
        raise ValueError('Use an IP address or hostname without shell syntax')
    payload = {}
    for key, filename in [('receiver', 'receiver.json'), ('camera', 'camera.json')]:
        path = Path(kit) / filename
        if path.stat().st_size > 16384:
            raise ValueError('Configuration file too large')
        payload[key] = json.loads(path.read_text())
    subprocess.run(['ssh', '-i', str(Path(identity).expanduser()), '-o', 'BatchMode=yes',
                    '-o', 'ConnectTimeout=15', 'iq@' + host, REMOTE],
                   input=json.dumps(payload), text=True, check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--identity', required=True)
    parser.add_argument('--kit', type=Path, required=True)
    args = parser.parse_args()
    try:
        restore(args.host, args.identity, args.kit)
    except Exception:
        raise SystemExit('Restore failed; configuration values have not been displayed')

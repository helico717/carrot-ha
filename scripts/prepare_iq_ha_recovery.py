#!/usr/bin/env python3
"""Create a private, allowlisted HA settings kit; never extract an archive tree."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tarfile

EXPECTED = 'ade4d0b3b447ad42ff9fdc559aa23e920744ef8f7c75b7f2f6beb22a2f24dad7'
FILES = {
    'receiver.json': ('backup/data/carrot_ha/direct-connection.json',),
    'camera.json': ('backup/data/carrot_ha/camera/camera.json', 'backup/data/carrot-camera/camera.json'),
}


def prepare(archive, output, expected=EXPECTED):
    archive, output = Path(archive), Path(output)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != expected:
        raise ValueError('Backup SHA256 mismatch')
    configs = {}
    with tarfile.open(archive) as source:
        for name, candidates in FILES.items():
            for path in candidates:
                members = [m for m in source.getmembers() if m.name == path]
                if not members:
                    continue
                if len(members) != 1 or not members[0].isfile() or members[0].size > 16384:
                    raise ValueError('Invalid configuration archive member')
                configs[name] = json.load(source.extractfile(members[0]))
                break
            else:
                raise ValueError('Required HA configuration missing')
    r, c = configs['receiver.json'], configs['camera.json']
    if r.get('transport') != 'direct' or r.get('device') != c.get('device_id'):
        raise ValueError('Direct receiver and camera identity mismatch')
    required = {'receiver.json': ('transport', 'url', 'device', 'token'),
                'camera.json': ('ha_url', 'device_id', 'camera_token')}
    for name, keys in required.items():
        if any(not isinstance(configs[name].get(k), str) or not configs[name][k] for k in keys):
            raise ValueError('Incomplete configuration')
        configs[name] = {k: configs[name][k] for k in keys}
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    output.chmod(0o700)
    for name, config in configs.items():
        fd = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(config, stream)
    (output / 'README.txt').write_text('PRIVATE: HA credentials. Do not upload or share.\nUse docs/IQPILOT_HA_CLEAN_RECOVERY.md. No Params, DBs, queues or program files included.\n')
    (output / 'README.txt').chmod(0o600)
    return digest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    prepare(args.archive, args.output)
    print('RECOVERY_KIT_OK (credentials not displayed)')

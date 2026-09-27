"""Configure locally; credentials never need to be sent to a developer."""
import getpass
import json
import os
from pathlib import Path
import secrets

from agent import validate_config


def main():
    base = Path(__file__).resolve().parent
    path = base / 'camera.json'
    if (base / 'enabled').exists():
        raise SystemExit('Disable the camera service before changing credentials.')
    url = input('HA external HTTPS base URL: ').strip().rstrip('/')
    device = input('Existing Carrot HA device ID (not DongleId): ').strip()
    token = getpass.getpass('Dedicated camera token (Enter to generate): ').strip()
    generated = not token
    token = token or secrets.token_hex(32)
    config = {'ha_url': url, 'device_id': device, 'camera_token': token}
    validate_config(config)
    temporary = path.with_suffix('.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as handle:
        json.dump(config, handle)
        handle.write('\n')
    temporary.replace(path)
    if generated:
        print('Paste this camera-only token into Carrot HA options; do not share it:')
        print(token)
    print('Saved camera.json (600). Service has not been started.')


if __name__ == '__main__':
    main()

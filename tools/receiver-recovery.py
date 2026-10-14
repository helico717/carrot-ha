"""Configure a clean Comma install through its Git-managed CLI; never copy source."""
import argparse
import getpass
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit

REMOTE = ('cd /data/openpilot && '
          'if [ -x .venv/bin/python ]; then .venv/bin/python -m openpilot.selfdrive.carrot.ha.direct_connection; '
          'else python3 -m openpilot.selfdrive.carrot.ha.direct_connection; fi')


def configure(host, identity, url, device, token):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,252}', host):
        raise ValueError('Use an IP address or hostname, without a username or shell syntax.')
    address = urlsplit(url)
    if (address.scheme != 'https' or not address.hostname or address.username or address.password
            or address.query or address.fragment or address.path.rstrip('/') not in ('', '/carrot-receiver')
            or any(ord(c) <= 32 for c in url)):
        raise ValueError('Use the external HTTPS receiver URL.')
    if not device or len(device) > 128 or '/' in device:
        raise ValueError('Use the existing receiver device ID.')
    if not 32 <= len(token) <= 256 or not token.isascii() or any(c.isspace() for c in token):
        raise ValueError('Use a 32–256 character upload token without whitespace.')
    payload = {'transport': 'direct', 'url': url.rstrip('/'), 'device': device, 'token': token}
    subprocess.run(['ssh', '-i', str(Path(identity).expanduser()), '-o', 'ConnectTimeout=15',
                    'comma@' + host, REMOTE], input=json.dumps(payload), text=True, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--identity', required=True)
    args = parser.parse_args()
    try:
        configure(args.host, args.identity, input('External receiver HTTPS URL: ').strip(),
                  input('Existing receiver device ID: ').strip(), getpass.getpass('Receiver upload token: ').strip())
    except (ValueError, subprocess.CalledProcessError, OSError) as error:
        raise SystemExit('Configuration failed: ' + (str(error) if isinstance(error, ValueError) else type(error).__name__))
    print('Configuration saved. Reboot Comma yourself, then verify reception in HA.')


if __name__ == '__main__':
    main()

"""Install a separate, reversible /data/continue.sh startup hook while offroad."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

BASE = Path('/data/carrot-camera')
sys.path[:0] = ['/data/openpilot', '/data/openpilot/pydeps']
MARKER = '# CARROT_HA_CAMERA_V1'
LINE = '[ ! -f /data/carrot-camera/enabled ] || nohup bash /data/carrot-camera/supervisor.sh >/dev/null 2>&1 < /dev/null &'


def main():
    if Path(__file__).resolve().parent != BASE:
        raise SystemExit('Extract this bundle to /data/carrot-camera first.')
    from agent import validate_config
    from camera_smoke_test import SUPPORTED_COMMITS, require_offroad, unexpected_system_changes
    from openpilot.common.params import Params
    import aiohttp
    import av
    require_offroad(Params())
    commit = subprocess.check_output(['git', '-C', '/data/openpilot', 'rev-parse', 'HEAD'], text=True).strip()
    if commit not in SUPPORTED_COMMITS:
        raise SystemExit('Unsupported openpilot commit; nothing installed.')
    changes = subprocess.check_output(['git', '-C', '/data/openpilot', 'status', '--porcelain',
                                      '--untracked-files=all', '--', 'openpilot/system'], text=True)
    if unexpected_system_changes(changes):
        raise SystemExit('System source changes need review; nothing installed.')
    for binary in ('openpilot/system/camerad/camerad', 'openpilot/system/loggerd/encoderd'):
        if not os.access(Path('/data/openpilot') / binary, os.X_OK):
            raise SystemExit('Camera binaries missing; nothing installed.')
    if not hasattr(av.container.OutputContainer, 'add_stream_from_template'):
        raise SystemExit('PyAV template remux API unavailable; report PyAV version ' + av.__version__)
    if 'GNU coreutils' not in subprocess.check_output(['/usr/bin/timeout', '--version'], text=True):
        raise SystemExit('GNU timeout required.')
    config_path = BASE / 'camera.json'
    validate_config(json.loads(config_path.read_text()))
    if config_path.stat().st_mode & 0o077:
        raise SystemExit('Run chmod 600 /data/carrot-camera/camera.json first.')
    hook = Path('/data/continue.sh')
    if not hook.is_file() or hook.is_symlink():
        raise SystemExit('Unsupported startup file; nothing installed.')
    source = hook.read_text()
    if not source.startswith('#!') or 'bash' not in source.splitlines()[0] or not any(
        name in source for name in ('launch_openpilot', 'launch_chffrplus')
    ):
        raise SystemExit('Unrecognized startup file; nothing installed.')
    subprocess.run(['bash', '-n', str(hook)], check=True)
    if MARKER not in source:
        backup = BASE / 'continue.sh.before-camera'
        if not backup.exists():
            shutil.copy2(hook, backup)
        lines = source.splitlines(keepends=True)
        updated = lines[0] + MARKER + '\n' + LINE + '\n' + ''.join(lines[1:])
        temporary = hook.with_name('continue.sh.camera.tmp')
        temporary.write_text(updated)
        os.chmod(temporary, hook.stat().st_mode)
        subprocess.run(['bash', '-n', str(temporary)], check=True)
        temporary.replace(hook)
    (BASE / 'enabled').touch()
    subprocess.Popen(['bash', str(BASE / 'supervisor.sh')], stdin=subprocess.DEVNULL,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    print('Camera service installed. Existing collector and openpilot checkout unchanged.')
    print('Idle service will connect to HA. Read agent.log for connection status.')


if __name__ == '__main__':
    main()

"""Disable only this camera service; preserve the existing collector and startup file."""
import os
from pathlib import Path
import signal
import time

BASE = Path(__file__).resolve().parent


def main():
    (BASE / 'enabled').unlink(missing_ok=True)
    try:
        pid = int((BASE / 'agent.pid').read_text().strip())
        proc = Path('/proc') / str(pid)
        argv = (proc / 'cmdline').read_bytes().split(b'\x00')
        cwd = (proc / 'cwd').resolve()
        if cwd != BASE or b'agent.py' not in argv:
            raise SystemExit('PID is not this camera agent; no process was signalled.')
        os.kill(pid, signal.SIGTERM)
        for _ in range(200):
            if not proc.exists():
                break
            time.sleep(.1)
        else:
            raise SystemExit('Agent has not exited; inspect agent.log before proceeding.')
    except (FileNotFoundError, ProcessLookupError):
        pass
    print('Camera service disabled. Startup hook is inert; collector is unchanged.')


if __name__ == '__main__':
    main()

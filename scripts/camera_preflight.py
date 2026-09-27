"""Read-only camera compatibility report. Does not start cameras or import openpilot."""
import argparse
import hashlib
import json
import os
import platform
import subprocess
from pathlib import Path


SOURCE_FILES = (
    "system/manager/process_config.py",
    "system/camerad/snapshot.py",
    "system/loggerd/encoderd.cc",
    "system/loggerd/loggerd.h",
    "system/webrtc/device/video.py",
)
PARAMS = ("IsOnroad", "IsOffroad", "IsTakingSnapshot", "IsDriverViewEnabled")


def git_value(root, *args):
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True,
            text=True, timeout=5, check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def report(root, params_dir, proc_dir):
    sources = {}
    for name in SOURCE_FILES:
        path = root / "openpilot" / name
        if not path.is_file():
            path = root / name
        try:
            data = path.read_bytes()
            sources[name] = {
                "path": str(path.relative_to(root)),
                "sha256": hashlib.sha256(data).hexdigest(),
                "tracked_changes": git_value(root, "status", "--porcelain", "--", str(path)),
            }
        except OSError:
            sources[name] = {"available": False}
    state = {}
    for name in PARAMS:
        try:
            value = (params_dir / name).read_bytes().strip()
            state[name] = {b"1": True, b"0": False}.get(value)
        except OSError:
            state[name] = None
    processes = []
    try:
        for entry in proc_dir.iterdir():
            if not entry.name.isdecimal():
                continue
            try:
                # Never print argv: cloudflared and other processes may carry secrets.
                name = (entry / "comm").read_text().strip()
                if name in {"camerad", "encoderd", "cloudflared", "tailscaled"}:
                    processes.append({"pid": int(entry.name), "name": name})
            except OSError:
                continue
    except OSError:
        pass
    binaries = {}
    for name in ("system/camerad/camerad", "system/loggerd/encoderd"):
        candidates = (root / "openpilot" / name, root / name)
        path = next((p for p in candidates if p.is_file()), None)
        binaries[name] = {"exists": path is not None,
                          "executable": bool(path and os.access(path, os.X_OK))}
    return {
        "schema": "carrot-camera-preflight-v1", "read_only": True,
        "architecture": platform.machine(),
        "commit": git_value(root, "rev-parse", "HEAD"),
        "branch": git_value(root, "branch", "--show-current"),
        "parameters": state, "processes": processes,
        "binaries": binaries, "sources": sources,
        "limitations": "Static report only; does not prove camera, encoder or parked streaming works.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/data/openpilot"))
    parser.add_argument("--params", type=Path, default=Path("/data/params/d"))
    parser.add_argument("--proc", type=Path, default=Path("/proc"))
    args = parser.parse_args()
    print(json.dumps(report(args.root.resolve(), args.params, args.proc), indent=2))


if __name__ == "__main__":
    main()

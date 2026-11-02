#!/usr/bin/env python3
"""Assemble a Git-only personal candidate; vendor binaries stay upstream.

The result is a new independent Git checkout. No Comma access or reboot.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile

from prepare_iqpilot_ha import prepare, IQ_SHA, CARROT_SHA, git

VENDOR_URL = 'https://git.konn3kt.com/IQ.Lvbs/IQPilot.git'
LINK_DIRS = ('artifacts', 'iqpilot/selfdrive/assets', 'iqpilot/third_party')
PUBLIC_SUFFIXES = ('.py', '.sh', '.capnp')

BOOTSTRAP = '''#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
expected=5c9291b9df6d90007d73ecd749b135bd5008e80d
cd "$root"
if [ -e vendor/iqpilot/.git ]; then
  git -C vendor/iqpilot diff --quiet
  git -C vendor/iqpilot diff --cached --quiet
fi
git submodule update --init --depth 1 -- vendor/iqpilot
actual=$(git -C vendor/iqpilot rev-parse HEAD)
if [ "$actual" != "$expected" ]; then
  echo 'IQpilot vendor version differs from the verified candidate; refusing launch.' >&2
  exit 1
fi
git -C vendor/iqpilot diff --quiet
git -C vendor/iqpilot diff --cached --quiet
# Runtime state remains outside both Git checkouts.
mkdir -p /data/iqpilot-ha-runtime
'''


def linked_directory(relative):
    return any(relative == directory or relative.startswith(directory + '/') for directory in LINK_DIRS)


def materialized(relative):
    """Public upstream files copied into the superproject; everything else links into vendor."""
    return Path(relative).name == '.gitignore' or relative.endswith(PUBLIC_SUFFIXES) or relative in (
        'LICENSE', 'README.md', 'SECURITY.md', '.gitattributes', '.gitignore',
        'pyproject.toml', 'uv.lock', 'prebuilt')


def build(donor, iq, output, iq_sha=IQ_SHA):
    launch_env = git(iq, 'show', 'HEAD:launch_env.sh').decode()
    versions = set(re.findall(r'export AGNOS_VERSION="([^"]+)"', launch_env))
    if len(versions) != 1:
        raise ValueError('Expected one explicit IQ.OS version; review multi-device OS selection')
    required_os = versions.pop().removeprefix('IQ.OS ')
    if output.exists():
        raise ValueError('Candidate destination must not exist')
    output.mkdir(parents=True)
    subprocess.run(['git', 'init', '-b', 'codex/iqpilot-ha', str(output)], check=True, stdout=subprocess.DEVNULL)
    (output / '.gitmodules').write_text('[submodule "iqpilot-vendor"]\n\tpath = vendor/iqpilot\n\turl = ' + VENDOR_URL + '\n')
    (output / 'vendor/iqpilot').mkdir(parents=True)
    inventory = git(iq, 'ls-tree', '-r', '-z', 'HEAD').split(b'\0')
    copied, linked = {}, []

    def link(relative):
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.symlink_to(os.path.relpath(output / 'vendor/iqpilot' / relative, target.parent))
        linked.append(relative)

    for directory in LINK_DIRS:
        link(directory)
    for record in inventory:
        if not record:
            continue
        metadata, raw_path = record.split(b'\t', 1)
        mode, kind, oid = metadata.decode().split()
        relative = raw_path.decode()
        if linked_directory(relative):
            continue
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if mode == '120000' or not materialized(relative):
            link(relative)
        else:
            data = git(iq, 'cat-file', 'blob', oid)
            target.write_bytes(data)
            target.chmod(0o755 if mode == '100755' else 0o644)
            copied[relative] = hashlib.sha256(data).hexdigest()
    with tempfile.TemporaryDirectory(prefix='iq-ha-overlay-') as folder:
        overlay = Path(folder) / 'sources'
        manifest = prepare(donor, iq, overlay, iq_sha)
        shutil.copytree(overlay / 'iqpilot', output / 'iqpilot', dirs_exist_ok=True)
    bootstrap = output / 'bootstrap/ensure_vendor.sh'
    bootstrap.parent.mkdir()
    bootstrap.write_text(BOOTSTRAP.replace(IQ_SHA, iq_sha))
    bootstrap.chmod(0o755)
    source_root = Path(__file__).resolve().parents[1]
    switch = output / 'bootstrap/switch_to_carrot.sh'
    switch.write_bytes((source_root / 'compat/iqpilot/switch_to_carrot.sh').read_bytes())
    switch.chmod(0o755)
    installer = output / 'bootstrap/install_from_stock.py'
    installer.write_bytes((source_root / 'compat/iqpilot/install_from_stock.py').read_bytes())
    installer.chmod(0o755)
    updater = output / 'bootstrap/update_iq_ha.py'
    updater.write_bytes((source_root / 'compat/iqpilot/update_iq_ha.py').read_bytes())
    updater.chmod(0o755)
    launch = output / 'launch_chffrplus.sh'
    original = launch.read_text()
    preamble = 'bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bootstrap/ensure_vendor.sh" || exit $?\n'
    launch.write_text(original.replace('#!/usr/bin/env bash\n', '#!/usr/bin/env bash\n' + preamble, 1))
    entrypoint = output / 'launch_openpilot.sh'
    entrypoint.unlink()
    entrypoint.write_text('#!/usr/bin/env bash\nexec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/launch_chffrplus.sh"\n')
    entrypoint.chmod(0o755)
    # Git tracks this link, not the runtime directory it points to.
    (output / '.iqpilot').symlink_to('/data/iqpilot-ha-runtime')
    with (output / '.gitignore').open('a') as stream:
        stream.write('\n# HA companion runtime must never enter Git\niqpilot/selfdrive/carrot/ha/state/\n__pycache__/\n/.iqpilot-runtime-wheel-lock-sha256\n/.uv-tmp/\n')
    manifest.update({'status': 'INSTALL_CANDIDATE_PENDING_CI_AND_DEVICE', 'vendor_url': VENDOR_URL,
                     'required_os': required_os,
                     'materialized_public_files': copied, 'vendor_links': linked,
                     'carrot_sha': CARROT_SHA})
    (output / 'HA_CANDIDATE.json').write_text(json.dumps(manifest, indent=2))
    (output / 'PORTABILITY.json').write_text(json.dumps(manifest, indent=2))
    tests = output / 'tests'
    tests.mkdir()
    for name in ('test_iqpilot_camera.py', 'test_iqpilot_terminal.py', 'test_iqpilot_video.py', 'test_iqpilot_return.py', 'test_iqpilot_can_contract.py', 'test_iqpilot_restore.py', 'test_iqpilot_install.py', 'test_iqpilot_update.py'):
        text = (source_root / 'tests' / name).read_text()
        text = text.replace('compat/iqpilot/iq_camera.py', 'iqpilot/selfdrive/carrot/ha/iq_camera.py')
        text = text.replace('compat/iqpilot/iq_terminal.py', 'iqpilot/selfdrive/carrot/ha/iq_terminal.py')
        text = text.replace('compat/iqpilot/iq_video.py', 'iqpilot/selfdrive/carrot/ha/iq_video.py')
        text = text.replace('compat/iqpilot/iq_preflight.py', 'iqpilot/selfdrive/carrot/ha/iq_preflight.py')
        text = text.replace('compat/iqpilot/switch_to_carrot.sh', 'bootstrap/switch_to_carrot.sh')
        text = text.replace('compat/iqpilot/install_from_stock.py', 'bootstrap/install_from_stock.py')
        text = text.replace('compat/iqpilot/update_iq_ha.py', 'bootstrap/update_iq_ha.py')
        (tests / name).write_text(text)
    (tests / 'fetch_iqpilot_can_runtime.py').write_bytes((source_root / 'scripts/fetch_iqpilot_can_runtime.py').read_bytes())
    workflow = output / '.github/workflows/iq-ha-validation.yml'
    workflow.parent.mkdir(parents=True)
    workflow.write_text('''name: IQ HA candidate validation
on:
  push:
    branches: [iq-ha]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  companion:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-python@v6
        with:
          python-version: '3.12'
      - run: python -m pip install aiohttp av pycapnp numpy requests
      - name: Fetch pinned public CAN runtime (no vendor binaries)
        run: |
          pin=$(python -c 'import json; print(json.load(open("HA_CANDIDATE.json"))["iqpilot_sha"])')
          git init /tmp/iq-can-source
          git -C /tmp/iq-can-source remote add origin https://git.konn3kt.com/IQ.Lvbs/IQPilot.git
          git -C /tmp/iq-can-source fetch --depth 1 --filter=blob:none origin "$pin"
          git -C /tmp/iq-can-source update-ref HEAD FETCH_HEAD
          python tests/fetch_iqpilot_can_runtime.py --repo /tmp/iq-can-source --output /tmp/iq-can-runtime
      - name: Actual IQ CAN parser to HA values and current camera schema
        env:
          IQ_HA_CAN_PACKAGE_ROOT: /tmp/iq-can-runtime
        run: python -m unittest discover -s tests -p test_iqpilot_can_contract.py
      - name: Source assembly and isolated PTY/camera guards
        run: |
          python -m iqpilot.selfdrive.carrot.ha.iq_preflight --source-only
          python -m unittest discover -s tests -p 'test_iqpilot_*.py'
      - name: Preserved archive and measurement contracts
        run: |
          for pattern in test_trip_measurements.py 'test_battery*.py' test_bms_actual.py 'test_charge*.py' test_outbox_lanes.py test_log_activation.py; do
            python -m unittest discover -s iqpilot/selfdrive/carrot/ha/tests -p "$pattern" || exit 1
          done
''')
    (output / 'HA_INSTALL.md').write_text('''# IQpilot + Carrot HA personal installation candidate

This is a personal, non-commercial IQpilot fork with a pinned, unmodified upstream Git submodule.
It preserves the upstream license and proprietary runtime verification. Vendor binaries are fetched
from the upstream Git repository, not redistributed in this superproject.

Candidate only: local/CI tests do not establish vehicle compatibility or successful OS rollback.
An off-device Carrot settings/database backup is required before switching. Do not wipe/reset the device.
The initial boot downloads the pinned upstream repository and follows its normal IQ.OS update path.
HA, Comma installation and reboot must be performed by the owner; do not patch device sources by SSH/SCP.

For a matching clean stock IQ install, clone this branch into a separate staging directory,
then use `python3 bootstrap/install_from_stock.py --prepare-vendor`. Only after CI and version
checks, the owner runs the same script without arguments to activate through Git. Shallow
stock repositories are supported. The script never reboots or restores credentials.
Full procedure: helico717/carrot-ha docs/IQPILOT_HA_UPDATE_PATH_2026-11-02.md.

After installation, while parked, run:

    cd /data/openpilot
    /usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight

This diagnostics command does not start cameras, send CAN or change settings. Confirm live HA
measurement time, one short recorded trip/charge, camera display and onroad shutdown, terminal
reconnect, raw log/video transfer and the return path before accepting the candidate.

Carrot parameter synchronization is paused. Do not use the Carrot parameter card during IQ testing.
IQ settings remain on the device; there is no claimed IQ parameter editor in HA yet. General logs
and video reuse the existing upload API; Carrot-specific log analysis is not claimed compatible.
IQ Sentry/Live View take precedence over the HA parked camera. No vehicle runtime tests have passed yet.
Do not use an updater/branch selector to replace this companion branch with stock IQ inadvertently.

The runtime diagnostics also print `carrot_return`. It checks, read-only, whether the inactive-slot
partitions are writable by the Carrot OS flasher (IQ.OS removes owner root). Only
`SOFTWARE_RETURN_POSSIBLE_UNVERIFIED` allows the software return; otherwise plan a recovery first.
Return to the pinned Carrot commit with Git only (no force/reset/clean, stops on any conflict):

    cd /data/openpilot
    bash bootstrap/switch_to_carrot.sh

Then reboot. Full owner procedure: carrot-ha docs/IQPILOT_HA_INSTALL_AND_RETURN.md.
''')
    (output / 'README.md').write_text('''# IQpilot + Carrot HA 개인 시험 후보

IQpilot 원본은 vendor/iqpilot Git 하위 저장소로 고정하고, 기존 차량 수신 앱·HA에
연결하는 공개 HA 확장만 함께 공급합니다. 원본 대용량 바이너리는 IQpilot Git에서
직접 받습니다. [원본 라이선스](LICENSE)를 유지하며 개인 비상업용 시험 후보입니다.

**실차·카메라 영상·OS 왕복 검증 전입니다. 정식 완성판이나 모든 기능의 실기 통과를 뜻하지 않습니다.**
설치/재부팅은 사용자 작업이며, 외부에 보관한 당근 설정·DB 백업을 먼저 확보해야 합니다.
첫 실행에는 원본 다운로드와 정상 IQ.OS 업데이트 과정이 필요할 수 있습니다.
기기 소스를 SSH/SCP로 복사·편집하지 않습니다. 공장 초기화나 강제 reset을 요구하지 않습니다.

- 기존 HA 차량 대시보드·차계부용 수집/기록 경로 유지
- HA 관리자 전용 역방향 터미널과 주차 카메라 확장
- 기존 로그/영상 전송 경로 유지, 당근 전용 분석은 호환을 주장하지 않음
- 당근 파라미터 동기화는 일시 중지. IQ 설정 변경은 기기에서 수행하며 HA용 IQ 설정 편집기는 아직 없음
- IQ Sentry/Live View가 사용 중이면 HA 카메라 시작 차단

[설치 후 읽기 전용 점검과 시험 범위](HA_INSTALL.md)를 확인하세요.
HA/Comma 실제 설치·주행 검증 없이 로컬/CI 통과만으로 안정성을 판단하지 않습니다.
''')
    manifest['materialized_public_files'].pop('README.md', None)
    (output / 'CHANGELOG.md').write_text('''# Personal IQpilot HA candidate

## 2026-11-02 — Initial installation candidate

- Pinned IQpilot release 5c9291b9df6d90007d73ecd749b135bd5008e80d as an unmodified Git submodule.
- Ported HA companion from the actual Carrot vehicle commit 5ec4868a12a9038547b373eb95be3a5fa86d30aa.
- Preserved vehicle identity/configuration and HA outbox paths outside Git; paused Carrot-only parameter writes.
- Added administrator reverse-terminal PTY without a Carrot local web server or new network listener.
- Added separate parked-camera ownership and fail-closed IQ Sentry/Live View exclusion.
- Added source/runtime diagnostics; no CAN actuation, camera startup or reboot in diagnostics.
- Vendor binaries remain in the original pinned repository; public Python sources retain the upstream license.
- Local validation: 10 source assembly checks and 35 functional checks pass. Linux CI/device/OS rollback status
  is tracked in the companion helico717/carrot-ha preparation report. No vehicle installation performed.
- Initial Linux CI exposed a test expectation for Bash bracketed-paste ANSI output; normalize terminal
  controls before checking the actual standalone output line. Git ignore files are regular tracked files.
- Stock automatic source updating is disabled; companion updates use this Git branch only.
- Finalized camera TS remux can use IQpilot's PyAV when the ffmpeg command is unavailable.

## 2026-11-02 — Carrot return readiness

- Diagnostics report read-only inactive-slot write access for the Carrot OS flasher, the /AGNOS
  marker the Carrot launcher requires for its OS reinstall, and sudo availability.
- Added a Git-only return script to the pinned Carrot commit; it refuses onroad, local tracked
  changes, an unexpected ha-back commit and untracked collisions, and never reboots.
- Not yet tried on a device; the IQ.OS -> Carrot OS flash remains unverified.

## 2026-11-02 — FastSleep and Carrot-only pauses

- Diagnostics require FastSleep off: deep standby would stop HA monitoring, terminal and camera while parked.
- HA pauses the Carrot parameter queue and driving log transfer/screens while this branch runs;
  the device keeps following HA's log transfer policy, so no IQ recordings are uploaded.

## 2026-11-02 — Return requires a confirmed parked state

- switch_to_carrot.sh proceeds only with IsOffroad=1 and IsOnroad=0. Missing or unknown state refuses
  unless the owner passes --confirm-parked in a guided recovery; an onroad report always refuses.
''')
    manifest['candidate_source_sha256'] = {
        str(path.relative_to(output)): hashlib.sha256(path.read_bytes()).hexdigest()
        # Sorted: directory order differs between macOS and Linux, and the manifest must be reproducible.
        for path in sorted(output.rglob('*'))
        if path.relative_to(output).parts[0] != '.git' and not path.is_symlink()
        and path.is_file() and path.name not in ('HA_CANDIDATE.json', 'PORTABILITY.json')}
    (output / 'HA_CANDIDATE.json').write_text(json.dumps(manifest, indent=2))
    (output / 'PORTABILITY.json').write_text(json.dumps(manifest, indent=2))
    subprocess.run(['git', '-C', str(output), 'add', '-f', '.'], check=True)
    subprocess.run(['git', '-C', str(output), 'update-index', '--add', '--cacheinfo',
                    '160000,' + iq_sha + ',vendor/iqpilot'], check=True)
    print('CANDIDATE_ASSEMBLED', output, 'public_files=', len(copied), 'links=', len(linked))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--donor', type=Path, required=True)
    parser.add_argument('--iqpilot', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--iqpilot-sha', default=IQ_SHA, help='IQpilot commit to pin (default: the reviewed one)')
    args = parser.parse_args()
    build(args.donor, args.iqpilot, args.output, args.iqpilot_sha)

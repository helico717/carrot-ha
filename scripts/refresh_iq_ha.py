#!/usr/bin/env python3
"""Rebuild the iq-ha candidate on a new IQpilot release commit, test it, and commit on top.

iq-ha is always the builder output of (this repository's builder and adapters, the pinned
Carrot donor, an IQpilot commit). This only moves the IQpilot commit. Upstream publishes each
release as one force-pushed commit, so an old pin can disappear from the server; keeping the pin
current is part of the job. It stops without a commit when IQpilot requires a different IQ.OS or a
port patch no longer applies; those need a human review. Pushing is left to the caller (the GitHub workflow).

Exit codes: 0 committed or nothing to do (see the RESULT line), 1 error, 3 needs review.
"""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_iqpilot_ha_candidate import build, linked_directory, materialized  # noqa: E402
from prepare_iqpilot_ha import CARROT_SHA  # noqa: E402

IQ_URL = 'https://git.konn3kt.com/IQ.Lvbs/IQPilot.git'
IQ_BRANCH = 'release'
DONOR_URL = 'https://github.com/helico717/openpilot.git'
DONOR_BRANCH = 'ha-back'
BOT = ['-c', 'user.name=iq-ha refresh', '-c', 'user.email=iq-ha-refresh@users.noreply.github.com']


class NeedsReview(Exception):
    pass


def git(*args, cwd=None, capture=True):
    # No detached auto-gc: it would race the temporary directory cleanup.
    result = subprocess.run(['git', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', *args], cwd=cwd, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ''


def agnos_version(launch_env):
    match = re.search(r'export AGNOS_VERSION="([^"]+)"', launch_env)
    if not match:
        raise NeedsReview('IQ.OS version line not found in launch_env.sh')
    return match.group(1)


def prefetch(repo, wanted_path):
    """One batched blob fetch; a filtered clone would otherwise fetch each file the builder reads separately."""
    wanted = []
    for record in git('ls-tree', '-r', '-z', 'HEAD', cwd=repo).split('\0'):
        if not record:
            continue
        metadata, relative = record.split('\t', 1)
        mode, kind, oid = metadata.split()
        if kind == 'blob' and mode != '120000' and wanted_path(relative):
            wanted.append(oid)
    subprocess.run(['git', '-c', 'gc.auto=0', '-c', 'fetch.negotiationAlgorithm=noop', 'fetch', '-q', 'origin', '--no-tags',
                    '--no-write-fetch-head', '--recurse-submodules=no', '--filter=blob:none', '--stdin'],
                   cwd=repo, input='\n'.join(wanted) + '\n', text=True, check=True)
    print(f'Fetched {len(wanted)} files from {repo.name}', flush=True)


def upstream_notes(iq, limit=25):
    """Top of IQpilot's own changelog. Releases are single force-pushed commits, so git log has no history."""
    try:
        text = git('show', 'HEAD:iqpilot/docs/CHANGELOG.md', cwd=iq)
    except subprocess.CalledProcessError:
        return '(no upstream changelog)'
    lines = [line for line in text.splitlines() if line.strip()]
    return '\n'.join(lines[:limit])


def run_tests(candidate):
    """Same checks as the iq-ha validation workflow; vendor binaries are not needed."""
    python = sys.executable
    steps = [[python, '-m', 'iqpilot.selfdrive.carrot.ha.iq_preflight', '--source-only'],
             [python, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_iqpilot_*.py']]
    for pattern in ('test_trip_measurements.py', 'test_battery*.py', 'test_bms_actual.py', 'test_charge*.py',
                    'test_outbox_lanes.py', 'test_log_activation.py'):
        steps.append([python, '-m', 'unittest', 'discover', '-s', 'iqpilot/selfdrive/carrot/ha/tests', '-p', pattern])
    for step in steps:
        subprocess.run(step, cwd=candidate, check=True)


def refresh(candidate, work, force=False, iqpilot_sha=None):
    candidate = Path(candidate).resolve()
    current = git('ls-tree', 'HEAD', 'vendor/iqpilot', cwd=candidate).split()[2]
    if iqpilot_sha is None:
        iqpilot_sha = git('ls-remote', IQ_URL, 'refs/heads/' + IQ_BRANCH).split()[0]
    print(f'IQpilot pinned {current}, requested {iqpilot_sha}', flush=True)
    if iqpilot_sha == current and not force:
        return 'UP_TO_DATE'

    iq = work / 'iqpilot'
    git('clone', '-q', '--filter=blob:none', '--no-checkout', '-b', IQ_BRANCH, IQ_URL, str(iq))
    if iqpilot_sha != git('rev-parse', 'HEAD', cwd=iq):
        git('fetch', '-q', '--filter=blob:none', 'origin', iqpilot_sha, cwd=iq)
        git('update-ref', '--no-deref', 'HEAD', iqpilot_sha, cwd=iq)
    prefetch(iq, lambda relative: not linked_directory(relative) and materialized(relative))
    new_os = agnos_version(git('show', 'HEAD:launch_env.sh', cwd=iq))
    old_os = agnos_version((candidate / 'launch_env.sh').read_text())
    if new_os != old_os:
        raise NeedsReview(f'IQpilot now requires {new_os} instead of {old_os}; an OS reinstall needs review')

    donor = work / 'donor'
    git('clone', '-q', '--filter=blob:none', '--no-checkout', '-b', DONOR_BRANCH, DONOR_URL, str(donor))
    if git('rev-parse', 'HEAD', cwd=donor) != CARROT_SHA:
        raise NeedsReview(f'{DONOR_BRANCH} no longer points at the pinned Carrot commit {CARROT_SHA}')
    prefetch(donor, lambda relative: relative.startswith('openpilot/selfdrive/carrot/ha/'))

    output = work / 'candidate'
    try:
        build(donor, iq, output, iqpilot_sha)
    except ValueError as error:
        raise NeedsReview(f'Port patch no longer applies: {error}') from error
    # Take the builder's exact tree, deletions included, instead of syncing files by hand.
    git(*BOT, 'commit', '-q', '-m', 'assembled', cwd=output)
    git('fetch', '-q', str(output), 'HEAD', cwd=candidate)
    if git('rev-parse', 'FETCH_HEAD^{tree}', cwd=candidate) == git('rev-parse', 'HEAD^{tree}', cwd=candidate):
        return 'IDENTICAL'
    git('read-tree', '-u', '--reset', 'FETCH_HEAD', cwd=candidate)
    run_tests(candidate)
    message = (f'chore(iq-ha): pin IQpilot {current[:8]} -> {iqpilot_sha[:8]}\n\n'
               f'Automatic rebuild on {IQ_BRANCH}; IQ.OS stays {old_os}. HA companion tests passed on Linux.\n'
               f'Not tried on a vehicle.\n\nUpstream: {git("log", "-1", "--format=%cs %s", cwd=iq)}\n'
               f'{upstream_notes(iq)}\n')
    subprocess.run(['git', *BOT, 'commit', '-q', '-F', '-'], cwd=candidate, input=message, text=True, check=True)
    return 'COMMITTED'


def report(result, detail=''):
    print(f'RESULT={result} {detail}'.rstrip(), flush=True)
    if os.environ.get('GITHUB_ACTIONS'):
        # Annotations stay readable on the public run page without signing in.
        print(f'::notice title=iq-ha refresh::{result} {detail}'.rstrip(), flush=True)
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
            stream.write(f'result={result}\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--candidate', required=True, help='checkout of the iq-ha branch')
    parser.add_argument('--force', action='store_true', help='rebuild even when the pin is current')
    parser.add_argument('--iqpilot-sha', help='test override for the upstream commit')
    args = parser.parse_args()
    folder = tempfile.mkdtemp(prefix='iq-ha-refresh-')
    try:
        result = refresh(args.candidate, Path(folder), args.force, args.iqpilot_sha)
    except NeedsReview as error:
        report('NEEDS_REVIEW', str(error))
        return 3
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    report(result)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

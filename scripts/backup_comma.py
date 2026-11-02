#!/usr/bin/env python3
"""Private, read-only source backup. Run from a Git checkout while parked.

Does not restore settings, install software, or reboot. Archives contain secrets.
SQLite databases are backed up individually, not as one atomic system snapshot.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import subprocess
import tarfile
import tempfile
import time

PATHS = (
    'data/id4-collector', 'data/carrot_ha', 'data/carrot-camera',
    'data/params/d',
    'data/openpilot/openpilot/selfdrive/carrot/ha/state',
    'data/openpilot/openpilot/selfdrive/carrot_settings.json',
    'data/openpilot/selfdrive/carrot_settings.json',
    'data/carrot/carrot_settings.json',
)


def copy_file(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with source.open('rb') as stream:
        database = stream.read(16) == b'SQLite format 3\x00'
    if database:
        deadline = time.monotonic() + 60
        def progress(*_):
            if time.monotonic() > deadline:
                raise TimeoutError('Database backup timed out')
        with closing(sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True)) as src:
            with closing(sqlite3.connect(target)) as dst:
                src.backup(dst, pages=256, progress=progress)
                dst.execute('PRAGMA journal_mode=DELETE')
                if dst.execute('PRAGMA quick_check').fetchall() != [('ok',)]:
                    raise RuntimeError('Database integrity check failed')
    else:
        before = source.stat()
        shutil.copyfile(source, target)
        after = source.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise RuntimeError('Source changed; retry while parked with settings idle')
    target.chmod(0o600)


def snapshot(root, stage):
    missing, skipped = [], []
    for relative in PATHS:
        source = root / relative
        if not source.exists():
            missing.append(relative)
            continue
        # Resolve the known Params directory link, never arbitrary nested links.
        if source.is_symlink() and relative != 'data/params/d':
            raise RuntimeError('Unexpected source symlink: ' + relative)
        resolved = source.resolve()
        resolved.relative_to(root.resolve())
        files = sorted(resolved.rglob('*')) if resolved.is_dir() else [resolved]
        for file in files:
            suffix = file.relative_to(resolved) if resolved.is_dir() else Path()
            target = stage / relative / suffix if resolved.is_dir() else stage / relative
            if file.is_symlink():
                skipped.append(str(Path(relative) / suffix))
                continue
            if not stat.S_ISREG(file.stat().st_mode):
                continue
            # SQLite backup incorporates committed WAL; never copy its sidecars.
            if file.name.endswith(('-wal', '-shm', '-journal')):
                base = file.with_name(file.name.rsplit('-', 1)[0])
                if base.is_file():
                    with base.open('rb') as stream:
                        if stream.read(16) == b'SQLite format 3\x00':
                            continue
            copy_file(file, target)
    return {'missing': missing, 'skipped_symlinks': skipped}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--parked', action='store_true', help='confirm parked, settings idle')
    args = parser.parse_args()
    if not args.parked:
        parser.error('Park the vehicle and pass --parked; do not edit settings during backup')
    os.umask(0o077)
    repo = Path('/data/openpilot')
    def git(*arguments):
        return subprocess.check_output(['git', '-C', str(repo), *arguments], text=True).strip()
    metadata = {'created_utc': datetime.now(timezone.utc).isoformat(),
                'commit': git('rev-parse', 'HEAD'), 'branch': git('branch', '--show-current'),
                'git_status': git('status', '--short'),
                'os_version': Path('/VERSION').read_text().strip(),
                'limitations': 'Individual DB snapshots; no OS image, models or driving video; no automatic restore.'}
    output = Path('/data/carrot-backups')
    output.mkdir(mode=0o700, exist_ok=True)
    name = 'carrot-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.tar.gz'
    archive = output / name
    temporary = output / (name + '.partial')
    try:
        with tempfile.TemporaryDirectory(dir=output) as folder:
            stage = Path(folder)
            metadata.update(snapshot(Path('/'), stage))
            if 'data/params/d' in metadata['missing']:
                raise RuntimeError('Params directory missing')
            (stage / 'manifest.json').write_text(json.dumps(metadata, indent=2))
            with tarfile.open(temporary, 'w:gz') as tar:
                tar.add(stage, arcname='backup', recursive=True)
            with tarfile.open(temporary, 'r:gz') as tar:
                for member in tar:
                    if member.isfile():
                        with tar.extractfile(member) as stream:
                            while stream.read(1024 * 1024):
                                pass
            temporary.rename(archive)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        archive.with_suffix(archive.suffix + '.sha256').write_text(digest + '  ' + name + '\n')
        print('BACKUP_OK', archive)
        print('SHA256', digest)
        print('Missing paths:', len(metadata['missing']), 'Skipped links:', len(metadata['skipped_symlinks']))
        print('Private archive: copy off device. Contains credentials. Not an OS backup.')
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    main()

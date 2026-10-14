"""Resumable, bounded, newest-first original segment storage.

All operations run under the HA entry's async lock in an executor. No source
file becomes visible until every file in its manifest has been verified.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil

LIMIT = 5_000_000_000
CHUNK = 256 * 1024
FILES = {'qcamera.ts', 'qcamera.mp4', 'rlog.zst', 'rlog.bz2', 'rlog',
         'qlog.zst', 'qlog.bz2', 'qlog'}
SEGMENT = re.compile(r'^[A-Za-z0-9_|.-]{1,96}--[0-9]{1,6}$')


def segment_name(value):
    if not isinstance(value, str) or not SEGMENT.fullmatch(value) or '..' in value:
        raise ValueError('Invalid segment')
    return value


class LogStore:
    def __init__(self, root, limit=LIMIT):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.limit = limit
        self.index = self.root / 'index.json'
        self.state = json.loads(self.index.read_text()) if self.index.exists() else {'segments': {}, 'floor': 0}
        # A crash after rename but before index persistence is reconciled here.
        for name, item in list(self.state['segments'].items()):
            if not (self.root / name).is_dir():
                self.state['floor'] = max(self.state['floor'], item['recorded'])
                del self.state['segments'][name]
                continue
            if not item.get('complete') and all((self.root / name / f).is_file() for f in item['files']):
                item['complete'] = True
        self._save()

    def _save(self):
        temp = self.index.with_suffix('.tmp')
        with temp.open('w') as stream:
            json.dump(self.state, stream, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        temp.replace(self.index)

    def usage(self):
        return sum(p.stat().st_size for p in self.root.rglob('*') if p.is_file())

    def reserved(self):
        return sum(sum(item['files'].values()) for item in self.state['segments'].values())

    def begin(self, payload):
        name = segment_name(payload.get('segment'))
        recorded = payload.get('recorded')
        if (isinstance(recorded, bool) or not isinstance(recorded, (int, float))
                or not math.isfinite(recorded) or recorded <= 0):
            raise ValueError('Missing recording time')
        files = payload.get('files')
        if (not isinstance(files, dict) or not files or len(files) > len(FILES)
                or any(f not in FILES or type(size) is not int or size <= 0 for f, size in files.items())
                or not any(f.startswith('rlog') for f in files)
                or not any(f.startswith('qcamera') for f in files)):
            raise ValueError('A complete camera and rlog manifest is required')
        size = sum(files.values())
        # Reserve metadata overhead; previews are not persisted in this phase.
        budget = self.limit - min(1_000_000, self.limit // 2)
        if size > budget or recorded <= self.state['floor']:
            return {'accepted': False, 'reason': 'outside_retention'}
        old = self.state['segments'].get(name)
        if old:
            if old['files'] != files or old['recorded'] != recorded:
                raise ValueError('The original segment changed')
            return self.status(name)
        duration = payload.get('duration')
        if duration is not None and (isinstance(duration, bool) or not isinstance(duration, (int, float))
                                     or not math.isfinite(duration) or not 0 < duration <= 1800):
            raise ValueError('Invalid recording duration')
        candidates = {**self.state['segments'], name: {'recorded': recorded, 'duration': duration, 'files': files, 'complete': False}}
        # Account for two copies of the atomic index while publishing it.
        metadata_bytes = 2 * len(json.dumps({'segments': candidates, 'floor': self.state['floor']}, separators=(',', ':')).encode())
        budget = min(budget, self.limit - metadata_bytes)
        kept, total, overflow = set(), 0, False
        for key, item in sorted(candidates.items(), key=lambda pair: (pair[1]['recorded'], pair[0]), reverse=True):
            total += sum(item['files'].values())
            overflow = overflow or total > budget
            if not overflow:
                kept.add(key)
        if name not in kept or len(kept) > 5000:
            return {'accepted': False, 'reason': 'outside_retention'}
        # Ensure storage pressure does not consume the HA system's last space.
        if shutil.disk_usage(self.root).free < size + min(512_000_000, self.limit):
            raise OSError('Insufficient free space')
        for key in list(self.state['segments']):
            if key not in kept:
                self.state['floor'] = max(self.state['floor'], self.state['segments'][key]['recorded'])
                shutil.rmtree(self.root / key, ignore_errors=False)
                del self.state['segments'][key]
        self.state['segments'][name] = candidates[name]
        (self.root / name).mkdir()
        self._save()
        return self.status(name)

    def status(self, name):
        name = segment_name(name)
        item = self.state['segments'][name]
        offsets = {}
        for filename in item['files']:
            path = self.root / name / (filename if item['complete'] else filename + '.partial')
            offsets[filename] = path.stat().st_size if path.exists() else 0
        return {'accepted': True, 'complete': item['complete'], 'offsets': offsets, 'chunk_bytes': CHUNK}

    def chunk(self, name, filename, offset, data):
        name = segment_name(name)
        item = self.state['segments'][name]
        if item['complete'] or filename not in item['files'] or not 0 < len(data) <= CHUNK:
            raise ValueError('Invalid upload chunk')
        path = self.root / name / (filename + '.partial')
        actual = path.stat().st_size if path.exists() else 0
        if offset != actual or actual + len(data) > item['files'][filename]:
            raise ValueError('Upload offset or length mismatch')
        with path.open('ab') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        return {'offset': actual + len(data)}

    def commit(self, name, hashes):
        name = segment_name(name)
        item = self.state['segments'][name]
        if item['complete']:
            return self.status(name)
        if not isinstance(hashes, dict) or set(hashes) != set(item['files']):
            raise ValueError('Missing file hashes')
        paths = []
        for filename, size in item['files'].items():
            final = self.root / name / filename
            path = final if final.exists() else final.with_name(filename + '.partial')
            if not path.exists() or path.stat().st_size != size:
                raise ValueError('Incomplete file')
            digest = hashlib.sha256()
            with path.open('rb') as stream:
                for data in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(data)
            if digest.hexdigest() != hashes[filename]:
                # Permit a clean retry of the damaged file instead of a permanent loop.
                path.unlink()
                raise ValueError('File hash mismatch; restart damaged file')
            paths.append((path, final))
        for path, final in paths:
            path.replace(final)
        item['complete'] = True
        self._save()
        return self.status(name)

    def routes(self, offset=0, limit=40, sort='desc'):
        groups = {}
        for name, item in self.state['segments'].items():
            if item['complete']:
                route = name.rsplit('--', 1)[0]
                groups.setdefault(route, []).append((name, item))
        result = []
        for route, items in groups.items():
            items.sort(key=lambda pair: int(pair[0].rsplit('--', 1)[1]), reverse=sort != 'asc')
            epochs = [item['recorded'] for _, item in items]
            result.append({'route': route, 'title': route, 'segmentFolders': [n for n, _ in items],
                           'segmentCount': len(items), 'segmentTimes': {n: {'startEpoch': i['recorded'] - i['duration'] if i.get('duration') else None, 'endEpoch': i['recorded']} for n, i in items},
                           'routeStartEpoch': min(i['recorded'] - (i.get('duration') or 0) for _, i in items), 'routeEndEpoch': max(epochs),
                           'latestModifiedEpoch': max(epochs), 'segmentsHasMore': False})
        result.sort(key=lambda item: item['routeEndEpoch'], reverse=True)
        return {'routes': result[offset:offset + limit], 'total': len(result),
                'nextOffset': offset + limit, 'hasMore': offset + limit < len(result),
                'storage': {'used': self.usage(), 'limit': self.limit}}

    def file(self, name, kind):
        name = segment_name(name)
        item = self.state['segments'][name]
        if not item['complete']:
            raise KeyError(name)
        filenames = sorted([f for f in item['files'] if f.split('.')[0] == kind], key=lambda f: f != 'qcamera.mp4')
        if not filenames:
            raise KeyError(kind)
        return self.root / name / filenames[0]

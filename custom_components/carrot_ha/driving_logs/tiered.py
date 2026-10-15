"""A bounded HA cache and a device-stable, verified 30-day NAS archive."""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import time

from .store import CHUNK, FILES, LogStore, segment_name

LOCAL_LIMIT = 5_000_000_000
RETENTION_SECONDS = 30 * 86400
MARKER = {'format': 'carrot-driving-logs', 'version': 1}


def network_path(value):
    path = Path(value)
    if not path.is_absolute() or '..' in path.parts or path.name != 'driving-logs':
        raise ValueError('Select a dedicated driving-logs directory on a NAS mount')
    base = path.parent
    if not any(base.is_relative_to(root) and base != Path(root) for root in ('/share', '/media')):
        raise ValueError('Use an HA network storage mount under /share or /media')
    base.stat()
    if base.resolve() != base or path.is_symlink():
        raise ValueError('NAS symbolic links are not allowed')
    mounted = False
    for line in Path('/proc/self/mountinfo').read_text().splitlines():
        before, after = line.split(' - ', 1)
        target = Path(before.split()[4].replace('\\040', ' '))
        if after.split()[0] in ('nfs', 'nfs4', 'cifs') and base.is_relative_to(target):
            mounted = True
    if not mounted:
        raise OSError('NAS mount is unavailable; refusing a local fallback directory')
    return path


def atomic_json(path, value):
    if path.is_symlink():
        raise ValueError('Index symbolic links are not allowed')
    temporary = path.with_suffix('.tmp')
    if temporary.is_symlink():
        raise ValueError('Temporary index symbolic links are not allowed')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(value, stream, separators=(',', ':'))
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(data)
    return result.hexdigest()


class TieredLogStore:
    def __init__(self, root, nas_root, device_id, *, clock=time.time, guard=network_path):
        self.root, self.limit = Path(root), LOCAL_LIMIT
        self.local = LogStore(root, limit=LOCAL_LIMIT)
        self.local.before_retire = self.protect
        self.nas_root, self.device_id = str(nas_root), str(device_id)
        self.clock, self.guard = clock, guard
        self.catalog_path = self.root / 'nas-catalog.json'
        self.catalog = {'segments': {}}
        if self.catalog_path.exists():
            cached = json.loads(self.catalog_path.read_text(encoding='utf-8'))
            if cached.get('device_id') == self.device_id:
                self.catalog = cached
        self.local.limit = max(0, LOCAL_LIMIT - (self.catalog_path.stat().st_size if self.catalog_path.exists() else 0))
        self.nas = None
        self.nas_status = 'connecting'
        self._connect()

    def _connect(self):
        try:
            root = self.guard(self.nas_root)
            marker = root / '.carrot-driving-logs'
            root.mkdir(exist_ok=True)
            if not marker.exists():
                if any(root.iterdir()):
                    raise ValueError('NAS directory is not an empty dedicated log archive')
                atomic_json(marker, MARKER)
            if marker.is_symlink() or json.loads(marker.read_text()) != MARKER:
                raise ValueError('Invalid NAS archive marker')
            key = hashlib.sha256(self.device_id.encode()).hexdigest()
            directory = root / key
            if directory.is_symlink():
                raise ValueError('NAS device directory is a symbolic link')
            if self.nas is None:
                identity = directory / 'device.json'
                if identity.is_symlink() or (identity.exists() and json.loads(identity.read_text()).get('device_id') != self.device_id):
                    raise ValueError('NAS device identity mismatch')
                self.nas = LogStore(directory, limit=2 ** 60, max_segments=None)
                atomic_json(identity, {'device_id': self.device_id, 'version': 1})
                self._catalog()
            self.nas_status = 'available'
            return self.nas
        except (OSError, ValueError):
            self.nas_status = 'unavailable'
            return None

    def _catalog(self):
        self.catalog = {'device_id': self.device_id, 'segments': copy.deepcopy(self.nas.state['segments'])}
        atomic_json(self.catalog_path, self.catalog)
        self.local.limit = max(0, LOCAL_LIMIT - self.catalog_path.stat().st_size)

    @property
    def state(self):
        items = dict(self.catalog['segments'])
        for name, item in self.local.state['segments'].items():
            if item.get('complete') or not items.get(name, {}).get('complete'):
                items[name] = item
        # Only the archive's age boundary goes to Comma. Local capacity eviction
        # must never suppress older recordings that still belong in the archive.
        return {'segments': items, 'floor': max(0, self.clock() - RETENTION_SECONDS)}

    def protect(self, routes):
        cutoff = self.clock() - RETENTION_SECONDS
        expired = {route for route in routes if max(i['recorded'] for n, i in self.local.state['segments'].items()
                   if n.rsplit('--', 1)[0] == route) < cutoff}
        for name, item in self.local.state['segments'].items():
            if name.rsplit('--', 1)[0] not in routes:
                continue
            if name.rsplit('--', 1)[0] in expired:
                continue
            archived = self.catalog['segments'].get(name, {})
            if (not archived.get('complete') or not archived.get('hashes')
                    or archived.get('files') != item['files'] or archived.get('recorded') != item['recorded']
                    or (item.get('hashes') and item['hashes'] != archived['hashes'])):
                raise OSError('NAS copy is not verified; local recording retained')

    def _backend(self, name):
        name = segment_name(name)
        if name in self.local.state['segments'] and not self.local.state['segments'][name]['complete']:
            return self.local
        nas = self._connect()
        if nas and name in nas.state['segments']:
            return nas
        if name in self.local.state['segments']:
            return self.local
        raise KeyError(name)

    def begin(self, payload):
        name = segment_name(payload.get('segment'))
        route = name.rsplit('--', 1)[0]
        known = self.state['segments'].get(name)
        if known:
            if known['files'] != payload.get('files') or known['recorded'] != payload.get('recorded'):
                raise ValueError('The original segment changed')
            if known.get('complete'):
                return {'accepted': True, 'complete': True, 'offsets': known['files'], 'chunk_bytes': CHUNK}
            return self._backend(name).status(name)
        recorded = payload.get('recorded')
        if type(recorded) not in (int, float):
            raise ValueError('Missing recording time')
        cutoff = self.clock() - RETENTION_SECONDS
        route_recent = any(n.rsplit('--', 1)[0] == route and i['recorded'] >= cutoff for n, i in self.state['segments'].items())
        if recorded < cutoff and not route_recent:
            return {'accepted': False, 'reason': 'outside_retention'}
        nas = self._connect()
        if nas:
            return nas.begin(payload)
        # Offline buffering is still bounded. Protect() vetoes loss of any
        # recording that has not yet been verified on the NAS.
        result = self.local.begin(payload)
        if not result.get('accepted'):
            raise OSError('NAS unavailable and local cache cannot accept this recording')
        return result

    def chunk(self, name, filename, offset, data):
        return self._backend(name).chunk(name, filename, offset, data)

    def commit(self, name, hashes):
        backend = self._backend(name)
        result = backend.commit(name, hashes)
        if backend is self.nas:
            self._catalog()
        return result

    def status(self, name):
        return self._backend(name).status(name)

    def usage(self):
        return self.local.usage()

    def reserved(self):
        return self.local.reserved()

    def segment_info(self, name):
        return self.state['segments'][segment_name(name)]

    def directory(self, name):
        name = segment_name(name)
        item = self.local.state['segments'].get(name)
        if item and item['complete']:
            return self.local.directory(name)
        nas = self._connect()
        if not nas:
            raise OSError('NAS archive is offline')
        return nas.directory(name)

    def file(self, name, kind):
        name = segment_name(name)
        if self.local.state['segments'].get(name, {}).get('complete'):
            return self.local.file(name, kind)
        nas = self._connect()
        if not nas:
            raise OSError('NAS archive is offline')
        return nas.file(name, kind)

    def routes(self, offset=0, limit=40, sort='desc'):
        view = object.__new__(LogStore)
        view.state, view.root, view.limit = self.state, self.root, self.limit
        result = view.routes(offset, limit, sort)
        for route in result['routes']:
            names = route['segmentFolders']
            sources = [('ha', self.local.state['segments']), ('nas', self.catalog['segments'])]
            route['storageSources'] = [source for source, items in sources
                                      if any(n in items and items[n].get('complete') for n in names)]
        result['storage']['nas'] = {'status': self.nas_status, 'retention_days': 30,
            'segments': sum(bool(i.get('complete')) for i in self.catalog['segments'].values())}
        return result

    def _copy(self, source, target, name):
        item = source.segment_info(name)
        hashes = item.get('hashes') or {f: digest(source.directory(name) / f) for f in item['files']}
        result = target.begin({'segment': name, 'recorded': item['recorded'], 'duration': item.get('duration'), 'files': item['files']})
        if not result.get('accepted'):
            raise OSError('Cannot fit the complete drive in the local cache')
        if not result['complete']:
            for filename in item['files']:
                offset = result['offsets'][filename]
                partial = target.directory(name) / (filename + '.partial')
                if partial.is_symlink():
                    raise ValueError('Replica file symbolic links are not allowed')
                with (source.directory(name) / filename).open('rb') as stream:
                    stream.seek(offset)
                    # Filesystem replicas have no per-chunk network ACK. Flush once
                    # per file, then use the same full-file verification as uploads.
                    with partial.open('ab') as output:
                        shutil.copyfileobj(stream, output, length=1024 * 1024)
                        output.flush()
                        os.fsync(output.fileno())
            target.commit(name, hashes)
        # Read back the published copy before the source may be reclaimed.
        for filename, expected in hashes.items():
            if digest(target.directory(name) / filename) != expected:
                raise OSError('Replica read-back checksum mismatch')

    def maintain(self):
        """Bound each run to one migration/restore segment, independent of live telemetry."""
        nas = self._connect()
        if not nas:
            return {'phase': 'nas_unavailable'}
        for name, item in list(self.local.state['segments'].items()):
            if item['complete'] and not nas.state['segments'].get(name, {}).get('complete'):
                route = name.rsplit('--', 1)[0]
                if max(i['recorded'] for n, i in self.local.state['segments'].items()
                       if n.rsplit('--', 1)[0] == route) < self.clock() - RETENTION_SECONDS:
                    continue
                self._copy(self.local, nas, name)
                self._catalog()
                return {'phase': 'archiving'}
        groups = {}
        for name, item in nas.state['segments'].items():
            groups.setdefault(name.rsplit('--', 1)[0], []).append((name, item))
        cutoff = self.clock() - RETENTION_SECONDS
        expired = {route for route, items in groups.items() if max(i['recorded'] for _, i in items) < cutoff}
        if expired and getattr(self, 'on_retire', None):
            self.on_retire(expired)
        for route in expired:
            for name, item in groups[route]:
                directory = nas.directory(name)
                if directory.is_symlink() or any(p.is_symlink() or p.name not in FILES | {f + '.partial' for f in FILES} for p in directory.iterdir()):
                    raise ValueError('Unexpected files in NAS segment; retention stopped')
                nas.state['floor'] = max(nas.state['floor'], item['recorded'])
                shutil.rmtree(directory)
                del nas.state['segments'][name]
        if expired:
            nas._save()
            self._catalog()
        groups = {}
        for name, item in self.state['segments'].items():
            groups.setdefault(name.rsplit('--', 1)[0], []).append((name, item))
        selected, total = set(), 0
        for route, items in sorted(groups.items(), key=lambda pair: max(i['recorded'] for _, i in pair[1]), reverse=True):
            total += sum(sum(i['files'].values()) for _, i in items)
            if total > self.local.limit - 1_000_000:
                break
            selected.update(name for name, item in items if item['complete'])
        dropping = {n.rsplit('--', 1)[0] for n, i in self.local.state['segments'].items() if i['complete'] and n not in selected}
        self.protect(dropping)
        if dropping and getattr(self, 'on_retire', None):
            self.on_retire(dropping)
        for name, item in list(self.local.state['segments'].items()):
            if name.rsplit('--', 1)[0] in dropping and item['complete']:
                shutil.rmtree(self.local.directory(name))
                del self.local.state['segments'][name]
        self.local._save()
        for name in sorted(selected, key=lambda n: self.state['segments'][n]['recorded'], reverse=True):
            if not self.local.state['segments'].get(name, {}).get('complete'):
                # Cache tombstones are not archive deletion records or restore barriers.
                self.local.state['floor'] = 0
                self.local.state['retired_routes'] = []
                self._copy(nas, self.local, name)
                return {'phase': 'restoring'}
        return {'phase': 'ready', 'local_bytes': self.usage(), 'nas_segments': len(nas.state['segments'])}

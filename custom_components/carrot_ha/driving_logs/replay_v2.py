"""HA-scoped adapter for the original Carrot Routes production radar replay."""
import asyncio
import gzip
import hashlib
import json
import logging
import os
import re
import secrets
import shlex
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import time
import zipfile

from aiohttp import web

_LOGGER = logging.getLogger(__name__)
_EXTRACT_LOCK = threading.Lock()
ROOT = Path(__file__).parent
CACHE_LIMIT = 128 * 1024**2


def tool_commands(runtime, value, origin, entry_id, segment):
    """Ephemeral read-only capability for exactly the selected segment, not a HA token."""
    tokens = runtime.setdefault('driving_log_v2_tokens', {})
    now = time.monotonic()
    for key, item in list(tokens.items()):
        if item['expires'] <= now:
            tokens.pop(key)
    while len(tokens) >= 8:
        tokens.pop(next(iter(tokens)))
    token = secrets.token_urlsafe(32)
    device = str(value['deviceId'])
    if not re.fullmatch('[0-9a-f]{16}', device):
        device = hashlib.sha256(device.encode()).hexdigest()[:16]
    canonical = device + '|' + value['route']
    tokens[token] = {'segment':segment,'canonical':canonical,'device':device,'expires':now+900}
    api = f'{origin}/api/carrot_ha/v1/driving_logs_tools/{entry_id}/{token}/api'
    target = shlex.quote(f"{device}/{value['route']}/{value['firstSegment']}/r")
    prefix = 'API_HOST=' + shlex.quote(api) + ' '
    value.update(cabanaCommand=prefix+'./cabana '+target,
                 plotJugglerCommand=prefix+'python3 -m openpilot.tools.plotjuggler.juggle '+target,
                 jotPlugglerCommand=prefix+'./openpilot/tools/jotpluggler/jotpluggler '+target)


def engine_root():
    manifest = json.loads((ROOT / 'radar_engine/SOURCE.json').read_text())
    archive = ROOT / 'radar_engine/source.zip'
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['sha256']:
        raise ValueError('Radar engine source checksum mismatch')
    root = Path(tempfile.gettempdir()) / ('carrot-ha-radar-engine-' + manifest['sha256'][:20])
    with _EXTRACT_LOCK:
        if root.is_symlink():
            raise ValueError('Unsafe radar engine directory')
        marker = root / 'VERIFIED'
        if marker.exists() and marker.read_text() == manifest['sha256']:
            return root
        temporary = Path(tempfile.mkdtemp(prefix='carrot-ha-radar-extract-'))
        try:
            with zipfile.ZipFile(archive) as bundle:
                for name, expected in manifest['files'].items():
                    path = (temporary / name).resolve()
                    if not path.is_relative_to(temporary.resolve()):
                        raise ValueError('Invalid engine archive path')
                    data = bundle.read(name)
                    if hashlib.sha256(data).hexdigest() != expected:
                        raise ValueError('Engine source file mismatch')
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(data)
            (temporary / 'VERIFIED').write_text(manifest['sha256'])
            if root.exists():
                raise ValueError('Unverified engine directory already exists')
            temporary.replace(root)
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
    return root


class RadarJobs:
    def __init__(self, hass):
        self.hass = hass
        self.cache = Path(tempfile.mkdtemp(prefix='carrot-ha-v2-'))
        self.jobs = {}
        self.gate = asyncio.Semaphore(1)

    async def close(self):
        for task in self.jobs.values():
            task.cancel()
        await asyncio.gather(*self.jobs.values(), return_exceptions=True)
        await self.hass.async_add_executor_job(shutil.rmtree, self.cache)

    async def response(self, source, sensor, flip):
        if sensor not in {'auto', 'front', 'corner'} or flip not in {'recorded', 'normal', 'flipped'}:
            raise web.HTTPBadRequest(text='Invalid radar options')
        stat = await self.hass.async_add_executor_job(source.stat)
        if stat.st_size > 256 * 1024**2:
            raise web.HTTPRequestEntityTooLarge(max_size=256 * 1024**2, actual_size=stat.st_size)
        key = hashlib.sha256(f'{source}\0{stat.st_size}\0{stat.st_mtime_ns}\0{sensor}\0{flip}'.encode()).hexdigest()
        output = self.cache / (key + '.json.gz')
        if await self.hass.async_add_executor_job(output.is_file):
            return web.FileResponse(output, headers={'Content-Type':'application/json', 'Content-Encoding':'gzip', 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer'})
        task = self.jobs.get(key)
        if task and task.done():
            self.jobs.pop(key)
            if task.cancelled() or task.exception():
                return web.json_response({'status':'error','message':'원본 레이더 재계산 실패. HA 로그의 engine error_type을 확인해 주세요.'}, status=422)
        if task is None:
            for old, job in list(self.jobs.items()):
                if job.done():
                    if not job.cancelled(): job.exception()
                    self.jobs.pop(old)
            if len(self.jobs) >= 4:
                return web.json_response({'status':'busy'}, status=503, headers={'Retry-After':'5'})
            self.jobs[key] = self.hass.async_create_background_task(self.prepare(source, output, sensor, flip), 'carrot replay V2')
        return web.json_response({'status':'preparing'}, status=202, headers={'Retry-After':'2','Cache-Control':'no-store'})

    async def prepare(self, source, output, sensor, flip):
        async with self.gate:
            engine = await self.hass.async_add_executor_job(engine_root)
            temporary = output.with_suffix('.partial')
            environment = {**os.environ, 'PYTHONDONTWRITEBYTECODE':'1', 'OPENBLAS_NUM_THREADS':'1',
                           'PYTHONPATH':os.pathsep.join(map(str, sys.path))}
            process = None
            try:
                process = await asyncio.create_subprocess_exec(sys.executable, str(ROOT / 'radar_runner.py'),
                    str(engine), str(source), str(temporary), sensor, flip,
                    env=environment, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
                _, stderr = await asyncio.wait_for(process.communicate(), 300)
                if process.returncode:
                    # Runner reports only exception class and source frame locations.
                    safe = stderr.decode(errors='replace').splitlines()[-1:] or ['engine_process_failed']
                    _LOGGER.warning('Replay V2 engine failed code=%s diagnostic=%s', process.returncode, safe[0][:1000])
                    raise RuntimeError('Original radar engine failed')
                await self.hass.async_add_executor_job(self.publish, temporary, output)
            finally:
                if process is not None and process.returncode is None:
                    process.kill()
                    await process.wait()
                await self.hass.async_add_executor_job(temporary.unlink, True)

    def publish(self, temporary, output):
        data = json.loads(temporary.read_text())
        if data.get('schemaVersion') != 1 or not data.get('frames') or data.get('engine') != 'production-dpath-controller':
            raise ValueError('Invalid production radar output')
        pending = output.with_suffix('.publishing')
        with gzip.open(pending, 'wb') as stream:
            stream.write(temporary.read_bytes())
        if pending.stat().st_size > CACHE_LIMIT:
            pending.unlink()
            raise ValueError('Radar output exceeds cache limit')
        pending.replace(output)
        total = 0
        for path in sorted(self.cache.glob('*.json.gz'), key=lambda path:path.stat().st_mtime, reverse=True):
            total += path.stat().st_size
            if total > CACHE_LIMIT and path != output:
                path.unlink()


def manifest(store, entry, name, base):
    item = store.segment_info(name)
    if not item.get('complete'):
        raise KeyError(name)
    route, index = name.rsplit('--', 1)
    files = [{'name':filename,'size':size,'sizeLabel':f'{size:,} B', 'url':base+'/file/'+filename}
             for filename,size in item['files'].items()]
    size = sum(item['files'].values())
    return {'route':route, 'deviceId':entry.data['device_id'], 'segmentCount':1,
            'firstSegment':int(index),'lastSegment':int(index),'totalSize':size,'totalSizeLabel':f'{size/1024**2:.1f} MB',
            'segments':[{'name':name,'index':int(index),'files':files,
                         'videoUrl':base+'/file/'+next(f for f in ('qcamera.mp4','qcamera.ts') if f in item['files']), 'previewUrl':''}]}

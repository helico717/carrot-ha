"""Entry-scoped HA jobs using the original Carrot server upload protocol."""
import asyncio
from datetime import datetime
import threading
import time
import uuid

from .store import segment_name
from . import upstream_upload as protocol
from .upstream_upload_report import upload_share_text


class UploadManager:
    def __init__(self, hass, runtime, store, base_url=protocol.DEFAULT_WEB_UPLOAD_URL):
        self.hass, self.runtime, self.store = hass, runtime, store
        self.base_url = base_url
        self.jobs = {}
        store.on_retire = self.retire

    def retire(self, routes):
        # Called by the storage executor: do not pin files against retention.
        for job in list(self.jobs.values()):
            if job['status'] == 'running' and any(n.rsplit('--', 1)[0] in routes for n in job['segments']):
                job['_cancel'].set()

    def files(self, name, include_all=False):
        item = self.store.state['segments'][segment_name(name)]
        if not item['complete']:
            raise ValueError('Segment is incomplete')
        names = list(item['files']) if include_all else [
            next(n for n in choices if n in item['files'])
            for choices in [('qcamera.ts', 'qcamera.mp4'), ('rlog.zst', 'rlog.bz2', 'rlog')]
        ]
        return [{'kind': n.split('.')[0], 'name': n, 'size': item['files'][n],
                 'sizeLabel': f"{item['files'][n]:,} B"} for n in names]

    def summary(self, segments, include_all):
        summaries = []
        for name in segments:
            files = self.files(name, include_all)
            size = sum(f['size'] for f in files)
            summaries.append({'segment': name, 'route': name.rsplit('--', 1)[0],
                              'segmentIndex': int(name.rsplit('--', 1)[1]), 'files': files,
                              'totalSize': size, 'totalSizeLabel': f'{size:,} B'})
        return {'ok': True, 'summaries': summaries}

    def snapshot(self, job):
        return {key: value for key, value in job.items() if not key.startswith('_') and key != 'segments'}

    def update(self, job, **values):
        job.update(values, updated_at=time.time(), revision=job['revision'] + 1)

    def start(self, segments, include_all):
        if any(job['status'] == 'running' for job in self.jobs.values()):
            raise ValueError('Upload already running')
        summaries = self.summary(segments, include_all)['summaries']
        job = {'id': uuid.uuid4().hex, 'action': 'upload', 'status': 'running', 'done': False,
               'phase': 'queued', 'revision': 0, 'progress': 0, 'message': 'Waiting to upload',
               'step_current': 0, 'step_total': len(segments), 'bytes_current': 0,
               'bytes_total': sum(s['totalSize'] for s in summaries), 'bytes_per_second': 0,
               'includeAllFiles': include_all, 'segments': segments, 'created_at': time.time(),
               'cancel_requested': False, 'log': '', '_cancel': threading.Event()}
        self.jobs[job['id']] = job
        job['_task'] = self.hass.async_create_background_task(self.run(job, summaries), 'carrot log upload')
        finished = [key for key, item in self.jobs.items() if item['done']]
        for key in finished[:-12]:
            del self.jobs[key]
        return {'ok': True, 'job_id': job['id'], 'status': job['status']}

    def cancel(self, key):
        job = self.jobs[key]
        if not job['done']:
            job['_cancel'].set()
            self.update(job, cancel_requested=True, phase='canceling')
        return self.snapshot(job)

    async def close(self):
        tasks = [job['_task'] for job in self.jobs.values() if not job['done']]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def run(self, job, summaries):
        entry = self.runtime['entry']
        data = (self.runtime.get('latest') or {}).get('data') or {}
        metadata = {'deviceId': entry.data['device_id'], 'carName': data.get('car_name') or 'none',
                    'branch': data.get('comma_git_branch') or 'unknown',
                    'commit': data.get('comma_git_commit') or 'unknown', 'serial': 'unknown'}
        results = []
        total_bytes = job['bytes_total']
        logical = {}
        started = time.monotonic()
        storage_directory = f"{metadata['carName']} {metadata['deviceId']}"
        remote_base = f'{self.base_url}/routes/{storage_directory}/'
        result = {'ok': False, 'uploaded': 0, 'total': len(summaries), 'results': results,
                  'target': 'carrot', 'meta': metadata, 'deviceId': metadata['deviceId'],
                  'remoteBasePath': remote_base, 'discord': {'configured': False, 'skipped': True}}

        def check_cancel():
            if job['_cancel'].is_set():
                raise RuntimeError('Upload canceled')

        try:
            self.update(job, phase='preparing', message='Preparing upload')
            check_cancel()
            token = await protocol.create_web_upload_session(self.base_url, metadata, 'dashcam')
            for index, summary in enumerate(summaries):
                check_cancel()
                name = summary['segment']

                def progress(filename, sent, size, delta):
                    key = (name, filename)
                    logical[key] = max(logical.get(key, 0), min(sent, size))
                    transferred = sum(logical.values())
                    self.update(job, phase='uploading', message=f'Uploading {index + 1}/{len(summaries)}',
                                bytes_current=transferred, bytes_per_second=int(transferred / max(.001, time.monotonic() - started)),
                                progress=min(97, 8 + round(89 * transferred / max(1, total_bytes))))

                try:
                    await protocol.upload_folder_to_web(str(self.store.root / name), metadata['deviceId'], name,
                        self.base_url, token, job['_cancel'].is_set,
                        filenames=[f['name'] for f in summary['files']], on_progress=progress)
                    item = {**summary, 'ok': True, 'remotePath': remote_base + name}
                except Exception as error:
                    check_cancel()
                    item = {**summary, 'ok': False, 'error': str(error), 'remotePath': remote_base + name}
                results.append(item)
                self.update(job, step_current=index + 1)
            check_cancel()
            result.update(ok=all(item['ok'] for item in results), uploaded=sum(item['ok'] for item in results),
                          uploadedAt=datetime.now().astimezone().isoformat())
            result['shareText'] = upload_share_text(result)
            self.update(job, phase='notifying', progress=98, message='Sending completion notice')
            result['webComplete'] = await protocol.send_web_upload_complete(self.base_url, token, result)
            check_cancel()
            self.update(job, result=result, status='done' if result['ok'] else 'failed', done=True,
                        phase='complete' if result['ok'] else 'failed', progress=100 if result['ok'] else job['progress'])
        except (Exception, asyncio.CancelledError) as error:
            canceled = job['_cancel'].is_set() or isinstance(error, asyncio.CancelledError)
            result.update(canceled=canceled, error=str(error) or 'Upload canceled', uploaded=sum(item['ok'] for item in results))
            self.update(job, status='canceled' if canceled else 'failed', done=True,
                        phase='canceled' if canceled else 'failed', result=result, error=result['error'])


def request_segments(body):
    if not isinstance(body, dict) or type(body.get('includeAllFiles', False)) is not bool:
        raise ValueError('Invalid upload request')
    names = body.get('segments', [body.get('segment')])
    if not isinstance(names, list) or not 0 < len(names) <= 2000:
        raise ValueError('Select between 1 and 2000 segments')
    return list(dict.fromkeys(segment_name(name) for name in names)), body.get('includeAllFiles', False)

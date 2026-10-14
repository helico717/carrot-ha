"""Exercise the actual standalone receiver, including durable recovery and isolation."""
import asyncio
from datetime import datetime, timezone, timedelta
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from aiohttp.test_utils import TestClient, TestServer

spec = importlib.util.spec_from_file_location('receiver', Path('addons/carrot_receiver/receiver.py'))
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


class ReceiverTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / 'receiver.sqlite3'
        self.store = receiver.Store(self.path)
        self.config = {'devices': [
            {'device_id': 'car', 'upload_token': 'u' * 32, 'view_token': 'v' * 32},
            {'device_id': 'other', 'upload_token': 'x' * 32, 'view_token': 'y' * 32}]}
        self.client = TestClient(TestServer(receiver.create_app(self.config, self.store)))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        self.directory.cleanup()

    async def request(self, path, body=None, token=None, method=None):
        token = token or ('u' * 32 if body is not None else 'v' * 32)
        response = await self.client.request(method or ('POST' if body is not None else 'GET'), path,
                                             json=body, headers={'Authorization': 'Bearer ' + token})
        return response.status, await response.json()

    def telemetry(self, at='2026-10-14T10:00:00Z'):
        return {'deviceId': 'car', 'updatedAt': at, 'gps': {}, 'onroad': 0,
                'vehicle': {'soc_percent': 50, 'charge_sessions': [], 'charge_months': {}}}

    def trip(self, distance=1000):
        return {'deviceId': 'car', 'id': 'same-trip', 'startedAt': '2026-10-14T10:00:00Z',
                'endedAt': '2026-10-14T10:10:00Z', 'durationS': 600, 'distanceM': distance,
                'route': [{'latitude': 37, 'longitude': 127, 'speedMps': 12}], 'partial': False,
                'distanceSource': 'can_speed', 'distanceQuality': {'complete': True, 'estimated': False},
                'tripMeasurements': {'start': {'at': '2026-10-14T10:00:00Z', 'battery_wh': 50000},
                                     'end': {'at': '2026-10-14T10:10:00Z', 'battery_wh': 49000}, 'complete': True}}

    async def test_auth_and_device_scoping(self):
        self.assertEqual((await self.request('/api/telemetry', self.telemetry(), token='v' * 32))[0], 401)
        self.assertEqual((await self.request('/api/latest-state?device_id=other'))[0], 403)
        self.assertEqual((await self.request('/api/telemetry', {**self.telemetry(), 'deviceId': 'other'}))[0], 403)
        self.assertEqual((await self.request('/api/latest-state?device_id=car', token='bad'))[0], 401)

    async def test_retry_latest_priority_and_backup_restore(self):
        newer = self.telemetry()
        older = self.telemetry('2026-10-13T10:00:00Z')
        for body in (newer, older, newer):
            self.assertEqual((await self.request('/api/telemetry', body))[0], 200)
        page = (await self.request('/api/telemetry-history?device_id=car&after=0'))[1]
        self.assertEqual(len(page['events']), 2)
        self.assertEqual(json.loads(page['events'][0]['raw_json']), newer)
        self.assertEqual((await self.request('/api/latest-state?device_id=car'))[1]['state']['updated_at'], newer['updatedAt'])
        backup = Path(self.directory.name) / 'backup.sqlite3'
        await asyncio.to_thread(self.store.backup, backup)
        restored = receiver.Store(backup)
        self.assertEqual(restored.identity, self.store.identity)
        self.assertEqual(restored.history('telemetry', 'car', 0, 100), page)
        self.assertEqual(restored.latest('car'), self.store.latest('car'))

    async def test_mutable_trip_revisions_and_quality_preserved(self):
        for body in (self.trip(), self.trip()):
            self.assertEqual((await self.request('/api/trips', body))[1], {'ok': True, 'id': 'same-trip'})
        page = (await self.request('/api/trip-changes?device_id=car&after=0'))[1]
        self.assertEqual(len(page['trips']), 1)
        first = page['next_cursor']
        change = self.trip(1100)
        change.pop('tripMeasurements')
        await self.request('/api/trips', change)
        page = (await self.request('/api/trip-changes?device_id=car&after=' + str(first)))[1]
        self.assertGreater(page['next_cursor'], first)
        trip = page['trips'][0]
        self.assertEqual(trip['distance_m'], 1100)
        self.assertEqual(trip['trip_measurements'], self.trip()['tripMeasurements'])
        self.assertEqual(trip['distance_quality'], self.trip()['distanceQuality'])
        self.assertEqual(trip['max_speed_mps'], 12)

    async def test_capacity_failure_never_acknowledged_and_other_lane_survives(self):
        self.store.max_bytes = 1
        status, reply = await self.request('/api/telemetry', self.telemetry())
        self.assertEqual(status, 503)
        self.assertTrue(reply['retryable'])
        self.assertEqual(self.store.history('telemetry', 'car', 0, 100)['events'], [])
        self.store.max_bytes = 1073741824
        self.assertEqual((await self.request('/api/trips', self.trip()))[0], 200)

    async def test_retention_requires_durable_ack_and_expiry(self):
        body = self.telemetry((datetime.now(timezone.utc) - timedelta(days=20)).isoformat())
        await self.request('/api/telemetry', body)
        self.assertEqual(self.store.maintenance(), 0)
        seq = self.store.history('telemetry', 'car', 0, 100)['events'][0]['sequence']
        self.assertEqual((await self.request('/api/archive-ack', {'device_id': 'car', 'telemetry_sequence': seq + 1,
                                                               'trip_sequence': 0}, token='v' * 32))[0], 400)
        self.assertEqual((await self.request('/api/archive-ack', {'device_id': 'car', 'telemetry_sequence': seq,
                                                               'trip_sequence': 0}, token='v' * 32))[0], 200)
        self.assertEqual(self.store.maintenance(), 1)
        self.assertIsNotNone(self.store.latest('car')['state'])

    async def test_parameter_validation_namespace_ack_and_restored_queue(self):
        settings = {'device_id': 'car', 'catalog': {'params': [{'name': 'Test', 'min': 0, 'max': 5}]},
                    'values': {'Test': 1}}
        await self.request('/api/settings/sync', settings)
        self.assertEqual((await self.request('/api/params/queue', {'device_id': 'car', 'param_name': 'Test',
                                                                 'param_value': 6}, token='v' * 32))[0], 400)
        queued = (await self.request('/api/params/queue', {'device_id': 'car', 'param_name': 'Test',
                                                        'param_value': 3}, token='v' * 32))[1]
        pending = (await self.request('/api/params/pending?device_id=car', token='u' * 32))[1]
        self.assertEqual(pending['poll_after_s'], 3)
        self.assertEqual(pending['pending'][0]['id'], queued['ids'][0])
        ack = {'device_id': 'car', 'applied_ids': queued['ids'], 'failed_ids': []}
        self.assertEqual((await self.request('/api/params/ack', ack))[0], 400)
        ack['queue_namespace'] = pending['queue_namespace']
        self.assertEqual((await self.request('/api/params/ack', ack))[0], 200)
        self.assertEqual((await self.request('/api/params/ack', ack))[0], 200)
        self.assertEqual((await self.request('/api/params/status?device_id=car'))[1]['queue'][0]['status'], 'applied')
        at = (await self.request('/api/settings?device_id=car'))[1]['updated_at']
        self.assertTrue((await self.request('/api/settings?device_id=car&known=' + at.replace('+', '%2B')))[1]['unchanged'])

    async def test_discovery_permission_expiry_and_revocation(self):
        path = '/api/terminal/bootstrap?device_id=car'
        config = {'ha_url': 'https://ha.example', 'terminal_token': 't' * 32}
        self.assertEqual((await self.request(path, config, token='v' * 32))[0], 401)
        self.assertEqual((await self.request(path, config))[0], 200)
        found = (await self.request(path, token='u' * 32))[1]
        self.assertEqual(found['config']['terminal_token'], 't' * 32)
        await self.request(path, {'enabled': False})
        self.assertIsNone((await self.request(path, token='u' * 32))[1]['config'])

    async def test_panda_delta_and_gps_fallback_preserved(self):
        first = self.telemetry()
        first['panda'] = {'uptimeS': 100, 'rxBufferOverflow': 5, 'txBufferOverflow': 0, 'spiErrorCount': 0}
        first['gps'] = {'latitude': 37, 'longitude': 127}
        await self.request('/api/telemetry', first)
        second = self.telemetry('2026-10-14T10:00:30Z')
        second['panda'] = {**first['panda'], 'uptimeS': 130, 'rxBufferOverflow': 6}
        await self.request('/api/telemetry', second)
        raw = self.store.latest('car')['state']['raw_json']
        self.assertTrue(raw['panda']['counterHealth']['shouldAlert'])
        self.assertEqual(raw['panda']['counterHealth']['deltaSincePreviousSample']['rxBufferOverflow'], 1)
        self.assertEqual(raw['gps']['source'], 'lastKnown')
        self.assertFalse(raw['gps']['fresh'])
        await self.request('/api/telemetry', second)
        self.assertEqual(self.store.latest('car')['state']['raw_json'], raw)


if __name__ == '__main__':
    unittest.main()

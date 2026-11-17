"""Synthetic underground visits: long parking, loss of GPS and unsafe continuity."""
import asyncio
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import json
import sqlite3
import sys
import types
import unittest
from unittest.mock import patch

pkg = types.ModuleType('custom_components.carrot_ha')
pkg.__path__ = ['custom_components/carrot_ha']
sys.modules.setdefault('custom_components', types.ModuleType('custom_components'))
sys.modules.setdefault('custom_components.carrot_ha', pkg)
from custom_components.carrot_ha.vehicle_journal import favorite_visit as visit
from custom_components.carrot_ha.vehicle_journal import automatic_locations as auto
from custom_components.carrot_ha.archive_codec import pack


class Archive:
    def __init__(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('CREATE TABLE events(device,kind,observed,body)')
        self.db.execute('CREATE INDEX events_device_kind_observed ON events(device,kind,observed DESC)')

    @contextmanager
    def connect(self):
        yield self.db


class VisitTests(unittest.TestCase):
    def setUp(self):
        self.archive = Archive()
        self.journal = types.SimpleNamespace(device='car', vehicle='ev')
        self.start = datetime(2026, 1, 2, tzinfo=timezone.utc)
        self.favorites = [{'location': {'name': '합성 충전소', 'address': '합성 주소', 'station_id': 'test'},
                           'anchors': [{'latitude': 37.5, 'longitude': 127.0}]}]

    def tearDown(self):
        self.archive.db.close()

    def state(self, second, measured=-180, onroad=False, device='car', **changes):
        gps = {'latitude': 37.5, 'longitude': 127.0, 'accuracyM': 7,
               'speedMps': 1.65, 'fresh': True,
               'measured_at': (self.start + timedelta(seconds=measured)).isoformat()}
        gps.update(changes.pop('gps', {}))
        data = {'gps': gps, 'onroad': onroad, **changes}
        event = {'schema': 1, 'device_id': device, 'event_id': str(second), 'kind': 'state',
                 'observed_at': (self.start + timedelta(seconds=second)).isoformat(), 'data': data}
        self.archive.db.execute('INSERT INTO events VALUES (?,?,?,?)',
                                (device, 'state', event['observed_at'], pack(json.dumps(event))))

    def parked(self, age=180):
        self.state(-age, measured=-age, onroad=True)
        for second in range(-age + 60, 1, 60):
            self.state(second, measured=-age)

    def result(self):
        return visit.parking_favorite(self.archive, self.journal, self.start.isoformat(), self.favorites)

    def test_moving_entrance_fix_then_parked_charge(self):
        self.parked()
        favorite, point = self.result()
        self.assertEqual(favorite, self.favorites[0])
        self.assertEqual(point['basis'], 'charge_start_continuous_parking_favorite')
        self.assertEqual(point['gps_measured_at'], (self.start - timedelta(seconds=180)).isoformat())
        self.assertIsNone(auto.position(self.archive, self.journal, self.start.isoformat()),
                          'the existing general-purpose GPS rule stays strict')

    def test_hours_and_overnight_have_no_gps_age_cutoff(self):
        for age in (3600 * 4, 3600 * 30):
            with self.subTest(age=age):
                self.archive.db.execute('DELETE FROM events')
                self.parked(age)
                self.assertIsNotNone(self.result())

    def test_gap_unknown_state_and_new_drive_rejected(self):
        for action in ('gap', 'unknown', 'drive', 'wheel', 'negative_wheel'):
            with self.subTest(action=action):
                self.archive.db.execute('DELETE FROM events')
                self.parked(600)
                at = (self.start - timedelta(seconds=120)).isoformat()
                if action == 'gap':
                    self.archive.db.execute('DELETE FROM events WHERE observed=?', (at,))
                else:
                    self.archive.db.execute('DELETE FROM events WHERE observed=?', (at,))
                    if action in ('unknown', 'drive'):
                        self.state(-120, -600, onroad=None if action == 'unknown' else True)
                    else:
                        self.state(-120, -600, vehicle={'wheel_speed_mps': 2 if action == 'wheel' else -1})
                self.assertIsNone(self.result())

    def test_new_normal_fix_elsewhere_invalidates_old_favorite(self):
        self.parked(600)
        self.state(-10, -10, gps={'latitude': 37.51, 'speedMps': 0})
        self.assertIsNone(self.result())

    def test_new_moving_fix_while_parked_is_rejected(self):
        self.parked(600)
        self.state(-10, -10)
        self.assertIsNone(self.result())

    def test_competing_favorites_rejected_even_with_different_distances(self):
        self.parked()
        self.favorites.append({'location': {'name': '다른 충전소'},
                               'anchors': [{'latitude': 37.5004, 'longitude': 127.0}]})
        self.assertIsNone(self.result())

    def test_far_and_unlearned_favorites_rejected(self):
        self.parked()
        self.favorites[0]['anchors'][0]['latitude'] = 37.51
        self.assertIsNone(self.result())
        self.favorites[0]['anchors'] = []
        self.assertIsNone(self.result())

    def test_no_original_fix_or_start_coverage_rejected(self):
        self.state(-60, -3600)
        self.state(0, -3600)
        self.assertIsNone(self.result())
        self.archive.db.execute('DELETE FROM events')
        self.state(-300, -300, onroad=True)
        self.state(-240, -300)
        self.assertIsNone(self.result())

    def test_charging_record_without_any_observed_parking_is_not_enough(self):
        for second in (-180, -120, -60, 0):
            self.state(second, -180, onroad=True)
        self.assertIsNone(self.result())

    def test_other_device_cannot_bridge_missing_coverage(self):
        self.state(-180, -180, onroad=True)
        self.state(-120, -180)
        self.state(-60, -180, device='other')
        self.state(0, -180)
        self.assertIsNone(self.result())

    def test_inaccurate_original_and_future_time_rejected(self):
        for gps in ({'accuracyM': 80}, {'fresh': False}, {'measured_at': (self.start + timedelta(hours=1)).isoformat()}):
            with self.subTest(gps=gps):
                self.archive.db.execute('DELETE FROM events')
                for second in (-180, -120, -60, 0):
                    self.state(second, -180, onroad=second != -180, gps=gps)
                self.assertIsNone(self.result())

    def test_work_budget_never_accepts_truncated_visit(self):
        self.parked(600)
        with patch.object(visit, 'MAX_SAMPLES', 3):
            self.assertIsNone(self.result())

    def test_compressed_archive_supported(self):
        self.state(-180, -180, onroad=True, padding='x' * 6000)
        self.state(-120, -180)
        self.state(-60, -180)
        self.state(0, -180)
        self.assertIsNotNone(self.result())

    def test_enrich_selects_favorite_without_provider_requests(self):
        self.parked(3600)
        self.journal.favorites = lambda: self.favorites
        manager = types.SimpleNamespace(automatic_locations=True, kakao_rest_key='test',
                                        entries=lambda: [{'vehicle_id': 'ev', 'fuel': 'electric'}],
                                        stations=types.SimpleNamespace())
        hass = types.SimpleNamespace(async_add_executor_job=lambda f, *a: asyncio.sleep(0, f(*a)))
        item = ('charge', 1, {}, self.start.isoformat())
        with patch.object(auto, 'pending', return_value=[item]), patch.object(auto, 'save', return_value=True) as save, patch.object(auto, 'propagate'):
            asyncio.run(auto.enrich(hass, manager, self.archive, self.journal))
        args = save.call_args.args
        self.assertEqual(args[3]['selection_source'], 'favorite')
        self.assertEqual(args[7]['code'], 'favorite_selected')
        self.assertEqual(args[7]['evidence']['basis'], 'charge_start_continuous_parking_favorite')
        self.assertIn('parked_since', args[7]['evidence'])
        self.assertEqual(args[4], '주차 위치를 바탕으로 즐겨찾는 충전소를 추정했어요.')


if __name__ == '__main__':
    unittest.main()

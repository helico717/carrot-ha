"""Permanent openpilot assist statistics in HA (docs/OPENPILOT_ASSIST_STATS_PLAN_2026-11-05.md).

Trips go through the real receiver output (0.1.5) and the real HA feed parser
before reaching the archive, as in production.
"""
import importlib
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

sys.path.insert(0, str(Path('addons/carrot_receiver').resolve()))
_spec = importlib.util.spec_from_file_location('receiver_for_assist', Path('addons/carrot_receiver/receiver.py'))
receiver = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(receiver)
_package = types.ModuleType('_assist_ha_test')
_package.__path__ = [str(Path('custom_components/carrot_ha').resolve())]
sys.modules[_package.__name__] = _package
feed = importlib.import_module(_package.__name__ + '.cloud_feed')
storage = importlib.import_module(_package.__name__ + '.storage')
assist_stats = importlib.import_module(_package.__name__ + '.assist_stats')

NOW = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)

try:  # Windows Python may lack tzdata; Asia/Seoul is a fixed UTC+9 zone without DST.
    assist_stats.ZoneInfo('Asia/Seoul')
except Exception:
    from datetime import timedelta
    assist_stats.ZoneInfo = lambda name: timezone(timedelta(hours=9)) if name == 'Asia/Seoul' else timezone.utc


def assist(both=8000.0, manual=2000.0, unknown=0.0, buckets=None, streaks=None):
    basis = both + manual + unknown
    buckets = buckets or [('2026-11-01T01:00:00+00:00', both, manual, unknown)]
    streaks = streaks if streaks is not None else [('2026-11-01T01:00:00+00:00', '2026-11-01T01:10:00+00:00', both)]
    return {'version': 1, 'basisDistanceM': basis, 'manualM': manual, 'latOnlyM': 0.0, 'longOnlyM': 0.0,
            'bothM': both, 'unknownM': unknown, 'knownDurationS': 600, 'assistDurationS': 480,
            'enabled': {'onM': both, 'offM': manual, 'unknownM': unknown},
            'engagements': 1, 'disengagements': 1,
            'longestStreakM': max([s[2] for s in streaks] or [0.0]), 'longestStreakS': 480,
            'streakCount': len(streaks),
            'streaks': [{'startAt': a, 'endAt': b, 'distanceM': d, 'brokenByGap': False} for a, b, d in streaks],
            'buckets': [{'at': at, 'manualM': m, 'latOnlyM': 0.0, 'longOnlyM': 0.0, 'bothM': b, 'unknownM': u}
                        for at, b, m, u in buckets]}


class AssistStatsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.archive = storage.Archive(Path(self.tmp.name) / 'ha.sqlite3', 'Asia/Seoul')
        self.sequence = 0

    def trip(self, trip_id, value, distance=None, start='2026-11-01T01:00:00Z', end='2026-11-01T01:10:00Z'):
        body = {'deviceId': 'car', 'id': trip_id, 'startedAt': start, 'endedAt': end, 'durationS': 600,
                'distanceM': distance if distance is not None else (value or {}).get('basisDistanceM', 1000),
                'route': [], 'partial': False, 'distanceSource': 'can_speed',
                'distanceQuality': {'complete': True, 'estimated': False}}
        if value is not None:
            body['assist'] = value
        return body

    def put(self, *bodies):
        """Receiver output -> HA feed parser -> archive, one page."""
        rows = []
        for body in bodies:
            self.sequence += 1
            rows.append(receiver.Store.trip({'raw': receiver.packed(body), 'device': 'car', 'sequence': self.sequence}))
        for event in feed.parse_feed({'trips': rows}, 'car'):
            self.archive.put_cloud(event)

    def summary(self, **kwargs):
        return self.archive.assist_summary('car', now=NOW, ttl=0, **kwargs)

    def test_ratio_excludes_unknown_and_recovery_difference(self):
        self.put(self.trip('up', assist(), distance=12000))
        total = self.summary()['total']
        self.assertEqual(total['ratio'], 0.8)
        self.assertEqual(total['recovery_added_m'], 2000)
        self.assertEqual(total['unknown_m'], 2000)
        self.put(self.trip('down', assist(), distance=9000, start='2026-11-02T01:00:00Z', end='2026-11-02T01:10:00Z'))
        total = self.summary()['total']
        self.assertEqual(total['ratio'], 0.8)
        self.assertEqual(total['recovery_shortfall_m'], 1000)
        self.assertEqual(total['unknown_m'], 2000)

    def test_no_known_distance_reports_no_ratio(self):
        self.put(self.trip('blind', assist(both=0.0, manual=0.0, unknown=5000.0, streaks=[])))
        self.assertIsNone(self.summary()['total']['ratio'])
        self.assertFalse(self.summary()['days'][0]['active'])

    def test_statistics_survive_trip_and_state_retention(self):
        self.put(self.trip('old', assist()))
        before = self.summary()
        self.archive.purge_expired(state_days=0, trip_days=0, charge_days=0, slim_trip_days=0)
        with self.archive.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM events WHERE kind='trip'").fetchone()[0], 0)
        self.assertEqual(self.summary(), before)
        self.assertEqual(before['total']['assist_m'], 8000)

    def test_first_valid_value_survives_resends_and_page_retries(self):
        self.put(self.trip('t', assist()))
        self.put(self.trip('t', None))                                     # older body without assist
        self.put(self.trip('t', assist()))                                 # identical retry
        changed = self.trip('t', assist(both=5000.0, manual=5000.0))
        self.put(changed)                                                  # different value: kept first
        self.put(changed)                                                  # same conflict again
        s = self.summary()
        self.assertEqual((s['total']['assist_m'], s['total']['manual_m']), (8000, 2000))
        self.assertEqual(s['measured_trips'], 1)
        self.assertEqual(s['conflicts'], 1)

    def test_interrupted_page_keeps_cursor_semantics_and_counts_each_trip_once(self):
        first = self.trip('a', assist())
        second = self.trip('b', assist(), start='2026-11-02T01:00:00Z', end='2026-11-02T01:10:00Z')
        original = assist_stats.store_trip
        def failing(db, device, trip_id, data, now=None):
            if data.get('ended_at', '').startswith('2026-11-02'):
                raise OSError('disk full')
            return original(db, device, trip_id, data, now)
        with mock.patch.object(storage.assist_stats, 'store_trip', failing):
            with self.assertRaises(OSError):
                self.put(first, second)  # the sync helper would not advance its cursor
        with self.archive.connect() as db:   # the failed trip rolled back together with its summary
            self.assertEqual(db.execute("SELECT COUNT(*) FROM events WHERE kind='trip'").fetchone()[0], 1)
        self.sequence = 0
        self.put(first, second)                # the same page is received again
        s = self.summary()
        self.assertEqual(s['measured_trips'], 2)
        self.assertEqual(s['total']['assist_m'], 16000)

    def test_local_midnight_and_month_end_split_and_streak_start_day(self):
        value = assist(buckets=[('2026-10-31T14:45:00+00:00', 3000.0, 0.0, 0.0),
                                ('2026-10-31T15:00:00+00:00', 5000.0, 2000.0, 0.0)],
                       streaks=[('2026-10-31T14:50:00+00:00', '2026-10-31T15:10:00+00:00', 8000.0)])
        self.put(self.trip('night', value, start='2026-10-31T14:45:00Z', end='2026-10-31T15:15:00Z'))
        s = self.summary()
        days = {d['date']: d['assist_m'] for d in s['days']}
        self.assertEqual(days, {'2026-10-31': 3000, '2026-11-01': 5000})   # KST 23:45 / 00:00
        months = {m['month']: m['assist_m'] for m in s['months']}
        self.assertEqual(months, {'2026-10': 3000, '2026-11': 5000})
        self.assertEqual(self.summary(period='month', date='2026-10-15')['longest_streak']['distance_m'], 8000)
        self.assertIsNone(self.summary(period='month', date='2026-11-15')['longest_streak'])
        self.assertEqual(self.summary(period='day', date='2026-11-01')['total']['assist_m'], 5000)

    def test_used_day_needs_one_kilometre_and_streak_days(self):
        days = [('2026-11-01', 1000.0), ('2026-11-02', 900.0), ('2026-11-03', 1000.0), ('2026-11-04', 1500.0),
                ('2026-11-05', 1000.0)]
        for index, (day, both) in enumerate(days):
            self.put(self.trip('d%d' % index, assist(both=both, manual=0.0, buckets=[(day + 'T01:00:00+00:00', both, 0.0, 0.0)]),
                               start=day + 'T01:00:00Z', end=day + 'T01:10:00Z'))
        s = self.summary()
        self.assertEqual([d['active'] for d in s['days']], [True, False, True, True, True])
        self.assertEqual((s['active_days'], s['current_streak_days'], s['best_streak_days']), (4, 3, 3))

    def test_unmeasured_trips_after_start_are_unknown_and_earlier_ones_ignored(self):
        self.put(self.trip('before', None, distance=5000, start='2026-10-01T01:00:00Z', end='2026-10-01T01:10:00Z'))
        self.assertFalse(self.summary()['measured'])
        self.put(self.trip('first', assist()))
        self.put(self.trip('after', None, distance=3000, start='2026-11-02T01:00:00Z', end='2026-11-02T01:10:00Z'))
        s = self.summary()
        self.assertEqual(s['trips'], 2)
        self.assertEqual(s['total']['unmeasured_trip_m'], 3000)
        self.assertEqual(s['total']['unknown_m'], 3000)
        self.assertEqual(s['total']['ratio'], 0.8)

    def test_backfill_restores_assist_archived_before_this_version(self):
        self.put(self.trip('legacy', assist()))
        with self.archive.connect() as db:
            for table in ('assist_trips', 'assist_buckets', 'assist_streaks'):
                db.execute('DELETE FROM ' + table)
        self.archive._assist_changed()
        self.assertFalse(self.summary()['measured'])
        self.assertEqual(self.archive.assist_backfill('car'), 1)
        self.assertEqual(self.summary()['total']['assist_m'], 8000)
        self.assertEqual(self.archive.assist_backfill('car'), 0)

    def test_unrecorded_distance_estimate_uses_odometer_anchor(self):
        def state(at, km):
            data = {'odometer_km': km, 'field_measured_at': {'odometer_km': at}}
            event = feed.envelope('car', 'state', at, at, data)
            self.archive.put_cloud(event)
        state('2026-11-01T00:50:00+00:00', 1000)
        self.put(self.trip('a', assist()))                      # 10 km recorded
        state('2026-11-03T00:00:00+00:00', 1013)                 # 13 km driven by odometer
        self.assertEqual(self.summary()['unrecorded_estimate_m'], 3000)

    def test_invalid_assist_from_receiver_is_not_measured(self):
        broken = assist(); broken['bothM'] = 1.0
        self.put(self.trip('bad', broken))
        self.assertFalse(self.summary()['measured'])

    def test_summary_is_cached_until_a_trip_changes_it(self):
        self.put(self.trip('a', assist()))
        first = self.archive.assist_summary('car', now=NOW)
        self.assertIs(self.archive.assist_summary('car', now=NOW), first)
        self.put(self.trip('b', assist(), start='2026-11-02T01:00:00Z', end='2026-11-02T01:10:00Z'))
        self.assertEqual(self.archive.assist_summary('car', now=NOW)['measured_trips'], 2)


if __name__ == '__main__':
    unittest.main()

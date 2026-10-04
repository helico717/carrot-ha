"""Payment durability, isolation, stable merging and accounting boundaries."""
import importlib
import json
import sqlite3
import sys
import tempfile
import types
import unittest
from datetime import datetime, timedelta, timezone

if 'custom_components.carrot_ha' not in sys.modules:
    pkg = types.ModuleType('custom_components.carrot_ha')
    pkg.__path__ = ['custom_components/carrot_ha']
    sys.modules['custom_components.carrot_ha'] = pkg
Archive = importlib.import_module('custom_components.carrot_ha.storage').Archive
PaymentConflict = importlib.import_module('custom_components.carrot_ha.charge_costs').PaymentConflict


class ChargePaymentsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = self.directory.name + '/archive.sqlite3'
        self.archive = Archive(self.path)

    def tearDown(self):
        self.directory.cleanup()

    def charge(self, key='a', start='2026-01-01T00:00:00Z', device='car', energy=10, duration=3600, **extra):
        data = dict(started_at=start, ended_at=(datetime.fromisoformat(start.replace('Z', '+00:00'))+timedelta(seconds=duration)).isoformat(),
                    duration_s=duration, energy_kwh=energy, **extra)
        event = dict(schema=1, device_id=device, event_id=key, kind='charge', observed_at=data['ended_at'], data=data)
        (self.archive.put_cloud if key.startswith('cloud-') else self.archive.put)(event)
        return event

    def write(self, data, amount, version=None, device='car'):
        return self.archive.set_charge_payment(device, data['payment_id'], data['source_event_ids'],
            data['payment_version'] if version is None else version, amount)

    def data(self, device='car'):
        return self.archive.charge_history(device)[0]['data']

    def test_create_modify_zero_delete_and_raw_preservation(self):
        event = self.charge()
        data = self.data()
        self.assertEqual(data['estimated_cost_krw'], 2800)
        self.write(data, 0)
        self.assertEqual(self.data()['effective_cost_krw'], 0)
        self.assertEqual(self.data()['cost_source'], 'actual')
        self.write(self.data(), 1900)
        self.assertEqual(self.data()['effective_cost_krw'], 1900)
        self.write(self.data(), None)
        self.assertEqual(self.data()['effective_cost_krw'], 2800)
        self.assertEqual(self.archive.history('car', 'charge')[0], event)

    def test_group_payment_scope_does_not_absorb_later_charges_even_after_delete(self):
        self.charge('a')
        self.charge('b', start='2026-01-01T01:10:00Z')
        data = self.data()
        self.assertEqual(set(data['source_event_ids']), {'a', 'b'})
        self.write(data, 4500)
        self.charge('c', start='2026-01-01T02:15:00Z')
        self.assertEqual(len(self.archive.charge_history('car')), 2)
        totals = self.archive.charge_totals('car', '2026-01')
        self.assertEqual(totals['effective_cost_krw'], 7300)
        self.assertEqual(totals['cost_source'], 'mixed')
        frozen = next(e['data'] for e in self.archive.charge_history('car') if e['data']['actual_cost_krw'] is not None)
        self.write(frozen, None)
        self.assertEqual(len(self.archive.charge_history('car')), 2)
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 8400)

    def test_retention_restart_resync_and_backfill(self):
        event = self.charge('cloud-a')
        self.write(self.data(), 1234)
        self.charge('other', start='2025-01-01T00:00:00Z')
        self.archive.purge_expired()
        self.assertEqual(self.archive.history('car', 'charge'), [])
        self.archive = Archive(self.path)
        self.assertEqual(len(self.archive.charge_history('car')), 2)
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 1234)
        self.archive.put_cloud(event)
        self.assertEqual(len(self.archive.charge_history('car')), 2)
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 1234)
        # Simulate upgrade from a DB containing raw charges but no summaries.
        with self.archive.connect() as db:
            db.execute('DELETE FROM charge_summaries WHERE id=?', ('cloud-a',))
        self.archive = Archive(self.path)
        self.assertEqual(self.data()['actual_cost_krw'], 1234)

    def test_conflict_isolation_and_amount_validation(self):
        self.charge()
        self.charge(device='other')
        data = self.data()
        for amount in (-1, 1.5, True, '100', 1000000000):
            with self.assertRaises(ValueError):
                self.write(data, amount)
        with self.assertRaises(PaymentConflict):
            self.write(data, 100, device='other')
        self.write(data, 100)
        with self.assertRaises(PaymentConflict):
            self.write(data, 200)
        with self.assertRaises(PaymentConflict):
            self.archive.set_charge_payment('car', data['payment_id'], ['missing'], 1, 200)
        self.assertEqual(self.data()['actual_cost_krw'], 100)
        self.assertIsNone(self.data('other')['actual_cost_krw'])

    def test_timezone_day_month_year_and_week_boundaries(self):
        self.charge('newyear', start='2025-12-31T15:01:00Z')
        data = self.data()
        self.assertEqual(data['accounting_date'], '2026-01-01')
        self.assertEqual(data['accounting_timezone'], 'Asia/Seoul')
        self.write(data, 1000)
        self.assertEqual(self.archive.charge_totals('car', '2025-12')['effective_cost_krw'], 0)
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 1000)
        self.charge('sunday', start='2026-01-04T14:00:00Z')
        self.charge('monday', start='2026-01-04T16:00:00Z')
        rows = self.archive.charge_history('car')
        days = {e['data']['accounting_date'] for e in rows}
        self.assertTrue({'2026-01-04', '2026-01-05'}.issubset(days))
        self.assertEqual(len({datetime.fromisoformat(day).isocalendar().week for day in days}), 2)

    def test_snapshot_updates_and_totals_cache_invalidation(self):
        self.charge('cloud-a')
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 2800)
        self.charge('cloud-a', energy=20)
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 6400)
        data = self.data()
        self.write(data, 100)
        self.charge('cloud-a', energy=22)
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 100)

    def test_stale_unpaid_group_rejected_after_new_member(self):
        self.charge('a')
        data = self.data()
        self.charge('b', start='2026-01-01T01:05:00Z')
        with self.assertRaises(PaymentConflict):
            self.write(data, 100)

    def test_stored_cost_and_rate_and_fast_fallback(self):
        self.charge('a', energy=20, cost_krw=1234, unit_price_krw=400)
        self.assertEqual(self.data()['estimated_cost_krw'], 1234)
        self.charge('b', start='2026-01-02T00:00:00Z', energy=20)
        self.assertEqual(self.data()['estimated_cost_krw'], 6400)

    def test_reversible_exclusion_preserves_payment_raw_and_survives_resync(self):
        original = self.charge('cloud-a', energy=0.15, duration=120)
        data = self.data()
        self.write(data, 50)
        data = self.data()
        self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], data['payment_version'], True)
        self.assertEqual(self.archive.charge_history('car'), [])
        totals = self.archive.charge_totals('car', '2026-01')
        self.assertEqual(totals['effective_cost_krw'], 0)
        self.assertEqual(totals['excluded_slow_kwh'], 0.15)
        self.assertEqual(totals['excluded_estimated_cost_krw'], 42)
        self.assertEqual(totals['count'], 0)
        self.assertEqual(self.archive.history('car', 'charge')[0], original)
        self.archive = Archive(self.path)
        self.archive.put_cloud(original)
        self.assertEqual(self.archive.charge_history('car'), [])
        data = self.archive.charge_history('car', include_excluded=True)[0]['data']
        self.assertTrue(data['excluded'])
        self.assertEqual(data['actual_cost_krw'], 50)
        with self.assertRaises(PaymentConflict):
            self.archive.set_charge_excluded('other', data['payment_id'], data['source_event_ids'], data['payment_version'], False)
        with self.assertRaises(PaymentConflict):
            self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], 0, False)
        with self.assertRaises(ValueError):
            self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], data['payment_version'], 1)
        self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], data['payment_version'], False)
        self.assertFalse(self.data()['excluded'])
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['effective_cost_krw'], 50)

    def test_excluded_group_does_not_absorb_neighbor_and_merged_scope_is_atomic(self):
        self.charge('a')
        self.charge('b', start='2026-01-01T01:10:00Z')
        data = self.data()
        self.assertEqual(len(data['source_event_ids']), 2)
        self.archive.set_charge_excluded('car', data['payment_id'], data['source_event_ids'], 0, True)
        self.charge('c', start='2026-01-01T02:15:00Z')
        self.assertEqual(len(self.archive.charge_history('car')), 1)
        self.assertEqual(self.data()['source_event_ids'], ['c'])
        self.assertEqual(len(self.archive.charge_history('car', include_excluded=True)), 2)
        self.assertEqual(self.archive.charge_totals('car', '2026-01')['excluded_slow_kwh'], 20)

    def test_can_mode_controls_tariff_and_keeps_distinct_sessions(self):
        self.charge('a', energy=22, duration=3600, source='can_request', can_mode=4)
        self.assertEqual(self.data()['estimated_cost_krw'], 6160)
        self.charge('b', start='2026-01-01T01:05:00Z', energy=1, duration=3600,
                    source='can_request', can_mode=6, confirmed_duration_s=3300,
                    unknown_duration_s=300, gap_corrected=True, corrected_energy_kwh=0.2,
                    signal_gaps=[{'started_at':'2026-01-01T01:10:00Z','ended_at':'2026-01-01T01:15:00Z'}])
        records=self.archive.charge_history('car')
        self.assertEqual(len(records),2)
        dc=next(e['data'] for e in records if e['data']['can_mode']==6)
        self.assertEqual(dc['estimated_cost_krw'],320)
        self.assertEqual(dc['unknown_duration_s'],300)
        self.assertEqual(dc['corrected_energy_kwh'],0.2)
        self.assertEqual(len(dc['signal_gaps']),1)

if __name__ == '__main__':
    unittest.main()

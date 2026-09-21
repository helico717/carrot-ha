import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('param_sync', Path(__file__).parents[1] / 'collector/param_sync.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

class ParamSyncTest(unittest.TestCase):
    def test_no_write_for_removed_or_out_of_range(self):
        catalog = {'ok': True, 'settings': {'items_by_group': {'test': [{'name': 'Test', 'min': 0, 'max': 10}]}}}
        for name, value in [('Removed', 1), ('Test', 11), ('Test', float('nan'))]:
            with patch.object(sync, '_http_request', return_value=catalog) as http:
                self.assertIsNone(sync.apply_local_param(name, value))
                self.assertEqual(http.call_count, 1)

    def test_ack_uses_readback(self):
        responses = [
            {'ok': True, 'settings': {'items_by_group': {'test': [{'name': 'Test', 'min': 0, 'max': 10}]}}},
            {'ok': True}, {'ok': True, 'values': {'Test': 3}},
        ]
        with patch.object(sync, '_http_request', side_effect=responses):
            self.assertEqual(sync.apply_local_param('Test', 3.2), {'value': 3})

    def test_no_direct_params_fallback(self):
        with patch.object(sync, '_http_request', return_value=None) as http:
            self.assertIsNone(sync.apply_local_param('Test', 1))
            self.assertEqual(http.call_count, 1)

    def test_idempotent_store_skips_duplicate_write(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.sqlite3') as tmp:
            store = sync.ProcessedQueueStore(tmp.name)
            self.assertIsNone(store.get(101))
            store.record(101, 'dev1', 'ParamA', 5, 5, 'applied')
            item = store.get(101)
            self.assertIsNotNone(item)
            self.assertEqual(item['param_name'], 'ParamA')
            self.assertEqual(item['actual_val'], '5')
            self.assertFalse(item['acked'])

            # Test mark_acked
            store.mark_acked([101])
            self.assertTrue(store.get(101)['acked'])

    def test_requeued_id_resends_ack_without_local_apply(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.sqlite3') as tmp:
            store = sync.ProcessedQueueStore(tmp.name)
            store.record(202, 'test-dev', 'SpeedLimit', 60, 60, 'applied')

            # Mock pending response returning the same id 202
            pending_res = {'ok': True, 'pending': [{'id': 202, 'param_name': 'SpeedLimit', 'param_value': 60}]}
            ack_calls = []

            def mock_http(url, data=None, headers=None, timeout=10.0, verbose=True):
                if '/api/params/pending' in url:
                    return pending_res
                if '/api/params/ack' in url:
                    ack_calls.append(data)
                    return {'ok': True}
                return None

            with patch.object(sync, 'apply_local_param') as mock_apply, \
                 patch.object(sync, '_http_request', side_effect=mock_http), \
                 patch('time.sleep', side_effect=InterruptedError):
                try:
                    sync.run_param_sync({'url': 'https://cloud.test', 'token': 'tok', 'device': 'test-dev'}, store=store)
                except InterruptedError:
                    pass

                # apply_local_param must NOT be called for already applied queue_id 202!
                mock_apply.assert_not_called()
                # But ACK must still be sent with recorded actual value
                self.assertEqual(len(ack_calls), 1)
                self.assertEqual(ack_calls[0]['applied_ids'], [202])
                self.assertEqual(ack_calls[0]['current_values'], {'SpeedLimit': 60})
                self.assertTrue(store.get(202)['acked'])


if __name__ == '__main__':
    unittest.main()

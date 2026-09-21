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

if __name__ == '__main__':
    unittest.main()

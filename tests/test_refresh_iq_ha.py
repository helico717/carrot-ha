"""Offline parts of the iq-ha upstream refresh: IQ.OS gate and builder file selection."""
import importlib.util
from pathlib import Path
import sys
import unittest

SCRIPTS = Path(__file__).parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('refresh_iq_ha', SCRIPTS / 'refresh_iq_ha.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


class RefreshTests(unittest.TestCase):
    def test_reads_required_os_version(self):
        text = 'case x in\n  *)\n      export AGNOS_VERSION="IQ.OS 4.9.9.4"\n      ;;\nesac\n'
        self.assertEqual(refresh.agnos_version(text), 'IQ.OS 4.9.9.4')
        with self.assertRaises(refresh.NeedsReview):
            refresh.agnos_version('export OTHER=1\n')

    def test_selects_only_public_files_outside_linked_directories(self):
        self.assertTrue(refresh.materialized('iqpilot/selfdrive/ui/ui.py'))
        self.assertTrue(refresh.materialized('launch_env.sh'))
        self.assertFalse(refresh.materialized('iqpilot/system/camerad/camerad'))
        self.assertTrue(refresh.linked_directory('artifacts/package_runtime/iqdbc/car/uds.py'))
        self.assertFalse(refresh.linked_directory('iqpilot/selfdrive/carrot/ha/collector.py'))


if __name__ == '__main__':
    unittest.main()

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).parents[1] / 'tools/receiver-recovery.py')
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryTests(unittest.TestCase):
    def test_credentials_only_travel_in_stdin_and_no_source_copy(self):
        token = 'private-upload-' + 'x' * 32
        with patch.object(recovery.subprocess, 'run') as run:
            recovery.configure('192.168.1.10', '~/key', 'https://ha.example/carrot-receiver', 'existing', token)
        args, kwargs = run.call_args
        self.assertNotIn(token, str(args))
        self.assertIn(token, kwargs['input'])
        self.assertEqual(args[0][0], 'ssh')
        self.assertIn('direct_connection', args[0][-1])
        self.assertNotIn('scp', args[0][-1])

    def test_unsafe_destinations_never_start_ssh(self):
        with patch.object(recovery.subprocess, 'run') as run:
            for host, url in [('host; touch bad', 'https://ha.example'),
                              ('-oProxyCommand=bad', 'https://ha.example'),
                              ('host', 'http://ha.example'), ('host', 'https://user:pass@ha.example'),
                              ('host', 'https://ha.example/wrong')]:
                with self.assertRaises(ValueError):
                    recovery.configure(host, '~/key', url, 'existing', 'x' * 32)
            run.assert_not_called()

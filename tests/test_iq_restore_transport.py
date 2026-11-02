import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('iq_restore_transport',Path(__file__).parents[1]/'tools/iq-ha-restore.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class TransportTests(unittest.TestCase):
    def test_direct_iq_ssh_and_secret_stdin_only(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'receiver.json').write_text(json.dumps({'token':'private-upload'}))
            (root/'camera.json').write_text(json.dumps({'camera_token':'private-camera'}))
            with patch.object(module.subprocess,'run') as run:
                module.restore('192.168.0.237','~/key',root)
            args,kwargs=run.call_args
            self.assertIn('iq@192.168.0.237',args[0])
            self.assertNotIn('private-',str(args))
            self.assertIn('private-upload',kwargs['input'])
            self.assertIn('iq_restore',args[0][-1])
            self.assertNotIn('scp',str(args))

    def test_invalid_host_never_connects(self):
        with patch.object(module.subprocess,'run') as run:
            with self.assertRaises(ValueError):module.restore('host;bad','key','none')
            run.assert_not_called()

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('kit', Path(__file__).parents[1] / 'scripts/prepare_iq_ha_recovery.py')
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)

class KitTests(unittest.TestCase):
    def test_allowlist_permissions_identity_and_digest(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = root / 'backup.tar'
            with tarfile.open(archive, 'w') as t:
                for name, value in [(kit.FILES['receiver.json'][0], {'transport':'direct','url':'https://example.test','device':'car','token':'x'*32}), (kit.FILES['camera.json'][0], {'ha_url':'https://example.test','device_id':'car','camera_token':'y'*32}), ('backup/data/params/d/Unsafe', {'do':'not restore'})]:
                    data = json.dumps(value).encode(); m = tarfile.TarInfo(name); m.size=len(data);t.addfile(m,io.BytesIO(data))
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            with self.assertRaises(ValueError):kit.prepare(archive,root/'bad', '0'*64)
            self.assertFalse((root/'bad').exists())
            kit.prepare(archive,root/'kit',digest)
            self.assertEqual({p.name for p in (root/'kit').iterdir()}, {'receiver.json','camera.json','README.txt'})
            self.assertEqual((root/'kit/receiver.json').stat().st_mode & 0o777,0o600)
            with self.assertRaises(FileExistsError):kit.prepare(archive,root/'kit',digest)

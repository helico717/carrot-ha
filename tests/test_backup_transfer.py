"""Synthetic transport tests; no HA credentials or vehicle access."""
import base64
import hashlib
import importlib.util
import io
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('transfer', Path(__file__).parents[1] / 'scripts/download_comma_backup.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)


class TransferTests(unittest.TestCase):
    def test_producer_to_receiver_fragmented_terminal_stream(self):
        data = bytes(range(256)) * 61
        filename = 'carrot-20261102T021704563634Z.tar.gz'
        marker = 'CBtest'
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / filename
            source.write_bytes(data)
            args = shlex.split(transfer.command(filename, marker))
            args[2] = args[2].replace('/data/carrot-backups/' + filename, str(source))
            output = subprocess.check_output(args).replace(b'\n', b'\r\n')
        stream = io.BytesIO()
        receiver = transfer.Receiver(stream, marker, hashlib.sha256(data).hexdigest())
        receiver.feed(b'command echo and shell prompt\r\n')
        for position in range(0, len(output), 127):
            receiver.feed(output[position:position + 127])
        self.assertTrue(receiver.done)
        self.assertEqual(stream.getvalue(), data)

    def test_hash_mismatch_never_completes(self):
        receiver = transfer.Receiver(io.BytesIO(), 'CBtest', '0' * 64)
        with self.assertRaises(RuntimeError):
            receiver.feed(b'CBtest BEGIN 1\nCBtest DATA 0 YQ==\nCBtest END\n')
        self.assertFalse(receiver.done)

    def test_missing_chunk_rejected(self):
        receiver = transfer.Receiver(io.BytesIO(), 'CBtest', '0' * 64)
        with self.assertRaises(RuntimeError):
            receiver.feed(b'CBtest BEGIN 1\nCBtest DATA 1 YQ==\n')

    def test_paths_and_shell_injection_rejected(self):
        for name in ['../../secret', 'carrot-1.tar.gz;id', 'carrot-$(id).tar.gz']:
            with self.assertRaises(ValueError):
                transfer.command(name, 'CBtest')


if __name__ == '__main__':
    unittest.main()

import importlib.util
from pathlib import Path
import unittest
import tempfile
import sys
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "network_probe", Path(__file__).parents[1] / "scripts/camera_network_preflight.py")
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class NetworkProbeTests(unittest.TestCase):
    def test_bundled_import_paths_added_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "pydeps").mkdir()
            with patch.object(sys, "path", []):
                probe.configure_comma_imports(root)
                probe.configure_comma_imports(root)
                self.assertEqual(sys.path, [str(root), str(root / "pydeps")])

    def test_missing_comma_paths_not_added(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(sys, "path", []):
            probe.configure_comma_imports(Path(tmp) / "absent")
            self.assertEqual(sys.path, [])

    def test_https_origin_maps_to_ha_websocket(self):
        self.assertEqual(probe.websocket_url("https://example.duckdns.org:8123/"),
                         "wss://example.duckdns.org:8123/api/websocket")

    def test_ipv6_origin(self):
        self.assertEqual(probe.websocket_url("https://[::1]:8123"), "wss://[::1]:8123/api/websocket")

    def test_no_insecure_url_credentials_or_dashboard_path(self):
        for url in ("http://example.com", "https://user:secret@example.com",
                    "https://example.com?token=secret", "https://example.com/#token",
                    "https://example.com/lovelace", "https://example.com:0",
                    "https://example.com:bad", "https://example.com\nx", ""):
            with self.subTest(url=url), self.assertRaises(ValueError):
                probe.websocket_url(url)


if __name__ == "__main__":
    unittest.main()

"""HA adapter contract tests for snapshot-dedicated CarrotImageSnapshot."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).parents[1] / 'custom_components/carrot_ha'
package = types.ModuleType('image_entity_test_package')
package.__path__ = [str(ROOT)]


class FakeImageEntity:
    def __init__(self, hass):
        self.hass = hass
    @property
    def enabled(self):
        return True
    def async_write_ha_state(self):
        pass


modules = {
    'image_entity_test_package': package,
    'image_entity_test_package.entity_migration': types.SimpleNamespace(comma_device_info=lambda _: {}),
    'homeassistant': types.ModuleType('homeassistant'),
    'homeassistant.components': types.ModuleType('homeassistant.components'),
    'homeassistant.components.image': types.SimpleNamespace(ImageEntity=FakeImageEntity),
    'homeassistant.exceptions': types.SimpleNamespace(HomeAssistantError=RuntimeError),
    'homeassistant.helpers': types.ModuleType('homeassistant.helpers'),
    'homeassistant.helpers.dispatcher': types.SimpleNamespace(async_dispatcher_connect=Mock()),
}
spec = importlib.util.spec_from_file_location(package.__name__ + '.image', ROOT / 'image.py')
image_mod = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, modules):
    spec.loader.exec_module(image_mod)


class ImageEntityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.snapshot_dir = Path(self.temp_dir.name)
        self.relay = Mock(ready=True)
        self.entry = types.SimpleNamespace(data={'device_id': 'test'}, entry_id='entry')
        self.hass = Mock()
        self.hass.async_add_executor_job = AsyncMock(side_effect=lambda f, *args: f(*args) if callable(f) else None)
        self.entity = image_mod.CarrotImageSnapshot(
            self.hass, self.entry, self.relay, 'wide', b'placeholder', self.snapshot_dir
        )
        self.entity.entity_id = 'image.wide'

    def tearDown(self):
        self.temp_dir.cleanup()

    async def test_image_returns_placeholder_when_file_missing(self):
        img = await self.entity.async_image()
        self.assertEqual(img, b'placeholder')
        self.assertEqual(self.entity._attr_content_type, 'image/png')
        self.assertIsNone(self.entity.image_last_updated)

    async def test_image_returns_cached_snapshot_when_file_exists(self):
        snapshot_file = self.snapshot_dir / "test_wide.jpg"
        snapshot_file.write_bytes(b'jpeg_data')
        self.hass.async_add_executor_job = AsyncMock(return_value=b'jpeg_data')
        img = await self.entity.async_image()
        self.assertEqual(img, b'jpeg_data')
        self.assertEqual(self.entity._attr_content_type, 'image/jpeg')
        self.assertIsNotNone(self.entity.image_last_updated)

    async def test_extra_state_attributes(self):
        attrs = self.entity.extra_state_attributes
        self.assertEqual(attrs['viewing_mode'], 'snapshot_only')
        self.assertEqual(attrs['live_stream_type'], 'wss_webcodecs')
        self.assertEqual(attrs['live_ws_url'], '/api/carrot_ha/v1/camera/test/live')

    async def test_setup_entry_creates_all_three_images(self):
        hass = Mock(
            data={'carrot_ha': {'entry': {'camera_relay': self.relay}}},
            config=Mock(path=lambda *p: Path(self.temp_dir.name, *p[2:]))
        )
        hass.async_add_executor_job = AsyncMock(return_value=b'placeholder')
        added = []
        await image_mod.async_setup_entry(hass, self.entry, added.extend)
        self.assertEqual(len(added), 3)
        self.assertEqual([e.camera for e in added], ['wide', 'road', 'driver'])
        self.assertEqual([e._attr_name for e in added], ['광각 스냅샷', '망원 스냅샷', '실내 스냅샷'])


if __name__ == '__main__':
    unittest.main()

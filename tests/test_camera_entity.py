"""HA adapter contract tests for snapshot-dedicated CarrotCamera."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).parents[1] / 'custom_components/carrot_ha'
package = types.ModuleType('camera_entity_test_package')
package.__path__ = [str(ROOT)]


class FakeCamera:
    def __init__(self):
        self.stream = None
    @property
    def enabled(self):
        return True
    def async_write_ha_state(self):
        pass


modules = {
    'camera_entity_test_package': package,
    'camera_entity_test_package.entity_migration': types.SimpleNamespace(comma_device_info=lambda _: {}),
    'homeassistant': types.ModuleType('homeassistant'),
    'homeassistant.components': types.ModuleType('homeassistant.components'),
    'homeassistant.components.camera': types.SimpleNamespace(Camera=FakeCamera,
        CameraEntityFeature=types.SimpleNamespace(ON_OFF=1)),
    'homeassistant.exceptions': types.SimpleNamespace(HomeAssistantError=RuntimeError),
    'homeassistant.helpers': types.ModuleType('homeassistant.helpers'),
    'homeassistant.helpers.dispatcher': types.SimpleNamespace(async_dispatcher_connect=Mock()),
}
spec = importlib.util.spec_from_file_location(package.__name__ + '.camera', ROOT / 'camera.py')
camera = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, modules):
    spec.loader.exec_module(camera)


class EntityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.snapshot_dir = Path(self.temp_dir.name)
        self.relay = Mock(ready=True, session=Mock(readers=[], last_reason=None), stop_camera=AsyncMock())
        self.entry = types.SimpleNamespace(data={'device_id': 'test'}, entry_id='entry')
        self.entity = camera.CarrotCamera(self.entry, self.relay, 'wide', b'placeholder', self.snapshot_dir)
        self.entity.hass = Mock()
        self.entity.hass.async_add_executor_job = AsyncMock(side_effect=lambda f, *args: f(*args) if callable(f) else None)
        self.entity.entity_id = 'camera.wide'

    def tearDown(self):
        self.temp_dir.cleanup()

    async def test_thumbnail_returns_placeholder_when_snapshot_missing(self):
        img = await self.entity.async_camera_image()
        self.assertEqual(img, b'placeholder')
        self.assertEqual(self.entity.content_type, 'image/png')

    async def test_thumbnail_returns_cached_snapshot_when_file_exists(self):
        snapshot_file = self.snapshot_dir / "test_wide.jpg"
        snapshot_file.write_bytes(b'jpeg_data')
        self.entity.hass.async_add_executor_job = AsyncMock(return_value=b'jpeg_data')
        img = await self.entity.async_camera_image()
        self.assertEqual(img, b'jpeg_data')
        self.assertEqual(self.entity.content_type, 'image/jpeg')

    async def test_extra_state_attributes(self):
        attrs = self.entity.extra_state_attributes
        self.assertEqual(attrs['viewing_mode'], 'snapshot_only')
        self.assertEqual(attrs['live_stream_type'], 'wss_webcodecs')
        self.assertEqual(attrs['live_ws_url'], '/api/carrot_ha/v1/camera/test/live')

    async def test_turn_off_releases_camera(self):
        await self.entity.async_turn_off()
        self.assertFalse(self.entity.is_on)
        self.relay.stop_camera.assert_awaited_once_with('wide')

    async def test_setup_entry_creates_all_three_cameras(self):
        hass = Mock(
            data={'carrot_ha': {'entry': {'camera_relay': self.relay}}},
            config=Mock(path=lambda *p: Path(self.temp_dir.name, *p[2:]))
        )
        hass.async_add_executor_job = AsyncMock(return_value=b'placeholder')
        added = []
        await camera.async_setup_entry(hass, self.entry, added.extend)
        self.assertEqual(len(added), 3)
        self.assertEqual([e.camera for e in added], ['wide', 'road', 'driver'])
        self.assertEqual([e._attr_name for e in added], ['광각 카메라', '망원 카메라', '실내 카메라'])


if __name__ == '__main__':
    unittest.main()

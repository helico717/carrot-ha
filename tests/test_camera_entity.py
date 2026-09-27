"""HA adapter contract tests; transport/remux tests separately use real libraries."""
import importlib.util
from pathlib import Path
import sys
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


prefs = AsyncMock()
create_stream = Mock()
modules = {
    'camera_entity_test_package': package,
    'camera_entity_test_package.entity_migration': types.SimpleNamespace(comma_device_info=lambda _: {}),
    'homeassistant': types.ModuleType('homeassistant'),
    'homeassistant.components': types.ModuleType('homeassistant.components'),
    'homeassistant.components.camera': types.SimpleNamespace(Camera=FakeCamera,
        CameraEntityFeature=types.SimpleNamespace(STREAM=2, ON_OFF=1)),
    'homeassistant.components.camera.prefs': types.SimpleNamespace(
        DynamicStreamSettings=lambda **kwargs: types.SimpleNamespace(**kwargs), get_dynamic_camera_stream_settings=prefs),
    'homeassistant.components.stream': types.SimpleNamespace(create_stream=create_stream),
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
        prefs.reset_mock()
        prefs.return_value = types.SimpleNamespace(preload_stream=False, orientation=0)
        create_stream.reset_mock()
        self.stream = Mock(stop=AsyncMock())
        create_stream.return_value = self.stream
        self.relay = Mock(ready=True, source=Mock(return_value='http://127.0.0.1/test/wide.ts'),
                          source_valid=Mock(return_value=True), stop_camera=AsyncMock())
        self.entry = types.SimpleNamespace(data={'device_id': 'test'}, entry_id='entry')
        self.entity = camera.CarrotCamera(self.entry, self.relay, 'wide', b'placeholder')
        self.entity.hass, self.entity.entity_id = Mock(), 'camera.wide'

    async def test_thumbnail_never_requests_stream(self):
        self.assertEqual(await self.entity.async_camera_image(), b'placeholder')
        self.relay.source.assert_not_called()
        create_stream.assert_not_called()

    async def test_preload_rejected_without_creating_stream(self):
        prefs.return_value.preload_stream = True
        with self.assertRaises(RuntimeError):
            await self.entity.async_create_stream()
        create_stream.assert_not_called()

    async def test_live_request_creates_hls_and_reuses_valid_source(self):
        first = await self.entity.async_create_stream()
        second = await self.entity.async_create_stream()
        self.assertIs(first, second)
        create_stream.assert_called_once()
        self.assertFalse(create_stream.call_args.kwargs['dynamic_stream_settings'].preload_stream)

    async def test_expired_source_gets_new_stream(self):
        await self.entity.async_create_stream()
        self.relay.source_valid.return_value = False
        await self.entity.async_create_stream()
        self.stream.stop.assert_awaited_once()
        self.assertEqual(create_stream.call_count, 2)

    async def test_turn_off_releases_vehicle_consumer(self):
        await self.entity.async_create_stream()
        await self.entity.async_turn_off()
        self.relay.stop_camera.assert_awaited_once_with('wide')
        self.stream.stop.assert_awaited_once()
        self.assertIsNone(await self.entity.stream_source())


if __name__ == '__main__':
    unittest.main()

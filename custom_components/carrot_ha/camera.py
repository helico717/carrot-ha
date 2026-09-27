"""On-demand, offroad wide/driver cameras using HA's HTTPS HLS player."""
import asyncio
from pathlib import Path

from homeassistant.components.camera import Camera, CameraEntityFeature
from homeassistant.components.camera.prefs import DynamicStreamSettings, get_dynamic_camera_stream_settings
from homeassistant.components.stream import create_stream
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .entity_migration import comma_device_info


async def async_setup_entry(hass, entry, async_add_entities):
    relay = hass.data['carrot_ha'][entry.entry_id].get('camera_relay')
    if relay is None:
        return
    placeholder = await hass.async_add_executor_job(
        (Path(__file__).parent / 'frontend' / 'camera_idle.png').read_bytes)
    async_add_entities([CarrotCamera(entry, relay, name, placeholder) for name in ('wide', 'driver')])


class CarrotCamera(Camera):
    _attr_should_poll = False
    _attr_has_entity_name = True
    _attr_supported_features = CameraEntityFeature.STREAM | CameraEntityFeature.ON_OFF

    def __init__(self, entry, relay, camera, placeholder):
        super().__init__()
        self.entry, self.relay, self.camera = entry, relay, camera
        self.placeholder = placeholder
        self.enabled = True
        self._source = None
        self._lock = asyncio.Lock()
        self._attr_unique_id = f'{entry.data["device_id"]}_camera_{camera}'
        self._attr_name = '광각 카메라' if camera == 'wide' else '실내 카메라'
        self._attr_device_info = comma_device_info(entry)
        self.content_type = 'image/png'

    @property
    def available(self):
        return self.relay.ready

    @property
    def is_on(self):
        return self.enabled

    @property
    def is_streaming(self):
        return any(r.camera == self.camera for r in self.relay.session.readers)

    @property
    def use_stream_for_stills(self):
        return False

    @property
    def extra_state_attributes(self):
        return {'viewing_mode': 'offroad_only', 'session_limit_seconds': 300,
                'last_stop_reason': self.relay.session.last_reason,
                'preview': 'placeholder', 'transport': 'https_hls'}

    async def async_camera_image(self, width=None, height=None):
        # HA thumbnails and snapshot services never wake the vehicle.
        return self.placeholder

    async def async_refresh_providers(self, *, write_state=True):
        # This source is loopback-only and must not be handed to external
        # go2rtc/WebRTC providers. Advertise the native HLS path only.
        if write_state:
            self.async_write_ha_state()

    async def stream_source(self):
        if not self.enabled or not self.relay.ready:
            return None
        return self.relay.source(self.camera)

    async def async_create_stream(self):
        async with self._lock:
            prefs = await get_dynamic_camera_stream_settings(self.hass, self.entity_id)
            if prefs.preload_stream:
                raise HomeAssistantError('Disable Preload stream for Carrot cameras; continuous preloading is unsupported')
            if not self.enabled or not self.relay.ready:
                raise HomeAssistantError('Camera device must be connected and offroad')
            if self.stream and self.relay.source_valid(self._source):
                return self.stream
            if self.stream:
                await self.stream.stop()
                self.stream = None
            self._source = await self.stream_source()
            self.stream = create_stream(
                self.hass, self._source, options={},
                dynamic_stream_settings=DynamicStreamSettings(preload_stream=False, orientation=prefs.orientation),
                stream_label=self.entity_id,
            )
            self.stream.set_update_callback(self.async_write_ha_state)
            return self.stream

    async def async_turn_off(self):
        self.enabled = False
        await self.relay.stop_camera(self.camera)
        if self.stream:
            await self.stream.stop()
            self.stream = None
        self.async_write_ha_state()

    async def async_turn_on(self):
        self.enabled = True
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(async_dispatcher_connect(
            self.hass, 'carrot_camera_' + self.entry.entry_id, self.async_write_ha_state))

    async def async_will_remove_from_hass(self):
        await self.async_turn_off()
        await super().async_will_remove_from_hass()

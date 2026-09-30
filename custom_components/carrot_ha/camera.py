"""Snapshot-dedicated offroad cameras with low-latency WSS live 360 viewer link."""
from datetime import datetime, timezone
import os
from pathlib import Path

from homeassistant.components.camera import Camera, CameraEntityFeature
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .entity_migration import comma_device_info


async def async_setup_entry(hass, entry, async_add_entities):
    relay = hass.data['carrot_ha'][entry.entry_id].get('camera_relay')
    if relay is None:
        return
    placeholder = await hass.async_add_executor_job(
        (Path(__file__).parent / 'frontend' / 'camera_idle.png').read_bytes)
    snapshot_dir = Path(hass.config.path('.storage', 'carrot_ha', 'snapshots'))
    await hass.async_add_executor_job(snapshot_dir.mkdir, 0o755, True, True)
    async_add_entities([CarrotCamera(entry, relay, name, placeholder, snapshot_dir) for name in ('wide', 'road', 'driver')])


class CarrotCamera(Camera):
    _attr_should_poll = False
    _attr_has_entity_name = True
    _attr_supported_features = CameraEntityFeature.ON_OFF

    CAMERA_NAMES = {
        'wide': '광각 카메라',
        'road': '망원 카메라',
        'driver': '실내 카메라',
    }

    def __init__(self, entry, relay, camera, placeholder, snapshot_dir):
        super().__init__()
        self.entry, self.relay, self.camera = entry, relay, camera
        self.placeholder = placeholder
        self.snapshot_dir = snapshot_dir
        self.snapshot_file = snapshot_dir / f"{entry.data['device_id']}_{camera}.jpg"
        self._is_on = True
        self._attr_unique_id = f'{entry.data["device_id"]}_camera_{camera}'
        self._attr_name = self.CAMERA_NAMES.get(camera, camera)
        self._attr_device_info = comma_device_info(entry)
        self.content_type = 'image/png'

    @property
    def available(self):
        return self.relay.ready

    @property
    def is_on(self):
        return self._is_on

    @property
    def is_streaming(self):
        return any(r.camera in (self.camera, 'all') for r in self.relay.session.readers)

    @property
    def use_stream_for_stills(self):
        return False

    @property
    def extra_state_attributes(self):
        last_mtime = None
        if self.snapshot_file.is_file():
            try:
                mtime = os.path.getmtime(self.snapshot_file)
                last_mtime = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
            except OSError:
                pass
        device_id = self.entry.data.get('device_id', '')
        return {
            'viewing_mode': 'snapshot_only',
            'live_stream_type': 'wss_webcodecs',
            'live_ws_url': f'/api/carrot_ha/v1/camera/{device_id}/live',
            'last_snapshot_at': last_mtime,
            'session_limit_seconds': 300,
            'last_stop_reason': self.relay.session.last_reason,
        }

    async def async_camera_image(self, width=None, height=None):
        """Returns the latest cached snapshot without waking the vehicle."""
        if self._is_on and self.snapshot_file.is_file():
            try:
                data = await self.hass.async_add_executor_job(self.snapshot_file.read_bytes)
                if data:
                    self.content_type = 'image/jpeg'
                    return data
            except OSError:
                pass
        self.content_type = 'image/png'
        return self.placeholder

    async def async_turn_off(self):
        self._is_on = False
        await self.relay.stop_camera(self.camera)
        self.async_write_ha_state()

    async def async_turn_on(self):
        self._is_on = True
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(async_dispatcher_connect(
            self.hass, 'carrot_camera_' + self.entry.entry_id, self.async_write_ha_state))

    async def async_will_remove_from_hass(self):
        await self.async_turn_off()
        await super().async_will_remove_from_hass()

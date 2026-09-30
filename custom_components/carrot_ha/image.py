"""Snapshot-dedicated offroad image entities for parked vehicle views."""
from __future__ import annotations
from datetime import datetime, timezone
import os
from pathlib import Path

from homeassistant.components.image import ImageEntity
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .entity_migration import comma_device_info


async def async_setup_entry(hass, entry, async_add_entities):
    relay = hass.data['carrot_ha'][entry.entry_id].get('camera_relay')
    placeholder = await hass.async_add_executor_job(
        (Path(__file__).parent / 'frontend' / 'camera_idle.png').read_bytes)
    snapshot_dir = Path(hass.config.path('.storage', 'carrot_ha', 'snapshots'))
    await hass.async_add_executor_job(snapshot_dir.mkdir, 0o755, True, True)
    async_add_entities([
        CarrotImageSnapshot(hass, entry, relay, name, placeholder, snapshot_dir)
        for name in ('wide', 'road', 'driver')
    ])


class CarrotImageSnapshot(ImageEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True

    CAMERA_NAMES = {
        'wide': '광각 스냅샷',
        'road': '망원 스냅샷',
        'driver': '실내 스냅샷',
    }

    def __init__(self, hass, entry, relay, camera, placeholder, snapshot_dir):
        super().__init__(hass)
        self.entry, self.relay, self.camera = entry, relay, camera
        self.placeholder = placeholder
        self.snapshot_dir = snapshot_dir
        self.snapshot_file = snapshot_dir / f"{entry.data['device_id']}_{camera}.jpg"
        self._attr_unique_id = f'{entry.data["device_id"]}_image_{camera}'
        self._attr_name = self.CAMERA_NAMES.get(camera, camera)
        self._attr_device_info = comma_device_info(entry)
        self._attr_content_type = 'image/png'

    @property
    def image_last_updated(self) -> datetime | None:
        if self.snapshot_file.is_file():
            try:
                mtime = os.path.getmtime(self.snapshot_file)
                return datetime.fromtimestamp(mtime, tz=timezone.utc)
            except OSError:
                pass
        return None

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
        }

    async def async_image(self) -> bytes | None:
        """Returns the latest cached snapshot without waking the vehicle."""
        if self.snapshot_file.is_file():
            try:
                data = await self.hass.async_add_executor_job(self.snapshot_file.read_bytes)
                if data:
                    self._attr_content_type = 'image/jpeg'
                    return data
            except OSError:
                pass
        self._attr_content_type = 'image/png'
        return self.placeholder

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.async_on_remove(async_dispatcher_connect(
            self.hass, 'carrot_camera_' + self.entry.entry_id, self.async_write_ha_state))

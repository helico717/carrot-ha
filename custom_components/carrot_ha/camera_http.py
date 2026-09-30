"""HA route adapter; all device authentication is performed before upgrading."""
import logging
from aiohttp import web
from homeassistant.components.http import HomeAssistantView

_LOGGER = logging.getLogger(__name__)


class CameraDeviceView(HomeAssistantView):
    url = '/api/carrot_ha/v1/camera/{device_id}'
    name = 'api:carrot_ha:camera_device'
    requires_auth = False  # Dedicated camera credential checked by relay.device.

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, device_id):
        all_runtimes = [
            (k, r) for k, r in self.hass.data.get('carrot_ha', {}).items()
            if isinstance(r, dict) and 'entry' in r
        ]
        if not all_runtimes:
            _LOGGER.warning("Camera device connection requested for '%s', but no Carrot HA entries are loaded.", device_id)
            raise web.HTTPNotFound()

        active_relays = [
            (k, r) for k, r in all_runtimes if r.get('camera_relay') is not None
        ]
        if not active_relays:
            _LOGGER.warning(
                "Comma device tried to connect for camera '%s', but camera relay is disabled in Carrot HA options. "
                "Please go to Settings -> Devices & Services -> Carrot HA -> Configure and check 'Enable parked cameras'.",
                device_id
            )
            raise web.HTTPServiceUnavailable(text='Camera relay disabled in Carrot HA options')

        # 1. Match exact device_id
        for _, runtime in active_relays:
            if runtime['entry'].data.get('device_id') == device_id:
                return await runtime['camera_relay'].device(request)

        # 2. Flexible fallback if single entry or generic alias
        if len(active_relays) == 1 or device_id in ('comma', 'default', 'live'):
            return await active_relays[0][1]['camera_relay'].device(request)

        _LOGGER.warning("Camera device connection for '%s' did not match configured devices: %s",
                        device_id, [r['entry'].data.get('device_id') for _, r in active_relays])
        raise web.HTTPNotFound()


class CameraLiveView(HomeAssistantView):
    url = '/api/carrot_ha/v1/camera/{device_id}/live'
    name = 'api:carrot_ha:camera_live'
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, device_id):
        all_runtimes = [
            (k, r) for k, r in self.hass.data.get('carrot_ha', {}).items()
            if isinstance(r, dict) and 'entry' in r
        ]
        if not all_runtimes:
            _LOGGER.warning("Camera live request for '%s' failed: No Carrot HA integration entry loaded.", device_id)
            raise web.HTTPNotFound()

        active_relays = [
            (k, r) for k, r in all_runtimes if r.get('camera_relay') is not None
        ]
        if not active_relays:
            _LOGGER.warning(
                "Camera live request for device '%s' failed: Camera relay is disabled in Carrot HA options. "
                "Go to Settings -> Devices & Services -> Carrot HA -> Configure and check 'Enable parked cameras'.",
                device_id
            )
            raise web.HTTPServiceUnavailable(text='Camera relay disabled in Carrot HA options')

        # 1. Match exact device_id
        for _, runtime in active_relays:
            if runtime['entry'].data.get('device_id') == device_id:
                return await runtime['camera_relay'].live_ws(request)

        # 2. Flexible fallback if single entry or generic alias
        if len(active_relays) == 1 or device_id in ('comma', 'default', 'live'):
            return await active_relays[0][1]['camera_relay'].live_ws(request)

        _LOGGER.warning("Camera live request for '%s' did not match any of the configured devices: %s",
                        device_id, [r['entry'].data.get('device_id') for _, r in active_relays])
        raise web.HTTPNotFound()

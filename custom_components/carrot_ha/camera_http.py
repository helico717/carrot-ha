"""HA route adapter; all device authentication is performed before upgrading."""
from aiohttp import web
from homeassistant.components.http import HomeAssistantView


class CameraDeviceView(HomeAssistantView):
    url = '/api/carrot_ha/v1/camera/{device_id}'
    name = 'api:carrot_ha:camera_device'
    requires_auth = False  # Dedicated camera credential checked by relay.device.

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, device_id):
        runtimes = [
            r for r in self.hass.data.get('carrot_ha', {}).values()
            if isinstance(r, dict) and 'entry' in r and r.get('camera_relay') is not None
        ]
        for runtime in runtimes:
            if runtime['entry'].data.get('device_id') == device_id:
                return await runtime['camera_relay'].device(request)
        if runtimes and (len(runtimes) == 1 or device_id in ('comma', 'default', 'live')):
            return await runtimes[0]['camera_relay'].device(request)
        raise web.HTTPNotFound()


class CameraLiveView(HomeAssistantView):
    url = '/api/carrot_ha/v1/camera/{device_id}/live'
    name = 'api:carrot_ha:camera_live'
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, device_id):
        runtimes = [
            r for r in self.hass.data.get('carrot_ha', {}).values()
            if isinstance(r, dict) and 'entry' in r and r.get('camera_relay') is not None
        ]
        for runtime in runtimes:
            if runtime['entry'].data.get('device_id') == device_id:
                return await runtime['camera_relay'].live_ws(request)
        if runtimes and (len(runtimes) == 1 or device_id in ('comma', 'default', 'live')):
            return await runtimes[0]['camera_relay'].live_ws(request)
        raise web.HTTPNotFound()


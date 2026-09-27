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
        for runtime in self.hass.data.get('carrot_ha', {}).values():
            if (isinstance(runtime, dict) and 'entry' in runtime
                    and runtime['entry'].data['device_id'] == device_id
                    and (relay := runtime.get('camera_relay')) is not None):
                return await relay.device(request)
        raise web.HTTPNotFound()

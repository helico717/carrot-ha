"""Device-only terminal WebSocket route."""
from aiohttp import web
from homeassistant.components.http import HomeAssistantView


class TerminalDeviceView(HomeAssistantView):
    url = '/api/carrot_ha/v1/terminal/{device_id}'
    name = 'api:carrot_ha:terminal_device'
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, device_id):
        for runtime in self.hass.data.get('carrot_ha', {}).values():
            if (isinstance(runtime, dict) and 'entry' in runtime
                    and runtime['entry'].data['device_id'] == device_id
                    and (relay := runtime.get('terminal_relay')) is not None):
                return await relay.device(request)
        raise web.HTTPNotFound()

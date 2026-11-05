"""Read-only openpilot assist statistics for dashboards (shared archive cache)."""
import voluptuous as vol
from homeassistant.components import websocket_api


@websocket_api.websocket_command({vol.Required('type'): 'carrot_ha/assist/summary',
                                  vol.Required('entry_id'): str,
                                  vol.Optional('period', default='all'): vol.In(['all', 'year', 'month', 'week', 'day']),
                                  vol.Optional('date'): vol.Match(r'^\d{4}-\d{2}-\d{2}$')})
@websocket_api.async_response
async def summary(hass, connection, msg):
    runtime = hass.data.get('carrot_ha', {}).get(msg['entry_id'])
    if not isinstance(runtime, dict) or 'archive' not in runtime:
        connection.send_error(msg['id'], 'not_found', 'Vehicle entry not found')
        return
    try:
        result = await hass.async_add_executor_job(
            runtime['archive'].assist_summary, runtime['entry'].data['device_id'], msg['period'], msg.get('date'))
    except ValueError as error:
        connection.send_error(msg['id'], 'invalid_request', str(error))
        return
    connection.send_result(msg['id'], result)


def async_register(hass):
    websocket_api.async_register_command(hass, summary)

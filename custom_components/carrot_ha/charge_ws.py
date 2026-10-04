"""Administrator-only local charge payment writes."""
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.helpers.dispatcher import async_dispatcher_send
from .charge_costs import PaymentConflict, refresh_runtime_costs


async def _write(hass, connection, msg, actual):
    if connection.user is None or not connection.user.is_admin:
        connection.send_error(msg['id'], 'unauthorized', 'Administrator access required')
        return
    runtime = hass.data.get('carrot_ha', {}).get(msg['entry_id'])
    if not isinstance(runtime, dict) or 'archive' not in runtime:
        connection.send_error(msg['id'], 'not_found', 'Vehicle entry not found')
        return
    try:
        async with runtime['lock']:
            result = await hass.async_add_executor_job(runtime['archive'].set_charge_payment,
                runtime['entry'].data['device_id'], msg['payment_id'], msg['source_event_ids'],
                msg['expected_version'], actual)
            try:
                await refresh_runtime_costs(hass, runtime)
            except Exception:
                pass  # Periodic local refresh retries; the durable write succeeded.
        async_dispatcher_send(hass, 'carrot_ha' + runtime['entry'].entry_id)
        connection.send_result(msg['id'], result)
    except PaymentConflict as error:
        connection.send_error(msg['id'], 'conflict', str(error))
    except ValueError as error:
        connection.send_error(msg['id'], 'invalid_payment', str(error))
    except Exception:
        connection.send_error(msg['id'], 'save_failed', 'Payment could not be saved; retry after refreshing')


_SCHEMA = {vol.Required('entry_id'): str, vol.Required('payment_id'): str,
           vol.Required('source_event_ids'): [str], vol.Required('expected_version'): int}


@websocket_api.websocket_command({**_SCHEMA, vol.Required('type'): 'carrot_ha/charge_payment/save',
                                 vol.Required('actual_cost_krw'): int})
@websocket_api.async_response
async def save(hass, connection, msg):
    await _write(hass, connection, msg, msg['actual_cost_krw'])


@websocket_api.websocket_command({**_SCHEMA, vol.Required('type'): 'carrot_ha/charge_payment/delete'})
@websocket_api.async_response
async def delete(hass, connection, msg):
    await _write(hass, connection, msg, None)


def async_register(hass):
    websocket_api.async_register_command(hass, save)
    websocket_api.async_register_command(hass, delete)

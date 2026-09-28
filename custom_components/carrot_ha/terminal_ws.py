"""Administrator-only Home Assistant WebSocket commands for terminal cards."""
import voluptuous as vol

from homeassistant.components import websocket_api

from . import DOMAIN


def _relay(hass, device_id):
    for runtime in hass.data.get(DOMAIN, {}).values():
        if (isinstance(runtime, dict) and 'entry' in runtime
                and runtime['entry'].data['device_id'] == device_id):
            return runtime.get('terminal_relay')
    return None


def _require_admin(connection, msg):
    if connection.user is None or not connection.user.is_admin:
        connection.send_error(msg['id'], 'unauthorized', 'Administrator access required')
        return False
    return True


@websocket_api.websocket_command({vol.Required('type'): 'carrot_ha/terminal/subscribe', vol.Required('device_id'): str})
@websocket_api.async_response
async def subscribe(hass, connection, msg):
    if not _require_admin(connection, msg):
        return
    relay = _relay(hass, msg['device_id'])
    if relay is None:
        connection.send_error(msg['id'], 'not_found', 'Terminal relay is not configured')
        return
    controller_key = id(connection)
    key = (controller_key, msg['id'])
    unsubscribe = relay.subscribe(
        key,
        lambda payload: connection.send_event(msg['id'], payload),
        controller_key=controller_key,
    )

    def remove_subscription():
        hass.async_create_task(unsubscribe())

    connection.subscriptions[msg['id']] = remove_subscription
    connection.send_result(msg['id'])
    connection.send_event(msg['id'], relay.snapshot())


@websocket_api.websocket_command({vol.Required('type'): 'carrot_ha/terminal/acquire', vol.Required('device_id'): str})
@websocket_api.async_response
async def acquire(hass, connection, msg):
    if not _require_admin(connection, msg):
        return
    relay = _relay(hass, msg['device_id'])
    if relay is None:
        connection.send_error(msg['id'], 'not_found', 'Terminal relay is not configured')
        return
    try:
        connection.send_result(msg['id'], await relay.acquire(id(connection)))
    except (RuntimeError, ValueError) as exc:
        connection.send_error(msg['id'], 'unavailable', str(exc))


@websocket_api.websocket_command({
    vol.Required('type'): 'carrot_ha/terminal/input',
    vol.Required('device_id'): str,
    vol.Required('message'): dict,
})
@websocket_api.async_response
async def terminal_input(hass, connection, msg):
    if not _require_admin(connection, msg):
        return
    relay = _relay(hass, msg['device_id'])
    if relay is None:
        connection.send_error(msg['id'], 'not_found', 'Terminal relay is not configured')
        return
    try:
        connection.send_result(msg['id'], await relay.input(id(connection), msg['message']))
    except (RuntimeError, ValueError) as exc:
        connection.send_error(msg['id'], 'rejected', str(exc))


@websocket_api.websocket_command({vol.Required('type'): 'carrot_ha/terminal/release', vol.Required('device_id'): str})
@websocket_api.async_response
async def release(hass, connection, msg):
    if not _require_admin(connection, msg):
        return
    relay = _relay(hass, msg['device_id'])
    if relay is not None:
        await relay.release(id(connection))
    connection.send_result(msg['id'])


def async_register(hass):
    websocket_api.async_register_command(hass, subscribe)
    websocket_api.async_register_command(hass, acquire)
    websocket_api.async_register_command(hass, terminal_input)
    websocket_api.async_register_command(hass, release)

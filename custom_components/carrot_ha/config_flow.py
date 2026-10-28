from .battery import DEFAULT_REFERENCE_EFFICIENCY_KPL, DEFAULT_SOC_CAPACITY_KWH
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

class ConfigFlow(config_entries.ConfigFlow, domain='carrot_ha'):
    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return BatteryOptionsFlow()

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            if len(user_input['token']) < 32:
                errors['base'] = 'weak_token'
            else:
                await self.async_set_unique_id(user_input['device_id'])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=user_input['device_id'], data=user_input)
        return self.async_show_form(step_id='user', data_schema=vol.Schema({vol.Required('device_id'): str, vol.Required('token'): str}), errors=errors)

class BatteryOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        from .driving_logs.runtime import configured_path
        nas_path = await self.hass.async_add_executor_job(configured_path, self.hass, self.config_entry)
        schema = vol.Schema({vol.Optional('vehicle_model', default=self.config_entry.options.get('vehicle_model', 'Volkswagen MEB')): str,vol.Required('soc_capacity_kwh', default=self.config_entry.options.get('soc_capacity_kwh', DEFAULT_SOC_CAPACITY_KWH)): vol.All(vol.Coerce(float), vol.Range(min=20, max=150)),
                             vol.Required('reference_efficiency_kpl', default=self.config_entry.options.get('reference_efficiency_kpl', DEFAULT_REFERENCE_EFFICIENCY_KPL)): vol.All(vol.Coerce(float), vol.Range(min=1, max=10)),
                             vol.Optional('receiver_url', default=self.config_entry.options.get('receiver_url', '')): str,
                             vol.Optional('receiver_view_token', default=self.config_entry.options.get('receiver_view_token', '')): str,
                             vol.Optional('receiver_upload_token', default=self.config_entry.options.get('receiver_upload_token', '')): str,
                             vol.Optional('camera_enabled', default=self.config_entry.options.get('camera_enabled', False)): bool,
                             vol.Optional('camera_token', default=self.config_entry.options.get('camera_token', '')): str,
                             vol.Optional('terminal_enabled', default=self.config_entry.options.get('terminal_enabled', False)): bool,
                             vol.Optional('terminal_ha_url', default=self.config_entry.options.get('terminal_ha_url', '')): str,
                             vol.Optional('driving_logs_nas_path', default=nas_path): str,
})
        errors = {}
        if user_input is not None:
            try:
                data = {**self.config_entry.options, **schema(user_input)}
                data['driving_logs_nas_path'] = data.get('driving_logs_nas_path', '').strip()
                if data['driving_logs_nas_path']:
                    from .driving_logs.tiered import network_path
                    try:
                        await self.hass.async_add_executor_job(network_path, data['driving_logs_nas_path'])
                    except (ValueError, OSError):
                        errors['base'] = 'invalid_log_archive'
                        return self.async_show_form(step_id='init', data_schema=schema, errors=errors)
                import math
                if not math.isfinite(data['soc_capacity_kwh']) or not math.isfinite(data['reference_efficiency_kpl']):
                    raise vol.Invalid('finite required')
                from urllib.parse import urlsplit
                data['cloud_url'] = data.get('cloud_url', '').strip().rstrip('/')
                data['cloud_view_token'] = data.get('cloud_view_token', '').strip()
                for key in ('receiver_url', 'receiver_view_token', 'receiver_upload_token'):
                    data[key] = data.get(key, '').strip()
                data['receiver_url'] = data['receiver_url'].rstrip('/')
                direct = bool(data['receiver_url'])
                if direct:
                    receiver = urlsplit(data['receiver_url'])
                    import ipaddress
                    try:
                        local = ipaddress.ip_address(receiver.hostname or '').is_private
                    except ValueError:
                        local = bool(receiver.hostname and (receiver.hostname.endswith('-carrot-receiver')
                                     or receiver.hostname == 'localhost'))
                    credentials = [data['receiver_view_token'], data['receiver_upload_token']]
                    if (receiver.scheme not in ('http', 'https') or (receiver.scheme == 'http' and not local)
                            or not receiver.hostname or receiver.username or receiver.password
                            or receiver.query or receiver.fragment or credentials[0] == credentials[1]
                            or any(not 32 <= len(value) <= 256 or not value.isascii()
                                or any(c.isspace() for c in value) for value in credentials)):
                        errors['base'] = 'invalid_receiver'
                        return self.async_show_form(step_id='init', data_schema=schema, errors=errors)
                data['camera_token'] = data.get('camera_token', '').strip()
                import secrets
                data['terminal_token'] = self.config_entry.options.get('terminal_token') or secrets.token_hex(32)
                data['terminal_ha_url'] = data.get('terminal_ha_url', '').strip().rstrip('/')
                data['terminal_upload_token'] = data.get('terminal_upload_token', '').strip()
                if data.get('terminal_enabled'):
                    address = urlsplit(data['terminal_ha_url'])
                    if (address.scheme != 'https' or not address.hostname or address.path or address.query
                            or address.fragment or address.username or address.password
                            or (not direct and (not data['cloud_url'] or not data['terminal_upload_token']
                                or data['terminal_upload_token'] == data['cloud_view_token']))):
                        errors['base'] = 'invalid_terminal_setup'
                        return self.async_show_form(step_id='init', data_schema=schema, errors=errors)
                token = data['camera_token']
                if data.get('camera_enabled') and (
                    not 32 <= len(token) <= 256 or not token.isascii() or any(c.isspace() for c in token)
                    or token in (self.config_entry.data['token'], data['cloud_view_token'])
                ):
                    errors['base'] = 'invalid_camera_token'
                    return self.async_show_form(step_id='init', data_schema=schema, errors=errors)
                terminal_token = data['terminal_token']
                if data.get('terminal_enabled') and (
                    not 32 <= len(terminal_token) <= 256 or not terminal_token.isascii()
                    or any(c.isspace() for c in terminal_token)
                    or terminal_token in (self.config_entry.data['token'], data['cloud_view_token'], token)
                ):
                    errors['base'] = 'invalid_terminal_token'
                    return self.async_show_form(step_id='init', data_schema=schema, errors=errors)
                url = urlsplit(data['cloud_url'])
                if not direct and data['cloud_url'] and (url.scheme != 'https' or not url.hostname or url.path or url.query or url.fragment or url.username or url.password or not data['cloud_view_token']):
                    errors['base'] = 'invalid_cloud'
                    return self.async_show_form(step_id='init', data_schema=schema, errors=errors)
                return self.async_create_entry(title='', data=data)
            except vol.Invalid:
                errors['base'] = 'invalid_capacity'
        return self.async_show_form(step_id='init', data_schema=schema, errors=errors)

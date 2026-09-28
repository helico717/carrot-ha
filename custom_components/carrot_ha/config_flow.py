from .battery import DEFAULT_SOC_CAPACITY_KWH
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
        schema = vol.Schema({vol.Optional('vehicle_model', default=self.config_entry.options.get('vehicle_model', 'Volkswagen MEB')): str,vol.Required('soc_capacity_kwh', default=self.config_entry.options.get('soc_capacity_kwh', DEFAULT_SOC_CAPACITY_KWH)): vol.All(vol.Coerce(float), vol.Range(min=20, max=150)),
                             vol.Optional('cloud_url', default=self.config_entry.options.get('cloud_url', '')): str,
                             vol.Optional('cloud_view_token', default=self.config_entry.options.get('cloud_view_token', '')): str,
                             vol.Optional('camera_enabled', default=self.config_entry.options.get('camera_enabled', False)): bool,
                             vol.Optional('camera_token', default=self.config_entry.options.get('camera_token', '')): str,
                             vol.Optional('terminal_enabled', default=self.config_entry.options.get('terminal_enabled', False)): bool,
                             vol.Optional('terminal_token', default=self.config_entry.options.get('terminal_token', '')): str})
        errors = {}
        if user_input is not None:
            try:
                data = schema(user_input)
                import math
                if not math.isfinite(data['soc_capacity_kwh']):
                    raise vol.Invalid('finite required')
                from urllib.parse import urlsplit
                data['cloud_url'] = data.get('cloud_url', '').strip().rstrip('/')
                data['cloud_view_token'] = data.get('cloud_view_token', '').strip()
                data['camera_token'] = data.get('camera_token', '').strip()
                data['terminal_token'] = data.get('terminal_token', '').strip()
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
                if data['cloud_url'] and (url.scheme != 'https' or not url.hostname or url.path or url.query or url.fragment or url.username or url.password or not data['cloud_view_token']):
                    errors['base'] = 'invalid_cloud'
                    return self.async_show_form(step_id='init', data_schema=schema, errors=errors)
                return self.async_create_entry(title='', data=data)
            except vol.Invalid:
                errors['base'] = 'invalid_capacity'
        return self.async_show_form(step_id='init', data_schema=schema, errors=errors)

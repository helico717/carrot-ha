import importlib.util
import sys
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('migration', 'custom_components/carrot_ha/entity_migration.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class Registry:
    def __init__(self, keys):
        self.entities = {}
        for key, entity_id in keys.items():
            self.entities[entity_id] = types.SimpleNamespace(
                entity_id=entity_id, unique_id='car_' + key, platform='carrot_ha',
                domain=entity_id.split('.')[0], device_id='vehicle')

    def async_get(self, key):
        return self.entities.get(key)

    def async_remove(self, key):
        del self.entities[key]

    def async_update_entity(self, key, **updates):
        entity = self.entities.pop(key)
        entity.entity_id = updates.pop('new_entity_id', key)
        for attr, value in updates.items():
            setattr(entity, attr, value)
        self.entities[entity.entity_id] = entity


class MigrationTest(unittest.TestCase):
    def migrate(self, registry):
        helpers = types.ModuleType('homeassistant.helpers')
        helpers.entity_registry = types.SimpleNamespace(
            async_get=lambda hass: registry,
            async_entries_for_config_entry=lambda reg, entry: list(reg.entities.values()))
        helpers.device_registry = types.SimpleNamespace(async_get=lambda hass: types.SimpleNamespace(
            async_get_or_create=lambda **kw: types.SimpleNamespace(id='comma')))
        entry = types.SimpleNamespace(entry_id='entry', data={'device_id': 'car'})
        with patch.dict(sys.modules, {'homeassistant.helpers': helpers}):
            migration.migrate_entities(None, entry)

    def test_migration_and_repeat(self):
        registry = Registry({
            'range_km': 'sensor.id_4_range_km',
            'doors_locked_external': 'binary_sensor.id_4_doors_locked_external',
            'doors_locked_internal': 'binary_sensor.id_4_doors_locked_internal',
            'comma_cpu_temperature_c': 'sensor.id_4_comma_cpu_temperature_c',
            'comma_online': 'binary_sensor.id_4_comma_online',
            **{key: 'sensor.id_4_' + key for key in migration.REMOVED_SENSORS}})
        self.migrate(registry)
        self.migrate(registry)
        self.assertEqual(len(registry.entities), 3)
        self.assertEqual(registry.async_get('sensor.id_4_estimated_range_km').unique_id, 'car_range_km')
        self.assertEqual(registry.async_get('sensor.id_4_comma_cpu_temperature_c').device_id, 'comma')
        self.assertEqual(registry.async_get('binary_sensor.id_4_comma_online').device_id, 'comma')

    def test_custom_ids_and_collisions(self):
        registry = Registry({'range_km': 'sensor.my_range',
                             'month_charge_kwh': 'sensor.id_4_month_charge_kwh',
                             'other': 'sensor.id_4_estimated_month_charge_kwh'})
        self.migrate(registry)
        self.assertIsNotNone(registry.async_get('sensor.my_range'))
        self.assertIsNotNone(registry.async_get('sensor.id_4_month_charge_kwh'))


if __name__ == '__main__':
    unittest.main()

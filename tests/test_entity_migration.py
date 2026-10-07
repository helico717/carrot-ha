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
                domain=entity_id.split('.')[0], device_id='vehicle', disabled_by=None)

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
    def migrate(self, registry, entry=None):
        helpers = types.ModuleType('homeassistant.helpers')
        helpers.entity_registry = types.SimpleNamespace(
            RegistryEntryDisabler=types.SimpleNamespace(INTEGRATION='integration'),
            async_get=lambda hass: registry,
            async_entries_for_config_entry=lambda reg, entry: list(reg.entities.values()))
        helpers.device_registry = types.SimpleNamespace(async_get=lambda hass: types.SimpleNamespace(
            async_get_or_create=lambda **kw: types.SimpleNamespace(id='comma')))
        entry = entry or types.SimpleNamespace(entry_id='entry', data={'device_id': 'car'}, options={})
        def update(entry, **kwargs):
            entry.data = kwargs['data']
        hass = types.SimpleNamespace(config_entries=types.SimpleNamespace(async_update_entry=update))
        with patch.dict(sys.modules, {'homeassistant.helpers': helpers}):
            migration.migrate_entities(hass, entry)
        return entry

    def test_compaction_once_preserves_comma_and_manual_enable(self):
        keys = migration.COMPACT_SENSORS | {'comma_cpu_temperature_c', 'comma_online',
            'soc_percent', 'actual_charge_power_w', 'charge_mode', 'time_to_80_s', 'time_to_100_s',
            'month_efficiency_kpl', 'month_distance_km'}
        registry = Registry({key: 'sensor.custom_' + key for key in keys})
        entry = self.migrate(registry)
        self.assertEqual(sum(e.disabled_by == 'integration' for e in registry.entities.values()), 12)
        for key in keys-migration.COMPACT_SENSORS:
            entity = next(e for e in registry.entities.values() if e.unique_id == 'car_'+key)
            self.assertIsNone(entity.disabled_by)
        registry.async_get('sensor.custom_last_trip_at').disabled_by = None
        self.migrate(registry, entry)
        self.assertIsNone(registry.async_get('sensor.custom_last_trip_at').disabled_by)
        self.assertEqual(entry.data[migration.COMPACTION_DATA_KEY], 1)
        entry.options = {'soc_capacity_kwh': 78}
        self.migrate(registry, entry)
        self.assertIsNone(registry.async_get('sensor.custom_last_trip_at').disabled_by)

    def test_preserves_user_disabled_and_other_vehicle(self):
        registry = Registry({'last_trip_at': 'sensor.custom_end', 'eta_80': 'sensor.other_eta'})
        registry.async_get('sensor.custom_end').disabled_by = 'user'
        registry.async_get('sensor.other_eta').unique_id = 'other_eta_80'
        entry = types.SimpleNamespace(entry_id='entry', data={'device_id':'car'}, options={'soc_capacity_kwh':77})
        self.migrate(registry, entry)
        self.assertEqual(registry.async_get('sensor.custom_end').disabled_by, 'user')
        self.assertIsNone(registry.async_get('sensor.other_eta').disabled_by)
        self.assertEqual(entry.options['soc_capacity_kwh'], 77)

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

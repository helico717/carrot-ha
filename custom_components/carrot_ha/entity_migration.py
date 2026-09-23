"""Preserve unique IDs while updating entity presentation and device ownership."""
import logging

DOMAIN = 'carrot_ha'
REMOVED_SENSORS = {'bms_mode', 'month_energy_coverage_percent', 'month_drive_energy_kwh'}
ESTIMATED_OBJECT_IDS = {
    'range_km': 'estimated_range_km',
    'measured_capacity_kwh': 'estimated_measured_capacity_kwh',
    'month_efficiency_kpl': 'estimated_month_efficiency_kpl',
    'month_charge_kwh': 'estimated_month_charge_kwh',
    'month_slow_kwh': 'estimated_month_slow_kwh',
    'month_fast_kwh': 'estimated_month_fast_kwh',
    'month_charge_cost': 'estimated_month_charge_cost',
    'time_to_80_s': 'estimated_time_to_80_s',
    'time_to_100_s': 'estimated_time_to_100_s',
    'eta_80': 'estimated_eta_80',
    'eta_100': 'estimated_eta_100',
    'charging': 'estimated_charging',
    'emergency_charging': 'estimated_emergency_charging',
}


def comma_device_info(entry):
    return {'identifiers': {(DOMAIN, entry.data['device_id'] + '_comma')},
            'name': 'Comma', 'manufacturer': 'comma.ai'}


def migrate_entities(hass, entry):
    from homeassistant.helpers import entity_registry as er, device_registry as dr
    registry = er.async_get(hass)
    comma = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id, **comma_device_info(entry))
    prefix = entry.data['device_id'] + '_'
    for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
        if entity.platform != DOMAIN or not entity.unique_id.startswith(prefix):
            continue
        key = entity.unique_id[len(prefix):]
        if entity.domain == 'sensor' and key in REMOVED_SENSORS:
            registry.async_remove(entity.entity_id)
            continue
        updates = {}
        if key.startswith('comma_'):
            updates['device_id'] = comma.id
        # Preserve user-chosen IDs; only rename the known generated suffix.
        object_id = entity.entity_id.split('.', 1)[1]
        if key in ESTIMATED_OBJECT_IDS and 'estimated_' not in object_id:
            suffix = '_' + key
            if object_id == key or object_id.endswith(suffix):
                base = object_id[:-len(key)]
                candidate = entity.domain + '.' + base + ESTIMATED_OBJECT_IDS[key]
                if registry.async_get(candidate) is None:
                    updates['new_entity_id'] = candidate
                else:
                    logging.getLogger(__name__).warning('Cannot rename %s: %s already exists', entity.entity_id, candidate)
        if updates:
            registry.async_update_entity(entity.entity_id, **updates)

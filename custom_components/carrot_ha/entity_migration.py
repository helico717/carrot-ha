"""Preserve unique IDs while updating entity presentation and device ownership."""
import logging

DOMAIN = 'carrot_ha'
# Retained for reversible compatibility; values live on composite sensors.
COMPACT_SENSORS = {
    'last_trip_distance_km', 'last_trip_duration_s', 'last_trip_avg_kph',
    'last_trip_max_kph', 'last_trip_at', 'eta_80', 'eta_100',
    'month_slow_kwh', 'month_fast_kwh', 'month_trip_count',
    'trip_count', 'recorded_distance_km',
}
COMPACTION_DATA_KEY = 'vehicle_entity_compaction_version'
REMOVED_SENSORS = {
    'charge_power_w', 'charge_connection_evidence', 'bms_mode', 'month_energy_coverage_percent', 'month_drive_energy_kwh',
    'bms_target_soc_percent', 'wheel_speed_kph', 'measured_capacity_kwh'
}
DIAGNOSTIC_KEYS = {
    'aux_voltage', 'emergency_charging', 'hv_voltage', 'recirc', 'blower_level',
    'blower_volt', 'parking_at', 'cloud_status', 'gear', 'dcdc_temperature_c',
    'gps_accuracy_m', 'last_sync', 'soc_capacity_kwh'
}
ESTIMATED_OBJECT_IDS = {
    'range_km': 'estimated_range_km',
    'measured_capacity_kwh': 'estimated_measured_capacity_kwh',
    'month_efficiency_kpl': 'estimated_month_efficiency_kpl',
    'rolling30_efficiency_kpl': 'estimated_rolling30_efficiency_kpl',
    'month_charge_kwh': 'estimated_month_charge_kwh',
    'month_slow_kwh': 'estimated_month_slow_kwh',
    'month_fast_kwh': 'estimated_month_fast_kwh',
    'month_charge_cost': 'estimated_month_charge_cost',
    'time_to_80_s': 'estimated_time_to_80_s',
    'time_to_100_s': 'estimated_time_to_100_s',
    'eta_80': 'estimated_eta_80',
    'eta_100': 'estimated_eta_100',
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
    compact = entry.data.get(COMPACTION_DATA_KEY, 0) < 1
    for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
        if entity.platform != DOMAIN or not entity.unique_id.startswith(prefix):
            continue
        key = entity.unique_id[len(prefix):]
        if (entity.domain == 'sensor' and key in REMOVED_SENSORS) or (
                entity.domain == 'binary_sensor' and key in {'doors_locked_external', 'doors_locked_internal', 'charge_plug_indication'}) or (
                entity.domain == 'camera' and key in {'camera_wide', 'camera_driver', 'camera_road'}) or (
                entity.domain == 'image' and key in {'image_wide', 'image_driver', 'image_road'}):
            registry.async_remove(entity.entity_id)
            continue
        updates = {}
        if compact and entity.domain == 'sensor' and key in COMPACT_SENSORS and entity.disabled_by is None:
            updates['disabled_by'] = er.RegistryEntryDisabler.INTEGRATION
        if key.startswith('comma_'):
            updates['device_id'] = comma.id
        if key in DIAGNOSTIC_KEYS:
            from homeassistant.const import EntityCategory
            if entity.entity_category != EntityCategory.DIAGNOSTIC:
                updates['entity_category'] = EntityCategory.DIAGNOSTIC
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
    if compact:
        # Persist only after registry updates succeed. Do not disable a sensor
        # again after the user explicitly re-enables it on a later restart.
        # Entry data survives options-form replacement (which only keeps its
        # declared fields). An options save must not re-run this migration.
        hass.config_entries.async_update_entry(entry, data={**entry.data, COMPACTION_DATA_KEY: 1})

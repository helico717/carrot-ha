-- Design-stage schema. Run on a NEW journal DB, never on the existing HA archive.
-- Runtime must enable foreign_keys on EVERY connection and check schema version.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS journal_schema (
  version INTEGER PRIMARY KEY CHECK(version > 0),
  installed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  accounting_timezone TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW' CHECK(currency = 'KRW'),
  created_at TEXT NOT NULL,
  UNIQUE(entry_id, device_id)
);
-- Automatic facts and manual facts share an identity envelope, not mutable values.
CREATE TABLE IF NOT EXISTS records (
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('trip','charge','parking','expense')),
  origin TEXT NOT NULL CHECK(origin IN ('automatic','manual')),
  source_kind TEXT,
  source_id TEXT,
  source_revision TEXT,
  source_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','excluded','deleted','superseded')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(typeof(version) = 'integer' AND version >= 1),
  quality_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(quality_json) AND json_type(quality_json) = 'object'),
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json) AND json_type(extra_json) = 'object'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,id),
  CHECK((origin = 'automatic' AND source_kind IS NOT NULL AND source_id IS NOT NULL AND source_fingerprint IS NOT NULL)
     OR (origin = 'manual' AND source_kind IS NULL AND source_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS records_source ON records(vehicle_id,source_kind,source_id) WHERE origin = 'automatic';
CREATE INDEX IF NOT EXISTS records_status ON records(vehicle_id,kind,status,updated_at);
CREATE TABLE IF NOT EXISTS mobility (
  vehicle_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  distance_km REAL CHECK(distance_km >= 0),
  drive_energy_kwh REAL CHECK(drive_energy_kwh >= 0),
  battery_charge_kwh REAL CHECK(battery_charge_kwh >= 0),
  billed_charge_kwh REAL CHECK(billed_charge_kwh >= 0),
  soc_start_percent REAL CHECK(soc_start_percent BETWEEN 0 AND 100),
  soc_end_percent REAL CHECK(soc_end_percent BETWEEN 0 AND 100),
  drive_soc_used_pp REAL CHECK(drive_soc_used_pp >= 0),
  parked_soc_used_pp REAL CHECK(parked_soc_used_pp >= 0),
  charged_soc_pp REAL CHECK(charged_soc_pp >= 0),
  odometer_km REAL CHECK(odometer_km >= 0),
  charge_mode TEXT NOT NULL DEFAULT 'unknown' CHECK(charge_mode IN ('slow','fast','unknown')),
  location_name TEXT,
  memo TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(vehicle_id,record_id),
  FOREIGN KEY(vehicle_id,record_id) REFERENCES records(vehicle_id,id),
  CHECK(julianday(started_at) IS NOT NULL AND julianday(ended_at) IS NOT NULL AND julianday(ended_at) >= julianday(started_at))
);
CREATE INDEX IF NOT EXISTS mobility_time ON mobility(vehicle_id,started_at,ended_at);
-- One row per HA payment group, NOT one row per member charge: no double cost.
CREATE TABLE IF NOT EXISTS expenses (
  vehicle_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  accounting_date TEXT NOT NULL,
  paid_date TEXT,
  category TEXT NOT NULL CHECK(category IN ('charging','maintenance','tuning','washing','insurance','tax','parking','toll','other')),
  subcategory TEXT,
  actual_krw INTEGER CHECK(actual_krw IS NULL OR (typeof(actual_krw) = 'integer' AND actual_krw >= 0)),
  estimated_krw INTEGER CHECK(estimated_krw IS NULL OR (typeof(estimated_krw) = 'integer' AND estimated_krw >= 0)),
  payment_owner TEXT NOT NULL CHECK(payment_owner IN ('ha_charge_payment','journal')),
  payment_id TEXT,
  payment_version INTEGER CHECK(payment_version IS NULL OR (typeof(payment_version) = 'integer' AND payment_version >= 0)),
  memo TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(vehicle_id,record_id),
  FOREIGN KEY(vehicle_id,record_id) REFERENCES records(vehicle_id,id),
  CHECK((payment_owner = 'ha_charge_payment' AND payment_id IS NOT NULL AND payment_version IS NOT NULL AND category = 'charging')
     OR (payment_owner = 'journal' AND payment_id IS NULL AND payment_version IS NULL)),
  CHECK(length(accounting_date) = 10 AND date(accounting_date) IS NOT NULL),
  CHECK(paid_date IS NULL OR (length(paid_date) = 10 AND date(paid_date) IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS expenses_payment ON expenses(vehicle_id,payment_id) WHERE payment_owner = 'ha_charge_payment';
CREATE INDEX IF NOT EXISTS expenses_date ON expenses(vehicle_id,accounting_date,category);
CREATE TABLE IF NOT EXISTS expense_members (
  vehicle_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  charge_id TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,expense_id,charge_id),
  FOREIGN KEY(vehicle_id,expense_id) REFERENCES expenses(vehicle_id,record_id),
  FOREIGN KEY(vehicle_id,charge_id) REFERENCES mobility(vehicle_id,record_id)
);
CREATE TABLE IF NOT EXISTS record_links (
  vehicle_id TEXT NOT NULL,
  manual_id TEXT NOT NULL,
  automatic_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK(relation IN ('supplements','replaces')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,manual_id,automatic_id),
  FOREIGN KEY(vehicle_id,manual_id) REFERENCES records(vehicle_id,id),
  FOREIGN KEY(vehicle_id,automatic_id) REFERENCES records(vehicle_id,id),
  CHECK(manual_id != automatic_id)
);
CREATE TABLE IF NOT EXISTS corrections (
  vehicle_id TEXT NOT NULL,
  id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  patch_json TEXT NOT NULL CHECK(json_valid(patch_json) AND json_type(patch_json) = 'object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK(typeof(version) = 'integer' AND version >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleted')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,id),
  FOREIGN KEY(vehicle_id,record_id) REFERENCES records(vehicle_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS corrections_active ON corrections(vehicle_id,record_id) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS change_log (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  operation TEXT NOT NULL,
  before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json)),
  changed_at TEXT NOT NULL,
  FOREIGN KEY(vehicle_id,record_id) REFERENCES records(vehicle_id,id)
);
CREATE INDEX IF NOT EXISTS change_log_record ON change_log(vehicle_id,record_id,sequence);
CREATE TABLE IF NOT EXISTS attachments (
  vehicle_id TEXT NOT NULL,
  id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes INTEGER NOT NULL CHECK(typeof(size_bytes) = 'integer' AND size_bytes BETWEEN 1 AND 2097152),
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleted')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,id),
  FOREIGN KEY(vehicle_id,record_id) REFERENCES records(vehicle_id,id),
  CHECK(relative_path NOT LIKE '/%' AND instr(relative_path,'..') = 0 AND instr(relative_path,char(92)) = 0)
);
CREATE INDEX IF NOT EXISTS attachments_record ON attachments(vehicle_id,record_id,status);
CREATE TRIGGER IF NOT EXISTS attachments_limit_insert BEFORE INSERT ON attachments
WHEN NEW.status = 'active' AND (SELECT COUNT(*) FROM attachments WHERE vehicle_id=NEW.vehicle_id AND record_id=NEW.record_id AND status='active') >= 5
BEGIN SELECT RAISE(ABORT,'maximum five active attachments'); END;
CREATE TRIGGER IF NOT EXISTS attachments_limit_update BEFORE UPDATE OF status,vehicle_id,record_id ON attachments
WHEN NEW.status = 'active' AND (SELECT COUNT(*) FROM attachments WHERE vehicle_id=NEW.vehicle_id AND record_id=NEW.record_id AND status='active' AND NOT (vehicle_id=OLD.vehicle_id AND id=OLD.id)) >= 5
BEGIN SELECT RAISE(ABORT,'maximum five active attachments'); END;
-- Daily contributions retain allocation evidence after raw telemetry is purged.
CREATE TABLE IF NOT EXISTS day_parts (
  vehicle_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  day TEXT NOT NULL CHECK(length(day)=10 AND date(day) IS NOT NULL),
  accounting_timezone TEXT NOT NULL,
  allocation_method TEXT NOT NULL CHECK(allocation_method IN ('measured','time_prorated','start_date','manual')),
  metrics_json TEXT NOT NULL CHECK(json_valid(metrics_json) AND json_type(metrics_json)='object'),
  quality_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(quality_json) AND json_type(quality_json)='object'),
  aggregation_version INTEGER NOT NULL CHECK(aggregation_version >= 1),
  PRIMARY KEY(vehicle_id,record_id,day,accounting_timezone),
  FOREIGN KEY(vehicle_id,record_id) REFERENCES records(vehicle_id,id)
);
CREATE INDEX IF NOT EXISTS day_parts_date ON day_parts(vehicle_id,accounting_timezone,day);
CREATE TABLE IF NOT EXISTS daily_summaries (
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  day TEXT NOT NULL CHECK(length(day)=10 AND date(day) IS NOT NULL),
  accounting_timezone TEXT NOT NULL,
  distance_km REAL CHECK(distance_km >= 0),
  energy_distance_km REAL CHECK(energy_distance_km >= 0),
  drive_energy_kwh REAL CHECK(drive_energy_kwh >= 0),
  drive_soc_used_pp REAL CHECK(drive_soc_used_pp >= 0),
  parked_soc_used_pp REAL CHECK(parked_soc_used_pp >= 0),
  total_soc_used_pp REAL CHECK(total_soc_used_pp >= 0),
  battery_charge_kwh REAL CHECK(battery_charge_kwh >= 0),
  billed_charge_kwh REAL CHECK(billed_charge_kwh >= 0),
  charge_actual_krw INTEGER CHECK(charge_actual_krw IS NULL OR (typeof(charge_actual_krw)='integer' AND charge_actual_krw >= 0)),
  charge_estimated_krw INTEGER CHECK(charge_estimated_krw IS NULL OR (typeof(charge_estimated_krw)='integer' AND charge_estimated_krw >= 0)),
  charge_effective_krw INTEGER CHECK(charge_effective_krw IS NULL OR (typeof(charge_effective_krw)='integer' AND charge_effective_krw >= 0)),
  slow_count INTEGER NOT NULL DEFAULT 0 CHECK(typeof(slow_count)='integer' AND slow_count >= 0),
  fast_count INTEGER NOT NULL DEFAULT 0 CHECK(typeof(fast_count)='integer' AND fast_count >= 0),
  unknown_count INTEGER NOT NULL DEFAULT 0 CHECK(typeof(unknown_count)='integer' AND unknown_count >= 0),
  cost_categories_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(cost_categories_json) AND json_type(cost_categories_json)='object'),
  quality_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(quality_json) AND json_type(quality_json)='object'),
  provisional INTEGER NOT NULL DEFAULT 1 CHECK(provisional IN (0,1)),
  aggregation_version INTEGER NOT NULL CHECK(aggregation_version >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,day,accounting_timezone)
);
-- Efficiency is computed from matched distance/energy, never averaged ratios.
CREATE TABLE IF NOT EXISTS comparison_settings (
  vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id),
  fuel TEXT NOT NULL CHECK(fuel IN ('gasoline','diesel','premium')),
  economy_km_l REAL NOT NULL CHECK(economy_km_l > 0),
  sensor_entities_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(sensor_entities_json) AND json_type(sensor_entities_json)='object'),
  version INTEGER NOT NULL CHECK(version >= 1),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fuel_observations (
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  fuel TEXT NOT NULL CHECK(fuel IN ('gasoline','diesel','premium')),
  entity_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  price_krw_l REAL NOT NULL CHECK(price_krw_l > 0),
  unit TEXT NOT NULL CHECK(unit='KRW/L'),
  PRIMARY KEY(vehicle_id,fuel,entity_id,observed_at)
);
CREATE INDEX IF NOT EXISTS fuel_observations_time ON fuel_observations(vehicle_id,fuel,observed_at);
CREATE TABLE IF NOT EXISTS sync_state (
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  source_kind TEXT NOT NULL,
  cursor_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(cursor_json) AND json_type(cursor_json)='object'),
  phase TEXT NOT NULL CHECK(phase IN ('pending','running','complete','error')),
  last_error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,source_kind)
);
CREATE TABLE IF NOT EXISTS dirty_days (
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  day TEXT NOT NULL CHECK(length(day)=10 AND date(day) IS NOT NULL),
  accounting_timezone TEXT NOT NULL,
  generation INTEGER NOT NULL DEFAULT 1 CHECK(generation >= 1),
  reason TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(vehicle_id,day,accounting_timezone)
);
INSERT OR IGNORE INTO journal_schema(version) VALUES(1);
COMMIT;

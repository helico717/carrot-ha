-- Carrot HA Cloudflare D1 Migration Script
-- Ensures all supplementary tables exist without dropping or altering existing tables.

CREATE TABLE IF NOT EXISTS trip_quality (
  id TEXT PRIMARY KEY,
  partial INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_distance_quality (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  quality_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_history (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  UNIQUE(device_id, updated_at)
);

CREATE INDEX IF NOT EXISTS telemetry_history_updated_at_idx
  ON telemetry_history(updated_at);

CREATE TABLE IF NOT EXISTS carrot_settings_cache (
  device_id TEXT PRIMARY KEY,
  catalog_json TEXT NOT NULL,
  values_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS carrot_param_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  param_name TEXT NOT NULL,
  param_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS carrot_param_queue_device_pending_idx
  ON carrot_param_queue(device_id, status, id ASC);

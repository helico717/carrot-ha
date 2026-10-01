CREATE TABLE IF NOT EXISTS latest_state (
  device_id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  onroad INTEGER NOT NULL,
  ignition INTEGER NOT NULL,
  enabled INTEGER NOT NULL,
  voltage_v REAL,
  current_ma REAL,
  power_w REAL,
  device_power_w REAL,
  thermal_status TEXT,
  fan_percent INTEGER,
  screen_brightness_percent INTEGER,
  latitude REAL,
  longitude REAL,
  speed_mps REAL,
  bearing_deg REAL,
  gps_accuracy_m REAL,
  last_snapshot_driver_id TEXT,
  last_snapshot_wide_id TEXT,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_s INTEGER,
  distance_m REAL,
  start_lat REAL,
  start_lon REAL,
  end_lat REAL,
  end_lon REAL,
  route_point_count INTEGER NOT NULL DEFAULT 0,
  route_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS trips_device_ended_idx
  ON trips(device_id, ended_at DESC);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  camera TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  kv_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS snapshots_device_captured_idx
  ON snapshots(device_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS live_captures (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  duration_s REAL,
  content_type TEXT NOT NULL,
  camera_layout TEXT NOT NULL,
  kv_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS live_captures_device_captured_idx
  ON live_captures(device_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS impact_events (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  severity TEXT NOT NULL,
  peak_dynamic_g REAL,
  peak_total_g REAL,
  peak_jerk_g_per_s REAL,
  peak_gyro_rad_per_s REAL,
  duration_ms INTEGER,
  sample_count INTEGER,
  sensor_clipped INTEGER NOT NULL DEFAULT 0,
  latitude REAL,
  longitude REAL,
  capture_status TEXT,
  captured_at TEXT,
  capture_attempts INTEGER NOT NULL DEFAULT 0,
  wide_snapshot_id TEXT,
  driver_snapshot_id TEXT,
  notified_count INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS impact_events_device_detected_idx
  ON impact_events(device_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS vehicle_events (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  locked INTEGER,
  notified_count INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS vehicle_events_device_occurred_idx
  ON vehicle_events(device_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  token TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  app_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_device_idx
  ON push_subscriptions(device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS telemetry_history (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 device_id TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 raw_json TEXT NOT NULL,
 UNIQUE(device_id,updated_at)
);
CREATE INDEX IF NOT EXISTS telemetry_history_updated_at_idx
  ON telemetry_history(updated_at);
CREATE TABLE IF NOT EXISTS trip_quality (id TEXT PRIMARY KEY, partial INTEGER NOT NULL);

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


-- Source/quality metadata for CAN-based trip distance. No historical row rewrites.
CREATE TABLE IF NOT EXISTS trip_distance_quality (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  quality_json TEXT NOT NULL
);

-- Apply before deploying the D1-backed terminal discovery Worker.
CREATE TABLE IF NOT EXISTS terminal_bootstrap (
  device_id TEXT PRIMARY KEY,
  ha_url TEXT NOT NULL,
  terminal_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Apply before deploying the incremental-sync Worker. Safe to rerun.
-- One current revision per trip; AUTOINCREMENT prevents cursor reuse after purge.
CREATE TABLE IF NOT EXISTS trip_sync_revision (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trip_sync_device_sequence ON trip_sync_revision(device_id, sequence);
CREATE TABLE IF NOT EXISTS param_activity (
  device_id TEXT PRIMARY KEY,
  active_until INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS trip_revision_insert AFTER INSERT ON trips
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=NEW.id;
  INSERT INTO trip_sync_revision(trip_id,device_id) VALUES(NEW.id,NEW.device_id);
END;
CREATE TRIGGER IF NOT EXISTS trip_revision_update AFTER UPDATE ON trips WHEN OLD.device_id IS NOT NEW.device_id OR OLD.started_at IS NOT NEW.started_at OR OLD.ended_at IS NOT NEW.ended_at OR OLD.duration_s IS NOT NEW.duration_s OR OLD.distance_m IS NOT NEW.distance_m OR OLD.start_lat IS NOT NEW.start_lat OR OLD.start_lon IS NOT NEW.start_lon OR OLD.end_lat IS NOT NEW.end_lat OR OLD.end_lon IS NOT NEW.end_lon OR OLD.route_point_count IS NOT NEW.route_point_count OR OLD.route_json IS NOT NEW.route_json
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=NEW.id;
  INSERT INTO trip_sync_revision(trip_id,device_id) VALUES(NEW.id,NEW.device_id);
END;
CREATE TRIGGER IF NOT EXISTS trip_revision_delete AFTER DELETE ON trips
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trip_quality_revision_insert AFTER INSERT ON trip_quality
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=NEW.id;
  INSERT INTO trip_sync_revision(trip_id,device_id)
    SELECT id,device_id FROM trips WHERE id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trip_quality_revision_update AFTER UPDATE ON trip_quality WHEN OLD.partial IS NOT NEW.partial
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=NEW.id;
  INSERT INTO trip_sync_revision(trip_id,device_id)
    SELECT id,device_id FROM trips WHERE id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trip_quality_revision_delete AFTER DELETE ON trip_quality
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=OLD.id;
  INSERT INTO trip_sync_revision(trip_id,device_id)
    SELECT id,device_id FROM trips WHERE id=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trip_distance_quality_revision_insert AFTER INSERT ON trip_distance_quality
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=NEW.id;
  INSERT INTO trip_sync_revision(trip_id,device_id)
    SELECT id,device_id FROM trips WHERE id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trip_distance_quality_revision_update AFTER UPDATE ON trip_distance_quality WHEN OLD.source IS NOT NEW.source OR OLD.quality_json IS NOT NEW.quality_json
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=NEW.id;
  INSERT INTO trip_sync_revision(trip_id,device_id)
    SELECT id,device_id FROM trips WHERE id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trip_distance_quality_revision_delete AFTER DELETE ON trip_distance_quality
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=OLD.id;
  INSERT INTO trip_sync_revision(trip_id,device_id)
    SELECT id,device_id FROM trips WHERE id=OLD.id;
END;
INSERT OR IGNORE INTO trip_sync_revision(trip_id,device_id) SELECT id,device_id FROM trips;

CREATE INDEX IF NOT EXISTS telemetry_device_sequence ON telemetry_history(device_id,sequence);
CREATE INDEX IF NOT EXISTS trips_ended_id ON trips(ended_at DESC,id DESC);

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

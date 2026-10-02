-- Apply once before deploying the Worker with persisted trip boundaries.
-- No latest/history read-path query or KV writes are added.
ALTER TABLE trips ADD COLUMN measurements_json TEXT;
CREATE TRIGGER IF NOT EXISTS trip_measurement_revision_update AFTER UPDATE ON trips
WHEN OLD.measurements_json IS NOT NEW.measurements_json
BEGIN
  DELETE FROM trip_sync_revision WHERE trip_id=NEW.id;
  INSERT INTO trip_sync_revision(trip_id,device_id) VALUES(NEW.id,NEW.device_id);
END;

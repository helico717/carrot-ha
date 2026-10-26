-- Run once before the new Worker. Existing original JSON remains readable.
ALTER TABLE telemetry_history ADD COLUMN context_hash TEXT;
CREATE TABLE telemetry_contexts(device_id TEXT NOT NULL,hash TEXT NOT NULL,raw_json TEXT NOT NULL,
 PRIMARY KEY(device_id,hash));
CREATE INDEX telemetry_context_reference ON telemetry_history(device_id,context_hash);
CREATE TABLE archive_consumers(device_id TEXT PRIMARY KEY,telemetry_sequence INTEGER NOT NULL DEFAULT 0,
 trip_sequence INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
CREATE TABLE archive_budget(resource TEXT PRIMARY KEY,bytes INTEGER NOT NULL,max_bytes INTEGER NOT NULL);
INSERT INTO archive_budget SELECT 'telemetry',COALESCE(SUM(length(CAST(raw_json AS BLOB))),0),250000000 FROM telemetry_history;
INSERT INTO archive_budget SELECT 'trips',COALESCE(SUM(length(CAST(COALESCE(route_json,'') AS BLOB))+length(CAST(COALESCE(measurements_json,'') AS BLOB))),0),75000000 FROM trips;
CREATE TRIGGER archive_history_insert AFTER INSERT ON telemetry_history BEGIN
 UPDATE archive_budget SET bytes=bytes+length(CAST(NEW.raw_json AS BLOB)) WHERE resource='telemetry';
 SELECT CASE WHEN (SELECT bytes>max_bytes FROM archive_budget WHERE resource='telemetry') THEN RAISE(ABORT,'archive_capacity') END;
END;
CREATE TRIGGER archive_history_update AFTER UPDATE OF raw_json ON telemetry_history BEGIN
 UPDATE archive_budget SET bytes=bytes+length(CAST(NEW.raw_json AS BLOB))-length(CAST(OLD.raw_json AS BLOB)) WHERE resource='telemetry';
END;
CREATE TRIGGER archive_history_delete AFTER DELETE ON telemetry_history BEGIN
 UPDATE archive_budget SET bytes=bytes-length(CAST(OLD.raw_json AS BLOB)) WHERE resource='telemetry';
END;
CREATE TRIGGER archive_context_insert AFTER INSERT ON telemetry_contexts BEGIN
 UPDATE archive_budget SET bytes=bytes+length(CAST(NEW.raw_json AS BLOB)) WHERE resource='telemetry';
 SELECT CASE WHEN (SELECT bytes>max_bytes FROM archive_budget WHERE resource='telemetry') THEN RAISE(ABORT,'archive_capacity') END;
END;
CREATE TRIGGER archive_context_delete AFTER DELETE ON telemetry_contexts BEGIN
 UPDATE archive_budget SET bytes=bytes-length(CAST(OLD.raw_json AS BLOB)) WHERE resource='telemetry';
END;
CREATE TRIGGER archive_trip_insert AFTER INSERT ON trips BEGIN
 UPDATE archive_budget SET bytes=bytes+length(CAST(COALESCE(NEW.route_json,'') AS BLOB))+length(CAST(COALESCE(NEW.measurements_json,'') AS BLOB)) WHERE resource='trips';
 SELECT CASE WHEN (SELECT bytes>max_bytes FROM archive_budget WHERE resource='trips') THEN RAISE(ABORT,'archive_capacity') END;
END;
CREATE TRIGGER archive_trip_update AFTER UPDATE OF route_json,measurements_json ON trips BEGIN
 UPDATE archive_budget SET bytes=bytes+length(CAST(COALESCE(NEW.route_json,'') AS BLOB))+length(CAST(COALESCE(NEW.measurements_json,'') AS BLOB))-length(CAST(COALESCE(OLD.route_json,'') AS BLOB))-length(CAST(COALESCE(OLD.measurements_json,'') AS BLOB)) WHERE resource='trips';
 SELECT CASE WHEN (SELECT bytes>max_bytes FROM archive_budget WHERE resource='trips') THEN RAISE(ABORT,'archive_capacity') END;
END;
CREATE TRIGGER archive_trip_delete AFTER DELETE ON trips BEGIN
 UPDATE archive_budget SET bytes=bytes-length(CAST(COALESCE(OLD.route_json,'') AS BLOB))-length(CAST(COALESCE(OLD.measurements_json,'') AS BLOB)) WHERE resource='trips';
END;

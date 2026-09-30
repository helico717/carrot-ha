-- Apply before deploying the D1-backed terminal discovery Worker.
CREATE TABLE IF NOT EXISTS terminal_bootstrap (
  device_id TEXT PRIMARY KEY,
  ha_url TEXT NOT NULL,
  terminal_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

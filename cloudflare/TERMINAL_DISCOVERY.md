# Terminal discovery storage

Terminal bootstrap uses D1 `terminal_bootstrap`, keyed by device ID. No KV
read, write, or fallback occurs. The request/response protocol is unchanged:
HA publishes every 60 seconds; discovery expires after 180 seconds. GET ignores
expired rows; disable deletes the row. Expired rows are overwritten on the next
publication, so a device does not accumulate history. Stored credentials must
never be included in diagnostic query output.

## Deployment

1. Run `wrangler d1 execute id4-ha-db --remote --file migration_terminal_bootstrap.sql`.
2. Run the Worker tests and `wrangler deploy`.
3. Within a few publication intervals, verify without selecting credentials:
   `SELECT COUNT(*) AS devices, MAX(expires_at) AS latest_expiry_ms FROM terminal_bootstrap`.
4. Verify terminal reconnect from HA while parked. No HA or Comma update is
   required. During cutover, discovery may be empty until the next HA publication.

Rollback: deploy the previous Worker version; leave the additive table intact.
The old KV record expires naturally. Rollback resumes KV writes and therefore
restores the original free-quota risk.

## Free-plan validation

One continuously publishing HA entry produces approximately 1,440 D1 upserts/day
instead of KV puts. D1 index writes and other application traffic count too.
This change does not certify total account usage is within free limits.

Before downgrading, review Cloudflare daily Workers requests, KV operations,
D1 rows read/written and storage over several representative driving/parking
and troubleshooting days. Keep margin for reconnects and backlog replay.
Parameter polling currently runs every 3 seconds (up to 28,800 requests/day per
device); HA sync runs every 60 seconds and paginates history/trips. These must be
included in the request/read budget. Telemetry can upload on changes sooner than
its nominal 30-second driving / 60-second parked interval.

Camera and terminal streams in the current integration use HA relays. Legacy
KV media handlers remain in worker.js but are not exposed by its current router.
Do not infer live media health or KV media usage from those unused functions.

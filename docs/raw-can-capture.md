# Raw CAN analysis files

This feature subscribes to Comma's existing `can` stream; it sends no diagnostic
requests or other vehicle CAN messages. All received buses and payload bytes are
kept, with packet boot-clock timestamps, wall/boot clock anchors and a snapshot
of the collector's battery/charging fields and their measurement times.

Comma compresses batches with gzip and uploads them directly over HTTPS to HA,
using the existing remote-terminal discovery and credential. HA writes them to
`/config/carrot_ha/can-analysis/<entry_id>/*.json.gz`. Neither HA's archive SQLite
nor Cloudflare D1 stores these CAN batches. Comma's temporary retry queue lives
outside the Git checkout and deletes acknowledged batches.

After installing both updates, the HA switch **원시 CAN 기록 수집** starts or
stops logging. `carrot_ha.start_can_capture` also supports `entry_id` and optional
`hours` (maximum 24). Omitting `hours` enables continuous capture across restarts.
An earlier armed capture policy migrates to continuous capture; an explicitly
stopped policy stays stopped. Configure remote-terminal discovery and its HA
HTTPS URL and credentials first. Activation uses polling and can take 30 seconds
plus transport time; each batch normally covers about three seconds.

All HA entries share a **20,000,000,000-byte (20 GB)** raw-file budget, with a
small metadata reserve. New uploads rotate the oldest received gzip files when
needed. The storage and latest receipt diagnostic sensors show occupancy and
arrival information. Stopping capture retains files. Retention depends on actual
traffic; this ceiling is not a promise to retain every trip indefinitely. The
Comma retry queue is bounded at 128 MiB to protect the device during prolonged
network outages. Queue exhaustion records dropped frame counts. Files cannot
prove reception of messages that the harness or upstream messaging stream never
delivered. Actual volume depends on bus traffic and compression; 3–4 hours of
mixed driving/parking/charging is useful for automated comparison, not excessive
for analysis. Select charging transitions first, then compare candidate bits
against driving and parking to reject false matches.

## Troubleshooting

Read `capture.json` for continuous/timed activation and storage policy. `status.json` records
the last accepted batch, frame count and collector context. The status HTTP
endpoint reports activation and the shared raw-file budget. Comma
`/data/id4-collector/can-capture-spool/status.json` reports queued bytes, delivered
batches, observed drop counts and errors (use the configured DATA_DIR if different).

Use the HA SSH guide in AGENTS.md to inspect these separate files. Never query or
modify the archive SQLite for CAN analysis. Decode with `gzip.open(path, 'rt')`
and `json.load`; each frame is `[boot_timestamp_ns, arbitration_id, bus, hex_data]`.
Compare the explicit clock anchors before aligning with charging event times.
Do not print authentication tokens. A receiver ACK is sent only after the gzip
file is flushed and atomically installed; identical retry IDs are acknowledged
without duplicate files, and different data under an existing ID is rejected.

Local wire round-trip tests use the companion openpilot checkout next to this
repository: `python3 -m unittest discover -s tests -p test_can_capture.py`.
Physical capture remains unverified until both updates are installed and HA
receives a real batch; code publication alone is not evidence of live logging.

## Local validation (2026-10-04)

- HA archive/file tests: 272 tests, four dependency skips on system Python 3.9.
- Separate aiohttp HTTP capture integration: seven tests pass, covering actual
  upload, authentication/device isolation, invalid gzip, disabled capture, exact
  frame/context recovery and acknowledged queue deletion.
- Comma capture tests: three pass; parameter polling: four pass.
- Comma full suite: 69 tests before adding capture tests, with the same four
  existing camera/terminal failures (including Python 3.9 `asyncio.timeout`).
  Full aiohttp HA suite on Python 3.9 additionally exposes three existing terminal
  relay errors; the new capture HTTP tests pass independently.
- Desktop synthetic batch: 10,000 eight-byte CAN frames compressed to 168,679 bytes
  in about 4.6 ms. This is a local example, not measured Comma load or trip volume.
- Disabled logging does not open a CAN socket. Active receive work is bounded per
  iteration. The capture thread uses Linux per-thread nice 10; existing telemetry
  and control process priorities are unchanged. Transient network outages retain
  a previously authorized capture while continuous capture or its deadline remains active; authorization rejection
  stops receiving. Physical device performance and file arrival remain pending.

## Physical HA reception verified — 2026-10-04 20:28 KST

After the user updated/rebooted HA and Comma and switched ignition on, HA reported
installed beta.6 and both capture services loaded. The prepared policy activated
capture without a further service call. Files increased from 25 to 34 between
checks. All 34 gzip files decoded successfully with matching schema, device and
batch identities: 536,012 frames over 99.5 seconds, 4,972,463 compressed bytes.
The latest file was 3.8 seconds old. Collector context recorded parked gear,
zero wheel speed, charging false, battery 48,700 Wh and the existing CAN candidate
values with measurement timestamps. Reported capture queue drops were zero;
this does not prove that the upstream CAN transport lost no messages. Bus source
codes include flagged values as well as 0/1/2; do not interpret every code as a
physical bus. The collection deadline is 2026-10-05 08:22:15 KST. Logs are
separate files under the entry's can-analysis directory, and were inspected over
HA SSH. Vehicle CAN transmission was not added. Physical CPU/control latency
was not measured in this check; actual driving and charging decoding remain
future analysis, rather than requirements to declare file capture working.

Published HA release: v0.8.12-beta.6, commit fd89975959a26978cf4757fb69bc72c1cf5c5e49.
Release Actions run 37198420749 succeeded. Comma branch published/verified commit:
9c4f15803c6d895fe75907864cb51806c64745dc. Worker/D1 unchanged.

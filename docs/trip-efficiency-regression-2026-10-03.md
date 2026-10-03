# Trip efficiency regression investigation — 2026-10-03

## Cause

HA commit 939b101 rejects independently verified archive energy whenever daemon
trip_measurements.complete is false. Comma commit b9b49b4a introduced a 5-second
boundary requirement, although collector.py samples CAN for up to 4 seconds and
then sleeps 26 seconds. Valid boundaries can therefore fail completeness under
normal operation. The latest three raw trips contain incomplete measurements,
with start offsets of 13, 1, and 10 seconds and end offsets of 14, 28, and 5 seconds.
No physical vehicle fault is established by these files.

## Fix

Allow 35 seconds for daemon boundaries (one CAN sampling cycle plus scheduling
margin), and use the same bound for complete daemon measurements in HA. Incomplete
daemon evidence cannot establish energy on its own, but no longer vetoes archive
boundaries that independently pass distance eligibility, temporal proximity,
charging/invalid-sample checks and plausible-power checks. Increment derivation
version to 4. Original events are never rewritten. Archive initialization after
HA restart refreshes derivations, enabling historical recovery without new cloud
queries or a Worker migration.

## Read-only evidence and recovery

01M20PX3RFCPQMVYWXQ6GCKZKX.sqlite3 contains only six September 8 test events;
it does not explain the current screenshot. The other attached archive contains
150 trips and 26,957 state events. Fresh derivation without retained evidence
increases validated energy from 67 to 70 trips; the three recovered trips are:

| Start (KST) | Distance | Energy | Efficiency |
| --- | --- | --- | --- |
| October 3 12:04:18 | 160 km | 28.4 kWh | 5.6 km/kWh |
| October 3 11:11:30 | 8 km | 1.2 kWh | 6.7 km/kWh |
| October 3 10:42:20 | 9 km | 1.4 kWh | 6.4 km/kWh |

The latter two display as a merged 17 km trip: 2.6 kWh, approximately 6.5 km/kWh.
Replay using the retained derivation cache on a temporary database copy preserves
97 energy-bearing trips overall. This is not 97 newly recovered trips.

The October 3 00:08, 13.1258 km trip still has incomplete CAN distance, no odometer
recovery, and insufficient route validation; do not fabricate its efficiency.
Further recovery would need trustworthy start/end odometer measurements or a
complete distance record covering that trip. Collector logs around the trip and
installed Comma/HA Git versions would help diagnose distance gaps. No further
information is required to reproduce the confirmed efficiency regression.

## Validation and deployment status

HA Python: 194 tests, 192 passed, 2 skipped. Selected dashboard tests: 24 passed.
Worker incremental tests and sync benchmark passed. Comma boundary tests: 4 passed;
parameter polling: 4 passed. Full Comma suite: 53 tests, 1 camera compatibility
failure and 3 camera/terminal errors, including unavailable asyncio.timeout under
system Python 3.9 and missing camera encode_media. Those paths are unchanged.

HA changes are packaged as version 0.8.9 with version-matched release notes and
a release tag. The user will install the HACS update and restart HA. Comma changes
remain uncommitted in the local openpilot checkout for the user to commit, push,
and apply through a clean device Git update/restart. No Worker changes or new
D1 migrations are needed for this fix. Never copy or
patch Comma source through SSH/SCP. Physical-device and deployed-dashboard results
remain unverified.

# Charging ETA estimation

The production estimator uses the configured `soc_capacity_kwh` for both displayed
SOC and target energy. `measured_capacity_wh` (BMS Ah × instantaneous voltage) is
informational; it is not the ETA capacity. Calculations retain unrounded energy.

Each unique battery measurement timestamp advances the model at most once.
Sensor reads only count down the cached ETA. Battery-specific timestamps take
precedence over timestamps for other fields. Stopped charging, stale measurements
(over 180 seconds), future timestamps, non-finite values, energy above configured
capacity, and implausible energy changes produce unavailable estimates. These
checks do not establish that the underlying CAN energy calibration is correct.

Power initially uses a time-based EMA (120-second time constant). With at least
180 seconds of history, the estimator uses the net energy increase over up to
300 seconds. This is battery-side energy: no additional generic charging-loss
factor is applied. A gap over 600 seconds, capacity change, or power step over
25 kW resets history. The latter is a transition heuristic, not charger-type
identification.

A sustained falling-power sequence over at least 180 seconds and 2 SOC percentage
points can enable empirical taper correction. It requires at least four samples,
previous power above 22 kW, no upward step over 5%, and an overall drop over 10%.
The logarithmic decline is bounded to 0.08 per SOC percentage point and extrapolated
for at most 10 points; the reference curve also limits future power. These are
conservative heuristics, not a fitted or validated vehicle-specific full-charge
curve. Stable low-power charging uses observed energy rate without this correction.

ETA display adjustment is limited by elapsed measurement time (three seconds of
ETA shift per elapsed second). A small deadband preserves a stable completion
clock. Within two minutes of a target the physical estimate wins. A countdown
alone cannot mark an unreached target as zero. Zero means the configured energy
target has been reached; it is not a vehicle-reported completion signal.

## Validation on the supplied September 2026 export

Read-only recovery read 15,980 of 15,981 indexed rows; one row was unreadable.
There was one usable 80% crossing, at approximately 2026-09-12 19:52:31.5 KST,
interpolated between energy observations no more than 180 seconds apart. On its
34 pre-target charging measurements, mean absolute ETA error changed from
12.609 minutes (previous production formula and inputs) to 6.921 minutes.
Mean signed error changed from -7.677 to +0.335 minutes. These are historical
input replays, not recorded dashboard predictions. Samples within a single
session are not independent validation sessions. Initial ramp-up remains a source
of error. No reliable 100% crossing was available, so 100% accuracy is unvalidated.
The smaller export contains six test events and no usable target crossing.

To repeat the comparison, save the previous `battery.py` outside the checkout and run:

```sh
python3 scripts/replay_charging_eta.py /path/to/export.sqlite3 --baseline /path/to/previous-battery.py
```

The script opens SQLite read-only, skips unreadable rows, deduplicates battery
measurement times, and uses observed target energy crossings. It never treats a
charge-session end as a full-charge label. It prints no location or device IDs.
Raw customer databases are not committed.

The frontend debug simulator still contains its independent illustrative curve
model. Production dashboard values come from the Python estimator; the simulator
is not a substitute for measurement replay.

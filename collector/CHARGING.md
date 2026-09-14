# Charging estimation

The collector infers charging from battery energy; it does not read charger
connection status. SOC and estimated power remain available before confirmation.

- Keep the existing non-overlapping 90–240 second energy windows and 300–250,000 W plausibility range.
- Confirm a parked charge after a single increase of at least 100 Wh, or consecutive positive windows totalling at least 50 Wh (minimum two windows).
- Hold smaller increases as a persisted candidate, without adding energy or cost. A non-positive/implausible window, driving, an invalid sampling gap, or 300 seconds without further candidate progress cancels it.
- On confirmation, account for candidate windows once, using each window's time and estimated power for month and tariff selection.
- Keep an established session through brief flat readings; close after 300 seconds without a qualifying increase or on driving. Battery measurements older than 120 seconds yield unknown charging and power, even when no samples arrive.
- Upload every 30 seconds while driving and every 60 seconds while parked, including charging. Charging confirmation does not trigger an extra upload. Road-state changes still trigger an upload, as before. Sampling and power calculation intervals are unchanged.

These thresholds are heuristics. Small real charging increases can take longer to
confirm, and repeated BMS changes can still produce false positives. A periodic
upload does not guarantee a fresh power estimate or an equally frequent HA notification;
cloud polling and automation conditions also matter. Historical records are not
corrected. The SQLite schema is unchanged; candidate state is an additional JSON
field. No comma deployment is performed by committing or publishing this branch.

Run regressions on the Mac with:

```sh
python3 -m unittest discover -s collector -p 'test_*.py'
```

Before deployment, retain the installed engine.py. To roll back, stop the
collector, restore that file, and restart it. Do not automatically restore an old
state database: it could lose recent records or replay pending uploads.

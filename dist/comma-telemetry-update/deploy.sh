#!/usr/bin/env bash
# Run on a parked comma. Updates only the four telemetry source files.
set -euo pipefail
BASE=/data/id4-collector
PY=/usr/local/venv/bin/python3
BUNDLE=$(cd -- "$(dirname -- "$0")" && pwd)
FILES=(collector.py engine.py wayon_vehicle_telemetry.py telemetry_fields.py)
export PYTHONPATH="/data/openpilot/pydeps:/data/openpilot${PYTHONPATH:+:$PYTHONPATH}"
[[ -d "$BASE" && -f "$BASE/supervisor.sh" && -f "$BASE/connection.json" ]] || {
  echo 'Existing /data/id4-collector installation required.'; exit 1;
}
"$PY" - <<'PY'
from openpilot.common.params import Params
if Params().get_bool('IsOnroad'):
    raise SystemExit('Park and turn the vehicle off first; no files changed.')
PY
stop_collector() {
  rm -f "$BASE/enabled"
  pkill -f '^bash /data/id4-collector/supervisor.sh$' || [[ $? == 1 ]]
  pkill -f '^/usr/local/venv/bin/python3 -u collector.py$' || [[ $? == 1 ]]
  # Verify that both owners have released their locks before replacing code.
  flock -w 10 "$BASE/supervisor.lock" true
  flock -w 10 "$BASE/collector.lock" true
  if pgrep -f '^bash /data/id4-collector/supervisor.sh$' >/dev/null ||
     pgrep -f '^/usr/local/venv/bin/python3 -u collector.py$' >/dev/null; then
    echo 'Collector still running; refusing file replacement.'; return 1
  fi
}
start_collector() {
  touch "$BASE/enabled"
  nohup bash "$BASE/supervisor.sh" >/dev/null 2>&1 < /dev/null &
}
restore_files() {
  local file
  for file in "${FILES[@]}"; do
    if [[ -f "$BACKUP/$file" ]]; then
      cp -p "$BACKUP/$file" "$BASE/$file"
    elif [[ "$file" == telemetry_fields.py && -f "$BACKUP/telemetry_fields.absent" ]]; then
      rm -f "$BASE/$file"
    else
      echo "Missing backup file: $file"; return 1
    fi
  done
}
if [[ ${1:-} == --rollback ]]; then
  BACKUP=${2:?Supply the backup directory printed during deployment}
  [[ "$BACKUP" == "$BASE"/backup-telemetry-* && -f "$BACKUP/SHA256SUMS" ]] || exit 1
  (cd "$BACKUP" && sha256sum -c SHA256SUMS)
  for file in collector.py engine.py wayon_vehicle_telemetry.py; do
    [[ -f "$BACKUP/$file" ]] || exit 1
  done
  stop_collector
  restore_files
  start_collector
  echo "Restored: $BACKUP"
  exit 0
fi
[[ $# == 0 ]] || { echo 'Usage: bash deploy.sh [--rollback BACKUP_DIRECTORY]'; exit 1; }
cd "$BUNDLE"
sha256sum -c SHA256SUMS
"$PY" -m py_compile "${FILES[@]}"
# Import only; no main(), CAN subscription, transmission, or Params writes.
"$PY" - <<'PY'
import collector, engine, wayon_vehicle_telemetry, telemetry_fields
from opendbc.can import CANParser
CANParser('vw_meb', [(m, 0) for m in ('Motor_16','HVEM_02','MEB_HVEM_01','BMS_04',
    'Diagnose_01','Klima_Sensor_02','Klima_11','Klima_12')], 0)
for message in telemetry_fields.OPTIONAL_MESSAGES:
    try:
        CANParser('vw_meb', [(message, 0)], 0)
        print('DBC available:', message)
    except Exception:
        print('DBC unavailable (will remain unknown):', message)
PY
BACKUP=$(mktemp -d "$BASE/backup-telemetry-$(date +%Y%m%d-%H%M%S)-XXXXXX")
for file in "${FILES[@]}"; do
  if [[ -f "$BASE/$file" ]]; then
    cp -p "$BASE/$file" "$BACKUP/$file"
  elif [[ "$file" == telemetry_fields.py ]]; then
    touch "$BACKUP/telemetry_fields.absent"
  else
    echo "Missing existing collector file: $file"; exit 1
  fi
done
(cd "$BACKUP" && sha256sum ./*.py > SHA256SUMS)
echo "Backup: $BACKUP"
was_enabled=0
[[ ! -f "$BASE/enabled" ]] || was_enabled=1
recover() {
  trap - ERR
  echo "Deployment failed; restoring $BACKUP"
  if stop_collector && restore_files; then
    if [[ $was_enabled == 1 ]]; then start_collector; fi
  else
    echo "Automatic restore failed. Keep collector stopped and use backup: $BACKUP"
  fi
  exit 1
}
trap recover ERR
stop_collector
for file in "${FILES[@]}"; do cp -p "$BUNDLE/$file" "$BASE/$file"; done
(cd "$BASE" && sha256sum -c "$BUNDLE/SHA256SUMS")
start_collector
trap - ERR
echo 'Source update completed; wait 90 seconds, then run:'
echo '/usr/local/venv/bin/python3 /data/id4-collector/status.py'
echo 'tail -n 30 /data/id4-collector/collector.log'
echo "Rollback: bash $BUNDLE/deploy.sh --rollback $BACKUP"

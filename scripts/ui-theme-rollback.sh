#!/bin/sh
# Roll back the Carrot HA "ui-theme" deployment (commit e0fd23a). No Home Assistant restart needed; reload the browser.
# Usage on HA:  sudo sh /homeassistant/carrot_ha/deployment-backups/ui-theme-e0fd23a/rollback.sh
set -e
B=/homeassistant/carrot_ha/deployment-backups/ui-theme-e0fd23a
R=/homeassistant/custom_components/carrot_ha/frontend
FILES="carrot-dashboard-ko.js carrot-dashboard-en.js carrot-vehicle-journal.js carrot-charge-payment.js"
for f in $FILES; do [ -s "$B/before/$f" ] || { echo "ABORT: backup missing or empty: $f"; exit 1; }; done
( cd "$B/before" && sha256sum -c ../SHA256SUMS.before ) || { echo "ABORT: backup checksum mismatch"; exit 1; }
for f in $FILES; do cp "$B/before/$f" "$R/$f.rollbacktmp" && chmod 644 "$R/$f.rollbacktmp" && mv "$R/$f.rollbacktmp" "$R/$f"; done
rm -f "$R/carrot-ui-theme.js"
( cd "$R" && sha256sum $FILES ) > "$B/SHA256SUMS.after-rollback"
if diff "$B/SHA256SUMS.before" "$B/SHA256SUMS.after-rollback" >/dev/null; then echo "ROLLBACK OK: files restored and verified"; else echo "ROLLBACK WARNING: checksum differs"; exit 2; fi

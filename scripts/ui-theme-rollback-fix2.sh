#!/bin/sh
# Roll back only the "ui-theme fix2" deployment (commit b7cdd57) to the previous ui-theme state (0d308ee). Reload the browser afterwards.
# Usage on HA:  sudo sh /homeassistant/carrot_ha/deployment-backups/ui-theme-fix2-b7cdd57/rollback.sh
set -e
B=/homeassistant/carrot_ha/deployment-backups/ui-theme-fix2-b7cdd57
R=/homeassistant/custom_components/carrot_ha/frontend
for f in carrot-ui-theme.js carrot-dashboard-ko.js carrot-dashboard-en.js; do [ -s "$B/before/$f" ] || { echo "ABORT: backup missing or empty: $f"; exit 1; }; done
( cd "$B/before" && sha256sum -c ../SHA256SUMS.before ) || { echo "ABORT: backup checksum mismatch"; exit 1; }
for f in carrot-ui-theme.js carrot-dashboard-ko.js carrot-dashboard-en.js; do cp "$B/before/$f" "$R/$f.rollbacktmp" && chmod 644 "$R/$f.rollbacktmp" && mv "$R/$f.rollbacktmp" "$R/$f"; done
( cd "$R" && sha256sum carrot-ui-theme.js carrot-dashboard-ko.js carrot-dashboard-en.js ) > "$B/SHA256SUMS.after-rollback"
if diff "$B/SHA256SUMS.before" "$B/SHA256SUMS.after-rollback" >/dev/null; then echo "ROLLBACK OK"; else echo "ROLLBACK WARNING: checksum differs"; exit 2; fi

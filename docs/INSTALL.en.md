# Installation and recovery

The current path is Comma → your own Carrot Vehicle Receiver HAOS app → HA.
Cloudflare services are deprecated for this HA deployment; no Worker, D1 or KV setup is required.

Use the [step-by-step recovery guide](CLEAN_INSTALL_RECOVERY.md) for HA-only, Comma-only,
and combined clean installations, with and without backups. It includes Windows and Mac commands.
Install the receiver from the app repository `https://github.com/helico717/carrot-ha`, enable
startup/watchdog, configure separate upload/view credentials and external HTTPS routing, then
configure the Carrot HA integration. Install Comma code through Git, never copy source by SSH/SCP.

The previous cloud installation instructions are [archived and must not be executed](archive/cloudflare-guides-before-direct-receiver.md).

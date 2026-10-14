> Current path: Comma → own receiver app → HA. [Recovery guide](docs/CLEAN_INSTALL_RECOVERY.md).

# Carrot HA — Volkswagen MEB

[한국어](README.md) | English

Collect vehicle data on a comma device running Carrotpilot, store it in your own HAOS vehicle receiver, and view it in Home Assistant (HA). Features include trip routes, battery state of charge (SOC), estimated charging records, 14-day battery history pages, and a dedicated parameter tuning card that allows you to remotely inspect and adjust CarrotPilot parameters with official GitHub Wiki documentation. Remote physical vehicle control (steering, doors, etc.) is not supported.

The implementation was used on an ID.4 and adapted for configurable MEB vehicles. **ID. Buzz and other MEB models, and all Carrotpilot branches, have not been validated.** Home Assistant 2026.9 or later is required. The dashboard API currently requires an HA administrator account.

## Documentation & Guides

- [Development & Deployment Workflow](docs/DEVELOPMENT_WORKFLOW.md) / [AI Agent Guidelines (AGENTS.md)](AGENTS.md): **Essential reading**. Two-repository architecture and git-based deployment rules (strictly no manual SSH file manipulation on Comma).
- [Remote Terminal Setup Guide](docs/TERMINAL_SETUP.md): Cellular-ready parked remote terminal in Home Assistant with one-click Git Pull and reboot shortcuts.
- [Full Dashboard & Entity Guide (Korean)](docs/GUIDE.md): Badges, telemetry sensors, charging calculation semantics, and troubleshooting.
- [Comma Parameter Sync Setup Guide](docs/COMMA_PARAM_SETUP.md): Remote parameter tuning architecture and safety policies.
- [Parameter Sync Architecture & Safety Policy (Korean)](docs/PARAMETERS_0_6_1.md): Queue-based verification, local server validation, and elimination of unverified direct writes.
- Reflashed your comma? See the [Windows/Mac collector recovery guide (Korean)](docs/REINSTALL.md), including lost credentials and end-to-end HA checks.

## Installation and recovery

Follow the [step-by-step installation and recovery guide](docs/CLEAN_INSTALL_RECOVERY.md).
It covers HA-only, Comma-only and combined clean installations, backups, and Windows/Mac commands.
Install your own HAOS receiver app, configure external HTTPS, and connect the HA integration.
No cloud account setup is required.

Dashboard resource: `/carrot_ha_static/carrot-dashboard.js` (JavaScript module).

```yaml
type: custom:carrot-dashboard-card
device_id: YOUR_EXISTING_DEVICE_ID
```

## Other MEB vehicles

- Start with Carrotpilot already working on your vehicle.
- The `vw_meb` DBC (the definitions used to interpret CAN messages) and the required messages must be available. Installer checks do not prove that the readings are correct on your vehicle.
- While parked, compare SOC, odometer, and outside temperature with the vehicle. Check trip and charging records after normal use.
- Do not assume an ID. Buzz has the same battery capacity as an ID.4. Configure the SOC calculation capacity for your vehicle.
- Charging power is estimated from battery energy increases, not read from the charger's meter. Slow/fast charging classification is also an estimate.
- Collected but unsent records are retried after connectivity returns. Periods without power or CAN data cannot be reconstructed.
- Some calculations and labels remain Korea-oriented, including charging cost estimates in KRW. Do not treat them as local electricity bills.

## Privacy

Each user runs their own vehicle receiver service. Never upload tokens, databases, routes, logs, or connection settings to this repository. The project does not provide a shared server collecting users' vehicle data.

## Credits

Legacy server and CAN reference code: [source information](cloudflare/SOURCE.md), [legacy server license](cloudflare/LICENSE.upstream), [collector reference license](collector/LICENSE.reference).
Maps use Leaflet and OpenStreetMap; keep map attribution visible. The project owner supplied the brand image. This is not an official or certified Carrotpilot, Volkswagen, or Home Assistant product.

Maintainers: see [publishing and releases](docs/PUBLISH.en.md).

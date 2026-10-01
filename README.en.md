# Carrot HA — Volkswagen MEB

[한국어](README.md) | English

Collect vehicle data on a comma device running Carrotpilot, store it in your own Cloudflare account, and view it in Home Assistant (HA). Features include trip routes, battery state of charge (SOC), estimated charging records, seven-day battery history charts, and a dedicated parameter tuning card that allows you to remotely inspect and adjust CarrotPilot parameters with official GitHub Wiki documentation. Remote physical vehicle control (steering, doors, etc.) is not supported.

The implementation was used on an ID.4 and adapted for configurable MEB vehicles. **ID. Buzz and other MEB models, and all Carrotpilot branches, have not been validated.** Home Assistant 2026.9 or later is required. The dashboard API currently requires an HA administrator account.

## Documentation & Guides

- [Development & Deployment Workflow](docs/DEVELOPMENT_WORKFLOW.md) / [AI Agent Guidelines (AGENTS.md)](AGENTS.md): **Essential reading**. Two-repository architecture and git-based deployment rules (strictly no manual SSH file manipulation on Comma).
- [Remote Terminal Setup Guide](docs/TERMINAL_SETUP.md): Cellular-ready parked remote terminal in Home Assistant with one-click Git Pull and reboot shortcuts.
- [Full Dashboard & Entity Guide (Korean)](docs/GUIDE.md): Badges, telemetry sensors, charging calculation semantics, and troubleshooting.
- [Comma Parameter Sync Setup Guide](docs/COMMA_PARAM_SETUP.md): Remote parameter tuning architecture and safety policies.
- [Parameter Sync Architecture & Safety Policy (Korean)](docs/PARAMETERS_0_6_1.md): Queue-based verification, local server validation, and elimination of unverified direct writes.
- Reflashed your comma? See the [Windows/Mac collector recovery guide (Korean)](docs/REINSTALL.md), including lost credentials and end-to-end HA checks.

## Architecture & Installation

1. **Comma 4 (Git-Managed Native Daemon)**:
   - Use [`helico717/openpilot`](https://github.com/helico717/openpilot) on branch `carrot-wip-model_selector-ha`.
   - The collector, param sync, and reverse terminal daemons are natively built into `selfdrive/carrot/ha`. No manual file copy or SSH installation needed.
   - Follow the [installation guide](docs/INSTALL.en.md) to register connection info (`connection.json`) and prepare your Cloudflare worker.
2. In HACS, open the menu → Custom repositories. Add `https://github.com/helico717/carrot-ha` with type **Integration**.
3. Download Carrot HA and restart HA.
4. Open Settings → Devices & services → Add integration → Carrot HA. Enter your chosen device ID and dedicated token.
5. In the integration options, enter the Worker URL, read token, vehicle model, and SOC calculation capacity. Check the capacity for your specific vehicle.
6. Register dashboard resources:
   - `/carrot_ha_static/carrot-dashboard.js` (JavaScript module: Dashboard & Params cards)
   - `/carrot_ha_static/carrot-terminal-card.js` (JavaScript module: Remote Web Terminal card)
7. **Vehicle Dashboard Card**: Add a manual card using the same device ID as the collector and integration:

```yaml
type: custom:carrot-dashboard-card
device_id: my-meb
vehicle_name: ID. Buzz
```

8. **CarrotPilot Parameter Tuning Card**: Add a manual card:

```yaml
type: custom:carrot-params-card
device_id: my-meb
```

9. **Comma Remote Terminal Card**: Add a manual card:

```yaml
type: custom:carrot-terminal-card
device_id: my-meb
title: Comma Remote Terminal
```
- Remotely attach to the Comma PTY shell even over cellular when parked.
- Features one-click workflow action buttons: **`[🔍 업데이트 확인]`**, **`[📥 당근 Git Pull]`**, and **`[🔄 기기 재부팅]`**.



## Other MEB vehicles

- Start with Carrotpilot already working on your vehicle.
- The `vw_meb` DBC (the definitions used to interpret CAN messages) and the required messages must be available. Installer checks do not prove that the readings are correct on your vehicle.
- While parked, compare SOC, odometer, and outside temperature with the vehicle. Check trip and charging records after normal use.
- Do not assume an ID. Buzz has the same battery capacity as an ID.4. Configure the SOC calculation capacity for your vehicle.
- Charging power is estimated from battery energy increases, not read from the charger's meter. Slow/fast charging classification is also an estimate.
- Collected but unsent records are retried after connectivity returns. Periods without power or CAN data cannot be reconstructed.
- Some calculations and labels remain Korea-oriented, including charging cost estimates in KRW. Do not treat them as local electricity bills.

## Privacy

Each user runs their own Cloudflare service. Never upload tokens, databases, routes, logs, or connection settings to this repository. The project does not provide a shared server collecting users' vehicle data.

## Credits

Cloudflare and CAN reference code: [source information](cloudflare/SOURCE.md), [Cloudflare license](cloudflare/LICENSE.upstream), [collector reference license](collector/LICENSE.reference).
Maps use Leaflet and OpenStreetMap; keep map attribution visible. The project owner supplied the brand image. This is not an official or certified Carrotpilot, Volkswagen, or Home Assistant product.

Maintainers: see [publishing and releases](docs/PUBLISH.en.md).

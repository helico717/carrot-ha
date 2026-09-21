# Carrot HA — Volkswagen MEB

[한국어](README.md) | English

Collect vehicle data on a comma device running Carrotpilot, store it in your own Cloudflare account, and view it in Home Assistant (HA). Features include trip routes, battery state of charge (SOC), estimated charging records, seven-day battery history charts, and a dedicated parameter tuning card that allows you to remotely inspect and adjust CarrotPilot parameters with official GitHub Wiki documentation. Remote physical vehicle control (steering, doors, etc.) is not supported.

The implementation was used on an ID.4 and adapted for configurable MEB vehicles. **ID. Buzz and other MEB models, and all Carrotpilot branches, have not been validated.** Home Assistant 2026.3 or later is required. The dashboard API currently requires an HA administrator account.

## Documentation & Guides

- [Full Dashboard & Entity Guide (Korean)](docs/GUIDE.md): Badges, telemetry sensors, charging calculation semantics, and troubleshooting.
- [Comma Parameter Sync Setup Guide (Korean)](docs/COMMA_PARAM_SETUP.md): Installing `param_sync.py` on your comma device to enable remote parameter tuning.
- [Parameter Sync Architecture & Safety Policy (Korean)](docs/PARAMETERS_0_6_1.md): Queue-based verification, local server validation, and elimination of unverified direct writes.
- Reflashed your comma? See the [Windows/Mac collector recovery guide (Korean)](docs/REINSTALL.md), including lost credentials and end-to-end HA checks.

## Installation

1. Follow the [installation guide](docs/INSTALL.en.md) to prepare your Cloudflare service and comma collector (including `collector/param_sync.py`).
2. In HACS, open the menu → Custom repositories. Add `https://github.com/helico717/carrot-ha` with type **Integration**.
3. Download Carrot HA and restart HA.
4. Open Settings → Devices & services → Add integration → Carrot HA. Enter your chosen device ID and dedicated token.
5. In the integration options, enter the Worker URL, read token, vehicle model, and SOC calculation capacity. Check the capacity for your specific vehicle.
6. Add `/carrot_ha_static/carrot-dashboard.js` as a **JavaScript module** dashboard resource (this bundles both the dashboard card and the parameter tuning card).
7. **Vehicle Dashboard Card**: Add a manual card using the same device ID as the collector and integration:

```yaml
type: custom:carrot-dashboard-card
device_id: my-meb
vehicle_name: ID. Buzz
# If you placed your own vehicle image in HA /config/www/:
# vehicle_image: /local/my-car.png
```

The default image is the Carrot HA icon. Use an image you have permission to use. See [image requirements](docs/VEHICLE-IMAGE.en.md). Vehicle entities are discovered automatically; their names do not need to start with `test_id4`. You can override them with `charging_entity` and `online_entity` in the card configuration.

8. **CarrotPilot Parameter Tuning Card**: Add a manual card:

```yaml
type: custom:carrot-params-card
device_id: my-meb
```

- Renders the authentic Carrot Web settings interface (from comma port 7000) inside HA, preserving full category trees, numeric steppers, switches, and popup dialogs.
- Loads official Markdown documentation for each parameter dynamically from the GitHub Wiki (`Settings-Catalog.json`).
- Features a top status strip displaying real-time vehicle sync status (`Connected`, `Pending`, `Applied by Comma`, `Error`, etc.) and last updated timestamp.
- All writes are tracked by Cloudflare D1 queue IDs, verified and applied locally via the comma's `:7000/api/param_set` endpoint, and read back before final confirmation.

**Dashboard language:** follows the HA user language (Korean → Korean; other languages → English). Set `language: en` or `language: ko` in the card to override it. `language: auto` follows HA. Entity names outside the dashboard are unchanged. SOC means battery state of charge. Charging power and classification remain estimates.

```yaml
type: custom:carrot-dashboard-card
device_id: my-meb
language: en
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

Each user runs their own Cloudflare service. Never upload tokens, databases, routes, logs, or connection settings to this repository. The project does not provide a shared server collecting users' vehicle data.

## Credits

Cloudflare and CAN reference code: [source information](cloudflare/SOURCE.md), [Cloudflare license](cloudflare/LICENSE.upstream), [collector reference license](collector/LICENSE.reference).
Maps use Leaflet and OpenStreetMap; keep map attribution visible. The project owner supplied the brand image. This is not an official or certified Carrotpilot, Volkswagen, or Home Assistant product.

Maintainers: see [publishing and releases](docs/PUBLISH.en.md).

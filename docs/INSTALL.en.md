# First-time installation

[한국어](INSTALL.md) | English | [Overview](../README.en.md)

This guide assumes HA is already running and you can connect to your comma device over SSH. Carrotpilot must already work on your vehicle. For a factory-reset device, install Carrotpilot following its maintainer's instructions first. A matching branch name alone does not guarantee compatibility.

> Reset only your comma? Reuse the existing server: see the [Windows/Mac recovery guide (Korean)](REINSTALL.md).

## 1. Prepare files on your computer

### Windows PowerShell

On GitHub choose Code → Download ZIP and extract it. Run the following PC commands in PowerShell opened in the extracted `cloudflare` folder. These instructions use Windows command syntax.

Install the x64 Windows version of Node.js from its official website. Check `node -p "process.arch"`: `ia32` means a 32-bit installation, which must be replaced for this setup.

```powershell
npm.cmd install
.\node_modules\.bin\wrangler.cmd login
.\node_modules\.bin\wrangler.cmd d1 create id4-ha-db
.\node_modules\.bin\wrangler.cmd kv namespace create SNAPSHOTS
```

Create your own Cloudflare account. D1 stores records; KV is an auxiliary store required by the service. Save the returned `database_id` and KV `id` and enter them into the setup script below. Internal names containing `id4` are retained for compatibility and are also used for ID. Buzz installations.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
.\node_modules\.bin\wrangler.cmd d1 execute id4-ha-db --remote --file .\schema.sql
.\node_modules\.bin\wrangler.cmd deploy
```

Save the full HTTPS Worker address shown after deployment, including your account's subdomain. You do not need a separate domain or inbound HA port forwarding. Check Cloudflare for service limits and charges.

Generate three dedicated passwords, called tokens:

```powershell
node -e "const c=require('node:crypto'); for(const k of ['UPLOAD','VIEW','HA_LOCAL']) console.log(k+': '+c.randomBytes(32).toString('hex'))"
.\node_modules\.bin\wrangler.cmd secret put WAYON_UPLOAD_TOKEN
.\node_modules\.bin\wrangler.cmd secret put WAYON_VIEW_TOKEN
```

Store all three privately. Enter the UPLOAD value into the first secret prompt and VIEW into the second, without the labels. HA_LOCAL is used when creating the HA integration entry. Never publish these values.

### Mac Terminal

Install Node.js for your Mac architecture (arm64 for Apple Silicon, x64 for Intel). Extract the repository ZIP and open Terminal in its `cloudflare` directory, for example `cd "$HOME/Downloads/carrot-ha-main/cloudflare"`.
Run the resource creation commands only when creating a **new server**, not when restoring comma alone.

```bash
npm install
npx wrangler login
npx wrangler d1 create id4-ha-db
npx wrangler kv namespace create SNAPSHOTS
```
Save the D1 database_id and KV id. Instead of the Windows-only setup.ps1, use a code editor to create `cloudflare/wrangler.json` with this content. Replace both YOUR_ placeholders with your actual IDs. Inspect any existing configuration before replacing it.

```json
{
  "name": "id4-ha-cloud",
  "main": "src/worker.js",
  "compatibility_date": "2026-05-14",
  "workers_dev": true,
  "d1_databases": [
    {"binding": "DB", "database_name": "id4-ha-db", "database_id": "YOUR_D1_DATABASE_ID"}
  ],
  "kv_namespaces": [
    {"binding": "SNAPSHOTS", "id": "YOUR_KV_NAMESPACE_ID"}
  ]
}
```
In the same cloudflare directory, execute each command separately and stop on errors.

```bash
npx wrangler d1 execute id4-ha-db --remote --file schema.sql
npx wrangler deploy
node -e "const c=require('node:crypto'); for(const k of ['UPLOAD','VIEW','HA_LOCAL']) console.log(k+': '+c.randomBytes(32).toString('hex'))"
npx wrangler secret put WAYON_UPLOAD_TOKEN
npx wrangler secret put WAYON_VIEW_TOKEN
```
Save the deployed Worker HTTPS URL and all three tokens privately. Enter UPLOAD at the first secret prompt and VIEW at the second; HA_LOCAL is for initial HA registration. Do not run Windows .cmd or PowerShell commands on macOS.

## 2. Configure HA

Follow the HACS steps in the [overview](../README.en.md). Choose a device ID such as `my-buzz`; it is neither the VIN nor an HA entity ID. Use HA_LOCAL for initial registration and VIEW for the read token in options. Set your vehicle model and SOC calculation capacity.

## 3. Install the collector on comma

Park the vehicle first. SSH authentication and recovery are covered in the [Windows/Mac recovery guide (Korean)](REINSTALL.md). Copy the collector files using the commands below from the extracted repository root. Replace the path and IP with yours. Stop if any command fails. If a collector already exists, use the [upgrade guide](COMMA-DEPLOY-ENGINE.md) instead of overwriting running files.

**Windows PowerShell:**

```powershell
Set-Location "$env:USERPROFILE\Downloads\carrot-ha-main"
ssh comma@192.168.43.1 'mkdir -p /data/id4-collector'
scp .\collector\collector.py .\collector\engine.py .\collector\configure.py .\collector\install.py .\collector\disable.py .\collector\status.py .\collector\wayon_vehicle_telemetry.py .\collector\supervisor.sh .\collector\LICENSE.reference comma@192.168.43.1:/data/id4-collector/
ssh comma@192.168.43.1
```

**Mac Terminal:**

```bash
cd "$HOME/Downloads/carrot-ha-main"
ssh comma@192.168.43.1 'mkdir -p /data/id4-collector'
scp collector/collector.py collector/engine.py collector/configure.py collector/install.py collector/disable.py collector/status.py collector/wayon_vehicle_telemetry.py collector/supervisor.sh collector/LICENSE.reference comma@192.168.43.1:/data/id4-collector/
ssh comma@192.168.43.1
```

For a custom port, add `-p PORT` to every ssh command and `-P PORT` to every scp command. Add `-i KEY_PATH` to both if needed. Windows users can alternatively use WinSCP.

In comma SSH, for a new installation:

```bash
cd /data/id4-collector
python3 configure.py
```

Enter your Worker URL, the same device ID used in HA, and the UPLOAD token. Then run:

```bash
PYTHONPATH="/data/openpilot/pydeps:/data/openpilot${PYTHONPATH:+:$PYTHONPATH}" /usr/local/venv/bin/python3 install.py
python3 /data/id4-collector/status.py >&2
```

The installer checks the startup script and DBC structure before registering automatic startup. If it reports an unsupported startup file or missing module, report the error and branch information instead of bypassing the check. The collector is a separate process and consumes additional memory.

## 4. Validate your MEB vehicle

1. While parked, compare battery, odometer, and temperature readings with the vehicle. Missing values do not indicate successful support.
2. Check `tail -n 30 /data/id4-collector/collector.log >&2` after installation.
3. After normal use, check trip routes and charging records. Collection is receive-only; it does not send CAN control commands.
4. After an internet outage, confirm `pending` decreases and delivery becomes `ok`. Missing data while comma was off or the vehicle was asleep cannot be recovered.
5. To stop collection, run `python3 /data/id4-collector/disable.py`. Stored data and the Git checkout are preserved.

ID. Buzz has not yet been validated on a real vehicle. Record the model year, battery specification, Carrotpilot branch, and commit when reporting compatibility, excluding personal information and tokens.

## Limitations

Charging classification, power, and SOC are estimates. The graph may carry forward the last known value through missing periods, but excludes those carried values from consumption calculations. Records may be removed under the configured server/HA retention policies; consult the [full guide (Korean)](GUIDE.md).

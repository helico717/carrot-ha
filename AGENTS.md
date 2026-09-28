# AGENTS.md — Developer & AI Agent Guidelines

> **CRITICAL RULE FOR ALL AI AGENTS & DEVELOPERS:**
> 🛑 **NEVER MODIFY COMMA FILES DIRECTLY VIA SSH OR SCP!**
> Do **NOT** connect via SSH/SCP to manually copy, edit, patch, or `mv` files in `/data` or `/data/openpilot` on the Comma device.
>
> **Why? (The Hard-Learned Lesson from Astra / Past Iterations):**
> Comma 3/3X runs openpilot directly out of a Git repository (`/data/openpilot`). Manually copying scripts into `/data`, injecting files into `/data/continue.sh`, or modifying python files on the device:
> 1. Dirties the working tree and breaks `git pull --ff-only`.
> 2. Gets erased or creates nasty merge conflicts whenever upstream updates or branch changes occur.
> 3. Disconnects local changes from git history, causing duplicated work, broken deployments, and confusion across AI sessions.
>
> All code running on Comma **MUST** be committed and pushed to git, then pulled cleanly on the device.

---

## 1. Two-Repository Architecture

The Carrot HA system is strictly divided into two independent repositories:

```
┌────────────────────────────────────────────────────────┐
│               Comma 3 / 3X Device                      │
│                                                        │
│  Repository: helico717/openpilot                       │
│  Branch:     carrot-wip-model_selector-ha              │
│                                                        │
│  • openpilot/selfdrive/carrot/ha/ (Daemon)             │
│    - collector.py (CAN telemetry ingestion)           │
│    - engine.py (Calculations, charging state)         │
│    - param_sync.py (CarrotPilot params sync)          │
│    - terminal.py (Parked reverse WSS terminal)        │
│    - wayon_vehicle_telemetry.py (CAN decoder)         │
│  • system/manager/process_config.py (manager daemon)   │
│  • .github/workflows/ (Upstream auto-sync action)     │
└──────────────────────────┬─────────────────────────────┘
                           │ Outbound HTTPS / WSS
                           ▼
┌────────────────────────────────────────────────────────┐
│               Cloudflare Worker                        │
│               id4-ha-cloud.ha-id4.workers.dev          │
│                                                        │
│  • D1 Database: Telemetry storage & Param Sync Queue   │
│  • KV Namespace: SNAPSHOTS                             │
│  • WSS Relay: Parked reverse terminal bridging        │
└──────────────────────────▲─────────────────────────────┘
                           │ Inbound HTTPS / WSS
┌──────────────────────────┴─────────────────────────────┐
│               Home Assistant Server                    │
│                                                        │
│  Repository: helico717/carrot-ha                       │
│  Branch:     main                                      │
│                                                        │
│  • custom_components/carrot_ha/ (HA Integration)       │
│    - sensor, camera, device_tracker, switch            │
│    - websocket_api (Terminal & Param Sync bridge)      │
│    - frontend/ (Lovelace Cards)                        │
│      * carrot-dashboard.js                             │
│      * carrot-params-card.js                           │
│      * carrot-terminal-card.js                         │
│  • cloudflare/ (Worker code & D1 schema)               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Decision Matrix: Where Do Your Changes Belong?

| If the user asks you to... | Work in this repository | Target Path | Deployment Method |
| :--- | :--- | :--- | :--- |
| **Change CAN decoding, battery calculation, or Comma telemetry signals** | `helico717/openpilot` (branch: `carrot-wip-model_selector-ha`) | `openpilot/selfdrive/carrot/ha/` | Commit & push to GitHub → Comma runs `git pull` |
| **Modify CarrotPilot parameter sync daemon on Comma** | `helico717/openpilot` (branch: `carrot-wip-model_selector-ha`) | `openpilot/selfdrive/carrot/ha/param_sync.py` | Commit & push to GitHub → Comma runs `git pull` |
| **Modify the reverse terminal daemon on Comma** | `helico717/openpilot` (branch: `carrot-wip-model_selector-ha`) | `openpilot/selfdrive/carrot/ha/terminal.py` | Commit & push to GitHub → Comma runs `git pull` |
| **Modify Home Assistant sensors, coordinator, or entities** | `helico717/carrot-ha` (branch: `main`) | `custom_components/carrot_ha/` | Commit & push to GitHub → Update in HA & restart |
| **Update the Lovelace cards (Dashboard, Params, Terminal Card)** | `helico717/carrot-ha` (branch: `main`) | `custom_components/carrot_ha/frontend/` | Commit & push to GitHub → Refresh browser (`Ctrl+F5`) |
| **Update Cloudflare Worker API, D1 schema, or WSS relay** | `helico717/carrot-ha` (branch: `main`) | `cloudflare/src/worker.js` | `cd cloudflare && npx wrangler deploy` |

---

## 3. How to Deploy Changes

### A. Deploying Comma Device Changes (`helico717/openpilot`)

1. **Local Development**:
   - Clone or navigate to the local `openpilot` repository (e.g. `c:\Users\limkw\OneDrive\Documents\GitHub\openpilot`).
   - Ensure you are on branch `carrot-wip-model_selector-ha`.
   - Implement your changes in `openpilot/selfdrive/carrot/ha/` or other relevant openpilot modules.
   - Run unit tests:
     ```bash
     python -m unittest discover openpilot/selfdrive/carrot/ha/tests
     ```

2. **Commit & Push**:
   ```bash
   git add <modified-files>
   git commit -m "feat(carrot-ha): <descriptive message>"
   git push origin carrot-wip-model_selector-ha
   ```

3. **Deploy to Comma (NO SSH NEEDED!)**:
   - **Method 1 (Recommended — One-Click from Home Assistant)**:
     1. Open Home Assistant dashboard.
     2. On the **Comma 원격 터미널** card, click **[연결]**.
     3. Click **`[📥 당근 Git Pull]`**.
        *(This sends `cd /data/openpilot && git reset --hard && git pull --ff-only` to ensure a clean, fast-forward update without merge conflicts).*
     4. Click **`[🔄 기기 재부팅]`** to restart Comma and apply changes cleanly under `manager.py`.
   - **Method 2 (Carrot Web UI)**:
     - Open `http://<comma-ip>:7000` in a browser and click the update button.
   - **Method 3 (Command Line if already in terminal)**:
     ```bash
     cd /data/openpilot && git reset --hard && git pull --ff-only && sudo reboot
     ```

### B. Deploying Home Assistant Changes (`helico717/carrot-ha`)

1. **Local Development**:
   - Work in `custom_components/carrot_ha/`.
   - If updating JS cards, validate syntax with `node --check <file>.js`.
2. **Commit & Push**:
   ```bash
   git add <modified-files>
   git commit -m "feat: <descriptive message>"
   git push origin main
   ```
3. **Deploy to Home Assistant**:
   - Pull latest changes on the HA host or re-download via HACS.
   - Restart Home Assistant: **Developer Tools → YAML → Restart**.
   - If frontend cards were updated, hard-reload browser cache (`Ctrl + F5` or `Cmd + Shift + R`).

### C. Deploying Cloudflare Worker Changes

1. Navigate to the `cloudflare/` directory:
   ```bash
   cd cloudflare
   ```
2. Deploy via Wrangler:
   ```bash
   npx wrangler deploy
   ```
3. If D1 database migrations are needed:
   ```bash
   npx wrangler d1 execute id4-ha-db --remote --file migration.sql
   ```

---

## 4. Role of Remote Terminal vs SSH

| Access Method | Protocol | Availability | Purpose | What NEVER to do |
| :--- | :--- | :--- | :--- | :--- |
| **Home Assistant Remote Terminal Card** | Reverse WSS via Cloudflare Worker | Available whenever parked (even on cellular!) | Diagnostics, checking git status (`[🔍 업데이트 확인]`), pulling code (`[📥 당근 Git Pull]`), rebooting (`[🔄 기기 재부팅]`) | **Do NOT** use it to manually rewrite python files on the device. |
| **Direct SSH (Port 22)** | Local SSH / Hotspot | Only when connected to Comma's local Wi-Fi hotspot (`192.168.43.1`) | **Emergency disaster recovery only** (e.g. bootloop, network interface crash). | **Do NOT** use for regular feature development or deployment. |

---

## 5. Persistent State & Storage Rules on Comma

- **Git Directory (`/data/openpilot`)**:
  - Must remain strictly clean at all times.
  - Runtime logs, sqlite databases, and cached tokens **must never** be written inside `/data/openpilot`.
- **Persistent State Directory**:
  - `selfdrive/carrot/ha` stores its runtime sqlite database and config under `/data/id4-collector/` or `/data/carrot_ha/` (outside the git tree).
  - Openpilot Params (`/data/params/d/`) are used for vehicle state flags.
- **Auto-Sync Workflow**:
  - The GitHub Action `.github/workflows/sync_upstream_model_selector.yml` automatically pulls upstream changes from `ajouatom/openpilot:carrot-wip-model_selector` while preserving our `carrot_ha` daemon commits.
  - Keeping `/data/openpilot` clean ensures that auto-sync merges never encounter conflicts on the physical device.

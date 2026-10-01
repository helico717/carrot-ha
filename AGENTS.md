# AGENTS.md — Developer & AI Agent Guidelines

> **CRITICAL RULE FOR ALL AI AGENTS & DEVELOPERS:**
> 🛑 **NEVER MODIFY COMMA FILES DIRECTLY VIA SSH OR SCP!**
> Do **NOT** connect via SSH/SCP to manually copy, edit, patch, or `mv` files in `/data` or `/data/openpilot` on the Comma device.
>
> **Why? (The Hard-Learned Lesson from Astra / Past Iterations):**
> Comma 4 runs openpilot directly out of a Git repository (`/data/openpilot`). Manually copying scripts into `/data`, injecting files into `/data/continue.sh`, or modifying python files on the device:
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
│               Comma 4 Device                           │
│                                                        │
│  Repository: helico717/openpilot                       │
│  Branch:     carrot-wip-model_selector-ha              │
│                                                        │
│  • openpilot/selfdrive/carrot/ha/ (Daemon)             │
│    - collector.py (CAN telemetry ingestion)           │
│    - engine.py (Calculations, charging state)         │
│    - param_sync.py (CarrotPilot params sync)          │
│    - terminal.py (Parked reverse WSS terminal)        │
│    - camera/ (Git-managed parked camera service)     │
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
┌────────────────────────────────────────────────────────┐
│               Home Assistant Server                    │
│                                                        │
│  Repository: helico717/carrot-ha                       │
│  Branch:     main                                      │
│                                                        │
│  • custom_components/carrot_ha/ (HA Integration)       │
│    - sensor, device_tracker, switch                    │
│    - websocket_api (Terminal & Param Sync bridge)      │
│    - camera_http.py (WebCodecs WSS Relay endpoint)     │
│    - frontend/ (Lovelace Cards)                        │
│      * carrot-dashboard.js (ko/en main dashboards)     │
│      * carrot-camera-360.js (WebGL 360° modal & WSS)   │
│      * carrot-params-card.js                           │
│      * carrot-terminal-card.js                         │
│      * carrot-dashboard-debug.js                       │
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
| **Modify the parked camera agent, capture, or compatibility checks on Comma** | `helico717/openpilot` (branch: `carrot-wip-model_selector-ha`) | `openpilot/selfdrive/carrot/ha/camera/` | Commit & push → clean Git pull & reboot; no camera ZIP/SCP |
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

Home Assistant 개발 시에는 작업 성격에 따라 **[트랙 1: 개발/트러블슈팅 빠른 반영]**과 **[트랙 2: 정식 릴리즈 배포]**의 두 가지 워크플로우로 나누어 관리합니다.

#### 🛠️ 트랙 1. 개발/트러블슈팅 빠른 반영 (HACS 베타 Pre-release 워크플로우 또는 직접 동기화)
HACS 2.0은 릴리스가 존재하는 저장소의 경우 GitHub Release만 다운로드합니다. 따라서 개발 중 테스트 시에는 다음 두 가지 방법 중 하나를 사용합니다:

- **방법 A (HACS 베타 Pre-release 배포 — 원격 HACS 권장)**:
  1. `manifest.json` 버전을 베타로 설정 (예: `"0.8.8-beta.1"`).
  2. 커밋 및 태그 푸시:
     ```bash
     git add custom_components/carrot_ha/manifest.json <modified-files>
     git commit -m "chore: bump version to 0.8.8-beta.1"
     git push origin main
     git tag v0.8.8-beta.1
     git push origin v0.8.8-beta.1
     ```
  3. GitHub Actions가 `prerelease: true` 플래그로 릴리스를 자동 생성합니다. (일반 사용자에게는 업데이트 알림이 뜨지 않음).
  4. HA의 HACS → Carrot HA → 우측 상단 점 3개 메뉴(**`⋮`**)에서 **`베타 버전 표시 (Show beta versions)`** 토글을 켜면 `0.8.8-beta.1`이 나타나며 즉시 업데이트/다시 다운로드할 수 있습니다.

- **방법 B (HA 서버 직접 동기화 — SSH/Samba 접근 가능 시 최속)**:
  - SSH `rsync`나 Samba 네트워크 드라이브를 통해 로컬 `custom_components/carrot_ha/`를 HA 서버의 `/config/custom_components/carrot_ha/`로 즉시 동기화 후 HA 재시작. (태그 발행 불필요).

---

#### 🚀 트랙 2. 정식 버전 배포 (유의미한 기능 완료 시 릴리즈 발행)
기능 구현이나 안정화가 완료되어 사용자(또는 본인의 정식 업데이트 알림)에게 정식 버전으로 배포할 때만 실행합니다:

1. **Manifest 버전 갱신**:
   - `custom_components/carrot_ha/manifest.json`의 `"version"` 값 올림 (예: `"0.8.8"`).
2. **커밋 및 푸시**:
   ```bash
   git add custom_components/carrot_ha/manifest.json <other-files>
   git commit -m "chore: bump version to 0.8.8"
   git push origin main
   ```
3. **태그 푸시 (GitHub Actions가 Release 및 체인지로그 자동 생성)**:
   ```bash
   git tag v0.8.8
   git push origin v0.8.8
   ```
   > ⚠️ **HACS 버전 & 체인지로그 연동 필수 규칙:**
   > 태그를 푸시하면 `.github/workflows/release.yml`이 자동으로 GitHub Release와 커밋 내역 체인지로그를 생성합니다. GitHub Release가 있어야만 HA 업데이트 카드에 커밋 해시가 아닌 **정식 버전 번호(`0.8.8`)**와 **[릴리스 공지 읽기]** 링크가 정상 노출됩니다.
4. **HA에서 업데이트 적용**:
   - HA 업데이트 알림 카드 또는 **HACS → Carrot HA → [업데이트]** 클릭 후 HA 재시작.

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
  - The parked camera stores config and enabled state under `/data/carrot_ha/camera/`. Legacy `/data/carrot-camera` settings migrate automatically; camera program files are maintained only in openpilot Git.
- Openpilot Params (`/data/params/d/`) are used for vehicle state flags.
- **Auto-Sync Workflow**:
  - The GitHub Action `.github/workflows/sync_upstream_model_selector.yml` automatically pulls upstream changes from `ajouatom/openpilot:carrot-wip-model_selector` while preserving our `carrot_ha` daemon commits.
  - Keeping `/data/openpilot` clean ensures that auto-sync merges never encounter conflicts on the physical device.

---

## 6. 360° Parked Camera Monitoring Architecture & Dashboard Guidelines

1. **Streaming Architecture & Protocols**:
   - **WebCodecs Hardware Video Decoding**: Delivers ultra-low latency hardware H.264/HEVC decoding directly inside the browser using the modern `VideoDecoder` API.
   - **WSS Relay (`camera_http.py`)**: Streams live frames from the Comma 4 parked camera daemon through Home Assistant (`/api/carrot_ha/v1/camera/{deviceId}/live`). Supports alias resolution (`'comma'`, `'default'`, or exact device ID).
   - **Binary Framing (WLV1 protocol)**: Front (Wide) and Cabin (Driver) video streams are packed into binary payloads and rendered onto a 3D WebGL sphere with dual fisheye spherical projection.
   - **Interactive Navigation & PTZ Controls**: Users can drag to rotate 360°, use viewpoint buttons (360° View, Front, Cabin), or use the bottom-right PTZ directional pad (Up, Down, Left, Right, Center Reset). Double-click resets pitch to level (0°). Pitch is clamped to `[-20°, 25°]`.

2. **Dashboard Integration (Both Korean & English)**:
   - **Production Dashboards**: Both `carrot-dashboard-ko.js` and `carrot-dashboard-en.js` provide the `#camera360Trigger` button inside `mini-condition` (slot 3) during `parked` and `charging` states.
   - **Driving Safety Interlock**: If the vehicle transitions to `driving` or `onroad`, the camera button is hidden and slot 3 gracefully falls back to climate status (`공조` / `Climate`). If the 360° monitoring modal is currently open when driving begins, streaming automatically ceases with a safety notification (`차량 주행 감지됨 — 안전을 위해 카메라 모니터링이 자동 종료되었습니다.` / `Driving detected: camera monitoring automatically stopped for safety.`).
   - **Visual Styling**: Button uses the vehicle battery SOC blue gradient (`linear-gradient(135deg, #1260e8 0%, #0c43ad 100%)`) with 10px rounded corners, matching the dashboard curvature and adapting to dark/light themes.

3. **Snapshot & Legacy Entity Deprecation**:
   - Comma 4 does not provide an offroad still snapshot API without running full camera pipelines. Legacy `image.*_snapshot` and polling `camera.*` entities have been permanently removed.
   - `entity_migration.py` purges any leftover `camera.*` and `image.*` entities from Home Assistant entity registry upon boot.

---

## 7. Version Management & HACS Release Policy

- **Current Minor Version**: `0.8.x` (current: `0.8.8-beta.1`).
- **Strict Rule**: Maintain version `0.8`! Do **NOT** bump to `0.9` or `1.0` until all planned feature milestones and stabilization testing are complete.

### A. HACS Versioning & Changelog Visibility
1. **GitHub Releases are Mandatory**:
   - HACS inspects GitHub Releases to determine available versions. If a repository has **0 releases**, HACS automatically downgrades to *default branch tracking mode*.
   - In branch tracking mode, Home Assistant displays **commit hashes (e.g. `7e8b91a`) instead of semantic version numbers**, and the Update dialog's changelog remains completely blank.
2. **Synchronized Versioning**:
   - The `"version"` field in `custom_components/carrot_ha/manifest.json` must always match the GitHub Release tag (e.g. `v0.8.8-beta.1` or `v0.8.8`).
3. **Release Notes (Changelog)**:
   - When drafting a release on GitHub (or auto-generating via `.github/workflows/release.yml`), include concise release notes.
   - Home Assistant's Update Dialog directly renders this markdown content as the update changelog.
4. **HACS 2.0 Release-Only Policy (Why raw commits cannot be downloaded via HACS)**:
   - 저장소에 GitHub Release가 1개라도 존재하는 순간, HACS는 오직 GitHub Releases만 패키지로 인식합니다.
   - HACS의 `[다시 다운로드 (Redownload)]` 기능은 `main` 브랜치의 최신 커밋을 긁어오는 것이 아니라, 선택된 GitHub Release의 zip 파일만 내려받습니다.
   - 따라서 개발 중인 최신 커밋을 HACS를 통해 HA에 테스트 반영하려면 반드시 **HACS 베타 Pre-release 워크플로우(`v0.8.x-beta.N`)**를 사용해야 합니다.
   - `.github/workflows/release.yml`은 태그에 `beta`, `rc`, `dev`, `-` 등이 포함되어 있으면 자동으로 `prerelease: true` 플래그를 설정하므로 일반 사용자에게는 업데이트 알림이 노출되지 않습니다.

### B. Brand Assets & Logo/Icon Requirements (`custom_components/carrot_ha/brand/`)
Home Assistant 2024.3+ serves brand images locally through its `/api/brands/integration/carrot_ha/` proxy without requiring external PRs to `home-assistant/brands`.

| Asset File | Resolution | Background | Purpose & Destination |
| :--- | :--- | :--- | :--- |
| **`icon.png`** | **256 × 256** | Transparent | Standard square icon used in HA Devices & Integrations list |
| **`icon@2x.png`** | **512 × 512** | Transparent | High-DPI square icon |
| **`logo.png`** | **512 × 256** (2:1) | Transparent | **Horizontal banner logo used by HA Update Card & dialog header** |
| **`logo@2x.png`** | **1024 × 512** (2:1)| Transparent | High-DPI horizontal banner logo |

> 🛑 **RULES FOR BRAND ASSETS:**
> 1. **Never commit multi-megabyte raw images:** Images must be compressed (<50KB for 1x, <200KB for 2x). Oversized images (e.g. 4MB+) cause HA proxy timeouts and fallback to generic placeholder icons.
> 2. **Always transparent background:** Images must have transparent alpha channels around borders so they cleanly blend into both dark and light dashboard themes.
> 3. **`logo.png` is required for updates:** If only `icon.png` is present, HA update banners will fail to display the brand logo.

---

## 8. Dashboard Freshness & Free-Plan Performance Contract (2026-10-01)

Treat the 0.8.6 design as the maintained baseline. Do not reopen broad caching or
polling rewrites without a measured regression, a changed workload, or an explicit
feature request. This is a regression-prevention contract, not a claim that future
optimization is impossible or that post-deployment account quotas have been verified.

- **Latest state is an independent path.** Never wait for trips, charge history,
  battery-history computation, archive catch-up, catalog download, or map setup
  before displaying the current vehicle state. Keep the lightweight `live=1`
  endpoint free of archive work and preserve older-response rejection.
- **Visible-only refresh:** dashboard live checks target 15 seconds; HA coalesces
  all clients per entry and rate-limits both successful and failed cloud attempts.
  Refresh on visibility return. Keep actual measurement time distinct from cloud
  check time; successful checks do not make sleeping/offline measurements fresh.
- **History is incremental:** use the device-scoped monotonic trip revision cursor.
  Include updates to existing routes and quality metadata, not just new trip IDs.
  Persist the cursor only after the entire page is durably saved. Never download
  unchanged full routes each minute. Preserve HA history when cloud retention
  deletes old trips. Do not switch an authoritative external server to D1 silently.
- **Bound catch-up:** at most 10 telemetry pages and 10 trip pages per sync run;
  latest-state refresh must remain available throughout catch-up. Compatibility
  fallback applies to 404/unsupported-source 409, not arbitrary transient errors.
- **No query amplification:** current state and unchanged trip-change checks each
  use one indexed D1 query. Legacy trip quality uses two set queries, not per-trip
  queries. Device-scoped history must have a matching device/cursor index.
- **HA archive:** identical cloud events must not be rewritten or invalidate trip
  derivations. Share battery-history calculations across clients; never cache live
  state behind those calculations. Keep time-based cache expiration and invalidation
  on material event changes, settings changes, and retention cleanup.
- **Frontend:** load only mounted card implementations and the requested language.
  Do not make production cards wait for debug/other-language modules. Unchanged
  parameter snapshots should neither transfer the catalog nor refresh the iframe.
- **Reading continuity:** background updates must preserve HA ancestor and internal
  scroll positions, open details, focus, selected dates/trips/pages, and map view.
  Reuse an unchanged interactive map; never periodically reset its zoom/position.
  New trip indices must not be mistaken for a user selecting another trip.
  Do not replace the entire shadowRoot HTML during refresh: preserve existing DOM
  and stylesheet nodes. Check scroll after async responses AND subsequent animation
  frames in Chromium; a synchronous mock or screenshot before completion is insufficient.
  Follow assignedSlot as well as parentNode/host when finding HA scroll ancestors.
- **Parameter polling:** idle 15s, active editing/pending work 3s, failures back off
  up to 120s. Active leases must expire and hidden cards must not renew them.
  Initial idle-to-active discovery can take 15s plus transport/processing time;
  do not present this as instantaneous push. Preserve validation, local readback,
  durable queue-ID idempotency, explicit rejection, and ACK retries.
- **Budget:** no latest-state, history-read, or parameter-poll operation may write
  KV. A continuously visible dashboard adds at most about 5,760 latest reads/day
  per HA entry; idle parameter polling is about 5,760/day instead of 28,800/day.
  Include all Workers, telemetry, terminal discovery, settings, retries, index
  writes, and retention deletes in account-wide estimates. Never claim "free-plan
  guaranteed" from request counts alone: actual D1 rows read/written and CPU matter.
- **Rollout:** apply `cloudflare/migration_incremental_sync.sql` before the Worker,
  then update HA and the Git-managed Comma daemon. No manual device source edits.
  Full operational sign-off requires actual deployed-version checks and a 24-hour
  workload/latency/quota observation; local tests alone cannot establish that.
- **Required regression gates:** `tests/dashboard-live-loading.test.mjs`,
  `tests/dashboard-lazy-runtime.test.mjs`, `tests/dashboard-view-state.test.mjs`, `tests/test_cloud_live.py`,
  `tests/test_incremental_sync.py`, `tests/test_history_cache.py`,
  `cloudflare/test_incremental_sync.mjs`, `cloudflare/benchmark_sync.mjs`, and
  openpilot `ha/tests/test_param_polling.py`. Preserve existing auth/isolation,
  trip/charge calculation, and camera driving-interlock tests. Report pre-existing
- **Modular Sub-Cards & Universal EV Adaptation:** Any future refactoring into
  independent sub-cards (trips, charges, 360 camera chips) or rich entity attributes
  for third-party EV cards MUST strictly adhere to this Free-Plan Contract.
  Individual cards must NEVER execute separate cloud queries; all frontend cards
  must consume the shared HA local cache/coordinator (zero query amplification).
  Details: `docs/modular-ev-dashboard-architecture.md`.

Evidence and rollout details: `docs/dashboard-loading-audit-2026-10-01.md`.


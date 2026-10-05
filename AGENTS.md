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

### 기본 담당 범위 — 사용자는 설치·재시작만 수행 (2026-10-03)

Carrot HA 기능 수정·버그 해결 요청은 **업데이트 가능한 배포 준비까지** 포함합니다.
사용자가 해당 요청에서 명시적으로 로컬 작업만 요구한 경우를 제외하면,
에이전트는 아래 작업을 끝까지 수행해야 합니다. 커밋·푸시·릴리즈 발행을 사용자에게
넘기거나 로컬 수정만 남겨 둔 상태를 완료로 보고하지 마세요.

| 대상 | 에이전트가 완료할 작업 | 사용자가 수행할 작업 |
| --- | --- | --- |
| HA 통합·대시보드 | 수정, 관련 검증, `0.8.x` 버전 및 릴리즈 노트 갱신, `main` 커밋·푸시, 태그 푸시, GitHub Release 생성·Actions 성공 확인 | HACS에서 신규 릴리즈 업데이트 → HA 재시작 |
| Comma 수집기·데몬·카메라 | 로컬 openpilot 수정·검증, `carrot-wip-model_selector-ha` 커밋·푸시, 원격 브랜치의 커밋 확인 | 기기에서 `git pull --ff-only` → 재부팅 |
| Cloudflare Worker·D1 | 필요한 변경·검증, Git 커밋·푸시, 필요한 마이그레이션을 먼저 적용한 뒤 Worker 배포, 배포 결과 확인 | 별도 작업 없음 |

- HA 실행 코드가 변경되면 HACS에서 받을 수 있는 **새 GitHub Release**까지 발행합니다.
  기존 태그를 덮어쓰지 말고, manifest 버전과 새 태그를 일치시키세요.
  완료된 수정은 정식 패치 릴리즈를 기본으로 하며, 베타 테스트가 필요한 경우에만
  pre-release로 발행하고 HACS의 베타 표시 설정이 필요함을 안내하세요.
- AGENTS.md 등 지침·문서만 변경된 경우에는 커밋·푸시하고, 실행 코드 변경이 없는
  불필요한 버전 상승·HACS 릴리즈·Worker 배포는 하지 마세요.
- Worker나 D1 변경이 필요하지 않은 작업은 그대로 두고 최종 보고에 그 사실을 명시하세요.
- 사용자에게 로컬 `git add`, `git commit`, `git push`, 태그 발행, Wrangler 실행,
  HA 파일 직접 복사·동기화를 요구하지 마세요. 직접 동기화는 사용자가 명시적으로
  요청한 예외 경로입니다.
- 에이전트는 HA·Comma 업데이트 버튼이나 실제 기기 재부팅을 대신 실행하지 않습니다.
  최종 보고에는 HA 릴리즈 링크·버전, Comma 원격 커밋, 검증 결과와 사용자가 실행할
  pull·재부팅 명령을 제공하세요. 필요 없는 대상의 업데이트는 요구하지 마세요.
- 기본 Comma 명령은 `cd /data/openpilot && git pull --ff-only && sudo reboot`입니다.
  변경사항을 버리는 `git reset --hard`는 기본 명령에 추가하지 마세요.
- 인증·네트워크·자동 승인 심사 등으로 실제 발행이 막히면, 완료한 작업과 막힌 단계를
  정확히 보고하세요. 푸시·릴리즈·배포가 실패했는데 사용자가 업데이트만 하면 된다고
  안내하거나 완료로 주장하지 마세요.


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
     cd /data/openpilot && git pull --ff-only && sudo reboot
     ```

### B. Deploying Home Assistant Changes (`helico717/carrot-ha`)

아래 버전 갱신·커밋·푸시·태그·릴리즈 확인은 **에이전트의 작업**이고, HACS 설치·HA 재시작만 사용자 작업입니다.

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

- **방법 B (사용자가 명시적으로 요청한 경우에만: HA 서버 직접 동기화)**:
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

아래 작업은 에이전트가 수행합니다. 필요한 D1 마이그레이션을 Worker 배포보다 먼저 적용하세요.

1. Navigate to the `cloudflare/` directory:
   ```bash
   cd cloudflare
   ```
2. If D1 database migrations are needed, apply them **before** deploying the Worker:
   ```bash
   npx wrangler d1 execute id4-ha-db --remote --file migration.sql
   ```
3. Deploy via Wrangler, then verify the deployed version and relevant endpoint behavior:
   ```bash
   npx wrangler deploy
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

- **Current Minor Version**: `0.8.x` (current: `0.8.9`).
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


## 자동 동기화 실패 대응 및 보고 기준 — 2026-10-03

- 실패 알림을 받으면 최신 실행의 링크·시각·실행 브랜치·실패 단계와 로그를 확인한다.
  과거 실패 이력과 수정 후 신규 실패를 구분한다. 로그 없이 같은 원인으로 단정하지 않는다.
- 원인을 워크플로 설정 충돌, 실제 소스 충돌, 인증·권한, 네트워크, 동시 푸시 등으로
  구분하고 증거를 기록한다. 재실행만 반복하지 말고 원인에 맞는 수정부터 수행한다.
- 예약 실행은 기본 `carrot-wip` 브랜치의 워크플로를 사용하고,
  `carrot-wip-model_selector-ha`를 checkout해 병합한다. CI 변경 시 두 경로에 필요한
  수정이 반영됐는지 확인한다. 기본 브랜치에는 관련 CI 수정만 반영한다.
- `SYNC_PAT` 없이 동기화할 때는 fork의 `.github/workflows/` 전체 트리를 유지한다.
  파일 추가·수정·삭제와 modify/delete 충돌을 모두 처리하고, 병합 커밋 전후 트리가
  동일함을 검사한다. 실제 소스 충돌은 자동으로 한쪽을 버리지 말고 병합을 중단해
  충돌 파일과 양쪽 변경 의도를 조사한 뒤 통합한다. 무조건 ours/theirs나 force push로
  실패를 숨기지 않는다.
- 관련 충돌을 재현하는 회귀 테스트와 코드 보존 검증을 수행하고 커밋·푸시한다.
  수정된 워크플로로 새 실행을 시작해 실제 성공과 원격 반영을 확인한다.
  이전 실행 재시도는 이전 워크플로를 사용할 수 있으므로 신규 실행과 구분한다.
- 보고 상태는 **원인 확인 중 / 원인 확인·수정 중 / 수정 푸시·실행 검증 중 /
  실제 실행 성공 / 차단됨**으로 구분한다. 로컬 테스트나 푸시만으로 해결 완료를
  주장하지 않는다. 진행 중 보고에는 확인된 증거와 다음 확인 항목을 제공하고,
  차단됐으면 이유와 필요한 최소 조치를 정확히 안내한다.
- 처리 기록은 기존 관련 문서에 발생·검증 시각, 실행 링크, 원인, 이전 수정의 한계,
  수정 방향·커밋, 테스트, 실제 실행 결과, 미확인 사항을 추가한다.
  특정 충돌 재발 방지를 모든 미래 충돌의 영구 해결로 설명하지 않는다.
- Mac 테스트 오류와 실제 Comma 장애를 구분한다. 실기 로그 없이 기기 장애로 보고하지
  않는다. 사용자는 HACS 업데이트·HA 재시작 및 원격 터미널의 연결·Git Pull·재부팅
  버튼만 조작하며, 분석·코드 통합·커밋·푸시·발행은 에이전트가 담당한다.
  감시 자동화는 별도 요청이 있을 때만 생성한다.

### 처리 기록: 2026-10-03 자동 동기화 반복 실패

- 실패 실행: https://github.com/helico717/openpilot/actions/runs/37118895430
  (한국 시간 20:12 실행). Fetch and Merge Upstream 단계에서
  `.github/workflows/native-cpu.yaml`의 modify/delete 충돌 발생.
  fork에서는 삭제됐지만 upstream에서는 수정된 파일이었다.
- 이전 방식은 성공한 merge 뒤에 워크플로를 복원했다. 충돌로 merge가 종료되면 복원
  단계에 도달하지 못하므로 추가·삭제 보존만으로 이 문제를 해결할 수 없었다.
- 수정: `.github/scripts/sync_upstream_model_selector.sh`에서 merge를 커밋 없이 수행하고,
  워크플로의 충돌 index를 정리한 뒤 fork 트리를 복원한다. 남은 소스 충돌은 abort하고,
  충돌이 없을 때만 커밋·푸시한다. 같은 동기화의 동시 실행도 직렬화한다.
- 수정 커밋: Comma 브랜치 `0a235b74`, 기본 브랜치 CI `2de2596c`.
  실제 upstream 병합 재현 및 워크플로 충돌 해결·소스 충돌 중단 테스트 통과.
- 한국 시간 20:59 신규 실행 성공 확인:
  https://github.com/helico717/openpilot/actions/runs/37121411043
  자동 병합 결과 `e309bf15`가 원격 Comma 브랜치에 반영됨.
  이는 당시 실행의 성공 기록이며, 미래 실행 상태는 새 로그로 확인해야 한다.
- 같은 시기 SOC 오표시의 별도 원인은 CAN 초기화 코드 `102350Wh`를 잔량으로
  수용한 것이었다. 수집기 무효값 제외 및 HA 방어 처리를 반영하고 `v0.8.10` 발행.
  로컬 전체 Comma 검사에 남은 카메라·터미널 4건은 기존 테스트 문제이며
  실제 기기 장애가 확인된 것은 아니다.

## HA 원격 SSH 진단 가이드 — 2026-10-04

### 접속 경로와 범위

- 이 Mac에서 확인된 HA SSH 주소: `hassio@192.168.0.140`, 포트 22.
- 기존 Mac 키: `~/.ssh/id_ed25519`. Advanced SSH & Web Terminal 앱의 authorized_keys에 이 Mac 공개키가 등록되어 있다. 개인키/비밀번호/HA 토큰을 출력하거나 문서·커밋에 넣지 않는다.
- 집 LAN 또는 사용자가 이미 구성한 VPN에서 주소가 연결돼야 한다. 연결 실패 시 주소/네트워크/인증을 구분하고 임의로 SSH 설정·키·방화벽을 변경하지 않는다.
- 기본 연결 확인:
  ```bash
  ssh -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 hassio@192.168.0.140 'echo SSH_OK; date -Iseconds'
  ```
- sandbox에서 `Operation not permitted`이면 같은 읽기 전용 명령을 네트워크 승인 경로로 실행한다. 이를 서버 인증 실패로 오인하지 않는다. 승인 거절 시 거절 이유를 보고하고 우회하지 않는다.
- 이 경로는 **HA 서버 진단용**이다. Comma SSH 접근 또는 `/data/openpilot` 파일 수정의 허가가 아니다. HA 설치/재시작, 운영 DB 변경, 압축/복원/삭제, rsync·직접 파일 배포를 진단 요청만으로 실행하지 않는다. HA 업데이트는 기본 HACS 릴리즈 경로다.

### 위치와 읽기 전용 DB 검사

- 설치 코드: `/config/custom_components/carrot_ha/`; 버전은 manifest.json에서 확인.
- archive: `/config/carrot_ha/<entry_id>.sqlite3`. 2026-10-04 활성 큰 DB는 `01M23RJD5A9H29TRSYCXV4HJ80.sqlite3`; 작은 예전 DB도 있으므로 파일 목록과 엔트리 매핑을 확인하고 이 ID를 영구 고정값으로 가정하지 않는다.
- 원격 Python3/sqlite3 사용 가능. Python은 `sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)` 및 `PRAGMA query_only=ON`으로 접속한다. 운영 파일에 VACUUM/UPDATE/DELETE/DDL을 실행하지 않는다.
- 최근 상태는 kind='state'에 대해 observed DESC LIMIT으로 조회한다. 측정시각은 data.field_measured_at를 우선 확인한다. updated/observed 시각만으로 차량 CAN 신호가 신선하다고 판단하지 않는다.
- 이벤트 body는 손실 없는 압축 wrapper일 수 있다. `json.loads(body)['data']`는 SQL용 projection일 수 있어 전체 원본과 동일하지 않다. 전체 원문 검증은 설치된 `archive_codec.py`의 loads/unpack을 사용한다(해당 파일만 importlib로 로드 가능). 일반 sqlite3에는 carrot_unpack SQL 함수가 자동 등록되지 않는다.
- 토큰이 들어 있는 config entry 파일이나 전체 위치/GPS 원문을 출력하지 않는다. 필요한 상태값/집계만 출력한다. 400MB급 전체 스캔은 동시에 반복 실행하지 않고 제한된 진단에서 수행한다.

### DB 압축의 실효성 검증

- beta.2 이상 설치만으로 압축은 실행되지 않는다. `<db>.compression-enabled` 존재 여부, `<db>.compression-status.json`의 phase/operation/compressed_rows/database_bytes/error를 먼저 확인한다.
- `<db>.before-compression.sqlite3`는 변환 전 백업이다. `.partial`은 미완료 산출물이므로 유효 백업으로 취급하지 않는다.
- 검증 항목: DB 실제 bytes, WAL/백업을 포함한 총 디스크 사용량, page_count/page_size/freelist_count, kind별 행 수/본문 bytes, `_carrot_archive_v1` wrapper 행 수, SQLite quick_check 또는 필요 시 integrity_check.
- 압축 전후 효과는 같은 기록집합의 원문 bytes와 저장 bytes를 비교한다. 압축 후 새 기록 추가/보관기간 purge/변경 가능한 cloud state를 구분한다. 단순 파일 크기 차이만으로 압축률이나 데이터 무손실을 확정하지 않는다.
- 백업과 변환 후 DB에 공통으로 남은 불변 이벤트를 codec으로 복원해 원문/hash와 비교한다. 새로 추가되거나 정상 보존기간에 따라 삭제된 행을 손실로 오인하지 않는다. API/그래프/전비/충전 내역도 별도 검증한다.
- 백업을 유지하면 운영 DB가 줄어도 합산 디스크 사용량은 늘 수 있다. 검증 목적으로 백업을 자동 삭제하지 않는다.
- 압축을 아직 실행하지 않았다면 ‘기능 설치됨, 실제 운영 절감 미검증’으로 보고한다. 압축 실행은 운영 DB 변환이므로 사용자 요청 범위를 확인하고, 실행 전 백업·여유 공간과 서비스 entry_id를 검증한다. 원격 SSH에서 수동 SQL 변환 대신 통합의 compress_archive/restore_archive 서비스를 사용한다.

## Temporary raw CAN capture — 2026-10-04

Raw CAN analysis is stored in separate gzip files, never the HA archive SQLite.
Read [docs/raw-can-capture.md](docs/raw-can-capture.md) before activating or analyzing
it. After HA and Git-managed Comma updates, start `carrot_ha.start_can_capture`
with the relevant entry ID. Verify real `.json.gz` arrival and frame timestamps
before claiming capture is running. Use the existing HA SSH access guide to read
`/config/carrot_ha/can-analysis/<entry_id>/`; do not patch Comma source remotely.
Physical CPU/load and stream completeness require device evidence.

### CAN 분석 자료 색인

CAN 연구의 기준 저장소는 비공개 `helico717/meb-can-research`이다.
충전 또는 다른 CAN 데이터의 분석·수정 전 `docs/can-analysis-index.md`의 이전 안내를
따라 연구 저장소의 AGENTS.md·색인·해당 날짜 분석 보고서를 읽는다.
새 분석 도구·실측 보고서·대장·실차 양식은 연구 저장소에 추가하고 색인을 갱신한다.
HA 수신 어댑터와 제품 적용·릴리즈 기록은 이 저장소에, Comma 실행 코드는 openpilot에 유지한다.
연구 저장소는 HACS/Comma 실행 의존성이 아니며, 접근은 사용자 Git 인증 또는 GitHub 앱의
저장소 허용 범위에 따른다. 원시 로그·개인 메모·인증정보는 연구 저장소에도 커밋하지 않는다.
요청 모드의 일치를 커넥터 연결·실제 전류 또는 모든 UDS 정의의 검증으로 확대하지 않는다.

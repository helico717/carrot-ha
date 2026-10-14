# 폐기된 Cloudflare 설치·배포 안내 원문

이 파일은 2026-10-14 이전의 자료를 보존합니다. **여기 있는 설치·배포 명령을 실행하지 마세요.**
현재 안내: [초기화 복구](../CLEAN_INSTALL_RECOVERY.md).


<details><summary>폐기: docs/INSTALL.md</summary>

# 처음 설치하기

한국어 | [English](INSTALL.en.md)

대상: HA가 실행 중이며 콤마 SSH 접속을 할 수 있는 사용자. Carrotpilot은 차량에서 정상 실행 중이어야 합니다. 공장 초기화 기기는 먼저 제작자 안내로 Carrotpilot을 설치하세요. 브랜치 이름만 같다고 데이터 호환이 보장되지는 않습니다.

> 콤마만 초기화했다면 새 서버를 만들지 말고 [Windows/Mac 재설치·복구 가이드](REINSTALL.md)를 사용하세요.

## 1. PC에서 파일 준비

### Windows PowerShell

GitHub 저장소 → Code → Download ZIP → 압축 해제합니다. 아래 PC 명령은 압축 해제한 `cloudflare` 폴더에서 PowerShell을 연 상태로 실행합니다.

Node.js 공식 사이트에서 Windows x64 버전을 설치하세요. `node -p "process.arch"`가 `ia32`이면 32비트이므로 교체해야 합니다.

```powershell
npm.cmd install
.\node_modules\.bin\wrangler.cmd login
.\node_modules\.bin\wrangler.cmd d1 create id4-ha-db
.\node_modules\.bin\wrangler.cmd kv namespace create SNAPSHOTS
```

Cloudflare 계정은 각 사용자가 따로 만듭니다. D1은 기록 저장소, KV는 서버가 사용하는 보조 저장소입니다. 결과의 database_id와 KV id를 메모합니다. 아래 설정 프로그램에 두 값을 입력하세요. `id4`가 들어간 서버/폴더 이름은 호환성을 위한 내부 이름이며 ID. Buzz에서도 그대로 사용합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
.\node_modules\.bin\wrangler.cmd d1 execute id4-ha-db --remote --file .\schema.sql
.\node_modules\.bin\wrangler.cmd deploy
```

배포 결과에 나온 전체 HTTPS 주소를 보관합니다. 본인 계정 부분이 포함된 workers.dev 주소입니다. 별도 도메인이나 HA 포트 개방은 필요 없습니다. 사용 한도와 요금은 Cloudflare에서 확인하세요.

```powershell
node -e "const c=require('node:crypto'); for(const k of ['UPLOAD','VIEW','HA_LOCAL']) console.log(k+': '+c.randomBytes(32).toString('hex'))"
.\node_modules\.bin\wrangler.cmd secret put WAYON_UPLOAD_TOKEN
.\node_modules\.bin\wrangler.cmd secret put WAYON_VIEW_TOKEN
```

생성된 세 비밀번호를 개인 비밀번호 관리 도구에 보관합니다. 첫 secret 질문에는 UPLOAD 값을, 두 번째에는 VIEW 값을 넣습니다. 제목은 빼고 문자열만 입력합니다. HA_LOCAL은 HA 통합 최초 등록에 사용합니다. 공개 저장소에 올리지 마세요.

### Mac 터미널

Node.js 공식 사이트에서 Mac CPU에 맞는 버전을 설치하세요(Apple Silicon은 arm64, Intel은 x64). ZIP을 풀고 터미널에서 해당 `cloudflare` 폴더로 이동합니다. 예: `cd "$HOME/Downloads/carrot-ha-main/cloudflare"`.
이 절의 서버 생성 명령은 **서버까지 처음 만드는 경우에만** 실행합니다.

```bash
npm install
npx wrangler login
npx wrangler d1 create id4-ha-db
npx wrangler kv namespace create SNAPSHOTS
```
D1 database_id와 KV id를 기록합니다. Windows 전용 `setup.ps1` 대신, 코드 편집기로 `cloudflare/wrangler.json`을 만들고 아래 두 `YOUR_…` 값을 실제 ID로 교체하세요. 기존 설정 파일이 있으면 덮어쓰기 전에 내용을 확인합니다.

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
같은 cloudflare 폴더에서 아래 명령을 한 줄씩 실행합니다. 오류가 나면 중단하세요.

```bash
npx wrangler d1 execute id4-ha-db --remote --file schema.sql
npx wrangler deploy
node -e "const c=require('node:crypto'); for(const k of ['UPLOAD','VIEW','HA_LOCAL']) console.log(k+': '+c.randomBytes(32).toString('hex'))"
npx wrangler secret put WAYON_UPLOAD_TOKEN
npx wrangler secret put WAYON_VIEW_TOKEN
```
배포된 Worker HTTPS 주소와 세 토큰을 보관합니다. 첫 Secret 입력에는 UPLOAD, 두 번째에는 VIEW를 입력합니다. HA_LOCAL은 HA 최초 등록용입니다. Mac에서는 `.cmd`, `powershell.exe`, `setup.ps1` 명령을 실행하지 않습니다.

## 2. HA 설정

README의 HACS 설치 순서로 설치합니다. 장치 ID는 본인이 정한 영문 이름(예: `my-buzz`)입니다. 차량 VIN이나 HA 엔터티 ID가 아닙니다. 최초 등록 토큰은 HA_LOCAL, 구성의 읽기 토큰은 VIEW입니다. 차량 모델과 SOC 계산 용량은 본인 차량에 맞춥니다.
대시보드 리소스에 `/carrot_ha_static/carrot-dashboard.js`를 등록하면 `custom:carrot-dashboard-card`와 함께 당근파일럿 원격 설정 카드인 `custom:carrot-params-card`도 함께 사용 가능합니다.

## 3. 콤마(Comma) 기기 연동 (Git 기반 내장 데몬)

> [!TIP]
> **수동 SCP 파일 복사가 필요 없습니다!**  
> Carrot HA 수집기와 파라미터 동기화 모듈은 [`helico717/openpilot`](https://github.com/helico717/openpilot)의 `carrot-wip-model_selector-ha` 브랜치에 정식 내장 데몬(`selfdrive/carrot/ha`)으로 통합되어 있습니다.

기기 설정 순서:

1. **브랜치 확인**:
   콤마 기기가 `carrot-wip-model_selector-ha` 브랜치를 사용 중인지 확인합니다.
   (기기 화면 또는 터미널에서 `git branch --show-current` 확인)

2. **연결 정보 등록 (`connection.json`)**:
   `/data/carrot_ha/connection.json` (또는 기존 `/data/id4-collector/connection.json`)에 아래 JSON 형식으로 연결 정보를 저장합니다:
   ```json
   {
     "url": "https://your-worker.workers.dev",
     "device": "my-buzz",
     "token": "YOUR_WAYON_UPLOAD_TOKEN"
   }
   ```
   *(이미 이전 버전에서 설정한 적이 있다면 기존 파일이 그대로 자동 인식되므로 다시 입력할 필요가 없습니다.)*

3. **자동 실행**:
   - openpilot의 프로세스 관리자(`manager.py`)가 시동 시 `carrot_ha` 데몬을 자동으로 구동합니다.
   - 콤마 재부팅(`sudo reboot`) 후 정상 실행됩니다.

4. **앞으로의 업데이트 방법**:
   - Home Assistant 대시보드의 **Comma 원격 터미널** 카드에서 **`[📥 당근 Git Pull]`** 버튼을 누르거나, 당근 웹 UI에서 업데이트 버튼을 누르면 끝납니다.
   - SSH를 통한 수동 파일 조작은 절대 하지 마세요! 자세한 개발 및 배포 원칙은 [개발 및 배포 워크플로우 가이드](DEVELOPMENT_WORKFLOW.md)와 [AGENTS.md](../AGENTS.md)를 참고하세요.

## 4. 다른 MEB 차량의 확인 순서

1. 주차 중 현재 배터리·주행거리·외기온이 실제 값과 합리적으로 맞는지 확인합니다. 값이 없으면 센서를 지원한다고 판단하지 마세요.
2. 상태 확인:
   - HA 대시보드에서 `custom:carrot-dashboard-card` 상태 배지 확인.
   - 원격 터미널에서 `tail -n 30 /data/carrot_ha/collector.log` (또는 `/data/id4-collector/collector.log`) 확인.
3. 정상 사용 후 주행 경로·충전 기록을 확인합니다. 데이터는 수신 전용이며 CAN 명령을 보내지 않습니다.
4. 인터넷 단절 후 복귀하면 status의 pending이 줄고 delivery가 ok인지 확인합니다. 차량이 잠들어 데이터를 주지 않거나 콤마가 꺼진 구간은 복구할 수 없습니다.

ID. Buzz는 현재 실차 검증 전입니다. 연식, 배터리 사양, Carrotpilot 브랜치와 commit을 기록해 주세요. 개인정보·토큰을 제외한 오류로 호환성을 확인합니다.

## 알려진 범위

충전 분류/전력/SOC는 추정값입니다. 상세 표본이 없는 구간은 그래프의 마지막 확인값으로 표시할 수 있지만 사용량 계산에는 포함하지 않습니다. 기록은 현재 서버·HA의 보관 정책에 따라 삭제될 수 있으므로 [종합 설명서](GUIDE.md)의 기록 범위를 확인하세요.


</details>


<details><summary>폐기: docs/INSTALL.en.md</summary>

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
Adding `/carrot_ha_static/carrot-dashboard.js` as a dashboard resource automatically registers both `custom:carrot-dashboard-card` and `custom:carrot-params-card`.

## 3. Comma Device Setup (Git-Managed Native Daemon)

> [!TIP]
> **No manual SCP or file copy is required!**  
> The Carrot HA collector, param sync, and reverse terminal are natively integrated into the [`helico717/openpilot`](https://github.com/helico717/openpilot) repository on branch `carrot-wip-model_selector-ha` under `selfdrive/carrot/ha`.

Setup steps:

1. **Verify Branch**:
   Ensure your Comma device is running the `carrot-wip-model_selector-ha` branch.
   (Check on device screen or run `git branch --show-current`).

2. **Register Connection Configuration (`connection.json`)**:
   Create `/data/carrot_ha/connection.json` (or use existing `/data/id4-collector/connection.json`) with the following format:
   ```json
   {
     "url": "https://your-worker.workers.dev",
     "device": "my-buzz",
     "token": "YOUR_WAYON_UPLOAD_TOKEN"
   }
   ```
   *(If you previously configured this, existing configurations are detected automatically without re-entering).*

3. **Automatic Startup**:
   - Openpilot's process manager (`manager.py`) automatically starts the `carrot_ha` daemon upon startup.
   - Reboot Comma (`sudo reboot`) to begin running.

4. **Future Updates**:
   - Simply open the **Comma Remote Terminal** card in Home Assistant and click **`[📥 당근 Git Pull]`**, or use the Carrot Web UI update button.
   - **Never manually edit or copy files on Comma via SSH!** For full architecture and developer guidelines, see [Development & Deployment Workflow](DEVELOPMENT_WORKFLOW.md) and [AGENTS.md](../AGENTS.md).

## 4. Validate your MEB vehicle

1. While parked, compare battery, odometer, and temperature readings with the vehicle. Missing values do not indicate successful support.
2. Check logs:
   - On the HA dashboard, verify the `custom:carrot-dashboard-card` status badge.
   - In the remote terminal, inspect `tail -n 30 /data/carrot_ha/collector.log` (or `/data/id4-collector/collector.log`).
3. After normal use, check trip routes and charging records. Collection is receive-only; it does not send CAN control commands.
4. After an internet outage, confirm `pending` decreases and delivery becomes `ok`. Missing data while comma was off or the vehicle was asleep cannot be recovered.

ID. Buzz has not yet been validated on a real vehicle. Record the model year, battery specification, Carrotpilot branch, and commit when reporting compatibility, excluding personal information and tokens.

## Limitations

Charging classification, power, and SOC are estimates. The graph may carry forward the last known value through missing periods, but excludes those carried values from consumption calculations. Records may be removed under the configured server/HA retention policies; consult the [full guide (Korean)](GUIDE.md).


</details>


<details><summary>폐기: docs/REINSTALL.md</summary>

# 콤마 플래싱·재설치 후 Carrot HA 복구 (Windows / Mac)

대상: 콤마를 초기화했지만 기존 Cloudflare Worker와 Home Assistant(HA)는 남아 있는 사용자.
먼저 Carrotpilot을 해당 프로젝트의 공식 설치 안내에 따라 재설치하고 차량에서 정상 동작하는지 확인하세요. 이 문서는 콤마 펌웨어 플래싱 자체가 아니라 **Carrot HA 수집기를 다시 설치하는 절차**입니다.

**순서:** 연결 정보 확인 → SSH 복구 → 파일 복사 → 연결 설정 → 설치 → 콤마·Cloudflare·HA 순서로 검증.

- 기존 Worker·D1·KV·HA 통합은 재사용합니다. 단순 콤마 초기화 때문에 새 서버나 DB를 만들지 마세요.
- 콤마에만 있던 미전송 데이터는 백업이 없으면 복구할 수 없습니다. 서버에 전송된 기록은 서버의 보관 정책과 실제 남은 데이터 범위에서 유지됩니다.
- HA까지 초기화했다면 먼저 HA 백업 복원 또는 [최초 설치](INSTALL.md)의 HA 설정이 필요합니다.
- 작업 중에는 차량을 안전하게 주차하고 전원을 끄되, 콤마 전원과 인터넷은 유지하세요. 기어 P만으로는 설치기의 offroad 조건을 만족하지 않을 수 있습니다.
- 코드 블록만 복사하세요. `Mac %`, `PS>`, `comma@…$` 같은 프롬프트는 명령에 포함하지 않습니다.

## 1. 필요한 정보와 분실 시 대처

| 필요한 정보 | 찾는 곳 / 분실 시 행동 |
|---|---|
| 콤마 IP | 콤마의 현재 네트워크 설정에서 확인. 초기화 전 주소를 그대로 믿지 말고 PC와 같은 Wi-Fi에 연결합니다. |
| SSH 키 | Mac/Windows의 `.ssh` 폴더와 기존 키 백업. 콤마 SSH 설정에 본인 GitHub 계정을 다시 등록합니다. 자세한 복구는 2절. |
| Worker 기본 주소 | HA → 설정 → 기기 및 서비스 → Carrot HA → 구성의 `Cloudflare Worker 주소`. 또는 Cloudflare → Workers & Pages → 기존 Worker → Domains의 운영용 workers.dev/사용자 도메인. `https://…`만 사용하고 `/api/telemetry` 같은 경로는 빼세요. |
| Device ID | 기존 대시보드 카드의 코드 편집기에서 `device_id:` 확인. HA 통합 등록 값과 같아야 합니다. VIN, 콤마 시리얼, GitHub 계정, HA 엔터티 ID가 아닙니다. |
| UPLOAD 토큰 | 비밀번호 관리자 또는 백업 `connection.json`의 `token`. 없으면 아래 순서로 재발급합니다. |
| VIEW 토큰 | 기존 HA 통합의 읽기 토큰. 콤마에는 넣지 않습니다. HA가 정상이라면 건드리지 않습니다. |
| HA_LOCAL 토큰 | HA 통합 최초 등록용. 기존 HA 통합을 유지하는 콤마 복구에는 필요 없습니다. |
| D1/KV ID | 이번 파일 복구에는 필요 없습니다. 서버 설정도 복구해야 할 때 기존 Worker의 바인딩/Cloudflare DB·KV 목록에서 확인합니다. |

Device ID를 카드에서 찾을 수 없다면 콤마 설정 백업의 `device` 또는 HA/Cloudflare에 남은 기존 장치 기록을 확인하세요. 어느 곳에서도 확인할 수 없다면 임의 이름으로 복구했다고 판단하지 마세요. 새 ID는 기존 기록과 다른 장치로 취급될 수 있습니다.

### UPLOAD 토큰 백업이 없을 때

Cloudflare Secret은 저장 후 원문을 다시 볼 수 없습니다. **새 값을 만들어 Worker와 콤마 양쪽에 동일하게 넣습니다.** 같은 Worker에 다른 수집기가 연결돼 있다면 그 수집기도 새 토큰이 필요합니다.

**Mac 터미널:**

```bash
openssl rand -hex 32
```

**Windows PowerShell (추가 프로그램 불필요):**

```powershell
$tokenBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($tokenBytes)
$rng.Dispose()
([System.BitConverter]::ToString($tokenBytes)).Replace('-', '').ToLowerInvariant()
```

1. 출력된 문자열을 비밀번호 관리자에 보관합니다. 채팅·GitHub·스크린샷으로 공유하지 마세요.
2. [Cloudflare 대시보드](https://dash.cloudflare.com/) → Workers & Pages → **기존 Worker** → Settings → Variables and Secrets.
3. `WAYON_UPLOAD_TOKEN`을 편집합니다. 유형은 **Secret**, 값은 새 문자열입니다. 항목이 없다면 같은 이름으로 추가합니다.
4. **Deploy / Save and deploy**로 적용합니다.
5. 4절 `configure.py`의 UPLOAD 질문에 같은 문자열을 입력합니다.

`WAYON_VIEW_TOKEN`과 혼동하지 마세요. `wrangler.jsonc`의 `vars` 동기화 안내가 보여도 토큰을 `vars`에 넣지 않습니다. 이번 복구에 Worker 코드 재배포는 필요 없습니다. [Cloudflare Secret 공식 안내](https://developers.cloudflare.com/workers/configuration/secrets/)

VIEW도 분실했고 HA 조회가 안 된다면 별도의 새 토큰을 만들어 Worker의 `WAYON_VIEW_TOKEN`과 HA 구성의 읽기 토큰을 함께 변경하세요. UPLOAD와 다른 값을 사용합니다. Cloudflare 계정에 접근할 수 없다면 우선 계정 접근을 복구해야 하며, 콤마에 새 토큰만 넣어서는 인증되지 않습니다.

## 2. PC에서 SSH 접속 준비

Windows는 **PowerShell**, Mac은 **터미널**을 사용합니다. 이후 SSH 접속한 화면의 명령은 두 OS 모두 같습니다.

Windows에서 `ssh -V`를 실행했을 때 명령이 없으면 Windows 선택적 기능에서 **OpenSSH Client**를 설치하세요([Microsoft 안내](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)). PC에서 콤마로 접속하기 위해 OpenSSH Server를 설치할 필요는 없습니다. Mac은 기본 SSH/scp를 사용할 수 있습니다.

콤마에서 SSH를 활성화하고, 초기화로 사라진 GitHub 사용자 등록도 복구하세요. PC의 개인키와 그 GitHub 계정에 등록된 공개키가 짝이어야 합니다.

아래 `192.168.43.1`은 예시입니다. 현재 콤마 IP로 바꿉니다.

```text
ssh comma@192.168.43.1
```

처음 보는 호스트 키 질문은 해당 IP가 본인 콤마인지 확인한 뒤 영문 `yes`와 Enter를 입력합니다. 접속되면 콤마 프롬프트가 나옵니다. 다음 복사 단계는 PC에서 하므로 `exit`를 입력해 돌아오세요.

### `REMOTE HOST IDENTIFICATION HAS CHANGED!`

플래싱으로 콤마 호스트 키가 바뀔 수 있습니다. 현재 IP가 본인 콤마인지 확인한 다음 **PC에서** 기존 주소의 키만 제거합니다. Windows/Mac 공통입니다.

```text
ssh-keygen -R 192.168.43.1
ssh comma@192.168.43.1
```

`ssh ssh-keygen …`이 아닙니다. 새 호스트 키를 확인해 승인합니다. 전체 known_hosts 삭제나 호스트 키 검사 비활성화는 필요 없습니다.

### `Permission denied (publickey)`

이는 Worker 토큰 문제가 아니라 SSH 인증 문제입니다.

1. 콤마 SSH 설정에 올바른 GitHub 사용자가 등록됐는지 확인합니다.
2. PC에서 키 파일 이름을 확인합니다. 개인키 내용을 출력하거나 공유하지 마세요.

Windows:

```powershell
Get-ChildItem "$env:USERPROFILE\.ssh"
```

Mac:

```bash
ls -la ~/.ssh
```

3. 별도 이름의 개인키를 썼다면 `ssh -i "개인키경로" comma@192.168.43.1`로 지정합니다. scp에도 같은 `-i` 옵션이 필요합니다.
4. 개인키를 잃어버렸다면 공개키만으로 복원할 수 없습니다. PC에서 새 키를 만들고 GitHub에 **공개키(.pub)**를 등록한 뒤 콤마가 갱신된 키 목록을 가져오도록 SSH 설정에서 해당 사용자를 다시 등록합니다.

새 키가 필요한 경우 두 OS의 터미널에서:

```text
ssh-keygen -t ed25519
```

기존 파일을 덮어쓸지 묻는다면 승인하지 말고 다른 저장 이름을 지정하세요. 기본 이름으로 새로 만들었다면 공개키 복사는 다음과 같습니다.

Windows:

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
```

Mac:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

GitHub → Settings → SSH and GPG keys → New SSH key에 인증용 공개키를 등록합니다. [GitHub 공식 안내](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)

### 시간 초과 / 연결 거부 / 별도 포트

IP·동일 네트워크·콤마 전원·SSH 활성화를 확인하세요. 콤마와 PC가 연결됐더라도 콤마의 인터넷 접속은 별도 확인이 필요합니다.
포트가 8022인 환경에서는 **모든** SSH에 `-p 8022`, scp에 대문자 **`-P 8022`**를 추가합니다. 해당 주소의 호스트 키 삭제는 `ssh-keygen -R '[192.168.43.1]:8022'`입니다.

## 3. 콤마에 내장 브랜치 설치 및 연결 복원

> [!TIP]
> **수동 SCP 파일 복사가 필요 없습니다!**  
> 수집기, 파라미터 동기화, 역방향 터미널 클라이언트는 이미 [`helico717/openpilot`](https://github.com/helico717/openpilot)의 `carrot-wip-model_selector-ha` 브랜치에 정식 내장 데몬(`selfdrive/carrot/ha`)으로 통합되어 있습니다.

### A. openpilot 브랜치 확인 및 전환

콤마 기기 SSH 또는 터미널에서 `helico717/openpilot`의 커스텀 브랜치를 사용하도록 설정합니다:

```bash
cd /data/openpilot
git remote set-url origin https://github.com/helico717/openpilot.git
git fetch origin carrot-wip-model_selector-ha
git checkout -B carrot-wip-model_selector-ha origin/carrot-wip-model_selector-ha
git reset --hard origin/carrot-wip-model_selector-ha
```

*(공장 초기화 기기 설치 마법사에서 설치 URL을 `https://github.com/helico717/openpilot` 및 브랜치 `carrot-wip-model_selector-ha`로 지정해도 됩니다.)*

### B. 연결 정보 복원 (`connection.json`)

기존 Worker URL, Device ID, UPLOAD 토큰을 `/data/carrot_ha/connection.json`에 저장합니다:

```bash
mkdir -p /data/carrot_ha
cat << 'EOF' > /data/carrot_ha/connection.json
{
  "url": "https://your-worker.workers.dev",
  "device": "my-buzz",
  "token": "YOUR_WAYON_UPLOAD_TOKEN"
}
EOF
```

*(1절에서 확인한 실제 Worker 주소, Device ID, UPLOAD 토큰으로 교체하세요.)*

## 4. 기기 재부팅 및 자동 구동

openpilot의 상주 프로세스 관리자(`manager.py`)가 시동 시 `carrot_ha` 데몬을 자동으로 감지하고 실행합니다. 수동으로 `continue.sh`를 수정하거나 `install.py`를 실행할 필요가 없습니다.

```bash
sudo reboot
```

## 5. 콤마 → 서버 전송 검증

재부팅 후 약 1~2분 뒤 상태를 확인합니다:

- **원격 터미널에서 로그 확인**:
  ```bash
  tail -n 30 /data/carrot_ha/collector.log
  ```
  *(기존 `/data/id4-collector/` 디렉터리가 남아있다면 해당 경로에 기록될 수도 있습니다.)*

- **실행 프로세스 확인**:
  ```bash
  pgrep -af 'selfdrive.carrot.ha.daemon'
  ```


| 결과 | 뜻 / 확인 기준 |
|---|---|
| status의 `running`, 작은 `age_seconds` | 수집기가 최근에 상태를 갱신함. 오래된 running 문자열만으로 정상이라고 판단하지 않습니다. |
| `can_fields`에 `battery_wh`, `odometer_km` 등 | 해당 필드가 수집됨. 값의 정확성·최신성까지 보장하지 않으므로 HA 측정 시각과 실제 계기판도 비교합니다. |
| delivery의 `ok`, 최근 전송 시각 | Worker가 업로드를 승인함. **HA 조회 성공까지 의미하지는 않습니다.** |
| `pending: 0` 또는 점점 감소 | 전송 대기 데이터가 처리됨. 잠깐 1 이상인 것만으로 실패는 아닙니다. |
| `waiting` 지속 | 아직 상태 파일이 없음. 프로세스와 로그를 확인합니다. |
| `retrying`, HTTP 401/403 | 주소·UPLOAD 토큰·Worker Secret 적용 여부 및 접근 제한을 확인합니다. VIEW 토큰을 넣지 않았는지 확인하세요. |
| `URLError` 반복 | 콤마 인터넷·DNS·Worker 주소 등을 확인합니다. 과거 로그에만 있고 현재 delivery가 최신 ok이면 복구됐을 수 있습니다. |

필요하면 프로세스를 확인합니다.

```bash
pgrep -af '^bash /data/id4-collector/supervisor.sh$'
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
```

각 프로세스가 실행 중이어야 합니다. 로그는 매 샘플마다 출력되지 않습니다. `tail` 내용이 그대로여도 상태·전송 시각이 갱신되면 동작할 수 있습니다.
또한 `collector.py`는 백그라운드 스레드로 `param_sync.py`를 함께 구동하여 로컬 당근 웹(포트 7000)의 설정 스냅샷을 Cloudflare Worker로 주기적(기본 180초)으로 동기화합니다.

기어 판정 버전은 `onroad`(콤마 모드), `driving`(수집기의 주행 판정), `gear`도 표시합니다. P 정지에서 키 ON일 때 `onroad:true`, `driving:false`, `gear:"park"`가 예상되지만 Carrotpilot이 유효한 신호를 제공해야 합니다. `null`을 false로 해석하지 마세요. [판정 설명](CHARGING-MOTION.md)

## 7. 서버 → HA → 대시보드 및 파라미터 카드 검증

1. HA → 설정 → 기기 및 서비스 → Carrot HA에서 기존 Device ID, Worker 주소, **VIEW 읽기 토큰**을 확인합니다. 콤마 토큰을 재발급했다는 이유로 VIEW를 UPLOAD로 바꾸지 않습니다.
2. HA의 클라우드 상태(`cloud_status`), 마지막 성공 동기화(`last_sync`), 장치 보고 시각(`last_received`), 차량 측정 시각(`measured_at`)을 확인합니다. 대시보드의 원본 보기 또는 개발자 도구의 해당 엔터티 상태·속성을 사용하세요. 엔터티 이름은 사용자마다 다릅니다.
3. 보통 장치 보고 30/60초, HA 동기화 60초, 화면 조회 60초이므로 몇 분 여유를 두고 시각이 전진하는지 확인합니다. 마지막 동기화만 최신이고 측정 시각이 오래되면 차량이 잠들었거나 새 CAN 측정이 없을 수 있습니다.
4. 차량이 깨어 있을 때 배터리·주행거리·외기온을 실제 표시와 비교합니다. `0`, `—`, 오래된 숫자가 보이는 것만으로 성공이라고 판단하지 않습니다.
5. 당근파일럿 파라미터 카드(`custom:carrot-params-card`)를 대시보드에 배치한 경우, 당근 웹 원본 설정 화면과 공식 Wiki 상세 설명이 정상 로드되는지 확인하고 상단 상태 스트립에 `연결됨`이 뜨는지 확인합니다.
6. 정상 주행 및 충전 후 기록을 확인합니다. 충전은 에너지 증가 검증 때문에 즉시 표시되지 않을 수 있습니다. 시험을 위해 주행 중 터미널을 조작하지 마세요.
7. 안전하게 콤마를 한 번 재부팅하고 SSH로 다시 접속해 6절 검사를 반복합니다. `install.py`를 다시 실행하지 않아도 동작해야 자동 시작까지 검증된 것입니다.

**서버 전송은 ok인데 HA만 갱신되지 않는다면:** Device ID 불일치, HA의 VIEW 토큰/Worker 주소, HA 인터넷, 통합 로그를 확인하세요. HA가 정상 조회하는데 화면만 이전 상태라면 브라우저 캐시와 카드 설정을 확인합니다.

### HA 코드 업데이트가 필요한 경우

콤마 복구와 HA 업데이트는 별개입니다. 기존 HA와 호환되는 수집기를 복구했다면 통합을 삭제·재등록할 필요가 없습니다.
새 상태 판정 등 HA 변경도 적용하려면 HACS → Carrot HA에서 수정이 포함된 버전으로 업데이트/재다운로드 → **HA 재시작** → 브라우저 새로고침 순서로 진행합니다.

- PR 병합, GitHub Desktop Pull, 콤마 scp는 HA 설치 파일을 자동 업데이트하지 않습니다.
- 업데이트가 안 보이면 HACS의 정보 갱신/재다운로드 화면에서 선택 가능한 버전을 확인합니다. 병합한 커밋이 배포 릴리스에 포함됐는지도 확인하세요. 같은 옛 릴리스를 다시 내려받는 것으로 새 수정이 적용되지는 않습니다.
- Chromium 계열 강력 새로고침: Windows `Ctrl+Shift+R`, Mac `Command+Shift+R`. 다른 브라우저/HA 앱은 해당 앱의 캐시 갱신 절차를 사용합니다.
- [HACS 업데이트 안내](https://hacs.xyz/docs/use/update/), [대시보드 값·시간 설명](GUIDE.md)

## 8. 복구 완료 체크와 다음 백업

- [ ] SSH 접속과 파일 전송 성공
- [ ] 기존 Device ID/Worker 사용, UPLOAD 인증 성공
- [ ] 상태와 업로드 시각이 반복 갱신되고 pending 처리됨
- [ ] HA 조회와 차량 측정 시각을 구분해 확인
- [ ] 실제 차량 값 및 주행·충전 기록 확인
- [ ] 재부팅 후 자동 실행 확인

Worker URL, Device ID, UPLOAD/VIEW/HA_LOCAL의 용도와 값, SSH 키, 사용 버전을 비밀번호 관리자/암호화 백업에 보관하세요. `.ssh` 개인키·`connection.json`·주행 DB·로그를 공개 저장소에 올리지 마세요.

문제가 있으면 토큰·위치·장치 식별자를 가린 상태/오류, Carrotpilot 브랜치·커밋, HA 통합 버전을 함께 기록합니다. 수집기를 중단해야 하면 콤마에서 `python3 /data/id4-collector/disable.py`를 실행합니다. 데이터는 보존되며 재활성화에는 설치기를 다시 실행해야 합니다.

</details>


<details><summary>폐기: docs/TERMINAL_SETUP.md</summary>

# 원격 터미널: Comma 파일 편집 없는 업데이트

Comma 실행 코드는 openpilot의 `carrot-wip-model_selector-ha`, HA 통합과 Worker 코드는 `carrot-ha`에서 관리합니다.

## 적용 순서

1. 기존 Cloudflare Worker를 이 저장소의 최신 `cloudflare/src/worker.js`로 업데이트합니다. 기존 DB, KV 바인딩과 업로드·조회 자격증명은 유지합니다. 새 DB 스키마는 필요 없습니다.
2. HA 통합을 업데이트하고 HA를 재시작합니다.
3. Comma에서 기존 `carrot-wip-model_selector-ha` 브랜치를 `git pull`로 업데이트하고 재부팅합니다. `/data` 파일 편집이나 별도 에이전트 설치는 필요 없습니다.
4. HA의 **설정 → 기기 및 서비스 → Carrot HA → 구성**에서 원격 터미널을 켜고 HA 외부 HTTPS 주소와 기존 `WAYON_UPLOAD_TOKEN`을 입력합니다. 기존 Worker 주소와 조회용 토큰은 유지합니다.

업로드 토큰은 기존 Worker를 설정할 때 사용한 값입니다. HA의 로컬 수신 토큰이나 조회용 토큰과 다릅니다. 터미널 전용 토큰은 HA가 자동 생성합니다. Comma의 기존 `connection.json`에 있는 `url`, `token`, `device`만으로 자동 조회합니다.

## 자동 연결

HA는 인증된 Worker API에 60초마다 3분 유효기간의 연결 정보를 등록합니다. Comma는 기존 업로드 인증으로 이를 조회하고 HA에 아웃바운드 WSS를 연결합니다. 터미널 데이터는 Worker에 저장되지 않고 Comma와 HA 사이에서 전달됩니다. Comma 재부팅과 일시적인 연결 장애 후 자동으로 재연결합니다.

HA에서 원격 터미널을 끄면 HA 중계 연결이 닫힙니다. 등록 정보도 최대 3분 후 만료됩니다. 조회용 토큰으로는 연결 정보를 읽거나 등록할 수 없습니다.

## 대시보드 및 워크플로우 단축키

리소스에 `/carrot_ha_static/carrot-terminal-card.js`를 JavaScript 모듈로 등록합니다.

```yaml
type: custom:carrot-terminal-card
device_id: YOUR_EXISTING_DEVICE_ID
title: Comma 원격 터미널
```

- **화면 자동 확장**: 화면 높이에 맞춰 동적으로 확장되며(`clamp(520px, 68vh, 850px)`), `ResizeObserver` 및 `FitAddon`을 통해 항상 최대 가독성을 유지합니다.
- **자동 프롬프트 출력**: 연결(`연결됨`) 즉시 개행(`\r`)을 자동 전송하여, 별도의 키 입력 없이도 셸 프롬프트(`comma@...:/data/openpilot$ `)가 화면에 표시됩니다.
- **원클릭 워크플로우 버튼**:
  - **`🔍 업데이트 확인`**: 새로 업데이트할 상위 커밋 개수 및 목록을 조회합니다 (`git fetch origin && git status -sb && git log --oneline -n 5 HEAD..@{u}`).
  - **`📥 당근 Git Pull`**: 당근 웹 UI와 동일하게 충돌 없이 최신 코드를 안전하게 내려받습니다 (`git reset --hard && git pull --ff-only`).
  - **`🔄 기기 재부팅`**: 오동작 방지 확인 팝업 승인 후 콤마 기기를 안전하게 재부팅합니다 (`sudo reboot`).

HA 관리자만 제어할 수 있고 동시에 한 관리자 연결만 허용됩니다. Comma는 `IsOffroad=true`, `IsOnroad=false`일 때만 터미널을 허용합니다. 로컬 Carrot Web의 `/ws/terminal_pty`를 사용하므로 기존 support_terminal과 같은 PTY입니다.

## 확인

- 셀룰러만 연결된 주차 상태에서 카드 연결과 프롬프트 자동 출력을 확인합니다.
- 워크플로우 단축키(`🔍 업데이트 확인`, `📥 당근 Git Pull`, `🔄 기기 재부팅`) 동작을 확인합니다.
- Ctrl+C, Tab과 방향키, 두 번째 관리자 제어 거부를 확인합니다.
- Comma 재부팅 후 별도 설정 없이 연결 가능한지 확인합니다.
- Onroad 전환, HA 기능 비활성화, 네트워크 단절 시 제어가 종료되는지 확인합니다.

Worker가 아직 구버전이면 자동 조회 API가 404를 반환하며 Comma는 재시도합니다. 기존 텔레메트리 수집은 계속됩니다. HA 외부 프록시는 `/api/carrot_ha/v1/terminal/{device_id}`의 WebSocket Upgrade와 Authorization 헤더를 전달해야 합니다.


</details>


<details><summary>폐기: docs/COMMA_PARAM_SETUP.md</summary>

# 콤마(Comma 4) 파라미터 원격 제어 가이드

홈 어시스턴트(HA)에서 CarrotPilot 파라미터를 원격으로 제어하고 튜닝하기 위한 아키텍처 및 안전 설정 안내입니다.

> [!NOTE]
> **수동 SCP 파일 복사가 필요 없습니다!**  
> `param_sync.py`를 포함한 파라미터 동기화 모듈은 [`helico717/openpilot`](https://github.com/helico717/openpilot)의 `carrot-wip-model_selector-ha` 브랜치(`openpilot/selfdrive/carrot/ha/param_sync.py`)에 이미 정식 내장되어 있습니다.  
> 콤마 기기에서 해당 브랜치를 사용 중이라면 별도의 파일 복사 없이 즉시 사용할 수 있습니다.

---

## 1. 동작 원리 및 아키텍처

```
┌──────────────────────────────────────────────┐
│  Home Assistant                              │
│  custom:carrot-params-card                   │
│  (UI 슬라이더/토글 조작)                      │
└──────────────────────┬───────────────────────┘
                       │ HTTPS POST (변경 요청 큐 추가)
                       ▼
┌──────────────────────────────────────────────┐
│  Cloudflare Worker + D1 Database             │
│  - param_queue 테이블에 요청 등록             │
│  - SNAPSHOTS KV에 현재 설정 스냅샷 캐싱       │
└──────────────────────▲───────────────────────┘
                       │ HTTPS Polling (매 5~10초 주기)
                       ▼
┌──────────────────────────────────────────────┐
│  Comma 4 (selfdrive/carrot/ha/param_sync)    │
│  1. 큐에서 변경 요청 확인                     │
│  2. 로컬 carrot_server(:7000) 검증 및 적용   │
│  3. 적용 후 실제 저장값 역조회 검증          │
│  4. Cloudflare D1 큐에 완료(Ack) 전송        │
└──────────────────────────────────────────────┘
```

---

## 2. 안전 정책 (Safety Policy)

파라미터 원격 제어는 차량 주행 및 조향 안전과 직결될 수 있으므로 엄격한 안전 정책이 적용됩니다:

1. **활성 카탈로그 및 범위 검증**:
   - `param_sync.py`는 기기의 활성 카탈로그에 존재하는 파라미터 및 정해진 허용 범위 내의 값만 검증하여 수용합니다.
2. **로컬 당근 웹 서버 API 경유 필수**:
   - 변경 요청은 반드시 로컬 당근 웹 서버 API(`http://127.0.0.1:7000/api/param_set`)를 통해서만 전달됩니다.
   - **직접 `Params()` 쓰기 우회(Fallback)는 안전 및 정합성 보장을 위해 전면 배제**되어 있습니다.
3. **적용 후 역조회 검증 (Round-trip Verification)**:
   - 파라미터 적용 직후 실제 저장된 값을 다시 읽어 검증한 후 Cloudflare 큐에 완료(Ack)를 전송합니다.
4. **멱등성 및 중복 방지**:
   - 동일한 요청 ID는 SQLite 로컬 저장소에 기록되어 중복 실행되지 않으며, 이미 처리된 요청은 즉시 Ack만 재전송합니다.

---

## 3. 대시보드 카드 추가 방법

대시보드 리소스에 `/carrot_ha_static/carrot-dashboard.js`가 등록되어 있으면 바로 사용할 수 있습니다:

```yaml
type: custom:carrot-params-card
device_id: my-buzz
```

- 실제 콤마 당근 웹(포트 7000)의 고유 디자인과 카테고리 계층, 토글, 숫자 스텝퍼, 다이얼로그를 그대로 제공합니다.
- 파라미터 클릭 시 공식 GitHub Wiki(`Settings-Catalog.json`)의 상세 마크다운 문서를 직접 로드하여 표시합니다.
- 상단 상태 스트립을 통해 실시간 동기화 상태(`연결됨`, `대기 중`, `Comma 적용 확인`, `오류` 등)와 마지막 수신 시각을 표시합니다.

---

## 4. 업데이트 및 유지보수

- 로직 수정이 필요한 경우:
  - Comma 기기 내부에서 파일을 직접 수정(SSH/SCP)하지 마세요!
  - `helico717/openpilot` 저장소의 `openpilot/selfdrive/carrot/ha/param_sync.py`를 수정한 후 커밋 & 푸시합니다.
  - Comma 기기에서는 Home Assistant의 **Comma 원격 터미널** 카드에서 **`[📥 당근 Git Pull]`** 버튼을 누르거나 당근 웹 UI를 통해 간편하게 업데이트합니다.

</details>


<details><summary>폐기: docs/DEVELOPMENT_WORKFLOW.md</summary>

# 개발 및 배포 워크플로우 가이드

> **핵심 원칙 (AI 에이전트 및 개발자 필독):**
> 🛑 **SSH를 통해 콤마(Comma) 기기 내부의 파일을 직접 수정하거나 복사(SCP)하지 마세요!**
>
> 콤마 4의 openpilot은 Git 저장소(`/data/openpilot`) 기반으로 동작합니다. 기기 내부에서 파일을 직접 수정하거나 임의로 스크립트를 주입하면:
> 1. Git 워킹 트리가 오염되어 `git pull --ff-only`가 실패합니다.
> 2. 상위 저장소(업스트림) 업데이트 시 충돌이 발생하거나 수정한 내용이 유실됩니다.
> 3. 변경 이력이 남지 않아 다른 AI 세션(예: 과거 Astra 등)에서 중복 작업을 유발하고 장애를 일으킵니다.
>
> **모든 Comma 수정 사항은 반드시 Git 커밋과 푸시를 거쳐, 기기에서 `git pull`로 깔끔하게 동기화해야 합니다.**

---

## 1. 2개 저장소 분리 아키텍처

Carrot HA 시스템은 역할에 따라 **2개의 독립된 저장소**로 분리되어 운영됩니다.

```
┌────────────────────────────────────────────────────────┐
│               Comma 4 기기                             │
│                                                        │
│  저장소: helico717/openpilot                            │
│  브랜치: carrot-wip-model_selector-ha                  │
│                                                        │
│  • openpilot/selfdrive/carrot/ha/ (내장 데몬)          │
│    - collector.py (CAN 텔레메트리 수집)                │
│    - engine.py (배터리 및 충전 상태 연산)              │
│    - param_sync.py (파라미터 원격 동기화)              │
│    - terminal.py (주차 시 역방향 WSS 터미널 데몬)      │
│    - wayon_vehicle_telemetry.py (CAN 메시지 파서)      │
│  • system/manager/process_config.py (상주 프로세스 등록)│
│  • .github/workflows/ (업스트림 자동 동기화 액션)      │
└──────────────────────────┬─────────────────────────────┘
                           │ 아웃바운드 HTTPS / WSS
                           ▼
┌────────────────────────────────────────────────────────┐
│               Cloudflare Worker 중계 서버               │
│               id4-ha-cloud.ha-id4.workers.dev          │
│                                                        │
│  • D1 데이터베이스: 텔레메트리 저장 및 파라미터 변경 큐 │
│  • KV 네임스페이스: SNAPSHOTS 설정 스냅샷 캐시          │
│  • WSS 중계: 주차 중 원격 터미널 WebSocket 양방향 브리지│
└──────────────────────────▲─────────────────────────────┘
                           │ 인바운드 HTTPS / WSS
┌──────────────────────────┴─────────────────────────────┐
│               Home Assistant 서버                      │
│                                                        │
│  저장소: helico717/carrot-ha                            │
│  브랜치: main                                          │
│                                                        │
│  • custom_components/carrot_ha/ (HA 커스텀 컴포넌트)    │
│    - sensor, camera, device_tracker, switch 엔터티     │
│    - websocket_api (터미널 및 설정 동기화 연동)        │
│    - frontend/ (Lovelace 전용 카드)                    │
│      * carrot-dashboard.js (차량 상태 대시보드)        │
│      * carrot-params-card.js (파라미터 튜닝)           │
│      * carrot-terminal-card.js (원격 웹 터미널)        │
│  • cloudflare/ (Worker 소스 및 D1 스키마)              │
└────────────────────────────────────────────────────────┘
```

---

## 2. 작업 분류별 가이드: 어디를 수정해야 하나요?

| 변경하고자 하는 내용 | 대상 저장소 및 브랜치 | 수정 대상 경로 | 배포 방법 |
| :--- | :--- | :--- | :--- |
| **차량 CAN 신호 파싱, 배터리 잔량/충전 연산, Comma 텔레메트리** | `helico717/openpilot`<br>(`carrot-wip-model_selector-ha`) | `openpilot/selfdrive/carrot/ha/` | 커밋 & 푸시 후 Comma에서 `git pull` |
| **Comma 내 파라미터 동기화(param_sync) 로직** | `helico717/openpilot`<br>(`carrot-wip-model_selector-ha`) | `openpilot/selfdrive/carrot/ha/param_sync.py` | 커밋 & 푸시 후 Comma에서 `git pull` |
| **Comma 내 역방향 터미널(terminal.py) 클라이언트** | `helico717/openpilot`<br>(`carrot-wip-model_selector-ha`) | `openpilot/selfdrive/carrot/ha/terminal.py` | 커밋 & 푸시 후 Comma에서 `git pull` |
| **HA 센서, 코디네이터, 엔터티 속성** | `helico717/carrot-ha`<br>(`main`) | `custom_components/carrot_ha/` | 커밋 & 푸시 후 HA 재시작 |
| **HA 대시보드 카드, 파라미터 카드, 터미널 카드 UI** | `helico717/carrot-ha`<br>(`main`) | `custom_components/carrot_ha/frontend/` | 커밋 & 푸시 후 브라우저 새로고침 (`Ctrl+F5`) |
| **Cloudflare Worker API 엔드포인트 및 D1 쿼리** | `helico717/carrot-ha`<br>(`main`) | `cloudflare/src/worker.js` | `cd cloudflare && npx wrangler deploy` |

---

## 3. 수정 사항 배포 절차

### 1) Comma 기기 코드 배포 (`helico717/openpilot`)

1. **로컬 수정 및 테스트**:
   - `c:\Users\limkw\OneDrive\Documents\GitHub\openpilot`에서 작업합니다.
   - 브랜치가 `carrot-wip-model_selector-ha`인지 확인합니다.
   - 테스트 실행:
     ```bash
     python -m unittest discover openpilot/selfdrive/carrot/ha/tests
     ```
2. **커밋 및 푸시**:
   ```bash
   git add <수정된 파일>
   git commit -m "feat(carrot-ha): <변경 내용 요약>"
   git push origin carrot-wip-model_selector-ha
   ```
3. **Comma 기기에 원격 반영 (SSH 접속 불필요!)**:
   - **방법 1 (가장 추천 - HA 터미널 카드 단축 버튼 사용)**:
     1. Home Assistant에서 **Comma 원격 터미널** 카드를 엽니다.
     2. **[연결]** 버튼 클릭.
     3. **`[📥 당근 Git Pull]`** 버튼 클릭!  
        *(기기에서 `cd /data/openpilot && git reset --hard && git pull --ff-only`가 실행되어 충돌 없이 깔끔하게 반영됩니다.)*
     4. **`[🔄 기기 재부팅]`** 버튼 클릭하여 재부팅 완료.
   - **방법 2 (당근 웹 UI)**:
     - 콤마 당근 웹 화면(`http://<comma-ip>:7000`)의 업데이트 버튼 클릭.

---

### 2) Home Assistant 통합 코드 배포 (`helico717/carrot-ha`)

1. **로컬 수정 및 검증**:
   - `custom_components/carrot_ha/` 내의 파이썬 코드 또는 `frontend/` 내 자바스크립트 카드 수정.
   - 자바스크립트 문법 검사: `node --check custom_components/carrot_ha/frontend/<파일>.js`
2. **커밋 및 푸시**:
   ```bash
   git add <수정된 파일>
   git commit -m "feat: <변경 내용 요약>"
   git push origin main
   ```
3. **HA에 반영**:
   - HA 환경에서 최신 저장소 반영(HACS 업데이트 또는 git pull).
   - **개발자 도구 → YAML → 다시 시작**으로 HA 재시작.
   - 웹 브라우저에서 `Ctrl + F5` (강력 새로고침)로 프론트엔드 캐시 갱신.

---

### 3) Cloudflare Worker 배포

1. `cloudflare/` 디렉터리로 이동:
   ```bash
   cd cloudflare
   ```
2. Wrangler로 배포:
   ```bash
   npx wrangler deploy
   ```

---

## 4. 원격 터미널 활용 및 안전 수칙

- **주차 상태 자동 연결**:
  - Comma가 주차(`IsOffroad=true`) 상태일 때 셀룰러나 와이파이를 통해 Cloudflare Worker로 안전한 역방향 터미널 세션을 맺습니다.
  - 별도의 포트포워딩이나 Tailscale 상시 구동 없이도 집이나 외부 어디서나 HA 대시보드에서 접속할 수 있습니다.
- **워크플로우 전용 버튼**:
  - `🔍 업데이트 확인`: 새로 들어온 커밋 개수와 내역 확인 (`git fetch origin && git status -sb && git log --oneline -n 5 HEAD..@{u}`)
  - `📥 당근 Git Pull`: 충돌 없이 안전한 최신 코드 반영 (`git reset --hard && git pull --ff-only`)
  - `🔄 기기 재부팅`: 안전 팝업 확인 후 기기 재부팅 (`sudo reboot`)
- **주의 사항**:
  - 터미널을 통해 기기 내부 파일을 직접 `vi`나 `nano`로 편집하지 마세요. 모든 소스코드 변경은 반드시 로컬 Git 저장소에서 진행하고 푸시한 뒤 `Git Pull`을 통해 내려받아야 합니다.

</details>


<details><summary>폐기: docs/PUBLISH.md</summary>

# helico717 계정으로 처음 공개하기

한국어 | [English](PUBLISH.en.md)

이 폴더의 소스 파일을 GitHub에 올립니다. 개인 PC의 outputs 전체나 DB 파일을 올리는 것이 아닙니다.

1. github.com에서 helico717 계정으로 로그인합니다.
2. 오른쪽 위 + → New repository → 이름 `carrot-ha` → Public → Create repository.
3. GitHub Desktop을 설치하고 같은 계정으로 로그인합니다. File → Clone repository에서 방금 만든 저장소를 선택합니다.
4. 복제한 폴더에 이 배포 폴더의 내용을 복사합니다. 최상단에 README.md, hacs.json, custom_components 폴더가 보여야 합니다.
5. 변경 파일 목록을 검토합니다. connection.json, wrangler.json, DB, 로그, 토큰, 개인 사진/경로가 없어야 합니다.
6. Summary에 `Prepare 0.4.0` → Commit to main → Push origin.
7. GitHub 저장소의 Actions 결과를 확인합니다. 실패가 있으면 공개 릴리스 전에 수정합니다.
8. Releases → Draft a new release → 새 태그 `v0.4.0`, 제목 `Carrot HA 0.4.0`. 변경 내용과 미검증 차량 조건을 적고 최초 릴리스는 pre-release로 검증한 뒤 정식 공개합니다.

HACS 사용자들은 저장소 주소를 Custom repositories에 추가해 설치합니다. HACS 기본 목록에 등재되는 것과 별개입니다.


</details>


<details><summary>폐기: docs/PUBLISH.en.md</summary>

# Publishing

[한국어](PUBLISH.md) | English | [Overview](../README.en.md)

Upload the repository source, not the entire local outputs directory or your databases.

## Initial publication (maintainer)

1. Sign in to GitHub as `helico717`.
2. If the repository does not exist, choose + → New repository → `carrot-ha` → Public → Create repository.
3. Sign in to GitHub Desktop and clone the repository using File → Clone repository.
4. Copy the release folder's **contents** into the clone. `README.md`, `hacs.json`, and `custom_components` must be at the repository root, not inside another release folder.
5. Review changed files. Exclude `connection.json`, `wrangler.json`, databases, logs, tokens, and personal vehicle images or routes.
6. Enter a commit summary, commit to main, and Push origin.
7. Check the repository's Actions results if workflows are present. Resolve failures before releasing.
8. Open Releases → Draft a new release. Use a tag matching `manifest.json` (for example `v0.4.1` for version `0.4.1`). Describe changes and unverified vehicle support. Test initial builds as pre-releases before publishing a stable release.

Users add the repository URL to HACS Custom repositories. This is separate from inclusion in the HACS default list.


</details>

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

## 3. PC에서 수집기 전체 복사

호환되는 배포 버전의 저장소 ZIP을 다운로드하고 압축을 풉니다. 실험용 과거 브랜치나 engine.py 하나만 복사하지 마세요. 폴더 안에 `collector`, `custom_components`, `README.md`가 보여야 합니다.

먼저 SSH로 접속해 기존 파일 유무를 확인할 수 있습니다.

```text
ssh comma@192.168.43.1 'ls -ld /data/id4-collector'
```

`No such file or directory`이면 클린 설치에서 정상입니다. 이미 수집기나 `connection.json`이 남아 있다면 덮어쓰기 전에 상태·백업을 확인하고 [기존 수집기 교체 가이드](COMMA-DEPLOY-ENGINE.md)를 사용하세요.

### Windows PowerShell

첫 줄의 경로를 실제 압축 해제 폴더로 바꾸세요. 아래 예시는 사용자 Downloads입니다.

```powershell
Set-Location "$env:USERPROFILE\Downloads\carrot-ha-main"
ssh comma@192.168.43.1 'mkdir -p /data/id4-collector'
scp .\collector\collector.py .\collector\engine.py .\collector\configure.py .\collector\install.py .\collector\disable.py .\collector\status.py .\collector\wayon_vehicle_telemetry.py .\collector\supervisor.sh .\collector\param_sync.py .\collector\LICENSE.reference comma@192.168.43.1:/data/id4-collector/
ssh comma@192.168.43.1 'ls /data/id4-collector'
```

명령은 한 줄씩 실행하고 실패 시 다음으로 넘어가지 마세요. WinSCP를 쓴다면 같은 계정·키·포트로 접속해 위 10개 파일을 `/data/id4-collector` **바로 안에** 복사해도 됩니다.

### Mac 터미널

첫 줄의 경로를 실제 압축 해제 폴더로 바꾸세요.

```bash
cd "$HOME/Downloads/carrot-ha-main"
ssh comma@192.168.43.1 'mkdir -p /data/id4-collector'
scp collector/collector.py collector/engine.py collector/configure.py collector/install.py collector/disable.py collector/status.py collector/wayon_vehicle_telemetry.py collector/supervisor.sh collector/param_sync.py collector/LICENSE.reference comma@192.168.43.1:/data/id4-collector/
ssh comma@192.168.43.1 'ls /data/id4-collector'
```

각 파일에 `100%`가 표시되고 마지막 목록에 10개 파일이 있으면 전송 완료입니다. `/data/id4-collector/collector/`처럼 한 단계 더 들어간 위치에 넣지 마세요. 파일 복사만으로 수집기가 시작되지는 않습니다.

## 4. 콤마에서 연결 정보 입력

**PC 터미널에서 접속:**

```text
ssh comma@192.168.43.1
```

**이후는 Windows/Mac 모두 콤마 SSH 안에서 실행:**

```bash
cd /data/id4-collector
python3 configure.py
```

| 질문 | 입력 |
|---|---|
| `Worker HTTPS URL:` | 1절에서 확인한 기존 Worker 기본 HTTPS 주소 |
| `Device ID (same as HA):` | 기존 HA의 Device ID 그대로 |
| `UPLOAD token (hidden):` | 기존 또는 재발급한 UPLOAD 토큰. 붙여넣어도 화면에 표시되지 않는 것이 정상 |

`Saved. Next run install.py while parked.`가 나오면 저장 성공입니다.

`connection.json already exists`는 기존 설정을 보호하기 위한 중단입니다. 무작정 삭제하지 마세요. 오입력 직후이고 아직 설치·실행하지 않은 경우에만 아래처럼 백업 이름으로 옮긴 뒤 다시 설정할 수 있습니다. 실행 중인 수집기라면 먼저 교체 가이드의 중단 절차를 따르세요.

```bash
mv /data/id4-collector/connection.json "/data/id4-collector/connection.json.backup-$(date +%Y%m%d-%H%M%S)"
python3 /data/id4-collector/configure.py
```

백업에도 토큰이 들어 있으므로 저장소나 문의에 첨부하지 마세요.

## 5. 콤마에서 설치·자동 시작 등록

차량 전원을 끄고 콤마가 대기 화면인 상태에서 실행합니다. 절대 경로를 사용하므로 현재 폴더가 `/data/openpilot`이어도 됩니다.

```bash
PYTHONPATH="/data/openpilot/pydeps:/data/openpilot${PYTHONPATH:+:$PYTHONPATH}" /usr/local/venv/bin/python3 /data/id4-collector/install.py
```

`Installed. Git checkout unchanged.`가 나오면 시작 및 부팅 시 자동 실행 등록 성공입니다.

| 오류 | 행동 |
|---|---|
| `Install while parked/offroad. Nothing changed.` | P만 놓지 말고 차량 전원을 끈 뒤 콤마 대기 화면을 기다립니다. IsOnroad 검사를 강제로 우회하지 않습니다. |
| `can't open file … install.py` | 위 절대 경로 명령과 3절 파일 목록을 확인합니다. |
| `/usr/local/venv/bin/python3` 없음 | Carrotpilot 설치 완료와 사용 브랜치의 실행 환경을 확인합니다. 임의 시스템 Python으로 강제 설치하지 않습니다. |
| `Unsupported startup file` / `Unrecognized continue.sh` / 모듈·DBC 오류 | 중단하고 오류와 Carrotpilot 브랜치·커밋을 기록해 호환성을 확인합니다. |
| `^M`, `bad interpreter` | 파일이 Windows 편집기에서 CRLF로 변환됐는지 확인하고 원본 LF 파일을 다시 전송합니다. |

## 6. 콤마 → 서버 전송 검증

설치 후 **90초 기다렸다가** 콤마 SSH에서 실행합니다.

```bash
python3 /data/id4-collector/status.py
tail -n 30 /data/id4-collector/collector.log
```

다시 60~90초 기다린 뒤 같은 명령으로 **시각이 갱신되는지** 확인하세요.

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

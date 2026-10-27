# HA·Comma 초기화 후 복구 안내

연결 경로·주소·인증·장애 범위: [현재 연결 구조](CURRENT_CONNECTION_ARCHITECTURE.md).


이 문서는 실수로 초기화했거나 저장장치 고장으로 새로 설치해야 할 때 사용합니다.
평소 업데이트에는 초기화가 필요 없습니다. **먼저 백업 복원을 시도하세요.**
현재 구성은 차량 → 집의 차량 수신 앱 → HA입니다. Cloudflare 계정을 만들거나
옛 Worker 설치 명령을 실행할 필요가 없습니다.

## 1. 지금 어떤 상황인가요?

| 상황 | 따라갈 곳 | 그대로 남는 것 |
| --- | --- | --- |
| HA만 새로 설치 | 4번 | Comma에 남아 있는 연결 설정·아직 전송하지 못한 기록 |
| Comma만 새로 설치 | 5번 | 집 서버에 이미 저장된 주행·차계부·사진 |
| 둘 다 새로 설치 | 6번 | 기기 밖에 보관한 백업만 확실히 남음 |

**초기화하지 않은 쪽도 함께 지우지 마세요.** 다른 쪽에 남은 기록이 복구에 도움이 됩니다.
백업 없이 이미 지워진 과거 기록·사진은 이 안내로 되살릴 수 없습니다.
Comma는 집에 보내지 못한 기록을 잠시 보관하지만 모든 과거 기록의 백업은 아닙니다.

## 2. 문제가 생기기 전에 준비할 것

### HA 백업: 컴퓨터에도 한 벌 저장

1. HA에서 **설정 → 시스템 → 백업**을 엽니다.
2. 백업을 만들 때 **Home Assistant, Carrot Vehicle Receiver, 외부 접속에 쓰는 앱**을
   함께 포함합니다. 예를 들어 Duck DNS와 Nginx Proxy Manager를 사용한다면 둘 다 포함합니다.
3. Carrot의 기록·차계부·사진은 HA의 `/config/carrot_ha` 안에 있습니다.
   이 폴더가 포함된 HA 백업을 선택하세요. 외부/NAS에 둔 자료는 그 저장소에서도 백업합니다.
4. 백업 파일을 컴퓨터 또는 NAS에 다운로드합니다. 라즈베리파이에만 두면 저장장치 고장 때 함께 잃습니다.
5. 백업의 **암호화 복구 키/비밀번호**도 비밀번호 관리 앱에 보관합니다.
6. 새 설치 전에 마지막 백업 날짜와 파일이 실제로 내려받아졌는지 확인합니다.

수신 앱 백업은 잠시 앱을 멈춘 뒤 만들어집니다. 그동안 Comma는 전송할 자료를 기다렸다가
다시 보냅니다. 일반적인 **Home Assistant 다시 시작**은 수신 앱을 멈추지 않습니다.
라즈베리파이 전체 재부팅·정전·인터넷 중단에서는 실시간 카메라·터미널을 사용할 수 없습니다.
동영상/rlog 원본은 용량이 큽니다. 이 파일까지 되살리고 싶다면 실제 저장 위치도 백업에 넣으세요.

### 연결 정보: 비밀번호 관리 앱에 보관

다음 표를 개인 보관용으로 채워 두세요. 이 값은 GitHub·공개 게시판·채팅에 올리지 마세요.

| 보관할 항목 | 어디에서 확인하나요? |
| --- | --- |
| HA 외부 주소 | 예: `https://homeassistant202604.duckdns.org` |
| 차량 ID | HA의 Carrot HA 설정과 수신 앱의 `device_id` — 두 곳이 같아야 함 |
| 차량 업로드 키 | 수신 앱 구성의 `upload_token` |
| HA 조회 키 | 수신 앱 구성의 `view_token` — 업로드 키와 다른 값 |
| HA 통합의 기기 키 | Carrot HA를 처음 추가할 때 입력한 `token` |
| 카메라 키 | Carrot HA 구성의 `camera_token` |
| 외부 접속 설정 | Duck DNS 계정/주소, 공유기 443 포트 연결, 프록시 설정 |
| Comma 소스 | `helico717/openpilot`, `carrot-wip-model_selector-ha` |
| Comma SSH 키 | 본인 GitHub 계정에 등록한 공개키에 대응하는 개인키 |

키는 접속용 비밀번호입니다. 각각 다른 **32자 이상 랜덤 값**을 사용합니다.
비밀번호 관리 앱에서 생성하세요. SSH 개인키는 컴퓨터의 `.ssh` 폴더에 보관하고 공개키만 GitHub에 등록합니다.

## 3. HA를 백업 없이 새로 설정하는 공통 순서

백업을 복원했다면 이 절차를 처음부터 다시 하지 말고 4번의 복원 확인으로 이동하세요.

1. 라즈베리파이 4용 HAOS를 설치하고 처음 안내 화면에서 계정을 만듭니다.
   Windows와 Mac 모두 Raspberry Pi Imager를 설치해 실행하고
   **운영체제 선택 → Other specific-purpose OS → Home automation → Home Assistant → RPi 4**를 선택합니다.
   대상 SD/SSD를 선택하면 **그 장치의 내용이 지워지므로 기존 백업 장치를 선택하지 마세요.**
   쓰기가 끝나면 라즈베리파이에 연결하고 유선 인터넷과 전원을 연결합니다.
   컴퓨터에서 `http://homeassistant.local:8123`을 열어 첫 설정을 진행합니다.
   기존 방식과 같은 64비트 HAOS를 사용하세요. 공식 설치 안내:
   [라즈베리파이 설치](https://www.home-assistant.io/installation/raspberrypi/).
2. HACS를 설치합니다. [HACS 안내](https://www.hacs.xyz/docs/use/download/download/)를
   따라 진행합니다. HA를 재시작한 뒤 **설정 → 기기 및 서비스 → 통합 추가 → HACS**를
   추가하고 GitHub 연결 안내를 완료합니다. HACS에서 우측 **⋮ → 사용자 지정 저장소**에
   `https://github.com/helico717/carrot-ha`를 추가하고 종류는 **Integration(통합)**을 선택합니다.
   Carrot HA를 다운로드합니다. 베타 설치는 저장소 화면의 **베타 버전 표시**를 켭니다.
   다운로드 후 HA를 다시 시작합니다.
3. **설정 → 앱(구버전에서는 애드온) → 앱 스토어 → 우측 ⋮ → 저장소**에
   `https://github.com/helico717/carrot-ha`를 추가합니다.
4. **Carrot Vehicle Receiver**를 설치하고 **구성**에서 아래 항목을 채웁니다.
   `YOUR_...` 글자를 그대로 넣지 말고 개인 보관 정보 또는 새로 생성한 값으로 바꿉니다.

```yaml
devices:
  - device_id: YOUR_EXISTING_DEVICE_ID
    upload_token: YOUR_RANDOM_UPLOAD_TOKEN
    view_token: YOUR_DIFFERENT_RANDOM_VIEW_TOKEN
max_database_mb: 1024
public_url: "https://homeassistant202604.duckdns.org/carrot-receiver"
log_level: INFO
debug_minutes: 15
```

5. 저장 후 **자동 시작**, **Watchdog(앱이 멈추면 다시 시작)**를 켜고 **시작**을 누릅니다.
   로그에 `receiver_started`가 보이면 앱이 시작된 것입니다.
6. 기존 외부 주소가 이 집 서버를 가리키도록 Duck DNS와 공유기 설정을 복구합니다.
   공유기의 외부 443 포트는 사용 중인 HTTPS 프록시로 연결합니다.
   집 인터넷이 외부 접속을 허용하지 않으면 먼저 외부 접속 문제를 해결해야 합니다.
7. HTTPS 프록시에 차량 수신 경로를 추가합니다. **HA 화면으로 보내는 기존 경로는 유지**합니다.
   Nginx Proxy Manager를 사용한다면 아래 내용을 적용합니다. 다른 앱이라면 해당 앱의
   경로 연결 방법을 사용하며 설정 파일 위치를 그대로 따라하지 마세요.

### Nginx Proxy Manager: 차량 수신 경로 복구

이 부분은 외부에서 들어온 `/carrot-receiver/` 요청을 수신 앱에 전달하는 설정입니다.
백업에 이미 들어 있다면 다시 만들 필요가 없습니다.

1. 앱 정보에서 수신 앱의 **Hostname(앱 내부 이름)**을 확인합니다. 현재 설치 값은
   `874ccb4c-carrot-receiver`입니다. 다른 설치에서는 앞부분이 달라질 수 있습니다.
   값을 확인할 수 없다면 HA 웹 화면의 Terminal & SSH 앱에서 아래 명령으로 정보만 확인하세요.
   이 명령은 Windows/Mac 컴퓨터 터미널이 아니라 HA 웹 터미널에 입력합니다.

```sh
ha addons info 874ccb4c_carrot_receiver
```

2. File editor 또는 Studio Code Server에서 Nginx Proxy Manager의 설정 폴더를 엽니다.
   현재 HAOS 앱의 경로는 `/addon_configs/a0d7b954_nginxproxymanager/nginx/custom/`입니다.
   앱 버전·설치 방식이 다르면 폴더 위치를 먼저 확인하세요.
3. 그 폴더의 `server_proxy.conf` 끝에 아래 블록을 추가합니다.
   파일이 없으면 만듭니다. 기존 내용은 지우지 않습니다.
   도메인과 수신 앱 Hostname은 본인 값으로 바꿉니다. 같은 블록을 두 번 추가하지 마세요.

```nginx
location ^~ /carrot-receiver/ {
    if ($host != homeassistant202604.duckdns.org) { return 404; }
    proxy_pass http://874ccb4c-carrot-receiver:8099/;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Host $host;
    client_max_body_size 1m;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

4. Nginx Proxy Manager를 다시 시작합니다. 인증서도 해당 도메인으로 복구/발급합니다.
5. **휴대전화 Wi-Fi를 끄고** 아래 주소를 열어 외부 접속을 확인합니다.
   `https://homeassistant202604.duckdns.org/carrot-receiver/health`
   `ok`와 앱 버전이 표시되면 경로가 열렸습니다. 이 확인은 차량 기록 저장 확인과는 다릅니다.
   인증이 필요한 자료 조회 주소가 비밀번호 없이 열리도록 설정하지 마세요.

### HA 통합과 화면 연결

1. **설정 → 기기 및 서비스 → 통합 추가 → Carrot HA**에서 기존 차량 ID와 별도 기기 키를 넣습니다.
2. 통합의 **구성**을 열고 다음 값을 설정합니다.
   - 자체 수신기 주소: `http://874ccb4c-carrot-receiver:8099` — 실제 Hostname으로 변경.
   - 수신기 조회 키/업로드 키: 수신 앱에서 설정한 각각의 값.
   - 원격 터미널: 켬. HA 외부 HTTPS 주소: `https://homeassistant202604.duckdns.org`.
   - 주차 카메라: 사용한다면 켬. 기존 카메라 키 또는 새 별도 키 입력.
3. 저장하고 HA를 다시 시작합니다. 차량 ID가 다른 새 통합을 중복 추가하지 마세요.
4. 기존 백업이 없다면 대시보드 카드도 다시 추가합니다.

```yaml
type: custom:carrot-dashboard-card
device_id: YOUR_EXISTING_DEVICE_ID
```

```yaml
type: custom:carrot-terminal-card
device_id: YOUR_EXISTING_DEVICE_ID
title: Comma 원격 터미널
```

리소스 등록이나 카드 이름은 [화면 안내](GUIDE.md)를 참고하세요.
카메라·터미널 주소도 프록시가 HA에 전달해야 하며 터미널의 WebSocket 연결을 허용해야 합니다.

## 4. HA만 초기화한 경우

### 백업이 있다면 — 가장 쉬운 방법

1. 새 HAOS 첫 화면에서 **백업 복원**을 선택하고 컴퓨터에 저장한 백업을 올립니다.
2. HA와 수신 앱, 외부 접속 앱을 함께 복원합니다. 암호화 키를 입력하고 완료될 때까지 기다립니다.
3. 외부 주소와 공유기 연결이 새 HA의 IP를 가리키는지 확인합니다.
4. 수신 앱이 시작됐는지, 과거 차계부/주행/사진이 보이는지 확인합니다.
5. Comma가 켜져 있고 인터넷에 연결되어 있다면 새 측정 시각이 갱신되는지 확인합니다.
6. 차량 ID·주소·키를 그대로 복원했다면 **Comma를 초기화하거나 다시 설정할 필요가 없습니다.**
7. 다른 라즈베리파이로 옮겼다면 예전 수신 앱은 중지하세요. 두 서버를 동시에 쓰지 않습니다.

### 백업이 없다면

1. 3번으로 HA와 수신 앱을 새로 설치합니다.
2. 개인 보관한 기존 차량 ID·업로드 키·조회 키·주소가 있다면 그대로 사용합니다.
   기존 Comma 연결 설정과 일치하면 차량에서 자동으로 다시 연결합니다.
3. 기존 키를 잃었거나 주소를 변경했다면 7번으로 Comma 연결 설정을 다시 입력합니다.
   차량 원격 터미널은 연결이 복구된 뒤에만 사용할 수 있으므로 첫 설정은 차량 근처에서 합니다.
4. 기존 HA 저장소가 지워졌고 다른 백업도 없으면 과거 주행/차계부/사진은 복구되지 않습니다.
   아직 Comma가 전송하지 못하고 보관 중인 자료만 다시 들어올 수 있습니다.

## 5. Comma만 초기화한 경우

1. **HA와 수신 앱은 그대로 두세요.** 집에 저장된 기록을 지울 이유가 없습니다.
2. Comma 첫 설치 화면에서 사용자 소프트웨어 설치를 선택하고 아래 주소를 입력합니다.
   `installer.comma.ai/helico717/carrot-wip-model_selector-ha`
   이 주소는 **helico717/openpilot의 HA 브랜치**를 지정합니다. 다운로드·설치가 끝날 때까지 기다립니다.
   [Comma의 설치 주소 방식](https://github.com/commaai/openpilot/blob/master/docs/how-to/turn-the-speed-blue.md)을 따릅니다.
   일반 원작 브랜치에는 HA 연결 코드가 없을 수 있습니다. 이 문서 작성 시 실제 클린 설치 시험은 아직 하지 않았습니다.
3. 이미 저장소가 설치되어 있다면 7번에서 소스/브랜치를 먼저 확인합니다.
4. 7번으로 기존 외부 주소·차량 ID·업로드 키를 입력합니다. 새로운 차량 ID를 만들지 않습니다.
5. 카메라 설정도 지워졌다면 8번으로 카메라를 다시 설정합니다.
6. Comma를 재부팅하고 9번을 확인합니다. HA의 과거 기록은 그대로 이어집니다.

Comma를 완전히 지우면 차량에만 남아 있던 미전송 자료는 잃을 수 있습니다.
자료가 필요하다면 초기화 전에 별도 백업을 준비하세요. Git Pull은 개인 설정 백업이 아닙니다.

## 6. HA와 Comma를 둘 다 초기화한 경우

1. **집 서버부터 복구합니다.** 백업이 있으면 4번의 백업 복원을, 없으면 3번을 진행합니다.
2. 휴대전화 외부 접속으로 수신기의 `/health`가 열리는지 확인합니다.
3. 차량 ID와 키를 확정한 뒤 5번으로 Comma를 설치하고 7번으로 연결합니다.
4. 8번으로 카메라를 설정하고 기기를 재부팅합니다.
5. 9번의 점검을 마친 다음 새 백업을 컴퓨터에 저장합니다.

둘 다 백업이 없다면 새 기록부터 시작합니다. 예전 수신 DB·차계부·사진을 새 설치만으로
되살릴 수 없습니다. 다른 디스크/NAS 백업이 있다면 먼저 보존하고 해당 복원 절차를 사용하세요.

## 7. 차량 근처에서 처음 연결 설정하기 — Windows / Mac

이 절차는 **초기화 후 첫 설정 또는 원격 연결을 잃었을 때만** 필요합니다.
평소에는 HA 원격 터미널의 업데이트 기능을 사용합니다.
차량 코드를 직접 복사하거나 편집하는 절차가 아닙니다. 설치된 프로그램에 연결 비밀번호만 입력합니다.

### 준비

1. 차량은 주차 상태로 둡니다.
2. 컴퓨터와 Comma를 같은 Wi-Fi에 연결하고 Comma 화면에서 IP 주소를 확인합니다.
   `192.168.43.1`은 Comma 핫스팟을 사용할 때의 예시일 뿐입니다.
3. Comma 설정에서 SSH(컴퓨터에서 기기 명령창에 접속하는 기능)를 켜고 본인 GitHub 사용자 이름을 입력합니다.
   GitHub에는 아래에서 만든 **공개키(.pub)**를 등록합니다.
   [Comma 공식 SSH 안내](https://github.com/commaai/openpilot/blob/master/docs/how-to/connect-to-comma.md).
4. 컴퓨터에 Git, Python 3, SSH가 필요합니다. Windows는 PowerShell을, Mac은 터미널 앱을 엽니다.
   기존 SSH 키가 있으면 새로 만들지 말고 그 키를 사용하세요.

### Windows PowerShell

아래 명령은 새 복구용 키를 만들 때만 실행합니다. 기존 파일이 있다는 질문이 나오면
덮어쓰지 말고 중단하세요. 출력되는 `.pub` 내용은 GitHub → Settings → SSH and GPG keys에 등록합니다.

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\carrot_recovery"
Get-Content "$env:USERPROFILE\.ssh\carrot_recovery.pub"
```

`192.168.0.50`을 Comma 화면의 실제 IP로 바꿉니다.

```powershell
$commaIP = "192.168.0.50"
Test-NetConnection -ComputerName $commaIP -Port 22
ssh -i "$env:USERPROFILE\.ssh\carrot_recovery" "comma@$commaIP"
```

### Mac 터미널

새 키가 필요한 경우만 실행합니다. 기존 키를 덮어쓰지 마세요. `.pub` 내용을 GitHub에 등록합니다.

```sh
ssh-keygen -t ed25519 -f "$HOME/.ssh/carrot_recovery"
cat "$HOME/.ssh/carrot_recovery.pub"
```

실제 Comma IP로 바꿉니다.

```sh
COMMA_IP="192.168.0.50"
nc -vz "$COMMA_IP" 22
ssh -i "$HOME/.ssh/carrot_recovery" "comma@$COMMA_IP"
```

처음 접속할 때 표시되는 기기가 본인 Comma인지 확인한 뒤 연결을 허용합니다.
초기화 후 “REMOTE HOST IDENTIFICATION HAS CHANGED”가 나오면 실제 기기/IP를 먼저 확인합니다.
확인한 기기의 옛 등록만 지우려면 Windows는 `ssh-keygen -R $commaIP`, Mac은
`ssh-keygen -R "$COMMA_IP"`를 사용합니다. 모르는 주소의 경고를 무조건 무시하지 마세요.

### Comma에 연결된 창에서 소스 확인 — 두 운영체제 공통

```sh
cd /data/openpilot
git remote -v
git branch --show-current
git status --short
```

`origin`이 `helico717/openpilot`, 브랜치가 `carrot-wip-model_selector-ha`,
마지막 명령의 출력이 비어 있어야 합니다. 개인 수정 파일이 나오면 강제로 지우지 마세요.
다른 저장소가 설치되어 있다면 여기서 멈추고 올바른 CarrotPilot 설치부터 진행합니다.
올바른 저장소의 깨끗한 상태인데 브랜치만 다르다면:

```sh
git fetch origin carrot-wip-model_selector-ha
git switch carrot-wip-model_selector-ha
```

브랜치가 없다고 나오면 대신 `git switch --track origin/carrot-wip-model_selector-ha`를 실행합니다.
전환이나 Pull이 실패하면 `reset --hard`로 강제 처리하지 말고 오류 내용을 확인합니다.

```sh
git pull --ff-only
exit
```

### 연결 주소와 업로드 키 입력 — 컴퓨터 창에서

아래 도구는 키를 화면에 보이지 않게 묻고 Comma의 설치된 설정 프로그램에 전달합니다.
키가 명령 기록에 들어가지 않습니다. 이 단계에서는 HA 조회 키가 아닌 **업로드 키**를 넣습니다.
Git 저장소를 다운로드할 폴더는 아직 존재하지 않는 새 폴더를 사용합니다.

Windows PowerShell:

```powershell
cd "$env:USERPROFILE\Downloads"
git clone https://github.com/helico717/carrot-ha.git carrot-ha-recovery
cd carrot-ha-recovery
py -3 tools/receiver-recovery.py --host $commaIP --identity "$env:USERPROFILE\.ssh\carrot_recovery"
```

`py`가 없지만 `python --version`이 Python 3이라면 마지막 명령의 `py -3`을 `python`으로 바꿉니다.

Mac:

```sh
cd "$HOME/Downloads"
git clone https://github.com/helico717/carrot-ha.git carrot-ha-recovery
cd carrot-ha-recovery
python3 tools/receiver-recovery.py --host "$COMMA_IP" --identity "$HOME/.ssh/carrot_recovery"
```

질문에 순서대로 답합니다.

| 화면 질문 | 입력할 값 |
| --- | --- |
| External receiver HTTPS URL | `https://homeassistant202604.duckdns.org/carrot-receiver` |
| Existing receiver device ID | 수신 앱의 기존 `device_id` |
| Receiver upload token | 수신 앱의 `upload_token` — 입력 글자가 안 보여도 정상 |

`Configuration saved`가 보이면 설정이 저장됐습니다. 재부팅은 8번의 카메라 설정까지 마친 뒤 합니다.
연결 거절/시간 초과면 IP·같은 Wi-Fi·SSH 켜짐을 확인하고, Permission denied면 GitHub 공개키와 개인키를 확인합니다.

## 8. 카메라 설정과 재부팅

카메라 설정을 복원했고 키·주소가 같다면 다시 입력하지 않습니다.
초기화로 지워졌다면 먼저 컴퓨터에서 다시 연결합니다.

Windows PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\carrot_recovery" "comma@$commaIP"
```

Mac:

```sh
ssh -i "$HOME/.ssh/carrot_recovery" "comma@$COMMA_IP"
```

Windows와 Mac 모두 **Comma에 연결된 창**에서 다음을 실행합니다.

```sh
cd /data/openpilot
python3 -m openpilot.selfdrive.carrot.ha.camera.configure
```

Python 패키지를 찾지 못하고 `.venv/bin/python`이 있다면 `python3` 대신 `.venv/bin/python`을 사용합니다.
HA 외부 기본 주소(`/carrot-receiver`를 붙이지 않음), 기존 차량 ID,
HA 구성의 **카메라 전용 키**를 입력합니다. 이미 켜진 카메라의 설정을 바꿀 경우 먼저
같은 명령 끝에 `--disable`을 붙여 실행합니다.

```sh
python3 -m openpilot.selfdrive.carrot.ha.camera.configure --enable
sudo reboot
```

설정 때와 같은 Python 실행 파일을 사용합니다. 재부팅으로 SSH 창 연결이 끊기는 것은 정상입니다.
영상/rlog 수신과 터미널은 HA의 원격 터미널 설정을 바탕으로 연결됩니다.
차량 ID·HA 외부 주소·수신 업로드 키가 맞아야 합니다.

## 9. 복구 성공 확인

1. 수신 앱 로그에 시작 버전과 최근 수신/저장 요약이 보입니다.
2. 대시보드의 **실제 측정 시각**이 새로 갱신됩니다. 서버 확인 시각만 새로워진 것은 충분하지 않습니다.
3. 주차 상태에서 HA 원격 터미널이 연결됩니다.
4. 주차 카메라를 열어 영상이 나오고, 주행 상태에서는 카메라가 차단됩니다.
5. 평소 주행 후 일반 **주행 내역**에 새 기록이 생기는지 확인합니다.
   당근웹 영상/rlog 목록과 일반 주행 내역은 서로 다른 목록입니다.
6. 파라미터 화면에서 현재 값을 읽을 수 있는지 확인합니다. 주행 중 시험용 설정 변경은 하지 않습니다.
7. 백업을 복원했다면 과거 차계부·사진·주행 기록도 확인합니다.
8. HA만 다시 시작해도 수신 앱이 실행 상태를 유지하는지 확인합니다.
9. 새 백업을 컴퓨터에 다운로드합니다. 확인이 끝나기 전 이전 백업을 삭제하지 마세요.

## 10. 안 되면 어디부터 볼까요?

영상/rlog 이중 보관을 사용했다면 기존 NFS 공유와 같은 기기 ID를 먼저 복원하고
NAS 전용 경로를 통합 옵션에 지정하세요. 목록 통합과 HA 최신 5GB 복구:
[주행 로그 NAS 복구](DRIVING_LOG_NAS.md). 일반 주행 내역/차계부 DB 복구와는 별개입니다.

| 증상 | 먼저 확인할 곳 |
| --- | --- |
| 휴대전화에서 `/health`가 안 열림 | Duck DNS·인증서·공유기·프록시·수신 앱 시작 상태 |
| `/health`는 열리지만 차량 자료가 없음 | Comma 인터넷, 차량 ID, 업로드 키, 설치 브랜치, 기기 재부팅 |
| 수신 앱은 받는데 HA 상태가 옛날임 | HA 수신기 주소·조회 키·HA 재시작, 앱 로그의 HA 저장 확인 |
| 상태는 오는데 터미널/카메라만 안 됨 | HA 외부 기본 주소·기능 켜짐·카메라 키·주차 상태·프록시 연결 |
| 앱 로그가 너무 많음 | 기본 INFO 사용. DEBUG는 설정한 분 후 자동으로 INFO로 돌아옴 |
| 용량 부족/저장 오류가 반복됨 | 집 서버의 남은 공간, HA 저장 확인이 멈췄는지, 수신 앱 로그 |

원인 확인이 필요하면 수신 앱 **로그 다운로드**, HA의 Carrot HA 관련 오류,
발생 시각과 증상을 함께 보관하세요. 공유하기 전 키·위치·개인 기록이 없는지 확인합니다.
수신 앱 로그는 그 앱의 처리 로그이며 HA 전체 또는 Comma 전체 로그를 합친 화면은 아닙니다.

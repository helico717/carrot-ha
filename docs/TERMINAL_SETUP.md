# Carrot HA 원격 터미널 설치 및 사용

원격 터미널은 Comma가 Home Assistant로 여는 아웃바운드 WSS 연결을 사용합니다. 셀룰러 CGNAT 환경에서도 Comma의 인바운드 포트를 열지 않습니다.

## 코드와 배포 경계

- Home Assistant 중계 백엔드와 Lovelace 카드는 `carrot-ha` 저장소에서 배포합니다.
- Comma에서 실행되는 WSS 클라이언트는 `openpilot`의 `carrot-wip-model_selector-ha` 브랜치에 포함됩니다.
- Comma에 별도 에이전트 ZIP을 복사하거나 `/data/continue.sh`를 수정하지 않습니다.
- openpilot manager가 기존 `carrot_ha` 프로세스를 부팅 시 실행하고 비정상 종료 시 재시작합니다.
- Comma 클라이언트는 localhost의 `/ws/terminal_pty`를 통해 기존 Carrot Web `support_terminal`과 같은 `PTY_SESSION`에 연결합니다. 별도 셸이나 별도 PTY를 만들지 않습니다.

## 안전 및 인증 정책

- HA 관리자만 터미널 세션을 열고 입력할 수 있습니다.
- Comma는 다른 자격증명과 겹치지 않는 터미널 전용 토큰으로 인증합니다.
- 한 번에 하나의 HA 관리자만 터미널을 제어합니다.
- 제어 lease는 입력할 때 갱신되며 15분 후 만료됩니다.
- `IsOffroad=true`이고 `IsOnroad=false`일 때만 세션을 시작하고 유지합니다.
- Onroad 전환, 상태 불명확 또는 HA 연결 종료 시 원격 세션을 닫습니다.
- 기존 로컬 터미널과 지원 터미널의 화면 이력은 원격 연결 시 HA로 재전송하지 않습니다.

## 1. Home Assistant 업데이트

HACS에서 `carrot-ha`를 업데이트하거나 저장소 루트에서 다음 명령으로 수동 설치 ZIP을 만듭니다.

```text
python scripts/build_terminal_bundle.py
```

결과는 `.preview/terminal-release/carrot_ha-<version>.zip`입니다. ZIP 안의 `custom_components/carrot_ha`를 HA 설정 디렉터리에 반영하고 HA를 재시작합니다.

## 2. Comma의 openpilot 업데이트

Comma가 `carrot-wip-model_selector-ha` 브랜치를 사용하며 원격 터미널 기능이 포함된 최신 커밋인지 확인합니다. 별도의 터미널 에이전트를 설치하지 않습니다.

## 3. Comma 연결 설정

기존 `/data/id4-collector/connection.json` 또는 `/data/carrot_ha/connection.json`에 다음 필드를 추가합니다. 기존 `url`, `token`, `device` 값은 그대로 유지합니다.

```json
{
  "url": "https://YOUR-WORKER.example",
  "token": "EXISTING_UPLOAD_TOKEN",
  "device": "EXISTING_DEVICE_ID",
  "terminal_enabled": true,
  "ha_url": "https://YOUR-HA-EXTERNAL.example",
  "terminal_token": "A_DEDICATED_RANDOM_TOKEN_AT_LEAST_32_CHARACTERS"
}
```

`ha_url`은 Lovelace 경로가 없는 HA 외부 HTTPS 기본 주소입니다. 파일에는 이미 업로드 토큰이 들어 있으므로 권한을 제한합니다.

```bash
chmod 600 /data/id4-collector/connection.json
# 또는
chmod 600 /data/carrot_ha/connection.json
```

설정 변경 후 Comma를 재부팅하거나 manager의 `carrot_ha` 프로세스를 재시작합니다.

## 4. HA에서 터미널 활성화

`설정 → 기기 및 서비스 → Carrot HA → 구성`에서 다음을 설정합니다.

- `주차 중 원격 터미널 사용`: 활성화
- `터미널 전용 토큰`: Comma의 `terminal_token`과 같은 값

영상 토큰, 업로드 토큰, Cloudflare 조회 토큰과 다른 값을 사용합니다.

## 5. HA 카드 등록

HA 대시보드 리소스에 다음 JavaScript 모듈을 추가합니다.

```text
/carrot_ha_static/carrot-terminal-card.js
```

카드 YAML 예시:

```yaml
type: custom:carrot-terminal-card
device_id: YOUR_CARROT_HA_DEVICE_ID
title: Comma 4 원격 터미널
```

## 6. 동작 검증

1. 차량이 Offroad이고 셀룰러만 연결된 상태인지 확인합니다.
2. HA 관리자 계정으로 카드를 열고 `주차 · 준비됨` 상태를 확인합니다.
3. `연결`을 누른 뒤 `pwd`, `uname -a`, `uptime` 같은 읽기 명령부터 실행합니다.
4. `Ctrl+C`, Clear, Tab, 방향키를 확인합니다.
5. 두 번째 관리자 브라우저의 동시 제어가 거부되는지 확인합니다.
6. 첫 번째 카드에서 연결을 해제한 뒤 두 번째 관리자가 연결할 수 있는지 확인합니다.
7. 안전한 주차 조건에서 Onroad 전환 시 세션이 즉시 종료되는지 확인합니다.
8. Comma 재부팅 후 별도 명령 없이 다시 `주차 · 준비됨`이 되는지 확인합니다.

## 비활성화

HA 통합 옵션에서 `주차 중 원격 터미널 사용`을 끄고 Comma 연결 설정의 `terminal_enabled`를 `false`로 바꾼 뒤 `carrot_ha` 프로세스를 재시작합니다.

## 문제 해결

### 카드가 `Comma 오프라인`으로 표시됨

Comma에서 `carrot_ha` 프로세스와 로그를 확인하고 `ha_url`, TLS 인증서, `terminal_token`, 외부 프록시의 WebSocket 지원을 점검합니다.

```bash
pgrep -a -f openpilot.selfdrive.carrot.ha.daemon
```

외부 프록시는 다음 경로에서 WebSocket upgrade와 `Authorization` 헤더를 전달해야 합니다.

```text
/api/carrot_ha/v1/terminal/{device_id}
```

### 카드가 `사용 불가`로 표시됨

`IsOffroad=true`, `IsOnroad=false`가 명확한지 확인합니다. `http://127.0.0.1:7000/api/terminal_pty/status`가 정상인지도 확인합니다.

### `Another administrator controls this terminal`

다른 HA 관리자 연결이 제어 lease를 보유하고 있습니다. 기존 카드에서 연결을 해제하거나 최대 15분의 lease 만료를 기다립니다.

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


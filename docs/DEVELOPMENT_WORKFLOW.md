# 개발 및 배포 워크플로우 가이드

> **핵심 원칙 (AI 에이전트 및 개발자 필독):**
> 🛑 **SSH를 통해 콤마(Comma) 기기 내부의 파일을 직접 수정하거나 복사(SCP)하지 마세요!**
>
> 콤마 3/3X의 openpilot은 Git 저장소(`/data/openpilot`) 기반으로 동작합니다. 기기 내부에서 파일을 직접 수정하거나 임의로 스크립트를 주입하면:
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
│               Comma 3 / 3X 기기                        │
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

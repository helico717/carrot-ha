# 주행 로그 변경 기록

주행 로그 관련 모든 작업을 기록한다. 계획·로컬 검증·Git 게시·HA 반영·실차 설치는
별도 상태이며, 하나의 성공을 다른 단계의 성공으로 대신하지 않는다.

## 2026-10-14 — 환경 탐색과 구현 계획

- 요청: 당근웹 로그 UI 및 상세 레이더 분석을 HA에 이식하고 날짜별 GPS 지도와 최신
  5GB 보관을 추가. 첫 단계는 기존 파라미터 화면 자리의 실제 로그 조회까지.
- 조사: 집 VPN 경유 HA SSH 성공. ARM64, HA Core 2026.9.0, 통합 0.8.14-beta.5,
  확인 시 파일시스템 여유 약 116GB. DuckDNS HTTPS GET/TLS 검증 성공.
  Nginx Proxy Manager의 대상 도메인→HA:8123 전달 경로 확인.
- 소스: 당근웹 로그 모듈과 `tools/carrot_route_vault/`의 첨부 분석 화면 원본 발견.
  로그 UI와 레이더 계산 엔진 재사용, 분석 서비스 분리 방안을 계획.
- 정책: 완성 구간 즉시 직접 업로드+주차/연결 후 누락 보충. 실제 기록 시각 최신부터
  최대 5GB. Worker/D1/KV에 원본을 중계·저장하지 않는다.
- 관련 파일: `docs/driving-log-ha-implementation-plan-2026-10-14.md`.
- 게시: 계획서 커밋 `18adfa0`, 원격 main 반영 확인.
- 한계: 프록시 유효 업로드 제한·실차 성능·분석 ARM64 실행은 당시 미검증.

## 2026-10-14 — 실제 로그 수신·조회 첫 단계 구현

- 이유: UI만 복사하면 HA에 원본 파일·조회 API가 없어서 실제 로그를 볼 수 없다.
- HA 저장소: 전용 `driving_logs/store.py`. 최신 시각부터 구간 단위 보관, 5,000,000,000
  bytes 예약·색인·미완료 파일 포함, 과거 재업로드 방지, 이어받기, SHA-256, 완료 후 공개.
  차계부/텔레메트리 archive와 별도 파일 저장.
- HA API: `driving_logs/http.py`, 통합 `__init__.py` 등록. 목적별 장치 HMAC 인증,
  관리자 인증 이후 장치 범위 1시간 HttpOnly 조회 세션, 목록·구간·파일·영상 Range 응답.
- Comma: `ha/driving_logs.py`와 `terminal.py` 연결. 기존 discovery 결과 공유로 새 Worker
  polling 없이 HA 직접 전송. 완료·잠금 해제 원본만 최신부터 순차 전송, 원본 TS 보존,
  FFmpeg stream-copy MP4 생성, FFprobe 길이가 있으면 시작시각 계산. 전송 상태는 Git 밖.
- UI: `frontend/carrot_logs/`는 원본 당근웹 로그 HTML·생성 UI/로그 번들·스타일 재사용.
  `ha_logs_bridge.js`는 HA 로컬 범위로 연결. `carrot-logs-card.js`는 정식 새 카드.
  `carrot-dashboard-runtime.js`는 lazy 등록. 옛 `carrot-params-card.js`는 호환용이며 기존
  파라미터 구현은 `carrot-parameter-tuning-card.js`로 분리.
- 이름 수정: 사용자 피드백에 따라 정식 타입 `custom:carrot-logs-card`, 리소스
  `/carrot_ha_static/carrot-logs-card.js`, 표시 이름 **Carrot HA — 당근웹 로그**.
- 검증 대상: 사용자 지정 `https://homeassistant202604.duckdns.org/lovelace/8`.
- 지원: 목록·정렬·선택·영상 창·원본 개별 다운로드. 분석·지도·외부 전송·선택 ZIP·
  화면 녹화 수신·실제 썸네일은 다음 단계이며 현재 UI에서 미지원 안내.
- 재현: `scripts/build_logs_port.py`, 원본 commit `baf47a6f` 고정·provenance 저장.
- 테스트: `tests/test_driving_logs.py`, `test_driving_logs_transport.py`,
  `driving-logs-port-browser.cjs`, 기존 params 검사 경로 보정;
  openpilot `ha/tests/test_driving_logs.py`.
- 통과: 저장/해시/중단 재개/용량/경로 검증 4건, 실제 HTTP 및 Comma sender→HA receiver
  통합 2건, Chromium 목록·선택·정렬·영상 창 URL·닫기·모바일, dashboard live/lazy/view-state,
  cloud live/incremental/history cache, Worker incremental/benchmark, Comma param/terminal/logs 12건.
- 전체 Comma 92건 중 기존 카메라 검사 2건 실패: `encode_media` 누락 및 PyAV 누락 기대
  불일치. 카메라 소스·테스트의 HEAD 대비 변경 없음 확인. 기기 장애로 판단하지 않는다.
- 환경 보정: Mac 기본 Python 3.9에는 `asyncio.timeout`이 없어 기존 terminal 검사 실패.
  Python 3.12 재검증에서 관련 검사 통과. 브라우저·HTTP 소켓은 sandbox 제한 때문에
  승인 경로의 분리 테스트 환경에서 실행했다.
- 게시 준비: 최신 openpilot 원격 자동 동기화 변경 위에 단일 부모 커밋으로 rebase.
  Comma 전송 커밋 `05bc6d0a`; 원격 게시 결과는 다음 배포 항목에 기록.
- 배포 정책 변경: 사용자 요청으로 이번에는 릴리즈 없이 HA SSH 직접 반영·검증.
  버전/태그/Release/Worker 배포 없음. 필요한 파일 백업 후 반영 예정.
- 미확인: 설치 후 실제 기기 FFmpeg·전송/재개·CPU/열, 실제 영상 디코딩, 5GB 회전,
  장시간 기존 서비스 영향. 합성 파일 검사는 실제 영상 재생 성공의 증거가 아니다.

## 2026-10-14 — 주행 로그 전용 기록 의무화

- 요청에 따라 `driving-logs/AGENTS.md`, 이 `CHANGELOG.md`를 만들고 루트 `AGENTS.md`에
  작업 전 지침 확인·모든 로그 작업 즉시 기록 의무를 연결한다.
- 배포 절차는 `docs/driving-logs-setup.md`에 기록. 다음 작업도 내용·이유·관련 파일·검증·
  Git/HA/Comma 배포 상태·미확인 사항을 누락 없이 추가한다.

## 2026-10-14 — HA 직접 파일 반영 및 사용자 적용 대기

- 사용자 요청에 따라 릴리즈 없이 SSH 직접 반영. 로그 관련 파일 27개 SHA-256 일치
  확인, 운영 `__init__.py`는 기존 내용을 보존하고 로그 API 등록 2줄만 추가했다.
- 백업: `/config/carrot_ha/deployment-backups/driving-logs-20261014/before`.
  manifest·차계부·기존 설정·운영 DB는 변경하지 않았다.
- Comma 원격 게시: `05bc6d0af87a53569f91facef1c490c850786a73`,
  `origin/carrot-wip-model_selector-ha`의 SHA 일치 확인.
- 사용자에게 HA 재시작과 Comma `git pull --ff-only && sudo reboot`를 요청했다.
  사용자는 시간이 걸리며 완료 후 추가 답장하겠다고 했다. 현재 적용 완료로 간주하지 않는다.
- 대기 중인 검증: 재시작 후 신규 HA API, 실제 Comma 로그 도착·영상 재생,
  새 카드 타입/리소스 적용 후 사용자 지정 Lovelace 8번 화면.
- HA 저장소 코드와 문서의 Git 게시·최종 운영 검증 기록은 후속 답장 후 이어간다.

## 2026-10-14 — 사용자 재시작 후 실제 수신 확인

- 사용자가 HA 재시작과 Comma Pull·재부팅 완료를 알렸다.
- 외부 frontend-version 응답 `0.8.14-beta.5-a4071aa720bf`로 HA 새 코드 재시작 확인.
- 실제 HA 로그 색인: 4개 구간, 수신 완료 3개, 예약량 52,046,367 bytes 확인.
  기기 원본→운영 HA 수신이 시작됐다는 증거이며 장시간 전송·영상 디코딩의 증거는 아니다.
- 다음 사용자 작업: 리소스를 `/carrot_ha_static/carrot-logs-card.js`로 바꾸고 8번
  대시보드 카드 타입을 `custom:carrot-logs-card`로 변경, 기존 device_id 유지, 강력 새로고침.
- 실제 대시보드 목록·영상 재생·시간 이동·다운로드와 장시간 용량 회전은 후속 검증 대기.

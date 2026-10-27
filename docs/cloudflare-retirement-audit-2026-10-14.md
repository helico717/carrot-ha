# Cloudflare 흔적 점검 기록

작성: 2026-10-14. 기준은 HA가 주 화면인 자체 서버 운영입니다.
안드로이드 원작 앱은 사용자가 사용하지 않는다고 밝혀 수정 대상에서 제외했습니다.

## 2026-10-27 후속 문서 정리

초기 점검은 폐기 경고·취소선 중심이었고 AGENTS 구조도·Wrangler 명령·엔티티 설명·모듈형 설계에 과거 표현이 남아 있었다. 현재 안내는 [직접 연결 구조](CURRENT_CONNECTION_ARCHITECTURE.md)를 기준으로 다시 작성했다. 아래 표의 표현 수와 전수 검토 주장은 10월 14일 당시 기록이며 현재 검토 수치가 아니다. 운영 서버·Comma 재검증은 이번 문서 작업에 포함하지 않는다.

## 현재 사용하는 통신

- 차량 상태·일반 주행·파라미터·터미널 연결 정보: 자체 Carrot Vehicle Receiver.
- 터미널·주차 카메라·영상/rlog 파일: Comma와 HA 직접 연결.
- 대시보드는 차량 수신기 이름을 표시하고 구성 화면에서 폐기된 서버 입력란을 제거합니다.
- 직접 수신기 장애 시 이전 Cloudflare로 자동 복귀하지 않습니다.

## 남겨둔 파일과 이유

- `cloudflare/`: 폐기된 이전 서버 소스·스키마·검증 자료. 현재 설치/배포 대상 아님.
- HA의 legacy cloud 설정 키/압축 codec/기존 기록 ID: 과거 기록 읽기와 기존 옵션 보존을 위한 호환 자료.
  사용자 기록을 지우거나 ID를 바꾸는 방식으로 흔적을 제거하지 않습니다.
- Comma의 공개 전환 매핑 `previous_url`: 과거 주소와 일치하는 설정을 새 주소로 전환하는 식별자.
  그 주소로 접속하는 fallback이 아님.
- 원작 Android MyID4 앱에는 Worker 전용 코드가 남아 있음. 사용자 지시에 따라 수정 제외.
- openpilot 원작 당근웹의 별도 손님 원격 지원에는 선택적 cloudflared/trycloudflare 기능이 있음.
  HA 원격 터미널 경로는 이를 호출하지 않음. 기존 원작 기능을 몰래 삭제하지 않음.
- HA 주행 로그 브리지는 dashcam/screenrecord 주소만 허용하며 원작 손님 지원 API를 연결하지 않음.
- 기존 운영 Cloudflare 서비스/DB 자체를 삭제하거나 중지하지 않음. 새 직접 수신기 배포는 이를 필요로 하지 않음.

## Markdown 전수 검토

`git ls-files '*.md'` 기준 모든 파일의 내용을 읽어 서비스명·주소·배포 도구를 검사했습니다.
현행 설치 문서는 직접 수신기 안내로 교체하고, 이전 안내 원문은 실행 금지 표시와 함께
`docs/archive/cloudflare-guides-before-direct-receiver.md`에 보관합니다.
날짜별 조사·changelog·이전 릴리즈는 증거를 보존하고 과거 서비스명을 취소선 처리합니다.
Cloudflare가 없다는 현재 설명 및 호환 코드 식별자는 폐기할 설치 지시가 아닙니다.

| 문서 | 분류 | 관련 표현 수(검토 시점) |
| --- | --- | --- |
| `.agents/rules/vehicle-journal.md` | 과거 서버 설명 폐기 표시 | 4 |
| `.github/release-notes/v0.8.10.md` | 과거 서버 설명 폐기 표시 | 2 |
| `.github/release-notes/v0.8.11-beta.1.md` | 과거 서버 설명 폐기 표시 | 1 |
| `.github/release-notes/v0.8.11.md` | 과거 서버 설명 폐기 표시 | 1 |
| `.github/release-notes/v0.8.12-beta.1.md` | 과거 서버 설명 폐기 표시 | 3 |
| `.github/release-notes/v0.8.12-beta.2.md` | 과거 서버 설명 폐기 표시 | 1 |
| `.github/release-notes/v0.8.12-beta.3.md` | 서버 언급 없음 | 0 |
| `.github/release-notes/v0.8.12-beta.4.md` | 서버 언급 없음 | 0 |
| `.github/release-notes/v0.8.12-beta.5.md` | 서버 언급 없음 | 0 |
| `.github/release-notes/v0.8.12-beta.6.md` | 과거 서버 설명 폐기 표시 | 1 |
| `.github/release-notes/v0.8.12-beta.7.md` | 과거 서버 설명 폐기 표시 | 3 |
| `.github/release-notes/v0.8.12-beta.8.md` | 서버 언급 없음 | 0 |
| `.github/release-notes/v0.8.12-beta.9.md` | 과거 서버 설명 폐기 표시 | 1 |
| `.github/release-notes/v0.8.12.md` | 과거 서버 설명 폐기 표시 | 2 |
| `.github/release-notes/v0.8.13.md` | 과거 서버 설명 폐기 표시 | 1 |
| `.github/release-notes/v0.8.14-beta.1.md` | 과거 서버 설명 폐기 표시 | 3 |
| `.github/release-notes/v0.8.14-beta.2.md` | 과거 서버 설명 폐기 표시 | 3 |
| `.github/release-notes/v0.8.14-beta.3.md` | 과거 서버 설명 폐기 표시 | 1 |
| `.github/release-notes/v0.8.14-beta.4.md` | 과거 서버 설명 폐기 표시 | 3 |
| `.github/release-notes/v0.8.14-beta.5.md` | 과거 서버 설명 폐기 표시 | 18 |
| `.github/release-notes/v0.8.14-beta.6.md` | 과거 서버 설명 폐기 표시 | 2 |
| `.github/release-notes/v0.8.14-beta.7.md` | 과거 서버 설명 폐기 표시 | 3 |
| `.github/release-notes/v0.8.14.md` | 과거 서버 설명 폐기 표시 | 4 |
| `.github/release-notes/v0.8.8.md` | 과거 서버 설명 폐기 표시 | 3 |
| `.github/release-notes/v0.8.9.md` | 과거 서버 설명 폐기 표시 | 2 |
| `AGENTS.md` | 과거 서버 설명 폐기 표시 | 46 |
| `README.en.md` | 현재 안내 | 4 |
| `README.md` | 현재 안내 | 2 |
| `addons/carrot_receiver/CHANGELOG.md` | 현재 안내 | 1 |
| `addons/carrot_receiver/DOCS.md` | 현재 안내 | 4 |
| `cloudflare/SOURCE.md` | 과거 서버 설명 폐기 표시 | 3 |
| `cloudflare/TERMINAL_DISCOVERY.md` | 과거 서버 설명 폐기 표시 | 18 |
| `collector/CHARGING.md` | 서버 언급 없음 | 0 |
| `custom_components/carrot_ha/frontend/carrot_logs/SOURCE.md` | 과거 서버 설명 폐기 표시 | 1 |
| `docs/CAMERA_FEASIBILITY.md` | 과거 서버 설명 폐기 표시 | 5 |
| `docs/CAMERA_RELIABILITY_AND_PANORAMA.md` | 과거 서버 설명 폐기 표시 | 1 |
| `docs/CAMERA_SETUP.md` | 서버 언급 없음 | 0 |
| `docs/CELLULAR_DIAGNOSTICS_MAC.md` | 서버 언급 없음 | 0 |
| `docs/CHARGING-MOTION.md` | 과거 서버 설명 폐기 표시 | 1 |
| `docs/CHARGING_ESTIMATION.md` | 서버 언급 없음 | 0 |
| `docs/COMMA_PARAM_SETUP.md` | 현재 안내 | 1 |
| `docs/DASHBOARD-LANGUAGE.md` | 서버 언급 없음 | 0 |
| `docs/DEVELOPMENT_WORKFLOW.md` | 현재 안내 | 4 |
| `docs/GUIDE.md` | 과거 서버 설명 폐기 표시 | 2 |
| `docs/INSTALL.en.md` | 현재 안내 | 5 |
| `docs/INSTALL.md` | 현재 안내 | 5 |
| `docs/PARAMETERS_0_6_1.md` | 과거 서버 설명 폐기 표시 | 6 |
| `docs/PUBLISH.en.md` | 현재 안내 | 1 |
| `docs/PUBLISH.md` | 현재 안내 | 4 |
| `docs/REINSTALL.md` | 현재 안내 | 1 |
| `docs/TELEMETRY-SIGNAL-REVIEW.md` | 서버 언급 없음 | 0 |
| `docs/TERMINAL_SETUP.md` | 현재 안내 | 1 |
| `docs/VEHICLE-IMAGE.en.md` | 서버 언급 없음 | 0 |
| `docs/VEHICLE-IMAGE.md` | 서버 언급 없음 | 0 |
| `docs/actual-charging-can-beta9.md` | 과거 서버 설명 폐기 표시 | 10 |
| `docs/archive/CARROT_SETTINGS_PORT_PLAN.md` | 과거 서버 설명 폐기 표시 | 8 |
| `docs/archive/DEBUG-FRESHNESS-PREVIEW.md` | 서버 언급 없음 | 0 |
| `docs/archive/OFFLINE-RECOVERY.md` | 과거 서버 설명 폐기 표시 | 2 |
| `docs/archive/RELEASE-0.4.5.md` | 서버 언급 없음 | 0 |
| `docs/archive/RELEASE-0.6.9.md` | 과거 서버 설명 폐기 표시 | 1 |
| `docs/archive/dashboard-numeric-audit-2026-09-23.md` | 서버 언급 없음 | 0 |
| `docs/archive/telemetry-analysis-2026-09-23.md` | 서버 언급 없음 | 0 |
| `docs/battery-can-monitoring-beta8.md` | 과거 서버 설명 폐기 표시 | 3 |
| `docs/battery-history-navigation-2026-10-12.md` | 과거 서버 설명 폐기 표시 | 5 |
| `docs/battery-temperature-entity-2026-10-11.md` | 과거 서버 설명 폐기 표시 | 2 |
| `docs/can-analysis-index.md` | 서버 언급 없음 | 0 |
| `docs/charge-connection-can.md` | 과거 서버 설명 폐기 표시 | 7 |
| `docs/charging-false-positive-audit-2026-10-04.md` | 서버 언급 없음 | 0 |
| `docs/charging-freshness-fix-2026-10-06.md` | 과거 서버 설명 폐기 표시 | 5 |
| `docs/charging-parking-gps-fix-2026-10-11.md` | 과거 서버 설명 폐기 표시 | 3 |
| `docs/charging-payments.md` | 과거 서버 설명 폐기 표시 | 1 |
| `docs/cloudflare-storage-review-2026-10-14.md` | 과거 서버 설명 폐기 표시 | 14 |
| `docs/dashboard-bugfix-implementation-2026-10-03.md` | 과거 서버 설명 폐기 표시 | 10 |
| `docs/dashboard-loading-audit-2026-10-01.md` | 과거 서버 설명 폐기 표시 | 48 |
| `docs/direct-vehicle-receiver-plan-2026-10-14.md` | 과거 서버 설명 폐기 표시 | 19 |
| `docs/driving-log-ha-implementation-plan-2026-10-14.md` | 과거 서버 설명 폐기 표시 | 14 |
| `docs/driving-logs-setup.md` | 과거 서버 설명 폐기 표시 | 5 |
| `docs/entities.md` | 과거 서버 설명 폐기 표시 | 6 |
| `docs/ha-branch-switch-implementation-plan-2026-10-13.md` | 과거 서버 설명 폐기 표시 | 8 |
| `docs/meb-monitoring-candidates.md` | 서버 언급 없음 | 0 |
| `docs/modular-ev-dashboard-architecture.md` | 과거 서버 설명 폐기 표시 | 17 |
| `docs/raw-can-capture.md` | 과거 서버 설명 폐기 표시 | 4 |
| `docs/sqlite-lossless-compression.md` | 과거 서버 설명 폐기 표시 | 4 |
| `docs/terminal-git-status-2026-10-11.md` | 과거 서버 설명 폐기 표시 | 7 |
| `docs/trip-efficiency-regression-2026-10-03.md` | 과거 서버 설명 폐기 표시 | 6 |
| `docs/trip-sync-payload-fix-2026-10-06.md` | 과거 서버 설명 폐기 표시 | 4 |
| `driving-logs/AGENTS.md` | 과거 서버 설명 폐기 표시 | 1 |
| `driving-logs/CHANGELOG.md` | 과거 서버 설명 폐기 표시 | 64 |
| `vehicle-journal/AGENTS.md` | 과거 서버 설명 폐기 표시 | 4 |
| `vehicle-journal/CHANGELOG.md` | 과거 서버 설명 폐기 표시 | 100 |
| `vehicle-journal/README.md` | 과거 서버 설명 폐기 표시 | 1 |
| `vehicle-journal/aggregation-rules.md` | 서버 언급 없음 | 0 |
| `vehicle-journal/assets/README.md` | 서버 언급 없음 | 0 |
| `vehicle-journal/database-design.md` | 서버 언급 없음 | 0 |
| `vehicle-journal/deployment.md` | 과거 서버 설명 폐기 표시 | 1 |
| `vehicle-journal/implementation-plan.md` | 과거 서버 설명 폐기 표시 | 2 |
| `vehicle-journal/migration-and-backup.md` | 서버 언급 없음 | 0 |
| `vehicle-journal/references/README.md` | 서버 언급 없음 | 0 |
| `vehicle-journal/references/previous-design-request.md` | 서버 언급 없음 | 0 |
| `vehicle-journal/requirements.md` | 서버 언급 없음 | 0 |
| `vehicle-journal/usage.md` | 과거 서버 설명 폐기 표시 | 1 |
| `vehicle-journal/validation-plan.md` | 과거 서버 설명 폐기 표시 | 3 |
| `vehicle-journal/vehicle-management.md` | 서버 언급 없음 | 0 |

새 복구 안내·본 감사 기록·보관 원문과 0.9 베타 노트를 포함해 **총 109개 Markdown**을 다시 읽고 검토했습니다.

## 연결 저장소와 실행 파일 추가 점검

- companion openpilot의 추적 Markdown 360개를 모두 읽어 관련 언급을 확인.
  관련 문서는 직접 수신기 전환/이전 용량 장애 문서 2개로, 과거 서버 표현을 폐기 표시.
- 원작 MyID4는 사용하지 않는다는 사용자 지시에 따라 감사만 수행하고 수정하지 않음.
- HA frontend의 원작 지원 터널 번역은 사용하지 않는 2개 키를 제거.
- collector/의 독립 설치 참고 소스는 deprecated 표시, 현재 Comma에는 배포하지 않음.
- cloudflare/setup.ps1은 폐기 안내로 중단하여 실수 설치 방지. 기존 운영 DB/Worker를 변경하는 작업 아님.
- cloud.py/cloud_live.py의 설명은 자체 수신기 동작으로 정리하되 과거 archive 호환 이름은 보존.
- 기존 원작 서비스용 코드와 라이선스는 기능 삭제/출처 손실을 피하기 위해 참고 자료로 보존.

## 최종 목록 확인

- 초기 점검 기준: carrot-ha 추적 파일 581개, openpilot 6,149개, MyID4 126개.
  텍스트 소스·설정·명령·Markdown은 서비스명/주소로 검사하고 바이너리는 내용 변환 없이 경로만 확인.
- MyID4 Markdown 1개도 확인. 실제 앱 소스 2개에 전용 서버 코드가 남아 있지만 사용자 지시에 따라 변경 제외.
- 이번 새 문서와 릴리즈 노트도 전수 읽기/관련 표현 확인에 포함.
- 현재 설치·복구 문서의 로컬 링크 검사 통과. 파일별 잔존 표현 목록은
  [감사 파일 목록](cloudflare-audit-files.txt)에 보관. 목록에 있다고 현재 사용하는 서비스라는 뜻은 아님.
- 새 수신 앱 운영 확인: 0.1.3 started, 외부 /health 200,
  실제 telemetry POST 및 HA archive ACK 200, 설정 pending/터미널 bootstrap 요청 200.
- HA 화면 문구·옵션 정리는 0.9.0-beta.1 패키지 설치/사용자 HA 재시작 후 적용.

추가된 Markdown 6개: `.github/release-notes/v0.9.0-beta.1.md`, `cloudflare/README.md`,
`collector/README.md`, `docs/CLEAN_INSTALL_RECOVERY.md`,
`docs/archive/cloudflare-guides-before-direct-receiver.md`, 본 감사 문서.
현재 카메라 설치 설명은 WebCodecs/WLV1로 정리했고 이전 수신 앱 rollback 설명도 폐기 참고로 분리합니다.

최종 회귀: [Linux CI](https://github.com/helico717/carrot-ha/actions/runs/38578662800),
Python 438건 + 대시보드 12건 전부 통과/생략 없음. 실제 초기화/백업 복원과 장기 운영은 별도 확인입니다.

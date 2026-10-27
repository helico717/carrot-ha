# 전체 문서 연결 방식 재점검 — 2026-10-27

범위: `git ls-files`의 Markdown/MDX/RST/TXT/AsciiDoc 문서 전체. 각 파일을 UTF-8로 읽고 Cloudflare, workers.dev, Wrangler, D1, KV, free-plan, 클라우드, cloud, Worker 및 과거 연결 키를 대소문자 구분 없이 검사했다. 아래 수는 검색어가 있는 줄 수이며 의존성 수나 오류 수가 아니다. 검색어 없는 문서의 연결 정확성까지 자동 검증한 것은 아니다.

## 발견 및 조치

- 앞선 커밋 49a5536 후에도 entities의 last_sync/comma_online 설명, 차계부 요구사항·하위 지침의 cloud/D1/KV 규칙, 현행 검증 계획의 Worker 테스트가 남았다. 수신기 기준으로 수정하고 comma_online이 물리 전원이나 WebSocket 연결의 직접 판정이 아님을 명시했다.
- README의 과거 파라미터 설계 링크를 과거 기록으로 표시하고 카메라 엔티티 설치 설명을 현재 영상 경로로 수정했다. 출처 문구에서도 폐기된 서버와 현재 앱을 구분했다.
- PARAMETERS_0_6_1 전체를 과거 기록으로 명시했다. 당시 Worker 배포·차량 파일 교체 명령은 현재 실행하지 않는다. 과거 릴리즈·사건·changelog·라이선스의 이름과 ID는 보존했다.
- 단독 HTML도 별도 검색했다. `preview/trip_candidates/index.html`에 `Cloudflare · ok`라는 합성 프리뷰 문구가 1곳 남아 있다. 운영 연결 증거가 아니며 이번 문서 수정에서 UI 프리뷰는 바꾸지 않았다. 이 파일을 현행 연결 시연 자료로 사용해서는 안 된다.
- 현행 3D 문서의 일반적인 클라우드 요청 표현은 다른 작업에서 수정 중인 파일이어서 이번 커밋에 포함하지 않았다. 이를 Cloudflare 사용으로 해석하지 않는다.

## 남은 표현의 해석

아래 표는 검색 결과를 용도별로 분류한 목록이다. 현행 문서에도 'Cloudflare를 사용하지 않는다'는 설명, 과거 자료 링크, 호환 코드 이름은 남는다. 과거 기록의 취소선 없는 서비스명·명령도 역사적 사실로 보존한다. 전체 저장소에서 문자열이 0건이라는 결론은 아니다.

운영 HA·차량·프록시 접속 확인은 수행하지 않았다. 이 점검은 로컬 문서와 앞선 코드 대조 범위다. 관련 없는 개발 변경은 제외한다.

## 파일별 점검 목록

대상 문서 123개. 신규 점검 보고서 자체는 아래 기준 목록에서 제외한다.

| 파일 | 분류 | 일치 줄 수 |
| --- | --- | ---: |
| `.agents/rules/vehicle-journal.md` | 현행 안내·지침/호환 명칭 | 2 |
| `.github/release-notes/v0.8.10.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.11-beta.1.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.11.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.12-beta.1.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.12-beta.2.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.12-beta.3.md` | 검색어 없음 | 0 |
| `.github/release-notes/v0.8.12-beta.4.md` | 과거 기록·출처 보존 | 1 |
| `.github/release-notes/v0.8.12-beta.5.md` | 과거 기록·출처 보존 | 1 |
| `.github/release-notes/v0.8.12-beta.6.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.12-beta.7.md` | 과거 기록·출처 보존 | 3 |
| `.github/release-notes/v0.8.12-beta.8.md` | 검색어 없음 | 0 |
| `.github/release-notes/v0.8.12-beta.9.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.12.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.13.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.14-beta.1.md` | 과거 기록·출처 보존 | 4 |
| `.github/release-notes/v0.8.14-beta.2.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.14-beta.3.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.14-beta.4.md` | 과거 기록·출처 보존 | 3 |
| `.github/release-notes/v0.8.14-beta.5.md` | 과거 기록·출처 보존 | 14 |
| `.github/release-notes/v0.8.14-beta.6.md` | 과거 기록·출처 보존 | 5 |
| `.github/release-notes/v0.8.14-beta.7.md` | 과거 기록·출처 보존 | 4 |
| `.github/release-notes/v0.8.14.md` | 과거 기록·출처 보존 | 4 |
| `.github/release-notes/v0.8.8.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.8.9.md` | 과거 기록·출처 보존 | 2 |
| `.github/release-notes/v0.9.0-beta.1.md` | 과거 기록·출처 보존 | 4 |
| `AGENTS.md` | 현행 안내·지침/호환 명칭 | 11 |
| `CHANGELOG.md` | 과거 기록·출처 보존 | 10 |
| `README.en.md` | 현행 안내·지침/호환 명칭 | 2 |
| `README.md` | 현행 안내·지침/호환 명칭 | 1 |
| `addons/carrot_receiver/CHANGELOG.md` | 과거 기록·출처 보존 | 1 |
| `addons/carrot_receiver/DOCS.md` | 현행 안내·지침/호환 명칭 | 3 |
| `cloudflare/README.md` | 과거 기록·출처 보존 | 2 |
| `cloudflare/SOURCE.md` | 과거 기록·출처 보존 | 3 |
| `cloudflare/TERMINAL_DISCOVERY.md` | 과거 기록·출처 보존 | 13 |
| `collector/CHARGING.md` | 검색어 없음 | 0 |
| `collector/README.md` | 검색어 없음 | 0 |
| `custom_components/carrot_ha/frontend/carrot_logs/SOURCE.md` | 과거 조사·설계/전환 기록 | 2 |
| `docs/CAMERA_FEASIBILITY.md` | 과거 조사·설계/전환 기록 | 5 |
| `docs/CAMERA_RELIABILITY_AND_PANORAMA.md` | 과거 조사·설계/전환 기록 | 2 |
| `docs/CAMERA_SETUP.md` | 검색어 없음 | 0 |
| `docs/CELLULAR_DIAGNOSTICS_MAC.md` | 검색어 없음 | 0 |
| `docs/CHARGING-MOTION.md` | 과거 조사·설계/전환 기록 | 2 |
| `docs/CHARGING_ESTIMATION.md` | 검색어 없음 | 0 |
| `docs/CLEAN_INSTALL_RECOVERY.md` | 현행 안내·지침/호환 명칭 | 2 |
| `docs/COMMA_PARAM_SETUP.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/CURRENT_CONNECTION_ARCHITECTURE.md` | 현행 안내·지침/호환 명칭 | 6 |
| `docs/DASHBOARD-LANGUAGE.md` | 검색어 없음 | 0 |
| `docs/DEBUG_DASHBOARD.md` | 검색어 없음 | 0 |
| `docs/DEVELOPMENT_WORKFLOW.md` | 현행 안내·지침/호환 명칭 | 3 |
| `docs/DRIVING_LOG_NAS.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/GEMINI_DRIVING_ANALYSIS.md` | 현행 안내·지침/호환 명칭 | 10 |
| `docs/GUIDE.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/INSTALL.en.md` | 현행 안내·지침/호환 명칭 | 2 |
| `docs/INSTALL.md` | 현행 안내·지침/호환 명칭 | 3 |
| `docs/PARAMETERS_0_6_1.md` | 과거 조사·설계/전환 기록 | 6 |
| `docs/PUBLISH.en.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/PUBLISH.md` | 현행 안내·지침/호환 명칭 | 3 |
| `docs/REINSTALL.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/TELEMETRY-SIGNAL-REVIEW.md` | 검색어 없음 | 0 |
| `docs/TERMINAL_SETUP.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/VEHICLE-IMAGE.en.md` | 검색어 없음 | 0 |
| `docs/VEHICLE-IMAGE.md` | 검색어 없음 | 0 |
| `docs/VEHICLE_3D_MODEL.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/actual-charging-can-beta9.md` | 과거 조사·설계/전환 기록 | 7 |
| `docs/archive/CARROT_SETTINGS_PORT_PLAN.md` | 과거 기록·출처 보존 | 7 |
| `docs/archive/DEBUG-FRESHNESS-PREVIEW.md` | 검색어 없음 | 0 |
| `docs/archive/OFFLINE-RECOVERY.md` | 과거 기록·출처 보존 | 2 |
| `docs/archive/RELEASE-0.4.5.md` | 검색어 없음 | 0 |
| `docs/archive/RELEASE-0.6.9.md` | 과거 기록·출처 보존 | 2 |
| `docs/archive/camera-transport-test-before-wlv1.txt` | 검색어 없음 | 0 |
| `docs/archive/cloudflare-guides-before-direct-receiver.md` | 과거 기록·출처 보존 | 92 |
| `docs/archive/dashboard-numeric-audit-2026-09-23.md` | 검색어 없음 | 0 |
| `docs/archive/telemetry-analysis-2026-09-23.md` | 과거 기록·출처 보존 | 1 |
| `docs/battery-can-monitoring-beta8.md` | 과거 조사·설계/전환 기록 | 3 |
| `docs/battery-history-navigation-2026-10-12.md` | 과거 조사·설계/전환 기록 | 4 |
| `docs/battery-temperature-entity-2026-10-11.md` | 과거 조사·설계/전환 기록 | 3 |
| `docs/can-analysis-index.md` | 검색어 없음 | 0 |
| `docs/charge-connection-can.md` | 과거 조사·설계/전환 기록 | 5 |
| `docs/charging-false-positive-audit-2026-10-04.md` | 과거 조사·설계/전환 기록 | 3 |
| `docs/charging-freshness-fix-2026-10-06.md` | 과거 조사·설계/전환 기록 | 6 |
| `docs/charging-parking-gps-fix-2026-10-11.md` | 과거 조사·설계/전환 기록 | 4 |
| `docs/charging-payments.md` | 과거 조사·설계/전환 기록 | 3 |
| `docs/cloudflare-audit-files.txt` | 과거 조사·설계/전환 기록 | 6 |
| `docs/cloudflare-retirement-audit-2026-10-14.md` | 과거 조사·설계/전환 기록 | 18 |
| `docs/cloudflare-storage-review-2026-10-14.md` | 과거 조사·설계/전환 기록 | 15 |
| `docs/dashboard-bugfix-implementation-2026-10-03.md` | 과거 조사·설계/전환 기록 | 7 |
| `docs/dashboard-loading-audit-2026-10-01.md` | 과거 조사·설계/전환 기록 | 36 |
| `docs/direct-vehicle-receiver-plan-2026-10-14.md` | 과거 조사·설계/전환 기록 | 18 |
| `docs/driving-log-ha-implementation-plan-2026-10-14.md` | 과거 조사·설계/전환 기록 | 10 |
| `docs/driving-logs-setup.md` | 현행 안내·지침/호환 명칭 | 5 |
| `docs/entities.md` | 검색어 없음 | 0 |
| `docs/ha-branch-switch-implementation-plan-2026-10-13.md` | 과거 조사·설계/전환 기록 | 7 |
| `docs/meb-monitoring-candidates.md` | 검색어 없음 | 0 |
| `docs/modular-ev-dashboard-architecture.md` | 현행 안내·지침/호환 명칭 | 1 |
| `docs/raw-can-capture.md` | 과거 조사·설계/전환 기록 | 3 |
| `docs/sqlite-lossless-compression.md` | 과거 조사·설계/전환 기록 | 8 |
| `docs/terminal-git-status-2026-10-11.md` | 과거 조사·설계/전환 기록 | 4 |
| `docs/trip-efficiency-regression-2026-10-03.md` | 과거 조사·설계/전환 기록 | 8 |
| `docs/trip-sync-payload-fix-2026-10-06.md` | 과거 조사·설계/전환 기록 | 5 |
| `driving-logs/AGENTS.md` | 현행 안내·지침/호환 명칭 | 2 |
| `driving-logs/CHANGELOG.md` | 과거 기록·출처 보존 | 81 |
| `driving-logs/analysis-2026-10-19-segment18.md` | 과거 조사·설계/전환 기록 | 1 |
| `driving-logs/analysis-2026-10-19-segment86.md` | 과거 조사·설계/전환 기록 | 1 |
| `driving-logs/assessment-2026-10-19-iqpilot-ha-preservation.md` | 과거 조사·설계/전환 기록 | 3 |
| `driving-logs/assessment-2026-10-19-iqpilot-migration.md` | 검색어 없음 | 0 |
| `driving-logs/comparison-2026-10-19-busyfritz-id4-steering.md` | 과거 조사·설계/전환 기록 | 1 |
| `driving-logs/comparison-2026-10-19-infinitecable2-id4-steering.md` | 과거 조사·설계/전환 기록 | 1 |
| `vehicle-journal/AGENTS.md` | 현행 안내·지침/호환 명칭 | 2 |
| `vehicle-journal/CHANGELOG.md` | 과거 기록·출처 보존 | 95 |
| `vehicle-journal/README.md` | 현행 안내·지침/호환 명칭 | 1 |
| `vehicle-journal/aggregation-rules.md` | 검색어 없음 | 0 |
| `vehicle-journal/assets/README.md` | 검색어 없음 | 0 |
| `vehicle-journal/database-design.md` | 검색어 없음 | 0 |
| `vehicle-journal/deployment.md` | 현행 안내·지침/호환 명칭 | 2 |
| `vehicle-journal/implementation-plan.md` | 현행 안내·지침/호환 명칭 | 4 |
| `vehicle-journal/migration-and-backup.md` | 검색어 없음 | 0 |
| `vehicle-journal/references/README.md` | 검색어 없음 | 0 |
| `vehicle-journal/references/previous-design-request.md` | 검색어 없음 | 0 |
| `vehicle-journal/requirements.md` | 검색어 없음 | 0 |
| `vehicle-journal/usage.md` | 현행 안내·지침/호환 명칭 | 1 |
| `vehicle-journal/validation-plan.md` | 현행 안내·지침/호환 명칭 | 3 |
| `vehicle-journal/vehicle-management.md` | 검색어 없음 | 0 |

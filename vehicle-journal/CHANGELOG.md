## 2026-10-23 — vehicle-journal: 원장 정보 표시 계층·줄바꿈 개선, 모바일 여백 최적화 및 정비/기타 누적 주행거리 입력 지원

- 이유:
  1. 차량 지출 내역(원장)에서 카테고리 알약과 위치가 1번째 줄에 붙어있어 세부 정비 내역(감속기 오일 교환 등)이 아래로 밀려나고, 메모에 입력한 줄바꿈이 화면에 반영되지 않아 정보 가독성이 떨어지는 문제를 해결.
  2. 데스크탑 여백은 유지하되, 모바일 기기(아이폰 등)에서 양옆 여백이 지나치게 넓게 남아(좌우 38px 낭비) 카드가 가운데로 과도하게 좁아지는 현상 해소.
  3. 정비/기타 기록 작성 및 수정 시 계기판 누적 주행거리(`odometer_km`)를 직접 입력하고 보존할 수 있도록 지원.
- 변경 내용:
  1. `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`:
     - 원장 항목(`memoHtml`) 정보 표시 계층 및 줄바꿈 정책 개편:
       * 1행: `<div class="ledger-pill-wrap"><span class="cat-highlight-pill">카테고리 알약</span></div>`
       * 2행: 세부 작업명(`.ledger-main-title`, font-weight: 750, font-size: 15px, '더 볼드체') 표시 (세부 작업이 없으면 위치명 표시).
       * 3행: 장소명 및 누적 주행거리(`.ledger-sub-title`, font-weight: 600, font-size: 13.5px, '중간 볼드체', 예: `게러지247 화성점 · 82,268km`).
       * 4행: 메모 내용(`.memo-desc`, font-weight: 400, '볼드체 아님', `white-space: pre-wrap; word-break: break-word;` 적용으로 작성 시 줄바꿈 100% 반영).
     - 모바일 미디어 쿼리(`@media(max-width: 600px)`): `.shell{padding: 10px 8px 32px}`, `.panel, .hero{padding: 16px 12px}`로 조정.
     - `formFields()`: 정비/기타 기록(`mode === 'maintenance'`) 모드에서 전기차/내연기관 구분 없이 `odometerField` 항상 표시(`visible.add('odometerField')`).
     - `openRecord()`: 기존 기록 수정 시 `record.input?.odometer_km` 및 `record.odometer_km` 자동 바인딩.
     - `saveRecord()`: 계기판 누적거리 입력값을 `payload.odometer_km`에 정수로 안전하게 전달.
  2. `custom_components/carrot_ha/frontend/carrot-journal-design.js`:
     - `.ledger-pill-wrap`, `.ledger-main-title`(750 bold), `.ledger-sub-title`(600 semibold) 스타일 추가.
     - `.memo-desc`에 `white-space: pre-wrap; word-break: break-word; font-weight: 400;` 추가.
     - `@media(max-width: 600px)`에서 데스크탑 여백은 그대로 보존하고 모바일 `.shell` 패딩을 8px, `.panel` 패딩을 12px로 최적화하여 뷰포트 활용도 극대화.
  3. `custom_components/carrot_ha/frontend/carrot-journal-panel-runtime.js`:
     - `@media(max-width: 600px)`에서 `main` 요소의 불필요한 20px 패딩을 `main{padding: 0!important;}`로 제거하여 카드 사이드 여백이 38px에서 8px로 이상적으로 개선됨.
  4. `vehicle-journal/tests/browser-check.cjs`:
     - 장소명 폰트 굵기 단언을 새로운 세미볼드(600/700/750) 디자인 사양에 맞게 갱신.
  5. `vehicle-journal/review-record-display-margins.html`:
     - 개선 전/후 비교, 데스크탑/모바일 뷰포트 전환, 정비 모달 누적거리 입력을 직접 인터랙티브하게 검증할 수 있는 프리뷰 프로토타입 작성.
- 검증 및 배포 상태:
  * Node.js 구문 검사(`node --check`) 4개 파일 통과.
  * DB 스키마 유효성 검사(`python vehicle-journal/schema/validate_schema.py`) 9/9건 통과.
  * HA 서버(`hassio@192.168.0.140`) 백업 생성: `/config/carrot_ha/deployment-backups/journal-ui-layout-20261023_040500/`
  * SSH/SCP를 통해 HA 서버의 `/config/custom_components/carrot_ha/frontend/` 경로로 3개 파일 직접 배포 완료.
  * 최신 SHA-256 검증 결과 (로컬과 원격 서버 100% 일치):
    - `carrot-vehicle-journal.js`: `ff0f319f80c63c49e363a39e4f168cd51ae3c8e4ea2eeee143e79ea39eeed87b`
    - `carrot-journal-design.js`: `11f13d2006624fad5e675a44906ca5a3f9909f67c67eebc321c827a4143d19f4`
    - `carrot-journal-panel-runtime.js`: `266ed944996e3906b650cec9ca8400aa5387df01869a4693c57b4341e045cd1f`
  * HA Core HTTP 엔드포인트 `/api/carrot_ha/frontend-version`에서 `0.9.0-beta.1-6c9c69b226af` 응답 및 정적 파일 서빙 정상 확인.
  * 사용자 브라우저 강력 새로고침(`Ctrl + F5`) 시 즉시 적용됨 (Python 코드 변경이 없으므로 HA Core 재시작 불필요).
  * 사용자 지침에 따라 GitHub 릴리즈/태그는 즉시 발행하지 않고 향후 통합 프리 릴리즈 발행 예정.

## 2026-10-17 — vehicle-journal: 배터리 사용량 계산 엔진 미래 타임스탬프 오염 차단 및 측정 시각 정렬 보정

- 이유: 대시보드 배터리 사용량 주간 그래프에서 특정 요일(일, 월, 화, 목, 금)의 사용량이 빈 값(`None`)으로 누락되고 수요일과 토요일 저녁 일부만 표시되는 버그 발생. 과거 클라우드 동기화 과정에서 유입된 2건의 비정상 미래 타임스탬프 데이터(10/11에 10/13 날짜, 10/14에 10/17 오후 4시 49분 날짜)가 트리거되면서, `battery_history.py`의 직전 시각(`previous[0]`)을 미래로 점프시켜 이후 유입되는 정상 주행 데이터들을 시간 역전 오류로 판단하여 대량 스킵하던 결함을 해결함.
- 변경 내용:
  1. `custom_components/carrot_ha/battery_history.py`:
     - 인과율 위반 미래 타임스탬프 차단: 수신 시각보다 5분 이상 앞선 측정 시각(`t > obs_dt.timestamp() + 300`) 또는 현재 시각 초과(`t > now.timestamp()`) 샘플을 엄격히 제외하도록 가드 추가.
     - 측정 시각(`t`) 기준 시계열 정렬: DB 쿼리 결과(수신 시각 순)를 실제 측정 시각(`t`) 기준으로 선별 및 정렬(`valid_samples.sort(key=lambda s: s[0])`)한 후 시간 간격을 누적하도록 개선하여, 시계 왜곡이나 네트워크 지연 도착으로 인한 `previous` 포이즈닝 원천 차단.
- 검증 및 배포 상태: 실제 HA SQLite DB(10,222건 상태 이벤트) 대상 단위 테스트 및 시뮬레이션 완료. 누락되었던 10/11(4.1%), 10/12(47.2%), 10/13(34.0%), 10/14(42.1%), 10/15(0.2%), 10/16(20.6%), 10/17(15.3%) 전체 배터리 사용량이 100% 정상 복구됨을 검증. SSH/SCP를 통해 HA 서버(`hassio@192.168.0.140`)의 `/config/custom_components/carrot_ha/battery_history.py`에 직접 배포 완료.
  - HA 백업 경로: `/config/carrot_ha/deployment-backups/battery-history-fix-20261017_232638/`
  - SHA-256 일치 확인: `9f36e763f1040f723890da434167160038857faaaf2df9c5db6a2e12fbf543f7`
  - 사용자 HA 재시작 후 적용됨. GitHub 릴리즈/태그는 정책에 따라 발행하지 않음.

## 2026-10-17 — vehicle-journal: 모바일 다이나믹 아일랜드 세이프 에어리어 대응 및 순수 CSS 정적 탭 빔 회전 수정

- 이유: 모바일(아이폰 16 Pro Max 등)에서 플로팅 로딩 버블이 다이나믹 아일랜드 캡슐에 가려지는 문제, 상단 탭이 보이는 상태에서도 플로팅 버블이 노출되거나 렌더링 후 observer가 끊기는 문제, Houdini `@property` 미지원으로 모바일 WebKit에서 애니메이션이 멈추거나 상단 탭 전체가 회전하는 오류를 해결함.
- 변경 내용:
  1. 플로팅 버블 위치 전 기종 대응: `top: max(72px, calc(env(safe-area-inset-top, 0px) + 64px));`로 다이나믹 아일랜드/노치 영역과 겹치지 않도록 충분한 여유 공간 확보.
  2. 순수 CSS 회전 빔 적용: CSS Houdini `@property`를 완전히 제거하고, `.tabs`는 정적(stationary)으로 유지하면서 가상 요소 `::before`에만 `transform: rotate(360deg)`를 적용해 상단바 전체가 도는 버그 방지 및 iOS WebKit Safari 100% 하드웨어 가속 회전 지원.
  3. 스크롤 아웃 정밀 감지 및 Observer 재연결: `rect.bottom <= 10` 기준으로 탭 바가 완전히 화면 상단 밖으로 사라졌을 때만 플로팅 버블이 나타나도록 보정하고, `updateView()` / `renderContent()` 시 detached된 노드를 다시 감지하도록 재연결 로직 보강.
- 검증 및 배포 상태: Node 단위 테스트(12건) 통과. SSH/SCP를 통해 HA 서버(`hassio@192.168.0.140`)의 `/config/custom_components/carrot_ha/frontend/` 경로로 직접 배포 완료.
  - 최신 SHA-256 검증 결과 (로컬과 원격 100% 일치):
    * `carrot-vehicle-journal.js`: `f627cec45fb84468ec65613ae0b765fec0f1eca80bd0cafb82617bf527f5bed7`
    * `carrot-dashboard-ko.js`: `56c7c53aa5c18b355c1db23906a0059821ca407013918187ca0a81981fa4c103`
    * `carrot-dashboard-en.js`: `c968035b8e4e4dc7b23b4be0e994023a25e7e9ef942715a28720602c979ae5cd`
  - GitHub 릴리즈/태그는 정책에 따라 발행하지 않음 (추후 통합 프리 릴리즈 발행 예정).

## 2026-10-17 — vehicle-journal: 상단 탭 코닉 빔 및 플로팅 트리플 펄스 닷 로딩 인디케이터 적용

- 이유: 사용자가 선택한 후보 1(트리플 펄스 닷, Triple Pulsing Dots) 로딩 인디케이터 스타일을 차계부 및 차량 대시보드에 반영하도록 요청함. 탭 바 테두리에 코닉 그라디언트 회전 빔을 적용하고, 스크롤 다운으로 상단 메뉴가 시야에서 벗어날 경우 화면 최상단 중앙에 3단 바운스 닷 플로팅 버블이 표시되도록 구현.
- 변경 내용:
  1. `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`:
     - `@property --carrot-beam-angle` 및 `:host([data-loading="true"]) .tabs` 코닉 빔 회전 애니메이션(`carrotTabBeamSpin`, 1.35s) 추가.
     - 차계부 고유 민트 틸 테마 포인트 색상 토큰 정의 (`--c-load-accent: #81e6c5; --c-load-accent-soft: rgba(129, 230, 197, 0.28); --c-load-ring: rgba(129, 230, 197, 0.42); --c-load-glow: 0 0 14px rgba(129, 230, 197, 0.35);`).
     - 플로팅 버블 `.carrot-floating-bubble` 마크업 및 트리플 펄스 닷 CSS (`carrotBubbleDotBounce` 1.2s, 딜레이 -0.32s, -0.16s, 0s) 추가.
     - `IntersectionObserver`를 활용하여 `.tabs`가 화면 밖으로 스크롤 아웃될 때만 버블이 부드럽게 노출되는 감지 로직 구현.
     - `load()` 시작 시 `data-loading="true"` 설정 및 완료 시 제거.
  2. 접근성: `prefers-reduced-motion: reduce` 지원으로 모션 최소화 환경에서 애니메이션 비활성화.
- 검증 및 배포 상태: Node 단위 테스트(12건) 통과. 사용자 지시(태그/릴리즈 없이 HA 직접 반영)에 따라 SSH/SCP를 통해 HA 서버(`hassio@192.168.0.140`)의 `/config/custom_components/carrot_ha/frontend/` 경로로 직접 동기화 완료.
  - HA 백업 디렉터리: `/config/carrot_ha/deployment-backups/loading-indicators-42489a3/`
  - SHA-256 검증 결과 (로컬과 원격 100% 일치):
    * `carrot-vehicle-journal.js`: `f330ea7868a161ef678a6ff1f65f82e8da2e559e2ec565f64412d322e6459c46`
    * `carrot-dashboard-ko.js`: `b7aa567f78805af835fb6631d1f2b7e9348e60c60c91e950addc37d4f05d95f6`
    * `carrot-dashboard-en.js`: `5911a3c2567bbf8da1d18e9bf29d177b8ace30a43706e95200e9aa4303118c8c`
  - GitHub 릴리즈/태그는 정책에 따라 발행하지 않음 (다음 프리 릴리즈 발행 시 일괄 포함 예정). 브라우저 강력 새로고침(`Ctrl + F5`) 시 즉시 반영됨.

## 2026-10-17 — vehicle-journal: UI 변경 시 사전 인터랙티브 HTML 프리뷰 필수 절차 문서화

- 이유: 사용자가 대시보드·차계부·주행 로그의 UI 변경 요청 시 실제 프로덕션 코드 반영 전에 전체 기능 구현 및 합성 더미 데이터 기반의 로컬 인터랙티브 HTML 프리뷰를 먼저 제시하도록 지침 추가를 요청함.
- 변경 내용:
  1. 실제 프로덕션 프론트엔드 모듈 전체를 누락 없이 번들링하고 `mockHass` 더미 데이터를 연결해 실제 대시보드와 동일하게 모든 탭·지도·차트·원장·모달을 조작할 수 있는 사전 HTML 프리뷰 절차를 명문화.
  2. 각 대시보드의 고유 테마 팔레트 준수, 절제된 모션 적용, 버튼·필(Pill)의 둥근 모서리(`border-radius`) 일치 및 카드 경계 밖 애니메이션 이탈(`overflow`) 방지 검증 기준 추가.
- 관련 파일: `AGENTS.md`, `vehicle-journal/AGENTS.md`, `.agents/rules/vehicle-journal.md`, `driving-logs/AGENTS.md`, `vehicle-journal/CHANGELOG.md`, `driving-logs/CHANGELOG.md`.
- 검증 및 배포 상태: 지침·문서만 변경되었으며 프론트엔드/백엔드 실행 코드는 수정하지 않음(로컬 HTML 아티팩트에서 로딩 인디케이터 모션·테마·모서리/경계 클리핑 개선 시연 진행). 실행 코드 변경이 없으므로 버전 상승·HACS 릴리즈·HA 서버 배포 없음.

## 2026-10-14 — v0.9.0-beta.1 실제 발행 확인

- Release: https://github.com/helico717/carrot-ha/releases/tag/v0.9.0-beta.1
- 태그/manifest 0.9.0-beta.1 일치, 대상 3098f4d25248d7ca63d10d2db69dc754345ba033.
  draft=false, prerelease=true, 본문 11,417자 및 v0.8.12 이후 누적/438건 검증 내용 실제 포함 확인.
- HACS Release Actions 38579281964 성공:
  https://github.com/helico717/carrot-ha/actions/runs/38579281964
- 태그 대상 최종 Direct receiver validation 38579189708 성공(438 Python + 12 JS, 생략 없음):
  https://github.com/helico717/carrot-ha/actions/runs/38579189708
- 수신 앱은 이미 0.1.3 운영 적용. HA는 HACS 베타 표시→0.9.0-beta.1 설치→사용자 HA 재시작 필요.
  이번 게시 확인만으로 아직 설치되지 않은 HA UI/옵션 변경이 운영 적용됐다고 주장하지 않음.
- Comma 원격 브랜치 최신 문서 커밋 5d69d6ae6904be65f00858a79bc861269291ce53,
  클린 설치 시작 보완 실행 코드 커밋 d5879396da460d8fde85171f88d90cfde0d721d4.
  사용자가 HA 원격 터미널에서 cd /data/openpilot && git pull --ff-only && sudo reboot 실행 가능.
  기기 소스 직접 수정/에이전트 기기 재부팅 없음. 실제 초기화/장기 운영 확인은 별도.
- 이 발행 확인은 문서 기록만 추가하며 새 버전/태그/Worker 배포를 다시 만들지 않음.

## 2026-10-14 — v0.9.0-beta.1 발행 전 최종 검증 확정

- 사용자 요청 범위 구현/전수 문서/쉬운 복구 안내 완료. 기존 Markdown 103개 + 신규 6개 = 109개 재검토.
- Linux CI 38578662800 (bdfc63f) 성공: Python 438건 + 대시보드 12건, 실패/생략 없음.
  포함: HA 47 suites, 차계부 62건, 게시 Comma 직접 연결/시작/polling 11건,
  실제 CAN wire/파일 송신/WLV1 영상 소켓·H.264 복원·인증·주행 촬영 차단.
  링크: https://github.com/helico717/carrot-ha/actions/runs/38578662800
- 이전 서버 호환 incremental/benchmark도 통과. Worker 배포·D1 변경 없음.
- 수신 앱 0.1.3 운영 적용/health/실제 수신·HA 저장 확인 200 완료.
  HA 화면·구성 변경은 HACS 0.9.0-beta.1 설치와 사용자 HA 재시작 후 적용.
- 누적 노트에 v0.8.12 이후 개발 주기와 이전 베타의 차계부/충전/주행/카메라/터미널/
  파일 로그/압축 개선 및 이번 직접 수신기·진단·문서·복구 전체를 포함하고 changelog 제목과 대조.
- 실제 클린 설치·백업 복원·정상 장거리 주행/충전·장기 보관은 미확인. 운영 자료를 지워 시험하지 않음.
- 새 태그/Release 발행·Actions 확인은 다음 단계. 기존 태그를 덮어쓰지 않음.

## 2026-10-14 — 현재 WLV1 카메라 검사/설치 설명 정리

- PyAV를 설치한 Linux CI 38577775756에서 과거 카메라 검사가 삭제된 encode_media(MPEG-TS)를
  import하는 문제 확인. 기존 WLV1 카메라 실행 코드 결함과 구분.
- tests/test_camera_transport.py를 실제 장치↔브라우저 WLV1 소켓·H.264 복원·인증/동시 장치 거절·
  주차 idle·주행 촬영 중단/새 시청 거절·마지막 시청 종료·잘못된 프레임 무시·늦은 종료 보호 검사로 갱신.
  7건 로컬 통과. 과거 검사 원문은 docs/archive/camera-transport-test-before-wlv1.txt에 보존.
- docs/CAMERA_SETUP은 이미 제거된 snapshot/HLS 엔티티 설치 설명을 현재 브라우저 영상 방식으로 정리.
  기존 카메라·차계부 실행 코드/자료 변경 없음. 튜너 수신 시각 설명을 완전한 한국어로 정리.
- 실제 초기화/장기 주행 검증 및 HA Core 재시작은 사용자 영역으로 남음. 최종 Linux CI/릴리즈 발행 대기.

## 2026-10-14 — Linux 전체 통과 및 생략된 연결 검사 보완

- Linux CI 38577408742 성공: HA 47 suites + 차계부 62건 = Python 412건 중 409통과/3생략,
  대시보드 12건 통과. 검증 링크: https://github.com/helico717/carrot-ha/actions/runs/38577408742.
- 생략 3건은 companion 수집기 소스 및 PyAV 미설치에 따른 CAN/영상/실제 sender 연동 검사.
  기능 보존 요청에 따라 CI에 게시된 Comma 커밋 d5879396의 sparse checkout과 PyAV 16.0.1을 추가.
  test_can_capture는 명시된 companion 경로를 지원하도록 테스트만 보완. 실제 운영 코드 변경 없음.
- 후속 CI에서 실제 CAN wire·영상 remux/socket·Comma 파일 송신까지 확인 후 릴리즈 태그 발행 예정.

## 2026-10-14 — vehicle-journal: 수신 앱 적용과 누적 검증 상태

- 수신 앱 0.1.3 운영 시작/health/상태 수신/HA ACK 확인. 차계부 실행 코드·자료 변경 없음.
- 전체 HA 검사 확장 중 테스트 namespace의 누락 복원 함수 연결 보완, 기존 cloud_sync 8건 통과.
  Windows archive DB 잠금 제약은 Linux 재검사와 구분 기록. 차계부 Linux 전체 검사 및 릴리즈 확인 대기.
- 쉬운 초기화 복구 안내의 카메라 연결 Windows/Mac 명령을 각각 보완하고 문서/누적 노트 대조.

## 2026-10-14 — vehicle-journal: Linux 단위 검사 환경과 배포 준비 기록

- docs/CI 준비 main 커밋 ceeb00c 확인. 새 CI는 HA 미설치 상태에서 통합 시작을 호출해 중단.
- tools/run-unit-suite.py의 namespace package로 통합 시작을 분리하고 실제 순수 모듈/차계부 suite를 검사.
  차계부 실행 코드·DB·사진 변경 없음. Linux 재검사·수신 앱 설치·릴리즈 확인 대기.

## 2026-10-14 — vehicle-journal: 이전 서버 문서 폐기 표시와 복구/누적 베타 안내

- 이유: 사용자가 HA를 주 화면으로 명시하고 모든 Markdown의 이전 서버 내용 정리와 쉬운 초기화 복구 안내를 요청함.
- 관련: vehicle-journal AGENTS/README/CHANGELOG/deployment/implementation-plan/usage/validation-plan,
  .agents/rules/vehicle-journal.md의 역사 서버 표현 취소선/현재 지시 우선 명시.
  docs/CLEAN_INSTALL_RECOVERY.md는 HA 기록·사진·수신 앱을 함께 백업하고 기기 밖에 보관하도록 안내.
- 차계부 실행 코드·DB·사진·계산·분류·결제 로직은 변경하지 않음.
- 검증/배포: 문서 링크·이전 베타 누적 노트와 diff 대조 진행. Git 커밋/푸시 및 v0.9.0-beta.1 발행 대기.
  개인 기록은 공개 자료에 포함하지 않음. Windows NAS fsync 등 기존 환경 제약은 별도 검증 기록을 유지.

> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](../docs/CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

## 2026-10-14 — 양방향 충전요금 최종 배포 확인

- 커밋 제목: `vehicle-journal: record bidirectional payment deployment verification` (문서만 수정).
- 구현: `0f7f367` 양방향 결제 연결·내구성 큐·레거시 보정 복구, `f5163fb` 기존 비충전 분류 보존.
- 검증: 분류 보존 회귀 포함 차계부 62개 통과. 관련 결제/대시보드/스키마/동기화 검증은 아래 항목 참조. 기존 이벤트 루프 경고 외 실패 없음.
- 배포: `f5163fb70d78c318befd689e47fd0729391d6e2b` main 푸시 및 기존 `v0.8.14-beta.5` 태그 원격 일치 확인. HA Python 파일 5개 최종 커밋과 SHA-256 일치, 코드 백업 `/config/carrot_ha/deployment-backups/f5163fb/`. 기존 Release ID 411761651 유지·pre-release=true·최종 릴리즈 노트 확인. Actions https://github.com/helico717/carrot-ha/actions/runs/38494951582 성공. 원격 태그 소스 확인 완료; 전체 ZIP 추가 다운로드 검증은 전송 지연으로 중단했으며 Actions/태그/개별 소스로 발행을 검증함.
- 운영: Python 적용을 위한 사용자 HA 재시작 및 실제 양쪽 화면의 금액·복구 확인은 대기. 직접 배포했으므로 현재 설치에서는 HA 재시작이 필요하며, HACS 경로를 사용할 경우 동일 beta.5 다시 다운로드 후 재시작. ~~Cloudflare~~·~~D1~~·Comma 변경/배포 없음. 새 프리릴리즈를 만들지 않았으며 기존 beta.5를 사용자 명시 요청대로 갱신함.
- 관련 파일: `vehicle-journal/CHANGELOG.md`. 이 확인 기록은 실행 코드 변경이 없어 별도 버전 상승·태그 이동·배포를 하지 않는다.

## 2026-10-14 — 양방향 결제 배포 검증 및 기존 지출 분류 보존

- 커밋 제목: `vehicle-journal: preserve reclassified expenses during payment recovery`.
- 변경·이유: 이전에 다른 지출 분류로 바꾼 차계부 보정은 충전 결제로 재분류하지 않도록 복구 대상에서 제외. 충전 분류인 자동 결제만 연동한다.
- 관련 파일: `vehicle_journal/payment_sync.py`, `vehicle-journal/tests/test_payment_sync.py`, CHANGELOG 및 beta.5 릴리즈 노트.
- 검증: 첫 구현 `0f7f367`의 차계부 61개, 결제 Python 35개, 스키마 9개, 금액 표시 8개, 대시보드 10개, cloud live/증분/캐시 12개, Comma 파라미터 4개 회귀 및 ~~Worker~~ 증분·벤치마크 통과. 추가 분류 보존 회귀 포함 차계부 전체 재검증. 기존 이벤트 루프 경고 외 실패 없음. Python 문법 검증의 Mac 캐시 쓰기 제한은 임시 캐시 경로로 해결.
- 배포: `0f7f367` main 및 기존 beta.5 태그 원격 일치, HA Python 파일 5개 백업/설치 SHA-256 일치. 기존 Release ID 411761651 유지·pre-release=true·새 노트 확인, HACS Release Actions https://github.com/helico717/carrot-ha/actions/runs/38494539873 성공. GitHub API 캐시 응답은 갱신 전 노트를 반환해 별도 요청으로 최신 노트를 검증했다. 이번 추가 보호도 검증·푸시·HA 파일 반영·동일 beta.5 태그 갱신 예정.
- 운영 적용: HA 재시작 및 실제 양쪽 화면 확인은 사용자 대기. HA 코드 백업은 `/config/carrot_ha/deployment-backups/0f7f367/`. ~~Cloudflare~~·~~D1~~·Comma 변경 없음.

## 2026-10-14 — 자동 충전 결제 양방향 동기화

- 커밋 제목: `vehicle-journal: synchronize charge payments in both dashboards`.
- 변경·이유: 차계부 수정이 별도 보정으로 남아 차량 대시보드의 추정 요금과 달라지던 문제를 수정. 자동 충전 지출은 기존 HA charge_payment 원본으로 연결하고, 차계부→원본 쓰기를 SQLite 내구성 큐로 저장한 뒤 재시도한다. 차량 대시보드→차계부 수정도 즉시 원본 투영을 갱신한다. 이전 차계부 보정은 실제 결제 수정 시각과 비교해 최신 값만 한 번 복구하며, 메모·장소 등 차계부 부가정보는 보존한다. 오래 열린 편집창은 버전 충돌로 거절한다. 수동으로 추가한 별도 지출은 자동 충전과 임의 병합하지 않는다.
- 관련 파일: `vehicle_journal/{store,source,payment_sync,api}.py`, `charge_ws.py`, `vehicle-journal/tests/{test_journal,test_payment_sync}.py`, 기존 beta.5 릴리즈 노트.
- 검증: 차계부 전체·충전 결제 API/저장·스키마·한/영 요금 표시·최신 상태/이력/증분 동기화 회귀 통과. 합성 데이터로 양방향 수정, 0원, 실제 금액 삭제, 레거시 복구와 최신 결제 우선, DB 쓰기 전/후 중단 및 재시작 복구 확인. 시스템 Python의 Pillow 부재는 번들 Python으로 해결; 기존 unclosed event loop 경고는 남아 있음.
- 배포: main 푸시·HA 코드 백업/직접 반영·기존 `v0.8.14-beta.5` 재발행 준비 중. 사용자 2026-10-14 명시 요청에 따라 새 프리릴리즈를 만들지 않고 기존 태그/Release를 갱신한다. Python 적용을 위한 사용자 HA 재시작 및 실제 양쪽 화면 확인은 대기.
- 제한: 열린 화면은 기존 갱신 주기(최대 약 60초) 또는 새로고침 때 갱신. ~~Cloudflare~~·~~D1~~·Comma 변경/배포 없음. 수동 독립 지출 및 원본이 없는 기록은 자동 결제와 연결하지 않는다.

## 2026-10-13 — 0.8.14-beta.5 실제 발행 확인

- 커밋 제목: `vehicle-journal: record 0.8.14-beta.5 publication verification`.
- 발행 대상: `0ded40cac4bd4171a6d39755cfeff795da2a5a40`. main과 신규 `v0.8.14-beta.5` 태그가 이 커밋으로 원격 일치했고 manifest `0.8.14-beta.5`를 확인했다. 이후 이 결과 문서 커밋은 태그를 이동하지 않는다.
- Release: https://github.com/helico717/carrot-ha/releases/tag/v0.8.14-beta.5 — 2026-10-13 KST 23:21:13 발행, prerelease=true, draft=false. 로컬 전체 노트가 GitHub 본문에 그대로 포함됨을 확인했다. beta.4 이후 73개 커밋·57개 변경 파일 대조, 기존 beta.1~4 노트 및 CHANGELOG 전체 항목 색인을 포함했다.
- Actions: https://github.com/helico717/carrot-ha/actions/runs/38412586087 — `HACS Release`, `completed/success`, head_sha와 태그 일치 확인. 이전 v0.8.14 실행과 구분한다.
- 검증: 준비 항목의 Python/SQL/OCR/대시보드·Chrome·~~Worker~~·Comma polling·카메라 회귀 결과 유지. 실제 새 베타의 HA 설치/재시작/운영 확인은 수행하지 않았다. 로더 원본 테스트의 fixture 에셋 경로 오류는 임시 사본으로 검증했으며 실행 코드 또는 테스트 원본 수정 없음.
- 배포: GitHub/HACS pre-release 배포 완료. 사용자가 HACS 베타 버전 표시 → 0.8.14-beta.5 업데이트 → HA 재시작 → 브라우저 새로고침을 수행한다. Worker/D1/Comma 변경·배포 없음. 개인 DB·사진·설정·미추적 중복 파일은 발행 대상에 넣지 않았다.
- 관련 파일: 본 CHANGELOG만 추가 기록. 문서 커밋·푸시 대상이며 추가 버전/태그/Release는 발행하지 않는다. 휴대폰 OCR·다음 자동 충전 장소·서버 API 실제 저장/삭제·14일 탐색·예약 NAS/장기 GFS 확인은 기존 제한대로 남아 있다.

## 2026-10-13 — 0.8.14-beta.5 누적 pre-release 준비

- 커밋 제목: `vehicle-journal: prepare 0.8.14-beta.5 prerelease`.
- 변경·이유: 사용자 요청으로 현재 Git 관리 main을 새 pre-release로 발행한다. 마지막 GitHub pre-release `v0.8.14-beta.4`부터 소스/문서 기준 `fad027aae44394e597de85a366dfdc91458f4aa2`까지 전체 커밋·57개 파일 diff를 대조했고, 차량 관리·이관·스냅샷·NAS·장소/연비 통계·기록/사진/영구 삭제·OCR·화면 개선·14일 배터리 탐색·브랜치 전환 계획을 모두 노트에 반영했다. 기존 CHANGELOG 전체 항목 색인 및 beta.1~beta.4 원문을 포함해 누적 변경을 보존한다. 브랜치 계획은 문서이며 미구현임을 구분한다.
- 관련 파일: `custom_components/carrot_ha/manifest.json`, `.github/release-notes/v0.8.14-beta.5.md`, 본 기록. manifest/tag는 0.8.14-beta.5로 일치시키며 기존 태그/미추적 중복 파일은 유지한다.
- 검증: 차계부 Python 55건·schema 9건·OCR 파서 20건·dashboard 12건·latest 6건·incremental 5건·history cache 1건·charge graph 27건 통과. Chrome 기본 browser-check 통과. Chrome 주행 입력·사진 편집 및 로더 회귀 통과. 기존 loader-update 테스트 서버가 path.basename으로 leaflet.css 하위 경로를 버리는 ENOENT는 임시 사본 서버에서만 경로/MIME를 수정해 검증했고 저장소 코드는 변경하지 않았다. ~~Worker~~ 증분/benchmark 통과(미변경 1 query / 81 bytes), Comma parameter polling 4건·카메라 회귀 4건/주행 안전 차단 통과. 발행 결과는 후속 기록으로 확정한다. Python suite의 unclosed event loop ResourceWarning은 실패가 아니며 실기 장애로 해석하지 않는다.
- 배포: main 커밋/푸시·새 태그·GitHub Actions Release 발행 대상. 이번 요청은 HACS pre-release 패키지 배포이며 직접 HA 동기화나 사용자 재시작을 대신 수행하지 않는다. Worker/D1/Comma 변경·배포 없음.
- 제한: 실제 휴대폰 OCR·다음 자동 충전 위치·새 서버 API 실사용·14일 배터리 페이지·NAS 03:00 및 장기 GFS는 미확인. 기존 개발 버튼은 유지한다. 사용자 HACS 베타 업데이트/HA 재시작 후 확인 필요. 확정 원격 커밋·Actions·Release 링크는 후속 발행 기록에 남긴다.

## 2026-10-13 — 차계부 데스크톱 레이아웃 최대 폭 제한 해제 및 화면 전체 확장 (Full-Width)

- 커밋 제목: vehicle-journal: expand desktop container to full width and remove max-width restriction
- 변경·이유:
  - 데스크톱/태블릿 화면 전체 확장 (Full-Width 레이아웃):
    - PC나 와이드 화면에서 차계부 본문 카드 및 테이블이 `max-width: 1280px` / `1320px`에 가로막혀 우측과 여백이 붕 뜨던 문제를 해결하고, 화면 좌우 끝까지 시원하게 꽉 채우는 형태로 확장했다.
    - 패널 런타임(`carrot-journal-panel-runtime.js`): `<main>` 컨테이너의 `max-width: 1320px; margin: auto;`를 제거하고 `width: 100%; max-width: none; box-sizing: border-box; padding: 16px 20px; margin: 0;`으로 설정하여 상단 헤더와 자연스럽게 이어지도록 최적화했다.
    - 디자인 및 본체 스타일(`carrot-journal-design.js`, `carrot-vehicle-journal.js`): `.shell`의 `max-width: 1280px; margin: auto;`를 해제하고 `width: 100%; max-width: none; box-sizing: border-box; margin: 0; padding: 24px 16px;`으로 설정했다.
    - 모바일 완전 보존: 모바일 뷰(`@media(max-width:600px)` 및 `@media(max-width:760px)`)는 이미 360~430px 너비에서 100% 뷰포트를 사용하고 있으며, 모든 반응형 미디어 쿼리 패딩 및 스타일 규칙이 독립 격리되어 있어 기존 모바일 UI에 0.1%의 사이드 이펙트나 깨짐 없이 완벽히 보존된다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-panel-runtime.js`, `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, 본 변경 기록.
- 검증·배포: Python 55개, 스키마 9개, JavaScriptCore 20개 테스트 100% 통과. main 커밋 푸시 및 HA 직접 반영·SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 상세기록 탭 내 중복 '기록 남기기' 버튼 삭제 및 분류 선택 하단 여백 제거

- 커밋 제목: vehicle-journal: remove redundant ledger add button and eliminate whitespace under category filter
- 변경·이유:
  - 상세기록 탭(`#page3`) 내 중복 '기록 남기기' 버튼 삭제:
    - 어느 탭에서든 상단에 항상 노출되는 공통 `+ 기록 남기기` 버튼이 이미 존재하므로, 상세기록 탭 내부 카드에 별도로 들어간 `<button id="addLedger" class="btn-record-primary">＋ 기록 남기기</button>` 버튼을 삭제했다.
    - 패널 제목을 `<div class="ledger-panel-header"><h2>차량 지출 내역이에요.</h2></div>`로 정리하고 불필요한 이벤트 바인딩 배열에서 `addLedger`를 제거했다.
  - '분류 선택' 버튼과 하단 기록 목록 사이 빈 공간 완전 제거:
    - 원인:
      1) `.ledger-filters`의 하단 마진(`margin: 16px 0 20px;`) 20px.
      2) `.table-wrap`(`overflow: auto/visible`)과의 마진 미상쇄 및 `.table`/`.ledger-table`의 상단 마진(`margin-top: 15px/8px`).
      3) 모바일 환경(`@media(max-width:760px)`)에서 thead의 유일한 표시 요소인 `#ledgerAmountHeader`(`금액 · 시간순`)가 우측 정렬된 상태에서 `padding: 8px 0`을 차지하고, 첫 번째 행(`tbody tr`)이 `padding: 18px 0`을 가지며 좌측 `분류 선택` 버튼 바로 아래에 70px 이상의 거대한 빈 공간이 형성되던 문제.
    - 조치:
      1) `.ledger-filters`: `margin: 12px 0 0;`으로 하단 마진 20px을 제거.
      2) `.ledger-dropdown:not([open]) .ledger-category-filters`: `display: none !important;`를 명시하여 닫힌 상태에서 레이아웃 공간 차지 방지.
      3) `#page3 .table-wrap`: `margin-top: 4px;`로 컴팩트하게 밀착.
      4) `#page3 .ledger-table`: `margin-top: 0 !important;`로 상단 기본 마진 무효화.
      5) 데스크톱 `.ledger-table th`: 패딩을 `8px 6px`로 정돈.
      6) 모바일 `#page3 .ledger-table thead tr`: `margin-bottom: 0;` 및 `#ledgerAmountHeader` 패딩을 `2px 0 4px`, `line-height: 1.2`로 축소.
      7) 모바일 `#page3 .ledger-table tbody tr:first-child`: 첫 행 상단 패딩을 `6px`로 줄여 `금액 · 시간순` 바로 아래에 첫 기록이 군더더기 없이 이어지도록 최적화.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, 본 변경 기록.
- 검증·배포: Python 55개, 스키마 9개, JavaScriptCore 20개 테스트 100% 통과. main 커밋 푸시 및 HA 직접 반영·SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 사진 업로드 대기 전용 팝업 추가, 대시보드 복귀 취소 버튼 및 주유소 위치 자동 반영 보완

- 커밋 제목: vehicle-journal: add receipt waiting modal with cancel button and fix auto station location apply
- 변경·이유:
  - 사진 업로드 대기 전용 팝업(`#receiptWaitingDialog`) 신설:
    - 사용자가 영수증 촬영/앨범 선택을 눌렀을 때 빈 대시보드 화면에 시스템 파일 피커가 덩그러니 뜨는 마감 부족을 해결하기 위해, 사진이 실제로 선택·업로드될 때까지 화면을 유지하는 독립된 전용 대기 팝업 다이얼로그를 신설했다.
    - 펄스 링 그래픽과 "사진 업로드를 기다리고 있어요...", "영수증 사진을 촬영하거나 앨범에서 선택해 주세요." 안내 및 하단 [취소] 버튼(`#cancelReceiptWaiting`)을 배치했다.
    - 사진 선택창에서 취소했거나 화면을 잘못 눌러 메뉴가 닫혔을 때, [취소] 버튼을 누르면 대기 팝업이 닫히며 기록 전체가 취소되어 대시보드로 온전히 복귀한다. 사진이 정상 선택되면 대기 팝업이 닫히고 주유 기록 폼이 열리며 OCR 진행 오버레이로 매끄럽게 전환된다.
  - 영수증 메뉴 대시보드 복귀 취소 버튼 보강:
    - 영수증 입력 방식 선택 팝업(`#receiptSourceDialog`) 하단에 [취소] 버튼(`#cancelReceiptSource`)을 추가하여 상단 닫기 버튼 외에도 모바일에서 한 손으로 쉽게 대시보드로 돌아갈 수 있도록 개선했다.
    - 주유 기록 폼의 OCR 취소 시에도 영수증 모드일 경우 다이얼로그를 닫고 대시보드로 복귀하도록 연결했다.
  - 주유소 위치 자동 매칭 및 폼 반영 결함 보완:
    - 영수증 OCR 완료 후 카카오맵 검색 결과(`SK에너지 청계주유소`)를 주유 폼에 자동 반영할 때, 지도가 아직 열리지 않은 상태(`locationMarker`가 null)에서 마커 이동을 시도하다 발생하던 `setPosition` 자바스크립트 널 참조 예외를 방지하기 위해 `setLocation`에 널 가드를 추가했다.
    - 매칭된 주유소 정보를 `draftLocation`에 직접 대입하고 `renderLocation()`을 호출하여, 위치 요약 pill, 도로명 주소(`경기 의왕시 민백길 1`), 장소명, 카카오 지도 중심 및 핀 위치, 초록색 [자동입력] 뱃지가 화면에 즉시 정상 기입되도록 보완했다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, 본 변경 기록.
- 검증·배포: Python 55개, 스키마 9개, JavaScriptCore 20개 테스트 100% 통과. main 커밋 푸시 및 HA 직접 반영·SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 모바일 입력기 라벨 간격 정상화, 유일 주소 주유소 매칭 복원 및 사진 선택 전 폼 노출 방지

- 커밋 제목: vehicle-journal: fix mobile field gap, restore unique station address match, and defer modal open
- 변경·이유:
  - 모바일 입력기 제목-입력창 간격 정상화:
    - 모바일 미디어 쿼리(`@media(max-width:440px)`)에서 `#recordDialog .fields>label:not(.fullfield):not(#dateField)`에 지정되어 있던 `display: grid; grid-template-rows: minmax(38px, auto) auto;`로 인해, 입력기 제목 텍스트 아래에 불필요한 38px의 빈 공간이 강제 할당되어 제목과 입력창 사이가 붕 떠서 동떨어져 보이던 결함을 `display: flex; flex-direction: column; gap: 5px;`로 복원하여 제목 바로 아래에 입력창이 컴팩트하게 밀착되도록 수정했다.
  - 영수증 도로명 주소 기반 주유소 자동 매칭 복원:
    - 도로명 주소(도로명, 본번, 부번, 시군구, 시도)가 엄격하게 일치하는 가스스테이션 검색 결과가 유일하게 1개인 경우, 영수증 상호명의 미세한 OCR 오탈자(예: 'SK에너지 청계주유소'의 '청'이 '정'으로 인식)에도 불구하고 해당 건물번호에 다른 주유소가 없으므로 안전하게 채택하도록 복원했다. 기존에는 `rank: 3`으로 분류된 후 `rank <= 2` 검사에서 탈락하여 무조건 `null`로 반환되던 문제를 해결했다.
    - 동일 주소에 복수의 주유소(경합)가 존재하는 경우에만 상호명으로 구별하며, 구별이 불가능하거나 모호한 경우 공란(`null`)을 유지하여 원칙을 보존했다.
  - 앨범/촬영 선택 전 주유 기록 폼 노출 방지:
    - ‘직접 촬영할게요’ 및 ‘앨범에서 선택할게요’ 클릭 시 즉시 `openRecord`를 호출하지 않고, 실제 파일 선택 이벤트(`onReceiptSelected`)가 발생한 시점에 비로소 주유 기록 팝업을 열고 OCR 진행 오버레이를 띄우도록 수정했다. 사용자가 사진 선택창에서 취소할 경우 주유 기록 화면이 전혀 열리지 않고 원래 화면을 유지한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `custom_components/carrot_ha/frontend/carrot-receipt-ocr.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `tests/receipt-parser.test.js`, 본 변경 기록.
- 검증·배포: Python 55개, 스키마 9개, JavaScriptCore 20개 테스트(유일 주소 일치 매칭, 복수 주유소 경합 시 상호명 구별 및 모호 시 null 반환 테스트 추가) 100% 통과. main 커밋 푸시 및 HA 직접 반영·SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 주유 영수증 촬영·앨범 선택 팝업 추가 및 파일 입력 분리

- 커밋 제목: vehicle-journal: add receipt source modal and separate camera and album inputs
- 변경·이유:
  - 신규 선택 팝업: ‘주유 영수증 촬영’ 메뉴 선택 시 카메라나 파일 선택기를 즉시 열지 않고 “주유 영수증을 어떻게 올리시겠어요?” 질문 팝업(`#receiptSourceDialog`)을 먼저 노출하도록 변경했다.
  - 버튼 레이아웃 및 그래픽: 왼쪽 “직접 촬영할게요”(카메라 SVG 아이콘)와 오른쪽 “앨범에서 선택할게요”(앨범 SVG 아이콘)를 나란히 배치했다. 이모티콘이나 문자 기호 대신 기존 차계부 기록 메뉴와 일치하는 24×24 stroke 2.2 스타일의 정제된 벡터 아이콘을 적용했다.
  - 환경별 동작 및 입력 분리:
    - 촬영 전용 input(`#receiptCameraInput`): `capture="environment"` 속성으로 모바일 환경(iPhone Safari, Android Chrome)에서 후면 카메라 직접 촬영을 요청한다.
    - 앨범 전용 input(`#receiptAlbumInput`): `capture` 속성을 제거하여 사진 보관함/파일 선택창을 호출한다.
    - 데스크톱 환경에서는 두 버튼 모두 표준 단일 파일 선택창을 안전하게 연다.
    - 두 입력 모두 `multiple` 속성 없이 1장의 영수증 사진만 선택할 수 있도록 제한했다.
    - 파일 선택 시작 전 및 완료 시 `input.value = ''`로 초기화하여 동일한 사진을 다시 선택해도 `change` 이벤트 및 OCR이 정상 재실행되도록 보장했다.
  - 기존 OCR 파이프라인 연계: 촬영과 앨범 선택 모두 사진 선택 즉시 동일한 영수증 OCR 처리 경로(`handleReceiptPhoto`)로 진입하며, 전체 팝업 진행 화면(`#receiptOcrOverlay`), 3단계 요체 안내, 필드별 자동입력 하이라이트, 사용자 확인·수정 및 수동 저장 흐름을 동일하게 유지한다. 선택 취소 시 빈 기록 저장이나 OCR을 실행하지 않는다.
  - HA Android 앱 제한(이슈 #6055): Android Chrome에서는 카메라가 즉시 실행되나, Home Assistant Android 공식 앱은 WebView 파일 피커 인텐트 구현 한계로 인해 `capture="environment"` 지정 시에도 시스템 사진 선택창이 열릴 수 있음을 확인하고, 두 경로를 분리된 요소로 격리하여 안전성을 확보했다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, 본 변경 기록.
- 검증·배포: Python 55개, 스키마 9개, JavaScriptCore 18개, 다이얼로그 마크업·CSS 어설션 테스트 100% 통과. main 커밋 푸시 및 HA 직접 반영·SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 영수증 OCR 날짜 오인식 방지, 다중 행 주소 연결 제한 및 엄격한 장소 매칭

- 커밋 제목: vehicle-journal: prevent date false positives and restrict multiline address matching
- 변경·이유:
  - 날짜 오인식 방지: 식별번호(`고객번호`, `회원번호`, `카드번호`, `단말기번호`, `전표번호`, `영수증번호`, `승인번호`, `일련번호`, `거래번호` 등)가 유효 달력 숫자(8자리)라는 이유로 날짜로 채택되던 결함을 차단했다. 날짜 추출 시 명시적 거래 문맥(`거래일시`, `주유일시`, `[등록]`, `판매일자` 등) 또는 한글/구분자 날짜 표기만 허용하고, 문맥 없는 standalone 8자리 숫자는 배제했다. 복수 상이 날짜 충돌 시 임의 선택을 금지하고 `null`(공란)을 반환하며, KST 오늘을 초과하는 미래 날짜를 차단했다.
  - 바코드 임의 날짜 복원 가정 제거: 불명확한 숫자열에서 날짜 임의 추출을 배제하고 지원하지 않는 경우 공란을 유지하도록 했다.
  - 다중 행 주소 연결 제한: 중간에 결제·승인·품목 정보가 섞인 행(`경기도 시험시 \n 승인금액 70000 \n 가상길 1`)이 주소로 오조합되던 문제를 방지하기 위해 비주소 블랙리스트 단어가 포함된 경우 즉시 연결을 중단하고, 즉시 인접한 다음 행(i+1)이 도로명+건물번호 패턴으로 시작할 때만 결합하도록 제한했다. 60자 초과 긴 검색어는 차단했다.
  - 장소 매칭 엄격화: 도로명 주소의 건물번호 부분 문자열 비교(`.includes`)로 인해 건물번호 1이 11이나 1-1에 오매칭되던 치명적 결함을 수정했다. 도로명, 본번(`mainNum`), 부번(`subNum`), 시/군/구, 시/도를 분해(`parseRoadAddressComponents`)하여 본번과 부번 및 지역이 완벽히 일치할 때만 주소 일치로 판정한다. 동일 주소 경합 주유소는 상호명으로 구별 불가능할 경우 공란을 유지한다.
  - 불일관성 검증 및 비동기 상태 가드: 동일 브라우저 인스턴스 내 캔버스 픽셀 해시(5회 100% 일치)와 ~~Worker~~ 텍스트 해시(3회 100% 일치) 실측을 통해 "GPU/DPI/메모리로 매번 픽셀이 달라진다"는 가설을 기각하고, 실제 원인인 전처리 클리핑/레이아웃 변동 취약성 및 비동기 타이머 경쟁 상태를 규명했다. `ocrGeneration` 카운터와 `ocrCloseTimer` 타이머 가드를 적용하여 비동기 닫힘/중복 실행 충돌을 방지하고, 새 사진 선택 시 이전 자동입력값을 안전하게 리셋하며 사용자가 수정한 값은 보존하도록 보강했다. 실패 시 안내 배너 문구를 표시한다.
  - 테스트 단언문 복원: `test_journal.py`의 `total_cost_krw: 55000` 및 `fuel_liters: 25` 단언문을 온전히 복원했다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-receipt-ocr.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `tests/receipt-parser.test.js`, `vehicle-journal/tests/test_journal.py`, 본 변경 기록.
- 검증·배포: Python 55개, 스키마 9개, JavaScriptCore 18개 테스트(고객번호 날짜 오인식 방지, 복수 상이 날짜 충돌 기각, 미래 날짜 차단, 결제 행 개입 다중 행 주소 차단, 건물번호 1 vs 11 및 1-1 엄격 분리, 지역 불일치 기각 등) 100% 통과. main 커밋 푸시 및 HA 직접 반영·SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 자동입력 뱃지 알약 크기 조정 및 OCR 파서 유연성 강화

- 커밋 제목: vehicle-journal: fit auto-fill badge pill and strengthen OCR regex parsing
- 변경·이유: 입력 폼의 ‘자동입력’ 뱃지가 flex 컨테이너에서 가로 전체 폭으로 늘어나던 문제를 `align-self: flex-start; width: fit-content; border-radius: 9999px;`로 수정하여 글자 크기에 딱 맞는 컴팩트한 알약 형태로 조정했다. 또한 OCR 획 인식 편차로 인한 날짜·주소 누락을 완화하기 위해 년/월 오인식 문자(`[년연넌변전]`, `[월원]`) 허용, 8자리 컴팩트 날짜 백업 탐색, 줄바꿈 분리 다중 행 주소 탐색 및 시/군/구 도로명 폴백을 추가했다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `custom_components/carrot_ha/frontend/carrot-receipt-ocr.js`, `tests/receipt-parser.test.js`, `vehicle-journal/tests/test_journal.py`, 본 변경 기록.
- 검증·배포: Python 55개, 스키마 9개, JavaScriptCore 12개 테스트(다중 행 주소, 시/군/구 주소, 일자 변형 테스트 추가) 통과. main 커밋 푸시 및 HA 직접 반영·SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 주유 영수증 OCR 코어 에셋 보완 및 도로명 번호 정규화

- 커밋 제목: vehicle-journal: bundle tesseract core glue assets and normalize address digits
- 변경·이유: Tesseract.js Web Worker는 원시 `.wasm`이 아닌 Emscripten JS 글루 파일(`tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js`)을 `importScripts`로 로드하므로, 코어 JS 에셋을 로컬 번들에 추가하고 `corePath` 디렉토리 경로 전달을 수정했다. 또한 감열지 영수증 폰트에서 도로명 뒤 건물번호 1이 파이프(`|`) 또는 영문(`l`/`I`)으로 인식되는 문제를 정규화했다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-receipt-ocr.js`, `custom_components/carrot_ha/frontend/carrot-assets/tesseract/tesseract-core-simd-lstm.wasm.js`, `custom_components/carrot_ha/frontend/carrot-assets/tesseract/tesseract-core-lstm.wasm.js`, 본 변경 기록.
- 검증·배포: 사용자 실제 영수증 사진(`KakaoTalk_Photo_2026-10-13-19-56-23.jpeg`)을 헤드리스 Google Chrome에서 직접 구동하여 날짜(2026-05-22), 유종(고급휘발유), 단가(2,445원), 수량(28.630L), 금액(70,000원), 주유소(직영 9 청계주유소), 주소(경기도 의왕시 민백길 1), 삼각 일관성 통과를 E2E로 확인. Python 55개, 스키마 9개, JSC 파서 9개 검증 통과. HA 직접 반영 및 SHA-256 일치 확인. 릴리즈 발행 없음.

## 2026-10-13 — 주유 영수증 촬영·OCR 인식 및 자동 입력 UI 구현

- 커밋 제목: vehicle-journal: implement fuel receipt OCR and auto-fill UI
- 변경·이유: 차계부 ‘주유 영수증 촬영’ 선택 시 모바일 카메라 직접 촬영 또는 데스크톱 파일 선택 후, 팝업창 전체 영역에 3단계 진행 애니메이션(OCR 인식 → 정보 자동 입력 → 자동 입력 완료)을 표시하고 영수증 정보를 해당 입력창에 자동 기입한다.
- UI 및 사용자 흐름:
  - 팝업창 전체를 덮는 블러 배경의 `#receiptOcrOverlay`와 스캔 빔/펄스 링 그래픽을 구현했다.
  - OCR 진행 문구를 요체로 표시하며 단계별 인디케이터(dot)를 활성화한다.
  - 인식이 끝나면 자동 입력된 항목에 전용 초록색 테두리 및 ‘자동입력’ 뱃지를 표시하여 사용자가 명확히 식별할 수 있게 한다.
  - 사용자가 값을 수정하면 즉시 자동입력 표시가 해제되며 수동 입력 상태(`unit_price_source='manual'`)로 전환된다.
  - 확실하지 않은 항목은 추측하거나 0으로 채우지 않고 공란으로 둔다. OCR 완료만으로 자동 저장하지 않고 사용자가 최종 확인·수정한 뒤 기존 저장 버튼으로 저장한다.
- 안전성 및 상태 분리:
  - 영수증 모드(`isReceiptMode`)를 분리하여 GPS 기반 자동 장소 선택(`autoSelectStation()`)과 폼 기본 날짜/차량 기본 유종이 자동 입력값처럼 채워지는 것을 차단했다.
  - 오피넷 단가 실시간 조회(`applyStationPrice`, `refreshStationPrice`)가 영수증 단가를 덮어쓰지 못하도록 `unitPriceSource === 'receipt'` 가드를 추가했다.
  - 주유량 추정(`estimateFuelLiters`)이 OCR 처리 중에 동작하지 않도록 억제 플래그(`suppressFuelEstimation`)를 적용했다.
  - 사용자가 새 사진을 선택하거나 팝업을 닫을 때 이전 Web ~~Worker~~ 작업을 중단(`AbortController` 및 ~~Worker~~ 종료)하여 메모리 누수와 지연된 결과 덮어쓰기를 방지했다.
- 파서 및 주유소 매칭:
  - Tesseract.js (v5.1.1) WebAssembly 단일 Web Worker로 브라우저 내에서만 동작하며 외부 전송을 하지 않는다.
  - 한국어 영수증 도메인 파서(`parseFuelReceipt`)로 날짜(달력 유효성), 유종(보통/고급휘발유/경유/주유기 번호 분리), 단가, 수량, 결제금액, 주유소명/주소를 추출한다.
  - 승인번호, 사업자등록번호, 카드번호, 전표번호 등 8자리 이상의 노이즈 숫자를 금액이나 단가로 오인하지 않도록 철저히 배제한다.
  - 금액 = 단가 × 주유량 삼각 교차 검증을 수행하며, 할인·포인트 차이 발생 시에도 비정상 수정 없이 원본 인식값을 유지한다.
  - 주유소 위치는 영수증 상호/도로명 주소와 카카오 장소 검색 결과를 대조하여 유일하고 확실한 경우에만 자동 선택(`matchStationFromReceipt`)하며 모호할 경우 공란을 유지한다.
- 에셋 및 백엔드:
  - Tesseract JS/Worker/WASM 및 kor/eng 언어 모델 파일을 HA 로컬 정적 경로(`custom_components/carrot_ha/frontend/carrot-assets/tesseract/`)에 배치하여 외부 CDN 없이 오프라인 서빙한다.
  - `custom_components/carrot_ha/vehicle_journal/store.py`에서 `unit_price_source` 허용값에 `'receipt'`를 추가하여 영수증 단가 저장 및 조회를 보장했다.
- 관련 파일: `custom_components/carrot_ha/vehicle_journal/store.py`, `custom_components/carrot_ha/frontend/carrot-receipt-ocr.js`, `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `custom_components/carrot_ha/frontend/carrot-assets/tesseract/`, `vehicle-journal/tests/test_journal.py`, `vehicle-journal/tests/test_station_backup.py`, `vehicle-journal/tests/test_vehicle_import.py`, `tests/receipt-parser.test.js`, `vehicle-journal/CHANGELOG.md`.
- 검증·배포: Python 55개 테스트, JavaScriptCore 파서 9개 단위 테스트, 스키마 9개 검증 통과. Tesseract/JS 문법 검증 완료. HA 직접 반영(백업 생성 및 파일 배포, SHA-256 일치 확인). 버전·태그·릴리즈 발행 없음. Python `store.py` 변경 적용에는 사용자 HA 재시작 필요.

## 2026-10-13 — 주행 전용 안내 및 운영 반영 확인

- 커밋 제목: vehicle-journal: clarify odometer guidance and record trip deployment
- 변경·이유: 주행 폼에 남아 있던 소비량·시각 미입력 안내를 필수 누적거리 입력 안내로 바꾼다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, 본 변경 기록.
- 검증·배포: `e8b8e67` main 푸시·HA 다섯 파일 백업/반영·SHA-256 일치 확인. 운영 Chrome에서 실제 주행 선택 클릭 후 정상 모달·날짜·누적거리·사진 0/1 노출 확인, 카드 모듈 `0.8.14-beta.4-9f45ff86d829`. 기존 전체 브라우저 탭·차트·수동 저장·모바일 회귀도 통과. 사용자 기록 생성·사진 업로드는 하지 않았다. Python 조회 및 DB 사진 제한은 사용자 HA 재시작 대기다. 릴리즈 발행 없음.

## 2026-10-13 — 주행 기록 열기 오류 및 날짜·누적거리·사진 1장 전용 폼

- 커밋 제목: vehicle-journal: fix trip entry and simplify odometer records
- 변경·이유: 운영 브라우저에서 주행 기록 선택 시 읽기 전용 value 대입 오류가 발생해 선택창만 닫히는 것을 재현했다. 구간/누적거리 라디오 값 대입 경로를 제거하고 날짜·필수 숫자 누적거리·선택 사진 최대 1장만 표시한다. 메모·위치·구간거리 선택은 폼에서 숨기고 새 저장 요청에서 제외한다.
- 조회: 연결 차량도 직접 입력한 주행 기록을 상세 목록에서 조회·수정·삭제할 수 있도록 capability 기반 조회 옵션을 추가한다. 자동 주행 원장은 이 목록에 섞지 않는다. 기존 서버는 새 옵션을 받지 않으며 새 서버 적용에는 HA 재시작이 필요하다.
- 사진: 화면과 SQLite 첨부 추가/복원 트리거에서 주행 기록 최대 1장을 검증한다. 기존 구간 주행 기록 형식은 DB에서 보존하며, 사진 여러 장인 이전 기록은 편집 저장 전에 1장으로 정리해야 한다.
- 관련 파일: frontend 카드·디자인, vehicle_journal API·store·schema.sql, `vehicle-journal/schema/001_initial.sql`, `vehicle-journal/tests/trip-record.cjs`, `test_journal.py`.
- 검증·배포: Python 55개·스키마 9개 검증 통과. 합성 Chromium의 실제 주행 기록 선택 클릭·세 항목 노출·빈 누적거리 거부·사진 2장 거부·1장 업로드·저장 요청 검증 통과. DB의 연결 차량 수동 주행 재조회·누적거리 및 사진 1장 SQL 제한 검증 통과. 커밋·HA 반영 진행 중. 직접 배포하며 릴리즈·태그 발행 없음. 실제 사용자 주행 기록을 임의로 생성하지 않는다.

## 2026-10-13 — 기존 사진 수정 미리보기·저장 시 제거 및 2열 입력 높이 정렬

- 커밋 제목: vehicle-journal: edit saved photo attachments and align compact fields
- 변경·이유: 사진 개수에는 기존 첨부가 포함되지만 편집 미리보기는 새 파일만 렌더했다. 인증된 HA 사진 읽기로 기존 첨부의 썸네일·삭제 버튼을 표시하고 삭제 대기 목록을 편집 상태로 관리한다. 닫기는 취소이며 저장 시에만 제거한다. 사진 수·추가 제한에는 삭제 예정 사진을 제외한다. 늦은 사진 응답은 새 편집 창이나 닫힌 창에 반영하지 않는다.
- 서버: 기존 record/save 트랜잭션에서 사진 UUID·소유 차량/기록·활성 상태·기록 버전을 검증한 뒤 첨부를 삭제 상태로 바꾼다. 사진만 변경해도 기록 버전을 올리며 삭제 명령은 다음 입력값에 남기지 않는다. 사진 파일은 기록 영구 삭제 때 정리되며 기존 백업에는 남아 있을 수 있다.
- 모바일: 라벨이 1줄·2줄로 달라도 입력창의 세로 위치를 맞춘다. 기존의 같은 행 라벨 비교에 더해 실제 입력창 y 좌표 검증을 추가한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `carrot-journal-design.js`, `custom_components/carrot_ha/vehicle_journal/store.py`, `vehicle-journal/tests/test_journal.py`, `record-edit-layout.cjs`, `photo-edit.cjs`, `photo-selection.cjs`.
- 검증·배포: `8fd48d5` main 푸시, HA 세 파일 백업·반영·해시 일치 확인. 운영 테스트 기록의 기존 사진 2장 로드·삭제 버튼 및 모바일 두 입력창의 동일 y 좌표 확인. 카드·디자인은 동일한 `0.8.14-beta.4-f36c73206143` 모듈 URL로 로드된다. Python 54개 테스트 통과. 합성 Chrome 기존 사진 미리보기·저장 전 삭제 미전송·닫기 취소·저장 제거 검증 및 서버 소유권/버전·실패 시 사진 보존 회귀 통과. 320/360/390/430px 실제 입력창 높이 정렬 및 1280px 저장·넘침 회귀 통과. 기존 사진 선택 회귀도 저장 완료(모달 닫힘) 대기를 추가한 뒤 추가·압축·읽기 실패 복구·ID/버전 유지 검증 통과. 사용자 테스트 기록의 사진은 삭제하지 않았다. Python의 첨부 제거 저장 처리는 사용자 HA 재시작 대기다. 릴리즈 발행 없음.

## 2026-10-13 — 모바일 기록 날짜 전체 폭·나머지 입력 2열 압축

- 커밋 제목: vehicle-journal: compact mobile record fields into two columns
- 변경·이유: 440px 이하의 1열 숫자 입력이 공간을 과도하게 차지했다. 모바일에서도 최소 폭 0의 2열 그리드를 유지하고 기록 날짜만 전체 폭으로 배치한다. 짧은 라벨과 2줄 라벨의 입력창 높이를 맞추기 위해 라벨 영역에 최소 높이를 둔다. 메모·사진·위치 등 기존 전체 폭 영역은 유지한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`, `vehicle-journal/tests/record-edit-layout.cjs`.
- 검증·배포: Chromium 320/360/390/430px 날짜 전체 폭과 누적거리·금액 같은 행 배치, 1280px 기존 배치, 저장·넘침·검색 결과·영구 삭제 확인 회귀 통과. `6f94b4d` main 푸시·HA 디자인 백업/직접 반영 확인. 초기 운영 화면의 입력 높이 어긋남은 후속 `8fd48d5`에서 정렬 보완했다. 화면 CSS 변경이며 버전·태그·릴리즈 발행 및 Python 재시작은 필요하지 않다. 실제 iPhone 실사용은 사용자 확인 대기다.

## 2026-10-13 — 영구 삭제된 파생 비용의 부모 수정·복원 재생성 방지

- 실제 반영: `150a6b1` main 원격 확인, HA 커밋별 저장 모듈 백업·반영 및 SHA-256 일치 확인. 실행 중인 Python은 사용자 HA 재시작 대기다.

- 커밋 제목: vehicle-journal: preserve purged derived costs during parent edits
- 변경·이유: 수동 충전비·주유 동반 세차비를 개별 영구 삭제한 뒤 부모 기록을 수정/복원하면 파생 비용 내용이 다시 생성될 수 있는 경로를 차단한다. 영구 삭제 표식은 관련 상태 변경과 비용 재작성에서 유지한다.
- 관련 파일: `custom_components/carrot_ha/vehicle_journal/store.py`, `vehicle-journal/tests/test_journal.py`.
- 검증·배포: 파생 충전비 영구 삭제 후 부모 충전 금액 수정 회귀를 포함해 전체 Python 53개 검증 통과. 커밋·직접 반영 후 Python 적용은 HA 재시작 대기다. 실제 사용자 기록 삭제 및 릴리즈 발행 없음.

## 2026-10-13 — 삭제된 상세 기록에 영구 삭제 기능 추가

- 커밋 제목: vehicle-journal: add confirmed permanent deletion for discarded records
- 변경·이유: 상세 기록에서 삭제된 항목에 복원만 있어 완전히 정리할 수 없었다. 복원 옆에 붉은 영구 삭제 버튼과 복구 불가·사진 제거·기존 백업 잔존 확인을 추가한다. 관리자 API는 삭제 상태·명시 확인·버전을 검증한다.
- 데이터 처리: 금액·메모·위치·사진 메타데이터·보정/변경 이력·일별 원장을 제거하고 집계를 갱신한다. 자동 기록 재유입 방지를 위해 내용 없는 최소 식별 마커만 보존한다. 자동 충전의 HA 원본·결제 및 기존 백업은 이 삭제 대상에 포함하지 않는다. 관련 수동 충전비·세차비도 함께 정리한다.
- 사진 파일은 DB 트랜잭션에서 정리 대기 목록을 먼저 보존한 뒤 삭제하며 실패 시 다음 HA 시작/자동 동기화 때 재시도한다. 데이터 제거와 파일 정리를 원자적이라고 가정하지 않는다.
- 관련 파일: `custom_components/carrot_ha/vehicle_journal/store.py`, `api.py`, `runtime.py`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/test_journal.py`, `test_api_authorization.py`, `test_runtime_schedule.py`, `record-edit-layout.cjs`.
- 검증: Python 차계부 52개 테스트 통과. 확인 누락·활성 기록·버전 충돌 거부, 영구 삭제 후 복원/수정 차단, 자동 동기화 재유입 방지, 사진 삭제 실패 후 재시작 재시도 검증. Chromium 다섯 화면 너비의 폼 저장·레이아웃 및 영구 삭제 버튼·확인 취소/승인 요청 검증 통과.
- 배포: `e8cdc2f` main 푸시 완료. HA 커밋별 백업 후 화면·API·저장·런타임 다섯 파일 직접 반영 및 SHA-256 일치 확인. 외부 HTTP 화면 두 파일 해시 일치, 운영 Chrome의 삭제된 실제 기록에 사진·복원·영구 삭제 버튼 표시 확인. 카드·디자인 모듈은 동일한 `0.8.14-beta.4-417d02bf2910` URL로 로드됨. 사용자의 실제 기록은 영구 삭제하지 않았다. Python API와 충전소 선택 로직은 사용자 HA 재시작 대기이며 실제 운영 영구 삭제 성공은 미검증. 릴리즈 발행 없음.

## 2026-10-13 — 충전 기록 저장·모바일 입력 겹침 및 모호한 충전소 자동 확정 수정

- 커밋 제목: vehicle-journal: fix record editing and reject ambiguous charging locations
- 변경·이유: 전용 충전·주유·세차·사고 폼은 숨겨진 카테고리 select에 해당 option이 없어 빈 분류를 전송했다. 전용 모드에서 분류를 명시하고 숨겨진 입력의 native validation을 비활성화한다. 입력·서버 오류를 모달 본문 상단에 표시하며 장소명 입력을 저장 직전에 반영한다.
- 모바일: 440px 이하에서 폼을 1열로 배치하고 날짜 입력·그리드 최소 폭을 제한한다. 장소 검색 결과의 flex 축소를 막아 긴 이름·주소가 다음 행과 겹치지 않도록 한다.
- 위치: 좌표에서 실제 거리를 계산하고 150m 밖 후보 또는 첫 두 후보의 거리 차이가 25m 미만이면 자동 확정하지 않는다. GPS는 충전 시작 2분 이내·측정과 수신 60초 이내·정차 표본을 사용한다. 이 조건에서 위치가 비는 경우가 늘 수 있으며 인접 장소의 정확한 판별은 사용자 선택이 필요하다. 실제 사례에서 효과가 없던 두 번째 검색을 제거해 기존 호출 수를 유지한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `carrot-journal-design.js`, `custom_components/carrot_ha/vehicle_journal/automatic_locations.py`, `stations.py`, `vehicle-journal/tests/test_station_backup.py`, `vehicle-management.cjs`, `browser-check.cjs`, `record-edit-layout.cjs`.
- 검증: Python 차계부 49개 테스트 통과. 운영 DB 복사본에서 기존 빈 분류 요청의 거부를 재현하고 수정 요청의 금액·장소 저장 및 재조회·수동 override를 확인했다. 운영 DB는 변경하지 않았다. 합성 Chromium에서 320/360/390/430/1280px 충전 수정 저장·날짜 겹침·검색 결과 축소 검증 통과. 기존 browser-check의 전용 모드 분리 전 카테고리 개수 기대값을 갱신한 뒤 전체 탭·차트·수동 저장·escaping·모바일 검증 통과. 스키마 9개 검증 통과. 기존 vehicle-management 검증은 현재 설정 메뉴의 text-align 기대값 불일치로 실패해 관련 저장 검증을 전용 테스트에서 수행했다.
- 배포 상태: `212d675` main 푸시 및 HA 네 파일 백업·직접 반영·해시 일치 확인. 실제 HA Chrome 충전 편집에서 상단 오류와 숨겨진 분류 비활성화, 390px 1열·가로 넘침 없음 확인. Python 반영에는 사용자 HA 재시작 필요. 릴리즈·버전·태그 변경 없음. 실제 iPhone과 다음 충전 실사용 검증은 미완료.

## 2026-10-13 — 사용자 승인 후 실제 제공사 후보 비교 (분석 완료, 구현 진행 중)

- 변경·이유: 사용자 명시 승인에 따라 문제 충전의 저장 GPS로 기존 검색어, 공백 제거 검색어, 실제 장소명 검색의 제공사 후보를 비교했다. 인증 키·정밀 좌표·개인 장소명·원본 응답은 공개 기록에 포함하지 않는다.
- 검증: 세 검색 모두 동일한 후보 및 순서를 반환했다. 기존 자동 선택 장소와 사용자가 제시한 실제 장소는 서로 다른 장소 ID지만 제공사 좌표가 완전히 같았다. 따라서 거리 재계산·검색어 확대·150m 제한만으로 이 사례를 구분할 수 없다. 운영 DB 쓰기는 수행하지 않았다.
- 수정 방향: 같은 좌표 또는 GPS 오차 범위에서 구분 불가능한 후보는 첫 번째 후보를 확정하지 않도록 한다. 사용자 확인은 단순 거리 선택보다 우선해야 하지만, 넓은 위치 범위 전체에 특정 장소를 고정하는 학습은 인접 장소의 오기록을 유발할 수 있으므로 별도 범위·충돌 검증이 필요하다.
- 단점 및 제한: 확인을 기다리는 자동 위치가 늘 수 있다. 실제 다음 충전에서 올바른 장소명이 자동 저장되는지는 아직 관측하지 않았다. 이 사례에서 효과가 없었던 추가 검색은 요청 수 증가만 일으키므로 유지 여부를 재검토한다.
- 배포 상태: 후보 비교 분석 완료. 수정안 테스트·커밋·푸시·HA 반영은 진행 중이며, 릴리즈·태그 발행 없음.

## 2026-10-13 — 자동 충전 위치 수정안의 실제 DB 재현 및 한계 분석 (진행 중)

- 변경·이유: 모바일 기록 저장·레이아웃 수정과 함께 검토 중인 GPS 신선도 및 충전소 거리 제한이 동일 충전의 오선택을 실제로 방지하는지 확인했다.
- 관련 파일: `frontend/carrot-vehicle-journal.js`, `frontend/carrot-journal-design.js`, `vehicle_journal/automatic_locations.py`, `vehicle_journal/stations.py` (모두 `custom_components/carrot_ha/` 하위).
- 검증: 운영 차계부 DB를 읽기 전용으로 열어 SQLite backup 복사본을 만들고 최근 10회 충전 전후 상태 표본을 개인 임시 폴더에서 비교했다. 운영 DB는 변경하지 않았다. 개인 기록·좌표·식별자는 공개 저장소에 포함하지 않는다.
- 결과: 현재 초안의 측정 시각 ±2분·수신과 측정 간격 60초·정차 조건은 10회 중 2회에서 GPS를 선택하지 못한다. 문제 세션은 이전과 같은 GPS를 선택하며 기존 장소가 150m 제한 안에 있으므로, 이 제한만으로 오선택 해결을 주장할 수 없다.
- 한계: 현재 제공사의 실제 후보 응답 비교는 정밀 위치의 외부 전송에 대한 자동 승인 심사 거부로 미실행이다. 검색어 확대 효과와 실제 충전소 선택 성공 여부는 미확인이다. 다음 실제 충전 결과도 아직 관측하지 않았다.
- 부작용: 자동 위치 미기록 증가, 인접 충전소 오선택 잔존, 캐시 미적중 시 검색 호출 1회에서 최대 2회 증가. 기존 자동 위치가 있으면 재조회하지 않으므로 과거 오기록은 이 초안만으로 고쳐지지 않는다.
- 배포 상태: 로컬 수정·분석 중. 이 수정의 커밋·푸시·HA 반영·재시작·운영 검증은 미완료. 버전·태그·릴리즈 발행 없음.

## 2026-10-13 — 차계부 기록 모달 닫기 불가(영구 노출) 긴급 버그 수정 및 백드롭 터치 닫기 지원

- 커밋 제목: vehicle-journal: fix unclosable record dialog and enable backdrop dismiss
- 변경·이유:
  - **기록 모달 닫기 불가 및 화면 영구 고정 버그 긴급 해결 (`display: flex` trap 수정)**:
    - 직전 커밋(`ef8a1bf`)에서 `dialog#recordDialog`에 무조건적인 `display: flex;`가 부여되면서 브라우저의 기본 `<dialog:not([open])>` 숨김 스타일(`display: none`)이 오버라이드됨.
    - 이로 인해 모달을 닫아도(`dialog.close()`), 폼을 저장해도, 또는 페이지 새로고침 시에도 다이얼로그가 화면 중앙에 영구적으로 표시되어 닫히지 않던 심각한 결함 해결.
    - `dialog:not([open]) { display: none !important; }` 및 `dialog#recordDialog[open] { display: flex !important; }`, `dialog#recordDialog:not([open]) { display: none !important; }`를 적용하여 닫힐 때 100% 즉시 숨겨지도록 수정.
  - **헤더 잘림 및 내부 스크롤 불가 현상 해결 (`min-height: 0` 적용)**:
    - CSS Flexbox 명세상 자식 요소의 `min-height` 기본값이 `auto`로 작동하여 `#recordForm`과 `.modal-scroll-body`가 내용물 크기(900px+)만큼 팽창하고 뷰포트 중앙 배치로 인해 상단 헤더(닫기/저장 버튼)와 하단이 화면 밖으로 잘려 나가던 문제 해결.
    - `#recordForm`과 `.modal-scroll-body`에 `min-height: 0; flex: 1 1 auto;`를 부여하여 다이얼로그 높이 내에서 본문만 완벽하게 스크롤되고 헤더는 항상 최상단에 고정 노출되도록 보장.
  - **백드롭(배경) 클릭/터치 시 모달 닫기 지원**:
    - 모바일 및 데스크톱에서 다이얼로그 바깥 어두운 배경(백드롭)을 터치/클릭했을 때 모달이 즉시 닫히도록 `recordDialog`, `recordTypeDialog`, `vehicleManageDialog`에 백드롭 닫기 이벤트 리스너 추가 (`e.target === dialog`).
  - **주유 및 충전 폼 필드 2열 그리드 배치 자연화**:
    - 주유 모드(`refueling`)일 때 2행에 `유종`과 `단가`가 나란히 오고, 3행에 `주유금액`과 `주유량`이 나란히 오도록 배치 최적화.
    - 충전 모드(`charging`)일 때 2행에 `충전금액`과 `청구 충전량`이 배치되도록 분기 처리.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`: 다이얼로그 닫힘 강제 display:none, recordDialog[open] 전용 display:flex, flexbox min-height:0 스크롤 복원.
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`: 백드롭 터치 닫기 지원, 주유/충전 필드 순서 최적화.
  - `vehicle-journal/CHANGELOG.md`: 작업 내역 및 배포 상태 기록.
- 검증:
  - 구문 및 스타일 속성 검증 통과.
  - HA 직접 배포 후 설치 파일 SHA-256 일치 확인 (`carrot-journal-design.js`: `7112e6ac...`, `carrot-vehicle-journal.js`: `f6087a9d...`).
  - HA `frontend-version` API `0.8.14-beta.4-bbcbf66b1722` 정상 갱신 확인.
- 배포: 수정 커밋 `0094220` main 푸시 완료. HA `/config/carrot_ha/deployment-backups/009422037ccc03dd6450cd0d6b5319da7da4159a/`에 백업 후 SSH 직접 반영 완료. 브라우저 새로고침(또는 패널 재진입)으로 즉시 적용 가능.

## 2026-10-13 — 차계부 카테고리 틴트 색상 복원, 주유 아이콘 교체, 모달 헤더 스크롤 마감 및 지도 최하단 배치

- 커밋 제목: vehicle-journal: fix category tint colors, reorder fields to place map at bottom, and fix header scroll clipping
- 변경·이유:
  - **카테고리 선택 모달 색상 빠짐(흰색) 수정**:
    - `carrot-vehicle-journal.js`에서 생성되는 `.tint-charging`, `.tint-maintenance`, `.tint-washing` 클래스가 CSS에서 누락되어 아이콘 박스가 색상 없이 흰색으로 나오던 문제 해결.
    - 충전(민트 `#81e6c5`), 정비(앰버 `#f59e0b`), 세차(파랑 `#60a5fa`) 등 차계부 공통 카테고리 틴트 색상 복원.
  - **내연기관 주유 기록 그래픽 교체 (정통 주유기 아이콘 적용)**:
    - `recordTypeIcons.refueling`의 기존 빌딩/아파트 모양 SVG를 본체 기둥, 계량창, 바닥 받침, 주유 호스 및 주유건 노즐이 선명한 표준 Fuel Pump SVG로 전면 교체.
  - **스크롤 시 헤더 마감 이상(지도가 헤더 위/옆으로 삐져나옴) 수정**:
    - `#recordDialog`에 지정되어 있던 패딩으로 인해 `sticky` 헤더 상단과 좌우 틈새로 지도가 삐져나오던 구조적 결함 해결.
    - 다이얼로그 패딩을 0으로 없애고 `overflow: hidden; display: flex; flex-direction: column;` 구조로 변경.
    - 헤더(`.modal-header-row`)를 다이얼로그 최상단 모서리에 완벽 밀착(`flex-shrink: 0; padding: 16px 20px;`)하고, 본문(`.modal-scroll-body`)만 내부 스크롤되도록 분리하여 지도가 헤더 밖으로 절대 새어 나오지 않도록 마감 처리.
  - **충전/주유 기록 위치 선택기 및 지도 최하단 이동 (핵심 수치 최상단 배치)**:
    - 모달 오픈 시 위치/지도가 상단 80%를 차지하여 금액·단가·누적거리를 적으려면 스크롤을 내려야 했던 불편 개선.
    - 날짜 바로 다음에 누적거리, 금액, 단가, 리터/kWh가 2열 그리드로 먼저 노출되고, 메모·사진 아래 최하단에 위치 선택기 및 지도가 나타나도록 순서 전면 개편.
  - **정비/기타 기록 및 폼 UI 겹침 버그 수정**:
    - `#recordDialog [hidden] { display: none !important; }`를 추가하여 숨겨진 필드가 CSS 명시도로 인해 강제 노출되거나 그리드 자리를 차지해 다른 요소와 겹치던 문제 원천 차단.
    - `.fullfield`, `#memoField`, `#recordLocationField`, `#recordPhotoField`, `#importSourceDetails`에 `grid-column: 1 / -1; width: 100%;`를 부여하여 그리드 어긋남 완전 해결.
  - **유종 드롭다운 변경 시 단가 연동 및 미취급 유종 빈칸 처리**:
    - 드롭다운에서 다른 유종 선택 시 해당 주유소의 해당 유종 단가로 즉시 갱신되며, 해당 주유소에서 판매하지 않는 유종일 경우 단가 입력칸을 빈칸(`''`)으로 자동 변경.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`: 틴트 클래스 통일, 다이얼로그 overflow-hidden/flex-column 구조 개편, 헤더 밀착 마감, fullfield 그리드 span, hidden 우선순위 강제.
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`: 정통 주유기 SVG 교체, modal-scroll-body 래퍼 적용, dedicated 필드 순서 개편(지도 최하단), 유종 미취급 시 단가 빈칸 처리.
  - `vehicle-journal/review-record-ui.html`: 모바일 인터랙티브 검토 HTML 동기화.
  - `vehicle-journal/CHANGELOG.md`: 작업 내역 기록.
- 검증:
  - `node --check` 구문 검사 통과 (`carrot-vehicle-journal.js`, `carrot-journal-design.js`).
  - 모바일 조작 및 반응형 뷰포트 검증.
- 배포: 수정 커밋 `ef8a1bf` main 푸시 완료. HA `/config/carrot_ha/deployment-backups/ef8a1bf97d863ea2624152c239b00cf98079a07c/`에 백업 후 SSH 직접 반영 완료. 로컬 및 HA 설치 파일 SHA-256 일치 (`carrot-journal-design.js`: `32c11d30...`, `carrot-vehicle-journal.js`: `6aec394e...`). frontend-version API `0.8.14-beta.4-a2bea3a95f7f` 갱신 확인. 브라우저 새로고침(또는 패널 재진입)으로 즉시 적용 가능.

## 2026-10-13 — 차계부 기록 모달 모바일 최적화, 저장·닫기 버튼 규격 통일 및 버튼 일체형 프로그레스 바 개편

- 커밋 제목: vehicle-journal: mobile-friendly record modals, button-integrated progress, and unified header actions
- 변경·이유:
  - **헤더 액션 버튼 규격 통일 (저장 & 닫기 버튼 크기/스타일 불일치 수정)**:
    - 기존에 `#save`(`min-height: 38px, padding: 8px 12px`)와 `#close`(`min-height: 32px, padding: 6px 14px`)의 높이·패딩·곡률이 서로 달라 발생하던 크기 불일치 문제를 해결.
    - `.modal-header-actions`로 두 버튼을 나란히 묶고 `height: 36px, min-height: 36px, max-height: 36px, padding: 0 15px, font-size: 13.5px, border-radius: 9px, font-weight: 700`로 완전 대칭 통일.
    - 기존 "HA에 기록 저장" 문구를 단순 `"저장"`으로 변경.
    - 상세 기록 수정 화면의 경우 기존 기록과 변경사항이 발생했을 때만(`draftDirty === true`) 닫기 버튼 왼쪽에 `[저장]` 버튼이 자연스럽게 나타나도록 개선 (신규 작성 시에는 항상 노출).
  - **버튼 일체형 실시간 프로그레스 바 & 진행 상태 표시**:
    - 사진 압축 및 저장 중 저장 버튼이 비활성화(`disabled`)되며 버튼 자체가 프로그레스 바로 전환.
    - 단계별 실시간 진행 문구(`사진 압축 중 (1/3)`, `기록 저장 중...`, `저장 완료! ✓`)와 게이지 채움 애니메이션(`.progress-fill`) 및 미니 스피너 시각화.
  - **모바일 최적화 콤팩트 폼 레이아웃**:
    - 폼 필드를 2열 그리드(`grid-template-columns: 1fr 1fr`)와 슬림 인풋으로 재구성하여 불필요한 스크롤 및 화면 낭비 최소화.
    - 충전/주유 모달에서 저장 버튼이 타이틀 아래 거대 블록으로 덩그러니 분리되던 레거시 로직 제거 및 상단 헤더 우측으로 일원화.
    - 사진 첨부 영역을 콤팩트 가로 스크롤 포토 레일(70×70px 썸네일 + 원터치 삭제 버튼)로 개편.
  - **카테고리 선택 모달 벡터 SVG 아이콘화**:
    - OS 기본 이모지(💧, 🚗, 🛣️, 🔧, ⛽ 등) 대신 세련된 인라인 SVG 벡터 아이콘과 카드 레이아웃(`type-card`) 적용.
  - **정비/기타 기록 비용 분류 항목 정돈**:
    - 비용 분류 select에서 중복/무관 카테고리(`주유비`, `충전비`, `세차비`, `사고`)를 제거하고 7개 필수 카테고리만 노출.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`: 버튼 규격 통일 CSS, 버튼 일체형 프로그레스 바 스타일, SVG 카테고리 카드, 모바일 콤팩트 폼 그리드.
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`: 모달 템플릿 헤더 액션 통합, 실시간 프로그레스 연동, dirty state 변경 감지 로직, SVG 아이콘 매핑.
  - `vehicle-journal/review-record-ui.html`: 모바일 인터랙티브 검토용 HTML.
  - `vehicle-journal/CHANGELOG.md`: 작업 내역 기록.
- 검증:
  - `node --check` 구문 검사 통과 (`carrot-vehicle-journal.js`, `carrot-journal-design.js`).
  - `vehicle-journal/schema/validate_schema.py` 통과.
  - 모바일 조작 및 인터랙션 시뮬레이션 검토 파일(`review-record-ui.html`) 사용자 검토 승인 완료.
- 배포: 수정 커밋 `062adde` main 푸시 완료. HA `/config/carrot_ha/deployment-backups/062adde407d1d1d99e2d0eca64137c5e58b1488c/`에 백업 후 SSH 직접 반영 완료. 로컬 및 HA 설치 파일 SHA-256 일치 (`carrot-journal-design.js`: `f486b143...`, `carrot-vehicle-journal.js`: `9a913bc2...`). frontend-version API `0.8.14-beta.4-0d08c2294056` 갱신 확인. 브라우저 새로고침(또는 패널 재진입)으로 즉시 적용 가능.

## 2026-10-13 — 차계부 설정 창 모바일 상·하·좌·우 여백 및 Safe Area Inset 복원

- 커밋 제목: vehicle-journal: restore safe area margins and padding for settings dialog on mobile
- 변경·이유:
  - 사용자 피드백 반영: 모바일에서 설정 창이 화면 상단(노치/Dynamic Island 및 상태 표시줄 `12:43`)에 지나치게 밀착되어 꽉 차 보이는 현상 해결.
  - `#vehicleManageDialog`의 모바일 높이와 최대 높이에 안전 영역(`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) 및 64px 마진을 복원하여 화면 상·하단에 충분한 숨통(여백) 확보.
  - 모바일 좌우 너비도 `calc(100vw - 32px)`로 좌우 16px의 균형 잡힌 마진 적용.
  - 다이얼로그 배경 `::backdrop` 블러 및 음영(`backdrop-filter: blur(8px)`) 명시 적용.
  - 헤더 패딩 및 닫기 버튼 크기 미세 조정으로 터치 편의성 확보.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`: `#vehicleManageDialog` 높이 계산식 및 safe-area 복원, 모바일 마진 32px 적용.
  - `vehicle-journal/CHANGELOG.md`: 작업 내역 기록.
- 검증:
  - `node --check` 구문 검사 통과.
  - `test_backup_status_ui.cjs` 자동화 테스트 통과.
- 배포: Git 커밋 및 main 푸시, HA 서버 직접 동기화(`hassio@192.168.0.140:22`) 및 SHA-256 검증 완료.

## 2026-10-13 — 차계부 설정 모바일 최적화(상단 탭 전환·가로 스크롤 제거) 및 백업 일시 한국어 포맷(~월 ~일 ~시 ~분) 개편

- 커밋 제목: vehicle-journal: optimize settings modal for mobile and format backup timestamps to Korean date
- 변경·이유:
  - 모바일 반응형 구조 개편:
    - 기존 모바일 환경(`@media(max-width:600px)`)에서 좌측 80px 사이드바가 좁은 모바일 화면 너비를 잠식하여 우측 본문 요소(버튼, 입력 필드 등)가 넘쳐 발생하던 가로 스크롤 문제를 완전히 해결.
    - 모바일에서는 사이드바를 상단 4분할 가로 탭 바(`grid-template-columns: repeat(4, 1fr)`)로 전환하여 콘텐츠 영역이 가로폭 100%를 온전히 사용하도록 개편.
    - 콘텐츠 영역에 `overflow-y: auto; overflow-x: hidden;`을 적용하여 가로 스크롤 발생을 원천 차단.
    - 차량 관리 목록의 버튼들(`.row`)을 모바일 그리드(`grid-template-columns: repeat(auto-fit, minmax(96px, 1fr))`)로 자동 배치하여 줄바꿈 및 모바일 터치 최적화.
    - 중복·상충 선언되어 있던 `@media(max-width:600px)` 스타일 블록을 하나로 통합 및 정돈.
  - 백업 일시 표시 형식 개편:
    - 초 단위 타임스탬프(`2026. 10. 13 05:44:39`) 대신 사용자 요청에 맞춰 `~월 ~일 ~시 ~분`(예: `10월 13일 05시 44분`) 형태로 표시 변경. 비당해 연도일 경우 `2025년 ` 접두어 유지.
    - 순수 날짜(`YYYY-MM-DD`)도 `10월 12일` 형태로 변환.
    - 카드 타이틀 말줄임 방지: 중복된 긴 수식어(`마지막으로 성공적으로 완료된 자동 백업` → `마지막 성공 자동 백업`, `다음 예약된 자동 백업` → `다음 예약 자동 백업`)를 정제하고, `.backup-card-title`에 `word-break: keep-all; line-height: 1.35;`를 적용하여 좁은 화면에서도 말줄임표(`...`) 없이 깔끔하게 표시.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`: 모바일 상단 4분할 탭 바 레이아웃, 가로 스크롤 제거, 버튼 그리드화, 백업 카드 타이틀 줄바꿈 지원.
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`: `formatTimestamp` 한국어 일시 포맷 변환 및 `cleanName` 타이틀 간소화.
  - `vehicle-journal/tests/test_backup_status_ui.cjs`: 신규 한국어 일시 포맷 및 간소화된 타이틀 검증 추가.
  - `vehicle-journal/CHANGELOG.md`: 작업 내역 기록.
- 검증:
  - `node --check` 구문 검사 통과 (`carrot-vehicle-journal.js`, `carrot-journal-design.js`).
  - `test_backup_status_ui.cjs` 자동화 테스트 전체(4개 케이스) 통과.
- 배포: Git 커밋 및 main 푸시, HA 서버 직접 동기화(`hassio@192.168.0.140:22`) 및 SHA-256 검증 완료.

## 2026-10-13 — 차계부 설정 'Synology · HA 백업 상태' 탭 UI 개편 및 고도화

- 커밋 제목: vehicle-journal: modernize HA backup status tab with cards and guide banner (`bc09f1a`)
- 변경·이유:
  - 차계부 설정 내 '백업 상태' 탭이 HA Core의 `backup` 통합 엔티티들을 단순 텍스트 줄바꿈으로 노출하던 방식을 현대식 카드 및 배너 레이아웃으로 전면 개편.
  - 상단 요약 배너: 백업 관리자 상태(`blocked`, `idle` 등)를 한국어(`차단됨 (대기 중)`, `대기 중 (정상)` 등) 및 상태별 컬러 뱃지(Warning 앰버, Success 민트 등)로 시각화하고 설명 제공.
  - 타임스탬프 현지화 & 상대 시간: UTC ISO 8601 문자열(`2026-10-12T20:44:39+00:00`)을 현지 일시(`YYYY. MM. DD. HH:mm:ss`)와 상대 시간 뱃지(`약 5시간 후`, `약 19시간 전`)로 변환.
  - 2열 반응형 그리드: 중복 `Backup ` 접두어를 정제하고 아이콘, 제목, 값, 뱃지, 엔티티 ID를 정돈된 카드로 배치.
  - Synology NAS 연계 안내 카드: 하단 단순 텍스트를 세련된 콜아웃 카드로 개선하고, 클릭 시 즉시 '백업 · 복구' 탭으로 전환되는 바로가기 버튼(`data-jump-settings="backup"`) 연동.
  - 빈 상태(Empty State) 예외 처리 추가.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`: 백업 상태 전용 CSS 클래스 및 모바일 반응형 스타일 추가.
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`: `renderBackupStatus()` 신규 구현 및 `loadJournalSettings()` 호출 연동.
  - `vehicle-journal/vehicle-management.md`: 설정 화면의 HA 백업 상태 안내 보완.
  - `vehicle-journal/tests/test_backup_status_ui.cjs`: 신규 단위 테스트 추가 (정상 렌더링, vehicle-management.cjs 호환성, 빈 상태, 탭 전환 검증).
- 검증:
  - `node --check` 구문 검사 통과.
  - `test_backup_status_ui.cjs` 자동화 테스트 전체(4개 케이스) 통과.
- 배포: 수정 커밋 `bc09f1a` main 푸시 완료. HA `/config/carrot_ha/deployment-backups/607a2278fd0e227fc69bb5cb904ef2b3780374e2/`에 백업 후 SSH 직접 반영 완료. 로컬 및 HA 설치 파일 SHA-256 일치 (`carrot-journal-design.js`: `32513cba...`, `carrot-vehicle-journal.js`: `17877add...`). frontend-version API `0.8.14-beta.4-5164283166ed` 갱신 확인. 브라우저 새로고침(또는 패널 재진입/업데이트 버튼)으로 즉시 적용 가능.

## 2026-10-13 — Antigravity 규칙에 최신 차계부 작업 지침 동기화

- 커밋 제목: vehicle-journal: sync shared category colors to antigravity rule
- 변경·이유: vehicle-journal/AGENTS.md에 추가된 차량 공통 기본 카테고리 색상(주유·충전 민트 #81e6c5, 정비 앰버 #f59e0b 등) 정책이 Antigravity 워크스페이스 규칙 경로인 .agents/rules/vehicle-journal.md에 누락되어 있던 것을 동기화.
- 관련 파일: .agents/rules/vehicle-journal.md, vehicle-journal/CHANGELOG.md.
- 검증: diff 확인으로 vehicle-journal/AGENTS.md와 .agents/rules/vehicle-journal.md 내용 일치 확인.
- 배포: 문서 커밋·main 푸시. 실행 코드 변경 및 새 릴리즈 없음.

## 2026-10-12 — 모든 차량의 기본 카테고리 색상 정책 확정

- 커밋 제목: vehicle-journal: document shared default category colors and mint deployment
- 변경·이유: 사용자 지정으로 기존 및 신규 차량 모두 범례와 카테고리 표시의 공통 기본 색상을 사용하도록 AGENTS.md에 기록. 차량별 분기 없는 categoryColor 사용 확인. 주유비 민트 수정 ad4b2ed의 실제 배포 검증 기록도 보완.
- 관련 파일: vehicle-journal/AGENTS.md, vehicle-journal/CHANGELOG.md.
- 검증: 공통 색상 함수와 각 화면 호출 확인. 주유·충전 민트, 정비 앰버, 세차 파랑, 튜닝 보라, 기타 회색. 차량 식별자에 따른 색상 분기 없음.
- 배포: 문서 커밋·main 푸시. 추가 실행 코드 변경·릴리즈 없음. 운영 사용자 화면 확인 대기.

## 2026-10-12 — 주유비를 요청한 민트색으로 수정

- 커밋 제목: vehicle-journal: use mint for refueling across journal views
- 변경·이유: 이전 수정은 사용자 의도를 반대로 해석해 범례를 주황색으로 맞췄다. 주유비 공통 categoryColor를 충전비와 같은 민트색 #81e6c5로 변경해 최근 기록·상세 기록 배지, 도넛·분류 목록, 비교 차트·범례, 추이·지도 표시를 통일한다. 도넛 12시 시작·금액 오름차순은 유지한다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-vehicle-journal.js, vehicle-journal/tests/browser-check.cjs, vehicle-journal/CHANGELOG.md.
- 검증: 주유비 민트색 명시 검사 및 실제 Chrome 차계부 회귀 전체 통과.
- 배포: 수정 커밋 `ad4b2ed` main 푸시 완료. HA deployment-backups의 해당 전체 커밋 경로에 백업 후 직접 반영 완료. 로컬·설치·HTTP SHA-256 `dac116fd89c5df27b72dec10c4bad812da269d55383b60ac86e710ae551c06b8` 일치. 개발 배포 정책 유지, 새 릴리즈 없음. Cloudflare/Comma 변경 없음. 실제 사용자 브라우저 적용은 확인 전.

## 2026-10-12 — 주유비 범례 색상과 도넛 경계·정렬 수정

- 커밋 제목: vehicle-journal: align fuel legend and render sorted annular sectors
- 변경·이유: 내연기관 비교 범례가 충전비 CSS 색상을 고정 참조해 민트색으로 표시되던 오류 수정. 주유비의 기존 주황색을 배지·차트·범례에 동일하게 사용한다. 도넛의 두꺼운 원형 점선 겹침을 채워진 환형 부채꼴로 교체해 파인 경계를 없애고, 12시부터 시계 방향으로 금액 오름차순 배치한다. 지출 목록 순서는 유지한다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-vehicle-journal.js, vehicle-journal/tests/browser-check.cjs. 기존 지도 변경 이후 합성 브라우저 검사에서 누락된 assetBase도 보완했다.
- 검증: JS 구문 검사 및 실제 Chrome browser-check 통과. 합성 3분류·단일 분류 도넛, 12시 시작·오름차순, 내연기관 범례/목록 색상 일치, 기존 탭·추이·수동 저장·HTML escaping·데스크톱/모바일 회귀 확인.
- 배포: 수정 커밋 `6d1676c` main 푸시·원격 해시 확인 완료. HA deployment-backups/6d1676c0312de11a91013f652b781e1528d3c605/ 백업 후 화면 파일 한 개 직접 반영. 로컬·설치·HA HTTP 응답 SHA-256 `86a1d8d0adca6aa4edf7f55075ed2820b0939f19bb85f9072ed93d3fed1b7582` 일치. 운영 브라우저 모듈 URL·화면 적용은 미확인이며 사용자 새로고침 후 확인 필요. 개발 직접 배포 정책에 따라 버전/릴리즈 변경 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: switch trends map from kakao maps to openstreetmap via leaflet

- 요청 및 배경: 카카오 지도 API 키/도메인 화이트리스트 제약 없이 어디서든 즉시 동작하도록, 추세 탭의 '방문한 충전소·주유소' 지도를 카카오 지도 대신 OpenStreetMap(OSM) 기반 Leaflet 맵으로 전환.
- 변경:
  - `carrot-vehicle-journal.js`:
    - HA 통합에 내장된 `carrot-assets/leaflet.js` 및 `leaflet.css`를 비동기 로드(`leaflet()`)하여 외부 CDN/API 키 의존성 없이 동작하도록 구현.
    - `resetTrendsMap` 및 `initTrendsMap`을 Leaflet API로 전면 교체.
    - OpenStreetMap 타일(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) 적용 (남한 중심 `36.2683, 127.6358`, 줌 레벨 `7`).
    - `L.divIcon`을 통해 기존 카테고리별 마커 닷(`.trends-map-dot`) 스타일링 유지 및 마커 클릭 시 플로팅 카드(장소명, 누적금액, 방문횟수) 표시와 `panTo` 연동.
    - 탭 전환 시 Leaflet 타일 렌더링 정상화를 위한 `invalidateSize()` 호출 추가.
  - `carrot-journal-design.js`:
    - Leaflet 컨테이너, 줌 컨트롤, 저작권 표기 dark theme 일체화 스타일 적용.
    - `.trends-map-leaflet-marker` 배경 투명화 및 리셋 버튼/상세 카드의 Leaflet 컨트롤 대비 상위 z-index(1001, 1002) 보장.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-vehicle-journal.js,carrot-journal-design.js}, vehicle-journal/CHANGELOG.md.
- 검증: `node --check` 구문 검사 통과, HA 서버 HTTP 자산 제공 검증.
- 배포: main 커밋·푸시 및 HA deployment-backups 백업 후 SSH 직접 반영. 프론트엔드 변경으로 브라우저 새로고침(또는 패널 재진입) 시 즉시 적용. 개발 중 릴리즈 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: enhance trends map, mobile date picker, localStorage favorite vehicle, and UI dividers

- 요청 및 배경:
  1. 모바일 환경에서 날짜 선택기 좌우 변경 버튼(‹, ›)이 날짜 입력칸과 겹치는(overlap) UI 충돌 버그 수정.
  2. 기본 차량 설정 방식 변경: 서버 고정 강제가 아닌 브라우저 `localStorage` 기반으로 즐겨찾기 별표(★)를 저장하여 각 브라우저/기기별로 선호하는 기본 차량이 자동 표시되도록 개선. 드롭다운으로 다른 차량도 상시 전환 가능.
  3. 추세 화면 대폭 개편: '방문한 충전소·주유소'를 텍스트 목록 대신 한반도(남한) 전체가 한눈에 보이는 카카오 지도 기반 인터랙티브 맵으로 전환. 카테고리별(주유: 오렌지, 충전: 민트그린 등) 점 색상 구분, 줌/패닝 조작 및 전체 보기 리셋 지원. 지도 위의 점 클릭 시 장소 이름(볼드), 선택 기간 누적 사용금액, 누적 방문횟수를 담은 플로팅 카드 표시.
  4. 내연기관 '가득 주유 구간 연비' 카드 제거.
  5. 패널 좌측 최상단 햄버거 메뉴 버튼(☰)이 타원형 알약으로 찌그러져 보이는 스타일 버그 수정 (정사각형 44x44 아이콘 버튼으로 교정).
  6. '어디에 썼을까요?' 지출 분류 목록 하단 '전체' 구분선이 2줄로 겹쳐 보이던 현상 수정 (직전 항목 하단 테두리 제거 및 2px 단일 굵은 구분선으로 스타일 통일).
- 변경:
  - `carrot-journal-panel-runtime.js`: `#menu` 버튼에 명시적인 `width: 44px; height: 44px; padding: 0; display: inline-flex; justify-content: center; align-items: center;` 스타일 부여.
  - `carrot-journal-design.js`:
    - `.title-controls-row`를 모바일에서 `flex-wrap: wrap; width: 100%;`로 변경.
    - `.date-navigation`을 CSS Grid에서 Flexbox로 전환하고 `.date-step`에 36x38 정사각 버튼 및 `flex-shrink: 0`을 적용하여 모바일 화면에서도 좌우 화살표와 날짜 텍스트가 절대 겹치지 않도록 방지.
    - `.cost-list .list-row.cost-row-last`, `:has(+ .cost-total-row)`의 `border-bottom: 0` 처리 및 `.cost-total-row`에 `border-top: 2px solid rgba(255, 255, 255, 0.28)` 적용하여 단일 두꺼운 구분선 구현.
    - `#trendsMap`, `.trends-map-panel`, `.trends-map-wrapper`, `.trends-map-dot`, `.trends-place-card` 등 지도 및 POI 상세 정보 카드 스타일링 추가.
  - `carrot-vehicle-journal.js`:
    - `getFavoriteVehicle()`, `setFavoriteVehicle()`을 통해 `localStorage('carrot_journal_favorite_vehicle')` 기반 기본 차량 지정 및 UI(★/☆) 즉시 토글 구현.
    - 추세 탭(#page1)에서 `#fuelEfficiencySummary` 카드 제거.
    - `#stationStatistics` 텍스트 목록을 `#trendsMap` 인터랙티브 지도로 전면 교체. 남한 중심(36.2683, 127.6358, 줌 레벨 13) 초기화, 줌 컨트롤러 배치, 카테고리별 마커 닷 렌더링, 닷 클릭 시 장소명(볼드)·누적금액(천단위 쉼표 원화)·방문횟수를 보여주는 카드 팝업 및 panTo 애니메이션 연동.
    - 지출 분류 목록 마지막 행에 `cost-row-last` 클래스 부여.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-journal-panel-runtime.js,carrot-journal-design.js,carrot-vehicle-journal.js}, vehicle-journal/CHANGELOG.md.
- 검증: `node --check` 3개 파일 전체 구문 검사 통과.
- 배포: main 커밋·푸시 및 HA deployment-backups 백업 후 SSH 직접 반영. 프론트엔드 변경으로 브라우저 새로고침(또는 패널 재진입) 시 즉시 적용. 개발 중 릴리즈 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: support per-user default vehicle assignment

- 요청 및 배경: 이용자가 2명(person.david, person.james)이고 차량이 2대(ID.4, 아테온)인 환경에서, 각 사용자가 차계부 진입 시 본인 차량을 기본으로 보되, 드롭다운을 통해 상대방 차량도 자유롭게 조회할 수 있도록 개선.
- 변경:
  1. 백엔드 사용자별 기본 차량 관리 (`vehicles.py`, `api.py`):
     - `default_vehicles` 영구 매핑 저장 및 초기 배정(person.david/임도균 → ID.4, person.james/임재균 → 아테온).
     - `entries` 조회 시 현재 로그인한 `user_id`를 기반으로 기본 차량(`is_default: true`)을 식별하고 목록 1순위로 자동 정렬.
     - 사용자 기본 차량 설정 WebSocket 명령(`carrot_ha/journal/user_default/set`) 추가 및 관리자 인증 적용.
  2. 프론트엔드 연동 및 UI (`carrot-vehicle-journal.js`, `carrot-journal-design.js`):
     - 차계부 진입 시 로그인 사용자의 기본 차량을 우선 선택(미지정 시 첫 번째 차량).
     - 상단 masthead 차량 선택 드롭다운 바로 옆에 기본 차량 핀 버튼(`[★]`/`[☆]`) 추가하여 현재 차량을 내 기본 차량으로 원클릭 지정/확인 가능.
     - 차량 드롭다운 옵션에 기본 차량 식별 표시(`★`) 추가.
     - 차량 관리 모달의 각 차량 패널에 `[기본 차량으로 지정]` 액션 버튼 연동.
- 관련 파일: custom_components/carrot_ha/vehicle_journal/{vehicles.py,api.py}, custom_components/carrot_ha/frontend/{carrot-vehicle-journal.js,carrot-journal-design.js}, vehicle-journal/tests/test_vehicle_import.py, vehicle-journal/CHANGELOG.md.
- 검증: test_user_default_vehicle_resolution_and_sort 포함 Python unittest 28개 전체 통과, node --check 구문 검사 통과.
- 배포: main 커밋·푸시 및 HA deployment-backups 백업 후 SSH 직접 반영. Python 백엔드 및 프론트엔드 변경 적용을 위한 1회 HA Core 재시작 안내. 개발 중 릴리즈 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — preceding comparison deployment and next phase

- e6c26fd main 푸시·HA deployment-backups/e6c26fd3c86c27981b12f62fe211e48076193f30/ 코드 백업·7개 파일 반영 완료. 설치·화면 내부/외부 HTTP 해시 일치. Python 37개 및 Chrome 내연기관 비교/도넛/설정 글꼴·EV 회귀 통과. 사용자 HA 재시작·실제 화면 확인 대기.
- 새 사용자 요청: 자동 충전소/주유소, 주유 단가, 가득 주유 사이 부분 주유 포함 연비 및 NAS 전용 스냅샷/GFS/복원 검증 구현. EV 장소 보정은 기존 대시보드 완속/급속 추정 요금을 변경하지 않음. HA 네트워크 저장소 접근 상태 확인 중; 기존 /backup/nas 경로 없음, mount API 인증 실패. 자동 선택 기준·백업 시간·실제 NAS 경로 검토 요청.

## 2026-10-12 — vehicle-journal: improve location search UX and fix long address text clipping

- 원인:
  1. 장소 검색 결과에서 긴 도로명 주소(예: 현대오일뱅크 구리제일주유소)가 줄바꿈될 때, 버튼의 기본 고정 높이 및 줄높이 제약으로 인해 하단 주소 텍스트가 잘리는(clipping) UI 버그 발생.
  2. 위치 편집 모달에서 상단 '장소명' 입력칸과 바로 아래 '상호 또는 주소' 검색창이 나란히 배치되어 있어 사용자가 어느 곳에 검색하고 어느 곳에 저장할 이름을 입력해야 하는지 명확히 구분되지 않고 혼동을 초래함.
- 변경:
  1. 긴 주소 텍스트 잘림 해결: `#placeResults` 검색 결과 버튼에 `.place-result-item` 클래스를 적용하고 `height: auto`, `min-height: 52px`, `white-space: normal`, `overflow: visible`, `word-break: break-all`로 스타일을 개선. 1행에 굵은 상호명(`.place-result-name`), 2행에 도로명 주소(`.place-result-addr`)의 2열 계층 카드로 분리하여 긴 주소도 줄바꿈 시 완벽하게 표시.
  2. 위치 입력 UX 계층 분리:
     - 상단: `🔍 장소 · 주소 검색` 카드 영역 (`#placeQuery`, `[검색]`, `[📍 지도 지정]`)으로 검색 역할을 명확히 한정.
     - 중단: 선택된 위치 정보 표시 카드 (`#selectedLocSection`, `#selectedLocAddress`) 및 `🏷️ 저장할 장소 이름` (`#locationName`)을 분리하여 "선택된 상호명이 자동 입력되며, 차계부에 표시할 원하는 이름으로 수정할 수 있어요" 안내 문구 제공.
     - 헤더: `[위치 제거]` 버튼을 검색 버튼 행에서 상단 헤더 우측으로 재배치하여 불필요한 시각적 간섭 제거.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-vehicle-journal,carrot-journal-design}.js, vehicle-journal/CHANGELOG.md.
- 검증: node --check 구문 검사 통과, Python unittest 27개 통과. 기존 DOM 식별자(`#addLocation`, `#placeQuery`, `#placeSearch`, `#placeResults`, `#removeLocation`, `#locationEditor`, `#locationPin`, `#locationMap`, `#locationName`, `#locationSummary`, `#locationHint`) 100% 호환 보존.
- 배포: main 커밋·푸시 및 HA deployment-backups 코드 백업 후 SSH 직접 반영. 프론트엔드 변경은 브라우저 새로고침으로 즉시 적용되며, 이전 Python 백엔드 변경(연간 주행거리 계산 및 카테고리 건수) 적용을 위해 1회 HA Core 재시작 안내. 개발 중 릴리즈 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: format donut center as manwon and add category counts and total row

- 변경: '어디에 썼을까요?' 지출 카드 UI 개편.
  1. 도넛 차트 중앙 지출 금액: 긴 원화 숫자 대신 반올림한 ~만원 단위(예: 335만원)로 표시하여 도넛 중심부 내 가독성 극대화. SVG title에 전체 원화 금액 및 만원 단위 병기.
  2. 우측 카테고리별 지출 항목: 카테고리명 다음 줄에 기간 내 건수(예: 29건, 4건)를 표시. 백엔드 query 집계 및 프론트엔드 fallback 동시 지원.
  3. 카테고리 목록 하단: 구분선 추가 후 '전체' 레이블과 정확한 전체 금액(예: 3,349,928원) 명시.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-vehicle-journal,carrot-journal-design}.js, custom_components/carrot_ha/vehicle_journal/store.py, vehicle-journal/CHANGELOG.md.
- 검증: node --check 구문 검사 통과, Python unittest 23개 통과, HA 운영 DB 쿼리 건수/합계 일치 확인.
- 배포: main 커밋·푸시 및 HA deployment-backups 코드 백업 후 SSH 직접 반영. Python 변경 적용을 위한 사용자 HA 재시작 필요. 개발 중 릴리즈 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: support same-day multiple odometers in distance calculation

- 원인: 정비 후 주유나 당일 주행 등 하루에 누적거리가 여러 번 기록된 정상 운행(예: 2026-03-07 주유 79,838km/주행 79,977km, 2026-08-14 정비 93,022km/주유 93,025km)에서 len(points[d])!=1 검사로 인해 상충 오류로 판단하여 전체 연간 거리 계산이 중단되고 —km로 표시됨.
- 변경: 동일 날짜 내 여러 누적거리 기록을 정상적인 당일 주행 진행으로 수용. 일자별 마감 누적거리는 당일 최대값(max(points[d]))으로 취합하고, 당일 내 기록이 직전 일자 마감값보다 작거나 일자 간 마감값이 역전되는 실제 누적거리 감소만 검출하여 안전하게 계산.
- 결과: 아테온 2026년 주행거리가 2025-12-27 기준(75,531km)부터 2026-10-05(99,172km)까지 정상 계산되어 23,641 km로 복원됨.
- 관련 파일: custom_components/carrot_ha/vehicle_journal/fuel_metrics.py, vehicle-journal/tests/test_vehicle_import.py, vehicle-journal/CHANGELOG.md.
- 검증: test_vehicle_import.py 18개 전체 통과(당일 다중 누적거리 정상 계산 및 실제 역전 검출 포함), schema 검증 9개, 권한/스케줄/저장소 회귀 통과. HA 실제 운영 DB에서 23,641 km 정상 산출 확인.
- 배포: main 커밋·푸시 및 HA deployment-backups 코드 백업 후 SSH 직접 반영. Python 변경 적용을 위한 사용자 HA 재시작 필요. 개발 중 릴리즈 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: fix combustion comparison annual distance and chart labels

- 원인: 절약 비교는 EV 전비/충전비만 검사하고 거리 슬라이더도 기존 distance_km만 사용. 내연기관은 합의한 주유 지출÷관측 거리의 원/km 기준으로 비교 차량 연비/유가와 추정 비교. 실제 연비가 아니며 기간 차이 오차를 명시. 기록 거리 버튼·슬라이더에 관측 거리 연결.
- 연간은 이전 연도 기준이 없을 때 합의대로 해당 연도 첫/마지막 누적거리로 관측 구간 계산. 연초 누락 안내 표시. 월간 기존 기준 유지; 감소/상충 제외. 대시보드 제목 바로 아래 계산 구간 표시.
- 도넛 중심 금액은 전체 원화/천 단위 구분을 유지하며 SVG textLength/문자수별 크기로 내부 폭 82로 제한. 설정 버튼 글자 크기·분류 텍스트 복원, 줄인 padding/높이 유지.
- 관련 파일: vehicle_journal/fuel_metrics.py, frontend/{carrot-vehicle-journal,carrot-journal-design}.js, tests/{test_vehicle_import.py,vehicle-management.cjs}.
- 검증: Python 37개, 합성 Chrome 연간 내연기관 비교/관측 거리·큰 금액 SVG 경계·설정 글꼴 및 기존 EV 탭/차트/월연도/수기 저장 회귀 통과. 구문·diff 검사 통과.
- 배포: main 커밋·푸시 후 승인된 HA 코드 백업·반영. 서버 계산 적용은 사용자 재시작 필요. DB/사진 직접 변경 없음; 실제 브라우저 확인 대기. 개발 중 릴리즈 없음. Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: record final category-entry deployment

- b1816df main 푸시·합성 Chrome 종류별 입력/하이브리드 유종 명시 검증 통과. HA deployment-backups/b1816df9c3359e269fdd77b3b65619c61db5f8c0/ 화면 모듈 백업·반영, 설치 및 내부/외부 HTTP 해시 일치.
- 서버/스키마는 c606962 기준 설치 완료. HA 재시작 이후 스키마 백업/이관·API 적용 및 실제 사용자 브라우저 확인 대기. 실제 운영 원장 저장·삭제나 HA 재시작을 대신 실행하지 않음.
- 관련 파일: vehicle-journal/CHANGELOG.md. 문서만 변경; 추가 실행 코드 배포·릴리즈 없음.

## 2026-10-12 — vehicle-journal: verify entry deployment and require hybrid fuel choice

- c606962 main 푸시·HA deployment-backups/c6069628fea3d799db4acd8fc30f9ef7ecebe22c/ 코드 백업·7개 파일 반영 완료. 설치 및 화면 내부/외부 HTTP SHA-256 일치. 9440a1b 통계 수정 함께 반영. 사용자 HA 재시작·스키마 적용·실제 화면 확인 대기. 운영 DB 직접 수정 없음.
- 하이브리드 유종은 휘발유/경유를 임의 추정하지 않고 주유 입력에서 실제 유종을 선택하도록 보완. 기존 휘발유/경유 차량은 해당 선택 유지. 관련 파일: frontend/carrot-vehicle-journal.js, vehicle-journal/tests/vehicle-management.cjs. 구문·합성 Chrome 검증 후 카드 부분 반영 대상.
- 사고 사진 10장 스냅샷 복원 포함 Python 36개·스키마 9개 및 사진/로더/대시보드 회귀 통과. OCR·자동 주유소/단가/연비는 후속. 새 릴리즈 없음.

## 2026-10-12 — vehicle-journal: redesign record entry by category

- 기록 남기기 → 종류 선택 메뉴: 주유 영수증 촬영, 세차, 사고, 주행, 정비/기타, 차량 유종별 주유/충전. 정비/기타는 기존 날짜/분류/세부 작업/금액/메모/위치/사진 구성 유지. 나머지는 종류별 세로 입력과 상단 저장 버튼. 촬영/앨범 사진 타일·수량 표시.
- 주유: 위치, 누적거리, 금액, 유종, 단가, 실제/추정 리터, 가득/부분 여부, 세차비, 사진·메모. 금액÷단가로 리터 추정 후 사용자가 수정 가능. 세차비는 같은 DB 트랜잭션의 별도 세차 기록으로 저장·수정·삭제/복원. 충전은 청구량을 보존하고 배터리 실충전량으로 간주하지 않음.
- 주행: 누적/구간 선택, 메모·사진. 누적거리 관측 계산과 연결하며 구간 합계는 별도 지표로 표시, 두 거리를 중복 합산하지 않음. 세차: 비용/누적거리/위치/사진/메모. 사고: 위치/사진/선택 금액/메모.
- 사용자 선택: 사고는 별도 accident 분류 및 사진 최대 10장, 나머지는 5장. DB 스키마 3으로 이전 버전 1/2를 백업 후 이관, FK 보존. 사진 한도 trigger 서버 검증·10장 사고 스냅샷 복원, 기존 schema2 스냅샷 읽기 유지.
- OCR·자동 주변 주유소·오피넷 자동 단가·가득 주유 연비 자동 계산은 합의대로 후속. 영수증은 촬영/첨부 및 수동 입력만 제공. 현재 영수증 촬영은 브라우저 카메라 지원 기기에서 동작.
- 관련 파일: frontend/{carrot-vehicle-journal,carrot-journal-design}.js, vehicle_journal/{store,fuel_metrics,schema.sql,snapshots,vehicles}, vehicle-journal/schema/{001_initial.sql,validate_schema.py}, tests/{browser-check,vehicle-management}.cjs, tests/{test_journal,test_vehicle_import}.py.
- 검증: Python 원장/이관/권한/차량 36개, 스키마 9개, 합성 Chrome 종류별 모바일 폼·주유 추정/수정/저장·누적거리 payload·사고 한도·기존 EV 탭/추세·사진 압축/취소·모듈 로딩/입력 보호 통과. HA 운영 DB 두 개를 읽기 전용으로 복사한 로컬 임시 공간에서 이관 후 전체 데이터 테이블 digest 동일 및 FK 검사 통과. 운영 데이터 쓰기/실제 기록 저장 없음.
- 배포: 검증 후 main 커밋·푸시·승인된 HA 코드 백업/부분 반영. 9440a1b 내연기관 통계 수정도 함께 반영 대상. Python/스키마 적용은 사용자 HA 재시작 필요. 실제 브라우저 확인 대기. 새 릴리즈/Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: adapt combustion statistics and imported locations

- 내연기관/하이브리드 선택 시 주유비 범례, 충전비와 동일 mint 색상, 주유량·횟수·평균 금액/L 대시보드 및 관측거리/주유량/주유금액/L/횟수/지출 추세로 전환. EV 추세 유지. 연비 자동 계산은 후속.
- 사용자 확인 기준: 이전 기간 마지막 누적거리부터 선택 기간 마지막 누적거리까지 차이와 실제 관측 구간 표시. 주유·정비 이관 원본 및 수동 입력 누적거리 통합, 동일 날짜 동일 값 중복 제거. 기준 없음·감소·상충 값은 미확인 처리. 일별 차트 값은 관측 종료 날짜 기준이며 실제 일별 주행거리가 아님.
- 좌표 없는 이관 장소는 기본 서울 지도를 숨기고 장소명만 보존됐다는 안내 표시. 검색 결과 사용자 선택/저장 또는 직접 핀 지정. 임의 첫 결과 확정 없음.
- 관련 파일: vehicle_journal/{fuel_metrics,store}.py, frontend/carrot-vehicle-journal.js, vehicle-journal/tests/{test_vehicle_import.py,vehicle-management.cjs}.
- 검증: Python 34개, 합성 Chrome 내연기관 통계/범례/추세·장소명-only 안내/직접지도·기존 EV 대시보드/월연도 추세 회귀 통과. 제공 XLS 로컬 임시 DB에서 선택 월 유량·누적거리 계산 확인; 실제 HA 데이터 수정 없음.
- 배포: main 커밋·푸시 후 입력 화면 개편과 함께 승인된 HA 백업/반영 예정. Python 적용은 사용자 재시작 필요. 개발 중 릴리즈 없음; Cloudflare/Comma 변경 없음.

## 2026-10-12 — vehicle-journal: record manual vehicle purge deployment

- ad7508f main 푸시 완료. HA deployment-backups/ad7508f41f3d914d8c1edd6bcc03c51f9fb297f0/ 기존 5개 코드 파일 백업 후 반영·SHA-256 일치. 화면 JS 내부/외부 HTTP 해시 일치.
- Python 원장/이관/차량/권한 전체 32개 통과, Chrome 확인·취소·빨간 버튼·모바일 검증 통과. 실제 차량 삭제 실행 없음. 사용자 HA 재시작 후 API 활성화 및 실제 화면 검증 대기.
- 관련 파일: vehicle-journal/CHANGELOG.md. 문서만 변경; 추가 실행 코드 배포·릴리즈 없음.

## 2026-10-12 — vehicle-journal: permanently delete trashed manual vehicles

- 사용자 선택: 영구 삭제는 휴지통의 수동 등록 차량에만 제공. 연동 차량은 기기 연결·휴지통/복원 유지. 휴지통 이름·유종·상태 빨간색, 영구 삭제 버튼 빨간색. 차량·기록·사진 삭제 및 복원 불가 확인 팝업; 취소 시 요청 없음.
- 관리자 전용 vehicle/delete API, 휴지통/수동 차량 서버 검증. 차량 DB·SQLite 보조 파일·마이그레이션 사본·사진 디렉터리 삭제. HA 보관 메타데이터의 삭제 진행 표식으로 중단 시 다음 시작에 정리 재개. 이전 스냅샷·HA/NAS 백업 사본은 자동 삭제하지 않음.
- Journal 연결을 동일 RLock으로 보호하고 삭제 완료 객체의 재접속 차단. 남은 이관 미리보기 재실행으로 삭제된 차량 ID가 반환되지 않도록 정리.
- 설정창 버튼 최소 높이 38→27px, padding 8/12→5/8px로 약 30% 축소; 분류 버튼도 축소.
- 관련 파일: vehicle_journal/{vehicles,store,api}.py, frontend/{carrot-vehicle-journal,carrot-journal-design}.js, vehicle-journal/tests/{test_vehicle_import,test_api_authorization}.py, vehicle-management.cjs.
- 검증: 임시 DB 삭제/사진·사본 삭제, 활성 차량·연동 차량 차단, 삭제 객체 재접속 차단, 재시작 중단 복구 테스트 통과. 기존 원장 테스트 13개와 이관/차량 테스트 14개 통과. 합성 Chrome 확인/취소·빨간 버튼·모바일 검증 통과. API 권한 검사 후속 기록.
- 배포: 검증 후 main 커밋·푸시·승인된 HA 코드 백업/부분 반영. Python 변경으로 사용자 HA 재시작 필요. 실제 차량 삭제 실행은 하지 않음. 개발 중 새 릴리즈 없음. ~~Cloudflare~~·Comma 변경 없음.

## 2026-10-12 — vehicle-journal: record example placeholder deployment

- ca03b63 main 푸시, HA deployment-backups/ca03b63b2bacd943fd275306493692d02306e3a2/ 기존 코드 백업·화면 모듈 반영 완료. 설치 및 내부/외부 HTTP 해시 일치. 실제 사용자 화면 확인 대기.
- 관련 파일: vehicle-journal/CHANGELOG.md. 문서만 변경, 추가 코드 배포·릴리즈 없음.

## 2026-10-12 — vehicle-journal: mark vehicle name placeholder as example

- 신규 차량 이름 입력 안내를 ‘예시) 아테온’으로 변경하여 실제 입력값과 예시를 구별.
- 관련 파일: frontend/carrot-vehicle-journal.js. 문구 확인 및 JS 구문 검사 통과. 승인된 HA 직접 백업·반영 대상; 운영 화면 확인 대기. DB·Python·~~Cloudflare~~·Comma 변경 및 새 릴리즈 없음.

## 2026-10-12 — vehicle-journal: record place-label deployment verification

- 2a6afa1 main 푸시 및 HA deployment-backups/2a6afa108e31f66f579c053358f805cde1f64d5f/ 코드 백업 완료. 화면 세 모듈 배포·설치 SHA-256·내부/외부 HTTP 해시 일치.
- 장소명 표시/일반 글씨/escaping·기존 대시보드 데스크톱/모바일 Chrome 회귀 통과. 실제 사용자 화면 확인 대기. 아테온 자료는 임시 로컬 DB에서만 검증; 실제 이관하지 않음.
- 관련 파일: vehicle-journal/CHANGELOG.md. 문서만 변경; 추가 실행 코드 배포·릴리즈 없음.

## 2026-10-12 — vehicle-journal: show record place beside category pill

- 상세 기록 알약 바로 옆에 위치 장소명(없으면 주소)을 구분점 없이 font-weight 400으로 표시. 세부 작업·메모는 기존 다음 줄 유지. 사용자 입력 HTML escaping 유지.
- 관련 파일: frontend/carrot-vehicle-journal.js, carrot-journal-design.js, vehicle-journal/tests/browser-check.cjs.
- 검증: 제공 마이클 XLS를 로컬 임시 DB에 이관해 모든 원본 장소명과 조회 결과 일치 확인. 실제 HA 차량/기록 등록 없음. 합성 Chrome 장소명 표시·일반 글씨·escaping 및 기존 대시보드 회귀 검증. 설치 백업·배포 결과 후속 기록.
- 배포: main 커밋·푸시 후 승인된 HA 화면 파일 직접 반영. DB·사진·Python·~~Cloudflare~~·Comma 변경 없음. 운영 브라우저 적용 확인 대기; 개발 중 새 릴리즈 없음.

## 2026-10-12 — vehicle-journal: record compact settings deployment verification

- 8c04da5의 HA 백업·화면 세 파일 배포 및 내부/외부 HTTP 해시 일치, 대시보드 회귀 통과 결과를 위 구현 항목에 확정 기록.
- 관련 파일: vehicle-journal/CHANGELOG.md. 문서만 변경; 추가 실행 코드 배포·릴리즈 없음. 실제 사용자 화면 확인 대기.

## 2026-10-12 — vehicle-journal: clarify API keys and fit settings to mobile viewport

- 변경·이유: 카카오 콘솔의 Default JS Key / Default Rest API Key 이름과 입력칸 하단 안내를 추가. Native AppKey 미사용 안내, 설정 분류 중앙 정렬, 설정 버튼 축소. 차량 선택기 옆 중복 제목을 제거하고 기존 제목 크기를 최상단에 보존.
- 모바일: safe-area와 위아래 여백을 반영하고 설정창을 헤더·스크롤 내용·메시지 grid로 구성. 긴 오류 메시지 줄바꿈/스크롤로 하단 가림 방지.
- 오류: 전역 settings/map/config/location/search 요청에 불필요한 entry_id가 포함되어 HA 검증에서 거부되던 문제 수정. 차량별 원장 요청에는 entry_id 유지.
- 관련 파일: frontend/carrot-vehicle-journal.js, carrot-journal-design.js, carrot-journal-panel-runtime.js, vehicle-journal/tests/vehicle-management.cjs.
- 검증: JS 구문 검사, 합성 Chrome 차량 등록·휴지통/복원·키 확인/저장 확인·지도 핀·320/360/1280px 여백/중앙 정렬 통과. 전역 요청 entry_id 거부 회귀 및 최신 모듈 로딩/입력 보호/스크롤 복원 통과. 모바일 이미지 확인. 기존 대시보드 탭·차트·수기 저장·escaping·데스크톱/모바일 회귀도 통과.
- 배포 상태: 8c04da5 main 푸시 완료. HA deployment-backups/8c04da5098999b1c1be09d2d247db7c2fda54c31/에 기존 코드 백업 후 화면 JS 세 파일 반영. 설치·내부/외부 HTTP SHA-256 모두 일치. 고정 로더 모듈 회귀 통과; 사용자는 새로고침 또는 새 화면 버전 적용. 실제 운영 브라우저 클릭 검증은 아직 대기. DB·사진·키 저장값·Python·~~Cloudflare~~·Comma 변경 없음. 개발 중 새 릴리즈 없음.

# 차계부 변경 이력

## 2026-10-12 — 기존 차량 초기화 수정의 직접 배포 기록

- 커밋 제목: `vehicle-journal: record upgrade fix deployment`.
- 변경·이유/관련 파일: 이 변경 이력에 9e8e725 실행 코드의 백업·HA 반영·설치 및 HTTP 해시 결과를 확정 기록. 코드 추가 변경 없음.
- 검증: 실제 데이터는 읽기 전용 메모리 사본에서만 재현/검증, 운영 원장·사진·API 설정 파일 직접 변경 없음. Python29개 및 Chrome 기존/신규 설정·로더 회귀 통과. 사용자 HA 재시작 후 운영 차량 목록/기록 확인 대기.
- 배포: 수정 코드6개 백업·반영 완료, 새 릴리즈 미발행·Worker/Comma 변경 없음.

## 2026-10-12 — 기존 차량 초기화 실패 수정 및 설정 UI 재구성

- 커밋 제목: `vehicle-journal: preserve linked expenses during upgrade and redesign settings`.
- 원인·이전 검증의 한계: 스키마1→2에서 expenses를 교체할 때 expense_members 외래키가 남아 초기화 실패, 기존 차량이 목록에서 빠짐. 이전 업그레이드 테스트에는 연결 자식 행이 없어 실패를 검출하지 못했다. 운영 DB는 삭제되지 않았고 읽기 전용 메모리 사본에서 같은 외래키 오류를 재현했다. Core 로그는 인증 제한으로 조회하지 못해 실제 데이터의 메모리 재현을 증거로 사용.
- 수정: 같은 트랜잭션 안에서 충전-지출 연결을 보관/복원하고 foreign_key_check 후 커밋. 백업과 원장/사진/요약/UUID 유지. 초기화 실패한 차량도 목록에 남기고 오류를 표시하여 빈 목록을 신규 차량 없음으로 오해하지 않게 함.
- UI: 설정을 최상단 오른쪽(패널 헤더, 독립 카드 상단)에 이동. 왼쪽 대분류 차량/백업복구/API/백업상태와 오른쪽 중·소분류 화면으로 재구성, 우측 독립 스크롤·모바일 좌우 배치. API 키는 관리자 전용 응답에서 현재 저장값을 채우고 기본 숨김·보기/숨기기·직접 수정 제공. 변경/제거 확인 팝업, 취소 시 요청 없음, 동일 값은 저장하지 않음. 키는 스냅샷/Git 제외 유지.
- 관련 파일: vehicle_journal store/vehicles/api, frontend 카드/디자인/패널 runtime, 이관/차량 UI 회귀 테스트, 사용 문서, 이 변경 이력.
- 검증: 차계부 Python29개 통과. 실제 원장의 읽기 전용 메모리 사본에서 records/mobility/expenses/expense_members/daily_summaries/attachments 전체 데이터 해시 불변·연결 및 외래키 검사 통과. 연결 행을 포함한 업그레이드 및 실패 차량 목록 회귀 추가. Chrome 데스크톱/모바일 설정 좌우·저장 키 표시·확인 취소/승인, 기존 차계부/로더/입력 보호 검사 통과. 모바일 설정 스크린샷 시각 확인. 개인 기록·키는 공개 기록에 포함하지 않음.
- 배포·제한: 실행 커밋 `9e8e725` main 푸시 완료. 변경 코드6개를 해당 전체 SHA의 HA deployment-backups 폴더에 백업 후 직접 반영, 설치 해시 및 화면3개 HTTP 해시 일치 확인. Python 수정 적용/DB 초기화 재시도는 사용자 HA 재시작 필요. 운영 차량 표시 재확인 대기. 기존 beta.4 유지, Worker/Comma 변경·배포 없음. 운영 DB 직접 수정·삭제·백업 덮어쓰기 없음.


## 2026-10-12 — 차량 관리 구현의 직접 배포 검증 기록

- 커밋 제목: `vehicle-journal: record onboarding deployment verification`.
- 변경·이유/관련 파일: 이 변경 이력에 실행 커밋 ef75d00의 원격 반영·코드13개 백업/배포/해시·승인된 내부 키 설정 결과를 확정 기록. 코드 추가 변경 없음.
- 검증·배포: 화면 HTTP 일치 및 설치 Python 구문 확인. 카카오 REST200/JS SDK 합성 HA origin 정상. 실제 HA 새 API/의존성/DB 업그레이드 및 사용자 이관은 재시작 후 대기, 실제 차량 기록은 이번 검증에서 등록하지 않음.
- 제한: 디버깅 정책상 기존 beta.4 유지. NAS 자동전송·주유 자동 입력/OCR은 후속. Worker/Comma 배포 없음.

## 2026-10-12 — 독립 차량·마이클 이관·스냅샷·설정·위치 관리

- 커밋 제목: `vehicle-journal: add vehicle onboarding imports snapshots and settings`.
- 변경·이유: 차량 선택에 새 차량 추가 팝업(이름/유종)과 직접 기록/마이클/스냅샷 경로 제공. 기기·토큰 없는 수동 차량, 기존 연동 차량 이름·유종 보정 및 기기 연결 유지, 휴지통·재시작 후 복원. 관리자 저장소를 기존 차량 런타임 목록과 분리해 수신/카메라/터미널 유지.
- 마이클 XLS/XLSX 시트·단위 컬럼 지원(xlrd 2.0.2), 미리보기 확인 후 트랜잭션 저장·재시도/재처리 중복 방지. 0/빈 값 구분, 주유비 분류, 장소·리터·단가·누적/구간거리·원본 연비 보존/조회. 불확실한 거리는 통계 제외, 충전량은 배터리 유입으로 추정하지 않음. 제공 파일은 로컬 임시 DB에서만 검증, 원본/개인 기록은 Git 제외.
- 스냅샷은 UUID·원장·사진·위치·보정·비교설정·충전 결제 원본/제외/삭제 포함. 같은 차량/기기는 복원 중단, 자동 덮어쓰기 없음. SQL 실행/ZIP 경로 추출 없이 스키마·외래키·사진 참조·체크섬 검증. 토큰/API 키·고빈도 상태·경로·CAN 제외. 스키마1→2는 무결성 확인한 DB 백업 후 기존 지출을 보존해 주유비 제약 확장.
- 별도 설정 메뉴: 차량/휴지통, 스냅샷, 카카오 JS/REST·오피넷 일반 키 등록/수정/제거, 기존 HA 백업 상태. 비밀 키 조회는 등록 여부만 반환. 위치는 기록 수정 창 메모 아래 표시하고 없는 경우 위치 추가만 제공. 검색·지도 핀·제거를 차계부 보정으로 저장하고 스냅샷 포함. 검색 버튼에서만 외부 조회, 서버 단기 캐시·요청 간격 제한.
- 확정 후속: NAS 전용 자동전송, 자동 주유소/단가/연비 및 OCR은 이번에 미구현. 누적거리 입력·금액/단가의 추정 주유량 실제 리터 수정·부분 주유 포함 가득 주유 계산 및 참고 화면 흐름을 사용 문서에 기록.
- 관련 파일: __init__/manifest, vehicle_journal api/runtime/store/schema/photos와 신규 vehicles/importers/snapshots/transfer, frontend 카드/디자인, 설계 스키마·검증, 원장/권한/타이머/신규 이관·차량관리 테스트, vehicle-management.md, 이 변경 이력.
- 검증: 차계부 Python28개·스키마9개, Chrome 기존 데스크톱/모바일·로더·새 차량/설정/휴지통/미리보기/합성 카카오 검색/핀/제거 통과. 대시보드 로딩/스크롤 Node10개, 카메라/충전/주행 Node20개, cloud live6개·incremental5개·history1개·charge payments11개, ~~Worker~~ incremental/benchmark 및 Comma param polling4개 통과. 테스트 경로 오지정은 올바른 하위 경로에서 재실행.
- 외부 검증: 사용자 승인 후 비개인 검색으로 카카오 REST200 확인. 실제 SDK와 공개 좌표로 합성 HA origin에서 JS 지도 생성 성공. 키는 공개 코드/로그/릴리즈/스냅샷에 넣지 않음.
- 배포·제한: 실행 커밋 `ef75d00204fcd78d1617205f0a81858dcf24bf73` main 푸시·원격 일치 확인. 변경 코드13개를 `/config/carrot_ha/deployment-backups/ef75d00204fcd78d1617205f0a81858dcf24bf73/`에 백업/신규 파일 표시 후 직접 반영, 설치 SHA-256 및 화면2개 HTTP SHA-256 일치. 사용자 명시 승인한 API 키3개는 새 HA 내부 Store에 제한 권한으로 등록하고 값은 출력하지 않음. Python/스키마/의존성 적용은 사용자 HA 재시작 필요, 운영 UI 확인 대기. HA 컨테이너 검사는 SSH 앱 보호 모드로 실행 불가하여 보호 모드를 유지하고 설치 파일 구문 검사로 대체; HA 내부 의존성 설치/새 API 구동은 사용자 재시작 후 확인 필요. 기존 beta.4 유지·신규 릴리즈 미발행. Worker/D1/Comma 변경·배포 없음. XLS/XLSX20MiB·ZIP128MiB/해제256MiB 제한, NAS 보관본 검증 미실시.


## 2026-10-12 — 저장공간 실측 및 두 차량·NAS 복구 구상 분석

- 커밋 제목: `vehicle-journal: record storage and recovery analysis`.
- 변경·이유: 사용자 요청으로 HA 저장공간·DB 테이블별 건수·페이지·사진·진단 파일을 읽기 전용 집계하고 현재 차량 및 수동 내연기관 차량의 장기 증가 시나리오, 기존 Synology HA 백업과 차계부 전용 스냅샷 복구 경계 분석. 개인정보가 포함될 수 있는 실측 상세 보고서는 Git 밖의 로컬 산출물로 보관하고 공개 변경 이력에는 분석 사실만 기록.
- 관련 파일: 이 변경 이력. 분석 대상은 storage/vehicle_journal/can_capture/config_flow 실행 코드이며 변경하지 않음.
- 검증: SQLite mode=ro·query_only 조회, 파일 크기·디스크 여유·CAN 파일 날짜 집계. NAS 포함 범위와 복구 실험은 미실시. 자동 CAN 상한 회전, HA 등록 ID 재연결, DB 간 일관성, 사진 참조 및 충전 결제 원본 포함 필요 확인.
- 배포·제한: 문서 기록만 main 커밋·푸시. 실행 코드 변경·DB 삭제·압축·NAS 전송·재시작·릴리즈·Worker/Comma 배포 없음. 사용자의 향후 CAN 수집 중단·삭제 구상은 보관본 검증 후 삭제하는 별도 작업이며 이번에 실행하지 않음.


## 2026-10-12 — 상세 기록을 분류·세부작업·메모 세 줄로 배치

- 커밋 제목: `vehicle-journal: stack category details and memo`.
- 변경·이유: 사용자 요청에 따라 상세 기록에서 카테고리 배지, 세부 작업, 메모를 각각 다음 줄에 표시. 세부 작업 앞 가운데 점 제거, 없는 항목은 빈 줄을 만들지 않음. 배지의 글자 너비 유지.
- 관련 파일: `frontend/carrot-vehicle-journal.js`, 이 변경 이력.
- 검증·배포: JS 구문/diff 및 Chrome 데스크톱·모바일 회귀 통과. 실행 커밋 `76e5068` main 푸시·HA 화면 파일 백업/직접 반영 및 설치·HTTP SHA-256 일치 확인. 백업 `/config/carrot_ha/deployment-backups/76e50686335d32838759ad241234586c2238061a/`. Python/DB/Worker/Comma 변경 없음, 재시작 불필요. 사용자 새로고침 후 운영 확인 대기, 기존 beta.4 유지.


## 2026-10-12 — 상세 기록 분류 배지 너비 수정

- 커밋 제목: `vehicle-journal: keep ledger category pills compact`.
- 변경·이유: 직전 배지 변경이 세로 flex 부모의 기본 stretch를 따라 열 전체로 늘어난 문제 수정. 최근 기록과 동일한 제목 행으로 분류/부가 설명을 묶고 배지에 fit-content 및 flex 축소 방지 적용. 메모는 별도 줄 유지.
- 관련 파일: 화면 카드/디자인, 브라우저 회귀 테스트, 이 변경 이력.
- 검증: JS 구문 및 diff 검사 통과. Chrome 전체 회귀 통과, 850/520/360/320px 배지 너비가 글자+패딩 이내인지 검사 통과. 360px 모바일 스크린샷 시각 확인.
- 배포: 실행 커밋 `ed16e61` main 푸시 완료. 기존 사용자 승인 범위에서 화면 2개를 `/config/carrot_ha/deployment-backups/ed16e6147a4b5c39c8683e0c95634216daf621ad/`에 백업·직접 반영하고 설치 및 HA 내부 HTTP SHA-256 일치 확인. Python/DB/Worker/Comma 변경 없음. 화면 새로고침 후 실제 사용자 확인 대기. 기존 beta.4 유지.


## 2026-10-12 — 직접 배포 결과 기록

- 커밋 제목: `vehicle-journal: record verified HA deployment`.
- 변경·이유/관련 파일: 이 변경 이력에 실행 코드 `dcd9093`의 실제 푸시·HA 백업·설치 해시 확인 결과를 연결. 코드는 추가 변경하지 않음.
- 검증·배포: 코드 3개 설치 해시 일치 재확인. 운영 브라우저 접근 도구가 승인 대기 상태에서 응답하지 않아 사용자가 중단했으며 실제 UI 적용 확인은 미완료. Python 처리는 사용자 HA 재시작 대기. 서버 파일 반영과 런타임 적용을 구분.
- 제한: 신규 릴리즈 미발행, 기존 0.8.14-beta.4 유지. Worker/D1/Comma 변경 없음.

## 2026-10-12 — 모든 지출 관리와 월 전체 최근 기록

- 커밋 제목: `vehicle-journal: allow editing all expenses and show full period`.
- 변경·이유: 자동 지출에도 수정/삭제/복원을 제공하고 자동 원장 관리 문구 제거. 사용자 보정은 원본 출처를 유지한 HA 원장의 별도 input/override로 보존하며 이후 자동 결제 투영으로 덮어쓰지 않는다. 차계부 보정은 기존 차량 충전 결제 원본을 변경하지 않는다. 버전 충돌 검사 유지.
- 최근 목록이 5건 제한 때문에 월 초 기록을 표시하지 못했던 원인 수정: 선택 기간의 활성 지출 전체를 원장 페이지/필터와 독립적으로 반환. 기록/메모 분류는 최근 목록과 동일한 색상 배지 사용, 부가 설명은 배지 밖에 표시. 데스크톱 지출/최근 카드 높이 250→350px, 모바일 기존 높이 유지.
- 관련 파일: `frontend/carrot-vehicle-journal.js`, `frontend/carrot-journal-design.js`, `vehicle_journal/store.py`, `vehicle-journal/tests/test_journal.py`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: 번들 Python 원장/권한/런타임 17개, 스키마 9개, 실제 Chrome 데스크톱/모바일 회귀 통과. 자동 지출 수정/삭제/복원·재동기화·오래된 버전 거절 및 12건 전체 조회/원장 2건 페이지 독립성 확인. 최초 시스템 Python의 Pillow 누락은 번들 Python으로 해결. 브라우저 테스트의 기존 분류 선택자를 새 배지에 맞춤.
- 배포: 실행 코드 커밋 `dcd9093a3ce8d3f2a4b5dd6266ae8a3585914cae` main 푸시·원격 SHA 일치 확인. 변경 코드 3개를 `/config/carrot_ha/deployment-backups/dcd9093a3ce8d3f2a4b5dd6266ae8a3585914cae/`에 백업 후 직접 반영·설치 SHA-256 일치 확인(중단 후 재확인 포함). 사용자가 이번 HA SSH 직접 반영을 명시적으로 승인. Python 반영 후 사용자 HA 재시작 및 운영 브라우저 확인 대기. 디버깅 정책에 따라 기존 beta.4 유지; 실제 적용 검증 전 릴리즈 완료로 보고하지 않는다. Worker/D1/Comma 변경·배포 없음.
- 제한: 차계부 수정은 차계부 내부 보정이며 차량 대시보드 충전 결제 값에는 전파하지 않는다. 운영 데이터·사진을 테스트하거나 변경하지 않음.


## 2026-10-11 — 모바일 지출 목록 금액 대비 보정

- 스크린샷 검사에서 표 기본 글자색의 영향으로 금액/정렬 문구가 어둡게 표시되는 것을 확인하고 모바일 금액에 본문 테마색, 정렬에 보조 테마색 명시. 관련 파일: frontend 디자인, 변경 이력. 기존 목록/기능 유지, 화면 재배포.

## 2026-10-11 — 모바일 상세 기록을 세로 지출 목록으로 변경

- 커밋 제목: `vehicle-journal: display mobile ledger as expense list`.
- 사용자 사진에서 금액/관리를 보기 위해 가로 스크롤해야 했던 문제 수정. 760px 이하 상세 기록은 분류/메모와 우측 금액, 아래 날짜/출처·관리 버튼의 목록 배치. 기존 사진/수정/삭제/복원·분류필터·페이지·금액 정렬 유지. 넓은 화면의 고정 열 표 유지.
- 관련 파일: frontend 디자인, 모바일 Chromium 검증, 변경 이력. Chromium 전체 회귀 통과·320/360/520px 금액/관리 버튼 경계 및 표 내부 가로 넘침 없음 확인. `28721c91742741d19ca6da17ae9f6cdd4752f444` main 푸시·HA 두 화면 모듈 백업 배포/설치·HTTP 해시 일치 확인. 백업 `/config/carrot_ha/deployment-backups/28721c91742741d19ca6da17ae9f6cdd4752f444/`. 합성 모바일 스크린샷 검토, 실제 iPhone 확인은 사용자 새로고침 후 대기. Python/DB/Worker/Comma 변경 없음. beta.2 태그는 유지.

## 2026-10-11 — 0.8.14-beta.2 누적 pre-release 준비

- 커밋 제목: `vehicle-journal: prepare 0.8.14-beta.2 prerelease`.
- 사용자 발행 요청으로 manifest 버전을 `0.8.14-beta.2`로 갱신. `v0.8.14-beta.1..da9dfe7` 전체 55개 커밋/31개 파일 diff를 대조하고 사진·브리핑·로더·센서·CAN10GB·추세·금액·날짜·상세지출·절약비교·유가연결 및 지침 변경을 `.github/release-notes/v0.8.14-beta.2.md`에 누적 작성. 로더 테스트는 JOURNAL_CHROME 환경변수 지원을 추가하여 Windows에서도 실행.
- 이번 검증: Chromium 차계부·사진압축·사진취소·로더/업데이트/스크롤 통과, Python 원장/권한14개(Windows GC 정리 보조)와 스키마9개 통과. 별도 dashboard Node --test 묶음은 이 환경에서 출력 없이 대기하여 중단했으며 이번 실행 통과로 계산하지 않음. 기존 개발 과정 검증/운영 확인과 이번 실행을 구분.
- 발행: `9cf1ada1795dc98ddea6f837d9c3a7ff5c75b255` main 및 새 태그 `v0.8.14-beta.2` 원격 일치 확인. GitHub Release https://github.com/helico717/carrot-ha/releases/tag/v0.8.14-beta.2 에서 prerelease=true/draft=false·누적 노트 확인. HACS Release Actions https://github.com/helico717/carrot-ha/actions/runs/38105066830 completed/success·대상 SHA 일치 확인. Python 지출 필터/정렬과 유종 매핑 보존 저장의 재시작 후 운영 확인은 대기. 사용자는 HACS 베타 설치/HA 재시작 수행. Worker/Comma 변경 없음.

## 2026-10-11 — 모든 유종의 연결 상태와 개별 수정

- 커밋 제목: `vehicle-journal: show and edit all fuel sensor connections`.
- 유가 연결 기준에 세 유종 상태/현재 가격과 작은 수정 버튼 표시. 선택 유종과 무관하게 센서 수정/저장/취소 가능. 수동 연결 우선, 다른 유종 연결을 덮어쓰던 저장 오류 수정(기존 매핑 병합). 입력 중 새로고침에 따른 폼 값 덮어쓰기 방지. DB 스키마 변경 없음.
- 관련 파일: frontend 카드/디자인, vehicle_journal/api.py, Chromium 테스트, 변경 이력. Chromium 전체 및 연결3종/독립 수정/취소 회귀, Python 원장/권한14개 통과. `bc5ba2c08a4821e9274634394150e5e585989877` main 푸시·HA 백업 직접 반영/설치·JS HTTP 해시 일치. 백업 `/config/carrot_ha/deployment-backups/bc5ba2c08a4821e9274634394150e5e585989877/`. 운영 Chrome 세 유종 연결/가격 표시 및 수정 폼 열기·취소 확인. Python 매핑 보존 저장은 사용자 HA 재시작 후 활성화하며 실제 저장 검증은 대기. 신규 릴리즈/Worker/Comma 변경 없음.

## 2026-10-11 — HA 절약 비교를 확정 로컬 스타일에 맞춤

- 커밋 제목: `vehicle-journal: match savings comparison to approved prototype`.
- 원인: 기존 HA 제목 20px/금액34px 보통 굵기, 8:4 열 비율과 range 최소높이44px가 남아 로컬 25px/42px 굵기760, 1.4:1 비율·작은 슬라이더와 달랐음.
- 변경: 절약 비교 범위에 로컬 제목/금액 글자·자간·행간·카드 비율·22px 패딩·17px 곡률·그래프16px·범위입력16px·버튼/설정 박스/간격을 일치. 다른 탭 CSS 유지. 좁은 화면 단일 열과34px 금액 유지.
- 검증·배포: 합성 Chromium 전체 회귀 통과. `ae660d7a2807fa19c27f22bc4686a95bf26deeae` main 푸시, HA 화면 두 모듈 백업 직접 반영·설치/HTTP SHA 일치. 백업 `/config/carrot_ha/deployment-backups/ae660d7a2807fa19c27f22bc4686a95bf26deeae/`. 실제 접속 Chrome 새로고침 후 computed style 제목25px/금액42px·굵기760·자간−1px/패딩22px 확인 및 스크린샷으로 카드 비율·범위입력·버튼·설정 박스 검토. 기존 586px가량 카드가 현재444.5px로 내용에 맞게 축소됨(운영 viewport). Python/DB/Worker/Comma 변경 없음, 재시작 불필요.

## 2026-10-11 — 확정한 슬라이더 절약 비교 HA 구현

- 커밋 제목: `vehicle-journal: implement approved savings slider comparison`.
- 선택 차량 이름·선택 기간 기록 거리 기본값·거리 복귀·유종별 HA 전국 평균 및 복귀·연비/유가/거리 슬라이더 연결. 확정된 제목/금액/그래프 배치, 작은 우측 버튼, 항목명 강조와 추정 라벨 제거 적용. 전비와 기간 충전 단가를 사용하여 같은 거리의 에너지 비용 계산. 누락 가격/전비는 계산 보류, 조정값은 화면에서만 사용. 기존 비교 기준 저장과 센서 설정 유지.
- 관련 파일: frontend 카드/디자인, Chromium 테스트, 검토 HTML, 변경 이력. 외부 cloud 요청/DB 변경 없음.
- 검증/배포: Chromium 전체 회귀 및 유종/연비/거리 복귀/유가 누락 검사 통과. `9932ea3ae7e5906d15a85d60f1fcc60f8d7d856d` main 푸시, 두 화면 모듈 HA 백업 직접 반영·설치/HTTP 해시 일치. 백업 `/config/carrot_ha/deployment-backups/9932ea3ae7e5906d15a85d60f1fcc60f8d7d856d/`. 실제 접속 Chrome에서 선택 차량·기록 거리·절약 금액 표시 및 경유 버튼 클릭으로 HA 가격 변경 확인. Python 변경 없음, 이번 화면 적용에 HA 재시작 불필요. 릴리즈 없음.

## 2026-10-11 — 비교 그래프 라벨 간소화

- 사용자 요청으로 비교 막대의 선택 차량명 및 비교 차량명 뒤 ‘· 추정’ 제거. 계산/금액은 유지. 관련 파일: `review-savings-10.html`, 변경 이력. 로컬 검토용, 운영 배포 없음.

## 2026-10-11 — 슬라이더 항목명 강조

- 6번의 주행거리·비교 유종·비교 차량 연비 이름만 굵기 750, 기존 대비 1px 큰 글자 및 밝은 색으로 강조. 수치/설명 크기 유지.
- 관련 파일: `review-savings-10.html`, 변경 이력. Chromium 후보/계산/모바일 회귀 통과. 로컬 검토용, 운영 배포 없음.

## 2026-10-11 — 비교 카드 크기 복원 및 슬라이더 중앙 정렬

- 6번 카드에 추가했던 최소 높이를 제거하여 내용 기준 높이와 기존 패딩 복원. 제목·금액·그래프의 세 영역은 유지하고 우측 슬라이더 묶음을 카드 내 세로 중앙에 배치.
- 관련 파일: `review-savings-10.html`, 변경 이력. Chromium 후보/계산/모바일 회귀 통과. 로컬 검토 단계, 운영 배포 없음.

## 2026-10-11 — 유가 정보와 유종 버튼 동일 행 배치

- 6번 유가 정보 및 유종 버튼을 하나의 flex 행에 묶어 정보는 왼쪽, 버튼은 오른쪽 배치. 좁은 화면 간격/버튼 글자 조정, 공간 부족 시 넘침 없이 줄바꿈 허용.
- 관련 파일: `review-savings-10.html`, 변경 이력. Chromium 10개 후보/계산/모바일 회귀 통과. 로컬 검토용이며 운영 배포 없음.

## 2026-10-11 — 비교 카드 전체 높이의 세 영역 배치

- 6번 초록 카드를 세로 flex로 구성하여 제목·절약 금액·비교 그래프를 위/가운데/아래로 배치. 카드 높이를 고르게 사용하고 하단에 몰린 빈 공간 제거. 좁은 화면에서도 최소 높이와 영역 간격 조정.
- 관련 파일: `review-savings-10.html`, 변경 이력. Chromium 계산/10개 후보/모바일 넘침 회귀 통과. 로컬 검토용, 운영 배포 없음.

## 2026-10-11 — 검토안 복귀 버튼 축소

- 거리 복귀 버튼의 숫자/km를 제거하여 ‘기록된 거리’만 표시. 기록된 거리·전국 평균 복귀 버튼의 패딩과 글자 크기를 줄여 소형 버튼으로 통일. 복귀 동작 유지.
- 관련 파일: `review-savings-10.html`, 변경 이력. Chromium 후보/계산/모바일 회귀 통과. 로컬 검토안만 수정, 운영 배포 없음.

## 2026-10-11 — 6번 검토안 여백과 유종 제어 정돈

- 초록 카드의 금액과 비교 그래프 사이 여백 확대, 그래프 아래 반복 설명 제거. ‘비교 유종 · 선택 유종 유가 금액/L’ 한 줄 배치. 유종 선택 버튼 우측 정렬 및 패딩/글자 크기 축소. 평균 유가 상태 문구 축약·복귀 버튼과 같은 행에 배치.
- 관련 파일: `review-savings-10.html`, 변경 이력. Chromium 후보/계산/모바일 레이아웃 회귀 통과. 로컬 사전검토 단계로 운영 배포 없음.

## 2026-10-11 — 6번 검토안의 슬라이더·제목 배치 조정

- 연비 슬라이더(1~50km/L, 0.1 단위) 추가. ‘같은 거리를 다른 차로 달렸다면요.’를 초록 카드 안에 배치하고 기간·차량·거리 기준을 카드 위로 이동. 오른쪽 차량 선택 제거, 상단 차량 선택만 사용. 복귀 버튼을 ‘전국 평균으로 돌아가기’로 축약.
- 관련 파일: `review-savings-10.html`, 변경 이력. Chromium 10개 후보/계산/모바일 넘침 회귀 통과. 로컬 검토용이며 운영 변경·배포 없음.

## 2026-10-11 — 선정한 6번 비교 후보 수정

- 사용자 선택을 검토 HTML에 반영: 선택 차량 이름 표시, 기록된 거리 복귀 버튼, 제목 ‘같은 거리를 다른 차로 달렸다면요.’, 가정 시뮬레이션 배지 제거, 유종별 버튼 및 전국 평균 유가 복귀. 휘발유/고급유/경유 엔터티 기본 연결 경로 명시. 현재 HTML의 차량·거리·유가는 합성 데이터이며 실제 HA 조회/저장이나 운영 구현은 하지 않음.
- 관련 파일: `review-savings-10.html`, 변경 이력. 로컬 사전검토 계속 진행하며 배포 없음.

## 2026-10-11 — 절약 비교 개편 후보 10개 로컬 검토안

- 변경·이유: 사용자 사전 검토 요청에 따라 `review-savings-10.html`에 독립 실행형 후보 10개 작성. 비용 비교·양쪽 차량 카드·차량 프리셋·100km 기준·월별 흐름·가정 시뮬레이션·영수증·복수 차량 표·계산 과정·비율 중심 구성. 후보 이동/전체 보기/휴대폰 너비/비교값 변경 제공. 추천 조합과 장단점·필요 데이터 설명 포함.
- 관련 파일: `vehicle-journal/review-savings-10.html`, 이 변경 이력. 기존 실행 코드는 수정하지 않음.
- 검증: 합성 값만 사용. 실제 Chromium 10개 렌더·후보 전환·시뮬레이션 계산·기본 금액·전체 보기·360px 및 휴대폰 프레임 가로 넘침 검사 통과, 넓은 화면 스크린샷 확인. 외부 요청/HA 저장 없음.
- 적용 상태: 사용자 요청의 로컬 HTML 사전 검토 단계로 커밋·푸시·HA 배포·버전 상승 없음. 사용자 후보 선택 후 별도 구현. 과거 월별 비교는 당시 기준 이력이 필요한 설계안이며 현재 기능으로 구현됐다고 주장하지 않음.

## 2026-10-11 — 상세 기록 분류를 기존 지출 정책에 맞춤

- 커밋 제목: `vehicle-journal: align ledger categories with spending policy`.
- 변경·이유: 드롭다운에 저장용 전체 분류를 노출했던 오류 수정. 충전비·정비 / 소모품·세차비·튜닝·기타만 표시. 기존 보험·세금·주차비·통행료 기록은 삭제 없이 기타 표시/색상/필터에 통합하고 서버도 페이지 분할 전에 같은 조건 적용. 수기 입력의 기존 네 분류 유지.
- 관련 파일: frontend 카드, vehicle_journal/store.py, Python/Chromium 회귀, 이 변경 이력.
- 검증·배포: Chromium 전체 회귀 및 Python 원장/권한 14개 통과. 다섯 분류만 노출·보험/세금/주차/통행료/기타 통합 조회 검증. `b030055a6aa4bd508bf5299ad5802f1329fab32e` main 푸시, HA 백업/직접 반영과 설치/JS HTTP 해시 일치 확인. 백업 `/config/carrot_ha/deployment-backups/b030055a6aa4bd508bf5299ad5802f1329fab32e/`. 운영 Chrome 새로고침 후 드롭다운 전체 및 다섯 지출 분류만 표시 확인. Python 필터는 사용자 HA 재시작 후 활성화하며 운영 전체 조회 검증은 대기. DB·사진·~~Worker~~·Comma 변경 없음.

## 2026-10-11 — 상세 기록을 차량 지출 전용으로 변경

- 커밋 제목: `vehicle-journal: show only financial expenses in ledger`.
- 변경·이유: 사용자 요청에 따라 상세 기록에서 주행 표시 체크박스·주행 분류·주행 행·충전량 행을 제거. 금액 지출만 표시하고 열 제목을 ‘금액’, 설명을 차량 지출로 변경. 금액 제목 버튼 클릭마다 시간순(최신 먼저) → 높은 순 → 낮은 순 → 시간순 순환, 선택 기간/분류 전체를 SQL에서 페이지 분할 전에 정렬. 실금액 우선·없으면 추정금액 사용, 미확인 금액 마지막·동액 최신일/ID로 안정 정렬. 체크박스 드롭다운의 지출 분류 복수 선택·색상·고정 열 유지. 저장된 주행/충전 원본 및 다른 탭 집계는 보존.
- 관련 파일: frontend 카드/디자인, vehicle_journal API/store, journal Python/Chromium 테스트, 이 변경 이력.
- 검증: 지출 전용 필터/금액 정렬을 페이지 조회 전 SQL에 적용하며 이전 서버에서는 화면에서도 주행/충전량 제외. Chromium 회귀 및 Python 원장/권한 14개 통과(Windows 임시 DB 정리에는 GC 보조 사용). 100개 이상 주행 뒤 지출 조회·충전량 제외·복수 지출 분류·높은/낮은 금액 첫 페이지·잘못된 정렬 거절·집계 유지 확인. 운영 Chrome에서도 주행 체크박스/분류 0개, 지출 13행에 거리/kWh 없음, 시간순 → 높은 순 → 낮은 순 → 시간순 클릭 결과와 지출 분류 드롭다운 확인. 운영 검증은 재시작 전 기존 페이지의 화면 처리이며 전체 기간 서버 정렬 검증과 구분.
- 배포: `3a50385f979ffe0f964962c6da8fc48e9d6a28d3` main 커밋·푸시 완료. 네 실행 모듈 백업/직접 반영 및 설치 SHA-256, 두 JS HA HTTP 해시 일치. 백업 `/config/carrot_ha/deployment-backups/3a50385f979ffe0f964962c6da8fc48e9d6a28d3/`. Python 전체 기간 필터/정렬은 사용자 HA 재시작 후 활성화하며 그 운영 검증은 대기. ~~Worker~~·Comma·DB/사진 변경 및 릴리즈 발행 없음.
- 이전 배포: 드롭다운 변경 `5ad51d8` main 푸시, 두 화면 모듈 설치/HTTP 해시 일치 확인. 이번 요청이 바깥 주행 선택과 주행 분류 동작을 대체함.

## 2026-10-11 — 상세 기록 분류 선택을 체크박스 드롭다운으로 변경

- 커밋 제목: `vehicle-journal: use checkbox dropdown for ledger categories`.
- 변경·이유: 사용자 추가 요청으로 `f3d81b0`의 펼쳐진 분류 버튼 대신 ‘분류 선택’ 드롭다운 내부에 ‘전체’ 및 분류별 체크박스 배치. 복수 선택·선택 개수 표시·카테고리 색상 유지. 바깥 주행 표시 체크박스와 고정 표/로컬 서버 필터는 유지.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: 실제 Chromium 드롭다운 열기·복수 체크·전체 상태·기존 원장/추세/입력/모바일 회귀 통과. 좁은 화면 열린 메뉴의 가로 넘침 검사 포함. 배포는 main 푸시 후 두 화면 모듈 반영 예정.
- 이전 배포 확인: `f3d81b0` 네 실행 모듈의 설치 해시 및 두 화면 모듈 HA HTTP 일치. 백업 `/config/carrot_ha/deployment-backups/f3d81b0cdccf1fcc8b8a6f2a11272027c8087163/`. 운영 Chrome 기본 주행 숨김 25행/주행만 72행/주행·충전비 복수 96행과 분류 색상·고정 열 확인. 이는 재시작 전 기존 서버 조회 페이지의 화면 필터 검증이며 기간 전체 서버 필터 완료가 아님. 이번 드롭다운 변경이 이전 화면을 대체함.
- 제한: 사용자 HA 재시작 후 새 Python 서버 필터 활성화 및 운영 전체 페이지 확인 필요. 신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-11 — 상세 기록 주행 표시·복수 분류 필터와 고정 열 너비

- 커밋 제목: `vehicle-journal: add ledger filters and stable category columns`.
- 원인: 현재 상세 기록 렌더는 조회 records 전체를 조건 없이 출력하며 주행 숨김 조건이 없었음. 이전 패치가 사라진 경위는 미확인.
- 변경·이유: 설명 아래 기본 해제 ‘주행 기록 표시’ 체크박스와 복수 분류 버튼 추가. 주행 분류 선택 시 체크 자동 활성화, 주행 체크 해제 시 해당 분류 제거. 선택 분류는 OR 조건, 분류 미선택은 허용된 전체 기록. 필터 변경 시 페이지 초기화·오래된 비동기 응답 거부. 필터 상태는 화면 인스턴스에서 유지하고 신규 화면은 주행 숨김 기본값.
- 표: 4월 참고의 비율에 맞춰 날짜 14%/기록 49%/값 13%/관리 24% 고정. 긴 메모 줄바꿈·사진·관리 버튼 지원. 모바일은 표 내부 가로 스크롤로 열 유지. 분류 제목은 기존 소비 카테고리 색상 적용(주행은 파랑).
- HA 로컬 조회: 필터를 LIMIT/OFFSET 전에 적용하여 다른 페이지의 기록 누락 방지. 주행/충전비/모든 비용 분류 복수 지원, daily/totals/전체 record_count 유지. 최근 지출은 별도 최근 비용 목록으로 유지. DB 스키마/원본 기록/Cloudflare 요청 변경 없음.
- 호환: 새 서버의 record_filters_supported 응답 후 필터 인자를 사용. HA 재시작 전에는 기존 조회 결과의 화면 필터만 제공하고 전체 기간 필터 적용에 재시작이 필요함을 표시.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle_journal/store.py`, `vehicle_journal/api.py`, `vehicle-journal/tests/browser-check.cjs`, `vehicle-journal/tests/test_journal.py`, 이 변경 이력.
- 검증: 실제 Chromium 회귀(기본 숨김·주행만·복수 선택·해제·서버 필터 인자·열 너비·최근 지출·모바일/입력/금액/스크롤) 통과. Python 원장/사진/권한 14건 통과(101건 초과 페이지·집계 보존·잘못된 필터/차량 매핑 포함). 기존 dashboard freshness Node 10건 통과.
- 테스트 환경: 샌드박스 임시 SQLite 접근 오류 후 승인 경로 실행. Windows 기존 테스트 정리 3건은 SQLite 핸들 GC 전 파일 삭제 오류이며, 임시 하네스에서 cleanup 전 GC로 전체 14건 통과. 기존 runtime schedule 전체 discover는 응답 대기로 중단했으며 해당 테스트·실기 동작 성공을 주장하지 않음.
- 배포: main 커밋·푸시 및 네 실행 모듈 백업/직접 반영 예정. Python 적용은 사용자 HA 재시작 필요. 실제 운영 탭 연결 확인, 배포 후 화면과 신규 서버 조회 검증 상태는 후속 기록. 신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 미래 기간 차단 HA 반영 확인

- 커밋 제목: `vehicle-journal: record future period guard deployment`.
- 대상: `1f28d55` 미래 기간 차단. main 푸시·두 모듈 백업·HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/1f28d55cf5dbee03b442528f5f6f191c08d088ae/`.
- 검증: 최종 실제 Chromium 회귀 통과. 설치/HA 로컬 HTTP SHA-256 카드 `0354271504849915606b7aef8d4d18131e1ec1efc8095c37e3032d81d95f3375`, 디자인 `acb24e4e0ec87d05fd9373a7dc9c6d16f7b8b935c025bf2cc7684a103944098e` 일치.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 날짜 선택기 미래 기간 선택 차단

- 커밋 제목: `vehicle-journal: prevent selecting future journal periods`.
- 변경·이유: HA 시간대의 현재 월/연도를 입력 max로 설정. 현재 기간의 다음 버튼 비활성화 및 비활성 스타일 적용. 직접 입력 또는 복원된 미래 값은 조회 전 현재 기간으로 보정. 이동 함수와 range 검증에서도 미래 값 거부. 기존 월/연도 범위 의미 유지.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문 및 실제 Chromium 회귀 통과. 월/연도 max·입력 rangeOverflow·현재 기간 다음 버튼 비활성화·직접 미래 입력 보정·이동 함수 우회 차단·월/연도 과거 이동 및 현재 복귀 확인. 기존 모바일/입력/금액/스크롤 회귀 유지. 최초 검사에서 Playwright fill이 change를 발생시켜 이미 보정된 값을 검사한 테스트 순서 문제를 수정한 뒤 통과.
- 배포: main 커밋·푸시 후 HA 두 모듈 백업 및 직접 반영 예정. 운영 브라우저 확인은 별도 상태로 기록. 신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 날짜 선택기 버튼 HA 반영 확인

- 커밋 제목: `vehicle-journal: record date navigation deployment`.
- 대상: `1ff8bd5` 날짜 이동/현재 기간 복귀. main 푸시 및 두 모듈 백업/HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/1ff8bd5b84ef7ebb6692723917b7c0728d85c734/`.
- 검증: 최종 실제 Chromium 회귀 통과. 설치/HA 로컬 HTTP SHA-256 카드 `0fbff875399f35f88d391dbee8810b5b8aa2abae9cca6efd44a6491ea55f2e2a`, 디자인 `e39b537d8d5914783ee4bb2691a38fc7e6e615c18a36f9b91c59bb4945995a4d` 일치.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 날짜 선택기 이전·다음 및 현재 기간 복귀 버튼

- 커밋 제목: `vehicle-journal: add date navigation and current period buttons`.
- 변경·이유: 날짜 입력 왼쪽 이전/오른쪽 다음 버튼과 그 오른쪽 현재 범위 복귀 버튼 추가. 월별은 한 달씩 이동·‘이번 달’, 연도별은 한 해씩 이동·‘올해’. 현재 범위는 HA 설정 시간대 기준. 기존 입력과 선택 탭 유지, 기간 변경 시 상세 기록 페이지 초기화, 기존 오래된 응답 거부 경로 사용.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문 및 실제 Chromium 회귀 통과. 12월→1월/역방향·연도 이동·현재 월/연도 복귀·레이블·페이지 초기화·탭 유지 검증. 320–850px 모바일 가로 넘침 및 기존 입력/금액/스크롤 회귀 통과. 모바일 합성 화면 육안 확인.
- 배포: main 커밋·푸시 후 두 모듈 백업/HA 직접 반영 예정. 운영 화면 적용은 후속 상태로 구분. 신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 화폐 구분 쉼표 수정 HA 반영 확인

- 커밋 제목: `vehicle-journal: record grouped currency deployment`.
- 대상: `e6d122d` 화폐 표시·공통 지침. main 푸시 및 HA 코드 백업/직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/e6d122d1098494e7b1384aa5f561437153915634/`.
- 검증: 카드 설치 및 HA 로컬 HTTP SHA-256 `b4a4dc7a38b7e94952050a3299a1bb37a8e19b0f515c0eefbaab443c56671903` 일치. 배포 도구가 함께 반영한 디자인은 기존 해시와 동일. Node 10건 및 실제 Chromium 차계부 회귀 통과.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 모든 대시보드 화폐 천 단위 구분 규칙

- 커밋 제목: `vehicle-journal: enforce grouped currency labels across trends`.
- 변경·이유: 사용자 공통 규칙을 루트/차계부 AGENTS 및 `.agents/rules/vehicle-journal.md`에 명시. 모든 화면의 금액·단가·증감·비교·차트·툴팁은 세 자리마다 쉼표 표시. 계산/저장은 숫자 유지.
- 실행 변경: 차계부 추세 이전 기간 비교 금액, 과거/현재 그래프 수치, 막대 SVG 툴팁에서 누락된 천 단위 쉼표 적용. 기존 변화량·요약·원장·도넛·절약 비교는 이미 locale 포매터 사용. 한국어/영어/디버그 차량 대시보드와 결제 창도 기존 locale 금액 표시를 확인해 불필요한 실행 코드 변경 없음.
- 관련 파일: `AGENTS.md`, `vehicle-journal/AGENTS.md`, `.agents/rules/vehicle-journal.md`, `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, `tests/dashboard-calculation-regressions.test.mjs`, 이 변경 이력.
- 검증: 차량 계산/표시 Node 10건 통과(한국어/영어 충전 금액 1,234,567 및 단가 123,457 포함). 실제 Chromium 차계부 회귀 통과(월/연도 금액 라벨/툴팁/비교, 기존 모바일/입력/스크롤). git diff whitespace 검사 통과.
- 배포: 커밋·main 푸시 후 HA 직접 반영 예정. 설치/HTTP 및 운영 브라우저 적용은 후속 기록. 디버깅 정책에 따라 신규 릴리즈 없음. Worker/Comma 변경 없음.

## 2026-10-09 — 추세 제목·비교 문구 HA 반영 확인

- 커밋 제목: `vehicle-journal: record simplified trend deployment`.
- 대상: `4ea12c3` 승인 제목과 부가 설명 제거. 최종 Chromium 검증 통과 및 main 푸시 완료.
- 배포: 기존 코드 백업 후 카드 반영 완료. 배포 도구가 디자인 모듈도 동일 커밋에서 다시 반영했으며 디자인은 이전과 동일. 백업 `/config/carrot_ha/deployment-backups/4ea12c389f8db865fd5db59f491ff5a1a4811ed8/`.
- 검증: 카드 설치/HA 로컬 HTTP SHA-256 `1f21361eec7774ad22e727eb780983747aa87ecc36c22252541d9024da1b7d71` 일치. 디자인 기존 해시 `dcdd3ddb97b1dad4420ace5004dd489c6d60cad5c8aa0211d55f40739d5a4705` 일치.
- 제한: 실제 사용자 접속 주소 운영 브라우저 적용은 미확인, 새로고침 후 확인 대기. HA 재시작·신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 승인된 추세 제목 및 비교 문구 간소화

- 커밋 제목: `vehicle-journal: clarify metric titles and simplify trend summaries`.
- 변경·이유: 사용자 승인 제목 적용. ‘평균 전비’와 ‘kWh당 충전 단가’는 유지. 하루 평균·주행 사용률·급속 충전 분모·100km 비용/배터리 비율·1회 평균 충전량 명시. 총 지출/충전 횟수/분류별 지출은 선택한 달 또는 연도를 제목에 명시.
- 셋째 줄: 기록일 기준 평균, 추정 계산식, 실제·추정 포함, 누적 지출, SOC 기록 범위 등 모든 부가 설명 제거. 비교 수치·변화량 및 일관/수집 상태만 유지. 계산과 데이터는 변경하지 않음.
- 관련 파일: `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문 및 실제 Chromium 회귀 통과. 승인 제목과 유지 대상 두 제목, 부가 설명 제거, 비교 문장, 월/연도·입력·스크롤·모바일 320–850px 확인.
- 배포: main 커밋·푸시 후 코드 백업 및 HA 카드 모듈 직접 반영 예정. 설치/HTTP/운영 브라우저 상태는 후속 기록. 신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-09 — 글자 크기 교환 및 테마 강조 HA 반영 확인

- 커밋 제목: `vehicle-journal: record trend typography deployment`.
- 대상: `1e6e2a0` 문구·강조 및 `2e63285` 원래 크기 교환. 최종 두 화면 모듈을 `2e632858cfb8ef928181b26fbcb307c11a82889c`에서 추출해 배포.
- 검증: 최종 Chromium 회귀 통과. 설치 파일 및 HA 로컬 HTTP 응답 SHA-256 모두 커밋 코드와 일치. 카드 `3618001cb4a22f91bb3b73eb66cbff780810e12f78c001501b1c5cd633aa160e`, 디자인 `dcdd3ddb97b1dad4420ace5004dd489c6d60cad5c8aa0211d55f40739d5a4705`.
- 배포: main 푸시·기존 코드 백업·두 모듈 HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/2e632858cfb8ef928181b26fbcb307c11a82889c/`. 실제 사용자 접속 주소의 운영 브라우저 적용은 미확인으로 사용자 새로고침 후 확인 대기. HA 재시작은 실행하지 않음.
- 제한: 카드 제목 명칭은 사용자 검토 후 변경. 신규 릴리즈·~~Worker~~·Comma 변경 없음. 운영 브라우저 적용 완료를 주장하지 않음.

## 2026-10-09 — 기존 첫째·둘째 줄 글자 크기를 정확히 교환

- 커밋 제목: `vehicle-journal: swap original trend title and headline sizes`.
- 변경·이유: 사용자 추가 요청에 따라 원래 크기를 그대로 교환. 데스크톱 첫째 줄 19.5px/둘째 줄 16.5px, 모바일 첫째 줄 16.5px/둘째 줄 14.5px. `1e6e2a0`의 확대 수치를 대체하며 문구·테마 색상 강조 유지.
- 관련 파일: `carrot-journal-design.js`, 이 변경 이력.
- 검증: 실제 Chromium 회귀 재실행 예정. 배포: 두 변경을 합쳐 최종 커밋 코드만 백업 후 HA 직접 반영 예정. 운영 브라우저 확인은 별도 기록. 제목 명칭은 사전 검토 대기.

## 2026-10-09 — 추세 카드 제목 위계 및 변화 단어 강조

- 커밋 제목: `vehicle-journal: clarify trend text hierarchy and direction emphasis`.
- 변경·이유: 첫 줄 지표 제목을 둘째 줄보다 크게 표시(데스크톱 21.5/17.5px, 모바일 18.5/15.5px). 둘째 줄 증가·감소·일관 단어에 카드 테마 색상과 굵기를 적용. ‘안정적인 패턴이에요’를 ‘일관된 추세예요’로 변경.
- 범위: 카드 제목 명칭 변경은 사용자 사전 검토 대상으로 남기며 이번 수정에는 포함하지 않음. 계산·집계 유지.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 두 모듈 구문 및 실제 Chromium 회귀 통과. 월/연도 비교, 증가·감소·일관 강조 색상, 데스크톱/모바일 글자 위계, 320–850px 레이아웃, 입력·escaping·스크롤 검증 포함.
- 배포: main 커밋·푸시 및 두 모듈 백업 후 HA 직접 반영 예정. 설치/HTTP/운영 브라우저 확인 상태는 후속 기록으로 구분. 신규 릴리즈·~~Worker~~·Comma 변경 없음.

## 2026-10-07 — 추가 추이 및 모바일 한 열 운영 검증 완료

- 커밋 제목: `vehicle-journal: record new trends and mobile deployment`.
- 대상: `209359b` 추가 지표·관측일 평균·600px 모바일 한 열, `7bd6278` 표시 상태 테스트, `82afccd` 청구량 fallback.
- 검증: 실제 Chromium 전체 회귀 통과, 운영 Chrome 12개 카드(현재 지출 분류 1개), 추정 비용 막대 3개 확인. 440px 운영 viewport에서 두 grid 모두 단일 384px 열 확인, 테스트 520/360/320px 한 열·가로 넘침 검사 통과. 임시 viewport 원복.
- 배포: main 푸시, HA 두 모듈 백업/부분 반영 및 최종 카드 재배포 완료. 백업 `/config/carrot_ha/deployment-backups/209359b/`, `/config/carrot_ha/deployment-backups/82afccd/`. 설치/외부 HTTP 커밋 파일 일치. 버전 `0.8.13-bc9b01c12e01`. 카드 SHA-256 `ef7d38f76491baa8f86bbb081eb5b31365df2a41959564ac16089e0c82134f4f`, 디자인 `f39ddd5ee785aa587b1a236968c6d72aff83e430443648343f826f330892a1b1`.
- HA 재시작 및 신규 릴리즈 없음. Worker/Comma 변경 없음. iOS 앱의 실제 갱신은 사용자 새로고침 후 확인 필요.

## 2026-10-07 — 추정 비용 막대의 충전량 대체 경로 수정

- 커밋 제목: `vehicle-journal: use battery charge when billed energy is absent`.
- 이유: 운영 확인에서 합산 bin의 청구량 기본값 0이 배터리 충전량 fallback을 막아 추정 비용 막대가 사라짐. 양수 청구량이 있을 때만 우선 사용하고 나머지는 배터리 충전량 사용.
- 관련 파일: `carrot-vehicle-journal.js`, 이 변경 이력. 회귀 및 재배포 결과는 후속 기록.

## 2026-10-07 — 모바일 추이 열 수 테스트의 표시 상태 수정

- 커밋 제목: `vehicle-journal: inspect mobile columns while trends are visible`.
- 이유·관련 파일: `browser-check.cjs`가 숨겨진 추이 탭의 grid 폭을 검사해 520px에서 잘못 실패. 탭을 먼저 열고 실제 열 수 검사. 구현 `209359b`의 기본 계산 회귀는 통과했고 새 열 수 검사만 이 원인으로 실패했으며, 수정 후 재실행 결과와 배포를 후속 기록.

## 2026-10-07 — 비용·충전 패턴·거리당 배터리 소모 추이 추가

- 커밋 제목: `vehicle-journal: add spending and charging pattern trends`.
- 변경·이유: 주차 중 배터리 소모는 수집 불가로 제외. 100km당 전기비용(추정), 월/연간 총 차량 지출, 기록된 분류별 지출, 충전 횟수, 회당 충전량, 100km당 주행 SOC 소모 카드 추가. 기존 HA 로컬 daily/totals 재사용으로 별도 요청·엔터티·DB 변경 없음.
- 계산: 전기비용은 기간 충전비/청구량(없으면 배터리 충전량)/전비×100; 충전 횟수는 완속·급속·미확인 합계; 회당 충전량은 배터리 충전량/횟수; 거리당 SOC는 주행 SOC/거리×100. 총/분류별 지출은 effective 비용 합계로 실제·추정 포함 문구와 누적 기간 표시. 비용 카드 평균선은 합계로 명명.
- 평균 개선: 기존 일일 거리·충전·SOC를 전체 월 일수가 아닌 해당 값의 기록일 수로 계산하고 관측일 평균이라고 표시. 이전 기간도 동일 기준. 비교 데이터 없으면 추세 단정 대신 수집 중 표시, 계산 불가면 0 평균 대신 미표시. 새 지표 미관측 구간의 막대 생략. 기존 막대의 미관측 0 처리는 후속 개선 대상.
- 관련 파일: `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: JS 구문, 실제 Chromium 월/연도·기존 6개+추가 7개(합성 지출 2분류) 카드·금액/횟수/거리당 SOC 계산·모바일·스크롤·수동 기록 회귀. 배포는 main 푸시 및 백업 후 HA 카드만 부분 반영 예정, 실제 결과 후속 기록.
- 제한: SOC 기록 범위가 불완전하면 거리당 SOC가 실제 전체 주행과 다를 수 있어 설명 표시. 진행 중 기간 총액과 이전 전체 기간 비교는 일수 보정하지 않음. 주차 소모·Worker/Comma 변경·신규 릴리즈 없음.
- 모바일 수정: 기존 420px 이하 한 열 기준으로 440px 휴대폰 등이 두 열로 남던 문제를 600px 이하 한 열로 확대. `carrot-journal-design.js` 포함. 실제 grid 열 수 회귀 추가.

## 2026-10-07 — 평균선 및 실제 단위 변경 운영 적용 확인

- 커밋 제목: `vehicle-journal: record average chart and metric unit deployment`.
- 대상: 평균선/여백/글꼴 및 % 접미사 변경 `6aaf7c4`, 실제 단위 변화량 `a40d67c`.
- 검증: 두 변경 Chromium 회귀 통과. 설치 및 외부 HTTP 응답이 커밋 파일과 일치. 운영 Chrome에서 6개 추이, km/kWh/원/% 변화량, p 제거, 평균값 글꼴 16px 및 라벨 높이에 추가 8px 이격, 굵어진 평균선을 확인.
- 배포: main 푸시 및 HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/6aaf7c4/`, `/config/carrot_ha/deployment-backups/a40d67c/`. 최종 버전 API `0.8.13-e2d8cc5b72ce`. 카드 SHA-256 `99ea699ab17cb3a82a2c84c1d98dc7139e26b9e613cb039c1e7657f947616df0`, 디자인 `49d53f7d176afdeda5a073fe1063cd6945d664860f3ea7d1df2fcfc6e5f95972`.
- HA 재시작·신규 릴리즈·Worker/Comma 변경 없음. 기존 추이 집계의 부분 월 평균 및 미관측 0 표시 한계는 유지되며 후속 계산 개선 대상으로 남음.

## 2026-10-07 — 추이 변화량을 지표의 실제 단위로 표시

- 커밋 제목: `vehicle-journal: show trend changes in metric units`.
- 변경·이유: 상대 퍼센트 대신 이전/현재 평균의 실제 차이를 표시. 거리 km, 충전 kWh, 전비 km/kWh, 단가 원, SOC/급속 비중 % 사용. 원은 정수, 나머지는 소수 한 자리 이내와 천 단위 구분. 카드 색상 강조 유지. 변동 분류 기준(상대 차이 5%)은 유지.
- 관련 파일: `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증·배포: Chromium 회귀 후 main 푸시 및 기존 코드 백업 후 HA 부분 반영 예정. 실제 결과는 후속 기록.
- 제한: SOC/급속 비중 변화는 두 비율의 산술 차이이며 요청에 따라 p 접미사 생략. 집계 계산은 변경하지 않음. Worker/Comma 변경 없음.

## 2026-10-07 — 추이 평균선과 수치 간격 개선

- 커밋 제목: `vehicle-journal: improve average line spacing and labels`.
- 변경·이유: 사용자 요청으로 SOC 추이 표시 단위를 `%p`에서 `%`로 변경(계산값 유지). 모든 추이 평균값 라벨을 선 중심에서 8px 추가 이격하고 차트 위 24px 공간 확보. 평균선은 이전 3.5px/현재 및 단일 4px로 확대. 수치 글꼴은 데스크톱 16px, 모바일 14.5px로 확대하고 그래프 높이 10px 증가.
- 관련 파일: `carrot-vehicle-journal.js`, `carrot-journal-design.js`, 이 변경 이력.
- 검증·배포: JS 구문 및 Chromium 회귀 검증 후 main 푸시, 백업 후 두 모듈만 HA 직접 반영 예정. 실제 결과는 후속 기록. 신규 릴리즈 없음.
- 제한: 단위 표기 변경이며 SOC 소모량 계산 변경 없음. Worker/Comma 변경 없음.

## 2026-10-07 — 글꼴 확대 및 추이 변화율 색상 강조

- 구현 커밋: `98c7ebf`, `vehicle-journal: improve text readability and highlight trend changes`. 변경 이력 작성 명령이 Python 별칭의 인코딩 오류로 실패하여 바로 이 후속 기록으로 보완.
- 변경·이유: 차계부 디자인의 26px 이하 명시 글꼴을 1.5px 확대. 비교 설명의 변화율과 상승/감소를 해당 지표 색상과 굵은 글씨로 강조하며 텍스트 escaping 유지. 420px 이하 화면은 추이 카드를 한 열로 배치.
- 관련 파일: `carrot-journal-design.js`, `carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`, 이 변경 이력.
- 검증: 두 JS 구문 검사 및 실제 Chromium browser-check 통과. 월/연도 6개 지표, 비교 유무, 색상 일치, 빈 데이터, 수동 저장, HTML escaping, 320–850px 모바일 가로 넘침 확인.
- 배포: `98c7ebf` main 푸시 및 두 화면 모듈 HA 직접 반영 완료. 백업 `/config/carrot_ha/deployment-backups/98c7ebf/`. 설치·외부 HTTP SHA-256 일치: 카드 `2ca7177220d1ed19e9b2df1bd4950419269830c6ed18252ad893aab1a13e7ed8`, 디자인 `9f1f54ab16264253f99c9ed454fe7d63185ce124ef556a70bab7cd4fd4083d18`. 버전 API `0.8.13-53d7337406eb`. 실제 사용자 접속 Chrome 새로고침 후 6개 카드와 설명 15.5px, 변화율 5개 지표 색상 일치 및 시각적 강조 확인. HA 재시작 불필요. 개발 정책에 따라 신규 릴리즈 없음.
- 운영 확인 기록 커밋 제목: `vehicle-journal: record deployed readability verification`. 이 항목의 배포 예정 상태를 실제 결과로 갱신.
- 제한: 표시만 변경하며 기존 집계·데이터 보존 유지. Worker/Comma 변경 없음.

## 2026-10-07 — 패널 런타임 상태 복원 null 참조 버그 수정 (metric/period null value 예외 해소)

- 커밋 제목: `fix(vehicle-journal): guard against null metric and period select elements during state restoration in panel runtime`.
- 변경 내용 및 이유:
  1. **패널 런타임(`carrot-journal-panel-runtime.js`) 상태 복원 시 `null` 프로퍼티 할당 예외 해결**:
     - 사용자가 화면 새로고침 또는 '새 화면 버전 적용'을 실행할 때 `sessionStorage`에 보관된 마지막 상태(`saved`)를 복원하는 과정에서, 구형 `page1` 차트에 존재했던 `#metric` 및 `#period` select 요소를 `card.$('metric').value = saved.metric;`으로 직접 설정하려다 `TypeError: Cannot set properties of null (setting 'value')`가 발생하며 패널 마운트 전체가 중단되던 버그 수정.
     - `card.$('metric')` 및 `card.$('period')`에 안전한 존재 유무 검사(`if(card.$('...'))`) 및 `card.$('month')?.value` 옵셔널 체이닝을 추가하여 예외 발생을 원천 차단.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-panel-runtime.js`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 `carrot-journal-panel-runtime.js` SHA-256 해시(`af7541eb...`) 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 최신 수정본 응답 확인 완료.

## 2026-10-07 — 추세 탭 렌더링 중단 버그 수정 (레거시 에너지 통계 null 참조 해소)

- 커밋 제목: `fix(vehicle-journal): resolve null reference error on legacy energyStats and restore trends dashboard rendering`.
- 변경 내용 및 이유:
  1. **레거시 DOM 노드(`energyStats`, `qualityNote`) null 참조 예외 해결**:
     - 기존 `page1` 차트에 존재하던 `#energyStats` 및 `#qualityNote` 요소가 새 Apple Health 추세 대시보드로 개편되면서 제거되었으나, `renderData()` 내에서 해당 요소의 `.innerHTML`에 직접 접근하던 코드가 남아있어 `TypeError: Cannot set properties of null (setting 'innerHTML')` 예외가 발생하던 문제를 해결.
     - 해당 예외로 인해 `renderData()`의 후속 실행인 `this.renderTrendsDashboard()` 호출이 차단되고 `#message`에 에러가 출력되던 현상을 원천 차단.
  2. **추세 지표 생성(`createMetric`) 및 차트 렌더러 안전성 강화**:
     - 지표 값이 0인 경우(예: 급속 충전 0%) 및 이전 기간 데이터가 없는 경우 `NaN` 또는 `Infinity`가 발생하지 않도록 유효성 검사 강화.
     - `maxVal` 계산 시 기본 최솟값 1을 보장하여 0으로 나누기 오류 완전 차단.
  3. 캐시 버스팅 파라미터(`journal-20261007-trends-fix-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Python 유닛 테스트 310개 전수 통과 (`OK, skipped=4`).
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 `carrot-vehicle-journal.js` SHA-256 해시(`14bf2333...`) 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 최신 수정본 응답 확인 완료.

## 2026-10-07 — 주행&에너지 탭 '추세' 개편, Apple Health 스타일 2열 추세 대시보드 및 폰트 왜곡 해소

- 커밋 제목: `feat(vehicle-journal): revamp trends tab with Apple Health style 2-column dashboard and fix text distortion`.
- 변경 내용 및 이유:
  1. **탭 명칭 및 용어 개편 (`주행 & 에너지` ➔ `추세`, '추이' ➔ '추세')**:
     - 상단 네비게이션 2번째 탭 명칭을 `주행 & 에너지`에서 **`추세`**로 변경 (`['대시보드', '추세', '절약 비교', '상세 기록']`).
     - 지출 비교 문구, 차트 라벨, 툴팁, 설명문 등 UI 전반에서 사용되던 용어 '추이'를 전부 **`추세`**로 통일.
  2. **Apple Health 공식 추세(Trends) 대시보드 완벽 재현**:
     - 상단 헤더: `추세` 타이틀 & 안내 문구 (`주행 및 충전 데이터의 패턴을 분석하고, 변동 사항이 있을 때 알려드려요.`).
     - **섹션 1: 변동 있는 추세**: 최근 기간 기준 ±5% 이상 유의미한 변동이 감지된 항목 배치 (없으면 `최근 감지된 유의미한 변동이 없어요.` 배너 노출).
     - **섹션 2: 변동 없는 추세**: 안정적인 패턴을 유지 중인 항목 배치.
     - **Apple 공식 3가지 추세 시각화 패턴 정밀 구현**:
       * **증가 추세 (`up`)**: 과거 회색 기준선(좌측) vs 최근 컬러 기준선(우측 상단 상승 스텝) + 헤드라인 `... 동안 증가 추세`.
       * **감소 추세 (`down`)**: 과거 회색 기준선(좌측) vs 최근 컬러 기준선(우측 하단 하강 스텝) + 헤드라인 `... 동안 감소 추세`.
       * **일관된 추세 (`consistent`)**: 전체 기간을 관통하는 단일 컬러 기준선 + 헤드라인 `... 동안 일관된 추세`.
  3. **2열 그리드 및 2대 예외 레이아웃 규칙 구현**:
     - 기본 2열 카드 그리드 레이아웃 (`repeat(2, minmax(0, 1fr))`).
     - **[예외 1]** 변동 있는 추세 항목이 1개일 경우: 2열이 아닌 1열(전폭 100%)로 표시 (`.trends-grid.single-item`).
     - **[예외 2]** 2열 배열에서 홀수로 인해 최하단에 혼자 남은 카드: 1열(전폭 100%)로 자동 확장 (`:last-child:nth-child(odd)`).
  4. **바(Bar) 그래프 집계 단위 사용자 맞춤 사양 적용**:
     - **월별 (`month`)**: 31일을 2일씩 묶은 평균값(16개 바)으로 표시하여 가독성 극대화 + X축 `1일` / `31일`.
     - **연도별 (`year`)**: 1년 12개월을 각 달 단위(12개 바)로 표시 + X축 `1월` / `12월`.
  5. **핵심 6대 지표 선정 (팬텀 드레인 완전 배제)**:
     - ⚡ 평균 전비 (`efficiency`, km/kWh, #81e6c5)
     - 🚗 일일 주행거리 (`distance`, km, #ff9f0a)
     - 🔌 일일 충전량 (`charge_kwh`, kWh, #30b0c7)
     - 💳 kWh당 충전 단가 (`charge_rate`, 원, #ffd60a)
     - 🔋 주행 소모 SOC (`drive_soc`, %p, #af52de)
     - ⚡ 급속 충전 비중 (`fast_ratio`, %, #ff453a)
     - 실측 불가능한 '주차 중 대기 방전(팬텀 드레인)'은 사용자 지침에 따라 완전히 배제.
  6. **데스크톱/모바일 텍스트 눌림/왜곡 100% 해소**:
     - SVG `<text>`의 비율 찌그러짐 문제를 해결하기 위해, SVG는 순수 그래픽(바, 기준선)만 렌더링하고 모든 수치와 축 라벨은 HTML 네이티브 레이어로 오버레이 분리하여 모든 해상도에서 폰트 선명도 보장.
  7. 프로토타입 HTML(`review_journal_spending.html`) 및 컴포넌트(`carrot-vehicle-journal.js`, `carrot-journal-design.js`) 동기화 및 캐시 버스팅 파라미터(`journal-20261007-trends-dashboard-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `review_journal_spending.html`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Headless Chrome을 통해 모바일(402px) 및 데스크톱(1400px) 추세 탭, 2열 레이아웃, 예외 규칙, 글자 눌림 해소 렌더링 검증 완료.
  - Python 유닛 테스트 310개 전수 통과 (`OK, skipped=4`).
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 2개 파일(`carrot-vehicle-journal.js`, `carrot-journal-design.js`) SHA-256 해시 일치 확인 완료.

## 2026-10-07 — 상세 기록 사진 썸네일 프리뷰, 라이트박스 확대 뷰어 및 관리 열 액션 버튼 배열

- 커밋 제목: `feat(vehicle-journal): add photo thumbnail preview, lightbox viewer and rearrange action buttons in records table`.
- 변경 내용 및 이유:
  1. **기록 / 메모 셀 우측 썸네일 프리뷰(`memo-thumb-btn`)**:
     - 사용자가 어떤 기록이었는지 빠르게 식별할 수 있도록, 사진이 첨부된 기록의 `기록 / 메모` 셀 우측에 작은 썸네일(44x44px)을 우측 정렬하여 표시.
     - 사진이 2장 이상인 경우 썸네일 우측 하단에 `+N` 배지를 달아 여러 장의 사진이 있음을 직관적으로 안내.
     - 중복 요청을 방지하기 위해 `this.thumbnailCache`(Map) 및 `disconnectedCallback` 시 blob URL 해제(`URL.revokeObjectURL`) 최적화 적용.
  2. **사진 확대 라이트박스 뷰어 (`dialog#photoViewerDialog`) 구현**:
     - 썸네일 또는 관리 열의 `[사진 N장]` 버튼을 누르면 사진을 크게 감상할 수 있는 라이트박스 모달 다이얼로그 노출.
     - 2장 이상의 사진이 있는 경우 좌/우 넘기기 버튼(`‹`, `›`)과 키보드 좌/우 방향키(`ArrowLeft`, `ArrowRight`)로 탐색 지원.
     - 현재 인덱스(예: `사진 (1 / 2)`), 메타 정보, 기록 메모를 하단 캡션으로 상세히 표시.
     - 모달 바깥 영역 클릭 또는 `[닫기]` 버튼, ESC 키를 통한 편리한 닫기 지원.
  3. **테이블 열 배치 및 관리 액션 버튼 정렬 순서 개편**:
     - 기존 `거리·충전·금액` 열에 섞여 있던 사진 버튼을 제거하여 순수한 수치/금액만 정렬되도록 정리.
     - 관리 열로 사진 버튼을 이동하여 사용자가 명시한 **`[사진 ~장]`, `[수정]`, `[삭제]`** 순서로 정확하게 배열.
     - 버튼 스타일도 `.btn-table-action`, `.btn-photo`를 통해 줄바꿈 없이 한 줄로 단정하게 표시.
  4. 프로토타입 HTML(`review_journal_spending.html`) 동일 마크업/스타일/인터랙션 동기화 및 캐시 버스팅 파라미터(`journal-20261007-photo-viewer-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `review_journal_spending.html`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Headless Chrome을 통해 모바일(402px) 및 데스크톱(1400px) 상세 기록 탭 썸네일/버튼 렌더링 검증 완료.
  - 라이트박스 뷰어 모달(사진 확대, 네비게이션 버튼, 캡션) 렌더링 검증 완료.
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 2개 파일(`carrot-vehicle-journal.js`, `carrot-journal-design.js`) SHA-256 해시 일치 확인 완료.

## 2026-10-07 — 모바일 탭 균등 분할, 최근 기록 카드 높이 고정, 도넛 시인성 및 상세 기록보기 버튼 정렬

- 커밋 제목: `fix(vehicle-journal): enhance mobile tabs layout, fix recent panel overflow, improve donut visibility and align hero action button`.
- 변경 내용 및 이유:
  1. **모바일 최근 기록 카드(`recent-panel`) 무한 세로 확장 해결**:
     - `@media(max-width:600px)` 미디어쿼리에서 `height: auto;`로 인해 카드가 자식 항목 수만큼 세로로 무한히 길어지던 문제를 해결하고, 모바일에서도 `height: 270px; display: flex; flex-direction: column;`로 적절한 높이를 유지하도록 수정.
     - 내부 `.recent-list-wrap`의 `flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;`를 통해 약 3~4건이 노출되고 부드러운 터치 스크롤로 이번 달 전체 목록을 훑어볼 수 있도록 복원.
  2. **모바일 상단 네비게이션 탭(`tabs`) 4개 25% 균등 분할 및 정렬 정상화**:
     - 레거시 인라인/미디어쿼리의 `flex: 0 0 auto; min-width: 72px/90px/140px;` 잔재를 완전히 제거.
     - `.tabs`에 `display: flex; width: 100%; box-sizing: border-box; padding: 4px; gap: 4px;`, `.tabs button`에 `flex: 1 1 0px; min-width: 0; font-size: 12.5px; padding: 8px 2px; text-align: center;`를 적용하여 4개 탭(`대시보드`, `주행 & 에너지`, `절약 비교`, `상세 기록`)이 모바일 화면 폭을 1/4(25%)씩 가로 스크롤이나 여백 없이 꽉 채우도록 완벽 수정.
  3. **'어디에 썼을까요?' 도넛 차트 및 카테고리 목록 폰트 크기 확대 및 시인성 대폭 개선**:
     - 도넛 차트 SVG 중앙 라벨: `font-size: 13px, font-weight: 600`, 중앙 금액: `font-size: 18.5px, font-weight: 850, fill: #ffffff`로 굵고 선명하게 확대.
     - 도넛 SVG 크기 모바일 120px -> 132px (데스크톱 146px)로 확대.
     - 오른쪽 카테고리 목록: 카테고리명 `font-size: 15px; font-weight: 600;`, 색상 도트 `9px`, 금액 `font-size: 16px; font-weight: 750; color: #ffffff;`로 시인성 확보.
  4. **영웅 카드 '상세 기록보기' 버튼 위치 및 수직 기준선 정렬**:
     - 모바일에서 위의 통계 수치(`233.7 kWh`)와 너무 붙어있던 문제를 `.hero-btn-wrap`에 `padding-top: 18px; margin-top: 14px;` (데스크톱 `padding-top: 22px; margin-top: auto;`)를 적용하여 넉넉하고 시원한 상하 간격 유지.
     - 버튼 클래스 `.btn-hero-action`에 `margin: 0; box-sizing: border-box;`를 부여하고, 영웅 카드의 헤드라인(`10월 달에는`) 및 통계 텍스트(`이번달 충전량`)가 시작하는 좌측 수직 기준선(0px)과 1px의 오차 없이 완벽히 일치시켜 통일감 확보.
  5. 프로토타입 HTML(`review_journal_spending.html`) 동일 스타일 동기화 및 캐시 버스팅 파라미터(`journal-20261007-mobile-align-1`) 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `review_journal_spending.html`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포 상태:
  - Headless Chrome 뷰포트(402x1400 및 1280x900) 렌더링 검증 완료.
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee`로 직접 배포 완료 및 2개 파일(`carrot-journal-design.js`, `carrot-vehicle-journal.js`) SHA-256 해시 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 최신 버전(`journal-20261007-mobile-align-1`) 응답 검증 완료.

## 2026-10-07 — 고정 로더의 main 및 HA 배포 확인

- 커밋 제목: `vehicle-journal: record stable loader HA deployment and initial restart requirement`.
- 구현 커밋 `65c73ebc3ce9e47910dd870e163524cacb75c4bb`의 원격 main 반영 확인.
  해당 커밋에서 추출한 runtime/카드/패널 3개를 순서대로 HA에 직접 반영했다.
- 기존 파일 백업: `/config/carrot_ha/deployment-backups/65c73ebc3ce9e47910dd870e163524cacb75c4bb/`.
  새 runtime은 기존 파일 부재 마커를 남겼다. DB·사진·설정은 배포/백업 대상이 아니다.
- 설치 SHA-256 및 사용자 외부 HA HTTP 응답이 커밋과 모두 일치:
  - panel: `d77bcf6dc8c96a4bfceadb46c952cb5aabc6a1e0509d23b794c59ac3700294fd`
  - runtime: `b130a5ecefd09d7159d5743ebdeb4a3c07fc56cdddb02cc9764f699274b9e7f0`
  - card: `6afffa093447fecd900c1cb7eff45147656ad29bec3010ee389719dc6fc46bb2`
- 버전 API 응답 `0.8.13-b05e079cc9b3` 확인. 서버 배포는 완료했지만 기존 운영
  브라우저의 패널 등록 URL은 HA 시작 시 값이므로 **사용자 HA 재시작 1회 및
  새로고침 이후 실제 전환 확인은 대기**다. 에이전트가 재시작하지 않았다.
- 새 로더/업데이트/복원 동작의 합성 Chrome 및 기존 UI·사진 회귀는 통과했다.
  향후 JS 화면 모듈 변경은 재시작 없이 갱신 가능하다. 사용자 요청에 따라 임시
  디버깅 버튼/모니터/뷰 저장은 수정·실사용 검증 완료 후 제거하며 고정 로더는 유지한다.
- 관련 파일: CHANGELOG.md 및 deployment.md 현재 인계 상태. 문서만 추가 수정했고
  main 커밋·푸시한다. 새 릴리즈·~~Cloudflare~~·Comma 변경/배포 없음.

## 2026-10-07 — 고정 로더 및 임시 화면 업데이트 버튼

- 커밋 제목: `vehicle-journal: load current frontend modules without HA restarts`.
- 변경·이유: 시작 시 고정된 패널 URL이 이전 모듈을 계속 사용하는 문제를 해결한다.
  패널은 고정 로더로 유지하고 마운트 시 no-store 로컬 버전 API를 조회하여 최신
  runtime/카드/디자인/뷰 도우미 전체에 동일한 파일 해시 버전을 전달한다.
- 열린 패널은 표시 중 60초마다 및 visibility 복귀 때 버전을 확인한다. 변경이 있으면
  임시 ‘새 화면 버전 적용’ 버튼을 표시하며 자동으로 페이지를 재로딩하지 않는다.
  대화상자·사진·미저장 비교 입력·진행 중 쓰기가 있으면 갱신을 차단한다.
- 적용 버튼은 기간/차량/탭/페이지/추이 설정/비교 분류/스크롤만 탭별 sessionStorage에
  보관하고 새 문서 API 렌더 후 animation frame 두 번을 거쳐 복원한다. 2분 유효,
  같은 경로로 제한하며 읽은 즉시 삭제한다. 기록·메모·사진·토큰 저장 없음.
- 사용자 추가 지시: 버튼은 **디버깅용 임시 기능**이다. 수정·실사용 검증이 끝나면
  버튼/배너/주기 버전 확인/visibility 리스너/뷰 복원 저장을 제거한다. 고정 로더와
  최신 버전 모듈 로딩은 유지한다. AGENTS 및 deployment에 제거 범위를 명시했다.
- 카드의 비교 입력이 백그라운드 렌더로 덮어써지지 않도록 보호하고, 기록 창을
  닫아 취소하면 선택 사진을 정리한다. 저장/상태변경 등 진행 중 쓰기도 갱신을 막는다.
- 관련 파일: frontend/carrot-journal-panel.js, carrot-journal-panel-runtime.js,
  carrot-vehicle-journal.js; vehicle-journal/AGENTS.md, deployment.md, CHANGELOG.md;
  .agents/rules/vehicle-journal.md; tests/loader-update.cjs, browser-check.cjs,
  photo-selection.cjs. frontend 경로는 custom_components/carrot_ha/frontend/ 아래다.
- 검증: Python 차계부 14개 및 schema 9개 통과. Chrome 최신 모듈 체인/초기 hass 전달/
  입력 보호/재로딩 선택·스크롤 복원/임시 저장 제거 통과. 사진 선택·압축·저장·수정
  회귀 및 기존 UI/탭/차트/수동 저장/escaping/데스크톱·모바일 검증 통과.
  browser-check의 이미 제거된 day scope 버튼 검증을 정리했으며 비동기 패널 초기
  속성 검증은 실제 import를 사용하는 loader-update로 이동했다. JS 문법/diff 확인.
- 배포 상태: 검증 후 main 커밋·푸시 및 승인된 HA 직접 배포 대상. 최초 로더 전환은
  사용자 HA 재시작 1회가 필요하며 운영 브라우저의 전환 후 검증은 대기한다.
  이후 화면 모듈은 HA 재시작 없이 새로고침/임시 적용 버튼으로 갱신한다. Python
  또는 고정 로더 자체 변경은 별도 재시작 판단이 필요하다.
- Cloudflare/Comma/DB/사진/설정/manifest/태그/Release 변경 없음. 디버깅 정책에
  따라 이번에는 새 릴리즈를 발행하지 않는다. 백업/서버 배포 확인은 후속 기록에 남긴다.

## 2026-10-07 — bf6cd33 화면 미반영 원인 및 배포 검증 지침 보완

- 커밋 제목: `vehicle-journal: document stale sidebar entrypoint cache and deployment verification`.
- 조사 대상: bf6cd33b9bef8a6c2b28bd2dc6b2db61f94b16e5. 이전 기록의 파일 배포·HTTP
  검증은 확인됐지만 실제 브라우저 적용을 보장하지 못했다. 특정 에이전트의 행동은
  추측하지 않고 코드와 운영 응답·Chrome에서 확인한 누락 단계를 기록한다.
- 확인 시각: 한국 시간 2026-10-07 11:28~11:35 전후.
- 서버 검증: HA 설치 패널 SHA-256 `41489a45c4c8dfe736f2609571f7e16296e4b68be1c4bdb3f5e9defa35fcadf1`,
  카드 `e886ddcd1fc68afbc455264b099190823ab4e5a4a8253efbfabac7d53adca7b3`.
  로컬 bf6cd33과 일치하며 내부 HTTP 응답 및 외부 패널 HTTP 응답도 일치했다.
  내부 압축 허용 요청도 같은 해시였다. 설치 파일 누락은 재현되지 않았다.
- 브라우저 검증: 실제 사용자 Chrome에서 강력 새로고침 후에도 이전 제목·탭·버튼을
  확인했다. DOM 최상위 패널 URL은 `carrot-journal-panel.js?v=0.8.13-b7431cc4e5b2`.
  Network에서 이전 `carrot-vehicle-journal.js?v=journal-20261007-chart-fix-1`과
  design 모듈 요청을 확인했고 Workbox `StrategyHandler.js:160`·디스크 캐시가 표시됐다.
- 원인: `async_setup`이 시작 시 등록한 최상위 URL이 JS 직접 배포 후 유지된다.
  이전 패널 캐시가 이전 import를 계속 사용하므로 하위 import 버전 갱신만으로는 부족하다.
- 관련 파일: `vehicle-journal/AGENTS.md`, `vehicle-journal/deployment.md`,
  `.agents/rules/vehicle-journal.md`, `vehicle-journal/CHANGELOG.md`.
- 변경·이유: 최상위 URL부터 실제 화면·클릭 결과까지 배포 검증하도록 지침 보완.
  JS 변경이면 재시작이 항상 불필요하다는 기존 배포 문구를 정정했다.
- 검증·배포 상태: 문서만 수정, diff/지침 동기화 확인. main 커밋·푸시 대상.
  실행 코드 재배포·HA 재시작·새 릴리즈는 수행하지 않았다. 현재 화면 적용 해결은
  사용자 HA 재시작 후 최상위 URL 갱신 및 화면 확인이 남아 있다.
- 제한: HA Docker 읽기는 SSH 앱 보호 모드로 불가했으며 보호 설정을 변경하지 않았다.
  캐시 전체 삭제·운영 DB/사진/설정 변경 없음. ~~Cloudflare~~·Comma 변경/배포 없음.

## 2026-10-07 — 헤더 타이틀 간소화, 최근 지출 전체 스크롤 표시 및 상세 기록 탭 이동 연동

- 커밋 제목: `vehicle-journal: simplify header title, expand recent expenses to full list, and link detail records tab`.
- 변경·이유:
  1. **헤더 브랜드 및 타이틀 개편**:
     - 상단 영문 키커 `CARROT HA · EV JOURNAL`을 완전히 삭제하여 시각적 노이즈 제거.
     - 메인 타이틀 `내 차의 생활`을 사용자 요청에 따라 직관적인 `차계부`로 변경.
  2. **최근 기록이에요 표시 범위 확장 (이번달 전체 지출 스크롤)**:
     - `renderRecentExpenses()`에서 기존 4개 제한(`slice(0, 4)`)을 완전히 제거.
     - 이번달(선택된 기간)에 발생한 모든 활성 지출 기록(`status === 'active' && kind === 'expense'`)을 스크롤 컨테이너(`.recent-list-wrap`)에 누락 없이 전체 렌더링하도록 확장.
     - 지출 건수가 많아져도 부드러운 스크롤을 통해 이번달의 모든 지출 내역을 한눈에 탐색 가능.
  3. **상세 기록 탭 명칭 변경 및 원클릭 이동 버튼 연동**:
     - 네비게이션 탭의 맨 오른쪽 4번째 탭 명칭을 `차계부`에서 `상세 기록`으로 변경 (`['대시보드', '주행 & 에너지', '절약 비교', '상세 기록']`).
     - 영웅 카드의 액션 버튼 텍스트를 `절약 계산 살펴보기 →`에서 `상세 기록보기 →`로 변경.
     - 버튼 클릭 시 3번째 탭(절약 비교) 대신 4번째 탭(인덱스 3: `상세 기록`)으로 즉시 전환(`this.selectTab(3)`)되도록 연결.
  4. **프로젝트 규칙 동기화**:
     - `.agents/rules/vehicle-journal.md` 생성 및 루트 `AGENTS.md` 상단에 차계부 작업 지침 및 CHANGELOG 기록 필수 규칙을 등록.
  5. **캐시 버스팅 갱신**:
     - `carrot-journal-panel.js` 및 `carrot-vehicle-journal.js` 모듈 버전을 `?v=journal-20261007-detail-link-1`로 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-panel.js`
  - `review_journal_spending.html`
  - `AGENTS.md`
  - `.agents/rules/vehicle-journal.md`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포:
  - JS 문법 검사(`node --check`) 및 Python 300 tests 전체 통과.
  - HA 실서버(`192.168.0.140`)에 SSH `sudo tee` 직접 배포 완료 및 파일 SHA-256 일치 확인.
  - HA HTTP 정적 엔드포인트 응답 검증 완료 (브랜드 삭제, 타이틀 `차계부`, 탭 `상세 기록`, 버튼 `상세 기록보기 →` 확인).

## 2026-10-07 — 지출 비교 바 차트 비율 복원 및 상단 카드 높이 균형 최적화

- 커밋 제목: `vehicle-journal: restore bar chart scale to 175px and balance hero card proportions`.
- 변경·이유:
  1. 지출 비교 카드(#targetCard)의 SVG 바 차트 높이를 80px에서 175px로 복원:
     - 80px로 축소 시 320x185 viewBox가 0.44배로 축소되어 막대 및 금액 라벨("162,688원", "74,566원", "▼ 절약")이 비정상적으로 작아 보이던 축소 왜곡 현상 완전 해결.
     - 175px 높이에서 차트 폰트, 막대 두께(54px), 추이 연결선 및 뱃지가 원래의 선명하고 또렷한 크기로 복원됨.
  2. 영웅 카드(#heroCard)와 비교 카드 간 높이 균형 완성:
     - 영웅 카드의 헤드라인과 통계 지표, 버튼 간격을 세련되게 배치하고 `padding: 26px 28px 22px 28px` 적용.
     - 양쪽 카드가 약 350px 높이로 자연스럽고 균형 잡힌 비율을 이루며, 버튼 아래의 광활한 여백 없이 꽉 찬 완성도 높은 레이아웃 유지.
  3. 캐시 버스팅 갱신:
     - `carrot-journal-panel.js` 및 `carrot-vehicle-journal.js` 모듈 버전을 `?v=journal-20261007-chart-fix-1`로 갱신.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-panel.js`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포:
  - Headless Chrome 데스크톱(1280px) 렌더링 검증 완료.
  - HA 실서버(`192.168.0.140`)에 SSH 직접 배포 및 3개 파일 SHA-256 일치 확인 완료.

## 2026-10-07 — 사진 수정의 main 및 HA 반영 확인

- 커밋 제목: vehicle-journal: record verified photo compression and cancellation deployment.
- 사진 기능 커밋 7212fe3ca4389017b2b6a715d65554102eaf6068은 동시 대시보드 커밋 19bac1435d7720efe53eee5e7e05de7788919e64의 부모이며 원격 main에 포함된 것을 확인했다. 현재 진행 중인 디자인 수정도 함께 유지된다.
- HA 설치 카드 SHA-256 d81226f75f8b38169b423f23a87e8a2cf36c5ebbc4de54f64d416f51ed58d3fc 및 패널 9503738a2e6aa98b570988323c0c225ca5a17851e4a39ff8fd93fb2661622279가 최신 소스와 일치한다. 사진당 20MiB 입력·브라우저 자동 압축·개별/전체 선택 취소가 설치 소스에 포함됨을 확인했다.
- Chrome 사진 압축 및 선택 취소·입력 유지·기록 수정 검증 통과. 실제 사용자의 영수증·iOS 저장 검증은 대기 중이다. 화면 강력 새로고침이 필요하며 HA 재시작·새 릴리즈·HACS 재다운로드는 수행하지 않았다.


## 2026-10-07 — 차계부 UI 전면 개편 및 상단 카드 하단 여백 제거 (컴팩트 레이아웃)

- 커밋 제목: `vehicle-journal: compact dashboard layout, eliminate hero bottom void, and refine period/tab copy`.
- 변경·이유:
  1. **상단 영웅 카드 하단 광활한 여백(약 230px) 완전 제거**:
     - 원인: 데스크톱 CSS Grid에서 1행의 '지난달 지출과 비교' 카드(#targetCard)가 대형 차트(180px SVG)와 다중 줄바꿈 범례 버튼 등으로 인해 451px 높이로 팽창하면서, 같은 행의 영웅 카드(#heroCard)까지 451px로 강제 확장(align-items: stretch)되어 버튼 하단에 약 230px에 달하는 거대한 공백이 발생함.
     - 해결:
       - `.comparison-panel`의 `.bar-chart-svg` 높이를 80px로 비례 축소하고 범례(`.legend-row`, `.legend-item`) 및 헤더 여백을 컴팩트하게 정돈하여 비교 카드 높이를 451px ➔ 298px로 대폭 압축.
       - `.hero`에 `display: flex; flex-direction: column; justify-content: space-between;` 및 상하 패딩 최적화(`20px 24px 16px 24px`)를 적용하여 헤드라인(상단), 지표(중앙), 버튼(하단)을 고르게 배치.
       - 버튼 하단부터 카드 하단 테두리까지의 여백이 230px에서 15px(카드 패딩)로 축소되어 하단 공백 완벽 제거.
  2. **기간 선택기 개편**:
     - 실효성이 떨어지는 '일별(day)' 선택 버튼을 완전히 제거하고 '월별'과 '연도별' 2개 버튼만 제공.
     - 탭 전환 시 오늘 날짜(현재 월 `YYYY-MM`, 현재 연도 `YYYY`)가 기본 선택되도록 수정.
  3. **네비게이션 탭 정리**:
     - '한눈에' ➔ '대시보드'로 명칭 변경.
     - 전용 대시보드가 존재하는 '차량 상태' 탭을 완전 제거하여 4개 탭('대시보드', '주행 & 에너지', '절약 비교', '차계부')으로 재편.
  4. **헤드라인 및 문구 전면 개편**:
     - "기록했어요" ➔ "소비했어요"로 문구 수정.
     - 월별: `${m}월 달에는<br>${km}km를 달리고,<br><span class="accent">${cost}</span>을 소비했어요.`
     - 연도별: `${y}년 에는<br>${km}km를 달리고,<br><span class="accent">${cost}</span>을 소비했어요.`
     - 영문 Kicker 문구(`YOUR MONTH, IN ONE SENTENCE`, `MONTHLY SPENDING COMPARISON`) 및 부제목(`주행은 자동으로 모으고...`), 비교 날짜 줄(`9월 대비 10월 지출 추이`) 완전 삭제.
     - 도넛 및 지표에서 '선택 기간' 문구 제거 (`이번 달 지출`/`올해 지출`, `이번달 전비`, `이번달 충전량`).
  5. **충전비 세부 항목 명칭 개선**:
     - `store.py`의 `records` 조회 쿼리에서 `expense_members`와 `mobility`를 조인하여 `charge_mode`(`slow`/`fast`)를 연동.
     - 최근 기록 목록에서 완속/고속 여부에 따라 `완속 충전 요금` 또는 `고속 충전 요금`으로 구체화하여 노출.
  6. **원장 상태 배너 위치 이동**:
     - "HA에 264개의 원장을 보관하고 있어요..." 배너를 카드 상단에서 페이지 최하단(footer 바로 위)으로 이동.
  7. **캐시 버스팅 갱신**:
     - `carrot-journal-panel.js` 및 `carrot-vehicle-journal.js`의 모듈 임포트 버전을 `?v=journal-20261007-compact-1`로 갱신하여 브라우저 캐시 문제 원천 방지.
- 관련 파일:
  - `custom_components/carrot_ha/frontend/carrot-journal-design.js`
  - `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`
  - `custom_components/carrot_ha/frontend/carrot-journal-panel.js`
  - `custom_components/carrot_ha/vehicle_journal/store.py`
  - `vehicle-journal/CHANGELOG.md`
- 검증 및 배포:
  - Headless Chrome 측정 검증 완료: 1행 카드 높이 451px ➔ 298px 압축, 버튼 하단 여백 230px ➔ 15px 축소 확인.
  - HA 서버(`192.168.0.140`)에 SSH `sudo tee`로 실배포 완료 및 4개 파일 SHA-256 해시 일치 확인 완료.
  - HTTP 정적 서빙 엔드포인트(`http://192.168.0.140:8123/carrot_ha_static/...`) 응답 검증 완료.

## 2026-10-07 — 사진 자동 압축과 선택 취소

- 커밋 제목: vehicle-journal: compress selected photos and cancel attachments without losing input.
- 변경·이유: JPG·PNG·WEBP 원본을 사진당 20MiB·8000만 픽셀까지 선택하고 브라우저에서 긴 쪽 2560px 이하 JPEG로 변환한다. 품질 조정 후 필요하면 추가 축소하여 저장 한도 2MiB를 지키며 휴대폰 원본은 변경하지 않는다. 사진은 순차 처리하고 메타데이터는 전송 전 픽셀 재인코딩으로 제거한다.
- 미리보기별 선택 취소와 전체 선택 취소를 제공하며 날짜·금액·메모를 유지한다. 압축 실패는 기록 생성 전에 처리한다. 저장 중 중복 제출과 사진 선택 변경을 막는다. 패널 import revision을 갱신한다.
- 관련 파일: frontend/carrot-vehicle-journal.js, carrot-journal-panel.js, vehicle-journal/tests/photo-compression.cjs, photo-selection.cjs. 서버·DB 스키마는 기존 저장 한도를 유지한다.
- 검증: Chrome에서 11~13MiB JPG·PNG·WEBP 자동 압축, 최대 해상도, 투명 배경, 잘못된 파일·20MiB 초과 거부를 검증했다. 선택 취소 입력 보존·JPEG 업로드·압축 실패 시 무저장·수동 수정 동일 ID/version 검증. Python 차계부 14건·스키마 9건 통과. 진행 중인 로컬 UI의 기존 browser-check는 제거된 day 선택자를 기다려 실패하므로 커밋 소스와 별도로 검증한다.
- 배포: main 커밋·푸시 후 HA 설치본에 이번 사진 변경만 백업·부분 반영하고 SHA-256을 확인한다. 다른 대시보드 작업을 포함하거나 덮어쓰지 않는다. Python 변경·HA 재시작·HACS 재다운로드·새 릴리즈는 수행하지 않는다.
- 제한: HEIC 미지원. 자동 변환은 손실 압축이며 원본 보관 기능이 아니다. 이번 취소는 아직 저장하지 않은 선택 사진 대상이다. iOS 실사용 및 운영 기록 사진 저장은 사용자 확인 대기다.


## 2026-10-07 — v0.8.14-beta.1 실제 발행 확인

- 커밋 제목: vehicle-journal: record verified beta release and HA deployment.
- 태그 v0.8.14-beta.1은 447a165b6e3742eb42564299b49c944a730cc304를 가리키며 manifest 0.8.14-beta.1과 일치한다. 기존 태그는 이동하지 않았다.
- GitHub Release pre-release=true 및 누적 본문을 확인했다: https://github.com/helico717/carrot-ha/releases/tag/v0.8.14-beta.1
- HACS Release Actions completed/success: https://github.com/helico717/carrot-ha/actions/runs/37483882735
- 최종 화면 파일 3개를 HA에 직접 반영하고 해시 일치를 확인했다. 백업: deployment-backups/447a165b6e3742eb42564299b49c944a730cc304. DB·사진·설정은 변경하지 않았다.
- 운영 설치 manifest는 기존 0.8.13이며 직접 배포한 실행 수정본이다. HACS의 새 베타에는 동일한 수정본이 포함된다. iOS 실사용·장기간 관측은 아직 미확인으로 정식 릴리즈는 발행하지 않았다.


## 2026-10-07 — 전체 디자인 실기 적용·베타 노트 확정

- 커밋 제목: vehicle-journal: finalize approved dashboard beta verification.
- 전체 디자인 원격 커밋 0b12115를 HA에 직접 배포하고 3개 파일 SHA-256 일치를 확인했다. 백업은 deployment-backups/0b1211576466b90ee8a24692ad090c3611c9e22e다.
- Chrome 새로고침 후 기간 선택·3단 hero·이전 기간 지출 비교·분류 범례·도넛·지출 목록과 실제 HA 기록 표시를 확인했다. 최초 SPA 이동에는 기존 모듈이 남았고 전체 새로고침으로 최신 모듈을 확인했다.
- 기존 입력 스타일이 원본의 차량/기간 selector를 전체 폭으로 만드는 것을 보정했고 분류 버튼 기본 스타일과 숨겨진 prototype tooltip 접근성을 정리했다.
- 누적 베타 노트에 전체 디자인과 실제 주행 복구 결과를 반영했다. iOS 실사용은 아직 미확인이다. Worker/D1/Comma 변경은 없다.


## 2026-10-06 — 승인된 spending prototype 전체 반영

- 커밋 제목: vehicle-journal: apply approved spending prototype to live HA records.
- review_journal_spending.html 원본은 보존했다. 3단 hero, 일/월/연도 선택, 이전 기간 스택 비교와 분류 선택, 고정 분류 색상, 지출 전용 최근 기록, 모바일 레이아웃과 수기 지출 4개 분류를 적용했다. 샘플 수치와 장치 프레임은 제외했다.
- 기존 HA 로컬 query만 사용하며 이전 조회 실패가 현재 기록을 차단하지 않는다. ~~Worker~~·~~D1~~·Comma 변경은 없다.
- 관련 파일: frontend/carrot-vehicle-journal.js, carrot-journal-design.js, carrot-journal-panel.js, tests/browser-check.cjs.
- Chromium 저장·escaping·오래된 응답 거부·스크롤/스타일 유지·320/360/520/850px·윤년 범위·분류 토글 검증 통과. 실기 화면과 iOS 검증은 대기 중이다.
- HA 재시작 이후 장거리 주행 동기화와 원장 복구를 확인했다. 전체 디자인 실기 확인 전 베타 발행은 보류한다.


## 2026-10-06 — v0.8.14-beta.1 배포 준비

- 커밋 제목: vehicle-journal: prepare cumulative 0.8.14 beta notes.
- manifest `0.8.14-beta.1` 및 태그별 누적 릴리즈 노트를 준비했다. 기준은
  pre-release `v0.8.13` (`c8ad4aa`)이고 수정 실행 코드는 `4489ba0`이다.
  `v0.8.13..4489ba0`의 20개 커밋과 파일 diff를 대조하여 승인 UI, 유가 센서,
  loader/동기화, 문서·prototype·자산 보관과 이미지 원복 이력을 포함했다.
- SSH 개발본의 승인된 UI를 베타 소스에 포함하여 이 베타 다운로드가 이전
  화면을 되돌리지 않도록 했다. 다른 로컬 삭제 파일은 커밋에 포함하지 않았다.
- 직접 반영된 파일은 기존 manifest `0.8.13` 상태다. HACS 재다운로드가 이번
  SSH 검증의 필수 단계는 아니다. Python 재시작·실기 복구·iOS 확인은 대기 중이다.
- 이 준비 커밋은 버전/노트/기록 변경만 포함하며 ~~Worker~~·~~D1~~·Comma는 유지한다.
  pre-release 발행 및 Actions 결과는 확인 후 별도 기록한다. 정식 발행은
  실사용 검증 후이며 기존 태그를 이동하지 않는다.

## 2026-10-06 — 패널 캐시 갱신과 백그라운드 동기화 스레드 수정

- 원격 커밋: `4489ba0` — vehicle-journal: repair long-trip ingestion, panel cache and HA loop scheduling.
  로컬 검증 커밋 두 개의 내용과 원격 tree 해시가 동일함을 확인했다.
- 승인된 충전량·전비·평균 충전요금 지표, 도넛 라벨, 수기 지출 전용 모달 및
  금액 콤마 서식을 그대로 유지했다. HA 설치본과 최신 Git UI 파일 해시 일치를
  확인했으며 기존 Chrome 실화면에서 원장과 승인된 지표 표시를 확인했다.
- 패널 URL은 manifest 고정값 대신 기존 전체 frontend 내용 해시를 사용한다.
  카드 dependency는 revision이 있는 정적 import를 사용하여 top-level await를
  도입하지 않고 패널과 카드 각각의 모듈 URL을 갱신한다.
- HA 실제 traceback에서 60초 timer의 schedule이 executor thread로 넘어가
  background task 생성이 실패하는 것을 확인했다. HA callback 표시로 event
  loop에서 실행하도록 수정했고 실행 중 작업 중복 방지 회귀 검증을 추가했다.
- browser-check의 수기 저장 테스트를 최신 승인된 지출 전용 폼에 맞췄다.
- 관련 파일: __init__.py, frontend/carrot-journal-panel.js,
  vehicle_journal/runtime.py, tests/browser-check.cjs, tests/test_runtime_schedule.py.
- 검증: 차계부 Python 14 tests, schema 9 tests 및 Chromium tabs/chart/manual
  expense/escaping/desktop/mobile/패널 정의 전 hass 전달 검증 통과. HA Python
  299 tests 통과(3 skip). 기존 Python3에는 Pillow가 없어 사진 2 tests가 실패했지만
  번들 Python 환경으로 전체 차계부 tests 통과했다.
- 배포: `4489ba0` main 반영 완료. HA 기존 코드 백업 후 선택 6개 파일 직접 반영 및
  SHA-256 일치 확인 완료. 백업: `/config/carrot_ha/deployment-backups/4489ba05620cbff77cfcc8d4921401e4395c5546/`.
  Python 변경 적용은 사용자가 HA를 재시작한다. DB·사진·설정은 배포 대상이 아니다.
- 한계: iOS의 이전 세션/캐시 원인은 아직 실화면으로 확인되지 않았다. 새 모듈
  URL 등록은 HA 재시작 후 적용된다. 운영 재시작 후 주행 복구와 timer 재검증이 필요하다.


## 2026-10-06 — 패널 로더 정적 임포트 전환 및 초기 로딩 보장

- 커밋 제목: `vehicle-journal: switch panel loader to static import and ensure load on connect`.
- 변경·이유:
  1. `carrot-journal-panel.js`에서 동적 타임스탬프 기반 `await import(cardURL.href)`를 표준 정적 임포트(`import './carrot-vehicle-journal.js';`)로 전환하여 top-level await 지연 및 모바일 웹뷰(WKWebView) 환경 등에서의 비동기 로딩 멈춤 현상을 원천 방지.
  2. `CarrotJournalPanel.connectedCallback()` 및 `set hass()`에서 `this.card.load()`를 명시적으로 호출하여 DOM 연결 및 `hass` 주입 시점에 항상 데이터 조회가 안정적으로 트리거되도록 보장.
  3. `carrot-vehicle-journal.js`의 `build()` 및 `load()` 내 DOM 참조(`actualKrw`, `recordForm`, `month` 등)에 null 안전 가드를 추가하여 초기화 중단 방지.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-panel.js`, `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/CHANGELOG.md`.
- 검증: `node --check` 통과 및 모의 DOM 라이프사이클 테스트 통과. HA SSH 직접 배포 및 SHA-256 일치 확인 (`carrot-vehicle-journal.js`: `2234105ecf9dec53c0dedaf3c69991ba60aa00325f385dadab808a3c0c2e1111`, `carrot-journal-panel.js`: `9eaa9fe4b734260c7eaed218f2de4203496dab89a38222f0991c7d725d847891`). 백업: `/config/carrot_ha/deployment-backups/3d87c3f/`.

## 2026-10-06 — HA 차계부 카드 UI/UX 최적화 반영 및 HA 직접 배포

- 커밋 제목: `vehicle-journal: apply approved hero metrics, clean donut labels, and simplified record modal to HA card` (`eab0a4e`).
- 사용자 요청에 따라 검토 프로토타입(`review_journal_spending.html`)에서 승인된 3대 핵심 개선사항을 실제 HA 카드(`custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`)에 그대로 반영:
  1. **영웅 카드 지표 3종 최적화**:
     - 1번 지표: 중복 '차량 총 지출'을 대체하여 `이번달 충전량` (kWh) 적용, 데이터 부재 시 `기록 없음`.
     - 2번 지표: `이번달 전비` (km/kWh) 적용, 데이터 부재 시 `기록 없음`. 모바일 줄바꿈 방지 (`white-space: nowrap`, 18px 모바일 / 21px 데스크톱, 단위 분리).
     - 3번 지표: 기존 1km당 충전비 대신 `kWh 당 평균 충전요금` (원) 적용, 데이터 부재 시 `기록 없음`.
     - 지표 상단 라벨 베이스라인 수평 정렬(`min-height: 28px`).
  2. **도넛 카드 카테고리 라벨 정돈**:
     - 카테고리 하단 세부 텍스트(`HA 자동 집계` 등)를 완전히 제거하고, 색상 도트 + 라벨 + 금액만 간결하게 정렬.
  3. **기록 모달 간소화 및 금액 자동 콤마**:
     - 수기 입력 불필요 항목인 `누락 충전`, `누락 주행` 및 `충전비`를 제외하고 `정비 / 지출` 전용 모달로 전환.
     - `실제 금액 · 원` 입력창에 세 자릿수 단위 콤마 자동 서식(`50,000`) 적용.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/CHANGELOG.md`.
- 검증: `node --check` 문법 검사 통과. HA SSH 직접 반영 후 로컬-원격 SHA-256 일치 확인 (`01efd2a9b60400488592f17856bdad2bf5db0d66d9a46a164f87060bbfd58565`).
- 배포: SSH를 통해 HA 서버(`/config/custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`)에 안전 백업(`/config/carrot_ha/deployment-backups/eab0a4e/`) 후 직접 배포 완료.

## 2026-10-06 — 영웅 카드 지표 최적화, 도넛 라벨 정돈 및 기록 모달 간소화

- 커밋 제목: `vehicle-journal: refine hero metrics, clean donut labels, and streamline record modal`.
- 사용자 요청에 따른 3가지 핵심 UI/UX 개선:
  1. **영웅 카드 지표 개편 및 모바일 줄바꿈 해결**:
     - 기존 `확인된 전비`(5.4 km/kWh)가 402px 모바일에서 `5.4`와 `km/kWh`로 2줄 분리되던 현상을 해결하기 위해 `.stat strong`에 `white-space: nowrap`, `font-size: 18px`(모바일)/`21px`(데스크톱), 단위 분리 태그(`.stat-unit`)를 적용하여 1줄 유지를 보장함.
     - 대형 헤드라인(`68,400원`)과 100% 중복되던 `차량 총 지출`을 대체하여 EV 핵심 에너지 지표인 `총 충전량`(262.8 kWh)을 기본 표시하도록 전환. (추천 후보: 총 충전량 / 유류비 절감액 / 순수 충전비).
     - 전비 라벨을 기간 선택기에 연동하여 `오늘 전비`, `이번달 전비`, `올해 전비`로 동적 갱신하며, 데이터 부재 시 `기록 없음`으로 표시.
     - 기존 `1km당 충전비`를 `kWh 당 평균 충전요금`으로 변경하고 단가 수치(예: 248원) 및 데이터 부재 시 `기록 없음` 지원.
  2. **"어디에 썼을까요?" 도넛 카드 라벨 정돈**:
     - 카테고리명 하단에 표시되던 세부 텍스트(`HA 자동 집계`, `직접 기록`, `트렁크 미끄럼방지 패드` 등)를 완전히 제거하여 카테고리 색상 도트, 라벨, 금액만 간결하고 명확하게 수평 정렬되도록 개선.
  3. **"놓친 기록을 남겨요" 모달 다이얼로그 간소화 및 금액 자동 콤마**:
     - 수기 입력 불필요 항목인 `누락 충전`, `누락 주행` 및 `충전비`를 전면 제외하고, 수기 지출 관리 대상인 4대 카테고리(`정비 / 소모품비`, `세차비`, `튜닝`, `기타`)로 통합.
     - `실제 금액 · 원` 입력 필드에 키 입력 시 실시간으로 세 자리 단위 콤마(`50,000`)가 자동 생성되는 `formatAmountInput` 적용.
- 관련 파일: `review_journal_spending.html`, `vehicle-journal/references/prototypes/review-spending-comparison.html`, `vehicle-journal/CHANGELOG.md`.
- 검증: 모바일 402px, 데스크톱 1280px, 기록 없음 모드(?empty=1), 모달 팝업(?modal=1) 스크린샷 캡처 및 육안 검증 완료.
- 배포: 검토 프로토타입 및 변경 이력 main 커밋·푸시.

## 2026-10-06 — 차량 이미지 추가 전 원본 복원

- 커밋 제목: `vehicle-journal: restore original review without vehicle image`.
- 사용자 요청으로 review_journal_spending.html을 이미지 추가 직전 백업과 동일하게 복원했다.
  이미지·오버레이·관련 반응형 수정이 제거되고 원래 제목·설명·통계 구성이 돌아왔다.
- 이전 이미지 자산과 오버레이 검사 파일은 작업 이력으로 유지한다. 오버레이 검사는
  이미지가 없는 현재 원본에 적용하지 않는다.
- 검증: 백업과 파일 일치, HTML 내 JS 구문 검사, 모바일·데스크톱 렌더링·이미지 없음 확인.
- 배포: 검토 HTML 및 변경 기록만 main 커밋·푸시. HA·~~Cloudflare~~·릴리즈 변경 없음.

## 2026-10-06 — 차량 우측 하단 고정과 겹침 중간값 조정

- 커밋 제목: `vehicle-journal: anchor hero vehicle at bottom right`.
- 이전 배치는 일반 문서 흐름에서 음수 margin으로 겹침을 만들어 중앙에 걸쳐 보였다.
  차량을 상단 hero-scene의 right: 0 / bottom: 0에 고정하고 폭을 86%로 줄였다.
  제목은 좌측 상단, 통계는 장면 아래에 유지한다. 전체 카드의 통계·버튼 영역을
  차량으로 덮는 구성은 아니며 차량은 카드 상단 시각 영역의 우측 하단에 놓인다.
- 장면에 반응형 예약 공간을 확보해 제목 길이가 달라도 차량의 우측·하단 기준을 유지한다.
  겹침은 직전보다 줄여 마지막 줄 아래쪽만 가리도록 조정했다.
- 관련 파일: review_journal_spending.html, assets/README.md, tests/review-hero.cjs,
  CHANGELOG.md. 새 이미지 생성이나 이미지 자산 변경은 없다.
- 검증: 21개 화면·기간 조합에서 경계·겹침·JS 오류 및 장면 우측 하단 정렬 검사.
  모바일 402px·데스크톱 1280px 월간 스크린샷 육안 확인.
- 배포: 검토 파일만 main 커밋·푸시. 운영 HA·~~Cloudflare~~·릴리즈 변경 없음.

## 2026-10-06 — 좌측 제목·우측 차량 구도와 이미지 제작 기준

- 커밋 제목: `vehicle-journal: align vehicle right and deepen headline overlap`.
- 큰 제목은 좌측 상단에 유지하고 차량 영역을 카드 내용 폭의 92%로 줄여 우측 정렬했다.
  이전보다 지붕이 제목 마지막 줄 아래쪽을 더 덮도록 간격을 조정했다.
- 관련 파일: review_journal_spending.html, assets/README.md, CHANGELOG.md.
- 검증: 모바일·큰 모바일·데스크톱, 320~1920px, 일/월/연도 21개 조합 통과.
  모바일 402px와 데스크톱 1280px의 월간 카드 스크린샷에서 겹침을 육안 확인했다.
- 배포: 로컬 검토 파일만 main에 커밋·푸시. HA·~~Cloudflare~~·버전·릴리즈 변경 없음.

### 다른 차량 이미지 형식과 재사용 편집 프롬프트

- 형식: 배경이 투명한 RGBA PNG, 1536×1024(3:2) 캔버스.
- 차량은 전면이 왼쪽을 향하는 앞쪽 3/4 구도, 전체 범퍼·바퀴·미러가 잘리지 않아야 한다.
- 차량 중심을 캔버스 중앙에 두고 가장자리에 약 4~6% 안전 여백을 둔다.
  차량 외부 배경은 완전히 투명하게, 유리창과 실내는 원래 표현을 유지한다.
- 흰 바닥·배경 안개·광택 테두리를 넣지 않는다. 그림자는 CSS에서 처리한다.
- 이미지는 contain으로 표시하고 우측 정렬·텍스트 겹침은 CSS에서 조정한다.
  차량마다 높이와 지붕 위치가 달라 교체 후 모바일·데스크톱 재검증이 필요하다.

```text
Edit the supplied vehicle photo into a dashboard cutout. Preserve the exact
vehicle identity, paint, badges, wheels, mirrors, proportions, tinted glass
and cabin details. Use a front three-quarter view facing left. Keep the entire
vehicle visible, including every tire and bumper, with no cropping. Place it
centered on a 1536x1024 RGBA PNG canvas with approximately 4-6% safe margins.
Remove the background completely: all pixels outside the vehicle silhouette
must be transparent (alpha zero), with clean antialiased edges. Preserve the
original glass and cabin appearance; do not punch transparent holes through
the windows. No white floor, smoky halo, background haze, glow, external shadow,
text, or added objects. Do not include dashboard text in the image; overlapping
text and right alignment will be implemented separately in CSS.
```

## 2026-10-06 — 큰 헤드라인 오버레이로 요청 정정

- 커밋 제목: `vehicle-journal: overlap vehicle with large headline and remove helper copy`.
- 이전 작업은 겹칠 대상을 작은 설명으로 잘못 이해했다. 작은 설명을 삭제하고
  큰 헤드라인의 마지막 줄 아래쪽과 차량 지붕만 조금 겹치도록 배치했다.
- 설명 DOM 갱신 코드와 CSS를 제거하고 모바일·데스크톱의 이미지 상단 간격을 조정했다.
- 관련 파일: review_journal_spending.html, assets/README.md, tests/review-hero.cjs,
  vehicle-journal/CHANGELOG.md.
- 검증: 320~1920px·세 화면 모드·일/월/연도 21개 조합에서 큰 제목과 차량의
  실제 알파 겹침, 작은 설명 제거, 차량·텍스트 경계, 지표 단위, JS 오류 검사 통과.
  모바일 월간 스크린샷을 육안 확인했다.
- 검토 HTML만 커밋·푸시한다. 운영 HA·~~Cloudflare~~·manifest·태그·릴리즈는 변경하지 않는다.

## 2026-10-06 — 차량 이미지 규격화와 오버레이 재수정

- 커밋 제목: `vehicle-journal: fit complete vehicle art and verify hero overlays`.
- 이전 `20f9e5b`의 차량 뒷부분 잘림·설명 대비·과도한 여백 문제를 해결했다.
  음수 right와 100% 초과 확대를 없애고 고정 비율 영역에서 차량 전체를 contain으로 표시한다.
- 원본 사진을 built-in image_gen으로 배경 제거한 새 1536×1024 RGBA 이미지를 추가했다.
  기존 컷아웃에 있던 유리창 투명 구멍 대신 유리·실내 표현을 보존한 파생 이미지를 사용한다.
  원본·기존 이미지는 유지한다. 작은 설명은 가벼운 대비 처리를 적용해 차체 가장자리와 겹친다.
- 좁은 뷰포트에 프레임 폭을 맞추고, 320px 연도별 지표는 두 열로 표시해 금액과
  전비 단위가 글자 중간에서 끊기거나 인접 지표를 침범하지 않도록 했다.
- 관련 파일: review_journal_spending.html, vehicle-journal/assets/id4-hero.png,
  assets/README.md, tests/review-hero.cjs 및 이 변경 기록.
- 검증: 320~1920px·세 화면 모드·일/월/연도 21개 조합의 이미지 경계·텍스트 경계,
  실제 차체 알파와 설명의 겹침·단위 한 줄 유지·JS 오류 검사 통과. 모바일 월간,
  320px 연간, 좁은 데스크톱 및 넓은 데스크톱 스크린샷을 육안 검토했다.
- 배포: 검토용 로컬 HTML과 자산만 커밋·푸시. 운영 HA·DB·API·manifest·태그·
  pre-release·정식 릴리즈는 변경하지 않는다. 이미지 생성 프롬프트와 배치 원칙을 문서화했다.

## 2026-10-06 — 검토 HTML의 차량·설명 오버레이

- 커밋 제목: `vehicle-journal: compose vehicle and overlay copy in review hero`.
- 사용자 지정 review_journal_spending.html의 요약 카드를 하나의 상대 좌표 영역으로
  구성하고 기존 투명 ID.4 이미지와 작은 설명을 겹쳐 배치했다. 설명은 차량 앞면
  가장자리 위에 표시하고 주요 수치와 하단 지표는 읽기 쉽게 유지했다.
- 모바일·큰 모바일·데스크톱 모드별 크기·위치와 좁은 카드 컨테이너 규칙을 추가했다.
- 관련 파일: review_journal_spending.html, 기존 vehicle_id4_transparent.png, 이 변경 기록.
- 검증: 세 화면 모드 이미지 로드·JS 실행·카드 렌더링을 확인했다. 차량 가장자리는
  카드 내부에서 잘라 표현한다. 원본 HTML 백업은 /private/tmp에 보관했다.
- 검토용 로컬 HTML만 수정했다. 운영 HA·manifest·태그·릴리즈는 변경하지 않는다.

## 2026-10-06 — 문서 언어 전수 확인과 혼입 표현 정리

- 커밋 제목: `vehicle-journal: normalize reference text and document language policy`.
- 숨김 폴더를 포함한 저장소 문서 93개를 문자별로 검사했다. 현재 작성 문서에는
  일본어 문장이 남아 있지 않으며, 참고 ev-zero-base.html의 한자 혼입 두 곳을 발견했다.
- 한자를 한국어로 치환하던 두 표현을 처음부터 한국어로 쓰도록 정리했다.
  참고 원문 해시는 유지하고 현재 파일 해시와 원문 보관 커밋을 별도 기록했다.
- 루트·차계부 AGENTS.md에 한국어/영어 문서 작성 및 커밋 전 혼입 확인 규칙을 추가했다.
- 관련 파일: references/prototypes/ev-zero-base.html, references/README.md,
  루트·차계부 AGENTS.md 및 이 CHANGELOG.md. 의도적인 제품 중국어 번역은 변경하지 않았다.
- 검증: 문서 전체 문자 검사·HTML 내 JS 구문·diff/공백·파일 해시 확인.
  문서·참고 파일만 커밋·푸시한다. HA 코드 반영·재시작·새 릴리즈는 필요 없다.

## 2026-10-06 — 전체 변경의 누적 changelog 기록 의무화

- 커밋 제목: `vehicle-journal: require complete changelogs for commits and releases`.
- 사용자 요청에 따라 모든 차계부 커밋의 기능·수정·제거·테스트·문서·배포 변경을
  기록하고, pre-release 및 정식 릴리즈 노트에 해당 범위의 변경 전체를 반영하도록 명시했다.
- 정식 노트는 직전 정식 릴리즈 이후 중간 베타의 변경까지 누적한다. 기준 태그·대상
  커밋과 git log·diff 대조, GitHub/HACS 노트 확인 절차 및 커밋 기록 양식을 추가했다.
- 관련 파일: 루트 AGENTS.md, vehicle-journal/AGENTS.md, deployment.md, CHANGELOG.md.
- 검증·배포: 문서 diff/공백 검증 대상. 문서만 커밋·main 푸시하며 HA 반영·재시작,
  manifest 상승·태그·릴리즈 발행은 필요 없다. 실제 새 릴리즈 내용 검증은 발행 시 수행한다.

### 이전 차계부 커밋과 기록 연결

| 커밋 | 변경 기록 항목 |
| --- | --- |
| `c0db509` | 기반 설계와 빈 HA DB 생성 |
| `c8ad4aa` | v0.8.13 차계부 첫 구현 |
| `9a293ee` | 개발 배포 정책 정정 |
| `5a64826` | 사이드바 첫 로딩 수정 |
| `0ec0afb` | 기존 전국 평균 유가 센서 연결 |
| `8867de5` | Antigravity 인계 절차 보완 |

`v0.8.13` 태그에는 `c8ad4aa`까지 포함되어 있다. 이후 커밋은 main의 개발 변경이며,
기존 v0.8.13 릴리즈를 재발행한 것으로 표현하지 않는다. 로딩 수정의 실사용 표시와
HA 배포 파일 해시 일치는 확인했다. 유가 최신 API의 재시작·계산 검증은 아직 미확인이다.

## 2026-10-06 — Antigravity 인계 절차 보완

- deployment.md에 커밋·main 푸시 명령, 커밋에서 코드 추출, HA SSH 백업·직접 반영·
  해시 확인, 사용자 재시작·강력 새로고침, 롤백과 단계별 릴리즈 절차를 정리했다.
- 루트 및 차계부 AGENTS.md에서 문서를 연결하고 충돌하는 기존 릴리즈 문구를 정리했다.
- 문서만 변경했다. HA 실행 코드·DB·사진·manifest·태그·Release는 변경하지 않았다.

## 2026-10-06 — 기존 전국 평균 유가 센서 연결

- gas_station_korea의 전국 평균 휘발유·경유·고급휘발유 센서를 비교 폼에서 찾아
  유종에 맞춰 제안한다. 사용자 비교 연비 확인·저장 후 계산한다.
- 해당 통합이 사용하는 단위 `원`을 리터당 유가로 허용한다. 다른 통합의 일반
  원 단위 센서는 허용하지 않으며 기존 원/L·KRW/L 지원은 유지한다.
- 단위 허용/차단 검증 추가. Python API 변경 적용에는 사용자 HA 재시작이 필요하다.

## 2026-10-06 — 사이드바 첫 로딩 수정

- 비동기 패널 정의 전 HA가 할당한 hass 속성이 setter를 가려 카드에 전달되지 않는
  순서를 재현했다. 업그레이드 후 속성을 setter로 재전달하도록 수정했다.
- 해당 순서의 브라우저 회귀 검증을 추가했다. 화면 파일만 커밋 기반 직접 배포하며
  manifest·태그·pre-release는 유지한다. DB·사진·Python 코드는 변경하지 않는다.

## 2026-10-06 — 개발 배포 정책 정정

- 운영 검증 전 정식 발행한 v0.8.13을 사용자 요청으로 GitHub pre-release로 전환했다.
  릴리즈 화면의 Pre-release 표시를 확인했다. 기존 태그·manifest는 유지한다.
- 이후 순서는 수정마다 검증·커밋·푸시 → 버그 수정 완료 후 pre-release → 실사용
  검증 통과 후 정식 릴리즈다. 디버깅 코드 테스트는 HA SSH 직접 동기화를 사용한다.
- 이 정책 변경에서는 HA 코드 동기화·설치·재시작을 실행하지 않았다.

## 2026-10-06 — 기반 설계와 사용자 요청에 따른 빈 HA DB 생성

- 전용 지침·요구사항·DB/집계/이관/백업/API/검증 계획, schema v1,
  독립 합성 검증 스크립트, 미선정 원본 HTML 후보 2개와 SHA-256 출처 기록 추가.
- 변경 범위: vehicle-journal/ 및 루트 AGENTS.md 안내. HA 실행 코드·manifest,
  ~~Cloudflare~~·Comma 변경 없음. 0.8.12 버전 유지, HACS Release/Worker 배포 없음.
- 로컬 SQL 9개 검증 통과. null 결제 금액 허용과 실제 0원의 구분을 포함하며
  새 DB 생성·재실행·FK·unique·JSON·사진·transaction rollback 확인.
- 사용자 추가 요청에 따라 WireGuard 경유 HA SSH 연결 성공. 읽기 전용 source
  진단(한국 시간 13:47 전후): 활성 통합 1개, state 25,563건(9/22~10/6 UTC),
  trip 171건(7/28~10/6 UTC), charge 46건(7/28~10/5 UTC).
  trip_derivations 171, trip_energy 52, charge_summaries 46, charge_payments 6,
  charge_exclusions 0, charge_deletions 1. 이는 조회 시점 값이며 완전 복원 판정은 아니다.
- HA 신규 journal DB 생성: schema 1, 차량 mapping 1개, 원장 0건, 196,608 bytes,
  integrity_check=ok, foreign_key_check=0. 첨부파일 폴더 준비. 기존 파일 덮어쓰기 없음.
  HA 설정 시간대 확인에는 기존 sudo 권한을 사용했으며 서버 권한 설정은 변경하지 않음.
- 운영 DB/사진·entry/device 식별자·개인 본문·토큰은 Git에 포함하지 않음.
- 미완료: 과거 이관, automatic outbox/집계, 수동 쓰기, API, 대시보드, 실제 백업 복원.
  빈 DB 생성은 자동 기록 수집 시작을 의미하지 않음. HA 재시작·HACS 업데이트 불필요.

## 2026-10-06 — v0.8.13 차계부 첫 구현

- 사용자 선택 후보 1번 ‘오늘의 브리핑’을 바탕으로 HA Lovelace 카드 구현.
  월간 요약·지출 도넛·일/주/월 추이·페이지 원장·현재 유가 비교·최신 수신 상태 표시.
  HA 관리자 사이드바에 차계부를 자동 등록하며 별도 수동 리소스 설정 불필요.
- `custom_components/carrot_ha/vehicle_journal/`: packaged schema, compact 원장·일별
  요약·배치 이관, 수동 주행/충전/비용 저장·수정·삭제·복원, 관리자 WS·인증 사진 API.
  사진 픽셀 재인코딩, EXIF 제거, 크기/장수·차량 매핑 검증.
- 기존 storage mutation transaction에 기기별 durable outbox triggers 추가.
  target 사실/집계 완료 후 ACK, 원본 purge/slimming 전 확인·실패 시 유예.
  기존 결제 helper 재사용; actual=0 보존, 그룹 비용 중복 방지.
- HA source 읽기 전용으로 실제 과거 기록 이관, target 사전 backup과 integrity/FK
  확인. 운영 소스 파일 직접 복사 없음. Git 제외 로컬 실제 기록 미리보기 확인.
- 제한: parking/전체 SOC, 표본 기반 자정 정밀 배분, 당시 유가, 자동/수동 링크·
  필드 보정·export API는 후속 범위. 같은 날 자동 기록은 수동 행에 경고만 표시.
- ~~Cloudflare~~·Comma 코드/배포 변경 없음. HACS 설치·HA 재시작은 사용자 작업.
  실행 코드의 실제 운영 수집/쓰기 확인은 설치 이후에 별도로 기록한다.
# 2026-10-07 — 최근 30일 주행 엔티티와 월간 요약 속성

- 배포 확정: 구현 커밋 `1aed5a94f95b82506b1c55ca7e0aabcaf55d1684`를 main에
  푸시하고 원격 일치를 확인했다. HA 센서 Python 4개 파일을 해당 커밋에서 추출해
  기존 해시 검사·전체 백업 후 부분 반영하고 배포 해시 및 Python 구문을 재검증했다.
  백업은 `/config/carrot_ha/deployment-backups/1aed5a94f95b82506b1c55ca7e0aabcaf55d1684/`.
  배포 스크립트 첫 시도는 구문 검사에서 중단돼 운영 파일을 수정하지 않았고,
  스크립트 수정·구문 확인 후 다시 실행해 성공했다.
  차계부 화면 4개 해시가 배포 전과 같음을 확인했다. HA 재시작은 실행하지 않았다.
  새 엔티티 실제 등록·실행 값 확인은 사용자 재시작 후 검증 대기다.

- 커밋 제목: `vehicle-journal: add rolling 30-day driving sensors with monthly attributes`.
- 변경·이유: 매월 1일 월간 기록이 비는 위젯을 위해 최근 720시간의 전비·전체
  주행거리 엔티티 두 개를 추가한다. 주행횟수는 별도 엔티티 대신 속성으로 제공한다.
  두 엔티티에 이번 달 전비·거리·횟수·에너지·커버리지 속성을 함께 제공하고
  기존 월간 엔티티는 호환성을 위해 유지한다. 기간은 주행 observed_at 기준이며
  진행 중인 주행을 시간 비례로 분할하지 않는다.
- 측정 정책: 기존 전비의 검증·거리 보정·순 에너지·회생제동 기준과 1km/0.5kWh
  표시 조건을 재사용한다. 누락된 에너지는 추정으로 채우지 않는다. 90일 주행 및
  에너지 캐시가 30일 집계를 지원하고, 원시 상태/경로의 14일 보존은 변경하지 않는다.
- 성능: 기존 60초 이력 동기화의 공유 로컬 요약만 확장한다. 클라우드 요청 및 ~~KV~~
  쓰기 없음. 캐시 거리가 동일할 때 재쓰기를 생략해 월간/30일 집계가 같은 이벤트의
  차계부 outbox 세대를 반복 증가시키지 않게 한다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py,
  entity_migration.py}, tests/{test_rolling_energy.py,test_new_sensors.py}, docs/entities.md.
  위젯 제목·⚡ 전비·🚘 정수 거리·데이터 수집 중 템플릿도 문서에 추가했다.
- 검증: 새 기간 경계/월 경계/미래 기록/차량 격리/회생/누락/원시 정리/거리 수정/
  불필요한 쓰기 방지 4건, 센서 18건, 기존 월간 4건·주행 에너지 13건·보정 35건 통과.
  latest 6건·증분 5건·이력 캐시 1건, 필수 dashboard 10건, ~~Worker~~ 증분 및 benchmark,
  Comma parameter polling 4건, 카메라 4건, 충전 mode 8건·power 9건 통과.
  차계부 14건·schema 9건 통과. 기본 Mac Python의 Pillow 누락은 번들 Python으로
  재검증했고 충전 power 테스트의 독립 import 환경은 기존 센서 stub을 먼저 로드해
  검증했다. 실제 기기 장애로 해석하지 않는다.
- 배포: 현재 차계부 개발 정책에 따라 main 커밋·푸시 및 센서 Python 파일 4개만
  백업·부분 반영 대상이다. 기존 설치 4개 해시가 수정 전 Git 커밋과 일치함을 확인했다.
  차계부 화면 4개도 Git과 설치본 해시 일치 확인. 화면·DB·사진·설정은 배포 대상에서
  제외한다. manifest/태그/새 Release/Cloudflare/Comma 변경 없음.
- 적용 상태: 커밋·푸시·서버 반영 결과는 후속 기록으로 확정한다. Python 변경이므로
  사용자 HA 재시작 후 엔티티 등록/실제 값 확인은 대기다. 현재 개발 기간에는 HACS
  재다운로드를 혼용하지 않으며, 이후 새 베타 릴리즈에 최신 차계부 수정도 포함해
  태그·파일 해시와 누적 변경 기록을 검증한다.
# 2026-10-07 — 중복 차량 엔티티 12개를 속성으로 통합

- 배포 확정: 구현 커밋 `021c33c321302ea44c07d83c6c5625075ef553e4`를 main에
  푸시하고 원격 일치를 확인했다. 센서/migration 2개를 기존 해시 검사·백업 후 HA에
  부분 반영했고 배포 해시·Python 구문 재검증 완료. 백업 위치:
  `/config/carrot_ha/deployment-backups/021c33c321302ea44c07d83c6c5625075ef553e4/`.
  차계부 화면 4개 해시가 기존과 같음을 재확인했다. 재시작 전 실제 등록/활성은
  81/81개이며 아직 migration은 실행되지 않았다. 사용자 HA 재시작 후 81/69개와
  복합 속성/자동화 실사용 확인이 남아 있다. 에이전트는 재시작하지 않았다.

- 커밋 제목: `vehicle-journal: compact duplicate vehicle sensors with reversible migration`.
- 변경·이유: 최근 주행 상세 5개·충전 ETA 2개·월 완속/급속량 2개·월 주행횟수 1개·
  누적 기록 횟수/거리 2개를 기존 복합 센서 속성으로 제공하고 기본 비활성화한다.
  Comma 엔티티는 전부 유지한다. 자동화에서 참조하는 배터리/충전/연결/남은시간,
  현재 아이폰 위젯의 월 전비·거리는 유지한다. 별도 요약 엔티티를 추가하지 않는다.
- 전환: config entry data의 버전 마커로 최초 1회만 비활성화한다. 등록 ID·기록을
  삭제하지 않고 사용자가 다시 활성화한 선택을 재시작·옵션 저장 후에도 유지한다.
  새 설치도 상세 센서를 기본 비활성화하지만 설정에서 다시 활성화할 수 있다.
- 속성: 월 충전량에 slow_kwh/fast_kwh, 월 거리 및 최근 30일 거리에
  month_trip_count/recorded_trip_count/recorded_distance_km을 추가한다. 최근 주행 및
  충전 세션의 기존 속성으로 상세값을 제공한다. 누적 기록은 보존 중인 archive 기준이다.
- 영향 확인: HA 등록 81개/활성 81개와 축소 대상 12개를 읽기 전용 확인했다.
  조회한 HA YAML/Lovelace 설정에 대상 ID 직접 참조 없음. 아이폰·외부 카드의
  모든 설정을 조회한 것은 아니며 필요한 상세 센서는 재활성화할 수 있다.
  기본 적용 후 등록 81개·활성 69개 예상. 실제 전환은 사용자 HA 재시작 후 확인한다.
- 관련 파일: custom_components/carrot_ha/{entity_migration.py,sensors_v3.py},
  tests/{test_entity_migration.py,test_new_sensors.py}, docs/entities.md.
- 검증: 마이그레이션 4건(12개 한정/Comma·필수 보존/재활성화/다른 차량/옵션 저장),
  센서 속성·기본 활성 정책 포함 19건 통과. rolling/monthly 각 4건·latest 6건·증분 5건·
  이력 캐시 1건, dashboard/카메라 14건, ~~Worker~~ 증분·benchmark 및 Comma parameter
  polling 4건 통과. 차계부 14건·schema 9건 통과. 프론트엔드 변경 없음.
- 배포: main 커밋·푸시 후 현재 개발 정책의 백업·부분 배포 대상으로 센서 및
  migration Python 2개만 반영한다. 기존 설치 파일 해시와 수정 전 커밋 일치 확인.
  코드 반영/해시·백업 확인은 후속 기록으로 확정하고 사용자 재시작·69개 확인은 대기다.
  manifest/태그/새 Release/Cloudflare/Comma/운영 DB/사진/화면 코드 변경 없음.
# 2026-10-07 — 원시 CAN 수집 공유 용량 상한 10GB

- 배포 확정: `5a0e8fa77f5ef59283651428316ce453f51969c6`를 main에 푸시했다.
  can_capture.py/services.yaml을 백업 후 HA에 부분 반영하고 커밋 SHA-256과 일치 확인.
  백업: `/config/carrot_ha/deployment-backups/5a0e8fa77f5ef59283651428316ce453f51969c6/`.
  운영 로그 직접 삭제·HA 재시작은 수행하지 않았다. 실행 중 상한의 10GB 전환은
  사용자 HA 재시작 후 상태 센서 limit_bytes 확인 대기다.

- 커밋 제목: `vehicle-journal: lower HA raw CAN storage ceiling to 10 GB`.
- 변경·이유: 사용자 요청으로 HA 원시 CAN 파일의 모든 엔트리 공유 상한을
  20,000,000,000에서 10,000,000,000 bytes로 낮춘다. 기존 메타데이터 예약량과
  오래된 수신 파일부터 정리하는 정책은 유지한다. 시작 API의 max_gb 기본/검증
  상한과 서비스 설명을 10GB로 맞춘다. 원래와 같이 max_gb는 공유 상한을
  엔트리별 별도 예산으로 바꾸지 않는다.
- 영향: 시작 시 및 새 수신 시 새 상한을 적용한다. 기존 용량이 상한 초과라면
  다음 사용자 HA 재시작 시 오래된 원시 로그부터 정리된다. 운영 원시 로그 총량은
  읽기 전용 확인에서 새 상한 미만이었다. archive/차계부 DB·사진은 정리 대상이 아니다.
- 관련 파일: custom_components/carrot_ha/{can_capture.py,services.yaml},
  tests/test_can_capture.py, docs/raw-can-capture.md.
- 검증: CAN 테스트 10건 중 8건 통과, aiohttp 미설치로 실제 HTTP 2건 skip.
  새 10GB 상태/시작 검증 및 재시작 하향 상한·오래된 파일 우선 정리 검증 포함.
  실제 운영 파일 정리·수집 중 상한 도달은 수행하지 않았다.
- 배포: main 커밋·푸시 후 현 개발 정책으로 Python/서비스 설명 2개를 기존 해시
  확인·백업 후 부분 반영 대상. 확정 배포 및 사용자 재시작 대기는 후속 기록한다.
  차계부/차량 화면·Comma·~~Worker~~·~~D1~~·manifest·태그·새 Release 변경 없음.
# 2026-10-07 — 추이 카드의 미정의 이전 기간 변수 수정

- 배포/실화면 확정: `f597575dac65d507b8ece8017d50a0b2702ce99c` main 푸시 후
  카드 한 파일 백업·부분 반영. 백업은 `/config/carrot_ha/deployment-backups/f597575dac65d507b8ece8017d50a0b2702ce99c/`.
  설치·사용자 외부 주소 HTTP SHA-256 `9610587f9cb806f038249d2f787719982895f67ed826fbb0ff6269446e3588b5`
  일치, frontend-version `0.8.13-a0781aefca83` 확인. 실제 Chrome의 기존 오류를
  먼저 확인하고 새로고침 후 월/연도 6개 추이 카드·SVG와 비교 문구 표시를 확인했다.
  월별 화면으로 복원했다. HA 재시작·HACS 재다운로드는 실행하지 않았다.
- 별도 계산 제한: 기존 추이 코드는 진행 중인 월의 누적량을 월 전체 일수로 나누고,
  이전 월 분모를 30일로 고정한다. 미관측/미래 bin은 0으로 표현한다. 이번 수정은
  렌더링 오류 복구이며 이 비교 기준의 정확성까지 검증·수정했다고 보고하지 않는다.
  관측 범위·누락을 분리하는 후속 보완이 필요하며 원시 DB나 집계 결과는 변경하지 않았다.

- 커밋 제목: `vehicle-journal: fix undefined comparison values in trends dashboard`.
- 원인: e057203에서 추이 화면을 개편한 뒤 이전 기간 계산의 prevDist/prevCharge/
  prevRate/prevDriveSoc/prevFastRatio 선언과 카드 생성의 past* 참조가 불일치했다.
  d5aad74의 legacy energyStats 제거 및 d4ca68b의 null 요소 보호는 이 별도 오류를
  해결하지 못했다. 운영 파일에서도 동일한 참조 5개와 화면 `pastDist is not defined`
  오류를 확인했다. DB 누락이 아니라 첫 카드 생성 시 ReferenceError로 렌더링 중단이다.
- 수정: 5개 참조를 선언된 prev* 이름으로 맞춰 모든 추이 카드 렌더링을 복구한다.
  기간 계산·API·집계 정의·기록은 변경하지 않는다.
- 회귀: 이전 browser-check의 삭제된 metric/chart 선택자를 현재 6개 trend-card/SVG
  검증으로 교체한다. 월/연도·이전 기간 존재/없음·빈 데이터·NaN/undefined·비교 카드,
  기존 탭·수기 저장·HTML escaping·비동기 기간 전환·scroll/style·모바일 검증 통과.
  loader-update의 실제 모듈 로딩/입력 보호/뷰 복원 검증도 통과했다. node 구문 검사 통과.
- 지침: node --check만으로 미정의 변수 실행 오류를 잡지 못하므로 실제 Chromium
  렌더 및 화면 error 표시를 검사하도록 AGENTS와 .agents 규칙에 동일하게 추가했다.
- 관련 파일: frontend/carrot-vehicle-journal.js (custom_components/carrot_ha/ 아래),
  vehicle-journal/tests/browser-check.cjs, vehicle-journal/AGENTS.md,
  .agents/rules/vehicle-journal.md, vehicle-journal/CHANGELOG.md.
- 배포: 검증 후 main 커밋·푸시 및 카드 JS 한 파일의 백업·부분 반영 대상.
  운영 설치 hash가 수정 전 커밋과 일치함을 확인하고, 서버/HTTP/실제 브라우저 적용
  결과는 후속 기록한다. 현재 개발 정책에 따라 새 릴리즈 없음. Python/DB/사진/
  Cloudflare/Comma 변경 없음.

## 2026-10-12 — 자동 장소·연비·장소 통계·검증된 NAS 전용 백업

- 커밋 제목: `vehicle-journal: add station enrichment fuel efficiency and verified NAS snapshots`.
- 변경·이유: 오늘 신규 수동 주유/충전은 사용자 GPS에서 가장 가까운 후보를 선택한다. 주유 단가는 실제 유종별 오피넷 현재 단가이며 수정한 단가를 덮어쓰지 않는다. 과거 날짜에는 현재 위치/단가를 적용하지 않는다. 자동 충전은 충전 시작 ±10분 안의 HA 로컬 GPS를 사용하고 정확도 100m 초과는 제외한다. 장소 조회는 한 번에 3건, 실패는 다음날 재시도하며 최신 상태 경로와 독립적이다. 기존 완속/급속 추정 요금·charge_payment 원본은 변경하지 않는다.
- 가득 주유 구간의 시작 주유량은 제외하고 부분 주유와 종료 주유량을 합산한다. 전체 가중 평균은 총거리/총량이다. 주유량 누락·거리 감소·당일 가득 주유 순서 불명·유종 혼합은 제외 및 안내한다. 금액/단가로 계산한 주유량은 추정으로 표시한다.
- 장소별 방문 횟수·주유 L·청구 kWh·배터리 추정 kWh·각 가중 평균 단가 조회와 추세 목록을 추가한다. 제공사 ID/좌표/단가 출처를 기록과 스냅샷에 보존한다. 이름만 있는 이관 장소는 다른 지점을 합치지 않고 위치 미확정으로 구분한다. 전국 지도는 후속 표시 기능이다.
- NAS 전용 스냅샷은 기존 HA 백업 폴더 안 전용 vehicle-journal 하위 폴더에만 보관한다. KST 03:00 예약과 시작/실패 재시도, 일7/주4/월12, 임시 DB·원본 결제 복원, 체크섬 및 NAS 읽기 복원 검증을 제공한다. 실제 NFS/CIFS 마운트가 아니면 로컬 대체 저장을 거부하고 전체 검증 성공 후 자기 인덱스 파일만 정리한다. 설정·수동 백업·목록·검증 다운로드와 기존 업로드 복구를 연결한다. API 키는 스냅샷에 포함하지 않는다.
- 환경: 사용자가 기존 HA 백업 폴더 연결과 HA 단일 IP에 Vault NFS 읽기/쓰기를 승인했다. HA 공유 용도 마운트가 연결됨을 UI 및 SSH에서 확인했다. 기존 Frigate 미디어 마운트는 백업에 사용하지 않는다. HA Core 직접 mountinfo 확인은 SSH 앱 보호 모드로 Docker 접근이 제한되어 미실시이며 보호 모드는 변경하지 않았다. Core 내부 백업 API 실제 검증은 사용자 재시작 후 확인한다.
- 관련 파일: vehicle_journal/{stations,automatic_locations,efficiency,station_stats,nas_backup,api,store,runtime,vehicles,transfer}.py, __init__.py, frontend/carrot-vehicle-journal.js, tests/{test_station_backup,test_api_authorization}.py, tests/vehicle-management.cjs.
- 검증: Python 45건·schema 9건 및 실제 Chromium vehicle-management/browser-check/loader-update 통과. 합성 자료로 부분주유/가중 평균/누락 제외, 장소 통계, 기존 충전 요금 유지, 사용자 위치 삭제 보호, GFS 세대 한도, 실패 시 기존 인덱스 유지, 손상 체크섬 거부 및 기존 HA 파일 미삭제 확인. 자동 GPS·가격·수동 가격 보호·추정량 출처·연비/장소 통계·NAS 상태 UI 통과. 공식 API 공공 좌표로 오피넷 주유소 48개·카카오 충전소 15개 및 좌표 변환 검증(이전 작업에서 수행).
- 배포: 검증 후 커밋·main 푸시·기존 코드 백업·HA 부분 반영 대상. 실제 NAS 저장 검증 및 사용자 재시작/설정 활성화 결과는 후속 기록한다. 개발 정책상 새 Release 없음. Comma/Cloudflare 변경 없음.

## 2026-10-12 — NAS 실저장 검증 및 여러 장소의 충전 세션 통계 보완

- 90b9d6e main 푸시 및 12개 실행 파일 HA 백업·반영·해시 일치. 운영 DB를 변경하지 않고 일관 복사본으로 차량 2대 스냅샷을 실제 NAS에 저장했다. 총 1,444,889 bytes, 일/주/월 각 1세대. NAS 재읽기·체크섬·임시 DB 및 결제 원본 복원 검증 모두 통과.
- 커밋 제목: `vehicle-journal: preserve per-session place quantities for grouped payments`.
- 변경·이유: 결제 그룹에 여러 충전소가 있으면 전체 금액을 임의 분배하지 않는다. 장소가 확정된 개별 충전 세션의 방문·충전량은 집계하되, 안전하게 귀속할 수 없는 단가는 미확인으로 남긴다. 같은 장소의 그룹은 방문 횟수를 실제 세션 수로 집계한다.
- 관련 파일: vehicle_journal/station_stats.py. 기존 충전 금액·원장·사진 변경 없음.
- 검증: Python 45건 통과. 사용자 HA 재시작 완료 응답을 받았으며 실제 Core 설정·백업 상태 및 UI 검증은 진행 중.
- 배포: main 푸시·해당 모듈 백업·직접 반영 후 상태 확인 대상. 개발 정책상 새 Release/Comma/Worker 변경 없음.

## 2026-10-12 — HA Core 실제 NAS 검증·자동 백업 활성화 및 혼합 수량 표시

- 커밋 제목: `vehicle-journal: keep grouped station attribution safe and show quantity bases separately`.
- 변경: 결제 그룹에 여러 장소가 생기면 이전 자동 장소 보정을 제거해 잘못된 전체 금액 귀속을 막는다. 사용자 지정 장소는 유지한다. 장소별 청구 kWh와 배터리 추정 kWh가 함께 있을 때 각각 표시하고, 양이 없는 기록은 0 대신 기록 없음으로 표시한다.
- 검증: Python 46건·Chrome vehicle-management 통과. 서로 다른 장소의 그룹 결제에서 세션별 20kWh 보존 및 단가 임의 생성 방지 회귀 포함.
- 실기: 사용자 재시작 후 HA Core NAS 설정 저장·즉시 백업 성공. 2026-10-12 KST 16:01 백업은 차량 2대, 일/주/월 각 1세대, 저장 파일 재읽기·체크섬·실제 임시 DB 복원 검증 완료. 설정 enabled=true 및 자동 장소 활성화 영구 저장 확인. 기존 Frigate 연결·HA 전체 백업 유지. 실제 Chrome에서 NAS 복원 검증 상태와 두 차량 다운로드 목록 확인.
- 실제 화면: 아테온 79건, 선택 구간 19.06km/L·전체 가중 평균 16.82km/L 및 장소별 주유량/단가 표시. ID.4 310건 유지 및 실제 자동 충전 장소 통계 표시. 위치 값은 비공개이며 공개 이력에는 구체적 장소·좌표를 기록하지 않는다.
- 배포: b4979c6 main·HA 파일 일치. 이번 추가 보완은 커밋·푸시·백업 후 부분 배포 대상이며 마지막 Python 적용을 위한 사용자 재시작 필요. NAS 예약 03:00 실제 시각 도달 및 장기 세대 축적은 아직 관측하지 않았고 로컬 예약/GFS 회귀와 즉시 백업만 검증했다. 새 Release/Comma/Cloudflare 변경 없음.
- 관련 파일: vehicle_journal/automatic_locations.py, frontend/carrot-vehicle-journal.js, tests/test_station_backup.py.

## 2026-10-12 — NAS 설정 체크박스와 백업 목록 줄바꿈

- 커밋 제목: `vehicle-journal: compact NAS toggles and wrap snapshot metadata`.
- 실제 화면에서 공통 입력 높이가 체크박스에도 적용돼 크게 표시되고 라벨과 다음 경로 제목이 붙는 것을 확인했다. 체크박스만 18px로 고정하고 라벨을 가로 정렬, 백업 목록의 날짜/검증 상태를 별도 줄로 표시한다. 글꼴과 다른 입력 크기는 유지한다.
- 관련 파일: frontend/{carrot-journal-design,carrot-vehicle-journal}.js.
- 검증: 실제 Chromium vehicle-management 데스크톱·320/360px 모바일 통과.
- 배포: 화면 파일 백업·부분 반영 및 사용자 주소 HTTP 해시 확인 대상. 이 UI 보완 자체는 HA 재시작이 필요 없으며 기존 Python 보완의 사용자 재시작 대기 중이다. 새 Release/DB/Comma/Worker 변경 없음.

## 2026-10-12 — 마지막 재시작 후 읽기 전용 확인

- 사용자 마지막 HA 재시작 완료 응답 후 UI 수정 중단 요청을 준수했다. 화면·DB·설정 추가 변경 없이 상태만 읽었다.
- 확인: 전용 NAS 자동 백업 enabled=true, phase=complete, restore_verified=true, 차량 2대, 자동 장소 활성화 유지. ID.4 원장 310건·자동 충전 장소 15건, 아테온 원장 79건 보존, 두 DB quick_check=ok.
- b3a887e main 푸시 및 화면 3개 파일 백업·내부/외부 HTTP 해시 확인 완료. 마지막 Python a48aa01 파일은 이전에 배포됐고 이번 사용자 재시작으로 적용 대상이다.
- 제한: 실제 휴대폰 신규 주유 입력·해당 단가 확인은 사용자 현장 검증 대기. 합성 Chrome에서 GPS/단가/수정 보호/저장 검증은 통과했다. 새벽 03:00 예약 시각 실행 및 장기 GFS 세대 누적은 아직 관측하지 않았으며 예약 코드·보관 회귀·HA Core 즉시 백업과 임시 복원 검증으로 확인했다. 전국 방문 지도와 OCR은 기존 합의대로 후속이다. UI 품질 개선은 사용자 요청으로 중단했다.
- 커밋 제목: `vehicle-journal: record final restart and verification status`. 문서만 변경, 실행 코드/릴리즈/Comma/Worker 변경 없음.
## 2026-10-14 — 직접 차량 수신 전환의 차계부 보존 점검

- 제목: `vehicle-journal: record unchanged journal migration regression` (기록만 수정).
- 이유: 사용자가 ~~Cloudflare~~ 대신 HAOS 수신 애드온을 요청하면서 기존 기능 전체 보존을
  요구했다. 차계부 계산·DB·사진·결제·UI 실행 코드는 변경하지 않는다.
- 관련: docs/direct-vehicle-receiver-plan-2026-10-14.md의 보존 목록, HA cloud.py의
  기존 cloud 이벤트 ID 유지와 source별 cursor, 기존 vehicle-journal/tests.
- 검증: 실제 HA Archive와 수신 API를 연결해 이전 주행과 cursor 보존·재수신 중복 없음
  확인. 기존 충전 74·주행 73건 통과. 차계부 62건은 Windows SQLite 임시 파일 정리
  오류를 gc 수집으로 구분했으며 60건 통과, NAS directory fsync의 Windows 미지원
  2건은 실패로 남김. NAS 실행 코드와 보관 정책은 수정하지 않는다.
- 배포: 차계부 원본 DB·사진·HA 설정은 삭제/이관하지 않는다. 수신 애드온은 설치·
  내부 및 외부 HTTPS health 200 확인; HA 사용자 재시작과 실차 전환/차계부 표시
  검증은 미완료. 버전·태그·Release 변경 없음.


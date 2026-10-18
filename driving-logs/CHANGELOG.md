## 2026-10-18 — 사용자 요청: 로그 날짜 선택기 제거 및 HA 직접 반영

- 이유/승인: 사용자가 날짜 선택기의 불안정한 동작으로 제거를 요청했고, 이 변경은 프리뷰에 반영하지 않고 HA에 SSH로 직접 수정·기록하도록 명시했다. 이 범위는 사전 UI 프리뷰 승인 절차의 사용자 지정 예외다.
- 작업 범위: 날짜 입력·앞/뒤·전체 날짜 컨트롤, 세션에 남은 날짜 필터, calendar 조회와 자동 재조회만 제거한다. 주행 목록·정렬·세그먼트 선택·영상·V2 리플레이는 유지한다. 관련 원본 JS/CSS/HTML 캐시 버전과 기존 브라우저 회귀를 함께 갱신한다.
- AI 프리뷰 보존: 운영 UI 변경 전 현재 프론트엔드 전체를 대화 전용 프리뷰 폴더의 `frontend-snapshot/`으로 복사하고 프리뷰 서버를 이 스냅샷에 고정한다. 날짜 선택기는 기존 AI 프리뷰에 그대로 유지한다.
- 로컬 검증: 날짜 컨트롤 DOM 제거, 과거 세션 날짜가 있어도 전체 주행 표시, calendar/from/to 요청 제거, visibility 복귀 후 목록 유지와 V2 메뉴·모바일 너비를 Chromium에서 통과했다. 기존 로그 목록·선택·정렬·영상 플레이어·닫기 및 저장 설정/NAS 상태·소유자 격리 브라우저 회귀도 모두 통과했다. 실제 HA SSH 연결과 설치 JS/CSS/HTML 원본 해시를 읽기 전용으로 확인했다.
- 프리뷰 보존 검증: 스냅샷 원본 카드·날짜 탐색·합성 영상 썸네일·설정, 신규 AI 수동 분석·취소·추천·근거 구간·키 미설정/한도 상태, desktop/mobile/light 및 overflow 검증 통과. 실제 AI·외부 네트워크·라이브 소켓 호출은 없었다.
- 운영 반영: 실행 코드 `68bf37df44ddc36bf1c79ebf349faaabb07ae17e`를 main에 푸시하고 원격 커밋 일치를 확인했다. HA 설치4파일 충돌 검사·원본 백업·직접 설치·SHA-256 전부 일치. 백업: `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-68bf37df44dd/before` (`/config`의 실제 경로).
- 운영 검증: HA가 제공하는 `ha_log_explorer.js`, `ha_layout.css`, `logs.html` HTTP200 응답의 SHA-256이 실행 커밋과 모두 일치한다. 제공 JS의 날짜 DOM/달력 로직 제거 및 HTML의 `20261018-no-date` 캐시 버전을 확인했다. 정적 파일 변경이므로 사용자 브라우저 새로고침으로 적용되며 HA/Comma 재시작·태그/릴리즈·실차 소스 수정은 수행하지 않았다. Linux `Direct receiver validation` CI 39137247044 성공 확인: https://github.com/helico717/carrot-ha/actions/runs/39137247044 .

## 2026-10-17 — 대시보드: 배터리 사용량 계산 엔진 미래 타임스탬프 오염 차단 및 측정 시각 정렬 보정

- 이유: 대시보드 배터리 사용량 주간 그래프에서 특정 요일(일, 월, 화, 목, 금)의 사용량이 빈 값(`None`)으로 누락되고 수요일과 토요일 저녁 일부만 표시되는 버그 발생. 과거 클라우드 동기화 과정에서 유입된 2건의 비정상 미래 타임스탬프 데이터(10/11에 10/13 날짜, 10/14에 10/17 오후 4시 49분 날짜)가 트리거되면서, `battery_history.py`의 직전 시각(`previous[0]`)을 미래로 점프시켜 이후 유입되는 정상 주행 데이터들을 시간 역전 오류로 판단하여 대량 스킵하던 결함을 해결함.
- 변경 내용:
  1. `custom_components/carrot_ha/battery_history.py`:
     - 인과율 위반 미래 타임스탬프 차단: 수신 시각보다 5분 이상 앞선 측정 시각(`t > obs_dt.timestamp() + 300`) 또는 현재 시각 초과(`t > now.timestamp()`) 샘플을 엄격히 제외하도록 가드 추가.
     - 측정 시각(`t`) 기준 시계열 정렬: DB 쿼리 결과(수신 시각 순)를 실제 측정 시각(`t`) 기준으로 선별 및 정렬(`valid_samples.sort(key=lambda s: s[0])`)한 후 시간 간격을 누적하도록 개선하여, 시계 왜곡이나 네트워크 지연 도착으로 인한 `previous` 포이즈닝 원천 차단.
- 검증 및 배포 상태: 실제 HA SQLite DB(10,222건 상태 이벤트) 대상 단위 테스트 및 시뮬레이션 완료. 누락되었던 10/11(4.1%), 10/12(47.2%), 10/13(34.0%), 10/14(42.1%), 10/15(0.2%), 10/16(20.6%), 10/17(15.3%) 전체 배터리 사용량이 100% 정상 복구됨을 검증. SSH/SCP를 통해 HA 서버(`hassio@192.168.0.140`)의 `/config/custom_components/carrot_ha/battery_history.py`에 직접 배포 완료.
  - HA 백업 경로: `/config/carrot_ha/deployment-backups/battery-history-fix-20261017_232638/`
  - SHA-256 일치 확인: `9f36e763f1040f723890da434167160038857faaaf2df9c5db6a2e12fbf543f7`
  - 사용자 HA 재시작 후 적용됨. GitHub 릴리즈/태그는 정책에 따라 발행하지 않음.

## 2026-10-17 — 대시보드 및 차계부: 모바일 다이나믹 아일랜드 세이프 에어리어 대응 및 순수 CSS 정적 탭 빔 회전 수정

- 이유: 모바일(아이폰 16 Pro Max 등)에서 플로팅 로딩 버블이 다이나믹 아일랜드 캡슐에 가려지는 문제, 상단 메뉴가 보이는 상태에서도 플로팅 버블이 노출되거나 렌더링 후 observer가 끊기는 문제, Houdini `@property` 미지원으로 모바일 WebKit에서 애니메이션이 멈추거나 네비게이션 바 전체가 회전하는 오류를 해결함.
- 변경 내용:
  1. 플로팅 버블 위치 전 기종 대응: `top: max(72px, calc(env(safe-area-inset-top, 0px) + 64px));`로 다이나믹 아일랜드/노치 영역과 겹치지 않도록 충분한 여유 공간 확보.
  2. 순수 CSS 회전 빔 적용: CSS Houdini `@property`를 완전히 제거하고, `.nav`는 정적(stationary)으로 유지하면서 가상 요소 `::before`에만 `transform: rotate(360deg)`를 적용해 상단바 전체가 도는 버그 방지 및 iOS WebKit Safari 100% 하드웨어 가속 회전 지원.
  3. 스크롤 아웃 정밀 감지 및 Observer 재연결: `rect.bottom <= 10` 기준으로 탭 바가 완전히 화면 상단 밖으로 사라졌을 때만 플로팅 버블이 나타나도록 보정하고, `build()` 시 detached된 노드를 다시 감지하도록 재연결 로직 보강.
- 검증 및 배포 상태: Node 단위 테스트(12건) 통과. SSH/SCP를 통해 HA 서버(`hassio@192.168.0.140`)의 `/config/custom_components/carrot_ha/frontend/` 경로로 직접 배포 완료.
  - 최신 SHA-256 검증 결과 (로컬과 원격 100% 일치):
    * `carrot-vehicle-journal.js`: `f627cec45fb84468ec65613ae0b765fec0f1eca80bd0cafb82617bf527f5bed7`
    * `carrot-dashboard-ko.js`: `56c7c53aa5c18b355c1db23906a0059821ca407013918187ca0a81981fa4c103`
    * `carrot-dashboard-en.js`: `c968035b8e4e4dc7b23b4be0e994023a25e7e9ef942715a28720602c979ae5cd`
  - GitHub 릴리즈/태그는 정책에 따라 발행하지 않음 (추후 통합 프리 릴리즈 발행 예정).

## 2026-10-17 — 대시보드 및 차계부: 상단 탭 코닉 빔 및 플로팅 트리플 펄스 닷 로딩 인디케이터 적용

- 이유: 사용자가 선택한 후보 1(트리플 펄스 닷, Triple Pulsing Dots) 로딩 인디케이터 스타일을 차량 대시보드(한국어/영어) 및 차계부에 반영함. 탭 바 테두리에 코닉 그라디언트 회전 빔을 적용하고, 스크롤 다운으로 상단 메뉴가 시야에서 벗어날 경우 화면 최상단 중앙에 3단 바운스 닷 플로팅 버블이 표시되도록 구현.
- 변경 내용:
  1. `custom_components/carrot_ha/frontend/carrot-dashboard-ko.js`, `carrot-dashboard-en.js`:
     - `@property --carrot-beam-angle` 및 `:host([data-loading="true"]) .nav` 코닉 빔 회전 애니메이션(`carrotTabBeamSpin`, 1.35s) 추가.
     - 대시보드 고유 일렉트릭 블루 포인트 색상 토큰 정의 (다크 모드 `#60a5fa`, 라이트 모드 `#2563eb`).
     - 플로팅 버블 `.carrot-floating-bubble` 마크업 및 트리플 펄스 닷 CSS (`carrotBubbleDotBounce` 1.2s, 딜레이 -0.32s, -0.16s, 0s) 추가.
     - `IntersectionObserver`를 활용하여 `.nav`가 화면 밖으로 스크롤 아웃될 때만 버블이 부드럽게 노출되는 감지 로직 구현.
     - `load()` 시작 시 `data-loading="true"` 설정 및 완료 시 제거.
  2. 접근성: `prefers-reduced-motion: reduce` 지원으로 모션 최소화 환경에서 애니메이션 비활성화.
- 검증 및 배포 상태: Node 단위 테스트(12건) 통과. 사용자 지시에 따라 릴리즈/태그 없이 HA 서버(`hassio@192.168.0.140`)의 `/config/custom_components/carrot_ha/frontend/`에 SSH/SCP로 직접 파일 동기화 완료.
  - HA 백업 경로: `/config/carrot_ha/deployment-backups/loading-indicators-42489a3/`
  - SHA-256 해시 검증 (로컬과 원격 100% 일치):
    * `carrot-vehicle-journal.js`: `f330ea7868a161ef678a6ff1f65f82e8da2e559e2ec565f64412d322e6459c46`
    * `carrot-dashboard-ko.js`: `b7aa567f78805af835fb6631d1f2b7e9348e60c60c91e950addc37d4f05d95f6`
    * `carrot-dashboard-en.js`: `5911a3c2567bbf8da1d18e9bf29d177b8ace30a43706e95200e9aa4303118c8c`
  - GitHub 릴리즈/태그 발행 없음 (추후 프리 릴리즈 발행 시 일괄 반영). 브라우저 강력 새로고침(`Ctrl + F5`) 시 즉시 적용됨.

## 2026-10-17 — UI 변경 시 사전 인터랙티브 HTML 프리뷰 필수 절차 문서화

- 이유: 사용자가 UI 변경 요청 시 실제 반영 전에 전체 기능 구현 및 더미 데이터 기반의 인터랙티브 HTML 프리뷰를 먼저 보여주는 프로세스를 AGENTS 문서에 추가하도록 요청함.
- 변경 내용: `AGENTS.md`, `driving-logs/AGENTS.md`, `vehicle-journal/AGENTS.md`, `.agents/rules/vehicle-journal.md`에 실제 프로덕션 모듈 100% 미러링 + 합성 더미 데이터 기반 로컬 HTML 프리뷰 생성 및 테마 색상·둥근 모서리(`border-radius`)·카드 경계(`overflow`) 사전 검증 지침 추가.
- 관련 파일: `AGENTS.md`, `driving-logs/AGENTS.md`, `driving-logs/CHANGELOG.md`, `vehicle-journal/AGENTS.md`, `.agents/rules/vehicle-journal.md`, `vehicle-journal/CHANGELOG.md`.
- 검증 및 배포 상태: 지침 문서만 변경되었으며 주행 로그·대시보드·차계부 실행 코드는 변경하지 않음.

## 2026-10-15 — 사용자 정정: 왼쪽 상시 지도와 원본 Carrot Routes 리플레이 V2

- 사용자가 이전 구현의 요구 해석 차이를 정정함. 지도 팝업이 아니라 왼쪽 상시 한반도 전체 idle 지도. 주행/세그먼트 선택 시 해당 전체 주행 경로, 세그먼트 선택은 경로 유지+위치 점 표시. 세그먼트 점3개 메뉴의 리플레이 아래 리플레이 V2 추가, 첨부 Carrot Routes 원본 화면으로 이동.
- 원본 확인: openpilot tools/carrot_route_vault/{viewer.py,radar_view.js,radar.py}, production radar_web_export.py/radar_validation_replay.py. 단순 원본 replay insights 연결로 대체한 이전 작업은 이번 명시 요구를 충족하지 않았음을 기록한다.
- 직접 반영/프리릴리즈 금지/운영 원본 공개 금지/Comma 소스 직접 수정 금지 유지. 원본 화면·실제 재계산 엔진을 고정 Git 소스로 가져오고 HA 인증/NAS 파일 경로에 어댑터로 연결한다. 엔진은 HA 라이브 처리와 분리한 제한된 자식 프로세스로 실행, 분석 파생물은 임시 디렉터리/용량 제한. 의존성·보관 정책·재시작 요구와 검증 결과를 후속 기록한다.
- 구현: 왼쪽 상시 Leaflet 지도(초기33~43N/124~132E), 모바일 목록 위280px. 주행 미리보기/제목/경로 선택, 세그먼트 행 선택은 지도 선택으로 처리하며 영상은 메뉴에서 재생한다. 같은 주행 선택은 경로를 다시 내려받거나 제거하지 않고 위치 점만 이동한다. 다른 주행 선택/종료 시 이전 Worker 중단. 원본 wide CSS의 고정 높이와 지도 z-index가 목록/메뉴를 가리는 문제도 범위 한정 CSS로 보완했다.
- V2: 원본 Git 5d69d6ae6904be65f00858a79bc861269291ce53에서404개 소스/스키마/DBC/LICENSE를1,838,188byte zip으로 재현 포장. SHA256 검증 추출 후 실제 production 엔진을 별도 프로세스로 실행한다. numpy>=2.0.0/pycapnp2.2.2/zstandard0.25.0 manifest 추가, 버전 불변. 작업1개/최대4개/300초/주소공간1.5GiB, 임시gzip128MiB 캐시·원자적 게시·통합 unload 정리. 라이브 HA log lock은 분석 완료를 기다리지 않는다.
- 인증: V2 페이지/manifest/레이더/파일은 기존 entry 세션 인증, 파일 이름과 선택 세그먼트 번호 검증. 원본 분석 도구 명령은 선택 세그먼트만 허용하는15분 읽기 capability(최대8/entry/메모리)를 발급하며 전체 HA 토큰을 내보내지 않는다. 원작자 서버 연결/실제 전송 없음. 원본 코드·생성기·HTTP/runner/jobs·문서·테스트/CI가 관련 파일이다.
- 로컬 검증: Python 주행 로그30건 통과. 실제 합성 Cap'n Proto 로그→원본 load_frames→ProductionDPathSelector→export_frames→별도 runner→gzip 캐시/정리 통과. HTTP 소켓은 HA/NAS-only 파일 Range, V2 인증/선택 번호/파일 whitelist, 도구 다른 route/entry 차단 및 만료401 통과. 기존 dashboard/GPS Node13건 통과.
- Chromium: 상시 idle 지도/현지 날짜/실제 Leaflet vector canvas/경로 유지·점 이동/메뉴 V2 위치/모바일 overflow/외부 라이브 소켓0 통과. 원본 V2는 합성 영상의 실제 픽셀·영상/레이더 seek·센서 변경·canvas/그래프·분석 도구3종 표시·desktop/mobile 통과. 기존 원본 로그 UI/전송/플레이어 및 HUD GPU 회귀 통과. MediaRecorder 테스트 영상은 HTTP Range 없는 mock의 seek 제한으로 Blob URL fixture를 사용했으며 운영 HTTP Range는 별도 소켓 테스트로 검증했다.
- 아직 운영 반영/HA 새 의존성 설치·재시작 후 실제 레이더 데이터/실제 외부 분석 도구 실행은 미확인. 다음 단계는 커밋·main push·HA 변경파일 백업/직접 설치/해시 검증·Linux CI 확인이다. 신규 릴리즈/태그 없음.
- 배포 전 공식 PyPI 메타데이터에서 원본 pycapnp2.2.2의 cp314 Linux wheel 부재를 발견했다. HA에서 소스 빌드를 요구하지 않도록 cp314 manylinux2_28 x86_64/aarch64 wheel이 있는2.2.4로 manifest/CI를 변경하고 같은 엔진 테스트를 재수행한다. zstandard0.25.0 cp314 Linux2개 빌드도 확인. 로컬 테스트는 Python3.12이며 실제 HA3.14 의존성 설치 성공은 사용자 재시작 후 별도 확인 대상이다.
- pycapnp2.2.4 재검증: Python30건 전부 통과. 설정/NAS 상태 Chromium도 통과. V2 영상 seek 검증은 영상 Blob fixture에서1.5초와 렌더링 픽셀 확인. 원본 HTTP Range는 NAS-only 포함별도206 검사 유지. 기본 보관5GB/30일 및 저장 데이터에는 이번 변경 없음.
- 실행 코드57d5a6a79459c2127c2050247c1df13414de9f19 main 푸시 후 HA13파일 충돌검사·백업·직접 설치·SHA256 전부 일치. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-57d5a6a79459/before. HA HTTP 지도JS/CSS/V2 HTML/JS4개200 확인. Linux 전체 회귀38700280073 success (https://github.com/helico717/carrot-ha/actions/runs/38700280073), 새 원본엔진 subprocess 검사도 포함. 아직 사용자 재시작 전이며 backend 활성화/운영 분석 완료로 보고하지 않는다.
- 마지막 스크린샷 점검에서 모바일 지도 toolbar 줄바꿈으로 상태 footer가320px 패널 밖에 숨을 수 있는 문제를 보완했다. toolbar를 한 줄로 고정하고 지도 최소 높이를120px로 조정, footer가패널 안에 들어오는 assertion 추가. 이 좁은 화면 보완을 추가검증·커밋 후 재반영한다. 앞선 모바일 검증은 가로 overflow 중심이었고 세로 footer를 놓친 한계를 기록한다.
- **최종 직접 반영:** 모바일 보완 c2560c4c123a32633477cedc60b320180d35eb33 main 푸시, Chromium 지도 재검증 통과·스크린샷 footer 직접 확인. HA CSS1파일 충돌검사/백업/설치/SHA256 일치, 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-c2560c4c123a/before. 실제 HA HTTP200 및320px/toolbar 보완 문자열 확인. Linux 전체 회귀38700585160 success (https://github.com/helico717/carrot-ha/actions/runs/38700585160).
- **사용자 단계/미확인:** 새 분석 의존성과 HTTP 경로 활성화를 위해 사용자 HA 재시작 후 브라우저 강력 새로고침 필요. 에이전트 재시작·Comma 수정·외부 원작자 서버 접근·릴리즈/태그 발행 없음. 실 운영 rlog의 GPS/레이더 신호와60초 전체 분석 시간, HA 의존성 설치·실제 외부 도구 실행은 아직 검증하지 않았다. 파일 배포/합성 검증/실운영 검증을 구분한다.

## 2026-10-15 — 날짜 탐색·실제 GPS 지도·분석 연결 작업 중

- 사용자 요청: 날짜 선택기, 해당 실제 주행 지도 구간, 로그 분석 화면 연결. 첨부 Carrot Routes 레이더 검증 화면은 참고이며 임의 외부 서버 접근·로그 공개 권한이 아니다.
- 원본 조사: carrot_logs replay에는 이벤트/그래프/전방 센서/상세 분석과 별도 sensor/advanced worker가 있다. openpilot/tools/carrot_route_vault/radar_view.js는 production radar_web_export 서버 재계산 결과를 요구한다. HA에 이 엔진이 없는데 재계산한 것처럼 표시하지 않으며 이번 연결은 기록된 로그의 원본 분석 화면으로 명확히 구분한다.
- 구현 방향: HA+NAS union catalog에 기간 필터/달력 메타데이터 추가. 목록의 날짜/주행 선택 상태와 스크롤 보존. Leaflet 기존 번들로 선택 주행의 rlog GPS 실제 좌표 표시, 세그먼트별 선택과 영상 시점/원본 분석 연결. 원본 decoder GPS 전용 모드로 필요한 로그만 순차 처리하며 숨김·닫기 시 중단, 원본 로그/GPS 외부 업로드 없음. 지도 타일은 기존 대시보드와 같은 OSM이며 타일 요청은 외부 지도 서비스에 전송됨.
- 관련 예정: driving_logs/{store,tiered,http}.py, carrot_logs HA 탐색 연결부·원본 replay worker, 합성 테스트·복구 문서. 아직 검증·배포 대기. 프리릴리즈/태그/Comma 변경 없음.
- 구현/검증: 기간 필터는 주행의 시작/종료 겹침을 페이지 나누기 전에 적용하고 NaN/음수/역순 구간을 거부한다. 달력 메타데이터도 기존 entry 세션 인증 유지. Python 주행 로그29건 통과, GPS 전용 worker 선택서비스/invalid 이벤트/빈 GPS/기본 replay 유지 Node 검사 통과.
- Chromium: 현지 자정 날짜 범위·기록일 이동·실제 Leaflet 좌표 vector canvas 비어 있지 않음·Worker 중단·desktop/mobile overflow·선택 세그먼트의 원본 분석 연결·라이브 소켓0 통과. 지도 테스트는 합성 GPS/테스트 타일이며 운영 GPS 내보내기 없음. 기존 로그 UI/로딩 및 HUD GPU 두 회귀 시나리오 통과. 스크린샷 직접 확인.
- 구현 보완: 점 상한 약60,000/화면 및8세그먼트 메모리 캐시, GPS 시간/경도/위도/fix 검증, 공백5초/도약250m 분리. 지도에서 GPS 없는 구간 선택 시 이전 구간 마커를 남기지 않는다. replay에서 지도 열면 영상 일시정지·현재 구간/시점 유지. 기본 calendar API 미활성 시 잘못된 필터 표시 대신 비활성/재시작 안내.
- 반복 지도 파일 조회가 전체 목록/용량 rglob를 매번 수행하지 않도록 BrowserView는 routes/recent에서만 페이지를 만든다. 기존 파일 인증/범위 응답/보관 정책은 유지한다. GPS worker Node 회귀를 기존 Linux CI에 추가. docs/DRIVING_LOG_NAS.md·SOURCE.md에 데이터 경로/외부 타일/기록 분석과 서버 재계산 차이를 기록한다.
- 최종 로컬 검증: Python29건, JS13건(기존 dashboard12 + GPS worker), 탐색/설정/HUD Chromium 3시나리오 모두 통과. 원본 UI/로딩 시나리오도 앞서 통과. GPS worker 검사는 stub 선택서비스 검사 외 실제 raw_capnp schema에 합성 Event/GpsLocationData wire(위도37.5/경도127/hasFix)를 넣어 builder 전체 decoding을 통과시켰다. 운영 원본 GPS가 아니라 합성 좌표이며 실제 로그 공개/추출 없음.
- 아직 운영 표시/실제 영상 분석/실제 GPS 자료의 신호 유무는 미확인. 합성 지도 타일 이미지로 기본 vector 위치·비어 있지 않음·모바일 배치를 검증했으며 실제 외부 지도 서비스의 연결 성공과 구분한다. 달력·기간 필터 Python 새 코드 활성화에는 사용자 HA 재시작 필요. 에이전트 재시작 없음.
- **배포 완료:** 실행 코드 6f6a69444d01b4663b84d777d1124a004848668c main 푸시. 기존0d6d2e0 대비 HA 변경10파일 충돌 검사 통과·백업·직접 설치·SHA256 전부 일치. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-6f6a69444d01/before. HTML/explorer/bridge/replay-loader/GPS-worker/Leaflet JS/CSS 실제 HA HTTP 경로7개 모두200 확인. 원본 로그/NAS index·보관 설정·차계부·Comma 변경 없음.
- **Linux CI 성공:** Direct receiver validation 38695754426 success (https://github.com/helico717/carrot-ha/actions/runs/38695754426), 기존 전체 Python 회귀와 새 GPS wire Node 검사를 포함한 JS13건 실행. 로컬 브라우저 검사와 구분한다. 프리릴리즈/새 태그/버전 발행 없음.
- **활성화/미확인:** 사용자 HA 재시작 후 Ctrl+F5 필요. 날짜 API 활성화·운영 rlog GPS 존재/지도 타일 연결·실제 NAS-only 주행 분석 화면 재생은 이후 운영 확인 대상이다. 원본 리플레이 HUD/기록 분석 연결은 구현했지만 첨부 Carrot Routes 서버 production 레이더 재계산 엔진 이식은 별도 미구현으로 명확히 남긴다. 사용자 동의 없는 서버 접근/시험 업로드 없음.

## 2026-10-15 — 사용자 재시작 후 운영 확인 중

- 사용자가 HA 재시작 완료를 알림. 에이전트 재시작/보호 모드 해제 없음. 읽기 전용 검사 시작.
- 첫 조사: HA 318 complete/11주행/5,022,909,521바이트 유지, NAS 321세그먼트 중 320 complete(나머지 수신 중), 5,072,387,952바이트 예약. 기존 HA 318개 manifest 모두 NAS와 일치, 누락·불일치 0. NAS 추가 로그 수신은 실제 Core 활성화 이후 진행되는 것으로 관측.
- 복제 재검증 marker 184개 확인. HA 초기 5.02GB는 검증 완료 전 원본을 유지하는 이행 상태이며 아직 5GB 회수 완료로 보고하지 않는다. inspector에 replica_verified 수와 NAS-only 세그먼트/HA 주행의 NAS 형제 누락 집계를 추가해 후속 확인한다. UI 실제 재생·실 클린 설치 복구는 별도 미확인.
- **재시작 후 자동 회수 확인:** HA 10주행/238 complete/3,733,414,866바이트(디스크 3,733,600,006). NAS 12주행/329세그먼트 중328 complete/1수신중, 완료328개 replica_verified. HA 238개 전부 NAS manifest 일치, 누락·불일치0, HA에 남은 주행의 NAS 형제 누락0. NAS-only complete90개. 기존11→10주행/318→238세그먼트로 전체 묶음 회수, NAS 기록은 보존. NAS earliest 1791872115.247472로 이전 HA 수신 경계보다 오래된 기록의 실제 backfill 확인. Comma 전체 잔여 파일 수는 여전히 미확인.

## 2026-10-15 — 로그 설정·시놀로지 상태 메뉴 및 원본 로딩 표시 작업 중

- 사용자 요청: 상단 우측 설정, 차계부 설정의 좌측 분류/우측 내용(모바일 상단 분류) 참고, 시놀로지 상태 메뉴, HA 보관 요약을 당근웹 로그 제목 옆으로 이동. 추가 요청: HA Driving Log 임시 썸네일 대신 원본 당근웹 로딩 애니메이션 사용.
- 차계부 구현/디자인은 읽기 참고만 하며 차계부 실행 코드·데이터·설정은 변경하지 않는다. 로그 전용 모듈 carrot-logs-settings.js와 기존 카드/iframe의 출처·프레임·entry base 검증 메시지로 연결한다. 보관 정책/시놀로지 상태·수동 새로고침·오류·닫기/ESC·기기 전환 초기화를 추가한다.
- 기존 로그 인증 범위의 GET dashcam/storage: 실제 NAS 연결 확인·경로·보관량/주행/세그먼트/검증수·NAS 여유 공간·확인 시각·유지 단계 제공. NAS IO는 executor/로그 lock 아래 수행하며 화면에서 파일을 임의 이동·삭제하거나 설정을 변경하지 않는다.
- 임시 SVG 텍스트 썸네일 응답 제거(204). 실제 영상 프레임이 준비되기 전에는 원본 dashcam-segment-thumb/is-thumb-loading의 logsThumbSweep 애니메이션을 그대로 재사용한다. 준비된 실제 영상 프레임 캐시·표시와 가시성 제한은 유지하며 원본 generated JS/CSS는 수정하지 않는다.
- 관련: driving_logs/{http,tiered}.py, frontend/carrot-logs-{card,settings}.js, carrot_logs/{ha_logs_bridge,ha_log_thumbnails}.js/ha_layout.css, 테스트/inspect. 로컬·브라우저 검증 및 직접 배포 대기. 새 Release/태그 없음.
- 로컬 Python 주행 로그 28건 통과. 인증 없는 storage 조회401, NAS-only 상태/보관량/검증수/공간, thumbnail204 및 빈 응답 검증 추가. NAS 연결 단절 상태는 NAS 미연결로 표시하고 HA 캐시 조회를 유지한다.
- Chromium 설정 검사 통과: 제목 옆 용량·분류 전환·NAS 상태·수동 새로고침·ESC·desktop/mobile 경계·가로 overflow 없음·다른 frame/entry 메시지 거부. 원본 로그 UI 검사도 통과하며 지연된 영상 응답에서 실제 원본 logsThumbSweep 애니메이션 확인, HA Driving Log 표시 없음, 영상 프레임 준비 후 실제 썸네일 표시 확인. 스크린샷 작업 임시 폴더 보관, 개인 원본 영상/GPS 내보내기 없음.
- 최종 재검사: Python 28건, 원본 UI/로딩·HUD GPU Chromium 2개 시나리오, 기존 dashboard live/lazy/view-state JS 10건 통과. 설정 창 스크린샷 desktop/mobile 직접 검토: 제목/행/긴 경로/스크롤 정상. HA ha-icon(mdi) 사용이며 테스트용 독립 페이지에는 HA 아이콘 구현이 없어 아이콘 버튼 내부 렌더는 실 HA 확인 대상으로 구분한다.
- **커밋/배포 완료:** 9e79eff76c506ed99274b6a1eac494b796dbb4df main 푸시. 기존 설치 기준 58db756 대비 변경7파일 preflight 통과·백업·직접 설치·SHA256 전부 일치. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-9e79eff76c50/before. 정적5파일(card/settings/ha_layout/bridge/thumbnails) 실제 HA HTTP 경로200 확인. 기존 데이터·NAS 설정·차계부·Comma 수정 없음.
- **CI:** 최종 실행 코드 Linux 전체 Direct receiver validation 38674294274 success (https://github.com/helico717/carrot-ha/actions/runs/38674294274). 새 버전/태그/Release 발행 없음.
- **사용자 활성화 단계:** 새 화면은 강력 새로고침(Ctrl+F5). 이번 추가 NAS 상세 storage API와 빈 thumbnail 응답은 Python 변경이므로 사용자 HA 재시작1회가 필요하다. 재시작 전 설정은 기존 routes 응답으로 기본 상태만 표시하고 상세 정보 재시작 필요를 안내한다. 에이전트는 HA를 재시작하지 않았다. 실제 운영 설정 메뉴/상세값/원본 로딩 표시 확인은 새로고침 및 사용자 재시작 후 대기. 이번 전 단계의 5GB 전체 주행 회수/추가 과거 로그 수신은 실제 확인 완료 상태다.

## 2026-10-15 — HA 5GB + 본인 NAS 30일 보관 작업 중

- 최신 사용자 지시: 프리릴리즈/새 태그를 발행하지 않고 HA 직접 반영. 모든 조사·변경·검증·배포 상태를 이 기록에 남긴다. 이전 beta.1은 이미 발행된 별개 작업이다.
- 대상 NAS: 기존 NFS CarrotJournalBackup 아래 /share/CarrotJournalBackup/driving-logs 전용 폴더. 차계부·surveillance 자료는 수정하지 않는다. NAS 오프라인을 관측한 것이 아니며 연결 단절 처리는 예방적 예외 정책이다.
- 읽기 전용 운영 조사: 설치된 LIMIT=10,000,000,000. 318개 세그먼트 모두 complete, 11개 주행, 예약 5,022,909,521바이트/디스크 5,022,963,059바이트. 과거 수신 floor=1791872800.9820297(한국 10/13 15:26:40.982). Comma sender는 floor 이전을 재전송하지 않으므로 제한 증액만으로 과거 로그가 복구되지 않는다. 실제 Comma 남은 파일 전체 수량은 미확인.
- 구현: store.py 기본 5GB, tiered.py NAS 30일/주행 종료 시각 기준 전체 묶음 만료, HA 최신 전체 묶음 캐시, 검증된 NAS 복제 전 HA 회수 금지, 동일 device_id 기반 신규 HA entry 복구, 통합 조회·NAS 파일 직접 제공. runtime.py 별도 유지 작업, 옵션 NAS 경로·한국어 오류·화면 용량 표시·외부 업로드 NAS 경로 연결.
- scripts/seed_driving_logs_nas.py는 현재 HA index를 수정하지 않는 읽기 전용 스냅샷에서 소유 NAS로 복사하고 SHA256 읽기 재검증한다. 노트북에 원본 로그를 내보내지 않는다. 설정은 복사 성공 후 저장하며 HA 재시작은 사용자 수행.
- 로컬 합성 검사: test_driving_logs*.py 22건 중 21 통과/1 companion 경로 미설정으로 생략. 신규 tiered 7건 포함. 실제 송신기 경로를 지정한 재검사·설정/브라우저 검사·운영 NAS 복사·직접 배포는 아직 대기. 실제 로그 삭제/이동, HA 재시작, 새 Release 발행 없음.
- 관련 파일: driving_logs/{store,tiered,runtime,http,upload}.py, __init__.py/config_flow.py, strings/translations, ha_logs_bridge.js, tests/test_driving_logs*, tests/test_receiver_options.py, scripts/{inspect_driving_log_storage,seed_driving_logs_nas}.py. 후속 결과를 아래에 누적한다.
- 후속 검증: companion openpilot 경로 지정 후 기존 22건 전부 통과. NAS 전용 HTTP 리플레이·영상 Range·인증·원작자 업로드 요약 1건 추가 통과. 설정 우선순위/명시 비활성 및 unload 시 실행 중 인덱스 writer 종료 대기 2건 통과. 직접 수신기 관련 18건, 기존 history_cache/incremental_sync 6건 통과. 대시보드 JS 10건 및 원본 로그 UI/HUD Chromium desktop/mobile 2개 시나리오 통과. 처음 옵션 검사는 voluptuous 미설치로 실행 실패했으며 임시 의존성 폴더 설치 후 통과(제품 의존성 변경 아님).
- 운영 NFS dry-run: nas_mount=verified/devices=1. 사용자 소유 NAS로 318세그먼트 복사·SHA256 읽기 재검증 진행 중. 현재 HA index는 수정하지 않으며 5GB 축소는 새 코드의 사용자 재시작 후 유지 작업에서 수행한다. 새 태그/Release/Comma 소스 변경 없음.
- 운영/복구 문서 docs/DRIVING_LOG_NAS.md 추가, CLEAN_INSTALL_RECOVERY.md/DEVELOPMENT_WORKFLOW.md에 현재 직접 반영 예외와 복구 연결 기록. HA 백업에 NAS share/media가 중복 포함되는지 사용자의 백업 설정 확인이 필요하며 자동 제외를 주장하지 않는다.
- 최종 주행 로그 검사 25건 전부 통과(생략 없음). 복원 유지 작업은 파일시스템 복사 시 파일 단위 fsync + 전체 SHA256 commit/읽기 재검증을 사용해 HTTP 청크마다 fsync하는 수신 경로와 분리했다. 사용자 재시작/옵션 reload는 기존 executor 인덱스 쓰기 종료까지 기다려 중복 writer를 방지한다. 진행 중 초기 운영 복사 프로세스는 시작 시점 코드를 그대로 실행하며 변경된 코드로 중복 실행하지 않는다.
- c68bb6b 커밋/main 푸시 완료. HA base 4efda17 비교 preflight 통과, 변경 10파일 백업·직접 설치·SHA256 전부 일치. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-c68bb6b5c385/before. 재시작하지 않았으므로 실행 활성화 대기. CI 38671493431 진행 중.
- 설치 후 최종 코드 재검토에서 NAS 경로 확인/파일 stat의 이벤트 루프 blocking 가능성을 발견해 보완 중: 업로드 경로 확인은 entry 로그 lock 아래 executor, replay 크기는 검증 manifest를 사용한다. NAS-only 파일→합성 원작자 프로토콜 서버 전송 회귀 검사를 추가한다. 실제 원작자 서버로 시험 로그를 전송하지 않는다.
- 보완 완료: defbf47 커밋/main 푸시, 주행 로그 26건 전부 통과. HA c68bb6b 대비 보완 2파일 직접 설치·해시 일치, 백업 driving-logs-hud-defbf47dfff9/before. HA 재시작 없음. 첫 코드 c68bb6b의 Linux 전체 CI 38671493431 success 확인(https://github.com/helico717/carrot-ha/actions/runs/38671493431). defbf47 최종 CI는 후속 확인한다. NAS 복사 145/318, 2,269,381,593바이트 검증 시점까지 오류 없음.
- defbf47 Linux 전체 CI 38671747018 success 확인(https://github.com/helico717/carrot-ha/actions/runs/38671747018).
- 마지막 안전성 보완: NAS 복제의 수신 complete와 HA 원본 회수 허용 replica_verified를 별도 영속 기록한다. 읽기 재검증 실패 후 다른 파일의 catalog 갱신으로 실패한 복제까지 회수 허용되는 위험을 막는다. 기존 marker 없는 복제는 유지 작업에서 다시 읽어 검증한다. 현재 실행 중 초기 seed는 이전 코드라 marker가 없고, HA 재시작 후 안전 재검증을 거친 뒤에만 5GB로 줄어든다. 재검증 실패/기존 marker 이행 회귀 검사 추가.
- 743b75c 커밋/main 푸시 완료, 28개 주행 로그 검사 전부 통과. HA tiered.py 1파일 추가 직접 반영·해시 일치, 백업 driving-logs-hud-743b75c769d5/before. HA Core 내부 마운트 추가 확인을 위한 docker ps 읽기 검사는 SSH 앱 Protection mode로 거절됨. 보호 모드를 끄거나 우회하지 않았다. SSH 앱에서 NFS 실제 마운트 검증 및 NAS 복사 정상과 구분하며, Core 새 코드 활성화/마운트·혼합 목록 운영 확인은 사용자 재시작 후 대기한다.
- 최종 실행 코드 743b75c Linux 전체 CI 38672082538 success 확인(https://github.com/helico717/carrot-ha/actions/runs/38672082538). 프리릴리즈/버전/태그 변경 없음. inspect 도구에 읽기 전용 NAS 개수·용량·파일 해시 개수 집계를 추가해 초기 복사 후 독립 대조에 사용한다.
- **운영 NAS 초기 복사 완료:** 1,170초, 11주행/318세그먼트/5,022,909,521바이트, 954파일 SHA256 검증 및 NAS 게시본 읽기 재검증 성공. /share/CarrotJournalBackup/driving-logs 전용 소유 NAS에만 복제. seed 종료 코드 0, settings=saved, ha_index=untouched. 기존 차계부·surveillance와 원작자 서버는 변경하지 않았다.
- **독립 대조:** inspect 실행 종료 0. HA 318 complete/0 incomplete/11주행, NAS 318 complete/11주행/동일 5,022,909,521바이트/954개 파일 해시. HA complete와 NAS manifest 318개 전부 일치, 누락·불일치 0. HA index/floor 및 원본 파일을 초기 복사 도구가 변경하지 않았고 현재 디스크 5,022,963,059바이트 유지. 설치 소스 LIMIT=5,000,000,000 확인. 기존 HA 사용량이 아직 5GB보다 큰 것은 재시작 전 원본을 유지한 의도된 상태다.
- **현재 설치/활성화 구분:** 실행 코드 최종 커밋 743b75c. 첫 10파일 설치 후 defbf47 2파일·743b75c 1파일 보완 모두 백업/해시 일치. 초기 base 4efda17 대비 최종 10파일 preflight도 통과. /config/carrot_ha/driving-logs-settings.json에 기기별 NAS 경로 저장 완료. 사용자 HA 재시작 후 유지 작업이 legacy replica를 안전 재검증한 뒤 최신 전체 주행 묶음만 5GB 이내 캐시로 남긴다. 오래된 묶음은 NAS 30일 보관 창에서 계속 조회한다.
- **미확인/사용자 단계:** HA Core 재시작은 수행하지 않았다. Core 내 실제 NFS 접근, 혼합 목록/실제 NAS 리플레이, 5GB 자동 회수, 신규 Comma 전송·과거 30일 backfill 및 실 클린 설치 복구는 사용자 재시작 후 운영 확인 대상이다. 합성 검사 통과와 실운영 완료를 혼동하지 않는다. NAS 공유 내용의 HA 백업 포함 여부는 별도 백업 설정 확인 항목이다. Comma Git/source 변경·기기 접속/재부팅 없음. 새 Release/태그/버전 발행 없음.

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

## 2026-10-14 — 운영 진단 앱 적용 및 기존 검사 대조

- 공식 Supervisor 백업 포함 update로 수신 앱 0.1.3 설치/started 확인.
  외부 health 200/0.1.3, 새 traffic_summary에서 상태 업로드·HA archive ACK·설정·터미널 게시/조회 200 확인.
  HA Core/Comma 재부팅 없음. HA 화면/옵션 변경은 HACS 설치 후 사용자 재시작 대기.
- Windows 전체 47개 HA 단위 검사 파일 중 46개 통과. archive_compression은 기존 SQLite
  임시 파일 정리의 Windows 잠금 2건 실패. 운영 Linux 검사로 구분 확인 예정.
- Linux 재실행 38576921798: 이전 cloud_sync 검사가 압축 복원 함수를 namespace에 제공하지 않아 실패.
  tests/test_cloud_sync.py에 실제 cloud_archive.restore_page를 연결; 8건 로컬 통과.
  사업 로직/기존 fallback 동작 변경 없음. Linux 전체 재검사와 베타 발행은 아직 대기.
- 관련: tools/run-unit-suite.py, 테스트 연결부, 새 복구 안내·감사 목록·릴리즈 노트.

## 2026-10-14 — 배포 전 Linux 검사 실행 환경 보완

- main 게시 ceeb00c, Comma 게시 d5879396da460d8fde85171f88d90cfde0d721d4 확인.
- Linux CI 38576620969는 충전 순수 함수 검사에서 HA 통합 초기화를 잘못 불러
  Home Assistant 미설치 import 오류로 중단. 운영 코드 결함으로 단정하지 않음.
- tools/run-unit-suite.py로 실제 단위 검사 대상 모듈을 실행하되 HA 통합 시작만 분리.
  CI에서 각 기존 suite를 독립 프로세스로 실행하는 조건은 유지. 실패 검사 재검증 후 새 실행 예정.
- 과거 보관 원문의 줄 끝 공백 정리. 수신 앱 0.1.3 스토어 노출 확인, 설치/릴리즈 발행은 아직 대기.

# 주행 로그 변경 기록

## 2026-10-15 — HA 5GB와 사용자 NAS 30일 통합 보관 작업 중

- 사용자 요청: HA 전체 백업 크기를 줄이기 위해 로컬은 최근 5GB, 본인 Synology는
  30일 보관. 주행 묶음 단위 정리 유지, 단일 대시보드 조회·직접 재생, 클린 설치 후
  최근 5GB 복원과 신규 Comma 수신 재개를 연결한다.
- 사용자 확인: 기존 차계부용 NFS 공유 사용. HA SSH 읽기 전용 확인에서
  `/share/CarrotJournalBackup` 존재. 주행 로그는 이 공유의 `driving-logs` 전용
  하위 폴더로 분리하며 차계부 백업·surveillance 자료는 변경하지 않는다.
- 현재 코드 조사: 기존 store는 HA 10GB만 관리하며 NAS 통합 조회/복원은 없다.
  주행 소스의 30일 아카이브와 로컬 캐시를 분리하고, NAS 복사·체크섬 검증 뒤에만
  기존 로컬 로그를 회수하도록 구현한다. NAS 장치 키는 HA entry_id와 독립시킨다.
- 검증·배포: 작업 중. 아직 저장 한도·운영 데이터·NAS 설정은 변경하지 않았다.

## 2026-10-14 — 자체 수신기 진단·표시·전수 문서·복구·0.9 베타 준비

- 사용자 요청: 추천 방식으로 진단 로그 확대, 모든 Markdown과 프로젝트 파일의 이전 서버 의존 점검,
  HA 중심 정리, HA/Comma/둘 다 초기화에 대비한 쉬운 안내 및 완료 후 v0.9.0-beta.1 발행.
- 수신 앱 0.1.3: UTC 시각·요청 식별·익명 차량 번호·저장/ACK/명령 결과·분당 요약,
  기본 INFO, 최대 60분 DEBUG 자동 종료, 동일 오류 30초 제한, 파일 2MiB×4 순환 보관.
  토큰·GPS·원본 본문·인증 헤더·개인 장치 ID·예외 메시지를 로그에 넣지 않음.
- 대시보드/튜너의 고정 Cloudflare 문구 제거, 폐기된 설정 입력란 제거, 기존 비공개 옵션 보존.
- CLEAN_INSTALL_RECOVERY: 3개 초기화 경우·백업 유무·개인 보관 정보·외부 경로 복구·Windows/Mac
  SSH/설정 명령·카메라·성공 확인. tools/receiver-recovery.py는 설치된 Git 설정 CLI만 호출하고 키는 stdin 전달.
- 문서 전수 103개 검토 목록은 cloudflare-retirement-audit에 기록. 과거 설치 안내는 실행 금지 보관,
  과거 서비스 설명 취소선. 원작 Android 및 원작 손님 지원용 선택적 터널은 HA 경로 밖이므로 보존.
- 클린 Comma 설치 조사: direct-connection.json만 있을 때 manager 시작 조건 누락 확인.
  companion openpilot의 시작 조건 보완 및 실제 함수를 분리 실행하는 회귀 검사 추가.
- 관련 파일: addons/carrot_receiver/*, config_flow/strings/ko/frontend 표시, tests/test_receiver_*,
  tests/test_direct_receiver.py, tools/receiver-recovery.py, 모든 감사 표 분류 문서,
  companion process_config.py 및 test_direct_connection.py. 기록/영상의 기존 API·계산·보관 정책 유지.
- 검증: 진단 3건 및 수신 10건 초기 통과. 나머지 검증·Git 게시·앱 운영 반영·릴리즈 확인 진행 중.
  HA Core/Comma 재부팅·새 정상 주행·장기 운영은 별도 사용자 검증. 기존 Worker 배포/DB 변경 없음.

> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](../docs/CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

# 주행 로그 변경 기록

## 2026-10-14 — 애드온 진단 로그 범위 검토

- 사용자 질문: 추후 troubleshooting을 위해 애드온 로그 화면에 모든 로그를 표시하는
  방향의 장단점. 이번 요청은 설계 상담이며 구현 요청으로 확대하지 않는다.
- 현재 receiver.py는 access_log=None, 오류 종류/시간별 정리만 logging 출력하므로
  정상 수신·DB 저장·HA ACK 단계는 로그 화면에서 추적하기 어렵다.
- 권고: 중요 단계의 시각·처리 결과·지연·cursor/건수·오류/재시도·부팅 버전 기록,
  기본 INFO/WARNING/ERROR와 일시 DEBUG, 반복 오류 제한·용량/기간 제한 보관.
  토큰·인증 헤더·GPS/영상/전체 CAN·원본 payload를 상시 로그에 넣지 않는다.
- HAOS 애드온 로그는 해당 앱 로그이다. HA Core/Comma 전체 원본 로그를 자동
  포함하는 화면이 아니며 통합 진단은 별도 연결/권한 설계가 필요하다. 수신기 기존
  telemetry/trip/ACK 이벤트 로그 확대는 Comma 추가 업데이트 없이 가능한 범위다.
- 관련: addons/carrot_receiver/receiver.py와 공식 Supervisor log endpoints.
  코드·설정·배포·기기 Pull/재부팅·릴리즈 변경 없이 조사 기록만 게시한다.

## 2026-10-14 — 대시보드 ~~Cloudflare~~ 상태 문구 조사

- 사용자 첨부: 대시보드 footer에 ~~Cloudflare~~ · ok 잔존.
- 원인: carrot-dashboard-ko.js/en.js footer의 서버 이름이 ~~Cloudflare~~ 문자열로
  고정되어 있다. 상태값은 live_status/cloud_status 공통 키이며 실제 연결 대상을
  나타내는 이름이 아니다. 직접 source 적용 후에도 동일 상태 키를 재사용한다.
- 현재 직접 receiver 적용은 앞선 운영 점검으로 확인. 이번 질문의 표시가 ~~Cloudflare~~
  통신 재개를 증명하지 않는다. 표시 문구 전환 누락과 실제 통신 경로를 구분해 안내.
- 코드 읽기 조사만 수행. 실행 코드·배포·기기 업데이트·재부팅·릴리즈 변경 없음.

## 2026-10-14 — 전환 후 새 당근웹 로그 표시 확인

- 사용자 실기 보고/첨부 화면: 최신 Git·HA에서 22:20:38~22:20:49의 짧은 새 파일
  로그가 당근웹 로그/대시캠 목록에 표시됨. 세그먼트 1개 표시 확인.
- 구분: 첨부 화면은 영상/rlog 파일 로그이며 일반 차량 대시보드 trip 목록이 아니다.
  서버 읽기 확인으로 자체 수신기 trip feed는 0건, cursor=0, has_more=false.
- 확인된 범위: 사용자 업데이트 후 새 파일 로그 HA 목록 표시. 영상 재생·rlog 내용
  전체·일반 주행 내역 업로드·장거리/충전·장기 운영은 이 화면만으로 확인하지 않음.
- 기록만 갱신. 기기 명령·코드 수정·재부팅·새 릴리즈·~~Cloudflare~~ 변경 없음.

## 2026-10-14 — 사용자 재시작 후 직접 연결 운영 확인

- 사용자 보고: HA와 Comma 업데이트/재부팅 완료. HA 원격 터미널 접속과 주차 카메라
  보기를 사용자가 직접 확인했다. 원격 접속 복구 최우선 요구의 실사용 확인으로 기록.
- 서버 읽기 확인: 수신기 0.1.2 started, HA receiver_url 적용, 비공개 일회 setup 소비.
  자체 서버의 상태 이력 HA cursor=103. 마지막 실제 측정 2026-10-14 22:23:51 KST.
  telemetry가 보고한 기기 commit=40148b0dc66744636ea4fcfe270e7365b758a4b5,
  branch=carrot-wip-model_selector-ha로 원격 게시 코드 설치 확인.
- 새 수신기 trip feed는 0건/has_more=false, HA 해당 cursor=0. 기존 HA 과거 기록은
  보존되어 있으며 새 실제 주행 업로드/표시 검증과 장기 부하·백업 복원은 아직 미완료.
- 개인정보/토큰/GPS 원문 미출력. 기기 명령·추가 Pull·재부팅·운영 코드 변경 없음.
  이번 작업은 검증 기록만 커밋·푸시하며 새 버전·태그·Release/Worker 배포 없음.

## 2026-10-14 — 직접 수신 전환 전 기록

- 사용자 요청: ~~Cloudflare~~ 의존을 자체 HAOS 수신 애드온으로 이전하되 기존 기능
  하나도 변경하지 않고, 본격 수정 전에 이유와 전체 보존·복구·검증 기준을 기록.
- docs/direct-vehicle-receiver-plan-2026-10-14.md에 원인·현재 경로·기능 목록·인증/
  cursor/queue-ID·보관·백업·이전·네트워크·가용성 차이·검증/전환 순서를 작성.
- 실행 코드 수정 전 작성. 이전 기능·날짜 기록/설정·결제·파일·안전 차단 보존.
  기존 ~~Cloudflare~~ DB 삭제/기기 수동 소스 수정/에이전트 재부팅/새 Release 발행 없음.
- 검증: 현재 코드 경로와 이전 누적 릴리즈 기록 대조. 실제 애드온/외부 연결 미검증.
  본 문서와 기록을 먼저 커밋·푸시 후 구현 진행 예정.
- 사전 기록은 3c9e4f0로 main 커밋·원격 게시 후 실행 코드 작업 시작.
- 구현 진행: 독립 HAOS 수신기/SQLite/인증/증분 feed/명령 namespace/연결 게시,
  HA 직접 source 설정과 source별 cursor, Git 관리 Comma 영구 연결 설정 모듈 작성.
- 로컬 검증: 수신기 HTTP 8건, HA 증분 5·latest 6·ACK 1·압축 2·history cache 1,
  대시보드 10건 통과. Windows 기본 cp949 읽기 오류는 UTF-8 실행으로 통과.
  Comma 69건 중 65 통과; 기존 Windows fcntl 2·symlink 권한 1·bash 경로 1 실패.
- 사용자 확인: 외부 HA homeassistant202604.duckdns.org(443). Supervisor 읽기 확인으로
  Nginx Proxy Manager가 443을 처리하며 사용자 include 경로 존재 확인.
- 사용자 지시: Comma는 별도 답장 전까지 오프라인으로 간주. 연결 시도/실기 검증 없음.
- 현재: 애드온 실제 설치·독립 HTTPS 경로·HA 코드 반영 준비 단계. 전환 완료 아님.
- 설치 진행: 8303aae 수신기 저장소 기반 ARM64 빌드/실행 성공, 애드온 slug
  874ccb4c_carrot_receiver. 기존 프록시 사용자 include로 /carrot-receiver 경로 추가,
  독립 health 및 HA 기존 root 경로 모두 외부 HTTPS 200 확인.
- HA 소스 62개 기존 백업·SHA-256·문법 확인 후 반영(54 변경/8 동일). 사용자 재시작과
  실제 source 설정 적용은 대기. 설정·DB·사진은 동기화 대상에서 제외.
- 후속 구현: 기존 장치 upload identity로 인증된 자체 서버 provisioning과 Git 공개 URL
  매핑, HA 일회 준비 옵션 적용. Git에 토큰/장치 ID 없음. 수신 10/일회 setup 2,
  Comma 직접 설정 4/polling 4 검증 통과. 원격 기기 실행은 아직 미검증.
- 기능 보존: 충전 74/주행 73/카메라 17(1 skip)/터미널 4/파일 로그 15(1 skip),
  ~~Worker~~ 기존 증분/benchmark 통과. 차계부 환경 제약은 별도 CHANGELOG에 기록.
- 자동 설정 967beff main 게시 후 HA 최종 소스 63개 hash/문법 확인. 자체 서버
  실제 HTTPS provisioning 200과 장치/새 credential 내부 대조 성공(원문 미출력).
  HA 비공개 일회 source 설정 준비, 기존 terminal_enabled와 직접 HA 주소 보존 확인.
- Comma 원격 58553e23 및 명시적 rollback 보정 b5e73218 게시·브랜치 SHA 확인.
  기기 Pull/재부팅 미실행. 처음은 기존 터미널 불가 시 당근웹/로컬/VPN에서 설치 필요.
- 기존 trip 측정 범위·최고속도·부분 품질 메타데이터 유지 점검을 수신기 0.1.2에 반영.
  관련 API wire와 계산을 유지하며 UI·CAN·차계부 실행 코드 변경 없음.
- 최종 준비: 수신기 0.1.2 실제 started/boot auto/Watchdog, 외부 HTTPS 200 확인.
  기존 HA archive의 동일 서버 비공개 online backup integrity=ok, 마지막 상태 1건
  자체 수신기 seed 및 원래 측정 시각 보존 확인. 원문/토큰은 출력·Git에 없음.
- Comma 최종 원격 40148b0d. 초기 인증 지연 중 수집/outbox 보존 및 공유 credential
  회복 보정(537f5d90/cd24a0ec/40148b0d), 직접 연결 6/polling 4/outbox 1 통과.
- HA 소스 반영·비공개 일회 옵션 준비 완료지만 사용자 HA Core 재시작 미실행.
  Comma Pull/재부팅 미실행. 실차·HA 재시작 중 수신·실제 백업 복원·24시간 관측은 대기.
  새 HA 버전·태그·Release 없음. ~~Cloudflare~~ DB 삭제·~~Worker~~ 변경/배포 없음.

## 2026-10-14 — 자체 서버 직접 통신 가능성 조사

- 요청: 코드 변경 없이 ~~Cloudflare~~ 의존 제거의 기능 보존 가능성·장단점 검토.
- 확인: 일반 상태/주행은 ~~Worker~~ 저장 후 cloud.py가 HA로 동기화하며, 파라미터
  큐/ACK/설정 동기화도 Worker에 의존한다. 영상/rlog·주차 카메라·터미널의 본
  전송은 HA 직접 경로가 있지만 초기 주소/토큰 발견은 terminal_bootstrap에 의존한다.
- 판단: 수신 저장·인증·명령 큐·직접 연결 설정을 자체 서버로 옮기면 현재 HA 기능
  보존 가능. 주소만 교체하는 작업은 아니며 기존 안드로이드 호환은 별도 API 검증 필요.
- 장기 조건: 외부 HTTPS/WSS 또는 VPN 도달성, 기기 오프라인 큐 한도/재전송,
  중복 방지·영속 ACK·백업·디스크 보관 및 재시작 복구 검증. HA와 별도 프로세스
  수신 서비스는 HA 재시작 중 수신 가능하나 동일 서버/회선 장애는 공유한다.
- 관련: cloudflare/src/worker.js, HA cloud.py/terminal_bootstrap.py/terminal_relay.py/
  camera_http.py/driving_logs/http.py, openpilot collector.py/param_sync.py/terminal.py.
- 검증: 로컬 코드 읽기와 HA 공식 외부 접근 문서 검토. 운영 네트워크의 ~~Cloudflare~~
  프록시/터널 사용 여부 및 원작 앱의 전체 활성 기능은 미확인. 실행 코드·설정·DB·
  릴리즈·배포 변경 없음. 조사 기록만 로컬 반영.

## 2026-10-14 — 저장 용량과 프리릴리즈 범위 재점검

- 이유: 사용자 요청으로 장기 용량 위험 및 beta.6/beta.7의 이전 변경 포함 여부를 재검토.
- 운영 조회: ~~D1~~ 280,588,288 bytes. 압축·중복 제거·용량 예산·ACK 기반 정리로 여유를
  확보했으나 예산은 본문 기준이며 물리 DB 전체 상한 보장은 아니다.
- HA 설치 버전은 0.8.14-beta.5이며 자동 archive ACK와 새 압축 응답 해독 코드가
  설치되지 않았음을 읽기 전용 확인. 일회성 ACK 이후의 지속 정리와 실제 cron 실행,
  정상 24시간 부하 및 장기 보관 주기 검증은 미완료다.
- 릴리즈 대조: beta.7은 beta.5 이전 실행 코드와 beta.6의 로그 기능을 포함한다.
  beta.5 이후 차계부 경로 변경은 기록 문서뿐이며 이전 결제 수정도 조상 커밋이다.
  beta.7 이후 main에 추가 HA 실행 코드 변경은 없다.
- 설명 한계: beta.7 노트는 beta.6을 요약 참조했고, 이전 누적 기능과 기존
  carrot-params-card의 로그 화면 전환/파라미터 튜너 이동을 충분히 설명하지 않았다.
- 발행 판단 오류: 이 파일의 개별 작업 지침은 버전·태그·Release 없이 진행하도록
  했으나 일반 배포 지침을 우선해 beta.6/beta.7을 발행했다. 사용자에게 오류를 인정.
- 관련: cloudflare 저장 정책, HA cloud.py/cloud_archive.py, frontend 카드,
  beta.5~beta.7 릴리즈 및 Git 이력. 이번 점검에서 실행 코드·운영 DB·릴리즈 수정,
  HA/Comma 설치·재시작은 수행하지 않았다. 점검 기록만 로컬 반영.

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
- Comma: `ha/driving_logs.py`와 `terminal.py` 연결. 기존 discovery 결과 공유로 새 ~~Worker~~
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
  cloud live/incremental/history cache, ~~Worker~~ incremental/benchmark, Comma param/terminal/logs 12건.
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

## 2026-10-14 — 사용자 실재생 확인 및 화면 누락 보정 중

- 사용자 스크린샷과 보고로 실제 운영 HA의 영상 재생 확인. 목록·구간 목록 썸네일은
  자리표시자이며 주행 리플레이는 모듈 미연결로 동작하지 않는 상태가 드러났다.
- 리플레이의 “이 브라우저에서는 사용할 수 없음”은 원본 런타임 미로딩 안내였다.
  브라우저 미지원으로 확인된 것이 아니다. 원본 worker·재생 화면 연결을 진행한다.
- 구간 목록 누락 원인: 원본 CSS wide media query와 HA 브리지의 축약된
  `isCompactLandscapeMode` 조건 불일치. 넓은 화면에서 DOM 내용을 만들지 않았는데
  CSS는 펼침 컨트롤을 숨겼다. 원본과 같은 media query로 수정했다.
- 썸네일: `ha_log_thumbnails.js`에서 HA 저장 MP4의 보이는 항목만 단일 디코더로
  프레임 추출, 최대 48개·각 128KiB JPEG 메모리 캐시. 숨김 시 중단, 종료 시 해제.
  HA 디스크/Comma/Cloudflare 변경 없음. 원본 bridge HTML·빌드 스크립트에 연결.
- 검사: 합성 영상 실제 Chromium 디코딩으로 썸네일 480px 생성, 목록·선택·정렬·영상
  창·모바일 검사 통과. wide 구간 목록 가시성 회귀 검사를 추가해 재검증 예정.
- HA FFmpeg 확인을 위한 Docker 읽기는 SSH 앱 protection mode 때문에 불가했다.
  보호 설정은 변경하지 않았다. 썸네일 구현은 브라우저 영상 디코딩을 사용한다.
- 관련 파일: `frontend/carrot_logs/ha_log_thumbnails.js`, `ha_logs_bridge.js`, `logs.html`,
  `scripts/build_logs_port.py`, `tests/driving-logs-port-browser.cjs`.
- 배포: 이번 보정은 아직 로컬 작업 중. 리플레이 연결과 관련 검증 후 SSH 직접 반영한다.

## 2026-10-14 — 원본 리플레이 연결 및 실로그 검증

- `driving_logs/http.py`에 장치 범위·기존 조회 세션을 사용하는 replay-source 설명과
  rlog/영상 파일 응답 추가. API 인증·Range·원본 바이트 보존 검사 통과.
- 같은 원본 커밋의 replay client, 압축/Cap'n Proto 해석 워커, 이벤트·그래프·전방·
  분석 모듈, 리플레이 HTML·CSS를 이식. worker 경로와 입력 URL을 HA로 연결하고
  전용 runtime 등록 이름으로 분리한다. 원본 계산·해석 로직은 재작성하지 않는다.
- `ha_replay_loader.js`에서 클릭 시에만 리플레이 자산을 로드하고 저장된 자료로 재생한다.
  라이브 WebSocket이나 기기 설정 쓰기는 없다. 재생/정지/배속/시간 이동/구간 선택은
  원본 모듈을 사용한다. 기록 속도·가속도·Lead 수치 HUD를 HA 상태 어댑터로 연결한다.
- 원본 drive workspace 스타일과 stream-ready 상태도 필요했다. 이를 연결하고
  실제 영상 표시·닫기 버튼 위치를 Chromium에서 확인했다.
- 원본 Carrot Vision의 GPU 차선/AR 오버레이 전체는 이번 어댑터에 포함되지 않는다.
  레이더 검증 상세 화면·지도·외부 전송과 함께 남은 범위를 별도로 추적한다.
- 운영 HA의 실제 한 구간 rlog/MP4를 임시 비공개 파일로 읽어 원본 worker 해석,
  재생 진행·정지·seek 후 기록 상태, SVG 그래프, 모바일 폭, 닫기 검증 통과.
  테스트 자료·GPS 원문·영상은 Git에 포함하지 않았다.
- 썸네일 디코더는 리플레이/숨김 시 중단하고 제거된 DOM 관찰·큐를 정리한다.
- `scripts/build_logs_port.py`에 재현 가능한 리플레이 자산/페이지 생성도 추가했다.
- Git 게시·HA 직접 반영은 아래 후속 배포 결과를 기준으로 한다. HA 재시작 후 운영
  대시보드의 새 리플레이는 사용자 확인 대기이며, 로컬 실로그 검증과 구분한다.

## 2026-10-14 — 원본 HUD 복구·10GB 주행 단위 보관 수정 중

- 원인: 이전 이식이 GPU 렌더러·원본 HUD를 제외하고 간단한 수치 어댑터로 대체했다.
- 동일 원본 커밋의 렌더러·raw 상태 해석·투영·HUD 모듈을 기록 전용으로 연결한다.
- 저장 한도 10,000,000,000 bytes, 오래된 주행 전체 삭제와 삭제 주행 재전송 방지를 구현한다.
- 관련 파일: `driving_logs/store.py`, `frontend/carrot_logs/`, `scripts/build_replay_renderer.py`, 저장·브라우저 테스트.
- 사용자 지시: 버전 상승·태그·릴리즈 없이 검증·커밋·푸시 후 HA 직접 반영.
- 후속 요청 반영: 드롭다운 현재 구간 텍스트·접근성 표시를 유지하고 같은 스타일의
  이전·다음 버튼을 선택기 옆에 추가. 좁은 화면에서 줄바꿈하며 경계에서 비활성화한다.
- 너비 변동 원인: `.logs-shell`의 너비 미지정과 max-width/auto margin이 콘텐츠 고유
  너비에 의존했다. HA 카드·iframe·로그 shell에 안정적인 전체 너비를 적용한다.
- 당근 서버 전송: 원본 `web_upload.py`와 결과 포매터를 고정 커밋에서 재사용한다.
  HA 장치 범위 summary/start/job/cancel, 원본 확인·진행률·결과 UI, 크기 응답 불일치·
  서버 한도 거절·재시도·취소·보관 정리 시 업로드 중단을 연결한다. 별도 Discord 전송 없음.
- 합성 파일 로컬 서버 검사 15건 중 14건 통과·Comma 송신기 통합 1건 환경 미지정으로 제외.
  원작자 서버에 테스트 파일을 올리거나 NAS 내부 수신 확인을 수행하지 않는다.
- 실주행 자료의 로컬 복사는 자동 승인 심사가 민감 자료 복사 대상 허가 및 경로 검증
  부족으로 거절해 수행하지 않았다. GPU·HUD·탐색·아이콘은 합성 기록 Chromium 검사로 검증한다.
- 전송 결과 화면까지의 브라우저 검사에서 원본 API의 `waitMs` 전역 helper 누락을
  추가로 발견해 HA 브리지에 연결했다. 원본 범위 선택·전송 확인·진행·결과 흐름을 검사한다.
- 검증·배포: 진행 중. 운영 적용·재시작·실차 검증 완료로 보고하지 않는다.
- Chromium: 합성 영상의 목록·썸네일·첫 표시 전체 너비·디코딩 후 폭 유지·선택·원본
  전송 확인/진행/결과·정렬·영상·모바일 검사 통과. 원본 HUD/GPU 픽셀·아이콘·전후
  seek·상단 이전/다음·현재 구간 표시·HUD 토글·닫기·라이브 소켓 0개 검사 통과.
- 기존 dashboard live/lazy/view-state 10건, incremental 5건·history 1건·Comma param
  polling 4건 통과. ~~Worker~~ benchmark 통과. ~~Worker~~ incremental은 기존 스키마의
  `measurements_json` 중복 마이그레이션 오류에서 실패(해당 코드 변경 없음).
- UTF-8 모드에서 cloud-live 6건 통과. 로그 HTTP 검사에 미인증 summary 거부·
  인증된 원본 크기 요약·다른 엔트리 작업 ID 조회 거부를 추가했다.
- Git 게시: 실행 코드 커밋 `136592135652322184764ab4c61d34531dbf6ccc`를 main에 푸시했다.
- HA 사전 검사에서 기존 설치 파일이 수정 전 Git 내용과 일치함을 확인한 뒤 코드·자산
  107개를 직접 설치했다. 모든 설치 파일 SHA-256 일치 확인. 백업:
  `/config/carrot_ha/deployment-backups/driving-logs-hud-136592135652/before`
  (실제 경로 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-136592135652/before`).
- 외부 DuckDNS HTTPS의 카드·리플레이 로더·레이아웃 CSS·원본 HUD 모듈 4개가
  게시 커밋과 같은 SHA-256임을 확인했다. 운영 데이터와 토큰·로그·영상을 복사하지 않았다.
- 배포 완료, 사용자 HA 재시작 1회·강력 새로고침 후 실제 HUD·용량·선택 전송 확인 대기.
  백엔드는 재시작 전까지 이전 코드다. Comma 변경/Pull·Worker/D1/KV 배포 없음.
  manifest 버전·태그·GitHub Release 변경 없음. 원작자 NAS 내부 수신 검증은 하지 않았다.

## 2026-10-14 — 썸네일·목록·리플레이 SSH 반영 완료

- 수정 파일 23개를 기존 파일 백업 후 HA에 직접 설치하고 SHA-256 일치 확인.
- 백업: `/config/carrot_ha/deployment-backups/driving-logs-replay-20261014/before`.
- 외부 DuckDNS에서 제공되는 `ha_replay_loader.js`도 로컬 SHA-256 일치 확인.
- 최종 검사: 실제 수신 rlog/MP4로 재생 진행·일시정지·seek 기록 갱신, SVG 그래프,
  모바일 크기, 닫기 및 목록·썸네일·선택 검사 통과. API/저장/전송 통합 6건 및
  기존 dashboard live/lazy/view-state 회귀 통과.
- Comma·~~Worker~~·D1/KV·manifest 변경 없음. 버전 상승·태그·Release 발행 없음.
- 새 replay-source API 활성화를 위해 사용자 HA 재시작 1회와 강력 새로고침이 필요하다.
  운영 8번 대시보드에서 수정 리플레이를 확인한 것은 아직 아니다.
- 코드 게시: HA 첫 단계 `4d16902`, 썸네일·목록·리플레이 보정 `5d082d2`를 원격 main에
  푸시한 결과 확인. 기본 작업 폴더도 해당 변경으로 fast-forward 반영했으며 기존
  차계부·manifest 등 다른 작업의 staged/unstaged 변경은 유지했다.
- 이 후속 기록은 Git 게시·작업 폴더 반영 결과를 추가하는 문서 변경이다. 운영 코드
  재배포·버전 변경·릴리즈는 하지 않는다.
## 2026-10-14 — 오후 일반 주행 내역 누락 조사

- 최적화 구현 시작(사용자 전체 적용 요청): cloudflare/src/archive_storage.js,
  worker.js·wrangler.json·schema.sql·migration_archive_storage.sql, HA cloud.py,
  openpilot collector.py·engine.py 및 회귀 검사. gzip 무손실 압축과 장치/해시별
  충전 목록·월별 집계 분리, 한 번의 JOIN으로 기존 raw_json 복원, durable HA ACK
  이전 자료 보존, 시간/바이트 예산과 시간당 정리, 주행/상태 송신 lane 분리를 구현한다.
- 자동 승인 심사는 운영 DB 전체 백업의 개인정보 전송을 거절했다. 사용자가 GPS·
  주행 이력을 포함한 전체 백업을 PC 비공개 Temp 경로에 저장하도록 명시적으로 허용한
  뒤 ~~D1~~ export 성공. 백업 SQLite integrity_check 및 54,950개 변환 행의 원문 gzip
  복원 동등성을 확인. 본문 440,750,825→169,225,858 bytes; 원본 백업 유지.
  민감 원문·장치 ID·토큰·백업 다운로드 링크는 문서/Git에 포함하지 않는다.
- 합성 ~~Worker~~ storage/history/incremental/benchmark, HA live 6·incremental 5·history 1,
  dashboard 10건 통과. Windows에서 Comma 전체 69건 중 fcntl 부재 2·symlink 권한 1·
  기존 workflow bash 경로 1 실패. 실행 코드 배포·운영 DB 변환은 아직 진행 전이다.
- Git 게시: HA/Worker 구현 `83ed541`, Comma 기능 `e9c9f4cd`와 동시 upstream을
  보존한 병합 `0522a86662ecf48949dd37cb1a2aedcd573486b9` 원격 확인.
- 운영 복구: 호환 모드 ~~Worker~~ dee4175f 배포 후 54,950행 무손실 본문 압축 적용.
  DB bytes 499,998,720→274,784,256. 원문/행/커서 삭제 없음. 이어 additive
  migration_archive_storage.sql 적용, 최종 ~~Worker~~ 8703ca54 배포. 크기 약276MB,
  telemetry 본문/공유 context 예산 사용169.3MB/250MB, trips9.6MB/75MB.
- beta.6 manifest/태그 일치·GitHub Release 생성 확인. Actions 38556238637 성공.
  HA 수신 ACK 실행 코드는 HACS 설치·사용자 재시작 대기이다.
- 변환 직후 ~~D1~~ metadata API 7009 및 HA cloud API timeout이 일시 발생했으나 이후
  읽기/쓰기 재개 확인. HA 실제 latest 약0.305s/history66건 약0.604s/trips 약0.307s,
  history 원래 deviceId 포함 payload 복원 확인. 오래된 오전 미전송 trip이 서버에
  수신되기 시작했으나 오후 주행 수신 완료는 아직 확인하지 않았다.
- 일회성 변환/ALTER/index에서 각각54,950/54,988 rows_written 발생. 이후 ~~D1~~ info
  최근24h117,303 writes 측정. 현재 요청은 동작하지만 계정 전체/UTC 일일 한도와
  장기 무료 플랜 보장은 미검증. 정상 유지보수 부담을 줄이도록 정리를200행/시간으로
  제한한다(초기 오래된 자료 정리에 수일 소요 가능; 미수신 자료는 삭제하지 않음).
- 실제 첫 HA durable cursor ACK 성공(telemetry55278/trip395), 14일 초과 확인 자료
  200건 정리. 초기 응답의400은 ~~D1~~ meta.changes에 예산 트리거200쓰기가 포함된
  것이므로 RETURNING 행 수로 보정했다. 보정 커밋0ee0c0e·Worker3473f4ad 배포.
- 운영 CPU 검증에서 100건 압축 복원이73~78ms로 측정돼 무료 CPU 기준 대비
  보정한다. opt-in 압축 전송을 HA executor에서 복원하고 shared context는 페이지당
  한 번 전송한다. 새 HA는100건×최대10페이지, 이전 HA는 원문 호환8건 페이지.
  최신 상태 경로는 그대로 두고 beta.7로 HA 수정본을 발행한다. 2개 복원/손상/상한
  검사와 기존 ACK/incremental/live 검사 통과. 실제 새 CPU·오후 주행 수신은 후속 확인.
- beta.7 압축 전송 구현2b206ff 게시·~~Worker~~ e18e1cef 배포. 운영 HA 서버 메모리에서
  게시된 cloud_archive.py로 실제100건을 복원해 장치 ID/값 형식 검사 통과(파일 설치 없음).
  요청 CPU4ms 확인. 기존8건 원문 복원은21ms 표본이 있어2건으로 추가 제한한다.
  새 HA100건×10페이지는 유지하며 이전 HA catch-up은 느려질 수 있다. unchanged
  context의 압축 결과64개를 메모리에 캐시해 송신 CPU를 줄인다.
- 누락 복구 확인: 16:06:35~17:50:18 KST·101,000m 주행이 클라우드 최근 주행 및
  HA archive trip 종료2026-10-14T08:50:18+00:00로 확인됐다. 화면 검증은 별도 후속.
- 최종 CPU 표본: 기존2건 원문/신규100건 압축 전송4/5ms·ACK2ms·latest0~2ms,
  telemetry 송신9~13ms. 작은 snapshot 나머지는 JSON+immutable context 참조로
  저장해 매건 gzip 비용을 줄이고, 큰 나머지/반복 context/기존 이력은 gzip을 유지한다.
  HA beta.7 복원기는 JSON/gzip을 이미 지원하므로 추가 HA 버전 상승은 필요 없다.
- 최종 게시/배포: ~~Worker~~ ed8b0f6 코드·dff4cdad-9c35-49fc-bb79-15ca3a884e3e 배포,
  POST telemetry4~9ms/200 표본 확인. 새 JSON 경로의 missing-context 회귀가 검증 중
  실패해 guard를 추가하고 storage/history/sync/benchmark 및 HA 복원·ACK·history·
  dashboard 검사를 다시 통과했다. 민감 자료 없는 일시 tail은 모두 종료했다.
- 최적화 후 운영 수치: DB280,555,520 bytes, telemetry/context172,071,968/250MB,
  trips9,641,263/75MB, context391개, durable consumer1개. 현재 잔존/신규 자료와
  최초 압축 직후 크기를 구분한다. 미수신 이력을 용량 때문에 임의 삭제하지 않는다.
- 자동 심사는 원문 유래 해시를 HA에 보내는 추가 대조를 거절했다. 동일 PC/동일
  사용자 허용 백업 폴더에 after 백업을 받아 전후 로컬 전체 대조로 대체 완료:
  기존54,965건 중54,765건 모든 원문 값 일치, 정상 ACK/14일 초과 정리200건,
  미설명 손실0·after SQLite integrity_check 통과. 민감 원문/해시 서버 전송 없음.
- 실제 Chromium 대시보드 오늘 주행 탭에서 오후04:06·101km·1시간43분 카드,
  오늘180.37km 요약과 오전 병합 카드 확인. 초기 캐시 표시와 비동기 갱신 후를 구분했다.
- HA 최종beta.7 Release/Actions38558241866 success 확인. HA HACS 설치/사용자
  재시작 및 Comma b2260cf0ae2812d872bcb1228bb9441b0dcea001 Pull/재부팅 대기.
  lane 인덱스/재시도보존/param polling5건 추가검사 통과. docs 검토에최종결과추가.
  실제 첫cron/24시간계정전체쿼터/보관주기안정화/새송신기실차검증은미완료다.

- 장기 개선 검토: docs/cloudflare-storage-review-2026-10-14.md 작성.
  최근 날짜별 본문 집계에서 평균 크기 10/1 8.2KB→10/13 15.6KB 증가 확인.
  15,685 bytes/행 고정 시 14일 본문 316~632MB(60~30초 간격), 압축률 50%
  가정도 158~316MB이며 D1에서 검증된 압축률은 아니다. 압축 단독 영구 해결로
  권하지 않고 반복 데이터 분리·기간/용량 예산·정리 검증·전송 장애 격리를 함께 권한다.
  공식 D1/Workers 한도 확인. 운영 데이터·실행 코드·보관 정책 변경/배포 없음.

- 후속 직접 확인(약 20:00 KST): HA 원격 터미널은 주차·준비됨, 실제 연결 성공.
  최신 상태 19:58:36 KST와 Git 측정 19:58:05 KST 확인. 설치 커밋은
  `05bc6d0af87a53569f91facef1c490c850786a73`. 현재 오프라인 가정은 철회한다.
- 기기 상태 파일을 HA 역방향 터미널에서 읽음: 수집기 running, delivery retrying,
  reason `HTTPError HTTP 500`, pending 약 818건. SQLite mode=ro·query_only 조회 결과
  telemetry 816건, trips 2건. 대기열 선두는 09:25:50 KST 텔레메트리.
- 미전송 주행은 09:29:22~09:31:18(369.2m)와 16:06:35~17:50:18(101,000m,
  durationS 6,221). 오후 기록은 기기 outbox에 보존돼 있으나 클라우드 미수신이다.
- 실행 커밋의 collector.py·engine.py를 GitHub에서 확인: 최신 텔레메트리와
  oldest outbox를 번갈아 전송하며 oldest 실패 시 최신 텔레메트리로 되돌아간다.
  따라서 온라인 상태 갱신과 오래된 행 뒤의 주행 업로드 정체가 공존할 수 있다.
  영상/rlog 송신 완료를 기다리는 주행 API 조건은 해당 수집기 코드에 없다.
- HTTP 500 응답 원문의 원인은 아직 미확인. ~~Worker~~ 오류 스트림 접속은 응답 대기;
  HA SSH 앱 Docker 보호 모드로 컨테이너 로그 조회 불가, 보호 모드는 변경하지 않았다.
  기기 파일 수정·대기열 삭제·재부팅·수동 원본 재전송은 수행하지 않았다.
- 후속 원인 확정: 운영 ~~Worker~~ 오류 스트림에서 `/api/telemetry` HTTP 500과
  `D1_ERROR: Exceeded maximum DB size`, handleArchivedTelemetry 저장 실패 확인.
  ~~D1~~ info 실제 bytes=499,998,720. 읽기 전용 단일 집계 결과 telemetry_history
  54,965행·본문 합계 440,754,890 bytes, 14일 초과 29,865행, 가장 오래된 시각
  2026-07-28, 가장 최근 저장 2026-10-14 09:24:50 KST.
- 인과관계: ~~D1~~ 용량 초과 → 09:25:50 상태 이력 저장 실패 → oldest-first 대기열
  정체 → 뒤의 오후 주행 미전송. latest 우선 경로로 온라인 상태는 갱신될 수 있다.
  영상/rlog 완료 조건이 일반 주행 업로드를 막았다는 증거는 없다.
- 보관 정리 관련: 로컬 Worker는 기본 14일 telemetry purge 및 scheduled handler가
  있으나 wrangler.json에 cron 설정이 없다. 실제 원격 예약 설정·과거 정리 실패 원인은
  미확인으로 남긴다. 장기 잔존 행은 운영 집계로 확인했다.
- 조사 완료 후 HA 원격 터미널 연결 해제. 복구·DB 삭제·보관 정책 변경·코드 배포는
  이번 원인 분석 요청에서 수행하지 않았다. 조사 문서만 커밋·푸시 대상이다.
- 과거 다이어트 범위 대조: 2026-10-04 `68d6a28`은 HA 로컬 archive_codec/storage
  압축 구현이며 ~~Cloudflare~~ 파일 변경 없음. docs/sqlite-lossless-compression.md에도
  ~~Worker~~·~~D1~~·Comma 변경/배포 없음이 명시돼 있다. 운영 HA 압축 결과는 약
  415MB→213MB로 별도 기록돼 있다. ~~Cloudflare~~ 압축의 배포 누락으로 해석하지 않는다.
- 별도 보관 정책 커밋 `9fcf64b`(2026-09-17)은 HA와 ~~Worker~~ purge를 추가했다.
  운영 ~~Worker~~ 배포 조회 최신은 2026-10-03 02:25:46 KST,
  version d73bcf6c-1ac4-48cd-84ae-0eaeec74a866. 원격 예약 실제 설정은 미확인.

- 사용자 범위: 16~17시 일반 차량 대시보드 주행 내역. 영상/rlog 로그 목록과 구분한다.
- HA 읽기 전용 조사: 상태 최신 19:51:31 KST, 주행 최신 종료 09:18:31 KST.
  클라우드 최근 주행도 같은 오전 기록이며 trip-changes after=392 응답은 빈 목록,
  next_cursor=392, has_more=false. HA 커서도 392로 일치한다.
- 당근웹 파일 로그는 314개 구간 모두 완료, 최신 17:51:41 KST. 따라서 일반 주행
  누락을 영상/rlog 완료 조건 탓으로 설명하지 않는다. 일반 주행 생성·클라우드 업로드
  구간으로 원인 범위를 좁혔으나 기기 원인·전송 대기열은 아직 확인하지 못했다.
- 사용자 보고: Comma 현재 오프라인. 오프라인 발생 원인·시각과 누락 인과관계 미확인.
- 사용자 요구: 파일 로그 업로드와 일반 주행 내역 업로드는 서로 의존하면 안 된다.
  HA 경로는 파일 직접 수신과 클라우드 주행 동기화로 분리돼 있다. Comma 실행판의
  작업·자원 결합 여부는 추가 확인 필요. 로컬 코드만으로 실기 상태를 단정하지 않는다.
- 관련: HA driving_logs/store.py, cloud.py, 로컬 openpilot ha/collector.py·engine.py.
- 검증: 운영 색인·DB·클라우드의 제한된 시각/집계/커서만 조회. GPS·영상·토큰 미출력.
  광범위 진단 필드 출력은 자동 승인 심사에서 거절되어 수행하지 않고 안전한 집계로 제한했다.
- 배포: 실행 코드·설정·운영 DB 변경 및 재시작 없음. Worker/D1/KV 배포 없음.

## 2026-10-15 — 로그 분석 링크 화면 설명을 위한 읽기 전용 조사

- 요청: 첨부 화면의 Cabana/PlotJuggler/JotPluggler, API_HOST 명령, 세그먼트/파일과 레이더 검증 역할을 비개발자 관점에서 설명.
- 확인: companion openpilot의 tools/carrot_route_vault/viewer.py 명령 생성, radar_view.js 화면/분석 범위, openpilot/tools/cabana 및 plotjuggler README와 jotpluggler 소스. 화면 명령은 PC 도구에 공유 범위 로그를 연결하며 차량 설정 명령이 아님. 레이더 재계산과 기록된 Lead를 구분.
- 검증: 소스 읽기 비교만 수행. 첨부 주행의 원본 로그, 실제 외부 도구 실행 및 서버 접속 성공 여부는 확인하지 않음.
- 배포: 설명 요청으로 실행 코드 변경·기기 접속·설치·재시작·태그/Release 없음. 조사 기록만 추가.
## 2026-10-15 — 재시작 후 차량/로그 대시보드 구성 오류 조사

- 사용자가 재시작·강력 새로고침 후 로그뿐 아니라 차량 대시보드도 구성 오류라고 보고했다. 직전 V2 공통 manifest 의존성 설치/통합 시작 실패 가능성과 실제 시작 오류를 조사한다. 로그 확인 없이 원인을 단정하지 않는다. HA 재시작/보호 모드 해제/Comma 수정/릴리즈 없음.
- 첫 읽기 전용 `ha core logs`는401 Unauthorized로 접근 실패. 파일 로그와 사용자가 로그인한 HA 화면에서 진단을 이어간다. 아직 원인·수정·복구 미확인.
- 실제 HA 시스템 로그 확인: 16:46:25 carrot_ha setup failed, Requirements not found ['zstandard==0.25.0']; 설치기는 cp314 ABI wheel을 찾지 못했다고 기록했다. 이어진 dashboard version API404가 차량/로그 구성 오류를 유발한다. 공식 PyPI에 wheel이 있다는 사실은 실제 HA 설치 성공을 보장하지 않았으며 앞선 검증 한계이다. 기존 서비스 전체를 선택적 분석 압축 의존성이 막도록 한 변경을 수정한다.
- 수정: manifest에서 외부 zstandard 필수 항목을 제거한다. 별도 radar_runner의 Python3.14 실행에 한정해 표준 compression.zstd.ZstdFile로 원본의 ZstdDecompressor.stream_reader 호출을 연결한다. HA 프로세스의 모듈/기존 패키지를 변경하지 않으며 원본 엔진 zip/실차/보관 데이터는 그대로 둔다. Python3.12 개발 경로는 기존 외부 패키지 유지. 공식 PyPI에는 musllinux cp314 wheel도 있지만 실제 HA 설치기는 거부했으므로 wheel 부재/네트워크/인덱스 원인을 추가 단정하지 않는다.
- 검증: 로컬 Python3.14 별도 의존성 폴더에 외부 zstandard를 설치하지 않고 연속2개 zstd 프레임으로 압축한 합성 rlog→원본 엔진→캐시 정리 통과(2건). Python3.12 주행 로그 전체31건 통과. GitHub CI에 python:3.14-alpine 컨테이너·binary-only numpy/pycapnp·외부 zstandard 부재 확인·동일 실제 엔진 검사를 추가했다. 이전 Ubuntu3.12 검증만으로 운영 호환성을 판단한 검증 공백을 보완한다.
- 다음 단계: 수정 커밋/main 푸시·직접 HA2파일 교체/백업/해시·Alpine CI 확인. 사용자 재시작 전 복구 완료를 주장하지 않는다. 로그 API401 우회/보호 모드 변경/HA 재시작/릴리즈 없음.
- **수정 배포 완료/활성화 대기:** c4f59bb305c5bb7d4a51d20026e12602e9fdd615 main 푸시, HA manifest/runner2파일 충돌 검사·백업·직접 교체·SHA256 전부 일치. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-c4f59bb305c5/before. GitHub Linux 회귀 및 신규 Alpine Python3.14 실제 압축 엔진 검사38702092731 success (https://github.com/helico717/carrot-ha/actions/runs/38702092731). 실행 중 HA의 기존 setup 실패를 다시 시도하려면 사용자 재시작이 필요하다. 운영 두 대시보드 복구/실제 V2 분석은 재시작 후 확인 대상이다. 신규 릴리즈/태그 없음.
## 2026-10-15 — V2 분석 실패 수정·세그먼트 탐색·지도 폐기 요청

- 사용자: V2 레이더 분석 실패 및 하단 그래프 미표시, V2 내부 이전/다음·드롭다운 세그먼트 탐색 요청. 주행 지도 시스템은 폐기/삭제한다. 날짜 검색과 기존 차량 대시보드의 지도는 제거 대상이 아니다. 원인 로그 확인과 V2 데이터 경로를 조사하며 운영 반영/실제 성공은 별도 기록한다. 릴리즈 금지·직접 HA 반영·사용자 재시작 유지.
- 운영 원인 확인: HA Replay V2 engine code1/ModuleNotFoundError, radar_runner.py install_stdlib_zstd→compression.zstd __init__.py29에서 실패. 이전 Python3.14-Alpine 검증에는 _zstd가 있지만 HA 빌드에는 선택 확장이 없다는 차이를 놓쳤다. 레이더 결과가 없으므로 동일 응답을 쓰는 아래 그래프도 비어 있다.
- 수정: 별도 자식 프로세스 안에서 표준 압축 모듈이 없을 때 시스템 libzstd streaming API를 ctypes로 호출하는 제한 크기 fallback. 연속 프레임/손상·잘림/무진행/해제512MiB 상한·native context 해제를 처리한다. HA 필수 패키지를 다시 늘리지 않는다. 원본 엔진과 private 로그는 변경/내보내지 않는다.
- 지도 폐기: 주행 로그의 Leaflet/타일/상시 지도·경로 선택·V1 지도 버튼·gpsOnly Worker 모드·해당 테스트 제거, 원본 전체 폭 목록/영상 클릭 동작 복구. 날짜와 기존 차량 지도는 보존. V2 navigation.js가 같은 주행 세그먼트 메타데이터를 페이지 조회해 정렬·현재 구간·이전/다음 경계·드롭다운을 제공하며 선택한 세그먼트만 읽는다. 새 backend 경로는 필요 없다.
- 로컬 검증: 주행 로그 Python32건(31통과/Linux-only native1 skip), Python3.14 원본 압축 엔진2통과/native1 skip. Chromium 날짜/지도 DOM·Leaflet 요청0·GPS Worker0/전체 너비/V2 메뉴, V2 실제 합성 영상 픽셀·seek·하단 그래프·센서 변경·이전/다음/드롭다운/처음·끝 경계·현재 구간 표시·모바일 가로 overflow 통과. 기존 원본 전송/영상 UI 및 HUD GPU 회귀 통과. native fallback은 Linux CI와 실제 HA 검증 전까지 완료로 보지 않는다.
- 배포: c8493891e6050faef510755345e56c5b8959939c main 푸시, HA8파일 충돌 검사·백업·직접 설치·SHA256 일치. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-c8493891e605/before. Linux 전체 회귀/Alpine Python3.14(압축 모듈 차단 후 native로 실제 원본 엔진 실행 포함)38704921410 success (https://github.com/helico717/carrot-ha/actions/runs/38704921410). 실제 내부IP/외부 HA URL 모두 새 map-free JS 제공 확인. 운영 UI의 브라우저 캐시 및 실제 분석 결과는 이어서 확인 중.
- 실제 HA V2는 구간 드롭다운/이전·다음2개 기록 표시를 확인했으나 분석은 여전히 실패했다. 시스템 로그 상세에서 ModuleNotFoundError가 아니라 새 native_zstd_reader의 no-progress ValueError로 바뀐 것을 확인했다(요약 목록은 첫 오류를 보여 최신 오류와 다름). 압축 output block이128KiB 경계에 맞을 때 마지막 빈 flush를 손상으로 잘못 처리한 분기 순서를 수정한다. 합성 테스트의3개 짧은 이벤트만으로 실제 압축 block 경계를 놓친 한계를 기록하고128KiB/256KiB/2MiB 난수 회귀를 추가한다.
- 실제 Git libzstd DLL을 로컬 Python3.14 테스트에만 연결해 native fallback 회귀를 활성화했다. 프레임 종료0 직후 빈 호출이 새 프레임 header 힌트로 바뀌는 경우도 처리해 native/표준/원본 엔진3건 전부 통과했다. 패키지 추가/HA 시스템 라이브러리 교체는 하지 않는다.
- **운영 분석 성공 확인:** 경계 보완5ab94b59751f337ee013b0560586ffa0ef2668cf main 푸시·HA runner/HTML2파일 백업/직접 설치/해시 일치. Linux/Alpine CI38705602425 success (https://github.com/helico717/carrot-ha/actions/runs/38705602425). 실제 HA 세그먼트에서1095프레임·영상 동기화 완료 문구, 영상과 레이더 차선/비전 표시, 하단 거리·속도·가속도 유색 시계열을 스크린샷으로 직접 확인했다. 원본 로그/분석 결과 파일을 로컬로 내보내지 않았다. 초기 분석에는 준비 시간이 있으며 완료 전 빈 그래프와 완료 후 결과를 구분한다.
- 실제 V2의 다음 버튼으로 같은 주행2번째 세그먼트 선택·현재 구간 드롭다운/시각 갱신·분석 준비 진입을 확인했다. 처음/끝 버튼 및 드롭다운 왕복은 합성 브라우저에서도 통과. 오래된 JS/CSS 캐시가 지도 UI를 남기지 않도록 로그 HTML의 adapter JS/CSS 참조에 기능 revision query를 부여한다. HA 새 경로/의존성 변경은 없고 runner는 자식 실행 때 새 파일을 읽으므로 이번 단계에 HA 재시작은 필요하지 않다. 강력 새로고침 후 목록 지도 제거를 최종 확인한다.
- **최종 운영 검증:** 실제2번째 세그먼트458프레임·영상 동기화 완료 확인, 드롭다운으로 첫 구간 복귀·현재 구간 표시 확인. HA 로그 목록 복귀 후 지도 DOM0/실제 주행 카드10개와 전체 너비 배치를 스크린샷으로 직접 확인. 날짜/설정/저장량 표시 유지. 최종 코드 c23d4a83ff02efc645638b52c0e53c981c60dd02의 HTML1파일 백업/직접 설치/해시 일치, 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-c23d4a83ff02/before. 최종 Linux/Alpine CI38706020630 success (https://github.com/helico717/carrot-ha/actions/runs/38706020630). 기존 차량 대시보드 Node12건도 통과. 원작자 서버 접근·HA/Comma 재시작·태그/릴리즈 없음. 모든 보관 세그먼트의 신호 품질/분석 성능까지 검증한 것은 아니다.

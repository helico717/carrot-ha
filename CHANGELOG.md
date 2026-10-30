## 2026-10-30 — v0.9.0 정식 발행 완료 확인

- 태그 대상 ca6f6e12c27e22cfff260cdf315848110a3ce90b, 새 annotated tag v0.9.0 원격 일치. 준비 CI 40985016234 및 HACS Release 40985134385 모두 success.
- https://github.com/helico717/carrot-ha/releases/tag/v0.9.0 공개 확인: draft=false, prerelease=false, 2026-10-30 10:19:27 KST 발행. 본문에 승인된 14개 분야 전체와 누적 Git 대조 링크·운영 검증·한계·업데이트 안내 존재 확인.
- Git 배포 ZIP에서 manifest 0.9.0과 기본 vehicle.glb SHA-256 61914d35…를 확인했다. HACS 설치 후 패키지 모델을 기본 사용하며 명시적 사용자 모델 URL은 유지된다.
- 운영 파일 추가 반영·HA/Comma 재시작·HACS 업데이트는 실행하지 않았다. 사용자가 HACS 0.9.0 다운로드 후 HA 전체 재시작 및 브라우저 새로고침한다. 수신 앱/Comma 업데이트는 별도 대상이다. 이 후속 문서 커밋은 발행된 태그의 실행 코드를 변경하지 않는다.

## 2026-10-30 — 사용자 승인 정식 v0.9.0 누적 발행 준비

- 사용자가 현재 사용에 불만 없음을 확인하고 정식 0.9.0 발행 및 앞서 제시한 14개 분야 전체 변경 목록 포함을 명시 승인했다. 이전 베타 승인 재사용이 아니다.
- 기준 정식 v0.8.12, 최신 베타 v0.9.0-beta.1, 기능 기준 b69da6c. 정식 이후 383커밋/502파일 및 베타 이후 183커밋을 Git log/diff와 네 변경 기록으로 대조했다. .github/release-notes/v0.9.0.md에 14개 분야 전체 기능·수정·문서·검증/제약·업데이트를 기록하고 docs/releases/0.9.0-audit.md에 전체 커밋/파일/변경 기록 제목을 보존한다.
- manifest를 0.9.0으로 변경. 현재 HA와의 3D 차이는 동일 모델의 기본 재질 내장이며 메모리 bake SHA-256 완전 일치로 해소했다. HACS 설치 시 패키지 모델을 기본 사용하고 명시적인 사용자 모델 URL은 유지한다. UI 실행 코드 수정 없음.
- 운영 확인: 통합 loaded, 전송 OFF API 활성화 및 begin/chunk/commit 403. 최신 코드 CI 40982887630 success. 발행 준비 커밋 CI·태그·GitHub 정식 Release/Actions 결과는 후속 기록으로 확정한다. HA/Comma 재시작·기기 소스 수정·운영 자료 변경 없음.

## 2026-10-30 — 디버그 대시보드 미니 지도 깜빡임·테마 드롭다운 선택 불가 수정

- 사용자 보고(화면 녹화): 디버그 대시보드를 가만히 둬도 개요 탭의 주차 위치·최근 주행 미니 지도가 1초에 약 2번 회색으로 비었다가 다시 그려졌고, 같은 이유로 화면 테마(라이트/다크) 드롭다운을 고를 수 없었다. 운영 대시보드에는 없는 현상.
- 원인: 디버그 카드의 `set hass`가 HA가 새 hass를 줄 때마다(시스템의 아무 엔티티 상태 변화) `updateCameraDevicesUI()`를 불렀고, 이 함수가 조건 없이 `dashCard.render()`를 실행했다. 대시보드는 렌더링 때마다 미니 지도를 지우고 새로 만들며(타일 재요청) 드롭다운 요소도 새로 만든다. 운영 카드의 `set hass`는 충전·온라인 상태가 바뀔 때만 렌더링해서 이 현상이 없다.
- 변경: 카메라 기기 옵션·엔티티 상태 HTML·실효 카메라 모드·언어로 서명을 만들어, 바뀌었을 때만 DOM 갱신과 `dashCard.render()`를 실행한다. 디버그 카드 전체를 다시 그리면 서명을 초기화한다. 운영 대시보드와 HA 백엔드는 바꾸지 않았다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-dashboard-debug.js.
- 검증: 로컬 `preview.html`(실제 모듈)에서 관련 없는 엔티티를 바꾼 hass를 0.5초 간격으로 10번 넘겨도 대시보드 렌더링 0회, 미니 지도 객체·테마 select 요소가 그대로 유지됐다. Carrot 기기 엔티티를 새로 추가하면 렌더링이 실행됨을 확인했다. 콘솔 오류 없음. debug-3d·charge-soc·trip-history·view-state 테스트 통과. `debug-freshness.test.mjs`는 수정 전 HEAD에서도 같은 `import.meta` SyntaxError로 실패하는 기존 문제다.
- 배포 상태: 커밋 `9244a4a` main 푸시 확인. 사용자 요청으로 HA SSH 직접 반영: 반영 전 설치 파일 SHA-256이 직전 커밋과 일치(369f5efe…). `/config/carrot_ha/deployment-backups/9244a4aabdddf7324947570dd583b8ab04c84c6e-debug-flicker/before`에 백업(before.sha256 포함) 후 임시 파일+mv로 교체. 반영 후 커밋과 일치(4522e977…), 권한 644 root:root, 임시 파일 없음. 새 버전·태그·릴리즈 없음.
- 미확인: 사용자 브라우저 새로고침(Ctrl+F5) 후 실제 HA 화면에서 깜빡임·드롭다운 해소. 사용자는 수정 전 아무 조작 없이도 깜빡였다고 확인했다(HA 상태 갱신이 원인이라는 진단과 일치).

## 2026-10-30 — 주행·충전 중 12V 배터리 값 앞 빈칸 제거

- 사용자 보고: 개요 탭의 외기/배터리 줄에서 주행 중에는 색 점이 사라지는데, "배터리"와 값(예: 13.8V) 사이에 빈칸이 크게 남았다.
- 원인: 점(`b::before`)은 주행·충전 중(`data-aux="none"`)에 배경만 투명해지고, 너비 8px와 여백(왼쪽 6px, 오른쪽 4px)은 그대로 남아 약 18px의 빈칸이 생겼다.
- 변경: `data-aux="none"`일 때 점의 너비를 0으로 하고 왼쪽 여백 6px만 남긴다. 옆의 "외기" 항목과 같은 간격이다. 주차 중 정상·주의·경고 점과 회색(판단 불가) 점은 그대로 둔다. 판단 로직과 HA 쪽 코드는 바꾸지 않았다.
- 프리뷰: `preview/aux-voltage/index.html`에 비교안 상자(현재/A. 공간 제거/B. 회색 점 유지)와 주차↔주행 번갈아 보기를 추가했다. 사용자가 A안을 승인했다. Windows용 미리보기 서버 설정(`aux-voltage-preview-win`, python, 8767 포트)을 `.claude/launch.json`에 추가했다.
- 관련 파일: custom_components/carrot_ha/frontend/{carrot-dashboard-ko.js,carrot-dashboard-en.js}, tests/dashboard-aux-battery.test.mjs, preview/aux-voltage/index.html, .claude/launch.json.
- 검증: dashboard-aux-battery·live-loading·lazy-runtime·view-state 16개 통과. 실제 운영 모듈을 쓰는 미리보기(한국어)에서 점 영역이 주행·충전 중 6px, 주차 중 18px로 측정됐고 콘솔 오류는 없었다. 영어 대시보드는 CSS 규칙을 테스트로만 확인했다. 확대 스크린샷은 브라우저 창이 그려지지 않아 남기지 못했다.
- 배포 상태: 커밋 `3e27b9b` main 푸시 확인. 반영 전 HA 설치 파일 2개의 SHA-256이 직전 커밋과 일치함을 확인했다(ko 20a62d6e…, en ddaa1754…). `/config/carrot_ha/deployment-backups/3e27b9b6ce0a943d5276b95e8c4a830852793d88-aux-dot-gap/before`에 백업하고(before.sha256 포함) HA SSH(`sudo`)로 임시 파일+mv 교체했다. 반영 후 커밋 해시와 일치(ko cc585900…, en 1204c3af…), 권한 644 root 유지, 임시 파일 없음. 새 버전·태그·릴리즈 없음.
- 미확인: 사용자 브라우저 새로고침(Ctrl+F5) 후 실제 HA 화면.

## 2026-10-30 — 토글 비활성·실행 API 구버전 잔존 확인

- 사용자 화면: 전송 설정 조회 실패, 회색 OFF 모양/disabled wait 커서. 운영 읽기 전용 확인: Carrot HA 엔트리loaded, switch.caryang_id_4_driving_log_transfer=off, 정책 파일0개(기본OFF).
- 중요: 차량용 GET state 실응답에 transfer 키가 없고 complete3109개를 반환했다. 현재 실행 중인 DeviceView는 파일 반영 전 구버전이다. 따라서 스위치 상태OFF만으로 실제 업로드 차단이 작동한다고 보고하지 않는다. 새 UI 정책 조회 실패도 새 API 미로딩과 일치한다.
- 원인: __init__.py async_setup에서 driving_logs HTTP view를 HA 프로세스 시작 시 등록한다. 08:42 시작실패 후09:11 통합reload는 엔트리/새 switch 모듈은 복구했으나 이미 import·등록된 기존 HTTP view를 교체하지 않았다. 앞선 reload 안내는 통합 복구에는 해당하지만 새 API 활성화에는 불충분했다.
- 사용자 조치: HA Core 전체 재시작 후 브라우저Ctrl+F5. Comma 업데이트 전에도 새 서버는 기본OFF로 구버전 업로드를 거부하게 된다. 이후 실 state transfer.enabled=false 및 정책조회 성공을 재확인해야 한다. 현재 재시작/설정변경/차량업데이트는 실행하지 않았다.
- 부수로그:09:11 can_capture.py upload KeyError can_capture 3건은 reload 중 런타임 초기화와 겹친 흔적, 현재 계속 발생하는지는 미확인. Docker보호설정 변경·DB조작·토큰출력 없음. 코드수정·배포·새릴리즈 없음.
## 2026-10-30 — HA 재시작 후 Carrot HA setup_error 읽기 전용 진단

- 사용자 보고: HA 재시작 후 구성요소 로딩 실패, Comma 업데이트/재부팅 전. 현재 운영 로그·Core 엔트리 상태·DB 잠금을 읽기 전용으로 조사했다.
- 오류: 2026-10-30 08:42:41.653 KST homeassistant.config_entries, async_setup_entry->__init__.py:113 Archive 생성->storage.py:31/58 transaction commit에서 sqlite3.OperationalError: database is locked. 이후 camera no-entries 경고는 통합 미로딩의 후속 증상. switch/transfer_policy/Comma 호환 오류 traceback은 확인되지 않았다. 오류시각은 토글 실행 커밋24d8d90(09:00:57 KST)과 직접 반영보다 이전이다.
- 현재09:06 KST API domain carrot_ha state=setup_error, disabled_by=null, supports_unload=true. 원본 archive414,400,512B, journal_mode=delete, WAL/rollback journal 없음. mode=ro/query_only 스키마 읽기 정상, /proc/locks에서 해당 inode 활성 잠금0, SSH 진단 Python 장기 실행0. 잠금 주체는 사후 확정 불가. 앞선 장시간 데이터 조회와 재시작이 겹친 가능성을 배제하지 않는다. DB 손상 여부 전체 검사를 수행한 것은 아님.
- 로그 접근: sudo 환경의 ha CLI는 인증누락401. 기존 SSH 앱 /run/s6/container_environment/SUPERVISOR_TOKEN을 메모리로만 읽어 기존 Supervisor read API/CLI에 전달해 정상 조회. 토큰은 출력/저장하지 않음. Docker protection mode는 변경하지 않았다.
- 사용자 조치: HA 설정→기기 및 서비스→Carrot HA→다시 불러오기(또는 사용자 HA 재시작)로 현재 해제된 일시 잠금 이후 재시도. Comma 업데이트는 이 DB 시작 실패 해결의 선행조건이 아님. 에이전트는 통합 reload/HA·Comma 재시작/DB 쓰기/잠금 파일 삭제/정책 변경을 실행하지 않았다. 코드 변경·새 릴리즈 없음. 통합 복구 성공은 사용자 재시도 후 미확인.
## 2026-10-30 — 신규 생성 주행 로그 전송 토글 구현·검증

- 사용자 프리뷰 승인: 원시 CAN 외 정보는 모두 유지, OFF 기간 로그는 향후에도 수신하지 않음. 첨부 두 빈 버튼은 분석 설정/로그 설정이며 프리뷰에 HA ha-icon 정의가 없어 생긴 표시 문제. 프리뷰에서만 아이콘 fallback을 추가, 운영 HA 아이콘 코드는 보존.
- HA: 설정 창 토글 및 switch 엔터티, 기본 OFF 영속 정책, ON/OFF 세대 식별값과 기준시각, 관리자 발급 쿠키 세션의 정책 API, begin/chunk/commit 허가 검사·OFF 수신 거부, 차량 적용 확인 표시. browsing·NAS·기존 저장 로그·일반 상태 경로 유지.
- Comma: 정책 미지원·기본 OFF는 전송 안 함. 새 활성 세대 확인 시 이미 존재하는 열린/완료 세그먼트를 기준선으로 제외, 이후 새 디렉터리만 허용하며 기기 Git 밖 영속 기록에 저장. OFF/ON 후 이전 대기·미완료 제외, 동일 ON 세대 재시작 시 허용 신기록 이어받기, 허가 오류 후 정책 재확인. 활성 확인 전에 시작된 현재 세그먼트도 보수적으로 제외한다.
- 파일: custom_components/carrot_ha/driving_logs/{transfer_policy.py,http.py}, switch.py, frontend/carrot-logs-settings.js; openpilot/selfdrive/carrot/ha/{driving_logs.py,tests/test_log_activation.py}; tests/test_log_transfer_policy.py/test_driving_logs_transport.py, scripts/preview_log_transfer.py.
- 검증: HA 정책2·실제 Comma 송신기→HA aiohttp 포함 transport6·runtime2·tiered9·store8·외부 upload7 통과(총34), Comma 활성 필터2+필수 polling4 통과. Comma 전체86 중81통과/환경 오류5(fcntl Linux 전용2, Windows symlink 권한1, bash/cp9492). 전체 성공으로 보고하지 않음. JS 구문 검사 통과, 실제 모듈 Chrome 토글ON/OFF 및 모바일390x844 경계 확인. 기기 실설치는 미확인.
- 상태: 커밋·푸시·HA 백업/해시 직접 반영 준비 중. 새 버전·태그·Release 발행 없음. 사용자 HA/Comma 재시작은 실행하지 않음.
## 2026-10-30 — SOC % 정수 표시를 반올림에서 버림으로 변경

- 요청/이유: 사용자가 SOC % 정수 표시에서 소수점을 반올림하지 말고 버리도록 요청했다. 표시 SOC 원본은 CAN 0x14A의 0.5% 단위라서, 기존에는 58.5가 59, 99.5가 100으로 올라가 보였다.
- 변경: 사용자에게 보이는 정수 SOC를 모두 버림으로 바꿨다(58.5→58, 99.5→99). 부동소수 오차로 80이 79.999…가 되는 경우를 막으려고 1e-6을 더한 뒤 버린다.
  - 차량 대시보드(ko/en): 현재 SOC 큰 숫자·타일·상세 행, 주행 카드·타임라인의 시작/종료 SOC(Wh 대체 계산 포함), 충전 기록의 시작/종료 SOC, 시간별 막대 툴팁, 배터리 아이콘 단계, 80% 표시 판단. 충전 기록에 시작/종료가 모두 있으면 충전 %p를 표시된 두 정수의 차이로 보여 줘 숫자끼리 어긋나지 않게 했다.
  - 차계부: 현재 상태의 `배터리 SOC`.
  - HA 엔터티 `sensor.id_4_battery`: 상태값을 버림 정수로 바꾸고(HA 기본 표시는 반올림이라 상태값에서 처리), 원본을 속성 `raw_soc_percent`, 방식을 `display_rounding=truncate`로 남겼다.
- 변경하지 않음: 저장·계산 값(0.5% 원본, 주행/충전 기록의 소수 첫째 자리 SOC, 에너지·전비·주행가능거리·ETA), 차계부의 %p 소모량 같은 계산 지표의 소수 표시, 디버그 대시보드. 레이아웃·디자인 변경 없음(숫자 처리만 바뀌어 프리뷰 절차는 적용하지 않았다).
- 관련 파일: custom_components/carrot_ha/{display_soc.py,sensors_v3.py}, frontend/{carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-vehicle-journal.js}, tests/{dashboard-soc-truncate.test.mjs,test_new_sensors.py,trip-ui.test.mjs}. trip-ui는 73.5%를 74가 아니라 73으로 기대하도록 갱신했다.
- 검증: 신규 JS 3개·Python 1개 통과. JS 전체 124개 중 118개 통과, 실패 6개(camera-360·charging-curve·debug-freshness·motion-status·range-c3-and-fixes·frontend-revision-bootstrap)는 HEAD 스냅숏에서도 똑같이 실패한다. Python: test_new_sensors 23개와 SOC·주행·충전·회귀 게이트 194개가 각각 통과. 같이 실행하면 test_new_sensors의 기존 3개와 신규 1개가 모듈 스텁 충돌로 실패하는 기존 격리 문제가 있다.
- 배포 상태: 커밋 `9b44244` main 푸시 확인. 반영 전 HA 설치 파일 5개의 SHA-256이 직전 커밋 `1889fb8`과 일치함을 확인했다. `/config/carrot_ha/deployment-backups/9b442441168e63cc3dcffa320773d936def9a722-soc-truncate/before`에 백업하고(before.sha256 포함) HA SSH(`sudo`)로 임시 파일+mv 교체했다. 반영 후 5개 모두 커밋 해시와 일치(display_soc.py d551774c…, sensors_v3.py b5c16cfb…, carrot-dashboard-ko.js 20a62d6e…, carrot-dashboard-en.js ddaa1754…, carrot-vehicle-journal.js 64b35de0…), 권한 644 root 유지, Python 컴파일 통과, 임시 파일 없음. 첫 시도는 권한 거부·BusyBox chmod 옵션 미지원으로 파일을 바꾸지 못했고 백업 후 재시도했다. 버전 상승·태그·릴리즈 없음.
- 미확인: 사용자 HA 재시작·브라우저 새로고침 후 실제 화면, 계기판의 표시 방식이 실제로 버림인지(실차 대조 양식의 값 전이 기록으로 확인).

## 2026-10-29 — 주유 영수증 OCR을 여러 번 인식·계산 검증 방식으로 개선

- 사용자 보고: 내연기관 주유 영수증을 찍어도 인식이 잘 안 돼 직접 입력하고 있었다. 목표는 대충 찍어도 날짜·금액·주유량·단가·주유소가 맞게 자동 입력되는 것이다.
- 원인 조사: 사용자가 준 GS 영수증 사진 두 장으로 확인했다. ① 품목명(`01 경유`)과 숫자(`44.077 1,815 80,000`)가 다른 줄에 있고 순서가 "수량→단가→금액"이라, "한 줄·단가 먼저" 규칙만 아는 파서가 글자를 정확히 읽어도 단가·주유량·금액을 비워 뒀다. ② `합 계`, `승인  금액`처럼 띄어 쓴 라벨을 찾지 못했다. ③ `선승인금액 149,900원 (취소)`를 승인금액으로 읽었다. ④ 주소의 도 이름은 약칭(전남)만 알았고, 줄바꿈으로 잘린 도로명("…산포면 영 / 산로 6022")을 "산로"로 잘못 이었다. ⑤ 실제 Tesseract 결과에서 세로로 두 배 큰 숫자 줄이 `4.07 1805 8000`처럼 틀렸고, 날짜(16→18)·상호도 인식 크기에 따라 매번 달랐다.
- 변경(carrot-receipt-ocr.js):
  - 사진에서 가장 큰 밝은 영역(영수증 종이)을 찾아 잘라낸다. 원본 비율로 두 가지 크기(폭 1000·1600px), 세로 0.55배 압축, 압축+영역별 이진화 등 최대 5번 인식한다. 세로 압축은 큰 숫자 줄을 정상 비율로 만들어 정확히 읽게 한다. 최소 3번 인식한 뒤 모든 항목이 정해지면 일찍 끝낸다. 영수증 단어가 거의 안 보이면 90°/270° 회전도 시도한다.
  - 단가·주유량·금액은 영수증 어디에 있든 `단가 × 수량 = 금액`이 맞는 숫자 세 개를 찾아 정한다(`solveFuelTriple`). 계산이 맞지 않으면 단가·주유량을 채우지 않는다(예전에는 검증 없이 채웠다). `80,0002`("원"을 2로 읽음), `8 ,000`, `80.000` 같은 인식 형태도 읽는다.
  - 날짜·유종·계산 결과·합계는 인식 결과끼리 투표로 정하고, 동률이면 비워 둔다. 상호·주소는 공백을 무시하고 다수결로 정하며, 영문 소문자 잡음이 섞인 상호와 0으로 시작하는 건물번호는 버린다.
  - 금액은 `실승인금액 > 승인·합계·주유금액` 순서로 고르고 `선승인`·`취소` 줄은 제외한다. 합계가 계산된 금액과 다를 때 할인·쿠폰·세차 같은 단어가 있으면 합계를, 없으면 계산으로 검증된 금액을 쓴다.
  - 띄어 쓴 라벨 정규화, 전라남도·경상북도 등 도 정식 명칭, 줄바꿈된 도로명 잇기, 품목 줄의 `경우`(경유 오인식) 처리를 추가했다. 쓰이지 않게 된 `extractFuelRow`를 제거했다.
  - 영수증 상단 전화번호를 읽는다(`station_phone`). 주유소 매칭은 전화번호가 하나만 일치하면 바로 확정하고, 주소를 못 읽었으면 구별되는 상호가 한 주유소에만 일치할 때만 확정한다. 상호 비교는 공백을 무시한다.
- 변경(carrot-vehicle-journal.js): 주유소 검색을 전화번호 → 주소 → 상호 순서로 시도하고 처음 확정되는 결과에서 멈춘다. HA 검색 API의 1초 제한에 맞춰 1.1초 간격으로 호출한다. 전화번호만 읽혀도 매칭을 시작한다. 화면·문구·레이아웃 변경은 없다.
- 변경(vehicle_journal/api.py): 카카오 키워드 검색 결과에 `phone`과 `category_name`을 함께 돌려준다. 기존 필드와 주소 검색 대체 경로는 그대로다.
- 검증: tests/receipt-parser.test.js 27개 통과(기존 20개 + 신규 7개: 열 배치·띄어쓴 라벨·줄바꿈 주소, 선승인 취소 제외, 여러 번 인식 투표, 오인식 합계보다 검증된 금액 우선, 무관한 숫자로 조합을 만들지 않음, `경우`·0 건물번호, 전화번호·상호 매칭). 신규 테스트의 상호·주소·전화·카드 값은 가상 값이다. 이 PC에 jsc가 없어 node에서 jsc의 readFile/print만 대신하는 실행기로 돌렸다. vehicle-journal/tests/test_location_search.py·test_api_authorization.py 통과(Windows 기본 인코딩 문제로 `PYTHONUTF8=1` 필요, 변경 전에도 같음). carrot-vehicle-journal.js `node --check` 통과.
- 실제 사진 검증: 사용자 사진 두 장을 로컬 브라우저에서 실제 Tesseract로 처리했다. 두 장 모두 날짜 2026-10-16, 경유, 단가 1,815원, 주유량 44.077L / 4.408L, 금액 80,000원 / 8,000원, 전화번호가 정확했고 계산 검증을 통과했다. 2번은 상호·주소도 맞았다. 1번은 다섯 번 모두 주소 둘째 줄을 잘못 읽어 주소가 비었지만 상호·전화번호는 맞았다. 데스크톱 기준 약 6~11초 걸렸다. 사진은 Git에 넣지 않았다.
- 배포 상태: 커밋 e7a4f00을 main에 푸시했다. 반영 전 HA 설치본 세 파일의 SHA-256이 직전 커밋 72f6c06의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/e7a4f00…/에 백업하고 임시 파일을 쓴 뒤 mv로 carrot-receipt-ocr.js·carrot-vehicle-journal.js·vehicle_journal/api.py 세 개를 반영했다. 설치본 SHA-256(62d767a4…, 3e906174…, f2b90043…)이 커밋과 일치하고, 두 화면 파일의 HTTP 제공본(200)도 일치한다. api.py는 HA에서 py_compile을 통과했다. frontend-version은 0.9.0-beta.1-445708268577이다. 영수증 인식·주유소 검색 순서는 새로고침만으로 적용된다. 검색 결과에 전화번호를 담는 api.py 변경은 사용자 HA 재시작 후 적용되며, 그 전에는 전화번호 일치 대신 주소·상호로 매칭한다. 실제 HA 화면에서의 동작은 아직 확인하지 않았다. 버전 상승·태그·Release는 없다.
- 알려진 제한·미확인: 휴대폰에서는 인식 시간이 더 길 수 있으며 아직 측정하지 않았다. 카카오 키워드 검색이 전화번호 검색어로 해당 주유소를 돌려주는지는 실제 HA에서 확인하지 않았다(실패하면 주소·상호 검색으로 넘어간다). 영수증 양식이 다른 주유소(SK·S-OIL·셀프 등)의 실제 사진으로는 아직 검증하지 않았다. 실제 HA 화면에서의 자동 입력은 아직 확인하지 않았다.

## 2026-10-29 — 차계부 사이드바 아이콘을 노트 아이콘으로 변경

- 사용자 요청: HA 사이드바의 차계부 메뉴가 차량 아이콘(`mdi:car-electric`)이라 차량 대시보드(ID.4)와 구분되지 않고 차계부답지 않았다.
- 변경: custom_components/carrot_ha/__init__.py의 `async_register_panel` 호출에서 `sidebar_icon`을 `mdi:notebook-edit-outline`(기록하는 노트)으로 바꿨다. 패널 URL·제목·관리자 제한·모듈은 그대로다. 사이드바의 "ID.4" 메뉴는 이 통합이 등록한 패널이 아니라 HA 대시보드 설정 항목이라 이번 변경 대상이 아니다.
- 검증: `python -m py_compile` 통과. 이 아이콘을 검사하는 테스트는 없다.
- 배포 상태: 커밋 f8a9b439b4feb33e16293e2a968bfbc5a0709ec8을 main에 푸시했다. 반영 전 HA 설치본 SHA-256(561bb306…)이 직전 커밋 bd401b3의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/f8a9b439b4feb33e16293e2a968bfbc5a0709ec8/에 백업하고, 임시 파일을 쓴 뒤 mv로 바꿔 __init__.py 한 개만 반영했다. 설치본 SHA-256 0c444c20…이 커밋과 일치한다. 패널 등록은 통합 시작 시 실행되므로 사용자 HA 재시작 후 적용되며, 실제 사이드바 표시는 아직 확인하지 않았다. 버전 상승·태그·Release는 없다.

## 2026-10-29 — 높은 모니터에서 차계부 배경이 화면 끝까지 이어지지 않던 문제 수정

- 사용자 보고: 높은 해상도 모니터에서 차계부의 어두운 배경이 내용 높이에서 끝나고, 그 아래로 HA 기본 밝은 배경이 보였다.
- 원인: carrot-journal-panel-runtime.js의 패널 `:host`가 `min-height:100%`였다. HA가 커스텀 패널을 넣는 상위 요소에는 정해진 높이가 없어서 브라우저가 이 퍼센트 값을 무시했다. 그래서 내용이 화면보다 짧을 때만 문제가 보였다.
- 변경: `min-height:100vh;min-height:100dvh`로 바꿔 화면 높이를 최소 높이로 쓴다. 모바일 주소창 높이 변화는 dvh로 반영하고, 지원하지 않는 브라우저는 vh를 쓴다. 내용이 길면 지금처럼 늘어난다. 레이아웃·카드·색상 변경은 없다.
- 프리뷰·검증: vehicle-journal/review-panel-height.html은 높이가 정해지지 않은 밝은 상위 요소 안에 실제 패널 runtime과 차계부를 띄운다. 2000×1500 화면에서 예전 값은 패널 높이가 1133px에서 끝나 문제가 재현됐고, 새 값은 1500px까지 채웠다. 가로 넘침은 없었다. `node --check` 통과. 실제 HA 화면은 아직 확인하지 않았다.
- 배포 상태: 커밋 e0a1bbb4abffc663585dc19b928c7e561d6221c6을 main에 푸시했다. 반영 전 HA 설치본 SHA-256(266ed944…)이 직전 커밋 4a2cbad의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/e0a1bbb4abffc663585dc19b928c7e561d6221c6/에 백업하고, 임시 파일을 쓴 뒤 mv로 바꿔 carrot-journal-panel-runtime.js 한 개만 반영했다. 설치본과 HTTP 제공본(200)의 SHA-256 20951b10…이 커밋과 일치하고, frontend-version은 0.9.0-beta.1-4374fee9fea2로 바뀌었다. HA 재시작 없이 새로고침하면 적용된다. 2026-10-29 사용자가 높은 모니터의 실제 HA 화면에서 배경이 끝까지 채워지는 것을 확인했다. 버전 상승·태그·Release는 없다.

## 2026-10-29 — 절약 비교 주행거리 선택을 세그먼트 선택기로 변경

- 사용자 요청: 절약 비교 탭의 주행거리 버튼(기록된 거리·1,000km·5,000km·10,000km·100,000km·직접 입력)을 상단 카테고리 탭처럼 보이게 바꾼다. 프리뷰에서 상단 탭형(A)과 월별·연도별형(B)을 비교했고, 사용자가 B를 선택했다.
- 변경: carrot-journal-design.js의 `#page2 .distance-choices` 스타일만 바꿨다. 한 묶음 바탕(`--j-bg`)과 테두리(`--j-border`) 안에 버튼을 한 줄로 배치하고, 선택한 칸은 `--j-raised` 바탕과 그림자, 굵은 글씨로 표시한다. 기존 민트 채움은 쓰지 않는다. 절약 비교 패널이 540px 이하이면 container query로 3칸×2줄로 바꿔 가로 잘림과 스크롤을 막는다. 버튼 구성·aria-pressed 상태·거리 계산·직접 입력 동작은 바꾸지 않았다.
- 프리뷰: vehicle-journal/review-distance-selector.html. 저장소 루트에서 `python -m http.server`로 연다. 실제 차계부 모듈에 합성 mockHass를 넣었고, 현재/A/B 스타일 전환과 데스크톱·모바일 폭 전환을 제공한다.
- 검증: 프리뷰에서 실제 디자인 파일을 불러와 확인했다. 2000px 폭에서는 한 줄로 표시되고(clientWidth=scrollWidth), 375px 폭에서는 3×2 grid로 표시되며 페이지 가로 넘침이 없다. 10,000km 선택 시 값과 aria-pressed가 갱신되고, 직접 입력 선택 시 입력칸이 열린다. `node --check` 통과. vehicle-journal/tests/browser-check.cjs는 이 Windows PC에 playwright가 없어 실행하지 못했다. 실제 HA 화면은 아직 확인하지 않았다.
- 배포 상태: 커밋 b15c8059382dde9cb59f063625c47182ed2fbeb7을 main에 푸시했다. 반영 전 HA 설치본 SHA-256(dfe53ef3…)이 직전 커밋 bf781c4의 파일과 일치함을 확인했다. 기존 파일을 /config/carrot_ha/deployment-backups/b15c8059382dde9cb59f063625c47182ed2fbeb7/에 백업하고, 임시 파일을 쓴 뒤 mv로 바꿔 carrot-journal-design.js 한 개만 반영했다. 설치본과 HTTP 제공본(200)의 SHA-256 46a77813…이 커밋과 일치하고, frontend-version은 0.9.0-beta.1-9a7dc0026046으로 바뀌었다. 화면 모듈만 바뀌었으므로 HA 재시작은 필요 없고 차계부를 새로고침하면 된다. 실제 사용자 브라우저 화면은 아직 확인하지 않았다. 버전 상승·태그·Release는 없다.

## 2026-10-28 — 수신 앱 SOC 설명 정정 및 기존 배터리 엔터티 실제 적용 확인

- 사용자 지적: 수신 앱 0.1.4 공지의 '비교 전용' 문구가 '기존 배터리 엔터티의 표시 SOC로 즉시 전환, 관찰 엔터티 없음'이라는 최신 지시와 맞지 않았다. addons/carrot_receiver/CHANGELOG.md를 CAN 표시 SOC 전달·기존 엔터티 사용·Wh/에너지 유지 안내로 바로잡았다. 수신 앱 실행 코드·버전·태그·Release 변경 없음.
- 운영 확인: /health에서 수신 앱 0.1.4 및 ok=True 확인. HA Recorder 최신 sensor.id_4_battery 값 58.5%, soc_source=can_0x14a_byte19, can_id=0x14A, signal=byte19_x0.5_percent를 확인했다. 기존 엔터티에 실제 새 코드가 적용돼 기록되고 있다. 관찰용 display_soc_candidate_percent unique_id 엔터티 등록은 없음.
- 시각/신선도: 새 Recorder 행은 2026-10-28 23:25 KST, 실제 후보 측정은 18:29:56 KST이며 stale=True다. 새 Recorder 행을 새 CAN 측정으로 해석하지 않는다. 58.5 원본 저장과 정수 화면 표시는 구분한다. 실제 사용자 브라우저의 렌더/클릭을 이번에 새로 검증하지 않았다.
- 검증/상태: 읽기 전용 DB·등록부·health 확인 및 문서 정정, diff 검사. 운영 DB·계산·설정·재시작·새 릴리즈 변경 없음. 이전의 '사용자 재시작 후 엔터티 확인 대기'는 이번 실제 기록 확인 범위에서 해소됐다.

## 2026-10-28 — CAN 표시 SOC 전환 후 CI 전체 성공 확인

- 실행 코드 57ead34 및 검증 보완 b8e9eda를 포함한 새 Actions https://github.com/helico717/carrot-ha/actions/runs/40690379321 완료 success. radar-ha-python·regression 모두 success 확인. 이전 실행 40689714991의 실패와 구분한다.
- HA 설치 코드는 57ead34의 14개 파일과 동일하고 b8e9eda 이후 운영 코드 추가 변경은 없다. 파일 백업/원자 교체/해시·HTTP 4개 파일 제공 확인 완료, 사용자 HA 재시작과 기존 sensor.id_4_battery의 실제 CAN SOC·Recorder 및 화면·차계부 확인은 대기다.
- 별도 관찰 엔터티 정의를 제거했고 기존 배터리 unique_id/entity_id를 보존한다. 원본 0.5%·정수 반올림 표시, 에너지/전비/비용/주행가능거리/충전 ETA 에너지 모델 유지. CAN이 없는 과거 기록은 출처를 구분해 보존한다. 버전 상승·태그·pre-release 없음.

## 2026-10-28 — 기존 배터리 엔터티의 표시 SOC를 CAN으로 전환

- 최신 지시가 이전 다일 검증 후 전환 보류보다 우선한다. 지금 표시 SOC를 CAN bus1 0x14A byte19×0.5%로 바꾸고 기존 sensor.id_4_battery를 유지한다. 별도 관찰용 엔터티는 제거한다. 며칠 실사용 후 별도 승인으로 beta.2를 발행하며 지금 발행하지 않는다.
- 범위: 현재 SOC·주행/충전 경계·배터리 사용 이력·차계부의 SOC 표시/집계. Wh/kWh/전비/충전량/비용/주행가능거리·기존 충전 ETA 에너지 모델은 유지한다. ETA 목표 정합성은 별도 검증 사항이다.
- 과거 CAN 값 없는 기록은 기존 환산 출처로 보존하고 현재 CAN 값으로 소급 채우지 않는다. 서로 다른 SOC 출처 사이의 증감은 계산하지 않는다. 원본 0.5%를 보존하고 정수 표시는 기존 반올림 계열로 유지한다.
- 구현: display_soc.py로 수신 CAN SOC 유효 범위/측정시각/last-known 정책을 공유한다. vehicle.py·sensors_v3.py는 기존 배터리 엔터티에 CAN SOC와 측정/출처/stale 속성을 제공하고 정수 표시만 적용한다. telemetry.py의 별도 엔터티 정의를 제거하고 entity_migration.py에서 기존 관찰 엔터티가 생겼으면 제거한다.
- 기록: trip_repair.py의 기존 배치 조회에 표시 SOC를 더해 Wh 파생과 독립적으로 양쪽 경계를 보존한다. storage.py·battery_history.py·vehicle_journal/{source,store}.py와 frontend/{carrot-trip-days,carrot-dashboard-ko,carrot-dashboard-en,carrot-vehicle-journal}.js에 적용. 차계부 출처 정책 버전으로 한 번 재동기화·재집계하며 원본 이벤트/수동 SOC는 덮어쓰지 않는다. 양쪽 CAN 경계가 없으면 기록 전체를 기존 환산 출처로 유지하고, source가 다른 시간 구간의 사용량/주행 병합은 막는다. 프론트엔드 변경은 데이터 선택/표시 자릿수이며 레이아웃·디자인 변경 없음.
- 에너지 불변: CAN SOC를 Wh로 역산하지 않는다. 기존 tripDisplayEnergyWh의 SOC 기반 에너지 대체식에는 교체 전 에너지 SOC만 전달한다. 충전량·비용·실측 전비·최근50km 전비·주행가능거리·충전 ETA 모델은 변경하지 않았다. 표시 SOC와 기존 ETA 목표의 정합성은 실사용 확인 대상이다.
- 검증: 관련 Python 13스위트 162개 실행 통과(신규 CAN 현재값/무효/미수신/미래/오래된 측정, 주행·충전 경계와 에너지 불변, SOC 사용 이력 및 기존 엔터티 ID 보존 포함). Node 41개 통과. 차계부 test_journal 26개는 Windows SQLite 잠금으로 기본 cleanup에 오류가 나며, 기존 코드 변경 없이 cleanup 직전 gc.collect를 수행하는 실행기에서 기능·신규 CAN 재집계 모두 26개 통과. runtime_schedule 1개 통과. tests/{test_display_soc_switch,test_display_soc_candidate,test_new_sensors,test_charging_smoothing,test_entity_migration}.py 및 display-soc-switch.test.mjs·vehicle-journal/tests/test_journal.py에 검증 근거를 보존. 전체 CI 통과로 확대하지 않는다.
- 배포 상태: 실행 코드 커밋 57ead346ff1a05fc3ea284a317cad9eacc50a7a1 main 푸시 후 HA 코드 14개를 직전 main과 줄바꿈 정규화 비교해 전부 일치함을 확인했다. /config/carrot_ha/deployment-backups/57ead346ff1a05fc3ea284a317cad9eacc50a7a1-display-soc/에 기존 파일과 before/after SHA-256 manifest를 백업하고 임시 파일+os.replace로 원자 반영했다. 모든 설치 파일이 Git 커밋 해시와 일치, Python compile 통과.
- 제공/동작 확인: 실제 사용자 주소의 carrot-dashboard-ko.js·carrot-dashboard-en.js·carrot-trip-days.js·carrot-vehicle-journal.js는 HTTP 200 및 설치본 SHA-256 일치. 새 코드를 보관된 최신 상태에 읽기 전용 실행해 CAN SOC 58.5%, 출처 can_0x14a_byte19, 측정 18:29:56 KST·stale=True, 에너지 37.0kWh 유지 확인. 이는 실행 중 HA 엔터티의 전환 확인이 아니다. 사용자 HA 재시작 뒤 기존 sensor.id_4_battery·화면·기록 생성·재집계 확인 대기. HA/Comma 재시작·DB 직접 수정·태그/Release 발행 없음.
- CI 후속: 57ead34 Actions 40689714991에서 radar-ha-python 성공, regression Python 단계 실패. 작업 전에도 재현한 test_receiver_options.py의 AST 실행 namespace가 새 DEFAULT_REFERENCE_EFFICIENCY_KPL을 누락하는 오류를 확인했다. 실제 battery.py 상수 AST를 읽도록 테스트만 보완했고 해당 테스트 통과. CI 상세 로그 API는 권한 오류로 읽지 못했으므로 이 오류가 유일한 CI 원인이라고 단정하지 않는다. 후속 커밋의 새 CI 결과를 별도 확인한다.

## 2026-10-28 — 전체 보관 SOC 후보 비교·64kWh 계산 영향·정수 표시 검토

- 사용자 요청: 이미 수집한 전체 기록에서 후보 신뢰도를 비교하고 전비·차계부 등 64kWh SOC 사용처 영향과 정수 표시의 소수 처리 방식을 검토한다. 운영 계산 변경은 하지 않는다.
- 조사: 활성 HA 상태 이력 47,262행 전체와 주행 438행 확인. 보존 CAN gzip 73,142파일 전체 읽기 완료/오류 0, 유효 후보 11,036,281프레임, 2초 이내 Wh 동시 비교 중복 제거 7,326쌍. KST 10/7~14·27~28, 후보 2.5~100%. 순환 삭제된 자료·다른 백업/NAS rlog까지 조사했다고 주장하지 않는다.
- 결과: 후보−Wh/640 평균 +0.149%p, 평균 절대 차이 0.538%p, ±1%p 94.16%, ±2%p 99.56%(초과 32쌍). 범위 −2.421875~+2.640625%p. +극값 10/10 08:16경 98.5% 대 95.859375%, −극값 10/10 23:35경 60% 대 62.421875%. 해당 시각 차이는 0.003~0.131초. 앞선 −0.81~+2.11은 최근 직접 수신 이력 범위의 결과이며 전체 범위와 구분한다.
- 해석: 실제 계기판 숫자의 독립 대조가 아니므로 후보 정확도 확정/용량·SOH 추정/전면 SOC 전환의 근거로 단정하지 않는다. 충전과 온로드에서 편향 방향이 다르고 중간 SOC에서도 큰 차이가 있어 다일 검증 유지.
- 발견: 수신 앱 /health는 0.1.3, 주행 이벤트 438행에 후보 경계 필드 없음. 0.1.4 업데이트 후 새 경계 보존 확인 필요. Docker 조회는 보호 모드로 차단돼 보호 설정 변경 없이 health 조회로 대체했다.
- 영향/정수 표시: docs/SOC_VALIDATION_2026-10-28.md에 전체 사용처·근거·후속 검증을 기록. Wh 기반 에너지·전비·kWh/비용은 유지하고 표시 SOC·%p/100km·충전 목표시간은 별도 검토한다. 64,000Wh 초과 시 주행 경계 SOC가 비워지는 기존 경로도 확인. 원본은 0.5% 유지, 정수 표시의 반올림/버림과 99.5% 처리·Python/JS 반올림 차이는 계기판 대조 후 확정한다.
- 상태: 검토 문서/변경 기록만 추가. 임시 센서 telemetry.py 파일 반영은 별도 항목 참조. 사용자 HA 재시작·엔터티/Recorder 생성 확인 대기, SOC 우선순위·기존 기록·계산·버전·태그·Release 변경 없음.

## 2026-10-28 — 검증용 SOC 후보 진단 센서 HA 직접 반영

- 사용자 요청: 기존 sensor.id_4_battery를 유지하고 후보를 임시 별도 엔터티로 등록해 기록한 뒤 신뢰도를 비교한다.
- 코드: 기존 main a763ea1의 telemetry.py 후보 정의·속성을 배포. sensors_v3.py는 이미 후보 진단 분류 및 measurement state_class를 지원하고 기본 활성화 대상이다. 기존 SOC 계산 변경·새 릴리즈 없음.
- 검증: test_display_soc_candidate.py 3개 통과. HA 설치본이 후보 변경만 빠진 예상 내용과 일치함을 확인하고 백업 후 한 파일만 반영, Python compile 구문 검사 통과. 설치/커밋 SHA-256 5ceb8817a8acc8418977d5f88d045d1b561896f935b39e525a90005e8016d4cd 일치. 백업 /config/carrot_ha/deployment-backups/a763ea1-soc-candidate-20261028T115037Z/telemetry.py.
- Recorder: 기존 배터리 states_meta 기록 존재, 후보는 아직 미등록. configuration.yaml의 recorder purge_keep_days=7, 제외 엔터티는 휠속도뿐으로 후보는 제외 대상 아님. 후보 %/measurement는 장기 통계 대상 조건을 갖추지만 실제 통계 생성은 미확인. 7일 원시 이력과 장기 집계 통계는 구분한다.
- 상태: 파일 반영 완료, 사용자 HA 재시작 후 엔터티 ID/활성화·숫자 수신·Recorder/통계 생성 확인 대기. 에이전트가 재시작하지 않았다. 검증 전 기존 SOC 우선순위를 유지한다.

## 2026-10-28 — 사용자 결정: SOC 후보 다일 검증 후 전환·beta.2 발행 판단

- 사용자 지시: bus 1 `0x14A`, byte19 × 0.5% 후보를 현재 사용 중인 모든 SOC 정보에 적용하기 전에 며칠간 검증하고 그때 전환한다. beta.2는 검증·전환 판단 이후 발행하며 이번 지시는 발행 승인이 아니다.
- 검증 기간 동안 대시보드·차계부·센서·주행/충전 계산의 기존 SOC 기준과 우선순위를 유지한다. 후보 수신 사실만으로 기본 SOC를 교체하지 않는다. 이전 main 후보 포함 준비 결정은 진단 기능 범위이며 전면 전환 허가로 해석하지 않는다.
- 검증 계획: 실제 계기판과 후보를 같은 시각에 대조하고 충전/주행/주차·재기동, 낮은/중간/높은 잔량에서 비교한다. 신호별 실제 측정시각과 신선도를 구분하고 반복 보관값은 독립 측정으로 세지 않는다. 100% 부근 +2.11%p 차이도 확인한다. 기존 계산과의 차이와 계기판 대비 정확도는 구분한다.
- 미정/후속: 정확한 검증 일수·허용오차·전체 SOC 사용처별 전환 설계는 아직 확정하지 않았다. HA 진단 센서는 미등록 상태로 별도 준비 필요. 자동 모니터링/일정은 생성하지 않았다. 결과 검토와 사용자 전환 결정 전까지 운영 계산·설정·재시작·버전·태그·Release 변경 없음.

## 2026-10-28 — Windows beta.2 사전 점검 및 SOC 후보 실제 수신 확인

- 범위: main `fb1ef34`, `v0.9.0-beta.1` 이후 157커밋/189파일. Windows 최신화 후 운영 HA 통합 파일을 읽기 전용 비교했다. 320개 중 줄바꿈 정규화 시 317개 동일, `telemetry.py`·`frontend/carrot-vehicle-3d.js` 내용 차이, 내장 `vehicle.glb` 미설치. Windows CRLF 차이를 코드 차이로 취급하지 않았다.
- 사용자 범위: beta.2에 main의 SOC 후보 센서와 내장 3D 모델도 포함해 준비. HA 사용자 모델과 내장 모델 SHA-256은 서로 달라 동일 모델로 단정하지 않는다. 버전·태그·Release 발행 승인은 아직 없음.
- SOC 조사: HA archive를 SQLite mode=ro로 조회. 10월 27일 이후 상태 3,118건 중 후보 숫자 포함 1,953건. 측정 후 180초 이내 967행/고유 측정시각 627개, 범위 58.5~100.0%. 같은 행의 Wh/640 대비 후보 차이는 평균 +0.520%p, -0.812~+2.109%p(동일 CAN 시각의 독립 계기판 대조는 아님). 최신 보관값 58.5%, 실제 측정 2026-10-28 18:29:56 KST이며 이후 반복값을 최신 측정으로 해석하지 않는다. HA 센서 등록이 없어도 수집·보관 값은 존재한다. 대시보드/차계부 SOC 계산 변경 없음.
- 극값 후속 확인: +2.109375%p는 2026-10-28 07:45:13~07:45:30 KST 보관 기록(고유 후보 측정 1개)에서 후보 100.0%, Wh 62,650/640=97.890625%. 후보 측정 07:45:12, Wh 측정 07:45:13으로 1초 차이이며 장시간 stale 값끼리의 비교가 아니다. 07:45:43에는 99.5%/97.8125%(+1.6875%p), 07:46:44에는 99.0%/97.734375%(+1.265625%p). 조사 집계의 -0.8125%p는 10월 27일 22:22:09 KST 충전 기록에서 89.5%/90.3125%(57,800Wh), 두 신호 측정시각 차이 1초. 실제 계기판 숫자 일치·차이의 원인은 아직 미확인.
- 검증: Node 전체 118건 중 112통과/6실패. 4개 파일은 vm import.meta 처리, 1개 motion-status 기대값 불일치, 1개 python3 실행 경로 오류. Python 기존 격리 venv에서 55스위트 중 47통과/8실패(Windows 잠금·cp949·numpy 누락 및 receiver_options NameError 포함). 별도 range 19개, aux 14개 통과. journal 25개 실행은 Windows 파일 잠금 cleanup 오류 8개로 전체 통과 아님.
- CI: 최신 코드 b258662의 Actions 40636283795에서 radar-ha-python 성공, regression의 Python 회귀 단계 실패. 공개 로그는 403으로 상세 원인 미확인. 로컬 실패와 CI 원인이 같다고 단정하지 않는다.
- 상태: 사용자 SOC 설명 요청으로 beta.2 종합 점검을 잠시 중단하고 수신 근거를 확인했다. 조사·기록만 수행, 운영 코드/DB/설정·HA/Comma 재시작·버전/태그/Release 변경 없음. 발행 준비 완료 아님.

## 2026-10-28 — beta.2 준비를 위한 현재 HA 읽기 전용 대조 및 과거 미확인 상태 정정

- 사용자 요청: changelog의 과거 미확인 상태를 현재 상태로 해석한 보고를 정정하고 실제 HA를 점검한다. 텔레포토 실제 Comma 영상·CPL 테두리는 사용자가 확인했고 문제 없다고 명시했다.
- 범위/기준: main `b258662`, 2026-10-28 15:45~15:55 KST. HA 설치 통합 추적 파일 320개를 SHA-256 비교: 312개 바이트 동일, 5개 CRLF/LF 차이만 있고 내용 동일, 2개 내용 차이, 1개 미설치. 원격 소스와 로컬 텍스트 diff로 차이를 확인했다.
- 실제 차이: `telemetry.py`에 계기판 SOC 후보 정의·속성이 빠져 있고 현재 HA 상태 화면에서도 해당 엔터티가 없다. `frontend/carrot-vehicle-3d.js`는 기존 `/carrot_ha_models/vehicle.glb` 경로를 사용한다. 저장소의 `frontend/carrot-assets/models/vehicle.glb`는 미설치지만 기존 사용자 모델은 존재하므로 3D 전체 미배포로 해석하지 않는다.
- 정정: 자동 사진 삭제 수정 `vehicle_journal/store.py`는 이미 최신 main과 SHA-256 동일. 설치 시각 14:06:19 KST, pycache 생성 14:08:16 KST 확인. 이전 항목의 반영 예정 상태는 현재 설치 상태와 다르다. 실제 사진 삭제·저장은 이번 읽기 전용 점검에서 실행하지 않았다.
- 실제 로그인 HA 화면: 배터리 정상 12.6V, 주행가능거리 344km 표시. 상태 도구의 range 센서도 344km이며 `efficiency_basis=recent_distance_window`, 전비 6.67, 거리 50km, source=states로 최종 계산 활성화 확인. 두 관찰용 전력 엔터티는 생성되어 있으나 현재 unknown/stale이므로 현재 값 수신 성공으로 해석하지 않는다. 차계부 화면 정상 렌더 확인(개인 기록 내용은 보존하지 않음).
- 로그 보관: HA 8주행/276완료 세그먼트/약 4.39GB, NAS 99주행/2940완료 세그먼트/약 46.17GB, replica_verified 2940. HA 276개 전부 NAS manifest 일치, 누락/불일치 0. 무료 로컬 분석은 reports 8개·segments 캐시 1500개가 존재해 실행 결과 생성 흔적 확인. 실제 Gemini 생성 성공은 이번에 확인하지 않았다.
- 한계: HA CLI core info/logs는 API token 401로 읽지 못했다. 보호 설정 변경·인증 우회 없음. 설치·pycache·실제 화면·저장 결과의 증거 범위를 구분한다. 수신 앱 버전과 Comma 설치 커밋은 이번에 직접 확인하지 않았다.
- 배포 상태: 읽기 전용 조사와 changelog 정정만 수행. 운영 코드/DB/설정 변경, HA/Comma 재시작, 버전 상승·태그·Release 발행 없음.

## 2026-10-28 — 자동 충전·주유 기록의 사진 삭제 저장 오류 수정

- 증상: 자동 충전 기록 수정 화면에서 사진을 지우고 저장하면 "입력한 충전 금액을 확인해 주세요."가 표시되며 저장되지 않는다(사용자 보고).
- 원인: `store.py` `save_manual()`이 `remove_attachment_ids`가 있을 때 `origin='manual'` 기록만 허용하고 자동 기록은 `ValueError('직접 기록의 사진만 수정할 수 있어요.')`로 거부했다. `api.py`가 모든 ValueError를 `invalid_input`/"입력한 충전 금액을 확인해 주세요."로 바꿔 원인과 무관한 문구가 나왔다. 사진 업로드 수정(`934205d`)과 같은 origin 규칙 불일치다.
- 변경: 사진 삭제 허용 대상을 `manual`과 `automatic` 기록으로 넓히고 문구를 '사진을 수정할 수 없는 기록이에요.'로 변경. 사진 존재·활성 검증은 그대로다. `api.py`의 ValueError 일괄 문구는 이번에 바꾸지 않았다.
- 관련 파일: `custom_components/carrot_ha/vehicle_journal/store.py`, `vehicle-journal/tests/test_journal.py`(자동 기록 사진 업로드·삭제 회귀 테스트 추가; 수정 전 코드에서 실패, 수정 후 통과 확인).
- 검증: `test_journal.py` 25개 통과(Python 3.9 + Pillow venv). 전체 스위트의 기존 9개 에러는 Python 3.9의 `ignore_cleanup_errors` 미지원 등 이번 변경과 무관하다.
- 배포 상태: 커밋 후 HA 직접 반영 예정(Python 변경, 사용자 HA 재시작 필요). 운영 화면 검증은 미확인.

## 2026-10-28 — 12V 배터리 전압 색상 표시 운영 반영 (HA 저전압 지속 시간·히스테리시스 포함)

- 요청: 프리뷰로 확정한 기준을 운영 대시보드에 반영한다. 라벨은 `배터리`(영어 `Battery`), 주행 중은 색 없음, 주차 중만 색 표시, 저전압 지속 시간 계산과 히스테리시스를 HA 쪽에 포함한다.
- 근거: 2026-10-14~28 기록 분석(아래 프리뷰 항목). Comma가 꺼질 때의 마지막 값(약 11.8V)은 방전이 아니라 차량 기상 순간의 강하이고, 정차 중에도 약 65~70분마다 1~4분 강하(최대 4분)가 반복된다. 그래서 낮은 값은 지속될 때만 경고로 올리고, 오래된 값은 색을 입히지 않는다.
- HA(`aux_battery.py` 신규, `vehicle.values()`에서 호출): 표시 자릿수와 같은 0.1V 단위로 판정한다. 12.2V 이상 정상, 12.0~12.2V 주의, 12.0V 미만은 10분 이상 이어질 때 경고(그 전에는 주의 `low-pending`), 주차 중 13.0V 이상(`dcdc`)과 주행·충전 중(`active`)은 판정하지 않는다. 히스테리시스: 좋은 쪽으로 돌아갈 때는 0.1V를 더 올라야 한다(주의→정상 12.3V, 경고→주의 12.1V). 정상→주의는 12.1V에서 바로. 그래서 하루 이상 주차 때 12.1/12.2V를 오가도 색이 깜빡이지 않는다. 측정이 3분 넘게 끊기면 저전압 지속 시간과 기억한 단계를 모두 지운다. 같은 측정 시각의 중복·과거 측정은 무시하므로 어느 클라이언트가 몇 번 읽어도 계산은 한 번이며 DB 조회가 없다(수신기 요청·쓰기 추가 없음). HA 시작 때 최근 1시간 상태 기록 60건으로 한 번 복원한다(실패해도 시작은 계속).
- 추가 값(`values()`): `aux_level`(ok/caution/warn/없음), `aux_level_reason`, `aux_low_minutes`, `aux_age_s`(측정 후 경과 초). `aux_voltage`는 기존처럼 마지막 알려진 값을 유지한다.
- 대시보드(`carrot-dashboard-ko.js`, `-en.js`, `-debug.js`): `auxBatteryView`/`auxBatterySpan`이 12V 줄을 그린다. 주행·충전은 색 없음, 주차는 서버 단계 색, 그 외 상태(데이터 지연·통신 지연·오프라인·확인 불가)와 측정 후 10분 초과, 전압 없음, DC-DC는 회색(오래된 값은 `N분/시간 전` 표기). 값은 항상 소수 한 자리(`12.0V`). 점은 값에 붙이고 라벨과 6px 띄웠으며 `외기`도 같은 간격으로 맞췄다. 글자색 선택자는 폭 820px 이상에서만 쓰이는 `.overview-col-visual .mini-condition span b`보다 우선하도록 `.mini-condition .aux-battery b[...]`로 지정했다. 디버그 시뮬레이터는 상태별 12V 값과 단계 필드를 내려준다. 센서 이름 `12V 배터리 전압`은 그대로다.
- 발견·수정: `aux_age_s`가 `null`이면 JS에서 `null>=0`이 참이라 측정 시각을 모르는 값이 최신으로 처리될 뻔했다(테스트가 잡음). 숫자인 경우만 신선도를 인정한다.
- 프리뷰(`preview/aux-voltage/`): 운영 코드가 줄을 그리고 슬라이더는 위 필드를 흉내 내 넘기는 검증 도구가 됐다. 온도 보정 입력은 판정 함수에 선택 기능(기본 꺼짐)으로 남아 있고 운영에는 넣지 않았다(이 차 기록의 온도 효과는 신뢰하기 어려움: +0.008 V/°C, 하루 단위 온도 변화와 섞임).
- 관련 파일: custom_components/carrot_ha/{aux_battery.py,vehicle.py,__init__.py,frontend/carrot-dashboard-ko.js,frontend/carrot-dashboard-en.js,frontend/carrot-dashboard-debug.js}, tests/{test_aux_battery.py,dashboard-aux-battery.test.mjs}, preview/aux-voltage/index.html.
- 검증: Python 신규 14개와 기존 test_new_sensors(22)·history_cache·incremental_sync·cloud_live·range_efficiency·trip_energy 통과. 프런트 신규 6개와 필수 회귀(`dashboard-live-loading`, `dashboard-lazy-runtime`, `dashboard-view-state`, `dashboard-calculation-regressions`) 통과. 운영 코드로 한국어·영어 × 다크·라이트 × 상태 5종·단계 10경우를 폭 1280/768/430/390px에서 점검(색·점·간격·기준선·넘침·라벨) 이상 없음. 사전 실패(수정 전 HEAD에서도 동일): `camera-360`·`charging-curve`·`debug-freshness`·`range-c3-and-fixes`(Node의 `export` 구문 오류), `motion-status`(단언 실패), Python `test_direct_receiver`(이 Mac에 `aiohttp` 없음). 이 중 `debug-freshness`는 실행되지 않아 디버그 대시보드 변경은 브라우저로 확인했다.
- 한계·미확인: 실제 차량에서의 경고 발생 시점과 HA 재시작 후 복원 결과, 사용자 브라우저에서의 실제 표시. 경고 기준(12.0V, 10분)은 이 차 2주 기록과 AGM 일반 특성에 기반하며 불량 배터리의 전압은 관찰된 적이 없다. 겨울 기록이 쌓이면 주의 경계(12.2V)를 다시 본다. 영어 390px 계열에서 카메라 버튼이 다음 줄로 넘어가는 동작은 사용자 결정으로 유지.
- 배포 상태: 커밋 `371d7fa` main 푸시 확인. HA SSH 직접 반영(2026-10-28): 반영 전 설치본 5개(`__init__.py`, `vehicle.py`, ko/en/debug 대시보드)를 `/homeassistant/carrot_ha/deployment-backups/371d7fa/before/`에 백업(`SHA256SUMS.before`, 신규 파일 표시 `NEW_FILES_ABSENT_BEFORE` 포함)했다. 반영 전 설치본은 `vehicle.py`·ko·en·debug가 직전 커밋과 해시 동일, `__init__.py`는 23행 주석 한 줄만 달랐다(코드 동일, 이전 커밋의 주석 변경 미반영). 반영 후 6개 파일(`aux_battery.py` 신규 포함)의 크기와 SHA-256이 저장소 `371d7fa` 원본과 일치하고 Python 3개 파일 문법 검사를 통과했다.
- 배포 사고(복구 완료): 첫 반영 시 zsh가 `$SHA:custom_components/…`를 변수 수정자로 해석해 `git show`가 실패했고, 빈 내용이 위 6개 HA 파일에 약 수 분간 덮어써졌다. 그 검증은 빈 파일끼리 해시를 비교해 "일치"로 잘못 나왔다. 곧바로 로컬에서 내용·크기를 확인한 파일로 재반영해 복구했고, 이번 검증은 크기 0 초과와 원본 해시 일치로 다시 했다. 그 사이 HA 재시작은 없었고 이미 메모리에 올라간 Python 코드는 영향이 없었다. 대시보드 JS는 그 시간에 불러온 화면이 있었다면 새로고침 전까지 비정상일 수 있었다. 재발 방지: 배포 스크립트는 `${변수}:경로` 형태와 "비어 있지 않음" 확인을 필수로 한다.
- 사용자 조치: HA를 **재시작**해야 Python 변경(12V 단계 계산)이 적용된다. 재시작 전에는 새 대시보드가 `aux_level`을 받지 못해 12V 줄이 회색으로 보인다. 브라우저는 강력 새로고침(Ctrl+F5)이 필요하다. 버전 번호(`0.9.0-beta.1`)·pre-release는 그대로이며 발행하지 않았다.
- 재시작 후 확인(2026-10-28 13:45 KST, 읽기 전용 SSH): 설치된 `aux_battery.py`·`vehicle.py`의 `__pycache__`가 13:40:46/13:40:57에 생성돼 재시작한 HA가 새 모듈을 불러왔음을 확인했다. 설치된 `aux_battery.py`와 `archive_codec.py`를 실제 archive의 최근 상태 60건에 시작 때와 같은 방식(`seed` 후 `apply`)으로 돌린 결과 `aux_voltage=12.78`, `aux_level=ok`, `aux_level_reason=ok`, `aux_low_minutes=0`, `aux_age_s=64`였고 최근 12개 분 단위 샘플이 모두 ok였다.
- 미확인: 실행 중인 HA 프로세스가 실제로 내려주는 값(대시보드 API는 관리자 인증이 필요해 직접 호출하지 못함, 컨테이너 로그는 SSH 보호 모드로 읽지 못함), `async_setup_entry`의 복원이 실제로 실행됐는지, 저전압·경고 경로의 실차 동작(현재 12.8V로 정상). 사용자 화면에서 `배터리 ● 12.8V`의 초록 점과 마우스 올림 설명 `정상`으로 확인한다.

## 2026-10-28 — 개요 `외기 / 배터리 / 카메라` 줄 세로 정렬 보정 (좁은 화면)

- 증상: 폭 820px 미만에서 `데이터 지연`(또는 카메라 상태) 항목만 약 11px 아래로 처져 보이고, 주차 중 카메라 버튼도 `외기`·`배터리` 글자와 높이가 맞지 않았다.
- 원인: 세로 가운데 정렬(`align-items:center`)이 `@media (min-width:820px)` 안의 `.overview-col-visual .mini-condition`에만 있었다. 좁은 화면의 기본 `.mini-condition` 규칙에는 없어서, `.mini-condition-camera-disabled`의 `min-height:38px`로 늘어난 줄에서 글자가 위쪽에 붙고 `데이터 지연`만 안쪽 가운데 정렬로 낮게 놓였다. 12V 색상 작업과 무관한 기존 결함이다(장식 제거 후에도 동일).
- 변경: 한국어·영어 대시보드의 기본 `.mini-condition` 규칙에 `align-items:center`만 추가했다(`carrot-dashboard-ko.js`, `carrot-dashboard-en.js` 각 1줄). 디버그 대시보드는 두 클래스를 상속하므로 별도 수정이 없다. 12V 색상·라벨 변경은 포함하지 않는다(미승인).
- 영향 범위: 폭 820px 이상은 이미 같은 값이라 변화 없음. 좁은 화면의 줄 높이·줄바꿈은 바꾸지 않았다. 영어 390px 계열에서 항목이 많아 카메라 버튼이 다음 줄로 넘어가는 동작은 그대로 둔다(사용자 결정).
- 검증: 운영 CSS만으로(프리뷰 임시 보정 제거) 한국어·영어 × 주차·충전·주행·데이터 지연·통신 지연에서 항목 글자 세로 중심 편차 0px(보정 전 데이터 지연 11px). 필수 회귀 `dashboard-live-loading`, `dashboard-lazy-runtime`, `dashboard-view-state`, `dashboard-calculation-regressions` 통과.
- 배포 상태: 커밋 `f3f8e8e` main 푸시 확인. HA SSH 직접 반영(2026-10-28): 반영 전 `carrot-dashboard-ko.js`·`carrot-dashboard-en.js`를 `/homeassistant/carrot_ha/deployment-backups/f3f8e8e/before/`에 백업(`SHA256SUMS.before` 포함)하고, 두 파일의 설치본 SHA-256이 저장소 `f3f8e8e` 버전과 일치함을 확인했다(ko `cdb60b44…`, en `4bfc27bd…`). 반영 전 설치본은 직전 커밋 `4fa6a66`과 해시가 같아 드리프트가 없었다. 디버그 대시보드 파일은 바뀌지 않았다. 버전 번호(`0.9.0-beta.1`)·pre-release는 그대로이며 발행하지 않았다.
- 미확인: 사용자 브라우저/HA 앱에서의 실제 표시. 버전이 같아 캐시가 남아 있을 수 있으므로 강력 새로고침(Ctrl+F5, 모바일 앱은 캐시 삭제 후 재진입)이 필요하다. HA 재시작은 필요 없다. 실제 HA 폰 폭에서의 영어 줄바꿈 동작도 미확인.

## 2026-10-28 — 12V 배터리 전압 색상 표시: 기준 분석과 인터랙티브 프리뷰 (운영 미반영)

- 요청: 대시보드 개요의 `외기 / 12V` 줄에서 12V 전압을 AGM 배터리 상태로 한눈에 보이게 색을 입힌다. 주행 중은 색 없음, 주차 중만 색 표시. 임계값은 조정 가능.
- 조사(HA archive 읽기 전용, 상태 기록 2026-10-14~28, 20,868건): Comma가 꺼질 때의 마지막 값(약 11.8V)은 방전이 아니라 차량이 깨어나는 순간의 전압 강하였다. 급락한 같은 분에 `hv_voltage`가 처음 들어오고 `charge_mode`가 `hv_off`로 바뀌며, openpilot `power_monitoring.py`의 `VBATT_PAUSE_CHARGING = 11.8`(저역통과 전압 기준 종료)과 맞는다. 정차 중에도 약 65~70분 간격으로 1~4분짜리 11.7~11.9V 강하가 65건 반복됐고 가장 긴 것이 4분이었다.
- 주차 전압 실측: 주행·충전 후 15분 이내 중앙값 12.73V, 12~18시간 12.38V, 24~36시간 12.19V(하위 5% 12.11V). 정상 범위 최저 11.96V. 외기온(대부분 9~23°C) 영향은 분리되지 않아 보정하지 않았다.
- 프리뷰 기준안: 주차 중 12.2V 이상 정상 / 12.0~12.2V 주의 / 12.0V 미만이 10분 이상 지속되면 경고. 주행·충전은 색 없음. 측정이 10분 넘게 오래됐거나 데이터 지연·통신 지연, 주차 중 13.0V 이상(DC-DC 동작)은 회색. 표시 자릿수에 맞춰 0.1V 단위로 판정한다. 경고 지속 시간은 처음 5분으로 제안했다가 실측 강하 최대 4분의 여유가 얇아 10분으로 올렸다.
- 추가 파일: `preview/aux-voltage/{index.html, aux-voltage-status.mjs, replay.json}`, `.claude/launch.json`에 `aux-voltage-preview`(포트 8766) 추가. 운영 대시보드·통합 코드는 변경하지 않았다.
- 검증: 실제 디버그 대시보드 카드 위에서 상태 5종 × 전압·경과 9조합, 한국어/영어, 다크/라이트, 폭 390/768/1280 오버플로·줄바꿈·겹침 점검 통과. 실측 재생 5개 구간에서 경고는 한 번도 뜨지 않았고 종료 후 회색으로 전환. 판정 함수 경계값 Node 점검 통과.
- 한계·미확인: 2주·차 1대·정상 배터리 기록이라 불량 배터리의 전압은 알 수 없고 12.0V 경계는 AGM 일반 특성 기반이다. 경고의 "10분 지속" 판정은 분 단위 기록이 필요해 운영 적용 시 HA 쪽에서 저전압 지속 시간을 계산해 대시보드에 내려줘야 한다(프론트엔드는 최신 값만 가진다). 12.1~12.2V 경계에서 주의와 정상이 번갈아 바뀔 수 있어 완충 구간(히스테리시스)은 승인 후 결정한다.
- 프리뷰 수정(같은 날): 점을 넣으려고 값을 `inline-flex`로 바꿨던 것이 기준선과 간격을 어긋나게 해 점을 일반 인라인 요소로 교체했다. 값의 기준선이 이웃 항목(`외기`)과 일치함을 측정으로 확인했다. 요청에 따라 제목 `12V`를 `배터리`(영어 `Battery`)로 바꿨다. 점 간격은 라벨과 6px 더 띄우고 숫자와는 4px로 붙였다(요청). 운영 대시보드(ko/en/debug)의 라벨은 아직 그대로이며 승인 후 함께 바꾼다. 센서 이름 `12V 배터리 전압`은 변경하지 않았다.
- 프리뷰 수정(같은 날, 2차): `외기` 항목의 라벨-숫자 간격을 배터리의 라벨-점 간격(6px+공백)과 같게 맞췄다(점 크기만큼 더 벌리지 않음, 사용자 정정). 점이 없는 상태(주행·충전)에서도 점 자리를 유지해 상태 전환 때 레이아웃이 움직이지 않는다. 온도 보정(`tempCoef`, 기본 0=끔, 기준 20°C)을 선택 입력으로 추가하고 프리뷰에 외기 온도 슬라이더를 넣었다. 이 차 기록(주차 중 전압 8,985건, 10.5~24°C)에서 경과 시간을 통제하고 구한 온도 계수는 +0.008 V/°C(R² 0.586→0.611)로 부호·크기 모두 신뢰하기 어렵다(온도가 하루 단위로만 바뀌어 날짜 효과와 섞임, 외기온≠배터리 온도). 참고: 앞서 말한 -20 mV/°C는 충전 전압 보정 값이며 휴지 전압(OCV)의 온도 계수는 이보다 훨씬 작다. 겨울 기록이 쌓이기 전에는 보정을 켜지 않는다.
- 기존 결함 발견(프리뷰에서 보정, 운영 미반영): `외기 / 배터리 / 카메라(또는 데이터 지연)` 줄의 세로 가운데 정렬 `align-items:center`가 폭 820px 이상 미디어쿼리 안에만 있다(`carrot-dashboard-ko.js` 528행 `.overview-col-visual .mini-condition`, 디버그 파일 3983행 부근). 더 좁은 화면에서는 `.mini-condition-camera-disabled`의 `min-height:38px`가 줄 높이를 38px로 늘리고 나머지 항목 글자는 위쪽에 붙은 채 `데이터 지연`(안쪽 가운데 정렬)만 약 11px 아래로 처져 보였다. 12V 색상 작업과 무관하게 이미 있던 문제이며(장식을 제거해도 동일), 프리뷰의 `.mini-condition{align-items:center}`로 정렬 편차 0px을 확인했다(보정을 끄면 11px). 운영 반영 때는 같은 규칙을 미디어쿼리 밖 기본 규칙으로 옮긴다.
- 좁은 화면 영향: 라벨을 `12V`→`Battery`로 바꾸면 영어에서 줄이 약 19px 길어져, 프리뷰의 390px(카드 322px)에서는 카메라 버튼이 아래 줄로 넘어간다(원래는 1px 여유로 겨우 한 줄). 한국어는 한 줄에 들어간다. 430px(카드 362px)에서는 영어도 한 줄이다. 실제 HA 폰 화면 폭에서의 동작은 미확인.
- 배포 상태: 프리뷰 단계이며 커밋·버전 상승·릴리즈·HA 반영 없음. 사용자 승인 후 운영 파일에 반영한다.

## 2026-10-28 — 관찰용 엔터티: 보조 장치 소비 전력, 공조 전력 요청 (주행가능거리에는 미반영)

- 요청: 원시 CAN 분석(연구 저장소 `docs/aux-power-analysis-2026-10-28.md`)에서 `0x5AC HVEM_02`의 `HVEM_IstLeistungNA`가 모터 출력이 없는 구간의 배터리 전력과 일치했다. 장기 관찰을 위해 별도 엔터티로만 추가하고 주행가능거리 계산에는 넣지 않는다.
- Comma(`helico717/openpilot`, `carrot-wip-model_selector-ha`, 커밋 `a07274381`): 이미 파싱하던 `HVEM_02`에서 `hv_aux_power_w`(IstLeistungNA, 0~25,450 W)와 `climate_power_request_w`(Leistung_Klima_Vorgabe, 0~12,650 W)를 읽는다. 초기값·오류 코드(raw 510/511, 254/255)와 미수신은 값으로 쓰지 않고 0은 값으로 유지한다. 새 CAN 송신 없음. 관련 파일은 `openpilot/selfdrive/carrot/ha/telemetry_fields.py`, 테스트 `tests/test_hvem_observation.py`(3건).
- HA: `보조 장치 소비 전력 (관찰용)`, `공조 전력 요청 (관찰용)` 센서를 W 단위, 진단 범주로 추가했다. 다른 하드웨어 필드처럼 180초가 지나면 만료된다. 속성에 `observation_only`와 출처 신호, 의미 설명을 둔다. 두 값은 `range_km` 계산에 쓰이지 않으며 테스트로 확인한다.
- 의미: `보조 장치 소비 전력`은 보조 장치 부하 후보이며 공조 소비가 포함되는지는 미검증이다. `공조 전력 요청`은 요청값으로 공조를 껐을 때도 1 kW대가 나온 값이고 실제 소비나 공조 사용 지표가 아니다.
- 한계: 값은 수집기 샘플링 시점의 순간값이다(1분 평균 아님). 정밀 분석은 원시 CAN 기록을 계속 사용한다.
- 관련 파일: custom_components/carrot_ha/{telemetry.py,sensors_v3.py,entity_migration.py}, tests/test_new_sensors.py.
- 검증: Comma 쪽 ha 테스트 6개 파일 통과(신규 3건 포함), HA 쪽 test_new_sensors(신규 1건 포함), entity_migration, range_efficiency, trip_repair, trip_energy, history_cache, incremental_sync, optional_telemetry 104개 통과. 실제 차량에서 값이 들어오는지는 미확인.
- 배포 상태: Comma 커밋 `a07274381` 원격 브랜치 푸시 확인(사용자의 `git pull --ff-only` 후 재부팅 필요). HA는 커밋 `785133a` main 푸시 확인 후 직접 반영했고 `/homeassistant/carrot_ha/deployment-backups/785133a/before`에 백업했다. `sensors_v3.py`·`entity_migration.py`는 직전 커밋과 일치함을 확인한 뒤 커밋 파일로 교체했다(해시 f2c267e7…, f509608f…). **`telemetry.py`는 HA 설치본에 계기판 SOC 후보 변경(`b972426`)이 아직 없어서, 이 항목 변경과 무관한 그 작업이 함께 배포되지 않도록 설치본에 이번 센서 정의 두 줄만 더해 반영했다(해시 649a5e52…).** 따라서 설치된 `telemetry.py`는 저장소 파일과 해시가 다르며 차이는 `b972426`의 계기판 SOC 후보 부분뿐이다. 다음에 `b972426`을 배포할 때 저장소 파일로 교체하면 정리된다. HA 구문 검사는 `__pycache__` 권한 문제로 HA에서 실행하지 못했고 반영한 `telemetry.py`는 로컬 컴파일만 확인했다. **Python 변경이므로 HA 재시작 전에는 적용되지 않는다.** 재시작 후 엔터티 생성과 차량 값 수신은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 주행가능거리가 항상 수치를 갖도록: 최근 50 km를 시점 제한 없이 + 부족하면 있는 만큼 + 참고 전비 옵션

- 요청: 기록이 부족해도 주행가능거리를 "알 수 없음"으로 두지 말고 항상 수치를 표시. 코드에 숨겨진 고정 기본값에 의존하지 않는다.
- 변경(A): 최근 50 km 구간 계산(`_window_efficiency`)의 7일 제한을 제거했다. 상태 기록(보관 약 14일)을 먼저 보고 50 km가 안 되면 보관 기간과 무관하게 남는 주행별 거리·에너지 기록(`trip_energy`)에서 최신 주행부터 50 km까지 모은다(마지막 주행은 비례 반영). 둘 중 거리가 더 많은 쪽을 쓰며 센서 속성 `window_efficiency_source`(states/trips)에 표시한다. 장기 평균이 아니라 "마지막으로 달린 50 km"이다.
- 변경(B): 총 주행 기록이 50 km 미만이어도 있는 만큼으로 계산한다. 최소 조건은 1 km·0.3 kWh이고 전비는 1~10으로 제한한다.
- 변경(C): 이 차의 주행 기록이 전혀 없을 때만 통합 옵션 "참고 전비(km/kWh)"(`reference_efficiency_kpl`, 범위 1~10, 옵션 화면에 표시되는 기본값 5.0)를 쓴다. 코드 안의 숨은 상수를 `battery.py`의 옵션 기본값으로 옮기고 사용자가 설정 화면에서 바꿀 수 있게 했다. 이 경우 `efficiency_basis`는 `reference_efficiency`이다.
- 대시보드 배터리 카드는 `range_km`를 쓰며, 배터리 값이 아예 없을 때만 `—`로 표시한다(`SOC × 4.6` 대체식은 제거 유지).
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,battery.py,config_flow.py,sensors_v3.py,strings.json,translations/ko.json}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: Python 94개(range_efficiency, new_sensors, trip_repair, trip_energy, history_cache, incremental_sync) 통과. 전체 discover는 로컬에 `voluptuous`가 없어 기존 오류 10건(변경 전과 동일)이 있고 설정 화면 테스트(test_receiver_options)는 로컬에서 실행하지 못했다. `config_flow.py`는 컴파일만 확인했다.
- 한계: 주행 기록이 적을 때는 값이 크게 흔들릴 수 있다. 상태 기록 방식과 주행 기록 방식의 구간 선택은 거리가 더 많은 쪽 기준이다. 외기온 보정은 이번 범위가 아니다.
- 배포 상태: 커밋 `081df77` main 푸시 확인. HA 설치 파일 9개가 직전 커밋과 해시 일치함을 확인하고 `/homeassistant/carrot_ha/deployment-backups/081df77/before`에 백업한 뒤 직접 반영했다. 반영 후 해시가 로컬 파일과 모두 일치. 이 항목의 이전 항목(`c4a0841` 방식)은 HA에 반영된 적이 없다. **Python·설정 화면 변경이므로 HA 재시작 전에는 적용되지 않음.** 재시작 후 센서 값과 옵션 화면은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 주행가능거리 고정 대체값(5.0 km/kWh, SOC×4.6) 제거

- 요청: 기본 전비를 임의 숫자로 지정하는 방식이 부적절하므로 쓰지 않는다.
- 변경: 최근 50 km 주행 전비를 계산할 수 없으면 주행가능거리를 추정하지 않고 알 수 없음으로 둔다(`range_km` 없음, 센서 unknown). `DEFAULT_RANGE_EFFICIENCY`를 삭제했다. 한국어·영어 대시보드 배터리 카드는 값이 없을 때 `SOC × 4.6` 대신 `—`를 표시한다. 디버그 대시보드의 시뮬레이션 표기는 그대로 둔다.
- 영향: 최근 7일 안에 20 km 이상의 주행 기록이 없으면(예: 오래 주차, 설치 직후) 값이 비어 있다. 이 구간을 다른 방법으로 메울지는 미결정.
- 관련 파일: custom_components/carrot_ha/{vehicle.py,frontend/carrot-dashboard-ko.js,frontend/carrot-dashboard-en.js}, tests/test_new_sensors.py.
- 검증: Python 91개와 대시보드 JS 테스트(calculation-regressions 11, live-loading 6, lazy-runtime 1, view-state 3) 통과. 브라우저 실표시는 미확인.
- 배포 상태: HA에 반영하지 않았고, 사용자가 "알 수 없음은 절대 안 된다"고 하여 바로 위 항목의 방식으로 대체되었다(`range_km` 없음 방식은 폐기).

## 2026-10-28 — 주행가능거리에서 장기 평균 제거, 전비 하한 3 → 1 완화

- 요청: 장기 평균 전비로 주행가능거리를 계산하는 로직을 제거하고, 겨울철 전비가 3 미만일 수 있으므로 하한 3이 높다는 지적 반영.
- 변경: 주행가능거리는 최근 50 km 주행 전비(`recent_distance_window`)만 사용한다. 30일 가중 평균(`_range_efficiency` 삭제), 월 전비, 최근 20회 주행 평균 대체 경로를 제거했다. 50 km 구간 기록이 부족하면(20 km 미만) 기본 전비 5.0 km/kWh를 쓴다(`default_efficiency`). 센서의 `range_efficiency_*`·`recent_efficiency_*` 속성은 주행가능거리 센서에서 제거했다. 월·최근 전비 센서/대시보드 표시는 그대로다.
- 전비 클램프를 3~10에서 1~10 km/kWh로 바꿨다. 센서 오류 같은 이상치만 걸러내고 겨울철 실제 저전비(예: 2.5)는 그대로 반영한다. 신규 시즌이라 실제 겨울 전비 분포는 미확인이다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: test_range_efficiency(겨울 2.5 보존 신규), test_new_sensors(장기 평균 무시 신규), test_trip_repair, test_trip_energy, test_history_cache, test_incremental_sync 91개 통과.
- 배포 상태: 커밋 `7851220` main 푸시 확인. HA 설치 파일 3개가 직전 커밋과 일치함(vehicle.py는 주석 한 줄 차이)을 해시로 확인하고 `/homeassistant/carrot_ha/deployment-backups/7851220/before`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage 8f6087d3…, vehicle ac3853d1…, sensors_v3 28b5b424…). HA의 구문 검사는 hassio 계정의 `__pycache__` 쓰기 권한 오류로 실행되지 못했고 로컬 py_compile만 통과했다. **Python 변경이므로 HA 재시작 전에는 적용되지 않음.** 재시작 후 센서 값은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 주행가능거리 기본 전비 주석의 차종 고정 표현 제거

- 요청: `vehicle.py`의 기본 전비 상수 주석에 특정 차종·국가 기준이 고정 개념처럼 적혀 있어 제거.
- 변경: 주석을 "주행 기록이 전혀 없을 때의 최후 대체값"으로 바꿨다. 값(5.0 km/kWh)과 동작은 그대로다.
- 관련 파일: custom_components/carrot_ha/vehicle.py.
- 검증: `py_compile` 통과. 주석만 바뀌어 HA 직접 반영·릴리즈 없음.

## 2026-10-28 — 대시보드 배터리 카드가 주행가능거리 엔터티 값을 사용하도록 수정

- 증상: 대시보드 배터리 카드는 약 370km, `주행가능거리 (추정)` 엔터티는 344km로 서로 달랐다.
- 원인: 카드가 존재하지 않는 키 `v.estimated_range_km`만 읽어(백엔드는 `range_km`만 생성, `estimated_` 접두어는 엔터티 ID에만 붙음) 항상 대체식 `SOC × 4.6`으로 표시했다. 최근 주행가능거리 계산 개선이 카드에 반영되지 않았다.
- 변경: 한국어·영어·디버그 대시보드가 `v.range_km`, `v.estimated_range_km` 순으로 유효한 숫자를 사용하고, 둘 다 없을 때만 SOC 근사값을 쓴다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-dashboard-{ko,en,debug}.js, tests/dashboard-calculation-regressions.test.mjs.
- 검증: dashboard-calculation-regressions(신규 1건 포함 11), live-loading, lazy-runtime, view-state 통과. 브라우저 실표시는 미확인.
- 배포 상태: 커밋 `dce6204` main 푸시 확인. HA 설치 대시보드 3개가 직전 커밋 파일과 해시가 일치함을 확인하고 `/homeassistant/carrot_ha/deployment-backups/dce6204-frontend/before`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(ko a87931bb…, en 6954e4a7…, debug 5dd20d60…). 브라우저 강력 새로고침 후 실표시는 미확인. HA 재시작 불필요(프론트엔드만). 버전 상승·태그·릴리즈 없음.

## 2026-10-28 — 자동 충전·주유 기록에도 사진 업로드 허용

- 증상: 자동 충전 기록(origin=automatic) 수정 화면에서 사진을 골라 저장하면 "기록은 저장했지만 사진을 저장하지 못했어요" 오류. 운영 HA 브라우저에서 `POST …/attachments`가 400으로 실패하는 것을 직접 재현했고, 해당 기록은 `kind: expense`, `origin: automatic`이었다.
- 원인: `vehicle_journal/photos.py`의 `save_photo()`가 `origin='manual'` 기록에만 사진을 허용해 자동 기록은 `Manual record required`(ValueError)로 거부되었고, 업로드 뷰가 이를 400 `invalid_photo`로 변환했다. 기록 저장(`record/save`)은 자동 기록도 허용해 두 규칙이 어긋나 있었다.
- 변경: 대상 기록 조회를 `origin IN ('manual','automatic') AND status='active'`로 넓히고 오류 문구를 `Active record required`로 변경. 장수 제한은 기존 DB 트리거(`attachments_limit_insert`)가 origin과 무관하게 계속 적용한다.
- 관련 파일: `custom_components/carrot_ha/vehicle_journal/photos.py`.
- 검증·배포: `py_compile` 통과. 2026-10-28 `photos.py` 한 파일을 HA에 SSH 직접 반영했다(배포 커밋 `934205d`, 반영 전 HA 해시가 직전 배포 `ae7c424`와 일치 확인, 백업 `/config/carrot_ha/deployment-backups/934205d/photos.py`, 로컬·HA SHA-256 `112ac492…` 일치). 사용자 HA 재시작 후 사진 업로드 자체는 동작한다고 사용자가 보고했다. 운영 화면의 `POST …/attachments` 200 캡처는 미확인.

## 2026-10-27 — 주행가능거리를 최근 50km 주행 전비로 계산

- 요청/이유: 30일 동안 10km 이상 주행한 기록을 쓰면 반응이 느리다는 지적. 계기판은 오르막·주행 습관에 따라 주행가능거리가 바로 바뀐다.
- 변경: 상태 기록을 최신부터 거슬러 올라가며 주행거리계 기준 최근 50km의 배터리 에너지 감소량으로 전비를 계산한다(`window_efficiency_kpl`). 여러 주행에 걸쳐 합산하며 진행 중인 주행도 포함한다. 충전·오래된 상태 구간, 주행거리계/에너지 급변 구간, 주차 중 소모는 제외한다. 회생 제동은 부호를 유지한다. 3~10 km/kWh로 제한한다. 20km 미만이면 기존 30일 가중 평균, 월 전비 등의 순서로 대체한다. 조회는 (device, kind, observed DESC) 인덱스로 최대 7일·3,000행까지 500행 단위로 한다. 계산 기준 이름은 `recent_distance_window`이다.
- 실제 DB 재계산(읽기 전용): 계기판 100%·416km 시점(잔량 63.5 kWh)에 50km 전비는 6.71로 약 426km다. 30일 가중 평균은 396km, P25는 358km였다. 20km 구간은 6.15~7.55로 흔들림이 커 50km를 택했다. 2026-10-27 11:00 UTC(40.15 kWh)에는 6.54로 263km가 된다. 당시 계기판 값은 기록이 없어 비교할 수 없다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: test_range_efficiency(구간 경계·충전/주차 제외·최소 거리), test_new_sensors, test_trip_repair, test_trip_energy, test_history_cache, test_incremental_sync 95개 통과.
- 한계: 이력 동기화(약 60초) 때 갱신되며, 상태 기록 간격과 정수 km 주행거리계 해상도를 따른다. 공조 예측 등 계기판 내부 요소는 반영하지 않는다.
- 배포 상태: 커밋 `1e79ad1` main 푸시 확인. HA 설치 파일 3개가 직전 반영본 `c38e411`과 해시가 일치함을 확인하고 `/config/carrot_ha/deployment-backups/1e79ad1/`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage.py 5ebbd173…, vehicle.py a09da23e…, sensors_v3.py e53cf8b9…)하고 구문 검사도 통과했다. HA 재시작과 재시작 후 센서 값·실주행 반응은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-27 — 주행가능거리 계산을 최근 가중 평균 전비로 재조정

- 요청/이유: 보수 전비(P25) 적용 후 너무 낮게 나온다는 보고. 차량이 100%일 때 계기판은 416km였지만 HA는 361km였다. 같은 시각 HA 기록 기준 잔량은 63.5 kWh이고(계기판 100% ≈ CAN 에너지 64 kWh), 계기판은 약 6.5 km/kWh를 적용하고 있었다. P25 5.63은 이보다 약 14% 낮았다.
- 운영 DB 읽기 전용 비교(63.5 kWh 기준): P25 5.63 → 358km. 최근 가중 평균(10km 이상, 30일): 반감기 3일 6.29 → 399km, 7일 6.23 → 396km, 14일 6.17 → 392km. 거리 기준 최근 150/300/500km 평균은 6.24/6.14/6.30.
- 변경: 하위 25% 대신 10km 이상 주행의 에너지 가중 평균(총 km ÷ 총 kWh)을 사용한다. 7일 반감기로 최근 주행 습관에 빠르게 맞춘다. 30일 기간, 단거리 제외, 최소 3회·50km 조건과 대체 순서는 유지한다. 계산 기준 이름은 `weighted_recent_trips`이다.
- 한계: 계기판 추정치는 충전·공조·배터리 온도에 따라 즉시 바뀐다. 같은 주행 기록으로 저녁(약 62% 표시)에는 차량 값이 더 낮았다는 보고가 있어 모든 시점에 일치시킬 수는 없다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/{test_range_efficiency.py,test_new_sensors.py}.
- 검증: test_range_efficiency, test_new_sensors, test_trip_repair, test_trip_energy, test_history_cache, test_incremental_sync 92개 통과.
- 배포 상태: 커밋 `c38e411` main 푸시 확인. HA 설치 파일 3개가 직전 반영본 `cc7b3ba`과 해시가 일치함을 확인하고 `/config/carrot_ha/deployment-backups/c38e411/`에 백업한 뒤 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage.py b5dfa14b…, vehicle.py 5dfd97bd…, sensors_v3.py 13fb94c5…)하고 구문 검사도 통과했다. HA 재시작과 재시작 후 센서 값은 미확인. 버전 상승·태그·릴리즈 없음.

## 2026-10-27 — 차계부 SOC 기준 64 실차 검증

- 오늘 급속 100% 충전에서 계기판 SOC 후보(`0x14A`)가 100%일 때 잔량이 64,200Wh(÷64 = 100.3%)였다. 50~100% 구간에서 64 기준과의 차이는 0.8%p 이내였다.
- HA 재시작 뒤 차계부 `100km당 배터리 소모`는 9월 25.9%, 10월 25.7%로 재계산됐다. 자세한 내용은 `vehicle-journal/CHANGELOG.md`에 있다. 코드 변경·릴리즈 없음.

## 2026-10-27 — 차계부 주행 SOC 기준 통일과 100km당 배터리 소모 수정

- 차계부 주행 SOC를 대시보드 주행 탭과 같은 Wh ÷ 설정 용량(`soc_capacity_kwh`, 64)으로 계산한다. 10월 3일부터 Comma 경계 측정값의 SOC가 비어 차계부 SOC가 대부분 사라졌던 문제와 78kWh 기준 혼용을 해결했다. 공용 `trip_repair.py`와 대시보드 경로는 변경하지 않았다.
- `100km당 배터리 소모`는 SOC가 측정된 거리만 분모로 쓰고, % 지표의 증감은 `%p`로 표시한다.
- 자세한 원인·64 검증·테스트는 `vehicle-journal/CHANGELOG.md`에 있다. HA 직접 반영, 사용자 HA 재시작 필요. 버전·태그·릴리즈 없음.

## 2026-10-27 — 차계부 충전 위치 실패 사유 표시 구현

- 승인된 미리보기대로 자동 충전 위치 조회의 사유 코드·단계·근거 값 저장(조회 버전 5), 상세 기록 조회 API의 `location_diagnostic`, 상세 기록 행의 작은 사유 표시와 진단 패널을 구현했다. 자세한 내용은 `vehicle-journal/CHANGELOG.md`에 있다.
- 배포는 HA 직접 반영으로 한다. Python 변경이라 사용자의 HA 재시작이 필요하다. 버전·태그·릴리즈 없음.

## 2026-10-27 — 계기판 SOC 후보(0x14A) 비교 전용 수집

- 요청/이유: 대시보드 SOC는 잔량 Wh ÷ 사용자 설정 64kWh 비례식이라 하단 버퍼 같은 오프셋을 반영하지 못하고, Comma `soc_percent`(Wh/780)와 기준도 다르다. 장기적으로 계기판 표시 SOC를 직접 읽기 위해 연구 저장소에서 찾은 후보(bus1 `0x14A` 32byte byte19 × 0.5%, 주행 r≈0.99991, 일부 시점 ±1%p 차이)를 별도 필드로 수집하고 실차 대조를 준비한다.
- Comma(openpilot `carrot-wip-model_selector-ha` `d718061f`): `display_soc_candidate_percent`를 CAN 수신 시각(`field_measured_at`)과 함께 텔레메트리에 추가하고, 주행 경계 `tripMeasurements` start/end에 값과 `display_soc_candidate_measured_at`(180초 초과 시 미확인)을 넣었다. bus1 32byte만 사용하며 raw 201 이상(초기화 254/255 포함)은 값을 지운다. 기존 `soc_percent`·`battery_wh`·에너지 완전성 판정은 변경하지 않았다.
- 수신 앱 0.1.4: `trip_measurements` 출력에 후보 필드를 보존한다. 수집기가 보낸 경우에만 추가하므로 이전 주행의 API 출력과 HA 주행 fingerprint는 그대로다. 후보만으로는 측정 경계를 만들지 않는다.
- HA: 진단 센서 `계기판 SOC 후보`(180초 신선도, 속성 can_id 0x14A·검증 대기·`used_for_dashboard_soc=false`)를 추가했다. 주행 원본의 `trip_measurements`는 그대로 보관된다. 대시보드·차계부의 SOC 계산과 우선순위는 변경하지 않았다.
- 관련 파일: addons/carrot_receiver/{receiver.py,config.yaml,CHANGELOG.md}, custom_components/carrot_ha/{telemetry.py,sensors_v3.py}, tests/test_display_soc_candidate.py. 실차 대조 양식: meb-can-research `docs/field-tests/display-soc-validation-2026-10-27.md`(`04e6f36`).
- 검증: openpilot 신규 5개 통과, ha/tests 전체 81개 중 기존 실패 4개(camera_probe·camera_upgrade 모듈 로드, driving_logs, sync_workflows)는 변경 전과 동일. carrot-ha 신규 4개와 test_direct_receiver·test_new_sensors 35개, 회귀 게이트(test_cloud_live·test_incremental_sync·test_history_cache)와 trip/energy 관련 158개 통과. test_archive_compression(Windows 파일 잠금)·test_driving_logs_ai/v2 실패는 변경 파일과 무관하다.
- 배포 상태: main 커밋·푸시. HA 직접 반영·버전 상승·태그·릴리즈 발행 없음(발행은 별도 승인 필요). 수신 앱 0.1.4는 사용자가 HAOS에서 업데이트, Comma는 사용자가 `git pull --ff-only` 후 재부팅.
- 미확인: 실차 수신(Comma 업데이트 후 0x14A 값 도착), 계기판 사진 대조. 대조 전에는 표시 SOC를 기본값으로 쓰지 않는다.

## 2026-10-27 — 차계부 충전 위치 실패 사유 표시 설계·미리보기 (승인 대기)

- 위치를 기록하지 못한 충전비 기록에 실패 단계·사유·근거 값을 보여 주는 설계와 승인용 미리보기 `vehicle-journal/review-location-diagnostics.html`을 추가했다. 상세 내용은 `vehicle-journal/CHANGELOG.md`에 있다.
- 프로덕션 코드 변경·HA 반영·릴리즈 없음. `.claude/launch.json`에 미리보기 서버 설정 `journal-review`를 추가했다.

## 2026-10-27 — 주행가능거리 보수적 전비 적용

- 요청/이유: 주행가능거리가 계기판보다 40~50km 낙관적이라는 보고. 운영 DB를 읽기 전용으로 조회한 결과, 계산은 최근 20회 주행의 평균 전비 6.22 km/kWh × 잔량 40.15 kWh = 250km였다. 2주 주행거리계 기준 실적(6.5 km/kWh)과 일치해 계산 오류는 아니었지만, 평균 전비가 계기판의 보수적 추정보다 약 18% 높았다. 10km 미만 단거리는 0.05 kWh 측정 단위 때문에 전비가 과대(10월 평균 6.86)했다.
- 변경: 최근 30일, 10km 이상 주행의 전비를 거리 × 반감기 14일 가중치로 정렬해 하위 25% 값을 `range_efficiency_kpl`로 계산한다. 3회·50km 이상일 때만 사용하며, 주행가능거리 계산에서 가장 먼저 적용한다(`range_efficiency_basis=conservative_recent_trips`). 자료가 부족하면 기존 월 전비·최근 평균·기본값 순서를 그대로 따른다. `recent_efficiency_kpl`와 월 전비 센서는 변경하지 않았다. 센서 속성에 보수 전비·주행 수·거리·방법을 추가했다.
- 관련 파일: custom_components/carrot_ha/{storage.py,vehicle.py,sensors_v3.py}, tests/test_range_efficiency.py, tests/test_new_sensors.py.
- 검증: 운영 DB 읽기 전용 재계산 결과 28회, 1,565km, P25 5.63 km/kWh. SOC 51.5%에서 250→226km, 100% 485→439km, 15% 73→66km. 신규 테스트 3개 및 test_new_sensors·test_trip_repair·test_trip_energy 86개 통과. 회귀 게이트 test_cloud_live 1건(Windows cp949 인코딩)과 test_direct_receiver(aiohttp 미설치)는 변경 전에도 동일하게 실패하는 로컬 환경 문제다.
- 배포 상태: 커밋 `cc7b3ba` main 푸시 확인. HA 설치 파일 3개가 직전 커밋 `869debc`과 SHA-256 일치함을 확인한 뒤 `/config/carrot_ha/deployment-backups/cc7b3ba/`에 백업하고 직접 반영했다. 반영 후 해시가 커밋 파일과 일치(storage.py 8d0d992e…, vehicle.py a1e3921b…, sensors_v3.py cdbc8147…)하고 구문 검사도 통과했다.
- 미확인: HA 재시작은 사용자가 수행하며 재시작 전까지는 이전 계산이 동작한다. 재시작 후 센서 값과 계기판 값의 차이는 미확인. 버전 상승·태그·릴리즈 발행 없음.

## 2026-10-27 — 승인된 HA 기본 재질을 기존 vehicle.glb에 저장

- 사용자 승인: 프리뷰 후보 그대로 적용하고 기존 파일명을 유지해 커밋·푸시하도록 명시했다.
- 변경/이유: 차체 색상 #333234, 유리 틴팅, 도장·반사판 재질을 기존 frontend/carrot-assets/models/vehicle.glb에 저장했다. 별도 모델 파일명·새 URL 없이 기존 파일을 교체한다. 재현 도구와 문서도 포함한다.
- 관련 파일: custom_components/carrot_ha/frontend/carrot-assets/models/vehicle.glb, tools/vehicle3d/model/bake_ha_materials.py, docs/VEHICLE_3D_MODEL.md.
- 검증: 프리뷰 승인 모델과 교체 파일 일치. 원본 대비 바이너리 청크·형상·텍스처·애니메이션 보존 및 재질 저장 도구의 멱등성 확인. vehicle-3d-integration 25개와 git diff --check 통과.
- 배포 상태: main 커밋·푸시로 반영한다. HA 직접 배포·재시작·버전 상승·태그·릴리즈 발행은 하지 않는다. 외부 뷰어의 조명·톤 매핑·환경 반사는 각 뷰어 설정을 따른다.

## 2026-10-27 — HA 기본 재질을 GLB에 저장하는 후보 제작 (프리뷰 승인 대기)

- 요청/이유: 일반 GLB 뷰어에서도 HA의 기본 차체 색상·유리 틴팅·도장 재질을 사용하도록 모델 재질 저장을 요청했다.
- 변경: tools/vehicle3d/model/bake_ha_materials.py를 추가해 GLB JSON의 차체·반사판·유리 2종만 변경한다. Three.js의 sRGB→linear 변환을 적용한다. 프리뷰 후보는 .preview/vehicle-materials/after.glb(2,023,352바이트)이며 배포 모델은 아직 교체하지 않았다.
- 검증: GLB의 바이너리 청크·형상·내장 텍스처·노드·문 애니메이션이 원본과 동일하고 재실행 결과도 동일함을 확인했다. 실제 전체 대시보드 모듈과 mockHass를 사용한 로컬 HTML에서 기존/후보 모델 및 흰색 옵션의 3D 뷰어 생성·렌더링을 확인했다. 네트워크 제약으로 브라우저 테스트는 로컬 파일을 route로 직접 제공했다.
- 관련 파일: tools/vehicle3d/model/bake_ha_materials.py, .preview/vehicle-materials-preview.html 및 .preview/vehicle-materials/ (프리뷰는 Git 제외).
- 상태: AGENTS.md의 UI 사전 프리뷰 승인 절차에 따라 사용자 검토 대기. 프로덕션 GLB 교체·커밋·푸시·HA 반영·릴리즈 없음. 조명·환경 반사 강도·톤 매핑은 뷰어 설정으로 남는다.

## 2026-10-27 — 전체 문서 연결 방식 재점검 및 잔존 표현 보완

- 내용/이유: 앞선 49a5536 이후 전체 추적 문서를 다시 검색했다. 현행 엔티티/차계부 요구사항·지침/검증 계획/README의 잔존 cloud·D1/KV·Worker 설명을 수신기 기준으로 보완하고 과거 파라미터 안내의 문서 전체를 역사 기록으로 명시했다.
- 관련 파일/근거: docs/connection-document-audit-2026-10-27.md에 전체 파일 목록·검색 범위·잔존 이유를 기록했다. 독립 HTML 프리뷰에 남은 합성 Cloudflare 문구 1곳은 현행 연결 안내가 아니며 UI 수정 범위에서 제외했다.
- 검증/한계: 문서 검색·상대 링크·diff 검사. 과거 사건·라이선스·changelog 및 호환 식별자는 보존. 운영 연결 검증·실행 코드 변경·배포·재시작·릴리즈 없음. 문서 전용 커밋·main 푸시로 반영한다.

## 2026-10-27 — 기본 3D 차량 모델 저장소 포함

- 변경/이유: 사용자가 본인 모델임을 확인하고 다른 사용자와 공유하도록 요청했다. 모델 재배포 금지 문구와 모든 GLB 파일의 일괄 제외를 철회하고, HA에서 받은 완성 모델을 통합의 frontend/carrot-assets/models/vehicle.glb에 포함했다. 이전 개인 사용 확인·외부 출처 기록은 당시 에이전트 기록이며 이번 사용자 지시로 공유 정책을 정정한다.
- 동작: 기본 모델은 프론트엔드와 함께 설치되고 버전이 붙은 패키지 주소로 로딩된다. vehicle_3d_model 사용자 지정 주소와 기존 HA 모델 경로는 유지한다. 모델 형상·텍스처·화면 디자인은 변경하지 않았다.
- 관련 파일: .gitignore, custom_components/carrot_ha/{__init__.py,frontend/carrot-vehicle-3d.js,frontend/carrot-assets/models/vehicle.glb}, docs/{VEHICLE_3D_MODEL.md,DEBUG_DASHBOARD.md}, tools/vehicle3d/model/build_model.mjs, tests/vehicle-3d-integration.test.mjs.
- 모델 확인: 운영 HA HTTPS에서 수신한 GLB v2, 2,023,208바이트. WebP 이미지 36개가 내장되어 외부 텍스처 파일이 필요 없다. 빌드 중간 파일 폴더만 Git에서 제외한다.
- 검증: vehicle-3d-integration 테스트 25개 및 git diff --check 통과. 모델 SHA-256: 1f3c5488f32fbbeabf5b4e984a80b055d75eac34ab7bd6fb3e53411ec909e997.
- 배포 상태: main 커밋·푸시 대상으로 준비. HA 직접 반영·재시작·새 태그·릴리즈 발행은 이번 요청 범위에 포함하지 않는다. 운영 HA의 새 패키지 경로 로딩은 미검증이다.

## 2026-10-27 — Cloudflare 과거 중계 설명과 현재 직접 연결 문서 분리

- 변경/이유: 조사에서 멈추지 않고 현행 안내를 수정하라는 사용자 요청에 따라 AGENTS의 과거 구조도·Wrangler 실행 절차·D1/KV 무료 한도 규칙을 현재 수신기 구조로 교체했다. GUIDE의 클라우드 경로/60초 화면 조회 설명, entities의 저장 경로·cloud_status 설명, 모듈형 설계의 수집 계층과 부하 원칙을 수정했다.
- 관련 파일: AGENTS.md, docs/CURRENT_CONNECTION_ARCHITECTURE.md, docs/{GUIDE.md,entities.md,modular-ev-dashboard-architecture.md,DEVELOPMENT_WORKFLOW.md,CLEAN_INSTALL_RECOVERY.md,TERMINAL_SETUP.md,CAMERA_SETUP.md,COMMA_PARAM_SETUP.md,driving-logs-setup.md,cloudflare-retirement-audit-2026-10-14.md}.
- 내용: 독립 수신 앱 경로와 HA Core 직접 경로, 외부/내부 URL, 키 구분, 60초 이력·15초 최신 조회, HA Core 재시작 영향, 과거 호환 분기와 자동 fallback 부재를 명시했다. 과거 릴리즈·changelog·archive·라이선스와 원본 서버 소스는 보존했다.
- 검증: 코드 근거 대조 및 12개 문서의 상대 링크와 폐기 명령 잔존 검사 및 git diff --check 통과. 실행 코드 변경이 없어 런타임 테스트·배포·버전 상승·재시작은 해당하지 않는다. 운영 프록시/차량 상태 및 차량 최신 소스는 미검증이다.
- 배포 상태: 문서 전용 커밋·main 푸시 대상으로 준비했다. 다른 작업 파일은 제외했다. 최초 FETCH_HEAD 권한 오류 후 승인된 git fetch가 성공했고 원격 main과 HEAD가 일치함을 확인했다. 실행 배포·버전·태그·릴리즈·재시작 없음.


## 2026-10-27 — 절약 비교 화면 HA 직접 반영 완료

- 배포 커밋: `34d6e3c` (main 푸시 확인). 기존 설치 파일 2개가 직전 Git 버전과 일치함을 확인한 뒤 `/config/carrot_ha/deployment-backups/34d6e3c/`에 각각 백업하고 화면 코드·디자인 파일 반영.
- 검증: HA 설치 파일과 HTTP 200 응답 모두 로컬 커밋 파일 SHA-256 일치. `carrot-vehicle-journal.js`: `1b39622b3e5ce660e1931add47b1974e74a6c46d7b0b26fd1db18473b066c23a`, `carrot-journal-design.js`: `4585bdfc61843588d52ffb1ecf0dd7373b4eaa63328696cc479fdf3dd09ed58a`.
- 상태: 운영 파일·HTTP 제공 확인 완료. 사용자 로그인 HA 브라우저의 최상위 로더 URL·실제 화면 적용은 미확인, 차계부 화면 새로고침 필요. Python/고정 로더 변경 없으며 HA 재시작 실행하지 않음. 버전·태그·릴리즈 발행 없음. Comma·수신기·과거 Cloudflare 코드 변경 없음.
- 검증 한계: 기존 browser-check.cjs의 초기 42km 화면 대기 실패는 변경 전 코드에서도 동일. 이번 승인 UI의 실제 Chrome 합성 데이터 조작 검증은 통과(직전 항목 참조).

## 2026-10-27 — 승인한 절약 비교 화면 운영 반영 준비

- 사용자 승인: “일단 이대로HA에 반영하자”. 앞선 로컬 프리뷰 변경을 운영 구현으로 이관.
- 변경: 거리 버튼(기록된 거리·1,000·5,000·10,000·100,000km·직접 입력), 입력 중 쉼표, 중앙 비교 설명/금액, 간결한 유류비 안내, 슬라이더 min/max, 숫자·유종·원화 금액 틸 강조. 제목 괄호 없음. 차량/기간 전환 시 직접 입력 선택 상태 초기화.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `carrot-journal-design.js`, `vehicle-journal/review-savings-wording.html`.
- 검증·배포: 운영 모듈을 직접 불러온 Chrome에서 거리 버튼 4개·직접 입력·쉼표·기록 거리 복귀·3종 유종 전환·안내 문구·강조·min/max·390px 모바일 통과. JS 구문·diff 검사 통과. 기존 browser-check.cjs는 첫 #headline(42km) 대기 시간 초과이며 수정 전 HEAD에서도 동일하게 실패함을 확인. HA 기존 파일 2개가 직전 Git 버전 SHA-256과 일치. HA 백업·직접 반영 예정, 릴리즈 없음.

## 2026-10-27 — 유종 이름·원화 금액만 강조하는 프리뷰

- 사용자 요청: “휘발유 유가 13원/L”에서 “휘발유”, “13원”만 틸 색상·글꼴 확대. “유가”와 “/L”은 기본 표시 유지. 거리·연비의 숫자 강조는 유지한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: 프리뷰 수정. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 선택값 강조를 숫자로 한정·확대하는 프리뷰

- 사용자 정정: 선택값 전체가 아닌 숫자만 틸 색상 및 글자 크기 확대. 거리·유가·연비 숫자는 기존 크기의 1.22배로 표시하고 유종·단위는 기본 색상·크기 유지. 천 단위 쉼표는 숫자와 함께 유지한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: Chrome에서 숫자만 틸 색상·1.22배 확대, 유종/단위 기본 색상·크기 및 100,000 쉼표 유지 확인. 390px 모바일 가로 넘침 없음. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 절약 비교 유류비 범위 안내 문구 프리뷰

- 사용자 요청: 주유 지출 추정·기간 차이 안내를 유류비만 비교하며 전체 유지비는 포함하지 않는다는 간결한 한 문장으로 변경.
- 문구: “유류비만 비교한 금액이며, 전체 차량 유지비는 포함하지 않아요.”
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: 프리뷰에서 기존 비용 막대 상단 안내 문구만 대체. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 절약 비교 현재 선택값 틸 강조 프리뷰

- 사용자 요청: 주행거리·비교 유종/유가·비교 차량 연비에서 현재 선택값을 차계부 틸 색상으로 강조.
- 변경: `distanceValue`, `priceValue`, `economyValue` 및 직접 거리 입력에 `--j-accent`와 굵은 글꼴 적용. min/max는 기존 흐린 표시 유지. 숫자 천 단위 쉼표 유지.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증·배포: Chrome에서 선택값 3곳의 색상 rgb(129, 230, 197), 100,000km 쉼표, min/max opacity 0.6 확인. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 유가·연비 슬라이더 최솟값·최댓값 프리뷰

- 사용자 요청: 슬라이더 위 양 끝에 실제 min/max를 흐리게 표시. 유가는 원/L, 연비는 km/L 단위와 천 단위 쉼표 사용. 유가 범위가 동적으로 증가하면 끝값도 동기화한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`.
- 검증: 앞선 거리 버튼 4개·직접 입력 123,456.7km·기록된 거리 복귀·유종 전환 통과. 설명 20px, 결과 중앙 정렬 오프셋 0px, 390px 화면 가로 넘침 없음, Chrome 실행 오류 없음. min/max·단위 표시 및 동적 최댓값 7,500원/L 갱신 통과. 390px 모바일 가로 넘침 없음.
- 배포: 로컬 프리뷰만 변경. 운영 소스·HA 미반영, 승인 대기.

## 2026-10-27 — 절약 비교 거리 버튼·중앙 결과 프리뷰 갱신

- 사용자 요청: 거리 슬라이더 대신 기록된 거리·1,000km·5,000km·10,000km·100,000km·직접 입력 버튼. 제목의 “(유류비만)” 제거. 비교 설명 축소 후 금액 바로 위에 묶어 제목과 비용 막대 사이 중앙에 배치.
- 제안 문구: “연비 15km/L인 휘발유 차량으로 달렸다면”. 유종·연비에 따라 갱신하며 “차량보다”와 “더 들어요” 사이의 비교 방향 혼동을 피한다.
- 관련 파일: `vehicle-journal/review-savings-wording.html`. 숫자 표시는 거리·직접 입력·금액 모두 천 단위 쉼표를 유지한다.
- 검증·배포: 로컬 프리뷰 검증 중. 운영 소스·HA 변경 없음, 사용자 프리뷰 승인 대기.

## 2026-10-27 — 절약 비교 제목·비교 조건 문구 프리뷰

- 사용자 요청: 제목 옆 “(유류비만)”, 금액 윗줄에 선택한 유종·연비의 차량을 “~보다”로 설명. 제목과 같은 글자 크기 사용.
- 관련 파일: `vehicle-journal/review-savings-wording.html`. 실제 차계부 전체 모듈과 합성 전기차·내연기관 데이터로 검토하며 운영 소스는 변경하지 않았다.
- 검증·배포: 실제 Chrome에서 제목·설명 25px 일치, 휘발유 15km/L→경유 18km/L 설명 갱신 및 실행 오류 없음 확인. 인터랙티브 프리뷰 준비 완료. 사용자 승인 후 운영 수정·검증·커밋·HA 반영 예정. 릴리즈 없음.

## 2026-10-27 — 절약 비교 문구의 비교 방향 수정

- 커밋 제목: `vehicle-journal: correct comparison cost wording`.
- 변경·이유: “같은 거리를 다른 차로 달렸다면요.”에 맞춰 비교 차량 비용이 더 높으면 “더 들어요”, 낮으면 “덜 들어요”로 표시한다. 내연기관·전기차 두 경로의 문구만 교정하며 금액 계산·디자인은 유지한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`.
- 검증: 실제 renderSavings 함수를 합성 데이터로 실행해 내연기관·전기차 각각 양수(10,000원 더 들어요)·음수(5,000원 덜 들어요) 4건 통과. JavaScript 구문 및 git diff --check 통과.
- 배포: `1298fd7` main 푸시 및 HA 직접 반영 완료. 반영 전 HA 파일과 직전 Git 파일 해시 일치 확인, `/config/carrot_ha/deployment-backups/1298fd7/`에 백업. 반영 후 로컬·HA SHA-256 `c0ebfd2d95606da9f6672a9d71196109f0c045e4b84686f8df206eef0b9eecea` 일치. 운영 브라우저 적용은 미확인(화면 새로고침 필요). Python 변경 없음. 버전·태그·릴리즈 발행 없음.

## 2026-10-26 — 3D 차량: 주행 중 속도 0이면 정지 표시, 140 km/h 효과 상한 (HA 반영)

- 사용자 질문: 주행 중 속도가 0인데 왜 차량이 굴러가는가.
- 원인: 뷰어가 `Math.max(8, state.speedKph || 40)`으로 도로·바퀴 속도를 계산했다. JavaScript에서 0은 거짓이라 0 km/h가 40 km/h로 바뀌고, 최소 8 km/h도 강제됐다. 또 래퍼가 속도 값이 없을 때도 0을 넘겨 "정지"와 "모름"을 구분하지 못했다.
- 변경(뷰어): 주행 중 실제 속도(0 포함)를 그대로 쓰고 값이 없을 때만 40 km/h로 표시. 표시 속도는 15초 주기 갱신에 튀지 않도록 부드럽게 따라가며(시정수 약 0.4초), 0이면 바퀴·차선·차체 흔들림이 멈춘다(흔들림은 20 km/h까지 속도에 비례). 정지 중에는 렌더 루프도 쉰다(기존에는 주행 중이면 항상 매 프레임). 정지 상태에서도 차선 점선이 도로를 따라 배치되도록 위치 계산을 이동 여부와 분리(처음엔 모두 z=0에 겹쳐 하나만 보였음).
- 변경(래퍼 `carrot-vehicle-3d.js`): `speed_kph`가 숫자가 아니면 `speedKph: null`(모름).
- 관련 파일: `tools/vehicle3d/viewer.src.js`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-assets/vehicle-3d.js}`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: 3D 통합·디버그 테스트 31/31 통과(신규 1건, 기존 "알 수 없는 값" 테스트의 속도 기대값을 0→null로 갱신). 전체 JS 테스트 실패 6건은 기존과 동일. 로컬 프리뷰에서 주행·0 km/h는 주행 시점으로 전환 후 애니메이션이 멈춤(`settled: true`), 차선 점선이 정상 배치, 62 km/h는 계속 이동 확인. 실차 정차 화면은 미확인.
- 추가(사용자 질문 "140이 넘으면 MAX 140 속도 효과를 유지하는가"): 이전에는 유지하지 않았다. 140은 디버그 속도 슬라이더의 최대값일 뿐 뷰어에 상한이 없어 더 빠르게 움직였다. 뷰어에 `MAX_EFFECT_KPH = 140` 상한을 두어 140 km/h 초과는 140 km/h 효과로 표시한다. 디버그: 검사용 읽기 전용 `rollKph`(표시 속도) 추가, 속도 슬라이더 최대 140→200, 시나리오 `주행 180 km/h (효과 140 상한)` 추가(37→38개), 주행 0/60/120/180 시나리오가 표시 속도(0 / 각 속도 ±3% / 140)를 검사. 프리뷰 디버그 카드에서 네 시나리오 통과(표시 0·59·119·140 km/h). JS 테스트 106 통과/6 실패(기존과 동일).
- 배포 상태: `abee103`을 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 3개(`carrot-vehicle-3d.js`, `carrot-debug-3d.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-speed-abee103/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일과 HTTP 응답(200) SHA-256이 커밋과 일치(`carrot-vehicle-3d.js` `a93195d1…`, `carrot-debug-3d.js` `f490653c…`, `vehicle-3d.js` `7a99583e…`). Python 변경 없음(HA 재시작 불필요), 브라우저 강력 새로고침 필요. 실차 정차·고속 화면 미확인. 버전·태그·릴리즈 없음.

## 2026-10-26 — 외부 API 응답 부분 읽기 수정(차계부 충전소 자동 위치·주행 로그 AI)

- 원인: aiohttp `response.content.read(n)`은 첫 네트워크 조각만 반환할 수 있어 카카오 충전소 검색 JSON이 잘렸다. 2026-10-26 충전 기록의 위치가 자동 지정되지 않고 24시간 재시도 대기가 됐다.
- 변경: 응답을 EOF까지 읽는 `read_limited` 도입(`http_body.py`, 주행 로그 `ai.py`), 일시 실패는 15분부터 최대 24시간 백오프, 조회 버전 4로 대기 중 기록 재조회. 상세: `vehicle-journal/CHANGELOG.md`, `driving-logs/CHANGELOG.md`.
- 추가: 충전소 이름을 못 정하는 모든 경우(제공사 오류·결과 과다·결과 없음 포함)에 도로명 주소를 먼저 저장하고, 오류로 저장한 주소는 재조회 성공 시 충전소로 교체한다. 결과가 45건을 넘는 지역에서도 거리상 안전하면 단독 근접 충전소를 자동 선택한다.
- 배포 상태: `2730a92` HA 직접 반영·해시 확인 완료(백업 `/config/carrot_ha/deployment-backups/2730a920f993e7fc4e37dbabf8c4a0ba437b3044/`). 후속 `cfd291f`도 HA 직접 반영·해시 확인 완료(백업 `/config/carrot_ha/deployment-backups/cfd291fc8e2739429adc3ec5e19ebe4b8a7d63d5/`). 사용자 HA 재시작 필요. 버전·태그·릴리즈 없음. 상세: `vehicle-journal/CHANGELOG.md`.

## 2026-10-26 — 디버그 대시보드: 오픈파일럿 시나리오, 테스트 완료 패널 제거, 데스크톱 좌우 배치·기능 선택 (HA 반영)

- 사용자 요청: 디버그 대시보드에 OP 작동 유무 시나리오가 없다. 충전 시간 계산 모델·스무딩(BMS 전력 변동) 패널과 360° 카메라 모니터링(실기기·모의) 패널은 테스트가 끝났으니 제거. 상태를 바꾸고 위로 스크롤해 확인하는 것이 번거로우니 데스크톱에서만 좌우 배치. 이어서 "여전히 스크롤해서 조작해야 한다 → 카드·버튼 컴팩트화와 드롭다운으로 기능만 골라 표시", "지금처럼 유지하되 대시보드는 고정, 디버그 패널만 스크롤", "이상하게 나오는 버튼은 알아서 찾아서 해결".
- 변경(3D 시뮬레이터 `carrot-debug-3d.js`): `오픈파일럿 작동` 체크박스와 시나리오 3개(`주행 + 오픈파일럿 작동`, `주행 · 오픈파일럿 꺼짐`, `주행 + 오픈파일럿 + 문·트렁크 열림 값`) 추가(34→37개). 기존 `문 열림 → 주행 시작`은 문이 닫혀 보이는지, `문 열림 → 주행 종료`는 다시 열려 보이는지 검사한다. 차선 색은 뷰어 실제 값과 비교(채널당 3/255 허용, 선형 공간 보간 후 sRGB 반올림 차이). 차량 카드가 화면 밖일 때만 `scrollIntoView`.
- 변경(뷰어): 디버그 검사용 읽기 전용 `laneColor`, `doorsOpen` 추가. 차선 색 보간 종료 기준을 0.004→0.0005로 조여 목표 색에 정확히 도달(이전 기준은 어두운 채널에서 `#21ff5f`에 멈춤).
- 변경(디버그 `carrot-dashboard-debug.js`): 시뮬레이터 값으로 `v.enabled` 설정. 두 패널의 마크업 제거(이벤트 처리기는 이미 요소 없음을 처리; 카메라 모드는 기본 `auto` 유지). 호스트를 `carrot-debug` 컨테이너로 지정하고 폭 1300px 이상에서 대시보드(최소 840px, 데스크톱 레이아웃 유지)|컨트롤(400~500px) 그리드, 대시보드 영역은 `position: sticky`(HA 헤더 아래)·자체 세로 스크롤. 같은 우선순위의 기본 `.preview-pane{position:relative}`에 덮이던 문제를 선택자 구체화로 해결. 호스트 최대 폭 1440→1760px. `테스트할 기능` 드롭다운(전체·3D·잠금/도어/UI 후보·배터리·충전기/충전 계산·테마/언어, 기본 전체, 브라우저 localStorage 기억)과 `data-section` 필터, 동작 모드는 항상 표시. 패널·카드·버튼 여백과 글자 축소, 3D 시나리오는 자동 열 격자, 동작 모드 7개는 4열 격자, 캡션 있는 버튼 최소 폭 96px·캡션 줄바꿈 허용.
- 관련 파일: `custom_components/carrot_ha/frontend/{carrot-dashboard-debug.js,carrot-debug-3d.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/viewer.src.js`, `tests/{debug-3d.test.mjs,charging-curve.test.mjs}`, `docs/DEBUG_DASHBOARD.md`.
- 검증: 로컬 프리뷰(실제 디버그 카드 + 합성 hass + 운영 모델)에서 OP 시나리오 3개 자동 검사 통과(초록/회색 차선, 열림 값인데 문 닫혀 보임). 폭 1700/1400px에서 좌우 배치·대시보드 고정(스크롤 900·1800에서 상단 68px 유지)·시나리오 클릭 후 스크롤 위치 유지, 1100/390px은 기존 세로 배치. 드롭다운별 패널 높이: 전체 3001→2550px(컴팩트), 3D 1036, 배터리 412, 테마 400px. 보이는 버튼·라벨·선택 상자 89개를 1700/1400/1100/390px에서 자동 측정(글자 세로 쌓임·내용 넘침·과소 폭)해 발견된 동작 모드 7개·후보 버튼 5개·3D 첫 줄 버튼을 고친 뒤 0건. JS 테스트 104 통과/6 실패(실패 6건은 이번 변경 전부터 동일; charging-curve는 원래 import.meta 오류로 실패하며 제거 패널 검사 줄은 '없음' 확인으로 갱신). 실제 HA 화면 미확인.
- 배포 상태: `e5fb4ea`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 3개(`carrot-dashboard-debug.js`, `carrot-debug-3d.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/debug-dashboard-e5fb4ea/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일과 HTTP 응답(200) SHA-256이 커밋과 일치(`carrot-dashboard-debug.js` `8a6532b9…`, `carrot-debug-3d.js` `5523383a…`, `vehicle-3d.js` `60282b0d…`). Python 변경 없음(HA 재시작 불필요), 브라우저 강력 새로고침 필요. 운영 HA 화면 확인 미실시. 버전·태그·릴리즈 없음.

## 2026-10-26 — 3D 차량: 주행 중 문 닫힘 표시, 오픈파일럿 작동 시 초록 차선, 주행 시점 각도·축소 (HA 반영)

- 사용자 요청: (1) 주행 중에는 실제 상태와 무관하게 모든 문을 닫힌 상태로, 주행이 아니면 실제 상태로. (2) `binary_sensor.id_4_enabled`로 오픈파일럿 작동을 확인해 작동 중이면 주행 뷰의 차선을 초록, 꺼지면 기존 회색. (3) 주행 뷰를 조금 축소. 이어서 예시 사진을 주며 "축소랑 각도 조절", "예시 사진 정도면 충분".
- 변경(뷰어 `tools/vehicle3d/viewer.src.js`): 문·트렁크 애니메이션 목표를 `!state.driving && 실제 값`으로 바꿔 주행 중에는 닫히고 주행이 끝나면 실제 값으로 다시 열린다(충전 장면의 열린 문 강조도 이 값을 따른다). 새 상태 `openpilot`에 따라 점선 차선 색을 회색 `#9aa3a8`↔초록 `#34d873`로 부드럽게 전환. `drive` 시점은 조준점·수평 거리를 유지하고 카메라 높이를 2.6→4.3으로 올려 지붕이 보이게 했으며, 새 시점 속성 `pad: 1.15`로 모든 카드 크기에서 15% 물러난다(넓은 카드는 가로 맞춤 하한 0.8에 걸려 `need`만으로는 축소되지 않음).
- 변경(래퍼 `carrot-vehicle-3d.js`): `openpilotEngaged(v, hass, config)` 추가. 카드 설정 `openpilot_entity` 또는 서버가 주는 `entity_ids.enabled` 엔터티가 `on`/`off`이면 그 값을, 그 외(엔터티 없음·unavailable)에는 같은 출처인 카드 데이터 `enabled`를 쓴다. 추가 요청 없음.
- 변경(백엔드 `__init__.py`): 대시보드 응답의 `entity_ids`에 `enabled`를 추가(HA 재시작 후 적용). 재시작 전에도 카드 데이터 `enabled`로 동작한다.
- 문서: `docs/VEHICLE_3D_MODEL.md` 카드 옵션·상태 표 갱신.
- 관련 파일: `tools/vehicle3d/viewer.src.js`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-assets/vehicle-3d.js}`, `custom_components/carrot_ha/__init__.py`, `tests/vehicle-3d-integration.test.mjs`, `docs/VEHICLE_3D_MODEL.md`.
- 검증: 3D 통합·디버그 테스트 28/28 통과(신규 2건). 전체 JS 테스트의 실패 6건(`camera-360`, `charging-curve`, `debug-freshness`, 백엔드 캐시 키, `motion-status`, `range-c3-and-fixes`)은 이번 변경을 제외한 상태에서도 동일하게 실패하는 기존 문제. Python 테스트는 이 PC에 pytest가 없어 미실행. 로컬 프리뷰에서 센서상 트렁크·운전석 문이 열린 주행 상태(오른쪽 잠금 카드는 "열림")에서 3D 문이 모두 닫혀 보임, 오픈파일럿 꺼짐 회색·켜짐 초록 차선, 1300px·390px에서 지붕이 보이는 높아진 각도와 축소 확인, 콘솔 오류 없음. 실제 엔터티 상태 전환·실차 주행 화면은 미확인.
- 추가 조정(사용자 피드백 "각도가 너무 올라갔다, 조금만 내려 달라, 차 앞(차선)이 조금 멀리 보이게, 너무 쨍하지 않은 조금 더 밝은 초록"): `drive` 카메라 높이 4.3→3.5(앙각 약 28°→23°, 원래 2.6은 약 18°), 조준점을 차 앞쪽으로 0.45 이동(`look` z 0.4→0.85, 카메라도 같이 이동해 수평 방향 유지)해 차량 앞 도로가 더 보이게 했다. 0.7 이동은 390px에서 뒷범퍼가 카드 가장자리에 닿아 0.45로 줄였다. 작동 중 차선 색 `#34d873`→`#7ee6a6`(더 밝고 채도 낮음), 불투명도 0.55→0.72(꺼짐 회색은 0.55 유지). 프리뷰 1300px·390px에서 확인, 3D 테스트 28/28 통과.
- 추가 조정(사용자 요청 "그냥 쨍한 초록색 사용해볼래?"): 작동 중 차선 색 `#7ee6a6`→`#1fff5e`(채도 높은 밝은 초록), 불투명도 0.72→0.9. 프리뷰 1300px 확인, 3D 테스트 28/28 통과.
- 배포 상태: `2879352`(두 항목 공통 커밋)를 main에 푸시한 뒤 HA SSH(`sudo`)로 3개 파일(`frontend/carrot-vehicle-3d.js`, `frontend/carrot-assets/vehicle-3d.js`, `__init__.py`)을 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-framing-2879352/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일 SHA-256이 커밋과 일치(`carrot-vehicle-3d.js` `dc3c03e5…`, `vehicle-3d.js` `6ecf08b4…`, `__init__.py` `17d0dee8…`), 프론트엔드 2개의 HTTP 응답도 200·같은 해시. `__init__.py`(엔터티 ID `enabled` 노출)는 HA 재시작 후 적용(미수행, 재시작 전에도 카드 데이터 `enabled`로 동작). 브라우저 강력 새로고침 필요. 운영 화면·실차 주행·오픈파일럿 전환은 미확인. 버전·태그·릴리즈 없음.

## 2026-10-26 — 3D 차량: 카드 제목 아래 영역 기준 구도와 문·트렁크 열림 시점 줌 아웃 (HA 반영)

- 사용자 요청: 3D 시점이 카드 정중앙이지만 상단 상태 제목(`충전중` 등) 때문에 중앙으로 보이지 않으니 카드 크기에 맞게 정렬. 이어서 주차 중 문 열림 시점에서 열린 트렁크가 잘려 보이니 조금 줌 아웃.
- 원인: 3D 스테이지(`.v3d-stage`)는 `.vehicle3d`가 아닌 hero 전체(제목 포함)를 덮는다(`.hero .car-image{position:static}`이 `.vehicle3d{position:relative}`를 덮어씀). 카메라는 캔버스 중앙을 겨냥하므로 차량이 제목 높이의 절반만큼 위로 치우쳤다. 문·트렁크 시점(`top`)은 차체 아래쪽(y=0.45)을 겨냥하고 가로 폭만 맞춰, 위로 솟은 트렁크가 카드 위 가장자리에서 잘렸다.
- 변경(뷰어 `tools/vehicle3d/viewer.src.js`): 새 옵션 `frameTop`(px)으로 제목 아래 영역을 구도 기준으로 삼는다. `camera.setViewOffset`의 비축(off-axis) 투영으로 렌즈 중심을 그 영역 가운데에 두고 가로세로 맞춤도 그 영역 비율로 계산한다. 캔버스는 여전히 hero 전체에 그려지므로 제목 뒤로 솟는 부분이 잘리지 않는다. 인셋은 캔버스 높이의 40%로 제한. 시점별 세로 요구 높이 `needV`를 추가해 `fit`이 가로·세로 중 큰 쪽을 따른다. `top` 시점은 같은 각도로 조준점을 `[0,0.8,-0.3]`로 올리고 뒤로 옮겼으며 `needV: 4.6`을 둔다. 제목 문구가 바뀌면 `refreshFrame()`로 다시 측정한다.
- 추가 요청(같은 날): 데스크톱에서 마우스 휠로 축소가 안 되고(트랙패드 제스처는 됨), 충전 중 아래 공간이 크게 남는다.
  - 휠 원인: `wheel` 처리기가 항상 `preventDefault()`한 뒤 Ctrl(트랙패드 핀치가 보내는 ctrl+wheel) 또는 자유시점일 때만 줌했다. 일반 마우스 휠은 페이지 스크롤도 줌도 되지 않았다. 수정: 차량 위 휠은 항상 줌(줄·페이지 단위 deltaMode 환산, 한 번 입력당 변화량 제한). 페이지 스크롤 차단은 유지. `docs/VEHICLE_3D_MODEL.md` 조작 설명 갱신.
  - 충전 여백 원인: 충전 장면(충전기+케이블+차)은 가로로 길고 낮아 가로 폭 맞춤 시 정사각형에 가까운 카드에서 세로가 남는다. 수정: `charge` 시점의 카메라 높이를 3.1→5.8로 올려(조준점·수평 거리 동일) 장면을 세로로 키우고 배터리 팩이 더 잘 보이게 했다.
- 변경(래퍼 `carrot-vehicle-3d.js`): `headingBottom(box, stage)`로 `.hero-copy` 하단까지의 거리를 `frameTop`으로 넘기고, 렌더마다 `refreshFrame()`를 호출한다. 데이터 요청 추가 없음.
- 관련 파일: `tools/vehicle3d/viewer.src.js`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-assets/vehicle-3d.js}`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: three 0.170.0/esbuild 0.28.2로 번들 재생성. 3D 통합·디버그 테스트 26/26 통과(신규 1건, 휠 규칙 테스트를 새 동작으로 갱신). 실제 한국어 카드 + 합성 hass + 운영 모델(HA에서 읽기 전용 복사) 로컬 프리뷰에서 390/900/1300px 폭으로 주차·트렁크·문 전체·충전·충전+문 열림·주행 중(62km/h, 하향등)을 확인(주행 중은 사용자 지적 후 추가 검증: 인셋 1300px 58px·390px 39.6px 적용, 차량이 제목 아래 영역에 온전히 표시, 콘솔 오류 없음; 마우스 휠 아래로 축소·페이지 스크롤 없음 확인): 인셋 58px 적용, 정면·충전 장면이 제목 아래 영역 중앙, 열린 트렁크가 위 가장자리와 여백을 두고 전부 보임. 실기 모바일·운영 HA 화면은 미확인.
- 배포 상태: `2879352`(두 항목 공통 커밋)를 main에 푸시한 뒤 HA SSH(`sudo`)로 3개 파일(`frontend/carrot-vehicle-3d.js`, `frontend/carrot-assets/vehicle-3d.js`, `__init__.py`)을 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 해시가 같음을 확인하고 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-framing-2879352/before`에 백업(SHA256SUMS.before 포함). 반영 후 설치 파일 SHA-256이 커밋과 일치(`carrot-vehicle-3d.js` `dc3c03e5…`, `vehicle-3d.js` `6ecf08b4…`, `__init__.py` `17d0dee8…`), 프론트엔드 2개의 HTTP 응답도 200·같은 해시. `__init__.py`(엔터티 ID `enabled` 노출)는 HA 재시작 후 적용(미수행, 재시작 전에도 카드 데이터 `enabled`로 동작). 브라우저 강력 새로고침 필요. 운영 화면·실차 주행·오픈파일럿 전환은 미확인. 버전·태그·릴리즈 없음.

## 2026-10-26 — 3D 차량: 모바일 카드 높이를 조금 늘리고 시점별 폭 맞춤 구도 적용

- 사용자 요청: 모바일에서 인터랙티브 3D 카드 높이를 조금만 더 길게(메인·디버그 모두). 이어서 "너무 지나치게 늘리지 말고 조금만"이라고 정정했다.
- 변경(높이): 컨테이너 700px 이하(모바일)에서 3D 컨테이너(`.hero .car-image.vehicle3d`)만 155px에서 **195px**로 늘렸다(영역 전체 약 40px 증가). 이미지 폴백 전용 `.hero .car-image`의 155px는 그대로다. 디버그 대시보드는 같은 카드 스타일을 상속하므로 함께 바뀐다(디버그의 자체 규칙은 `max-height:250px`뿐이라 충돌 없음). 처음에는 225px로 올렸다가 과하다는 말씀에 195px로 줄였다.
- 변경(구도): 높이가 늘면 카메라가 가로 폭 기준으로 너무 물러나 차가 작아지는 문제가 있어, 뷰어가 시점마다 필요한 가로 폭(`need`, 미터: 정면 2.5, 측면 5.4, 탑 4.8, 주행 5.6, 충전 6.2 등)과 실제 보이는 폭으로 거리를 계산하도록 바꿨다(범위 0.8~1.7). 폭이 좁은 정면·후면은 가까이, 충전 시점은 충전기까지 들어오도록 유지한다. 넓은 카드에서는 이전과 같은 0.8 하한이다.
- 관련 파일: `custom_components/carrot_ha/frontend/{carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/viewer.src.js`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: JS 테스트 102개 중 100개 통과(실패 2건은 변경 전부터). 실제 한국어 카드를 모바일 폭(375px)에서 열어 3D 영역이 195px(영역 전체 235px)이고 정면 차량이 카드를 알맞게 채우며 충전+문 열림에서 차와 충전기가 모두 들어옴을 확인했다. 폭 683px과 1250px 레이아웃에서도 충전 시점 구도를 확인했다.
- 배포 상태: `b5b893e`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 파일 3개(`carrot-dashboard-ko.js`, `carrot-dashboard-en.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 동일함을 해시로 확인했고, 반영 후 3개 모두 커밋과 SHA-256이 일치한다. 반영 전 파일은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-mobile-height-b5b893e/before`에 백업했다. 모델 파일은 바뀌지 않았고 HA 재시작은 필요 없다(강력 새로고침). 새 pre-release/정식 릴리즈 없음.
- 미확인: 실제 iPhone Safari/HA 앱 화면에서의 높이·구도(이 환경은 폭 375px 에뮬레이션만 확인), 아주 좁은 폭(360px 이하)의 구도.

## 2026-10-26 — 3D 차량: 충전 중 표시(X-ray·배터리 팩·케이블·충전기)와 디버그 충전 시나리오

- 사용자 승인: 로컬 프리뷰(`.preview/vehicle-3d`)에서 반복 확인·수정한 충전 장면을 메인과 디버그 대시보드에 반영하고 HA에 배포하도록 요청했다(디버그에는 충전 시나리오 포함).
- 변경(뷰어): 충전 장면 모듈 `tools/vehicle3d/charge-scene.js`를 추가했다. 충전 중에만 차체·창문을 X-ray(10%), 바퀴·타이어를 30%로 처리하고 실내를 숨기며, 열린 문·트렁크는 84% 불투명 + 호박색으로 강조한다. 차대 아래에 납작한 배터리 팩을 두고 SOC만큼 초록으로 채우며, 충전기 기둥(SOC·kW 화면), 위에서 30° 아래로 꽂히는 검은 커넥터, 케이블, 충전구에서 팩까지의 초록 선 두 가닥을 그린다. 빛 한 줄기가 충전기 → 케이블 → 충전구 → 초록 선 → 채워진 팩 순서로 한 바퀴 돌며 11kW 이하 4.4초, 초과 2.2초(대시보드 SOC 바와 같은 주기)다. 충전 중에는 실제 하향등 값과 무관하게 램프가 켜지고 끝나면 실제 값으로 돌아온다. 팩·케이블·충전기는 차체보다 먼저 깊이를 기록하며 그려서 열린 문이 팩 앞에서 정확히 가린다. 충전 기본 시점 `charge`(오른쪽 앞 3/4)를 추가했다.
- 변경(연동): `vehicleViewState`가 카드 상태(`charging`)와 이미 가진 값(`charge_power_kw`/`charge_power_w`, `charge_mode`, `soc_percent`)에서 충전 입력을 만든다. 새 요청은 없다. 한국어·영어 카드는 같은 모듈을 쓰므로 별도 수정이 없다. 뷰어에 읽기 전용 `lamp`, `charge`(활성·스윕 주기)를 추가했다. 충전 중 반복되는 스윕은 "시점 안정화" 판정에 포함하지 않는다.
- 변경(디버그): `carrot-debug-3d.js`의 시나리오를 22개에서 34개로 늘렸다. 기존 `충전 + 문 열림`의 기대 시점을 `top`에서 `charge`로 바꾸고, 충전 완속 7kW·11kW(경계)·급속 50kW·150kW·SOC 10%·95%·문·트렁크 전부 열림·하향등 켜짐(실제 꺼짐)·실제 하향등 켜짐, 충전 종료 후 하향등 원래대로(꺼짐/켜짐), 충전 중 주행 시작을 추가했다. 충전 시나리오는 시점뿐 아니라 충전 장면 활성, 램프 밝기, 스윕 속도 등급을 자동 검사한다.
- 문서: `docs/VEHICLE_3D_MODEL.md`에 충전 표시 절을 추가했다.
- 관련 파일: `tools/vehicle3d/{charge-scene.js,viewer.src.js}`, `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-debug-3d.js,carrot-assets/vehicle-3d.js}`, `tests/{vehicle-3d-integration.test.mjs,debug-3d.test.mjs}`, `docs/VEHICLE_3D_MODEL.md`.
- 검증: JS 테스트 102개 중 100개 통과, 실패 2건(`motion-status`, `range-c3-and-fixes`)은 변경 전부터 실패한다. Chromium에서 디버그 대시보드의 `전체 순회 재생`이 34개 시나리오를 **통과 34 / 실패 0**으로 마쳤다(충전 13개 포함: 완속 7·11kW는 스윕 4.4초, 급속 50kW와 표시 전력 95kW는 2.2초). 실제 한국어 카드(`legacy_id4` 설정)에서 주차 → 완속 충전 → 급속 충전 → 충전+문 열림 → 종료를 확인했다(시점 `front`/`charge`, 스윕 주기, 램프 0/1).
- 배포 상태: `354457c`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 파일 3개(`carrot-vehicle-3d.js`, `carrot-debug-3d.js`, `carrot-assets/vehicle-3d.js`)를 직접 반영했다. 반영 전 설치 파일이 직전 커밋과 동일함을 해시로 확인했고, 반영 후 3개 모두 커밋과 SHA-256이 일치한다. HA에서 세 경로와 모델이 200이며 `/api/carrot_ha/frontend-version`이 `0.9.0-beta.1-232978018ccf`로 바뀌어 브라우저가 새 파일을 받는다. 반영 전 파일은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-charging-354457c/before`에 백업했다. 모델 파일은 바뀌지 않았고 HA 재시작은 필요 없다. 새 pre-release/정식 릴리즈 없음.
- 미확인: 실제 HA 화면·모바일·저사양 기기에서의 렌더링 성능(충전 중에는 스윕 때문에 화면이 보이는 동안 계속 그린다), 실차에서 충전 신호(`charging`, `charge_power_kw`)가 이 대시보드 값으로 들어오는 경로, 충전구·팩·충전기의 실제 형상과의 차이(일반적인 형태로 만든 추정치).

## 2026-10-26 — 3D 차량 스와이프 스크롤 차단 제품 반영·HA 배포 완료

- 사용자 승인: 프리뷰 시연 후 “HA에 바로 반영해줘. 디버그, 메인 대시보드 둘다 포함.”으로 공통 뷰어 변경·직접 배포 승인.
- 변경/이유: 차량 캔버스 touch-action none을 기본 및 자유시점 해제 뒤에도 유지하고, 일반 wheel도 preventDefault하여 차량 조작이 페이지 스크롤로 이어지지 않도록 함. 드래그 회전·핀치/Ctrl+휠 확대·축소와 차량 바깥 페이지 스크롤은 유지. 공통 뷰어를 사용하므로 디버그 및 ko/en 메인에 모두 적용.
- 관련 파일: tools/vehicle3d/viewer.src.js, custom_components/carrot_ha/frontend/carrot-assets/vehicle-3d.js, tests/vehicle-3d-integration.test.mjs, docs/VEHICLE_3D_MODEL.md, frontend/carrot-vehicle-3d.js (공통 제스처 설명 및 프론트엔드 식별자 갱신).
- 검증: 프리뷰에서 차량 위 wheel 스크롤 차단, 대각선 드래그 회전, 차량 바깥 페이지 스크롤 확인. 신규 기본/자유시점 및 wheel 이벤트 계약 테스트 포함 전체 JS 100개 중 98개 통과, 기존 motion-status·range-c3-and-fixes 2개만 실패.
- 배포 상태: 제품 커밋 `e2d84b45529e54243c27ef6e3c8949677dafb7e9` main 푸시 후 HA 직접 반영 완료. 백업 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-swipe-e2d84b4/before`. 설치 및 HTTP 응답 SHA-256이 두 파일 모두 커밋과 일치: `carrot-vehicle-3d.js` = `3466b8df05fdad8de981169b530f4407984748f93aa8657024f619f308bb0140`, `carrot-assets/vehicle-3d.js` = `482b43936ee21b4922a36128c2544388c8925b4732a38b357cd4c94fa29561c9`. HA frontend-version `0.9.0-beta.1-5e56ec89ccf2` 확인. 디버그·ko/en 메인은 같은 공통 뷰어 사용. 모델·GLB·버전·태그·릴리즈 변경 없음. HA 재시작 불필요, 브라우저 강력 새로고침 필요.
- 미확인: 모바일 실기 터치·핀치, 로그인된 실제 HA 화면.

## 2026-10-26 — 3D 차량 스와이프의 페이지 스크롤 차단 프리뷰 (승인 대기)

- 요청/원인: 차량 조작 중 페이지가 함께 스크롤됨. 뷰어 기본 `touch-action: pan-y`가 세로 터치를 페이지로 넘기고, 일반 wheel도 페이지 스크롤을 허용하고 있었음.
- 프리뷰 변경: `.preview/dash3d/swipe/viewer.src.js` 사본에서 기본 및 자유시점 해제 후에도 touch-action none 유지. wheel은 preventDefault 후 Ctrl/핀치 또는 자유시점일 때만 기존 줌 적용. 제품 소스·번들은 아직 변경하지 않음.
- 검증: 로컬 실제 디버그 카드에서 차량 위 스크롤 입력 후 페이지 위치 유지, 대각선 드래그로 회전 확인, 차량 바깥 스크롤은 페이지 이동 확인. 기존 3D 통합 테스트 17/17 통과. 모바일 실기 터치·핀치는 미검증.
- 배포 상태: UI 사전 승인 대기. HA 반영·커밋·푸시·버전·태그·릴리즈 없음. 승인 후 tools/vehicle3d/viewer.src.js와 생성 번들, 관련 문서·테스트에 반영 예정.

## 2026-10-26 — 디버그 3D 시나리오 제품 반영·HA 직접 배포 완료

- 사용자 승인: 사전 프리뷰 시연 후 “HA에 일단 바로 반영해줘”로 제품 반영·직접 배포 승인.
- 변경: 프리뷰에서 확인한 22개 시나리오, 개별 문·트렁크 및 전체 토글, 하향등·181초 만료, 속도·모드 연동, 시점·자유시점·초기화, 3D 끔·모델 없음, 자동 순회·중지·통과/실패 패널을 제품 코드로 옮김. 운영 카드의 syncVehicle3d/vehicleViewState와 DOM 보존 경로를 재사용하며 운영 ko/en 파일은 변경하지 않음.
- 관련 파일: frontend/carrot-dashboard-debug.js, frontend/carrot-debug-3d.js, tests/debug-3d.test.mjs, docs/VEHICLE_3D_MODEL.md, docs/DEBUG_DASHBOARD.md.
- 검증: 프리뷰 22/22 통과·실패 0, 카드 안 실제 드래그 회전 확인. 제품 전체 JS 테스트 99개 중 97개 통과, 기존 motion-status·range-c3-and-fixes 2개만 실패. 디버그 신규 의존성까지 버전 쿼리를 검증하도록 기존 의존성 테스트를 확장함. HA SSH 연결·설치 경로 확인 완료. 백업·해시 결과는 아래 배포 기록에 추가함.
- 배포 상태: 제품 커밋 `0b11db5bb054b7d2269de41e78414a8cc37772f1` main 푸시 확인 후 HA SSH sudo 표준입력으로 프론트엔드 2개 반영 완료. 백업: `/homeassistant/carrot_ha/deployment-backups/debug-3d-0b11db5/before` (새 파일은 `.absent` 표식). 설치 및 HTTP 응답 SHA-256이 모두 커밋과 일치: `carrot-dashboard-debug.js` = `f041e28843e7f92c1364249c17e345694b79066ddccc5cc1a01be63c1a51445d`, `carrot-debug-3d.js` = `ed1094eb41a3891187a998eb6a4fe2b6d97a35656b06cb8122fb7946ee732f8e`. HA frontend-version = `0.9.0-beta.1-f1488c236ae6` 확인. 버전 상승·태그·릴리즈 없음. GLB 변경·커밋 없음. 프론트엔드만 변경하여 HA 재시작 불필요.
- 미확인: 실제 HA 로그인 화면·모바일. 프리뷰 검증과 운영 화면 검증은 구분함.

## 2026-10-26 — 디버그 3D 시나리오 사전 프리뷰·러브레이스 복구 안내 (승인 대기)

- 요청/이유: 디버그 카드에서 문 4개·트렁크·하향등·속도·시점·폴백과 22개 시나리오를 가상 값으로 시험하고, 제거한 러브레이스 디버그 카드를 다시 추가할 수 있도록 안내한다.
- 시작 점검: main 작업 트리 깨끗함, MERGE_HEAD·기존 스테이징 없음. `git pull --ff-only` 결과 최신 상태.
- 조사: hero의 `.vehicle3d`는 디버그 호스트가 아니라 `dashCard.shadowRoot` 안에 있다. `patchDashCard`가 보관한 운영 `origRender()`는 이미 `this.syncVehicle3d(v,state)`를 호출한다. 호출 누락이라는 가설은 현재 코드에서 확인되지 않았다. 운영의 `vehicleViewState`·동기화·뷰어를 그대로 사용한다.
- 프리뷰: `.preview/dash3d/index.html`, `frontend/carrot-dashboard-debug.js` 사본, `frontend/carrot-debug-3d.js`, `debug-3d.test.mjs` (모두 gitignore 대상). 실제 전체 프론트엔드 모듈을 복사해 Custom Element와 합성 hass로 구동한다. 로컬 모델만 사용하며 GLB는 커밋하지 않는다. ordinary telemetry 갱신은 기존 운영 DOM 패치 경로를 유지한다. 모델 옵션 변경 시에만 운영의 3D 비활성화 렌더 경로로 뷰어를 해제하고 다시 만든다.
- 검증: 첫 순회는 화면 밖 렌더 중지와 주행 중 계속 움직이는 뷰어의 settled 판정 때문에 실패했다. 검증 때 차량을 화면에 표시하고 주행은 1.8초 대기 뒤 실제 view를 비교하도록 수정한 뒤 22/22 통과, 실패 0. 카드 안 마우스 드래그로 정면에서 측면으로 회전 확인. 프리뷰 계약 테스트 3/3 통과. `node --test tests/*.test.mjs`: 96개 중 94개 통과, 기존 motion-status·range-c3-and-fixes 2개 실패.
- 관련 문서: `docs/DEBUG_DASHBOARD.md`에 실제 등록 이름 `custom:carrot-dashboard-debug-card`, 카드 YAML, 공통 리소스 경로와 복구 절차를 추가했다. `docs/VEHICLE_3D_MODEL.md`는 승인 후 운영 적용과 함께 갱신할 예정.
- 배포 상태: 사전 UI 승인 대기. 프로덕션 프론트엔드 수정·커밋·푸시·HA SSH 반영 없음. 버전·태그·릴리즈 없음. 프리뷰 서버 `http://127.0.0.1:8765/dash3d/` 유지.
- 미확인/후속: 실제 HA 화면·모바일·운영 배포는 미검증. 승인 후 프리뷰 변경을 제품 파일로 옮기고 신규 테스트를 tests에 추가해 전체 검증, main 커밋·푸시, 백업 후 HA 직접 반영과 커밋/설치 SHA-256 대조를 수행한다. HA 재시작은 필요 없는 프론트엔드 변경이다.

## 2026-10-26 — 3D 차량: 드래그 불가 수정과 로딩 속도 개선

- 사용자 보고: 3D 모델은 뜨지만 돌려 볼 수 없고(고정), 대시보드 진입 뒤 3D가 나오기까지 약 10~15초가 걸린다.
- 원인 1(조작 불가): 카드의 기존 스타일 `.hero .car-image{pointer-events:none}`가 3D 컨테이너(`class="car-image vehicle3d"`)와 그 자식 캔버스에도 상속되어 마우스·터치가 캔버스에 전달되지 않았다. 프리뷰 검증은 상태 전환만 확인했고 카드 안 드래그는 시험하지 않았다.
- 원인 2(느린 로딩): Mac에서 HA로 측정한 전송 속도가 약 105KB/s여서 모델 3,619,416바이트에 34초, 3D 모듈 616,497바이트에 5.7초가 걸렸다. 병목은 파싱이 아니라 전송이며, 기존 흐름은 모델 존재 확인(HEAD), 모듈, 모델을 순차로 받았고 정적 경로에 캐시 헤더가 없어 재방문 최적화가 없었다.
- 변경: ① `.hero .vehicle3d,.hero .vehicle3d .v3d-stage{pointer-events:auto}`를 기존 규칙 뒤에 추가하고 제목 영역(`.hero-copy`)은 포인터를 통과시킨다. ② 모델을 접속 기기의 IndexedDB에 저장하고 재방문 때 저장본을 바로 사용하며 ETag로 백그라운드 확인한다(변경은 다음 방문부터 적용). localStorage는 용량·바이너리 문제로 사용하지 않는다. ③ HEAD 확인을 없애고 모델과 3D 모듈을 병렬로 내려받으며, 카드 `setConfig` 시점에 미리 시작해 데이터 요청과 겹친다. ④ 모델 빌드에서 텍스처를 WebP로 압축하고 geometry는 meshopt `high`로 압축해 3,619,416바이트에서 2,023,208바이트로 줄였다(약 44% 감소, 화질 차이는 프리뷰에서 눈으로 비교했다). ⑤ 뷰어가 내려받은 바이트를 직접 받는다(`modelBuffer`).
- 관련 파일: `custom_components/carrot_ha/frontend/{carrot-vehicle-3d.js,carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/{viewer.src.js,model/build_model.mjs,model/package.json}`, `docs/VEHICLE_3D_MODEL.md`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: JS 테스트 17개(포인터 이벤트 규칙 순서, 모델 1회 다운로드와 워밍업 공유, 3D 끔에서 요청 없음, 모델 없음 폴백, IndexedDB 사용·localStorage 미사용 등) 통과, 전체 JS는 기존 실패 2건 외 통과. Chromium에서 실제 한국어 카드(`legacy_id4` 설정)를 마우스로 드래그해 차가 회전함을 확인했다. IndexedDB를 비운 첫 로드는 `source: network`, 재로드는 `source: local`(다운로드 16ms)로 기록됨을 확인했다.
- 배포 상태: `6b940d2`를 main에 푸시한 뒤 HA SSH(`sudo`)로 프론트엔드 파일 4개와 새 모델을 직접 반영했다. 설치 SHA-256이 파일 4개 모두 커밋과 일치하고 모델도 로컬과 일치한다(2,023,208바이트, HA에서 200). `/api/carrot_ha/frontend-version`이 `0.9.0-beta.1-2ad6405ad6d4`로 바뀌어 브라우저가 새 파일을 받는다. 반영 전 파일 4개와 이전 모델은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-drag-speed-6b940d2/before`에 백업했다. 프론트엔드·모델만 바뀌어 HA 재시작은 필요 없다. 새 pre-release/정식 릴리즈 없음.
- 미확인: 실제 HA 화면과 모바일에서의 체감 시간(이 환경은 HA에 로그인된 브라우저가 없다). 첫 방문의 전송 시간은 회선에 따라 여전히 길 수 있다. 모델을 바꾼 직후에는 기기에 저장본이 있으면 한 번 더 새로고침해야 새 파일이 적용된다.

## 2026-10-26 — 3D 차량: `vehicle_image_layout: legacy_id4` 카드에서 3D가 뜨지 않던 문제 수정

- 사용자 보고: HA 재시작 뒤에도 3D 대신 정적 이미지가 표시됨.
- 원인: 사용자 카드 설정에 `vehicle_image_layout: legacy_id4`가 있었고, `vehicleImage()`가 이 설정에서 3D 컨테이너를 만들기 전에 옛 SVG를 바로 반환했다. 서버 쪽은 정상이었다(HA에서 `/carrot_ha_models/vehicle.glb` 200·`model/gltf-binary`·3,619,416바이트, HEAD 200, `carrot-vehicle-3d.js`·`carrot-assets/vehicle-3d.js` 200). 프리뷰 설정에는 이 옵션이 없어 놓쳤다.
- 변경: 한국어·영어 `vehicleImage()`를 정리해, 3D가 켜져 있으면 모든 이미지 레이아웃에서 3D 컨테이너를 만들고 설정된 이미지(legacy 잘라내기 SVG 포함)를 컨테이너 안의 폴백으로 둔다. `vehicle_3d: false`이면 기존 마크업을 그대로 돌려준다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-dashboard-{ko,en}.js`, `tests/vehicle-3d-integration.test.mjs`.
- 검증: 신규 회귀 테스트(legacy 레이아웃·일반 이미지·이미지 없음에서 3D 컨테이너와 폴백, `vehicle_3d: false`에서 원본 마크업) 포함 JS 테스트 13개 통과. Chromium에서 사용자와 같은 설정(`legacy_id4` + 이미지)으로 3D 캔버스가 뜨고 폴백이 숨겨지며 문 열림 장면이 반영됨을 확인했다.
- 배포 상태: `45a4e9c`를 main에 푸시한 뒤 HA SSH(`sudo`)로 두 대시보드 파일만 직접 반영했다. 설치 SHA-256이 커밋과 일치하고, `/api/carrot_ha/frontend-version`이 `0.9.0-beta.1-d9851e5c8217`로 바뀌어 브라우저가 새 파일을 받는다. 반영 전 파일은 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-legacy-layout-45a4e9c/before`에 백업했다. 프론트엔드 파일만 바뀌어 HA 재시작은 필요 없다(페이지 강력 새로고침만). 실제 HA 화면은 로그인 상태가 없어 이 환경에서 확인하지 못했다. 새 pre-release/정식 릴리즈 없음.

## 2026-10-26 — 인터랙티브 3D 차량(선택 기능)과 하향등 엔터티 복구

- 사용자 승인: 로컬 인터랙티브 프리뷰(`.preview/vehicle-3d`)를 확인·승인한 뒤 하향등 엔터티 복구와 대시보드 통합을 요청했다. 모델 파일은 개인 사용 목적이며 제3자에게 배포하지 않는다고 사용자가 확인했다.
- 이유: 정적 이미지 대신 문 4개·트렁크·하향등·주행 상태를 보여 주는 3D 차량을 내 차 탭에 표시한다.
- 변경(HA 통합): `light_low_beam_requested`(하향등 요청) 바이너리 센서를 복구했다. 다른 램프 요청(상향등·미등·DRL·안개등·후진등)은 이전처럼 수집기에만 남긴다. 값은 일시적이므로 `OPTIONAL_FIELDS`에 넣어 180초 후 만료한다(차량이 잠든 뒤 켜짐이 남지 않음). 문·트렁크·잠금은 기존대로 마지막 값을 유지한다. 사용자 모델 폴더 `/config/carrot_ha/models`가 있으면 `/carrot_ha_models`로 정적 제공한다.
- 변경(프론트엔드): `carrot-vehicle-3d.js`(상태 연결·지연 로딩·폴백)와 `carrot-assets/vehicle-3d.js`(three.js 기반 뷰어, 약 0.6MB)를 추가했다. 한국어·영어 대시보드의 차량 이미지를 3D 컨테이너로 바꾸되 PNG를 폴백으로 유지한다(`vehicle_3d: false`로 끄기, `vehicle_3d_model`·`vehicle_3d_color` 옵션). `carrot-view-state.js`의 갱신 병합이 `.vehicle3d`를 Leaflet 지도처럼 소유 영역으로 두어, 15초 갱신에도 캔버스·시점이 유지된다. 디버그 대시보드는 정적 이미지를 쓴다.
- 동작: 주차는 전면, 문/트렁크 열림은 45° 탑뷰, 주행은 뒤쪽 위 3/4 시점이 기본이며 드래그로 어느 방향이든 돌릴 수 있다(카메라는 차 중심 높이의 수평선 아래로만 내려가지 않음). 하향등은 후미등·헤드램프와 바닥의 부채꼴 빛으로 표시한다. 대시보드가 이미 가진 값(`door_*_open`, `trunk_open`, `light_low_beam_requested`, `speed_kph`, 주행 상태)만 사용하며 모델 존재 확인 `HEAD` 1회 외에 요청을 만들지 않는다.
- 모델: 저장소에 포함하지 않는다(`.gitignore`의 `*.glb`). 원본 Sketchfab Standard 라이선스와 CC BY-NC 4.0 부품을 합친 개인용 파일이다. 재생성 스크립트는 `tools/vehicle3d/model/`, 사용법·출처·한계는 `docs/VEHICLE_3D_MODEL.md`에 기록했다. 스크립트로 다시 만든 결과가 승인된 프리뷰 모델과 바이트 단위로 동일함을 확인했다.
- 관련 파일: `custom_components/carrot_ha/{telemetry.py,__init__.py}`, `frontend/{carrot-assets/LICENSE.three,carrot-vehicle-3d.js,carrot-view-state.js,carrot-dashboard-ko.js,carrot-dashboard-en.js,carrot-assets/vehicle-3d.js}`, `tools/vehicle3d/`, `docs/VEHICLE_3D_MODEL.md`, `tests/{vehicle-3d-integration.test.mjs,test_new_sensors.py,test_optional_telemetry.py}`, `.gitignore`.
- 검증: 신규 JS 테스트 9개(상태 매핑, 만료·미확인 값, 모델 없음 폴백과 재탐색 방지, 3D 끄기·해제, 지연 로딩, 추가 요청 없음) 통과. 신규 하향등 Python 테스트(유일한 램프 엔터티, 180초 만료, 타임스탬프 없음) 통과. 기존 테스트는 변경 전과 동일한 결과다(JS: `motion-status`, `range-c3-and-fixes` 2건은 변경 전 HEAD에서도 실패, Python: 환경 모듈 부재 9건 동일). Chromium에서 실제 한국어 카드 + 합성 값으로 주차·문 열림·주행+하향등·모델 없음(PNG 폴백)을 확인했고, 반복 렌더링 뒤에도 같은 캔버스가 유지됨을 확인했다.
- 배포 상태: `8b9c777`을 main에 푸시했다. 같은 날 HA SSH(`sudo`)로 직접 반영했다: 통합·프론트엔드 파일 8개를 파일별 임시 파일 뒤 교체했고, 설치 SHA-256이 8개 모두 커밋과 일치하며 파이썬 구문 검사를 통과했다. 모델 `/config/carrot_ha/models/vehicle.glb`(3,619,416바이트)는 로컬 파일과 SHA-256 `089479a4…cbe8`이 일치한다. 반영 전 파일 5개와 해시는 `/homeassistant/carrot_ha/deployment-backups/vehicle-3d-8b9c777/before`에 백업했다(신규 3개는 백업 대상 아님). 반영 전 HA의 `__init__.py`와 두 대시보드는 저장소 직전 커밋과 줄바꿈(CRLF)만 달랐고 내용은 같음을 확인했다. **HA 재시작은 하지 않았다**(사용자 작업): 재시작해야 새 엔터티와 `/carrot_ha_models` 경로가 등록된다. 새 pre-release/정식 릴리즈·태그는 만들지 않았다.
- 미확인: 실제 HA 화면·모바일 터치·저사양 기기 성능, 실차 하향등 신호의 연속 수신(과거 3일 아카이브에서 켜짐/꺼짐 값이 들어오는 것만 확인). 새 pre-release/정식 릴리즈는 만들지 않았다(사용자 승인 없음).

## 2026-10-26 — 파라미터 대시보드 복구 및 실패 값 복원

- 사용자 승인: 보완 후 HA 직접 반영 및 사용 절차 안내. 기존/신규 비교 프리뷰를 제공한 뒤 운영 복구를 명시적으로 요청했다.
- 변경: 상위 당근웹 `05c1678033c1c778f0386fba00c1e105bb26c427`의 설정 화면·검색·스타일·번역을 이식하고 HA 검색 HTML 및 중복 복귀 이벤트를 보완했다. `carrot-params-card`는 다시 파라미터 화면을 표시하며 주행 로그는 `carrot-logs-card`를 사용한다. 공통 대시보드 리소스에서 명시적인 `carrot-parameter-tuning-card`도 등록한다.
- 실패 보완: 항목별 대기 표시·중복 조작 잠금, 실패 시 스위치/입력값과 내부 캐시를 마지막 확인값으로 복원, 성공 시 요청값 대신 실제 차량 확인값으로 확정한다. 시간 초과는 취소로 오인하지 않도록 미확인으로 표시하고 같은 요청 ID를 계속 추적하며 지연 적용 시 화면과 상태를 갱신한다. 스냅샷을 복사해 로컬 조작이 확인값을 오염시키지 않도록 한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-{dashboard-runtime,params-card,parameter-tuning-card}.js`, `frontend/carrot_web/`의 설정·공유 모듈·번역·HTML·CSS, `scripts/params_recovery_patch.py`, `scripts/build_params_preview.py`, 파라미터 브라우저 회귀 테스트.
- 검증: 파라미터 단위·대시보드 지연 로딩 테스트 통과. Chromium 실제 컨트롤에서 실패 복원, 대기 중 잠금, 요청과 다른 실제 값, 시간 초과 후 복원/추적, 지연 적용 확인 통과. 설정 전체 PC/모바일 브라우저 회귀(검색·카탈로그 교체·스크롤·높이·메시지 격리) 통과. 실차 변경은 실행하지 않았다.
- HA 사전 확인: SSH 연결 성공. 공통 `/carrot_ha_static/carrot-dashboard.js`가 JS 모듈로 이미 등록되어 있다. 기존 `/carrot_ha_static/carrot-params-card.js` 리소스는 잘못된 CSS 유형으로 등록되어 있어 사용자가 삭제할 수 있으며 공통 모듈을 사용하면 별도 등록은 불필요하다.
- 배포 상태: `6b3f58bd8a8bf02c7998ef8c778ba56b15300026` main 푸시 후 HA 파일 16개 사전 해시 확인·백업·직접 반영 완료. 설치 SHA-256 전부 일치. 백업 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-6b3f58bd8a8b/before`. HA HTTP 제공본의 runtime/기존 별칭/신규 카드/설정 페이지/브리지 5개도 설치본과 일치. frontend-version `0.9.0-beta.1-ce73a41a5d39` 확인. 프론트엔드 파일만 변경해 HA 재시작 불필요. 새 태그/릴리즈 및 Comma 수정·재시작 없음. 실제 사용자 브라우저와 실차는 미확인.

## 2026-10-26 — 파라미터 복구 프리뷰 기존/신규 비교 보완

- 이유: 이전 프리뷰는 시험 항목 두 개와 단일 화면만 제공해 변경점을 식별할 수 없었다.
- 변경: 실제 HA 카드·전체 프론트엔드를 기존/신규로 각각 복사해 독립적으로 렌더링한다. 동일한 합성 설정 22개와 모바일/PC 폭 전환, 검색·상세·상위 복귀 비교 버튼을 제공한다. 최신 검색 HTML을 상위 원본과 맞추고 신규 쪽의 구형 HA 중복 뒤로 가기 리스너를 제거한다. 운영 파일은 수정하지 않았다.
- 관련 파일: `scripts/build_params_preview.py`, `scripts/fixtures/params-preview.html`, `scripts/fixtures/params-compare.html`, `tests/params-compare-browser.cjs`.
- 검증: Chromium에서 기존/신규 검색창 DOM 차이, 같은 검색어 입력, 신규 모바일 검색 결과 제자리 표시·포커스 유지, 상세 진입/검색 결과 복귀, 정확한 요청 ID의 변경 확인, PC/모바일 폭 전환 및 페이지 오류 없음 통과. 실제 비교 화면 스크린샷 시각 검토 완료. 로컬 HTTP 응답 200 확인.
- 배포: 비교 프리뷰 `/compare.html`만 제공. 운영 HA·Comma 미반영, 새 릴리즈/태그 없음. 실제 휴대폰 키보드·실차 검증 미수행.
- 추가 조사: 사용자가 보고한 변경 실패 후 값 잔류에 대해 기존/상위 `commitSettingValue`의 catch가 알림만 표시하고 컨트롤 값을 복원하지 않음을 확인했다. 이번 커밋은 비교 프리뷰 보완이며 실패 복원 기능은 아직 구현하지 않았다.

## 2026-10-26 — 파라미터 화면 복구: 최신 당근웹 프리뷰 준비

- 사용자 요청: 파라미터 대시보드 복구에 상위 당근웹의 최신 설정 화면·스타일 변경을 포함한다.
- 상위 기준: `ajouatom/openpilot:carrot-wip`의 `05c1678033c1c778f0386fba00c1e105bb26c427` (2026-10-24). 원격 fetch로 확인했다. 상위 `carrot-wip-model_selector` ref는 현재 조회되지 않는다.
- 변경: 프로덕션 파일은 유지하고 `/private/tmp/carrot-params-preview`의 전체 HA 프론트엔드 복사본에 상위 설정 런타임·페이지·CSS·번역·공유 모듈 차이 11개를 이식했다. 모바일 키보드 viewport 정책도 반영했다. HA 인증/값 조회/변경 큐 및 정확한 요청 ID의 차량 적용 확인을 담당하는 기존 브리지는 유지한다.
- 관련 파일: `scripts/build_params_preview.py` (프로덕션 경로를 차단하는 재현용 프리뷰 생성기), `scripts/fixtures/params-preview.html` (합성 데이터). 출처·파일별 SHA-256은 프리뷰의 `params-source.json`에 기록한다.
- 검증: 기존 단위 테스트 통과. 최신 프리뷰 대상 Chromium PC/모바일 회귀에서 카탈로그 표시·교체, 한글 검색, 외부 메시지 차단, 지원하지 않는 작업 거부, 정확한 큐 ID 적용 대기/확인, 실패 전달, 높이·알림 위치·스크롤 및 페이지 오류 없음 확인.
- 배포 상태: 프리뷰만 준비. 화면 승인 전 프로덕션 UI 수정·HA 배포·새 태그/릴리즈 없음. 실차 및 운영 HA 확인은 미수행. 승인 후 카드 연결 복구 및 운영 반영 예정.
- 병행 작업 보호: 조사 중 차계부 `automatic_locations.py`, `station_stats.py`, `stations.py`, `store.py`의 다른 변경을 발견했으며 이 작업에서 수정·스테이징하지 않는다.

## 2026-10-26 — 저장소 위치 이동 및 여러 Mac 작업·시작 점검 규칙 문서화

- 이유: 저장소가 iCloud 동기화 대상인 `~/Documents`에 있어 git 작업 중 `이름 2.js`·`api 2.py`·`CHANGELOG 2.md` 충돌 복사본이 생겼고(9월 19일의 `carrot-trip-days 2.js`도 확인), 같은 날 GitHub Desktop pull이 `driving-logs/` 충돌로 병합을 미완료로 남겨 303개 파일이 스테이징된 상태가 됐다.
- 변경: 저장소를 `/Users/davidlim/Documents/carrot-ha`에서 `/Users/davidlim/Developer/carrot-ha`로 `mv` 이동했다(새로 클론하지 않음). 이동 전 `git bundle`로 `~/carrot-ha-backup.bundle`에 백업했다. 루트 `AGENTS.md`에 저장소 위치·여러 Mac 작업 순서·에이전트 시작 점검·이동 절차를 추가하고, 차계부 지침 2곳(`vehicle-journal/AGENTS.md`, `.agents/rules/vehicle-journal.md`)에 프리뷰 선행 규칙 보강과 HA 반영 전 해시 확인을 추가했다. `vehicle-journal/deployment.md`와 일회성 스크립트 `patch_dashboard.js`·`replace_charge_cards.js`의 옛 절대 경로를 갱신했다.
- 검증: 이동 후 `git status`/`git fsck --connectivity-only`, 브랜치 9개(로컬 전용 4개 포함)와 스태시 1개 보존, git에 없는 `cloudflare/wrangler.json`·`.preview/` 존재, 새 위치가 iCloud 동기화 폴더 밖임을 확인했다.
- 미확인/후속: 두 번째 Mac의 클론·SSH 키·HA 키 등록은 사용자 작업이다. GitHub Desktop 저장소 경로와 Claude Code 프로젝트 경로는 새 위치로 다시 지정해야 한다. 추적되지 않은 `… 2.js` 복사본 4개는 삭제하지 않고 남겼다. 로컬 전용 브랜치 4개는 푸시하지 않았다.
- 배포 상태: 문서·경로 변경만이며 HA·Comma 반영, 릴리즈 없음.

## 2026-10-25 — vehicle-journal: 데스크톱 메모 입력 기본 높이 확대

- 사용자 요청으로 화면 너비 851px 이상에서 기록 추가/수정 메모 입력의 기본 높이를 180px로 확대했다. 850px 이하 모바일/좁은 화면은 기존 rows=3 및 수동 크기 조절을 유지한다. 앞선 사용자 지시에 따라 별도 프리뷰 없이 반영한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-journal-design.js`.
- 검증: Node 구문 및 Chromium 전체 브라우저 회귀 통과. 실제 메모 높이는 너비 1280/851px에서 180px, 850/360px에서 기존 76.6875px 확인.
- 배포: `8872b45` main 푸시 및 HA 디자인 모듈 1개 직접 반영 완료. 백업 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-8872b4573ee6/before`. 설치 파일 및 HTTP 200 응답이 커밋과 일치(SHA-256 `f18ce6e1bb82a684db00df3bb58c0a4c3bc1e2b6aeb86279a4b3b0046a54c3b6`). 운영 화면 확인 미실시로 사용자 새로고침 후 확인 필요. 새 태그/릴리즈 없음.

## 2026-10-25 — vehicle-journal: 수정 창 입력 드래그 시 잘못 닫히는 문제 수정

- 입력창에서 시작해 배경에서 끝난 드래그를 배경 클릭으로 오인하던 문제를 수정했다. 기본 포인터의 누르기/놓기가 모두 창 바깥이고 이동 거리가 5px 이하인 실제 배경 클릭만 창을 닫는다. 창 내부 여백 클릭과 반대 방향 드래그도 닫지 않으며 취소/닫기 시 포인터 상태를 초기화한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`.
- 검증: Node 구문 검사 및 Chromium 전체 브라우저 회귀 통과. 입력→배경 드래그의 창/입력값 유지, 배경→입력 드래그 유지, 일반 배경 클릭 닫기, 기존 저장·탭·차트·데스크톱/모바일 동작 확인.
- 배포 상태: `1574d70` main 푸시 및 HA 파일 1개 직접 반영 완료. 백업 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-1574d702266c/before`. 설치 파일 및 HA HTTP 200 응답이 커밋과 일치(SHA-256 `c3f44fa196ae8f0d659edf811141a7c7ea5bea6a73a6cacd0c650165a377a70e`). 운영 브라우저 실제 적용은 미확인으로 사용자 새로고침 후 확인 필요. HA 재시작 불필요, 새 태그/릴리즈 없음.

## 2026-10-25 — vehicle-journal: 수정 창 드래그 닫힘 원인 조사

- 영상에서 입력값 선택 후 포인터를 창 밖으로 이동해 놓을 때 수정 창이 닫히는 현상을 확인했다. 개인 입력값·사진·영상은 기록/커밋 대상에서 제외한다.
- 원인: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`의 `recordDialog.onclick`이 click target이 dialog라는 조건만으로 close를 호출한다. 입력 내부 mousedown → 창 밖 mouseup에서 Chromium이 dialog 대상 click을 생성하여 배경 클릭으로 오인한다.
- 검증: 합성 입력값과 최소 dialog를 사용하는 실제 Chromium에서 mousedown INPUT → mouseup DIALOG → click DIALOG 및 open=false 재현.
- 상태: 원인 조사만 수행. 실행 코드 수정·HA 반영·릴리즈 없음. 수정 방향은 누르기/놓기 모두 배경에서 발생한 실제 클릭만 닫기로 처리하는 것이다.

## 2026-10-25 — vehicle-journal: 추세 카드 지표 제목 간소화 및 직관적 명칭 개편

- 사용자 요청에 따라 추세 카드 제목을 간결하고 직관적으로 개편했다.
- 전기차 지표: 일일 주행거리, 일일 충전량, 충전 단가, 일일 배터리 소모, 급속 충전 비중, 100km당 충전 비용, 총 차량 지출, 총 충전 횟수, 1회 평균 충전량, 100km당 배터리 소모, [분류] 지출.
- 내연기관차 지표: 계기판 주행거리, 구간 기록 주행거리, 총 주유량, 주유 단가, 총 주유 횟수, 총 차량 지출, [분류] 지출.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`, `vehicle-journal/tests/browser-check.cjs`.
- 검증: Node.js 구문 검사 및 `vehicle-journal/tests/browser-check.cjs` Chromium 데스크톱/모바일 회귀 통과.
- 배포: `9a817f0` main 푸시 및 HA 파일 1개 직접 반영 완료, SHA-256 일치(`9aba7231...`). 백업: `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-9a817f013e2e/before`. 운영 브라우저 화면은 미확인으로 사용자 새로고침 후 확인 필요. 새 릴리즈/태그 없음.

## 2026-10-25 — vehicle-journal: 추세 지도 기본 화면 반 단계 축소

- 사용자 요청에 따라 프리뷰를 생략하고 기본 진입 및 ‘전체 보기’ 배율을 7에서 6.5로 축소했다. 중심 좌표는 유지하고 Leaflet zoomSnap을 0.5로 설정해 반 단계 배율이 적용되도록 했다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-vehicle-journal.js`.
- 검증: Node 구문 검사 및 `vehicle-journal/tests/browser-check.cjs` Chromium 데스크톱/모바일 회귀 통과.
- 배포: `947b8dc` main 푸시 및 HA 파일 1개 직접 반영 완료, SHA-256 일치. 백업: `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-947b8dc4d42a/before`. 운영 브라우저 화면은 미확인으로 사용자 새로고침 후 확인 필요. 새 릴리즈/태그 없음.

# Carrot HA 변경 기록

## 2026-10-21 — 텔레포토 화면 HA 직접 반영 및 pre-release 승인 절차 재확인

- 사용자 지시: 텔레포토 변경을 HA에 직접 반영하고 changelog에 기록한다.
  pre-release는 “올려도 된다”는 별도 승인이 있을 때까지 발행하지 않는다.
- 반영 시각: 2026-10-21 01:00 KST. 기능 원본 커밋은 `03d6f59c129439c3a79b1119ec8bb6032daa4265`.
- 배포 파일: HA의 `/config/custom_components/carrot_ha/frontend/carrot-camera-360.js` 한 개.
  교체 전 HA 파일이 기능 커밋 직전 원본과 일치함을 확인하여 별도 미발행 수정이 없음을 검증했다.
  다른 화면·manifest·사용자 데이터·DB·설정 파일은 반영하지 않았다.
- 원본 백업: `/config/carrot_ha/deployment-backups/20261021-telephoto-03d6f59/carrot-camera-360.js`.
  백업 SHA-256: `8d7177b066f41bfe01c73581784aa8cd507172c598e60d1a629f9109a2a2d2e1`.
  원본/백업 일치를 확인한 후 임시 파일 해시 검증 및 원자적 교체를 수행했다.
- 배포본 SHA-256: `ca17777c9eb856e487459fb39e111ef87ef80848cbec069b7c5ea2155d1b77cc`.
  Git 추출본·HA 설치 파일·HA HTTP `/carrot_ha_static/carrot-camera-360.js` 응답이 모두 일치했다.
  `/api/carrot_ha/frontend-version`은 `0.9.0-beta.1-34c54e5c45cc`를 반환했다.
- 적용 상태: HA 서버 파일 및 HTTP 제공 확인 완료. 화면 모듈만 교체하여 HA 재시작은
  하지 않았다. 브라우저 새로고침 후 차량 카메라 보기 → 텔레포토 원본으로 확인한다.
  실제 사용자 브라우저 적용·Comma 영상 수신·CPL 테두리 확인은 아직 미검증이다.
- 공통 지침 보완: `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`에 pre-release도
  명시적 사용자 승인 후에만 발행하며, 그때 모든 관련 changelog와 Git 이력·diff를
  대조해 직전 pre-release 이후 전체 미발행 변경을 누적한다는 절차를 명확히 기록했다.
- 릴리즈 상태: 새 태그·pre-release·정식 릴리즈 발행 없음. 기존 `v0.8.15` 철회는 유지한다.
  Comma 소스·Worker·D1 배포 없음. 앞선 항목의 HA 반영 보류 상태는 이번 사용자 지시와
  직접 반영으로 갱신되었고 릴리즈 발행 대기는 유지된다.

## 2026-10-21 — 텔레포토 개발 변경 및 잘못 발행한 정식 릴리즈 철회

- 기능 커밋: `03d6f59c129439c3a79b1119ec8bb6032daa4265`.
- 변경/이유: 차량 카메라 보기에 텔레포토 원본 선택을 추가했다. 집에서 CPL 필터
  테두리의 가림을 확인하도록 전체 화각·원본 비율을 보존하고 영상 위 HUD/PTZ를 숨긴다.
  협각은 선택 시에만 디코딩하며 광각·실내 프레임 없이 독립 재생한다.
- 관련 파일: `custom_components/carrot_ha/frontend/carrot-camera-360.js`,
  `tests/camera-360-lifecycle.test.mjs`.
- 검증: 카메라 Python 23건, 카메라 JS 테스트 8건, 대시보드 로딩/상태 보존 10건 통과.
  Chrome PC/모바일에서 합성 영상 네 모서리·비율 보존 및 전환/해제를 확인했다.
  GitHub 전체 회귀 실행 39452806063 및 릴리즈 실행 39452832887은 성공했으나,
  이는 실제 기기 확인이나 사용자 필드 테스트 통과를 의미하지 않는다.
- 배포 오류: 다른 미발행 변경을 포함하는 최신 main에 대해 전체 릴리즈 범위 검토와
  사용자 필드 테스트/정식 발행 지시 없이 `v0.8.15` 정식 릴리즈를 발행했다.
- 철회: 사용자 지시에 따라 해당 GitHub Release와 원격 태그를 삭제했다.
  Release API 404와 원격 태그 부재를 확인했다. 이 작업에서 만든 로컬 태그도 삭제한다.
  manifest를 기능 커밋 이전 값 `0.9.0-beta.1`로 원복하고 잘못 추가한 정식 노트를 제거한다.
  이는 기존 버전 표기 복구이며 새 버전이나 pre-release 발행이 아니다.
- 보존: 텔레포토 기능 커밋, 다른 미발행 변경, 기존 로컬 staged/unstaged 작업은 보존한다.
  main 강제 푸시나 전체 커밋 되돌리기는 하지 않는다.
- 정책: `AGENTS.md`에 HA SSH 개발 반영 → 준비 후 pre-release → 사용자 필드 테스트
  통과 보고와 명시적 정식 발행 지시 후 정식 릴리즈 순서를 전체 HA 작업의 최우선 규칙으로 기록했다.
- 현재 상태: 텔레포토 기능은 Git에만 게시되어 있으며 이 세션에서 HA SSH 반영은 하지 않았다.
  사용자의 추가 보류 지시에 따라 새 pre-release·정식 릴리즈·HA 직접 배포를 진행하지 않는다.
  실제 Comma/CPL 확인은 미검증이다. Comma 소스·Worker·D1 배포는 없다.

## 2026-10-27 — 현재 직접 연결 경로 문서 정리를 위한 코드 조사

- 목적: 폐기된 Cloudflare 중계 설명과 현재 연결을 구분하기 위해 HA 통합·독립 수신기 코드를 읽기 전용으로 대조했다.
- 확인: 상태/일반 주행/파라미터/터미널 bootstrap은 자체 수신기, 터미널·카메라·영상/rlog는 HA Core 경로다. receiver_url이 있으면 해당 주소를 선택하며 실패에 따른 Cloudflare 주소 자동 전환은 없다. cloud_* 파일명·옵션은 현재 수신기 구현과 과거 호환 코드에 함께 남아 있다.
- 관련 파일: addons/carrot_receiver/{receiver.py,config.yaml,DOCS.md}, custom_components/carrot_ha/{cloud.py,cloud_live.py,terminal_bootstrap.py,terminal_http.py,camera_http.py,__init__.py,config_flow.py}, driving_logs/http.py, docs/CLEAN_INSTALL_RECOVERY.md.
- 검증/한계: 로컬 HEAD 3527e6b의 코드·설치 문서 대조. git pull은 FETCH_HEAD 권한 오류로 실패. 지정된 로컬 openpilot 경로가 없어 차량 실행 코드 대조 및 운영 HA/Comma 연결 상태 확인은 하지 못했다.
- 배포 상태: 조사 기록만 추가. 실행 코드·운영 설정·문서 본문 변경, 배포·재시작·태그·릴리즈 없음. 기존 사용자 작업은 유지했다.
- 원격 준비: Comma `5ec4868a12a9038547b373eb95be3a5fa86d30aa`를 carrot-wip-model_selector-ha에 푸시하고 ls-remote 일치 확인. HA CI companion pin을 이 커밋으로 갱신했다. HA 직접 반영 후 사용자 재시작 전까지는 새 Python 정책이 활성화되지 않는다.

## 2026-10-30 — 전송 토글 직접 반영 완료·사용자 재시작 대기

- HA 실행 커밋24d8d9001b90e7aff418afbddb75b5a465d2e0d8 main 푸시. Actions40976946905 전체 success 확인: https://github.com/helico717/carrot-ha/actions/runs/40976946905 . Comma 원격5ec4868a12a9038547b373eb95be3a5fa86d30aa 확인.
- HA 실행4파일을 기존 경로로 직접 반영하고 SHA-256 전부 일치, Python3 compile() 메모리 검사 통과. 백업 /config/carrot_ha/deployment-backups/driving-logs-hud-24d8d9001b90/before 및 상위 DEPLOYMENT.json에 실제 이전 해시·대상 해시·커밋 기록. http.py preflight 차이는 CRLF445개뿐이며 정규화SHA0b921103…가 기준과 일치함을 확인. 배포 도구는 CRLF만 정규화한 기준 해시 일치도 허용하도록 보강했다. 다른 내용 변경은 계속 거부한다.
- 정책 파일은 아직0개이며 새 코드 활성 시 기본OFF. HA Core 재시작·Comma Git Pull/재부팅·실차ON/OFF 검증은 사용자 단계로 남아 있다. 에이전트는 재시작하지 않았고 기존 원본 로그/보관 데이터/원시CAN 설정을 변경하지 않았다. 새 태그·버전·Release 없음.
## 2026-10-30 — 정식 0.9.0 적합성 및 운영 전송 차단 재검증

- 사용자 요청으로 HA 운영 상태를 읽기 전용 확인. 10:10 KST 차량 state API 200, transfer.enabled=false, complete 0, floor 0. 인증된 begin/commit 빈 요청 및 가상 경로 chunk 요청 모두 403 `Driving log transfer disabled or expired`. 설정·재시작·기기 변경 없음. 앞선 구버전 API 잔존 미확인 상태는 이번 실응답으로 해소됐다. ON 전송·실제 Comma 적용은 별도 검증이다.
- Carrot HA 엔트리 loaded/disabled_by=null, 전송 스위치 off. 조회한 최근 Core 로그 100줄에 Carrot 경고/오류 0건. 전체 과거 로그의 무오류를 뜻하지 않는다. 사용자 현재 불만 없음은 실사용 수용 근거로 반영한다.
- Git HEAD b69da6c 기준 통합 파일 322개 대조: 317개 SHA-256 일치, 3개 줄바꿈만 차이, 기본 vehicle.glb 1개 미설치, carrot-vehicle-3d.js 1개 실질 차이. HA 기본 URL은 /carrot_ha_models/vehicle.glb(200), Git은 패키지 모델. 두 모델 해시도 다름. 현재 HA 그대로와 main 발행본은 3D 기본 모델에서 동일하지 않으므로 발행 전 범위를 맞추거나 의도한 차이를 확인해야 한다. 운영 파일 덮어쓰기 없음.
- 최신 실행 코드 9244a4a의 Direct receiver validation 40982887630 success 확인. 현재 manifest 0.9.0-beta.1 유지. 정식 발행 후보로 판단하되 모델 차이 정리·0.9.0 메타데이터/누적 노트 준비는 남음. 버전·태그·Release 발행 없음.

## 2026-10-30 — 패키지 3D 모델과 실제 HA 모델의 내부 일치 검증

- 사용자 요청으로 Git HEAD의 패키지 GLB와 HA `/config/carrot_ha/models/vehicle.glb`, 실제 HTTP `/carrot_ha_models/vehicle.glb`를 읽기 전용 비교. HA 디스크와 HTTP SHA-256 동일(1f3c5488…); 패키지는 61914d35…로 원본 파일 자체는 다르다.
- GLB 바이너리 청크 완전 동일. meshes 135개·nodes 314개·animations 5개·images/textures 각 36개 및 accessors/bufferViews/scenes/extensions 모두 동일. 차이는 재질 45개 중 도장·주황 반사판·유리 2종 총 4개뿐이다.
- 현재 viewer가 실행 중 적용하는 기본 색·도장·유리·반사판 값을 패키지에 미리 저장한 차이임을 기존 viewer 코드와 bake_ha_materials.py로 대조. HA 원본에 bake()를 메모리에서 적용한 결과 2,023,352B 및 SHA-256 61914d356a99a9c6a82e8f303049ce6af0ecdd8411c879b33bb1b1d7983dc7f7로 Git 패키지와 완전 일치했다. 운영 파일·설정 쓰기 없음.
- 판단 정정: 앞선 해시 차이는 다른 형상의 모델이라는 근거가 아니다. 같은 형상/텍스처/애니메이션에 HA 기본 재질을 내장한 모델이다. 현재 viewer의 동일 설정에서 외관을 바꾸는 차이는 확인되지 않았고 모델 해시 차이만으로 정식 발행을 보류할 필요는 없다. 사용자 브라우저 IndexedDB/실제 렌더 픽셀 비교는 수행하지 않았으므로 화면 픽셀 완전 일치를 주장하지 않는다. 버전·태그·릴리즈·배포 없음.

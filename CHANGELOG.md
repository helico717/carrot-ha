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

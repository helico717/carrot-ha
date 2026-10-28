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
- 검증·배포: `py_compile` 통과. 자동 기록 사진 업로드 실동작은 미검증. 커밋·푸시 후 HA SSH 직접 반영과 사용자 HA 재시작(Python 변경) 필요하며 현재 HA 미반영.

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

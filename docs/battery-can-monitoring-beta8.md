# 배터리 CAN 엔터티 — 0.8.12-beta.8

## 추가 엔터티와 의미

| key | 이름 | 단위·상태 |
|---|---|---|
| battery_charge_temperature_status | 충전 온도 상태 | 적정 미만 / 적정 / 적정 초과 |
| battery_min_temperature_c | 배터리 최저 온도 | °C |
| battery_max_temperature_c | 배터리 최고 온도 | °C |
| battery_cell_min_voltage_v | 셀 최저 전압 | V, 소수점3자리 |
| battery_cell_max_voltage_v | 셀 최고 전압 | V, 소수점3자리 |
| battery_cell_voltage_delta_mv | 셀 전압 차이 | mV |

CAN 수신 당시 차량이 보고한 팩 내부 측정 지점의 최저·최고다. 세션/하루의 기록 최저·최고가 아니다.
전압 차이는 같은0x16A954A6 프레임의 셀 최고−최저이며, 개별 셀 위치나 SOH를 표시하지 않는다.
온도 상태는0x1A5555B2의 DBC 정의로 표시한다. 초기화·오류·예약 코드는 알 수 없음이다.

180초 내의 유효값은 바로 표시한다. 실차 검증 전이라는 이유로 unverified로 막지 않는다.
각 엔터티 속성에 출처, CAN ID, CAN 수신 시각, 경과 시간, stale, 180초 상한과
검증 범위를 제공한다. 마지막 수신 후180초 초과 시 현재값은 알 수 없음으로 표시한다.
기존 기록은 HA history에 남으며, 정상 수치 엔터티는 measurement 통계를 제공한다.
차량 내부 센서의 측정·필터링 주기까지 검증한 것은 아니다.

## 수집과 배포

- 기존4초 수신/26초 대기 sampling 경로에서 두 ID만 추가 해독한다. bus0/1 수신만 사용한다.
- logMonoTime packet 수신 시각을 boot clock anchor로 UTC에 변환한다. Engine 업로드 시각으로
  바꾸거나 미수신값의 시각을 갱신하지 않는다. 오래된/미래/역행 샘플은 받아들이지 않는다.
- CRC/카운터 연속성 검증, OBD 독립 비교와 실차 AC 검증은 남아 있다.
- 원시 CAN 수집/20GB 정책, 충전 판정, SOC와 충전 전력 계산은 변경하지 않는다.
- Worker/D1 변경 없음. 추가 대시보드 배치는 포함하지 않는다.
- Comma 원격 브랜치 업데이트와 재부팅, HACS beta.8 설치와 HA 재시작이 모두 필요하다.
  구형 수집기는 새 값을 보내지 않으므로 HA 엔터티만 생기고 알 수 없음으로 표시된다.

## 검증

- 기록된 전체 후보94,641프레임을 새 실행 디코더로 재생했다.
  팩 온도/셀 값67,604프레임 중 초기화33개 제외, 온도 상태27,037프레임 중 초기화11개 제외.
  최저23~33°C/최고25.5~35°C, 셀 최저3.374~3.951V/최고3.390~3.958V,
  동일 프레임 차이4~19mV. 적정 미만10,212건/적정16,814건.
- 새로운 decoder·오류/초기화·같은 프레임의 차이·Engine timestamp/역행 거절/저장 검사3개 통과.
- HA 전체288개 검사 통과(의존성 부족4개 skip 포함), 새 엔터티 표시·freshness·속성 검사 포함.
- Comma 전체84개 중82개 통과. 기존 카메라 검사2개 실패:
  누락된 protocol.encode_media, PyAV remux compatibility 예상과 실제 불일치.
  관련 카메라 소스/테스트는 이번 변경에 포함되지 않는다. 실제 기기 장애 근거가 아니다.
- dashboard live/lazy/view와 Worker incremental 11개 검사, sync benchmark 통과.
- 실기 설치 후 엔터티 수신·Recorder의 실제 장기 기록은 아직 확인하지 않았다.

분석 근거: [전체 CAN 재검수](raw-can-full-audit-2026-10-05.md).

## 배포 커밋

Comma 브랜치 `carrot-wip-model_selector-ha`: `62d4da12`. HA 릴리즈 `v0.8.12-beta.8`.

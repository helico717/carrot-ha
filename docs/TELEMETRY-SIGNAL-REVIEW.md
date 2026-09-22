# ID.4 추가 수집 신호 검토 (2026-09-22)

검토 대상: 센서 추가 커밋 `7c65866`, 로컬 openpilot의
`opendbc_repo/opendbc/dbc/vw_meb.dbc`, Volkswagen `carstate.py`, cereal `log.capnp` 및 hardwared.
DBC에 정의된 신호를 해석할 수 있다는 것과 해당 차량/하네스/주차 상태에서 수신된다는 것은 다르다.
이번 변경은 실차 수신·성능 검증 완료를 의미하지 않는다.

| 요청 | 구현/판정 | 의미 및 제약 |
|---|---|---|
| 도어 4개, 트렁크 | `ZV_02.ZV_FT/BT/HFS/HBFS/HD_offen` 수신 | 운전석/조수석 및 각 뒤 도어, 트렁크. 미수신은 미확인 |
| 도어 잠금 | `ZV_verriegelt_extern_ist`, `ZV_verriegelt_intern_ist` 분리 | 실제 상태 비트, 요청(soll) 비트 미사용. true=잠김; 제어 기능 없는 binary_sensor |
| 후드 열림 | 보류 | Airbag_01의 AB_Anzeige_Fussg는 보행자 보호 표시, DWA_Alarmquelle는 경보 원인. 현재 후드 접점과 동등하지 않음 |
| 하드웨어 충전 모드 | `BMS_04.BMS_IstModus` | 0 HV 비활성, 1 주행 HV 활성, 2 balancing, 3 외부 충전, 4 AC 충전, 5 배터리 오류, 6 DC 충전, 7 미확인. 기존 충전량/ETA 판정을 덮어쓰지 않음 |
| 플러그 체결 | 보류 | WBA_GE_Texte_02=2는 '충전 플러그 연결' 표시 문구. 다른 문구나 0을 뽑힘으로 해석할 수 없음 |
| 차량 충전 목표 | `bms_target_soc_percent` (BMS 목표 SOC 신호) | BMS_Soll_SOC_HiRes를 0~100%로 수집. 차량 UI 충전 상한과 동일한지 미검증. ETA 목표로 사용하지 않음. raw 2046/2047 제외 |
| DC-DC/배터리 온도 | DC-DC 온도만 구현 | DCDC_03.DC_Temperatur는 컨버터 온도. 배터리 팩 온도가 아님. raw 254/255 제외 |
| 조명/등화 | Licht_Anf_01의 하향/상향/미등/DRL/전후 안개등/후진등 요청 | 실제 전구 점등 확인이나 고장 여부가 아님 |
| 콤마 헬스 | deviceState | CPU/GPU 최고 온도, CPU 평균 사용률, 메모리 사용률, 저장공간 잔여율, 발열 상태, 네트워크 종류/신호 단계, 팬 목표 출력 |

팬은 `fanSpeedPercentDesired`이며 실제 회전수(RPM)가 아니다.
CPU/GPU 빈 배열은 온도 0도로 만들지 않는다. 수신 후 180초가 지난 항목은 미확인이다.
센서별 측정 시각을 보존하므로 새로운 배터리/기기 측정이 오래된 도어 상태를 갱신하지 않는다.
구형 collector에서는 새 엔터티가 미확인인 것이 정상이다.

## 전비 수정

`month_efficiency_kpl` 고유 ID는 호환성을 위해 유지하지만 km/kWh이다.
충전량을 분모로 쓰던 오류를 제거하고, 같은 트립들의 거리/순 배터리 소비량을 합산한다.
완결·1km 이상·5분 이상 트립, 출발/도착 안쪽 Wh 측정(각 경계 90초 이내,
양쪽 누락 시간 합이 전체의 10% 이하)만 포함한다. SOC 환산은 사용하지 않는다.
충전/오래된 상태가 섞인 트립은 제외한다. 회생에 의한 음의 소비도 합산한다.
이것은 경계 샘플 기반 추정이며 정밀 전력 적산값은 아니다.
`month_drive_energy_kwh`, `month_energy_coverage_percent`로 집계량/범위를 확인한다.
추정 주행가능거리는 20km 이상·거리 커버리지 80% 이상에서만 계산하며 임의의 5.5 기본값은 없다.
기존 HA 과거 통계는 변경하지 않으며, 이미 삭제된 원본 배터리 기록은 소급 복원할 수 없다.

## 설치와 검증

HA에는 `custom_components/carrot_ha` 변경 전체(새 `telemetry.py` 포함)를 설치하고 통합을 다시 로드한다.
콤마에는 아래 파일을 **함께** 갱신해야 한다. 기존 두 파일만 복사하는 업데이트 절차로는 부족하다.

- `collector/collector.py`
- `collector/engine.py`
- `collector/wayon_vehicle_telemetry.py`
- `collector/telemetry_fields.py` (신규)

주차/offroad에서 기존 collector를 중지한 뒤 네 파일을 백업·교체하고 재시작한다.
연결 설정/SQLite 상태 파일은 보존한다. openpilot의 제어 코드, Params, CAN 송신 경로는 변경하지 않는다.
새 optional CAN 메시지가 구형 DBC에 없으면 그 메시지만 제외한다.
기존 약 30초 CAN 샘플 주기/4초 수신 창 및 30초(주행)/60초(주차) 전송 주기를 유지한다.
deviceState는 10초마다 필요한 값만 추출한다. 기존 supervisor의 nice 15를 유지한다.
HA 폴링 지연도 있으므로 실시간 경보 장치로 해석하지 않는다.

실차 확인: 각 문/트렁크와 내부/외부 잠금을 따로 조작해 대응 확인,
차량 충전 목표를 80/90%로 바꿔 BMS 목표와 비교, AC/DC 모드 확인,
등화별 요청 확인, 기기 연결이 끊긴 후 180초 경과 시 미확인 전환 확인.
배터리/기존 충전 수집 지속 여부와 적용 전후 CPU/메모리/제어 지연도 비교한다.
후드·플러그는 별도 CAN 로그에서 상시 접점 신호를 확인하기 전까지 추가하지 않는다.

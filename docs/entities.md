# Carrot HA 엔티티 전체 레퍼런스 가이드

이 문서는 **Carrot HA (당근 Home Assistant 통합구성요소)**가 폭스바겐 ID.4 및 지원 전기차(EV)와 Comma 4 장치로부터 수집하여 Home Assistant(HA)에 등록하는 모든 엔티티의 상세 구조, 속성(Attributes), 데이터 출처 및 자동화 활용법을 설명합니다.

---

## 1. 아키텍처 및 엔티티 네이밍 규칙

### A. 엔티티 ID 생성 방식
Carrot HA의 엔티티는 기기 식별자(`device_id`) 또는 사용자가 설정한 통합구성요소 이름을 기반으로 고유한 `unique_id`와 `entity_id`를 가집니다.
- **센서 (`sensor`)**: `sensor.<vehicle_name>_<sensor_key>` (예: `sensor.id_4_soc_percent`, `sensor.id_4_last_trip`)
- **이진 센서 (`binary_sensor`)**: `binary_sensor.<vehicle_name>_<key>` (예: `binary_sensor.id_4_charging`, `binary_sensor.id_4_emergency_charging`)
- **위치 추적 (`device_tracker`)**: `device_tracker.<vehicle_name>_<key>` (예: `device_tracker.id_4_vehicle_position`)

### B. 데이터 수집 및 Free-Plan 성능 계약 (Zero Query Amplification)
- **차량 CAN 버스**: 주행/충전 중 Comma 4의 오픈파일럿/당근파일럿 데몬(`openpilot/selfdrive/carrot/ha/`)이 차량 CAN 텔레메트리를 고속 수집합니다.
- **클라우드 릴레이**: Cloudflare Worker 및 D1 데이터베이스에 증분 동기화(Incremental Sync)로 안전하게 적재됩니다.
- **HA 로컬 코디네이터**: Home Assistant는 백그라운드 코디네이터를 통해 로컬 SQLite DB 및 인메모리 런타임에 데이터를 유지합니다.
- **단일 소스 소비**: 새로 추가된 복합 요약 센서(`last_trip`, `charging_session`, `today_summary` 등)를 포함한 모든 엔티티는 **로컬 코디네이터 메모리에서 직접 데이터를 구독**하므로, 클라우드 API를 추가로 호출하지 않아 Cloudflare Worker 무료 플랜 한도를 완벽하게 보호합니다.

---

## 2. 신규 복합 센서 (Composite Sensors)

서드파티 EV 대시보드 카드(예: Vehicle Card, Minimalist UI)와 편리한 Home Assistant 자동화를 지원하기 위해 추가된 고기능 복합 센서입니다.

### 1) 최근 주행 결과 센서 (`sensor.<vehicle>_last_trip`)
가장 최근에 완료된 1회의 트립(주행) 요약 정보를 종합 제공합니다.

| 속성 | 내용 |
| :--- | :--- |
| **엔티티 ID** | `sensor.<vehicle>_last_trip` |
| **친화적 이름** | 최근 주행 결과 |
| **기본 상태값 (State)** | 최근 주행 거리 (단위: `km`, 소수점 2자리, 예: `15.42`) |
| **상태 클래스** | `measurement` |
| **장치 클래스** | `distance` |
| **아이콘** | `mdi:map-marker-distance` |

#### 📋 추가 속성 (`extra_state_attributes`)
| 속성명 (Key) | 데이터 타입 | 설명 및 단위 | 예시 값 |
| :--- | :--- | :--- | :--- |
| `distance_km` | float | 주행 거리 (`km`) | `15.42` |
| `duration_s` | int | 주행 시간 (`초`) | `1440` |
| `duration_minutes` | float | 주행 시간 (`분`, 소수점 1자리) | `24.0` |
| `efficiency_kpl` | float | 구간 평균 전비 (`km/kWh`) | `5.4` |
| `energy_kwh` | float | 주행 중 소모한 총 배터리 에너지 (`kWh`) | `2.85` |
| `start_soc` | float | 주행 시작 시점 배터리 잔량 (`%`) | `82.0` |
| `end_soc` | float | 주행 종료 시점 배터리 잔량 (`%`) | `77.0` |
| `consumed_soc` | float | 주행 중 소모된 배터리 잔량 (`%p`) | `5.0` |
| `avg_speed_kph` | float | 구간 평균 속도 (`km/h`) | `38.5` |
| `max_speed_kph` | float | 구간 최고 속도 (`km/h`) | `85.0` |
| `ended_at` | string (ISO) | 주행 종료 시각 (UTC 타임스탬프) | `"2026-10-01T14:44:00Z"` |

---

### 2) 충전 세션 센서 (`sensor.<vehicle>_charging_session`)
현재 진행 중이거나 최근에 완료된 충전 세션의 상태, 충전량, 실시간 요금, 충전기 종류 및 예상 완료 시간을 종합 제공합니다.

| 속성 | 내용 |
| :--- | :--- |
| **엔티티 ID** | `sensor.<vehicle>_charging_session` |
| **친화적 이름** | 충전 세션 |
| **기본 상태값 (State)** | 현재 충전 세션 진행 상태: <br>• `charging`: 정상 충전 중<br>• `emergency`: 비상 충전(1.5kW 이하 저속 제한/접촉 불량) 감지<br>• `disconnected`: 충전기 미연결 |
| **아이콘** | `mdi:ev-station` (충전 중) / `mdi:power-plug-off` (비충전/경고) |

#### 📋 추가 속성 (`extra_state_attributes`)
| 속성명 (Key) | 데이터 타입 | 설명 및 단위 | 예시 값 |
| :--- | :--- | :--- | :--- |
| `charging` | boolean | 충전 진행 여부 | `true` |
| `session_charge_kwh` | float | 이번 세션 누적 충전량 (`kWh`) | `18.2` |
| `session_charge_cost` | int | 이번 세션 추정 충전 요금 (`KRW`, 원) | `5820` |
| `unit_price_krw` | int | 적용된 전력 단가 (완속 `280`, 급속 `320` 원/kWh) | `320` |
| `charger_type` | string | 충전기 종류: `DC_FAST` (급속) / `AC_SLOW` (완속) | `"DC_FAST"` |
| `power_kw` | float | 실시간 충전 전력 (`kW`) | `65.4` |
| `start_soc` | float | 충전 시작 시 배터리 잔량 (`%`) | `25.0` |
| `current_soc` | float | 현재 배터리 잔량 (`%`) | `65.0` |
| `added_soc` | float | 충전으로 상승한 배터리 잔량 (`%p`) | `40.0` |
| `time_to_80_s` | int | 80% 충전까지 남은 시간 (`초`) | `900` |
| `eta_80` | string (ISO) | 80% 충전 완료 예정 시각 | `"2026-10-01T16:45:00Z"` |
| `time_to_100_s` | int | 100% 완충까지 남은 시간 (`초`) | `2400` |
| `eta_100` | string (ISO) | 100% 완충 완료 예정 시각 | `"2026-10-01T17:10:00Z"` |

---

### 3) 오늘의 주행 요약 센서 (`sensor.<vehicle>_today_summary`)
오늘 하루(당일 자정 00:00 이후) 동안 차량이 주행한 누적 결과를 실시간 집계합니다.

| 속성 | 내용 |
| :--- | :--- |
| **엔티티 ID** | `sensor.<vehicle>_today_summary` |
| **친화적 이름** | 오늘의 주행 요약 |
| **기본 상태값 (State)** | 오늘 총 주행 거리 (단위: `km`, 소수점 2자리, 예: `45.20`) |
| **상태 클래스** | `measurement` |
| **장치 클래스** | `distance` |
| **아이콘** | `mdi:calendar-today` |

#### 📋 추가 속성 (`extra_state_attributes`)
| 속성명 (Key) | 데이터 타입 | 설명 및 단위 | 예시 값 |
| :--- | :--- | :--- | :--- |
| `today_trip_count` | int | 오늘 운행한 총 트립(주행) 횟수 | `3` |
| `today_distance_km` | float | 오늘 하루 총 주행 거리 (`km`) | `45.2` |
| `today_energy_kwh` | float | 오늘 주행에 소모된 배터리 총 전력량 (`kWh`) | `7.8` |
| `today_efficiency_kpl` | float | 오늘 하루 통합 평균 전비 (`km/kWh`) | `5.8` |

---

## 3. 기본 센서 목록 (`sensor`)

### A. 차량 파워트레인 및 주행 센서
| 엔티티 키 | 센서 이름 | 단위 | 분류 | 설명 |
| :--- | :--- | :---: | :---: | :--- |
| `soc_percent` | 배터리 잔량 | `%` | `battery` | 에너지 기반 캘리브레이션 SOC. 실제 BMS 잔여 에너지(`Wh`)를 ID.4 가용 넷 용량(`77kWh`) 기준으로 정밀 보정하여 표시 |
| `range_km` | 주행가능거리 (추정) | `km` | `distance` | 최근 주행 전비(최근 5회 트립 가중치)를 반영한 동적 주행가능거리 추정치 |
| `odometer_km` | 총 주행거리 | `km` | `distance` | 차량 계기판 상의 실제 총 누적 주행거리 |
| `speed_kph` | 현재 속도 | `km/h` | `speed` | 실시간 차량 주행 속도 (GPS 및 CAN 휠 스피드 결합) |
| `gear` | 현재 기어 | - | - | 현재 변속 기어 단수 (`P`, `D`, `R`, `N`, `S`, `B` 등 표시, CAN 원본 `raw_gear` 속성 제공) |
| `battery_kwh` | 배터리 저장 에너지 | `kWh` | `energy` | 폭스바겐 ID.4 BMS가 측정한 현재 고전압 배터리 팩 가용 잔여 전력량 |
| `hv_voltage` | 고전압 배터리 전압 | `V` | `voltage` | ID.4 400V 고전압 트랙션 배터리 팩의 실시간 전압 |
| `aux_voltage` | 12V 배터리 전압 | `V` | `voltage` | 보조 12V 납산/AGM 배터리 전압 (차량 시동 꺼짐 중 방전 모니터링 가능) |
| `outside_temp_c` | 외기 온도 | `°C` | `temperature` | 차량 외부 범퍼 온도 센서가 측정한 외부 기온 |
| `bearing_deg` | 진행 방향 | `°` | - | 차량의 주행 헤딩 방향 각도 (0°~359°, 북: 0°, 동: 90°) |
| `gps_accuracy_m` | GPS 정확도 | `m` | `distance` | Comma 기기 GPS 수신 신호 수평 오차 반경 |

### B. 공조 및 편의 장치 센서
| 엔티티 키 | 센서 이름 | 단위 | 분류 | 설명 |
| :--- | :--- | :---: | :---: | :--- |
| `blower_level` | 송풍 단계 | - | - | 차량 에어컨/히터 블로어 풍량 단계 (0단계 ~ 최대 단계) |
| `blower_volt` | 송풍 제어 전압 | `V` | `voltage` | 블로어 팬 모터에 인가되는 실제 제어 전압 |
| `seat_heat_left` | 운전석 열선 단계 | - | - | 운전석 시트 열선 강도 단계 (0: 꺼짐, 1~3단계) |
| `seat_heat_right` | 조수석 열선 단계 | - | - | 조수석 시트 열선 강도 단계 (0: 꺼짐, 1~3단계) |
| `recirc` | 내기순환 신호 | - | - | 차량 공조 장치의 내기 순환 플랩 열림/닫힘 상태 |

### C. 충전 모니터링 센서
| 엔티티 키 | 센서 이름 | 단위 | 분류 | 설명 |
| :--- | :--- | :---: | :---: | :--- |
| `charge_power_w` | 충전 전력 (추정) | `kW` | `power` | 실시간 완속/급속 충전 전력. ID.4 BMS 양자화 노이즈를 방지하기 위해 Bounded Hold 알고리즘 적용 |
| `time_to_80_s` | 80% 충전 남은시간 | `s` | `duration` | ID.4 비선형 충전 프로파일 곡선을 기반으로 80% 목표 도달까지 남은 시간 |
| `eta_80` | 80% 충전 완료시각 | - | `timestamp` | 80% 도달 목표 시각의 ISO 타임스탬프 |
| `time_to_100_s` | 100% 충전 남은시간 | `s` | `duration` | 80% 이후 완속 충전 테이퍼링(감속) 구간을 반영한 완충 남은 시간 |
| `eta_100` | 100% 충전 완료시각 | - | `timestamp` | 100% 완충 도달 목표 시각의 ISO 타임스탬프 |

### D. 월간 통계 및 이력 센서
| 엔티티 키 | 센서 이름 | 단위 | 상태 클래스 | 설명 |
| :--- | :--- | :---: | :---: | :--- |
| `month_distance_km` | 이번 달 주행거리 | `km` | `measurement` | 이번 달 1일 00:00부터 누적된 총 주행 거리 |
| `month_trip_count` | 이번 달 주행 횟수 | - | `measurement` | 이번 달에 완료된 총 주행 세션 수 |
| `month_efficiency_kpl` | 이번 달 주행 전비 | `km/kWh` | `measurement` | 이번 달 주행 거리와 실소모 배터리 에너지를 매칭한 실질 평균 전비 |
| `month_charge_kwh` | 이번 달 충전량 (추정) | `kWh` | `total_increasing` | 이번 달 동안 충전된 총 배터리 전력량 합계 |
| `month_slow_kwh` | 이번 달 완속 분류 충전량 | `kWh` | `total_increasing` | 11kW 이하 완속(AC) 충전기로 충전된 월간 전력량 |
| `month_fast_kwh` | 이번 달 급속 분류 충전량 | `kWh` | `total_increasing` | 11kW 초과 급속(DC) 충전기로 충전된 월간 전력량 |
| `month_charge_cost` | 이번 달 충전요금 (추정) | `KRW` | `measurement` | 완속 280원, 급속 320원 표준 단가를 적용한 월간 누적 추정 전기 요금 |
| `recorded_distance_km` | 기록된 누적 거리 | `km` | `measurement` | Carrot HA 로컬 데이터베이스에 보존된 전체 기간 주행 거리 합계 |
| `trip_count` | 저장된 주행 횟수 | - | `measurement` | Carrot HA 로컬 데이터베이스에 저장된 전체 트립 개수 |

### E. Comma 4 하드웨어 모니터링 센서 (진단 카테고리)
| 엔티티 키 | 센서 이름 | 단위 | 설명 |
| :--- | :--- | :---: | :--- |
| `comma_cpu_temperature_c` | 콤마 CPU 최고 온도 | `°C` | Comma 4 메인 프로세서의 최고 코어 온도 |
| `comma_gpu_temperature_c` | 콤마 GPU 최고 온도 | `°C` | Comma 4 GPU 온도 |
| `comma_cpu_usage_percent` | 콤마 CPU 평균 사용률 | `%` | Comma 4 전체 코어의 평균 연산 부하율 |
| `comma_memory_usage_percent` | 콤마 메모리 사용률 | `%` | Comma 4 시스템 RAM 메모리 점유율 |
| `comma_storage_free_percent` | 콤마 저장공간 잔여율 | `%` | Comma 4 eMMC/NVMe 드라이브의 남은 스토리지 비율 |
| `comma_fan_requested_percent` | 콤마 팬 목표 출력 | `%` | 발열 해소를 위해 기기가 자체 제어하는 내부 쿨링팬 RPM 듀티비 |
| `comma_thermal_status` | 콤마 발열 상태 | - | 기기 발열 단계 (`green`, `yellow`, `red`, `danger`) |
| `comma_network_type` | 콤마 네트워크 종류 | - | 기기 인터넷 연결 방식 (`wifi`, `cell`, `ethernet`, `none`) |
| `comma_network_strength` | 콤마 네트워크 신호 단계 | - | 셀룰러(LTE) 또는 Wi-Fi 통신 신호 세기 (안테나 수신 감도) |

### F. 시스템 연결 및 진단 센서
| 엔티티 키 | 센서 이름 | 단위 | 설명 |
| :--- | :--- | :---: | :--- |
| `cloud_status` | 클라우드 연결 상태 | - | Cloudflare 릴레이 상태 (`online`, `idle`, `offline`, `not_configured`) |
| `last_sync` | HA 동기화 시각 | `timestamp` | Home Assistant가 클라우드로부터 마지막 데이터를 성공적으로 동기화한 시각 |
| `measured_at` | 차량 측정 시각 | `timestamp` | 차량 CAN 버스에서 실제 데이터가 측정된 UTC 시각 |
| `measurement_age_s` | 차량 데이터 경과시간 | `s` | 마지막 차량 측정 이후 경과된 시간 (차량이 슬립 중인지 판단에 사용) |
| `parking_at` | 주차 위치 기록 시각 | `timestamp` | 차량이 마지막으로 기어를 P에 넣고 주차한 시각 |
| `dcdc_temperature_c` | DC-DC 컨버터 온도 | `°C` | ID.4 고전압-12V 저전압 변환 온보드 DC-DC 컨버터의 내부 온도 |
| `soc_capacity_kwh` | SOC 계산 용량 | `kWh` | 사용자가 옵션에서 설정한 배터리 유효 용량 (기본값: 77.0kWh / 64.0kWh) |

---

## 4. 이진 센서 목록 (`binary_sensor`)

차량의 각종 플래그, 안전 상태, 보안 및 통신 상태를 `on` / `off` 형태로 제공합니다.

| 엔티티 ID | 엔티티 이름 | 장치 클래스 | On 상태 조건 / 의미 |
| :--- | :--- | :---: | :--- |
| `binary_sensor.<vehicle>_onroad` | 주행 모드 | `running` | 차량 시동이 켜져 있고 주행 상태(기어 D/R/B 등)일 때 `on`, 주차 중일 때 `off` |
| `binary_sensor.<vehicle>_charging` | 충전 중 (추정) | `battery_charging` | 차량이 완속 또는 급속 충전기에 연결되어 전력을 공급받고 있을 때 `on` |
| `binary_sensor.<vehicle>_emergency_charging` | 비상 충전 모드 (추정) | `problem` | **(ID.4 특화 경고)** 완속 충전기 결착 불량으로 인해 충전 전력이 1.5kW 이하로 5분(300초) 이상 지속될 때 `on`. 재결착 유도 알림에 필수 사용 |
| `binary_sensor.<vehicle>_ac_on` | 에어컨 작동 | `cold` | 차량 공조 장치(블로어 및 에어컨 압축기)가 동작 중일 때 `on` |
| `binary_sensor.<vehicle>_enabled` | 주행 보조 활성 | - | 오픈파일럿/당근파일럿 조향 및 가감속 자동 주행 보조가 활성화되어 있을 때 `on` |
| `binary_sensor.<vehicle>_stale` | 차량 데이터 오래됨 | `problem` | 차량이 주차 후 슬립 모드에 들어가 180초 이상 새로운 CAN 신호가 없을 때 `on` |
| `binary_sensor.<vehicle>_doors_locked` | 차량 잠김 상태 | `lock` | 4개 도어 및 트렁크가 모두 외부/내부적으로 잠겨 있을 때 `on` (열려 있거나 해제 시 `off`) |
| `binary_sensor.<vehicle>_door_driver_open` | 운전석 도어 열림 | `door` | 운전석(좌측 전방) 도어가 열려 있을 때 `on` |
| `binary_sensor.<vehicle>_door_passenger_open` | 조수석 도어 열림 | `door` | 조수석(우측 전방) 도어가 열려 있을 때 `on` |
| `binary_sensor.<vehicle>_door_rear_driver_open` | 운전석 뒤 도어 열림 | `door` | 2열 좌측 도어가 열려 있을 때 `on` |
| `binary_sensor.<vehicle>_door_rear_passenger_open` | 조수석 뒤 도어 열림 | `door` | 2열 우측 도어가 열려 있을 때 `on` |
| `binary_sensor.<vehicle>_trunk_open` | 트렁크 열림 | `opening` | 트렁크(테일게이트)가 열려 있을 때 `on` |
| `binary_sensor.<vehicle>_comma_online` | 콤마 연결 상태 | `connectivity` | Comma 4 장치가 온라인 상태로 HA와 웹소켓/클라우드 통신 중일 때 `on` |

---

## 5. 위치 추적기 (`device_tracker`)

| 엔티티 ID | 엔티티 이름 | 소스 타입 | 설명 |
| :--- | :--- | :---: | :--- |
| `device_tracker.<vehicle>_vehicle_position` | 차량 위치 | `gps` | 주행 중 실시간 GPS 위도/경도 좌표. 차량 이동 중 실시간 지도 트래킹에 사용 |
| `device_tracker.<vehicle>_parking_position` | 주차 위치 | `gps` | 차량 주행이 끝나고 기어를 P로 전환한 순간의 최종 고정 좌표. 넓은 주차장에서 내 차 찾기나 주차 구역 자동화에 사용 |

---

## 6. 서비스 (`Service`)

### `carrot_ha.purge_database`
오래된 로컬 텔레메트리 히스토리를 정리하고 SQLite 데이터베이스를 압축(`VACUUM`)하여 Home Assistant 디스크 사용량을 최적화합니다.
- **파라미터**: 없음 (등록된 모든 Carrot HA 엔트리에 자동 적용)
- **실행 주기**: 매일 1회 만료 데이터 삭제, 매주 1회 `VACUUM` 자동 실행됨 (수동 호출 가능).

---

## 7. 미지원 항목 안내 및 사유

### 1) 타이어 공기압(TPMS) 수치 미제공 사유
- 폭스바겐 ID.4(MEB 플랫폼) 차량은 타이어 내부에 개별 공기압 센서가 내장된 직접식(dTPMS)이 아닌, **ABS 휠 회전 속도 편차를 감지하는 간접식(iTPMS)** 방식을 채택하고 있습니다.
- 따라서 차량 CAN 버스에는 `bar`나 `psi` 단위의 개별 타이어 공기압 수치 데이터가 존재하지 않으며, 펑크 등 이상 발생 시 계기판 경고등 플래그만 송출되므로 임의의 가상 수치 센서를 생성하지 않습니다.

### 2) HA 에너지 대시보드(Energy Dashboard) 계량기 제외 사유
- Home Assistant의 기본 에너지 대시보드는 가정 내 전력망(Grid), 태양광 발전(Solar), 가정용 배터리(Powerwall)와 통합된 전기 요금 합산에 초점이 맞춰져 있습니다.
- 차량 충전 에너지를 가정용 에너지 대시보드에 직접 편입할 경우 외부 급속 충전소 사용량이나 완속 충전 구분이 왜곡될 수 있으므로, Carrot HA는 **독립적인 전기차 특화 대시보드와 월간 충전량 센서(`sensor.<vehicle>_month_charge_kwh`)**를 통해 차량 중심의 정밀한 통계를 제공합니다.

---

## 8. 실전 활용 예시 (자동화 및 대시보드 YAML)

### 예시 1: 80% 충전 도달 시 스마트폰 푸시 알림
배터리 수명 보호를 위해 80% 목표 충전에 도달하면 즉시 알림을 발송합니다.

```yaml
alias: "[전기차] 80% 충전 도달 알림"
description: "배터리 충전량이 80%에 도달하면 스마트폰으로 알림을 보냅니다."
trigger:
  - platform: numeric_state
    entity_id: sensor.id_4_soc_percent
    above: 79.9
condition:
  - condition: state
    entity_id: binary_sensor.id_4_charging
    state: "on"
action:
  - service: notify.notify
    data:
      title: "🔋 ID.4 충전 알림"
      message: >
        배터리가 80%에 도달했습니다!
        충전 전력: {{ states('sensor.id_4_charge_power_w') }} kW
        이번 충전량: {{ state_attr('sensor.id_4_charging_session', 'session_charge_kwh') }} kWh
        예상 요금: {{ state_attr('sensor.id_4_charging_session', 'session_charge_cost') | int }}원
```

---

### 예시 2: 비상 충전(1kW 저속 제한 / 접촉 불량) 감지 경고
ID.4 완속 충전기 결착 시 플러그를 끝까지 밀어 넣지 않으면 1kW 비상 충전 모드로 제한됩니다. 이를 감지하여 5분 내에 재결착하도록 경고합니다.

```yaml
alias: "[전기차] 비상 충전(플러그 결착 불량) 경고"
description: "완속 충전 플러그 접촉 불량으로 1.5kW 이하 저속 제한 시 경고"
trigger:
  - platform: state
    entity_id: binary_sensor.id_4_emergency_charging
    to: "on"
action:
  - service: notify.notify
    data:
      title: "⚠️ ID.4 충전기 결착 불량 경고!"
      message: >
        충전기가 제대로 체결되지 않아 1kW 비상 충전 모드로 작동 중입니다.
        충전 건을 분리한 후 '딸깍' 소리가 날 때까지 끝까지 밀어 넣어 다시 연결해 주세요!
```

---

### 예시 3: 주행 종료 후 상세 트립 리포트 전송
목적지에 도착하여 기어를 P에 넣거나 시동을 껐을 때 방금 주행한 결과를 스마트폰으로 발송합니다.

```yaml
alias: "[전기차] 최근 주행 결과 리포트"
description: "주행 종료 시 방금 완료된 트립의 거리, 전비, 소모 배터리를 요약 전송합니다."
trigger:
  - platform: state
    entity_id: binary_sensor.id_4_onroad
    from: "on"
    to: "off"
action:
  - delay: "00:00:10"  # 주행 종료 데이터 집계 대기
  - service: notify.notify
    data:
      title: "🚗 주행 완료 리포트"
      message: >
        방금 주행이 완료되었습니다!
        • 주행 거리: {{ state_attr('sensor.id_4_last_trip', 'distance_km') }} km
        • 주행 시간: {{ state_attr('sensor.id_4_last_trip', 'duration_minutes') }} 분
        • 평균 전비: {{ state_attr('sensor.id_4_last_trip', 'efficiency_kpl') }} km/kWh
        • 소모 전력: {{ state_attr('sensor.id_4_last_trip', 'energy_kwh') }} kWh ({{ state_attr('sensor.id_4_last_trip', 'start_soc') }}% → {{ state_attr('sensor.id_4_last_trip', 'end_soc') }}%)
        • 오늘 총 주행: {{ states('sensor.id_4_today_summary') }} km ({{ state_attr('sensor.id_4_today_summary', 'today_trip_count') }}회 운행)
```

---

### 예시 4: 서드파티 EV 엔티티 카드 연동 (Lovelace YAML)
표준 Lovelace `entities` 카드나 타 EV 카드에 새로 추가된 센서들을 조합하여 깔끔하게 표시할 수 있습니다.

```yaml
type: entities
title: "폭스바겐 ID.4 상태 요약"
entities:
  - entity: sensor.id_4_soc_percent
    name: "배터리 잔량"
  - entity: sensor.id_4_range_km
    name: "주행 가능 거리"
  - entity: sensor.id_4_charging_session
    name: "충전 세션"
  - type: attribute
    entity: sensor.id_4_charging_session
    attribute: session_charge_kwh
    name: "세션 충전량"
    suffix: "kWh"
  - type: attribute
    entity: sensor.id_4_charging_session
    attribute: session_charge_cost
    name: "세션 예상 요금"
    suffix: "원"
  - entity: sensor.id_4_last_trip
    name: "최근 주행 거리"
  - type: attribute
    entity: sensor.id_4_last_trip
    attribute: efficiency_kpl
    name: "최근 주행 전비"
    suffix: "km/kWh"
  - entity: sensor.id_4_today_summary
    name: "오늘 누적 주행"
```

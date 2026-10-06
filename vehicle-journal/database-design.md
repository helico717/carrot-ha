# SQLite DB 설계 v1

구현 상태: v0.8.13은 원장·일별 배분/집계·수동 CRUD·사진·현재 유가 비교를 사용한다.
parking·record_links·corrections·fuel_observations는 스키마 준비 상태이며 runtime
처리는 아직 없다. 이 문서의 전체 데이터 계약과 최초 릴리즈 구현 범위를 구분한다.

## 저장·연결 계약

HA 설정 경로 `carrot_ha/vehicle_journal/<entry_id>.sqlite3`에 entry별 DB를 둔다.
모든 행은 vehicle_id로 격리한다. UUID를 차량의 안정된 내부 식별자로 사용하고
entry_id/device_id는 mapping이다. HA 재등록은 명시적 mapping 이관 없이는 별도 차량이다.
SQL 파일은 신규 DB용이고 runtime은 생성 전에 지원 버전을 검사한다.
`IF NOT EXISTS`는 동일 버전 재실행을 위한 것이며 기존 다른 스키마를 업그레이드하지 않는다.

매 연결마다 foreign_keys=ON, busy_timeout=15000을 적용한다. DB 처리는 executor에서
수행하고 entry당 직렬 writer를 둔다. SQLite 기본 rollback journal을 v1 기본으로 사용한다.
WAL 전환은 측정이 있을 때만 하고 백업 절차도 함께 갱신한다. UTC 시각은 offset 포함
정규화한 ISO 8601, 날짜는 유효한 YYYY-MM-DD로 애플리케이션에서 엄격 검증한다.
SQLite 자체 날짜 검사만으로 달력 유효성·UTC 정규화를 보장하지 않는다.

## 테이블과 관계

| 테이블 | 책임 |
| --- | --- |
| journal_schema, vehicles | 스키마 버전과 차량·시간대·통화 |
| records | UUID envelope, 종류·자동/수동 출처, 원본 identity·fingerprint, 상태·version |
| mobility | trip/charge/parking의 장기 사실: 시각·거리·에너지·SOC·계기판·장소 |
| expenses | 비용 원장, 귀속일·결제일·대/세분류, 실제/추정 정수 금액 |
| expense_members | 기존 HA 결제 그룹 비용과 구성 충전의 연결 |
| record_links | 수동 보완이 어느 자동 기록을 supplements/replaces하는지 연결 |
| corrections, change_log | 활성 보정과 수정·제외·삭제·복원 감사 이력 |
| attachments | 인증된 첨부파일 식별자·상대 경로·hash·크기·종류 |
| day_parts | 원본 ID별 날짜 배분량·방법·품질, raw 삭제 후에도 보존 |
| daily_summaries | 날짜별 빠른 조회용 재생성 가능 집계 |
| comparison_settings, fuel_observations | 비교 연비·유종·센서 mapping, 시점별 가격 |
| sync_state, dirty_days | 이관 cursor·오류, 재집계할 날짜와 변경 generation |

`records` 자동 identity는 (vehicle_id, source_kind, source_id) unique다.
manual UUID는 journal이 발급하고 API 요청 idempotency key도 해당 UUID로 재시도한다.
기존 mutable cloud event는 같은 source ID를 fingerprint 변경으로 갱신한다.
원본 장기 사실의 정상 자동 갱신과 사용자 보정은 별도다. 보정은 자동 원본 변경 후에도
유지하며 변경 충돌을 표시한다. 특정 값 null 보정(값 제거)과 patch에 없는 값(유지)을 구분한다.

## 금액·수동 보정

기존 `charge_summaries`, `charge_payments`, `charge_payment_parts`,
`charge_exclusions`, `charge_deletions`를 함께 읽는다. 자동 충전 비용은
HA `_charge_groups` 의미를 재사용한 그룹당 expenses 한 행으로 투영한다.
charge 원장 각 행에 비용을 복제해 합산하지 않는다. payment_id/payment_version은
기존 HA 결제 참조다. 실제 0원은 유효하다. actual이 null일 때만 estimated를 적용한다.

payment_owner=ha_charge_payment이면 기존 관리자 charge WS를 통해서만 변경한다.
journal 수동 충전/일반 비용은 payment_owner=journal이다. 실제와 추정의 비교값 둘 다
보존하지만 effective는 둘 중 하나다. 충전금액을 일반 비용으로 다시 입력해 중복시키지 않는다.
그룹 병합 변경 시 기존 그룹 비용을 superseded 처리하고 새 그룹으로 원자적 투영한다.

보정은 허용 필드별 검증 후 적용하며 자동 출처·source ID·권한 필드는 수정할 수 없다.
SQL은 복합 FK, 비용 identity, 음수·금액 정수·JSON object·사진 제한을 검사한다.
레코드 kind와 detail의 대응, record_links의 자동/수동 origin, 수치 유한성, UTC/date,
patch 허용 필드, API version CAS는 애플리케이션 책임이다. 테스트에 명시한다.
삭제된 HA 원본 charge는 되살리지 않는다. 원본 영구 삭제가 요구된 경우 민감한 전체
본문을 audit에 복제하지 않고 correction과 제외 상태만 유지한다.

## 날짜별 자료와 품질

day_parts.metrics_json의 허용 키는 daily_summaries의 숫자 컬럼과 동일하다.
추가로 cost_categories 객체를 둔다. category 값은 actual_krw/estimated_krw/effective_krw
이다. 추정 비교 총액과 실제 지출 총액을 혼용하지 않는다.
원장 update 시 그 원장의 기존 day_parts와 새 parts를 한 transaction에서 교체하고
영향받는 이전/신규 날짜 모두 dirty로 표시한다. 생성 당시 원본의 시각·집계 시간대·
배분 방법·집계 버전을 기록한다. 측정 기반 재계산에는 parts를 재사용한다.
소수 배분은 내부 정밀도를 유지하며 출력에서만 반올림한다.

quality_json은 field_quality, coverage, gaps, reasons를 가진 object로 정의한다.
field_quality는 각 숫자 필드의 measured/estimated/manual/missing/partial 중 하나다.
coverage는 energy_distance_km, total_distance_km, soc_observed_seconds,
expected_seconds를 포함하며 실제 평가된 근거만 저장한다.
미관측 전체 값은 null, 확인된 무사용은 0이다. SOC 누적 사용량은 여러 충전 사이클로
100%p를 넘을 수 있으므로 시작/종료 SOC만 0~100으로 제한한다.
총소비 SOC는 충분한 전체 관측이 있는 경우에만 숫자로 저장한다.

## 첨부파일·비교값

사진 bytes는 `<entry_id>/attachments/<uuid>.<ext>`에 둔다. DB에는 상대 경로만 저장한다.
서버는 실제 decoder로 MIME·크기 확인, EXIF 위치 제거, 인증·차량 mapping 확인을 한다.
임의 경로/URL을 허용하지 않는다. 임시 파일 후 rename·DB commit, orphan 재검사 절차를 둔다.
soft-delete된 사진은 복원/백업을 위해 유지하고 자동 물리 삭제는 하지 않는다.

유가 관측은 HA 로컬 센서만 읽고 unavailable/unknown/비유한/비양수 또는 잘못된 단위를
거부한다. 원/L와 KRW/L을 canonical KRW/L로 정규화한다. 외부 유가 API는 호출하지 않는다.
센서가 갱신한 값과 시각을 저장하고 같은 관측은 unique key로 중복 방지한다.

# 검증 계획

## 이번 설계 검증

`python3 vehicle-journal/schema/validate_schema.py`는 tempfile의 합성 SQLite에서 실행한다.
스키마 신규 생성·동일 SQL 재실행, 테이블/인덱스, FK·자동 identity·비용 그룹 unique,
금액 0/null/음수/소수, JSON object, 시간 역전, SOC 경계, 사진 MIME/크기/5장 제한과
복원 제한, 차량간 링크, transaction rollback, integrity_check를 검사한다.
실제 HA 데이터·사진·인증정보를 테스트에 사용하지 않는다.

## 후속 runtime 인수 조건

| 시나리오 | 통과 조건 |
| --- | --- |
| 중복·수정·재이관 | source identity 유지, 같은 fingerprint no-op, 합계 동일 |
| 자정·DST·시간대 변경 | 날짜 parts 합계 보존, 23/25시간 대응, 과거 자동 이동 없음 |
| 충전 그룹·결제 | 실제 0원 유지, 미입력 fallback, 그룹 비용 1회, 수정 CAS 충돌 |
| 제외·삭제·복원 | 원장·parts·summary·사진 상태 일치, HA 삭제 charge 재생성 없음 |
| SOC·전비 | 무효/stale/공백 제외, 동일 구간 전비, unknown null, 품질/coverage 노출 |
| 수동 보완 후 자동 도착 | 후보 표시, 승인 link 없이 조용한 병합 없음, 연결 후 중복 제거 |
| raw purge·slimming | durable ack/parts 확인 전 정리 유예, 성공 후 장기 원장 유지 |
| 중단·DB 오류 | batch commit 이후 cursor만 진행, duplicate replay 안전, 오류 표시 |
| 권한·차량 격리 | entry 권한 검사, 타 entry ID/record/photo 차단, anonymous 거부 |
| 입력·사진 | finite/date/patch whitelist, signature/decoder 검증, 2MiB·5장·path 제한 |
| 변경 이력 | 원본 사실 유지, CAS 충돌, soft delete 복원, 영구 삭제 개인정보 비복제 |
| 비교·유가 | 단위 검증, historical 결측 표시, current와 당시 기준 구분, 음수 절감 허용 |
| 백업·복원 | DB+사진+mapping 복원, integrity/FK/hash와 행수·합계 일치 |
| 대량 기간·성능 | indexed range, bounded batch, query에서 이관 없음, cloud 추가 요청 0 |

실행 코드 변경 시 기존 freshness gates:
`tests/dashboard-live-loading.test.mjs`, `tests/dashboard-lazy-runtime.test.mjs`,
`tests/dashboard-view-state.test.mjs`, `tests/test_cloud_live.py`,
`tests/test_incremental_sync.py`, `tests/test_history_cache.py`,
`cloudflare/test_incremental_sync.mjs`, `cloudflare/benchmark_sync.mjs`,
openpilot `ha/tests/test_param_polling.py`와 관련 auth/charge/trip/camera interlock을
변경 영향에 맞춰 실행하고 기존 실패를 새 회귀와 구분한다. 이번 문서·미연결 SQL 작업은
해당 실행 경로를 바꾸지 않으므로 전체 제품 테스트나 외부 배포를 하지 않는다.

운영 수집·백업·latency 검증은 실제 배포 이후 별도다. 합성 schema 검증을 실제
일별 집계·데이터 복원·운영 수집의 성공으로 표현하지 않는다.

# DB 생성·이관·백업 절차 (후속 구현용)

## 초기 생성

이번 SQL은 schema 산출물이며 자동 설치 runtime은 아직 없다. 사용자 추가 요청으로
2026-10-06 활성 HA entry에 빈 DB를 생성했다(기록 0건). 기존 archive는 읽기만 했다.
생성은 신규 임시 DB에서 schema·mapping 검증 후 기존 파일을 덮어쓰지 않는 atomic
publish로 진행했다. 사진 폴더도 생성했으며 기존 HA 코드에는 연결하지 않았다.
아래는 후속 자동 설치·이관 구현 절차다.
HA runtime이 설치 전 schema version을 검사하고 entry별 executor에서 신규 DB에만
001_initial.sql을 실행한다. FK 활성화·schema 버전 1·integrity_check 확인 후 runtime에
연결한다. 실패 DB는 성공으로 등록하지 않고 기존 archive를 그대로 사용한다.
이후 migration은 순차 numbered SQL과 백업·명시적 transaction을 사용하며 downgrade는
원본 DB 덮어쓰기 없이 백업 사본으로 검증한다.

## 기존 사실의 출처

| HA archive 출처 | 가져올 내용·주의 |
| --- | --- |
| events(kind trip/state/charge) | codec unpack 후 유효 원장·관측; raw 전체 영구 복사 금지 |
| trip_derivations | distance/SOC/energy 품질·거부 판정; 현재 live SOC로 과거 복원 금지 |
| trip_energy | 남아 있는 측정 구간 에너지·distance; 원본 ID·fingerprint 확인 |
| charge_summaries | raw charge 삭제 후에도 남는 완료 충전 요약 |
| charge_payments/charge_payment_parts | 실제 금액·버전·그룹 연결; 비용 그룹당 1회 |
| charge_exclusions/charge_deletions | 제외·삭제 우선, 삭제 기록 재생성 금지 |

현재 Archive는 trip raw 정리 시 trip_energy/derivations도 정리한다. 그보다 오래된
주행 데이터는 새 DB가 복원할 수 없다. 운영 진단 없이는 특정 과거 범위 완전 복원을
주장하지 않는다. charge group merge·exclusion 의미는 기존 helper를 재사용한다.

## 이관 알고리즘

1. source DB read transaction별 consistent batch를 읽고 codec 해제·validation 수행.
2. source별 stable cursor와 시작 high-water mark를 기록한다. event rowid와 별도로
   charge summary의 ordered (updated,id), payment mapping generation을 추적한다.
3. 최대 200개/batch로 원장·연결·parts·dirty·cursor를 target transaction에 함께 저장.
4. commit 성공한 cursor만 진행한다. interruption 시 동일 batch upsert 재실행한다.
5. 측정 품질과 소스 수/합계/hash를 대조하고 마지막 high-water 뒤 변경 catch-up 수행.
6. 각 날짜 summary 재계산, 이관 보고서에 범위·유효/무효/제외/복원불가·품질을 기록.

source fingerprint가 같으면 journal version/audit/dirty를 갱신하지 않는다. 원본이
retention으로 안 보인다는 이유만으로 장기 원장을 삭제하지 않는다. 영구 삭제와
보존기간 삭제는 구분한다. 초기에 이관은 원본 읽기 전용으로 수행한다.

## 지속 수집과 원본 삭제 보호

후속 코드에서 archive의 put/put_cloud, 결제·제외·삭제 mutation과 같은 transaction에
source change outbox를 남긴다. journal target에 사실·dirty·ack sequence를 commit한
뒤 archive outbox ack를 처리한다. 두 DB의 ACK가 원자적이라고 가정하지 않는다.
ack 실패 시 재처리는 source identity/fingerprint로 중복 방지한다.

purge 전에 해당 raw/파생값에 대응하는 journal ack를 확인한다. pending/error이면
그 원본·관련 파생값 삭제 및 route slimming을 유예한다. 기록 반영 성공·필요한 parts
보존 뒤 기존 retention을 재개한다. journal 실패 때문에 디스크가 증가하면 오류와
유예량을 표시한다. 실패 중 원본을 조용히 지우지 않는다.

## 백업·복원·export

HA full backup의 config 포함 경로에 DB·사진·mapping이 있어야 한다. 실제 backup
archive에서 포함 여부와 복원 readback을 검증하기 전에는 '백업 보장'이라 보고하지 않는다.
일관성 있는 journal snapshot은 writer/첨부 mutation을 잠시 막고 SQLite backup API로
DB 사본, immutable 사진과 hash manifest, schema/mapping을 같은 백업 묶음에 저장한다.
변경 중 DB 파일 단순 복사는 금지한다. 첨부파일 삭제는 복원 가능 상태로 남긴다.

복원은 별도 위치에 integrity/FK/hash/행수·합계·entry mapping을 검사하고 현재 데이터를
백업한 뒤 명시적 교체한다. DB만 복원하고 사진 유실을 성공으로 보고하지 않는다.
JSON export는 schema version·단위·품질·출처를 포함하고 CSV는 조회 결과용이며
완전 복원 포맷이 아니다. export와 실제 기록은 공개 repo에 넣지 않는다.

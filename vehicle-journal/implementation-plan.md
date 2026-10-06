# 구현 상태와 후속 로컬 인터페이스

v0.8.13은 이 계획의 첫 수직 구현이다. query(일별·합계·페이지 원장), entries,
record/save, record/status, comparison/save 및 인증 사진 upload/download를 구현했다.
초기 접근은 관리자만 허용한다. 나머지 아래 예정 API는 아직 미등록이다.
주차 SOC·당시 유가·link/correction/export·backup API는 후속 작업이다.
후보 1번 기반 카드와 설치 안내는 usage.md를 참고한다.

## 단계와 완료 조건

1. **설계 준비(이번 작업)**: 폴더·지침·문서·미연결 schema, 합성 SQL 검증,
   디자인 참고 보존, main commit/push. 추가 요청으로 HA에 빈 DB·차량 mapping·
   사진 폴더 생성 및 무결성 검증. 실행 코드 연결·이관·Release 없음.
2. **HA 데이터 진단**: 승인된 읽기 전용 HA 진단으로 archive 기간·차량·table/field
   분포와 codec 확인. raw JSON·좌표·개인 메모는 보고서에 출력하지 않는다.
   날짜·항목별 measured/estimated/unavailable 복원 가능 보고서가 완료 조건.
3. **DB·이관**: HA entry executor에서 신규 schema 설치, 버전 migration과 백업,
   batch importer·resume·report. 기존 데이터 수와 의미 검증 후만 운영 생성 완료로 보고.
4. **자동 반영·수동 쓰기**: archive durable outbox·purge 보호를 먼저 추가하고
   journal sync worker·dirty 계산, 기록·보정·사진·기존 결제 연결 구현.
5. **조회·비교**: 공통 로컬 query service, 기간 집계·품질·유가·export API 구현.
6. **디자인·화면**: 후보 선택 후 동일 API를 소비하는 카드 구현. 실시간 상태는
   기존 경로, 스크롤/선택/초점·map continuity 유지. 디자인 선택은 별도 사용자 결정.

향후 실행 코드는 `custom_components/carrot_ha/vehicle_journal/`로 모듈화한다.
`storage.py`는 원본 mutation/outbox/purge 연결, `__init__.py`는 lifecycle 등록만
담당한다. 모든 frontend는 동일 HA entry coordinator/cache로 접근한다.
이관은 bounded batches, 실행·집계는 background executor에서 수행하고 최신 상태와
별도 task로 분리한다. cloud.py에 차계부 조회 fetch나 별도 원격 polling을 넣지 않는다.

## 예정된 API 계약 (아직 미등록)

HA websocket을 기본으로 사용하고 모든 명령에 entry_id를 요구한다.
서버가 vehicle mapping을 결정한다. 요청의 arbitrary vehicle_id/path를 신뢰하지 않는다.

| type 접두사 `carrot_ha/journal/` | 요청·응답 |
| --- | --- |
| daily | from/to(포함 local date), timezone → 날짜별 값·quality·provisional·revision |
| summary | from/to, grain(day/week/month/year) → 합계·가중 전비·coverage |
| records | kind/category/status, cursor, limit(1~100) → 원장·next_cursor |
| record/get | record_id → 원장·보정·첨부 meta·version |
| record/save | UUID, expected_version(신규 0), manual payload → 저장 version |
| record/delete, record/restore | record_id, expected_version → 상태·version |
| correction/save, correction/delete | target_id, expected_version, patch/reason → version |
| record/link | manual_id, automatic_id, relation, expected_version → link·version |
| comparison/save | fuel, economy, sensor mapping, expected_version → 설정 version |
| comparison | from/to, basis(current/historical) → 비용·절감·가격출처·coverage |
| status | 이관 phase·cursor 요약·오류·dirty 수·DB/사진 bytes |
| export | 기간·종류 → 인증된 로컬 JSON/CSV 다운로드 작업 ID |

기간 최대 366일/요청, 더 긴 기간은 summary month/year로 페이지 처리한다.
일반 인증 조회는 통합 접근 권한, 쓰기·설정·이관·export는 초기 관리자 전용이다.
권한은 실제 HA에서 사용 가능한 entry 접근 정책을 구현하고 부재 시 관리자만 허용한다.
CAS 충돌은 conflict로 반환하며 UI는 reload를 안내한다. validation/not_found/unauthorized/
conflict/storage_failed 상태를 구분하고 토큰·본문을 오류 로그에 담지 않는다.
신규 manual UUID 재시도는 payload 같으면 기존 결과, 다르면 conflict이다.
서버는 strict date/finite nonnegative numeric/enum/length 검증을 수행한다.
기간 bucket은 local 일, 월요일 시작 ISO week, 달력 월·연도다.

사진은 인증 HTTP `POST/GET /api/carrot_ha/v1/journal/{entry_id}/attachments`와
개별 attachment_id 경로로 처리한다. 등록 record_id·expected_version·파일을 검증하며
사진은 WS JSON base64나 DB BLOB로 보내지 않는다. 업로드 응답은 attachment_id·version.
삭제/복원은 관리자 WS 명령, bytes 공개 static hosting은 금지한다.

## 실행·배포 계약

향후 automatic journal writes는 로컬 source 갱신량에 비례한다. 조회는 원장을
무조건 재이관하지 않고 daily cache를 쓴다. 백업·이관·purge 실패를 별도로 표시한다.
API 실패가 기존 dashboard latest-state를 실패로 바꾸지 않는다.
실행 코드 추가 시 manifest 0.8.x·main push·태그·Release·Actions 성공 확인까지 수행하고
사용자는 HACS 업데이트·HA 재시작만 한다. Cloudflare/Comma 업데이트는 요구하지 않는다.

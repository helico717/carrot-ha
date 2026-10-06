# 차계부 변경 이력

## 2026-10-06 — 개발 배포 정책 정정

- 운영 검증 전 정식 발행한 v0.8.13을 사용자 요청으로 GitHub pre-release로 전환했다.
  릴리즈 화면의 Pre-release 표시를 확인했다. 기존 태그·manifest는 유지한다.
- 이후 순서는 수정마다 검증·커밋·푸시 → 버그 수정 완료 후 pre-release → 실사용
  검증 통과 후 정식 릴리즈다. 디버깅 코드 테스트는 HA SSH 직접 동기화를 사용한다.
- 이 정책 변경에서는 HA 코드 동기화·설치·재시작을 실행하지 않았다.

## 2026-10-06 — 기반 설계와 사용자 요청에 따른 빈 HA DB 생성

- 전용 지침·요구사항·DB/집계/이관/백업/API/검증 계획, schema v1,
  독립 합성 검증 스크립트, 미선정 원본 HTML 후보 2개와 SHA-256 출처 기록 추가.
- 변경 범위: vehicle-journal/ 및 루트 AGENTS.md 안내. HA 실행 코드·manifest,
  Cloudflare·Comma 변경 없음. 0.8.12 버전 유지, HACS Release/Worker 배포 없음.
- 로컬 SQL 9개 검증 통과. null 결제 금액 허용과 실제 0원의 구분을 포함하며
  새 DB 생성·재실행·FK·unique·JSON·사진·transaction rollback 확인.
- 사용자 추가 요청에 따라 WireGuard 경유 HA SSH 연결 성공. 읽기 전용 source
  진단(한국 시간 13:47 전후): 활성 통합 1개, state 25,563건(9/22~10/6 UTC),
  trip 171건(7/28~10/6 UTC), charge 46건(7/28~10/5 UTC).
  trip_derivations 171, trip_energy 52, charge_summaries 46, charge_payments 6,
  charge_exclusions 0, charge_deletions 1. 이는 조회 시점 값이며 완전 복원 판정은 아니다.
- HA 신규 journal DB 생성: schema 1, 차량 mapping 1개, 원장 0건, 196,608 bytes,
  integrity_check=ok, foreign_key_check=0. 첨부파일 폴더 준비. 기존 파일 덮어쓰기 없음.
  HA 설정 시간대 확인에는 기존 sudo 권한을 사용했으며 서버 권한 설정은 변경하지 않음.
- 운영 DB/사진·entry/device 식별자·개인 본문·토큰은 Git에 포함하지 않음.
- 미완료: 과거 이관, automatic outbox/집계, 수동 쓰기, API, 대시보드, 실제 백업 복원.
  빈 DB 생성은 자동 기록 수집 시작을 의미하지 않음. HA 재시작·HACS 업데이트 불필요.

## 2026-10-06 — v0.8.13 차계부 첫 구현

- 사용자 선택 후보 1번 ‘오늘의 브리핑’을 바탕으로 HA Lovelace 카드 구현.
  월간 요약·지출 도넛·일/주/월 추이·페이지 원장·현재 유가 비교·최신 수신 상태 표시.
  HA 관리자 사이드바에 차계부를 자동 등록하며 별도 수동 리소스 설정 불필요.
- `custom_components/carrot_ha/vehicle_journal/`: packaged schema, compact 원장·일별
  요약·배치 이관, 수동 주행/충전/비용 저장·수정·삭제·복원, 관리자 WS·인증 사진 API.
  사진 픽셀 재인코딩, EXIF 제거, 크기/장수·차량 매핑 검증.
- 기존 storage mutation transaction에 기기별 durable outbox triggers 추가.
  target 사실/집계 완료 후 ACK, 원본 purge/slimming 전 확인·실패 시 유예.
  기존 결제 helper 재사용; actual=0 보존, 그룹 비용 중복 방지.
- HA source 읽기 전용으로 실제 과거 기록 이관, target 사전 backup과 integrity/FK
  확인. 운영 소스 파일 직접 복사 없음. Git 제외 로컬 실제 기록 미리보기 확인.
- 제한: parking/전체 SOC, 표본 기반 자정 정밀 배분, 당시 유가, 자동/수동 링크·
  필드 보정·export API는 후속 범위. 같은 날 자동 기록은 수동 행에 경고만 표시.
- Cloudflare·Comma 코드/배포 변경 없음. HACS 설치·HA 재시작은 사용자 작업.
  실행 코드의 실제 운영 수집/쓰기 확인은 설치 이후에 별도로 기록한다.

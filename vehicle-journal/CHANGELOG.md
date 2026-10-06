# 차계부 변경 이력

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

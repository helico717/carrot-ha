# HA 전용 차계부 기반

**상태: 2026-10-06 설계 준비·HA 빈 DB 생성 완료, 수집·이관·API·화면 미구현.**
HA의 기존 기록을 활용해 자동 주행·충전과 수동 정비·비용·누락 보완을 장기 보존한다.
Cloudflare·Comma 변경 없이 일별 요약과 간결한 원장을 HA에 저장한다.
이번 폴더는 지침·문서·초기 SQL·미선정 디자인 참고 자료를 모은 작업 기준이다.

## 읽는 순서

1. [AGENTS.md](AGENTS.md): 작업·커밋·개인정보 규칙
2. [요구사항](requirements.md): 확정 범위와 화면에 필요한 데이터
3. [DB 설계](database-design.md), [일별 집계](aggregation-rules.md)
4. [구현 순서·인터페이스](implementation-plan.md)
5. [이관·백업](migration-and-backup.md), [검증](validation-plan.md)
6. [참고 자료](references/README.md), [변경 이력](CHANGELOG.md)

설계 SQL은 [schema/001_initial.sql](schema/001_initial.sql)이다. 기존 archive에
실행하면 안 된다. 운영 위치는 HA 설정 디렉터리 기준
`carrot_ha/vehicle_journal/<entry_id>.sqlite3`, 사진은
`carrot_ha/vehicle_journal/<entry_id>/attachments/`로 계획한다.
사용자 추가 요청으로 활성 HA entry의 빈 DB(스키마 1, 차량 1개, 기록 0건)를
생성하고 integrity/FK를 검증했다. 실제 HA API·수집·이관·백업 코드는 아직 연결하지 않았다.

독립 검증: 저장소 루트에서 `python3 vehicle-journal/schema/validate_schema.py`.
이 명령은 실제 HA에 접속하지 않고 임시 DB에서 제약조건과 재실행을 검사한다.

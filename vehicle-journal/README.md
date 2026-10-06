# HA 전용 차계부 기반

Antigravity 등 다른 에이전트가 이어서 개발할 때는 [AGENTS.md](AGENTS.md)와
[배포·인계 절차](deployment.md)를 먼저 읽는다. 커밋 푸시만으로 HA가 갱신되지는 않는다.

**상태: 2026-10-06 v0.8.13 첫 구현·실제 HA 기록 이관·읽기 전용 미리보기 검증.**
HA의 기존 기록을 활용해 자동 주행·충전과 수동 정비·비용·누락 보완을 장기 보존한다.
Cloudflare·Comma 변경 없이 일별 요약과 간결한 원장을 HA에 저장한다.
이번 폴더는 지침·문서·초기 SQL·디자인 참고 자료를 모은 작업 기준이다.

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
사용자 추가 요청으로 빈 DB 생성 이후 실제 HA 과거 기록을 이관하고 integrity/FK를
검증했다. 자동 수집·수동 기록·사진·조회 코드와 후보 1번 기반 카드를 구현했다.
운영 실행 연결은 HACS 업데이트·HA 재시작 후 확인해야 한다.
[설치·사용 안내](usage.md), [대시보드 YAML](dashboard.yaml)을 참고한다.
주차 SOC·과거 유가·자동/수동 링크·필드 보정·export API는 후속 범위다.

독립 검증: 저장소 루트에서 `python3 vehicle-journal/schema/validate_schema.py`.
이 명령은 실제 HA에 접속하지 않고 임시 DB에서 제약조건과 재실행을 검사한다.

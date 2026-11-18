# 원격 터미널의 원본 자동 동기화 상태

2026-11-18 구현. 대상은 `helico717/openpilot:carrot-wip-model_selector-ha`와
`ajouatom/openpilot:happymaj11r/carrot-wip-model_selector`다.

## 현재 배포 상태 — 2026-11-18

- 구현 `7923235b696249cead464f08e2a92c6cae7e8ca0` main 푸시 완료.
- 사용자 승인 화면과 Python 관측기를 HA에 직접 반영했다. 설치 전 기준 해시를 다시
  검사하고 `/config/carrot_ha/deployment-backups/github-actions-7923235b6962`에 기존
  3파일·manifest·deployment.json·rollback.sh를 보존했다. 최초 일반 사용자 쓰기는
  root 소유 백업 경로에서 거부돼 설치 전 중단됐고, 기존 sudo 권한으로 동일 범위만 반영했다.
- 설치5파일의SHA-256이 커밋 payload와 모두 일치한다. 기존3파일 백업 해시,
  Python AST, rollback 개행7개와sh -n도 확인했다. 코드/백업 외 운영 DB·설정·서비스는 수정하지 않았다.
- CI [44216700326](https://github.com/helico717/carrot-ha/actions/runs/44216700326)의
  신규12개 검사는 통과했다. radar-ha-python job도 성공했다. 전체regression job은
  `test_state_projection.StateProjectionTests.test_covering_projection_never_reads_table_body`
  1건 실패로 종료됐다. 이전 구현 전[44205172328](https://github.com/helico717/carrot-ha/actions/runs/44205172328)과
  같은 실패·동일한SQLite프로그램이며, 해당 검사/투영 소스에 이번 변경은 없다.
  따라서 전체CI성공으로 보고하지 않는다. 이후 Comma/대시보드 단계는skip이며
  이번 카드 관련 로컬Node7개 결과와 구분한다.
- 사용자에게 HA Core 재시작을 안내했고 **“나중에 재시작”** 응답을 받았다.
  사용자 재시작 원칙에 따라 재시작·통합 reload를 대신 실행하지 않았다.
- 현재는 **파일 반영 완료 / 실행 중 적용·운영 백그라운드 검증은 사용자 재시작 대기**다.
  재시작 후 `.storage/carrot_ha.github_actions_health`의 실제 관측 생성/시각·상태를
  확인하고, 브라우저 강력 새로고침 후 승인된 카드 표시를 확인해야 한다.
  새schedule 실행까지 자동 발생했다고 주장하지 않는다. Comma/수신 앱 업데이트·재시작은 필요 없다.

## 표시와 동작

원격 터미널 카드의 기존 기기 커밋 비교 아래에 원본 자동 동기화를 표시한다.
기기 설치 상태와 원본→사용자 브랜치의 병합 상태는 별개다.

- 최근 실행: 수동/예약 구분, 진행/완료 결과, 생성 시각, GitHub 실행 링크.
- 최근 예약 실행: event=schedule 기록만 사용. 수동 성공으로 예약 중단을 숨기지 않는다.
- 원본 미반영 커밋: GitHub compare의 원본 전용 커밋 수. 기능/파일 수가 아니다.
- HA 마지막 점검: API 요청을 완료한 마지막 점검의 시작 시각. GitHub 실행 시각과 다르다.
- 조회 불가: 이전 관측을 유지하되 정상으로 표시하지 않고 마지막 전체 성공 확인을 안내한다.

HA가 공개 API4경로를6시간 간격으로 조회한다. 토큰/새 권한·별도 서비스는 필요 없다.
모든 설정 엔트리와 브라우저 카드가 한 관측기를 공유한다. 화면 열기·터미널 연결이
점검 조건이 아니므로 맥북과 Comma가 꺼져 있어도 HA가 가동 중이면 점검한다.
카드의 기존30초 화면 확인은 저장된 snapshot을 읽으며 새 API 점검을 만들지 않는다.
점검 결과는 HA Store `carrot_ha.github_actions_health`에 저장해 재시작 뒤 재사용한다.
성공/실패 모두6시간 쿨다운이며 재시작·다중 카드로 호출을 증폭하지 않는다.

마지막 예약 실행 생성 시각이12시간을 넘으면 경고한다. snapshot을 읽을 때 시간도
다시 계산하므로 저장된 정상 결과가 무기한 정상으로 남지 않는다. 네트워크 조회가
6시간 간격이므로 실제 새 실행의 발견에는 최대6시간 정도 지연될 수 있다.
HA 자체가 꺼져 있으면 점검하지 못하며, 오래된 점검은 조회 불가로 표시한다.
개별 workflow API가active여도 포크 전체 Actions가 차단됐을 수 있으므로 이를
정상성 근거로 삼지 않는다. 실행 공백을 별도로 검사한다.

단일 API 실패 시 성공했던 다른 항목의 관측은 갱신하되 실패 항목의 이전 값·확인 시각을
보존한다. 표시용 숫자에만 locale 포매터를 사용한다. HTML은 고정 마크업이며 API 값을
textContent로 넣고 실행 링크도 고정 GitHub 저장소와 숫자ID로 생성한다.
기존 관리자 전용 WebSocket 권한과 기기별 조회 검사는 유지한다.

## 구현 범위

- `github_actions.py`:6시간 조회 제한, API 정규화, 부분 실패 보존,12시간 경고 계산.
- `github_actions_runtime.py`: HA Store·공유 백그라운드 task·엔트리/종료 정리.
- `__init__.py`: 엔트리 설정/해제 시 관측기 연결/정리. 차량 최신 상태 동기화와 독립.
- `terminal_ws.py`: 기존 관리자 전용 git_status 응답에 actions_sync snapshot 추가.
- `frontend/carrot-terminal-card.js`: 승인된 원본 동기화 영역.
- `preview/github-actions/`: 전체 운영 Custom Element·실제 xterm 기반 프리뷰.
  `python3 preview/github-actions/build_preview.py` 후 출력 디렉터리를 정적 서버로 열 수 있다.

사용자에게2026-11-18 실제 프리뷰를 시연했고 “이 화면으로 적용” 승인을 받았다.
8개 상태·다크/라이트·모바일 폭·Comma 오프라인·합성 터미널 연결/업데이트 확인을
브라우저에서 확인했다. 기기 명령은 mockHass 응답으로만 실행했다.
프리뷰 사진은 합성 데이터이며 실제 예약 실행 성공 증거로 사용하지 않는다.

## 검증 및 배포

- 신규 상태/주기/보존/취소/다중 엔트리/저장 실패 검사12개 통과.
- 기존 GitStatus3개 및 카드7개(신규3개 포함) 통과.
- 기존 터미널 relay 검사는 로컬 aiohttp 부재로1개 skip. 통과로 세지 않는다.
- Python AST·JavaScript syntax·diff 검사 통과.
- HA SSH에서 설치 전 새 핵심 코드로 공개 API를 실제 조회:4경로HTTP200,
  미반영0, 최신 수동 실행, 마지막 예약11월6일08:19 KST →overdue. 저장/설정 변경 없는
  읽기 전용 검증이며 정식 HA 백그라운드 실행 검증과 구분한다.
- 설치 전 기존3파일의 운영 SHA-256이 작업 기준HEAD와 일치하고 신규2모듈은 없음을 확인.
  검증·커밋·푸시 후 기존 파일 백업·새5파일 직접 반영·해시/문법 검증 완료(상단 배포 상태 참조).
- HA Core 재시작은 사용자가 수행한다. 새 Python 코드가 실제 실행된 증거는
  재시작 후 Store 생성·관측 시각·응답으로 확인한다. 파일은 설치됐으며 사용자 재시작 대기다.
- Comma·수신 앱·차계부·주행 로그 실행 코드·버전/태그/릴리즈·알림 발송은 변경하지 않는다.
  휴대폰 푸시나 Codex 예약 자동화를 별도 생성하지 않는다.

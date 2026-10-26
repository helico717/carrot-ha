> **2026-10-14 서버 경로 변경:** Cloudflare Worker/D1/KV 관련 설치·배포·한도 설명은 폐기된 과거 기록입니다. 관련 코드 블록을 현재 설치에 실행하지 마세요. 현재 절차: [직접 수신기 설치·복구](CLEAN_INSTALL_RECOVERY.md). 과거 장애 증거·기록 ID는 보존합니다.

# WIP·NAV·Model selector 간 HA 유지 전환 — 분석 및 구현 계획

작성일: 2026-10-13 KST. 상태: 설계 제안, 실행 코드 미변경, 기기 미접속.
사용자 정정 반영: 관심 브랜치는 NOO가 아니라 `carrot-nav`이다.

## 1. 목표와 실행 가능성

한 번 설정한 HA 업로드 토큰·기기 ID·서버 주소·기록을 유지하면서 WIP와 NAV를
선택하고, 기존 Model selector로도 돌아갈 수 있게 한다. 사용자는 지원 브랜치
선택과 준비 완료 후 재부팅만 수행한다. 전환·재부팅 중 업로드 중단은 허용하지만
연결 재설정, HA 기기 재등록, 기존 기록 삭제는 요구하지 않는다.

판정: **WIP·NAV·Model selector 지원은 소스 구조상 구현 가능성이 높다.**
현재 세 브랜치의 업데이트·설정 API·Git 전환 구조가 공통이고, HA 설정과
SQLite 상태는 이미 Git 밖에 저장된다. 다만 아직 대상 브랜치에 HA를 통합하거나
Linux 빌드·Comma 왕복 전환을 검증하지 않았다. 구현 가능성과 실기 검증 완료를
구분한다. 모든 현재·미래 실험 브랜치의 무조건적 호환은 보장하지 않는다.

원본 브랜치를 그대로 checkout하면 HA 소스/실행 등록이 없어질 수 있다.
따라서 원본의 각 브랜치에 동일한 HA 추가분을 포함한 배포 브랜치를 제공한다.
당근파일럿 주행 제어·주행 모델은 원본 브랜치 선택을 그대로 따른다.

## 2. 조사 범위와 고정한 근거

당근파일럿 전체 저장소의 트리와 공개 브랜치 목록을 확인하고, 이 기능에 영향을
주는 manager, updater, launcher, Git 전환, Params/설정 API, HA 수집·상태·터미널·
카메라, 기존 HA 카드 및 동기화 Actions를 중점 분석했다. 차량별 제어 알고리즘
전체 또는 모든 모델 가중치를 검증한 분석은 아니다.

원본: https://github.com/ajouatom/openpilot

원격 HEAD 및 commit API를 읽기 전용으로 확인한 스냅샷:

| 원본 브랜치 | 확인 SHA | 마지막 커밋 시각 KST |
| --- | --- | --- |
| `carrot-wip` | `09df14757e9999247843524d0ade7b2f0085dd6d` | 2026-10-13 19:57:11 |
| `carrot-nav` | `49a342b7d4345591ac71c9d8c7874b88bbaeeaf9` | 2026-10-13 20:02:45 |
| `happymaj11r/carrot-wip-model_selector` | `14ceb9093b1dcc1c52995e2314c52d9bc89ef65c` | 2026-10-13 20:00:44 |

위 SHA는 조사 시점의 관측이며 이후 HEAD는 바뀔 수 있다. 당시 원본에는 22개
공개 브랜치가 있었고, 다른 기여자의 이름이 붙은 실험 브랜치도 포함됐다.
브랜치 이름 또는 개수가 고정된다는 가정은 하지 않는다.

로컬 openpilot 분석 기준: `carrot-wip-model_selector-ha`,
`baf47a6facfe692bf27b1084931b7dd04ea39f40`.
로컬 carrot-ha 기준: `main`, `b01012c`.
원격 Actions 최신 성공 여부, 기기 설치 SHA, 실제 토큰 저장 위치는 미확인이다.
비밀 파일이나 토큰 값은 읽거나 기록하지 않았다.

### 확인한 공통점과 차이

- 원본 세 SHA의 `openpilot/system/updated/updated.py`,
  `openpilot/common/repo_update.py`,
  `openpilot/selfdrive/carrot/server/features/tools/dispatcher.py`,
  `server/features/params.py`, `server/features/settings.py`는 바이트 단위로 동일했다.
- `process_config.py`: WIP 대비 NAV는 `mapsd` 등록이 추가되어 있고,
  Model selector는 `modeld` 실행 경로가 다르다. 이 파일의 비교 결과이며
  브랜치 전체 차이가 이 두 가지뿐이라는 뜻은 아니다.
- HA manager 등록은 현재 `carrot_ha`와 `carrot_camera` 프로세스 및 활성화
  조건으로 구성된다. HA가 직접 주행 모델을 선택하는 구조가 아니다.
- HA 수집기는 `openpilot.cereal.messaging`, `openpilot.common.params`,
  `opendbc.can.CANParser`와 차량 CAN 데이터에 의존한다.
- 파라미터 동기화는 로컬 `:7000/api/settings/snapshot`, `/api/param_set`,
  `/api/params_bulk`에 의존한다. 설정 JSON 직접 읽기 fallback은 대상의 실제
  카탈로그 경로를 별도 확인해야 한다.
- 카메라는 메시지·인코더·camerad 실행 형식과 주차 인터록을 사용하므로,
  기본 업로드와 별도로 기능 지원을 판정해야 한다.

## 3. 현재 Actions의 동작과 한계

관련 파일:
`openpilot/.github/workflows/sync_upstream_model_selector.yml`,
`openpilot/.github/scripts/sync_upstream_model_selector.sh`.
여기서 `openpilot/`은 저장소 루트를 지칭한다.

1. 예약 표현식은 UTC 기준 6시간 간격이며 수동 dispatch도 가능하다.
   예약 실행은 GitHub 기본 브랜치에 있는 workflow를 사용한다.
2. `carrot-wip-model_selector-ha`를 checkout한다.
3. `ajouatom/openpilot:happymaj11r/carrot-wip-model_selector`를 fetch한다.
4. 이미 포함된 원본 SHA이면 종료한다. 아니면 `merge --no-commit --no-ff`한다.
5. `SYNC_PAT`가 없으면 `.github/workflows/` 전체를 병합 전 fork 트리로 복원한다.
   PAT가 있으면 해당 경로도 일반 병합 대상으로 남는다.
6. 해결되지 않은 소스 충돌이 있으면 `merge --abort`하고 실패한다.
7. 충돌이 없으면 merge commit 생성, 필요한 workflow 보존 검사, 대상 브랜치 push.
8. 기기 반영은 별도 Git 업데이트와 사용자 재부팅이다.

현재 workflow에는 병합 후 HA 호환 테스트가 없다. Git 텍스트 병합 성공은
런타임 호환성 증명이 아니다. 또한 스크립트의 일부 인자는 환경변수로 받을 수
있지만 workflow fetch와 commit 메시지는 Model selector에 고정되어 있다.
실제 최신 실행 로그·PAT 존재 여부는 이번 분석에서 확인하지 않았다.

## 4. 권장 구성

### 4.1 브랜치별 배포와 공통 HA 추가분

| 사용자 표시 | 원본 | 배포 대상 제안 |
| --- | --- | --- |
| WIP | `ajouatom/openpilot:carrot-wip` | `helico717/openpilot:codex/carrot-wip-ha` |
| NAV | `ajouatom/openpilot:carrot-nav` | `helico717/openpilot:codex/carrot-nav-ha` |
| Model selector | `ajouatom/openpilot:happymaj11r/carrot-wip-model_selector` | 기존 `carrot-wip-model_selector-ha` |

새 이름은 제안이며 현재 생성하지 않았다. 기존 fork `carrot-wip`은 기본 브랜치와
다른 작업의 역할이 있으므로 HA 배포 용도로 덮어쓰지 않는다.

공통 HA 소스는 기존 Model selector HA 브랜치의 명시적 릴리즈 SHA를 기준으로
관리한다. 관리 도구가 소유할 경로를 `selfdrive/carrot/ha/`와 최소 실행 연결로
한정한다. 초기에는 별도의 전체 openpilot 공통 브랜치를 만들지 않아도 된다.
서로 다른 주행 브랜치를 공통 브랜치로 병합해 전파하는 방식을 피한다.

HA 자체 변경은 소유 경로만 포함한 검증된 커밋/패치를 각 배포 브랜치에 반영한다.
기존 HA 브랜치와 원본 차이를 먼저 조사하여 HA 외 개인 수정은 별도 목록으로
관리한다. WIP·NAV에 Model selector의 주행 로직이나 무관한 개인 수정을 섞지 않는다.
원본이 HA 경로를 새로 생성하면 자동 덮어쓰기하지 않고 소유권 충돌로 중단한다.

### 4.2 최소 실행 연결

HA 폴더 안에 `process_registration.py`를 추가하는 방향을 검토한다.
프로세스·활성화 조건은 이 모듈에 두고 `process_config.py`에는 import와 등록
호출만 남긴다. manager API 차이는 adapter에서 처리하고 기존 프로세스 순서와
모델 실행 경로는 유지한다. HA import/설정 오류로 주행 manager 전체가 실패하지
않도록 오류 경계를 검증하고, 실패는 진단 상태로 표시한다.

기기 `/data/continue.sh` 수정, 외부 자동 주입, SSH/SCP 파일 복사는 사용하지 않는다.
모든 프로그램은 Git 커밋으로 공급하고 각 대상 checkout에서 깨끗하게 유지한다.

### 4.3 브랜치 레지스트리

Git 관리 JSON에 source repo/ref, deployment ref, source SHA, deployment SHA,
HA revision, 상태, 기능별 검증, 검증 시각, OS/하드웨어/DB 호환 조건을 기록한다.
기기는 레지스트리 항목 ID만 요청받고 임의 remote/쉘 문자열을 실행하지 않는다.
서버와 기기 모두 허용 목록·SHA·실제 Git 트리의 HA 등록 존재를 확인한다.

HA 화면은 레지스트리의 검증된 배포 대상만 기본 전환 목록에 표시한다.
원본 전체 브랜치 발견 목록과 실제 전환 가능 목록은 구분한다.
GitHub 조회는 HA에서 공유 캐시·수동 갱신으로 처리하며 카드마다 조회하지 않는다.
기존 상태/진행 보고는 가능한 한 기존 HA relay와 telemetry를 사용한다.

## 5. 토큰·기록·파라미터 유지 계약

| 상태 | 현재 위치/동작 | 전환 시 요구 |
| --- | --- | --- |
| 업로드 설정 | `/data/id4-collector/connection.json`, `/data/carrot_ha/connection.json`, 환경변수 및 Params fallback | 읽기 우선순위 일치, 토큰·URL·device 값 보존 |
| 수집 상태/미전송 데이터 | 선택된 data dir의 `state/collector.sqlite3` | 모든 지원 브랜치 동일 경로, 기존 event ID·outbox 유지 |
| 파라미터 처리 ACK | `/data/carrot_ha/param_sync.sqlite3` | 처리 ID 유지, 재적용 금지 |
| 카메라 설정 | `/data/carrot_ha/camera/` | 설정·활성 상태 보존, 지원되지 않으면 카메라만 비활성 |
| 원격 터미널 | 기존 업로드 identity로 discovery | bootstrap 재등록·토큰 재입력 없이 재연결 |
| HA 서버 기록 | 기존 device ID 기준 archive/클라우드 기록 | 신규 기기 생성 금지, 기존 기록 유지 |

`CarrotHaConfig`·`CarrotHaEnabled`는 조사한 Params 키 목록에 없었다.
따라서 Params만 영구 보존 수단으로 가정하지 않는다. 실제 기기의 설정 출처를
비밀 값 출력 없이 먼저 진단하고, Params/환경변수에만 설정된 경우에는 최초 한 번
Git 관리된 이관 코드로 공통 파일 저장을 수행한다. 기존 두 파일이 서로 다르면
임의로 선택·덮어쓰지 않고 현재 사용 중 설정과 우선순위를 진단한다.

설정 경로 변경은 이 기능의 필수 조건이 아니다. 레거시 경로를 유지할 수 있으면
유지한다. 이관 시 원자적 파일 쓰기, 0600, 오류 시 기존 설정 보존을 지킨다.
토큰을 Git·로그·상태 payload에 넣지 않는다.

모든 배포 대상은 같은 HA revision을 우선 사용한다. SQLite migration은 전진뿐
아니라 이전 브랜치 복귀도 고려한다. 읽을 수 없는 DB 버전이면 전환 준비를
거절하며 DB를 초기화하지 않는다. 전환은 offroad에서만 수행하고 상태를 flush한다.
서버가 이미 저장했으나 ACK가 유실된 이벤트도 기존 ID로 재시도하게 한다.

당근 주행 Params 전체는 HA 토큰과 별개다. 브랜치별 단위·범위·삭제된 키까지
무조건 복사하면 안 된다. 대상 카탈로그에 맞춰 HA 편집 화면을 갱신하고 이전
카탈로그의 pending 명령은 재검증/명시적 거절한다. 같은 이름인데 의미가 바뀐
파라미터에 대비해 catalog revision과 요청 시점의 branch epoch를 연결하는
정책을 설계한다. 필요 시 기존 queue 프로토콜을 최소 확장한다.

## 6. 브랜치의 생성·삭제·이력 재작성 정책

| 사건 | 처리 |
| --- | --- |
| 새 원본 브랜치 발견 | `discovered`로 표시, 자동 설치·자동 활성화하지 않음 |
| 대상 등록 후 검사 중 | `validating`, 전환 목록에서 선택 불가 |
| 검증 성공 | `supported`, 검증 SHA와 지원 기능 명시 |
| 원본 새 커밋 검사 실패 | 기존 배포 SHA 유지, 업데이트 `blocked` 표시 |
| 원본 브랜치 삭제 | `retired`, 원본 추적 중지, 기존 배포·설정·기기 유지 |
| 조회 네트워크 오류 | `unknown`, 삭제로 판단하지 않음 |
| 원본 force push | 이력 분기 보고, 자동 force push/전체 reset 금지 |
| 같은 이름 재생성 | 새 generation으로 재검증, 과거 승인 승계 금지 |
| 이름 변경 | 명시적 대응표 갱신 후 검증, 유사 이름 추측 금지 |

완료된 원격 목록 조회와 개별 ref 재확인으로 삭제를 확인한다. 403/429/timeout,
API 페이지 누락, 인증 오류를 삭제로 오인하지 않는다. `retired` 배포 ref는
즉시 지우지 않으며 현재 사용 기기의 복귀 경로로 보존한다. 새 선택 기본값에서는
숨기되, 검증된 마지막 버전은 명시적인 보관 버전 선택으로 접근 가능하게 한다.
삭제된 원본 브랜치를 원작자 저장소에 다시 만들지 않는다.

배포 브랜치가 원본 이력을 포함하므로 삭제 후에도 커밋 이력은 보존할 수 있다.
단, Git LFS 모델 파일·submodule·외부 다운로드 URL은 별도이다. SHA만 보존했다고
다시 설치 가능하다고 주장하지 않는다. 필요한 blob/object의 확보·가용성을 검사하고
보존 권한과 용량 정책을 확인한다. 로컬 캐시 없는 오프라인 전환은 지원하지 않는다.

## 7. 전환 실행 설계

### 7.1 기존 updater 스테이징 우선

원본 `updated.py`는 `/data/safe_staging`에서 fetch/checkout/build/finalize하고,
launcher는 부팅 시 준비된 checkout을 적용한다. 이 경로를 이용하면 준비 중
현재 HA 업로드를 유지하고 사용자 재부팅 때 적용할 수 있다.

다만 현재 updater는 target branch만으로 동작하며 관련 Params는 manager 시작에
clear될 수 있다. 요청한 deployment SHA·레지스트리 검증과 staging 결과를 연결해야
한다. branch만 지정하고 계속 움직이는 HEAD를 설치하는 방식은 사용하지 않는다.
shared repo lock과 updater overlay lock의 순서·해제, launcher swap, submodule/LFS,
AGNOS 요구 조건을 구현 전 작은 검증으로 확인한다. OS 변경이 필요한 대상은
초기 전환 범위에서 제외하고 별도 업데이트 필요 상태로 안내한다.

권장 흐름:

1. HA 관리자가 대상 선택. request ID, 현재 SHA, 대상 SHA를 고정한다.
2. 기기에서 fresh offroad 확인, Git clean, 업데이트/build 잠금, 저장 공간,
   OS·하드웨어·DB·등록 모듈·설정 존재를 점검한다. 차량 상태 미확인은 중단한다.
3. 기존 updater 스테이징으로 대상 SHA·submodule·LFS를 준비한다.
4. 준비 결과가 요청 SHA와 일치하고 HA 실행 연결·호환 검사를 통과했는지 확인한다.
5. `/data/carrot_ha/branch_switch.json`에 원자적으로 `ready_for_reboot`를 기록한다.
   준비 중에도 현재 checkout의 HA 업로드는 계속한다.
6. 사용자 재부팅 후 설치 SHA와 HA heartbeat/업로드 성공을 확인한다.
7. 같은 device ID로 정상 보고되면 `completed`. 연결이 없으면 `unconfirmed` 또는
   실패를 표시하고 마지막 성공 보고 시각을 유지한다.

상태: `requested → prechecking → preparing → ready_for_reboot → verifying → completed`.
어느 단계든 `failed`, `interrupted`, `unconfirmed`를 기록할 수 있다.
중복 request ID는 기존 결과를 반환하고 두 번 실행하지 않는다. 단계별 timeout과
전원 재시작 복구를 포함한다. 재부팅 실행은 사용자가 담당한다.

### 7.2 직접 git switch는 예비 경로

현재 원본 tools dispatcher는 `fetch --all --prune` 후 `git switch`하며 기존 로컬
브랜치가 있으면 그 브랜치로만 이동한다. 그 로컬 SHA가 최신 원격과 같다는 보장은
없다. `repo_lock`은 있지만 target SHA 검증·HA 존재 검사·전환 후 업로드 확인은 없다.
현재 HA Git Pull 버튼은 `git reset --hard`를 사용한다. 이를 새 전환 동작에 재사용하지 않는다.

스테이징 검증이 실패하면 직접 switch 구현으로 조용히 대체하지 않는다. 별도
설계 결정으로 남긴다. 직접 전환을 채택하려면 camera·param write·lazy import의
정지/flush, 살아 있는 Python 프로세스와 새 checkout 혼합 방지, updater staging
무효화, 원자적 복구 한계, 재부팅 전 구동 제한을 추가 검증해야 한다.

### 7.3 실패와 복귀의 한계

준비 실패는 현재 설치를 유지한다. 설치 후 HA가 살아 있으면 마지막 정상 배포
SHA로 복귀 준비를 요청할 수 있다. 부팅 자체가 실패해 HA relay가 안 올라오면
HA 화면에서 원격 복귀를 보장할 수 없다. 원본 launcher/recovery의 실제 복구 능력과
구형 checkout 보존을 검증하고, 최소 기기 조작이 필요한 복구 절차를 문서화한다.
OS downgrade나 임의 force reset을 자동 복구로 실행하지 않는다.

## 8. 구현 대상과 의존 순서

아래 신규 파일 이름은 제안이다.

| 단계 | 저장소/파일 | 산출물과 통과 조건 |
| --- | --- | --- |
| P0 재현 조사 | openpilot Git diff, settings/catalog, launcher/build/LFS | HA 소유 파일·개인 수정 목록, 세 대상 Linux baseline, 설정 출처 진단 |
| P1 공통 HA | `ha/process_registration.py`, collector/param_sync/camera, manager 연결 | 공통 등록, 동일 상태 경로·DB 호환, 현재 Model selector 회귀 없음 |
| P2 배포 생성 | `.github/ha-branches.json`, `.github/scripts/sync_ha_branches.py`, 동기화 workflow | WIP/NAV 각각 원본+HA, 기존 Model selector 보존 |
| P3 CI 수명 관리 | 위 CI 및 `ha/tests/test_sync_workflows.py` | 등록/삭제/force-push 처리, 테스트 통과 전 배포 ref 이동 금지 |
| P4 전환 엔진 | `ha/branch_switch.py`, 기존 tools/updater/launcher 최소 연결 | staging pin·상태·offroad·잠금·중복 요청, 사용자 재부팅 후 검증 |
| P5 HA 화면 | `terminal_ws.py`, `terminal_relay.py`, `frontend/carrot-terminal-card.js` | 관리자 대상 선택·준비/재부팅/결과 표시, 토큰 미노출 |
| P6 실기/발행 | 위 배포 및 HA HACS release | 왕복 전환과 기존 identity 업로드 확인, 지원 표시 확정 |

현재 relay 프로토콜로 구조화된 실행 요청/응답을 전달할 수 있는지 먼저 확인한다.
임의 terminal 문자열을 UI에서 생성하는 방식보다 허용된 전환 요청을 우선한다.
Worker/D1 변경은 필요성 확인 후 결정한다. 파라미터 epoch 또는 relay 타입 확장이
필요하면 최소 변경을 하고, 필요한 migration을 Worker보다 먼저 적용한다.
전환 목록 조회로 ~~KV~~ write·별도 telemetry polling·카드별 cloud query를 추가하지 않는다.

## 9. 자동 동기화 개선

- 기본 브랜치 workflow에서 등록된 대상별 독립 job을 실행하고 대상별 직렬화한다.
- 원본 HEAD를 정확한 SHA로 고정해 candidate에서 merge한다. 충돌은 abort한다.
- 기존 workflow 보존 규칙을 명시적으로 유지하며 fork script 변경도 diff로 검토한다.
  script 경로 변경을 무조건 ours 처리하지 않는다.
- HA 소유 경로 보존/공통 revision, manager 등록, branch 전용 modeld 경로, NAV mapsd,
  submodule/LFS 및 관련 tests를 검사한다. 원본 삭제/force-push는 별도 상태다.
- candidate 테스트 성공 후 배포 브랜치를 정상 push한다. 동시 변경으로 push가
  거절되면 force push하지 않고 새 HEAD를 기준으로 재검증한다.
- 마지막 성공 candidate를 레지스트리에 게시하고 실패 시 기존 지원 SHA를 유지한다.
  배포 branch와 catalog SHA 불일치는 선택 차단 상태로 처리한다.
- 현재 branch가 정상 추적하는 이력을 유지한다. source force-push 통합은 자동
  재기반으로 기기의 ff-only 업데이트를 깨지 않고, 유지보수자가 이력/소스 의도를
  확인한 후 새 generation 또는 정상 후속 커밋으로 처리한다.
- 워크플로 수정 후 신규 dispatch 실행과 원격 SHA를 확인한다. 과거 실패 재실행만으로
  새 workflow 성공을 판단하지 않는다. 별도 감시 자동화는 요청 없이 생성하지 않는다.

## 10. 필수 검증과 완료 기준

| 검사 | 기대 결과 |
| --- | --- |
| Model selector → WIP → NAV → Model selector | 토큰 재입력·HA 재등록 없이 같은 ID로 업로드 |
| legacy data dir·새 data dir·Params-only·설정 충돌 | 설정 손실 없음, 모호하면 중단, 비밀 출력 없음 |
| pending outbox·응답 유실·ACK 미완료 | 이벤트 ID/처리 ID 유지, 중복 param 적용 없음 |
| 기존 충전/주행 세션 후 offroad 전환 | 기록 경계·시간·거리 보존, 재부팅만으로 세션 오생성 없음 |
| 새/삭제/재생성 branch, 네트워크·403·429 | 삭제 오판 없음, current/last-known-good 배포 유지 |
| fetch 중 전원 종료·중복 클릭·WS 단절·disk full | 진행 복구/실패 보고, 현재 정상 설치 보존 |
| SHA 변경·원격 삭제·dirty tree·local divergence | 설치 전에 차단, reset/force push 없음 |
| build/updater 동시 실행·주행 전환·상태 미확인 | 잠금 순서 안전, 적용 중단, driving 상태에 checkout 없음 |
| branch 전용 modeld/NAV 등록·settings 차이 | 주행 선택 보존, 대상 카탈로그 재검증 |
| 주차 카메라/터미널 | 지원별 검사, driving interlock 유지, 토큰 discovery 재사용 |
| 첫 부팅 실패·원격 heartbeat 없음 | 미확인 표시, 원격 복구 가능 여부를 과장하지 않음 |

Linux CI에서 각 candidate의 daemon suite, param polling, 기존 sync conflict,
camera/terminal 인터록, repo_update와 updater/launcher 회귀를 수행한다.
HA 변경에는 terminal 권한/relay/device isolation과 UI 진행 상태 검사를 추가한다.
데이터 경로·polling을 건드리면 프로젝트의 dashboard live/lazy/view-state,
cloud live/incremental/history, ~~Worker~~ incremental/benchmark gates도 수행한다.
기존 실패와 새 실패를 구분하고 Mac 결과를 Comma 결과로 보고하지 않는다.

최종 완료는 (1) 두 신규 배포 branch와 기존 branch의 원격 SHA 확인,
(2) 실제 새 Actions 성공, (3) HA 실행 변경 시 0.8.x 정식 HACS release/Actions 확인,
(4) 사용자 설치 후 실기 왕복 전환·동일 identity 업로드 확인으로 판단한다.
24시간 freshness/업로드량 관측은 운영 안정성 확인 단계로 별도 기록한다.
설계 문서 단계에서는 코드·branch·tag·~~Worker~~·~~D1~~·기기 업데이트가 없다.

## 11. 남은 확인 항목

1. Linux/Comma의 staging 경로가 HA 업로드를 유지하며 정확한 SHA를 적용하는지.
2. 실제 기기 설정 출처, 상태 디렉터리, updater 준비 상태, OS/하드웨어 조건.
3. 원본 전체 차이와 HA 외 개인 수정의 정확한 분리; 설정 카탈로그 실제 위치.
4. submodule/LFS/외부 모델 확보와 원본 삭제 후 재설치 가능 범위.
5. boot 실패 시 원본 recovery의 실제 복구 가능성.
6. 기존 relay 구조화 command와 parameter epoch 정책의 최소 서버 변경 여부.

이 항목들은 구현 전/중에 검증할 조건이며, 사용자에게 토큰을 다시 입력하도록
넘기는 방식으로 해결하지 않는다.

## 12. 이번 작업 기록

- 수행: 로컬 계약·소스 분석, 공개 원격 22개 branch/ref 조회, 세 target SHA와
  핵심 원본 파일 수집·바이트 비교, 구현 계획서 작성.
- 미수행: 실행 코드 변경, 새 branch 생성, merge, Actions dispatch, 테스트 실행,
  device 접속/토큰 조회/설치/재부팅, HACS release, Worker/D1 배포.
- 검증: source snapshot 비교는 완료; 계획의 staging·실기 호환은 검증 대기.
- 문서만 커밋·푸시 대상이며 실행 버전 상승은 하지 않는다.

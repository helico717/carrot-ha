# Model selector 자동 동기화 조사 — 2026-11-18

## 추가 조사로 확인한 원인 — GitHub 로그인 화면

초기 조사는 개별 워크플로 API의 `active` 상태와 실행 이력만 확인하고 중단해
저장소 전체 Actions 차단 상태를 놓쳤다. 아래 로그인 화면 확인으로 초기의
“원인 미확정” 판단을 정정한다.

[해당 Actions 화면](https://github.com/helico717/openpilot/actions/workflows/sync_upstream_model_selector.yml)에
다음 제목과 설명이 표시됐다.

> Workflows on this fork have been disabled

GitHub는 이 포크 저장소의 불필요한 계산 자원 사용을 줄이기 위해 워크플로를
비활성화했다고 설명한다. 원본에서 상속된 예약/이벤트 워크플로가 포크에서는
필요하지 않을 수 있으므로 구성과 사용 목적을 이해한 뒤 재활성화하라는 안내다.
화면에는 `I understand my workflows, go ahead and re-enable them` 버튼도 있다.

확인된 직접 원인은 **GitHub의 포크 저장소 전체 워크플로 비활성화**다.
개별 workflow API의 `state: active`는 저장소 전체 실행이 허용됐다는 증거가 아니었다.
이 상태는 cron 예약 실행이 생성되지 않는 현상과 일치하며, 소스 병합 충돌이나
SYNC_PAT 만료로 job이 실패한 상황과 구분한다.

화면은 비활성화 정확한 시각이나 내부 판정 조건/로그는 제공하지 않는다.
따라서11월6일 마지막 실행 이후 언제 차단했는지,60일 비활동 규칙을 적용했는지는
확정하지 않는다. 플랫폼이 표시한 비활성화 사유와 실제 차단 상태는 직접 확인했다.

요청 범위는 원인 조사이므로 재활성화 버튼, Actions 권한 설정, 수동 동기화는
조작하지 않았다. 복구하려면 저장소 Actions를 다시 활성화하고, 새 수동 실행의
실제 병합·검사·push 결과 및 후속 예약 실행까지 확인해야 한다. 재활성화만으로
누적140개 변경이 모두 충돌 없이 통합된다고 단정하지 않는다.

## 외부 내비 제한속도 수정과 동기화 영향 검토 — 2026-11-18

사용자가 최근 ACC/openpilot 비활성 중 외부 내비 도로 제한속도 표시 수정이
비활성화 원인이었는지, 이후 동기화에 영향을 주는지 추가 검토를 요청했다.

### 변경 이력과 원인 구분

- `cd5bfae1aa068bdf5d39dae34d7a7e14df4b1385`(11월3일18:49 KST):
  ACC 비활성 중 단속 안내 표시와 함께 동기화 스크립트에
  `tools/test_id4_navigation_hud.py` 검사를 추가했다.
- 그 이후 실제 자동 병합 [42041768080](https://github.com/helico717/openpilot/actions/runs/42041768080)의
  job127294105034 로그에서6개 검사 OK 후dbfaa535 생성 및 원격 push를 확인했다.
  따라서 이 검사 도입으로 동기화가 즉시 중단된 것은 아니다.
- `2f71f8b0d65b18421ea7e96ad22f11d0479dd200`(11월7일18:11 KST):
  일반 도로 제한속도와 단속 표시를 분리하고 `test_id4_speed_notices.py`도 동기화
  통과 조건으로 추가했다. 별도 `id4-navigation-display.yml`은 관련 경로 push와
  수동 실행에 반응하며 cron이 없다.
- 해당 수정들은 동기화 cron·대상·권한을 바꾸지 않았다. 현재 sync workflow와
  11월3일 커밋의 workflow SHA-256도 동일했다. 검사 코드는 GitHub의 Actions
  비활성화 API를 호출하지 않고 로컬 생산 코드의 표시/입력/상태 보존을 검사한다.
- 검사가 실패할 경우 이미 생성된 Actions job에서 exit1·merge abort가 발생한다.
  저장소 전체 Actions 비활성화 및 새 run 미생성과 다른 단계다. 기능 수정이
  GitHub의 차단을 유발했다는 증거는 없으며 GitHub 내부 판정 내역은 여전히 공개되지 않았다.

### 최신 원본과 실제 병합 재현

기존 openpilot checkout은 깨끗했고 수정하지 않았다. `/private/tmp`의 공유 임시
복제본에 최신 원본을 fetch한 뒤 현재 운영 스크립트를 그대로 실행했다.
`UPSTREAM_REF`만 임시 원본 ref로 지정하고, 마지막 운영 로그와 같은
`SYNC_WORKFLOWS=false`, 원격 전송 방지용 `SYNC_PUSH=false`를 사용했다.

- fork 기준: `fdd8294b840ab6ba4d2423c5bbbe22f9128a1ccc`.
- 원본: `9f954291e2d4c72c24f7c2a930d04cc49ccacf49`(추가 fetch로 확인).
- 원본 전용140/fork 전용128커밋 상태를 재현했다.
- `.github/workflows/mdm-model.yaml`·`signal-checks.yaml` modify/delete 및
  `tests.yaml` content 충돌이 발생했지만, 기존 스크립트가 fork workflow 트리를
  복원해 해결했다. 남은 소스 충돌은 없었다.
- 병합 후 navigation HUD6개+speed notices11개 모두 통과, sync exit0.
- 임시 병합 커밋 `e0c69217ffb425af907b802908cf27df086107a9` 생성.
  원본 HEAD와 기존 fork HEAD 양쪽이 그 조상임을 확인했다.
- 기존 fork 대비 `.github/workflows/`, `openpilot/selfdrive/carrot/ha/`, 두 회귀 검사,
  `navigation_hud.py`의 내용이 그대로 보존됐고 임시 checkout은 clean이었다.

결론: 이 기능은 동기화 스크립트의 통과 조건에는 영향을 준다. 원본이 표시 동작을
깨뜨리면 병합 푸시를 막도록 의도된 보호 검사다. 그러나 이번 최신 원본으로는 통과했으므로
현재 동기화를 막는 요인이 아니다. 확인된 저장소 전체 비활성화와는 구분한다.

실행은 로컬 표준 라이브러리 기반 생산 AST/분류기 검사다. 새 GitHub 실행,
별도 native schema/DBC CI, HA 전체 회귀 및 실차 표시/주행 검증은 수행하지 않았다.
향후 원본 변경·SYNC_PAT 도입 등 조건 변경까지 보장하지 않는다. 재활성화 버튼,
원격 openpilot 브랜치, 원격 병합, 기기 소스·설정·재시작은 변경하지 않았다.

## 사용자 수동 실행 후 원격 복구 확인 — 2026-11-18

사용자가 GitHub에서 수동 실행 후 정상화됐다고 알렸으며 원격 결과를 재확인했다.

- [수동 실행44213400177](https://github.com/helico717/openpilot/actions/runs/44213400177):
  11월18일10:07:53 KST 시작, workflow_dispatch, completed/success.
- job134497118805 로그에서 HUD6개+speed notices11개 OK,
  병합 커밋176b980f 생성 및10:09:09 KST `fdd8294b..176b980f` 원격 push 확인.
- GitHub compare로 현재 HA 브랜치 대비 원본 전용0커밋 확인. fork 전용129개이며
  원본 현재 HEAD를 포함한다. 앞선140개 미반영 상태는 이 수동 실행으로 해소됐다.
- 이 결과는 수동 동기화 복구 증거다. 새 schedule 실행은 조회 당시 아직 없어
  예약 실행 복구까지 확정하지 않는다. 기존 cron 기준 다음 예정은11월18일15시 KST이며
  실제 시작은 지연될 수 있다. 실차 설치/재부팅 상태는 별도이며 확인하지 않았다.
- 지속 확인 기준: 최근 예약 실행의 event=schedule 및 success, 마지막 실제 예약 실행
  시각, 원본 미반영량. 성공했던 과거 실행이나 기기 대비1개라는 표시만으로 판단하지 않는다.
  실패 알림과 별도로 장시간 run 미생성을 탐지해야 이번 유형의 중단도 발견할 수 있다.
- 사용자에게6시간 간격 자동 점검 및12시간 이상 실행 공백/실패 알림 설정 의향을
  질문했다. 사용자는 알림 경로와 맥북 상시 가동이 아닌 조건을 확인 요청했다.
  현재 제공된 Codex 자동화 도구는 local 실행이므로 상시 감시 보장은 할 수 없다.
  HA 서버의 독립 주기 점검 및 Companion 앱 푸시를 대안으로 제안하되, 아직
  자동화 생성·HA 설정·알림 전송은 하지 않았다.

## 초기 API·코드 조사 기록

아래는 로그인 화면 확인 전 수행한 조사 기록이다. 원격 커밋 비교와 표시 계산
경로의 근거는 유지하며, 원인 미확정 문구는 위 추가 조사로 정정됐다.

## 결론

사용자 의도는 원본 model selector 변경과 HA·사용자 기능을 함께 유지하는 것이며,
구성도 이를 위한 병합 방식이다. 그러나 조사 시점에는 원본 최신 상태를 유지하지 못하고 있다.
HA와 당근웹의 “1개 뒤처짐”은 기기와 사용자 배포 브랜치 사이의 차이다.
원본과 사용자 배포 브랜치 사이의 미병합량은 두 화면에서 확인하지 않는다.

## 조회 기준과 실제 원격 상태

- 확인: 2026-11-18 오전 KST. 직접 공개 API 응답 Date도 2026-11-18로 확인했다.
- 원본: `ajouatom/openpilot:happymaj11r/carrot-wip-model_selector`.
  HEAD `9f954291e2d4c72c24f7c2a930d04cc49ccacf49`, 커밋 시각 11월18일08:40:32 KST.
- 사용자 배포: `helico717/openpilot:carrot-wip-model_selector-ha`.
  HEAD `fdd8294b840ab6ba4d2423c5bbbe22f9128a1ccc`, 11월14일16:42:53 KST.
- 두 브랜치 비교: 원본에만140개, 사용자 브랜치에만128개, 공통 조상
  `7da0657b796e19ad6be5bf45278a709f53a6fd58`. 이 숫자는 Git 이력 차이이며
  기능140개 누락이나 파일140개 누락을 의미하지 않는다. 개별 패치 동등성은 검사하지 않았다.
- 마지막 실제 원본 병합은 `dbfaa535e7ac24456392ce394f8f70d78ecabc22`,
  11월5일23:06:56 KST. 두 번째 부모는 위 공통 조상이며 원본 당시 변경을 병합했다.
- 원본 `carrot-wip`도11월18일 변경됐지만 직접 병합 대상은 model selector 브랜치다.
  `carrot-wip`에만 있고 model selector로 아직 옮겨지지 않은 변경까지 자동 수집하는 구성은 아니다.

비교 근거: [원본 대 사용자 브랜치](https://github.com/helico717/openpilot/compare/fdd8294b840ab6ba4d2423c5bbbe22f9128a1ccc...ajouatom:happymaj11r/carrot-wip-model_selector).

## “1개”의 계산 경로

사용자는 HA와 기기 내부망 당근웹 양쪽에서1개를 확인했다고 응답했다.

- HA `custom_components/carrot_ha/git_status.py`: 수집된 `comma_git_commit`과
  수집된 저장소·브랜치의 최신 커밋을 GitHub compare로 비교한다. 기본값은
  `helico717/openpilot:carrot-wip-model_selector-ha`. 성공·실패 모두600초 캐시한다.
- HA `frontend/carrot-terminal-card.js`: 위 비교값의 behind를 그대로 표시한다.
- 당근웹 `openpilot/selfdrive/carrot/server/services/git_status.py`:
  현재 브랜치의 remote/merge 설정으로 추적 브랜치를 결정하고 그 브랜치만 fetch한 뒤
  `git rev-list --left-right --count HEAD...<tracking>`으로 계산한다.
  이 코드의 upstream 변수는 Git의 추적 브랜치라는 뜻이며 원본 ajouatom을 뜻하지 않는다.
- 당근웹 `web/src/features/tools/runtime.js`: 위 behind를 업데이트 배지에 표시한다.
- 사용자 HA HEAD의 바로 전 커밋 `7ff2acd2c5039923128d41885cfec2b016d155fb`에서
  현재 HEAD까지 정확히1개다. 따라서 이 이전 커밋이 설치된 경우 현재 표시와 일치한다.
  이번 조사에서는 실차 HEAD·추적 설정·HA 실행 응답을 직접 읽지 않았으므로
  기기가 해당 SHA라고 확정하지 않는다.

두 화면이 모두1이어도 원본 동기화의 정상성을 증명하지 않는다. 지금 Git Pull을 하면
사용자 배포 브랜치 HEAD까지만 업데이트되며, 원본140개가 추가 병합되는 것은 아니다.

## 예약 동기화 상태

- 기본 브랜치는 `carrot-wip`. 기본 브랜치와 HA 브랜치의
  `.github/workflows/sync_upstream_model_selector.yml`은 같은 대상과6시간 cron
  `0 */6 * * *`을 사용한다. workflow_dispatch도 정의돼 있다.
- 워크플로는 HA 브랜치를 checkout하고 정확한 원본 model selector 브랜치를 fetch한 뒤
  `.github/scripts/sync_upstream_model_selector.sh`를 실행한다.
- 스크립트는 일반 merge로 양쪽 이력을 보존한다. SYNC_PAT가 없으면 fork의 workflow
  트리를 유지하고, 해결되지 않은 소스 충돌은 abort한다. ID.4 navigation HUD와 speed
  notices 검사 후에만 병합 커밋·push한다. 모든 HA·추가 기능의 의미적 보존을 보증하는
  전체 검사는 아니므로 향후 충돌/동작 검증은 별도로 필요하다.
- 최신 실행: [42128792825](https://github.com/helico717/openpilot/actions/runs/42128792825),
  11월6일08:19:51 KST 시작, 성공. Job127599761331 로그에서
  `Already up-to-date with upstream/happymaj11r/carrot-wip-model_selector.` 확인.
  당시 HEAD는dbfaa535e였고 이미 같은 날 앞선 예약 실행에서 병합된 상태였다.
- 11월18일 공개 API를 재조회해도 이후 신규 실행 기록이 없다. 실패한 merge가 연속 발생한
  상태가 아니라 예약 실행 기록 자체가 끊겼다. 마지막 성공을 현재 정상 동작으로 해석하면 안 된다.
- 직접 workflow API에서 상태는 `active`. workflow 삭제, cron 누락, 비활성 상태라는
  증거는 없다. 공개 API와 마지막 job 로그만으로 이후 예약 이벤트가 생성되지 않은
  GitHub 측 내부 이유까지 확정할 수 없다. 비활성/60일 규칙/권한/네트워크/충돌로
  원인을 임의 확정하지 않는다.

## 후속 복구에서 확인할 사항

1. 최신 원본과 사용자 브랜치를 격리된 checkout에서 병합해 실제 충돌과 HA 연결부,
   사용자 기능 보존을 검사한다. 무조건 ours/theirs·reset·force push로 덮지 않는다.
2. 필요하면 양쪽 워크플로 경로를 수정하고, 새 수동 실행으로 fetch·검사·push 결과 및
   원본 HEAD가 사용자 브랜치의 조상인지 확인한다. 과거 실행 재시도만으로 완료로 보고하지 않는다.
3. 다음 예약 실행이 실제 생성되는지 확인해야 주기적 동기화 복구로 보고할 수 있다.
4. 사용자 표시에는 기기→배포 브랜치와 배포 브랜치→원본의 차이를 구분하는 것이 유용하다.
   UI 변경은 별도 요청 범위와 전체 인터랙티브 프리뷰 승인 절차를 따른다.

## 수행 범위와 상태

이번 요청은 조사다. 저장소·공개 API·마지막 Actions 로그·계산 코드만 확인했다.
실행 코드 수정, 원본 병합, workflow 실행/설정 변경, 릴리즈, HA 직접 반영,
Comma 접속·파일 수정·Git Pull·재시작은 수행하지 않았다. 새 자동화도 생성하지 않았다.
상태: 동기화 중단 및 표시 기준 확인, 예약 이벤트 중단의 내부 원인은 미확정.
기존 로컬 미커밋 작업은 보존하고 이번 조사 문서·공통 changelog만 별도 커밋한다.

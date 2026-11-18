# Model selector 자동 동기화 조사 — 2026-11-18

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

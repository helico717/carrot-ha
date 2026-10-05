# beta.9 실제 CAN 충전 적용 및 삭제 UI

근거: [AC/DC 실차 대조](raw-can-ac-dc-validation-2026-10-05.md).

## 적용 범위

- Comma 수집기: bus0/1 0xCF만 수동 해독한다. 길이8, mode7 초기화, 전압100~800V,
  전류 절댓값≤1000A 범위를 검사한다. packet receipt timestamp를 기존 private 시간 맵으로 전달한다.
  초기화/무효값은 기존 숫자를 지우고 미래/오래된 표본은 수용하지 않는다.
- 실제 BMS 모드를 우선하고 HVK 요청과 불일치를 속성에 남긴다. 실제 모드 표본이 있으면
  stale/init/conflict를 요청으로 덮지 않는다. 구형 수집기는 요청 판정만 호환한다.
  실제 코드4=AC,6=DC;0/1 비충전;3 외부 모드·5 오류·7 초기화는 활성 충전으로 추정하지 않는다.
  주행 우선,90초 freshness, 기존 세션 공백·에너지 보완 경계를 유지한다.
- 전력/전압은 선택된 실제 모드와 동일 시각의 같은 프레임 값만 사용한다.
  실제 모드가 충전이면 배터리 측 양의 순전력, 비충전이면0; 미수신/초기화/만료는None.
  Wh 증가율·이전 양수 전력 hold로 대체하지 않는다. 실제 충전에서0이 영원히 불가능하다고 주장하지 않는다.
- 엔터티: 기존 unique key `charge_power_w` 등록을 제거, 새 `actual_charge_power_w`를
  「충전 전력」으로 등록한다. 단위kW, AC1자리/DC0자리. 기존 추정 전력의 HA 기록은 새 엔터티에 섞지 않는다.
  기존 자동화·외부 카드 참조는 새 엔터티로 변경해야 한다. 기존 충전 여부·모드·HV 전압은 값을 교체한다.
- 대시보드 ko/en의 개요 충전 배지·전력 타일·상세 행은 실제 값과 모드를 사용한다.
  낮은 전력의 DC도 완속으로 오분류하지 않는다. 역사적 신호 없는 기록은 기존 전력 분류를 유지한다.
- 세션 source `can_actual`을 recorder, HA 세션, 그래프, 요금 그룹에서 인식한다.
  기록 충전량·요금·SOC·주행가능거리 등은 직접 측정으로 이름만 바꾸지 않는다.
- 80/100% ETA는 기존 추정 계산을 유지하고 실제 전력을 입력으로 사용한다.
  SOC는 기존 `Wh / 설정용량` 계산이며 기본64kWh 보정은 유지한다.
  이번 대조:12.20/16.75/19.00/30.55kWh를64로 나누면19.1/26.2/29.7/47.7%로
  계기판19/26/30/47%에 가깝다. 이 비율은 실사용 배터리 용량이나 열화율의 증명이 아니다.
- 모바일은 왼쪽 swipe, 삭제는 오른쪽. 데스크톱은 각 기록의⋮ details 메뉴.
  키보드 summary/삭제 접근 가능; 확인/취소/실패 처리와 그래프 정정은 기존 API를 유지한다.

CAN 송신/UDS·수신주기·업로드주기·raw20GB·Worker/D1 변경 없음.

## 검증

- HA 전체292건,4 skip,실패0. 실제 전력 missing/init/stale/future/동일 프레임/0 및 새 엔터티 ID·AC/DC 정밀도 검증.
- Comma 전체86건:84통과,기존 camera encode_media 누락과 PyAV API 검증2건 실패.
  새2건은decoder 및Engine의 에너지정체/실제충전/정지/초기화/만료·실제source 세션을 검사한다.
- 기록 BMS 579,986프레임:mode1 313,885 /0 32,524 /4 144,898 /6 88,549 /7 130.
  전력 계산식 대조 및mode7무효처리 통과.
- Chrome:ko/en×390/1200px×light/dark8조합. 모바일 실제 touch 왼쪽swipe,
  데스크톱 메뉴에서 확인 팝업·취소,삭제·요금편집·저장실패·비동기스크롤/포커스 보존 통과.
- 새 JS AC1자리/DC정수·저출력DC분류2건 통과. 전체JS 기존61건 중60통과,
  motion-status1건 실패는HEAD 원본의 별도 임시 checkout에서도 같은 parked/unknown 차이로 재현됐다.
- 필수 live/lazy/view-state,incremental/history/cloud,Worker incremental 및benchmark 검증 통과.
  source변경 후 그래프·요금·삭제 관련 HA 테스트도 통과.

배포 후 실제 장치 CPU·반응·화면 기록은 아직 별도 실측하지 않았다.

## 발행 확인

- HA 코드/태그: `b9dfffaa88f0ad494498257d9aa0e4ff5fc08575`, `v0.8.12-beta.9`.
- [GitHub Release](https://github.com/helico717/carrot-ha/releases/tag/v0.8.12-beta.9):
  prerelease=true,draft=false, 태그 manifest=0.8.12-beta.9 확인.
- [Actions 37273042735](https://github.com/helico717/carrot-ha/actions/runs/37273042735): completed/success, 코드SHA 일치.
- Comma 원격 `5411ffb51e18200b1c55cb9cb3da7834c5ef6447` 일치 확인.
  최초푸시 중 자동동기화가 먼저원격을 갱신했으며 비중첩 upstream변경을 보존해 rebase한 뒤
  daemon86건 검사를 재실행하고 정상 fast-forward 푸시했다. 강제푸시/소스폐기 없음.
- 새 JS2건과 필수표시/삭제/live/lazy/view-state 및 수정된분류 회귀검사22건 통과.
- 사용자작업: Comma GitPull·재부팅, HACS beta.9 설치·HA재시작, 필요시 외부카드/자동화의
  추정 전력 참조를 새 엔터티로 변경. 에이전트는 실제 기기 업데이트·재부팅을 실행하지 않았다.

## 동일 beta.9 수정: 데스크톱 행 높이

사용자 요청으로 새 버전 없이 beta.9를 수정한다. 메뉴 details에 일반 details의18px 상단여백이 상속되고,
금액·수정·메뉴가 세로로 쌓여 행이 커졌다. 제어부와 금액을 동일 첫 행에 정렬하고 전용 여백을0으로 지정했다.
같은 fixture의 데스크톱 행166.1875→116px(약30% 감소), 조작부/금액 수직 정렬·행높이≤120px를 Chrome으로 검증한다.
모바일 swipe 및 데스크톱 menu/delete/payment/cancel/error/async continuity8조합도 유지한다.
동일 릴리즈 재다운로드 시 캐시 충돌을 방지하기 위해 executor에서 top-level JS 내용 해시를 계산해
frontend-version cache key에 build metadata로 추가한다. manifest/HACS 버전은0.8.12-beta.9로 유지한다.
동일 manifest 버전에서 보조파일 변경시 cache key변경·동일내용일때 안정성을 회귀검사한다.
오늘 AC/DC 분석 보고서와 본 적용 기록은 이미Git에 저장되어 있다. 사용자 실차 메모 원문은 커밋하지 않는다.
Comma 변경과 Worker/D1 배포 없음. 기존beta.9를 설치한 사용자는 HACS다시다운로드·HA재시작이 필요하다.

동일 beta.9 수정 발행 확인: 태그 커밋 `92880152d2401dd6f4ee63aec487a8342c9620ee`,
[Actions 37276095961](https://github.com/helico717/carrot-ha/actions/runs/37276095961) completed/success.
기존Release ID403428880을 유지하고 수정 노트가 반영됨을 확인했다. 새버전·새Release는 만들지 않았다.
HA293건(4skip) 실패0, 관련JS19건 및Chrome8조합 검증통과. 다운로드 ZIP의 manifest는beta.9로 유지한다.

## 동일 beta.9 재설치 구성 오류 수정

HA의 실제 공개 endpoint 응답 `0.8.12-beta.9+067b9bcd0ad4`를 확인했다.
bootstrap 검사식은 suffix에두번째+를 허용하지 않아 runtime import 전에 예외가 발생했다.
캐시 key변경·안정성만 확인한 앞선 Python검사는 소비자인 실제 JS 검사와의 호환성을 다루지 못했다.
백엔드 hash구분자를-로 바꾸고, 설치된 코드의 실제 생성값을 그대로 bootstrap에 전달해
runtime URL의v까지 보존되는지 새JS회귀검사로 확인했다. 관련JS11건과Python캐시검사 통과.
manifestbeta.9와 기존Release를 유지한다. 원격기기코드·Worker/D1 변경 없음.
## 동일 beta.9 재수정: 금액 위 조작부 (2026-10-05)

사용자 요청에 따라 데스크톱의 수정/직접 입력과 ⋮ 메뉴를 금액 윗줄에 나란히 배치한다.
금액까지 첫 줄에 놓던 데스크톱 grid만 제거하고 메뉴의 전용 여백 및 모바일 swipe를 유지했다.
원격 `33fea8a`의 동일 버전 캐시 bootstrap 수정을 보존했다. manifest는 `0.8.12-beta.9` 그대로다.
Chrome 한글/영문·밝은/어두운·390/1200px 8조합에서 버튼/메뉴 수직 중심 일치,
금액 위 배치, 행 높이(한글 105.1875px, 영문 116px), 결제 수정/0원/삭제/실패,
기록 삭제/취소 및 비동기 스크롤·입력 상태 유지 통과. 관련 JS 19건 및 HA live/history 12건 통과.
기존 camera-360 VM 검사는 import.meta 구문 오류, Worker migration 검사는 Windows CRLF에 따른
legacy fixture 치환 실패(duplicate measurements_json)로 실패했다. 두 검사의 파일은 변경하지 않았다.
bootstrap JS 검사는 python3 실행 권한 오류로 이 환경에서 실행되지 않았다.
Comma 코드와 Worker/D1 변경·배포 없음. 기존 beta.9 설치자는 HACS 다시 다운로드 후 HA 재시작한다.

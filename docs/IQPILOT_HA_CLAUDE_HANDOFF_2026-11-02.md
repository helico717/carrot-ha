# Claude 인계 — 설치 가능한 IQpilot + Carrot HA 후보

작성: 2026-11-02 KST. 이 문서부터 읽고 실제 Git 상태를 확인한 뒤 이어서 진행한다.
사용자는 토큰 소진 때문에 인계를 요청했다. 새 계획만 제시하거나 백업/로그인 단계를
반복하지 말고, 아래 완료된 작업을 보존하면서 남은 검증과 설치 준비를 진행한다.

## 1. 사용자가 하려는 일

현재 Comma 4에서 사용하는 당근파일럿을 잠시 IQpilot으로 바꿔 시험하고, 마음에 들지
않으면 당근으로 돌아오려 한다. IQ에서도 기존 HA 차량 대시보드, 차계부 자동 기록,
주차 카메라, HA 역방향 원격 터미널, 일반 주행 로그/영상 확인을 유지하고 싶다.
당근에 직접 종속된 설정/분석 대시보드는 시험 동안 일시 중지해도 된다는 범위다.

- 단순 IQ 공식 설치본이 아니라 **HA 연동이 포함된 설치 가능한 시험 후보**가 목표다.
- 당근 파라미터를 IQ에 무조건 적용하면 안 된다. 현재 후보는 당근 파라미터 동기화를
  중지한다. **HA용 IQ 파라미터 편집기는 구현하지 않았다.** IQ 설정은 기기에서 변경한다.
- 일반 로그 전송과 당근 전용 분석은 구분한다. IQ rlog의 당근 전용 분석 호환은 아직
  검증하지 않았으며, 가능하다고 약속하지 않았다.
- 실제 기기 설치/재부팅은 사용자가 한다. 에이전트는 준비·검증·커밋·푸시·CI 확인을 맡는다.

## 2. 현재 가장 중요한 상태

**Git 설치 후보를 게시했고 Linux CI가 성공했다. 하지만 Comma에 설치하지 않았고,
IQ.OS 실제 구동·카메라 영상·주행/충전 기록 연속성·당근 OS 복귀는 아직 실기 미검증이다.**
전체 기능이 실차에서 검증된 정식 완성판이라고 보고하면 안 된다.

| 항목 | 정확한 기준 |
| --- | --- |
| 사용자 실제 당근 버전 | helico717/openpilot / carrot-wip-model_selector-ha / 5ec4868a12a9038547b373eb95be3a5fa86d30aa |
| 사용자 실제 OS | 19.8-carrot-bt1 |
| 고정 복귀 브랜치 | helico717/openpilot:ha-back — 위 5ec4868a에 고정, 자동 업데이트하지 않음 |
| 짧은 복귀 설치 주소 | installer.comma.ai/helico717/ha-back |
| IQ 원본 안정판 | IQ.Lvbs/IQPilot / release / 5c9291b9df6d90007d73ecd749b135bd5008e80d |
| IQ 원본 Git | https://git.konn3kt.com/IQ.Lvbs/IQPilot.git |
| IQ 기대 OS | IQ.OS 4.9.9.4 |
| 새 HA 포함 설치 후보 | helico717/openpilot:iq-ha |
| 최신 후보 커밋 | a9edcebe183fde1654ad84f7c9f7948fd4a0aff2 (이전 1421eb45) |
| 짧은 후보 설치 주소 | installer.comma.ai/helico717/iq-ha |
| 성공 CI | https://github.com/helico717/openpilot/actions/runs/41388791014 (a9edceb), 이전 41386251075 |
| 첫 실패 CI | https://github.com/helico717/openpilot/actions/runs/41385112866 |

설치 URL은 Comma에서 실제 첫 설치 시험을 한 주소가 아니다. Git 브랜치 존재와 코드·CI
성공은 확인했다. 현재 사용자 기기는 여전히 당근이며 에이전트가 기기 소스를 수정하거나
설치·재부팅한 적 없다. HA 운영 코드 반영/HACS 업데이트/GitHub Release도 하지 않았다.

### 2026-11-02 Claude 후속 상태

- 사용자 실행 절차: [docs/IQPILOT_HA_INSTALL_AND_RETURN.md](IQPILOT_HA_INSTALL_AND_RETURN.md). 전환은 강제 옵션 없는
  Git checkout, 복귀는 후보의 `bootstrap/switch_to_carrot.sh`. 당근 업데이터 브랜치 선택은 쓰지 않는다
  (iq-ha에 당근 OS manifest 경로가 없어 OS 단계에서 실패).
- 가장 큰 미확인 위험: IQ.OS 4.9.9.2+는 owner root를 제거하고, 당근 OS 설치기는 sudo 없이 파티션에 직접 쓴다.
  IQ.OS 진단의 `carrot_return.verdict`(읽기 전용)를 받은 뒤에만 복귀를 안내한다. 당근 런처는 `/AGNOS`가
  있어야 OS를 재설치하며, 실패 시 6999 복구 터미널에서 iq-ha로 Git 되돌리기가 가능하다.
- IQ.OS 이미지는 공개 다운로드가 아니며 IQ 서버 기기 등록 인증이 필요하다(사용자에게 고지함).
- 다음 할 일: 사용자의 실제 설치 결과와 IQ.OS 진단 JSON을 받아 판단. iqdbc 합성 CAN 비교는 여전히 선택 항목.

## 3. 반드시 지킬 규칙

- /Users/davidlim/Developer/carrot-ha/AGENTS.md와 driving-logs/AGENTS.md를 먼저 읽는다.
  차계부 실행 코드를 건드리면 vehicle-journal/AGENTS.md 및 .agents/rules/vehicle-journal.md도 읽는다.
- **Comma 프로그램을 SSH/SCP/원격 터미널로 복사·편집·패치하거나 continue.sh에 주입하지 않는다.**
  모든 실행 코드는 Git 커밋·푸시된 코드로 설치한다. Git 하위 저장소도 고정 SHA로 관리한다.
- 기기 source 편집/mv/reset --hard/clean을 복구 기본 절차로 쓰지 않는다. 사용자 재부팅 원칙 유지.
- HA는 자체 HAOS 차량 수신 앱을 쓴다. Cloudflare Worker/D1/KV 설치·배포는 폐기 경로다.
- 신규 Release/pre-release 발행은 별도 명시 승인이 필요하다. 이번 작업은 후보 브랜치 게시이지
  Release 승인이 아니다. 이전 v0.9.0-beta.1 승인을 재사용하지 않는다.
- 모든 조사·변경·검증·게시·차단 상태를 CHANGELOG.md 및 driving-logs/CHANGELOG.md에 기록한다.
- 실제 대시보드 UI를 바꾸면 AGENTS의 전체 기능 인터랙티브 프리뷰/사용자 승인 절차가 필요하다.
  지금까지 이 작업은 HA 프론트엔드/운영 서버 코드를 바꾸지 않았다.
- 비공개 IQ 바이너리 역공학/서명 검증 우회/허용 OS를 임의 추가하는 식으로 호환을 가장하지 않는다.
- 비밀값·백업·원시 GPS/로그를 Git 또는 대화 출력에 넣지 않는다.

## 4. 백업은 이미 끝났다 — 다시 로그인/다운로드하지 말 것

다음 비공개 파일이 이 Mac에 존재하며 검증 완료됐다.

- /Users/davidlim/Developer/carrot-backups/carrot-20261102T021704563634Z.tar.gz
- 크기 50,288,578 bytes
- SHA256 ade4d0b3b447ad42ff9fdc559aa23e920744ef8f7c75b7f2f6beb22a2f24dad7
- 동일 이름 .sha256 sidecar 존재
- 원본 Comma 해시와 독립 재계산 일치, SQLite 5개 read-only quick_check 정상,
  Params 포함 및 manifest의 당근 커밋/OS 일치 확인. 파일 권한 0600, 폴더 0700.
- Comma 원본은 그대로 남아 있다. Mac 중간 .resume/.partial은 완료 후 정리했다.
- 토큰/연결 설정/DB가 포함되므로 파일 내용·키를 출력하지 말고 공개 저장소에 넣지 않는다.
- OS 이미지·모델·원본 주행 영상은 이 백업에 포함되지 않는다.

백업 전송 때문에 사용자에게 로그인을 여러 번 요청해 이미 불편을 겪었다. 같은 Wi-Fi는
필수가 아니며 HA HTTPS+관리자 터미널로 반출했다. 127.0.0.1은 Mac 내부 OAuth callback일
뿐 집 HA 주소가 아니다. 마지막 전송 종료 시 임시 HA 인증 폐기를 확인했다. 별도 토큰을
보관하지 않는다. 현재 백업은 완료이므로 이 단계를 재개할 이유가 없다.

전송 초기 device_not_offroad 메시지는 주행의 증거가 아니었다. 마지막 관측은
connected/offroad/local_ready/ready 모두 true인 상태의 device_disconnected였다.
사용자는 차량이 움직이지 않았고 주차 상태라고 재확인했다. 이를 운전자 탓으로 돌리지 않는다.

## 5. 실제 배포 구조 — 대용량 파일을 중복 배포하지 않는다는 뜻

설치 후보는 별도 Git 상위 저장소(superproject)이고 vendor/iqpilot을 위 IQ SHA에 고정한다.
상위 저장소에 필요한 공개 Python/실행 소스와 HA 확장을 두고, 원본 바이너리·자산은
하위 저장소 파일로 연결한다. IQ 라이선스 원문을 유지한다.

- 원본 대용량 모델/실행 바이너리를 우리 GitHub에 다시 복사해서 게시하지 않는다.
- Comma가 다운로드할 총 용량이 작아진다는 뜻은 아니다. 첫 실행 시 원본도 받아야 한다.
- 루트 launch_openpilot.sh는 vendor가 없어도 실행 가능한 실제 파일이다. 이어서
  bootstrap/ensure_vendor.sh가 Git 하위 저장소를 준비·검증하고 원본 IQ 시작 절차로 넘어간다.
- 루트 .iqpilot은 /data/iqpilot-ha-runtime을 가리키는 Git 관리 링크다. HA 상태도 기존
  /data/id4-collector, /data/carrot_ha, /data/carrot-camera 등 Git 밖 위치를 유지한다.
- 원본 stock updated 프로세스는 중지해 HA 확장이 stock IQ로 덮이는 것을 막는다.
  갱신은 이 전용 브랜치 Git pull로 한다. 주행 제어/모델 프로세스 정의는 수정하지 않았다.

**실제 의존 파일 다운로드 검증도 완료했다.** Mac 후보 폴더에서
`git submodule update --init --depth 1 --filter=blob:none -- vendor/iqpilot`를 실행했고,
정확한 5c9291b9 checkout과 vendor clean 상태를 확인했다. 링크 115개 전부 대상이 존재했다.
camerad/encoderd 실행 파일, params_pyx.so, artifacts/runtime/env_sync.sh 존재를 확인했다.
바이너리를 실행/디스어셈블하지는 않았다. 당시 vendor checkout 542MB, Git 객체 465MB였다.

현재 게시된 bootstrap 명령은 --filter=blob:none 없이 --depth 1을 쓴다. 기능상 같은
고정 commit을 받지만 첫 fetch에서 불필요한 blob을 더 받을 수 있다. 필터 추가는 향후
작은 최적화 후보이며, 아직 수정·게시하지 않았다. 결과를 혼동하지 않는다.

## 6. 코드와 로컬 경로

영구 관리 저장소:

- /Users/davidlim/Developer/carrot-ha — main, 인계 문서와 마무리 변경을 커밋·푸시한다. 최신 커밋은 git log/status로 확인.
- 실제 기존 openpilot 클론은 /Users/davidlim/Developer/openpilot 이다.
  이전 /Users/davidlim/Documents/openpilot 경로는 이 Mac에서 존재하지 않았다.
  이번 작업은 기존 개발 openpilot 클론을 변경하지 않고 임시 Git 저장소를 사용했다.

구현 파일(carrot-ha main):

- scripts/prepare_iqpilot_ha.py — 정확한 두 SHA에서 HA 공개 소스의 IQ namespace/CAN 호출을 변환.
  이것만 실행한 결과는 REVIEW_ONLY_NOT_INSTALLABLE 검토 overlay다.
- scripts/build_iqpilot_ha_candidate.py — 위 overlay + 공개 IQ 소스 + 고정 Git 하위 저장소 참조로
  실제 설치 후보의 별도 Git 저장소/CI/manifest/진입점을 조립한다.
- compat/iqpilot/iq_terminal.py — 당근웹 localhost7000 없이 PTY를 직접 소유하는 역방향 HA 터미널.
  새 네트워크 listener 없음. 기존 관리자 lease/명시적 offroad/입력4096-byte/세션ID 유지.
- compat/iqpilot/iq_camera.py — compiled IsTakingSnapshot 키에 의존하지 않는 private marker/lock.
  다른 살아 있는 소유자 marker 삭제 금지, IQ Sentry/Live View/불명 상태에서 시작 차단.
- compat/iqpilot/iq_video.py — ffmpeg CLI 미존재 시 기존 PyAV로 낮은 우선순위 stream-copy remux.
- compat/iqpilot/iq_preflight.py — 읽기 전용 소스/실기 진단. CAN 송신·카메라 시작·재부팅 없음.
- tests/test_iqpilot_terminal.py, test_iqpilot_camera.py, test_iqpilot_video.py
- docs/IQPILOT_HA_PREPARATION_2026-11-02.md — 단계별 조사/완료·미완료 구분.
- scripts/backup_comma.py, download_comma_backup.py — 완료된 백업 도구. 다시 실행할 필요 없음.

현재 임시 작업 폴더(재부팅/정리 시 사라질 수 있으므로 Git이 기준):

- /private/tmp/iqpilot-ha-install-final — **현재 게시 후보의 실제 작업 Git**.
  HEAD 1421eb452e693283fc75451e188bf2a68eaf1ec1, vendor도 실제 받았고 clean.
  로컬 브랜치 codex/iqpilot-ha, origin은 helico717/openpilot, 원격 배포 브랜치는 iq-ha다.
  후속 push는 `git push origin HEAD:refs/heads/iq-ha`이며 force-push하지 않는다.
- /private/tmp/iqpilot-ha-review — IQ 원본 filtered/no-checkout 조사 Git, HEAD5c9291b9.
- /private/tmp/carrot-iq-ha-donor — 당근 원본 filtered/no-checkout 조사 Git, HEAD5ec4868a.
- 위 no-checkout Git은 작업 파일을 꺼내지 않아 git status에 대량 삭제처럼 보일 수 있다.
  사용자 변경이 아니며 그 상태를 실수로 커밋/복구하지 않는다. git show/ls-tree로 조사한다.
- /private/tmp/iqpilot-ha-install-v2~v6 및 iqpilot-ha-overlay-* — 이전 생성 사본/비교 자료.
- /private/tmp/carrot-backup-download-venv — aiohttp, av15.1, pycapnp, uv 설치된 Mac Python3.9 시험 venv.
- /private/tmp/iq-ha-python — uv로 설치한 Mac Python3.12.16. 아직 이 환경의 실제 CAN parser 검증은 안 했다.
- /private/tmp/iq-ha-uv-cache — 임시 uv 캐시.
- /private/tmp/iqpilot-schema-check — 공개 IQ capnp 스키마 7개 사본.
- /private/tmp/iqpilot-vw-meb-review.dbc, iqpilot-dbc-field-review.json — 공개 DBC/정적 필드 확인 결과.
- /private/tmp/carrot-agnos-review.json, iqpilot-agnos-review.json — 두 OS manifest 사본.

재조립 예시(Mac 개발 명령, 기기에 붙여넣는 명령이 아님):

```bash
python3 scripts/build_iqpilot_ha_candidate.py   --donor /private/tmp/carrot-iq-ha-donor   --iqpilot /private/tmp/iqpilot-ha-review   --output /private/tmp/iqpilot-ha-next-candidate
```

새 조립 출력은 별도 새 Git 루트다. 이미 게시된 iq-ha를 새 root commit으로 덮어쓰지 말고
기존 후보 작업 Git에 변경 파일을 적용해 정상 후속 커밋으로 만든다. 기존 .git 및 실제
vendor checkout은 보존한다. 새 regular 파일을 기존 symlink 위에 copy할 때는 먼저 해당
목적지 링크를 제거해야 원본 vendor 파일을 실수로 덮어쓰지 않는다. 사용자 소스가 아닌
이 생성 전용 임시 Git에서만 조립 작업을 한다.

HA_CANDIDATE.json/PORTABILITY.json에는 각 후보 source SHA256이 있다. 후보 파일을
수정하면 manifest도 재생성해야 한다. 그렇지 않으면 source-only 진단/CI가 실패한다.

## 7. 통과한 검증과 정확한 한계

- 조립 소스 검사10개: 고정 Gitlink, vendor 없는 진입점, runtime 외부 경로, source SHA256,
  3개 shell syntax, 원본 경로 링크3개.
- 기능35개: 기존 trip4/battery6/BMS2/charge12/outbox1/log-activation2 =27,
  별도 PTY2/카메라4/PyAV2 =8.
- 합성 PTY는 실제 Mac PTY shell 출력과 offroad 해제 입력 차단·자식 종료를 확인했다.
  base relay는 합성 fixture다. 실제 IQ.OS 연결 테스트가 아니다.
- PyAV는 합성 H264 TS4프레임→MP4 디코딩4프레임/codec 유지·원본SHA 유지와
  기존 출력 덮어쓰기 거부를 확인했다. 실제 IQ 녹화 샘플은 아직 없다.
- 공개 IQ capnp로 3개 livestream header/data/idx.timestampSof/idx.flags 왕복,
  CarState canValid/vEgo/gearShifter 필드 확인.
- IQ DBC에서 필수8개 메시지, 에너지/전압/용량/거리/외기온6개 신호 존재 확인.
  **실제 IQ CANParser로 synthetic/recorded CAN을 파싱해 HA 값과 비교하는 검증은 미완료**다.
- Linux CI41386251075 성공은 위 source-only/기능검증이다. 원본 ARM64 실행 파일을
  Linux x86 runner나 Mac에서 구동한 검증이 아니다.
- 첫 CI41385112866 실패는 Bash5 bracketed-paste ANSI 때문에 출력행 비교가 실패한 것.
  실제 출력은 있었고 테스트에서 ANSI/CR 정규화 후 새 CI가 성공했다. 원래 실행을 재실행한 게 아니다.

## 8. 앞으로 할 일 — 우선순위

1. 이 문서와 실제 main/iq-ha Git 상태·원격 SHA·CI 상태부터 확인한다. 백업/로그인 반복 금지.
2. 선택적 추가 로컬 검증: 준비된 Python3.12와 공개 iqdbc 소스로 합성 CAN pack/parse 후
   HA 배터리/충전 값 비교. 메모리 데이터만 사용하고 실제 CAN socket/차량 송신은 금지.
   artifact/package_runtime에는 Linux ARM64 native 모듈이 있어 Mac PYTHONPATH에 전체를
   넣으면 ABI가 맞지 않는다. 공개 iqdbc Python/DBC/schema만 분리하고 Mac용 numpy/pycapnp를
   사용하거나 Linux CI에서 검증한다. 비공개 바이너리를 분석하지 않는다.
3. 고정 IQ 원본과 연결하는 bootstrap의 실제 파일/원본 보존 검증은 이미 완료됐다.
   필요하면 첫 다운로드에 --filter=blob:none 추가 후 같은 방식의 Git clone/CI를 검증한다.
4. **기기 설치 전 가장 중요한 미완료:** IQ.OS와 현재 Carrot OS의 왕복 복구 절차.
   두 manifest의 boot/system/bootloader 해시가 다르므로 단순 branch switch만으로 즉시 왕복한다고
   약속하지 않는다. 현재 Carrot boot/system URL HEAD200만 확인했고 이미지 해시/실제 flash/복귀는 미검증.
   OS 검사를 끄거나 현재 OS를 호환 허용 목록에 임의 추가하지 않는다.
5. 사용자가 기기 앞에서 주차한 상태로 시험할 수 있도록 설치·복귀 절차를 구체적으로 제공한다.
   에이전트는 직접 설치/재부팅하지 않는다. Git 전환은 강제 reset/clean 없이 실패 시 중단하도록 한다.
   설치 주소 하나로 되는 후보를 만들었지만 실제 첫 설치는 아직 한 번도 안 했다.
6. IQ.OS 부팅 후 사용자에게 읽기 전용 진단 실행을 안내하고 결과를 확인한다:

   ```bash
   cd /data/openpilot
   /usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight
   ```

   source-only와 달리 ARM64/Python3.12/원본checkout/Params키/CAN parser/카메라 schema/영상변환/
   OS버전/HA설정 존재를 확인한다. 비밀값을 출력하지 않는다. 이 검사는 카메라를 켜거나 CAN을 보내지 않는다.
7. 실제 HA 상태 측정시각/기기 식별자 연속성, 터미널 재연결, 주차 카메라와 onroad 차단,
   짧은 주행·충전 차계부 기록, IQ 일반 로그/영상 업로드, 수면/충전/네트워크 재연결을 확인한다.
   IQ FastSleep low_power 정책을 유지하므로 절전 중 availability 차이도 확인한다.
8. IQ rlog를 기존 당근 분석 스키마로 오해석하지 않도록 실제 schema 호환/소스 구분을 검증한다.
   필요하면 별도 source-aware decoder를 구현하되 기존 당근 이력·frontend freshness/scroll 계약 보존.
9. 실제 당근 복귀 확인 후 운영 브랜치로 되돌리고 백업 설정 복원 범위를 선별한다.
   IsOnroad/IsOffroad 같은 일시 플래그를 포함한 Params 전체를 살아 있는 시스템에 덮어쓰지 않는다.
10. 실기 결과 전에는 정식/전 기능 완료라고 보고하지 않는다. 신규 Release는 사용자 별도 승인 대상이다.

## 9. 인계 시 통신/권한 상황

사용자는 집 HA와 같은 장소/Wi-Fi가 아니다. 기존 외부 HA 접속과 Comma 역방향 연결을 쓴다.
HA 주소·인증키는 기존 비공개 구성에서 유지하며 이 공개 문서에 넣지 않는다.
백업 관련 사용자 승인은 해당 차량 백업을 이 Mac으로 받는 범위로 이미 확인했고 완료했다.
새 포트 개방이나 SSH 인터넷 노출은 필요 없다. 새로운 인증/데이터 반출이 필요할 때만
구체적 대상·이유를 확인하고, 완료한 백업 때문에 인증을 다시 요구하지 않는다.

현재 추가 로그인/다운로드/기기 작업을 기다리는 백그라운드 프로세스는 없다.
Mac Python3.12 설치도 완료됐다. 사용자에게 반복해서 같은 일을 시키지 말고 다음 검증부터 진행한다.

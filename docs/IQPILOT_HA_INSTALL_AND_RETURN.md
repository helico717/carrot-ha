# IQ.drive(IQpilot) + Carrot HA 시험 설치·당근 복귀 매뉴얼 (사용자 실행용)

작성: 2026-11-02 KST. 대상: Comma 4, 현재 당근 `5ec4868a` / OS `19.8-carrot-bt1`.

> **아직 실기에서 한 번도 설치·복귀해 본 적 없는 후보입니다.** 코드·CI·로컬 시험만 통과했습니다.
> IQ.OS 구동, 실제 CAN 값, 카메라 영상, 차계부 연속 기록, IQ.OS→당근 OS 복귀는 이 매뉴얼로
> 처음 확인합니다. 기기 설치·재부팅은 사용자가 하고, 막히면 **멈춘 뒤 Mac으로 알려 주세요(8절).**

## 0. 고정 기준

| 항목 | 값 |
| --- | --- |
| 설치 후보 | `helico717/openpilot` 브랜치 `iq-ha`, 커밋 `9637e6c6e8287c96dbf12de7b79bb2cef3b585f5` |
| IQ 원본(하위 저장소) | `5c9291b9df6d90007d73ecd749b135bd5008e80d`, 기대 OS `IQ.OS 4.9.9.4` |
| 복귀 대상 | 브랜치 `ha-back` = `5ec4868a12a9038547b373eb95be3a5fa86d30aa` (자동 갱신 안 함) |
| 백업 | Mac `~/Developer/carrot-backups/carrot-20261102T021704563634Z.tar.gz` (검증 완료) |

모든 전환은 Git으로만 합니다. `git reset --hard`, `git clean`, 강제 checkout, 공장 초기화,
설정의 "제거(Uninstall)"는 쓰지 않습니다. "제거"는 `/data` 전체 초기화를 일으킬 수 있습니다.
IQ 사용 중에는 터미널 카드의 Git 버튼이 자동으로 **[📥 IQ.drive 업데이트]**로 바뀝니다(`reset --hard` 없음, 5절).

## 1. 시작 전 확인 — 하나라도 아니면 시작하지 않습니다

- [ ] 차량이 **주차** 상태이고, 1~2시간 동안 Comma 전원이 끊기지 않습니다(충전 중이거나 12V 안정).
- [ ] Comma가 **Wi-Fi**에 연결돼 있습니다. IQ 원본(약 1GB)과 IQ.OS(수 GB)를 받습니다.
- [ ] HA 대시보드의 **Comma 원격 터미널** 카드에 [연결]할 수 있습니다.
- [ ] HA가 IQ.drive 안내 기능이 반영된 버전입니다(에이전트가 직접 반영 완료를 알린 뒤 HA 재시작).
- [ ] 이 Mac에서 에이전트와 대화할 수 있습니다(문제 보고용).
- [ ] **IQ.OS는 공개 다운로드가 아닙니다.** IQ의 OS 설치기는 IQ 서버(konn3kt)에 기기를 등록하고 인증된 경로로만
      이미지를 받습니다. 이때 기기 일련번호·IMEI·기기 공개키가 IQ 서버로 전송됩니다. 동의할 때만 진행합니다.

## 2. 당근 → IQ 전환

**어디서:** HA 대시보드의 **Comma 원격 터미널** 카드에서 [연결]을 누른 뒤, 아래 회색 상자의 명령을
**한 번에 하나씩** 통째로 복사해 터미널에 붙여 넣고 Enter를 누릅니다. 각 명령이 끝나면(다시 `$` 입력 줄이 보이면)
결과가 "기대 결과"와 같은지 확인하고 다음 단계로 갑니다. 다르면 그 자리에서 멈추고 아래 "2절 문제 대응"을 봅니다.

### 2-1. 기기에 손댄 흔적이 없는지 확인 (아무것도 바꾸지 않음)

당근 프로그램 파일이 원래 상태 그대로인지 봅니다. 바뀐 파일이 있으면 전환하면 안 됩니다.

```bash
cd /data/openpilot && git status --short --untracked-files=no
```

**기대 결과:** 아무것도 출력되지 않고 바로 다음 `$` 줄이 나옴.

### 2-2. IQ 설치 후보 내려받기 + 번호 확인 (아직 전환하지 않음)

GitHub에서 `iq-ha`(IQ + HA 연동 후보)를 Comma 안으로 **받아 두기만** 합니다. 그리고 받은 것이 제가 시험한 바로 그
버전(번호 `9637e6c…`)인지 확인합니다. 맞으면 `IQ_HA_OK`를 출력합니다. 지금 실행 중인 당근은 그대로입니다.

```bash
cd /data/openpilot && git fetch --no-tags origin +refs/heads/iq-ha:refs/remotes/origin/iq-ha && test "$(git rev-parse refs/remotes/origin/iq-ha)" = 9637e6c6e8287c96dbf12de7b79bb2cef3b585f5 && echo IQ_HA_OK
```

**기대 결과:** 마지막 줄에 `IQ_HA_OK`.

### 2-3. 프로그램 파일을 IQ 후보로 바꾸기 (재부팅 전까지는 당근이 계속 실행됨)

받아 둔 후보로 `/data/openpilot`의 파일을 바꿉니다. 덮어쓰면 안 되는 파일이 있으면 Git이 아무것도 바꾸지 않고 멈춥니다.

```bash
cd /data/openpilot && git checkout --no-recurse-submodules -B iq-ha refs/remotes/origin/iq-ha
```

**기대 결과:** `Switched to a new branch 'iq-ha'` 또는 `Switched to and reset branch 'iq-ha'`. (`warning: unable to rmdir ...` 같은
경고 줄은 괜찮습니다.)

### 2-4. IQ 원본 내려받기 (수 분~수십 분)

IQ 개발자 저장소(konn3kt)에서 IQ 원본(약 1GB)을 받습니다. 끝나면 받은 원본 번호를 출력합니다.

```bash
cd /data/openpilot && git submodule update --init --depth 1 -- vendor/iqpilot && git -C vendor/iqpilot rev-parse HEAD
```

**기대 결과:** 마지막 줄이 `5c9291b9df6d90007d73ecd749b135bd5008e80d`.

### 2-5. 재부팅 전 마지막 점검 (읽기만 함)

필요한 파일이 모두 제자리에 있는지 확인합니다.

```bash
cd /data/openpilot && /usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight --source-only
```

**기대 결과:** 출력 안에 `"passed": true`.

### 2-6. 재부팅 — 2-5 직후 바로

터미널 카드의 **[🔄 기기 재부팅]**을 누릅니다. 터미널 연결이 끊기는 것이 정상입니다.

### 2-7. 첫 부팅 기다리기 (최대 1시간)

첫 부팅에서 IQ가 IQ.OS를 내려받아 설치한 뒤 한 번 더 재부팅합니다. **화면이 로고에 오래 머물 수 있습니다.
전원을 끊지 마세요.** IQ 화면이 뜨면 3절로 갑니다.

### 2절 문제 대응

| 증상 | 행동 | Mac으로 보낼 것 |
| --- | --- | --- |
| 2-1에 출력이 있음 | **멈춤.** 아무것도 지우지 않음 | 출력 전체 |
| 2-2에 `IQ_HA_OK`가 없음 / 네트워크 오류 | Wi-Fi 확인 후 2-2만 한 번 재시도, 그래도 실패면 멈춤 | 출력 전체 |
| 2-2는 받았지만 번호가 달라 `IQ_HA_OK`가 없음 | IQ 원본 새 버전으로 자동 갱신됐을 수 있음. 멈추고 알려 주면 새 번호를 확인해 드림 | `git rev-parse refs/remotes/origin/iq-ha` 출력 |
| 2-3이 `would be overwritten`·`error`로 실패 | **멈춤.** 기기는 당근 그대로(아무것도 안 바뀜). 재부팅해도 당근으로 정상 동작 | 출력 전체 |
| 2-4가 실패·다른 SHA | 멈춤. **재부팅하지 말 것**(이미 iq-ha로 바뀐 상태라 재부팅 시 IQ 설치가 시작됨). 당근으로 되돌리려면 `cd /data/openpilot && bash bootstrap/switch_to_carrot.sh` 후 재부팅 | 출력 전체 |
| 2-5가 `"passed": false` | 멈춤, 재부팅하지 않음. 되돌리기는 위와 같음 | JSON 전체 |
| 2-7에서 1시간 넘게 로고 / 오류 화면 | **상태 미확인.** 화면만으로는 (가) 당근 OS에서 IQ.OS 설치가 멈춘 것인지, (나) IQ.OS로 부팅은 됐지만 IQ 실행이 실패한 것인지 구분할 수 없음. 전원 유지, 아무 명령도 실행하지 않음 | 화면 사진, 경과 시간 |

2-7 실패 시에는 HA 터미널과 당근 복구 터미널(6999)이 실행되지 않습니다. 복구 방법은 실제 OS 상태에 따라 다르므로
**먼저 Mac으로 알려 주세요.** 기존에 SSH 키를 등록해 둔 경우, 같은 네트워크에서 `ssh comma@<Comma IP>`(비상 복구 용도)로 접속해
아래 **읽기 전용** 확인 결과를 함께 보내 주시면 상태를 구분할 수 있습니다. 파일 편집·복사·전환 명령은 실행하지 않습니다.

```bash
cat /VERSION; abctl --boot_slot; cd /data/openpilot && git rev-parse --abbrev-ref HEAD; cat /data/params/d/IsOffroad /data/params/d/IsOnroad
```

- `/VERSION`이 `19.8-carrot-bt1`이면 아직 당근 OS입니다. 이때 당근 복귀(`switch_to_carrot.sh`)는 OS 재설치 없이 끝납니다.
- `IQ.OS 4.9.9.4`이면 IQ.OS로 부팅된 것입니다. 당근 복귀는 4절의 위험(당근 OS 재설치 권한)이 그대로 있으므로
  에이전트가 확인하기 전에는 시도하지 않습니다.
- 이 상태에서는 주행 상태값이 없거나 오래된 값일 수 있어 복귀 스크립트가 거부할 수 있습니다. 차량이 확실히 주차된 상태에서
  **에이전트가 지시할 때만** `bash bootstrap/switch_to_carrot.sh --confirm-parked`로 확인을 직접 넘깁니다.

## 3. IQ.OS 부팅 후 확인 (주차 상태)

3-1. **IQ 설정에서 FastSleep(깊은 절전)을 끕니다.** 켜져 있으면 주차 5분 후 HA 수집·터미널·카메라가 멈춥니다.

3-2. HA 터미널 [연결] 후 확인합니다. 기대: `IQ.OS 4.9.9.4`, `9637e6c6…`.

```bash
cat /VERSION; cd /data/openpilot && git rev-parse HEAD
```

3-3. 읽기 전용 진단을 실행하고 **출력 전체를 Mac으로 보내 주세요.** 카메라·CAN·재부팅·설정 변경 없음.

```bash
cd /data/openpilot && /usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight
```

- `passed`: HA 연동 실행 조건 전체. `fast_sleep_off`가 false면 3-1을 다시 확인.
- `carrot_return.verdict`: 당근 복귀 가능성. `SOFTWARE_RETURN_BLOCKED`면 **소프트웨어 복귀를 시도하지 말고** 알려 주세요.

3-4. HA에서 확인합니다.

| 확인 | 기대 |
| --- | --- |
| 파라미터 카드·당근웹 로그 카드 | 블러 + 가운데 "IQ.drive 사용 중" 안내 (최대 30초 내 표시) |
| 차량 대시보드 상태·측정 시각 | 갱신되고 기존 차량으로 이어짐 |
| 원격 터미널 | 연결·재연결, 주행 시작 시 입력 차단 |
| 주차 카메라 | 영상 표시, 주행 시작 시 자동 종료(IQ Sentry/Live View 사용 중이면 시작 차단이 정상) |
| 짧은 주행 | 차계부에 주행 1건(거리·전비·SOC·최고속도) |
| 충전 | 충전 1회 기록 및 차계부 인계 |
| 주차 위치·주행 중 위치 | 지도 갱신 |

IQ 설정은 기기 화면에서 바꿉니다. IQ 설정의 업데이트/브랜치 선택으로 순정 IQ로 바꾸지 마세요(HA 연동이 사라짐).

### 3절 문제 대응

| 증상 | 행동 | Mac으로 보낼 것 |
| --- | --- | --- |
| IQ 화면은 떴지만 HA 터미널 연결 안 됨 | 10분 기다린 뒤 재시도. 계속 안 되면 기기 화면 상태 사진 | 사진, 대시보드 측정 시각 |
| 대시보드가 갱신 안 됨 | 3-3 진단 실행 | 진단 JSON |
| 안내 오버레이가 안 뜸 | HA 페이지 새로고침(Ctrl+F5) 후 30초 대기 | 화면 캡처 |
| 운전 중 이상 동작 | **즉시 IQ 해제 후 정차.** 이후 복귀 여부 상의 | 상황 설명 |

## 4. IQ → 당근 복귀

조건: 3-3 진단의 `carrot_return.verdict`가 `SOFTWARE_RETURN_POSSIBLE_UNVERIFIED`, 주차, 전원·Wi-Fi 확보.

| 단계 | 명령/행동 | 기대 결과 |
| --- | --- | --- |
| 4-1 | `cd /data/openpilot && bash bootstrap/switch_to_carrot.sh` | `CARROT_CHECKED_OUT 5ec4868a12a9038547b373eb95be3a5fa86d30aa`. 주차가 확인되지 않으면(`Parked state not confirmed`) 아무것도 바꾸지 않고 멈춤 |
| 4-2 | [🔄 기기 재부팅] | 당근 런처가 당근 OS를 받아 기록 후 다시 재부팅(전원 유지) |
| 4-3 | 당근 화면 후 `cat /VERSION; cd /data/openpilot && git rev-parse HEAD` | `19.8-carrot-bt1`, `5ec4868a…` |
| 4-4 | `cd /data/openpilot && git checkout carrot-wip-model_selector-ha && git pull --ff-only` 후 재부팅 | 운영 브랜치 최신 |
| 4-5 | HA 파라미터·로그 카드 | 안내가 사라지고 다시 사용 가능 |

IQ 사용 중 녹화된 로그는 복귀 후에도 HA로 올라가지 않습니다(의도된 동작). 당근 설정이 바뀌었으면 백업 전체를
덮어쓰지 말고 필요한 항목만 함께 골라 복원합니다. IQ.OS의 부팅 splash는 복귀 후에도 남을 수 있습니다(동작 영향 없음).

### 4절 문제 대응

| 증상 | 행동 | Mac으로 보낼 것 |
| --- | --- | --- |
| 4-1이 거부(`refusing`) | 멈춤, 재부팅하지 않음. IQ는 그대로 사용 가능 | 출력 전체 |
| 4-2 후 `AGNOS update paused` 화면 | 당근 OS 기록이 막힘. IQ.OS는 그대로. 같은 네트워크 휴대폰에서 `http://<Comma IP>:6999`(당근 복구 터미널) 열고 아래 명령 후 재부팅하면 IQ로 돌아감 | 화면 사진, `/data/agnos-updater-ui.log` 내용 |
| 4-2 후 1시간 넘게 진행 없음 | 전원 유지, 화면 사진 | 사진, 경과 시간 |

```bash
cd /data/openpilot && git checkout --no-recurse-submodules -B iq-ha refs/remotes/origin/iq-ha
```

최후 수단(소프트웨어 복귀 불가 시): USB로 Comma 공식 OS 재설치 후 `installer.comma.ai/helico717/ha-back`.
기기 데이터 초기화를 동반할 수 있고 이 기기에서 시험하지 않았으므로, 진행 전 반드시 함께 확인합니다.

## 5. IQ 사용 중 업데이트

- 매일 04:17(한국 시간) GitHub 자동 작업이 IQ 원본 `release`를 확인합니다. 새 버전이면 `iq-ha`를 다시 조립하고
  HA 연동 시험을 통과한 경우에만 올립니다. IQ.OS 변경이나 연동 수정이 깨지는 경우에는 올리지 않고 멈춥니다(에이전트가 확인).
- 터미널 카드 커밋 줄에 `IQ.drive · … N개 커밋 뒤처짐`이 보이면, 주차 중에 **[📥 IQ.drive 업데이트]** → **[🔄 기기 재부팅]**.
  이 버튼은 `git pull --ff-only`로만 받으며 기기 파일을 강제로 지우지 않습니다. 기기에 변경이 있으면 멈춥니다.
- IQ 원본은 배포마다 이전 버전을 덮어쓰므로, 오래된 고정 번호는 원본 서버에서 사라질 수 있습니다.
  이미 설치된 기기는 받은 파일로 계속 동작합니다. 새로 설치·재설치할 때는 최신 `iq-ha`를 사용합니다.

## 6. 일시중지되는 기능 (IQ 사용 중)

- **당근 파라미터 카드:** 블러+안내. 조회 요청을 멈추고, 변경 요청은 HA가 거부합니다(복귀 후 뒤늦게 적용되는 사고 방지).
- **당근웹 로그 카드:** 블러+안내, 로그 화면 자체를 닫음. Comma의 로그·영상 업로드도 HA가 중지시킵니다.
- 저장된 로그 전송 설정(켜짐/꺼짐)은 바뀌지 않으며, 당근으로 돌아오면 자동으로 재개됩니다.

## 7. 유지되는 기능

차량 대시보드·엔터티, 주행/주차/충전 상태, 주행·충전 기록과 통계, 차계부 자동 인계, 주차·실시간 위치,
주차 카메라, 원격 터미널. 모두 코드상 연결돼 있으나 **실차 미검증**이며 3-4에서 처음 확인합니다.

## 8. 문제가 생기면 Mac에서 이렇게 알려 주세요

1. **그 자리에서 멈춥니다.** 같은 명령을 반복하거나 다른 방법을 시도하지 않습니다.
2. 이 대화에 다음을 붙여 넣습니다: 몇 절 몇 단계인지, 실행한 명령, **출력 전체**(터미널 카드에서 복사),
   기기 화면 사진(필요 시), 대략의 시각.
3. 토큰·비밀번호·HA 주소는 붙여 넣지 않습니다. 진단 출력에는 비밀값이 포함되지 않습니다.
4. 에이전트가 다음 행동을 알려 줄 때까지 재부팅·전원 차단을 하지 않습니다(단, 운전 중 이상은 즉시 안전 우선).

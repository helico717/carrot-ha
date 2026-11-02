# IQpilot + Carrot HA 시험 설치·당근 복귀 절차 (사용자 실행용)

작성: 2026-11-02 KST. 대상: Comma 4, 현재 당근 `5ec4868a` / OS `19.8-carrot-bt1`.

> **아직 실기에서 한 번도 설치·복귀해 본 적 없는 후보입니다.** 코드·CI·로컬 시험만 통과했습니다.
> IQ.OS 구동, 실제 CAN 값, 카메라 영상, 차계부 연속 기록, IQ.OS→당근 OS 복귀는 이 절차로
> 처음 확인합니다. 각 단계의 확인 결과를 에이전트에게 알려 주세요. 기기 설치·재부팅은 사용자가 합니다.

## 0. 고정 기준

| 항목 | 값 |
| --- | --- |
| 설치 후보 | `helico717/openpilot` 브랜치 `iq-ha`, 커밋 `a9edcebe183fde1654ad84f7c9f7948fd4a0aff2` |
| IQ 원본(하위 저장소) | `5c9291b9df6d90007d73ecd749b135bd5008e80d`, 기대 OS `IQ.OS 4.9.9.4` |
| 복귀 대상 | 브랜치 `ha-back` = `5ec4868a12a9038547b373eb95be3a5fa86d30aa` (자동 갱신 안 함) |
| 백업 | Mac `~/Developer/carrot-backups/carrot-20261102T021704563634Z.tar.gz` (검증 완료) |

모든 전환은 Git으로만 합니다. `git reset --hard`, `git clean`, 강제 checkout, 공장 초기화,
설정의 "제거(Uninstall)"는 쓰지 않습니다. "제거"는 `/data` 전체 초기화를 일으킬 수 있습니다.

## 1. 시작 전 확인 — 하나라도 아니면 시작하지 않습니다

- [ ] 차량이 **주차** 상태이고, 1~2시간 동안 Comma 전원이 끊기지 않습니다(충전 중이거나 12V 안정).
      OS 다운로드·기록 중 전원이 끊기면 복구가 어려워집니다.
- [ ] Comma가 **Wi-Fi**에 연결돼 있습니다. IQ 원본(약 1GB)과 IQ.OS(수 GB), 복귀 시 당근 OS(수 GB)를 받습니다.
- [ ] HA 대시보드의 **Comma 원격 터미널** 카드에 [연결]할 수 있습니다.
- [ ] 비상시 휴대폰으로 같은 Wi-Fi(또는 휴대폰 핫스팟)에서 Comma IP에 접속할 수 있습니다.
- [ ] **IQ.OS는 공개 다운로드가 아닙니다.** IQ의 OS 설치기는 IQ 서버(konn3kt)에 기기를 등록하고
      인증된 경로로만 이미지를 받습니다(직접 주소는 404 확인). 이때 기기 일련번호·IMEI·기기 공개키가
      IQ 서버로 전송됩니다(IQ 원본 `agnos.py`). 이에 동의할 때만 진행합니다.

## 2. 당근 → IQ 전환

HA 원격 터미널에서 한 줄씩 실행하고, 기대 결과와 다르면 즉시 멈추고 출력을 알려 주세요.

1. 추적 파일 변경이 없는지 확인합니다. **아무것도 출력되지 않아야** 합니다.

   ```bash
   cd /data/openpilot && git status --short --untracked-files=no
   ```

2. 후보를 받고 정확한 커밋인지 확인합니다. `IQ_HA_OK`가 나와야 합니다.

   ```bash
   cd /data/openpilot && git fetch --no-tags origin +refs/heads/iq-ha:refs/remotes/origin/iq-ha && test "$(git rev-parse refs/remotes/origin/iq-ha)" = a9edcebe183fde1654ad84f7c9f7948fd4a0aff2 && echo IQ_HA_OK
   ```

3. 후보로 전환합니다. 강제 옵션이 없으므로 충돌이 있으면 Git이 아무것도 바꾸지 않고 멈춥니다.

   ```bash
   cd /data/openpilot && git checkout --no-recurse-submodules -B iq-ha refs/remotes/origin/iq-ha
   ```

4. IQ 원본을 미리 받습니다(시간이 걸립니다). 마지막 줄이 `5c9291b9df6d90007d73ecd749b135bd5008e80d`여야 합니다.

   ```bash
   cd /data/openpilot && git submodule update --init --depth 1 -- vendor/iqpilot && git -C vendor/iqpilot rev-parse HEAD
   ```

5. 읽기 전용 원본 점검. `"passed": true`여야 합니다.

   ```bash
   cd /data/openpilot && /usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight --source-only
   ```

6. **바로** 터미널 카드의 [🔄 기기 재부팅]을 누릅니다. 오래 두면 당근의 백그라운드 업데이터가
   당근 업데이트를 준비해 둘 수 있습니다(재부팅 후 7단계에서 확인).

7. 첫 부팅에서 IQ 런처가 IQ.OS를 내려받아 다른 슬롯에 기록한 뒤 다시 재부팅합니다. 화면 표시 없이
   로고에 오래 머물 수 있습니다. **전원을 끊지 마세요.** IQ 화면이 뜨면 터미널을 다시 연결해 확인합니다.

   ```bash
   cat /VERSION; cd /data/openpilot && git rev-parse HEAD
   ```

   기대: `IQ.OS 4.9.9.4` 및 `a9edcebe…`. HEAD가 당근 커밋이면 당근 업데이트가 끼어든 것이니 알려 주세요.

**첫 부팅이 1시간 넘게 진행되지 않거나 오류 화면이면:** 아직 당근 OS이므로 IQ.OS 기록이 실패한 상태입니다.
이 단계에서는 HA 터미널과 당근 복구 터미널(6999)이 실행되지 않습니다. 먼저 에이전트에게 화면 내용을 알려 주세요.
기존에 SSH 키를 등록해 둔 경우에만 같은 네트워크에서 `ssh comma@<Comma IP>`(비상 복구 용도)로 접속해
아래 Git 복귀만 실행하고 재부팅합니다. 파일 편집·복사는 하지 않습니다.

```bash
cd /data/openpilot && bash bootstrap/switch_to_carrot.sh
```

## 3. IQ.OS에서의 확인 (주차 상태)

1. 읽기 전용 진단을 실행하고 **출력 전체를 에이전트에게 보내 주세요.** 비밀값은 출력하지 않습니다.
   카메라를 켜거나 CAN을 보내거나 재부팅하지 않습니다.

   ```bash
   cd /data/openpilot && /usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight
   ```

   - `passed`: IQ에서 HA 연동 실행 조건(ARM64·Python 3.12·원본 checkout·Params 키·MEB CAN parser·
     카메라 schema·영상 변환·OS·HA 연결 설정)이 모두 맞는지.
   - `carrot_return.verdict`: **당근 복귀 가능성.** IQ.OS는 기기 사용자 root를 제거하므로, 당근 OS 설치기가
     비활성 슬롯 파티션에 직접 쓸 수 있는지와 당근 런처가 요구하는 `/AGNOS` 표식을 읽기 전용으로 봅니다.
     `SOFTWARE_RETURN_BLOCKED`면 **소프트웨어 복귀를 시도하지 말고** 알려 주세요(5절).
     `SOFTWARE_RETURN_POSSIBLE_UNVERIFIED`도 슬롯 전환(abctl) 권한까지 보장하지는 않습니다.

2. 아래를 하나씩 확인해 결과를 알려 주세요.

   | 확인 | 방법 |
   | --- | --- |
   | HA 상태 신선도 | 대시보드 측정 시각이 갱신되고 기존 차량과 같은 기기로 이어지는지 |
   | 원격 터미널 | 카드 [연결]/재연결, 주행 시작 시 입력 차단 |
   | 주차 카메라 | 주차 중 영상 표시, 주행 시작 시 자동 종료. IQ Sentry/Live View 사용 중이면 시작이 막히는 것이 정상 |
   | 짧은 주행 | 차계부에 주행 1건과 거리·전비·SOC가 기록되는지 |
   | 충전 | 충전 1회가 충전 내역에 기록되는지 |
   | 로그·영상 | 주행 로그 화면에 새 구간과 영상이 올라오는지(당근 전용 분석은 호환을 주장하지 않음) |
   | 절전·재연결 | 주차 후 절전 → 다시 깨어날 때 HA 연결 복구 |

- 당근 **파라미터 카드는 쓰지 마세요**(동기화 중지). IQ 설정은 기기 화면에서 바꿉니다.
- IQ 설정의 업데이트/브랜치 선택으로 순정 IQ로 바꾸지 마세요. HA 연동이 사라집니다.

## 4. IQ → 당근 복귀

조건: 3절 진단의 `carrot_return.verdict`가 `SOFTWARE_RETURN_POSSIBLE_UNVERIFIED`, 주차, 전원·Wi-Fi 확보.

1. HA 원격 터미널에서 Git 복귀 스크립트를 실행합니다. 주행 중·변경된 추적 파일·예상과 다른 `ha-back`·
   덮어쓸 파일 충돌이 있으면 아무것도 바꾸지 않고 멈춥니다. 재부팅은 하지 않습니다.

   ```bash
   cd /data/openpilot && bash bootstrap/switch_to_carrot.sh
   ```

   기대: `CARROT_CHECKED_OUT 5ec4868a12a9038547b373eb95be3a5fa86d30aa`.

2. [🔄 기기 재부팅]을 누릅니다. 당근 런처가 OS가 다름을 감지해 당근 OS(`19.8-carrot-bt1`)를 받아
   기록하고 다시 재부팅합니다. **전원을 끊지 마세요.**

3. 화면에 `AGNOS update paused`가 뜨면 당근 OS 기록이 막힌 것입니다. 이때 IQ.OS는 그대로이므로
   IQ로 되돌릴 수 있습니다. 같은 네트워크의 휴대폰 브라우저에서 `http://<Comma IP>:6999`
   (당근 복구 터미널)를 열고 아래를 실행한 뒤 재부팅하세요. 그리고 `/data/agnos-updater-ui.log`를 알려 주세요.

   ```bash
   cd /data/openpilot && git checkout --no-recurse-submodules -B iq-ha refs/remotes/origin/iq-ha
   ```

4. 당근이 뜨면 확인합니다. 기대: `19.8-carrot-bt1`, `5ec4868a…`.

   ```bash
   cat /VERSION; cd /data/openpilot && git rev-parse HEAD
   ```

5. 운영 브랜치로 돌아갑니다. `ha-back`은 현재 운영 브랜치의 조상이라 빨리감기로만 갱신됩니다.

   ```bash
   cd /data/openpilot && git checkout carrot-wip-model_selector-ha && git pull --ff-only
   ```

   이후 재부팅. 당근 설정이 바뀌었으면 백업 전체를 덮어쓰지 말고, 에이전트와 함께 필요한 항목만
   골라 복원합니다(`IsOnroad` 같은 일시 플래그 제외).

참고: IQ.OS가 기록한 부팅 splash는 당근 OS 목록에 없어 복귀 후에도 IQ 화면으로 남을 수 있습니다(동작 영향 없음).
전환 후 `/data/openpilot`에는 이전 쪽의 무시 파일·하위 저장소 폴더가 남아 용량을 차지할 수 있습니다.
Git이 추적하지 않는 파일이므로 임의로 지우지 말고 필요하면 정리 방법을 함께 정합니다.

## 5. 소프트웨어 복귀가 막힌 경우

`SOFTWARE_RETURN_BLOCKED`이거나 4-3 이후에도 당근 OS 기록이 계속 실패하면 IQ를 유지한 채 멈추고
에이전트에게 진단 출력을 보내 주세요. 최후 수단은 USB로 Comma 공식 OS를 다시 설치한 뒤
`installer.comma.ai/helico717/ha-back`으로 당근을 설치하는 것입니다. 이 방법은 기기 데이터 초기화를
동반할 수 있어 Mac 백업에서 HA 연결·기록 설정을 선별 복원해야 하며, 아직 이 기기에서 시험하지 않았습니다.
진행 전 방법과 복원 범위를 먼저 함께 확인합니다.

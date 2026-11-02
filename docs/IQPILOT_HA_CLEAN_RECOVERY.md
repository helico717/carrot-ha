> **최신 4.9.9.9.2 기기 안내:** 2026-11-02 순정 업데이트 완료 후에는 [최신 HA 연결·업데이트 경로](IQPILOT_HA_UPDATE_PATH_2026-11-02.md)를 따릅니다. 아래 4.9.9.4/이전 SHA 전환 명령을 현재 기기에 실행하지 마세요.

# 플래싱 → 순정 IQpilot → HA 재연결

2026-11-02 준비. 실차 미검증인 복구 경로이며 자동 플래싱 프로그램이 아니다.
현재 정상 차량에는 실행하지 않는다. 사용자가 플래싱 및 순정 설치를 끝낸 경우에만 사용한다.

## 지금 보관한 것

- 전체 원본 백업: Mac `~/Developer/carrot-backups/carrot-20261102T021704563634Z.tar.gz`.
- HA 설정 전용 키트: Mac `~/Developer/carrot-ha/.private-recovery/iq-ha/`.
  `receiver.json`, `camera.json`에 비밀키가 있다. 파일 내용을 채팅·Git에 올리지 않는다.
- 원본 SHA256을 확인한 뒤 지정된 JSON 두 개만 추출했다. 차량 ID 일치와 파일 권한 확인.
  Params·차량 보정·주행 설정·DB·명령 큐·소스는 포함하지 않는다.
- 키트는 Mac 로컬 파일이므로 이 Mac을 잃으면 같이 사라진다. 기존 전체 백업과 함께
  사용자가 관리하는 암호화된 별도 백업에도 보관한다. HA 전체 백업은 계속 유지한다.
- 수신기 주소·키 또는 HA 카메라 키를 변경하면 이 키트는 오래된 것이다. 새 설정으로 재준비한다.

## 1. 순정 상태 확인 및 최초 접속

공식 복구/설치 절차는 실제 복구 시점에 IQ 제공 문서와 해당 기기에서 다시 확인한다.
순정 IQpilot이 정상 부팅하고 차량 설정까지 정상인 것을 먼저 확인한다.
같은 Wi-Fi는 통신 조건일 뿐이다. IQ 설정에서 SSH를 허용하고 Mac의 공개키가
등록돼 있어야 한다. 초기화 후 키 등록이 지워질 수 있다. 개인키는 Mac에만 둔다.
IQ.OS의 실제 SSH 응답에서 접속 계정은 iq로 확인했다. 현재 Mac 공개키는 아직 허용되지 않아 직접 로그인은 미확인이다. 연결이 안 되면 키 설정을 먼저 확인하고 중단한다.

Mac 터미널:

```sh
ssh -i ~/.ssh/carrot_recovery iq@차량IP
```

플래싱 후 호스트 키 변경 경고는 무시하지 않는다. 같은 기기의 새 키임을 확인하고
해당 IP의 이전 항목만 갱신한다. HA 터미널은 아직 없어도 된다.

## 2. 순정 IQ와 연동 후보의 원본 버전 대조

다음은 **차량 SSH 창**이다. 주차 및 전원 유지 상태에서 진행한다.

```sh
cd /data/openpilot
git status --short
git rev-parse HEAD
cat /VERSION
cat /data/params/d/IsOffroad
cat /data/params/d/IsOnroad
```

작업 트리가 깨끗하고 IsOffroad=1, IsOnroad=0이어야 한다. 출력이 없거나 다르면 중단한다.
준비 당시 후보는 `9637e6c6e8287c96dbf12de7b79bb2cef3b585f5`,
원본 IQ는 `5c9291b9df6d90007d73ecd749b135bd5008e80d`, 기대 OS는 4.9.9.4이다.
현재 순정 HEAD/OS가 이와 다르면 아래 전환을 실행하지 않는다. 새 IQ와 일치하는 후보를
조립·검증한 후 이 문서의 두 SHA를 함께 갱신해야 한다. 자동 갱신은 실차 검증을 뜻하지 않는다.

## 3. Git으로 HA 연동 후보 설치

이 절차는 순정 IQpilot을 HA 포함 후보로 전환한다. 소스 수동 복사·패치는 없다.
이 단계가 실패하면 재부팅하지 말고 오류를 확인한다. reset/clean으로 강제 진행하지 않는다.

```sh
cd /data/openpilot
test "$(git rev-parse HEAD)" = 5c9291b9df6d90007d73ecd749b135bd5008e80d && test -z "$(git status --porcelain)" && test "$(cat /data/params/d/IsOffroad)" = 1 && test "$(cat /data/params/d/IsOnroad)" = 0 && echo READY
```

READY가 있을 때만 다음을 실행한다. 기존 iq-ha 브랜치가 있으면 중단한다.

```sh
git fetch https://github.com/helico717/openpilot.git refs/heads/iq-ha
test "$(git rev-parse FETCH_HEAD)" = 9637e6c6e8287c96dbf12de7b79bb2cef3b585f5 && git checkout --no-recurse-submodules -b iq-ha FETCH_HEAD
```

성공한 경우에만:

```sh
git submodule update --init --depth 1 -- vendor/iqpilot
git -C vendor/iqpilot rev-parse HEAD
```

원본 IQ SHA와 일치해야 한다. 다음으로 origin을 HA 후보 저장소로 연결한다.

```sh
git remote set-url origin https://github.com/helico717/openpilot.git
git fetch origin iq-ha
git branch --set-upstream-to=origin/iq-ha iq-ha
/usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight
```

진단 오류는 우회하지 않는다. 아직 소프트웨어가 실행 중인 상태에서 파일이 바뀌었으므로
장시간 방치하거나 차량을 움직이지 않는다. 순정으로 재부팅해 버리지 않도록 이 절차를 이어 진행한다.

## 4. 수신기 연결 복원 — Mac 창

차량 창은 유지하고 Mac 터미널을 하나 더 연다. 차량IP는 실제 IP로 바꾼다.
다음 명령은 Git에 들어 있는 차량 설정 프로그램만 호출한다. 비밀키는 SSH 표준입력으로 전달되며
명령 인자·화면에 출력하지 않는다. 차량 ID를 새로 생성하지 않는다.

```sh
cd ~/Developer/carrot-ha
python3 tools/receiver-recovery.py --iqpilot --host 차량IP --identity ~/.ssh/carrot_recovery --config .private-recovery/iq-ha/receiver.json
```

## 5. 카메라 연결 복원 — 차량 창

```sh
cd /data/openpilot
/usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.camera.configure --disable
/usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.camera.configure
```

Mac의 비공개 `camera.json`을 로컬 편집기에서 열고, 질문에 `ha_url`, `device_id`,
`camera_token`을 순서대로 입력한다. camera_token은 기존 키를 입력하며 빈 값으로 새로 생성하지 않는다.
파일이나 화면을 타인에게 공유하지 않는다. 저장 후:

```sh
/usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.camera.configure --enable
```

IQ FastSleep은 기기에서 끈다. 기기 재부팅은 사용자가 IQ.OS에서 제공하는 메뉴로 수행한다.
IQ.OS에 sudo가 있다고 가정하지 않는다.

## 6. 복구 완료 판단

기존 HA 차량에서 측정 시각이 갱신되는지, 이전 차계부가 남아 있는지 확인한다.
주차 상태 카메라 영상과 HA 원격 터미널 재연결을 각각 확인한다.
그 후 안전한 환경에서 짧은 운행/충전 기록이 기존 차량으로 추가되는지 확인한다.
초기화로 지워진 기기 안 미전송 기록까지 이 키트가 복원하는 것은 아니다.
당근 파라미터/당근 전용 로그 화면의 IQ 일시중지 상태를 확인한다.

이 절차는 IQ 상태에서 HA를 복구하는 경로이다. IQ.OS에서 당근 OS로 돌아가는 문제는
별도 매뉴얼 `IQPILOT_HA_INSTALL_AND_RETURN.md`의 진단·복귀 조건을 따른다.

## 준비 시 검증 / 남은 확인

설정 키트 생성 및 원본 해시·ID·권한 검사, 합성 백업 allowlist/해시/덮어쓰기 거절,
SSH 설정 전달 회귀 시험을 수행했다. 순정 IQ의 SSH 접속, 실제 checkout·IQ.OS 권한,
실차 카메라/수집/기존 차계부 연속성은 미검증이다. 이 문서만으로 실차 검증 완료를 주장하지 않는다.

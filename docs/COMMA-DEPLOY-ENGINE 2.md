# comma 수집기 교체: 충전 감지 유지 + 주차 보고 60초 (2026-09-15)

이 문서는 Mac의 수정본을 comma의 `/data/id4-collector/engine.py`에 설치하는 절차입니다.
이번 버전은 충전 감지 로직을 유지하면서 보고 조건만 원래대로 되돌립니다.

- 주행: 30초. 일반 주차 및 주차 중 충전: 60초.
- 충전 확정 순간의 추가 즉시 보고도 제거합니다. 다음 정기 보고에 반영됩니다.
- 주행/주차 모드 변경 시 보고는 기존대로 유지합니다.
- 몇 시간 뒤 오프라인이 되는 원인이 보고 주기 때문인지는 확인되지 않았습니다. 이번 변경은 그 문제의 해결을 보장하지 않습니다.
- 이번에는 로컬 수정본만 준비합니다. 커밋·push 없이 배포할 수 있습니다.

## 작업 전 준비

- 차량이 **일반 주차 상태이며 주행·충전 중이 아닐 때** 작업합니다.
- Mac 터미널 두 개를 준비합니다. 하나는 파일 전송용, 다른 하나는 comma SSH용입니다.
- 아래 `<COMMA_IP>`를 실제 IP로 바꿉니다. 꺾쇠까지 그대로 입력하지 않습니다.
- 기존에 사용하던 SSH 키·접속 설정을 사용합니다.
- SSH 포트가 8022라면 `ssh -p 8022`, **모든 scp 명령에 `scp -P 8022`**를 사용합니다. 키 파일이 필요하면 기존처럼 `-i 키파일경로`를 추가합니다.
- 명령은 단계별로 실행합니다. **파일 준비·백업·문법 검사·해시 비교에 실패하면 다음 단계로 넘어가지 않습니다.**
- 설치 경로나 실행 명령이 이 문서와 다르면 아래 종료 명령을 임의로 넓혀 실행하지 말고, 기존 설치 방식을 먼저 확인합니다.

## 1. Mac: 수정본을 미리 준비

comma를 정지하기 전에 실행합니다. 아래 명령이 실패하면 정지 작업을 시작하지 않습니다.

```bash
cd /Users/davidlim/Documents/carrot-ha
cp collector/engine.py /tmp/engine_new.py &&
python3 -m py_compile /tmp/engine_new.py &&
shasum -a 256 /tmp/engine_new.py
```

출력된 해시를 보관합니다. **이번에는 로컬 작업 파일을 복사합니다. 이전 `git show codex/charging-validation:...` 명령을 사용하면 30초 충전 보고 버전을 가져올 수 있으므로 사용하지 마세요.**

출발 전에 새 버전의 보고 조건을 확인합니다.

```bash
grep -n 'interval=30 if onroad else 60' /tmp/engine_new.py
grep -n 'charging_started' /tmp/engine_new.py
```

첫 번째는 결과가 나오고, 두 번째는 결과가 없어야 합니다. 두 번째 명령의 종료 코드 1은 정상입니다.

## 2. Mac: comma SSH 접속

```bash
ssh comma@<COMMA_IP>
```

이후 `[comma]` 단계는 이 SSH 터미널에서 실행합니다. `[Mac]` 단계는 별도 Mac 터미널에서 실행합니다.

## 3. comma: 설치 상태 확인 및 기존 코드 백업

```bash
ls -l /data/id4-collector/engine.py /data/id4-collector/supervisor.sh
pgrep -af '^bash /data/id4-collector/supervisor.sh$'
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
```

수집기가 원래 실행 중이었다면 위 두 프로세스가 보여야 합니다. 다른 실행 명령을 사용한다면 여기서 멈추고 설치 상태를 확인합니다.

이번 변경 이전 파일을 한 번만 보관합니다. `cp -n`은 같은 이름의 백업이 있으면 덮어쓰지 않습니다.

```bash
cp -n /data/id4-collector/engine.py /data/id4-collector/engine.py.before-parking60-20260915
ls -l /data/id4-collector/engine.py.before-parking60-20260915
/usr/local/venv/bin/python3 -m py_compile /data/id4-collector/engine.py.before-parking60-20260915
```

이미 이 이름의 백업이 있다면 이번 60초 버전 적용 직전 파일인지 확인합니다. 최초 오감지 수정 전 백업은 별도로 보존합니다. 새 코드로 덮어쓰지 않습니다.

### Mac: 원본도 내려받기

별도 Mac 터미널에서 실행합니다. 백업은 저장소 밖에 보관합니다.

```bash
scp comma@<COMMA_IP>:/data/id4-collector/engine.py.before-parking60-20260915 ~/Downloads/engine.py.before-parking60-20260915
```

Mac에 같은 이름의 파일이 있으면 먼저 다른 이름으로 보관하세요.

## 4. Mac: 수정본을 임시 이름으로 전송

실행 파일을 바로 덮어쓰지 않습니다.

```bash
scp /tmp/engine_new.py comma@<COMMA_IP>:/data/id4-collector/engine.py.new
```

### comma: 임시 파일 검증

```bash
/usr/local/venv/bin/python3 -m py_compile /data/id4-collector/engine.py.new &&
sha256sum /data/id4-collector/engine.py.new
```

**문법 오류가 없어야 하고, 해시 문자열은 1단계 Mac 출력과 정확히 같아야 합니다.** 경로 이름은 달라도 됩니다. 불일치하면 다시 전송하고 검사합니다. 아직 기존 수집기는 계속 실행 중입니다.

## 5. comma: 수집기만 정지

부팅 훅을 제거하는 `disable.py`는 실행하지 않습니다.

```bash
rm -f /data/id4-collector/enabled
pkill -f '^bash /data/id4-collector/supervisor.sh$'
pkill -f '^/usr/local/venv/bin/python3 -u collector.py$'
```

프로세스가 없으면 `pkill`이 종료 코드 1을 반환할 수 있습니다. 그것만으로 오류는 아닙니다.

잠시 기다린 다음 확인합니다.

```bash
pgrep -af '^bash /data/id4-collector/supervisor.sh$'
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
```

**둘 다 출력이 없어야 다음으로 진행합니다.** 남아 있으면 잠시 후 다시 확인합니다. 계속 남으면 파일을 교체하지 말고 해당 프로세스를 확인하세요. 광범위한 `pkill`이나 `pkill -9`를 일괄 실행하지 않습니다.

## 6. comma: 검증한 파일 적용

```bash
/usr/local/venv/bin/python3 -m py_compile /data/id4-collector/engine.py.new &&
mv /data/id4-collector/engine.py.new /data/id4-collector/engine.py &&
sha256sum /data/id4-collector/engine.py
```

해시가 Mac의 원본 해시와 같은지 다시 확인합니다. 명령이 실패하면 재시작하지 말고 아래 롤백 절차로 원본을 복구합니다.

## 7. comma: 재시작

```bash
touch /data/id4-collector/enabled &&
nohup bash /data/id4-collector/supervisor.sh >/dev/null 2>&1 < /dev/null &
```

잠시 기다린 후 확인합니다.

```bash
pgrep -af '^bash /data/id4-collector/supervisor.sh$'
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
tail -n 40 /data/id4-collector/collector.log
```

두 프로세스가 보여야 합니다. 시작 직후에는 잠시 후 다시 확인하세요. 로그의 과거 오류와 이번 시작 이후 오류를 구분합니다.

## 8. comma: 정상 동작 확인

```bash
/usr/local/venv/bin/python3 /data/id4-collector/status.py
```

60~90초 후 한 번 더 실행합니다.

```bash
/usr/local/venv/bin/python3 /data/id4-collector/status.py
```

확인 기준:

- `status.json`의 `at`이 갱신되고 `age_seconds`가 작게 유지됩니다.
- 네트워크가 정상이면 `delivery.json`의 상태가 `ok`이고 전송 시각이 갱신됩니다.
- 미전송 건수 `pending`이 계속 증가하지 않아야 합니다. 일시적인 대기 건수 자체는 실패가 아닙니다.
- 일반 주차 보고는 60초 주기이므로 전송 시각이 항상 수초 이내일 필요는 없습니다.
- 차량이 잠들면 CAN 데이터가 없을 수 있습니다. 오래된 배터리 값이나 충전 여부 `unknown`만으로 설치 실패라고 판단하지 않습니다.
- 정상 CAN 샘플마다 로그를 출력하지 않습니다. **로그가 약 30초마다 갱신될 필요는 없습니다.** 반복적인 traceback·업로드 오류를 확인합니다.

필요하면 실시간 로그를 봅니다. `Ctrl+C`는 로그 보기만 종료합니다.

```bash
tail -f /data/id4-collector/collector.log
```

### 이후 실제 충전에서 확인할 사항

- 충전 중에도 주차 상태이면 60초 주기로 보고합니다. 충전 확정 순간의 추가 보고는 없습니다.
- 충전 종료 전후 모두 주차 보고는 60초입니다. 주행 중은 기존처럼 30초입니다.
- 작은 에너지 증가는 확인 시간이 생길 수 있습니다. SOC와 추정 전력은 확정 전에도 보고합니다.
- 종료 판정은 즉시가 아닙니다. 유효한 증가가 300초 동안 없거나 주행을 시작하면 세션을 닫습니다. 배터리 측정이 120초 넘게 끊기면 충전 여부는 알 수 없음으로 전환됩니다.
- 60초 전송이 매번 새로운 전력 계산이나 60초 간격 HA 알림을 보장하지 않습니다. 측정 주기·클라우드 조회·알림 자동화 조건의 영향이 있습니다.

## 문제가 생겼을 때: comma에서 코드 롤백

**이번 60초 변경 직전 코드로 원복합니다.** 따라서 이전에 30초 충전 보고 버전을 사용했다면 그 버전으로 돌아갑니다. 최초 오감지 수정 전 버전으로 복원하는 절차가 아닙니다. **코드만 원복합니다.** 이미 저장·전송된 충전량이나 비용은 자동 취소되지 않습니다. 오래된 DB를 무조건 덮어쓰면 최신 기록을 잃거나 대기 데이터를 재전송할 수 있으므로 DB는 그대로 둡니다.

### A. 먼저 백업 존재 확인

```bash
ls -l /data/id4-collector/engine.py.before-parking60-20260915
/usr/local/venv/bin/python3 -m py_compile /data/id4-collector/engine.py.before-parking60-20260915
```

실패하면 복구를 계속하지 않습니다. Mac에 보관한 원본을 다시 가져와야 합니다.

### B. 수집기 정지

```bash
rm -f /data/id4-collector/enabled
pkill -f '^bash /data/id4-collector/supervisor.sh$'
pkill -f '^/usr/local/venv/bin/python3 -u collector.py$'
```

잠시 후 아래 두 명령의 출력이 없는지 확인합니다.

```bash
pgrep -af '^bash /data/id4-collector/supervisor.sh$'
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
```

### C. 원본을 임시 파일로 복사·검증 후 교체

```bash
cp /data/id4-collector/engine.py.before-parking60-20260915 /data/id4-collector/engine.py.restore &&
/usr/local/venv/bin/python3 -m py_compile /data/id4-collector/engine.py.restore &&
mv /data/id4-collector/engine.py.restore /data/id4-collector/engine.py
```

**모두 성공했을 때만** 다음을 실행합니다.

```bash
touch /data/id4-collector/enabled &&
nohup bash /data/id4-collector/supervisor.sh >/dev/null 2>&1 < /dev/null &
```

7~8단계의 프로세스·로그·상태 확인을 다시 수행합니다. 이번 변경은 부팅 훅을 수정하지 않으므로 `/data/continue.sh`를 복원할 필요가 없습니다.

## 연결이 중간에 끊겼다면

다시 SSH로 접속해 아래를 확인합니다.

```bash
ls -l /data/id4-collector/enabled /data/id4-collector/engine.py /data/id4-collector/engine.py.before-parking60-20260915
sha256sum /data/id4-collector/engine.py
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
```

`enabled`가 없다는 출력은 수집기가 비활성화되어 있다는 뜻입니다. 현재 engine.py의 해시가 준비한 수정본과 같은지 확인해 7단계로 진행하거나, 확신이 없으면 원본 롤백 절차를 따릅니다. Git 브랜치 변경·revert만으로 comma 파일이 돌아가지는 않습니다.

## 다시 몇 시간 뒤 오프라인이 된다면

재시작 전에 가능하면 아래 결과를 보관합니다. 설정 파일에는 토큰이 있으므로 출력하지 않습니다.

```bash
date
uptime
pgrep -af '^bash /data/id4-collector/supervisor.sh$'
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
/usr/local/venv/bin/python3 /data/id4-collector/status.py
tail -n 80 /data/id4-collector/collector.log
```

SSH 자체가 안 되는지, SSH는 되지만 수집기가 멈췄는지, 프로세스는 있지만 전송이 실패하는지 구분해 기록하세요. 장치 전원·절전·네트워크 문제는 보고 주기만 바꿔 해결되지 않을 수 있습니다.

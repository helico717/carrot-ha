# Comma 4 수집기(engine.py) 배포 및 검증 가이드

Comma 장치(Comma 3 / 3X / 4)에서 실행 중인 Carrot HA 수집기(`id4-collector`)의 **충전 노이즈 검증 로직(`engine.py`)**을 안전하게 교체하고 확인하는 단계별 가이드입니다.

---

## 📌 작업 전 준비사항

1. **Comma IP 확인**: Comma 기기 화면의 `Settings(설정) -> Network(네트워크)`에서 Wi-Fi IP 주소를 확인합니다. (예: `192.168.0.50`)
2. **Mac 터미널 환경**: Mac 터미널에서 작업하며, Comma의 기본 계정은 `comma`입니다.
3. **작업 위치 안내**:
   - 💻 `[Mac]` : Mac 터미널에서 실행하는 커맨드
   - 📱 `[Comma]` : Comma SSH 세션 내부에서 실행하는 커맨드

> [!NOTE]
> 커맨드 내 `<COMMA_IP>` 부분은 실제 본인 Comma의 IP 주소(예: `192.168.0.50`)로 변경하여 입력하세요.

---

## 🚀 전체 작업 흐름 요약

| 순서 | 작업 내용 | 실행 위치 | 핵심 커맨드 |
|:---:|:---|:---:|:---|
| 0 | 수정된 `engine.py` 준비 | 💻 `[Mac]` | `git show codex/charging-validation:collector/engine.py > ...` |
| 1 | Comma SSH 접속 | 💻 `[Mac]` | `ssh comma@<COMMA_IP>` |
| 2 | 기존 수집기 정지 | 📱 `[Comma]` | `rm -f /data/id4-collector/enabled && pkill -f ...` |
| 3 | 정지 상태 확인 | 📱 `[Comma]` | `pgrep -fa collector` |
| 4 | 기존 `engine.py` 백업 | 📱/💻 | `cp` (콤마 내부) 및 `scp` (Mac으로 복사) |
| 5 | 수정된 `engine.py` 전송 | 💻 `[Mac]` | `scp <새파일> comma@<COMMA_IP>:/data/id4-collector/engine.py` |
| 6 | 파일 적용 및 문법 검증 | 📱 `[Comma]` | `py_compile`, `grep`, `diff` |
| 7 | 수집기 재시작 | 📱 `[Comma]` | `touch enabled && nohup bash supervisor.sh ... &` |
| 8 | 정상 동작 및 로그 확인 | 📱 `[Comma]` | `pgrep`, `tail -f collector.log`, `status.py` |

---

## 🛠️ 단계별 상세 절차

### 0단계. [Mac] 수정된 `engine.py` 배포 파일 준비

Mac 터미널(저장소 폴더: `/Users/davidlim/Documents/carrot-ha`)에서 충전 검증 로직이 포함된 브랜치(`codex/charging-validation`)의 최신 `engine.py`를 임시 배포용 파일로 추출합니다.

```bash
cd /Users/davidlim/Documents/carrot-ha

# 충전 검증 커밋이 반영된 engine.py를 배포용 파일(/tmp/engine_new.py)로 추출
git show codex/charging-validation:collector/engine.py > /tmp/engine_new.py

# 파일이 정상적으로 추출되었는지 확인 (검증 함수 _sample_energy 검색)
grep -n "_sample_energy" /tmp/engine_new.py
```
> 출력이 1줄 이상 나오면 정상적으로 준비된 것입니다.

---

### 1단계. [Mac] Comma SSH 접속

Mac 터미널에서 Comma로 SSH 접속합니다.

```bash
ssh comma@<COMMA_IP>
```
*(기본 포트는 22번입니다. 만약 포트가 8022번인 환경이라면 `ssh -p 8022 comma@<COMMA_IP>`로 접속하세요.)*

접속이 완료되면 콤마의 프롬프트(`comma@comma:...$`)가 나타납니다.

---

### 2단계. [Comma] 기존 수집기 정지

수집기 감시 스크립트(`supervisor.sh`)의 자동 재시작을 방지하기 위해 플래그 파일(`enabled`)을 먼저 제거한 후 실행 중인 프로세스를 종료합니다.

```bash
# 1. 자동 재시작 방지 (enabled 파일 제거)
rm -f /data/id4-collector/enabled

# 2. 감시자 및 수집기 프로세스 종료
pkill -f 'supervisor.sh'
pkill -f 'collector.py'
```

> [!TIP]
> `disable.py`를 실행하면 `/data/continue.sh`의 부팅 훅까지 지워지므로, 파일 교체 시에는 위와 같이 `enabled` 플래그 제거 후 `pkill`하는 방식이 부팅 구성을 보존하면서 가장 깔끔합니다.

---

### 3단계. [Comma] 수집기가 정상적으로 정지되었는지 확인

실행 중인 수집기 프로세스가 남아있는지 확인합니다.

```bash
pgrep -fa 'collector'
```

**확인 기준:**
- 아무런 출력도 나오지 않거나, 내가 방금 친 명령어 외에 프로세스가 표시되지 않으면 **정상 정지**된 상태입니다.
- 만약 여전히 PID 번호와 함께 `/usr/local/venv/bin/python3 -u collector.py`가 남아있다면 강제 종료합니다:
  ```bash
  pkill -9 -f 'collector.py'
  ```

---

### 4단계. [Comma & Mac] 기존 engine.py 복사본 저장 (백업)

만약의 상황에 즉시 롤백할 수 있도록 기존 정상 작동 파일을 Comma 내부와 Mac 양쪽에 백업합니다.

#### 1) Comma 내부 백업 [Comma]
Comma SSH 터미널에서 실행:
```bash
cp /data/id4-collector/engine.py /data/id4-collector/engine.py.bak_$(date +%Y%m%d_%H%M%S)
cp /data/id4-collector/engine.py /data/id4-collector/engine.py.bak
```

#### 2) Mac으로 복사본 가져오기 [Mac]
**새 Mac 터미널 창**을 열고 아래 커맨드를 실행하여 Mac 로컬에도 저장합니다:
```bash
scp comma@<COMMA_IP>:/data/id4-collector/engine.py /Users/davidlim/Documents/carrot-ha/collector/engine.py.bak_from_comma
```

---

### 5단계. [Mac] 수정된 engine.py를 Comma에 전송

Mac 터미널에서 0단계에서 준비한 수정본을 Comma의 수집기 디렉토리로 복사합니다.

```bash
scp /tmp/engine_new.py comma@<COMMA_IP>:/data/id4-collector/engine.py
```
*(비밀번호를 묻는 경우 Comma SSH 비밀번호 입력)*

---

### 6단계. [Comma] 파일이 정상적으로 들어갔는지 확인 및 문법 검증

Comma SSH 터미널로 돌아와 파일이 온전히 들어갔는지 4가지 방법으로 검증합니다.

```bash
# 1. 파일 크기 및 수정 시간 확인
ls -l /data/id4-collector/engine.py

# 2. 신규 충전 검증 로직 키워드 확인
grep -n "_sample_energy" /data/id4-collector/engine.py
grep -n "charge_candidate" /data/id4-collector/engine.py

# 3. 기존 백업 파일과의 변경점(Diff) 확인
diff -u /data/id4-collector/engine.py.bak /data/id4-collector/engine.py

# 4. Python 문법(Syntax Error) 무결성 검증
/usr/local/venv/bin/python3 -m py_compile /data/id4-collector/engine.py
```

**확인 기준:**
- `grep` 결과에 `_sample_energy`, `charge_candidate` 라인이 출력되어야 합니다.
- `diff`에서 `_sample_energy` 함수 추가 및 충전 감지 판정 로직 변경이 보여야 합니다.
- `py_compile` 실행 후 아무런 에러 메시지 없이 프롬프트가 떨어지면 문법 오류가 없는 것입니다.

---

### 7단계. [Comma] 수집기 시작

`enabled` 플래그를 다시 생성하고, 백그라운드 수집기 프로세스를 시작합니다.

```bash
# 1. 수집기 활성화 플래그 생성
touch /data/id4-collector/enabled

# 2. 백그라운드로 수집기 감시 프로세스 시작
cd /data/id4-collector
nohup bash /data/id4-collector/supervisor.sh >/dev/null 2>&1 < /dev/null &
```

---

### 8단계. [Comma] 수집기가 정상적으로 시작했는지 확인

#### 1) 프로세스 동작 확인
```bash
pgrep -fa 'collector'
```
출력에 다음 두 프로세스가 모두 보여야 합니다:
- `bash /data/id4-collector/supervisor.sh`
- `/usr/local/venv/bin/python3 -u collector.py`

#### 2) 실시간 로그 확인
```bash
tail -f /data/id4-collector/collector.log
```
- CAN 샘플링 주기(~26초)에 맞춰 에러 없이 로그가 갱신되는지 확인합니다.
- `Ctrl + C`를 눌러 로그 보기를 종료합니다.

#### 3) 전송 상태 확인 스크립트 실행
```bash
python3 /data/id4-collector/status.py
```
- `status.json` 및 `delivery.json`의 `age_seconds`가 최신 상태(수십 초 이내)인지 확인합니다.

---

## ⏪ 롤백(원상 복구) 절차

새 `engine.py` 적용 후 예기치 않은 오류가 발생할 경우, 언제든 이전 상태로 즉시 되돌릴 수 있습니다.

Comma SSH 터미널에서 아래 커맨드를 한 번에 실행합니다:

```bash
# 1. 실행 중인 프로세스 정지
rm -f /data/id4-collector/enabled
pkill -f 'supervisor.sh'
pkill -f 'collector.py'

# 2. 백업 파일로 원복
cp /data/id4-collector/engine.py.bak /data/id4-collector/engine.py

# 3. 수집기 재시작
touch /data/id4-collector/enabled
cd /data/id4-collector
nohup bash /data/id4-collector/supervisor.sh >/dev/null 2>&1 < /dev/null &

# 4. 확인
pgrep -fa 'collector'
tail -n 20 /data/id4-collector/collector.log
```

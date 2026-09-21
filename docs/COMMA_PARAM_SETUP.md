# 콤마(Comma 3/3X) 기기 업데이트 및 설정 가이드

홈 어시스턴트(HA)에서 CarrotPilot 파라미터를 원격으로 제어하기 위해 콤마 기기 내에 적용해야 하는 파일과 절차 안내입니다.

> [!NOTE]
> **CarrotPilot 자체 소스코드는 변경할 필요가 없습니다.**
> CarrotPilot(`ajouatom/openpilot`)은 이미 자체적으로 포트 7000번에서 웹 서버(`carrot_server`)를 구동하고 있습니다. 따라서 CarrotPilot 내부 코드를 수정할 필요 없이, 콤마에 설치된 **Carrot HA 수집기 폴더(`collector`)**에 신규 동기화 모듈을 추가하고 수집기를 재시작하기만 하면 됩니다.

---

## 1. 변경 및 추가할 파일 목록

콤마 기기 내부(기본 설치 경로: `/data/id4-collector/`)에 다음 2개 파일이 필요합니다.

| 파일명 | 구분 | 설명 |
| :--- | :--- | :--- |
| `param_sync.py` | **[신규 추가]** | 포트 7000의 설정 스냅샷을 Cloudflare로 업로드하고, HA의 변경 요청 큐를 받아 로컬에 즉시 적용하는 모듈 |
| `collector.py` | **[업데이트]** | 백그라운드 스레드로 `param_sync`를 자동 구동하도록 연결 |

---

## 2. 콤마 기기에 파일 적용하는 방법

SSH 또는 콤마 웹 터미널(`http://<콤마IP>:7000`의 Terminal 탭)에 접속하여 아래 명령을 수행합니다.

### 방법 A: SCP로 로컬 PC에서 콤마로 바로 전송 (추천)
PC의 터미널(맥/윈도우)에서 `carrot-ha` 저장소 폴더로 이동한 후 실행합니다.
*(콤마 IP가 `192.168.x.x`인 경우)*

```bash
# param_sync.py 전송
scp collector/param_sync.py comma@<콤마-IP>:/data/id4-collector/param_sync.py

# 업데이트된 collector.py 전송
scp collector/collector.py comma@<콤마-IP>:/data/id4-collector/collector.py
```

---

### 방법 B: 콤마 SSH 터미널에서 직접 복사/다운로드

콤마 SSH 터미널(`ssh comma@<콤마-IP>`)에 접속한 상태에서:

```bash
cd /data/id4-collector

# 1. param_sync.py 파일이 없으면 생성 또는 git pull/curl로 가져옵니다.
# (GitHub 또는 PC 공유 서버에서 다운로드)
# curl -fsSL https://raw.githubusercontent.com/<당신의_저장소>/main/collector/param_sync.py -o /data/id4-collector/param_sync.py
# curl -fsSL https://raw.githubusercontent.com/<당신의_저장소>/main/collector/collector.py -o /data/id4-collector/collector.py
```

---

## 3. 동작 테스트 및 서비스 재시작

### 1) 동기화 단독 테스트
콤마 터미널에서 아래 명령을 실행하여 정상적으로 스키마를 읽고 Cloudflare로 업로드하는지 확인합니다:

```bash
cd /data/id4-collector
python3 param_sync.py
```

**정상 출력 예시:**
```
[param_sync] starting CarrotPilot parameter sync loop
[param_sync] settings snapshot synced to cloud (1735689650)
```
*(확인 후 `Ctrl + C`로 종료)*

---

### 2) 상시 수집기 재시작

수집기 프로세스를 재시작하면 `supervisor.sh`가 업데이트된 `collector.py`와 `param_sync.py`를 자동으로 함께 구동합니다.

```bash
# 실행 중인 기존 수집기 종료 (supervisor가 2초 내 자동 재시작)
pkill -f "python3.*collector.py"

# 또는 기기 재부팅
# sudo reboot
```

---

## 4. 최종 확인 체크리스트

1. **콤마 프로세스 확인**:
   ```bash
   ps aux | grep -E "collector\.py|param_sync"
   ```
   `collector.py` 프로세스가 정상 실행 중인지 확인합니다.

2. **홈 어시스턴트 카드 확인**:
   - HA 대시보드에서 `custom:carrot-params-card`를 추가합니다.
   - 상단 카테고리 탭(주행 제어, 버튼·프리셋, 조향 등)과 파라미터들이 정상적으로 로드되는지 확인합니다.
   - 파라미터를 클릭하여 **한글 상세 설명문(`descr`)**이 펼쳐지는지 확인합니다.
   - 토글이나 스텝 버튼을 조작했을 때 `⏳ 대기` 상태를 거쳐 잠시 후 `✓ 적용 완료`로 바뀌는지 확인합니다.

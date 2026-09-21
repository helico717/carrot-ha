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

> [!IMPORTANT]
> **파라미터 변경 안전 정책 (v0.6.1+ 반영)**:
> `param_sync.py`는 기기의 활성 카탈로그에 존재하는 파라미터 및 허용 범위 내 값만 검증하여 수용합니다.
> 변경 요청은 반드시 로컬 당근 웹 서버 API(`http://127.0.0.1:7000/api/param_set`)를 통해 적용되며, 적용 직후 실제 저장된 값을 다시 읽어 검증한 후 Cloudflare 큐에 완료(Ack)를 전송합니다.
> **직접 `Params()` 쓰기 우회(Fallback)는 안전 및 정합성 보장을 위해 전면 배제**되어 있으므로 로컬 7000번 포트 서버가 정상 구동 중이어야 합니다.

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
```text
[param_sync] starting CarrotPilot parameter sync loop for device: <DEVICE_ID>
[param_sync] target Cloudflare Worker: https://<your-worker>.workers.dev
[param_sync] loaded settings snapshot from local carrot_server (:7000)
[param_sync] uploading 185 parameters to Cloudflare...
[param_sync] settings snapshot synced to cloud successfully! (185 params)
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
   `collector.py` 프로세스가 정상 실행 중이고 내부에서 `param_sync` 스레드가 구동되는지 확인합니다.

2. **홈 어시스턴트 카드 확인**:
   - HA 대시보드에서 `custom:carrot-params-card`를 추가합니다 (대시보드 리소스 `/carrot_ha_static/carrot-dashboard.js`에 포함됨).
   - 카드 상단에 상태 스트립(연결 상태 배지, 마지막 수신 시각, 새로고침 버튼)이 정상 표시되는지 확인합니다.
   - 콤마의 실제 당근 웹과 동일한 카테고리 계층(주행 제어, 차선 변경, 버튼/프리셋 등), 토글 스위치, 숫자 스텝퍼, 선택 팝업 다이얼로그가 렌더링되는지 확인합니다.
   - 항목 클릭 시 GitHub Wiki(`Settings-Catalog.json`)와 연동된 상세 Markdown 문서가 열리는지 확인합니다.
   - 파라미터를 변경했을 때 상단 상태에 `대기 N건`이 표시되고, 콤마가 로컬 서버를 통해 변경을 적용하고 확인을 반환하면 `✓ Comma 적용 확인`으로 갱신되는지 확인합니다.

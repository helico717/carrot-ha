# 콤마 수집기 업데이트: 키 ON 충전 검증

이번 버전은 `collector.py`와 `engine.py`를 함께 교체합니다. engine.py만 교체하는 과거 절차는 사용하지 마세요.
판정 기준과 제한은 [CHARGING-MOTION.md](CHARGING-MOTION.md)를 참고하세요.

차량을 주차하고 전원을 끈 뒤 콤마는 대기 화면과 네트워크 연결을 유지합니다.
명령이 실패하면 다음 단계로 넘어가지 않습니다. 토큰/connection.json/DB는 변경하지 않습니다.

콤마 플래싱 후 수집기 전체가 사라졌다면 [Windows/Mac 복구 가이드](REINSTALL.md)를 사용하세요. 아래는 기존 수집기 업데이트 절차입니다.

## 1. PC: 파일 전송

### Mac 터미널

현재 수정된 체크아웃에서 실행합니다. 첫 줄의 폴더 경로는 실제 저장소 위치로 바꿉니다. COMMA_IP를 실제 주소로 바꾸세요.
SSH가 8022 포트라면 ssh에 `-p 8022`, scp에 `-P 8022`를 추가합니다.

```bash
cd "$HOME/Downloads/carrot-ha-main"
export COMMA_IP="192.168.43.1"
shasum -a 256 collector/collector.py collector/engine.py
scp collector/collector.py comma@"$COMMA_IP":/data/id4-collector/collector.py.new
scp collector/engine.py comma@"$COMMA_IP":/data/id4-collector/engine.py.new
ssh comma@"$COMMA_IP"
```

### Windows PowerShell

경로와 IP를 본인 환경에 맞게 바꾸세요. 별도 SSH 키를 쓰면 ssh/scp 모두 `-i`를 추가합니다. 각 명령 실패 시 중단합니다.

```powershell
Set-Location "$env:USERPROFILE\Downloads\carrot-ha-main"
$CommaIP = "192.168.43.1"
Get-FileHash .\collector\collector.py, .\collector\engine.py -Algorithm SHA256
scp .\collector\collector.py "comma@${CommaIP}:/data/id4-collector/collector.py.new"
scp .\collector\engine.py "comma@${CommaIP}:/data/id4-collector/engine.py.new"
ssh "comma@$CommaIP"
```

## 2. 콤마: 검증 및 백업

이후 명령은 콤마에서 실행합니다. Windows/Mac 모두 이후 명령은 동일합니다. 두 해시가 PC의 해당 파일과 일치해야 합니다(영문 대소문자는 무시).

```bash
cd /data/id4-collector
/usr/local/venv/bin/python3 -m py_compile collector.py.new engine.py.new
sha256sum collector.py.new engine.py.new
BACKUP_DIR="/data/id4-collector/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR" &&
cp -p collector.py engine.py "$BACKUP_DIR/" &&
echo "Backup: $BACKUP_DIR"
```

출력된 백업 경로를 보관하세요. 실패하면 중단합니다.

## 3. 콤마: 중단·교체·시작

```bash
rm -f /data/id4-collector/enabled
pkill -f '^bash /data/id4-collector/supervisor.sh$'
pkill -f '^/usr/local/venv/bin/python3 -u collector.py$'
pgrep -af '^bash /data/id4-collector/supervisor.sh$'
pgrep -af '^/usr/local/venv/bin/python3 -u collector.py$'
```

두 pgrep 출력이 모두 없어야 교체합니다.

```bash
mv collector.py.new collector.py &&
mv engine.py.new engine.py &&
/usr/local/venv/bin/python3 -m py_compile collector.py engine.py
```

성공했을 때만 설치기를 실행합니다.

```bash
PYTHONPATH="/data/openpilot/pydeps:/data/openpilot${PYTHONPATH:+:$PYTHONPATH}" /usr/local/venv/bin/python3 /data/id4-collector/install.py
```

## 4. 콤마: 90초 후 확인

```bash
python3 /data/id4-collector/status.py
tail -n 30 /data/id4-collector/collector.log
```

running, 최근 상태 시각, 업로드 ok, pending 감소를 확인합니다.
그 다음 P에서 키 ON 시 gear=park, driving=false인지 확인합니다.
키 ON인데 gear/driving이 null이면 차량 신호가 없거나 유효하지 않은 상태입니다.
HA 통합도 함께 업데이트하고 HA 재시작 및 브라우저 새로고침을 수행해야 새 상태 표시를 완전히 지원합니다.

## 원복

3단계의 중단 명령과 프로세스 확인을 먼저 수행합니다.
아래 경로는 2단계에서 실제 생성한 백업 경로로 바꿉니다.

```bash
BACKUP_DIR="/data/id4-collector/backup-실제백업시각"
/usr/local/venv/bin/python3 -m py_compile "$BACKUP_DIR/collector.py" "$BACKUP_DIR/engine.py" &&
cp -p "$BACKUP_DIR/collector.py" /data/id4-collector/collector.py &&
cp -p "$BACKUP_DIR/engine.py" /data/id4-collector/engine.py
```

성공하면 3단계 설치기를 실행한 뒤 4단계 상태를 확인합니다. DB를 덮어쓰지 않습니다.

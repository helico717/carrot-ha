# comma 셀룰러 연결 장애 진단 자료 수집 (Mac)

대상 증상: 국내 통신사 개인 유심을 사용하는 comma가 처음에는 셀룰러와 comma Connect에 연결되지만, 시간이 지나면 둘 다 Offline이 되고 재부팅하면 복구되는 경우.

이 절차는 장애 상태, 재부팅 직후, 정상 복구 상태, 일정 시간 후 상태를 비교할 수 있도록 자료를 수집합니다. 설정을 변경하거나 모뎀에 직접 AT 명령을 보내지 않습니다.

차량을 안전하게 주차하고 comma 전원을 유지하세요. 첫 수집이 끝날 때까지 comma를 재부팅하거나 APN을 다시 저장하거나 유심을 뺐다 끼우지 마세요. 운전 중에는 Mac이나 SSH를 조작하지 마세요.

## 1. Mac 준비

Mac 터미널에서 자료를 받을 폴더를 만듭니다.

```bash
mkdir -p ~/Desktop/comma-cellular-diagnostics
```

comma에서 다음을 확인하고 기록합니다.

- SSH 활성화 여부
- GitHub 사용자 이름 등록 여부
- comma 핫스팟 활성화 여부
- 현재 셀룰러 상태와 시각이 보이는 화면 사진
- 통신사와 사용 중인 APN

Mac을 comma 핫스팟에 연결합니다. 일반적인 comma 주소는 `192.168.43.1`입니다.

```bash
ssh comma@192.168.43.1
```

별도 키를 사용한다면:

```bash
ssh -i ~/.ssh/키파일이름 comma@192.168.43.1
```

SSH 포트가 8022라면:

```bash
ssh -p 8022 comma@192.168.43.1
```

## 2. comma에 종합 진단 스크립트 설치

SSH 접속 후 아래 블록을 처음부터 끝까지 한 번에 붙여 넣습니다.

```bash
cat > /data/collect-cellular-diagnostics.sh <<'DIAG_SCRIPT'
#!/usr/bin/env bash

LABEL="${1:-snapshot}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BASE="/data/cellular-diagnostics"
OUT="${BASE}/${STAMP}-${LABEL}"

mkdir -p "$OUT"

run() {
  NAME="$1"
  shift
  {
    echo "### collected_at"
    date -Is
    echo
    echo "### command"
    printf '%q ' "$@"
    echo
    echo
    timeout 40 "$@"
    STATUS=$?
    echo
    echo "### exit_status: $STATUS"
  } > "${OUT}/${NAME}.txt" 2>&1
}

{
  echo "label=$LABEL"
  echo "collected_at=$(date -Is)"
  echo "uptime=$(uptime)"
  echo "boot_id=$(cat /proc/sys/kernel/random/boot_id 2>/dev/null)"
  echo "output=$OUT"
} > "$OUT/manifest.txt" 2>&1

run system-uname uname -a
run system-release sh -c 'cat /etc/os-release; echo; cat /etc/lsb-release 2>/dev/null'
run uptime uptime
run date-timedate sh -c 'date -Is; timedatectl 2>/dev/null'
run mounts df -h
run memory free -h
run load sh -c 'cat /proc/loadavg; echo; cat /proc/uptime'

run openpilot-version sh -c '
  for repo in /data/openpilot /data/openpilot_source; do
    if [ -d "$repo/.git" ]; then
      echo "### $repo"
      git -C "$repo" status --short --branch
      git -C "$repo" log -1 --date=iso --format="%H%n%ad%n%s"
      git -C "$repo" remote -v
    fi
  done
'

run processes ps -ef
run relevant-processes sh -c \
  'ps -ef | grep -Ei "athena|modem|qcom|gps|manager|network|pppd|wpa|therm|uploader" | grep -v grep'

run systemctl-failed sh -c 'sudo -n systemctl --failed --no-pager 2>/dev/null || true'
run systemctl-services sh -c \
  'sudo -n systemctl list-units --type=service --all --no-pager 2>/dev/null | grep -Ei "Network|Modem|openpilot|comma|qcom|gps|ppp|wpa" || true'

run network-overview sh -c '
  echo "### interfaces"
  ip -br link
  echo
  ip -br address
  echo
  echo "### default route"
  ip route
  echo
  echo "### all routes"
  ip route show table all
  echo
  echo "### rules"
  ip rule
  echo
  echo "### neighbors"
  ip neigh
  echo
  echo "### resolv.conf"
  cat /etc/resolv.conf
'

run nmcli-general sh -c '
  if command -v nmcli >/dev/null; then
    nmcli general status
    echo
    nmcli radio
    echo
    nmcli device status
    echo
    nmcli -f NAME,UUID,TYPE,DEVICE,AUTOCONNECT connection show
    echo
    echo "### active connections"
    nmcli -f NAME,UUID,TYPE,DEVICE connection show --active
  else
    echo "nmcli not installed"
  fi
'

run nmcli-devices sh -c '
  if command -v nmcli >/dev/null; then
    nmcli device show
  else
    echo "nmcli not installed"
  fi
'

run cellular-profiles sh -c '
  if ! command -v nmcli >/dev/null; then
    echo "nmcli not installed"
    exit 0
  fi

  nmcli -t -f UUID,TYPE connection show |
  while IFS=: read -r UUID TYPE; do
    case "$TYPE" in
      gsm|cdma)
        echo "### cellular profile $UUID"
        nmcli \
          -f connection.id,connection.uuid,connection.type,connection.autoconnect,connection.autoconnect-priority,gsm.apn,gsm.auto-config,gsm.network-id,gsm.network-type,gsm.home-only,gsm.roaming-allowed,gsm.pin-flags,gsm.password-flags,ipv4.method,ipv4.dns,ipv4.routes,ipv6.method \
          connection show uuid "$UUID" 2>&1
        echo
        ;;
    esac
  done
'

run modemmanager-list sh -c '
  if command -v mmcli >/dev/null; then
    sudo -n timeout 15 mmcli -L
  else
    echo "mmcli not installed"
  fi
'

run modemmanager-detail sh -c '
  if ! command -v mmcli >/dev/null; then
    echo "mmcli not installed"
    exit 0
  fi

  sudo -n timeout 15 mmcli -L 2>/dev/null |
  grep -oE "/org/freedesktop/ModemManager1/Modem/[0-9]+" |
  while read -r MODEM; do
    echo "### $MODEM"
    sudo -n timeout 20 mmcli -m "$MODEM"
    echo
    sudo -n timeout 20 mmcli -m "$MODEM" --3gpp
    echo
  done
'

run comma-modem-state sh -c '
  echo "### /dev/shm/modem"
  if [ -e /dev/shm/modem ]; then
    ls -la /dev/shm/modem
    cat /dev/shm/modem
  else
    echo "not present"
  fi
  echo
  echo "### modem devices"
  ls -la /dev/modem* /dev/ttyUSB* /dev/cdc-wdm* /dev/wwan* 2>/dev/null || true
'

run usb-pci-devices sh -c '
  lsusb 2>/dev/null || true
  echo
  lspci -nn 2>/dev/null || true
'

run rfkill sh -c 'rfkill list 2>/dev/null || true'

run connectivity-ipv4 sh -c '
  echo "### route selection"
  ip route get 1.1.1.1 2>&1
  echo
  echo "### ping gateway"
  GW=$(ip route | awk "/^default/{print \$3; exit}")
  if [ -n "$GW" ]; then
    ping -c 4 -W 3 "$GW"
  else
    echo "no default gateway"
  fi
  echo
  echo "### ping public IP"
  ping -c 4 -W 3 1.1.1.1
'

run connectivity-dns sh -c '
  echo "### DNS lookup"
  getent ahosts comma.ai 2>&1 || true
  getent ahosts athena.comma.ai 2>&1 || true
  getent ahosts api.comma.ai 2>&1 || true
'

run connectivity-https sh -c '
  if command -v curl >/dev/null; then
    echo "### comma.ai"
    curl -4 -I --connect-timeout 10 --max-time 20 https://comma.ai/
    echo
    echo "### api.comma.ai"
    curl -4 -I --connect-timeout 10 --max-time 20 https://api.comma.ai/
  else
    echo "curl not installed"
  fi
'

run sockets sh -c 'sudo -n ss -tpna 2>/dev/null || ss -tpna 2>/dev/null || true'

run networkmanager-journal sh -c \
  'sudo -n journalctl -b --no-pager -o short-iso -u NetworkManager -n 8000 2>/dev/null || true'

run modemmanager-journal sh -c \
  'sudo -n journalctl -b --no-pager -o short-iso -u ModemManager -n 8000 2>/dev/null || true'

run current-boot-network-events sh -c '
  sudo -n journalctl -b --no-pager -o short-iso 2>/dev/null |
  grep -Ei "modem|wwan|qmi|cellular|gsm|lte|sim|ppp|carrier|networkmanager|qcomgps|athena|dns|route|no carrier|registration|disconnect|timeout|failed|error" |
  tail -n 12000
'

run kernel-current-boot sh -c \
  'sudo -n journalctl -b -k --no-pager -o short-iso -n 8000 2>/dev/null || dmesg -T 2>/dev/null || true'

run previous-boot-network-events sh -c '
  sudo -n journalctl -b -1 --no-pager -o short-iso 2>/dev/null |
  grep -Ei "modem|wwan|qmi|cellular|gsm|lte|sim|ppp|carrier|networkmanager|qcomgps|athena|dns|route|no carrier|registration|disconnect|timeout|failed|error" |
  tail -n 12000
'

run previous-boot-kernel sh -c \
  'sudo -n journalctl -b -1 -k --no-pager -o short-iso -n 8000 2>/dev/null || true'

run journal-boots sh -c 'sudo -n journalctl --list-boots --no-pager 2>/dev/null || true'

run crash-listing sh -c '
  for DIR in /data/tombstones /data/anr /data/crash /data/log; do
    if [ -e "$DIR" ]; then
      echo "### $DIR"
      find "$DIR" -maxdepth 2 -type f -printf "%TY-%Tm-%Td %TH:%TM:%TS %s %p\n" 2>/dev/null |
      sort |
      tail -n 300
    fi
  done
'

run openpilot-log-listing sh -c '
  for DIR in /data/media/0/realdata /data/media/0/crash /data/openpilot; do
    if [ -e "$DIR" ]; then
      echo "### $DIR"
      find "$DIR" -maxdepth 2 -type f -printf "%TY-%Tm-%Td %TH:%TM:%TS %s %p\n" 2>/dev/null |
      sort |
      tail -n 400
    fi
  done
'

{
  echo "Diagnostics saved to: $OUT"
  echo "Files:"
  ls -lh "$OUT"
} | tee "$OUT/summary.txt"

echo
echo "DONE: $OUT"
DIAG_SCRIPT

chmod +x /data/collect-cellular-diagnostics.sh
```

스크립트는 APN과 자동 연결 여부는 수집하지만 셀룰러 프로필의 비밀번호와 PIN 값은 수집하지 않습니다. 일부 명령에서 `not installed`, `Unit not found` 또는 `exit_status` 오류가 나와도 괜찮습니다. 장치 버전별 차이를 확인하기 위해 오류도 함께 저장합니다.

## 3. 재부팅 전 장애 상태 수집

셀룰러와 Connect가 Offline인 상태에서 실행합니다.

```bash
sudo /data/collect-cellular-diagnostics.sh offline-before-reboot
```

마지막에 다음과 비슷한 문구가 나오면 완료입니다.

```text
DONE: /data/cellular-diagnostics/20260928-123456-offline-before-reboot
```

저장 결과를 확인합니다.

```bash
ls -lh /data/cellular-diagnostics
```

## 4. 재부팅 전 자료를 Mac으로 1차 복사

SSH에서 나옵니다.

```bash
exit
```

Mac 터미널에서 실행합니다.

```bash
scp -r comma@192.168.43.1:/data/cellular-diagnostics/ \
  ~/Desktop/comma-cellular-diagnostics/
```

별도 키를 사용한다면:

```bash
scp -i ~/.ssh/키파일이름 -r \
  comma@192.168.43.1:/data/cellular-diagnostics/ \
  ~/Desktop/comma-cellular-diagnostics/
```

SSH 포트가 8022라면 `scp`에서는 대문자 `-P`를 사용합니다.

```bash
scp -P 8022 -r \
  comma@192.168.43.1:/data/cellular-diagnostics/ \
  ~/Desktop/comma-cellular-diagnostics/
```

## 5. comma 재부팅

가능하면 comma 화면의 메뉴에서 정상적으로 재부팅합니다. SSH 명령으로 재부팅해야 한다면:

```bash
ssh comma@192.168.43.1
sudo reboot
```

SSH 연결이 끊기는 것은 정상입니다. 2~5분 정도 기다린 뒤 다음 항목을 사진이나 메모로 남깁니다.

- 셀룰러가 다시 연결되는 데 걸린 시간
- Connect가 Online으로 바뀌는 데 걸린 시간
- 재부팅 직후부터 정상인지
- 셀룰러는 정상인데 Connect만 늦게 올라오는 구간이 있는지

Mac을 comma 핫스팟에 다시 연결하고 SSH로 접속합니다.

```bash
ssh comma@192.168.43.1
```

## 6. 재부팅 직후 정상 상태 수집

```bash
sudo /data/collect-cellular-diagnostics.sh online-after-reboot
```

현재 상태와 함께 영구 journal이 지원되는 환경에서는 `journalctl -b -1`을 통해 재부팅 전 부팅의 로그도 수집합니다.

## 7. 10분 후 상태 수집

차량 전원과 comma를 유지하고 약 10분 후 실행합니다.

```bash
sudo /data/collect-cellular-diagnostics.sh online-after-10min
```

가능하면 이 시간 동안 일반 Wi-Fi에는 연결하지 않고 개인 유심 셀룰러만 유지합니다. SSH를 위해 Mac이 comma 자체 핫스팟에 연결되는 것은 괜찮습니다.

## 8. 짧은 운행 후 상태 수집

안전하게 짧게 운행한 뒤 주차하고, 재부팅하지 않은 상태에서 실행합니다.

```bash
sudo /data/collect-cellular-diagnostics.sh after-short-drive
```

다음 내용을 함께 기록합니다.

- 운행 시작 시각
- 운행 종료 시각
- 운행 중 셀룰러가 끊겼는지
- 주차 직후 Online인지

## 9. Offline 증상이 재현되면 즉시 수집

증상이 재발하면 재부팅 전에 실행합니다.

```bash
sudo /data/collect-cellular-diagnostics.sh offline-reproduced
```

재발을 발견한 시각과 마지막으로 Online이었던 시각도 기록합니다. 수집이 끝난 뒤에만 재부팅합니다.

## 10. 최종 자료를 Mac으로 가져오기

SSH에서 나옵니다.

```bash
exit
```

Mac 터미널에서 실행합니다.

```bash
scp -r comma@192.168.43.1:/data/cellular-diagnostics/ \
  ~/Desktop/comma-cellular-diagnostics/
```

결과를 확인합니다.

```bash
find ~/Desktop/comma-cellular-diagnostics -type f | sort
```

압축 파일을 만듭니다.

```bash
cd ~/Desktop
tar -czf comma-cellular-diagnostics.tar.gz comma-cellular-diagnostics
```

최종 파일 위치:

```text
~/Desktop/comma-cellular-diagnostics.tar.gz
```

## 11. 함께 기록할 정보

```text
comma 모델:
Carrotpilot/openpilot 버전 또는 브랜치:
통신사:
요금제/유심 종류:
APN:
처음 부팅 후 Online이 된 시각:
Offline을 발견한 시각:
운행 중 또는 주차 중:
재부팅 후 셀룰러 복구까지 걸린 시간:
재부팅 후 Connect 복구까지 걸린 시간:
Wi-Fi에서는 Connect가 정상인지:
```

로그에는 IMEI, ICCID, IP 주소, Git 저장소 주소 같은 식별 정보가 포함될 수 있습니다. 원본 압축 파일을 공개 GitHub 이슈에 바로 첨부하지 말고, 공개 전에 민감한 값을 가립니다.

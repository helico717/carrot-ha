# 주차 상태 원격 터미널

설치는 [초기화 복구 안내](CLEAN_INSTALL_RECOVERY.md)의 3번과 7번을 따릅니다.
HA 통합 구성에서 자체 수신기 주소·조회 키·업로드 키를 설정하고 원격 터미널을 켠 뒤,
HA 외부 HTTPS 기본 주소를 입력합니다. 주소 끝에 `/carrot-receiver`를 붙이지 않습니다.

HA가 집의 수신 앱에 짧은 유효기간의 연결 정보를 게시하고, Comma가 이를 읽어 HA에
연결합니다. 터미널 본 통신은 Comma와 HA 사이이며 Cloudflare를 거치지 않습니다.
관리자만 사용할 수 있고 주차 상태에서만 허용합니다. 비활성화·주행 전환·권한 취소 시
연결이 종료됩니다. 일반 HA Core 재시작 동안 수신 앱은 계속 동작하지만 터미널 화면은 잠시 끊깁니다.

대시보드 리소스: `/carrot_ha_static/carrot-terminal-card.js` (JavaScript 모듈).

```yaml
type: custom:carrot-terminal-card
device_id: YOUR_EXISTING_DEVICE_ID
title: Comma 원격 터미널
```

평소 업데이트는 카드의 업데이트 확인·Git Pull·재부팅 기능을 사용합니다.
직접 명령을 입력한다면 기본 명령은 아래와 같습니다. 변경 파일이 있다는 오류를
강제로 지우지 말고 원인을 확인합니다. 기기 소스를 직접 수정하지 않습니다.

```sh
cd /data/openpilot && git pull --ff-only && sudo reboot
```

기존 Git Pull 버튼은 로컬 변경을 버리는 동작이 포함될 수 있으므로 변경 파일이 있는
기기에서는 먼저 Git 상태를 확인하세요. 이번 연결 전환에서 버튼 동작은 바꾸지 않았습니다.
첫 연결 자체가 사라졌다면 카드로 복구할 수 없으므로 차량 근처에서
[Windows/Mac 첫 연결 절차](CLEAN_INSTALL_RECOVERY.md#7-차량-근처에서-처음-연결-설정하기--windows--mac)를 사용합니다.

# 임시 onroad 원격 터미널 — 2026-11-03

사용자 요청: onroad 상태에서도 원격 터미널 허용. 속도·브레이크 조건 없음.

Comma 변경은 Git으로만 설치한다. 업데이트 후 사용자 재부팅이 필요하다.
재부팅한 뒤 기존 주차 터미널에서 다음을 실행하면 같은 부팅 동안 onroad에서도 접속할 수 있다:

```sh
cd /data/openpilot
PYTHONPATH=/data/openpilot/openpilot python -m openpilot.selfdrive.carrot.ha.terminal_onroad enable
```

해제는 마지막 인수를 `disable`, 확인은 `status`로 바꾼다. 재부팅 시 자동 해제된다. 이 설정은 `/data/carrot_ha/terminal-onroad.json`에 저장하며 소스를 변경하지 않는다.
HA도 명시 override를 이해하는 terminal_relay.py가 필요하다. 기존 장치는 override 필드가 없어 기존 offroad-only 동작을 유지한다. 인증·관리자 lease·데이터 크기 제한은 유지한다.
터미널 연결 종료는 이미 실행한 셸 명령/백그라운드 프로세스의 강제 중지를 의미하지 않는다.

검증: Comma terminal/override 9개, HA 실제 WebSocket 5개 통과. 실차 onroad 접속은 미검증. 이 기능은 ID.Light 호출 명령을 포함하지 않으며 CAN 송신 준비 완료를 뜻하지 않는다.

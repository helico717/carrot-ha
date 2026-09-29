# 주차 카메라 — Git 기반 설치 및 업데이트

영상 경로는 콤마 → HA의 `/api/carrot_ha/v1/camera/…` WebSocket → HA HLS다.
Cloudflare 대시보드 API와 별개이며, 기존 HTTPS 프록시에서 WebSocket upgrade를 허용해야 한다.

## 저장소별 배포

- HA 통합과 카메라 릴레이: `helico717/carrot-ha`, `main`.
- 콤마 카메라 서비스: `helico717/openpilot`, `carrot-wip-model_selector-ha`의
  `openpilot/selfdrive/carrot/ha/camera/`. manager가 `carrot_camera` 프로세스를 관리한다.
- 설정과 활성화 상태: `/data/carrot_ha/camera/`. Git 트리 안에 설정이나 로그를 저장하지 않는다.

콤마에는 ZIP/SCP로 프로그램을 덮어쓰거나 `continue.sh`를 수정하지 않는다.
커밋·push 후 주차 상태에서 원격 터미널의 Git Pull과 기기 재부팅으로 적용한다.

## 기존 카메라 설치의 자동 전환

이전 `/data/carrot-camera/camera.json`과 `enabled`가 있으면 최초 주차 상태에서:

1. 기존 HA 주소, device ID, 카메라 토큰을 새 상태 디렉터리로 원자적으로 보존한다(파일 권한 600).
2. 기존 `enabled` 런타임 마커를 해제한다. 이전 프로그램과 `continue.sh`는 수정하지 않는다.
3. 이전 supervisor/agent가 종료해 `supervisor.lock`을 놓을 때까지 기다린다.
4. Git으로 관리되는 새 서비스가 연결한다. 새 설정이 이미 있으면 덮어쓰지 않는다.

이전 서비스가 DNS 재시도 중이면 전환에 약 1~2분이 걸릴 수 있다.
기존에 비활성화한 설치는 자동 활성화하지 않는다. HA 토큰 재발급이나 통합 재설정은 필요 없다.
기존 `/data/carrot-camera/agent.log`는 이전 서비스 기록이며, 전환 후에는 manager의
`carrot_camera` 프로세스 출력을 확인한다.

## 신규 설정

주차 상태의 원격 터미널에서 Git에 포함된 설정 도구를 실행한다:

```bash
cd /data/openpilot
python -m openpilot.selfdrive.carrot.ha.camera.configure
python -m openpilot.selfdrive.carrot.ha.camera.configure --enable
```

도구는 HTTPS HA 주소, 기존 Carrot HA device ID와 전용 카메라 토큰을 입력받는다.
생성된 토큰은 HA 통합 옵션의 카메라 토큰에 입력한다. 토큰이나 설정 파일 전체를 공유하지 않는다.
설정 도구는 프로그램 파일을 수정하지 않는다. 비활성화는 같은 도구의 `--disable`을 사용한다.

## 호환성 및 동작

커밋 SHA 허용 목록은 사용하지 않는다. 촬영 전에 실행 파일, GNU timeout,
PyAV remux API, 세 카메라 메시지의 header/data/timestampSof 필드를 검사한다.
필수 기능이 사라지면 구체적인 오류로 중단한다. 이는 모든 미래의 openpilot API 변경이나
실기기 동작을 보장하는 검사가 아니며, 단순한 커밋 변경 때문에 촬영을 거부하지 않도록 한다.

명시적 offroad/onroad 상태, 다른 카메라 프로세스와 소유권 확인, 12초 lease,
최대 5분 세션, 자식 프로세스 종료 및 상태 복원은 유지된다. 영상 요청이 없으면 촬영하지 않는다.
H.264 입력은 `conflate=False`로 받으며, HA의 제한된 재시도 정책도 유지한다.

HA의 카메라 엔터티에서 **Preload stream을 끈다**. 기본 안내 이미지는 실시간 영상이 아니다.
`camera.turn_on` 후 상세창으로 영상을 열고, `camera.turn_off`로 종료할 수 있다.
오류가 나면 같은 시간대의 HA 로그, manager의 카메라 출력과 엔터티 `last_stop_reason`을 확인한다.

## 개발 검증

openpilot 저장소:

```bash
python -m unittest discover -s openpilot/selfdrive/carrot/ha/tests -p 'test_camera*.py'
```

carrot-ha 저장소:

```bash
python -m unittest discover -s tests -p 'test_camera*.py'
python scripts/build_camera_bundle.py
```

테스트에는 Python 3.11 이상, aiohttp, PyAV가 필요하다. 빌드 스크립트는 HA ZIP만 생성한다.
콤마용 ZIP은 생성하지 않는다. 데스크톱 테스트는 실기기 영상 재생 검증을 대신하지 않는다.

# 주차 카메라 설치 및 테스트 — 0.7.1

광각·망원·실내 카메라를 HA 표준 camera 엔터티로 제공한다. 콤마는 기존 HA HTTPS 주소에 WSS로 접속하고, HA는 HLS로 재생한다. 추가 VPN 계정·Worker 변경·영상 포트 개방·추가 애드온은 필요하지 않다. 기존 HTTPS 프록시는 새 `/api/carrot_ha/v1/camera/…` 경로의 WebSocket upgrade를 허용해야 한다.

현재는 **초기 실기기 검증용**이다. 소스의 프로세스 시작 방식과 두 H.264 스트림의 실기기 디코딩을 확인했고, 합성 영상으로 remux→WebSocket→HTTP→디코딩 테스트를 통과했다. 실제 HAOS HLS·iOS 재생, 장시간 부하, 차량 연결 상태의 주차 동작은 아직 검증하지 않았다. 첫 설치 테스트는 기존 테스트처럼 차량에서 분리한 comma four에서 진행한다.

지원 범위는 HA 2026.9+, comma four / ajouatom 커밋 `5cb0f3e590a28d0138ad9f48506f65743cdaa326`이다. 콤마 커밋이나 관련 소스가 바뀌면 자동 실행을 거부한다. 이를 우회하지 말고 새 버전의 호환성을 확인한다.

## 1. 패키지 준비 및 HA 업데이트

이 저장소 PC 작업 폴더에서:

```powershell
python scripts/build_camera_bundle.py
```

`.preview/camera-release/`에 두 ZIP이 생성된다. 개인 설정이나 토큰은 포함하지 않는다. 각 ZIP의 `build_info.json`에는 소스 커밋과 미커밋 변경 유무가 기록되고, 같은 폴더의 `SHA256SUMS.txt`로 파일을 확인할 수 있다. 파일명 버전은 통합의 manifest에서 가져온다.

- `carrot_ha-0.7.1.zip`: HA의 `/config` 아래로 풀면 `/config/custom_components/carrot_ha/`가 된다. 기존 폴더를 PC 또는 HA 백업에 보관한 후 새 파일로 덮어쓴다. `/config/carrot_ha/`의 기록 DB는 건드리지 않는다.
- `carrot-camera-agent-0.7.1.zip`: 콤마 설치용이다.

HA 파일 복사는 기존에 사용하던 Samba·Studio Code Server·SSH 방식으로 한다. Windows의 프로젝트 파일을 수정하는 것만으로 HA가 업데이트되지는 않는다. 아직 GitHub에 push/release하지 않았다면 HACS에서 업데이트가 보이지 않는 것이 정상이다. 이번 로컬 테스트에는 수동 ZIP 설치를 사용할 수 있다.

HA를 재시작한다. 기본값은 카메라 기능 꺼짐이다. 기존 센서·수집기를 먼저 확인한다.

## 2. 콤마에 전용 폴더 복사

Windows PowerShell에서 `COMMA_IP`를 기존 SSH IP로 바꾼다. 기존 연결에 `-i`가 필요했다면 같은 SSH 키 옵션을 추가한다.

```powershell
scp ".preview/camera-release/carrot-camera-agent-0.7.1.zip" comma@COMMA_IP:/data/carrot-camera-agent-0.7.1.zip
ssh comma@COMMA_IP
```

아래부터 콤마 SSH에서 실행한다. 처음 설치 기준이다. 이미 같은 폴더가 있다면 먼저 6절로 서비스를 비활성화한 후 프로그램 파일만 갱신한다. `camera.json`은 ZIP에 들어 있지 않으므로 유지된다.

```bash
python3 -m zipfile -e /data/carrot-camera-agent-0.7.1.zip /data
cd /data/carrot-camera
/usr/local/venv/bin/python3 configure.py
```

질문에 순서대로 입력한다.

1. HA 외부 HTTPS 기본 주소. `/lovelace` 등 화면 경로는 빼고 실제 포트는 포함한다.
2. **기존 Carrot HA 통합의 device_id**. HA의 설정 → 기기 및 서비스 → Carrot HA에 표시되는 통합 항목 제목이다. 이 통합은 등록할 때 입력한 device_id를 항목 제목으로 사용한다. DongleId나 HA 엔터티 ID가 아니다.
3. 새 영상 전용 토큰. 처음이면 Enter를 누르면 64자리 임의 토큰을 만든다.

생성된 토큰은 이 터미널에 한 번 표시된다. HA 옵션에 붙여넣고 개인 비밀번호 관리 도구에 보관한다. 토큰을 채팅·GitHub·로그에 보내지 않는다. 설정은 `/data/carrot-camera/camera.json`에 mode 600으로 저장된다. 아직 서비스는 시작되지 않는다.

## 3. HA에서 카메라 기능 켜기

설정 → 기기 및 서비스 → Carrot HA → 구성/옵션에서:

- **주차 카메라 사용**: 켬
- **영상 전용 토큰**: 방금 생성한 토큰
- 기존 Worker 주소·조회 토큰·배터리 용량은 그대로 유지

저장하면 통합이 다시 로드된다. Comma 기기에 광각·망원·실내 카메라가 생기며, 콤마 서비스 연결 전에는 unavailable이 정상이다. 토큰은 기존 HA_LOCAL, UPLOAD, VIEW와 다른 값을 사용한다.

## 4. 콤마 서비스 설치·시작

차량에서 분리된 offroad 상태를 유지하고 콤마 SSH에서:

```bash
cd /data/carrot-camera
/usr/local/venv/bin/python3 install.py
tail -n 30 /data/carrot-camera/agent.log
```

`Camera control connected; idle until requested`가 보이면 제어 연결이 됐다. 설치기는 별도 `/data/carrot-camera` 서비스를 `/data/continue.sh`에 추가한다. 기존 collector hook과 openpilot Git checkout은 유지한다. 재실행해도 hook을 중복 추가하지 않는다. 백업은 `/data/carrot-camera/continue.sh.before-camera`다.

설치 전 PyAV의 remux API, aiohttp, GNU timeout 및 정확한 커밋을 검사한다. 의존성 오류가 나오면 pip로 콤마 환경을 바꾸지 말고 오류 내용을 확인한다. 토큰이나 `camera.json` 전체를 공유하지 않는다.

## 5. 실제 재생 확인

HA Comma 기기의 카메라 엔터티를 열어 라이브를 확인한다. 엔터티 ID는 HA에서 생성된 실제 값을 사용한다. 초기 대시보드는 자동 재생을 피한다.

```yaml
type: picture-entity
entity: camera.실제로_생성된_광각_엔터티
camera_view: auto
show_state: true
tap_action:
  action: more-info
```

처음에는 중립 안내 이미지가 보인다. 썸네일 요청으로 카메라를 켜지 않는다. 카메라 설정의 **Preload stream/스트림 사전 로딩은 끈다.** 켜면 라이브 요청을 거부한다. `camera_view: live`를 쓰면 대시보드를 여는 것 자체가 시청 요청이 된다.

검증 순서:

1. 조회하지 않은 상태에서 `pgrep -a camerad; pgrep -a encoderd` 결과가 비어 있는지 확인한다. 제어 WebSocket만 유지된다.
2. 광각·망원·실내 라이브를 각각 열어 화면·방향·첫 재생 지연을 확인한다. 그다음 두 화면을 함께 연다.
3. 즉시 종료 확인은 HA 개발자 도구 → 작업에서 해당 엔터티에 `camera.turn_off`를 실행한다. 여러 카메라가 재생 중이면 재생 중인 엔터티를 모두 끈다. 다시 사용하려면 `camera.turn_on` 후 라이브를 연다. turn_on 자체는 촬영을 시작하지 않는다.
4. 팝업을 닫는 것만으로는 HA HLS 버퍼 때문에 즉시 종료되지 않을 수 있다. 마지막 HTTP 소비자가 닫히면 종료하고, 세션 전체에 5분 상한이 있다. 만료되면 화면을 닫고 다시 열어 새 시청을 시작한다.
5. 콤마 제어 연결이 끊기면 장치의 12초 lease가 만료되어 캡처가 정리된다. HA 재시작/연결 복구만으로 촬영을 자동 재시작하지 않는다. 다만 기존 HLS 소비자가 남아 같은 주소로 재요청하면 일시적 실패에 최대 두 번 캡처를 재시도한다. 최초 5분 제한은 연장하지 않는다.
6. PC 브라우저에서 성공한 뒤 iPhone/Android의 기존 외부 HTTPS 주소로 확인한다. 현재 같은 Wi-Fi에서의 성공은 차량 이동통신망 성능을 보장하지 않는다.

현재 인코더의 `--stream` 모드는 세 카메라를 인코딩하지만 현재 에이전트는 wide/road/driver 세 스트림을 전송한다. 한 카메라만 열어도 세 스트림이 전송되는 구현이므로, 카메라별 선택 전송에 따른 대역폭 절감은 아직 적용되지 않았다. 세션 설정은 카메라별 목표 600 kbps이며 실제 전송량은 장면·오버헤드에 따라 달라진다. 무음 영상이며, 자동 녹화·주기적 스냅샷 저장·360도 합성은 제공하지 않는다.

오류 시 우선 `agent.log`의 마지막 30줄과 HA의 Carrot HA 오류를 확인한다. 카메라 엔터티의 `last_stop_reason`도 도움이 된다. 링크·토큰은 가리고 전달한다. 뷰어가 멈추면 먼저 camera.turn_off로 종료하고 오류를 확인한다.

## 6. 비활성화·되돌리기

먼저 HA에서 모든 카메라에 `camera.turn_off`를 실행하고, 콤마에서:

```bash
cd /data/carrot-camera
/usr/local/venv/bin/python3 disable.py
```

enabled 파일을 제거하고 이 폴더의 agent만 정상 종료시킨다. 기존 collector는 건드리지 않는다. hook은 남지만 enabled가 없으면 아무것도 실행하지 않는다. 임의로 continue.sh 전체를 과거 백업으로 덮어쓰면 이후 추가된 다른 hook을 잃을 수 있으므로 그렇게 복원하지 않는다.

HA 옵션의 주차 카메라 사용을 끄고 저장한다. 통합 자체를 되돌리려면 백업한 custom_components/carrot_ha 폴더로 복구한 후 HA를 재시작한다. 콤마·HA 설정에 저장된 영상 전용 토큰을 폐기하면 기존 접속은 더 이상 허용되지 않는다.

정상 종료 신호에는 정리 절차가 적용된다. 프로세스 강제 종료(SIGKILL)나 전원 단절 때 Python의 설정 복원을 보장할 수는 없다. 이 경우 자동으로 소유권 플래그를 덮어쓰지 않으며, 충돌 상태에서는 캡처 시작을 거부한다. 남은 camerad/encoderd를 이름만으로 일괄 kill하거나 IsTakingSnapshot 값을 임의로 바꾸지 말고, 비활성화 후 기기 재시작과 상태 재확인으로 복구한다.

기존 `224482d` 설치에서의 수정 범위, 간헐적 실패 분석 및 360도 구현 방향은 [CAMERA_RELIABILITY_AND_PANORAMA.md](CAMERA_RELIABILITY_AND_PANORAMA.md)를 참고한다.

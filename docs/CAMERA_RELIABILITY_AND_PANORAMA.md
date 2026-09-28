# 카메라 재생 신뢰성과 360도 합성 조사

기준: 사용자 확인 배포 커밋 `224482dae96b04bf8194ea36c81b1feebecde55c` (콤마·HA 모두). 조사일: 2026-09-28. 실제 실패 시점의 HA/에이전트 로그는 확보하지 않았으므로 아래 코드 결함이 모든 현상의 단일 원인이라고 단정하지 않는다.

## 360도 화면은 HA에서도 가능하다

첨부 MyID4-v1.29.apk의 assets/wayon_live.js를 직접 확인했다. 7–8행은 wide/driver 프레임 구분, 1176행 이후는 카메라별 VideoDecoder, 1290행 이후는 공통 전송 패킷의 타임스탬프와 카메라 구분을 처리한다. 193행 projectFisheye와 640–674행 WebGL uniform 설정 및 drawArrays가 두 영상을 구면에 투영하고 경계를 합성한다. 즉, 확인한 앱 경로는 서버가 하나의 360도 인코딩 영상을 보내는 방식이 아니라 클라이언트가 두 영상을 합성하는 방식이다. APK 코드를 그대로 배포하는 작업은 하지 않았다.

| 방식 | 비용과 특성 | 판단 |
|---|---|---|
| HA 전용 카드에서 두 영상을 WebGL 합성 | 시청 기기가 두 영상 디코딩·왜곡 보정·합성 담당. HA 영상 재인코딩 불필요 | 권장 |
| HA 또는 별도 서버에서 합성 후 한 스트림 제공 | 어디서나 일반 camera로 재생 가능하지만 디코딩·합성·재인코딩이 필요 | HAOS aarch64 성능 실측 후 선택 |
| 두 일반 카메라를 나란히 표시 | 구현 간단하지만 구면 투영·연결부 보정 없음 | 360도 구현으로 간주하지 않음 |

일반 camera 엔터티 자체에는 이 프로젝트의 두 어안 영상 합성 정보가 없다. 기존 개별 camera 엔터티를 유지하면서 전용 360도 카드를 추가하는 것이 적합하다. 첫 구현은 기존 HTTPS 경로를 유지한다. 두 HLS 영상을 WebGL 텍스처로 쓰는 방법은 호환성 면에서 후보지만 각 HLS 재생기의 버퍼 지연이 달라 동기화 검증이 필요하다. 앱에 가까운 방식은 공통 타임스탬프를 보존한 두 H.264 스트림을 인증된 HTTPS/WSS 경로로 받고 브라우저에서 디코딩하는 것이다. WebCodecs 지원은 실제 iOS/Android 클라이언트에서 확인하고, 미지원 환경은 개별 HLS 뷰로 안내한다.

현재 TransportMux는 카메라별 첫 프레임을 각각 시간 0으로 만든다. 360도 합성 전에 공통 캡처 시간 기준과 시작 오프셋을 보존해야 한다. 렌즈 보정값, 카메라 방향·위치, 미러링, 겹침 영역과 노출 보정도 필요하다. APK 기본값을 comma four의 검증된 보정값으로 간주할 수 없다. 차량 구조물에 가려진 영역과 두 렌즈 사이의 시차는 합성으로 복원되지 않는다.

## Open live view가 계속 보이는 이유

`camera.py:async_camera_image`는 항상 같은 PNG를 반환한다. 이는 대기 상태에서 촬영을 시작하지 않기 위한 동작이다. 이 이미지가 보인다는 사실만으로 카메라 시작이 진행 중인지, 영상 오류 후 정지 이미지로 돌아갔는지 구별할 수 없다.

HA Core 2026.9.0 manifest가 지정한 frontend 20260826.4의 ha-camera-stream.ts는 HLS가 hasVideo=false로 실패하면 MJPEG 이미지 경로로 전환한다. 이 프로젝트에서는 그 경로도 동일한 안내 이미지를 반환한다. 따라서 끝없이 대기하는 듯 보이는 UI가 설명된다. 같은 버전의 ha-hls-player.ts는 URL 요청 실패 및 retryable/fatal HLS 오류에 hasVideo=false를 알린다. 부모는 이에 따라 HLS 요소를 제거하고 이미지로 전환한다. 설치 환경에서 프런트엔드를 별도로 바꾸지 않았다면 사용자 버전에 해당하는 경로다.

### 재현하여 수정한 결함

`camera_relay.py`는 현재 세션과 다른 `ended` 알림을 프로토콜 오류로 처리해 장치 WebSocket 전체를 닫았다. 이전 캡처의 종료 알림은 stop 이후 늦게 도착할 수 있다. 실제 aiohttp 소켓 테스트에서 이전 세션 종료 알림으로 새 세션 연결이 CLOSE 되는 것을 재현했다. 수정 후 올바른 UUID의 과거 세션 알림은 무시하고 현재 세션과 리더가 유지됨을 확인했다. 현재 세션의 ended는 여전히 종료한다.

`capture.py`는 H.264 메시지에 conflate=True를 사용했다. 처리 지연 중 최신 메시지만 남으면 첫 키프레임/헤더 또는 이후 프레임이 참조하는 중간 프레임을 잃는다. 이를 conflate=False로 변경했다. 기존 출력 2 MiB 제한, 출력 막힘 5초 종료 및 세션 lease는 유지한다. 이 변경의 실기기 부하·지연 효과는 아직 측정하지 않았다.

### 기본 상세창의 재시도 복구 수정과 한계

HA 2026.9.0 Stream worker는 실패 후 같은 source URL로 재시도한다. 배포 기준 코드의 relay는 세션 종료 시 그 URL을 무효화해 403을 반환한다. URL 재발급은 새 async_create_stream 요청 때만 일어나므로 기존 재생기에서 기다리는 것만으로 복구되지 않는 경로가 있었다.

0.7.1 수정은 `device_ended`, `device_disconnected`, `source_timeout`에 한해 같은 loopback 주소를 유지한다. HA worker가 다시 요청할 때만 캡처를 재시작하며, 최초 시도 포함 최대 3회이고 첫 세션의 절대 만료 시각을 유지한다. 새 시도 성공으로 재시도 횟수나 5분 제한을 초기화하지 않는다. 주행 전환, 사용자 종료, 정상 소비자 종료, 프로토콜 오류에는 주소를 폐기한다. 재접속 상태만으로 자동 촬영을 시작하지 않는다.

실제 aiohttp HTTP/WebSocket과 PyAV로 첫 시작 실패 → 같은 URL 재요청 → 새 세션 생성 → 30프레임 디코딩을 검증했다. 시도 소진 후 403, 재시도에도 최초 만료 시각 유지, 주행 전환/수동 종료 시 재시도 차단을 별도로 확인했다. 이미 촬영 중인 스트림에 중간부터 들어온 경우 다음 키프레임부터 10프레임 디코딩도 확인했다. 이는 합성 H.264로 한 로컬 테스트이며 콤마 실영상·HA 브라우저 테스트는 아니다.

기본 상세창의 한계는 남는다. HA 내부 worker가 재시도하기 전에 프런트엔드가 이미지 모드로 전환했다면 백엔드 복구만으로 HLS 요소가 다시 만들어진다고 보장할 수 없다. 이 경우 상세창을 닫고 다시 여는 동작이 필요하다. 기존 HLS 소비자가 잠시 유지될 수 있으므로 상세창을 닫은 순간의 즉시 촬영 종료도 보장하지 않는다. 해당 동작까지 확실히 제어하려면 HA frontend의 재시도/fallback 처리를 고치거나 명시적인 시청 수명을 갖는 플레이어가 필요하다. 전용 카드를 설치해야만 이번 백엔드 수정을 사용할 수 있는 것은 아니다.

UI는 연결 중 → 카메라 시작 중 → 첫 영상 대기 → 재생 중을 구별하고, 정해진 시간 내 첫 프레임이 없으면 오류와 재시도 버튼을 표시해야 한다. 재생 성공은 WebSocket 연결이나 메시지 도착이 아니라 브라우저에서 첫 프레임이 표시된 시점으로 판정한다. 360도 카드도 같은 시청 수명·재시도 계층을 재사용한다.

## 검증 순서와 필요한 정보

1. 이번 두 수정은 HA relay와 콤마 capture 양쪽에 적용한다. 로컬 카메라 테스트 59개 통과는 실차·HAOS 재생 성공을 의미하지 않는다.
2. 현재 사용한 화면이 기본 엔터티 상세창인지 사용자 정의 카드인지, 재생한 브라우저/앱과 버전을 확인한다.
3. HA 기본 카메라 상세창에서 실패 1회와 성공 1회의 시각 및 같은 구간의 agent.log, HA stream/carrot_ha 로그를 대응한다. 토큰, URL capability, camera.json 전체는 공유하지 않는다. 장치 대시보드의 마지막 종료 사유도 함께 확인한다.
4. 새 뷰어 구현 후 광각·실내·망원 각각 첫 시작/닫고 즉시 재시작, 두 화면 동시 열기, 네트워크 끊김·복구를 검증한다. 각 조합을 20회 반복하고 첫 프레임 지연과 성공률을 기록한다. 실패 시 안내 이미지로 조용히 되돌아가는 경우는 불합격이다.
5. 뷰어 닫기·주행 전환·5분 만료 후 자동 재기동 없음, 대기 시 영상 전송 없음, 기존 텔레메트리 정상도 확인한다.
6. 360도는 동기화된 움직임, 경계 물체, 방향·미러링, iOS/Android GPU 부하를 실기기에서 검증한다.

## 공식 소스

- https://raw.githubusercontent.com/home-assistant/core/2026.9.0/homeassistant/components/stream/__init__.py (worker 재시도와 source 갱신)
- https://raw.githubusercontent.com/home-assistant/core/2026.9.0/homeassistant/components/stream/const.py (source timeout 30초, retry increment 10초)
- https://raw.githubusercontent.com/home-assistant/frontend/20260826.4/src/components/ha-camera-stream.ts (실패 후 이미지 fallback)
- https://raw.githubusercontent.com/home-assistant/frontend/20260826.4/src/components/ha-hls-player.ts (오류 시 hasVideo=false 통지)
- https://raw.githubusercontent.com/home-assistant/core/2026.9.0/homeassistant/components/frontend/manifest.json (frontend 버전 고정)

현재 완료: APK 구조 확인, 코드 원인 분석, 종료 알림 경쟁 조건 재현·수정, conflation 제거, 기본 상세창용 제한적 백엔드 재시도 복구. 미완료: 사용자 환경의 실패 로그 대조, 뷰어 수명 기반 재시도 UI, 360도 카드 구현 및 실제 브라우저 재생 검증. 이번 수정만으로 간헐적 재생 실패가 모두 해결됐다고 주장하지 않는다.


## 224482d 설치 환경에서 0.7.1 시험 업데이트

이번 카메라 실행 코드 변경은 HA의 camera_relay.py/camera_session.py와 콤마의 capture.py다. 빌드 ZIP에는 동일한 camera_session.py가 콤마 쪽에도 포함된다. 기존 camera.json과 영상 토큰을 다시 만들 필요가 없다. openpilot 브랜치 업데이트도 필요 없다.

1. HA 카메라를 모두 turn_off하고 콤마에서 아래 disable.py를 실행한다.
2. HA 통합 폴더를 백업하고 carrot_ha-0.7.1.zip을 /config에 덮어쓴 뒤 HA를 재시작한다.
3. carrot-camera-agent-0.7.1.zip을 콤마 /data에 복사하고 아래 순서로 프로그램 파일을 갱신한다. ZIP은 camera.json을 포함하지 않는다.

```bash
cd /data/carrot-camera
/usr/local/venv/bin/python3 disable.py
python3 -m zipfile -e /data/carrot-camera-agent-0.7.1.zip /data
/usr/local/venv/bin/python3 install.py
tail -n 50 /data/carrot-camera/agent.log
```

4. HA 카메라를 turn_on한 뒤 기본 상세창에서 시험한다. HA 로그의 `Camera capture interrupted: ...`와 같은 시각의 agent.log를 대응하면 캡처/네트워크 오류를 구별하는 데 도움이 된다. 로컬 0.7.1 ZIP 생성은 커밋·push·HA 배포가 완료됐다는 의미가 아니다.

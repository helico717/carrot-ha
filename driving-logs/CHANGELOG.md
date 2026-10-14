# 주행 로그 변경 기록

주행 로그 관련 모든 작업을 기록한다. 계획·로컬 검증·Git 게시·HA 반영·실차 설치는
별도 상태이며, 하나의 성공을 다른 단계의 성공으로 대신하지 않는다.

## 2026-10-14 — 환경 탐색과 구현 계획

- 요청: 당근웹 로그 UI 및 상세 레이더 분석을 HA에 이식하고 날짜별 GPS 지도와 최신
  5GB 보관을 추가. 첫 단계는 기존 파라미터 화면 자리의 실제 로그 조회까지.
- 조사: 집 VPN 경유 HA SSH 성공. ARM64, HA Core 2026.9.0, 통합 0.8.14-beta.5,
  확인 시 파일시스템 여유 약 116GB. DuckDNS HTTPS GET/TLS 검증 성공.
  Nginx Proxy Manager의 대상 도메인→HA:8123 전달 경로 확인.
- 소스: 당근웹 로그 모듈과 `tools/carrot_route_vault/`의 첨부 분석 화면 원본 발견.
  로그 UI와 레이더 계산 엔진 재사용, 분석 서비스 분리 방안을 계획.
- 정책: 완성 구간 즉시 직접 업로드+주차/연결 후 누락 보충. 실제 기록 시각 최신부터
  최대 5GB. Worker/D1/KV에 원본을 중계·저장하지 않는다.
- 관련 파일: `docs/driving-log-ha-implementation-plan-2026-10-14.md`.
- 게시: 계획서 커밋 `18adfa0`, 원격 main 반영 확인.
- 한계: 프록시 유효 업로드 제한·실차 성능·분석 ARM64 실행은 당시 미검증.

## 2026-10-14 — 실제 로그 수신·조회 첫 단계 구현

- 이유: UI만 복사하면 HA에 원본 파일·조회 API가 없어서 실제 로그를 볼 수 없다.
- HA 저장소: 전용 `driving_logs/store.py`. 최신 시각부터 구간 단위 보관, 5,000,000,000
  bytes 예약·색인·미완료 파일 포함, 과거 재업로드 방지, 이어받기, SHA-256, 완료 후 공개.
  차계부/텔레메트리 archive와 별도 파일 저장.
- HA API: `driving_logs/http.py`, 통합 `__init__.py` 등록. 목적별 장치 HMAC 인증,
  관리자 인증 이후 장치 범위 1시간 HttpOnly 조회 세션, 목록·구간·파일·영상 Range 응답.
- Comma: `ha/driving_logs.py`와 `terminal.py` 연결. 기존 discovery 결과 공유로 새 Worker
  polling 없이 HA 직접 전송. 완료·잠금 해제 원본만 최신부터 순차 전송, 원본 TS 보존,
  FFmpeg stream-copy MP4 생성, FFprobe 길이가 있으면 시작시각 계산. 전송 상태는 Git 밖.
- UI: `frontend/carrot_logs/`는 원본 당근웹 로그 HTML·생성 UI/로그 번들·스타일 재사용.
  `ha_logs_bridge.js`는 HA 로컬 범위로 연결. `carrot-logs-card.js`는 정식 새 카드.
  `carrot-dashboard-runtime.js`는 lazy 등록. 옛 `carrot-params-card.js`는 호환용이며 기존
  파라미터 구현은 `carrot-parameter-tuning-card.js`로 분리.
- 이름 수정: 사용자 피드백에 따라 정식 타입 `custom:carrot-logs-card`, 리소스
  `/carrot_ha_static/carrot-logs-card.js`, 표시 이름 **Carrot HA — 당근웹 로그**.
- 검증 대상: 사용자 지정 `https://homeassistant202604.duckdns.org/lovelace/8`.
- 지원: 목록·정렬·선택·영상 창·원본 개별 다운로드. 분석·지도·외부 전송·선택 ZIP·
  화면 녹화 수신·실제 썸네일은 다음 단계이며 현재 UI에서 미지원 안내.
- 재현: `scripts/build_logs_port.py`, 원본 commit `baf47a6f` 고정·provenance 저장.
- 테스트: `tests/test_driving_logs.py`, `test_driving_logs_transport.py`,
  `driving-logs-port-browser.cjs`, 기존 params 검사 경로 보정;
  openpilot `ha/tests/test_driving_logs.py`.
- 통과: 저장/해시/중단 재개/용량/경로 검증 4건, 실제 HTTP 및 Comma sender→HA receiver
  통합 2건, Chromium 목록·선택·정렬·영상 창 URL·닫기·모바일, dashboard live/lazy/view-state,
  cloud live/incremental/history cache, Worker incremental/benchmark, Comma param/terminal/logs 12건.
- 전체 Comma 92건 중 기존 카메라 검사 2건 실패: `encode_media` 누락 및 PyAV 누락 기대
  불일치. 카메라 소스·테스트의 HEAD 대비 변경 없음 확인. 기기 장애로 판단하지 않는다.
- 환경 보정: Mac 기본 Python 3.9에는 `asyncio.timeout`이 없어 기존 terminal 검사 실패.
  Python 3.12 재검증에서 관련 검사 통과. 브라우저·HTTP 소켓은 sandbox 제한 때문에
  승인 경로의 분리 테스트 환경에서 실행했다.
- 게시 준비: 최신 openpilot 원격 자동 동기화 변경 위에 단일 부모 커밋으로 rebase.
  Comma 전송 커밋 `05bc6d0a`; 원격 게시 결과는 다음 배포 항목에 기록.
- 배포 정책 변경: 사용자 요청으로 이번에는 릴리즈 없이 HA SSH 직접 반영·검증.
  버전/태그/Release/Worker 배포 없음. 필요한 파일 백업 후 반영 예정.
- 미확인: 설치 후 실제 기기 FFmpeg·전송/재개·CPU/열, 실제 영상 디코딩, 5GB 회전,
  장시간 기존 서비스 영향. 합성 파일 검사는 실제 영상 재생 성공의 증거가 아니다.

## 2026-10-14 — 주행 로그 전용 기록 의무화

- 요청에 따라 `driving-logs/AGENTS.md`, 이 `CHANGELOG.md`를 만들고 루트 `AGENTS.md`에
  작업 전 지침 확인·모든 로그 작업 즉시 기록 의무를 연결한다.
- 배포 절차는 `docs/driving-logs-setup.md`에 기록. 다음 작업도 내용·이유·관련 파일·검증·
  Git/HA/Comma 배포 상태·미확인 사항을 누락 없이 추가한다.

## 2026-10-14 — HA 직접 파일 반영 및 사용자 적용 대기

- 사용자 요청에 따라 릴리즈 없이 SSH 직접 반영. 로그 관련 파일 27개 SHA-256 일치
  확인, 운영 `__init__.py`는 기존 내용을 보존하고 로그 API 등록 2줄만 추가했다.
- 백업: `/config/carrot_ha/deployment-backups/driving-logs-20261014/before`.
  manifest·차계부·기존 설정·운영 DB는 변경하지 않았다.
- Comma 원격 게시: `05bc6d0af87a53569f91facef1c490c850786a73`,
  `origin/carrot-wip-model_selector-ha`의 SHA 일치 확인.
- 사용자에게 HA 재시작과 Comma `git pull --ff-only && sudo reboot`를 요청했다.
  사용자는 시간이 걸리며 완료 후 추가 답장하겠다고 했다. 현재 적용 완료로 간주하지 않는다.
- 대기 중인 검증: 재시작 후 신규 HA API, 실제 Comma 로그 도착·영상 재생,
  새 카드 타입/리소스 적용 후 사용자 지정 Lovelace 8번 화면.
- HA 저장소 코드와 문서의 Git 게시·최종 운영 검증 기록은 후속 답장 후 이어간다.

## 2026-10-14 — 사용자 재시작 후 실제 수신 확인

- 사용자가 HA 재시작과 Comma Pull·재부팅 완료를 알렸다.
- 외부 frontend-version 응답 `0.8.14-beta.5-a4071aa720bf`로 HA 새 코드 재시작 확인.
- 실제 HA 로그 색인: 4개 구간, 수신 완료 3개, 예약량 52,046,367 bytes 확인.
  기기 원본→운영 HA 수신이 시작됐다는 증거이며 장시간 전송·영상 디코딩의 증거는 아니다.
- 다음 사용자 작업: 리소스를 `/carrot_ha_static/carrot-logs-card.js`로 바꾸고 8번
  대시보드 카드 타입을 `custom:carrot-logs-card`로 변경, 기존 device_id 유지, 강력 새로고침.
- 실제 대시보드 목록·영상 재생·시간 이동·다운로드와 장시간 용량 회전은 후속 검증 대기.

## 2026-10-14 — 사용자 실재생 확인 및 화면 누락 보정 중

- 사용자 스크린샷과 보고로 실제 운영 HA의 영상 재생 확인. 목록·구간 목록 썸네일은
  자리표시자이며 주행 리플레이는 모듈 미연결로 동작하지 않는 상태가 드러났다.
- 리플레이의 “이 브라우저에서는 사용할 수 없음”은 원본 런타임 미로딩 안내였다.
  브라우저 미지원으로 확인된 것이 아니다. 원본 worker·재생 화면 연결을 진행한다.
- 구간 목록 누락 원인: 원본 CSS wide media query와 HA 브리지의 축약된
  `isCompactLandscapeMode` 조건 불일치. 넓은 화면에서 DOM 내용을 만들지 않았는데
  CSS는 펼침 컨트롤을 숨겼다. 원본과 같은 media query로 수정했다.
- 썸네일: `ha_log_thumbnails.js`에서 HA 저장 MP4의 보이는 항목만 단일 디코더로
  프레임 추출, 최대 48개·각 128KiB JPEG 메모리 캐시. 숨김 시 중단, 종료 시 해제.
  HA 디스크/Comma/Cloudflare 변경 없음. 원본 bridge HTML·빌드 스크립트에 연결.
- 검사: 합성 영상 실제 Chromium 디코딩으로 썸네일 480px 생성, 목록·선택·정렬·영상
  창·모바일 검사 통과. wide 구간 목록 가시성 회귀 검사를 추가해 재검증 예정.
- HA FFmpeg 확인을 위한 Docker 읽기는 SSH 앱 protection mode 때문에 불가했다.
  보호 설정은 변경하지 않았다. 썸네일 구현은 브라우저 영상 디코딩을 사용한다.
- 관련 파일: `frontend/carrot_logs/ha_log_thumbnails.js`, `ha_logs_bridge.js`, `logs.html`,
  `scripts/build_logs_port.py`, `tests/driving-logs-port-browser.cjs`.
- 배포: 이번 보정은 아직 로컬 작업 중. 리플레이 연결과 관련 검증 후 SSH 직접 반영한다.

## 2026-10-14 — 원본 리플레이 연결 및 실로그 검증

- `driving_logs/http.py`에 장치 범위·기존 조회 세션을 사용하는 replay-source 설명과
  rlog/영상 파일 응답 추가. API 인증·Range·원본 바이트 보존 검사 통과.
- 같은 원본 커밋의 replay client, 압축/Cap'n Proto 해석 워커, 이벤트·그래프·전방·
  분석 모듈, 리플레이 HTML·CSS를 이식. worker 경로와 입력 URL을 HA로 연결하고
  전용 runtime 등록 이름으로 분리한다. 원본 계산·해석 로직은 재작성하지 않는다.
- `ha_replay_loader.js`에서 클릭 시에만 리플레이 자산을 로드하고 저장된 자료로 재생한다.
  라이브 WebSocket이나 기기 설정 쓰기는 없다. 재생/정지/배속/시간 이동/구간 선택은
  원본 모듈을 사용한다. 기록 속도·가속도·Lead 수치 HUD를 HA 상태 어댑터로 연결한다.
- 원본 drive workspace 스타일과 stream-ready 상태도 필요했다. 이를 연결하고
  실제 영상 표시·닫기 버튼 위치를 Chromium에서 확인했다.
- 원본 Carrot Vision의 GPU 차선/AR 오버레이 전체는 이번 어댑터에 포함되지 않는다.
  레이더 검증 상세 화면·지도·외부 전송과 함께 남은 범위를 별도로 추적한다.
- 운영 HA의 실제 한 구간 rlog/MP4를 임시 비공개 파일로 읽어 원본 worker 해석,
  재생 진행·정지·seek 후 기록 상태, SVG 그래프, 모바일 폭, 닫기 검증 통과.
  테스트 자료·GPS 원문·영상은 Git에 포함하지 않았다.
- 썸네일 디코더는 리플레이/숨김 시 중단하고 제거된 DOM 관찰·큐를 정리한다.
- `scripts/build_logs_port.py`에 재현 가능한 리플레이 자산/페이지 생성도 추가했다.
- Git 게시·HA 직접 반영은 아래 후속 배포 결과를 기준으로 한다. HA 재시작 후 운영
  대시보드의 새 리플레이는 사용자 확인 대기이며, 로컬 실로그 검증과 구분한다.

## 2026-10-14 — 원본 HUD 복구·10GB 주행 단위 보관 수정 중

- 원인: 이전 이식이 GPU 렌더러·원본 HUD를 제외하고 간단한 수치 어댑터로 대체했다.
- 동일 원본 커밋의 렌더러·raw 상태 해석·투영·HUD 모듈을 기록 전용으로 연결한다.
- 저장 한도 10,000,000,000 bytes, 오래된 주행 전체 삭제와 삭제 주행 재전송 방지를 구현한다.
- 관련 파일: `driving_logs/store.py`, `frontend/carrot_logs/`, `scripts/build_replay_renderer.py`, 저장·브라우저 테스트.
- 사용자 지시: 버전 상승·태그·릴리즈 없이 검증·커밋·푸시 후 HA 직접 반영.
- 후속 요청 반영: 드롭다운 현재 구간 텍스트·접근성 표시를 유지하고 같은 스타일의
  이전·다음 버튼을 선택기 옆에 추가. 좁은 화면에서 줄바꿈하며 경계에서 비활성화한다.
- 너비 변동 원인: `.logs-shell`의 너비 미지정과 max-width/auto margin이 콘텐츠 고유
  너비에 의존했다. HA 카드·iframe·로그 shell에 안정적인 전체 너비를 적용한다.
- 당근 서버 전송: 원본 `web_upload.py`와 결과 포매터를 고정 커밋에서 재사용한다.
  HA 장치 범위 summary/start/job/cancel, 원본 확인·진행률·결과 UI, 크기 응답 불일치·
  서버 한도 거절·재시도·취소·보관 정리 시 업로드 중단을 연결한다. 별도 Discord 전송 없음.
- 합성 파일 로컬 서버 검사 15건 중 14건 통과·Comma 송신기 통합 1건 환경 미지정으로 제외.
  원작자 서버에 테스트 파일을 올리거나 NAS 내부 수신 확인을 수행하지 않는다.
- 실주행 자료의 로컬 복사는 자동 승인 심사가 민감 자료 복사 대상 허가 및 경로 검증
  부족으로 거절해 수행하지 않았다. GPU·HUD·탐색·아이콘은 합성 기록 Chromium 검사로 검증한다.
- 전송 결과 화면까지의 브라우저 검사에서 원본 API의 `waitMs` 전역 helper 누락을
  추가로 발견해 HA 브리지에 연결했다. 원본 범위 선택·전송 확인·진행·결과 흐름을 검사한다.
- 검증·배포: 진행 중. 운영 적용·재시작·실차 검증 완료로 보고하지 않는다.
- Chromium: 합성 영상의 목록·썸네일·첫 표시 전체 너비·디코딩 후 폭 유지·선택·원본
  전송 확인/진행/결과·정렬·영상·모바일 검사 통과. 원본 HUD/GPU 픽셀·아이콘·전후
  seek·상단 이전/다음·현재 구간 표시·HUD 토글·닫기·라이브 소켓 0개 검사 통과.
- 기존 dashboard live/lazy/view-state 10건, incremental 5건·history 1건·Comma param
  polling 4건 통과. Worker benchmark 통과. Worker incremental은 기존 스키마의
  `measurements_json` 중복 마이그레이션 오류에서 실패(해당 코드 변경 없음).
- UTF-8 모드에서 cloud-live 6건 통과. 로그 HTTP 검사에 미인증 summary 거부·
  인증된 원본 크기 요약·다른 엔트리 작업 ID 조회 거부를 추가했다.
- Git 게시: 실행 코드 커밋 `136592135652322184764ab4c61d34531dbf6ccc`를 main에 푸시했다.
- HA 사전 검사에서 기존 설치 파일이 수정 전 Git 내용과 일치함을 확인한 뒤 코드·자산
  107개를 직접 설치했다. 모든 설치 파일 SHA-256 일치 확인. 백업:
  `/config/carrot_ha/deployment-backups/driving-logs-hud-136592135652/before`
  (실제 경로 `/homeassistant/carrot_ha/deployment-backups/driving-logs-hud-136592135652/before`).
- 외부 DuckDNS HTTPS의 카드·리플레이 로더·레이아웃 CSS·원본 HUD 모듈 4개가
  게시 커밋과 같은 SHA-256임을 확인했다. 운영 데이터와 토큰·로그·영상을 복사하지 않았다.
- 배포 완료, 사용자 HA 재시작 1회·강력 새로고침 후 실제 HUD·용량·선택 전송 확인 대기.
  백엔드는 재시작 전까지 이전 코드다. Comma 변경/Pull·Worker/D1/KV 배포 없음.
  manifest 버전·태그·GitHub Release 변경 없음. 원작자 NAS 내부 수신 검증은 하지 않았다.

## 2026-10-14 — 썸네일·목록·리플레이 SSH 반영 완료

- 수정 파일 23개를 기존 파일 백업 후 HA에 직접 설치하고 SHA-256 일치 확인.
- 백업: `/config/carrot_ha/deployment-backups/driving-logs-replay-20261014/before`.
- 외부 DuckDNS에서 제공되는 `ha_replay_loader.js`도 로컬 SHA-256 일치 확인.
- 최종 검사: 실제 수신 rlog/MP4로 재생 진행·일시정지·seek 기록 갱신, SVG 그래프,
  모바일 크기, 닫기 및 목록·썸네일·선택 검사 통과. API/저장/전송 통합 6건 및
  기존 dashboard live/lazy/view-state 회귀 통과.
- Comma·Worker·D1/KV·manifest 변경 없음. 버전 상승·태그·Release 발행 없음.
- 새 replay-source API 활성화를 위해 사용자 HA 재시작 1회와 강력 새로고침이 필요하다.
  운영 8번 대시보드에서 수정 리플레이를 확인한 것은 아직 아니다.
- 코드 게시: HA 첫 단계 `4d16902`, 썸네일·목록·리플레이 보정 `5d082d2`를 원격 main에
  푸시한 결과 확인. 기본 작업 폴더도 해당 변경으로 fast-forward 반영했으며 기존
  차계부·manifest 등 다른 작업의 staged/unstaged 변경은 유지했다.
- 이 후속 기록은 Git 게시·작업 폴더 반영 결과를 추가하는 문서 변경이다. 운영 코드
  재배포·버전 변경·릴리즈는 하지 않는다.

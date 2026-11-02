# IQpilot + Carrot HA 개인 시험 준비

2026-11-02 KST. **검토용 소스 준비 단계이며 설치 가능한 배포본이 아니다.**
현재 당근 설치·HA 실행 코드·차량 설정·OS는 변경하지 않았다.

## 고정한 기준

| 대상 | 기준 |
| --- | --- |
| 실제 당근 설치 | `helico717/openpilot`, `5ec4868a12a9038547b373eb95be3a5fa86d30aa` |
| 당근 복귀 ref | 같은 커밋에 고정한 `ha-back` |
| 짧은 복귀 주소 | `installer.comma.ai/helico717/ha-back` |
| 현재 기기 OS | `19.8-carrot-bt1` |
| IQpilot 안정판 | `IQ.Lvbs/IQPilot`, `release`, `5c9291b9df6d90007d73ecd749b135bd5008e80d` |
| IQpilot 기본 OS | `IQ.OS 4.9.9.4` |

복귀 ref는 자동 업데이트하지 않는다. 완전히 당근으로 복귀한 뒤 기존 운영 브랜치로
전환하고 정상 확인 후 보관/삭제를 결정한다. 설치 주소의 실기 설치와 OS 왕복은 미검증이다.

## 백업

`scripts/backup_comma.py`로 Params 실제 경로·수집기·HA·카메라 설정과 SQLite를
백업했다. SQLite online backup/quick_check와 archive/SHA256 검사를 사용한다.
누락된 두 경로는 다른 설치 구조의 설정 카탈로그 후보이며 현재 구조 카탈로그는 포함됐다.

`scripts/download_comma_backup.py`는 Mac에서 HA OAuth 관리자 인증으로 기존
터미널 WebSocket을 사용한다. `127.0.0.1` callback은 Mac 내부 로그인 결과 수신용이며
집 HA/차량 주소가 아니다. 같은 Wi-Fi, 새 SSH 포트, 공개 파일 링크는 필요 없다.
인증은 메모리 보관 후 종료 시 폐기한다. 인증 없는 파일 반출은 지원하지 않는다.

장시간 PTY 출력 전송은 연결 단절로 실패했다. 마지막 관측 상태는 offroad/local_ready가
모두 true였으므로 실제 주행 때문이라고 해석하지 않는다. 현재 96KiB 요청·블록 SHA256·
완료 offset 이어받기·같은 로그인 내 재연결을 사용한다. 최종 전체 SHA256까지 일치해야
외부 백업 완료로 판정한다. 실제 Mac 반출이 완료됐고 원본 SHA256 일치, SQLite 5개 read-only quick_check, Params와 원래 커밋·OS·비공개 권한을 확인했다. 임시 인증 폐기도 완료됐다.
백업에는 인증정보가 포함되므로 Git/공개 저장소에 넣지 않는다. OS 이미지·모델·주행 영상은
이 백업의 범위가 아니다. Params 전체를 IQpilot에 무조건 복원하지 않는다.

## 공개 코드에서 확인한 차이와 준비한 소스

- IQpilot 패키지는 `iqpilot`, CAN 라이브러리는 `iqdbc`이다.
- 공개 manager에 PythonProcess를 추가할 수 있다. 기존 주행 프로세스 정의는 유지하고
  HA/카메라 companion 등록만 별도로 준비했다. IQ FastSleep low_power 정책도 유지한다.
- MEB DBC `vw_meb`와 CANParser의 `(dbc_name, messages, bus)` / `update(frames)` 경로가 있다.
  공개 IQ DBC에서 필수 8개 메시지와 에너지·전압·용량·거리·외기온 6개 신호 존재를 확인했다. 실제 IQ DBC를 사용한 recorded-CAN 결과 비교는 아직 필요하다.
- 차량/위치/주변장치 메시지와 wide/road/driver livestream encode 서비스는 존재한다.
- 현재 당근 terminal은 localhost:7000 당근웹 PTY에 의존한다. `compat/iqpilot/iq_terminal.py`는
  별도 리스너 없이 PTY를 소유하는 어댑터다. HA 관리자 lease와 명시적 offroad 검사는 유지한다.
  세션 이전 출력 replay를 보내지 않고 본인이 생성한 프로세스만 종료한다.
- 당근 파라미터 동기화는 검토 사본에서 시작하지 않는다. 기존 큐를 소비하거나 IQ 설정에
  당근 값을 적용하지 않는다. IQ 전용 설정 카탈로그/타입/범위/readback/ACK는 별도 구현 대상이다.
- 로그 기본 디렉터리는 양쪽 모두 `/data/media/0/realdata`지만 파일 전송 성공과 IQ rlog
  해석 호환은 별개다. IQ uploader/deleter와 보관 경쟁도 검증해야 한다.

`scripts/prepare_iqpilot_ha.py`는 두 Git SHA를 확인하고 공개 HA Python 소스만 변환한다.
인증정보·DB·모델·비공개 바이너리는 복사하지 않는다. 원본 IQ 저장소를 수정하지 않으며
산출물의 `PORTABILITY.json` 상태는 항상 `REVIEW_ONLY_NOT_INSTALLABLE`이다.
실행 예시는 기기 명령이 아니라 개발 Mac의 검토 도구 사용법이다.

```bash
python3 scripts/prepare_iqpilot_ha.py \
  --donor /private/tmp/carrot-iq-ha-donor \
  --iqpilot /private/tmp/iqpilot-ha-review \
  --output /private/tmp/iqpilot-ha-overlay-review
```

검토 사본 47개 Python 파일의 AST 확인, 배터리/충전/주행경계/저장/로그 정책 27개 테스트,
새 PTY 어댑터의 실제 POSIX 출력 및 offroad 입력 차단/프로세스 종료 2개 테스트가 통과했다.
공개 IQpilot Cap’n Proto 스키마로 wide/road/driver livestream의 header/data/idx.timestampSof/idx.flags 왕복과 CarState의 canValid/vEgo/gearShifter도 확인했다. 이는 Mac 합성 검증이며 IQ.OS 설치·차량 호환·주행 안전성 검증이 아니다.

## OS 복귀와 남은 설치 조건

공개 launch 스크립트는 OS 버전이 다르면 OS 업데이트 경로에 진입한다.
두 manifest의 boot/system 및 bootloader 해시가 다르다. 단순 Git 브랜치 전환만으로
자유롭게 왕복할 수 있다고 약속하지 않는다. IQ.OS의 검증된 runtime 경로도 있으므로
현재 OS를 허용 목록에 추가하거나 검증을 끄는 방법으로 호환성을 가장하지 않는다.

현재 당근 커밋 manifest의 boot/system 다운로드 URL은 HEAD 요청 HTTP200을 확인했다.
boot 압축 크기는 14,273,596 bytes, system은 1,010,655,092 bytes였다. 이미지 해시 검증,
실제 설치·역방향 복귀·부트 체인 호환은 아직 하지 않았다.

설치 가능한 후보를 만들기 전 다음을 마쳐야 한다.

1. **완료:** Mac 반출 백업의 전체 SHA256 및 SQLite 5개 무결성 확인.
2. IQ.OS에서 compiled Params 키·CAN 디코딩·카메라 codec/소유권·자원 사용 검증 준비.
3. IQ Sentry/Live View와 카메라 자원 충돌 시 실패 처리 및 주행전환 종료 확인.
4. IQ 로그와 기존 당근 로그를 구별해 디코딩하고 기존 HA 기록/식별자 연속성 확인.
5. IQ 설치와 당근 OS 복귀를 함께 검증한 Git 전용 배포 경로 준비.

새 IQ 배포 브랜치·HA 운영 반영·릴리즈·Comma 설치/재부팅은 아직 수행하지 않았다.

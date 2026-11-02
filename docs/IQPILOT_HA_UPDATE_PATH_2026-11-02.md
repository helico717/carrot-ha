# IQpilot + HA 유지 업데이트 경로 — 2026-11-02

## 현재 실제 상태

기기 순정 IQ release `11fcd74243ede4f1f5df24db1ed2d44e2ac22664`와
OS `4.9.9.9.2` 부팅, UpdaterState=idle, 실패 횟수 0, 주차 상태를 읽기 전용으로 확인했다.
업데이트 중 보였던 Unauthorized/LocalAPI no_verification_key_configured만으로
플래싱 실패 또는 재부팅을 판단하지 않는다. 실제 /VERSION과 업데이트 상태를 다시 확인한다.

현재 새 후보 조립·검증·게시 및 실기 복구는 아래 변경 기록의 상태를 따르며,
이 문서만으로 차량 설치나 실제 수신 완료를 의미하지 않는다.

## 앞으로의 업데이트

1. GitHub 기본 브랜치 carrot-wip의 iq_ha_upstream_refresh.yml이 매일 04:17 KST
   또는 수동 실행으로 원본 release를 확인한다.
2. 원본 SHA에 고정된 vendor 하위 저장소와 HA 확장을 조립한다. IQ 바이너리는 재배포하지 않는다.
3. OS가 같으면 자동 시험을 진행한다. OS가 바뀌면 기본적으로 NEEDS_REVIEW로 중단한다.
   공개 소스와 대상 OS를 검토한 정확한 SHA만 reviewed_os_transitions.json에 기록해 전환을 허용한다.
   이 기록은 소스 호환성 검토이며 실차 검증 성공 표시는 아니다.
4. 조립 무결성·카메라 독점 및 주차 차단·PTY·복귀·기록 계약과 실제 IQ CAN/스키마 시험이
   통과해야 iq-ha에 fast-forward 게시한다. 테스트 실패/원본 삭제/OS 미검토 때는 기존 배포를 유지한다.
5. 기기는 iq-ha를 유지하고 HA의 IQ.drive 업데이트 버튼으로 Git pull과 고정 vendor를 함께 받는다.
   사용자 재부팅 후 IQ 원본 런처가 필요한 OS 업데이트를 처리한다. 원본 서버 인증·다운로드와
   전원 유지가 필요하며 OS 쓰기/재부팅은 별개 단계이다.
6. IQ 순정 자동 소스 updater(updated)는 후보에서 비활성화한다. IQ 웹의 순정 브랜치 전환,
   Quick Update 또는 순정 업데이트 버튼으로 HA 후보를 덮지 않는다. 주행 관련 프로세스와
   원본 OS 설치기·서명 검증은 유지한다.

주소·토큰·차량 ID는 Git 밖 /data/carrot_ha 아래에 남으므로 일반 업데이트 때 재입력하지 않는다.
기기 초기화는 이 상태를 지울 수 있어 Mac 비공개 복구 키트를 별도로 보존한다.

## 최신 순정에서 처음 HA를 붙이는 순서

현재 기기는 이미 위 OS·순정 SHA까지 업데이트를 마쳤다. HA가 없는 최초 연결은
기기 SSH(계정 iq) 또는 IQ 자체 터미널로 수행한다. 계정 SSH 키와 실제 기기 키를 구분한다.
기기 개발자 메뉴에서 GitHub helico717의 키를 다시 등록했으며 직접 연결 결과는 변경 기록에 남긴다.

기기가 주차 상태이고 전원을 유지한 상태에서 사용자가 수행한다. GitHub 후보 CI 성공과
게시 SHA를 확인한 뒤 실행하며, 현재 원본/OS가 후보 manifest와 다르면 설치기는 거절한다.

```sh
git clone --branch iq-ha --single-branch https://github.com/helico717/openpilot.git /data/iq-ha-install
cd /data/iq-ha-install
git submodule update --init --reference /data/openpilot --dissociate -- vendor/iqpilot
python3 bootstrap/install_from_stock.py
```

/data/iq-ha-install이 이미 있으면 삭제/덮어쓰기하지 말고 상태를 먼저 확인한다.
초기 clone과 vendor 준비는 현 실행 저장소를 바꾸지 않는다. 충분히 받은 뒤 설치기가
주차·idle·정확한 순정 SHA/OS·깨끗한 소스·vendor 확인 후 Git으로만 전환한다.
기존 .iqpilot 런타임 캐시는 Git 밖으로 보존한다. 무시된 파일도 강제로 덮지 않으며
충돌 시 중단한다. stage에 계속 의존하지 않도록 vendor를 dissociate한다.
설치기가 실패하면 재부팅하지 말고 실패한 단계를 확인한다. reset/clean/수동 소스 복사는 하지 않는다.

그다음 **Mac 창**에서 비공개 연결 설정 두 개를 전용 Git 관리 CLI로 전달한다.

```sh
cd ~/Developer/carrot-ha
python3 tools/iq-ha-restore.py --host 차량IP --identity ~/.ssh/id_ed25519 --kit .private-recovery/iq-ha
```

도구는 receiver와 camera 설정만 허용하고 동일 차량 ID와 HTTPS/키 형식을 검증한다.
주차가 불명확하거나 기존 설정이 다르면 덮어쓰지 않는다. 키는 SSH stdin으로만 전달한다.
Params·보정·DB·대기열은 복원하지 않으며 카메라는 자동으로 시작하지 않는다.

**차량 SSH 창**에서:

```sh
cd /data/openpilot
/usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.iq_preflight
/usr/local/venv/bin/python3 -m iqpilot.selfdrive.carrot.ha.camera.configure --enable
```

진단 실패는 우회하지 않는다. FastSleep은 기기에서 끄고, 최종 재부팅은 사용자가 기기 메뉴에서 한다.
새 수집기/터미널 프로세스는 재부팅 뒤 시작하므로 재부팅 전 수신 없음은 성공/실패 판정이 아니다.

## 검증 범위

- HA MEB 전압 정의는 IQ 기본 DBC와 다르다. 실제 차량에서 사용한 고정 Carrot donor의 DBC를
  HA 수집기 전용 경로에 포함한다. IQ 주행 제어 DBC는 수정하지 않는다.
- 실제 새 IQ CANParser/CANPacker로 합성 수신 프레임을 통과시켜 bus0/1의 잔량·거리·외기온·
  전압·측정 용량과 SNA 대체·다른 버스 무시를 시험한다. 관련 없는 브랜드의 Params 조회만
  시험 더블이며 CAN 파서/DBC와 카메라 capnp 스키마는 실제 공개 원본이다. CAN 전송은 없다.
- 설치기는 임시 Git 저장소에서 전환·런타임 보존·하위 저장소 독립성·원격 추적과
  업데이트 중/OS 불일치/주차 불명/충돌 시 중단을 검증한다.
- 복원기는 임시 상태 디렉터리에서 형식/ID 검증, 재실행, 권한, 덮어쓰기 거절을 검증한다.
- 최종 완료에는 실제 기기 재부팅 후 기존 HA 차량의 새 측정 시각·터미널·주차 카메라,
  그리고 차량 연결 뒤 짧은 운행/충전 기록 연속성을 각각 확인해야 한다.

당근 전용 파라미터/로그 화면과 IQ 로그 업로드는 기존 IQ 일시중지 정책을 유지한다.
당근 OS 복귀의 권한·파티션 제약은 별도 복귀 매뉴얼을 따르며, HA 연결 복구와 혼동하지 않는다.

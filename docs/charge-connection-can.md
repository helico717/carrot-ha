# 충전 연결 CAN 기록 — 2026-10-04

## 목적과 범위

주차 중 배터리 잔량이 한 번 증가하면 충전으로 오인하는 현상을 조사하기 위해, 잔량 기반 판정과 독립된 충전 플러그 안내 및 충전 요청 CAN 신호를 기록한다. 기존 충전 판정·장부·요금은 변경하지 않는다. 0.8.12-beta.2의 선택적 손실 없는 압축/복원 기능을 포함한 0.8.12-beta.3이다.

## 엔터티

- binary_sensor의 이름은 `충전 플러그 연결 신호`, object ID 제안은 `charge_plug_indication`이다. 실제 ID는 HA entity registry에 따라 달라진다.
- WBA_03 (0x394)의 WBA_GE_Texte_02 = 2: ON. 다른 0~7 코드: OFF. 이것은 DBC에 정의된 플러그 연결 **안내 코드 감지**이며, 실제 물리 연결 여부와 항상 일치한다고 검증되지 않았다. 특히 OFF는 플러그 분리 확정이 아니다.
- 둘 중 한 버스에 신선한 코드 2가 있으면 ON. 신선한 코드가 전혀 없으면 unknown. 신호별 측정 시각 기준 180초 만료이며, 차량의 다른 값이 갱신돼도 오래된 신호를 신선하게 만들지 않는다.
- `충전 연결 CAN 진단` 센서 상태는 신선한 후보 수신 시 unverified, 미수신/만료 시 unknown. 속성에 버스별 코드/측정 시각/신선도/메시지·신호명을 남긴다.
- 후보는 WBA_03.WBA_GE_Texte_02, Motor_26.MO_E_Texte, Motor_Hybrid_06.MO_Text_Aktivierung_Antrieb, HVK_01.HVK_BMS_Sollmodus, HVK_01.HVK_HVLM_Sollmodus이다.

## 수집과 저장

Comma 기존 CAN 수신/샘플링 경로에서 bus0과 bus1을 별도로 디코딩한다. 기본값이 아닌 실제 vl_all 수신값만 저장한다. 후보 메시지는 선택적 parser로 추가하므로 구형 DBC의 미지원 메시지가 기존 배터리 파서를 중단하지 않는다. CAN 송신·UDS 조회·새 스레드·추가 클라우드 조회/KV 쓰기는 없다.

기존 telemetry JSON -> Worker -> HA archive 경로로 원시 필드와 field_measured_at가 보존된다. 기존 압축 projection에서도 이 필드는 유지한다. HA Recorder가 엔터티를 제외하지 않았다면 ON/OFF/unknown 및 속성 변화가 이력에 기록된다. 기존 CAN 샘플링(최대 4초 수신 후 26초 대기), 주차 업로드 약 60초, HA polling 때문에 짧은 순간 변화를 놓칠 수 있다. 완전한 연결/분리 이벤트 로그나 즉시 표시를 보장하지 않는다.

## 실차 비교

정상 충전 조작으로 미연결, 연결·예약 대기, 실제 AC 충전, 중지·연결 유지, 분리 시각을 기록해 엔터티와 비교한다. DC 충전도 별도 비교한다. 다른 안내 문구가 표시되는 경우와 차량 수면 시에도 확인한다. 코드가 계속 고정되거나 Comma 버스에서 수신되지 않으면 물리 연결 센서로 승격하지 않는다. 검증 후에만 기존 충전 추정의 근거로 사용한다.

## 배포 및 되돌리기

HA는 HACS beta.3 설치 및 재시작. Comma는 게시된 carrot-wip-model_selector-ha를 git pull --ff-only 후 재부팅. 기기 파일 수동 수정 없음. Worker/D1 변경·배포 없음.

되돌리기는 새 CAN 변경 커밋을 Git revert해 게시하고 기기에서 clean pull/재부팅한다. HA beta.2로 돌아가면 새 엔터티 구현만 사라진다. 압축이 켜져 있다면 압축 미지원 버전으로 내리기 전에 restore_archive를 실행한다. 기존 원시 기록을 삭제하거나 과거 충전 장부를 재작성하지 않는다.

## 검증

새 decoder/영속성 테스트 3개, HA indication/evidence 테스트 2개 통과. HA 전체 Python 234개(2 skip), dashboard 지정 회귀 10개 통과. Comma 전체 69개에서 카메라·터미널 기존 오류 4개 별도 확인 대상. 실차 수신·신호 의미는 업데이트 후 검증 필요.

### 발행 확인 — 2026-10-04 15:53 KST

- HA main 및 v0.8.12-beta.3: 209ad96ed84197813790b2756fce0e5360309a80.
- Release: https://github.com/helico717/carrot-ha/releases/tag/v0.8.12-beta.3 (pre-release=true).
- HACS Release Actions 성공: https://github.com/helico717/carrot-ha/actions/runs/37183984702 . API published_at=2026-10-04T06:50:36Z (15:50:36 KST).
- Comma 원격: fe7f59539121abb6400b1823cdf7d271856aac2b. 원격 자동 동기화 e170586f 위로 이번 변경만 재적용했고 force push 없이 게시. 재적용 후 충전 관련 12개 테스트 통과.
- Worker incremental 검사/benchmark 통과. Worker/D1 변경·배포 없음. 실차 설치/수신 검증 및 운영 압축 실행은 수행하지 않음.

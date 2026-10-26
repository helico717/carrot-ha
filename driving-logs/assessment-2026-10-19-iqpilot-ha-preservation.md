# IQ 기반 이주 시 HA 기능 유지 가능성과 실질적 장점

2026-10-19 후속 분석. 사용자 요청은 가능성/장점 평가이며 구현·설치 요청이 아니다. IQ 기준은 공개busyfritz/openpilot4e4cbcb5. 본가 배포본 소스·실차 설정은 앞선 접근 제약으로 미확인. 현재 Carrot HA 장치 데몬/manager/HA 로그 API와 IQ 공개tree를 읽어 평가했다. 실행 코드·설정·기기 변경 없음.

## 결론

대부분의 HA 사용자 기능은 IQ 주행 코드와 독립된 수집/전송/관리 계층으로 유지할 수 있다. 무수정 IQ 설치만으로 유지되지는 않는다. 기능 동일성 검증을 거친 IQ+HA 전용 포크가 필요하며, 모든 기능이 이미 호환된다고 보장할 단계는 아니다. 특히 IQ에 없는 당근 주행 파라미터의 의미는 보존할 수 없고 IQ에 대응하는 설정으로 교체해야 한다.

## 기능별 의존성과 평가

| HA 기능 | 보존 가능성/작업 |
| --- | --- |
| 기존 HA 차계부·충전/주행 이력·영수증·정비 기록 | HA 서버 데이터는 유지 가능. 새 데이터는 동일 device identity와 이벤트/중복제거 규약 유지 필요 |
| 배터리·충전·위치·전비·주행 상태 | CAN 기반 디코더/engine 재사용 여지가 큼. cereal 메시지/Params import·bus 선택·수면/충전 모드와 manager 실행부 어댑터 필요 |
| 실시간 대시보드·HA 센서/자동화 | 기존 엔터티·device ID·API payload를 유지하면 재사용 가능. 이름이 같은 값이라도 의미/단위/측정시간을 확인해야 함 |
| 원격 터미널·Git 상태 | reverse WSS 재사용 가능. 상태검사/허용명령/브랜치 표시는 IQ용으로 수정. 당근 Git Pull/브랜치 버튼을 그대로 두면 안 됨 |
| 파라미터 조회/수정 | 가장 큰 의미적 차이. 현재 param_sync는 localhost7000 당근 settings/API param_set 및 검증/읽기복귀에 의존. IQ용 catalog·타입/범위/쓰기허용·readback/ACK 어댑터 필요. 사라진 당근 파라미터를 가짜로 유지하지 않음 |
| 주차 360 카메라 | renderer/WSS framing 재사용 가능. IQ camerad/encoderd 경로·메시지·리소스 관리와 offroad/onroad 전환을 실기 검증해야 함 |
| 로그 자동 전송·목록·영상 | HA 업로드/저장 프로토콜 유지 가능. logger 파일경로·압축·완료판정·ffmpeg 및 IQ uploader와 보관 경쟁 확인 필요 |
| 로그 리플레이/그래프 | 원본 업로드 성공과 별개로 스키마 호환 필요. 현재 parser가 당근 cereal에 의존하므로 IQ/Carrot 스키마별 디코더와 필드 어댑터가 필요. 기존 로그도 계속 해석해야 함 |

근거 파일: 당근 ha/collector.py는 carState/gps/peripheral/selfdrive/device 메시지를 구독, engine.py는 별도 계산/저장. ha/param_sync.py는 당근 API와 catalog를 사용. camera/compatibility.py는 camerad/encoderd 바이너리 및 cereal services에 의존. manager/process_config.py는 carrot_ha/camera 프로세스를 등록. HA driving_logs/http.py는 원본rlog·영상 응답을 제공하므로 단순 파일전송과 리플레이 의미 호환을 분리해야 한다.

## 권장 설계 경계

- IQ의 조향·롱컨 controlsd/model/carcontroller를 HA 때문에 바꿀 필요는 원칙적으로 없다. 읽기 전용 telemetry adapter와 독립 HA daemon을 붙이고 manager/process 등록·Params 선언·설정 어댑터만 필요한 범위에서 추가하는 형태다. 전체 파일을 손대지 않는다는 뜻은 아니다.
- HA 서버/기존 통신규약·device identity·기록ID/ACK·단위·측정시간을 유지하고 수집기 차이를 장치 측 adapter에 가둔다. 같은 규약이면 Worker 변경은 필수 아님. 이식이 끝나기 전 운영 무변경 보장은 하지 않는다.
- 새 카드마다 별도 cloud 질의를 만들지 않고 기존 shared HA coordinator/cache와 freshness 계약을 유지한다. 로그는 기존 HA 직접 업로드 경로를 유지한다.
- IQ private 모듈을 역공학하거나 IQ의 비공개 API 존재를 가정하지 않는다. 공개된 Params 선언만으로 실제 쓰기 정책이 검증됐다고 보지 않는다.
- 설정/토큰/데이터는 Git 밖 persistent 경로에 유지한다. 프로그램은 Git 커밋/푸시로만 배포한다. 기기 파일 SSH/SCP 패치 또는 사용자 대신 재부팅 없음.
- 이후 IQ 업데이트 때 manager/camera/schema/Params의 호환성 점검이 지속적으로 필요하다. 모든 변경을 IQ 본가가 받아줄 것이라는 가정 없음.

## 완료 판정에 필요한 단계

1. 실제 사용할 IQ 배포 커밋/라이선스·소스 접근을 확정하고 기능 목록과 카탈로그를 동결한다.
2. 동일 recorded CAN으로 기존/IQ adapter의 telemetry·충전·trip 계산을 비교한다. 읽기 재현은 실차 주행성능 검증이 아니다.
3. HA device/entity 연속성·원격명령 범위·설정 validation/readback/ACK·로그 IQ/기존 스키마를 검증한다.
4. 실제 기기의 주차 카메라와 주행전환 interlock, manager 충돌/메모리·CPU, 수면/충전·오프라인 복귀 및 backlog/보관 경쟁을 검증한다.
5. 그 뒤에야 사용자 기능 전체 유지 여부를 판정한다. 현재는 타당성 분석만 완료.

## IQ 최대 장점에 대한 평가

현재 근거로 가장 큰 매력은 'ID4가 더 급하게 돈다'가 아니라 VW/MEB용 차량 처리와 IQ의 선택형 주행 기능(차선/MPC·모델선택·내비/속도제한·차선변경·LongComfortMode)을 묶어 사용할 수 있는 다른 주행 플랫폼이라는 점이다. 이는 기능 구성상의 후보 장점이지 독점 기술 또는 실차 성능 우위의 확인이 아니다. 당근에도 모델선택/AOL/커브감속/차선변경이 있어 모두 새 이득으로 세면 과장이다.

사용자에게 더 가치 있는지 가르는 기준은 한국 지도/속도카메라·MEB 롱컨 승차감·같은 모델/속도에서의 회전 추종이다. 현재 공개 코드만으로 이 세 가지의 우위는 확인되지 않았다. private 모델관리/내비·서비스 가용성도 제약이다. busyfritz 안전 훅 검사 미차단은 이전 보고대로 별도 검토 대상이다.

HA 보존 비용을 치르며 이주할 결정적 이유가 현 단계에 입증됐다고 판단하지 않는다. 반대로 필요한 연결 계층을 이식하면 HA를 포기할 수밖에 없는 구조도 아니다. 동일 조건에서 IQ 주행상의 이득을 먼저 확인하고, 그 이득이 유지보수 비용보다 큰지 결정하는 것이 타당하다.

검증: 소스 의존성·프로세스 등록·프로토콜 경계 검토 완료. 미검증: 실제 이식·모든 기능 호환·실기/지역 서비스/주행 개선. 문서만 게시, 구현·설정·서버/Comma/Worker 배포 없음.

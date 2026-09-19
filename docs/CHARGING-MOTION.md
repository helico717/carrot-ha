# 키 ON 충전과 주행 구분

충전 검증 + 주차 60초 전송(6994617)을 기반으로 한다.

## 판단 기준

- 유효하고 2초 이내 수신된 carState의 canValid, gearShifter, vEgo를 사용한다.
- 속도 0.1 m/s 초과는 주행, 이하에서 P는 주차로 판단한다.
- D/R 및 주행 기어는 정차해도 주행 모드를 유지한다. N은 진행 중인 주행이 있을 때 유지한다.
- 키 ON이나 IsOnroad만으로 주행을 확정하지 않는다. 키 ON에서 차량 신호가 없거나 모호하면 driving=null이다.
- 신호가 없고 IsOnroad=false이면 기존 offroad 주차 판단을 유지한다.
- P 정지에서는 키 ON/OFF와 무관하게 기존 에너지 증가 검증을 수행한다. 충전 커넥터 직접 감지가 아닌 추정이다.
- 신호 단절은 에너지 비교 기준과 미확정 후보를 지운다. 진행 중인 기록은 partial로 표시하며 주행 시간의 공백을 누적하지 않는다.
- 주행 30초, 그 외 60초 전송. 주행 판정 변화 시 추가 전송한다.

## 전송 및 HA 호환

vehicle.driving은 true/false/null, vehicle.comma_onroad는 원래 IsOnroad다.
vehicle.gear와 vehicle.wheel_speed_mps를 함께 기록한다.
최상위 onroad는 driving=true일 때 1, 나머지는 0이며 ignition은 기존 IsOnroad 값이다.
HA는 driving 필드가 있으면 null도 보존하여 센서·그래프·표시에 사용한다.
이 필드가 없는 과거 기록은 기존 onroad 의미를 유지한다. 과거 기록을 재분류하지 않는다.

## 첨부 DB 확인 (읽기 전용)

- 01M23RJD5A9H29TRSYCXV4HJ80 (1).sqlite3: 상태 9,913건, 충전 22건, 주행 63건.
- 상태 중 onroad=1, charging=true 조합 10건. 기어와 차량 휠 속도는 저장되어 있지 않아 실제 충전 중 키 ON인지 확정할 수 없다.
- 01M20PX3RFCPQMVYWXQ6GCKZKX (1).sqlite3: 상태·충전·주행 각 2건. 상태에 onroad/charging/기어가 없어 해당 판단 검증에는 부족하다.
- 개인 위치, 장치 ID 및 DB 원본은 저장소에 복사하지 않았다.

## 적용 범위 및 실차 확인

이번 변경은 로컬 파일만 수정한다. 콤마 또는 HA에 자동 배포하지 않는다.
콤마에는 collector.py와 engine.py를 함께 적용해야 한다. HA에는 수정된 통합과 프런트엔드를 함께 적용하고 재시작·브라우저 새로고침이 필요하다.
Worker 코드나 DB 스키마 변경은 필요 없다.

실차에서 먼저 P 정지 시 gear=park, driving=false가 나오는지 확인한다.
현재 Carrotpilot 브랜치에서 carState가 제공되지 않거나 canValid가 거짓이면 키 ON 상태는 unknown이며 충전 추정을 보류한다.
P에서 키 ON 충전, 키 OFF 충전, D 신호대기, 실제 주행, 재부팅 후 상태를 확인한다.
충전 검증은 휴리스틱이므로 반복적인 BMS 재보정에 의한 오인식 가능성은 남는다.

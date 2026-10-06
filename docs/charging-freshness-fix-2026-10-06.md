# 충전 freshness 및 라이브 액티비티 수정 — 2026-10-06

## 원인과 범위

HA 로그북에서 10:30:01 충전 복구(측정10:28:46,75초 경과)→10:30:21 unknown(95초), 10:31:01 복구(측정10:29:46,75초)→10:31:22 모드·세션·ETA unknown(96초)을 확인했다. cloud ok와 원시 CAN 수신은 유지됐다. 연구 저장소의 [원시 분석](https://github.com/helico717/meb-can-research/blob/main/docs/charging-freshness-analysis-2026-10-06.md)에서 bus1 0xCF 359,525개 최대 간격은28.5ms였다.

로컬 Comma collector는 약30초 CAN sampling(4초 수집+26초 대기), offroad engine publication 최대60초, HA 정기 poll60초다. 각 단계의 위상이 어긋나면90초 freshness는 정상 측정에도 만료될 수 있다. 단순 cloud check 성공으로 CAN timestamp를 갱신하지 않는다. 이번에는 조회량을 늘리지 않고180초 lease와90초 지연 구분을 적용했다. 모든 네트워크 환경에서180초 안에 도착한다는 보장은 아니다.

## 제품 수정

- charging_mode의 실제/호환 요청 신호 lease180초.90초 초과는 delayed 및 measurement_age_s로 구분.
- actual_charge_power_w/hv_voltage 표시도 같은 실제 신호 lease 사용. 무효값·미수신·미래시각·bus충돌·같은 프레임 판정 유지. 새 CAN 종료/0전력은 즉시 반영.
- delayed 전력은 charge_power_raw_w 계산 입력에서 제외. ETA 모델을 지연만으로 reset/train하지 않고 마지막 추정을 기존 제한 안에서 유지. 이미 받은 에너지 측정을 정상 표시하는 것과 과거 전력으로 새 에너지를 적분하는 것을 구분.
- charging/mode/power/session/80·100 남은시간·완료시각에 freshness 진단 속성을 제공. 한글·영문 ETA 부가문구에 갱신 지연 및 측정 나이 표시.
- 엔터티 ID/단위, 최신 상태의 독립 경로, 요청량, Worker/D1, Comma 코드 유지.

## 사용자 자동화

사용자가 지정한 충전 라이브 액티비티 자동화를 HA 기본 편집기에서 수정·저장했다. 원본과 저장본은 개인 로컬 임시파일로 보존했으며 알림 대상/원문은 저장소에 커밋하지 않는다.

- 시작 알림에 남은 시간 추가. 기존 시작 메시지는 전력만 포함했다.
- SOC1% 증가 갱신에 더해 해당 목표 남은시간 unknown/unavailable→숫자 복구와5분 갱신 추가. 센서 매 측정마다 push하지 않는다.
- SOC80%미만은80%, 그 이상은100% 목표. 목표 변경 전 반올림하지 않는다.
- int(0)으로 unknown을0초로 오인하지 않고 계산 중으로 표시.
- 첫 줄 충전 종류·전력, 둘째 줄 목표SOC·남은시간으로 시작/갱신 메시지 통일. AC소수점1자리/DC정수 유지.5분 및 회복 갱신은 silent.
- unknown 충전 상태는 종료 조건에 넣지 않는다. 충전 종료 off는 이전상태가unknown이더라도 처리하도록 from on 제한 제거. 사용자가 기존에 설정한 unavailable/Comma 연결 종료 경로는 유지했다.
- HA 시작 트리거는 재시작 시 충전 중 알림 복구용이며 실제 charging on 조건을 유지한다.

저장본 YAML을 다시 읽고 Jinja2로 AC/DC/미확인/79.6%경계4가지 메시지의 정확한 두 줄 렌더링을 검증했다. 실제 실행추적의 추가 브라우저 접근은 허용되지 않아 확인하지 못했다. 수동 알림 테스트를 발송하지 않았고 iPhone 실화면 검증은 미완료다.

## 검증 및 배포

HA296tests(4skip) 통과, 충전 집중56tests 통과, 최신/lazy/view-state/전력JS12tests통과, 전체JS64중63통과. motion-status1실패는 변경전HEAD 파일로도 재현했다. Worker incremental 테스트·benchmark 및 Comma param polling4tests통과. 런타임 Python의 개별 charging_power 테스트는 package stub 없이 실행하면 aiohttp 의존성으로 import 실패하며, 기존 charging_smoothing package stub과 함께 또는 전체 discovery에서는 통과했다.

사용자 지시에 따라 자동화 수정 검증 전 발행을 보류했고, 이후 정식v0.8.12 발행을 요청받았다. 발행 결과는 실제 확인 후 아래에 기록한다. HA HACS설치·재시작은 사용자가 수행한다.

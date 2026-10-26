# busyfritz와 주행 당시 당근파일럿 ID.4 조향 비교

확인일: 2026-10-19. 비교는 사용자의 구간18/86에서 확인한 당근 구현과 지정한 저장소의 기본 브랜치 소스다. ajouatom 최신 전체 브랜치와의 비교가 아니다.

- busyfritz/openpilot: 기본 `release-new`, `4e4cbcb5c7deab0c5563b26e9a04b923dcb6613f`.
- helico717/openpilot: 주행기록 커밋 `5d69d6ae6904be65f00858a79bc861269291ce53`, `carrot-wip-model_selector-ha`. 로그 dirty=true로 미커밋 변경은 복원 불가. 앞선 원본 출력/CAN 대조 결과를 함께 사용한다.
- 공개 소스는 임시 sparse clone으로 읽었으며 실행/설치하지 않았다. 수치 비교는 독립적인 보간/단위 계산이다. 차량/파라미터/실행 코드 변경 없음.

## 비교 요약

| 항목 | 주행 당시 당근 | busyfritz release-new |
| --- | --- | --- |
| ID.4 제어 타입 | angle 열거값 | curvatureDEPRECATED 열거값 |
| 실제 EPS 명령 | HCA_03 곡률+Power | 동일 |
| Power 최대/최소/step | 50 / 4 / 2 | 90 / 4 / 2 |
| 운전자 토크에 따른 Power | abs(torque) | 부호 있는 torque 그대로 |
| 곡률 PID | MEB에서 항상 적용, controlsd 약100Hz | EnableCurvatureController 조건부, carcontroller 약50Hz |
| PID 등록 기본값 | MEB 강제 경로 | EnableCurvatureController 기본0(OFF), 실제 사용자 설정 미확인 |
| PID Kp/Ki BP(m/s) | [10,40] | 동일 |
| Kp 값 / Ki 값 / Kf | [0,1.45] / [0,.12] / 1 | 동일 |
| PID 내부 clamp | ±.2 | ±.195 |
| 최종 절대 곡률 제한 | ±.195 | 동일 |
| 차량단 횡가속도/jerk 제한 | 3.5886m/s² / 5m/s³ | 동일 |
| 상위 목표곡률 accel 제한 | 80km/h 이하4.5,120km/h 이상3.0へ 보간+roll | 전속도3.0+roll |
| 상위 목표곡률 절대 제한 | ±.2 | ±.4(최종 차량단은 .195) |
| angle 진단 경고 각도 차이 | 3° | 2.5° |
| steerLimited 판정(MEB) | 요청/출력 곡률 차이를 횡가속도로 환산, .1m/s² 초과 | angle 출력 차이 기반 |
| 차선 경로 선택 | UseLaneLineSpeed 기반 lateralPlan, 이번 기록OFF | IQLanePlanner 선택 가능, 등록 기본OFF |
| CP steerActuatorDelay | .3초 | .3초 |

## Power 차이와 부호 비대칭

관련: busyfritz `opendbc_repo/opendbc/car/volkswagen/values.py:138`, `carcontroller.py:276`, `mebcan.py:28`, `dbc/vw_meb.dbc:575`. 당근의 같은 opendbc 경로.

90 대50은 CAN Power 신호상의 실제 수치 차이다. 90이 실제 조향 토크/회전속도를1.8배로 만든다는 의미는 아니다. EPS의 내부 변환·제한과 차량 응답 측정이 필요하다.

양쪽 allowance=60, driver max=300이다. 램프가 안정됐다고 가정한 단순 보간에서 raw torque0은 당근50/busy90, +180은27/47, -180은27/90이다. busy는 음수 토크가 보간 하한에 걸려 Power가 감소하지 않는 좌우 비대칭이 있다. 이는 EPS 토크 부호와 절댓값 처리의 코드 차이이며 어느 방향이 더 안전하거나 우수하다는 판단이 아니다.

## 곡률 PID와 실측 보정

관련: busy `volkswagen/mebutils.py:254`, `carcontroller.py:249,279`, `common/params_keys.h:348`; 당근 `openpilot/selfdrive/controls/controlsd.py:77,229`, `openpilot/common/pid.py`, `volkswagen/values.py`.

양쪽 모두 차량모델 저속 피드백과 pose yaw/speed 고속 피드백을2–5m/s에서 혼합하며, EPS QFK_01 곡률과 차량모델 곡률의 차이를 명령에 보정한다. busy는 PID를 꺼도 EPS-VM 보정을 유지하므로 단순 raw 모델 passthrough라고 부르면 부정확하다.

PID ON일 때 기본 게인은 동일하다. 33km/h(9.17m/s)에서는 P/I 게인 모두0, 51km/h에서는 Kp≈.2014, Ki≈.01667이다. 따라서 구간86에서 busy의 기본 PID가 더 강해져 늦은 모델 요구를 해결한다고 설명할 수 없다. feedforward·EPS/VM 보정은 P/I=0에서도 남는다.

차이: 실행 위치/주기100 vs50Hz, override 적분 unwind 설정(당근 min_cmd=1e-10·ki_red_time=1·rate100, busy6.7e-6·2·rate50), 내부 clamp(.2 vs.195), 포화 판정 입력이 다르다. 동일 게인만으로 동일 폐루프 응답을 보장하지 않는다.

roll 처리도 완전 동일하지 않다. r=-VM.roll_compensation, k0=-VM.calc_curvature(angle,v,0)로 두면 busy 저속 actual_VM=k0+r, 당근 PID 내부 actual_VM=k0-r이다(각 소스와 동일 vehicle_model 수식 기준).5m/s 초과 pose 피드백에서는 이 저속 피드백 차이가 사라지지만 feedforward/roll 매핑 검토는 별개다. PID ON의 EPS 보정 기준은 양쪽 모두 k0에 해당한다. 이번 두 사건 속도는5m/s 초과이므로 저속 roll 부호 차이를 직접 원인으로 주장하지 않는다.

## 모델/경로와 지연

busy controlsd는 raw model action 또는 선택적인 IQ 차선/MPC 경로를 사용한다. IQLanePlanner 등록 기본값0이다. 유효한 lateralManeuverPlan 우선 분기도 있지만 생산 운행용 회전 계획기가 실제 켜져 있다는 증거로 간주하지 않는다(해당 메시지는 테스트 도구에서도 사용).

당근 MEB는 laneLines 사용 시 lag-adjusted lateralPlan을 사용하고 아니면 raw model action을 사용한다. 구간18/86은 laneLines=false로 후자다. busy의 옵션 유무만으로 더 이른 우회전을 계획한다고 단정할 수 없으며 동일 카메라 입력·모델 가중치·선택 설정이 확인돼야 한다.

상위 clip_curvature에서 당근의 저속 allowance가 더 크고 busy는3.0이다. 그러나 최종 carcontroller 상한은 양쪽3.5886이다. busy Power90을 근거로 곡률 한계 자체가 더 크다고 설명하면 틀린다. 두 코드의 CP 지연 기본값은.3초이며 당근의 SteerActuatorDelay 사용자 설정은 이번 raw 모델 경로에서 차선 경로용 지연 보정과 구분해야 한다.

## 안전 훅의 중요한 차이

busy `opendbc_repo/opendbc/safety/modes/volkswagen_meb.h:239–274`는 steer_power_cmd_checks와 steer_curvature_cmd_checks_average가 위반을 보고해도 tx=true를 대입한다. 해당 검사 결과로 송신이 거부되지 않는다. 종방향 검사에도 유사 TODO가 있으나 이번 분석의 주제는 횡제어다. 다른 송신 허용목록/수신검사 전체가 없다는 의미는 아니다.

또한 max_power=125는 원시 CAN 바이트인데 DBC Power scale=.4이므로50%다. Python Power90은 원시225가 된다. 따라서 소스 주석의 '125가 Python90보다 높다'는 설명은 단위가 맞지 않는다. 해당 훅이 차단을 비활성화한 현재 상태와 함께 해석해야 한다.

당근 당시 `opendbc_repo/opendbc/safety/safety/safety_volkswagen_meb.h:207–224`는 활성 요청의 절대 곡률 .195 위반을 tx=false로 차단한다. 다만 Power 검사는 없고 상시조향 때문에 controls_allowed와 독립적인 경로가 있어 stock과 완전히 동일한 안전 정책이라고 주장하지 않는다. 양쪽 실제 탑재 펌웨어의 동일성/테스트는 별도 미검증이다.

## 사건18/86에 대한 의미

- 구간18: Power50에서 실측 회전이 요구보다 부족했으므로 Power 정책은 추가 비교 가치가 있다. 그러나 곡률 제한 포화와 gas 속도 하한 문제가 남아 Power90만으로 통과를 예측할 수 없다. 상대 소스 안전 훅/부호 비대칭도 그대로 가져올 근거가 아니다.
- 구간86: 낮은 초기 모델 요구,30km/h 커브 하한 및 실제 추종 문제가 관측됐다. PID 기본 게인은33km/h에서양쪽0이고 차량단 한계도 같아, 다른 저장소로 바꾸면 조향 시점이 해결된다는 증거가 없다.
- 비교 대상 두 소스는 '한쪽은 angle, 한쪽은 torque'가 아니다. 둘 다 곡률 명령 기반이며 열거값 이름이 다르다.

검증 완료: 고정 SHA별 소스 대조, 최종 제한 수식/단위 검산, 동일 게인 저속 값과 signed/abs Power 보간 수치 비교. 미검증: busy 실차 설정·탑재 펌웨어·모델 선택/가중치·동일 코너 폐루프 통과·Power 변경 응답. 구현·파라미터·기기·Worker/D1 변경 없음.

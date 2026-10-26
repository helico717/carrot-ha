# infiniteCable2 원본과 주행 당시 당근 ID.4 조향 비교

확인일2026-10-19. 소스 비교이며 실차 성능 비교가 아니다. 원본·GPS·인증정보·모델 바이너리 공개 없음. 실행 코드/파라미터/기기 변경 없음.

## 포팅 출처 확인과 비교 범위

사용자 설명은 커밋 기록과 일치한다. 당근 최초 지원 커밋 `01bd6c1b7eb0576025a33dbca992a2ff41698d22`(2026-07-04, id4 support #427; 원본 f24623f3950f49aa289077baf38235be6c223542 cherry-pick)는 infiniteCable2(if2)의 MEB 구현을 기반으로 포팅했다고 명시한다. HCA_03 곡률+Power, QFK_01 곡률 피드백, MultiplicativeUnwindPID 게인과 VM/pose 피드백·EPS 정렬 보정이 설명돼 있다. 이는 포팅 근거를 확인한 것이며 현재 if2와 코드가 동일하다는 뜻은 아니다.

비교 고정점:
- 차량 당시 당근: helico717/openpilot `5d69d6ae6904be65f00858a79bc861269291ce53`. initData dirty=true로 미커밋 내용 복원 불가. 앞선 CAN 대조로 Power50 등은 교차 확인했다.
- infiniteCable2/openpilot 현재 기본 master: `2bea717d8567d840804f5bda053126a0397fa7a4`(2026-10-17).
- 원본이 실제 연결한 submodule infiniteCable2/opendbc: `4a3acff89c76e41b61562067edd197475c185f9c`(2026-10-07). 별도 opendbc HEAD가 아니라 이 SHA를 checkout해 읽었다.
- 원격 브랜치 목록은 현재 master만 확인됐다. 예전 id4-meb 브랜치 내용과 현재 master를 동일시하지 않는다. if2에 보존된 latcontrol_curvature_pid_backup.py는 모두 주석이며 실행 경로가 아니다.

## 핵심 비교

| 항목 | 당시 당근 | 현재 infiniteCable2 |
| --- | --- | --- |
| 실제 차량 명령 | HCA_03 곡률+Power | 동일 |
| 타입·제어기 | angle 열거값, MEB 전용 PID를 controlsd에 삽입 | native curvature 열거값, 전용 LatControlCurvature |
| Power max/min/step | 50/4/2 | 동일 |
| 운전자 토크 처리 | abs(torque), allowance60/max300 | 동일 |
| Kp BP/값 | [10,40]m/s / [0,1.45] | 동일 |
| Ki BP/값 / Kf | [10,40] / [0,.12] /1 | 동일 |
| PID 사용 | MEB 항상 적용 | EnableCurvatureController 기본1, 선택 가능 |
| 제어기 실행 주기 | 약100Hz | 약100Hz |
| PID 실제곡률 피드백 | VM 저속,5m/s 초과 calibrated pose yaw/v | VM(angle offset/steer ratio/stiffness/roll) 기반 |
| EPS-VM 보정 | PID 출력에 합산 | carcontroller에서 합산 |
| 약한 핸들 개입 처리 | 별도 slight 신호를 이 PID에 연결하지 않음 | .15Nm 초과 slight 신호,10초 적분 unwind |
| 강한 핸들 개입 | 기본1초 unwind, min_cmd1e-10 | 기본.1초 unwind, min_cmd1e-6 |
| 학습 곡률 보정 | 이 경로에 CurvatureD 없음 | CurvatureD 선택 기능, 등록 기본0 |
| 진단 | angleState, 각도차3° 기준 | curvatureState, 실제 곡률오차×속도²>.4m/s² 기준 |
| 최종 절대곡률 | .195 | 동일 |
| 최종 차량단 횡가속도 | 3.5886m/s² | 동일 |
| 최종 차량단 jerk | 5m/s³ | 3.5886m/s³ |
| 상위 clip_curvature accel | 저속4.5,고속3.0+roll | 3.0+roll |

## 같은 점: Power와 기본 곡률 PID

원본 values.py의 Power50은 당근과 같다. busyfritz의90과 혼동하면 안 된다. 현재 원본은 abs(steeringTorque)를 사용하며 당근과 같이 좌우 대칭이다. Power·기본 게인 차이로 원본의 우위를 설명할 근거가 없다.

양쪽 게인에서 약36km/h 미만은 P/I=0이다. 구간86의 약33km/h에서 기본 P/I가 더 강해지는 원본은 아니다. 다만 feedforward와 EPS-VM 보정은 양쪽 남는다. CurvatureD를 켠 원본이라면 학습 보정이 추가될 수 있으나 실제 설정·학습 유효성이 있어야 하며 기본OFF다.

## 달라진 점: 피드백·롤 보정의 위치

당근은 포팅 당시의 VM+pose 블렌딩과 EPS 정렬 구조를 유지한다. 현재 if2의 실제 latcontrol_curvature.py는 VM 기반 실제곡률을 사용한다. 함수 인자로 calibrated_pose를 받지만 이 계산에 사용하지 않는다. 백업 파일의 예전 pose 블렌딩 코드를 현재 실행 코드로 오인하지 않는다.

현재 if2 출력은 대략 `PID(desired - actual_VM, FF=desired) - roll_compensation + CurvatureD`; 이후 carcontroller에서 `EPS - CC.currentCurvature + roll_compensation`을 더한다. FORD_CAR 특례는 ID4 비교에서 제외한다. 당근은 `PID(desired - actual_VM_or_pose, FF=desired-roll_compensation) + EPS - VM_no_roll`이다. 모두 EPS/VM 차이를 보정하지만 PID가 보는 error와 roll 항의 적용 위치가 같지 않다. 같은 게인이라도 실제 응답은 달라질 수 있다.

당근의 수동/학습 steer ratio와 stiffness 처리도 VM에 영향을 주므로 원본 설정과 일치하는지 확인 없이 한쪽 피드백이 정확하다고 결론내릴 수 없다.

## 약한 개입 및 진단

원본의 CarStateIC.steeringSlightlyPressed는 abs(torque)>15(raw 약.15Nm). full steeringPressed가 아니어도 해당 신호로 적분을10초 시간척도로 풀 수 있다. full override는 기본.1초다. 당근 포팅은 full steeringPressed를 사용하고 기본1초 unwind를 사용한다. 적용 시점/임계값/적분상태에 따른 효과를 재현해야 하며 이를 단순히 원본이 빠르다고 해석하지 않는다.

전용 curvatureState는 desired/actual/output/error/P/I/F를 기록한다. 당근은 MEB PID 출력과 별도로 angle 진단을 기록하므로 상태 로그만 보고 실제 명령을 혼동하기 쉽다. 구간18/86에서 실제 CAN과 carOutput을 대조한 이유이기도 하다. 원본의 steerLimited 판정 주변에는 여전히 angle/torque 일반 분기가 있으므로 전체 진단 완전성을 보장한다는 의미는 아니다.

## 제한과 안전 계층

현재 if2 opendbc CurvatureSteeringLimits는 max lateral jerk를3+9.81*.06=3.5886으로 둔다. 당근은5다. 즉 원본이 단순히 더 빠르게 곡률을 바꾸도록 열어 놓은 형태는 아니다. 원본은 accel clip 후jerk, 당근은jerk 후accel 순서이며 급속한 속도변화/경계조건에서 차이가 생길 수 있다.

원본 MEB safety는 .195 곡률, raw Power125(0.4 스케일로50%),50Hz 등을 입력으로 steer_curvature_cmd_checks를 수행하고 위반 시tx=false다. busyfritz에서 확인한 해당 검사결과 차단 비활성화와 다르다. 당근 당시 MEB 훅은 활성 명령의 절대곡률 위반을 차단하지만 이 소스 경로에 Power 검사는 없고 상시조향을 위해 controls_allowed와 분리돼 있다. 실제 탑재 펌웨어의 일치 여부는 미검증이다.

## 구간18/86에 대한 판단

- 당근의 Power50 자체가 원본보다 낮아진 값이라는 설명은 맞지 않는다. 현재 if2도50이다.
- 구간18 gas 속도 하한과 구간86 커브 최소속도30은 당근 종방향 목표 설정 경로다. 원본 곡률 PID와 동일하게 만든다고 자동 해결되지 않는다.
- 원본의 피드백 변경/CurvatureD/약한 개입 처리에는 비교 가치가 있으나 선택 기능을 실제 활성화했다는 가정이나 폐루프 통과 주장은 불가.
- 모델 raw desiredCurvature를 쓰는 기본 경로는 원본에도 있다. 해당 저장소로 바꾸면 급우회전을 미리 예측한다고 주장할 근거 없음.
- 포팅은 원본 기반이 맞으며, 현재 시점에는 공통 기반 위에 서로 다른 업데이트가 쌓인 상태다. 이식 누락/회귀인지 의도된 차이인지 판단하려면 같은 입력·차량 파라미터에서 후보별 출력과 시간 응답을 먼저 검증해야 한다.

검증 완료: 포팅 커밋 메시지, 원본/submodule 고정 SHA, 실제 import·활성 경로·등록 기본값·Power/게인/제한 수식 대조. 미검증: 실제 원본 차량설정·학습 상태·모델 가중치·동일 코너 폐루프 성능. 실행 코드·설정·기기·Worker/D1 변경 없음. 문서만 게시.

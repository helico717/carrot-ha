# 러브레이스 디버그 대시보드 다시 추가하기

카드를 러브레이스에서 제거해도 통합이나 프론트엔드 리소스를 다시 설치할 필요는 없습니다.
기존 차량 대시보드와 별도의 테스트 뷰에 추가하면 가상 상태를 안전하게 비교할 수 있습니다.

1. HA에서 원하는 대시보드를 열고 우측 상단 **편집**을 누릅니다.
2. 필요하면 **뷰 추가**로 `디버그` 뷰를 만듭니다. 화면이 넓은 뷰가 편합니다.
3. **카드 추가 → 수동**을 선택하고 다음 YAML을 붙여 넣습니다.
4. 저장한 뒤 **완료**를 누릅니다.

```yaml
type: custom:carrot-dashboard-debug-card
vehicle_name: ID.4 PRO
vehicle_image_layout: legacy_id4
vehicle_3d_model: /carrot_ha_models/vehicle.glb
```

`vehicle_name`은 표시 이름입니다. 기존 운영 카드에 `vehicle_image` 옵션이 있다면 같은 값을
추가하면 모델이 없을 때 같은 차량 이미지가 보입니다. 모델은 사용자가 준비한 파일이며
`/config/carrot_ha/models/vehicle.glb`에 있어야 합니다. 모델이 없어도 디버그 카드는 동작합니다.

## 카드를 찾을 수 없다고 표시되는 경우

- 먼저 브라우저를 강력 새로고침합니다(Mac: Cmd+Shift+R, Windows: Ctrl+F5).
- HA **설정 → 대시보드 → 리소스**에서 Carrot HA 리소스가 있는지 확인합니다.
  리소스 메뉴가 안 보이면 사용자 프로필의 고급 모드를 켭니다.
- 기존 `/carrot_ha_static/carrot-dashboard.js` 리소스가 있으면 중복 추가하지 않습니다.
  주소에 버전 쿼리가 붙어 있어도 기존 항목을 유지합니다.
- 리소스가 완전히 없다면 아래 항목을 추가하고 페이지를 새로고침합니다.

```yaml
url: /carrot_ha_static/carrot-dashboard.js
type: module
```

카드의 실제 등록 이름은 `carrot-dashboard-debug-card`입니다.
`carrot-dashboard-debug`, `carrot-debug-dashboard`도 호환 이름으로 등록돼 있습니다.
직접 `carrot-dashboard-debug.js`를 리소스로 등록하는 대신 위의 공통 진입점을 사용합니다.

## 3D 시나리오 도구

디버그 카드의
**3D 차량 시뮬레이터 → 전체 순회 재생**에서 단계별 기대/실제 시점과 통과·실패를 확인합니다.
검증 중 차량이 보이도록 화면이 이동합니다. 자동 재생은 **중지**로 멈출 수 있습니다.
개별 문 버튼과 기존 주행/주차/충전 버튼, 화면 아래의 테마·언어 버튼으로 수동 조작합니다.
3D 시점 검증은 모델/WebGL이 필요하며, 모델 없음/3D 끔 시나리오는 이미지 폴백을 확인합니다.

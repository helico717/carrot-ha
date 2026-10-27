# CarrotPilot 설정 확인·변경

연결 경로·주소·인증·장애 범위: [현재 연결 구조](CURRENT_CONNECTION_ARCHITECTURE.md).


[자체 수신기 설치](CLEAN_INSTALL_RECOVERY.md)를 완료하고 Comma에 해당 HA 브랜치를 설치합니다.
파라미터 목록과 값은 집 서버 수신 앱을 거쳐 HA로 들어옵니다. Cloudflare 설치가 필요하지 않습니다.
명령은 수신 앱에 보관되며 Comma가 로컬 검증·적용·실제 값 확인 후 결과를 돌려줍니다.
요청했다는 이유만으로 적용 성공을 표시하지 않습니다. 통신 장애 중에는 처리를 기다립니다.

대시보드 리소스 `/carrot_ha_static/carrot-dashboard.js`를 JavaScript 모듈로 등록합니다.

```yaml
type: custom:carrot-params-card
device_id: YOUR_EXISTING_DEVICE_ID
```

대기 중 확인 주기는 15초, 편집/처리 중은 3초이며 실패 시 간격을 늘립니다.
기존 검증·범위·중복 방지와 주차/주행 안전 정책을 유지합니다.
코드나 Params 파일을 수동 편집하여 검증을 우회하지 않습니다.
자세한 현재 동작은 실행 코드와 [기존 설계 기록](PARAMETERS_0_6_1.md)을 참고합니다.

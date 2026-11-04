# 화면 설정 (모드 · 포인트 색 · 통일 팝업)

차량 대시보드(ko/en)와 차계부가 같은 모듈 `custom_components/carrot_ha/frontend/carrot-ui-theme.js`로 화면 설정을 처리한다.
프리뷰(승인 시연)는 `preview/theme-style/index.html`, 운영 코드 확인용 하네스는 `preview/theme-style/production.html`
(`python3 -m http.server 8769` 후 `http://localhost:8769/preview/theme-style/…`).

## 동작

| 항목 | 내용 |
|---|---|
| 모드 | **기본값**: Home Assistant 테마를 그대로 따른다(HA의 라이트/다크 포함). **라이트 / 다크**: 기존 Carrot 라이트·다크를 그대로 쓴다. 차계부도 라이트 고정을 지원한다(Carrot 라이트 팔레트, 히어로 카드는 어두운 포인트 색 면 유지). HA 사이드바 패널(`carrot-journal-panel`)의 바깥 틀(배경·머리글)도 같은 모드를 따른다. |
| 포인트 색 | 모드와 무관하게 바꿀 수 있다: 기본 파랑 / Home Assistant 색(HA의 `--primary-color`) / 주황·보라·민트 / 직접 선택. |
| 내 차 색상 | 대시보드 설정창에 있다(기존 3D 차량 색 기능 `setVehicleColor`). 3D를 끈 카드에는 나타나지 않는다. |
| 카드 곡률 | 어떤 모드에서도 HA 곡률로 바꾸지 않고 기존 값을 쓴다. |
| 팝업 | 설정, 차계부 기록 입력, 충전 금액 직접 입력·삭제 확인이 같은 스킨(면·테두리·모서리 18px·배경막·버튼 모양)을 쓴다. 차계부 설정은 **기존 설정 대화상자에 “화면” 항목을 추가**하는 방식이고, 대시보드 설정창은 같은 CSS를 쓴다. |

저장 위치(브라우저 localStorage): 모드는 기존 키 `carrot-theme-<device_id>`(대시보드), 차계부 모드와 포인트 색은 `carrot-ui-settings`.

## 포인트 색 변환 원리

대시보드의 파랑 계열 전체(약 70가지 색조)를 OKLCH에서 **색상·선명도만** 포인트 색으로 바꾸고, **WCAG 상대휘도와 투명도는 그대로** 둔다.
따라서 글자·배경 대비가 원래와 같고, 사용자는 밝기를 고를 수 없다. 의미가 있는 색(충전 중 초록, 낮음 노랑, 위험 빨강,
차계부 `--cat-*` 카테고리 팔레트, 기록 유형 아이콘 `.type-icon-box`/`tint-*`, 추세 카드)은 바꾸지 않는다.
차계부에서는 대표 민트 계열도 포인트 색으로 바뀐다. 변환은 카드 shadow DOM의 `<style>`과 인라인 색에 적용하며 원본을 보존한다(기본 파랑으로 돌아가면 원복).

## 비상 끄기(재배포 없이)

문제가 생기면 해당 브라우저에서 아래 중 하나로 모듈을 끈다. 카드는 변경 전과 같은 동작(기존 테마 선택·차량 색 컨트롤 포함)으로 돌아간다.

- 주소 끝에 `?carrot_ui=off`
- 브라우저 콘솔: `localStorage.setItem('carrot-ui-disable','1'); location.reload()` (되돌리기: `localStorage.removeItem('carrot-ui-disable')`)

## 롤백(코드)

HA 직접 반영 전 백업은 `/homeassistant/carrot_ha/deployment-backups/ui-theme-<sha>/before` 에 있고 같은 폴더의 `rollback.sh` 가
백업 파일을 복원하고 새 파일(`carrot-ui-theme.js`)을 제거한다. Git 쪽은 해당 커밋을 `git revert` 한다.
프런트 버전 해시가 파일 내용으로 계산되므로 롤백 후 HA 재시작은 필요 없고 브라우저 새로고침만 하면 된다.

## 알려진 한계

- 차계부 라이트(고정 및 HA 라이트 따라가기)는 이번에 새로 만든 팔레트라 차트·지도 등 일부 영역의 대비는 실제 화면에서 더 다듬어야 할 수 있다.
- 반투명(유리) HA 테마는 보조 글자색이 옅어 테마 자체의 대비를 그대로 물려받는다.
- 기존 결함: Carrot 라이트에서 선택되지 않은 날짜 라벨이 연회색이라 안 보였던 문제는 이 모듈이 함께 고친다.
- 카메라 모달은 통일 대상에 포함하지 않았다.
- 실제 HA 화면(실제 테마·실기기)에서의 확인은 사용자 확인이 필요하다.

# 검토용 차량 이미지

`id4-hero.png`는 사용자가 제공한 ID.4 사진을 built-in image_gen으로 배경 제거한
검토용 파생 이미지다. 원본 Downloads 사진과 기존 vehicle_id4_transparent.png는 유지한다.
1536 × 1024 RGBA 캔버스에 차량 전체를 담고 유리창과 실내 표현을 보존했다.
실제 차량 신호·HA API·운영 브랜드 자산과 무관하다.

## 편집 요청

1. 원본: `/Users/davidlim/Downloads/Firefly_RemoveBackground.png`.
   배경 제거, 전체 차량·휠·범퍼·유리창 보존, 투명 캔버스와 안전 여백 요청.
2. 첫 결과의 외곽 배경을 정리하는 추가 편집 후 `id4-hero.png`로 보관했다.

최종 built-in 편집 프롬프트:

```text
Edit ONLY the transparency mask of this grey Volkswagen ID.4 cutout.
Keep the visible car exactly unchanged including opaque glass and cabin,
wheels, logos and edges. Remove ALL of the large grey/white smoky halo and
all soft background haze outside the actual vehicle silhouette: those
areas must have alpha ZERO. No halo, no glow, no gradients outside the car,
no studio background, no floor, no contact shadow at all. The only
nontransparent pixels must be the car itself with clean antialiased edges.
Keep entire vehicle, all tires, bumper and mirrors, centered on the same
1536x1024 transparent canvas. No new elements.
```

배치는 review_journal_spending.html의 `.hero-artboard`에서 `object-fit: contain`으로
규격화한다. 이미지를 100%보다 크게 확대하거나 음수 right로 밀어 차체를 자르지 않는다.
문장과 이미지는 같은 `.hero-scene`에 있고 큰 헤드라인의 마지막 줄 아래쪽과 차량 지붕이 조금 겹친다. 작은 설명은 삭제했다.
320px 카드의 지표는 두 열로 바꾸고 숫자·단위의 글자 중간 줄바꿈을 막는다.

## 확인

```bash
NODE_PATH=<playwright 설치 경로> node vehicle-journal/tests/review-hero.cjs
```

분리된 브라우저에서 320~1920px, 모바일·큰 모바일·데스크톱, 일·월·연도 21개 조합을
검사한다. 이미지 전체 경계, 텍스트 경계, 실제 알파가 있는 차체와 큰 헤드라인의 겹침,
지표 단위의 한 줄 유지와 인접 열 침범, JS 오류를 확인한다.
스크린샷은 Git에서 제외된 `.preview/journal/hero/`에 저장하며 육안 검토도 필요하다.

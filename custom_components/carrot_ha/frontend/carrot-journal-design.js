// Approved prototype styles adapted for a live HA shadow root.
export const journalDesign = `:host {
      color-scheme: dark;
      --j-bg: #0b1014;
      --j-surface: #161e25;
      --j-raised: #202c36;
      --j-border: #2a3945;
      --j-ink: #f1f6fa;
      --j-sub: #a8bdca;
      --j-accent: #81e6c5;
      --j-blue: #7bb6ff;
      --j-red: #ff5c5c;
      --j-red-bg: rgba(255, 92, 92, 0.15);
      --j-blue-bg: rgba(123, 182, 255, 0.15);

      /* 카테고리 고유 색상 팔레트 (5대 핵심 분류 확정) */
      --cat-charging: #81e6c5;     /* 충전비: Carrot 민트 그린 */
      --cat-maintenance: #f59e0b;  /* 정비/소모품비: 앰버 오렌지 */
      --cat-washing: #60a5fa;      /* 세차비: 산뜻한 스카이 블루 */
      --cat-tuning: #c084fc;       /* 튜닝: 스타일리시 퍼플 */
      --cat-other: #94a3b8;        /* 기타: 뉴트럴 슬레이트 그레이 */
    }
:host{display:block;color:var(--j-ink);font:15px/1.65 system-ui,-apple-system,sans-serif;word-break:keep-all;overflow-wrap:break-word}
    /* 차계부 본체 레이아웃 */
    .shell {
      background: var(--j-bg);
      border-radius: 24px;
      padding: 24px 16px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }
    @media(max-width:600px){
      .shell{
        padding: 10px 8px 32px;
        border-radius: 0;
      }
    }

    /* 상단 마스트헤드 및 기간 단위 선택기(일/월/년) */
    .mast {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .mast-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .brand {
      color: var(--j-sub);
      font-size: 12.5px;
      letter-spacing: 2px;
      font-weight: 600;
    }
    .title-controls-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .title-controls-row h2 {
      font-size: 25.5px;
      margin: 0;
      white-space: nowrap;
      letter-spacing: -0.5px;
    }
    .select-pill, .date-pill {
      background: var(--j-surface);
      border: 1px solid var(--j-border);
      border-radius: 10px;
      padding: 7px 11px;
      font-size: 14.5px;
      color: var(--j-ink);
      cursor: pointer;
      outline: none;
      transition: all 0.2s ease;
    }
    .select-pill:hover, .date-pill:hover,
    .select-pill:focus, .date-pill:focus {
      border-color: var(--j-accent);
    }

    /* 우측 버튼 및 기간 선택기 그룹 */
    .mast-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* 일별/월별/연도별 선택기 */
    .period-segmented {
      display: inline-flex;
      background: var(--j-surface);
      border: 1px solid var(--j-border);
      border-radius: 12px;
      padding: 3px;
      gap: 3px;
    }
    .period-tab-btn {
      background: transparent;
      border: 0;
      color: var(--j-sub);
      font-size: 14.5px;
      font-weight: 600;
      padding: 6px 14px;
      min-height: 36px;
      border-radius: 9px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .period-tab-btn:hover {
      color: var(--j-ink);
    }
    .period-tab-btn.active {
      background: var(--j-raised);
      color: var(--j-ink);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-weight: 750;
    }

    /* + 기록 남기기 버튼 (통일된 당근 민트 액센트) */
    .btn-record-primary {
      background: var(--j-accent);
      color: #07221b;
      border: 0;
      font-size: 16px;
      font-weight: 750;
      padding: 10px 20px;
      min-height: 42px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 4px 14px rgba(129, 230, 197, 0.25);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .btn-record-primary:hover {
      filter: brightness(1.1);
      box-shadow: 0 6px 18px rgba(129, 230, 197, 0.38);
      transform: translateY(-1px);
    }
    .btn-record-primary:active {
      transform: translateY(1px);
    }

    /* 최근 기록 카드의 + 기록 버튼: 상단과 동일한 스타일 유지 */
    .btn-recent-record {
      background: var(--j-accent);
      color: #07221b;
      border: 0;
      font-size: 14px;
      font-weight: 750;
      padding: 6px 13px;
      min-height: 32px;
      border-radius: 9px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(129, 230, 197, 0.28);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .btn-recent-record:hover {
      filter: brightness(1.12);
      box-shadow: 0 4px 14px rgba(129, 230, 197, 0.45);
      transform: translateY(-1px);
    }
    @media(max-width:600px){
      .mast {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        margin-bottom: 14px;
      }
      .title-controls-row {
        gap: 8px;
        flex-wrap: wrap;
        width: 100%;
      }
      .title-controls-row h2 {
        font-size: 21.5px;
        flex-shrink: 0;
      }
      .title-controls-row .select-pill {
        flex: 1;
        min-width: 120px;
        max-width: 100%;
      }
      .select-pill, .date-pill {
        font-size: 13.5px;
        padding: 6px 8px;
        min-width: 0;
      }
      .mast-right {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      }
      .period-segmented {
        width: 100%;
        display: flex;
      }
      .period-tab-btn {
        flex: 1;
        padding: 6px 0;
        font-size: 14px;
        text-align: center;
      }
      .btn-record-primary {
        width: 100%;
        min-height: 44px;
        font-size: 16px;
        border-radius: 12px;
      }
    }

    /* 탭 네비게이션: 4개 탭 균등 분할 및 모바일 최적화 */
    .tabs {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      background: var(--j-surface);
      padding: 5px;
      gap: 4px;
      border-radius: 14px;
      margin: 16px 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs::-webkit-scrollbar { display: none; }
    .tabs button {
      flex: 1 1 0px;
      min-width: 0;
      background: transparent;
      color: var(--j-sub);
      border: 0;
      white-space: nowrap;
      min-height: 38px;
      font-size: 14.5px;
      padding: 6px 8px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .tabs button[aria-selected="true"] {
      background: var(--j-raised);
      color: var(--j-ink);
      font-weight: 700;
    }
    @media(max-width:600px){
      .tabs {
        overflow-x: hidden;
        padding: 4px;
        gap: 4px;
        margin: 14px 0;
      }
      .tabs button {
        flex: 1 1 0px;
        min-width: 0;
        font-size: 14px;
        padding: 8px 2px;
      }
    }

    /* 그리드 시스템 */
    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 18px;
    }
    .panel {
      background: var(--j-surface);
      border: 1px solid var(--j-border);
      border-radius: 22px;
      padding: 22px;
      min-width: 0;
      position: relative;
    }
    .wide { grid-column: span 8; }
    .narrow { grid-column: span 4; }
    .half { grid-column: span 6; }
    .full { grid-column: span 12; }
    @media(max-width:600px){
      .grid {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .panel {
        padding: 16px 12px;
        border-radius: 16px;
      }
    }

    /* [영웅 카드: 큼직하고 웅장한 타이포그래피 + 클린 그라디언트] */
    .hero {
      position: relative;
      border-radius: 28px;
      padding: 26px 28px 22px 28px;
      background: linear-gradient(130deg, #183b37 0%, var(--j-surface) 100%);
      border: 1px solid var(--j-border);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    @media(max-width:600px){
      .hero {
        padding: 20px 14px 22px;
        border-radius: 18px;
      }
    }
    .kicker {
      font-size: 12.5px;
      letter-spacing: 2px;
      color: var(--j-sub);
      margin-bottom: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(34px, 4vw, 44px);
      line-height: 1.25;
      letter-spacing: -1px;
      margin: 0;
      font-weight: 850;
      color: #ffffff;
      word-break: keep-all;
    }
    @media(max-width:600px){
      h1 {
        font-size: 34px;
        line-height: 1.26;
        letter-spacing: -0.8px;
        font-weight: 850;
        word-break: keep-all;
      }
    }
    .h-phrase {
      display: inline-block;
      white-space: nowrap;
    }
    h2 { font-size: 20px; margin: 0; }
    .accent { color: var(--j-accent); }
    .muted { color: var(--j-sub); }
    .note { font-size: 14px; margin-top: 12px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin: 16px 0 14px 0;
    }
    @media(max-width:600px){
      .stats {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 12px 0 8px;
      }
    }
    .stat {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .stat small {
      display: flex;
      align-items: flex-end;
      min-height: 28px;
      color: var(--j-sub);
      font-size: 13px;
      line-height: 1.3;
      margin-bottom: 4px;
      letter-spacing: -0.3px;
      word-break: keep-all;
    }
    @media(max-width:600px){
      .stat small {
        font-size: 12.5px;
        letter-spacing: -0.5px;
        min-height: 26px;
      }
    }
    .stat strong {
      display: block;
      font-size: 22.5px;
      font-variant-numeric: tabular-nums;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.15;
    }
    @media(max-width:600px){
      .stat strong {
        font-size: 19.5px;
        letter-spacing: -0.5px;
      }
    }
    .stat-unit {
      font-size: 14px;
      font-weight: 600;
      color: var(--j-sub);
      margin-left: 2px;
      letter-spacing: normal;
    }
    @media(max-width:600px){
      .stat-unit {
        font-size: 13px;
        margin-left: 1.5px;
      }
    }
    .stat-empty {
      font-size: 16.5px;
      font-weight: 600;
      color: var(--j-sub);
      letter-spacing: -0.3px;
    }
    @media(max-width:600px){
      .stat-empty {
        font-size: 15.5px;
      }
    }

    /* 영웅 카드 하단 액션 버튼 영역 (텍스트 시작선 완벽 일치 & 모바일 상하 여백 최적화) */
    .hero-btn-wrap {
      margin-top: auto;
      padding-top: 22px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      width: 100%;
    }
    @media(max-width:600px){
      .hero-btn-wrap {
        margin-top: 14px;
        padding-top: 18px;
      }
    }
    .btn-hero-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(32, 44, 54, 0.75);
      border: 1px solid var(--j-border);
      border-radius: 11px;
      color: var(--j-ink);
      font-size: 14.5px;
      font-weight: 600;
      padding: 8px 14px;
      min-height: 36px;
      cursor: pointer;
      margin: 0;
      box-sizing: border-box;
      transition: all 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-hero-action:hover {
      background: var(--j-raised);
      border-color: var(--j-accent);
      color: #ffffff;
      transform: translateY(-1px);
    }
    .btn-hero-action:active {
      transform: translateY(1px);
    }

    /* 전월/전일/전년 대비 지출 비교 카드 */
    .comparison-panel {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: border-color 0.3s ease;
    }
    .comparison-panel.is-more {
      border-color: rgba(239, 68, 68, 0.4);
    }
    .comparison-panel.is-less {
      border-color: rgba(96, 165, 250, 0.4);
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .card-header-row h2 {
      font-size: 17.5px;
      margin: 0;
    }

    .spend-headline {
      margin-top: 2px;
      margin-bottom: 10px;
      min-height: 0;
    }
    .spend-context {
      font-size: 13.5px;
      color: var(--j-sub);
      margin-bottom: 3px;
    }
    .spend-statement {
      font-size: 17.5px;
      font-weight: 600;
      line-height: 1.45;
      letter-spacing: -0.4px;
      color: var(--j-ink);
      word-break: keep-all;
    }
    @media(max-width:600px){
      .spend-statement {
        font-size: 16.5px;
      }
    }
    .domain-tag {
      display: inline-block;
      color: var(--j-accent);
      font-weight: 700;
    }
    .amount-highlight {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .trend-text-more {
      color: #ff5c5c;
      font-weight: 700;
      background: var(--j-red-bg);
      padding: 1px 6px;
      border-radius: 6px;
    }
    .trend-text-less {
      color: #7bb6ff;
      font-weight: 700;
      background: var(--j-blue-bg);
      padding: 1px 6px;
      border-radius: 6px;
    }

    .trend-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.2px;
      line-height: 1.3;
    }
    .trend-badge.more {
      background: rgba(239, 68, 68, 0.2);
      color: #ff7878;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .trend-badge.less {
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.4);
    }

    /* 바 그래프 컨테이너 & 툴팁 */
    .chart-container {
      position: relative;
      background: rgba(11, 16, 20, 0.6);
      border: 1px solid rgba(42, 57, 69, 0.7);
      border-radius: 16px;
      padding: 10px 12px 8px;
      margin-top: auto;
    }
    .bar-chart-svg {
      width: 100%;
      height: 175px;
      display: block;
      overflow: visible;
    }

    .bar-segment {
      cursor: pointer;
      transition: opacity 0.2s ease, filter 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .bar-segment:hover {
      filter: brightness(1.28);
    }
    .is-hovering .bar-segment {
      opacity: 0.35;
    }
    .is-hovering .bar-segment.highlighted {
      opacity: 1;
      filter: brightness(1.25);
    }

    .chart-tooltip {
      position: absolute;
      background: rgba(22, 30, 37, 0.98);
      border: 1px solid #3b5062;
      border-radius: 10px;
      padding: 6px 11px;
      font-size: 13.5px;
      color: var(--j-ink);
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      z-index: 20;
      white-space: nowrap;
      transition: opacity 0.15s ease, transform 0.15s ease;
      opacity: 0;
      transform: translate(-50%, -100%);
    }
    .chart-tooltip.visible {
      opacity: 1;
    }
    .tooltip-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 5px;
      vertical-align: middle;
    }

    .legend-row {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 8px;
      justify-content: center;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(42, 57, 69, 0.4);
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4.5px;
      font-size: 13px;
      color: var(--j-sub);
      cursor: pointer;
      padding: 3px 6px;
      border-radius: 6px;
      transition: all 0.15s ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .legend-item:hover, .legend-item.active {
      color: var(--j-ink);
      background: var(--j-raised);
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    /* ======================================================== */
    /* [사용자 요청] 어디에 썼을까요? 카드 크기 고정 & 글자 시인성 강화 */
    /* ======================================================== */
    .donut-panel {
      height: 350px;
      display: flex;
      flex-direction: column;
    }
    @media(max-width:600px){
      .donut-panel {
        height: auto;
        min-height: 215px;
      }
    }
    .cost-layout {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 22px;
      margin-top: 6px;
      min-height: 0;
    }
    .donut {
      width: 146px;
      height: 146px;
      flex-shrink: 0;
    }
    @media(max-width:600px){
      .donut {
        width: 132px;
        height: 132px;
      }
    }
    .cost-list {
      flex: 1;
      min-width: 140px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
    }
    .cost-list .list-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--j-border);
      font-size: 16.5px;
    }
    .cost-list .list-row:last-child,
    .cost-list .list-row.cost-row-last,
    .cost-list .list-row:has(+ .cost-total-row) {
      border-bottom: 0 !important;
    }
    .cost-cat-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .cost-cat-name {
      display: inline-flex;
      align-items: center;
      font-size: 15px;
      font-weight: 600;
      color: var(--j-ink);
    }
    .cost-dot {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      margin-right: 9px;
      flex-shrink: 0;
    }
    .cost-cat-count {
      font-size: 12px;
      color: var(--j-sub);
      font-weight: 500;
      padding-left: 18px;
    }
    .cost-amount {
      font-size: 16px;
      font-weight: 750;
      font-variant-numeric: tabular-nums;
      color: #ffffff;
      white-space: nowrap;
    }
    .cost-list .list-row.cost-total-row {
      margin-top: 8px;
      padding-top: 14px !important;
      padding-bottom: 4px !important;
      border-top: 2px solid rgba(255, 255, 255, 0.28) !important;
      border-bottom: 0 !important;
    }
    .cost-total-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--j-ink);
      padding-left: 18px;
    }
    .cost-total-amount {
      font-size: 16.5px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: #ffffff;
      white-space: nowrap;
    }
    @media(max-width:600px){
      .cost-list .list-row {
        gap: 8px;
        font-size: 15.5px;
        padding: 8px 0;
      }
    }

    /* ======================================================== */
    /* [사용자 요청] 최근 기록이에요 카드 (모바일 270px 고정 & 내부 스크롤) */
    /* ======================================================== */
    .recent-panel {
      height: 350px;
      display: flex;
      flex-direction: column;
    }
    @media(max-width:600px){
      .recent-panel {
        height: 270px;
        display: flex;
        flex-direction: column;
      }
    }
    .recent-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .recent-list-wrap {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      min-height: 0;
      scrollbar-width: thin;
      scrollbar-color: #2a3945 transparent;
    }
    .recent-list-wrap::-webkit-scrollbar {
      width: 4px;
    }
    .recent-list-wrap::-webkit-scrollbar-thumb {
      background: #2a3945;
      border-radius: 4px;
    }
    .recent-expense-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--j-border);
      font-size: 14.5px;
    }
    .recent-expense-row:last-child {
      border-bottom: 0;
    }
    .recent-left {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .recent-title-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    /* 카테고리별 색상 하이라이트 뱃지 */
    .cat-highlight-pill {
      flex: 0 0 auto;
      width: fit-content;
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      letter-spacing: -0.2px;
      line-height: 1.2;
    }
    .recent-item-title {
      color: var(--j-ink);
      font-weight: 600;
    }
    .recent-date-sub {
      color: var(--j-sub);
      font-size: 13px;
    }
    .recent-amount {
      font-size: 16px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--j-ink);
      white-space: nowrap;
    }

    /* ======================================================== */
    /* [사용자 요청] 놓친 기록을 남겨요 모달 다이얼로그            */
    /* ======================================================== */
    /* [사용자 요청] 놓친 기록을 남겨요 모달 다이얼로그            */
    /* ======================================================== */
    /* 모든 네이티브 다이얼로그 닫힘 상태 시 완전 숨김 보장 */
    dialog:not([open]) {
      display: none !important;
    }
    dialog#recordDialog {
      color: var(--j-ink);
      background: #141c23;
      border: 1px solid #334454;
      border-radius: 24px;
      width: min(540px, calc(100vw - 24px));
      max-height: calc(100dvh - 48px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
      padding: 0 !important;
      overflow: hidden !important;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
      position: fixed;
      inset: 0;
      margin: auto;
      z-index: 2000;
      flex-direction: column;
      box-sizing: border-box;
    }
    dialog#recordDialog[open] {
      display: flex !important;
    }
    dialog#recordDialog:not([open]) {
      display: none !important;
    }
    dialog#recordDialog::backdrop {
      background: rgba(4, 8, 12, 0.75);
      backdrop-filter: blur(8px);
    }
    #recordDialog #recordForm {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      max-height: 100%;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }
    #recordDialog .modal-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #141c23;
      border-bottom: 1px solid var(--j-border);
      flex-shrink: 0;
      margin: 0 !important;
      position: relative;
      z-index: 20;
    }
    .modal-header-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .modal-scroll-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px 20px 24px;
      box-sizing: border-box;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    #recordDialog [hidden] {
      display: none !important;
    }
    #recordDialog .fullfield,
    #recordDialog #memoField,
    #recordDialog #recordLocationField,
    #recordDialog #recordPhotoField,
    #recordDialog #importSourceDetails {
      grid-column: 1 / -1 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    /* 저장, 닫기 버튼 크기, 높이, 폰트, 모서리 둥글기 100% 일치 */
    #recordDialog #save,
    #recordDialog #close,
    .modal-close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      min-height: 36px;
      max-height: 36px;
      padding: 0 15px;
      font-size: 13.5px;
      font-weight: 700;
      border-radius: 9px;
      box-sizing: border-box;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    #recordDialog #save {
      background: var(--j-accent);
      color: #06231a;
      border: 1px solid var(--j-accent);
      box-shadow: 0 2px 8px rgba(129, 230, 197, 0.25);
      position: relative;
      overflow: hidden;
    }
    #recordDialog #save:hover:not(:disabled) {
      background: #9cf2d7;
      border-color: #9cf2d7;
    }
    #recordDialog #save.loading {
      background: #17242e !important;
      color: var(--j-accent) !important;
      border-color: rgba(129, 230, 197, 0.4) !important;
      cursor: wait;
      box-shadow: none;
    }
    #recordDialog #close,
    .modal-close-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: var(--j-ink);
    }
    #recordDialog #close:hover,
    .modal-close-btn:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.22);
    }
    .btn-save-progress .progress-fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, rgba(129, 230, 197, 0.25), rgba(129, 230, 197, 0.5));
      transition: width 0.25s ease-out;
      pointer-events: none;
    }
    .btn-save-progress .btn-content {
      position: relative;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-save-progress .spinner {
      display: none;
      width: 13px;
      height: 13px;
      border: 2px solid rgba(129, 230, 197, 0.3);
      border-top-color: var(--j-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .btn-save-progress.loading .spinner {
      display: inline-block;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 18px;
    }
    @media(max-width:600px){
      .form-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      color: var(--j-sub);
    }
    .form-field.full {
      grid-column: 1 / -1;
    }
    .form-field input, .form-field select, .form-field textarea {
      background: #0d1318;
      border: 1px solid var(--j-border);
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 15px;
      color: var(--j-ink);
      outline: none;
      transition: border-color 0.2s ease;
    }
    .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
      border-color: var(--j-accent);
    }
    .file-input-box {
      border: 1px dashed var(--j-border);
      border-radius: 10px;
      padding: 10px;
      background: #0b1014;
      font-size: 13.5px;
      color: var(--j-sub);
    }
    /* ======================================================== */
    /* [사용자 요청] 상세 기록 탭 - 사진 썸네일 & 관리 버튼 & 라이트박스 */
    /* ======================================================== */
    .memo-cell-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
    }
    .memo-text-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      flex: 1;
    }
    .memo-title {
      font-weight: 600;
      color: var(--j-ink);
      font-size: 15px;
    }
    .memo-desc {
      color: var(--j-sub);
      font-size: 13px;
      font-weight: 400;
      display: block;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      margin-top: 2px;
    }
    .memo-thumb-btn {
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
      display: inline-flex;
      border-radius: 8px;
      transition: transform 0.15s ease, filter 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .memo-thumb-btn:hover {
      transform: scale(1.08);
      filter: brightness(1.15);
    }
    .memo-thumb-btn:active {
      transform: scale(0.96);
    }
    .thumb-box {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--j-border);
      background: #141c23;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb-spinner {
      font-size: 16.5px;
      opacity: 0.5;
    }
    .thumb-badge {
      position: absolute;
      bottom: -3px;
      right: -3px;
      background: rgba(11, 16, 20, 0.92);
      border: 1px solid var(--j-accent);
      color: var(--j-accent);
      font-size: 11.5px;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 6px;
      line-height: 1.2;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }

    /* 관리 열 버튼 정렬 (사진 N장, 수정, 삭제) */
    .ledger-table{table-layout:fixed;min-width:760px;margin-top:0 !important}
    .ledger-date-col{width:14%}.ledger-memo-col{width:49%}.ledger-value-col{width:13%}.ledger-actions-col{width:24%}
    .ledger-table th{padding:8px 6px}
    .ledger-table td{overflow-wrap:anywhere;vertical-align:middle}
    .ledger-table .memo-text-col{min-width:0}
    #page3 .table-wrap{margin-top:4px}
    #page3 .ledger-table{margin-top:0 !important}
    #page3 .ledger-table td:last-child{white-space:normal}
    .ledger-table .btn-table-action{margin-bottom:4px}
    @media(max-width:760px){
      #page3 .table-wrap{overflow:visible;margin-top:4px}
      #page3 .ledger-table{display:block;min-width:0;table-layout:auto;margin-top:0 !important}
      #page3 .ledger-table colgroup{display:none}
      #page3 .ledger-table thead{display:block}
      #page3 .ledger-table thead tr{display:flex;justify-content:flex-end;margin-bottom:0}
      #page3 .ledger-table thead th{display:none}
      #page3 .ledger-table thead #ledgerAmountHeader{display:block;padding:2px 0 4px;font-size:12px;border:0;line-height:1.2}
      #page3 .ledger-table tbody{display:block}
      #page3 .ledger-table tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'memo amount' 'date date' 'actions actions';gap:8px 12px;padding:18px 0;border-bottom:1px solid var(--j-border)}
      #page3 .ledger-table tbody tr:first-child{padding-top:6px}
      #page3 .ledger-table td{display:block;padding:0;border:0;min-width:0}
      #page3 .ledger-table td:nth-child(1){grid-area:date;font-size:12px;color:var(--j-sub)}
      #page3 .ledger-table td:nth-child(1) small{display:inline;margin-left:6px}
      #page3 .ledger-table td:nth-child(2){grid-area:memo}
      #page3 .ledger-table td:nth-child(3){grid-area:amount;align-self:center;text-align:right;font-size:17px;font-weight:750;white-space:nowrap;color:var(--j-ink)}
      #page3 #ledgerSort{color:var(--j-sub)}
      #page3 .ledger-table td:nth-child(4){grid-area:actions;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      #page3 .ledger-table .memo-cell-wrap{gap:8px;align-items:flex-start}
      #page3 .ledger-table .memo-cat-title{font-size:14px;line-height:1.5;font-weight:700}
      #page3 .ledger-table .memo-desc{font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
      #page3 .ledger-table .ledger-main-title{font-size:inherit;font-weight:750;line-height:1.4}
      #page3 .ledger-table .ledger-sub-title{font-size:inherit;font-weight:600;line-height:1.4}
      #page3 .ledger-table .memo-thumb-btn{flex-shrink:0}
      #page3 .ledger-table .btn-table-action{padding:5px 9px;font-size:12px;min-height:32px;margin:0}
      #page3 .ledger-table td[colspan]{grid-column:1/-1;grid-area:auto}
      #page3 .ledger-table td:nth-child(4)>small{font-size:11px}
    }
    #ledgerSort{padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;text-align:left;cursor:pointer}
    #ledgerSort:focus-visible{outline:2px solid var(--j-accent);outline-offset:4px}
    #page2 .savings-layout{grid-template-columns:1.4fr 1fr;gap:18px}
    #page2 .savings-layout>.panel{grid-column:auto;padding:22px;border-radius:17px}
    #page2 .savings-hero{background:linear-gradient(135deg,#183e36,#17252c)}
    #page2 .savings-hero h2{font-size:25px;font-weight:700;line-height:1.4}
    #page2 .savings-hero .compare-value{font-size:42px;font-weight:760;line-height:1.2;letter-spacing:-1px;padding-block:8px;color:#81e6c5}
    #page2 #compareBasis{margin:6px 0 16px;font-size:15px;line-height:1.65}
    #page2 .savings-controls label{font-size:13px;color:var(--j-sub)}
    #page2 .savings-controls .slider-title{color:var(--j-ink)}
    #page2 .savings-controls input[type=range]{min-height:0;height:16px;margin:6px 0 0;border:0;border-radius:0;background:transparent}
    #page2 .savings-controls small{font-size:12.5px;line-height:1.65}
    #page2 .savings-controls hr{margin:16px 0}
    #page2 .savings-controls .row{gap:15px;flex-wrap:nowrap}
    #page2 .savings-controls .compact{border-radius:7px;white-space:nowrap;font-weight:400}
    #page2 .fuel-topline{margin-bottom:22px;gap:12px}
    #page2 .fuel-topline label{flex:1;font-size:12px}
    #page2 .fuel-switch{gap:6px;flex-shrink:0}
    #page2 .fuel-switch button.compact{font-size:11px;padding:5px 6px}
    #page2 .fuel-switch button.active{font-weight:700}
    #page2 #comparePrice{margin:0 0 20px}
    #page2 .savings-controls .settings{padding:12px 16px;border:1px solid var(--j-border);border-radius:12px;background:var(--j-bg);margin-top:20px}
    #page2 .savings-controls summary{font-size:15px;line-height:1.65}
    #page2 .savings-bars .row{font-size:15px;line-height:1.65;margin-bottom:8px}
    #page2 .cost-bar{height:16px;margin:0 0 20px;background:#243540}
    #page2 .cost-bar:last-child{margin-bottom:0}
    @media(max-width:760px){#page2 .savings-layout{grid-template-columns:1fr}#page2 .savings-hero .compare-value{font-size:34px}}
    @media(max-width:420px){#page2 .fuel-topline{gap:6px}#page2 .fuel-topline label{font-size:11px}#page2 .fuel-switch{gap:3px}#page2 .fuel-switch button.compact{font-size:10px;padding:5px 4px}}
    .savings-hero{display:flex;flex-direction:column;justify-content:space-between;gap:28px}
    #page2 .fuel-connection-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--j-border);font-size:13px}
    #page2 .fuel-connection-row small{display:block;font-size:12px}
    #page2 #compareForm{margin-top:12px}
    #page2 #compareForm input{padding:6px 8px;font-size:12px;min-height:30px;margin:6px 0 10px}
    .savings-hero h2,.savings-hero .compare-value{margin:0}.savings-hero .compare-value{padding-block:16px}
    .savings-controls{display:flex;align-items:center}.controls-content{width:100%;min-width:0}
    .savings-controls input[type=range]{width:100%;padding:0;margin:18px 0;accent-color:var(--j-accent)}
    .slider-title{font-weight:750;font-size:calc(1em + 1px);color:var(--j-text)}
    .savings-controls hr{border:0;border-top:1px solid var(--j-line);margin:24px 0}
    .savings-controls button.compact{padding:5px 7px;font-size:12px;line-height:1.3;min-height:0}
    .fuel-topline{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.fuel-topline label{font-size:12px}
    .fuel-switch{display:flex;gap:4px;margin-left:auto}.fuel-switch .active{background:var(--j-accent);color:#102c24}
    .savings-controls .settings{margin-top:20px}.savings-controls summary{cursor:pointer;color:var(--j-accent)}
    .cost-bar{height:14px;background:#263844;border-radius:5px;overflow:hidden;margin:10px 0 24px}.cost-bar:last-child{margin-bottom:0}.cost-bar span{display:block;height:100%;background:#81e6c5}.cost-bar.orange span{background:#ffb76b}.savings-bars .mint{color:#81e6c5}.savings-bars .orange{color:#ffb76b}
    .ledger-panel-header{margin-bottom:0}
    .ledger-panel-header h2{margin:0;font-size:20px;font-weight:750}
    .ledger-filters{display:flex;align-items:flex-start;flex-wrap:wrap;gap:12px;margin:12px 0 0}
    .ledger-dropdown{position:relative;max-width:100%}
    .ledger-dropdown:not([open]) .ledger-category-filters{display:none !important}
    .ledger-dropdown summary{cursor:pointer;min-height:34px;box-sizing:border-box;padding:4px 12px;border:1px solid var(--j-border);border-radius:9px;background:var(--j-surface);font-weight:650}
    #ledgerFilterSummary{margin-left:8px;color:var(--j-accent);font-size:13px}
    .ledger-category-filters{position:absolute;left:0;top:calc(100% + 6px);z-index:10;display:grid;grid-template-columns:1fr 1fr;gap:4px;width:260px;max-width:calc(100vw - 72px);padding:10px;box-sizing:border-box;border:1px solid var(--j-border);border-radius:12px;background:var(--j-surface);box-shadow:0 12px 30px #0008}
    .ledger-filter-option{display:flex;align-items:center;gap:7px;color:var(--category-color,var(--j-ink));padding:5px 3px;font-size:13px;cursor:pointer;min-height:30px}
    .ledger-filter-option input{width:17px;height:17px;margin:0;accent-color:var(--category-color,var(--j-accent));flex-shrink:0}
    .ledger-dropdown summary:focus-visible,.ledger-filter-option input:focus-visible{outline:3px solid var(--j-blue);outline-offset:2px}
    @media(max-width:520px){.ledger-dropdown{position:static}.ledger-filters{position:relative}.ledger-category-filters{left:0;top:100%}}
    .table td:last-child {
      white-space: nowrap;
    }
    .btn-table-action {
      background: var(--j-surface);
      border: 1px solid var(--j-border);
      color: var(--j-ink);
      font-size: 13.5px;
      padding: 5px 9px;
      min-height: 30px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-right: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-table-action:last-child {
      margin-right: 0;
    }
    .btn-table-action:hover {
      background: var(--j-raised);
      border-color: var(--j-sub);
      color: #fff;
    }
    .btn-table-action.btn-photo {
      background: rgba(129, 230, 197, 0.1);
      border-color: rgba(129, 230, 197, 0.35);
      color: var(--j-accent);
      font-weight: 600;
    }
    .btn-table-action.btn-photo:hover {
      background: rgba(129, 230, 197, 0.2);
      border-color: var(--j-accent);
      color: #fff;
    }

    /* 사진 라이트박스 모달 다이얼로그 */
    dialog#photoViewerDialog {
      color: var(--j-ink);
      background: #11171d;
      border: 1px solid #334454;
      border-radius: 22px;
      width: min(840px, calc(100vw - 32px));
      max-height: 90vh;
      padding: 20px 24px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.85);
      position: fixed;
      inset: 0;
      margin: auto;
      z-index: 2100;
      flex-direction: column;
      box-sizing: border-box;
    }
    dialog#photoViewerDialog[open] {
      display: flex;
    }
    dialog#photoViewerDialog::backdrop {
      background: rgba(3, 7, 10, 0.85);
      backdrop-filter: blur(10px);
    }
    .lightbox-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--j-border);
    }
    .lightbox-title-wrap {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .lightbox-title-wrap h2 {
      font-size: 18.5px;
      margin: 0;
      font-weight: 750;
      color: #ffffff;
    }
    .lightbox-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      min-height: 320px;
      max-height: 62vh;
      margin: 16px 0;
      overflow: hidden;
    }
    .lightbox-stage {
      flex: 1;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lightbox-stage img {
      max-width: 100%;
      max-height: 60vh;
      object-fit: contain;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    }
    .lightbox-spinner {
      color: var(--j-sub);
      font-size: 15.5px;
    }
    .lightbox-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(22, 30, 37, 0.85);
      border: 1px solid var(--j-border);
      color: #fff;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      z-index: 10;
      backdrop-filter: blur(4px);
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .lightbox-nav-btn:hover {
      background: var(--j-raised);
      border-color: var(--j-accent);
      color: var(--j-accent);
      transform: translateY(-50%) scale(1.08);
    }
    .lightbox-nav-btn:active {
      transform: translateY(-50%) scale(0.95);
    }
    .lightbox-nav-btn.prev { left: 10px; }
    .lightbox-nav-btn.next { right: 10px; }
    .lightbox-footer {
      padding-top: 10px;
      border-top: 1px solid var(--j-border);
      text-align: center;
    }
    .lightbox-caption {
      margin: 0;
      font-size: 14.5px;
      color: var(--j-sub);
    }
    @media(max-width:600px){
      dialog#photoViewerDialog {
        padding: 16px;
        width: calc(100vw - 20px);
        border-radius: 16px;
      }
      .lightbox-body {
        min-height: 240px;
        max-height: 55vh;
      }
      .lightbox-stage img {
        max-height: 52vh;
      }
      .lightbox-nav-btn {
        width: 38px;
        height: 38px;
        font-size: 25.5px;
      }
      .lightbox-nav-btn.prev { left: 6px; }
      .lightbox-nav-btn.next { right: 6px; }
    }

.shell{max-width:none;width:100%;box-sizing:border-box;margin:0}
.status{margin:24px 0 10px;padding:12px 16px;font-size: 14px;color:var(--j-sub);background:var(--j-surface);border:1px solid var(--j-border);border-radius:12px;text-align:center}
#headline{font-weight:850}.cost-list{min-width:0}.recent-list-wrap{min-height:100px}
.period-tab-btn:focus-visible,.legend-item:focus-visible{outline:3px solid var(--j-blue);outline-offset:2px}
#recordDialog .fields label{display:flex;flex-direction:column;gap:6px;font-size: 14px;color:var(--j-sub)}
#recordDialog .fields input,#recordDialog .fields select,#recordDialog .fields textarea{margin-top:0;background:#0d1318}
#recordDialog .row.spaced{padding-bottom:14px;border-bottom:1px solid var(--j-border);margin-bottom:18px}
@media(max-width:850px){.wide,.narrow,.half{grid-column:span 12}.mast{flex-wrap:wrap}}
@media(max-width:600px){
  .shell{padding:16px}
  .stats{grid-template-columns:repeat(3,minmax(0,1fr))}
  .cost-layout{gap:12px;flex-wrap:nowrap}
  .title-controls-row{flex-wrap:wrap}
  .title-controls-row .date-pill{max-width:145px}
  .stat strong{font-size: 19.5px}
  .stat-unit{font-size: 13px}
  #headline{font-size:clamp(22px,6.5vw,34px)}
  .legend-item{padding:6px 8px;min-height:32px;background:transparent;border:0}
  .trend-badge{white-space:nowrap;flex-shrink:0}
}
@media(max-width:360px){
  .shell{padding:12px}
  .stat strong{font-size: 17.5px}
  .stat-unit{font-size: 11.5px}
  .donut{width:115px;height:115px}
  .h-phrase{white-space:normal}
}
.title-controls-row .select-pill{width:auto;max-width:240px}
.date-navigation{display:flex;align-items:center;gap:6px;max-width:100%;min-width:0}
.date-navigation .date-pill{box-sizing:border-box;min-width:115px;width:auto;max-width:160px;text-align:center}
.date-step,.date-current{box-sizing:border-box;height:38px;min-height:38px;border:1px solid var(--j-border);border-radius:10px;background:var(--j-surface);color:var(--j-ink);cursor:pointer;flex-shrink:0}
.date-step{width:36px;min-width:36px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:22px;line-height:1}
.date-current{padding:6px 10px;font-size:14px;white-space:nowrap;color:var(--j-accent);font-weight:750;display:inline-flex;align-items:center}
.date-step:hover,.date-current:hover{border-color:var(--j-accent)}
.date-step:disabled{opacity:.35;cursor:not-allowed;transform:none;border-color:var(--j-border)}
.date-step:focus-visible,.date-current:focus-visible{outline:3px solid var(--j-blue);outline-offset:2px}
@media(max-width:600px){.date-navigation{gap:5px}.date-step{width:34px;min-width:34px;height:36px;min-height:36px;font-size:20px}.date-navigation .date-pill{min-width:105px;max-width:140px;padding:6px 6px;font-size:13.5px}.date-current{height:36px;min-height:36px;padding:6px 8px;font-size:13px}}
.legend-item{background:transparent;border:0;padding:2px 6px;min-height:20px;font-size: 12.5px}
.trend-badge{white-space:nowrap;flex-shrink:0}

/* [Apple Health 스타일 추세(Trends) 대시보드] */
.trends-container { display: flex; flex-direction: column; gap: 24px; }
.trends-header { margin-bottom: 4px; }
.trends-main-title { font-size: 27.5px; font-weight: 850; color: #ffffff; margin: 0 0 6px 0; letter-spacing: -0.6px; }
.trends-main-desc { font-size: 15px; color: var(--j-sub); margin: 0; line-height: 1.5; }
.trends-section { display: flex; flex-direction: column; gap: 12px; }
.trends-section-title { font-size: 20.5px; font-weight: 750; color: #ffffff; margin: 0; letter-spacing: -0.4px; display: flex; align-items: center; gap: 8px; }
.trends-empty-pill { background: var(--j-surface); border: 1px solid var(--j-border); color: var(--j-sub); border-radius: 12px; padding: 16px 20px; font-size: 15.5px; font-weight: 600; text-align: center; }

/* 2열 그리드 레이아웃 & 2가지 예외 규칙 */
.trends-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
/* [예외 1] 변동 있는 추세 항목이 1개일 경우 2열이 아닌 1열(전폭 100%)로 표시 */
.trends-grid.single-item .trend-card { grid-column: 1 / -1; }
/* [예외 2] 2열 배열에서 홀수로 인해 최하단에 혼자 남은 카드 -> 1열(전폭 100%) 자동 확장 */
.trends-grid .trend-card:last-child:nth-child(odd) { grid-column: 1 / -1; }

/* 추세 카드 스타일링 */
.trend-card { background: #141c23; border: 1px solid var(--j-border); border-radius: 20px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25); transition: transform 0.2s ease, border-color 0.2s ease; box-sizing: border-box; }
.trend-card:hover { border-color: rgba(255, 255, 255, 0.22); transform: translateY(-2px); }
.trend-card-top { display: flex; justify-content: space-between; align-items: center; }
.trend-title-group { display: flex; align-items: center; gap: 8px; }
.trend-badge-icon { font-size: 17.5px; line-height: 1; display:inline-flex; }
.j-ico{width:1.1em;height:1.1em;vertical-align:-0.2em;flex-shrink:0}.btn-loc-add .j-ico,.btn-loc-pin-link .j-ico{margin-right:2px}.loc-name-state .j-ico{margin-right:2px}.photo-pick-tile .j-ico{width:26px;height:26px}.receipt-notice-banner .j-ico{width:1.2em;height:1.2em}
.trend-metric-name { font-size: 19.5px; font-weight: 850; letter-spacing: -0.3px; overflow-wrap: anywhere; }
.trend-arrow { color: #647b8e; font-size: 19.5px; font-weight: 600; line-height: 1; }
.trend-card-summary { overflow-wrap: anywhere; font-size: 15.5px; font-weight: 600; color: #e2ecf3; line-height: 1.45; margin: 0; letter-spacing: -0.2px; }
.trend-card-summary strong { color: var(--trend-color); font-weight: 850; }
.trend-divider { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 4px 0 6px 0; }
.trend-headline { font-size: 16.5px; font-weight: 750; color: #ffffff; letter-spacing: -0.4px; margin: 0; line-height: 1.35; }
.trend-direction { color: var(--trend-color); font-weight: 850; }
.trend-chart-box { width: 100%; display: flex; flex-direction: column; position: relative; margin-top: 4px; padding-top: 24px; }
.trend-chart-svg-wrap { width: 100%; height: 85px; position: relative; }
.trend-chart-svg { width: 100%; height: 100%; display: block; }

/* 기준선 위 수치 라벨 (SVG 종횡비 왜곡 차단 - 순수 HTML 네이티브 텍스트 렌더링) */
.trend-chart-avg-label { position: absolute; font-size: 16px; font-weight: 850; letter-spacing: -0.2px; transform: translateY(calc(-100% - 8px)); pointer-events: none; white-space: nowrap; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95); line-height: 1; }
.trend-chart-avg-label.pos-left { left: 6px; }
.trend-chart-avg-label.pos-right { right: 6px; }
.trend-chart-axis-labels { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 6px; font-size: 12.5px; font-weight: 600; color: var(--j-sub); line-height: 1; padding: 0 4px; }

@media(max-width:600px){
  .trends-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .trend-card { padding: 14px 14px; border-radius: 16px; gap: 8px; }
  .trend-headline { font-size: 14.5px; }
  .trend-metric-name { font-size: 16.5px; }
  .trend-card-summary { font-size: 13.5px; }
  .trend-chart-svg-wrap { height: 75px; }
  .trend-chart-avg-label { font-size: 14.5px; }
  .trend-chart-axis-labels { font-size: 11.5px; }
}
@media(max-width:600px){
  .trends-grid { grid-template-columns: minmax(0, 1fr); }
}

.vehicle-import-actions{display:grid;align-items:stretch;grid-template-columns:1fr 1fr;margin:18px 0;gap:12px}.vehicle-import-actions button{white-space:normal}.journal-location{margin:8px 0;display:flex;flex-direction:column;gap:8px}.loc-header-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.loc-header-title-wrap{display:flex;align-items:center;gap:8px;min-width:0}.loc-header-title-wrap h3{margin:0;font-size:16px;font-weight:700;white-space:nowrap}.loc-summary-pill{font-size:12px;font-weight:500;color:var(--j-mint,#81e6c5);background:rgba(129,230,197,0.12);padding:3px 8px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}.loc-summary-pill[hidden]{display:none}.btn-loc-remove{background:transparent !important;color:#ff8585 !important;border:1px solid rgba(255,133,133,0.3) !important;font-size:12px !important;padding:4px 10px !important;min-height:28px !important;height:auto !important;border-radius:8px !important;cursor:pointer;flex-shrink:0}.btn-loc-remove:hover{background:rgba(255,133,133,0.1) !important;border-color:#ff8585 !important}.btn-loc-remove[hidden]{display:none !important}.btn-loc-add{width:100%;padding:12px;border-radius:12px;border:1px dashed var(--j-border);background:var(--j-surface);color:var(--j-ink);font-size:14px;font-weight:600;cursor:pointer;text-align:center}.btn-loc-add:hover{border-color:var(--j-mint,#81e6c5);background:var(--j-raised)}.btn-loc-add[hidden]{display:none}#locationEditor{display:flex;flex-direction:column;gap:14px;padding:14px;border-radius:14px;background:var(--j-raised,rgba(255,255,255,0.03));border:1px solid var(--j-border)}#locationEditor[hidden]{display:none}.loc-search-box{display:flex;flex-direction:column;gap:8px}.loc-box-title{font-size:13.5px;font-weight:700;color:var(--j-ink)}.loc-search-row{display:flex;gap:8px;align-items:center;width:100%}.loc-search-row #placeQuery{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid var(--j-border);background:var(--j-surface);font-size:14px}.btn-loc-search{flex-shrink:0;padding:10px 16px;border-radius:10px;font-weight:600;font-size:13.5px;min-height:40px;height:auto}.btn-loc-pin{flex-shrink:0;padding:10px 12px;border-radius:10px;font-size:13px;min-height:40px;height:auto}#placeResults{display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;margin-top:4px;padding:2px}#placeResults:empty{display:none}.place-result-item{display:flex !important;flex-direction:column !important;align-items:flex-start !important;text-align:left !important;width:100% !important;box-sizing:border-box !important;height:auto !important;min-height:52px !important;padding:10px 14px !important;border-radius:10px !important;border:1px solid var(--j-border) !important;background:var(--j-surface) !important;color:var(--j-ink) !important;white-space:normal !important;overflow:visible !important;cursor:pointer;transition:background 0.15s ease,border-color 0.15s ease}.place-result-item:hover,.place-result-item:focus-visible{background:var(--j-raised,rgba(255,255,255,0.08)) !important;border-color:var(--j-mint,#81e6c5) !important}.place-result-name{font-size:14.5px !important;font-weight:700 !important;color:var(--j-ink) !important;line-height:1.35 !important;word-break:keep-all;overflow-wrap:break-word}.place-result-addr{font-size:12.5px !important;font-weight:400 !important;color:var(--j-sub) !important;line-height:1.4 !important;margin-top:3px !important;word-break:break-all;overflow-wrap:anywhere}.selected-loc-section{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(129,230,197,0.06);border:1px solid rgba(129,230,197,0.25)}.selected-loc-badge{font-size:11.5px;font-weight:700;color:var(--j-mint,#81e6c5);letter-spacing:-0.2px;text-transform:uppercase}.selected-loc-addr-text{font-size:13.5px;font-weight:600;color:var(--j-ink);line-height:1.4;word-break:break-all;overflow-wrap:anywhere}.selected-loc-addr-text.empty{font-size:12.5px;font-weight:400;color:var(--j-sub)}.selected-loc-name-field{display:flex;flex-direction:column;gap:6px;margin-top:2px}.selected-loc-name-title{font-size:13px;font-weight:700;color:var(--j-ink)}.selected-loc-name-field #locationName{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--j-border);background:var(--j-surface);font-size:14px}.selected-loc-hint{font-size:12px;color:var(--j-sub);line-height:1.4}.loc-map-container{display:flex;flex-direction:column;gap:6px}#vehicleManageList .panel{padding:16px;margin:12px 0}#vehicleManageList input,#vehicleManageList select{width:100%}#vehicleDialog h2{font-size:26px}#importPreview{max-height:340px;overflow:auto;margin:12px 0}@media(max-width:600px){.vehicle-import-actions button{font-size:13px}.loc-search-row{flex-wrap:wrap}.loc-search-row #placeQuery{flex-basis:100%}.btn-loc-search,.btn-loc-pin{flex:1}.loc-summary-pill{max-width:160px}#vehicleDialog h2{font-size:23px}}

.card-settings-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.card-settings-top[hidden]{display:none}.card-settings-top h2{font-size:25.5px;margin:0;white-space:nowrap;letter-spacing:-0.5px}
#vehicleManageDialog{box-sizing:border-box;margin:auto;width:980px;max-width:calc(100vw - 40px);height:min(760px,calc(100dvh - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));max-height:calc(100dvh - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));padding:0;overflow:hidden;border:1px solid var(--j-border);border-radius:18px;background:var(--j-surface);color:var(--j-ink)}
#vehicleManageDialog[open]{display:grid;grid-template-rows:auto minmax(0,1fr) auto}
#vehicleManageDialog::backdrop{background:rgba(4,8,12,0.75);backdrop-filter:blur(8px)}
.settings-dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 26px 18px;border-bottom:1px solid var(--j-border);background:var(--j-surface)}
.settings-dialog-header h2{margin:0;font-size:22px;font-weight:750;color:var(--j-ink)}
.settings-dialog-header p{margin:6px 0 0;font-size:13px;color:var(--j-sub)}
.settings-dialog-header button{padding:6px 14px;min-height:32px;font-size:13px;font-weight:600;border-radius:8px;flex-shrink:0}
.settings-layout{display:grid;grid-template-columns:180px minmax(0,1fr);height:100%;min-height:0;overflow:hidden}
.settings-nav{display:flex;flex-direction:column;gap:8px;padding:18px 12px;border-right:1px solid var(--j-border);overflow:auto;background:var(--j-raised)}
.settings-nav button{text-align:left;padding:12px 14px;white-space:normal;line-height:1.45;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--j-ink);font-size:14px;font-weight:600;cursor:pointer;transition:all 0.15s ease}
.settings-nav button:hover{background:rgba(255,255,255,0.05);color:var(--j-ink)}
.settings-nav button.active{color:var(--j-mint,#81e6c5);background:rgba(129,230,197,0.12);border-color:rgba(129,230,197,0.35)}
.settings-content{min-width:0;width:100%;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;padding:24px}
.settings-content h3{margin:0 0 12px;font-size:20px;font-weight:700;color:var(--j-ink)}
.settings-section{border:1px solid var(--j-border);border-radius:14px;padding:18px;margin:16px 0;background:var(--j-surface);width:100%;box-sizing:border-box}
.settings-section h4{margin:0 0 12px;font-size:16.5px;font-weight:700;color:var(--j-ink)}
.settings-key-field{display:flex;align-items:center;gap:8px;margin-top:8px;width:100%;box-sizing:border-box}
.settings-key-field input{flex:1;min-width:0;width:100%;font-family:monospace;padding:8px 10px;min-height:38px;box-sizing:border-box}
.settings-key-field button{flex-shrink:0}
.settings-key-help{display:block;color:var(--j-sub);font-size:12px;line-height:1.6;margin-top:8px;overflow-wrap:anywhere}
.settings-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.settings-backup-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--j-border);width:100%;box-sizing:border-box}
.settings-backup-row span{min-width:0;overflow-wrap:anywhere}
.settings-backup-row small{display:block;line-height:1.5;margin-top:4px;color:var(--j-sub)}
.settings-message{min-height:32px;padding:8px 24px;margin:0;border-top:1px solid var(--j-border);color:var(--j-sub);font-size:13.5px;overflow-wrap:anywhere;max-height:90px;overflow:auto;box-sizing:border-box}
#vehicleManageDialog button{min-height:36px;font-size:13px;padding:8px 12px;border-radius:10px}
#vehicleManageDialog input,#vehicleManageDialog select{padding:8px 10px;min-height:38px;box-sizing:border-box}
#vehicleManageList .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;width:100%;box-sizing:border-box}
#vehicleManageList small{display:block;margin:10px 0;color:var(--j-sub)}
#vehicleManageList .panel{padding:16px;margin:12px 0;border:1px solid var(--j-border);border-radius:14px;background:var(--j-surface);width:100%;box-sizing:border-box}
#vehicleManageList input,#vehicleManageList select{width:100%;box-sizing:border-box}
.vehicle-trashed label,.vehicle-trashed small,.vehicle-trashed.settings-backup-row span,.vehicle-trashed [data-title],.vehicle-trashed [data-fuel],#vehicleManageDialog .vehicle-delete{color:#ff8585}
.vehicle-trashed{border-color:#ff858544}
@media(max-width:600px){
  .card-settings-top h2{font-size:21px}
  #vehicleManageDialog{width:calc(100vw - 32px);max-width:calc(100vw - 32px);height:min(720px,calc(100dvh - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));max-height:calc(100dvh - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border-radius:18px;margin:auto}
  .settings-dialog-header{padding:16px 18px 14px;gap:12px}
  .settings-dialog-header h2{font-size:18px}
  .settings-dialog-header p{font-size:12px;margin-top:3px}
  .settings-dialog-header button{padding:6px 12px;min-height:30px;font-size:12.5px}
  .settings-layout{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}
  .settings-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:6px 8px;border-right:none;border-bottom:1px solid var(--j-border);overflow:visible;background:var(--j-raised);flex-shrink:0}
  .settings-nav button{text-align:center;padding:7px 2px;font-size:11.5px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:8px;min-height:32px}
  .settings-content{flex:1;min-height:0;padding:14px 12px;overflow-y:auto;overflow-x:hidden;width:100%;box-sizing:border-box}
  .settings-content h3{font-size:16.5px;margin-bottom:8px}
  .settings-content .note{font-size:12px;line-height:1.45}
  .settings-section{padding:12px;margin:10px 0;border-radius:12px}
  .settings-section h4{font-size:15px;margin-bottom:8px}
  #vehicleManageList .panel{padding:12px;margin:10px 0;border-radius:12px}
  #vehicleManageList .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px;width:100%;box-sizing:border-box;margin-top:10px}
  #vehicleManageList .row button{width:100%;min-height:34px;padding:6px 4px;font-size:12px;text-align:center}
  #vehicleManageDialog button{min-height:34px;font-size:12.5px;padding:6px 10px}
  #vehicleManageDialog input,#vehicleManageDialog select{font-size:15px;min-height:38px}
  .settings-key-field{flex-wrap:wrap;gap:6px}
  .settings-key-field input{flex-basis:100%;width:100%}
  .settings-key-field button{width:100%;text-align:center}
  .settings-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%}
  .settings-actions button{width:100%;text-align:center}
  .settings-backup-row{flex-direction:column;align-items:flex-start;gap:8px;padding:12px 0}
  .settings-backup-row button{width:100%;text-align:center}
  .settings-message{padding:8px 14px;font-size:12px}
}
.ledger-pill-wrap{display:inline-flex;align-items:center;min-width:0;line-height:1;margin-bottom:2px}.ledger-main-title{font-size:inherit;font-weight:750;color:var(--j-ink);line-height:1.4;word-break:break-word}.ledger-sub-title{font-size:inherit;font-weight:600;color:#b0c4d4;line-height:1.4;word-break:break-word}.ledger-place-name{font-weight:600;overflow-wrap:anywhere;min-width:0;line-height:1.4}.ledger-category-location{display:flex;align-items:center;gap:8px;min-width:0}.ledger-category-location .cat-highlight-pill{flex-shrink:0}.input-unit-wrap{position:relative;display:flex;align-items:center;width:100%}.input-unit-wrap input{width:100%;padding-right:48px !important;box-sizing:border-box}.input-unit-suffix{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:var(--j-sub);opacity:0.5;font-size:12px;font-weight:600;pointer-events:none;user-select:none;letter-spacing:-0.2px}.ledger-table td:nth-child(3),.ledger-amount-col{font-size:15px;font-weight:750;font-variant-numeric:tabular-nums;color:var(--j-ink);white-space:nowrap}
.ledger-unit-price{display:block;margin-top:2px;font-size:12px;font-weight:400;color:var(--j-sub);font-variant-numeric:tabular-nums}
#recordTypeDialog{width:min(440px,calc(100vw - 32px));background:#141c23;border:1px solid #334454;border-radius:24px;padding:20px 22px 24px;color:var(--j-ink);box-shadow:0 25px 60px rgba(0,0,0,0.8)}#recordTypeDialog::backdrop{background:rgba(4,8,12,0.75);backdrop-filter:blur(8px)}.record-type-choices{display:flex;flex-direction:column;gap:9px;margin-top:14px}.type-card{background:#101820;border:1px solid var(--j-border);border-radius:15px;padding:12px 14px;display:flex;align-items:center;gap:13px;cursor:pointer;text-align:left;transition:all 0.15s ease;color:var(--j-ink);width:100%}.type-card:hover{background:#17232d;border-color:#486074;transform:translateY(-1px)}.type-icon-box{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.type-icon-box svg{width:22px;height:22px}.type-text-wrap{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.type-main-title{font-size:15px;font-weight:700;color:#fff;letter-spacing:-0.2px}.type-sub-title{font-size:11.5px;color:var(--j-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.type-chevron{color:var(--j-sub);opacity:0.6;font-size:18px}.tint-energy,.tint-charging,.tint-refueling{background:rgba(129,230,197,0.12);color:#81e6c5}.tint-maint,.tint-maintenance{background:rgba(245,158,11,0.12);color:#f59e0b}.tint-wash,.tint-washing{background:rgba(96,165,250,0.12);color:#60a5fa}.tint-trip{background:rgba(52,211,153,0.12);color:#34d399}.tint-accident{background:rgba(248,113,113,0.12);color:#f87171}.tint-receipt{background:rgba(192,132,252,0.12);color:#c084fc}#receiptSourceDialog{width:min(440px,calc(100vw - 32px));background:#141c23;border:1px solid #334454;border-radius:24px;padding:22px 24px 26px;color:var(--j-ink);box-shadow:0 25px 60px rgba(0,0,0,0.8)}#receiptSourceDialog::backdrop{background:rgba(4,8,12,0.75);backdrop-filter:blur(8px)}.receipt-source-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.receipt-source-card{background:#101820;border:1px solid var(--j-border);border-radius:18px;padding:20px 12px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;cursor:pointer;text-align:center;transition:all 0.18s ease;color:var(--j-ink);width:100%;box-sizing:border-box}.receipt-source-card:hover{background:#17232d;border-color:#486074;transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.35)}.receipt-source-card:active{transform:translateY(0)}.receipt-source-card .type-icon-box{width:48px;height:48px;border-radius:14px}.receipt-source-card .type-icon-box svg{width:26px;height:26px}.receipt-source-text{display:flex;flex-direction:column;align-items:center;gap:4px}.receipt-source-title{font-size:14.5px;font-weight:750;color:#fff;letter-spacing:-0.2px;white-space:nowrap}.receipt-source-desc{font-size:11.5px;color:var(--j-sub);white-space:nowrap}#recordDialog .fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:4px 0 14px;align-items:start}#recordDialog #driveModeField,#recordDialog #tankModeField{display:flex;gap:16px;flex-wrap:wrap}#recordDialog #driveModeField label,#recordDialog #tankModeField label{display:flex;flex-direction:row;align-items:center;gap:6px}#recordDialog input[type=radio]{width:auto}#recordDialog #tankModeField small{flex-basis:100%}#recordDialog .fields label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600;color:var(--j-sub)}#recordDialog .fields input,#recordDialog .fields select,#recordDialog .fields textarea{margin-top:0;background:#0d1318;border:1px solid var(--j-border);border-radius:10px;padding:8px 11px;font-size:13.5px;color:var(--j-ink);min-height:38px;box-sizing:border-box}#recordDialog .fields input:focus,#recordDialog .fields select:focus,#recordDialog .fields textarea:focus{border-color:var(--j-accent);box-shadow:0 0 0 2px rgba(129,230,197,0.15);outline:none}#recordDialog .fields textarea{min-height:54px;line-height:1.45}.photo-pick-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:72px;height:72px;min-height:72px;border-radius:10px;background:#141f27;border:1.5px dashed rgba(255,255,255,0.2);cursor:pointer}.photo-pick-tile span{font-size:11px;font-weight:600}#recordPhotoField{gap:8px}#photoPreview{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-top:6px}.photo-thumb-wrapper{width:70px;height:70px;flex-shrink:0;border-radius:10px;position:relative;overflow:hidden;border:1px solid var(--j-border)}.photo-thumb-wrapper img{width:100%;height:100%;object-fit:cover;display:block}.btn-thumb-remove{position:absolute;top:3px;right:3px;width:18px;height:18px;min-height:18px;padding:0;background:rgba(0,0,0,0.75);color:#fff;border:none;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1}
#vehicleManageDialog .settings-toggle{display:flex;flex-direction:row;align-items:center;gap:8px;margin:12px 0;line-height:1.5}
#vehicleManageDialog .settings-toggle input[type=checkbox]{width:18px;height:18px;min-height:18px;padding:0;margin:0;flex:none;accent-color:var(--j-accent)}
#vehicleManageDialog .settings-backup-row span{min-width:0;overflow-wrap:anywhere}
#vehicleManageDialog .settings-backup-row small{display:block;line-height:1.5;margin-top:4px}
.btn-pin-default{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;min-height:34px;padding:0;border-radius:10px;border:1px solid var(--j-border);background:var(--j-surface);color:var(--j-sub);font-size:15px;cursor:pointer;transition:all 0.15s ease}
.btn-pin-default:hover{border-color:#f6c445;color:#f6c445}
.btn-pin-default.active{background:rgba(246,196,69,0.15);border-color:rgba(246,196,69,0.4);color:#f6c445}

/* 추세 탭: 방문한 충전소·주유소 OpenStreetMap 한반도 지도 & 장소 정보 카드 */
.trends-map-panel{display:flex;flex-direction:column;gap:14px}
.trends-map-header{display:flex;flex-direction:column;gap:4px}
.trends-map-wrapper{position:relative;width:100%;height:420px;border-radius:18px;overflow:hidden;border:1px solid var(--j-border);background:#141c23}
.trends-map-canvas{width:100%;height:100%}
.trends-map-canvas .leaflet-container{background:#141c23;font-family:inherit}
.trends-map-canvas .leaflet-control-zoom a{background:rgba(22,30,37,0.92) !important;color:var(--j-ink) !important;border-color:var(--j-border) !important}
.trends-map-canvas .leaflet-control-zoom a:hover{background:var(--j-raised) !important;color:var(--j-accent) !important}
.trends-map-canvas .leaflet-control-attribution{background:rgba(11,16,20,0.75) !important;color:var(--j-sub) !important;font-size:10px !important;padding:2px 6px !important}
.trends-map-canvas .leaflet-control-attribution a{color:var(--j-sub) !important}
.trends-map-leaflet-marker,.leaflet-div-icon.trends-map-leaflet-marker{background:transparent !important;border:none !important}
.trends-map-reset-btn{position:absolute;top:14px;right:14px;z-index:1001;background:rgba(22,30,37,0.88);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.18);border-radius:8px;color:var(--j-ink);font-size:12.5px;font-weight:600;padding:6px 11px;min-height:auto;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.35);transition:all 0.15s ease}
.trends-map-reset-btn:hover{background:var(--j-surface);border-color:var(--j-accent);color:var(--j-accent)}
.trends-map-dot-wrap{display:flex;align-items:center;justify-content:center;width:30px;height:30px;cursor:pointer}
.trends-map-dot{width:14px;height:14px;border-radius:50%;border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.5);transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.18s ease}
.trends-map-dot-wrap:hover .trends-map-dot,.trends-map-dot-wrap.active .trends-map-dot{transform:scale(1.45);box-shadow:0 0 0 4px rgba(255,255,255,0.5),0 4px 12px rgba(0,0,0,0.6)}
.trends-place-card{position:absolute;bottom:14px;left:14px;right:auto;width:max-content;max-width:min(288px,calc(100% - 28px));z-index:1002;background:rgba(17,24,30,0.94);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.16);border-radius:16px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,0.55);animation:trendsCardFadeIn 0.2s ease-out}
@keyframes trendsCardFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.trends-place-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08)}
.trends-place-title-wrap{display:flex;flex-wrap:wrap;align-items:flex-start;gap:2px 8px;min-width:0;flex:1}
.trends-place-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:5px}
.trends-place-title{font-size:14px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;line-height:1.3;white-space:normal;overflow-wrap:anywhere;flex:1 1 0;min-width:0}
.trends-place-kind{flex:0 0 100%;margin:0 0 0 18px;font-size:12px;color:var(--j-sub);white-space:nowrap}
.trends-place-close-btn{background:transparent;border:0;color:var(--j-sub);font-size:20px;line-height:1;padding:2px 6px;min-height:auto;cursor:pointer;border-radius:6px}
.trends-place-close-btn:hover{color:#ffffff;background:rgba(255,255,255,0.1)}
.trends-place-stats-grid{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px}
.trends-place-stat-line{font-size:13px;color:var(--j-sub);white-space:nowrap}
.trends-place-stat-line b{font-size:15px;color:#ffffff;font-variant-numeric:tabular-nums}
.trends-place-ledger-btn{min-height:0;height:30px;padding:0 10px;margin-left:auto;flex:none;border-radius:999px;border:1px solid var(--j-accent);background:rgba(129,230,197,.12);color:var(--j-accent);font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer}
.ledger-place-chip{display:inline-flex;align-items:center;gap:8px;min-height:34px;box-sizing:border-box;max-width:100%;padding:4px 6px 4px 12px;border:1px solid var(--j-border);border-radius:9px;background:var(--j-surface);font-weight:650}
.ledger-place-chip-label{min-width:0;overflow-wrap:anywhere}
.ledger-place-chip-value{margin-left:8px;color:var(--j-accent);font-size:.92em}
.ledger-place-chip button{flex:none;min-height:24px;width:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--j-sub);cursor:pointer;font-size:13px}
.trends-place-stat-item{display:flex;flex-direction:column;gap:2px}
.trends-place-stat-label{font-size:12px;color:var(--j-sub);font-weight:500}
.trends-place-stat-val{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;color:#ffffff}
@media(max-width:600px){
  .trends-map-wrapper{height:350px}
  .trends-place-card{bottom:10px;left:10px;max-width:min(288px,calc(100% - 20px));padding:10px 12px}
}

/* 백업 상태 탭 스타일 */
.backup-status-wrap{display:flex;flex-direction:column;gap:14px}
.backup-overview-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;background:var(--j-surface);border:1px solid var(--j-border);border-radius:14px}
.backup-overview-left{display:flex;align-items:center;gap:14px;min-width:0}
.backup-overview-icon-wrap{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.backup-overview-info{display:flex;flex-direction:column;gap:3px;min-width:0}
.backup-overview-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.backup-overview-title{font-size:15px;font-weight:700;color:var(--j-ink)}
.backup-overview-desc{font-size:12.5px;color:var(--j-sub);margin:0;line-height:1.4}
.backup-overview-quick{display:flex;flex-direction:column;gap:5px;flex-shrink:0;text-align:right;border-left:1px solid var(--j-border);padding-left:16px}
.backup-quick-item{display:flex;align-items:center;gap:8px;justify-content:flex-end;font-size:12px}
.backup-quick-item .quick-label{color:var(--j-sub)}
.backup-quick-item .quick-val{font-weight:600;color:var(--j-ink)}

.backup-status-badge{font-size:11.5px;font-weight:650;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:5px;line-height:1.35;white-space:nowrap}
.backup-status-badge.pill-success,.backup-overview-icon-wrap.pill-success{background:rgba(129,230,197,0.12);color:var(--j-accent);border:1px solid rgba(129,230,197,0.28)}
.backup-status-badge.pill-warning,.backup-overview-icon-wrap.pill-warning{background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.28)}
.backup-status-badge.pill-info,.backup-overview-icon-wrap.pill-info{background:rgba(123,182,255,0.12);color:#7bb6ff;border:1px solid rgba(123,182,255,0.28)}
.backup-status-badge.pill-error,.backup-overview-icon-wrap.pill-error{background:rgba(255,92,92,0.12);color:#ff5c5c;border:1px solid rgba(255,92,92,0.28)}
.backup-status-badge.pill-neutral,.backup-overview-icon-wrap.pill-neutral{background:rgba(148,163,184,0.12);color:#94a3b8;border:1px solid rgba(148,163,184,0.28)}

.backup-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.backup-card{background:var(--j-surface);border:1px solid var(--j-border);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;transition:border-color 0.2s ease,box-shadow 0.2s ease}
.backup-card:hover{border-color:rgba(129,230,197,0.35);box-shadow:0 3px 10px rgba(0,0,0,0.25)}
.backup-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.backup-card-title-wrap{display:flex;align-items:flex-start;gap:7px;min-width:0;flex:1}
.backup-card-icon{color:var(--j-accent);display:flex;align-items:center;flex-shrink:0;margin-top:1px}
.backup-card-title{font-size:13px;font-weight:650;color:var(--j-ink);word-break:keep-all;line-height:1.35}
.backup-card-body{margin:2px 0}
.backup-card-value{font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;font-variant-numeric:tabular-nums;word-break:keep-all;line-height:1.35}
.backup-card-footer{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:5px;border-top:1px dashed rgba(255,255,255,0.06)}
.backup-card-entity{font-size:10.5px;font-family:monospace;color:var(--j-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.backup-guide-card{background:rgba(129,230,197,0.04);border:1px solid rgba(129,230,197,0.2);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.backup-guide-header{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.backup-guide-title-wrap{display:flex;align-items:center;gap:7px}
.backup-guide-icon{color:var(--j-accent);display:flex;align-items:center}
.backup-guide-title{font-size:14px;font-weight:750;color:var(--j-ink)}
.backup-guide-btn{background:var(--j-accent) !important;color:#07221b !important;border:0 !important;font-size:12px !important;font-weight:700 !important;padding:5px 12px !important;min-height:28px !important;border-radius:7px !important;cursor:pointer;transition:all 0.15s ease;flex-shrink:0}
.backup-guide-btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
.backup-guide-text{font-size:12.5px;color:var(--j-sub);line-height:1.5;margin:0}
.backup-guide-text strong{color:var(--j-ink);font-weight:600}

.backup-empty-card{background:var(--j-surface);border:1px dashed var(--j-border);border-radius:14px;padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.backup-empty-icon{color:var(--j-sub);margin-bottom:2px}
.backup-empty-card h4{margin:0;font-size:15px;color:var(--j-ink)}

@media(max-width:600px){
  .backup-overview-banner{flex-direction:column;align-items:stretch;gap:10px;padding:12px;width:100%;box-sizing:border-box}
  .backup-overview-quick{border-left:none;border-top:1px solid var(--j-border);padding-left:0;padding-top:8px;text-align:left;width:100%;display:flex;flex-direction:column;gap:6px}
  .backup-quick-item{display:flex;justify-content:space-between;align-items:center;width:100%;font-size:12px}
  .backup-grid{grid-template-columns:1fr;gap:8px;width:100%}
  .backup-card{padding:10px 12px;width:100%;box-sizing:border-box}
  .backup-card-value{font-size:14px}
  .backup-guide-card{padding:12px;width:100%;box-sizing:border-box}
  .backup-guide-header{flex-direction:column;align-items:flex-start;gap:8px}
  .backup-guide-btn{width:100%;justify-content:center}
}

/* Record forms: constrain intrinsic date widths and keep result rows unshrunk. */
#recordDialog .fields{grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;width:100%}
#recordDialog .fields>*,#recordDialog .fields label{min-width:0;max-width:100%}
#recordDialog .fields input:not([type=radio]):not([type=checkbox]),#recordDialog .fields select,#recordDialog .fields textarea{min-width:0;max-width:100%;width:100%;box-sizing:border-box}
#recordDialog input[type=date],#recordDialog input[type=datetime-local]{appearance:none;-webkit-appearance:none;display:block;min-inline-size:0;inline-size:100%}
#recordDialog input[type=date]::-webkit-date-and-time-value{min-width:0;text-align:left}
#recordDialog .modal-scroll-body{min-width:0;max-width:100%}
#recordDialog #recordError:empty{display:none}
#recordDialog #recordError{margin:0 0 12px;overflow-wrap:anywhere}
#recordDialog #placeResults{min-width:0;max-width:100%;overscroll-behavior:contain}
#recordDialog .place-result-item{flex:0 0 auto!important;min-height:max-content!important}
#recordDialog .place-result-name,#recordDialog .place-result-addr{min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere}
#recordDialog .loc-header-title-wrap{flex:1;min-width:0}
#recordDialog .loc-summary-pill{min-width:0}
@media(max-width:440px){#recordDialog .fields{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}#recordDialog #dateField{grid-column:1 / -1}#recordDialog .fields>label:not(.fullfield):not(#dateField){display:flex;flex-direction:column;gap:5px;align-content:start;line-height:1.45}#recordDialog .modal-header-row{padding:14px 16px}#recordDialog .modal-scroll-body{padding:16px}#recordDialog .loc-header-title-wrap{flex-wrap:wrap}#recordDialog .loc-summary-pill{max-width:100%}}

.btn-record-purge{color:#ff8585!important;border-color:#704047!important}

#recordDialog[data-mode=trip] #dateField,#recordDialog[data-mode=trip] #odometerField{grid-column:1 / -1}

/* Receipt OCR Loading Overlay & Auto-fill styles */
.receipt-ocr-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(14, 21, 27, 0.96);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  opacity: 1;
  transition: opacity 0.3s ease;
}
.receipt-ocr-overlay[hidden] {
  display: none !important;
}
.ocr-overlay-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}
.ocr-graphic-wrap {
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ocr-icon-box {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.ocr-icon-box svg {
  width: 32px;
  height: 32px;
}
.ocr-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 22px;
  border: 1.5px solid rgba(192, 132, 252, 0.4);
  animation: ocrPulse 2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
  pointer-events: none;
}
@keyframes ocrPulse {
  0% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.18); opacity: 0; }
  100% { transform: scale(0.9); opacity: 0; }
}
.ocr-scan-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, #81e6c5, transparent);
  box-shadow: 0 0 8px #81e6c5;
  top: 0;
  animation: ocrScan 1.6s ease-in-out infinite alternate;
}
@keyframes ocrScan {
  0% { top: 4px; opacity: 0.2; }
  50% { opacity: 1; }
  100% { top: 56px; opacity: 0.2; }
}
.ocr-step-dots {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.ocr-step-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.25s ease;
}
.ocr-step-dot.active {
  background: #81e6c5;
  box-shadow: 0 0 8px rgba(129, 230, 197, 0.6);
  transform: scale(1.2);
}
.ocr-step-line {
  width: 18px;
  height: 1.5px;
  background: rgba(255, 255, 255, 0.15);
}
.ocr-status-text {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.2px;
  margin: 0;
  min-height: 22px;
}
.ocr-cancel-btn {
  margin-top: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--j-border);
  color: var(--j-sub);
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.ocr-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
.receipt-notice-banner {
  background: rgba(129, 230, 197, 0.1);
  border: 1px solid rgba(129, 230, 197, 0.3);
  border-radius: 10px;
  padding: 9px 12px;
  margin-bottom: 12px;
  font-size: 12.5px;
  color: #81e6c5;
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.4;
}
.auto-filled {
  border-color: #81e6c5 !important;
  background: rgba(129, 230, 197, 0.06) !important;
  box-shadow: 0 0 0 1px rgba(129, 230, 197, 0.25) !important;
}
.auto-filled-badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  width: fit-content;
  max-width: fit-content;
  box-sizing: border-box;
  font-size: 10px;
  font-weight: 700;
  color: #81e6c5;
  background: rgba(129, 230, 197, 0.15);
  border: 1px solid rgba(129, 230, 197, 0.35);
  border-radius: 9999px;
  padding: 1.5px 7px;
  margin-top: 3px;
  line-height: 1.35;
  letter-spacing: -0.2px;
}
.loc-auto-filled {
  border-color: #81e6c5 !important;
  background: rgba(129, 230, 197, 0.04) !important;
}


/* 위치 지정 UI: 1 찾기 → 2 핀 확인 → 3 이름 정하기 */
.loc-step{display:flex;flex-direction:column;gap:8px}
.loc-step-head{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--j-ink)}
.loc-step-no{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--j-accent);color:#0b1014;font-size:12px;font-weight:800;flex-shrink:0}
.loc-step-hint{font-size:12px;color:var(--j-sub);line-height:1.45}.loc-step-hint b{color:var(--j-ink)}
.btn-loc-pin-link{align-self:flex-start;background:transparent!important;border:1px dashed var(--j-border)!important;color:var(--j-blue)!important;font-size:13px!important;font-weight:700;padding:8px 12px!important;min-height:36px!important;height:auto!important;border-radius:10px!important;cursor:pointer}
.loc-map-hint{padding:8px 10px;border-radius:8px;background:var(--j-blue-bg);color:var(--j-ink);font-size:12.5px;line-height:1.45}
#recordDialog .loc-search-row{flex-wrap:nowrap!important}#recordDialog .loc-search-row #placeQuery{flex:1 1 0!important;min-width:0}#recordDialog .loc-search-row .btn-loc-search{flex:0 0 auto!important;min-width:64px}
.selected-loc-section{background:var(--j-surface);border-color:var(--j-border);border-style:dashed}
.selected-loc-section.has-loc{background:rgba(129,230,197,.07);border:1px solid rgba(129,230,197,.4)}
.selected-loc-badge{display:flex;align-items:center;gap:6px;text-transform:none;color:var(--j-sub)}.selected-loc-section.has-loc .selected-loc-badge{color:var(--j-accent)}
.loc-state-dot{width:8px;height:8px;border-radius:50%;background:var(--j-border)}.selected-loc-section.has-loc .loc-state-dot{background:var(--j-accent)}
.selected-loc-name-title em{font-style:normal;font-weight:500;font-size:12px;color:var(--j-sub);margin-left:4px}
.loc-name-state-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.loc-name-state{font-size:12.5px;line-height:1.4;color:var(--j-sub)}.loc-name-state[data-state=auto]{color:var(--j-accent)}.loc-name-state[data-state=manual]{color:var(--j-blue)}.loc-name-state[data-state=warn]{color:#ffb454}
.btn-loc-name-reset{background:transparent!important;border:1px solid var(--j-border)!important;color:var(--j-ink)!important;font-size:12px!important;padding:4px 10px!important;min-height:28px!important;height:auto!important;border-radius:8px!important;cursor:pointer}.btn-loc-name-reset[hidden]{display:none!important}

/* 영수증 업로드 대기 신규 팝업 */
.receipt-waiting-dialog {
  border: 1px solid var(--j-border);
  border-radius: 24px;
  background: rgba(14, 21, 27, 0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--j-ink);
  padding: 0;
  max-width: 340px;
  width: 88%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
}
.receipt-waiting-dialog::backdrop {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.receipt-waiting-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 24px 28px;
  gap: 12px;
  box-sizing: border-box;
}
.receipt-waiting-title {
  font-size: 16.5px;
  font-weight: 750;
  color: #fff;
  letter-spacing: -0.3px;
  margin: 4px 0 0;
}
.receipt-waiting-desc {
  font-size: 13.5px;
  color: var(--j-sub);
  margin: 0;
  line-height: 1.45;
}
.receipt-waiting-actions {
  margin-top: 14px;
  width: 100%;
  display: flex;
  justify-content: center;
}
.btn-waiting-cancel {
  width: 100%;
  max-width: 160px;
  min-height: 40px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--j-border);
  color: var(--j-sub);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-waiting-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
.receipt-source-footer {
  display: flex;
  justify-content: center;
  padding: 10px 20px 18px;
}
.btn-source-cancel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--j-border);
  color: var(--j-sub);
  border-radius: 10px;
  padding: 8px 24px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-source-cancel:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
@media(min-width:851px){
  #recordDialog .fields textarea[name="memo"]{height:180px}
}

 #page2 .savings-hero{display:flex;flex-direction:column;gap:24px;min-height:450px}
 #page2 .savings-result{flex:1;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:18px 0}
 #page2 #comparisonContext{font-size:20px;font-weight:600;line-height:1.5;margin:0;color:var(--j-sub)}
 #page2 .savings-result .compare-value{padding:0;margin:0}
 #page2 #distanceValue,#page2 #priceValue,#page2 #economyValue{color:var(--j-sub);font-weight:inherit}
 #page2 .selected-number{color:var(--j-accent,#81e6c5);font-size:1.22em;font-weight:750;font-variant-numeric:tabular-nums}
 #page2 #distanceInput{color:var(--j-accent,#81e6c5);font-weight:750}
 #page2 .slider-limits{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--j-sub);opacity:.6;line-height:1.4;margin:14px 0 5px;font-variant-numeric:tabular-nums}
 #page2 .distance-choices{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 12px}
 #page2 .distance-choices button{border-radius:10px;padding:8px 11px;white-space:nowrap}
 #page2 .distance-choices button[aria-pressed=true]{background:#81e6c5;color:#102c24;border-color:#81e6c5}
 #page2 .manual-distance{display:flex;align-items:center;gap:8px;margin:10px 0}
 #page2 .manual-distance[hidden]{display:none}
 #page2 .manual-distance input{min-width:0;flex:1;width:100%;text-align:right}
 @media(max-width:760px){#page2 #comparisonContext{font-size:18px}#page2 .savings-hero{min-height:400px}}

`;


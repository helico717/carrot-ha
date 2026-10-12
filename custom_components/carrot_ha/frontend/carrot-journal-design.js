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
      padding: 30px;
      min-width: 0;
      width: 100%;
    }
    @media(max-width:600px){
      .shell{
        padding: 16px 16px 32px;
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
        flex-wrap: nowrap;
      }
      .title-controls-row h2 {
        font-size: 21.5px;
        flex-shrink: 0;
      }
      .select-pill, .date-pill {
        font-size: 13.5px;
        padding: 6px 8px;
        flex: 1;
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
        padding: 18px 16px;
        border-radius: 20px;
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
        padding: 22px 18px 24px;
        border-radius: 22px;
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
    .cost-list .list-row:last-child {
      border-bottom: 0;
    }
    .cost-list .list-row.cost-row:last-of-type {
      border-bottom: 0;
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
      margin-top: 4px;
      padding-top: 10px !important;
      padding-bottom: 2px !important;
      border-top: 1px solid var(--j-border);
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
    dialog#recordDialog {
      color: var(--j-ink);
      background: #141c23;
      border: 1px solid #334454;
      border-radius: 24px;
      width: min(580px, calc(100% - 24px));
      padding: 24px 26px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
      position: fixed;
      inset: 0;
      margin: auto;
      z-index: 2000;
    }
    dialog#recordDialog::backdrop {
      background: rgba(4, 8, 12, 0.75);
      backdrop-filter: blur(8px);
    }
    .modal-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--j-border);
    }
    .modal-close-btn {
      background: var(--j-surface);
      border: 1px solid var(--j-border);
      color: var(--j-sub);
      font-size: 14.5px;
      font-weight: 600;
      padding: 6px 14px;
      min-height: 32px;
      border-radius: 8px;
    }
    .modal-close-btn:hover {
      color: var(--j-ink);
      border-color: #486074;
    }
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
      font-size: 13.5px;
      display: block;
      line-height: 1.35;
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
    .ledger-table{table-layout:fixed;min-width:760px}
    .ledger-date-col{width:14%}.ledger-memo-col{width:49%}.ledger-value-col{width:13%}.ledger-actions-col{width:24%}
    .ledger-table td{overflow-wrap:anywhere;vertical-align:middle}
    .ledger-table .memo-text-col{min-width:0}
    #page3 .ledger-table td:last-child{white-space:normal}
    .ledger-table .btn-table-action{margin-bottom:4px}
    @media(max-width:760px){
      #page3 .table-wrap{overflow:visible}
      #page3 .ledger-table{display:block;min-width:0;table-layout:auto;margin-top:8px}
      #page3 .ledger-table colgroup{display:none}
      #page3 .ledger-table thead{display:block}
      #page3 .ledger-table thead tr{display:flex;justify-content:flex-end}
      #page3 .ledger-table thead th{display:none}
      #page3 .ledger-table thead #ledgerAmountHeader{display:block;padding:8px 0;font-size:12px;border:0}
      #page3 .ledger-table tbody{display:block}
      #page3 .ledger-table tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'memo amount' 'date date' 'actions actions';gap:8px 12px;padding:18px 0;border-bottom:1px solid var(--j-border)}
      #page3 .ledger-table td{display:block;padding:0;border:0;min-width:0}
      #page3 .ledger-table td:nth-child(1){grid-area:date;font-size:12px;color:var(--j-sub)}
      #page3 .ledger-table td:nth-child(1) small{display:inline;margin-left:6px}
      #page3 .ledger-table td:nth-child(2){grid-area:memo}
      #page3 .ledger-table td:nth-child(3){grid-area:amount;align-self:center;text-align:right;font-size:17px;font-weight:750;white-space:nowrap;color:var(--j-ink)}
      #page3 #ledgerSort{color:var(--j-sub)}
      #page3 .ledger-table td:nth-child(4){grid-area:actions;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      #page3 .ledger-table .memo-cell-wrap{gap:8px;align-items:flex-start}
      #page3 .ledger-table .memo-cat-title{font-size:14px;line-height:1.5;font-weight:700}
      #page3 .ledger-table .memo-desc{font-size:12px;line-height:1.5}
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
    .ledger-filters{display:flex;align-items:flex-start;flex-wrap:wrap;gap:12px;margin:16px 0 20px}
    .ledger-dropdown{position:relative;max-width:100%}
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

.shell{max-width:1280px;margin:auto}
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
.title-controls-row .select-pill,.title-controls-row .date-pill{width:auto;max-width:180px}
.date-navigation{display:grid;grid-template-columns:36px minmax(0,180px) 36px auto;align-items:center;gap:6px;max-width:100%;min-width:0}
.date-navigation .date-pill{box-sizing:border-box;min-width:0;width:100%;max-width:180px}
.date-step,.date-current{box-sizing:border-box;min-height:38px;border:1px solid var(--j-border);border-radius:10px;background:var(--j-surface);color:var(--j-ink);cursor:pointer}
.date-step{padding:0;font-size:25px;line-height:1}
.date-current{padding:6px 10px;font-size:14px;white-space:nowrap;color:var(--j-accent);font-weight:750}
.date-step:hover,.date-current:hover{border-color:var(--j-accent)}
.date-step:disabled{opacity:.35;cursor:not-allowed;transform:none;border-color:var(--j-border)}
.date-step:focus-visible,.date-current:focus-visible{outline:3px solid var(--j-blue);outline-offset:2px}
@media(max-width:600px){.date-navigation{grid-template-columns:30px minmax(0,145px) 30px auto;gap:4px}.date-navigation .date-pill{padding:7px 5px}.date-current{padding:6px;font-size:13px}}
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
.trend-badge-icon { font-size: 17.5px; line-height: 1; }
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

.card-settings-top{display:flex;justify-content:flex-end;margin-bottom:12px}.card-settings-top[hidden]{display:none}#vehicleManageDialog{width:980px;max-width:calc(100vw - 32px);height:min(760px,calc(100dvh - 40px));max-height:calc(100dvh - 40px);padding:0;overflow:hidden}.settings-dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:24px 28px 18px;border-bottom:1px solid var(--j-border)}.settings-dialog-header h2{margin:0}.settings-dialog-header p{margin:6px 0 0}.settings-layout{display:grid;grid-template-columns:180px minmax(0,1fr);height:calc(100% - 150px);min-height:0}.settings-nav{display:flex;flex-direction:column;gap:8px;padding:20px 12px;border-right:1px solid var(--j-border);overflow:auto;background:var(--j-raised)}.settings-nav button{text-align:left;padding:12px;white-space:normal;line-height:1.45;border-color:transparent;background:transparent}.settings-nav button.active{color:var(--j-mint,#81e6c5);background:#81e6c514;border-color:#81e6c544}.settings-content{min-width:0;overflow:auto;padding:24px}.settings-content h3{margin:0 0 12px;font-size:20px}.settings-section{border:1px solid var(--j-border);border-radius:14px;padding:18px;margin:16px 0}.settings-section h4{margin:0 0 12px;font-size:17px}.settings-key-field{display:flex;align-items:center;gap:8px;margin-top:8px}.settings-key-field input{min-width:0;width:100%;font-family:monospace}.settings-key-field button{flex-shrink:0}.settings-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.settings-backup-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid var(--j-border)}.settings-backup-row span{min-width:0;overflow-wrap:anywhere}.settings-message{min-height:32px;padding:8px 24px;margin:0;border-top:1px solid var(--j-border);color:var(--j-sub);font-size:14px}#vehicleManageList .row{flex-wrap:wrap}#vehicleManageList small{display:block;margin:10px 0}@media(max-width:600px){#vehicleManageDialog{max-width:calc(100vw - 16px);height:calc(100dvh - 24px);max-height:calc(100dvh - 24px)}.settings-dialog-header{padding:16px}.settings-dialog-header h2{font-size:21px}.settings-dialog-header p{font-size:12px}.settings-layout{grid-template-columns:84px minmax(0,1fr);height:calc(100% - 142px)}.settings-nav{padding:12px 6px;gap:6px}.settings-nav button{padding:10px 6px;font-size:12px}.settings-content{padding:14px 10px}.settings-content h3{font-size:17px}.settings-section{padding:12px}.settings-backup-row{flex-direction:column;align-items:flex-start}.settings-message{padding:8px 16px}.settings-key-field{flex-wrap:wrap}.settings-key-field input{flex-basis:100%}}

.card-settings-top{align-items:center;justify-content:space-between}.card-settings-top h2{font-size:25.5px;margin:0;white-space:nowrap;letter-spacing:-0.5px}
#vehicleManageDialog[open]{display:grid;grid-template-rows:auto minmax(0,1fr) auto}
#vehicleManageDialog{box-sizing:border-box;margin:auto;width:980px;max-width:calc(100vw - 40px);height:min(760px,calc(100dvh - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));max-height:calc(100dvh - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))}
.settings-layout{height:auto;overflow:hidden}.settings-nav button{text-align:center}.settings-message{overflow-wrap:anywhere;max-height:90px;overflow:auto;box-sizing:border-box}
#vehicleManageDialog button{min-height:38px;font-size:13px;padding:8px 12px;border-radius:10px}
#vehicleManageDialog input,#vehicleManageDialog select{padding:8px 10px;min-height:40px;box-sizing:border-box}
.settings-key-help{display:block;color:var(--j-sub);font-size:12px;line-height:1.6;margin-top:8px;overflow-wrap:anywhere}
@media(max-width:600px){.card-settings-top h2{font-size:21.5px}#vehicleManageDialog{max-width:calc(100vw - 32px)}.settings-layout{height:auto;grid-template-columns:80px minmax(0,1fr)}#vehicleManageDialog .settings-nav button{font-size:12px;padding:8px 4px}#vehicleManageDialog input,#vehicleManageDialog select{font-size:16px}.settings-dialog-header{padding:14px 12px}.settings-dialog-header p{line-height:1.5}.settings-content{padding:14px 10px}.settings-section{padding:10px}.settings-key-field input{flex-basis:100%}}
.ledger-category-location{display:flex;align-items:center;gap:8px;min-width:0}.ledger-place-name{font-weight:400;overflow-wrap:anywhere;min-width:0;line-height:1.5}.ledger-category-location .cat-highlight-pill{flex-shrink:0}
#vehicleManageDialog button{min-height:27px;font-size:13px;padding:5px 8px;border-radius:7px}#vehicleManageDialog .settings-nav button{font-size:inherit;padding:6px 3px}.vehicle-trashed label,.vehicle-trashed small,.vehicle-trashed.settings-backup-row span,.vehicle-trashed [data-title],.vehicle-trashed [data-fuel],#vehicleManageDialog .vehicle-delete{color:#ff8585}.vehicle-trashed{border-color:#ff858544}
#recordTypeDialog{width:400px;max-width:calc(100vw - 40px);padding:24px}.record-type-choices{display:flex;flex-direction:column;gap:8px}.record-type-choices button{display:flex;align-items:center;gap:16px;text-align:left;padding:14px 16px;font-size:17px}.record-type-choices button span{font-size:24px}#recordDialog[data-mode]:not([data-mode="maintenance"]) .fields{display:flex;flex-direction:column;gap:20px}#recordDialog #driveModeField,#recordDialog #tankModeField{display:flex;gap:16px;flex-wrap:wrap}#recordDialog #driveModeField label,#recordDialog #tankModeField label{display:flex;flex-direction:row;align-items:center;gap:6px}#recordDialog input[type=radio]{width:auto}#recordDialog #tankModeField small{flex-basis:100%}#recordDialog{max-height:calc(100dvh - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));max-width:calc(100vw - 32px)}
.photo-pick-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:90px;height:90px;font-size:24px}.photo-pick-tile span{font-size:14px}#recordPhotoField{gap:10px}
#recordDialog[data-mode]:not([data-mode="maintenance"]) #recordForm>.row.spaced{position:sticky;top:0;background:var(--j-surface);z-index:2;padding-bottom:12px}#recordDialog[data-mode]:not([data-mode="maintenance"]) #save{padding:8px 12px;min-height:38px}
#vehicleManageDialog .settings-toggle{display:flex;flex-direction:row;align-items:center;gap:8px;margin:12px 0;line-height:1.5}
#vehicleManageDialog .settings-toggle input[type=checkbox]{width:18px;height:18px;min-height:18px;padding:0;margin:0;flex:none;accent-color:var(--j-accent)}
#vehicleManageDialog .settings-backup-row span{min-width:0;overflow-wrap:anywhere}
#vehicleManageDialog .settings-backup-row small{display:block;line-height:1.5;margin-top:4px}
.btn-pin-default{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;min-height:34px;padding:0;border-radius:10px;border:1px solid var(--j-border);background:var(--j-surface);color:var(--j-sub);font-size:15px;cursor:pointer;transition:all 0.15s ease}
.btn-pin-default:hover{border-color:#f6c445;color:#f6c445}
.btn-pin-default.active{background:rgba(246,196,69,0.15);border-color:rgba(246,196,69,0.4);color:#f6c445}
`;

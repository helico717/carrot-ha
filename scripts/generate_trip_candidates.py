"""
Generate preview/trip_candidates/index.html with:
- 24H driving timeline bar placed EXACTLY where the user circled in red:
  Inside the '최근 주행' (Recent Trips) right panel, directly between the 7-day date selector and the 2x4 trip cards!
- 30-minute merge threshold.
- Interactive synchronization: 24H timeline bar <-> 2x4 grid cards <-> Leaflet map.
- 2x4 grid (max 8 per page) with pagination.
- Toned-down, sleek Start SoC -> End SoC flow.
"""
import os

HTML_CONTENT = r'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Carrot HA · [주행] 탭 (24H 타임라인 우측 패널 내장 & 30분 병합 2x4 페이징)</title>
<link rel="stylesheet" href="../../custom_components/carrot_ha/frontend/carrot-assets/leaflet.css">
<style>
  :root {
    --bg: #07090b;
    --card-bg: #0c0e10;
    --panel-bg: #131618;
    --surface: #181b1d;
    --surface-hover: #222629;
    --line: #23272a;
    --ink: #f3f4f4;
    --muted: #959b9e;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --green: #72df9b;
    --green-bg: rgba(114, 223, 155, 0.14);
    --orange: #ff8a18;
    --cyan: #38bdf8;
    --cyan-bg: rgba(56, 189, 248, 0.12);
    --red: #f87171;
    font-family: Pretendard, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color-scheme: dark;
  }

  body.light {
    --bg: #eef2f5;
    --card-bg: #f8fafb;
    --panel-bg: #ffffff;
    --surface: #e9eef2;
    --surface-hover: #dfe5ea;
    --line: #d4dce2;
    --ink: #19252c;
    --muted: #5e6c75;
    --accent: #1260e8;
    --accent-hover: #0c4cbd;
    --green: #15803d;
    --green-bg: #dcfce7;
    --orange: #c25e00;
    --cyan: #0284c7;
    --cyan-bg: #e0f2fe;
    color-scheme: light;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    padding: 14px 20px 80px;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
  }

  /* -------------------------------------------------------------
     TOP PREVIEW TOOLBAR
     ------------------------------------------------------------- */
  .preview-top-toolbar {
    max-width: 1440px;
    margin: 0 auto 14px;
    background: var(--panel-bg);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 10px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .preview-toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .preview-pill {
    background: #1e3a8a;
    color: #93c5fd;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 9px;
    border-radius: 20px;
  }
  .preview-title {
    font-size: 13.5px;
    font-weight: 750;
    margin: 0;
  }
  .preview-toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-toggle-group {
    display: inline-flex;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 2px;
    gap: 2px;
  }
  .btn-toggle-group button {
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 11.5px;
    font-weight: 600;
    padding: 5px 11px;
    border-radius: 7px;
    cursor: pointer;
    transition: all .15s ease;
  }
  .btn-toggle-group button:hover { color: var(--ink); }
  .btn-toggle-group button.active {
    background: var(--accent);
    color: #fff;
  }

  /* 30-min Merge Notice Banner */
  .merge-info-banner {
    max-width: 1440px;
    margin: 0 auto 14px;
    background: rgba(37,99,235,0.08);
    border: 1px solid rgba(37,99,235,0.25);
    border-radius: 14px;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
  }
  .merge-info-text b { color: #60a5fa; }
  .merge-toggle-btn {
    border: 1px solid var(--accent);
    background: var(--accent-light);
    color: #93c5fd;
    font-size: 11.5px;
    font-weight: 750;
    padding: 5px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all .15s ease;
  }
  .merge-toggle-btn.active {
    background: var(--accent);
    color: #fff;
  }

  /* -------------------------------------------------------------
     DEVICE FRAME
     ------------------------------------------------------------- */
  .device-outer-frame {
    width: 100%;
    margin: 0 auto;
    transition: max-width .3s ease;
  }
  .device-outer-frame.desktop-mode {
    max-width: 1440px;
  }
  .device-outer-frame.mobile-mode {
    max-width: 414px;
    background: #000;
    border: 12px solid #23272d;
    border-radius: 46px;
    box-shadow: 0 25px 70px rgba(0,0,0,0.65);
    padding: 12px 0 20px;
    overflow: hidden;
  }
  .mobile-speaker-notch {
    display: none;
    width: 110px;
    height: 18px;
    background: #181b20;
    border-radius: 12px;
    margin: 0 auto 12px;
  }
  .device-outer-frame.mobile-mode .mobile-speaker-notch {
    display: block;
  }

  /* -------------------------------------------------------------
     CARROT HA DASHBOARD
     ------------------------------------------------------------- */
  .ha-card {
    display: block;
    background: var(--card-bg);
    border: 1px solid var(--line);
    border-radius: 26px;
    overflow: hidden;
    color: var(--ink);
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  }
  .device-outer-frame.mobile-mode .ha-card {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  /* Top Bar */
  .top {
    padding: 24px 28px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .device-outer-frame.mobile-mode .top {
    padding: 16px 18px 10px;
  }
  .brand {
    font-size: 11px;
    letter-spacing: 2.5px;
    color: var(--muted);
    font-weight: 700;
  }
  .top h1 {
    margin: 4px 0 0;
    font-size: 27px;
    font-weight: 850;
    letter-spacing: -0.8px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #181b1d;
    padding: 7px 13px;
    border-radius: 30px;
    font-size: 12px;
    color: #e0e3e5;
    white-space: nowrap;
    border: 1px solid #2b2e31;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* Nav Tabs */
  .nav {
    display: flex;
    gap: 5px;
    margin: 0 28px 18px;
    padding: 5px;
    background: #181b1d;
    border-radius: 14px;
  }
  body.light .nav { background: #e9eef2; }
  .device-outer-frame.mobile-mode .nav { margin: 0 16px 14px; }
  .nav button {
    flex: 1;
    border: 0;
    border-radius: 10px;
    background: transparent;
    padding: 11px 6px;
    font-size: 13px;
    font-weight: 650;
    color: var(--muted);
    cursor: pointer;
  }
  .nav button.active {
    background: #303538;
    color: white;
  }
  body.light .nav button.active {
    background: #ffffff;
    color: #19252c;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }

  .main { padding: 0 28px 24px; }
  .device-outer-frame.mobile-mode .main { padding: 0 14px 20px; }

  /* 4 KPI Blue Tiles */
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }
  @media (max-width: 800px) {
    .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  }
  .device-outer-frame.mobile-mode .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .metric {
    border: 1px solid #1a2f4c;
    border-radius: 18px;
    background: linear-gradient(145deg, #132742 0%, #0d1a2d 100%);
    padding: 16px 18px;
    min-width: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  body.light .metric {
    background: linear-gradient(145deg, #e3edf8 0%, #d4e4f5 100%);
    border-color: #bad0ea;
  }
  .metric-icon {
    font-size: 18px;
    margin-bottom: 8px;
    display: inline-block;
    color: #60a5fa;
  }
  .label {
    display: block;
    font-size: 12px;
    color: #93c5fd;
    margin-bottom: 6px;
    font-weight: 600;
  }
  body.light .label { color: #1e40af; }
  .metric strong {
    font-size: 26px;
    font-weight: 850;
    letter-spacing: -0.6px;
    display: block;
    color: #ffffff;
  }
  body.light .metric strong { color: #0f172a; }
  .metric small {
    font-size: 13px;
    margin-left: 4px;
    font-weight: 550;
    color: #93c5fd;
  }
  body.light .metric small { color: #3b82f6; }

  /* -------------------------------------------------------------
     SPLIT 2-COLUMN LAYOUT (.layout)
     ------------------------------------------------------------- */
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(460px, 1fr);
    gap: 18px;
    align-items: start;
  }
  @media (max-width: 980px) {
    .layout { grid-template-columns: 1fr; }
  }
  .device-outer-frame.mobile-mode .layout {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .panel {
    background: var(--panel-bg);
    border: 1px solid var(--line);
    border-radius: 20px;
    overflow: hidden;
  }
  .paneltitle {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid var(--line);
  }
  .paneltitle h2 {
    font-size: 15.5px;
    font-weight: 800;
    margin: 0;
  }
  .sub {
    color: var(--muted);
    font-size: 12px;
  }

  /* Left Panel Map */
  .map-container {
    position: relative;
    width: 100%;
    height: 480px;
    background: #14191c;
  }
  .device-outer-frame.mobile-mode .map-container {
    height: 250px;
  }
  #trip-map { width: 100%; height: 100%; }
  .map-fullscreen-btn {
    position: absolute;
    bottom: 14px;
    right: 14px;
    z-index: 999;
    background: #1c2024;
    border: 1px solid #32383e;
    color: #fff;
    font-size: 11.5px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  .route-caption {
    padding: 14px 20px;
    border-top: 1px solid var(--line);
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.5;
  }

  /* Authentic Carrot HA Map Markers */
  .pin {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #38bdf8;
    color: #fff;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    font-size: 11px;
    font-weight: 800;
  }
  .pin.end {
    background: #1d4ed8;
    border-color: #dbeafe;
  }

  /* -------------------------------------------------------------
     Right Panel: 최근 주행 (7일 탭 + 24H 타임라인 바 + 2열 4행 8개 페이징)
     ------------------------------------------------------------- */
  .trip-days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    padding: 12px 14px 10px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .device-outer-frame.mobile-mode .trip-days {
    padding: 8px 6px;
    gap: 2px;
  }
  .trip-day {
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 7px 2px;
    background: rgba(255,255,255,0.025);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    transition: all .18s ease;
  }
  .trip-day:hover { background: rgba(255,255,255,0.06); }
  .trip-day.active {
    background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%);
    border-color: #60a5fa;
    box-shadow: 0 3px 10px rgba(29,78,216,0.45);
    color: #fff;
  }
  .trip-today {
    font-size: 9.5px;
    font-weight: 700;
    color: #60a5fa;
    height: 12px;
    line-height: 12px;
  }
  .trip-day.active .trip-today { color: #e0f2fe; }
  .trip-day b {
    font-size: 11px;
    white-space: nowrap;
    color: #d1d5db;
  }
  .device-outer-frame.mobile-mode .trip-day b { font-size: 10px; }
  .trip-day.active b { color: #fff; }
  .trip-count {
    font-size: 10.5px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .trip-day.active .trip-count { color: #dbeafe; font-weight: 700; }

  /* -------------------------------------------------------------
     24H TIMELINE BAR INSIDE RIGHT PANEL (EXACTLY WHERE CIRCLED IN RED)
     ------------------------------------------------------------- */
  .day-timeline-wrap {
    padding: 10px 16px 12px;
    background: rgba(0,0,0,0.18);
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  body.light .day-timeline-wrap {
    background: rgba(0,0,0,0.025);
  }
  .day-timeline-topline {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 12px;
  }
  .day-timeline-topline strong {
    color: var(--ink);
    font-weight: 750;
  }
  .day-timeline-meta {
    font-size: 11px;
    color: var(--muted);
  }
  .day-timeline-scale {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--muted);
    font-weight: 700;
    padding: 0 1px;
  }
  .day-timeline-rail {
    position: relative;
    width: 100%;
    height: 20px;
    background: rgba(255,255,255,0.04);
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid var(--line);
  }
  body.light .day-timeline-rail {
    background: rgba(0,0,0,0.04);
  }
  .timeline-trip-segment {
    position: absolute;
    top: 1px;
    bottom: 1px;
    border-radius: 3px;
    background: linear-gradient(135deg, #2563eb, #38bdf8);
    cursor: pointer;
    transition: all .15s ease;
    box-shadow: 0 1px 4px rgba(37,99,235,0.3);
  }
  .timeline-trip-segment:hover, .timeline-trip-segment.selected {
    background: var(--orange);
    box-shadow: 0 0 10px rgba(255,138,24,0.9);
    z-index: 5;
  }

  /* -------------------------------------------------------------
     2 COLUMNS x MAX 4 ROWS (2x4) GRID
     ------------------------------------------------------------- */
  .trip-grid-container {
    padding: 10px 12px 12px;
    min-height: 360px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .trip-grid-2x4 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .device-outer-frame.mobile-mode .trip-grid-2x4 {
    gap: 6px;
  }

  /* Refined, Sleek Card Design */
  .sleek-trip-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 11px;
    padding: 9px 11px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    transition: all .16s ease;
    text-align: left;
    position: relative;
  }
  .device-outer-frame.mobile-mode .sleek-trip-card {
    padding: 7px 9px;
    gap: 4px;
  }
  .sleek-trip-card:hover {
    border-color: rgba(37,99,235,0.45);
    background: var(--surface-hover);
    transform: translateY(-1px);
  }
  .sleek-trip-card.selected {
    border-color: var(--orange);
    background: rgba(255,138,24,0.08);
    box-shadow: 0 0 0 1px var(--orange);
  }

  /* Card Top Row */
  .card-top-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .card-time {
    font-size: 11.5px;
    font-weight: 750;
    color: var(--ink);
  }
  .device-outer-frame.mobile-mode .card-time { font-size: 10px; }
  .card-dur {
    font-size: 10.5px;
    color: var(--muted);
    font-weight: 500;
    margin-left: 3px;
  }
  .card-dist {
    font-size: 15px;
    font-weight: 850;
    color: var(--ink);
    letter-spacing: -0.3px;
  }
  .device-outer-frame.mobile-mode .card-dist { font-size: 13px; }
  .card-dist small {
    font-size: 10px;
    font-weight: 500;
    color: var(--muted);
  }

  /* -------------------------------------------------------------
     AUTHENTIC CARROT HA BADGES (MATCHING SCREENSHOT)
     ------------------------------------------------------------- */
  .card-badges-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .trip-soc {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #34d399;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.28);
    padding: 2.5px 7px;
    border-radius: 6px;
    letter-spacing: -0.2px;
    white-space: nowrap;
    line-height: 1.2;
    transition: all .15s ease;
  }
  body.light .trip-soc {
    background: #dcfce7;
    color: #15803d;
    border-color: #86efac;
  }
  .trip-soc .soc-icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }
  .trip-soc .soc-used-tag {
    font-size: 10px;
    color: #6ee7b7;
    font-weight: 600;
    opacity: 0.95;
    margin-left: 2px;
  }
  body.light .trip-soc .soc-used-tag {
    color: #166534;
  }

  /* Separate Used Badge */
  .trip-used-badge {
    display: inline-flex;
    align-items: center;
    font-size: 10.5px;
    font-weight: 600;
    color: #34d399;
    background: rgba(16, 185, 129, 0.10);
    border: 1px solid rgba(16, 185, 129, 0.22);
    padding: 2px 6px;
    border-radius: 6px;
    white-space: nowrap;
    line-height: 1.2;
  }
  body.light .trip-used-badge {
    background: #e6f9ee;
    color: #15803d;
    border-color: #a7f3d0;
  }

  .trip-eff {
    display: inline-flex;
    align-items: center;
    font-weight: 600;
    font-size: 11px;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    padding: 2.5px 7px;
    border-radius: 6px;
    border: 1px solid rgba(56, 189, 248, 0.25);
    letter-spacing: -0.2px;
    white-space: nowrap;
    line-height: 1.2;
    transition: all .15s ease;
  }
  body.light .trip-eff {
    background: #e0f2fe;
    color: #0284c7;
    border-color: #bae6fd;
  }

  .trip-merge-badge {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
    white-space: nowrap;
    line-height: 1.2;
  }
  body.light .trip-merge-badge {
    background: #f3e8ff;
    color: #7e22ce;
    border-color: #d8b4fe;
  }

  /* Pagination Bar */
  .panel-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 4px 0;
    margin-top: 8px;
    border-top: 1px solid var(--line);
  }
  .page-nav-btn {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font-size: 11px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all .15s ease;
  }
  .page-nav-btn:hover:not(:disabled) {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .page-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .page-indicator-text {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
  }

  /* Footer */
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    color: var(--muted);
    font-size: 11px;
  }
  .refresh-btn {
    background: #202528;
    border: 1px solid #343a3e;
    border-radius: 10px;
    padding: 8px 12px;
    color: var(--ink);
    font-size: 11.5px;
    cursor: pointer;
  }
</style>
</head>
<body>

<!-- TOP PREVIEW TOOLBAR -->
<div class="preview-top-toolbar">
  <div class="preview-toolbar-left">
    <span class="preview-pill">24H 타임라인 우측 패널 내장</span>
    <h3 class="preview-title">Carrot HA [주행] 탭 · 24H 타임라인 &amp; 30분 병합 2x4 페이징</h3>
  </div>
  <div class="preview-toolbar-right">
    <div class="btn-toggle-group" id="device-group">
      <button class="active" data-device="desktop">💻 데스크톱 뷰</button>
      <button data-device="mobile">📱 모바일 뷰 (390px)</button>
    </div>
    <div class="btn-toggle-group" id="theme-group">
      <button class="active" data-theme="dark">🌙 다크</button>
      <button data-theme="light">☀️ 라이트</button>
    </div>
  </div>
</div>

<!-- 30-MIN MERGE NOTICE BANNER & BADGE SELECTOR -->
<div class="merge-info-banner">
  <div class="merge-info-text">
    💡 <b>배터리 소모 &amp; 전비 표기:</b> 알약 뱃지 스타일 적용 · <b>30분 이하 인접 주행 병합</b> 지원
  </div>
  <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
    <div class="btn-toggle-group" id="soc-style-group">
      <button class="active" onclick="setSocBadgeMode('combined', this)">🔋 통합형: 79%→78% (1% 사용)</button>
      <button onclick="setSocBadgeMode('separate', this)">🔋 분리형: 79%→78% + 1% 사용</button>
      <button onclick="setSocBadgeMode('original', this)">🔋 원본형: 79%→78%</button>
    </div>
    <button class="merge-toggle-btn active" id="merge-toggle-btn" onclick="toggleMergeMode()">
      🔗 30분 주행 병합: ON
    </button>
  </div>
</div>

<!-- DEVICE OUTER FRAME -->
<div class="device-outer-frame desktop-mode" id="device-outer-frame">
  <div class="mobile-speaker-notch"></div>

  <!-- EXACT CARROT HA MASTER CARD -->
  <div class="ha-card">
    <!-- Header -->
    <header class="top">
      <div>
        <div class="brand">VOLKSWAGEN · CARROT HA</div>
        <h1>ID.4 PRO</h1>
      </div>
      <span class="badge parked"><i class="dot"></i>주차중</span>
    </header>

    <!-- Nav Tabs -->
    <nav class="nav">
      <button>내 차</button>
      <button class="active">주행</button>
      <button>위치</button>
      <button>충전</button>
      <button>상태</button>
    </nav>

    <!-- Main -->
    <main class="main">
      <!-- 1. 4 KPI Blue Tiles (Matching Screenshot) -->
      <div class="tiles">
        <div class="metric">
          <span class="metric-icon">🛣️</span>
          <span class="label">주행거리</span>
          <strong id="kpi-dist">19.07 <small>km</small></strong>
        </div>
        <div class="metric">
          <span class="metric-icon">⏱️</span>
          <span class="label">주행시간</span>
          <strong id="kpi-dur">00:46:25</strong>
        </div>
        <div class="metric">
          <span class="metric-icon">🍃</span>
          <span class="label">평균전비</span>
          <strong id="kpi-eff">6 <small>km/kWh</small></strong>
        </div>
        <div class="metric">
          <span class="metric-icon">⚡</span>
          <span class="label">평균속도</span>
          <strong id="kpi-spd">25 <small>km/h</small></strong>
        </div>
      </div>

      <!-- 2. Split Layout: Left Map vs Right Recent Trips -->
      <div class="layout">
        <!-- LEFT PANEL: Map -->
        <section class="panel">
          <div class="paneltitle">
            <h2 id="left-panel-title">2026-09-26 주행 요약</h2>
            <span class="sub" id="left-panel-sub">총 4회 주행</span>
          </div>
          <div class="map-container">
            <div id="trip-map"></div>
            <button class="map-fullscreen-btn">+ 전체 보기</button>
          </div>
          <div class="route-caption" id="route-caption">
            선택된 날짜의 전체 주행 경로입니다 · 이날 출발(하늘색) / 이날 도착(파랑) · 우측 목록에서 개별 주행을 선택하면 속도변화율이 표시됩니다
          </div>
        </section>

        <!-- RIGHT PANEL: 최근 주행 (7일 탭 + 24H 타임라인 바 + 2열 4행 8개 페이징) -->
        <section class="panel trip-history">
          <div class="paneltitle">
            <h2>최근 주행</h2>
            <span class="sub">최근 7일</span>
          </div>

          <!-- 7-Day Date Selector (Exact match to screenshot) -->
          <div class="trip-days" id="trip-days-bar">
            <!-- Rendered by JS -->
          </div>

          <!-- 24H MASTER DRIVING TIMELINE BAR (EXACTLY WHERE CIRCLED IN RED) -->
          <div class="day-timeline-wrap">
            <div class="day-timeline-topline">
              <span id="day-heading-text"><strong>2026-09-26 · 1회 주행</strong> <small style="color:var(--muted);">(30분 이하 4건 병합)</small></span>
              <span class="day-timeline-meta" id="merge-state-badge">30분 이하 병합됨</span>
            </div>
            <div class="day-timeline-scale">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <div class="day-timeline-rail" id="master-timeline-rail">
              <!-- Rendered by JS -->
            </div>
          </div>

          <!-- 2 Columns x Max 4 Rows Grid Container & Pagination -->
          <div class="trip-grid-container">
            <div class="trip-grid-2x4" id="trip-grid-2x4">
              <!-- Rendered by JS -->
            </div>

            <!-- Inside-Panel Pagination Bar -->
            <div class="panel-pagination" id="panel-pagination">
              <button class="page-nav-btn" id="prev-page-btn" onclick="prevPage()">◀ 이전 페이지</button>
              <span class="page-indicator-text" id="page-indicator-text">1 / 1 페이지</span>
              <button class="page-nav-btn" id="next-page-btn" onclick="nextPage()">다음 페이지 ▶</button>
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <footer class="foot">
        <div>
          Cloudflare · ok<br>
          HA 업데이트 9월 26일 오후 10:37<br>
          차량 정보 수신 9월 26일 오후 02:14
        </div>
        <button class="refresh-btn">↻ 새로고침</button>
      </footer>
    </main>
  </div>
</div>

<script src="../../custom_components/carrot_ha/frontend/carrot-assets/leaflet.js"></script>
<script>
// -------------------------------------------------------------
// 7-DAY RAW TRIP DATA (With Idle Stop Gap Info)
// -------------------------------------------------------------
const RAW_DAYS_DATA = [
  {
    key: '2026-09-20', label: '20일(일)', today: false,
    kpi: { dist: '42.60', dur: '01:15:00', eff: '6.3', spd: '34' },
    rawTrips: [
      { id: 201, time: '오전 08:15', dur: '37분', dur_m: 37, dur_s: 2220, dist: 21.30, startSoc: 90, endSoc: 83, eff: 6.4, spd: 95, gapBefore: 999 },
      { id: 202, time: '오후 06:40', dur: '38분', dur_m: 38, dur_s: 2280, dist: 21.30, startSoc: 83, endSoc: 77, eff: 6.2, spd: 92, gapBefore: 588 }
    ]
  },
  {
    key: '2026-09-21', label: '21일(월)', today: false,
    kpi: { dist: '58.40', dur: '01:42:15', eff: '5.8', spd: '32' },
    rawTrips: [
      { id: 216, time: '오전 08:05', dur: '21분', dur_m: 21, dur_s: 1260, dist: 10.30, startSoc: 58, endSoc: 54, eff: 6.1, spd: 78, gapBefore: 999 },
      { id: 215, time: '오전 09:20', dur: '14분', dur_m: 14, dur_s: 840, dist: 7.20, startSoc: 54, endSoc: 51, eff: 5.7, spd: 68, gapBefore: 54 },
      { id: 214, time: '오전 11:40', dur: '15분', dur_m: 15, dur_s: 900, dist: 8.50, startSoc: 51, endSoc: 48, eff: 5.4, spd: 65, gapBefore: 126 },
      { id: 213, time: '오후 02:15', dur: '22분', dur_m: 22, dur_s: 1320, dist: 14.80, startSoc: 48, endSoc: 42, eff: 6.0, spd: 85, gapBefore: 140 },
      { id: 212, time: '오후 04:30', dur: '12분', dur_m: 12, dur_s: 720, dist: 6.40, startSoc: 42, endSoc: 39, eff: 5.5, spd: 70, gapBefore: 113 },
      { id: 211, time: '오후 04:50', dur: '18분', dur_m: 18, dur_s: 1080, dist: 11.20, startSoc: 39, endSoc: 34, eff: 5.9, spd: 82, gapBefore: 8 }
    ]
  },
  {
    key: '2026-09-22', label: '22일(화)', today: false,
    kpi: { dist: '52.10', dur: '01:30:20', eff: '6.1', spd: '35' },
    rawTrips: [
      { id: 226, time: '오전 08:10', dur: '15분', dur_m: 15, dur_s: 900, dist: 9.20, startSoc: 38, endSoc: 35, eff: 6.2, spd: 75, gapBefore: 999 },
      { id: 225, time: '오전 09:30', dur: '10분', dur_m: 10, dur_s: 600, dist: 5.20, startSoc: 35, endSoc: 33, eff: 6.3, spd: 60, gapBefore: 65 },
      { id: 224, time: '오전 11:20', dur: '12분', dur_m: 12, dur_s: 720, dist: 6.10, startSoc: 33, endSoc: 30, eff: 5.9, spd: 65, gapBefore: 100 },
      { id: 223, time: '오후 02:10', dur: '18분', dur_m: 18, dur_s: 1080, dist: 10.20, startSoc: 30, endSoc: 26, eff: 6.0, spd: 80, gapBefore: 158 },
      { id: 222, time: '오후 05:40', dur: '15분', dur_m: 15, dur_s: 900, dist: 8.90, startSoc: 26, endSoc: 23, eff: 5.8, spd: 72, gapBefore: 192 },
      { id: 221, time: '오후 05:58', dur: '20분', dur_m: 20, dur_s: 1200, dist: 12.50, startSoc: 23, endSoc: 18, eff: 6.2, spd: 85, gapBefore: 3 }
    ]
  },
  {
    key: '2026-09-23', label: '23일(수)', today: false,
    kpi: { dist: '94.20', dur: '02:28:40', eff: '5.7', spd: '38' },
    rawTrips: [
      { id: 238, time: '오전 08:00', dur: '22분', dur_m: 22, dur_s: 1320, dist: 10.20, startSoc: 53, endSoc: 49, eff: 5.8, spd: 72, gapBefore: 999 },
      { id: 237, time: '오전 08:28', dur: '18분', dur_m: 18, dur_s: 1080, dist: 11.00, startSoc: 49, endSoc: 45, eff: 5.5, spd: 78, gapBefore: 6 },
      { id: 236, time: '오전 11:15', dur: '14분', dur_m: 14, dur_s: 840, dist: 8.90, startSoc: 45, endSoc: 42, eff: 5.7, spd: 70, gapBefore: 149 },
      { id: 235, time: '오후 01:50', dur: '19분', dur_m: 19, dur_s: 1140, dist: 13.80, startSoc: 42, endSoc: 37, eff: 6.0, spd: 82, gapBefore: 141 },
      { id: 234, time: '오후 03:30', dur: '12분', dur_m: 12, dur_s: 720, dist: 7.10, startSoc: 37, endSoc: 34, eff: 5.4, spd: 65, gapBefore: 81 },
      { id: 233, time: '오후 05:45', dur: '22분', dur_m: 22, dur_s: 1320, dist: 15.60, startSoc: 34, endSoc: 28, eff: 5.8, spd: 85, gapBefore: 123 },
      { id: 232, time: '오후 07:20', dur: '16분', dur_m: 16, dur_s: 960, dist: 9.40, startSoc: 28, endSoc: 24, eff: 5.6, spd: 75, gapBefore: 73 },
      { id: 231, time: '오후 07:42', dur: '25분', dur_m: 25, dur_s: 1500, dist: 18.20, startSoc: 24, endSoc: 17, eff: 5.9, spd: 90, gapBefore: 6 }
    ]
  },
  {
    key: '2026-09-24', label: '24일(목)', today: false,
    kpi: { dist: '49.80', dur: '01:28:10', eff: '6.0', spd: '34' },
    rawTrips: [
      { id: 246, time: '오전 08:15', dur: '14분', dur_m: 14, dur_s: 840, dist: 7.80, startSoc: 64, endSoc: 61, eff: 6.1, spd: 70, gapBefore: 999 },
      { id: 245, time: '오전 09:15', dur: '12분', dur_m: 12, dur_s: 720, dist: 6.20, startSoc: 61, endSoc: 59, eff: 6.2, spd: 65, gapBefore: 46 },
      { id: 244, time: '오전 11:30', dur: '11분', dur_m: 11, dur_s: 660, dist: 5.40, startSoc: 59, endSoc: 57, eff: 5.9, spd: 60, gapBefore: 124 },
      { id: 243, time: '오후 02:40', dur: '17분', dur_m: 17, dur_s: 1020, dist: 10.50, startSoc: 57, endSoc: 53, eff: 6.0, spd: 78, gapBefore: 179 },
      { id: 242, time: '오후 05:20', dur: '14분', dur_m: 14, dur_s: 840, dist: 7.80, startSoc: 53, endSoc: 50, eff: 5.8, spd: 68, gapBefore: 143 },
      { id: 241, time: '오후 07:45', dur: '20분', dur_m: 20, dur_s: 1200, dist: 12.10, startSoc: 50, endSoc: 45, eff: 6.1, spd: 84, gapBefore: 125 }
    ]
  },
  {
    key: '2026-09-25', label: '25일(금)', today: false,
    kpi: { dist: '214.60', dur: '04:28:00', eff: '5.9', spd: '48' },
    rawTrips: [
      { id: 2501, time: '오전 08:30', dur: '42분', dur_m: 42, dur_s: 2520, dist: 38.40, startSoc: 84, endSoc: 72, eff: 6.2, spd: 104, gapBefore: 999 },
      { id: 2502, time: '오전 09:25', dur: '23분', dur_m: 23, dur_s: 1380, dist: 16.80, startSoc: 72, endSoc: 67, eff: 5.8, spd: 88, gapBefore: 13 },
      { id: 2503, time: '오전 10:10', dur: '25분', dur_m: 25, dur_s: 1500, dist: 22.10, startSoc: 67, endSoc: 60, eff: 6.1, spd: 92, gapBefore: 22 },
      { id: 2504, time: '오전 10:45', dur: '17분', dur_m: 17, dur_s: 1020, dist: 12.30, startSoc: 60, endSoc: 56, eff: 5.5, spd: 78, gapBefore: 10 },
      { id: 2505, time: '오전 11:30', dur: '15분', dur_m: 15, dur_s: 900, dist: 8.50, startSoc: 56, endSoc: 53, eff: 5.2, spd: 65, gapBefore: 28 }, // 1~5 merge into Morning Session
      { id: 2506, time: '오후 01:25', dur: '43분', dur_m: 43, dur_s: 2580, dist: 41.20, startSoc: 53, endSoc: 40, eff: 6.4, spd: 108, gapBefore: 100 }, // 1h 40m stop
      { id: 2507, time: '오후 02:30', dur: '22분', dur_m: 22, dur_s: 1320, dist: 18.00, startSoc: 40, endSoc: 34, eff: 5.7, spd: 85, gapBefore: 22 }, // 6~7 merge
      { id: 2508, time: '오후 04:32', dur: '23분', dur_m: 23, dur_s: 1380, dist: 19.50, startSoc: 34, endSoc: 28, eff: 6.0, spd: 90, gapBefore: 100 }, // 1h 40m stop
      { id: 2509, time: '오후 05:10', dur: '18분', dur_m: 18, dur_s: 1080, dist: 14.20, startSoc: 28, endSoc: 23, eff: 5.6, spd: 82, gapBefore: 15 }, // 8~9 merge
      { id: 2510, time: '오후 06:05', dur: '17분', dur_m: 17, dur_s: 1020, dist: 12.80, startSoc: 23, endSoc: 19, eff: 5.9, spd: 80, gapBefore: 37 }, // 37 min stop
      { id: 2511, time: '오후 06:40', dur: '11분', dur_m: 11, dur_s: 660, dist: 10.80, startSoc: 19, endSoc: 19, eff: 6.8, spd: 74, gapBefore: 18 } // 10~11 merge
    ]
  },
  {
    key: '2026-09-26', label: '26일(토)', today: true,
    kpi: { dist: '19.07', dur: '00:46:25', eff: '6', spd: '25' },
    rawTrips: [
      { 
        id: 2601, time: '오후 12:52', dur: '7분', dur_m: 7, dur_s: 420, dist: 1.28, startSoc: 83, endSoc: 82, eff: 5.5, spd: 65, gapBefore: 999,
        route: [
          { latitude: 37.4050, longitude: 126.9300, speed_mps: 0 },
          { latitude: 37.4025, longitude: 126.9325, speed_mps: 6.9 },
          { latitude: 37.3995, longitude: 126.9355, speed_mps: 18.0 },
          { latitude: 37.3965, longitude: 126.9372, speed_mps: 8.3 },
          { latitude: 37.3950, longitude: 126.9380, speed_mps: 0 }
        ]
      },
      { 
        id: 2602, time: '오후 01:06', dur: '18분', dur_m: 18, dur_s: 1080, dist: 8.83, startSoc: 82, endSoc: 80, eff: 6.3, spd: 90, gapBefore: 7,
        route: [
          { latitude: 37.3950, longitude: 126.9380, speed_mps: 0 },
          { latitude: 37.3910, longitude: 126.9360, speed_mps: 11.1 },
          { latitude: 37.3850, longitude: 126.9350, speed_mps: 20.8 },
          { latitude: 37.3780, longitude: 126.9365, speed_mps: 25.0 },
          { latitude: 37.3720, longitude: 126.9390, speed_mps: 19.4 },
          { latitude: 37.3680, longitude: 126.9400, speed_mps: 0 }
        ]
      },
      { 
        id: 2603, time: '오후 01:34', dur: '10분', dur_m: 10, dur_s: 600, dist: 5.91, startSoc: 80, endSoc: 79, eff: 7.4, spd: 88, gapBefore: 10,
        route: [
          { latitude: 37.3680, longitude: 126.9400, speed_mps: 0 },
          { latitude: 37.3620, longitude: 126.9450, speed_mps: 12.5 },
          { latitude: 37.3550, longitude: 126.9510, speed_mps: 22.2 },
          { latitude: 37.3480, longitude: 126.9580, speed_mps: 24.4 },
          { latitude: 37.3380, longitude: 126.9640, speed_mps: 15.0 },
          { latitude: 37.3300, longitude: 126.9680, speed_mps: 0 }
        ]
      },
      { 
        id: 2604, time: '오후 01:58', dur: '10분', dur_m: 10, dur_s: 600, dist: 3.06, startSoc: 79, endSoc: 78, eff: 4.1, spd: 82, gapBefore: 14,
        route: [
          { latitude: 37.3300, longitude: 126.9680, speed_mps: 0 },
          { latitude: 37.3260, longitude: 126.9675, speed_mps: 10.0 },
          { latitude: 37.3210, longitude: 126.9665, speed_mps: 22.8 },
          { latitude: 37.3180, longitude: 126.9655, speed_mps: 8.3 },
          { latitude: 37.3150, longitude: 126.9650, speed_mps: 0 }
        ]
      }
    ]
  }
];

// -------------------------------------------------------------
// ADJACENT TRIP MERGE LOGIC (Threshold: <= 30 minutes rest gap)
// -------------------------------------------------------------
const MERGE_THRESHOLD_MINUTES = 30; // 30 minutes
let isMergeMode = true; // Default: Merge ON

function processDayTrips(rawTrips, mergeEnabled) {
  if (!mergeEnabled || !rawTrips || rawTrips.length <= 1) {
    return [...rawTrips].sort((a,b) => b.id - a.id).map(t => ({ 
      ...t, isMerged: false, mergedCount: 1, startTime: t.time, endTime: t.time, route: t.route || generateSampleRoute(t) 
    }));
  }

  const sorted = [...rawTrips].sort((a,b) => a.id - b.id);
  const merged = [];

  for (const t of sorted) {
    const tRoute = t.route || generateSampleRoute(t);
    if (merged.length === 0) {
      merged.push({ ...t, isMerged: false, mergedCount: 1, startTime: t.time, endTime: t.time, parts: [t], route: [...tRoute] });
      continue;
    }

    const prev = merged[merged.length - 1];
    const gap = t.gapBefore;
    const isNoCharging = t.startSoc <= prev.endSoc + 1;

    // Merge condition: stop gap <= 30 min and no external battery charging
    if (gap <= MERGE_THRESHOLD_MINUTES && isNoCharging) {
      prev.isMerged = true;
      prev.mergedCount = (prev.mergedCount || 1) + 1;
      prev.dist = Math.round((prev.dist + t.dist) * 100) / 100;
      prev.dur_m = (prev.dur_m || 0) + (t.dur_m || 0);
      prev.dur_s = (prev.dur_s || 0) + (t.dur_s || 0);
      prev.dur = `${prev.dur_m}분`;
      prev.endSoc = t.endSoc;
      prev.endTime = t.time;
      prev.time = `${prev.startTime} ~ ${t.time}`;
      prev.spd = Math.max(prev.spd, t.spd);
      prev.eff = Math.round(((prev.eff + t.eff) / 2) * 10) / 10;
      prev.parts = [...(prev.parts || []), t];
      prev.route = [...(prev.route || []), ...tRoute];
    } else {
      merged.push({ ...t, isMerged: false, mergedCount: 1, startTime: t.time, endTime: t.time, parts: [t], route: [...tRoute] });
    }
  }

  return merged.sort((a,b) => b.id - a.id);
}

// -------------------------------------------------------------
// STATE MANAGEMENT (2 Columns x Max 4 Rows = 8 Items Per Page)
// -------------------------------------------------------------
const ITEMS_PER_PAGE = 8;
let activeDayKey = '2026-09-26'; // Default: Today (screenshot)
let currentPage = 1;
let selectedTripId = null;
let leafletMap = null;
let mapPolylineGroup = null;

function init() {
  renderDaysBar();
  loadDay(activeDayKey);
  initMap();
}

function renderDaysBar() {
  const bar = document.getElementById('trip-days-bar');
  if (!bar) return;
  bar.innerHTML = RAW_DAYS_DATA.map(d => {
    const count = processDayTrips(d.rawTrips, isMergeMode).length;
    return `
    <button class="trip-day ${d.key === activeDayKey ? 'active' : ''}" onclick="selectDay('${d.key}')">
      <span class="trip-today">${d.today ? '오늘' : '&nbsp;'}</span>
      <b>${d.label}</b>
      <span class="trip-count">🛣 ${count}</span>
    </button>`;
  }).join('');
}

function selectDay(key) {
  activeDayKey = key;
  currentPage = 1;
  selectedTripId = null;
  renderDaysBar();
  loadDay(key);
}

function toggleMergeMode() {
  isMergeMode = !isMergeMode;
  currentPage = 1;
  selectedTripId = null;

  const btn = document.getElementById('merge-toggle-btn');
  if (isMergeMode) {
    btn.classList.add('active');
    btn.innerHTML = '🔗 인접 주행 병합 (30분 이하): ON';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '⚡ 인접 주행 병합: OFF (개별 분할)';
  }

  renderDaysBar();
  loadDay(activeDayKey);
}

function loadDay(key) {
  const day = RAW_DAYS_DATA.find(d => d.key === key) || RAW_DAYS_DATA[RAW_DAYS_DATA.length - 1];
  const trips = processDayTrips(day.rawTrips, isMergeMode);

  // Update Top 4 KPIs
  document.getElementById('kpi-dist').innerHTML = `${day.kpi.dist} <small>km</small>`;
  document.getElementById('kpi-dur').innerText = day.kpi.dur;
  document.getElementById('kpi-eff').innerHTML = `${day.kpi.eff} <small>km/kWh</small>`;
  document.getElementById('kpi-spd').innerHTML = `${day.kpi.spd} <small>km/h</small>`;

  // Update Left Panel
  document.getElementById('left-panel-title').innerText = `${day.key} 주행 요약`;
  document.getElementById('left-panel-sub').innerText = `총 ${trips.length}개 ${isMergeMode ? '여정' : '주행'}`;

  // Update Right Panel Timeline Subheading (Inside Red Circle Area)
  const mergeNote = isMergeMode ? `(30분 이하 ${day.rawTrips.length}건 병합)` : `(개별 ${trips.length}건)`;
  document.getElementById('day-heading-text').innerHTML = `<strong>${day.key} · ${trips.length}회 주행</strong> <small style="color:var(--muted); font-size:11px;">${mergeNote}</small>`;
  document.getElementById('merge-state-badge').innerText = isMergeMode ? '30분 이하 병합됨' : '전체 개별 표시';

  // 24H Timeline Bar Inside Right Panel
  render24HTimelineBar(day, trips);

  // 2x4 Grid & Map
  renderTripGrid(trips);
  renderMapRoutes(trips);
}

// -------------------------------------------------------------
// 24H MASTER TIMELINE BAR (Inside Right Panel, Circled in Red)
// -------------------------------------------------------------
function render24HTimelineBar(day, trips) {
  const rail = document.getElementById('master-timeline-rail');
  if (!rail) return;

  let html = '';
  trips.forEach(t => {
    const startStr = t.startTime || t.time.split('~')[0].trim();
    let h = 0, m = 0;
    if (startStr.includes('오후')) {
      const parts = startStr.replace('오후 ', '').split(':');
      h = parseInt(parts[0], 10) === 12 ? 12 : parseInt(parts[0], 10) + 12;
      m = parseInt(parts[1], 10);
    } else {
      const parts = startStr.replace('오전 ', '').split(':');
      h = parseInt(parts[0], 10) === 12 ? 0 : parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
    }
    const leftPct = ((h * 60 + m) / 1440) * 100;
    const durSec = t.dur_s || (t.dur_m * 60) || 1200;
    const widthPct = Math.max(2.2, (durSec / 86400) * 100);
    const isSel = selectedTripId === t.id;

    const used = t.startSoc - t.endSoc;
    const usedStr = used > 0 ? `${used}% 사용` : (used < 0 ? `+${Math.abs(used)}% 회생` : '0% 사용');

    html += `
    <div class="timeline-trip-segment ${isSel ? 'selected' : ''}" 
         style="left:${leftPct}%; width:${widthPct}%;" 
         onclick="handleTimelineSegmentClick(${t.id})" 
         title="${t.time} · ${t.dist}km · 🔋${t.startSoc}%→${t.endSoc}% (${usedStr}) · ${t.eff} km/kWh">
    </div>`;
  });

  rail.innerHTML = html;
}

window.handleTimelineSegmentClick = function(tripId) {
  const day = RAW_DAYS_DATA.find(d => d.key === activeDayKey);
  const trips = processDayTrips(day.rawTrips, isMergeMode);
  const tripIdx = trips.findIndex(t => t.id === tripId);
  if (tripIdx !== -1) {
    currentPage = Math.floor(tripIdx / ITEMS_PER_PAGE) + 1;
  }
  selectTrip(tripId);
};

// -------------------------------------------------------------
// AUTHENTIC CARROT HA BADGES & USAGE FORMAT
// -------------------------------------------------------------
let socBadgeMode = 'combined'; // 'combined' | 'separate' | 'original'

window.setSocBadgeMode = function(mode, btn) {
  socBadgeMode = mode;
  document.querySelectorAll('#soc-style-group button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const day = RAW_DAYS_DATA.find(d => d.key === activeDayKey);
  const trips = processDayTrips(day.rawTrips, isMergeMode);
  renderTripGrid(trips);
};

function renderSocBadgeHtml(t) {
  const drain = t.startSoc - t.endSoc;
  const usedStr = drain > 0 ? `${drain}% 사용` : (drain < 0 ? `+${Math.abs(drain)}% 회생` : '0% 사용');
  const iconSvg = `<svg class="soc-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 4h-2V2h-4v2H8C6.9 4 6 4.9 6 6v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H8V6h8v14z"/></svg>`;

  if (socBadgeMode === 'separate') {
    return `
      <span class="trip-soc">${iconSvg} <span>${t.startSoc}% → ${t.endSoc}%</span></span>
      ${drain > 0 ? `<span class="trip-used-badge">${usedStr}</span>` : ''}
    `;
  } else if (socBadgeMode === 'original') {
    return `
      <span class="trip-soc">${iconSvg} <span>${t.startSoc}% → ${t.endSoc}%</span></span>
    `;
  } else {
    // Default: 'combined'
    return `
      <span class="trip-soc">
        ${iconSvg}
        <span>${t.startSoc}% → ${t.endSoc}%</span>
        ${drain > 0 ? `<small class="soc-used-tag">(${usedStr})</small>` : ''}
      </span>
    `;
  }
}

// -------------------------------------------------------------
// RENDER 2x4 GRID (2 Columns x Max 4 Rows = Max 8 Per Page)
// Authentic Carrot HA Badges (Matching Screenshot)
// -------------------------------------------------------------
function renderTripGrid(trips) {
  const gridEl = document.getElementById('trip-grid-2x4');
  if (!gridEl) return;

  const totalTrips = trips.length;
  const totalPages = Math.max(1, Math.ceil(totalTrips / ITEMS_PER_PAGE));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalTrips);
  const visibleTrips = trips.slice(startIdx, endIdx);

  let html = '';
  visibleTrips.forEach(t => {
    const isSel = selectedTripId === t.id;

    html += `
    <div class="sleek-trip-card ${isSel ? 'selected' : ''}" onclick="selectTrip(${t.id})">
      <!-- Top Row: Time, Dur & Distance -->
      <div class="card-top-row">
        <div>
          <span class="card-time">${t.time}</span>
          <span class="card-dur">${t.dur}</span>
        </div>
        <div class="card-dist">${t.dist.toFixed(2)} <small>km</small></div>
      </div>

      <!-- Badges Row: Authentic Carrot HA Badges -->
      <div class="card-badges-row">
        ${renderSocBadgeHtml(t)}
        <span class="trip-eff">${t.eff} km/kWh</span>
        ${t.isMerged ? `<span class="trip-merge-badge">${t.mergedCount}건 병합</span>` : ''}
      </div>
    </div>`;
  });

  gridEl.innerHTML = html;

  // Pagination controls
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const pageText = document.getElementById('page-indicator-text');

  prevBtn.disabled = (currentPage <= 1);
  nextBtn.disabled = (currentPage >= totalPages);
  pageText.innerText = `${currentPage} / ${totalPages} 페이지 (총 ${totalTrips}개)`;
}

window.prevPage = function() {
  if (currentPage > 1) {
    currentPage--;
    const day = RAW_DAYS_DATA.find(d => d.key === activeDayKey);
    const trips = processDayTrips(day.rawTrips, isMergeMode);
    renderTripGrid(trips);
  }
};

window.nextPage = function() {
  const day = RAW_DAYS_DATA.find(d => d.key === activeDayKey);
  const trips = processDayTrips(day.rawTrips, isMergeMode);
  const totalPages = Math.ceil(trips.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    renderTripGrid(trips);
  }
};

function selectTrip(tripId) {
  selectedTripId = selectedTripId === tripId ? null : tripId;
  const day = RAW_DAYS_DATA.find(d => d.key === activeDayKey);
  const trips = processDayTrips(day.rawTrips, isMergeMode);

  if (selectedTripId !== null) {
    const t = trips.find(x => x.id === selectedTripId);
    if (t) {
      document.getElementById('left-panel-title').innerText = `${t.time} 주행 상세`;
      const used = t.startSoc - t.endSoc;
      const usedStr = used > 0 ? `${used}% 사용` : '0% 사용';
      document.getElementById('left-panel-sub').innerText = `${t.dist.toFixed(2)} km · ${t.dur} · ${usedStr} (🔋${t.startSoc}%→${t.endSoc}%)`;
      document.getElementById('kpi-dist').innerHTML = `${t.dist.toFixed(2)} <small>km</small>`;
      document.getElementById('kpi-dur').innerText = t.dur;
      document.getElementById('kpi-eff').innerHTML = `${t.eff} <small>km/kWh</small>`;
      document.getElementById('kpi-spd').innerHTML = `${t.spd} <small>km/h (최고)</small>`;
    }
  } else {
    // Restore Day Summary
    document.getElementById('left-panel-title').innerText = `${day.key} 주행 요약`;
    document.getElementById('left-panel-sub').innerText = `총 ${trips.length}개 ${isMergeMode ? '여정' : '주행'}`;
    document.getElementById('kpi-dist').innerHTML = `${day.kpi.dist} <small>km</small>`;
    document.getElementById('kpi-dur').innerText = day.kpi.dur;
    document.getElementById('kpi-eff').innerHTML = `${day.kpi.eff} <small>km/kWh</small>`;
    document.getElementById('kpi-spd').innerHTML = `${day.kpi.spd} <small>km/h</small>`;
  }

  render24HTimelineBar(day, trips);
  renderTripGrid(trips);
  renderMapRoutes(trips);
}

// -------------------------------------------------------------
// LEAFLET MAP & AUTHENTIC CARROT HA SPEED GRADIENT
// -------------------------------------------------------------
function generateSampleRoute(t) {
  const baseLat = 37.38, baseLng = 126.95;
  const count = Math.max(5, Math.min(15, Math.round(t.dist * 1.5)));
  const pts = [];
  const maxMps = (t.spd || 60) / 3.6;
  const hash = (t.id * 9301 + 49297) % 233280;
  const angle = (hash / 233280) * 2 * Math.PI;

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    const r = (progress * 0.05);
    const lat = baseLat + Math.sin(angle) * r + Math.sin(i * 1.2) * 0.003;
    const lng = baseLng + Math.cos(angle) * r + Math.cos(i * 1.2) * 0.003;
    const spdFactor = Math.sin(progress * Math.PI);
    const speed_mps = Math.max(0, maxMps * spdFactor);
    pts.push({ latitude: lat, longitude: lng, speed_mps });
  }
  return pts;
}

function getSpeedColor(speedMps, maxMps) {
  if (!Number.isFinite(speedMps) || maxMps <= 0) return '#38bdf8';
  const t = Math.max(0, Math.min(1, speedMps / maxMps));
  const stops = [
    [0.00, 244, 81, 30],   // 0%  (정체/저속: 빨강)
    [0.35, 255, 179, 0],   // 35% (서행: 주황/노랑)
    [0.65, 146, 205, 0],   // 65% (중속: 연두)
    [1.00, 0, 168, 67]     // 100% (고속: 녹색)
  ];
  const j = t < 0.35 ? 0 : (t < 0.65 ? 1 : 2);
  const lo = stops[j], hi = stops[j + 1];
  const span = j === 0 ? 0.35 : (j === 1 ? 0.30 : 0.35);
  const u = (t - lo[0]) / span;
  const r = Math.round(lo[1] + (hi[1] - lo[1]) * u);
  const g = Math.round(lo[2] + (hi[2] - lo[2]) * u);
  const b = Math.round(lo[3] + (hi[3] - lo[3]) * u);
  return `rgb(${r},${g},${b})`;
}

function initMap() {
  const mapEl = document.getElementById('trip-map');
  if (!mapEl) return;
  leafletMap = L.map(mapEl, { zoomControl: true, attributionControl: false }).setView([37.38, 126.96], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(leafletMap);
  mapPolylineGroup = L.layerGroup().addTo(leafletMap);
  const day = RAW_DAYS_DATA.find(d => d.key === activeDayKey);
  renderMapRoutes(processDayTrips(day.rawTrips, isMergeMode));
}

function renderMapRoutes(trips) {
  if (!mapPolylineGroup || !leafletMap) return;
  mapPolylineGroup.clearLayers();

  const captionEl = document.getElementById('route-caption');

  // Case 1: Specific trip selected -> 속도변화율 다색 그라데이션 선 표시
  if (selectedTripId !== null) {
    const t = trips.find(x => x.id === selectedTripId);
    if (t) {
      const points = t.route && t.route.length > 1 ? t.route : generateSampleRoute(t);
      const maxMps = Math.max(...points.map(p => p.speed_mps || 0), (t.spd || 60) / 3.6, 1);

      // Carrot HA 정품 속도변화율 다색 폴리라인 (빨강/주황/연두/녹색)
      for (let i = 1; i < points.length; i++) {
        const p = points[i], a = points[i - 1];
        const spd = p.speed_mps != null ? p.speed_mps : ((a.speed_mps || 0) + (p.speed_mps || 0)) / 2;
        const color = getSpeedColor(spd, maxMps);
        L.polyline([[a.latitude, a.longitude], [p.latitude, p.longitude]], {
          color,
          weight: 6,
          opacity: 0.95
        }).addTo(mapPolylineGroup);
      }

      // '출' 핀 마커
      const startIcon = L.divIcon({ className: 'pin', html: '출', iconSize: [26, 26], iconAnchor: [13, 13] });
      L.marker([points[0].latitude, points[0].longitude], { icon: startIcon, title: `출발: ${t.startTime || t.time}` }).addTo(mapPolylineGroup);

      // '도' 핀 마커
      const endIcon = L.divIcon({ className: 'pin end', html: '도', iconSize: [26, 26], iconAnchor: [13, 13] });
      L.marker([points[points.length - 1].latitude, points[points.length - 1].longitude], { icon: endIcon, title: `도착: ${t.endTime || t.time}` }).addTo(mapPolylineGroup);

      const bounds = L.latLngBounds(points.map(p => [p.latitude, p.longitude]));
      leafletMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });

      if (captionEl) {
        captionEl.innerHTML = `<strong>${t.time} 주행 속도변화율</strong> · <span style="color:#f4511e; font-weight:700;">● 정체/저속</span> → <span style="color:#ffb300; font-weight:700;">● 중속</span> → <span style="color:#00a843; font-weight:700;">● 고속</span> · 최고속도 <b>${t.spd} km/h</b> (클릭하여 전체 요약 복귀)`;
      }
      return;
    }
  }

  // Case 2: Day overview (전체 날짜 요약 모드)
  const allTripsWithRoutes = trips.map(t => (t.route && t.route.length > 1 ? t.route : generateSampleRoute(t)));
  const allCoords = [];
  allTripsWithRoutes.forEach(r => {
    const coords = r.map(p => [p.latitude, p.longitude]);
    allCoords.push(...coords);
    L.polyline(coords, { color: '#38bdf8', weight: 4.5, opacity: 0.85 }).addTo(mapPolylineGroup);
  });

  if (allCoords.length > 0) {
    const startIcon = L.divIcon({ className: 'pin', html: '출', iconSize: [26, 26], iconAnchor: [13, 13] });
    L.marker(allCoords[0], { icon: startIcon, title: '이날 출발' }).addTo(mapPolylineGroup);

    const endIcon = L.divIcon({ className: 'pin end', html: '도', iconSize: [26, 26], iconAnchor: [13, 13] });
    L.marker(allCoords[allCoords.length - 1], { icon: endIcon, title: '이날 도착' }).addTo(mapPolylineGroup);

    leafletMap.fitBounds(L.latLngBounds(allCoords), { padding: [30, 30] });
  }

  if (captionEl) {
    captionEl.innerHTML = `선택된 날짜의 전체 주행 경로입니다 · 이날 출발(하늘색) / 이날 도착(파랑) · 우측 목록에서 개별 주행을 누르면 <strong>속도변화율</strong>이 표시됩니다`;
  }
}

// -------------------------------------------------------------
// EVENT HANDLERS
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Device Toggle
  const devGroup = document.getElementById('device-group');
  const outerFrame = document.getElementById('device-outer-frame');
  devGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      devGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const dev = btn.dataset.device;
      if (dev === 'mobile') {
        outerFrame.classList.remove('desktop-mode');
        outerFrame.classList.add('mobile-mode');
      } else {
        outerFrame.classList.remove('mobile-mode');
        outerFrame.classList.add('desktop-mode');
      }
      if (leafletMap) setTimeout(() => { leafletMap.invalidateSize(); }, 350);
    });
  });

  // Theme toggle
  const themeGroup = document.getElementById('theme-group');
  themeGroup.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      themeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const th = btn.dataset.theme;
      if (th === 'light') document.body.classList.add('light');
      else document.body.classList.remove('light');
    });
  });
});
</script>
</body>
</html>
'''

def main():
    target = os.path.join(os.path.dirname(__file__), "..", "preview", "trip_candidates", "index.html")
    target = os.path.abspath(target)
    with open(target, "w", encoding="utf-8") as f:
        f.write(HTML_CONTENT.strip())
    print(f"Generated {target} successfully! Size: {os.path.getsize(target)} bytes")

if __name__ == "__main__":
    main()

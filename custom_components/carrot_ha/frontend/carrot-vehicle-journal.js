const journalVersion=new URL(import.meta.url).searchParams.get('v')||'journal-20261007-trends-fix-1';
const journalModuleURL=name=>{const url=new URL(name,import.meta.url);url.searchParams.set('v',journalVersion);return url.href;};
const {journalDesign}=await import(journalModuleURL('./carrot-journal-design.js'));
const {preserveView}=await import(journalModuleURL('./carrot-view-state.js'));
const {parseFuelReceipt,runReceiptOcr,matchStationFromReceipt}=await import(journalModuleURL('./carrot-receipt-ocr.js'));
const assetBase=new URL('./carrot-assets/',import.meta.url).href;
function leaflet(){
  if(!window.__carrotLeaflet)window.__carrotLeaflet=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=assetBase+'leaflet.js';
    script.onload=()=>resolve(window.L.noConflict());script.onerror=()=>{window.__carrotLeaflet=null;reject(Error('지도 라이브러리를 읽을 수 없습니다. carrot-assets 폴더를 확인하세요.'));};document.head.append(script);
  });
  return window.__carrotLeaflet;
}
// HA-local EV journal. No remote polling, browser token or localStorage records.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=(value,digits=1)=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:digits}):'—';
const money=value=>Number.isFinite(value)?numeric(value,0)+'원':'미확인';
const trendValue=(value,unit)=>unit==='원'?numeric(value,0):String(value);
const categories={refueling:'주유비',charging:'충전비',maintenance:'정비 / 소모품',washing:'세차비',tuning:'튜닝',insurance:'보험',tax:'세금',parking:'주차비',toll:'통행료',accident:'사고',other:'기타'};
const recordTypeIcons={
  charging:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  refueling:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>',
  maintenance:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  washing:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
  trip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  accident:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  receipt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>'
};
const recordTypeDescs={
  charging:'충전 금액 · 충전량(kWh) · 단가 · 충전소 위치',
  refueling:'주유 금액 · 주유량(L) · 단가 · 주유소 위치',
  maintenance:'소모품 교체 · 튜닝 · 보험 · 세금 · 통행료 등',
  washing:'세차비 · 계기판 누적거리 · 세차장 위치',
  trip:'날짜 · 계기판 누적거리 · 사진 1장',
  accident:'사고 수리비 · 현장 및 수리 사진 최대 10장',
  receipt:'카메라로 영수증 촬영 및 자동 입력'
};
const uuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;};
// Normalize locally before upload; camera originals never leave this browser.
async function prepareJournalPhoto(file){
  const maxInput=20*1024*1024,maxStored=2*1024*1024;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>maxInput)
    throw new Error('사진당 20MiB 이하 JPG·PNG·WEBP 사진을 골라 주세요.');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>80000000)
      throw new Error('사진 해상도가 너무 커요. 8000만 픽셀 이하 사진을 골라 주세요.');
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    if(!context)throw new Error('이 브라우저에서 사진을 압축하지 못했어요.');
    let edge=2560;
    while(edge>=1024){
      const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [.92,.85,.78,.70]){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(blob&&blob.size<=maxStored){
          return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
        }
      }
      edge=Math.floor(edge*.8);
    }
    throw new Error('사진을 저장 크기로 압축하지 못했어요. 다른 사진을 골라 주세요.');
  }catch(error){
    if(error.name==='EncodingError')throw new Error('사진을 읽지 못했어요. JPG·PNG·WEBP 사진을 골라 주세요.');
    throw error;
  }finally{URL.revokeObjectURL(url);}
}
const kindNames={trip:'주행',charge:'충전',expense:'지출'};
const styles=`
:host{display:block;--j-bg:#0b1014;--j-surface:#161e25;--j-raised:#202c36;--j-border:#2a3945;--j-ink:#f1f6fa;--j-sub:#a8bdca;--j-accent:#81e6c5;--j-blue:#7bb6ff;color:var(--j-ink);font:15px/1.65 system-ui,-apple-system,sans-serif}
*{box-sizing:border-box}button,input,select,textarea{font:inherit;color:inherit}button{background:var(--j-raised);border:1px solid var(--j-border);border-radius:12px;padding:10px 15px;min-height:44px;cursor:pointer}button:disabled{opacity:.5;cursor:wait}input,select,textarea{background:var(--j-bg);border:1px solid var(--j-border);border-radius:10px;padding:10px;width:100%;min-width:0}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--j-blue);outline-offset:3px}h1,h2,h3,p{margin:0}h1{font-size:clamp(28px,4vw,44px);line-height:1.25;letter-spacing:-1px}h2{font-size:20px}small,.muted{color:var(--j-sub)}.shell{background:var(--j-bg);border-radius:24px;max-width:1280px;margin:auto;padding:30px;min-width:0}.mast,.row{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.mast{justify-content:space-between;margin-bottom:24px}.brand{color:var(--j-sub);font-size:12px;letter-spacing:2px}.mast h2{font-size:26px}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.controls input,.controls select{width:auto;max-width:100%}.tabs{display:flex;background:var(--j-surface);padding:6px;gap:5px;border-radius:15px;margin:24px 0;width:100%}.tabs button{flex:1 1 0px;min-width:0;background:transparent;color:var(--j-sub);border:0;white-space:nowrap}.tabs button[aria-selected=true]{background:var(--j-raised);color:var(--j-ink)}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px}.panel{background:var(--j-surface);border:1px solid var(--j-border);border-radius:23px;padding:25px;min-width:0}.wide{grid-column:span 8}.narrow{grid-column:span 4}.half{grid-column:span 6}.full{grid-column:span 12}.hero{padding:35px;background:linear-gradient(130deg,#183b37,var(--j-surface))}.accent{color:var(--j-accent)}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:25px 0}.stat small:first-child{min-height:28px;display:flex;align-items:flex-end;margin-bottom:4px}.stat strong{display:block;font-size:21px;font-variant-numeric:tabular-nums;white-space:nowrap}.stat-unit{font-size:12.5px;font-weight:normal;margin-left:2px}.stat-empty{color:var(--j-sub);font-size:15px;font-weight:normal}.kicker{font-size:12px;letter-spacing:2px;color:var(--j-sub);margin-bottom:15px}.primary{background:var(--j-accent);color:#07221b;border:0}.spaced{justify-content:space-between}.list-row{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--j-border)}.list-row small{display:block}.note{color:var(--j-sub);font-size:13px;margin-top:16px}.status{border:1px solid var(--j-border);border-radius:12px;padding:12px;margin-bottom:18px}.error{color:#ffadad}.cost-layout{display:flex;align-items:center;gap:24px;flex-wrap:wrap}.donut{width:150px;height:150px;flex-shrink:0}.cost-list{flex:1;min-width:160px}.chart{width:100%;height:240px;display:block;margin-top:20px}.chart text{fill:var(--j-sub);font-size:12px}.chart-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.chart-controls select{max-width:210px}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse;font-size:13px;margin-top:15px}.table th,.table td{text-align:left;border-bottom:1px solid var(--j-border);padding:12px 6px}.table td:last-child{white-space:nowrap}.table small{display:block}.table button{padding:6px 9px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.fields label{font-size:13px}.fields input,.fields select,.fields textarea{margin-top:7px}.fullfield{grid-column:1/-1}.fieldhelp{font-size:12px;color:var(--j-sub)}dialog{color:var(--j-ink);background:var(--j-surface);border:1px solid var(--j-border);border-radius:24px;width:min(620px,calc(100% - 24px));padding:25px;max-height:90dvh;overflow:auto}dialog::backdrop{background:#000b}.badge{display:inline-block;background:var(--j-raised);border-radius:30px;padding:4px 10px;font-size:12px}.footer{font-size:12px;color:var(--j-sub);margin-top:24px}.preview img{max-width:110px;max-height:90px;border-radius:10px}.compare-value{font-size:34px;color:var(--j-accent);margin:20px 0}[hidden]{display:none!important}@media(max-width:850px){.wide,.narrow,.half{grid-column:span 12}.shell{padding:24px 20px}}@media(max-width:520px){.shell{padding:20px 12px}.panel,.hero{padding:20px}.stats{grid-template-columns:1fr 1fr}.fields{grid-template-columns:1fr}.controls{width:100%}.controls label{flex:1}.controls input{width:100%}.mast h2{font-size:23px}.table th,.table td{padding:10px 4px}.cost-layout{justify-content:center}.stat strong{font-size:18px}.stat-unit{font-size:11.5px}.stat-empty{font-size:13.5px}.stat small:first-child{min-height:26px}}
`;

export class VehicleJournal extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.tab=0;this.offset=0;this.metric='distance_km';this.period='day';this.scope='month';this.comparisonCategory=null;this.recordCategories=new Set();this.recordSort='time';this.entries=[];this.request=0;this.thumbnailCache=new Map();this.lightboxRecord=null;this.lightboxIndex=0;}
  setConfig(config){this.config=config||{};if(!this.ready)this.build();if(this.$('cardSettingsTop'))this.$('cardSettingsTop').hidden=!!this.config.panel;if(this.config.entry_id&&this.entry!==this.config.entry_id){this.entry=this.config.entry_id;this.data=null;this.offset=0;}this.load();}
  set hass(hass){this._hass=hass;if(!this.ready)this.build();this.load();}
  getCardSize(){return 12;}
  getGridOptions(){return {columns:36,rows:'auto',min_columns:6};}
  static getStubConfig(){return {entry_id:''};}
  connectedCallback(){if(!this.ready)this.build();this.visibility=()=>{if(!document.hidden)this.load(true);};document.addEventListener('visibilitychange',this.visibility);this.timer=setInterval(()=>{if(!document.hidden&&!this.$('recordDialog').open&&!this.$('photoViewerDialog')?.open)this.load(true);},60000);this.load();}
  disconnectedCallback(){for(const url of this.photoURLs||[])URL.revokeObjectURL(url);for(const url of this.thumbnailCache.values())URL.revokeObjectURL(url);this.thumbnailCache.clear();this.resize?.disconnect();clearInterval(this.timer);document.removeEventListener('visibilitychange',this.visibility);this.request++;}
  $(id){return this.shadowRoot.getElementById(id);}
  build(){
    this.ready=true;
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${assetBase}leaflet.css"><style>${styles}${journalDesign}</style><div class="shell">
    <div class="card-settings-top" id="cardSettingsTop"><h2>차계부</h2><button type="button" id="journalSettings" class="compact">설정</button></div><header class="mast"><div class="mast-left"><div class="title-controls-row"><select class="select-pill" id="entry" aria-label="차량"></select><button id="pinDefault" type="button" class="btn-pin-default" title="내 기본 차량으로 지정" aria-label="기본 차량 지정">★</button><div class="date-navigation" role="group" aria-label="기록 기간 이동"><button class="date-step" id="periodPrev" type="button" aria-label="이전 달" title="이전 달">‹</button><input class="date-pill" id="month" type="month" aria-label="기록 기간"><button class="date-step" id="periodNext" type="button" aria-label="다음 달" title="다음 달">›</button><button class="date-current" id="periodCurrent" type="button" title="현재 기간으로 돌아가기">이번 달</button></div></div></div><div class="mast-right"><button id="add" class="btn-record-primary">＋ 기록 남기기</button><div class="period-segmented" role="group" aria-label="집계 기간 선택">${[['month','월별'],['year','연도별']].map(([key,label])=>`<button class="period-tab-btn ${key==='month'?'active':''}" data-scope="${key}" aria-pressed="${key==='month'}">${label}</button>`).join('')}</div></div></header>
    <nav class="tabs" role="tablist" aria-label="차계부 메뉴">${['대시보드','추세','절약 비교','상세 기록'].map((n,i)=>`<button type="button" role="tab" id="tab${i}" aria-controls="page${i}" aria-selected="${i===0}">${n}</button>`).join('')}</nav>
    <section id="page0" role="tabpanel" aria-labelledby="tab0">
          <div class="grid">

            <!-- 1. 영웅 카드 (클린 3단 큼직한 타이포그래피 문장형) -->
            <article class="panel wide hero" id="heroCard">
              <h1 id="headline">기록을 불러오고 있어요.</h1><p id="odometerBasis" class="note" hidden></p>
              <div class="stats" id="briefStats"></div>
              <div class="hero-btn-wrap">
                <button id="gotoCompare" class="btn-hero-action" type="button">상세 기록보기 →</button>
              </div>
            </article>

            <!-- 2. 스택형 전월/전년 대비 지출 비교 카드 -->
            <article class="panel narrow comparison-panel is-more" id="targetCard">
              <div class="card-header-row">
                <div>
                  <h2 id="cardTitle">지난달 지출과 비교</h2>
                </div>
                <span id="trendPill" class="trend-badge">비교 중</span>
              </div>

              <div class="spend-headline">
                <div class="spend-statement" id="spendStatement"></div>
              </div>

              <div class="chart-container" id="chartBox">
                <div class="chart-tooltip" id="chartTooltip" aria-hidden="true">
                  <span class="tooltip-dot" id="tooltipDot"></span>
                  <strong id="tooltipCat">충전비</strong>: <span id="tooltipAmount">0원</span> (<span id="tooltipPct">0%</span>)
                </div>

                <svg class="bar-chart-svg" id="barChartSvg" viewBox="0 0 320 185">
                  <!-- 동적 SVG 바 렌더링 -->
                </svg>

                <div class="legend-row" id="legendRow">
                  <button type="button" class="legend-item" data-cat="charging" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-charging);"></span>충전비
                  </button>
                  <button type="button" class="legend-item" data-cat="maintenance" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-maintenance);"></span>정비/소모품
                  </button>
                  <button type="button" class="legend-item" data-cat="washing" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-washing);"></span>세차
                  </button>
                  <button type="button" class="legend-item" data-cat="tuning" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-tuning);"></span>튜닝
                  </button>
                  <button type="button" class="legend-item" data-cat="other" aria-pressed="false">
                    <span class="legend-dot" style="background:var(--cat-other);"></span>기타
                  </button>
                </div>
              </div>
            </article>

            <!-- 3. [사용자 요청 반영] 어디에 썼을까요? (고정 높이 & 상하 중앙 정렬) -->
            <article class="panel half donut-panel" id="donutPanel">
              <h2 id="donutTitle">어디에 썼을까요?</h2>
              <div class="cost-layout">
                <svg class="donut" id="donut" viewBox="0 0 160 160" role="img" aria-label="차량 지출 분류">
                  <!-- 동적 도넛 SVG 렌더링 -->
                </svg>
                <div class="cost-list" id="costs">
                  <!-- 동적 카테고리 목록 (1개든 3개든 중앙 정렬) -->
                </div>
              </div>
            </article>

            <!-- 4. [사용자 요청 반영] 최근 기록이에요 (지출만 표시 & 카테고리별 색상 하이라이트 & +기록 버튼 스타일 일치) -->
            <article class="panel half recent-panel" id="recentPanel">
              <div class="recent-panel-header">
                <h2 id="recentTitle">최근 기록이에요.</h2>
                <button class="btn-recent-record" id="addRecent">
                  <span style="font-size:15px;line-height:1;">＋</span> 기록
                </button>
              </div>
              <div class="recent-list-wrap" id="recent">
                <!-- 동적 최근 지출 내역 렌더링 -->
              </div>
            </article>

          </div>
        </section>
    <section id="page1" role="tabpanel" aria-labelledby="tab1" hidden><div class="trends-container"><div class="trends-header"><h2 class="trends-main-title">추세</h2><p class="trends-main-desc">주행 및 충전 데이터의 패턴을 분석하고, 변동 사항이 있을 때 알려드려요.</p></div><section class="panel trends-map-panel" id="trendsMapSection"><div class="trends-map-header"><h3>방문한 충전소 · 주유소</h3><p id="placeStatisticsBasis" class="note"></p></div><div class="trends-map-wrapper"><div id="trendsMap" class="trends-map-canvas"></div><button type="button" id="trendsMapReset" class="trends-map-reset-btn" title="한반도 전체 지도 보기">전체 보기</button><div id="trendsMapNotice" class="note" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:16px;background:rgba(20,28,35,0.9);border-radius:12px;z-index:5;" hidden></div><div id="trendsPlaceCard" class="trends-place-card" hidden></div></div></section><div class="trends-section" id="changingTrendsSection"><h3 class="trends-section-title">변동 있는 추세</h3><div class="trends-grid" id="changingTrendsGrid"></div></div><div class="trends-section" id="stableTrendsSection"><h3 class="trends-section-title">변동 없는 추세</h3><div class="trends-grid" id="stableTrendsGrid"></div></div></div></section>
    <section id="page2" role="tabpanel" aria-labelledby="tab2" hidden><p id="compareBasis" class="note"></p><div class="grid savings-layout"><article class="panel wide hero savings-hero"><h2>같은 거리를 다른 차로 달렸다면요.</h2><div class="compare-value" id="saving"></div><div id="compareDetail" class="savings-bars"></div></article><article class="panel narrow savings-controls"><div class="controls-content"><div class="row spaced"><label><strong class="slider-title">주행거리</strong> <b id="distanceValue"></b></label><button id="recordedDistance" class="compact">기록된 거리</button></div><input id="compareDistance" aria-label="주행거리" type="range" min="0" max="5000" step="0.1"><small id="distanceStatus"></small><hr><div class="fuel-topline"><label><strong class="slider-title">비교 유종</strong> · <span id="priceValue"></span></label><div class="fuel-switch">${[['gasoline','휘발유'],['premium','고급유'],['diesel','경유']].map(([key,label])=>`<button class="compact" data-compare-fuel="${key}">${label}</button>`).join('')}</div></div><input id="comparePrice" aria-label="유가" type="range" min="1" max="5000" step="1"><div class="row spaced"><small id="priceStatus"></small><button id="averagePrice" class="compact">전국 평균으로 돌아가기</button></div><hr><label><strong class="slider-title">비교 차량 연비</strong> <b id="economyValue"></b></label><input id="economy" aria-label="비교 차량 연비" type="range" min="1" max="50" step="0.1" value="15"><details class="settings"><summary>유가 연결 기준</summary><input id="fuel" type="hidden" value="gasoline"><div id="fuelConnections"></div><form id="compareForm" hidden><input id="editFuel" type="hidden"><label>HA 유가 센서<input id="fuelEntity" placeholder="sensor.average_gasoline" required></label><div class="row"><button class="compact" type="submit">저장</button><button class="compact" id="cancelFuelEdit" type="button">취소</button></div><p id="compareMessage" class="note" role="status"></p></form></details></div></article></div><p class="note">같은 거리의 에너지 비용 비교예요. 충전 단가와 전비로 계산하며 전체 차량 유지비는 포함하지 않아요.</p></section>
    <section id="page3" role="tabpanel" aria-labelledby="tab3" hidden><article class="panel"><div class="row spaced"><h2>차량 지출 내역이에요.</h2><button id="addLedger" class="btn-record-primary">＋ 기록 남기기</button></div><p class="note">자동 충전 결제와 직접 남긴 차량 지출을 함께 보여줘요. 삭제한 수동 기록은 복원할 수 있어요.</p><div class="ledger-filters" id="ledgerFilters"><details class="ledger-dropdown" id="ledgerDropdown"><summary>분류 선택 <span id="ledgerFilterSummary">전체</span></summary><div class="ledger-category-filters" role="group" aria-label="기록 분류 선택 (복수 선택)"><label class="ledger-filter-option"><input type="checkbox" id="ledgerAll" checked>전체</label>${Object.entries(categories).filter(([key])=>['charging','refueling','maintenance','washing','tuning','other'].includes(key)).map(([key,label])=>`<label class="ledger-filter-option" style="--category-color:${this.categoryColor(key)}"><input type="checkbox" data-ledger-category="${key}">${esc(label)}</label>`).join('')}</div></details></div><div class="table-wrap"><table class="table ledger-table"><colgroup><col class="ledger-date-col"><col class="ledger-memo-col"><col class="ledger-value-col"><col class="ledger-actions-col"></colgroup><thead><tr><th>날짜 / 출처</th><th>기록 / 메모</th><th id="ledgerAmountHeader" aria-sort="none"><button id="ledgerSort" type="button" aria-label="금액 정렬 변경">금액 · 시간순</button></th><th>관리</th></tr></thead><tbody id="records"></tbody></table></div><div class="row" style="margin-top:16px"><button id="previous">이전 기록</button><button id="next">다음 기록</button><span id="pageLabel" class="muted"></span></div></article></section>
    <p class="status" id="message" role="status" aria-live="polite">HA 기록을 불러오고 있어요.</p>
    <p class="footer" id="footer">차계부는 HA 로컬 DB에 보관해요. 누락 데이터는 0으로 채우지 않아요.</p>
    <dialog id="vehicleDialog" aria-labelledby="vehicleDialogTitle"><form id="vehicleForm"><div class="row spaced"><h2 id="vehicleDialogTitle">신규 차량을 추가합니다.</h2><button type="button" id="closeVehicle">닫기</button></div><div class="fields"><label>차량 이름<input id="newVehicleTitle" maxlength="80" required placeholder="예시) 아테온"></label><label>차량 유종<select id="newVehicleFuel"><option value="gasoline">휘발유</option><option value="diesel">경유</option><option value="hybrid">하이브리드</option><option value="electric">전기</option></select></label></div><div class="row vehicle-import-actions"><button type="button" id="importSnapshot">이전에 기록되어 있는 스냅샷에서 불러오기</button><button type="button" id="importMichael">마이클 데이터에서 불러오기</button></div><p class="note">마이클 XLS/XLSX는 20MiB, 차량별 스냅샷 ZIP은 128MiB까지 지원해요. 미리보기 확인 후 저장합니다.</p><input type="file" id="vehicleImportFile" hidden><section id="importPreview" hidden></section><p id="vehicleError" class="error" role="alert"></p><button type="submit" id="createVehicle" class="btn-record-primary">지금부터 기록할게요</button></form></dialog><dialog id="vehicleManageDialog" aria-labelledby="vehicleManageTitle"><header class="settings-dialog-header"><div><h2 id="vehicleManageTitle">차계부 설정</h2><p class="note">차량과 기록, 백업, 연결 설정을 관리해요.</p></div><button type="button" id="closeVehicleManage" aria-label="설정 닫기">닫기</button></header><div class="settings-layout"><nav id="settingsNav" class="settings-nav" aria-label="설정 분류"><button type="button" data-settings-nav="vehicles">차량 관리</button><button type="button" data-settings-nav="backup">백업 · 복구</button><button type="button" data-settings-nav="api">API 연결</button><button type="button" data-settings-nav="status">백업 상태</button></nav><main class="settings-content"><section data-settings-pane="vehicles"><h3>등록 차량 · 휴지통</h3><p class="note">차량 이름과 유종을 수정하거나, 기록을 보관한 채 휴지통으로 이동할 수 있어요.</p><div id="vehicleManageList"></div></section><section data-settings-pane="backup" hidden><h3>스냅샷 백업 · 복구</h3><p class="note">차량별 스냅샷에는 원장·사진·위치가 포함돼요. 같은 차량이 있으면 덮어쓰지 않아요.</p><button type="button" id="settingsRestore">스냅샷에서 차량 복구</button><div id="snapshotVehicleList"></div><section class="settings-section"><h4>Synology 전용 자동 백업</h4><label class="settings-toggle"><input id="nasEnabled" type="checkbox"> 매일 03:00 (한국 시간) 자동 백업</label><label>HA 네트워크 저장소 경로<input id="nasPath" value="/share/CarrotJournalBackup/vehicle-journal"></label><p class="note">일 7 · 주 4 · 월 12세대. 임시 DB 복원과 NAS 읽기 검증 후에만 이전 세대를 정리해요.</p><label class="settings-toggle"><input id="automaticLocations" type="checkbox" checked> 충전·주유 장소 자동 선택</label><div class="settings-actions"><button id="nasSave" type="button">설정 저장</button><button id="nasRun" type="button">지금 백업</button><button id="nasList" type="button">백업 목록</button></div><p id="nasStatus" class="note" role="status"></p><div id="nasFiles"></div></section></section><section data-settings-pane="api" hidden><h3>API 키 설정</h3><p class="note">저장된 키를 확인·수정할 수 있어요. 변경 내용은 저장 확인 후 적용돼요.</p><section class="settings-section"><h4>카카오 지도</h4><p class="note">카카오맵 활성화와 실제 HA 도메인 등록이 필요해요.</p><label>Default JS Key (JavaScript 키)<div class="settings-key-field"><input type="password" id="kakaoKey" maxlength="32" autocomplete="off"><button type="button" data-key-toggle="kakaoKey">보기</button></div><small class="settings-key-help">카카오 개발자 콘솔 → 플랫폼 키 → JavaScript 키의 Default JS Key를 입력해요. 지도 표시용이며 JS SDK 도메인에 HA 접속 주소를 등록해야 해요.</small></label><div class="settings-actions"><button type="button" id="saveMapKey">JavaScript 키 저장</button><button type="button" id="clearMapKey">제거</button></div><p id="kakaoRestStatus" class="note"></p><label>Default Rest API Key (REST API 키)<div class="settings-key-field"><input type="password" id="kakaoRestKey" maxlength="32" autocomplete="off"><button type="button" data-key-toggle="kakaoRestKey">보기</button></div><small class="settings-key-help">카카오 개발자 콘솔 → 플랫폼 키 → REST API 키의 Default Rest API Key를 입력해요. 장소 검색용이며 클라이언트 시크릿을 넣는 칸이 아니에요.</small></label><div class="settings-actions"><button type="button" id="saveKakaoRestKey">REST 키 저장</button><button type="button" id="clearKakaoRestKey">제거</button></div><p class="note">Default Native AppKey (네이티브 앱 키)는 웹 차계부에서 사용하지 않아요.</p></section><section class="settings-section"><h4>오피넷 일반 API</h4><p id="opinetStatus" class="note"></p><label>일반 API 키<div class="settings-key-field"><input type="password" id="opinetKey" maxlength="100" autocomplete="off"><button type="button" data-key-toggle="opinetKey">보기</button></div><small class="settings-key-help">오피넷에서 발급받은 일반 API 인증키를 입력해요.</small></label><div class="settings-actions"><button type="button" id="saveOpinetKey">키 저장</button><button type="button" id="clearOpinetKey">제거</button></div><p class="note">자동 주유 단가 입력은 후속 기능이에요.</p></section></section><section data-settings-pane="status" hidden><h3>Synology · HA 백업 상태</h3><div id="backupStatus"></div><p class="note" hidden>기존 HA 백업 상태를 표시해요. NAS 사본 검증과 차계부 전용 자동전송은 아직 제공하지 않아요.</p></section></main></div><p id="vehicleManageError" class="settings-message" role="status"></p></dialog>    <dialog id="recordTypeDialog" aria-labelledby="recordTypeTitle"><div class="row spaced"><h2 id="recordTypeTitle">어떤 기록을 남길까요?</h2><button id="closeRecordType" type="button">닫기</button></div><div id="recordTypeChoices" class="record-type-choices"></div></dialog><dialog id="receiptSourceDialog" aria-labelledby="receiptSourceTitle"><div class="row spaced modal-header-row"><h2 id="receiptSourceTitle">주유 영수증을 어떻게 올리시겠어요?</h2><button id="closeReceiptSource" type="button" class="modal-close-btn" aria-label="닫기">닫기</button></div><div class="receipt-source-grid"><button type="button" class="receipt-source-card" id="receiptSourceCamera"><div class="type-icon-box tint-receipt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div><div class="receipt-source-text"><strong class="receipt-source-title">직접 촬영할게요</strong><small class="receipt-source-desc">카메라로 바로 촬영</small></div></button><button type="button" class="receipt-source-card" id="receiptSourceAlbum"><div class="type-icon-box tint-energy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div><div class="receipt-source-text"><strong class="receipt-source-title">앨범에서 선택할게요</strong><small class="receipt-source-desc">사진 보관함에서 선택</small></div></button></div></dialog><dialog id="recordDialog" aria-labelledby="dialogTitle"><div id="receiptOcrOverlay" class="receipt-ocr-overlay" hidden><div class="ocr-overlay-card"><div class="ocr-graphic-wrap"><div class="ocr-pulse-ring"></div><div class="ocr-icon-box type-icon-box tint-receipt" id="ocrGraphicBox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg><div class="ocr-scan-beam" id="ocrScanBeam"></div></div></div><div class="ocr-step-dots"><span class="ocr-step-dot active" id="ocrDot1"></span><span class="ocr-step-line"></span><span class="ocr-step-dot" id="ocrDot2"></span><span class="ocr-step-line"></span><span class="ocr-step-dot" id="ocrDot3"></span></div><p class="ocr-status-text" id="ocrStatusText">OCR로 인식하는 중이에요.</p><button type="button" id="cancelOcr" class="ocr-cancel-btn">취소</button></div></div><form id="recordForm"><div class="row spaced modal-header-row"><h2 id="dialogTitle">놓친 기록을 남겨요.</h2><div class="modal-header-actions"><button id="save" class="btn-record-primary btn-save-progress" type="submit"><span class="progress-fill"></span><span class="btn-content"><span class="spinner"></span><span class="btn-label">저장</span></span></button><button id="close" class="modal-close-btn" type="button" aria-label="닫기">닫기</button></div></div><div class="modal-scroll-body"><div id="receiptNotice" class="receipt-notice-banner" hidden><span>✨ 영수증에서 인식된 정보예요. 내용을 확인하고 [저장]을 눌러주세요.</span></div><p class="error" id="recordError" role="alert"></p><div class="fields"><input type="hidden" name="kind" id="kind" value="expense"><label id="dateField">기록 날짜<input name="date" type="date" required></label><label id="categoryField">비용 분류<select name="category">${Object.entries(categories).filter(([k])=>['maintenance','tuning','insurance','tax','parking','toll','other'].includes(k)).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label><label id="subcategoryField">세부 작업<input name="subcategory" placeholder="타이어 · 와이퍼 · 워셔액 등" maxlength="100"></label><label id="amountField">실제 금액 · 원<input name="actual_krw" id="actualKrw" type="text" inputmode="numeric" placeholder="0" required></label><label id="odometerField" hidden>계기판 누적거리 · km (선택)<input name="odometer_km" type="number" min="0" step="0.1"></label><label id="fuelTypeField" hidden>유종<select name="fuel_type"><option value="">유종 선택</option><option value="gasoline">휘발유</option><option value="diesel">경유(디젤)</option><option value="premium">고급휘발유</option></select></label><label id="unitPriceField" hidden>단가 · 원<input name="unit_price_krw" inputmode="numeric" placeholder="0"></label><label id="fuelLitersField" hidden>주유량 · L<input name="fuel_liters" type="number" min="0" step="0.001" placeholder="0"><small>금액 ÷ 단가로 추정되며 실제 리터로 수정할 수 있어요.</small></label><label id="billedField" hidden>청구 충전량 · kWh (선택)<input name="billed_charge_kwh" type="number" min="0" step="0.001"></label><div id="tankModeField" class="fullfield" hidden><label><input type="radio" name="tank_mode" value="full" checked>가득 주유</label><label><input type="radio" name="tank_mode" value="partial">부분 주유</label><small>연비 자동 계산은 후속 기능이에요.</small></div><label id="washCostField" hidden>세차비 · 원<input name="wash_cost_krw" inputmode="numeric" placeholder="0"><small>세차비는 별도 세차 기록으로 함께 저장돼요.</small></label><div id="driveModeField" class="fullfield" hidden><label><input type="radio" name="distance_mode" value="odometer" checked>누적주행거리</label><label><input type="radio" name="distance_mode" value="distance">구간주행거리</label></div><label id="distanceField" hidden>주행거리 · km<input name="distance_km" type="number" min="0" step="0.001"></label><label id="chargeField" hidden>배터리 충전량 · kWh<input name="battery_charge_kwh" type="number" min="0" step="0.001"></label><label id="modeField" hidden>충전 종류<select name="charge_mode"><option value="unknown">미확인</option><option value="slow">완속</option><option value="fast">급속</option></select></label><label id="startField" hidden>시작 시각 (선택)<input name="started_at" type="datetime-local"></label><label id="endField" hidden>종료 시각 (선택)<input name="ended_at" type="datetime-local"></label><label id="socStartField" hidden>시작 SOC · % (선택)<input name="soc_start_percent" type="number" min="0" max="100" step="0.1"></label><label id="socEndField" hidden>종료 SOC · % (선택)<input name="soc_end_percent" type="number" min="0" max="100" step="0.1"></label><label id="energyField" hidden>주행 소비 · kWh (선택)<input name="drive_energy_kwh" type="number" min="0" step="0.001"></label><input id="receiptCameraInput" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden><input id="receiptAlbumInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><label id="memoField" class="fullfield">메모<textarea name="memo" maxlength="4000" rows="3"></textarea></label><label id="recordPhotoField" class="fullfield">사진 · JPG / PNG / WEBP<button id="photoPick" type="button" class="photo-pick-tile" aria-label="사진 촬영 또는 앨범에서 선택">📷<span id="photoCount">0/5</span></button><input id="photos" hidden type="file" accept="image/jpeg,image/png,image/webp" multiple><small>사진당 20MiB 이하, 최대 5장. 저장할 때 자동으로 축소·압축해요.</small><button id="clearPhotos" type="button" hidden>사진 선택 모두 취소</button><div class="preview" id="photoPreview"></div></label><section id="recordLocationField" class="fullfield journal-location"><div class="loc-header-row"><div class="loc-header-title-wrap"><h3>기록된 위치</h3><span id="locationSummary" class="loc-summary-pill" hidden></span></div><button type="button" id="removeLocation" class="btn-loc-remove" hidden>위치 제거</button></div><button type="button" id="addLocation" class="btn-loc-add">📍 위치 추가하기</button><div id="locationEditor" hidden><div class="loc-search-box"><div class="loc-box-title">🔍 장소 · 주소 검색</div><div class="loc-search-row"><input id="placeQuery" aria-label="장소 검색" placeholder="주유소, 정비소 이름이나 도로명 주소"><button type="button" id="placeSearch" class="btn-loc-search">검색</button><button type="button" id="locationPin" class="btn-loc-pin">📍 지도 지정</button></div><div id="placeResults" class="place-results-list"></div></div><div id="selectedLocSection" class="selected-loc-section"><div class="selected-loc-badge">선택된 도로명 주소</div><div id="selectedLocAddress" class="selected-loc-addr-text empty">검색 결과에서 선택하거나 지도에서 지정해 주세요.</div><label class="selected-loc-name-field"><span class="selected-loc-name-title">🏷️ 저장할 장소 이름</span><input id="locationName" maxlength="200" placeholder="예: 구리제일주유소, 집 앞 세차장 등"><small class="selected-loc-hint">선택된 상호명이 기본 입력되며, 원하는 이름으로 수정할 수 있어요.</small></label></div><div class="loc-map-container"><div id="locationMap" style="height:220px;border-radius:12px;overflow:hidden"></div><small id="locationHint">지도를 클릭하거나 터치해 위치를 지정할 수 있어요.</small></div></div></section><details id="importSourceDetails" class="fullfield" hidden><summary>마이클 이관 원본 정보</summary><div id="importSourceFields"></div></details></div><p class="note">모르는 소비량·시각은 비워 주세요. 자동 기록과 겹치는 날짜는 저장 전에 확인해 주세요.</p></div></form></dialog><dialog id="photoViewerDialog" aria-labelledby="lightboxTitle"><div class="lightbox-header"><div class="lightbox-title-wrap"><h2 id="lightboxTitle">사진</h2><small id="lightboxMeta" class="muted"></small></div><button id="closeLightbox" class="modal-close-btn" type="button" aria-label="닫기">닫기</button></div><div class="lightbox-body"><button id="lightboxPrev" class="lightbox-nav-btn prev" type="button" aria-label="이전 사진">‹</button><div class="lightbox-stage"><img id="lightboxImg" alt="기록 사진" /><div id="lightboxSpinner" class="lightbox-spinner" hidden>사진을 불러오고 있어요...</div></div><button id="lightboxNext" class="lightbox-nav-btn next" type="button" aria-label="다음 사진">›</button></div><div class="lightbox-footer"><p id="lightboxCaption" class="lightbox-caption"></p></div></dialog></div>`;
    if(this.$('month'))this.$('month').value=this.currentPeriodDate().slice(0,7);
    this.updatePeriodNavigation();
    this.$('closeVehicle').onclick=()=>this.$('vehicleDialog').close();
    this.$('journalSettings').onclick=()=>this.openVehicleManagement();
    this.$('nasSave').onclick=()=>this.saveNasSettings();this.$('nasRun').onclick=()=>this.nasAction('run');this.$('nasList').onclick=()=>this.nasAction('list');
    this.$('settingsRestore').onclick=()=>{this.$('vehicleManageDialog').close();this.openVehicle();this.chooseVehicleFile('snapshot');};
    this.$('saveKakaoRestKey').onclick=()=>{if(this.$('kakaoRestKey').value.trim())this.saveJournalSettings({kakao_rest_key:this.$('kakaoRestKey').value.trim()});};
    this.$('clearKakaoRestKey').onclick=()=>this.saveJournalSettings({kakao_rest_key:''});
    this.$('clearMapKey').onclick=()=>this.saveJournalSettings({map_key:''});
    this.$('saveOpinetKey').onclick=()=>{if(this.$('opinetKey').value.trim())this.saveJournalSettings({opinet_key:this.$('opinetKey').value.trim()});};
    this.$('clearOpinetKey').onclick=()=>this.saveJournalSettings({opinet_key:''});
    this.$('closeVehicleManage').onclick=()=>this.$('vehicleManageDialog').close();
    this.$('importMichael').onclick=()=>this.chooseVehicleFile('michael');
    this.$('importSnapshot').onclick=()=>this.chooseVehicleFile('snapshot');
    this.$('vehicleImportFile').onchange=()=>this.previewVehicleFile();
    this.$('newVehicleFuel').onchange=()=>this.resetVehiclePreview();
    this.$('vehicleForm').onsubmit=e=>this.createVehicle(e);
    this.$('vehicleManageList').onclick=e=>this.manageVehicleAction(e);
    this.$('snapshotVehicleList').onclick=e=>this.manageVehicleAction(e);
    this.$('settingsNav').onclick=e=>{const button=e.target.closest('[data-settings-nav]');if(button)this.selectSettingsSection(button.dataset.settingsNav);};
    this.$('vehicleManageDialog').addEventListener('click',e=>{if(e.target===this.$('vehicleManageDialog'))this.$('vehicleManageDialog').close();const button=e.target.closest('[data-key-toggle]');if(button){const input=this.$(button.dataset.keyToggle);input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'보기':'숨기기';}});
    this.$('saveMapKey').onclick=()=>this.saveJournalSettings({map_key:this.$('kakaoKey').value.trim()});
    this.$('addLocation').onclick=()=>{this.draftLocation={name:'',address:'',latitude:null,longitude:null};this.setDraftDirty(true);this.renderLocation();};
    this.$('locationPin').onclick=()=>this.openLocationPicker();
    this.$('removeLocation').onclick=()=>{this.locationGeneration=(this.locationGeneration||0)+1;this.draftLocation=null;this.setDraftDirty(true);this.renderLocation();};
    this.$('locationName').oninput=()=>{if(this.draftLocation){this.draftLocation.name=this.$('locationName').value;this.setDraftDirty(true);}};
    this.$('placeSearch').onclick=()=>this.searchLocation();
    this.$('placeQuery').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();this.searchLocation();}};
    if(this.$('entry'))this.$('entry').onchange=()=>{const key=this.$('entry').value;if(key==='__add__'||key==='__manage__'){this.$('entry').value=this.entry||'';key==='__add__'?this.openVehicle():this.openVehicleManagement();return;}this.entry=key;this.offset=0;this.updateDefaultVehicleButton();this.load(true);};
    if(this.$('pinDefault'))this.$('pinDefault').onclick=()=>{if(!this.entry||this.entry==='__add__'||this.entry==='__manage__')return;const cur=this.getFavoriteVehicle();if(cur===this.entry){this.setFavoriteVehicle(null);}else{this.setFavoriteVehicle(this.entry);}this.$('entry').innerHTML=this.vehicleOptions();this.$('entry').value=this.entry;this.updateDefaultVehicleButton();this._hass?.callWS({type:'carrot_ha/journal/user_default/set',entry_id:this.entry}).catch(()=>{});};
    if(this.$('trendsMapReset'))this.$('trendsMapReset').onclick=()=>this.resetTrendsMap();
    if(this.$('month'))this.$('month').onchange=()=>{this.offset=0;this.load(true);};
    this.$('periodPrev').onclick=()=>this.stepPeriod(-1);
    this.$('periodNext').onclick=()=>this.stepPeriod(1);
    this.$('periodCurrent').onclick=()=>this.selectCurrentPeriod();
    for(const button of this.shadowRoot.querySelectorAll('[data-scope]'))button.onclick=()=>this.setScope(button.dataset.scope);
    this.$('ledgerSort').onclick=()=>{this.recordSort={time:'amount_desc',amount_desc:'amount_asc',amount_asc:'time'}[this.recordSort];this.changeLedgerFilters();};
    this.$('ledgerAll').onclick=()=>{this.recordCategories.clear();this.changeLedgerFilters();};
    for(const button of this.shadowRoot.querySelectorAll('[data-ledger-category]'))button.onclick=()=>{const key=button.dataset.ledgerCategory;if(this.recordCategories.has(key))this.recordCategories.delete(key);else{this.recordCategories.add(key);}this.changeLedgerFilters();};
    this.$('legendRow').onclick=event=>{const button=event.target.closest('[data-cat]');if(button){this.comparisonCategory=this.comparisonCategory===button.dataset.cat?null:button.dataset.cat;this.renderSpendingComparison();}};
    for(let i=0;i<4;i++)if(this.$('tab'+i))this.$('tab'+i).onclick=()=>this.selectTab(i);
    for(const id of ['add','addRecent','addLedger'])if(this.$(id))this.$(id).onclick=()=>this.chooseRecordType();
    if(this.$('close'))this.$('close').onclick=()=>this.$('recordDialog')?.close();
    if(this.$('recordDialog'))this.$('recordDialog').onclick=e=>{if(e.target===this.$('recordDialog'))this.$('recordDialog').close();};
    if(this.$('closeRecordType'))this.$('closeRecordType').onclick=()=>this.$('recordTypeDialog').close();
    if(this.$('recordTypeDialog'))this.$('recordTypeDialog').onclick=e=>{if(e.target===this.$('recordTypeDialog'))this.$('recordTypeDialog').close();};
    if(this.$('closeLightbox'))this.$('closeLightbox').onclick=()=>this.$('photoViewerDialog')?.close();
    if(this.$('lightboxPrev'))this.$('lightboxPrev').onclick=()=>this.stepLightbox(-1);
    if(this.$('lightboxNext'))this.$('lightboxNext').onclick=()=>this.stepLightbox(1);
    if(this.$('photoViewerDialog'))this.$('photoViewerDialog').onclick=e=>{if(e.target===this.$('photoViewerDialog'))this.$('photoViewerDialog').close();};
    this.shadowRoot.addEventListener('keydown',e=>{if(!this.$('photoViewerDialog')?.open)return;if(e.key==='ArrowLeft'){e.preventDefault();this.stepLightbox(-1);}if(e.key==='ArrowRight'){e.preventDefault();this.stepLightbox(1);}});
    if(this.$('gotoCompare'))this.$('gotoCompare').onclick=()=>this.selectTab(3);
    if(this.$('recordForm')){this.$('recordForm').onsubmit=event=>this.saveRecord(event);this.$('recordForm').addEventListener('invalid',event=>{this.$('recordError').textContent=event.target.validationMessage||'입력값을 확인해 주세요.';},true);}
    const actualInput=this.$('actualKrw');
    if(actualInput)actualInput.oninput=e=>{const raw=e.target.value.replace(/[^\d]/g,'');e.target.value=raw?Number(raw).toLocaleString('ko-KR'):'';};
    if(this.$('previous'))this.$('previous').onclick=()=>{this.offset=Math.max(0,this.offset-100);this.load(true);};
    if(this.$('next'))this.$('next').onclick=()=>{this.offset+=100;this.load(true);};
    if(this.$('records'))this.$('records').onclick=e=>{const button=e.target.closest('button[data-record]');if(!button)return;const record=this.data?.records?.find(r=>r.id===button.dataset.record);if(!record)return;if(button.dataset.action==='photos'){this.showPhotos(record);return;}if(button.dataset.action==='edit')this.openRecord(record);else this.changeStatus(record,button.dataset.action);};
    this.$('closeRecordType').onclick=()=>this.$('recordTypeDialog').close();
    this.$('recordTypeChoices').onclick=e=>{
      const button=e.target.closest('[data-record-type]');
      if(!button)return;
      const type=button.dataset.recordType;
      this.$('recordTypeDialog').close();
      if(type==='receipt'){
        this.$('receiptSourceDialog').showModal();
        return;
      }
      this.openRecord(null,type);
    };
    if(this.$('closeReceiptSource'))this.$('closeReceiptSource').onclick=()=>this.$('receiptSourceDialog').close();
    if(this.$('receiptSourceCamera'))this.$('receiptSourceCamera').onclick=()=>{
      this.$('receiptSourceDialog').close();
      this.openRecord(null,'refueling',true);
      const input=this.$('receiptCameraInput');
      if(input){input.value='';input.click();}
    };
    if(this.$('receiptSourceAlbum'))this.$('receiptSourceAlbum').onclick=()=>{
      this.$('receiptSourceDialog').close();
      this.openRecord(null,'refueling',true);
      const input=this.$('receiptAlbumInput');
      if(input){input.value='';input.click();}
    };
    const onReceiptSelected=input=>{
      if(input.files?.length){
        const file=input.files[0];
        input.value='';
        this.selectedPhotos=[file];
        this.setDraftDirty(true);
        this.renderSelectedPhotos();
        this.handleReceiptPhoto(file);
      }
    };
    if(this.$('receiptCameraInput'))this.$('receiptCameraInput').onchange=e=>onReceiptSelected(e.target);
    if(this.$('receiptAlbumInput'))this.$('receiptAlbumInput').onchange=e=>onReceiptSelected(e.target);
    if(this.$('cancelOcr'))this.$('cancelOcr').onclick=()=>this.cancelReceiptOcr();
    for(const field of ['unit_price_krw','wash_cost_krw'])this.$('recordForm').elements[field].oninput=e=>{this.unmarkAutoFilled('unitPriceField',e.target);const raw=e.target.value.replace(/[^\d]/g,'');e.target.value=raw?Number(raw).toLocaleString('ko-KR'):'';this.estimateFuelLiters();};
    this.$('recordForm').elements.fuel_liters.oninput=e=>{this.unmarkAutoFilled('fuelLitersField',e.target);this.fuelLitersEdited=true;this.fuelQuantitySource='reported';};
    this.$('recordForm').elements.unit_price_krw.addEventListener('input',e=>{this.unmarkAutoFilled('unitPriceField',e.target);this.unitPriceEdited=true;this.unitPriceSource='manual';});
    this.$('recordForm').elements.fuel_type.onchange=e=>{this.unmarkAutoFilled('fuelTypeField',e.target);this.unitPriceEdited=false;this.refreshStationPrice();};
    this.$('recordForm').elements.date.onchange=e=>{this.unmarkAutoFilled('dateField',e.target);this.locationGeneration=(this.locationGeneration||0)+1;};
    this.$('actualKrw').addEventListener('input',e=>{this.unmarkAutoFilled('amountField',e.target);this.estimateFuelLiters();});
    this.$('driveModeField').onchange=()=>{this.setDraftDirty(true);this.formFields();};
    this.$('recordForm').addEventListener('input',()=>{this.setDraftDirty(true);});
    this.$('recordForm').addEventListener('change',()=>{this.setDraftDirty(true);});
    for(const id of ['compareDistance','comparePrice','economy'])this.$(id).oninput=()=>{this.compareAdjusted=true;this.renderSavings();};
    this.$('recordedDistance').onclick=()=>{this.$('compareDistance').value=this.recordedDistance()??0;this.renderSavings();};
    this.$('averagePrice').onclick=()=>{this.useAveragePrice();this.renderSavings();};
    for(const button of this.shadowRoot.querySelectorAll('[data-compare-fuel]'))button.onclick=()=>{this.$('fuel').value=button.dataset.compareFuel;this.compareAdjusted=true;this.useAveragePrice();this.renderSavings();};
    this.$('cancelFuelEdit').onclick=()=>{this.comparisonDirty=false;this.$('compareForm').hidden=true;};
    this.$('fuelConnections').onclick=e=>{const button=e.target.closest('[data-edit-fuel]');if(!button)return;const fuel=button.dataset.editFuel;this.$('editFuel').value=fuel;this.$('fuelEntity').value=this.selectedFuelPrice(fuel).entity;this.$('compareMessage').textContent='';this.$('compareForm').hidden=false;this.comparisonDirty=true;this.$('fuelEntity').focus();};
    this.$('compareForm').addEventListener('input',()=>{this.comparisonDirty=true;});
    this.$('recordDialog').addEventListener('close',()=>{this.cancelReceiptOcr();this.locationGeneration=(this.locationGeneration||0)+1;if(!this.$('save').disabled){this.setDraftDirty(false);this.selectedPhotos=[];this.$('photos').value='';if(this.$('receiptCameraInput'))this.$('receiptCameraInput').value='';if(this.$('receiptAlbumInput'))this.$('receiptAlbumInput').value='';this.renderSelectedPhotos();}});
    if(this.$('compareForm'))this.$('compareForm').onsubmit=async event=>{event.preventDefault();try{await this.call('comparison/save',{fuel:this.$('editFuel').value,economy_km_l:Number(this.$('economy').value),entity_id:this.$('fuelEntity').value});this.comparisonDirty=false;this.$('compareForm').hidden=true;await this.load(true);this.useAveragePrice();this.renderSavings();}catch(e){this.$('compareMessage').textContent=e.message||'저장하지 못했어요.';}};
    this.$('photoPick').onclick=()=>this.$('photos').click();
    if(this.$('photos'))this.$('photos').onchange=()=>{this.selectedPhotos=[...this.$('photos').files];this.setDraftDirty(true);this.renderSelectedPhotos();};
    this.$('clearPhotos').onclick=e=>{e.preventDefault();this.selectedPhotos=[];this.$('photos').value='';this.renderSelectedPhotos();};
    if(this.$('fuel'))this.$('fuel').onchange=()=>{const entity=this.data?.fuel_sensors?.[this.$('fuel').value];if(entity)this.$('fuelEntity').value=entity;};
  }
  selectTab(index){this.tab=index;for(let i=0;i<4;i++){const page=this.$('page'+i);if(page)page.hidden=i!==index;const tab=this.$('tab'+i);if(tab)tab.setAttribute('aria-selected',String(i===index));}if(index===1){this.renderTrendsDashboard();this.initTrendsMap();}}
  hasPendingInput(){return !!(this.$('recordTypeDialog')?.open||this.$('receiptSourceDialog')?.open||this.$('vehicleDialog')?.open||this.$('vehicleManageDialog')?.open||this.$('recordDialog')?.open||this.$('save')?.disabled||this.draftDirty||this.comparisonDirty||this.pendingWrites||this.selectedPhotos?.length);}
  async call(type,params={}){const write=['record/save','record/status','record/purge','record/location','comparison/save'].includes(type);if(write)this.pendingWrites=(this.pendingWrites||0)+1;try{return await this._hass.callWS({type:'carrot_ha/journal/'+type,...(['query','record/save','record/status','record/purge','record/location','comparison/save'].includes(type)?{entry_id:this.entry}:{}),...params});}finally{if(write)this.pendingWrites--;}}
  async load(force=false){
    if(!this._hass?.callWS||!this.isConnected)return;
    this.updatePeriodNavigation();
    if(this.loading){if(force)this.reloadPending=true;return;}
    if(!force&&this.data)return;
    this.loading=true;const generation=++this.request;
    try{
      if(!this.entries.length){
        this.entries=await this._hass.callWS({type:'carrot_ha/journal/entries'});
        if(this.$('entry'))this.$('entry').innerHTML=this.vehicleOptions();
        const userDefault=this.entries.find(e=>e.is_default)?.entry_id;
        this.entry=this.entry||userDefault||this.entries[0]?.entry_id;
        if(this.$('entry'))this.$('entry').value=this.entry||'__add__';
        this.updateDefaultVehicleButton();
      }
      if(this.entries.find(e=>e.entry_id===this.entry)?.unavailable){this.$('headline').textContent='기록을 불러오지 못했어요.';throw Error(this.entries.find(e=>e.entry_id===this.entry).error||'차계부 DB 초기화에 실패했어요.');}
      if(!this.entry){this.$('message').textContent='차량 선택에서 새 차량을 추가해 주세요.';return;}
      const month=this.$('month')?.value;const range=this.range();if(!range)throw new Error('기록 기간을 골라 주세요.');const scope=this.scope;
      const selectedEntry=this.entry,selectedOffset=this.offset,selectedFilters=this.ledgerFilterKey();
      const manualVehicle=this.entries.find(e=>e.entry_id===this.entry)?.linked===false;
      const filterParams=this.recordFiltersSupported?{include_trips:manualVehicle,expenses_only:!manualVehicle,record_sort:this.recordSort,record_categories:[...this.recordCategories],...(this.manualTripRecordsSupported?{include_manual_trips:true}:{})}:{};
      const [data,previous]=await Promise.all([this.call('query',{from:range.from,to:range.to,offset:selectedOffset,...filterParams}),this.call('query',{from:range.previousFrom,to:range.previousTo,offset:0}).catch(()=>null)]);
      data.previous=previous;
      if(generation!==this.request||!this.isConnected||this.entry!==selectedEntry||this.offset!==selectedOffset||this.$('month')?.value!==month||this.scope!==scope||this.ledgerFilterKey()!==selectedFilters)return;
      if(data.expense_category_groups_supported&&!this.recordFiltersSupported){this.recordFiltersSupported=true;this.reloadPending=true;}
      if(data.manual_trip_records_supported&&!this.manualTripRecordsSupported){this.manualTripRecordsSupported=true;this.reloadPending=true;}
      this.data=data;preserveView(this,()=>this.renderData());this.dispatchEvent(new Event('journal-rendered'));
    }catch(error){
      if(this.$('message')){
        this.$('message').textContent=error.message||'HA 차계부에 연결하지 못했어요.';
        this.$('message').classList.add('error');
      }
    }
    finally{this.loading=false;if(this.reloadPending){this.reloadPending=false;this.load(true);}}
  }
  setScope(scope){
    if(!['month','year'].includes(scope)||scope===this.scope)return;
    const today=this.currentPeriodDate();
    this.scope=scope;this.offset=0;
    const input=this.$('month');input.type=scope==='year'?'number':'month';
    if(scope==='year'){input.min='1900';input.value=today.slice(0,4);}else{input.removeAttribute('min');input.value=today.slice(0,7);}
    for(const button of this.shadowRoot.querySelectorAll('[data-scope]')){const active=button.dataset.scope===scope;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    this.updatePeriodNavigation();
    this.load(true);
  }
  currentPeriodDate(){return new Date().toLocaleDateString('sv-SE',{timeZone:this._hass?.config?.time_zone||undefined});}
  currentPeriodValue(){return this.currentPeriodDate().slice(0,this.scope==='year'?4:7);}
  updatePeriodNavigation(){
    const input=this.$('month'),current=this.currentPeriodValue();
    input.max=current;
    if(input.value>current)input.value=current;
    this.$('periodNext').disabled=!input.value||input.value>=current;
    const unit=this.scope==='year'?'해':'달';
    for(const [id,label] of [['periodPrev',`이전 ${unit}`],['periodNext',`다음 ${unit}`]]){this.$(id).setAttribute('aria-label',label);this.$(id).title=label;}
    this.$('periodCurrent').textContent=this.scope==='year'?'올해':'이번 달';
  }
  selectCurrentPeriod(){
    const today=this.currentPeriodDate();
    this.$('month').value=today.slice(0,this.scope==='year'?4:7);
    this.updatePeriodNavigation();
    this.offset=0;this.load(true);
  }
  stepPeriod(direction){
    const range=this.range();if(!range)return;
    const date=new Date(range.from+'T00:00:00Z');
    if(this.scope==='year')date.setUTCFullYear(date.getUTCFullYear()+direction);else date.setUTCMonth(date.getUTCMonth()+direction);
    const year=date.getUTCFullYear();if(year<1||year>9999||(this.scope==='year'&&year<1900))return;
    const value=date.toISOString().slice(0,this.scope==='year'?4:7);
    if(value>this.currentPeriodValue())return;
    this.$('month').value=value;
    this.updatePeriodNavigation();
    this.offset=0;this.load(true);
  }
  range(){
    const value=this.$('month')?.value;
    if(!value||!({month:/^\d{4}-\d{2}$/,year:/^\d{4}$/}[this.scope]).test(value))return null;
    if(value>this.currentPeriodValue())return null;
    const [year,month=1]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,1));
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1)return null;
    const iso=d=>d.toISOString().slice(0,10),end=new Date(date),previous=new Date(date),previousEnd=new Date(date);
    if(this.scope==='month'){end.setUTCMonth(month,0);previous.setUTCMonth(month-2,1);previousEnd.setUTCDate(0);}
    if(this.scope==='year'){end.setUTCMonth(11,31);previous.setUTCFullYear(year-1);previousEnd.setUTCFullYear(year-1);previousEnd.setUTCMonth(11,31);}
    return {from:iso(date),to:iso(end),previousFrom:iso(previous),previousTo:iso(previousEnd)};
  }
  ledgerFilterKey(){return JSON.stringify([this.recordSort,[...this.recordCategories].sort()]);}
  recordCategory(record){return record.kind==='trip'?'trip':record.kind==='charge'?'charging':['charging','refueling','maintenance','washing','tuning','accident'].includes(record.category)?record.category:'other';}
  changeLedgerFilters(){this.offset=0;this.updateLedgerFilters();this.load(true);}
  updateLedgerFilters(){
    this.$('ledgerSort').textContent='금액 · '+({time:'시간순',amount_desc:'높은 순',amount_asc:'낮은 순'}[this.recordSort]);
    this.$('ledgerAmountHeader').setAttribute('aria-sort',{time:'none',amount_desc:'descending',amount_asc:'ascending'}[this.recordSort]);
    this.$('ledgerAll').checked=this.recordCategories.size===0;
    this.$('ledgerFilterSummary').textContent=this.recordCategories.size?`${this.recordCategories.size}개 선택`:'전체';
    for(const button of this.shadowRoot.querySelectorAll('[data-ledger-category]'))button.checked=this.recordCategories.has(button.dataset.ledgerCategory);
  }
  recordedDistance(){return this.isCombustion()?(this.data?.odometer_facts?.distance_km??this.data?.totals?.distance_km??null):this.data?.totals?.distance_km??null;}
  isCombustion(){return ['gasoline','diesel','hybrid'].includes(this.entries.find(e=>e.entry_id===this.entry)?.fuel);}
  categoryColor(key){return {trip:'#7bb6ff',accident:'#ff8585',refueling:'#81e6c5',charging:'#81e6c5',maintenance:'#f59e0b',washing:'#60a5fa',tuning:'#c084fc',other:'#94a3b8'}[key]||'#94a3b8';}
  costCategories(totals){
    const result={};for(const [category,cost] of Object.entries(totals?.categories||{})){
      const key=['charging','refueling','maintenance','washing','tuning'].includes(category)?category:'other';
      const target=result[key]||(result[key]={actual_krw:0,estimated_krw:0,effective_krw:0,count:0});
      for(const field of ['actual_krw','estimated_krw','effective_krw','count'])target[field]+=(cost[field]||0);
    }return result;
  }
  renderRecentExpenses(){
    const expenses=(this.data.recent_records||this.data.records).filter(record=>record.status==='active'&&record.kind==='expense');
    this.$('recent').innerHTML=expenses.map(record=>{
      const key=['charging','refueling','maintenance','washing','tuning','accident'].includes(record.category)?record.category:'other',color=this.categoryColor(key);
      let title=record.subcategory||record.memo;
      if(record.category==='charging'||record.kind==='charge'){
        let mode=record.charge_mode;
        if(!mode||mode==='unknown'){
          const dateStr=(record.accounting_date||record.started_at||'').slice(0,10);
          const match=this.data.records?.find(r=>r.kind==='charge'&&(r.started_at||'').slice(0,10)===dateStr&&r.charge_mode&&r.charge_mode!=='unknown');
          if(match)mode=match.charge_mode;
        }
        if(mode==='fast')title='고속 충전 요금';
        else if(mode==='slow')title='완속 충전 요금';
        else title='충전 요금';
      }else{
        title=title||categories[record.category]||'지출';
      }
      return `<div class="recent-expense-row"><div class="recent-left"><div class="recent-title-line"><span class="cat-highlight-pill" style="color:${color};background:${color}22;border:1px solid ${color}66">${esc(categories[record.category]||'기타')}</span><span class="recent-item-title">${esc(title)}</span></div><small class="recent-date-sub">${esc(record.accounting_date||'미확인')} · ${record.origin==='manual'?'직접 기록':'자동 기록'}</small></div><strong class="recent-amount">${money(record.actual_krw??record.estimated_krw)}</strong></div>`;
    }).join('')||'<p class="muted note">지출 기록이 아직 없어요.</p>';
  }
  renderSpendingComparison(){
    if(!this.data)return;
    const previous=this.costCategories(this.data.previous?.totals),current=this.costCategories(this.data.totals),key=this.comparisonCategory;
    const sum=data=>Object.values(data).reduce((total,item)=>total+item.effective_krw,0);
    const oldValue=key?(previous[key]?.effective_krw||0):sum(previous),newValue=key?(current[key]?.effective_krw||0):sum(current),diff=newValue-oldValue;
    const observed=Boolean(this.data.previous?.daily?.length);
    const prevName=this.scope==='year'?'지난해':'지난달';
    this.$('cardTitle').textContent=this.scope==='year'?'지난해 지출과 비교':'지난달 지출과 비교';
    const range=this.range();
    const color=diff>0?'#ff5c5c':diff<0?'#60a5fa':'#81e6c5';
    this.$('targetCard').classList.toggle('is-more',observed&&diff>0);this.$('targetCard').classList.toggle('is-less',observed&&diff<0);
    this.$('trendPill').className='trend-badge '+(observed?(diff>0?'more':diff<0?'less':''): '');
    this.$('trendPill').textContent=observed&&oldValue>0?`${diff>0?'▲':diff<0?'▼':'—'} ${numeric(Math.abs(diff/oldValue*100))}%`:'비교율 미확인';
    this.$('spendStatement').innerHTML=observed?`${prevName}에 비해 <span class="domain-tag" style="color:${key?this.categoryColor(key):'var(--j-accent)'}">${esc(key?categories[key]:'전체 지출')}</span>에서<br><span class="amount-highlight">${money(Math.abs(diff))}</span>을 <span style="color:${color}">${diff>0?'더 소비':diff<0?'덜 소비':'동일하게 소비'}</span>했어요.`:'이전 기간의 관측 기록이 없어 지출 차이를 계산하지 않아요.';
    for(const button of this.$('legendRow').querySelectorAll('[data-cat]')){button.classList.toggle('active',button.dataset.cat===key);button.setAttribute('aria-pressed',String(button.dataset.cat===key));}
    const amounts=data=>Object.fromEntries(Object.entries(data).map(([category,cost])=>[category,cost.effective_krw]));
    this.$('barChartSvg').setAttribute('aria-label',observed?`${prevName}와 ${this.scope==='year'?'올해':'이번달'}의 지출 비교`:'이전 기간 기록 없음 · 이번달 지출');
    const prevLabel=observed?(this.scope==='year'?range.previousFrom.slice(0,4)+'년':Number(range.previousFrom.slice(5,7))+'월'):'기록 없음';
    const currLabel=this.scope==='year'?range.from.slice(0,4)+'년':Number(range.from.slice(5,7))+'월';
    this.drawStackedChart(amounts(previous),amounts(current),sum(previous),sum(current),sum(current)-sum(previous),prevLabel,currLabel);
  }
  drawStackedChart(prevData, currData, prevTotal, currTotal, diff, prevLabel, currLabel) {
      const svg=this.$('barChartSvg'),hoveredCategory=this.comparisonCategory;
      const CATEGORIES=Object.fromEntries(['charging','refueling','maintenance','washing','tuning','other'].map(key=>[key,{label:categories[key],rawColor:this.categoryColor(key)}]));
      const won=money;
      const bottomY = 145;
      const topLimitY = 38;
      const maxDrawHeight = bottomY - topLimitY; // 107px

      const maxVal = Math.max(prevTotal, currTotal, 1000) * 1.18;
      const hPrev = Math.max(8, (prevTotal / maxVal) * maxDrawHeight);
      const hCurr = Math.max(8, (currTotal / maxVal) * maxDrawHeight);
      const yPrev = bottomY - hPrev;
      const yCurr = bottomY - hCurr;

      const xPrev = 82;
      const xCurr = 238;
      const barW = 54;

      const isMore = diff > 0;
      const isLess = diff < 0;
      const trendColor = isMore ? '#ff5c5c' : isLess ? '#60a5fa' : '#81e6c5';

      function generateSegments(dataObj, totalVal, barX, barHeight, monthKey) {
        let segs = [];
        let currY = bottomY;
        const catKeys = Object.keys(CATEGORIES);

        for (const cat of catKeys) {
          const val = dataObj[cat] || 0;
          if (val <= 0) continue;

          const segH = Math.max(2, (val / totalVal) * barHeight);
          const segY = currY - segH;

          segs.push({
            cat,
            val,
            pct: ((val / totalVal) * 100).toFixed(1),
            x: barX - barW / 2,
            y: segY,
            width: barW,
            height: segH,
            color: CATEGORIES[cat].rawColor,
            label: CATEGORIES[cat].label,
            monthKey
          });

          currY = segY;
        }
        return segs;
      }

      const prevSegs = generateSegments(prevData, prevTotal, xPrev, hPrev, prevLabel);
      const currSegs = generateSegments(currData, currTotal, xCurr, hCurr, currLabel);

      const midX = (xPrev + xCurr) / 2;
      const midY = (yPrev + yCurr) / 2;

      svg.innerHTML = `
        <defs>
          <clipPath id="clipPrev">
            <rect x="${xPrev - barW/2}" y="${yPrev}" width="${barW}" height="${hPrev}" rx="8" />
          </clipPath>
          <clipPath id="clipCurr">
            <rect x="${xCurr - barW/2}" y="${yCurr}" width="${barW}" height="${hCurr}" rx="8" />
          </clipPath>
          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${trendColor}" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="${trendColor}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <line x1="30" y1="${bottomY}" x2="290" y2="${bottomY}" stroke="var(--j-border)" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="${xPrev},${yPrev} ${xCurr},${yCurr} ${xCurr},${bottomY} ${xPrev},${bottomY}" fill="url(#trendAreaGrad)"/>

        <!-- 이전 기간 스택 바 -->
        <g clip-path="url(#clipPrev)">
          ${prevSegs.map(s => `
            <rect class="bar-segment ${hoveredCategory === s.cat ? 'highlighted' : ''}"
                  data-cat="${s.cat}" data-val="${s.val}" data-pct="${s.pct}" data-label="${s.label}" data-month="${prevLabel}"
                  x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.color}">
            <title>${esc(s.label)} · ${won(s.val)} (${s.pct}%)</title></rect>
          `).join('')}
        </g>
        <rect x="${xPrev - barW/2}" y="${yPrev}" width="${barW}" height="${hPrev}" rx="8"
              fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.2" pointer-events="none"/>

        <!-- 현재 기간 스택 바 -->
        <g clip-path="url(#clipCurr)">
          ${currSegs.map(s => `
            <rect class="bar-segment ${hoveredCategory === s.cat ? 'highlighted' : ''}"
                  data-cat="${s.cat}" data-val="${s.val}" data-pct="${s.pct}" data-label="${s.label}" data-month="${currLabel}"
                  x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.color}">
            <title>${esc(s.label)} · ${won(s.val)} (${s.pct}%)</title></rect>
          `).join('')}
        </g>
        <rect x="${xCurr - barW/2}" y="${yCurr}" width="${barW}" height="${hCurr}" rx="8"
              fill="none" stroke="${trendColor}" stroke-width="1.5" pointer-events="none"/>

        <!-- 추세 연결선 & 마커 -->
        <line x1="${xPrev}" y1="${yPrev}" x2="${xCurr}" y2="${yCurr}" stroke="${trendColor}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${xPrev}" cy="${yPrev}" r="5" fill="#f1f6fa" stroke="#32485c" stroke-width="2.5"/>
        <circle cx="${xCurr}" cy="${yCurr}" r="6" fill="#fff" stroke="${trendColor}" stroke-width="3"/>

        <!-- 상단 금액 -->
        <text x="${xPrev}" y="${yPrev - 11}" text-anchor="middle" fill="var(--j-sub)" font-size="13" font-weight="600">${won(prevTotal)}</text>
        <text x="${xCurr}" y="${yCurr - 11}" text-anchor="middle" fill="${trendColor}" font-size="14.5" font-weight="750">${won(currTotal)}</text>

        <!-- 연결선 뱃지 -->
        <g transform="translate(${midX}, ${midY - 14})">
          <rect x="-32" y="-11" width="64" height="22" rx="11" fill="#161e25" stroke="${trendColor}" stroke-width="1.2"/>
          <text x="0" y="4" text-anchor="middle" fill="${trendColor}" font-size="11" font-weight="700">
            ${isMore ? '▲ 증가' : isLess ? '▼ 절약' : '— 유지'}
          </text>
        </g>

        <!-- X축 라벨 -->
        <text x="${xPrev}" y="${bottomY + 22}" text-anchor="middle" fill="var(--j-sub)" font-size="12" font-weight="500">${prevLabel}</text>
        <text x="${xCurr}" y="${bottomY + 22}" text-anchor="middle" fill="var(--j-ink)" font-size="12.5" font-weight="700">${currLabel}</text>
      `;
      svg.onclick=event=>{const segment=event.target.closest('[data-cat]');if(segment){this.comparisonCategory=this.comparisonCategory===segment.dataset.cat?null:segment.dataset.cat;this.renderSpendingComparison();}};
    }

  stat(label,value,note=''){return `<div class="stat"><small>${esc(label)}</small><strong>${value}</strong>${note?`<small>${esc(note)}</small>`:''}</div>`;}
  renderData(){
    const d=this.data,t=d.totals,latest=d.latest||{},ice=this.isCombustion(),fuel=d.fuel_facts?.totals||{},odo=d.odometer_facts;this.renderPlaceStatistics();
    const displayDistance=ice?(odo?.distance_km??t.distance_km):t.distance_km;
    const energyLegend=this.$('legendRow').querySelector('[data-cat="charging"],[data-cat="refueling"]');if(energyLegend){energyLegend.dataset.cat=ice?'refueling':'charging';energyLegend.innerHTML=`<span class="legend-dot" style="background:${this.categoryColor(ice?'refueling':'charging')}"></span>${ice?'주유비':'충전비'}`;}
    this.$('footer').textContent=`${ice?`누적거리 기준 관측 거리 · ${odo?.from||'기준 없음'} ~ ${odo?.to||'기록 없음'} · ${odo?.warning||'월 전체의 정확한 주행거리와 다를 수 있어요.'} · `:''}집계 시간대 ${d.timezone} · HA 로컬 DB에 보관해요. 누락 데이터는 0으로 채우지 않아요.`;
    this.$('message').classList.remove('error');this.$('message').textContent=d.sync_error||`HA에 ${numeric(d.record_count,0)}개의 원장을 보관하고 있어요. ${d.status.phase==='complete'?'기존 기록을 연결했어요.':'기존 기록을 가져오고 있어요.'}`;
    const monthVal=this.$('month')?.value||new Date().toLocaleDateString('sv-SE').slice(0,7);
    const monthNum=Number(monthVal.slice(5,7));
    const yearNum=monthVal.slice(0,4);
    const todayStr=new Date().toLocaleDateString('sv-SE');
    const isThisMonth=monthVal===todayStr.slice(0,7);
    const isThisYear=yearNum===todayStr.slice(0,4);
    const periodHeadline=this.scope==='year'?`${yearNum}년 에는`:`${monthNum}월 달에는`;
    this.$('headline').innerHTML=`<span class="h-phrase">${periodHeadline}</span><br><span class="h-phrase">${numeric(displayDistance)}km를 달리고,</span><br><span class="h-phrase"><span class="accent">${money(t.total_cost_krw)}</span>을 소비했어요.</span>`;

    this.$('odometerBasis').hidden=!ice;this.$('odometerBasis').textContent=ice?`누적거리 기준 관측 구간 ${odo?.from||'기준 없음'} ~ ${odo?.to||'기록 없음'} · ${odo?.warning||'월·연도 전체의 정확한 주행거리와 다를 수 있어요.'}`:'';
    const effLabel=this.scope==='year'?(isThisYear?'올해 전비':`${yearNum}년 전비`):(isThisMonth?'이번달 전비':`${monthNum}월 전비`);
    const chargeLabel=this.scope==='year'?(isThisYear?'올해 충전량':`${yearNum}년 충전량`):(isThisMonth?'이번달 충전량':`${monthNum}월 충전량`);

    const chargeKwhStr=(Number.isFinite(t.battery_charge_kwh)&&t.battery_charge_kwh>0)
      ?`${numeric(t.battery_charge_kwh)}<span class="stat-unit">kWh</span>`
      :`<span class="stat-empty">기록 없음</span>`;

    const effStr=(Number.isFinite(t.efficiency_km_kwh)&&t.efficiency_km_kwh>0)
      ?`${numeric(t.efficiency_km_kwh)}<span class="stat-unit">km/kWh</span>`
      :`<span class="stat-empty">기록 없음</span>`;

    const avgRate=(Number.isFinite(t.battery_charge_kwh)&&t.battery_charge_kwh>0&&Number.isFinite(t.charge_effective_krw)&&t.charge_effective_krw>0)
      ?`${numeric(Math.round(t.charge_effective_krw/t.battery_charge_kwh),0)}<span class="stat-unit">원</span>`
      :`<span class="stat-empty">기록 없음</span>`;

    this.$('briefStats').innerHTML=ice?this.stat('주유량',fuel.fuel_liters==null?'기록 없음':`${numeric(fuel.fuel_liters)} L`)+this.stat('주유 횟수',`${numeric(fuel.fuel_count,0)} 회`)+this.stat('L당 평균 주유금액',fuel.fuel_price_krw_l==null?'기록 없음':`${money(fuel.fuel_price_krw_l)} / L`):
      this.stat(chargeLabel,chargeKwhStr)+
      this.stat(effLabel,effStr)+
      this.stat('kWh 당 평균 충전요금',avgRate);

    if(this.$('stateStats')){
      const state=this.stat('배터리 SOC',numeric(latest.soc_percent)+'%')+this.stat('주행가능거리',numeric(latest.range_km??latest.estimated_range_km)+' km')+this.stat('차량 상태',latest.driving||latest.onroad?'주행 중':latest.charging?'충전 중':'마지막 수신 상태');
      this.$('stateStats').innerHTML=state+this.stat('도어 잠금',latest.doors_locked===true?'잠겨 있어요':latest.doors_locked===false?'열려 있어요':'미확인')+this.stat('계기판 누적거리',numeric(latest.odometer_km)+' km')+this.stat('외기 온도',numeric(latest.outside_temp_c)+' °C');
      if(this.$('stateNote'))this.$('stateNote').textContent=`마지막 수신 ${latest.last_received||latest.measured_at||'미확인'} · 실시간 카드와 같은 HA 최신 기록을 사용해요. 수신 공백 동안 값은 새 측정이 아니에요.`;
    }
    const amounts=Object.entries(this.costCategories(t)).filter(([,v])=>v.effective_krw>0);
    const colors=amounts.map(([key])=>this.categoryColor(key));
    const total=amounts.reduce((sum,[,v])=>sum+v.effective_krw,0);let offset=0;
    const catRows=amounts.map(([k,v],i)=>{
      const count=v.count||(this.data.records||[]).filter(r=>r.kind==='expense'&&r.status==='active'&&this.recordCategory(r)===k).length;
      const isLast=i===amounts.length-1;
      return `<div class="list-row cost-row${isLast?' cost-row-last':''}"><div class="cost-cat-wrap"><span class="cost-cat-name"><span class="cost-dot" style="background:${colors[i]}"></span>${esc(categories[k]||k)}</span><span class="cost-cat-count">${count}건</span></div><strong class="cost-amount">${money(v.effective_krw)}</strong></div>`;
    }).join('');
    const totalRow=amounts.length?`<div class="list-row cost-total-row"><div class="cost-cat-wrap"><span class="cost-total-name">전체</span></div><strong class="cost-total-amount">${money(total)}</strong></div>`:'';
    this.$('costs').innerHTML=(catRows+totalRow)||'<p class="note">이 기간의 지출 기록이 아직 없어요.</p>';
    const donutLabel=this.scope==='year'?(isThisYear?'올해 지출':`${yearNum}년 지출`):(isThisMonth?'이번 달 지출':`${monthNum}월 지출`);
    const manwonVal=Math.round(total/10000);
    const manwonText=`${numeric(manwonVal,0)}만원`;
    this.$('donut').innerHTML=`<title>${donutLabel} ${money(total)} (${manwonText})</title><circle cx="80" cy="80" r="59" fill="none" stroke="var(--j-raised)" stroke-width="19"/>`+[...amounts].sort((a,b)=>a[1].effective_krw-b[1].effective_krw).map(([key,value])=>{
      const color=this.categoryColor(key);
      const fraction=value.effective_krw/total;
      const start=offset;offset+=fraction;
      // Filled annular sectors have radial boundaries; dashed thick circles overlap at joins.
      const point=(radius,turn)=>{const angle=turn*2*Math.PI-Math.PI/2;return `${80+radius*Math.cos(angle)} ${80+radius*Math.sin(angle)}`;};
      const title=`<title>${esc(categories[key])} ${money(value.effective_krw)}</title>`;
      if(fraction>=1)return `<circle cx="80" cy="80" r="59" fill="none" stroke="${color}" stroke-width="19">${title}</circle>`;
      const large=fraction>0.5?1:0,outer=68.5,inner=49.5;
      return `<path fill="${color}" d="M ${point(outer,start)} A ${outer} ${outer} 0 ${large} 1 ${point(outer,offset)} L ${point(inner,offset)} A ${inner} ${inner} 0 ${large} 0 ${point(inner,start)} Z">${title}</path>`;
    }).join('')+`<text x="80" y="74" text-anchor="middle" fill="var(--j-sub)" font-size="13" font-weight="600" letter-spacing="-0.2">${donutLabel}</text><text x="80" y="96" text-anchor="middle" fill="#ffffff" font-size="${Math.min(19,82/(manwonText.length*0.7)).toFixed(1)}" font-weight="850" letter-spacing="-0.5">${manwonText}</text>`;
    this.renderRecentExpenses();
    this.renderSpendingComparison();
    this.updateLedgerFilters();
    const manualVehicle=this.entries.find(e=>e.entry_id===this.entry)?.linked===false;
    const visibleRecords=d.records.filter(r=>(r.kind==='expense'||(r.kind==='trip'&&r.origin==='manual'))&&(!this.recordCategories.size||this.recordCategories.has(this.recordCategory(r))));
    if(this.recordSort!=='time')visibleRecords.sort((a,b)=>{const av=a.actual_krw??a.estimated_krw,bv=b.actual_krw??b.estimated_krw;return av==null?(bv==null?0:1):bv==null?-1:(av-bv)*(this.recordSort==='amount_desc'?-1:1);});
    this.$('records').innerHTML=visibleRecords.map(r=>{
      const hasPhotos=r.attachments?.length>0;
      const photoBtn=hasPhotos?`<button class="btn-table-action btn-photo" data-record="${r.id}" data-action="photos">사진 ${r.attachments.length}장</button>`:'';
      let actionButtons='';
      if(r.kind==='expense'||r.origin==='manual'){
        if(r.status==='deleted'){
          actionButtons=`${photoBtn}<button class="btn-table-action" data-record="${r.id}" data-action="restore">복원</button><button class="btn-table-action btn-record-purge" data-record="${r.id}" data-action="purge">영구 삭제</button>`;
        }else{
          actionButtons=`${photoBtn}<button class="btn-table-action" data-record="${r.id}" data-action="edit">수정</button><button class="btn-table-action" data-record="${r.id}" data-action="delete">삭제</button>`;
        }
      }else{
        actionButtons=hasPhotos?photoBtn:'<small>자동 원장</small>';
      }

      const placeName=r.location?.name?.trim()||r.location?.address?.trim()||'';
      const memoHtml=`<div class="memo-cell-wrap"><div class="memo-text-col"><div class="ledger-category-location"><span class="cat-highlight-pill" style="color:${this.categoryColor(this.recordCategory(r))};background:${this.categoryColor(this.recordCategory(r))}22;border:1px solid ${this.categoryColor(this.recordCategory(r))}66">${esc(categories[this.recordCategory(r)]||kindNames[r.kind])}</span>${placeName?`<span class="ledger-place-name">${esc(placeName)}</span>`:''}</div>${r.subcategory?`<span class="recent-item-title">${esc(r.subcategory)}</span>`:''}${r.memo?`<small class="memo-desc">${esc(r.memo)}</small>`:''}${r.duplicate_candidates?.length?'<small class="error">같은 날 자동 기록이 있어요. 중복 여부를 확인해 주세요.</small>':''}</div>${hasPhotos?`<button class="memo-thumb-btn" type="button" data-record="${r.id}" data-action="photos" aria-label="사진 보기 (${r.attachments.length}장)"><div class="thumb-box" data-thumb-record="${r.id}"><span class="thumb-spinner">📷</span></div>${r.attachments.length>1?`<span class="thumb-badge">+${r.attachments.length}</span>`:''}</button>`:''}</div>`;

      return `<tr><td>${esc(r.accounting_date||r.started_at?.slice(0,10))}<small>${r.import_source?'마이클 이관':r.origin==='manual'?'직접 기록':'자동 기록'} · ${r.status==='deleted'?'삭제됨':r.status==='excluded'?'제외됨':'보관 중'}</small></td><td>${memoHtml}</td><td>${r.kind==='trip'&&r.odometer_km!=null?`${numeric(r.odometer_km,1)}km · 누적`:money(r.actual_krw??r.estimated_krw)}</td><td>${actionButtons}</td></tr>`;
    }).join('')||'<tr><td colspan="4">이 기간의 기록이 없어요. 누락 기록을 직접 남겨 보세요.</td></tr>';
    this.$('previous').disabled=this.offset===0;this.$('next').disabled=!d.has_more;this.$('pageLabel').textContent=visibleRecords.length?`${this.offset+1}~${this.offset+visibleRecords.length}번째 기록`:'표시할 기록이 없어요.';
    if(!this.recordFiltersSupported)this.$('pageLabel').textContent+=' · 전체 기간 필터 적용을 위해 HA 재시작이 필요해요.';
    const comparisonKey=JSON.stringify([this.entry,this.$('month').value,this.scope]);
    if(this.savingsKey!==comparisonKey){this.savingsKey=comparisonKey;this.compareAdjusted=false;this.$('fuel').value=d.comparison?.fuel||'gasoline';this.$('economy').value=d.comparison?.economy_km_l||15;this.$('compareDistance').max=Math.max(5000,this.recordedDistance()||0);this.$('compareDistance').value=this.recordedDistance()??0;this.useAveragePrice();}
    if(!this.compareAdjusted){this.$('compareDistance').value=this.recordedDistance()??0;this.useAveragePrice();}
    this.renderSavings();
    this.renderTrendsDashboard();
    this.loadThumbnails();
  }
  selectedFuelPrice(fuel=this.$('fuel').value){
    const defaults={gasoline:'sensor.average_gasoline',premium:'sensor.average_premium_gasoline',diesel:'sensor.average_diesel'};
    let configured={};try{configured=JSON.parse(this.data?.comparison?.sensor_entities_json||'{}');}catch{}
    const entity=configured[fuel]||this.data?.fuel_sensors?.[fuel]||defaults[fuel],sensor=this._hass?.states?.[entity],unit=sensor?.attributes?.unit_of_measurement;
    const valid=['원/L','KRW/L','원/ℓ'].includes(unit)||(unit==='원'&&this.data?.fuel_sensors?.[fuel]===entity);
    const value=sensor&&valid?Number(sensor.state):null;
    const fallback=this.data?.comparison?.fuel===fuel?this.data?.fuel_price?.price:null;
    return {entity,price:Number.isFinite(value)&&value>0?value:(Number.isFinite(fallback)&&fallback>0?fallback:null)};
  }
  useAveragePrice(){const current=this.selectedFuelPrice();this.averageMissing=current.price==null;if(current.price!=null){this.$('comparePrice').max=Math.max(5000,Math.ceil(current.price));this.$('comparePrice').value=current.price;}this.priceManual=false;}
  renderSavings(){
    if(!this.data)return;const t=this.data.totals||{},distance=Number(this.$('compareDistance').value),economy=Number(this.$('economy').value),fuel=this.$('fuel').value,labels={gasoline:'휘발유',premium:'고급유',diesel:'경유'};
    const average=this.selectedFuelPrice();const price=Number(this.$('comparePrice').value),priceKnown=!this.averageMissing||this.compareAdjusted&&this.shadowRoot.activeElement===this.$('comparePrice');
    if(this.shadowRoot.activeElement===this.$('comparePrice')){this.averageMissing=false;this.priceManual=true;}
    const title=this.entries.find(e=>e.entry_id===this.entry)?.title||'선택 차량';
    this.$('compareBasis').textContent=`${this.$('month').value} · ${title} · ${numeric(distance)}km 기준`;
    this.$('distanceValue').textContent=numeric(distance)+'km';this.$('distanceStatus').textContent=distance===this.recordedDistance()?'선택 기간에 기록된 주행거리':'직접 조정한 거리';
    this.$('priceValue').textContent=labels[fuel]+' 유가 '+(priceKnown?money(price)+'/L':'미확인');this.$('priceStatus').textContent=this.averageMissing?'전국 평균 유가 센서를 확인해 주세요.':this.priceManual?'직접 조정한 유가':'전국 평균 기준';
    this.$('fuelConnections').innerHTML=Object.entries(labels).map(([key,label])=>{const item=this.selectedFuelPrice(key);return `<div class="fuel-connection-row"><div><b>${label}</b><small>${item.price!=null?'연결됨 · '+money(item.price)+'/L':'연결 확인 필요'}</small></div><button class="compact" type="button" data-edit-fuel="${key}">수정</button></div>`;}).join('');
    this.$('averagePrice').disabled=average.price==null;this.$('economyValue').textContent=numeric(economy)+'km/L';
    for(const b of this.shadowRoot.querySelectorAll('[data-compare-fuel]')){b.classList.toggle('active',b.dataset.compareFuel===fuel);b.setAttribute('aria-pressed',String(b.dataset.compareFuel===fuel));}
    if(this.isCombustion()){
      const basisDistance=this.recordedDistance(),cost=this.data.fuel_facts?.totals?.fuel_cost_krw;
      if(!priceKnown||!(economy>0)||!(basisDistance>0)||cost==null||!(this.data.fuel_facts?.totals?.fuel_count>0)){this.$('saving').textContent='비교에 필요한 관측 거리·주유 지출·비교 차량 연비·유가를 확인해 주세요.';this.$('compareDetail').textContent='';return;}
      const current=distance*cost/basisDistance,other=distance/economy*price,diff=other-current,max=Math.max(1,current,other);
      this.$('saving').textContent=money(Math.abs(diff))+(diff>=0?' 덜 들어요':' 더 들어요');
      this.$('compareDetail').innerHTML='<p class="note">주유 지출 기준 추정 · 실제 연비 계산이 아니며 주유·주행 기간 차이로 오차가 있어요.</p>'+[[title,current,'mint'],['비교 차량',other,'orange']].map(([label,value,color])=>`<div class="row spaced"><span>${esc(label)}</span><b class="${color}">${money(value)}</b></div><div class="cost-bar ${color}"><span style="width:${value/max*100}%"></span></div>`).join('');return;
    }
    const kwh=t.billed_charge_kwh||t.battery_charge_kwh,rate=kwh>0&&t.charge_effective_krw!=null?t.charge_effective_krw/kwh:null,eff=t.efficiency_km_kwh;
    if(!priceKnown||rate==null||!(eff>0)||t.distance_km==null){this.$('saving').textContent='비교에 필요한 거리·전비·충전비·유가를 확인해 주세요.';this.$('compareDetail').textContent='';return;}
    const ev=distance/eff*rate,ice=distance/economy*price,diff=ice-ev,max=Math.max(1,ev,ice);
    this.$('saving').textContent=money(Math.abs(diff))+(diff>=0?' 덜 들어요':' 더 들어요');
    this.$('compareDetail').innerHTML=[[title,ev,'mint'],['비교 차량',ice,'orange']].map(([label,value,color])=>`<div class="row spaced"><span>${esc(label)}</span><b class="${color}">${money(value)}</b></div><div class="cost-bar ${color}"><span style="width:${value/max*100}%"></span></div>`).join('');
  }
  renderTrendsDashboard(){
    const changingContainer=this.$('changingTrendsGrid');
    const stableContainer=this.$('stableTrendsGrid');
    if(!changingContainer||!stableContainer||!this.data)return;

    const daily=this.data.daily||[];
    const prevDaily=this.data.previous?.daily||[];
    const totals=this.data.totals||{};
    const prevTotals=this.data.previous?.totals||{};
    const isYear=this.scope==='year';
    const monthVal=this.$('month')?.value||new Date().toLocaleDateString('sv-SE').slice(0,7);
    const yearStr=monthVal.slice(0,4);
    const monthNum=Number(monthVal.slice(5,7));
    const periodName=isYear?`${yearStr}년`:`${monthNum}월`;
    const prevPeriodName=isYear?'지난해':'지난달';

    if(daily.length===0){
      changingContainer.classList.remove('single-item');
      changingContainer.innerHTML='<div class="trends-empty-pill" style="grid-column: 1 / -1;">이 기간에 기록된 주행 및 충전 데이터가 아직 없어요.</div>';
      stableContainer.innerHTML='';
      return;
    }

    let numBins=16;
    let daysInMonth=31;
    if(!isYear){
      const yr=Number(yearStr),mo=monthNum;
      daysInMonth=new Date(yr,mo,0).getDate();
      numBins=Math.ceil(daysInMonth/2);
    }else{
      numBins=12;
    }

    const bins=Array.from({length:numBins},()=>({
      distance_km:0,energy_distance_km:0,drive_energy_kwh:0,
      battery_charge_kwh:0,billed_charge_kwh:0,charge_effective_krw:0,
      drive_soc_used_pp:0,slow_count:0,fast_count:0,unknown_count:0,day_count:0
    }));

    for(const row of daily){
      const dayStr=row.day;
      let binIdx=0;
      if(!isYear){
        const d=Number(dayStr.slice(8,10));
        binIdx=Math.min(numBins-1,Math.floor((d-1)/2));
      }else{
        const m=Number(dayStr.slice(5,7));
        binIdx=Math.min(11,m-1);
      }
      const b=bins[binIdx];
      b.distance_km+=row.distance_km||0;
      b.energy_distance_km+=row.energy_distance_km||0;
      b.drive_energy_kwh+=row.drive_energy_kwh||0;
      b.battery_charge_kwh+=row.battery_charge_kwh||0;
      b.billed_charge_kwh+=row.billed_charge_kwh||0;
      b.charge_effective_krw+=row.charge_effective_krw||0;
      b.drive_soc_used_pp+=row.drive_soc_used_pp||0;
      b.slow_count+=row.slow_count||0;
      b.fast_count+=row.fast_count||0;
      b.unknown_count+=row.unknown_count||0;
      b.day_count++;
    }

    const currEff=totals.efficiency_km_kwh!=null&&totals.efficiency_km_kwh>0?+totals.efficiency_km_kwh.toFixed(1):(totals.drive_energy_kwh?+(totals.energy_distance_km/totals.drive_energy_kwh).toFixed(1):null);
    const pastEff=prevTotals.efficiency_km_kwh!=null&&prevTotals.efficiency_km_kwh>0?+prevTotals.efficiency_km_kwh.toFixed(1):(prevTotals.drive_energy_kwh?+(prevTotals.energy_distance_km/prevTotals.drive_energy_kwh).toFixed(1):null);
    const effBars=bins.map(b=>b.drive_energy_kwh>0?+(b.energy_distance_km/b.drive_energy_kwh).toFixed(1):0);

    const observedDays=(rows,key)=>Math.max(1,rows.filter(r=>r[key]!=null).length);
    const currDist=totals.distance_km!=null?+(totals.distance_km/observedDays(daily,'distance_km')).toFixed(1):null;
    const prevDist=prevTotals.distance_km!=null?+(prevTotals.distance_km/observedDays(prevDaily,'distance_km')).toFixed(1):null;
    const distBars=bins.map(b=>+(b.distance_km/Math.max(1,b.day_count)).toFixed(1));

    const currCharge=totals.battery_charge_kwh!=null?+(totals.battery_charge_kwh/observedDays(daily,'battery_charge_kwh')).toFixed(1):null;
    const prevCharge=prevTotals.battery_charge_kwh!=null?+(prevTotals.battery_charge_kwh/observedDays(prevDaily,'battery_charge_kwh')).toFixed(1):null;
    const chargeBars=bins.map(b=>+(b.battery_charge_kwh/Math.max(1,b.day_count)).toFixed(1));

    const currChargeKwhTotal=totals.billed_charge_kwh||totals.battery_charge_kwh||0;
    const currRate=(totals.charge_effective_krw&&currChargeKwhTotal>0)?Math.round(totals.charge_effective_krw/currChargeKwhTotal):null;
    const prevChargeKwhTotal=prevTotals.billed_charge_kwh||prevTotals.battery_charge_kwh||0;
    const prevRate=(prevTotals.charge_effective_krw&&prevChargeKwhTotal>0)?Math.round(prevTotals.charge_effective_krw/prevChargeKwhTotal):null;
    const rateBars=bins.map(b=>{const kwh=b.billed_charge_kwh||b.battery_charge_kwh||0;return (b.charge_effective_krw&&kwh>0)?Math.round(b.charge_effective_krw/kwh):0;});

    const currDriveSoc=totals.drive_soc_used_pp!=null?+(totals.drive_soc_used_pp/observedDays(daily,'drive_soc_used_pp')).toFixed(1):null;
    const prevDriveSoc=prevTotals.drive_soc_used_pp!=null?+(prevTotals.drive_soc_used_pp/observedDays(prevDaily,'drive_soc_used_pp')).toFixed(1):null;
    const driveSocBars=bins.map(b=>+(b.drive_soc_used_pp/Math.max(1,b.day_count)).toFixed(1));

    const currSlowFast=(totals.slow_count||0)+(totals.fast_count||0);
    const currFastRatio=currSlowFast>0?Math.round(((totals.fast_count||0)/currSlowFast)*100):null;
    const prevSlowFast=(prevTotals.slow_count||0)+(prevTotals.fast_count||0);
    const prevFastRatio=prevSlowFast>0?Math.round(((prevTotals.fast_count||0)/prevSlowFast)*100):null;
    const fastRatioBars=bins.map(b=>{const tot=(b.slow_count||0)+(b.fast_count||0);return tot>0?Math.round((b.fast_count/tot)*100):0;});

    const createMetric=(id,name,icon,color,unit,currVal,pastVal,bars,options={})=>{
      const hasCurrent=currVal!=null&&Number.isFinite(currVal)&&currVal>=0;
      const hasPast=pastVal!=null&&Number.isFinite(pastVal)&&pastVal>=0;
      let isChanging=false;
      let trendStatus='consistent';
      let headline=`${periodName} 동안 일관된 추세`;
      let subDesc='현재 관측된 패턴을 안정적으로 유지하고 있어요.';
      let changeText='';

      if(hasCurrent&&hasPast){
        const diff=currVal-pastVal;
        const diffPct=pastVal>0?(diff/pastVal)*100:(currVal>0?100:0);
        if(Math.abs(diffPct)>=5.0){
          isChanging=true;
          const changeValue=unit==='원'?Math.round(Math.abs(diff)):Number(Math.abs(diff).toFixed(1));
          changeText=`${changeValue.toLocaleString('ko-KR')}${unit} ${diff>0?'증가':'감소'}`;
          if(diff>0){
            trendStatus='up';
            headline=`${periodName} 동안 증가 추세`;
            subDesc=`${prevPeriodName} 평균 ${trendValue(pastVal,unit)} ${unit} 대비 ${changeText}했어요.`;
          }else{
            trendStatus='down';
            headline=`${periodName} 동안 감소 추세`;
            subDesc=`${prevPeriodName} 평균 ${trendValue(pastVal,unit)} ${unit} 대비 ${changeText}했어요.`;
          }
        }else{
          trendStatus='consistent';
          headline=`${periodName} 동안 일관된 추세`;
          subDesc=`${prevPeriodName}과 비슷한 일관된 추세예요.`;
        }
      }else if(hasCurrent){
        headline='이전 기간 비교 데이터 수집 중';
        subDesc='현재 기록을 표시하고 있어요.';
      }else{
        headline='데이터 수집 중';
        subDesc='이 지표를 계산할 기록이 아직 없어요.';
      }

      if(options.total){
        subDesc=subDesc.replace(' 평균 ',' 합계 ');
      }

      return {
        id,name,icon,color,unit,isChanging,trendStatus,headline,subDesc,changeText,
        pastAvg:hasPast?pastVal:null,avg:hasCurrent?currVal:null,
        pastPeriodLabel:`${isYear?`${Number(yearStr)-1}년`:prevPeriodName} ${options.total?'합계':'평균'}`,
        currPeriodLabel:`${isYear?`${yearStr}년`:`${monthNum}월`} ${options.total?'합계':'평균'}`,
        startLabel:isYear?'1월':'1일',
        endLabel:isYear?'12월':`${daysInMonth}일`,
        bars:bars||[]
      };
    };

    const metrics=[
      createMetric('efficiency','평균 전비','⚡','#81e6c5','km/kWh',currEff,pastEff,effBars),
      createMetric('distance','하루 평균 주행거리','🚗','#ff9f0a','km',currDist,prevDist,distBars),
      createMetric('charge_kwh','하루 평균 배터리 충전량','🔌','#30b0c7','kWh',currCharge,prevCharge,chargeBars),
      createMetric('charge_rate','kWh당 충전 단가','💳','#ffd60a','원',currRate,prevRate,rateBars),
      createMetric('drive_soc','하루 평균 주행 배터리 사용률','🔋','#af52de','%',currDriveSoc,prevDriveSoc,driveSocBars),
      createMetric('fast_ratio','완속·급속 충전 중 급속 충전 비율','⚡','#ff453a','%',currFastRatio,prevFastRatio,fastRatioBars)
    ];

    const round=value=>value==null?null:Number(value.toFixed(1));
    const chargeCount=t=>(t.slow_count||0)+(t.fast_count||0)+(t.unknown_count||0);
    const cost100=(t,eff)=>{
      const kwh=t.billed_charge_kwh>0?t.billed_charge_kwh:t.battery_charge_kwh;
      eff=t.efficiency_km_kwh??eff;
      return eff>0&&kwh>0&&t.charge_effective_krw!=null?Math.round(t.charge_effective_krw/kwh/eff*100):null;
    };
    const soc100=t=>t.drive_soc_used_pp!=null&&t.distance_km>0?round(t.drive_soc_used_pp/t.distance_km*100):null;
    const perCharge=t=>chargeCount(t)>0&&t.battery_charge_kwh!=null?round(t.battery_charge_kwh/chargeCount(t)):null;
    const spending=row=>Object.values(row.cost_categories||{}).reduce((sum,v)=>sum+(v.effective_krw||0),0);
    const extraBins=bins.map(()=>[]);
    for(const row of daily){
      const i=isYear?Number(row.day.slice(5,7))-1:Math.floor((Number(row.day.slice(8,10))-1)/2);
      if(extraBins[i])extraBins[i].push(row);
    }
    const observed=(fn)=>bins.map((b,i)=>extraBins[i].length?fn(b,i):null);
    metrics.push(
      createMetric('cost100','100km를 달리는 데 드는 충전 비용 (추정)','💰','#64d2ff','원',cost100(totals,currEff),cost100(prevTotals,pastEff),observed(b=>cost100(b,b.drive_energy_kwh>0?b.energy_distance_km/b.drive_energy_kwh:null)),{}),
      createMetric('total_cost',isYear?'선택한 연도의 총 차량 지출':'선택한 달의 총 차량 지출','💸','#ff9f0a','원',totals.total_cost_krw??null,prevDaily.length?prevTotals.total_cost_krw??null:null,observed((b,i)=>extraBins[i].reduce((sum,r)=>sum+spending(r),0)),{total:true}),
      createMetric('charge_count',isYear?'선택한 연도의 총 충전 횟수':'선택한 달의 총 충전 횟수','🔌','#30b0c7','회',daily.length?chargeCount(totals):null,prevDaily.length?chargeCount(prevTotals):null,observed(b=>chargeCount(b)),{total:true}),
      createMetric('per_charge','충전 1회당 평균 배터리 충전량','🔋','#81e6c5','kWh',perCharge(totals),perCharge(prevTotals),observed(b=>perCharge(b))),
      createMetric('soc100','100km를 달릴 때 사용한 배터리 비율','🚗','#af52de','%',soc100(totals),soc100(prevTotals),observed(b=>soc100(b)),{})
    );
    for(const [category,label] of Object.entries(categories)){
      const current=totals.categories?.[category],past=prevTotals.categories?.[category];
      if(!current&&!past)continue;
      metrics.push(createMetric(`cost_${category}`,`선택한 ${isYear?'연도':'달'}의 ${label} 총지출`,'💳','#ffd60a','원',daily.length?current?.effective_krw??0:null,prevDaily.length?past?.effective_krw??0:null,observed((b,i)=>extraBins[i].reduce((sum,r)=>sum+(r.cost_categories?.[category]?.effective_krw||0),0)),{total:true}));
    }

    if(this.isCombustion()){
      metrics.length=0;
      const f=this.data.fuel_facts||{},pf=this.data.previous?.fuel_facts||{},o=this.data.odometer_facts||{},po=this.data.previous?.odometer_facts||{};
      const fuelBins=fn=>bins.map((_,i)=>{const rows=(f.daily||[]).filter(r=>(isYear?Number(r.day.slice(5,7))-1:Math.floor((Number(r.day.slice(8,10))-1)/2))===i);return rows.length?fn(rows):null;});
      const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]||0),0);
      const distanceBars=bins.map((_,i)=>{const rows=(o.daily||[]).filter(r=>(isYear?Number(r.day.slice(5,7))-1:Math.floor((Number(r.day.slice(8,10))-1)/2))===i);return rows.length?sum(rows,'distance_km'):null;});
      metrics.push(
        createMetric('observed_distance','누적거리 기준 관측 거리','🚗','#7bb6ff','km',o.distance_km??null,po.distance_km??null,distanceBars,{total:true}),
        createMetric('manual_distance','구간 주행 기록 합계 (관측 거리와 중복 합산하지 않음)','🛣️','#7bb6ff','km',totals.distance_km??null,prevTotals.distance_km??null,bins.map(b=>b.day_count?b.distance_km:null),{total:true}),
        createMetric('fuel_liters','기록된 주유량','⛽','#81e6c5','L',f.totals?.fuel_liters??null,pf.totals?.fuel_liters??null,fuelBins(rows=>rows.some(r=>r.fuel_liters!=null)?sum(rows,'fuel_liters'):null),{total:true}),
        createMetric('fuel_price','L당 평균 주유금액','💳','#ffd60a','원',f.totals?.fuel_price_krw_l==null?null:Math.round(f.totals.fuel_price_krw_l),pf.totals?.fuel_price_krw_l==null?null:Math.round(pf.totals.fuel_price_krw_l),fuelBins(rows=>sum(rows,'priced_liters')>0?Math.round(sum(rows,'priced_cost_krw')/sum(rows,'priced_liters')):null)),
        createMetric('fuel_count','주유 기록 횟수','⛽','#81e6c5','회',f.totals?.fuel_count??null,pf.totals?.fuel_count??null,fuelBins(rows=>sum(rows,'fuel_count')),{total:true}),
        createMetric('total_cost','총 차량 지출','💸','#ff9f0a','원',totals.total_cost_krw??null,prevDaily.length?prevTotals.total_cost_krw??null:null,observed((b,i)=>extraBins[i].reduce((n,r)=>n+spending(r),0)),{total:true})
      );
      for(const [key,label] of Object.entries(categories)){if(key==='charging')continue;const current=totals.categories?.[key],past=prevTotals.categories?.[key];if(!current&&!past)continue;metrics.push(createMetric(`cost_${key}`,`${label} 총지출`,'💳',this.categoryColor(key),'원',current?.effective_krw??null,past?.effective_krw??null,observed((b,i)=>extraBins[i].reduce((n,r)=>n+(r.cost_categories?.[key]?.effective_krw||0),0)),{total:true}));}
      const distanceMetric=metrics[0];distanceMetric.subDesc=`관측 구간 ${o.from||'기준 없음'} ~ ${o.to||'기록 없음'} · ${o.warning||'월 경계 밖 주행이 포함될 수 있어요.'}`;distanceMetric.changeText='';
    }
    const changingItems=metrics.filter(m=>m.isChanging);
    const stableItems=metrics.filter(m=>!m.isChanging);

    changingContainer.classList.toggle('single-item',changingItems.length===1);

    if(changingItems.length===0){
      changingContainer.innerHTML='<div class="trends-empty-pill" style="grid-column: 1 / -1;">최근 감지된 유의미한 변동이 없어요.</div>';
    }else{
      changingContainer.innerHTML=changingItems.map(m=>this.renderTrendCard(m)).join('');
    }

    stableContainer.innerHTML=stableItems.map(m=>this.renderTrendCard(m)).join('');
  }
  generateTrendCardChartHtml(m){
    if(m.avg==null)return '<div class="trends-empty-pill">데이터 수집 중</div>';
    const bars=m.bars||[];
    const isChanging=m.isChanging&&m.pastAvg!=null;
    const maxVal=Math.max(1,...bars,m.avg||0,(m.pastAvg||0))*1.25;
    const n=Math.max(1,bars.length);

    const barElements=bars.map((val,idx)=>{
      if(val==null)return '';
      const heightPct=Math.max(3,(val/maxVal)*100);
      const stepPct=100/n;
      const barWPct=stepPct*0.58;
      const xPct=idx*stepPct+(stepPct-barWPct)/2;
      const yPct=100-heightPct;
      return `<rect x="${xPct.toFixed(2)}%" y="${yPct.toFixed(2)}%" width="${barWPct.toFixed(2)}%" height="${heightPct.toFixed(2)}%" rx="2" fill="rgba(255,255,255,0.18)"><title>${trendValue(val,m.unit)}${m.unit}</title></rect>`;
    }).join('');

    let baselineLinesSvg='';
    let overlayLabelsHtml='';
    let axisLabelsHtml='';

    if(isChanging){
      const pastYPct=Math.max(8,Math.min(92,(1-m.pastAvg/maxVal)*100));
      const currYPct=Math.max(8,Math.min(92,(1-m.avg/maxVal)*100));
      const splitXPct=((n-4)/n)*100;

      baselineLinesSvg=`
        <line x1="0%" y1="${pastYPct.toFixed(1)}%" x2="${(splitXPct-1.5).toFixed(1)}%" y2="${pastYPct.toFixed(1)}%" stroke="#718698" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="${(splitXPct+1.5).toFixed(1)}%" y1="${currYPct.toFixed(1)}%" x2="100%" y2="${currYPct.toFixed(1)}%" stroke="${m.color}" stroke-width="4" stroke-linecap="round"/>
      `;

      overlayLabelsHtml=`
        <span class="trend-chart-avg-label pos-left" style="top:${pastYPct.toFixed(1)}%; color:#8fa4b5;">${trendValue(m.pastAvg,m.unit)}${m.unit}</span>
        <span class="trend-chart-avg-label pos-right" style="top:${currYPct.toFixed(1)}%; color:${m.color};">${trendValue(m.avg,m.unit)}${m.unit}</span>
      `;

      axisLabelsHtml=`
        <div class="trend-chart-axis-labels">
          <span style="color:#718698;">${m.pastPeriodLabel}</span>
          <span style="color:${m.color}; font-weight:750;">${m.currPeriodLabel}</span>
        </div>
      `;
    }else{
      const avgYPct=Math.max(8,Math.min(92,(1-m.avg/maxVal)*100));

      baselineLinesSvg=`
        <line x1="0%" y1="${avgYPct.toFixed(1)}%" x2="100%" y2="${avgYPct.toFixed(1)}%" stroke="${m.color}" stroke-width="4" stroke-linecap="round"/>
      `;

      overlayLabelsHtml=`
        <span class="trend-chart-avg-label pos-left" style="top:${avgYPct.toFixed(1)}%; color:${m.color};">${trendValue(m.avg,m.unit)}${m.unit}</span>
      `;

      axisLabelsHtml=`
        <div class="trend-chart-axis-labels">
          <span>${m.startLabel}</span>
          <span>${m.endLabel}</span>
        </div>
      `;
    }

    return `
      <div class="trend-chart-box">
        <div class="trend-chart-svg-wrap">
          <svg class="trend-chart-svg" width="100%" height="100%">
            <g>${barElements}</g>
            ${baselineLinesSvg}
          </svg>
          ${overlayLabelsHtml}
        </div>
        ${axisLabelsHtml}
      </div>
    `;
  }
  renderTrendCard(m){
    const chartHtml=this.generateTrendCardChartHtml(m);
    const changeIndex=m.changeText?m.subDesc.indexOf(m.changeText):-1;
    const summaryHtml=changeIndex<0?esc(m.subDesc):`${esc(m.subDesc.slice(0,changeIndex))}<strong class="trend-change">${esc(m.changeText)}</strong>${esc(m.subDesc.slice(changeIndex+m.changeText.length))}`;
    const headlineHtml=esc(m.headline).replace(/증가|감소|일관/g,word=>`<strong class="trend-direction">${word}</strong>`);
    return `
      <article class="trend-card" data-trend="${esc(m.id)}" style="--trend-color:${m.color};">
        <div class="trend-card-top">
          <div class="trend-title-group">
            <span class="trend-badge-icon">${m.icon}</span>
            <span class="trend-metric-name" style="color:${m.color};">${esc(m.name)}</span>
          </div>
          <span class="trend-arrow">›</span>
        </div>
        <h4 class="trend-headline">${headlineHtml}</h4>
        <p class="trend-card-summary">${summaryHtml}</p>
        <div class="trend-divider"></div>
        ${chartHtml}
      </article>
    `;
  }
  async loadThumbnails(){
    if(!this.data?.records?.length||!this._hass?.fetchWithAuth)return;
    const recordsWithPhotos=this.data.records.filter(r=>r.attachments?.length);
    for(const r of recordsWithPhotos){
      const thumbBox=this.shadowRoot?.querySelector(`.thumb-box[data-thumb-record="${r.id}"]`);
      if(!thumbBox)continue;
      const photo=r.attachments[0];
      if(!photo?.id)continue;
      let url=this.thumbnailCache.get(photo.id);
      if(!url){
        try{
          const res=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments/${encodeURIComponent(photo.id)}`);
          if(res.ok){
            const blob=await res.blob();
            url=URL.createObjectURL(blob);
            this.thumbnailCache.set(photo.id,url);
          }
        }catch(e){
          console.warn('[carrot-vehicle-journal] Thumbnail load failed:',photo.id,e);
        }
      }
      if(url){
        thumbBox.innerHTML=`<img src="${url}" alt="${esc(photo.name||'사진 썸네일')}" loading="lazy" />`;
      }
    }
  }
  openPhotoViewer(record,initialIndex=0){
    if(!record?.attachments?.length)return;
    this.lightboxRecord=record;
    this.lightboxIndex=Math.max(0,Math.min(initialIndex,record.attachments.length-1));
    this.renderLightboxPhoto();
    this.$('photoViewerDialog')?.showModal();
  }
  stepLightbox(delta){
    if(!this.lightboxRecord?.attachments?.length)return;
    const len=this.lightboxRecord.attachments.length;
    this.lightboxIndex=(this.lightboxIndex+delta+len)%len;
    this.renderLightboxPhoto();
  }
  async renderLightboxPhoto(){
    if(!this.lightboxRecord?.attachments?.length)return;
    const photos=this.lightboxRecord.attachments;
    const photo=photos[this.lightboxIndex];
    if(!photo)return;

    const countStr=photos.length>1?` (${this.lightboxIndex+1} / ${photos.length})`:'';
    if(this.$('lightboxTitle'))this.$('lightboxTitle').textContent=`사진${countStr}`;
    if(this.$('lightboxMeta'))this.$('lightboxMeta').textContent=photo.name||'';

    const caption=this.lightboxRecord.memo||this.lightboxRecord.subcategory||'';
    if(this.$('lightboxCaption')){
      this.$('lightboxCaption').textContent=caption?`메모: ${caption}`:'';
      this.$('lightboxCaption').hidden=!caption;
    }

    const hasMultiple=photos.length>1;
    if(this.$('lightboxPrev'))this.$('lightboxPrev').hidden=!hasMultiple;
    if(this.$('lightboxNext'))this.$('lightboxNext').hidden=!hasMultiple;

    const img=this.$('lightboxImg');
    const spinner=this.$('lightboxSpinner');
    if(!img)return;

    let url=this.thumbnailCache.get(photo.id);
    if(url){
      img.src=url;
      img.hidden=false;
      if(spinner)spinner.hidden=true;
      return;
    }

    img.hidden=true;
    if(spinner){spinner.hidden=false;spinner.textContent='사진을 불러오고 있어요...';}
    try{
      const res=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments/${encodeURIComponent(photo.id)}`);
      if(!res.ok)throw new Error('사진을 불러오지 못했어요.');
      const blob=await res.blob();
      url=URL.createObjectURL(blob);
      this.thumbnailCache.set(photo.id,url);
      img.src=url;
      img.hidden=false;
      if(spinner)spinner.hidden=true;
    }catch(e){
      if(spinner){spinner.hidden=false;spinner.textContent=e.message||'사진 로딩 실패';}
    }
  }
  showPhotos(record){
    this.openPhotoViewer(record);
  }
  getFavoriteVehicle(){try{return localStorage.getItem('carrot_journal_favorite_vehicle');}catch{return null;}}
  setFavoriteVehicle(entryId){try{if(entryId)localStorage.setItem('carrot_journal_favorite_vehicle',entryId);else localStorage.removeItem('carrot_journal_favorite_vehicle');}catch{}}
  vehicleOptions(){const fav=this.getFavoriteVehicle();return this.entries.map(e=>`<option value="${esc(e.entry_id)}">${esc(e.title)}${e.entry_id===fav?' ★':''}</option>`).join('')+'<option value="__add__">＋ 새 차량 추가</option>';}
  updateDefaultVehicleButton(){const btn=this.$('pinDefault');if(!btn)return;const fav=this.getFavoriteVehicle();const isFav=!!(this.entry&&this.entry===fav);btn.classList.toggle('active',isFav);btn.textContent=isFav?'★':'☆';btn.title=isFav?'즐겨찾기 기본 차량으로 설정되어 있어요':'현재 차량을 즐겨찾기 기본 차량으로 지정';btn.setAttribute('aria-label',btn.title);}
  async refreshVehicles(selected){this.entries=await this._hass.callWS({type:'carrot_ha/journal/entries'});const fav=this.getFavoriteVehicle();const favExists=fav&&this.entries.some(e=>e.entry_id===fav);this.entry=selected||this.entries.find(e=>e.entry_id===this.entry)?.entry_id||(favExists?fav:null)||this.entries.find(e=>e.is_default)?.entry_id||this.entries[0]?.entry_id;this.$('entry').innerHTML=this.vehicleOptions();this.$('entry').value=this.entry||'__add__';this.updateDefaultVehicleButton();this.offset=0;await this.load(true);}
  resetVehiclePreview(){this.vehiclePreview=null;this.$('importPreview').hidden=true;this.$('importPreview').replaceChildren();this.$('createVehicle').textContent='지금부터 기록할게요';this.$('vehicleImportFile').value='';}
  openVehicle(){this.$('vehicleForm').reset();this.resetVehiclePreview();this.$('vehicleError').textContent='';this.$('vehicleDialog').showModal();}
  chooseVehicleFile(kind){this.importKind=kind;this.$('vehicleImportFile').accept=kind==='michael'?'.xlsx,.xls':'.zip';this.$('vehicleImportFile').value='';this.$('vehicleImportFile').click();}
  async previewVehicleFile(){const file=this.$('vehicleImportFile').files[0];if(!file)return;this.resetVehiclePreview();const body=new FormData();body.append('kind',this.importKind);body.append('fuel',this.$('newVehicleFuel').value);body.append('file',file);this.$('createVehicle').disabled=true;this.$('vehicleError').textContent='파일을 분석하고 있어요.';try{const response=await this._hass.fetchWithAuth('/api/carrot_ha/v1/journal/import-preview',{method:'POST',body});const result=await response.json();if(!response.ok)throw Error(result.error||'파일을 읽지 못했어요.');if(!this.$('vehicleDialog').open)return;this.vehiclePreview=result;if(result.vehicle?.fuel!==undefined&&result.vehicle.fuel!==this.$('newVehicleFuel').value)throw Error('스냅샷 유종과 선택한 유종이 달라요. 유종을 바꾸고 다시 선택해 주세요.');const summary=result.summary;this.$('importPreview').hidden=false;this.$('importPreview').innerHTML=`<h3>이관 미리보기</h3><p>${numeric(summary.count,0)}건 · ${esc(summary.from||'날짜 없음')} ~ ${esc(summary.to||'날짜 없음')} · ${money(summary.total_krw)}</p><p class="note">${(result.warnings||[]).map(esc).join('<br>')}</p>${(result.sample||[]).map(r=>`<div class="list-row"><span>${esc(r.date)} · ${esc(categories[r.category]||'누적주행거리')} · ${esc(r.subcategory)}${r.location?`<small>${esc(r.location)}</small>`:''}</span><strong>${money(r.actual_krw)}</strong></div>`).join('')}`;this.$('createVehicle').textContent='이관 시작 · 차량 추가';this.$('vehicleError').textContent='';}catch(e){this.resetVehiclePreview();this.$('vehicleError').textContent=e.message;}finally{this.$('createVehicle').disabled=false;}}
  async createVehicle(event){event.preventDefault();this.$('createVehicle').disabled=true;try{const result=await this._hass.callWS({type:'carrot_ha/journal/vehicle/create',title:this.$('newVehicleTitle').value.trim(),fuel:this.$('newVehicleFuel').value,preview_token:this.vehiclePreview?.token||''});this.$('vehicleDialog').close();await this.refreshVehicles(result.entry_id);this.$('message').textContent=result.imported?`${numeric(result.imported,0)}건을 이관했어요.`:'차량을 추가했어요.';}catch(e){this.$('vehicleError').textContent=e.message||'차량을 추가하지 못했어요.';}finally{this.$('createVehicle').disabled=false;}}
  async openVehicleManagement(){this.$('vehicleManageError').textContent='';this.$('vehicleManageDialog').showModal();this.selectSettingsSection(this.settingsSection||'vehicles');try{this.managedVehicles=await this._hass.callWS({type:'carrot_ha/journal/entries',include_deleted:true});this.$('vehicleManageList').innerHTML=this.managedVehicles.map(v=>`<section class="panel ${v.deleted?'vehicle-trashed':''}" data-vehicle="${esc(v.entry_id)}"><label>차량 이름<input data-title value="${esc(v.title)}" maxlength="80"></label><label>유종<select data-fuel>${Object.entries({gasoline:'휘발유',diesel:'경유',hybrid:'하이브리드',electric:'전기'}).map(([k,n])=>`<option value="${k}" ${k===(v.fuel||'electric')?'selected':''}>${n}</option>`).join('')}</select></label><small>${v.unavailable?'기록 DB 초기화 오류 · 기록을 불러오지 못했어요.':v.deleted?'휴지통 · 기록과 사진을 보관하고 있어요.':v.linked?'기기 연결 유지':'수동 기록 차량'}${v.is_default?' · ★ 내 기본 차량':''}</small><div class="row"><button type="button" data-vehicle-action="save">변경 저장</button><button type="button" data-vehicle-action="default" ${v.deleted||v.unavailable?'disabled':''}>${v.is_default?'★ 기본 차량':'기본 차량으로 지정'}</button><button type="button" data-vehicle-action="status">${v.deleted?'차량 복원':'휴지통으로 이동'}</button>${v.deleted&&!v.linked?'<button type="button" class="vehicle-delete" data-vehicle-action="delete">영구 삭제</button>':''}</div></section>`).join('')||'<p>등록된 차량이 없어요.</p>';this.$('snapshotVehicleList').innerHTML=this.managedVehicles.map(v=>`<div class="settings-backup-row ${v.deleted?'vehicle-trashed':''}" data-vehicle="${esc(v.entry_id)}"><span>${esc(v.title)}${v.deleted?' · 휴지통':''}</span><button type="button" data-vehicle-action="snapshot" ${v.unavailable?'disabled':''}>스냅샷 다운로드</button></div>`).join('');await this.loadJournalSettings();}catch(e){this.$('vehicleManageError').textContent=e.message;}}
  async manageVehicleAction(event){const button=event.target.closest('[data-vehicle-action]');if(!button)return;const item=button.closest('[data-vehicle]'),key=item.dataset.vehicle,v=this.managedVehicles.find(x=>x.entry_id===key);button.disabled=true;try{if(button.dataset.vehicleAction==='snapshot'){const response=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(key)}/snapshot`);if(!response.ok)throw Error('스냅샷을 만들지 못했어요.');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='carrot-journal-snapshot.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}else if(button.dataset.vehicleAction==='default'){await this._hass.callWS({type:'carrot_ha/journal/user_default/set',entry_id:key});await this.refreshVehicles(key);await this.openVehicleManagement();}else if(button.dataset.vehicleAction==='delete'){if(!v.deleted||v.linked)throw Error('휴지통의 수동 등록 차량만 영구 삭제할 수 있어요.');if(!window.confirm(`${v.title} 차량을 정말 삭제하시겠습니까?\n확인을 누르면 차량·기록·사진이 영구 삭제되며 복원은 불가능합니다.`))return;await this._hass.callWS({type:'carrot_ha/journal/vehicle/delete',entry_id:key,confirm:true});await this.refreshVehicles();await this.openVehicleManagement();}else{await this._hass.callWS({type:'carrot_ha/journal/vehicle/update',entry_id:key,title:item.querySelector('[data-title]').value,fuel:item.querySelector('[data-fuel]').value,deleted:button.dataset.vehicleAction==='status'?!v.deleted:!!v.deleted});await this.refreshVehicles();await this.openVehicleManagement();}}catch(e){this.$('vehicleManageError').textContent=e.message;}finally{button.disabled=false;}}
  selectSettingsSection(section){this.settingsSection=section;for(const button of this.shadowRoot.querySelectorAll('[data-settings-nav]')){const selected=button.dataset.settingsNav===section;button.classList.toggle('active',selected);button.setAttribute('aria-current',selected?'page':'false');}for(const pane of this.shadowRoot.querySelectorAll('[data-settings-pane]'))pane.hidden=pane.dataset.settingsPane!==section;}
  async loadJournalSettings(){const result=await this.call('settings');this.$('kakaoKey').value=result.map_key||'';this.savedKeySettings={map_key:result.map_key||'',kakao_rest_key:result.kakao_rest_key||'',opinet_key:result.opinet_key||''};this.$('opinetKey').value=this.savedKeySettings.opinet_key;this.$('kakaoRestKey').value=this.savedKeySettings.kakao_rest_key;this.$('kakaoRestStatus').textContent=result.kakao_rest_configured?'REST 키가 저장되어 있어요.':'REST 키가 아직 없어요.';this.$('opinetStatus').textContent=result.opinet_configured?'키가 저장되어 있어요. 새 키 입력 시 교체해요.':'키가 아직 등록되지 않았어요.';this.automaticLocations=result.automatic_locations!==false;this.$('automaticLocations').checked=this.automaticLocations;this.$('nasEnabled').checked=!!result.backup_config?.enabled;this.$('nasPath').value=result.backup_config?.path||'/share/CarrotJournalBackup/vehicle-journal';this.renderNasStatus(result.backup_state);this.renderBackupStatus(result.backup_entities);}
  async saveJournalSettings(params){if(Object.entries(params).every(([key,value])=>value===this.savedKeySettings?.[key])){this.$('vehicleManageError').textContent='변경된 내용이 없어요.';return;}if(!window.confirm(Object.values(params).every(value=>value==='')?'등록된 API 키를 제거하시겠습니까?':'변경한 API 키를 저장하시겠습니까?'))return;try{await this.call('settings',params);await this.loadJournalSettings();this.$('vehicleManageError').textContent='설정을 저장했어요. 지도 키 변경 후에는 화면을 새로고침해 주세요.';}catch(e){this.$('vehicleManageError').textContent=e.message;}}
  async kakaoMaps(){const config=await this.call('map/config');this.kakaoRestConfigured=!!config.rest_configured;if(!config.key)throw Error('차량 관리 → 지도 설정에 카카오 JavaScript 키를 등록해 주세요.');if(window.__journalKakaoKey&&window.__journalKakaoKey!==config.key)throw Error('지도 키가 변경됐어요. 화면을 새로고침해 주세요.');if(!window.__journalKakao){window.__journalKakaoKey=config.key;window.__journalKakao=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(config.key)}&autoload=false&libraries=services`;const timer=setTimeout(()=>reject(Error('지도를 불러오지 못했어요. 키와 허용 도메인을 확인해 주세요.')),10000);script.onload=()=>{if(!window.kakao?.maps){clearTimeout(timer);reject(Error('카카오 지도 설정을 확인해 주세요.'));return;}window.kakao.maps.load(()=>{clearTimeout(timer);resolve(window.kakao.maps);});};script.onerror=()=>{clearTimeout(timer);reject(Error('지도를 불러오지 못했어요.'));};document.head.append(script);}).catch(e=>{window.__journalKakao=null;window.__journalKakaoKey=null;throw e;});}return window.__journalKakao;}
  renderLocation(){this.locationGeneration=(this.locationGeneration||0)+1;const hasLoc=!!this.draftLocation;this.$('addLocation').hidden=hasLoc;this.$('locationEditor').hidden=!hasLoc;if(this.$('removeLocation'))this.$('removeLocation').hidden=!hasLoc;this.$('placeResults').replaceChildren();const addr=this.draftLocation?.address||'',name=this.draftLocation?.name||'',summaryText=addr||name||'';this.$('locationSummary').textContent=summaryText;this.$('locationSummary').hidden=!summaryText;if(this.$('selectedLocAddress')){if(addr){this.$('selectedLocAddress').textContent=addr;this.$('selectedLocAddress').classList.remove('empty');}else if(this.draftLocation?.latitude!=null){this.$('selectedLocAddress').textContent='지도에서 직접 지정한 위치';this.$('selectedLocAddress').classList.remove('empty');}else{this.$('selectedLocAddress').textContent='검색 결과에서 선택하거나 지도에서 지정해 주세요.';this.$('selectedLocAddress').classList.add('empty');}}if(!this.draftLocation){this.locationMap=null;this.locationMarker=null;this.$('locationMap').replaceChildren();return;}this.$('locationName').value=name;if(!this.$('placeQuery').value.trim()){this.$('placeQuery').value=name;}this.showLocationMap();}
  async showLocationMap(){const generation=this.locationGeneration;try{const maps=await this.kakaoMaps();if(generation!==this.locationGeneration||!this.draftLocation||!this.$('recordDialog').open)return;if(this.draftLocation.latitude==null||this.draftLocation.longitude==null){this.locationMap=null;this.locationMarker=null;this.$('locationMap').replaceChildren();this.$('locationMap').style.display='none';this.$('locationHint').textContent='장소명만 보존된 기록이에요. 검색 후 맞는 장소를 선택하면 지도 핀이 표시되고, 저장하면 위치가 기록돼요.';return;}const lat=this.draftLocation.latitude??37.5665,lon=this.draftLocation.longitude??126.978;this.$('locationMap').replaceChildren();this.$('locationMap').style.display='block';this.locationMap=new maps.Map(this.$('locationMap'),{center:new maps.LatLng(lat,lon),level:4});this.locationMarker=new maps.Marker({position:new maps.LatLng(lat,lon)});if(this.draftLocation.latitude!=null)this.locationMarker.setMap(this.locationMap);maps.event.addListener(this.locationMap,'click',e=>{if(!this.draftLocation)return;this.setLocation({name:this.$('locationName').value||'직접 지정한 위치',address:'',latitude:e.latLng.getLat(),longitude:e.latLng.getLng()},maps);});this.$('locationHint').textContent='지도를 클릭하거나 터치해 위치를 지정할 수 있어요.';}catch(e){this.$('locationMap').replaceChildren();this.$('locationMap').style.display='none';this.$('locationHint').textContent=e.message;}}
  setLocation(place,maps){this.locationGeneration=(this.locationGeneration||0)+1;this.draftLocation={...place,selection_source:'manual'};this.setDraftDirty(true);this.$('locationName').value=place.name;const summaryText=place.address||place.name;this.$('locationSummary').textContent=summaryText;this.$('locationSummary').hidden=!summaryText;if(this.$('removeLocation'))this.$('removeLocation').hidden=false;if(this.$('selectedLocAddress')){if(place.address){this.$('selectedLocAddress').textContent=place.address;this.$('selectedLocAddress').classList.remove('empty');}else if(place.latitude!=null){this.$('selectedLocAddress').textContent='지도에서 직접 지정한 위치';this.$('selectedLocAddress').classList.remove('empty');}else{this.$('selectedLocAddress').textContent='검색 결과에서 선택하거나 지도에서 지정해 주세요.';this.$('selectedLocAddress').classList.add('empty');}}const pos=new maps.LatLng(place.latitude,place.longitude);this.locationMarker.setPosition(pos);this.locationMarker.setMap(this.locationMap);this.locationMap.setCenter(pos);this.refreshStationPrice();}
  async openLocationPicker(){try{const maps=await this.kakaoMaps();if(!this.draftLocation||!this.$('recordDialog').open)return;this.$('locationMap').style.display='block';if(!this.locationMap){this.locationMap=new maps.Map(this.$('locationMap'),{center:new maps.LatLng(37.5665,126.978),level:4});this.locationMarker=new maps.Marker({position:new maps.LatLng(37.5665,126.978)});maps.event.addListener(this.locationMap,'click',e=>this.setLocation({name:this.$('locationName').value||'직접 지정한 위치',address:'',latitude:e.latLng.getLat(),longitude:e.latLng.getLng()},maps));}this.$('locationHint').textContent='지도를 클릭해 위치를 지정하고 기록을 저장해 주세요.';}catch(e){this.$('locationHint').textContent=e.message;}}
  async searchLocation(){const query=this.$('placeQuery').value.trim();if(!query)return;const generation=this.locationGeneration;this.$('placeSearch').disabled=true;try{const maps=await this.kakaoMaps();if(generation!==this.locationGeneration)return;if(!this.locationMap){this.$('locationMap').style.display='block';this.locationMap=new maps.Map(this.$('locationMap'),{center:new maps.LatLng(37.5665,126.978),level:4});this.locationMarker=new maps.Marker({position:new maps.LatLng(37.5665,126.978)});maps.event.addListener(this.locationMap,'click',e=>this.setLocation({name:this.$('locationName').value||'직접 지정한 위치',address:'',latitude:e.latLng.getLat(),longitude:e.latLng.getLng()},maps));}if(this.kakaoRestConfigured){const places=await this.call('location/search',{query});if(generation!==this.locationGeneration||!this.$('recordDialog').open)return;this.$('placeResults').replaceChildren();for(const place of places){const button=document.createElement('button');button.type='button';button.className='place-result-item';const nameSpan=document.createElement('span');nameSpan.className='place-result-name';nameSpan.textContent=place.name;const addrSpan=document.createElement('span');addrSpan.className='place-result-addr';addrSpan.textContent=place.address;button.append(nameSpan,addrSpan);button.onclick=()=>{this.setLocation(place,maps);this.$('placeResults').replaceChildren();};this.$('placeResults').append(button);}if(!places.length)this.$('locationHint').textContent='검색 결과가 없어요.';return;}await new Promise(resolve=>new maps.services.Places().keywordSearch(query,(data,status)=>{if(generation===this.locationGeneration&&this.$('recordDialog').open){this.$('placeResults').replaceChildren();if(status!==maps.services.Status.OK){this.$('locationHint').textContent='검색 결과가 없거나 요청이 제한됐어요.';}else{for(const place of data.slice(0,10)){const b=document.createElement('button');b.type='button';b.className='place-result-item';const nameSpan=document.createElement('span');nameSpan.className='place-result-name';nameSpan.textContent=place.place_name;const addrSpan=document.createElement('span');addrSpan.className='place-result-addr';addrSpan.textContent=place.road_address_name||place.address_name;b.append(nameSpan,addrSpan);b.onclick=()=>{this.setLocation({name:place.place_name,address:place.road_address_name||place.address_name,latitude:Number(place.y),longitude:Number(place.x)},maps);this.$('placeResults').replaceChildren();};this.$('placeResults').append(b);}}}resolve();}));}catch(e){this.$('locationHint').textContent=e.message;}finally{this.$('placeSearch').disabled=false;}}
  setDraftDirty(dirty){
    this.draftDirty=dirty;
    this.updateSaveButtonVisibility();
  }
  updateSaveButtonVisibility(){
    const btn=this.$('save');
    if(!btn)return;
    if(this.editing){
      btn.hidden=!this.draftDirty;
    }else{
      btn.hidden=false;
    }
  }
  formFields(){const mode=this.recordMode||'maintenance',kind=this.$('kind').value||'expense',form=this.$('recordForm'),dedicated=mode!=='maintenance';
    const visible=new Set(['dateField','memoField','recordPhotoField','importSourceDetails']);
    if(!dedicated){for(const id of ['categoryField','subcategoryField','amountField','recordLocationField'])visible.add(id);if(this.isCombustion())visible.add('odometerField');}
    if(['washing','accident','refueling','charging'].includes(mode)){visible.add('amountField');visible.add('recordLocationField');}
    if(mode==='washing')visible.add('odometerField');
    if(mode==='refueling')for(const id of ['odometerField','fuelTypeField','unitPriceField','fuelLitersField','tankModeField','washCostField'])visible.add(id);
    if(mode==='charging')for(const id of ['odometerField','billedField','unitPriceField'])visible.add(id);
    if(mode==='trip'){visible.clear();for(const id of ['dateField','odometerField','recordPhotoField'])visible.add(id);}
    if(kind==='charge')for(const id of ['chargeField','modeField','billedField','startField','endField','socStartField','socEndField'])visible.add(id);
    for(const id of ['memoField','recordPhotoField','importSourceDetails','categoryField','subcategoryField','amountField','recordLocationField','odometerField','distanceField','energyField','chargeField','modeField','billedField','startField','endField','socStartField','socEndField','driveModeField','fuelTypeField','unitPriceField','fuelLitersField','tankModeField','washCostField']){const field=this.$(id);field.hidden=!visible.has(id);for(const control of field.querySelectorAll('input:not([type=file]),select,textarea'))control.disabled=field.hidden;}
    form.elements.odometer_km.required=mode==='trip';this.$('odometerField').childNodes[0].textContent=mode==='trip'?'계기판 누적거리 · km':'계기판 누적거리 · km (선택)';
    form.elements.fuel_type.required=mode==='refueling';this.$('actualKrw').required=!['trip','accident'].includes(mode);this.$('amountField').childNodes[0].textContent={refueling:'주유금액 · 원',charging:'충전금액 · 원',washing:'세차비 · 원',accident:'사고 처리 금액 · 원 (선택)'}[mode]||'실제 금액 · 원';
    this.$('billedField').childNodes[0].textContent='청구 충전량 · kWh';
    const container=form.querySelector('.fields');this.originalFieldOrder=this.originalFieldOrder||[...container.children];for(const node of this.originalFieldOrder)container.append(node);
    if(dedicated){const order=mode==='refueling'?['dateField','odometerField','fuelTypeField','unitPriceField','amountField','fuelLitersField','tankModeField','washCostField','driveModeField','distanceField',...(mode==='accident'?['recordPhotoField']:[]),'memoField',...(mode!=='accident'?['recordPhotoField']:[]),'recordLocationField','importSourceDetails']:['dateField','odometerField','amountField','billedField','unitPriceField','fuelTypeField','fuelLitersField','tankModeField','washCostField','driveModeField','distanceField',...(mode==='accident'?['recordPhotoField']:[]),'memoField',...(mode!=='accident'?['recordPhotoField']:[]),'recordLocationField','importSourceDetails'];for(const id of order){const node=this.$(id);if(node)container.append(node);}}
    if(mode==='trip'){container.append(this.$('memoField'),this.$('recordPhotoField'),this.$('recordLocationField'));}
    this.$('recordPhotoField').querySelector('small').textContent=`사진당 20MiB 이하, 최대 ${mode==='trip'?1:mode==='accident'?10:5}장. 저장할 때 축소·압축해요.`;
    const note=this.$('recordDialog').querySelector('.modal-scroll-body>.note');if(note)note.textContent=mode==='trip'?'계기판에 표시된 누적 주행거리를 입력해 주세요.':'모르는 소비량·시각은 비워 주세요. 자동 기록과 겹치는 날짜는 저장 전에 확인해 주세요.';
    this.updateSaveButtonVisibility();
  }
  renderSelectedPhotos(){
    for(const url of this.photoURLs||[])URL.revokeObjectURL(url);
    this.photoURLs=[];this.$('photoPreview').replaceChildren();const generation=this.photoPreviewGeneration=(this.photoPreviewGeneration||0)+1;
    const existing=(this.editing?.attachments||[]).filter(p=>!this.removedPhotoIds?.has(p.id));
    this.$('photoCount').textContent=`${(this.selectedPhotos?.length||0)+((this.editing?.attachments||[]).filter(p=>!this.removedPhotoIds?.has(p.id)).length)}/${this.recordMode==='trip'?1:this.recordMode==='accident'?10:5}`;
    this.$('clearPhotos').hidden=!this.selectedPhotos?.length;
    this.$('recordError').textContent='';
    for(const photo of existing){
      const item=document.createElement('div'),img=document.createElement('img'),button=document.createElement('button');
      item.className='photo-thumb-wrapper';img.alt=photo.name||'저장된 사진';
      button.type='button';button.className='btn-thumb-remove';button.textContent='✕';button.setAttribute('aria-label',(photo.name||'저장된')+' 사진 삭제');
      button.onclick=e=>{e.preventDefault();this.removedPhotoIds.add(photo.id);this.setDraftDirty(true);this.renderSelectedPhotos();};
      item.append(img,button);this.$('photoPreview').append(item);
      Promise.resolve().then(()=>this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments/${encodeURIComponent(photo.id)}`)).then(async response=>{
        if(!response.ok)throw Error('사진을 불러오지 못했어요.');const blob=await response.blob();
        if(generation!==this.photoPreviewGeneration||!this.$('recordDialog').open||!this.isConnected)return;
        const url=URL.createObjectURL(blob);this.photoURLs.push(url);img.src=url;
      }).catch(()=>{if(generation===this.photoPreviewGeneration)img.alt='불러오지 못한 사진 · '+(photo.name||'');});
    }
    for(const [index,file] of (this.selectedPhotos||[]).entries()){
      const item=document.createElement('div'),img=document.createElement('img'),button=document.createElement('button');
      item.className='photo-thumb-wrapper';
      const url=URL.createObjectURL(file);this.photoURLs.push(url);img.src=url;img.alt=file.name;
      button.type='button';button.className='btn-thumb-remove';button.textContent='✕';button.setAttribute('aria-label',file.name+' 사진 선택 취소');
      button.onclick=e=>{e.preventDefault();this.selectedPhotos.splice(index,1);this.$('photos').value='';this.renderSelectedPhotos();this.setDraftDirty(true);};
      item.append(img,button);this.$('photoPreview').append(item);
    }
  }
  chooseRecordType(){const ice=this.isCombustion();const choices=[[ice?'refueling':'charging',ice?'주유 기록':'충전 기록'],['maintenance','정비/기타 기록'],['washing','세차 기록'],['trip','주행 기록'],['accident','사고 기록'],...(ice?[['receipt','주유 영수증 촬영']]:[])];this.$('recordTypeChoices').innerHTML=choices.map(([key,label])=>`<button type="button" class="type-card" data-record-type="${key}"><div class="type-icon-box tint-${key==='refueling'?'energy':key}">${recordTypeIcons[key]||''}</div><div class="type-text-wrap"><span class="type-main-title">${esc(label)}</span><span class="type-sub-title">${esc(recordTypeDescs[key]||'')}</span></div><span class="type-chevron">›</span></button>`).join('');this.$('recordTypeDialog').showModal();}
  estimateFuelLiters(){if(this.recordMode!=='refueling'||this.fuelLitersEdited||this.suppressFuelEstimation)return;const f=this.$('recordForm').elements,amount=Number(f.actual_krw.value.replaceAll(',','')),price=Number(f.unit_price_krw.value.replaceAll(',',''));if(amount>0&&price>0){f.fuel_liters.value=(amount/price).toFixed(3);this.fuelQuantitySource='estimated';}}
  markAutoFilled(labelId,inputElem){
    if(inputElem)inputElem.classList.add('auto-filled');
    const label=this.$(labelId);
    if(label&&!label.querySelector('.auto-filled-badge')){
      const badge=document.createElement('span');
      badge.className='auto-filled-badge';badge.textContent='자동입력';
      label.append(badge);
    }
  }
  unmarkAutoFilled(labelId,inputElem){
    if(inputElem)inputElem.classList.remove('auto-filled');
    const label=this.$(labelId);
    if(label){const b=label.querySelector('.auto-filled-badge');if(b)b.remove();}
  }
  markAutoFilledLocation(){
    const sec=this.$('selectedLocSection');
    if(sec){
      sec.classList.add('loc-auto-filled');
      if(!sec.querySelector('.auto-filled-badge')){
        const badge=document.createElement('span');
        badge.className='auto-filled-badge';badge.textContent='영수증 위치 자동인식';
        sec.querySelector('.selected-loc-badge')?.append(badge);
      }
    }
  }
  clearAutoFilledStyles(){
    for(const el of this.shadowRoot.querySelectorAll('.auto-filled'))el.classList.remove('auto-filled');
    for(const el of this.shadowRoot.querySelectorAll('.loc-auto-filled'))el.classList.remove('loc-auto-filled');
    for(const b of this.shadowRoot.querySelectorAll('.auto-filled-badge'))b.remove();
  }
  cancelReceiptOcr(){
    this.ocrGeneration=(this.ocrGeneration||0)+1;
    if(this.ocrCloseTimer){clearTimeout(this.ocrCloseTimer);this.ocrCloseTimer=null;}
    if(this.ocrAbortController){this.ocrAbortController.abort();this.ocrAbortController=null;}
    const overlay=this.$('receiptOcrOverlay');if(overlay)overlay.hidden=true;
  }
  async handleReceiptPhoto(file){
    if(!file)return;
    this.ocrGeneration=(this.ocrGeneration||0)+1;
    const currentGen=this.ocrGeneration;
    if(this.ocrCloseTimer){clearTimeout(this.ocrCloseTimer);this.ocrCloseTimer=null;}
    if(this.ocrAbortController)this.ocrAbortController.abort();
    this.ocrAbortController=new AbortController();
    const signal=this.ocrAbortController.signal;
    const overlay=this.$('receiptOcrOverlay'),statusText=this.$('ocrStatusText');
    const dot1=this.$('ocrDot1'),dot2=this.$('ocrDot2'),dot3=this.$('ocrDot3');
    if(overlay){overlay.hidden=false;overlay.style.opacity='1';}
    if(dot1)dot1.classList.add('active');if(dot2)dot2.classList.remove('active');if(dot3)dot3.classList.remove('active');
    if(statusText)statusText.textContent='OCR로 인식하는 중이에요.';
    this.clearAutoFilledStyles();
    const f=this.$('recordForm').elements;
    if(!this.userEditedFields?.has('date'))f.date.value='';
    if(!this.userEditedFields?.has('fuel_type'))f.fuel_type.value='';
    if(!this.userEditedFields?.has('actual_krw'))f.actual_krw.value='';
    if(!this.unitPriceEdited)f.unit_price_krw.value='';
    if(!this.fuelLitersEdited)f.fuel_liters.value='';
    try{
      const onProgress=m=>{
        if(signal.aborted||this.ocrGeneration!==currentGen)return;
        if(m.status==='recognizing text'&&statusText)statusText.textContent='OCR로 인식하는 중이에요.';
      };
      const result=await runReceiptOcr(file,assetBase,onProgress,signal);
      if(signal.aborted||this.ocrGeneration!==currentGen||!this.$('recordDialog')?.open)return;

      if(dot2)dot2.classList.add('active');
      if(statusText)statusText.textContent='인식한 정보를 자동으로 입력하는 중이에요.';

      const parsed=result.parsed;
      this.suppressFuelEstimation=true;
      if(parsed.date&&!this.userEditedFields?.has('date')){f.date.value=parsed.date;this.markAutoFilled('dateField',f.date);}
      if(parsed.fuel_type&&!this.userEditedFields?.has('fuel_type')){f.fuel_type.value=parsed.fuel_type;this.markAutoFilled('fuelTypeField',f.fuel_type);}
      if(parsed.actual_krw&&!this.userEditedFields?.has('actual_krw')){f.actual_krw.value=Number(parsed.actual_krw).toLocaleString('ko-KR');this.markAutoFilled('amountField',f.actual_krw);}
      if(parsed.unit_price_krw&&!this.unitPriceEdited){
        f.unit_price_krw.value=Number(parsed.unit_price_krw).toLocaleString('ko-KR');
        this.unitPriceSource='receipt';
        this.markAutoFilled('unitPriceField',f.unit_price_krw);
      }
      if(parsed.fuel_liters&&!this.fuelLitersEdited){
        f.fuel_liters.value=parsed.fuel_liters;
        this.fuelQuantitySource='reported';
        this.markAutoFilled('fuelLitersField',f.fuel_liters);
      }
      if(parsed.station_name||parsed.station_address){
        await this.matchAndApplyReceiptStation(parsed,signal);
      }
      this.suppressFuelEstimation=false;

      if(dot3)dot3.classList.add('active');
      if(statusText)statusText.textContent='자동 입력이 완료됐어요.';

      await new Promise(r=>setTimeout(r,450));
      if(signal.aborted||this.ocrGeneration!==currentGen||!this.$('recordDialog')?.open)return;
      if(overlay){
        overlay.style.opacity='0';
        this.ocrCloseTimer=setTimeout(()=>{
          if(this.ocrGeneration!==currentGen)return;
          overlay.hidden=true;this.ocrCloseTimer=null;
        },300);
      }
      if(this.$('receiptNotice')){
        const notice=this.$('receiptNotice');
        notice.hidden=false;
        const matchedCount=parsed?.confidence?.matched_fields?.length||0;
        if(matchedCount>0){
          notice.innerHTML='<span>✨ 영수증에서 인식된 정보예요. 내용을 확인하고 [저장]을 눌러주세요.</span>';
        }else{
          notice.innerHTML='<span>ℹ️ 영수증에서 명확한 정보를 찾지 못했어요. 직접 확인 후 입력해 주세요.</span>';
        }
      }
    }catch(err){
      if(signal.aborted||this.ocrGeneration!==currentGen)return;
      console.warn('[carrot-vehicle-journal] OCR processing failed:',err);
      if(overlay)overlay.hidden=true;
      if(this.$('receiptNotice')){
        const notice=this.$('receiptNotice');
        notice.hidden=false;
        notice.innerHTML='<span>⚠️ 영수증 정보를 인식하지 못했어요. 직접 입력해 주세요.</span>';
      }
    }
  }
  async matchAndApplyReceiptStation(parsed,signal){
    try{
      const maps=await this.kakaoMaps();
      if(signal.aborted||!this.$('recordDialog')?.open)return;
      const query=(parsed.station_address||parsed.station_name||'').slice(0,60);
      if(!query)return;
      let places=[];
      if(this.kakaoRestConfigured){
        places=await this.call('location/search',{query});
      }else if(maps?.services?.Places){
        places=await new Promise(resolve=>{
          new maps.services.Places().keywordSearch(query,(data,status)=>{resolve(status===maps.services.Status.OK?data:[]);});
        });
      }
      if(signal.aborted||!this.$('recordDialog')?.open)return;
      const matched=matchStationFromReceipt({station_name:parsed.station_name,station_address:parsed.station_address},places);
      if(matched){
        this.setLocation(matched,maps);
        this.markAutoFilledLocation();
      }
    }catch(e){
      console.warn('[carrot-vehicle-journal] Station matching failed:',e);
    }
  }
  openRecord(record,mode,isReceipt=false){
    this.isReceiptMode=isReceipt;
    this.clearAutoFilledStyles();
    if(this.$('receiptNotice'))this.$('receiptNotice').hidden=true;
    if(this.$('receiptOcrOverlay'))this.$('receiptOcrOverlay').hidden=true;
    this.editing=record||null;this.pendingId=record?.id||uuid();this.$('recordForm').reset();this.recordMode=mode||(record?.kind==='trip'?'trip':['washing','accident','refueling','charging'].includes(record?.category)?record.category:'maintenance');this.fuelLitersEdited=!!record;this.fuelQuantitySource=record?.input?.fuel_quantity_source||'reported';this.unitPriceEdited=!!record;this.unitPriceSource=record?.input?.unit_price_source||'manual';this.unitPriceObserved=record?.input?.unit_price_observed_at;this.$('recordDialog').dataset.mode=this.recordMode;this.draftLocation=record?.location?{...record.location}:null;this.selectedPhotos=[];this.removedPhotoIds=new Set();this.renderSelectedPhotos();this.setDraftDirty(false);
    const form=this.$('recordForm');form.elements.date.value=isReceipt?'':new Date().toLocaleDateString('sv-SE');
    const input=record&&(record.input||{kind:record.kind,date:record.accounting_date,category:record.category,subcategory:record.subcategory,memo:record.memo,actual_krw:record.actual_krw??record.estimated_krw});
    if(input)for(const [key,value] of Object.entries(input))if(form.elements[key]){let text=value??'';if(value&&['started_at','ended_at'].includes(key)){const time=new Date(value);text=new Date(time.getTime()-time.getTimezoneOffset()*60000).toISOString().slice(0,16);}if(key==='actual_krw'&&value!=null){text=Number(value).toLocaleString('ko-KR');}form.elements[key].value=text;}
    if(!record){form.elements.kind.value=this.recordMode==='trip'?'trip':'expense';form.elements.category.value=this.recordMode==='trip'?'maintenance':this.recordMode;}
    const fields=record?.import_source?.fields||{};for(const [source,target] of Object.entries({'주유량':'fuel_liters','단가':'unit_price_krw','누적주행거리':'odometer_km','충전량':'billed_charge_kwh'})){if(fields[source]!==undefined&&!form.elements[target].value)form.elements[target].value=String(fields[source]).replaceAll(',','');}
    if(record?.input?.full_tank===false||String(fields['구분']||'').includes('부분'))form.elements.tank_mode.value='partial';
    const vehicleFuel=this.entries.find(e=>e.entry_id===this.entry)?.fuel;form.elements.fuel_type.value=record?.input?.fuel_type||(!isReceipt&&['gasoline','diesel'].includes(vehicleFuel)?vehicleFuel:'');

    this.$('dialogTitle').textContent={washing:'세차 기록',accident:'사고 기록',trip:'주행 기록',refueling:'주유 기록',charging:'충전 기록',maintenance:'정비/기타 기록'}[this.recordMode];
    this.$('importSourceDetails').hidden=!record?.import_source;this.$('importSourceFields').innerHTML=Object.entries(record?.import_source?.fields||{}).map(([key,value])=>`<div class="list-row"><span>${esc(key)}</span><span>${['금액','단가'].includes(key)&&value!==''?money(Number(String(value).replaceAll(',',''))):esc(value===''?'미입력':value)}</span></div>`).join('');this.formFields();this.renderSelectedPhotos();this.$('recordDialog').showModal();if(this.recordMode!=='trip')this.renderLocation();if(!record&&['refueling','charging'].includes(this.recordMode)&&this.automaticLocations!==false&&!this.isReceiptMode)this.autoSelectStation();
  }
  async saveRecord(event){
    event.preventDefault();if(this.draftLocation)this.draftLocation={...this.draftLocation,name:this.$('locationName').value.trim()};const form=this.$('recordForm'),payload={kind:this.$('kind').value||'expense',date:form.elements.date.value,memo:form.elements.memo.value,location:this.draftLocation&&(this.draftLocation.name||this.draftLocation.latitude!=null)?this.draftLocation:null};
    if(!this.$('odometerField').hidden&&form.elements.odometer_km.value!=='')payload.odometer_km=Number(form.elements.odometer_km.value);
    if(payload.kind==='expense'){payload.category=['refueling','charging','washing','accident'].includes(this.recordMode)?this.recordMode:form.elements.category.value;payload.subcategory=form.elements.subcategory.value;}
    if(this.recordMode==='refueling'){for(const key of ['fuel_liters','unit_price_krw','wash_cost_krw']){const raw=form.elements[key].value.replaceAll(',','');if(raw!=='')payload[key]=Number(raw);}payload.fuel_quantity_source=this.fuelQuantitySource||'reported';payload.unit_price_source=this.unitPriceSource||'manual';if(this.unitPriceSource==='opinet'&&this.unitPriceObserved)payload.unit_price_observed_at=this.unitPriceObserved;payload.full_tank=form.elements.tank_mode.value==='full';payload.fuel_type=form.elements.fuel_type.value;}
    if(this.recordMode==='charging'){for(const key of ['billed_charge_kwh','unit_price_krw']){const raw=form.elements[key].value.replaceAll(',','');if(raw!=='')payload[key]=Number(raw);}}
    if(this.recordMode==='trip'){delete payload.distance_km;delete payload.location;delete payload.memo;}
    const rawAmt=form.elements.actual_krw?.value?.replace(/[^\d]/g,'');
    if(rawAmt)payload.actual_krw=Number(rawAmt);
    if(payload.kind!=='expense')for(const field of ['distance_km','drive_energy_kwh','battery_charge_kwh','billed_charge_kwh','odometer_km','soc_start_percent','soc_end_percent','started_at','ended_at','charge_mode']){const value=form.elements[field]?.value;if(value!==undefined&&value!==''&&!form.elements[field].closest('[hidden]'))payload[field]=['started_at','ended_at','charge_mode'].includes(field)?(field==='charge_mode'?value:new Date(value).toISOString()):Number(value);}
    if(this.removedPhotoIds?.size)payload.remove_attachment_ids=[...this.removedPhotoIds];
    const photos=[...(this.selectedPhotos||[])],photoLimit=this.recordMode==='trip'?1:this.recordMode==='accident'?10:5;if(photos.length+((this.editing?.attachments||[]).filter(p=>!this.removedPhotoIds?.has(p.id)).length)>photoLimit||photos.some(f=>!f.size||f.size>20*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type))){this.$('recordError').textContent=`20MiB 이하 JPG·PNG·WEBP 사진을 최대 ${photoLimit}장 골라 주세요.`;return;}
    const saveBtn=this.$('save'),fill=saveBtn.querySelector('.progress-fill'),label=saveBtn.querySelector('.btn-label')||saveBtn;
    saveBtn.disabled=true;saveBtn.classList.add('loading');
    const updateProgress=(text,pct)=>{
      if(label)label.textContent=text;
      if(fill)fill.style.width=pct+'%';
    };
    this.$('photos').disabled=true;this.$('clearPhotos').disabled=true;for(const button of this.$('photoPreview').querySelectorAll('button'))button.disabled=true;
    try{
      const preparedPhotos=[];
      for(let i=0;i<photos.length;i++){
        const pct=Math.round(((i+1)/(photos.length+1))*65);
        updateProgress(`사진 압축 중 (${i+1}/${photos.length})`,pct);
        preparedPhotos.push(await prepareJournalPhoto(photos[i]));
      }
      updateProgress('기록 저장 중...',80);
      const result=await this.call('record/save',{record_id:this.pendingId,expected_version:this.editing?.version||0,payload});
      this.editing={...this.editing,id:result.id,version:result.version,input:payload,attachments:(this.editing?.attachments||[]).filter(p=>!this.removedPhotoIds?.has(p.id))};this.removedPhotoIds=new Set();
      for(let i=0;i<preparedPhotos.length;i++){
        const pct=80+Math.round(((i+1)/preparedPhotos.length)*15);
        updateProgress(`사진 업로드 중 (${i+1}/${preparedPhotos.length})`,pct);
        const file=preparedPhotos[i];
        const body=new FormData();body.append('record_id',result.id);body.append('file',file);
        const response=await this._hass.fetchWithAuth(`/api/carrot_ha/v1/journal/${encodeURIComponent(this.entry)}/attachments`,{method:'POST',body});
        if(!response.ok)throw new Error('기록은 저장했지만 사진을 저장하지 못했어요. 사진을 다시 골라 주세요.');
      }
      updateProgress('저장 완료! ✓',100);
      await new Promise(r=>setTimeout(r,300));
      this.setDraftDirty(false);this.selectedPhotos=[];this.$('photos').value='';this.renderSelectedPhotos();this.$('recordDialog').close();this.offset=0;await this.load(true);
    }catch(error){
      this.$('recordError').textContent=error.message||'기록을 저장하지 못했어요.';this.$('recordError').scrollIntoView({block:'nearest'});
    }finally{
      saveBtn.disabled=false;saveBtn.classList.remove('loading');
      if(fill)fill.style.width='0%';
      if(label)label.textContent='저장';
      this.$('photos').disabled=false;this.$('clearPhotos').disabled=false;for(const button of this.$('photoPreview').querySelectorAll('button'))button.disabled=false;
    }
  }
  todayKst(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());}
  async autoSelectStation(){
    const generation=this.locationGeneration,date=this.$('recordForm').elements.date.value;
    if(date!==this.todayKst()||!navigator.geolocation)return;
    this.$('locationSummary').hidden=false;this.$('locationSummary').textContent='현재 위치에서 가까운 장소를 찾고 있어요.';
    try{
      const point=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:60000,timeout:10000}));
      if(generation!==this.locationGeneration||!this.$('recordDialog').open||this.draftLocation||date!==this.$('recordForm').elements.date.value)return;
      if(this.recordMode==='refueling'&&!this.$('recordForm').elements.fuel_type.value)throw Error('실제 주유 유종을 먼저 선택해 주세요.');const result=await this.call('stations/lookup',{kind:this.recordMode,latitude:point.coords.latitude,longitude:point.coords.longitude,date,fuel:this.$('recordForm').elements.fuel_type.value||'gasoline'});
      if(generation!==this.locationGeneration||!this.$('recordDialog').open||this.draftLocation||date!==this.$('recordForm').elements.date.value)return;
      if(result.selected){this.draftLocation=result.selected.location;this.draftDirty=true;this.renderLocation();this.applyStationPrice(result.selected);}
      this.$('locationSummary').hidden=false;this.$('locationHint').textContent=result.message;this.$('locationSummary').textContent=this.draftLocation?.name||result.message;
    }catch(e){if(generation===this.locationGeneration){this.$('locationSummary').textContent=e.message||'위치 권한을 확인하거나 장소를 직접 지정해 주세요.';}}
  }
  applyStationPrice(selected){if(this.recordMode!=='refueling'||this.unitPriceEdited||this.unitPriceSource==='receipt')return;const f=this.$('recordForm').elements;if(selected?.unit_price_krw>0){f.unit_price_krw.value=Number(selected.unit_price_krw).toLocaleString('ko-KR');this.unitPriceSource='opinet';this.unitPriceObserved=selected.price_observed_at;}else{f.unit_price_krw.value='';this.unitPriceSource='manual';this.unitPriceObserved=null;}this.estimateFuelLiters();}
  async refreshStationPrice(){const p=this.draftLocation,f=this.$('recordForm').elements,generation=this.locationGeneration,date=f.date.value,fuel=f.fuel_type.value;if(this.editing||this.recordMode!=='refueling'||this.unitPriceSource==='receipt'||this.unitPriceEdited||date!==this.todayKst()||p?.latitude==null||!fuel)return;try{const result=await this.call('stations/lookup',{kind:'refueling',latitude:p.latitude,longitude:p.longitude,date,fuel,price_only:true});if(generation!==this.locationGeneration||date!==f.date.value||fuel!==f.fuel_type.value||!this.$('recordDialog').open)return;this.unitPriceEdited=false;this.applyStationPrice(result.selected);this.$('locationHint').textContent=result.message;}catch(e){f.unit_price_krw.value='';this.estimateFuelLiters();this.$('locationHint').textContent=e.message;}}
  renderPlaceStatistics(){
    this.initTrendsMap();
  }
  resetTrendsMap(){
    if(!this.trendsMapInstance)return;
    this.trendsMapInstance.setView([36.2683,127.6358],7);
  }
  showTrendsPlaceCard(p,placeName,totalKrw,visits,color){
    const card=this.$('trendsPlaceCard');
    if(!card)return;
    card.hidden=false;
    const kindLabel=p.kind==='refueling'?'주유소':p.kind==='charging'?'충전소':(categories[p.kind]||'방문 장소');
    card.innerHTML=`<div class="trends-place-card-inner"><div class="trends-place-card-head"><div class="trends-place-title-wrap"><span class="trends-place-dot" style="background:${color}"></span><strong class="trends-place-title">${esc(placeName)}</strong><small class="muted" style="font-size:12px;margin-left:4px;">${kindLabel}</small></div><button type="button" class="trends-place-close-btn" aria-label="닫기">×</button></div><div class="trends-place-stats-grid"><div class="trends-place-stat-item"><span class="trends-place-stat-label">누적 사용금액</span><strong class="trends-place-stat-val">${money(totalKrw)}</strong></div><div class="trends-place-stat-item"><span class="trends-place-stat-label">누적 방문횟수</span><strong class="trends-place-stat-val">${numeric(visits,0)}회</strong></div></div></div>`;
    const closeBtn=card.querySelector('.trends-place-close-btn');
    if(closeBtn)closeBtn.onclick=e=>{
      e.stopPropagation();
      card.hidden=true;
      if(this.$('trendsMap')){
        for(const wrap of this.$('trendsMap').querySelectorAll('.trends-map-dot-wrap')){
          wrap.classList.remove('active');
        }
      }
    };
  }
  async initTrendsMap(){
    const mapBox=this.$('trendsMap');
    if(!mapBox||!this.data)return;
    if(this.tab!==1)return;
    try{
      const L=await leaflet();
      if(this.$('trendsMapNotice'))this.$('trendsMapNotice').hidden=true;
      const centerPos=[36.2683,127.6358];
      if(!this.trendsMapInstance){
        mapBox.replaceChildren();
        this.trendsMapInstance=L.map(mapBox,{
          center:centerPos,
          zoom:7,
          scrollWheelZoom:false,
          zoomControl:true
        });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
          maxZoom:19,
          referrerPolicy:'strict-origin-when-cross-origin',
          attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        }).addTo(this.trendsMapInstance);
        this.trendsMapInstance.on('click',()=>{
          if(this.$('trendsPlaceCard'))this.$('trendsPlaceCard').hidden=true;
          for(const wrap of mapBox.querySelectorAll('.trends-map-dot-wrap')){
            wrap.classList.remove('active');
          }
        });
      }else{
        setTimeout(()=>{if(this.trendsMapInstance)this.trendsMapInstance.invalidateSize();},60);
      }
      if(this.trendsMapMarkers){
        for(const m of this.trendsMapMarkers)m.remove();
      }
      this.trendsMapMarkers=[];
      const places=this.data?.station_stats?.places||[];
      const locatedPlaces=places.filter(p=>p.location?.latitude!=null&&p.location?.longitude!=null);
      if(this.$('placeStatisticsBasis')){
        this.$('placeStatisticsBasis').textContent=locatedPlaces.length?`선택 기간 방문한 장소 ${locatedPlaces.length}곳 · 점을 누르면 누적 금액과 방문횟수를 확인할 수 있어요.`:'선택한 기간 동안 좌표가 기록된 방문 장소가 없어요.';
      }
      for(const p of locatedPlaces){
        const lat=p.location.latitude;
        const lon=p.location.longitude;
        const color=this.categoryColor(p.kind||'charging');
        const placeName=p.location.name||p.location.address||(p.kind==='refueling'?'주유소':'충전소');
        const totalKrw=(p.actual_krw!=null&&p.actual_krw>0)?p.actual_krw:(p.estimated_krw??0);
        const visits=p.visits||1;
        const icon=L.divIcon({
          className:'trends-map-leaflet-marker',
          html:`<div class="trends-map-dot-wrap"><div class="trends-map-dot" style="background:${color}" title="${esc(placeName)}"></div></div>`,
          iconSize:[30,30],
          iconAnchor:[15,15]
        });
        const marker=L.marker([lat,lon],{icon}).addTo(this.trendsMapInstance);
        this.trendsMapMarkers.push(marker);
        marker.on('click',e=>{
          if(e?.originalEvent)e.originalEvent.stopPropagation();
          for(const wrap of mapBox.querySelectorAll('.trends-map-dot-wrap')){
            wrap.classList.remove('active');
          }
          const wrap=marker.getElement()?.querySelector('.trends-map-dot-wrap');
          if(wrap)wrap.classList.add('active');
          this.showTrendsPlaceCard(p,placeName,totalKrw,visits,color);
          this.trendsMapInstance.panTo([lat,lon]);
        });
      }
    }catch(e){
      if(this.$('trendsMapNotice')){
        this.$('trendsMapNotice').hidden=false;
        this.$('trendsMapNotice').textContent=e.message||'지도를 불러오지 못했어요. 라이브러리 설정을 확인해 주세요.';
      }
    }
  }
  renderNasStatus(state){this.$('nasStatus').textContent=state?.phase==='complete'?`복원 검증 완료 · ${state.last_success} · 차량 ${state.vehicles}대`:state?.phase==='failed'?'백업 실패: '+state.message:state?.phase==='running'?'백업 및 복원 검증 중이에요.':'아직 전용 NAS 백업을 실행하지 않았어요.';}
  renderBackupStatus(backupEntities){
    const container=this.$('backupStatus');
    if(!container)return;
    if(!backupEntities||!backupEntities.length){
      container.innerHTML='<div class="backup-empty-card"><div class="backup-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div><h4>HA 백업 상태 엔티티가 없어요</h4><p class="note">Home Assistant의 백업(Backup) 통합이 활성화되어 있는지 확인해 주세요.</p></div>';
      return;
    }
    const icons={
      shield:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      calendar:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      check:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      rotate:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
      zap:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      info:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const parseState=s=>{
      const str=String(s??'').toLowerCase().trim();
      if(str==='blocked')return{label:'차단됨 (대기 중)',pillClass:'pill-warning',badgeText:'일시 대기',desc:'다른 작업 진행 또는 시스템 잠금으로 인해 백업이 일시 대기 중입니다.'};
      if(str==='idle')return{label:'대기 중 (정상)',pillClass:'pill-success',badgeText:'정상 대기',desc:'백업 관리자가 유휴 상태이며 새 백업 요청을 수신할 준비가 되어 있습니다.'};
      if(str==='in_progress'||str==='running')return{label:'백업 진행 중',pillClass:'pill-info',badgeText:'진행 중',desc:'현재 백업 작업이 실행 중입니다.'};
      if(str==='completed')return{label:'완료됨',pillClass:'pill-success',badgeText:'성공',desc:'최근 백업 작업이 성공적으로 완료되었습니다.'};
      if(str==='failed'||str==='error')return{label:'실패',pillClass:'pill-error',badgeText:'오류',desc:'최근 백업 작업 중 오류가 발생했습니다.'};
      if(str==='on'||str==='true')return{label:'활성화됨',pillClass:'pill-success',badgeText:'활성',desc:'자동 백업이 활성화되어 있습니다.'};
      if(str==='off'||str==='false')return{label:'비활성화됨',pillClass:'pill-neutral',badgeText:'비활성',desc:'자동 백업이 비활성화되어 있습니다.'};
      return null;
    };
    const formatTimestamp=val=>{
      if(!val)return{formatted:'—',relative:'',isDate:false};
      const str=String(val).trim();
      const curY=(new Date()).getFullYear();
      if(!str.includes('T')&&!str.includes(':')&&/^\d{4}-\d{2}-\d{2}$/.test(str)){
        const parts=str.split('-');
        const y=Number(parts[0]),m=Number(parts[1]),day=Number(parts[2]);
        const yPrefix=y!==curY?`${y}년 `:'';
        return{formatted:`${yPrefix}${m}월 ${day}일`,relative:'',isDate:true};
      }
      if(/^\d{4}-\d{2}-\d{2}/.test(str)){
        const d=new Date(str);
        if(!isNaN(d.getTime())){
          const pad=n=>String(n).padStart(2,'0');
          const hasTime=str.includes('T')||str.includes(':');
          const yPrefix=d.getFullYear()!==curY?`${d.getFullYear()}년 `:'';
          const formatted=yPrefix+`${d.getMonth()+1}월 ${d.getDate()}일`+(hasTime?` ${pad(d.getHours())}시 ${pad(d.getMinutes())}분`:'');
          const diffSec=Math.round((d.getTime()-Date.now())/1000);
          const absSec=Math.abs(diffSec);
          const isFuture=diffSec>0;
          let relative='';
          if(absSec<90)relative=isFuture?'곧 실행':'방금 전';
          else if(absSec<3600)relative=isFuture?`약 ${Math.round(absSec/60)}분 후`:`${Math.round(absSec/60)}분 전`;
          else if(absSec<86400)relative=isFuture?`약 ${Math.round(absSec/3600)}시간 후`:`${Math.round(absSec/3600)}시간 전`;
          else relative=isFuture?`약 ${Math.round(absSec/86400)}일 후`:`약 ${Math.round(absSec/86400)}일 전`;
          return{formatted,relative,isDate:true};
        }
      }
      return{formatted:str,relative:'',isDate:false};
    };

    const items=backupEntities.map(e=>{
      const rawName=String(e.name||'');
      const id=String(e.entity_id||'').toLowerCase();
      const rawState=String(e.state||'');
      let cleanName=rawName.replace(/^Backup\s+/i,'').trim();
      cleanName=cleanName
        .replace(/마지막으로\s*성공적으로\s*완료된/g,'마지막 성공')
        .replace(/마지막으로\s*성공한/g,'마지막 성공')
        .replace(/다음\s*예약된/g,'다음 예약');
      let kind='generic',icon=icons.calendar;
      if(id.includes('manager_state')||id.includes('backup_state')||rawName.includes('관리자')||['blocked','idle','in_progress'].includes(rawState.toLowerCase())){
        kind='manager';icon=icons.shield;
      }else if(id.includes('next')||rawName.includes('다음')||rawName.includes('예약')){
        kind='next';icon=icons.calendar;
      }else if(id.includes('last_success')||id.includes('last_completed')||rawName.includes('성공')||rawName.includes('완료')||rawName==='마지막 백업'){
        kind='last_success';icon=icons.check;
      }else if(id.includes('last_attempt')||rawName.includes('시도')){
        kind='last_attempt';icon=icons.rotate;
      }else if(id.includes('automatic')||rawName.includes('자동 백업')){
        kind='automatic';icon=icons.zap;
      }
      const stateMeta=parseState(rawState);
      const ts=formatTimestamp(rawState);
      return{...e,rawName,cleanName,kind,icon,stateMeta,ts};
    });

    const manager=items.find(i=>i.kind==='manager')||null;
    const nextItem=items.find(i=>i.kind==='next')||null;
    const lastSuccess=items.find(i=>i.kind==='last_success')||null;

    let overviewHtml='';
    if(manager){
      const meta=manager.stateMeta||{label:manager.state,pillClass:'pill-neutral',desc:'백업 관리자 상태입니다.',badgeText:manager.state};
      overviewHtml=`<div class="backup-overview-banner"><div class="backup-overview-left"><div class="backup-overview-icon-wrap ${meta.pillClass}">${icons.shield}</div><div class="backup-overview-info"><div class="backup-overview-title-row"><span class="backup-overview-title">${esc(manager.cleanName)}</span><span class="backup-status-badge ${meta.pillClass}">${esc(meta.label)}</span></div><p class="backup-overview-desc">${esc(meta.desc)}</p></div></div>${(nextItem||lastSuccess)?`<div class="backup-overview-quick">${nextItem?`<div class="backup-quick-item"><span class="quick-label">다음 예정</span><span class="quick-val">${esc(nextItem.ts.formatted)}${nextItem.ts.relative?` (${esc(nextItem.ts.relative)})`:''}</span></div>`:''}${lastSuccess?`<div class="backup-quick-item"><span class="quick-label">최근 완료</span><span class="quick-val">${esc(lastSuccess.ts.formatted)}${lastSuccess.ts.relative?` (${esc(lastSuccess.ts.relative)})`:''}</span></div>`:''}</div>`:''}</div>`;
    }

    const cardsHtml=items.map(item=>{
      let valueHtml='',badgeHtml='';
      if(item.stateMeta){
        valueHtml=`<div class="backup-card-value">${esc(item.stateMeta.label)}</div>`;
        badgeHtml=`<span class="backup-status-badge ${item.stateMeta.pillClass}">${esc(item.stateMeta.badgeText)}</span>`;
      }else if(item.ts.isDate){
        valueHtml=`<div class="backup-card-value">${esc(item.ts.formatted)}</div>`;
        if(item.ts.relative){
          badgeHtml=`<span class="backup-status-badge pill-info">${esc(item.ts.relative)}</span>`;
        }
      }else{
        valueHtml=`<div class="backup-card-value">${esc(item.state)}</div>`;
      }
      return `<div class="backup-card"><div class="backup-card-head"><div class="backup-card-title-wrap"><span class="backup-card-icon">${item.icon}</span><span class="backup-card-title">${esc(item.cleanName)}</span></div>${badgeHtml}</div><div class="backup-card-body">${valueHtml}</div>${item.entity_id?`<div class="backup-card-footer"><span class="backup-card-entity">${esc(item.entity_id)}</span></div>`:''}</div>`;
    }).join('');

    const guideHtml=`<div class="backup-guide-card"><div class="backup-guide-header"><div class="backup-guide-title-wrap"><span class="backup-guide-icon">${icons.info}</span><span class="backup-guide-title">Synology NAS 백업 연계 안내</span></div><button type="button" class="backup-guide-btn" data-jump-settings="backup">백업 · 복구 설정 바로가기 →</button></div><p class="backup-guide-text">기존 HA 백업 상태를 표시해요. NAS 사본 검증과 차계부 전용 자동전송은 아직 제공하지 않아요.<br>차계부 데이터의 Synology 전용 자동 백업(일 7 · 주 4 · 월 12세대 보관 및 복원 검증)은 <strong>백업 · 복구</strong> 탭에서 설정할 수 있습니다.</p></div>`;

    container.innerHTML=`<div class="backup-status-wrap">${overviewHtml}<div class="backup-grid">${cardsHtml}</div>${guideHtml}</div>`;
    container.onclick=e=>{
      const btn=e.target.closest('[data-jump-settings]');
      if(btn)this.selectSettingsSection(btn.dataset.jumpSettings);
    };
  }
  async saveNasSettings(){if(!confirm('백업·자동 위치 설정을 저장하시겠습니까?'))return;try{await this.call('nas/config',{enabled:this.$('nasEnabled').checked,path:this.$('nasPath').value.trim(),automatic_locations:this.$('automaticLocations').checked});await this.loadJournalSettings();}catch(e){this.$('nasStatus').textContent=e.message;}}
  async nasAction(action){this.$('nasRun').disabled=true;this.$('nasList').disabled=true;this.$('nasStatus').textContent=action==='run'?'백업·복원 검증 중이에요.':'목록을 불러오고 있어요.';try{const result=await this.call('nas/action',{action});this.renderNasStatus(action==='run'?result:result.status);if(action==='list'){this.nasObjects=result.objects;this.$('nasFiles').innerHTML=result.objects.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(p=>`<div class="settings-backup-row"><span>${esc(p.title)}<small>${esc(p.created_at)} · 복원 검증 완료</small></span><button type="button" data-nas-file="${esc(p.name)}">다운로드</button></div>`).join('');this.$('nasFiles').onclick=e=>{const b=e.target.closest('[data-nas-file]');if(b)this.downloadNas(b.dataset.nasFile);};}}catch(e){this.$('nasStatus').textContent=e.message;}finally{this.$('nasRun').disabled=false;this.$('nasList').disabled=false;}}
  async downloadNas(name){try{const response=await this._hass.fetchWithAuth('/api/carrot_ha/v1/journal/nas/'+encodeURIComponent(name));if(!response.ok)throw Error('백업 검증·다운로드에 실패했어요.');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='carrot-journal-snapshot.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){this.$('nasStatus').textContent=e.message;}}
  async changeStatus(record,action){try{if(action==='purge'){if(record.status!=='deleted')throw Error('삭제된 기록만 영구 삭제할 수 있어요.');if(!window.confirm(`${record.accounting_date||record.started_at?.slice(0,10)||''} 기록을 영구 삭제할까요?\n금액·메모·위치·첨부 사진이 삭제되며 복원할 수 없습니다. 기존 백업에는 남아 있을 수 있습니다.`))return;const result=await this.call('record/purge',{record_id:record.id,expected_version:record.version,confirm:true});await this.load(true);if(result.photo_cleanup_pending)this.$('message').textContent='기록은 영구 삭제했어요. 사진 파일 정리는 재시도 중이에요.';return;}await this.call('record/status',{record_id:record.id,expected_version:record.version,status:action==='restore'?'active':'deleted'});await this.load(true);}catch(error){this.$('message').textContent=error.message||'기록을 변경하지 못했어요.';}}
}
if(!customElements.get('carrot-vehicle-journal'))customElements.define('carrot-vehicle-journal',VehicleJournal);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='carrot-vehicle-journal'))window.customCards.push({type:'carrot-vehicle-journal',name:'Carrot HA 차계부',description:'HA 로컬 장기 기록과 수동 누락 기록을 함께 살펴봐요.'});
export default VehicleJournal;

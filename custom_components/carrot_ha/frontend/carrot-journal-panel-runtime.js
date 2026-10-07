const version=new URL(import.meta.url).searchParams.get('v');
const moduleURL=name=>{const url=new URL(name,import.meta.url);url.searchParams.set('v',version);return url.href;};
const {VehicleJournal}=await import(moduleURL('./carrot-vehicle-journal.js'));
// Temporary debugging UI: remove monitor/apply/view storage after user validation.
// Keep the stable bootstrap and versioned runtime/dependencies.
const viewKey='carrot-journal-update-view';
function ancestors(card){const nodes=[];for(let node=card;node;node=node.assignedSlot||node.parentNode||node.host)if(node.nodeType===1)nodes.push(node);return nodes;}
export async function mountJournalPanel(panel,loadedVersion){
  panel.shadowRoot.innerHTML='<style>:host{display:block;min-height:100%;background:#0b1014;color:#f1f6fa;font-family:system-ui}header{display:flex;align-items:center;gap:16px;padding:12px 24px;border-bottom:1px solid #2a3945}button{font:inherit;color:inherit;background:#202c36;border:1px solid #2a3945;border-radius:10px;min-height:44px;cursor:pointer}button:focus-visible{outline:3px solid #7bb6ff;outline-offset:2px}[hidden]{display:none!important}#update{padding:12px 24px;position:sticky;top:0;z-index:10;background:#161e25}main{max-width:1320px;margin:auto;padding:16px 12px}</style><header><button id="menu" type="button" aria-label="HA 메뉴 열기">☰</button><span>차계부</span></header><div id="update" hidden role="status"><span>새 화면 버전이 있어요. </span><button id="apply" type="button">새 화면 버전 적용</button><span id="updateMessage"></span></div><main></main>';
  // A distinct class/tag prevents a previously loaded Lovelace card definition
  // from winning registration of this version in the current document.
  const tag='carrot-journal-screen-'+loadedVersion.replace(/[^a-z0-9]/gi,'-').toLowerCase();
  if(!customElements.get(tag))customElements.define(tag,class extends VehicleJournal{});
  const card=panel.card=document.createElement(tag);card.setConfig({});
  let saved;
  try{saved=JSON.parse(sessionStorage.getItem(viewKey)||'null');sessionStorage.removeItem(viewKey);}catch{}
  if(saved&&Date.now()-saved.time<120000&&saved.path===location.pathname){
    if(['month','year'].includes(saved.scope))card.setScope(saved.scope);
    if(typeof saved.month==='string'){card.$('month').value=saved.month;}
    if(typeof saved.entry==='string')card.entry=saved.entry;
    if(Number.isInteger(saved.offset)&&saved.offset>=0)card.offset=saved.offset;
    if(Number.isInteger(saved.tab)&&saved.tab>=0&&saved.tab<4)card.selectTab(saved.tab);
    if(['distance_km','drive_energy_kwh','battery_charge_kwh','drive_soc_used_pp','charge_effective_krw','efficiency'].includes(saved.metric)){card.metric=saved.metric;card.$('metric').value=saved.metric;}
    if(['day','week','month'].includes(saved.period)){card.period=saved.period;card.$('period').value=saved.period;}
    if(['charging','maintenance','washing','tuning','other'].includes(saved.comparisonCategory))card.comparisonCategory=saved.comparisonCategory;
    const restore=()=>{card.removeEventListener('journal-rendered',restore);requestAnimationFrame(()=>requestAnimationFrame(()=>{
      ancestors(card).forEach((node,i)=>{const position=saved.scroll?.[i];if(position){node.scrollLeft=position[0];node.scrollTop=position[1];}});
      for(const [id,x,y] of saved.inside||[]){const node=card.$(id);if(node){node.scrollLeft=x;node.scrollTop=y;}}
    }));};card.addEventListener('journal-rendered',restore);
  }
  panel.shadowRoot.querySelector('main').append(card);if(panel._hass)card.hass=panel._hass;
  panel.shadowRoot.getElementById('menu').onclick=()=>panel.dispatchEvent(new CustomEvent('hass-toggle-menu',{bubbles:true,composed:true}));
  panel.shadowRoot.getElementById('apply').onclick=()=>{
    // Closing a dialog does not necessarily discard the entered draft or photos.
    if(card.hasPendingInput()){
      panel.shadowRoot.getElementById('updateMessage').textContent=' 작성 중인 기록·사진 또는 비교 기준을 먼저 저장하거나 취소해 주세요.';return;
    }
    const view={path:location.pathname,time:Date.now(),scope:card.scope,month:card.$('month').value,entry:card.entry,tab:card.tab,offset:card.offset,metric:card.metric,period:card.period,comparisonCategory:card.comparisonCategory,
      scroll:ancestors(card).map(node=>[node.scrollLeft,node.scrollTop]),inside:[...card.shadowRoot.querySelectorAll('[id]')].filter(node=>node.scrollLeft||node.scrollTop).map(node=>[node.id,node.scrollLeft,node.scrollTop])};
    try{sessionStorage.setItem(viewKey,JSON.stringify(view));}catch{panel.shadowRoot.getElementById('updateMessage').textContent=' 화면 위치를 보존하지 못했어요. 브라우저 저장 공간을 확인해 주세요.';return;}
    location.reload();
  };
  let pending=false;
  const check=async()=>{
    if(document.hidden||!panel.isConnected||pending)return;pending=true;
    try{const response=await fetch('/api/carrot_ha/frontend-version',{cache:'no-store'});if(response.ok){const result=await response.json();if(panel.isConnected&&!document.hidden&&typeof result.version==='string'&&result.version!==loadedVersion)panel.shadowRoot.getElementById('update').hidden=false;}}
    catch{/* Keep the usable local screen on transient network failure. */}finally{pending=false;}
  };
  panel.startMonitor=()=>{const timer=setInterval(check,60000);const visible=()=>{if(!document.hidden)check();};document.addEventListener('visibilitychange',visible);check();return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};};
  return panel.startMonitor();
}

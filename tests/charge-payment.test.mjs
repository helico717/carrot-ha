import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseChargeAmount,chargeCostLabel,refreshChargeCosts} from '../custom_components/carrot_ha/frontend/carrot-charge-payment.js';
test('whole KRW values including zero and correctly grouped commas',()=>{
  for(const [text,value] of [['0',0],['12,345',12345],[' 999999999 ',999999999]])assert.equal(parseChargeAmount(text),value);
  for(const text of ['', '-1','1.5','1e3','12,34','1,','1000000000','NaN'])assert.throws(()=>parseChargeAmount(text));
});
test('actual estimated and mixed labels in both languages',()=>{
  assert.equal(chargeCostLabel({cost_source:'actual'}),'(실제)');
  assert.equal(chargeCostLabel({cost_source:'mixed'}),'(실제+추정)');
  assert.equal(chargeCostLabel(null,true),'(est.)');
});
test('save refresh uses HA reads with no cloud refresh flag',async()=>{
  const calls=[];const card={device:{entry_id:'entry'},v:{month_charge_cost:100},saveCache(){},render(){},_hass:{async callApi(method,url){calls.push(url);return url.includes('/history/')?{events:[{data:{effective_cost_krw:0}}]}:{values:{charge_cost_totals:{effective_cost_krw:0}}};}}};
  await refreshChargeCosts(card);
  assert.equal(card.v.charge_cost_totals.effective_cost_krw,0);
  assert.equal(card.v.month_charge_cost,100);
  assert(calls.every(url=>!url.includes('refresh=1')));
});
globalThis.HTMLElement=class {attachShadow(){}};
for(const lang of ['ko','en']){
  const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
  test(`${lang}: actual zero is rendered with edit button above price`,()=>{
    const card=new Card();card._hass={config:{time_zone:'Asia/Seoul'}};
    const start=new Date().toISOString();
    card.charges=[{data:{started_at:start,ended_at:start,duration_s:3600,energy_kwh:10,payment_id:'pay',actual_cost_krw:0,effective_cost_krw:0,estimated_cost_krw:2800}}];
    card.chargeDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const html=card.chargeHistory();
    assert(html.includes('data-charge-payment="0"'));
    assert(html.includes(lang==='ko'?'수정':'Edit'));
    assert(html.includes(lang==='ko'?'0원':'₩0'));
    assert(html.includes(lang==='ko'?'(실제)':'(actual)'));
    assert(html.indexOf('data-charge-payment')<html.indexOf('<strong>'));
  });
}

for(const lang of ['ko','en']) {
  const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
  test(`${lang}: actual payments override preset unit rate including zero and zero energy`,()=>{
    for(const [amount,energy,expected] of [[10686,36.7,291],[13455,44.95,299],[6212,19.8,314],[0,10,0],[100,0,'—'],[null,10,320]]) {
      const card=new Card();card._hass={config:{time_zone:'Asia/Seoul'}};
      const start=new Date().toISOString();
      card.charges=[{data:{started_at:start,ended_at:start,duration_s:3600,energy_kwh:energy,payment_id:'pay',actual_cost_krw:amount,effective_cost_krw:amount??3200,unit_price_krw:320,cost_krw:3200}}];
      card.chargeDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const html=card.chargeHistory();
      const label=lang==='ko'?(amount==null?'추정 단가':'단가'):(amount==null?'Est. rate':'Rate');
      assert(html.includes(lang==='ko'?`${label} ${expected}원/kWh`:`${label} ₩${expected}/kWh`));
      if(amount!=null)assert(!html.includes(lang==='ko'?'추정 단가':'Est. rate'));
    }
  });
}

test('graph correction refresh follows independent live totals without cloud requests',async()=>{
  const calls=[];const card={device:{entry_id:'entry'},v:{battery_history:['old']},saveCache(){},render(){},_hass:{async callApi(method,url){calls.push(url);return url.includes('/history/')?{events:[]}:{values:{charge_cost_totals:{effective_cost_krw:0},battery_history:['corrected']}};}}};
  await refreshChargeCosts(card,true);
  assert.deepEqual(card.v.battery_history,['corrected']);
  assert.equal(calls.length,3);
  assert(calls[1].endsWith('?live=1'));
  assert(!calls[2].includes('?live=1'));
  assert(calls.every(url=>!url.includes('refresh=1')));
});

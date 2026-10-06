import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.HTMLElement=class {attachShadow(){}};
for(const lang of ['ko','en']){
 const Card=(await import(`../custom_components/carrot_ha/frontend/carrot-dashboard-${lang}.js`)).default;
 test(`${lang}: AC decimal, DC integer and low-power DC still fast`,()=>{
  const card=new Card();card._hass={config:{time_zone:'Asia/Seoul'},states:{}};
  for(const [mode,power,display,fast] of [['ac_charging',6.48,'6.5',false],['dc_charging',71.48,'71',true],['dc_charging',6.48,'6',true]]){
   const html=card.overview({charging:true,driving:false,onroad:false,stale:false,charge_mode:mode,charge_power_kw:power,soc_percent:30});
   assert(html.includes(`${display} kW`));
   assert(html.includes(`charge-power-tag ${fast?'fast':'slow'}`));
  }
  const delayed=card.overview({charging:true,driving:false,charge_mode:'ac_charging',charge_power_kw:9.4,charge_mode_evidence:{delayed:true,measurement_age_s:95}});
  assert(delayed.includes(lang==='ko'?'갱신 지연 (95s)':'Update delayed (95s)'));
  const html=card.overview({charging:true,driving:false,charge_mode:'ac_charging',charge_power_kw:null});
  assert(!html.includes('charge-power-tag'));
 });
}

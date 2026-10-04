// The editor lives outside the card tree so periodic renders preserve typing.
export function chargeCostLabel(totals, en=false) {
  const source=totals?.cost_source||'estimated';
  return source==='actual'?(en?'(actual)':'(실제)'):source==='mixed'?(en?'(actual + est.)':'(실제+추정)'):(en?'(est.)':'(추정)');
}
export function parseChargeAmount(value) {
  const text=String(value).trim();
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text))throw Error('invalid');
  const amount=Number(text.replaceAll(',',''));
  if(!Number.isSafeInteger(amount)||amount>999999999)throw Error('invalid');
  return amount;
}
export function bindChargePayments(card, en=false) {
  card.shadowRoot.querySelectorAll('[data-charge-payment]').forEach(button=>button.onclick=()=>{
    const charge=card.charges[Number(button.dataset.chargePayment)];
    if(charge?.data?.payment_id)openChargePayment(card,charge,en);
  });
}
export async function refreshChargeCosts(card) {
  const epoch=(card._chargeCostEpoch||0)+1;card._chargeCostEpoch=epoch;
  const id=encodeURIComponent(card.device.entry_id);
  const [history,dash]=await Promise.all([
    card._hass.callApi('GET',`carrot_ha/v1/history/${id}?kind=charge&limit=100&offset=0`),
    card._hass.callApi('GET',`carrot_ha/v1/dashboard/${id}?live=1`)
  ]);
  if(card._chargeCostEpoch!==epoch)return;
  card.charges=history.events;
  card.v={...card.v,charge_cost_totals:dash.values.charge_cost_totals};
  card.saveCache();card.render();
}
export function openChargePayment(card, charge, en=false) {
  if(card._chargePaymentEditor)return;
  const data=charge.data, entryId=card.device.entry_id;
  const dialog=document.createElement('dialog');card._chargePaymentEditor=dialog;
  const number=value=>Number(value).toLocaleString(en?'en-US':'ko-KR');
  dialog.style.cssText='box-sizing:border-box;width:min(420px,calc(100vw - 32px));max-height:90vh;overflow:auto;border:1px solid var(--divider-color,#808080);border-radius:18px;padding:24px;background:var(--card-background-color,#202528);color:var(--primary-text-color,#eee);font:14px system-ui;box-shadow:0 16px 64px #0008';
  // Only static markup is inserted. All record values use textContent.
  dialog.innerHTML=`<form><h2 style="margin:0 0 16px;font-size:20px"></h2><p class="summary" style="line-height:1.7"></p><label for="charge-payment-amount"></label><input id="charge-payment-amount" type="text" inputmode="numeric" autocomplete="off" style="box-sizing:border-box;width:100%;padding:12px;margin:8px 0;border:1px solid #888;border-radius:10px;font:inherit;color:inherit;background:transparent"><p class="error" role="alert" style="color:#e87171;min-height:20px"></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="submit" class="save"></button><button type="button" class="cancel"></button><button type="button" class="delete"></button></div></form>`;
  dialog.setAttribute('aria-label',en?'Actual charge payment':'실제 충전 결제 금액');
  dialog.querySelector('h2').textContent=en?'Actual charge payment':'실제 충전 결제 금액';
  const date=new Intl.DateTimeFormat(en?'en-US':'ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:card._hass?.config?.time_zone});
  dialog.querySelector('.summary').textContent=`${date.format(new Date(data.started_at))} – ${date.format(new Date(data.ended_at))}\n${number(data.energy_kwh)} kWh · ${en?'Estimated':'추정'} ${number(data.estimated_cost_krw)} ${en?'KRW':'원'}`;
  dialog.querySelector('.summary').style.whiteSpace='pre-line';
  dialog.querySelector('label').textContent=en?'Paid amount (KRW, including 0)':'실제 결제 금액 (원, 0원 가능)';
  const input=dialog.querySelector('input');input.value=data.actual_cost_krw==null?'':number(data.actual_cost_krw);
  const error=dialog.querySelector('.error');
  const save=dialog.querySelector('.save'),cancel=dialog.querySelector('.cancel'),remove=dialog.querySelector('.delete');
  save.textContent=en?'Save':'저장';cancel.textContent=en?'Cancel':'취소';remove.textContent=en?'Remove entry':'입력 삭제';
  remove.hidden=data.actual_cost_krw==null;
  for(const button of [save,cancel,remove])button.style.cssText='border:1px solid #888;border-radius:999px;padding:9px 16px;background:#80808025;color:inherit;font:inherit;cursor:pointer';
  let pending=false;
  const close=()=>{if(pending)return;dialog.close();dialog.remove();card._chargePaymentEditor=null;card.shadowRoot.querySelector(`[data-charge-payment="${card.charges.findIndex(e=>e.data?.payment_id===data.payment_id)}"]`)?.focus({preventScroll:true});};
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});cancel.onclick=close;
  const submit=async deleting=>{
    if(pending)return;
    let amount;
    try{if(!deleting)amount=parseChargeAmount(input.value);}
    catch{error.textContent=en?'Enter a whole KRW amount from 0 to 999,999,999.':'0~999,999,999원 사이의 정수를 입력하세요.';input.focus();return;}
    pending=true;for(const button of [save,cancel,remove])button.disabled=true;input.disabled=true;error.textContent='';
    try{
      await card._hass.callWS({type:`carrot_ha/charge_payment/${deleting?'delete':'save'}`,entry_id:entryId,
        payment_id:data.payment_id,source_event_ids:data.source_event_ids,expected_version:data.payment_version,
        ...(!deleting?{actual_cost_krw:amount}:{})});
      // Mark the committed state immediately; a read failure must not invite a duplicate write.
      data.actual_cost_krw=deleting?null:amount;data.effective_cost_krw=deleting?data.estimated_cost_krw:amount;
      data.cost_source=deleting?'estimated':'actual';data.payment_version++;
      pending=false;close();
      try{await refreshChargeCosts(card);}catch{card.error=en?'Payment saved. Refresh to update totals.':'금액이 저장되었습니다. 합계 갱신을 위해 새로고침하세요.';card.render();}
    }catch(failure){
      error.textContent=failure?.code==='conflict'?(en?'Record changed. Cancel, refresh and try again.':'기록이 변경되었습니다. 취소 후 새로고침하고 다시 입력하세요.'):(en?'Could not save. Your input is preserved; please retry.':'저장하지 못했습니다. 입력값을 유지했습니다. 다시 시도하세요.');
    }finally{pending=false;for(const button of [save,cancel,remove])button.disabled=false;input.disabled=false;}
  };
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();submit(false);};remove.onclick=()=>submit(true);
  document.body.appendChild(dialog);dialog.showModal();input.focus();
}

"""Apply the favorite-charger UI changes to a copy of the journal frontend.

Usage: python3 apply_ui.py <dir with carrot-vehicle-journal.js and carrot-journal-design.js>
The preview runs it on copies in this folder; after approval the same script is run on
custom_components/carrot_ha/frontend so the reviewed and shipped code are identical.
"""
import sys
from pathlib import Path

base = Path(sys.argv[1])


def patch(name, edits):
    path = base / name
    text = path.read_text()
    for old, new in edits:
        assert text.count(old) == 1, (name, text.count(old), old[:70])
        text = text.replace(old, new)
    path.write_text(text)


LEDGER_OLD = """      let mainTitle='',subTitle='';
      if(r.subcategory){"""
LEDGER_NEW = """      let mainTitle='',subTitle='',addressLine='',mainIsPlace=!r.subcategory&&!!placeName,subIsPlace=!!r.subcategory&&!!placeName,chargePlace=false;
      if(r.kind==='expense'&&r.category==='charging'){
        // Charging rows: place name, its address, then charged energy · odometer.
        const imported=Number(String(r.import_source?.fields?.['충전량']??'').replaceAll(',',''));
        const kwh=[r.input?.billed_charge_kwh,r.billed_charge_kwh,imported,r.battery_charge_kwh].find(v=>Number.isFinite(v)&&v>0);
        const meta=[r.subcategory?esc(r.subcategory):'',kwh!=null?`${kwh.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1})}kWh`:'',r.odometer_km!=null?`${numeric(r.odometer_km,0)}km`:''].filter(Boolean).join(' · ');
        const address=r.location?.address?.trim()||'';
        mainIsPlace=chargePlace=!!placeName;subIsPlace=false;
        if(placeName){mainTitle=esc(placeName);if(address&&address!==placeName)addressLine=esc(address);subTitle=meta;}
        else mainTitle=meta;
      }else if(r.subcategory){"""

MEMO_OLD = """${mainTitle?`<span class="ledger-main-title ${!r.subcategory&&placeName?'ledger-place-name':''}">${mainTitle}</span>`:''}${subTitle?`<span class="ledger-sub-title ${r.subcategory&&placeName?'ledger-place-name':''}">${subTitle}</span>`:''}"""
MEMO_NEW = """${mainTitle?`<span class="ledger-main-title ${mainIsPlace?'ledger-place-name':''}${chargePlace?' ledger-charge-place':''}">${mainTitle}</span>`:''}${addressLine?`<span class="ledger-place-address">${addressLine}</span>`:''}${subTitle?`<span class="ledger-sub-title ${subIsPlace?'ledger-place-name':''}">${subTitle}</span>`:''}"""

KWH_OLD = """if(quantity!=null){fields.billed_charge_kwh.value=quantity;if(record.billed_charge_kwh==null&&facts.billed_charge_kwh==null)this.chargeAutoDefaults.billed_charge_kwh=Number(quantity);}}"""
# Shown to one decimal; the rounded text is an automatic default, so saving without touching it never rewrites the measured quantity.
KWH_NEW = """if(quantity!=null){const shown=Number(Number(quantity).toFixed(1));fields.billed_charge_kwh.value=shown.toFixed(1);this.chargeAutoDefaults.billed_charge_kwh=shown;}}"""

METHODS = """  // Favorite chargers (EV only): the charger the user usually uses at a spot names later automatic charges there.
  favoriteEligible(){return this.favoritesSupported!==false&&this.recordMode==='charging'&&this.entries.find(e=>e.entry_id===this.entry)?.fuel==='electric';}
  async loadFavorites(){if(this.favoriteEligible()){const entry=this.entry;try{const list=await this.call('favorite/list',{entry_id:entry});if(entry!==this.entry)return;this.favorites=Array.isArray(list)?list:[];this.favoritesSupported=true;}catch{this.favorites=[];this.favoritesSupported=false;}}this.renderFavorite();}
  favoriteFor(place){if(!place)return null;const name=(this.$('locationName').value||place.name||'').trim();return (this.favorites||[]).find(f=>{const l=f.location;return place.station_id||l.station_id?place.station_id===l.station_id&&(place.provider||'')===(l.provider||''):l.name===name&&(l.address||'')===(place.address||'');})||null;}
  renderFavorite(){
    const row=this.$('favoriteRow');if(!row)return;
    const eligible=this.favoriteEligible(),d=this.draftLocation,placed=!!(d&&(d.address||d.latitude!=null)),existing=eligible&&placed?this.favoriteFor(d):null,box=this.$('favoritePlace');
    row.hidden=!(eligible&&placed);
    if(!this.favoriteTouched)box.checked=!!existing;
    row.classList.toggle('on',box.checked);
    this.$('favoriteTitle').textContent=existing?(box.checked?'자주 가는 충전소로 등록돼 있어요':'저장하면 즐겨찾기에서 빼요'):'자주 가는 충전소로 등록';
    this.$('favoriteHint').textContent=existing&&!box.checked?'이미 기록된 위치 이름은 그대로 둬요.':'여기서 다시 충전하면 이 이름으로 자동 기록해요.';
    this.$('favoritePastRow').hidden=row.hidden||!box.checked;
    const list=this.$('favoritePlaces'),items=eligible?(this.favorites||[]):[];list.hidden=!items.length;
    list.innerHTML=items.length?'<span class="favorite-places-title">★ 자주 가는 충전소</span>'+items.map((f,i)=>`<span class="favorite-chip"><button type="button" class="favorite-chip-pick" data-favorite="${i}">${esc(f.location.name)}</button><button type="button" class="favorite-chip-remove" data-favorite-remove="${i}" aria-label="${esc(f.location.name)} 즐겨찾기 삭제">×</button></span>`).join(''):'';
  }
  async pickFavorite(event){
    const pick=event.target.closest('[data-favorite]'),remove=event.target.closest('[data-favorite-remove]');
    if(pick){const place={...this.favorites[Number(pick.dataset.favorite)].location};this.favoriteTouched=false;if(!this.draftLocation)this.draftLocation=emptyLocation();let maps=null;try{maps=await this.kakaoMaps();}catch{}this.setLocation(place,maps);return;}
    if(!remove)return;const favorite=this.favorites[Number(remove.dataset.favoriteRemove)];
    if(!favorite||!confirm(`'${favorite.location.name}'을(를) 자주 가는 충전소에서 뺄까요? 이미 기록된 위치 이름은 그대로 둬요.`))return;
    try{await this.call('favorite/delete',{entry_id:this.entry,favorite_id:favorite.id});}catch(e){this.$('recordError').textContent=e.message||'즐겨찾기를 삭제하지 못했어요.';}
    this.favoriteTouched=false;await this.loadFavorites();
  }
  async syncFavorite(recordId,location){
    if(!this.favoriteEligible()||!location||!(location.address||location.latitude!=null))return;
    const existing=this.favoriteFor(location),wanted=this.$('favoritePlace').checked;
    try{
      // Saving again at a favorite also learns this record's charge-start position.
      if(wanted&&location.name)await this.call('favorite/save',{entry_id:this.entry,location,record_id:recordId,apply_past:this.$('favoritePast').checked});
      else if(!wanted&&existing&&this.favoriteTouched)await this.call('favorite/delete',{entry_id:this.entry,favorite_id:existing.id});
    }catch(e){throw new Error('기록은 저장했지만 즐겨찾기를 반영하지 못했어요. '+(e.message||''));}
  }
"""

patch('carrot-vehicle-journal.js', [
    ("if(result.selection_source&&!['automatic','automatic_address','manual'].includes(result.selection_source))",
     "if(result.selection_source&&!['automatic','automatic_address','manual','favorite'].includes(result.selection_source))"),
    (LEDGER_OLD, LEDGER_NEW),
    (MEMO_OLD, MEMO_NEW),
    (KWH_OLD, KWH_NEW),
    ('id="placeSearch" class="btn-loc-search">검색</button></div>',
     'id="placeSearch" class="btn-loc-search">검색</button></div><div id="favoritePlaces" class="favorite-places" hidden></div>'),
    ('id="locNameReset" class="btn-loc-name-reset" hidden>검색된 이름으로 되돌리기</button></div></label>',
     'id="locNameReset" class="btn-loc-name-reset" hidden>검색된 이름으로 되돌리기</button></div></label>'
     '<label id="favoriteRow" class="loc-favorite-row" hidden><input type="checkbox" id="favoritePlace"><span class="loc-favorite-star" aria-hidden="true">★</span><span class="loc-favorite-text"><b id="favoriteTitle">자주 가는 충전소로 등록</b><small id="favoriteHint">여기서 다시 충전하면 이 이름으로 자동 기록해요.</small></span></label>'
     '<label id="favoritePastRow" class="loc-favorite-past" hidden><input type="checkbox" id="favoritePast"><span>주소만 기록된 이전 충전에도 이 이름 적용</span></label>'),
    ("    this.$('removeLocation').onclick=()=>{",
     "    this.$('favoritePlace').onchange=()=>{this.favoriteTouched=true;this.setDraftDirty(true);this.renderFavorite();};this.$('favoritePast').onchange=()=>this.setDraftDirty(true);this.$('favoritePlaces').onclick=e=>this.pickFavorite(e);\n"
     "    this.$('removeLocation').onclick=()=>{"),
    ("this.updateNameState();}\n  renderLocation(){", "this.updateNameState();this.renderFavorite();}\n" + METHODS + "  renderLocation(){"),
    ("    const form=this.$('recordForm');form.elements.date.value=isReceipt?",
     "    this.favoriteTouched=false;this.$('favoritePast').checked=false;this.loadFavorites();\n"
     "    const form=this.$('recordForm');form.elements.date.value=isReceipt?"),
    ("      updateProgress('저장 완료! ✓',100);", "      await this.syncFavorite(result.id,payload.location);\n      updateProgress('저장 완료! ✓',100);"),
])

CSS = """
/* Charging ledger rows: address line under the place name. */
.ledger-main-title.ledger-charge-place,#page3 .ledger-table .ledger-main-title.ledger-charge-place{font-weight:750}
.ledger-place-address{font-size:.88em;font-weight:700;color:var(--j-sub);opacity:.78;line-height:1.4;overflow-wrap:anywhere;min-width:0}
/* Favorite chargers in the record dialog. */
#recordDialog .loc-favorite-row{grid-column:1 / -1;display:flex;align-items:center;gap:10px;margin-top:8px;padding:9px 12px;border:1px solid var(--j-border);border-radius:12px;background:var(--j-surface);cursor:pointer;min-width:0}
#recordDialog .loc-favorite-row[hidden],#recordDialog .loc-favorite-past[hidden],#recordDialog .favorite-places[hidden]{display:none!important}
#recordDialog .loc-favorite-row input,#recordDialog .loc-favorite-past input{position:absolute;opacity:0;width:1px;height:1px;min-height:0;margin:0;pointer-events:none}
#recordDialog .loc-favorite-star{flex:0 0 auto;font-size:18px;line-height:1;color:var(--j-sub);opacity:.55;transition:color .15s ease,opacity .15s ease}
#recordDialog .loc-favorite-row.on{border-color:var(--j-accent)}
#recordDialog .loc-favorite-row.on .loc-favorite-star{color:var(--j-accent);opacity:1}
#recordDialog .loc-favorite-row:has(input:focus-visible),#recordDialog .loc-favorite-past:has(input:focus-visible){outline:2px solid var(--j-accent);outline-offset:2px}
#recordDialog .loc-favorite-text{display:flex;flex-direction:column;gap:1px;min-width:0}
#recordDialog .loc-favorite-text b{font-size:13px;font-weight:700;color:var(--j-ink)}
#recordDialog .loc-favorite-text small{font-size:11.5px;color:var(--j-sub);line-height:1.35}
#recordDialog .loc-favorite-past{grid-column:1 / -1;display:flex;align-items:center;gap:8px;padding:4px 12px 0;font-size:12px;color:var(--j-sub);cursor:pointer}
#recordDialog .loc-favorite-past::before{content:'';flex:0 0 14px;width:14px;height:14px;box-sizing:border-box;border:1.5px solid var(--j-border);border-radius:4px;background:var(--j-bg)}
#recordDialog .loc-favorite-past:has(input:checked){color:var(--j-ink)}
#recordDialog .loc-favorite-past:has(input:checked)::before{background:var(--j-accent);border-color:var(--j-accent);box-shadow:inset 0 0 0 2.5px var(--j-bg)}
#recordDialog .favorite-places{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px;min-width:0}
#recordDialog .favorite-places-title{flex:0 0 auto;font-size:11.5px;font-weight:700;color:var(--j-accent)}
#recordDialog .favorite-chip{display:inline-flex;align-items:stretch;max-width:100%;min-width:0;border:1px solid var(--j-border);border-radius:9999px;background:var(--j-surface);overflow:hidden}
#recordDialog .favorite-chip button{border:0!important;background:transparent!important;color:var(--j-ink)!important;font-size:12px!important;min-height:28px!important;height:auto!important;padding:4px 4px 4px 11px!important;border-radius:0!important;cursor:pointer;min-width:0;box-shadow:none!important}
#recordDialog .favorite-chip .favorite-chip-pick{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#recordDialog .favorite-chip .favorite-chip-remove{flex:0 0 auto;padding:4px 10px 4px 5px!important;color:var(--j-sub)!important}
#recordDialog .favorite-chip button:hover{background:var(--j-raised)!important}
"""
END = "@media(max-width:600px){.trend-rank-hint{display:none}}\n`;"
patch('carrot-journal-design.js', [
    (END, END[:-2] + CSS.lstrip("\n") + "`;"),
])
print('applied to', base)

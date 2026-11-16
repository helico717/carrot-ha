from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[2]
out=Path('/private/tmp/carrot-assist-default-preview')
shutil.copytree(root/'custom_components/carrot_ha/frontend',out/'frontend',dirs_exist_ok=True)
p=out/'frontend/carrot-assist-stats.js';s=p.read_text()
s=s.replace("scope: 'all'", "scope: 'auto'")
s=s.replace("chart: 'month'", "chart: 'day'")
a=s.index('// 주행 탭이 보일 때만 호출된다.')
s=s[:a]+'''// Auto scope follows the selected trip date; explicit choices survive background refresh.
export function assistScope(card) {
  const a=assistState(card), sel=a.day||card.tripDay;
  if(a.scopeDate!==sel){
    if(a.scopeDate!==undefined)a.scope='auto';
    a.scopeDate=sel;
  }
  if(!sel)return 'all';
  if(a.scope==='day'||a.scope==='all')return a.scope;
  return a.all?.days?.some(d=>d.date===sel)?'day':'all';
}

'''+s[a:]
s=s.replace("const needDay = a.scope === 'day'", "const needDay = assistScope(card) === 'day'")
s=s.replace('    await Promise.all(job);', '''    await Promise.all(job);
    // Once the summary arrives, fetch the selected day's detail only when it has data.
    const selected=a.day||card.tripDay;
    if(assistScope(card)==='day'&&selected&&!(a.days[selected]&&now-a.days[selected].at<TTL_MS)){
      const detail=await hass.callWS({type:'carrot_ha/assist/summary',entry_id:entry,period:'day',date:selected});
      if(seq===a.seq)a.days[selected]={...detail,at:now};
    }''')
s=s.replace("const scope = a.scope === 'day' && sel ? 'day' : 'all'", "const scope = assistScope(card)")
s=s.replace("a.day = b.dataset.assistDay; a.scope = 'day';", "a.day = b.dataset.assistDay; a.scopeDate=a.day; a.scope = 'day';")
s=s.replace('.as-gauge .track{stroke:var(--as-track);stroke-width:3}.as-gauge .fill{stroke:var(--as);stroke-width:5;', '.as-gauge .track{stroke:var(--as-track);stroke-width:8}.as-gauge .fill{stroke:var(--as);stroke-width:11;')
s=s.replace('.as-chip.on i{background:', '.as-chip i svg{display:block;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}\n.as-chip.on i{background:')
s=s.replace("${d && d.active ? '✓' : d ? '·' : ''}", '''${d && d.active ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg>' : d ? '·' : ''}''')
s=s.replace('font-size:19cqw;', 'font-size:18cqw;')
s=s.replace(' .as-plot{height:150px}', ''' .as-left{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);column-gap:16px;align-items:center}
 .as-scope{grid-column:1/-1;justify-self:center;margin-bottom:6px}
 .as-gauge{grid-column:1;grid-row:2/4;align-self:center;max-width:260px}
 .as-rows{grid-column:2;grid-row:2;margin-top:0;gap:10px;align-self:end}
 .as-best{grid-column:2;grid-row:3;align-self:start;margin-top:10px}
 .as-best small,.as-best p{overflow-wrap:anywhere}
 .as-plot{height:150px}''')
s=s.replace('}`;\n\n// ---- 상태·데이터 ----', '''}
@container(max-width:480px){
 .assist>.paneltitle{flex-wrap:wrap;gap:6px}
 .assist>.paneltitle h2{font-size:16px;white-space:nowrap}
 .as-left{column-gap:12px}
 .as-row{flex-direction:column;align-items:flex-start;gap:3px}
 .as-row b{font-size:14px}
 .as-best>div{flex-direction:column;align-items:flex-start;gap:4px}
 .as-best b{font-size:22px}
 .as-best p{text-align:left}
}`;

// ---- 상태·데이터 ----''')
p.write_text(s)
shutil.copy2(Path(__file__).with_name('index.html'),out/'index.html')
print(out)

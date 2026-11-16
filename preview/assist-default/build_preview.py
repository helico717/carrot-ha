from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[2]
out=Path('/private/tmp/carrot-assist-default-preview')
shutil.copytree(root/'custom_components/carrot_ha/frontend',out/'frontend',dirs_exist_ok=True)
p=out/'frontend/carrot-assist-stats.js';s=p.read_text()
s=s.replace("scope: 'all'", "scope: 'auto'")
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
s=s.replace('.as-gauge .track{stroke:var(--as-track);stroke-width:3}.as-gauge .fill{stroke:var(--as);stroke-width:5;', '.as-gauge .track{stroke:var(--as-track);stroke-width:10}.as-gauge .fill{stroke:var(--as);stroke-width:14;')
s=s.replace('.as-chip.on i{background:', '.as-chip i svg{display:block;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}\n.as-chip.on i{background:')
s=s.replace("${d && d.active ? '✓' : d ? '·' : ''}", '''${d && d.active ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg>' : d ? '·' : ''}''')
s=s.replace('font-size:19cqw;', 'font-size:18cqw;')
p.write_text(s)
shutil.copy2(Path(__file__).with_name('index.html'),out/'index.html')
print(out)

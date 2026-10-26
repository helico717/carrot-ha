/* Navigate the authenticated drive catalog without downloading sibling logs. */
(() => {
  const current=decodeURIComponent(location.pathname.split('/').at(-1));
  const drive=current.slice(0,current.lastIndexOf('--'));
  const root=location.pathname.slice(0,location.pathname.lastIndexOf('/v2/'));
  const nav=document.createElement('nav');nav.className='v2-segment-nav';nav.setAttribute('aria-label','리플레이 V2 세그먼트');
  nav.innerHTML='<select aria-label="리플레이 V2 세그먼트" disabled><option>구간 목록 불러오는 중</option></select><button type="button" data-previous disabled>이전</button><button type="button" data-next disabled>다음</button><span role="status"></span>';
  const hero=document.querySelector('.share-hero');hero.after(nav);
  const select=nav.querySelector('select'),previous=nav.querySelector('[data-previous]'),next=nav.querySelector('[data-next]');
  let segments=[];
  function go(name){if(segments.includes(name)&&name!==current)location.replace(location.pathname.slice(0,location.pathname.lastIndexOf('/')+1)+encodeURIComponent(name));}
  previous.onclick=()=>go(segments[segments.indexOf(current)-1]);next.onclick=()=>go(segments[segments.indexOf(current)+1]);select.onchange=()=>go(select.value);
  async function load(){
    const names=new Set(),times={};let offset=0;
    for(let page=0;page<100;page++){
      const response=await fetch(`${root}/segments/${encodeURIComponent(drive)}?offset=${offset}&limit=2000&sort=asc`,{cache:'no-store'});
      if(!response.ok)throw Error(`구간 목록을 불러오지 못했습니다 (${response.status}).`);
      const data=await response.json(),values=data.segments||data.segmentFolders||[];Object.assign(times,data.segmentTimes||{});
      for(const name of values)if(name.slice(0,name.lastIndexOf('--'))===drive)names.add(name);
      if(!data.hasMore||!values.length)break;offset=data.nextOffset??offset+values.length;
    }
    names.add(current);segments=[...names].sort((a,b)=>Number(a.split('--').at(-1))-Number(b.split('--').at(-1)));
    select.replaceChildren();for(const name of segments){const option=document.createElement('option'),time=times[name]?.startEpoch||times[name]?.endEpoch;option.value=name;option.textContent=`${name===current?'[현재 구간] ':''}${name}${time?' · '+new Date(time*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}):''}`;if(name===current){option.selected=true;option.setAttribute('aria-current','true');}select.append(option);}
    select.disabled=false;const index=segments.indexOf(current);previous.disabled=index<=0;next.disabled=index>=segments.length-1;
    nav.querySelector('[role="status"]').textContent=`${index+1} / ${segments.length}`;
  }
  load().catch(error=>{select.options[0].textContent=current;nav.querySelector('[role="status"]').textContent=error.message;});
})();

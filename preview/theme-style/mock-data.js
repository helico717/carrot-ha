// preview/production 하네스 공용 더미 데이터(차량·차계부). 실제 차량 데이터가 아닙니다.
/* ================= 더미 데이터 ================= */
const TZ='Asia/Seoul';
const kstParts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));
const kst=(daysAgo,h,m=0)=>{const n=kstParts(new Date());return new Date(Date.UTC(n.year,n.month-1,n.day-daysAgo,h-9,m));};
const iso=d=>d.toISOString();
function route(seed,km){
  const pts=[],n=44,la0=37.5665+((seed*7)%10)*.004,lo0=126.978+((seed*5)%9)*.005,dir=seed%2?1:-1;
  for(let i=0;i<n;i++){const t=i/(n-1);const sp=Math.sin(Math.PI*Math.min(1,t*1.1))*(8+((seed*3)%12))+3;
    pts.push({latitude:+(la0+t*km*.0075*dir+Math.sin(t*6+seed)*.006).toFixed(6),longitude:+(lo0+t*km*.0095+Math.cos(t*4+seed)*.005).toFixed(6),speedMps:+sp.toFixed(2)});}
  return pts;
}
// [daysAgo, hh, mm, km, min, startSoc]
const TRIPS=[[0,7,20,12.4,28,70],[0,9,5,6.1,17,66],[1,8,10,23.8,41,82],[1,18,40,25.2,46,74],[2,8,5,11.9,26,90],[2,12,30,4.8,12,86],[2,19,10,13.4,30,80],
  [3,7,55,31.5,52,64],[3,18,20,29.9,50,52],[4,9,15,8.2,21,88],[5,10,0,47.6,63,92],[5,17,45,44.1,66,70],[6,8,30,15.0,33,95],[6,18,0,17.3,36,90]];
const trips=TRIPS.map(([da,h,m,km,min,soc],i)=>{const s=kst(da,h,m),e=new Date(+s+min*60000),eff=5.2+((i*7)%11)/10;
  const wh=Math.round(km/eff*1000),used=wh/77000*100;
  return {event_id:'t'+i,kind:'trip',observed_at:iso(e),data:{started_at:iso(s),ended_at:iso(e),duration_s:min*60,distance_m:Math.round(km*1000),energy_wh:wh,energy_complete:true,
    start_soc_percent:soc,end_soc_percent:+(soc-used).toFixed(1),start_soc_source:'can',route:route(i+1,km)}};});
const CHARGES=[[1,22,30,390,26.4,34,88,1],[2,13,10,36,31.8,15,62,6],[4,23,0,300,21.0,40,81,1],[6,12,0,28,24.0,12,52,6]];
const charges=CHARGES.map(([da,h,m,min,kwh,s0,s1,mode],i)=>{const s=kst(da,h,m),e=new Date(+s+min*60000);
  return {event_id:'c'+i,kind:'charge',observed_at:iso(e),data:{started_at:iso(s),ended_at:iso(e),duration_s:min*60,energy_kwh:kwh,start_soc_percent:s0,end_soc_percent:s1,can_mode:mode,
    payment_id:'p'+i,payment_version:1,source_event_ids:['c'+i],estimated_cost_krw:Math.round(kwh*290),actual_cost_krw:i===0?7680:null,effective_cost_krw:i===0?7680:Math.round(kwh*290),cost_source:i===0?'actual':'estimated'}};});
const ymd=d=>{const k=kstParts(d);return `${k.year}-${String(k.month).padStart(2,'0')}-${String(k.day).padStart(2,'0')}`;};
const days=Array.from({length:7},(_,i)=>{const d=kst(6-i,12);
  const hrs=Array.from({length:24},(_,h)=>({soc:Math.max(12,92-(i*3)-h*1.1+(h>14?8:0))}));
  return {date:ymd(d),used:[9,14,22,11,7,16,12][i],hours:hrs,drive_s:3600+i*540,charge_s:[0,23400,0,2160,0,0,0][i],charge_hours:[]};});
const values={soc_percent:68,range_km:312,estimated_range_km:312,odometer_km:18420,outside_temp_c:14,aux_voltage:12.6,hv_voltage:398.4,dcdc_temperature_c:41,
  onroad:false,charging:false,doors_locked:true,battery_kwh:77,soc_capacity_kwh:77,gear:'P',ac_on:false,speed_kph:0,
  month_distance_km:742,month_trip_count:31,month_charge_kwh:96.4,month_charge_cost:21800,month_slow_kwh:47.4,month_fast_kwh:49,
  parking_latitude:37.5665,parking_longitude:126.978,parking_at:iso(kst(0,9,40)),recorded_distance_km:742,
  measured_at:new Date().toISOString(),live_checked_at:new Date().toISOString(),live_status:'ok',cloud_status:'ok',
  battery_history:days,charge_cost_totals:{}};
const callApi=async(m,path)=>{
  if(path.endsWith('devices'))return {devices:[{entry_id:'fixture',device_id:'fixture'}]};
  if(path.includes('/dashboard/'))return {values};
  if(path.includes('kind=trip'))return {events:trips};
  if(path.includes('kind=charge'))return {events:charges};
  return {events:[]};
};

/* ---- 차계부 더미 ---- */
const L=n=>({name:n,address:n});
const rec=(id,da,cat,krw,x={})=>({id,kind:'expense',origin:'automatic',status:'active',version:1,accounting_date:ymd(kst(da,12)),category:cat,actual_krw:krw,estimated_krw:null,attachments:[],location:null,...x});
const jrecords=[
  rec('r1',1,'charging',8728,{location:L('꽃지해안공원 주차장 전기차충전소'),unit_price:{krw:200,unit:'kWh',approximate:true}}),
  rec('r2',2,'charging',10974,{location:L('티스테이션 의왕시청점 전기차충전소'),unit_price:{krw:313,unit:'kWh',approximate:false}}),
  rec('r3',4,'washing',9000,{origin:'manual',memo:'손세차'}),
  rec('r4',5,'charging',9420,{location:L('한국전력 본사 주차장 전기차충전소'),unit_price:{krw:292,unit:'kWh',approximate:false}}),
  rec('r5',7,'parking',6000,{origin:'manual',location:L('코엑스 주차장')}),
  rec('r6',9,'maintenance',450000,{origin:'manual',subcategory:'휠 타이어 구매',memo:'235 60 R18'}),
  rec('r7',11,'charging',18240,{location:L('테슬라 슈퍼차저 판교'),unit_price:{krw:341,unit:'kWh',approximate:false}}),
  rec('r8',13,'toll',2800,{origin:'manual',memo:'경부고속도로'}),
  rec('r9',16,'insurance',68400,{origin:'manual',memo:'자동차보험 분할'}),
  rec('r10',20,'charging',7650,{location:L('구리시청 전기차충전소'),unit_price:{krw:215,unit:'kWh',approximate:true}}),
];
const jdaily=n=>Array.from({length:n},(_,i)=>{const d=kst(n-1-i,12);const dist=[18,42,0,31,12,55,24,0,38,16][i%10]+((i*3)%7);
  const ch=i%5===1?+(12+(i%4)*3).toFixed(1):0;return {day:ymd(d),date:ymd(d),distance_km:dist,battery_charge_kwh:ch,billed_charge_kwh:ch,drive_soc_used_pp:+(dist/5.4).toFixed(1),drive_energy_kwh:+(dist/5.6).toFixed(1),energy_distance_km:dist,
    cost_categories:ch?{charging:{effective_krw:Math.round(ch*270)}}:{}};});
const sum=(a,k)=>a.reduce((s,r)=>s+(r[k]||0),0);
const mkTotals=daily=>({distance_km:sum(daily,'distance_km'),battery_charge_kwh:+sum(daily,'battery_charge_kwh').toFixed(1),billed_charge_kwh:+sum(daily,'billed_charge_kwh').toFixed(1),
  charge_effective_krw:Math.round(sum(daily,'battery_charge_kwh')*270),total_cost_krw:Math.round(sum(daily,'battery_charge_kwh')*270)+467400,drive_soc_used_pp:+sum(daily,'drive_soc_used_pp').toFixed(1),
  drive_energy_kwh:+sum(daily,'drive_energy_kwh').toFixed(1),energy_distance_km:sum(daily,'energy_distance_km'),efficiency_km_kwh:5.6,fast_count:2,slow_count:5,unknown_count:0,
  categories:{charging:{effective_krw:Math.round(sum(daily,'battery_charge_kwh')*270)},washing:{effective_krw:9000},maintenance:{effective_krw:450000},parking:{effective_krw:6000},toll:{effective_krw:2800}}});
const jhass=dark=>({language:'ko',themes:{darkMode:dark},user:{id:'u',is_admin:true},states:{},config:{time_zone:TZ},
  async callWS(msg){const t=msg.type;
    if(t.endsWith('/entries'))return [{entry_id:'demo',title:'ID.4',linked:true,fuel:'electric',is_default:true}];
    if(t.endsWith('/query')){const daily=jdaily(Math.max(8,kstParts(new Date()).day));
      return {totals:mkTotals(daily),daily,records:jrecords,recent_records:jrecords,record_count:jrecords.length,timezone:TZ,has_more:false,status:{phase:'complete'},
        latest:{soc_percent:68,range_km:312,odometer_km:18420,doors_locked:true,measured_at:new Date().toISOString()},
        station_stats:{places:[],unlocated_records:0,basis:''},expense_category_groups_supported:true,manual_trip_records_supported:true,fuel_facts:null,odometer_facts:null};}
    if(t.endsWith('/map/config'))return {key:'',rest_configured:false};
    if(t.endsWith('/settings'))return {map_key:'',kakao_rest_key:''};
    return {};},
  async fetchWithAuth(){return new Response('{}',{status:404});}});


export {TZ,trips,charges,values,callApi,jhass,kst};

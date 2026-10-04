"""Analyze selected passive MEB monitoring fields without changing raw archives.

Usage: python3 tools/analyze_can_monitoring.py --archive capture.tar --output report.json
Definitions are hypotheses from vw_meb.dbc, not manufacturer specifications.
DC reference window is the documented October 4, 2026 event. Driving labels come
from batch context and have coarser timing. No per-batch file order is assumed.
"""
import argparse,tarfile,gzip,json,time,collections,datetime,math,statistics
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--archive',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
from pathlib import Path
# Little-endian definitions from the checked-in vw_meb.dbc. No CAN transmissions.
defs={
 0xbe:[('motor_power_candidate_kw',56,12,.5,-1023,set()),('hv_voltage_candidate_v',86,12,.2,0,set()),('hv_voltage_02_candidate_v',113,11,.24,0,set())],
 0xb8:[('motor_current_a',24,11,1,-1023,{2046,2047})],
 0x365:[('lv_voltage_request_v',50,6,.1,10.6,set()),('lv_min_v',56,8,.1,0,{254,255})],
 0x503:[('hv_active',41,1,1,0,set()),('hv_error',42,1,1,0,set())],
 0x5a2:[('capacity_ah',23,11,.2,0,{2047}),('target_soc',53,11,.05,0,{2046,2047}),('bms_error',20,3,1,0,{7})],
 0x5ac:[('consumer_current_a',0,12,.1,-204.7,{4094,4095}),('aux_power_candidate_w',15,9,50,0,{510,511}),('climate_power_request_w',24,8,50,0,{254,255}),('energy_wh',32,11,50,0,{0,2046,2047})],
 0x5cd:[('dcdc_temperature_c',56,8,1,-40,{254,255}),('dcdc_mode',21,3,1,0,{7}),('dcdc_temperature_limit',20,1,1,0,set())],
 0x3db:[('outside_temperature_c',56,8,.5,-50,{254,255})],
 0x569:[('ptc_on_candidate',7,1,1,0,set())],
}
zone=datetime.timezone(datetime.timedelta(hours=9));lo=datetime.datetime(2026,10,4,22,29,38,486000,tzinfo=zone).timestamp();hi=datetime.datetime(2026,10,4,22,42,27,168000,tzinfo=zone).timestamp()
stats={};minutes={};frames=0;batches=0;beg=time.time();bad=[]
def fmt(t):return datetime.datetime.fromtimestamp(t,zone).isoformat()
with tarfile.open(args.archive) as tf:
 for member in tf:
  if not member.name.endswith('.json.gz'):continue
  d=json.loads(gzip.decompress(tf.extractfile(member).read()));offset=(d['unix_ns']-d['boot_ns'])/1e9;drive=d.get('context',{}).get('values',{}).get('driving') is True
  for ns,address,bus,payload in d['frames']:
   if bus!=1 or address not in defs:continue
   frames+=1;rawbytes=bytes.fromhex(payload);raw=int.from_bytes(rawbytes,'little');t=offset+ns/1e9;phase='dc' if lo<=t<hi else 'drive' if drive else 'park';minute=int(t//60)
   for name,start,width,factor,delta,invalid in defs[address]:
    if start+width>len(rawbytes)*8:continue
    code=(raw>>start)&((1<<width)-1);value=round(code*factor+delta,5)
    rec=stats.setdefault(name,{'address':hex(address),'bus':bus,'definition':[start,width,factor,delta],'invalid_codes':sorted(invalid),'phases':{},'first':None,'last':None,'example':{}})
    if rec['first'] is None or t<rec['first'][0]:rec['first']=[t,value,payload]
    if rec['last'] is None or t>rec['last'][0]:rec['last']=[t,value,payload]
    st=rec['phases'].setdefault(phase,{'total':0,'invalid':0,'raw':collections.Counter(),'valid_n':0,'sum':0,'min':None,'max':None})
    st['total']+=1;st['raw'][code]+=1
    if code in invalid:st['invalid']+=1;continue
    st['valid_n']+=1;st['sum']+=value
    if st['min'] is None or value<st['min']:st['min']=value
    if st['max'] is None or value>st['max']:st['max']=value
    rec['example'].setdefault(phase,[fmt(t),payload,code,value])
    if name in ('motor_power_candidate_kw','energy_wh','climate_power_request_w','aux_power_candidate_w'):
     m=minutes.setdefault(minute,{}).setdefault(name,{'n':0,'sum':0,'first':None,'last':None,'drive_n':0,'dc_n':0})
     m['n']+=1;m['sum']+=value;m['drive_n']+=phase=='drive';m['dc_n']+=phase=='dc'
     if m['first'] is None or t<m['first'][0]:m['first']=[t,value]
     if m['last'] is None or t>m['last'][0]:m['last']=[t,value]
  batches+=1
  if batches%500==0:print('batches',batches,'selected frames',frames,'elapsed',round(time.time()-beg,1),flush=True)
for rec in stats.values():
 for st in rec['phases'].values():
  st['raw']=dict(st['raw']);st['mean']=st['sum']/st['valid_n'] if st['valid_n'] else None
 for key in ('first','last'):rec[key][0]=fmt(rec[key][0])
result={'batches':batches,'selected_frames':frames,'stats':stats,'minutes':minutes,'seconds':time.time()-beg}
points=[]
for fields in minutes.values():
 p=fields.get('motor_power_candidate_kw');e=fields.get('energy_wh')
 if not p or not e or p['drive_n']/p['n']<.95 or e['last'][0]-e['first'][0]<55 or p['dc_n']:continue
 points.append((p['sum']/p['n'],(e['first'][1]-e['last'][1])*3.6/(e['last'][0]-e['first'][0])))
if len(points)>1:
 a,b=zip(*points);ma=statistics.mean(a);mb=statistics.mean(b)
 denominator=math.sqrt(sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))
 result['motor_energy_comparison']={'minutes':len(points),
  'pearson_r':sum((x-ma)*(y-mb) for x,y in points)/denominator if denominator else None,
  'mean_motor_kw':ma,'mean_energy_rate_kw':mb,'mean_difference_kw':mb-ma}
Path(args.output).write_text(json.dumps(result,indent=2))
for name,rec in stats.items():print(name,{k:{kk:s[kk] for kk in ('total','invalid','min','max','mean')} for k,s in rec['phases'].items()},flush=True)

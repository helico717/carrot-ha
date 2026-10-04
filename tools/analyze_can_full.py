"""Offline full MEB CAN inventory and DBC field audit. Requires numpy.
The default DC interval refers to the documented 2026-10-04 capture only.
Outputs may contain identifying raw payloads; keep full JSON local.
This tool sends no CAN messages and changes no archive files.
"""
import re,json,gzip,tarfile,time,collections,datetime,hashlib,argparse
from pathlib import Path
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('--archive',required=True);parser.add_argument('--dbc-dir',required=True);parser.add_argument('--output',required=True);parser.add_argument('--dc-start',type=float,default=1791120578.486);parser.add_argument('--dc-end',type=float,default=1791121347.168);args=parser.parse_args()
def parse(path):
 text=Path(path).read_text();msgs={};current=None
 for line in text.splitlines():
  b=re.match(r'BO_ (\d+) (\w+): (\d+)',line)
  if b:current=msgs.setdefault(int(b[1]),{'name':b[2],'length':int(b[3]),'signals':[]});continue
  s=re.match(r' SG_ (\w+)(?: ([mM]\w*))? : (\d+)\|(\d+)@([01])([+-]) \(([^,]+),([^\)]+)\) \[([^|]+)\|([^\]]+)\] "([^"]*)"',line)
  if s and current:
   name,mux,start,width,endian,sign,factor,offset,minimum,maximum,unit=s.groups()
   current['signals'].append(dict(name=name,mux=mux,start=int(start),width=int(width),little=endian=='1',signed=sign=='-',factor=float(factor),offset=float(offset),min=float(minimum),max=float(maximum),unit=unit,choices={}))
 for a,name,vals in re.findall(r'^VAL_ (\d+) (\w+) (.*);',text,re.M):
  for s in msgs.get(int(a),{}).get('signals',[]):
   if s['name']==name:s['choices']={int(k):v for k,v in re.findall(r'(-?\d+) "([^"]*)"',vals)}
 return msgs
DB={name:parse(Path(args.dbc_dir)/name) for name in ('vw_meb.dbc','vw_meb_2024.dbc')}
def decode(data,s):
 start=s['start'];width=s['width'];shift=start%8 if s['little'] else 7-start%8;first=start//8;span=(shift+width+7)//8
 if first+span>data.shape[1]:return None
 raw=np.zeros(len(data),dtype=np.uint64)
 if s['little']:
  for i in range(span):raw|=data[:,first+i].astype(np.uint64)<<(8*i)
  raw=(raw>>shift)&((1<<width)-1)
 else:
  for i in range(span):raw=(raw<<8)|data[:,first+i].astype(np.uint64)
  raw=(raw>>(span*8-shift-width))&((1<<width)-1)
 raw=raw.astype(np.int64)
 if s['signed']:raw=np.where(raw&(1<<(width-1)),raw-(1<<width),raw)
 return raw
start=time.time();inv={};signals={};total=0;batchn=0;errors=[];lo=args.dc_start;hi=args.dc_end
with tarfile.open(args.archive) as tf:
 for member in tf:
  if not member.name.endswith('.json.gz'):continue
  try:d=json.loads(gzip.decompress(tf.extractfile(member).read()))
  except Exception as e:errors.append([member.name,str(e)]);continue
  offset=(d['unix_ns']-d['boot_ns'])/1e9;drive=d.get('context',{}).get('values',{}).get('driving') is True;groups={}
  for ns,address,bus,payload in d['frames']:
   t=offset+ns/1e9;phase='dc' if lo<=t<hi else 'drive' if drive else 'park';key=(bus,address,len(payload)//2,phase)
   g=groups.get(key)
   if g is None:g=groups[key]={'payloads':[],'first':t,'last':t}
   g['payloads'].append(payload);g['first']=min(g['first'],t);g['last']=max(g['last'],t)
  for (bus,address,length,phase),g in groups.items():
   n=len(g['payloads']);total+=n;ikey=f'{bus}:{address:#x}';rec=inv.setdefault(ikey,{'bus':bus,'address':hex(address),'n':0,'lengths':{},'phases':{},'first':g['first'],'last':g['last'],'or':{},'and':{},'examples':{},'rates':[]})
   rec['n']+=n;rec['lengths'][str(length)]=rec['lengths'].get(str(length),0)+n;rec['phases'][phase]=rec['phases'].get(phase,0)+n;rec['first']=min(rec['first'],g['first']);rec['last']=max(rec['last'],g['last']);rec['examples'].setdefault(phase,g['payloads'][0])
   if n>2 and g['last']>g['first']:rec['rates'].append((n-1)/(g['last']-g['first']))
   if not length:continue
   data=np.frombuffer(bytes.fromhex(''.join(g['payloads'])),dtype=np.uint8).reshape(n,length)
   keylen=str(length);bor=np.bitwise_or.reduce(data,axis=0);band=np.bitwise_and.reduce(data,axis=0)
   if keylen in rec['or']:
    bor=np.bitwise_or(bor,np.frombuffer(bytes.fromhex(rec['or'][keylen]),dtype=np.uint8));band=np.bitwise_and(band,np.frombuffer(bytes.fromhex(rec['and'][keylen]),dtype=np.uint8))
   rec['or'][keylen]=bor.tobytes().hex();rec['and'][keylen]=band.tobytes().hex()
   if bus not in (0,1,2):continue
   for db,msgs in DB.items():
    msg=msgs.get(address)
    if not msg:continue
    muxraw={s['name']:decode(data,s) for s in msg['signals'] if s['mux']=='M'}
    for s in msg['signals']:
     raw=decode(data,s)
     if raw is None:continue
     if s['mux'] and s['mux'].startswith('m'):
      if len(muxraw)!=1:continue
      selector=next(iter(muxraw.values()))
      if selector is None:continue
      raw=raw[selector==int(s['mux'][1:])]
     if not len(raw):continue
     skey=f'{db}:{bus}:{address:#x}:{s["name"]}';sr=signals.setdefault(skey,{'dbc':db,'bus':bus,'address':hex(address),'message':msg['name'],'definition':s,'length_mismatch_n':0,'phases':{}})
     if length!=msg['length']:sr['length_mismatch_n']+=len(raw)
     st=sr['phases'].setdefault(phase,{'n':0,'min_raw':None,'max_raw':None,'sum_raw':0,'invalid_n':0,'hist':{},'hist_truncated':False,'outside_dbc_range_n':0})
     st['n']+=len(raw);mn=int(raw.min());mx=int(raw.max());st['min_raw']=mn if st['min_raw'] is None else min(st['min_raw'],mn);st['max_raw']=mx if st['max_raw'] is None else max(st['max_raw'],mx);st['sum_raw']+=int(raw.sum())
     invalid=[k for k,v in s['choices'].items() if re.search(r'init|fehler',v,re.I)]
     if invalid:st['invalid_n']+=int(np.isin(raw,invalid).sum())
     vals=raw*s['factor']+s['offset'];st['outside_dbc_range_n']+=int(((vals<s['min']-1e-8)|(vals>s['max']+1e-8)).sum())
     unique,counts=np.unique(raw,return_counts=True)
     for code,count in zip(unique,counts):
      k=str(int(code))
      if k in st['hist'] or len(st['hist'])<256:st['hist'][k]=st['hist'].get(k,0)+int(count)
      else:st['hist_truncated']=True
  batchn+=1
  if batchn%100==0:print('batches',batchn,'frames',total,'signals',len(signals),'seconds',round(time.time()-start,1),flush=True)
for rec in inv.values():
 rates=np.array(rec.pop('rates'));rec['batch_rate_median_hz']=float(np.median(rates)) if len(rates) else None
 rec['varying_bits']={k:int.from_bytes(bytes.fromhex(rec['or'][k]),'little')^int.from_bytes(bytes.fromhex(rec['and'][k]),'little') for k in rec['or']}
for sr in signals.values():
 for st in sr['phases'].values():
  s=sr['definition'];st['min']=st['min_raw']*s['factor']+s['offset'];st['max']=st['max_raw']*s['factor']+s['offset'];st['mean']=st['sum_raw']/st['n']*s['factor']+s['offset']
result={'batches':batchn,'total_frames':total,'errors':errors,'inventory':inv,'signals':signals,'dbc_sha256':{name:hashlib.sha256((Path(args.dbc_dir)/name).read_bytes()).hexdigest() for name in DB},'seconds':time.time()-start}
Path(args.output).write_text(json.dumps(result,indent=2));print('DONE',batchn,total,len(inv),len(signals),round(time.time()-start,1),flush=True)

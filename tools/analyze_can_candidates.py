"""Offline whole-frame checks of documented MEB candidate signals.
Definitions and limits: docs/raw-can-full-audit-2026-10-05.md.
Requires only Python standard library; no CAN transmissions.
"""
import argparse
p=argparse.ArgumentParser();p.add_argument('--archive',required=True);p.add_argument('--output',required=True);p.add_argument('--dc-start',type=float,default=1791120578.486);p.add_argument('--dc-end',type=float,default=1791121347.168);args=p.parse_args()
import json,gzip,tarfile,collections,time
out={};lo=args.dc_start;hi=args.dc_end
with tarfile.open(args.archive) as tf:
 for m in tf:
  if not m.name.endswith('.json.gz'):continue
  d=json.loads(gzip.decompress(tf.extractfile(m).read()));offset=(d['unix_ns']-d['boot_ns'])/1e9;drive=d.get('context',{}).get('values',{}).get('driving') is True
  for ns,a,b,h in d['frames']:
   if b!=1 or a not in (0x14a,0xcf,0x12dd54d1,0x1a555550,0x16a954a6):continue
   x=bytes.fromhex(h);t=offset+ns/1e9;phase='dc' if lo<=t<hi else 'drive' if drive else 'park';fields={}
   if a==0x16a954a6:
    valid=not(x[3]==254 and x[4]==254);fields={'bms11_cell_max_mv':((((x[6]&15)<<8)|x[5])+1000,valid),'bms11_cell_min_mv':(((x[7]<<4)|(x[6]>>4))+1000,valid),'bms11_isolation_code':((x[2]>>5)&7,True)}
   if a==0x14a:fields={'motor52_soc_candidate':(x[19]*.5,x[19]<254)}
   if a==0x12dd54d1:fields={'bms22_soc':((((x[3]&15)<<7)|(x[2]>>1))*.05,not(x[6]==254 and x[7]==255)),'bms22_energy':(((x[7]<<8)|x[6])*5,not(x[6]==254 and x[7]==255))}
   if a==0xcf:
    mode=x[2]&7;fields={'bms20_mode':(mode,True),'bms20_current':((((x[4]&127)<<8)|x[3])-16300,mode!=7),'bms20_voltage':(((x[7]<<4)|(x[6]>>4))*.25,mode!=7)}
   if a==0xcf:fields['bms20_power_kw']=(fields['bms20_current'][0]*.1*fields['bms20_voltage'][0]/1000,mode!=7)
   if a==0x1a555550:fields={'bms24_charging_active':(x[2]&1,True),'bms24_balancing':((x[1]>>6)&3,True)}
   for name,(v,valid) in fields.items():
    r=out.setdefault(name,{}).setdefault(phase,{'n':0,'invalid':0,'hist':{},'first':None,'last':None,'sum':0});r['n']+=1
    if not valid:r['invalid']+=1;continue
    if name=='bms20_current':v*=.1
    r['sum']+=v
    k=str(round(v,5));r['hist'][k]=r['hist'].get(k,0)+1
    if r['first'] is None or t<r['first'][0]:r['first']=[t,v]
    if r['last'] is None or t>r['last'][0]:r['last']=[t,v]
for ph in out.values():
 for r in ph.values():
  vals=[float(k) for k in r['hist']];r['min']=min(vals) if vals else None;r['max']=max(vals) if vals else None;r['mean']=r['sum']/(r['n']-r['invalid']) if r['n']>r['invalid'] else None
json.dump(out,open(args.output,'w'),indent=2)
print(json.dumps({k:{q:{z:v for z,v in r.items() if z!='hist'} for q,r in p.items()} for k,p in out.items()},indent=2))

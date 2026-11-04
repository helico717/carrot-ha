"""Replay sanitized session windows, not a claim of unobserved device behavior.

Input: JSON object with sessions containing mode (AC/DC), classification (CAN or
speed_inferred), date, legacy_partial_flag, points and following_points. Each
point is [unix_seconds, battery_Wh, display_SOC_or_null, power_kW_or_null,
CAN_mode_or_null, battery_temperature_or_null, driving_or_null, charging_or_null].
Historical inferred modes are simulation inputs, not decoded CAN measurements.
Publication gaps cannot establish that the vehicle collector was offline.
"""
import argparse
import importlib.util,json,collections
from pathlib import Path

def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Offline replay of anonymized charging observations; never modifies an archive.')
parser.add_argument('input', type=Path)
parser.add_argument('--before-recorder', type=Path, required=True)
parser.add_argument('--after-recorder', type=Path, required=True)
parser.add_argument('--legacy-engine', type=Path, default=ROOT/'collector/engine.py')
args = parser.parse_args()
old=load('before', args.before_recorder)
new=load('after', args.after_recorder)
legacy=load('legacy', args.legacy_engine)
class Store:
 def load(self):return {}

r=json.loads(args.input.read_text());rows=[]
for sess in r['sessions']:
 pts=sess['points'];following=sess['following_points'];code=4 if sess['mode']=='AC' else 6
 stop=next((p for p in following if p[6] is True or p[4] in (0,1,3)),None)
 if stop is None:
  rows.append(dict(date=sess['date'],mode=sess['mode'],status='no_observed_stop_within5min'));continue
 seq=pts+[p for p in following if p[0]<=stop[0]]
 results={}
 for label,module in [('before',old),('after',new)]:
  state={'charge_months':{},'charge_sessions':[]}
  for p in seq:
   driving=p[6] is True
   if sess['classification']=='CAN':
    actual=p[4];active=False if driving or actual in(0,1,3) else True if actual in(4,6) else None
   else:actual=code;active=not driving
   signal=dict(charging=active,code=actual,measured_at=module.stamp(p[0]),source_kind='actual' if sess['classification']=='CAN' else 'request',driving=driving)
   module.update(state,p[0],signal,p[1])
  closed=state['charge_sessions']
  c=closed[0] if closed else state.get('charge')
  results[label]=dict(closed=bool(closed),partial=c.get('partial') if c else None,reasons=c.get('partial_reasons',[]) if c else [],energy=c.get('energy_kwh') if c else None)
 # Reproduce the legacy invalidation with the observed driving boundary.
 e=legacy.Engine(Store(),'synthetic')
 for p in seq:
  e._sample_energy(p[0],p[6] is True,p[1])
  if p[6] is True:break
 legacy_partial=e.s.get('charge',{}).get('partial')
 rows.append(dict(date=sess['date'],mode=sess['mode'],classification=sess['classification'],recorded_partial=sess['legacy_partial_flag'],departure_observed=stop[6] is True,stop_delay_s=round(stop[0]-pts[-1][0]),legacy_partial=legacy_partial,**results))
print(json.dumps(rows,ensure_ascii=False,indent=2))
print(json.dumps(dict(replayed=sum('after' in row for row in rows),
    no_observed_stop=sum('after' not in row for row in rows),
    legacy_flagged_now_complete=sum(bool(row.get('recorded_partial')) and row.get('after',{}).get('partial') is False for row in rows),
    partial_with_observation_gaps=sum(row.get('after',{}).get('partial') is True for row in rows),
    energy_preserved=all(row['before']['energy']==row['after']['energy'] for row in rows if 'after' in row))))

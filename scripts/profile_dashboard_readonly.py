"""Read-only HA dashboard profiling; never initialize or migrate the archive."""
import base64
import subprocess
import sys
REMOTE = r'''
import sys,types,pathlib,sqlite3,time,json,threading
from contextlib import contextmanager
root=pathlib.Path('/config/custom_components/carrot_ha')
pkg=types.ModuleType('carrot_profile');pkg.__path__=[str(root)];sys.modules[pkg.__name__]=pkg
from carrot_profile.storage import Archive
from carrot_profile.battery_history import history
paths=sorted(pathlib.Path('/config/carrot_ha').glob('*.sqlite3'),key=lambda p:p.stat().st_size,reverse=True)
path=next(p for p in paths if 'before-' not in p.name and 'backup' not in p.name)
a=Archive.__new__(Archive);a.path=str(path);a.charge_timezone='Asia/Seoul';a._derived_lock=threading.RLock()
from carrot_profile import archive_codec
@contextmanager
def connect():
 db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True,timeout=5);db.execute('PRAGMA query_only=ON');db.create_function('carrot_unpack',1,archive_codec.unpack,deterministic=True)
 try:yield db
 finally:db.close()
a.connect=connect
with connect() as db:
 device=db.execute("SELECT device FROM events WHERE kind='state' ORDER BY observed DESC LIMIT 1").fetchone()[0]
 print(json.dumps({'db_bytes':path.stat().st_size,'rows_by_kind':db.execute('SELECT kind,count(*) FROM events WHERE device=? GROUP BY kind',(device,)).fetchall()}),flush=True)
a._derived_ready={device}
def measure(label,fn):
 t=time.perf_counter()
 try:result=fn()
 except Exception as e:
  print(json.dumps({'operation':label,'seconds':round(time.perf_counter()-t,3),'error':type(e).__name__+': '+str(e)}),flush=True);return []
 print(json.dumps({'operation':label,'seconds':round(time.perf_counter()-t,3),'rows':len(result)}),flush=True);return result
measure('battery_history_14_days',lambda:history(a,device,64,'Asia/Seoul'))
charges=measure('charge_history',lambda:a.charge_history(device,100,0))
measure('enrich_charges_soc',lambda:a.enrich_charges_soc(device,charges,64))
from datetime import datetime,timezone,timedelta
since=(datetime.now(timezone.utc)-timedelta(days=8)).isoformat()
trips=measure('trip_history_warm_derivations',lambda:a.history(device,'trip',100,0,since))
measure('enrich_trips_energy',lambda:(a.enrich_trips_energy(device,trips,64) or trips))
'''
if __name__=='__main__':
 encoded=base64.b64encode(REMOTE.encode()).decode()
 command="sudo python3 -u -c \"import base64;exec(base64.b64decode('"+encoded+"'))\""
 raise SystemExit(subprocess.call(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=8','-m','hmac-sha2-256-etm@openssh.com','-c','aes128-ctr','-i',sys.argv[1],sys.argv[2],command]))

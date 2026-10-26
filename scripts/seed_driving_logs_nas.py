"""Copy HA recordings to the owner's mounted NAS, without changing the live HA index.

Dry-run is the default. No recording data leaves HA/NAS; stdout contains counters only.
Run before the user's HA restart. Runtime settings are written only after successful copy.
"""
import argparse
import base64
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--host', required=True)
parser.add_argument('--key', required=True)
parser.add_argument('--nas', default='/share/CarrotJournalBackup/driving-logs')
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
sources = {name: (root / 'custom_components/carrot_ha/driving_logs' / (name + '.py')).read_text(encoding='utf-8')
           for name in ('store', 'tiered')}
remote = r'''
import hashlib,json,pathlib,sys,types,time
payload=json.load(sys.stdin)
package=types.ModuleType('nas_seed');package.__path__=[];sys.modules[package.__name__]=package
for name,source in payload['sources'].items():
 module=types.ModuleType('nas_seed.'+name);module.__package__='nas_seed'
 sys.modules[module.__name__]=module;exec(compile(source,name+'.py','exec'),module.__dict__)
from nas_seed.store import LogStore
from nas_seed.tiered import network_path,atomic_json,MARKER,TieredLogStore
nas=network_path(payload['nas'])
config=pathlib.Path('/config').resolve()
entries=json.loads((config/'.storage/core.config_entries').read_text())['data']['entries']
entries=[e for e in entries if e['domain']=='carrot_ha' and
         (config/'carrot_ha/driving-logs'/e['entry_id']/'index.json').is_file()]
if not entries: raise RuntimeError('No configured driving log archive')
print(json.dumps({'nas_mount':'verified','devices':len(entries),'apply':payload['apply']}),flush=True)
if not payload['apply']:sys.exit(0)
nas.mkdir(exist_ok=True)
marker=nas/'.carrot-driving-logs'
if not marker.exists():
 if any(nas.iterdir()):raise RuntimeError('NAS directory is not empty')
 atomic_json(marker,MARKER)
if marker.is_symlink() or json.loads(marker.read_text())!=MARKER:raise RuntimeError('Invalid NAS marker')
settings_path=config/'carrot_ha/driving-logs-settings.json'
settings=json.loads(settings_path.read_text()) if settings_path.exists() else {'devices':{}}
for entry in entries:
 device=entry['data']['device_id']
 directory=nas/hashlib.sha256(device.encode()).hexdigest()
 if directory.is_symlink():raise RuntimeError('Device directory is a symbolic link')
 identity=directory/'device.json'
 if identity.exists() and json.loads(identity.read_text()).get('device_id')!=device:raise RuntimeError('Device identity mismatch')
 target=LogStore(directory,limit=2**60,max_segments=None)
 atomic_json(identity,{'device_id':device,'version':1})
 # Read-only snapshot: never construct LogStore against the running HA directory.
 source=object.__new__(LogStore)
 source.root=config/'carrot_ha/driving-logs'/entry['entry_id']
 source.state=json.loads((source.root/'index.json').read_text())
 complete=[(n,i) for n,i in source.state['segments'].items() if i.get('complete')]
 count=0;size=0;started=time.monotonic()
 for name,item in complete:
  network_path(payload['nas'])
  TieredLogStore._copy(None,source,target,name)
  count+=1;size+=sum(item['files'].values())
  print(json.dumps({'verified_segments':count,'total_segments':len(complete),'verified_bytes':size,
                    'elapsed_seconds':round(time.monotonic()-started)}),flush=True)
 settings.setdefault('devices',{})[device]={'nas_path':payload['nas']}
 atomic_json(settings_path,settings)
print(json.dumps({'seed':'verified','settings':'saved','ha_index':'untouched','restart_required':True}),flush=True)
'''
encoded = base64.b64encode(remote.encode()).decode()
command = "sudo python3 -u -c \"import base64;exec(base64.b64decode('" + encoded + "'))\""
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
    '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=3',
    '-m', 'hmac-sha2-256-etm@openssh.com', '-c', 'aes128-ctr', '-i', args.key, args.host, command],
    input=json.dumps({'sources': sources, 'nas': args.nas, 'apply': args.apply}).encode(), timeout=7200)
raise SystemExit(result.returncode)

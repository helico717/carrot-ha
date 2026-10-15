"""Read only storage counters and installed limits; never export recording data."""
import argparse
import base64
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--host', required=True)
parser.add_argument('--key', required=True)
parser.add_argument('--core', action='store_true', help='Also validate the mount inside HA Core (read only)')
args = parser.parse_args()
code = '''
import ast,json
from pathlib import Path
source=Path('/config/custom_components/carrot_ha/driving_logs/store.py')
tree=ast.parse(source.read_text())
limits={n.targets[0].id:ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id=='LIMIT'}
print(json.dumps({'installed_source':limits}))
for index in Path('/config/carrot_ha/driving-logs').glob('*/index.json'):
 data=json.loads(index.read_text());items=data['segments'];complete=[v for v in items.values() if v.get('complete')]
 print(json.dumps({'segments':len(items),'complete':len(complete),'incomplete':len(items)-len(complete),'routes':len({n.rsplit('--',1)[0] for n in items}),'reserved_bytes':sum(sum(v['files'].values()) for v in items.values()),'disk_bytes':sum(p.stat().st_size for p in index.parent.rglob('*') if p.is_file()),'retention_floor':data.get('floor'),'retired_routes':len(data.get('retired_routes',[])),'earliest_recorded':min((v['recorded'] for v in complete),default=None),'latest_recorded':max((v['recorded'] for v in complete),default=None)}))
settings_path=Path('/config/carrot_ha/driving-logs-settings.json')
if settings_path.exists():
 import hashlib,importlib,sys,types
 package=types.ModuleType('archive_probe');package.__path__=[str(source.parent)];sys.modules[package.__name__]=package
 module=importlib.import_module('archive_probe.tiered')
 for device,setting in json.loads(settings_path.read_text())['devices'].items():
  root=module.network_path(setting['nas_path'])
  directory=root/hashlib.sha256(device.encode()).hexdigest()
  items=json.loads((directory/'index.json').read_text())['segments']
  print(json.dumps({'nas_mount':'verified','nas_segments':len(items),'nas_complete':sum(bool(i.get('complete')) for i in items.values()),'nas_bytes':sum(sum(i['files'].values()) for i in items.values()),'nas_routes':len({n.rsplit('--',1)[0] for n in items}),'nas_hashed_files':sum(len(i.get('hashes',{})) for i in items.values())}))
  entries=json.loads(Path('/config/.storage/core.config_entries').read_text())['data']['entries']
  for entry in entries:
   if entry['domain']!='carrot_ha' or entry['data'].get('device_id')!=device:continue
   index=Path('/config/carrot_ha/driving-logs')/entry['entry_id']/'index.json'
   local=json.loads(index.read_text())['segments']
   local={n:i for n,i in local.items() if i.get('complete')}
   matching=sum(bool(items.get(n,{}).get('complete')) and items[n]['files']==i['files'] and items[n]['recorded']==i['recorded'] and set(items[n].get('hashes',{}))==set(i['files']) for n,i in local.items())
   print(json.dumps({'ha_complete':len(local),'matching_nas_manifests':matching,'ha_segments_missing_or_mismatched_on_nas':len(local)-matching}))
'''
if args.core:
    core = '''
import importlib,json,sys,types
from pathlib import Path
package=types.ModuleType('archive_probe');package.__path__=['/config/custom_components/carrot_ha/driving_logs'];sys.modules[package.__name__]=package
module=importlib.import_module('archive_probe.tiered')
settings=json.loads(Path('/config/carrot_ha/driving-logs-settings.json').read_text())
for device,setting in settings['devices'].items():
 root=module.network_path(setting['nas_path'])
 directory=root/module.hashlib.sha256(device.encode()).hexdigest()
 state=json.loads((directory/'index.json').read_text())
 items=state['segments']
 print(json.dumps({'core_nas_mount':'verified','nas_segments':len(items),'nas_complete':sum(bool(i.get('complete')) for i in items.values()),'nas_bytes':sum(sum(i['files'].values()) for i in items.values()),'nas_routes':len({n.rsplit('--',1)[0] for n in items}),'ha_limit':module.LOCAL_LIMIT}))
'''
    code += '\nimport subprocess\nsubprocess.run(["docker","exec","homeassistant","python3","-c",' + repr(core) + '],check=True,timeout=45)\n'
encoded = base64.b64encode(code.encode()).decode()
remote = "sudo python3 -c \"import base64;exec(base64.b64decode('" + encoded + "'))\""
subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-m', 'hmac-sha2-256-etm@openssh.com',
                '-c', 'aes128-ctr', '-i', args.key, args.host, remote], check=True, timeout=60)

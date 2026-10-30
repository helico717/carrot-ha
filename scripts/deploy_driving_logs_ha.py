"""Deploy committed integration changes to HA with preflight, backups and hashes."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import base64

parser = argparse.ArgumentParser()
parser.add_argument('--host', required=True)
parser.add_argument('--key', required=True)
parser.add_argument('--base', required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]


def git(*arguments):
    return subprocess.check_output(['git', *arguments], cwd=root)


commit = git('rev-parse', 'HEAD').decode().strip()
names = git('diff', '--name-only', args.base, commit, '--', 'custom_components/carrot_ha').decode().splitlines()
files, metadata = {}, {}
for name in names:
    data = git('show', f'{commit}:{name}')
    before = subprocess.run(['git', 'show', f'{args.base}:{name}'], cwd=root, capture_output=True)
    files[name] = data
    metadata[name] = {'sha': hashlib.sha256(data).hexdigest(),
                      'before': hashlib.sha256(before.stdout).hexdigest() if before.returncode == 0 else None,
                      'before_lf': hashlib.sha256(before.stdout.replace(b'\r\n', b'\n')).hexdigest() if before.returncode == 0 else None}
payload = io.BytesIO()
with tarfile.open(fileobj=payload, mode='w:gz') as archive:
    entries = {'DEPLOYMENT.json': json.dumps({'commit': commit, 'apply': args.apply, 'files': metadata}).encode(), **files}
    for name, data in entries.items():
        info = tarfile.TarInfo(name); info.size = len(data)
        archive.addfile(info, io.BytesIO(data))

remote = r'''
import hashlib,io,json,os,pathlib,shutil,sys,tarfile
with tarfile.open(fileobj=io.BytesIO(sys.stdin.buffer.read()),mode='r:gz') as archive:
    metadata=json.load(archive.extractfile('DEPLOYMENT.json'))
    config=pathlib.Path('/config').resolve()
    prepared=[]; conflicts=[]; actual_before={}
    for name,item in metadata['files'].items():
        relative=pathlib.PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts or not name.startswith('custom_components/carrot_ha/'):
            raise RuntimeError('Invalid deployment path')
        path=(config/name).resolve()
        if not path.is_relative_to(config/'custom_components/carrot_ha'):
            raise RuntimeError('Deployment escaped integration directory')
        data=archive.extractfile(name).read()
        sha=hashlib.sha256(data).hexdigest()
        if sha!=item['sha']: raise RuntimeError('Payload hash mismatch')
        current=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
        current_lf=hashlib.sha256(path.read_bytes().replace(b'\r\n',b'\n')).hexdigest() if path.is_file() else None
        if current not in (item['before'],sha) and current_lf!=item['before_lf']: conflicts.append(name)
        actual_before[name]=current
        prepared.append((path,name,data,current==sha))
    if conflicts:
        print(json.dumps({'conflicts':conflicts}));sys.exit(2)
    if not metadata['apply']:
        print(json.dumps({'preflight':'ok','files':len(prepared),'commit':metadata['commit']}));sys.exit(0)
    backup=config/'carrot_ha/deployment-backups'/('driving-logs-hud-'+metadata['commit'][:12])/'before'
    backup.mkdir(parents=True,exist_ok=True)
    receipt=backup.parent/'DEPLOYMENT.json'
    if not receipt.exists():
        receipt.write_text(json.dumps({'commit':metadata['commit'],'before_sha256':actual_before,'targets':metadata['files']},indent=2))
    prepared.sort(key=lambda row: (row[0].is_file(),row[1].endswith('ha_replay_loader.js')))
    for path,name,data,identical in prepared:
        if identical: continue
        if path.exists():
            saved=backup/name;saved.parent.mkdir(parents=True,exist_ok=True)
            if not saved.exists(): shutil.copy2(path,saved)
        path.parent.mkdir(parents=True,exist_ok=True)
        temp=path.with_name(path.name+'.deploy-tmp')
        temp.write_bytes(data);temp.chmod(0o644);temp.replace(path)
    for path,name,data,identical in prepared:
        if hashlib.sha256(path.read_bytes()).hexdigest()!=metadata['files'][name]['sha']:
            raise RuntimeError('Installed hash mismatch: '+name)
    print(json.dumps({'installed':len(prepared),'sha256':'all matched','commit':metadata['commit'],'backup':str(backup)}))
'''
encoded = base64.b64encode(remote.encode()).decode()
command = "sudo python3 -c \"import base64;exec(base64.b64decode('" + encoded + "'))\""
result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=5',
                         '-o', 'ServerAliveCountMax=2', '-m', 'hmac-sha2-256-etm@openssh.com', '-c', 'aes128-ctr',
                         '-i', args.key, args.host, command], input=payload.getvalue(), stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE, timeout=120)
print(result.stdout.decode().strip())
if result.returncode:
    print(result.stderr.decode().strip())
    raise SystemExit(result.returncode)

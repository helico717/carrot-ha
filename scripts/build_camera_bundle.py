"""Build a credential-free comma camera bundle and a manual HA installation ZIP."""
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / '.preview' / 'camera-release'
    output.mkdir(parents=True, exist_ok=True)
    agent_path = output / 'carrot-camera-agent-0.7.0.zip'
    with zipfile.ZipFile(agent_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((ROOT / 'camera_agent').iterdir()):
            if path.suffix in ('.py', '.sh'):
                archive.writestr('carrot-camera/' + path.name, path.read_bytes().replace(b'\r\n', b'\n'))
        archive.write(ROOT / 'custom_components/carrot_ha/camera_session.py', 'carrot-camera/camera_session.py')
        archive.write(ROOT / 'scripts/camera_smoke_test.py', 'carrot-camera/camera_smoke_test.py')
    integration_path = output / 'carrot_ha-0.7.0.zip'
    with zipfile.ZipFile(integration_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((ROOT / 'custom_components/carrot_ha').rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix not in ('.pyc', '.pyo'):
                archive.write(path, str(path.relative_to(ROOT)).replace('\\', '/'))
    for path in (agent_path, integration_path):
        print(str(path))
        print('sha256: ' + hashlib.sha256(path.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()

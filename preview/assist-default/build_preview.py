from pathlib import Path
import shutil

# The approved UI now lives in production; preview the same complete module tree.
root = Path(__file__).resolve().parents[2]
out = Path('/private/tmp/carrot-assist-default-preview')
shutil.copytree(root / 'custom_components/carrot_ha/frontend', out / 'frontend', dirs_exist_ok=True)
shutil.copy2(Path(__file__).with_name('index.html'), out / 'index.html')
print(out)

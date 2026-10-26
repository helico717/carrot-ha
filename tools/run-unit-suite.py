"""Run component unit tests without executing Home Assistant integration startup."""
import argparse
from pathlib import Path
import sys
import types
import unittest

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
for name, directory in (('custom_components', root / 'custom_components'),
                        ('custom_components.carrot_ha', root / 'custom_components/carrot_ha')):
    package = types.ModuleType(name)
    package.__path__ = [str(directory)]
    sys.modules[name] = package

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory', default='tests')
parser.add_argument('--pattern', default='test_*.py')
args = parser.parse_args()
suite = unittest.defaultTestLoader.discover(args.directory, pattern=args.pattern)
result = unittest.TextTestRunner(verbosity=1).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)

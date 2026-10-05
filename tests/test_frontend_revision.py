import ast
import json
from pathlib import Path
import tempfile
import unittest

class FrontendRevisionTests(unittest.TestCase):
    def test_same_release_changed_dependency_changes_cache_key(self):
        source=Path('custom_components/carrot_ha/__init__.py').read_text()
        function=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='_read_frontend_version')
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'frontend').mkdir();(root/'manifest.json').write_text('{"version":"0.8.12-beta.9"}')
            asset=root/'frontend/helper.js';asset.write_text('export const value=1;')
            namespace={'__file__':str(root/'__init__.py'),'json':json}
            exec(compile(ast.Module(body=[function],type_ignores=[]),'revision','exec'),namespace)
            read=namespace['_read_frontend_version'];before=read()
            self.assertEqual(read(),before)
            asset.write_text('export const value=2;');after=read()
            self.assertNotEqual(after,before)
            self.assertTrue(before.startswith('0.8.12-beta.9-'))
            self.assertTrue(after.startswith('0.8.12-beta.9-'))

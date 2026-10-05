import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
test('installed backend cache key passes actual bootstrap and loads runtime',async()=>{
 const python=process.env.CARROT_TEST_PYTHON||'python3';
 const version=execFileSync(python,['-c',`import ast,json
from pathlib import Path
p=Path('custom_components/carrot_ha/__init__.py')
f=next(n for n in ast.parse(p.read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='_read_frontend_version')
ns={'__file__':str(p.resolve()),'json':json}
exec(compile(ast.Module(body=[f],type_ignores=[]),'version','exec'),ns)
print(ns['_read_frontend_version']())`],{encoding:'utf8'}).trim();
 const source=fs.readFileSync('custom_components/carrot_ha/frontend/carrot-dashboard.js','utf8').replaceAll('import.meta.url',JSON.stringify('http://localhost/carrot_ha_static/carrot-dashboard.js')).replace(/await import\(([^;]+)\);?/,'await load($1);');
 const loaded=[];const context={URL,fetch:async()=>({ok:true,json:async()=>({version})}),load:async url=>{loaded.push(String(url));}};
 await vm.runInNewContext(`(async()=>{${source}})()`,context);
 assert.equal(loaded.length,1);assert.equal(new URL(loaded[0]).searchParams.get('v'),version);
});

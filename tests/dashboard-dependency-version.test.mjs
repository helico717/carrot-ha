import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const language of ['ko','en','debug']) {
  test(`${language}: every dependency bypasses stale unversioned modules`,()=>{
    const source=readFileSync(`custom_components/carrot_ha/frontend/carrot-dashboard-${language}.js`,'utf8');
    const prefix=source.slice(0,source.indexOf('const {'));
    const context={URL};vm.createContext(context);
    vm.runInContext(prefix.replaceAll('import.meta.url',JSON.stringify(`https://ha.test/carrot_ha_static/carrot-dashboard-${language}.js?v=0.8.12-beta.4`))+'\nthis.resolve=dependencyURL;',context);
    const dependencies=[...source.matchAll(/await import\(dependencyURL\('([^']+)'\)\)/g)].map(m=>m[1]);
    assert.equal(dependencies.length,4);
    assert.doesNotMatch(source,/\bfrom\s+['"]\.\//);
    const staleCache=new Map([['https://ha.test/carrot_ha_static/carrot-trip-days.js',{old:true}]]);
    for(const name of dependencies){
      const url=context.resolve(name);
      assert.equal(new URL(url).searchParams.get('v'),'0.8.12-beta.4');
      assert.equal(staleCache.has(url),false);
      assert.equal(new URL(url).origin,'https://ha.test');
    }
  });
}

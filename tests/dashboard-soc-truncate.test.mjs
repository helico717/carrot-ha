import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const files = ['carrot-dashboard-ko.js', 'carrot-dashboard-en.js']
  .map(name => [name, readFileSync(path.resolve('custom_components/carrot_ha/frontend', name), 'utf8')]);
const journal = readFileSync(path.resolve('custom_components/carrot_ha/frontend/carrot-vehicle-journal.js'), 'utf8');

for (const [name, code] of files) {
  test(`${name}: integer SOC display truncates instead of rounding`, () => {
    const line = code.split('\n').find(l => l.startsWith('const socDisplay = '));
    assert.ok(line, 'socDisplay helper exists');
    const socDisplay = new Function(`${line}; return socDisplay;`)();
    for (const [raw, shown] of [[58.5, 58], [58, 58], [99.5, 99], [100, 100], [0.5, 0], [79.99999999, 80], [120, 100], [-1, 0], [null, null], [NaN, null]])
      assert.equal(socDisplay(raw), shown, String(raw));
    // No SOC value shown to users is rounded half-up any more (icon 10% bucket excluded).
    assert.equal((code.match(/Math\.round\([^)]*[sS]oc[^)]*\)/g) || []).length, 0);
    assert.ok(!code.includes('n(v.soc_percent,0)') && !code.includes('n(soc, 0)'));
    assert.ok(code.includes('n(socDisplay(v.soc_percent),0)') && code.includes('n(socDisplay(soc), 0)'));
    assert.ok(code.includes('socDisplay(soc) < 80') && code.includes('socDisplay(soc)<80'));
    // Charged %p stays consistent with the truncated endpoints shown beside it.
    assert.ok(code.includes('const chargedSoc=(startSoc!=null&&endSoc!=null)?Math.max(0,endSoc-startSoc)'));
  });
}

test('vehicle journal current SOC stat truncates', () => {
  assert.ok(journal.includes("numeric(Number.isFinite(latest.soc_percent)?Math.floor(Math.max(0,Math.min(100,latest.soc_percent))+1e-6):null,0)"));
});

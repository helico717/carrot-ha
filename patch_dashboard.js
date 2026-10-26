const fs = require('fs');
const path = '/Users/davidlim/Developer/carrot-ha/custom_components/carrot_ha/frontend/carrot-dashboard-ko.js';
let content = fs.readFileSync(path, 'utf8');

const oldPart = "metric('급속 분류',n(v.month_fast_kwh),'kWh','flash')";
const newPart = "metric('이번 달 충전금액',n(v.month_charge_cost,0),'원','cash','추정치')," + oldPart;
// This is a bit risky if the text is repeated. Let's be more specific.

// Let's find the line that starts with if(this.tab==='charge')
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("if(this.tab==='charge')")) {
    lines[i] = lines[i].replace(
      "metric('급속 분류',n(v.month_fast_kwh),'kWh','flash')",
      "metric('이번 달 충전금액',n(v.month_charge_cost,0),'원','cash','추정치'),metric('급속 분류',n(v.month_fast_kwh),'kWh','flash')"
    );
    // Wait, the metric call in the tiles div is concatenated using ${}
    // Let's try again with the correct template literal syntax.
  }
}

// Account-specific bindings stay in ignored wrangler.json; policy stays in Git.
import {readFileSync,writeFileSync} from 'node:fs';
const configURL=new URL('./wrangler.json',import.meta.url);
const config=JSON.parse(readFileSync(configURL,'utf8'));
const policy=JSON.parse(readFileSync(new URL('./storage-policy.json',import.meta.url),'utf8'));
config.vars={...config.vars,...policy.vars};
config.triggers={...config.triggers,crons:[...new Set([...(config.triggers?.crons||[]),...policy.triggers.crons])]};
writeFileSync(configURL,JSON.stringify(config,null,2)+'\n');
console.log('Applied versioned archive policy; account bindings preserved');

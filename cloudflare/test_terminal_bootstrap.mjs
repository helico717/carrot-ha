import assert from 'node:assert/strict';
import worker from './src/worker.js';
const records = new Map();
const env = {DB: {}, WAYON_UPLOAD_TOKEN: 'upload', WAYON_VIEW_TOKEN: 'view', SNAPSHOTS: {
  async get(key) { return records.has(key) ? JSON.parse(records.get(key)) : null; },
  async put(key, value) { records.set(key, value); },
  async delete(key) { records.delete(key); },
}};
const call = (token, body, device = 'comma') => worker.fetch(new Request(
  'https://worker.example/api/terminal/bootstrap?device_id=' + device,
  {method: body ? 'POST' : 'GET', headers: {Authorization: 'Bearer ' + token}, body: body && JSON.stringify(body)},
), env);
const config = {ha_url: 'https://ha.example', terminal_token: 't'.repeat(64)};
assert.equal((await call('view', config)).status, 401);
assert.equal((await call('view')).status, 401);
assert.equal((await call('upload', config)).status, 200);
assert.equal((await (await call('upload')).json()).config.ha_url, config.ha_url);
assert.equal((await (await call('upload', null, 'other')).json()).config, null);
assert.equal((await call('upload', {...config, ha_url: 'http://ha.example'})).status, 400);
await call('upload', {enabled: false});
assert.equal((await (await call('upload')).json()).config, null);
console.log('terminal bootstrap authentication, discovery and revocation passed');

import assert from 'node:assert/strict';
import worker from './src/worker.js';
const records = new Map();
const env = {WAYON_UPLOAD_TOKEN: 'upload', WAYON_VIEW_TOKEN: 'view', SNAPSHOTS: {
  async get() { throw Error('bootstrap must not read KV'); },
  async put() { throw Error('bootstrap must not write KV'); },
  async delete() { throw Error('bootstrap must not delete KV'); },
}, DB: {
  prepare(sql) {
    return {bind(...args) {
      return {
        async first() {
          const row = records.get(args[0]);
          return row && row.expires_at > args[1] ? {...row} : null;
        },
        async run() {
          if (sql.startsWith('DELETE')) records.delete(args[0]);
          else records.set(args[0], {ha_url: args[1], terminal_token: args[2], expires_at: args[3]});
        },
      };
    }};
  },
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
records.get('comma').expires_at = Date.now() - 1;
assert.equal((await (await call('upload')).json()).config, null);
await call('upload', {...config, terminal_token: 'r'.repeat(64)});
assert.equal(records.size, 1);
assert.equal((await (await call('upload')).json()).config.terminal_token, 'r'.repeat(64));
await call('upload', {enabled: false});
assert.equal((await (await call('upload')).json()).config, null);
console.log('terminal bootstrap authentication, discovery and revocation passed');

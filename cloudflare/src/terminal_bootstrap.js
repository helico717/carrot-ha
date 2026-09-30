// Discovery only: terminal traffic goes directly from Comma to Home Assistant.
export async function terminalBootstrap(request, env, authorized) {
  const reply = (body, status = 200) => Response.json(body, {
    status, headers: {'Cache-Control': 'no-store'},
  });
  // Never accept the telemetry VIEW credential for shell provisioning.
  if (!env.WAYON_UPLOAD_TOKEN || !authorized) return reply({error: 'unauthorized'}, 401);
  const device = new URL(request.url).searchParams.get('device_id');
  if (!device || device.length > 128 || /[\x00-\x1f/]/.test(device)) return reply({error: 'invalid_device'}, 400);
  if (request.method === 'GET') {
    const config = await env.DB.prepare(
      'SELECT ha_url, terminal_token, expires_at FROM terminal_bootstrap WHERE device_id = ? AND expires_at > ?'
    ).bind(device, Date.now()).first();
    return reply({protocol: 1, config: config && config.expires_at > Date.now() ? config : null});
  }
  if (request.method !== 'POST') return reply({error: 'method_not_allowed'}, 405);
  const raw = await request.text();
  if (raw.length > 4096) return reply({error: 'too_large'}, 413);
  let config;
  try {
    config = JSON.parse(raw);
    if (config.enabled === false) {
      await env.DB.prepare('DELETE FROM terminal_bootstrap WHERE device_id = ?').bind(device).run();
      return reply({ok: true});
    }
    const url = new URL(config.ha_url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error();
    if (typeof config.terminal_token !== 'string' || !/^[\x21-\x7e]{32,256}$/.test(config.terminal_token)) throw Error();
    if ([env.WAYON_UPLOAD_TOKEN, env.WAYON_VIEW_TOKEN].includes(config.terminal_token)) throw Error();
    config = {ha_url: url.origin, terminal_token: config.terminal_token, expires_at: Date.now() + 180000};
  } catch {
    return reply({error: 'invalid_config'}, 400);
  }
  await env.DB.prepare(`
    INSERT INTO terminal_bootstrap (device_id, ha_url, terminal_token, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      ha_url = excluded.ha_url, terminal_token = excluded.terminal_token,
      expires_at = excluded.expires_at
  `).bind(device, config.ha_url, config.terminal_token, config.expires_at).run();
  return reply({ok: true});
}

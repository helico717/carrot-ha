// Lossless cloud history only. Latest state stays on its independent plain path.
export const MAX_RAW = 262144;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const MARKER = '_carrot_cloud_archive_v1';

async function transform(bytes, decompress = false) {
  const stream = new Blob([bytes]).stream().pipeThrough(
    decompress ? new DecompressionStream('gzip') : new CompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length;
      if (size > MAX_RAW) throw new Error('Archive size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
function base64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
function unbase64(value) {
  if (typeof value !== 'string' || value.length > MAX_RAW * 2) throw new Error('Invalid archive encoding');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export async function compressed(value) {
  const raw = encoder.encode(JSON.stringify(value));
  if (raw.length > MAX_RAW) throw new Error('Archive size limit');
  return JSON.stringify({[MARKER]: 1, codec: 'gzip', data: base64(await transform(raw))});
}
export async function decoded(raw) {
  const value = JSON.parse(raw);
  if (value[MARKER] !== 1) return value;
  if (value.codec !== 'gzip') throw new Error('Unsupported archive codec');
  return JSON.parse(decoder.decode(await transform(unbase64(value.data), true)));
}
export async function packTelemetry(payload) {
  const raw = JSON.stringify(payload);
  if (encoder.encode(raw).length > MAX_RAW) throw new Error('Archive size limit');
  if (raw.length < 1024) return {raw, hash: null, context: null};
  // Preserve the position and every value of the original fields. A reference
  // is resolved against this recording's immutable context, never current state.
  const compact = structuredClone(payload), context = {};
  for (const key of ['charge_sessions', 'charge_months']) {
    if (Object.hasOwn(compact.vehicle || {}, key)) context[key] = compact.vehicle[key];
  }
  let hash = null, contextRaw = null;
  if (JSON.stringify(context).length >= 512) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(context)));
    hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    contextRaw = await compressed(context);
    for (const key of Object.keys(context)) compact.vehicle[key] = {_carrot_context_field: key};
  }
  const packed = await compressed(compact);
  // Context references are useful across rows, but don't make small payloads larger.
  if (packed.length + (contextRaw?.length || 0) + 64 >= raw.length) return {raw, hash: null, context: null};
  return {raw: packed, hash, context: contextRaw};
}
export async function unpackTelemetry(raw, contextRaw = null) {
  if (JSON.parse(raw)[MARKER] !== 1) return raw;
  const payload = await decoded(raw);
  if (contextRaw) {
    const context = typeof contextRaw === 'string' ? await decoded(contextRaw) : contextRaw;
    for (const key of ['charge_sessions', 'charge_months']) {
      if (payload.vehicle?.[key]?._carrot_context_field === key) {
        if (!Object.hasOwn(context, key)) throw new Error('Missing archive context');
        payload.vehicle[key] = context[key];
      }
    }
  }
  for (const key of ['charge_sessions', 'charge_months']) {
    if (payload.vehicle?.[key]?._carrot_context_field === key) throw new Error('Missing archive context');
  }
  return JSON.stringify(payload);
}

export async function acknowledgeArchive(request, env) {
  const body = await request.json();
  if (typeof body.device_id !== 'string' || !body.device_id || body.device_id.length > 200 ||
      !['telemetry_sequence', 'trip_sequence'].every(k => Number.isSafeInteger(body[k]) && body[k] >= 0)) {
    return Response.json({error: 'invalid_archive_ack'}, {status: 400});
  }
  const max = await env.DB.prepare(`SELECT
    COALESCE((SELECT MAX(sequence) FROM telemetry_history WHERE device_id=?),0) AS telemetry,
    COALESCE((SELECT MAX(sequence) FROM trip_sync_revision WHERE device_id=?),0) AS trip,
    COALESCE((SELECT telemetry_sequence FROM archive_consumers WHERE device_id=?),0) AS prior_telemetry,
    COALESCE((SELECT trip_sequence FROM archive_consumers WHERE device_id=?),0) AS prior_trip`)
    .bind(body.device_id, body.device_id, body.device_id, body.device_id).first();
  if (body.telemetry_sequence > Math.max(max.telemetry, max.prior_telemetry) ||
      body.trip_sequence > Math.max(max.trip, max.prior_trip)) return Response.json({error: 'invalid_archive_ack'}, {status: 409});
  await env.DB.prepare(`INSERT INTO archive_consumers VALUES(?,?,?,?)
    ON CONFLICT(device_id) DO UPDATE SET
    telemetry_sequence=MAX(telemetry_sequence,excluded.telemetry_sequence),
    trip_sequence=MAX(trip_sequence,excluded.trip_sequence),updated_at=excluded.updated_at
    WHERE excluded.telemetry_sequence>telemetry_sequence OR excluded.trip_sequence>trip_sequence`)
    .bind(body.device_id, body.telemetry_sequence, body.trip_sequence, new Date().toISOString()).run();
  return Response.json({ok: true});
}

export async function maintainArchive(env, now = Date.now()) {
  const cutoff = new Date(now - 14 * 86400000).toISOString();
  const tripCutoff = new Date(now - 90 * 86400000).toISOString();
  // Only a durably acknowledged consumer permits expiration. Bound each run.
  const telemetry = await env.DB.prepare(`DELETE FROM telemetry_history WHERE sequence IN (
    SELECT h.sequence FROM telemetry_history h JOIN archive_consumers a ON a.device_id=h.device_id
    WHERE h.updated_at<? AND h.sequence<=a.telemetry_sequence ORDER BY h.updated_at LIMIT 200)`)
    .bind(cutoff).run();
  const trips = await env.DB.prepare(`DELETE FROM trips WHERE id IN (
    SELECT t.id FROM trips t JOIN trip_sync_revision r ON r.trip_id=t.id
    JOIN archive_consumers a ON a.device_id=t.device_id
    WHERE t.ended_at<? AND r.sequence<=a.trip_sequence ORDER BY t.ended_at LIMIT 100)`)
    .bind(tripCutoff).run();
  await env.DB.prepare(`DELETE FROM telemetry_contexts WHERE rowid IN (
    SELECT c.rowid FROM telemetry_contexts c WHERE NOT EXISTS (
      SELECT 1 FROM telemetry_history h WHERE h.device_id=c.device_id AND h.context_hash=c.hash) LIMIT 100)` ).run();
  const budget = await env.DB.prepare('SELECT resource,bytes,max_bytes FROM archive_budget').all();
  const result = {purged_telemetry: telemetry.meta?.changes ?? telemetry.changes ?? 0,
    purged_trips: trips.meta?.changes ?? trips.changes ?? 0, budget: budget.results || [],
    database_bytes: budget.meta?.size_after ?? null};
  if (result.budget.some(b => b.bytes > b.max_bytes * 0.8)) console.warn('Archive storage pressure', JSON.stringify(result.budget));
  if (result.database_bytes >= 350000000) console.warn('D1 total storage pressure', result.database_bytes);
  return result;
}

// Preview-only static server: repo root, plus HA's /carrot_ha_static mount for card iframes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STATIC = path.join(ROOT, 'custom_components/carrot_ha/frontend');
const PORT = Number(process.env.PORT || 8768);
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm'};

http.createServer((request, response) => {
  let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname === '/') pathname = '/preview/iq-pause/index.html';
  const base = pathname.startsWith('/carrot_ha_static/') ? STATIC : ROOT;
  const relative = pathname.startsWith('/carrot_ha_static/') ? pathname.slice('/carrot_ha_static/'.length) : pathname.slice(1);
  const file = path.join(base, relative);
  if (!file.startsWith(base)) { response.writeHead(403); response.end(); return; }
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) { response.writeHead(404); response.end('not found'); return; }
    response.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    fs.createReadStream(file).pipe(response);
  });
}).listen(PORT, () => console.log(`IQ.drive pause preview: http://localhost:${PORT}/`));

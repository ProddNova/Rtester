/*
 * Server di CacciAuto: serve il sito (cartella public/) e l'API /api/search.
 * Nessuna dipendenza: solo Node (>= 18).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { search } = require('./search');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon'
};

// Limite semplice: max 40 ricerche ogni 5 minuti per IP (protegge i siti e il server).
const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 5 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length <= 40;
}

function send(res, status, body, type, extra) {
  res.writeHead(status, Object.assign({
    'Content-Type': type || 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }, extra || {}));
  res.end(body);
}

async function api(req, res, url) {
  if (url.pathname === '/api/health') return send(res, 200, '{"ok":true}');
  if (url.pathname !== '/api/search') return send(res, 404, '{"error":"not found"}');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!allowed(ip)) return send(res, 429, JSON.stringify({ error: 'Troppe ricerche, aspetta un paio di minuti' }));
  let s;
  try { s = JSON.parse(url.searchParams.get('s') || '{}'); } catch (e) { return send(res, 400, '{"error":"ricerca non valida"}'); }
  try {
    const out = await search(s, url.searchParams.get('page'));
    send(res, 200, JSON.stringify(out), null, { 'Cache-Control': 'no-store' });
  } catch (e) {
    console.error('search error', e);
    send(res, 500, '{"error":"errore interno"}');
  }
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'no', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Non trovato', 'text/plain; charset=utf-8');
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '{"error":"metodo non permesso"}');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  serveStatic(req, res, url);
});

if (require.main === module) {
  server.listen(PORT, () => console.log('CacciAuto su http://localhost:' + PORT));
}

module.exports = server;

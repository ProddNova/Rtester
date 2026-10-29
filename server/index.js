/*
 * Server di CacciAuto: serve il sito (public/) e le API.
 *   GET  /api/search?s={filtri}&page=N   annunci da tutti i siti
 *   GET  /api/ad?url=...                  dettaglio di un annuncio
 *   GET  /api/saved                       salvati (condivisi tra tutti)
 *   POST /api/saved                       {action: add|remove|note, ...}
 *   GET  /api/searches                    ricerche salvate (condivise)
 *   POST /api/searches                    {action: add|remove, ...}
 * Nessuna dipendenza: solo Node (>= 18).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { search } = require('./search');
const { getAd } = require('./detail');
const store = require('./store');
const DEDUP = require('../public/js/dedup.js');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon'
};
const MAX_SAVED = 1000;
const MAX_SEARCHES = 100;

// Limiti semplici per IP, per proteggere i siti letti e il server.
const hits = new Map();
function allowed(bucket, ip, max) {
  const key = bucket + ':' + ip;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 5 * 60 * 1000);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10000) hits.clear();
  return list.length <= max;
}

function send(res, status, body, type, extra) {
  res.writeHead(status, Object.assign({
    'Content-Type': type || 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }, extra || {}));
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), null, { 'Cache-Control': 'no-store' });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 32 * 1024) { reject(new Error('troppo grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(new Error('JSON non valido')); }
    });
    req.on('error', reject);
  });
}

// ---------- pulizia dei dati in arrivo (i salvati li vedono tutti)
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 1e9 ? n : null; };
const httpUrl = (v) => { try { const u = new URL(String(v)); return /^https?:$/.test(u.protocol) && String(v).length <= 800 ? u.toString() : ''; } catch (e) { return ''; } };
const httpsUrl = (v) => { const u = httpUrl(v); return u.startsWith('https://') ? u : ''; };

function cleanItem(raw) {
  const url = httpUrl(raw && raw.url);
  if (!url) return null;
  return {
    key: DEDUP.listingKey(url),
    url,
    site: DEDUP.detectSite(url).id,
    title: str(raw.title, 200) || DEDUP.titleFromUrl(url) || DEDUP.detectSite(url).name,
    version: str(raw.version, 200),
    price: int(raw.price), km: int(raw.km), year: int(raw.year), cv: int(raw.cv),
    fuel: str(raw.fuel, 20), city: str(raw.city, 120),
    image: httpsUrl(raw.image),
    alts: (Array.isArray(raw.alts) ? raw.alts : []).map(httpUrl).filter(Boolean).slice(0, 6),
    note: str(raw.note, 500),
    savedAt: Date.now(),
    history: int(raw.price) ? [{ p: int(raw.price), t: Date.now() }] : [],
    removed: false
  };
}

async function savedApi(req, res) {
  if (req.method === 'GET') return json(res, 200, { items: await store.get('saved'), persistent: store.persistent, mode: store.mode });
  const body = await readBody(req);
  const list = await store.update('saved', (items) => {
    if (body.action === 'add') {
      const it = cleanItem(body.item);
      if (!it) throw Object.assign(new Error('link non valido'), { status: 400 });
      if (items.some((x) => x.key === it.key)) return items;
      return [it].concat(items).slice(0, MAX_SAVED);
    }
    if (body.action === 'remove') return items.filter((x) => x.key !== body.key);
    if (body.action === 'note') {
      const it = items.find((x) => x.key === body.key);
      if (it) it.note = str(body.note, 500);
      return items;
    }
    throw Object.assign(new Error('azione sconosciuta'), { status: 400 });
  });
  json(res, 200, { items: list, persistent: store.persistent, mode: store.mode });
}

async function searchesApi(req, res) {
  if (req.method === 'GET') return json(res, 200, { items: await store.get('searches') });
  const body = await readBody(req);
  const list = await store.update('searches', (items) => {
    if (body.action === 'add') {
      const s = body.search && typeof body.search === 'object' ? body.search : null;
      if (!s) throw Object.assign(new Error('ricerca non valida'), { status: 400 });
      const clean = {};
      Object.keys(s).slice(0, 30).forEach((k) => { if (/^[a-z]{2,8}$/.test(k)) clean[k] = typeof s[k] === 'boolean' ? s[k] : str(String(s[k]), 60); });
      const name = str(body.name, 80) || 'Ricerca';
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      return [{ id, name, search: clean, savedAt: Date.now() }].concat(items.filter((x) => x.name !== name)).slice(0, MAX_SEARCHES);
    }
    if (body.action === 'remove') return items.filter((x) => x.id !== body.id);
    throw Object.assign(new Error('azione sconosciuta'), { status: 400 });
  });
  json(res, 200, { items: list });
}

// Quando qualcuno apre un annuncio salvato, aggiorniamo prezzo (con storico) e stato.
async function refreshSaved(key, ad, removed) {
  const items = await store.get('saved');
  const it = items.find((x) => x.key === key);
  if (!it) return;
  const price = ad && ad.price;
  const changed = (price && price !== it.price) || (!!removed !== !!it.removed) || (ad && !it.image && ad.photos && ad.photos[0]);
  if (!changed) return;
  await store.update('saved', (list) => {
    const x = list.find((y) => y.key === key);
    if (!x) return list;
    if (price && price !== x.price) {
      x.history = (x.history || []).concat([{ p: price, t: Date.now() }]).slice(-20);
      x.price = price;
    }
    x.removed = !!removed;
    if (ad && !x.image && ad.photos && ad.photos[0]) x.image = ad.photos[0];
    return list;
  });
}

async function api(req, res, url) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const p = url.pathname;
  if (p === '/api/health') return json(res, 200, { ok: true, store: store.mode, persistent: store.persistent });

  if (p === '/api/search') {
    if (!allowed('search', ip, 60)) return json(res, 429, { error: 'Troppe ricerche, aspetta un paio di minuti' });
    let s;
    try { s = JSON.parse(url.searchParams.get('s') || '{}'); } catch (e) { return json(res, 400, { error: 'ricerca non valida' }); }
    return json(res, 200, await search(s, url.searchParams.get('page')));
  }

  if (p === '/api/ad') {
    if (!allowed('ad', ip, 120)) return json(res, 429, { error: 'Troppe richieste, aspetta un attimo' });
    const r = await getAd(url.searchParams.get('url') || '');
    if (r.error) return json(res, r.status || 500, r);
    if (!r.external) refreshSaved(DEDUP.listingKey(url.searchParams.get('url')), r.ad, r.removed).catch((e) => console.error('refresh', e.message));
    return json(res, 200, r);
  }

  if (p === '/api/saved' || p === '/api/searches') {
    if (req.method === 'POST' && !allowed('write', ip, 120)) return json(res, 429, { error: 'Troppe modifiche, aspetta un attimo' });
    // Solo JSON: un altro sito non può scrivere qui al posto vostro (il browser lo blocca senza CORS)
    if (req.method === 'POST' && !/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'serve JSON' });
    return p === '/api/saved' ? savedApi(req, res) : searchesApi(req, res);
  }
  json(res, 404, { error: 'non trovato' });
}

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'no', 'text/plain'); }
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
  const isApi = url.pathname.startsWith('/api/');
  const okMethod = req.method === 'GET' || req.method === 'HEAD' || (isApi && req.method === 'POST');
  if (!okMethod) return send(res, 405, '{"error":"metodo non permesso"}');
  if (!isApi) return serveStatic(req, res, url);
  api(req, res, url).catch((e) => {
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'errore interno' });
    if (!e.status) console.error('api error', e);
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log('CacciAuto in ascolto sulla porta ' + PORT + ' (archivio: ' + store.mode + ')'));
}

module.exports = server;

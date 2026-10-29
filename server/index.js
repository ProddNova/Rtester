/*
 * Server di CacciAuto: serve il sito (public/) e le API.
 *   GET  /api/search?s={filtri}&page=N   annunci da tutti i siti
 *   GET  /api/feed?page=N                 annunci da scorrere in home (affari e auto da appassionati)
 *   GET  /api/ad?url=...                  dettaglio di un annuncio
 *   POST /api/translate {text, from}      traduzione in italiano
 *   GET  /api/saved · POST /api/saved     salvati condivisi {action: add|remove|note|restore}
 *   GET  /api/searches · POST             ricerche salvate condivise {action: add|remove|restore}
 * Nessuna dipendenza: solo Node (>= 18).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { search } = require('./search');
const { feed } = require('./feed');
const { getAd } = require('./detail');
const { translate } = require('./translate');
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

// Risposta compressa (gzip) quando il browser la accetta: su rete mobile fa la differenza.
function send(req, res, status, body, type, extra) {
  const headers = Object.assign({
    'Content-Type': type || 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    Vary: 'Accept-Encoding'
  }, extra || {});
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const zip = buf.length > 1024 && /gzip/.test(req.headers['accept-encoding'] || '') && /text|json|javascript|svg|manifest/.test(headers['Content-Type']);
  if (zip) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(status, headers);
    return res.end(zlib.gzipSync(buf));
  }
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
const json = (req, res, status, obj) => send(req, res, status, JSON.stringify(obj), null, { 'Cache-Control': 'no-store' });
const httpError = (status, msg) => Object.assign(new Error(msg), { status });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 600 * 1024) { reject(httpError(413, 'troppo grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(httpError(400, 'JSON non valido')); }
    });
    req.on('error', reject);
  });
}

// ---------- pulizia dei dati in arrivo (i salvati li vedono tutti)
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 1e13 ? n : null; };
const httpUrl = (v) => { try { const u = new URL(String(v)); return /^https?:$/.test(u.protocol) && String(v).length <= 800 ? u.toString() : ''; } catch (e) { return ''; } };
const httpsUrl = (v) => { const u = httpUrl(v); return u.startsWith('https://') ? u : ''; };
const past = (v) => { const t = int(v); return t && t <= Date.now() + 60000 ? t : null; };

function cleanItem(raw, keepStamps) {
  const url = httpUrl(raw && raw.url);
  if (!url) return null;
  const price = int(raw.price);
  const history = keepStamps && Array.isArray(raw.history)
    ? raw.history.map((h) => ({ p: int(h && h.p), t: past(h && h.t) })).filter((h) => h.p && h.t).slice(-20)
    : (price ? [{ p: price, t: Date.now() }] : []);
  return {
    key: DEDUP.listingKey(url),
    url,
    site: DEDUP.detectSite(url).id,
    title: str(raw.title, 200) || DEDUP.titleFromUrl(url) || DEDUP.detectSite(url).name,
    version: str(raw.version, 200),
    price, km: int(raw.km), year: int(raw.year), cv: int(raw.cv),
    fuel: str(raw.fuel, 20), city: str(raw.city, 120),
    image: httpsUrl(raw.image),
    alts: (Array.isArray(raw.alts) ? raw.alts : []).map(httpUrl).filter(Boolean).slice(0, 6),
    note: str(raw.note, 500),
    savedAt: (keepStamps && past(raw.savedAt)) || Date.now(),
    history,
    removed: keepStamps ? !!raw.removed : false
  };
}

function cleanSearch(raw, keepStamps) {
  const s = raw && raw.search && typeof raw.search === 'object' ? raw.search : null;
  if (!s) return null;
  const clean = {};
  Object.keys(s).slice(0, 30).forEach((k) => { if (/^[a-z]{2,8}$/.test(k)) clean[k] = typeof s[k] === 'boolean' ? s[k] : str(String(s[k]), 60); });
  return {
    id: (keepStamps && /^[a-z0-9]{4,20}$/.test(raw.id || '') && raw.id) || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: str(raw.name, 80) || 'Ricerca',
    search: clean,
    savedAt: (keepStamps && past(raw.savedAt)) || Date.now()
  };
}

const out = (data) => ({ items: data.items, tomb: data.tomb, bootId: store.bootId });

async function savedApi(req, res) {
  if (req.method === 'GET') return json(req, res, 200, out(await store.get('saved')));
  const body = await readBody(req);
  let data;
  if (body.action === 'restore') {
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_SAVED).map((x) => cleanItem(x, true)).filter(Boolean);
    const tomb = {};
    Object.keys(body.tomb || {}).slice(0, 3000).forEach((k) => { const t = past(body.tomb[k]); if (t && k.length < 300) tomb[k] = t; });
    data = await store.restore('saved', items, tomb, (x) => x.key, (x) => x.savedAt);
  } else {
    data = await store.update('saved', (items, tomb) => {
      if (body.action === 'add') {
        const it = cleanItem(body.item);
        if (!it) throw httpError(400, 'link non valido');
        if (items.some((x) => x.key === it.key)) return items;
        delete tomb[it.key];
        return [it].concat(items).slice(0, MAX_SAVED);
      }
      if (body.action === 'remove') { tomb[str(body.key, 300)] = Date.now(); return items.filter((x) => x.key !== body.key); }
      if (body.action === 'note') {
        const it = items.find((x) => x.key === body.key);
        if (it) it.note = str(body.note, 500);
        return items;
      }
      throw httpError(400, 'azione sconosciuta');
    });
  }
  json(req, res, 200, out(data));
}

async function searchesApi(req, res) {
  if (req.method === 'GET') return json(req, res, 200, out(await store.get('searches')));
  const body = await readBody(req);
  let data;
  if (body.action === 'restore') {
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_SEARCHES).map((x) => cleanSearch(x, true)).filter(Boolean);
    const tomb = {};
    Object.keys(body.tomb || {}).slice(0, 3000).forEach((k) => { const t = past(body.tomb[k]); if (t) tomb[k] = t; });
    data = await store.restore('searches', items, tomb, (x) => x.id, (x) => x.savedAt);
  } else {
    data = await store.update('searches', (items, tomb) => {
      if (body.action === 'add') {
        const it = cleanSearch(body);
        if (!it) throw httpError(400, 'ricerca non valida');
        items.filter((x) => x.name === it.name).forEach((x) => { tomb[x.id] = Date.now(); });
        return [it].concat(items.filter((x) => x.name !== it.name)).slice(0, MAX_SEARCHES);
      }
      if (body.action === 'remove') { tomb[str(body.id, 40)] = Date.now(); return items.filter((x) => x.id !== body.id); }
      throw httpError(400, 'azione sconosciuta');
    });
  }
  json(req, res, 200, out(data));
}

// Quando qualcuno apre un annuncio salvato, aggiorniamo prezzo (con storico) e stato.
async function refreshSaved(key, ad, removed) {
  const it = (await store.get('saved')).items.find((x) => x.key === key);
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
  if (p === '/api/health') return json(req, res, 200, { ok: true, store: store.mode, bootId: store.bootId });

  if (req.method === 'POST') {
    if (!allowed('write', ip, 150)) return json(req, res, 429, { error: 'Troppe richieste, aspetta un attimo' });
    // Solo JSON: un altro sito non può scrivere qui al posto vostro (il browser lo blocca senza CORS)
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return json(req, res, 415, { error: 'serve JSON' });
  }

  if (p === '/api/search') {
    if (!allowed('search', ip, 60)) return json(req, res, 429, { error: 'Troppe ricerche, aspetta un paio di minuti' });
    let s;
    try { s = JSON.parse(url.searchParams.get('s') || '{}'); } catch (e) { return json(req, res, 400, { error: 'ricerca non valida' }); }
    return json(req, res, 200, await search(s, url.searchParams.get('page')));
  }
  if (p === '/api/feed') {
    if (!allowed('feed', ip, 60)) return json(req, res, 429, { error: 'Troppe richieste, aspetta un paio di minuti' });
    const q = url.searchParams;
    return json(req, res, 200, await feed(q.get('page'), { mode: q.get('mode'), seed: q.get('seed'), pmax: q.get('pmax'), kmmax: q.get('kmmax'), area: q.get('area') }));
  }
  if (p === '/api/ad') {
    if (!allowed('ad', ip, 150)) return json(req, res, 429, { error: 'Troppe richieste, aspetta un attimo' });
    const r = await getAd(url.searchParams.get('url') || '');
    if (r.error) return json(req, res, r.status || 500, r);
    if (!r.external) refreshSaved(DEDUP.listingKey(url.searchParams.get('url')), r.ad, r.removed).catch((e) => console.error('refresh', e.message));
    return json(req, res, 200, r);
  }
  if (p === '/api/translate' && req.method === 'POST') {
    if (!allowed('translate', ip, 40)) return json(req, res, 429, { error: 'Troppe traduzioni, aspetta un attimo' });
    const body = await readBody(req);
    try { return json(req, res, 200, await translate(body.text, body.from)); } catch (e) { return json(req, res, e.status || 502, { error: e.message }); }
  }
  if (p === '/api/saved') return savedApi(req, res);
  if (p === '/api/searches') return searchesApi(req, res);
  json(req, res, 404, { error: 'non trovato' });
}

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(req, res, 400, 'no', 'text/plain'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep)) return send(req, res, 403, 'no', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(req, res, 404, 'Non trovato', 'text/plain; charset=utf-8');
    send(req, res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': 'no-cache' });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const isApi = url.pathname.startsWith('/api/');
  const okMethod = req.method === 'GET' || req.method === 'HEAD' || (isApi && req.method === 'POST');
  if (!okMethod) return send(req, res, 405, '{"error":"metodo non permesso"}');
  if (!isApi) return serveStatic(req, res, url);
  api(req, res, url).catch((e) => {
    if (!res.headersSent) json(req, res, e.status || 500, { error: e.status ? e.message : 'errore interno' });
    if (!e.status) console.error('api error', e);
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log('CacciAuto in ascolto sulla porta ' + PORT + ' (archivio: ' + store.mode + ')'));
}

module.exports = server;

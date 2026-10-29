/*
 * Ricerca unificata: interroga i siti in parallelo, applica i filtri che i siti non sanno fare,
 * unisce gli annunci doppi (stessa auto su più siti) e ordina.
 */
const { getPage, BlockedError } = require('./fetch');
const SITES = require('../public/js/sites.js');
const DEDUP = require('../public/js/dedup.js');
const SOURCES = [require('./sources/autoscout'), require('./sources/subito'), require('./sources/autosupermarket'), require('./sources/automobile'), require('./sources/trovit')];

const FIELDS = ['make', 'model', 'kw', 'pmin', 'pmax', 'ymin', 'ymax', 'kmmin', 'kmmax', 'fuel', 'gear', 'body', 'cvmin', 'cvmax', 'seller', 'region', 'europe', 'sort'];

// Tiene solo i campi noti, con lunghezze ragionevoli.
function cleanSearch(raw) {
  const s = {};
  FIELDS.forEach((k) => {
    const v = raw && raw[k];
    if (k === 'europe') s[k] = v === true || v === 'true';
    else s[k] = v === undefined || v === null ? '' : String(v).slice(0, 60);
  });
  if (!s.sort) s.sort = 'rilevanza';
  return s;
}

function n(v) { const x = parseInt(v, 10); return isNaN(x) || x <= 0 ? null : x; }
function norm(s) { return SITES.strip(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

// I filtri valgono per tutti i siti: se un sito li ignora, li applichiamo qui.
// Un dato mancante nell'annuncio non lo esclude (meglio una in più che una persa).
function matches(it, s, siteId) {
  const pmin = n(s.pmin), pmax = n(s.pmax), ymin = n(s.ymin), ymax = n(s.ymax), kmmin = n(s.kmmin), kmmax = n(s.kmmax), cvmin = n(s.cvmin), cvmax = n(s.cvmax);
  if (pmin && it.price < pmin) return false;
  if (pmax && it.price > pmax) return false;
  if (it.year && ymin && it.year < ymin) return false;
  if (it.year && ymax && it.year > ymax) return false;
  if (it.km !== null && kmmax && it.km > kmmax) return false;
  if (it.km !== null && kmmin && it.km < kmmin) return false;
  if (s.seller && it.seller && it.seller !== s.seller) return false;
  if (it.cv && cvmin && it.cv < cvmin) return false;
  if (it.cv && cvmax && it.cv > cvmax) return false;
  if (s.fuel && it.fuel && it.fuel !== s.fuel) return false;
  if (s.gear && it.gear && it.gear !== s.gear) return false;
  const text = norm(it.title + ' ' + it.version);
  // il sito non conosce il modello e ha cercato solo la marca: filtriamo noi sul titolo
  if (s.model && SITES.modelDropped(siteId, s) && text.indexOf(norm(s.model)) === -1) return false;
  if (s.kw) {
    const words = s.kw.split(/\s+/).map(norm).filter((w) => w.length >= 2);
    if (words.some((w) => text.indexOf(w) === -1)) return false;
  }
  return true;
}

async function fromSource(src, s, page) {
  const url = src.url(s, page);
  const out = { id: src.id, name: src.name, url, ok: true, count: 0, total: null, pages: 0, error: '' };
  const skip = src.id === 'automobile' && !s.make ? 'serve la marca'
    : src.id === 'trovit' && !s.make && !s.kw ? 'serve la marca'
    : src.id === 'trovit' && s.region ? 'non filtra per zona'
    : src.id === 'trovit' && s.body ? 'non filtra la carrozzeria'
    : '';
  if (skip) {
    out.ok = false; out.skipped = true; out.error = skip;
    return { out, items: [] };
  }
  try {
    // alcuni siti hanno un link "preciso" e uno di riserva (se il primo non esiste: 404 = pagina vuota)
    const candidates = src.urls ? src.urls(s, page) : [url];
    let html = '';
    for (const u of candidates) {
      html = await getPage(u);
      out.url = u;
      if (html) break;
    }
    const r = src.parse(html);
    const items = r.items.filter((it) => matches(it, s, src.id));
    out.count = items.length; out.total = r.total; out.pages = r.pages;
    return { out, items };
  } catch (e) {
    out.ok = false;
    out.error = e instanceof BlockedError ? 'bloccato dal sito' : (e.name === 'TimeoutError' ? 'troppo lento' : 'non raggiungibile');
    return { out, items: [] };
  }
}

// "Saab 9-3" + "9-3 SportHatch 1.9" -> versione "SportHatch 1.9" (niente modello ripetuto)
function tidy(it) {
  const model = it.title.split(' ').slice(1).join(' ');
  if (model && it.version.toLowerCase().startsWith(model.toLowerCase() + ' ')) it.version = it.version.slice(model.length + 1);
  return it;
}

// Unisce la stessa auto pubblicata su più siti (logica condivisa col telefono, in dedup.js).
function mergeDuplicates(items) {
  return DEDUP.mergeListings([], items);
}

// Alterna i siti (1 AutoScout, 1 AutoSuperMarket, 1 Automobile, ...) per la vista "rilevanza".
function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) lists.forEach((l) => { if (l[i]) out.push(l[i]); });
  return out;
}

function sortItems(items, sort) {
  const big = Number.MAX_SAFE_INTEGER;
  if (sort === 'prezzo') items.sort((a, b) => a.price - b.price);
  else if (sort === 'km') items.sort((a, b) => (a.km === null ? big : a.km) - (b.km === null ? big : b.km));
  return items;
}

async function search(rawSearch, page) {
  const s = cleanSearch(rawSearch);
  page = Math.max(1, Math.min(50, parseInt(page, 10) || 1));
  const res = await Promise.all(SOURCES.map((src) => fromSource(src, s, page)));
  res.forEach((r) => r.items.forEach(tidy));
  const merged = mergeDuplicates(interleave(res.map((r) => r.items)));
  return {
    page,
    items: sortItems(merged, s.sort),
    sources: res.map((r) => r.out),
    hasMore: res.some((r) => r.out.ok && r.out.pages > page),
    links: SITES.plan(s).filter((p) => ['facebook', 'ilparking'].includes(p.site.id))
      .map((p) => ({ id: p.site.id, name: p.site.name, url: p.url }))
  };
}

module.exports = { search, matches, mergeDuplicates, cleanSearch, sortItems };

/*
 * Ricerca unificata: interroga i siti in parallelo, applica i filtri che i siti non sanno fare,
 * unisce gli annunci doppi (stessa auto su più siti) e ordina.
 */
const { getPage, BlockedError } = require('./fetch');
const SITES = require('../public/js/sites.js');
const DEDUP = require('../public/js/dedup.js');
const MATCH = require('../public/js/match.js');
const GEO = require('./geo');
const SOURCES = [require('./sources/autoscout'), require('./sources/subito'), require('./sources/autosupermarket'), require('./sources/automobile'), require('./sources/trovit'),
  require('./sources/kleinanzeigen'), require('./sources/marktplaats')];
// Siti esteri (le loro auto compaiono solo se la zona è "Italia + estero" o "Solo estero")
const FOREIGN = new Set(['kleinanzeigen', 'marktplaats']);

const FIELDS = ['make', 'model', 'kw', 'pmin', 'pmax', 'ymin', 'ymax', 'kmmin', 'kmmax', 'fuel', 'gear', 'body', 'cvmin', 'cvmax', 'seller', 'region', 'radius', 'europe', 'area', 'sort'];

// Tiene solo i campi noti, con lunghezze ragionevoli.
function cleanSearch(raw) {
  const s = {};
  FIELDS.forEach((k) => {
    const v = raw && raw[k];
    if (k === 'europe') s[k] = v === true || v === 'true';
    else s[k] = v === undefined || v === null ? '' : String(v).slice(0, 60);
  });
  if (!s.sort) s.sort = 'rilevanza';
  if (s.fuel === 'elettrica') s.fuel = ''; // le elettriche non si cercano
  // zona: '' = solo Italia, 'eu' = Italia + estero, 'estero' = solo estero (il vecchio "europe" vale 'eu')
  if (!['eu', 'estero'].includes(s.area)) s.area = s.europe ? 'eu' : '';
  // una regione italiana, o un raggio piccolo da casa, hanno senso solo in Italia
  if (s.region || (n(s.radius) && n(s.radius) < 500)) s.area = '';
  // raggio piccolo da Genova: ai siti che non sanno cercare per distanza chiediamo la Liguria
  // (AutoScout24 usa il raggio vero; poi la distanza la controlliamo noi su tutti)
  if (!s.region && n(s.radius) && n(s.radius) <= 150) s.region = 'liguria';
  s.europe = s.area !== '';
  return s;
}

function n(v) { const x = parseInt(v, 10); return isNaN(x) || x <= 0 ? null : x; }
function norm(s) { return SITES.strip(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

// I filtri valgono per tutti i siti: se un sito li ignora, li applichiamo qui.
// Un dato mancante nell'annuncio non lo esclude (meglio una in più che una persa).
// Siti che filtrano il modello in modo preciso (codici, non parole): il loro risultato è già giusto
const EXACT_MODEL = new Set(['autoscout']);
// Siti che cercano a parole anche nella descrizione: il modello può stare solo lì
const TEXT_SEARCH = new Set(['kleinanzeigen', 'marktplaats']);

function matches(it, s, siteId, bans) {
  if (MATCH.isElectric(it)) return false;
  if (MATCH.isFakeKm(it)) return false; // 0, 300, 999 km su un'auto vecchia, 111.111...
  if (bans && MATCH.banned(it, bans)) return false;
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
  // carrozzeria: se il sito la scrive ma non sa filtrarla (es. Subito), la controlliamo noi
  if (s.body && it.body && MATCH.normBody(it.body) && MATCH.normBody(it.body) !== s.body) return false;
  // distanza da casa (se non si sa da dove, l'annuncio resta)
  if (n(s.radius) && it.dist !== null && it.dist !== undefined && it.dist > n(s.radius)) return false;
  const text = norm(it.title + ' ' + it.version);
  // Modello: alcuni siti, se ne hanno pochi, aggiungono auto "simili" (Opel Vectra -> Crossland, Mokka, Panda...).
  // Teniamo solo gli annunci in cui il modello c'è davvero.
  if (s.model && !EXACT_MODEL.has(siteId)) {
    let t = MATCH.text(it);
    if (TEXT_SEARCH.has(siteId)) t += MATCH.words(String(it.snippet || '').slice(0, 140));
    if (!MATCH.modelHit(t, s.model)) return false;
  }
  // Trovit cerca a parole: con la sola marca può mettere altre marche
  if (s.make && !s.model && siteId === 'trovit' && !MATCH.makeHit(MATCH.text(it), s.make)) return false;
  if (s.kw) {
    const words = s.kw.split(/\s+/).map(norm).filter((w) => w.length >= 2);
    if (words.some((w) => text.indexOf(w) === -1)) return false;
  }
  return true;
}

// Siti da interrogare per questa zona
function sourcesFor(s) {
  return SOURCES.filter((src) => (FOREIGN.has(src.id) ? s.area !== '' : s.area !== 'estero' || src.id === 'autoscout'));
}

async function fromSource(src, s, page, bans) {
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
    const candidates = (src.urls ? src.urls(s, page) : [url]).map((c) => (typeof c === 'string' ? { u: c } : c));
    let html = '';
    for (const c of candidates) {
      html = await getPage(c.u);
      out.url = c.u;
      if (html) break; // pagina che non esiste (404): si prova il link di riserva
    }
    const r = src.parse(html);
    r.items.forEach(GEO.addDistance);
    const items = r.items.filter((it) => matches(it, s, src.id, bans));
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

async function search(rawSearch, page, opts) {
  const bans = (opts && opts.bans) || [];
  const s = cleanSearch(rawSearch);
  page = Math.max(1, Math.min(50, parseInt(page, 10) || 1));
  const only = opts && opts.only ? sourcesFor(s).filter((src) => src.id === opts.only) : sourcesFor(s);
  const res = await Promise.all(only.map((src) => fromSource(src, s, page, bans)));
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

module.exports = { search, matches, mergeDuplicates, cleanSearch, sortItems, sourcesFor };

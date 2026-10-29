/*
 * Feed della pagina principale: annunci da scorrere senza mettere filtri.
 *  - "Da appassionati": auto rare/sfiziose (lista sotto), negli anni giusti
 *  - "Affari": modelli diffusi con prezzo sotto il mercato secondo AutoScout24
 * Ogni pagina del feed usa poche ricerche (cache 10 minuti): leggero per i siti.
 */
const { getPage } = require('./fetch');
const DEDUP = require('../public/js/dedup.js');
const MATCH = require('../public/js/match.js');
const DEALS = require('../public/js/deals.js');
const GEO = require('./geo');
const AS = require('./sources/autoscout');
const SUB = require('./sources/subito');
const TV = require('./sources/trovit');
const KA = require('./sources/kleinanzeigen');
const MP = require('./sources/marktplaats');

const { RARE, POPULAR } = require('./feed-list');

// Divide la lista (già mescolata) in pagine da n modelli, senza ripetere la marca nella stessa pagina.
function pages(list, n) {
  const out = [];
  let rest = list.slice();
  while (rest.length) {
    const page = [], used = new Set(), later = [];
    rest.forEach((x) => {
      const mk = String(x.make || x[0]).toLowerCase();
      if (page.length < n && !used.has(mk)) { page.push(x); used.add(mk); } else later.push(x);
    });
    out.push(page);
    rest = later;
  }
  return out;
}

function pick(list, start, n) { const out = []; for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]); return out; }

// Generatore casuale con seme (stesso seme = stesso ordine: le pagine successive non si ripetono)
function rng(seed) {
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// prende n elementi a caso (non sempre i primi, che spesso sono dello stesso concessionario)
function sample(list, n, rand) { return shuffle(list, rand).slice(0, n); }

// Mescola evitando due annunci di fila dello stesso modello
function spread(items, rand) {
  const groups = {};
  // raggruppa per marca (i titoli sono quasi sempre diversi: "Saab 9-3 Aero", "SAAB 9.3 cabrio"...)
  shuffle(items, rand).forEach((it) => { const g = String(it._g || it.title || '').toLowerCase().split(/[\s-]/)[0]; (groups[g] = groups[g] || []).push(it); });
  const out = [];
  let last = null;
  while (Object.keys(groups).length) {
    // il gruppo più numeroso diverso dall'ultimo usato
    const keys = Object.keys(groups).filter((k) => k !== last).sort((a, b) => groups[b].length - groups[a].length || rand() - 0.5);
    const k = keys.length ? keys[0] : last;
    out.push(groups[k].shift());
    if (!groups[k].length) delete groups[k];
    last = k;
  }
  return out;
}

async function fromAS(search, page) {
  try { return AS.parse(await getPage(AS.url(search, page || 1))).items; } catch (e) { return []; }
}
async function fromSubito(search, page) {
  try {
    for (const u of SUB.urls(search, page || 1)) {
      const html = await getPage(u);
      if (html) return SUB.parse(html).items;
    }
  } catch (e) { /* sito non raggiungibile: niente */ }
  return [];
}
async function fromTrovit(search, page) {
  try { return TV.parse(await getPage(TV.url(search, page || 1))).items; } catch (e) { return []; }
}

async function fromKA(search, page) {
  try { return KA.parse(await getPage(KA.url(search, page || 1))).items; } catch (e) { return []; }
}
async function fromMP(search, page) {
  try {
    for (const c of MP.urls(search, page || 1)) {
      const items = MP.parse(await getPage(typeof c === 'string' ? c : c.u)).items;
      if (items.length) return items;
    }
  } catch (e) { /* sito non raggiungibile: niente */ }
  return [];
}

// Trovit con la ricerca generica "auto" mette anche moto e scooter: teniamo solo marche di auto note
const MODELS = require('../public/js/models.js');
const MAKE_NAMES = new Set(MODELS.makes.map((m) => m.n.toLowerCase().split(/[\s-]/)[0]));
['vw', 'mercedes'].forEach((x) => MAKE_NAMES.add(x));
function isCar(it) { return MAKE_NAMES.has(String(it.title || '').toLowerCase().split(/[\s-]/)[0]); }

function kwOk(it, kw) {
  if (!kw) return true;
  const clean = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean(it.title + ' ' + it.version).includes(clean(kw));
}
function n(v) { const x = parseInt(v, 10); return isNaN(x) || x <= 0 ? 0 : x; }
function within(it, o) {
  // nel feed si scorrono le foto: gli annunci senza foto non ci vanno
  if (!it.image) return false;
  if (MATCH.isElectric(it) || MATCH.isFakeKm(it) || MATCH.banned(it, o.bans)) return false;
  if (o.body && it.body && MATCH.normBody(it.body) && MATCH.normBody(it.body) !== o.body) return false;
  if (o.pmax && it.price > o.pmax) return false;
  if (o.kmmax && it.km && it.km > o.kmmax) return false;
  return true;
}

/*
 * opts: { mode, seed, pmax, kmmax, body, area: 'eu' (Italia + estero, normale) | 'it' (solo Italia) }
 *  - rare (o il vecchio "mix"): auto da appassionati, 5 modelli diversi a ogni pagina
 *  - offerte: modelli diffusi con prezzo sotto il mercato secondo AutoScout24, 6 modelli a pagina
 *  - recenti: gli ultimi annunci pubblicati
 * body = carrozzeria (citycar, berlina, sw, coupe, cabrio, suv)
 */
const BODIES = ['citycar', 'berlina', 'sw', 'coupe', 'cabrio', 'suv'];

async function feed(page, opts) {
  opts = opts || {};
  page = Math.max(0, Math.min(200, parseInt(page, 10) || 0));
  const seed = n(opts.seed) || Math.floor(Date.now() / 3600000);
  const body = BODIES.includes(opts.body) ? opts.body : '';
  const o = { pmax: n(opts.pmax), kmmax: n(opts.kmmax), bans: opts.bans || [], body };
  const abroad = opts.area !== 'it';
  const rand = rng(seed * 31 + page);
  const done = (items, hasMore) => ({ page, items: items.map(GEO.addDistance), hasMore });

  if (opts.mode === 'recenti') {
    const s = { pmax: o.pmax ? String(o.pmax) : '', kmmax: o.kmmax ? String(o.kmmax) : '', body, sort: 'recenti' };
    const jobs = [fromAS(s, page + 1), fromSubito(s, page + 1)];
    // Trovit e Marktplaats non sanno filtrare la carrozzeria: con un tipo scelto li saltiamo
    if (!body) jobs.push(fromTrovit(Object.assign({ make: 'auto' }, s), page + 1).then((l) => l.filter(isCar)));
    if (abroad) jobs.push(fromKA(s, page + 1));
    if (abroad && !body) jobs.push(fromMP(s, page + 1));
    const lists = await Promise.all(jobs);
    const items = [];
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < max; i++) lists.forEach((l) => { if (l[i] && within(l[i], o)) items.push(Object.assign(l[i], { reason: 'recente', label: 'Nuovo annuncio' })); });
    return done(DEDUP.mergeListings([], items), true);
  }

  // i modelli nella ban list non si cercano proprio
  const ok = (make, model) => !MATCH.banned({ title: make + ' ' + model }, o.bans);
  const jobs = [];

  if (opts.mode === 'offerte') {
    // 12 modelli di marche diverse per pagina; per ognuno l'annuncio più sotto il prezzo di auto simili
    const popOrder = shuffle(POPULAR.filter(([make, model, b]) => ok(make, model) && (!body || b === body)), rng(seed + 1));
    if (!popOrder.length) return done([], false);
    const popPages = pages(popOrder, 12);
    popPages[page % popPages.length].forEach(([make, model]) => {
      const s = { make, model, ymin: '2008', pmax: String(o.pmax || 30000), kmmax: o.kmmax ? String(o.kmmax) : '', body, sort: 'rilevanza' };
      jobs.push(Promise.all([fromAS(Object.assign({ europe: abroad }, s)), fromSubito(s)]).then(([a, b]) => {
        const all = a.concat(b).filter((it) => MATCH.modelHit(MATCH.text(it), model) && within(it, o));
        DEALS.estimate(all, { oneModel: true });
        const good = all.filter((it) => {
          if (MATCH.flags([it.title, it.version, it.snippet].join(' ')).some((f) => f.bad)) return false; // motore da rifare, ricambi...
          if (it.km < 5000) return false; // auto nuove/km 0: sono promozioni, non affari
          const sim = it.estHow === 'simili';
          if (sim && it.dev < -0.4) return false; // troppo basso rispetto alle simili: sospetto
          // sotto il prezzo di almeno 5 auto simili, oppure "affare" per AutoScout24 (e non sopra le simili)
          return (sim && it.dev <= -0.12) || ((it.deal === 1 || it.deal === 2) && (!sim || it.dev <= 0));
        }).sort((x, y) => (x.estHow === 'simili' ? x.dev : -0.1) - (y.estHow === 'simili' ? y.dev : -0.1));
        const best = good[0];
        if (!best) return [];
        const pct = best.estHow === 'simili' ? Math.round(-best.dev * 100) : 0;
        const label = pct ? (pct >= 15 ? 'Affare' : 'Buon prezzo') + ' · −' + pct + '% sulle simili' : (best.deal === 1 ? 'Affare' : 'Buon prezzo') + ' per AutoScout24';
        return [Object.assign(best, { reason: 'affare', label, _g: make })];
      }));
    });
    const all = [].concat(...(await Promise.all(jobs)));
    return done(spread(DEDUP.mergeListings([], all), rand), page < popPages.length * 3);
  }

  // Da appassionati: 12 modelli di marche diverse per pagina, UN annuncio per modello da un sito a caso
  const list = RARE.filter((r) => ok(r.make, r.model) && (!body || r.b === body));
  if (!list.length) return done([], false);
  const rarePages = pages(shuffle(list, rng(seed)), 12);
  // giri successivi della lista: stessi modelli, annunci diversi
  const cycle = Math.floor(page / rarePages.length);
  rarePages[page % rarePages.length].forEach((r) => {
    const pmax = o.pmax ? Math.min(o.pmax, r.p) : r.p;
    const s = { make: r.make, model: r.model, kw: r.kw || '', ymin: String(r.y[0]), ymax: String(r.y[1]), pmax: String(pmax), kmmax: o.kmmax ? String(o.kmmax) : '', sort: 'rilevanza' };
    const tag = { reason: 'rara', label: 'Da appassionati', fact: r.f, _g: r.make };
    // deve essere davvero quel modello, quella versione e in quegli anni (alcuni siti aggiungono auto "simili")
    const right = (it) => {
      const t = MATCH.text(it) + MATCH.words(String(it.snippet || '').slice(0, 120));
      return MATCH.modelHit(t, r.model) && MATCH.kwHit(t, r.kw) && within(it, o) &&
        it.price <= pmax && (!it.year || (it.year >= r.y[0] && it.year <= r.y[1]));
    };
    const sources = [() => fromAS(Object.assign({ europe: abroad }, s), 1 + cycle % 2), () => fromSubito(s)];
    if (abroad) sources.push(rand() < 0.6 ? () => fromKA(s) : () => fromMP(s));
    const order = shuffle(sources, rand);
    const r1 = rand();
    jobs.push((async () => {
      for (const get of order) {
        const found = (await get()).filter(right);
        if (found.length) return [Object.assign(found[Math.floor(r1 * Math.min(found.length, 10))], tag)];
      }
      return [];
    })());
  });
  const all = [].concat(...(await Promise.all(jobs)));
  return done(spread(DEDUP.mergeListings([], all), rand), page < rarePages.length * 3);
}

module.exports = { feed, RARE, POPULAR, spread, rng, pages };

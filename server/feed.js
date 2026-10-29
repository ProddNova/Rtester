/*
 * Feed della pagina principale: annunci da scorrere senza mettere filtri.
 *  - "Da appassionati": auto rare/sfiziose (lista sotto), negli anni giusti
 *  - "Affari": modelli diffusi con prezzo sotto il mercato secondo AutoScout24
 * Ogni pagina del feed usa poche ricerche (cache 10 minuti): leggero per i siti.
 */
const { getPage } = require('./fetch');
const DEDUP = require('../public/js/dedup.js');
const MATCH = require('../public/js/match.js');
const GEO = require('./geo');
const AS = require('./sources/autoscout');
const SUB = require('./sources/subito');
const TV = require('./sources/trovit');
const KA = require('./sources/kleinanzeigen');
const MP = require('./sources/marktplaats');

// make, model (nome come su AutoScout24), kw = parola chiave, y = anni, p = prezzo massimo sensato, f = curiosità
const RARE = [
  { make: 'Saab', model: '9-3', kw: 'viggen', y: [1999, 2002], p: 30000, f: 'Prende il nome dal caccia Saab 37 Viggen.' },
  { make: 'Saab', model: '9-3', kw: 'aero', y: [2003, 2011], p: 15000, f: 'L\'Aero top di gamma ha il 2.8 V6 turbo da 250-280 CV.' },
  { make: 'Saab', model: '900', y: [1979, 1998], p: 25000, f: 'La chiave si gira tra i sedili, vicino alla leva del cambio.' },
  { make: 'Mazda', model: 'MX-5', y: [1990, 2005], p: 15000, f: 'Secondo il Guinness è la spider a due posti più venduta della storia.' },
  { make: 'Mazda', model: 'RX-8', y: [2003, 2012], p: 15000, f: 'Motore rotativo Renesis e porte posteriori controvento.' },
  { make: 'BMW', model: 'M3', y: [1986, 2013], p: 60000, f: 'Dalla E30 alla E92: le M3 aspirate che hanno fatto la storia.' },
  { make: 'BMW', model: 'Z3', y: [1996, 2002], p: 20000, f: 'È la BMW di James Bond in GoldenEye (1995).' },
  { make: 'BMW', model: 'Serie 3', kw: '330', y: [1998, 2006], p: 12000, f: 'Sei cilindri in linea e trazione posteriore a prezzi umani.' },
  { make: 'Honda', model: 'S2000', y: [1999, 2009], p: 40000, f: 'Il quattro cilindri F20C gira fino a 9.000 giri.' },
  { make: 'Honda', model: 'Civic', kw: 'type r', y: [1997, 2015], p: 25000, f: 'Le Type R: VTEC, pochi fronzoli e tanto pistone.' },
  { make: 'Honda', model: 'Prelude', y: [1990, 2001], p: 15000, f: 'Una delle prime auto di serie con le quattro ruote sterzanti.' },
  { make: 'Peugeot', model: '205', kw: 'gti', y: [1984, 1994], p: 25000, f: 'Una delle hot hatch simbolo degli anni 80.' },
  { make: 'Fiat', model: 'Coupe', y: [1994, 2000], p: 18000, f: 'Esterni disegnati da Chris Bangle, interni da Pininfarina.' },
  { make: 'Fiat', model: 'Panda', kw: '4x4', y: [1983, 2003], p: 9000, f: 'La prima Panda 4x4 è nata con la trazione Steyr-Puch.' },
  { make: 'Fiat', model: 'Barchetta', y: [1995, 2005], p: 12000, f: 'Spider leggera costruita da Maggiora a Chivasso.' },
  { make: 'Lancia', model: 'Delta', kw: 'integrale', y: [1987, 1995], p: 90000, f: 'Sei titoli costruttori WRC di fila, dal 1987 al 1992.' },
  { make: 'Lancia', model: 'Thema', y: [1984, 1994], p: 25000, f: 'La 8.32 montava un V8 di derivazione Ferrari.' },
  { make: 'Alfa Romeo', model: '147', kw: 'gta', y: [2002, 2010], p: 18000, f: 'Sotto il cofano c\'è il V6 "Busso" 3.2 da 250 CV.' },
  { make: 'Alfa Romeo', model: 'GTV', y: [1995, 2005], p: 15000, f: 'Disegnata da Enrico Fumia per Pininfarina.' },
  { make: 'Alfa Romeo', model: 'Spider', y: [1966, 2006], p: 30000, f: 'Dal Duetto di "Il laureato" alla 916 di Pininfarina.' },
  { make: 'Alfa Romeo', model: '75', y: [1985, 1992], p: 25000, f: 'Transaxle: cambio al posteriore per bilanciare i pesi.' },
  { make: 'Toyota', model: 'MR 2', y: [1984, 2007], p: 18000, f: 'Motore centrale e trazione posteriore, a prezzi da utilitaria.' },
  { make: 'Toyota', model: 'Celica', y: [1990, 2006], p: 12000, f: 'Le Celica GT-Four hanno corso e vinto nel WRC.' },
  { make: 'Toyota', model: 'GT86', y: [2012, 2021], p: 25000, f: 'Il boxer è di origine Subaru: è gemella della BRZ.' },
  { make: 'Subaru', model: 'Impreza', y: [1993, 2010], p: 25000, f: 'Motore boxer e trazione integrale, il rally nel DNA.' },
  { make: 'Mitsubishi', model: 'Lancer', kw: 'evo', y: [1996, 2016], p: 50000, f: 'La Evo ha vinto quattro titoli piloti WRC con Tommi Mäkinen.' },
  { make: 'Audi', model: 'TT', y: [1998, 2005], p: 12000, f: 'La prima TT (8N) deriva dalla piattaforma della Golf IV.' },
  { make: 'Audi', model: '80', y: [1986, 1996], p: 15000, f: 'La B3/B4 quattro: tank tedesco a trazione integrale.' },
  { make: 'Porsche', model: 'Boxster', y: [1996, 2004], p: 22000, f: 'La 986 è stata la Porsche che ha rilanciato il marchio negli anni 90.' },
  { make: 'Porsche', model: '944', y: [1982, 1991], p: 30000, f: 'Transaxle e quattro cilindri: la Porsche "accessibile" degli anni 80.' },
  { make: 'Volvo', model: '850', y: [1992, 1997], p: 12000, f: 'Nel 1994 ha corso nel BTCC anche in versione station wagon.' },
  { make: 'Volvo', model: '240', y: [1975, 1993], p: 12000, f: 'Il "mattone" svedese: prodotto per quasi 20 anni.' },
  { make: 'Mercedes-Benz', model: 'Classe E', kw: 'w124', y: [1985, 1996], p: 15000, f: 'La W124: la Mercedes "che non muore mai".' },
  { make: 'Mercedes-Benz', model: 'SLK', y: [1996, 2004], p: 10000, f: 'Il tetto rigido Vario-roof si ripiega nel bagagliaio.' },
  { make: 'Mercedes-Benz', model: '190', y: [1982, 1993], p: 15000, f: 'La "Baby Benz": la prima Mercedes compatta.' },
  { make: 'Volkswagen', model: 'Golf', kw: 'r32', y: [2002, 2009], p: 25000, f: 'La R32 ha il VR6 3.2 e la trazione integrale.' },
  { make: 'Volkswagen', model: 'Golf', kw: 'gti', y: [1976, 2012], p: 20000, f: 'Il nome GTI è nato qui, nel 1976.' },
  { make: 'Volkswagen', model: 'Scirocco', y: [1974, 2017], p: 18000, f: 'Il nome viene da un vento che soffia sul Mediterraneo.' },
  { make: 'Volkswagen', model: 'Corrado', y: [1988, 1995], p: 25000, f: 'La VR6 aveva uno spoiler che si alzava da solo in velocità.' },
  { make: 'Renault', model: 'Clio', kw: 'rs', y: [1999, 2019], p: 15000, f: 'Le Clio RS sono tra le hot hatch più divertenti di sempre.' },
  { make: 'Renault', model: 'Megane', kw: 'rs', y: [2004, 2020], p: 25000, f: 'Più volte record al Nürburgring per le trazioni anteriori.' },
  { make: 'Ford', model: 'Focus', kw: 'rs', y: [2002, 2018], p: 35000, f: 'La RS Mk2 ha il cinque cilindri 2.5 turbo di origine Volvo.' },
  { make: 'Ford', model: 'Fiesta', kw: 'st', y: [2005, 2022], p: 18000, f: 'Piccola, leggera e cattiva: amata da chi va in pista.' },
  { make: 'Ford', model: 'Mustang', y: [1964, 2015], p: 40000, f: 'La pony car per eccellenza.' },
  { make: 'MINI', model: 'Cooper S', y: [2002, 2006], p: 8000, f: 'La R53 ha il compressore volumetrico: fischia che è una meraviglia.' },
  { make: 'Nissan', model: '350Z', y: [2003, 2009], p: 20000, f: 'V6 VQ35 aspirato e trazione posteriore.' },
  { make: 'Nissan', model: '200 SX', y: [1988, 2002], p: 25000, f: 'La Silvia europea: regina del drift.' },
  { make: 'Opel', model: 'Calibra', y: [1990, 1997], p: 12000, f: 'Al lancio era una delle auto più aerodinamiche al mondo (Cx 0,26).' },
  { make: 'Suzuki', model: 'Jimny', y: [1998, 2018], p: 12000, f: 'Piccolo, leggero e capace di andare dove i SUV si piantano.' },
  { make: 'Land Rover', model: 'Defender', y: [1983, 2016], p: 45000, f: 'Erede diretto della Land Rover Series del 1948.' },
  { make: 'Lexus', model: 'IS 200', y: [1999, 2005], p: 8000, f: 'Sei cilindri in linea e trazione posteriore, affidabilità Toyota.' },
  { make: 'Citroen', model: 'Saxo', kw: 'vts', y: [1996, 2003], p: 8000, f: 'Leggerissima: la VTS pesa meno di una tonnellata.' },
  { make: 'Jaguar', model: 'XK', y: [1996, 2014], p: 30000, f: 'Inglese, lunga e bassa: da cruising notturno.' },
  { make: 'Abarth', model: '500', y: [2008, 2026], p: 20000, f: 'Lo scorpione sul cofano: piccola ma rumorosa.' }
];

// Modelli diffusi: qui cerchiamo solo prezzi sotto il mercato
const POPULAR = [
  ['Volkswagen', 'Golf'], ['Fiat', 'Panda'], ['Fiat', '500'], ['BMW', 'Serie 3'], ['Audi', 'A3'], ['Mercedes-Benz', 'Classe A'],
  ['Volkswagen', 'Polo'], ['Toyota', 'Yaris'], ['Renault', 'Clio'], ['Lancia', 'Ypsilon'], ['Ford', 'Fiesta'], ['Peugeot', '208'],
  ['Opel', 'Corsa'], ['Alfa Romeo', 'Giulietta'], ['BMW', 'Serie 1'], ['Audi', 'A4'], ['Mercedes-Benz', 'Classe C'], ['Volkswagen', 'Tiguan'],
  ['Jeep', 'Renegade'], ['Fiat', 'Punto'], ['Toyota', 'RAV4'], ['Ford', 'Focus'], ['Citroen', 'C3'], ['Dacia', 'Duster'],
  ['Nissan', 'Qashqai'], ['Hyundai', 'i20'], ['Kia', 'Sportage'], ['Skoda', 'Octavia'], ['MINI', 'Cooper'], ['Volvo', 'XC60']
];

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
  shuffle(items, rand).forEach((it) => { const g = (it.title || '').toLowerCase(); (groups[g] = groups[g] || []).push(it); });
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
  if (MATCH.isElectric(it) || MATCH.banned(it, o.bans)) return false;
  if (o.pmax && it.price > o.pmax) return false;
  if (o.kmmax && it.km && it.km > o.kmmax) return false;
  return true;
}

/*
 * opts: { mode: 'mix' | 'recenti', seed, pmax, kmmax, area: 'eu' (Italia + estero, normale) | 'it' (solo Italia) }
 *  - mix: 4 auto da appassionati diverse + 2 modelli diffusi con prezzo sotto il mercato, a ogni pagina
 *  - recenti: gli ultimi annunci pubblicati (AutoScout24, Subito, Trovit; con l'estero anche Kleinanzeigen e Marktplaats)
 */
async function feed(page, opts) {
  opts = opts || {};
  page = Math.max(0, Math.min(200, parseInt(page, 10) || 0));
  const seed = n(opts.seed) || Math.floor(Date.now() / 3600000);
  const o = { pmax: n(opts.pmax), kmmax: n(opts.kmmax), bans: opts.bans || [] };
  const abroad = opts.area !== 'it';
  const rand = rng(seed * 31 + page);

  if (opts.mode === 'recenti') {
    const s = { pmax: o.pmax ? String(o.pmax) : '', kmmax: o.kmmax ? String(o.kmmax) : '', sort: 'recenti' };
    const jobs = [fromAS(s, page + 1), fromSubito(s, page + 1),
      fromTrovit(Object.assign({ make: 'auto' }, s), page + 1).then((l) => l.filter(isCar))];
    if (abroad) jobs.push(fromKA(s, page + 1), fromMP(s, page + 1));
    const lists = await Promise.all(jobs);
    const items = [];
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < max; i++) lists.forEach((l) => { if (l[i] && within(l[i], o)) items.push(Object.assign(l[i], { reason: 'recente', label: 'Nuovo annuncio' })); });
    return { page, items: DEDUP.mergeListings([], items).map(GEO.addDistance), hasMore: true };
  }

  // ordine casuale ma fisso per questo seme: pagina dopo pagina si scorrono modelli sempre diversi
  // i modelli nella ban list non si cercano proprio
  const ok = (make, model) => !MATCH.banned({ title: make + ' ' + model }, o.bans);
  const rareOrder = shuffle(RARE.filter((r) => ok(r.make, r.model)), rng(seed));
  const popOrder = shuffle(POPULAR.filter(([make, model]) => ok(make, model)), rng(seed + 1));
  const rare = pick(rareOrder, page * 4, 4);
  const pop = pick(popOrder, page * 2, 2);

  const jobs = [];
  rare.forEach((r) => {
    const pmax = o.pmax ? Math.min(o.pmax, r.p) : r.p;
    const s = { make: r.make, model: r.model, kw: r.kw || '', ymin: String(r.y[0]), ymax: String(r.y[1]), pmax: String(pmax), kmmax: o.kmmax ? String(o.kmmax) : '', sort: 'rilevanza' };
    const tag = { reason: 'rara', label: 'Da appassionati', fact: r.f };
    // dall'estero una fonte a caso per auto (Germania o Olanda), così le richieste restano poche
    const foreign = !abroad ? Promise.resolve([]) : rand() < 0.6 ? fromKA(s) : fromMP(s);
    jobs.push(Promise.all([fromAS(Object.assign({ europe: abroad }, s)), fromSubito(s), foreign]).then(([a, b, c]) => {
      const ok = (it) => kwOk(it, r.kw) && within(it, o);
      // Kleinanzeigen/Marktplaats cercano a parole: il modello deve comparire nel titolo
      const okF = (it) => ok(it) && kwOk(it, /^(Serie|Classe) /.test(r.model) ? '' : r.model) &&
        it.price <= pmax && (!it.year || (it.year >= r.y[0] && it.year <= r.y[1]));
      return sample(a.filter(ok), 3, rand).concat(sample(b.filter(ok), 2, rand), sample(c.filter(okF), 2, rand))
        .map((it) => Object.assign(it, tag));
    }));
  });
  pop.forEach(([make, model]) => {
    const s = { make, model, ymin: '2008', pmax: String(o.pmax || 25000), kmmax: o.kmmax ? String(o.kmmax) : '', sort: 'rilevanza' };
    // affari secondo la valutazione di AutoScout24 (1 = ottimo, 2 = buon prezzo)
    jobs.push(fromAS(s).then((items) => sample(items.filter((it) => (it.deal === 1 || it.deal === 2) && within(it, o)), 4, rand)
      .map((it) => Object.assign(it, { reason: 'affare', label: it.deal === 1 ? 'Affare' : 'Buon prezzo' }))));
  });

  const all = [].concat(...(await Promise.all(jobs)));
  const items = spread(DEDUP.mergeListings([], all), rand).map(GEO.addDistance);
  return { page, items, hasMore: page < Math.ceil(RARE.length / 4) * 3 };
}

module.exports = { feed, RARE, POPULAR, spread, rng };

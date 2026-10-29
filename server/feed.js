/*
 * Feed della pagina principale: annunci da scorrere senza mettere filtri.
 *  - "Da appassionati": auto rare/sfiziose (lista sotto), negli anni giusti
 *  - "Affari": modelli diffusi con prezzo sotto il mercato secondo AutoScout24
 * Ogni pagina del feed usa poche ricerche (cache 10 minuti): leggero per i siti.
 */
const { getPage } = require('./fetch');
const DEDUP = require('../public/js/dedup.js');
const AS = require('./sources/autoscout');
const SUB = require('./sources/subito');

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

function daySeed() { return Math.floor(Date.now() / 86400000); }
function pick(list, start, n) { const out = []; for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]); return out; }

async function fromAS(search) {
  try { return AS.parse(await getPage(AS.url(search, 1))).items; } catch (e) { return []; }
}
async function fromSubito(search) {
  try {
    for (const u of SUB.urls(search, 1)) {
      const html = await getPage(u);
      if (html) return SUB.parse(html).items;
    }
  } catch (e) { /* sito non raggiungibile: niente */ }
  return [];
}

function kwOk(it, kw) {
  if (!kw) return true;
  const t = (it.title + ' ' + it.version).toLowerCase().replace(/[^a-z0-9]/g, '');
  return t.includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

async function feed(page) {
  page = Math.max(0, Math.min(200, parseInt(page, 10) || 0));
  const seed = daySeed();
  const rare = pick(RARE, (seed * 7 + page * 3) % RARE.length, 3);
  const pop = pick(POPULAR, (seed * 5 + page * 2) % POPULAR.length, 2);

  // ordine dei gruppi pensato per alternare i modelli: prima AutoScout24 di ogni rara, poi gli affari, poi Subito
  const asJobs = [], subJobs = [];
  rare.forEach((r) => {
    const s = { make: r.make, model: r.model, kw: r.kw || '', ymin: String(r.y[0]), ymax: String(r.y[1]), pmax: String(r.p), sort: 'rilevanza' };
    const tag = { reason: 'rara', label: 'Da appassionati', fact: r.f };
    asJobs.push(fromAS(s).then((items) => items.filter((it) => kwOk(it, r.kw)).slice(0, 6).map((it) => Object.assign(it, tag))));
    subJobs.push(fromSubito(s).then((items) => items.filter((it) => kwOk(it, r.kw)).slice(0, 4).map((it) => Object.assign(it, tag))));
  });
  const jobs = asJobs;
  pop.forEach(([make, model]) => {
    const s = { make, model, ymin: '2008', pmax: '25000', sort: 'rilevanza' };
    // affari secondo la valutazione di AutoScout24 (1 = ottimo, 2 = buon prezzo)
    jobs.push(fromAS(s).then((items) => items.filter((it) => it.deal === 1 || it.deal === 2).slice(0, 6)
      .map((it) => Object.assign(it, { reason: 'affare', label: it.deal === 1 ? 'Affare' : 'Buon prezzo' }))));
  });

  jobs.push(...subJobs);
  const lists = await Promise.all(jobs);
  // alterna le fonti, poi unisce i doppioni
  const mixed = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) lists.forEach((l) => { if (l[i]) mixed.push(l[i]); });
  const items = DEDUP.mergeListings([], mixed);
  return { page, items, hasMore: true };
}

module.exports = { feed, RARE, POPULAR };

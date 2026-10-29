// Riconoscimento marca/modello, ban list, elettriche, distanza da Genova.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../public/js/match.js');
const GEO = require('../server/geo');
const { matches, cleanSearch } = require('../server/search');

const it = (title, version, extra) => Object.assign({ title, version: version || '', price: 3000, km: 100000, year: 2005 }, extra || {});

test('modello: nomi italiani, tedeschi e olandesi', () => {
  const yes = [['Opel Vectra 1.9', 'Vectra'], ['BMW 320d Touring', 'Serie 3'], ['BMW 3er Touring', 'Serie 3'], ['BMW 3-Serie 318i', 'Serie 3'],
    ['Mercedes C 220 CDI', 'Classe C'], ['Mercedes-Benz C-Klasse', 'Classe C'], ['Mazda MX5 1.6', 'MX-5'], ['Saab 93 aero', '9-3'], ['Saab 9 - 3 Cabrio', '9-3']];
  const no = [['Opel Crossland', 'Vectra'], ['BMW 520d', 'Serie 3'], ['Mercedes-Benz CLA 200', 'Classe C'], ['Saab 9-5', '9-3'], ['Peugeot 2050', '205']];
  yes.forEach(([t, m]) => assert.ok(M.modelHit(M.text(it(t)), m), t + ' = ' + m));
  no.forEach(([t, m]) => assert.ok(!M.modelHit(M.text(it(t)), m), t + ' != ' + m));
});

test('ricerca: i siti che aggiungono auto "simili" vengono ripuliti (non AutoScout24, che filtra già)', () => {
  const s = cleanSearch({ make: 'Opel', model: 'Vectra' });
  assert.ok(matches(it('Opel Vectra', '1.9 CDTI'), s, 'autosupermarket'));
  assert.ok(!matches(it('Opel Crossland', '1.2'), s, 'autosupermarket'));
  assert.ok(!matches(it('Fiat Panda'), s, 'trovit'));
  // Kleinanzeigen cerca anche nella descrizione: il modello può essere solo lì
  assert.ok(matches(it('Opel Kombi TÜV neu', '', { snippet: 'Opel Vectra C Caravan 1.8' }), s, 'kleinanzeigen'));
  // solo marca su Trovit: niente altre marche
  assert.ok(!matches(it('Fiat Panda'), cleanSearch({ make: 'Opel' }), 'trovit'));
});

test('ban list: marca e modello precisi', () => {
  const bans = [{ make: 'Abarth', model: '500' }];
  assert.ok(M.banned(it('Abarth 500', '1.4 T-Jet'), bans));
  assert.ok(M.banned(it('Fiat 500 Abarth 1.4'), bans));
  assert.ok(!M.banned(it('Abarth 595 Competizione'), bans), '595 è un altro modello');
  assert.ok(!M.banned(it('Fiat 500 1.2 Lounge'), bans), 'la 500 normale resta');
  assert.ok(!matches(it('Abarth 500'), cleanSearch({}), 'autoscout', bans));
});

test('elettriche: escluse sempre, ibride no', () => {
  assert.ok(M.isElectric(it('Tesla Model 3')));
  assert.ok(M.isElectric(it('Renault Zoe Intens')));
  assert.ok(M.isElectric(it('Fiat 500', '', { fuel: 'elettrica' })));
  assert.ok(!M.isElectric(it('Toyota Yaris Hybrid')));
  assert.ok(!M.isElectric(it('Fiat 500 1.0 Hybrid', '', { fuel: 'ibrida' })));
  assert.ok(!matches(it('Nissan Leaf'), cleanSearch({}), 'subito'));
  assert.strictEqual(cleanSearch({ fuel: 'elettrica' }).fuel, '');
});

test('distanza da Genova dalle città scritte negli annunci', () => {
  const d = (city, country) => GEO.distance({ city, country }).dist;
  assert.strictEqual(d('Genova (GE)'), 0);
  assert.ok(Math.abs(d('Rapallo') - 25) < 5);
  assert.ok(Math.abs(d('Torino - To') - 123) < 5);
  assert.ok(Math.abs(d('Montagnana - Padova - PD -') - 220) < 10);
  assert.ok(d('Castro (LE)') > 800 && d('Castro (BG)') < 250, 'stesso nome, provincia diversa');
  assert.strictEqual(d('Reggio Emilia'), d("Reggio nell'Emilia (RE)"));
  assert.ok(d('Neuss, DE', 'DE') > 500 && GEO.distance({ city: 'Neuss, DE', country: 'DE' }).approx);
  assert.strictEqual(d(''), null);
});

test('raggio da casa: fuori raggio escluso, città sconosciuta tenuta, raggio piccolo = solo Italia', () => {
  const s = cleanSearch({ radius: '100', area: 'eu' });
  assert.strictEqual(s.area, '');
  assert.ok(matches(it('Fiat Panda', '', { dist: 40 }), s, 'subito'));
  assert.ok(!matches(it('Fiat Panda', '', { dist: 300 }), s, 'subito'));
  assert.ok(matches(it('Fiat Panda', '', { dist: null }), s, 'subito'));
});

test('km falsi: 0, 300, 999 su auto vecchie e numeri tipo 111.111 esclusi', () => {
  const y = new Date().getFullYear();
  assert.ok(M.isFakeKm({ km: 0, year: 2005 }));
  assert.ok(M.isFakeKm({ km: 300, year: 2010 }));
  assert.ok(M.isFakeKm({ km: 999, year: y - 3 }));
  assert.ok(M.isFakeKm({ km: 111111, year: 2005 }));
  assert.ok(M.isFakeKm({ km: 123456, year: 2009 }));
  assert.ok(!M.isFakeKm({ km: 0, year: y }), 'auto nuova o km0 vera');
  assert.ok(!M.isFakeKm({ km: 1500, year: 2010 }));
  assert.ok(!M.isFakeKm({ km: null, year: 2005 }), 'km non scritti: resta');
  assert.ok(!matches(it('Fiat Panda', '', { km: 0, year: 2006 }), cleanSearch({}), 'subito'));
});

test('avvisi dalla descrizione (italiano, tedesco, olandese) e negazioni', () => {
  const t = (s) => M.flags(s).map((f) => (f.bad ? '-' : f.warn ? '!' : '+') + f.t);
  assert.deepStrictEqual(t('Motore rifatto a 200.000 km, distribuzione fatta, frizione nuova'), ['!Motore rifatto', '+Distribuzione fatta', '+Frizione nuova']);
  assert.deepStrictEqual(t('Motore da rifare, solo per ricambi'), ['-Motore da rifare', '-Per ricambi']);
  assert.deepStrictEqual(t('Mai incidentata, unico proprietario'), ['+Un solo proprietario']);
  assert.deepStrictEqual(t('Motorschaden, nicht fahrbereit'), ['-Motore da rifare', '-Non marciante']);
  assert.deepStrictEqual(t('Motor überholt, Zahnriemen neu, Scheckheft'), ['!Motore rifatto', '+Distribuzione fatta', '+Tagliandi documentati']);
  assert.deepStrictEqual(t('motor gereviseerd, eerste eigenaar'), ['!Motore rifatto', '+Un solo proprietario']);
  assert.deepStrictEqual(t('Auto incidentata sul lato destro'), ['-Incidentata']);
});

test('carrozzeria scritta dai siti', () => {
  assert.deepStrictEqual(['Station Wagon', 'Cabrio', 'SUV/Fuoristrada', 'Coupé', 'City Car', 'Berlina', 'Kombi', 'Stationwagon'].map(M.normBody),
    ['sw', 'cabrio', 'suv', 'coupe', 'citycar', 'berlina', 'sw', 'sw']);
  const s = cleanSearch({ body: 'cabrio' });
  assert.ok(!matches(it('Fiat Punto', '', { body: 'Berlina' }), s, 'subito'));
  assert.ok(matches(it('Fiat Punto', '', { body: 'Cabrio' }), s, 'subito'));
  assert.ok(matches(it('Fiat Punto'), s, 'subito'), 'carrozzeria non scritta: resta');
});

test('feed: lista appassionati ampia, nomi come su AutoScout24, tipo per ognuna', () => {
  const { RARE, POPULAR } = require('../server/feed-list');
  const MODELS = require('../public/js/models.js');
  assert.ok(RARE.length >= 130 && POPULAR.length >= 80);
  const names = (mk) => { const m = MODELS.makes.find((x) => x.n === mk); return m ? (m.g || []).concat((m.m || []).map((x) => x[0])) : null; };
  RARE.forEach((r) => {
    assert.ok(names(r.make) && names(r.make).includes(r.model), r.make + ' ' + r.model);
    assert.ok(['citycar', 'berlina', 'sw', 'coupe', 'cabrio', 'suv'].includes(r.b), r.make + ' ' + r.model + ' tipo');
  });
  POPULAR.forEach(([mk, md]) => assert.ok(names(mk) && names(mk).includes(md), mk + ' ' + md));
});

test('affari: confronto con auto simili (mediana), prezzi anomali non spostano la stima', () => {
  const D = require('../public/js/deals.js');
  const mk = (price, year, km, extra) => Object.assign({ title: 'Fiat Panda', price, year, km, fuel: 'benzina', cv: 69 }, extra || {});
  const items = [mk(5000, 2012, 100000), mk(5200, 2012, 110000), mk(4900, 2013, 95000), mk(5100, 2011, 105000), mk(5300, 2012, 90000),
    mk(5000, 2012, 98000), mk(500, 2012, 100000) /* prezzo assurdo */, mk(3600, 2012, 102000) /* affare */,
    mk(15000, 2012, 100000, { fuel: 'diesel', cv: 95 }) /* altra versione: non entra nel confronto */];
  D.estimate(items, { oneModel: true });
  const deal = items[7];
  assert.strictEqual(deal.estHow, 'simili');
  assert.ok(deal.est >= 4900 && deal.est <= 5200, 'prezzo tipico ' + deal.est);
  assert.strictEqual(D.category(deal.dev), 1, 'affare');
  assert.strictEqual(D.category(items[6].dev), 0, 'troppo basso: sospetto');
  assert.strictEqual(items[8].estHow === 'simili', false, 'la diesel 95 CV non ha simili');
});

test('parola chiave della versione come parola intera ("GT" non dentro altre parole, "R.S." = RS)', () => {
  const t = (x) => M.text({ title: x });
  assert.ok(!M.kwHit(t('Fiat Punto 1.2 Dynamic'), 'gt'));
  assert.ok(M.kwHit(t('Fiat Punto GT 1.4 turbo'), 'gt'));
  assert.ok(M.kwHit(t('Renault Clio R.S. 2.0'), 'rs'));
  assert.ok(M.kwHit(t('Honda Civic TypeR'), 'type r'));
  assert.ok(!M.kwHit(t('Renault Clio 1.5 dCi'), 'rs'));
});

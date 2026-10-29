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

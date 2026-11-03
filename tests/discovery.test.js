const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesEnthusiast: matches } = require('../server/enthusiast');
const { RARE } = require('../server/feed-list');
const G = require('../public/js/generations');
const rule = (make, model, kw) => RARE.find((r) => r.make === make && r.model === model && r.kw === kw);

test('appassionati: la versione deve appartenere al titolo, alla marca e agli anni corretti', () => {
  const r = rule('Volkswagen', 'Golf', 'gti');
  assert.equal(matches({ title: 'Volkswagen Golf', version: 'GTI', year: 2005, cv: 200 }, r), true);
  assert.equal(matches({ title: 'Volkswagen Golf', version: '1.6', snippet: 'Disponibili anche GTI', year: 2005 }, r), false);
  assert.equal(matches({ title: 'Opel Golf GTI', year: 2005 }, r), false);
  assert.equal(matches({ title: 'Volkswagen Golf GTI', year: 2020 }, r), false);
  assert.equal(matches({ title: 'Volkswagen Golf GTI' }, r), false);
});

test('regressione: Punto 2010 normale e Micra comuni non entrano negli appassionati', () => {
  for (const it of [
    { title: 'Fiat Punto', version: '1.2 benzina', year: 2010 },
    { title: 'Fiat Punto GT', year: 2010 },
    { title: 'Nissan Micra', version: '1.2', year: 2012 }
  ]) assert.equal(RARE.some((r) => matches(it, r)), false, it.title);
  assert.equal(matches({ title: 'Fiat Punto GT', year: 1996, cv: 133 }, rule('Fiat', 'Punto', 'gt')), true);
});

test('appassionati: niente badge estetici, diesel o repliche; sportive autentiche ammesse', () => {
  const cases = [
    ['Hyundai', 'i30', 'n', 'Hyundai i30 N Performance', 2020, 275, true],
    ['Hyundai', 'i30', 'n', 'Hyundai i30 N-Line', 2020, 160, false],
    ['Volkswagen', 'Golf', 'r', 'Volkswagen Golf R-Line', 2018, 150, false],
    ['Volkswagen', 'Golf', 'r', 'Volkswagen Golf R', 2018, 310, true],
    ['BMW', 'Serie 3', '330i', 'BMW 330d', 2004, 204, false],
    ['BMW', 'Serie 3', '330i', 'BMW 330i', 2004, 231, true],
    ['Saab', '9-3', 'aero', 'Saab 9-3 TTiD Aero', 2008, 180, false],
    ['Peugeot', 'RCZ', 'r', 'Peugeot RCZ R', 2014, 270, true],
    ['Mercedes-Benz', 'Classe C', 'amg', 'Mercedes C220 AMG', 2012, 170, false],
    ['Mercedes-Benz', 'Classe C', 'amg', 'Mercedes C63 AMG', 2012, 457, true],
    ['Renault', 'Clio', 'v6', 'Renault Clio V6 replica', 2003, 200, false],
    ['Opel', 'Speedster', '', 'Opel Speedster 2.2', 2002, 147, true]
  ];
  cases.forEach(([make, model, kw, title, year, cv, expected]) => assert.equal(matches({ title, year, cv }, rule(make, model, kw)), expected, title));
});

test('generazioni: Golf Mk4/Mk5 e MX-5 NA/NC rimangono distinte', () => {
  const golf = G.list('Volkswagen', 'Golf');
  assert.equal(golf.length, 8);
  assert.deepEqual(golf.find((g) => g.name === 'Mk4'), { name: 'Mk4', from: 1997, to: 2004 });
  assert.equal(golf.find((g) => g.name === 'Mk5').from, 2003);
  assert.equal(G.list('Mazda', 'MX-5').find((g) => g.name === 'NC').from, 2005);
  assert.deepEqual(G.list('', ''), []);
  assert.deepEqual(G.list('Volkswagen', 'Unknown'), []);
});

test('generazioni: catalogo con intervalli validi e senza nomi duplicati per modello', () => {
  Object.values(G.data).forEach((models) => Object.values(models).forEach((rows) => {
    assert.equal(new Set(rows.map((g) => g[0])).size, rows.length);
    rows.forEach(([, from, to]) => assert.ok(Number.isInteger(from) && from >= 1950 && to >= from));
  }));
});

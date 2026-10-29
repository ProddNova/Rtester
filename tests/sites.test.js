const test = require('node:test');
const assert = require('node:assert');
const S = require('../public/js/sites.js');
const D = require('../public/js/data.js');

const full = {
  make: 'Saab', model: '9-3', kw: 'aero', pmin: '1000', pmax: '6000', ymin: '2005', ymax: '2011',
  kmmax: '250000', fuel: 'diesel', gear: 'manuale', body: 'berlina', cvmin: '150', cvmax: '',
  region: 'liguria', europe: false, sort: 'prezzo'
};
const url = (id, s) => S.plan(s).find((p) => p.site.id === id).url;

test('AutoScout24: path e parametri verificati', () => {
  const u = new URL(url('autoscout', full));
  assert.strictEqual(u.pathname, '/lst/saab/9-3');
  const q = u.searchParams;
  assert.strictEqual(q.get('fuel'), 'D');
  assert.strictEqual(q.get('gear'), 'M');
  assert.strictEqual(q.get('priceto'), '6000');
  assert.strictEqual(q.get('fregfrom'), '2005');
  assert.strictEqual(q.get('kmto'), '250000');
  assert.strictEqual(q.get('body'), '6');
  assert.strictEqual(q.get('zip'), '16121');
  assert.strictEqual(q.get('powerfrom'), '110'); // 150 CV -> 110 kW
  assert.strictEqual(q.get('sort'), 'price');
  assert.strictEqual(q.get('cy'), 'I');
  assert.strictEqual(q.get('version'), 'aero');
});

test('AutoScout24: Europa ignora la regione', () => {
  const q = new URL(url('autoscout', Object.assign({}, full, { europe: true }))).searchParams;
  assert.ok(q.get('cy').split(',').includes('D'));
  assert.strictEqual(q.get('zip'), null);
});

test('AutoScout24: slug speciali', () => {
  assert.ok(url('autoscout', { make: 'Ford', model: 'Ka' }).includes('/lst/ford/ka-ka+'));
  assert.ok(url('autoscout', { make: 'Mercedes-Benz', model: 'Classe C' }).includes('/lst/mercedes-benz/classe-c'));
});

test('Subito: regione, testo e codici filtro', () => {
  const u = new URL(url('subito', full));
  assert.strictEqual(u.pathname, '/annunci-liguria/vendita/auto/');
  const q = u.searchParams;
  assert.strictEqual(q.get('q'), 'Saab 9-3 aero');
  assert.strictEqual(q.get('fl'), '2');
  assert.strictEqual(q.get('gr'), '1');
  assert.strictEqual(q.get('ps'), '1000');
  assert.strictEqual(q.get('ye'), '2011');
  assert.strictEqual(q.get('order'), 'priceasc');
  assert.strictEqual(q.get('hps'), '150');
});

test('AutoSuperMarket e Automobile.it: slug', () => {
  const a = new URL(url('autosupermarket', full));
  assert.strictEqual(a.pathname, '/auto-usate/liguria/saab/9-3');
  assert.strictEqual(a.searchParams.get('alimentazione'), 'diesel');
  assert.strictEqual(a.searchParams.get('km-a'), '250000');
  assert.strictEqual(url('automobile', full), 'https://www.automobile.it/saab-9_3-liguria');
  assert.strictEqual(url('automobile', { make: 'Alfa Romeo', model: '147' }), 'https://www.automobile.it/alfa_romeo-147');
  assert.strictEqual(url('ilparking', { make: 'Mercedes-Benz', model: 'Classe C' }), 'https://www.ilparking.it/auto-occasione/mercedes-classe-c.html');
});

test('ricerca vuota: nessun filtro, link validi', () => {
  for (const p of S.plan({})) {
    assert.ok(/^https:\/\//.test(p.url), p.site.id);
    assert.strictEqual(p.total, 0);
  }
});

test('filtri mancanti segnalati', () => {
  const am = S.plan(full).find((p) => p.site.id === 'automobile');
  assert.ok(am.missing.includes('prezzo'));
  assert.ok(am.missing.includes('km'));
  const as = S.plan(full).find((p) => p.site.id === 'autoscout');
  assert.deepStrictEqual(as.missing, []);
});

test('ogni modello della roulette esiste nella lista marche', () => {
  for (const c of D.ROULETTE) {
    const mk = D.MAKES.find((m) => m.n === c.make);
    assert.ok(mk, c.make);
    assert.ok(mk.m.includes(c.model), c.make + ' ' + c.model);
  }
});

test('AutoSuperMarket: eccezioni slug', () => {
  assert.ok(url('autosupermarket', { make: 'Mercedes-Benz', model: 'Classe C' }).endsWith('/auto-usate/mercedes/classe-c'));
  assert.ok(url('autosupermarket', { make: 'Audi', model: 'RS3' }).endsWith('/auto-usate/audi/rs-3'));
  const p = S.plan({ make: 'Citroen', model: 'DS3' }).find((x) => x.site.id === 'autosupermarket');
  assert.ok(p.url.endsWith('/auto-usate/citroen'));
  assert.deepStrictEqual(p.missing, ['modello']);
});

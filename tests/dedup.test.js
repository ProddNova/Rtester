const test = require('node:test');
const assert = require('node:assert');
const X = require('../js/dedup.js');

test('stesso annuncio Subito con link diversi = stessa chiave', () => {
  const a = X.listingKey('https://www.subito.it/auto/saab-9-3-vector-genova-571234567.htm');
  const b = X.listingKey('https://m.subito.it/auto/saab-9-3-vector-genova-571234567.htm?utm_source=share#foto');
  assert.strictEqual(a, 'subito:571234567');
  assert.strictEqual(a, b);
});

test('AutoScout24: chiave = UUID annuncio', () => {
  const k = X.listingKey('https://www.autoscout24.it/annunci/saab-9-3-1-9-tid-vector-diesel-grigio-1b2c3d4e-1111-2222-3333-444455556666?source=x');
  assert.strictEqual(k, 'autoscout:1b2c3d4e-1111-2222-3333-444455556666');
});

test('link generico: niente query, niente slash finale, niente www', () => {
  assert.strictEqual(X.listingKey('https://www.esempio.it/Auto/123/?a=1'), X.listingKey('http://esempio.it/auto/123'));
});

test('estrae il link da un testo condiviso', () => {
  assert.strictEqual(X.extractUrl('Guarda questa! https://www.subito.it/auto/x-571234567.htm.'), 'https://www.subito.it/auto/x-571234567.htm');
});

test('titolo dallo slug', () => {
  assert.strictEqual(X.titleFromUrl('https://www.subito.it/auto/saab-9-3-vector-genova-571234567.htm'), 'Saab 9-3 Vector Genova');
});

test('estrae prezzo, km e anno', () => {
  assert.deepStrictEqual(X.parseDetails('Saab 9-3 Vector 2007 - 4.500 € - 210.000 km'), { price: 4500, km: 210000, year: 2007 });
  assert.deepStrictEqual(X.parseDetails('€ 12.900, anno 2015, 98000km'), { price: 12900, km: 98000, year: 2015 });
});

test('stessa auto su due siti = probabile doppione', () => {
  const a = { key: 'subito:1', title: 'Saab 9-3 1.9 TiD Vector SportWagon', price: 4500, km: 210000, year: 2007 };
  const b = { key: 'autoscout:x', title: 'SAAB 9-3 Sport Wagon 1.9 TiD Vector', price: 4490, km: 210500, year: 2007 };
  assert.ok(X.sameCar(a, b) > 0.5);
  const d = X.findDuplicate([a], b);
  assert.strictEqual(d.type, 'probable');
});

test('auto diverse non sono doppioni', () => {
  const a = { title: 'Saab 9-3 Vector', price: 4500, km: 210000, year: 2007 };
  assert.strictEqual(X.sameCar(a, { title: 'Saab 9-3 Vector', price: 4500, km: 150000, year: 2007 }), 0);
  assert.strictEqual(X.sameCar(a, { title: 'Saab 9-3 Vector', price: 6000, km: 210000, year: 2007 }), 0);
  assert.strictEqual(X.sameCar(a, { title: 'Saab 9-3 Vector', price: 4500, km: 210000, year: 2009 }), 0);
  assert.strictEqual(X.sameCar(a, { title: 'Fiat Panda 4x4', price: 4500, km: 210000, year: 2007 }), 0);
});

test('unione bacheche: niente doppioni, voti uniti', () => {
  const url = 'https://www.subito.it/auto/saab-9-3-571234567.htm';
  const mine = [{ url, key: X.listingKey(url), title: 'Saab', price: 4500, votes: { a: { v: 1, t: 10 }, b: null }, addedAt: 1 }];
  const code = X.encodeBoard([
    { url: url + '?x=1', title: 'Saab', price: 4500, votes: { a: null, b: { v: 1, t: 20 } }, addedAt: 2 },
    { url: 'https://www.autoscout24.it/annunci/fiat-panda-1b2c3d4e-1111-2222-3333-444455556666', title: 'Fiat Panda', price: 3000, km: 90000, year: 2012, addedAt: 3 }
  ], 'Socio');
  const inc = X.decodeBoard(code);
  assert.strictEqual(inc.from, 'Socio');
  const r = X.mergeBoards(mine, inc.list);
  assert.strictEqual(r.list.length, 2);
  assert.strictEqual(r.stats.merged, 1);
  assert.strictEqual(r.stats.added, 1);
  assert.strictEqual(r.list[0].votes.a.v, 1);
  assert.strictEqual(r.list[0].votes.b.v, 1);
});

test('codifica con caratteri speciali', () => {
  const code = X.encodeBoard([{ url: 'https://x.it/a', title: 'Citroën Coupé €', note: 'perché sì 🔥' }], 'Giò');
  const d = X.decodeBoard(code);
  assert.strictEqual(d.list[0].title, 'Citroën Coupé €');
  assert.strictEqual(d.list[0].note, 'perché sì 🔥');
  assert.ok(/^[A-Za-z0-9_-]+$/.test(code));
});

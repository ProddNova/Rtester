const test = require('node:test');
const assert = require('node:assert');
const { spread, rng, RARE } = require('../server/feed');
const { quiet } = require('../server/keepalive');

test('feed: mai due annunci di fila dello stesso modello (quando si può)', () => {
  const items = [];
  ['Audi TT', 'Audi TT', 'Audi TT', 'Golf GTI', 'Golf GTI', 'Mazda MX-5', 'Mazda MX-5', 'Saab 900', 'Fiat Coupe'].forEach((t, i) => items.push({ title: t, key: 'k' + i }));
  const out = spread(items, rng(42));
  assert.strictEqual(out.length, items.length);
  for (let i = 1; i < out.length; i++) assert.notStrictEqual(out[i].title, out[i - 1].title, 'di fila: ' + out[i].title);
});

test('feed: stesso seme = stesso ordine, seme diverso = ordine diverso', () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepStrictEqual(sa, sb);
  assert.notDeepStrictEqual(sa, sc);
  assert.ok(RARE.length >= 40);
});

test('tieni sveglio: pausa dalle 3 alle 8 ora italiana', () => {
  assert.strictEqual(quiet(new Date('2026-07-01T01:30:00Z')), true);  // 3:30 ora legale
  assert.strictEqual(quiet(new Date('2026-07-01T05:59:00Z')), true);  // 7:59
  assert.strictEqual(quiet(new Date('2026-07-01T06:00:00Z')), false); // 8:00
  assert.strictEqual(quiet(new Date('2026-12-01T06:30:00Z')), true);  // 7:30 ora solare
  assert.strictEqual(quiet(new Date('2026-12-01T20:00:00Z')), false); // 21:00
});

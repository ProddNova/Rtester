const test = require('node:test');
const assert = require('node:assert');
const L = require('../public/js/lang.js');
const { chunks } = require('../server/translate');
const S = require('../public/js/sites.js');

test('riconosce la lingua degli annunci', () => {
  assert.strictEqual(L.detect('Sehr gepflegtes Fahrzeug mit Scheckheft und neuem TÜV, die Kupplung ist neu'), 'de');
  assert.strictEqual(L.detect('Véhicule en très bon état avec carnet d\'entretien et pneus neufs pour le client'), 'fr');
  assert.strictEqual(L.detect('Vendo auto in ottime condizioni con tagliandi certificati e gomme nuove'), 'it');
  assert.strictEqual(L.detect('Clima, cerchi, navi'), 'it', 'testi corti: italiano');
});

test('la traduzione spezza i testi lunghi in pezzi da max 450 caratteri', () => {
  const text = ('Das Auto ist sehr gut. '.repeat(60)) + '\n' + 'x'.repeat(1000);
  const c = chunks(text);
  assert.ok(c.length > 3);
  assert.ok(c.every((p) => p.length <= 450));
  assert.strictEqual(c.join('').replace(/\s/g, '').length, text.replace(/\s/g, '').length);
});

test('AutoScout24: codici esatti per marca e modello singolo, nomi per le gamme', () => {
  const url = (s) => S.plan(s).find((p) => p.site.id === 'autoscout').url;
  assert.ok(url({ make: 'BMW', model: '320' }).includes('mmmv=13%7C1641%7C%7C'));
  assert.ok(url({ make: 'BMW', model: 'M3' }).includes('/lst/bmw/m3?'));
  assert.ok(url({ make: 'BMW' }).includes('mmmv=13%7C%7C%7C'));
  assert.ok(url({ make: 'BMW', model: 'Serie 3' }).includes('/lst/bmw/serie-3?'));
  assert.ok(url({ make: 'Saab', model: '9-3' }).includes('/lst/saab/9-3?'));
});

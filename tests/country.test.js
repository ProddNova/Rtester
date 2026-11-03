const test = require('node:test');
const assert = require('node:assert/strict');
const { code } = require('../public/js/country');

test('paese: la posizione prevale sul dominio del portale', () => {
  assert.equal(code({ country: 'de', url: 'https://www.autoscout24.it/annunci/a' }), 'DE');
  assert.equal(code({ country: 'Belgium', url: 'https://www.marktplaats.nl/v/auto-s/a' }), 'BE');
  assert.equal(code({ city: 'Vienna, AT', url: 'https://www.autoscout24.it/annunci/a' }), 'AT');
  assert.equal(code({ url: 'https://www.autoscout24.it/annunci/a' }), '');
});

test('paese: portali nazionali, dati mancanti e codici non validi', () => {
  assert.equal(code({ url: 'https://www.subito.it/auto/a.htm' }), 'IT');
  assert.equal(code({ url: 'https://www.kleinanzeigen.de/s-anzeige/a' }), 'DE');
  assert.equal(code({ url: 'https://www.marktplaats.nl/v/auto-s/a' }), 'NL');
  assert.equal(code({ country: '<script>', url: 'bad' }), '');
  assert.equal(code({ country: 'ZZ' }), '');
  assert.equal(code(), '');
});

const test = require('node:test');
const assert = require('node:assert');
const P = require('../public/js/parse.js');

const cases = [
  ['saab 9-3 aero', { make: 'Saab', model: '9-3', kw: 'aero' }],
  ['saab 93 vector tid diesel', { make: 'Saab', model: '9-3', kw: 'vector tid', fuel: 'diesel' }],
  ['vw golf gti', { make: 'Volkswagen', model: 'Golf', kw: 'gti' }],
  ['golf r32', { make: 'Volkswagen', model: 'Golf', kw: 'r32' }],
  ['mx5', { make: 'Mazda', model: 'MX-5', kw: '' }],
  ['bmw 330ci', { make: 'BMW', model: 'Serie 3', kw: '330ci' }],
  ['mercedes c 220 cdi', { make: 'Mercedes-Benz', model: 'Classe C', kw: '220 cdi' }],
  ['toyota rav 4 ibrida automatica', { make: 'Toyota', model: 'RAV4', kw: '', fuel: 'ibrida', gear: 'automatico' }],
  ['range rover evoque', { make: 'Land Rover', model: 'Range Rover Evoque', kw: '' }],
  ['bmw serie3 sw sotto 5k', { make: 'BMW', model: 'Serie 3', kw: '', body: 'sw', pmax: 5000 }]
];

for (const [q, exp] of cases) {
  test('parse: ' + q, () => {
    const r = P.parseQuery(q);
    for (const k of Object.keys(exp)) assert.strictEqual(r[k], exp[k], k);
  });
}

test('suggest trova marca e modelli', () => {
  const labels = P.suggest('saab').map((x) => x.label);
  assert.ok(labels.includes('Saab'));
  assert.ok(labels.includes('Saab 9-3'));
});

test('testo vuoto', () => {
  assert.deepStrictEqual(P.parseQuery('   '), { make: '', model: '', kw: '' });
});

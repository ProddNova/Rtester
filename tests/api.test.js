// Prove sul server vero (senza internet): salvati condivisi, ricerche salvate, sicurezza.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cacciauto-test-'));
delete process.env.UPSTASH_REDIS_REST_URL;
const server = require('../server');
const { sourceFor } = require('../server/detail');

let base;
test.before(() => new Promise((ok) => server.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; ok(); })));
test.after(() => new Promise((ok) => server.close(ok)));

const post = (p, body, type) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': type || 'application/json' }, body: JSON.stringify(body) });

test('salvati: aggiungi, niente doppioni, nota, rimuovi', async () => {
  const url = 'https://www.autoscout24.it/annunci/saab-9-3-1b2c3d4e-1111-2222-3333-444455556666';
  let r = await post('/api/saved', { action: 'add', item: { url, title: 'Saab 9-3', price: 4500, image: 'javascript:alert(1)' } });
  assert.strictEqual(r.status, 200);
  let j = await r.json();
  assert.strictEqual(j.items.length, 1);
  assert.strictEqual(j.items[0].key, 'autoscout:1b2c3d4e-1111-2222-3333-444455556666');
  assert.strictEqual(j.items[0].image, '', 'immagine non https scartata');
  j = await (await post('/api/saved', { action: 'add', item: { url: url + '?utm=x', title: 'doppione' } })).json();
  assert.strictEqual(j.items.length, 1, 'stesso annuncio non duplicato');
  j = await (await post('/api/saved', { action: 'note', key: j.items[0].key, note: 'da vedere' })).json();
  assert.strictEqual(j.items[0].note, 'da vedere');
  j = await (await fetch(base + '/api/saved')).json();
  assert.strictEqual(j.items.length, 1);
  j = await (await post('/api/saved', { action: 'remove', key: j.items[0].key })).json();
  assert.strictEqual(j.items.length, 0);
});

test('salvati: link non validi e richieste non JSON rifiutati', async () => {
  let r = await post('/api/saved', { action: 'add', item: { url: 'javascript:alert(1)' } });
  assert.strictEqual(r.status, 400);
  r = await post('/api/saved', { action: 'add', item: { url: 'https://x.it/a' } }, 'text/plain');
  assert.strictEqual(r.status, 415);
  r = await post('/api/saved', { action: 'boh' });
  assert.strictEqual(r.status, 400);
});

test('ricerche salvate condivise', async () => {
  let j = await (await post('/api/searches', { action: 'add', name: 'Saab diesel', search: { make: 'Saab', fuel: 'diesel', 'bad key!': 'x' } })).json();
  assert.strictEqual(j.items[0].name, 'Saab diesel');
  assert.deepStrictEqual(j.items[0].search, { make: 'Saab', fuel: 'diesel' });
  j = await (await post('/api/searches', { action: 'remove', id: j.items[0].id })).json();
  assert.strictEqual(j.items.length, 0);
});

test('dettaglio: solo siti ammessi (niente richieste verso indirizzi qualsiasi)', async () => {
  for (const bad of ['http://127.0.0.1:22/', 'https://evil.example/annunci/x', 'file:///etc/passwd', 'https://www.autoscout24.it/lst/saab']) {
    const r = await (await fetch(base + '/api/ad?url=' + encodeURIComponent(bad))).json();
    assert.ok(r.error || r.external, bad);
    assert.ok(!r.ad, bad);
  }
  assert.strictEqual(sourceFor(new URL('https://www.autoscout24.it/annunci/saab-x')), 'autoscout');
  assert.strictEqual(sourceFor(new URL('https://autosupermarket.it/annunci/saab-abc')), 'autosupermarket');
  assert.strictEqual(sourceFor(new URL('https://www.automobile.it/racconigi-saab/184584072')), 'automobile');
  assert.strictEqual(sourceFor(new URL('https://www.subito.it/auto/x-1.htm')), null);
});

test('file statici e percorsi fuori cartella', async () => {
  assert.strictEqual((await fetch(base + '/')).status, 200);
  assert.strictEqual((await fetch(base + '/js/app.js')).status, 200);
  assert.strictEqual((await fetch(base + '/%2e%2e/package.json')).status, 404);
  assert.strictEqual((await fetch(base + '/api/health')).status, 200);
});

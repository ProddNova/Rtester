// Prove sul server vero (senza internet): salvati condivisi, ricerche salvate, sicurezza.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'autohunter-test-'));
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

test('salvati: un telefono rimette a posto quello che il server ha perso (senza resuscitare i cancellati)', async () => {
  const a = { url: 'https://www.subito.it/auto/saab-9-3-genova-111111111.htm', title: 'Saab A', price: 3000, savedAt: Date.now() - 5000, history: [{ p: 3500, t: Date.now() - 9000 }, { p: 3000, t: Date.now() - 5000 }], note: 'bella' };
  const b = { url: 'https://www.subito.it/auto/saab-9-3-genova-222222222.htm', title: 'Saab B', price: 2000, savedAt: Date.now() - 5000 };
  let j = await (await post('/api/saved', { action: 'restore', items: [a, b], tomb: { 'subito:222222222': Date.now() } })).json();
  assert.deepStrictEqual(j.items.map((x) => x.title), ['Saab A'], 'B era stato cancellato dopo il salvataggio');
  assert.strictEqual(j.items[0].history.length, 2, 'storico prezzi conservato');
  assert.strictEqual(j.items[0].note, 'bella');
  assert.ok(j.bootId);
  // un secondo telefono con un'altra auto: si uniscono
  const c = { url: 'https://www.subito.it/auto/saab-9-5-genova-333333333.htm', title: 'Saab C', price: 5000, savedAt: Date.now() };
  j = await (await post('/api/saved', { action: 'restore', items: [a, c] })).json();
  assert.deepStrictEqual(j.items.map((x) => x.title).sort(), ['Saab A', 'Saab C']);
  // rimozione: lascia la "tomba" e un ripristino vecchio non la fa ricomparire
  j = await (await post('/api/saved', { action: 'remove', key: 'subito:333333333' })).json();
  j = await (await post('/api/saved', { action: 'restore', items: [c] })).json();
  assert.deepStrictEqual(j.items.map((x) => x.title), ['Saab A']);
  // ma se lo salvo di nuovo ricompare
  j = await (await post('/api/saved', { action: 'add', item: c })).json();
  assert.ok(j.items.some((x) => x.title === 'Saab C'));
});

test('ricerche salvate: ripristino dal telefono', async () => {
  const j = await (await post('/api/searches', { action: 'restore', items: [{ id: 'abc123', name: 'Saab', search: { make: 'Saab' }, savedAt: Date.now() - 1000 }] })).json();
  assert.ok(j.items.some((x) => x.id === 'abc123' && x.search.make === 'Saab'));
});

test('compressione gzip delle risposte grandi', async () => {
  const r = await fetch(base + '/js/models.js', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('content-encoding'), 'gzip');
  assert.ok((await r.text()).includes('CA_MODELS'));
});

test('ban list: parte con Abarth 500, si aggiunge e si toglie, le cancellazioni restano', async () => {
  let j = await (await fetch(base + '/api/bans')).json();
  assert.deepStrictEqual(j.items.map((b) => b.id), ['abarth|500']);
  j = await (await post('/api/bans', { action: 'add', make: 'Fiat', model: 'Multipla' })).json();
  assert.deepStrictEqual(j.items.map((b) => b.make + ' ' + b.model), ['Fiat Multipla', 'Abarth 500']);
  let r = await post('/api/bans', { action: 'add', make: 'Fiat' });
  assert.strictEqual(r.status, 400, 'serve il modello preciso');
  j = await (await post('/api/bans', { action: 'remove', id: 'abarth|500' })).json();
  assert.deepStrictEqual(j.items.map((b) => b.id), ['fiat|multipla']);
  // un telefono con la copia vecchia non fa ricomparire l'Abarth tolto
  j = await (await post('/api/bans', { action: 'restore', items: [{ id: 'abarth|500', make: 'Abarth', model: '500', savedAt: 1 }], tomb: {} })).json();
  assert.deepStrictEqual(j.items.map((b) => b.id), ['fiat|multipla']);
});

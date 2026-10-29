const test = require('node:test');
const assert = require('node:assert');
const AS = require('../server/sources/autoscout');
const ASM = require('../server/sources/autosupermarket');
const AM = require('../server/sources/automobile');
const { matches, mergeDuplicates, cleanSearch, sortItems } = require('../server/search');
const { normFuel } = require('../server/sources/common');

// Pagine finte con la stessa struttura di quelle vere (ridotte all'osso).
const next = (props) => '<html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: props } }) + '</script></html>';

test('AutoScout24: legge gli annunci dal JSON della pagina', () => {
  const html = next({
    numberOfResults: 42, numberOfPages: 3,
    listings: [{
      id: 'abc', url: '/annunci/saab-9-3-abc', images: ['https://img/x.jpg/250x188.webp'],
      price: { priceRaw: 4500 }, vehicle: { make: 'Saab', model: '9-3', modelVersionInput: '1.9 TiD Vector', fuel: 'Diesel', transmission: 'Manuale' },
      tracking: { mileage: '210000', firstRegistration: '05-2007', price: '4500' },
      vehicleDetails: [{ iconName: 'speedometer', data: '110 kW (150 CV)' }],
      location: { city: 'Genova', countryCode: 'IT' }, seller: { type: 'PrivateSeller' }
    }]
  });
  const r = AS.parse(html);
  assert.strictEqual(r.total, 42);
  assert.strictEqual(r.pages, 3);
  const it = r.items[0];
  assert.strictEqual(it.url, 'https://www.autoscout24.it/annunci/saab-9-3-abc');
  assert.deepStrictEqual([it.price, it.km, it.year, it.fuel, it.gear, it.cv, it.seller], [4500, 210000, 2007, 'diesel', 'manuale', 150, 'privato']);
  assert.strictEqual(it.image, 'https://img/x.jpg/480x360.webp');
  assert.strictEqual(AS.url({ make: 'Saab', model: '9-3' }, 2).endsWith('&page=2'), true);
});

test('AutoSuperMarket: legge le card HTML', () => {
  const card = (id, price) => '<a class="x" href="https://autosupermarket.it/annunci/saab-9-3-diesel-2009-' + id + '"><span>Apri scheda auto Saab 9-3 - 1.9 TTiD</span></a>' +
    '<div><img src="https://imgproxy.autosupermarket.it/a.jpg"><span>1 / 18</span><span>' + price + '</span><span>€</span><span>Rivenditore</span>' +
    '<span>Saab 9-3</span><span>SportHatch 1.9 TTiD Vector</span><dt>Chilometri</dt><dd>169.000 km</dd><dt>Cambio</dt><dd>Manuale</dd>' +
    '<dt>Alimentazione</dt><dd>Diesel</dd><dt>Immatricolazione</dt><dd>Ottobre 2009</dd><dt>Motore</dt><dd>133kW (181 CV)</dd><span>Cassino (FR)</span></div>';
  const html = '<title>Saab 9-3 usate: 37 annunci da 1.300 €</title>' + card('8a07cdf0d9d468e9', '4.900') + card('1234567890abcdef', '12.000');
  const r = ASM.parse(html);
  assert.strictEqual(r.items.length, 2);
  assert.strictEqual(r.total, 37);
  assert.strictEqual(r.pages, 2);
  const it = r.items[0];
  assert.deepStrictEqual([it.title, it.version, it.price, it.km, it.year, it.fuel, it.gear, it.cv, it.city, it.photos],
    ['Saab 9-3', 'SportHatch 1.9 TTiD Vector', 4900, 169000, 2009, 'diesel', 'manuale', 181, 'Cassino (FR)', 18]);
  assert.strictEqual(it.key, 'autosupermarket:8a07cdf0d9d468e9');
});

test('Automobile.it: legge resultList', () => {
  const html = next({ apiResults: { result: { page: 1, pagination: { last: { pageNumber: 4 } }, resultList: [{
    id: 99, title: 'Saab 9-3 2.2 TiD', formattedPrice: '€ 1.900', location: 'Racconigi (CN)', url: '/racconigi-saab/99', sellerType: 'PRIVATE',
    details: { registration: 'Gennaio 2003', fuelEmissions: 'Diesel - Euro 3', formattedKm: '190.000 km', formattedPower: '125 CV (92 KW)', shift: 'Manuale' },
    firstMediumSizeImage: 'https://media/x?rule=ad-372.jpeg', totalNumberOfPictures: 6, shortDescription: ''
  }] } } });
  const r = AM.parse(html);
  assert.strictEqual(r.pages, 4);
  const it = r.items[0];
  assert.deepStrictEqual([it.price, it.km, it.year, it.fuel, it.cv, it.seller, it.url], [1900, 190000, 2003, 'diesel', 125, 'privato', 'https://www.automobile.it/racconigi-saab/99']);
  assert.strictEqual(AM.url({ make: 'Saab', model: '9-3' }, 3), 'https://www.automobile.it/saab-9_3/page-3');
});

test('pagina vuota o diversa: nessun annuncio, nessun crash', () => {
  for (const src of [AS, ASM, AM]) assert.deepStrictEqual(src.parse('<html>niente</html>').items, []);
  assert.deepStrictEqual(ASM.parse('').items, []);
});

test('alimentazione normalizzata', () => {
  assert.strictEqual(normFuel('Benzina/GPL'), 'gpl');
  assert.strictEqual(normFuel('Benzina/Metano'), 'metano');
  assert.strictEqual(normFuel('Elettrica/Benzina'), 'ibrida');
  assert.strictEqual(normFuel('Mild Hybrid Diesel'), 'ibrida');
  assert.strictEqual(normFuel('Elettrica'), 'elettrica');
  assert.strictEqual(normFuel('Diesel - Euro 5'), 'diesel');
});

test('filtri applicati lato server', () => {
  const it = { title: 'Saab 9-3', version: '1.9 TiD Vector', price: 4500, km: 210000, year: 2007, fuel: 'diesel', gear: 'manuale', cv: 150 };
  const s = (o) => cleanSearch(Object.assign({ make: 'Saab', model: '9-3' }, o));
  assert.ok(matches(it, s({ pmax: '5000', fuel: 'diesel' }), 'autoscout'));
  assert.ok(!matches(it, s({ pmax: '4000' }), 'autoscout'));
  assert.ok(!matches(it, s({ kmmax: '200000' }), 'autoscout'));
  assert.ok(!matches(it, s({ ymin: '2008' }), 'autoscout'));
  assert.ok(!matches(it, s({ fuel: 'benzina' }), 'autoscout'));
  assert.ok(matches(it, s({ kw: 'vector' }), 'autoscout'));
  assert.ok(!matches(it, s({ kw: 'aero' }), 'autoscout'));
  // dato mancante = non escluso
  assert.ok(matches(Object.assign({}, it, { km: null }), s({ kmmax: '100000' }), 'autoscout'));
});

test('la stessa auto su due siti diventa un annuncio solo', () => {
  const a = { key: 'autoscout:1', site: 'autoscout', url: 'https://as/1', title: 'Saab 9-3', version: 'SportWagon 1.9 TiD Vector', price: 4500, km: 210000, year: 2007 };
  const b = { key: 'autosupermarket:2', site: 'autosupermarket', url: 'https://asm/2', title: 'Saab 9-3', version: '9-3 SportWagon 1.9 TiD Vector', price: 4490, km: 210500, year: 2007 };
  const c = { key: 'automobile:3', site: 'automobile', url: 'https://am/3', title: 'Saab 9-3 1.9 TiD', version: '', price: 2500, km: 300000, year: 2005 };
  const out = mergeDuplicates([a, b, c]);
  assert.strictEqual(out.length, 2);
  assert.deepStrictEqual(out[0].also.map((x) => x.site), ['autosupermarket']);
  assert.deepStrictEqual(sortItems(out, 'prezzo').map((x) => x.price), [2500, 4500]);
});

test('cleanSearch ignora campi sconosciuti', () => {
  const s = cleanSearch({ make: 'Saab', evil: 'x', pmax: 5000 });
  assert.strictEqual(s.evil, undefined);
  assert.strictEqual(s.pmax, '5000');
  assert.strictEqual(s.sort, 'rilevanza');
});

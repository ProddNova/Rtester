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

const TV = require('../server/sources/trovit');

test('Trovit: URL con filtri e lettura card', () => {
  const u = TV.url({ make: 'Saab', model: '9-3', pmax: '6000', ymin: '2005', kmmax: '200000', sort: 'prezzo' }, 2);
  assert.strictEqual(u, 'https://auto.trovit.it/index.php/cod.search_cars/what_d.Saab%209-3/price_max.6000/year_min.2005/mileage_max.200000/order_by.price/page.2');
  const card = (id, price) => '<div class="item js-item " data-id="' + id + '" data-test="results-item"> <a rel="nofollow" class="rd-link" href="https://rd.clk.thribee.com/id.' + id + '/origin.1/"> <div class="image"> <img src="//img-it-2.trovit.com/' + id + '/x.jpg" alt=""/> <div class="agency_name_container "> <span> </span> </div></div>' +
    '<div class="item-content"> <h2><strong>Saab</strong> <strong>9</strong>-<strong>3</strong> Cabriolet 1.8 150CV</h2> <div class="price"> <meta content="' + price + '"/> <span class="currency">5.900€</span> </div> <small class="date">3 giorni fa</small>' +
    '<ul class="info"> <li class="info-item"> <span>172.000</span> <br>Kms </li> <li class="info-item"> <span>2005</span> <br>Anno </li> </ul></div></a></div>' +
    '<div class="extended-description"><div class="extended-description__content"> <p>Privato vende saab benzina</p></div></div>';
  const r = TV.parse('<div>111 risultati</div>' + card('QVQg1t1hc1o', 5900) + card('AbC', 900));
  assert.strictEqual(r.items.length, 2);
  assert.strictEqual(r.pages, 5);
  const it = r.items[0];
  assert.deepStrictEqual([it.key, it.price, it.km, it.year, it.cv, it.fuel, it.seller, it.image], ['trovit:QVQg1t1hc1o', 5900, 172000, 2005, 150, 'benzina', 'privato', 'https://img-it-2.trovit.com/QVQg1t1hc1o/x.jpg']);
  assert.ok(Date.now() - it.posted > 2.9 * 86400000);
  assert.strictEqual(TV.when('11 ore 20 minuti fa') < Date.now() - 10 * 3600000, true);
});

test('dettaglio AutoScout24: foto, dotazioni, venditore, valutazione', () => {
  const html = next({ listingDetails: {
    status: 'Active', description: 'Tagliandata<br />l&#x27;auto è ok', images: ['https://img/1.webp', 'https://img/2.webp'],
    prices: { public: { priceRaw: 8900, negotiable: true, median: 10300, category: 1 } },
    vehicle: { make: 'Saab', model: '9-3', modelVersionInput: 'Cabrio 1.9 tid', mileageInKmRaw: 75000, firstRegistrationDateRaw: '2010-05-01', firstRegistrationDate: '05/2010',
      fuelCategory: { formatted: 'Diesel' }, transmissionType: 'Manuale', gears: 6, rawPowerInHp: 150, rawPowerInKw: 110, bodyColor: 'Blu', equipment: { comfort: [{ id: 'Clima' }, { id: 'Cruise' }] } },
    seller: { isDealer: true, companyName: 'Auto X', phones: [{ formattedNumber: '+39 340 1', callTo: '+393401' }] },
    location: { zip: '10090', city: 'Torino' }, createdTimestampWithOffset: '2026-09-11T07:45:30.493Z'
  } });
  const d = AS.detail(html);
  assert.strictEqual(d.description, "Tagliandata\nl'auto è ok");
  assert.deepStrictEqual([d.price, d.km, d.year, d.cv, d.fuel, d.gearLabel], [8900, 75000, 2010, 150, 'diesel', 'Manuale, 6 marce']);
  assert.deepStrictEqual(d.equipment, ['Clima', 'Cruise']);
  assert.deepStrictEqual(d.market, { median: 10300, deal: 1, source: 'AutoScout24' });
  assert.strictEqual(d.seller.phones[0].tel, '+393401');
  assert.strictEqual(d.photos.length, 2);
  assert.strictEqual(AS.detail('<html></html>'), null);
});

test('dettaglio AutoSuperMarket dal JSON-LD', () => {
  const car = { '@type': ['Product', 'Car'], name: 'Saab 9-3', vehicleConfiguration: ' SportHatch 1.9 TTiD', mileageFromOdometer: { value: 169000 }, vehicleModelDate: '2009-10-01',
    vehicleEngine: [{ enginePower: [{ value: 181, unitCode: 'BHP' }, { value: 133, unitCode: 'KWT' }], fuelType: 'Diesel' }], vehicleTransmission: 'Manuale',
    description: 'Riga 1\nRiga 2', offers: { price: 4900, availabilityStarts: '2026-05-13T03:28:52+02:00', availability: 'https://schema.org/InStock', seller: { '@type': 'LocalBusiness', name: 'Gruppo Melei', address: { addressLocality: 'Cassino', postalCode: '03043' } } } };
  const html = '<title>Saab</title><script type="application/ld+json">' + JSON.stringify(car) + '</script>' +
    '<img src="https://cdn.autosupermarket.it/photos/prod/1/aa.jpg"><img src="https://cdn.autosupermarket.it/photos/prod/2/bb.jpg"><img src="https://cdn.autosupermarket.it/photos/prod/1/aa.jpg">';
  const d = ASM.detail(html);
  assert.deepStrictEqual([d.price, d.km, d.year, d.cv, d.kw, d.reg, d.description], [4900, 169000, 2009, 181, 133, '10/2009', 'Riga 1\nRiga 2']);
  assert.strictEqual(d.photos.length, 2);
  assert.strictEqual(d.seller.name, 'Gruppo Melei');
});

test('dettaglio Trovit: descrizione, scheda e foto grande', () => {
  const html = '<title>Saab 9-3 Cabrio Turbo s</title><div>Saab 9-3 Cabrio Turbo s</div><span>157.000</span><span>Kms</span><span>6.800€</span>' +
    '<h3>Descrizione</h3><p>Vendo Saab cabrio tel MOSTRA NUMERO</p><dl><dt>Marca</dt><dd>Saab</dd><dt>Anno</dt><dd>2003</dd><dt>Kilometraggio</dt><dd>157000</dd>' +
    '<dt>Tipo di cambio</dt><dd>Cambio manuale</dd><dt>Combustibile</dt><dd>Benzina</dd><dt>Potenza (cv)</dt><dd>149</dd></dl><a>Contattare l\'inserzionista</a>' +
    '<img src="//img-it-2.trovit.com/ABC1/ABC1.1_12.jpg"><h2>Annunci simili</h2><img src="//img-it-2.trovit.com/ZZZ/ZZZ.1_11.jpg">';
  const d = TV.detail(html, 'https://auto.trovit.it/listing/saab-93.ABC1');
  assert.deepStrictEqual([d.price, d.km, d.year, d.cv, d.fuel, d.gear], [6800, 157000, 2003, 149, 'benzina', 'manuale']);
  assert.strictEqual(d.description, 'Vendo Saab cabrio tel');
  assert.deepStrictEqual(d.photos, ['https://img-it-2.trovit.com/ABC1/ABC1.1_12.jpg']);
});

test('Trovit: foto anche quando src non è il primo attributo, e città', () => {
  const html = '<div>3 risultati</div><div class="item js-item " data-id="ZZ1"> <a rel="nofollow" class="rd-link" href="https://rd.clk.thribee.com/id.ZZ1/x/">' +
    '<div class="image"><img loading="lazy" class="is_higher " src="//img-it-2.trovit.com/ZZ1/ZZ1.1_11.jpg" alt="VW"/></div>' +
    '<div class="item-content"><h2><strong>Volkswagen</strong> <strong>Golf</strong></h2> <span class="address"><svg></svg>Udine</span>' +
    '<div class="price"> <meta content="7500"/></div><ul class="info"><li class="info-item"> <span>120.000</span> <br>Kms </li></ul></div></a></div>';
  const it = TV.parse(html).items[0];
  assert.strictEqual(it.image, 'https://img-it-2.trovit.com/ZZ1/ZZ1.1_11.jpg');
  assert.strictEqual(it.city, 'Udine');
});

// ---------------- siti esteri ----------------
const KA = require('../server/sources/kleinanzeigen');
const MP = require('../server/sources/marktplaats');
const { sourcesFor } = require('../server/search');
const { sourceFor } = require('../server/detail');

test('Kleinanzeigen: URL con filtri nel percorso', () => {
  assert.strictEqual(KA.url({ make: 'Mercedes-Benz', model: 'Classe C', pmax: '8000', ymin: '2005', fuel: 'diesel' }, 2),
    'https://www.kleinanzeigen.de/s-autos/seite:2/preis::8000/c-klasse/k0c216+autos.marke_s:mercedes_benz+autos.ez_i:2005%2C+autos.fuel_s:diesel');
  assert.strictEqual(KA.url({ make: 'BMW', model: 'Serie 3', kmmax: '150000', gear: 'automatico' }, 1),
    'https://www.kleinanzeigen.de/s-autos/3er/k0c216+autos.marke_s:bmw+autos.km_i:%2C150000+autos.shift_s:automatik');
  // marca che Kleinanzeigen non ha nel filtro: si cerca a parole
  assert.strictEqual(KA.url({ make: 'Alpine', model: 'A110' }, 1), 'https://www.kleinanzeigen.de/s-autos/alpine-a110/k0c216');
  assert.strictEqual(KA.url({ make: 'auto', pmax: '5000' }, 1), 'https://www.kleinanzeigen.de/s-autos/preis::5000/c216');
});

test('Kleinanzeigen: lettura lista (foto, km, anno, città) e scarta chi compra', () => {
  const card = (id, title, price, tags, extra) => `<li data-href="/s-anzeige/x-${id}/${id}-216-2110" class="j-adlistitem adlist--item" data-adid="${id}">
    <div class="adlist--item--imagebox"><img fetchpriority="high" loading="eager" src="https://img.kleinanzeigen.de/api/v1/prod-ads/images/60/abc?rule&#61;$_35.AUTO" alt="">
    <div class="has-image-count"> 12 </div></div>
    <div class="adlist--item--info"><div class="adlist--item--info--location"> Neuss </div><div class="adlist--item--info--date"> Heute, 13:58 </div></div>
    <strong class="adlist--item--boldtitle">${extra || `<a href="/s-anzeige/x-${id}/${id}-216-2110">${title}</a>`}</strong>
    <div class="long-description">Saab 9-3 Cabrio 145 PS Diesel</div>
    <div class="adlist--item--price">${price}</div>
    <div class="adlist--item--attributes">${tags.map((t) => `<span class="simpletag">${t}</span>`).join('')}</div></li>`;
  const html = '<h1>499 Ergebnisse</h1><ul>' +
    card('3499850245', 'Saab 9-3 Cabrio Vector', '9.200 € VB', ['107.354 km', 'EZ 05/2004']) +
    card('3499850246', 'Kaufe Saab 9-3 alle Modelle', '1 €', []) +
    card('3499850247', '', '1.500 €', ['387.000 km', 'EZ 10/2002'], '<span class="page-not-linked" data-url="/s-anzeige/pkw/3499850247-216-1">PKW saab 9-3</span>') +
    '</ul>';
  const r = KA.parse(html);
  assert.strictEqual(r.total, 499);
  assert.strictEqual(r.items.length, 2);
  const it = r.items[0];
  assert.deepStrictEqual([it.key, it.price, it.negotiable, it.km, it.year, it.cv, it.fuel, it.city, it.photos],
    ['kleinanzeigen:3499850245', 9200, true, 107354, 2004, 145, 'diesel', 'Neuss, DE', 12]);
  assert.strictEqual(it.image, 'https://img.kleinanzeigen.de/api/v1/prod-ads/images/60/abc?rule=$_35.AUTO');
  assert.ok(it.url.startsWith('https://www.kleinanzeigen.de/s-anzeige/'));
  assert.strictEqual(r.items[1].title, 'PKW saab 9-3');
  assert.ok(Math.abs(KA.when('Gestern, 10:00') - Date.now()) < 2 * 86400000);
});

test('Kleinanzeigen: pagina annuncio', () => {
  const html = `<title>Saab 9-3 Cabrio in Nordrhein-Westfalen - Neuss | kleinanzeigen.de</title>
    <script type="application/ld+json">{"@type":"Product","name":"Saab 9-3 Cabrio","offers":{"price":"9200"}}</script>
    <script type="application/ld+json">{"@type":"ImageObject","contentUrl":"https://img.kleinanzeigen.de/api/v1/prod-ads/images/60/a?rule&#61;$_59.AUTO"}</script>
    <script type="application/ld+json">{"@type":"ImageObject","contentUrl":"https://img.kleinanzeigen.de/api/v1/prod-ads/images/61/b?rule&#61;$_59.AUTO"}</script>
    <h1 class="ad-keydetails--ad-title" id="vip-ad-title"> Saab 9-3 Cabrio </h1>
    <div class="ad-keydetails--ad-price" id="vip-ad-price"> 9.200 € VB </div>
    <span>29.10.2026</span>
    <dl class="definition-list-addetails"><dt>Kilometerstand</dt><dd>107.354 km</dd><dt>Erstzulassung</dt><dd>Mai 2004</dd>
    <dt>Kraftstoffart</dt><dd>Benzin</dd><dt>Leistung</dt><dd>147 PS</dd><dt>Getriebe</dt><dd>Manuell</dd><dt>Anzahl Türen</dt><dd>2/3</dd></dl>
    <ul class="checktaglist"><li class="checktag">Klimaanlage</li><li class="checktag">Sitzheizung</li></ul>
    <p id="viewad-description-text" class="ad-keydetails--ad-description">Sehr gepflegt.<br />TÜV neu</p>
    <h2 class="userprofile-teaser--title"> Mario </h2><span class="userprofile-teaser--postertype">Privater Nutzer</span>`;
  const d = KA.detail(html);
  assert.deepStrictEqual([d.title, d.price, d.negotiable, d.km, d.year, d.fuel, d.gear, d.cv, d.doors], ['Saab 9-3 Cabrio', 9200, true, 107354, 2004, 'benzina', 'manuale', 147, 2]);
  assert.strictEqual(d.photos.length, 2);
  assert.strictEqual(d.description, 'Sehr gepflegt.\nTÜV neu');
  assert.deepStrictEqual(d.equipment, ['Klimaanlage', 'Sitzheizung']);
  assert.deepStrictEqual([d.seller.name, d.seller.type], ['Mario', 'privato']);
  assert.ok(d.posted);
});

test('Marktplaats: URL, lista dal JSON e pagina annuncio', () => {
  assert.deepStrictEqual(MP.urls({ make: 'Mercedes-Benz', model: 'Classe C' }, 2), [
    'https://www.marktplaats.nl/l/auto-s/mercedes-benz/q/C-Klasse/p/2/',
    { u: 'https://www.marktplaats.nl/l/auto-s/q/Mercedes-Benz+C-Klasse/p/2/', strict: true }
  ]);
  const html = next({ searchRequestAndResponse: { totalResultCount: 397, maxAllowedPageNumber: 14, listings: [
    { itemId: 'm2458326230', title: 'Saab 9-3 2.0 T 230 pk', vipUrl: '/v/auto-s/saab/m2458326230-saab-9-3', date: 'Vandaag',
      priceInfo: { priceCents: 645000, priceType: 'MIN_BID' }, location: { cityName: 'Tilburg', countryName: 'Nederland' },
      imageUrls: ['//images.marktplaats.com/x?rule=ecg_mp_eps$_82.jpg'],
      attributes: [{ key: 'constructionYear', value: '2009' }, { key: 'mileage', value: '157205' }, { key: 'fuel', value: 'Benzine' }, { key: 'transmission', value: 'Handgeschakeld' }] },
    { itemId: 'm1', title: 'Gezocht: Saab 9-3', vipUrl: '/v/auto-s/saab/m1-x', priceInfo: { priceCents: 100 }, location: {} },
    { itemId: 'm2', title: 'Saab 9-3 bieden', vipUrl: '/v/auto-s/saab/m2-x', priceInfo: { priceCents: 0, priceType: 'FAST_BID' }, location: {} }
  ] } });
  const r = MP.parse(html);
  assert.strictEqual(r.items.length, 1);
  const it = r.items[0];
  assert.deepStrictEqual([it.key, it.price, it.km, it.year, it.fuel, it.gear, it.cv, it.city], ['marktplaats:m2458326230', 6450, 157205, 2009, 'benzina', 'manuale', 230, 'Tilburg, NL']);
  assert.strictEqual(it.image, 'https://images.marktplaats.com/x?rule=ecg_mp_eps$_83.jpg');
  assert.strictEqual(r.pages, 14);

  const page = '<script>window.__CONFIG__ = ' + JSON.stringify({ listing: {
    title: 'Saab 9-3 2.0 T', priceInfo: { priceCents: 645000, priceType: 'FIXED' },
    gallery: { imageUrls: ['//images.marktplaats.com/a?rule=ecg_mp_eps$_#.jpg'] },
    carAttributes: { groupedWithIcons: [{ attributes: [{ key: 'constructionYear', value: 2009 }, { key: 'mileage', value: '157.205' }, { key: 'powerInHorsePower', value: 230 }, { key: 'fuel', value: 'Benzine' }] }] },
    seller: { name: 'MSC', sellerType: 'CONSUMER', location: { cityName: 'Tilburg', countryName: 'Nederland' } },
    stats: { since: '2026-10-26T13:21:58Z' }
  } }) + ';</script><div class="Description-module-description"><div data-collapsable="description">Mooie auto<br />APK 2027</div></div>';
  const d = MP.detail(page);
  assert.deepStrictEqual([d.price, d.km, d.year, d.cv, d.fuel, d.seller.type], [6450, 157205, 2009, 230, 'benzina', 'privato']);
  assert.deepStrictEqual(d.photos, ['https://images.marktplaats.com/a?rule=ecg_mp_eps$_85.jpg']);
  assert.strictEqual(d.description, 'Mooie auto\nAPK 2027');
});

test('zona: Italia, Italia + estero, solo estero', () => {
  const ids = (raw) => sourcesFor(cleanSearch(raw)).map((s) => s.id);
  assert.deepStrictEqual(ids({ area: 'it' }), ['autoscout', 'subito', 'autosupermarket', 'automobile', 'trovit']);
  assert.deepStrictEqual(ids({}), ['autoscout', 'subito', 'autosupermarket', 'automobile', 'trovit']);
  assert.deepStrictEqual(ids({ area: 'eu' }), ['autoscout', 'subito', 'autosupermarket', 'automobile', 'trovit', 'kleinanzeigen', 'marktplaats']);
  assert.deepStrictEqual(ids({ europe: true }), ids({ area: 'eu' }));
  assert.deepStrictEqual(ids({ area: 'estero' }), ['autoscout', 'kleinanzeigen', 'marktplaats']);
  // con una regione italiana si cerca solo in Italia
  assert.deepStrictEqual(ids({ area: 'eu', region: 'liguria' }), ids({ area: 'it' }));
  const SITES = require('../public/js/sites.js');
  const cy = (raw) => new URL(SITES.SITES.find((x) => x.id === 'autoscout').build(cleanSearch(raw))).searchParams.get('cy');
  assert.deepStrictEqual([cy({ area: 'it' }), cy({ area: 'eu' }), cy({ area: 'estero' })], ['I', 'D,A,B,E,F,I,L,NL', 'D,A,B,E,F,L,NL']);
});

test('dettaglio: link di Kleinanzeigen e Marktplaats ammessi, altri no', () => {
  assert.strictEqual(sourceFor(new URL('https://www.kleinanzeigen.de/s-anzeige/saab-9-3/3499850245-216-2110')), 'kleinanzeigen');
  assert.strictEqual(sourceFor(new URL('https://www.marktplaats.nl/v/auto-s/saab/m2458326230-saab-9-3-2-0-t')), 'marktplaats');
  assert.strictEqual(sourceFor(new URL('https://www.kleinanzeigen.de/m-meine-anzeigen.html')), null);
  assert.strictEqual(sourceFor(new URL('https://www.marktplaats.nl/u/msc/9567988/')), null);
});

test('alimentazione e cambio in tedesco e olandese', () => {
  const { normGear } = require('../server/sources/common');
  assert.deepStrictEqual(['Benzin', 'Benzine', 'Elektro', 'Hybride', 'Erdgas', 'Autogas (LPG)'].map(normFuel), ['benzina', 'benzina', 'elettrica', 'ibrida', 'metano', 'gpl']);
  assert.deepStrictEqual(['Manuell', 'Handgeschakeld', 'Automaat', 'Automatik'].map(normGear), ['manuale', 'manuale', 'automatico', 'automatico']);
});

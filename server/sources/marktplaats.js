// Marktplaats (Olanda): privati e concessionari, dati puliti nel JSON della pagina (__NEXT_DATA__).
// Nell'URL vanno solo marca, modello (a parole) e pagina: prezzo, anno, km ecc. li filtra CacciAuto.
const { num, normFuel, normGear, nextData, decode, plain, itWord } = require('./common');

const BASE = 'https://www.marktplaats.nl';
const PER_PAGE = 30;
const COUNTRY = { nederland: 'NL', belgie: 'BE', 'belgië': 'BE', duitsland: 'DE', deutschland: 'DE' };

function ascii(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function slug(s) { return ascii(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// Nomi italiani -> come li scrivono in Olanda
function dutchModel(model) {
  return String(model || '')
    .replace(/^Classe\s+([A-Z]{1,3})$/i, '$1-Klasse')
    .replace(/^Serie\s+(\d)$/i, '$1-Serie');
}

function q(words) {
  return words.filter(Boolean).join(' ').trim().split(/\s+/).filter(Boolean).map(encodeURIComponent).join('+');
}

function pageSeg(page) { return page > 1 ? 'p/' + page + '/' : ''; }

// Prima la categoria della marca (/l/auto-s/saab/); se Marktplaats non la conosce (404) si cerca a parole.
function urls(s, page) {
  const make = s.make === 'auto' ? '' : s.make;
  const words = q([dutchModel(s.model), s.kw]);
  if (!make) return [BASE + '/l/auto-s/' + (words ? 'q/' + words + '/' : '') + pageSeg(page)];
  return [
    BASE + '/l/auto-s/' + slug(make) + '/' + (words ? 'q/' + words + '/' : '') + pageSeg(page),
    { u: BASE + '/l/auto-s/q/' + q([make, dutchModel(s.model), s.kw]) + '/' + pageSeg(page), strict: true }
  ];
}
function url(s, page) { const u = urls(s, page)[0]; return typeof u === 'string' ? u : u.u; }

// "Vandaag" / "Gisteren" / "Eergisteren" / "27 okt '26" -> timestamp approssimativo
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function when(s) {
  const t = String(s || '').toLowerCase();
  const day = (d) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(12, 0, 0, 0); return x.getTime(); };
  if (t === 'vandaag') return day(0);
  if (t === 'gisteren') return day(1);
  if (t === 'eergisteren') return day(2);
  const m = t.match(/(\d{1,2})\s+([a-z]{3})\.?\s+'?(\d{2,4})/);
  if (m && MONTHS.includes(m[2])) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], MONTHS.indexOf(m[2]), +m[1], 12).getTime();
  return null;
}

// Chi compra o fa export, non chi vende
const BUYER = /\b(gezocht|gevraagd|inkoop|opkoper|wij kopen|ik zoek)\b/i;

function attrs(list) {
  const a = {};
  (list || []).forEach((x) => { if (x && x.key) a[x.key] = x.value; });
  return a;
}

function img(u) {
  u = String(u || '');
  if (u.startsWith('//')) u = 'https:' + u;
  return u.startsWith('https://') ? u.replace(/\$_#\.jpg$/, '$_82.jpg') : '';
}

function parse(html) {
  const d = html && nextData(html);
  const sr = d && d.props && d.props.pageProps && d.props.pageProps.searchRequestAndResponse;
  if (!sr) return { items: [], total: 0, pages: 0 };
  const items = (sr.listings || []).map((l) => {
    const a = attrs(l.attributes);
    const loc = l.location || {};
    const country = COUNTRY[ascii(loc.countryName)] || 'NL';
    const pi = l.priceInfo || {};
    const title = decode(l.title || '').replace(/\s+/g, ' ').trim();
    const pic = (l.pictures && l.pictures[0] && (l.pictures[0].largeUrl || l.pictures[0].mediumUrl)) || String((l.imageUrls || [])[0] || '').replace(/\$_82\.jpg$/, '$_83.jpg');
    return {
      key: 'marktplaats:' + l.itemId,
      site: 'marktplaats',
      url: l.vipUrl ? BASE + l.vipUrl : '',
      title,
      version: '',
      price: pi.priceCents ? Math.round(pi.priceCents / 100) : null,
      negotiable: pi.priceType === 'MIN_BID' || pi.priceType === 'FAST_BID',
      km: num(a.mileage),
      year: num(a.constructionYear),
      fuel: normFuel(a.fuel),
      fuelLabel: a.fuel || '',
      gear: normGear(a.transmission),
      cv: num((title.match(/(\d{2,3})\s*(?:pk|cv)\b/i) || [])[1]),
      city: [loc.cityName, country].filter(Boolean).join(', '),
      country,
      seller: '',
      image: img(pic),
      photos: (l.imageUrls || []).length,
      snippet: decode(l.description || '').slice(0, 220),
      posted: when(l.date),
      postedLabel: l.date || ''
    };
  }).filter((x) => x.price && x.url && !BUYER.test(x.title));
  const total = sr.totalResultCount || items.length;
  const maxPage = sr.maxAllowedPageNumber || 50;
  return { items, total, pages: Math.min(maxPage, 50, Math.max(1, Math.ceil(total / PER_PAGE))) };
}

// Pagina annuncio: i dati stanno in window.__CONFIG__.listing, la descrizione nell'HTML.
function detail(html) {
  const m = html && html.match(/window\.__CONFIG__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) return null;
  let c;
  try { c = JSON.parse(m[1]); } catch (e) { return null; }
  const L = c.listing;
  if (!L || !L.title) return null;
  const a = {};
  const eq = [];
  ((L.carAttributes && L.carAttributes.groupedWithIcons) || []).forEach((g) => (g.attributes || []).forEach((x) => {
    if (Array.isArray(x.value)) x.value.forEach((v) => eq.push(String(v)));
    else if (x.key && a[x.key] === undefined) a[x.key] = x.value;
  }));
  const sel = L.seller || {};
  const loc = sel.location || {};
  const pi = L.priceInfo || {};
  const desc = (html.match(/Description-module-description"><div data-collapsable="description">([\s\S]*?)<\/div>/) || [])[1] || '';
  return {
    title: L.title,
    version: a.trim || '',
    price: pi.priceCents ? Math.round(pi.priceCents / 100) : null,
    negotiable: pi.priceType === 'MIN_BID',
    km: num(a.mileage),
    year: num(a.constructionYear),
    reg: a.constructionYear ? String(a.constructionYear) : '',
    fuel: normFuel(a.fuel),
    fuelLabel: itWord(a.fuel),
    gear: normGear(a.transmission),
    gearLabel: itWord(a.transmission),
    cv: num(a.powerInHorsePower),
    cc: a.cylinderCapacity ? Math.round(parseFloat(String(a.cylinderCapacity).replace(',', '.')) * 1000) || null : null,
    body: itWord(a.vehicleType),
    color: itWord(a.color),
    interior: [itWord(a.upholstery), itWord(a.interiorColor)].filter(Boolean).join(', '),
    doors: num(a.numberOfDoors),
    seats: num(a.numberOfSeats),
    drive: itWord(a.powerWheelDriver),
    emission: a.euronormBE || '',
    serviceBook: a.serviceHistory || '',
    description: plain(desc),
    photos: ((L.gallery && L.gallery.imageUrls) || []).map((u) => img(u).replace(/\$_82\.jpg$/, '$_85.jpg')).filter(Boolean),
    equipment: eq,
    seller: {
      name: sel.name || '',
      type: sel.sellerType === 'CONSUMER' ? 'privato' : sel.sellerType ? 'concessionario' : '',
      city: [loc.cityName, loc.countryName].filter(Boolean).join(', '),
      phones: [],
      whatsapp: ''
    },
    posted: (L.stats && Date.parse(L.stats.since)) || null,
    market: null,
    removed: false
  };
}

module.exports = { id: 'marktplaats', name: 'Marktplaats', country: 'NL', url, urls, parse, detail, when, dutchModel };

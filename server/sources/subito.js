// Subito: i risultati sono nel JSON __NEXT_DATA__ (initialState.items.originalList).
// La pagina del singolo annuncio ha lo stesso oggetto dentro i blocchi "self.__next_f".
const { num, normFuel, normGear, year } = require('./common');
const SITES = require('../../public/js/sites.js');

const site = SITES.SITES.find((s) => s.id === 'subito');

// Link di ricerca: prima con marca/modello nel percorso (più preciso), poi a testo libero come riserva.
function urls(s, page) {
  const byText = new URL(site.build(s));
  if (page > 1) byText.searchParams.set('o', page);
  const out = [];
  if (s.make) {
    // stessi filtri, ma marca/modello nel percorso; nel testo restano solo le parole chiave
    const byPath = new URL(byText.toString());
    byPath.pathname = '/annunci-' + (s.region || 'italia') + '/vendita/auto/' + SITES.slug(s.make) + '/' + (s.model ? SITES.slug(s.model) + '/' : '');
    if (s.kw) byPath.searchParams.set('q', s.kw); else byPath.searchParams.delete('q');
    out.push(byPath.toString());
  }
  out.push(byText.toString());
  return out;
}

function url(s, page) { return urls(s, page)[0]; }

function feat(x, k) { const f = x.features && x.features[k]; return f && f.values && f.values[0] ? f.values[0] : null; }
function titleCase(s) { return String(s || '').toLowerCase().replace(/(^|[\s-])([a-zà-ù])/g, (m, a, b) => a + b.toUpperCase()); }
function img(base, rule) { return base ? base + '?rule=' + rule : ''; }

function normalize(x) {
  const car = (x.features && x.features['/car'] && x.features['/car'].values) || [];
  const make = car.find((v) => v.level === 0);
  const model = car.find((v) => v.level === 1);
  const version = car.find((v) => v.level === 2);
  const geo = x.geo || {};
  const power = feat(x, '/power');
  const fuel = feat(x, '/fuel');
  const gear = feat(x, '/gearbox');
  const images = (x.images || []).map((i) => i.cdnBaseUrl).filter((u) => /^https:\/\//.test(u || ''));
  return {
    key: 'subito:' + ((x.urls && x.urls.default || '').match(/(\d{6,})\.htm/) || [, x.urn])[1],
    site: 'subito',
    url: (x.urls && x.urls.default) || '',
    title: make ? titleCase(make.value) + ' ' + (model ? model.group_label || model.value : '') : x.subject || '',
    version: version ? version.value : (x.subject || ''),
    price: num(feat(x, '/price') && feat(x, '/price').key),
    km: num(feat(x, '/mileage_scalar') && feat(x, '/mileage_scalar').key),
    year: num(feat(x, '/year') && feat(x, '/year').key) || year(feat(x, '/register_date') && feat(x, '/register_date').value),
    reg: (feat(x, '/register_date') || {}).value || '',
    fuel: normFuel(fuel && fuel.value),
    fuelLabel: (fuel && fuel.value) || '',
    gear: normGear(gear && gear.value),
    gearLabel: (gear && gear.value) || '',
    cv: power ? num(String(power.key).split('/')[1]) : null,
    kw: power ? num(String(power.key).split('/')[0]) : null,
    body: (feat(x, '/car_type') || {}).value || '',
    color: (feat(x, '/color') || {}).value || '',
    doors: num(((feat(x, '/doors') || {}).value || '').split('/')[0]),
    seats: num((feat(x, '/seats') || {}).value),
    emission: (feat(x, '/pollution') || {}).value || '',
    city: [geo.town && geo.town.value, geo.city && geo.city.shortName ? '(' + geo.city.shortName + ')' : ''].filter(Boolean).join(' '),
    seller: x.advertiser && x.advertiser.company ? 'concessionario' : 'privato',
    sellerName: (x.advertiser && x.advertiser.name) || '',
    image: img(images[0], 'large-fixed-card-2x-auto'),
    images,
    photos: images.length,
    pics: images.slice(0, 8).map((u) => img(u, 'large-fixed-card-2x-auto')),
    description: String(x.body || '').trim(),
    snippet: String(x.body || '').trim().slice(0, 200),
    posted: Date.parse(String(x.date || '').replace(' ', 'T')) || null
  };
}

function parse(html) {
  if (!html) return { items: [], total: 0, pages: 0 };
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { items: [], total: 0, pages: 0 };
  let st;
  try { st = JSON.parse(m[1]).props.pageProps.initialState.items; } catch (e) { return { items: [], total: 0, pages: 0 }; }
  const items = (st.originalList || []).filter((x) => x && x.kind === 'AdItem').map(normalize)
    .filter((x) => x.price && x.url.startsWith('https://'));
  items.forEach((x) => { delete x.description; delete x.images; });
  return { items, total: st.total || items.length, pages: st.totalPages || 1 };
}

// Estrae un oggetto JSON bilanciato a partire da una posizione (rispettando le stringhe).
function jsonAt(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

// Blocco di testo del formato React ("id:T<lunghezza in byte, esadecimale>,<testo>")
function textChunk(payload, id) {
  const m = new RegExp('(?:^|\\n)' + id + ':T([0-9a-f]+),').exec(payload);
  if (!m) return '';
  const bytes = parseInt(m[1], 16);
  return Buffer.from(payload.slice(m.index + m[0].length), 'utf8').subarray(0, bytes).toString('utf8').trim();
}

function detail(html) {
  if (!html) return null;
  // ricompone i blocchi self.__next_f.push([1,"..."])
  let payload = '';
  const re = /self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g;
  let m;
  while ((m = re.exec(html))) { try { payload += JSON.parse(m[1]); } catch (e) { /* blocco non valido */ } }
  const at = payload.indexOf('{"kind":"AdItem"');
  if (at < 0) return null;
  let x;
  try { x = JSON.parse(jsonAt(payload, at)); } catch (e) { return null; }
  const n = normalize(x);
  // descrizioni lunghe: nella pagina c'è solo un rimando ("$4b") a un blocco di testo a parte ("4b:T<lunghezza>,<testo>")
  if (/^\$[0-9a-f]+$/i.test(n.description || '')) n.description = textChunk(payload, n.description.slice(1));
  return {
    title: n.title, version: n.version, price: n.price, km: n.km, year: n.year, reg: n.reg,
    fuel: n.fuel, fuelLabel: n.fuelLabel, gear: n.gear, gearLabel: n.gearLabel, cv: n.cv, kw: n.kw,
    body: n.body, color: n.color, doors: n.doors, seats: n.seats, emission: n.emission,
    description: n.description,
    photos: n.images.map((u) => img(u, 'fullscreen-1x-auto')),
    equipment: [],
    seller: { name: n.sellerName || (n.seller === 'privato' ? 'Privato' : ''), type: n.seller, city: n.city, phones: [], whatsapp: '' },
    posted: n.posted,
    market: null,
    removed: false
  };
}

module.exports = { id: 'subito', name: 'Subito', url, urls, parse, detail, normalize, textChunk };

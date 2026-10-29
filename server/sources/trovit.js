// Trovit: aggregatore (raccoglie anche annunci di privati da altri siti). Pagina HTML con le "card".
// Filtra per prezzo, anno, km e ordinamento tramite URL; zona e alimentazione no.
const { num, normFuel, decode } = require('./common');

const PER_PAGE = 25;

function seg(name, v) { return v ? '/' + name + '.' + v : ''; }
function n(v) { const x = parseInt(v, 10); return isNaN(x) || x <= 0 ? '' : x; }

function url(s, page) {
  const what = [s.make === 'Mercedes-Benz' ? 'Mercedes' : s.make, s.model, s.kw].filter(Boolean).join(' ');
  const order = { prezzo: 'price', recenti: 'source_date' }[s.sort] || '';
  return 'https://auto.trovit.it/index.php/cod.search_cars/what_d.' + encodeURIComponent(what) +
    seg('price_min', n(s.pmin)) + seg('price_max', n(s.pmax)) +
    seg('year_min', n(s.ymin)) + seg('year_max', n(s.ymax)) +
    seg('mileage_min', n(s.kmmin)) + seg('mileage_max', n(s.kmmax)) +
    seg('order_by', order) + (page > 1 ? '/page.' + page : '');
}

function text(html) {
  return decode(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// "11 ore 20 minuti fa", "3 giorni fa", "1 mese fa" -> timestamp approssimativo
function when(s) {
  const t = String(s || '');
  const now = Date.now();
  let m;
  if ((m = t.match(/(\d+)\s*minut/)) && !/or[ae]/.test(t)) return now - m[1] * 60000;
  if ((m = t.match(/(\d+)\s*or[ae]/))) return now - m[1] * 3600000;
  if ((m = t.match(/(\d+)\s*giorn/))) return now - m[1] * 86400000;
  if ((m = t.match(/(\d+)\s*settiman/))) return now - m[1] * 7 * 86400000;
  if ((m = t.match(/(\d+)\s*mes/))) return now - m[1] * 30 * 86400000;
  if (/ieri/.test(t)) return now - 86400000;
  return null;
}

function parse(html) {
  if (!html) return { items: [], total: 0, pages: 0 };
  const re = /<div class="item js-item[^"]*" data-id="([A-Za-z0-9]+)"/g;
  const starts = [];
  let m;
  while ((m = re.exec(html))) starts.push({ id: m[1], at: m.index });
  const items = starts.map((st, i) => {
    const c = html.slice(st.at, i + 1 < starts.length ? starts[i + 1].at : st.at + 8000);
    const href = (c.match(/<a [^>]*class="rd-link"[^>]*href="([^"]+)"/) || [])[1] || '';
    const img = (c.match(/<img src="([^"]+)"/) || [])[1] || '';
    const title = text((c.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1]);
    const info = {};
    c.replace(/<li class="info-item">\s*<span>([^<]*)<\/span>\s*<br>\s*([A-Za-z]+)/g, (x, v, k) => { info[k.toLowerCase()] = v; });
    const snippet = text((c.match(/<div class="extended-description__content">\s*<p>([\s\S]*?)<\/p>/) || [])[1]);
    const agency = text((c.match(/<div class="agency_name_container[^"]*">([\s\S]*?)<\/div>/) || [])[1]);
    const date = text((c.match(/<small class="date">([\s\S]*?)<\/small>/) || [])[1]);
    return {
      key: 'trovit:' + st.id,
      site: 'trovit',
      url: href.replace(/&amp;/g, '&'),
      title,
      version: '',
      price: num((c.match(/<div class="price">\s*<meta content="(\d+)"/) || [])[1]),
      km: num(info.kms),
      year: num(info.anno),
      fuel: normFuel(title) || normFuel(snippet),
      fuelLabel: '',
      gear: '',
      cv: num((title.match(/(\d{2,3})\s*cv\b/i) || [])[1]),
      city: '',
      seller: agency ? 'concessionario' : (/\bprivato\b/i.test(snippet) ? 'privato' : ''),
      image: img ? (img.startsWith('//') ? 'https:' + img : img) : '',
      photos: img ? 1 : 0,
      snippet,
      posted: when(date),
      postedLabel: date
    };
  }).filter((x) => x.price && x.url.startsWith('https://'));
  const total = num((html.match(/([\d.]+)\s*risultati/) || [])[1]) || items.length;
  return { items, total, pages: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

// Pagina annuncio di Trovit (auto.trovit.it/listing/...-ID): descrizione completa, scheda e foto grande.
function detail(html, pageUrl) {
  if (!html) return null;
  const main = html.split(/Annunci simili/)[0].replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/g, ' ');
  const tk = decode(main.replace(/<[^>]+>/g, '|')).split('|').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const di = tk.indexOf('Descrizione');
  if (di < 0) return null;
  const mi = tk.indexOf('Marca', di);
  const spec = {};
  for (let i = mi; i > 0 && i < tk.length - 1; i += 2) {
    if (/^Contattare|^Vedi auto/.test(tk[i])) break;
    spec[tk[i]] = tk[i + 1];
  }
  const id = (String(pageUrl || '').match(/\.([A-Za-z0-9_]+)$/) || [])[1] || '';
  const photos = [];
  if (id) {
    const re = new RegExp('//img-it-\\d\\.trovit\\.com/' + id + '/' + id + '\\.\\d+_1[12]\\.jpg', 'g');
    (html.match(re) || []).forEach((u) => { u = 'https:' + u.replace(/_11\.jpg$/, '_12.jpg'); if (!photos.includes(u)) photos.push(u); });
  }
  const title = decode((html.match(/<title>([^<]*)/) || [])[1] || spec.Marca || '').trim();
  const priceTok = tk.slice(0, di).reverse().find((t) => /^[\d.]+\s*€$/.test(t));
  return {
    title,
    version: '',
    price: num(priceTok),
    km: num(spec.Kilometraggio),
    year: num(spec.Anno),
    reg: spec.Anno || '',
    fuel: normFuel(spec.Combustibile),
    fuelLabel: spec.Combustibile || '',
    gear: /autom/i.test(spec['Tipo di cambio'] || '') ? 'automatico' : /manual/i.test(spec['Tipo di cambio'] || '') ? 'manuale' : '',
    gearLabel: spec['Tipo di cambio'] || '',
    cv: num(spec['Potenza (cv)']),
    body: spec.Carrozzeria || '',
    color: spec.Colore || '',
    doors: num(spec.Porte),
    seats: num(spec.Posti),
    description: tk.slice(di + 1, mi > di ? mi : di + 2).join('\n').replace(/\s*MOSTRA NUMERO\s*/g, ' ').trim(),
    photos,
    equipment: [],
    seller: null,
    posted: null,
    market: null,
    removed: false
  };
}

module.exports = { id: 'trovit', name: 'Trovit', url, parse, when, detail };

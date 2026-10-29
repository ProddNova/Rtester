// Kleinanzeigen (Germania, ex eBay Kleinanzeigen): tantissimi privati.
// Filtri nell'URL: marca, prezzo, anno, km, alimentazione, cambio, carrozzeria, potenza.
// Il modello si cerca a parole (Kleinanzeigen ignora i modelli che non conosce).
// Niente ordinamento via URL: robots.txt non lo permette, e l'ordine normale è già "più recenti".
const { num, normFuel, normGear, decode, plain, itWord } = require('./common');

const BASE = 'https://www.kleinanzeigen.de';
const PER_PAGE = 30;

// Chiavi marca di Kleinanzeigen (filtro "autos.marke_s")
const MAKES = new Set(['volkswagen', 'mercedes_benz', 'bmw', 'audi', 'opel', 'ford', 'skoda', 'toyota', 'renault', 'mazda',
  'hyundai', 'peugeot', 'seat', 'fiat', 'kia', 'citroen', 'dacia', 'mini', 'nissan', 'smart', 'volvo', 'mitsubishi', 'porsche',
  'suzuki', 'land_rover', 'jeep', 'chevrolet', 'honda', 'jaguar', 'cupra', 'alfa_romeo', 'dodge', 'subaru', 'mg', 'chrysler',
  'trabant', 'abarth', 'saab', 'lada', 'ssangyong', 'daihatsu', 'tesla', 'lexus', 'iveco', 'ds', 'lancia', 'cadillac', 'aixam',
  'maserati', 'corvette', 'wartburg', 'triumph', 'infiniti', 'bentley', 'microcar', 'rover', 'ferrari', 'lamborghini', 'daewoo',
  'aston_martin', 'byd', 'rolls_royce', 'kgm', 'polestar']);
const FUEL = { benzina: 'benzin', diesel: 'diesel', elettrica: 'elektro', ibrida: 'hybrid', gpl: 'lpg', metano: 'cng' };
const BODY = { citycar: 'kleinwagen', berlina: 'limousine', sw: 'kombi', coupe: 'coupe', cabrio: 'cabrio', suv: 'suv' };
const GEAR = { manuale: 'manuell', automatico: 'automatik' };

function ascii(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function makeKey(make) { return ascii(make).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function n(v) { const x = parseInt(v, 10); return isNaN(x) || x <= 0 ? '' : x; }

// Nomi italiani dei modelli -> come li scrivono in Germania
function germanModel(model) {
  return String(model || '')
    .replace(/^Classe\s+([A-Z]{1,3})$/i, '$1-Klasse')
    .replace(/^Serie\s+(\d)$/i, '$1er');
}

function slug(words) {
  return ascii(words.filter(Boolean).join(' ')).replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
}

function range(a, b) { return a || b ? (a || '') + '%2C' + (b || '') : ''; }

function url(s, page) {
  const key = makeKey(s.make === 'auto' ? '' : s.make);
  const known = MAKES.has(key);
  const words = slug([known ? '' : (s.make === 'auto' ? '' : s.make), germanModel(s.model), s.kw]);
  const attrs = [];
  if (known) attrs.push('marke_s:' + key);
  const ez = range(n(s.ymin), n(s.ymax)); if (ez) attrs.push('ez_i:' + ez);
  const km = range(n(s.kmmin), n(s.kmmax)); if (km) attrs.push('km_i:' + km);
  const ps = range(n(s.cvmin), n(s.cvmax)); if (ps) attrs.push('power_i:' + ps);
  if (FUEL[s.fuel]) attrs.push('fuel_s:' + FUEL[s.fuel]);
  if (GEAR[s.gear]) attrs.push('shift_s:' + GEAR[s.gear]);
  if (BODY[s.body]) attrs.push('typ_s:' + BODY[s.body]);
  const price = n(s.pmin) || n(s.pmax) ? 'preis:' + (n(s.pmin) || '') + ':' + (n(s.pmax) || '') + '/' : '';
  return BASE + '/s-autos/' + (page > 1 ? 'seite:' + page + '/' : '') + price +
    (words ? words + '/k0c216' : 'c216') + attrs.map((a) => '+autos.' + a).join('');
}

function text(html) {
  return decode(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// "Heute, 13:58" / "Gestern, 10:00" / "28.10.2026" -> timestamp
function when(s) {
  const t = String(s || '');
  let m;
  const day = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x; };
  if ((m = t.match(/(Heute|Gestern)(?:,\s*(\d{1,2}):(\d{2}))?/))) {
    const d = day(m[1] === 'Heute' ? 0 : 1);
    if (m[2]) d.setHours(+m[2], +m[3], 0, 0);
    return d.getTime();
  }
  if ((m = t.match(/(\d{2})\.(\d{2})\.(\d{4})/))) return new Date(+m[3], m[2] - 1, +m[1], 12).getTime();
  return null;
}

// "März 1998" -> "Marzo 1998"
const DE_MONTHS = { januar: 'Gennaio', februar: 'Febbraio', 'märz': 'Marzo', april: 'Aprile', mai: 'Maggio', juni: 'Giugno', juli: 'Luglio',
  august: 'Agosto', september: 'Settembre', oktober: 'Ottobre', november: 'Novembre', dezember: 'Dicembre' };
function deMonth(s) { return String(s || '').replace(/[A-Za-zä]+/g, (w) => DE_MONTHS[w.toLowerCase()] || w); }

// Annunci di chi compra ("Kaufe", "Suche", "Ankauf"...) e non vende
const BUYER = /\b(kaufe|suche|gesucht|ankauf|aufkauf|wir kaufen)\b/i;

function parse(html) {
  if (!html) return { items: [], total: 0, pages: 0 };
  const re = /<li\s[^>]*data-adid="(\d+)"/g;
  const starts = [];
  let m;
  while ((m = re.exec(html))) starts.push({ id: m[1], at: m.index });
  const items = starts.map((st, i) => {
    const c = html.slice(st.at, i + 1 < starts.length ? starts[i + 1].at : st.at + 8000);
    const href = (c.match(/data-href="([^"]+)"/) || [])[1] || (c.match(/<a href="(\/s-anzeige\/[^"]+)"/) || [])[1] || '';
    const img = decode((c.match(/<img\b[^>]*?\ssrc="([^"]+)"/) || [])[1] || '');
    const title = text((c.match(/adlist--item--boldtitle">([\s\S]*?)<\/strong>/) || [])[1]);
    const tags = (c.match(/<span class="simpletag">[^<]*<\/span>/g) || []).map(text);
    const kmTag = tags.find((t) => /km$/i.test(t));
    const ezTag = tags.find((t) => /^EZ\b/.test(t));
    const snippet = text((c.match(/<div class="long-description">([\s\S]*?)<\/div>/) || [])[1]);
    const date = text((c.match(/adlist--item--info--date">([\s\S]*?)<\/div>/) || [])[1]);
    const city = text((c.match(/adlist--item--info--location">([\s\S]*?)<\/div>/) || [])[1]);
    const priceTxt = text((c.match(/adlist--item--price">([\s\S]*?)<\/div>/) || [])[1]);
    return {
      key: 'kleinanzeigen:' + st.id,
      site: 'kleinanzeigen',
      url: href ? BASE + href : '',
      title,
      version: '',
      price: /€/.test(priceTxt) ? num(priceTxt) : null,
      negotiable: /VB/.test(priceTxt),
      km: kmTag ? num(kmTag) : null,
      year: ezTag ? num((ezTag.match(/(19|20)\d\d/) || [])[0]) : null,
      fuel: normFuel(title) || normFuel(snippet),
      fuelLabel: '',
      gear: normGear(title),
      cv: num((title.match(/(\d{2,3})\s*(?:PS|CV)\b/i) || snippet.match(/(\d{2,3})\s*PS\b/) || [])[1]),
      city: [city, 'DE'].filter(Boolean).join(', '),
      country: 'DE',
      seller: '',
      // senza foto Kleinanzeigen mette un segnaposto (static.kleinanzeigen.de/.../nopic): non è una foto
      image: img.startsWith('https://img.kleinanzeigen.de/') ? img : '',
      photos: num((c.match(/has-image-count">\s*(\d+)/) || [])[1]) || (/^https:\/\/img\.kleinanzeigen\.de\//.test(img) ? 1 : 0),
      snippet,
      posted: when(date),
      postedLabel: date
    };
  }).filter((x) => x.price && x.url && !BUYER.test(x.title));
  const total = num((html.match(/([\d.]+)\s*Ergebnis/) || [])[1]) || items.length;
  return { items, total, pages: Math.min(50, Math.max(1, Math.ceil(total / PER_PAGE))) };
}

// Pagina annuncio: scheda (dt/dd), descrizione, foto, dotazioni, venditore
function detail(html) {
  if (!html || !/viewad-description-text/.test(html)) return null;
  const spec = {};
  const dl = (html.match(/<dl class="definition-list-addetails">([\s\S]*?)<\/dl>/) || [])[1] || '';
  dl.replace(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g, (x, k, v) => { spec[text(k)] = text(v); });
  let product = {};
  const photos = [];
  (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).forEach((s) => {
    let j;
    try { j = JSON.parse(s.replace(/^<script[^>]*>|<\/script>$/g, '')); } catch (e) { return; }
    if (j['@type'] === 'Product') product = j;
    if (j['@type'] === 'ImageObject' && j.contentUrl) {
      const u = decode(j.contentUrl);
      if (/^https:\/\/img\.kleinanzeigen\.de\//.test(u) && !photos.includes(u)) photos.push(u);
    }
  });
  const title = text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]) || product.name || '';
  const pageTitle = decode((html.match(/<title>([^<]*)/) || [])[1] || '');
  const place = (pageTitle.match(/ in ([^|]+?)\s*\|/) || [])[1] || '';
  const offer = product.offers || {};
  const poster = text((html.match(/userprofile-teaser--postertype">([\s\S]*?)<\/span>/) || [])[1]);
  const desc = (html.match(/id="viewad-description-text"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  const eq = (html.match(/<li class="checktag">[^<]*<\/li>/g) || []).map(text);
  const posted = (html.match(/(\d{2}\.\d{2}\.\d{4})<\/span>/) || [])[1];
  const ez = spec.Erstzulassung || '';
  const priceTxt = text((html.match(/id="vip-ad-price"[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
  return {
    title,
    version: '',
    price: num(offer.price) || num(priceTxt),
    negotiable: /\bVB\b/.test(priceTxt),
    km: num(spec.Kilometerstand),
    year: num((ez.match(/(19|20)\d\d/) || [])[0]),
    reg: deMonth(ez),
    fuel: normFuel(spec.Kraftstoffart),
    fuelLabel: itWord(spec.Kraftstoffart),
    gear: normGear(spec.Getriebe),
    gearLabel: itWord(spec.Getriebe),
    cv: num(spec.Leistung),
    body: itWord(spec.Fahrzeugtyp),
    color: itWord(spec['Außenfarbe']),
    interior: itWord(spec['Material Innenausstattung']),
    doors: num((String(spec['Anzahl Türen'] || '').match(/\d+/) || [])[0]),
    emission: spec.Schadstoffklasse || '',
    accident: /unbesch/i.test(spec.Fahrzeugzustand || '') ? 'No' : /besch/i.test(spec.Fahrzeugzustand || '') ? 'Sì' : '',
    description: plain(desc),
    photos,
    equipment: eq,
    seller: {
      name: text((html.match(/userprofile-teaser--title">([\s\S]*?)<\/h2>/) || [])[1]),
      type: /privat/i.test(poster) ? 'privato' : poster ? 'concessionario' : '',
      city: place.replace(/\s+-\s+/, ' - ') + (place ? ' (Germania)' : ''),
      phones: [],
      whatsapp: ''
    },
    posted: posted ? when(posted) : null,
    market: null,
    removed: false
  };
}

module.exports = { id: 'kleinanzeigen', name: 'Kleinanzeigen', country: 'DE', url, parse, detail, when, germanModel };

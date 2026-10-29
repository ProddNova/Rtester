// Automobile.it: risultati nel JSON __NEXT_DATA__. Il sito filtra solo per marca/modello/regione,
// gli altri filtri li applichiamo noi sui risultati (vedi search.js).
const { num, normFuel, normGear, cv, year, nextData, plain } = require('./common');
const SITES = require('../../public/js/sites.js');

const site = SITES.SITES.find((s) => s.id === 'automobile');
const PER_PAGE = 20;

function url(search, page) {
  const u = site.build(search);
  return page > 1 ? u + '/page-' + page : u;
}

function parse(html) {
  const d = nextData(html);
  const r = d && d.props && d.props.pageProps && d.props.pageProps.apiResults && d.props.pageProps.apiResults.result;
  if (!r || !Array.isArray(r.resultList)) return { items: [], total: 0, pages: 0 };
  const items = r.resultList.map((x) => {
    const det = x.details || {};
    const fuelLabel = String(det.fuelEmissions || '').split(' - ')[0];
    return {
      key: 'automobile:' + x.id,
      site: 'automobile',
      url: 'https://www.automobile.it' + x.url,
      title: x.title || '',
      version: '',
      price: num(x.formattedPrice),
      km: num(det.formattedKm),
      year: year(det.registration),
      fuel: normFuel(fuelLabel),
      fuelLabel,
      gear: normGear(det.shift),
      cv: cv(det.formattedPower),
      city: x.location || '',
      seller: x.sellerType === 'PRIVATE' ? 'privato' : 'concessionario',
      image: x.firstMediumSizeImage || ((x.imageUrls || [])[0] ? x.imageUrls[0] + '?rule=ad-372.jpeg' : ''),
      photos: x.totalNumberOfPictures || 0,
      note: /ricambi/i.test(x.shortDescription || '') ? 'Forse solo ricambi' : ''
    };
  }).filter((x) => x.price);
  const p = r.pagination || {};
  const pages = (p.last && p.last.pageNumber) || (p.next ? (r.page || 1) + 1 : 1);
  return { items, total: null, pages };
}

function first(s) { const m = String(s || '').match(/\d+/); return m ? +m[0] : null; }

// Pagina del singolo annuncio
function detail(html) {
  const d = nextData(html);
  const pp = d && d.props && d.props.pageProps;
  const r = pp && pp.result;
  if (!r || !r.details) return null;
  const det = r.details;
  const info = {};
  const vi = pp.vehicleInformation || {};
  ['basicInfo', 'aesthetic', 'consumption'].forEach((k) => (vi[k] || []).forEach((x) => { info[x.title] = (x.values || []).join(', '); }));
  const eq = [];
  (vi.accessories || []).forEach((g) => (g.values || []).forEach((x) => eq.push(x)));
  const dealer = r.dealer || {};
  const addr = dealer.shippingAddress || {};
  const phones = [dealer.phone, dealer.mobilePhone].filter(Boolean).filter((p, i, a) => a.indexOf(p) === i)
    .map((p) => ({ label: p, tel: String(p).replace(/[^\d+]/g, '') }));
  const fuelLabel = String(det.fuelEmissions || '').split(' - ')[0];
  return {
    title: r.title || '',
    version: info.Versione || '',
    price: num(r.formattedPrice),
    km: num(det.formattedKm),
    year: year(det.registration),
    reg: det.registration || '',
    fuel: normFuel(fuelLabel),
    fuelLabel,
    gear: normGear(det.shift),
    gearLabel: det.shift || '',
    cv: cv(det.formattedPower),
    kw: num((String(det.formattedPower || '').match(/(\d+)\s*KW/i) || [])[1]),
    cc: num(det.formattedEngineCapacity),
    body: info.Carrozzeria || '',
    color: info['Colore esterno'] || '',
    doors: first(info['Numero di porte']),
    seats: first(info['Numero di posti']),
    drive: '',
    emission: info['Classe emissioni'] || String(det.fuelEmissions || '').split(' - ')[1] || '',
    consumption: info['Consumo combinato'] || '',
    description: plain(r.description),
    photos: (r.vipPictures || []).map((p) => p.imgBig).filter((u) => /^https:\/\//.test(u || '')),
    equipment: eq,
    seller: {
      name: dealer.name || (r.sellerType === 'PRIVATE' ? 'Privato' : ''),
      type: r.sellerType === 'PRIVATE' ? 'privato' : 'concessionario',
      city: [addr.street || addr.address, r.location].filter(Boolean).join(', '),
      phones,
      whatsapp: ''
    },
    posted: null,
    market: null,
    removed: r.adStatus && r.adStatus !== 'ACTIVE'
  };
}

// Se il modello non esiste su Automobile.it (404) si cerca la sola marca e si filtra per nome.
function urls(search, page) {
  const out = [{ u: url(search, page) }];
  if (search.make && search.model) out.push({ u: url(Object.assign({}, search, { model: '' }), page), strict: true });
  return out;
}

module.exports = { id: 'automobile', name: 'Automobile.it', url, urls, parse, detail };

// Automobile.it: risultati nel JSON __NEXT_DATA__. Il sito filtra solo per marca/modello/regione,
// gli altri filtri li applichiamo noi sui risultati (vedi search.js).
const { num, normFuel, normGear, cv, year, nextData } = require('./common');
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

module.exports = { id: 'automobile', name: 'Automobile.it', url, parse };

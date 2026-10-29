// AutoScout24: i risultati sono nel JSON __NEXT_DATA__ della pagina di ricerca.
const { num, normFuel, normGear, cv, year, nextData } = require('./common');
const SITES = require('../../public/js/sites.js');

const site = SITES.SITES.find((s) => s.id === 'autoscout');

function url(search, page) {
  const u = site.build(search);
  return page > 1 ? u + '&page=' + page : u;
}

function parse(html) {
  const d = nextData(html);
  const pp = d && d.props && d.props.pageProps;
  if (!pp || !Array.isArray(pp.listings)) return { items: [], total: 0, pages: 0 };
  const items = pp.listings.map((l) => {
    const v = l.vehicle || {};
    const det = {};
    (l.vehicleDetails || []).forEach((x) => { det[x.iconName] = x.data; });
    const tr = l.tracking || {};
    const loc = l.location || {};
    const img = (l.images || [])[0] || '';
    return {
      key: 'autoscout:' + l.id,
      site: 'autoscout',
      url: 'https://www.autoscout24.it' + l.url,
      title: [v.make, v.model].filter(Boolean).join(' '),
      version: v.modelVersionInput || v.variant || '',
      price: (l.price && l.price.priceRaw) || num(tr.price),
      km: num(tr.mileage) || num(v.mileageInKm),
      year: year(tr.firstRegistration || det.calendar),
      fuel: normFuel(v.fuel || det.gas_pump),
      fuelLabel: v.fuel || det.gas_pump || '',
      gear: normGear(v.transmission || det.gearbox),
      cv: cv(det.speedometer),
      city: [loc.city, loc.countryCode && loc.countryCode !== 'IT' ? loc.countryCode : ''].filter(Boolean).join(', '),
      seller: l.seller && l.seller.type === 'PrivateSeller' ? 'privato' : 'concessionario',
      image: img.replace(/\/\d+x\d+\.webp$/, '/480x360.webp'),
      photos: (l.images || []).length
    };
  }).filter((x) => x.price);
  return { items, total: pp.numberOfResults || items.length, pages: pp.numberOfPages || 1 };
}

module.exports = { id: 'autoscout', name: 'AutoScout24', url, parse };

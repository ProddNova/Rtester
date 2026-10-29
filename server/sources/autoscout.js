// AutoScout24: i risultati sono nel JSON __NEXT_DATA__ della pagina di ricerca.
const { num, normFuel, normGear, cv, year, nextData, plain } = require('./common');

const LABEL_CAT = { 'toolow-price': 0, 'top-price': 1, 'good-price': 2, 'fair-price': 3, 'somewhat-expensive': 4, 'expensive': 5, 'very-expensive': 6 };
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
      photos: (l.images || []).length,
      deal: LABEL_CAT[String(tr.priceLabel || '').trim()]
    };
  }).filter((x) => x.price);
  return { items, total: pp.numberOfResults || items.length, pages: pp.numberOfPages || 1 };
}

// Pagina del singolo annuncio
function detail(html) {
  const d = nextData(html);
  const L = d && d.props && d.props.pageProps && d.props.pageProps.listingDetails;
  if (!L || !L.vehicle) return null;
  const v = L.vehicle;
  const pub = (L.prices && L.prices.public) || {};
  const eq = [];
  Object.values(v.equipment || {}).forEach((list) => (list || []).forEach((x) => x && x.id && eq.push(x.id)));
  const sel = L.seller || {};
  const loc = L.location || {};
  const phones = (sel.phones || []).map((p) => ({ label: p.formattedNumber, tel: p.callTo })).filter((p) => p.tel);
  return {
    title: [v.make, v.model].filter(Boolean).join(' '),
    version: v.modelVersionInput || '',
    price: pub.priceRaw || null,
    negotiable: !!pub.negotiable,
    km: v.mileageInKmRaw || null,
    year: year(v.firstRegistrationDateRaw),
    reg: v.firstRegistrationDate || '',
    fuel: normFuel(v.fuelCategory && v.fuelCategory.formatted),
    fuelLabel: (v.fuelCategory && v.fuelCategory.formatted) || '',
    gear: normGear(v.transmissionType),
    gearLabel: [v.transmissionType, v.gears ? v.gears + ' marce' : ''].filter(Boolean).join(', '),
    cv: v.rawPowerInHp || null,
    kw: v.rawPowerInKw || null,
    cc: v.rawDisplacementInCCM || null,
    body: v.bodyType || '',
    color: [v.bodyColor, v.paintType].filter(Boolean).join(' '),
    interior: [v.upholstery, v.upholsteryColor].filter(Boolean).join(', '),
    doors: v.numberOfDoors || null,
    seats: v.numberOfSeats || null,
    drive: v.driveTrain || '',
    emission: (v.environmentEuDirective && v.environmentEuDirective.formatted) || '',
    consumption: (v.fuelConsumptionCombined && v.fuelConsumptionCombined.formatted) || '',
    weight: v.weight || '',
    accident: v.hadAccident === true ? 'Sì' : v.hadAccident === false ? 'No' : '',
    serviceBook: v.hasFullServiceHistory ? 'Sì' : '',
    description: plain(L.description),
    photos: (L.images || []).filter((u) => /^https:\/\//.test(u)),
    equipment: eq,
    seller: {
      name: sel.companyName || sel.contactName || (sel.type === 'PrivateSeller' ? 'Privato' : ''),
      type: sel.isDealer ? 'concessionario' : 'privato',
      city: [loc.street, [loc.zip, loc.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      phones,
      whatsapp: L.whatsappNumber || ''
    },
    posted: Date.parse(L.createdTimestampWithOffset) || null,
    market: pub.median ? { median: pub.median, deal: typeof pub.category === 'number' ? pub.category : null, source: 'AutoScout24' } : null,
    removed: L.status && L.status !== 'Active'
  };
}

module.exports = { id: 'autoscout', name: 'AutoScout24', url, parse, detail };

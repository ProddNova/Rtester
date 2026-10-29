// AutoSuperMarket: ogni annuncio è una "card" HTML con etichette (Chilometri, Cambio, ...).
const { num, normFuel, normGear, cv, year, decode, plain } = require('./common');
const SITES = require('../../public/js/sites.js');

const site = SITES.SITES.find((s) => s.id === 'autosupermarket');
const PER_PAGE = 20;

function url(search, page) {
  const u = site.build(search);
  return page > 1 ? u + (u.includes('?') ? '&' : '?') + 'page=' + page : u;
}

function tokens(chunk) {
  const clean = chunk
    .replace(/<(script|style|svg|picture)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<(img|source)[^>]*>/g, ' ');
  return decode(clean.replace(/<[^>]+>/g, '|'))
    .split('|').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function after(tk, label) {
  const i = tk.indexOf(label);
  return i >= 0 ? tk[i + 1] || '' : '';
}

function parseCard(href, chunk) {
  const tk = tokens(chunk);
  const head = (tk.find((t) => t.startsWith('Apri scheda auto ')) || '').replace('Apri scheda auto ', '');
  const title = head.split(' - ')[0].trim();
  const ti = tk.indexOf(title, 1);
  const euro = tk.indexOf('€');
  const img = (chunk.match(/src="(https:\/\/imgproxy\.autosupermarket\.it\/[^"]+)"/) || [])[1] || '';
  return {
    key: 'autosupermarket:' + (href.match(/-([0-9a-f]{12,})$/) || [, href])[1],
    site: 'autosupermarket',
    url: href,
    title,
    version: ti >= 0 ? tk[ti + 1] || '' : head.split(' - ')[1] || '',
    price: euro > 0 ? num(tk[euro - 1]) : null,
    km: num(after(tk, 'Chilometri')),
    year: year(after(tk, 'Immatricolazione')),
    fuel: normFuel(after(tk, 'Alimentazione')),
    fuelLabel: after(tk, 'Alimentazione'),
    gear: normGear(after(tk, 'Cambio')),
    cv: cv(after(tk, 'Motore')),
    city: tk.find((t) => /\([A-Z]{2}\)$/.test(t)) || '',
    seller: tk.some((t) => /^privato$/i.test(t)) ? 'privato' : 'concessionario',
    image: img,
    photos: num((tk.find((t) => /^1 \/ \d+$/.test(t)) || '').split('/')[1]) || (img ? 1 : 0)
  };
}

function parse(html) {
  if (!html) return { items: [], total: 0, pages: 0 };
  const re = /<a [^>]*href="(https:\/\/autosupermarket\.it\/annunci\/[^"]+)"/g;
  const starts = [];
  let m;
  while ((m = re.exec(html))) {
    if (!starts.length || starts[starts.length - 1].href !== m[1]) starts.push({ href: m[1], at: m.index });
  }
  const seen = new Set();
  const items = [];
  starts.forEach((s, i) => {
    if (seen.has(s.href)) return;
    seen.add(s.href);
    const end = i + 1 < starts.length ? starts[i + 1].at : s.at + 20000;
    const it = parseCard(s.href, html.slice(s.at, end));
    if (it.price && it.title) items.push(it);
  });
  const total = num((html.match(/<title>[^<]*?([\d.]+) annunci/) || [])[1]) || items.length;
  return { items, total, pages: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

// Pagina del singolo annuncio: dati nel JSON-LD "Car", foto dal CDN
function detail(html) {
  if (!html) return null;
  let car = null;
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const d = JSON.parse(m[1]);
      if (d && [].concat(d['@type']).includes('Car')) car = d;
    } catch (e) { /* blocco non valido */ }
  }
  if (!car) return null;
  const off = car.offers || {};
  const sel = off.seller || {};
  const addr = sel.address || {};
  const eng = [].concat(car.vehicleEngine || [])[0] || {};
  const pw = [].concat(eng.enginePower || []);
  const hp = (pw.find((p) => p.unitCode === 'BHP') || {}).value;
  const kwv = (pw.find((p) => p.unitCode === 'KWT') || {}).value;
  const photos = [];
  (html.match(/https:\/\/cdn\.autosupermarket\.it\/photos\/prod\/\d+\/[0-9a-f]+\.jpg/g) || []).forEach((u) => { if (!photos.includes(u)) photos.push(u); });
  const titleTag = decode((html.match(/<title>([^<]*)/) || [])[1] || '');
  const drive = { FrontWheelDriveConfiguration: 'Anteriore', RearWheelDriveConfiguration: 'Posteriore', AllWheelDriveConfiguration: 'Integrale', FourWheelDriveConfiguration: 'Integrale' }[String(car.driveWheelConfiguration || '').replace('https://schema.org/', '')] || '';
  return {
    title: car.name || '',
    version: String(car.vehicleConfiguration || '').trim(),
    price: num(off.price),
    km: car.mileageFromOdometer ? num(car.mileageFromOdometer.value) : null,
    year: year(car.vehicleModelDate),
    reg: car.vehicleModelDate ? car.vehicleModelDate.slice(5, 7) + '/' + car.vehicleModelDate.slice(0, 4) : '',
    fuel: normFuel(eng.fuelType),
    fuelLabel: eng.fuelType || '',
    gear: normGear(car.vehicleTransmission),
    gearLabel: car.vehicleTransmission || '',
    cv: num(hp),
    kw: num(kwv),
    cc: eng.engineDisplacement && eng.engineDisplacement.value ? num(eng.engineDisplacement.value) : null,
    body: car.bodyType || '',
    color: car.color || '',
    doors: num(car.numberOfDoors),
    seats: num(car.seatingCapacity),
    drive,
    owners: typeof car.numberOfPreviousOwners === 'number' && car.numberOfPreviousOwners > 0 ? car.numberOfPreviousOwners : null,
    description: plain(String(car.description || '').replace(/\n/g, '<br>')),
    photos,
    equipment: [],
    seller: {
      name: sel.name || '',
      type: /privat/i.test(sel['@type'] || '') ? 'privato' : 'concessionario',
      city: [addr.streetAddress, [addr.postalCode, addr.addressLocality].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      phones: [],
      whatsapp: ''
    },
    posted: Date.parse(off.availabilityStarts) || null,
    market: null,
    removed: /OutOfStock|SoldOut|Discontinued/.test(off.availability || ''),
    headline: titleTag
  };
}

module.exports = { id: 'autosupermarket', name: 'AutoSuperMarket', url, parse, detail };

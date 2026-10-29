/*
 * Genera server/geo/comuni.json (comune -> coordinate, provincia -> capoluogo) per calcolare la distanza da casa.
 * Dati: pacchetto npm "italian-cap-comuni-province" (licenza MIT, dati ISTAT).
 *
 *   npm install --no-save italian-cap-comuni-province
 *   node scripts/build-geo.js [cartella del pacchetto]
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || path.join(__dirname, '..', 'node_modules', 'italian-cap-comuni-province', 'dist');
const file = fs.readdirSync(dir).find((f) => /^gi_comuni_cap.*\.json$/.test(f));
const rows = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

const key = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const r3 = (x) => Math.round(parseFloat(x) * 1000) / 1000;

const byName = {};
const prov = {};
const provName = {};
const seen = new Set();
rows.forEach((x) => {
  if (seen.has(x.codice_istat)) return; // più CAP per lo stesso comune
  seen.add(x.codice_istat);
  const p = [r3(x.lat), r3(x.lon), x.sigla_provincia];
  [x.denominazione_ita, x.denominazione_altra, x.denominazione_ita_altra].filter(Boolean).forEach((n) => {
    n.split('/').forEach((part) => {
      const k = key(part);
      if (!k) return;
      (byName[k] = byName[k] || []);
      if (!byName[k].some((q) => q[2] === p[2])) byName[k].push(p);
    });
  });
  if (x.flag_capoluogo === 'SI' || !prov[x.sigla_provincia]) prov[x.sigla_provincia] = [r3(x.lat), r3(x.lon)];
  provName[key(x.denominazione_provincia)] = x.sigla_provincia;
});

// nomi unici: [lat, lon, sigla]; nomi doppi (stesso nome in più province): lista
const c = {};
Object.keys(byName).forEach((k) => { c[k] = byName[k].length === 1 ? byName[k][0] : byName[k]; });

const out = { source: 'italian-cap-comuni-province (MIT, dati ISTAT)', c, p: prov, pn: provName };
const dest = path.join(__dirname, '..', 'server', 'geo', 'comuni.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('comuni:', Object.keys(c).length, 'province:', Object.keys(prov).length, '->', dest, Math.round(fs.statSync(dest).size / 1024) + ' KB');

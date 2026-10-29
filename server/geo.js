/*
 * Distanza da casa (Genova) per ogni annuncio, ricavata dalla città scritta nell'annuncio.
 * Italia: elenco dei comuni con coordinate (server/geo/comuni.json, da scripts/build-geo.js).
 * Estero: non abbiamo le città, usiamo un punto medio del paese (distanza indicativa, segnata con "~").
 */
const G = require('./geo/comuni.json');

const HOME = { name: 'Genova', lat: 44.4115, lon: 8.9327 };
// punto "medio" (dove sta la maggior parte degli annunci) di ogni paese
const COUNTRY = {
  DE: [50.6, 9.0], NL: [52.1, 5.3], BE: [50.8, 4.4], AT: [47.9, 14.5], FR: [46.0, 3.5], CH: [47.1, 8.0],
  ES: [40.4, -3.7], LU: [49.7, 6.1], SI: [46.1, 14.8], HR: [45.5, 15.8], MC: [43.74, 7.42], SM: [43.94, 12.45]
};

// nomi comuni scritti in modo diverso dall'elenco ufficiale
const ALIAS = { 'reggio emilia': 'reggio nell emilia', 'reggio calabria': 'reggio di calabria', 'bolzano bozen': 'bolzano',
  'pesaro urbino': 'pesaro', 'massa carrara': 'massa', 'forli cesena': 'forli', 'barletta andria trani': 'barletta' };

function key(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// "Montagnana - Padova - PD -", "Atessa (CH)", "Torino, TO", "Varedo" -> [lat, lon]
function italian(city) {
  const raw = String(city || '');
  const sig = ((raw.match(/\(([A-Za-z]{2})\)/) || [])[1] || (raw.match(/(?:^|[\s,-])([A-Z]{2})\s*-?\s*$/) || [])[1] || '').toUpperCase();
  const parts = raw.split(/\s+-\s+|,|\(|\)/).map(key).filter((p) => p && p.length > 2);
  for (const p0 of parts) {
    const p = ALIAS[p0] || p0;
    const hit = G.c[p];
    if (!hit) continue;
    if (typeof hit[0] === 'number') return hit;
    return hit.find((h) => h[2] === sig) || hit[0];
  }
  // città non trovata: provincia (sigla o nome)
  if (sig && G.p[sig]) return G.p[sig];
  for (const p of parts) if (G.pn[p] && G.p[G.pn[p]]) return G.p[G.pn[p]];
  return null;
}

// { dist: km interi, approx: true se è solo il paese }
function distance(it) {
  const country = String(it.country || '').toUpperCase();
  if (country && country !== 'IT') {
    const c = COUNTRY[country];
    return c ? { dist: Math.round(km([HOME.lat, HOME.lon], c) / 10) * 10, approx: true } : { dist: null, approx: true };
  }
  const p = italian(it.city);
  return p ? { dist: Math.round(km([HOME.lat, HOME.lon], p)), approx: false } : { dist: null, approx: false };
}

function addDistance(it) {
  const d = distance(it);
  it.dist = d.dist;
  if (d.approx) it.distApprox = true;
  return it;
}

module.exports = { HOME, distance, addDistance, italian, km };

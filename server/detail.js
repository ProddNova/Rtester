/*
 * Dettaglio di un annuncio: foto, descrizione, dotazioni, venditore.
 * Accetta SOLO link dei siti che sappiamo leggere (niente richieste verso indirizzi qualsiasi).
 * I link di Trovit sono redirect: li seguiamo leggendo solo l'intestazione "Location".
 */
const { getPage, BlockedError } = require('./fetch');
const SOURCES = {
  autoscout: require('./sources/autoscout'),
  autosupermarket: require('./sources/autosupermarket'),
  automobile: require('./sources/automobile'),
  trovit: require('./sources/trovit'),
  subito: require('./sources/subito')
};

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Quale lettore usare per questo link (null = sito non leggibile)
function sourceFor(u) {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.toLowerCase();
  if (h === 'www.autoscout24.it' && u.pathname.startsWith('/annunci/')) return 'autoscout';
  if (h === 'autosupermarket.it' && u.pathname.startsWith('/annunci/')) return 'autosupermarket';
  if (h === 'www.automobile.it' && /^\/[a-z0-9_-]+\/\d{5,}\/?$/i.test(u.pathname)) return 'automobile';
  if (h === 'auto.trovit.it' && u.pathname.startsWith('/listing/')) return 'trovit';
  if ((h === 'www.subito.it' || h === 'm.subito.it') && /^\/auto\/[^/]+-\d{6,}\.htm$/.test(u.pathname)) return 'subito';
  return null;
}

function isRedirector(u) {
  return u.protocol === 'https:' && /(^|\.)thribee\.com$/.test(u.hostname.toLowerCase());
}

// Segue i redirect di Trovit (max 5 passaggi) senza scaricare le pagine.
async function resolve(url) {
  let cur = url;
  for (let i = 0; i < 5; i++) {
    const u = new URL(cur);
    if (!isRedirector(u)) return cur;
    const res = await fetch(cur, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const loc = res.headers.get('location');
    if (!loc || res.status < 300 || res.status >= 400) return cur;
    cur = new URL(loc, cur).toString();
  }
  return cur;
}

async function getAd(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch (e) { return { error: 'link non valido', status: 400 }; }
  let url = u.toString();
  if (isRedirector(u)) {
    try { url = await resolve(url); } catch (e) { return { error: 'non raggiungibile', status: 502 }; }
    u = new URL(url);
  }
  const site = sourceFor(u);
  // Sito che non leggiamo (es. Subito): rimandiamo al link vero
  if (!site) return { external: true, url };
  try {
    const html = await getPage(url);
    const ad = html ? SOURCES[site].detail(html, url) : null;
    if (!ad) return { site, url, removed: true };
    return { site, url, ad, removed: !!ad.removed };
  } catch (e) {
    return { error: e instanceof BlockedError ? 'bloccato dal sito' : 'non raggiungibile', status: 502, site, url };
  }
}

module.exports = { getAd, sourceFor };

/*
 * Scarica una pagina con cache in memoria.
 * Volume basso di proposito: una ricerca = una pagina per sito, risultati tenuti 10 minuti.
 * Se un sito risponde con un blocco (403, pagina "Just a moment"), ci fermiamo: niente tentativi di aggirarlo.
 */
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const TTL = 10 * 60 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map();

class BlockedError extends Error {}

// Stessa pagina chiesta da due persone nello stesso momento: un solo download.
const inflight = new Map();

function getPage(url, opts) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.body);
  if (inflight.has(url)) return inflight.get(url);
  const p = download(url, opts).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

async function download(url, { timeout = 12000 } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT,it;q=0.9', Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout)
  });
  const body = await res.text();
  if (res.status === 403 || res.status === 429 || /<title>Just a moment/i.test(body.slice(0, 2000))) {
    throw new BlockedError('Il sito ha bloccato la richiesta (' + res.status + ')');
  }
  // 404 = nessun risultato per quel modello su quel sito: pagina vuota, non errore
  if (res.status === 404) return '';
  if (!res.ok) throw new Error('Risposta ' + res.status);

  cache.set(url, { t: Date.now(), body });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return body;
}

module.exports = { getPage, BlockedError };

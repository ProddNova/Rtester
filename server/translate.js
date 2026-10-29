/*
 * Traduzione in italiano con MyMemory (servizio gratuito, senza account).
 * Limiti del servizio: 500 caratteri a richiesta e qualche migliaio al giorno,
 * quindi il testo va a pezzi e le traduzioni restano in cache.
 * Facoltativo: MYMEMORY_EMAIL alza il limite giornaliero (50.000 caratteri).
 */
const LANG = require('../public/js/lang.js');

const cache = new Map();
const MAX_TEXT = 4000;

// Spezza il testo in pezzi <= 450 caratteri, rispettando righe e frasi.
function chunks(text) {
  const out = [];
  let cur = '';
  const parts = text.split(/(?<=[.!?\n])\s*/);
  parts.forEach((p) => {
    while (p.length > 450) { if (cur) { out.push(cur); cur = ''; } out.push(p.slice(0, 450)); p = p.slice(450); }
    if ((cur + ' ' + p).length > 450) { if (cur) out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p;
  });
  if (cur) out.push(cur);
  return out;
}

async function piece(q, from) {
  const url = 'https://api.mymemory.translated.net/get?langpair=' + from + '|it&q=' + encodeURIComponent(q) +
    (process.env.MYMEMORY_EMAIL ? '&de=' + encodeURIComponent(process.env.MYMEMORY_EMAIL) : '');
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  if (j.quotaFinished || j.responseStatus === 429) throw Object.assign(new Error('limite giornaliero di traduzioni raggiunto'), { status: 429 });
  if (j.responseStatus !== 200 || !j.responseData) throw new Error('traduzione non riuscita');
  return j.responseData.translatedText;
}

async function translate(text, from) {
  text = String(text || '').slice(0, MAX_TEXT).trim();
  if (!text) return { text: '', from: 'it' };
  from = /^(de|fr|en|es|nl)$/.test(from || '') ? from : LANG.detect(text);
  if (from === 'it') return { text, from };
  const key = from + ':' + text;
  if (cache.has(key)) return cache.get(key);
  const out = [];
  for (const c of chunks(text)) out.push(await piece(c, from));
  const res = { text: out.join(' ').replace(/ \n/g, '\n'), from };
  cache.set(key, res);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return res;
}

module.exports = { translate, chunks };

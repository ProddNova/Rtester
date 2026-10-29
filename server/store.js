/*
 * Archivio condiviso (salvati e ricerche salvate): uguale per tutti quelli che usano l'app.
 *
 * Su Render gratis il disco si azzera quando il server si riavvia. Per non perdere nulla senza
 * database esterni ogni telefono tiene una copia (vedi app.js): quando il server riparte con un
 * nuovo "bootId", ogni telefono che si collega rimanda la sua copia e il server le unisce.
 * Le cancellazioni sono ricordate ("tomb") così una copia vecchia non fa ricomparire roba tolta.
 *
 * Dove salva:
 *  - Upstash Redis se ci sono UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (facoltativo)
 *  - altrimenti file JSON in data/ (o DATA_DIR)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = 'cacciauto:'; // nome vecchio dell'app: resta così per non perdere i dati già salvati
const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const MAX_TOMB = 3000;

const mode = URL_ && TOKEN ? 'upstash' : 'file';
const bootId = crypto.randomBytes(6).toString('hex');

async function redis(cmd) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(8000)
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error('Upstash: ' + (j.error || res.status));
  return j.result;
}

function shape(raw) {
  // vecchio formato: solo l'elenco
  if (Array.isArray(raw)) return { items: raw, tomb: {} };
  return { items: Array.isArray(raw && raw.items) ? raw.items : [], tomb: (raw && raw.tomb) || {} };
}

async function readRaw(name) {
  if (mode === 'upstash') {
    const r = await redis(['GET', PREFIX + name]);
    return shape(r ? JSON.parse(r) : null);
  }
  try { return shape(JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8'))); } catch (e) { return shape(null); }
}

async function writeRaw(name, data) {
  const json = JSON.stringify(data);
  if (mode === 'upstash') return redis(['SET', PREFIX + name, json]);
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, name + '.json');
  fs.writeFileSync(file + '.tmp', json);
  fs.renameSync(file + '.tmp', file);
}

const cache = new Map();
let queue = Promise.resolve();

async function get(name) {
  if (mode === 'upstash' || !cache.has(name)) cache.set(name, await readRaw(name));
  return cache.get(name);
}

// fn(items, tomb) restituisce il nuovo elenco (tomb si può modificare direttamente)
function update(name, fn) {
  const job = queue.then(async () => {
    const cur = mode === 'upstash' ? await readRaw(name) : await get(name);
    const tomb = Object.assign({}, cur.tomb);
    const items = (await fn(cur.items.slice(), tomb)) || cur.items;
    const keys = Object.keys(tomb);
    if (keys.length > MAX_TOMB) keys.sort((a, b) => tomb[a] - tomb[b]).slice(0, keys.length - MAX_TOMB).forEach((k) => delete tomb[k]);
    const next = { items, tomb };
    await writeRaw(name, next);
    cache.set(name, next);
    return next;
  });
  queue = job.catch(() => {});
  return job;
}

// Unisce la copia di un telefono: aggiunge ciò che manca, rispetta le cancellazioni più recenti.
function restore(name, items, tomb, keyOf, stampOf) {
  return update(name, (list, t) => {
    Object.keys(tomb || {}).forEach((k) => { if (!t[k] || tomb[k] > t[k]) t[k] = tomb[k]; });
    const have = new Set(list.map(keyOf));
    (items || []).forEach((it) => {
      const k = keyOf(it);
      if (!k || have.has(k)) return;
      if (t[k] && t[k] >= (stampOf(it) || 0)) return; // cancellato dopo che era stato salvato
      have.add(k);
      list.push(it);
    });
    // tolti quelli cancellati (anche se arrivati da un altro telefono)
    return list.filter((it) => !(t[keyOf(it)] && t[keyOf(it)] >= (stampOf(it) || 0)));
  });
}

module.exports = { get, update, restore, mode, bootId };

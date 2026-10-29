/*
 * Archivio condiviso (salvati e ricerche salvate): uguale per tutti quelli che usano l'app.
 *
 * Due modalità:
 *  - Upstash Redis (gratis, permanente): basta impostare UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.
 *  - File JSON in data/ (o DATA_DIR): va bene in locale. Su Render gratis NON è permanente
 *    (il disco si azzera a ogni riavvio), per questo l'app avvisa.
 *
 * Le modifiche passano da una coda: una alla volta, così due salvataggi insieme non si sovrascrivono.
 */
const fs = require('fs');
const path = require('path');

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = 'cacciauto:';
const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const mode = URL_ && TOKEN ? 'upstash' : 'file';
const persistent = mode === 'upstash' || !process.env.RENDER;

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

async function readRaw(name) {
  if (mode === 'upstash') {
    const r = await redis(['GET', PREFIX + name]);
    return r ? JSON.parse(r) : [];
  }
  try { return JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8')); } catch (e) { return []; }
}

async function writeRaw(name, data) {
  const json = JSON.stringify(data);
  if (mode === 'upstash') return redis(['SET', PREFIX + name, json]);
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, name + '.json');
  fs.writeFileSync(file + '.tmp', json);
  fs.renameSync(file + '.tmp', file);
}

// Cache in memoria: la lista si legge una volta, poi si tiene aggiornata qui.
const cache = new Map();
let queue = Promise.resolve();

async function get(name) {
  if (mode === 'upstash' || !cache.has(name)) cache.set(name, await readRaw(name));
  return cache.get(name);
}

// fn riceve la lista, la modifica (o ne restituisce una nuova) e viene salvata.
function update(name, fn) {
  const job = queue.then(async () => {
    // con Upstash rileggiamo sempre: un altro server potrebbe averla cambiata
    const list = mode === 'upstash' ? await readRaw(name) : (await get(name)).slice();
    const next = (await fn(list)) || list;
    await writeRaw(name, next);
    cache.set(name, next);
    return next;
  });
  queue = job.catch(() => {});
  return job;
}

module.exports = { get, update, mode, persistent };

/*
 * Tieni sveglio il server gratuito di Render: senza visite per 15 minuti lo "addormenta"
 * e la prima ricerca dopo ci mette circa un minuto.
 * Ogni 10 minuti il server chiama il proprio indirizzo pubblico (conta come una visita).
 * Dalle 3:00 alle 8:00 (ora italiana) non lo fa: il server si riposa.
 *
 * Render imposta da solo RENDER_EXTERNAL_URL. Per spegnere questa funzione: KEEPALIVE=off.
 */
const EVERY = 10 * 60 * 1000;
const QUIET_FROM = 3;  // ore, ora italiana
const QUIET_TO = 8;

function romeHour(date) {
  return parseInt(new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(date || new Date()), 10) % 24;
}

function quiet(date) {
  const h = romeHour(date);
  return h >= QUIET_FROM && h < QUIET_TO;
}

function start() {
  const base = process.env.RENDER_EXTERNAL_URL;
  if (!base || process.env.KEEPALIVE === 'off') return null;
  const url = base.replace(/\/$/, '') + '/api/health?keepalive=1';
  const timer = setInterval(() => {
    if (quiet()) return;
    fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => { /* riproveremo al prossimo giro */ });
  }, EVERY);
  timer.unref();
  console.log('Tieni sveglio attivo: ' + url + ' ogni 10 minuti (pausa ' + QUIET_FROM + ':00-' + QUIET_TO + ':00)');
  return timer;
}

module.exports = { start, quiet, romeHour };

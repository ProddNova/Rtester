// Funzioni comuni ai lettori dei siti.

function num(s) {
  if (s === null || s === undefined) return null;
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? null : n;
}

// "Benzina/GPL", "Diesel - Euro 5", "Elettrica/Benzina", "Full Hybrid" -> chiave filtro
function normFuel(s) {
  const t = String(s || '').toLowerCase();
  if (!t) return '';
  if (/hybrid|ibrid/.test(t) || (/elettric/.test(t) && /benzina|diesel/.test(t))) return 'ibrida';
  if (/elettric/.test(t)) return 'elettrica';
  if (/gpl|lpg/.test(t)) return 'gpl';
  if (/metano|cng/.test(t)) return 'metano';
  if (/diesel|gasolio/.test(t)) return 'diesel';
  if (/benzina/.test(t)) return 'benzina';
  return '';
}

function normGear(s) {
  const t = String(s || '').toLowerCase();
  if (/autom|sequenz|semiautom/.test(t)) return 'automatico';
  if (/manual/.test(t)) return 'manuale';
  return '';
}

// "110 kW (150 CV)" / "115 CV (85 KW)" / "133kW (181 CV)" -> 150 / 115 / 181
function cv(s) {
  const m = String(s || '').match(/(\d+)\s*CV/i);
  return m ? +m[1] : null;
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
// "09-2004", "09/2004", "Ottobre 2009", "2009" -> anno
function year(s) {
  const m = String(s || '').match(/(19|20)\d\d/);
  return m ? +m[0] : null;
}

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d));
}

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

module.exports = { num, normFuel, normGear, cv, year, decode, nextData, MONTHS };

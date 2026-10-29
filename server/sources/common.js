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
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d));
}

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

module.exports = { num, normFuel, normGear, cv, year, decode, nextData, MONTHS };

// HTML della descrizione -> testo semplice (gli a-capo restano)
function plain(html) {
  return decode(String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<button[\s\S]*?<\/button>/gi, '')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Valutazione prezzo stile AutoScout24: 0 = sospetto, 1 = ottimo ... 6 = molto caro
const DEAL_LABELS = ['Prezzo sospetto', 'Ottimo prezzo', 'Buon prezzo', 'Nella media', 'Un po\' caro', 'Caro', 'Molto caro'];

module.exports.plain = plain;
module.exports.DEAL_LABELS = DEAL_LABELS;

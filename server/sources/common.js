// Funzioni comuni ai lettori dei siti.

function num(s) {
  if (s === null || s === undefined) return null;
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? null : n;
}

// "Benzina/GPL", "Diesel - Euro 5", "Elettrica/Benzina", "Full Hybrid" -> chiave filtro
// (capisce anche tedesco e olandese: Benzin, Benzine, Elektro, Elektrisch, Hybride, Erdgas, Autogas...)
function normFuel(s) {
  const t = String(s || '').toLowerCase();
  if (!t) return '';
  if (/hybri|ibrid/.test(t) || (/elettric/.test(t) && /benzina|diesel/.test(t))) return 'ibrida';
  if (/elettric|elektr/.test(t)) return 'elettrica';
  if (/gpl|lpg|autogas/.test(t)) return 'gpl';
  if (/metano|cng|erdgas/.test(t)) return 'metano';
  if (/diesel|gasolio/.test(t)) return 'diesel';
  if (/benzin/.test(t)) return 'benzina';
  return '';
}

function normGear(s) {
  const t = String(s || '').toLowerCase();
  if (/autom|sequenz|semiautom|\bdsg\b/.test(t)) return 'automatico';
  if (/manual|manuell|handgeschakeld|schaltgetriebe/.test(t)) return 'manuale';
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

// Valori della scheda in tedesco/olandese -> italiano ("Schwarz" -> "Nero", "Stationwagon" -> "Station wagon")
const WORDS = {
  schwarz: 'Nero', zwart: 'Nero', weiss: 'Bianco', 'weiß': 'Bianco', wit: 'Bianco', silber: 'Argento', zilver: 'Argento',
  grau: 'Grigio', grijs: 'Grigio', blau: 'Blu', blauw: 'Blu', rot: 'Rosso', rood: 'Rosso', 'grün': 'Verde', groen: 'Verde',
  gelb: 'Giallo', geel: 'Giallo', braun: 'Marrone', bruin: 'Marrone', orange: 'Arancione', oranje: 'Arancione', beige: 'Beige',
  gold: 'Oro', goud: 'Oro', violett: 'Viola', paars: 'Viola', bordeaux: 'Bordeaux',
  benzin: 'Benzina', benzine: 'Benzina', elektro: 'Elettrica', elektrisch: 'Elettrica', hybrid: 'Ibrida', hybride: 'Ibrida',
  erdgas: 'Metano', autogas: 'GPL', lpg: 'GPL', cng: 'Metano',
  manuell: 'Manuale', schaltgetriebe: 'Manuale', handgeschakeld: 'Manuale', automatik: 'Automatico', automaat: 'Automatico',
  limousine: 'Berlina', sedan: 'Berlina', kombi: 'Station wagon', stationwagon: 'Station wagon', kleinwagen: 'City car',
  hatchback: 'Berlina 2 volumi', cabriolet: 'Cabrio', cabrio: 'Cabrio', 'coupé': 'Coupé', coupe: 'Coupé', mpv: 'Monovolume',
  van: 'Monovolume', 'geländewagen': 'Fuoristrada', 'suv/geländewagen/pickup': 'SUV / Fuoristrada', 'suv of terreinwagen': 'SUV / Fuoristrada',
  vollleder: 'Pelle', leder: 'Pelle', teilleder: 'Pelle e tessuto', stoff: 'Tessuto', stof: 'Tessuto', 'leder en stof': 'Pelle e tessuto', alcantara: 'Alcantara',
  voorwiel: 'Anteriore', achterwiel: 'Posteriore', vierwiel: 'Integrale', allrad: 'Integrale', frontantrieb: 'Anteriore', heckantrieb: 'Posteriore'
};
function itWord(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  const k = t.toLowerCase();
  if (WORDS[k]) return WORDS[k];
  // "Handgeschakeld 6 versnellingen" / "Schwarz Metallic": traduce la prima parola, il resto lo lascia
  const m = k.match(/^([^\s,]+)(.*)$/);
  if (m && WORDS[m[1]]) return WORDS[m[1]] + t.slice(m[1].length).replace(/\bversnellingen\b/i, 'marce').replace(/\bmetallic\b/i, 'metallizzato');
  return t;
}

module.exports.plain = plain;
module.exports.itWord = itWord;
module.exports.DEAL_LABELS = DEAL_LABELS;

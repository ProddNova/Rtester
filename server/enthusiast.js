const MATCH = require('../public/js/match');

// La scheda deve descrivere proprio l'auto in vendita: niente parole pescate da descrizioni/SEO.
function matchesEnthusiast(it, r) {
  const t = MATCH.text(it);
  if (!MATCH.makeHit(t, r.make) || !MATCH.modelHit(t, r.model)) return false;
  if (!it.year || it.year < r.y[0] || it.year > r.y[1]) return false;
  if (!MATCH.kwHit(t, r.kw)) return false;
  if (r.variants && r.variants.length && !r.variants.some((v) => t.includes(MATCH.words(v)))) return false;
  if (r.minCV && it.cv && it.cv < r.minCV) return false;
  if (/diesel|gasolio/i.test(it.fuel || '') || / (tdi|tdci|cdti|jtd|jtdm|multijet|dci|hdi|tid|ttid|diesel) /.test(t)) return false;
  if (/ (r line|rline|n line|nline|gr sport|st line|stline|replica|replika|look|ricambi|schlachtfest) /.test(t)) return false;
  if (MATCH.flags((it.title || '') + ' ' + (it.version || '') + ' ' + (it.snippet || '')).some((f) => f.bad)) return false;
  return true;
}
module.exports = { matchesEnthusiast };

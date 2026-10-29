/*
 * Ricerca a testo libero: "saab 93 aero" -> { make: 'Saab', model: '9-3', kw: 'aero' }.
 * Riconosce marca e modello anche scritti male ("vw golf", "mx5", "serie3", "classe c"),
 * e lascia il resto come parole chiave (usate solo dai siti che le supportano).
 */
(function (root) {
  var D = root.CA_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function words(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9!.\-\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  // Cerca nella lista di parole una sequenza (1-3 parole unite) uguale a `target` normalizzato.
  function findSeq(ws, target, from) {
    for (var i = from || 0; i < ws.length; i++) {
      var joined = '';
      for (var j = i; j < Math.min(ws.length, i + 3); j++) {
        joined += norm(ws[j]);
        if (joined === target) return { i: i, len: j - i + 1 };
        if (joined.length >= target.length) break;
      }
    }
    return null;
  }

  function makeNames(mk) {
    return [mk.n].concat(mk.a || []).map(norm);
  }

  function findMake(ws) {
    var best = null;
    D.MAKES.forEach(function (mk) {
      makeNames(mk).forEach(function (name) {
        var hit = findSeq(ws, name);
        if (hit && (!best || name.length > best.score)) best = { make: mk, hit: hit, score: name.length };
      });
    });
    return best;
  }

  function findModel(mk, ws) {
    var best = null;
    var cands = mk.m.map(function (m) { return { name: m, key: norm(m) }; });
    var al = D.MODEL_ALIASES[mk.n] || {};
    Object.keys(al).forEach(function (k) { cands.push({ name: al[k], key: norm(k) }); });
    // Mercedes: "c" da solo, BMW: "330" -> Serie 3, ecc. li gestiamo con regole sotto.
    cands.forEach(function (c) {
      if (!c.key) return;
      var hit = findSeq(ws, c.key);
      if (hit && (!best || c.key.length > best.score)) best = { model: c.name, hit: hit, score: c.key.length };
    });
    if (!best && mk.n === 'BMW') {
      // 320d, 330ci, 525i... -> Serie 3 / Serie 5 (il numero resta come parola chiave)
      for (var i = 0; i < ws.length; i++) {
        var m = ws[i].match(/^([1-8])\d\d[a-z]*$/);
        if (m) return { model: 'Serie ' + m[1], hit: { i: i, len: 0 }, score: 1 };
      }
    }
    if (!best && mk.n === 'Mercedes-Benz') {
      for (var k = 0; k < ws.length; k++) {
        var mm = ws[k].match(/^([abcegsv])$/);
        if (mm) return { model: 'Classe ' + mm[1].toUpperCase(), hit: { i: k, len: 1 }, score: 1 };
      }
    }
    return best;
  }

  // Parole "filtro" riconosciute nel testo: diventano filtri veri invece di parole chiave.
  var EXTRA = {
    fuel: { benzina: 'benzina', diesel: 'diesel', gasolio: 'diesel', tdi: '', gpl: 'gpl', metano: 'metano', ibrida: 'ibrida', hybrid: 'ibrida', ibrido: 'ibrida', elettrica: 'elettrica', elettrico: 'elettrica' },
    gear: { manuale: 'manuale', automatica: 'automatico', automatico: 'automatico', auto: '' },
    body: { cabrio: 'cabrio', cabriolet: 'cabrio', spider: '', coupe: 'coupe', sw: 'sw', station: 'sw', wagon: 'sw', touring: '', suv: 'suv', berlina: 'berlina', citycar: 'citycar' }
  };

  function parseExtras(ws, used, res) {
    for (var i = 0; i < ws.length; i++) {
      if (used[i]) continue;
      var w = norm(ws[i]);
      ['fuel', 'gear', 'body'].forEach(function (f) {
        if (!used[i] && EXTRA[f][w]) { res[f] = EXTRA[f][w]; used[i] = 1; }
      });
      if (used[i]) continue;
      // "sotto 5000", "max 5k", "entro 3.500"
      if (/^(sotto|max|massimo|entro|budget)$/.test(w) && ws[i + 1]) {
        var p = money(ws[i + 1]);
        if (p) { res.pmax = p; used[i] = used[i + 1] = 1; continue; }
      }
      // "5k" da solo = budget massimo
      if (/^\d+(\.\d+)?k$/.test(ws[i])) { res.pmax = money(ws[i]); used[i] = 1; }
    }
  }
  function money(w) {
    var m = String(w).toLowerCase().match(/^(\d+(?:[.,]\d+)?)(k)?$/);
    if (!m) return 0;
    var n = m[2] ? parseFloat(m[1].replace(',', '.')) * 1000 : parseInt(m[1].replace(/[.,]/g, ''), 10);
    return n >= 100 ? Math.round(n) : 0;
  }

  function parseQuery(text) {
    var ws = words(text);
    var res = { make: '', model: '', kw: '' };
    if (!ws.length) return res;
    var mk = findMake(ws);
    var used = {};
    if (mk) {
      res.make = mk.make.n;
      for (var i = 0; i < mk.hit.len; i++) used[mk.hit.i + i] = 1;
      var rest = ws.map(function (w, idx) { return used[idx] ? '' : w; });
      var md = findModel(mk.make, rest);
      if (md) {
        res.model = md.model;
        for (var j = 0; j < md.hit.len; j++) used[md.hit.i + j] = 1;
      }
    } else {
      // Nessuna marca: proviamo solo il modello ("golf gti", "mx5", "panda 4x4").
      var bestAll = null;
      D.MAKES.forEach(function (m) {
        var md2 = findModel(m, ws);
        // Ignora i modelli troppo corti o solo numerici (es. "2", "500" sarebbe ambiguo).
        if (md2 && md2.score >= 3 && /[a-z]/.test(norm(md2.model)) && (!bestAll || md2.score > bestAll.md.score)) bestAll = { mk: m, md: md2 };
      });
      if (bestAll) {
        res.make = bestAll.mk.n;
        res.model = bestAll.md.model;
        for (var k = 0; k < bestAll.md.hit.len; k++) used[bestAll.md.hit.i + k] = 1;
      }
    }
    parseExtras(ws, used, res);
    res.kw = ws.filter(function (w, idx) { return !used[idx]; }).join(' ').trim();
    return res;
  }

  // Suggerimenti mentre si scrive: marche e "marca modello" che contengono il testo.
  function suggest(text, limit) {
    var q = norm(text);
    limit = limit || 8;
    if (!q) return [];
    var out = [];
    D.MAKES.forEach(function (mk) {
      var mn = norm(mk.n);
      if (mn.indexOf(q) === 0 || (mk.a || []).some(function (a) { return norm(a).indexOf(q) === 0; })) out.push({ make: mk.n, model: '', label: mk.n, score: 3 });
      mk.m.forEach(function (m) {
        var full = norm(mk.n + m), mo = norm(m);
        var aliasHit = (mk.a || []).some(function (a) { return (norm(a) + mo).indexOf(q) === 0; });
        if (full.indexOf(q) === 0 || aliasHit) out.push({ make: mk.n, model: m, label: mk.n + ' ' + m, score: 2 });
        else if (q.length >= 2 && mo.indexOf(q) === 0) out.push({ make: mk.n, model: m, label: mk.n + ' ' + m, score: 1 });
      });
    });
    out.sort(function (a, b) { return b.score - a.score || a.label.length - b.label.length; });
    return out.slice(0, limit);
  }

  var api = { parseQuery: parseQuery, suggest: suggest, norm: norm };
  root.CA_PARSE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

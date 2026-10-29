/*
 * Affari: quanto costa un'auto rispetto ad auto simili. Usato da telefono e server.
 *
 * 1) Auto simili: stesso modello, stessa alimentazione, anno ±2, km vicini (±30% o ±30.000), potenza ±25%.
 *    Con almeno 5 simili il prezzo "tipico" è la loro MEDIANA (robusta: un prezzo assurdo non sposta niente).
 * 2) Se le simili sono poche: formula log(prezzo) ~ anno + log(km), calcolata sul gruppo dopo aver tolto
 *    i prezzi anomali (residui oltre 2,5 volte la deviazione tipica) e ricalcolata.
 *
 * Risultato su ogni annuncio: est (prezzo tipico), dev (scostamento: -0,20 = 20% sotto), estN (quante auto
 * usate per il confronto), estHow ('simili' o 'stima').
 */
(function (root) {
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  // gruppo = marca + modello (prime due parole del titolo), oppure tutto insieme se la ricerca è già di un modello
  function groupOf(it) { return norm(it.title).split(' ').slice(0, 2).join(' '); }
  function usable(it) { return it.price > 300 && it.year && it.km !== null && it.km !== undefined && it.km >= 1000; }

  function similar(a, b) {
    if (Math.abs(a.year - b.year) > 2) return false;
    if (Math.abs(a.km - b.km) > Math.max(30000, 0.3 * Math.max(a.km, b.km))) return false;
    // alimentazione e potenza: se l'annuncio le ha, anche le simili devono averle (e uguali / vicine)
    if (a.fuel && b.fuel !== a.fuel) return false;
    if (a.cv && (!b.cv || Math.abs(a.cv - b.cv) > 0.25 * Math.max(a.cv, b.cv))) return false;
    return true;
  }

  // minimi quadrati con 3 incognite
  function solve3(A, b) {
    var m = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var i = 0; i < 3; i++) {
      var p = i;
      for (var r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
      if (Math.abs(m[p][i]) < 1e-9) return null;
      var t = m[i]; m[i] = m[p]; m[p] = t;
      for (var r2 = 0; r2 < 3; r2++) {
        if (r2 === i) continue;
        var f = m[r2][i] / m[i][i];
        for (var k = i; k < 4; k++) m[r2][k] -= f * m[i][k];
      }
    }
    return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  }
  var feat = function (it) { return [1, it.year - 2000, Math.log(it.km + 5000)]; };
  function fit(list) {
    var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    list.forEach(function (it) {
      var x = feat(it), y = Math.log(it.price);
      for (var i = 0; i < 3; i++) { b[i] += x[i] * y; for (var j = 0; j < 3; j++) A[i][j] += x[i] * x[j]; }
    });
    return solve3(A, b);
  }
  var predict = function (c, it) { var x = feat(it); return Math.exp(c[0] + c[1] * x[1] + c[2] * x[2]); };
  // formula robusta: calcola, toglie i prezzi anomali, ricalcola
  function robustFit(list) {
    if (list.length < 10) return null;
    var c = fit(list);
    if (!c) return null;
    var res = list.map(function (it) { return Math.log(it.price) - Math.log(predict(c, it)); });
    var mad = median(res.map(function (r) { return Math.abs(r - median(res)); })) * 1.4826 || 0.1;
    var kept = list.filter(function (it, i) { return Math.abs(res[i]) <= 2.5 * mad; });
    if (kept.length >= 10 && kept.length < list.length) c = fit(kept) || c;
    // una formula sensata: le auto più nuove costano di più, quelle con più km di meno
    if (!(c[1] > 0 && c[2] < 0)) return null;
    return c;
  }

  // Calcola est/dev su tutti gli annunci. opts.oneModel = la ricerca è già di un solo modello.
  function estimate(items, opts) {
    opts = opts || {};
    var groups = {};
    items.forEach(function (it) {
      delete it.est; delete it.dev; delete it.estN; delete it.estHow;
      var g = opts.oneModel ? 'all' : groupOf(it);
      (groups[g] = groups[g] || []).push(it);
    });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g].filter(usable);
      if (list.length < 5) return;
      var c = null, cTried = false;
      list.forEach(function (it) {
        // auto simili; se l'annuncio è estero e ce ne sono abbastanza, preferisce simili dallo stesso paese
        var comps = list.filter(function (o) { return o !== it && similar(it, o); });
        var same = comps.filter(function (o) { return (o.country || 'IT') === (it.country || 'IT'); });
        if (same.length >= 5) comps = same;
        var est = null, how = '';
        // senza potenza o alimentazione non sappiamo che versione è: il confronto non è affidabile
        if (comps.length >= 5 && it.fuel && it.cv) { est = median(comps.map(function (o) { return o.price; })); how = 'simili'; }
        else {
          if (!cTried) { c = robustFit(list); cTried = true; }
          if (c) { est = predict(c, it); how = 'stima'; }
        }
        if (!est || !isFinite(est)) return;
        it.est = Math.round(est / 50) * 50;
        it.dev = it.price / est - 1;
        it.estN = how === 'simili' ? comps.length : list.length;
        it.estHow = how;
      });
    });
    return items;
  }

  // Categoria come AutoScout24: 0 = troppo basso (sospetto), 1 = affare, 2 = buon prezzo, 3 = nella media,
  // 4 = un po' caro, 5 = caro, 6 = molto caro
  function category(dev) {
    if (typeof dev !== 'number') return null;
    return dev <= -0.4 ? 0 : dev <= -0.15 ? 1 : dev <= -0.07 ? 2 : dev < 0.08 ? 3 : dev < 0.2 ? 4 : dev < 0.35 ? 5 : 6;
  }

  var api = { estimate: estimate, category: category, similar: similar, median: median };
  root.CA_DEALS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

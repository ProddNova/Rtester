/*
 * Bacheca: riconoscimento sito, chiave unica dell'annuncio e caccia ai doppioni.
 *
 * Doppioni di due tipi:
 *  - "esatti": stesso annuncio (stesso ID anche se il link ha parametri diversi, versione mobile, ecc.)
 *  - "probabili": la stessa auto pubblicata su siti diversi (stesso prezzo ±5%, stessi km ±2%,
 *    stesso anno, titolo simile). Capita spessissimo con i concessionari.
 */
(function (root) {
  var HOSTS = [
    { id: 'subito', name: 'Subito', re: /(^|\.)subito\.it$/ },
    { id: 'autoscout', name: 'AutoScout24', re: /(^|\.)autoscout24\.[a-z.]+$/ },
    { id: 'autosupermarket', name: 'AutoSuperMarket', re: /(^|\.)autosupermarket\.it$/ },
    { id: 'automobile', name: 'Automobile.it', re: /(^|\.)automobile\.it$/ },
    { id: 'ilparking', name: 'ilParking', re: /(^|\.)ilparking\.it$/ },
    { id: 'facebook', name: 'Marketplace', re: /(^|\.)(facebook\.com|fb\.com)$/ },
    { id: 'ebay', name: 'eBay', re: /(^|\.)ebay\.[a-z.]+$/ },
    { id: 'mobilede', name: 'mobile.de', re: /(^|\.)mobile\.de$/ },
    { id: 'autouncle', name: 'AutoUncle', re: /(^|\.)autouncle\.[a-z.]+$/ },
    { id: 'trovit', name: 'Trovit', re: /(^|\.)(trovit\.it|thribee\.com)$/ },
    { id: 'kleinanzeigen', name: 'Kleinanzeigen', re: /(^|\.)kleinanzeigen\.de$/ },
    { id: 'marktplaats', name: 'Marktplaats', re: /(^|\.)marktplaats\.nl$/ }
  ];

  function strip(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Trova il primo link in un testo (le app condividono spesso "Titolo https://...").
  function extractUrl(text) {
    var m = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
    if (!m) return '';
    return m[0].replace(/[).,;!?]+$/, '');
  }

  function parseUrl(url) {
    try { return new URL(url); } catch (e) { return null; }
  }

  function detectSite(url) {
    var u = parseUrl(url);
    if (!u) return { id: 'altro', name: 'Link' };
    var host = u.hostname.toLowerCase();
    for (var i = 0; i < HOSTS.length; i++) if (HOSTS[i].re.test(host)) return { id: HOSTS[i].id, name: HOSTS[i].name };
    return { id: 'altro', name: host.replace(/^(www|m)\./, '') };
  }

  // Chiave unica di un annuncio: ID del sito se lo riconosciamo, altrimenti link "pulito".
  function listingKey(url) {
    var u = parseUrl(url);
    if (!u) return 'raw:' + String(url || '').trim().toLowerCase();
    var site = detectSite(url).id;
    var path = decodeURIComponent(u.pathname);
    var m;
    if (site === 'subito' && (m = path.match(/(\d{6,})\.htm/))) return 'subito:' + m[1];
    if (site === 'trovit' && (m = path.match(/\/id\.([A-Za-z0-9]+)\//))) return 'trovit:' + m[1];
    if (site === 'kleinanzeigen' && (m = path.match(/\/s-anzeige\/(?:[^/]+\/)?(\d{6,})-\d+-\d+/))) return 'kleinanzeigen:' + m[1];
    if (site === 'marktplaats' && (m = path.match(/\/(m\d{6,})(?:-|$)/))) return 'marktplaats:' + m[1];
    if (site === 'autoscout' && (m = path.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i))) return 'autoscout:' + m[1].toLowerCase();
    if (site === 'autosupermarket' && (m = path.match(/-([0-9a-f]{12,})\/?$/i))) return 'autosupermarket:' + m[1].toLowerCase();
    if (site === 'automobile' && (m = path.match(/\/(\d{6,})\/?$/))) return 'automobile:' + m[1];
    if (site === 'facebook' && (m = path.match(/\/marketplace\/item\/(\d+)/))) return 'facebook:' + m[1];
    if (site === 'ebay' && (m = path.match(/\/itm\/(?:[^/]+\/)?(\d{9,})/))) return 'ebay:' + m[1];
    if (site === 'mobilede') {
      var id = u.searchParams.get('id') || ((m = path.match(/(\d{6,})\.html/)) && m[1]);
      if (id) return 'mobilede:' + id;
    }
    var host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    return host + path.toLowerCase().replace(/\/+$/, '');
  }

  // Titolo leggibile dallo slug del link: ".../saab-9-3-vector-tid-123456.htm" -> "Saab 9 3 Vector Tid"
  function titleFromUrl(url) {
    var u = parseUrl(url);
    if (!u) return '';
    var segs = decodeURIComponent(u.pathname).split('/').filter(Boolean);
    var best = '';
    segs.forEach(function (sg) {
      sg = sg.replace(/\.(html?|php|aspx?)$/i, '');
      sg = sg.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig, '');
      sg = sg.replace(/-?[0-9a-f]{12,}$/i, '').replace(/-?\d{6,}$/, '');
      var words = sg.split(/[-_+]+/).filter(Boolean);
      var letters = words.filter(function (w) { return /[a-z]/i.test(w); }).length;
      if (letters >= 2 && sg.length > best.length) best = words.join(' ');
    });
    if (!best) return '';
    // "9 3" -> "9-3" (modelli), "1 9" -> "1.9" (cilindrate): due cifre singole di fila
    best = best.replace(/\b(\d) (\d)\b/g, function (m, a, b) { return a + (Number(a) <= 6 ? '.' : '-') + b; });
    return best.split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
  }

  function toInt(s) {
    var n = parseInt(String(s).replace(/[.\s']/g, ''), 10);
    return isNaN(n) ? null : n;
  }

  // Estrae prezzo, km e anno da un testo libero (titolo condiviso, descrizione...).
  function parseDetails(text) {
    var t = ' ' + String(text || '') + ' ';
    var out = { price: null, km: null, year: null };
    var N = '(\\d{1,3}(?:[.\\s\']\\d{3})+|\\d{1,7})';
    var m = t.match(new RegExp(N + '\\s?(?:km|chilometri)\\b', 'i'));
    if (m) { out.km = toInt(m[1]); t = t.replace(m[0], ' '); }
    m = t.match(new RegExp('€\\s?' + N)) || t.match(new RegExp(N + '\\s?(?:€|eur\\b|euro\\b)', 'i'));
    if (m) { out.price = toInt(m[1]); t = t.replace(m[0], ' '); }
    var maxYear = new Date().getFullYear() + 1;
    var ys = t.match(/\b(19[5-9]\d|20\d\d)\b/g) || [];
    for (var i = 0; i < ys.length; i++) {
      var y = parseInt(ys[i], 10);
      if (y <= maxYear) { out.year = y; break; }
    }
    return out;
  }

  var STOP = { auto: 1, usata: 1, usato: 1, usate: 1, vendita: 1, vendo: 1, annuncio: 1, annunci: 1, km: 1, euro: 1, the: 1, con: 1, del: 1, della: 1, per: 1, in: 1, di: 1, da: 1 };
  // "Saab 9 - 3 1.9 TiD" -> ['saab', '93', '19', 'tid']: i numeri con trattini/punti restano uniti
  function tokens(s) {
    var t = strip(s).toLowerCase().replace(/(\d)\s*[-.\/]\s*(?=\d)/g, '$1');
    return t.split(/[^a-z0-9]+/).filter(function (w) { return (w.length >= 2 || /\d/.test(w)) && !STOP[w]; });
  }
  function uniq(arr) {
    return arr.filter(function (w, i) { return arr.indexOf(w) === i; });
  }
  function overlap(a, b) {
    // Parole in comune / parole del titolo più corto (insiemi, senza ripetizioni).
    var A = uniq(tokens(a)), B = uniq(tokens(b));
    if (!A.length || !B.length) return 0;
    var common = A.filter(function (w) { return B.indexOf(w) !== -1; }).length;
    return common / Math.min(A.length, B.length);
  }
  function rel(a, b) { return Math.abs(a - b) / Math.max(a, b); }

  // Punteggio 0..1: quanto è probabile che due annunci siano la stessa auto.
  //  - prezzo e km praticamente identici (±1%) e stesso anno: è lei, anche se i titoli sono scritti diversi
  //  - prezzo ±5%, km ±2%, stesso anno e titolo simile: probabilmente lei (ritocco di prezzo tra un sito e l'altro)
  //  - senza km: serve prezzo quasi uguale, stesso anno e titolo molto simile
  function sameCar(a, b) {
    if (!a.price || !b.price) return 0;
    if (a.year && b.year && a.year !== b.year) return 0;
    var ta = a.title || '', tb = b.title || '';
    var ov = ta && tb ? overlap(ta, tb) : 0.5;      // 0 = titoli senza niente in comune (auto diverse)
    var pd = rel(a.price, b.price);
    var kmA = a.km >= 1000 ? a.km : 0, kmB = b.km >= 1000 ? b.km : 0;
    if (kmA && kmB) {
      var kd = rel(kmA, kmB);
      if (pd <= 0.01 && kd <= 0.01 && (a.year || b.year) && ov > 0) return 0.9;
      if (pd <= 0.05 && kd <= 0.02 && ov >= 0.25) return 0.6 + ov * 0.4;
      return 0;
    }
    if (a.year && b.year && pd <= 0.01 && ov >= 0.6) return 0.55;
    // regola larga solo se i km non li conosciamo proprio (le auto nuove a 0 km si somigliano tutte)
    var known = function (v) { return v !== null && v !== undefined && v !== ''; };
    if (a.year && b.year && pd <= 0.05 && ov >= 0.5 && !known(a.km) && !known(b.km)) return 0.4 + ov * 0.3;
    return 0;
  }

  // Unisce annunci della stessa auto: ne resta uno, gli altri finiscono in "also" (sito, link, prezzo).
  // Sullo stesso sito unisce solo se prezzo e km sono identici (concessionario che ripubblica).
  function mergeListings(existing, incoming) {
    var list = existing.slice();
    var keys = {};
    list.forEach(function (x) {
      keys[x.key || listingKey(x.url)] = 1;
      (x.also || []).forEach(function (o) { keys[listingKey(o.url)] = 1; });
    });
    incoming.forEach(function (inc) {
      var k = inc.key || listingKey(inc.url);
      if (keys[k]) return;
      keys[k] = 1;
      var probe = { title: inc.title + ' ' + (inc.version || ''), price: inc.price, km: inc.km, year: inc.year };
      var twin = null;
      for (var i = 0; i < list.length && !twin; i++) {
        var o = list[i];
        var score = sameCar({ title: o.title + ' ' + (o.version || ''), price: o.price, km: o.km, year: o.year }, probe);
        if (score <= 0.5) continue;
        if (o.site === inc.site && !(o.price === inc.price && o.km === inc.km && o.km >= 1000)) continue;
        twin = o;
      }
      if (twin) {
        twin.also = (twin.also || []).concat([{ site: inc.site, url: inc.url, price: inc.price }]);
        if (!twin.image && inc.image) twin.image = inc.image;
        ['km', 'year', 'cv', 'fuel', 'gear', 'city', 'posted'].forEach(function (f) { if (!twin[f] && inc[f]) twin[f] = inc[f]; });
      } else {
        list.push(Object.assign({}, inc, { key: k, also: (inc.also || []).slice() }));
      }
    });
    return list;
  }

  function findDuplicate(list, item) {
    var key = item.key || listingKey(item.url);
    var best = null, bestScore = 0;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x.key === key) return { type: 'exact', item: x, score: 1 };
      var sc = sameCar(item, x);
      if (sc > bestScore) { bestScore = sc; best = x; }
    }
    return best ? { type: 'probable', item: best, score: bestScore } : null;
  }

  function newerVote(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return (b.t || 0) > (a.t || 0) ? b : a;
  }

  // Unisce la bacheca dell'amico nella mia, senza doppioni esatti.
  function mergeBoards(local, incoming) {
    var list = local.slice();
    var stats = { added: 0, merged: 0, probable: 0 };
    incoming.forEach(function (inc) {
      if (!inc || !inc.url) return;
      inc.key = inc.key || listingKey(inc.url);
      var dup = findDuplicate(list, inc);
      if (dup && dup.type === 'exact') {
        var x = dup.item;
        var votes = x.votes || {};
        var iv = inc.votes || {};
        x.votes = { a: newerVote(votes.a, iv.a), b: newerVote(votes.b, iv.b) };
        ['title', 'price', 'km', 'year', 'note'].forEach(function (f) { if (!x[f] && inc[f]) x[f] = inc[f]; });
        stats.merged++;
        return;
      }
      if (dup) { inc.dupOf = dup.item.key; stats.probable++; }
      list.push(inc);
      stats.added++;
    });
    return { list: list, stats: stats };
  }

  // Bacheca <-> testo compatto da mettere in un link (#b=...).
  function b64encode(str) {
    var b64;
    if (typeof Buffer !== 'undefined') b64 = Buffer.from(str, 'utf8').toString('base64');
    else {
      var bytes = new TextEncoder().encode(str), bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      b64 = btoa(bin);
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64decode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function packVote(v) { return v ? [v.v, v.t] : 0; }
  function unpackVote(v) { return Array.isArray(v) ? { v: v[0], t: v[1] } : null; }

  function encodeBoard(list, from) {
    var rows = list.map(function (x) {
      var v = x.votes || {};
      return [x.url, x.title || '', x.price || 0, x.km || 0, x.year || 0, x.note || '', x.addedBy || '', x.addedAt || 0, packVote(v.a), packVote(v.b), x.image || '', x.alts || []];
    });
    return b64encode(JSON.stringify({ v: 1, f: from || '', r: rows }));
  }
  function decodeBoard(code) {
    var obj = JSON.parse(b64decode(code));
    if (!obj || obj.v !== 1 || !Array.isArray(obj.r)) throw new Error('Formato non valido');
    return {
      from: obj.f || '',
      // solo link http(s): un link "javascript:" arrivato da fuori non deve finire in un href
      list: obj.r.filter(function (r) { return Array.isArray(r) && /^https?:\/\//i.test(String(r[0])); }).map(function (r) {
        return {
          url: String(r[0]), key: listingKey(String(r[0])), site: detectSite(String(r[0])).id,
          title: r[1] || '', price: r[2] || null, km: r[3] || null, year: r[4] || null,
          note: r[5] || '', addedBy: r[6] || '', addedAt: r[7] || Date.now(),
          votes: { a: unpackVote(r[8]), b: unpackVote(r[9]) },
          image: typeof r[10] === 'string' && /^https:\/\//.test(r[10]) ? r[10] : '',
          alts: Array.isArray(r[11]) ? r[11].filter(function (u) { return /^https?:\/\//.test(u); }) : []
        };
      })
    };
  }

  function encodeJson(obj) { return b64encode(JSON.stringify(obj)); }
  function decodeJson(code) { return JSON.parse(b64decode(code)); }

  var api = {
    encodeJson: encodeJson, decodeJson: decodeJson,
    extractUrl: extractUrl, detectSite: detectSite, listingKey: listingKey, titleFromUrl: titleFromUrl,
    parseDetails: parseDetails, sameCar: sameCar, findDuplicate: findDuplicate, mergeBoards: mergeBoards,
    encodeBoard: encodeBoard, decodeBoard: decodeBoard, overlap: overlap, mergeListings: mergeListings
  };
  root.CA_DEDUP = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* CacciAuto - interfaccia.
 * Pagine (nell'indirizzo dopo #): /  ricerca · /risultati · /annuncio?u=LINK · /salvati
 * Annunci, dettagli e salvati arrivano dal server; sul telefono restano solo comodità
 * (ultima ricerca, annunci già visti, nascosti). */
(function () {
  'use strict';
  var D = window.CA_DATA, S = window.CA_SITES, X = window.CA_DEDUP;
  var $ = function (id) { return document.getElementById(id); };

  var SITE_NAMES = { autoscout: 'AutoScout24', autosupermarket: 'AutoSuperMarket', automobile: 'Automobile.it', trovit: 'Trovit', subito: 'Subito', facebook: 'Marketplace', ilparking: 'ilParking' };
  var SITE_SHORT = { autoscout: 'AS24', autosupermarket: 'ASM', automobile: 'AM.it', trovit: 'Trovit', subito: 'Subito', facebook: 'FB', ilparking: 'ilParking' };
  var DEAL = ['Molto basso', 'Affare', 'Buon prezzo', 'Nella media', 'Un po\' caro', 'Caro', 'Molto caro'];
  var EMPTY = { make: '', model: '', kw: '', pmin: '', pmax: '', ymin: '', ymax: '', kmmin: '', kmmax: '', fuel: '', gear: '', body: '', seller: '', cvmin: '', cvmax: '', region: '', europe: false, sort: 'rilevanza' };
  var FORM_FIELDS = ['make', 'model', 'kw', 'pmin', 'pmax', 'ymin', 'ymax', 'kmmin', 'kmmax', 'fuel', 'gear', 'body', 'seller', 'cvmin', 'cvmax', 'region'];

  // ---------------------------------------------------------------- memoria locale (solo comodità)
  function lget(k, def) { try { var v = localStorage.getItem('ca3.' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function lset(k, v) { try { localStorage.setItem('ca3.' + k, JSON.stringify(v)); } catch (e) { /* pieno o bloccato */ } }

  var state = {
    search: Object.assign({}, EMPTY, lget('search', {})),
    seen: lget('seen', {}),          // chiave -> quando l'abbiamo visto la prima volta
    hidden: lget('hidden', {}),      // annunci nascosti
    visited: lget('visited', {}),    // annunci aperti
    recent: lget('recent', []),
    saved: [], savedLoaded: false,
    mirror: lget('mirror', { saved: { items: [], tomb: {} }, searches: { items: [], tomb: {} }, boot: {} }),
    searches: [],
    showHidden: false
  };
  var hadSeen = Object.keys(state.seen).length > 0;
  var results = { sig: '', items: [], page: 0, hasMore: false, loading: false, sources: [], links: [] };
  var byUrl = {};                    // link -> annuncio dalla lista (per aprire il dettaglio subito)

  // ---------------------------------------------------------------- utilità
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== '') el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  // Icone Lucide (public/js/icons.js): ic('star') -> <svg>
  var ICONS = window.CA_ICONS || {};
  function ic(name, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = ICONS[name] || '';
    return s;
  }
  // contenuto "icona + testo" per bottoni e etichette
  function it2(name, text) { return [ic(name), h('span', { text: text })]; }
  function setLabel(el, name, text) { el.innerHTML = ''; it2(name, text).forEach(function (n) { el.appendChild(n); }); }

  var toastTimer;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }
  function dots(n) { return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function eur(n) { return n ? dots(n) + ' €' : 'Prezzo n.d.'; }
  function kmf(n) { return n || n === 0 ? dots(n) + ' km' : ''; }
  function int(v) { var n = parseInt(v, 10); return isNaN(n) || n <= 0 ? '' : n; }
  function kshort(n) { n = Number(n); return n >= 1000 ? String(Math.round(n / 100) / 10).replace('.', ',') + 'k' : String(n); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function labelOf(list, k) { var x = list.filter(function (i) { return i.k === k; })[0]; return x ? x.n : k; }
  function ago(t) {
    if (!t) return '';
    var d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return 'oggi';
    if (d === 1) return 'ieri';
    if (d < 60) return d + ' giorni fa';
    return Math.round(d / 30) + ' mesi fa';
  }
  function agoShort(t) { return ago(t); }
  function keyOf(it) { return X.listingKey(it.url); }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ('Errore ' + r.status));
        return j;
      });
    });
  }
  function post(path, body) {
    return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  // ---------------------------------------------------------------- form di ricerca
  var PRICES = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12500, 15000, 17500, 20000, 25000, 30000, 40000, 50000, 75000, 100000, 150000];
  var KMS = [5000, 10000, 25000, 50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000, 300000];
  function fillSelect(sel, list) { list.forEach(function (i) { sel.appendChild(h('option', { value: i.k, text: i.n })); }); }

  function buildForm() {
    var f = $('searchForm');
    fillMakes();
    fillSelect($('fFuel'), D.FUELS);
    fillSelect($('fGear'), D.GEARS);
    fillSelect($('fBody'), D.BODIES);
    fillSelect($('fRegion'), D.REGIONS.map(function (r) { return { k: r.k, n: r.n }; }));
    var thisYear = new Date().getFullYear();
    var years = [];
    for (var y = thisYear; y >= 1950; y--) years.push({ k: String(y), n: String(y) });
    Array.prototype.forEach.call(f.querySelectorAll('select[data-list]'), function (sel) {
      var t = sel.getAttribute('data-list');
      if (t === 'year') fillSelect(sel, years);
      if (t === 'price') fillSelect(sel, PRICES.map(function (p) { return { k: String(p), n: dots(p) + ' €' }; }));
      if (t === 'km') fillSelect(sel, KMS.map(function (k) { return { k: String(k), n: dots(k) + ' km' }; }));
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      state.search = readForm();
      $('adv').hidden = true;
      results.sig = ''; // "Cerca" ricarica sempre
      go('#/risultati');
    });
    $('btnReset').addEventListener('click', function () { writeForm(EMPTY); updateMoreCount(); });
    $('btnMore').addEventListener('click', function () { $('adv').hidden = false; });
    $('btnAdvClose').addEventListener('click', function () { $('adv').hidden = true; updateMoreCount(); });
    $('adv').addEventListener('click', function (e) { if (e.target === $('adv')) { $('adv').hidden = true; updateMoreCount(); } });
    f.addEventListener('change', updateMoreCount);
    QUICK.forEach(function (q) {
      $('quickChips').appendChild(h('button', { class: 'chip plain quickc', type: 'button', on: { click: function () { applySearch(q.s); } } }, it2(q.i, q.n)));
    });
  }

  var ADV_FIELDS = ['kw', 'pmin', 'ymax', 'kmmin', 'kmmax', 'fuel', 'gear', 'body', 'seller', 'cvmin', 'cvmax', 'region'];
  function updateMoreCount() {
    var f = $('searchForm'), n = 0;
    ADV_FIELDS.forEach(function (k) { if (String(f.elements[k].value || '').trim()) n++; });
    if (f.elements.europe.checked) n++;
    $('moreCount').hidden = !n;
    $('moreCount').textContent = n;
  }

  // Ricerche al volo, senza mettere filtri a mano
  var QUICK = [
    { i: 'wallet', n: 'Sotto 2.000 €', s: { pmax: '2000' } },
    { i: 'wallet', n: 'Sotto 5.000 €', s: { pmax: '5000' } },
    { i: 'history', n: 'Youngtimer anni 80-90', s: { ymin: '1980', ymax: '1999' } },
    { i: 'sun', n: 'Cabrio', s: { body: 'cabrio' } },
    { i: 'car', n: 'Coupé', s: { body: 'coupe' } },
    { i: 'zap', n: 'Oltre 200 CV', s: { cvmin: '200' } },
    { i: 'mountain', n: 'SUV e 4x4', s: { body: 'suv', pmax: '15000' } },
    { i: 'user', n: 'Neopatentati', s: { cvmax: '95', ymin: '2010', pmax: '10000' } },
    { i: 'fuel', n: 'Station wagon diesel', s: { body: 'sw', fuel: 'diesel', pmax: '8000' } },
    { i: 'user', n: 'Solo privati', s: { seller: 'privato' } }
  ];

  // Elenco completo marche/modelli (models.js, da AutoScout24); se manca, la lista ridotta di data.js
  var POPULAR_MAKES = ['Fiat', 'Volkswagen', 'Ford', 'Opel', 'Peugeot', 'Renault', 'Toyota', 'Audi', 'BMW', 'Mercedes-Benz', 'Alfa Romeo', 'Lancia', 'Citroen', 'Jeep', 'Dacia', 'Kia', 'Hyundai', 'Nissan', 'Skoda', 'Seat', 'MINI', 'Smart', 'Volvo', 'Mazda', 'Suzuki', 'Land Rover', 'Porsche', 'Honda', 'Subaru', 'Saab'];
  function makesList() {
    if (window.CA_MODELS && window.CA_MODELS.makes) return window.CA_MODELS.makes.map(function (m) { return { n: m.n, g: m.g || [], m: (m.m || []).map(function (x) { return x[0]; }) }; });
    return D.MAKES.map(function (m) { return { n: m.n, g: [], m: m.m }; });
  }
  var MAKES = null, MODELS_OF = { groups: [], models: [] };
  function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function makeInfo(name) { return (MAKES || []).filter(function (m) { return m.n === name; })[0] || null; }

  /* Campo con ricerca: scrivi e la lista sotto si filtra. Il valore vale solo se è uno di quelli in elenco
   * (alla fine si sceglie quello più simile), così le ricerche ai siti usano nomi giusti. */
  function combo(input, getGroups, onPick) {
    var wrap = input.parentNode;
    var list = h('div', { class: 'combo-list', role: 'listbox' });
    list.hidden = true;
    wrap.appendChild(list);
    var hl = -1, buttons = [];
    function all() { var out = []; getGroups('').forEach(function (g) { out = out.concat(g.items); }); return out; }
    function render() {
      var q = norm(input.value);
      var groups = getGroups(q);
      list.innerHTML = '';
      buttons = [];
      hl = -1;
      var count = 0;
      groups.forEach(function (g) {
        if (!g.items.length) return;
        if (g.label) list.appendChild(h('div', { class: 'grp', text: g.label }));
        g.items.forEach(function (v) {
          if (count++ > 250) return;
          var b = h('button', { type: 'button', role: 'option', on: {
            mousedown: function (e) { e.preventDefault(); },
            click: function () { choose(v); input.blur(); }
          } }, highlight(v, input.value));
          buttons.push({ el: b, v: v });
          list.appendChild(b);
        });
      });
      if (!buttons.length) list.appendChild(h('div', { class: 'none', text: 'Nessun risultato' }));
    }
    function highlight(v, q) {
      var i = q ? v.toLowerCase().indexOf(q.toLowerCase()) : -1;
      if (i < 0) return [v];
      return [v.slice(0, i), h('mark', { text: v.slice(i, i + q.length) }), v.slice(i + q.length)];
    }
    function open() { render(); list.hidden = false; }
    function close() { list.hidden = true; }
    function choose(v) { input.value = v; close(); onPick(v); }
    // valore finale: uguale a uno in elenco (ignorando maiuscole/spazi), oppure il primo risultato, oppure vuoto
    function commit() {
      var q = norm(input.value);
      if (!q) { if (input.dataset.last) onPick(''); input.dataset.last = ''; return; }
      var exact = all().filter(function (v) { return norm(v) === q; })[0];
      var best = exact;
      if (!best) { var g = getGroups(q); for (var i = 0; i < g.length && !best; i++) best = g[i].items[0]; }
      input.value = best || '';
      if ((best || '') !== input.dataset.last) onPick(best || '');
    }
    input.addEventListener('focus', function () { input.select(); open(); });
    input.addEventListener('input', open);
    input.addEventListener('blur', function () { setTimeout(function () { close(); commit(); }, 120); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!buttons.length) return;
        if (hl >= 0) buttons[hl].el.classList.remove('hl');
        hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[hl].el.classList.add('hl');
        buttons[hl].el.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var pickV = hl >= 0 ? buttons[hl].v : (buttons[0] && norm(input.value) ? buttons[0].v : input.value);
        choose(pickV);
        input.blur();
      } else if (e.key === 'Escape') { close(); input.blur(); }
    });
    var clear = wrap.querySelector('.clear');
    if (clear) clear.addEventListener('click', function (e) { e.preventDefault(); input.value = ''; input.dataset.last = ''; onPick(''); if (!input.disabled) input.focus(); });
    return { commit: commit, set: function (v) { input.value = v || ''; input.dataset.last = v || ''; } };
  }

  // filtra un elenco: prima chi inizia con il testo (anche una parola interna), poi chi lo contiene
  function filterNames(names, q) {
    if (!q) return names;
    var starts = [], contains = [];
    names.forEach(function (n) {
      var nn = norm(n);
      var parts = n.split(/[\s\-\/]+/).map(norm);
      if (nn.indexOf(q) === 0 || parts.some(function (p) { return p.indexOf(q) === 0; })) starts.push(n);
      else if (nn.indexOf(q) !== -1) contains.push(n);
    });
    return starts.concat(contains);
  }

  var makeCombo, modelCombo;
  function fillMakes() {
    MAKES = makesList();
    var names = MAKES.map(function (m) { return m.n; }).sort(function (a, b) { return a.localeCompare(b, 'it'); });
    var pop = POPULAR_MAKES.filter(function (n) { return names.indexOf(n) !== -1; });
    makeCombo = combo($('fMake'), function (q) {
      if (!q) return [{ label: 'Più cercate', items: pop }, { label: 'Tutte le marche (' + names.length + ')', items: names }];
      return [{ label: '', items: filterNames(names, q) }];
    }, function (v) {
      $('fMake').dataset.last = v;
      fillModels(v, '');
      if (v) setTimeout(function () { $('fModel').focus(); }, 60);
    });
    modelCombo = combo($('fModel'), function (q) {
      var byName = function (a, b) { return a.localeCompare(b, 'it', { numeric: true }); };
      var g = MODELS_OF.groups.slice().sort(byName), m = MODELS_OF.models.slice().sort(byName);
      if (!q) return [{ label: g.length ? 'Gamme' : '', items: g }, { label: 'Modelli', items: m }];
      return [{ label: '', items: filterNames(g.concat(m), q) }];
    }, function (v) { $('fModel').dataset.last = v; });
  }
  function fillModels(make, value) {
    var mk = makeInfo(make);
    MODELS_OF = mk ? { groups: mk.g, models: mk.m } : { groups: [], models: [] };
    var inp = $('fModel');
    inp.disabled = !mk;
    inp.placeholder = mk ? 'Tutti i modelli' : 'Scegli prima la marca';
    modelCombo.set(mk ? value : '');
  }
  function commitCombos() { makeCombo.commit(); modelCombo.commit(); }

  function readForm() {
    commitCombos();
    var f = $('searchForm'), s = Object.assign({}, EMPTY, { sort: state.search.sort || 'rilevanza' });
    FORM_FIELDS.forEach(function (k) { s[k] = String(f.elements[k].value || '').trim(); });
    s.europe = f.elements.europe.checked;
    // "da" più alto di "fino a": li scambiamo invece di dare zero risultati
    [['pmin', 'pmax'], ['ymin', 'ymax'], ['kmmin', 'kmmax'], ['cvmin', 'cvmax']].forEach(function (p) {
      if (int(s[p[0]]) && int(s[p[1]]) && int(s[p[0]]) > int(s[p[1]])) { var t = s[p[0]]; s[p[0]] = s[p[1]]; s[p[1]] = t; }
    });
    return s;
  }

  function writeForm(s) {
    var f = $('searchForm');
    FORM_FIELDS.forEach(function (k) { if (k !== 'model' && k !== 'make') f.elements[k].value = s[k] || ''; });
    makeCombo.set(makeInfo(s.make) ? s.make : '');
    fillModels(s.make, s.model);
    f.elements.europe.checked = !!s.europe;
    updateMoreCount();
  }

  function summary(s) {
    var p = [];
    p.push(s.make ? s.make + (s.model ? ' ' + s.model : '') : 'Tutte le marche');
    if (s.kw) p.push('"' + s.kw + '"');
    if (int(s.pmin) || int(s.pmax)) p.push((int(s.pmin) ? kshort(s.pmin) : '0') + '–' + (int(s.pmax) ? kshort(s.pmax) : '∞') + ' €');
    if (int(s.ymin) || int(s.ymax)) p.push((s.ymin || '…') + '–' + (s.ymax || 'oggi'));
    if (int(s.kmmin) || int(s.kmmax)) p.push((int(s.kmmin) ? kshort(s.kmmin) : '0') + '–' + (int(s.kmmax) ? kshort(s.kmmax) : '∞') + ' km');
    if (s.fuel) p.push(labelOf(D.FUELS, s.fuel));
    if (s.gear) p.push(labelOf(D.GEARS, s.gear));
    if (s.body) p.push(labelOf(D.BODIES, s.body));
    if (s.seller) p.push(s.seller === 'privato' ? 'Privati' : 'Concessionari');
    if (int(s.cvmin) || int(s.cvmax)) p.push((s.cvmin || '0') + '–' + (s.cvmax || '∞') + ' CV');
    if (s.region) p.push(labelOf(D.REGIONS.map(function (r) { return { k: r.k, n: r.n }; }), s.region));
    if (s.europe) p.push('+ estero');
    return p.join(' · ');
  }
  function compact(s) {
    var o = {};
    Object.keys(EMPTY).forEach(function (k) { if (s[k] && s[k] !== 'rilevanza') o[k] = s[k]; });
    return o;
  }
  function signature(s) { var c = compact(s); delete c.sort; return JSON.stringify(c); }

  function rememberRecent(s) {
    var sig = signature(s);
    state.recent = [{ s: compact(s), label: summary(s) }].concat(state.recent.filter(function (r) { return signature(Object.assign({}, EMPTY, r.s)) !== sig; })).slice(0, 8);
    lset('recent', state.recent);
  }

  function renderSearchLists() {
    var box = $('recentSearches');
    box.innerHTML = '';
    state.recent.forEach(function (r) {
      box.appendChild(h('button', { class: 'chip plain', type: 'button', on: { click: function () { applySearch(r.s); } } }, it2('history', r.label)));
    });
    var sb = $('savedSearches');
    sb.innerHTML = '';
    state.searches.forEach(function (x) {
      sb.appendChild(h('span', { class: 'chip' }, [
        h('span', { style: 'cursor:pointer', on: { click: function () { applySearch(x.search); } } }, it2('bookmark', x.name)),
        h('button', { class: 'x', type: 'button', 'aria-label': 'Elimina', on: { click: function () { removeSearch(x); } } }, [ic('x')])
      ]));
    });

  }

  function applySearch(s) {
    state.search = Object.assign({}, EMPTY, s);
    writeForm(state.search);
    go('#/risultati');
  }

  // ---------------------------------------------------------------- ricerche salvate (condivise)
  function loadSearches() {
    api('api/searches').then(function (j) { sync('searches', j); }).catch(function () { /* server giù */ });
  }
  function saveSearch() {
    var name = h('input', { type: 'text', value: summary(state.search).slice(0, 60), maxlength: 80 });
    dialog('Salva ricerca', [h('p', { class: 'muted', text: 'La vedranno tutti quelli che usano CacciAuto.' }), h('label', { text: 'Nome' }), name], [
      { label: 'Salva', cta: true, run: function () {
        post('api/searches', { action: 'add', name: name.value, search: compact(state.search) })
          .then(function (j) { sync('searches', j); toast('Ricerca salvata'); })
          .catch(function (e) { toast(e.message); });
      } }
    ]);
  }
  function removeSearch(x) {
    dialog('Elimino "' + x.name + '"?', [h('p', { class: 'muted', text: 'Sparisce per tutti.' })], [
      { label: 'Elimina', cta: true, run: function () {
        post('api/searches', { action: 'remove', id: x.id }).then(function (j) { sync('searches', j); }).catch(function (e) { toast(e.message); });
      } }
    ]);
  }

  // ---------------------------------------------------------------- risultati
  var ctrl = null, slowTimer = null;
  function serverSort(s) { return { prezzo: 'prezzo', prezzo_desc: 'rilevanza', km: 'km', recenti: 'recenti' }[s] || 'rilevanza'; }

  function runSearch(more) {
    var s = state.search;
    lset('search', s);
    var page = more ? results.page + 1 : 1;
    if (!more) {
      results = { sig: signature(s) + '|' + serverSort(s.sort), items: [], page: 0, hasMore: false, loading: true, sources: [], links: [] };
      rememberRecent(s);
      $('results').innerHTML = '';
      for (var i = 0; i < 6; i++) $('results').appendChild(h('div', { class: 'skel' }));
      $('resInfo').textContent = 'Cerco su 5 siti…';
      $('sources').innerHTML = '';
      $('more').innerHTML = '';
    }
    results.loading = true;
    if (ctrl) ctrl.abort();
    ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    clearTimeout(slowTimer);
    slowTimer = setTimeout(function () { $('resInfo').textContent = 'Sveglio il server… la prima ricerca può metterci fino a un minuto'; }, 6000);
    var q = compact(s);
    q.sort = serverSort(s.sort);
    api('api/search?page=' + page + '&s=' + encodeURIComponent(JSON.stringify(q)), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (data) {
        clearTimeout(slowTimer);
        results.loading = false;
        results.page = data.page;
        results.hasMore = data.hasMore;
        results.sources = data.sources;
        results.links = data.links;
        var now = Date.now();
        data.items.forEach(function (x) {
          x.key = keyOf(x);
          x.isNew = hadSeen && !state.seen[x.key];
          if (!state.seen[x.key]) state.seen[x.key] = now;
        });
        // unisce anche con le pagine già caricate: la stessa auto non compare due volte
        results.items = X.mergeListings(results.items, data.items);
        results.items.forEach(function (x) { byUrl[x.url] = x; });
        pruneSeen();
        estimateDeals(results.items, s);
        renderResults();
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return;
        clearTimeout(slowTimer);
        results.loading = false;
        renderOffline(e && e.message);
      });
  }

  function pruneSeen() {
    var keys = Object.keys(state.seen);
    if (keys.length > 30000) {
      keys.sort(function (a, b) { return state.seen[a] - state.seen[b]; }).slice(0, keys.length - 25000).forEach(function (k) { delete state.seen[k]; });
    }
    lset('seen', state.seen);
  }

  // Stima del prezzo "giusto" con gli annunci della ricerca: log(prezzo) ~ anno + km.
  // Serve a capire al volo se un annuncio è sotto o sopra il mercato.
  function estimateDeals(items, s) {
    var groups = {};
    items.forEach(function (it) {
      var g = s.make && s.model ? 'all' : (it.title || '').toLowerCase().split(/\s+/).slice(0, 2).join(' ');
      (groups[g] = groups[g] || []).push(it);
    });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g].filter(function (it) { return it.price > 300 && it.year && it.km !== null && it.km !== undefined; });
      if (list.length < 8) return;
      // minimi quadrati con 3 incognite: risolviamo il sistema 3x3
      var A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
      list.forEach(function (it) {
        var x = [1, it.year - 2000, it.km / 100000], y = Math.log(it.price);
        for (var i = 0; i < 3; i++) { b[i] += x[i] * y; for (var j = 0; j < 3; j++) A[i][j] += x[i] * x[j]; }
      });
      var c = solve3(A, b);
      if (!c) return;
      groups[g].forEach(function (it) {
        if (!(it.price > 300 && it.year && it.km !== null && it.km !== undefined)) return;
        var pred = Math.exp(c[0] + c[1] * (it.year - 2000) + c[2] * it.km / 100000);
        if (!isFinite(pred) || pred <= 0) return;
        it.est = Math.round(pred / 50) * 50;
        it.dev = it.price / pred - 1;
      });
    });
    items.forEach(function (it) {
      // AutoScout24 ha già la sua valutazione di mercato: è più affidabile della nostra
      if (typeof it.deal === 'number') { it.dealCat = it.deal; return; }
      if (typeof it.dev !== 'number') { it.dealCat = null; return; }
      var d = it.dev;
      it.dealCat = d <= -0.4 ? 0 : d <= -0.15 ? 1 : d <= -0.06 ? 2 : d < 0.08 ? 3 : d < 0.18 ? 4 : d < 0.35 ? 5 : 6;
    });
  }
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

  function sorted(items) {
    var s = state.search.sort, list = items.slice(), BIG = 1e12;
    var devOf = function (it) {
      if (typeof it.dev === 'number') return it.dev;
      return typeof it.dealCat === 'number' ? [0.5, -0.2, -0.1, 0, 0.1, 0.2, 0.3][it.dealCat] : BIG;
    };
    if (s === 'prezzo') list.sort(function (a, b) { return (a.price || BIG) - (b.price || BIG); });
    else if (s === 'prezzo_desc') list.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (s === 'km') list.sort(function (a, b) { return (a.km === null ? BIG : a.km) - (b.km === null ? BIG : b.km); });
    else if (s === 'anno') list.sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
    else if (s === 'affari') list.sort(function (a, b) { return devOf(a) - devOf(b); });
    return list;
  }

  function renderResults() {
    var box = $('results');
    box.innerHTML = '';
    var visible = results.items.filter(function (x) { return state.showHidden || !state.hidden[x.key]; });
    var nHidden = results.items.length - visible.length;
    var dupes = results.items.filter(function (x) { return x.also && x.also.length; }).length;
    var nNew = results.items.filter(function (x) { return x.isNew; }).length;
    $('resInfo').textContent = results.items.length
      ? results.items.length + ' annunci' + (nNew ? ' · ' + nNew + ' nuovi' : '') + (dupes ? ' · ' + dupes + ' doppioni uniti' : '')
      : 'Nessun annuncio';
    renderSources();
    if (nHidden || state.showHidden) {
      box.appendChild(h('div', { class: 'hidden-note' }, [
        nHidden ? nHidden + ' nascosti · ' : '',
        h('button', { type: 'button', text: state.showHidden ? 'nascondi di nuovo' : 'mostrali', on: { click: function () { state.showHidden = !state.showHidden; renderResults(); } } })
      ]));
    }
    if (!visible.length) {
      box.appendChild(h('div', { class: 'empty' }, [h('b', { text: 'Niente con questi filtri' }), 'Allarga budget, anni o km. Oppure prova sui siti qui sopra.']));
    }
    sorted(visible).forEach(function (it) { box.appendChild(adCard(it)); });
    var more = $('more');
    more.innerHTML = '';
    if (results.hasMore) more.appendChild(h('button', { class: 'sbtn ghost', type: 'button', text: 'Carica altri', on: { click: function () { loadMore(); } } }));
  }

  function loadMore() {
    if (results.loading || !results.hasMore) return;
    $('more').innerHTML = '';
    $('more').appendChild(h('div', { class: 'skel' }));
    runSearch(true);
  }

  function renderSources() {
    var box = $('sources');
    box.innerHTML = '';
    (results.sources || []).forEach(function (s) {
      var cls = s.ok ? 'ok' : s.skipped ? 'skip' : 'ko';
      box.appendChild(h('span', { class: cls, title: s.error || '' }, [s.name + (s.ok ? ' ' + s.count : ' (' + s.error + ')')]));
    });
    if (results.links && results.links.length) {
      box.appendChild(h('span', null, ['Cerca anche su: '].concat(results.links.map(function (l, i) {
        return h('span', null, [h('a', { href: l.url, target: '_blank', rel: 'noopener', text: l.name }, [ic('external-link')]), i < results.links.length - 1 ? ' · ' : '']);
      }))));
    }
  }

  function renderOffline(msg) {
    $('resInfo').textContent = 'Non riesco a caricare gli annunci';
    $('sources').innerHTML = '';
    $('more').innerHTML = '';
    var box = $('results');
    box.innerHTML = '';
    var links = S.plan(state.search).filter(function (p) { return p.site.id !== 'ilparking'; }).map(function (p) {
      return h('a', { class: 'chip plain', href: p.url, target: '_blank', rel: 'noopener', }, it2('external-link', p.site.name));
    });
    box.appendChild(h('div', { class: 'empty' }, [
      h('b', { text: msg && !/fetch|network|load/i.test(msg) ? msg : 'Server non raggiungibile' }),
      'Riprova tra poco (se il server dormiva si sta svegliando). Intanto puoi aprire i siti già filtrati:',
      h('div', { class: 'chips' }, links),
      h('div', { class: 'chips' }, [h('button', { class: 'sbtn', type: 'button', text: 'Riprova', on: { click: function () { runSearch(); } } })])
    ]));
  }

  function dealBadge(it) {
    if (typeof it.dealCat !== 'number') return null;
    var txt = DEAL[it.dealCat];
    if (typeof it.dev === 'number' && typeof it.deal !== 'number' && it.dealCat !== 3) txt += ' ' + (it.dev > 0 ? '+' : '−') + Math.abs(Math.round(it.dev * 100)) + '%';
    return h('span', { class: 'deal d' + it.dealCat, text: txt });
  }

  function isSaved(it) {
    var k = keyOf(it);
    return state.saved.some(function (x) { return x.key === k; });
  }

  function starBtn(it) {
    var on = isSaved(it);
    var b = h('button', { class: 'star' + (on ? ' on' : ''), type: 'button', 'aria-label': on ? 'Togli dai salvati' : 'Salva' }, [ic('star')]);
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      toggleSave(it).then(function () {
        var now = isSaved(it);
        b.classList.toggle('on', now);
        b.setAttribute('aria-label', now ? 'Togli dai salvati' : 'Salva');
      });
    });
    return b;
  }

  function adCard(it) {
    var meta = [kmf(it.km), it.year, cap(it.fuel), it.cv ? it.cv + ' CV' : '', it.gear === 'automatico' ? 'Aut.' : ''].filter(Boolean).join(' · ');
    var tags = [h('span', { class: 'tag ' + it.site, text: SITE_SHORT[it.site] || it.site })];
    (it.also || []).forEach(function (a) { tags.push(h('span', { class: 'tag ' + a.site, text: '+' + (SITE_SHORT[a.site] || a.site) })); });
    if (it.seller === 'privato') tags.push(h('span', { class: 'tag priv', text: 'privato' }));
    if (it.note) tags.push(h('span', { class: 'tag warn', text: it.note }));
    if (it.postedLabel) tags.push(h('span', { text: it.postedLabel }));
    if (it.city) tags.push(h('span', { class: 'city', text: it.city }));
    var href = '#/annuncio?u=' + encodeURIComponent(it.url);
    return h('a', { class: 'ad' + (state.visited[it.key] ? ' visited' : ''), href: href }, [
      h('div', { class: 'ph' }, [
        it.image ? h('img', { src: it.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', decoding: 'async', on: { error: function () { this.remove(); } } }) : ic('car', 'noimg'),
        it.isNew ? h('span', { class: 'new', text: 'NUOVO' }) : null,
        it.photos > 1 ? h('span', { class: 'n' }, [ic('camera'), String(it.photos)]) : null
      ]),
      h('div', { class: 'bd' }, [
        h('div', { class: 'tt' }, [it.title, it.version ? h('small', { text: ' · ' + it.version }) : null]),
        h('div', { class: 'prow' }, [h('span', { class: 'pr', text: eur(it.price) }), dealBadge(it)]),
        meta ? h('div', { class: 'mt', text: meta }) : null,
        h('div', { class: 'ft' }, tags)
      ]),
      starBtn(it)
    ]);
  }

  // infinito: quando arrivi in fondo carica la pagina dopo
  function watchBottom() {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && $('view-results').classList.contains('active')) loadMore();
    }, { rootMargin: '600px' }).observe($('more'));
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && $('view-search').classList.contains('active') && feed.page > 0) loadFeed();
    }, { rootMargin: '900px' }).observe($('feedMore'));
  }

  // ---------------------------------------------------------------- condivisione di un annuncio
  // Il link apre l'annuncio dentro CacciAuto (foto, scheda...), non sul sito di origine.
  function appLink(url) { return location.origin + location.pathname + '#/annuncio?u=' + encodeURIComponent(url); }
  function shareAd(a) {
    var link = appLink(a.url);
    var title = (a.title || 'Auto') + (a.version ? ' ' + a.version : '');
    var text = title + ' · ' + eur(a.price) + [a.year, kmf(a.km)].filter(Boolean).map(function (x) { return ' · ' + x; }).join('');
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: link }).catch(function () { /* annullato */ });
      return;
    }
    var ta = h('textarea', { readonly: true }, [text + '\n' + link]);
    dialog('Condividi', [ta], [
      { label: 'Copia link', keep: true, run: function () { copyText(text + '\n' + link); } },
      { label: 'WhatsApp', cta: true, run: function () { window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + link), '_blank', 'noopener'); } }
    ]);
  }
  function copyText(t) {
    var done = function () { toast('Link copiato'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { legacyCopy(t); done(); });
    else { legacyCopy(t); done(); }
  }
  function legacyCopy(t) {
    var ta = h('textarea', { style: 'position:fixed;opacity:0' }, [t]);
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* niente */ }
    ta.remove();
  }

  // ---------------------------------------------------------------- dettaglio annuncio
  var adReq = 0;
  function showAd(url) {
    var base = byUrl[url] || state.saved.filter(function (x) { return x.url === url; })[0] || { url: url, title: X.titleFromUrl(url) || 'Annuncio', site: X.detectSite(url).id };
    var key = X.listingKey(url);
    state.visited[key] = Date.now();
    var vk = Object.keys(state.visited);
    if (vk.length > 5000) vk.slice(0, vk.length - 4000).forEach(function (k) { delete state.visited[k]; });
    lset('visited', state.visited);
    var view = $('view-ad');
    view.innerHTML = '';
    view.appendChild(renderAd(base, null, true));
    $('topTitle').textContent = base.title || '';
    var my = ++adReq;
    api('api/ad?url=' + encodeURIComponent(url)).then(function (r) {
      if (my !== adReq) return;
      view.innerHTML = '';
      if (r.external) { view.appendChild(renderAd(base, null, false, r.url)); return; }
      var ad = r.ad ? Object.assign({ url: r.url, site: r.site }, r.ad) : null;
      if (ad) { ad.also = base.also; ad.dev = base.dev; ad.est = base.est; ad.deal = base.deal; ad.dealCat = base.dealCat; }
      view.appendChild(renderAd(base, ad, false, r.url, r.removed));
      if (r.removed || (ad && ad.price)) refreshSavedSoon();
    }).catch(function (e) {
      if (my !== adReq) return;
      view.innerHTML = '';
      view.appendChild(renderAd(base, null, false, url, false, e.message));
    });
  }

  // "Testo in tedesco · Traduci": traduce sul server, poi si può tornare all'originale
  function translateBar(original, lang, target) {
    var bar = h('div', { class: 'tr-bar' });
    var translated = null, showing = false;
    var btn = h('button', { class: 'link', type: 'button' }, it2('languages', 'Traduci in italiano'));
    bar.appendChild(h('span', { text: 'Testo in ' + (window.CA_LANG.NAMES[lang] || lang) }));
    bar.appendChild(btn);
    btn.addEventListener('click', function () {
      if (translated) {
        showing = !showing;
        target.textContent = showing ? translated : original;
        setLabel(btn, 'languages', showing ? 'Mostra originale' : 'Traduci in italiano');
        return;
      }
      setLabel(btn, 'loader', 'Traduco…');
      btn.disabled = true;
      post('api/translate', { text: original, from: lang }).then(function (r) {
        translated = r.text; showing = true;
        target.textContent = translated;
        target.classList.remove('clamp');
        setLabel(btn, 'languages', 'Mostra originale');
        btn.disabled = false;
      }).catch(function (e) {
        btn.disabled = false;
        setLabel(btn, 'languages', 'Traduci in italiano');
        bar.appendChild(h('span', null, [
          'Non riesco (' + e.message + '). ',
          h('a', { class: 'link', href: 'https://translate.google.com/?sl=auto&tl=it&op=translate&text=' + encodeURIComponent(original.slice(0, 1800)), target: '_blank', rel: 'noopener' }, it2('external-link', 'Apri Google Traduttore'))
        ]));
      });
    });
    return bar;
  }

  function spec(label, value) {
    if (value === null || value === undefined || value === '') return null;
    return h('div', null, [h('small', { text: label }), h('b', { text: String(value) })]);
  }

  function renderAd(base, ad, loading, finalUrl, removed, error) {
    var a = ad || base;
    var site = (ad && ad.site) || base.site;
    var openUrl = finalUrl || base.url;
    var openSite = X.detectSite(openUrl);
    var photos = ad && ad.photos && ad.photos.length ? ad.photos : (base.image ? [base.image] : []);
    var wrap = h('div');

    if (photos.length) {
      var gal = h('div', { class: 'gallery' }, photos.map(function (p, i) {
        return h('img', { src: p, alt: '', loading: i < 2 ? 'eager' : 'lazy', referrerpolicy: 'no-referrer', decoding: 'async' });
      }));
      var counter = h('span', { class: 'gal-count', text: '1 / ' + photos.length });
      gal.addEventListener('scroll', function () {
        var i = Math.round(gal.scrollLeft / Math.max(1, gal.clientWidth * (window.innerWidth >= 700 ? 0.8 : 1)));
        counter.textContent = Math.min(photos.length, i + 1) + ' / ' + photos.length;
      }, { passive: true });
      wrap.appendChild(h('div', { class: 'gal-wrap' }, [gal, photos.length > 1 ? counter : null]));
    }

    wrap.appendChild(h('div', { class: 'ad-head' }, [
      h('h1', { text: a.title || 'Annuncio' }),
      a.version ? h('div', { class: 'ver', text: a.version }) : null
    ]));
    wrap.appendChild(h('div', { class: 'ad-price' }, [
      h('span', { class: 'pr', text: eur(a.price) }),
      dealBadge(Object.assign({}, base, ad && ad.market && typeof ad.market.deal === 'number' ? { deal: ad.market.deal, dealCat: ad.market.deal } : {})),
      ad && ad.negotiable ? h('span', { class: 'tag priv', text: 'trattabile' }) : null,
      removed ? h('span', { class: 'gone', text: 'Non più disponibile' }) : null
    ]));
    if (ad && ad.market && ad.market.median) wrap.appendChild(h('div', { class: 'ad-note', text: 'Valutazione ' + ad.market.source + ': prezzo medio di mercato ' + eur(ad.market.median) }));
    if (base.est) wrap.appendChild(h('div', { class: 'ad-note', text: 'Stima sugli annunci di questa ricerca (anno e km): ' + eur(base.est) }));
    var savedItem = state.saved.filter(function (x) { return x.key === X.listingKey(base.url); })[0];
    if (savedItem && savedItem.history && savedItem.history.length > 1) {
      wrap.appendChild(h('div', { class: 'ad-note', text: 'Storico prezzo: ' + savedItem.history.map(function (x) { return eur(x.p); }).join(' → ') }));
    }
    if (ad && ad.posted) wrap.appendChild(h('div', { class: 'ad-note', text: 'Online da ' + ago(ad.posted).replace(' fa', '') + ' (' + new Date(ad.posted).toLocaleDateString('it-IT') + ')' }));
    else if (base.postedLabel) wrap.appendChild(h('div', { class: 'ad-note', text: 'Pubblicato ' + base.postedLabel }));

    var saveBtn = h('button', { class: 'sbtn ghost' + (isSaved(base) ? ' on-star' : ''), type: 'button', on: { click: function () {
      toggleSave(Object.assign({}, base, ad ? { image: (ad.photos || [])[0] || base.image, price: ad.price || base.price, km: ad.km || base.km, year: ad.year || base.year, cv: ad.cv || base.cv } : {})).then(function () {
        setLabel(saveBtn, 'star', isSaved(base) ? 'Salvato' : 'Salva');
        saveBtn.classList.toggle('on-star', isSaved(base));
      });
    } } }, it2('star', isSaved(base) ? 'Salvato' : 'Salva'));
    var siteName = SITE_NAMES[openSite.id] || openSite.name;
    wrap.appendChild(h('div', { class: 'ad-actions' }, [
      h('a', { class: 'sbtn wide', href: openUrl, target: '_blank', rel: 'noopener' }, it2('external-link', 'Apri su ' + siteName)),
      saveBtn,
      h('button', { class: 'sbtn ghost', type: 'button', on: { click: function () { shareAd(Object.assign({}, base, ad || {}, { url: base.url })); } } }, it2('share-2', 'Condividi')),
      (ad && ad.seller && ad.seller.phones && ad.seller.phones[0]) ? h('a', { class: 'sbtn ghost', href: 'tel:' + ad.seller.phones[0].tel }, it2('phone', 'Chiama')) : null,
      (ad && ad.seller && ad.seller.whatsapp) ? h('a', { class: 'sbtn ghost', href: 'https://wa.me/' + String(ad.seller.whatsapp).replace(/\D/g, ''), target: '_blank', rel: 'noopener' }, it2('message-circle', 'WhatsApp')) : null
    ]));

    if (loading) {
      wrap.appendChild(h('div', { class: 'skel' }));
      return wrap;
    }
    if (error) wrap.appendChild(h('div', { class: 'alert', text: 'Non riesco a leggere i dettagli (' + error + '). Puoi aprire l\'annuncio sul sito.' }));
    if (!ad && !error && !removed) {
      wrap.appendChild(h('div', { class: 'alert', text: siteName + ' non si lascia leggere da CacciAuto: foto e descrizione complete le trovi sul sito.' }));
      if (base.snippet) wrap.appendChild(h('div', { class: 'section desc', text: base.snippet }));
    }

    var specs = h('div', { class: 'specs' }, [
      spec('Chilometri', kmf(a.km)),
      spec('Immatricolazione', (ad && ad.reg) || a.year),
      spec('Alimentazione', (ad && ad.fuelLabel) || cap(a.fuel)),
      spec('Cambio', (ad && ad.gearLabel) || cap(a.gear)),
      spec('Potenza', a.cv ? a.cv + ' CV' + (ad && ad.kw ? ' (' + ad.kw + ' kW)' : '') : ''),
      spec('Cilindrata', ad && ad.cc ? dots(ad.cc) + ' cm³' : ''),
      spec('Carrozzeria', ad && ad.body),
      spec('Colore', ad && ad.color),
      spec('Interni', ad && ad.interior),
      spec('Porte / posti', ad && (ad.doors || ad.seats) ? (ad.doors || '–') + ' / ' + (ad.seats || '–') : ''),
      spec('Trazione', ad && ad.drive),
      spec('Classe emissioni', ad && ad.emission),
      spec('Consumo', ad && ad.consumption),
      spec('Proprietari', ad && ad.owners),
      spec('Incidentata', ad && ad.accident),
      spec('Tagliandi certificati', ad && ad.serviceBook),
      spec('Peso', ad && ad.weight),
      spec('Città', !ad ? base.city : '')
    ].filter(Boolean));
    if (specs.children.length) wrap.appendChild(specs);

    if (ad && ad.seller && (ad.seller.name || ad.seller.city)) {
      wrap.appendChild(h('div', { class: 'section card seller' }, [
        h('h3', { text: 'Venditore' }),
        h('div', { class: 'nm', text: [ad.seller.name, ad.seller.type].filter(function (v, i, a) { return v && a.map(function (z) { return String(z).toLowerCase(); }).indexOf(String(v).toLowerCase()) === i; }).join(' · ') }),
        ad.seller.city ? h('div', { class: 'muted mini-ic' }, it2('map-pin', ad.seller.city)) : null,
        ad.seller.phones && ad.seller.phones.length ? h('div', { class: 'btns' }, ad.seller.phones.map(function (p) {
          return h('a', { class: 'chip plain', href: 'tel:' + p.tel }, it2('phone', p.label));
        })) : null
      ]));
    }

    if (ad && ad.description) {
      var desc = h('div', { class: 'desc' + (ad.description.length > 600 ? ' clamp' : ''), text: ad.description });
      var sec = h('div', { class: 'section' }, [h('h3', { text: 'Descrizione' })]);
      var lang = window.CA_LANG ? window.CA_LANG.detect(ad.description) : 'it';
      if (lang !== 'it') sec.appendChild(translateBar(ad.description, lang, desc));
      sec.appendChild(desc);
      if (ad.description.length > 600) {
        sec.appendChild(h('button', { class: 'link', type: 'button', text: 'Mostra tutto', on: { click: function () { desc.classList.remove('clamp'); this.remove(); } } }));
      }
      wrap.appendChild(sec);
    }
    if (ad && ad.equipment && ad.equipment.length) {
      wrap.appendChild(h('details', { class: 'section' }, [
        h('summary', null, [h('h3', { style: 'display:inline', text: 'Dotazioni (' + ad.equipment.length + ')' })]),
        h('div', { class: 'equip' }, ad.equipment.map(function (x) { return h('span', { text: x }); }))
      ]));
    }
    if (base.also && base.also.length) {
      wrap.appendChild(h('div', { class: 'section' }, [h('h3', { text: 'Stessa auto anche su' }), h('div', { class: 'chips' }, base.also.map(function (o) {
        return h('a', { class: 'chip plain', href: '#/annuncio?u=' + encodeURIComponent(o.url), text: (SITE_NAMES[o.site] || o.site) + ' · ' + eur(o.price) });
      }))]));
    }
    var key = X.listingKey(base.url);
    wrap.appendChild(h('div', { class: 'section' }, [
      h('button', { class: 'link', type: 'button', on: { click: function () {
        if (state.hidden[key]) delete state.hidden[key]; else state.hidden[key] = Date.now();
        lset('hidden', state.hidden);
        toast(state.hidden[key] ? 'Nascosto dai risultati' : 'Di nuovo visibile');
        if (state.hidden[key]) history.back();
      } } }, state.hidden[key] ? it2('eye', 'Mostra di nuovo nei risultati') : it2('eye-off', 'Non mi interessa (nascondi dai risultati)'))
    ]));
    return wrap;
  }

  // ---------------------------------------------------------------- feed della home
  // opzioni del feed (ricordate sul telefono) e ordine casuale nuovo a ogni apertura
  var feedOpts = Object.assign({ mode: 'mix', pmax: '', kmmax: '' }, lget('feed', {}));
  var feedSeed = 1 + Math.floor(Math.random() * 1e6);
  var feed = { items: [], page: 0, loading: false, done: false, req: 0 };
  function loadFeed(reset) {
    if (reset) {
      if (reset === 'shuffle') feedSeed = 1 + Math.floor(Math.random() * 1e6);
      feed = { items: [], page: 0, loading: false, done: false, req: feed.req + 1 };
      $('feed').innerHTML = '';
    }
    if (feed.loading || feed.done) return;
    var myReq = feed.req;
    feed.loading = true;
    var more = $('feedMore');
    more.innerHTML = '';
    for (var i = 0; i < (feed.page ? 1 : 4); i++) (feed.page ? more : $('feed')).appendChild(h('div', { class: 'skel tall' }));
    var q = 'api/feed?page=' + feed.page + '&mode=' + feedOpts.mode + '&seed=' + feedSeed +
      (feedOpts.pmax ? '&pmax=' + feedOpts.pmax : '') + (feedOpts.kmmax ? '&kmmax=' + feedOpts.kmmax : '');
    api(q).then(function (j) {
      if (myReq !== feed.req) return; // nel frattempo hai cambiato filtri
      feed.loading = false;
      if (!j.hasMore) feed.done = true;
      feed.page++;
      Array.prototype.forEach.call($('feed').querySelectorAll('.skel'), function (x) { x.remove(); });
      more.innerHTML = '';
      var before = feed.items.length;
      feed.items = X.mergeListings(feed.items, j.items.map(function (x) { x.key = keyOf(x); return x; }));
      feed.items.slice(before).forEach(function (it) { byUrl[it.url] = it; $('feed').appendChild(feedCard(it)); });
      // pochi annunci (es. budget basso): carica subito la pagina dopo, fino ad averne almeno 12
      if ((feed.items.length === before || feed.items.length < 12) && feed.page < 8 && !feed.done) setTimeout(function () { loadFeed(); }, 50);
      if (feed.items.length === 0 && (feed.done || feed.page >= 8)) $('feed').appendChild(h('div', { class: 'empty' }, [h('b', { text: 'Niente con questo budget' }), 'Prova ad alzare il budget o i km massimi.']));
    }).catch(function () {
      if (myReq !== feed.req) return;
      feed.loading = false;
      Array.prototype.forEach.call($('feed').querySelectorAll('.skel'), function (x) { x.remove(); });
      more.innerHTML = '';
      more.appendChild(h('div', { class: 'empty' }, ['Non riesco a caricare il feed (il server si sta svegliando?). ',
        h('button', { class: 'link', type: 'button', text: 'Riprova', on: { click: function () { loadFeed(); } } })]));
    });
  }

  function feedCard(it) {
    var meta = [it.year, kmf(it.km), cap(it.fuel), it.cv ? it.cv + ' CV' : ''].filter(Boolean).join(' · ');
    var tags = [h('span', { class: 'tag ' + it.site, text: SITE_SHORT[it.site] || it.site })];
    (it.also || []).forEach(function (a) { tags.push(h('span', { class: 'tag ' + a.site, text: '+' + (SITE_SHORT[a.site] || a.site) })); });
    if (it.seller === 'privato') tags.push(h('span', { class: 'tag priv', text: 'privato' }));
    if (it.city) tags.push(h('span', { class: 'mini-ic' }, it2('map-pin', it.city)));
    var why = it.reason === 'affare' ? it2('badge-percent', it.label || 'Affare')
      : it.reason === 'recente' ? it2('clock', it.postedLabel || (it.posted ? 'Pubblicato ' + agoShort(it.posted) : 'Nuovo annuncio'))
      : it2('gem', it.label || 'Da appassionati');
    return h('a', { class: 'fcard', href: '#/annuncio?u=' + encodeURIComponent(it.url) }, [
      h('div', { class: 'ph' }, [
        it.image ? h('img', { src: it.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', decoding: 'async', on: { error: function () { this.remove(); } } }) : ic('car', 'noimg'),
        h('span', { class: 'why ' + (it.reason || '') }, why),
        h('span', { class: 'pr-over', text: eur(it.price) })
      ]),
      h('div', { class: 'bd' }, [
        h('div', { class: 'tt' }, [it.title, it.version ? h('small', { text: ' · ' + it.version }) : null]),
        meta ? h('div', { class: 'mt', text: meta }) : null,
        it.fact ? h('div', { class: 'fact' }, it2('sparkles', it.fact)) : null,
        h('div', { class: 'ft' }, tags)
      ]),
      starBtn(it)
    ]);
  }

  function buildFeedControls() {
    fillSelect($('feedPmax'), PRICES.map(function (p) { return { k: String(p), n: dots(p) + ' €' }; }));
    fillSelect($('feedKm'), KMS.map(function (k) { return { k: String(k), n: dots(k) + ' km' }; }));
    $('feedPmax').value = feedOpts.pmax || '';
    $('feedKm').value = feedOpts.kmmax || '';
    var markMode = function () {
      Array.prototype.forEach.call($('feedMode').children, function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === feedOpts.mode); });
      $('btnFeedRefresh').hidden = feedOpts.mode !== 'mix';
    };
    markMode();
    Array.prototype.forEach.call($('feedMode').children, function (b) {
      b.addEventListener('click', function () {
        if (feedOpts.mode === b.getAttribute('data-mode')) return;
        feedOpts.mode = b.getAttribute('data-mode');
        lset('feed', feedOpts); markMode(); loadFeed(true);
      });
    });
    [['feedPmax', 'pmax'], ['feedKm', 'kmmax']].forEach(function (p) {
      $(p[0]).addEventListener('change', function () { feedOpts[p[1]] = $(p[0]).value; lset('feed', feedOpts); loadFeed(true); });
    });
  }

  // ---------------------------------------------------------------- salvati (condivisi)
  function loadSaved() {
    return api('api/saved').then(function (j) { sync('saved', j); }).catch(function () {
      // server giù: mostriamo la copia sul telefono
      if (!state.savedLoaded && state.mirror.saved.items.length) { state.saved = state.mirror.saved.items; state.savedLoaded = true; renderSavedCount(); if (currentView() === 'saved') renderSaved(); }
    });
  }
  /* Copia dei salvati/ricerche sul telefono.
   * Il server gratuito può ripartire da zero: se il suo "bootId" è cambiato rimandiamo la nostra copia,
   * il server la unisce a quelle degli altri telefoni e nessuno perde niente. */
  function sync(name, j) {
    var m = state.mirror;
    var local = m[name] || { items: [], tomb: {} };
    var fresh = j.bootId && m.boot[name] !== j.bootId;
    var hasLocal = local.items.length || Object.keys(local.tomb || {}).length;
    if (fresh && hasLocal && !syncing[name]) {
      syncing[name] = true;
      post('api/' + name, { action: 'restore', items: local.items, tomb: local.tomb })
        .then(function (r) { m.boot[name] = r.bootId; syncing[name] = false; apply(name, r); })
        .catch(function () { syncing[name] = false; });
      // nel frattempo mostriamo l'unione di quello che sappiamo
      apply(name, { items: mergeLocal(j.items || [], local.items, name), tomb: j.tomb }, true);
      return;
    }
    if (j.bootId) m.boot[name] = j.bootId;
    apply(name, j);
  }
  var syncing = {};
  function mergeLocal(server, local, name) {
    var key = name === 'saved' ? function (x) { return x.key; } : function (x) { return x.id; };
    var have = {};
    server.forEach(function (x) { have[key(x)] = 1; });
    return server.concat(local.filter(function (x) { return !have[key(x)]; }));
  }
  function apply(name, j, temporary) {
    if (!temporary) { state.mirror[name] = { items: j.items || [], tomb: j.tomb || {} }; lset('mirror', state.mirror); }
    if (name === 'saved') {
      state.saved = j.items || [];
      state.savedLoaded = true;
      renderSavedCount();
      if (currentView() === 'saved') renderSaved();
    } else {
      state.searches = j.items || [];
      renderSearchLists();
    }
  }

  var refreshTimer;
  function refreshSavedSoon() { clearTimeout(refreshTimer); refreshTimer = setTimeout(loadSaved, 1500); }

  function renderSavedCount() {
    $('savedCount').hidden = !state.saved.length;
    $('savedCount').textContent = state.saved.length;
  }

  function toggleSave(it) {
    var k = keyOf(it);
    var on = isSaved(it);
    var req = on ? post('api/saved', { action: 'remove', key: k }) : post('api/saved', { action: 'add', item: {
      url: it.url, title: it.title, version: it.version, price: it.price, km: it.km, year: it.year, cv: it.cv,
      fuel: it.fuel, city: it.city, image: it.image, alts: (it.also || []).map(function (a) { return a.url; })
    } });
    return req.then(function (j) {
      sync('saved', j);
      renderSavedCount();
      toast(on ? 'Tolto dai salvati' : 'Salvato (lo vedono tutti)');
    }).catch(function (e) { toast('Non salvato: ' + e.message); });
  }

  function addByLink() {
    var raw = $('addUrl').value.trim();
    var url = X.extractUrl(raw) || raw;
    var msg = $('addMsg');
    msg.hidden = true;
    if (!/^https?:\/\//i.test(url)) { msg.hidden = false; msg.textContent = 'Incolla un link valido'; return; }
    var det = X.parseDetails(raw);
    var item = { url: url, title: X.titleFromUrl(url), price: det.price, km: det.km, year: det.year };
    var d = X.findDuplicate(state.saved, Object.assign({ key: X.listingKey(url) }, item));
    if (d && d.type === 'exact') { msg.hidden = false; msg.textContent = 'Già nei salvati: ' + (d.item.title || d.item.url); return; }
    post('api/saved', { action: 'add', item: item }).then(function (j) {
      sync('saved', j);
      $('addUrl').value = '';
      renderSavedCount(); renderSaved();
      toast('Aggiunto ai salvati');
    }).catch(function (e) { msg.hidden = false; msg.textContent = e.message; });
  }

  function priceDrop(x) {
    var hh = x.history || [];
    return hh.length > 1 ? hh[0].p - x.price : 0;
  }

  function renderSaved() {
    var box = $('saved');
    var list = state.saved.slice();
    var srt = $('savedSort').value;
    if (srt === 'prezzo') list.sort(function (a, b) { return (a.price || 1e12) - (b.price || 1e12); });
    else if (srt === 'calo') list.sort(function (a, b) { return priceDrop(b) - priceDrop(a); });
    $('savedInfo').textContent = list.length ? list.length + ' auto' : '';
    box.innerHTML = '';
    if (!state.savedLoaded) { box.appendChild(h('div', { class: 'skel' })); return; }
    if (!list.length) {
      box.appendChild(h('div', { class: 'empty' }, [h('b', { text: 'Nessun salvato' }), 'Tocca la stella su un annuncio: lo vedranno tutti quelli che usano CacciAuto.']));
      return;
    }
    list.forEach(function (x) { box.appendChild(savedCard(x)); });
  }

  function savedCard(x) {
    var drop = priceDrop(x);
    var meta = [kmf(x.km), x.year, cap(x.fuel), x.cv ? x.cv + ' CV' : ''].filter(Boolean).join(' · ');
    var tags = [h('span', { class: 'tag ' + (SITE_SHORT[x.site] ? x.site : 'altro'), text: SITE_SHORT[x.site] || X.detectSite(x.url).name })];
    (x.alts || []).forEach(function (u) { var s = X.detectSite(u).id; tags.push(h('span', { class: 'tag ' + (SITE_SHORT[s] ? s : 'altro'), text: '+' + (SITE_SHORT[s] || s) })); });
    tags.push(h('span', { text: 'salvato ' + ago(x.savedAt) }));
    if (x.city) tags.push(h('span', { class: 'city', text: x.city }));
    var card = h('a', { class: 'ad saved', href: '#/annuncio?u=' + encodeURIComponent(x.url) }, [
      h('div', { class: 'ph' }, [x.image ? h('img', { src: x.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', on: { error: function () { this.remove(); } } }) : ic('car', 'noimg')]),
      h('div', { class: 'bd' }, [
        h('div', { class: 'tt' }, [x.title || x.url, x.version ? h('small', { text: ' · ' + x.version }) : null]),
        h('div', { class: 'prow' }, [
          h('span', { class: 'pr', text: eur(x.price) }),
          drop ? h('span', { class: 'chg mini-ic ' + (drop > 0 ? 'down' : 'up') }, it2(drop > 0 ? 'trending-down' : 'trending-up', eur(Math.abs(drop)))) : null,
          x.removed ? h('span', { class: 'gone', text: 'Non più disponibile' }) : null
        ]),
        meta ? h('div', { class: 'mt', text: meta }) : null,
        h('div', { class: 'ft' }, tags)
      ]),
      h('div', { class: 'note mini-ic' }, x.note ? it2('pencil', x.note) : []),
      h('div', { class: 'row2' }, [
        h('button', { class: 'link', type: 'button', on: { click: function (e) { e.preventDefault(); editNote(x); } } }, it2('pencil', x.note ? 'Modifica nota' : 'Aggiungi nota')),
        h('span', { class: 'sp' }),
        h('button', { class: 'link', type: 'button', on: { click: function (e) { e.preventDefault(); shareAd(x); } } }, it2('share-2', 'Condividi')),
        h('button', { class: 'link danger', type: 'button', on: { click: function (e) { e.preventDefault(); removeSaved(x); } } }, it2('trash-2', 'Rimuovi'))
      ])
    ]);
    return card;
  }

  function editNote(x) {
    var ta = h('textarea', { maxlength: 500, placeholder: 'es. passaruota da controllare, trattabile a 4.000' }, [x.note || '']);
    dialog('Nota', [ta], [{ label: 'Salva', cta: true, run: function () {
      post('api/saved', { action: 'note', key: x.key, note: ta.value }).then(function (j) { sync('saved', j); renderSaved(); }).catch(function (e) { toast(e.message); });
    } }]);
  }

  function removeSaved(x) {
    dialog('Rimuovo dai salvati?', [h('p', { class: 'muted', text: '"' + (x.title || x.url) + '" sparisce per tutti.' })], [
      { label: 'Rimuovi', cta: true, run: function () {
        post('api/saved', { action: 'remove', key: x.key }).then(function (j) { sync('saved', j); renderSavedCount(); renderSaved(); }).catch(function (e) { toast(e.message); });
      } }
    ]);
  }

  // Ricontrolla prezzo e disponibilità di tutti i salvati (uno alla volta, piano).
  var checking = false;
  function checkPrices() {
    if (checking) return;
    var list = state.saved.filter(function (x) { return ['autoscout', 'subito', 'autosupermarket', 'automobile', 'trovit'].indexOf(x.site) !== -1; }).slice(0, 60);
    if (!list.length) { toast('Niente da controllare'); return; }
    checking = true;
    var btn = $('btnCheck'), i = 0;
    (function next() {
      if (i >= list.length) {
        checking = false;
        setLabel(btn, 'refresh-cw', 'Controlla prezzi');
        loadSaved().then(function () { toast('Prezzi aggiornati'); });
        return;
      }
      setLabel(btn, 'loader', 'Controllo ' + (i + 1) + '/' + list.length + '…');
      api('api/ad?url=' + encodeURIComponent(list[i].url)).catch(function () { /* salta */ }).then(function () { i++; setTimeout(next, 400); });
    })();
  }

  // ---------------------------------------------------------------- dialog
  function dialog(title, body, actions) {
    var dlg = $('dlg');
    $('dlgTitle').textContent = title;
    var bb = $('dlgBody');
    bb.innerHTML = '';
    body.forEach(function (n) { bb.appendChild(n); });
    var act = $('dlgActions');
    act.innerHTML = '';
    (actions || []).forEach(function (a) {
      act.appendChild(h('button', { type: 'button', class: 'sbtn' + (a.cta ? '' : ' ghost'), text: a.label, on: { click: function () { if (a.run) a.run(); if (!a.keep) dlg.close(); } } }));
    });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  // ---------------------------------------------------------------- navigazione
  var scrollPos = {};
  var depth = 0;
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function currentView() {
    var v = document.querySelector('.view.active');
    return v ? v.id.replace('view-', '') : '';
  }
  function show(view) {
    var prev = currentView();
    if (prev) scrollPos[prev] = window.scrollY;
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (el) { el.classList.toggle('active', el.id === 'view-' + view); });
    var inner = view === 'ad' || view === 'results';
    $('btnBack').hidden = !inner;
    $('brand').hidden = view === 'ad';
    $('topTitle').textContent = '';
    $('navSearch').classList.toggle('on', view === 'search' || view === 'results');
    $('navSaved').classList.toggle('on', view === 'saved');
  }

  function route() {
    var hash = location.hash || '#/';
    var path = hash.slice(1).split('?')[0];
    var params = new URLSearchParams(hash.split('?')[1] || '');
    if (path === '/annuncio' && params.get('u')) {
      show('ad');
      window.scrollTo(0, 0);
      showAd(params.get('u'));
      return;
    }
    if (path === '/risultati') {
      show('results');
      setLabel($('summary'), 'pencil', summary(state.search));
      $('sort').value = state.search.sort || 'rilevanza';
      var sig = signature(state.search) + '|' + serverSort(state.search.sort);
      if (results.sig !== sig) { window.scrollTo(0, 0); runSearch(); }
      else { renderResults(); window.scrollTo(0, scrollPos.results || 0); }
      return;
    }
    if (path === '/salvati') {
      show('saved');
      renderSaved();
      loadSaved();
      window.scrollTo(0, 0);
      return;
    }
    show('search');
    writeForm(state.search);
    renderSearchLists();
    loadSearches();
    if (!feed.page && !feed.loading && !feed.items.length) loadFeed(true);
    window.scrollTo(0, scrollPos.search || 0);
  }

  // Niente zoom con due dita (iOS ignora user-scalable=no, quindi serve anche questo)
  function noPinchZoom() {
    ['gesturestart', 'gesturechange'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  }

  // icone negli elementi statici dell'HTML: <button data-icon="star">
  function staticIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) { el.insertBefore(ic(el.getAttribute('data-icon')), el.firstChild); });
  }

  function init() {
    staticIcons();
    noPinchZoom();
    buildForm();
    buildFeedControls();
    $('btnFeedRefresh').addEventListener('click', function () { loadFeed('shuffle'); window.scrollTo(0, $('feedMode').getBoundingClientRect().top + window.scrollY - 70); });
    writeForm(state.search);
    $('sort').addEventListener('change', function () {
      state.search.sort = $('sort').value;
      lset('search', state.search);
      // prezzo/km/recenti cambiano cosa chiediamo ai siti, gli altri ordinano solo quello che c'è
      var sig = signature(state.search) + '|' + serverSort(state.search.sort);
      if (results.sig !== sig) runSearch(); else renderResults();
    });
    $('btnSaveSearch').addEventListener('click', saveSearch);
    $('btnBack').addEventListener('click', function () { if (depth > 0) history.back(); else go(currentView() === 'ad' ? '#/risultati' : '#/'); });
    $('btnAdd').addEventListener('click', addByLink);
    $('addUrl').addEventListener('keydown', function (e) { if (e.key === 'Enter') addByLink(); });
    $('savedSort').addEventListener('change', renderSaved);
    $('btnCheck').addEventListener('click', checkPrices);
    $('dlg').addEventListener('click', function (e) { if (e.target === $('dlg')) $('dlg').close(); });
    window.addEventListener('hashchange', function () { depth++; route(); });
    watchBottom();

    // Condivisione da altre app (Android): il link finisce nei salvati
    var params = new URLSearchParams(location.search);
    var shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ');
    if (shared) {
      history.replaceState(null, '', location.pathname + '#/salvati');
      $('addUrl').value = shared;
      setTimeout(addByLink, 300);
    }
    route();
    loadSaved();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* niente offline */ });
    }
  }

  init();
})();

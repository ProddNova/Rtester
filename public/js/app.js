/* CacciAuto - interfaccia. Gli annunci arrivano dal server (/api/search), la bacheca resta sul telefono. */
(function () {
  'use strict';
  var D = window.CA_DATA, S = window.CA_SITES, P = window.CA_PARSE, X = window.CA_DEDUP;
  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'cacciauto.v2';
  var SITE_NAMES = { autoscout: 'AutoScout24', autosupermarket: 'AutoSuperMarket', automobile: 'Automobile.it', subito: 'Subito', facebook: 'Marketplace', ilparking: 'ilParking' };
  var SITE_SHORT = { autoscout: 'AS24', autosupermarket: 'ASM', automobile: 'AM.it', subito: 'Subito', facebook: 'FB' };

  // ---------------------------------------------------------------- stato
  var EMPTY = { q: '', make: '', model: '', kw: '', pmin: '', pmax: '', ymin: '', ymax: '', kmmax: '', fuel: '', gear: '', body: '', cvmin: '', cvmax: '', region: '', europe: false, sort: 'rilevanza' };
  var state = { search: clone(EMPTY), board: [], names: { a: 'Io', b: 'Socio' }, me: 'a', boardSort: 'nuovi' };
  var results = { items: [], page: 0, hasMore: false, loading: false, sig: '' };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!saved) {
        // migrazione dalla prima versione
        var old = JSON.parse(localStorage.getItem('cacciauto.v1') || 'null');
        if (old) saved = { board: old.board || [], names: old.names, me: old.me };
      }
      if (saved) Object.keys(state).forEach(function (k) { if (saved[k] !== undefined) state[k] = saved[k]; });
      state.search = Object.assign(clone(EMPTY), state.search);
    } catch (e) { /* storage non disponibile */ }
  }
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* pazienza */ } }, 150);
  }

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
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { /* niente */ } }
  var toastTimer;
  function toast(msg, ms, onClick) {
    var t = $('toast');
    t.textContent = msg;
    t.onclick = onClick || null;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }
  function dots(n) { return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function eur(n) { return n ? dots(n) + ' €' : ''; }
  function kmf(n) { return n || n === 0 ? dots(n) + ' km' : ''; }
  function int(v) { var n = parseInt(v, 10); return isNaN(n) || n <= 0 ? '' : n; }
  function kshort(n) { n = Number(n); return n >= 1000 ? String(Math.round(n / 100) / 10).replace('.', ',') + 'k' : String(n); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function labelOf(list, k) { var x = list.filter(function (i) { return i.k === k; })[0]; return x ? x.n : k; }

  // ---------------------------------------------------------------- ricerca: testo e filtri
  var lastExtras = {};
  function applyQuery(text) {
    var r = P.parseQuery(text);
    var s = state.search;
    s.q = text; s.make = r.make; s.model = r.model; s.kw = r.kw;
    ['fuel', 'gear', 'body', 'pmax'].forEach(function (f) {
      if (r[f]) s[f] = String(r[f]);
      else if (lastExtras[f] && String(s[f]) === String(lastExtras[f])) s[f] = '';
    });
    lastExtras = { fuel: r.fuel, gear: r.gear, body: r.body, pmax: r.pmax };
  }

  function activeCount() {
    var s = state.search, n = 0;
    ['pmin', 'pmax', 'ymin', 'ymax', 'kmmax', 'fuel', 'gear', 'body', 'cvmin', 'cvmax', 'region'].forEach(function (k) { if (s[k]) n++; });
    if (s.europe) n++;
    return n;
  }

  // Chip dei filtri attivi (tocca = togli)
  function renderChips() {
    var s = state.search, box = $('chips');
    box.innerHTML = '';
    function chip(label, clear) {
      box.appendChild(h('button', { class: 'chip on', type: 'button', on: { click: function () { buzz(); clear(); syncText(); runSearch(); } } }, [label, h('span', { class: 'x', text: '✕' })]));
    }
    if (s.make) chip(s.make + (s.model ? ' ' + s.model : ''), function () { s.make = ''; s.model = ''; s.q = s.kw; });
    if (s.kw) chip('"' + s.kw + '"', function () { s.kw = ''; s.q = (s.make + ' ' + s.model).trim().toLowerCase(); });
    if (int(s.pmin) || int(s.pmax)) chip((int(s.pmin) ? kshort(s.pmin) : '0') + '–' + (int(s.pmax) ? kshort(s.pmax) : '∞') + ' €', function () { s.pmin = ''; s.pmax = ''; });
    if (int(s.ymin) || int(s.ymax)) chip((s.ymin || '…') + '–' + (s.ymax || 'oggi'), function () { s.ymin = ''; s.ymax = ''; });
    if (int(s.kmmax)) chip('≤ ' + kshort(s.kmmax) + ' km', function () { s.kmmax = ''; });
    if (s.fuel) chip(labelOf(D.FUELS, s.fuel), function () { s.fuel = ''; });
    if (s.gear) chip(labelOf(D.GEARS, s.gear), function () { s.gear = ''; });
    if (s.body) chip(labelOf(D.BODIES, s.body), function () { s.body = ''; });
    if (int(s.cvmin) || int(s.cvmax)) chip((s.cvmin || '0') + '–' + (s.cvmax || '∞') + ' CV', function () { s.cvmin = ''; s.cvmax = ''; });
    if (s.region) chip(labelOf(D.REGIONS.map(function (r) { return { k: r.k, n: r.n }; }), s.region), function () { s.region = ''; });
    if (s.europe) chip('+ estero', function () { s.europe = false; });
    var n = activeCount();
    $('filterCount').hidden = !n;
    $('filterCount').textContent = n;
  }

  function syncText() {
    $('q').value = state.search.q || '';
    $('clearQ').hidden = !state.search.q;
  }

  function renderSuggest() {
    var box = $('suggest'), q = $('q').value;
    var list = q.trim() ? P.suggest(q, 5).filter(function (x) { return !(x.make === state.search.make && x.model === state.search.model); }) : [];
    box.innerHTML = '';
    box.hidden = !list.length;
    list.forEach(function (x) {
      box.appendChild(h('button', { type: 'button', text: x.label, on: { mousedown: function (e) { e.preventDefault(); }, click: function () {
        buzz();
        var txt = x.label.toLowerCase() + (state.search.kw && x.model ? ' ' + state.search.kw : '');
        $('q').value = txt;
        applyQuery(txt);
        box.hidden = true;
        $('q').blur();
        runSearch();
      } } }));
    });
  }

  // ---------------------------------------------------------------- foglio filtri
  function fillSelect(sel, list) { list.forEach(function (i) { sel.appendChild(h('option', { value: i.k, text: i.n })); }); }
  function openFilters() {
    var f = $('filtersForm'), s = state.search;
    ['pmin', 'pmax', 'ymin', 'ymax', 'kmmax', 'fuel', 'gear', 'body', 'cvmin', 'cvmax', 'region'].forEach(function (k) { f.elements[k].value = s[k] || ''; });
    f.elements.europe.checked = !!s.europe;
    openDialog($('dlgFilters'));
  }
  function applyFilters() {
    var f = $('filtersForm'), s = state.search;
    ['pmin', 'pmax', 'ymin', 'ymax', 'kmmax', 'fuel', 'gear', 'body', 'cvmin', 'cvmax', 'region'].forEach(function (k) { s[k] = f.elements[k].value; });
    s.europe = f.elements.europe.checked;
    runSearch();
  }

  // ---------------------------------------------------------------- chiamata al server
  var ctrl = null, slowTimer = null;
  function apiUrl(page) {
    var s = clone(state.search);
    delete s.q;
    Object.keys(s).forEach(function (k) { if (s[k] === '' || s[k] === false) delete s[k]; });
    return 'api/search?page=' + page + '&s=' + encodeURIComponent(JSON.stringify(s));
  }
  function hasQuery() {
    var s = state.search;
    return !!(s.make || s.kw || activeCount());
  }

  function runSearch(more) {
    save();
    renderChips();
    if (!hasQuery()) {
      results = { items: [], page: 0, hasMore: false, loading: false };
      $('resInfo').textContent = 'Scrivi un\'auto o scegli un filtro';
      $('sources').innerHTML = '';
      $('more').innerHTML = '';
      renderIntro();
      return;
    }
    var page = more ? results.page + 1 : 1;
    if (ctrl) ctrl.abort();
    ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    results.loading = true;
    if (!more) {
      results.items = [];
      $('results').innerHTML = '';
      for (var i = 0; i < 5; i++) $('results').appendChild(h('div', { class: 'skel' }));
      $('resInfo').textContent = 'Cerco su 3 siti…';
      $('sources').innerHTML = '';
    }
    $('more').innerHTML = '';
    if (more) $('more').appendChild(h('div', { class: 'skel' }));
    clearTimeout(slowTimer);
    slowTimer = setTimeout(function () { $('resInfo').textContent = 'Sveglio il server… la prima ricerca può metterci fino a un minuto'; }, 6000);

    fetch(apiUrl(page), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('Errore ' + r.status)); return j; });
      })
      .then(function (data) {
        clearTimeout(slowTimer);
        results.loading = false;
        results.page = data.page;
        results.hasMore = data.hasMore;
        var seen = {};
        results.items.forEach(function (x) { seen[x.key] = 1; });
        data.items.forEach(function (x) { if (!seen[x.key]) results.items.push(x); });
        results.sources = data.sources;
        results.links = data.links;
        renderResults();
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return;
        clearTimeout(slowTimer);
        results.loading = false;
        renderOffline(e && e.message);
      });
  }

  function renderSources() {
    var box = $('sources');
    box.innerHTML = '';
    (results.sources || []).forEach(function (s) {
      box.appendChild(h('span', { class: s.ok ? 'ok' : 'ko', title: s.error || '' }, [s.name + (s.ok ? ' ' + s.count : ' — ' + s.error)]));
    });
    if (results.links && results.links.length) {
      box.appendChild(h('span', null, ['Anche su: '].concat(results.links.map(function (l, i) {
        return h('span', null, [h('a', { href: l.url, target: '_blank', rel: 'noopener', text: l.name + ' ↗' }), i < results.links.length - 1 ? ' · ' : '']);
      }))));
    }
  }

  function renderResults() {
    var box = $('results');
    box.innerHTML = '';
    var n = results.items.length;
    var dupes = results.items.filter(function (x) { return x.also && x.also.length; }).length;
    $('resInfo').textContent = n ? n + ' annunci' + (dupes ? ' · ' + dupes + ' doppioni uniti' : '') : 'Nessun annuncio';
    renderSources();
    if (!n) {
      box.appendChild(h('div', { class: 'empty' }, [h('b', { text: 'Niente con questi filtri' }), 'Prova ad allargare budget, anni o km, oppure guarda sugli altri siti qui sopra.']));
    }
    results.items.forEach(function (it) { box.appendChild(adCard(it)); });
    var more = $('more');
    more.innerHTML = '';
    if (results.hasMore) more.appendChild(h('button', { class: 'sbtn ghost', type: 'button', text: 'Carica altri', on: { click: function () { runSearch(true); } } }));
  }

  function renderOffline(msg) {
    $('resInfo').textContent = 'Server non raggiungibile';
    $('sources').innerHTML = '';
    $('more').innerHTML = '';
    var box = $('results');
    box.innerHTML = '';
    var links = S.plan(state.search).map(function (p) { return h('a', { class: 'chip', href: p.url, target: '_blank', rel: 'noopener', text: p.site.name + ' ↗' }); });
    box.appendChild(h('div', { class: 'empty' }, [
      h('b', { text: msg && !/fetch|network|json/i.test(msg) ? msg : 'Non riesco a caricare gli annunci' }),
      'Se hai aperto il file direttamente o il server dorme, riprova tra poco. Intanto puoi aprire i siti già filtrati:',
      h('div', { class: 'links' }, links)
    ]));
  }

  function renderIntro() {
    var box = $('results');
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'empty' }, [
      h('b', { text: 'Che auto cerchiamo stasera?' }),
      'Scrivi marca e modello, anche a modo tuo: "golf gti", "bmw 330", "panda 4x4 metano sotto 5k". Oppure tira la 🎲.'
    ]));
  }

  // ---------------------------------------------------------------- card annuncio
  function boardKeyOf(it) { return X.listingKey(it.url); }
  function inBoard(it) {
    var k = boardKeyOf(it);
    return state.board.some(function (b) { return b.key === k || (b.alts || []).some(function (u) { return X.listingKey(u) === k; }); });
  }

  function adCard(it) {
    var meta = [kmf(it.km), it.year, cap(it.fuel), it.cv ? it.cv + ' CV' : ''].filter(Boolean).join(' · ');
    var star = h('button', { class: 'star' + (inBoard(it) ? ' on' : ''), type: 'button', 'aria-label': 'Salva in bacheca', text: inBoard(it) ? '★' : '☆' });
    star.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      toggleSave(it);
      var on = inBoard(it);
      star.classList.toggle('on', on);
      star.textContent = on ? '★' : '☆';
    });
    var tags = [h('span', { class: 'tag ' + it.site, text: SITE_SHORT[it.site] || it.site })];
    (it.also || []).forEach(function (a) { tags.push(h('span', { class: 'tag ' + a.site, text: '+' + (SITE_SHORT[a.site] || a.site) })); });
    if (it.seller === 'privato') tags.push(h('span', { class: 'tag priv', text: 'privato' }));
    if (it.note) tags.push(h('span', { class: 'tag warn', text: it.note }));
    return h('a', { class: 'ad', href: it.url, target: '_blank', rel: 'noopener' }, [
      h('div', { class: 'ph' }, [
        it.image ? h('img', { src: it.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', decoding: 'async', on: { error: function () { this.remove(); } } }) : '🚗',
        it.photos > 1 ? h('span', { class: 'n', text: '📷 ' + it.photos }) : null
      ]),
      h('div', { class: 'bd' }, [
        h('div', { class: 'tt' }, [it.title, it.version ? h('small', { text: ' · ' + it.version }) : null]),
        h('div', { class: 'pr', text: eur(it.price) }),
        meta ? h('div', { class: 'mt', text: meta }) : null,
        h('div', { class: 'ft' }, tags.concat([it.city ? h('span', { class: 'city', text: it.city }) : null]))
      ]),
      star
    ]);
  }

  // ---------------------------------------------------------------- bacheca
  function toggleSave(it) {
    buzz(12);
    var k = boardKeyOf(it);
    var idx = -1;
    state.board.forEach(function (b, i) { if (b.key === k) idx = i; });
    if (idx >= 0) {
      state.board.splice(idx, 1);
      toast('Tolta dalla bacheca');
    } else {
      var item = {
        url: it.url, key: k, site: it.site, title: it.title + (it.version ? ' ' + it.version : ''),
        price: it.price || null, km: it.km || null, year: it.year || null, image: it.image || '',
        city: it.city || '', fuel: it.fuel || '', cv: it.cv || null,
        alts: (it.also || []).map(function (a) { return a.url; }),
        addedBy: state.me, addedAt: Date.now(), votes: { a: null, b: null }, note: ''
      };
      item.votes[state.me] = { v: 1, t: Date.now() };
      var d = X.findDuplicate(state.board, item);
      if (d && d.type === 'probable') item.dupOf = d.item.key;
      state.board.unshift(item);
      toast(d ? '⭐ Salvata (sembra uguale a una già in bacheca)' : '⭐ Salvata in bacheca');
    }
    save();
    renderBoardCount();
  }

  function renderBoardCount() {
    $('boardCount').hidden = !state.board.length;
    $('boardCount').textContent = state.board.length;
  }

  function addByLink() {
    var raw = $('addUrl').value.trim();
    var url = X.extractUrl(raw) || raw;
    var msg = $('addMsg');
    msg.hidden = true;
    if (!/^https?:\/\//i.test(url)) { msg.hidden = false; msg.textContent = 'Incolla un link valido'; return; }
    var det = X.parseDetails(raw);
    var item = {
      url: url, key: X.listingKey(url), site: X.detectSite(url).id, title: X.titleFromUrl(url) || X.detectSite(url).name,
      price: det.price, km: det.km, year: det.year, image: '', addedBy: state.me, addedAt: Date.now(),
      votes: { a: null, b: null }, note: ''
    };
    item.votes[state.me] = { v: 1, t: Date.now() };
    var d = X.findDuplicate(state.board, item);
    if (d && d.type === 'exact') { msg.hidden = false; msg.textContent = 'Già in bacheca: ' + (d.item.title || d.item.url); return; }
    if (d) item.dupOf = d.item.key;
    state.board.unshift(item);
    $('addUrl').value = '';
    save(); renderBoard(); renderBoardCount();
    toast('⭐ Aggiunta. Tocca ✏️ per prezzo e km');
  }

  function score(x) { var v = x.votes || {}, s = 0; ['a', 'b'].forEach(function (k) { if (v[k]) s += v[k].v; }); return s; }

  function renderWho() {
    Array.prototype.forEach.call($('whoSeg').children, function (b) {
      var k = b.getAttribute('data-who');
      b.textContent = state.names[k];
      b.classList.toggle('on', k === state.me);
    });
  }

  function renderBoard() {
    var box = $('board');
    var list = state.board.slice();
    var srt = state.boardSort;
    $('boardSort').value = srt;
    if (srt === 'top') list.sort(function (a, b) { return score(b) - score(a) || b.addedAt - a.addedAt; });
    else if (srt === 'prezzo') list.sort(function (a, b) { return (a.price || 1e12) - (b.price || 1e12); });
    else if (srt === 'km') list.sort(function (a, b) { return (a.km || 1e12) - (b.km || 1e12); });
    else list.sort(function (a, b) { return b.addedAt - a.addedAt; });
    box.innerHTML = '';
    $('btnClear').hidden = !list.length;
    if (!list.length) {
      box.appendChild(h('div', { class: 'empty' }, [h('b', { text: 'Bacheca vuota' }), 'Tocca ☆ su un annuncio per salvarlo qui, oppure incolla un link sopra.']));
      return;
    }
    var byKey = {};
    state.board.forEach(function (x) { byKey[x.key] = x; });
    list.forEach(function (x) { box.appendChild(savedCard(x, byKey)); });
  }

  function savedCard(x, byKey) {
    var v = x.votes || {};
    var meta = [kmf(x.km), x.year, cap(x.fuel), x.cv ? x.cv + ' CV' : ''].filter(Boolean).join(' · ');
    var dup = x.dupOf && byKey[x.dupOf];
    var tags = [h('span', { class: 'tag ' + (SITE_SHORT[x.site] ? x.site : 'altro'), text: SITE_SHORT[x.site] || X.detectSite(x.url).name })];
    (x.alts || []).forEach(function (u) { var s = X.detectSite(u).id; tags.push(h('a', { class: 'tag ' + (SITE_SHORT[s] ? s : 'altro'), href: u, target: '_blank', rel: 'noopener', text: '+' + (SITE_SHORT[s] || s) })); });
    if (x.addedBy) tags.push(h('span', { text: 'da ' + state.names[x.addedBy] }));
    return h('div', { class: 'ad saved' + (score(x) >= 2 ? ' hot' : ''), 'data-key': x.key }, [
      h('a', { class: 'ph', href: x.url, target: '_blank', rel: 'noopener' }, [x.image ? h('img', { src: x.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', on: { error: function () { this.remove(); } } }) : '🚗']),
      h('a', { class: 'bd', href: x.url, target: '_blank', rel: 'noopener', style: 'color:inherit;text-decoration:none' }, [
        h('div', { class: 'tt', text: x.title || x.url }),
        x.price ? h('div', { class: 'pr', text: eur(x.price) }) : null,
        meta ? h('div', { class: 'mt', text: meta }) : null,
        h('div', { class: 'ft' }, tags)
      ]),
      x.note ? h('div', { class: 'note', text: '📝 ' + x.note }) : null,
      dup ? h('div', { class: 'dupnote' }, [
        '👯 Sembra la stessa di "' + (dup.title || 'un altro annuncio') + '"',
        h('button', { class: 'link', type: 'button', text: 'Unisci', on: { click: function () { mergeInto(x, dup); } } }),
        h('button', { class: 'link', type: 'button', text: 'Non è lei', on: { click: function () { delete x.dupOf; save(); renderBoard(); } } })
      ]) : null,
      h('div', { class: 'row2' }, ['a', 'b'].map(function (k) {
        var mine = k === state.me, val = v[k] && v[k].v;
        return h('button', {
          class: 'vote' + (val === 1 ? ' v1' : val === -1 ? ' v-1' : ''), type: 'button', disabled: !mine,
          text: (val === 1 ? '🔥 ' : val === -1 ? '💀 ' : '· ') + state.names[k],
          on: { click: function () { if (mine) cycleVote(x); } }
        });
      }).concat([
        h('span', { class: 'sp' }),
        h('button', { class: 'ibtn sm', type: 'button', 'aria-label': 'Modifica', text: '✏️', on: { click: function () { editItem(x); } } }),
        h('button', { class: 'ibtn sm', type: 'button', 'aria-label': 'Elimina', text: '🗑️', on: { click: function () { removeItem(x); } } })
      ]))
    ]);
  }

  function cycleVote(item) {
    var v = item.votes = item.votes || {};
    var cur = v[state.me] ? v[state.me].v : 0;
    var nxt = cur === 0 ? 1 : cur === 1 ? -1 : 0;
    v[state.me] = { v: nxt, t: Date.now() };
    buzz(10);
    save(); renderBoard();
    if (score(item) === 2) toast('🔥🔥 Piace a tutti e due!');
  }

  function mergeInto(dup, main) {
    main.alts = main.alts || [];
    [dup.url].concat(dup.alts || []).forEach(function (u) { if (main.alts.indexOf(u) === -1 && u !== main.url) main.alts.push(u); });
    ['title', 'price', 'km', 'year', 'image'].forEach(function (f) { if (!main[f] && dup[f]) main[f] = dup[f]; });
    if (dup.note) main.note = main.note ? main.note + ' · ' + dup.note : dup.note;
    var mv = main.votes = main.votes || {}, dv = dup.votes || {};
    ['a', 'b'].forEach(function (k) { if (dv[k] && (!mv[k] || dv[k].t > mv[k].t)) mv[k] = dv[k]; });
    state.board = state.board.filter(function (y) { return y !== dup; });
    save(); renderBoard(); renderBoardCount();
    toast('Unite: un\'auto, più link');
  }

  function removeItem(x) {
    var idx = state.board.indexOf(x);
    state.board.splice(idx, 1);
    state.board.forEach(function (y) { if (y.dupOf === x.key) delete y.dupOf; });
    save(); renderBoard(); renderBoardCount();
    toast('Tolta. Tocca qui per annullare', 4000, function () {
      state.board.splice(idx, 0, x); save(); renderBoard(); renderBoardCount(); $('toast').classList.remove('show');
    });
  }

  function editItem(x) {
    var f = {};
    function field(label, key, type) {
      f[key] = h('input', { type: type || 'text', inputmode: type === 'number' ? 'numeric' : null, value: x[key] || '' });
      return [h('label', { text: label }), f[key]];
    }
    textDialog('Modifica', [].concat(field('Titolo', 'title'), field('Prezzo €', 'price', 'number'), field('Km', 'km', 'number'), field('Anno', 'year', 'number'), field('Nota', 'note')),
      [{ label: 'Salva', cta: true, run: function () {
        x.title = f.title.value.trim();
        x.price = int(f.price.value) || null; x.km = int(f.km.value) || null; x.year = int(f.year.value) || null;
        x.note = f.note.value.trim();
        save(); renderBoard();
      } }]);
  }

  function editNames() {
    var a = h('input', { type: 'text', value: state.names.a, maxlength: 16 });
    var b = h('input', { type: 'text', value: state.names.b, maxlength: 16 });
    textDialog('Chi siete?', [h('p', { class: 'muted', text: 'Usate gli stessi nomi su tutti e due i telefoni.' }), h('label', { text: 'Persona 1' }), a, h('label', { text: 'Persona 2' }), b],
      [{ label: 'Salva', cta: true, run: function () {
        state.names.a = a.value.trim() || 'Io'; state.names.b = b.value.trim() || 'Socio';
        save(); renderWho(); renderBoard();
      } }]);
  }

  // ---------------------------------------------------------------- condivisione
  function share(title, text, url) {
    if (navigator.share) { navigator.share({ title: title, text: text, url: url }).catch(function () { /* annullato */ }); return; }
    var ta = h('textarea', { readonly: true }, [url]);
    textDialog(title, [h('p', { text: 'Copia il link e mandalo:' }), ta], [
      { label: 'Copia', run: function () { ta.select(); try { document.execCommand('copy'); toast('Copiato'); } catch (e) { /* niente */ } return false; } },
      { label: 'WhatsApp', cta: true, run: function () { window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + url), '_blank', 'noopener'); } }
    ]);
  }
  function baseUrl() { return location.href.split('#')[0].split('?')[0]; }
  function shareBoard() {
    if (!state.board.length) { toast('La bacheca è vuota'); return; }
    var code = X.encodeBoard(state.board, state.names[state.me]);
    share('Bacheca CacciAuto', '⭐ ' + state.board.length + ' auto dalla bacheca di ' + state.names[state.me], baseUrl() + '#b=' + code);
  }
  function importBoardCode(code) {
    try {
      var data = X.decodeBoard(code);
      var res = X.mergeBoards(state.board, data.list);
      state.board = res.list;
      save(); renderBoard(); renderBoardCount();
      var st = res.stats;
      toast('📥 ' + st.added + ' nuove' + (st.merged ? ', ' + st.merged + ' già presenti' : '') + (st.probable ? ', ' + st.probable + ' forse doppioni' : ''), 4000);
      return true;
    } catch (e) { toast('Link non valido'); return false; }
  }

  // ---------------------------------------------------------------- dialog
  function openDialog(dlg) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  function bindClose(dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    Array.prototype.forEach.call(dlg.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', function () { dlg.close(); }); });
  }
  function textDialog(title, body, actions) {
    var dlg = $('dlgText');
    $('dlgTextTitle').textContent = title;
    var bb = $('dlgTextBody');
    bb.innerHTML = '';
    body.forEach(function (n) { bb.appendChild(n); });
    var act = $('dlgTextActions');
    act.innerHTML = '';
    (actions && actions.length ? actions : [{ label: 'Ok', cta: true }]).forEach(function (a) {
      act.appendChild(h('button', { type: 'button', class: 'sbtn' + (a.cta ? '' : ' ghost'), text: a.label, on: { click: function () {
        var keep = a.run && a.run() === false;
        if (!keep) dlg.close();
      } } }));
    });
    openDialog(dlg);
  }
  function showHelp() {
    textDialog('Come funziona', [
      h('ol', null, [
        h('li', { text: 'Scrivi l\'auto come la diresti a voce: "saab 93 diesel sotto 6k". Il resto in Filtri.' }),
        h('li', { text: 'Gli annunci arrivano da AutoScout24, AutoSuperMarket e Automobile.it in un\'unica lista. Se la stessa auto è su più siti la vedi una volta sola, con le etichette dei siti (es. AS24 +ASM).' }),
        h('li', { text: 'Subito, Marketplace e ilParking non si lasciano leggere: li trovi come link "Anche su", già filtrati.' }),
        h('li', { text: 'Tocca ☆ per salvare in Bacheca, votate 🔥/💀 e mandatevi la bacheca: le liste si uniscono senza doppioni.' })
      ])
    ]);
  }

  // ---------------------------------------------------------------- roulette
  var spinPick = null, spinning = false;
  function showCar(c, final) {
    $('slotEmoji').textContent = c.e;
    $('slotName').textContent = c.make + ' ' + c.model + (c.kw ? ' ' + c.kw.toUpperCase() : '');
    $('slotMeta').textContent = final ? c.y[0] + '–' + c.y[1] + ' · circa ' + kshort(c.p[0]) + '–' + kshort(c.p[1]) + ' €' : ' ';
  }
  function spin() {
    if (spinning) return;
    spinning = true;
    var max = int(state.search.pmax);
    var list = $('rouletteBudget').checked && max ? D.ROULETTE.filter(function (c) { return c.p[0] <= max; }) : D.ROULETTE;
    if (!list.length) list = D.ROULETTE;
    $('slot').classList.remove('win');
    $('slotFact').textContent = '';
    $('btnUseSpin').disabled = true;
    var steps = 16 + Math.floor(Math.random() * 6), i = 0, idx = 0;
    (function tick() {
      idx = Math.floor(Math.random() * list.length);
      showCar(list[idx], false);
      if (++i < steps) setTimeout(tick, 30 + i * i * 0.6);
      else {
        spinPick = list[idx];
        showCar(spinPick, true);
        $('slot').classList.add('win');
        $('slotFact').textContent = spinPick.f;
        $('btnUseSpin').disabled = false;
        buzz([15, 40, 20]);
        spinning = false;
      }
    })();
  }
  function useSpin() {
    var c = spinPick;
    if (!c) return;
    var s = clone(EMPTY);
    s.region = state.search.region;
    s.make = c.make; s.model = c.model; s.kw = c.kw || '';
    s.q = (c.make + ' ' + c.model + (c.kw ? ' ' + c.kw : '')).toLowerCase();
    s.ymin = String(c.y[0]); s.ymax = String(c.y[1]); s.pmax = String(c.p[1]);
    state.search = s;
    lastExtras = {};
    $('dlgRoulette').close();
    switchView('search');
    syncText();
    runSearch();
  }

  // ---------------------------------------------------------------- navigazione e avvio
  function switchView(v) {
    $('view-search').classList.toggle('active', v === 'search');
    $('view-board').classList.toggle('active', v === 'board');
    if (v === 'board') { renderWho(); renderBoard(); }
    if (v === 'search' && results.items.length) renderResults();
    window.scrollTo(0, 0);
  }

  function handleIncoming() {
    var hash = location.hash.slice(1);
    var params = new URLSearchParams(location.search);
    var mB = hash.match(/(?:^|&)b=([A-Za-z0-9_-]+)/);
    var mS = hash.match(/(?:^|&)s=([A-Za-z0-9_-]+)/);
    var handled = false;
    if (mS) {
      try { state.search = Object.assign(clone(EMPTY), X.decodeJson(mS[1])); syncText(); } catch (e) { /* ignora */ }
      handled = true;
    }
    if (mB) { if (importBoardCode(mB[1])) switchView('board'); handled = true; }
    var shared = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ');
    if (shared) {
      switchView('board');
      $('addUrl').value = shared;
      addByLink();
      handled = true;
    }
    if (handled && history.replaceState) history.replaceState(null, '', location.pathname);
  }

  function init() {
    load();
    fillSelect($('fFuel'), D.FUELS);
    fillSelect($('fGear'), D.GEARS);
    fillSelect($('fBody'), D.BODIES);
    fillSelect($('fRegion'), D.REGIONS.map(function (r) { return { k: r.k, n: r.n }; }));
    D.PRESETS.forEach(function (p) {
      $('presets').appendChild(h('button', { class: 'chip', type: 'button', text: p.e + ' ' + p.n, on: { click: function () {
        buzz();
        var s = clone(EMPTY);
        if (!p.s.make) { s.make = state.search.make; s.model = state.search.model; s.kw = state.search.kw; s.q = state.search.q; }
        s.region = state.search.region;
        state.search = Object.assign(s, p.s);
        if (p.s.make) state.search.q = p.s.make.toLowerCase();
        lastExtras = {};
        $('dlgFilters').close();
        syncText();
        runSearch();
      } } }));
    });

    var q = $('q'), typing;
    q.addEventListener('input', function () {
      applyQuery(q.value);
      $('clearQ').hidden = !q.value;
      renderSuggest();
      clearTimeout(typing);
      typing = setTimeout(runSearch, 700);
    });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(typing); q.blur(); $('suggest').hidden = true; runSearch(); } });
    q.addEventListener('blur', function () { setTimeout(function () { $('suggest').hidden = true; }, 150); });
    $('clearQ').addEventListener('click', function () { q.value = ''; applyQuery(''); $('clearQ').hidden = true; runSearch(); q.focus(); });
    $('sort').addEventListener('change', function () { state.search.sort = $('sort').value; runSearch(); });
    $('btnFilters').addEventListener('click', openFilters);
    $('filtersForm').addEventListener('submit', function () { applyFilters(); });
    $('btnResetFilters').addEventListener('click', function () {
      var f = $('filtersForm');
      ['pmin', 'pmax', 'ymin', 'ymax', 'kmmax', 'fuel', 'gear', 'body', 'cvmin', 'cvmax', 'region'].forEach(function (k) { f.elements[k].value = ''; });
      f.elements.europe.checked = false;
    });

    $('btnHome').addEventListener('click', function () { switchView('search'); });
    $('btnBoard').addEventListener('click', function () { switchView($('view-board').classList.contains('active') ? 'search' : 'board'); });
    $('btnHelp').addEventListener('click', showHelp);
    $('btnRoulette').addEventListener('click', function () { openDialog($('dlgRoulette')); if (!spinPick) spin(); });
    $('btnSpin').addEventListener('click', spin);
    $('btnUseSpin').addEventListener('click', useSpin);
    ['dlgFilters', 'dlgRoulette', 'dlgText'].forEach(function (id) { bindClose($(id)); });

    $('btnAdd').addEventListener('click', addByLink);
    $('addUrl').addEventListener('keydown', function (e) { if (e.key === 'Enter') addByLink(); });
    $('boardSort').addEventListener('change', function () { state.boardSort = $('boardSort').value; save(); renderBoard(); });
    Array.prototype.forEach.call($('whoSeg').children, function (b) {
      b.addEventListener('click', function () { state.me = b.getAttribute('data-who'); save(); renderWho(); renderBoard(); });
    });
    $('btnNames').addEventListener('click', editNames);
    $('btnShareBoard').addEventListener('click', shareBoard);
    $('btnImport').addEventListener('click', function () {
      var ta = h('textarea', { placeholder: 'Incolla il link della bacheca del socio' });
      textDialog('Importa bacheca', [ta], [{ label: 'Importa', cta: true, run: function () {
        var m = ta.value.match(/[#&]b=([A-Za-z0-9_-]+)/);
        importBoardCode(m ? m[1] : ta.value.trim());
      } }]);
    });
    $('btnClear').addEventListener('click', function () {
      textDialog('Svuoto la bacheca?', [h('p', { text: 'Le ' + state.board.length + ' auto spariscono da questo telefono.' })],
        [{ label: 'Svuota', cta: true, run: function () { state.board = []; save(); renderBoard(); renderBoardCount(); } }]);
    });

    window.addEventListener('hashchange', handleIncoming);
    handleIncoming();
    syncText();
    $('sort').value = state.search.sort || 'rilevanza';
    renderWho();
    renderBoardCount();
    runSearch();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* niente offline */ });
    }
  }

  init();
})();

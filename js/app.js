/* CacciAuto - logica dell'interfaccia. Tutto gira nel browser, niente server. */
(function () {
  'use strict';
  var D = window.CA_DATA, S = window.CA_SITES, P = window.CA_PARSE, X = window.CA_DEDUP;
  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'cacciauto.v1';

  // ---------------------------------------------------------------- stato
  var EMPTY_SEARCH = { q: '', make: '', model: '', kw: '', pmin: '', pmax: '', ymin: '', ymax: '', kmmax: '', fuel: '', gear: '', body: '', cvmin: '', cvmax: '', region: '', europe: false, sort: 'rilevanza' };
  var state = {
    search: clone(EMPTY_SEARCH),
    board: [],
    names: { a: 'Io', b: 'Socio' },
    me: 'a',
    visited: {},      // firma ricerca -> { siteId: true }
    boardSort: 'nuovi'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      Object.keys(state).forEach(function (k) { if (saved[k] !== undefined) state[k] = saved[k]; });
      state.search = Object.assign(clone(EMPTY_SEARCH), state.search);
    } catch (e) { /* storage non disponibile: si parte da zero */ }
  }
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* pazienza */ }
    }, 150);
  }

  // ---------------------------------------------------------------- utilità UI
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { /* niente */ } }
  var toastTimer;
  function toast(msg, ms) {
    var t = $('toast');
    t.onclick = null; // l'eventuale "annulla" vale solo per il suo toast
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2400);
  }
  function confetti() {
    var box = $('confetti');
    var colors = ['#ffcc00', '#ff5a36', '#3ddc84', '#0a7cff', '#ffffff'];
    for (var i = 0; i < 60; i++) {
      var c = h('i', { style: 'left:' + Math.random() * 100 + '%;background:' + colors[i % colors.length] + ';animation-delay:' + (Math.random() * 0.4) + 's;animation-duration:' + (1.2 + Math.random()) + 's' });
      box.appendChild(c);
    }
    setTimeout(function () { box.innerHTML = ''; }, 2800);
  }
  function dots(n) { return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function eur(n) { return n ? dots(n) + ' €' : ''; }
  function kmf(n) { return n ? dots(n) + ' km' : ''; }
  function kshort(n) { n = Number(n); return n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'k' : String(n); }
  function int(v) { var n = parseInt(v, 10); return isNaN(n) || n <= 0 ? '' : n; }
  function ago(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 60) return 'ora';
    if (s < 3600) return Math.floor(s / 60) + ' min fa';
    if (s < 86400) return Math.floor(s / 3600) + ' h fa';
    var d = Math.floor(s / 86400);
    return d === 1 ? 'ieri' : d + ' gg fa';
  }

  // ---------------------------------------------------------------- ricerca
  function setChips(container, items, key, opts) {
    opts = opts || {};
    container.innerHTML = '';
    items.forEach(function (it) {
      container.appendChild(h('button', {
        type: 'button', 'data-v': it.k,
        text: (it.e ? it.e + ' ' : '') + it.n,
        on: { click: function () {
          buzz();
          var cur = state.search[key];
          state.search[key] = (cur === it.k && !opts.noToggle) ? (opts.def || '') : it.k;
          onSearchChange();
        } }
      }));
    });
  }

  function buildStatic() {
    setChips($('c-fuel'), D.FUELS, 'fuel');
    setChips($('c-gear'), D.GEARS, 'gear');
    setChips($('c-body'), D.BODIES, 'body');
    setChips($('c-sort'), D.SORTS, 'sort', { noToggle: true });
    setChips($('c-boardSort'), [
      { k: 'nuovi', n: 'Ultimi', e: '🆕' }, { k: 'top', n: 'Più votate', e: '🔥' },
      { k: 'prezzo', n: 'Prezzo', e: '💶' }, { k: 'km', n: 'Km', e: '🛣️' }
    ], 'boardSort', { noToggle: true });
    // il sort della bacheca non è un filtro di ricerca: sovrascriviamo il click
    Array.prototype.forEach.call($('c-boardSort').children, function (b) {
      var nb = b.cloneNode(true);
      nb.addEventListener('click', function () { buzz(); state.boardSort = nb.getAttribute('data-v'); save(); renderBoard(); });
      b.replaceWith(nb);
    });

    var sel = $('region');
    D.REGIONS.forEach(function (r) { sel.appendChild(h('option', { value: r.k, text: r.n })); });

    var pr = $('presets');
    D.PRESETS.forEach(function (p) {
      pr.appendChild(h('button', { type: 'button', class: 'preset', on: { click: function () {
        buzz(12);
        var base = clone(EMPTY_SEARCH);
        // i preset con marca partono da zero, gli altri tengono marca/modello scelti
        if (!p.s.make) { base.make = state.search.make; base.model = state.search.model; base.kw = state.search.kw; base.q = state.search.q; }
        base.region = state.search.region;
        state.search = Object.assign(base, p.s);
        if (p.s.make) state.search.q = p.s.make.toLowerCase();
        onSearchChange(true);
        toast(p.e + ' ' + p.n);
      } } }, [h('span', { text: p.e }), p.n]));
    });

    // budget veloce
    Array.prototype.forEach.call(document.querySelectorAll('[data-quick="pmax"] button'), function (b) {
      b.addEventListener('click', function () { buzz(); state.search.pmax = b.getAttribute('data-v'); onSearchChange(true); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-quick="year"] button'), function (b) {
      b.addEventListener('click', function () {
        buzz();
        var v = b.getAttribute('data-v').split('-');
        state.search.ymin = v[0] || ''; state.search.ymax = v[1] || '';
        onSearchChange(true);
      });
    });
    Array.prototype.forEach.call($('c-km').children, function (b) {
      b.addEventListener('click', function () {
        buzz();
        var v = b.getAttribute('data-v');
        state.search.kmmax = String(state.search.kmmax) === v ? '' : v;
        onSearchChange();
      });
    });

    ['pmin', 'pmax', 'ymin', 'ymax', 'cvmin', 'cvmax'].forEach(function (id) {
      $(id).addEventListener('input', function () { state.search[id] = $(id).value; onSearchChange(false, true); });
    });
    sel.addEventListener('change', function () { state.search.region = sel.value; onSearchChange(); });
    $('europe').addEventListener('change', function () { state.search.europe = $('europe').checked; onSearchChange(); });

    // testo libero
    var q = $('q');
    q.addEventListener('input', function () { applyQuery(q.value); renderSuggest(); });
    q.addEventListener('focus', renderSuggest);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { q.blur(); $('suggest').hidden = true; document.getElementById('giro').scrollIntoView({ behavior: 'smooth' }); }
    });
    q.addEventListener('blur', function () { setTimeout(function () { $('suggest').hidden = true; }, 150); });
    $('clearQ').addEventListener('click', function () { q.value = ''; applyQuery(''); q.focus(); });

    $('btnReset').addEventListener('click', function () {
      buzz(15);
      state.search = clone(EMPTY_SEARCH);
      onSearchChange(true);
      toast('Filtri azzerati 🧽');
    });
    $('btnShareSearch').addEventListener('click', shareSearch);
    $('btnNext').addEventListener('click', function () {
      var next = nextSite();
      if (next) openSite(next.site.id, next.url);
    });
  }

  // Il testo libero decide marca/modello/parole; i filtri riconosciuti nel testo si applicano.
  var lastExtras = {};
  function applyQuery(text) {
    var r = P.parseQuery(text);
    var s = state.search;
    s.q = text; s.make = r.make; s.model = r.model; s.kw = r.kw;
    // filtri presi dal testo: li applichiamo, e li togliamo se spariscono dal testo
    ['fuel', 'gear', 'body', 'pmax'].forEach(function (f) {
      if (r[f]) s[f] = String(r[f]);
      else if (lastExtras[f] && String(s[f]) === String(lastExtras[f])) s[f] = '';
    });
    lastExtras = { fuel: r.fuel, gear: r.gear, body: r.body, pmax: r.pmax };
    onSearchChange(true, true);
  }

  function renderSuggest() {
    var box = $('suggest');
    var q = $('q').value;
    var list = P.suggest(q, 6).filter(function (x) {
      return !(x.make === state.search.make && x.model === state.search.model);
    });
    box.innerHTML = '';
    if (!list.length || !q.trim()) { box.hidden = true; return; }
    list.forEach(function (x) {
      box.appendChild(h('button', { type: 'button', text: x.label, on: { mousedown: function (e) { e.preventDefault(); }, click: function () {
        buzz();
        var kw = state.search.kw;
        var txt = x.label.toLowerCase() + (kw && !x.model ? '' : (kw ? ' ' + kw : ''));
        $('q').value = txt;
        applyQuery(txt);
        box.hidden = true;
      } } }));
    });
    box.hidden = false;
  }

  function renderParsed() {
    var s = state.search, box = $('parsed');
    box.innerHTML = '';
    function chip(label, clear) {
      box.appendChild(h('span', { class: 'pchip' }, [label, h('button', { type: 'button', 'aria-label': 'Togli', text: '✕', on: { click: function () { buzz(); clear(); onSearchChange(true); } } })]));
    }
    if (s.make) chip('🚗 ' + s.make, function () { s.make = ''; s.model = ''; s.q = s.kw; });
    if (s.model) chip('🔧 ' + s.model, function () { s.model = ''; s.q = (s.make + ' ' + s.kw).trim().toLowerCase(); });
    if (s.kw) chip('🔤 "' + s.kw + '"', function () { s.kw = ''; s.q = (s.make + ' ' + s.model).trim().toLowerCase(); });
  }

  function summary(s) {
    var p = [];
    if (s.make) p.push(s.make + (s.model ? ' ' + s.model : ''));
    if (s.kw) p.push('"' + s.kw + '"');
    if (int(s.pmin) || int(s.pmax)) p.push((int(s.pmin) ? kshort(s.pmin) + '-' : '≤') + (int(s.pmax) ? kshort(s.pmax) : '∞') + '€');
    if (int(s.ymin) || int(s.ymax)) p.push((s.ymin || '…') + '-' + (s.ymax || 'oggi'));
    if (int(s.kmmax)) p.push('≤' + kshort(s.kmmax) + ' km');
    if (s.fuel) p.push(s.fuel);
    if (s.gear) p.push(s.gear);
    if (s.body) p.push(s.body);
    if (s.region) p.push(D.REGIONS.filter(function (r) { return r.k === s.region; })[0].n);
    if (s.europe) p.push('🇪🇺');
    return p.length ? p.join(' · ') : 'Tutte le auto, ovunque';
  }

  function signature(s) {
    var c = clone(s); delete c.q;
    return JSON.stringify(c);
  }

  function plan() { return S.plan(state.search); }

  function nextSite() {
    var seen = state.visited[signature(state.search)] || {};
    var pl = plan();
    for (var i = 0; i < pl.length; i++) if (!seen[pl[i].site.id]) return pl[i];
    return null;
  }

  function openSite(id, url) {
    buzz(15);
    var sig = signature(state.search);
    var seen = state.visited[sig] = state.visited[sig] || {};
    var wasDone = Object.keys(seen).length >= S.SITES.length;
    seen[id] = true;
    // teniamo solo le ultime 30 ricerche viste
    var keys = Object.keys(state.visited);
    if (keys.length > 30) delete state.visited[keys[0]];
    save();
    window.open(url, '_blank', 'noopener');
    setTimeout(function () {
      renderSites();
      if (!wasDone && Object.keys(seen).length >= S.SITES.length) {
        confetti();
        toast('🏆 Giro completo! Salva le migliori in Bacheca', 3500);
      }
    }, 300);
  }

  function renderSites() {
    var box = $('sites');
    var pl = plan();
    var seen = state.visited[signature(state.search)] || {};
    var next = nextSite();
    box.innerHTML = '';
    var count = 0;
    pl.forEach(function (p) {
      var isSeen = !!seen[p.site.id];
      if (isSeen) count++;
      var info = [];
      if (p.total) {
        if (p.missing.length) info.push(h('div', { class: 'miss', text: '✋ da mettere lì: ' + p.missing.join(', ') }));
        else info.push(h('div', { class: 'score', text: '✓ tutti i filtri applicati' }));
      }
      var a = h('a', {
        class: 'site' + (isSeen ? ' seen' : '') + (next && next.site.id === p.site.id ? ' next' : ''),
        href: p.url, target: '_blank', rel: 'noopener',
        on: { click: function (e) { e.preventDefault(); openSite(p.site.id, p.url); } }
      }, [
        h('div', { class: 'mark', style: 'background:' + p.site.color + ';color:' + p.site.ink, text: p.site.name.charAt(0) }),
        h('div', null, [h('div', { class: 'nm', text: p.site.name }), h('div', { class: 'tg', text: p.site.tag })].concat(info)),
        h('div', { class: 'go', text: isSeen ? '✓' : '↗' })
      ]);
      box.appendChild(a);
    });
    $('giroCount').textContent = count + '/' + pl.length;
    $('giroBar').style.width = (count / pl.length * 100) + '%';
    var btn = $('btnNext');
    if (next) { btn.textContent = 'Apri ' + next.site.name + ' ➜'; btn.disabled = false; }
    else { btn.textContent = 'Giro fatto 🏆'; btn.disabled = true; }
    $('ctaSum').textContent = summary(state.search);
  }

  function syncInputs(skipText) {
    var s = state.search;
    if (!skipText) $('q').value = s.q || '';
    ['pmin', 'pmax', 'ymin', 'ymax', 'cvmin', 'cvmax'].forEach(function (id) {
      if (document.activeElement !== $(id)) $(id).value = s[id] || '';
    });
    $('region').value = s.region || '';
    $('europe').checked = !!s.europe;
    function mark(container, val) {
      Array.prototype.forEach.call(container.children, function (b) { b.classList.toggle('on', String(b.getAttribute('data-v')) === String(val || '')); });
    }
    mark($('c-fuel'), s.fuel); mark($('c-gear'), s.gear); mark($('c-body'), s.body); mark($('c-sort'), s.sort);
    mark($('c-km'), s.kmmax);
    mark(document.querySelector('[data-quick="pmax"]'), s.pmax);
    mark(document.querySelector('[data-quick="year"]'), (s.ymin || '') + '-' + (s.ymax || ''));
    $('v-price').textContent = (int(s.pmin) || int(s.pmax)) ? (int(s.pmin) ? eur(s.pmin) : '0 €') + ' → ' + (int(s.pmax) ? eur(s.pmax) : '∞') : 'qualsiasi';
    $('v-year').textContent = (int(s.ymin) || int(s.ymax)) ? (s.ymin || '…') + ' → ' + (s.ymax || 'oggi') : 'qualsiasi';
    $('v-km').textContent = int(s.kmmax) ? 'fino a ' + kmf(s.kmmax) : 'qualsiasi';
    var more = [];
    if (s.body) more.push(D.BODIES.filter(function (b) { return b.k === s.body; })[0].n);
    if (int(s.cvmin) || int(s.cvmax)) more.push((s.cvmin || '0') + '-' + (s.cvmax || '∞') + ' CV');
    $('v-more').textContent = more.join(' · ');
    if (more.length) $('moreFilters').open = true;
  }

  function onSearchChange(fromCode, skipText) {
    syncInputs(skipText || !fromCode);
    renderParsed();
    renderSites();
    save();
  }

  // ---------------------------------------------------------------- condivisione
  function shareLink(hash) {
    var base = location.href.split('#')[0].split('?')[0];
    return base + '#' + hash;
  }
  function share(title, text, url) {
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function () { /* annullato */ });
      return;
    }
    var wa = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
    textDialog('📤 ' + title, [
      h('p', { text: 'Mandalo su WhatsApp o copia il link:' }),
      h('textarea', { readonly: true, id: 'shareTa' }, [url])
    ], [
      { label: '📋 Copia', run: function () { copy(url); return false; } },
      { label: '💬 WhatsApp', cta: true, run: function () { window.open(wa, '_blank', 'noopener'); } }
    ]);
  }
  function copy(txt) {
    var done = function () { toast('Copiato 📋'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    else { fallbackCopy(txt); done(); }
  }
  function fallbackCopy(txt) {
    var ta = h('textarea', { style: 'position:fixed;opacity:0' }, [txt]);
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* niente */ }
    ta.remove();
  }
  function shareSearch() {
    buzz();
    var s = clone(state.search);
    Object.keys(s).forEach(function (k) { if (s[k] === '' || s[k] === false || (k === 'sort' && s[k] === 'rilevanza')) delete s[k]; });
    var code = X.encodeJson(s);
    share('Ricerca CacciAuto', '🏁 Guarda che ho trovato: ' + summary(state.search), shareLink('s=' + code));
  }
  function shareBoard() {
    buzz();
    if (!state.board.length) { toast('La bacheca è vuota 🤷'); return; }
    var code = X.encodeBoard(state.board, state.names[state.me]);
    share('Bacheca CacciAuto', '⭐ ' + state.board.length + ' auto dalla bacheca di ' + state.names[state.me] + ' (apri il link: si uniscono alle tue, senza doppioni)', shareLink('b=' + code));
  }

  function importBoardCode(code, silentIfEmpty) {
    try {
      var data = X.decodeBoard(code);
      var res = X.mergeBoards(state.board, data.list);
      state.board = res.list;
      save();
      renderBoard();
      var st = res.stats;
      var msg = '📥 ' + st.added + ' nuove' + (st.merged ? ', ' + st.merged + ' già presenti (voti uniti)' : '') + (st.probable ? ', ' + st.probable + ' forse doppioni' : '');
      if (data.from) msg += ' da ' + data.from;
      toast(msg, 4000);
      return true;
    } catch (e) {
      if (!silentIfEmpty) toast('Codice non valido 😕');
      return false;
    }
  }

  // ---------------------------------------------------------------- bacheca
  var SITE_COLORS = {};
  S.SITES.forEach(function (s) { SITE_COLORS[s.id] = [s.color, s.ink]; });

  function readAddForm() {
    var url = X.extractUrl($('addUrl').value) || $('addUrl').value.trim();
    return {
      url: url, key: X.listingKey(url), site: X.detectSite(url).id,
      title: $('addTitle').value.trim(), price: int($('addPrice').value) || null,
      km: int($('addKm').value) || null, year: int($('addYear').value) || null,
      note: $('addNote').value.trim()
    };
  }

  function onAddUrl(fill) {
    var raw = $('addUrl').value;
    var url = X.extractUrl(raw);
    var more = $('addMore');
    if (!url) { more.hidden = true; return; }
    more.hidden = false;
    if (fill) {
      var det = X.parseDetails(fill.text || raw);
      if (!$('addTitle').value) $('addTitle').value = (fill.title || '').trim() || X.titleFromUrl(url);
      if (!$('addPrice').value && det.price) $('addPrice').value = det.price;
      if (!$('addKm').value && det.km) $('addKm').value = det.km;
      if (!$('addYear').value && det.year) $('addYear').value = det.year;
    } else if (!$('addTitle').value) {
      $('addTitle').value = X.titleFromUrl(url);
    }
    checkAddDup();
  }

  function checkAddDup() {
    var item = readAddForm();
    var box = $('addDup');
    var d = item.url && X.findDuplicate(state.board, item);
    if (!d) { box.hidden = true; return null; }
    box.hidden = false;
    box.textContent = d.type === 'exact'
      ? '👯 Questo annuncio è già in bacheca: "' + (d.item.title || d.item.url) + '"'
      : '🤔 Sembra la stessa auto di "' + (d.item.title || 'un annuncio') + '" (' + [eur(d.item.price), kmf(d.item.km), d.item.year].filter(Boolean).join(' · ') + ')';
    return d;
  }

  function addItem() {
    var item = readAddForm();
    if (!/^https?:\/\//i.test(item.url)) { toast('Incolla un link valido 🔗'); return; }
    var d = X.findDuplicate(state.board, item);
    if (d && d.type === 'exact') {
      toast('👯 Già in bacheca, non lo aggiungo');
      highlight(d.item.key);
      return;
    }
    item.addedBy = state.me;
    item.addedAt = Date.now();
    item.votes = { a: null, b: null };
    item.votes[state.me] = { v: 1, t: Date.now() };
    if (d) item.dupOf = d.item.key;
    state.board.unshift(item);
    save();
    ['addUrl', 'addTitle', 'addPrice', 'addKm', 'addYear', 'addNote'].forEach(function (id) { $(id).value = ''; });
    $('addMore').hidden = true; $('addDup').hidden = true;
    buzz([10, 40, 10]);
    renderBoard();
    toast(d ? '⭐ Aggiunta (segnata come possibile doppione)' : '⭐ In bacheca! Ti piace già: 🔥');
  }

  function highlight(key) {
    setTimeout(function () {
      var el = document.querySelector('[data-key="' + CSS.escape(key) + '"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.animate([{ transform: 'scale(1.03)' }, { transform: 'none' }], { duration: 400 }); }
    }, 50);
  }

  function score(x) {
    var v = x.votes || {}, s = 0;
    ['a', 'b'].forEach(function (k) { if (v[k]) s += v[k].v; });
    return s;
  }

  function cycleVote(item) {
    var v = item.votes = item.votes || {};
    var cur = v[state.me] ? v[state.me].v : 0;
    var nxt = cur === 0 ? 1 : cur === 1 ? -1 : 0;
    v[state.me] = nxt ? { v: nxt, t: Date.now() } : { v: 0, t: Date.now() };
    buzz(nxt === 1 ? [10, 30, 10] : 10);
    save();
    renderBoard();
    if (score(item) === 2) { confetti(); toast('🔥🔥 Piace a tutti e due! Chiamate il venditore'); }
  }

  function mergeInto(dup, main) {
    main.alts = (main.alts || []);
    [dup.url].concat(dup.alts || []).forEach(function (u) { if (main.alts.indexOf(u) === -1 && u !== main.url) main.alts.push(u); });
    ['title', 'price', 'km', 'year'].forEach(function (f) { if (!main[f] && dup[f]) main[f] = dup[f]; });
    if (dup.note) main.note = main.note ? main.note + ' · ' + dup.note : dup.note;
    var mv = main.votes = main.votes || {}, dv = dup.votes || {};
    ['a', 'b'].forEach(function (k) { if (dv[k] && (!mv[k] || dv[k].t > mv[k].t)) mv[k] = dv[k]; });
    state.board = state.board.filter(function (x) { return x !== dup; });
  }

  function voteLabel(k, v) {
    var name = state.names[k];
    var val = v && v.v;
    return (val === 1 ? '🔥 ' : val === -1 ? '💀 ' : '· ') + name;
  }

  function renderBoard() {
    var box = $('board');
    var list = state.board.slice();
    var srt = state.boardSort;
    if (srt === 'top') list.sort(function (a, b) { return score(b) - score(a) || b.addedAt - a.addedAt; });
    else if (srt === 'prezzo') list.sort(function (a, b) { return (a.price || 1e12) - (b.price || 1e12); });
    else if (srt === 'km') list.sort(function (a, b) { return (a.km || 1e12) - (b.km || 1e12); });
    else list.sort(function (a, b) { return b.addedAt - a.addedAt; });

    Array.prototype.forEach.call($('c-boardSort').children, function (b) { b.classList.toggle('on', b.getAttribute('data-v') === srt); });
    var badge = $('boardBadge');
    badge.hidden = !state.board.length;
    badge.textContent = state.board.length;

    box.innerHTML = '';
    if (!list.length) {
      box.appendChild(h('div', { class: 'empty' }, [
        h('span', { class: 'big', text: '🅿️' }),
        'Bacheca vuota. Fate il giro dei siti e incollate qui i link delle auto che vi gasano.'
      ]));
      return;
    }
    var byKey = {};
    state.board.forEach(function (x) { byKey[x.key] = x; });

    list.forEach(function (x) {
      var col = SITE_COLORS[x.site] || ['#444', '#fff'];
      var siteName = X.detectSite(x.url).name;
      var meta = [];
      if (x.price) meta.push(h('span', null, ['💶 ', h('b', { text: eur(x.price) })]));
      if (x.km) meta.push(h('span', null, ['🛣️ ', h('b', { text: kmf(x.km) })]));
      if (x.year) meta.push(h('span', null, ['📅 ', h('b', { text: String(x.year) })]));
      var v = x.votes || {};
      var dup = x.dupOf && byKey[x.dupOf];
      var card = h('article', { class: 'car' + (score(x) >= 2 ? ' hot' : ''), 'data-key': x.key }, [
        h('div', { class: 'car-top' }, [
          h('span', { class: 'badge-site', style: 'background:' + col[0] + ';color:' + col[1], text: siteName }),
          h('span', { class: 'car-when', text: (x.addedBy ? 'da ' + state.names[x.addedBy] + ' · ' : '') + ago(x.addedAt || Date.now()) })
        ]),
        h('div', { class: 'car-title', text: x.title || x.url }),
        meta.length ? h('div', { class: 'car-meta' }, meta) : null,
        x.note ? h('div', { class: 'car-note', text: '📝 ' + x.note }) : null,
        x.alts && x.alts.length ? h('div', { class: 'car-alts' }, ['Anche su: '].concat(x.alts.map(function (u, i) {
          return h('a', { href: u, target: '_blank', rel: 'noopener', text: X.detectSite(u).name + (i < x.alts.length - 1 ? ', ' : '') });
        }))) : null,
        dup ? h('div', { class: 'dup-flag' }, [
          '👯 Forse è la stessa auto di "' + (dup.title || 'un altro annuncio') + '"',
          h('div', { class: 'r' }, [
            h('button', { type: 'button', text: '🔗 Unisci', on: { click: function () { buzz(); mergeInto(x, dup); delete x.dupOf; save(); renderBoard(); toast('Unite: un\'auto, più link 👍'); } } }),
            h('button', { type: 'button', text: '🙅 Non è lei', on: { click: function () { buzz(); delete x.dupOf; save(); renderBoard(); } } })
          ])
        ]) : null,
        h('div', { class: 'votes' }, ['a', 'b'].map(function (k) {
          var mine = k === state.me;
          var val = v[k] && v[k].v;
          return h('button', {
            type: 'button', class: 'vote' + (mine ? ' mine' : '') + (val === 1 ? ' v1' : val === -1 ? ' v-1' : ''),
            disabled: !mine, 'aria-label': 'Voto di ' + state.names[k],
            text: voteLabel(k, v[k]),
            on: { click: function () { if (mine) cycleVote(x); } }
          });
        })),
        h('div', { class: 'car-actions' }, [
          h('a', { class: 'open', href: x.url, target: '_blank', rel: 'noopener', text: 'Apri annuncio ↗' }),
          h('button', { type: 'button', 'aria-label': 'Modifica', text: '✏️', on: { click: function () { editItem(x); } } }),
          h('button', { type: 'button', 'aria-label': 'Elimina', text: '🗑️', on: { click: function () { removeItem(x); } } })
        ])
      ]);
      box.appendChild(card);
    });
  }

  function removeItem(x) {
    buzz(15);
    var idx = state.board.indexOf(x);
    state.board.splice(idx, 1);
    state.board.forEach(function (y) { if (y.dupOf === x.key) delete y.dupOf; });
    save(); renderBoard();
    toast('🗑️ Tolta. Tocca qui per annullare', 4000);
    var t = $('toast');
    t.onclick = function () { state.board.splice(idx, 0, x); save(); renderBoard(); t.classList.remove('show'); t.onclick = null; };
  }

  function editItem(x) {
    var f = {};
    function field(label, key, type) {
      f[key] = h('input', { type: type || 'text', inputmode: type === 'number' ? 'numeric' : null, value: x[key] || '' });
      return [h('label', { class: 'lbl', text: label }), f[key]];
    }
    textDialog('✏️ Modifica', [].concat(
      field('Titolo', 'title'), field('Prezzo €', 'price', 'number'), field('Km', 'km', 'number'),
      field('Anno', 'year', 'number'), field('Nota', 'note')
    ), [{ label: 'Salva', cta: true, run: function () {
      x.title = f.title.value.trim();
      x.price = int(f.price.value) || null; x.km = int(f.km.value) || null; x.year = int(f.year.value) || null;
      x.note = f.note.value.trim();
      save(); renderBoard();
    } }]);
  }

  function buildBoard() {
    var u = $('addUrl');
    u.addEventListener('input', function () { onAddUrl(); });
    u.addEventListener('paste', function () { setTimeout(function () { onAddUrl({ text: u.value }); }, 0); });
    ['addTitle', 'addPrice', 'addKm', 'addYear'].forEach(function (id) { $(id).addEventListener('input', checkAddDup); });
    $('btnAdd').addEventListener('click', addItem);
    $('btnPaste').addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { u.focus(); toast('Tieni premuto nel campo e scegli "Incolla"'); return; }
      navigator.clipboard.readText().then(function (txt) {
        u.value = X.extractUrl(txt) || txt;
        onAddUrl({ text: txt });
      }, function () { u.focus(); toast('Tieni premuto nel campo e scegli "Incolla"'); });
    });
    Array.prototype.forEach.call($('whoSeg').children, function (b) {
      b.addEventListener('click', function () { buzz(); state.me = b.getAttribute('data-who'); save(); renderWho(); renderBoard(); });
    });
    $('btnNames').addEventListener('click', editNames);
    $('btnShareBoard').addEventListener('click', shareBoard);
    $('btnImport').addEventListener('click', function () {
      var ta = h('textarea', { placeholder: 'Incolla qui il link della bacheca che ti ha mandato il socio' });
      textDialog('📥 Importa bacheca', [h('p', { class: 'muted', text: 'Le auto già presenti non vengono duplicate: si uniscono solo i voti.' }), ta], [
        { label: 'Importa', cta: true, run: function () {
          var m = ta.value.match(/[#&]b=([A-Za-z0-9_-]+)/);
          importBoardCode(m ? m[1] : ta.value.trim());
        } }
      ]);
    });
    $('btnClear').addEventListener('click', function () {
      if (!state.board.length) return;
      textDialog('🗑️ Svuoto la bacheca?', [h('p', { text: 'Tutte le ' + state.board.length + ' auto spariscono da questo telefono.' })], [
        { label: 'Sì, svuota', cta: true, run: function () { state.board = []; save(); renderBoard(); toast('Bacheca svuotata'); } }
      ]);
    });
  }

  function renderWho() {
    Array.prototype.forEach.call($('whoSeg').children, function (b) {
      var k = b.getAttribute('data-who');
      b.textContent = state.names[k];
      b.classList.toggle('on', k === state.me);
    });
  }

  function editNames() {
    var a = h('input', { type: 'text', value: state.names.a, maxlength: 16 });
    var b = h('input', { type: 'text', value: state.names.b, maxlength: 16 });
    textDialog('✏️ Chi siete?', [
      h('p', { class: 'muted', text: 'Usate gli stessi nomi su entrambi i telefoni, così i voti tornano.' }),
      h('label', { class: 'lbl', text: 'Persona 1' }), a, h('label', { class: 'lbl', text: 'Persona 2' }), b
    ], [{ label: 'Salva', cta: true, run: function () {
      state.names.a = a.value.trim() || 'Io';
      state.names.b = b.value.trim() || 'Socio';
      save(); renderWho(); renderBoard();
    } }]);
  }

  // ---------------------------------------------------------------- dialog generico
  function textDialog(title, body, actions) {
    var dlg = $('dlgText');
    $('dlgTextTitle').textContent = title;
    var bodyBox = $('dlgTextBody');
    bodyBox.innerHTML = '';
    body.forEach(function (n) { bodyBox.appendChild(n); });
    var act = $('dlgTextActions');
    act.innerHTML = '';
    (actions || []).forEach(function (a) {
      act.appendChild(h('button', { type: 'button', class: a.cta ? 'cta' : 'ghost', text: a.label, on: { click: function () {
        var keep = a.run && a.run() === false;
        if (!keep) dlg.close();
      } } }));
    });
    if (!actions || !actions.length) act.appendChild(h('button', { type: 'button', class: 'cta', text: 'Ok', on: { click: function () { dlg.close(); } } }));
    openDialog(dlg);
  }
  function openDialog(dlg) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }
  function bindDialogClose(dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    Array.prototype.forEach.call(dlg.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', function () { dlg.close(); }); });
  }

  function showHelp() {
    textDialog('Come funziona', [
      h('ol', null, [
        h('li', { text: 'Scrivi cosa cerchi come lo diresti al tuo amico: "golf gti benzina sotto 8k". Marca, modello e filtri li capisco da solo.' }),
        h('li', { text: 'Sistema budget, anni, km, zona con i bottoni.' }),
        h('li', { text: 'Tocca il bottone giallo in basso: apre il primo sito già filtrato. Torna qui e ritoccalo per il sito dopo. Fate il giro completo! 🏁' }),
        h('li', { text: 'Le auto che vi piacciono: copia il link e mettilo in ⭐ Bacheca. Se è un doppione (stesso annuncio, o la stessa auto su un altro sito) te lo dico io.' }),
        h('li', { text: 'Votate 🔥 o 💀, poi "📤 Manda al socio" dalla Bacheca: le vostre liste si uniscono senza doppioni.' })
      ]),
      h('p', { class: 'muted', text: 'Perché apre i siti invece di mostrare tutto qui? Perché un sito senza server non può leggere i dati di Subito & co. (i browser lo bloccano per sicurezza). Così però vedi sempre gli annunci veri e aggiornati, con foto e contatti.' }),
      h('p', { class: 'muted', text: 'Tutto resta salvato solo su questo telefono.' })
    ]);
  }

  // ---------------------------------------------------------------- roulette
  var spinPick = null, spinning = false;
  function rouletteList() {
    var max = int(state.search.pmax);
    if ($('rouletteBudget').checked && max) {
      var l = D.ROULETTE.filter(function (c) { return c.p[0] <= max; });
      if (l.length) return l;
    }
    return D.ROULETTE;
  }
  function showCar(c, final) {
    $('slotEmoji').textContent = c.e;
    $('slotName').textContent = c.make + ' ' + c.model + (c.kw ? ' ' + c.kw.toUpperCase() : '');
    $('slotMeta').textContent = final ? c.y[0] + '–' + c.y[1] + ' · circa ' + kshort(c.p[0]) + '–' + kshort(c.p[1]) + ' €' : ' ';
  }
  function spin() {
    if (spinning) return;
    spinning = true;
    var list = rouletteList();
    var slot = $('slot');
    slot.classList.remove('win');
    slot.classList.add('spinning');
    $('slotFact').textContent = '';
    $('btnUseSpin').disabled = true;
    var steps = 18 + Math.floor(Math.random() * 6), i = 0, last = -1;
    (function tick() {
      var idx;
      do { idx = Math.floor(Math.random() * list.length); } while (idx === last && list.length > 1);
      last = idx;
      showCar(list[idx], false);
      buzz(4);
      i++;
      if (i < steps) setTimeout(tick, 30 + i * i * 0.5);
      else {
        spinPick = list[idx];
        showCar(spinPick, true);
        slot.classList.remove('spinning');
        slot.classList.add('win');
        $('slotFact').textContent = '💡 ' + spinPick.f;
        $('btnUseSpin').disabled = false;
        buzz([20, 50, 30]);
        spinning = false;
      }
    })();
  }
  function useSpin() {
    if (!spinPick) return;
    var c = spinPick;
    var base = clone(EMPTY_SEARCH);
    base.region = state.search.region;
    base.make = c.make; base.model = c.model; base.kw = c.kw || '';
    base.q = (c.make + ' ' + c.model + (c.kw ? ' ' + c.kw : '')).toLowerCase();
    base.ymin = String(c.y[0]); base.ymax = String(c.y[1]);
    base.pmax = String(int(state.search.pmax) && $('rouletteBudget').checked ? Math.min(int(state.search.pmax), c.p[1]) : c.p[1]);
    state.search = base;
    lastExtras = {};
    $('dlgRoulette').close();
    switchView('search');
    onSearchChange(true);
    toast(c.e + ' Caccia alla ' + c.make + ' ' + c.model + '!');
    setTimeout(function () { $('giro').scrollIntoView({ behavior: 'smooth' }); }, 200);
  }

  // ---------------------------------------------------------------- navigazione
  function switchView(v) {
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (el) { el.classList.toggle('active', el.id === 'view-' + v); });
    Array.prototype.forEach.call(document.querySelectorAll('.tab[data-view]'), function (t) { t.classList.toggle('active', t.getAttribute('data-view') === v); });
    $('ctaBar').style.display = v === 'search' ? '' : 'none';
    window.scrollTo(0, 0);
  }

  // Link in arrivo: ricerca condivisa (#s=), bacheca condivisa (#b=), condivisione da app (?url=&text=)
  function handleIncoming() {
    var hash = location.hash.slice(1);
    var params = new URLSearchParams(location.search);
    var cleaned = false;
    var mS = hash.match(/(?:^|&)s=([A-Za-z0-9_-]+)/);
    var mB = hash.match(/(?:^|&)b=([A-Za-z0-9_-]+)/);
    if (mS) {
      try {
        var s = X.decodeJson(mS[1]);
        state.search = Object.assign(clone(EMPTY_SEARCH), s);
        onSearchChange(true);
        toast('🏁 Ricerca del socio caricata!');
      } catch (e) { toast('Link ricerca non valido 😕'); }
      cleaned = true;
    }
    if (mB) {
      if (importBoardCode(mB[1])) switchView('board');
      cleaned = true;
    }
    var sharedText = [params.get('title'), params.get('text'), params.get('url')].filter(Boolean).join(' ');
    if (sharedText) {
      var url = X.extractUrl(sharedText);
      switchView('board');
      if (url) {
        $('addUrl').value = url;
        onAddUrl({ text: sharedText, title: params.get('title') || '' });
        toast('🔗 Link ricevuto: controlla e metti in bacheca');
      } else toast('Non ho trovato un link nel testo condiviso 🤔');
      cleaned = true;
    }
    if (cleaned && history.replaceState) history.replaceState(null, '', location.pathname);
  }

  function init() {
    load();
    buildStatic();
    buildBoard();
    bindDialogClose($('dlgRoulette'));
    bindDialogClose($('dlgText'));
    Array.prototype.forEach.call(document.querySelectorAll('.tab[data-view]'), function (t) {
      t.addEventListener('click', function () { buzz(); switchView(t.getAttribute('data-view')); });
    });
    $('btnRoulette').addEventListener('click', function () {
      buzz(12);
      openDialog($('dlgRoulette'));
      if (!spinPick) spin();
    });
    $('btnSpin').addEventListener('click', spin);
    $('btnUseSpin').addEventListener('click', useSpin);
    $('btnHelp').addEventListener('click', showHelp);
    window.addEventListener('hashchange', handleIncoming);
    // al ritorno dal sito aperto, aggiorniamo i "visti"
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderSites(); });

    onSearchChange(true);
    renderWho();
    renderBoard();
    handleIncoming();

    var first = true;
    try { first = !localStorage.getItem(STORE_KEY + '.seen'); localStorage.setItem(STORE_KEY + '.seen', '1'); } catch (e) { first = false; }
    if (first && !location.hash) setTimeout(showHelp, 400);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline non disponibile */ });
    }
  }

  init();
})();

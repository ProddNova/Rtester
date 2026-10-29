/*
 * Costruttori di URL per ogni sito.
 * Un sito statico non può leggere i risultati degli altri siti (il browser lo blocca: CORS),
 * quindi qui generiamo il link di ricerca GIÀ filtrato e lo apriamo.
 * Ogni sito dichiara in `supports` quali filtri riesce davvero ad applicare.
 */
(function (root) {
  var D = root.CA_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  var M = root.CA_MODELS || (typeof require !== 'undefined' ? (function () { try { return require('./models.js'); } catch (e) { return null; } })() : null);

  // Codici AutoScout24 di marca/modello (dall'elenco completo in models.js)
  function asIds(make, model) {
    if (!M || !make) return null;
    var mk = null;
    for (var i = 0; i < M.makes.length; i++) if (M.makes[i].n === make) { mk = M.makes[i]; break; }
    if (!mk) return null;
    var out = { make: mk.id, model: null, group: false };
    if (model) {
      if ((mk.g || []).indexOf(model) !== -1) out.group = true;
      else for (var j = 0; j < (mk.m || []).length; j++) if (mk.m[j][0] === model) { out.model = mk.m[j][1]; break; }
    }
    return out;
  }

  function strip(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  // "Serie 3" -> "serie-3", "Mercedes-Benz" -> "mercedes-benz", "up!" -> "up"
  function slug(s) {
    return strip(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  // Slug marca/modello per un sito, tenendo conto delle eccezioni in SLUG_FIX.
  // Ritorna '' per il modello se il sito non lo conosce.
  function fix(siteId) { return (D.SLUG_FIX && D.SLUG_FIX[siteId]) || {}; }
  function makeSlug(siteId, make) {
    var f = fix(siteId);
    return f[make] !== undefined ? f[make] : slug(make);
  }
  function modelSlug(siteId, make, model) {
    if (!model) return '';
    var f = fix(siteId), k = make + '|' + model;
    if (f[k] === null) return '';
    return f[k] !== undefined ? f[k] : slug(model);
  }
  function modelDropped(siteId, s) {
    return !!(s.make && s.model && fix(siteId)[s.make + '|' + s.model] === null);
  }
  function region(k) {
    for (var i = 0; i < D.REGIONS.length; i++) if (D.REGIONS[i].k === k) return D.REGIONS[i];
    return null;
  }
  function makeInfo(name) {
    for (var i = 0; i < D.MAKES.length; i++) if (D.MAKES[i].n === name) return D.MAKES[i];
    return null;
  }
  function qs(params) {
    var out = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '' || v === false) return;
      out.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return out.length ? '?' + out.join('&') : '';
  }
  function num(v) {
    var n = parseInt(v, 10);
    return isNaN(n) || n <= 0 ? '' : n;
  }
  // Testo libero: marca + modello + parole chiave.
  function text(s, opts) {
    opts = opts || {};
    var parts = [];
    if (s.make && !opts.noMake) parts.push(s.make === 'Mercedes-Benz' ? 'Mercedes' : s.make);
    if (s.model) parts.push(s.model);
    if (s.kw) parts.push(s.kw);
    return parts.join(' ').trim();
  }

  var SITES = [
    {
      id: 'subito',
      name: 'Subito',
      color: '#f9423a',
      ink: '#fff',
      tag: 'Privati + concessionari',
      supports: ['marca', 'modello', 'parole', 'prezzo', 'anno', 'carburante', 'cambio', 'cv', 'zona', 'ordine'],
      build: function (s) {
        var FUEL = { benzina: '1', diesel: '2', gpl: '3', elettrica: '4', metano: '7', ibrida: '6,8,9,10,11' };
        var GEAR = { manuale: '1', automatico: '2' };
        var ORDER = { prezzo: 'priceasc', recenti: 'datedesc' };
        var r = region(s.region);
        var base = 'https://www.subito.it/annunci-' + (r ? r.k : 'italia') + '/vendita/auto/';
        return base + qs({
          q: text(s),
          ps: num(s.pmin), pe: num(s.pmax),
          ys: num(s.ymin), ye: num(s.ymax),
          fl: FUEL[s.fuel], gr: GEAR[s.gear],
          hps: num(s.cvmin), hpe: num(s.cvmax),
          order: ORDER[s.sort]
        });
      }
    },
    {
      id: 'autoscout',
      name: 'AutoScout24',
      color: '#f5f200',
      ink: '#333',
      tag: 'Il più grande in Europa',
      supports: ['marca', 'modello', 'parole', 'prezzo', 'anno', 'km', 'carburante', 'cambio', 'carrozzeria', 'cv', 'zona', 'ordine', 'europa', 'venditore'],
      build: function (s) {
        var FUEL = { benzina: 'B', diesel: 'D', gpl: 'L', metano: 'C', elettrica: 'E', ibrida: '2,3' };
        var GEAR = { manuale: 'M', automatico: 'A' };
        var BODY = { citycar: '1', cabrio: '2', coupe: '3', suv: '4', sw: '5', berlina: '6' };
        var SORT = { prezzo: ['price', '0'], recenti: ['age', '1'], km: ['mileage', '0'] };
        var path = 'https://www.autoscout24.it/lst';
        var ids = asIds(s.make, s.model);
        var mmmv = '';
        if (ids && (!s.model || ids.model)) {
          // codici esatti: marca sola o marca + modello singolo (es. BMW M3)
          mmmv = ids.make + '|' + (ids.model || '') + '||';
        } else if (s.make) {
          // gruppi di modelli (es. "Serie 3") e marche non in elenco: nomi nel percorso
          path += '/' + makeSlug('autoscout', s.make);
          var asm = modelSlug('autoscout', s.make, s.model);
          if (asm) path += '/' + asm;
        }
        var r = !s.europe && region(s.region);
        var sort = SORT[s.sort] || ['standard', '0'];
        var cvToKw = function (cv) { var n = num(cv); return n ? Math.round(n / 1.36) : ''; };
        return path + qs({
          atype: 'C',
          mmmv: mmmv,
          version: s.kw || '',
          cy: s.europe ? 'D,A,B,E,F,I,L,NL' : 'I',
          damaged_listing: 'exclude',
          ustate: 'N,U',
          pricefrom: num(s.pmin), priceto: num(s.pmax),
          fregfrom: num(s.ymin), fregto: num(s.ymax),
          kmfrom: num(s.kmmin), kmto: num(s.kmmax),
          custtype: s.seller === 'privato' ? 'P' : s.seller === 'concessionario' ? 'D' : '',
          fuel: FUEL[s.fuel], gear: GEAR[s.gear], body: BODY[s.body],
          powerfrom: cvToKw(s.cvmin), powerto: cvToKw(s.cvmax), powertype: (num(s.cvmin) || num(s.cvmax)) ? 'kw' : '',
          zip: r ? r.cap : '', zipr: r ? r.r : '',
          sort: sort[0], desc: sort[1]
        });
      }
    },
    {
      id: 'autosupermarket',
      name: 'AutoSuperMarket',
      color: '#0a7cff',
      ink: '#fff',
      tag: 'Tanti concessionari',
      supports: ['marca', 'modello', 'prezzo', 'anno', 'km', 'carburante', 'cambio', 'zona'],
      build: function (s) {
        var FUEL = { benzina: 'benzina', diesel: 'diesel', gpl: 'gpl', metano: 'metano', elettrica: 'elettrico', ibrida: 'ibrido-benzina-elettrico' };
        var path = 'https://autosupermarket.it/auto-usate';
        var r = region(s.region);
        if (r) path += '/' + r.k;
        if (s.make) {
          path += '/' + makeSlug('autosupermarket', s.make);
          var md = modelSlug('autosupermarket', s.make, s.model);
          if (md) path += '/' + md;
        }
        return path + qs({
          'prezzo-da': num(s.pmin), 'prezzo-a': num(s.pmax),
          'anno-da': num(s.ymin), 'anno-a': num(s.ymax),
          'km-da': num(s.kmmin), 'km-a': num(s.kmmax),
          alimentazione: FUEL[s.fuel],
          cambio: s.gear || ''
        });
      }
    },
    {
      id: 'automobile',
      name: 'Automobile.it',
      color: '#00b37e',
      ink: '#fff',
      tag: 'Annunci in tutta Italia',
      supports: ['marca', 'modello', 'zona'],
      build: function (s) {
        var u = function (x) { return slug(x).replace(/-/g, '_'); };
        var parts = [];
        if (s.make) {
          parts.push(u(makeSlug('automobile', s.make)));
          var md = modelSlug('automobile', s.make, s.model);
          if (md) parts.push(u(md));
        }
        var r = region(s.region);
        if (r) parts.push(u(r.k));
        return 'https://www.automobile.it/' + (parts.length ? parts.join('-') : 'annunci');
      }
    },
    {
      id: 'ilparking',
      name: 'ilParking',
      color: '#ff8a00',
      ink: '#fff',
      tag: 'Aggregatore (già senza doppioni)',
      supports: ['marca', 'modello'],
      build: function (s) {
        if (!s.make) return 'https://www.ilparking.it/auto-occasione/';
        var m = makeInfo(s.make);
        var name = slug(m && m.ilp ? m.ilp : s.make);
        if (s.model) name += '-' + slug(s.model);
        return 'https://www.ilparking.it/auto-occasione/' + name + '.html';
      }
    },
    {
      id: 'facebook',
      name: 'Marketplace',
      color: '#1877f2',
      ink: '#fff',
      tag: 'Facebook, tanti privati',
      supports: ['marca', 'modello', 'parole', 'prezzo', 'anno', 'km', 'cambio', 'ordine'],
      build: function (s) {
        var SORT = { prezzo: 'price_ascend', recenti: 'creation_time_descend', km: 'vehicle_mileage_ascend' };
        return 'https://www.facebook.com/marketplace/category/vehicles' + qs({
          query: text(s),
          minPrice: num(s.pmin), maxPrice: num(s.pmax),
          minYear: num(s.ymin), maxYear: num(s.ymax),
          maxMileage: num(s.kmmax),
          transmissionType: s.gear === 'manuale' ? 'manual' : s.gear === 'automatico' ? 'automatic' : '',
          sortBy: SORT[s.sort],
          exact: 'false'
        });
      }
    }
  ];

  // Tutti i filtri possibili, con etichetta. Serve per mostrare cosa NON viene applicato.
  var FILTER_LABELS = {
    marca: 'marca', modello: 'modello', parole: 'parole chiave', prezzo: 'prezzo', anno: 'anno',
    km: 'km', carburante: 'carburante', cambio: 'cambio', carrozzeria: 'carrozzeria', cv: 'potenza',
    zona: 'zona', ordine: 'ordinamento', europa: 'Europa', venditore: 'tipo venditore'
  };

  // Quali filtri l'utente ha impostato (in "lingua filtri").
  function activeFilters(s) {
    var a = [];
    if (s.make) a.push('marca');
    if (s.model) a.push('modello');
    if (s.kw) a.push('parole');
    if (num(s.pmin) || num(s.pmax)) a.push('prezzo');
    if (num(s.ymin) || num(s.ymax)) a.push('anno');
    if (num(s.kmmax) || num(s.kmmin)) a.push('km');
    if (s.seller) a.push('venditore');
    if (s.fuel) a.push('carburante');
    if (s.gear) a.push('cambio');
    if (s.body) a.push('carrozzeria');
    if (num(s.cvmin) || num(s.cvmax)) a.push('cv');
    if (s.region && !s.europe) a.push('zona');
    if (s.sort && s.sort !== 'rilevanza') a.push('ordine');
    if (s.europe) a.push('europa');
    return a;
  }

  // Per ogni sito: link + filtri persi per strada (da impostare a mano sul sito).
  function plan(s) {
    var active = activeFilters(s);
    return SITES.map(function (site) {
      var missing = active.filter(function (f) {
        return site.supports.indexOf(f) === -1 || (f === 'modello' && modelDropped(site.id, s));
      });
      return {
        site: site,
        url: site.build(s),
        applied: active.length - missing.length,
        total: active.length,
        missing: missing.map(function (f) { return FILTER_LABELS[f]; })
      };
    });
  }

  var api = { SITES: SITES, plan: plan, slug: slug, activeFilters: activeFilters, strip: strip, modelDropped: modelDropped };
  root.CA_SITES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

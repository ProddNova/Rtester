/*
 * Riconoscere marca e modello di un annuncio dal testo (titolo + versione), usato da server e telefono:
 *  - filtro modello rigoroso (alcuni siti, se hanno pochi annunci, aggiungono auto "simili": le togliamo)
 *  - ban list (marca + modello precisi, es. Abarth 500)
 *  - auto elettriche: escluse sempre
 */
(function (root) {
  function strip(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  // "Saab 9-3 2.0T" -> " saab 9 3 2 0t " (spazi ai lati per cercare parole intere)
  function words(s) { return ' ' + strip(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }

  // Alias delle marche come compaiono nei titoli
  var MAKE_ALIAS = {
    'mercedes-benz': ['mercedes', 'mb'], volkswagen: ['vw'], 'alfa romeo': ['alfa'], 'land rover': ['landrover', 'land rover'],
    citroen: ['citroen'], 'rolls-royce': ['rolls'], 'aston martin': ['aston'], mini: ['mini'], 'ds automobiles': ['ds']
  };
  function makeHit(t, make) {
    if (!make) return true;
    var m = strip(make).toLowerCase();
    var list = [m].concat(MAKE_ALIAS[m] || []);
    return list.some(function (x) { return t.indexOf(words(x)) !== -1 || t.indexOf(' ' + x.replace(/[^a-z0-9]/g, '') + ' ') !== -1; });
  }

  // Il modello compare nel testo? Gestisce i nomi italiani dei gruppi e quelli tedeschi/olandesi:
  //  "Serie 3" = 320d, 3er, 3-Serie · "Classe C" = C 220, C220d, C-Klasse · "MX-5" = MX5
  function modelHit(t, model) {
    if (!model) return true;
    // gruppi tipo "500/595/695": basta uno dei nomi
    if (model.indexOf('/') !== -1) return model.split('/').some(function (m) { return m.trim() && modelHit(t, m.trim()); });
    var w = words(model);
    if (t.indexOf(w) !== -1) return true;
    var compact = w.replace(/ /g, '');
    // "MX-5" scritto "MX5", "9-3" scritto "93": confronto senza spazi (solo nomi con lettere e numeri)
    if (compact.length >= 3 && /[a-z]/.test(compact) && /\d/.test(compact) && t.indexOf(' ' + compact) !== -1) return true;
    if (w.trim().indexOf(' ') !== -1 && compact.length >= 2 && t.indexOf(' ' + compact + ' ') !== -1) return true;
    var m;
    if ((m = model.match(/^Serie\s+(\d)$/i))) {
      var n = m[1];
      return new RegExp(' (' + n + '\\d\\d[a-z]{0,3}|' + n + 'er|' + n + ' serie|serie ' + n + '|' + n + ' series|m' + n + ') ').test(t);
    }
    if ((m = model.match(/^Classe\s+([a-z]{1,3})$/i))) {
      var c = m[1].toLowerCase();
      return new RegExp(' (' + c + ' ?\\d{2,3}[a-z]{0,4}|' + c + ' klasse|' + c + ' class|' + c + 'klasse|classe ' + c + '|amg ' + c + ' ?\\d{2}) ').test(t);
    }
    return false;
  }

  function text(it) { return words((it.title || '') + ' ' + (it.version || '')); }

  // Annuncio di questa marca e modello? (per la ban list servono entrambi)
  function isModel(it, make, model) {
    var t = text(it);
    return makeHit(t, make) && modelHit(t, model);
  }

  function banned(it, bans) {
    if (!bans || !bans.length) return false;
    var t = text(it);
    for (var i = 0; i < bans.length; i++) {
      var b = bans[i];
      if (b && b.make && b.model && makeHit(t, b.make) && modelHit(t, b.model)) return true;
    }
    return false;
  }

  // Elettriche: escluse sempre (scelta dell'app). Ibride e plug-in restano.
  var EV_MAKES = /^ (tesla|polestar|byd|nio|xpeng|lucid|rivian|aiways|lynk) /;
  var EV_WORDS = / (full electric|100 elettrica|elettrica|elettrico|electric|elektro|elektroauto|bev|e tense|zoe|leaf|e golf|id 3|id 4|id 5|id 7|id buzz|enyaq|eqa|eqb|eqc|eqe|eqs|eqv|i3|i4|i5|i7|ix|ix1|ix3|e niro|ioniq 5|ioniq 6|ev6|ev9|mach e|taycan|e 208|e 2008|e c4|e up|e 500|500e|mg4|megane e tech|r5 e tech|twingo electric|dolphin|atto 3|seal|model 3|model s|model x|model y) /;
  function isElectric(it) {
    if (it.fuel === 'elettrica') return true;
    if (it.fuel && it.fuel !== 'elettrica') return false; // ibrida, benzina... dichiarato dal sito
    var t = text(it);
    if (EV_MAKES.test(t)) return true;
    // "elettrica" ma anche "ibrida"/"hybrid": è un'ibrida
    if (/ (hybrid|ibrid[ao]|plug in|phev|hev|mhev) /.test(t)) return false;
    return EV_WORDS.test(t);
  }

  var api = { words: words, text: text, makeHit: makeHit, modelHit: modelHit, isModel: isModel, banned: banned, isElectric: isElectric };
  root.CA_MATCH = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

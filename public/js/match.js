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

  // ---- km falsi: tanti mettono 0, 1, 300, 999 km o 111.111 / 123.456 a caso
  function isFakeKm(it) {
    var km = it.km;
    if (km === null || km === undefined || km === '') return false;
    km = Number(km);
    var s = String(km);
    if (km >= 100000 && (/^(\d)\1+$/.test(s) || s === '123456' || s === '1234567' || km >= 999000)) return true;
    // meno di 1.000 km su un'auto di almeno 2 anni (o senza anno): quasi sempre un numero messo a caso
    var thisYear = new Date().getFullYear();
    return km < 1000 && (!it.year || it.year <= thisYear - 2);
  }

  // ---- carrozzeria scritta dal sito -> chiave filtro
  function normBody(b) {
    var t = strip(b).toLowerCase();
    if (!t) return '';
    if (/cabri|spider|roadster|spyder|targa/.test(t)) return 'cabrio';
    if (/coup/.test(t)) return 'coupe';
    if (/station|kombi|touring|avant|wagon|break|estate|\bsw\b|variant/.test(t)) return 'sw';
    if (/suv|fuoristrada|4x4|gelande|terrein|pick ?up|crossover/.test(t)) return 'suv';
    if (/city|utilitaria|kleinwagen|piccola/.test(t)) return 'citycar';
    if (/berlina|sedan|limousine|hatchback|compatta|due volumi|monovolume|mpv|van/.test(t)) return 'berlina';
    return '';
  }

  // ---- cosa dice la descrizione: segnali buoni e cattivi (italiano, tedesco, olandese, inglese)
  var NEG = '(?:mai|non|nessun[ao]?|senza|zero|nie|kein[e]?|nicht|nooit|geen|niet|no)\\s+(?:\\S+\\s+){0,2}';
  var FLAGS = [
    // prima i problemi (così "motore da rifare" non diventa "motore rifatto")
    { k: 'motore-ko', t: 'Motore da rifare', bad: true, re: /motore (?:da (?:rifare|revisionare|sistemare)|rotto|fuso|grippato|bloccato|in avaria|non funzionante|che (?:fuma|batte))|(?:guarnizione|testata) (?:da (?:rifare|cambiare)|bruciat|andat)|motorschaden|motordefekt|motor defekt|motorschade|engine (?:damage|failure)|blown engine/ },
    { k: 'cambio-ko', t: 'Cambio da rifare', bad: true, re: /cambio (?:da (?:rifare|sistemare)|rotto|che gratta|difettoso)|getriebeschaden|getriebe defekt|versnellingsbak defect/ },
    { k: 'ferma', t: 'Non marciante', bad: true, re: /non (?:marciante|parte|si accende|cammina)|ferm[ao] da (?:anni|tempo)|nicht fahrbereit|springt nicht an|rijdt niet|start niet|non runner|not running/ },
    { k: 'ricambi', t: 'Per ricambi', bad: true, re: /(?:per|solo|come) (?:ricambi|pezzi)|uso ricambi|f(?:u|ü)r teile|ersatzteil|teilespender|voor onderdelen|for parts/ },
    { k: 'sistemare', t: 'Da sistemare', bad: true, re: /da (?:sistemare|restaurare|riparare)|bastler|restaurierungsobjekt|opknapper|project car/ },
    { k: 'incidente', t: 'Incidentata', bad: true, neg: true, re: /incidentat|sinistrat|unfallwagen|unfallschaden|unfallfahrzeug|schadeauto|schadewagen|accident damage/ },
    { k: 'grandine', t: 'Grandinata', bad: true, neg: true, re: /grandinat|hagelschaden|hagelschade|hail damage/ },
    { k: 'revisione', t: 'Revisione scaduta', bad: true, re: /revisione scaduta|senza revisione|t(?:u|ü)v (?:abgelaufen|f(?:a|ä)llig)|ohne t(?:u|ü)v|apk verlopen|zonder apk/ },
    { k: 'km', t: 'Km non garantiti', bad: true, re: /km non (?:garantiti|certificati|reali)|chilometraggio non (?:garantito|certificato)|tachostand nicht|km stand onbekend|km niet logisch/ },
    // segnali buoni
    { k: 'motore-ok', t: 'Motore rifatto', re: /motore (?:(?:appena |completamente |totalmente )?(?:rifatto|revisionato|rigenerato|ricostruito)|nuovo|sostituito|a zero ore)|motor (?:neu|(?:general)?(?:u|ü)berholt|revidiert|getauscht|gereviseerd|nieuw|vervangen|revisie)|engine (?:rebuilt|rebuild|overhauled)/ },
    { k: 'distribuzione', t: 'Distribuzione fatta', re: /distribuzione (?:appena )?(?:fatta|sostituita|nuova|eseguita)|(?:kit|cinghia) (?:di )?distribuzione (?:fatt|sostituit|nuov|eseguit)|cinghia (?:appena )?(?:sostituita|nuova|cambiata)|zahnriemen (?:neu|gewechselt|erneuert)|distributieriem (?:vervangen|nieuw)|distributie (?:vervangen|nieuw)|timing belt (?:replaced|done)/ },
    { k: 'frizione', t: 'Frizione nuova', re: /frizione (?:appena )?(?:nuova|sostituita|rifatta|cambiata)|kupplung (?:neu|erneuert|gewechselt)|koppeling (?:nieuw|vervangen)/ },
    { k: 'tagliandi', t: 'Tagliandi documentati', re: /tagliandi (?:certificati|documentati|regolari|ufficiali)|libretto (?:dei )?tagliandi|scheckheft|dealer onderhouden|onderhoudsboekje|full service history/ },
    { k: 'proprietario', t: 'Un solo proprietario', re: /unico proprietario|primo proprietario|prima mano|1\. ?hand|erste hand|erster hand|eerste eigenaar|1 eigenaar|one owner/ },
    { k: 'asi', t: 'Storica / ASI', neg: true, re: /\basi\b|targa oro|iscritt[ao] (?:all'?)?asi|certificat[ao] asi|h-kennzeichen|oldtimer kenteken/ }
  ];
  // [{ t: 'Motore rifatto', bad: false }, ...] dal testo dell'annuncio
  function flags(txt) {
    var t = ' ' + strip(txt).toLowerCase().replace(/\s+/g, ' ') + ' ';
    var out = [], seen = {};
    FLAGS.forEach(function (f) {
      var m = t.match(f.re);
      if (!m) return;
      if (f.neg) {
        // "mai incidentata", "non incidentata", "unfallfrei": non è un problema
        var before = t.slice(Math.max(0, m.index - 25), m.index);
        if (new RegExp(NEG + '$').test(before) || /unfallfrei|schadefrei|ongevalvrij/.test(t)) return;
      }
      if (f.k === 'motore-ok' && seen['motore-ko']) return;
      seen[f.k] = 1;
      out.push({ k: f.k, t: f.t, bad: !!f.bad });
    });
    return out;
  }

  var api = { words: words, text: text, isFakeKm: isFakeKm, normBody: normBody, flags: flags, makeHit: makeHit, modelHit: modelHit, isModel: isModel, banned: banned, isElectric: isElectric };
  root.CA_MATCH = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

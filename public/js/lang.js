/* Riconosce la lingua di un testo contando parole molto comuni (basta per gli annunci). */
(function (root) {
  var WORDS = {
    it: ['il', 'lo', 'la', 'di', 'che', 'e', 'con', 'per', 'del', 'della', 'auto', 'vettura', 'ottime', 'condizioni', 'tagliandi', 'sono', 'non', 'anche', 'una', 'come'],
    de: ['der', 'die', 'das', 'und', 'mit', 'ist', 'nicht', 'ein', 'eine', 'fahrzeug', 'wir', 'sie', 'auf', 'für', 'von', 'zu', 'bei', 'wird', 'neu', 'oder'],
    fr: ['le', 'les', 'des', 'et', 'est', 'une', 'avec', 'pour', 'pas', 'vous', 'dans', 'sur', 'nous', 'véhicule', 'très', 'état', 'au', 'du', 'aux', 'sont'],
    en: ['the', 'and', 'with', 'is', 'for', 'this', 'are', 'you', 'car', 'very', 'condition', 'we', 'of', 'to', 'have', 'has', 'will', 'from', 'not', 'all'],
    es: ['el', 'los', 'las', 'y', 'con', 'para', 'es', 'una', 'del', 'vehículo', 'muy', 'estado', 'por', 'se', 'su', 'no', 'más', 'este', 'tiene', 'como'],
    nl: ['de', 'het', 'een', 'en', 'met', 'is', 'van', 'voor', 'niet', 'wij', 'auto', 'zeer', 'goede', 'staat', 'op', 'te', 'zijn', 'ook', 'bij', 'heeft']
  };
  var SETS = {};
  Object.keys(WORDS).forEach(function (l) { SETS[l] = {}; WORDS[l].forEach(function (w) { SETS[l][w] = 1; }); });
  var NAMES = { it: 'italiano', de: 'tedesco', fr: 'francese', en: 'inglese', es: 'spagnolo', nl: 'olandese' };

  function detect(text) {
    var words = String(text || '').toLowerCase().split(/[^a-zà-ÿßäöüéèêç]+/).filter(Boolean).slice(0, 400);
    if (words.length < 4) return 'it';
    var best = 'it', bestN = 0, it = 0;
    Object.keys(SETS).forEach(function (l) {
      var n = 0;
      words.forEach(function (w) { if (SETS[l][w]) n++; });
      if (l === 'it') it = n;
      if (n > bestN) { bestN = n; best = l; }
    });
    // nel dubbio è italiano: traduciamo solo se un'altra lingua vince chiaramente
    return best !== 'it' && bestN >= 3 && bestN > it * 1.5 ? best : 'it';
  }

  var api = { detect: detect, NAMES: NAMES };
  root.CA_LANG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

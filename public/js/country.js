(function (root) {
  'use strict';
  var aliases = { ITALIA: 'IT', ITALY: 'IT', GERMANIA: 'DE', GERMANY: 'DE', DEUTSCHLAND: 'DE', NEDERLAND: 'NL', NETHERLANDS: 'NL', OLANDA: 'NL', AUSTRIA: 'AT', FRANCE: 'FR', FRANCIA: 'FR', BELGIUM: 'BE', BELGIO: 'BE', BELGIE: 'BE', SWITZERLAND: 'CH', SCHWEIZ: 'CH', SVIZZERA: 'CH', SPAIN: 'ES', SPAGNA: 'ES', ESPANA: 'ES' };
  function normalize(value) {
    var text = String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (aliases[text]) return aliases[text];
    if (text === 'UK') return 'GB';
    if (['ZZ', 'EU', 'UN', 'QO', 'XA', 'XB'].indexOf(text) !== -1 || !/^[A-Z]{2}$/.test(text)) return '';
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(text) !== text ? text : ''; } catch (e) { return ''; }
  }
  function code(it) {
    it = it || {};
    var explicit = normalize(it.country || it.countryCode);
    if (explicit) return explicit;
    var suffix = String(it.city || '').match(/,\s*([A-Za-z]{2}|Italia|Deutschland|Nederland)\s*$/i);
    if (suffix && normalize(suffix[1])) return normalize(suffix[1]);
    // Solo portali nazionali: il dominio italiano di AutoScout ospita anche auto estere.
    var host = '';
    try { host = new URL(it.url).hostname.replace(/^www\.|^m\./, ''); } catch (e) { /* nessun link */ }
    if (host === 'kleinanzeigen.de') return 'DE';
    if (host === 'marktplaats.nl') return 'NL';
    if (['subito.it', 'automobile.it', 'autosupermarket.it', 'auto.trovit.it'].indexOf(host) !== -1) return 'IT';
    return '';
  }
  var api = { code: code };
  root.CA_COUNTRY = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

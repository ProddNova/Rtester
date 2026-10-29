/*
 * Rigenera public/js/icons.js con le icone Lucide (https://lucide.dev, licenza ISC).
 * Uso: node scripts/icons.js   (per aggiungerne una, mettila in NAMES)
 */
const fs = require('fs');
const path = require('path');

const VERSION = '0.460.0';
const NAMES = ['house', 'star', 'search', 'share-2', 'languages', 'phone', 'chevron-left', 'x', 'sliders-horizontal', 'refresh-cw',
  'flame', 'gem', 'camera', 'map-pin', 'clock', 'trash-2', 'pencil', 'eye-off', 'eye', 'external-link', 'message-circle',
  'trending-down', 'trending-up', 'calendar', 'fuel', 'gauge', 'zap', 'user', 'building-2', 'history', 'wallet', 'car', 'check',
  'triangle-alert', 'arrow-up-down', 'sparkles', 'sun', 'mountain', 'badge-percent', 'shuffle', 'list-filter', 'bookmark', 'info',
  'circle-alert', 'loader', 'ban', 'navigation', 'arrow-down-wide-narrow', 'crosshair', 'heart', 'flag', 'chevron-right', 'chevron-down', 'route'];

(async () => {
  const out = {};
  for (const n of NAMES) {
    const r = await fetch('https://cdn.jsdelivr.net/npm/lucide-static@' + VERSION + '/icons/' + n + '.svg');
    if (!r.ok) { console.log('manca', n); continue; }
    out[n] = (await r.text()).replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/\s*\n\s*/g, '').trim();
  }
  const js = '/* Icone Lucide (https://lucide.dev) v' + VERSION + ' - licenza ISC. Generato da scripts/icons.js */\n' +
    '(function (root) {\n  var ICONS = ' + JSON.stringify(out) + ';\n  root.CA_ICONS = ICONS;\n})(typeof window !== \'undefined\' ? window : globalThis);\n';
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'js', 'icons.js'), js);
  console.log(Object.keys(out).length + ' icone');
})();

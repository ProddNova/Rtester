/*
 * Aggiorna l'elenco completo di marche e modelli (public/js/models.js) leggendolo da AutoScout24.
 * Uso: node scripts/update-models.js   (una richiesta per marca, con pausa: ci mette qualche minuto)
 */
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function taxonomy(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'it-IT' }, signal: AbortSignal.timeout(20000) });
  const b = await r.text();
  const m = b.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('pagina senza dati (' + r.status + ')');
  const pp = JSON.parse(m[1]).props.pageProps;
  return { tax: pp.taxonomy, total: pp.numberOfResults || 0 };
}

(async () => {
  const { tax } = await taxonomy('https://www.autoscout24.it/lst?atype=C&cy=I');
  const makes = tax.makesSorted;
  const top = tax.topMakes.map((m) => m.label);
  console.log(makes.length + ' marche');
  const out = [];
  for (const mk of makes) {
    try {
      const { tax: t, total } = await taxonomy('https://www.autoscout24.it/lst?atype=C&cy=I&mmmv=' + mk.value + '|||');
      const groups = ((t.modelGroups || {})[mk.value] || []).map((g) => g.label);
      const models = ((t.models || {})[mk.value] || []).filter((m) => !groups.includes(m.label)).map((m) => [m.label, m.value]);
      out.push({ n: mk.label, id: mk.value, c: total, g: groups, m: models });
      process.stdout.write('.');
    } catch (e) {
      out.push({ n: mk.label, id: mk.value, c: 0, g: [], m: [] });
      process.stdout.write('x');
    }
    await sleep(350);
  }
  // marche senza annunci in Italia e senza modelli: inutili nel menu
  const list = out.filter((m) => m.c > 0 || m.m.length || m.g.length);
  const file = path.join(__dirname, '..', 'public', 'js', 'models.js');
  const js = '/* Generato da scripts/update-models.js (fonte: AutoScout24). Non modificare a mano. */\n' +
    '(function (root) {\n  var MODELS = ' + JSON.stringify({ top, makes: list }) + ';\n' +
    '  root.CA_MODELS = MODELS;\n  if (typeof module !== \'undefined\' && module.exports) module.exports = MODELS;\n' +
    '})(typeof window !== \'undefined\' ? window : globalThis);\n';
  fs.writeFileSync(file, js);
  console.log('\n' + list.length + ' marche, ' + list.reduce((n, m) => n + m.g.length + m.m.length, 0) + ' modelli -> ' + file);
})();

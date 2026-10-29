// Copia in dist/ solo i file che servono al sito (niente test, README, ecc.).
// Render pubblica la cartella dist/ (vedi render.yaml).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of FILES) {
  fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
}
console.log('Sito pronto in dist/ (' + FILES.join(', ') + ')');

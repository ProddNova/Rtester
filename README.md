# 🏁 CacciAuto

Sito statico (solo HTML/CSS/JS, niente server) per cercare auto usate su tutti i principali siti italiani
con **un solo set di filtri**. Pensato per il telefono e per le serate "cerchiamo macchine" con gli amici.

## Cosa fa

- **Ricerca a testo libero**: scrivi `saab 93 aero diesel sotto 6k` e capisce da solo marca, modello,
  alimentazione e budget. Il resto lo sistemi con i bottoni (anno, km, cambio, zona, carrozzeria, CV).
- **Il giro dei siti**: per ogni sito genera il link di ricerca *già filtrato*. Il bottone giallo in basso
  apre il prossimo sito non ancora visto; c'è la barra di avanzamento e i coriandoli a fine giro.
  Sotto ogni sito c'è scritto quali filtri non supporta (da impostare a mano lì).
- **Bacheca anti-doppioni**: incolli i link delle auto che vi piacciono.
  - Doppione **esatto** (stesso annuncio anche con link diverso, versione mobile, parametri di tracking): bloccato.
  - Doppione **probabile** (la stessa auto su due siti: prezzo ±5%, km ±2%, stesso anno, titolo simile):
    segnalato, con "Unisci" (un'auto, più link) o "Non è lei".
- **Voti 🔥/💀** per te e il tuo socio, e **"Manda al socio"**: la bacheca viaggia dentro un link
  (WhatsApp ecc.); chi lo apre la unisce alla sua senza doppioni.
- **🎲 Roulette**: 50 auto da appassionati con curiosità; "Cercala!" imposta i filtri.
- **Installabile** (PWA): "Aggiungi a schermata Home". Su Android, una volta installata, compare in
  "Condividi" delle altre app: condividi un annuncio da Subito & co. e finisce dritto in bacheca.

## Siti supportati

| Sito | Filtri applicati automaticamente |
|---|---|
| Subito | testo, prezzo, anno, alimentazione, cambio, CV, regione, ordinamento |
| AutoScout24 | marca, modello, prezzo, anno, km, alimentazione, cambio, carrozzeria, CV, zona (CAP + raggio), ordinamento, estero |
| AutoSuperMarket | marca, modello, prezzo, anno, km, alimentazione, cambio, regione |
| Automobile.it | marca, modello, regione |
| ilParking | marca, modello (è già un aggregatore) |
| Facebook Marketplace | testo, prezzo, anno, km, cambio, ordinamento |

I parametri di Subito, AutoScout24, AutoSuperMarket e Automobile.it sono stati verificati sui siti veri
(ottobre 2026), compresi tutti gli slug marca/modello della lista. Se un sito cambia i suoi URL,
basta aggiornare `js/sites.js` (eccezioni sugli slug in `SLUG_FIX` dentro `js/data.js`).

## Perché apre i siti invece di mostrare i risultati qui?

Un sito statico gira nel browser, e i browser non permettono a una pagina di leggere i dati di un altro
sito (regola di sicurezza chiamata **CORS**). Per mostrare tutti gli annunci in un'unica lista servirebbe
un server che li scarica (scraping): va contro i termini d'uso di quei siti e viene bloccato dai loro
sistemi anti-bot. Quindi CacciAuto fa da "telecomando": un set di filtri → tutti i siti già filtrati,
e la deduplica avviene nella bacheca, dove salvate le auto che contano.

## Usarlo

- **In locale**: apri `index.html` nel browser (funziona anche con doppio click), oppure
  `npm start` e vai su http://localhost:8080 (serve per installarla come app).
- **Online su Render (gratis)**: il repo contiene già `render.yaml`.
  1. Su [render.com](https://render.com) → **New** → **Blueprint**.
  2. Collega GitHub e scegli questo repo (e il branch che vuoi pubblicare).
  3. Conferma: Render crea il sito statico `cacciauto` e ti dà un indirizzo tipo `https://cacciauto.onrender.com`.

  Ogni push sul branch ripubblica il sito in automatico. Il build esegue prima i test
  (`npm test`) e poi `npm run build`, che copia in `dist/` solo i file del sito: se un test
  fallisce, resta online la versione precedente.

  In alternativa, senza Blueprint: **New** → **Static Site**, Build Command `npm test && npm run build`,
  Publish Directory `dist`.
- Va bene anche qualsiasi altro hosting statico (GitHub Pages, Netlify, Cloudflare Pages, ...):
  basta pubblicare la cartella `dist/` dopo `npm run build`, oppure direttamente la radice del repo.

## Struttura

```
index.html            pagina unica
css/style.css         stile (mobile first, tema scuro)
js/data.js            marche/modelli, regioni, preset, roulette, eccezioni slug
js/parse.js           testo libero -> marca/modello/filtri
js/sites.js           costruttori di URL per ogni sito
js/dedup.js           chiavi annuncio, caccia ai doppioni, link di condivisione
js/app.js             interfaccia
sw.js, manifest.webmanifest, icons/   app installabile e offline
tests/                test (node --test)
scripts/build.js      copia i file del sito in dist/ (per l'hosting)
render.yaml           configurazione per Render
```

## Test

```bash
npm test
```

Nessuna dipendenza da installare: usa il test runner integrato di Node.

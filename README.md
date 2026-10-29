# 🏁 CacciAuto

Un "AutoScout per appassionati": cerchi una volta e vedi in **un'unica lista** gli annunci di
**AutoScout24, Subito, AutoSuperMarket, Automobile.it e Trovit**, con foto, prezzo, km, anno, CV e città,
**senza doppioni**. Pensato per il telefono, va bene anche da PC.

## Cosa fa

- **Home da scorrere**: senza mettere filtri trovi un feed infinito, in due modalità:
  - **Appassionati e affari**: auto da appassionati (Evo, MX-5, Delta Integrale, Saab Aero…, con una curiosità
    su ognuna) e modelli diffusi con prezzo sotto il mercato secondo AutoScout24. Ordine casuale a ogni apertura
    (pulsante "Mescola"), mai due annunci di fila dello stesso modello;
  - **Più recenti**: gli ultimi annunci pubblicati su AutoScout24, Subito e Trovit.

  Due filtri solo per il feed: **budget massimo** e **km massimi**.
- **Ricerca rapida**: marca e modello si scrivono con la tastiera e la lista si filtra mentre scrivi
  ("mercedes" → Mercedes-Benz, "classe c" → Classe C); poi prezzo massimo e anno minimo; tutto il resto è in "Altri filtri"
  (versione/parole chiave, prezzo da, anno fino a, km, alimentazione, cambio, carrozzeria, privati/concessionari,
  potenza, regione, estero). Più scorciatoie al volo: "Sotto 5.000 €", "Youngtimer", "Cabrio", "200+ CV"…
- **Tutte le marche e i modelli**: 301 marche e oltre 5.000 modelli, presi da AutoScout24
  (`node scripts/update-models.js` per aggiornarli).
- **Lista unica** da 5 siti, con scorrimento infinito. Ordina per: misti, affari prima, prezzo ↑/↓, km, anno, più recenti.
- **Affare o caro?** Ogni annuncio ha un'etichetta (Affare, Buon prezzo, Nella media, Caro, Molto basso…).
  Per AutoScout24 è la loro valutazione di mercato; per gli altri è una stima calcolata sugli annunci della ricerca
  (prezzo in base ad anno e km).
- **NUOVO**: gli annunci che non avevi mai visto prima sono segnati; quelli già aperti sono più chiari.
- **Pagina annuncio dentro l'app**: galleria foto, scheda tecnica, descrizione completa, dotazioni, venditore
  (con telefono quando il sito lo mostra), da quanto è online, valutazione di mercato. Poi, se vuoi,
  "Apri su <sito>".
- **Condividi** un annuncio (WhatsApp ecc.): il link apre l'annuncio dentro CacciAuto, con foto e scheda.
- **Traduzione**: gli annunci in tedesco, francese, inglese, spagnolo o olandese hanno il pulsante
  "Traduci in italiano" (servizio gratuito MyMemory, senza account; se finisce il limite giornaliero
  si apre Google Traduttore).
- **Niente doppioni**: la stessa auto su più siti (o ripubblicata dallo stesso venditore) compare una volta sola,
  con le etichette dei siti (es. `AS24 +Subito +Trovit`) e i link agli altri annunci.
- **Salvati condivisi**: ☆ su un annuncio e lo vedono **tutti** quelli che usano l'app. Note, storico del prezzo
  ("▼ 500 €"), annunci spariti segnalati, pulsante "Controlla prezzi". Si possono incollare anche link di altri siti.
- **Ricerche salvate condivise** e ultime ricerche.
- **Nascondi** gli annunci che non ti interessano.
- **App installabile** (PWA); su Android puoi condividere un annuncio da un'altra app verso CacciAuto.

- **Icone** [Lucide](https://lucide.dev) (gratuite, licenza ISC), salvate nel progetto (`public/js/icons.js`,
  rigenerabili con `node scripts/icons.js`).
- **Niente zoom** con le dita sul telefono.

## Server sempre sveglio (tranne di notte)

Il piano gratuito di Render addormenta il server dopo 15 minuti senza visite.

- `server/keepalive.js`: ogni 10 minuti il server chiama il proprio indirizzo pubblico (Render lo fornisce da solo in
  `RENDER_EXTERNAL_URL`), così resta sveglio. **Dalle 3:00 alle 8:00 (ora italiana) si ferma** e il server si riposa.
  Per spegnere la funzione: variabile `KEEPALIVE=off`.
- `.github/workflows/sveglia.yml`: alle 8:00 GitHub chiama l'app per svegliarla (da addormentato il server non
  può svegliarsi da solo). Usa la variabile del repo `CACCIAUTO_URL`; se manca prova `https://cacciauto.onrender.com`.

Ore di accensione: circa 19 al giorno, quindi circa 590 al mese, dentro le 750 gratuite di Render.

## Siti

| Sito | Nella lista | Pagina annuncio nell'app |
|---|---|---|
| AutoScout24 | ✅ tutti i filtri | ✅ completa (anche valutazione di mercato e telefono) |
| Subito | ✅ (i km li filtra CacciAuto) | ✅ foto, descrizione, scheda |
| AutoSuperMarket | ✅ | ✅ foto, descrizione, scheda |
| Automobile.it | ✅ (serve la marca; prezzo/km/anno li filtra CacciAuto) | ✅ completa |
| Trovit (aggregatore) | ✅ (non filtra per zona) | ✅ descrizione e scheda |
| ilParking, Facebook Marketplace | link "Cerca anche su" già filtrato | — |

ilParking (e i siti gemelli theparking.eu) risponde a CacciAuto con la protezione anti-bot di Cloudflare,
cioè dice esplicitamente "niente programmi automatici"; Marketplace richiede il login. CacciAuto non prova
ad aggirare questi blocchi (né direttamente né passando da siti gemelli dello stesso gruppo): li apre come link
già filtrati.

## Come funziona

Un sito che gira solo nel browser **non può** leggere le pagine di altri siti: il browser lo blocca per sicurezza
(regola chiamata **CORS**). Per questo c'è un piccolo server Node (`server/`), senza dipendenze:

1. il telefono chiede `/api/search?s={filtri}` al nostro server;
2. il server scarica **una pagina di risultati per sito**, già filtrata tramite l'URL di ricerca del sito;
3. legge gli annunci (JSON dentro la pagina per AutoScout24, Subito e Automobile.it; HTML per AutoSuperMarket e Trovit);
4. applica i filtri che il sito non sa fare, unisce i doppioni, risponde con la lista unica.

Le pagine restano in cache 10 minuti, due richieste uguali nello stesso momento fanno un solo download e ci sono
limiti per IP: volume basso apposta. Se un sito risponde con un blocco il server si ferma e lo segnala
(pallino rosso sopra i risultati).

⚠️ Leggere i siti in automatico va contro i loro termini d'uso: è pensato per uso personale e a basso volume.
Se un sito cambia le sue pagine, il suo lettore (`server/sources/<sito>.js`) va aggiornato: i test aiutano a capire
cosa si è rotto.

## Pubblicarlo su Render (gratis)

1. Su [render.com](https://render.com) → **New** → **Blueprint** → scegli questo repo e il branch.
2. Render legge `render.yaml` e crea un **Web Service** Node gratuito.
3. Ti dà un indirizzo tipo `https://cacciauto.onrender.com`.

Ogni push sul branch ripubblica da solo. Il build esegue i test: se uno fallisce resta online la versione precedente.
Il piano gratuito "addormenta" il server dopo 15 minuti senza visite: la prima ricerca della serata può metterci
fino a un minuto (l'app lo dice).

Senza Blueprint: **New → Web Service**, Runtime Node, Build `npm install && npm run build`, Start `npm start`.

### Salvati condivisi: come restano salvati

Su Render gratis il disco del server si azzera quando si riavvia (anche quando "si addormenta").
Per non perdere niente senza database esterni:

- il server tiene i salvati e le ricerche salvate;
- **ogni telefono ne tiene una copia** sempre aggiornata;
- quando il server riparte da zero (ha un nuovo "bootId"), ogni telefono che apre l'app gli rimanda la sua copia
  e il server le unisce. Le cancellazioni sono ricordate, così una copia vecchia non fa ricomparire roba tolta.

Si perderebbe qualcosa solo se il server si riavvia **e** tutti i telefoni hanno cancellato i dati del sito.
Chiunque abbia il link dell'app può vedere e modificare i salvati condivisi.

Facoltativo: con le variabili `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (database Upstash gratuito)
i dati stanno anche in un database vero. Con `MYMEMORY_EMAIL` il limite giornaliero di traduzioni sale.

## In locale

```bash
npm start
```

Poi apri http://localhost:8080. Serve Node 18 o più recente. In locale i salvati finiscono in `data/` (permanenti).

## Struttura

```
public/                 il sito (HTML, CSS, JS, icone, service worker)
  js/data.js            regioni, alimentazioni, eccezioni sugli URL dei siti
  js/models.js          tutte le marche e i modelli (generato da scripts/update-models.js)
  js/lang.js            riconoscimento della lingua (per la traduzione)
  js/sites.js           URL di ricerca filtrati per ogni sito
  js/dedup.js           chiave annuncio e caccia ai doppioni (usato da sito e server)
  js/app.js             interfaccia
server/
  index.js              server HTTP: file statici + API
  search.js             ricerca su tutti i siti, filtri, doppioni, ordinamento
  feed.js               feed della home (affari e auto da appassionati)
  translate.js          traduzione in italiano
  keepalive.js          tieni sveglio (pausa 3-8)
  detail.js             pagina annuncio (solo siti ammessi)
  store.js              salvati e ricerche condivise (Upstash o file)
  fetch.js              download con cache e rilevamento blocchi
  sources/              un lettore per sito
tests/                  test (node --test), senza internet
scripts/update-models.js  aggiorna marche e modelli da AutoScout24
scripts/icons.js        rigenera le icone Lucide
.github/workflows/      sveglia del mattino
render.yaml             configurazione Render
```

## Test

```bash
npm test
```

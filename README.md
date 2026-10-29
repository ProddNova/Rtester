# 🏁 CacciAuto

Un "AutoScout per appassionati": cerchi una volta e vedi in **un'unica lista** gli annunci di
**AutoScout24, Subito, AutoSuperMarket, Automobile.it e Trovit**, con foto, prezzo, km, anno, CV e città,
**senza doppioni**. Pensato per il telefono, va bene anche da PC.

## Cosa fa

- **Ricerca a menu**, come sui siti di auto: marca, modello, versione/parole chiave (es. GTI, Aero), prezzo da/a,
  anno da/a, km da/a, alimentazione, cambio, carrozzeria, privati/concessionari, potenza, regione, estero.
- **Lista unica** da 5 siti, con scorrimento infinito. Ordina per: misti, affari prima, prezzo ↑/↓, km, anno, più recenti.
- **Affare o caro?** Ogni annuncio ha un'etichetta (Affare, Buon prezzo, Nella media, Caro, Molto basso…).
  Per AutoScout24 è la loro valutazione di mercato; per gli altri è una stima calcolata sugli annunci della ricerca
  (prezzo in base ad anno e km).
- **NUOVO**: gli annunci che non avevi mai visto prima sono segnati; quelli già aperti sono più chiari.
- **Pagina annuncio dentro l'app**: galleria foto, scheda tecnica, descrizione completa, dotazioni, venditore
  (con telefono quando il sito lo mostra), da quanto è online, valutazione di mercato. Poi, se vuoi,
  "Apri su <sito>".
- **Niente doppioni**: la stessa auto su più siti (o ripubblicata dallo stesso venditore) compare una volta sola,
  con le etichette dei siti (es. `AS24 +Subito +Trovit`) e i link agli altri annunci.
- **Salvati condivisi**: ☆ su un annuncio e lo vedono **tutti** quelli che usano l'app. Note, storico del prezzo
  ("▼ 500 €"), annunci spariti segnalati, pulsante "Controlla prezzi". Si possono incollare anche link di altri siti.
- **Ricerche salvate condivise** e ultime ricerche.
- **Nascondi** gli annunci che non ti interessano.
- **App installabile** (PWA); su Android puoi condividere un annuncio da un'altra app verso CacciAuto.

## Siti

| Sito | Nella lista | Pagina annuncio nell'app |
|---|---|---|
| AutoScout24 | ✅ tutti i filtri | ✅ completa (anche valutazione di mercato e telefono) |
| Subito | ✅ (i km li filtra CacciAuto) | ✅ foto, descrizione, scheda |
| AutoSuperMarket | ✅ | ✅ foto, descrizione, scheda |
| Automobile.it | ✅ (serve la marca; prezzo/km/anno li filtra CacciAuto) | ✅ completa |
| Trovit (aggregatore) | ✅ (non filtra per zona) | ✅ descrizione e scheda |
| ilParking, Facebook Marketplace | link "Cerca anche su" già filtrato | — |

ilParking risponde con la protezione anti-bot di Cloudflare e Marketplace richiede il login:
CacciAuto non prova ad aggirarli, li apre come link.

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
2. Render legge `render.yaml` e crea un **Web Service** Node gratuito. Ti chiede due valori
   (`UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`): vedi sotto. Puoi lasciarli vuoti e aggiungerli dopo.
3. Ti dà un indirizzo tipo `https://cacciauto.onrender.com`.

Ogni push sul branch ripubblica da solo. Il build esegue i test: se uno fallisce resta online la versione precedente.
Il piano gratuito "addormenta" il server dopo 15 minuti senza visite: la prima ricerca della serata può metterci
fino a un minuto (l'app lo dice).

Senza Blueprint: **New → Web Service**, Runtime Node, Build `npm install && npm run build`, Start `npm start`.

### Salvati permanenti (database gratuito, 3 minuti)

Su Render gratis il disco si azzera a ogni riavvio, quindi i salvati condivisi servono in un database esterno.
CacciAuto usa **Upstash Redis** (gratis, senza carta):

1. Vai su [upstash.com](https://upstash.com) → registrati → **Create Database** (Redis, regione Europa, piano Free).
2. Nella pagina del database, sezione **REST API**, copia `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
3. Su Render → il servizio `cacciauto` → **Environment** → incolla i due valori → salva (riparte da solo).

Finché non lo fai l'app funziona lo stesso, ma nella pagina Salvati compare un avviso: i salvati si cancellano
quando il server si riavvia. Chiunque abbia il link dell'app può vedere e modificare i salvati condivisi.

## In locale

```bash
npm start
```

Poi apri http://localhost:8080. Serve Node 18 o più recente. In locale i salvati finiscono in `data/` (permanenti).

## Struttura

```
public/                 il sito (HTML, CSS, JS, icone, service worker)
  js/data.js            marche/modelli, regioni, alimentazioni, eccezioni sugli URL dei siti
  js/sites.js           URL di ricerca filtrati per ogni sito
  js/dedup.js           chiave annuncio e caccia ai doppioni (usato da sito e server)
  js/app.js             interfaccia
server/
  index.js              server HTTP: file statici + API
  search.js             ricerca su tutti i siti, filtri, doppioni, ordinamento
  detail.js             pagina annuncio (solo siti ammessi)
  store.js              salvati e ricerche condivise (Upstash o file)
  fetch.js              download con cache e rilevamento blocchi
  sources/              un lettore per sito
tests/                  test (node --test), senza internet
render.yaml             configurazione Render
```

## Test

```bash
npm test
```

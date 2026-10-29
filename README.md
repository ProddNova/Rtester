# AutoHunter

Un "AutoScout per appassionati": cerchi una volta e vedi in **un'unica lista** gli annunci di
**AutoScout24, Subito, AutoSuperMarket, Automobile.it e Trovit** in Italia, più **Kleinanzeigen** (Germania),
**Marktplaats** (Olanda) e AutoScout24 Europa per l'estero. Foto, prezzo, km, anno, CV e città,
**senza doppioni**. Pensato per il telefono, va bene anche da PC.

## Cosa fa

- **Home da scorrere**: senza mettere filtri trovi un feed infinito, in due modalità:
  - **Da caccia**: auto da appassionati (Evo, MX-5, Delta Integrale, Saab Aero…, con una curiosità
    su ognuna) e modelli diffusi con prezzo sotto il mercato secondo AutoScout24. Ordine casuale a ogni apertura
    (pulsante "Mescola"), mai due annunci di fila dello stesso modello;
  - **Appena usciti**: gli ultimi annunci pubblicati su AutoScout24, Subito e Trovit (e Kleinanzeigen, Marktplaats).

  Filtri solo per il feed: **budget massimo**, **km massimi** e **dove** (Italia + estero oppure solo Italia).
  Nel feed vanno solo annunci con foto.
- **Ricerca rapida**: marca e modello si scrivono con la tastiera e la lista si filtra mentre scrivi
  ("mercedes" → Mercedes-Benz, "classe c" → Classe C); poi prezzo massimo e anno minimo; tutto il resto è in "Altri filtri"
  (versione/parole chiave, prezzo da, anno fino a, km, alimentazione, cambio, carrozzeria, privati/concessionari,
  potenza, regione, **dove cercare**: Italia + estero, solo Italia, solo estero). Più scorciatoie al volo: "Sotto 5.000 €", "Youngtimer", "Cabrio", "200+ CV"…
- **Tutte le marche e i modelli**: 301 marche e oltre 5.000 modelli, presi da AutoScout24
  (`node scripts/update-models.js` per aggiornarli).
- **Lista unica** da 7 siti, con scorrimento infinito. Gli annunci compaiono appena risponde il primo sito
  (ogni sito viene chiesto a parte, in parallelo): non si aspetta il più lento. Con "Solo Italia" i siti esteri
  non vengono nemmeno interrogati.
- **Ordinamento doppio**: "Ordina" e "Poi" (a parità del primo). Es. **più vicini, poi prezzo più basso**: le auto sono
  raggruppate per fasce di distanza da Genova (entro 15, 30, 50, 80, 120 km…) e dentro ogni fascia vanno dalla più economica.
  Ordini: misti, più vicini, affari prima, prezzo ↑/↓, km, anno, più recenti. Gli annunci senza foto finiscono in fondo.
- **Distanza da Genova** su ogni annuncio (dalla città scritta nell'annuncio; all'estero è indicativa, "~690 km") e
  filtro **"Distanza da Genova"** (entro 25…300 km). Scorciatoia "Vicino a Genova" (100 km, più vicini poi prezzo).
- **Ricerca precisa**: alcuni siti, quando hanno pochi annunci di un modello, ci aggiungono auto "simili"
  (Opel Vectra → Crossland, Mokka, Panda…). AutoHunter tiene solo gli annunci in cui il modello c'è davvero
  (capisce anche "320d" per Serie 3, "C 220" o "C-Klasse" per Classe C, "MX5" per MX-5).
- **Ban list** (condivisa): modelli precisi da non vedere mai, né nelle ricerche né nella home (si parte con Abarth 500).
  Si gestisce in fondo alla pagina Salvati, oppure dalla scheda di un annuncio con "Non mostrarmi più <modello>".
- **Niente auto elettriche**, mai (scelta fissa dell'app; le ibride restano).
- **Affare?** Per AutoScout24 c'è la loro valutazione di mercato (da "Affare" a "Molto caro"); per gli altri siti
  una stima sugli annunci della ricerca (prezzo in base ad anno e km), mostrata solo quando segnala un buon prezzo
  (la stima mescola versioni diverse, quindi "caro" non sarebbe affidabile).
- **NUOVO**: gli annunci che non avevi mai visto prima sono segnati; quelli già aperti sono più chiari.
- **Pagina annuncio dentro l'app**: galleria foto, scheda tecnica, descrizione completa, dotazioni, venditore
  (con telefono quando il sito lo mostra), da quanto è online, valutazione di mercato. Poi, se vuoi,
  "Apri su <sito>".
- **Condividi** un annuncio (WhatsApp ecc.): il link apre l'annuncio dentro AutoHunter, con foto e scheda.
- **Estero**: normalmente si cerca in Italia **e** all'estero (Germania, Olanda, Austria, Francia, Belgio, Spagna,
  Lussemburgo tramite AutoScout24 Europa, Kleinanzeigen e Marktplaats). La città mostra il paese (es. "Neuss, DE").
  Se scegli una regione italiana si cerca solo in Italia.
- **Traduzione automatica**: gli annunci in tedesco, francese, inglese, spagnolo o olandese si aprono già tradotti
  (descrizione e dotazioni), con "Mostra originale". Usa MyMemory (gratis, senza account) **direttamente dal telefono**:
  così il limite giornaliero è di ogni telefono e non del server (su Render l'indirizzo del server è condiviso con
  altri e il limite finiva subito: per questo prima "non andava"). Se il telefono non ci riesce prova il server.
  Le traduzioni restano salvate sul telefono. Facoltativo: `MYMEMORY_EMAIL` su Render alza il limite del server.
- **Niente doppioni**: la stessa auto su più siti (o ripubblicata dallo stesso venditore) compare una volta sola,
  con le etichette dei siti (es. `AS24 +Subito +Trovit`) e i link agli altri annunci.
- **Salvati condivisi** (senza avvisi a schermo): ☆ su un annuncio e lo vedono **tutti** quelli che usano l'app. Note, storico del prezzo
  ("▼ 500 €"), annunci spariti segnalati, pulsante "Controlla prezzi". Si possono incollare anche link di altri siti.
- **Ricerche salvate condivise** e ultime ricerche.
- **Nascondi** gli annunci che non ti interessano.
- **App installabile** (PWA); su Android puoi condividere un annuncio da un'altra app verso AutoHunter.

- **Stile**: nero asfalto e arancione "da caccia", angoli vivi, niente sfumature; titoli e prezzi in Archivo condensato,
  dati tecnici in JetBrains Mono (Google Fonts).
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
| Subito | ✅ (i km li filtra AutoHunter) | ✅ foto, descrizione, scheda |
| AutoSuperMarket | ✅ | ✅ foto, descrizione, scheda |
| Automobile.it | ✅ (serve la marca; prezzo/km/anno li filtra AutoHunter) | ✅ completa |
| Trovit (aggregatore) | ✅ (non filtra per zona) | ✅ descrizione e scheda |
| Kleinanzeigen 🇩🇪 | ✅ marca, prezzo, anno, km, alimentazione, cambio, carrozzeria, CV (il modello si cerca a parole) | ✅ foto, scheda, descrizione, dotazioni, venditore |
| Marktplaats 🇳🇱 | ✅ (marca e modello nell'URL, il resto lo filtra AutoHunter) | ✅ foto, scheda completa, descrizione |
| Svizzera | ❌ tutti.ch, anibis, AutoScout24.ch, ricardo e Comparis bloccano i programmi; carforyou non risponde | — |
| ilParking, Facebook Marketplace | link "Cerca anche su" già filtrato | — |

ilParking (e i siti gemelli theparking.eu) risponde a AutoHunter con la protezione anti-bot di Cloudflare,
cioè dice esplicitamente "niente programmi automatici"; Marketplace richiede il login. AutoHunter non prova
ad aggirare questi blocchi (né direttamente né passando da siti gemelli dello stesso gruppo, come leparking.fr):
li apre come link già filtrati. Per avere comunque tante auto, anche dall'estero, ci sono Kleinanzeigen e Marktplaats.
Siti provati e scartati perché bloccano i programmi: mobile.de, LaCentrale, Leboncoin, willhaben, AutoScout24.ch, AutoUncle.

Kleinanzeigen e Marktplaats: si leggono solo le pagine che i loro `robots.txt` permettono (niente ordinamento
via URL su Kleinanzeigen, niente API interne di Marktplaats).

## Come funziona

Un sito che gira solo nel browser **non può** leggere le pagine di altri siti: il browser lo blocca per sicurezza
(regola chiamata **CORS**). Per questo c'è un piccolo server Node (`server/`), senza dipendenze:

1. il telefono chiede `/api/search?s={filtri}` al nostro server;
2. il server scarica **una pagina di risultati per sito**, già filtrata tramite l'URL di ricerca del sito;
3. legge gli annunci (JSON dentro la pagina per AutoScout24, Subito, Automobile.it e Marktplaats; HTML per AutoSuperMarket,
   Trovit e Kleinanzeigen);
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
   (il servizio su Render si chiama ancora `cacciauto`, il vecchio nome: cambiarlo creerebbe un servizio nuovo con un
   indirizzo nuovo. Anche i dati salvati usano ancora quel nome internamente, così non si perde niente.)

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
  js/match.js           marca/modello dal titolo: ricerca precisa, ban list, elettriche (sito e server)
  js/app.js             interfaccia
server/
  index.js              server HTTP: file statici + API
  search.js             ricerca su tutti i siti, filtri, doppioni, ordinamento
  feed.js               feed della home (affari e auto da appassionati)
  translate.js          traduzione in italiano (riserva: di solito traduce il telefono)
  geo.js, geo/          distanza da Genova (comuni ISTAT, da scripts/build-geo.js)
  keepalive.js          tieni sveglio (pausa 3-8)
  detail.js             pagina annuncio (solo siti ammessi)
  store.js              salvati e ricerche condivise (Upstash o file)
  fetch.js              download con cache e rilevamento blocchi
  sources/              un lettore per sito
tests/                  test (node --test), senza internet
scripts/update-models.js  aggiorna marche e modelli da AutoScout24
scripts/icons.js        rigenera le icone Lucide
scripts/build-geo.js    rigenera l'elenco dei comuni con coordinate (pacchetto npm italian-cap-comuni-province, licenza MIT)
.github/workflows/      sveglia del mattino
render.yaml             configurazione Render
```

## Test

```bash
npm test
```

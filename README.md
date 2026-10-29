# 🏁 CacciAuto

Cerca auto usate su più siti contemporaneamente e vedi **tutti gli annunci in un'unica lista**,
con foto, prezzo, km, anno e città, e **senza doppioni**. Pensato per il telefono.

## Cosa fa

- **Ricerca a testo libero**: `saab 93 diesel sotto 6k` → marca, modello, alimentazione e budget li capisce da solo.
  Il resto (anni, km, cambio, CV, zona, carrozzeria) sta in **Filtri**.
- **Annunci da 3 siti in una lista**: AutoScout24, AutoSuperMarket, Automobile.it.
  Ordina per prezzo, km o più recenti; "Carica altri" per la pagina dopo.
- **Niente doppioni**: se la stessa auto è su più siti (stesso prezzo ±5%, km ±2%, stesso anno, titolo simile)
  la vedi una volta sola, con le etichette dei siti (es. `AS24 +ASM`).
- **Altri siti come link**: Subito, Facebook Marketplace e ilParking bloccano le letture automatiche,
  quindi compaiono come link "Anche su" già filtrati.
- **Bacheca**: ☆ su un annuncio per salvarlo; puoi anche incollare link da qualsiasi sito.
  Voti 🔥/💀 per te e il tuo socio, e "Manda al socio": la bacheca viaggia in un link e si unisce
  alla sua senza doppioni.
- **🎲 Roulette** di 50 auto da appassionati, con curiosità.
- **App installabile** (PWA): "Aggiungi a schermata Home"; su Android compare in "Condividi".

## Come funziona (e perché serve un server)

Un sito che gira solo nel browser **non può** leggere le pagine di altri siti: il browser lo blocca per sicurezza
(regola chiamata **CORS**). Per questo c'è un piccolo server Node (`server/`):

1. il telefono chiede `/api/search?s={filtri}` al nostro server;
2. il server scarica **una pagina di risultati per sito**, già filtrata tramite l'URL di ricerca del sito;
3. legge gli annunci (AutoScout24 e Automobile.it li hanno in un JSON dentro la pagina, AutoSuperMarket nelle "card" HTML);
4. applica i filtri che il sito non sa fare (es. Automobile.it filtra solo marca/modello/regione), unisce i doppioni, ordina;
5. risponde con la lista unica.

Le pagine scaricate restano in cache 10 minuti e c'è un limite di 40 ricerche ogni 5 minuti per IP: volume basso apposta.
Se un sito risponde con un blocco, il server si ferma e lo segnala (pallino rosso sopra i risultati): **nessun tentativo di aggirarlo**.

⚠️ Leggere i siti in automatico va contro i loro termini d'uso: è pensato per uso personale, a basso volume.
Se un sito cambia la struttura delle pagine, il suo lettore (`server/sources/<sito>.js`) va aggiornato:
i test in `tests/server.test.js` aiutano a capire cosa si è rotto.

## Pubblicarlo su Render (gratis)

Il repo contiene `render.yaml`.

1. Su [render.com](https://render.com) → **New** → **Blueprint**.
2. Collega GitHub, scegli questo repo e il branch.
3. Conferma: Render crea il web service `cacciauto` e ti dà un indirizzo tipo `https://cacciauto.onrender.com`.

Ogni push sul branch ripubblica da solo. Il build esegue i test (`npm test`): se uno fallisce resta online la versione precedente.

Il piano gratuito "addormenta" il server dopo 15 minuti senza visite: la prima ricerca della serata può metterci
fino a un minuto (l'app lo dice), poi va veloce.

In alternativa senza Blueprint: **New → Web Service**, Build Command `npm test`, Start Command `npm start`.

## In locale

```bash
npm start
```

Poi apri http://localhost:8080. Serve Node 18 o più recente, nessuna dipendenza da installare.

## Struttura

```
public/               il sito (HTML, CSS, JS, icone, service worker)
  js/data.js          marche/modelli, regioni, preset, roulette, eccezioni sugli URL dei siti
  js/parse.js         testo libero -> marca/modello/filtri
  js/sites.js         URL di ricerca filtrati per ogni sito (usato da sito e server)
  js/dedup.js         chiavi annuncio, caccia ai doppioni, link di condivisione bacheca
  js/app.js           interfaccia
server/
  index.js            server HTTP: file statici + /api/search
  search.js           ricerca su tutti i siti, filtri, unione doppioni, ordinamento
  fetch.js            download pagine con cache e rilevamento blocchi
  sources/            un lettore per sito (autoscout, autosupermarket, automobile)
tests/                test (node --test)
render.yaml           configurazione Render
```

## Test

```bash
npm test
```

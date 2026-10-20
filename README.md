# BookForge Web

Trasforma un ebook in un libro da stampare — **direttamente nel browser, senza installare nulla**.
Importi il libro, controlli l'impaginazione in anteprima (pagine affiancate, come in un libro vero) e poi stampi:
pagine singole, oppure **fogli già disposti per piegare e cucire a mano** (fascicoli), più un modello di **copertina con dorso**.

È una riscrittura in HTML/CSS/JavaScript ispirata a [BookForge](https://github.com/chunksbabyruth/BookForge) di ChunksBabyRuth (licenza MIT).
I libri non lasciano mai il tuo computer: l'elaborazione avviene tutta nel browser e l'app non invia nulla a nessuno.

## Come si avvia

- **Online**: apri l'indirizzo del sito (GitHub Pages) e lavora direttamente nel browser.
- **Offline**: scarica l'intera cartella del progetto e fai doppio clic su `index.html`. Funziona anche senza internet e senza installare nulla.

È un sito completamente statico: non serve nessun server e nessun programma da avviare.

### Pubblicarlo su GitHub Pages

1. Crea un repository pubblico e carica il *contenuto* della cartella (non lo zip): `index.html` deve stare alla radice.
2. Il caricamento dal browser accetta circa 100 file alla volta: carica prima `fonts/`, poi il resto (oppure usa GitHub Desktop).
3. In **Settings → Pages** scegli *Deploy from a branch*, branch `main`, cartella `/ (root)`.
4. Dopo un paio di minuti il sito è online. Tutti i percorsi sono relativi, quindi funziona anche sotto `utente.github.io/nome-repo/`.

## Come si usa

1. **Importa** — trascina un file **EPUB** (senza DRM), **DOCX**, **Markdown**, **TXT** oppure un progetto `.bookforge`. Puoi provare anche il libro di esempio.
2. **Capitoli e testo** — spunta/togli capitoli (es. copertina, indice dell'ebook), rinomina, scegli il **tipo**: *Capitolo* o *Pagina iniziale* (dedica, presentazione: niente testata, testo centrato, mai nell'indice; la scelta è automatica all'import e si cambia a mano). L'**Indice** è una voce spostabile dell'elenco (frecce): lo metti dove vuoi; ogni capitolo ha la spunta «Voce nell'indice». Puoi anche spostare, unire, dividere i capitoli e correggere il testo. *Pulizia testo* sistema spazi, virgolette «caporali» o “inglesi”, apostrofi, trattini e puntini; *Cerca/sostituisci* lavora su tutto il libro. Ogni pulizia si può annullare.
3. **Aspetto** — formato (A5, tascabile, 6×9…), margini speculari, carattere (14 font inclusi), interlinea, capolettera, ornamenti, intestazioni, numeri di pagina, frontespizio, copyright, titolo dell'indice e **da dove parte la numerazione** (predefinito: dal primo capitolo dopo l'indice, indice senza numero; oppure l'indice è pagina 1; le pagine prima dell'indice non sono mai numerate). Accanto vedi il risultato di **un capitolo a tua scelta** (menu e « Cap. / Cap. »); i numeri di pagina sono indicativi.
4. **Anteprima** — tutto il libro a pagine affiancate, zoom, salto ai capitoli. È **lo stesso identico disegno** che finisce nella stampa.
5. **Rilegatura** — scegli carta (A4, A3, Letter, Tabloid), un solo fascicolo o più fascicoli da N fogli, segni di piega e di cucitura, segni di taglio. Ogni foglio si vede fronte e retro.
6. **Copertina** — due modi:
   - **Cartonata (la tua immagine)**: carichi un'unica immagine con quarta + dorso + prima e inserisci tu tutte le misure (larghezza/altezza dei cartoni, dorso automatico o manuale, spazio tra i cartoni, risvolto, distanza del taglio d'angolo a 45°, margini dell'immagine). L'app stampa il foglio con i **segni di taglio** (continui) e di **piega/posizione dei cartoni** (tratteggiati) fuori dal foglio e i **tagli d'angolo a 45°** per girare la carta all'interno. Con **Stampa guida dei cartoni** ottieni i tre rettangoli (quarta, dorso, prima) in posizione reale con le quote, da usare come sagoma; c'è l'opzione «specchiata» per stamparla sul retro. L'app avvisa se l'immagine è sotto i 200 dpi.
   - **Semplice**: quarta, dorso (spessore da pagine e carta) e prima disegnati dall'app, con colori, immagine e testo sul dorso.

### Stampare o ottenere il PDF

I pulsanti **Stampa…** aprono la finestra di stampa del browser. Per avere il file scegli **Salva come PDF**.
Imposta **scala 100% / dimensione reale** e **nessun margine**. Per i fogli di rilegatura stampa **fronte/retro girando sul lato corto**
(se la stampante gira l'altro lato, usa «Ruota di 180° i retri»). **Fai sempre prima una prova con un solo foglio.**

- **Consigliati: Chrome, Brave, Edge** — rispettano esattamente la misura della pagina impostata dall'app.
- **Safari**: puoi usarlo per lavorare, ma può ignorare la misura della pagina; nella finestra di stampa scegli a mano un formato carta uguale a quello indicato dall'app e scala 100%. *Non è stato possibile collaudare Safari durante lo sviluppo: se noti differenze, stampa da Brave/Chrome.*

## Cosa è incluso e cosa no

Collaudato (con Chrome): importazione dei 4 formati, impaginazione, anteprima, PDF di pagine, fogli e copertina (numero di pagine coincidente con l'anteprima), fascicoli multipli, salvataggio/apertura progetto, esportazione EPUB riletta correttamente.

Differenze rispetto al programma originale:
- Niente caricamento di font tuoi dal disco (ci sono 14 famiglie incluse + Georgia/Times di sistema).
- La sillabazione è quella del browser (richiede la lingua giusta nei *Dati del libro*; Italiano, Inglese, Francese, Tedesco, Spagnolo… sono supportati dai browser moderni).
- Si possono esportare TXT, HTML ed EPUB, non DOCX.
- Il DOCX viene letto in modo semplificato (titoli, corsivo/grassetto, elenchi, tabelle, immagini; non note a piè di pagina né campi).
- I PDF non si importano; il vecchio `.doc` e i formati Kindle vanno prima convertiti (DOCX / EPUB).
- Libri con capitoli molto lunghi (centinaia di pagine in un solo capitolo) possono richiedere più tempo nell'anteprima e nella stampa.

## Sicurezza e privacy

- Nessuna richiesta di rete verso altri siti, nessuna libreria esterna, nessun tracciamento: tutto il codice è nella cartella `js/`.
- Il contenuto importato è considerato non fidato: script, stili, eventi, link, iframe e immagini remote vengono scartati; restano solo testo, formattazione di base e immagini incorporate. Una *Content-Security-Policy* nel file `index.html` impedisce comunque l'esecuzione di script esterni.
- Il lavoro è salvato nel browser di chi usa il sito solo come copia di sicurezza (ognuno vede soltanto il proprio); le copertine molto pesanti non entrano in questa copia; **salva il progetto (.bookforge)** per non perderlo.

## Struttura della cartella

```
index.html          pagina dell'app
icon.svg            icona
css/                aspetto dell'app (app.css), del libro (book.css), font (fonts.css)
js/                 util, zip (lettura/scrittura senza librerie), sanitize (pulizia HTML), importers,
                    settings, layout (motore di impaginazione), impose (fascicoli), cover,
                    textops, export, viewer, sample, app
fonts/              font con licenza OFL (con i rispettivi OFL.txt)
LICENSE             licenza di BookForge Web (MIT)
LICENSE-originale-BookForge.txt   licenza MIT del progetto che ha ispirato questa riscrittura
```

## Come funziona l'impaginazione (per curiosi)

Ogni capitolo viene composto in un contenitore a colonne CSS alto quanto l'area di testo: ogni colonna è una pagina.
Il numero di colonne dà il numero di pagine; per disegnare la pagina *n* si mostra la colonna *n*. Anteprima e stampa usano lo stesso flusso.
Per la rilegatura le stesse pagine vengono semplicemente disposte a due a due sui fogli nell'ordine dei fascicoli piegati.

## Licenza

MIT — vedi `LICENSE`. Font: SIL Open Font License 1.1.

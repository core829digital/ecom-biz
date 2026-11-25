# Piano lavori e memoria di progetto

Elenco unico di tutto ciò che va fatto, in ordine di priorità. Si aggiorna a ogni consegna.
Obiettivi e pubblico: [`PRD.md`](PRD.md). Dettagli tecnici e costi: [`ROADMAP.md`](ROADMAP.md).

Legenda: ✅ fatto · 🔄 in corso · ⏳ da fare · 🔒 bloccato da un fattore esterno

## Fase A — Usabile da subito (priorità massima)

| # | Attività | Stato |
|---|---|---|
| A1 | Account admin con tutte le funzioni sbloccate, senza abbonamento | ✅ |
| A2 | Account clienti: registrazione con password, verifica email per lo storico ordini | ✅ |
| A3 | Link dei negozi funzionanti senza dominio (`/sites/nome`) | ✅ |
| A4 | Prova senza email (`ALLOW_MISSING_SMTP`) e verifica manuale dei merchant | ✅ |
| A5 | **Caricamento file senza configurazioni esterne** (archivio nel database quando manca R2) | ✅ |
| A6 | **Libreria file per negozio** (loghi, immagini, documenti): carica, sostituisci, elimina, spazio per piano | ✅ |
| A7 | **Onboarding completo**: profilo account, dati fiscali e P.IVA, IVA, pagamenti (contrassegno/bonifico/Stripe), spedizioni, primo prodotto | ✅ configurazione guidata in 7 passi |

## Fase B — Marketing e IA

| # | Attività | Stato |
|---|---|---|
| B0 | Motore email: campagne, programmazione, automazioni (benvenuto, primo acquisto) | ✅ |
| B1 | **Assistente IA**: backend compatibile con più fornitori (chiave API e basta), chat nel pannello, quote per negozio | ✅ (manca solo `AI_API_KEY`) |
| B2 | IA "negozio in 5 minuti": prodotti, palette, homepage, pagine legali, spedizioni in bozza | ✅ (spedizioni e foto prodotto: prossima iterazione) |
| B3 | IA con strumenti su tutta l'app: catalogo, sconti, blog, SEO, sezioni, campagne (conferma per azioni verso i clienti) | ✅ 13 strumenti; tutto in bozza |
| B4 | Memoria del business per negozio (profilo, tono, risultati) | ✅ profilo e fatti; risultati delle campagne: prossima iterazione |
| B5 | Pagina **Contenuti / Generazione**: testi, post social, immagini e video tramite fornitori esterni | ⏳ |
| B6 | Pagina **Collegamenti IA** (es. Claude, Gemini): scelta del fornitore e chiave | ⏳ |
| B7 | Feed prodotti per Google Merchant, Meta e TikTok (cataloghi senza approvazioni) | ⏳ |
| B8 | Social: Instagram, Facebook, Threads, TikTok, LinkedIn, WhatsApp Business (pubblicazione e messaggi) | 🔒 approvazione app presso ogni piattaforma |
| B9 | Annunci: Meta Ads, Google Ads (creazione campagne e report) | 🔒 verifica aziendale + token sviluppatore |
| B10 | SEO avanzata e strumenti esterni (es. OpenSEO), video con Higgsfield | 🔒 verificare API pubbliche e condizioni |

## Fase C — Esperienza d'uso e design

| # | Attività | Stato |
|---|---|---|
| C1 | Editor del sito a sezioni, blocchi, anteprima dal vivo, bozza/pubblica | ✅ |
| C2 | Palette, font, forme, animazioni per piano, CSS personalizzato | ✅ |
| C3 | Modifica direttamente nell'anteprima (clic su testi e blocchi), oltre alla sidebar | ✅ |
| C4 | Transizioni di pagina fluide; cambio chiaro/scuro con onda circolare dall'angolo | ✅ |
| C5 | Landing multi-pagina: chi siamo, cosa facciamo, offerta, **demo interattiva della dashboard**, parallax | ⏳ |
| C6 | Revisione UX di tutti i form, centro notifiche e percorsi (stati vuoti, errori, caricamenti) | ⏳ |

## Fase D — Business e operatività

| # | Attività | Stato |
|---|---|---|
| D1 | **Finanze per negozio**: ricavi, costi prodotto, spese (pubblicità, abbonamenti), margine, AOV, CAC, ROAS, LTV, report | ⏳ |
| D2 | Fattura elettronica (SdI Italia, e-Factura Romania) tramite fornitore | ⏳ |
| D3 | Corrieri locali (etichette e tracking) | ⏳ |

## Fase E — Sicurezza e prestazioni

| # | Attività | Stato |
|---|---|---|
| E1 | Audit indici del database sulle query reali (EXPLAIN) e aggiunta di quelli mancanti | ⏳ |
| E2 | Ripasso OWASP Top 10, validazione/sanificazione di ogni input, controllo dipendenze | ⏳ |
| E3 | Penetration test esterno, test di carico | 🔒 fornitore esterno |

## Fase F — Lancio commerciale

| # | Attività | Stato |
|---|---|---|
| F1 | Dominio, email Brevo con dominio verificato, togliere `ALLOW_MISSING_SMTP` | 🔒 dominio |
| F2 | Storage Cloudflare R2 per i file in produzione | ⏳ |
| F3 | Stripe in modalità test, poi live | 🔒 chiavi Stripe |
| F4 | Revisione legale dei documenti, audit accessibilità | 🔒 consulenti |

## Registro decisioni (memoria interna)

| Data | Decisione |
|---|---|
| 2026-11-24 | Deploy su Vercel (Pro) con Prisma Postgres; per ora indirizzo `ecom-biz-tau.vercel.app`, negozi su `/sites/nome` |
| 2026-11-24 | Email spente in produzione finché non c'è il dominio (`ALLOW_MISSING_SMTP=true`); fornitore scelto: **Brevo** |
| 2026-11-24 | IA: si accettano i livelli gratuiti dei fornitori (con i loro limiti sui dati); niente dati personali dei clienti finali inviati all'IA |
| 2026-11-24 | IA gratuita per i merchant in beta, con quota giornaliera per negozio |
| 2026-11-24 | Piani: Basic = animazioni delicate; Grow = animazioni premium; Advanced = + CSS personalizzato. Gli admin della piattaforma hanno tutto |
| 2026-11-24 | Nessun nuovo branding: si mantengono i colori attuali (bianco/nero) |

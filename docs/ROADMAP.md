# Suggerimenti e roadmap

*Raccomandazioni oneste per portare la piattaforma sul mercato e farla crescere. Impatto e sforzo sono
stime mie. Lo sforzo è espresso in giornate di sviluppo di una persona esperta.*

## A. Prima del lancio commerciale (bloccanti)

Queste attività non sono codice da scrivere: la piattaforma è pronta, ma senza questi passi andare
online con clienti paganti è un rischio.

| # | Attività | Perché | Chi |
|---|---|---|---|
| 1 | **Revisione legale** di Termini, Privacy, DPA, Abbonamenti e dei modelli per i negozi | Sono bozze accurate, non consulenza legale. La piattaforma tratta dati per conto terzi | Avvocato / DPO |
| 2 | **Prova completa con Stripe in modalità test**: pagamento con carta, 3-D Secure, rimborso, prova gratuita, annullamento in prova, pagamento fallito, contestazione | Il codice è testato con Stripe simulato; manca la prova con l'account vero | Tu + io |
| 3 | **Fornitore email** con dominio verificato (SPF, DKIM, DMARC) | Senza, le conferme d'ordine finiscono nello spam e il server in produzione non si avvia | Tu |
| 4 | **Deploy di produzione** con backup automatici e **un ripristino di prova** | Un backup mai ripristinato non è un backup | Io (guida in `DEPLOY-PRODUZIONE.md`) |
| 5 | **Test di carico** (k6) e **penetration test** esterno | Numeri misurati invece di stime; controllo indipendente della sicurezza | Io + società esterna |
| 6 | **Monitoraggio** (Sentry per gli errori, uptime su `/api/health`, avvisi) | Saperlo prima dei clienti | Io |
| 7 | **Accessibilità (European Accessibility Act)** | Dal 28 giugno 2025 i servizi di e-commerce nell'UE devono essere accessibili (escluse le microimprese). I negozi sono già costruiti con attenzione all'accessibilità, ma serve un audit WCAG 2.1 AA formale prima di venderli come conformi | Auditor + io |

## B. Funzionalità con il maggiore impatto commerciale

| # | Funzione | Impatto | Sforzo | Nota |
|---|---|---|---|---|
| 1 | **Fatturazione elettronica**: e-Factura (RO) e SdI (IT) tramite provider (es. SmartBill/Oblio per la Romania, Fatture in Cloud/Aruba per l'Italia) | Altissimo | 8–12 gg | Il differenziatore più forte per i mercati target; serve un accordo con il provider |
| 2 | **Corrieri locali** (Sameday, FAN Courier, Cargus; BRT, GLS, Poste): etichette e tracking automatici | Alto | 5–8 gg per corriere | Fa risparmiare ore al giorno ai merchant |
| 3 | **Invio delle campagne newsletter** dalla piattaforma (oggi si esporta la lista) | Alto | 5–7 gg | Richiede un servizio di invio massivo (es. Amazon SES) e la gestione delle disiscrizioni |
| 4 | **Sconti automatici**, BOGO, sconti su prodotti o collezioni | Medio-alto | 4–6 gg | Parità con Shopify |
| 5 | **Assistente IA** (descrizioni prodotto, SEO, risposte ai clienti) | Medio-alto | 4–6 gg | Differenziatore percepito; da fare con costi per uso sotto controllo |
| 6 | **Statistiche senza cookie** (visite, conversione, funnel) | Medio | 4–5 gg | Mantiene la piattaforma "senza banner cookie" |
| 7 | Storefront **multilingua** e **multivaluta** | Medio | 8–10 gg | Necessario per chi vende all'estero |
| 8 | Carte regalo, bozze d'ordine, portale resi | Medio | 3–4 gg ciascuno | Parità |
| 9 | Caricamento diretto delle immagini di blog e condivisione (oggi si usa un link) | Basso | 1 gg | Comodità |
| 10 | Notifiche push (PWA per il merchant) | Basso-medio | 3 gg | "Nuovo ordine" sul telefono |
| 11 | **Editor del sito, fase 2**: sezioni anche nelle pagine prodotto, collezione e pagine libere; modelli di sezione salvabili; video; modifica del testo direttamente nell'anteprima | Alto | 6–8 gg | Oggi l'editor a sezioni copre la homepage |
| 12 | **Libreria immagini** del negozio (riusare immagini già caricate in editor, prodotti e blog) | Medio | 2 gg | Evita caricamenti doppi |

## B2. Assistente IA integrato (in discussione con il titolare)

Obiettivo: un negozio online in 5 minuti e la gestione quotidiana (catalogo, design, sconti, blog,
SEO, newsletter, sequenze email) fatta dall'IA, gratuita per i merchant durante la beta.

| Fase | Contenuto | Prerequisiti | Sforzo |
|---|---|---|---|
| 0 | **Motore campagne email** (invio newsletter, sequenze automatiche: benvenuto, carrello, post-acquisto) e SMTP reale | Fornitore di invio massivo (Brevo/SES), dominio | 6–8 gg |
| 1 | **"Negozio in 5 minuti"**: conversazione guidata + foto → prodotti, palette, homepage a sezioni, pagine legali, spedizioni, tutto in bozza da approvare | Scelta del fornitore IA, tetto di spesa | 6–8 gg |
| 2 | **Assistente nel pannello**: chat con strumenti su catalogo, sconti, blog, SEO, sezioni, newsletter; conferma obbligatoria per azioni verso i clienti o irreversibili; registro "eseguito dall'IA" | Fase 1 | 8–10 gg |
| 3 | **Memoria per negozio**: profilo del business, tono, preferenze, risultati (aperture email, conversioni) usati a ogni richiesta; statistiche aggregate e anonime tra negozi solo con consenso | Statistiche senza cookie (B.6) | 5–7 gg |

Regole: l'IA usa le stesse funzioni e gli stessi permessi del merchant (mai accesso diretto al
database); quote giornaliere per negozio e tetto di spesa mensile della piattaforma; nessun dato
dei clienti finali inviato a fornitori che lo usano per addestrare modelli; DPA e informativa
aggiornate (sub-responsabile IA).

## C. Tecnica (per crescere oltre 10.000 utenti)

- **Coda di lavori in background** per email e webhook (es. `pg-boss`, che usa lo stesso Postgres):
  oggi partono subito dopo la risposta. Funziona, ma con picchi di traffico una coda è più robusta.
- **CI su GitHub** (lint, tipi, test, e2e a ogni modifica). Consiglio di attivarla subito: è
  mezza giornata di lavoro e impedisce di pubblicare regressioni.
- **Ricerca prodotti**: prima la ricerca full-text di Postgres, poi Meilisearch se i cataloghi superano
  le decine di migliaia di prodotti.
- **Immagini ottimizzate** (formati moderni e dimensioni multiple) tramite CDN: migliora velocità e SEO.
- **Rate limiting su Redis/Upstash** quando il traffico cresce molto: oggi usa Postgres, che va bene a
  questa scala.
- **Permessi staff personalizzabili** oltre ai tre ruoli attuali.

## D. Business

- **Piani annuali** con sconto (2 mesi gratis): migliorano la cassa e riducono gli abbandoni.
- **Programma partner per agenzie**: il white-label è il vantaggio unico. Un piano "Agency" con più
  negozi e marchio proprio può valere più di molti merchant singoli.
- **Centro assistenza** (guide e video brevi) e una **pagina di stato** del servizio: riducono il
  supporto e aumentano la fiducia.
- **Assicurazione cyber** e contratti di trattamento dati (DPA) firmati con tutti i fornitori.
- **Metriche da seguire dal primo giorno**: conversione da prova a pagamento, abbandono mensile,
  tempo al primo ordine del merchant (l'onboarding guidato serve proprio a ridurlo).

## Il mio consiglio sull'ordine

1. Sezione **A** per intero: senza, il resto non conta.
2. **CI** e **monitoraggio**: costano poco e proteggono tutto il resto.
3. **Fatturazione elettronica** e **corrieri locali**: sono ciò che Shopify non fa bene in Romania e
   Italia, quindi il motivo per cui un merchant sceglierebbe voi.
4. **Campagne newsletter** e **sconti automatici**.

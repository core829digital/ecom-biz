# Product Requirements Document

Piattaforma e-commerce white-label multi-negozio di **CORE829 SRL**. Documento vivo: si aggiorna a
ogni decisione importante (registro in fondo a [`PIANO-LAVORI.md`](PIANO-LAVORI.md)).

## 1. Visione

Un negozio online professionale, bello e animato, **online in 5 minuti e gestito con l'aiuto
dell'intelligenza artificiale**, con tutto in un'unica piattaforma: negozio, pagamenti, email
marketing, contenuti, social e finanze. Senza dover comprare e collegare decine di app.

## 2. Pubblico (target)

| Segmento | Chi sono | Cosa cercano | Perché scelgono noi |
|---|---|---|---|
| **Primario** | Piccoli brand e artigiani in Italia e Romania (1–10 persone), spesso al primo negozio online | Vendere online senza competenze tecniche, spendendo poco | Negozio pronto in minuti, IA che fa il lavoro, italiano/rumeno, prezzi chiari senza app a pagamento |
| **Secondario** | Negozi fisici che aprono il canale online | Catalogo, ritiro/consegna, pagamenti locali (contrassegno, bonifico) | Spedizioni, IVA e documenti già impostati per il loro paese |
| **Terziario** | Agenzie e freelance (anche CORE829) che creano negozi per clienti | Più negozi da un solo account, design curato | Multi-negozio, editor a sezioni, animazioni e CSS personalizzato |

**Non è il target (per ora):** grandi marketplace, B2B con listini complessi, chi vende in 20 paesi.

## 3. Problemi che risolviamo

1. Aprire un negozio richiede tempo e competenze (design, testi, pagine legali, IVA, spedizioni).
2. Shopify & co. costano di più con le app; molte funzioni base sono a pagamento extra.
3. Il marketing è sparso su troppi strumenti (email, social, annunci): si perde tempo e dati.
4. I piccoli merchant non sanno se guadagnano davvero (margini, costo pubblicità, ritorno).

## 4. Proposta di valore e differenziatori

| Differenziatore | Stato |
|---|---|
| Editor del sito a sezioni e blocchi, anteprima dal vivo, bozza/pubblica | ✅ |
| Negozi **animati** (4 preset, ingressi per sezione) + CSS personalizzato, per piano | ✅ |
| Email marketing integrato: campagne e automazioni | ✅ |
| **Assistente IA** che costruisce e gestisce il negozio | 🔜 Fase IA |
| Locale IT/RO: fattura elettronica, corrieri, lingua, GDPR | 🟡 parziale |
| Tutto in un posto: social, annunci, contenuti, finanze | 🔜 |

## 5. Requisiti funzionali (sintesi)

- **Merchant:** registrazione, verifica email, abbonamento con prova gratuita protetta da abusi,
  onboarding guidato (account, negozio, tasse, pagamenti, spedizioni), multi-negozio per piano.
- **Negozio:** catalogo con varianti e inventario, collezioni, checkout (carta, contrassegno,
  bonifico), ordini, rimborsi, clienti con account, recensioni, blog, pagine, contatti, SEO.
- **Design:** editor a sezioni, palette, font, animazioni, CSS, anteprima, pubblicazione.
- **Marketing:** newsletter con doppio consenso, campagne, automazioni, sconti, carrelli abbandonati;
  in arrivo: feed prodotti, social, annunci.
- **IA:** chat nel pannello con accesso a tutte le funzioni (con conferma per azioni verso i
  clienti), negozio in 5 minuti, memoria del business, quote per negozio.
- **File:** caricamento di loghi, immagini e documenti; libreria per negozio con limiti per piano.
- **Finanze:** ricavi, costi, margini, metriche marketing (AOV, CAC, ROAS, LTV) per negozio.
- **Piattaforma (operatore):** piani, negozi, utenti, commissioni, verifica manuale, audit.

## 6. Requisiti non funzionali

- **Sicurezza:** OWASP Top 10, CSP con nonce, validazione e sanificazione di ogni input, rate limit,
  2FA, firme su webhook e pagamenti, nessun segreto nel codice, audit log.
- **Privacy:** GDPR (export/cancellazione self-service, conservazione limitata, DPA), nessun banner
  cookie necessario sulla vetrina.
- **Prestazioni:** pagine vetrina sotto 2,5 s LCP su mobile, query indicizzate, immagini ottimizzate.
- **Accessibilità:** WCAG 2.1 AA (European Accessibility Act), riduzione movimento rispettata.
- **Affidabilità:** job pianificati ripetibili senza duplicati, backup giornalieri.
- **Lingue:** italiano e inglese (rumeno in roadmap).

## 7. Modello di business

Abbonamento mensile per piano (Basic, Grow, Advanced) + commissione sulle vendite con carta.
I piani sbloccano: numero di negozi/prodotti/staff, animazioni premium, CSS, API, dominio proprio,
spazio file, quota IA. Durante la beta l'IA è gratuita per i merchant entro una quota giornaliera.

## 8. Metriche di successo

| Metrica | Obiettivo beta |
|---|---|
| Tempo dalla registrazione al negozio pubblicato | < 10 minuti (con IA < 5) |
| Negozi con almeno un ordine entro 30 giorni | > 30 % |
| Conversione prova gratuita → pagamento | > 20 % |
| Abbandono (churn) mensile | < 5 % |
| Ticket di assistenza per negozio al mese | < 1 |

## 9. Vincoli e dipendenze esterne

Dominio (per email e sottodomini dei negozi), fornitore email (Brevo), storage file (Cloudflare R2
o database), chiave IA, account Stripe, revisione legale, approvazioni delle API di Meta, Google,
TikTok e LinkedIn (richiedono verifica aziendale di CORE829 e revisione delle app).

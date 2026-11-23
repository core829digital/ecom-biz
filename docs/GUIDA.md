# Guida alla piattaforma (per il titolare)

Questa guida spiega in modo non tecnico che cosa fa la piattaforma, come metterla
online e quali decisioni restano da prendere. Per i dettagli tecnici vedi il
`README.md` e la cartella `docs/`.

## Che cos'è

Una piattaforma e-commerce **white-label e multi-negozio**, sullo stesso modello di Shopify:

- **Tu (o il tuo cliente) gestisci la piattaforma.** Il nome è quello che scegli tu
  (`PLATFORM_NAME`): nel prodotto non c'è nessun marchio di terzi.
- **I merchant si registrano e aprono i loro negozi.** Ogni negozio ha un indirizzo del tipo
  `nomenegozio.tuodominio.com` oppure un dominio proprio (`www.negoziodelcliente.it`).
- **Guadagni in due modi:** l'abbonamento mensile dei merchant (piani configurabili) e una
  commissione percentuale su ogni pagamento con carta (tramite Stripe Connect).

## Cosa può fare un merchant

- **Catalogo:** prodotti con varianti (taglia, colore…), foto, inventario, collezioni
  manuali o automatiche, import ed export CSV
- **Ordini:** evasione con numero di tracking ed email automatica al cliente, rimborsi
  (anche parziali), annullamenti, documento di trasporto stampabile, export CSV
- **Pagamenti:** carta (Stripe), contrassegno, bonifico
- **Spedizioni e IVA:** zone, tariffe (anche "spedizione gratis sopra X €"), aliquote per paese
- **Marketing:** codici sconto con limiti e date
- **Negozio online:** tema personalizzabile (logo, colori, font, banner), pagine, menu, dominio
- **Clienti:** account con storico ordini e indirizzi salvati
- **Team:** inviti allo staff con ruoli (proprietario, amministratore, staff)
- **Sviluppatori:** API e webhook per collegare gestionali, magazzini e strumenti di marketing
- **Lingue:** inglese e italiano

## Cosa puoi fare tu (area `/platform`)

- Vedere vendite totali e commissioni incassate
- Sospendere o riattivare un negozio
- Creare i piani di abbonamento (prezzo, commissione, giorni di prova)
- Assegnare un piano o una commissione speciale a un singolo negozio
- Estendere la prova gratuita
- Gestire gli amministratori della piattaforma

## Come metterla online: i passi

1. **Dominio.** Compra il dominio della piattaforma (es. `tuobrand.com`) e punta
   `app.tuobrand.com` e `*.tuobrand.com` al server.
2. **Server.** Una macchina Linux con Docker è sufficiente per iniziare (es. Hetzner o
   DigitalOcean, circa 10–30 €/mese). La procedura è in `docs/DEPLOYMENT.md`; i certificati
   HTTPS sono automatici, anche per i domini dei clienti.
3. **Email.** Un servizio SMTP per le email transazionali (es. Postmark, Brevo, Amazon SES).
4. **Stripe.** Apri un account Stripe a nome di CORE829 SRL, attiva **Connect** e inserisci
   le chiavi. Da quel momento i merchant possono collegare il loro conto e tu incassi la commissione.
5. **Primo accesso.** Crea il tuo utente amministratore e i piani di abbonamento.

## Decisioni che spettano a te

- **Nome e dominio** della piattaforma
- **Prezzi dei piani e commissione** (l'installazione demo propone Basic 19 €, Grow 49 €,
  Advanced 149 €, con commissioni del 2%, dell'1% e dello 0,5%)
- Se **bloccare i negozi senza abbonamento** (`BILLING_ENFORCED`): consiglio di attivarlo
  solo dopo aver configurato Stripe Billing
- **Aspetti legali:** termini di servizio, privacy (GDPR) e contratto con i merchant. Va
  verificato con un legale, perché la piattaforma incassa per conto terzi.

## Limiti attuali (detti onestamente)

- **Fatturazione elettronica** (e-Factura in Romania, SdI in Italia): non è inclusa. Si può
  integrare un servizio esterno tramite API e webhook.
- **Sconti:** valgono su tutto l'ordine, non ancora su singoli prodotti o collezioni.
- **Corrieri:** le tariffe sono fisse o a soglie, senza calcolo in tempo reale da FAN Courier o DHL.
- **Valute:** una per negozio. Non ci sono ancora carte regalo.
- **Pagamenti con carta:** il codice è completo e i webhook sono testati, ma il flusso reale va
  provato con le chiavi "test" di Stripe prima di andare live. Non è stato possibile farlo
  senza un account Stripe.

## Prossimi passi consigliati

1. Creare l'account Stripe (modalità test) e fare una prova completa di pagamento con carta
2. Mettere online un'istanza di prova su un dominio vero
3. Far provare la piattaforma a 2–3 merchant reali per raccogliere feedback
4. Dare priorità alle prossime funzionalità: integrazione e-Factura, calcolo spedizioni dei
   corrieri, sconti per prodotto

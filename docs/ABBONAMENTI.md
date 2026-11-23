# Abbonamenti dei merchant: regole, casi d'uso e protezioni

*Documento per il titolare. Descrive come la piattaforma gestisce gli abbonamenti dei merchant
(non i pagamenti dei clienti finali nei negozi) e come impedisce gli abusi della prova gratuita.*

## Principi

1. **Stripe è l'unica fonte di verità.** A ogni evento la piattaforma rilegge l'abbonamento da Stripe
   invece di fidarsi del contenuto del messaggio. Un evento vecchio o arrivato fuori ordine non può
   quindi "tornare indietro" nello stato.
2. **Nessun evento può essere falsificato.** Ogni messaggio da Stripe è firmato; quelli senza firma
   valida vengono rifiutati (testato). Ogni evento viene elaborato una sola volta.
3. **Mai cancellare dati per un problema di pagamento.** I negozi vengono messi in pausa, non eliminati:
   il merchant che paga ritrova tutto com'era.

## Ciclo di vita

| Stato | Quando | Il negozio vende? |
|---|---|---|
| Nessun piano | Dopo la registrazione | No: si può preparare il negozio, ma non è aperto ai clienti |
| Prova (TRIALING) | Dopo aver avviato la prova con una carta | Sì, fino alla fine della prova |
| Attivo (ACTIVE) | Pagamento riuscito | Sì |
| Pagamento fallito (PAST_DUE) | Rinnovo non riuscito | Sì per **7 giorni di grazia**, poi in pausa |
| Cancellato (CANCELED) | Fine abbonamento | No (tutto conservato) |
| Sospeso (blocco) | Contestazione del pagamento (chargeback) o decisione del super-admin | No |

## Casi d'uso coperti

| # | Caso | Comportamento |
|---|---|---|
| 1 | Registrazione | Nessuna prova automatica. Viene inviata l'email di verifica |
| 2 | Email non verificata | Non si può avviare né prova né abbonamento |
| 3 | Avvio della prova | Solo tramite Stripe con **carta obbligatoria**. Nessun addebito fino alla fine |
| 4 | **Cancellazione durante la prova** | La prova **termina subito** e non viene mai più concessa a quell'account |
| 5 | Nuovo account con la stessa email "mascherata" (`nome+1@gmail.com`, `n.o.m.e@gmail.com`) | Riconosciuta come la stessa persona: niente prova, si paga da subito |
| 6 | Email usa-e-getta (mailinator, yopmail…) | Niente prova |
| 7 | Nuovo account con **la stessa carta** | Riconosciuta dall'impronta della carta: la prova viene chiusa e **l'addebito parte subito** |
| 8 | Molti account dalla stessa rete | Oltre 3 prove in 30 giorni dalla stessa rete: niente prova |
| 9 | Account cancellato e ricreato | Il registro delle prove sopravvive alla cancellazione: niente nuova prova |
| 10 | Promemoria fine prova | Email automatica 3 giorni prima del primo addebito (meno contestazioni, più trasparenza) |
| 11 | Fine prova | Stripe addebita la carta; se fallisce si passa al caso 12 |
| 12 | **Pagamento fallito** | Email al merchant con la data limite; il negozio vende per 7 giorni; Stripe riprova da solo; poi pausa |
| 13 | Pagamento riuscito dopo un fallimento | Tutto torna attivo in automatico |
| 14 | Cancellazione dopo la prova | Resta attivo fino a fine periodo già pagato, poi pausa |
| 15 | Cambio piano (upgrade) | Dal portale Stripe, con calcolo proporzionale automatico |
| 16 | **Downgrade con troppi negozi** | Restano aperti solo i negozi più vecchi entro il limite; gli altri vanno in pausa con un avviso chiaro |
| 17 | **Doppio abbonamento** (due schede di pagamento) | Il secondo viene annullato e rimborsato in automatico |
| 18 | **Chargeback** sul nostro addebito | Account sospeso subito; sblocco automatico se la contestazione viene vinta, altrimenti manuale |
| 19 | Chargeback su un ordine del merchant | Annotato nella cronologia dell'ordine; l'account del merchant **non** viene sospeso |
| 20 | Cambio email del merchant | La nuova email va verificata di nuovo |
| 21 | Eventi Stripe duplicati o fuori ordine | Ignorati in sicurezza (stato sempre riletto da Stripe) |
| 22 | Evento falsificato | Rifiutato (firma non valida) |

### Privacy del registro anti-abuso

Il registro delle prove non contiene email, carte o indirizzi IP in chiaro, ma solo impronte cifrate
(HMAC con `APP_SECRET`), non reversibili. Sopravvive alla cancellazione dell'account per prevenire le
frodi (interesse legittimo, art. 6.1.f GDPR). Va indicato nell'informativa privacy, e la bozza
fornita con la piattaforma lo fa.

## Configurazione obbligatoria su Stripe

Senza questi passaggi alcune protezioni non scattano.

1. **Webhook** (Developers → Webhooks) verso `https://app.tuodominio.com/api/webhooks/stripe`,
   con questi eventi:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`,
   `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`,
   `charge.dispute.created`, `charge.dispute.closed`, `charge.refunded`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`.
   Per Stripe Connect aggiungi un secondo endpoint "Connected accounts" con `account.updated`
   e imposta `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. **Customer portal** (Settings → Billing → Customer portal): abilita aggiornamento carta, cambio piano
   e cancellazione. La cancellazione durante la prova viene trasformata dalla piattaforma in chiusura immediata.
3. **Tentativi di pagamento** (Settings → Billing → Subscriptions and emails → Manage failed payments):
   Smart Retries attivi; dopo l'ultimo tentativo "cancel the subscription". Consiglio una finestra di 2 settimane.
4. **Radar** attivo (incluso in Stripe): blocca molte carte rubate prima che diventino chargeback.
5. `BILLING_ENFORCED=true` in produzione: senza questo i negozi vendono anche senza abbonamento.

## Limiti onesti

- L'impronta della carta riconosce **la stessa carta**, non la stessa persona con carte diverse.
  Le carte virtuali usa-e-getta possono aggirarla; Radar e il limite per rete riducono il problema
  ma non lo eliminano. Nessun sistema lo elimina del tutto senza verifiche d'identità (KYC).
- Il limite per rete è volutamente largo (3 prove in 30 giorni), per non penalizzare uffici e
  coworking che condividono la connessione.
- I test usano un Stripe simulato e la verifica delle firme reale della libreria Stripe. Prima del
  lancio va fatta una prova completa con le chiavi *test* di Stripe:
  1. avvia una prova;
  2. annullala;
  3. riprova con la stessa carta (deve addebitare subito);
  4. simula un pagamento fallito con la carta di test `4000 0000 0000 0341`;
  5. simula una contestazione con `4000 0000 0000 0259`.

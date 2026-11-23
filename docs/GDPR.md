# GDPR: ruoli, diritti e conservazione dei dati

*Base per il registro dei trattamenti (art. 30) e per l'informativa privacy. Va rivisto con un
consulente privacy o un DPO prima del lancio.*

## Ruoli

| Dati | Chi decide (titolare) | Ruolo del gestore della piattaforma |
|---|---|---|
| Account dei merchant e del loro staff, abbonamenti | Il gestore della piattaforma | **Titolare** |
| Clienti dei negozi (ordini, indirizzi, account cliente, recensioni, newsletter) | Il merchant | **Responsabile** (art. 28): serve un DPA con ogni merchant |

## Diritti degli interessati: come si esercitano

| Diritto | Merchant | Cliente di un negozio |
|---|---|---|
| Accesso e portabilità (art. 15, 20) | Account → Privacy e sicurezza → **Scarica i miei dati** (JSON) | Dal proprio account nel negozio → **Scarica i miei dati**; oppure il merchant da Clienti → **Esporta dati** |
| Cancellazione (art. 17) | Account → Privacy e sicurezza → **Elimina account** (password + conferma scritta; i negozi solo con conferma esplicita) | Dal proprio account → **Elimina il mio account**; oppure il merchant da Clienti → **Elimina dati personali** |
| Rettifica (art. 16) | Modifica del profilo | Modifica di account e indirizzi; il merchant dalla scheda cliente |
| Opposizione al marketing (art. 21) | Non applicabile | Consenso opzionale e non preselezionato al checkout; revocabile |

**Cosa resta dopo una cancellazione, e perché.**
- **Ordini**: restano al merchant, scollegati dalla persona, per gli obblighi fiscali (art. 17.3.b).
- **Registro attività**: resta, senza il collegamento all'account.
- **Registro anti-abuso della prova gratuita**: resta, contenente solo impronte cifrate e non reversibili, per prevenire frodi (interesse legittimo).

L'esportazione non contiene mai password, segreti 2FA o codici di recupero.

## Conservazione (applicata in automatico dal job `cleanup`)

| Dato | Conservazione |
|---|---|
| Checkout non completati (email, indirizzi digitati) | 90 giorni |
| Carrelli abbandonati | 60 giorni |
| Avvisi "di nuovo disponibile" | 90 giorni dopo l'invio, 1 anno se mai inviati |
| Link di reset password e verifica email | 7 giorni dopo la scadenza |
| Log consegne webhook | 30 giorni (riusciti), 90 giorni (falliti) |
| Registro attività (sicurezza) | 2 anni |
| Sessioni | Fino alla scadenza |
| Registro anti-abuso prove: rete / email e carta | 60 giorni / 3 anni (solo hash) |
| Ordini, clienti, prodotti | Finché il merchant li conserva (obblighi fiscali: tipicamente 10 anni) |
| Account merchant | Fino alla cancellazione |

I periodi sono definiti in `src/server/retention.ts`.

## Sub-responsabili (da elencare nell'informativa, secondo la configurazione scelta)

| Servizio | Scopo | Dove |
|---|---|---|
| Stripe | Pagamenti e abbonamenti | UE/USA (clausole contrattuali standard) |
| Hosting (Vercel o server Hetzner) | Esecuzione dell'applicazione | UE (Vercel: regione Francoforte impostata; società USA) |
| Database (Neon o server proprio) | Archiviazione dati | UE (Francoforte) |
| Cloudflare R2 | Immagini | Globale |
| Fornitore email (SES, Postmark, Brevo) | Email transazionali | Secondo il fornitore |

## Cookie

Solo cookie tecnici (sessione, carrello, lingua e tema, sicurezza del checkout). Nessun cookie di
profilazione o di analisi di terze parti, nessuna richiesta a CDN di terzi per i font: **non serve il
banner di consenso**. Va riconsiderato se si aggiungono strumenti di analisi o marketing.

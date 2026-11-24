# Messa in produzione: database, hosting e dimensionamento per 10.000 utenti

*Guida per il titolare, aggiornata a novembre 2026. Prezzi e limiti dei fornitori cambiano spesso:
le cifre qui sotto vengono dalle pagine ufficiali (link in fondo) e vanno ricontrollate il giorno in cui
si attiva un servizio. Dove un numero è una mia stima, è scritto esplicitamente.*

---

## 1. In breve: la mia raccomandazione

| Fase | Cosa usare | Costo indicativo |
|---|---|---|
| **Prova e demo** (pochi merchant di test) | Vercel **Pro** + Neon **Free** + Cloudflare R2 (gratis fino a 10 GB) | circa 20 $/mese (solo Vercel) |
| **Lancio commerciale fino a 10.000 utenti** | **Opzione A** Vercel Pro + Neon a pagamento + R2, *oppure* **Opzione B** un server Hetzner con Docker (già pronto nel progetto) + backup | A: circa 70–150 $/mese · B: circa 25–60 €/mese (stime) |

Tre cose da sapere subito, dette senza giri di parole:

1. **Un database gratuito non basta per un servizio commerciale da 10.000 utenti.** Va benissimo per
   provare e per la demo, ma ha limiti di spazio e nessuna garanzia di backup. Su Neon Free, quando lo
   spazio finisce, **le scritture falliscono**: in un e-commerce significa ordini che non vengono salvati.
   Il passaggio al piano a pagamento va previsto da subito (costa poco, vedi sezione 4).
2. **Vercel "Hobby" (gratuito) non si può usare per scopi commerciali.** Lo dicono i termini di Vercel:
   qualsiasi uso commerciale richiede il piano Pro (20 $/mese). CORE829 vende la piattaforma, quindi serve Pro.
3. **Per una piattaforma con i domini dei clienti, l'opzione più economica e con meno vincoli è il server
   dedicato (Opzione B).** Il progetto è già pronto: Docker, Caddy con HTTPS automatico anche per i
   domini dei merchant, cron e backup sono documentati in [`DEPLOYMENT.md`](DEPLOYMENT.md).
   Vercel (Opzione A) costa di più ma toglie quasi tutta la gestione dei server. Ho adattato il codice
   perché funzionino **entrambe**.

**Se dovessi scegliere io per CORE829:** Opzione A per il lancio, perché il team non deve gestire server,
aggiornamenti di sicurezza e certificati. Si può passare all'Opzione B quando i costi di Vercel
superano quelli di un server più un'ora di manutenzione al mese.

---

## 2. Cosa vuol dire "10.000 utenti" (le ipotesi)

Il numero da solo non basta per dimensionare. Ho fatto queste ipotesi, **che sono stime mie**:

| Grandezza | Ipotesi | Perché conta |
|---|---|---|
| Utenti registrati (merchant e staff) | 10.000 | Login, pannello admin |
| Negozi attivi | circa 2.000 | Il traffico vero viene dai clienti dei negozi |
| Ordini al mese (totale piattaforma) | circa 100.000 | Spazio nel database, email |
| Visitatori dei negozi al mese | 1–3 milioni di pagine viste | Calcolo del server |
| Picco di utenti contemporanei | 1–3% degli attivi | Dimensione del server o delle funzioni |
| Immagini prodotto | circa 90 GB (2.000 negozi × 50 prodotti × 3 foto × 300 KB) | Storage R2/S3 |

**Spazio nel database (stima):** un ordine completo (righe, eventi, checkout, carrello) occupa circa
5–10 KB, indici compresi. Con 100.000 ordini al mese il database cresce di **circa 0,5–1 GB al mese**.
Un piano gratuito da 0,5–1 GB si riempie quindi in poche settimane di uso reale.

**Carico:** non ho fatto un test di carico, quindi non ho numeri misurati. Va fatto prima del lancio
(sezione 8). Le pagine dei negozi sono leggere, i calcoli pesanti avvengono solo al checkout, e le query
usano indici per negozio: l'architettura è adatta a questo volume.

---

## 3. Database PostgreSQL gratuito: le opzioni reali

| | **Neon Free** | **Supabase Free** |
|---|---|---|
| Spazio | 1 GB per progetto (tetto di 20 GB su tutti i progetti) | 500 MB |
| Calcolo | 100 CU-ore al mese per progetto, si spegne dopo 5 minuti di inattività | CPU condivisa, 500 MB di RAM |
| Pausa | Si riaccende da solo alla prima richiesta (qualche centinaio di ms) | **Il progetto va in pausa dopo una settimana di inattività** e resta offline finché non lo riattivi a mano |
| Backup | Ripristino storico limitato | **Nessun backup automatico** sul piano gratuito |
| Quando finisce lo spazio | Le scritture falliscono (nessun addebito) | Il database diventa di sola lettura |
| Ideale per | Prove, demo, ambienti di staging | Prove |

**Consiglio: Neon.** Si accende da solo, non va in pausa per giorni, ha branch per i test e il passaggio
al piano a pagamento è a consumo, senza canone fisso. Supabase è un ottimo prodotto, ma qui useremmo
solo il database e la pausa settimanale è pericolosa per una demo che un cliente apre dopo dieci giorni.

### Creare il database su Neon (passo passo)

1. Registrati su neon.com e crea un progetto. **Regione: Europe (Frankfurt)**, vicina ai clienti e
   alla regione `fra1` di Vercel impostata nel progetto.
2. Nella pagina **Connect** copia **due** stringhe di connessione:
   - **Pooled** (l'host contiene `-pooler`): va in `DATABASE_URL`. Aggiungi in fondo
     `&pgbouncer=true&connection_limit=5` (se la stringa non ha ancora parametri, usa `?` al posto del primo `&`).
   - **Direct** (senza `-pooler`): va in `DIRECT_DATABASE_URL`. Serve solo alle migrazioni.

   Perché due: in un ambiente serverless partono molte copie dell'applicazione e ognuna aprirebbe le
   sue connessioni. Il *pooler* le raccoglie e protegge il database. Le migrazioni invece richiedono
   una connessione diretta.
3. Fatto: al primo deploy lo script `vercel-build` crea tutte le tabelle da solo.

---

## 4. Opzione A: Vercel Pro + Neon + Cloudflare R2

### Cosa serve e quanto costa

| Servizio | Piano | Costo | Note |
|---|---|---|---|
| Vercel | **Pro** | 20 $/mese per utente che fa deploy, con 20 $ di consumo inclusi | Hobby vietato per uso commerciale |
| Neon | Free → **Launch** | Free per la prova; Launch a consumo: circa 0,106 $ per CU-ora e 0,35 $ per GB-mese | Stima per il volume del capitolo 2: circa 40–80 $/mese con un calcolo da 0,5–1 CU sempre acceso |
| Cloudflare R2 | Gratis fino a 10 GB, poi a consumo | Circa 1–2 $/mese per 90 GB (stima) | **Nessun costo di traffico in uscita** |
| Email (SMTP) | Amazon SES, Postmark o Brevo | Dipende dal volume (stima: 20–60 $/mese per circa 300.000 email) | Obbligatorio per conferme d'ordine |

### Adattamenti già fatti nel codice per Vercel

| Problema su Vercel | Soluzione nel progetto |
|---|---|
| Il disco è temporaneo: le foto caricate sparirebbero | Su Vercel l'app **rifiuta** lo storage locale e richiede `STORAGE_DRIVER=s3` (R2 o S3) |
| Vercel accetta al massimo 4,5 MB per richiesta | Su Vercel il limite di upload scende da 10 a **4 MB**, con un messaggio chiaro al merchant |
| I domini dei merchant devono essere registrati sul progetto, altrimenti niente HTTPS | Quando un merchant verifica il suo dominio, l'app lo aggiunge a Vercel tramite API (`VERCEL_API_TOKEN`); quando lo rimuove, lo toglie |
| Le migrazioni non funzionano tramite il pooler | Lo script `vercel-build` usa `DIRECT_DATABASE_URL` solo per le migrazioni |
| Attività pianificate (webhook, pulizia, carrelli abbandonati) | `vercel.json` contiene i 3 cron. Vercel invia da solo `Authorization: Bearer $CRON_SECRET`, che è esattamente il controllo che fa l'app |
| Latenza con il database in Europa | `vercel.json` imposta la regione `fra1` (Francoforte) |

### Passo passo

1. **Storage immagini (R2).** Su Cloudflare crea un bucket R2, abilita l'accesso pubblico (dominio
   `r2.dev` o, meglio, un tuo sottodominio come `media.tuobrand.com`) e crea una chiave API con
   permesso di scrittura sul bucket.
2. **Progetto Vercel.** Importa il repository GitHub `ecom-biz`. Vercel riconosce Next.js e usa lo
   script `vercel-build`. Passa il team al piano **Pro**.
3. **Variabili d'ambiente** (Settings → Environment Variables, ambiente *Production*):

   | Variabile | Valore |
   |---|---|
   | `DATABASE_URL` | stringa Neon *pooled* con `pgbouncer=true&connection_limit=5` |
   | `DIRECT_DATABASE_URL` | stringa Neon *direct* |
   | `APP_URL` | `https://app.tuobrand.com` |
   | `STOREFRONT_ROOT_DOMAIN` | `tuobrand.com` (i negozi saranno `nomenegozio.tuobrand.com`) |
   | `STOREFRONT_PROTOCOL` | `https` |
   | `PLATFORM_NAME` | il nome commerciale della piattaforma |
   | `APP_SECRET`, `CRON_SECRET` | due stringhe casuali lunghe, almeno 32 caratteri (es. `openssl rand -base64 48`). **`APP_SECRET` non va mai cambiato dopo il lancio**: cifra i codici della verifica in due passaggi, e cambiandolo nessuno potrebbe più accedere con la 2FA |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_BUCKET`, `S3_REGION=auto`, `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
   | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | chiave R2 |
   | `S3_PUBLIC_URL` | l'URL pubblico del bucket |
   | `SMTP_URL`, `EMAIL_FROM` | dal fornitore email |
   | `STRIPE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | dal pannello Stripe (prima *test*, poi *live*) |
   | `CUSTOM_DOMAIN_TARGET` | `cname.vercel-dns.com` |
   | `LEGAL_COMPANY_NAME`, `LEGAL_ADDRESS`, `LEGAL_VAT_NUMBER`, `LEGAL_EMAIL`, `LEGAL_COURTS` | dati legali del gestore, mostrati nelle pagine `/legal` e nel footer |
   | `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | token creato in Vercel → Account Settings → Tokens, con accesso al team del progetto |

   Le altre variabili (e il loro significato) sono in [`.env.example`](../.env.example).
4. **Domini della piattaforma.** In Vercel → Domains aggiungi `app.tuobrand.com`, `tuobrand.com` e
   **`*.tuobrand.com`**. Per il dominio jolly (`*`) Vercel deve gestire il DNS di `tuobrand.com`
   (cambiare i *nameserver* presso il registrar) oppure ricevere la delega del record `_acme-challenge`.
   Consiglio di spostare i nameserver: è la soluzione che dà meno problemi nel tempo.
5. **Primo deploy.** Al termine crea l'amministratore della piattaforma eseguendo in locale, con le
   stesse variabili di produzione, `npm run platform:admin`, poi crea i piani da `/platform/plans`.
6. **Stripe.** Webhook verso `https://app.tuobrand.com/api/webhooks/stripe`, poi una prova completa
   di pagamento in modalità *test* prima di passare alle chiavi *live*.

### Domini dei merchant su Vercel

Il merchant aggiunge `www.negozio.it` nel pannello e crea due record DNS: un CNAME verso
`cname.vercel-dns.com` e un TXT di verifica. Quando preme *Verifica*, la piattaforma controlla il TXT
(prova di proprietà) e solo dopo registra il dominio su Vercel, che emette il certificato HTTPS.

Limiti da conoscere:
- Vercel Pro ha un limite "anti-abuso" di 100.000 domini per progetto, alzabile su richiesta.
- L'API accetta circa **100 nuovi domini all'ora** per team. Non è un problema per merchant che si
  collegano uno alla volta, ma lo è per un'importazione massiva.
- Il dominio "nudo" (`negozio.it` senza `www`) non può avere un CNAME: il merchant collega `www` e
  imposta presso il registrar il reindirizzamento da `negozio.it` a `www.negozio.it`.

---

## 5. Opzione B: server dedicato con Docker (Hetzner o simili)

Tutto è già pronto e documentato in [`DEPLOYMENT.md`](DEPLOYMENT.md): Docker Compose, PostgreSQL,
Caddy con HTTPS automatico (anche per i domini dei merchant, senza API esterne), cron e backup.

| Voce | Indicazione |
|---|---|
| Server | 4 vCPU, 8 GB di RAM, 80+ GB di disco (linea "cost-optimized", CX o CAX su Hetzner) |
| Costo | Hetzner ha alzato i prezzi due volte nel 2026 (aprile e giugno): **controllare il listino attuale**. Indicativamente 10–25 €/mese per questa taglia |
| Database | Sullo stesso server (incluso) oppure gestito (Neon a pagamento) per avere backup e ripristino puntuale senza pensieri |
| Immagini | Disco del server, oppure R2 (consigliato oltre i 50 GB) |
| Backup | Backup giornaliero del database **fuori dal server** (es. Hetzner Storage Box o R2) + snapshot settimanale del server |
| Manutenzione | Circa 1–2 ore al mese: aggiornamenti di sistema e immagini Docker |

**Pro:** costo prevedibile e basso, nessun limite su upload o domini, nessuna dipendenza da API di terzi.
**Contro:** gli aggiornamenti di sicurezza e il monitoraggio sono a carico vostro; un solo server è un
singolo punto di guasto, mitigabile con backup testati e uno snapshot pronto al ripristino.

Altre piattaforme gestite (Railway, Render, Fly.io) sono una via di mezzo valida. Supportano Docker,
quindi il progetto gira senza modifiche. Non le ho analizzate a fondo per questa guida: se interessano,
va fatto un confronto prezzi aggiornato.

---

## 6. Confronto finale

| | Opzione A: Vercel + Neon | Opzione B: Server Docker |
|---|---|---|
| Costo mensile al volume ipotizzato | circa 70–150 $ (stima) | circa 25–60 € (stima, backup inclusi) |
| Gestione server | Nessuna | 1–2 h al mese |
| Scalabilità automatica | Sì | No (si sceglie un server più grande) |
| Domini merchant | Via API, circa 100 all'ora | Illimitati, automatici |
| Upload massimo | 4 MB | 10 MB |
| Rischio "bolletta a sorpresa" | Sì, se arriva molto traffico: impostare i limiti di spesa in Vercel | No |
| Tempo per andare online | Meno di un'ora | Mezza giornata |

---

## 7. Checklist prima del lancio (valida per entrambe le opzioni)

- [ ] Database a pagamento con **backup automatici**, e un **ripristino di prova** fatto davvero
- [ ] `APP_SECRET` e `CRON_SECRET` lunghi e casuali, mai riusati dall'ambiente di test; `APP_SECRET` conservato in un password manager aziendale
- [ ] Email: dominio mittente verificato con **SPF, DKIM e DMARC** (altrimenti le conferme d'ordine finiscono in spam)
- [ ] Stripe: pagamento completo in *test*, poi chiavi *live* e webhook *live*
- [ ] Monitoraggio: un servizio di uptime (es. Better Stack o UptimeRobot) che controlla `https://app.tuobrand.com/api/health` ogni minuto
- [ ] Cron attivi: controllare dopo un'ora che `/api/cron/recovery` e gli altri rispondano 200 nei log
- [ ] Vercel: limite di spesa (*Spend Management*) impostato
- [ ] Test di carico (sezione 8)
- [ ] Legale: termini di servizio, privacy (GDPR), DPA con i merchant e con i fornitori (Vercel, Neon,
      Cloudflare, Stripe, fornitore email). Va fatto con un legale: la piattaforma tratta dati dei clienti
      finali per conto dei merchant.

---

## 8. Test di carico (prima del lancio)

Prima di aprire al pubblico conviene simulare il traffico, per esempio con [k6](https://k6.io), contro
un ambiente identico alla produzione (mai contro quella vera con clienti reali):

```bash
k6 run --vus 100 --duration 5m script.js
```

Lo script deve simulare il percorso reale: home del negozio, pagina prodotto, aggiunta al carrello e
checkout. Da tenere d'occhio: tempo di risposta al 95° percentile sotto i 500 ms per le pagine e nessun
errore al checkout. Se l'obiettivo non viene raggiunto, si interviene sulla causa misurata (indici,
cache delle pagine prodotto, piano del database) invece di andare a tentativi.

---

## 9. Quando crescere oltre

- **Database:** con Neon basta alzare il limite di autoscaling; con il server dedicato si sposta il
  database su un servizio gestito.
- **Immagini:** spostare su R2 con un dominio dedicato (`media.tuobrand.com`) dietro la CDN di Cloudflare.
- **Ricerca prodotti:** oltre le decine di migliaia di prodotti per negozio conviene un motore dedicato
  (es. Meilisearch o Typesense). Oggi la ricerca usa il database.

---

## Fonti (consultate a novembre 2026)

- Neon, limiti del piano gratuito: https://neon.com/faqs/free-plan-limits-and-quotas
- Neon, prezzi: https://neon.com/pricing
- Supabase, prezzi e limiti: https://supabase.com/pricing
- Vercel, cron (limiti per piano): https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel, limiti multi-tenant e domini: https://vercel.com/docs/multi-tenant/limits
- Vercel, aggiunta di domini: https://vercel.com/docs/domains/working-with-domains/add-a-domain
- Vercel Hobby, uso commerciale e Pro (sintesi di terze parti): https://zplatform.ai/guides/is-vercel-free/
- Cloudflare R2, prezzi: https://developers.cloudflare.com/r2/pricing/
- Hetzner, rincari 2026 (analisi di terze parti, verificare sul listino ufficiale): https://northflank.com/blog/hetzner-cloud-server-price-increases

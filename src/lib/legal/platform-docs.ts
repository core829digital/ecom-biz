/**
 * Platform legal documents (drafts to be reviewed by a lawyer before launch).
 * Written in the same safe "markdown-lite" as merchant pages (## headings, - lists, **bold**, [links](/…)).
 * Placeholders: {platform} {company} {address} {vat} {email} {dpo} {courts} {appUrl} {updated}
 *
 * Bump LEGAL_VERSION whenever a document changes materially: merchants are asked to accept again.
 */
export const LEGAL_VERSION = "2026-11-23";

export const LEGAL_DOCS = ["terms", "privacy", "cookies", "dpa", "subscriptions", "acceptable-use"] as const;
export type LegalDocSlug = (typeof LEGAL_DOCS)[number];

type Doc = { title: string; summary: string; body: string };

const en: Record<LegalDocSlug, Doc> = {
  terms: {
    title: "Terms of Service",
    summary: "The agreement between you (the merchant) and {company} for using {platform}.",
    body: `## 1. Who we are
{platform} is operated by **{company}**, {address}, VAT {vat} ("we"). Contact: {email}.

## 2. The service
{platform} lets businesses ("merchants") create and run online stores: catalogue, checkout, payments through our payment partner, order management, and related tools. The service is offered to businesses and professionals, not to consumers.

## 3. Your account
- You must give accurate information, verify your email address and keep your password and two-factor codes secret.
- You are responsible for everything done with your account, including by staff you invite.
- One free trial per customer (see the [Subscriptions and Refunds policy](/legal/subscriptions)).

## 4. Your stores and your customers
- You are the seller: you are responsible for your products, prices, taxes, invoices, shipping, returns, consumer rights, and the legal pages of your store.
- For your customers' personal data you are the **controller** and we are your **processor**, under the [Data Processing Agreement](/legal/dpa), which is part of these terms.
- You must follow the [Acceptable Use Policy](/legal/acceptable-use).

## 5. Fees and payments
- Subscription fees, the transaction fee on card payments and the trial length are shown on the pricing page and in Billing before you subscribe.
- Card payments are processed by Stripe under its own terms; payouts go to your connected account.
- Prices exclude VAT unless stated. Unpaid subscriptions pause your stores after a grace period; nothing is deleted.

## 6. Availability and changes
We work to keep the service available and secure, but we don't guarantee it is uninterrupted. We may improve or change features; we will give at least 30 days' notice of changes that materially reduce the service or increase fees.

## 7. Your content and data
You keep all rights to your content. You give us the licence needed to host and display it to run the service. You can export your data at any time (products and orders as CSV and through the API; your account data from Account → Privacy).

## 8. Suspension and termination
- You can cancel at any time from Billing and delete your account from Account → Privacy.
- We may suspend accounts that break these terms, endanger the platform or other users, involve fraud, or have unresolved payment disputes. Where possible we warn you first.
- After termination we delete your data as described in the [Privacy Policy](/legal/privacy), except what we must keep by law.

## 9. Liability
To the extent permitted by law, our total liability in any 12-month period is limited to the fees you paid us in that period, and we are not liable for indirect losses or lost profits. Nothing limits liability for fraud, wilful misconduct or gross negligence.

## 10. Law and courts
These terms are governed by the law of the country of {company}'s registered office. Courts of {courts} have exclusive jurisdiction, without prejudice to mandatory rules.

## 11. Changes to these terms
We may update these terms; the version date is shown below. Material changes are notified in the app, and continued use after the effective date means acceptance.`,
  },
  privacy: {
    title: "Privacy Policy",
    summary: "How {company} processes the personal data of merchants and their staff.",
    body: `## 1. Controller
**{company}**, {address}, VAT {vat}. Privacy contact: {dpo}.

This policy covers merchants and their staff. For shoppers of a store, the merchant is the controller: see the store's own privacy policy. We process shoppers' data only on the merchant's instructions, as a processor.

## 2. Data we process, why, and on which legal basis
- **Account data** (name, email, password hash, language, 2FA settings): to provide the service. *Basis: contract.*
- **Billing data** (plan, subscription status; card details are held by Stripe, never by us): to charge subscriptions. *Basis: contract; tax records: legal obligation.*
- **Security data** (sessions, IP address, device, activity log): to protect accounts and investigate abuse. *Basis: legitimate interest.*
- **Free-trial anti-abuse record**: non-reversible keyed hashes of email, card fingerprint and network, so a trial is granted once per customer. *Basis: legitimate interest in fraud prevention.*
- **Service emails** (verification, billing, security): *Basis: contract.* We send no marketing without your consent.

## 3. How long we keep data
- Account data: until you delete your account.
- Activity log: 2 years. Expired sessions and links: deleted automatically.
- Trial anti-abuse hashes: up to 3 years (network hashes: 60 days).
- Billing records: as required by tax law (typically 10 years).

## 4. Who receives data
Our providers, bound by data-processing terms: payment processing (Stripe), hosting and database, file storage, and transactional email. Some providers may process data outside the EEA under the European Commission's Standard Contractual Clauses. We never sell personal data.

## 5. Your rights
You can access, correct, export or delete your data. Export and deletion are self-service in **Account → Privacy and security**. You can object to processing based on legitimate interest and complain to your data protection authority. Contact {dpo}.

## 6. Security
Passwords are hashed, two-factor secrets are encrypted, traffic is encrypted (HTTPS), access is logged, and data is isolated per store.

## 7. Cookies
We only use strictly necessary cookies: see the [Cookie Policy](/legal/cookies).`,
  },
  cookies: {
    title: "Cookie Policy",
    summary: "The platform and the stores use only strictly necessary cookies.",
    body: `## What we use
Only **strictly necessary** cookies, which don't need consent (art. 5(3) ePrivacy Directive):

- **sid**: keeps you signed in to the admin (30 days, or until you sign out).
- **cs_…** (one per store): keeps a shopper signed in to their store account (60 days, or until sign-out).
- **cart_…** (one per store): remembers the shopping cart (30 days).
- **locale, theme, accent**: remember your language and appearance (1 year).

## What we don't use
No advertising, profiling or third-party analytics cookies, and fonts are served from our own servers. If a store adds third-party tools, the merchant must collect the consent required for them.

## Managing cookies
You can delete cookies in your browser settings; you'll be signed out and the cart will be emptied.`,
  },
  dpa: {
    title: "Data Processing Agreement",
    summary: "Art. 28 GDPR terms for the shoppers' data we process on behalf of merchants.",
    body: `## 1. Parties and scope
This agreement is part of the Terms of Service between the merchant (**controller**) and {company} (**processor**). It covers the personal data of the merchant's shoppers processed through {platform}: identification and contact data, addresses, orders, account data, reviews, and marketing preferences.

## 2. Instructions
We process the data only to provide the service and on the merchant's documented instructions, which are the Terms and the merchant's use of the platform's features.

## 3. Our obligations
- Confidentiality: people with access are bound to confidentiality.
- Security measures (art. 32): encryption in transit, hashed credentials, isolation between stores, access control with roles and two-factor authentication, logging, backups.
- Sub-processors: hosting, database, file storage, email delivery and payment processing. We inform the merchant of changes, and the merchant can object.
- Assistance: tools for access, export and erasure requests (customer page → Export data / Erase personal data).
- Breaches: we notify the merchant without undue delay, and in any case within 48 hours of becoming aware.
- End of service: on account deletion the data is deleted, except where law requires keeping it.

## 4. Transfers
Where a sub-processor is outside the EEA, transfers rely on the Standard Contractual Clauses or an adequacy decision.

## 5. Audits
We provide the information needed to demonstrate compliance; on-site audits are possible with reasonable notice, at the merchant's cost.`,
  },
  subscriptions: {
    title: "Subscriptions and Refunds",
    summary: "Free trial, billing, cancellation and refunds for merchant plans.",
    body: `## Free trial
- **One free trial per customer.** The same person, card or company can't start a new trial, including with a new account. Accounts that try to get around this are charged from the start.
- A card is required, and nothing is charged during the trial. We email you **3 days before** the first charge.
- **Cancelling during the trial ends it immediately**, and the trial can't be restarted later.

## Billing
- Plans renew automatically every month or year at the price shown before you subscribe, plus VAT where applicable.
- Upgrades apply immediately with a pro-rata charge. With downgrades, stores beyond the new plan's limit are paused (the oldest stay open); nothing is deleted.

## Failed payments
If a renewal fails we email you and retry automatically. Your stores keep working for **7 days**; after that they are paused until payment succeeds.

## Cancellation
You can cancel at any time from Billing. After the trial, the plan stays active until the end of the period already paid and then stops renewing.

## Refunds
Fees already paid are not refundable, except where required by law or in case of a charge made in error (for example a duplicate subscription, which is refunded automatically). Payment disputes (chargebacks) pause the account until resolved.`,
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    summary: "What can't be sold or done with {platform}.",
    body: `## Not allowed
- Illegal products or services, counterfeit goods, products infringing third-party rights.
- Weapons, drugs, and other products restricted by law or by our payment partner's rules.
- Fraud, deceptive practices, fake reviews, phishing or impersonation.
- Spam, or sending marketing to people who haven't consented.
- Attempts to breach security, overload the platform, access other merchants' data, or abuse free trials.

## Enforcement
We may remove content, suspend stores or close accounts that break this policy, and report illegal activity to the authorities. Report abuse to {email}.`,
  },
};

const it: Record<LegalDocSlug, Doc> = {
  terms: {
    title: "Termini di servizio",
    summary: "Il contratto tra te (il merchant) e {company} per l'uso di {platform}.",
    body: `## 1. Chi siamo
{platform} è gestita da **{company}**, {address}, P.IVA {vat} ("noi"). Contatti: {email}.

## 2. Il servizio
{platform} consente ad aziende e professionisti ("merchant") di creare e gestire negozi online: catalogo, checkout, pagamenti tramite il nostro partner, gestione ordini e strumenti collegati. Il servizio è rivolto a imprese e professionisti, non a consumatori.

## 3. Il tuo account
- Devi fornire dati corretti, verificare l'indirizzo email e custodire password e codici di verifica in due passaggi.
- Sei responsabile di tutto ciò che avviene con il tuo account, anche da parte dello staff che inviti.
- Una sola prova gratuita per cliente (vedi la [politica Abbonamenti e rimborsi](/legal/subscriptions)).

## 4. I tuoi negozi e i tuoi clienti
- Il venditore sei tu: sei responsabile di prodotti, prezzi, imposte, fatture, spedizioni, resi, diritti dei consumatori e pagine legali del tuo negozio.
- Per i dati personali dei tuoi clienti sei **titolare** del trattamento e noi siamo **responsabile**, secondo l'[Accordo sul trattamento dei dati](/legal/dpa), che fa parte di questi termini.
- Devi rispettare la [Politica di uso accettabile](/legal/acceptable-use).

## 5. Costi e pagamenti
- Canoni, commissione sui pagamenti con carta e durata della prova sono indicati nella pagina prezzi e in Abbonamento prima della sottoscrizione.
- I pagamenti con carta sono elaborati da Stripe secondo i propri termini; gli incassi arrivano sul tuo conto collegato.
- I prezzi sono IVA esclusa salvo diversa indicazione. In caso di mancato pagamento, dopo un periodo di grazia i negozi vengono messi in pausa; nulla viene cancellato.

## 6. Disponibilità e modifiche
Lavoriamo per mantenere il servizio disponibile e sicuro, ma non ne garantiamo la continuità assoluta. Possiamo migliorare o modificare le funzionalità; daremo almeno 30 giorni di preavviso per modifiche che riducono in modo rilevante il servizio o aumentano i costi.

## 7. Contenuti e dati
I tuoi contenuti restano tuoi. Ci concedi la licenza necessaria a ospitarli e mostrarli per erogare il servizio. Puoi esportare i tuoi dati in qualsiasi momento (prodotti e ordini in CSV e tramite API; i dati dell'account da Account → Privacy).

## 8. Sospensione e cessazione
- Puoi annullare in qualsiasi momento da Abbonamento ed eliminare l'account da Account → Privacy.
- Possiamo sospendere gli account che violano questi termini, mettono a rischio la piattaforma o altri utenti, sono coinvolti in frodi o hanno contestazioni di pagamento aperte. Quando possibile ti avvisiamo prima.
- Alla cessazione cancelliamo i dati come descritto nell'[Informativa privacy](/legal/privacy), salvo quanto dobbiamo conservare per legge.

## 9. Responsabilità
Nei limiti di legge, la nostra responsabilità complessiva in ogni periodo di 12 mesi è limitata ai canoni da te pagati nello stesso periodo, ed è esclusa per danni indiretti o mancati guadagni. Restano salvi i casi di dolo e colpa grave.

## 10. Legge applicabile e foro
Questi termini sono regolati dalla legge del paese della sede legale di {company}. Foro esclusivo: {courts}, fatte salve le norme inderogabili.

## 11. Modifiche
Possiamo aggiornare questi termini; la data di versione è indicata in fondo. Le modifiche rilevanti vengono comunicate nell'app, e l'uso continuato dopo la data di efficacia vale come accettazione.`,
  },
  privacy: {
    title: "Informativa privacy",
    summary: "Come {company} tratta i dati personali dei merchant e del loro staff.",
    body: `## 1. Titolare del trattamento
**{company}**, {address}, P.IVA {vat}. Contatto privacy: {dpo}.

Questa informativa riguarda i merchant e il loro staff. Per i clienti di un negozio il titolare è il merchant: consulta l'informativa del negozio. Trattiamo i dati dei clienti solo su istruzione del merchant, come responsabile del trattamento.

## 2. Dati, finalità e basi giuridiche
- **Dati dell'account** (nome, email, hash della password, lingua, impostazioni 2FA): per erogare il servizio. *Base: contratto.*
- **Dati di fatturazione** (piano e stato dell'abbonamento; i dati della carta sono conservati da Stripe, mai da noi): per addebitare gli abbonamenti. *Base: contratto; registri fiscali: obbligo di legge.*
- **Dati di sicurezza** (sessioni, indirizzo IP, dispositivo, registro attività): per proteggere gli account e indagare sugli abusi. *Base: legittimo interesse.*
- **Registro anti-abuso della prova gratuita**: impronte cifrate e non reversibili di email, carta e rete, per concedere la prova una sola volta per cliente. *Base: legittimo interesse alla prevenzione delle frodi.*
- **Email di servizio** (verifica, fatturazione, sicurezza): *Base: contratto.* Nessun invio promozionale senza il tuo consenso.

## 3. Conservazione
- Dati dell'account: fino alla cancellazione dell'account.
- Registro attività: 2 anni. Sessioni e link scaduti: cancellati in automatico.
- Impronte anti-abuso della prova: fino a 3 anni (impronte di rete: 60 giorni).
- Documenti di fatturazione: secondo la legge fiscale (in genere 10 anni).

## 4. Destinatari
I nostri fornitori, vincolati da accordi sul trattamento dei dati: pagamenti (Stripe), hosting e database, archiviazione file ed email transazionali. Alcuni fornitori possono trattare dati fuori dallo SEE sulla base delle Clausole contrattuali standard della Commissione europea. Non vendiamo dati personali.

## 5. I tuoi diritti
Puoi accedere ai tuoi dati, rettificarli, esportarli o cancellarli. Esportazione e cancellazione sono disponibili in autonomia in **Account → Privacy e sicurezza**. Puoi opporti ai trattamenti basati sul legittimo interesse e presentare reclamo all'autorità di controllo (in Italia il Garante privacy). Contatto: {dpo}.

## 6. Sicurezza
Password cifrate con hash, segreti 2FA crittografati, traffico cifrato (HTTPS), accessi registrati, dati separati per negozio.

## 7. Cookie
Usiamo solo cookie tecnici: vedi la [Cookie policy](/legal/cookies).`,
  },
  cookies: {
    title: "Cookie policy",
    summary: "La piattaforma e i negozi usano solo cookie tecnici.",
    body: `## Cosa usiamo
Solo cookie **tecnici strettamente necessari**, che non richiedono consenso (art. 122 Codice privacy):

- **sid**: mantiene l'accesso al pannello (30 giorni, o fino all'uscita).
- **cs_…** (uno per negozio): mantiene l'accesso all'account cliente del negozio (60 giorni, o fino all'uscita).
- **cart_…** (uno per negozio): ricorda il carrello (30 giorni).
- **locale, theme, accent**: ricordano lingua e aspetto (1 anno).

## Cosa non usiamo
Nessun cookie pubblicitario, di profilazione o di analisi di terze parti; i font sono serviti dai nostri server. Se un negozio aggiunge strumenti di terzi, è il merchant a dover raccogliere il consenso necessario.

## Gestione
Puoi cancellare i cookie dalle impostazioni del browser: verrai disconnesso e il carrello sarà svuotato.`,
  },
  dpa: {
    title: "Accordo sul trattamento dei dati",
    summary: "Clausole art. 28 GDPR per i dati dei clienti che trattiamo per conto dei merchant.",
    body: `## 1. Parti e oggetto
Questo accordo fa parte dei Termini di servizio tra il merchant (**titolare**) e {company} (**responsabile**). Riguarda i dati personali dei clienti del merchant trattati tramite {platform}: dati identificativi e di contatto, indirizzi, ordini, dati dell'account, recensioni e preferenze di marketing.

## 2. Istruzioni
Trattiamo i dati solo per erogare il servizio e secondo le istruzioni documentate del merchant, cioè i Termini e l'uso che il merchant fa delle funzioni della piattaforma.

## 3. Obblighi del responsabile
- Riservatezza: chi ha accesso ai dati è vincolato alla riservatezza.
- Misure di sicurezza (art. 32): cifratura in transito, credenziali con hash, separazione tra negozi, controllo accessi con ruoli e verifica in due passaggi, registrazione degli accessi, backup.
- Sub-responsabili: hosting, database, archiviazione file, invio email e pagamenti. Informiamo il merchant delle modifiche, e il merchant può opporsi.
- Assistenza: strumenti per le richieste di accesso, esportazione e cancellazione (scheda cliente → Esporta dati / Elimina dati personali).
- Violazioni: notifica al merchant senza ingiustificato ritardo e comunque entro 48 ore dalla conoscenza.
- Fine del servizio: alla cancellazione dell'account i dati vengono cancellati, salvo obblighi di legge.

## 4. Trasferimenti
Se un sub-responsabile si trova fuori dallo SEE, i trasferimenti si basano sulle Clausole contrattuali standard o su una decisione di adeguatezza.

## 5. Verifiche
Forniamo le informazioni necessarie a dimostrare la conformità; sono possibili verifiche con ragionevole preavviso, a spese del merchant.`,
  },
  subscriptions: {
    title: "Abbonamenti e rimborsi",
    summary: "Prova gratuita, fatturazione, disdetta e rimborsi dei piani per i merchant.",
    body: `## Prova gratuita
- **Una sola prova gratuita per cliente.** La stessa persona, carta o azienda non può avviare una nuova prova, nemmeno con un nuovo account. Gli account che tentano di aggirare la regola vengono addebitati da subito.
- È richiesta una carta, e durante la prova non viene addebitato nulla. Ti avvisiamo via email **3 giorni prima** del primo addebito.
- **Annullando durante la prova, la prova termina subito** e non può essere riattivata in seguito.

## Fatturazione
- I piani si rinnovano automaticamente ogni mese o anno al prezzo indicato prima della sottoscrizione, più IVA ove applicabile.
- Gli upgrade si applicano subito con addebito proporzionale. Con un downgrade, i negozi oltre il limite del nuovo piano vengono messi in pausa (restano aperti i più vecchi); nulla viene cancellato.

## Pagamenti non riusciti
Se un rinnovo non va a buon fine ti avvisiamo via email e riproviamo automaticamente. I negozi continuano a funzionare per **7 giorni**, poi vengono messi in pausa finché il pagamento non riesce.

## Disdetta
Puoi annullare in qualsiasi momento da Abbonamento. Dopo la prova, il piano resta attivo fino alla fine del periodo già pagato e poi non si rinnova.

## Rimborsi
I canoni già pagati non sono rimborsabili, salvo obblighi di legge o addebiti avvenuti per errore (ad esempio un abbonamento duplicato, che viene rimborsato automaticamente). Le contestazioni di pagamento (chargeback) sospendono l'account fino alla loro risoluzione.`,
  },
  "acceptable-use": {
    title: "Politica di uso accettabile",
    summary: "Cosa non si può vendere o fare con {platform}.",
    body: `## Non consentito
- Prodotti o servizi illegali, merce contraffatta, prodotti che violano diritti di terzi.
- Armi, droghe e altri prodotti soggetti a restrizioni di legge o del nostro partner di pagamento.
- Frodi, pratiche ingannevoli, recensioni false, phishing o sostituzione di persona.
- Spam o invio di comunicazioni promozionali a chi non ha dato il consenso.
- Tentativi di violare la sicurezza, sovraccaricare la piattaforma, accedere ai dati di altri merchant o abusare delle prove gratuite.

## Applicazione
Possiamo rimuovere contenuti, sospendere negozi o chiudere account che violano questa politica, e segnalare attività illecite alle autorità. Segnala gli abusi a {email}.`,
  },
};

export function legalDoc(slug: LegalDocSlug, locale: string, vars: Record<string, string>): Doc {
  const doc = (locale === "it" ? it : en)[slug];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return { title: fill(doc.title), summary: fill(doc.summary), body: fill(doc.body) };
}

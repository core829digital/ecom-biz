/**
 * Starter legal pages for merchants' stores (EU distance selling). Created as drafts: the merchant
 * must review them (ideally with a lawyer) before publishing. Markdown-lite, like every store page.
 * Placeholders: {store} {company} {address} {vat} {email} {phone}
 */
export const STORE_LEGAL_PAGES = ["privacy-policy", "terms-of-sale", "returns", "shipping"] as const;
export type StoreLegalPage = (typeof STORE_LEGAL_PAGES)[number];

type Template = { title: string; body: string };

const en: Record<StoreLegalPage, Template> = {
  "privacy-policy": {
    title: "Privacy Policy",
    body: `## Who is responsible for your data
**{company}**, {address}, VAT {vat}. Contact: {email}.

## What we collect and why
- **Order data** (name, email, phone, delivery and billing address, items purchased): to process and deliver your order and to issue invoices. *Basis: contract; tax records: legal obligation.*
- **Account data** (if you create an account): to show your orders and saved addresses. *Basis: contract.*
- **Marketing emails**: only if you opt in at checkout; you can unsubscribe at any time. *Basis: consent.*
- **Reviews and stock alerts**: when you submit them. *Basis: consent.*
- **Payment data**: card payments are processed by our payment provider; we never see or store your card number.

## How long we keep it
Orders and invoices are kept as required by tax law (typically 10 years). Unfinished checkouts are deleted after 90 days, abandoned carts after 60 days. Your account is kept until you delete it.

## Who receives it
Our e-commerce platform provider (as data processor), payment provider, couriers for delivery, and email provider. We don't sell your data.

## Your rights
You can access, correct, export or delete your data, object to processing and withdraw consent. If you have an account, you can download or delete your data yourself from **My account → Privacy**. Otherwise write to {email}. You can also complain to your data protection authority.

## Cookies
We only use technical cookies needed for the cart, sign-in and checkout security.`,
  },
  "terms-of-sale": {
    title: "Terms of Sale",
    body: `## Seller
**{company}**, {address}, VAT {vat}. Email {email}{phone}.

## Orders and prices
Prices are shown in the store currency and include VAT where indicated at checkout. Shipping costs are shown before you place the order. The contract is concluded when we confirm your order by email.

## Payment
Accepted payment methods are shown at checkout. For cash on delivery you pay the courier; for bank transfer the order is shipped once payment is received.

## Delivery
We ship to the countries listed at checkout. Delivery times are indicative; you'll receive tracking details when the order ships.

## Right of withdrawal (consumers)
If you are a consumer, you can withdraw from the purchase within **14 days** of receiving the goods without giving a reason. Tell us by email at {email} with your order number (you may use the EU model withdrawal form). Return the goods within 14 days of your notice; unless stated otherwise, you bear the return shipping cost. We refund all payments received, including standard delivery costs, within 14 days of receiving your notice, using the same payment method; we may wait until we receive the goods back. The right doesn't apply to goods made to your specifications, sealed goods unsealed after delivery for health or hygiene reasons, and other cases excluded by law.

## Legal guarantee of conformity
Goods are covered by the legal guarantee of conformity for 2 years from delivery. Contact {email} to report a defect.

## Disputes
These terms are governed by the law of the seller's country, without depriving consumers of the protection of mandatory rules of their country of residence. Consumers can also use the EU Online Dispute Resolution platform.`,
  },
  returns: {
    title: "Returns and Refunds",
    body: `## 14-day returns
You can return items within **14 days** of delivery. Write to {email} with your order number and the items you want to return; we'll reply with the return address and instructions.

## Condition of items
Items must be returned complete, in their original condition and packaging where possible. You're responsible for any loss of value caused by handling beyond what's needed to check them.

## Refunds
Once we receive the return we refund you within 14 days to the original payment method. For cash-on-delivery orders we refund by bank transfer.

## Defective or wrong items
If an item is defective or not what you ordered, contact us: we cover the return shipping and send a replacement or a refund.`,
  },
  shipping: {
    title: "Shipping",
    body: `## Where we ship
We ship to the countries shown at checkout. Rates and any free-shipping threshold are calculated at checkout before you pay.

## Processing and delivery times
Orders are usually prepared within 1–2 business days. Delivery times depend on the destination and the courier; you'll receive the tracking number by email when your order ships.

## Customs
For destinations outside the EU, duties and taxes may be charged on delivery and are paid by the recipient.

## Questions
Write to {email} with your order number.`,
  },
};

const it: Record<StoreLegalPage, Template> = {
  "privacy-policy": {
    title: "Informativa privacy",
    body: `## Titolare del trattamento
**{company}**, {address}, P.IVA {vat}. Contatti: {email}.

## Quali dati raccogliamo e perché
- **Dati dell'ordine** (nome, email, telefono, indirizzi di consegna e fatturazione, prodotti acquistati): per gestire e consegnare l'ordine ed emettere i documenti fiscali. *Base: contratto; documenti fiscali: obbligo di legge.*
- **Dati dell'account** (se ne crei uno): per mostrarti ordini e indirizzi salvati. *Base: contratto.*
- **Email promozionali**: solo se dai il consenso al checkout; puoi disiscriverti in qualsiasi momento. *Base: consenso.*
- **Recensioni e avvisi di disponibilità**: quando li invii. *Base: consenso.*
- **Dati di pagamento**: i pagamenti con carta sono gestiti dal nostro fornitore di pagamento; non vediamo né conserviamo il numero della carta.

## Per quanto tempo
Ordini e documenti fiscali sono conservati come richiesto dalla legge fiscale (in genere 10 anni). I checkout non completati sono cancellati dopo 90 giorni, i carrelli abbandonati dopo 60 giorni. L'account resta finché non lo elimini.

## A chi vengono comunicati
Al fornitore della piattaforma e-commerce (responsabile del trattamento), al fornitore di pagamento, ai corrieri per la consegna e al fornitore email. Non vendiamo i tuoi dati.

## I tuoi diritti
Puoi accedere ai tuoi dati, rettificarli, esportarli o cancellarli, opporti al trattamento e revocare il consenso. Se hai un account, puoi scaricare o cancellare i dati in autonomia da **Il mio account → Privacy**; altrimenti scrivi a {email}. Puoi anche presentare reclamo al Garante per la protezione dei dati personali.

## Cookie
Usiamo solo cookie tecnici necessari per carrello, accesso e sicurezza del checkout.`,
  },
  "terms-of-sale": {
    title: "Condizioni di vendita",
    body: `## Venditore
**{company}**, {address}, P.IVA {vat}. Email {email}{phone}.

## Ordini e prezzi
I prezzi sono espressi nella valuta del negozio e comprendono l'IVA quando indicato al checkout. Le spese di spedizione sono mostrate prima dell'invio dell'ordine. Il contratto si conclude con la conferma dell'ordine via email.

## Pagamento
I metodi di pagamento accettati sono indicati al checkout. Con il contrassegno paghi il corriere; con il bonifico l'ordine viene spedito alla ricezione del pagamento.

## Consegna
Spediamo nei paesi indicati al checkout. I tempi di consegna sono indicativi; riceverai il tracciamento alla spedizione.

## Diritto di recesso (consumatori)
Se sei un consumatore, puoi recedere dall'acquisto entro **14 giorni** dalla ricezione della merce, senza indicarne il motivo (artt. 52 e seguenti del Codice del Consumo). Comunicalo via email a {email} indicando il numero d'ordine (puoi usare il modulo tipo di recesso). Restituisci la merce entro 14 giorni dalla comunicazione; salvo diversa indicazione, le spese di restituzione sono a tuo carico. Rimborsiamo tutti i pagamenti ricevuti, comprese le spese di consegna standard, entro 14 giorni dalla comunicazione, con lo stesso mezzo di pagamento; possiamo attendere di ricevere la merce. Il recesso è escluso per beni personalizzati, beni sigillati aperti dopo la consegna per motivi igienici o sanitari e negli altri casi previsti dalla legge.

## Garanzia legale di conformità
I prodotti sono coperti dalla garanzia legale di conformità di 2 anni dalla consegna. Scrivi a {email} per segnalare un difetto.

## Controversie
Si applica la legge del paese del venditore, fatta salva la tutela più favorevole delle norme inderogabili del paese di residenza del consumatore. I consumatori possono usare anche la piattaforma europea di risoluzione online delle controversie.`,
  },
  returns: {
    title: "Resi e rimborsi",
    body: `## Reso entro 14 giorni
Puoi restituire i prodotti entro **14 giorni** dalla consegna. Scrivi a {email} con il numero d'ordine e i prodotti da restituire: ti risponderemo con indirizzo e istruzioni per il reso.

## Condizioni dei prodotti
I prodotti vanno restituiti completi, integri e possibilmente nella confezione originale. Sei responsabile della diminuzione di valore dovuta a una manipolazione diversa da quella necessaria a verificarli.

## Rimborsi
Ricevuto il reso, ti rimborsiamo entro 14 giorni con lo stesso metodo di pagamento. Per gli ordini in contrassegno rimborsiamo con bonifico.

## Prodotti difettosi o errati
Se un prodotto è difettoso o diverso da quello ordinato, contattaci: le spese di reso sono a nostro carico e inviamo una sostituzione o un rimborso.`,
  },
  shipping: {
    title: "Spedizioni",
    body: `## Dove spediamo
Spediamo nei paesi indicati al checkout. Tariffe ed eventuale soglia di spedizione gratuita sono calcolate al checkout prima del pagamento.

## Tempi di preparazione e consegna
Gli ordini vengono preparati di solito entro 1–2 giorni lavorativi. I tempi di consegna dipendono dalla destinazione e dal corriere; riceverai il numero di tracciamento via email alla spedizione.

## Dogana
Per destinazioni fuori dall'UE possono essere applicati dazi e imposte alla consegna, a carico del destinatario.

## Domande
Scrivi a {email} indicando il numero d'ordine.`,
  },
};

export function storeLegalTemplate(page: StoreLegalPage, locale: string, vars: Record<string, string>): Template {
  const tpl = (locale === "it" ? it : en)[page];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return { title: fill(tpl.title), body: fill(tpl.body) };
}

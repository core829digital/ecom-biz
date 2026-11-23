/** Marketing copy for the landing page. {brand} is replaced with PLATFORM_NAME. */
const en = {
  nav: { features: "Features", how: "How it works", pricing: "Pricing", faq: "FAQ", login: "Log in", start: "Start free trial", dashboard: "Dashboard" },
  hero: {
    eyebrow: "Commerce, without the busywork",
    title: "Launch stores that sell from day one",
    subtitle: "{brand} gives you a fast storefront, a checkout that converts and a back office your team will actually enjoy using. Multiple stores, one account.",
    primary: "Start your free trial",
    secondary: "See how it works",
    note: "14-day free trial · No charge until it ends · Cancel anytime",
    toast: "New order",
  },
  marquee: ["Fashion", "Beauty", "Home & living", "Food & drink", "Electronics", "Art & prints", "Sports", "Kids", "Jewelry", "Pets", "Books", "Events"],
  stats: [
    { value: "3", label: "payment methods built in" },
    { value: "2", label: "languages out of the box" },
    { value: "∞", label: "variants of your brand" },
    { value: "1", label: "account for all your stores" },
  ],
  features: {
    eyebrow: "Everything included",
    title: "One platform. Every tool you need to sell.",
    items: {
      themes: { title: "Your brand, everywhere", body: "Theme presets, custom colors, fonts and dark storefronts. Live preview, no code." },
      checkout: { title: "Checkout that converts", body: "One page, recalculated on the server. Cards, cash on delivery and bank transfer." },
      stores: { title: "Many stores, one account", body: "Switch between stores like servers. Each one with its own domain, team and theme." },
      palette: { title: "Fly with the keyboard", body: "Ctrl K to jump to any order, product or setting in a second." },
      api: { title: "API & webhooks", body: "Scoped tokens, signed webhooks and retries. Connect your ERP, WMS or CRM." },
      orders: { title: "Orders on autopilot", body: "Fulfil with tracking, refund per line, restock automatically. Customers are notified." },
      security: { title: "Enterprise-grade security", body: "Two-factor auth, session control, audit log and hashed secrets by default." },
      global: { title: "Taxes & shipping, sorted", body: "EU VAT inclusive or exclusive, shipping zones and free-shipping thresholds." },
    },
  },
  how: {
    eyebrow: "How it works",
    title: "From idea to first order in an afternoon",
    steps: [
      { title: "Create your store", body: "Pick a name and an address. Taxes and shipping are pre-filled for your country." },
      { title: "Add products & style it", body: "Upload photos, set variants and choose a theme preset. Preview everything live." },
      { title: "Get paid", body: "Connect card payments or enable cash on delivery. Share your link and start selling." },
    ],
  },
  compare: {
    eyebrow: "No surprises",
    title: "Included here. Paid extra elsewhere.",
    us: "{brand}",
    them: "Typical platforms",
    rows: [
      ["Multiple stores on one subscription", "Separate plan per store"],
      ["Cash on delivery & bank transfer", "Third-party apps"],
      ["API & signed webhooks", "Higher tiers only"],
      ["Two-factor auth & audit log", "Enterprise tier"],
      ["Product reviews with moderation", "Third-party apps"],
      ["Back-in-stock email alerts", "Third-party apps"],
      ["Profit & margin reports", "Higher tiers only"],
      ["Full data export (CSV + API)", "Limited"],
      ["White-label, no vendor branding", "Their logo on your store"],
    ],
  },
  pricing: { eyebrow: "Pricing", title: "Simple plans that grow with you", month: "month", fee: "{fee}% on card payments", stores: "Up to {count} stores", storesOne: "1 store", products: "{count} products", unlimitedProducts: "Unlimited products", popular: "Most popular", cta: "Start free trial" },
  faq: {
    title: "Questions, answered",
    items: [
      { q: "Do I need technical skills?", a: "No. You create your store, add products and pick a theme from the dashboard. Developers can go further with the API and webhooks." },
      { q: "Can I use my own domain?", a: "Yes. Connect a domain you own; HTTPS certificates are issued automatically once DNS points to us." },
      { q: "Which payment methods are supported?", a: "Credit and debit cards (including Apple Pay and Google Pay), cash on delivery and bank transfer. Payouts go straight to your bank account." },
      { q: "Can I run more than one store?", a: "Yes. Your plan decides how many stores your account can own, and you switch between them in one click." },
      { q: "How does the free trial work?", a: "Create your store for free, then start a 14-day trial from Billing with a card. You're charged only when the trial ends, and we remind you 3 days before. Cancel anytime before at no cost. One trial per customer." },
      { q: "Can I export my data?", a: "Always. Products and orders export to CSV, and everything is available through the REST API." },
    ],
  },
  cta: { title: "Your next store is a few minutes away", subtitle: "Start free. Upgrade when you're ready.", button: "Create your store" },
  footer: { rights: "All rights reserved.", product: "Product", account: "Account", language: "Language" },
  mock: { sales: "Net sales", orders: "Orders", conversion: "Conversion", shop: "Shop now", steps: ["Paid", "Packed", "Shipped", "Delivered"] },
};

export type LandingCopy = typeof en;

const it: LandingCopy = {
  nav: { features: "Funzionalità", how: "Come funziona", pricing: "Prezzi", faq: "FAQ", login: "Accedi", start: "Prova gratis", dashboard: "Dashboard" },
  hero: {
    eyebrow: "E-commerce, senza fatica",
    title: "Negozi online che vendono dal primo giorno",
    subtitle: "{brand} ti dà uno storefront veloce, un checkout che converte e un gestionale che il tuo team userà volentieri. Più negozi, un solo account.",
    primary: "Inizia la prova gratuita",
    secondary: "Scopri come funziona",
    note: "14 giorni gratis · Nessun addebito fino alla fine · Disdici quando vuoi",
    toast: "Nuovo ordine",
  },
  marquee: ["Moda", "Bellezza", "Casa", "Food & drink", "Elettronica", "Arte e stampe", "Sport", "Bambini", "Gioielli", "Animali", "Libri", "Eventi"],
  stats: [
    { value: "3", label: "metodi di pagamento inclusi" },
    { value: "2", label: "lingue pronte all'uso" },
    { value: "∞", label: "varianti del tuo brand" },
    { value: "1", label: "account per tutti i tuoi negozi" },
  ],
  features: {
    eyebrow: "Tutto incluso",
    title: "Una piattaforma. Tutto ciò che serve per vendere.",
    items: {
      themes: { title: "Il tuo brand, ovunque", body: "Temi predefiniti, colori, font e storefront scuri. Anteprima dal vivo, senza codice." },
      checkout: { title: "Un checkout che converte", body: "Una sola pagina, ricalcolata sul server. Carte, contrassegno e bonifico." },
      stores: { title: "Più negozi, un account", body: "Passa da un negozio all'altro come tra server. Ognuno con dominio, team e tema propri." },
      palette: { title: "Vola con la tastiera", body: "Ctrl K per raggiungere in un secondo qualsiasi ordine, prodotto o impostazione." },
      api: { title: "API e webhook", body: "Token con permessi, webhook firmati e ritentativi. Collega ERP, magazzino o CRM." },
      orders: { title: "Ordini in automatico", body: "Evadi con tracking, rimborsa per riga, ripristina lo stock. I clienti vengono avvisati." },
      security: { title: "Sicurezza enterprise", body: "Verifica in due passaggi, controllo sessioni, registro attività e segreti cifrati." },
      global: { title: "IVA e spedizioni, risolte", body: "IVA UE inclusa o esclusa, zone di spedizione e soglie per la spedizione gratuita." },
    },
  },
  how: {
    eyebrow: "Come funziona",
    title: "Dall'idea al primo ordine in un pomeriggio",
    steps: [
      { title: "Crea il negozio", body: "Scegli nome e indirizzo. IVA e spedizioni sono già impostate per il tuo paese." },
      { title: "Aggiungi prodotti e stile", body: "Carica le foto, imposta le varianti e scegli un tema. Anteprima di tutto dal vivo." },
      { title: "Incassa", body: "Attiva le carte o il contrassegno. Condividi il link e inizia a vendere." },
    ],
  },
  compare: {
    eyebrow: "Nessuna sorpresa",
    title: "Qui è incluso. Altrove si paga a parte.",
    us: "{brand}",
    them: "Piattaforme tipiche",
    rows: [
      ["Più negozi con un solo abbonamento", "Un piano per ogni negozio"],
      ["Contrassegno e bonifico", "App di terze parti"],
      ["API e webhook firmati", "Solo nei piani superiori"],
      ["2FA e registro attività", "Piano enterprise"],
      ["Recensioni prodotto con moderazione", "App di terze parti"],
      ["Avvisi email \"di nuovo disponibile\"", "App di terze parti"],
      ["Report di profitto e margine", "Solo nei piani superiori"],
      ["Esportazione completa dei dati (CSV + API)", "Limitata"],
      ["White-label, nessun marchio del fornitore", "Il loro logo sul tuo negozio"],
    ],
  },
  pricing: { eyebrow: "Prezzi", title: "Piani semplici che crescono con te", month: "mese", fee: "{fee}% sui pagamenti con carta", stores: "Fino a {count} negozi", storesOne: "1 negozio", products: "{count} prodotti", unlimitedProducts: "Prodotti illimitati", popular: "Più scelto", cta: "Prova gratis" },
  faq: {
    title: "Domande frequenti",
    items: [
      { q: "Servono competenze tecniche?", a: "No. Crei il negozio, aggiungi i prodotti e scegli un tema dalla dashboard. Gli sviluppatori possono andare oltre con API e webhook." },
      { q: "Posso usare il mio dominio?", a: "Sì. Collega un dominio di tua proprietà: i certificati HTTPS vengono emessi automaticamente appena il DNS punta a noi." },
      { q: "Quali metodi di pagamento sono supportati?", a: "Carte di credito e debito (incluse Apple Pay e Google Pay), contrassegno e bonifico. Gli incassi arrivano direttamente sul tuo conto." },
      { q: "Posso gestire più negozi?", a: "Sì. Il tuo piano stabilisce quanti negozi può avere il tuo account, e passi dall'uno all'altro con un clic." },
      { q: "Come funziona la prova gratuita?", a: "Crei il negozio gratis, poi attivi da Abbonamento una prova di 14 giorni con una carta. L'addebito parte solo alla fine della prova e ti avvisiamo 3 giorni prima. Puoi annullare prima senza costi. Una prova per cliente." },
      { q: "Posso esportare i miei dati?", a: "Sempre. Prodotti e ordini si esportano in CSV, e tutto è disponibile tramite l'API REST." },
    ],
  },
  cta: { title: "Il tuo prossimo negozio è a pochi minuti", subtitle: "Inizia gratis. Passa a un piano quando sei pronto.", button: "Crea il tuo negozio" },
  footer: { rights: "Tutti i diritti riservati.", product: "Prodotto", account: "Account", language: "Lingua" },
  mock: { sales: "Vendite nette", orders: "Ordini", conversion: "Conversione", shop: "Acquista", steps: ["Pagato", "Preparato", "Spedito", "Consegnato"] },
};

export function landingCopy(locale: string, brand: string): LandingCopy {
  const copy = locale === "it" ? it : en;
  // Inject the white-label platform name.
  return JSON.parse(JSON.stringify(copy).replaceAll("{brand}", brand.replace(/["\\]/g, "")));
}

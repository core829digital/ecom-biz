# Strategia di prodotto: confronto con Shopify e differenziatori

*Aggiornato a novembre 2026. Le fonti esterne sono in fondo. Molte sono blog di settore: i numeri vanno presi come ordini di grandezza, non come dati ufficiali.*

## 1. Dove fa male Shopify (le opportunità)

Le lamentele ricorrenti dei merchant puntano quasi tutte nella stessa direzione: **il prezzo di listino non è il costo reale**.

| Problema di Shopify | Impatto sul merchant | La nostra risposta |
|---|---|---|
| **App a pagamento** per funzioni di base (recensioni, avvisi di disponibilità, fatture, profitti, wishlist…) | Le stime variano molto tra le fonti: da 50–200 $/mese a diverse centinaia per i brand medi | **Funzioni incluse nel piano**, senza app |
| **Commissione extra** se non si usa Shopify Payments | Penalizza i mercati dove i metodi locali contano (contrassegno, bonifico) | Contrassegno e bonifico **nativi, senza commissioni** |
| **Un abbonamento per ogni negozio** | Chi ha più brand o mercati paga più volte | **Più negozi con un solo account** (limite in base al piano) |
| **Personalizzazione del checkout** riservata a Shopify Plus (circa 2.300 $/mese) | I piccoli non possono adattare il checkout | Checkout configurabile in tutti i piani |
| **Brand Shopify** e dipendenza dalla piattaforma | Le agenzie non possono rivendere con il proprio marchio | **White-label totale**: le agenzie (come CORE829) rivendono a loro nome |
| **Funzioni EU/locali assenti o via app** (fatturazione elettronica, corrieri locali) | Integrazioni costose | Roadmap mirata a Romania e Italia |
| API soggetta a revisione delle app e limiti per piano | Attrito per sviluppatori e integratori | API e webhook inclusi, token con permessi granulari |

## 2. Mappa funzionale: Shopify e la piattaforma

Legenda: ✅ presente · 🟡 parziale · ⬜ assente (in backlog)

### Catalogo e negozio
| Funzione | Stato | Note |
|---|---|---|
| Prodotti, varianti (3 opzioni, fino a 100), media | ✅ | |
| Inventario, avvisi di scorte basse | ✅ | |
| Collezioni manuali e automatiche | ✅ | |
| Import/export CSV | ✅ | Compatibile con le colonne principali di Shopify |
| Temi con anteprima, preset, modalità scura | ✅ | |
| Pagine, menu, SEO, sitemap, JSON-LD | ✅ | |
| Domini personalizzati con SSL automatico | ✅ | |
| Storefront multilingua (contenuti tradotti) | 🟡 | Interfaccia EN/IT; i contenuti sono in una lingua per negozio |
| Multi-valuta / Markets | ⬜ | Una valuta per negozio |
| Prodotti digitali (download) | 🟡 | Supportati senza spedizione; manca la consegna del file |
| Abbonamenti ricorrenti | ⬜ | |
| Bundle | ⬜ | |

### Checkout e pagamenti
| Funzione | Stato | Note |
|---|---|---|
| Checkout one-page | ✅ | |
| Carte (Stripe Connect), Apple/Google Pay | ✅ | |
| Contrassegno, bonifico | ✅ | **Differenziatore** |
| Codici sconto (%, fisso, spedizione gratuita) | ✅ | |
| Sconti automatici, BOGO, sconti per prodotto o collezione | ⬜ | Priorità media |
| Carte regalo | ⬜ | |
| Recupero dei carrelli abbandonati | ⬜ | **Priorità alta** (impatto diretto sul fatturato) |
| Conformità GDPR sui cookie | ✅ | Solo cookie tecnici (nessun consenso richiesto) e font self-hosted: nessun dato inviato a CDN terzi |

### Ordini e operatività
| Funzione | Stato | Note |
|---|---|---|
| Evasione con tracking, rimborsi parziali, restock | ✅ | |
| Documento di trasporto | ✅ | |
| Fattura con riepilogo IVA | ⬜ | **Priorità alta** (su Shopify serve un'app) |
| Bozze d'ordine / ordini manuali | ⬜ | |
| Resi gestiti dal cliente | ⬜ | |
| Integrazioni corrieri (FAN, Sameday, BRT, Poste) | ⬜ | Differenziatore locale |
| e-Factura (RO) / SdI (IT) | ⬜ | Differenziatore locale (tramite provider certificato) |

### Clienti e marketing
| Funzione | Stato | Note |
|---|---|---|
| Account cliente, indirizzi, storico | ✅ | |
| Recensioni prodotto con moderazione | ⬜ | **Priorità alta** (su Shopify serve un'app) |
| Avvisi "di nuovo disponibile" | ⬜ | **Priorità alta** (su Shopify serve un'app) |
| Segmenti e email marketing | ⬜ | |
| Wishlist | ⬜ | |
| Programma fedeltà | ⬜ | |

### Analisi
| Funzione | Stato | Note |
|---|---|---|
| Dashboard vendite, prodotti più venduti | ✅ | |
| **Profitto lordo con costo del venduto** | ⬜ | **Priorità alta**: il costo per articolo è già salvato. Su Shopify serve un piano superiore o un'app |
| Report personalizzati, funnel | ⬜ | |

### Piattaforma e sicurezza
| Funzione | Stato | Note |
|---|---|---|
| Staff con ruoli, inviti | ✅ | |
| 2FA, sessioni, registro attività, CSP | ✅ | |
| API REST, webhook firmati | ✅ | |
| Command palette, scorciatoie, UX in stile Discord | ✅ | **Differenziatore UX** |
| Più negozi per account, limiti per piano | ✅ | **Differenziatore** |
| White-label per agenzie | ✅ | **Differenziatore** |
| Assistente IA (stile Sidekick) | ⬜ | Futuro |

## 3. Posizionamento

> **"Tutto quello che su Shopify paghi con le app, qui è incluso. Più negozi con un solo abbonamento. Pagamenti locali senza penali. Con il tuo marchio."**

Clienti target:
1. **PMI in Romania e Italia** che vendono con contrassegno e bonifico.
2. **Agenzie e software house** che vogliono rivendere una piattaforma con il proprio marchio.
3. **Merchant con più brand o mercati**, che oggi pagano un abbonamento Shopify per ogni negozio.

## 4. Backlog prioritizzato (fase 17)

Ordine scelto in base a valore per il merchant, differenziazione e sforzo:

| # | Funzione | Perché |
|---|---|---|
| 1 | **Conformità GDPR per design** | Solo cookie tecnici e font self-hosted, quindi nessun banner necessario. Va riconsiderato se in futuro si aggiungono analytics di terze parti |
| 2 | **Fattura stampabile/PDF con riepilogo IVA** | Su Shopify serve un'app; richiesta da ogni merchant UE |
| 3 | **Recupero carrelli abbandonati** (email con link che ripristina il carrello) | Impatto diretto sul fatturato |
| 4 | **Recensioni prodotto** con moderazione, stelle e dati strutturati SEO | Su Shopify serve un'app; migliora conversione e SEO |
| 5 | **Avvisi "di nuovo disponibile"** | Su Shopify serve un'app; recupera vendite perse |
| 6 | **Analisi del profitto** (margine lordo dal costo per articolo) | Su Shopify serve un piano superiore o un'app |
| 7 | Sconti automatici e per prodotto/collezione | Parità con Shopify |
| 8 | Integrazione e-Factura / SdI tramite provider | Differenziatore locale (richiede accordo con un provider) |
| 9 | Integrazioni corrieri locali | Differenziatore locale (richiede le API dei corrieri) |
| 10 | Carte regalo, bozze d'ordine, resi | Parità |

I punti da 1 a 6 vengono implementati subito. I punti 8 e 9 richiedono contratti o API esterne: vanno decisi con il titolare.

## Fonti

- [Shopify Pricing (2026): Plans, Fees & Real Cost Breakdown](https://commerce-ui.com/insights/shopify-pricing)
- [Shopify Fees Workarounds 2026](https://www.surebright.com/blog/uncovering-shopify-fee-workarounds-used-by-hacky-merchants---what-are-they-doing-differently)
- [Shopify Review 2026: Plan Pricing & Transaction Fees](https://sonary.com/reviews/shopify/)
- [Shopify Problems & Issues 2026](https://www.tryorbye.com/products/shopify)
- [What Are the Disadvantages of Shopify? (2026)](https://solomediagroup.com/blogs/insights/shopify-disadvantages)
- [How Much Do Shopify Apps Cost? A Realistic 2026 Breakdown](https://merchant.tech/blog/shopify-app-costs-2026)
- [Shopify Editions Winter 2026](https://ecommerce-platforms.com/shopify/shopify-editions-winter-2026)
- [Shopify Editions Fall '26](https://shopify.com/editions/fall2026)
- [Shopify Spring '26 Edition](https://www.shopify.com/news/spring-26-edition-merchant)

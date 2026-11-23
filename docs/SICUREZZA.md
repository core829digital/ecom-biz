# Sicurezza: audit OWASP Top 10 (2025)

*Audit eseguito a novembre 2026 sul codice della piattaforma. Per ogni rischio: cosa è in atto, cosa è
stato corretto durante l'audit e cosa resta da fare. Le correzioni sono coperte da test automatici.*

| # | Rischio OWASP | Difese in atto | Corretto in questo audit |
|---|---|---|---|
| A01 | **Controllo degli accessi** | Ogni query filtrata per negozio; ogni azione server verifica sessione e ruolo (verificato in automatico su tutte le azioni); API con token e permessi granulari; token d'ordine non indovinabili | Una funzione Stripe era richiamabile dall'esterno senza controlli → resa interna. Redirect dopo il login aggirabile con `/\sito.com` → bloccato (test) |
| A02 | **Configurazione** | Header di sicurezza, nessuna versione esposta, errori senza dettagli tecnici | Il segreto di esempio di `.env.example` era accettato in produzione → rifiutato. **Il server non parte** con configurazione insicura (segreti deboli, email non configurata, gateway di test attivo, webhook Stripe senza segreto). Aggiunti HSTS e COOP |
| A03 | **Supply chain** | Versioni bloccate dal lockfile; `npm audit`: 0 vulnerabilità nelle dipendenze di produzione; font e script ospitati in proprio (solo Stripe.js esterno, come richiesto da Stripe) | — |
| A04 | **Crittografia** | Password bcrypt (12); token salvati solo come hash SHA-256; segreti 2FA cifrati AES-256-GCM; cookie `HttpOnly`/`Secure`/`SameSite`; HTTPS forzato | — |
| A05 | **Injection / XSS** | ORM con query parametrizzate (nessuna query "unsafe"); testo dei merchant mostrato senza HTML; CSP con nonce; protezione da formule nei CSV; upload validati per contenuto e serviti in sandbox | — |
| A06 | **Design insicuro** | Prezzi e totali ricalcolati sempre sul server; scorte decrementate in modo atomico; limiti di frequenza | Codice sconto a utilizzi limitati superabile con checkout simultanei → contatore atomico (test con 6 ordini in parallelo). Abuso della prova gratuita → vedi `ABBONAMENTI.md` |
| A07 | **Autenticazione** | Limiti tentativi (IP + email), tempi di risposta uniformi, 2FA TOTP con codici di recupero, sessioni revocabili, nuova sessione a ogni login | Password comuni (es. "password123") o con nome/email → rifiutate (NIST 800-63B). Email del merchant ora verificata |
| A08 | **Integrità di dati e software** | Webhook Stripe firmati e idempotenti; importo, riferimento **e valuta** verificati prima di creare un ordine | Firma dei webhook in uscita estesa al timestamp (anti-replay); verifica della valuta sui pagamenti; eventi di fatturazione prima ignorati ora gestiti |
| A09 | **Log e allerta** | Registro attività per negozio e piattaforma (login, falliti, 2FA, pagamenti, sospensioni) | In produzione le email non inviate non finiscono più nei log con i link di accesso dentro |
| A10 | **Gestione delle eccezioni** | Errori dei webhook → Stripe riprova; il limitatore in caso di guasto del database blocca invece di lasciar passare | Pagine di errore per negozio, piattaforma e livello globale: riprova, riferimento anonimo, nessun dettaglio tecnico |

## Header HTTP (verificati da un test automatico)

| Header | Valore | A cosa serve |
|---|---|---|
| Content-Security-Policy | nonce diverso a ogni richiesta, `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'self'` | Blocca gli script iniettati |
| Strict-Transport-Security | 2 anni, sottodomini inclusi (solo su HTTPS) | Mai più HTTP in chiaro |
| X-Frame-Options | SAMEORIGIN | Anti-clickjacking |
| X-Content-Type-Options | nosniff | I file non possono "travestirsi" da script |
| Referrer-Policy | strict-origin-when-cross-origin | Non espone URL interni ad altri siti |
| Permissions-Policy | fotocamera, microfono, posizione, USB… disattivati | Riduce la superficie d'attacco |
| Cross-Origin-Opener-Policy | same-origin-allow-popups | Isola la finestra (il popup 3-D Secure continua a funzionare) |

## Cosa resta da fare (in ordine di priorità)

1. **Penetration test esterno** prima del lancio commerciale. Un audit interno, anche accurato, non
   sostituisce un controllo indipendente.
2. **Monitoraggio e allerta** (es. Sentry per gli errori, un uptime monitor su `/api/health`) con
   notifica a te in caso di picchi di login falliti o errori di pagamento.
3. **Backup cifrati con test di ripristino** periodici (vedi `DEPLOY-PRODUZIONE.md`).
4. **Preload HSTS** (iscrizione su hstspreload.org) quando il dominio definitivo è stabile: è una
   scelta difficile da annullare, quindi va presa consapevolmente.
5. `style-src 'unsafe-inline'` è necessario per le animazioni; il rischio è basso perché gli script
   restano bloccati dal nonce.

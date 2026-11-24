# Avviare la piattaforma sul proprio computer

Guida passo passo per far girare la piattaforma in locale (ambiente di sviluppo), su **Windows** o
**Mac**. Non servono competenze tecniche: basta copiare i comandi uno alla volta.

> **Come usare i comandi.** Ogni riquadro grigio contiene **un** comando: copialo, incollalo nel
> terminale (Windows: **PowerShell**; Mac: **Terminale**) e premi Invio. Aspetta che finisca prima
> di passare al successivo.

---

## Windows

### 1. WSL (sottosistema Linux di Windows)

Docker su Windows ha bisogno di WSL 2.

1. Se non l'hai ancora installato, apri PowerShell **come amministratore** (tasto destro → "Esegui
   come amministratore") e lancia:
   ```powershell
   wsl --install
   ```
2. **Riavvia il computer.** È obbligatorio: WSL attiva funzioni di Windows che entrano in vigore
   solo dopo il riavvio.
3. Dopo il riavvio, apri PowerShell (normale) e lancia:
   ```powershell
   wsl --update
   ```
   ```powershell
   wsl --status
   ```
   Deve comparire **"Versione predefinita: 2"** (o "Default Version: 2").

Se dopo il riavvio si apre una finestra Ubuntu che chiede nome utente e password, scegline pure
una qualsiasi: per questo progetto non serve.

### 2. Controllare la virtualizzazione

1. Apri **Gestione attività** (Ctrl + Shift + Esc).
2. **Prestazioni** → **CPU**.
3. In basso a destra deve esserci **Virtualizzazione: Abilitato**.

Se c'è scritto "Disabilitato", va attivata nel BIOS del computer (voce "Intel VT-x",
"Virtualization Technology" o "AMD SVM", a seconda del processore). Senza, Docker non parte.

### 3. Docker Desktop

1. Scarica **Docker Desktop per Windows** da <https://www.docker.com/products/docker-desktop/>.
   Quasi sempre è la versione **AMD64**; prendi "ARM64" solo se il PC ha un processore Snapdragon.
2. Durante l'installazione lascia spuntato **"Use WSL 2 instead of Hyper-V"**.
3. Se a fine installazione chiede di uscire dall'account o riavviare, fallo.
4. Apri **Docker Desktop**, accetta i termini; il login non serve (**"Skip"** / **"Continue
   without signing in"**).
5. Aspetta che in basso a sinistra compaia **"Engine running"** in verde.

Verifica:
```powershell
docker run hello-world
```
Se compare **"Hello from Docker!"**, Docker è pronto.

### 4. Node.js e Git

- **Node.js**: da <https://nodejs.org> scegli la **versione 22** (quella usata e verificata dal
  progetto) e installa con le opzioni predefinite.
- **Git**: da <https://git-scm.com> scarica la versione per Windows e installa con le opzioni
  predefinite.

**Chiudi e riapri PowerShell**, poi verifica:
```powershell
node -v
```
```powershell
git --version
```
Il primo deve rispondere `v22.` seguito da altri numeri.

Se `npm` dà l'errore *"l'esecuzione di script è disabilitata in questo sistema"*, lancia una volta
sola (alla domanda rispondi `S` o `Y`):
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 5. Prima installazione del progetto

Tutto in **PowerShell** (non dentro Ubuntu/WSL).

```powershell
cd $HOME\Documents
```
```powershell
git clone https://github.com/core829digital/ecom-biz.git
```
```powershell
cd ecom-biz
```
```powershell
copy .env.example .env
```
Avvia il database (credenziali e porta coincidono già con il file `.env`):
```powershell
docker run --name ecom-db -e POSTGRES_USER=commerce -e POSTGRES_PASSWORD=commerce -e POSTGRES_DB=commerce -p 5432:5432 -d postgres:16-alpine
```
Installa le dipendenze (può richiedere qualche minuto; alla fine non devono comparire righe con `ERR!`):
```powershell
npm ci
```
Crea le tabelle del database:
```powershell
npm run db:deploy
```
Carica i piani e il negozio demo:
```powershell
$env:SEED_DEMO="true"; npm run db:seed
```
Avvia il server:
```powershell
npm run dev
```

### 6. Le volte successive

1. Apri **Docker Desktop** e aspetta "Engine running".
2. In PowerShell:
   ```powershell
   cd $HOME\Documents\ecom-biz
   ```
   ```powershell
   docker start ecom-db
   ```
   ```powershell
   npm run dev
   ```

---

## Mac

1. Installa **Docker Desktop per Mac** da <https://www.docker.com/products/docker-desktop/>
   (scegli "Apple Silicon" per i Mac M1/M2/M3/M4, "Intel" per quelli più vecchi), aprilo e aspetta
   "Engine running".
2. Installa **Node.js 22** da <https://nodejs.org>.
3. Git è già presente sul Mac (al primo uso può chiederti di installare gli "Strumenti da riga di
   comando": accetta).

Poi, nel **Terminale**:
```bash
cd ~/Documents
```
```bash
git clone https://github.com/core829digital/ecom-biz.git
```
```bash
cd ecom-biz
```
```bash
cp .env.example .env
```
```bash
docker run --name ecom-db -e POSTGRES_USER=commerce -e POSTGRES_PASSWORD=commerce -e POSTGRES_DB=commerce -p 5432:5432 -d postgres:16-alpine
```
```bash
npm ci
```
```bash
npm run db:deploy
```
```bash
SEED_DEMO=true npm run db:seed
```
```bash
npm run dev
```

Le volte successive: apri Docker Desktop, poi `cd ~/Documents/ecom-biz`, `docker start ecom-db`,
`npm run dev`.

---

## Usare la piattaforma

Quando nel terminale compare **`Ready`**, apri il browser:

| Cosa | Indirizzo | Accesso |
|---|---|---|
| Pannello merchant | <http://localhost:3000> | `demo@example.com` / `demo12345` |
| Negozio demo | <http://demo.localhost:3000> | oppure <http://localhost:3000/sites/demo> |

Per diventare **amministratore della piattaforma** (area `/platform`):
```bash
npm run platform:admin -- tua@email.com "Nome Cognome" unapasswordsicura
```

Per **fermare** il server: nel terminale dove gira, premi **Ctrl + C**.

## Aggiornare alla versione più recente

Con il server fermo:
```bash
git pull
```
```bash
npm ci
```
```bash
npm run db:deploy
```
Poi di nuovo `npm run dev`.

## Da sapere

- **Le email non partono davvero in locale.** Vengono stampate nel terminale dove gira
  `npm run dev`: lì trovi i link di verifica dell'account e di reset password.
- **Pagamenti senza Stripe:** al checkout ci sono contrassegno, bonifico e un metodo di pagamento
  di prova (solo in sviluppo). Per provare le carte vere servono le chiavi Stripe **di test** nel
  file `.env` (vedi [`ABBONAMENTI.md`](ABBONAMENTI.md)).
- **Il server di sviluppo è più lento della produzione** alla prima apertura di ogni pagina,
  perché la compila al momento. È normale.
- **Il file `.env` non va mai condiviso né caricato su GitHub** (è già escluso automaticamente):
  in futuro conterrà chiavi segrete.

## Problemi comuni

| Messaggio / sintomo | Causa | Soluzione |
|---|---|---|
| `docker: command not found` / "impossibile trovare docker" | Docker Desktop non è aperto o PowerShell era già aperto prima dell'installazione | Apri Docker Desktop, poi chiudi e riapri PowerShell |
| "Virtualization support not detected" | Virtualizzazione disattivata | Attivala nel BIOS (vedi punto 2 di Windows) |
| `Conflict. The container name "/ecom-db" is already in use` | Il database è già stato creato | Usa `docker start ecom-db` invece di `docker run …` |
| `port is already allocated` sulla 5432 | Sul computer gira già un altro PostgreSQL | Fermalo, oppure crea il database su un'altra porta (es. `-p 5433:5432`) e cambia `5432` in `5433` nella riga `DATABASE_URL` del file `.env` |
| `Can't reach database server at localhost:5432` | Il database è spento | `docker start ecom-db` (con Docker Desktop aperto) |
| `Port 3000 is in use` | Un altro server è già avviato | Chiudi l'altro terminale con `npm run dev`, oppure usa `npm run dev -- -p 3001` |
| "l'esecuzione di script è disabilitata" | Criterio di sicurezza di PowerShell | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `Need to install the following packages: prisma@…` oppure errori tipo "is a Prisma 7 command and is not available in Prisma 8" | Le dipendenze del progetto non sono installate (`npm ci` non eseguito, fallito, o lanciato in un'altra cartella): `npx` scarica allora l'ultima versione di Prisma da internet, che non è quella del progetto | Rispondi **n**, **non** seguire i suggerimenti del messaggio. Entra nella cartella `ecom-biz`, lancia `npm ci` e controlla che finisca senza errori, poi usa `npm run db:deploy` |
| `demo.localhost` non si apre | Browser che non riconosce `*.localhost` | Usa <http://localhost:3000/sites/demo> |

Per ripartire da zero con il database (cancella **tutti** i dati locali):
```bash
docker rm -f ecom-db
```
Poi ripeti dal comando `docker run …` in avanti.

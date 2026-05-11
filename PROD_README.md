# DELTAgroup – Concetti di Sicurezza

Webapp per la generazione e modifica di Concetti di Sicurezza DELTAgroup Security & Services AG.

## Struttura progetto

```
├── index.html          ← pagina HTML principale
├── package.json        ← dipendenze Node
├── vite.config.js      ← configurazione Vite
├── .gitignore
├── api/
│   └── generate.js     ← proxy serverless (chiave API protetta)
└── src/
    ├── main.jsx        ← entry point React
    └── App.jsx         ← applicazione completa
```

## Deploy su Vercel (procedura completa)

### 1. Carica su GitHub
- Crea un nuovo repository su github.com/new
- Carica tutti i file mantenendo la struttura delle cartelle
  - Per creare cartelle: nel campo nome file scrivi `api/generate.js` o `src/App.jsx`

### 2. Collega Vercel
- Vai su vercel.com → accedi con il tuo account GitHub
- Clicca "New Project" → seleziona il repository
- Vercel rileva Vite automaticamente → clicca "Deploy"

### 3. Aggiungi la chiave API Anthropic (FONDAMENTALE)
- Nel progetto Vercel → Settings → Environment Variables
- Aggiungi:
  - **Name**: `ANTHROPIC_API_KEY`
  - **Value**: la tua chiave API (inizia con `sk-ant-...`)
  - Seleziona tutti gli ambienti (Production, Preview, Development)
- Clicca "Save" → poi "Redeploy" nel tab Deployments

### Dove ottenere la chiave API Anthropic
- Vai su console.anthropic.com
- Registra un account (se non ce l'hai)
- API Keys → Create Key
- Copia la chiave e incollala in Vercel come sopra

## Sviluppo locale (opzionale)

Installa Node.js da nodejs.org, poi:

```bash
npm install
npx vercel dev    # simula anche le funzioni serverless
```

Apri http://localhost:3000

## Aggiornamenti

Ogni volta che modifichi un file e lo carichi su GitHub, Vercel rideploya automaticamente in ~1 minuto.

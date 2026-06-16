# STATO PROGETTO — DELTAgroup CS-PPS
> Documento autosufficiente per ripresa sviluppo in nuova chat.
> Aggiornato: 17 giugno 2026.

---

## 1. Cos'è l'app

**DELTAgroup CS-PPS** è una piattaforma operativa con due moduli:

**CS — Concetti di Sicurezza:** wizard 5 step per generare, personalizzare ed esportare Concetti di Sicurezza per eventi pubblici (AI-assisted, export DOCX + PDF).

**PPS — Prescrizioni Particolari di Servizio:** wizard 7 step per creare PPS operative per ogni servizio/cliente. Archivio per cliente, sistema lock/versioning, audit log.

**URL live:** https://delt-agroup-cs.vercel.app
**Repo:** https://github.com/marcopoletti78-blip/DELTAgroup-CS
**Branch:** main

---

## 2. Stack

- React + Vite — SPA
- Supabase (Zurigo) — database + autenticazione + storage
- Vercel — hosting + serverless functions
- Anthropic API (claude-sonnet-4-6) — AI per CS e PPS
- PWA — installabile su iOS/Android/Desktop
- Libreria docx — export DOCX

**Cartella locale:** C:\Dev\DELTAgroup-CS
**Claude Code:** cmd.exe → cd C:\Dev\DELTAgroup-CS → claude

---

## 3. Environment Variables (Vercel)

VITE_SUPABASE_URL = https://blgnedshzytctgtussda.supabase.co
VITE_SUPABASE_ANON_KEY = chiave pubblica Supabase
SUPABASE_SERVICE_ROLE_KEY = chiave segreta (solo api/admin-users.js)
VITE_ANTHROPIC_API_KEY = AI lato client (PPS wizard)
ANTHROPIC_API_KEY = AI lato server (api/generate.js)

---

## 4. File structure

src/
  main.jsx
  App.jsx                    — routing + autenticazione + AdminPanel
  supabaseClient.js          — client Supabase (stub se env mancanti)
  buildDocx.js               — generatore DOCX Concetti di Sicurezza
  buildPpsPdf.js             — generatore PDF PPS (pdfmake) · 449 righe
  assets/
    logo.jpg
  features/
    pps/
      PpsWizard.jsx          — wizard 7 step + lock + audit + PpsDocView · 1058 righe
      PpsList.jsx            — archivio per cliente accordion · 309 righe
      buildPpsDocx.js        — generatore DOCX PPS

### Versioni file modificati il 17/06/2026 (wc -l)
- src/buildPpsPdf.js — 449 righe
- src/features/pps/PpsWizard.jsx — 1058 righe
- src/features/pps/PpsList.jsx — 309 righe

api/
  generate.js                — proxy Anthropic per CS
  admin-users.js             — gestione utenti (ES Module)

public/
  manifest.json              — PWA config
  logo.jpg                   — icona PWA
  icon-pwa.png               — icona triangolo blu 512x512

---

## 5. Database Supabase

Tutte le tabelle: RLS disabilitata. GRANT ALL a anon e authenticated su ogni tabella.

### Tabella pps
- id: uuid PK (gen_random_uuid())
- codice: text
- cliente: text
- luogo: text
- tipo_servizio: text
- versione: int (default 1)
- stato: text
- contenuto: jsonb (tutti i dati del wizard)
- bloccata: boolean (default false)
- bloccata_da: text (email admin che ha bloccato)
- bloccata_il: timestamptz
- updated_at: timestamptz

### Tabella pps_audit
- id: uuid PK
- pps_id: uuid FK → pps(id) ON DELETE SET NULL (riconfigurata 17/06/2026: conserva il log dopo eliminazione PPS)
- utente_email: text
- azione: text (aperto / modificato / bloccato / sbloccato / copiato / creato / eliminato)
- dettagli: jsonb (per "eliminato" contiene codice e cliente della PPS rimossa)
- created_at: timestamptz

### Tabella pps_servizi (foundation per integrazione PLAN)
- id: uuid PK
- pps_id: uuid FK → pps(id) ON DELETE CASCADE
- servizio_id: text (ID servizio in app PLAN)
- cliente: text
- dipendente_id: text
- dipendente_nome: text
- created_by: text
- created_at: timestamptz

### Tabella pps_letture (foundation per conferma lettura agenti)
- id: uuid PK
- pps_id: uuid FK → pps(id) ON DELETE CASCADE
- servizio_id: text
- dipendente_id: text (NOT NULL)
- dipendente_nome: text
- dispositivo: text
- letto_il: timestamptz

### Tabella cs_documenti
Salvataggio CS su Supabase in parallelo a localStorage.

### Tabella profili
- id: uuid FK → auth.users
- email: text
- nome: text
- ruolo: text (admin / utente)
- attivo: boolean
- created_at: timestamptz

### Storage bucket pps-foto
Pubblico, policy anon SELECT/INSERT/DELETE. Upload foto allegate alle PPS.

---

## 6. Autenticazione

- Supabase Auth (email + password)
- Nessuna self-registration — utenti creati solo da admin via AdminPanel
- Ruoli: admin (accesso completo) / utente (solo PPS, no elimina, no sblocca)
- Utenti attivi: marco.poletti@delta.ch (admin), paolo.manasseri@delta.ch (admin)
- LoginPage mostrata se sessione assente

---

## 7. Routing App.jsx

- login → LoginPage (se !sessione)
- home → LandingHome (2 card: CS / PPS)
- cs-home / cs-list / wizard / modify / preview → CS flow
- pps-list → PpsList (archivio per cliente, default PPS)
- pps-edit → PpsWizard (onOpen(id) o onNew)
- admin → AdminPanel (solo admin)

---

## 8. Modulo PPS — Wizard 7 step

1. Dati servizio (codice, cliente, luogo, data, orario, tipo, agenti)
2. Situazione (textarea + AI)
3. Compiti (lista + differenze PGS + AI)
4. Pericoli particolari (tabella: Pericolo / Conseguenze / Misure)
5. Dettagli operativi (divisa, equipaggiamento, radio, ecc.)
6. Referenti (nome, ruolo, tel, email)
7. Allegati/Foto (upload, resize 1200px, Supabase Storage, didascalia)

### Funzionalità aggiunte il 17/06/2026
- Generazione PDF con pdfmake: titolo centrato, box agenti con bullet compiti separati, firma, page break (sezioni e box agenti unbreakable)
- Generazione compiti via AI con bullet su newline (formato "AGENTE N (orario): Ruolo — compiti", un compito per riga)
- Delete PPS admin-only con audit trail (FK pps_audit.pps_id → ON DELETE SET NULL, codice/cliente salvati nei dettagli)
- Versionamento: v+1 automatico su unlock+save (PPS già validata almeno una volta)

---

## 9. Sistema Lock/Versioning PPS

- bloccata=false → wizard modificabile + bottone [Valida]
- bloccata=true → PpsDocView (vista documento sola lettura):
  - Riepilogo documento + bottone [Scarica DOCX]
  - [Crea copia] → nuova riga versione+1, bloccata=false
  - [Sblocca] (solo admin) → torna al wizard
- Ogni azione registrata in pps_audit (helper logAudit top-level)

---

## 10. Archivio PPS — PpsList

- Accordion per cliente (chiuso default)
- Ricerca per nome cliente
- Per ogni cliente espanso:
  - Sezione "In lavorazione" (bloccata=false) — bordo sx #1E40AF
  - Sezione "Validate" (bloccata=true) — sfondo grigio
- Azioni disponibili:
  - Tutte: [Modifica/Vedi →]
  - In lavorazione (admin): [Valida]
  - Validate: [Crea copia]
  - Validate (admin): [Sblocca]

---

## 11. AdminPanel

- Lista utenti con toggle attivo/ruolo
- Form aggiungi nuovo utente (chiama api/admin-users.js)
- Sezione "Attività recenti PPS" (ultimi 50 record pps_audit con join pps)

---

## 12. PWA

- public/manifest.json: name "DELTAgroup CS-PPS", short_name "CS-PPS", theme_color #1E40AF
- Installabile: iOS Safari / Android Chrome / Desktop Chrome
- Responsive: hook isMobile (window.innerWidth < 768) in App.jsx
- isMobile passato come prop ai componenti principali

---

## 13. Dati aziendali fissi (header/footer documenti e app)

DELTAgroup Security & Services AG
Via alla Foce 4, 6933 Muzzano
T +41 91 921 49 49
TICINO@delta.ch

Colori brand:
- AC = #1E40AF (blu — colore identitario CS-PPS)
- GL = #f8f9fa (grigio chiaro sfondo)

---

## 14. Convenzioni critiche — NON VIOLARE MAI

1. MAI componenti React dentro altri componenti — causa bug di focus e re-mount. Tutti i componenti top-level del modulo.
2. npm run build → 0 errori obbligatori prima di ogni push.
3. Stili inline JSX — nessun file CSS separato.
4. Lingua italiana — label, messaggi, placeholder, prompt AI.
5. CHF — nessun riferimento a EUR.
6. supabaseClient.js — deve avere stub thenable se env vars mancanti (per build locale senza .env).
7. api/admin-users.js è ES Module: usare import/export, non require/module.exports.
8. Validare sempre con npm run build prima di dichiarare il lavoro completato.

---

## 15. Sequenza deploy

1. npm run build (0 errori obbligatori)
2. git add .
3. git commit -m "descrizione"
4. git push
5. Vercel → stato Ready (~2 min)
6. Verificare su delt-agroup-cs.vercel.app

---

## Commit recenti (sessione 17/06/2026)

- 6aa6e57 — feat: visual upgrade PDF PPS
- 7fd7c20 — fix: prompt AI compiti + doAiCompiti + max_tokens
- f563e01 — fix: validità unbreakable (header già ok)
- 1798d5c — feat: delete PPS admin-only, versioning
- 4c3a3fc — fix: ripristino audit eliminazione (FK SET NULL)

---

## 16. Coda sviluppo

### Completato
- Modulo PPS completo (wizard 7 step, DOCX, Supabase)
- Autenticazione Supabase Auth + profili + AdminPanel
- Archivio CS su Supabase (cs_documenti)
- Lock/versioning PPS (bloccata, pps_audit)
- Archivio PPS per cliente (accordion In lavorazione/Validate)
- Vista documento PpsDocView per PPS bloccate
- PWA installabile (manifest, meta tag mobile)
- Responsive mobile (isMobile hook)
- Footer telefono corretto: +41 91 921 49 49
- Foundation DB integrazione PLAN (pps_servizi, pps_letture)
- [x] Creare src/buildPpsPdf.js (generatore PDF pdfmake)
- [x] Visual upgrade PDF PPS
- [x] Delete admin-only
- [x] Versioning

### In sospeso
- Icona PWA triangolo blu (commit recente, verificare su telefono)
- Dominio Vercel: rimasto delt-agroup-cs (rinominato progetto ma URL non cambia)
- [ ] Aggiornare PpsWizard.jsx con campi emergenze strutturati (emergenze, emergenza_nota, standard_condotta come array separati)
- [ ] Riordino sottocapitoli CS (bug ▲▼)
- [ ] Modifica impostazioni evento dall'editor CS

### Prossimo — Integrazione CS-PPS con PLAN (progetto separato)
Foundation DB già pronta (tabelle pps_servizi e pps_letture create il 14/06/2026).
Flusso da implementare:
1. API CS-PPS: endpoint GET /pps?cliente=X (lista PPS bloccate per cliente)
2. App PLAN: bottone "Aggiungi PPS" → chiama API → insert pps_servizi
3. App agente mobile: vede PPS collegate al servizio → legge → conferma → insert pps_letture
4. CS-PPS admin: sezione "Conferme lettura" (chi ha letto, quando, da quale dispositivo)

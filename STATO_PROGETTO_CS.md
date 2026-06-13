# Stato del progetto — DELTAgroup CS / PPS

> Ultimo aggiornamento: **giugno 2026** (2026-06-13)
> Branch: `main` · Ultimo commit rilevante: `736e3e0`

Applicazione web (React + Vite) di DELTAgroup Security & Services AG (Filiale Ticino).
La piattaforma ospita **due moduli** dietro una landing comune:

- **CS — Concetti di Sicurezza** (modulo storico, generazione/modifica via AI + DOCX/stampa)
- **PPS — Prescrizioni Particolari di Servizio** (modulo nuovo, wizard 7 step + persistenza Supabase + foto)

---

## 1. Versioni file in produzione

| File | Righe | Note |
|------|------:|------|
| `src/App.jsx` | ~3532 | Aggiunti **LandingHome** (primo schermo) e **CsHome** (sotto-menu CS in stile landing); routing esteso a `home / cs-home / wizard / modify / preview / pps-list / pps-edit`; Header nascosto nella landing; tema blu (`AC = #1E40AF`). |
| `src/buildDocx.js` | ~1145 | **Header DOCX CS rifatto** in stile DELTAgroup (tabella logo + nome evento/anno, divisore blu). Resto invariato. |
| `src/supabaseClient.js` | ~40 | **Nuovo.** Client Supabase resiliente (stub se env mancanti). |
| `src/features/pps/PpsWizard.jsx` | ~632 | **Nuovo.** Wizard PPS a **7 step** + Supabase (salva/carica) + assist AI + upload foto. |
| `src/features/pps/PpsList.jsx` | ~173 | **Nuovo.** Archivio PPS da Supabase (lista, apri, elimina). |
| `src/features/pps/buildPpsDocx.js` | ~472 | **Nuovo.** Generatore DOCX PPS a **8 sezioni**, tabelle full-width a layout fisso, header stile DELTAgroup, allegati foto. |
| `api/generate.js` | 54 | Invariato. Proxy Edge verso Anthropic. |

---

## 2. Infrastruttura

### Supabase — progetto `deltagroup-cs` (regione Zurigo)
- **Tabella `pps`** (con **GRANT** ai ruoli anon/authenticated + RLS): colonne
  `id`, `codice`, `cliente`, `luogo`, `tipo_servizio`, `versione`, `stato`,
  `contenuto` (jsonb), `updated_at` (timestamptz, trigger di aggiornamento).
- **Bucket Storage `pps-foto`** (pubblico) con **policy** select/insert/delete per
  la anon key. Path foto: `pps-foto/<ppsId>/<timestamp>-<file>`.
- Dipendenza: `@supabase/supabase-js` **`^2.108.1`**.

### Variabili d'ambiente (Vercel)
| Variabile | Uso |
|-----------|-----|
| `VITE_SUPABASE_URL` | URL progetto Supabase (build-time) |
| `VITE_SUPABASE_ANON_KEY` | Chiave anonima (RLS) (build-time) |
| `ANTHROPIC_API_KEY` | Proxy `api/generate.js` (server-side) |

> Le `VITE_*` sono **inlined a build-time**: dopo modifiche su Vercel serve un
> **redeploy**. In dev locale richiedono un `.env` (git-ignorato); senza, il modulo
> PPS mostra "Supabase non configurato" ma landing e CS funzionano comunque
> (stub resiliente in `supabaseClient.js`).

---

## 3. Struttura del codice

### `src/App.jsx`
- **`LandingHome`** (top-level) — primo schermo "Piattaforma Operativa": sfondo
  `#EEF2FF`, due card (CS / PPS) con icone SVG, hover, layout responsive (`1fr`
  sotto 700px), footer recapiti. Header dell'app nascosto qui.
- **`CsHome`** (top-level) — sotto-menu CS nello **stesso stile della landing**:
  pulsante "← Home", titolo "Concetti di Sicurezza" + "DELTAgroup Ticino", due card
  ("Nuovo Concetto" → `onNew`, "Modifica Esistente" → `onMod`). Nessuna card PPS.
- **Routing**: `home → LandingHome` (`onCs → cs-home`, `onPps → pps-list`);
  `cs-home → CsHome`; `wizard / modify / preview` (flusso CS); `pps-list → PpsList`;
  `pps-edit → PpsWizard`.
- Tema blu `AC = #1E40AF` (rosso `RD` riservato a errori).

### `src/buildDocx.js` (CS)
- **Header stile DELTAgroup**: tabella 2 colonne (10206 DXA, `[3600, 6606]`, layout
  fisso) — logo a sinistra con bordo destro, a destra `{nomeEvento}` (bold 11pt) e
  "Concetto di Sicurezza · {anno}" (9pt grigio) — + divisore con bordo inferiore blu.
- Tutto il resto (cover, TOC, sezioni ps1–ps6, allegati, numerazione) invariato.

### `src/features/pps/PpsList.jsx`
- Archivio Supabase: tabella **Codice · Cliente · Luogo · Tipo · Stato (badge) ·
  Versione · Aggiornato il**; nuova/apri/elimina; stati loading/vuoto/errore.

### `src/features/pps/PpsWizard.jsx` — **7 step**
1. **Dati servizio** — codice, numero cliente, cliente, luogo, data, orari, tipo, agenti, note.
2. **Situazione** — textarea + **✨ Genera con AI** (`/api/generate`, `claude-sonnet-4-6`).
3. **Compiti** — lista add/remove + "Differenze rispetto alle PGS" + **✨ Genera con AI**.
4. **Pericoli** — tabella Pericolo / Conseguenze / Misure (righe aggiungibili).
5. **Dettagli** — divisa, equipaggiamento (lista), canale radio, vettovagliamento, parcheggio, note operative.
6. **Referenti** — nome / ruolo / telefono / email.
7. **Allegati / Foto** — upload su **Supabase Storage** (`pps-foto`): resize canvas 1200px/JPEG 0.85, max 5, didascalie, eliminazione; richiede PPS già salvata.
- Persistenza Supabase (insert/update + `contenuto` jsonb), retrocompatibilità al caricamento, salvataggio in ogni step.

### `src/features/pps/buildPpsDocx.js` — DOCX a **8 sezioni**
- Header stile DELTAgroup (logo + dati servizio); numerazione **dinamica** (niente
  buchi); tabelle **full-width 10206 DXA** a **layout fisso** (word wrap).
- Sezioni: 1 Dati · 2 Situazione · 3 Compiti (+ Differenze PGS) · 4 Pericoli ·
  5 Dettagli · 6 Referenti · 7 Validità (testo fisso) · **8 Allegati — Foto**
  (immagini scaricate da Supabase Storage, adattate alla pagina).

---

## 4. Cosa fa l'app oggi

- **Landing "Piattaforma Operativa"** con scelta tra due moduli (CS / PPS).
- **CS — Concetti di Sicurezza**: wizard di creazione (AI), modifica di un concetto
  esistente (AI), anteprima, riordino sezioni, export **DOCX** (header rinnovato) e stampa/PDF.
- **PPS — Prescrizioni Particolari di Servizio** (completo): wizard 7 step, salvataggio
  e ricarica da **Supabase**, archivio documenti, assist **AI** (situazione/compiti),
  **foto sopralluogo** su Supabase Storage, export **DOCX** a 8 sezioni.
- **Storico CS**: ⚠️ **non ancora implementato** — i documenti CS vivono ancora in
  `localStorage` (chiave unica per ultimo documento). Previsto per la prossima sessione.

---

## 5. Coda di sviluppo

### ✅ Completato
- **Modulo PPS** (wizard 7 step + Supabase + foto + DOCX) — *spostato da priorità immediata*.
- Landing Piattaforma Operativa, CsHome in stile landing, tema blu.
- Header DOCX (CS e PPS) in stile DELTAgroup; tabelle PPS full-width a layout fisso.
- Infrastruttura Supabase (tabella `pps`, bucket `pps-foto`, env Vercel).

### 🔜 Priorità immediata
- **Storico CS**: tabella `cs_documenti` su Supabase, lista documenti CS, **migrazione
  da `localStorage`** verso Supabase (allineare il CS al pattern del PPS).

### Possibili passi successivi
- Campo `stato` PPS modificabile dalla UI (bozza → approvata → attiva → archiviata).
- Versionamento incrementale al salvataggio.
- Ricerca / filtri nella lista PPS.
- Versionare lo **script SQL reale** (DDL + trigger + RLS + GRANT + policy Storage) in repo (`supabase/schema.sql`).
- Code-splitting: il bundle JS supera 500 kB (warning Vite, non bloccante).

---

## 6. Cronologia commit (sessione giugno 2026)

```
736e3e0 fix: CsHome stile aggiornato + header DOCX CS stile PPS
90566e9 fix: tabelle DOCX layout fisso - word wrap celle
af672d2 feat: Fase 3 PPS - allegati foto su Supabase Storage
6e6c2df fix: rimuovi bordo sinistro intestazioni sezione
dde83e6 fix: DOCX larghezza tabelle corretta + intestazioni sezione
c72d59d fix: header DOCX stile DELTAgroup con logo e dati servizio
bf10374 fix: DOCX tabelle full-width e word wrap celle
e6b900c fix: DOCX tabelle full-width, word wrap, header migliorato
3ca807c fix(pps-docx): numerazione sezioni dinamica + Note operative nei dettagli
8bae329 feat: wizard PPS 6 step - situazione, pericoli, dettagli, AI
0e21c66 fix: supabaseClient resiliente a env mancanti (evita crash mount landing/CS)
8315878 feat: landing Piattaforma Operativa
cdc9f05 feat: modulo PPS con Supabase (lista + salva/carica)
af66021 style(home): card CS e PPS uniformate (stesso stampo)
089c616 refactor: tema blu CS-PPS, home ridisegnata, testo PPS corretto
ab89e5d feat(pps): nuovo modulo PPS/SPADO separato dal CS
```

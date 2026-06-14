# STATO PROGETTO — DELTAgroup CS-PPS
> Documento autosufficiente per ripresa sviluppo in nuova chat.
> Aggiornato: 14 giugno 2026.

---

## 1. Cos'è l'app

**DELTAgroup CS-PPS** è una piattaforma operativa con due moduli:

**CS — Concetti di Sicurezza:** wizard 5 step per generare, 
personalizzare ed esportare Concetti di Sicurezza per eventi 
pubblici (AI-assisted, export DOCX + PDF).

**PPS — Prescrizioni Particolari di Servizio:** wizard 7 step 
per creare PPS operative per ogni servizio/cliente. Archivio 
per cliente, sistema lock/versioning, audit log.

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

**Cartella locale:** C:\Users\pom\Desktop\DELTAgroup-CS
**Claude Code:** cmd.exe → cd C:\Users\pom\Desktop\DELTAgroup-CS → claude

---

## 3. Environment Variables (Vercel)

| Variabile | Uso |
|-----------|-----|
| VITE_SUPABASE_URL | https://blgnedshzytctgtussda.supabase.co |
| VITE_SUPABASE_ANON_KEY | chiave pubblica Supabase |
| SUPABASE_SERVICE_ROLE_KEY | chiave segreta (solo api/admin-users.js) |
| VITE_ANTHROPIC_API_KEY | AI lato client (PPS wizard) |
| ANTHROPIC_API_KEY | AI lato server (api/generate.js) |

---

## 4. File structure

---

## 5. Database Supabase

### Tabella `pps`
| Campo | Tipo | Note |
|-------|------|------|
| id | uuid PK | gen_random_uuid() |
| codice | text | codice servizio |
| cliente | text | nome cliente |
| luogo | text | |
| tipo_servizio | text | |
| versione | int | default 1 |
| stato | text | |
| contenuto | jsonb | tutti i dati del wizard |
| bloccata | boolean | default false |
| bloccata_da | text | email admin che ha bloccato |
| bloccata_il | timestamptz | |
| updated_at | timestamptz | |

### Tabella `pps_audit`
| Campo | Tipo | Note |
|-------|------|------|
| id | uuid PK | |
| pps_id | uuid FK | → pps(id) ON DELETE CASCADE |
| utente_email | text | |
| azione | text | aperto/modificato/bloccato/sbloccato/copiato/creato |
| dettagli | jsonb | |
| created_at | timestamptz | |

### Tabella `pps_servizi` (foundation per integrazione PLAN)
| Campo | Tipo | Note |
|-------|------|------|
| id | uuid PK | |
| pps_id | uuid FK | → pps(id) ON DELETE CASCADE |
| servizio_id | text | ID servizio in app PLAN |
| cliente | text | |
| dipendente_id | text | |
| dipendente_nome | text | |
| created_by | text | |
| created_at | timestamptz | |

### Tabella `pps_letture` (foundation per conferma lettura agenti)
| Campo | Tipo | Note |
|-------|------|------|
| id | uuid PK | |
| pps_id | uuid FK | → pps(id) ON DELETE CASCADE |
| servizio_id | text | |
| dipendente_id | text | |
| dipendente_nome | text | |
| dispositivo | text | |
| letto_il | timestamptz | |

### Tabella `cs_documenti`
Salvataggio CS su Supabase (in parallelo a localStorage).

### Tabella `profili`
| Campo | Tipo | Note |
|-------|------|------|
| id | uuid FK | → auth.users |
| email | text | |
| nome | text | |
| ruolo | text | admin / utente |
| attivo | boolean | |
| created_at | timestamptz | |

### Storage bucket `pps-foto`
Pubblico, policy anon SELECT/INSERT/DELETE. Upload foto allegate alle PPS.

### RLS
Disabilitata su tutte le tabelle. Sicurezza gestita da Supabase Auth.

### GRANT su tutte le tabelle
```sql
GRANT ALL ON TABLE [tabella] TO anon;
GRANT ALL ON TABLE [tabella] TO authenticated;
```

---

## 6. Autenticazione

- Supabase Auth (email + password)
- Nessuna self-registration — utenti creati solo da admin via AdminPanel
- Ruoli: **admin** (accesso completo) / **utente** (solo PPS, no elimina, no sblocca)
- Utenti attivi: marco.poletti@delta.ch (admin), paolo.manasseri@delta.ch (admin)
- LoginPage mostrata se sessione assente

---

## 7. Routing App.jsx

| View | Condizione | Componente |
|------|-----------|-----------|
| login | !sessione | LoginPage |
| home | default | LandingHome (2 card: CS / PPS) |
| cs-home | / cs-list / wizard / modify / preview | CS flow |
| pps-list | default PPS | PpsList (archivio per cliente) |
| pps-edit | onOpen(id) / onNew | PpsWizard |
| admin | solo admin | AdminPanel |

---

## 8. Modulo PPS — Wizard 7 step

1. Dati servizio (codice, cliente, luogo, data, orario, tipo, agenti)
2. Situazione (textarea + AI)
3. Compiti (lista + differenze PGS + AI)
4. Pericoli particolari (tabella: Pericolo | Conseguenze | Misure)
5. Dettagli operativi (divisa, equipaggiamento, radio, ecc.)
6. Referenti (nome, ruolo, tel, email)
7. Allegati/Foto (upload, resize 1200px, Supabase Storage, didascalia)

---

## 9. Sistema Lock/Versioning PPS

- **bloccata=false** → wizard modificabile + bottone [🔒 Valida]
- **bloccata=true** → PpsDocView (vista documento sola lettura):
  - Mostra riepilogo documento + [📄 Scarica DOCX]
  - [📋 Crea copia] → nuova riga versione+1, bloccata=false
  - [🔓 Sblocca] (solo admin) → torna al wizard
- Ogni azione registrata in pps_audit

---

## 10. Archivio PPS (PpsList)

- Accordion per cliente (chiuso default)
- Per ogni cliente espanso:
  - **✏️ In lavorazione** (bloccata=false) — bordo sx blu AC
  - **🔒 Validate** (bloccata=true) — sfondo grigio
- Ricerca per cliente
- Azioni: Modifica/Vedi, Valida/Sblocca (admin), Crea copia

---

## 11. AdminPanel

- Lista utenti con toggle attivo/ruolo
- Form aggiungi nuovo utente
- Sezione "📋 Attività recenti PPS" (ultimi 50 record pps_audit)

---

## 12. PWA

- manifest.json: name "DELTAgroup CS-PPS", short_name "CS-PPS"
- theme_color: #1E40AF
- Installabile: iOS (Safari → Aggiungi a schermata Home) / 
  Android (Chrome → Installa app) / Desktop (Chrome → icona +)
- Responsive: hook isMobile (<768px) in App.jsx

---

## 13. Dati aziendali fissi

**Colori brand:**
- AC = #1E40AF (blu — colore identitario CS-PPS)
- GL = #f8f9fa (grigio chiaro sfondo)

---

## 14. Convenzioni critiche

1. **MAI componenti React dentro altri componenti** — 
   bug di focus, re-mount. Tutti top-level del modulo.
2. **npm run build → 0 errori** prima di ogni push.
3. **Stili inline JSX** — no file CSS separati.
4. **Lingua italiana** — label, messaggi, prompt AI.
5. **CHF** — nessun EUR.
6. **supabaseClient.js** — stub thenable se env mancanti 
   (per build locale senza .env).
7. **api/admin-users.js** è ES Module (import/export, 
   non require/module.exports).

---

## 15. Deploy

---

## 16. Coda sviluppo

### Completato ✅
- Modulo PPS completo (wizard 7 step, DOCX, Supabase)
- Autenticazione Supabase Auth + AdminPanel
- Archivio CS su Supabase (cs_documenti)
- Lock/versioning PPS (bloccata, pps_audit)
- Archivio PPS per cliente (accordion In lavorazione/Validate)
- Vista documento PpsDocView per PPS bloccate
- PWA installabile (manifest, meta tag)
- Responsive mobile (isMobile hook)
- Footer telefono: +41 91 921 49 49

### In sospeso
- [ ] Icona PWA triangolo blu (commit recente, verificare)
- [ ] Dominio Vercel: delt-agroup-cs (rinominato ma URL non cambia)
- [ ] Riordino sottocapitoli CS (▲▼ non funzionano)

### Prossimo — Integrazione PLAN (progetto separato)
Foundation DB già pronta (pps_servizi, pps_letture).
Flusso da implementare:
1. API CS-PPS: GET /pps?cliente=X
2. PLAN: bottone "Aggiungi PPS" → collega a servizio
3. App agente: vede PPS → legge → conferma lettura
4. CS-PPS admin: vista "Conferme lettura"

---

*Aggiornato: 14 giugno 2026*

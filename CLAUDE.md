# DELTAgroup CS — Istruzioni per Claude Code

## Progetto
Generatore di documenti Concetto di Sicurezza (CS) per DELTAgroup Security & Services AG.
Interfaccia React per la compilazione guidata e l'esportazione DOCX di documenti di sicurezza.

## Stack tecnico
- **Frontend**: React + Vite + Tailwind CSS v3
- **Componenti**: shadcn/ui + Lucide React
- **Database**: Supabase (PostgreSQL + Auth)
- **Deploy**: Vercel
- **Repo**: marcopoletti78-blip/DELTAgroup-CS

## Regole di sviluppo
- Usa sempre TypeScript per i nuovi file
- Commenta il codice in italiano
- I componenti vanno in `src/components/`
- Usa Tailwind per tutti gli stili — niente CSS inline salvo casi eccezionali
- Preferisci componenti piccoli e riusabili a monoliti
- Niente `console.log` nel codice committato

## Design — cosa EVITARE
- Niente gradienti viola/blu generici come sfondo hero
- Niente card con shadow 8px e bordi arrotondati generici
- Niente font Inter o Roboto se non esplicitamente richiesti
- Niente layout a 3 colonne simmetriche come default
- Niente pulsanti con gradiente come stile primario
- Niente placeholder text tipo "Lorem ipsum"

## Design — stile target
- Minimal professionale, ispirato a design Swiss/corporate
- Palette: bianco `#ffffff`, grigio scuro `#1a1a1a`, accento DELTAgroup rosso `#DC2626`
- Tipografia pulita, gerarchia chiara, spaziatura generosa
- UI densa ma leggibile — è uno strumento B2B, non un landing page
- Tabelle e form ben strutturati, non decorativi

## MCP disponibili
- **figma**: usa per leggere design da Figma prima di implementare UI
- **context7**: usa per documentazione aggiornata di React/Tailwind/Supabase
- **github**: usa per gestire PR, issue e history del repo
- **magic**: usa `/ui [descrizione]` per generare componenti React/Tailwind professionali

## Workflow preferito
1. Leggi il codice esistente prima di modificare qualsiasi file
2. Per nuovi componenti UI: usa `/ui` con magic oppure importa il design da Figma
3. Usa context7 per verificare la sintassi corretta di Supabase/Tailwind v3
4. Commit atomici con messaggi chiari in inglese (es. `fix: correct nav redirect on save`)
5. Prima di ogni PR: verifica che la build non abbia errori con `npm run build`

## Comandi utili
```bash
npm run dev        # avvia dev server
npm run build      # build produzione
npm run preview    # preview build locale
```

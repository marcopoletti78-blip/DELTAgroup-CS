// Importazione documento PPS: carica un PDF o DOCX, lo invia a Claude per
// estrarre i campi della PPS e pre-compila il wizard.
import React, { useState, useRef } from "react";
import mammoth from "mammoth/mammoth.browser";

// ── Palette (allineata a PpsWizard / App) ────────────────────────────────────
const N = "#0c1d3d";
const AC = "#1E40AF";
const WH = "#ffffff";
const BG = "#f4f7fc";
const GL = "#edf1f8";
const GB = "#e5e7eb";
const TM = "#52637a";
const GR = "#9baab8";
const ERR = "#c8102e";
const OK = "#16a34a";
const SANS = { fontFamily: "system-ui, -apple-system, sans-serif" };
const SERIF = { fontFamily: "Georgia, 'Times New Roman', serif" };

const PROMPT_ESTRAZIONE = `Analizza questo documento e estrai le informazioni per compilare una PPS (Prescrizione Particolare di Servizio) di DELTAgroup Security & Services AG.

Rispondi SOLO con un oggetto JSON valido, nessun testo prima o dopo, nessun markdown:

{
  "codice": "codice o riferimento del servizio",
  "cliente": "nome del cliente",
  "luogo": "luogo del servizio",
  "data": "data o periodo del servizio",
  "orario_inizio": "ora inizio (es. 17:30)",
  "orario_fine": "ora fine (es. 02:00)",
  "tipo_servizio": "tipo di servizio",
  "agenti": "numero o descrizione agenti",
  "situazione": "descrizione generale del contesto e dell'evento",
  "compiti": ["compito 1", "compito 2"],
  "differenze_pgs": "eventuali differenze rispetto al piano generale di sicurezza",
  "pericoli": [
    {
      "pericolo": "nome del pericolo",
      "conseguenze": "conseguenze possibili",
      "misure": "misure preventive"
    }
  ],
  "divisa": "descrizione divisa richiesta",
  "equipaggiamento": "equipaggiamento richiesto",
  "radio_canale": "canale radio o comunicazioni",
  "vettovagliamento": "indicazioni vettovagliamento",
  "parcheggio": "indicazioni parcheggio",
  "referenti": [
    {
      "nome": "Nome Cognome",
      "ruolo": "ruolo",
      "tel": "numero telefono",
      "email": "email se presente"
    }
  ],
  "informazioni_aggiuntive": "tutte le informazioni presenti nel documento che non rientrano nei campi precedenti (procedure emergenza, standard condotta, note operative, ecc.) — testo libero"
}

Se un campo non è presente nel documento, usa null (non stringa vuota).`;

// Etichette per il riepilogo campi.
const FIELD_LABELS = {
  codice: "Codice", cliente: "Cliente", luogo: "Luogo", data: "Data",
  orario_inizio: "Orario inizio", orario_fine: "Orario fine",
  tipo_servizio: "Tipo servizio", agenti: "Agenti", situazione: "Situazione",
  compiti: "Compiti", differenze_pgs: "Differenze PGS", pericoli: "Pericoli",
  divisa: "Divisa", equipaggiamento: "Equipaggiamento", radio_canale: "Canale radio",
  vettovagliamento: "Vettovagliamento", parcheggio: "Parcheggio", referenti: "Referenti",
};

function isFilled(v) {
  if (v == null) return false;
  if (Array.isArray(v)) {
    return v.some((x) => {
      if (x == null) return false;
      if (typeof x === "object") return Object.values(x).some((s) => s != null && String(s).trim() !== "");
      return String(x).trim() !== "";
    });
  }
  return String(v).trim() !== "";
}

// Converte il JSON estratto nella struttura "contenuto" attesa da PpsWizard.
function mapToContent(e) {
  const equip = e.equipaggiamento == null
    ? [""]
    : Array.isArray(e.equipaggiamento)
      ? (e.equipaggiamento.length ? e.equipaggiamento : [""])
      : [String(e.equipaggiamento)];
  const compiti = Array.isArray(e.compiti)
    ? e.compiti.map((c) => String(c || "")).filter((s) => s.trim() !== "")
    : (e.compiti ? [String(e.compiti)] : []);
  const pericoli = Array.isArray(e.pericoli)
    ? e.pericoli.map((p) => ({ pericolo: p?.pericolo || "", conseguenze: p?.conseguenze || "", misure: p?.misure || "" }))
    : [];
  const referenti = Array.isArray(e.referenti)
    ? e.referenti.map((r) => ({ nome: r?.nome || "", ruolo: r?.ruolo || "", telefono: r?.tel || r?.telefono || "", email: r?.email || "" }))
    : [];
  return {
    codice: e.codice || "",
    cliente: e.cliente || "",
    luogo: e.luogo || "",
    data: e.data || "",
    orario_inizio: e.orario_inizio || "",
    orario_fine: e.orario_fine || "",
    tipo_servizio: e.tipo_servizio || "Pattuglia / Ronda",
    num_agenti: e.agenti || "",
    situazione: e.situazione || "",
    compiti: compiti.length ? compiti : [""],
    differenze_pgs: e.differenze_pgs || "",
    pericoli: pericoli.length ? pericoli : [{ pericolo: "", conseguenze: "", misure: "" }, { pericolo: "", conseguenze: "", misure: "" }],
    divisa: e.divisa || "",
    equipaggiamento: equip,
    radio_canale: e.radio_canale || "",
    vettovagliamento: e.vettovagliamento || "",
    parcheggio: e.parcheggio || "",
    note_operative: e.informazioni_aggiuntive || "",
    referenti: referenti.length ? referenti : [{ nome: "", ruolo: "", telefono: "", email: "" }],
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(new Error("Lettura file fallita"));
    fr.readAsDataURL(file);
  });
}

// Chiamata diretta all'API Claude (stesso pattern delle altre chiamate AI).
async function callClaude(messageContent) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: messageContent }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "Errore API");
  let t = String(d.content?.[0]?.text || "").trim();
  t = t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(t);
}

export default function PpsImport({ onBack, onOpenWizard, isMobile = false }) {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [err, setErr] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const accept = ".pdf,.docx";
  const isValid = (f) => /\.(pdf|docx)$/i.test(f?.name || "");

  const pick = (f) => {
    if (!f) return;
    if (!isValid(f)) { setErr("Formato non supportato. Carica un PDF o un DOCX."); return; }
    setErr(null); setExtracted(null); setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    pick(e.dataTransfer?.files?.[0]);
  };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true); setErr(null); setExtracted(null);
    try {
      let result;
      if (/\.pdf$/i.test(file.name)) {
        const base64 = await fileToBase64(file);
        result = await callClaude([
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: PROMPT_ESTRAZIONE },
        ]);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const { value: testo } = await mammoth.extractRawText({ arrayBuffer });
        if (!testo || !testo.trim()) throw new Error("Il documento DOCX risulta vuoto.");
        result = await callClaude(`${PROMPT_ESTRAZIONE}\n\n--- DOCUMENTO ---\n${testo}`);
      }
      setExtracted(result);
    } catch (e) {
      console.error("[PpsImport] analyze", e);
      setErr(`Errore durante l'analisi: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const dataFields = extracted ? Object.keys(FIELD_LABELS) : [];
  const filled = dataFields.filter((k) => isFilled(extracted?.[k]));
  const missing = dataFields.filter((k) => !isFilled(extracted?.[k]));
  const infoAgg = extracted?.informazioni_aggiuntive;

  const openWizard = () => {
    if (!extracted) return;
    onOpenWizard?.(mapToContent(extracted), missing.map((k) => FIELD_LABELS[k]));
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "32px 20px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        {/* Breadcrumb */}
        <button onClick={onBack} style={{ ...SANS, background: "none", border: "none", cursor: "pointer", color: TM, fontSize: "12.5px", fontWeight: 600, padding: 0, marginBottom: "10px" }}>
          ← Home › PPS › <span style={{ color: N, fontWeight: 700 }}>Importa</span>
        </button>
        <h1 style={{ ...SERIF, fontSize: "24px", fontWeight: 700, color: N, margin: "0 0 18px" }}>Importa documento PPS</h1>

        {/* Dropzone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          style={{
            ...SANS, border: `2px dashed ${drag ? AC : GB}`, borderRadius: "14px",
            background: drag ? "#eef2ff" : WH, padding: "40px 24px", textAlign: "center",
            cursor: "pointer", transition: "all 0.15s", marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>📄</div>
          <div style={{ fontSize: "14px", color: TM, fontWeight: 600 }}>
            Trascina qui un PDF o DOCX oppure clicca per selezionare
          </div>
          <div style={{ fontSize: "11.5px", color: GR, marginTop: "6px" }}>Formati: .pdf, .docx</div>
          <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }}
            onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        {/* File selezionato */}
        {file && (
          <div style={{ ...SANS, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", background: GL, border: `1px solid ${GB}`, borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", color: N, fontWeight: 600, wordBreak: "break-all" }}>📎 {file.name}</div>
            <button onClick={analyze} disabled={analyzing} style={{ ...SANS, padding: "10px 16px", background: AC, color: WH, border: "none", borderRadius: "8px", cursor: analyzing ? "wait" : "pointer", fontWeight: 700, fontSize: "13px" }}>
              {analyzing ? "Analisi in corso…" : "🔍 Analizza documento"}
            </button>
          </div>
        )}

        {/* Spinner analisi */}
        {analyzing && (
          <div style={{ ...SANS, textAlign: "center", padding: "28px", color: TM, fontSize: "13px" }}>
            <div style={{ fontSize: "26px", marginBottom: "8px" }}>⏳</div>
            Claude sta leggendo il documento…
          </div>
        )}

        {/* Errore */}
        {err && (
          <div style={{ ...SANS, padding: "12px 14px", background: "#fdeced", border: `1px solid ${ERR}55`, borderRadius: "10px", color: ERR, fontSize: "12.5px", marginBottom: "16px" }}>{err}</div>
        )}

        {/* Risultato */}
        {extracted && !analyzing && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ ...SANS, background: "#ecfdf5", border: `1px solid ${OK}55`, borderRadius: "12px", padding: "14px 16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#065f46", marginBottom: filled.length ? "6px" : 0 }}>
                ✅ {filled.length} campi compilati
              </div>
              {filled.length > 0 && (
                <div style={{ fontSize: "11.5px", color: "#047857" }}>{filled.map((k) => FIELD_LABELS[k]).join(" · ")}</div>
              )}
            </div>

            {missing.length > 0 && (
              <div style={{ ...SANS, background: "#fffbeb", border: "1px solid #f59e0b55", borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#92400e", marginBottom: "6px" }}>
                  ⚠️ {missing.length} campi non trovati
                </div>
                <div style={{ fontSize: "11.5px", color: "#b45309" }}>{missing.map((k) => FIELD_LABELS[k]).join(" · ")}</div>
              </div>
            )}

            {isFilled(infoAgg) && (
              <div style={{ ...SANS, background: "#eff6ff", border: `1px solid ${AC}33`, borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: AC, marginBottom: "6px" }}>📋 Informazioni aggiuntive</div>
                <div style={{ fontSize: "12px", color: N, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{infoAgg}</div>
              </div>
            )}

            <button onClick={openWizard} style={{ ...SANS, marginTop: "4px", width: "100%", padding: "16px", background: AC, color: WH, border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "15px", boxShadow: "0 4px 16px rgba(30,64,175,0.25)" }}>
              → Apri nel wizard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

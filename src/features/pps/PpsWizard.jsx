// Wizard PPS — modulo autonomo a 6 step:
//  1 Dati servizio · 2 Situazione · 3 Compiti · 4 Pericoli · 5 Dettagli · 6 Referenti
// Genera un DOCX tramite buildPpsDocx.js e persiste su Supabase (tabella "pps").
// Gli assist AL (situazione, compiti) passano dal proxy serverless /api/generate.

import React, { useState, useEffect, useRef } from "react";
import logoImg from "../../assets/logo.jpg";
import { saveAs } from "file-saver";
import { generatePpsDocxBlob } from "./buildPpsDocx";
import { buildPpsPdfBlob } from "../../buildPpsPdf";
import { supabase } from "../../supabaseClient";
import AnnotationEditor from "./AnnotationEditor";

// ── CONDIVISIONE / DOWNLOAD DOCX (Web Share API con fallback) ─────────────────
async function shareOrDownloadDocx(blob, filename, title, text) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const file = new File([blob], filename, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── CONDIVISIONE / DOWNLOAD PDF (Web Share API con fallback) ──────────────────
async function shareOrDownloadPdf(blob, filename, title, text) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const file = new File([blob], filename, { type: "application/pdf" });
  if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Palette (allineata ad App.jsx) ──────────────────────────────────────────
const N = "#0c1d3d";
const AC = "#1E40AF";
const WH = "#ffffff";
const BG = "#f4f7fc";
const GL = "#edf1f8";
const GB = "#d0dae8";
const TM = "#52637a";
const GR = "#9baab8";
const ERR = "#c8102e";
const OK = "#16a34a";
const SANS = { fontFamily: "system-ui, -apple-system, sans-serif" };
const SERIF = { fontFamily: "Georgia, 'Times New Roman', serif" };

const STEPS = ["Dati servizio", "Situazione", "Compiti", "Pericoli", "Dettagli", "Referenti", "Allegati"];

const TIPI_SERVIZIO = [
  "Pattuglia / Ronda", "Controllo accessi", "Sorveglianza fissa", "Evento", "Altro",
];

const INIT = {
  codice: "", numero_cliente: "", cliente: "", luogo: "", data: "",
  orario_inizio: "", orario_fine: "", tipo_servizio: "Pattuglia / Ronda",
  num_agenti: "", note_dati: "",
  situazione: "",
  compiti: [""], differenze_pgs: "",
  pericoli: [
    { pericolo: "", conseguenze: "", misure: "" },
    { pericolo: "", conseguenze: "", misure: "" },
  ],
  divisa: "", equipaggiamento: [""], radio_canale: "",
  vettovagliamento: "", parcheggio: "", note_operative: "",
  referenti: [{ nome: "", ruolo: "", telefono: "", email: "" }],
  foto: [],
};

// ── Audit log ────────────────────────────────────────────────────────────────
async function logAudit(supabase, ppsId, email, azione, dettagli = {}) {
  const { error } = await supabase.from("pps_audit").insert({
    pps_id: ppsId,
    utente_email: email,
    azione,
    dettagli,
  });
  if (error) console.error("[PpsWizard] audit:", error.message);
}

// Retrocompatibilità: mappa un "contenuto" (anche vecchio formato) sullo schema nuovo.
function normalizeLoaded(c) {
  c = c || {};
  const compiti = Array.isArray(c.compiti)
    ? c.compiti
    : (typeof c.compiti === "string" && c.compiti.trim()
        ? c.compiti.split(/\r?\n/).map((s) => s.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim()).filter(Boolean)
        : []);
  const pericoli = Array.isArray(c.pericoli) && c.pericoli.length
    ? c.pericoli.map((p) => ({ pericolo: p.pericolo ?? "", conseguenze: p.conseguenze ?? "", misure: p.misure ?? "" }))
    : [{ pericolo: "", conseguenze: "", misure: "" }, { pericolo: "", conseguenze: "", misure: "" }];
  const equip = Array.isArray(c.equipaggiamento) && c.equipaggiamento.length ? c.equipaggiamento : [""];
  const referenti = Array.isArray(c.referenti) && c.referenti.length
    ? c.referenti.map((r) => ({ nome: r.nome ?? "", ruolo: r.ruolo ?? "", telefono: r.telefono ?? "", email: r.email ?? "" }))
    : [{ nome: "", ruolo: "", telefono: "", email: "" }];
  const foto = Array.isArray(c.foto) ? c.foto.filter((p) => p && p.url).map((p) => ({ url: p.url, didascalia: p.didascalia ?? "", annotatedUrl: p.annotatedUrl ?? null })) : [];
  return {
    codice: c.codice ?? "",
    numero_cliente: c.numero_cliente ?? c.numeroCliente ?? "",
    cliente: c.cliente ?? "",
    luogo: c.luogo ?? "",
    data: c.data ?? "",
    orario_inizio: c.orario_inizio ?? c.orarioInizio ?? "",
    orario_fine: c.orario_fine ?? c.orarioFine ?? "",
    tipo_servizio: c.tipo_servizio ?? c.tipoServizio ?? "Pattuglia / Ronda",
    num_agenti: c.num_agenti ?? c.numAgenti ?? "",
    note_dati: c.note_dati ?? c.note ?? "",
    situazione: c.situazione ?? "",
    compiti: compiti.length ? compiti : [""],
    differenze_pgs: c.differenze_pgs ?? "",
    pericoli,
    divisa: c.divisa ?? "",
    equipaggiamento: equip,
    radio_canale: c.radio_canale ?? "",
    vettovagliamento: c.vettovagliamento ?? "",
    parcheggio: c.parcheggio ?? "",
    note_operative: c.note_operative ?? "",
    referenti,
    foto,
  };
}

// Ridimensiona un file immagine a max `maxSide` px (lato lungo) e lo esporta
// come Blob JPEG con la qualità indicata, tramite canvas.
function resizeImage(file, maxSide = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width >= height && width > maxSide) { height = Math.round((height * maxSide) / width); width = maxSide; }
      else if (height > width && height > maxSide) { width = Math.round((width * maxSide) / height); height = maxSide; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("conversione immagine fallita"))), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("immagine non valida")); };
    img.src = url;
  });
}

// Ricava il path nello storage dall'URL pubblico (.../pps-foto/<path>).
function pathFromUrl(url) {
  if (!url) return null;
  const marker = "/pps-foto/";
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

// ── Componenti UI di base (top-level) ───────────────────────────────────────
const inpStyle = {
  width: "100%", padding: "9px 11px", border: `1px solid ${GB}`, borderRadius: "8px",
  fontSize: "14px", color: N, background: WH, outline: "none", ...SANS, boxSizing: "border-box",
};

// Colore label: rosso se il campo risulta tra quelli mancanti dall'importazione.
function labelColor(fieldName, importMissing) {
  if (!importMissing || !importMissing.length) return "#374151";
  const missing = importMissing.map((f) => f.toLowerCase());
  return missing.some((f) =>
    fieldName.toLowerCase().includes(f) || f.includes(fieldName.toLowerCase())
  )
    ? "#EF4444"
    : "#374151";
}

function Field({ label, children, color = TM }) {
  return (
    <label style={{ display: "block", marginBottom: "14px" }}>
      <span style={{ ...SANS, display: "block", fontSize: "12px", fontWeight: 600, color, marginBottom: "5px" }}>{label}</span>
      {children}
    </label>
  );
}

function Txt({ v, set, ph, type = "text" }) {
  return <input type={type} value={v} placeholder={ph} onChange={(e) => set(e.target.value)} style={inpStyle} />;
}

function Area({ v, set, ph, rows = 6 }) {
  return <textarea value={v} placeholder={ph} rows={rows} onChange={(e) => set(e.target.value)} style={{ ...inpStyle, resize: "vertical", lineHeight: 1.6 }} />;
}

function Sel({ v, set, opts }) {
  const list = opts.includes(v) || !v ? opts : [v, ...opts];
  return (
    <select value={v} onChange={(e) => set(e.target.value)} style={inpStyle}>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Btn({ children, on, variant = "navy", disabled = false }) {
  const bg = disabled ? GR : variant === "navy" ? N : variant === "accent" ? AC : WH;
  const col = variant === "ghost" ? N : WH;
  const bd = variant === "ghost" ? `1px solid ${GB}` : "none";
  return (
    <button onClick={on} disabled={disabled} style={{
      ...SANS, padding: "11px 22px", borderRadius: "9px", border: bd, background: bg, color: col,
      fontSize: "14px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
    }}>{children}</button>
  );
}

// Editor di lista stringhe con add/remove (compiti, equipaggiamento)
function ListEditor({ items, setItems, ph, addLabel, multiline = false }) {
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: multiline ? "flex-start" : "center" }}>
          {multiline ? (
            <textarea
              value={it}
              placeholder={ph}
              rows={String(it || "").length > 100 ? 3 : 2}
              onChange={(e) => setItems(items.map((x, idx) => (idx === i ? e.target.value : x)))}
              style={{ ...inpStyle, width: "100%", resize: "vertical", lineHeight: 1.6 }}
            />
          ) : (
            <input
              value={it}
              placeholder={ph}
              onChange={(e) => setItems(items.map((x, idx) => (idx === i ? e.target.value : x)))}
              style={inpStyle}
            />
          )}
          <button
            onClick={() => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : [""])}
            title="Rimuovi"
            style={{ ...SANS, flexShrink: 0, width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${GB}`, background: WH, color: ERR, cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>
            ×
          </button>
        </div>
      ))}
      <Btn variant="ghost" on={() => setItems([...items, ""])}>{addLabel}</Btn>
    </div>
  );
}

function StepBar({ cur, isMobile = false }) {
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "28px" }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ height: "4px", borderRadius: "2px", marginBottom: "6px", background: i <= cur ? AC : GB }} />
          <span style={{ ...SANS, fontSize: "10.5px", fontWeight: i === cur ? 700 : 500, color: i <= cur ? N : GR }}>
            {isMobile ? i + 1 : `${i + 1}. ${s}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Assist AI tramite proxy /api/generate ───────────────────────────────────
async function callGenerate(content, maxTokens) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
  };
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || d.error || "Errore API");
  const text = d.content?.[0]?.text?.trim();
  if (!text) throw new Error("Risposta AI vuota");
  return text;
}

async function generaSituazioneAI(f) {
  const content = `Scrivi in italiano una breve descrizione della situazione per una PPS (Prescrizioni Particolari di Servizio). Cliente: ${f.cliente}, Luogo: ${f.luogo}, Data: ${f.data}, Tipo servizio: ${f.tipo_servizio}. Tono operativo e professionale, 2-4 frasi.`;
  return callGenerate(content, 300);
}

async function generaCompitiAI(f) {
  const orario = [f.orario_inizio, f.orario_fine].filter(Boolean).join("-");
  const datiServizio = [
    `Cliente: ${f.cliente || "n/d"}`,
    `Luogo: ${f.luogo || "n/d"}`,
    `Tipo servizio: ${f.tipo_servizio || "n/d"}`,
    `Orario complessivo: ${orario || "n/d"}`,
    `Numero agenti: ${f.num_agenti || "n/d"}`,
    `Situazione: ${f.situazione || "n/d"}`,
  ].join("\n");

  const content = `Sei un assistente operativo di DELTAgroup Security & Services AG.
Genera i compiti del personale per una PPS (Prescrizioni Particolari di Servizio) in base ai dati del servizio forniti.

DATI DEL SERVIZIO:
${datiServizio}

FORMATO OBBLIGATORIO — rispettalo alla lettera:

AGENTE N (orario_inizio-orario_fine): [Ruolo sintetico] — [Primo compito]
[Secondo compito]
[Terzo compito]
[Ulteriori compiti, uno per riga]

Separa ogni agente con una riga vuota.

REGOLE:
1. Il primo compito segue il "—" sulla stessa riga dell'intestazione
2. Ogni compito successivo va su una riga separata (a capo reale, \\n)
3. Ogni compito inizia con un verbo: "Entra", "Verifica", "Mantiene", "Controlla", "Coordina", "Effettua", "Si posiziona"...
4. Ogni compito: max 15 parole, concreto, azionabile
5. NON usare virgole per separare compiti diversi
6. NON mettere punto alla fine dei compiti
7. NON usare bullet, trattini o numerazione — solo righe pulite

ESEMPIO DI OUTPUT CORRETTO:
AGENTE 1 (17:30-02:00): Gestione entrate e sicurezza Terrazza — Entra in servizio e prende contatto con i responsabili
Verifica il perimetro della Terrazza e le infrastrutture
Si posiziona all'entrata e controlla il flusso di persone
Mantiene il contatto radio con Agente 2 e Agente 3
A turno con Agente 3 verifica che nessuno acceda alle aree vietate
Coordina il deflusso finale in modo fluido e tranquillo
Effettua debriefing con i responsabili e verifica le infrastrutture
Raggiunge gli altri agenti e indica la fine del servizio

AGENTE 2 (20:00-02:00): Gestione posteggio e strada — Entra in servizio e conferma via radio ad Agente 1
Fornisce indicazioni sui posteggi disponibili senza fungere da posteggiatore
Effettua ronde regolari nell'area assegnata
Monitora che arrivi e partenze non creino problemi di ordine pubblico
Al deflusso finale riceve il supporto di Agente 3

Restituisci SOLO i blocchi degli agenti, senza testo introduttivo o conclusivo.`;
  return callGenerate(content, 1500);
}

// ── Vista documento (PPS validata, sola lettura) ─────────────────────────────
// Mostrata al posto del wizard quando bloccata=true. Le azioni (download, copia,
// sblocco) riusano le funzioni del wizard passate via prop.
function SezioneLabel({ children }) {
  return (
    <div style={{ ...SANS, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: AC, margin: "18px 0 8px" }}>{children}</div>
  );
}

function RigaDato({ label, value }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "6px" }}>
      <span style={{ ...SANS, fontSize: "12px", fontWeight: 700, color: TM, minWidth: "84px", flexShrink: 0 }}>{label}</span>
      <span style={{ ...SANS, fontSize: "13px", color: N, wordBreak: "break-word" }}>{value || "—"}</span>
    </div>
  );
}

function PpsDocView({ data, versione, profilo, onBack, onDownload, onPdf, onShare, onCopy, onUnlock, docxLoading = false, saving = false, err = null }) {
  const isAdmin = profilo?.ruolo === "admin";
  const compiti = (Array.isArray(data.compiti) ? data.compiti : []).map((s) => String(s || "").trim()).filter(Boolean);
  const compitiTop = compiti.slice(0, 5);
  const compitiResto = compiti.length - compitiTop.length;
  const referenti = (Array.isArray(data.referenti) ? data.referenti : []).filter((r) => (r?.nome || "").trim());
  const orario = [data.orario_inizio, data.orario_fine].filter(Boolean).join(" – ");

  const actBtn = (bg, col, bd = "none") => ({
    ...SANS, width: "100%", padding: "13px 16px", borderRadius: "11px", border: bd, background: bg, color: col,
    fontSize: "14px", fontWeight: 700, cursor: saving ? "wait" : "pointer", transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "32px 20px" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        {/* Header / breadcrumb + badge */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div style={{ minWidth: 0 }}>
            <button onClick={onBack} style={{ ...SANS, background: "none", border: "none", cursor: "pointer", color: TM, fontSize: "12.5px", fontWeight: 600, padding: 0 }}>
              Archivio PPS › <span style={{ color: N, fontWeight: 700 }}>{data.cliente || "(senza cliente)"}</span>
            </button>
            <h1 style={{ ...SERIF, fontSize: "24px", fontWeight: 700, color: N, margin: "6px 0 0" }}>{data.codice || data.luogo || "PPS"}</h1>
          </div>
          <span style={{ ...SANS, display: "inline-block", padding: "6px 14px", borderRadius: "999px", fontSize: "12.5px", fontWeight: 700, background: "#FEF3C7", color: "#92400e", border: "1px solid #f59e0b", whiteSpace: "nowrap" }}>
            🔒 Validata v{versione}
          </span>
        </div>

        {/* Bottoni principali */}
        <div style={{ marginBottom: "18px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
            <button onClick={onDownload} disabled={docxLoading} style={{ ...SANS, flex: "1 1 200px", padding: "16px", borderRadius: "14px", border: `2px solid ${AC}`, background: WH, color: AC, fontSize: "15px", fontWeight: 700, cursor: docxLoading ? "wait" : "pointer" }}>
              {docxLoading ? "Genero…" : "📄 Word"}
            </button>
            <button onClick={onPdf} disabled={docxLoading} style={{ ...SANS, flex: "1 1 200px", padding: "16px", borderRadius: "14px", border: `2px solid ${AC}`, background: WH, color: AC, fontSize: "15px", fontWeight: 700, cursor: docxLoading ? "wait" : "pointer" }}>
              {docxLoading ? "Genero…" : "📋 PDF"}
            </button>
          </div>
          <button onClick={onShare} disabled={docxLoading} style={{ ...SANS, width: "100%", padding: "18px", borderRadius: "14px", border: "none", background: AC, color: WH, fontSize: "16px", fontWeight: 700, cursor: docxLoading ? "wait" : "pointer", boxShadow: "0 4px 16px rgba(30,64,175,0.25)" }}>
            {docxLoading ? "Genero…" : "📤 Condividi"}
          </button>
        </div>

        {err && (
          <div style={{ ...SANS, marginBottom: "18px", padding: "10px 12px", background: "#fdeced", border: `1px solid ${ERR}55`, borderRadius: "8px", color: ERR, fontSize: "12.5px" }}>{err}</div>
        )}

        {/* Riepilogo documento */}
        <div style={{ background: GL, border: `1px solid ${GB}`, borderRadius: "14px", padding: "22px", marginBottom: "20px" }}>
          <div style={{ ...SANS, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: AC, marginBottom: "12px" }}>Dati servizio</div>
          <RigaDato label="Cliente" value={data.cliente} />
          <RigaDato label="Luogo" value={data.luogo} />
          <RigaDato label="Data" value={data.data} />
          <RigaDato label="Orario" value={orario} />
          <RigaDato label="Tipo" value={data.tipo_servizio} />
          <RigaDato label="Agenti" value={data.num_agenti} />

          {data.situazione && data.situazione.trim() && (
            <>
              <SezioneLabel>Situazione</SezioneLabel>
              <div style={{ ...SANS, fontSize: "13px", color: N, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {data.situazione}
              </div>
            </>
          )}

          {compiti.length > 0 && (
            <>
              <SezioneLabel>Compiti</SezioneLabel>
              <ul style={{ ...SANS, fontSize: "13px", color: N, lineHeight: 1.6, margin: 0, paddingLeft: "20px" }}>
                {compitiTop.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              {compitiResto > 0 && (
                <div style={{ ...SANS, fontSize: "12.5px", color: TM, fontStyle: "italic", marginTop: "6px", paddingLeft: "20px" }}>… e altri {compitiResto}</div>
              )}
            </>
          )}

          {referenti.length > 0 && (
            <>
              <SezioneLabel>Referenti</SezioneLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {referenti.map((r, i) => (
                  <div key={i} style={{ ...SANS, fontSize: "13px", color: N }}>
                    <b>{r.nome}</b>{r.ruolo ? <span style={{ color: TM }}> — {r.ruolo}</span> : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Azioni */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={onCopy} disabled={saving} style={actBtn(AC, WH)}>📋 Crea copia — Nuova versione modificabile</button>
          {isAdmin && (
            <button onClick={onUnlock} disabled={saving} style={actBtn(WH, "#b45309", "1px solid #f59e0b")}>🔓 Sblocca per modificare</button>
          )}
          <button onClick={onBack} disabled={saving} style={actBtn(WH, N, `1px solid ${GB}`)}>← Archivio</button>
        </div>
      </div>
    </div>
  );
}

// ── Wizard ───────────────────────────────────────────────────────────────────
export default function PpsWizard({ ppsId = null, onBack, onSaved, isMobile = false, profilo = null, initialData = null, importMissing = null }) {
  const gc = (cols) => (isMobile ? "1fr" : cols);
  const isAdmin = profilo?.ruolo === "admin";
  const email = profilo?.email || "";
  const [step, setStep] = useState(0);
  const [f, setF] = useState(initialData ? normalizeLoaded(initialData) : INIT);
  const [bloccata, setBloccata] = useState(false);
  // bloccata_il originale letto dalla riga: serve a capire se la PPS era già
  // stata validata almeno una volta (incremento versione su sblocco+salvataggio).
  const [bloccataIl, setBloccataIl] = useState(null);
  const [aiSit, setAiSit] = useState(false);
  const [aiComp, setAiComp] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Persistenza
  const [localId, setLocalId] = useState(ppsId);
  const [versione, setVersione] = useState(1);
  const [loading, setLoading] = useState(!!ppsId);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const handledIdRef = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState(null);
  // Annotazione foto (editor react-konva in modal)
  const [annotIdx, setAnnotIdx] = useState(null);   // indice foto in annotazione
  const [annotSrc, setAnnotSrc] = useState(null);    // dataURL base64 pre-fetchato
  const [annotLoading, setAnnotLoading] = useState(false);

  // Caricamento PPS esistente / reset per nuova PPS
  useEffect(() => {
    if (!ppsId) {
      handledIdRef.current = null;
      setLocalId(null);
      setVersione(1);
      setF(initialData ? normalizeLoaded(initialData) : INIT);
      setBloccata(false);
      setBloccataIl(null);
      setStep(0);
      setSaveMsg(null);
      setErr(null);
      setLoading(false);
      return;
    }
    if (handledIdRef.current === ppsId) return;
    let active = true;
    (async () => {
      setLoading(true); setErr(null);
      const { data, error } = await supabase.from("pps").select("*").eq("id", ppsId).single();
      if (!active) return;
      if (error) {
        setErr(`Errore nel caricamento della PPS: ${error.message}`);
        setLoading(false);
        return;
      }
      handledIdRef.current = ppsId;
      setLocalId(ppsId);
      setVersione(data.versione || 1);
      setBloccata(!!data.bloccata);
      setBloccataIl(data.bloccata_il ?? null);
      setF(normalizeLoaded(data.contenuto));
      setLoading(false);
      logAudit(supabase, ppsId, email, "aperto");
    })();
    return () => { active = false; };
  }, [ppsId, initialData]);

  const u = (k, v) => { setSaveMsg(null); setF((p) => ({ ...p, [k]: v })); };
  // pericoli
  const setPericolo = (i, key, val) => u("pericoli", f.pericoli.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addPericolo = () => u("pericoli", [...f.pericoli, { pericolo: "", conseguenze: "", misure: "" }]);
  const delPericolo = (i) => u("pericoli", f.pericoli.length > 1 ? f.pericoli.filter((_, idx) => idx !== i) : f.pericoli);
  // referenti
  const uRef = (i, k, v) => u("referenti", f.referenti.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRef = () => u("referenti", [...f.referenti, { nome: "", ruolo: "", telefono: "", email: "" }]);
  const delRef = (i) => u("referenti", f.referenti.filter((_, idx) => idx !== i));

  // foto / allegati (Supabase Storage: bucket "pps-foto")
  const persistFoto = async (newFoto) => {
    if (!localId) return;
    const { error } = await supabase.from("pps").update({ contenuto: { ...f, foto: newFoto } }).eq("id", localId);
    if (error) setUpErr(`Salvataggio foto non riuscito: ${error.message}`);
  };
  const handleFiles = async (fileList) => {
    setUpErr(null);
    if (!localId) return;
    const files = Array.from(fileList || []).slice(0, Math.max(0, 5 - f.foto.length));
    if (!files.length) return;
    setUploading(true);
    let current = [...f.foto];
    try {
      for (const file of files) {
        const blob = await resizeImage(file, 1200, 0.85);
        const safe = (file.name || "foto.jpg").replace(/[^a-zA-Z0-9_.\-]/g, "_");
        const path = `${localId}/${Date.now()}-${safe}`;
        const { error: upError } = await supabase.storage.from("pps-foto").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upError) throw upError;
        const { data: pub } = supabase.storage.from("pps-foto").getPublicUrl(path);
        current = [...current, { url: pub.publicUrl, didascalia: "" }];
      }
      u("foto", current);
      await persistFoto(current);
    } catch (e) {
      console.error("[PpsWizard] upload", e);
      setUpErr(`Upload fallito: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };
  const removeFoto = async (idx) => {
    setUpErr(null);
    const ph = f.foto[idx];
    try {
      const path = pathFromUrl(ph?.url);
      if (path) {
        const { error } = await supabase.storage.from("pps-foto").remove([path]);
        if (error) throw error;
      }
      const newFoto = f.foto.filter((_, i) => i !== idx);
      u("foto", newFoto);
      await persistFoto(newFoto);
    } catch (e) {
      console.error("[PpsWizard] remove foto", e);
      setUpErr(`Eliminazione foto non riuscita: ${e.message}`);
    }
  };
  const setDidascalia = (idx, val) => u("foto", f.foto.map((x, i) => (i === idx ? { ...x, didascalia: val } : x)));

  // Pre-fetch dell'immagine come dataURL base64 (evita SecurityError CORS su toDataURL).
  const fetchAsDataUrl = (url) => new Promise((resolve, reject) => {
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.onerror = () => reject(new Error("lettura immagine fallita"));
        fr.readAsDataURL(blob);
      })
      .catch(reject);
  });

  // Apre l'editor di annotazione: pre-carica l'immagine (annotata se presente,
  // altrimenti l'originale) come base64 e mostra il modal con loader.
  const openAnnotation = async (idx) => {
    setUpErr(null);
    setAnnotIdx(idx);
    setAnnotSrc(null);
    setAnnotLoading(true);
    try {
      const ph = f.foto[idx];
      const base = ph.annotatedUrl || ph.url;
      const src = base.startsWith("data:") ? base : await fetchAsDataUrl(base);
      setAnnotSrc(src);
    } catch (e) {
      console.error("[PpsWizard] prefetch annotazione", e);
      setUpErr(`Impossibile caricare l'immagine per l'annotazione: ${e.message}`);
      setAnnotIdx(null);
    } finally {
      setAnnotLoading(false);
    }
  };

  const closeAnnotation = () => { setAnnotIdx(null); setAnnotSrc(null); };

  // Salva l'annotazione su un campo separato (annotatedUrl), senza toccare l'originale.
  const onSaveAnnotation = async (annotatedDataUrl) => {
    const idx = annotIdx;
    if (idx == null) return;
    const newFoto = f.foto.map((x, i) => (i === idx ? { ...x, annotatedUrl: annotatedDataUrl } : x));
    u("foto", newFoto);
    await persistFoto(newFoto);
    closeAnnotation();
  };

  const doAiSituazione = async () => {
    setAiSit(true); setErr(null);
    try {
      const text = await generaSituazioneAI(f);
      u("situazione", text);
    } catch (e) {
      setErr(`Assist AI non disponibile: ${e.message}. Puoi scrivere la situazione manualmente.`);
    } finally {
      setAiSit(false);
    }
  };

  const doAiCompiti = async () => {
    setAiComp(true); setErr(null);
    try {
      const text = (await generaCompitiAI(f)).trim();
      // Il nuovo prompt produce blocchi-agente separati da riga vuota, con i
      // compiti su righe separate (\n) dentro al blocco. Ogni blocco-agente =
      // un elemento di compiti[]: i \n interni vengono mantenuti perché
      // buildPpsPdf li usa per generare un bullet per compito.
      const blocchi = text.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
      const isFormatoAgenti = /^AGENTE\s+\d+/i.test(text);
      let list;
      if (isFormatoAgenti) {
        // Mantieni i blocchi multi-riga così come sono.
        list = blocchi;
      } else {
        // Fallback formato legacy: lista piatta, un compito per riga.
        list = text.split(/\r?\n/)
          .map((s) => s.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim())
          .filter(Boolean);
      }
      u("compiti", list.length ? list : [""]);
    } catch (e) {
      setErr(`Assist AI non disponibile: ${e.message}. Puoi inserire i compiti manualmente.`);
    } finally {
      setAiComp(false);
    }
  };

  const doSave = async () => {
    setSaving(true); setErr(null); setSaveMsg(null);
    try {
      // Incremento versione: solo se la PPS era già validata almeno una volta
      // (bloccataIl != null) ed è ora di nuovo modificabile (sbloccata).
      const eraValidataEOraModificata = !!localId && !bloccata && bloccataIl != null;
      const nuovaVersione = eraValidataEOraModificata ? versione + 1 : (localId ? versione : 1);
      const obj = {
        codice: f.codice,
        cliente: f.cliente,
        luogo: f.luogo,
        tipo_servizio: f.tipo_servizio,
        versione: nuovaVersione,
        stato: "bozza",
        contenuto: { ...f },
      };
      // Azzera il flag dopo aver incrementato, così salvataggi successivi
      // non incrementano di nuovo finché non si rivalida e risblocca.
      if (eraValidataEOraModificata) obj.bloccata_il = null;
      if (!localId) {
        const { data, error } = await supabase.from("pps").insert([obj]).select().single();
        if (error) throw error;
        handledIdRef.current = data.id;
        setLocalId(data.id);
        setVersione(data.versione || 1);
        await logAudit(supabase, data.id, email, "modificato");
        onSaved?.(data.id);
      } else {
        const { error } = await supabase.from("pps").update(obj).eq("id", localId);
        if (error) throw error;
        setVersione(nuovaVersione);
        if (eraValidataEOraModificata) setBloccataIl(null);
        await logAudit(supabase, localId, email, "modificato");
      }
      setSaveMsg("Salvato ✓");
    } catch (e) {
      console.error("[PpsWizard] save", e);
      setErr(`Errore nel salvataggio: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Lock / copia ───────────────────────────────────────────────────────────
  const doValida = async () => {
    if (!localId) { setErr("Salva prima la PPS per poterla validare."); return; }
    if (!window.confirm("Validare questa PPS? Non sarà più modificabile.")) return;
    setSaving(true); setErr(null); setSaveMsg(null);
    const bloccataIlNuovo = new Date().toISOString();
    const { error } = await supabase.from("pps").update({
      bloccata: true,
      bloccata_da: email,
      bloccata_il: bloccataIlNuovo,
    }).eq("id", localId);
    setSaving(false);
    if (error) { setErr(`Errore durante la validazione: ${error.message}`); return; }
    await logAudit(supabase, localId, email, "bloccato");
    setBloccata(true);
    setBloccataIl(bloccataIlNuovo);
  };

  const doSblocca = async () => {
    if (!localId) return;
    if (!window.confirm("Sbloccare questa PPS? Tornerà modificabile.")) return;
    setSaving(true); setErr(null); setSaveMsg(null);
    // Non azzeriamo bloccata_il: serve a marcare che la PPS è già stata
    // validata, così il prossimo salvataggio incrementa la versione.
    const { error } = await supabase.from("pps").update({
      bloccata: false,
      bloccata_da: null,
    }).eq("id", localId);
    setSaving(false);
    if (error) { setErr(`Errore durante lo sblocco: ${error.message}`); return; }
    await logAudit(supabase, localId, email, "sbloccato");
    setBloccata(false);
  };

  const copiaPps = async () => {
    setSaving(true); setErr(null); setSaveMsg(null);
    try {
      const obj = {
        codice: f.codice,
        cliente: f.cliente,
        luogo: f.luogo,
        tipo_servizio: f.tipo_servizio,
        versione: versione + 1,
        stato: "bozza",
        bloccata: false,
        bloccata_da: null,
        bloccata_il: null,
        contenuto: { ...f },
      };
      const { data, error } = await supabase.from("pps").insert([obj]).select().single();
      if (error) throw error;
      if (localId) await logAudit(supabase, localId, email, "copiato", { nuovo_id: data.id });
      await logAudit(supabase, data.id, email, "creato", { copia_da: localId });
      onSaved?.(data.id); // naviga al nuovo record (il wizard ricarica sul nuovo ppsId)
    } catch (e) {
      console.error("[PpsWizard] copia", e);
      setErr(`Errore durante la copia: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const doDownload = async () => {
    setDocxLoading(true); setErr(null);
    try {
      const nomeFile = (f.codice || f.cliente || "pps").replace(/[^a-zA-Z0-9_\-]/g, "_");
      const blob = await generatePpsDocxBlob({ data: f, headerLogoUrl: `${window.location.origin}${logoImg}` });
      saveAs(blob, `PPS_${nomeFile}.docx`);
    } catch (e) {
      console.error("[PpsWizard] download", e);
      setErr(`Errore generazione DOCX: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  const doPdf = async () => {
    setDocxLoading(true); setErr(null);
    try {
      const nomeFile = (f.codice || f.cliente || "pps").replace(/[^a-zA-Z0-9_\-]/g, "_");
      const blob = await buildPpsPdfBlob(f);
      saveAs(blob, `PPS_${nomeFile}.pdf`);
    } catch (e) {
      console.error("PDF error:", e);
      setErr(`Errore generazione PDF: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  const doShare = async () => {
    setDocxLoading(true); setErr(null);
    try {
      const blob = await buildPpsPdfBlob(f);
      await shareOrDownloadPdf(
        blob,
        `PPS_${f.codice || f.cliente || "documento"}.pdf`,
        `PPS — ${f.cliente || ""} ${f.luogo || ""}`,
        "DELTAgroup Security & Services AG"
      );
    } catch (e) {
      console.error("PDF error:", e);
      setErr(`Errore condivisione PDF: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  // PPS validata → vista documento di sola lettura (nessun wizard).
  if (!loading && bloccata) {
    return (
      <PpsDocView
        data={f}
        versione={versione}
        profilo={profilo}
        onBack={onBack}
        onDownload={doDownload}
        onPdf={doPdf}
        onShare={doShare}
        onCopy={copiaPps}
        onUnlock={doSblocca}
        docxLoading={docxLoading}
        saving={saving}
        err={err}
      />
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "32px 20px" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ ...SANS, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em", color: AC, fontWeight: 700 }}>
              Prescrizioni Particolari di Servizio
            </div>
            <h1 style={{ ...SERIF, fontSize: "26px", fontWeight: 700, color: N, margin: "4px 0 0" }}>
              PPS{localId ? " — Modifica" : " — Nuova"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {saveMsg && <span style={{ ...SANS, fontSize: "13px", fontWeight: 700, color: OK }}>{saveMsg}</span>}
            <Btn variant="ghost" on={onBack}>← Lista</Btn>
            {bloccata ? (
              <>
                <Btn variant="accent" on={copiaPps} disabled={saving || loading}>📋 Crea copia</Btn>
                {isAdmin && <Btn variant="navy" on={doSblocca} disabled={saving || loading}>🔓 Sblocca</Btn>}
              </>
            ) : (
              <>
                <Btn variant="accent" on={doSave} disabled={saving || loading}>{saving ? "Salvo…" : "💾 Salva"}</Btn>
                <Btn variant="navy" on={doValida} disabled={saving || loading || !localId}>🔒 Valida</Btn>
              </>
            )}
          </div>
        </div>

        <div style={{ background: WH, border: `1px solid ${GB}`, borderRadius: "14px", padding: "26px", boxShadow: "0 2px 12px rgba(12,29,61,0.06)" }}>
          {loading ? (
            <div style={{ ...SANS, padding: "48px", textAlign: "center", color: TM, fontSize: "14px" }}>Caricamento della PPS in corso…</div>
          ) : (
          <>
          {bloccata && (
            <div style={{ ...SANS, background: "#FEF3C7", border: "1px solid #f59e0b", borderRadius: "10px", padding: "12px 14px", marginBottom: "18px", fontSize: "13px", color: "#92400e", fontWeight: 600, lineHeight: 1.5 }}>
              🔒 PPS validata — sola lettura. Crea una copia per modificarla.
            </div>
          )}

          {!bloccata && Array.isArray(importMissing) && importMissing.length > 0 && (
            <div style={{ ...SANS, background: "#fffbeb", border: "1px solid #f59e0b55", borderRadius: "10px", padding: "12px 14px", marginBottom: "18px", fontSize: "12.5px", color: "#92400e", lineHeight: 1.55 }}>
              <span style={{ fontWeight: 700 }}>⚠️ Da completare</span> — campi non trovati nel documento importato: {importMissing.join(", ")}.
            </div>
          )}

          <StepBar cur={step} isMobile={isMobile} />

          {/* I campi sono disabilitati in blocco quando la PPS è validata (sola lettura). */}
          <fieldset disabled={bloccata} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
          {/* STEP 1 — Dati servizio */}
          {step === 0 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: gc("1fr 1fr"), gap: "12px" }}>
                <Field label="Codice servizio"><Txt v={f.codice} set={(v) => u("codice", v)} ph="Es. UBS-ZH-001" /></Field>
                <Field label="Numero cliente"><Txt v={f.numero_cliente} set={(v) => u("numero_cliente", v)} ph="Es. KD-705002505" /></Field>
              </div>
              <Field label="Cliente / Committente"><Txt v={f.cliente} set={(v) => u("cliente", v)} ph="Nome del cliente" /></Field>
              <Field label="Luogo / Indirizzo"><Txt v={f.luogo} set={(v) => u("luogo", v)} ph="Indirizzo / località" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: gc("1fr 1fr 1fr"), gap: "12px" }}>
                <Field label="Data servizio" color={labelColor("data", importMissing)}><Txt v={f.data} set={(v) => u("data", v)} ph="gg.mm.aaaa" /></Field>
                <Field label="Orario inizio"><Txt v={f.orario_inizio} set={(v) => u("orario_inizio", v)} ph="20:00" /></Field>
                <Field label="Orario fine"><Txt v={f.orario_fine} set={(v) => u("orario_fine", v)} ph="06:00" /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: gc("2fr 1fr"), gap: "12px" }}>
                <Field label="Tipo di servizio"><Sel v={f.tipo_servizio} set={(v) => u("tipo_servizio", v)} opts={TIPI_SERVIZIO} /></Field>
                <Field label="Numero agenti" color={labelColor("agenti", importMissing)}><Txt v={f.num_agenti} set={(v) => u("num_agenti", v)} ph="Es. 2" /></Field>
              </div>
              <Field label="Note (opzionale)"><Area v={f.note_dati} set={(v) => u("note_dati", v)} ph="Indicazioni particolari, dotazioni, accessi…" rows={3} /></Field>
            </div>
          )}

          {/* STEP 2 — Situazione */}
          {step === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: labelColor("situazione", importMissing) }}>Descrizione della situazione</span>
                <Btn variant="accent" on={doAiSituazione} disabled={aiSit}>{aiSit ? "Generazione in corso…" : "✨ Genera con AI"}</Btn>
              </div>
              <Area v={f.situazione} set={(v) => u("situazione", v)} rows={6}
                ph="Contesto operativo del servizio: cliente, sito, finalità della sorveglianza…" />
            </div>
          )}

          {/* STEP 3 — Compiti */}
          {step === 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: labelColor("compiti", importMissing) }}>Compiti del personale</span>
                <Btn variant="accent" on={doAiCompiti} disabled={aiComp}>{aiComp ? "Generazione in corso…" : "✨ Genera con AI"}</Btn>
              </div>
              <ListEditor items={f.compiti} setItems={(arr) => u("compiti", arr)} ph="Es. Garantire la sicurezza degli accessi" addLabel="+ Aggiungi compito" multiline />
              <div style={{ marginTop: "18px" }}>
                <Field label="Differenze rispetto alle PGS (opzionale)">
                  <Area v={f.differenze_pgs} set={(v) => u("differenze_pgs", v)} ph="Eventuali deroghe o integrazioni rispetto alle Prescrizioni Generali di Servizio…" rows={3} />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 4 — Pericoli particolari */}
          {step === 3 && (
            <div>
              <div style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: labelColor("pericoli", importMissing), marginBottom: "10px" }}>Pericoli particolari</div>
              {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 34px", gap: "8px", marginBottom: "6px", ...SANS, fontSize: "11px", fontWeight: 700, color: GR, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <div>Pericolo</div><div>Conseguenze</div><div>Misure di protezione</div><div></div>
              </div>
              )}
              {f.pericoli.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: gc("1fr 1fr 1fr 34px"), gap: "8px", marginBottom: isMobile ? "16px" : "8px", alignItems: "center", ...(isMobile ? { padding: "12px", border: `1px solid ${GB}`, borderRadius: "10px", background: GL } : {}) }}>
                  <input value={r.pericolo} placeholder="Pericolo" onChange={(e) => setPericolo(i, "pericolo", e.target.value)} style={inpStyle} />
                  <input value={r.conseguenze} placeholder="Conseguenze" onChange={(e) => setPericolo(i, "conseguenze", e.target.value)} style={inpStyle} />
                  <input value={r.misure} placeholder="Misure" onChange={(e) => setPericolo(i, "misure", e.target.value)} style={inpStyle} />
                  <button onClick={() => delPericolo(i)} title="Elimina"
                    style={{ ...SANS, width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${GB}`, background: WH, color: ERR, cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>×</button>
                </div>
              ))}
              <div style={{ marginTop: "6px" }}>
                <Btn variant="ghost" on={addPericolo}>+ Aggiungi pericolo</Btn>
              </div>
            </div>
          )}

          {/* STEP 5 — Dettagli operativi */}
          {step === 4 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: gc("1fr 1fr"), gap: "12px" }}>
                <Field label="Divisa / Tenue" color={labelColor("divisa", importMissing)}><Txt v={f.divisa} set={(v) => u("divisa", v)} ph="Es. Uniforme DELTAgroup" /></Field>
                <Field label="Canale radio" color={labelColor("radio", importMissing)}><Txt v={f.radio_canale} set={(v) => u("radio_canale", v)} ph="Es. Canale 4" /></Field>
              </div>
              <Field label="Equipaggiamento">
                <ListEditor items={f.equipaggiamento} setItems={(arr) => u("equipaggiamento", arr)} ph="Es. Torcia, radio, telefono di servizio" addLabel="+ Aggiungi equipaggiamento" />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: gc("1fr 1fr"), gap: "12px", marginTop: "4px" }}>
                <Field label="Vettovagliamento" color={labelColor("vettovagliamento", importMissing)}><Txt v={f.vettovagliamento} set={(v) => u("vettovagliamento", v)} ph="Es. A carico dell'agente" /></Field>
                <Field label="Punto di incontro / Parcheggio" color={labelColor("parcheggio", importMissing)}><Txt v={f.parcheggio} set={(v) => u("parcheggio", v)} ph="Es. Ingresso principale" /></Field>
              </div>
              <Field label="Note operative (opzionale)"><Area v={f.note_operative} set={(v) => u("note_operative", v)} ph="Indicazioni operative aggiuntive…" rows={3} /></Field>
            </div>
          )}

          {/* STEP 6 — Referenti */}
          {step === 5 && (
            <div>
              {f.referenti.map((r, i) => (
                <div key={i} style={{ border: `1px solid ${GB}`, borderRadius: "10px", padding: "14px", marginBottom: "12px", background: GL }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ ...SANS, fontSize: "12px", fontWeight: 700, color: labelColor("referenti", importMissing) === "#EF4444" ? "#EF4444" : N }}>Referente {i + 1}</span>
                    {f.referenti.length > 1 && (
                      <button onClick={() => delRef(i)} style={{ ...SANS, background: "none", border: "none", color: ERR, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Rimuovi</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: gc("1fr 1fr"), gap: "10px" }}>
                    <Txt v={r.nome} set={(v) => uRef(i, "nome", v)} ph="Nome e cognome" />
                    <Txt v={r.ruolo} set={(v) => uRef(i, "ruolo", v)} ph="Ruolo / funzione" />
                    <Txt v={r.telefono} set={(v) => uRef(i, "telefono", v)} ph="Telefono" />
                    <Txt v={r.email} set={(v) => uRef(i, "email", v)} ph="E-mail" />
                  </div>
                </div>
              ))}
              <Btn variant="ghost" on={addRef}>+ Aggiungi referente</Btn>
            </div>
          )}

          {/* STEP 7 — Allegati / Foto */}
          {step === 6 && (
            <div>
              <div style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: TM, marginBottom: "10px" }}>Foto sopralluogo (max 5)</div>
              {!localId ? (
                <div style={{ ...SANS, padding: "16px", background: GL, borderRadius: "10px", color: TM, fontSize: "13px", lineHeight: 1.6 }}>
                  Salva prima la PPS (pulsante <b>💾 Salva</b> in alto) per poter caricare le foto.
                </div>
              ) : (
                <div>
                  <div
                    onClick={() => { if (f.foto.length < 5 && !uploading) fileRef.current?.click(); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (f.foto.length < 5 && !uploading) handleFiles(e.dataTransfer.files); }}
                    style={{
                      border: `2px dashed ${f.foto.length >= 5 ? GB : AC}`, borderRadius: "12px",
                      padding: "30px", textAlign: "center", ...SANS, fontSize: "13px", fontWeight: 600,
                      cursor: (f.foto.length >= 5 || uploading) ? "not-allowed" : "pointer",
                      background: f.foto.length >= 5 ? "#f7f8fa" : "#f8faff",
                      color: f.foto.length >= 5 ? GR : AC,
                    }}>
                    {uploading ? "Caricamento in corso…"
                      : f.foto.length >= 5 ? "Massimo 5 foto"
                      : "Trascina le foto qui o clicca per selezionare"}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
                    style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

                  {upErr && (
                    <div style={{ ...SANS, marginTop: "12px", padding: "10px 12px", background: "#fdeced", border: `1px solid ${ERR}55`, borderRadius: "8px", color: ERR, fontSize: "12.5px" }}>
                      {upErr}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
                    {f.foto.map((ph, i) => (
                      <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center", border: `1px solid ${GB}`, borderRadius: "10px", padding: "10px", background: WH }}>
                        <img src={ph.annotatedUrl || ph.url} alt="" style={{ width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px", flexShrink: 0, border: `1px solid ${ph.annotatedUrl ? AC : GB}` }} />
                        <input value={ph.didascalia || ""} placeholder="Didascalia (es. Ingresso principale)"
                          onChange={(e) => setDidascalia(i, e.target.value)} onBlur={() => persistFoto(f.foto)} style={inpStyle} />
                        <button onClick={() => openAnnotation(i)} title="Annota immagine"
                          style={{ ...SANS, flexShrink: 0, padding: "8px 12px", borderRadius: "8px", border: `1px solid ${AC}`, background: WH, color: AC, cursor: "pointer", fontSize: "12.5px", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {ph.annotatedUrl ? "✏️ Modifica annotazione" : "✏️ Annota"}
                        </button>
                        <button onClick={() => removeFoto(i)} title="Elimina"
                          style={{ ...SANS, flexShrink: 0, width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${GB}`, background: WH, color: ERR, cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>×</button>
                      </div>
                    ))}
                    {f.foto.length === 0 && (
                      <div style={{ ...SANS, fontSize: "12px", color: GR }}>Nessuna foto caricata.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          </fieldset>

          {err && (
            <div style={{ ...SANS, marginTop: "16px", padding: "10px 12px", background: "#fdeced", border: `1px solid ${ERR}55`, borderRadius: "8px", color: ERR, fontSize: "12.5px" }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
            <Btn variant="ghost" on={() => (step === 0 ? onBack() : setStep(step - 1))}>
              {step === 0 ? "Annulla" : "← Indietro"}
            </Btn>
            {step < STEPS.length - 1
              ? <Btn on={() => setStep(step + 1)}>Avanti →</Btn>
              : <Btn variant="accent" on={doDownload} disabled={docxLoading}>{docxLoading ? "Genero DOCX…" : "⬇ Genera DOCX"}</Btn>}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Modal editor di annotazione foto */}
      {annotIdx != null && (
        <div
          onClick={closeAnnotation}
          style={{ position: "fixed", inset: 0, background: "rgba(12,29,61,0.72)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "3vh 2vw" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: WH, borderRadius: "16px", padding: "20px", width: "min(96vw, 920px)", maxHeight: "94vh", overflow: "auto", boxShadow: "0 12px 48px rgba(0,0,0,0.4)" }}
          >
            <div style={{ ...SANS, fontSize: "15px", fontWeight: 700, color: N, marginBottom: "14px" }}>Annotazione foto</div>
            {annotLoading || !annotSrc ? (
              <div style={{ ...SANS, padding: "60px", textAlign: "center", color: TM, fontSize: "14px" }}>Caricamento immagine…</div>
            ) : (
              <AnnotationEditor imageSrc={annotSrc} onSave={onSaveAnnotation} onCancel={closeAnnotation} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Wizard PPS — modulo autonomo a 3 step (dati servizio, compiti, referenti)
// che genera un DOCX di 1-2 pagine tramite buildPpsDocx.js.
// Persistenza su Supabase (tabella "pps"): crea/aggiorna + carica per id.
// L'assist AI opzionale (bozza compiti) passa dal proxy serverless /api/generate.

import React, { useState, useEffect, useRef } from "react";
import logoImg from "../../assets/logo.jpg";
import { saveAs } from "file-saver";
import { generatePpsDocxBlob } from "./buildPpsDocx";
import { supabase } from "../../supabaseClient";

// ── Palette (allineata ad App.jsx) ──────────────────────────────────────────
const N = "#0c1d3d";
const RD = "#1E40AF";
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

const STEPS = ["Dati servizio", "Compiti", "Referenti"];

const INIT = {
  codice: "", numeroCliente: "",
  titolo: "", cliente: "", luogo: "", data: "",
  orarioInizio: "", orarioFine: "", tipoServizio: "Sorveglianza eventi",
  numAgenti: "", note: "",
  compiti: "",
  referenti: [{ nome: "", ruolo: "", telefono: "", email: "" }],
};

const TIPI_SERVIZIO = [
  "Sorveglianza eventi", "Servizio di portineria", "Pattuglia / Ronda",
  "Controllo accessi", "Servizio antifurto / antitaccheggio", "Scorta valori",
  "Servizio di reception", "Altro",
];

// ── Componenti UI di base ───────────────────────────────────────────────────
const inpStyle = {
  width: "100%", padding: "9px 11px", border: `1px solid ${GB}`, borderRadius: "8px",
  fontSize: "14px", color: N, background: WH, outline: "none", ...SANS, boxSizing: "border-box",
};

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: "14px" }}>
      <span style={{ ...SANS, display: "block", fontSize: "12px", fontWeight: 600, color: TM, marginBottom: "5px" }}>{label}</span>
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
  return (
    <select value={v} onChange={(e) => set(e.target.value)} style={inpStyle}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Btn({ children, on, variant = "navy", disabled = false }) {
  const bg = disabled ? GR : variant === "navy" ? N : variant === "red" ? RD : WH;
  const col = variant === "ghost" ? N : WH;
  const bd = variant === "ghost" ? `1px solid ${GB}` : "none";
  return (
    <button onClick={on} disabled={disabled} style={{
      ...SANS, padding: "11px 22px", borderRadius: "9px", border: bd, background: bg, color: col,
      fontSize: "14px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
    }}>{children}</button>
  );
}

function StepBar({ cur }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: "center" }}>
          <div style={{
            height: "4px", borderRadius: "2px", marginBottom: "6px",
            background: i <= cur ? RD : GB,
          }} />
          <span style={{ ...SANS, fontSize: "11px", fontWeight: i === cur ? 700 : 500, color: i <= cur ? N : GR }}>
            {i + 1}. {s}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Assist AI compiti tramite proxy /api/generate ───────────────────────────
async function generaCompitiAI(f) {
  const sintesi = [
    f.titolo && `Servizio: ${f.titolo}`,
    f.cliente && `Cliente: ${f.cliente}`,
    f.luogo && `Luogo: ${f.luogo}`,
    f.tipoServizio && `Tipo: ${f.tipoServizio}`,
    f.numAgenti && `Agenti: ${f.numAgenti}`,
    f.note && `Note: ${f.note}`,
  ].filter(Boolean).join("\n");

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: "Sei un esperto di servizi di sicurezza privata DELTAgroup Security & Services AG (Ticino). Genera un elenco conciso e professionale di compiti operativi per il personale di sicurezza. Rispondi SOLO con un elenco puntato (un compito per riga, prefisso '- '), senza titoli, introduzioni o markdown aggiuntivo.",
    messages: [{ role: "user", content: `Elenca i compiti del personale di sicurezza per il seguente servizio:\n${sintesi || "(dati non specificati)"}` }],
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

// ── Wizard ───────────────────────────────────────────────────────────────────
export default function PpsWizard({ ppsId = null, onBack, onSaved }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(INIT);
  const [aiLoading, setAiLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Persistenza
  const [localId, setLocalId] = useState(ppsId);
  const [versione, setVersione] = useState(1);
  const [loading, setLoading] = useState(!!ppsId);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const handledIdRef = useRef(null);

  // Caricamento PPS esistente / reset per nuova PPS
  useEffect(() => {
    if (!ppsId) {
      // Nuova PPS: assicura un form pulito anche se il componente è riusato
      handledIdRef.current = null;
      setLocalId(null);
      setVersione(1);
      setF(INIT);
      setStep(0);
      setSaveMsg(null);
      setErr(null);
      setLoading(false);
      return;
    }
    if (handledIdRef.current === ppsId) return; // già caricata/creata: non ricaricare
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
      setF({ ...INIT, ...(data.contenuto || {}) });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [ppsId]);

  const u = (k, v) => { setSaveMsg(null); setF((p) => ({ ...p, [k]: v })); };
  const uRef = (i, k, v) => { setSaveMsg(null); setF((p) => {
    const referenti = p.referenti.map((r, idx) => idx === i ? { ...r, [k]: v } : r);
    return { ...p, referenti };
  }); };
  const addRef = () => setF((p) => ({ ...p, referenti: [...p.referenti, { nome: "", ruolo: "", telefono: "", email: "" }] }));
  const delRef = (i) => setF((p) => ({ ...p, referenti: p.referenti.filter((_, idx) => idx !== i) }));

  const doAI = async () => {
    setAiLoading(true); setErr(null);
    try {
      const text = await generaCompitiAI(f);
      u("compiti", f.compiti ? `${f.compiti}\n${text}` : text);
    } catch (e) {
      setErr(`Assist AI non disponibile: ${e.message}. Puoi inserire i compiti manualmente.`);
    } finally {
      setAiLoading(false);
    }
  };

  const doSave = async () => {
    setSaving(true); setErr(null); setSaveMsg(null);
    try {
      const obj = {
        codice: f.codice,
        cliente: f.cliente,
        luogo: f.luogo,
        tipo_servizio: f.tipoServizio,
        versione: localId ? versione : 1,
        stato: "bozza",
        contenuto: { ...f },
      };
      if (!localId) {
        const { data, error } = await supabase.from("pps").insert([obj]).select().single();
        if (error) throw error;
        handledIdRef.current = data.id;
        setLocalId(data.id);
        setVersione(data.versione || 1);
        onSaved?.(data.id);
      } else {
        const { error } = await supabase.from("pps").update(obj).eq("id", localId);
        if (error) throw error;
      }
      setSaveMsg("Salvato ✓");
    } catch (e) {
      console.error("[PpsWizard] save", e);
      setErr(`Errore nel salvataggio: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const doDownload = async () => {
    setDocxLoading(true); setErr(null);
    try {
      const nomeFile = (f.codice || f.titolo || "pps").replace(/[^a-zA-Z0-9_\-]/g, "_");
      const blob = await generatePpsDocxBlob({
        data: f,
        headerLogoUrl: `${window.location.origin}${logoImg}`,
      });
      saveAs(blob, `PPS_${nomeFile}.docx`);
    } catch (e) {
      console.error("[PpsWizard] download", e);
      setErr(`Errore generazione DOCX: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "32px 20px" }}>
      <div style={{ maxWidth: "780px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <div style={{ ...SANS, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em", color: RD, fontWeight: 700 }}>
              Prescrizioni Particolari di Servizio
            </div>
            <h1 style={{ ...SERIF, fontSize: "26px", fontWeight: 700, color: N, margin: "4px 0 0" }}>
              PPS{localId ? " — Modifica" : " — Nuova"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {saveMsg && <span style={{ ...SANS, fontSize: "13px", fontWeight: 700, color: OK }}>{saveMsg}</span>}
            <Btn variant="ghost" on={onBack}>← Lista</Btn>
            <Btn variant="red" on={doSave} disabled={saving || loading}>{saving ? "Salvo…" : "💾 Salva"}</Btn>
          </div>
        </div>

        <div style={{ background: WH, border: `1px solid ${GB}`, borderRadius: "14px", padding: "26px", boxShadow: "0 2px 12px rgba(12,29,61,0.06)" }}>
          {loading ? (
            <div style={{ ...SANS, padding: "48px", textAlign: "center", color: TM, fontSize: "14px" }}>Caricamento della PPS in corso…</div>
          ) : (
          <>
          <StepBar cur={step} />

          {step === 0 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Codice servizio"><Txt v={f.codice} set={(v) => u("codice", v)} ph="Es. UBS-ZH-001" /></Field>
                <Field label="Numero cliente"><Txt v={f.numeroCliente} set={(v) => u("numeroCliente", v)} ph="Es. KD-705002505" /></Field>
              </div>
              <Field label="Titolo / Nome del servizio"><Txt v={f.titolo} set={(v) => u("titolo", v)} ph="Es. Sorveglianza notturna cantiere XY" /></Field>
              <Field label="Committente / Cliente"><Txt v={f.cliente} set={(v) => u("cliente", v)} ph="Nome del cliente" /></Field>
              <Field label="Luogo"><Txt v={f.luogo} set={(v) => u("luogo", v)} ph="Indirizzo / località" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <Field label="Data"><Txt v={f.data} set={(v) => u("data", v)} ph="gg.mm.aaaa" /></Field>
                <Field label="Orario inizio"><Txt v={f.orarioInizio} set={(v) => u("orarioInizio", v)} ph="20:00" /></Field>
                <Field label="Orario fine"><Txt v={f.orarioFine} set={(v) => u("orarioFine", v)} ph="06:00" /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                <Field label="Tipo di servizio"><Sel v={f.tipoServizio} set={(v) => u("tipoServizio", v)} opts={TIPI_SERVIZIO} /></Field>
                <Field label="Numero agenti"><Txt v={f.numAgenti} set={(v) => u("numAgenti", v)} ph="Es. 2" /></Field>
              </div>
              <Field label="Note (opzionale)"><Area v={f.note} set={(v) => u("note", v)} ph="Indicazioni particolari, dotazioni, accessi…" rows={3} /></Field>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: TM }}>Compiti del personale (uno per riga)</span>
                <Btn variant="red" on={doAI} disabled={aiLoading}>{aiLoading ? "Genero…" : "✨ Bozza AI"}</Btn>
              </div>
              <Area v={f.compiti} set={(v) => u("compiti", v)} rows={12}
                ph={"- Controllo accessi e verifica documenti\n- Ronde periodiche ogni 60 minuti\n- Compilazione rapporto di servizio\n…"} />
              <p style={{ ...SANS, fontSize: "11.5px", color: GR, marginTop: "6px" }}>
                Suggerimento: la "Bozza AI" usa i dati del servizio per proporre un elenco di compiti, modificabile liberamente.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              {f.referenti.map((r, i) => (
                <div key={i} style={{ border: `1px solid ${GB}`, borderRadius: "10px", padding: "14px", marginBottom: "12px", background: GL }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ ...SANS, fontSize: "12px", fontWeight: 700, color: N }}>Referente {i + 1}</span>
                    {f.referenti.length > 1 && (
                      <button onClick={() => delRef(i)} style={{ ...SANS, background: "none", border: "none", color: RD, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Rimuovi</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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
              : <Btn variant="red" on={doDownload} disabled={docxLoading}>{docxLoading ? "Genero DOCX…" : "⬇ Genera DOCX"}</Btn>}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

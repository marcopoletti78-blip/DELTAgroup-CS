// Wizard PPS — modulo autonomo a 6 step:
//  1 Dati servizio · 2 Situazione · 3 Compiti · 4 Pericoli · 5 Dettagli · 6 Referenti
// Genera un DOCX tramite buildPpsDocx.js e persiste su Supabase (tabella "pps").
// Gli assist AL (situazione, compiti) passano dal proxy serverless /api/generate.

import React, { useState, useEffect, useRef } from "react";
import logoImg from "../../assets/logo.jpg";
import { saveAs } from "file-saver";
import { generatePpsDocxBlob } from "./buildPpsDocx";
import { supabase } from "../../supabaseClient";

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

const STEPS = ["Dati servizio", "Situazione", "Compiti", "Pericoli", "Dettagli", "Referenti"];

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
};

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
  };
}

// ── Componenti UI di base (top-level) ───────────────────────────────────────
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
function ListEditor({ items, setItems, ph, addLabel }) {
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
          <input
            value={it}
            placeholder={ph}
            onChange={(e) => setItems(items.map((x, idx) => (idx === i ? e.target.value : x)))}
            style={inpStyle}
          />
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

function StepBar({ cur }) {
  return (
    <div style={{ display: "flex", gap: "6px", marginBottom: "28px" }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ flex: 1, textAlign: "center" }}>
          <div style={{ height: "4px", borderRadius: "2px", marginBottom: "6px", background: i <= cur ? AC : GB }} />
          <span style={{ ...SANS, fontSize: "10.5px", fontWeight: i === cur ? 700 : 500, color: i <= cur ? N : GR }}>
            {i + 1}. {s}
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
  const content = `Genera una lista di 5-7 compiti per un servizio di sicurezza.\nTipo: ${f.tipo_servizio}, Luogo: ${f.luogo}.\nSituazione: ${f.situazione}.\nFormato: frasi brevi all'imperativo (es. 'Garantire la sicurezza...').\nRestituisci SOLO la lista, un compito per riga.`;
  return callGenerate(content, 400);
}

// ── Wizard ───────────────────────────────────────────────────────────────────
export default function PpsWizard({ ppsId = null, onBack, onSaved }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(INIT);
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

  // Caricamento PPS esistente / reset per nuova PPS
  useEffect(() => {
    if (!ppsId) {
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
      setF(normalizeLoaded(data.contenuto));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [ppsId]);

  const u = (k, v) => { setSaveMsg(null); setF((p) => ({ ...p, [k]: v })); };
  // pericoli
  const setPericolo = (i, key, val) => u("pericoli", f.pericoli.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addPericolo = () => u("pericoli", [...f.pericoli, { pericolo: "", conseguenze: "", misure: "" }]);
  const delPericolo = (i) => u("pericoli", f.pericoli.length > 1 ? f.pericoli.filter((_, idx) => idx !== i) : f.pericoli);
  // referenti
  const uRef = (i, k, v) => u("referenti", f.referenti.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRef = () => u("referenti", [...f.referenti, { nome: "", ruolo: "", telefono: "", email: "" }]);
  const delRef = (i) => u("referenti", f.referenti.filter((_, idx) => idx !== i));

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
      const text = await generaCompitiAI(f);
      const list = text.split(/\r?\n/)
        .map((s) => s.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim())
        .filter(Boolean);
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
      const obj = {
        codice: f.codice,
        cliente: f.cliente,
        luogo: f.luogo,
        tipo_servizio: f.tipo_servizio,
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

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "32px 20px" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <div style={{ ...SANS, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em", color: AC, fontWeight: 700 }}>
              Prescrizioni Particolari di Servizio
            </div>
            <h1 style={{ ...SERIF, fontSize: "26px", fontWeight: 700, color: N, margin: "4px 0 0" }}>
              PPS{localId ? " — Modifica" : " — Nuova"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {saveMsg && <span style={{ ...SANS, fontSize: "13px", fontWeight: 700, color: OK }}>{saveMsg}</span>}
            <Btn variant="ghost" on={onBack}>← Lista</Btn>
            <Btn variant="accent" on={doSave} disabled={saving || loading}>{saving ? "Salvo…" : "💾 Salva"}</Btn>
          </div>
        </div>

        <div style={{ background: WH, border: `1px solid ${GB}`, borderRadius: "14px", padding: "26px", boxShadow: "0 2px 12px rgba(12,29,61,0.06)" }}>
          {loading ? (
            <div style={{ ...SANS, padding: "48px", textAlign: "center", color: TM, fontSize: "14px" }}>Caricamento della PPS in corso…</div>
          ) : (
          <>
          <StepBar cur={step} />

          {/* STEP 1 — Dati servizio */}
          {step === 0 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Codice servizio"><Txt v={f.codice} set={(v) => u("codice", v)} ph="Es. UBS-ZH-001" /></Field>
                <Field label="Numero cliente"><Txt v={f.numero_cliente} set={(v) => u("numero_cliente", v)} ph="Es. KD-705002505" /></Field>
              </div>
              <Field label="Cliente / Committente"><Txt v={f.cliente} set={(v) => u("cliente", v)} ph="Nome del cliente" /></Field>
              <Field label="Luogo / Indirizzo"><Txt v={f.luogo} set={(v) => u("luogo", v)} ph="Indirizzo / località" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <Field label="Data servizio"><Txt v={f.data} set={(v) => u("data", v)} ph="gg.mm.aaaa" /></Field>
                <Field label="Orario inizio"><Txt v={f.orario_inizio} set={(v) => u("orario_inizio", v)} ph="20:00" /></Field>
                <Field label="Orario fine"><Txt v={f.orario_fine} set={(v) => u("orario_fine", v)} ph="06:00" /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                <Field label="Tipo di servizio"><Sel v={f.tipo_servizio} set={(v) => u("tipo_servizio", v)} opts={TIPI_SERVIZIO} /></Field>
                <Field label="Numero agenti"><Txt v={f.num_agenti} set={(v) => u("num_agenti", v)} ph="Es. 2" /></Field>
              </div>
              <Field label="Note (opzionale)"><Area v={f.note_dati} set={(v) => u("note_dati", v)} ph="Indicazioni particolari, dotazioni, accessi…" rows={3} /></Field>
            </div>
          )}

          {/* STEP 2 — Situazione */}
          {step === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: TM }}>Descrizione della situazione</span>
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
                <span style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: TM }}>Compiti del personale</span>
                <Btn variant="accent" on={doAiCompiti} disabled={aiComp}>{aiComp ? "Generazione in corso…" : "✨ Genera con AI"}</Btn>
              </div>
              <ListEditor items={f.compiti} setItems={(arr) => u("compiti", arr)} ph="Es. Garantire la sicurezza degli accessi" addLabel="+ Aggiungi compito" />
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
              <div style={{ ...SANS, fontSize: "12px", fontWeight: 600, color: TM, marginBottom: "10px" }}>Pericoli particolari</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 34px", gap: "8px", marginBottom: "6px", ...SANS, fontSize: "11px", fontWeight: 700, color: GR, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <div>Pericolo</div><div>Conseguenze</div><div>Misure di protezione</div><div></div>
              </div>
              {f.pericoli.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 34px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Divisa / Tenue"><Txt v={f.divisa} set={(v) => u("divisa", v)} ph="Es. Uniforme DELTAgroup" /></Field>
                <Field label="Canale radio"><Txt v={f.radio_canale} set={(v) => u("radio_canale", v)} ph="Es. Canale 4" /></Field>
              </div>
              <Field label="Equipaggiamento">
                <ListEditor items={f.equipaggiamento} setItems={(arr) => u("equipaggiamento", arr)} ph="Es. Torcia, radio, telefono di servizio" addLabel="+ Aggiungi equipaggiamento" />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
                <Field label="Vettovagliamento"><Txt v={f.vettovagliamento} set={(v) => u("vettovagliamento", v)} ph="Es. A carico dell'agente" /></Field>
                <Field label="Punto di incontro / Parcheggio"><Txt v={f.parcheggio} set={(v) => u("parcheggio", v)} ph="Es. Ingresso principale" /></Field>
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
                    <span style={{ ...SANS, fontSize: "12px", fontWeight: 700, color: N }}>Referente {i + 1}</span>
                    {f.referenti.length > 1 && (
                      <button onClick={() => delRef(i)} style={{ ...SANS, background: "none", border: "none", color: ERR, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Rimuovi</button>
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
              : <Btn variant="accent" on={doDownload} disabled={docxLoading}>{docxLoading ? "Genero DOCX…" : "⬇ Genera DOCX"}</Btn>}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

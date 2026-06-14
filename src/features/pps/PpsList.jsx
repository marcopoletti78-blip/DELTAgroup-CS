// Archivio PPS raggruppato per cliente — modulo autonomo.
// Ogni cliente è un accordion (chiuso di default) con due sezioni:
//   ✏️ In lavorazione (bloccata=false)  ·  🔒 Validate (bloccata=true)
// Tutti i componenti sono top-level (nessun componente definito dentro un altro).

import React, { useState, useEffect, useMemo } from "react";
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
const LOCK_BG = "#f8f9fa";
const SANS = { fontFamily: "system-ui, -apple-system, sans-serif" };
const SERIF = { fontFamily: "Georgia, 'Times New Roman', serif" };

// ── Audit log ────────────────────────────────────────────────────────────────
async function logAudit(ppsId, email, azione, dettagli = {}) {
  const { error } = await supabase.from("pps_audit").insert({
    pps_id: ppsId,
    utente_email: email,
    azione,
    dettagli,
  });
  if (error) console.error("[PpsList] audit:", error.message);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const SENZA_CLIENTE = "(senza cliente)";

function Btn({ children, on, variant = "navy", disabled = false }) {
  const bg = disabled ? GR : variant === "accent" ? AC : variant === "navy" ? N : WH;
  const col = variant === "ghost" ? N : WH;
  const bd = variant === "ghost" ? `1px solid ${GB}` : "none";
  return (
    <button onClick={on} disabled={disabled} style={{
      ...SANS, padding: "10px 20px", borderRadius: "9px", border: bd, background: bg, color: col,
      fontSize: "14px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
    }}>{children}</button>
  );
}

// Pulsante piccolo per le azioni di riga
function MiniBtn({ children, on, tone = "neutral", disabled = false, title }) {
  const tones = {
    neutral: { bg: WH, col: N, bd: GB },
    accent: { bg: WH, col: AC, bd: AC },
    ok: { bg: WH, col: OK, bd: OK },
    warn: { bg: WH, col: "#b45309", bd: "#f59e0b" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <button onClick={on} disabled={disabled} title={title} style={{
      ...SANS, padding: "6px 12px", borderRadius: "7px", border: `1px solid ${disabled ? GB : t.bd}`,
      background: disabled ? GL : t.bg, color: disabled ? GR : t.col, fontSize: "12.5px", fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function nomePps(p) {
  return p.codice || p.luogo || "(senza codice)";
}

// ── Archivio PPS per cliente ──────────────────────────────────────────────────
export default function PpsList({ onNew, onOpen, onBack, profilo }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});   // { [cliente]: true }
  const [actingId, setActingId] = useState(null);  // id PPS in corso di azione

  const isAdmin = profilo?.ruolo === "admin";
  const email = profilo?.email || "";

  const load = async () => {
    setLoading(true); setErr(null);
    const { data, error } = await supabase
      .from("pps")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      setErr(`Errore nel caricamento delle PPS: ${error.message}`);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Raggruppa per cliente
  const clienti = useMemo(() => {
    const map = {};
    rows.forEach((p) => {
      const c = p.cliente || SENZA_CLIENTE;
      if (!map[c]) map[c] = [];
      map[c].push(p);
    });
    return map;
  }, [rows]);

  // Lista clienti filtrata dalla ricerca
  const clientiFiltrati = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(clienti)
      .filter((c) => !q || c.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b, "it"));
  }, [clienti, search]);

  const toggle = (c) => setExpanded((p) => ({ ...p, [c]: !p[c] }));

  // ── Azioni lock ──────────────────────────────────────────────────────────
  const doValida = async (p) => {
    if (!window.confirm(`Validare la PPS "${nomePps(p)}"? Non sarà più modificabile.`)) return;
    setActingId(p.id); setErr(null);
    const { error } = await supabase.from("pps").update({
      bloccata: true,
      bloccata_da: email,
      bloccata_il: new Date().toISOString(),
    }).eq("id", p.id);
    if (error) { setErr(`Errore durante la validazione: ${error.message}`); setActingId(null); return; }
    await logAudit(p.id, email, "bloccato");
    setActingId(null);
    load();
  };

  const doSblocca = async (p) => {
    if (!window.confirm(`Sbloccare la PPS "${nomePps(p)}"? Tornerà modificabile.`)) return;
    setActingId(p.id); setErr(null);
    const { error } = await supabase.from("pps").update({
      bloccata: false,
      bloccata_da: null,
      bloccata_il: null,
    }).eq("id", p.id);
    if (error) { setErr(`Errore durante lo sblocco: ${error.message}`); setActingId(null); return; }
    await logAudit(p.id, email, "sbloccato");
    setActingId(null);
    load();
  };

  const doCopia = async (p) => {
    setActingId(p.id); setErr(null);
    const nuovo = {
      codice: p.codice,
      cliente: p.cliente,
      luogo: p.luogo,
      tipo_servizio: p.tipo_servizio,
      versione: (p.versione || 1) + 1,
      stato: "bozza",
      bloccata: false,
      bloccata_da: null,
      bloccata_il: null,
      contenuto: p.contenuto || {},
    };
    const { data, error } = await supabase.from("pps").insert([nuovo]).select().single();
    if (error) { setErr(`Errore durante la copia: ${error.message}`); setActingId(null); return; }
    await logAudit(p.id, email, "copiato", { nuovo_id: data.id });
    await logAudit(data.id, email, "creato", { copia_da: p.id });
    setActingId(null);
    onOpen(data.id);
  };

  // ── Riga PPS ────────────────────────────────────────────────────────────
  const RigaLavorazione = (p) => (
    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", borderBottom: `1px solid ${GL}`, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", minWidth: 0 }}>
        <span style={{ ...SANS, fontSize: "14px", fontWeight: 700, color: AC, overflow: "hidden", textOverflow: "ellipsis" }}>{nomePps(p)}</span>
        <span style={{ ...SANS, fontSize: "12px", color: TM }}>v{p.versione ?? 1}</span>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <MiniBtn tone="accent" on={() => onOpen(p.id)}>Modifica →</MiniBtn>
        {isAdmin && <MiniBtn tone="ok" disabled={actingId === p.id} on={() => doValida(p)}>🔒 Valida</MiniBtn>}
      </div>
    </div>
  );

  const RigaValidata = (p) => (
    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", borderBottom: `1px solid ${GL}`, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", minWidth: 0 }}>
        <span style={{ ...SANS, fontSize: "14px", fontWeight: 600, color: TM, overflow: "hidden", textOverflow: "ellipsis" }}>{nomePps(p)}</span>
        <span style={{ ...SANS, fontSize: "12px", color: GR }}>v{p.versione ?? 1} 🔒</span>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <MiniBtn on={() => onOpen(p.id)}>Vedi →</MiniBtn>
        <MiniBtn tone="accent" disabled={actingId === p.id} on={() => doCopia(p)}>📋 Copia</MiniBtn>
        {isAdmin && <MiniBtn tone="warn" disabled={actingId === p.id} on={() => doSblocca(p)}>🔓 Sblocca</MiniBtn>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "32px 20px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ ...SANS, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em", color: AC, fontWeight: 700 }}>
              Prescrizioni Particolari di Servizio
            </div>
            <h1 style={{ ...SERIF, fontSize: "26px", fontWeight: 700, color: N, margin: "4px 0 0" }}>Archivio PPS</h1>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="ghost" on={onBack}>← Home</Btn>
            <Btn variant="accent" on={onNew}>+ Nuova PPS</Btn>
          </div>
        </div>

        {/* Ricerca cliente */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Cerca cliente…"
          style={{ ...SANS, width: "100%", padding: "11px 14px", border: `1px solid ${GB}`, borderRadius: "10px", fontSize: "14px", color: N, background: WH, outline: "none", boxSizing: "border-box", marginBottom: "16px" }}
        />

        {err && (
          <div style={{ ...SANS, marginBottom: "14px", padding: "10px 12px", background: "#fdeced", border: `1px solid ${ERR}55`, borderRadius: "8px", color: ERR, fontSize: "12.5px" }}>
            {err}
          </div>
        )}

        {loading ? (
          <div style={{ ...SANS, padding: "48px", textAlign: "center", color: TM, fontSize: "14px" }}>Caricamento in corso…</div>
        ) : clientiFiltrati.length === 0 ? (
          <div style={{ ...SANS, padding: "48px", textAlign: "center", color: TM, fontSize: "14px", background: WH, border: `1px solid ${GB}`, borderRadius: "14px" }}>
            {rows.length === 0
              ? <>Nessuna PPS salvata. Crea la prima con <b>“+ Nuova PPS”</b>.</>
              : "Nessun cliente corrisponde alla ricerca."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {clientiFiltrati.map((c) => {
              const lista = clienti[c];
              const inLav = lista.filter((p) => !p.bloccata);
              const validate = lista.filter((p) => p.bloccata);
              const isOpen = !!expanded[c];
              return (
                <div key={c} style={{ background: WH, border: `1px solid ${GB}`, borderRadius: "14px", boxShadow: "0 2px 12px rgba(12,29,61,0.06)", overflow: "hidden" }}>
                  {/* Header accordion */}
                  <button onClick={() => toggle(c)} style={{
                    ...SANS, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: "12px", padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span style={{ fontSize: "18px" }}>📁</span>
                      <span style={{ fontSize: "16px", fontWeight: 700, color: N, overflow: "hidden", textOverflow: "ellipsis" }}>{c}</span>
                      <span style={{ fontSize: "12.5px", color: TM, fontWeight: 600 }}>({lista.length} {lista.length === 1 ? "PPS" : "PPS"})</span>
                    </span>
                    <span style={{ fontSize: "16px", color: AC, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${GL}` }}>
                      {/* Sezione In lavorazione */}
                      <div style={{ background: WH, borderLeft: `3px solid ${AC}` }}>
                        <div style={{ ...SANS, fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: AC, padding: "12px 14px 6px" }}>
                          ✏️ In lavorazione
                        </div>
                        {inLav.length === 0
                          ? <div style={{ ...SANS, fontSize: "13px", color: GR, padding: "0 14px 12px" }}>Nessuna PPS in lavorazione.</div>
                          : inLav.map(RigaLavorazione)}
                      </div>

                      {/* Sezione Validate */}
                      <div style={{ background: LOCK_BG, borderLeft: `3px solid ${GR}` }}>
                        <div style={{ ...SANS, fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: TM, padding: "12px 14px 6px" }}>
                          🔒 Validate
                        </div>
                        {validate.length === 0
                          ? <div style={{ ...SANS, fontSize: "13px", color: GR, padding: "0 14px 12px" }}>Nessuna PPS validata.</div>
                          : validate.map(RigaValidata)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

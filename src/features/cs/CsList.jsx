// Archivio dei documenti CS salvati su Supabase (tabella cs_documenti).
// Tutti i componenti sono top-level (nessun componente definito dentro un altro).

import React, { useState, useEffect } from "react";
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

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATO_COLORS = {
  bozza: { bg: GL, col: TM },
  approvata: { bg: "#e7f6ec", col: OK },
  attiva: { bg: "#e8eefb", col: AC },
  archiviata: { bg: "#f1f1f4", col: GR },
};

function StatoBadge({ stato }) {
  const key = String(stato || "bozza").toLowerCase();
  const c = STATO_COLORS[key] || STATO_COLORS.bozza;
  return (
    <span style={{ ...SANS, display: "inline-block", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: c.bg, color: c.col }}>
      {stato || "bozza"}
    </span>
  );
}

const TH = { ...SANS, textAlign: "left", padding: "10px 12px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: TM, borderBottom: `2px solid ${GB}`, whiteSpace: "nowrap" };
const TD = { ...SANS, padding: "11px 12px", fontSize: "13px", color: N, borderBottom: `1px solid ${GL}` };

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

// ── Archivio CS ───────────────────────────────────────────────────────────────
export default function CsList({ onNew, onOpen, onBack, isMobile = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    const { data, error } = await supabase
      .from("cs_documenti")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      setErr(`Errore nel caricamento dei documenti CS: ${error.message}`);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const doDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Eliminare definitivamente questo documento CS?")) return;
    setDeletingId(id); setErr(null);
    const { error } = await supabase.from("cs_documenti").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setErr(`Errore durante l'eliminazione: ${error.message}`);
      return;
    }
    load();
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "32px 20px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ ...SANS, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em", color: AC, fontWeight: 700 }}>
              Concetti di Sicurezza
            </div>
            <h1 style={{ ...SERIF, fontSize: "26px", fontWeight: 700, color: N, margin: "4px 0 0" }}>CS — Archivio</h1>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn variant="ghost" on={onBack}>← Home</Btn>
            <Btn variant="accent" on={onNew}>+ Nuovo CS</Btn>
          </div>
        </div>

        <div style={{ background: WH, border: `1px solid ${GB}`, borderRadius: "14px", padding: "8px", boxShadow: "0 2px 12px rgba(12,29,61,0.06)", overflow: "hidden" }}>
          {err && (
            <div style={{ ...SANS, margin: "12px", padding: "10px 12px", background: "#fdeced", border: `1px solid ${ERR}55`, borderRadius: "8px", color: ERR, fontSize: "12.5px" }}>
              {err}
            </div>
          )}

          {loading ? (
            <div style={{ ...SANS, padding: "48px", textAlign: "center", color: TM, fontSize: "14px" }}>Caricamento in corso…</div>
          ) : rows.length === 0 ? (
            <div style={{ ...SANS, padding: "48px", textAlign: "center", color: TM, fontSize: "14px" }}>
              Nessun documento CS salvato. Crea il primo con <b>“+ Nuovo CS”</b>.
            </div>
          ) : isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px" }}>
              {rows.map((d) => (
                <div key={d.id} onClick={() => onOpen(d.id)}
                  style={{ ...SANS, cursor: "pointer", border: `1px solid ${GB}`, borderRadius: "12px", padding: "14px", background: WH, boxShadow: "0 1px 4px rgba(12,29,61,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ fontWeight: 700, color: AC, fontSize: "15px" }}>{d.nome_evento || "—"}</div>
                    <button
                      onClick={(e) => doDelete(e, d.id)}
                      disabled={deletingId === d.id}
                      title="Elimina"
                      style={{ ...SANS, background: "none", border: "none", cursor: deletingId === d.id ? "wait" : "pointer", fontSize: "18px", color: ERR, padding: "0 4px", flexShrink: 0, lineHeight: 1 }}>
                      {deletingId === d.id ? "…" : "×"}
                    </button>
                  </div>
                  <div style={{ fontSize: "13px", color: TM, marginTop: "4px" }}>📍 {d.luogo || "—"}</div>
                  <div style={{ fontSize: "13px", color: TM, marginTop: "2px" }}>{d.tipo_evento || "—"}{d.anno ? ` · ${d.anno}` : ""}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                    <StatoBadge stato={d.stato} />
                    <span style={{ fontSize: "12px", color: TM }}>v{d.versione ?? "—"}</span>
                    <span style={{ fontSize: "12px", color: TM }}>{formatDate(d.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={TH}>Nome Evento</th>
                    <th style={TH}>Luogo</th>
                    <th style={TH}>Anno</th>
                    <th style={TH}>Tipo</th>
                    <th style={TH}>Stato</th>
                    <th style={TH}>Versione</th>
                    <th style={TH}>Aggiornato il</th>
                    <th style={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} onClick={() => onOpen(d.id)} style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = GL)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ ...TD, fontWeight: 700, color: AC }}>{d.nome_evento || "—"}</td>
                      <td style={TD}>{d.luogo || "—"}</td>
                      <td style={{ ...TD, textAlign: "center" }}>{d.anno || "—"}</td>
                      <td style={TD}>{d.tipo_evento || "—"}</td>
                      <td style={TD}><StatoBadge stato={d.stato} /></td>
                      <td style={{ ...TD, textAlign: "center" }}>{d.versione ?? "—"}</td>
                      <td style={{ ...TD, color: TM, whiteSpace: "nowrap" }}>{formatDate(d.updated_at)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>
                        <button
                          onClick={(e) => doDelete(e, d.id)}
                          disabled={deletingId === d.id}
                          title="Elimina"
                          style={{ ...SANS, background: "none", border: "none", cursor: deletingId === d.id ? "wait" : "pointer", fontSize: "16px", color: ERR, padding: "4px 8px", borderRadius: "6px" }}>
                          {deletingId === d.id ? "…" : "×"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

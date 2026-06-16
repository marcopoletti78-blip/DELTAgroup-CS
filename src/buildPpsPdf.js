import pdfMake from "pdfmake/build/pdfmake";
import { vfs } from "./pdfVfs";
pdfMake.vfs = vfs;

// Generatore PDF per il modulo PPS (Prescrizioni Particolari di Servizio).
// Usa pdfmake (browser). Stile coerente con buildPpsDocx.js / buildDocx.js.
//
// Nota campi dati: l'oggetto `dati` è la struttura "contenuto" del PpsWizard,
// in snake_case (vedi buildPpsDocx.js):
//   codice, numero_cliente, cliente, luogo, data, orario_inizio, orario_fine,
//   tipo_servizio, num_agenti, situazione, compiti[], differenze_pgs,
//   pericoli[] ({pericolo, conseguenze, misure}), divisa, equipaggiamento[],
//   radio_canale, vettovagliamento, parcheggio, note_operative,
//   referenti[] ({nome, ruolo, telefono, email}), foto[] ({url, didascalia})

// ── PALETTE ──────────────────────────────────────────────────────────────────
const AC = "#1E40AF";       // accent blu
const NAVY = "#0c1d3d";
const TXT = "#1a2038";
const MUTED = "#52637a";
const GREY = "#888888";
const GB = "#d0dae8";       // bordo grigio tabelle
const BL = "#EFF6FF";       // blu chiaro header tabelle

const FOOTER_TEXT = "DELTAgroup Security & Services AG · Filiale Ticino · Via alla Foce 4, 6933 Muzzano · T +41 91 921 49 49 · ticino@delta.ch · www.delta.ch";
const FOOT_GREY = "#6B7280";   // grigio footer
const FOOT_LINE = "#D1D5DB";   // grigio linea footer

const MM = 2.834645669;          // 1mm in pt
const MARGIN = Math.round(20 * MM);  // 20mm ≈ 57pt (lati / fondo)
const A4_WIDTH = 595.28;
const CONTENT_W = A4_WIDTH - MARGIN * 2;

// ── Helpers immagini ─────────────────────────────────────────────────────────
async function fetchAsDataUrl(url) {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("[buildPpsPdf] fetch fail", url, e);
    return null;
  }
}

// ── Helpers testo ────────────────────────────────────────────────────────────
const val = (v) => (v == null ? "" : String(v).trim());
const has = (v) => val(v) !== "";

const STRIPE = "#F8FAFC";   // riga pari
const HLINE = "#E5E7EB";    // bordo orizzontale sottile

// Titolo di sezione: blocco pieno blu con testo bianco.
function sectionTitle(text) {
  return {
    table: {
      widths: ["*"],
      body: [[{
        text: String(text).toUpperCase(),
        fontSize: 10, bold: true, color: "#FFFFFF", fillColor: AC,
        border: [false, false, false, false],
      }]],
    },
    layout: { defaultBorder: false, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 16, 0, 8],
  };
}

// Separatore sottile tra le sezioni.
function sep() {
  return { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.3, lineColor: HLINE }], margin: [0, 4, 0, 0] };
}

function paragraph(text) {
  // Mantiene gli a-capo come righe separate.
  const lines = val(text).split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((l) => ({ text: l, fontSize: 9, color: TXT, margin: [0, 0, 0, 4], lineHeight: 1.25 }));
}

// Rendering dei compiti: riconosce il formato "AGENTE N (orario): Ruolo — tasks"
// e lo struttura (box agente, orario, lista puntata dei task). Altrimenti bullet.
function renderCompiti(compiti) {
  const blocks = [];
  (compiti || []).forEach((c) => {
    const text = String(c || "").trim();
    if (!text) return;
    const matchAgente = text.match(/^(AGENTE\s+\d+)\s*\(([^)]+)\)\s*:\s*([^—–]+)[—–]\s*(.+)$/s);
    if (matchAgente) {
      const [, agente, orario, ruolo, tasks] = matchAgente;
      blocks.push({
        table: { widths: ["*"], body: [[{
          text: `${agente.toUpperCase()} — ${ruolo.trim().toUpperCase()}`,
          bold: true, color: "#FFFFFF", fillColor: "#1E3A5F", fontSize: 9,
          border: [false, false, false, false],
        }]] },
        layout: { defaultBorder: false, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 5, paddingBottom: () => 5 },
        margin: [0, 8, 0, 2],
      });
      blocks.push({
        text: [{ text: "Orario di servizio: ", bold: true, fontSize: 8 }, { text: orario, fontSize: 8 }],
        margin: [0, 0, 0, 4],
      });
      blocks.push({ text: "COMPITI OPERATIVI", bold: true, fontSize: 8, color: AC, margin: [0, 2, 0, 3] });
      const taskList = tasks
        .split(/(?<=\.)\s+(?=[A-Z])|;\s*/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      taskList.forEach((task) => {
        blocks.push({
          columns: [
            { text: "•", color: AC, width: 10, fontSize: 8 },
            { text: task, fontSize: 8, width: "*" },
          ],
          margin: [4, 1, 0, 1],
        });
      });
    } else {
      blocks.push({
        columns: [
          { text: "▸", color: AC, width: 12, fontSize: 8 },
          { text: text, fontSize: 8, width: "*" },
        ],
        margin: [0, 2, 0, 2],
      });
    }
  });
  return blocks;
}

// Layout: solo bordi orizzontali sottili, nessun bordo verticale.
// fillFn(rowIndex) determina l'ombreggiatura della riga (override a livello cella).
function hLayout(fillFn) {
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0,
    hLineColor: () => HLINE,
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 4,
    paddingBottom: () => 4,
    fillColor: fillFn,
  };
}

// Righe alternate per tabella chiave/valore (senza header): pari → STRIPE.
const kvLayout = hLayout((rowIndex) => (rowIndex % 2 === 0 ? STRIPE : null));
// Righe alternate per tabelle dati con header (riga 0 = header, gestita a cella).
const dataLayout = hLayout((rowIndex) => (rowIndex > 0 && rowIndex % 2 === 0 ? STRIPE : null));

// Tabella chiave/valore (2 colonne). rows = [[label, value], ...]
function kvTable(rows) {
  const visible = rows.filter(([, v]) => has(v));
  if (!visible.length) return null;
  return {
    table: {
      widths: [160, "*"],
      body: visible.map(([label, value]) => [
        { text: label, bold: true, fontSize: 9, color: AC, fillColor: "#EFF6FF" },
        { text: val(value), fontSize: 9, color: TXT },
      ]),
    },
    layout: kvLayout,
    margin: [0, 0, 0, 4],
  };
}

// ── Funzione principale ──────────────────────────────────────────────────────
export async function buildPpsPdfBlob(dati = {}) {
  try {
  const logoDataUrl = await fetchAsDataUrl("/logo.jpg");
  const codice = val(dati.codice);

  // Header ripetuto su ogni pagina (lato destro: codice servizio + titolo)
  const header = (currentPage, pageCount) => ({
    margin: [40, 18, 40, 0],
    stack: [
      {
        columns: [
          logoDataUrl
            ? { image: logoDataUrl, width: 80, margin: [0, 0, 12, 0] }
            : { text: "", width: 80 },
          {
            width: "*",
            stack: [
              ...(codice ? [{ text: codice, bold: true, fontSize: 10, color: AC, alignment: "right" }] : []),
              { text: "PPS — Prescrizioni Particolari di Servizio", fontSize: 8, color: "#6B7280", alignment: "right", margin: [0, codice ? 2 : 0, 0, 0] },
            ],
            margin: [0, 4, 0, 0],
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 2, lineColor: AC }] },
    ],
  });

  // Footer ripetuto su ogni pagina (centrato, con linea grigia sopra) — uguale al DOCX
  const footer = (currentPage, pageCount) => ({
    margin: [40, 0, 40, 20],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: FOOT_LINE }] },
      { text: FOOTER_TEXT, alignment: "center", fontSize: 7, color: FOOT_GREY, margin: [0, 4, 0, 2] },
      { text: `Pagina ${currentPage} di ${pageCount}`, alignment: "center", fontSize: 7, color: FOOT_GREY },
    ],
  });

  const content = [];
  // Inserisce un separatore prima di ogni sezione successiva alla prima.
  const startSection = (title) => {
    if (content.length) content.push(sep());
    content.push(sectionTitle(title));
  };

  // 1. DATI SERVIZIO
  startSection("1. Dati servizio");
  const datiTable = kvTable([
    ["Cliente", dati.cliente],
    ["Codice", dati.codice],
    ["Luogo", dati.luogo],
    ["Data", dati.data],
    ["Orario", [dati.orario_inizio, dati.orario_fine].filter((s) => has(s)).join(" – ")],
    ["Tipo servizio", dati.tipo_servizio],
    ["N. agenti", dati.num_agenti],
  ]);
  content.push(datiTable || { text: "(Nessun dato del servizio)", italics: true, fontSize: 9, color: MUTED });

  // 2. SITUAZIONE
  if (has(dati.situazione)) {
    startSection("2. Situazione");
    content.push(...paragraph(dati.situazione));
  }

  // 3. COMPITI
  const compiti = (Array.isArray(dati.compiti) ? dati.compiti : String(dati.compiti || "").split(/\r?\n/))
    .map((s) => String(s).replace(/^\s*[-*•▸]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim())
    .filter(Boolean);
  if (compiti.length || has(dati.differenze_pgs)) {
    startSection("3. Compiti");
    if (compiti.length) {
      content.push(...renderCompiti(compiti));
    }
    if (has(dati.differenze_pgs)) {
      content.push({ text: "Differenze rispetto al PGS:", bold: true, fontSize: 9, color: NAVY, margin: [0, 6, 0, 3] });
      content.push(...paragraph(dati.differenze_pgs));
    }
  }

  // 4. PERICOLI PARTICOLARI
  const pericoli = (Array.isArray(dati.pericoli) ? dati.pericoli : []).filter((r) =>
    [r.pericolo, r.conseguenze, r.misure].some((v) => has(v))
  );
  if (pericoli.length) {
    startSection("4. Pericoli particolari");
    const head = ["Pericolo", "Conseguenze", "Misure"].map((h) => ({
      text: h, bold: true, fontSize: 9, color: "#FFFFFF", fillColor: AC,
    }));
    content.push({
      table: {
        widths: ["*", "*", "*"],
        headerRows: 1,
        body: [
          head,
          ...pericoli.map((r) => [
            { text: val(r.pericolo), fontSize: 9, color: TXT },
            { text: val(r.conseguenze), fontSize: 9, color: TXT },
            { text: val(r.misure), fontSize: 9, color: TXT },
          ]),
        ],
      },
      layout: dataLayout,
      margin: [0, 0, 0, 4],
    });
  }

  // 5. DETTAGLI OPERATIVI
  const equip = Array.isArray(dati.equipaggiamento)
    ? dati.equipaggiamento.map((s) => val(s)).filter(Boolean).join(", ")
    : val(dati.equipaggiamento);
  const dettagliTable = kvTable([
    ["Divisa", dati.divisa],
    ["Equipaggiamento", equip],
    ["Radio", dati.radio_canale != null ? dati.radio_canale : dati.radio],
    ["Vettovagliamento", dati.vettovagliamento],
    ["Parcheggio", dati.parcheggio],
  ]);
  if (dettagliTable) {
    startSection("5. Dettagli operativi");
    content.push(dettagliTable);
  }

  // 6. REFERENTI
  const referenti = (Array.isArray(dati.referenti) ? dati.referenti : []).filter((r) =>
    [r.nome, r.ruolo, r.telefono, r.email].some((v) => has(v))
  );
  if (referenti.length) {
    startSection("6. Referenti");
    const head = ["Nome", "Ruolo", "Telefono", "Email"].map((h) => ({
      text: h, bold: true, fontSize: 9, color: "#FFFFFF", fillColor: AC,
    }));
    content.push({
      table: {
        widths: ["*", "*", "auto", "*"],
        headerRows: 1,
        body: [
          head,
          ...referenti.map((r) => [
            { text: val(r.nome), bold: true, fontSize: 9, color: NAVY },
            { text: val(r.ruolo), fontSize: 9, color: TXT },
            { text: val(r.telefono), fontSize: 9, color: TXT },
            { text: val(r.email), fontSize: 9, color: "#1565C0" },
          ]),
        ],
      },
      layout: dataLayout,
      margin: [0, 0, 0, 4],
    });
  }

  // 7. NOTE OPERATIVE — lista puntata da note_operative / informazioni_aggiuntive
  const note = (dati.note_operative || dati.informazioni_aggiuntive || "").trim();
  if (note) {
    startSection("7. Note operative");
    const punti = note
      .split(/(?<=\.)\s+(?=[A-Z])|(?<=:)\s+(?=[A-Z])|;\s*/)
      .map((p) => p.trim())
      .filter((p) => p.length > 10);
    (punti.length ? punti : [note]).forEach((punto) => {
      content.push({
        columns: [
          { text: "•", color: AC, width: 10, fontSize: 8 },
          { text: punto, fontSize: 8, width: "*" },
        ],
        margin: [4, 2, 0, 2],
      });
    });
  }

  // 8. VALIDITÀ
  startSection("8. Validità");
  content.push({
    text: "Il presente documento è valido per il servizio indicato e deve essere conservato dall'agente durante tutta la durata del servizio.",
    fontSize: 9, color: TXT, margin: [0, 0, 0, 4], lineHeight: 1.25,
  });
  const oggi = new Date();
  const gg = String(oggi.getDate()).padStart(2, "0");
  const mm = String(oggi.getMonth() + 1).padStart(2, "0");
  const aaaa = oggi.getFullYear();
  content.push({ text: `Data generazione: ${gg}/${mm}/${aaaa}`, fontSize: 9, color: MUTED, margin: [0, 4, 0, 0] });

  // 9. ALLEGATI / FOTO
  const foto = (Array.isArray(dati.foto) ? dati.foto : []).filter((p) => p && p.url);
  if (foto.length) {
    startSection("9. Allegati e foto");
    for (const ph of foto) {
      const dataUrl = await fetchAsDataUrl(ph.url);
      if (!dataUrl) continue;
      content.push({ image: dataUrl, width: 400, margin: [0, 4, 0, 2] });
      if (has(ph.didascalia)) {
        content.push({ text: val(ph.didascalia), italics: true, fontSize: 8, color: MUTED, margin: [0, 0, 0, 8] });
      }
    }
  }

  const docDef = {
    pageSize: "A4",
    pageMargins: [40, 80, 40, 60],
    header,
    footer,
    content,
    defaultStyle: { font: "Roboto", fontSize: 9, color: TXT },
    info: { title: `PPS - ${dati.codice || dati.cliente || ""}` },
  };

  return new Promise((resolve) => {
    pdfMake.createPdf(docDef).getBlob(resolve);
  });
  } catch (err) {
    console.error("buildPpsPdfBlob error:", err);
    throw err;
  }
}

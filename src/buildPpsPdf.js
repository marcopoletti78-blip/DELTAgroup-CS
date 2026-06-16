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

function sectionTitle(text) {
  return { text: String(text).toUpperCase(), bold: true, fontSize: 10, color: AC, margin: [0, 14, 0, 6] };
}

function paragraph(text) {
  // Mantiene gli a-capo come righe separate.
  const lines = val(text).split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((l) => ({ text: l, fontSize: 9, color: TXT, margin: [0, 0, 0, 4], lineHeight: 1.25 }));
}

// Layout tabella: bordo sottile grigio
const greyLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => GB,
  vLineColor: () => GB,
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};

// Layout per tabelle dati con righe alternate (header escluso; il fillColor a
// livello cella dell'header ha comunque la precedenza su quello del layout).
const stripedLayout = {
  ...greyLayout,
  fillColor: (rowIndex) => (rowIndex > 0 && rowIndex % 2 === 0 ? "#F9FAFB" : null),
};

// Tabella chiave/valore (2 colonne). rows = [[label, value], ...]
// La colonna label è ombreggiata come "intestazione di riga".
function kvTable(rows) {
  const visible = rows.filter(([, v]) => has(v));
  if (!visible.length) return null;
  return {
    table: {
      widths: [150, "*"],
      body: visible.map(([label, value]) => [
        { text: label, bold: true, fontSize: 9, color: "#374151", fillColor: "#F8FAFC" },
        { text: val(value), fontSize: 9, color: TXT },
      ]),
    },
    layout: greyLayout,
    margin: [0, 0, 0, 4],
  };
}

// ── Funzione principale ──────────────────────────────────────────────────────
export async function buildPpsPdfBlob(dati = {}) {
  try {
  const logoDataUrl = await fetchAsDataUrl("/logo.jpg");
  const sub = [dati.cliente, dati.luogo].filter((s) => has(s)).join(" · ");

  // Header ripetuto su ogni pagina
  const header = (currentPage, pageCount) => ({
    margin: [MARGIN, 18, MARGIN, 0],
    stack: [
      {
        columns: [
          logoDataUrl
            ? { image: logoDataUrl, width: 80, margin: [0, 0, 12, 0] }
            : { text: "", width: 80 },
          {
            width: "*",
            stack: [
              { text: "PPS — Prescrizioni Particolari di Servizio", bold: true, fontSize: 9, color: NAVY, alignment: "right" },
              { text: sub || " ", fontSize: 9, color: GREY, alignment: "right", margin: [0, 2, 0, 0] },
            ],
            margin: [0, 6, 0, 0],
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 8, x2: CONTENT_W, y2: 8, lineWidth: 1.3, lineColor: AC }] },
    ],
  });

  // Footer ripetuto su ogni pagina (centrato, con linea grigia sopra)
  const footer = (currentPage, pageCount) => ({
    margin: [MARGIN, 0, MARGIN, 20],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineWidth: 0.5, lineColor: FOOT_LINE }] },
      { text: FOOTER_TEXT, alignment: "center", fontSize: 7, color: FOOT_GREY, margin: [0, 4, 0, 2] },
      { text: `Pagina ${currentPage} di ${pageCount}`, alignment: "center", fontSize: 7, color: FOOT_GREY },
    ],
  });

  const content = [];

  // 1. DATI SERVIZIO
  content.push(sectionTitle("1. Dati servizio"));
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
    content.push(sectionTitle("2. Situazione"));
    content.push(...paragraph(dati.situazione));
  }

  // 3. COMPITI
  const compiti = (Array.isArray(dati.compiti) ? dati.compiti : String(dati.compiti || "").split(/\r?\n/))
    .map((s) => String(s).replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim())
    .filter(Boolean);
  if (compiti.length || has(dati.differenze_pgs)) {
    content.push(sectionTitle("3. Compiti"));
    if (compiti.length) {
      content.push({ ul: compiti.map((c) => ({ text: c, fontSize: 9, color: TXT, margin: [0, 0, 0, 2] })), margin: [0, 0, 0, 4] });
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
    content.push(sectionTitle("4. Pericoli particolari"));
    const head = ["Pericolo", "Conseguenze", "Misure"].map((h) => ({
      text: h, bold: true, fontSize: 9, color: AC, fillColor: BL,
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
      layout: stripedLayout,
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
    content.push(sectionTitle("5. Dettagli operativi"));
    content.push(dettagliTable);
  }

  // 6. REFERENTI
  const referenti = (Array.isArray(dati.referenti) ? dati.referenti : []).filter((r) =>
    [r.nome, r.ruolo, r.telefono, r.email].some((v) => has(v))
  );
  if (referenti.length) {
    content.push(sectionTitle("6. Referenti"));
    const head = ["Nome", "Ruolo", "Telefono", "Email"].map((h) => ({
      text: h, bold: true, fontSize: 9, color: AC, fillColor: BL,
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
      layout: stripedLayout,
      margin: [0, 0, 0, 4],
    });
  }

  // 7. VALIDITÀ
  content.push(sectionTitle("7. Validità"));
  content.push({
    text: "Il presente documento è valido per il servizio indicato e deve essere conservato dall'agente durante tutta la durata del servizio.",
    fontSize: 9, color: TXT, margin: [0, 0, 0, 4], lineHeight: 1.25,
  });
  const oggi = new Date();
  const gg = String(oggi.getDate()).padStart(2, "0");
  const mm = String(oggi.getMonth() + 1).padStart(2, "0");
  const aaaa = oggi.getFullYear();
  content.push({ text: `Data generazione: ${gg}/${mm}/${aaaa}`, fontSize: 9, color: MUTED, margin: [0, 4, 0, 0] });

  // 8. ALLEGATI / FOTO
  const foto = (Array.isArray(dati.foto) ? dati.foto : []).filter((p) => p && p.url);
  if (foto.length) {
    content.push(sectionTitle("8. Allegati e foto"));
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
    pageMargins: [MARGIN, 84, MARGIN, MARGIN + 18],
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

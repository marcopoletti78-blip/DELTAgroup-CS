// Generatore DOCX per il modulo PPS (Prescrizioni Particolari di Servizio).
// Modulo autonomo: NON dipende da src/buildDocx.js (che resta dedicato al CS),
// ma ne riusa la stessa logica/stile (palette, header/footer, tabelle docx)
// per garantire coerenza grafica con i documenti DELTAgroup.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, ImageRun, Header, Footer,
  BorderStyle, WidthType, ShadingType, PageNumber, PageOrientation,
  VerticalAlign,
} from "docx";

// ── PALETTE (hex senza #) — allineata a buildDocx.js ────────────────────────
const NAVY = "0c1d3d";
const RED = "1E40AF";
const TEXT = "1a2038";
const MUTED = "52637a";
const GB = "d0dae8";
const GL = "edf1f8";

const FOOTER_TEXT = "DELTAgroup Security & Services AG · Filiale Ticino · Via alla Foce 4, 6933 Muzzano · T +41 91 921 49 49 · ticino@delta.ch · www.delta.ch";

// ── Helpers di base (mirror di buildDocx.js) ────────────────────────────────
const txt = (text, opts = {}) => new TextRun({ text: String(text ?? ""), ...opts });
const para = (children, opts = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  ...opts,
});
const spacer = (after = 120) => new Paragraph({ children: [], spacing: { after } });

function defaultBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: GB };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function noBorders() {
  const n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n };
}

function bytesFromBase64DataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function fetchAsBytes(url) {
  try {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    return new Uint8Array(buf);
  } catch (e) {
    console.error("[buildPpsDocx] fetch logo fail", url, e);
    return null;
  }
}

async function resolveLogoBytes(headerLogoUrl) {
  if (!headerLogoUrl) return null;
  if (headerLogoUrl instanceof Uint8Array) return headerLogoUrl;
  if (typeof headerLogoUrl === "string") {
    if (headerLogoUrl.startsWith("data:")) return bytesFromBase64DataUrl(headerLogoUrl);
    return await fetchAsBytes(headerLogoUrl);
  }
  return null;
}

async function getImageDimensions(bytes, fallback = { w: 800, h: 600 }) {
  if (!bytes || typeof Image === "undefined") return fallback;
  try {
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob);
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(fallback);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return dims;
  } catch (e) {
    return fallback;
  }
}

// Adatta l'immagine alla larghezza massima (px) mantenendo le proporzioni.
function fitImage(w, h, maxW = 500) {
  if (!w || !h) return { width: maxW, height: Math.round(maxW * 0.66) };
  if (w <= maxW) return { width: Math.round(w), height: Math.round(h) };
  return { width: maxW, height: Math.round((h / w) * maxW) };
}

// ── Header / Footer (mirror di buildDocx.js) ────────────────────────────────
// Header in stile DELTAgroup: tabella 2 colonne (logo a sx con bordo destro,
// dati servizio a dx allineati a destra) + divisore con bordo inferiore blu.
function buildHeader(logoBytes, data = {}) {
  const sub = [data.cliente, data.luogo].filter(Boolean).join(" · ");

  const leftChildren = logoBytes
    ? [para([new ImageRun({ data: logoBytes, transformation: { width: 170, height: 62 }, type: "jpg" })], { spacing: { after: 0 } })]
    : [para([], { spacing: { after: 0 } })];

  const headerTable = new Table({
    width: { size: 10206, type: WidthType.DXA },
    columnWidths: [3600, 6606],
    borders: noBorders(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3600, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: { ...noBorders(), right: { style: BorderStyle.SINGLE, size: 8, color: "cccccc" } },
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 6606, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: noBorders(),
            margins: { left: 200 },
            children: [
              para([txt(sub || " ", { bold: true, size: 22, color: NAVY })], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
              para([txt("PPS — Prescrizioni Particolari di Servizio", { size: 18, color: "666666" })], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
            ],
          }),
        ],
      }),
    ],
  });

  const divider = new Paragraph({
    children: [],
    spacing: { before: 40, after: 0 },
    border: { bottom: { color: NAVY, space: 1, style: BorderStyle.SINGLE, size: 24 } },
  });

  return new Header({ children: [headerTable, divider] });
}

function buildFooter() {
  return new Footer({
    children: [
      para([txt(FOOTER_TEXT, { size: 14, color: MUTED })], {
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 40 },
        border: { top: { color: NAVY, space: 1, style: BorderStyle.SINGLE, size: 6 } },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Pagina ", size: 14, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: MUTED }),
          new TextRun({ text: " di ", size: 14, color: MUTED }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: MUTED }),
        ],
      }),
    ],
  });
}

// Intestazione di sezione: stile a "etichetta" (shading + bordo sinistro),
// senza HeadingLevel per non generare voci di sommario.
function sectionHeading(num, title) {
  return new Paragraph({
    children: [txt(`${num}  ${title}`, { bold: true, color: NAVY, size: 22 })],
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "EEF2FF" },
    spacing: { before: 80, after: 80 },
    keepNext: true,
  });
}

function subHeading(title) {
  return new Paragraph({
    children: [txt(title, { bold: true, color: NAVY, size: 20, underline: {} })],
    spacing: { before: 160, after: 80 },
    keepNext: true,
  });
}

// ── Larghezze tabelle (full-width = larghezza contenuto 11906 - 850 - 850) ──
const TBL_W = 10206;
const COLS_KV = [3600, 6606];        // 2 colonne (Dati servizio, Dettagli)
const COLS_PER = [3000, 3000, 4206]; // 3 colonne (Pericoli)
const COLS_REF = [2800, 2800, 2300, 2306]; // 4 colonne (Referenti)
const WHITE = { type: ShadingType.CLEAR, color: "auto", fill: "FFFFFF" };

// ── Tabella generica chiave/valore (2 colonne) ──────────────────────────────
function kvTable(rows) {
  const visible = rows.filter(([, v]) => v != null && String(v).trim() !== "");
  if (!visible.length) return null;
  return new Table({
    width: { size: TBL_W, type: WidthType.DXA },
    columnWidths: COLS_KV,
    rows: visible.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: COLS_KV[0], type: WidthType.DXA },
          shading: WHITE,
          children: [para([txt(label, { bold: true, color: NAVY, size: 18 })], { spacing: { after: 0 } })],
        }),
        new TableCell({
          width: { size: COLS_KV[1], type: WidthType.DXA },
          shading: WHITE,
          children: [para([txt(value, { color: TEXT, size: 18 })], { spacing: { after: 0 } })],
        }),
      ],
    })),
    borders: defaultBorders(),
  });
}

// ── SEZ 1 — Dati del servizio ───────────────────────────────────────────────
function buildServizioTable(data) {
  return kvTable([
    ["Codice servizio", data.codice],
    ["Numero cliente", data.numero_cliente],
    ["Cliente / Committente", data.cliente],
    ["Luogo / Indirizzo", data.luogo],
    ["Data", data.data],
    ["Orario", [data.orario_inizio, data.orario_fine].filter(Boolean).join(" – ")],
    ["Tipo di servizio", data.tipo_servizio],
    ["Numero agenti", data.num_agenti],
    ["Note", data.note_dati],
  ]);
}

// ── SEZ 3 — Compiti (lista puntata) ─────────────────────────────────────────
function compitiList(compiti) {
  const lines = (Array.isArray(compiti) ? compiti : String(compiti || "").split(/\r?\n/))
    .map((s) => String(s).replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return lines.map((l) => para([txt(l, { size: 20, color: TEXT })], {
    bullet: { level: 0 }, spacing: { after: 60 },
  }));
}

// ── SEZ 4 — Pericoli particolari (tabella 3 colonne) ────────────────────────
function buildPericoliTable(pericoli) {
  const list = (pericoli || []).filter((r) =>
    [r.pericolo, r.conseguenze, r.misure].some((v) => v && String(v).trim() !== "")
  );
  if (!list.length) return null;
  const headers = ["Pericolo", "Conseguenze", "Misure di protezione"];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, ci) => new TableCell({
      width: { size: COLS_PER[ci], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      children: [para([txt(h, { bold: true, color: "FFFFFF", size: 18 })], { spacing: { after: 0 } })],
    })),
  });
  const bodyRows = list.map((r) => new TableRow({
    children: [r.pericolo, r.conseguenze, r.misure].map((c, ci) => new TableCell({
      width: { size: COLS_PER[ci], type: WidthType.DXA },
      shading: WHITE,
      children: [para([txt(c || "", { size: 18 })], { spacing: { after: 0 } })],
    })),
  }));
  return new Table({
    width: { size: TBL_W, type: WidthType.DXA },
    columnWidths: COLS_PER,
    rows: [headerRow, ...bodyRows],
    borders: defaultBorders(),
  });
}

// ── SEZ 5 — Dettagli operativi (tabella chiave/valore) ──────────────────────
function buildDettagliTable(data) {
  const equip = Array.isArray(data.equipaggiamento)
    ? data.equipaggiamento.map((s) => String(s).trim()).filter(Boolean).join(", ")
    : (data.equipaggiamento || "");
  return kvTable([
    ["Divisa / Tenue", data.divisa],
    ["Equipaggiamento", equip],
    ["Canale radio", data.radio_canale],
    ["Vettovagliamento", data.vettovagliamento],
    ["Punto di incontro / Parcheggio", data.parcheggio],
    ["Note operative", data.note_operative],
  ]);
}

// ── SEZ 6 — Referenti (tabella) ─────────────────────────────────────────────
function buildReferentiTable(referenti) {
  const list = (referenti || []).filter((r) =>
    [r.nome, r.ruolo, r.telefono, r.email].some((v) => v && String(v).trim() !== "")
  );
  const headers = ["Nome", "Ruolo / Funzione", "Telefono", "E-mail"];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, ci) => new TableCell({
      width: { size: COLS_REF[ci], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      children: [para([txt(h, { bold: true, color: "FFFFFF", size: 18 })], { spacing: { after: 0 } })],
    })),
  });
  if (!list.length) {
    return new Table({
      width: { size: TBL_W, type: WidthType.DXA },
      columnWidths: COLS_REF,
      rows: [headerRow, new TableRow({
        children: [new TableCell({
          columnSpan: 4,
          shading: WHITE,
          children: [para([txt("(Nessun referente inserito)", { italics: true, color: MUTED, size: 18 })], { spacing: { after: 0 } })],
        })],
      })],
      borders: defaultBorders(),
    });
  }
  const bodyRows = list.map((r) => new TableRow({
    children: [
      new TableCell({
        width: { size: COLS_REF[0], type: WidthType.DXA },
        shading: WHITE,
        children: [para([txt(r.nome || "", { bold: true, color: NAVY, size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        width: { size: COLS_REF[1], type: WidthType.DXA },
        shading: WHITE,
        children: [para([txt(r.ruolo || "", { size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        width: { size: COLS_REF[2], type: WidthType.DXA },
        shading: WHITE,
        children: [para([txt(r.telefono || "", { size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        width: { size: COLS_REF[3], type: WidthType.DXA },
        shading: WHITE,
        children: [para([txt(r.email || "", { size: 18, color: "1565C0" })], { spacing: { after: 0 } })],
      }),
    ],
  }));
  return new Table({
    width: { size: TBL_W, type: WidthType.DXA },
    columnWidths: COLS_REF,
    rows: [headerRow, ...bodyRows],
    borders: defaultBorders(),
  });
}

const VALIDITA_TEXT = "Queste prescrizioni particolari di servizio sono parte integrante della conferma d'ordine e regolano tutti i punti non contemplati o divergenti dalle prescrizioni generali per la sorveglianza.";

// ── Funzione principale ─────────────────────────────────────────────────────
// data = struttura "contenuto" del wizard (snake_case):
// { codice, numero_cliente, cliente, luogo, data, orario_inizio, orario_fine,
//   tipo_servizio, num_agenti, note_dati, situazione, compiti[], differenze_pgs,
//   pericoli[], divisa, equipaggiamento[], radio_canale, vettovagliamento,
//   parcheggio, note_operative, referenti[] }
export async function generatePpsDocxBlob({ data = {}, headerLogoUrl = null }) {
  const logoBytes = await resolveLogoBytes(headerLogoUrl);

  const children = [];

  // Numerazione dinamica: il contatore avanza solo per le sezioni effettivamente
  // incluse, così non restano "buchi" quando una sezione opzionale è omessa.
  let n = 0;
  const heading = (title) => sectionHeading(String(++n), title);

  // Dati del servizio (sempre presente)
  children.push(heading("Dati del servizio"));
  const servTable = buildServizioTable(data);
  if (servTable) { children.push(servTable); children.push(spacer()); }
  else children.push(para([txt("(Nessun dato del servizio inserito)", { italics: true, color: MUTED, size: 18 })], { spacing: { after: 120 } }));

  // Situazione (omessa se vuota)
  if (data.situazione && String(data.situazione).trim()) {
    children.push(heading("Situazione"));
    for (const line of String(data.situazione).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      children.push(para([txt(line, { size: 20, color: TEXT })], { spacing: { after: 100 } }));
    }
    children.push(spacer());
  }

  // Compiti del personale (sempre presente)
  children.push(heading("Compiti del personale"));
  const compiti = compitiList(data.compiti);
  if (compiti) children.push(...compiti);
  else children.push(para([txt("(Nessun compito specificato)", { italics: true, color: MUTED, size: 18 })], { spacing: { after: 60 } }));
  if (data.differenze_pgs && String(data.differenze_pgs).trim()) {
    children.push(subHeading("Differenze rispetto alle PGS"));
    for (const line of String(data.differenze_pgs).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      children.push(para([txt(line, { size: 20, color: TEXT })], { spacing: { after: 100 } }));
    }
  }
  children.push(spacer());

  // Pericoli particolari (omessa se nessuna riga)
  const pericoliTable = buildPericoliTable(data.pericoli);
  if (pericoliTable) {
    children.push(heading("Pericoli particolari"));
    children.push(pericoliTable);
    children.push(spacer());
  }

  // Dettagli operativi (omessa se nessun valore)
  const dettagliTable = buildDettagliTable(data);
  if (dettagliTable) {
    children.push(heading("Dettagli operativi"));
    children.push(dettagliTable);
    children.push(spacer());
  }

  // Referenti (sempre presente)
  children.push(heading("Referenti"));
  children.push(buildReferentiTable(data.referenti));
  children.push(spacer());

  // Validità (sempre presente)
  children.push(heading("Validità"));
  children.push(para([txt(VALIDITA_TEXT, { size: 20, color: TEXT })], { spacing: { after: 60 } }));

  // Allegati — Foto sopralluogo (omessa se nessuna foto)
  const foto = Array.isArray(data.foto) ? data.foto.filter((p) => p && p.url) : [];
  if (foto.length) {
    children.push(heading("Allegati — Foto sopralluogo"));
    for (const ph of foto) {
      const bytes = await fetchAsBytes(ph.url);
      if (!bytes) continue;
      if (ph.didascalia && String(ph.didascalia).trim()) {
        children.push(para([txt(ph.didascalia, { bold: true, size: 20, color: NAVY })], { spacing: { after: 40 } }));
      }
      const dims = await getImageDimensions(bytes);
      const fit = fitImage(dims.w, dims.h, 500);
      children.push(para([new ImageRun({ data: bytes, transformation: fit, type: "jpg" })], { spacing: { after: 120 } }));
      children.push(spacer());
    }
  }

  const sectionOpts = {
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT },
        margin: { top: 1700, right: 850, bottom: 1100, left: 850 },
      },
    },
    headers: { default: buildHeader(logoBytes, data) },
    footers: { default: buildFooter() },
  };

  const doc = new Document({
    creator: "DELTAgroup CS",
    title: `PPS - ${data.codice || data.cliente || ""}`,
    description: "PPS — Prescrizioni Particolari di Servizio generato da DELTAgroup CS",
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20, color: TEXT } },
        heading1: {
          run: { font: "Arial", size: 26, bold: true, color: NAVY },
          paragraph: { spacing: { before: 240, after: 140 }, keepNext: true },
        },
        heading2: {
          run: { font: "Arial", size: 22, bold: true, color: NAVY },
          paragraph: { spacing: { before: 160, after: 80 }, keepNext: true },
        },
      },
    },
    sections: [{ ...sectionOpts, children }],
  });

  return await Packer.toBlob(doc);
}

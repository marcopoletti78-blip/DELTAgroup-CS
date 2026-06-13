// Generatore DOCX per il modulo PPS/SPADO (Piano di Pronto Servizio).
// Modulo autonomo: NON dipende da src/buildDocx.js (che resta dedicato al CS),
// ma ne riusa la stessa logica/stile (palette, header/footer, tabelle docx)
// per garantire coerenza grafica con i documenti DELTAgroup.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, ImageRun, Header, Footer,
  BorderStyle, WidthType, ShadingType, PageNumber, PageOrientation,
} from "docx";

// ── PALETTE (hex senza #) — allineata a buildDocx.js ────────────────────────
const NAVY = "0c1d3d";
const RED = "c8102e";
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

// ── Header / Footer (mirror di buildDocx.js) ────────────────────────────────
function buildHeader(logoBytes) {
  const children = [];
  if (logoBytes) {
    children.push(new ImageRun({
      data: logoBytes,
      transformation: { width: 110, height: 40 },
      type: "jpg",
    }));
  }
  return new Header({
    children: [
      para(children, {
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        border: { bottom: { color: NAVY, space: 1, style: BorderStyle.SINGLE, size: 12 } },
      }),
    ],
  });
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

// ── Blocchi titolo ──────────────────────────────────────────────────────────
function titleBlock(data) {
  const out = [];
  out.push(para([txt("PIANO DI PRONTO SERVIZIO", { bold: true, color: NAVY, size: 32 })], {
    alignment: AlignmentType.CENTER, spacing: { after: 40 },
  }));
  out.push(para([txt("PPS / SPADO", { bold: true, color: RED, size: 22 })], {
    alignment: AlignmentType.CENTER, spacing: { after: 160 },
  }));
  if (data.titolo) {
    out.push(para([txt(data.titolo, { bold: true, color: NAVY, size: 28 })], {
      alignment: AlignmentType.CENTER, spacing: { after: 60 },
    }));
  }
  const sub = [data.luogo, data.data].filter(Boolean).join(" · ");
  if (sub) {
    out.push(para([txt(sub, { color: MUTED, size: 22 })], {
      alignment: AlignmentType.CENTER, spacing: { after: 240 },
    }));
  }
  return out;
}

function sectionHeading(num, title) {
  return new Paragraph({
    children: [txt(`${num}  ${title}`, { bold: true, color: NAVY, size: 26 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 140 },
    keepNext: true,
    border: { bottom: { color: GB, space: 2, style: BorderStyle.SINGLE, size: 6 } },
  });
}

// ── Sezione 1: dati del servizio (tabella label/valore) ─────────────────────
function buildServizioTable(data) {
  const rows = [
    ["Titolo / Servizio", data.titolo],
    ["Committente / Cliente", data.cliente],
    ["Luogo", data.luogo],
    ["Data", data.data],
    ["Orario", [data.orarioInizio, data.orarioFine].filter(Boolean).join(" – ")],
    ["Tipo di servizio", data.tipoServizio],
    ["Numero agenti", data.numAgenti],
    ["Note", data.note],
  ].filter(([, v]) => v != null && String(v).trim() !== "");

  if (!rows.length) return null;

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: rows.map(([label, value], i) => new TableRow({
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? GL : "FFFFFF" },
          children: [para([txt(label, { bold: true, color: NAVY, size: 18 })], { spacing: { after: 0 } })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? GL : "FFFFFF" },
          children: [para([txt(value, { color: TEXT, size: 18 })], { spacing: { after: 0 } })],
        }),
      ],
    })),
    borders: defaultBorders(),
  });
}

// ── Sezione 2: compiti (lista puntata) ──────────────────────────────────────
function buildCompitiBlocks(compiti) {
  const lines = String(compiti || "")
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim())
    .filter(Boolean);
  if (!lines.length) {
    return [para([txt("(Nessun compito specificato)", { italics: true, color: MUTED, size: 18 })], { spacing: { after: 60 } })];
  }
  return lines.map((l) => para([txt(l, { size: 20, color: TEXT })], {
    bullet: { level: 0 },
    spacing: { after: 60 },
  }));
}

// ── Sezione 3: referenti (tabella) ──────────────────────────────────────────
function buildReferentiTable(referenti) {
  const list = (referenti || []).filter((r) =>
    [r.nome, r.ruolo, r.telefono, r.email].some((v) => v && String(v).trim() !== "")
  );
  const headers = ["Nome", "Ruolo / Funzione", "Telefono", "E-mail"];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => new TableCell({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      children: [para([txt(h, { bold: true, color: "FFFFFF", size: 18 })], { spacing: { after: 0 } })],
    })),
  });
  if (!list.length) {
    return new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [headerRow, new TableRow({
        children: [new TableCell({
          columnSpan: 4,
          children: [para([txt("(Nessun referente inserito)", { italics: true, color: MUTED, size: 18 })], { spacing: { after: 0 } })],
        })],
      })],
      borders: defaultBorders(),
    });
  }
  const bodyRows = list.map((r, i) => new TableRow({
    children: [
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "FFFFFF" : "F9FBFD" },
        children: [para([txt(r.nome || "", { bold: true, color: NAVY, size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "FFFFFF" : "F9FBFD" },
        children: [para([txt(r.ruolo || "", { size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "FFFFFF" : "F9FBFD" },
        children: [para([txt(r.telefono || "", { size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "FFFFFF" : "F9FBFD" },
        children: [para([txt(r.email || "", { size: 18, color: "1565C0" })], { spacing: { after: 0 } })],
      }),
    ],
  }));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
    borders: defaultBorders(),
  });
}

// ── Funzione principale ─────────────────────────────────────────────────────
// data = {
//   titolo, cliente, luogo, data, orarioInizio, orarioFine, tipoServizio,
//   numAgenti, note, compiti (string multilinea),
//   referenti: [{ nome, ruolo, telefono, email }]
// }
export async function generatePpsDocxBlob({ data = {}, headerLogoUrl = null }) {
  const logoBytes = await resolveLogoBytes(headerLogoUrl);

  const children = [];
  children.push(...titleBlock(data));

  children.push(sectionHeading("1", "Dati del servizio"));
  const servTable = buildServizioTable(data);
  if (servTable) { children.push(servTable); children.push(spacer()); }
  else children.push(para([txt("(Nessun dato del servizio inserito)", { italics: true, color: MUTED, size: 18 })], { spacing: { after: 120 } }));

  children.push(sectionHeading("2", "Compiti del personale"));
  children.push(...buildCompitiBlocks(data.compiti));
  children.push(spacer());

  children.push(sectionHeading("3", "Referenti"));
  children.push(buildReferentiTable(data.referenti));

  const sectionOpts = {
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT },
        margin: { top: 1700, right: 850, bottom: 1100, left: 850 },
      },
    },
    headers: { default: buildHeader(logoBytes) },
    footers: { default: buildFooter() },
  };

  const doc = new Document({
    creator: "DELTAgroup CS",
    title: `PPS / SPADO - ${data.titolo || ""}`,
    description: "Piano di Pronto Servizio generato da DELTAgroup CS",
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20, color: TEXT } },
        heading1: {
          run: { font: "Arial", size: 26, bold: true, color: NAVY },
          paragraph: { spacing: { before: 240, after: 140 }, keepNext: true },
        },
      },
    },
    sections: [{ ...sectionOpts, children }],
  });

  return await Packer.toBlob(doc);
}

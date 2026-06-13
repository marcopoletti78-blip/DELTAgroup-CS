// Generatore DOCX per Concetto di Sicurezza DELTAgroup.
// Usa la libreria `docx` (browser-friendly) per produrre un file .docx
// con paginazione gestita da Word (no CSS print hack).

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, ImageRun, TableOfContents, Header, Footer,
  BorderStyle, WidthType, convertInchesToTwip, ShadingType, PageNumber,
  PageOrientation, LevelFormat, TabStopType, TabStopPosition,
  PageBreak, VerticalAlign, TableLayoutType,
} from "docx";

// ── PALETTE (hex senza #) ───────────────────────────────────────────────────
const NAVY = "0c1d3d";
const NAVY_MID = "1a3461";
const RED = "c8102e";
const TEXT = "1a2038";
const MUTED = "52637a";
const GREY = "9baab8";
const GB = "d0dae8";
const GL = "edf1f8";

const FOOTER_TEXT = "DELTAgroup Security & Services AG · Filiale Ticino · Via alla Foce 4, 6933 Muzzano · T +41 91 921 49 49 · ticino@delta.ch · www.delta.ch";

// ── Helpers di base ─────────────────────────────────────────────────────────
const txt = (text, opts = {}) => new TextRun({ text: String(text ?? ""), ...opts });
const para = (children, opts = {}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  ...opts,
});
const spacer = (after = 120) => new Paragraph({ children: [], spacing: { after } });

function htmlToPlain(s) {
  if (!s) return "";
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = String(s);
    tmp.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
    tmp.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,tr").forEach((el) => el.append("\n"));
    return (tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }
  return String(s).replace(/<[^>]+>/g, "").trim();
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
    console.error("[buildDocx] fetch fail", url, e);
    return null;
  }
}

function inferImageType(name, mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  if (m.includes("webp") || m.includes("bmp")) return "png";
  const n = (name || "").toLowerCase();
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  if (n.endsWith(".gif")) return "gif";
  return "png";
}

async function getImageDimensions(bytes, fallback = { w: 600, h: 400 }) {
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

function fitImageInsidePage(naturalW, naturalH, maxW = 480, maxH = 620) {
  if (!naturalW || !naturalH) return { width: maxW, height: maxH };
  const ratio = naturalW / naturalH;
  let w = naturalW;
  let h = naturalH;
  if (w > maxW) { w = maxW; h = w / ratio; }
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { width: Math.round(w), height: Math.round(h) };
}

// ── Markdown → array di Paragraph/Table ─────────────────────────────────────
function markdownToDocx(src) {
  if (!src) return [];
  const lines = String(src).split(/\r?\n/);
  const out = [];
  let paraBuf = [];
  let listBuf = [];
  let listOrdered = false;
  let tableBuf = null;

  const flushPara = () => {
    if (!paraBuf.length) return;
    const text = paraBuf.join(" ").trim();
    if (text) out.push(para(parseInline(text), { spacing: { after: 120 } }));
    paraBuf = [];
  };
  const flushList = () => {
    if (!listBuf.length) return;
    // Tutti i punti elenco diventano bullet (anche le liste "1. 2. 3." del
    // markdown). Evita la numerazione che continua tra sub diversi nel DOCX.
    for (const item of listBuf) {
      // Strip prefisso "1. " o "1) " dall'item se è una lista ordinata.
      const clean = listOrdered ? item.replace(/^\s*\d+[\.\)]\s+/, "") : item;
      out.push(para(parseInline(clean), {
        bullet: { level: 0 },
        spacing: { after: 60 },
      }));
    }
    listBuf = [];
  };
  const flushTable = () => {
    if (!tableBuf) return;
    out.push(buildTableFromMd(tableBuf));
    tableBuf = null;
  };
  const parseRow = (line) => {
    const t = line.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) return null;
    return t.slice(1, -1).split("|").map((c) => c.trim());
  };
  const isSeparator = (line) => {
    const cells = parseRow(line);
    if (!cells || !cells.length) return false;
    return cells.every((c) => /^:?-{2,}:?$/.test(c));
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/g, "");
    const trimmed = line.trim();

    // Tabella inizio
    if (!tableBuf && parseRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      flushList(); flushPara();
      tableBuf = { headers: parseRow(line), rows: [] };
      i += 1;
      continue;
    }
    if (tableBuf) {
      const row = parseRow(line);
      if (row) { tableBuf.rows.push(row); continue; }
      flushTable();
    }

    if (!trimmed) { flushList(); flushPara(); continue; }

    const h1m = line.match(/^#\s+(.*)$/);
    const h2m = line.match(/^##\s+(.*)$/);
    const h3m = line.match(/^###\s+(.*)$/);
    const h4m = line.match(/^####\s+(.*)$/);
    const olm = line.match(/^\s*\d+[\.\)]\s+(.*)$/);
    const ulm = line.match(/^\s*[-*]\s+(.*)$/);

    if (h4m || h3m || h2m || h1m) {
      flushList(); flushPara();
      const text = (h4m || h3m || h2m || h1m)[1];
      const level = h4m ? HeadingLevel.HEADING_4 : h3m ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
      out.push(para(parseInline(text), { heading: level, spacing: { before: 160, after: 80 }, keepNext: true }));
      continue;
    }
    if (olm) {
      flushPara();
      if (!listOrdered) { flushList(); listOrdered = true; }
      listBuf.push(olm[1]);
      continue;
    }
    if (ulm) {
      flushPara();
      if (listOrdered) { flushList(); listOrdered = false; }
      listBuf.push(ulm[1]);
      continue;
    }
    flushList();
    paraBuf.push(line);
  }
  flushTable(); flushList(); flushPara();
  return out;
}

function parseInline(text) {
  // Solo **bold** per ora.
  const out = [];
  const re = /\*\*([^*\n]+)\*\*/g;
  let lastIdx = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(txt(text.slice(lastIdx, m.index)));
    out.push(txt(m[1], { bold: true }));
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) out.push(txt(text.slice(lastIdx)));
  return out.length ? out : [txt(text)];
}

function buildTableFromMd(t) {
  const cols = t.headers.length;
  const cellW = Math.floor(9000 / Math.max(cols, 1));
  const headerRow = new TableRow({
    tableHeader: true,
    children: t.headers.map((h) => new TableCell({
      width: { size: cellW, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      children: [para([txt(h, { bold: true, color: "FFFFFF" })], { spacing: { after: 0 } })],
    })),
  });
  const bodyRows = t.rows.map((r) => new TableRow({
    children: r.map((c) => new TableCell({
      width: { size: cellW, type: WidthType.DXA },
      children: [para(parseInline(c), { spacing: { after: 0 } })],
    })),
  }));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
    borders: defaultBorders(),
  });
}

function defaultBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: GB };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

// ── Render del contenuto custom (markdown o html-plain) ─────────────────────
function renderCustomContent(content) {
  if (!content) return [];
  const s = String(content).trim();
  if (!s) return [];
  // Se sembra HTML, convertilo prima in plain (paragrafi separati da \n\n).
  if (/<[a-z][\s\S]*>/i.test(s)) return markdownToDocx(htmlToPlain(s));
  return markdownToDocx(s);
}

// ── Header / Footer ─────────────────────────────────────────────────────────
// Header in stile DELTAgroup: tabella 2 colonne (logo a sx con bordo destro,
// nome evento a dx allineato a destra) + divisore con bordo inferiore blu.
function buildHeader(logoBytes, data = {}) {
  const sub = ["Concetto di Sicurezza", data?.anno].filter(Boolean).join(" · ");

  const leftChildren = logoBytes
    ? [para([new ImageRun({ data: logoBytes, transformation: { width: 170, height: 62 }, type: "jpg" })], { spacing: { after: 0 } })]
    : [para([], { spacing: { after: 0 } })];

  const headerTable = new Table({
    width: { size: 10206, type: WidthType.DXA },
    columnWidths: [3600, 6606],
    layout: TableLayoutType.FIXED,
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
              para([txt(data?.nomeEvento || " ", { bold: true, size: 22, color: NAVY })], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
              para([txt(sub, { size: 18, color: "666666" })], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
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

// ── Sezione Banner (header colorato di un capitolo o allegato) ──────────────
function bannerParagraph(text, opts = {}) {
  // Banner usato per gli allegati. È un HEADING_1 (così appare nel TOC) ma
  // con shading navy e testo bianco per mantenere l'aspetto "etichetta".
  return new Paragraph({
    children: [txt(text, { bold: true, color: "FFFFFF", size: 24 })],
    shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
    spacing: { before: 240, after: 200 },
    keepNext: true,
    heading: HeadingLevel.HEADING_1,
    ...opts,
  });
}

function subTitleParagraph(n, t, displayNum) {
  // n è il numero finale (es. "1.1"). Tipico stile del sub: sottolineato uppercase navy.
  return para([
    txt(`${displayNum ?? n}  `, { bold: true, color: NAVY, size: 22 }),
    txt(String(t || "").toUpperCase(), { bold: true, color: NAVY, size: 22, underline: {} }),
  ], { spacing: { before: 200, after: 80 }, keepNext: true, heading: HeadingLevel.HEADING_2 });
}

function mainChapterHeading(num, title) {
  return new Paragraph({
    children: [
      txt(`${num}  ${title}`, { bold: true, color: NAVY, size: 28 }),
    ],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 200 },
    keepNext: true,
    pageBreakBefore: true,
  });
}

// ── Tabelle dati (contatti ps1, righe ps4, rischi ps3) ──────────────────────
function buildContactsTable(contatti) {
  const headers = ["Aree", "Società / Persona", "Tel. Azienda / E-Mail", "Tel. Mobile"];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => new TableCell({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      children: [para([txt(h, { bold: true, color: "FFFFFF", size: 18 })], { spacing: { after: 0 } })],
    })),
  });
  const rows = (contatti || []).map((c) => new TableRow({
    children: [
      new TableCell({ children: [para([txt(c.area || "", { bold: true, color: NAVY, size: 18 })], { spacing: { after: 0 } })] }),
      new TableCell({ children: [para([txt(c.societa || "", { size: 18 })], { spacing: { after: 0 } })] }),
      new TableCell({ children: [para([txt(c.email || c.telAzienda || "", { size: 18, color: "1565C0" })], { spacing: { after: 0 } })] }),
      new TableCell({ children: [para([txt(c.telMobile || "", { size: 18 })], { spacing: { after: 0 } })] }),
    ],
  }));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...rows],
    borders: defaultBorders(),
  });
}

function buildStatoMaggioreTable(statoMaggiore) {
  if (!statoMaggiore) return null;
  const rows = String(statoMaggiore).split("\n").map((s) => s.trim()).filter(Boolean).map((s) => {
    const sep = s.indexOf(":");
    const org = sep > -1 ? s.slice(0, sep).trim() : s;
    const nom = sep > -1 ? s.slice(sep + 1).trim() : "";
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 4000, type: WidthType.DXA },
          children: [para([txt(`${org}${sep > -1 ? ":" : ""}`, { bold: true, color: TEXT, size: 18 })], { spacing: { after: 0 } })],
          borders: noBorders(),
        }),
        new TableCell({
          children: [para([txt(nom, { color: TEXT, size: 18 })], { spacing: { after: 0 } })],
          borders: noBorders(),
        }),
      ],
    });
  });
  if (!rows.length) return null;
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows,
    borders: noBorders(),
  });
}

function noBorders() {
  const n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n };
}

function buildDispositivoTable(righe) {
  if (!righe || !righe.length) return null;
  const rows = righe.map((r, i) => new TableRow({
    children: [
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "F9FBFD" : "FFFFFF" },
        children: [para([txt(`➤ ${r.data || ""}`, { bold: true, color: NAVY, size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "F9FBFD" : "FFFFFF" },
        children: [para([txt(r.agenti || "", { size: 18 })], { spacing: { after: 0 } })],
      }),
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "F9FBFD" : "FFFFFF" },
        children: [para([txt(r.orario || "", { size: 18, color: MUTED })], { spacing: { after: 0 } })],
      }),
    ],
  }));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows,
    borders: defaultBorders(),
  });
}

function buildRiskTable(title, rows) {
  const lvColor = { MINIMO: "16A34A", MEDIO: "D97706", GRANDE: "DC2626" };
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: GL },
        children: [para([txt(title, { bold: true, color: NAVY, size: 18 })], { spacing: { after: 0 } })],
      }),
      ...["MINIMO", "MEDIO", "GRANDE"].map((lv) => new TableCell({
        width: { size: 1400, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: lvColor[lv] },
        children: [para([txt(lv.charAt(0) + lv.slice(1).toLowerCase(), { bold: true, color: "FFFFFF", size: 18 })], {
          alignment: AlignmentType.CENTER, spacing: { after: 0 },
        })],
      })),
    ],
  });
  const bodyRows = (rows || []).map((r, i) => new TableRow({
    children: [
      new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "FFFFFF" : "F9FBFD" },
        children: [para([txt(r.nome || "", { size: 18 })], { spacing: { after: 0 } })],
      }),
      ...["MINIMO", "MEDIO", "GRANDE"].map((lv) => new TableCell({
        width: { size: 1400, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 === 0 ? "FFFFFF" : "F9FBFD" },
        children: [para([txt(r.lv === lv ? "■" : " ", { color: r.lv === lv ? lvColor[lv] : "FFFFFF", size: 22, bold: true })], {
          alignment: AlignmentType.CENTER, spacing: { after: 0 },
        })],
      })),
    ],
  }));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
    borders: defaultBorders(),
  });
}

// ── Costruzione delle sezioni preset ────────────────────────────────────────
function bodyForPs1(data, chapterNum) {
  const out = [];
  out.push(mainChapterHeading(chapterNum, "Responsabilità"));
  out.push(buildContactsTable(data.s1?.contatti));
  out.push(spacer());
  return out.filter(Boolean);
}

function buildPresetSubsOrdered(items, deletedSet, subOrder, chapterOrig, chapterDisplay) {
  // items: [{origIdx, t, bodyType, body}]
  // Restituisce array di Paragraph/Table per i sub rinumerati X.Y
  const visible = items.filter((s) => s.body != null && s.body !== false && s.body !== "");
  let ordered = visible;
  if (Array.isArray(subOrder) && subOrder.length) {
    const wanted = subOrder.map((n) => {
      const m = String(n).match(/^\d+\.(\d+)$/);
      return m ? parseInt(m[1], 10) : null;
    }).filter((v) => v != null);
    const byIdx = new Map(visible.map((s) => [s.origIdx, s]));
    const reord = [];
    const seen = new Set();
    for (const idx of wanted) {
      const s = byIdx.get(idx);
      if (s && !seen.has(idx)) { reord.push(s); seen.add(idx); }
    }
    for (const s of visible) if (!seen.has(s.origIdx)) reord.push(s);
    ordered = reord;
  }
  const out = [];
  let counter = 0;
  for (const s of ordered) {
    const origN = `${chapterOrig}.${s.origIdx}`;
    if (deletedSet.has(origN)) continue;
    counter += 1;
    const displayN = `${chapterDisplay}.${counter}`;
    out.push(subTitleParagraph(origN, s.t, displayN));
    // body può essere stringa, array, oppure marker oggetto
    if (Array.isArray(s.body)) {
      for (const item of s.body) {
        if (item) out.push(item);
      }
    } else if (typeof s.body === "string") {
      const trimmed = s.body.trim();
      if (trimmed) {
        for (const block of markdownToDocx(trimmed)) out.push(block);
      }
    } else if (s.body && typeof s.body === "object") {
      out.push(s.body);
    }
  }
  return out;
}

function bodyForPs1Full(data, chapterDisplay, deletedSet, subOrder) {
  const out = bodyForPs1(data, chapterDisplay);
  const statoMag = buildStatoMaggioreTable(data.s1?.statoMaggiore);
  const subs = [
    { origIdx: 1, t: "Servizio di sicurezza", body: data.s1?.sicurezza },
    { origIdx: 2, t: "Polizia", body: data.s1?.polizia },
    { origIdx: 3, t: "Sanitari", body: data.s1?.sanitari },
    { origIdx: 4, t: "REGA", body: data.s1?.rega },
    { origIdx: 5, t: "Pompieri", body: data.s1?.pompieri },
    { origIdx: 6, t: "Stato Maggiore", body: statoMag },
  ];
  out.push(...buildPresetSubsOrdered(subs, deletedSet, subOrder, 1, chapterDisplay));
  if (data.s1?.puntoRitrovo) {
    out.push(para([txt(`PUNTO DI RITROVO: ${data.s1.puntoRitrovo}`, { bold: true, color: NAVY, size: 20 })], {
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: GL },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: GB },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: GB },
        left: { style: BorderStyle.SINGLE, size: 4, color: GB },
        right: { style: BorderStyle.SINGLE, size: 4, color: GB },
      },
    }));
  }
  return out;
}

function bodyForPs2Full(data, chapterDisplay, deletedSet, subOrder) {
  const out = [mainChapterHeading(chapterDisplay, "Descrizione")];
  if (data.s2?.descrizione) {
    out.push(para(parseInline(data.s2.descrizione), { spacing: { after: 160 } }));
  }
  if (Array.isArray(data.s2?.programma) && data.s2.programma.length) {
    for (const row of data.s2.programma) {
      out.push(para([
        txt(`${row.giorno || ""}`, { bold: true }),
        txt(row.giorno && row.attivita ? " — " : "", {}),
        txt(row.attivita || "", {}),
      ], { spacing: { after: 80 } }));
    }
  }
  const locBody = data.s2?.location ? [
    para([txt(data.s2.location)], { spacing: { after: 80 } }),
    para([txt("📎 La planimetria della location con il dispositivo degli agenti è riportata nell'Allegato 2.", { italics: true, color: MUTED, size: 18 })], {
      shading: { type: ShadingType.CLEAR, color: "auto", fill: GL },
      spacing: { after: 120 },
    }),
  ] : null;
  const subs = [
    { origIdx: 1, t: "Periodo e orari d'apertura", body: data.s2?.orari },
    { origIdx: 2, t: "Location", body: locBody },
    { origIdx: 3, t: "Pattuglia esterna", body: data.s2?.pattuglia },
    { origIdx: 4, t: "Tipologia e numero dei visitatori", body: data.s2?.visitatori },
    { origIdx: 5, t: "Gestione dei minori", body: data.s2?.minori },
  ];
  out.push(...buildPresetSubsOrdered(subs, deletedSet, subOrder, 2, chapterDisplay));
  return out;
}

function bodyForPs3Full(data, chapterDisplay, deletedSet, subOrder) {
  const out = [mainChapterHeading(chapterDisplay, "Analisi dei pericoli")];
  out.push(para([txt("Ad ogni evento vi sono fattori di rischio che potrebbero pregiudicare il buon esito dello stesso. Una valutazione attenta di questi fattori può influire sia sulla buona riuscita che sulle misure da adottare in caso di necessità.")], { spacing: { after: 160 } }));
  const risk = [
    buildRiskTable("Lista Pericoli Passivi", data.s3?.passivi),
    spacer(60),
    buildRiskTable("Lista Pericoli Attivi", data.s3?.attivi),
  ].filter(Boolean);
  const subs = [
    { origIdx: 1, t: "Analisi del rischio", body: risk },
    { origIdx: 2, t: "Meteo", body: data.s3?.meteo },
    { origIdx: 3, t: "Atto terroristico / attentato", body: data.s3?.terrorismo },
    { origIdx: 4, t: "Evacuazione", body: data.s3?.evacuazione },
  ];
  out.push(...buildPresetSubsOrdered(subs, deletedSet, subOrder, 3, chapterDisplay));
  return out;
}

function bodyForPs4Full(data, chapterDisplay, deletedSet, subOrder) {
  const out = [mainChapterHeading(chapterDisplay, "Dispositivo di sicurezza")];
  out.push(para(parseInline("La DELTAgroup Security & Services AG mette a disposizione il seguente dispositivo di sicurezza. La planimetria con le posizioni degli agenti è riportata nell'**Allegato 2**."), { spacing: { after: 160 } }));
  const tbl = buildDispositivoTable(data.s4?.righe);
  if (tbl) { out.push(tbl); out.push(spacer()); }
  const subs = [
    { origIdx: 1, t: "Modifiche", body: data.s4?.modifiche },
    { origIdx: 2, t: "Comunicazioni", body: data.s4?.comunicazioni },
    { origIdx: 3, t: "Divisa", body: "Secondo regolamento DELTAgroup." },
    { origIdx: 4, t: "Posto Comando", body: data.s4?.postoComando },
    { origIdx: 5, t: "Diversi", body: data.s4?.diversi },
  ];
  out.push(...buildPresetSubsOrdered(subs, deletedSet, subOrder, 4, chapterDisplay));
  return out;
}

function bodyForPs5Full(data, chapterDisplay, deletedSet, subOrder) {
  const out = [mainChapterHeading(chapterDisplay, "Scenari")];
  const subs = [
    { origIdx: 1, t: "Incendio", body: data.s5?.incendio },
    { origIdx: 2, t: "Intossicazione", body: data.s5?.intossicazione },
    { origIdx: 3, t: "Problemi d'ordine", body: data.s5?.ordine },
    { origIdx: 4, t: "Ferimenti / Malori", body: data.s5?.ferimenti },
    { origIdx: 5, t: "Sostanze stupefacenti", body: data.s5?.droghe },
  ];
  out.push(...buildPresetSubsOrdered(subs, deletedSet, subOrder, 5, chapterDisplay));
  return out;
}

function bodyForPs6Full(data, chapterDisplay, deletedSet, subOrder) {
  const out = [mainChapterHeading(chapterDisplay, "Casi d'Allarme")];
  const orderedList = (k) => {
    const arr = data.s6?.[k];
    if (!arr || !arr.length) return null;
    return arr.map((s) => para([txt(String(s).replace(/^\s*\d+[\.\)]\s+/, ""))], {
      bullet: { level: 0 },
      spacing: { after: 60 },
    }));
  };
  const subs = [
    { origIdx: 1, t: "Stato Maggiore di Crisi", body: data.s6?.smc },
    { origIdx: 2, t: "Evacuazione", body: orderedList("ev") },
    { origIdx: 3, t: "Allarme incendio", body: orderedList("inc") },
    { origIdx: 4, t: "Minaccia Bomba", body: orderedList("mb") },
    { origIdx: 5, t: "Allarme Bomba (indicazione precisa)", body: orderedList("ab") },
    { origIdx: 6, t: "Atto Terroristico / Attentato", body: orderedList("at") },
    { origIdx: 7, t: "Allarme tecnico (Corrente elettrica)", body: orderedList("te") },
    { origIdx: 8, t: "Allarme Meteo", body: orderedList("me") },
    {
      origIdx: 9,
      t: "Annunci d'emergenza",
      body: "La DELTA Security AG prepara e predispone il formulario degli annunci d'emergenza in prossimità di ogni palco o punto dove si possa, tramite un dispositivo audio, effettuare gli annunci. Il responsabile della sicurezza sarà pure lui in possesso di tale formulario. Il formulario con gli annunci d'emergenza è inserito nel presente protocollo di sicurezza. (Allegato 1)",
    },
  ];
  out.push(...buildPresetSubsOrdered(subs, deletedSet, subOrder, 6, chapterDisplay));
  return out;
}

// ── Custom capitoli / sottocapitoli / allegati ──────────────────────────────
function bodyForCustomCapitolo(section, chapterDisplay) {
  const out = [mainChapterHeading(chapterDisplay, section.title || "Capitolo")];
  out.push(...renderCustomContent(section.content));
  return out;
}

function bodyForCustomSottocapitolo(section, displayN) {
  const out = [];
  out.push(subTitleParagraph(displayN, section.title || "Sotto capitolo", displayN));
  out.push(...renderCustomContent(section.content));
  return out;
}

async function bodyForCustomAllegato(section, allegatoNum, prefetched) {
  const out = [];
  out.push(bannerParagraph(`ALLEGATO ${allegatoNum} – ${(section.title || "Allegato").toUpperCase()}`, {
    alignment: AlignmentType.CENTER,
    pageBreakBefore: true,
  }));
  const bytes = prefetched.customAllegati?.[section.id];
  if (bytes) {
    const dims = await getImageDimensions(bytes);
    const fit = fitImageInsidePage(dims.w, dims.h);
    out.push(para([new ImageRun({
      data: bytes,
      transformation: fit,
      type: inferImageType(section.title, section.fileMime),
    })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
  } else if (section.imageUrl && section.fileMime === "application/pdf") {
    out.push(para([txt(`📄 ${section.title || "PDF"} — file PDF allegato (non incluso nel DOCX)`, { italics: true, color: MUTED })], { spacing: { after: 120 } }));
  }
  if (section.content) out.push(...renderCustomContent(section.content));
  return out;
}

// ── Allegati 1 e 2 (immagini caricate) ──────────────────────────────────────
async function bodyForAll1(data, allegatoNum, prefetched) {
  const out = [bannerParagraph(`ALLEGATO ${allegatoNum} – FORMULARIO ANNUNCI D'EMERGENZA`, {
    alignment: AlignmentType.CENTER,
    pageBreakBefore: true,
  })];
  const files = data.allegato1Files || [];
  if (!files.length) {
    out.push(para([txt("(Nessun file caricato per l'Allegato 1)", { italics: true, color: MUTED })], { alignment: AlignmentType.CENTER }));
    return out;
  }
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const bytes = prefetched.allegato1[i];
    if (bytes && f.type?.startsWith("image/")) {
      const dims = await getImageDimensions(bytes);
      const fit = fitImageInsidePage(dims.w, dims.h);
      out.push(para([new ImageRun({
        data: bytes,
        transformation: fit,
        type: inferImageType(f.name, f.type),
      })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
    } else {
      out.push(para([txt(`📄 ${f.name} — ${f.type === "application/pdf" ? "PDF allegato (non incluso nel DOCX)" : "file allegato"}`, { italics: true, color: MUTED })], { spacing: { after: 80 } }));
    }
  }
  return out;
}

async function bodyForAll2(data, allegatoNum, prefetched) {
  const out = [bannerParagraph(`ALLEGATO ${allegatoNum} – PLANIMETRIA DISPOSITIVO AGENTI`, {
    alignment: AlignmentType.CENTER,
    pageBreakBefore: true,
  })];
  const files = data.allegato2Files || [];
  if (!files.length) {
    out.push(para([txt("(Nessuna planimetria caricata per l'Allegato 2)", { italics: true, color: MUTED })], { alignment: AlignmentType.CENTER }));
    return out;
  }
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const bytes = prefetched.allegato2[i];
    if (bytes && f.type?.startsWith("image/")) {
      const dims = await getImageDimensions(bytes);
      const fit = fitImageInsidePage(dims.w, dims.h);
      out.push(para([new ImageRun({
        data: bytes,
        transformation: fit,
        type: inferImageType(f.name, f.type),
      })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
    } else {
      out.push(para([txt(`📄 ${f.name} — ${f.type === "application/pdf" ? "PDF allegato (non incluso nel DOCX)" : "file allegato"}`, { italics: true, color: MUTED })], { spacing: { after: 80 } }));
    }
  }
  return out;
}

// ── Cover ───────────────────────────────────────────────────────────────────
async function buildCover(data, prefetched) {
  const out = [];
  // Spacer per spingere il contenuto verso il centro verticale della pagina.
  out.push(para([], { spacing: { before: 3600 } }));
  if (prefetched.logoEvento) {
    const dims = await getImageDimensions(prefetched.logoEvento, { w: 200, h: 80 });
    const fit = fitImageInsidePage(dims.w, dims.h, 220, 90);
    out.push(para([new ImageRun({
      data: prefetched.logoEvento,
      transformation: fit,
      type: "png",
    })], { alignment: AlignmentType.CENTER, spacing: { after: 360 } }));
  }
  out.push(para([txt("CONCETTO DI SICUREZZA", { bold: true, color: NAVY, size: 28 })], {
    alignment: AlignmentType.CENTER, spacing: { after: 240 },
  }));
  out.push(para([txt(data.nomeEvento || "", { bold: true, color: NAVY, size: 48 })], {
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
  }));
  if (data.luogo) out.push(para([txt(data.luogo, { color: MUTED, size: 28 })], {
    alignment: AlignmentType.CENTER, spacing: { after: 120 },
  }));
  if (data.anno) out.push(para([txt(`Edizione ${data.anno}`, { color: MUTED, size: 24 })], {
    alignment: AlignmentType.CENTER,
  }));
  return out;
}

// ── TOC field ───────────────────────────────────────────────────────────────
// Limitiamo a HEADING_1 e HEADING_2 per restare in una pagina sola in
// documenti tipici (capitoli main + sub).
function buildTocField() {
  return [
    para([txt("INDICE", { bold: true, color: NAVY, size: 26 })], {
      spacing: { after: 200 },
    }),
    new TableOfContents("INDICE", {
      hyperlink: true,
      headingStyleRange: "1-2",
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── Prefetch immagini ───────────────────────────────────────────────────────
async function prefetchAssets(data, customSections, headerLogoUrl) {
  const out = {
    logoHeader: null,
    logoEvento: null,
    allegato1: [],
    allegato2: [],
    customAllegati: {},
  };
  if (headerLogoUrl) {
    if (typeof headerLogoUrl === "string" && headerLogoUrl.startsWith("data:")) {
      out.logoHeader = bytesFromBase64DataUrl(headerLogoUrl);
    } else if (typeof headerLogoUrl === "string") {
      out.logoHeader = await fetchAsBytes(headerLogoUrl);
    } else if (headerLogoUrl instanceof Uint8Array) {
      out.logoHeader = headerLogoUrl;
    }
  }
  if (data?.logoEvento && typeof data.logoEvento === "string") {
    if (data.logoEvento.startsWith("data:")) out.logoEvento = bytesFromBase64DataUrl(data.logoEvento);
    else out.logoEvento = await fetchAsBytes(data.logoEvento);
  }
  for (const f of data?.allegato1Files || []) {
    if (f.url && f.type?.startsWith("image/")) out.allegato1.push(await fetchAsBytes(f.url));
    else out.allegato1.push(null);
  }
  for (const f of data?.allegato2Files || []) {
    if (f.url && f.type?.startsWith("image/")) out.allegato2.push(await fetchAsBytes(f.url));
    else out.allegato2.push(null);
  }
  for (const s of customSections || []) {
    if (s.type === "allegato" && s.imageUrl && s.fileMime?.startsWith("image/")) {
      out.customAllegati[s.id] = await fetchAsBytes(s.imageUrl);
    }
  }
  return out;
}

// ── Build map numerazioni (replica locale di buildSectionNumberMaps) ────────
function parseCustomSectionKey(key) {
  if (!key?.startsWith("custom:")) return null;
  return key.slice(7);
}

function buildNumberMaps(sectionOrder, customSections, presetDeletedItems, PRESET_SUB_COUNT) {
  const cs = customSections || [];
  const order = sectionOrder || [];
  const chapterNumByKey = new Map();
  const allegatoNumByKey = new Map();
  const subchapterDisplayByKey = new Map();
  const subCountByParent = new Map();
  allegatoNumByKey.set("all1", 1);
  allegatoNumByKey.set("all2", 2);
  let ch = 0;
  for (const key of order) {
    if (!key) continue;
    if (/^ps[1-6]$/.test(key)) {
      ch += 1; chapterNumByKey.set(key, ch);
    } else if (key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = cs.find((c) => c.id === id);
      if (s?.type === "capitolo") { ch += 1; chapterNumByKey.set(key, ch); }
    }
  }
  let al = 2;
  for (const key of order) {
    if (typeof key !== "string" || !key.startsWith("custom:")) continue;
    const id = parseCustomSectionKey(key);
    const s = cs.find((c) => c.id === id);
    if (s?.type === "allegato") { al += 1; allegatoNumByKey.set(key, al); }
  }
  for (const [pkey, base] of Object.entries(PRESET_SUB_COUNT)) {
    const deletedSubs = ((presetDeletedItems?.[pkey] || []).filter((n) => /^\d+\.\d+$/.test(String(n)))).length;
    subCountByParent.set(pkey, Math.max(0, base - deletedSubs));
  }
  let lastChapterKey = null;
  for (const key of order) {
    if (!key) continue;
    if (/^ps[1-6]$/.test(key)) { lastChapterKey = key; continue; }
    if (key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = cs.find((c) => c.id === id);
      if (!s) continue;
      if (s.type === "capitolo") { lastChapterKey = key; }
      else if (s.type === "sottocapitolo") {
        let pkey = s.parentKey;
        if (!pkey || !chapterNumByKey.has(pkey)) pkey = lastChapterKey;
        if (!pkey) continue;
        const parentNum = chapterNumByKey.get(pkey);
        if (parentNum == null) continue;
        const next = (subCountByParent.get(pkey) || 0) + 1;
        subCountByParent.set(pkey, next);
        subchapterDisplayByKey.set(key, `${parentNum}.${next}`);
      }
    }
  }
  return { chapterNumByKey, allegatoNumByKey, subchapterDisplayByKey };
}

// ── Funzione principale ─────────────────────────────────────────────────────
export async function generateDocxBlob({
  data,
  customSections = [],
  sectionOrder,
  presetDeletedItems = {},
  presetSubOrder = {},
  headerLogoUrl = null,
  PRESET_SUB_COUNT,
  DEFAULT_SECTION_ORDER,
}) {
  const order = (Array.isArray(sectionOrder) && sectionOrder.length) ? sectionOrder : [...DEFAULT_SECTION_ORDER];
  const prefetched = await prefetchAssets(data, customSections, headerLogoUrl);
  const { chapterNumByKey, allegatoNumByKey, subchapterDisplayByKey } = buildNumberMaps(order, customSections, presetDeletedItems, PRESET_SUB_COUNT);

  // Costruisci la lista di sub custom per parent (rendering interno al capitolo padre)
  const subsByParent = new Map();
  for (const key of order) {
    if (typeof key !== "string" || !key.startsWith("custom:")) continue;
    const id = parseCustomSectionKey(key);
    const s = customSections.find((c) => c.id === id);
    if (!s || s.type !== "sottocapitolo") continue;
    let pk = s.parentKey;
    if (!pk || !chapterNumByKey.has(pk)) {
      // fallback: ultimo capitolo prima di questa key
      const idx = order.indexOf(key);
      for (let i = idx - 1; i >= 0; i--) {
        const k = order[i];
        if (/^ps[1-6]$/.test(k)) { pk = k; break; }
        if (k?.startsWith("custom:")) {
          const cid = parseCustomSectionKey(k);
          const cs2 = customSections.find((c) => c.id === cid);
          if (cs2?.type === "capitolo") { pk = k; break; }
        }
      }
    }
    if (!pk) continue;
    const arr = subsByParent.get(pk) || [];
    arr.push({ key, section: s });
    subsByParent.set(pk, arr);
  }

  // Genera la cover
  const coverChildren = await buildCover(data, prefetched);

  // Genera i blocchi sezione
  const flowChildren = [];
  for (const key of order) {
    if (!key) continue;
    if (key === "ps1") {
      const num = chapterNumByKey.get(key) ?? 1;
      flowChildren.push(...bodyForPs1Full(data, num, new Set(presetDeletedItems.ps1 || []), presetSubOrder.ps1));
      const subs = subsByParent.get("ps1") || [];
      for (const { section } of subs) {
        const dn = subchapterDisplayByKey.get(`custom:${section.id}`) || "?";
        flowChildren.push(...bodyForCustomSottocapitolo(section, dn));
      }
      continue;
    }
    if (key === "ps2") {
      const num = chapterNumByKey.get(key) ?? 2;
      flowChildren.push(...bodyForPs2Full(data, num, new Set(presetDeletedItems.ps2 || []), presetSubOrder.ps2));
      for (const { section } of (subsByParent.get("ps2") || [])) {
        const dn = subchapterDisplayByKey.get(`custom:${section.id}`) || "?";
        flowChildren.push(...bodyForCustomSottocapitolo(section, dn));
      }
      continue;
    }
    if (key === "ps3") {
      const num = chapterNumByKey.get(key) ?? 3;
      flowChildren.push(...bodyForPs3Full(data, num, new Set(presetDeletedItems.ps3 || []), presetSubOrder.ps3));
      for (const { section } of (subsByParent.get("ps3") || [])) {
        const dn = subchapterDisplayByKey.get(`custom:${section.id}`) || "?";
        flowChildren.push(...bodyForCustomSottocapitolo(section, dn));
      }
      continue;
    }
    if (key === "ps4") {
      const num = chapterNumByKey.get(key) ?? 4;
      flowChildren.push(...bodyForPs4Full(data, num, new Set(presetDeletedItems.ps4 || []), presetSubOrder.ps4));
      for (const { section } of (subsByParent.get("ps4") || [])) {
        const dn = subchapterDisplayByKey.get(`custom:${section.id}`) || "?";
        flowChildren.push(...bodyForCustomSottocapitolo(section, dn));
      }
      continue;
    }
    if (key === "ps5") {
      const num = chapterNumByKey.get(key) ?? 5;
      flowChildren.push(...bodyForPs5Full(data, num, new Set(presetDeletedItems.ps5 || []), presetSubOrder.ps5));
      for (const { section } of (subsByParent.get("ps5") || [])) {
        const dn = subchapterDisplayByKey.get(`custom:${section.id}`) || "?";
        flowChildren.push(...bodyForCustomSottocapitolo(section, dn));
      }
      continue;
    }
    if (key === "ps6") {
      const num = chapterNumByKey.get(key) ?? 6;
      flowChildren.push(...bodyForPs6Full(data, num, new Set(presetDeletedItems.ps6 || []), presetSubOrder.ps6));
      for (const { section } of (subsByParent.get("ps6") || [])) {
        const dn = subchapterDisplayByKey.get(`custom:${section.id}`) || "?";
        flowChildren.push(...bodyForCustomSottocapitolo(section, dn));
      }
      continue;
    }
    if (key === "all1") {
      const num = allegatoNumByKey.get(key) ?? 1;
      flowChildren.push(...(await bodyForAll1(data, num, prefetched)));
      continue;
    }
    if (key === "all2") {
      const num = allegatoNumByKey.get(key) ?? 2;
      flowChildren.push(...(await bodyForAll2(data, num, prefetched)));
      continue;
    }
    if (key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = customSections.find((c) => c.id === id);
      if (!s) continue;
      if (s.type === "capitolo") {
        const num = chapterNumByKey.get(key) ?? 1;
        flowChildren.push(...bodyForCustomCapitolo(s, num));
        for (const { section } of (subsByParent.get(key) || [])) {
          const dn = subchapterDisplayByKey.get(`custom:${section.id}`) || "?";
          flowChildren.push(...bodyForCustomSottocapitolo(section, dn));
        }
      } else if (s.type === "allegato") {
        const num = allegatoNumByKey.get(key) ?? 1;
        flowChildren.push(...(await bodyForCustomAllegato(s, num, prefetched)));
      }
      // i sottocapitoli sono già renderizzati dentro il loro parent
    }
  }

  const numbering = {
    config: [
      {
        reference: "numList",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  };

  const headerLogoBytes = prefetched.logoHeader;
  const sectionOpts = {
    properties: {
      page: {
        size: { orientation: PageOrientation.PORTRAIT },
        margin: { top: 1700, right: 850, bottom: 1100, left: 850 },
      },
    },
    headers: { default: buildHeader(headerLogoBytes, data) },
    footers: { default: buildFooter() },
  };

  const doc = new Document({
    creator: "DELTAgroup CS",
    title: `Concetto di Sicurezza - ${data?.nomeEvento || ""}`,
    description: "Documento generato da DELTAgroup CS",
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 20, color: TEXT },
        },
        heading1: {
          run: { font: "Arial", size: 28, bold: true, color: NAVY },
          paragraph: { spacing: { before: 240, after: 160 }, keepNext: true },
        },
        heading2: {
          run: { font: "Arial", size: 22, bold: true, color: NAVY },
          paragraph: { spacing: { before: 200, after: 80 }, keepNext: true },
        },
        heading3: {
          run: { font: "Arial", size: 20, bold: true, color: NAVY },
          paragraph: { spacing: { before: 160, after: 60 }, keepNext: true },
        },
        heading4: {
          run: { font: "Arial", size: 19, bold: true, color: NAVY_MID },
          paragraph: { spacing: { before: 120, after: 40 }, keepNext: true },
        },
      },
      paragraphStyles: [
        {
          id: "TOC1",
          name: "toc 1",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Arial", size: 20, bold: true, color: NAVY },
          paragraph: { spacing: { before: 0, after: 40, line: 260 } },
        },
        {
          id: "TOC2",
          name: "toc 2",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Arial", size: 18, color: TEXT },
          paragraph: { spacing: { before: 0, after: 0, line: 240 }, indent: { left: 280 } },
        },
      ],
    },
    numbering,
    sections: [
      // Cover con header (logo) + footer DELTAgroup
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 1700, right: 850, bottom: 1100, left: 850 },
          },
        },
        headers: { default: buildHeader(headerLogoBytes, data) },
        footers: { default: buildFooter() },
        children: coverChildren,
      },
      // Indice + corpo
      {
        ...sectionOpts,
        children: [...buildTocField(), ...flowChildren],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

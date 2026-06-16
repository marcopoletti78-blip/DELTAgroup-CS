// Generatore PDF per il Concetto di Sicurezza (CS).
// Usa pdfmake (browser). Stile coerente con buildPpsPdf.js / buildDocx.js.
//
// Il contenuto delle sezioni CS è renderizzato come HTML nella preview a schermo:
// qui riceviamo un array `sections` di { title, html } già estratto dal DOM e
// convertiamo l'HTML in testo plain (pdfmake non interpreta HTML).
//
// evento: { nomeEvento, tipoEvento, luogo, date, organizzatore, affluenza, strutture }

// ── PALETTE ──────────────────────────────────────────────────────────────────
const AC = "#1E40AF";
const NAVY = "#0c1d3d";
const TXT = "#1a2038";
const MUTED = "#52637a";
const GREY = "#888888";

const FOOTER_TEXT = "DELTAgroup Security & Services AG · Via alla Foce 4, 6933 Muzzano · T +41 91 921 49 49 · TICINO@delta.ch";

const MM = 2.834645669;
const MARGIN = Math.round(20 * MM);
const A4_WIDTH = 595.28;
const CONTENT_W = A4_WIDTH - MARGIN * 2;

// ── Inizializzazione pdfmake (lazy import, robusto su più versioni) ──────────
let _pdfMake = null;
function pickVfs(m) {
  const cands = [m?.vfs, m?.pdfMake?.vfs, m?.default?.vfs, m?.default?.pdfMake?.vfs, m?.default, m];
  for (const c of cands) {
    if (c && typeof c === "object" && Object.keys(c).some((k) => k.endsWith(".ttf"))) return c;
  }
  return m?.default || m;
}
async function getPdfMake() {
  if (_pdfMake) return _pdfMake;
  const pm = (await import("pdfmake/build/pdfmake")).default;
  const fontsMod = await import("pdfmake/build/vfs_fonts");
  const vfs = pickVfs(fontsMod);
  if (vfs) pm.vfs = vfs;
  pm.fonts = pm.fonts || {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  };
  _pdfMake = pm;
  return pm;
}

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
    console.error("[buildCsPdf] fetch fail", url, e);
    return null;
  }
}

// ── HTML → testo plain ───────────────────────────────────────────────────────
// Rimuove i tag, decodifica le entità base e mantiene gli a-capo logici
// (br, fine di p/div/li/tr → newline; celle separate da " · ").
export function htmlToText(html) {
  if (!html) return "";
  const s = String(html);
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    tmp.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
    tmp.querySelectorAll("td,th").forEach((el) => el.append(" · "));
    tmp.querySelectorAll("p,div,li,tr,h1,h2,h3,h4,h5,h6").forEach((el) => el.append("\n"));
    return (tmp.textContent || "")
      .replace(/[ \t]*·[ \t]*\n/g, "\n")  // ripulisce separatore di cella a fine riga
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }
  // Fallback senza DOM: strip tag + decodifica entità minime.
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionTitle(text) {
  return { text: String(text), bold: true, fontSize: 11, color: AC, margin: [0, 14, 0, 6] };
}

function bodyParagraphs(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (l === "") continue;
    out.push({ text: l, fontSize: 9, color: TXT, margin: [0, 0, 0, 3], lineHeight: 1.3 });
  }
  return out;
}

// ── Funzione principale ──────────────────────────────────────────────────────
// sections: [{ title, html }] — già estratte e ordinate dalla preview.
export async function buildCsPdfBlob(sections = [], evento = {}) {
  try {
  const pdfMake = await getPdfMake();

  const logoDataUrl = await fetchAsDataUrl("/logo.jpg");
  const nomeEvento = evento?.nomeEvento ? String(evento.nomeEvento) : "";

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
              { text: "Concetto di Sicurezza", bold: true, fontSize: 9, color: NAVY, alignment: "right" },
              { text: nomeEvento || " ", fontSize: 9, color: GREY, alignment: "right", margin: [0, 2, 0, 0] },
            ],
            margin: [0, 6, 0, 0],
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 8, x2: CONTENT_W, y2: 8, lineWidth: 1.3, lineColor: AC }] },
    ],
  });

  const footer = (currentPage, pageCount) => ({
    margin: [MARGIN, 6, MARGIN, 0],
    columns: [
      { text: FOOTER_TEXT, fontSize: 7, color: GREY, width: "*" },
      { text: `${currentPage} / ${pageCount}`, fontSize: 7, color: GREY, alignment: "right", width: "auto" },
    ],
  });

  const content = [];

  // Intestazione documento
  content.push({ text: "CONCETTO DI SICUREZZA", bold: true, fontSize: 16, color: NAVY, margin: [0, 4, 0, 2] });
  if (nomeEvento) content.push({ text: nomeEvento, fontSize: 13, color: TXT, margin: [0, 0, 0, 2] });
  const eventoMeta = [
    evento?.tipoEvento && `Tipo: ${evento.tipoEvento}`,
    evento?.luogo && `Luogo: ${evento.luogo}`,
    evento?.date && `Date: ${evento.date}`,
    evento?.organizzatore && `Organizzatore: ${evento.organizzatore}`,
    evento?.affluenza && `Affluenza: ${evento.affluenza}`,
    evento?.strutture && `Strutture: ${evento.strutture}`,
  ].filter(Boolean);
  if (eventoMeta.length) {
    content.push({ text: eventoMeta.join("  ·  "), fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 6] });
  }

  // Sezioni. `title` arriva già numerato dalla preview (es. "1  Responsabilità",
  // "Allegato 1 – …"): lo rendiamo così com'è per non duplicare la numerazione.
  let count = 0;
  for (const sec of sections || []) {
    if (!sec) continue;
    const bodyText = htmlToText(sec.html);
    const title = sec.title ? String(sec.title).replace(/\s+/g, " ").trim() : "";
    if (!title && !bodyText) continue;  // salta sezioni vuote
    count += 1;
    content.push(sectionTitle(title || `Sezione ${count}`));
    if (bodyText) content.push(...bodyParagraphs(bodyText));
  }

  if (count === 0) {
    content.push({ text: "(Nessuna sezione disponibile)", italics: true, fontSize: 9, color: MUTED });
  }

  const docDef = {
    pageSize: "A4",
    pageMargins: [MARGIN, 84, MARGIN, MARGIN + 18],
    header,
    footer,
    content,
    defaultStyle: { font: "Roboto", fontSize: 9, color: TXT },
    info: { title: `Concetto di Sicurezza - ${nomeEvento}` },
  };

  const blob = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout: getBlob non ha risposto entro 20s (font/vfs?)")),
      20000
    );
    try {
      const doc = pdfMake.createPdf(docDef);
      doc.getBlob((b) => { clearTimeout(timer); resolve(b); });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
  return blob;
  } catch (err) {
    console.error("buildCsPdfBlob error:", err);
    alert("Errore PDF: " + err.message);
    throw err;
  }
}

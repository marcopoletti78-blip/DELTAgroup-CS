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
const RED = "#c8102e";      // rosso DELTAgroup (titolo)
const AG_COLOR = "#0c1d3d"; // header box agente (uniforme per tutti gli agenti)
const AG_ORARIO_BG = "#e8ecf0"; // sfondo riga orario nel box agente
const NOTE_BG = "#4a5568";  // sfondo titolo "Note operative" (distinto dalle sezioni)

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

// Titolo di sezione: blocco pieno navy con testo bianco.
// opts.fill / opts.fontSize per varianti (es. blocco "Note operative").
function sectionTitle(text, opts = {}) {
  const fill = opts.fill || NAVY;
  const fontSize = opts.fontSize || 10;
  return {
    style: "sectionTitle",
    table: {
      widths: ["*"],
      body: [[{
        text: String(text).toUpperCase(),
        fontSize, bold: true, color: "#FFFFFF", fillColor: fill,
        border: [false, false, false, false],
      }]],
    },
    layout: { defaultBorder: false, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 14, 0, 10],
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
      // Tutto il box agente in un unico contenitore: lo wrappiamo in uno stack
      // unbreakable così header, orario e compiti non finiscono su pagine diverse.
      const boxAgente = [];
      // Header box agente (sfondo navy uniforme)
      boxAgente.push({
        table: { widths: ["*"], body: [[{
          text: `${agente.toUpperCase()} — ${ruolo.trim().toUpperCase()}`,
          bold: true, color: "#FFFFFF", fillColor: AG_COLOR, fontSize: 9,
          border: [false, false, false, false],
        }]] },
        layout: { defaultBorder: false, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 5, paddingBottom: () => 5 },
        margin: [0, 8, 0, 0],
      });
      // Sub-header orario su sfondo grigio chiaro
      boxAgente.push({
        table: { widths: ["*"], body: [[{
          text: [{ text: "Orario di servizio: ", bold: true, fontSize: 9 }, { text: orario, fontSize: 9 }],
          fillColor: AG_ORARIO_BG, border: [false, false, false, false],
        }]] },
        layout: { defaultBorder: false, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 4, paddingBottom: () => 4 },
        margin: [0, 0, 0, 4],
      });
      boxAgente.push({ text: "COMPITI OPERATIVI", bold: true, fontSize: 9, color: NAVY, margin: [0, 2, 0, 4] });
      // Delimitatore primario: newline. Se il testo contiene più righe → un bullet
      // per riga; altrimenti fallback a un unico bullet con tutto il testo.
      const splitByNewline = tasks
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const taskList = splitByNewline.length > 1 ? splitByNewline : [tasks.trim()];
      taskList.forEach((task) => {
        boxAgente.push({
          columns: [
            { text: "•", color: AC, width: 10, fontSize: 9.5 },
            { text: task, fontSize: 9.5, width: "*" },
          ],
          margin: [0, 3, 0, 0],
        });
      });
      blocks.push({ stack: boxAgente, unbreakable: true });
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

  // Header ripetuto su ogni pagina: solo logo a sinistra + linea separatrice.
  const header = (currentPage, pageCount) => ({
    margin: [40, 18, 40, 0],
    stack: [
      logoDataUrl
        ? { image: logoDataUrl, width: 115 }
        : { text: "", width: 115 },
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

  // ── Blocco titolo centrato (pagina 1) ──
  content.push({ text: codice || val(dati.cliente) || "PPS", bold: true, fontSize: 26, color: NAVY, alignment: "center", margin: [0, 0, 0, 4] });
  content.push({ text: "PPS — Prescrizioni Particolari di Servizio", fontSize: 11, color: RED, alignment: "center", margin: [0, 0, 0, 2] });
  if (has(dati.luogo)) content.push({ text: val(dati.luogo), fontSize: 10, color: RED, alignment: "center", margin: [0, 0, 0, 2] });
  if (has(dati.data)) content.push({ text: val(dati.data), fontSize: 10, italics: true, color: "#6B7280", alignment: "center" });
  content.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: NAVY }], margin: [0, 8, 0, 16] });

  // 1. DATI SERVIZIO (il titolo segue il divisore del blocco titolo: niente sep)
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
      text: h, bold: true, fontSize: 9, color: "#FFFFFF", fillColor: NAVY,
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
  const radioVal = has(dati.radio_canale) ? val(dati.radio_canale)
    : (has(dati.radio) ? val(dati.radio) : "Canale 1 (salvo diversa indicazione)");
  // Vettovagliamento: nascondi la riga se vuoto o placeholder ("-" / "—")
  const vettoRaw = val(dati.vettovagliamento);
  const vettovagliamento = (vettoRaw === "-" || vettoRaw === "—") ? "" : vettoRaw;
  const dettagliTable = kvTable([
    ["Divisa", dati.divisa],
    ["Equipaggiamento", equip],
    ["Canale radio", radioVal],
    ["Vettovagliamento", vettovagliamento],
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
      text: h, bold: true, fontSize: 9, color: "#FFFFFF", fillColor: NAVY,
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

  // NOTE OPERATIVE — blocco secondario (titolo ridotto, distinto dalle sezioni)
  const note = (dati.note_operative || dati.informazioni_aggiuntive || "").trim();
  if (note) {
    content.push(sep());
    content.push(sectionTitle("Note operative", { fill: NOTE_BG, fontSize: 8 }));
    // Keyword inline che fanno da delimitatori di sezione nel testo unico.
    const KEYWORDS = ["MAPPE OPERATIVE:", "STANDARD DI CONDOTTA:", "PROCEDURE EMERGENZA:", "NOTE AGGIUNTIVE:"];
    // Trova le occorrenze delle keyword e relativa posizione nel testo.
    const markers = [];
    KEYWORDS.forEach((kw) => {
      const idx = note.indexOf(kw);
      if (idx !== -1) markers.push({ kw, idx });
    });
    markers.sort((a, b) => a.idx - b.idx);
    if (markers.length) {
      markers.forEach((m, i) => {
        const start = m.idx + m.kw.length;
        const end = i + 1 < markers.length ? markers[i + 1].idx : note.length;
        const heading = m.kw.replace(/:\s*$/, ""); // "MAPPE OPERATIVE"
        const body = note.slice(start, end).trim();
        content.push({ text: heading, bold: true, fontSize: 9, color: NAVY, margin: [0, i === 0 ? 2 : 4, 0, 2] });
        if (body) content.push({ text: body, fontSize: 9, color: TXT, margin: [0, 0, 0, 6], lineHeight: 1.25 });
      });
    } else {
      // Fallback: nessuna keyword → bullet list spezzato su newline.
      const punti = note.split(/\n+/).map((p) => p.trim()).filter(Boolean);
      (punti.length ? punti : [note]).forEach((punto) => {
        content.push({
          columns: [
            { text: "•", color: AC, width: 10, fontSize: 9 },
            { text: punto, fontSize: 9, width: "*" },
          ],
          margin: [0, 3, 0, 0],
        });
      });
    }
  }

  // 7. VALIDITÀ — titolo + contenuto + firma in un unico blocco unbreakable
  // così il titolo non resta orfano a fondo pagina con il resto sulla successiva.
  if (content.length) content.push(sep());
  const dataEmissione = new Date().toLocaleDateString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
  content.push({
    unbreakable: true,
    stack: [
      sectionTitle("7. Validità"),
      {
        text: "Il presente documento è valido per il servizio indicato e deve essere conservato dall'agente durante tutta la durata del servizio.",
        fontSize: 9, color: TXT, margin: [0, 0, 0, 4], lineHeight: 1.25,
      },
      // Blocco firma
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#cccccc" }], margin: [0, 10, 0, 0] },
      { text: `Data di emissione: ${dataEmissione}`, fontSize: 8.5, color: TXT, margin: [0, 12, 0, 0] },
      {
        table: { widths: ["*", "*"], body: [[
          { text: "Responsabile DELTAgroup: ____________________", fontSize: 8.5, border: [false, false, false, false] },
          { text: "Firma: _______________", fontSize: 8.5, border: [false, false, false, false] },
        ]] },
        layout: { defaultBorder: false },
        margin: [0, 16, 0, 0],
      },
      {
        text: "Il presente documento costituisce parte integrante del mandato di servizio e integra le Prescrizioni Generali di Sorveglianza (PGS).",
        italics: true, fontSize: 7.5, color: "#6B7280", margin: [0, 8, 0, 0],
      },
    ],
  });

  // 8. ALLEGATI / FOTO
  const foto = (Array.isArray(dati.foto) ? dati.foto : []).filter((p) => p && p.url);
  if (foto.length) {
    startSection("8. Allegati e foto");
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
    // Evita i titoli di sezione orfani a fondo pagina: se un sectionTitle
    // resta da solo in fondo (nessun nodo dopo di lui sulla pagina), lo
    // spinge alla pagina successiva.
    pageBreakBefore: function (currentNode, followingNodesOnPage) {
      return currentNode.style === "sectionTitle" && followingNodesOnPage.length === 0;
    },
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

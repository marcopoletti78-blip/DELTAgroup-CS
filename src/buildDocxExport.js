/**
 * Genera un .docx scaricabile dal modello dati del Concetto di Sicurezza (stesso schema usato per PDF/HTML).
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

function para(text, runOpts = {}) {
  const t = (text ?? "").toString();
  if (!t.trim()) return null;
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: t, ...runOpts })],
  });
}

function sectionHeading(num, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: `${num}  ${title}`, bold: true })],
  });
}

function subsection(num, title, body) {
  const parts = [];
  parts.push(
    new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: `${num} ${title}`, bold: true, italics: true })],
    }),
  );
  const b = (body ?? "").toString();
  if (b.trim()) {
    const block = para(b);
    if (block) parts.push(block);
  }
  return parts;
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function contattiTable(rows) {
  const header = new TableRow({
    children: ["Aree", "Società / Persona", "Tel. Azienda / E-Mail", "Tel. Mobile"].map(
      (h) =>
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        }),
    ),
  });
  const dataRows = (rows || []).map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(r.area || "")] }),
          new TableCell({ children: [new Paragraph(r.societa || "")] }),
          new TableCell({ children: [new Paragraph((r.email || r.telAzienda) || "")] }),
          new TableCell({ children: [new Paragraph(r.telMobile || "")] }),
        ],
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...dataRows],
  });
}

function riskTable(title, rows) {
  const hdr = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: title, bold: true })] })] }),
      ...["Minimo", "Medio", "Grande"].map(
        (l) =>
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l, bold: true })] })],
          }),
      ),
    ],
  });
  const body = (rows || []).map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(r.nome || "")] }),
          ...["MINIMO", "MEDIO", "GRANDE"].map((lv) =>
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: r.lv === lv ? "●" : "" })],
                }),
              ],
            }),
          ),
        ],
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [hdr, ...body],
  });
}

/** @param {Record<string, unknown>} data */
export async function buildDeltaDocxBlob(data) {
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Concetto di sicurezza", bold: true })],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "DELTAgroup Security & Services AG" })],
    }),
  );
  if (data?.nomeEvento) children.push(para(String(data.nomeEvento), { bold: true }));
  if (data?.luogo) children.push(para(`Luogo: ${data.luogo}`));
  if (data?.anno) children.push(para(`Edizione: ${data.anno}`));
  children.push(pageBreak());

  children.push(sectionHeading("1", "Responsabilità"));
  const contatti = data?.s1?.contatti || [];
  if (contatti.length) children.push(contattiTable(contatti));
  for (const [n, t, key] of [
    ["1.1", "Servizio di sicurezza", "sicurezza"],
    ["1.2", "Polizia", "polizia"],
    ["1.3", "Sanitari", "sanitari"],
    ["1.4", "REGA", "rega"],
    ["1.5", "Pompieri", "pompieri"],
  ]) {
    const v = data?.s1?.[key];
    if (v) children.push(...subsection(n, t, v));
  }
  if (data?.s1?.statoMaggiore) children.push(...subsection("1.6", "Stato Maggiore", data.s1.statoMaggiore));
  if (data?.s1?.puntoRitrovo) children.push(para(`Punto di ritrovo: ${data.s1.puntoRitrovo}`, { bold: true }));

  children.push(pageBreak());
  children.push(sectionHeading("2", "Descrizione"));
  if (data?.s2?.descrizione) children.push(para(data.s2.descrizione));
  const prog = data?.s2?.programma || [];
  for (const pr of prog) {
    const line = [pr.giorno, pr.attivita].filter(Boolean).join(" — ");
    if (line) children.push(para(line));
  }
  for (const [n, t, key] of [
    ["2.1", "Periodo e orari d'apertura", "orari"],
    ["2.2", "Location", "location"],
    ["2.3", "Pattuglia esterna", "pattuglia"],
    ["2.4", "Tipologia e numero dei visitatori", "visitatori"],
    ["2.5", "Gestione dei minori", "minori"],
  ]) {
    const v = data?.s2?.[key];
    if (v) children.push(...subsection(n, t, v));
  }

  children.push(pageBreak());
  children.push(sectionHeading("3", "Analisi dei pericoli"));
  children.push(
    para(
      "Ad ogni evento vi sono fattori di rischio che potrebbero pregiudicare il buon esito dello stesso. Una valutazione attenta di questi fattori può influire sia sulla buona riuscita che sulle misure da adottare in caso di necessità.",
    ),
  );
  if (data?.s3?.passivi?.length) {
    children.push(para("Rischi passivi", { bold: true }));
    children.push(riskTable("Pericolo", data.s3.passivi));
  }
  if (data?.s3?.attivi?.length) {
    children.push(para("Rischi attivi", { bold: true }));
    children.push(riskTable("Pericolo", data.s3.attivi));
  }
  for (const [n, t, key] of [
    ["3.2", "Meteo", "meteo"],
    ["3.3", "Atto terroristico / attentato", "terrorismo"],
    ["3.4", "Evacuazione", "evacuazione"],
  ]) {
    const v = data?.s3?.[key];
    if (v) children.push(...subsection(n, t, v));
  }

  children.push(pageBreak());
  children.push(sectionHeading("4", "Dispositivo di sicurezza"));
  children.push(
    para("La DELTAgroup Security & Services AG mette a disposizione il seguente dispositivo di sicurezza."),
  );
  for (const r of data?.s4?.righe || []) {
    const line = [r.data, r.agenti, r.orario ? `(${r.orario})` : ""].filter(Boolean).join(" — ");
    if (line) children.push(para(line));
  }
  for (const [n, t, key] of [
    ["4.1", "Modifiche", "modifiche"],
    ["4.2", "Comunicazioni", "comunicazioni"],
  ]) {
    const v = data?.s4?.[key];
    if (v) children.push(...subsection(n, t, v));
  }
  children.push(...subsection("4.3", "Divisa", "Secondo regolamento DELTAgroup."));
  for (const [n, t, key] of [
    ["4.4", "Posto Comando", "postoComando"],
    ["4.5", "Diversi", "diversi"],
  ]) {
    const v = data?.s4?.[key];
    if (v) children.push(...subsection(n, t, v));
  }

  children.push(pageBreak());
  children.push(sectionHeading("5", "Scenari"));
  for (const [n, t, key] of [
    ["5.1", "Incendio", "incendio"],
    ["5.2", "Intossicazione", "intossicazione"],
    ["5.3", "Problemi d'ordine", "ordine"],
    ["5.4", "Ferimenti / Malori", "ferimenti"],
    ["5.5", "Sostanze stupefacenti", "droghe"],
  ]) {
    const v = data?.s5?.[key];
    if (v) children.push(...subsection(n, t, v));
  }

  children.push(pageBreak());
  children.push(sectionHeading("6", "Casi d'Allarme"));
  if (data?.s6?.smc) children.push(...subsection("6.1", "Stato Maggiore di Crisi", data.s6.smc));
  const alarmBlocks = [
    ["6.2", "Evacuazione", "ev"],
    ["6.3", "Allarme incendio", "inc"],
    ["6.4", "Minaccia Bomba", "mb"],
    ["6.5", "Allarme Bomba (indicazione precisa)", "ab"],
    ["6.6", "Atto Terroristico / Attentato", "at"],
    ["6.7", "Allarme tecnico (Corrente elettrica)", "te"],
    ["6.8", "Allarme Meteo", "me"],
  ];
  for (const [n, t, k] of alarmBlocks) {
    const arr = data?.s6?.[k];
    if (arr?.length) {
      children.push(...subsection(n, t, arr.map((s, i) => `${i + 1}. ${s}`).join("\n")));
    }
  }
  children.push(
    ...subsection(
      "6.9",
      "Annunci d'emergenza",
      "La DELTA Security AG prepara e predispone il formulario degli annunci d'emergenza in prossimità di ogni palco o punto dove si possa, tramite un dispositivo audio, effettuare gli annunci.",
    ),
  );

  children.push(pageBreak());
  children.push(sectionHeading("A1", "Allegato 1 – Formulario annunci d'emergenza"));
  children.push(
    para(
      "Il testo completo multilingua dell'Allegato 1 è disponibile nell'anteprima HTML dell'applicazione e nel PDF esportato.",
    ),
  );

  children.push(pageBreak());
  children.push(sectionHeading("A2", "Allegato 2 – Planimetria dispositivo agenti"));
  children.push(
    para(
      "Per la planimetria allegata (immagine/PDF) fare riferimento all'anteprima nell'app o al PDF esportato; il formato Word supporta meglio il testo strutturato.",
    ),
  );

  const filtered = children.filter(Boolean);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: filtered,
      },
    ],
  });

  return Packer.toBlob(doc);
}

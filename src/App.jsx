import React, { useState } from "react";
import logoImg from "./assets/logo.jpg";
import { generateDocxBlob } from "./buildDocx";
import { buildCsPdfBlob } from "./buildCsPdf";
import { saveAs } from "file-saver";
import PpsWizard from "./features/pps/PpsWizard";
import PpsList from "./features/pps/PpsList";
import PpsImport from "./features/pps/PpsImport";
import CsList from "./features/cs/CsList";
import { supabase } from "./supabaseClient";

// ── CONDIVISIONE / DOWNLOAD DOCX (Web Share API con fallback) ─────────────────
async function shareOrDownloadDocx(blob, filename, title, text) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const file = new File([blob], filename, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── CONDIVISIONE / DOWNLOAD PDF (Web Share API con fallback) ──────────────────
async function shareOrDownloadPdf(blob, filename, title, text) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const file = new File([blob], filename, { type: "application/pdf" });
  if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Estrae { title, html } da un nodo sezione della preview CS.
// Convenzione: il titolo è il PRIMO figlio del nodo (barra/intestazione),
// il resto è il corpo.
function csSectionFromNode(node) {
  if (!node) return null;
  const clone = node.cloneNode(true);
  clone.querySelectorAll("iframe").forEach((el) => el.remove());
  const first = clone.firstElementChild;
  let title = "";
  if (first) { title = (first.textContent || "").replace(/\s+/g, " ").trim(); first.remove(); }
  return { title, html: clone.innerHTML };
}

// Variante per contenuto HTML grezzo (presetOverrides).
function csSectionFromHtml(htmlStr) {
  if (!htmlStr) return null;
  const tmp = document.createElement("div");
  tmp.innerHTML = String(htmlStr);
  tmp.querySelectorAll("iframe").forEach((el) => el.remove());
  const first = tmp.firstElementChild;
  let title = "";
  if (first) { title = (first.textContent || "").replace(/\s+/g, " ").trim(); first.remove(); }
  return { title, html: tmp.innerHTML };
}

// ── PALETTE ──────────────────────────────────────────────────────────────────
const N = "#0c1d3d";    // navy
const NM = "#1a3461";   // navy mid
const RD = "#c8102e";   // red (riservato a stati di errore/avviso)
const AC = "#1E40AF";   // accent blu (tema CS-PPS)
const WH = "#ffffff";
const BG = "#f4f7fc";
const GL = "#edf1f8";   // gray light
const GB = "#d0dae8";   // gray border
const TX = "#1a2038";   // text
const TM = "#52637a";   // text muted
const GR = "#9baab8";   // gray

const SANS = { fontFamily: "system-ui, -apple-system, sans-serif" };
const SERIF = { fontFamily: "Georgia, 'Times New Roman', serif" };

// ── STATIC OPTIONS ────────────────────────────────────────────────────────────
const TIPI_EVENTO = [
  "Carnevale","Festival musicale","Concerto all'aperto","Mercato natalizio",
  "Sagra / Festa popolare","Evento sportivo","Evento aziendale","Festival artistico","Altro"
];
const STRUTTURE_OPT = [
  "Bar interno","Bar esterno","Cucina calda","Food court","Palco principale",
  "Capannone / Tenda","Pista da ballo","Pista di ghiaccio","Back Stage",
  "Area VIP","Posteggio","Fondue chalet","Igloo / Padiglione","Giostra / Attrazioni"
];
const INIT = {
  name:"", anno:new Date().getFullYear().toString(), tipo:"Carnevale",
  date:"", affluenza:"", orari:"", programma:"", noteEvento:"",
  orgNome:"", orgContatto:"", orgAddr:"", orgEmail:"", orgTelAz:"", orgTelMob:"", gerente:"",
  ci:"", ciTel:"", ciEmail:"",
  municipio:"", municipioTel:"", polCant:"117", polCom:"", pomp:"118", san:"144", sama:"",
  luogo:"", comune:"", areaDesc:"", entrata:"Libera / gratuita",
  strutture:[], altreStr:"", minori:"Nessun sistema (entrata libera)", noteAccessi:"",
  disp:"", pos:"", pc:"Non previsto", comm:"Radio + Telefono di servizio",
  pompSer:"Non previsti", noteDisp:"",
};


// ── API ───────────────────────────────────────────────────────────────────────
const SYS_PROMPT = `Sei un esperto redattore di Concetti di Sicurezza per DELTAgroup Security & Services AG, Muzzano (Ticino). Tel: +41 91 921 49 49, TICINO@delta.ch. Crei documenti formali, professionali, in italiano.

Struttura standard DELTAgroup:
S1: Responsabilità (tabella contatti obbligatori + 1.1 Servizio sicurezza, 1.2 Polizia, 1.3 Sanitari, 1.4 REGA, 1.5 Pompieri, 1.6 Stato Maggiore)
Per s1.statoMaggiore usa il formato 'Parte Organizzazione: Nome Cognome' su righe separate, es: 'Parte Organizzatore: Sig. Mario Rossi\nParte Sicurezza: Capo Impiego\nParte Polizia Cantonale: Ufficiale di Picchetto'
S2: Descrizione (2.1 Periodo/orari, 2.2 Location, 2.3 Pattuglia esterna, 2.4 Visitatori, 2.5 Minori)
S3: Analisi pericoli (3.1 Tabella rischi, 3.2 Meteo, 3.3 Terrorismo se evento > 500 persone, 3.4 Evacuazione)
S4: Dispositivo sicurezza (lista agenti per data/fascia, 4.1 Modifiche, 4.2 Comunicazioni, 4.3 Divisa, 4.4 Posto Comando, 4.5 Diversi)
S5: Scenari (5.1 Incendio, 5.2 Intossicazione, 5.3 Ordine, 5.4 Ferimenti/Malori, 5.5 Droghe)
S6: Casi d'Allarme (6.1 SMC, 6.2 Evacuazione [passi numerati], 6.3 Incendio, 6.4 Minaccia Bomba, 6.5 Allarme Bomba, 6.6 Atto Terroristico, 6.7 Tecnico, 6.8 Meteo, 6.9 Annunci)

RISPONDI SOLO con JSON valido, senza markdown, senza testo aggiuntivo:
{"nomeEvento":"","luogo":"","anno":"","s1":{"contatti":[{"area":"","societa":"","email":"","telAzienda":"","telMobile":""}],"sicurezza":"","polizia":"","sanitari":"","rega":"","pompieri":"","statoMaggiore":"","puntoRitrovo":""},"s2":{"descrizione":"","programma":[{"giorno":"","attivita":""}],"orari":"","location":"","pattuglia":"","visitatori":"","minori":""},"s3":{"passivi":[{"nome":"","lv":"MINIMO"}],"attivi":[{"nome":"","lv":"MINIMO"}],"meteo":"","terrorismo":"","evacuazione":""},"s4":{"righe":[{"data":"","agenti":"","orario":""}],"modifiche":"","comunicazioni":"","postoComando":"","diversi":""},"s5":{"incendio":"","intossicazione":"","ordine":"","ferimenti":"","droghe":""},"s6":{"smc":"","ev":[""],"inc":[""],"mb":[""],"ab":[""],"at":[""],"te":[""],"me":[""]}}`;

const WORD_LIMIT_SYS_PREFIX = "Sei un assistente preciso. Se l'utente specifica un limite di parole, DEVI rispettarlo esattamente.";

function extractWordLimitInstruction(userMsg) {
  if (!userMsg || typeof userMsg !== "string") return null;
  const patterns = [
    /(?:[^.\n]*\b(?:massimo|max|minimo|min|almeno|esattamente|circa|fino\s+a|non\s+pi[uù]\s+di|limite\s+di)\b[^.\n]{0,40}\b\d+\s*parol[ea]\b[^.\n]*)/i,
    /(?:[^.\n]*\b\d+\s*parol[ea]\b[^.\n]*)/i,
  ];
  for (const re of patterns) {
    const m = userMsg.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

function maybeAppendWordLimitNote(userMsg) {
  const instruction = extractWordLimitInstruction(userMsg);
  if (!instruction) return userMsg;
  return `IMPORTANTE: rispetta esattamente il limite di parole specificato dall'utente: "${instruction}". Non superarlo.\n\n${userMsg}`;
}

function withWordLimitSysPrefix(sys) {
  if (!sys) return WORD_LIMIT_SYS_PREFIX;
  return `${WORD_LIMIT_SYS_PREFIX}\n\n${sys}`;
}

// attachments = [{ data:base64, type:"application/pdf"|"image/jpeg"|..., name }]
async function callAI(userMsg, mainDoc=null, attachments=[], sysOverride=null) {
  userMsg = maybeAppendWordLimitNote(userMsg);
  const blocks = [];
  if (mainDoc) {
    blocks.push({ type:"document", source:{ type:"base64", media_type:"application/pdf", data:mainDoc } });
  }
  for (const a of attachments) {
    const isImg = a.type.startsWith("image/");
    if (isImg) {
      blocks.push({ type:"image", source:{ type:"base64", media_type:a.type, data:a.data } });
    } else {
      blocks.push({ type:"document", source:{ type:"base64", media_type:"application/pdf", data:a.data } });
    }
  }
  blocks.push({ type:"text", text:userMsg });
  const content = blocks.length === 1 ? userMsg : blocks;
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      system: withWordLimitSysPrefix(sysOverride||SYS_PROMPT),
      messages: [{ role: "user", content }]
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "Errore API");
  let t = d.content[0].text.trim().replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();
  return JSON.parse(t);
}

async function callAIText(userMsg, sysOverride = null) {
  userMsg = maybeAppendWordLimitNote(userMsg);
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      system: withWordLimitSysPrefix(sysOverride || "Sei un redattore tecnico italiano. Rispondi SOLO con il testo richiesto, senza markdown fence, senza commenti introduttivi."),
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "Errore API");
  return d.content[0].text.trim();
}

// ── SHARED UI ─────────────────────────────────────────────────────────────────
const inp = {
  width:"100%", boxSizing:"border-box", padding:"9px 12px",
  border:`1px solid ${GB}`, borderRadius:"7px",
  fontSize:"13px", color:TX, background:WH, outline:"none", ...SANS
};

function Inp({ v, set, ph, rows, type="text" }) {
  if (rows) return <textarea value={v} onChange={e=>set(e.target.value)} placeholder={ph} rows={rows} style={{...inp,resize:"vertical"}} />;
  return <input type={type} value={v} onChange={e=>set(e.target.value)} placeholder={ph} style={inp} />;
}

function Sel({ v, set, opts }) {
  return (
    <select value={v} onChange={e=>set(e.target.value)} style={{...inp,cursor:"pointer"}}>
      {opts.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function FL({ label, req, children, span2 }) {
  return (
    <div style={span2?{gridColumn:"1/-1"}:{}}>
      <div style={{fontSize:"11px",fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.08em",color:TM,...SANS,marginBottom:"5px"}}>
        {label}{req&&<span style={{color:AC}}> *</span>}
      </div>
      {children}
    </div>
  );
}

function G2({ children }) {
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>{children}</div>;
}

function Crd({ title, children }) {
  return (
    <div style={{background:WH,border:`1px solid ${GB}`,borderRadius:"10px",marginBottom:"18px",overflow:"hidden"}}>
      <div style={{background:GL,borderBottom:`1px solid ${GB}`,padding:"9px 18px",fontSize:"11px",fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.1em",color:N,...SANS}}>
        {title}
      </div>
      <div style={{padding:"18px"}}>{children}</div>
    </div>
  );
}

function Btn({ ch, on, variant="navy", disabled=false, full=false, style={} }) {
  const styles = {
    navy: {bg:N,cl:WH},
    red:  {bg:AC,cl:WH},
    ghost:{bg:"transparent",cl:N,border:`1px solid ${GB}`},
  };
  const s = styles[variant];
  return (
    <button onClick={on} disabled={disabled} style={{
      background:disabled?"#c8d4e4":s.bg, color:disabled?GR:s.cl,
      border:s.border||"none", borderRadius:"8px",
      padding:"10px 20px", fontSize:"14px", fontWeight:"600",
      cursor:disabled?"not-allowed":"pointer",
      width:full?"100%":undefined, ...SANS, ...style
    }}>
      {ch}
    </button>
  );
}

function StepBar({ steps, cur }) {
  return (
    <div style={{display:"flex",alignItems:"flex-start",gap:0,marginBottom:"26px",overflowX:"auto"}}>
      {steps.map((s,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?"1":"0 0 auto"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"5px",minWidth:"56px"}}>
            <div style={{
              width:"28px",height:"28px",borderRadius:"50%",flexShrink:0,
              background:i<cur?N:i===cur?AC:GB,
              color:i<=cur?WH:GR,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"11px",fontWeight:"700",...SANS
            }}>
              {i<cur?"✓":i+1}
            </div>
            <div style={{fontSize:"10px",color:i===cur?N:GR,fontWeight:i===cur?"700":"400",textTransform:"uppercase",letterSpacing:"0.05em",textAlign:"center",...SANS}}>
              {s}
            </div>
          </div>
          {i<steps.length-1&&(
            <div style={{flex:1,height:"2px",background:i<cur?N:GB,margin:"0 4px",marginBottom:"20px",minWidth:"12px"}}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ── WIZARD STEPS ──────────────────────────────────────────────────────────────
function Step0({ f, u }) {
  const logoRef = React.useRef();
  const readLogo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => u("logoEvento", e.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <>
      <Crd title="Evento">
        <G2>
          <FL label="Nome evento" req><Inp v={f.name} set={v=>u("name",v)} ph="es. Carnevale Asinopoli"/></FL>
          <FL label="Anno"><Inp v={f.anno} set={v=>u("anno",v)} ph="2026"/></FL>
          <FL label="Tipo evento" req><Sel v={f.tipo} set={v=>u("tipo",v)} opts={TIPI_EVENTO}/></FL>
          <FL label="Affluenza prevista"><Inp v={f.affluenza} set={v=>u("affluenza",v)} ph="es. 1000 persone"/></FL>
          <FL label="Date evento" req><Inp v={f.date} set={v=>u("date",v)} ph="es. 4-7 febbraio 2026"/></FL>
          <FL label="Orari (apertura – chiusura)"><Inp v={f.orari} set={v=>u("orari",v)} ph="es. 20:00 – 04:00"/></FL>
        </G2>
        <div style={{marginTop:"14px"}}>
          <FL label="Programma / Serate" span2>
            <Inp v={f.programma} set={v=>u("programma",v)} ph={"Merc 04.02 – Festa bambini e aperitivo\nGiov 05.02 – Pranzo offerto, sera Fondue\nVen 06.02 – Mini corteo, sera maccheronata"} rows={5}/>
          </FL>
        </div>
      </Crd>
      <Crd title="Note aggiuntive">
        <FL label="Informazioni particolari sull'evento">
          <Inp v={f.noteEvento} set={v=>u("noteEvento",v)} ph="Dettagli speciali, accordi particolari, eventi collaterali..." rows={3}/>
        </FL>
      </Crd>
      <Crd title="Logo evento / organizzatore (opzionale)">
        <input ref={logoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>readLogo(e.target.files[0])}/>
        <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
          {f.logoEvento ? (
            <>
              <img src={f.logoEvento} alt="logo" style={{maxHeight:"70px",maxWidth:"160px",objectFit:"contain",border:`1px solid ${GB}`,borderRadius:"6px",padding:"6px",background:WH}}/>
              <div>
                <div style={{...SANS,fontSize:"12px",color:"#1a6e2e",fontWeight:"600",marginBottom:"4px"}}>✅ Logo caricato</div>
                <button onClick={()=>u("logoEvento",null)} style={{...SANS,fontSize:"11px",background:"none",border:`1px solid #aaa`,borderRadius:"5px",padding:"3px 10px",cursor:"pointer",color:GR}}>Rimuovi</button>
              </div>
            </>
          ) : (
            <button onClick={()=>logoRef.current.click()} style={{...SANS,fontSize:"13px",padding:"10px 20px",background:WH,border:`2px dashed ${GB}`,borderRadius:"8px",cursor:"pointer",color:TM,display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"22px"}}>🏷️</span> Carica logo (JPG, PNG, SVG…)
            </button>
          )}
        </div>
        <div style={{...SANS,fontSize:"11px",color:GR,marginTop:"8px"}}>Verrà stampato sulla copertina del documento</div>
      </Crd>
    </>
  );
}

function Step1({ f, u }) {
  return (
    <>
      <Crd title="Organizzatore">
        <G2>
          <FL label="Nome società" req><Inp v={f.orgNome} set={v=>u("orgNome",v)} ph="es. Società Carnevale Asinopoli"/></FL>
          <FL label="Contatto principale"><Inp v={f.orgContatto} set={v=>u("orgContatto",v)} ph="Nome cognome"/></FL>
          <FL label="Indirizzo"><Inp v={f.orgAddr} set={v=>u("orgAddr",v)} ph="Via..., CAP Comune"/></FL>
          <FL label="Email"><Inp v={f.orgEmail} set={v=>u("orgEmail",v)} ph="info@..."/></FL>
          <FL label="Tel. ufficio"><Inp v={f.orgTelAz} set={v=>u("orgTelAz",v)} ph="091 xxx xx xx"/></FL>
          <FL label="Tel. mobile"><Inp v={f.orgTelMob} set={v=>u("orgTelMob",v)} ph="079 xxx xx xx"/></FL>
        </G2>
        <div style={{marginTop:"14px"}}>
          <FL label="Gerente / Referente serale">
            <Inp v={f.gerente} set={v=>u("gerente",v)} ph="Nome cognome – Tel. 076 xxx xx xx"/>
          </FL>
        </div>
      </Crd>
      <Crd title="Responsabile sicurezza – DELTAgroup">
        <G2>
          <FL label="Capo impiego"><Inp v={f.ci} set={v=>u("ci",v)} ph="Nome cognome"/></FL>
          <FL label="Tel. capo impiego"><Inp v={f.ciTel} set={v=>u("ciTel",v)} ph="078 xxx xx xx"/></FL>
          <FL label="Email" span2><Inp v={f.ciEmail} set={v=>u("ciEmail",v)} ph="nome.cognome@delta.ch"/></FL>
        </G2>
      </Crd>
      <Crd title="Enti di primo intervento">
        <G2>
          <FL label="Municipio / comune"><Inp v={f.municipio} set={v=>u("municipio",v)} ph="Municipio di..."/></FL>
          <FL label="Tel. municipio"><Inp v={f.municipioTel} set={v=>u("municipioTel",v)} ph="091 xxx xx xx"/></FL>
          <FL label="Polizia cantonale"><Inp v={f.polCant} set={v=>u("polCant",v)} ph="117 / 0848 25 55 55"/></FL>
          <FL label="Polizia comunale"><Inp v={f.polCom} set={v=>u("polCom",v)} ph="058 xxx xx xx"/></FL>
          <FL label="Pompieri"><Inp v={f.pomp} set={v=>u("pomp",v)} ph="118 / 058 xxx xx xx"/></FL>
          <FL label="Sanitari / Croce Verde"><Inp v={f.san} set={v=>u("san",v)} ph="144 / 091 xxx xx xx"/></FL>
          <FL label="Samaritani (se previsti)" span2>
            <Inp v={f.sama} set={v=>u("sama",v)} ph="Nome responsabile, Tel. mobile"/>
          </FL>
        </G2>
      </Crd>
    </>
  );
}

function Step2({ f, u }) {
  const sel = Array.isArray(f.strutture)?f.strutture:[];
  const tog = s => u("strutture", sel.includes(s)?sel.filter(x=>x!==s):[...sel,s]);
  return (
    <>
      <Crd title="Location">
        <G2>
          <FL label="Indirizzo / area evento" req><Inp v={f.luogo} set={v=>u("luogo",v)} ph="es. Piazzale Scuole Elementari di Arbedo"/></FL>
          <FL label="Comune"><Inp v={f.comune} set={v=>u("comune",v)} ph="es. Arbedo-Castione"/></FL>
        </G2>
        <div style={{marginTop:"14px"}}>
          <FL label="Descrizione dell'area">
            <Inp v={f.areaDesc} set={v=>u("areaDesc",v)} ph="Area coperta/scoperta, dimensioni approssimative, caratteristiche principali, accessi..." rows={3}/>
          </FL>
        </div>
        <div style={{marginTop:"14px"}}>
          <FL label="Tipo entrata">
            <Sel v={f.entrata} set={v=>u("entrata",v)} opts={["Libera / gratuita","A pagamento – biglietto","A pagamento – braccialetto"]}/>
          </FL>
        </div>
      </Crd>
      <Crd title="Strutture e servizi presenti">
        <div style={{display:"flex",flexWrap:"wrap",gap:"7px",marginBottom:"14px"}}>
          {STRUTTURE_OPT.map(s=>(
            <button key={s} onClick={()=>tog(s)} style={{
              padding:"5px 13px",borderRadius:"14px",
              border:`1px solid ${sel.includes(s)?N:GB}`,
              background:sel.includes(s)?N:WH,
              color:sel.includes(s)?WH:TM,
              fontSize:"12px",cursor:"pointer",...SANS
            }}>{s}</button>
          ))}
        </div>
        <FL label="Altre strutture non elencate">
          <Inp v={f.altreStr} set={v=>u("altreStr",v)} ph="es. Arena VIP, Gondole, Area bimbi..."/>
        </FL>
      </Crd>
      <Crd title="Gestione accessi e minori">
        <FL label="Sistema identificazione minori">
          <Sel v={f.minori} set={v=>u("minori",v)} opts={[
            "Nessun sistema (entrata libera)",
            "Braccialetti colori differenti (maggiorenni / minorenni)",
            "Controllo documenti all'entrata",
            "Divieto assoluto minori di 18 anni",
          ]}/>
        </FL>
        <div style={{marginTop:"14px"}}>
          <FL label="Note accessi / Food & Beverage">
            <Inp v={f.noteAccessi} set={v=>u("noteAccessi",v)} ph="es. Vietato portare lattine o vetro dall'esterno. Controllo alcool ai bar. Verifica documenti in caso di dubbio..." rows={3}/>
          </FL>
        </div>
      </Crd>
    </>
  );
}

function Step3({ f, u }) {
  return (
    <>
      <Crd title="Dispositivo di sicurezza">
        <FL label="Agenti per data e fascia oraria" req>
          <Inp v={f.disp} set={v=>u("disp",v)} ph={"es.\n05.02.2026 – 4 agenti, 20:00-04:00\n06.02.2026 – 2 agenti 18:30-04:00, 3 agenti 20:00-04:00\n07.02.2026 – 2 agenti 18:30-05:00, 3 agenti 20:30-05:00"} rows={6}/>
        </FL>
        <div style={{marginTop:"14px"}}>
          <FL label="Posizioni previste (Allegato 2)">
            <Inp v={f.pos} set={v=>u("pos",v)} ph={"es.\n1 Agente Capannone\n2 Agenti Palestra\n2 Agenti di Ronda\n1 Agente controllo Piazzale (ven/sab)"} rows={5}/>
          </FL>
        </div>
      </Crd>
      <Crd title="Logistica e comunicazioni">
        <G2>
          <FL label="Posto comando">
            <Sel v={f.pc} set={v=>u("pc",v)} opts={["Non previsto","Uffici dell'organizzazione","Tendone dedicato","Area entrata principale"]}/>
          </FL>
          <FL label="Sistema comunicazioni">
            <Sel v={f.comm} set={v=>u("comm",v)} opts={["Radio + Telefono di servizio","Solo telefono di servizio","Radio + Telefono + WhatsApp"]}/>
          </FL>
          <FL label="Pompieri in servizio">
            <Sel v={f.pompSer} set={v=>u("pompSer",v)} opts={["Non previsti","2 militi (serata specifica)","2 militi ogni serata","4+ militi"]}/>
          </FL>
        </G2>
        <div style={{marginTop:"14px"}}>
          <FL label="Note particolari al dispositivo">
            <Inp v={f.noteDisp} set={v=>u("noteDisp",v)} ph="Accordi particolari con la Polizia, esigenze speciali, ecc." rows={3}/>
          </FL>
        </div>
      </Crd>
    </>
  );
}

function Step4({ f, onGen, loading, err }) {
  const rows = [
    ["Evento", f.name||"—"], ["Tipo", f.tipo||"—"], ["Date", f.date||"—"],
    ["Luogo", [f.luogo,f.comune].filter(Boolean).join(", ")||"—"],
    ["Affluenza", f.affluenza||"—"], ["Organizzatore", f.orgNome||"—"],
    ["Strutture", (f.strutture||[]).slice(0,4).join(", ")+(f.strutture?.length>4?"...":"")||"—"],
  ];
  return (
    <>
      <Crd title="Riepilogo dati">
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px",...SANS}}>
          <tbody>
            {rows.map(([k,v])=>(
              <tr key={k}>
                <td style={{padding:"7px 0",fontWeight:"700",color:N,width:"38%",borderBottom:`1px solid ${GL}`}}>{k}</td>
                <td style={{padding:"7px 0",color:TX,borderBottom:`1px solid ${GL}`}}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Crd>
      <div style={{background:`linear-gradient(135deg, ${N} 0%, ${NM} 100%)`,borderRadius:"12px",padding:"32px",textAlign:"center"}}>
        <div style={{...SERIF,fontSize:"20px",color:WH,marginBottom:"8px"}}>Pronto per la generazione</div>
        <div style={{...SANS,fontSize:"13px",color:"rgba(255,255,255,0.72)",marginBottom:"24px",lineHeight:1.65}}>
          L'AI genererà il Concetto di Sicurezza completo<br/>seguendo gli standard DELTAgroup.
        </div>
        {err&&(
          <div style={{background:"rgba(200,16,46,0.2)",border:`1px solid ${RD}`,borderRadius:"8px",padding:"10px",color:"#ff9999",fontSize:"13px",marginBottom:"16px",...SANS}}>
            ⚠ {err}
          </div>
        )}
        <button onClick={onGen} disabled={loading||!f.name} style={{
          background:loading||!f.name?"#4a6490":AC, color:WH,
          border:"none",borderRadius:"10px",padding:"14px 44px",
          fontSize:"15px",fontWeight:"600",cursor:loading||!f.name?"not-allowed":"pointer",...SANS
        }}>
          {loading?"⏳  Generazione in corso...":"⚡  Genera Concetto di Sicurezza"}
        </button>
        {!f.name&&<div style={{color:"rgba(255,255,255,0.45)",fontSize:"12px",marginTop:"8px",...SANS}}>Inserisci il nome dell'evento per procedere</div>}
      </div>
    </>
  );
}

// ── WIZARD ────────────────────────────────────────────────────────────────────
const STEPS = ["Evento","Responsabilità","Location","Dispositivo","Generazione"];

function Wizard({ onBack, onDone }) {
  const [st, setSt] = useState(0);
  const [f, setF] = useState(INIT);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const u = (k,v) => setF(p=>({...p,[k]:v}));

  const gen = async () => {
    setLoading(true); setErr(null);
    try {
      const fClean = {...f, logoEvento: f.logoEvento ? "[logo_caricato]" : null};
const data = await callAI(`Crea un Concetto di Sicurezza completo per:\n${JSON.stringify(fClean,null,2)}`);
      onDone({...data, logoEvento: f.logoEvento||null, eventSettings: {...f}});
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"calc(100vh - 60px)",background:BG,padding:"28px 20px"}}>
      <div style={{maxWidth:"700px",margin:"0 auto"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:TM,fontSize:"13px",...SANS,marginBottom:"14px",padding:0}}>
          ← Torna all'inizio
        </button>
        <div style={{...SERIF,fontSize:"22px",fontWeight:"700",color:N,marginBottom:"4px"}}>Nuovo Concetto di Sicurezza</div>
        <div style={{...SANS,fontSize:"13px",color:TM,marginBottom:"22px"}}>Compila i campi nelle seguenti sezioni</div>
        <StepBar steps={STEPS} cur={st}/>
        {st===0&&<Step0 f={f} u={u}/>}
        {st===1&&<Step1 f={f} u={u}/>}
        {st===2&&<Step2 f={f} u={u}/>}
        {st===3&&<Step3 f={f} u={u}/>}
        {st===4&&<Step4 f={f} onGen={gen} loading={loading} err={err}/>}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:"20px"}}>
          <Btn ch={st===0?"← Indietro":"← Precedente"} on={()=>st>0?setSt(st-1):onBack()} variant="ghost"/>
          {st<4&&<Btn ch="Avanti →" on={()=>setSt(st+1)}/>}
        </div>
      </div>
    </div>
  );
}

// ── MODIFY ────────────────────────────────────────────────────────────────────
function Modify({ onBack, onDone }) {
  const [mods, setMods] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // ── Documento principale (concetto esistente)
  const [mainData, setMainData] = useState(null);
  const [mainName, setMainName] = useState(null);
  const [mainDrag, setMainDrag] = useState(false);
  const mainRef = React.useRef();

  // ── Allegati aggiuntivi (mail, piantine, nuove disposizioni...)
  const [attachments, setAttachments] = useState([]);
  const [addDrag, setAddDrag] = useState(false);
  const addRef = React.useRef();

  const ALLOWED_PDF  = ["application/pdf"];
  const ALLOWED_IMG  = ["image/jpeg","image/jpg","image/png","image/gif","image/webp"];
  const ALLOWED_EXT  = [".pdf",".jpg",".jpeg",".png",".gif",".webp"];

  const detectType = (file) => {
    if (ALLOWED_PDF.includes(file.type)) return "application/pdf";
    if (ALLOWED_IMG.includes(file.type)) return file.type;
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
    if (ext === ".pdf") return "application/pdf";
    if ([".jpg",".jpeg"].includes(ext)) return "image/jpeg";
    if (ext === ".png")  return "image/png";
    if (ext === ".gif")  return "image/gif";
    if (ext === ".webp") return "image/webp";
    return null;
  };

  const readAsB64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = (e) => res(e.target.result.split(",")[1]);
    r.onerror = () => rej(new Error("Errore lettura file"));
    r.readAsDataURL(file);
  });

  // Carica documento principale
  const readMain = async (file) => {
    if (!file) return;
    if (detectType(file) !== "application/pdf") { setErr("Il documento principale deve essere un PDF."); return; }
    setErr(null);
    const b64 = await readAsB64(file);
    setMainData(b64); setMainName(file.name);
  };

  // Aggiunge allegati multipli
  const addFiles = async (files) => {
    setErr(null);
    const toAdd = [];
    const MAX_MB = 10;
    for (const file of Array.from(files)) {
      const t = detectType(file);
      if (!t) { setErr(`Formato non supportato: ${file.name}. Usa PDF o immagini (JPG, PNG).`); continue; }
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > MAX_MB) {
        setErr(`⚠ "${file.name}" è ${sizeMB.toFixed(1)}MB — troppo grande per l'AI (max ${MAX_MB}MB). Per planimetrie grandi usa la sezione Allegato 2 nell'editor dopo la generazione.`);
        continue;
      }
      const data = await readAsB64(file);
      toAdd.push({ id: Date.now() + Math.random(), name: file.name, type: t, data });
    }
    setAttachments(prev => [...prev, ...toAdd]);
  };

  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  const gen = async () => {
    if (!mainData) { setErr("Carica prima il concetto di sicurezza esistente (PDF)."); return; }
    setLoading(true); setErr(null);
    const attList = attachments.map(a => {
      const isImg = a.type.startsWith("image/");
      return `- ${a.name} (${isImg ? "immagine/piantina" : "documento PDF"})`;
    }).join("\n");
    const prompt = `MODIFICHE DA APPORTARE AL CONCETTO DI SICUREZZA ALLEGATO:
${mods || "(nessuna indicazione testuale aggiuntiva)"}

${attachments.length > 0 ? `DOCUMENTI/IMMAGINI AGGIUNTIVI ALLEGATI (${attachments.length}):\n${attList}\n\nAnalizza tutti gli allegati e integra le informazioni nei capitoli corretti del documento (date/orari → S2, dispositivo/piano impiego → S4, rischi → S3, piantine → Allegato 2, ecc.).` : ""}`;
    try {
      const data = await callAI(prompt, mainData, attachments);
      onDone({...data, logoEvento: null});
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const fileIcon = (type) => type.startsWith("image/") ? "🖼️" : "📄";
  const fileLabel = (type) => type.startsWith("image/") ? "Immagine / Piantina" : "Documento PDF";

  const dropBase = (drag) => ({
    border: `2px dashed ${drag ? N : GB}`,
    borderRadius: "10px",
    padding: "22px 16px",
    textAlign: "center",
    cursor: "pointer",
    background: drag ? "#eef2f9" : WH,
    transition: "all 0.2s",
  });

  return (
    <div style={{minHeight:"calc(100vh - 60px)",background:BG,padding:"28px 20px"}}>
      <div style={{maxWidth:"700px",margin:"0 auto"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:TM,fontSize:"13px",...SANS,marginBottom:"14px",padding:0}}>
          ← Torna all'inizio
        </button>
        <div style={{...SERIF,fontSize:"22px",fontWeight:"700",color:N,marginBottom:"4px"}}>Modifica Concetto Esistente</div>
        <div style={{...SANS,fontSize:"13px",color:TM,marginBottom:"22px"}}>
          Carica il concetto esistente, aggiungi tutti i materiali con le nuove info e descrivi eventuali modifiche aggiuntive
        </div>

        {/* ── 1. Documento principale ── */}
        <Crd title="1. Concetto di sicurezza attuale (PDF)">
          <input ref={mainRef} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>readMain(e.target.files[0])}/>
          {!mainName ? (
            <div style={dropBase(mainDrag)}
              onClick={()=>mainRef.current.click()}
              onDragOver={e=>{e.preventDefault();setMainDrag(true);}}
              onDragLeave={()=>setMainDrag(false)}
              onDrop={e=>{e.preventDefault();setMainDrag(false);readMain(e.dataTransfer.files[0]);}}>
              <div style={{fontSize:"32px",marginBottom:"8px"}}>📋</div>
              <div style={{...SANS,fontWeight:"600",color:N,fontSize:"14px",marginBottom:"3px"}}>Trascina il PDF del concetto esistente</div>
              <div style={{...SANS,fontSize:"12px",color:GR}}>oppure clicca per sceglierlo · solo PDF</div>
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"#f0f7f0",border:"1px solid #c3e6cb",borderRadius:"8px"}}>
              <span style={{fontSize:"26px"}}>✅</span>
              <div style={{flex:1}}>
                <div style={{...SANS,fontWeight:"600",color:"#1a6e2e",fontSize:"13px"}}>{mainName}</div>
                <div style={{...SANS,fontSize:"11px",color:"#2d8a44",marginTop:"2px"}}>Documento principale caricato</div>
              </div>
              <button onClick={()=>{setMainData(null);setMainName(null);}} style={{background:"none",border:"1px solid #aaa",borderRadius:"6px",padding:"4px 10px",cursor:"pointer",fontSize:"12px",...SANS,color:GR}}>Cambia</button>
            </div>
          )}
        </Crd>

        {/* ── 2. Allegati aggiuntivi ── */}
        <Crd title="2. Nuovi materiali (mail, piantine, piani d'impiego…)">
          <input ref={addRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" multiple style={{display:"none"}}
            onChange={e=>addFiles(e.target.files)}/>

          {/* Drop zone */}
          <div style={dropBase(addDrag)}
            onClick={()=>addRef.current.click()}
            onDragOver={e=>{e.preventDefault();setAddDrag(true);}}
            onDragLeave={()=>setAddDrag(false)}
            onDrop={e=>{e.preventDefault();setAddDrag(false);addFiles(e.dataTransfer.files);}}>
            <div style={{fontSize:"32px",marginBottom:"8px"}}>📎</div>
            <div style={{...SANS,fontWeight:"600",color:N,fontSize:"14px",marginBottom:"3px"}}>
              Aggiungi mail, piantine, nuovi orari, piani d'impiego…
            </div>
            <div style={{...SANS,fontSize:"12px",color:GR}}>PDF, JPG, PNG · più file contemporaneamente · l'AI posiziona tutto nei capitoli giusti</div>
          </div>

          {/* Lista allegati */}
          {attachments.length > 0 && (
            <div style={{marginTop:"12px",display:"flex",flexDirection:"column",gap:"6px"}}>
              {attachments.map(a => (
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 12px",background:"#f5f7fb",border:`1px solid ${GB}`,borderRadius:"7px"}}>
                  <span style={{fontSize:"20px"}}>{fileIcon(a.type)}</span>
                  <div style={{flex:1}}>
                    <div style={{...SANS,fontSize:"13px",fontWeight:"600",color:TX}}>{a.name}</div>
                    <div style={{...SANS,fontSize:"11px",color:GR}}>{fileLabel(a.type)}</div>
                  </div>
                  <button onClick={()=>removeAttachment(a.id)}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:"18px",lineHeight:1,padding:"0 2px"}}
                    title="Rimuovi">×</button>
                </div>
              ))}
              <div style={{...SANS,fontSize:"11px",color:GR,marginTop:"4px"}}>
                {attachments.length} allegato{attachments.length>1?"i":""} · clicca × per rimuovere
              </div>
            </div>
          )}
        </Crd>

        {/* ── 3. Note aggiuntive ── */}
        <Crd title="3. Note aggiuntive (opzionale)">
          <Inp v={mods} set={setMods}
            ph={"Aggiungi eventuali indicazioni che non compaiono nei documenti allegati:\nes. Il nuovo capo impiego è Marco Poletti, tel. 078 333 43 33.\nes. Rimuovere il riferimento al servizio sanitario privato, resta solo la CRI.\nes. L'agente al settore B lavora solo sabato sera."}
            rows={5}/>
          <div style={{...SANS,fontSize:"11px",color:GR,marginTop:"6px",lineHeight:1.6}}>
            ℹ Allega qui mail, email, nuovi orari (max ~3MB per file) · L'AI li analizza e posiziona nei capitoli giusti<br/>
            📐 <strong>Planimetrie grandi</strong>: aggiungile nell'Allegato 2 dopo la generazione — non serve mandarle all'AI
          </div>
        </Crd>

        {err&&<div style={{background:"#fff0f0",border:`1px solid ${RD}`,borderRadius:"8px",padding:"10px",color:RD,fontSize:"13px",marginBottom:"14px",...SANS}}>⚠ {err}</div>}
        <Btn ch={loading?"⏳  Elaborazione in corso...":"⚡  Aggiorna Concetto di Sicurezza"} on={gen} disabled={loading||!mainData} full variant="red"/>
      </div>
    </div>
  );
}
// ── DOCUMENT PREVIEW ─────────────────────────────────────────────────────────
const LV_C = { MINIMO:"#16a34a", MEDIO:"#d97706", GRANDE:"#dc2626" };

function RiskTbl({ title, rows }) {
  return (
    <table style={{width:"100%",borderCollapse:"collapse",marginBottom:"14px",fontSize:"12px"}}>
      <thead>
        <tr>
          <th style={{background:GL,color:N,padding:"7px 10px",textAlign:"left",...SANS,fontWeight:"700",border:`1px solid ${GB}`}}>{title}</th>
          {["Minimo","Medio","Grande"].map(l=>(
            <th key={l} style={{background:LV_C[l.toUpperCase()],color:WH,padding:"7px 10px",textAlign:"center",...SANS,width:"70px",border:`1px solid ${GB}`}}>{l}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(rows||[]).map((r,i)=>(
          <tr key={i} style={{background:i%2===0?WH:"#f9fbfd"}}>
            <td style={{padding:"7px 10px",border:`1px solid ${GB}`,...SANS}}>{r.nome}</td>
            {["MINIMO","MEDIO","GRANDE"].map(l=>(
              <td key={l} style={{padding:"7px 10px",textAlign:"center",border:`1px solid ${GB}`}}>
                {r.lv===l&&<div style={{width:"50px",height:"13px",background:LV_C[l],borderRadius:"2px",margin:"0 auto"}}/>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Dsec({ n, t, children, id }) {
  return (
    <div id={id} style={{marginBottom:"28px"}}>
      <div style={{background:N,color:WH,padding:"9px 16px",fontSize:"13px",fontWeight:"700",...SANS,borderRadius:"6px 6px 0 0",breakAfter:"avoid",pageBreakAfter:"avoid"}}>{n}&nbsp;&nbsp;{t}</div>
      <div style={{border:`1px solid ${GB}`,borderTop:"none",borderRadius:"0 0 6px 6px",padding:"20px",background:WH}}>{children}</div>
    </div>
  );
}

function Dsub({ n, t, children }) {
  return (
    <div style={{marginBottom:"17px",breakInside:"avoid",pageBreakInside:"avoid"}}>
      <div style={{fontWeight:"700",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.07em",textDecoration:"underline",color:N,marginBottom:"7px",...SANS,breakAfter:"avoid",pageBreakAfter:"avoid"}}>{n}&nbsp;{t}</div>
      <div style={{fontSize:"12.5px",lineHeight:1.75,color:TX,...SANS}}>{children}</div>
    </div>
  );
}

// Emergency announcements – static content identical in all DELTAgroup docs
const ANNUNCI = [
  { n:"Notfallmeldung 1: Räumung", items:[
    {l:"[deutsch]", t:"Achtung, achtung – Liebe Zuschauer\nAus technischen Gründen sehen wir uns veranlasst, das Stadion zu räumen.\nSie haben genügend Zeit, bitte verlassen sie ruhig ihren Platz, es besteht absolut keine Gefahr.\nGehen sie nicht zur Garderobe oder auf die Toiletten.\nUnser Personal wird ihnen helfen."},
    {l:"[français]", t:"Votre attention s'il-vous-plaît – Chers spectateurs\nPour des raisons techniques, nous sommes contraints d'évacuer le stade.\nVeuillez garder votre sang-froid et quitter votre place calmement, vous avez suffisamment de temps.\nAucun danger ne vous menace. Ne vous rendez pas à la garderobe ou aux toilettes.\nNotre personnel est là pour vous aider."},
    {l:"[italiano]", t:"Alla vostra attenzione – Cari spettatori\nPer motivi tecnici siamo costretti ad evacuare la Piazza.\nLasciate il vostro posto con calma, non c'è assolutamente pericolo.\nÈ vietato entrare nelle toilette o nei guardaroba.\nIl nostro personale vi sarà d'aiuto."},
    {l:"[english]", t:"Attention, please – Dear spectators\nDue to technical reasons, we are obliged to evacuate the stadium.\nYou will have enough time – please leave your seat calmly, there is no acute danger.\nDo not go to the changing rooms.\nOur staff will help you."},
  ]},
  { n:"Notfallmeldung 2: Ausschreitungen", items:[
    {l:"[deutsch]", t:"Achtung, achtung – Liebe Zuschauer\nWir bitten sie, die Sicherheitsbestimmungen unbedingt einzuhalten.\nWir bitten die Zuschauer, sich ruhig zu verhalten, ansonst wird das Konzert sofort abgebrochen.\nWir danken ihnen für ihr Verständnis."},
    {l:"[italiano]", t:"Alla vostra attenzione – Cari spettatori\nVi preghiamo di osservare le disposizioni di sicurezza all'interno della Piazza.\nVi invitiamo a rimanere calmi, altrimenti saremo costretti ad interrompere il concerto.\nRingraziamo per la vostra comprensione."},
    {l:"[english]", t:"Attention, please – Dear spectators\nWe ask you to follow immediately our rules for safety & security.\nPlease stay out of troubles, otherwise we will have to stop the event right away.\nWe thank you for your comprehension."},
  ]},
  { n:"Notfallmeldung 3: Unterbrechung", items:[
    {l:"[deutsch]", t:"Achtung, achtung – Liebe Zuschauer\nLeider müssen wir das Konzert kurz unterbrechen, da sich eine technische Störung ereignet hat.\nBitte bleiben sie auf ihren Plätzen, es besteht kein Grund zur Beunruhigung.\nWir sind bemüht, die Störung sofort zu beheben. Wir danken ihnen für ihr Verständnis."},
    {l:"[italiano]", t:"Alla vostra attenzione – Cari spettatori\nPer motivi tecnici siamo costretti ad interrompere momentaneamente il concerto.\nRimanete al vostro posto, non c'è motivo di preoccuparsi.\nRisolveremo il guasto il più presto possibile. Ringraziamo per la vostra comprensione."},
    {l:"[english]", t:"Attention, please – Dear spectators\nUnfortunately we have to interrupt the concert for a short moment due to a technical problem.\nPlease stay on your seats – there is no reason to be worried.\nWe make every endeavour to solve the problem promptly. We thank you for your comprehension."},
  ]},
];

// TOC entries definition
const TOC_ENTRIES = [
  {n:"1", t:"Responsabilità"},
  {n:"1.1", t:"Servizio di sicurezza"}, {n:"1.2", t:"Polizia"}, {n:"1.3", t:"Sanitari"},
  {n:"1.4", t:"REGA"}, {n:"1.5", t:"Pompieri"}, {n:"1.6", t:"Stato Maggiore"},
  {n:"2", t:"Descrizione"},
  {n:"2.1", t:"Periodo e orari d'apertura"}, {n:"2.2", t:"Location (vedi Allegato 2)"},
  {n:"2.3", t:"Pattuglia esterna"}, {n:"2.4", t:"Tipologia e numero dei visitatori"}, {n:"2.5", t:"Gestione dei minori"},
  {n:"3", t:"Analisi dei pericoli"},
  {n:"3.1", t:"Analisi del rischio"}, {n:"3.2", t:"Meteo"}, {n:"3.3", t:"Atto terroristico / attentato"}, {n:"3.4", t:"Evacuazione"},
  {n:"4", t:"Dispositivo di sicurezza"},
  {n:"4.1", t:"Modifiche"}, {n:"4.2", t:"Comunicazioni"}, {n:"4.3", t:"Divisa"}, {n:"4.4", t:"Posto Comando"}, {n:"4.5", t:"Diversi"},
  {n:"5", t:"Scenari"},
  {n:"5.1", t:"Incendio"}, {n:"5.2", t:"Intossicazione"}, {n:"5.3", t:"Problemi d'ordine"}, {n:"5.4", t:"Ferimenti / Malori"}, {n:"5.5", t:"Sostanze stupefacenti"},
  {n:"6", t:"Casi d'Allarme"},
  {n:"6.1", t:"Stato Maggiore di Crisi"}, {n:"6.2", t:"Evacuazione"}, {n:"6.3", t:"Allarme incendio"},
  {n:"6.4", t:"Minaccia Bomba"}, {n:"6.5", t:"Allarme Bomba"}, {n:"6.6", t:"Atto Terroristico"},
  {n:"6.7", t:"Allarme tecnico"}, {n:"6.8", t:"Allarme Meteo"}, {n:"6.9", t:"Annunci d'emergenza"},
  {n:"All. 1", t:"Formulario Annunci d'Emergenza"},
  {n:"All. 2", t:"Planimetria dispositivo agenti"},
];

const DEFAULT_SECTION_ORDER = ["ps1", "ps2", "ps3", "ps4", "ps5", "ps6", "all1", "all2"];
// Indici TOC_ENTRIES per preset:
// ps1: 0 (main) + 1..6 (6 sub)        → slice(0, 7)
// ps2: 7 (main) + 8..12 (5 sub)       → slice(7, 13)
// ps3: 13 (main) + 14..17 (4 sub)     → slice(13, 18)
// ps4: 18 (main) + 19..23 (5 sub)     → slice(18, 24)
// ps5: 24 (main) + 25..29 (5 sub)     → slice(24, 30)
// ps6: 30 (main) + 31..39 (9 sub)     → slice(30, 40)
// All. 1 = TOC_ENTRIES[40], All. 2 = TOC_ENTRIES[41]
const TOC_PRESET_BLOCKS = {
  ps1: TOC_ENTRIES.slice(0, 7),
  ps2: TOC_ENTRIES.slice(7, 13),
  ps3: TOC_ENTRIES.slice(13, 18),
  ps4: TOC_ENTRIES.slice(18, 24),
  ps5: TOC_ENTRIES.slice(24, 30),
  ps6: TOC_ENTRIES.slice(30, 40),
};
const TOC_ALL1_ENTRY = TOC_ENTRIES[40];
const TOC_ALL2_ENTRY = TOC_ENTRIES[41];

// Quanti sotto-capitoli preset ha ciascun capitolo preset (i custom partono da X.(PRESET+1)).
const PRESET_SUB_COUNT = { ps1: 6, ps2: 5, ps3: 4, ps4: 5, ps5: 5, ps6: 9 };

function parseCustomSectionKey(key) {
  if (!key?.startsWith("custom:")) return null;
  return key.slice(7);
}

/** Running chapter (ps* + custom capitolo), allegato (all* + custom allegato), and X.Y sotto-capitoli by sectionOrder. */
function buildSectionNumberMaps(sectionOrder, customSections, presetDeletedItems = {}) {
  const cs = Array.isArray(customSections) ? customSections : [];
  const order = Array.isArray(sectionOrder) && sectionOrder.length ? sectionOrder : [...DEFAULT_SECTION_ORDER];
  const chapterNumByKey = new Map();
  const allegatoNumByKey = new Map();
  const subchapterDisplayByKey = new Map();
  const subCountByParent = new Map();
  // All.1 e All.2 sono riservati ai preset all1/all2 anche se non presenti nell'order.
  // I custom allegati partono da All.3.
  allegatoNumByKey.set("all1", 1);
  allegatoNumByKey.set("all2", 2);
  // Pre-pass 1: numeri capitolo (ps* + custom capitolo) per garantire che parentNum
  // sia disponibile anche se un sub appare nell'order PRIMA del suo padre.
  let ch = 0;
  for (const key of order) {
    if (!key) continue;
    if (/^ps[1-6]$/.test(key)) {
      ch += 1;
      chapterNumByKey.set(key, ch);
    } else if (typeof key === "string" && key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = cs.find((c) => c.id === id);
      if (s?.type === "capitolo") {
        ch += 1;
        chapterNumByKey.set(key, ch);
      }
    }
  }
  // Pre-pass 2: numeri allegato (custom). All.1 e All.2 già riservati.
  let al = 2;
  for (const key of order) {
    if (typeof key !== "string" || !key.startsWith("custom:")) continue;
    const id = parseCustomSectionKey(key);
    const s = cs.find((c) => c.id === id);
    if (s?.type === "allegato") {
      al += 1;
      allegatoNumByKey.set(key, al);
    }
  }
  // Pass principale: sotto-capitoli. Base count = sub preset già esistenti del padre
  // meno i punti eliminati. Per i capitoli custom il base è 0. Se parentKey non esiste
  // più, fallback all'ultimo capitolo visto nell'order.
  for (const [pkey, base] of Object.entries(PRESET_SUB_COUNT)) {
    const deletedSubs = ((presetDeletedItems[pkey] || [])
      .filter((n) => /^\d+\.\d+$/.test(String(n)))).length;
    subCountByParent.set(pkey, Math.max(0, base - deletedSubs));
  }
  let lastChapterKey = null;
  for (const key of order) {
    if (!key) continue;
    if (/^ps[1-6]$/.test(key)) {
      lastChapterKey = key;
      continue;
    }
    if (typeof key === "string" && key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = cs.find((c) => c.id === id);
      if (!s) continue;
      if (s.type === "capitolo") {
        lastChapterKey = key;
      } else if (s.type === "sottocapitolo") {
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

function remapTocPresetChapterRows(rows, chapterIndex) {
  if (!rows?.length || chapterIndex == null) return [];
  const p = String(chapterIndex);
  return rows.map((row) => {
    const cn = String(row.n ?? "").trim();
    const sub = cn.match(/^(\d+)\.(\d+)$/);
    if (sub) {
      return { ...row, n: `${p}.${sub[2]}`, t: String(row.t || "").replace(/^\d+(\.\d+)?\s+/, "") };
    }
    if (/^\d+$/.test(cn)) {
      return { ...row, n: p, t: String(row.t || "").replace(/^\d+\s+/, "") };
    }
    return { ...row };
  });
}

// Riordina sectionOrder mettendo ogni sottocapitolo custom subito dopo il
// proprio parent valido (preset ps* o capitolo custom presente nell'order).
// I sottocapitoli senza parent valido restano in fondo come orfani.
function normalizeSectionOrder(order, customSections) {
  const cs = Array.isArray(customSections) ? customSections : [];
  if (!Array.isArray(order) || !order.length) return order;
  const findSection = (key) => {
    if (typeof key !== "string" || !key.startsWith("custom:")) return null;
    const id = parseCustomSectionKey(key);
    return cs.find((c) => c.id === id) || null;
  };
  const isCapOrAll = (key) => {
    if (/^ps[1-6]$/.test(key) || key === "all1" || key === "all2") return true;
    const s = findSection(key);
    return s?.type === "capitolo" || s?.type === "allegato";
  };
  const isSub = (key) => findSection(key)?.type === "sottocapitolo";
  const skeleton = order.filter((k) => isCapOrAll(k));
  const skeletonKeys = new Set(skeleton);
  const subsByParent = new Map();
  const orphanSubs = [];
  for (const k of order) {
    if (!isSub(k)) continue;
    const s = findSection(k);
    const pk = s?.parentKey;
    if (pk && skeletonKeys.has(pk)) {
      const arr = subsByParent.get(pk) || [];
      arr.push(k);
      subsByParent.set(pk, arr);
    } else {
      orphanSubs.push(k);
    }
  }
  const result = [];
  for (const k of skeleton) {
    result.push(k);
    const subs = subsByParent.get(k);
    if (subs && subs.length) result.push(...subs);
  }
  if (orphanSubs.length) result.push(...orphanSubs);
  return result;
}

function insertNewCustomKeysInOrder(prevOrder, newSections) {
  const base = Array.isArray(prevOrder) && prevOrder.length ? [...prevOrder] : [...DEFAULT_SECTION_ORDER];
  for (const s of newSections) {
    const key = `custom:${s.id}`;
    if (s.type === "sottocapitolo" && s.parentKey) {
      const parentIdx = base.indexOf(s.parentKey);
      if (parentIdx < 0) {
        base.push(key);
        continue;
      }
      // Trova l'ultimo sub esistente con stesso parentKey contiguo dopo parentIdx.
      let insertAt = parentIdx + 1;
      for (let i = parentIdx + 1; i < base.length; i++) {
        const k = base[i];
        if (typeof k === "string" && k.startsWith("custom:")) {
          insertAt = i + 1;
          continue;
        }
        break;
      }
      base.splice(insertAt, 0, key);
    } else {
      base.push(key);
    }
  }
  return base;
}

function applyPresetDeletedAndRenumber(presetKey, rows, chapterIndex, presetDeletedItems, subOrder) {
  const deleted = new Set((presetDeletedItems && presetDeletedItems[presetKey]) || []);
  // Separa main e sub (sui n ORIGINALI, pre-remap).
  const mainRow = rows.find((r) => /^\d+$/.test(String(r.n ?? "").trim()));
  let subRows = rows.filter((r) => /^\d+\.\d+$/.test(String(r.n ?? "").trim()));
  subRows = subRows.filter((r) => !deleted.has(String(r.n)));
  // Riordina i sub secondo subOrder (array di "X.Y" originali); le voci non
  // presenti in subOrder restano nell'ordine originale, alla fine.
  if (Array.isArray(subOrder) && subOrder.length) {
    const byN = new Map(subRows.map((s) => [String(s.n), s]));
    const ordered = [];
    const seen = new Set();
    for (const n of subOrder) {
      const s = byN.get(String(n));
      if (s && !seen.has(String(s.n))) {
        ordered.push(s);
        seen.add(String(s.n));
      }
    }
    for (const s of subRows) {
      if (!seen.has(String(s.n))) ordered.push(s);
    }
    subRows = ordered;
  }
  const out = [];
  if (mainRow && !deleted.has(String(mainRow.n))) {
    out.push({ ...mainRow, n: String(chapterIndex), t: String(mainRow.t || "").replace(/^\d+\s+/, "") });
  }
  let subCounter = 0;
  for (const s of subRows) {
    subCounter += 1;
    out.push({ ...s, n: `${chapterIndex}.${subCounter}`, t: String(s.t || "").replace(/^\d+(\.\d+)?\s+/, "") });
  }
  return out;
}

// Stima del numero pagina di partenza per ogni "owner" key dell'order.
// Copertina=1, Indice=2, le sezioni flow partono da pagina 3, una per chiave (eccetto i sottocapitoli che ereditano dal padre).
function buildPageMapByOrderKey(sectionOrder, customSections) {
  const cs = Array.isArray(customSections) ? customSections : [];
  const order = Array.isArray(sectionOrder) && sectionOrder.length ? sectionOrder : [...DEFAULT_SECTION_ORDER];
  const map = new Map();
  let p = 3;
  for (const key of order) {
    if (!key) continue;
    if (/^ps[1-6]$/.test(key) || key === "all1" || key === "all2") {
      map.set(key, p);
      p += 1;
      continue;
    }
    if (typeof key === "string" && key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = cs.find((c) => c.id === id);
      if (!s) continue;
      if (s.type === "sottocapitolo") continue;
      map.set(key, p);
      p += 1;
    }
  }
  return map;
}

// Parent effettivo nell'order di un sottocapitolo (parentKey dichiarato se presente nell'order,
// altrimenti l'ultimo capitolo che lo precede). Funzione pura, usata dal TOC.
function effectiveParentKeyInOrder(order, idx, customSections) {
  const key = order[idx];
  if (typeof key !== "string" || !key.startsWith("custom:")) return null;
  const id = parseCustomSectionKey(key);
  const s = customSections.find((c) => c.id === id);
  if (s?.type !== "sottocapitolo") return null;
  if (s.parentKey && order.includes(s.parentKey)) return s.parentKey;
  for (let i = idx - 1; i >= 0; i--) {
    const k = order[i];
    if (!k) continue;
    if (/^ps[1-6]$/.test(k)) return k;
    if (k.startsWith("custom:")) {
      const cid = parseCustomSectionKey(k);
      const cs = customSections.find((c) => c.id === cid);
      if (cs?.type === "capitolo") return k;
    }
  }
  return null;
}

function buildTocRows(sectionOrder, customSections, presetDeletedItems = {}, presetSubOrder = {}) {
  const cs = Array.isArray(customSections) ? customSections : [];
  const order = Array.isArray(sectionOrder) && sectionOrder.length ? sectionOrder : [...DEFAULT_SECTION_ORDER];
  if (!order.length) return [];

  const { chapterNumByKey, allegatoNumByKey, subchapterDisplayByKey } = buildSectionNumberMaps(order, cs, presetDeletedItems);
  const rows = [];
  for (let i = 0; i < order.length; i++) {
    const key = order[i];
    if (!key) continue;
    if (/^ps[1-6]$/.test(key)) {
      const idx = chapterNumByKey.get(key);
      const block = TOC_PRESET_BLOCKS[key] ?? [];
      const renumbered = applyPresetDeletedAndRenumber(key, block, idx, presetDeletedItems, presetSubOrder[key]);
      rows.push(...renumbered.map((r) => ({ ...r, ownerKey: key })));
    } else if (key === "all1" && TOC_ALL1_ENTRY) {
      const deletedAll = new Set((presetDeletedItems.all1) || []);
      if (deletedAll.has(String(TOC_ALL1_ENTRY.n))) continue;
      const a = allegatoNumByKey.get("all1");
      if (a == null) continue;
      const baseT = String(TOC_ALL1_ENTRY.t).replace(/^\d+\s+/, "");
      rows.push({
        ...TOC_ALL1_ENTRY,
        n: `All. ${a}`,
        t: baseT,
        main: true,
        ownerKey: "all1",
      });
    } else if (key === "all2" && TOC_ALL2_ENTRY) {
      const deletedAll = new Set((presetDeletedItems.all2) || []);
      if (deletedAll.has(String(TOC_ALL2_ENTRY.n))) continue;
      const a = allegatoNumByKey.get("all2");
      if (a == null) continue;
      const baseT = String(TOC_ALL2_ENTRY.t).replace(/^\d+\s+/, "");
      rows.push({
        ...TOC_ALL2_ENTRY,
        n: `All. ${a}`,
        t: baseT,
        main: true,
        ownerKey: "all2",
      });
    } else if (typeof key === "string" && key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = cs.find((c) => c.id === id);
      if (!s) continue;
      if (s.type === "capitolo") {
        const n = chapterNumByKey.get(key) ?? "?";
        const title = (s.title || "Capitolo").replace(/^\d+\s+/, "");
        rows.push({ n: String(n), t: title, main: true, ownerKey: key });
      } else if (s.type === "sottocapitolo") {
        const nu = subchapterDisplayByKey.get(key) ?? "?";
        const title = (s.title || "Sotto capitolo").replace(/^\d+\.\d+\s+/, "").replace(/^\d+\s+/, "");
        const owner = effectiveParentKeyInOrder(order, i, cs) || key;
        rows.push({ n: nu, t: title, main: false, ownerKey: owner });
      } else {
        const na = allegatoNumByKey.get(key);
        if (na == null) continue;
        const title = (s.title || "Allegato").replace(/^\d+\s+/, "");
        rows.push({ n: `All. ${na}`, t: title, main: true, ownerKey: key });
      }
    }
  }
  // Dedupe difensiva: rimuove righe con stessa coppia (n, t) — mantiene la prima.
  const seen = new Set();
  return rows.filter((e) => {
    if (e == null || e.n == null || e.t == null) return false;
    const k = `${e.n} ${e.t}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function escapeHtmlPrint(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Estrae il testo leggibile da un frammento HTML preservando le interruzioni
// di paragrafo (blocchi → \n\n, br → \n).
function htmlToPlainText(html) {
  if (!html) return "";
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = String(html);
    tmp.querySelectorAll("script,style").forEach((el) => el.remove());
    tmp.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
    const blockSel = "p,div,h1,h2,h3,h4,h5,h6,li,tr";
    tmp.querySelectorAll(blockSel).forEach((el) => {
      el.append("\n");
    });
    const text = (tmp.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return text;
  }
  // Fallback senza DOM
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Avvolge il testo plain dell'override preset in HTML sicuro per la stampa.
function plainTextToPresetHtml(text) {
  if (!text || !String(text).trim()) return "";
  const paras = String(text).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (!paras.length) return "";
  const inner = paras
    .map((p) => `<p>${escapeHtmlPrint(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div class="preset-override">${inner}</div>`;
}

// Espande tabelle markdown scritte su singola riga (le AI a volte le
// generano così) inserendo le newline mancanti tra le righe della tabella.
// Pattern: cerca sequenze " | |  " che separano righe consecutive.
function expandInlineMarkdownTables(src) {
  if (!src) return src;
  let s = String(src);
  // Newline prima del separator "|---|---|..." se preceduto da spazio (es. "...| |---|---|")
  s = s.replace(/\s\|(?=(?:\s*[-:]+\s*\|)+)/g, "\n|");
  // Newline tra fine riga "|" e nuovo inizio "|" su stessa linea: "...| |..."
  s = s.replace(/\|\s+\|/g, "|\n|");
  // Newline dopo il separator: "|---|---| |..." (caso comune di un'unica linea)
  s = s.replace(/(\|\s*[-:]+\s*(?:\|\s*[-:]+\s*)+\|)\s+(?=\|)/g, "$1\n");
  return s;
}

// Markdown → HTML semplice (h2..h4, b, ul/li, p, table).
// Per testo che non contiene già tag HTML. Escape applicato all'input prima del parsing.
// Supporta:
// - heading: #, ##, ###, ####
// - liste indentate: "    - voce"
// - tabelle pipe: "| col | col |" + separator "|---|---|"
function markdownToHtml(src) {
  if (!src) return "";
  const preprocessed = expandInlineMarkdownTables(String(src));
  const escaped = escapeHtmlPrint(preprocessed);
  const lines = escaped.split(/\r?\n/);
  const out = [];
  let paraBuf = [];
  let listBuf = [];
  let tableBuf = null;
  const flushPara = () => {
    if (!paraBuf.length) return;
    let txt = paraBuf.join(" ").trim();
    txt = txt.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    if (txt) out.push(`<p>${txt}</p>`);
    paraBuf = [];
  };
  const flushList = () => {
    if (!listBuf.length) return;
    const items = listBuf
      .map((li) => li.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>"))
      .map((li) => `<li>${li}</li>`)
      .join("");
    out.push(`<ul>${items}</ul>`);
    listBuf = [];
  };
  const flushTable = () => {
    if (!tableBuf) return;
    const renderCell = (c) => c.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    const thead = tableBuf.headers
      ? `<thead><tr>${tableBuf.headers.map((h) => `<th>${renderCell(h)}</th>`).join("")}</tr></thead>`
      : "";
    const tbody = `<tbody>${tableBuf.rows.map((r) => `<tr>${r.map((c) => `<td>${renderCell(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    out.push(`<table>${thead}${tbody}</table>`);
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
    const line = lines[i].replace(/\s+$/g, "");
    const trimmed = line.trim();
    // Inizio tabella: riga "|...|" + riga successiva separator
    if (!tableBuf && parseRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      flushList();
      flushPara();
      tableBuf = { headers: parseRow(line), rows: [] };
      i += 1;
      continue;
    }
    if (tableBuf) {
      const row = parseRow(line);
      if (row) { tableBuf.rows.push(row); continue; }
      flushTable();
    }
    if (!trimmed) {
      flushList();
      flushPara();
      continue;
    }
    const h1m = line.match(/^#\s+(.*)$/);
    const h2m = line.match(/^##\s+(.*)$/);
    const h3m = line.match(/^###\s+(.*)$/);
    const h4m = line.match(/^####\s+(.*)$/);
    const lim = line.match(/^\s*[-*]\s+(.*)$/);
    if (h4m) { flushList(); flushPara(); out.push(`<h4>${h4m[1].replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")}</h4>`); continue; }
    if (h3m) { flushList(); flushPara(); out.push(`<h3>${h3m[1].replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")}</h3>`); continue; }
    if (h2m) { flushList(); flushPara(); out.push(`<h2>${h2m[1].replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")}</h2>`); continue; }
    if (h1m) { flushList(); flushPara(); out.push(`<h2>${h1m[1].replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")}</h2>`); continue; }
    if (lim) { flushPara(); listBuf.push(lim[1]); continue; }
    flushList();
    paraBuf.push(line);
  }
  flushTable();
  flushList();
  flushPara();
  return out.join("\n");
}

function renderCustomContent(content) {
  if (!content) return "";
  const t = String(content);
  if (/<[a-z][\s\S]*>/i.test(t)) return t;
  return markdownToHtml(t);
}

function formatCustomBodyForPrint(htmlOrText) {
  if (!htmlOrText) return "";
  const t = String(htmlOrText);
  if (/<[a-z][\s\S]*>/i.test(t)) return t;
  return markdownToHtml(t);
}

const isMain = (n) => typeof n === "string" && (/^\d+$/.test(n) || n.startsWith("All."));

// Filtra i sub di un preset rimuovendo quelli eliminati, quelli senza body, e
// rinumerando contigualmente i rimanenti (X.1, X.2, ...).
function renderPresetSubs(items, p, deletedSet, subOrder, origChapter = null) {
  const visible = items.filter((s) => s.body != null && s.body !== false && s.body !== "");
  let ordered = visible;
  if (Array.isArray(subOrder) && subOrder.length && origChapter != null) {
    // subOrder è array di "X.Y" originali. Estraggo l'idx (Y) e riordino visible per origIdx.
    const wantedIdx = subOrder
      .map((n) => {
        const m = String(n).match(/^\d+\.(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((v) => v != null);
    const byIdx = new Map(visible.map((s) => [s.origIdx, s]));
    const reord = [];
    const seen = new Set();
    for (const idx of wantedIdx) {
      const s = byIdx.get(idx);
      if (s && !seen.has(idx)) { reord.push(s); seen.add(idx); }
    }
    for (const s of visible) {
      if (!seen.has(s.origIdx)) reord.push(s);
    }
    ordered = reord;
  }
  let counter = 0;
  return ordered.map((s) => {
    const origN = `${origChapter ?? p}.${s.origIdx}`;
    if (deletedSet && deletedSet.has(origN)) return null;
    counter += 1;
    const n = `${p}.${counter}`;
    return <Dsub key={origN} n={n} t={s.t}>{s.body}</Dsub>;
  }).filter(Boolean);
}

/** Anteprima: blocchi preset (ordine gestito dal container). */
function PresetPs1({ data, displayChapter = 1, customSubs = null, deletedItems = [], subOrder = null }) {
  if (!data.s1) return null;
  const p = String(displayChapter);
  const deletedSet = new Set(deletedItems);
  const statoMagBody = data.s1.statoMaggiore ? (
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12.5px" }}>
      <tbody>
        {data.s1.statoMaggiore.split("\n").map((s)=>s.trim()).filter(Boolean).map((s, i)=>{
          const sep = s.indexOf(":");
          const org = sep > -1 ? s.slice(0, sep).trim() : s;
          const nom = sep > -1 ? s.slice(sep + 1).trim() : "";
          return (
            <tr key={i}>
              <td style={{padding:"3px 24px 3px 0", width:"44%", ...SANS, fontWeight:"700", color:TX, verticalAlign:"top", whiteSpace:"nowrap"}}>{org}{sep > -1 ? ":" : ""}</td>
              <td style={{padding:"3px 0", ...SANS, color:TX, verticalAlign:"top"}}>{nom}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : null;
  const subs = [
    { origIdx: 1, t: "Servizio di sicurezza", body: data.s1.sicurezza },
    { origIdx: 2, t: "Polizia", body: data.s1.polizia },
    { origIdx: 3, t: "Sanitari", body: data.s1.sanitari },
    { origIdx: 4, t: "REGA", body: data.s1.rega },
    { origIdx: 5, t: "Pompieri", body: data.s1.pompieri },
    { origIdx: 6, t: "Stato Maggiore", body: statoMagBody },
  ];
  return (
    <Dsec id="ps1" n={p} t="Responsabilità">
      <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:"22px", fontSize:"11.5px", border:`1px solid ${GB}` }}>
        <thead>
          <tr>
            {["Aree","Società / Persona","Tel. Azienda / E-Mail","Tel. Mobile"].map((h)=>(
              <th key={h} style={{background:N,color:WH,padding:"8px 10px",textAlign:"left",...SANS,border:`1px solid ${NM}`}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.s1.contatti || []).map((c, i)=>(
            <tr key={i} style={{background:i%2===0?WH:"#f9fbfd"}}>
              <td style={{padding:"8px 10px",fontWeight:"700",color:N,...SANS,border:`1px solid ${GB}`}}>{c.area}</td>
              <td style={{padding:"8px 10px",...SANS,border:`1px solid ${GB}`}}>{c.societa}</td>
              <td style={{padding:"8px 10px",...SANS,color:"#1565c0",border:`1px solid ${GB}`}}>{c.email || c.telAzienda}</td>
              <td style={{padding:"8px 10px",...SANS,border:`1px solid ${GB}`}}>{c.telMobile}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {renderPresetSubs(subs, p, deletedSet, subOrder, 1)}
      {data.s1.puntoRitrovo && (
        <div style={{background:GL,border:`1px solid ${GB}`,borderRadius:"6px",padding:"10px 16px",fontWeight:"700",fontSize:"12.5px",...SANS,color:N,textAlign:"center",textTransform:"uppercase",letterSpacing:"0.07em"}}>
          PUNTO DI RITROVO: {data.s1.puntoRitrovo}
        </div>
      )}
      {customSubs}
    </Dsec>
  );
}

function PresetPs2({ data, displayChapter = 2, customSubs = null, deletedItems = [], subOrder = null }) {
  if (!data.s2) return null;
  const p = String(displayChapter);
  const deletedSet = new Set(deletedItems);
  const locationBody = data.s2.location ? (
    <>
      {data.s2.location}
      <div style={{ ...SANS, fontSize:"12px", fontStyle:"italic", color:TM, marginTop:"8px", padding:"6px 10px", background:GL, borderRadius:"4px", border:`1px solid ${GB}` }}>
        📎 La planimetria della location con il dispositivo degli agenti è riportata nell'<strong>Allegato 2</strong>.
      </div>
    </>
  ) : null;
  const subs = [
    { origIdx: 1, t: "Periodo e orari d'apertura", body: data.s2.orari },
    { origIdx: 2, t: "Location", body: locationBody },
    { origIdx: 3, t: "Pattuglia esterna", body: data.s2.pattuglia },
    { origIdx: 4, t: "Tipologia e numero dei visitatori", body: data.s2.visitatori },
    { origIdx: 5, t: "Gestione dei minori", body: data.s2.minori },
  ];
  return (
    <Dsec id="ps2" n={p} t="Descrizione">
      {data.s2.descrizione && <p style={{ ...SANS, fontSize:"12.5px", lineHeight:1.75, marginBottom:"16px", margin:"0 0 16px" }}>{data.s2.descrizione}</p>}
      {data.s2.programma && data.s2.programma.length > 0 && (
        <div style={{ ...SANS, fontSize:"12.5px", lineHeight:2.1, marginBottom:"16px" }}>
          {data.s2.programma.map((row, i) => <div key={i}><strong>{row.giorno}</strong>{row.giorno && row.attivita ? " — " : ""}{row.attivita}</div>)}
        </div>
      )}
      {renderPresetSubs(subs, p, deletedSet, subOrder, 2)}
      {customSubs}
    </Dsec>
  );
}

function PresetPs3({ data, displayChapter = 3, customSubs = null, deletedItems = [], subOrder = null }) {
  if (!data.s3) return null;
  const p = String(displayChapter);
  const deletedSet = new Set(deletedItems);
  const subs = [
    {
      origIdx: 1,
      t: "Analisi del rischio",
      body: (
        <>
          <RiskTbl title="Lista Pericoli Passivi" rows={data.s3.passivi} />
          <RiskTbl title="Lista Pericoli Attivi" rows={data.s3.attivi} />
        </>
      ),
    },
    { origIdx: 2, t: "Meteo", body: data.s3.meteo },
    { origIdx: 3, t: "Atto terroristico / attentato", body: data.s3.terrorismo },
    { origIdx: 4, t: "Evacuazione", body: data.s3.evacuazione },
  ];
  return (
    <Dsec id="ps3" n={p} t="Analisi dei pericoli">
      <p style={{ ...SANS, fontSize:"12.5px", lineHeight:1.75, margin:"0 0 16px" }}>Ad ogni evento vi sono fattori di rischio che potrebbero pregiudicare il buon esito dello stesso. Una valutazione attenta di questi fattori può influire sia sulla buona riuscita che sulle misure da adottare in caso di necessità.</p>
      {renderPresetSubs(subs, p, deletedSet, subOrder, 3)}
      {customSubs}
    </Dsec>
  );
}

function PresetPs4({ data, displayChapter = 4, customSubs = null, deletedItems = [], subOrder = null }) {
  if (!data.s4) return null;
  const p = String(displayChapter);
  const deletedSet = new Set(deletedItems);
  const subs = [
    { origIdx: 1, t: "Modifiche", body: data.s4.modifiche },
    { origIdx: 2, t: "Comunicazioni", body: data.s4.comunicazioni },
    { origIdx: 3, t: "Divisa", body: "Secondo regolamento DELTAgroup." },
    { origIdx: 4, t: "Posto Comando", body: data.s4.postoComando },
    { origIdx: 5, t: "Diversi", body: data.s4.diversi },
  ];
  return (
    <Dsec id="ps4" n={p} t="Dispositivo di sicurezza">
      <p style={{ ...SANS, fontSize:"12.5px", margin:"0 0 12px" }}>La DELTAgroup Security &amp; Services AG mette a disposizione il seguente dispositivo di sicurezza. La planimetria con le posizioni degli agenti è riportata nell'<strong>Allegato 2</strong>.</p>
      <div style={{ marginBottom:"20px", border:`1px solid ${GB}`, borderRadius:"6px", overflow:"hidden" }}>
        {(data.s4.righe || []).map((r, i)=>(
          <div key={i} style={{ display:"flex", gap:"20px", padding:"8px 14px", background:i % 2 === 0 ? "#f9fbfd" : WH, fontSize:"12.5px", ...SANS, borderBottom:i < (data.s4.righe || []).length - 1 ? `1px solid ${GL}` : "none" }}>
            <span style={{ fontWeight:"700", color:N, minWidth:"110px" }}>➤&nbsp;{r.data}</span>
            <span>{r.agenti}</span>
            <span style={{ color:TM }}>{r.orario}</span>
          </div>
        ))}
      </div>
      {renderPresetSubs(subs, p, deletedSet, subOrder, 4)}
      {customSubs}
    </Dsec>
  );
}

function PresetPs5({ data, displayChapter = 5, customSubs = null, deletedItems = [], subOrder = null }) {
  if (!data.s5) return null;
  const p = String(displayChapter);
  const deletedSet = new Set(deletedItems);
  const subs = [
    { origIdx: 1, t: "Incendio", body: data.s5.incendio },
    { origIdx: 2, t: "Intossicazione", body: data.s5.intossicazione },
    { origIdx: 3, t: "Problemi d'ordine", body: data.s5.ordine },
    { origIdx: 4, t: "Ferimenti / Malori", body: data.s5.ferimenti },
    { origIdx: 5, t: "Sostanze stupefacenti", body: data.s5.droghe },
  ];
  return (
    <Dsec id="ps5" n={p} t="Scenari">
      {renderPresetSubs(subs, p, deletedSet, subOrder, 5)}
      {customSubs}
    </Dsec>
  );
}

function PresetPs6({ data, displayChapter = 6, customSubs = null, deletedItems = [], subOrder = null }) {
  if (!data.s6) return null;
  const p = String(displayChapter);
  const deletedSet = new Set(deletedItems);
  const orderedList = (k) =>
    data.s6[k] && data.s6[k].length > 0 ? (
      <ol style={{ margin:0, paddingLeft:"18px" }}>
        {data.s6[k].map((s, i) => (
          <li key={i} style={{ marginBottom:"3px" }}>
            {String(s).replace(/^\s*\d+[\.\)]\s+/, "")}
          </li>
        ))}
      </ol>
    ) : null;
  const subs = [
    { origIdx: 1, t: "Stato Maggiore di Crisi", body: data.s6.smc },
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
  return (
    <Dsec id="ps6a" n={p} t="Casi d'Allarme">
      {renderPresetSubs(subs, p, deletedSet, subOrder, 6)}
      {customSubs}
    </Dsec>
  );
}

function PresetAll1({ data, displayAllegato = 1 }) {
  const uploaded = Array.isArray(data?.allegato1Files) ? data.allegato1Files : [];
  return (
    <div id="pall1" style={{ marginTop:"0", paddingTop:"28px", borderTop:"none", pageBreakBefore:"always", breakBefore:"page" }}>
      <div style={{ background:N, color:WH, padding:"9px 16px", fontSize:"13px", fontWeight:"700", ...SANS, borderRadius:"6px", marginBottom:"22px", textAlign:"center", textTransform:"uppercase", letterSpacing:"0.08em" }}>
        Allegato {displayAllegato} – Formulario Annunci d'Emergenza
      </div>
      {uploaded.length > 0 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          {uploaded.map((f, i)=>{
            const isImg = f.type?.startsWith("image/");
            const isPdf = f.type === "application/pdf";
            const src = f.url;
            return (
              <div key={f.id || i} style={{ marginBottom:"12px" }}>
                <div style={{ ...SANS, fontSize:"11px", color:GR, marginBottom:"6px", fontWeight:"600" }}>📎 {f.name}</div>
                {isImg && <img src={src} alt={f.name} style={{ width:"100%", border:`1px solid ${GB}`, borderRadius:"6px", display:"block" }} />}
                {isPdf && (
                  <iframe src={src} style={{ width:"100%", height:"600px", border:`1px solid ${GB}`, borderRadius:"6px" }} title={f.name} />
                )}
                {!isImg && !isPdf && (
                  <div style={{ background:"#f0f4f9", border:`1px solid ${GB}`, borderRadius:"6px", padding:"16px", display:"flex", alignItems:"center", gap:"10px", ...SANS, fontSize:"12px", color:TX }}>
                    <span style={{ fontSize:"28px" }}>📊</span>
                    <div style={{ fontWeight:"600" }}>{f.name}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ border:`2px dashed ${GB}`, borderRadius:"8px", padding:"40px", textAlign:"center", color:GR, ...SANS, fontSize:"12.5px" }}>
          <div style={{ fontSize:"36px", marginBottom:"10px" }}>📢</div>
          <div style={{ fontWeight:"600", color:TM, marginBottom:"4px" }}>Formulario annunci d'emergenza</div>
          <div style={{ fontSize:"11px" }}>Carica l'immagine o il PDF del formulario dal pannello di modifica a sinistra → sezione Allegato 1</div>
        </div>
      )}
    </div>
  );
}

function PresetAll2({ data, displayAllegato = 2 }) {
  return (
    <div id="pall2" style={{ marginTop:"0", paddingTop:"28px", borderTop:"none", pageBreakBefore:"always", breakBefore:"page" }}>
      <div style={{ background:N, color:WH, padding:"9px 16px", fontSize:"13px", fontWeight:"700", ...SANS, borderRadius:"6px", marginBottom:"22px", textAlign:"center", textTransform:"uppercase", letterSpacing:"0.08em" }}>
        Allegato {displayAllegato} – Planimetria Dispositivo Agenti
      </div>
      {(data.allegato2Files && data.allegato2Files.length > 0) ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          {data.allegato2Files.map((f, i)=>{
            const isImg = f.type.startsWith("image/");
            const isPdf = f.type === "application/pdf";
            const src = f.url;
            return (
              <div key={f.id || i} style={{ marginBottom:"12px" }}>
                <div style={{ ...SANS, fontSize:"11px", color:GR, marginBottom:"6px", fontWeight:"600" }}>📎 {f.name}</div>
                {isImg && <img src={src} alt={f.name} style={{ width:"100%", border:`1px solid ${GB}`, borderRadius:"6px", display:"block" }} />}
                {isPdf && (
                  <div style={{ border:`2px solid ${GB}`, borderRadius:"8px", overflow:"hidden" }}>
                    <div style={{ background:"#f5f7fb", padding:"16px 20px", display:"flex", alignItems:"center", gap:"14px" }}>
                      <span style={{ fontSize:"36px" }}>📄</span>
                      <div style={{ flex:1 }}>
                        <div style={{ ...SANS, fontWeight:"700", fontSize:"13px", color:N }}>{f.name}</div>
                        <div style={{ ...SANS, fontSize:"11px", color:GR, marginTop:"2px" }}>Documento PDF allegato</div>
                      </div>
                      <a href={src} target="_blank" rel="noreferrer"
                        style={{ ...SANS, fontSize:"12px", fontWeight:"600", color:WH, background:N, padding:"7px 14px", borderRadius:"6px", textDecoration:"none" }}>
                        Apri PDF ↗
                      </a>
                    </div>
                    <iframe src={src} style={{ width:"100%", height:"500px", border:"none", display:"block" }} title={f.name} />
                  </div>
                )}
                {!isImg && !isPdf && (
                  <div style={{ background:"#f0f4f9", border:`1px solid ${GB}`, borderRadius:"6px", padding:"16px", display:"flex", alignItems:"center", gap:"10px", ...SANS, fontSize:"12px", color:TX }}>
                    <span style={{ fontSize:"28px" }}>📊</span>
                    <div style={{ fontWeight:"600" }}>{f.name}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ border:`2px dashed ${GB}`, borderRadius:"8px", padding:"40px", textAlign:"center", color:GR, ...SANS, fontSize:"12.5px" }}>
          <div style={{ fontSize:"36px", marginBottom:"10px" }}>🗺️</div>
          <div style={{ fontWeight:"600", color:TM, marginBottom:"4px" }}>Planimetria da allegare</div>
          <div style={{ fontSize:"11px" }}>Carica la piantina dal pannello di modifica a sinistra → sezione Allegato 2</div>
        </div>
      )}
    </div>
  );
}

function CustomCapitoloPreview({ section, displayNum, customSubs = null }) {
  const id = `pcap-${section.id}`;
  const html = renderCustomContent(section.content);
  const inner = (
    <div style={{ fontSize:"12.5px", lineHeight:1.75, color:TX, ...SANS }} dangerouslySetInnerHTML={{ __html: html }} />
  );
  return (
    <Dsec id={id} n={String(displayNum)} t={section.title || "Senza titolo"}>
      {inner}
      {customSubs}
    </Dsec>
  );
}

function CustomSottoCapitoloPreview({ section, displayLabel }) {
  const id = `psub-${section.id}`;
  const html = renderCustomContent(section.content);
  const inner = (
    <div style={{ fontSize:"12.5px", lineHeight:1.75, color:TX, ...SANS }} dangerouslySetInnerHTML={{ __html: html }} />
  );
  return (
    <div id={id} style={{ marginBottom:"22px" }}>
      <h3 style={{
        fontWeight:"700", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.07em",
        textDecoration:"underline", color:N, marginBottom:"7px", ...SANS, marginTop:0,
        breakAfter:"avoid", pageBreakAfter:"avoid",
      }}>
        {displayLabel}&nbsp;&nbsp;{section.title || "Senza titolo"}
      </h3>
      <div style={{ fontSize:"12.5px", lineHeight:1.75, color:TX, ...SANS }}>{inner}</div>
    </div>
  );
}

function CustomAllegatoPreview({ section, displayAllegatoNum }) {
  const pid = `pallc-${section.id}`;
  const src = section.imageUrl;
  const isPdf = section.fileMime === "application/pdf";
  const rawHtml = renderCustomContent(section.content);
  const renderContent = (extraStyle = {}) =>
    rawHtml ? (
      <div
        style={{ ...SANS, fontSize:"12.5px", lineHeight:1.75, color:TX, ...extraStyle }}
        dangerouslySetInnerHTML={{ __html: rawHtml }}
      />
    ) : null;
  const hasContent = !!(section.content && String(section.content).trim());
  return (
    <div id={pid} style={{ marginTop:"0", paddingTop:"28px", borderTop:"none", pageBreakBefore:"always", breakBefore:"page" }}>
      <div style={{ background:N, color:WH, padding:"9px 16px", fontSize:"13px", fontWeight:"700", ...SANS, borderRadius:"6px", marginBottom:"22px", textAlign:"center", textTransform:"uppercase", letterSpacing:"0.08em", breakInside:"avoid", pageBreakInside:"avoid", breakAfter:"avoid", pageBreakAfter:"avoid" }}>
        Allegato {displayAllegatoNum} – {section.title || "Allegato"}
      </div>
      {src ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {isPdf ? (
            <iframe src={src} style={{ width:"100%", height:"500px", border:`1px solid ${GB}`, borderRadius:"6px", breakInside:"avoid", pageBreakInside:"avoid" }} title={section.title || "PDF"} />
          ) : (
            <img src={src} alt={section.title || ""} style={{ width:"100%", border:`1px solid ${GB}`, borderRadius:"6px", display:"block", breakInside:"avoid", pageBreakInside:"avoid" }} />
          )}
          {renderContent()}
        </div>
      ) : (
        <div style={{ border:`1px solid ${GB}`, borderRadius:"8px", padding:"16px 20px", ...SANS, fontSize:"12.5px", lineHeight:1.75, color:TX }}>
          {hasContent ? renderContent() : (
            <div style={{ border:`2px dashed ${GB}`, borderRadius:"8px", padding:"24px", textAlign:"center", color:GR, fontSize:"12.5px" }}>
              Nessun file allegato — usa il testo sopra o aggiungi un file dalla modifica sezione.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocPreview({ data, customSections = [], sectionOrder, presetOverrides = {}, presetDeletedItems = {}, presetSubOrder = {} }) {
  if (!data || !data.nomeEvento) return null;
  const order = sectionOrder?.length ? sectionOrder : DEFAULT_SECTION_ORDER;
  const tocRows = React.useMemo(
    () => buildTocRows(sectionOrder, customSections, presetDeletedItems, presetSubOrder),
    [sectionOrder, customSections, presetOverrides, presetDeletedItems, presetSubOrder],
  );
  const { chapterNumByKey, allegatoNumByKey, subchapterDisplayByKey } = React.useMemo(
    () => buildSectionNumberMaps(order, customSections, presetDeletedItems),
    [order, customSections, presetDeletedItems],
  );
  const pageMapByOrderKey = React.useMemo(
    () => buildPageMapByOrderKey(order, customSections),
    [order, customSections],
  );

  return (
    <div id="doc-preview" style={{background:WH,borderRadius:"10px",border:`1px solid ${GB}`,padding:"0 0 0"}}>

      <div className="doc-page-header" style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"4px 32px",borderBottom:"2px solid #0c1d3d",background:"white"}}>
        <img src={logoImg} alt="DELTAgroup" style={{height:65,display:"block"}}/>
      </div>

      <div id="pc" style={{textAlign:"center",borderBottom:`3px solid ${AC}`,paddingBottom:"32px",marginBottom:"0",padding:"36px 48px 32px"}}>
        {data.logoEvento && (
          <div style={{marginBottom:"20px"}}>
            <img src={data.logoEvento} alt="logo evento" style={{maxHeight:"90px",maxWidth:"220px",objectFit:"contain"}}/>
          </div>
        )}
        <div style={{...SANS,fontSize:"13px",fontWeight:"700",color:N,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"12px"}}>
          Concetto di sicurezza
        </div>
        <div style={{...SERIF,fontSize:"26px",fontWeight:"700",color:N}}>{data.nomeEvento}</div>
        {data.luogo&&<div style={{...SANS,fontSize:"14px",color:TM,marginTop:"8px"}}>{data.luogo}</div>}
        {data.anno&&<div style={{...SANS,fontSize:"12px",color:TM}}>Edizione {data.anno}</div>}
      </div>

      <div id="ptoc" style={{padding:"36px 48px",borderBottom:`1px solid ${GB}`}}>
        <div style={{...SANS,fontSize:"13px",fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.1em",color:N,marginBottom:"16px",borderBottom:`2px solid ${N}`,paddingBottom:"6px"}}>Indice</div>
        {tocRows
          .filter((e) => e != null && e.n != null && e.t != null)
          .map((e,i)=>{
            const pageNum = e.ownerKey ? pageMapByOrderKey.get(e.ownerKey) : null;
            return (
          <div key={i} style={{display:"flex",alignItems:"baseline",gap:"4px",marginBottom:isMain(e.n)?"6px":"2px",paddingLeft:isMain(e.n)?"0":"24px"}}>
            <span style={{...SANS,fontSize:isMain(e.n)?"12px":"11px",fontWeight:isMain(e.n)?"700":"400",color:isMain(e.n)?N:TX}}>{e.n} {e.t}</span>
            <span style={{flex:1,borderBottom:"1px dotted #ccc",height:"1px",marginBottom:"3px"}}/>
            <span style={{...SANS,fontSize:isMain(e.n)?"12px":"11px",fontWeight:isMain(e.n)?"700":"400",color:isMain(e.n)?N:TX,minWidth:"30px",textAlign:"right"}}>{pageNum ?? ""}</span>
          </div>
            );
          })}
      </div>

      <div id="pbody" style={{padding:"36px 48px"}}>
        {(() => {
          const subsByParent = new Map();
          for (const key of order) {
            if (typeof key !== "string" || !key.startsWith("custom:")) continue;
            const id = parseCustomSectionKey(key);
            const s = customSections.find((c) => c.id === id);
            if (!s || s.type !== "sottocapitolo") continue;
            const pk = s.parentKey;
            if (!pk) continue;
            const arr = subsByParent.get(pk) || [];
            arr.push({ key, section: s });
            subsByParent.set(pk, arr);
          }
          const renderSubs = (parentKey) => {
            const list = subsByParent.get(parentKey);
            if (!list || !list.length) return null;
            return list.map(({ key, section }) => {
              const lab = subchapterDisplayByKey.get(key) ?? "?";
              return <CustomSottoCapitoloPreview key={key} section={section} displayLabel={lab} />;
            });
          };
          return order.map((key) => {
            if (key === "ps1") return <PresetPs1 key={key} data={data} displayChapter={chapterNumByKey.get(key) ?? 1} customSubs={renderSubs("ps1")} deletedItems={presetDeletedItems.ps1 || []} subOrder={presetSubOrder.ps1} />;
            if (key === "ps2") return <PresetPs2 key={key} data={data} displayChapter={chapterNumByKey.get(key) ?? 2} customSubs={renderSubs("ps2")} deletedItems={presetDeletedItems.ps2 || []} subOrder={presetSubOrder.ps2} />;
            if (key === "ps3") return <PresetPs3 key={key} data={data} displayChapter={chapterNumByKey.get(key) ?? 3} customSubs={renderSubs("ps3")} deletedItems={presetDeletedItems.ps3 || []} subOrder={presetSubOrder.ps3} />;
            if (key === "ps4") return <PresetPs4 key={key} data={data} displayChapter={chapterNumByKey.get(key) ?? 4} customSubs={renderSubs("ps4")} deletedItems={presetDeletedItems.ps4 || []} subOrder={presetSubOrder.ps4} />;
            if (key === "ps5") return <PresetPs5 key={key} data={data} displayChapter={chapterNumByKey.get(key) ?? 5} customSubs={renderSubs("ps5")} deletedItems={presetDeletedItems.ps5 || []} subOrder={presetSubOrder.ps5} />;
            if (key === "ps6") return <React.Fragment key={key}><PresetPs6 data={data} displayChapter={chapterNumByKey.get(key) ?? 6} customSubs={renderSubs("ps6")} deletedItems={presetDeletedItems.ps6 || []} subOrder={presetSubOrder.ps6} /></React.Fragment>;
            if (key === "all1") return <PresetAll1 key={key} data={data} displayAllegato={allegatoNumByKey.get(key) ?? 1} />;
            if (key === "all2") return <PresetAll2 key={key} data={data} displayAllegato={allegatoNumByKey.get(key) ?? 2} />;
            if (key.startsWith("custom:")) {
              const id = parseCustomSectionKey(key);
              const s = customSections.find((c) => c.id === id);
              if (!s) return null;
              if (s.type === "capitolo") {
                const num = chapterNumByKey.get(key) ?? 1;
                return <CustomCapitoloPreview key={key} section={s} displayNum={num} customSubs={renderSubs(`custom:${id}`)} />;
              }
              if (s.type === "sottocapitolo") {
                // renderizzato dentro il Dsec del capitolo padre
                return null;
              }
              const an = allegatoNumByKey.get(key) ?? 1;
              return <CustomAllegatoPreview key={key} section={s} displayAllegatoNum={an} />;
            }
            return null;
          });
        })()}
      </div>

      <div className="doc-page-footer" style={{borderTop:`1px solid ${GB}`}}>
        <div style={{display:"flex",justifyContent:"center",padding:"5px 32px",borderTop:"1px solid #0c1d3d",fontSize:"8pt",color:"#555",fontFamily:"Arial",background:"white"}}>
          DELTAgroup Security &amp; Services AG &middot; Filiale Ticino &middot; Via alla Foce 4, 6933 Muzzano &middot; T +41 91 921 49 49 &middot; ticino@delta.ch &middot; www.delta.ch
        </div>
      </div>
    </div>
  );
}

const LS_EDITOR_SECTIONS = "delta-cs-editor-sections";

/** Normalize persisted custom rows (migration-safe). */
function normalizeCustomSection(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id != null ? String(raw.id) : "";
  if (!id) return null;
  let type = raw.type;
  if (type !== "capitolo" && type !== "allegato" && type !== "sottocapitolo") type = "capitolo";
  const pk = raw.parentKey != null ? String(raw.parentKey) : "";
  const parentKey =
    type === "sottocapitolo" && (/^ps[1-6]$/.test(pk) || /^custom:.+/.test(pk))
      ? pk
      : null;
  return {
    id,
    type,
    title: raw.title ?? "",
    content: raw.content ?? "",
    imageUrl: raw.imageUrl ?? null,
    fileMime: raw.fileMime ?? null,
    order: typeof raw.order === "number" ? raw.order : 0,
    parentKey,
  };
}

function loadPersistedSections(docName) {
  const empty = { customSections: [], sectionOrder: [...DEFAULT_SECTION_ORDER], presetOverrides: {}, presetDeletedItems: {}, presetSubOrder: {} };
  try {
    const raw = localStorage.getItem(LS_EDITOR_SECTIONS);
    if (!raw) return empty;
    const p = JSON.parse(raw);
    if (p.docKey != null && p.docKey !== (docName || "")) return empty;
    const cs = Array.isArray(p.customSections)
      ? p.customSections.map(normalizeCustomSection).filter(Boolean)
      : [];
    const rawOrder = Array.isArray(p.sectionOrder) && p.sectionOrder.length ? p.sectionOrder : [...DEFAULT_SECTION_ORDER];
    return {
      customSections: cs,
      sectionOrder: normalizeSectionOrder(rawOrder, cs),
      presetOverrides: (p.presetOverrides && typeof p.presetOverrides === "object") ? p.presetOverrides : {},
      presetDeletedItems: (p.presetDeletedItems && typeof p.presetDeletedItems === "object") ? p.presetDeletedItems : {},
      presetSubOrder: (p.presetSubOrder && typeof p.presetSubOrder === "object") ? p.presetSubOrder : {},
    };
  } catch (e) {
    console.error("[loadPersistedSections]", e);
    return empty;
  }
}

function newSectionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Storico CS: mapping riga Supabase (cs_documenti) ↔ stato Editor ──────────
// Il documento CS completo è salvato in contenuto.data (con s1..s6, eventSettings,
// allegati…); sezioni/ordine/override sono in contenuto.
function buildLoadedDataFromRow(row) {
  const c = (row && row.contenuto) || {};
  if (c.data && typeof c.data === "object") return c.data;
  // Fallback minimale (documenti salvati senza data completo)
  return {
    nomeEvento: row?.nome_evento || "",
    luogo: row?.luogo || "",
    anno: row?.anno || "",
    eventSettings: row?.evento || null,
    allegato1Files: [],
    allegato2Files: [],
  };
}

function buildLoadedContentFromRow(row) {
  const c = (row && row.contenuto) || {};
  const cs = Array.isArray(c.customSections) ? c.customSections.map(normalizeCustomSection).filter(Boolean) : [];
  const rawOrder = Array.isArray(c.sectionOrder) && c.sectionOrder.length ? c.sectionOrder : [...DEFAULT_SECTION_ORDER];
  return {
    customSections: cs,
    sectionOrder: normalizeSectionOrder(rawOrder, cs),
    presetOverrides: (c.presetOverrides && typeof c.presetOverrides === "object") ? c.presetOverrides : {},
    presetDeletedItems: (c.presetDeletedItems && typeof c.presetDeletedItems === "object") ? c.presetDeletedItems : {},
    presetSubOrder: (c.presetSubOrder && typeof c.presetSubOrder === "object") ? c.presetSubOrder : {},
  };
}

// Loader del documento CS da Supabase (view "cs-load"). Top-level.
function CsLoader({ id, onLoaded, onBack }) {
  const [err, setErr] = useState(null);
  React.useEffect(() => {
    let active = true;
    if (!id) { setErr("Documento non valido."); return; }
    (async () => {
      const { data, error } = await supabase.from("cs_documenti").select("*").eq("id", id).single();
      if (!active) return;
      if (error) { setErr(`Errore nel caricamento del documento: ${error.message}`); return; }
      onLoaded(data);
    })();
    return () => { active = false; };
  }, [id]);

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", background: BG, padding: "40px" }}>
      <div style={{ textAlign: "center", ...SANS }}>
        {err ? (
          <>
            <div style={{ color: RD, fontSize: "14px", marginBottom: "14px" }}>{err}</div>
            <button onClick={onBack} style={{ ...SANS, padding: "9px 18px", border: `1px solid ${GB}`, borderRadius: "8px", background: WH, color: N, cursor: "pointer", fontWeight: 700 }}>← Torna all'archivio</button>
          </>
        ) : (
          <div style={{ color: TM, fontSize: "15px" }}>Caricamento documento…</div>
        )}
      </div>
    </div>
  );
}

const PRESET_SECTION_SHORT = {
  ps1: "Responsabilità",
  ps2: "Descrizione",
  ps3: "Analisi dei pericoli",
  ps4: "Dispositivo di sicurezza",
  ps5: "Scenari",
  ps6: "Casi d'allarme",
};

const ALL12_SHORT = {
  all1: "Formulario annunci",
  all2: "Planimetria agenti",
};

function Editor({ data: initialData, onBack, csDocId = null, setCsDocId, loadedContent = null }) {
  const persisted = loadedContent || loadPersistedSections(initialData.nomeEvento);
  const [data, setData] = useState({...initialData, allegato1Files: initialData.allegato1Files||[], allegato2Files: initialData.allegato2Files||[]});
  const [customSections, setCustomSections] = useState(persisted.customSections);
  const [sectionOrder, setSectionOrder] = useState(persisted.sectionOrder);
  const [presetOverrides, setPresetOverrides] = useState(persisted.presetOverrides || {});
  const [presetDeletedItems, setPresetDeletedItems] = useState(persisted.presetDeletedItems || {});
  const [presetSubOrder, setPresetSubOrder] = useState(persisted.presetSubOrder || {});
  const [presetEditOpen, setPresetEditOpen] = useState(false);
  const [presetEditKey, setPresetEditKey] = useState(null);
  const [presetEditDraft, setPresetEditDraft] = useState("");
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [addDrag, setAddDrag] = useState(false);
  const [all2Drag, setAll2Drag] = useState(false);
  const [all1Drag, setAll1Drag] = useState(false);
  const [rightDrag, setRightDrag] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [secModalOpen, setSecModalOpen] = useState(false);
  const [secModalEditingId, setSecModalEditingId] = useState(null);
  const [newSecType, setNewSecType] = useState("capitolo");
  const [newSecTitle, setNewSecTitle] = useState("");
  const [newSecContent, setNewSecContent] = useState("");
  const [newSecParentKey, setNewSecParentKey] = useState("ps1");
  const [newSecAILoading, setNewSecAILoading] = useState(false);
  const [renamingCustomId, setRenamingCustomId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsStep, setSettingsStep] = useState(0);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [csId, setCsId] = useState(csDocId ?? null);
  const [csSaving, setCsSaving] = useState(false);
  const [csSaveMsg, setCsSaveMsg] = useState(null);
  const addRef = React.useRef();
  const all2Ref = React.useRef();
  const all1Ref = React.useRef();
  const secModalFileRef = React.useRef();
  const chatEndRef = React.useRef();
  const rightDragCount = React.useRef(0);

  const ord = sectionOrder?.length ? sectionOrder : DEFAULT_SECTION_ORDER;
  const { chapterNumByKey, allegatoNumByKey, subchapterDisplayByKey } = React.useMemo(
    () => buildSectionNumberMaps(ord, customSections, presetDeletedItems),
    [ord, customSections, presetDeletedItems],
  );

  const parentCapitoloOptions = React.useMemo(() => {
    const opts = [];
    for (const k of ["ps1", "ps2", "ps3", "ps4", "ps5", "ps6"]) {
      const n = chapterNumByKey.get(k);
      const short = PRESET_SECTION_SHORT[k];
      opts.push({ value: k, label: n != null && short ? `${n} · ${short}` : (short || k) });
    }
    for (const s of customSections) {
      if (s.type !== "capitolo") continue;
      const ck = `custom:${s.id}`;
      const n = chapterNumByKey.get(ck);
      opts.push({
        value: ck,
        label: n != null ? `${n} · ${s.title || "Capitolo"}` : (s.title || "Capitolo"),
      });
    }
    return opts;
  }, [chapterNumByKey, customSections]);

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_EDITOR_SECTIONS, JSON.stringify({
        docKey: data.nomeEvento || "",
        customSections,
        sectionOrder,
        presetOverrides,
        presetDeletedItems,
        presetSubOrder,
      }));
    } catch (e) {
      console.error("[persist sections]", e);
    }
  }, [data.nomeEvento, customSections, sectionOrder, presetOverrides, presetDeletedItems, presetSubOrder]);

  // Tiene i sottocapitoli custom sempre subito dopo il loro parent nell'order.
  // Evita che restino "in fondo" quando l'AI o l'utente li aggiungono in posizioni innaturali.
  React.useEffect(() => {
    setSectionOrder((prev) => {
      if (!Array.isArray(prev) || !prev.length) return prev;
      const normalized = normalizeSectionOrder(prev, customSections);
      if (normalized.length === prev.length && normalized.every((k, i) => k === prev[i])) return prev;
      return normalized;
    });
  }, [customSections]);

  const togglePresetItemDeleted = (presetKey, itemN) => {
    setPresetDeletedItems((prev) => {
      const list = Array.isArray(prev[presetKey]) ? prev[presetKey].slice() : [];
      const idx = list.indexOf(itemN);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(itemN);
      return { ...prev, [presetKey]: list };
    });
  };

  // Lista dei punti TOC originali per un preset (per la UI di eliminazione).
  const getPresetItemsForKey = (presetKey) => {
    if (presetKey === "all1") {
      return TOC_ALL1_ENTRY ? [TOC_ALL1_ENTRY] : [];
    }
    if (presetKey === "all2") {
      return TOC_ALL2_ENTRY ? [TOC_ALL2_ENTRY] : [];
    }
    return TOC_PRESET_BLOCKS[presetKey] || [];
  };

  // Ritorna [mainItem, ...subsInCustomOrder]. Solo per ps1..ps6.
  const getPresetItemsOrdered = (presetKey) => {
    if (!/^ps[1-6]$/.test(presetKey)) return getPresetItemsForKey(presetKey);
    const block = TOC_PRESET_BLOCKS[presetKey] || [];
    const main = block.find((r) => /^\d+$/.test(String(r.n).trim()));
    const subs = block.filter((r) => /^\d+\.\d+$/.test(String(r.n).trim()));
    const customOrder = presetSubOrder[presetKey];
    if (Array.isArray(customOrder) && customOrder.length) {
      const byN = new Map(subs.map((s) => [String(s.n), s]));
      const ordered = [];
      const seen = new Set();
      for (const n of customOrder) {
        const s = byN.get(String(n));
        if (s && !seen.has(String(s.n))) { ordered.push(s); seen.add(String(s.n)); }
      }
      for (const s of subs) {
        if (!seen.has(String(s.n))) ordered.push(s);
      }
      return main ? [main, ...ordered] : ordered;
    }
    return main ? [main, ...subs] : subs;
  };

  const movePresetSub = (presetKey, subN, dir) => {
    if (!/^ps[1-6]$/.test(presetKey)) return;
    const block = TOC_PRESET_BLOCKS[presetKey] || [];
    const subs = block.filter((r) => /^\d+\.\d+$/.test(String(r.n).trim())).map((r) => String(r.n));
    setPresetSubOrder((prev) => {
      const current = Array.isArray(prev[presetKey]) && prev[presetKey].length
        ? prev[presetKey].filter((n) => subs.includes(String(n)))
        : [...subs];
      // Aggiungi eventuali sub non presenti
      for (const n of subs) {
        if (!current.includes(n)) current.push(n);
      }
      const idx = current.indexOf(String(subN));
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= current.length) return prev;
      const next = [...current];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...prev, [presetKey]: next };
    });
  };

  const openPresetEdit = (key) => {
    const idMap = { ps1: "ps1", ps2: "ps2", ps3: "ps3", ps4: "ps4", ps5: "ps5", ps6: "ps6", all1: "pall1", all2: "pall2" };
    const domId = idMap[key];
    if (!domId) return;
    let text;
    const existing = presetOverrides[key];
    if (typeof existing === "string" && existing.trim()) {
      text = htmlToPlainText(existing);
    } else {
      const el = document.getElementById("doc-preview");
      const node = el ? el.querySelector(`#${CSS.escape(domId)}`) : null;
      text = node ? htmlToPlainText(node.innerHTML) : "";
    }
    setPresetEditKey(key);
    setPresetEditDraft(text);
    setPresetEditOpen(true);
    setErr(null);
  };

  const savePresetEdit = () => {
    if (!presetEditKey) return;
    const text = presetEditDraft || "";
    const html = plainTextToPresetHtml(text);
    setPresetOverrides((prev) => ({ ...prev, [presetEditKey]: html }));
    setPresetEditOpen(false);
    setPresetEditKey(null);
    setPresetEditDraft("");
  };

  const resetPresetEdit = () => {
    if (!presetEditKey) return;
    setPresetOverrides((prev) => {
      const { [presetEditKey]: _, ...rest } = prev;
      return rest;
    });
    setPresetEditOpen(false);
    setPresetEditKey(null);
    setPresetEditDraft("");
  };

  const labelForKey = (key) => {
    if (/^ps[1-6]$/.test(key)) {
      const n = chapterNumByKey.get(key);
      const short = PRESET_SECTION_SHORT[key];
      return n != null && short ? `${n} · ${short}` : (short || key);
    }
    if (key === "all1" || key === "all2") {
      const n = allegatoNumByKey.get(key);
      const short = ALL12_SHORT[key];
      return n != null && short ? `All. ${n} · ${short}` : key;
    }
    if (key.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = customSections.find((c) => c.id === id);
      if (!s) return key;
      if (s.type === "capitolo") {
        const n = chapterNumByKey.get(key);
        return n != null ? `${n} · ${s.title || "Capitolo"}` : (s.title || "Capitolo");
      }
      if (s.type === "sottocapitolo") {
        const nu = subchapterDisplayByKey.get(key);
        return nu != null ? `${nu} · ${s.title || "Sotto capitolo"}` : (s.title || "Sotto capitolo");
      }
      const na = allegatoNumByKey.get(key);
      return na != null ? `All. ${na} · ${s.title || "Allegato"}` : (s.title || "Allegato");
    }
    return key;
  };

  // Parent effettivo di un sottocapitolo nell'order: il parentKey dichiarato se è nell'order,
  // altrimenti l'ultimo capitolo (preset o custom) che lo precede.
  const effectiveParentKey = (order, idx) => {
    const key = order[idx];
    if (!key?.startsWith("custom:")) return null;
    const id = parseCustomSectionKey(key);
    const s = customSections.find((c) => c.id === id);
    if (s?.type !== "sottocapitolo") return null;
    if (s.parentKey && order.includes(s.parentKey)) return s.parentKey;
    for (let i = idx - 1; i >= 0; i--) {
      const k = order[i];
      if (!k) continue;
      if (/^ps[1-6]$/.test(k)) return k;
      if (k.startsWith("custom:")) {
        const cid = parseCustomSectionKey(k);
        const cs = customSections.find((c) => c.id === cid);
        if (cs?.type === "capitolo") return k;
      }
    }
    return null;
  };

  // Indici (in ordine) di tutti i sottocapitoli con lo stesso parent effettivo del
  // sottocapitolo a `idx` — i suoi "fratelli", incluso se stesso.
  const siblingSubchapterIdxs = (order, idx) => {
    const parentKey = effectiveParentKey(order, idx);
    if (!parentKey) return [];
    const out = [];
    for (let j = 0; j < order.length; j++) {
      const k = order[j];
      if (!k?.startsWith("custom:")) continue;
      const cs = customSections.find((c) => c.id === parseCustomSectionKey(k));
      if (cs?.type !== "sottocapitolo") continue;
      if (effectiveParentKey(order, j) === parentKey) out.push(j);
    }
    return out;
  };

  // Indice del fratello immediatamente prima (dir<0) o dopo (dir>0) nel gruppo dei
  // sottocapitoli con lo stesso parent effettivo; -1 se è il primo/ultimo del padre.
  // Lavora sul GRUPPO e non sulla semplice adiacenza nell'order: così la freccia resta
  // attiva anche quando un capitolo finisce tra due sottocapitoli dello stesso padre
  // (caso in cui la vecchia scansione direzionale si fermava e ritornava -1).
  const findSiblingSubchapterIdx = (order, idx, dir) => {
    const sibs = siblingSubchapterIdxs(order, idx);
    const pos = sibs.indexOf(idx);
    if (pos < 0) return -1;
    const target = pos + (dir > 0 ? 1 : -1);
    if (target < 0 || target >= sibs.length) return -1;
    return sibs[target];
  };

  const canMoveSection = (order, idx, dir) => {
    const key = order[idx];
    if (key?.startsWith("custom:")) {
      const id = parseCustomSectionKey(key);
      const s = customSections.find((c) => c.id === id);
      if (s?.type === "sottocapitolo") {
        return findSiblingSubchapterIdx(order, idx, dir) >= 0;
      }
    }
    const j = idx + dir;
    return j >= 0 && j < order.length;
  };

  const moveSection = (idx, dir) => {
    setSectionOrder((prev) => {
      const o = [...(prev?.length ? prev : DEFAULT_SECTION_ORDER)];
      const key = o[idx];
      let j;
      if (key?.startsWith("custom:")) {
        const id = parseCustomSectionKey(key);
        const s = customSections.find((c) => c.id === id);
        if (s?.type === "sottocapitolo") {
          j = findSiblingSubchapterIdx(o, idx, dir);
          if (j < 0) return prev;
        } else {
          j = idx + dir;
        }
      } else {
        j = idx + dir;
      }
      if (j < 0 || j >= o.length || j === idx) return prev;
      [o[idx], o[j]] = [o[j], o[idx]];
      return o;
    });
  };

  const deleteCustomKey = (key) => {
    if (!key.startsWith("custom:")) return;
    if (!window.confirm("Eliminare questa sezione?")) return;
    const id = parseCustomSectionKey(key);
    const section = customSections.find((c) => c.id === id);
    const removeIds = new Set(id ? [id] : []);
    if (section?.type === "capitolo") {
      const pfx = `custom:${id}`;
      customSections.forEach((c) => {
        if (c.type === "sottocapitolo" && c.parentKey === pfx) removeIds.add(c.id);
      });
    }
    setCustomSections((prev) =>
      prev.filter((c) => {
        if (!removeIds.has(c.id)) return true;
        if (c.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(c.imageUrl);
        return false;
      }),
    );
    setSectionOrder((prev) =>
      prev.filter((k) => {
        if (!k.startsWith("custom:")) return true;
        const cid = parseCustomSectionKey(k);
        return cid != null && !removeIds.has(cid);
      }),
    );
  };

  const startRenameCustom = (key) => {
    const id = parseCustomSectionKey(key);
    if (!id) return;
    const s = customSections.find((c) => c.id === id);
    if (!s) return;
    setRenamingCustomId(id);
    setRenameDraft(s.title || "");
  };

  const commitRenameCustom = () => {
    if (!renamingCustomId) return;
    const t = renameDraft.trim();
    setCustomSections((prev) =>
      prev.map((s) => (s.id === renamingCustomId ? { ...s, title: t || s.title } : s)),
    );
    setRenamingCustomId(null);
  };

  const openSecModal = () => {
    setSecModalEditingId(null);
    setNewSecType("capitolo");
    setNewSecTitle("");
    setNewSecContent("");
    setNewSecParentKey("ps1");
    if (secModalFileRef.current) secModalFileRef.current.value = "";
    setErr(null);
    setSecModalOpen(true);
  };

  const openSecModalForEdit = (orderKey) => {
    if (!orderKey.startsWith("custom:")) return;
    const sid = parseCustomSectionKey(orderKey);
    const s = customSections.find((c) => c.id === sid);
    if (!s) {
      console.error("[openSecModalForEdit] Sezione non trovata:", orderKey);
      setErr("Impossibile aprire la modifica: dati sezione mancanti.");
      return;
    }
    setSecModalEditingId(sid);
    setNewSecType(s.type === "allegato" ? "allegato" : s.type === "sottocapitolo" ? "sottocapitolo" : "capitolo");
    setNewSecTitle(s.title || "");
    setNewSecContent(s.content || "");
    setNewSecParentKey(s.parentKey && (/^ps[1-6]$/.test(s.parentKey) || s.parentKey.startsWith("custom:")) ? s.parentKey : "ps1");
    if (secModalFileRef.current) secModalFileRef.current.value = "";
    setErr(null);
    setSecModalOpen(true);
  };

  const generateSecAI = async () => {
    if (!newSecTitle.trim()) return;
    setNewSecAILoading(true);
    setErr(null);
    try {
      const FORMATTING_RULES = `
FORMATO DI RISPOSTA OBBLIGATORIO (Markdown):
- Titoli di sezione: usa "## Titolo" (NON usare "#" singolo).
- Sottotitoli: usa "### Sottotitolo".
- Liste puntate: una voce per riga, ogni voce inizia con "- " (trattino+spazio). MAI concatenare voci sulla stessa riga.
- Liste numerate: una voce per riga, ogni voce inizia con "1. ", "2. ", ecc.
- Tabelle: formato pipe markdown, una riga per record:
  | Colonna A | Colonna B | Colonna C |
  |-----------|-----------|-----------|
  | dato 1    | dato 2    | dato 3    |
  | dato 4    | dato 5    | dato 6    |
  Inserisci SEMPRE una newline alla fine di ogni riga. Non mettere mai tutta la tabella su una sola riga.
- Grassetto: **testo**.
- Separa i paragrafi con una riga vuota.
- NON includere il titolo della sezione stessa (es. "## ${newSecTitle.trim()}") all'inizio: viene già renderizzato dall'app.`;
      const prompt =
        newSecType === "allegato"
          ? `Genera il contenuto per un allegato intitolato "${newSecTitle.trim()}" di un Concetto di Sicurezza. Puoi includere checklist, tabelle, procedure operative.\n${FORMATTING_RULES}`
          : newSecType === "sottocapitolo"
            ? `Genera il contenuto per un sotto-capitolo intitolato "${newSecTitle.trim()}" di un Concetto di Sicurezza (testo da inserire sotto un capitolo principale).\n${FORMATTING_RULES}`
            : `Genera il contenuto per una sezione intitolata "${newSecTitle.trim()}" di un Concetto di Sicurezza.\n${FORMATTING_RULES}`;
      const t = await callAIText(prompt);
      setNewSecContent(t);
    } catch (e) {
      console.error("[generateSecAI]", e);
      setErr(e.message);
    } finally {
      setNewSecAILoading(false);
    }
  };

  const submitSectionModal = () => {
    const titleTrim = newSecTitle.trim();
    if (!titleTrim) {
      const msg = "Inserisci un titolo per la sezione.";
      console.error("[submitSectionModal]", msg);
      setErr(msg);
      return;
    }
    setErr(null);

    if (secModalEditingId) {
      const oldRow = customSections.find((c) => c.id === secModalEditingId);
      if (oldRow?.type === "capitolo" && newSecType !== "capitolo") {
        const pfx = `custom:${secModalEditingId}`;
        const hasSubs = customSections.some((c) => c.type === "sottocapitolo" && c.parentKey === pfx);
        if (hasSubs) {
          const msg = "Non puoi cambiare tipo: esistono sotto-capitoli collegati a questo capitolo. Spostali o eliminali prima.";
          console.error("[submitSectionModal]", msg);
          setErr(msg);
          return;
        }
      }
    }

    if (newSecType === "sottocapitolo") {
      if (!newSecParentKey || (!/^ps[1-6]$/.test(newSecParentKey) && !newSecParentKey.startsWith("custom:"))) {
        const msg = "Seleziona un capitolo padre per il sotto capitolo.";
        console.error("[submitSectionModal]", msg);
        setErr(msg);
        return;
      }
      const parentValid =
        /^ps[1-6]$/.test(newSecParentKey) ||
        customSections.some((c) => c.type === "capitolo" && `custom:${c.id}` === newSecParentKey);
      if (!parentValid) {
        const msg = "Capitolo padre non valido (scegli un capitolo esistente).";
        console.error("[submitSectionModal]", msg);
        setErr(msg);
        return;
      }
    }

    let newBlobUrl = null;
    let newMime = null;
    if (newSecType === "allegato") {
      const file = secModalFileRef.current?.files?.[0];
      if (file) {
        const t = detectType(file);
        if (!t || (!t.startsWith("image/") && t !== "application/pdf")) {
          const msg = "Formato file non supportato. Usa JPG, PNG o PDF.";
          console.error("[submitSectionModal]", msg);
          setErr(msg);
          return;
        }
        try {
          newBlobUrl = URL.createObjectURL(file);
          newMime = t;
        } catch (e) {
          console.error("[submitSectionModal] createObjectURL", e);
          setErr(e.message || "Errore durante il caricamento del file.");
          return;
        }
      }
    }

    try {
      if (secModalEditingId) {
        setCustomSections((prev) =>
          prev.map((row) => {
            if (row.id !== secModalEditingId) return row;
            let imageUrl = row.imageUrl;
            let fileMime = row.fileMime;
            if (newSecType === "allegato") {
              if (newBlobUrl) {
                if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
                imageUrl = newBlobUrl;
                fileMime = newMime;
              }
            } else {
              if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
              imageUrl = null;
              fileMime = null;
            }
            return {
              ...row,
              type: newSecType,
              title: titleTrim,
              content: newSecContent,
              imageUrl,
              fileMime,
              parentKey: newSecType === "sottocapitolo" ? newSecParentKey : null,
            };
          }),
        );
        setSecModalOpen(false);
        setSecModalEditingId(null);
        if (secModalFileRef.current) secModalFileRef.current.value = "";
        return;
      }

      const id = newSectionId();
      const sec = {
        id,
        type: newSecType,
        title: titleTrim,
        content: newSecContent,
        imageUrl: newBlobUrl,
        fileMime: newMime,
        order: 0,
        parentKey: newSecType === "sottocapitolo" ? newSecParentKey : null,
      };
      const newSec = { ...sec, order: customSections.length };
      const updatedCustomList = [...customSections, newSec];
      setCustomSections(updatedCustomList);
      setSectionOrder((prev) => {
        const base = prev?.length ? prev : [...DEFAULT_SECTION_ORDER];
        const inserted = insertNewCustomKeysInOrder(base, [newSec]);
        return normalizeSectionOrder(inserted, updatedCustomList);
      });
      setSecModalOpen(false);
      setSecModalEditingId(null);
      if (secModalFileRef.current) secModalFileRef.current.value = "";
    } catch (e) {
      console.error("[submitSectionModal]", e);
      setErr(e.message || String(e));
    }
  };

  // Previeni apertura file dal browser in modo aggressivo (capture phase)
  React.useEffect(() => {
    const stopDrag = (e) => e.preventDefault();
    document.addEventListener("dragover", stopDrag);
    document.addEventListener("drop", stopDrag);
    return () => {
      document.removeEventListener("dragover", stopDrag);
      document.removeEventListener("drop", stopDrag);
    };
  }, []);

  React.useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [history]);

  const readAsB64 = (file) => new Promise((res,rej) => {
    const r = new FileReader(); r.onload=(e)=>res(e.target.result.split(",")[1]); r.onerror=()=>rej(new Error("Errore lettura")); r.readAsDataURL(file);
  });

  const detectType = (file) => {
    if (file.type.startsWith("image/")) return file.type;
    if (file.type==="application/pdf") return "application/pdf";
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".pdf")) return "application/pdf";
    if (ext.endsWith(".jpg")||ext.endsWith(".jpeg")) return "image/jpeg";
    if (ext.endsWith(".png")) return "image/png";
    return null;
  };

  const addFiles = async (files) => {
    const toAdd = [];
    const MAX_MB = 10;
    for (const file of Array.from(files)) {
      const t = detectType(file); if (!t) continue;
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > MAX_MB) {
        setErr(`⚠ "${file.name}" è ${sizeMB.toFixed(1)}MB — troppo grande (max ${MAX_MB}MB). Per planimetrie usa la sezione Allegato 2 qui sotto.`);
        continue;
      }
      const d = await readAsB64(file);
      toAdd.push({id:Date.now()+Math.random(), name:file.name, type:t, data:d});
    }
    setAttachments(prev=>[...prev,...toAdd]);
  };

  const addAll2Files = (files) => {
    const toAdd = Array.from(files).map(file => ({
      id: Date.now()+Math.random(),
      name: file.name,
      type: detectType(file)||"application/octet-stream",
      url: URL.createObjectURL(file),
    }));
    setData(prev=>({...prev, allegato2Files:[...(prev.allegato2Files||[]),...toAdd]}));
  };

  const removeAll2 = (id) => {
    setData(prev=>{
      const f = (prev.allegato2Files||[]).find(x=>x.id===id);
      if(f?.url) URL.revokeObjectURL(f.url);
      return {...prev, allegato2Files:(prev.allegato2Files||[]).filter(x=>x.id!==id)};
    });
  };

  const addAll1Files = (files) => {
    const toAdd = Array.from(files).map(file => ({
      id: Date.now()+Math.random(),
      name: file.name,
      type: detectType(file)||"application/octet-stream",
      url: URL.createObjectURL(file),
    }));
    setData(prev=>({...prev, allegato1Files:[...(prev.allegato1Files||[]),...toAdd]}));
  };

  const removeAll1 = (id) => {
    setData(prev=>{
      const f = (prev.allegato1Files||[]).find(x=>x.id===id);
      if(f?.url) URL.revokeObjectURL(f.url);
      return {...prev, allegato1Files:(prev.allegato1Files||[]).filter(x=>x.id!==id)};
    });
  };

  const runEdit = async (effectiveMsg, effectiveAttachments, dataOverride = null) => {
    setLoading(true); setErr(null);
    const baseData = dataOverride || data;
    const { chapterNumByKey } = buildSectionNumberMaps(sectionOrder, customSections, presetDeletedItems);
    const customSectionsForAI = customSections.map((c) => {
      const ck = `custom:${c.id}`;
      const num = chapterNumByKey.get(ck);
      return {
        id: c.id,
        type: c.type,
        title: c.title || "",
        content: c.content || "",
        parentKey: c.parentKey || null,
        displayNumber: num != null ? num : undefined,
        hasFile: !!c.imageUrl,
      };
    });
    const SYS_EDIT = SYS_PROMPT+`

Ti viene passato il JSON attuale del documento e la modifica richiesta. Restituisci il JSON completo aggiornato con le modifiche applicate, mantenendo tutti i campi esistenti.

Il JSON include anche un campo \`customSections\` che è un array di sezioni custom (capitoli, sotto-capitoli, allegati creati dall'utente) con i campi: id, type ("capitolo"|"sottocapitolo"|"allegato"), title, content, parentKey, displayNumber (numero del capitolo nell'ordine visivo, es. 7), hasFile (boolean — informativo).

Se la modifica richiesta riguarda una sezione custom (es. "togli la frase X dal capitolo 7", "aggiungi un paragrafo al capitolo intitolato Y", "rinomina il sotto-capitolo Z"), aggiorna il titolo e/o il content della voce corrispondente in \`customSections\` (identifica la voce per displayNumber, title o parentKey). MANTIENI sempre lo stesso id e gli altri campi invariati. NON modificare hasFile.

Se la modifica richiesta è di INSERIRE una nuova sezione (es. "inserisci sottocapitolo 2.6", "aggiungi un capitolo dopo il 4", "aggiungi un allegato"), aggiungi una nuova voce all'array \`customSections\` con:
- id: "new" (verrà rimpiazzato con un id univoco)
- type: "capitolo" | "sottocapitolo" | "allegato"
- title: titolo della nuova voce
- content: contenuto in markdown (## titolo, ### sottotitolo, **grassetto**, - elenco)
- parentKey: per i sottocapitoli SOLO, usa "ps1".."ps6" per i capitoli preset o l'id del capitolo padre (es. "custom:abc123"). Per "sottocapitolo 2.6" il parentKey è "ps2".
NON inserire numerazione manuale: il sistema calcola "2.6" automaticamente dal parentKey.

Restituisci \`customSections\` completo (esistenti + nuovi) nel JSON di risposta.`;
    const attList = effectiveAttachments.map(a=>`- ${a.name} (${a.type.startsWith("image/")?"immagine/piantina":"documento PDF"})`).join("\n");
    const dataClean = {...baseData, logoEvento: baseData.logoEvento ? "[logo_caricato]" : null, customSections: customSectionsForAI };
    const editMsg = `DOCUMENTO ATTUALE (JSON):\n${JSON.stringify(dataClean,null,2)}\n\nMODIFICA RICHIESTA:\n${effectiveMsg||"(vedi allegati)"}${effectiveAttachments.length>0?`\n\nALLEGATI (${effectiveAttachments.length}):\n${attList}\nAnalizza gli allegati e integra le informazioni nei capitoli corretti.`:""}`;
    try {
      const newData = await callAI(editMsg, null, effectiveAttachments, SYS_EDIT);
      const { customSections: newCS, ...rest } = newData || {};
      setData({...rest, logoEvento:baseData.logoEvento||null, allegato1Files:baseData.allegato1Files||[], allegato2Files:baseData.allegato2Files||[], eventSettings: baseData.eventSettings || null});
      let newlyCreated = [];
      if (Array.isArray(newCS)) {
        const existingIds = new Set(customSections.map((c) => c.id));
        const updatesById = new Map();
        for (const entry of newCS) {
          if (!entry || typeof entry !== "object") continue;
          if (entry.id && existingIds.has(entry.id)) {
            updatesById.set(entry.id, entry);
          } else if (entry.type && entry.title) {
            // Nuovo customSection creato dall'AI
            const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const safeType = ["capitolo", "sottocapitolo", "allegato"].includes(entry.type) ? entry.type : "capitolo";
            const parentKey = safeType === "sottocapitolo" && typeof entry.parentKey === "string" ? entry.parentKey : null;
            newlyCreated.push({
              id: newId,
              type: safeType,
              title: String(entry.title).trim(),
              content: typeof entry.content === "string" ? entry.content : "",
              parentKey,
              imageUrl: null,
              fileMime: null,
            });
          }
        }
        const updatedExisting = customSections.map((old) => {
          const entry = updatesById.get(old.id);
          if (!entry) return old;
          return {
            ...old,
            title: typeof entry.title === "string" ? entry.title : old.title,
            content: typeof entry.content === "string" ? entry.content : old.content,
          };
        });
        const updatedCustomList = [...updatedExisting, ...newlyCreated];
        setCustomSections(updatedCustomList);
        if (newlyCreated.length) {
          setSectionOrder((prev) => {
            const inserted = insertNewCustomKeysInOrder(prev, newlyCreated);
            return normalizeSectionOrder(inserted, updatedCustomList);
          });
        }
      }
      setHistory(prev=>[...prev,{msg:effectiveMsg||"(allegati)", files:effectiveAttachments.map(a=>a.name), ts:new Date()}]);
    } catch (e) {
      console.error("[runEdit]", e);
      setErr(e.message);
    }
    finally { setLoading(false); }
  };

  const applyEdit = async () => {
    if (!msg.trim() && attachments.length===0) return;
    const m = msg;
    const att = attachments;
    setMsg(""); setAttachments([]);
    await runEdit(m, att);
  };

  // ── Modifica impostazioni evento (form iniziale) ────────────────────────
  const buildDefaultSettings = (d) => ({
    ...INIT,
    name: d?.nomeEvento || INIT.name,
    anno: d?.anno || INIT.anno,
    luogo: d?.luogo || INIT.luogo,
    logoEvento: d?.logoEvento || null,
  });

  const openSettingsModal = () => {
    const initial = data.eventSettings ? {...data.eventSettings} : buildDefaultSettings(data);
    if (!Array.isArray(initial.strutture)) initial.strutture = [];
    setSettingsDraft(initial);
    setSettingsStep(0);
    setErr(null);
    setSettingsModalOpen(true);
  };

  const updateSettingsDraft = (k, v) => setSettingsDraft((p) => ({...p, [k]: v}));

  const SETTINGS_FIELD_LABELS = {
    name: "Nome evento", anno: "Anno", tipo: "Tipo evento", date: "Date evento",
    affluenza: "Affluenza prevista", orari: "Orari", programma: "Programma / Serate",
    noteEvento: "Note evento",
    orgNome: "Nome società organizzatrice", orgContatto: "Contatto principale",
    orgAddr: "Indirizzo organizzazione", orgEmail: "Email organizzazione",
    orgTelAz: "Tel. ufficio organizzazione", orgTelMob: "Tel. mobile organizzazione",
    gerente: "Gerente / Referente serale",
    ci: "Capo impiego DELTA", ciTel: "Tel. capo impiego", ciEmail: "Email capo impiego",
    municipio: "Municipio / comune", municipioTel: "Tel. municipio",
    polCant: "Polizia cantonale", polCom: "Polizia comunale",
    pomp: "Pompieri", san: "Sanitari / Croce Verde", sama: "Samaritani",
    luogo: "Indirizzo / area evento", comune: "Comune", areaDesc: "Descrizione area",
    entrata: "Tipo entrata", strutture: "Strutture e servizi",
    altreStr: "Altre strutture", minori: "Sistema identificazione minori",
    noteAccessi: "Note accessi / F&B",
    disp: "Agenti per data e fascia oraria", pos: "Posizioni previste",
    pc: "Posto comando", comm: "Sistema comunicazioni", pompSer: "Pompieri in servizio",
    noteDisp: "Note dispositivo",
  };

  const computeSettingsDiff = (prev, next) => {
    const lines = [];
    const keys = Array.from(new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]));
    for (const k of keys) {
      if (k === "logoEvento") continue;
      const a = prev?.[k];
      const b = next?.[k];
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      const label = SETTINGS_FIELD_LABELS[k] || k;
      const fmt = (v) => {
        if (v == null || v === "") return "(vuoto)";
        if (Array.isArray(v)) return v.length ? v.join(", ") : "(nessuno)";
        return String(v);
      };
      lines.push(`- ${label}: "${fmt(a)}" → "${fmt(b)}"`);
    }
    return lines;
  };

  const applyEventSettings = async () => {
    if (!settingsDraft) { setSettingsModalOpen(false); return; }
    const prev = data.eventSettings || buildDefaultSettings(data);
    const next = {...settingsDraft};
    const diff = computeSettingsDiff(prev, next);
    const newData = {
      ...data,
      eventSettings: next,
      logoEvento: next.logoEvento ?? data.logoEvento ?? null,
    };
    setData(newData);
    setSettingsModalOpen(false);
    if (!diff.length) return;
    const editMsg = `IMPOSTAZIONI EVENTO AGGIORNATE DAL FORM INIZIALE.\n\nCampi modificati:\n${diff.join("\n")}\n\nAggiorna in modo coerente i campi e i testi del documento che dipendono da queste impostazioni (es. nomeEvento, luogo, anno, s1 contatti/responsabili, s2 descrizione/programma/orari/location/visitatori/minori, s3 analisi pericoli se cambia affluenza/tipo, s4 dispositivo/comunicazioni/posto comando, ecc.). Mantieni invariati i campi non interessati.`;
    await runEdit(editMsg, [], newData);
  };

  // ── Salvataggio su Supabase (tabella cs_documenti) ──────────────────────────
  // In parallelo al salvataggio localStorage esistente (che resta invariato).
  const doSaveCs = async () => {
    setCsSaving(true); setErr(null); setCsSaveMsg(null);
    try {
      const es = data.eventSettings || {};
      const csData = {
        nome_evento: data.nomeEvento || es.name || "",
        luogo: data.luogo || es.luogo || "",
        anno: data.anno || es.anno || "",
        tipo_evento: es.tipo || "",
        stato: "bozza",
        versione: 1,
        evento: { ...es },
        contenuto: { customSections, sectionOrder, presetOverrides, presetDeletedItems, presetSubOrder, data },
      };
      if (!csId) {
        const { data: row, error } = await supabase.from("cs_documenti").insert([csData]).select().single();
        if (error) throw error;
        setCsId(row.id);
        setCsDocId?.(row.id);
      } else {
        const { error } = await supabase.from("cs_documenti").update(csData).eq("id", csId);
        if (error) throw error;
      }
      setCsSaveMsg("Salvato ✓");
    } catch (e) {
      console.error("[Editor] save CS", e);
      setErr(`Errore salvataggio CS: ${e.message}`);
    } finally {
      setCsSaving(false);
    }
  };

  const buildPrintHTML = () => {
    const el = document.getElementById("doc-preview");
    if (!el) return "";

    const getById = (rawId) => {
      const node = el.querySelector(`#${CSS.escape(rawId)}`);
      return node ? node.innerHTML : "";
    };

    const hdr = `<div style="display:flex;align-items:center;justify-content:flex-end;padding:4px 32px;border-bottom:2px solid #0c1d3d;background:white;">
  <img src="${window.location.origin}${logoImg}" style="height:65px;display:block;"/>
</div>`;

    const ftr = `<div style="display:flex;justify-content:center;padding:5px 32px;border-top:1px solid #0c1d3d;font-size:8pt;color:#555;font-family:Arial;background:white;">
  DELTAgroup Security &amp; Services AG &middot; Filiale Ticino &middot; Via alla Foce 4, 6933 Muzzano &middot; T +41 91 921 49 49 &middot; ticino@delta.ch &middot; www.delta.ch
</div>`;

    const page = (content, extraClass = "") =>
      `<div class="ppage ${extraClass}">
        <div class="pcnt">${content}</div>
      </div>`;

    const coverHTML = getById("pc");
    const tocHTML = getById("ptoc");

    const order = sectionOrder?.length ? sectionOrder : DEFAULT_SECTION_ORDER;
    let flowParts = "";
    for (const key of order) {
      const presetWith = (k, fallbackDomIds, klass) => {
        const ovr = presetOverrides[k];
        if (ovr != null) return ovr ? page(ovr, klass) : "";
        return fallbackDomIds
          .map((id) => getById(id))
          .filter(Boolean)
          .map((h) => page(h, klass))
          .join("");
      };
      if (key === "ps1") {
        flowParts += presetWith("ps1", ["ps1"], "ppage-flow");
      } else if (key === "ps2") {
        flowParts += presetWith("ps2", ["ps2"], "ppage-flow");
      } else if (key === "ps3") {
        flowParts += presetWith("ps3", ["ps3"], "ppage-flow");
      } else if (key === "ps4") {
        flowParts += presetWith("ps4", ["ps4"], "ppage-flow");
      } else if (key === "ps5") {
        flowParts += presetWith("ps5", ["ps5"], "ppage-flow");
      } else if (key === "ps6") {
        flowParts += presetWith("ps6", ["ps6a", "ps6b"], "ppage-flow");
      } else if (key === "all1") {
        flowParts += presetWith("all1", ["pall1"], "ppage-flow");
      } else if (key === "all2") {
        flowParts += presetWith("all2", ["pall2"], "ppage-flow");
      } else if (key.startsWith("custom:")) {
        const id = parseCustomSectionKey(key);
        const s = customSections.find((c) => c.id === id);
        if (!s) continue;
        if (s.type === "capitolo") {
          const h = getById(`pcap-${id}`);
          if (h) flowParts += page(h, "ppage-flow");
        } else if (s.type === "sottocapitolo") {
          // già renderizzato dentro la pagina del capitolo padre
        } else {
          const h = getById(`pallc-${id}`);
          if (h) flowParts += page(h, "ppage-flow ppage-allegato-custom");
        }
      }
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Concetto di Sicurezza – ${data.nomeEvento||""}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:10pt;color:#1a2038;background:#fff;}
table{width:100%;border-collapse:collapse;margin:4px 0;}
td,th{padding:5px 9px;border:1px solid #d0dae8;font-size:9pt;}
th{background:#0c1d3d!important;color:#fff!important;}
img{max-width:100%;display:block;}
ul{margin:0;padding-left:18px;}li{line-height:1.7;}
embed{display:block;}
.ppage{width:100%;padding-top:0;break-before:page;page-break-before:always;}
.ppage-first{break-before:auto;page-break-before:auto;}
.ppage-fixed{height:297mm;overflow:hidden;}
.ppage-flow{overflow:visible;}
.pcnt{padding-top:0;padding-bottom:10px;padding-left:36px;padding-right:36px;overflow:visible;}
.ppage-allegato-custom .pcnt{font-size:8pt;line-height:1.3;}
.cover .pcnt{
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  text-align:center;
}
@media print{
  @page{size:A4 portrait;margin:0 10mm 0 10mm;}
  .doc-page-header{display:none!important;}
  .print-hdr{position:fixed;top:0;left:0;height:auto;width:100%;z-index:1000;}
  .print-ftr{position:fixed;bottom:0;left:0;width:100%;z-index:1000;}
  .ppage-fixed{height:297mm;overflow:hidden;}
  .pcnt{padding-top:85px;padding-bottom:60px;padding-left:36px;padding-right:36px;}
  .ppage-allegato-custom .pcnt{font-size:8pt;line-height:1.3;}
  .cover .pcnt{height:100%;box-sizing:border-box;}
  .pcnt h2,.pcnt h3,.pcnt h4{break-after:avoid;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid;}
  .pcnt p,.pcnt li,.pcnt tr{break-inside:avoid;page-break-inside:avoid;orphans:3;widows:3;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  th{background:#0c1d3d!important;color:#fff!important;}
}
</style></head><body>
<div class="print-hdr">${hdr}</div>
<div class="print-ftr">${ftr}</div>
${page(coverHTML, "cover ppage-fixed ppage-first")}
${page(tocHTML, "ppage-fixed")}
${flowParts}
</body></html>`;
  };


  const doPrint = () => {
    const html = buildPrintHTML();
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) { alert("Abilita i popup per questo sito nelle impostazioni del browser, poi riprova."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 2500);
  };

  const doDownloadHTML = () => {
    const nomeFile = (data.nomeEvento||"concetto").replace(/[^a-zA-Z0-9_\-]/g,"_");
    const fullHTML = buildPrintHTML();
    if (!fullHTML) return;
    const blob = new Blob([fullHTML], {type:"text/html;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nomeFile}.html`; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  };

  const [docxLoading, setDocxLoading] = useState(false);
  const doDownloadDocx = async () => {
    setDocxLoading(true);
    setErr(null);
    try {
      const nomeFile = (data.nomeEvento||"concetto").replace(/[^a-zA-Z0-9_\-]/g,"_");
      const blob = await generateDocxBlob({
        data,
        customSections,
        sectionOrder,
        presetDeletedItems,
        presetSubOrder,
        headerLogoUrl: `${window.location.origin}${logoImg}`,
        PRESET_SUB_COUNT,
        DEFAULT_SECTION_ORDER,
      });
      saveAs(blob, `${nomeFile}.docx`);
    } catch (e) {
      console.error("[doDownloadDocx]", e);
      setErr(`Errore generazione DOCX: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  const doShareDocx = async () => {
    setDocxLoading(true);
    setErr(null);
    try {
      const nomeFile = (data.nomeEvento||"documento").replace(/[^a-zA-Z0-9_\-]/g,"_");
      const blob = await generateDocxBlob({
        data,
        customSections,
        sectionOrder,
        presetDeletedItems,
        presetSubOrder,
        headerLogoUrl: `${window.location.origin}${logoImg}`,
        PRESET_SUB_COUNT,
        DEFAULT_SECTION_ORDER,
      });
      await shareOrDownloadDocx(
        blob,
        `CS_${nomeFile}.docx`,
        `Concetto di Sicurezza — ${data.nomeEvento||""}`,
        "DELTAgroup Security & Services AG"
      );
    } catch (e) {
      console.error("[doShareDocx]", e);
      setErr(`Errore condivisione DOCX: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  // Costruisce l'array di sezioni { title, html } dalla preview renderizzata
  // (#doc-preview), nell'ordine corrente, per il generatore PDF.
  const buildCsSections = () => {
    const el = document.getElementById("doc-preview");
    if (!el) return [];
    const getNode = (id) => el.querySelector(`#${CSS.escape(id)}`);
    const order = sectionOrder?.length ? sectionOrder : DEFAULT_SECTION_ORDER;
    const out = [];
    const pushNode = (id) => { const s = csSectionFromNode(getNode(id)); if (s) out.push(s); };
    const pushPreset = (key, ids) => {
      const ovr = presetOverrides[key];
      if (ovr != null) { if (ovr) { const s = csSectionFromHtml(ovr); if (s) out.push(s); } return; }
      ids.forEach(pushNode);
    };
    for (const key of order) {
      if (key === "ps1") pushPreset("ps1", ["ps1"]);
      else if (key === "ps2") pushPreset("ps2", ["ps2"]);
      else if (key === "ps3") pushPreset("ps3", ["ps3"]);
      else if (key === "ps4") pushPreset("ps4", ["ps4"]);
      else if (key === "ps5") pushPreset("ps5", ["ps5"]);
      else if (key === "ps6") pushPreset("ps6", ["ps6a", "ps6b"]);
      else if (key === "all1") pushPreset("all1", ["pall1"]);
      else if (key === "all2") pushPreset("all2", ["pall2"]);
      else if (key.startsWith("custom:")) {
        const id = parseCustomSectionKey(key);
        const s = customSections.find((c) => c.id === id);
        if (!s) continue;
        if (s.type === "capitolo") pushNode(`pcap-${id}`);
        else if (s.type === "sottocapitolo") { /* renderizzato dentro il padre */ }
        else pushNode(`pallc-${id}`);
      }
    }
    return out;
  };

  const buildCsEvento = () => ({
    nomeEvento: data.nomeEvento || "",
    tipoEvento: data.eventSettings?.tipo || "",
    luogo: data.luogo || data.eventSettings?.luogo || "",
    date: data.eventSettings?.date || "",
    organizzatore: data.eventSettings?.orgNome || "",
    affluenza: data.eventSettings?.affluenza || "",
    strutture: data.eventSettings?.strutture || "",
  });

  const doDownloadCsPdf = async () => {
    setDocxLoading(true);
    setErr(null);
    try {
      const nomeFile = (data.nomeEvento||"concetto").replace(/[^a-zA-Z0-9_\-]/g,"_");
      const blob = await buildCsPdfBlob(buildCsSections(), buildCsEvento());
      saveAs(blob, `CS_${nomeFile}.pdf`);
    } catch (e) {
      console.error("[doDownloadCsPdf]", e);
      setErr(`Errore generazione PDF: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  const doShareCsPdf = async () => {
    setDocxLoading(true);
    setErr(null);
    try {
      const nomeFile = (data.nomeEvento||"documento").replace(/[^a-zA-Z0-9_\-]/g,"_");
      const blob = await buildCsPdfBlob(buildCsSections(), buildCsEvento());
      await shareOrDownloadPdf(
        blob,
        `CS_${nomeFile}.pdf`,
        `Concetto di Sicurezza — ${data.nomeEvento||""}`,
        "DELTAgroup Security & Services AG"
      );
    } catch (e) {
      console.error("[doShareCsPdf]", e);
      setErr(`Errore condivisione PDF: ${e.message}`);
    } finally {
      setDocxLoading(false);
    }
  };

  const dropBase = (drag) => ({
    border:`2px dashed ${drag?N:GB}`, borderRadius:"8px", padding:"10px 14px",
    cursor:"pointer", background:drag?"#eef2f9":BG, transition:"all 0.2s",
    display:"flex", alignItems:"center", gap:"8px",
  });

  return (
    <div style={{display:"flex", height:"calc(100vh - 60px)", overflow:"hidden"}}>

      {/* ── PANNELLO SINISTRO ── */}
      {/* Niente onDrop globale qui: ogni dropzone (Allegato 1, Allegato 2, chat) gestisce il proprio. */}
      <div
        style={{width:"360px",minWidth:"300px",background:WH,borderRight:`1px solid ${GB}`,display:"flex",flexDirection:"column",overflow:"hidden"}}
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>e.preventDefault()}
      >

        {/* Top bar */}
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${GB}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:N,position:"relative"}}>
          <button onClick={onBack} style={{...SANS,fontSize:"12px",color:"rgba(255,255,255,0.75)",background:"none",border:"none",cursor:"pointer",padding:0}}>← Indietro</button>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            {csSaveMsg && <span style={{...SANS,fontSize:"11px",fontWeight:"700",color:"#86efac"}}>{csSaveMsg}</span>}
            <button onClick={doSaveCs} disabled={csSaving} style={{...SANS,fontSize:"12px",padding:"6px 12px",background:WH,color:N,border:"none",borderRadius:"6px",cursor:csSaving?"wait":"pointer",fontWeight:"700"}}>{csSaving?"Salvo…":"💾 Salva"}</button>
            <div style={{position:"relative"}}>
            <button onClick={()=>setShowSave(s=>!s)} style={{...SANS,fontSize:"12px",padding:"6px 12px",background:AC,color:WH,border:"none",borderRadius:"6px",cursor:"pointer",fontWeight:"600",display:"flex",alignItems:"center",gap:"5px"}}>
              🖨️ Stampa / Salva <span style={{fontSize:"10px"}}>▼</span>
            </button>
            {showSave&&(
              <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:WH,border:`1px solid ${GB}`,borderRadius:"8px",boxShadow:"0 8px 24px rgba(0,0,0,0.13)",zIndex:100,minWidth:"200px",overflow:"hidden"}}>
                <button onClick={()=>{doPrint();setShowSave(false);}} style={{...SANS,width:"100%",padding:"11px 16px",background:"none",border:"none",borderBottom:`1px solid ${GB}`,cursor:"pointer",textAlign:"left",fontSize:"13px",color:TX,display:"flex",gap:"10px",alignItems:"center"}}>
                  <span>🖨️</span><div><div style={{fontWeight:"600"}}>Stampa</div><div style={{fontSize:"10px",color:GR}}>Apri dialogo di stampa</div></div>
                </button>
                <button onClick={()=>{doPrint();setShowSave(false);}} style={{...SANS,width:"100%",padding:"11px 16px",background:"none",border:"none",borderBottom:`1px solid ${GB}`,cursor:"pointer",textAlign:"left",fontSize:"13px",color:TX,display:"flex",gap:"10px",alignItems:"center"}}>
                  <span>📄</span><div><div style={{fontWeight:"600"}}>Salva come PDF</div><div style={{fontSize:"10px",color:GR}}>Stampa → Salva come PDF</div></div>
                </button>
                <button onClick={()=>{doDownloadDocx();setShowSave(false);}} disabled={docxLoading} style={{...SANS,width:"100%",padding:"11px 16px",background:"none",border:"none",borderBottom:`1px solid ${GB}`,cursor:docxLoading?"wait":"pointer",textAlign:"left",fontSize:"13px",color:TX,display:"flex",gap:"10px",alignItems:"center"}}>
                  <span>📝</span><div><div style={{fontWeight:"600"}}>{docxLoading?"Generazione in corso…":"Scarica Word (DOCX)"}</div><div style={{fontSize:"10px",color:GR}}>Modificabile in Word, converti in PDF da lì</div></div>
                </button>
                <button onClick={()=>{doDownloadCsPdf();setShowSave(false);}} disabled={docxLoading} style={{...SANS,width:"100%",padding:"11px 16px",background:"none",border:"none",borderBottom:`1px solid ${GB}`,cursor:docxLoading?"wait":"pointer",textAlign:"left",fontSize:"13px",color:TX,display:"flex",gap:"10px",alignItems:"center"}}>
                  <span>📋</span><div><div style={{fontWeight:"600"}}>{docxLoading?"Generazione in corso…":"Scarica PDF"}</div><div style={{fontSize:"10px",color:GR}}>PDF pronto da stampare o inviare</div></div>
                </button>
                <button onClick={()=>{doShareCsPdf();setShowSave(false);}} disabled={docxLoading} style={{...SANS,width:"100%",padding:"11px 16px",background:WH,border:"none",borderBottom:`1px solid ${GB}`,borderLeft:`3px solid ${AC}`,cursor:docxLoading?"wait":"pointer",textAlign:"left",fontSize:"13px",color:AC,display:"flex",gap:"10px",alignItems:"center"}}>
                  <span>📤</span><div><div style={{fontWeight:"600",color:AC}}>{docxLoading?"Generazione in corso…":"Condividi PDF"}</div><div style={{fontSize:"10px",color:GR}}>Invia tramite app (o scarica se non disponibile)</div></div>
                </button>
                <button onClick={()=>{doDownloadHTML();setShowSave(false);}} style={{...SANS,width:"100%",padding:"11px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontSize:"13px",color:TX,display:"flex",gap:"10px",alignItems:"center"}}>
                  <span>🌐</span><div><div style={{fontWeight:"600"}}>Scarica HTML</div><div style={{fontSize:"10px",color:GR}}>File completo con immagini</div></div>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Header pannello */}
        <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${GB}`}}>
          <div style={{...SERIF,fontSize:"16px",fontWeight:"700",color:N,marginBottom:"2px"}}>Modifica documento</div>
          <div style={{...SANS,fontSize:"11px",color:GR,marginBottom:"8px"}}>Digita le modifiche · allega file · premi Applica</div>
          <button type="button" onClick={openSettingsModal} style={{...SANS,width:"100%",padding:"8px 10px",background:WH,color:N,border:`1px solid ${N}`,borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:"600",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}} title="Riapri il form iniziale con i campi compilati">
            ⚙️ Modifica impostazioni evento
          </button>
        </div>

        <div style={{padding:"10px 14px",borderBottom:`1px solid ${GB}`,maxHeight:"200px",overflowY:"auto",background:"#fafbfd"}}>
          <div style={{...SANS,fontSize:"11px",fontWeight:"700",color:N,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"8px"}}>Sezioni documento</div>
          {ord.map((key, i)=>{
            const customId = key.startsWith("custom:") ? parseCustomSectionKey(key) : null;
            const isRenaming = customId && renamingCustomId === customId;
            const canUp = canMoveSection(ord, i, -1);
            const canDown = canMoveSection(ord, i, 1);
            return (
            <div key={`${key}-${i}`} style={{display:"flex",alignItems:"center",gap:"4px",marginBottom:"6px",...SANS,fontSize:"11px"}}>
              <button type="button" onClick={()=>moveSection(i,-1)} disabled={!canUp} style={{background:!canUp?"#eee":WH,border:`1px solid ${GB}`,borderRadius:"4px",cursor:!canUp?"not-allowed":"pointer",padding:"2px 6px",fontSize:"10px"}} title="Su">▲</button>
              <button type="button" onClick={()=>moveSection(i,1)} disabled={!canDown} style={{background:!canDown?"#eee":WH,border:`1px solid ${GB}`,borderRadius:"4px",cursor:!canDown?"not-allowed":"pointer",padding:"2px 6px",fontSize:"10px"}} title="Giù">▼</button>
              {key.startsWith("custom:") && (
                <button type="button" onClick={()=>deleteCustomKey(key)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"14px",padding:"0 4px",lineHeight:1}} title="Elimina">🗑</button>
              )}
              {key.startsWith("custom:") && !isRenaming && (
                <button type="button" onClick={()=>startRenameCustom(key)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"13px",padding:"0 4px",lineHeight:1}} title="Rinomina solo titolo">✎</button>
              )}
              {key.startsWith("custom:") && !isRenaming && (
                <button type="button" onClick={()=>openSecModalForEdit(key)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"11px",padding:"2px 6px",lineHeight:1,color:N,fontWeight:"600"}} title="Modifica contenuto e tipo">✏️ Modifica</button>
              )}
              {(/^ps[1-6]$/.test(key) || key === "all1" || key === "all2") && (
                <button type="button" onClick={()=>openPresetEdit(key)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"11px",padding:"2px 6px",lineHeight:1,color:N,fontWeight:"600"}} title={presetOverrides[key] ? "Modifica override (override attivo)" : "Modifica contenuto preset"}>
                  ✏️ Modifica{presetOverrides[key] ? " ●" : ""}
                </button>
              )}
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e)=>setRenameDraft(e.target.value)}
                  onBlur={commitRenameCustom}
                  onKeyDown={(e)=>{
                    if (e.key === "Enter") { e.preventDefault(); commitRenameCustom(); }
                    if (e.key === "Escape") { e.preventDefault(); setRenamingCustomId(null); }
                  }}
                  style={{flex:1,...inp,fontSize:"11px",padding:"4px 8px",minWidth:0}}
                />
              ) : (
                <span style={{flex:1,lineHeight:1.35,color:TX}}>{labelForKey(key)}</span>
              )}
            </div>
            );
          })}
          <button type="button" onClick={openSecModal} style={{...SANS,width:"100%",marginTop:"8px",padding:"8px 10px",background:N,color:WH,border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"12px",fontWeight:"600"}}>
            + Aggiungi sezione
          </button>
        </div>

        {/* Storico modifiche */}
        <div style={{flex:1,overflowY:"auto",padding:"10px 14px"}}>
          {history.length===0 ? (
            <div style={{...SANS,fontSize:"12px",color:GR,textAlign:"center",marginTop:"24px",lineHeight:1.7}}>
              💬<br/>Scrivi qui sotto per modificare<br/>il documento in tempo reale
            </div>
          ) : history.map((h,i)=>(
            <div key={i} style={{marginBottom:"10px",background:"#f5f7fb",borderRadius:"8px",padding:"9px 12px",border:`1px solid ${GB}`}}>
              <div style={{...SANS,fontSize:"12px",color:TX,marginBottom:h.files.length?"4px":"0",lineHeight:1.55}}>{h.msg}</div>
              {h.files.length>0&&<div style={{...SANS,fontSize:"11px",color:GR}}>📎 {h.files.join(", ")}</div>}
              <div style={{...SANS,fontSize:"10px",color:"#aaa",marginTop:"4px"}}>✓ {h.ts.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>

        {/* File allegati pronti */}
        {attachments.length>0&&(
          <div style={{padding:"6px 14px",borderTop:`1px solid ${GB}`,maxHeight:"110px",overflowY:"auto",background:"#fafbfd"}}>
            {attachments.map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 0",...SANS,fontSize:"11px"}}>
                <span>{a.type.startsWith("image/")?"🖼️":"📄"}</span>
                <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:TX}}>{a.name}</span>
                <button onClick={()=>setAttachments(p=>p.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:"18px",padding:0,lineHeight:1}}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Allegato 1 upload ── */}
        <div style={{padding:"10px 14px",borderTop:`1px solid ${GB}`,background:"#fafbfd"}}>
          <div style={{...SANS,fontSize:"11px",fontWeight:"700",color:N,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"7px"}}>📢 Allegato 1 – Annunci d'emergenza</div>
          <input ref={all1Ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" multiple style={{display:"none"}} onChange={e=>addAll1Files(e.target.files)}/>
          {(data.allegato1Files||[]).map(f=>(
            <div key={f.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 0",...SANS,fontSize:"11px"}}>
              <span>{f.type.startsWith("image/")?"🖼️":f.type==="application/pdf"?"📄":"📊"}</span>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:TX}}>{f.name}</span>
              <button onClick={()=>removeAll1(f.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:"16px",padding:0,lineHeight:1}}>×</button>
            </div>
          ))}
          <div
            style={{border:`1px dashed ${all1Drag?N:GB}`,borderRadius:"6px",padding:"8px 12px",cursor:"pointer",background:all1Drag?"#eef2f9":WH,display:"flex",alignItems:"center",gap:"8px",marginTop:"4px",transition:"all 0.2s"}}
            onClick={()=>all1Ref.current.click()}
            onDragEnter={e=>{e.preventDefault();e.stopPropagation();setAll1Drag(true);}}
            onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
            onDragLeave={e=>{e.preventDefault();e.stopPropagation();setAll1Drag(false);}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();setAll1Drag(false);addAll1Files(e.dataTransfer.files);}}
          >
            <span style={{fontSize:"16px"}}>📎</span>
            <span style={{...SANS,fontSize:"11px",color:TM}}>Trascina o clicca · immagine o PDF del formulario annunci</span>
          </div>
        </div>

        {/* ── Allegato 2 upload ── */}
        <div style={{padding:"10px 14px",borderTop:`1px solid ${GB}`,background:"#fafbfd"}}>
          <div style={{...SANS,fontSize:"11px",fontWeight:"700",color:N,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"7px"}}>📂 Allegato 2 – Piantine</div>
          <input ref={all2Ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv" multiple style={{display:"none"}} onChange={e=>addAll2Files(e.target.files)}/>
          {(data.allegato2Files||[]).map(f=>(
            <div key={f.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 0",...SANS,fontSize:"11px"}}>
              <span>{f.type.startsWith("image/")?"🖼️":f.type==="application/pdf"?"📄":"📊"}</span>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:TX}}>{f.name}</span>
              <button onClick={()=>removeAll2(f.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:"16px",padding:0,lineHeight:1}}>×</button>
            </div>
          ))}
          <div
            style={{border:`1px dashed ${all2Drag?N:GB}`,borderRadius:"6px",padding:"8px 12px",cursor:"pointer",background:all2Drag?"#eef2f9":WH,display:"flex",alignItems:"center",gap:"8px",marginTop:"4px",transition:"all 0.2s"}}
            onClick={()=>all2Ref.current.click()}
            onDragEnter={e=>{e.preventDefault();e.stopPropagation();setAll2Drag(true);}}
            onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
            onDragLeave={e=>{e.preventDefault();e.stopPropagation();setAll2Drag(false);}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();setAll2Drag(false);addAll2Files(e.dataTransfer.files);}}
          >
            <span style={{fontSize:"16px"}}>📎</span>
            <span style={{...SANS,fontSize:"11px",color:TM}}>Trascina o clicca · PDF, JPG, PNG, DOCX, Excel…</span>
          </div>
        </div>

        {/* Area input */}
        <div style={{padding:"12px 14px",borderTop:`1px solid ${GB}`,background:WH}}>
          {err&&<div style={{...SANS,fontSize:"11px",color:RD,marginBottom:"8px",background:"#fff0f0",padding:"6px 9px",borderRadius:"5px"}}>⚠ {err}</div>}
          <div style={{...SANS,fontSize:"11px",color:TM,lineHeight:1.55,marginBottom:"10px",padding:"8px 10px",background:GL,borderRadius:"6px",border:`1px solid ${GB}`}}>
            💡 Puoi chiedere all&apos;AI di riscrivere o integrare qualsiasi sezione — es: &quot;riscrivi il capitolo 3 aggiungendo una procedura per eventi con più di 500 persone&quot;.
          </div>
          <textarea
            value={msg} onChange={e=>setMsg(e.target.value)}
            placeholder={"es. Cambia le date al 15-16 marzo 2026\nes. Aggiungi agente domenica ore 14-22\nes. Il nuovo capo impiego è M. Rossi\n\nCtrl+Invio per applicare"}
            rows={5}
            style={{...SANS,width:"100%",boxSizing:"border-box",padding:"9px 11px",border:`1px solid ${GB}`,borderRadius:"7px",fontSize:"12px",color:TX,resize:"none",outline:"none",lineHeight:1.6,background:WH}}
            onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();applyEdit();}}}
          />

          {/* Drop zone allegati */}
          <div
            style={dropBase(addDrag)}
            onClick={()=>addRef.current.click()}
            onDragEnter={e=>{e.preventDefault();e.stopPropagation();setAddDrag(true);}}
            onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
            onDragLeave={e=>{e.preventDefault();e.stopPropagation();setAddDrag(false);}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();setAddDrag(false);addFiles(e.dataTransfer.files);}}
          >
            <span style={{fontSize:"18px"}}>📎</span>
            <span style={{...SANS,fontSize:"11px",color:TM}}>Allega PDF, piantine, immagini…</span>
          </div>
          <input ref={addRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>

          <button
            onClick={applyEdit}
            disabled={loading||(!msg.trim()&&attachments.length===0)}
            style={{...SANS,width:"100%",marginTop:"8px",padding:"10px",background:loading||(!msg.trim()&&attachments.length===0)?"#ccc":N,color:WH,border:"none",borderRadius:"7px",cursor:loading||(!msg.trim()&&attachments.length===0)?"not-allowed":"pointer",fontSize:"13px",fontWeight:"700",letterSpacing:"0.03em",transition:"background 0.2s"}}
          >
            {loading?"⏳  Applicazione in corso…":"⚡  Applica Modifiche"}
          </button>
          <div style={{...SANS,fontSize:"10px",color:"#bbb",textAlign:"center",marginTop:"5px"}}>Ctrl+Invio per applicare rapidamente</div>
        </div>
      </div>

      {/* ── PANNELLO DESTRO – Anteprima ── */}
      <div
        id="delta-right-panel"
        style={{flex:1,overflowY:"auto",background:"#e8ecf2",padding:"20px 24px",position:"relative"}}
        onDragEnter={e=>{e.preventDefault();e.stopPropagation();rightDragCount.current++;setRightDrag(true);}}
        onDragLeave={e=>{e.preventDefault();e.stopPropagation();rightDragCount.current--;if(rightDragCount.current<=0){rightDragCount.current=0;setRightDrag(false);}}}
        onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
        onDrop={e=>{e.preventDefault();e.stopPropagation();rightDragCount.current=0;setRightDrag(false);addAll2Files(e.dataTransfer.files);}}
      >
        {/* Overlay drag-and-drop su tutta l'anteprima */}
        {rightDrag&&(
          <div style={{position:"absolute",inset:0,zIndex:50,background:"rgba(12,29,61,0.82)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:"0",pointerEvents:"none"}}>
            <div style={{fontSize:"56px",marginBottom:"16px"}}>📎</div>
            <div style={{...SANS,fontSize:"20px",fontWeight:"700",color:WH,marginBottom:"8px"}}>Rilascia per aggiungere all'Allegato 2</div>
            <div style={{...SANS,fontSize:"13px",color:"rgba(255,255,255,0.72)"}}>PDF, JPG, PNG, DOCX, Excel — più file contemporaneamente</div>
          </div>
        )}
        {loading&&(
          <div style={{position:"sticky",top:0,zIndex:10,background:"#fff8e1",border:`1px solid #ffe082`,borderRadius:"8px",padding:"9px 16px",marginBottom:"14px",...SANS,fontSize:"12px",color:"#795548",display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{fontSize:"16px"}}>⏳</span> Aggiornamento documento in corso…
          </div>
        )}
        <DocPreview data={data} customSections={customSections} sectionOrder={sectionOrder} presetOverrides={presetOverrides} presetDeletedItems={presetDeletedItems} presetSubOrder={presetSubOrder} />
      </div>

      {presetEditOpen && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={()=>setPresetEditOpen(false)}>
          <div style={{background:WH,borderRadius:"12px",maxWidth:"720px",width:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 50px rgba(0,0,0,0.2)",...SANS}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${GB}`,background:GL,fontWeight:"700",fontSize:"14px",color:N}}>
              Modifica sezione preset — {PRESET_SECTION_SHORT[presetEditKey] || ALL12_SHORT[presetEditKey] || presetEditKey}
            </div>
            <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <div style={{fontSize:"11px",color:GR,lineHeight:1.5}}>
                Modifica il testo della sezione. Separa i paragrafi con una riga vuota. Il testo modificato sostituirà il contenuto preset solo in stampa. Premi "Ripristina" per tornare al preset originale.
              </div>
              <textarea
                value={presetEditDraft}
                onChange={(e) => setPresetEditDraft(e.target.value)}
                rows={16}
                spellCheck
                style={{...inp,width:"100%",boxSizing:"border-box",resize:"vertical",fontSize:"13px",lineHeight:1.6}}
              />
              {getPresetItemsOrdered(presetEditKey).length > 0 && (() => {
                const orderedItems = getPresetItemsOrdered(presetEditKey);
                const subItems = orderedItems.filter((r) => /^\d+\.\d+$/.test(String(r.n).trim()));
                const mainItem = orderedItems.find((r) => /^\d+$/.test(String(r.n).trim()));
                const isPs = /^ps[1-6]$/.test(presetEditKey);
                return (
                  <div style={{border:`1px solid ${GB}`,borderRadius:"8px",padding:"10px 12px",background:GL}}>
                    <div style={{fontSize:"11px",fontWeight:"700",color:N,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>
                      Riordina o elimina punti — i rimanenti vengono rinumerati
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                      {mainItem && (() => {
                        const itemN = String(mainItem.n);
                        const isDeleted = (presetDeletedItems[presetEditKey] || []).includes(itemN);
                        return (
                          <label key={itemN} style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",cursor:"pointer",color:isDeleted?GR:TX,textDecoration:isDeleted?"line-through":"none"}}>
                            <span style={{width:"50px"}}/>
                            <input
                              type="checkbox"
                              checked={isDeleted}
                              onChange={() => togglePresetItemDeleted(presetEditKey, itemN)}
                            />
                            <span style={{minWidth:"36px",fontWeight:"700",color:isDeleted?GR:N}}>{itemN}</span>
                            <span style={{fontWeight:"600"}}>{mainItem.t}</span>
                          </label>
                        );
                      })()}
                      {subItems.map((item, i) => {
                        const itemN = String(item.n);
                        const isDeleted = (presetDeletedItems[presetEditKey] || []).includes(itemN);
                        const canUp = isPs && i > 0;
                        const canDown = isPs && i < subItems.length - 1;
                        return (
                          <div key={itemN} style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",color:isDeleted?GR:TX,textDecoration:isDeleted?"line-through":"none"}}>
                            {isPs ? (
                              <>
                                <button type="button" onClick={()=>movePresetSub(presetEditKey,itemN,-1)} disabled={!canUp} style={{background:!canUp?"#eee":WH,border:`1px solid ${GB}`,borderRadius:"4px",cursor:!canUp?"not-allowed":"pointer",padding:"2px 6px",fontSize:"10px"}} title="Su">▲</button>
                                <button type="button" onClick={()=>movePresetSub(presetEditKey,itemN,1)} disabled={!canDown} style={{background:!canDown?"#eee":WH,border:`1px solid ${GB}`,borderRadius:"4px",cursor:!canDown?"not-allowed":"pointer",padding:"2px 6px",fontSize:"10px"}} title="Giù">▼</button>
                              </>
                            ) : (
                              <span style={{width:"50px"}}/>
                            )}
                            <input
                              type="checkbox"
                              checked={isDeleted}
                              onChange={() => togglePresetItemDeleted(presetEditKey, itemN)}
                            />
                            <span style={{minWidth:"36px",fontWeight:"600",color:isDeleted?GR:N}}>{itemN}</span>
                            <span>{item.t}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div style={{display:"flex",gap:"10px",marginTop:"4px"}}>
                <button type="button" onClick={resetPresetEdit} style={{flex:1,padding:"10px",background:WH,border:`1px solid ${GB}`,borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"600",color:AC}}>Ripristina preset</button>
                <button type="button" onClick={()=>setPresetEditOpen(false)} style={{flex:1,padding:"10px",background:WH,border:`1px solid ${GB}`,borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"600",color:TM}}>Annulla</button>
                <button type="button" onClick={savePresetEdit} style={{flex:1,padding:"10px",background:N,color:WH,border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"600"}}>Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {secModalOpen && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={()=>{setSecModalOpen(false);setSecModalEditingId(null);}}>
          <div style={{background:WH,borderRadius:"12px",maxWidth:"420px",width:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 50px rgba(0,0,0,0.2)",...SANS}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${GB}`,background:GL,fontWeight:"700",fontSize:"14px",color:N}}>{secModalEditingId?"Modifica sezione":"Aggiungi sezione"}</div>
            <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:"12px"}}>
              <div>
                <div style={{fontSize:"11px",fontWeight:"700",color:TM,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tipo</div>
                <label style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",cursor:"pointer",fontSize:"13px"}}>
                  <input type="radio" name="sectype" checked={newSecType==="capitolo"} onChange={()=>setNewSecType("capitolo")} /> Capitolo
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",cursor:"pointer",fontSize:"13px"}}>
                  <input type="radio" name="sectype" checked={newSecType==="sottocapitolo"} onChange={()=>setNewSecType("sottocapitolo")} /> Sotto Capitolo
                </label>
                <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",fontSize:"13px"}}>
                  <input type="radio" name="sectype" checked={newSecType==="allegato"} onChange={()=>setNewSecType("allegato")} /> Allegato
                </label>
              </div>
              {newSecType==="sottocapitolo" && (
                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:TM,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Capitolo padre</div>
                  <select value={newSecParentKey} onChange={(e)=>setNewSecParentKey(e.target.value)} style={{...inp,cursor:"pointer",width:"100%",boxSizing:"border-box"}}>
                    {parentCapitoloOptions.map((o)=>(
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <div style={{fontSize:"11px",fontWeight:"700",color:TM,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Titolo</div>
                <input value={newSecTitle} onChange={e=>setNewSecTitle(e.target.value)} placeholder="Titolo sezione" style={{...inp,width:"100%",boxSizing:"border-box"}} />
              </div>
              {(newSecType==="capitolo" || newSecType==="sottocapitolo") && (
                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:TM,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Contenuto (opzionale)</div>
                  <textarea value={newSecContent} onChange={e=>setNewSecContent(e.target.value)} placeholder="Testo da stampare nella sezione…" rows={5} style={{...inp,width:"100%",boxSizing:"border-box",resize:"vertical"}} />
                  <button type="button" onClick={generateSecAI} disabled={newSecAILoading||!newSecTitle.trim()} style={{...SANS,marginTop:"8px",padding:"8px 12px",background:newSecAILoading||!newSecTitle.trim()?"#ccc":NM,color:WH,border:"none",borderRadius:"6px",cursor:newSecAILoading||!newSecTitle.trim()?"not-allowed":"pointer",fontSize:"12px",fontWeight:"600",width:"100%"}}>
                    {newSecAILoading?"⏳ Generazione…":"✨ Genera contenuto con AI"}
                  </button>
                </div>
              )}
              {newSecType==="allegato" && (
                <div>
                  <div style={{fontSize:"11px",fontWeight:"700",color:TM,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>File immagine o PDF (opzionale)</div>
                  <input ref={secModalFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" style={{fontSize:"12px",width:"100%"}} />
                  <div style={{fontSize:"10px",color:GR,marginTop:"4px"}}>
                    {secModalEditingId ? "Lascia vuoto per mantenere il file attuale. Carica un nuovo file per sostituirlo." : "Puoi lasciare solo titolo e testo senza allegare file."}
                  </div>
                  <div style={{marginTop:"10px"}}>
                    <div style={{fontSize:"11px",fontWeight:"700",color:TM,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Testo / note (opzionale)</div>
                    <textarea value={newSecContent} onChange={e=>setNewSecContent(e.target.value)} rows={4} style={{...inp,width:"100%",boxSizing:"border-box",resize:"vertical"}} />
                  </div>
                  <button type="button" onClick={generateSecAI} disabled={newSecAILoading||!newSecTitle.trim()} style={{...SANS,marginTop:"8px",padding:"8px 12px",background:newSecAILoading||!newSecTitle.trim()?"#ccc":NM,color:WH,border:"none",borderRadius:"6px",cursor:newSecAILoading||!newSecTitle.trim()?"not-allowed":"pointer",fontSize:"12px",fontWeight:"600",width:"100%"}}>
                    {newSecAILoading?"⏳ Generazione…":"✨ Genera contenuto con AI"}
                  </button>
                </div>
              )}
              <div style={{display:"flex",gap:"10px",marginTop:"4px"}}>
                <button type="button" onClick={()=>{setSecModalOpen(false);setSecModalEditingId(null);}} style={{flex:1,padding:"10px",background:WH,border:`1px solid ${GB}`,borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"600",color:TM}}>Annulla</button>
                <button type="button" onClick={submitSectionModal} style={{flex:1,padding:"10px",background:N,color:WH,border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"13px",fontWeight:"600"}}>{secModalEditingId?"Salva":"Aggiungi"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsModalOpen && settingsDraft && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={()=>setSettingsModalOpen(false)}>
          <div style={{background:WH,borderRadius:"12px",maxWidth:"760px",width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 50px rgba(0,0,0,0.2)",...SANS}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${GB}`,background:GL,fontWeight:"700",fontSize:"14px",color:N,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>⚙️ Modifica impostazioni evento</span>
              <button type="button" onClick={()=>setSettingsModalOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:TM,padding:0,lineHeight:1}} title="Chiudi">×</button>
            </div>
            <div style={{padding:"16px 18px",overflowY:"auto",flex:1}}>
              <div style={{...SANS,fontSize:"11px",color:GR,marginBottom:"14px",lineHeight:1.6}}>
                Modifica i campi del form iniziale. Al salvataggio le modifiche verranno applicate al documento in tempo reale tramite l'AI.
              </div>
              <StepBar steps={STEPS.slice(0,4)} cur={settingsStep}/>
              {settingsStep===0 && <Step0 f={settingsDraft} u={updateSettingsDraft}/>}
              {settingsStep===1 && <Step1 f={settingsDraft} u={updateSettingsDraft}/>}
              {settingsStep===2 && <Step2 f={settingsDraft} u={updateSettingsDraft}/>}
              {settingsStep===3 && <Step3 f={settingsDraft} u={updateSettingsDraft}/>}
            </div>
            <div style={{padding:"12px 18px",borderTop:`1px solid ${GB}`,background:"#fafbfd",display:"flex",gap:"10px",alignItems:"center"}}>
              <button type="button" onClick={()=>setSettingsStep(Math.max(0,settingsStep-1))} disabled={settingsStep===0} style={{padding:"9px 14px",background:WH,border:`1px solid ${GB}`,borderRadius:"7px",cursor:settingsStep===0?"not-allowed":"pointer",fontSize:"13px",fontWeight:"600",color:settingsStep===0?GR:TM}}>← Precedente</button>
              {settingsStep<3 && (
                <button type="button" onClick={()=>setSettingsStep(settingsStep+1)} style={{padding:"9px 14px",background:WH,border:`1px solid ${GB}`,borderRadius:"7px",cursor:"pointer",fontSize:"13px",fontWeight:"600",color:N}}>Avanti →</button>
              )}
              <div style={{flex:1}}/>
              <button type="button" onClick={()=>setSettingsModalOpen(false)} style={{padding:"9px 14px",background:WH,border:`1px solid ${GB}`,borderRadius:"7px",cursor:"pointer",fontSize:"13px",fontWeight:"600",color:TM}}>Annulla</button>
              <button type="button" onClick={applyEventSettings} disabled={loading} style={{padding:"9px 18px",background:loading?"#ccc":AC,color:WH,border:"none",borderRadius:"7px",cursor:loading?"not-allowed":"pointer",fontSize:"13px",fontWeight:"700"}}>{loading?"⏳ Applicazione…":"💾 Salva e applica"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PPS: hub e scelta nuova ───────────────────────────────────────────────────
function HubCard({ icon, title, subtitle, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        ...SANS, background: WH, border: `1px solid ${h ? AC : "#E5E7EB"}`,
        borderRadius: "12px", padding: "32px", width: "280px", maxWidth: "100%",
        cursor: "pointer", transition: "all 0.15s",
        boxShadow: h ? "0 8px 24px rgba(30,64,175,0.12)" : "0 2px 8px rgba(12,29,61,0.06)",
      }}
    >
      <div style={{ fontSize: "34px", marginBottom: "12px" }}>{icon}</div>
      <div style={{ fontSize: "17px", fontWeight: 700, color: N, marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: TM, lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );
}

function PpsHome({ onArchivio, onNuova, onBack, isMobile = false }) {
  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "40px 20px" }}>
      <div style={{ maxWidth: "660px", margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...SANS, background: "none", border: "none", cursor: "pointer", color: TM, fontSize: "12.5px", fontWeight: 600, padding: 0, marginBottom: "10px" }}>
          ← Home › <span style={{ color: N, fontWeight: 700 }}>PPS</span>
        </button>
        <h1 style={{ ...SERIF, fontSize: "26px", fontWeight: 700, color: N, margin: "0 0 6px" }}>Prescrizioni Particolari di Servizio</h1>
        <div style={{ ...SANS, fontSize: "13px", color: TM, marginBottom: "28px" }}>Scegli cosa fare</div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "24px", justifyContent: "center", alignItems: "center" }}>
          <HubCard icon="📁" title="Archivio PPS" subtitle="Consulta e gestisci le PPS esistenti" onClick={onArchivio} />
          <HubCard icon="✨" title="Nuova PPS" subtitle="Crea o importa una nuova PPS" onClick={onNuova} />
        </div>
      </div>
    </div>
  );
}

function PpsNewChoice({ onImporta, onNuova, onBack, isMobile = false }) {
  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: BG, padding: "40px 20px" }}>
      <div style={{ maxWidth: "660px", margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...SANS, background: "none", border: "none", cursor: "pointer", color: TM, fontSize: "12.5px", fontWeight: 600, padding: 0, marginBottom: "10px" }}>
          ← Home › <span style={{ color: N, fontWeight: 700 }}>PPS</span>
        </button>
        <h1 style={{ ...SERIF, fontSize: "26px", fontWeight: 700, color: N, margin: "0 0 6px" }}>Nuova PPS</h1>
        <div style={{ ...SANS, fontSize: "13px", color: TM, marginBottom: "28px" }}>Come vuoi creare la PPS?</div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "24px", justifyContent: "center", alignItems: "center" }}>
          <HubCard icon="📄" title="Importa documento" subtitle="Carica un PDF o DOCX esistente — il sistema estrae i dati e pre-compila la PPS" onClick={onImporta} />
          <HubCard icon="✏️" title="Crea da zero" subtitle="Compila manualmente il wizard in 7 step" onClick={onNuova} />
        </div>
      </div>
    </div>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function LandingHome({ onCs, onPps, isAdmin = false, isMobile = false }) {
  const [hov1, setHov1] = useState(false);
  const [hov2, setHov2] = useState(false);
  const [ww, setWw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  React.useEffect(() => {
    const onResize = () => setWw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const cols = (!isAdmin || ww < 700) ? "1fr" : "1fr 1fr";
  const gridMax = isAdmin ? "900px" : "440px";
  const sidePad = isMobile ? "16px" : "40px";

  const cardBase = {
    background:"#fff", borderRadius:"20px", padding:"48px 32px",
    boxShadow:"0 4px 24px rgba(30,58,138,0.07)", cursor:"pointer",
    display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", gap:"20px",
    transition:"all 0.2s",
  };
  const cardHover = { boxShadow:"0 8px 32px rgba(30,58,138,0.14)", transform:"translateY(-3px)" };
  const iconCircle = { width:"80px", height:"80px", borderRadius:"50%", background:"#E8EEFF", display:"flex", alignItems:"center", justifyContent:"center" };
  const titleS = { ...SANS, fontSize:"22px", fontWeight:"700", color:"#1E3A8A" };
  const lineS = { width:"40px", height:"3px", background:"#1E40AF", borderRadius:"2px" };
  const descS = { ...SANS, fontSize:"14px", color:"#64748B", lineHeight:1.7, maxWidth:"240px" };
  const arrowCircle = { width:"48px", height:"48px", borderRadius:"50%", background:"#1E40AF", display:"flex", alignItems:"center", justifyContent:"center", marginTop:"8px" };

  return (
    <div style={{minHeight:"100vh",background:"#EEF2FF",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
      <div style={{textAlign:"center",paddingTop:"60px"}}>
        <div style={{...SANS,fontSize:isMobile?"20px":"28px",fontWeight:"700",letterSpacing:"0.2em",color:"#1E3A8A",marginBottom:"8px"}}>PIATTAFORMA OPERATIVA</div>
        <div style={{...SANS,fontSize:"14px",color:"#94A3B8",letterSpacing:"0.05em"}}>DELTAgroup Ticino</div>
      </div>

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={isMobile
          ? {display:"flex",flexDirection:"column",gap:"20px",maxWidth:gridMax,width:"100%",padding:"0 16px"}
          : {display:"grid",gridTemplateColumns:cols,gap:"32px",maxWidth:gridMax,width:"100%",padding:"0 40px"}}>
          {/* CARD CS — solo admin */}
          {isAdmin && (
          <div onClick={onCs} onMouseEnter={()=>setHov1(true)} onMouseLeave={()=>setHov1(false)} style={{...cardBase,...(hov1?cardHover:{})}}>
            <div style={iconCircle}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#1E40AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <rect x="9" y="11" width="6" height="5" rx="1"/>
                <path d="M12 8v3"/>
                <circle cx="12" cy="11" r="0.5" fill="#1E40AF"/>
              </svg>
            </div>
            <div style={titleS}>Concetti di Sicurezza</div>
            <div style={lineS}/>
            <div style={descS}>Gestione completa dei concetti di sicurezza per eventi e servizi</div>
            <div style={arrowCircle}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="13 6 19 12 13 18"/>
              </svg>
            </div>
          </div>
          )}
          {/* CARD PPS */}
          <div onClick={onPps} onMouseEnter={()=>setHov2(true)} onMouseLeave={()=>setHov2(false)} style={{...cardBase,...(hov2?cardHover:{})}}>
            <div style={iconCircle}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#1E40AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <polyline points="9 15 11 17 15 13"/>
              </svg>
            </div>
            <div style={titleS}>PPS</div>
            <div style={lineS}/>
            <div style={descS}>Prescrizioni Particolari di Servizio per ogni attività operativa</div>
            <div style={arrowCircle}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="13 6 19 12 13 18"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div style={{borderTop:"1px solid #D1D9F0",padding:`20px ${sidePad}`,textAlign:"center",fontSize:"11.5px",color:"#94A3B8",...SANS}}>
        DELTAgroup Security &amp; Services AG · Via alla Foce 4, 6933 Muzzano · T +41 91 921 49 49 · TICINO@delta.ch
      </div>
    </div>
  );
}

// ── HOME CS (stile LandingHome) ───────────────────────────────────────────────
function CsHome({ onNew, onMod, onBack, onArchive, isMobile = false }) {
  const [hov1, setHov1] = useState(false);
  const [hov2, setHov2] = useState(false);

  const cardBase = {
    background:"#fff", borderRadius:"20px", padding:"48px 32px",
    boxShadow:"0 4px 24px rgba(30,58,138,0.07)", cursor:"pointer",
    display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", gap:"20px",
    transition:"all 0.2s",
  };
  const cardHover = { boxShadow:"0 8px 32px rgba(30,58,138,0.14)", transform:"translateY(-3px)" };
  const iconCircle = { width:"80px", height:"80px", borderRadius:"50%", background:"#E8EEFF", display:"flex", alignItems:"center", justifyContent:"center" };
  const titleS = { ...SANS, fontSize:"22px", fontWeight:"700", color:"#1E3A8A" };
  const lineS = { width:"40px", height:"3px", background:"#1E40AF", borderRadius:"2px" };
  const descS = { ...SANS, fontSize:"14px", color:"#64748B", lineHeight:1.7, maxWidth:"240px" };
  const arrowCircle = { width:"48px", height:"48px", borderRadius:"50%", background:"#1E40AF", display:"flex", alignItems:"center", justifyContent:"center", marginTop:"8px" };

  return (
    <div style={{minHeight:"calc(100vh - 60px)",background:"#EEF2FF",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
      <div style={{padding:"20px 40px 0"}}>
        <button onClick={onBack} style={{...SANS,background:"none",border:"none",cursor:"pointer",color:"#1E40AF",fontSize:"13px",fontWeight:"700",padding:"6px 4px"}}>← Home</button>
      </div>

      <div style={{textAlign:"center",paddingTop:"8px"}}>
        <div style={{...SANS,fontSize:"24px",fontWeight:"700",letterSpacing:"0.12em",color:"#1E3A8A",marginBottom:"8px"}}>Concetti di Sicurezza</div>
        <div style={{...SANS,fontSize:"14px",color:"#94A3B8",letterSpacing:"0.05em"}}>DELTAgroup Ticino</div>
      </div>

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={isMobile
          ? {display:"flex",flexDirection:"column",gap:"20px",maxWidth:"900px",width:"100%",padding:"0 16px"}
          : {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"32px",maxWidth:"900px",width:"100%",padding:"0 40px"}}>
          {/* CARD 1 — Nuovo Concetto */}
          <div onClick={onNew} onMouseEnter={()=>setHov1(true)} onMouseLeave={()=>setHov1(false)} style={{...cardBase,...(hov1?cardHover:{})}}>
            <div style={iconCircle}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#1E40AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="12" x2="12" y2="18"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <div style={titleS}>Nuovo Concetto</div>
            <div style={lineS}/>
            <div style={descS}>Crea un nuovo concetto di sicurezza partendo dai dati dell'evento</div>
            <div style={arrowCircle}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="13 6 19 12 13 18"/>
              </svg>
            </div>
          </div>
          {/* CARD 2 — Modifica Esistente */}
          <div onClick={onMod} onMouseEnter={()=>setHov2(true)} onMouseLeave={()=>setHov2(false)} style={{...cardBase,...(hov2?cardHover:{})}}>
            <div style={iconCircle}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#1E40AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
            </div>
            <div style={titleS}>Modifica Esistente</div>
            <div style={lineS}/>
            <div style={descS}>Carica un concetto esistente e applica modifiche guidate dall'AI</div>
            <div style={arrowCircle}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="13 6 19 12 13 18"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div style={{textAlign:"center",paddingBottom:"4px"}}>
        <button onClick={onArchive} style={{...SANS,background:"transparent",border:"1px solid #1E40AF",color:"#1E40AF",borderRadius:"9px",padding:"10px 22px",fontSize:"14px",fontWeight:"700",cursor:"pointer"}}>📂 Apri Archivio</button>
      </div>

      <div style={{borderTop:"1px solid #D1D9F0",padding:"20px 40px",textAlign:"center",fontSize:"11.5px",color:"#94A3B8",...SANS}}>
        DELTAgroup Security &amp; Services AG · Via alla Foce 4, 6933 Muzzano · T +41 91 921 49 49 · TICINO@delta.ch
      </div>
    </div>
  );
}

// ── HEADER ────────────────────────────────────────────────────────────────────
function Header({ onHome, profilo, onLogout, onAdmin, isAdmin, isMobile = false }) {
  const nomeCompleto = String(profilo?.nome || profilo?.email || "");
  const iniziali = nomeCompleto
    .trim()
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";
  return (
    <div style={{
      background:"#111827", padding:"0 20px", height:"60px",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      borderBottom:`3px solid ${AC}`,position:"sticky",top:0,zIndex:100,
      boxShadow:"0 2px 12px rgba(0,0,0,0.4)",
    }}>
      <button onClick={onHome} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",padding:0}}>
        {/* Logo triangolo DELTAgroup */}
        <div style={{width:"40px",height:"40px",borderRadius:"9px",background:"#1E40AF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg viewBox="0 0 512 512" width="26" height="26">
            <polygon points="256,92 422,402 90,402" fill="none" stroke="#fff" strokeWidth="52" strokeLinejoin="round"/>
          </svg>
        </div>
        {/* Nome app */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"1px"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:"0px"}}>
            <span style={{...SERIF,fontSize:"18px",fontWeight:"700",color:WH,letterSpacing:"0.04em"}}>DELTA</span>
            <span style={{...SERIF,fontSize:"14px",fontWeight:"400",color:"rgba(255,255,255,0.85)"}}>group</span>
            <span style={{...SANS,fontSize:"18px",fontWeight:"700",color:AC,marginLeft:"6px",letterSpacing:"0.06em"}}>CS — PPS</span>
          </div>
          <div style={{...SANS,fontSize:"9px",color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.14em"}}>
            Ticino · v3.0
          </div>
        </div>
      </button>
      <div style={{display:"flex",alignItems:"center",gap:isMobile?"10px":"14px"}}>
        {!isMobile && (
          <span style={{...SANS,fontSize:"10px",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Security &amp; Services AG</span>
        )}
        {isAdmin && (
          <button onClick={onAdmin} style={{...SANS,fontSize:"11px",fontWeight:"700",color:"rgba(255,255,255,0.85)",background:"none",border:"none",cursor:"pointer"}} title="Gestione utenti">{isMobile ? "⚙" : "⚙ Utenti"}</button>
        )}
        {profilo && (
          <span style={{...SANS,fontSize:"11px",color:"rgba(255,255,255,0.6)",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={profilo.email||""}>
            {isMobile ? iniziali : nomeCompleto.slice(0,20)}
          </span>
        )}
        <button onClick={onLogout} style={{...SANS,fontSize:"11px",fontWeight:"700",color:WH,background:"transparent",border:"1px solid rgba(255,255,255,0.5)",borderRadius:"6px",padding:"5px 12px",cursor:"pointer"}}>Esci</button>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setErr(null); setLoading(true);
    try {
      if (!supabase.auth || typeof supabase.auth.signInWithPassword !== "function") {
        throw new Error("Autenticazione non disponibile (Supabase non configurato).");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onLogin?.();
    } catch (e2) {
      setErr("Credenziali non valide. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const inp = { width:"100%", padding:"11px 12px", border:`1px solid ${GB}`, borderRadius:"9px", fontSize:"14px", color:N, background:WH, outline:"none", ...SANS, boxSizing:"border-box", marginBottom:"12px" };

  return (
    <div style={{minHeight:"100vh",background:"#EEF2FF",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <form onSubmit={submit} style={{background:WH,borderRadius:"20px",padding:"40px 34px",boxShadow:"0 8px 32px rgba(30,58,138,0.12)",width:"100%",maxWidth:"380px",textAlign:"center"}}>
        <img src={logoImg} alt="DELTAgroup" style={{maxWidth:"200px",width:"100%",height:"auto",marginBottom:"20px"}}/>
        <div style={{...SANS,fontSize:"18px",fontWeight:"700",color:"#0c1d3d",marginBottom:"4px"}}>CS — PPS · Accesso riservato</div>
        <div style={{...SANS,fontSize:"13px",color:"#94A3B8",marginBottom:"24px"}}>DELTAgroup Ticino</div>
        <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" autoComplete="username" style={inp}/>
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" style={inp}/>
        {err && <div style={{...SANS,fontSize:"12.5px",color:RD,marginBottom:"12px"}}>{err}</div>}
        <button type="submit" disabled={loading} style={{...SANS,width:"100%",padding:"12px",background:loading?"#9bb0e0":AC,color:WH,border:"none",borderRadius:"9px",fontSize:"14px",fontWeight:"700",cursor:loading?"wait":"pointer"}}>
          {loading ? "Accesso…" : "Accedi"}
        </button>
      </form>
    </div>
  );
}

// ── PANNELLO ADMIN ─────────────────────────────────────────────────────────────
function AdminPanel({ onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    const { data, error } = await supabase.from("profili").select("*").order("email");
    if (error) { setErr(`Errore nel caricamento dei profili: ${error.message}`); setRows([]); }
    else setRows(data || []);
    setLoading(false);
  };
  React.useEffect(() => { load(); }, []);

  // Attività recenti PPS (audit log)
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditErr, setAuditErr] = useState(null);
  React.useEffect(() => {
    (async () => {
      setAuditLoading(true); setAuditErr(null);
      const { data, error } = await supabase
        .from("pps_audit")
        .select("*, pps(codice, cliente)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) { setAuditErr(`Errore nel caricamento dell'attività: ${error.message}`); setAudit([]); }
      else setAudit(data || []);
      setAuditLoading(false);
    })();
  }, []);

  const fmtDataOra = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("it-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Form "Aggiungi utente"
  const [nNome, setNNome] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPass, setNPass] = useState("");
  const [nRuolo, setNRuolo] = useState("utente");
  const [creating, setCreating] = useState(false);

  const flash = (t) => { setMsg(t); };

  const updateProfilo = async (id, patch) => {
    setErr(null); setMsg(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("profili").update(patch).eq("id", id);
    if (error) { setErr(`Errore salvataggio: ${error.message}`); load(); }
    else flash("Salvato ✓");
  };

  const createUser = async () => {
    setErr(null); setMsg(null);
    if (!nEmail || !nPass) { setErr("Email e password obbligatorie."); return; }
    if (nPass.length < 8) { setErr("La password deve avere almeno 8 caratteri."); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nEmail, nome: nNome, password: nPass, ruolo: nRuolo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Errore nella creazione dell'utente");
      setMsg("Utente creato ✓");
      setNNome(""); setNEmail(""); setNPass(""); setNRuolo("utente");
      // Ricarica esplicita della lista utenti dopo la creazione.
      const { data: lista, error: loadErr } = await supabase.from("profili").select("*").order("email");
      if (loadErr) setErr(`Utente creato, ma ricarica lista fallita: ${loadErr.message}`);
      else setRows(lista || []);
    } catch (e) {
      setErr(`Errore: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const TH = { ...SANS, textAlign:"left", padding:"10px 12px", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:TM, borderBottom:`2px solid ${GB}`, whiteSpace:"nowrap" };
  const TD = { ...SANS, padding:"11px 12px", fontSize:"13px", color:N, borderBottom:`1px solid ${GL}` };
  const fInp = { ...SANS, padding:"9px 11px", border:`1px solid ${GB}`, borderRadius:"8px", fontSize:"14px", color:N, background:WH, outline:"none", boxSizing:"border-box", width:"100%" };

  return (
    <div style={{minHeight:"calc(100vh - 60px)",background:BG,padding:"32px 20px"}}>
      <div style={{maxWidth:"900px",margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}}>
          <h1 style={{...SERIF,fontSize:"26px",fontWeight:700,color:N,margin:0}}>Gestione Utenti</h1>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {msg && <span style={{...SANS,fontSize:"13px",fontWeight:700,color:"#16a34a"}}>{msg}</span>}
            <button onClick={onBack} style={{...SANS,padding:"9px 18px",border:`1px solid ${GB}`,borderRadius:"8px",background:WH,color:N,cursor:"pointer",fontWeight:700,fontSize:"13px"}}>← Indietro</button>
          </div>
        </div>

        <div style={{background:WH,border:`1px solid ${GB}`,borderRadius:"14px",padding:"8px",boxShadow:"0 2px 12px rgba(12,29,61,0.06)"}}>
          {err && <div style={{...SANS,margin:"12px",padding:"10px 12px",background:"#fdeced",border:`1px solid ${RD}55`,borderRadius:"8px",color:RD,fontSize:"12.5px"}}>{err}</div>}
          {loading ? (
            <div style={{...SANS,padding:"48px",textAlign:"center",color:TM,fontSize:"14px"}}>Caricamento in corso…</div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>
                  <th style={TH}>Email</th><th style={TH}>Nome</th><th style={TH}>Ruolo</th><th style={TH}>Attivo</th><th style={TH}>Azioni</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{...TD,fontWeight:600}}>{r.email || "—"}</td>
                      <td style={TD}>{r.nome || "—"}</td>
                      <td style={TD}>
                        <select value={r.ruolo || "utente"} onChange={(e)=>updateProfilo(r.id,{ruolo:e.target.value})}
                          style={{...SANS,padding:"6px 8px",border:`1px solid ${GB}`,borderRadius:"6px",fontSize:"13px",color:N,background:WH,cursor:"pointer"}}>
                          <option value="admin">admin</option>
                          <option value="utente">utente</option>
                        </select>
                      </td>
                      <td style={TD}>{r.attivo ? "Sì" : "No"}</td>
                      <td style={TD}>
                        <button onClick={()=>updateProfilo(r.id,{attivo:!r.attivo})}
                          style={{...SANS,padding:"6px 12px",borderRadius:"6px",border:`1px solid ${r.attivo?RD:GB}`,background:WH,color:r.attivo?RD:"#16a34a",cursor:"pointer",fontSize:"12px",fontWeight:700}}>
                          {r.attivo ? "Disattiva" : "Attiva"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Aggiungi nuovo utente */}
        <div style={{background:WH,border:`1px solid ${GB}`,borderRadius:"14px",padding:"18px 20px",marginTop:"18px",boxShadow:"0 2px 12px rgba(12,29,61,0.06)"}}>
          <div style={{...SANS,fontSize:"12px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:N,borderTop:`1px solid ${GB}`,paddingTop:"14px",marginBottom:"14px"}}>Aggiungi utente</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <input value={nNome} onChange={(e)=>setNNome(e.target.value)} placeholder="Nome" style={fInp}/>
            <input type="email" value={nEmail} onChange={(e)=>setNEmail(e.target.value)} placeholder="Email" style={fInp}/>
            <input type="password" value={nPass} onChange={(e)=>setNPass(e.target.value)} placeholder="Password temporanea (min 8 caratteri)" style={fInp}/>
            <select value={nRuolo} onChange={(e)=>setNRuolo(e.target.value)} style={{...fInp,cursor:"pointer"}}>
              <option value="utente">utente</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div style={{marginTop:"14px"}}>
            <button onClick={createUser} disabled={creating} style={{...SANS,padding:"11px 22px",background:creating?"#9bb0e0":AC,color:WH,border:"none",borderRadius:"9px",fontSize:"14px",fontWeight:700,cursor:creating?"wait":"pointer"}}>
              {creating ? "Creazione in corso…" : "Aggiungi"}
            </button>
          </div>
        </div>

        {/* ── Attività recenti PPS ─────────────────────────────────────────── */}
        <div style={{borderTop:`2px solid ${GB}`,marginTop:"32px",paddingTop:"24px"}}>
          <h2 style={{...SERIF,fontSize:"20px",fontWeight:700,color:N,margin:"0 0 16px"}}>📋 Attività recenti PPS</h2>
          <div style={{background:WH,border:`1px solid ${GB}`,borderRadius:"14px",padding:"8px",boxShadow:"0 2px 12px rgba(12,29,61,0.06)"}}>
            {auditErr && <div style={{...SANS,margin:"12px",padding:"10px 12px",background:"#fdeced",border:`1px solid ${RD}55`,borderRadius:"8px",color:RD,fontSize:"12.5px"}}>{auditErr}</div>}
            {auditLoading ? (
              <div style={{...SANS,padding:"40px",textAlign:"center",color:TM,fontSize:"14px"}}>Caricamento attività…</div>
            ) : audit.length === 0 ? (
              <div style={{...SANS,padding:"40px",textAlign:"center",color:TM,fontSize:"14px"}}>Nessuna attività registrata.</div>
            ) : (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={TH}>Data/Ora</th><th style={TH}>Utente</th><th style={TH}>Azione</th><th style={TH}>PPS</th>
                  </tr></thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td style={{...TD,whiteSpace:"nowrap",color:TM}}>{fmtDataOra(a.created_at)}</td>
                        <td style={TD}>{a.utente_email || "—"}</td>
                        <td style={{...TD,fontWeight:700,color:AC}}>{a.azione || "—"}</td>
                        <td style={TD}>
                          {a.pps
                            ? `${a.pps.codice || "(senza codice)"}${a.pps.cliente ? ` · ${a.pps.cliente}` : ""}`
                            : "—"}
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
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [doc, setDoc] = useState(null);
  const [ppsId, setPpsId] = useState(null);
  const [ppsInitial, setPpsInitial] = useState(null);
  const [ppsImportMissing, setPpsImportMissing] = useState(null);
  const [csDocId, setCsDocId] = useState(null);
  const [csLoadedContent, setCsLoadedContent] = useState(null);
  const [sessione, setSessione] = useState(undefined); // undefined = caricamento
  const [profilo, setProfilo] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  React.useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  // Prevenzione globale apertura file da drag fuori dalle dropzone
  React.useEffect(() => {
    const stop = (e) => e.preventDefault();
    document.addEventListener("dragover", stop);
    document.addEventListener("drop", stop);
    return () => { document.removeEventListener("dragover", stop); document.removeEventListener("drop", stop); };
  }, []);

  // ── Autenticazione (Supabase Auth) ──────────────────────────────────────────
  React.useEffect(() => {
    let active = true;
    const auth = supabase.auth;
    // Se l'auth non è disponibile (env Supabase mancanti / stub), mostra il login.
    if (!auth || typeof auth.getSession !== "function") { setSessione(null); return; }
    const caricaProfilo = async (userId) => {
      const { data } = await supabase.from("profili").select("*").eq("id", userId).single();
      if (!active) return;
      if (data && !data.attivo) {
        await supabase.auth.signOut();
        alert("Account disabilitato. Contatta l'amministratore.");
        return;
      }
      setProfilo(data);
    };
    auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setSessione(session);
      if (session) caricaProfilo(session.user.id);
    });
    const { data: sub } = auth.onAuthStateChange((_event, session) => {
      setSessione(session);
      if (session) caricaProfilo(session.user.id);
      else { setSessione(null); setProfilo(null); }
    });
    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  const isAdmin = profilo?.ruolo === "admin";

  // Gli utenti non-admin non possono accedere alle viste del modulo CS.
  React.useEffect(() => {
    if (profilo && !isAdmin) {
      const csViews = ["cs-home", "cs-list", "cs-load", "wizard", "modify", "preview", "admin"];
      if (csViews.includes(view)) setView("pps-home");
    }
  }, [profilo, isAdmin, view]);

  const done = (data) => { setDoc(data); setCsDocId(null); setCsLoadedContent(null); setView("preview"); };
  const logout = () => { supabase.auth?.signOut?.(); };

  if (sessione === undefined) {
    return <div style={{minHeight:"100vh",background:"#EEF2FF",display:"flex",alignItems:"center",justifyContent:"center",...SANS,color:"#52637a",fontSize:"15px"}}>Caricamento…</div>;
  }
  if (sessione === null) {
    return <LoginPage onLogin={()=>{}} />;
  }

  return (
    <div style={{minHeight:"100vh",background:BG}}>
      {view!=="home"&&<Header onHome={()=>setView("home")} profilo={profilo} onLogout={logout} onAdmin={()=>setView("admin")} isAdmin={isAdmin} isMobile={isMobile}/>}
      {view==="home"&&<LandingHome isAdmin={isAdmin} isMobile={isMobile} onCs={()=>setView("cs-home")} onPps={()=>setView("pps-home")}/>}
      {view==="admin"&&profilo?.ruolo==="admin"&&<AdminPanel onBack={()=>setView("home")}/>}
      {view==="cs-home"&&<CsHome isMobile={isMobile} onNew={()=>setView("wizard")} onMod={()=>setView("modify")} onBack={()=>setView("home")} onArchive={()=>setView("cs-list")}/>}
      {view==="wizard"&&<Wizard onBack={()=>setView("home")} onDone={done}/>}
      {view==="modify"&&<Modify onBack={()=>setView("home")} onDone={done}/>}
      {view==="cs-list"&&
        <CsList
          isMobile={isMobile}
          onNew={()=>{ setCsDocId(null); setCsLoadedContent(null); setView("cs-home"); }}
          onOpen={(id)=>{ setCsDocId(id); setView("cs-load"); }}
          onBack={()=>setView("home")}
        />}
      {view==="cs-load"&&
        <CsLoader
          id={csDocId}
          onBack={()=>setView("cs-list")}
          onLoaded={(row)=>{ setDoc(buildLoadedDataFromRow(row)); setCsLoadedContent(buildLoadedContentFromRow(row)); setCsDocId(row.id); setView("preview"); }}
        />}
      {view==="pps-home"&&
        <PpsHome
          isMobile={isMobile}
          onArchivio={()=>setView("pps-list")}
          onNuova={()=>setView("pps-new")}
          onBack={()=>setView("home")}
        />}
      {view==="pps-new"&&
        <PpsNewChoice
          isMobile={isMobile}
          onImporta={()=>setView("pps-import")}
          onNuova={()=>{ setPpsId(null); setPpsInitial(null); setPpsImportMissing(null); setView("pps-edit"); }}
          onBack={()=>setView("pps-home")}
        />}
      {view==="pps-import"&&
        <PpsImport
          isMobile={isMobile}
          onBack={()=>setView("pps-new")}
          onOpenWizard={(data, missing)=>{ setPpsId(null); setPpsInitial(data); setPpsImportMissing(missing); setView("pps-edit"); }}
        />}
      {view==="pps-list"&&
        <PpsList
          isMobile={isMobile}
          profilo={profilo}
          onNew={()=>{ setPpsId(null); setPpsInitial(null); setPpsImportMissing(null); setView("pps-new"); }}
          onOpen={(id)=>{ setPpsId(id); setPpsInitial(null); setPpsImportMissing(null); setView("pps-edit"); }}
          onBack={()=>setView("pps-home")}
        />}
      {view==="pps-edit"&&
        <PpsWizard
          ppsId={ppsId}
          initialData={ppsInitial}
          importMissing={ppsImportMissing}
          isMobile={isMobile}
          profilo={profilo}
          onBack={()=>setView("pps-home")}
          onSaved={(id)=>setPpsId(id)}
        />}
      {view==="preview"&&<Editor data={doc} onBack={()=>setView("home")} csDocId={csDocId} setCsDocId={setCsDocId} loadedContent={csLoadedContent}/>}
    </div>
  );
}

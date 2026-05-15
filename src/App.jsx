import React, { useState } from "react";
import logoImg from "./assets/logo.jpg";

// ── PALETTE ──────────────────────────────────────────────────────────────────
const N = "#0c1d3d";    // navy
const NM = "#1a3461";   // navy mid
const RD = "#c8102e";   // red (DELTAgroup brand)
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
const SYS_PROMPT = `Sei un esperto redattore di Concetti di Sicurezza per DELTAgroup Security & Services AG, Muzzano (Ticino). Tel: +41 919 214 949, TICINO@delta.ch. Crei documenti formali, professionali, in italiano.

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

// attachments = [{ data:base64, type:"application/pdf"|"image/jpeg"|..., name }]
async function callAI(userMsg, mainDoc=null, attachments=[], sysOverride=null) {
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: sysOverride||SYS_PROMPT,
      messages: [{ role: "user", content }]
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || "Errore API");
  let t = d.content[0].text.trim().replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();
  return JSON.parse(t);
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
        {label}{req&&<span style={{color:RD}}> *</span>}
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
    red:  {bg:RD,cl:WH},
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
              background:i<cur?N:i===cur?RD:GB,
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
          background:loading||!f.name?"#4a6490":RD, color:WH,
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
      onDone({...data, logoEvento: f.logoEvento||null});
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
    <div id={id} style={{marginBottom:"28px",breakInside:"avoid"}}>
      <div style={{background:N,color:WH,padding:"9px 16px",fontSize:"13px",fontWeight:"700",...SANS,borderRadius:"6px 6px 0 0"}}>{n}&nbsp;&nbsp;{t}</div>
      <div style={{border:`1px solid ${GB}`,borderTop:"none",borderRadius:"0 0 6px 6px",padding:"20px",background:WH}}>{children}</div>
    </div>
  );
}

function Dsub({ n, t, children }) {
  return (
    <div style={{marginBottom:"17px"}}>
      <div style={{fontWeight:"700",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.07em",textDecoration:"underline",color:N,marginBottom:"7px",...SANS}}>{n}&nbsp;{t}</div>
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

const isMain = (n) => /^\d+$/.test(n) || n.startsWith("All.");

function DocPreview({ data }) {
  return (
    <div id="doc-preview" style={{background:WH,borderRadius:"10px",border:`1px solid ${GB}`,padding:"0 0 0"}}>

      {/* ── CARTA INTESTATA HEADER ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"4px 32px",borderBottom:"2px solid #0c1d3d",background:"white"}}>
        <img src={logoImg} alt="DELTAgroup" style={{height:44,display:"block"}}/>
      </div>

      {/* ── COVER ── */}
      <div id="pc" style={{textAlign:"center",borderBottom:`3px solid ${RD}`,paddingBottom:"32px",marginBottom:"0",padding:"36px 48px 32px"}}>
        {data.logoEvento && (
          <div style={{marginBottom:"20px"}}>
            <img src={data.logoEvento} alt="logo evento" style={{maxHeight:"90px",maxWidth:"220px",objectFit:"contain"}}/>
          </div>
        )}
        <div style={{...SERIF,fontSize:"24px",fontWeight:"700",color:N,letterSpacing:"0.04em"}}>
          DELTA<sup style={{fontSize:"10px",color:RD,verticalAlign:"super",fontWeight:"700"}}>®</sup>
          <span style={{fontWeight:"400",fontSize:"16px"}}> group</span>
        </div>
        <div style={{...SANS,fontSize:"9px",color:GR,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"28px"}}>
          Security &amp; Services AG
        </div>
        <div style={{...SANS,fontSize:"13px",fontWeight:"700",color:N,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"12px"}}>
          Concetto di sicurezza
        </div>
        <div style={{...SERIF,fontSize:"26px",fontWeight:"700",color:N}}>{data.nomeEvento}</div>
        {data.luogo&&<div style={{...SANS,fontSize:"14px",color:TM,marginTop:"8px"}}>{data.luogo}</div>}
        {data.anno&&<div style={{...SANS,fontSize:"12px",color:TM}}>Edizione {data.anno}</div>}
      </div>

      {/* ── INDICE ── */}
      <div id="ptoc" style={{padding:"36px 48px",borderBottom:`1px solid ${GB}`}}>
        <div style={{...SANS,fontSize:"13px",fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.1em",color:N,marginBottom:"16px",borderBottom:`2px solid ${N}`,paddingBottom:"6px"}}>Indice</div>
        {TOC_ENTRIES.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"baseline",gap:"4px",marginBottom:isMain(e.n)?"6px":"2px",paddingLeft:isMain(e.n)?"0":"18px"}}>
            <span style={{...SANS,fontSize:isMain(e.n)?"12px":"11px",fontWeight:isMain(e.n)?"700":"400",color:isMain(e.n)?N:TX,minWidth:"46px"}}>{e.n}</span>
            <span style={{flex:1,borderBottom:"1px dotted #ccc",height:"1px",marginBottom:"3px"}}/>
            <span style={{...SANS,fontSize:isMain(e.n)?"12px":"11px",fontWeight:isMain(e.n)?"700":"400",color:isMain(e.n)?N:TX}}>{e.t}</span>
          </div>
        ))}
      </div>

      {/* ── BODY ── */}
      <div id="pbody" style={{padding:"36px 48px"}}>

      <div id="pbody-main">
      {/* S1 */}
      {data.s1&&(
        <Dsec id="ps1" n="1" t="Responsabilità">
          <table style={{width:"100%",borderCollapse:"collapse",marginBottom:"22px",fontSize:"11.5px",border:`1px solid ${GB}`}}>
            <thead>
              <tr>
                {["Aree","Società / Persona","Tel. Azienda / E-Mail","Tel. Mobile"].map(h=>(
                  <th key={h} style={{background:N,color:WH,padding:"8px 10px",textAlign:"left",...SANS,border:`1px solid ${NM}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.s1.contatti||[]).map((c,i)=>(
                <tr key={i} style={{background:i%2===0?WH:"#f9fbfd"}}>
                  <td style={{padding:"8px 10px",fontWeight:"700",color:N,...SANS,border:`1px solid ${GB}`}}>{c.area}</td>
                  <td style={{padding:"8px 10px",...SANS,border:`1px solid ${GB}`}}>{c.societa}</td>
                  <td style={{padding:"8px 10px",...SANS,color:"#1565c0",border:`1px solid ${GB}`}}>{c.email||c.telAzienda}</td>
                  <td style={{padding:"8px 10px",...SANS,border:`1px solid ${GB}`}}>{c.telMobile}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.s1.sicurezza&&<Dsub n="1.1" t="Servizio di sicurezza">{data.s1.sicurezza}</Dsub>}
          {data.s1.polizia&&<Dsub n="1.2" t="Polizia">{data.s1.polizia}</Dsub>}
          {data.s1.sanitari&&<Dsub n="1.3" t="Sanitari">{data.s1.sanitari}</Dsub>}
          {data.s1.rega&&<Dsub n="1.4" t="REGA">{data.s1.rega}</Dsub>}
          {data.s1.pompieri&&<Dsub n="1.5" t="Pompieri">{data.s1.pompieri}</Dsub>}
          {data.s1.statoMaggiore&&(
            <Dsub n="1.6" t="Stato Maggiore">
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12.5px"}}>
                <tbody>
                  {data.s1.statoMaggiore.split("\n").map(s=>s.trim()).filter(Boolean).map((s,i)=>{
                    const sep = s.indexOf(":");
                    const org = sep>-1 ? s.slice(0,sep).trim() : s;
                    const nom = sep>-1 ? s.slice(sep+1).trim() : "";
                    return (
                      <tr key={i}>
                        <td style={{padding:"3px 24px 3px 0",width:"44%",...SANS,fontWeight:"700",color:TX,verticalAlign:"top",whiteSpace:"nowrap"}}>{org}{sep>-1?":":""}</td>
                        <td style={{padding:"3px 0",...SANS,color:TX,verticalAlign:"top"}}>{nom}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Dsub>
          )}
          {data.s1.puntoRitrovo&&(
            <div style={{background:GL,border:`1px solid ${GB}`,borderRadius:"6px",padding:"10px 16px",fontWeight:"700",fontSize:"12.5px",...SANS,color:N,textAlign:"center",textTransform:"uppercase",letterSpacing:"0.07em"}}>
              PUNTO DI RITROVO: {data.s1.puntoRitrovo}
            </div>
          )}
        </Dsec>
      )}

      {/* S2 */}
      {data.s2&&(
        <Dsec id="ps2" n="2" t="Descrizione">
          {data.s2.descrizione&&<p style={{...SANS,fontSize:"12.5px",lineHeight:1.75,marginBottom:"16px",margin:"0 0 16px"}}>{data.s2.descrizione}</p>}
          {data.s2.programma&&data.s2.programma.length>0&&(
            <div style={{...SANS,fontSize:"12.5px",lineHeight:2.1,marginBottom:"16px"}}>
              {data.s2.programma.map((p,i)=><div key={i}><strong>{p.giorno}</strong>{p.giorno&&p.attivita?" — ":""}{p.attivita}</div>)}
            </div>
          )}
          {data.s2.orari&&<Dsub n="2.1" t="Periodo e orari d'apertura">{data.s2.orari}</Dsub>}
          {data.s2.location&&(
            <Dsub n="2.2" t="Location">
              {data.s2.location}
              <div style={{...SANS,fontSize:"12px",fontStyle:"italic",color:TM,marginTop:"8px",padding:"6px 10px",background:GL,borderRadius:"4px",border:`1px solid ${GB}`}}>
                📎 La planimetria della location con il dispositivo degli agenti è riportata nell'<strong>Allegato 2</strong>.
              </div>
            </Dsub>
          )}
          {data.s2.pattuglia&&<Dsub n="2.3" t="Pattuglia esterna">{data.s2.pattuglia}</Dsub>}
          {data.s2.visitatori&&<Dsub n="2.4" t="Tipologia e numero dei visitatori">{data.s2.visitatori}</Dsub>}
          {data.s2.minori&&<Dsub n="2.5" t="Gestione dei minori">{data.s2.minori}</Dsub>}
        </Dsec>
      )}

      {/* S3 */}
      {data.s3&&(
        <Dsec id="ps3" n="3" t="Analisi dei pericoli">
          <p style={{...SANS,fontSize:"12.5px",lineHeight:1.75,margin:"0 0 16px"}}>Ad ogni evento vi sono fattori di rischio che potrebbero pregiudicare il buon esito dello stesso. Una valutazione attenta di questi fattori può influire sia sulla buona riuscita che sulle misure da adottare in caso di necessità.</p>
          <Dsub n="3.1" t="Analisi del rischio">
            <RiskTbl title="Lista Pericoli Passivi" rows={data.s3.passivi}/>
            <RiskTbl title="Lista Pericoli Attivi" rows={data.s3.attivi}/>
          </Dsub>
          {data.s3.meteo&&<Dsub n="3.2" t="Meteo">{data.s3.meteo}</Dsub>}
          {data.s3.terrorismo&&<Dsub n="3.3" t="Atto terroristico / attentato">{data.s3.terrorismo}</Dsub>}
          {data.s3.evacuazione&&<Dsub n="3.4" t="Evacuazione">{data.s3.evacuazione}</Dsub>}
        </Dsec>
      )}

      {/* S4 */}
      {data.s4&&(
        <Dsec id="ps4" n="4" t="Dispositivo di sicurezza">
          <p style={{...SANS,fontSize:"12.5px",margin:"0 0 12px"}}>La DELTAgroup Security &amp; Services AG mette a disposizione il seguente dispositivo di sicurezza. La planimetria con le posizioni degli agenti è riportata nell'<strong>Allegato 2</strong>.</p>
          <div style={{marginBottom:"20px",border:`1px solid ${GB}`,borderRadius:"6px",overflow:"hidden"}}>
            {(data.s4.righe||[]).map((r,i)=>(
              <div key={i} style={{display:"flex",gap:"20px",padding:"8px 14px",background:i%2===0?"#f9fbfd":WH,fontSize:"12.5px",...SANS,borderBottom:i<(data.s4.righe||[]).length-1?`1px solid ${GL}`:"none"}}>
                <span style={{fontWeight:"700",color:N,minWidth:"110px"}}>➤&nbsp;{r.data}</span>
                <span>{r.agenti}</span>
                <span style={{color:TM}}>{r.orario}</span>
              </div>
            ))}
          </div>
          {data.s4.modifiche&&<Dsub n="4.1" t="Modifiche">{data.s4.modifiche}</Dsub>}
          {data.s4.comunicazioni&&<Dsub n="4.2" t="Comunicazioni">{data.s4.comunicazioni}</Dsub>}
          <Dsub n="4.3" t="Divisa">Secondo regolamento DELTAgroup.</Dsub>
          {data.s4.postoComando&&<Dsub n="4.4" t="Posto Comando">{data.s4.postoComando}</Dsub>}
          {data.s4.diversi&&<Dsub n="4.5" t="Diversi">{data.s4.diversi}</Dsub>}
        </Dsec>
      )}

      {/* S5 */}
      {data.s5&&(
        <Dsec id="ps5" n="5" t="Scenari">
          {data.s5.incendio&&<Dsub n="5.1" t="Incendio">{data.s5.incendio}</Dsub>}
          {data.s5.intossicazione&&<Dsub n="5.2" t="Intossicazione">{data.s5.intossicazione}</Dsub>}
          {data.s5.ordine&&<Dsub n="5.3" t="Problemi d'ordine">{data.s5.ordine}</Dsub>}
          {data.s5.ferimenti&&<Dsub n="5.4" t="Ferimenti / Malori">{data.s5.ferimenti}</Dsub>}
          {data.s5.droghe&&<Dsub n="5.5" t="Sostanze stupefacenti">{data.s5.droghe}</Dsub>}
        </Dsec>
      )}

      {/* S6 */}
      {data.s6&&(
        <>
        <Dsec id="ps6a" n="6" t="Casi d'Allarme">
          {data.s6.smc&&<Dsub n="6.1" t="Stato Maggiore di Crisi">{data.s6.smc}</Dsub>}
          {[["6.2","Evacuazione","ev"],["6.3","Allarme incendio","inc"],["6.4","Minaccia Bomba","mb"],
            ["6.5","Allarme Bomba (indicazione precisa)","ab"]
          ].map(([n,t,k])=>(
            data.s6[k]&&data.s6[k].length>0&&(
              <Dsub key={n} n={n} t={t}>
                <ol style={{margin:0,paddingLeft:"18px"}}>
                  {data.s6[k].map((s,i)=><li key={i} style={{marginBottom:"3px"}}>{s}</li>)}
                </ol>
              </Dsub>
            )
          ))}
        </Dsec>
        <Dsec id="ps6b" n="6" t="Casi d'Allarme">
          {[["6.6","Atto Terroristico / Attentato","at"],
            ["6.7","Allarme tecnico (Corrente elettrica)","te"],["6.8","Allarme Meteo","me"]
          ].map(([n,t,k])=>(
            data.s6[k]&&data.s6[k].length>0&&(
              <Dsub key={n} n={n} t={t}>
                <ol style={{margin:0,paddingLeft:"18px"}}>
                  {data.s6[k].map((s,i)=><li key={i} style={{marginBottom:"3px"}}>{s}</li>)}
                </ol>
              </Dsub>
            )
          ))}
          <Dsub n="6.9" t="Annunci d'emergenza">
            La DELTA Security AG prepara e predispone il formulario degli annunci d'emergenza in prossimità di ogni palco o punto dove si possa, tramite un dispositivo audio, effettuare gli annunci. Il responsabile della sicurezza sarà pure lui in possesso di tale formulario. Il formulario con gli annunci d'emergenza è inserito nel presente protocollo di sicurezza. (Allegato 1)
          </Dsub>
        </Dsec>
        </>
      )}

      </div>{/* fine pbody-main: solo sezioni 1–6 (stampa PDF) */}

      {/* ALLEGATO 1 */}
      <div id="pall1" style={{marginTop:"0",paddingTop:"28px",borderTop:"none",pageBreakBefore:"always",breakBefore:"page"}}>
        <div style={{background:N,color:WH,padding:"9px 16px",fontSize:"13px",fontWeight:"700",...SANS,borderRadius:"6px",marginBottom:"22px",textAlign:"center",textTransform:"uppercase",letterSpacing:"0.08em"}}>
          Allegato 1 – Formulario Annunci d'Emergenza
        </div>
        {ANNUNCI.map(sec=>(
          <div key={sec.n} style={{marginBottom:"22px"}}>
            <div style={{fontWeight:"700",fontSize:"12.5px",textDecoration:"underline",color:N,...SANS,marginBottom:"12px"}}>{sec.n}</div>
            {sec.items.map((it,i)=>(
              <div key={i} style={{marginBottom:"13px",paddingLeft:"8px"}}>
                <div style={{fontWeight:"700",fontSize:"11.5px",...SANS,color:TX,marginBottom:"3px"}}>Nr. – {it.l}</div>
                <div style={{...SANS,fontSize:"11.5px",whiteSpace:"pre-line",color:TX,lineHeight:1.65,paddingLeft:"10px"}}>{it.t}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ALLEGATO 2 */}
      <div id="pall2" style={{marginTop:"0",paddingTop:"28px",borderTop:"none",pageBreakBefore:"always",breakBefore:"page"}}>
        <div style={{background:N,color:WH,padding:"9px 16px",fontSize:"13px",fontWeight:"700",...SANS,borderRadius:"6px",marginBottom:"22px",textAlign:"center",textTransform:"uppercase",letterSpacing:"0.08em"}}>
          Allegato 2 – Planimetria Dispositivo Agenti
        </div>
        {(data.allegato2Files&&data.allegato2Files.length>0) ? (
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
            {data.allegato2Files.map((f,i)=>{
              const isImg = f.type.startsWith("image/");
              const isPdf = f.type==="application/pdf";
              const src = f.url;
              return (
                <div key={f.id||i} style={{marginBottom:"12px"}}>
                  <div style={{...SANS,fontSize:"11px",color:GR,marginBottom:"6px",fontWeight:"600"}}>📎 {f.name}</div>
                  {isImg && <img src={src} alt={f.name} style={{width:"100%",border:`1px solid ${GB}`,borderRadius:"6px",display:"block"}}/>}
                  {isPdf && (
                    <div style={{border:`2px solid ${GB}`,borderRadius:"8px",overflow:"hidden"}}>
                      <div style={{background:"#f5f7fb",padding:"16px 20px",display:"flex",alignItems:"center",gap:"14px"}}>
                        <span style={{fontSize:"36px"}}>📄</span>
                        <div style={{flex:1}}>
                          <div style={{...SANS,fontWeight:"700",fontSize:"13px",color:N}}>{f.name}</div>
                          <div style={{...SANS,fontSize:"11px",color:GR,marginTop:"2px"}}>Documento PDF allegato</div>
                        </div>
                        <a href={src} target="_blank" rel="noreferrer"
                           style={{...SANS,fontSize:"12px",fontWeight:"600",color:WH,background:N,padding:"7px 14px",borderRadius:"6px",textDecoration:"none"}}>
                          Apri PDF ↗
                        </a>
                      </div>
                      <iframe src={src} style={{width:"100%",height:"500px",border:"none",display:"block"}} title={f.name}/>
                    </div>
                  )}
                  {!isImg&&!isPdf&&(
                    <div style={{background:"#f0f4f9",border:`1px solid ${GB}`,borderRadius:"6px",padding:"16px",display:"flex",alignItems:"center",gap:"10px",...SANS,fontSize:"12px",color:TX}}>
                      <span style={{fontSize:"28px"}}>📊</span>
                      <div style={{fontWeight:"600"}}>{f.name}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{border:`2px dashed ${GB}`,borderRadius:"8px",padding:"40px",textAlign:"center",color:GR,...SANS,fontSize:"12.5px"}}>
            <div style={{fontSize:"36px",marginBottom:"10px"}}>🗺️</div>
            <div style={{fontWeight:"600",color:TM,marginBottom:"4px"}}>Planimetria da allegare</div>
            <div style={{fontSize:"11px"}}>Carica la piantina dal pannello di modifica a sinistra → sezione Allegato 2</div>
          </div>
        )}
      </div>

      </div>{/* fine body */}

      {/* ── CARTA INTESTATA FOOTER ── */}
      <div className="doc-page-footer" style={{borderTop:`1px solid ${GB}`}}>
        <div style={{display:"flex",justifyContent:"center",padding:"5px 32px",borderTop:"1px solid #0c1d3d",fontSize:"8pt",color:"#555",fontFamily:"Arial",background:"white"}}>
          DELTAgroup Security &amp; Services AG &middot; Filiale Ticino &middot; Via alla Foce 4, 6933 Muzzano &middot; T +41 91 921 49 49 &middot; ticino@delta.ch &middot; www.delta.ch
        </div>
      </div>
    </div>
  );
}

function Editor({ data: initialData, onBack }) {
  const [data, setData] = useState({...initialData, allegato2Files: initialData.allegato2Files||[]});
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [addDrag, setAddDrag] = useState(false);
  const [all2Drag, setAll2Drag] = useState(false);
  const [rightDrag, setRightDrag] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const addRef = React.useRef();
  const all2Ref = React.useRef();
  const chatEndRef = React.useRef();
  const rightDragCount = React.useRef(0);

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

  const applyEdit = async () => {
    if (!msg.trim() && attachments.length===0) return;
    setLoading(true); setErr(null);
    const SYS_EDIT = SYS_PROMPT+"\n\nTi viene passato il JSON attuale del documento e la modifica richiesta. Restituisci il JSON completo aggiornato con le modifiche applicate, mantenendo tutti i campi esistenti.";
    const attList = attachments.map(a=>`- ${a.name} (${a.type.startsWith("image/")?"immagine/piantina":"documento PDF"})`).join("\n");
    const dataClean = {...data, logoEvento: data.logoEvento ? "[logo_caricato]" : null};
    const editMsg = `DOCUMENTO ATTUALE (JSON):\n${JSON.stringify(dataClean,null,2)}\n\nMODIFICA RICHIESTA:\n${msg||"(vedi allegati)"}${attachments.length>0?`\n\nALLEGATI (${attachments.length}):\n${attList}\nAnalizza gli allegati e integra le informazioni nei capitoli corretti.`:""}`;
    try {
      const newData = await callAI(editMsg, null, attachments, SYS_EDIT);
      setData({...newData, logoEvento:data.logoEvento||null, allegato2Files:data.allegato2Files||[]});
      setHistory(prev=>[...prev,{msg:msg||"(allegati)", files:attachments.map(a=>a.name), ts:new Date()}]);
      setMsg(""); setAttachments([]);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const buildPrintHTML = () => {
    const el = document.getElementById("doc-preview");
    if (!el) return "";

    const getHTML = (id) => {
      const node = el.querySelector(`#${id}`);
      return node ? node.innerHTML : "";
    };

    const hdr = `<div style="display:flex;align-items:center;justify-content:flex-end;padding:4px 32px;border-bottom:2px solid #0c1d3d;background:white;">
  <img src="${window.location.origin}${logoImg}" style="height:44px;display:block;"/>
</div>`;

    const ftr = `<div style="display:flex;justify-content:center;padding:5px 32px;border-top:1px solid #0c1d3d;font-size:8pt;color:#555;font-family:Arial;background:white;">
  DELTAgroup Security &amp; Services AG &middot; Filiale Ticino &middot; Via alla Foce 4, 6933 Muzzano &middot; T +41 91 921 49 49 &middot; ticino@delta.ch &middot; www.delta.ch
</div>`;

    const page = (content, extraClass = "") =>
      `<div class="ppage ${extraClass}">
        <div class="pcnt">${content}</div>
      </div>`;

    const coverHTML = getHTML("pc");
    const tocHTML   = getHTML("ptoc");

    const nPall1 = el.querySelector("#pbody > #pall1");
    const all1HTML = nPall1 ? nPall1.innerHTML : "";
    const nPall2 = el.querySelector("#pbody > #pall2");
    const all2HTML = nPall2 ? nPall2.innerHTML : "";

    const sectionPages = ["ps1", "ps2", "ps3", "ps4", "ps5", "ps6a", "ps6b"]
      .map((sid) => {
        const node = el.querySelector(`#pbody-main > #${sid}`);
        const inner = node ? node.innerHTML : "";
        return inner ? page(inner, "ppage-flow") : "";
      })
      .join("");

    console.log("ALL1 length:", all1HTML.length, "| inizio:", all1HTML.substring(0, 100));
    console.log("ALL2 length:", all2HTML.length, "| inizio:", all2HTML.substring(0, 100));
    console.log("sectionPages length:", sectionPages.length);

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
.cover .pcnt{
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  text-align:center;
}
@media print{
  @page{size:A4 portrait;margin:0 10mm 0 10mm;}
  .print-hdr{position:fixed;top:0;left:0;height:auto;width:100%;z-index:1000;}
  .print-ftr{position:fixed;bottom:0;left:0;width:100%;z-index:1000;}
  .ppage-fixed{height:297mm;overflow:hidden;}
  .pcnt{padding-top:65px;padding-bottom:40px;padding-left:36px;padding-right:36px;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  th{background:#0c1d3d!important;color:#fff!important;}
}
</style></head><body>
<div class="print-hdr">${hdr}</div>
<div class="print-ftr">${ftr}</div>
${page(coverHTML, "cover ppage-fixed ppage-first")}
${page(tocHTML, "ppage-fixed")}
${sectionPages}
${all1HTML ? page(all1HTML, "ppage-flow") : ""}
${all2HTML ? page(all2HTML, "ppage-flow") : ""}
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

  

  const dropBase = (drag) => ({
    border:`2px dashed ${drag?N:GB}`, borderRadius:"8px", padding:"10px 14px",
    cursor:"pointer", background:drag?"#eef2f9":BG, transition:"all 0.2s",
    display:"flex", alignItems:"center", gap:"8px",
  });

  return (
    <div style={{display:"flex", height:"calc(100vh - 60px)", overflow:"hidden"}}>

      {/* ── PANNELLO SINISTRO ── */}
      <div
        style={{width:"360px",minWidth:"300px",background:WH,borderRight:`1px solid ${GB}`,display:"flex",flexDirection:"column",overflow:"hidden"}}
        onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
        onDrop={e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer.files.length>0)addAll2Files(e.dataTransfer.files);}}
      >

        {/* Top bar */}
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${GB}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:N,position:"relative"}}>
          <button onClick={onBack} style={{...SANS,fontSize:"12px",color:"rgba(255,255,255,0.75)",background:"none",border:"none",cursor:"pointer",padding:0}}>← Indietro</button>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowSave(s=>!s)} style={{...SANS,fontSize:"12px",padding:"6px 12px",background:RD,color:WH,border:"none",borderRadius:"6px",cursor:"pointer",fontWeight:"600",display:"flex",alignItems:"center",gap:"5px"}}>
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
                <button onClick={()=>{doDownloadHTML();setShowSave(false);}} style={{...SANS,width:"100%",padding:"11px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left",fontSize:"13px",color:TX,display:"flex",gap:"10px",alignItems:"center"}}>
                  <span>🌐</span><div><div style={{fontWeight:"600"}}>Scarica HTML</div><div style={{fontSize:"10px",color:GR}}>File completo con immagini</div></div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Header pannello */}
        <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${GB}`}}>
          <div style={{...SERIF,fontSize:"16px",fontWeight:"700",color:N,marginBottom:"2px"}}>Modifica documento</div>
          <div style={{...SANS,fontSize:"11px",color:GR}}>Digita le modifiche · allega file · premi Applica</div>
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
        <DocPreview data={data}/>
      </div>
    </div>
  );
}


// ── HOME ──────────────────────────────────────────────────────────────────────
function ModeCard({ icon, title, desc, color, on }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={on} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      background:hov?color:WH, border:`2px solid ${hov?color:GB}`,
      borderRadius:"12px", padding:"28px", textAlign:"left", cursor:"pointer",
      transition:"all 0.18s", transform:hov?"translateY(-2px)":"none",
      boxShadow:hov?"0 8px 24px rgba(12,29,61,0.14)":"0 2px 8px rgba(0,0,0,0.05)",
    }}>
      <div style={{
        width:"44px",height:"44px",borderRadius:"10px",
        background:hov?"rgba(255,255,255,0.15)":`${color}18`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:"22px",color:hov?WH:color,marginBottom:"14px",...SANS,fontWeight:"800",
      }}>{icon}</div>
      <div style={{...SERIF,fontSize:"19px",fontWeight:"700",color:hov?WH:N,marginBottom:"8px"}}>{title}</div>
      <div style={{...SANS,fontSize:"13px",color:hov?"rgba(255,255,255,0.82)":TM,lineHeight:1.65}}>{desc}</div>
    </button>
  );
}

function Home({ onNew, onMod }) {
  return (
    <div style={{minHeight:"calc(100vh - 60px)",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
      <div style={{maxWidth:"780px",width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:"48px"}}>
          <div style={{...SANS,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.2em",color:RD,marginBottom:"10px",fontWeight:"700"}}>
            Sistema di Gestione Documentale
          </div>
          <h1 style={{...SERIF,fontSize:"34px",fontWeight:"700",color:N,margin:"0 0 14px",lineHeight:1.2}}>
            Generatore Concetti<br/>di Sicurezza
          </h1>
          <p style={{...SANS,color:TM,fontSize:"15px",margin:0,lineHeight:1.65}}>
            Crea o aggiorna i concetti di sicurezza per i tuoi eventi<br/>
            con la qualità e lo standard DELTAgroup.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px"}}>
          <ModeCard icon="✦" title="Nuovo Concetto" color={N} on={onNew}
            desc="Crea un concetto di sicurezza partendo da zero. Inserisci i dati dell'evento e genera il documento completo in pochi minuti."
          />
          <ModeCard icon="⟳" title="Modifica Esistente" color={RD} on={onMod}
            desc="Incolla un concetto esistente e descrivi le modifiche. Il sistema aggiornerà il documento mantenendo lo stile DELTAgroup."
          />
        </div>
        <div style={{textAlign:"center",marginTop:"36px",fontSize:"11.5px",color:GR,...SANS}}>
          DELTAgroup Security &amp; Services AG &nbsp;·&nbsp; Via alla Foce 4, 6933 Muzzano
          &nbsp;·&nbsp; T +41 919 214 949 &nbsp;·&nbsp; TICINO@delta.ch
        </div>
      </div>
    </div>
  );
}

// ── HEADER ────────────────────────────────────────────────────────────────────
function Header({ onHome }) {
  return (
    <div style={{
      background:"#111827", padding:"0 20px", height:"60px",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      borderBottom:`3px solid ${RD}`,position:"sticky",top:0,zIndex:100,
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
            <span style={{...SANS,fontSize:"18px",fontWeight:"700",color:RD,marginLeft:"6px",letterSpacing:"0.06em"}}>CS</span>
          </div>
          <div style={{...SANS,fontSize:"9px",color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.14em"}}>
            Concetti di Sicurezza · Ticino · v2.0
          </div>
        </div>
      </button>
      <div style={{...SANS,fontSize:"10px",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em",textAlign:"right"}}>
        Security &amp; Services AG
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [doc, setDoc] = useState(null);
  // Prevenzione globale apertura file da drag fuori dalle dropzone
  React.useEffect(() => {
    const stop = (e) => e.preventDefault();
    document.addEventListener("dragover", stop);
    document.addEventListener("drop", stop);
    return () => { document.removeEventListener("dragover", stop); document.removeEventListener("drop", stop); };
  }, []);
  const done = (data) => { setDoc(data); setView("preview"); };
  return (
    <div style={{minHeight:"100vh",background:BG}}>
      <Header onHome={()=>setView("home")}/>
      {view==="home"&&<Home onNew={()=>setView("wizard")} onMod={()=>setView("modify")}/>}
      {view==="wizard"&&<Wizard onBack={()=>setView("home")} onDone={done}/>}
      {view==="modify"&&<Modify onBack={()=>setView("home")} onDone={done}/>}
      {view==="preview"&&<Editor data={doc} onBack={()=>setView("home")}/>}
    </div>
  );
}

// Editor di annotazioni fotografiche (react-konva).
// Componente standalone usato dallo step Allegati di PpsWizard tramite modal.
//
// Props:
//   - imageSrc: string  (dataURL base64 dell'immagine — il parent fa il pre-fetch
//                         così toDataURL() non incappa in SecurityError CORS)
//   - initialShapes: array  (shapes già salvate, per ripristinare l'editabilità al reload)
//   - onSave: ({ annotatedDataUrl, legenda, shapesJson }) => void
//   - onCancel: () => void
//
// Strumenti: select / rect / arrow / text. Transformer per spostare/ridimensionare.
// Undo/redo a snapshot. Color picker. Salvataggio via stage.toDataURL({pixelRatio:2}).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Ellipse, Arrow, Circle, Group, Text as KonvaText, Image as KonvaImage, Transformer } from "react-konva";

const MAX_W = 800;
const MAX_H = 600;
const MARKER_R = 22;

// Converte #rrggbb in rgba(...) con alpha — usato per il riempimento semi-trasparente
// (così il bordo resta pieno e nitido anche con fill attivo).
function withAlpha(hex, a) {
  const h = String(hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

// Palette coerente con il resto dell'app
const N = "#0c1d3d";
const AC = "#1E40AF";
const WH = "#ffffff";
const GB = "#d0dae8";
const GL = "#edf1f8";
const TM = "#52637a";
const GR = "#9baab8";
const ERR = "#c8102e";
const OK = "#16a34a";
const SANS = { fontFamily: "system-ui, -apple-system, sans-serif" };

function ToolBtn({ children, on, active = false, disabled = false, title }) {
  return (
    <button onClick={on} disabled={disabled} title={title} style={{
      ...SANS, padding: "8px 12px", borderRadius: "8px",
      border: `1px solid ${active ? AC : GB}`,
      background: disabled ? GL : active ? AC : WH,
      color: disabled ? GR : active ? WH : N,
      fontSize: "13px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function Divider() {
  return <span style={{ width: "1px", alignSelf: "stretch", background: GB, margin: "0 4px" }} />;
}

export default function AnnotationEditor({ imageSrc, initialShapes = [], onSave, onCancel }) {
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const idCounter = useRef(0);

  const [image, setImage] = useState(null);
  const [dims, setDims] = useState({ width: MAX_W, height: MAX_H });
  const [loading, setLoading] = useState(true);

  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#ff0000");
  const [shapes, setShapes] = useState(initialShapes ?? []);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([JSON.parse(JSON.stringify(initialShapes ?? []))]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [draft, setDraft] = useState(null); // shape provvisoria durante il disegno
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: "" });
  const [markerInput, setMarkerInput] = useState({ visible: false, x: 0, y: 0, value: "" });
  const [filled, setFilled] = useState(false);       // riempimento on/off (rect/cerchio)
  const [strokeWidth, setStrokeWidth] = useState(2);  // spessore bordi/frecce
  const [iconManifest, setIconManifest] = useState([]); // voci del manifest icone
  const [iconImages, setIconImages] = useState({});     // { [iconId]: HTMLImageElement }
  const [iconPanelOpen, setIconPanelOpen] = useState(false);
  const [iconCategory, setIconCategory] = useState("Tutte"); // filtro categoria nel pannello
  const [pendingIcon, setPendingIcon] = useState(null); // { id, label, konvaImage } | null

  const newId = () => `s${Date.now()}_${idCounter.current++}`;

  // ── Caricamento immagine e scala per stare in MAX_W × MAX_H (no upscaling) ──
  useEffect(() => {
    let active = true;
    setLoading(true);
    const img = new window.Image();
    img.onload = () => {
      if (!active) return;
      const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      setDims({ width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
      setImage(img);
      setLoading(false);
    };
    img.onerror = () => { if (active) setLoading(false); };
    img.src = imageSrc;
    return () => { active = false; };
  }, [imageSrc]);

  // ── Caricamento manifest icone + pre-caricamento come window.Image (al mount) ──
  useEffect(() => {
    let active = true;
    fetch("/icons/security-icon-pack/securityIcons.manifest.json")
      .then((r) => r.json())
      .then((icons) => {
        if (!active) return;
        setIconManifest(icons);
        const loaded = {};
        let count = 0;
        const done = () => {
          count++;
          if (count === icons.length) setIconImages({ ...loaded });
        };
        icons.forEach((icon) => {
          const img = new window.Image();
          img.onload = () => { loaded[icon.id] = img; done(); };
          img.onerror = () => { done(); }; // non bloccare il pannello se una fallisce
          img.src = icon.svg; // già "/icons/security/[filename].svg"
        });
      })
      .catch((e) => console.error("[AnnotationEditor] manifest icone", e));
    return () => { active = false; };
  }, []);

  // ── Escape annulla la modalità "posiziona icona" ──
  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape" && pendingIcon) setPendingIcon(null); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [pendingIcon]);

  // ── History: ogni mutazione di shapes[] crea uno snapshot ──
  const commit = useCallback((next) => {
    const snap = JSON.parse(JSON.stringify(next));
    setShapes(next);
    setHistory((h) => [...h.slice(0, historyStep + 1), snap]);
    setHistoryStep((s) => s + 1);
  }, [historyStep]);

  const undo = useCallback(() => {
    if (historyStep === 0) return;
    const step = historyStep - 1;
    setHistoryStep(step);
    setShapes(JSON.parse(JSON.stringify(history[step])));
    setSelectedId(null);
  }, [history, historyStep]);

  const redo = useCallback(() => {
    if (historyStep >= history.length - 1) return;
    const step = historyStep + 1;
    setHistoryStep(step);
    setShapes(JSON.parse(JSON.stringify(history[step])));
    setSelectedId(null);
  }, [history, historyStep]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit(shapes.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, shapes, commit]);

  // Toggle riempimento: cambia il default per le prossime shape e, se c'è una
  // shape selezionata (rect/cerchio), la aggiorna subito (con snapshot history).
  const toggleFill = () => {
    const next = !filled;
    setFilled(next);
    if (selectedId) {
      commit(shapes.map((s) => (s.id === selectedId && (s.type === "rect" || s.type === "circle") ? { ...s, filled: next } : s)));
    }
  };

  // Spessore: default per le prossime shape + applicazione immediata alla selezione.
  const setSW = (w) => {
    setStrokeWidth(w);
    if (selectedId) {
      commit(shapes.map((s) => (s.id === selectedId && (s.type === "rect" || s.type === "circle" || s.type === "arrow") ? { ...s, strokeWidth: w } : s)));
    }
  };

  // Seleziona un'icona dal pannello → entra in modalità "posiziona icona".
  const selezionaIcona = (icon) => {
    setIconPanelOpen(false);
    setPendingIcon({ id: icon.id, label: icon.label, konvaImage: iconImages[icon.id] });
  };

  // ── Legenda: colore "logico" della shape, preview e descrizione ──
  const shapeColor = (s) => {
    if (s.type === "rect" || s.type === "circle" || s.type === "arrow") return s.stroke;
    if (s.type === "text" || s.type === "marker") return s.fill;
    return null; // icona: immagine fissa
  };
  const iconDef = (id) => iconManifest.find((d) => d.id === id) || null;

  // Aggiorna la descrizione senza salvare in history (lo si fa onBlur)
  const updateDescription = (id, value) => setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, description: value } : s)));
  const commitDescriptionSnapshot = () => commit(shapes);

  const renderPreview = (s) => {
    const c = shapeColor(s);
    if (s.type === "rect") return <span style={{ display: "inline-block", width: 16, height: 16, background: c, borderRadius: 2 }} />;
    if (s.type === "circle") return <span style={{ display: "inline-block", width: 16, height: 16, background: c, borderRadius: "50%" }} />;
    if (s.type === "arrow") return <span style={{ color: c, fontWeight: 700, fontSize: 16, lineHeight: "16px" }}>→</span>;
    if (s.type === "text") return <span style={{ color: c, fontWeight: 700, fontSize: 14, lineHeight: "16px" }}>T</span>;
    if (s.type === "marker") return <span style={{ display: "inline-flex", width: 16, height: 16, borderRadius: "50%", background: c, color: "#fff", fontSize: 9, fontWeight: 700, alignItems: "center", justifyContent: "center" }}>{s.number}</span>;
    if (s.type === "icon") { const d = iconDef(s.iconId); return d ? <img src={d.svg} alt="" width={16} height={16} style={{ objectFit: "contain" }} /> : null; }
    return null;
  };

  // ── Transformer agganciato alla shape selezionata (solo in select) ──
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (tool === "select" && selectedId) {
      const node = stage.findOne("#" + selectedId);
      tr.nodes(node ? [node] : []);
    } else {
      tr.nodes([]);
    }
    const layer = tr.getLayer();
    if (layer) layer.batchDraw();
  }, [selectedId, tool, shapes]);

  // Cambio strumento → deseleziona
  useEffect(() => { if (tool !== "select") setSelectedId(null); }, [tool]);

  // ── Tasti Delete/Backspace per eliminare la shape selezionata ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return; // non interferire con la digitazione
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteSelected]);

  const pointer = () => {
    const stage = stageRef.current;
    return stage ? stage.getPointerPosition() : null;
  };

  // ── Disegno (rect / arrow) ──
  const handleMouseDown = (e) => {
    if (tool === "select") {
      const target = e.target;
      const clickedEmpty = target === target.getStage() || target.name() === "bg";
      if (clickedEmpty) setSelectedId(null);
      return;
    }
    if (tool === "text" || tool === "marker") return; // gestiti su click
    const pos = pointer();
    if (!pos) return;
    setIsDrawing(true);
    setDrawStart(pos);
    if (tool === "rect") {
      setDraft({ id: "preview", type: "rect", x: pos.x, y: pos.y, width: 0, height: 0, stroke: color, strokeWidth, filled });
    } else if (tool === "circle") {
      setDraft({ id: "preview", type: "circle", x: pos.x, y: pos.y, radiusX: 0, radiusY: 0, stroke: color, strokeWidth, filled });
    } else if (tool === "arrow") {
      setDraft({ id: "preview", type: "arrow", points: [pos.x, pos.y, pos.x, pos.y], stroke: color, fill: color, strokeWidth });
    }
  };

  const handleMouseMove = () => {
    if (!isDrawing || !drawStart) return;
    const pos = pointer();
    if (!pos) return;
    if (tool === "rect") {
      setDraft((d) => d && {
        ...d,
        x: Math.min(drawStart.x, pos.x), y: Math.min(drawStart.y, pos.y),
        width: Math.abs(pos.x - drawStart.x), height: Math.abs(pos.y - drawStart.y),
      });
    } else if (tool === "circle") {
      setDraft((d) => d && {
        ...d,
        x: drawStart.x + (pos.x - drawStart.x) / 2, y: drawStart.y + (pos.y - drawStart.y) / 2,
        radiusX: Math.abs(pos.x - drawStart.x) / 2, radiusY: Math.abs(pos.y - drawStart.y) / 2,
      });
    } else if (tool === "arrow") {
      setDraft((d) => d && { ...d, points: [drawStart.x, drawStart.y, pos.x, pos.y] });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const d = draft;
    setDraft(null);
    setDrawStart(null);
    if (!d) return;
    // Scarta i tratti accidentali troppo piccoli
    if (d.type === "rect" && (d.width < 3 || d.height < 3)) return;
    if (d.type === "circle" && (d.radiusX < 2 || d.radiusY < 2)) return;
    if (d.type === "arrow") {
      const [x1, y1, x2, y2] = d.points;
      if (Math.hypot(x2 - x1, y2 - y1) < 3) return;
    }
    commit([...shapes, { ...d, id: newId(), description: "" }]);
  };

  // ── Testo / Marker: click → input HTML in overlay → Enter conferma / Esc annulla ──
  const handleStageClick = () => {
    const pos = pointer();
    if (!pos) return;
    if (pendingIcon) {
      const id = newId();
      const newShape = { id, type: "icon", iconId: pendingIcon.id, x: pos.x, y: pos.y, width: 70, height: 70, description: "" };
      commit([...shapes, newShape]);
      setPendingIcon(null);
      setTool("select");
      setSelectedId(id);
      return;
    }
    if (tool === "text") {
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: "" });
    } else if (tool === "marker") {
      const n = shapes.filter((s) => s.type === "marker").length + 1;
      setMarkerInput({ visible: true, x: pos.x, y: pos.y, value: String(n) });
    }
  };

  const commitText = () => {
    const v = textInput.value.trim();
    if (v) {
      commit([...shapes, {
        id: newId(), type: "text", x: textInput.x, y: textInput.y,
        text: v, fill: color, fontSize: 16, fontStyle: "bold", description: "",
      }]);
    }
    setTextInput({ visible: false, x: 0, y: 0, value: "" });
  };

  const onTextKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitText(); }
    else if (e.key === "Escape") { e.preventDefault(); setTextInput({ visible: false, x: 0, y: 0, value: "" }); }
  };

  const commitMarker = () => {
    const v = markerInput.value.trim();
    if (v) {
      commit([...shapes, {
        id: newId(), type: "marker", x: markerInput.x, y: markerInput.y, number: v, fill: color, description: "",
      }]);
    }
    setMarkerInput({ visible: false, x: 0, y: 0, value: "" });
  };

  const onMarkerKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitMarker(); }
    else if (e.key === "Escape") { e.preventDefault(); setMarkerInput({ visible: false, x: 0, y: 0, value: "" }); }
  };

  // ── Drag / Transform: scrive le nuove geometrie in shapes[] (+ history) ──
  const handleDragEnd = (s, e) => {
    const node = e.target;
    if (s.type === "arrow") {
      const dx = node.x(), dy = node.y();
      const np = s.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
      node.position({ x: 0, y: 0 });
      commit(shapes.map((sh) => (sh.id === s.id ? { ...sh, points: np } : sh)));
    } else if (s.type === "icon") {
      // L'icona è disegnata all'angolo (x - w/2): riconverto a centro.
      commit(shapes.map((sh) => (sh.id === s.id ? { ...sh, x: node.x() + s.width / 2, y: node.y() + s.height / 2 } : sh)));
    } else {
      commit(shapes.map((sh) => (sh.id === s.id ? { ...sh, x: node.x(), y: node.y() } : sh)));
    }
  };

  const handleTransformEnd = (s, e) => {
    const node = e.target;
    const scaleX = node.scaleX(), scaleY = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    if (s.type === "rect") {
      commit(shapes.map((sh) => (sh.id === s.id ? {
        ...sh, x: node.x(), y: node.y(),
        width: Math.max(5, node.width() * scaleX), height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      } : sh)));
    } else if (s.type === "circle") {
      commit(shapes.map((sh) => (sh.id === s.id ? {
        ...sh, x: node.x(), y: node.y(),
        radiusX: Math.max(3, node.radiusX() * scaleX), radiusY: Math.max(3, node.radiusY() * scaleY),
        rotation: node.rotation(),
      } : sh)));
    } else if (s.type === "text") {
      commit(shapes.map((sh) => (sh.id === s.id ? {
        ...sh, x: node.x(), y: node.y(),
        fontSize: Math.max(8, sh.fontSize * scaleX), rotation: node.rotation(),
      } : sh)));
    } else if (s.type === "icon") {
      const nw = Math.max(16, node.width() * scaleX);
      const nh = Math.max(16, node.height() * scaleY);
      commit(shapes.map((sh) => (sh.id === s.id ? {
        ...sh, x: node.x() + nw / 2, y: node.y() + nh / 2, width: nw, height: nh, rotation: node.rotation(),
      } : sh)));
    }
  };

  // ── Salvataggio: stacca il transformer e poi esporta il PNG ──
  const handleSave = () => {
    if (trRef.current) trRef.current.nodes([]);
    setSelectedId(null);
    requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const uri = stage.toDataURL({ pixelRatio: 2 });
      const legenda = shapes
        .filter((s) => s.description && s.description.trim() !== "")
        .map((s, i) => ({
          num: i + 1,
          tipo: s.type,
          iconId: s.type === "icon" ? s.iconId : null, // serve a ritrovare l'SVG nella legenda PDF
          colore: shapeColor(s),
          descrizione: s.description.trim(),
          nome: s.type === "icon" ? (iconDef(s.iconId)?.label || null) : null, // nome icona per la legenda PDF
        }));
      // shapesJson: array shapes completo, persistito per ripristinare l'editabilità al reload.
      onSave({ annotatedDataUrl: uri, legenda, shapesJson: shapes });
    });
  };

  const selectedShape = shapes.find((s) => s.id === selectedId) || null;

  // Categorie dinamiche dal manifest (ordine di apparizione), con "Tutte" in testa.
  const iconCategories = ["Tutte", ...iconManifest.reduce((acc, ic) => {
    if (ic.category && !acc.includes(ic.category)) acc.push(ic.category);
    return acc;
  }, [])];
  const iconsFiltered = iconCategory === "Tutte" ? iconManifest : iconManifest.filter((ic) => ic.category === iconCategory);

  const shapeProps = (s) => ({
    key: s.id, id: s.id, name: "shape",
    draggable: tool === "select",
    onClick: () => { if (tool === "select") setSelectedId(s.id); },
    onTap: () => { if (tool === "select") setSelectedId(s.id); },
    onDragEnd: (e) => handleDragEnd(s, e),
    onTransformEnd: (e) => handleTransformEnd(s, e),
  });

  return (
    <div style={{ ...SANS, display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {/* Toolbar */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", padding: "10px 12px", background: GL, border: `1px solid ${GB}`, borderRadius: "10px" }}>
        <ToolBtn on={() => setTool("select")} active={tool === "select"} title="Seleziona / sposta">🖱 Seleziona</ToolBtn>
        <ToolBtn on={() => setTool("rect")} active={tool === "rect"} title="Rettangolo">⬜ Rettangolo</ToolBtn>
        <ToolBtn on={() => setTool("circle")} active={tool === "circle"} title="Cerchio / ellisse">○ Cerchio</ToolBtn>
        <ToolBtn on={() => setTool("arrow")} active={tool === "arrow"} title="Freccia">➡ Freccia</ToolBtn>
        <ToolBtn on={() => setTool("text")} active={tool === "text"} title="Testo">T Testo</ToolBtn>
        <ToolBtn on={() => setTool("marker")} active={tool === "marker"} title="Marcatore posizione numerato">📍 Posizione</ToolBtn>
        <Divider />
        <ToolBtn on={() => setIconPanelOpen((o) => !o)} active={iconPanelOpen} title="Icone operative">🏷️ Icone ▾</ToolBtn>
        {iconPanelOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: "12px", zIndex: 50,
            background: WH, border: `1px solid ${GB}`, borderRadius: "8px", boxShadow: "0 8px 24px rgba(12,29,61,0.18)",
            padding: "12px", width: "360px", maxHeight: "440px", overflowY: "auto",
          }}>
            {iconManifest.length === 0 ? (
              <div style={{ ...SANS, padding: "24px", textAlign: "center", color: TM, fontSize: "13px" }}>Caricamento icone…</div>
            ) : (
              <>
                {/* Pill categorie (dinamiche dal manifest) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
                  {iconCategories.map((cat) => (
                    <button key={cat} onClick={() => setIconCategory(cat)} style={{
                      ...SANS, padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                      border: `1px solid ${iconCategory === cat ? AC : GB}`,
                      background: iconCategory === cat ? AC : WH, color: iconCategory === cat ? WH : N,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}>{cat}</button>
                  ))}
                </div>
                {/* Griglia icone filtrate */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {iconsFiltered.map((icon) => (
                    <div key={icon.id} onClick={() => selezionaIcona(icon)} title={icon.recommendedUse || icon.label} style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                      padding: "8px 6px", border: `1px solid ${GB}`, borderRadius: "8px", cursor: "pointer", background: WH,
                    }}>
                      <img src={icon.svg} alt={icon.label} width={48} height={48} style={{ objectFit: "contain" }} />
                      <span style={{ ...SANS, fontSize: "10px", fontWeight: 700, color: N, textAlign: "center", lineHeight: 1.2 }}>{icon.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <Divider />
        <input type="color" value={color} onChange={(e) => {
          const c = e.target.value;
          setColor(c); // colore per le prossime shape
          if (selectedId) {
            // Applica anche alla shape selezionata (campi corretti per tipo) + snapshot history
            commit(shapes.map((s) => {
              if (s.id !== selectedId) return s;
              if (s.type === "rect" || s.type === "circle") return { ...s, stroke: c };
              if (s.type === "arrow") return { ...s, stroke: c, fill: c };
              if (s.type === "text") return { ...s, fill: c };
              if (s.type === "marker") return { ...s, fill: c }; // testo resta bianco
              return s;
            }));
          }
        }} title="Colore"
          style={{ width: "38px", height: "34px", border: `1px solid ${GB}`, borderRadius: "8px", background: WH, cursor: "pointer", padding: "2px" }} />
        <ToolBtn on={toggleFill} active={filled} title={filled ? "Riempimento attivo" : "Solo bordo"}>
          {filled ? "■ Riempimento" : "□ Solo bordo"}
        </ToolBtn>
        <ToolBtn on={() => setSW(1.5)} active={strokeWidth === 1.5} title="Bordo sottile">─ Sottile</ToolBtn>
        <ToolBtn on={() => setSW(3)} active={strokeWidth === 3} title="Bordo medio">— Medio</ToolBtn>
        <ToolBtn on={() => setSW(5)} active={strokeWidth === 5} title="Bordo spesso">━ Spesso</ToolBtn>
        <Divider />
        <ToolBtn on={undo} disabled={historyStep === 0} title="Annulla">↩ Annulla</ToolBtn>
        <ToolBtn on={redo} disabled={historyStep >= history.length - 1} title="Ripristina">↪ Ripristina</ToolBtn>
        <ToolBtn on={deleteSelected} disabled={!selectedId} title="Elimina selezione">🗑 Elimina</ToolBtn>
      </div>

      {/* Indicatore modalità "posiziona icona" */}
      {pendingIcon && (
        <div style={{ ...SANS, background: "#fff3cd", color: "#856404", border: "1px solid #ffecb5", borderRadius: "8px", padding: "6px 12px", fontSize: "12px" }}>
          📍 Clicca sulla mappa per posizionare: <b>{pendingIcon.label}</b> &nbsp;(Esc per annullare)
        </div>
      )}

      {/* Canvas */}
      <div style={{ position: "relative", width: dims.width, maxWidth: "100%", margin: "0 auto" }}>
        {loading ? (
          <div style={{ width: dims.width, height: dims.height, display: "flex", alignItems: "center", justifyContent: "center", background: GL, border: `1px solid ${GB}`, borderRadius: "8px", color: TM, fontSize: "14px" }}>
            Caricamento immagine…
          </div>
        ) : (
          <Stage
            ref={stageRef}
            width={dims.width}
            height={dims.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onClick={handleStageClick}
            onTap={handleStageClick}
            style={{ border: `1px solid ${GB}`, borderRadius: "8px", cursor: (pendingIcon || tool !== "select") ? "crosshair" : "default", touchAction: "none" }}
          >
            <Layer>
              {image && <KonvaImage image={image} width={dims.width} height={dims.height} name="bg" listening />}
              {shapes.map((s) => {
                if (s.type === "rect") {
                  return <Rect {...shapeProps(s)} x={s.x} y={s.y} width={s.width} height={s.height} stroke={s.stroke} strokeWidth={s.strokeWidth ?? 2} fill={s.filled ? withAlpha(s.stroke, 0.25) : "transparent"} rotation={s.rotation || 0} />;
                }
                if (s.type === "circle") {
                  return <Ellipse {...shapeProps(s)} x={s.x} y={s.y} radiusX={s.radiusX} radiusY={s.radiusY} stroke={s.stroke} strokeWidth={s.strokeWidth ?? 2} fill={s.filled ? withAlpha(s.stroke, 0.25) : "transparent"} rotation={s.rotation || 0} />;
                }
                if (s.type === "arrow") {
                  return <Arrow {...shapeProps(s)} points={s.points} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth ?? 2} pointerLength={10} pointerWidth={8} />;
                }
                if (s.type === "text") {
                  return <KonvaText {...shapeProps(s)} x={s.x} y={s.y} text={s.text} fill={s.fill} fontSize={s.fontSize} fontStyle={s.fontStyle} rotation={s.rotation || 0} />;
                }
                if (s.type === "marker") {
                  return (
                    <Group {...shapeProps(s)} x={s.x} y={s.y}>
                      <Circle radius={MARKER_R} fill={s.fill} stroke="white" strokeWidth={1.5} />
                      <KonvaText text={String(s.number)} fill="white" fontSize={14} fontStyle="bold"
                        width={MARKER_R * 2} height={MARKER_R * 2} offsetX={MARKER_R} offsetY={MARKER_R}
                        align="center" verticalAlign="middle" listening={false} />
                    </Group>
                  );
                }
                if (s.type === "icon") {
                  const iconImg = iconImages[s.iconId];
                  // Finché l'icona non è caricata mostra un placeholder grigio:
                  // così la shape è già selezionabile/spostabile anche al reload.
                  if (!iconImg) {
                    return <Rect {...shapeProps(s)} x={s.x - s.width / 2} y={s.y - s.height / 2} width={s.width} height={s.height} fill="#e2e8f0" stroke={GR} strokeWidth={1} cornerRadius={6} rotation={s.rotation || 0} />;
                  }
                  return <KonvaImage {...shapeProps(s)} x={s.x - s.width / 2} y={s.y - s.height / 2} width={s.width} height={s.height} image={iconImg} rotation={s.rotation || 0} />;
                }
                return null;
              })}
              {/* Shape provvisoria in disegno (non interattiva) */}
              {draft && draft.type === "rect" && (
                <Rect x={draft.x} y={draft.y} width={draft.width} height={draft.height} stroke={draft.stroke} strokeWidth={draft.strokeWidth ?? 2} fill={draft.filled ? withAlpha(draft.stroke, 0.25) : "transparent"} listening={false} />
              )}
              {draft && draft.type === "circle" && (
                <Ellipse x={draft.x} y={draft.y} radiusX={draft.radiusX} radiusY={draft.radiusY} stroke={draft.stroke} strokeWidth={draft.strokeWidth ?? 2} fill={draft.filled ? withAlpha(draft.stroke, 0.25) : "transparent"} listening={false} />
              )}
              {draft && draft.type === "arrow" && (
                <Arrow points={draft.points} stroke={draft.stroke} fill={draft.fill} strokeWidth={draft.strokeWidth ?? 2} pointerLength={10} pointerWidth={8} listening={false} />
              )}
              <Transformer
                ref={trRef}
                rotateEnabled={selectedShape ? selectedShape.type !== "marker" : true}
                resizeEnabled={selectedShape ? (selectedShape.type !== "arrow" && selectedShape.type !== "marker") : true}
                keepRatio={selectedShape ? selectedShape.type === "icon" : false}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
              />
            </Layer>
          </Stage>
        )}

        {/* Input testo posizionato sopra il canvas */}
        {textInput.visible && (
          <input
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput((t) => ({ ...t, value: e.target.value }))}
            onKeyDown={onTextKey}
            onBlur={commitText}
            placeholder="Testo… (Invio per confermare)"
            style={{
              position: "absolute", left: textInput.x, top: textInput.y,
              fontSize: "16px", fontWeight: 700, color, border: `1px dashed ${AC}`,
              borderRadius: "4px", padding: "2px 4px", outline: "none", background: "rgba(255,255,255,0.95)",
              minWidth: "120px", zIndex: 5,
            }}
          />
        )}

        {/* Input numero marcatore posizione */}
        {markerInput.visible && (
          <div style={{
            position: "absolute", left: markerInput.x, top: markerInput.y, zIndex: 6,
            display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.97)",
            border: `1px dashed ${AC}`, borderRadius: "6px", padding: "4px 6px",
          }}>
            <span style={{ ...SANS, fontSize: "12px", fontWeight: 700, color: N, whiteSpace: "nowrap" }}>Numero posizione:</span>
            <input
              autoFocus
              value={markerInput.value}
              onChange={(e) => setMarkerInput((m) => ({ ...m, value: e.target.value }))}
              onKeyDown={onMarkerKey}
              onBlur={commitMarker}
              style={{ width: "52px", fontSize: "14px", fontWeight: 700, textAlign: "center", border: `1px solid ${GB}`, borderRadius: "4px", padding: "2px 4px", outline: "none" }}
            />
          </div>
        )}
      </div>

      {/* Pannello LEGENDA — una riga per shape: preview, numero, descrizione */}
      {shapes.length > 0 && (
        <div style={{ ...SANS, borderTop: "1px solid #ddd", padding: "8px 12px", fontSize: "12px", maxHeight: "200px", overflowY: "auto" }}>
          <div style={{ fontWeight: 700, fontSize: "11px", color: N, marginBottom: "6px", letterSpacing: "0.04em" }}>LEGENDA</div>
          {shapes.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
              <span style={{ width: 18, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{renderPreview(s)}</span>
              <span style={{ width: 16, flexShrink: 0, fontWeight: 700, color: TM, textAlign: "right" }}>{i + 1}</span>
              <input type="text" placeholder="Descrizione..." value={s.description || ""}
                onChange={(e) => updateDescription(s.id, e.target.value)}
                onBlur={commitDescriptionSnapshot}
                style={{ ...SANS, flex: 1, fontSize: "12px", border: `1px solid ${GB}`, borderRadius: "6px", padding: "5px 8px", outline: "none", color: N }} />
            </div>
          ))}
        </div>
      )}

      {/* Azioni in basso a destra */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
        <button onClick={onCancel} style={{ ...SANS, padding: "11px 20px", borderRadius: "9px", border: `1px solid ${GB}`, background: WH, color: N, fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          ✕ Annulla
        </button>
        <button onClick={handleSave} disabled={loading} style={{ ...SANS, padding: "11px 22px", borderRadius: "9px", border: "none", background: loading ? GR : OK, color: WH, fontSize: "14px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          💾 Salva annotazione
        </button>
      </div>
    </div>
  );
}

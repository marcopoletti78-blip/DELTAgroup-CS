// Editor di annotazioni fotografiche (react-konva).
// Componente standalone usato dallo step Allegati di PpsWizard tramite modal.
//
// Props:
//   - imageSrc: string  (dataURL base64 dell'immagine — il parent fa il pre-fetch
//                         così toDataURL() non incappa in SecurityError CORS)
//   - onSave: (annotatedDataUrl: string) => void
//   - onCancel: () => void
//
// Strumenti: select / rect / arrow / text. Transformer per spostare/ridimensionare.
// Undo/redo a snapshot. Color picker. Salvataggio via stage.toDataURL({pixelRatio:2}).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Arrow, Text as KonvaText, Image as KonvaImage, Transformer } from "react-konva";

const MAX_W = 800;
const MAX_H = 600;

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

export default function AnnotationEditor({ imageSrc, onSave, onCancel }) {
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const idCounter = useRef(0);

  const [image, setImage] = useState(null);
  const [dims, setDims] = useState({ width: MAX_W, height: MAX_H });
  const [loading, setLoading] = useState(true);

  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#ff0000");
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([[]]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [draft, setDraft] = useState(null); // shape provvisoria durante il disegno
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: "" });

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
    if (tool === "text") return; // gestito su click
    const pos = pointer();
    if (!pos) return;
    setIsDrawing(true);
    setDrawStart(pos);
    if (tool === "rect") {
      setDraft({ id: "preview", type: "rect", x: pos.x, y: pos.y, width: 0, height: 0, stroke: color });
    } else if (tool === "arrow") {
      setDraft({ id: "preview", type: "arrow", points: [pos.x, pos.y, pos.x, pos.y], stroke: color, fill: color });
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
    if (d.type === "arrow") {
      const [x1, y1, x2, y2] = d.points;
      if (Math.hypot(x2 - x1, y2 - y1) < 3) return;
    }
    commit([...shapes, { ...d, id: newId() }]);
  };

  // ── Testo: click → input HTML in overlay → Enter conferma / Esc annulla ──
  const handleStageClick = () => {
    if (tool !== "text") return;
    const pos = pointer();
    if (!pos) return;
    setTextInput({ visible: true, x: pos.x, y: pos.y, value: "" });
  };

  const commitText = () => {
    const v = textInput.value.trim();
    if (v) {
      commit([...shapes, {
        id: newId(), type: "text", x: textInput.x, y: textInput.y,
        text: v, fill: color, fontSize: 16, fontStyle: "bold",
      }]);
    }
    setTextInput({ visible: false, x: 0, y: 0, value: "" });
  };

  const onTextKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitText(); }
    else if (e.key === "Escape") { e.preventDefault(); setTextInput({ visible: false, x: 0, y: 0, value: "" }); }
  };

  // ── Drag / Transform: scrive le nuove geometrie in shapes[] (+ history) ──
  const handleDragEnd = (s, e) => {
    const node = e.target;
    if (s.type === "arrow") {
      const dx = node.x(), dy = node.y();
      const np = s.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
      node.position({ x: 0, y: 0 });
      commit(shapes.map((sh) => (sh.id === s.id ? { ...sh, points: np } : sh)));
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
    } else if (s.type === "text") {
      commit(shapes.map((sh) => (sh.id === s.id ? {
        ...sh, x: node.x(), y: node.y(),
        fontSize: Math.max(8, sh.fontSize * scaleX), rotation: node.rotation(),
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
      onSave(uri);
    });
  };

  const selectedShape = shapes.find((s) => s.id === selectedId) || null;

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
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", padding: "10px 12px", background: GL, border: `1px solid ${GB}`, borderRadius: "10px" }}>
        <ToolBtn on={() => setTool("select")} active={tool === "select"} title="Seleziona / sposta">🖱 Seleziona</ToolBtn>
        <ToolBtn on={() => setTool("rect")} active={tool === "rect"} title="Rettangolo">⬜ Rettangolo</ToolBtn>
        <ToolBtn on={() => setTool("arrow")} active={tool === "arrow"} title="Freccia">➡ Freccia</ToolBtn>
        <ToolBtn on={() => setTool("text")} active={tool === "text"} title="Testo">T Testo</ToolBtn>
        <Divider />
        <input type="color" value={color} onChange={(e) => {
          const c = e.target.value;
          setColor(c); // colore per le prossime shape
          if (selectedId) {
            // Applica anche alla shape selezionata (campi corretti per tipo) + snapshot history
            commit(shapes.map((s) => {
              if (s.id !== selectedId) return s;
              if (s.type === "rect") return { ...s, stroke: c };
              if (s.type === "arrow") return { ...s, stroke: c, fill: c };
              if (s.type === "text") return { ...s, fill: c };
              return s;
            }));
          }
        }} title="Colore"
          style={{ width: "38px", height: "34px", border: `1px solid ${GB}`, borderRadius: "8px", background: WH, cursor: "pointer", padding: "2px" }} />
        <Divider />
        <ToolBtn on={undo} disabled={historyStep === 0} title="Annulla">↩ Annulla</ToolBtn>
        <ToolBtn on={redo} disabled={historyStep >= history.length - 1} title="Ripristina">↪ Ripristina</ToolBtn>
        <Divider />
        <ToolBtn on={deleteSelected} disabled={!selectedId} title="Elimina selezione">🗑 Elimina</ToolBtn>
      </div>

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
            style={{ border: `1px solid ${GB}`, borderRadius: "8px", cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
          >
            <Layer>
              {image && <KonvaImage image={image} width={dims.width} height={dims.height} name="bg" listening />}
              {shapes.map((s) => {
                if (s.type === "rect") {
                  return <Rect {...shapeProps(s)} x={s.x} y={s.y} width={s.width} height={s.height} stroke={s.stroke} strokeWidth={2} fill="transparent" rotation={s.rotation || 0} />;
                }
                if (s.type === "arrow") {
                  return <Arrow {...shapeProps(s)} points={s.points} stroke={s.stroke} fill={s.fill} strokeWidth={2} pointerLength={10} pointerWidth={8} />;
                }
                if (s.type === "text") {
                  return <KonvaText {...shapeProps(s)} x={s.x} y={s.y} text={s.text} fill={s.fill} fontSize={s.fontSize} fontStyle={s.fontStyle} rotation={s.rotation || 0} />;
                }
                return null;
              })}
              {/* Shape provvisoria in disegno (non interattiva) */}
              {draft && draft.type === "rect" && (
                <Rect x={draft.x} y={draft.y} width={draft.width} height={draft.height} stroke={draft.stroke} strokeWidth={2} fill="transparent" listening={false} />
              )}
              {draft && draft.type === "arrow" && (
                <Arrow points={draft.points} stroke={draft.stroke} fill={draft.fill} strokeWidth={2} pointerLength={10} pointerWidth={8} listening={false} />
              )}
              <Transformer
                ref={trRef}
                rotateEnabled
                resizeEnabled={selectedShape ? selectedShape.type !== "arrow" : true}
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
      </div>

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

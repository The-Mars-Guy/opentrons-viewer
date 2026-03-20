import { useState, useRef, useEffect, useCallback } from "react";
import { DECK_SLOTS, LABWARE_DEFS, PIPETTE_COLORS, THEMES } from "../constants";
import WellGrid from "./WellGrid";

// ── Deck Canvas ───────────────────────────────────────────────────────────────

export default function DeckCanvas({ labware, steps, selectedSlot, onSlotClick, draggingFrom, setDraggingFrom, hoveredWell, setHoveredWell, onWellDragOver, onConnectionDrop, onSlotDrop, onLabelEdit, onWellClick, theme = THEMES.dark, volumeMap = {}, liquidsBySlot = {} }) {
  const slotRefs     = useRef({});
  const wellRefs     = useRef({});
  const containerRef = useRef(null);
  const [positions,     setPositions]     = useState({});
  const [wellPositions, setWellPositions] = useState({});
  const [mousePos,      setMousePos]      = useState(null);
  // Track which slot the user is dragging a labware piece over (for drop highlight)
  const [dragOverSlot,  setDragOverSlot]  = useState(null);
  // Track which slot is being dragged from (labware-move), separate from well drags
  const [movingSlot,    setMovingSlot]    = useState(null);

  const handleWellRef = useCallback((slot, well, el) => {
    if (!wellRefs.current[slot]) wellRefs.current[slot] = {};
    wellRefs.current[slot][well] = el;
  }, []);

  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();

    const np = {};
    Object.entries(slotRefs.current).forEach(([slot, el]) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      np[slot] = { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    });
    setPositions(np);

    const wp = {};
    Object.entries(wellRefs.current).forEach(([slot, wells]) => {
      Object.entries(wells).forEach(([well, el]) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        wp[`${slot}:${well}`] = {
          x: r.left - cr.left + r.width / 2,
          y: r.top - cr.top + r.height / 2,
        };
      });
    });
    setWellPositions(wp);
  }, []);

  useEffect(() => {
    updatePositions();
    window.addEventListener("resize", updatePositions);
    const obs = new ResizeObserver(updatePositions);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => { window.removeEventListener("resize", updatePositions); obs.disconnect(); };
  }, [labware, updatePositions]);

  useEffect(() => {
    const t = setTimeout(updatePositions, 80);
    return () => clearTimeout(t);
  }, [labware, steps, updatePositions]);

  const resolvePos = (slot, well) => {
    const key = `${slot}:${well}`;
    if (wellPositions[key]) return wellPositions[key];
    if (positions[slot]) return positions[slot];
    return null;
  };

  // Build connection lines
  const connections = [];
  steps.forEach((s, si) => {
    if (s.type !== "transfer" || !s.sourceSlot || !s.sourceWell) return;
    const srcPos = resolvePos(s.sourceSlot, s.sourceWell);
    if (!srcPos) return;
    const lineColor = PIPETTE_COLORS[s.pipette] || "#22d3ee";
    const allDests = [
      ...(s.destSlot && s.destWell ? [{ slot: s.destSlot, well: s.destWell, volume: s.volume }] : []),
      ...(s.multiDests || []).map(d => ({
        slot: d.slot, well: d.well,
        volume: (d.volume != null && d.volume !== "") ? Number(d.volume) : (s.volume || 0),
      })),
    ];
    allDests.forEach((dst, di) => {
      if (!dst.slot || !dst.well) return;
      const dstPos = resolvePos(dst.slot, dst.well);
      if (!dstPos) return;
      connections.push({
        key: `${si}-${di}`,
        x1: srcPos.x, y1: srcPos.y,
        x2: dstPos.x, y2: dstPos.y,
        color: lineColor,
        srcSlot: s.sourceSlot, srcWell: s.sourceWell,
        dstSlot: dst.slot, dstWell: dst.well,
        volLabel: dst.volume,
        markerId: `arr-pip-${(s.pipette || "default").replace(/\W/g, "_")}`,
      });
    });
  });

  // Connected well highlights
  const connectedBySlot = {};
  steps.forEach(s => {
    if (s.type !== "transfer") return;
    if (s.sourceSlot && s.sourceWell) {
      if (!connectedBySlot[s.sourceSlot]) connectedBySlot[s.sourceSlot] = { src: new Set(), dst: new Set() };
      connectedBySlot[s.sourceSlot].src.add(s.sourceWell);
    }
    const dests = [
      ...(s.destSlot && s.destWell ? [{ slot: s.destSlot, well: s.destWell }] : []),
      ...(s.multiDests || []),
    ];
    dests.forEach(d => {
      if (!d.slot || !d.well) return;
      if (!connectedBySlot[d.slot]) connectedBySlot[d.slot] = { src: new Set(), dst: new Set() };
      connectedBySlot[d.slot].dst.add(d.well);
    });
  });

  const draftSrcPos = draggingFrom
    ? resolvePos(draggingFrom.slot, draggingFrom.well) || positions[draggingFrom.slot]
    : null;

  const handleMouseMove = e => {
    if (!draggingFrom) return;
    const r = containerRef.current?.getBoundingClientRect();
    if (r) setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove}
      onMouseUp={() => { if (draggingFrom) { setDraggingFrom(null); setMousePos(null); } }}
      style={{ position: "relative", userSelect: "none" }}>

      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }}>
        <defs>
          {Object.entries(PIPETTE_COLORS).map(([pip, color]) => (
            <marker key={pip} id={`arr-pip-${pip.replace(/\W/g, "_")}`}
              markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill={color} opacity="0.9" />
            </marker>
          ))}
          <marker id="arr-pip-default" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="#22d3ee" opacity="0.9" />
          </marker>
          <marker id="arr-draft" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="#fbbf24" opacity="0.9" />
          </marker>
        </defs>

        {connections.map((c) => {
          const dx = c.x2 - c.x1, dy = c.y2 - c.y1;
          const len = Math.sqrt(dx*dx + dy*dy) || 1;
          const ux = dx/len, uy = dy/len;
          const margin = 8;
          const x1 = c.x1 + ux*margin, y1 = c.y1 + uy*margin;
          const x2 = c.x2 - ux*margin, y2 = c.y2 - uy*margin;
          const mx = (x1+x2)/2, my = (y1+y2)/2;
          const perp = 14;
          const cpx = mx - uy*perp, cpy = my + ux*perp;
          const midBx = (x1 + 2*cpx + x2)/4, midBy = (y1 + 2*cpy + y2)/4;
          // Two compact lines: wells on top, volume below
          // Pill width just wide enough for the longer of the two strings
          const line1 = `${c.srcWell}→${c.dstWell}`;
          const line2 = `${c.volLabel}µL`;
          const pillW = Math.max(line1.length, line2.length) * 6 + 12;
          const pillH = 22;
          return (
            <g key={c.key}>
              <path d={`M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`}
                stroke={c.color} strokeWidth="4" strokeOpacity="0.07" fill="none" />
              <path d={`M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`}
                stroke={c.color} strokeWidth="1.5" strokeOpacity="0.65" fill="none"
                strokeDasharray="6 3" markerEnd={`url(#${c.markerId})`} />
              <circle cx={x1} cy={y1} r={3.5} fill={c.color} opacity="0.95" />
              <rect x={midBx - pillW/2} y={midBy - pillH/2} width={pillW} height={pillH} rx={5}
                fill={theme.bgCard || "#060e1d"} stroke={c.color} strokeOpacity="0.7" strokeWidth="1.1" />
              <text x={midBx} y={midBy - 2} textAnchor="middle" fill={c.color}
                fontSize="8" fontFamily="monospace" fontWeight="700" opacity="0.97">{line1}</text>
              <text x={midBx} y={midBy + 8} textAnchor="middle" fill={c.color}
                fontSize="8" fontFamily="monospace" opacity="0.8">{line2}</text>
            </g>
          );
        })}

        {draggingFrom && mousePos && draftSrcPos && (
          <>
            <circle cx={draftSrcPos.x} cy={draftSrcPos.y} r={3} fill="#fbbf24" opacity="0.9" />
            <line x1={draftSrcPos.x} y1={draftSrcPos.y} x2={mousePos.x} y2={mousePos.y}
              stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.8" strokeDasharray="4 3"
              markerEnd="url(#arr-draft)" />
          </>
        )}
      </svg>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, background: theme.bgDeck, padding: 14, borderRadius: 12, border: `1px solid ${theme.border}` }}>
        {DECK_SLOTS.map(slot => {
          const lw      = labware.find(l => l.slot === slot);
          const def     = lw ? LABWARE_DEFS[lw.def] : null;
          const isTrash = slot === "A3";
          const isSel   = selectedSlot === slot;
          const isMoving    = movingSlot === slot;
          const isDragTarget = dragOverSlot === slot && movingSlot && movingSlot !== slot;

          // Border: drag-target highlight > selected > occupied > empty
          let borderColor = theme.border;
          let borderStyle = "dashed";
          if (isDragTarget)   { borderColor = "#fbbf24"; borderStyle = "solid"; }
          else if (isSel)     { borderColor = "#fbbf24"; borderStyle = "solid"; }
          else if (lw)        { borderColor = def?.color || "#475569"; borderStyle = "solid"; }

          return (
            <div key={slot}
              ref={el => slotRefs.current[slot] = el}
              // ── Labware-move drag: the whole slot card is the drag source ──
              draggable={!!(lw && !isTrash)}
              onDragStart={e => {
                if (!lw || isTrash) return;
                // Don't interfere with well drags initiated inside the card
                if (e.target !== e.currentTarget && e.target.closest("[data-well-drag]")) return;
                setMovingSlot(slot);
                e.dataTransfer.setData("text/plain", JSON.stringify({ type: "labware-move", fromSlot: slot, def: lw.def }));
                e.dataTransfer.effectAllowed = "move";
                // Ghost: show just the label
                const ghost = document.createElement("div");
                ghost.textContent = `${def?.icon || "🧪"} ${lw.label || def?.shortLabel || slot}`;
                ghost.style.cssText = `position:fixed;top:-999px;left:-999px;padding:6px 12px;background:${def?.color || "#475569"};color:#fff;border-radius:6px;font-family:monospace;font-size:12px;font-weight:700;white-space:nowrap;`;
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 0, 0);
                setTimeout(() => document.body.removeChild(ghost), 0);
              }}
              onDragEnd={() => setMovingSlot(null)}
              // ── Drop target ──
              onDragOver={e => {
                e.preventDefault();
                setDragOverSlot(slot);
              }}
              onDragLeave={e => {
                // Only clear if leaving the slot card itself, not a child
                if (!e.currentTarget.contains(e.relatedTarget)) setDragOverSlot(null);
              }}
              onDrop={e => {
                e.preventDefault();
                setDragOverSlot(null);
                setMovingSlot(null);
                onSlotDrop(slot, e);
              }}
              onClick={() => onSlotClick(slot)}
              style={{
                minHeight: 140, borderRadius: 10, overflow: "hidden", position: "relative",
                border: `2px ${borderStyle} ${borderColor}`,
                background: isDragTarget
                  ? `${def?.color || "#fbbf24"}18`
                  : lw
                    ? `${(def?.color || "#475569")}0c`
                    : theme.bgSlot,
                // Show grab cursor on occupied slots (except trash), pointer for empty
                cursor: lw && !isTrash ? (isMoving ? "grabbing" : "grab") : "default",
                opacity: isMoving ? 0.5 : 1,
                transition: "border-color 0.12s, background 0.12s, opacity 0.12s",
                outline: isDragTarget ? `2px solid #fbbf2444` : "none",
                outlineOffset: -2,
              }}>

              {/* Slot label — top left */}
              <div style={{ fontSize: "0.71875rem", color: isDragTarget ? "#fbbf24" : theme.slotLabel, position: "absolute", top: 4, left: 6, fontFamily: "monospace", fontWeight: 700, zIndex: 2, letterSpacing: 0.5, transition: "color 0.12s" }}>
                {slot}
              </div>

              {isTrash ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.25 }}>
                  <span style={{ fontSize: 22 }}>🗑️</span>
                  <span style={{ fontSize: "0.65625rem", color: "#64748b", marginTop: 3 }}>Trash</span>
                </div>

              ) : lw && def ? (
                <>
                  {/* Label chip — click to rename, still works independently */}
                  <div
                    onClick={e => { e.stopPropagation(); onLabelEdit && onLabelEdit(slot, lw.label || ""); }}
                    title="Click to rename · Drag card to move"
                    style={{
                      position: "absolute", top: 4, right: 6, fontSize: "0.59375rem", color: def.color,
                      fontWeight: 700, maxWidth: 100, textAlign: "right", zIndex: 2, lineHeight: 1.2,
                      cursor: "text", padding: "1px 4px", borderRadius: 3,
                      border: "1px solid transparent", transition: "border-color 0.12s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${def.color}55`}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
                  >
                    {lw.label || def.shortLabel} ✏
                  </div>

                  {/* Drag hint — subtle, bottom-left, only on hover */}
                  {isSel && (
                    <div style={{ position: "absolute", bottom: 4, left: 6, fontSize: "0.5rem", color: `${def.color}66`, zIndex: 2, letterSpacing: 0.5 }}>
                      ⠿ drag to move · Del to remove
                    </div>
                  )}

                  <div style={{ paddingTop: 16 }} data-well-drag="true">
                    <WellGrid lw={lw} def={def}
                      onWellDragStart={(e, s, w) => {
                        setDraggingFrom({ slot: s, well: w });
                        e.dataTransfer.setData("text/plain", JSON.stringify({ type: "well-drag", slot: s, well: w }));
                        // Stop the slot-level drag from also firing
                        e.stopPropagation();
                      }}
                      onWellDrop={(ds, dw) => onConnectionDrop(ds, dw)}
                      onWellDragOver={onWellDragOver}
                      draggingFrom={draggingFrom} hoveredWell={hoveredWell} setHoveredWell={setHoveredWell}
                      onWellRef={handleWellRef}
                      connectedWells={connectedBySlot[slot] || null}
                      volumeMap={volumeMap}
                      liquidsBySlot={liquidsBySlot}
                      onWellClick={onWellClick}
                    />
                  </div>
                </>

              ) : !isTrash ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 100, gap: 4 }}>
                  {isDragTarget
                    ? <div style={{ fontSize: 20, opacity: 0.6 }}>📥</div>
                    : <div style={{ fontSize: 24, opacity: 0.15 }}>+</div>
                  }
                  <div style={{ fontSize: "0.65625rem", color: isDragTarget ? "#fbbf24" : "var(--text-dim,#64748b)", opacity: isDragTarget ? 0.9 : 0.5 }}>
                    {isDragTarget ? "drop here" : "drop labware"}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

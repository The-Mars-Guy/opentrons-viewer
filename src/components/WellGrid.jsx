import { fmtVol } from "../utils";

// ── Well Grid ─────────────────────────────────────────────────────────────────

export default function WellGrid({ lw, def, onWellDragStart, onWellDrop, onWellDragOver, draggingFrom, hoveredWell, setHoveredWell, onWellRef, connectedWells, volumeMap, liquidsBySlot, onWellClick }) {
  if (!def || def.shape === "tips") return (
    <div style={{ padding: 10, textAlign: "center", fontSize: "0.84375rem", color: def?.color || "#94a3b8", opacity: 0.5 }}>
      {def?.icon} Tip Rack
    </div>
  );

  const rows = def.rows || 2, cols = def.cols || 3;
  const maxCellFromCols = Math.floor(240 / (cols + 0.6));
  const maxCellFromRows = Math.floor(170 / (rows + 0.4));
  const cellSize = Math.min(48, Math.max(20, Math.min(maxCellFromCols, maxCellFromRows)));
  const gap = cols > 6 ? 3 : cols > 4 ? 4 : 7;

  const grid = Array.from({ length: rows * cols }, (_, idx) => {
    const r = String.fromCharCode(65 + Math.floor(idx / cols));
    const c = (idx % cols) + 1;
    const w = `${r}${c}`;
    return def.wells.includes(w) ? w : null;
  });

  return (
    <div style={{ padding: "4px 6px 8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`, gap, justifyContent: "center" }}>
        {grid.map((well, idx) => {
          if (!well) return <div key={`e-${idx}`} style={{ width: cellSize, height: cellSize }} />;
          const isFrom = draggingFrom?.slot === lw.slot && draggingFrom?.well === well;
          const isHov = hoveredWell?.slot === lw.slot && hoveredWell?.well === well;
          const isSrc = connectedWells?.src?.has(well);
          const isDst = connectedWells?.dst?.has(well);
          const sz = def.wellSizes?.[well] || "sm";

          const br = sz === "lg" ? "28%" : "50%";
          const sc = isFrom ? 0.90 : isHov ? 0.86 : 0.80;

          let ringColor = null;
          if (isSrc && isDst) ringColor = "#f59e0b";
          else if (isSrc) ringColor = "#22d3ee";
          else if (isDst) ringColor = "#a78bfa";

          const bgColor = isFrom
            ? def.color
            : (isHov && draggingFrom)
              ? `${def.color}88`
              : ringColor
                ? `${ringColor}18`
                : "transparent";

          const borderColor = isFrom
            ? def.color
            : isHov
              ? def.color
              : ringColor
                ? ringColor
                : `${def.color}40`;

          const borderW = (sz === "lg" || isFrom || isHov || ringColor) ? 2 : 1.5;

          return (
            <div key={well}
              title={(() => {
                const vm = volumeMap?.[`${lw.slot}:${well}`];
                const liqName = liquidsBySlot?.[`${lw.slot}:${well}`];
                const base = `${lw.label || lw.slot} — ${well}${def.wellLabels?.[well] ? ` (${def.wellLabels[well]})` : ""}`;
                if (vm?.initial > 0) return `${base} · ${liqName?.name || "liquid"}: ${fmtVol(vm.remaining, def)} remaining · click to edit`;
                return `${base} · click to assign liquid`;
              })()}
              ref={el => onWellRef && onWellRef(lw.slot, well, el)}
              draggable
              onDragStart={e => onWellDragStart(e, lw.slot, well)}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setHoveredWell({ slot: lw.slot, well }); onWellDragOver(lw.slot, well); }}
              onDragLeave={() => setHoveredWell(null)}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onWellDrop(lw.slot, well); }}
              onClick={e => { e.stopPropagation(); if (def?.shape !== "tips" && onWellClick) onWellClick(lw.slot, well); }}
              style={{ width: cellSize, height: cellSize, display: "flex", alignItems: "center", justifyContent: "center", cursor: def?.shape === "tips" ? "default" : "pointer" }}>
              {(() => {
                const vm = volumeMap?.[`${lw.slot}:${well}`];
                const liq = liquidsBySlot?.[`${lw.slot}:${well}`];
                const fillFrac = (vm && vm.capacity > 0)
                  ? Math.max(0, Math.min(1, vm.remaining / vm.capacity))
                  : (vm?.initial > 0 ? 0.5 : 0);
                const showFill = !isFrom && !isHov && vm?.initial > 0 && fillFrac > 0;
                const fillColor = liq?.color || def.color;
                return (
                  <div style={{
                    width: `${sc * 100}%`, height: `${sc * 100}%`,
                    borderRadius: br,
                    background: showFill ? "transparent" : bgColor,
                    border: `${borderW}px solid ${borderColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: cellSize >= 34 ? 9 : 7,
                    color: isFrom ? "#fff" : ringColor ? ringColor : `${def.color}88`,
                    fontWeight: 700,
                    transition: "all 0.12s",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    position: "relative",
                    boxShadow: isFrom
                      ? `0 0 10px ${def.color}cc, inset 0 0 5px ${def.color}33`
                      : ringColor
                        ? `0 0 8px ${ringColor}44`
                        : showFill
                          ? `0 0 6px ${fillColor}55`
                          : "none",
                  }}>
                    {showFill && (
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        height: `${fillFrac * 100}%`,
                        background: `${fillColor}55`,
                        borderRadius: `0 0 calc(${br} - 1px) calc(${br} - 1px)`,
                        transition: "height 0.3s ease",
                        pointerEvents: "none",
                      }} />
                    )}
                    {!showFill && ringColor && (
                      <div style={{ position: "absolute", inset: 0, background: `${ringColor}18`, borderRadius: br, pointerEvents: "none" }} />
                    )}
                    <span style={{ position: "relative", zIndex: 1 }}>
                      {cellSize >= 30 && sz !== "xs" ? well : ""}
                    </span>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

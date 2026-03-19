import { useState } from "react";
import { LABWARE_DEFS, PIPETTES, SOLVENT_PRESETS, WELL_CAPACITY, DEAD_VOLUME } from "../constants";
import { fmtVol, parseVolInput } from "../utils";
import { Modal, Label } from "./SharedUI";

// ── Connection Modal ──────────────────────────────────────────────────────────

export function ConnectionModal({ conn, labware, onConfirm, onAddToStep, onCancel }) {
  const [vol, setVol] = useState(100);
  const [pipette, setPipette] = useState("flex_1channel_1000");
  const [preset, setPreset] = useState("");
  const [mode, setMode] = useState(conn.existingSourceSteps?.length > 0 ? "choose" : "new");
  const srcLw = labware.find(l => l.slot === conn.srcSlot);
  const dstLw = labware.find(l => l.slot === conn.dstSlot);
  const existing = conn.existingSourceSteps || [];

  const routeLabel = (
    <span style={{ fontSize: "0.71875rem", color: "var(--text-dim,#64748b)" }}>
      <span style={{ color: "#22d3ee" }}>{srcLw?.label || conn.srcSlot}[{conn.srcWell}]</span>
      {" → "}
      <span style={{ color: "#a78bfa" }}>{dstLw?.label || conn.dstSlot}[{conn.dstWell}]</span>
    </span>
  );

  if (mode === "choose") {
    return (
      <Modal>
        <div style={{ fontSize: "0.84375rem", fontWeight: 700, marginBottom: 6 }}>Wire {routeLabel}</div>
        <div style={{ fontSize: "0.65625rem", color: "var(--text-dim,#64748b)", marginBottom: 10 }}>
          This source well already has {existing.length} step{existing.length !== 1 ? "s" : ""}. Add as a destination or create a new step.
        </div>
        {existing.map(({ s, i }) => {
          const destCount = (s.multiDests?.filter(d => d.slot && d.well).length || 0) + (s.destSlot && s.destWell ? 1 : 0);
          return (
            <div key={i} onClick={() => onAddToStep(i, conn.dstSlot, conn.dstWell)}
              style={{ background: "var(--bg-panel,#060e1d)", border: "1px solid #22d3ee33", borderLeft: "3px solid #22d3ee", borderRadius: 7, padding: "9px 12px", marginBottom: 6, cursor: "pointer", transition: "border-color 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#22d3ee88"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#22d3ee33"}>
              <div style={{ fontSize: "0.71875rem", color: "#22d3ee", fontWeight: 700, marginBottom: 2 }}>
                ➕ Add to Step {i + 1}
              </div>
              <div style={{ fontSize: "0.65625rem", color: "var(--text-dim,#64748b)" }}>
                {PIPETTES[s.pipette]?.label || "?"} · {s.volume}µL · {destCount} dest{destCount !== 1 ? "s" : ""} currently
              </div>
            </div>
          );
        })}
        <div onClick={() => setMode("new")}
          style={{ background: "var(--bg-panel,#060e1d)", border: "1px solid var(--border,#1e293b)", borderLeft: "3px solid #6366f1", borderRadius: 7, padding: "9px 12px", marginBottom: 10, cursor: "pointer", transition: "border-color 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border,#1e293b)"}>
          <div style={{ fontSize: "0.71875rem", color: "#818cf8", fontWeight: 700 }}>🆕 Create new transfer step</div>
        </div>
        <button onClick={onCancel} style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem" }}>Cancel</button>
      </Modal>
    );
  }

  return (
    <Modal>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {existing.length > 0 && (
          <button onClick={() => setMode("choose")} style={{ background: "none", border: "none", color: "var(--text-dim,#64748b)", cursor: "pointer", fontSize: "1.03125rem", padding: 0, lineHeight: 1 }}>←</button>
        )}
        <div style={{ fontSize: "0.84375rem", fontWeight: 700 }}>New Transfer</div>
      </div>
      <div style={{ fontSize: "0.71875rem", marginBottom: 12 }}>{routeLabel}</div>
      <div style={{ marginBottom: 8 }}>
        <Label>VOLUME (µL)</Label>
        <input type="number" value={vol} onChange={e => setVol(parseFloat(e.target.value))}
          style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 5, padding: "6px 8px", color: "var(--input-color,#e2e8f0)", fontSize: "0.84375rem", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <Label>PIPETTE</Label>
        <select value={pipette} onChange={e => setPipette(e.target.value)}
          style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 5, padding: "6px 8px", color: "var(--input-color,#e2e8f0)", fontSize: "0.78125rem", fontFamily: "inherit" }}>
          {Object.entries(PIPETTES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>SOLVENT PRESET</Label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[["", "None"], ...Object.entries(SOLVENT_PRESETS).map(([k, p]) => [k, p.label])].map(([k, l]) => (
            <button key={k} onClick={() => setPreset(k)}
              style={{ background: preset === k ? "#22d3ee" : "var(--input-bg,#0a1628)", color: preset === k ? "#020817" : "var(--text-dim,#64748b)", border: `1px solid ${preset === k ? "#22d3ee" : "var(--input-border,#1e293b)"}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit" }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        <button onClick={onCancel} style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem" }}>Cancel</button>
        <button onClick={() => onConfirm(vol, pipette, preset || null)} style={{ flex: 2, background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem", fontWeight: 700 }}>Add Transfer</button>
      </div>
    </Modal>
  );
}

// ── Well Info Modal ───────────────────────────────────────────────────────────

export function WellInfoModal({ slot, well, lw, def, volumeMap, liquids, setLiquids, labware, onClose }) {
  const key = `${slot}:${well}`;
  const vm = volumeMap?.[key];
  const isTube = def?.shape === "tube";
  const existingLiq = liquids.find(l => l.slot === slot && l.well === well);
  const [editName, setEditName] = useState(existingLiq?.name || "");
  const [editColor, setEditColor] = useState(existingLiq?.color || "#06b6d4");
  const [editVol, setEditVol] = useState(
    existingLiq ? (isTube ? (existingLiq.volume / 1000).toString() : existingLiq.volume.toString()) : ""
  );
  const [editDesc, setEditDesc] = useState(existingLiq?.description || "");

  const wellLabel = def?.wellLabels?.[well] || well;
  const sz = def?.wellSizes?.[well] || "sm";
  const capacity = WELL_CAPACITY[lw?.def]?.[sz];
  const dead = DEAD_VOLUME[lw?.def]?.[sz];
  const unit = isTube ? "mL" : "µL";

  const QUICK_COLORS = ["#06b6d4","#22d3ee","#a78bfa","#f59e0b","#f97316","#22c55e","#ef4444","#e879f9","#2563eb","#84cc16"];

  const save = () => {
    const vol = parseVolInput(editVol, isTube);
    if (existingLiq) {
      setLiquids(prev => prev.map(l =>
        l.id === existingLiq.id
          ? { ...l, name: editName, color: editColor, volume: vol, description: editDesc }
          : l
      ));
    } else {
      setLiquids(prev => [...prev, {
        id: Date.now(), name: editName || "Liquid", description: editDesc,
        color: editColor, slot, well, volume: vol
      }]);
    }
    onClose();
  };

  const removeLiquid = () => {
    if (existingLiq) setLiquids(prev => prev.filter(l => l.id !== existingLiq.id));
    onClose();
  };

  return (
    <Modal>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: "0.84375rem", fontWeight: 700, color: "#f1f5f9" }}>
            {lw?.label || slot} — <span style={{ color: def?.color || "#06b6d4" }}>{well}</span>
          </div>
          <div style={{ fontSize: "0.65625rem", color: "#94a3b8", marginTop: 2 }}>
            {wellLabel}{capacity ? ` · ${fmtVol(capacity, def)} capacity` : ""}
            {dead ? ` · ${fmtVol(dead, def)} dead vol` : ""}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.15625rem", lineHeight: 1, padding: "0 2px" }}>✕</button>
      </div>

      {/* Volume tracker */}
      {vm && vm.initial > 0 && (
        <div style={{ background: "#060e1d", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
          <div style={{ fontSize: "0.65625rem", color: "#64748b", marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>VOLUME TRACKER</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.71875rem" }}>
            <span style={{ color: "#94a3b8" }}>Initial</span>
            <span style={{ color: "#e2e8f0" }}>{fmtVol(vm.initial, def)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.71875rem", marginTop: 2 }}>
            <span style={{ color: "#94a3b8" }}>Remaining</span>
            <span style={{ color: vm.remaining < 0 ? "#ef4444" : vm.remaining < (dead || 0) ? "#f59e0b" : "#22c55e" }}>
              {fmtVol(vm.remaining, def)}
            </span>
          </div>
          {capacity && (
            <div style={{ marginTop: 6, height: 5, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${Math.min(100, Math.max(0, (vm.remaining / capacity) * 100))}%`,
                background: vm.remaining < 0 ? "#ef4444" : vm.remaining < (dead || 0) ? "#f59e0b" : "#06b6d4",
                transition: "width 0.3s"
              }} />
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: "0.65625rem", color: "#94a3b8", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
        {existingLiq ? "EDIT LIQUID" : "ASSIGN LIQUID"}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
          style={{ width: 28, height: 28, border: "none", background: "none", cursor: "pointer", borderRadius: 4, flexShrink: 0 }} />
        <input value={editName} onChange={e => setEditName(e.target.value)}
          placeholder="Liquid name (e.g. Hexane, BHA Matrix)"
          style={{ flex: 1, fontSize: "0.78125rem", background: "#0a1628", border: "1px solid #1e293b", borderRadius: 4, padding: "5px 8px", color: "#f1f5f9", fontFamily: "inherit" }} />
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        {QUICK_COLORS.map(c => (
          <div key={c} onClick={() => setEditColor(c)}
            style={{ width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer", border: `2px solid ${editColor === c ? "#fff" : "transparent"}`, transition: "border-color 0.1s" }} />
        ))}
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: "0.65625rem", color: "#64748b", marginBottom: 3 }}>INITIAL VOLUME ({unit})</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="number" value={editVol} onChange={e => setEditVol(e.target.value)}
            placeholder={isTube ? "e.g. 10 mL" : "e.g. 500 µL"}
            style={{ flex: 1, fontSize: "0.78125rem", background: "#0a1628", border: "1px solid #1e293b", borderRadius: 4, padding: "5px 8px", color: "#f1f5f9", fontFamily: "inherit" }} />
          <span style={{ fontSize: "0.71875rem", color: "#64748b", flexShrink: 0 }}>{unit}</span>
        </div>
        {isTube && <div style={{ fontSize: "0.59375rem", color: "#64748b", marginTop: 2 }}>Enter in mL — pipette steps use µL</div>}
      </div>

      <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
        placeholder="Description (optional)"
        style={{ width: "100%", fontSize: "0.71875rem", background: "#0a1628", border: "1px solid #1e293b", borderRadius: 4, padding: "4px 8px", color: "#94a3b8", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />

      <div style={{ display: "flex", gap: 6 }}>
        {existingLiq && (
          <button onClick={removeLiquid}
            style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444", borderRadius: 5, padding: "6px 10px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit" }}>
            Remove
          </button>
        )}
        <button onClick={onClose}
          style={{ flex: 1, background: "#0a1628", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 5, padding: "6px 0", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={save}
          style={{ flex: 2, background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 5, padding: "6px 0", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700 }}>
          {existingLiq ? "Save" : "Assign Liquid"}
        </button>
      </div>
    </Modal>
  );
}

// ── Liquid Panel ──────────────────────────────────────────────────────────────

export function LiquidPanel({ liquids, setLiquids, labware }) {
  const addLiquid = () => setLiquids(prev => [...prev, {
    id: Date.now(), name: "", description: "", color: "#06b6d4", slot: "", well: "", volume: 0
  }]);
  const update = (id, k, v) => setLiquids(prev => prev.map(l => l.id === id ? { ...l, [k]: v } : l));
  const remove = id => setLiquids(prev => prev.filter(l => l.id !== id));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: "0.65625rem", color: "#94a3b8", letterSpacing: 1.5 }}>LIQUIDS ({liquids.length})</div>
        <button onClick={addLiquid} style={{ fontSize: "0.65625rem", background: "#06b6d415", border: "1px solid #06b6d433", color: "#06b6d4", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>+ Liquid</button>
      </div>
      {liquids.length === 0 && (
        <div style={{ textAlign: "center", color: "#64748b", padding: "16px 0", border: "2px dashed #334155", borderRadius: 8, fontSize: "0.71875rem", lineHeight: 1.7 }}>
          Define liquids for volume tracking<br />
          <span style={{ fontSize: "0.65625rem", color: "#475569" }}>Tip: click any tube/vial on the deck</span>
        </div>
      )}
      {liquids.map(liq => {
        const slotLw = labware.find(l => l.slot === liq.slot);
        const slotDef = slotLw ? LABWARE_DEFS[slotLw.def] : null;
        const isTube = slotDef?.shape === "tube";
        const unit = isTube ? "mL" : "µL";
        const displayVol = isTube ? (liq.volume / 1000) : liq.volume;
        return (
          <div key={liq.id} style={{ background: "var(--bg-panel, #060e1d)", border: "1px solid var(--border, #0f172a)", borderLeft: `3px solid ${liq.color}`, borderRadius: 6, padding: "8px 10px", marginBottom: 5 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
              <input type="color" value={liq.color} onChange={e => update(liq.id,"color",e.target.value)}
                style={{ width: 22, height: 22, border: "none", background: "none", cursor: "pointer", borderRadius: 3 }} />
              <input value={liq.name} onChange={e => update(liq.id,"name",e.target.value)}
                placeholder="Liquid name (e.g. Hexane)"
                style={{ flex: 1, fontSize: "0.78125rem", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 4, padding: "3px 7px", color: "var(--input-color,#f1f5f9)", fontFamily: "inherit" }} />
              <button onClick={() => remove(liq.id)} style={{ fontSize: "0.78125rem", background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
            </div>
            <input value={liq.description||""} onChange={e => update(liq.id,"description",e.target.value)}
              placeholder="Description (optional)"
              style={{ width: "100%", fontSize: "0.71875rem", background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 7px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 5 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              <select value={liq.slot||""} onChange={e => update(liq.id,"slot",e.target.value)}
                style={{ fontSize: "0.71875rem", background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 6px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit" }}>
                <option value="">Slot…</option>
                {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => <option key={l.slot} value={l.slot}>{l.slot}: {l.label || LABWARE_DEFS[l.def]?.shortLabel}</option>)}
              </select>
              <select value={liq.well||""} onChange={e => update(liq.id,"well",e.target.value)}
                style={{ fontSize: "0.71875rem", background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 6px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit" }}>
                <option value="">Well…</option>
                {(slotDef?.wells || []).map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <input type="number" value={displayVol||""} onChange={e => {
                  const raw = parseFloat(e.target.value)||0;
                  update(liq.id,"volume", isTube ? raw * 1000 : raw);
                }}
                  placeholder="Vol"
                  style={{ fontSize: "0.71875rem", background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 4px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit", width: "100%", minWidth: 0 }} />
                <span style={{ fontSize: "0.59375rem", color: "#64748b", flexShrink: 0 }}>{unit}</span>
              </div>
            </div>
            {isTube && <div style={{ fontSize: "0.59375rem", color: "#475569", marginTop: 3 }}>Volume in mL — stored as µL for protocol</div>}
          </div>
        );
      })}
    </div>
  );
}

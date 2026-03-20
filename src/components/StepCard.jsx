import { useState, useRef, useEffect } from "react";
import { LABWARE_DEFS, PIPETTES, SOLVENT_PRESETS, TIP_POLICIES, PIPETTE_COLORS, LIQUID_CLASSES } from "../constants";
import { Label } from "./SharedUI";

// ── Collapsible section wrapper ───────────────────────────────────────────────

function Section({ title, badge, defaultOpen = true, accent, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 6, borderRadius: 5, overflow: "hidden", border: "1px solid var(--border,#0f172a)" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "5px 9px", cursor: "pointer", userSelect: "none",
          background: open ? `${accent || "#22d3ee"}08` : "transparent",
          borderBottom: open ? "1px solid var(--border,#0f172a)" : "none",
          transition: "background 0.1s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.59375rem", color: accent || "#22d3ee", fontWeight: 700, letterSpacing: 1 }}>
            {title}
          </span>
          {badge && (
            <span style={{ fontSize: "0.5rem", background: `${accent || "#22d3ee"}18`, color: accent || "#22d3ee", border: `1px solid ${accent || "#22d3ee"}33`, borderRadius: 8, padding: "1px 5px" }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.65625rem", color: "#475569" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "9px 9px 7px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Step Card ─────────────────────────────────────────────────────────────────

export default function StepCard({ step, index, labware, onRemove, onUpdate, onMoveUp, onMoveDown, onDuplicate, isFirst, isLast, autoExpand, onExpandedChange, steps, onCopySettings, stepTime }) {
  const [expanded, setExpanded] = useState(false);
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copyTargets, setCopyTargets] = useState(new Set());
  const prevAutoExpand = useRef(false);

  useEffect(() => {
    if (autoExpand && !prevAutoExpand.current) setExpanded(true);
    prevAutoExpand.current = !!autoExpand;
  }, [autoExpand]);

  const src    = labware.find(l => l.slot === step.sourceSlot);
  const dst    = labware.find(l => l.slot === step.destSlot);
  const srcDef = src ? LABWARE_DEFS[src.def] : null;
  const dstDef = dst ? LABWARE_DEFS[dst.def] : null;
  const pip        = PIPETTES[step.pipette];
  const volWarn    = pip && step.volume && step.volume > pip.maxVol;
  const incomplete = !step.sourceSlot || !step.pipette || (step.type === "transfer" && !step.destSlot);
  const isTx       = step.type === "transfer";
  const multiDests = step.multiDests || [];

  const usingLiquidClass = !!(step.liquidClass && step.liquidClass !== "");

  // Tip carry context
  const nextStep           = steps[index + 1] || null;
  const prevStep           = steps[index - 1] || null;
  const tipIsCarriedIn     = prevStep?.keepTipAfterStep && prevStep?.pipette === step.pipette;
  const nextSamePipette    = nextStep && nextStep.pipette && nextStep.pipette === step.pipette;
  const nextDifferentPipette = step.keepTipAfterStep && nextStep && nextStep.pipette && nextStep.pipette !== step.pipette;

  // Compute total volume across all dests for the header summary
  // Primary dest always uses step.volume; additional dests may override
  const allDestVols = [
    (step.volume || 0),
    ...multiDests.map(d => (d.volume != null && d.volume !== "") ? Number(d.volume) : (step.volume || 0)),
  ];
  const totalDestVol  = allDestVols.reduce((a, b) => a + b, 0);
  const destCount     = 1 + multiDests.filter(d => d.slot && d.well).length;
  const hasVarVols    = isTx && allDestVols.some(v => v !== allDestVols[0]);

  const inp = {
    fontSize: "0.78125rem",
    background: "var(--input-bg, #0a1628)",
    border: "1px solid var(--input-border, #1e293b)",
    borderRadius: 4, padding: "4px 7px",
    color: "var(--input-color, #e2e8f0)",
    width: "100%", fontFamily: "inherit", boxSizing: "border-box"
  };
  const sel = { ...inp };

  const btnXs = {
    background: "none", border: "none", cursor: "pointer", fontSize: "0.84375rem",
    padding: "1px 3px", fontFamily: "inherit", color: "#475569"
  };

  const applyPreset = key => {
    const p = SOLVENT_PRESETS[key];
    Object.entries(p).forEach(([k, v]) => {
      if (k !== "label") onUpdate(index, k, v);
    });
  };

  // Helper: update a multiDest entry
  const updateDest = (mi, patch) => {
    const nd = [...multiDests];
    nd[mi] = { ...nd[mi], ...patch };
    onUpdate(index, "multiDests", nd);
  };

  return (
    <div style={{
      background: "var(--bg-panel, #060e1d)",
      border: `1px solid ${incomplete ? "#450a0a" : "var(--border, #0f172a)"}`,
      borderLeft: `3px solid ${isTx ? (PIPETTE_COLORS[step.pipette] || "#22d3ee") : "#a78bfa"}`,
      borderRadius: 7, overflow: "hidden"
    }}>

      {/* ── Card header ── */}
      <div onClick={() => { const next = !expanded; setExpanded(next); onExpandedChange?.(next); }}
        style={{ padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: "0.65625rem",
            background: isTx ? `${PIPETTE_COLORS[step.pipette] || "#22d3ee"}18` : "#a78bfa18",
            color: isTx ? (PIPETTE_COLORS[step.pipette] || "#22d3ee") : "#a78bfa",
            padding: "2px 6px", borderRadius: 20, fontWeight: 700, letterSpacing: 0.8, flexShrink: 0
          }}>{isTx ? "XFER" : "MIX"}</span>
          {pip && <span style={{ fontSize: "0.65625rem", flexShrink: 0 }}>{pip.icon}</span>}
          {usingLiquidClass && (
            <span style={{ fontSize: "0.59375rem", background: "#6366f118", color: "#818cf8", border: "1px solid #6366f144", padding: "1px 5px", borderRadius: 10, flexShrink: 0 }}>
              {step.liquidClass}
            </span>
          )}
          {tipIsCarriedIn && (
            <span title="Tip carried in" style={{ fontSize: "0.59375rem", background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b44", padding: "1px 5px", borderRadius: 10, flexShrink: 0 }}>↓tip</span>
          )}
          {step.keepTipAfterStep && (
            <span title="Tip carries out" style={{ fontSize: "0.59375rem", background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b44", padding: "1px 5px", borderRadius: 10, flexShrink: 0 }}>tip↓</span>
          )}
          <span style={{ fontSize: "0.71875rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isTx ? (() => {
              const destLabel = destCount > 1
                ? hasVarVols
                  ? `${destCount} dests · ${totalDestVol}µL total (var)`
                  : `${destCount} dests · ${totalDestVol}µL total`
                : `${step.destSlot||"?"}[${step.destWell||"?"}] · ${step.volume||"?"}µL`;
              return `${step.sourceSlot||"?"}[${step.sourceWell||"?"}] → ${destLabel}`;
            })()
              : `${step.mixReps||3}× ${step.volume||"?"}µL in ${step.sourceSlot||"?"}[${step.sourceWell||"?"}]`
            }
          </span>
          {incomplete && <span style={{ fontSize: "0.65625rem", color: "#ef4444", flexShrink: 0 }}>⚠</span>}
          {volWarn    && <span style={{ fontSize: "0.65625rem", color: "#f59e0b", flexShrink: 0 }} title="Volume exceeds pipette max">⚡</span>}
          {hasVarVols && <span style={{ fontSize: "0.59375rem", color: "#a78bfa", flexShrink: 0 }} title="Variable volumes per destination">∿</span>}
          {stepTime > 0 && <span style={{ fontSize: "0.59375rem", color: "#475569", flexShrink: 0, marginLeft: 2 }}>⏱{stepTime < 60 ? `${stepTime}s` : `${Math.floor(stepTime/60)}m${stepTime%60 ? `${stepTime%60}s` : ""}`}</span>}
        </div>
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {!isFirst && <button onClick={e => { e.stopPropagation(); onMoveUp(index); }} style={btnXs}>↑</button>}
          {!isLast  && <button onClick={e => { e.stopPropagation(); onMoveDown(index); }} style={btnXs}>↓</button>}
          <button onClick={e => { e.stopPropagation(); onDuplicate(index); }} style={{ ...btnXs, color: "#06b6d4" }} title="Duplicate">⎘</button>
          <button onClick={e => { e.stopPropagation(); onRemove(index); }} style={{ ...btnXs, color: "#ef4444" }}>✕</button>
          <span style={{ color: "#475569", fontSize: "0.78125rem" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 10px 12px", borderTop: "1px solid var(--border,#0f172a)", paddingTop: 8 }}>

          {/* ══ SECTION: ROUTING ══ */}
          <Section title="ROUTING" defaultOpen={true} accent="#22d3ee">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 18px 1fr", gap: 6, alignItems: "start" }}>
              <div>
                <Label>FROM</Label>
                <select value={step.sourceSlot||""} onChange={e => onUpdate(index,"sourceSlot",e.target.value)} style={sel}>
                  <option value="">Slot…</option>
                  {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => (
                    <option key={l.slot} value={l.slot}>{l.slot}: {l.label || LABWARE_DEFS[l.def]?.shortLabel}</option>
                  ))}
                </select>
                {srcDef && (
                  <select value={step.sourceWell||""} onChange={e => onUpdate(index,"sourceWell",e.target.value)} style={{ ...sel, marginTop: 3 }}>
                    <option value="">Well…</option>
                    {srcDef.wells.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                )}
              </div>
              <div style={{ color: "#22d3ee", fontSize: "0.90625rem", textAlign: "center", paddingTop: 20 }}>→</div>
              <div>
                {isTx ? (
                  <>
                    <Label>PRIMARY DEST</Label>
                    <select value={step.destSlot||""} onChange={e => onUpdate(index,"destSlot",e.target.value)} style={sel}>
                      <option value="">Slot…</option>
                      {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => (
                        <option key={l.slot} value={l.slot}>{l.slot}: {l.label || LABWARE_DEFS[l.def]?.shortLabel}</option>
                      ))}
                    </select>
                    {dstDef && (
                      <select value={step.destWell||""} onChange={e => onUpdate(index,"destWell",e.target.value)} style={{ ...sel, marginTop: 3 }}>
                        <option value="">Well…</option>
                        {dstDef.wells.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: "0.71875rem", color: "var(--text-dim,#64748b)", fontStyle: "italic", paddingTop: 20 }}>same well</div>
                )}
              </div>
            </div>
          </Section>

          {/* ══ SECTION: DESTINATIONS & VOLUMES ══ */}
          {isTx && (
            <Section
              title="DESTINATIONS & VOLUMES"
              badge={destCount > 1 ? `${destCount} dests · ${totalDestVol}µL total` : null}
              defaultOpen={true}
              accent="#22d3ee"
            >
              {/* Default volume — applies to any dest without its own override */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                <div>
                  <Label>Pipette</Label>
                  <select value={step.pipette||""} onChange={e => onUpdate(index,"pipette",e.target.value)} style={sel}>
                    <option value="">Select…</option>
                    {Object.entries(PIPETTES).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Default volume (µL)</Label>
                  <input type="number" value={step.volume||""} onChange={e => onUpdate(index,"volume",parseFloat(e.target.value))} style={inp} placeholder="100" />
                  {pip && step.volume > pip.maxVol && <div style={{ fontSize: "0.59375rem", color: "#f59e0b", marginTop: 2 }}>⚡ {Math.ceil(step.volume/pip.maxVol)} trips</div>}
                </div>
                <div>
                  <Label>Air gap (µL)</Label>
                  <input type="number" value={step.airGap||""} onChange={e => onUpdate(index,"airGap",parseFloat(e.target.value)||0)} style={inp} placeholder="0" />
                </div>
              </div>


              {/* Additional destinations */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: "0.59375rem", color: "#475569", letterSpacing: 0.8 }}>
                    ADDITIONAL DESTINATIONS ({multiDests.length})
                  </div>
                  <button
                    onClick={() => onUpdate(index, "multiDests", [...multiDests, { slot: step.destSlot||"", well: "", volume: null }])}
                    style={{ fontSize: "0.65625rem", background: "#22d3ee15", border: "1px solid #22d3ee33", color: "#22d3ee", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>
                    + Add
                  </button>
                </div>
                {multiDests.map((md, mi) => {
                  const mdLw    = labware.find(l => l.slot === md.slot);
                  const mdDef   = mdLw ? LABWARE_DEFS[mdLw.def] : null;
                  const effVol  = (md.volume != null && md.volume !== "") ? md.volume : (step.volume || 0);
                  const isOverridden = md.volume != null && md.volume !== "";
                  return (
                    <div key={mi} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                      {/* Slot */}
                      <select value={md.slot||""} onChange={e => updateDest(mi, { slot: e.target.value, well: "" })} style={{ ...sel, flex: "0 0 68px" }}>
                        <option value="">Slot…</option>
                        {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => (
                          <option key={l.slot} value={l.slot}>{l.slot}</option>
                        ))}
                      </select>
                      {/* Well */}
                      <select value={md.well||""} onChange={e => updateDest(mi, { well: e.target.value })} style={{ ...sel, flex: "0 0 58px" }}>
                        <option value="">Well…</option>
                        {(mdDef?.wells || []).map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                      {/* Volume override — blank = use default (step.volume) */}
                      <div style={{ flex: 1, position: "relative" }}>
                        <input
                          type="number"
                          value={md.volume ?? ""}
                          onChange={e => updateDest(mi, { volume: e.target.value === "" ? null : parseFloat(e.target.value) })}
                          placeholder={String(step.volume || 100)}
                          style={{
                            ...inp,
                            borderColor: isOverridden ? "#a78bfa44" : "var(--input-border,#1e293b)",
                            color: isOverridden ? "#a78bfa" : "var(--input-color,#e2e8f0)",
                          }}
                        />
                      </div>
                      {/* Live effective volume badge */}
                      <span style={{
                        fontSize: "0.59375rem", flexShrink: 0, minWidth: 36, textAlign: "right",
                        color: isOverridden ? "#a78bfa" : "#475569",
                        fontWeight: isOverridden ? 700 : 400,
                      }}>
                        {effVol}µL
                      </span>
                      {isOverridden && (
                        <button onClick={() => updateDest(mi, { volume: null })}
                          style={{ fontSize: "0.71875rem", background: "none", border: "none", color: "#475569", cursor: "pointer", padding: "0 1px" }} title="Reset to default">↺</button>
                      )}
                      <button onClick={() => onUpdate(index, "multiDests", multiDests.filter((_,j) => j !== mi))}
                        style={{ fontSize: "0.78125rem", background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0 2px" }}>✕</button>
                    </div>
                  );
                })}
                {multiDests.length > 0 && (
                  <div style={{ fontSize: "0.59375rem", color: "#475569", marginTop: 3, lineHeight: 1.5 }}>
                    Leave volume blank to use the default · Purple = overridden · ↺ = reset to default
                  </div>
                )}
              </div>

              {/* Tip policy */}
              <div style={{ marginTop: 8 }}>
                <Label>TIP POLICY</Label>
                <select value={step.tipPolicy||"new_each"} onChange={e => onUpdate(index,"tipPolicy",e.target.value)} style={sel}>
                  {Object.entries(TIP_POLICIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </Section>
          )}

          {/* Mix params (non-transfer) */}
          {!isTx && (
            <Section title="MIX PARAMETERS" defaultOpen={true} accent="#a78bfa">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <div>
                  <Label>Pipette</Label>
                  <select value={step.pipette||""} onChange={e => onUpdate(index,"pipette",e.target.value)} style={sel}>
                    <option value="">Select…</option>
                    {Object.entries(PIPETTES).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Volume (µL)</Label>
                  <input type="number" value={step.volume||""} onChange={e => onUpdate(index,"volume",parseFloat(e.target.value))} style={inp} placeholder="50" />
                </div>
                <div>
                  <Label>Reps</Label>
                  <input type="number" value={step.mixReps||3} onChange={e => onUpdate(index,"mixReps",parseInt(e.target.value))} style={inp} />
                </div>
              </div>
            </Section>
          )}

          {/* ══ SECTION: LIQUID CLASS ══ */}
          {isTx && (
            <Section title="LIQUID CLASS" defaultOpen={usingLiquidClass} accent="#6366f1"
              badge={usingLiquidClass ? step.liquidClass : "manual"}>
              <select value={step.liquidClass||""} onChange={e => onUpdate(index,"liquidClass",e.target.value)} style={{ ...sel, marginBottom: usingLiquidClass ? 6 : 0 }}>
                {Object.entries(LIQUID_CLASSES).map(([k, lc]) => (
                  <option key={k} value={k}>{lc.label}</option>
                ))}
              </select>
              {usingLiquidClass && (
                <div style={{ fontSize: "0.65625rem", color: "#818cf8", lineHeight: 1.5 }}>
                  ✓ Uses <code style={{ background: "#6366f115", padding: "1px 4px", borderRadius: 3 }}>transfer_with_liquid_class()</code> — flow rates & delays managed automatically.
                </div>
              )}
            </Section>
          )}

          {/* ══ SECTION: FLOW RATES & TIMING (manual only) ══ */}
          {isTx && !usingLiquidClass && (
            <Section title="FLOW RATES & TIMING" defaultOpen={false} accent="#06b6d4">
              <div style={{ marginBottom: 7 }}>
                <Label>SOLVENT PRESET</Label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(SOLVENT_PRESETS).map(([k, p]) => (
                    <button key={k} onClick={() => applyPreset(k)} style={{
                      background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)",
                      borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", transition: "all 0.1s"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#22d3ee"; e.currentTarget.style.color = "#22d3ee"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--input-border,#1e293b)"; e.currentTarget.style.color = "var(--text-dim,#64748b)"; }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 7 }}>
                <div><Label>Aspirate (µL/s)</Label><input type="number" value={step.aspirateRate||150} onChange={e => onUpdate(index,"aspirateRate",parseFloat(e.target.value))} style={inp} /></div>
                <div><Label>Dispense (µL/s)</Label><input type="number" value={step.dispenseRate||300} onChange={e => onUpdate(index,"dispenseRate",parseFloat(e.target.value))} style={inp} /></div>
                <div><Label>Blowout (µL/s)</Label><input type="number" value={step.blowoutRate||200} onChange={e => onUpdate(index,"blowoutRate",parseFloat(e.target.value))} style={inp} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div><Label>Delay after aspirate (s)</Label><input type="number" step="0.1" value={step.delayAfterAspirate||0} onChange={e => onUpdate(index,"delayAfterAspirate",parseFloat(e.target.value)||0)} style={inp} /></div>
                <div><Label>Delay after dispense (s)</Label><input type="number" step="0.1" value={step.delayAfterDispense||0} onChange={e => onUpdate(index,"delayAfterDispense",parseFloat(e.target.value)||0)} style={inp} /></div>
              </div>
            </Section>
          )}

          {/* ══ SECTION: POSITION & OFFSETS ══ */}
          <Section title="POSITION & OFFSETS" defaultOpen={false} accent="#06b6d4">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: isTx && !usingLiquidClass ? 7 : 0 }}>
              <div>
                <Label>Meniscus offset (mm)</Label>
                <input type="number" step="1" value={step.meniscusOffset ?? -5} onChange={e => onUpdate(index,"meniscusOffset",parseFloat(e.target.value))} style={inp} />
              </div>
              <div>
                <Label>Dispense ref / offset</Label>
                <div style={{ display: "flex", gap: 3 }}>
                  <select value={step.dispenseRef||"top"} onChange={e => onUpdate(index,"dispenseRef",e.target.value)} style={{ ...sel, flex: 1 }}>
                    <option value="top">top()</option>
                    <option value="bottom">bottom()</option>
                  </select>
                  <input type="number" value={step.dispenseTopOffset ?? -2} onChange={e => onUpdate(index,"dispenseTopOffset",parseFloat(e.target.value))} style={{ ...inp, width: 46, flex: "none" }} />
                </div>
              </div>
              <div>
                <Label>Blowout ref / offset</Label>
                <div style={{ display: "flex", gap: 3 }}>
                  <select value={step.blowoutRef||"top"} onChange={e => onUpdate(index,"blowoutRef",e.target.value)} style={{ ...sel, flex: 1 }}>
                    <option value="top">top()</option>
                    <option value="bottom">bottom()</option>
                  </select>
                  <input type="number" value={step.blowoutTopOffset ?? -2} onChange={e => onUpdate(index,"blowoutTopOffset",parseFloat(e.target.value))} style={{ ...inp, width: 46, flex: "none" }} />
                </div>
              </div>
            </div>
            {/* API 2.27 motion — manual only */}
            {isTx && !usingLiquidClass && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border,#0f172a)" }}>
                <div>
                  <Label>End location (API 2.27)</Label>
                  <select value={step.endLocation||""} onChange={e => onUpdate(index,"endLocation",e.target.value)} style={sel}>
                    <option value="">Default</option>
                    <option value="bottom">bottom(1) — sink to bottom</option>
                  </select>
                </div>
                <div>
                  <Label>Movement delay (s)</Label>
                  <input type="number" step="0.1" min="0" value={step.movementDelay||0} onChange={e => onUpdate(index,"movementDelay",parseFloat(e.target.value)||0)} style={inp} placeholder="0" />
                </div>
              </div>
            )}
          </Section>

          {/* ══ SECTION: OPTIONS ══ */}
          <Section title="OPTIONS" defaultOpen={false} accent="#94a3b8">
            {/* Step note */}
            <div style={{ marginBottom: 10 }}>
              <Label>STEP NOTE</Label>
              <input
                value={step.note || ""}
                onChange={e => onUpdate(index, "note", e.target.value)}
                placeholder="Optional label — emitted as protocol.comment() in generated code"
                style={{
                  fontSize: "0.78125rem", background: "var(--input-bg,#0a1628)",
                  border: "1px solid var(--input-border,#1e293b)", borderRadius: 4,
                  padding: "4px 7px", color: "var(--input-color,#e2e8f0)",
                  width: "100%", fontFamily: "inherit", boxSizing: "border-box"
                }}
              />
            </div>
            {isTx && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
                {[["prewet","Pre-wet"],["touchTip","Touch tip"],["remeasureEachAsp","Re-measure each asp"]].map(([k,l]) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78125rem", color: "#64748b", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!step[k]} onChange={e => onUpdate(index,k,e.target.checked)} style={{ accentColor: "#22d3ee" }} />
                    {l}
                  </label>
                ))}
              </div>
            )}

            {/* Tip carry */}
            {!isLast && (
              <div style={{
                padding: "8px 10px", borderRadius: 5,
                background: step.keepTipAfterStep ? "#f59e0b0a" : "transparent",
                border: `1px solid ${step.keepTipAfterStep ? "#f59e0b44" : "var(--border,#0f172a)"}`,
                transition: "all 0.15s", marginBottom: 8
              }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!step.keepTipAfterStep}
                    onChange={e => onUpdate(index, "keepTipAfterStep", e.target.checked)}
                    style={{ accentColor: "#f59e0b", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.78125rem", color: step.keepTipAfterStep ? "#f59e0b" : "#64748b", fontWeight: step.keepTipAfterStep ? 700 : 400 }}>
                      Keep tip after this step
                    </div>
                    <div style={{ fontSize: "0.65625rem", color: "#475569", marginTop: 2 }}>
                      Skips drop_tip() — carries tip into step {index + 2}
                    </div>
                  </div>
                </label>
                {nextDifferentPipette && (
                  <div style={{ marginTop: 6, fontSize: "0.65625rem", color: "#ef4444", background: "#ef444410", border: "1px solid #ef444430", borderRadius: 4, padding: "4px 7px" }}>
                    ⚠ Step {index + 2} uses a different pipette — tip will be force-dropped.
                  </div>
                )}
                {step.keepTipAfterStep && nextStep && !nextStep.pipette && (
                  <div style={{ marginTop: 6, fontSize: "0.65625rem", color: "#f59e0b", background: "#f59e0b0a", border: "1px solid #f59e0b30", borderRadius: 4, padding: "4px 7px" }}>
                    ⚠ Step {index + 2} has no pipette assigned yet.
                  </div>
                )}
                {step.keepTipAfterStep && nextSamePipette && (
                  <div style={{ marginTop: 6, fontSize: "0.65625rem", color: "#f59e0b" }}>
                    ✓ Tip carries into step {index + 2} ({PIPETTES[nextStep.pipette]?.label}).
                  </div>
                )}
              </div>
            )}
            {tipIsCarriedIn && (
              <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 5, background: "#f59e0b08", border: "1px solid #f59e0b33", fontSize: "0.65625rem", color: "#f59e0b" }}>
                ↓ Tip carried in from step {index} — pick_up_tip() skipped.
              </div>
            )}

            {/* Copy settings */}
            {steps && steps.length > 1 && (
              <div style={{ borderTop: "1px solid var(--border,#0f172a)", paddingTop: 8 }}>
                {!showCopyPanel ? (
                  <button onClick={() => { setShowCopyPanel(true); setCopyTargets(new Set()); }}
                    style={{ fontSize: "0.65625rem", background: "none", border: "1px solid var(--border,#0f172a)", color: "var(--text-dim,#64748b)", borderRadius: 4, padding: "3px 9px", cursor: "pointer", fontFamily: "inherit" }}>
                    ⊕ Copy settings to other steps…
                  </button>
                ) : (
                  <div>
                    <div style={{ fontSize: "0.65625rem", color: "#22d3ee", fontWeight: 700, marginBottom: 6, letterSpacing: 0.8 }}>COPY SETTINGS TO:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
                      {steps.map((s, si) => {
                        if (si === index || s.type !== step.type) return null;
                        const checked = copyTargets.has(si);
                        return (
                          <label key={si} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.65625rem", cursor: "pointer",
                            color: checked ? "#22d3ee" : "var(--text-dim,#64748b)",
                            background: checked ? "#22d3ee15" : "var(--bg-panel,#060e1d)",
                            border: `1px solid ${checked ? "#22d3ee44" : "var(--border,#0f172a)"}`, borderRadius: 4, padding: "3px 7px" }}>
                            <input type="checkbox" checked={checked}
                              onChange={e => setCopyTargets(prev => { const n = new Set(prev); e.target.checked ? n.add(si) : n.delete(si); return n; })}
                              style={{ accentColor: "#22d3ee", width: 11, height: 11 }} />
                            Step {si + 1}
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => setShowCopyPanel(false)}
                        style={{ fontSize: "0.65625rem", background: "none", border: "1px solid var(--border,#0f172a)", color: "var(--text-dim,#64748b)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                        Cancel
                      </button>
                      <button disabled={copyTargets.size === 0}
                        onClick={() => {
                          const fields = ["liquidClass","aspirateRate","dispenseRate","blowoutRate","delayAfterAspirate","delayAfterDispense","meniscusOffset","dispenseRef","dispenseTopOffset","blowoutRef","blowoutTopOffset","airGap","prewet","touchTip","remeasureEachAsp","endLocation","movementDelay"];
                          onCopySettings?.(index, [...copyTargets], fields);
                          setShowCopyPanel(false);
                        }}
                        style={{ fontSize: "0.65625rem", background: copyTargets.size > 0 ? "#22d3ee18" : "none", border: `1px solid ${copyTargets.size > 0 ? "#22d3ee44" : "var(--border,#0f172a)"}`, color: copyTargets.size > 0 ? "#22d3ee" : "var(--text-dim,#64748b)", borderRadius: 4, padding: "3px 9px", cursor: copyTargets.size > 0 ? "pointer" : "default", fontFamily: "inherit", fontWeight: 700 }}>
                        Apply to {copyTargets.size} step{copyTargets.size !== 1 ? "s" : ""}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  );
}

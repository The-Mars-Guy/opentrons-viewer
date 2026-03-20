import { useState } from "react";
import { LABWARE_DEFS, THEMES, TEMPLATES, PIPETTES, TIP_POLICIES } from "./constants";
import { useProtocolState } from "./useProtocolState";
import DeckCanvas from "./components/DeckCanvas";
import StepCard from "./components/StepCard";
import { ConnectionModal, WellInfoModal, LiquidPanel } from "./components/Modals";
import { Modal, StatBox, btnXs } from "./components/SharedUI";

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {

  // Theme — kept here since it's purely a display concern, not protocol state
  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem("ot-builder-theme") || "dark"; } catch { return "dark"; }
  });
  const theme = THEMES[themeName] || THEMES.dark;
  const toggleTheme = () => {
    const next = themeName === "dark" ? "light" : "dark";
    setThemeName(next);
    try { localStorage.setItem("ot-builder-theme", next); } catch {}
  };

  const [paletteOpen, setPaletteOpen] = useState(() => {
    try { return localStorage.getItem("ot-builder-palette") !== "closed"; } catch { return true; }
  });
  const togglePalette = () => {
    const next = !paletteOpen;
    setPaletteOpen(next);
    try { localStorage.setItem("ot-builder-palette", next ? "open" : "closed"); } catch {}
  };

  const [dragStepIdx,     setDragStepIdx]     = useState(null);
  const [dragOverStepIdx, setDragOverStepIdx] = useState(null);

  const state = useProtocolState();
  const {
    labware, steps, liquids, setLiquids,
    protocolName, setProtocolName, author, setAuthor, description, setDescription,
    liquidSensing, setLiquidSensing,
    activeTab, setActiveTab, sidePanel, setSidePanel,
    selectedSlot, setSelectedSlot, editingLabel, setEditingLabel,
    draggingFrom, setDraggingFrom, hoveredWell, setHoveredWell,
    expandedStep, setExpandedStep, copied,
    showConnectionModal, setShowConnectionModal,
    showTemplateModal, setShowTemplateModal,
    showImportModal, setShowImportModal,
    showNewModal, setShowNewModal, importError,
    pendingRemoveSlot, setPendingRemoveSlot,
    pendingRemoveStep, setPendingRemoveStep,
    wellInfoModal, setWellInfoModal,
    fileInputRef,
    history, future, pushHistory, undo, redo,
    handleSlotDrop, handleConnectionDrop, confirmConnection, handleAddToStep,
    addStep, updateStep, removeStep, duplicateStep, moveStep, copyStepSettings,
    stepsReferencingSlot, executeRemoveLabware, removeLabware,
    startLabelEdit, commitLabel,
    saveJSON, handleImportFile, applyTemplate, resetProtocol,
    copyCode, downloadCode,
    code, validation, volumeMap, liquidsBySlot, volWarnings, tipCount, runTimeLabel,
    stepTimings, exportCSV, runTimeSecs,
  } = state;

  const selectedLw  = labware.find(l => l.slot === selectedSlot);
  const selectedDef = selectedLw ? LABWARE_DEFS[selectedLw.def] : null;

  // Shared inline style helpers — only used in App-level JSX
  const inp = (extra = {}) => ({
    background: "var(--input-bg,#060e1d)", border: "1px solid var(--border,#0f172a)",
    borderRadius: 5, padding: "5px 8px", color: "var(--input-color,#e2e8f0)",
    fontSize: "0.78125rem", fontFamily: "inherit", boxSizing: "border-box", width: "100%", ...extra
  });

  const Label = ({ children }) => (
    <div style={{ fontSize: "0.65625rem", color: "var(--text-dim,#64748b)", marginBottom: 3, letterSpacing: 0.8, textTransform: "uppercase" }}>{children}</div>
  );

  const SIDE_TABS = [
    { id: "summary",  label: "📊", title: "Summary" },
    { id: "steps",    label: "⚡", title: `Steps (${steps.length})` },
    { id: "settings", label: "⚙️",  title: "Settings" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg,
      fontFamily: "'IBM Plex Mono','Courier New',monospace", color: theme.text,
      display: "flex", flexDirection: "column",
      "--modal-bg":    theme.bgCard,   "--modal-border": theme.borderMid,
      "--input-bg":    theme.bgInput,  "--input-border": theme.border,
      "--input-color": theme.text,     "--text-dim":     theme.textDim,
      "--text-mid":    theme.textMid,  "--bg-panel":     theme.bgPanel,
      "--border":      theme.border,   "--border-mid":   theme.borderMid,
    }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${theme.border}`, padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.bgHeader, flexShrink: 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#06b6d4,#6366f1)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.90625rem" }}>⚗</div>
          <div>
            <div style={{ fontSize: "0.90625rem", fontWeight: 700, letterSpacing: 0.8, color: "#f1f5f9" }}>OPENTRONS FLEX</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {editingLabel?.slot === "__protocol_name" ? (
                <input autoFocus value={editingLabel.value}
                  onChange={e => setEditingLabel(el => ({ ...el, value: e.target.value }))}
                  onBlur={() => { setProtocolName(editingLabel.value || protocolName); setEditingLabel(null); }}
                  onKeyDown={e => {
                    if (e.key === "Enter")  { setProtocolName(editingLabel.value || protocolName); setEditingLabel(null); }
                    if (e.key === "Escape") setEditingLabel(null);
                  }}
                  style={{ fontSize: "0.59375rem", background: "transparent", border: "none", borderBottom: "1px solid #22d3ee", color: "#94a3b8", fontFamily: "inherit", letterSpacing: 2, outline: "none", width: 160, padding: "0 2px" }}
                />
              ) : (
                <div onClick={() => setEditingLabel({ slot: "__protocol_name", value: protocolName })}
                  title="Click to rename protocol"
                  style={{ fontSize: "0.59375rem", color: theme.textDim, letterSpacing: 2, cursor: "text", padding: "1px 3px", borderRadius: 2, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onMouseEnter={e => e.currentTarget.style.color = theme.textMid}
                  onMouseLeave={e => e.currentTarget.style.color = theme.textDim}
                >
                  {protocolName.toUpperCase()} ✏
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)"
            style={{ ...btnXs, fontSize: "0.90625rem", padding: "2px 7px", border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.textDim, opacity: history.length ? 1 : 0.3 }}>↩</button>
          <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)"
            style={{ ...btnXs, fontSize: "0.90625rem", padding: "2px 7px", border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.textDim, opacity: future.length ? 1 : 0.3 }}>↪</button>

          <div style={{ width: 1, height: 18, background: theme.border, margin: "0 2px" }} />

          <button onClick={() => setShowNewModal(true)}
            style={{ padding: "4px 9px", fontSize: "0.65625rem", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: theme.textDim, border: `1px solid ${theme.border}` }}>
            🗋 New
          </button>
          <button onClick={() => setShowImportModal(true)}
            style={{ padding: "4px 9px", fontSize: "0.65625rem", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: theme.textDim, border: `1px solid ${theme.border}` }}>
            📂 Import
          </button>
          <button onClick={saveJSON}
            style={{ padding: "4px 9px", fontSize: "0.65625rem", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: theme.textDim, border: `1px solid ${theme.border}` }}>
            💾 Save
          </button>
          <button onClick={exportCSV} title="Export transfer list as CSV"
            style={{ padding: "4px 9px", fontSize: "0.65625rem", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: "#059669", border: "1px solid #05966940" }}>
            📊 CSV
          </button>
          <button onClick={() => setShowTemplateModal(true)}
            style={{ padding: "4px 9px", fontSize: "0.65625rem", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "#6366f115", color: "#818cf8", border: "1px solid #6366f130" }}>
            📋 Templates
          </button>

          <div style={{ width: 1, height: 18, background: theme.border, margin: "0 2px" }} />

          <button onClick={() => setLiquidSensing(v => !v)}
            style={{ padding: "4px 9px", fontSize: "0.65625rem", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: liquidSensing ? "#06b6d415" : "transparent", color: liquidSensing ? "#06b6d4" : theme.textDim, border: `1px solid ${liquidSensing ? "#06b6d444" : theme.border}` }}>
            {liquidSensing ? "💧 LLD ON" : "💧 LLD OFF"}
          </button>
          <button onClick={toggleTheme} title={`Switch to ${theme.iconLabel} mode`}
            style={{ padding: "4px 9px", fontSize: "0.65625rem", fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: theme.textDim, border: `1px solid ${theme.border}` }}>
            {theme.icon} {theme.iconLabel}
          </button>

          {["build", "code"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "4px 12px", background: activeTab === tab ? "#06b6d4" : "transparent",
              color: activeTab === tab ? "#020817" : theme.textDim,
              border: `1px solid ${activeTab === tab ? "#06b6d4" : theme.border}`,
              borderRadius: 5, cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700
            }}>
              {tab === "build" ? "🔧 BUILD" : "‹/› CODE"}
              {tab === "code" && validation.errors.length > 0 && (
                <span style={{ marginLeft: 4, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "0 4px", fontSize: "0.65625rem" }}>
                  {validation.errors.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "build" ? (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 46px)" }}>

          {/* ── Left Palette ── */}
          <div style={{
            width: paletteOpen ? 200 : 32,
            borderRight: `1px solid ${theme.border}`,
            background: theme.bgPanel,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "width 0.2s ease",
          }}>
            {/* Toggle button — sits above content, same height as the DRAG TO DECK label row */}
            <button
              onClick={togglePalette}
              title={paletteOpen ? "Collapse palette" : "Expand palette"}
              style={{
                flexShrink: 0, width: "100%",
                padding: "9px 10px",
                background: "transparent", border: "none",
                borderBottom: `1px solid ${theme.border}`,
                cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: paletteOpen ? "space-between" : "center",
                fontFamily: "inherit",
              }}
            >
              {paletteOpen && (
                <span style={{ fontSize: "0.65625rem", color: theme.textDim, fontWeight: 700, letterSpacing: 1.5 }}>
                  DRAG TO DECK
                </span>
              )}
              <span style={{
                fontSize: "0.59375rem", color: theme.textDim,
                display: "inline-block", lineHeight: 1,
                transform: paletteOpen ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform 0.2s ease",
              }}>◀</span>
            </button>

            {/* Expanded: full labware cards — identical markup/fonts to original */}
            {paletteOpen && (
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
                {Object.entries(LABWARE_DEFS).map(([key, def]) => (
                  <div key={key} draggable
                    onDragStart={e => e.dataTransfer.setData("text/plain", JSON.stringify({ type: "labware", def: key }))}
                    style={{ padding: "8px 10px", background: `${def.color}12`, border: `1px solid ${def.color}28`, borderRadius: 6, cursor: "grab", display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: "0.71875rem", color: theme.textMid, transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = `${def.color}28`}
                    onMouseLeave={e => e.currentTarget.style.background = `${def.color}12`}>
                    <span style={{ fontSize: "1.15625rem", flexShrink: 0 }}>{def.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{def.shortLabel || def.label}</div>
                      {def.paletteDesc && <div style={{ fontSize: "0.59375rem", color: `${def.color}77`, lineHeight: 1.3, marginTop: 1 }}>{def.paletteDesc}</div>}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, fontSize: "0.59375rem", color: theme.textFaint, lineHeight: 1.8, borderTop: `1px solid ${theme.border}`, paddingTop: 9 }}>
                  <div style={{ color: theme.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>HOW TO USE</div>
                  1. Drag labware to deck<br />
                  2. Click label ✏ to rename<br />
                  3. Drag well→well to transfer<br />
                  4. Edit steps in sidebar<br />
                  5. T = transfer · M = mix<br />
                  6. Ctrl+Z to undo
                </div>
              </div>
            )}

            {/* Collapsed: emoji icons — still draggable */}
            {!paletteOpen && (
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, gap: 5 }}>
                {Object.entries(LABWARE_DEFS).map(([key, def]) => (
                  <div key={key} draggable
                    onDragStart={e => e.dataTransfer.setData("text/plain", JSON.stringify({ type: "labware", def: key }))}
                    title={def.label}
                    style={{
                      width: 22, height: 22, borderRadius: 4,
                      background: `${def.color}18`, border: `1px solid ${def.color}40`,
                      cursor: "grab", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${def.color}38`}
                    onMouseLeave={e => e.currentTarget.style.background = `${def.color}18`}>
                    {def.icon}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Center: Deck ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: "0.65625rem", color: theme.textDim, letterSpacing: 1.2, display: "flex", alignItems: "center", gap: 10 }}>
              <span>DECK — drop labware onto slots · drag well→well to wire a transfer</span>
              {draggingFrom && <span style={{ color: "#fbbf24" }}>● drawing from {draggingFrom.slot}[{draggingFrom.well}]</span>}
            </div>

            <DeckCanvas
              labware={labware} steps={steps} selectedSlot={selectedSlot} theme={theme}
              volumeMap={volumeMap} liquidsBySlot={liquidsBySlot}
              onSlotClick={slot => {
                const lw = labware.find(l => l.slot === slot);
                if (lw && lw.def !== "_trash") setSelectedSlot(slot === selectedSlot ? null : slot);
              }}
              draggingFrom={draggingFrom} setDraggingFrom={setDraggingFrom}
              hoveredWell={hoveredWell} setHoveredWell={setHoveredWell}
              onWellDragOver={() => {}}
              onConnectionDrop={handleConnectionDrop}
              onSlotDrop={handleSlotDrop}
              onLabelEdit={startLabelEdit}
              onWellClick={(slot, well) => {
                const lw = labware.find(l => l.slot === slot);
                if (lw && lw.def !== "_trash" && !lw.def.includes("tiprack")) setWellInfoModal({ slot, well });
              }}
            />

            {selectedLw && selectedDef && (
              <div style={{ background: `${selectedDef.color}0a`, border: `1px solid ${selectedDef.color}22`, borderRadius: 7, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.78125rem", color: selectedDef.color, fontWeight: 700 }}>{selectedLw.slot}: {selectedDef.label}</div>
                  <div style={{ fontSize: "0.65625rem", color: theme.textDim, marginTop: 1 }}>
                    {selectedDef.wells.length} wells · {selectedDef.wells.slice(0, 12).join(", ")}{selectedDef.wells.length > 12 ? "…" : ""}
                  </div>
                </div>
                <button onClick={() => removeLabware(selectedSlot)}
                  style={{ background: "#ef444413", border: "1px solid #ef444430", color: "#ef4444", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit" }}>
                  Remove{stepsReferencingSlot(selectedSlot).length > 0
                    ? ` (${stepsReferencingSlot(selectedSlot).length} step${stepsReferencingSlot(selectedSlot).length !== 1 ? "s" : ""})`
                    : ""}
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => addStep("transfer")}
                style={{ background: "#22d3ee12", border: "1px solid #22d3ee30", color: "#22d3ee", borderRadius: 5, padding: "5px 14px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700 }}>
                + Transfer
              </button>
              <button onClick={() => addStep("mix")}
                style={{ background: "#a78bfa12", border: "1px solid #a78bfa30", color: "#a78bfa", borderRadius: 5, padding: "5px 14px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700 }}>
                + Mix
              </button>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div style={{ width: paletteOpen ? 330 : 410, minWidth: paletteOpen ? 330 : 410, borderLeft: `1px solid ${theme.border}`, background: theme.bgPanel, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s ease, min-width 0.2s ease" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
              {SIDE_TABS.map(t => (
                <button key={t.id} onClick={() => setSidePanel(t.id)} style={{
                  flex: 1, padding: "11px 4px", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700,
                  letterSpacing: 0.5, cursor: "pointer", border: "none",
                  borderBottom: `2px solid ${sidePanel === t.id ? "#06b6d4" : "transparent"}`,
                  background: sidePanel === t.id ? "#06b6d408" : "transparent",
                  color: sidePanel === t.id ? "#06b6d4" : theme.textDim,
                  transition: "all 0.1s"
                }} title={t.title}>
                  {t.label}
                  <div style={{ fontSize: "0.59375rem", marginTop: 2, letterSpacing: 0.8 }}>{t.title}</div>
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>

              {sidePanel === "summary" && (
                <div>
                  <StatBox icon="🧪" label="Labware"   value={labware.filter(l => l.def !== "_trash" && l.slot !== "A3").length} color="#22d3ee" />
                  <StatBox icon="⚡" label="Steps"     value={steps.length}   color="#a78bfa" />
                  <StatBox icon="💧" label="Liquids"   value={liquids.length} color="#06b6d4" />
                  <StatBox icon="💉" label="Tips est." value={tipCount}       color="#f59e0b" />
                  <StatBox icon="⏱" label="Run est."  value={runTimeLabel}   color="#34d399" />

                  {/* Per-step time breakdown */}
                  {steps.length > 0 && (
                    <div style={{ background: "var(--bg-panel,#060e1d)", borderRadius: 6, padding: "8px 10px", border: `1px solid ${theme.border}`, marginBottom: 8 }}>
                      <div style={{ fontSize: "0.59375rem", color: theme.textDim, marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>TIME BREAKDOWN</div>
                      {steps.map((s, i) => {
                        const secs = stepTimings[i] || 0;
                        const pct = runTimeSecs > 10 ? Math.round((secs / (runTimeSecs - 10)) * 100) : 0;
                        return (
                          <div key={i} style={{ marginBottom: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.59375rem", color: theme.textDim, marginBottom: 2 }}>
                              <span>Step {i+1}{s.note ? ` — ${s.note}` : ""}</span>
                              <span style={{ color: theme.textMid }}>{secs < 60 ? `${secs}s` : `${Math.floor(secs/60)}m${secs%60 ? ` ${secs%60}s` : ""}`}</span>
                            </div>
                            <div style={{ height: 3, background: theme.border, borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: "#22d3ee", borderRadius: 2, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Autosave indicator */}
                  <div style={{ fontSize: "0.59375rem", color: theme.textFaint, textAlign: "center", marginBottom: 8 }}>
                    ✓ Auto-saved to browser storage
                  </div>

                  {volWarnings.length > 0 && (
                    <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                      <div style={{ fontSize: "0.59375rem", color: "#f59e0b", fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>VOLUME WARNINGS</div>
                      {volWarnings.map((w, i) => <div key={i} style={{ fontSize: "0.65625rem", color: "#f59e0b", marginBottom: 2 }}>⚠ {w}</div>)}
                    </div>
                  )}

                  <div style={{ background: "var(--bg-panel,#060e1d)", borderRadius: 6, padding: "9px 10px", border: `1px solid ${theme.border}`, marginTop: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: "0.59375rem", color: theme.textDim, marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>VALIDATION</div>
                    {validation.errors.map((e, i)   => <div key={i} style={{ fontSize: "0.65625rem", color: "#ef4444",  marginBottom: 3 }}>✗ {e}</div>)}
                    {validation.warnings.map((w, i) => <div key={i} style={{ fontSize: "0.65625rem", color: "#f59e0b",  marginBottom: 3 }}>⚠ {w}</div>)}
                    {validation.ok.map((o, i)       => <div key={i} style={{ fontSize: "0.65625rem", color: "#22c55e",  marginBottom: 3 }}>✓ {o}</div>)}
                  </div>

                  <div style={{ background: "var(--bg-panel,#060e1d)", borderRadius: 6, padding: "9px 10px", border: `1px solid ${theme.border}`, marginBottom: 10 }}>
                    <div style={{ fontSize: "0.59375rem", color: theme.textDim, marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>ON DECK</div>
                    {labware.filter(l => l.def !== "_trash" && l.slot !== "A3").length === 0
                      ? <div style={{ fontSize: "0.65625rem", color: theme.textFaint }}>No labware placed</div>
                      : labware.filter(l => l.def !== "_trash" && l.slot !== "A3").map(l => {
                          const d = LABWARE_DEFS[l.def];
                          return d ? (
                            <div key={l.slot} style={{ fontSize: "0.71875rem", marginBottom: 4, display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ color: d.color, fontWeight: 700, minWidth: 24 }}>{l.slot}</span>
                              <span style={{ fontSize: "0.65625rem", color: theme.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {l.label || d.shortLabel}
                              </span>
                            </div>
                          ) : null;
                        })
                    }
                  </div>

                  <button onClick={() => setActiveTab("code")}
                    style={{ width: "100%", background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", borderRadius: 6, padding: "9px 0", color: "#fff", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700, letterSpacing: 1 }}>
                    GENERATE CODE →
                  </button>
                </div>
              )}

              {sidePanel === "steps" && (
                <div>
                  <div style={{ fontSize: "0.65625rem", color: theme.textDim, letterSpacing: 1.5, marginBottom: 10 }}>STEPS ({steps.length})</div>
                  {steps.length === 0
                    ? <div style={{ textAlign: "center", color: theme.textFaint, padding: "28px 0", border: `2px dashed ${theme.border}`, borderRadius: 8, fontSize: "0.71875rem" }}>
                        Drag well→well on the deck,<br />or use + Transfer / + Mix below
                      </div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {steps.map((step, i) => (
                          <div key={i}
                            draggable
                            onDragStart={e => { setDragStepIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDragStepIdx(null); setDragOverStepIdx(null); }}
                            onDragOver={e => { e.preventDefault(); setDragOverStepIdx(i); }}
                            onDrop={e => {
                              e.preventDefault();
                              if (dragStepIdx !== null && dragStepIdx !== i) {
                                moveStep(dragStepIdx, i > dragStepIdx ? 1 : -1);
                                // For multi-position moves, reorder directly
                                pushHistory();
                                setSteps(prev => {
                                  const arr = [...prev];
                                  const [moved] = arr.splice(dragStepIdx, 1);
                                  arr.splice(i, 0, moved);
                                  return arr;
                                });
                              }
                              setDragStepIdx(null);
                              setDragOverStepIdx(null);
                            }}
                            style={{
                              borderTop: dragOverStepIdx === i && dragStepIdx !== i
                                ? `2px solid #22d3ee`
                                : "2px solid transparent",
                              opacity: dragStepIdx === i ? 0.4 : 1,
                              transition: "opacity 0.1s",
                              cursor: "grab",
                            }}
                          >
                            <StepCard step={step} index={i} labware={labware}
                              onRemove={removeStep}
                              onUpdate={updateStep}
                              onDuplicate={duplicateStep}
                              onMoveUp={i => moveStep(i, -1)}
                              onMoveDown={i => moveStep(i, 1)}
                              isFirst={i === 0} isLast={i === steps.length - 1}
                              autoExpand={expandedStep === i}
                              onExpandedChange={open => {
                                if (open) setExpandedStep(i);
                                else if (expandedStep === i) setExpandedStep(null);
                              }}
                              steps={steps}
                              onCopySettings={copyStepSettings}
                              stepTime={stepTimings[i]}
                            />
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )}

              {sidePanel === "settings" && (
                <div>
                  <div style={{ fontSize: "0.65625rem", color: "#22d3ee", letterSpacing: 1, marginBottom: 7, fontWeight: 700, paddingBottom: 4, borderBottom: `1px solid ${theme.border}` }}>METADATA</div>
                  <Label>Protocol Name</Label>
                  <input value={protocolName} onChange={e => setProtocolName(e.target.value)} style={{ ...inp(), marginBottom: 7 }} />
                  <Label>Author</Label>
                  <input value={author} onChange={e => setAuthor(e.target.value)} style={{ ...inp(), marginBottom: 7 }} />
                  <Label>Description</Label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                    placeholder="Optional protocol description…"
                    style={{ ...inp(), resize: "vertical", marginBottom: 16 }} />

                  <div style={{ fontSize: "0.65625rem", color: "#22d3ee", letterSpacing: 1, marginBottom: 7, fontWeight: 700, paddingBottom: 4, borderBottom: `1px solid ${theme.border}` }}>LIQUID LEVEL DETECTION</div>
                  <div style={{ background: "var(--bg-panel,#060e1d)", border: `1px solid ${liquidSensing ? "#06b6d444" : theme.border}`, borderRadius: 7, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: "0.78125rem", color: liquidSensing ? "#06b6d4" : theme.textDim, fontWeight: 700 }}>Liquid Presence Detection</div>
                      <div style={{ fontSize: "0.65625rem", color: theme.textDim, marginTop: 2, lineHeight: 1.5 }}>
                        Enables measure_liquid_height()<br />and well.meniscus() tracking
                      </div>
                    </div>
                    <div onClick={() => setLiquidSensing(v => !v)} style={{
                      width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                      background: liquidSensing ? "#06b6d4" : theme.border,
                      position: "relative", transition: "background 0.2s", flexShrink: 0
                    }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: liquidSensing ? 19 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
                    </div>
                  </div>
                  {liquidSensing ? (
                    <div style={{ fontSize: "0.65625rem", color: theme.textDim, background: "var(--bg-panel,#060e1d)", border: `1px solid ${theme.border}`, borderRadius: 5, padding: "7px 10px", lineHeight: 1.7, marginBottom: 16 }}>
                      <span style={{ color: "#06b6d4" }}>✓</span> liquid_presence_detection=True on all pipettes<br />
                      <span style={{ color: "#06b6d4" }}>✓</span> measure_liquid_height() before each aspirate<br />
                      <span style={{ color: "#06b6d4" }}>✓</span> well.meniscus(z=offset) for aspirate position
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.65625rem", color: theme.textDim, background: "var(--bg-panel,#060e1d)", border: `1px solid ${theme.border}`, borderRadius: 5, padding: "7px 10px", lineHeight: 1.7, marginBottom: 16 }}>
                      <span style={{ color: theme.textFaint }}>–</span> liquid_presence_detection=False<br />
                      <span style={{ color: theme.textFaint }}>–</span> Aspirate from well.bottom(5) by default<br />
                      <span style={{ color: theme.textFaint }}>–</span> No height tracking
                    </div>
                  )}

                  <div style={{ fontSize: "0.65625rem", color: "#22d3ee", letterSpacing: 1, marginBottom: 7, fontWeight: 700, paddingBottom: 4, borderBottom: `1px solid ${theme.border}` }}>LIQUID DEFINITIONS</div>
                  <LiquidPanel liquids={liquids} setLiquids={setLiquids} labware={labware} />
                </div>
              )}
            </div>
          </div>
        </div>

      ) : (
        /* ── Code view ── */
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: "0.65625rem", color: theme.textDim, letterSpacing: 1.5 }}>GENERATED PYTHON — Opentrons Flex API 2.23</div>
              {validation.errors.length > 0 && (
                <span style={{ fontSize: "0.65625rem", background: "#ef444418", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 4, padding: "2px 7px" }}>
                  {validation.errors.length} error{validation.errors.length !== 1 ? "s" : ""}
                </span>
              )}
              {validation.warnings.length > 0 && (
                <span style={{ fontSize: "0.65625rem", background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b30", borderRadius: 4, padding: "2px 7px" }}>
                  {validation.warnings.length} warning{validation.warnings.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={copyCode}
                style={{ background: copied ? "#22c55e18" : theme.bgCard, border: `1px solid ${copied ? "#22c55e" : theme.border}`, color: copied ? "#22c55e" : theme.textDim, borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700 }}>
                {copied ? "✓ Copied!" : "Copy"}
              </button>
              <button onClick={downloadCode}
                style={{ background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700 }}>
                ↓ Download .py
              </button>
              <button onClick={exportCSV}
                style={{ background: "#059669", border: "none", color: "#fff", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700 }}>
                ↓ Export CSV
              </button>
              <button onClick={saveJSON}
                style={{ background: "var(--input-bg,#060e1d)", border: `1px solid ${theme.border}`, color: theme.textDim, borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: "0.71875rem", fontFamily: "inherit", fontWeight: 700 }}>
                ↓ Export .json
              </button>
            </div>
          </div>
          <pre style={{ flex: 1, background: theme.bgDeck, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 18, overflowY: "auto", fontSize: "0.84375rem", lineHeight: 1.9, color: theme.text, margin: 0, whiteSpace: "pre-wrap" }}>
            {code.split("\n").map((line, i) => {
              let c = theme.textDim;
              const t = line.trimStart();
              if (t.startsWith("#"))                                                            c = "#4a6741";
              else if (/^(from|import)\s/.test(t))                                             c = "#b48ead";
              else if (/^def\s/.test(t))                                                       c = "#d08770";
              else if (/protocol\.comment/.test(line))                                         c = "#5e8c6a";
              else if (/=\s*protocol\.load/.test(line) || /protocol\.define_liquid/.test(line)) c = "#81a1c1";
              else if (/\.flow_rate\./.test(line))                                             c = "#88c0d0";
              else if (/protocol\.delay/.test(line))                                           c = "#ebcb8b";
              else if (/pick_up_tip|drop_tip|measure_liquid/.test(line))                       c = "#a3be8c";
              else if (/aspirate|dispense|blow_out|air_gap|touch_tip|mix/.test(line))          c = theme.text;
              return (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <span style={{ color: theme.textGhost, userSelect: "none", minWidth: 26, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: c }}>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      )}

      {/* ── Inline label editor ── */}
      {editingLabel && editingLabel.slot !== "__protocol_name" && (
        <Modal>
          <div style={{ fontSize: "0.84375rem", fontWeight: 700, marginBottom: 10 }}>Rename slot {editingLabel.slot}</div>
          <input autoFocus value={editingLabel.value}
            onChange={e => setEditingLabel(el => ({ ...el, value: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") setEditingLabel(null); }}
            placeholder="e.g. Hexane Source, BHA Matrix…"
            style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 5, padding: "7px 9px", color: "var(--input-color,#e2e8f0)", fontSize: "0.78125rem", fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
            <button onClick={() => setEditingLabel(null)}
              style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: theme.textDim, borderRadius: 5, padding: 7, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem" }}>Cancel</button>
            <button onClick={commitLabel}
              style={{ flex: 2, background: "#06b6d4", border: "none", color: "#020817", borderRadius: 5, padding: 7, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem", fontWeight: 700 }}>Save</button>
          </div>
        </Modal>
      )}

      {/* ── Template picker ── */}
      {showTemplateModal && (
        <Modal wide>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: "0.90625rem", fontWeight: 700 }}>Load Template</div>
            <button onClick={() => setShowTemplateModal(false)} style={{ background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: "1.03125rem" }}>✕</button>
          </div>
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <div key={key} onClick={() => applyTemplate(key)}
              style={{ background: "var(--bg-panel,#060e1d)", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 8, cursor: "pointer", transition: "border-color 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#06b6d4"}
              onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
              <div style={{ fontSize: "0.84375rem", fontWeight: 700, color: theme.text, marginBottom: 3 }}>{t.name}</div>
              <div style={{ fontSize: "0.65625rem", color: theme.textDim, marginBottom: 6 }}>{t.description}</div>
              <div style={{ display: "flex", gap: 10, fontSize: "0.59375rem", color: theme.textDim }}>
                <span>🧪 {t.labware.filter(l => l.def !== "_trash" && l.slot !== "A3").length} labware</span>
                <span>⚡ {t.steps.length} step{t.steps.length !== 1 ? "s" : ""}</span>
                <span>💧 {t.liquids.length} liquid{t.liquids.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: "0.65625rem", color: theme.textDim, marginTop: 8, textAlign: "center" }}>
            Loading a template replaces your current deck and steps
          </div>
        </Modal>
      )}

      {/* ── Import modal ── */}
      {showImportModal && (
        <Modal>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: "0.90625rem", fontWeight: 700 }}>Import Protocol</div>
            <button onClick={() => setShowImportModal(false)} style={{ background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: "1.03125rem" }}>✕</button>
          </div>
          <div style={{ fontSize: "0.65625rem", color: theme.textDim, marginBottom: 12, lineHeight: 1.7 }}>
            Load a saved builder state <span style={{ color: theme.textMid }}>(.json)</span> or import an existing Opentrons Python protocol <span style={{ color: theme.textMid }}>(.py)</span>.<br />
            Python import reconstructs deck layout and best-effort transfer steps.
          </div>
          <input ref={fileInputRef} type="file" accept=".json,.py,.csv,.tsv" onChange={handleImportFile} style={{ display: "none" }} />
          <button onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%", background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 7, padding: "12px 0", cursor: "pointer", fontSize: "0.78125rem", fontFamily: "inherit", fontWeight: 700, marginBottom: 8 }}>
            📂 Browse / Choose File
          </button>
          {importError && (
            <div style={{ fontSize: "0.65625rem", color: "#ef4444", background: "#ef444410", border: "1px solid #ef444430", borderRadius: 5, padding: "7px 10px", marginTop: 6 }}>
              {importError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: "0.59375rem", color: theme.textDim, justifyContent: "center" }}>
            <span>.json — full state</span><span>·</span><span>.py — Opentrons protocol</span><span>·</span><span>.csv — transfer list</span>
          </div>
        </Modal>
      )}

      {/* ── Connection modal ── */}
      {showConnectionModal && (
        <ConnectionModal conn={showConnectionModal} labware={labware}
          onConfirm={confirmConnection} onAddToStep={handleAddToStep}
          onCancel={() => setShowConnectionModal(null)} />
      )}

      {/* ── Remove labware confirmation ── */}
      {pendingRemoveSlot && (() => {
        const lw  = labware.find(l => l.slot === pendingRemoveSlot);
        const def = lw ? LABWARE_DEFS[lw.def] : null;
        const affected        = stepsReferencingSlot(pendingRemoveSlot);
        const affectedLiquids = liquids.filter(l => l.slot === pendingRemoveSlot);
        const willDelete = affected.filter(s => {
          if (s.sourceSlot === pendingRemoveSlot) return true;
          const cleanedMulti = (s.multiDests || []).filter(d => d.slot !== pendingRemoveSlot);
          return s.destSlot === pendingRemoveSlot && cleanedMulti.length === 0;
        });
        const willPrune = affected.filter(s => !willDelete.includes(s));
        return (
          <Modal>
            <div style={{ fontSize: "0.90625rem", fontWeight: 700, marginBottom: 6 }}>Remove labware?</div>
            <div style={{ fontSize: "0.84375rem", color: theme.textMid, marginBottom: 12 }}>
              <span style={{ color: def?.color || "#ef4444", fontWeight: 700 }}>{lw?.label || pendingRemoveSlot}</span>
              {" "}({def?.shortLabel || pendingRemoveSlot}) is referenced by {affected.length} step{affected.length !== 1 ? "s" : ""}.
            </div>
            {willDelete.length > 0 && (
              <div style={{ background: "#ef444410", border: "1px solid #ef444430", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: "0.78125rem", color: "#ef4444", fontWeight: 700, marginBottom: 4 }}>✕ {willDelete.length} step{willDelete.length !== 1 ? "s" : ""} will be deleted</div>
                {willDelete.map((s, i) => (
                  <div key={i} style={{ fontSize: "0.78125rem", color: "#ef444499", marginBottom: 2 }}>
                    Step {steps.indexOf(s) + 1}: {s.type === "transfer" ? `${s.sourceSlot}[${s.sourceWell}] → ${s.destSlot || "?"}[${s.destWell || "?"}]` : `Mix in ${s.sourceSlot}[${s.sourceWell}]`}
                  </div>
                ))}
              </div>
            )}
            {willPrune.length > 0 && (
              <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: "0.78125rem", color: "#f59e0b", fontWeight: 700, marginBottom: 4 }}>⚠ {willPrune.length} step{willPrune.length !== 1 ? "s" : ""} will lose a destination</div>
                {willPrune.map((s, i) => {
                  const removedDests = (s.multiDests || []).filter(d => d.slot === pendingRemoveSlot).length + (s.destSlot === pendingRemoveSlot ? 1 : 0);
                  return <div key={i} style={{ fontSize: "0.78125rem", color: "#f59e0b99", marginBottom: 2 }}>Step {steps.indexOf(s) + 1}: {removedDests} destination{removedDests !== 1 ? "s" : ""} removed</div>;
                })}
              </div>
            )}
            {affectedLiquids.length > 0 && (
              <div style={{ background: "#06b6d410", border: "1px solid #06b6d430", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: "0.78125rem", color: "#06b6d4", fontWeight: 700, marginBottom: 2 }}>💧 {affectedLiquids.length} liquid definition{affectedLiquids.length !== 1 ? "s" : ""} will be unassigned</div>
                {affectedLiquids.map((l, i) => <div key={i} style={{ fontSize: "0.78125rem", color: "#06b6d499" }}>{l.name}</div>)}
              </div>
            )}
            <div style={{ fontSize: "0.78125rem", color: theme.textDim, marginBottom: 12, marginTop: 4 }}>This is undoable with Ctrl+Z.</div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => setPendingRemoveSlot(null)}
                style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: theme.textDim, borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.84375rem" }}>Cancel</button>
              <button onClick={() => { executeRemoveLabware(pendingRemoveSlot); setPendingRemoveSlot(null); }}
                style={{ flex: 2, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.84375rem", fontWeight: 700 }}>
                Remove + clean up {affected.length} step{affected.length !== 1 ? "s" : ""}
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ── New Protocol confirmation ── */}
      {showNewModal && (
        <Modal>
          <div style={{ fontSize: "0.84375rem", fontWeight: 700, marginBottom: 8 }}>Start a new protocol?</div>
          <div style={{ fontSize: "0.71875rem", color: theme.textDim, marginBottom: 16, lineHeight: 1.6 }}>
            This will clear all labware, steps, and liquids.
            {history.length > 0 && " Your current work will be saved to undo history."}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => setShowNewModal(false)}
              style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: theme.textDim, borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem" }}>Cancel</button>
            <button onClick={resetProtocol}
              style={{ flex: 2, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem", fontWeight: 700 }}>
              Clear + Start fresh
            </button>
          </div>
        </Modal>
      )}

      {/* ── Well Info Modal ── */}
      {wellInfoModal && (() => {
        const lw  = labware.find(l => l.slot === wellInfoModal.slot);
        const def = lw ? LABWARE_DEFS[lw.def] : null;
        if (!lw || !def) { setWellInfoModal(null); return null; }
        return (
          <WellInfoModal slot={wellInfoModal.slot} well={wellInfoModal.well}
            lw={lw} def={def} volumeMap={volumeMap} liquids={liquids}
            setLiquids={l => { pushHistory(); setLiquids(l); }}
            labware={labware} onClose={() => setWellInfoModal(null)} />
        );
      })()}

      {/* ── Remove step confirmation ── */}
      {pendingRemoveStep !== null && (() => {
        const s = steps[pendingRemoveStep];
        if (!s) { setPendingRemoveStep(null); return null; }
        const isTx      = s.type === "transfer";
        const destCount = (s.multiDests?.filter(d => d.slot && d.well).length || 0) + (s.destSlot && s.destWell ? 1 : 0);
        const totalVol  = (s.volume || 0) * Math.max(1, destCount);
        return (
          <Modal>
            <div style={{ fontSize: "0.84375rem", fontWeight: 700, marginBottom: 6 }}>Delete step {pendingRemoveStep + 1}?</div>
            <div style={{ background: "var(--bg-panel,#060e1d)", border: `1px solid ${theme.border}`, borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
              {isTx ? (
                <>
                  <div style={{ fontSize: "0.71875rem", color: "#22d3ee", marginBottom: 3 }}>
                    {s.sourceSlot}[{s.sourceWell}] → {destCount > 1 ? `${destCount} destinations` : `${s.destSlot}[${s.destWell}]`}
                  </div>
                  <div style={{ fontSize: "0.65625rem", color: theme.textDim }}>
                    {s.volume}µL × {destCount} = {totalVol}µL · {PIPETTES[s.pipette]?.label || s.pipette || "no pipette"} · {TIP_POLICIES[s.tipPolicy] || s.tipPolicy}
                  </div>
                  {s.multiDests?.length > 0 && (
                    <div style={{ fontSize: "0.65625rem", color: theme.textFaint, marginTop: 3 }}>
                      + {s.multiDests.length} additional destination{s.multiDests.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "0.71875rem", color: "#a78bfa" }}>
                  Mix {s.mixReps || 3}× {s.volume}µL in {s.sourceSlot}[{s.sourceWell}]
                </div>
              )}
            </div>
            <div style={{ fontSize: "0.65625rem", color: theme.textDim, marginBottom: 12 }}>This is undoable with Ctrl+Z.</div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => setPendingRemoveStep(null)}
                style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: theme.textDim, borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem" }}>Cancel</button>
              <button onClick={() => { pushHistory(); state.setSteps(prev => prev.filter((_, idx) => idx !== pendingRemoveStep)); setPendingRemoveStep(null); }}
                style={{ flex: 2, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: "0.71875rem", fontWeight: 700 }}>
                Delete step {pendingRemoveStep + 1}
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

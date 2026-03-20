import { useState, useRef, useEffect, useCallback } from "react";
import { LABWARE_DEFS, SOLVENT_PRESETS, TEMPLATES, PIPETTES } from "./constants";
import { computeVolumeMap, estimateRunTime, estimateRunTimePerStep, formatDuration, fmtVol } from "./utils";
import { runValidation, parseProtocolPy, parseTransferCSV } from "./validation";
import { generateCode } from "./codegen";

// ── useProtocolState ──────────────────────────────────────────────────────────
// Owns all protocol state, undo/redo, mutations, and derived values.
// App.jsx becomes pure layout — just reads this hook and renders.

export function useProtocolState() {

  // ── Core state ───────────────────────────────────────────────────────────────

  // Restore from autosave on first load (saved on every state change)
  const _saved = (() => {
    try { return JSON.parse(localStorage.getItem("ot-builder-autosave") || "null"); } catch { return null; }
  })();

  const [labware,       setLabware]       = useState(_saved?.labware      || [{ slot: "A3", def: "_trash", label: "Trash", id: "trash" }]);
  const [steps,         setSteps]         = useState(_saved?.steps        || []);
  const [liquids,       setLiquids]       = useState(_saved?.liquids      || []);
  const [protocolName,  setProtocolName]  = useState(_saved?.protocolName || "My Custom Protocol");
  const [author,        setAuthor]        = useState(_saved?.author       || "Lab User");
  const [description,   setDescription]  = useState(_saved?.description  || "");
  const [liquidSensing, setLiquidSensing] = useState(_saved?.liquidSensing ?? true);

  // ── UI state ─────────────────────────────────────────────────────────────────

  const [activeTab,           setActiveTab]           = useState("build");
  const [sidePanel,           setSidePanel]           = useState("steps");
  const [selectedSlot,        setSelectedSlot]        = useState(null);
  const [editingLabel,        setEditingLabel]        = useState(null);
  const [draggingFrom,        setDraggingFrom]        = useState(null);
  const [hoveredWell,         setHoveredWell]         = useState(null);
  const [expandedStep,        setExpandedStep]        = useState(null);
  const [copied,              setCopied]              = useState(false);

  // ── Modal state ──────────────────────────────────────────────────────────────

  const [showConnectionModal, setShowConnectionModal] = useState(null);
  const [showTemplateModal,   setShowTemplateModal]   = useState(false);
  const [showImportModal,     setShowImportModal]     = useState(false);
  const [showNewModal,        setShowNewModal]        = useState(false);
  const [importError,         setImportError]         = useState("");
  const [pendingRemoveSlot,   setPendingRemoveSlot]   = useState(null);
  const [pendingRemoveStep,   setPendingRemoveStep]   = useState(null);
  const [wellInfoModal,       setWellInfoModal]       = useState(null);

  const fileInputRef    = useRef(null);
  const stepEditTimerRef = useRef(null);

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  const [history, setHistory] = useState([]);
  const [future,  setFuture]  = useState([]);

  const snapshot = useCallback(() => ({
    labware, steps, liquids,
    protocolName, author, description, liquidSensing,
  }), [labware, steps, liquids, protocolName, author, description, liquidSensing]);

  const restoreSnapshot = useCallback(s => {
    setLabware(s.labware);
    setSteps(s.steps);
    setLiquids(s.liquids);
    if (s.protocolName  !== undefined) setProtocolName(s.protocolName);
    if (s.author        !== undefined) setAuthor(s.author);
    if (s.description   !== undefined) setDescription(s.description);
    if (s.liquidSensing !== undefined) setLiquidSensing(s.liquidSensing);
  }, []);

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-29), snapshot()]);
    setFuture([]);
  }, [snapshot]);

  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture(f => [snapshot(), ...f]);
      restoreSnapshot(prev);
      return h.slice(0, -1);
    });
  }, [snapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[0];
      setHistory(h => [...h, snapshot()]);
      restoreSnapshot(next);
      return f.slice(1);
    });
  }, [snapshot, restoreSnapshot]);

  // ── Step creation ────────────────────────────────────────────────────────────

  const addStep = useCallback(type => {
    pushHistory();
    setSteps(prev => {
      const newSteps = [...prev, {
        type, volume: type === "transfer" ? 100 : 50,
        sourceSlot: "", sourceWell: "A1",
        destSlot: "", destWell: "A1",
        multiDests: [],        // each entry: { slot, well, volume? } — volume null = use step.volume
        pipette: "", tipPolicy: "new_each",
        keepTipAfterStep: false,
        liquidClass: "",
        note: "",          // optional free-text label emitted as protocol.comment()
        prewet: false, touchTip: false, remeasureEachAsp: false,
        airGap: 0, mixReps: 3,
        aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
        delayAfterAspirate: 0, delayAfterDispense: 0,
        meniscusOffset: -5,
        dispenseRef: "top", dispenseTopOffset: -2,
        blowoutRef: "top", blowoutTopOffset: -2,
        endLocation: "", movementDelay: 0,
      }];
      setExpandedStep(newSteps.length - 1);
      return newSteps;
    });
    setSidePanel("steps");
  }, [pushHistory]);

  // ── Labware mutations ────────────────────────────────────────────────────────

  const handleSlotDrop = useCallback((slot, e) => {
    if (slot === "A3") return;
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.type === "labware") {
        pushHistory();
        setLabware(prev => [
          ...prev.filter(l => l.slot !== slot),
          { slot, def: data.def, label: "", id: `${slot}-${Date.now()}` }
        ]);
      } else if (data.type === "labware-move") {
        if (data.fromSlot === slot) return;
        pushHistory();
        setSteps(prev => prev.map(s => ({
          ...s,
          sourceSlot: s.sourceSlot === data.fromSlot ? slot : s.sourceSlot,
          destSlot:   s.destSlot   === data.fromSlot ? slot : s.destSlot,
          multiDests: (s.multiDests || []).map(d =>
            d.slot === data.fromSlot ? { ...d, slot } : d
          ),
        })));
        setLiquids(prev => prev.map(l =>
          l.slot === data.fromSlot ? { ...l, slot } : l
        ));
        setLabware(prev => {
          const displaced = prev.find(l => l.slot === slot && l.def !== "_trash");
          let base = prev.filter(l => l.slot !== data.fromSlot && l.slot !== slot);
          const moved = { ...prev.find(l => l.slot === data.fromSlot), slot };
          if (displaced) base = [...base, { ...displaced, slot: data.fromSlot }];
          return [...base, moved];
        });
        if (selectedSlot === data.fromSlot) setSelectedSlot(slot);
      }
    } catch {}
  }, [pushHistory, selectedSlot]);

  const stepsReferencingSlot = useCallback(slot =>
    steps.filter(s =>
      s.sourceSlot === slot ||
      s.destSlot === slot ||
      (s.multiDests || []).some(d => d.slot === slot)
    ), [steps]);

  const executeRemoveLabware = useCallback(slot => {
    pushHistory();
    setLabware(prev => prev.filter(l => l.slot !== slot));
    setSteps(prev => prev
      .map(s => {
        const cleanedMultiDests = (s.multiDests || []).filter(d => d.slot !== slot);
        if (s.sourceSlot === slot) return null;
        const newDestSlot = s.destSlot === slot ? "" : s.destSlot;
        const newDestWell = s.destSlot === slot ? "" : s.destWell;
        const hasPrimary = newDestSlot && newDestWell;
        const hasMulti   = cleanedMultiDests.length > 0;
        if (s.type === "transfer" && !hasPrimary && !hasMulti) return null;
        return { ...s, destSlot: newDestSlot, destWell: newDestWell, multiDests: cleanedMultiDests };
      })
      .filter(Boolean)
    );
    setLiquids(prev => prev.map(l =>
      l.slot === slot ? { ...l, slot: "", well: "" } : l
    ));
    if (selectedSlot === slot) setSelectedSlot(null);
  }, [pushHistory, selectedSlot]);

  const removeLabware = useCallback(slot => {
    const affected = stepsReferencingSlot(slot);
    if (affected.length > 0) {
      setPendingRemoveSlot(slot);
    } else {
      executeRemoveLabware(slot);
    }
  }, [stepsReferencingSlot, executeRemoveLabware]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  // Placed after removeLabware / addStep are defined to avoid TDZ errors.

  useEffect(() => {
    const handler = e => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select";

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }

      if (e.key === "Escape") {
        setShowConnectionModal(null);
        setShowTemplateModal(false);
        setShowImportModal(false);
        setPendingRemoveSlot(null);
        setPendingRemoveStep(null);
        setShowNewModal(false);
        setEditingLabel(null);
        setWellInfoModal(null);
        return;
      }

      if (!isTyping) {
        if (e.key === "t" || e.key === "T") { e.preventDefault(); addStep("transfer"); }
        if (e.key === "m" || e.key === "M") { e.preventDefault(); addStep("mix"); }

        // Delete / Backspace — remove focused step or selected labware
        if (e.key === "Delete" || e.key === "Backspace") {
          // Priority 1: a step is expanded
          if (expandedStep !== null) {
            e.preventDefault();
            setSteps(prev => {
              const s = prev[expandedStep];
              if (!s) return prev;
              const isComplex = (s.multiDests?.length > 0) ||
                (s.type === "transfer" && s.destSlot && s.sourceSlot) ||
                (s.type === "mix");
              if (isComplex) {
                setPendingRemoveStep(expandedStep);
                return prev;
              }
              pushHistory();
              setExpandedStep(null);
              return prev.filter((_, i) => i !== expandedStep);
            });
            return;
          }
          // Priority 2: a labware slot is selected
          if (selectedSlot && selectedSlot !== "A3") {
            e.preventDefault();
            removeLabware(selectedSlot);
            return;
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, addStep, expandedStep, selectedSlot, removeLabware, pushHistory]);

  // ── Label editing ────────────────────────────────────────────────────────────

  const startLabelEdit = useCallback((slot, currentLabel) => {
    setEditingLabel({ slot, value: currentLabel });
  }, []);

  const commitLabel = useCallback(() => {
    if (!editingLabel) return;
    setLabware(prev => prev.map(l =>
      l.slot === editingLabel.slot ? { ...l, label: editingLabel.value } : l
    ));
    setEditingLabel(null);
  }, [editingLabel]);

  // ── Step mutations ───────────────────────────────────────────────────────────

  const updateStep = useCallback((i, k, v) => {
    if (stepEditTimerRef.current) clearTimeout(stepEditTimerRef.current);
    stepEditTimerRef.current = setTimeout(() => {
      pushHistory();
      stepEditTimerRef.current = null;
    }, 600);
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  }, [pushHistory]);

  const removeStep = useCallback(i => {
    const s = steps[i];
    const isComplex = (s.multiDests?.length > 0) ||
      (s.type === "transfer" && s.destSlot && s.sourceSlot) ||
      (s.type === "mix");
    if (isComplex) {
      setPendingRemoveStep(i);
    } else {
      pushHistory();
      setSteps(prev => prev.filter((_, idx) => idx !== i));
    }
  }, [steps, pushHistory]);

  const duplicateStep = useCallback(i => {
    pushHistory();
    setSteps(prev => [...prev.slice(0, i + 1), { ...prev[i] }, ...prev.slice(i + 1)]);
  }, [pushHistory]);

  const moveStep = useCallback((i, dir) => {
    pushHistory();
    setSteps(prev => {
      const a = [...prev]; const j = i + dir;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]]; return a;
    });
  }, [pushHistory]);

  const copyStepSettings = useCallback((srcIdx, targetIdxs, fields) => {
    pushHistory();
    setSteps(prev => prev.map((s, si) => {
      if (!targetIdxs.includes(si)) return s;
      const patch = {};
      fields.forEach(f => { patch[f] = prev[srcIdx][f]; });
      return { ...s, ...patch };
    }));
  }, [pushHistory]);

  // ── Connection / drag wiring ─────────────────────────────────────────────────

  const handleConnectionDrop = useCallback((dstSlot, dstWell) => {
    if (!draggingFrom) return;
    const { slot: srcSlot, well: srcWell } = draggingFrom;
    if (srcSlot === dstSlot && srcWell === dstWell) { setDraggingFrom(null); return; }
    const existingSourceSteps = steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type === "transfer" && s.sourceSlot === srcSlot && s.sourceWell === srcWell);
    setShowConnectionModal({ srcSlot, srcWell, dstSlot, dstWell, existingSourceSteps });
    setDraggingFrom(null);
    setHoveredWell(null);
  }, [draggingFrom, steps]);

  const confirmConnection = useCallback((vol, pipette, preset) => {
    const { srcSlot, srcWell, dstSlot, dstWell } = showConnectionModal;
    const p = preset ? SOLVENT_PRESETS[preset] : {};
    pushHistory();
    setSteps(prev => [...prev, {
      type: "transfer",
      sourceSlot: srcSlot, sourceWell: srcWell,
      destSlot: dstSlot, destWell: dstWell,
      multiDests: [],
      volume: vol, pipette,
      tipPolicy: "new_each",
      keepTipAfterStep: false,
      liquidClass: "",
      prewet: p.prewet || false,
      touchTip: p.touchTip || false,
      airGap: p.airGap || 0,
      mixReps: 3,
      aspirateRate: p.aspirateRate || 150,
      dispenseRate: p.dispenseRate || 300,
      blowoutRate: p.blowoutRate || 200,
      delayAfterAspirate: p.delayAfterAspirate || 0,
      delayAfterDispense: p.delayAfterDispense || 0,
      meniscusOffset: p.meniscusOffset ?? -5,
      dispenseRef: "top", dispenseTopOffset: p.dispenseTopOffset ?? -2,
      blowoutRef: "top", blowoutTopOffset: p.blowoutTopOffset ?? -2,
      remeasureEachAsp: false,
      endLocation: "", movementDelay: 0,
      note: "",
    }]);
    setShowConnectionModal(null);
    setSidePanel("steps");
    setSteps(prev => { setExpandedStep(prev.length - 1); return prev; });
  }, [showConnectionModal, pushHistory]);

  const handleAddToStep = useCallback((stepIdx, dstSlot, dstWell) => {
    pushHistory();
    setSteps(prev => prev.map((s, i) => {
      if (i !== stepIdx) return s;
      return { ...s, multiDests: [...(s.multiDests || []), { slot: dstSlot, well: dstWell, volume: null }] };
    }));
    setShowConnectionModal(null);
    setSidePanel("steps");
    setExpandedStep(stepIdx);
  }, [pushHistory]);

  // ── Save / Load ──────────────────────────────────────────────────────────────

  const saveJSON = useCallback(() => {
    const state = { labware, steps, liquids, protocolName, author, description, liquidSensing };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    a.download = `${protocolName.replace(/\s+/g, "_")}.json`;
    a.click();
  }, [labware, steps, liquids, protocolName, author, description, liquidSensing]);

  const loadState = useCallback(state => {
    pushHistory();
    if (state.labware)      setLabware(state.labware);
    if (state.steps)        setSteps(state.steps);
    if (state.liquids)      setLiquids(state.liquids);
    if (state.protocolName) setProtocolName(state.protocolName);
    if (state.author)       setAuthor(state.author);
    if (state.description   !== undefined) setDescription(state.description);
    if (state.liquidSensing !== undefined) setLiquidSensing(state.liquidSensing);
  }, [pushHistory]);

  const handleImportFile = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      setImportError("");
      try {
        if (file.name.endsWith(".json")) {
          loadState(JSON.parse(text));
          setShowImportModal(false);
        } else if (file.name.endsWith(".py")) {
          loadState(parseProtocolPy(text));
          setShowImportModal(false);
        } else if (file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
          const newSteps = parseTransferCSV(text);
          pushHistory();
          setSteps(prev => [...prev, ...newSteps]);
          setShowImportModal(false);
        } else {
          setImportError("Unsupported file type. Use .json, .py, or .csv.");
        }
      } catch (err) {
        setImportError(`Parse error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [loadState, pushHistory]);

  const applyTemplate = useCallback(key => {
    const t = TEMPLATES[key];
    if (!t) return;
    loadState({
      labware: t.labware, steps: t.steps, liquids: t.liquids,
      protocolName: t.name, description: t.description, liquidSensing: t.liquidSensing,
    });
    setShowTemplateModal(false);
  }, [loadState]);

  const resetProtocol = useCallback(() => {
    pushHistory();
    setLabware([{ slot: "A3", def: "_trash", label: "Trash", id: "trash" }]);
    setSteps([]);
    setLiquids([]);
    setProtocolName("My Custom Protocol");
    setAuthor("Lab User");
    setDescription("");
    setLiquidSensing(true);
    setSelectedSlot(null);
    setShowNewModal(false);
  }, [pushHistory]);

  // ── Code + derived values ────────────────────────────────────────────────────

  // ── Autosave ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("ot-builder-autosave", JSON.stringify({
        labware, steps, liquids, protocolName, author, description, liquidSensing,
      }));
    } catch {}
  }, [labware, steps, liquids, protocolName, author, description, liquidSensing]);

  const code = generateCode({ labware, steps, liquids, protocolName, author, description, liquidSensing });
  const validation = runValidation({ labware, steps });
  const volumeMap = computeVolumeMap(labware, steps, liquids);
  const runTimeSecs   = estimateRunTime(steps);
  const runTimeLabel  = formatDuration(runTimeSecs);
  const stepTimings   = estimateRunTimePerStep(steps); // seconds per step, same index as steps[]

  // ── CSV export ────────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const header = "step,type,source_slot,source_well,dest_slot,dest_well,volume_uL,pipette,tip_policy,liquid_class,note";
    const rows = steps.flatMap((s, i) => {
      if (s.type === "mix") {
        return [`${i+1},mix,${s.sourceSlot},${s.sourceWell},,,${ s.volume},${s.pipette},,,${s.note||""}`];
      }
      const allDests = [
        { slot: s.destSlot, well: s.destWell, volume: s.volume || 0 },
        ...(s.multiDests || []).map(d => ({
          slot: d.slot, well: d.well,
          volume: (d.volume != null && d.volume !== "") ? Number(d.volume) : (s.volume || 0),
        })),
      ].filter(d => d.slot && d.well);
      return allDests.map(d =>
        `${i+1},transfer,${s.sourceSlot},${s.sourceWell},${d.slot},${d.well},${d.volume},${s.pipette},${s.tipPolicy},${s.liquidClass||""},${s.note||""}`
      );
    });
    const csv = [header, ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${protocolName.replace(/\s+/g, "_")}_transfers.csv`;
    a.click();
  }, [steps, protocolName]);

  const liquidsBySlot = {};
  liquids.forEach(liq => {
    if (!liq.slot || !liq.well) return;
    liquidsBySlot[`${liq.slot}:${liq.well}`] = { color: liq.color, name: liq.name };
  });

  const volWarnings = [];
  Object.entries(volumeMap).forEach(([key, v]) => {
    const [slot] = key.split(":");
    const lw  = labware.find(l => l.slot === slot);
    const def = lw ? LABWARE_DEFS[lw.def] : null;
    if (v.remaining < 0)
      volWarnings.push(`${key}: insufficient (deficit ${fmtVol(Math.abs(v.remaining), def)})`);
    if (v.capacity && v.remaining > v.capacity)
      volWarnings.push(`${key}: overfill risk (${fmtVol(v.remaining, def)} > ${fmtVol(v.capacity, def)})`);
    if (v.deadVol && v.remaining > 0 && v.remaining < v.deadVol)
      volWarnings.push(`${key}: below dead volume (${fmtVol(v.remaining, def)} remaining)`);
  });

  const tipCount = steps.reduce((acc, s) => {
    if (!s.pipette) return acc;
    if (s.type === "mix") return acc + 1;
    const primaryDest = (s.destSlot && s.destWell) ? 1 : 0;
    const multiDestsCount = s.multiDests?.filter(d => d.slot && d.well).length || 0;
    const totalDests = primaryDest + multiDestsCount;
    return acc + (s.tipPolicy === "new_each" ? Math.max(1, totalDests) : 1);
  }, 0);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = `${protocolName.replace(/\s+/g, "_")}_${ts}.py`;
    a.click();
  };

  // ── Return everything App.jsx needs ─────────────────────────────────────────

  return {
    // Protocol state
    labware, setLabware,
    steps, setSteps,
    liquids, setLiquids,
    protocolName, setProtocolName,
    author, setAuthor,
    description, setDescription,
    liquidSensing, setLiquidSensing,

    // UI state
    activeTab, setActiveTab,
    sidePanel, setSidePanel,
    selectedSlot, setSelectedSlot,
    editingLabel, setEditingLabel,
    draggingFrom, setDraggingFrom,
    hoveredWell, setHoveredWell,
    expandedStep, setExpandedStep,
    copied,

    // Modal state
    showConnectionModal, setShowConnectionModal,
    showTemplateModal,   setShowTemplateModal,
    showImportModal,     setShowImportModal,
    showNewModal,        setShowNewModal,
    importError,
    pendingRemoveSlot,   setPendingRemoveSlot,
    pendingRemoveStep,   setPendingRemoveStep,
    wellInfoModal,       setWellInfoModal,

    // Refs
    fileInputRef,

    // Undo/redo
    history, future, pushHistory, undo, redo,

    // Handlers
    handleSlotDrop,
    handleConnectionDrop,
    confirmConnection,
    handleAddToStep,
    addStep,
    updateStep,
    removeStep,
    duplicateStep,
    moveStep,
    copyStepSettings,
    stepsReferencingSlot,
    executeRemoveLabware,
    removeLabware,
    startLabelEdit,
    commitLabel,
    saveJSON,
    loadState,
    handleImportFile,
    applyTemplate,
    resetProtocol,
    copyCode,
    downloadCode,

    // Derived
    code,
    validation,
    volumeMap,
    liquidsBySlot,
    volWarnings,
    tipCount,
    runTimeLabel,
    stepTimings,
    exportCSV,
    runTimeSecs,
  };
}

import { useState, useRef, useEffect, useCallback } from "react";

// ── Labware Definitions ───────────────────────────────────────────────────────

const LABWARE_DEFS = {
  "opentrons_10_tuberack_falcon_4x50ml_6x15ml_conical": {
    label: "Falcon 10-tube rack — 6×15mL + 4×50mL",
    shortLabel: "6×15mL + 4×50mL",
    paletteDesc: "Cols 1–2 = 15mL  ·  Cols 3–4 = 50mL",
    color: "#2563eb",
    wells: ["A1","A2","A3","A4","B1","B2","B3","B4","C1","C2"],
    wellLabels: { "A1":"15mL","A2":"15mL","A3":"50mL","A4":"50mL","B1":"15mL","B2":"15mL","B3":"50mL","B4":"50mL","C1":"15mL","C2":"15mL" },
    wellSizes: { "A1":"sm","A2":"sm","A3":"lg","A4":"lg","B1":"sm","B2":"sm","B3":"lg","B4":"lg","C1":"sm","C2":"sm" },
    rows: 3, cols: 4, shape: "tube", icon: "🧪"
  },
  "opentrons_6_tuberack_falcon_50ml_conical": {
    label: "Falcon 6-tube rack — 6×50mL",
    shortLabel: "6×50mL",
    paletteDesc: "All 6 positions = 50mL conical",
    color: "#7c3aed",
    wells: ["A1","A2","A3","B1","B2","B3"],
    wellLabels: { "A1":"50mL","A2":"50mL","A3":"50mL","B1":"50mL","B2":"50mL","B3":"50mL" },
    wellSizes: { "A1":"lg","A2":"lg","A3":"lg","B1":"lg","B2":"lg","B3":"lg" },
    rows: 2, cols: 3, shape: "tube", icon: "🧪"
  },
  "opentrons_15_tuberack_falcon_15ml_conical": {
    label: "Falcon 15-tube rack — 15×15mL",
    shortLabel: "15×15mL",
    paletteDesc: "15 positions, 15mL conical tubes (3 rows × 5 cols)",
    color: "#0891b2",
    wells: Array.from({length:3}, (_,r) => Array.from({length:5}, (_,c) => `${String.fromCharCode(65+r)}${c+1}`)).flat(),
    wellLabels: Object.fromEntries(Array.from({length:3}, (_,r) => Array.from({length:5}, (_,c) => [`${String.fromCharCode(65+r)}${c+1}`, "15mL"])).flat()),
    wellSizes: Object.fromEntries(Array.from({length:3}, (_,r) => Array.from({length:5}, (_,c) => [`${String.fromCharCode(65+r)}${c+1}`, "sm"])).flat()),
    rows: 3, cols: 5, shape: "tube", icon: "🧪"
  },
  "waters_48_tuberack_2000ul": {
    label: "Waters 48-vial rack — 48×2mL",
    shortLabel: "48×2mL vials",
    paletteDesc: "48 positions, 2mL each (6 rows × 8 cols)",
    color: "#059669",
    wells: Array.from({length:6}, (_,r) => Array.from({length:8}, (_,c) => `${String.fromCharCode(65+r)}${c+1}`)).flat(),
    wellLabels: Object.fromEntries(Array.from({length:6}, (_,r) => Array.from({length:8}, (_,c) => [`${String.fromCharCode(65+r)}${c+1}`, "2mL"])).flat()),
    wellSizes: Object.fromEntries(Array.from({length:6}, (_,r) => Array.from({length:8}, (_,c) => [`${String.fromCharCode(65+r)}${c+1}`, "xs"])).flat()),
    rows: 6, cols: 8, shape: "vial", icon: "🔬"
  },
  "opentrons_flex_96_tiprack_1000ul": {
    label: "Flex 96 tip rack — 1000µL",
    shortLabel: "Tips 1000µL",
    paletteDesc: "96-well tip rack, 1000µL capacity",
    color: "#d97706",
    wells: ["A1"], rows: 1, cols: 1, shape: "tips", icon: "💡"
  },
  "opentrons_flex_96_tiprack_50ul": {
    label: "Flex 96 tip rack — 50µL",
    shortLabel: "Tips 50µL",
    paletteDesc: "96-well tip rack, 50µL capacity",
    color: "#b45309",
    wells: ["A1"], rows: 1, cols: 1, shape: "tips", icon: "💡"
  }
};

const DECK_SLOTS = ["A1","A2","A3","B1","B2","B3","C1","C2","C3","D1","D2","D3"];

const PIPETTES = {
  "flex_1channel_1000": { label: "1-Ch 1000µL", mount: "right", maxVol: 1000, icon: "🔵" },
  "flex_1channel_50":   { label: "1-Ch 50µL",   mount: "left",  maxVol: 50,   icon: "🟢" },
  "flex_8channel_1000": { label: "8-Ch 1000µL",  mount: "right", maxVol: 1000, icon: "🔷" },
  "flex_8channel_50":   { label: "8-Ch 50µL",    mount: "left",  maxVol: 50,   icon: "🟩" },
};

const SOLVENT_PRESETS = {
  aqueous: {
    label: "Aqueous", aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
    airGap: 0, prewet: false, touchTip: false,
    delayAfterAspirate: 0.5, delayAfterDispense: 0.3,
    meniscusOffset: -5, dispenseTopOffset: -2, blowoutTopOffset: -2
  },
  volatile: {
    label: "Volatile (Hexane/MeOH)", aspirateRate: 30, dispenseRate: 50, blowoutRate: 30,
    airGap: 5, prewet: true, touchTip: false,
    delayAfterAspirate: 1.5, delayAfterDispense: 0.8,
    meniscusOffset: -6, dispenseTopOffset: -2, blowoutTopOffset: 0
  },
  viscous: {
    label: "Viscous / Oil", aspirateRate: 20, dispenseRate: 30, blowoutRate: 20,
    airGap: 0, prewet: true, touchTip: true,
    delayAfterAspirate: 2.0, delayAfterDispense: 1.0,
    meniscusOffset: -5, dispenseTopOffset: -5, blowoutTopOffset: -5
  },
};

const TIP_POLICIES = {
  new_each: "New tip each destination",
  one_per_source: "One tip per source",
  one_total: "One tip total",
};

const DISPENSE_REFERENCES = { top: "top()", bottom: "bottom()" };

// ── Theme System ──────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    name: "dark",
    bg:        "#020817",
    bgHeader:  "#04080f",
    bgPanel:   "#03070f",
    bgCard:    "#060e1d",
    bgInput:   "#0a1628",
    bgDeck:    "#04080f",
    bgSlot:    "#050b14",
    border:    "#0f172a",
    borderMid: "#1e293b",
    text:      "#f1f5f9",
    textMid:   "#cbd5e1",
    textDim:   "#94a3b8",
    textFaint: "#64748b",
    textGhost: "#0f172a",
    slotLabel: "#475569",
    icon:      "☀️",
    iconLabel: "Light",
  },
  light: {
    name: "light",
    bg:        "#f1f5f9",
    bgHeader:  "#ffffff",
    bgPanel:   "#f8fafc",
    bgCard:    "#ffffff",
    bgInput:   "#f1f5f9",
    bgDeck:    "#e2e8f0",
    bgSlot:    "#f8fafc",
    border:    "#cbd5e1",
    borderMid: "#94a3b8",
    text:      "#0f172a",
    textMid:   "#334155",
    textDim:   "#475569",
    textFaint: "#94a3b8",
    textGhost: "#cbd5e1",
    slotLabel: "#94a3b8",
    icon:      "🌙",
    iconLabel: "Dark",
  },
};

// ── Well capacity & dead volumes (µL) ─────────────────────────────────────────

const WELL_CAPACITY = {
  "opentrons_6_tuberack_falcon_50ml_conical":             { lg: 50000 },
  "opentrons_10_tuberack_falcon_4x50ml_6x15ml_conical":  { lg: 50000, sm: 15000 },
  "opentrons_15_tuberack_falcon_15ml_conical":            { sm: 15000 },
  "waters_48_tuberack_2000ul":                            { xs: 2000 },
};

const DEAD_VOLUME = {
  "opentrons_6_tuberack_falcon_50ml_conical":             { lg: 1500 },
  "opentrons_10_tuberack_falcon_4x50ml_6x15ml_conical":  { lg: 1500, sm: 800 },
  "opentrons_15_tuberack_falcon_15ml_conical":            { sm: 800 },
  "waters_48_tuberack_2000ul":                            { xs: 100 },
};

// ── Run-time estimate (very rough, seconds) ───────────────────────────────────

function estimateRunTime(steps) {
  let secs = 10; // startup
  steps.forEach(s => {
    if (!s.pipette) return;
    const pip = PIPETTES[s.pipette];
    if (!pip) return;
    const vol = s.volume || 0;
    const safeMaxVol = Math.max(1, pip.maxVol - (s.airGap || 0));
    const trips = Math.ceil(vol / safeMaxVol);
    const dests = s.multiDests?.length > 0
      ? s.multiDests.length + (s.destSlot ? 1 : 0)
      : 1;

    if (s.type === "mix") {
      secs += 3 + (s.mixReps || 3) * (vol / (pip.maxVol * 0.5)) * 2;
      return;
    }

    const perDest =
      2 +                                // tip pick up
      trips * (
        (vol / (s.aspirateRate || 150)) +
        (s.delayAfterAspirate || 0) +
        (s.airGap ? 0.3 : 0) +
        (vol / (s.dispenseRate || 300)) +
        (s.delayAfterDispense || 0) +
        0.5                              // blow out
      ) +
      (s.touchTip ? 1 : 0) +
      (s.tipPolicy === "new_each" ? 2 : 0); // drop tip

    const tipPickup = s.tipPolicy === "new_each" ? dests * 2 : 2;
    secs += tipPickup + dests * perDest;
    if (s.prewet) secs += 3;
  });
  return Math.round(secs);
}

function formatDuration(secs) {
  if (secs < 60) return `~${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

// Connection line colors keyed by pipette — makes multi-pipette decks readable at a glance
const PIPETTE_COLORS = {
  "flex_1channel_1000": "#22d3ee",
  "flex_1channel_50":   "#a3e635",
  "flex_8channel_1000": "#818cf8",
  "flex_8channel_50":   "#34d399",
};

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES = {
  bha_prep: {
    name: "BHA 8-Destination Prep",
    description: "Base matrix dispensed from one 50 mL tube into 8 sample vials. One tip per source, liquid sensing on.",
    labware: [
      { slot: "B1", def: "opentrons_6_tuberack_falcon_50ml_conical",             label: "BHA Matrix" },
      { slot: "C1", def: "waters_48_tuberack_2000ul",                             label: "Sample Vials" },
      { slot: "D1", def: "opentrons_flex_96_tiprack_1000ul",                      label: "Tips 1mL" },
      { slot: "A3", def: "_trash", label: "Trash" },
    ],
    steps: [
      {
        type: "transfer", sourceSlot: "B1", sourceWell: "A1",
        destSlot: "C1", destWell: "A1",
        multiDests: [
          { slot: "C1", well: "A2" }, { slot: "C1", well: "A3" }, { slot: "C1", well: "A4" },
          { slot: "C1", well: "A5" }, { slot: "C1", well: "A6" }, { slot: "C1", well: "A7" },
          { slot: "C1", well: "A8" },
        ],
        volume: 900, pipette: "flex_1channel_1000",
        tipPolicy: "one_per_source", prewet: false, touchTip: false, airGap: 0, mixReps: 3,
        aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
        delayAfterAspirate: 0.5, delayAfterDispense: 0.3,
        meniscusOffset: -5, dispenseRef: "top", dispenseTopOffset: -2,
        blowoutRef: "top", blowoutTopOffset: -2, remeasureEachAsp: true,
      },
    ],
    liquids: [
      { id: 1, name: "BHA Matrix", description: "Base matrix solution", color: "#2563eb", slot: "B1", well: "A1", volume: 10000 },
    ],
    liquidSensing: true,
  },
  calibration_curve: {
    name: "Methanol Calibration Curve",
    description: "IS added to 8 calibration vials from a single source. Volatile preset, one tip total, re-measure each aspirate.",
    labware: [
      { slot: "B1", def: "opentrons_15_tuberack_falcon_15ml_conical", label: "Standards" },
      { slot: "B2", def: "opentrons_6_tuberack_falcon_50ml_conical",   label: "IS / Solvent" },
      { slot: "C1", def: "waters_48_tuberack_2000ul",                  label: "Calibration Vials" },
      { slot: "D1", def: "opentrons_flex_96_tiprack_1000ul",           label: "Tips 1mL" },
      { slot: "D2", def: "opentrons_flex_96_tiprack_50ul",             label: "Tips 50µL" },
      { slot: "A3", def: "_trash", label: "Trash" },
    ],
    steps: [
      {
        type: "transfer", sourceSlot: "B2", sourceWell: "A1",
        destSlot: "C1", destWell: "A1",
        multiDests: [
          { slot: "C1", well: "A2" }, { slot: "C1", well: "A3" }, { slot: "C1", well: "A4" },
          { slot: "C1", well: "A5" }, { slot: "C1", well: "A6" }, { slot: "C1", well: "A7" },
          { slot: "C1", well: "A8" },
        ],
        volume: 10, pipette: "flex_1channel_50",
        tipPolicy: "one_total", prewet: true, touchTip: false, airGap: 5, mixReps: 3,
        aspirateRate: 30, dispenseRate: 50, blowoutRate: 30,
        delayAfterAspirate: 1.5, delayAfterDispense: 0.8,
        meniscusOffset: -6, dispenseRef: "bottom", dispenseTopOffset: 10,
        blowoutRef: "top", blowoutTopOffset: 0, remeasureEachAsp: true,
      },
    ],
    liquids: [
      { id: 1, name: "Internal Standard", description: "IS in methanol", color: "#f59e0b", slot: "B2", well: "A1", volume: 5000 },
      { id: 2, name: "Calibration Solvent", description: "Methanol",     color: "#06b6d4", slot: "B2", well: "B1", volume: 50000 },
    ],
    liquidSensing: true,
  },
  hexane_test: {
    name: "Hexane Volatile Transfer Test",
    description: "1 mL hexane to 5 vials. Volatile preset, new tip each, air gap 5 µL.",
    labware: [
      { slot: "B1", def: "opentrons_6_tuberack_falcon_50ml_conical", label: "Hexane Source" },
      { slot: "C1", def: "waters_48_tuberack_2000ul",                label: "Test Vials" },
      { slot: "D1", def: "opentrons_flex_96_tiprack_1000ul",         label: "Tips 1mL" },
      { slot: "A3", def: "_trash", label: "Trash" },
    ],
    steps: [
      {
        type: "transfer", sourceSlot: "B1", sourceWell: "A1",
        destSlot: "C1", destWell: "A1",
        multiDests: [
          { slot: "C1", well: "A2" }, { slot: "C1", well: "A3" },
          { slot: "C1", well: "A4" }, { slot: "C1", well: "A5" },
        ],
        volume: 1000, pipette: "flex_1channel_1000",
        tipPolicy: "new_each", prewet: true, touchTip: false, airGap: 5, mixReps: 3,
        aspirateRate: 30, dispenseRate: 50, blowoutRate: 30,
        delayAfterAspirate: 1.5, delayAfterDispense: 0.8,
        meniscusOffset: -6, dispenseRef: "top", dispenseTopOffset: -2,
        blowoutRef: "top", blowoutTopOffset: 0, remeasureEachAsp: false,
      },
    ],
    liquids: [
      { id: 1, name: "Hexane", description: "n-Hexane volatile solvent", color: "#f97316", slot: "B1", well: "A1", volume: 20000 },
    ],
    liquidSensing: true,
  },
};

// ── Protocol Validation ───────────────────────────────────────────────────────

function runValidation({ labware, steps }) {
  const errors = [], warnings = [], ok = [];

  const realLabware = labware.filter(l => l.def !== "_trash" && l.slot !== "A3");
  if (realLabware.length === 0) errors.push("No labware on deck");
  if (steps.length === 0) warnings.push("No steps defined yet");

  const slotCounts = {};
  labware.forEach(l => { slotCounts[l.slot] = (slotCounts[l.slot] || 0) + 1; });
  Object.entries(slotCounts).forEach(([slot, count]) => {
    if (count > 1) errors.push(`Duplicate labware in slot ${slot}`);
  });

  const mounts = {};
  const warnedRacks = new Set();
  steps.forEach((s, i) => {
    const n = i + 1;

    if (!s.sourceSlot) {
      errors.push(`Step ${n}: no source slot`);
    } else {
      const srcLw = labware.find(l => l.slot === s.sourceSlot);
      if (!srcLw) errors.push(`Step ${n}: source slot ${s.sourceSlot} not on deck`);
      else if (!s.sourceWell) errors.push(`Step ${n}: no source well selected`);
      else {
        const def = LABWARE_DEFS[srcLw.def];
        if (def && !def.wells.includes(s.sourceWell))
          errors.push(`Step ${n}: source well ${s.sourceWell} not in ${srcLw.label || s.sourceSlot}`);
      }
    }

    if (!s.pipette) errors.push(`Step ${n}: no pipette selected`);

    if (s.type === "transfer") {
      const hasPrimary = s.destSlot && s.destWell;
      const hasMulti = s.multiDests?.length > 0;
      if (!hasPrimary && !hasMulti) {
        errors.push(`Step ${n}: no destination`);
      } else {
        if (s.destSlot) {
          const dstLw = labware.find(l => l.slot === s.destSlot);
          if (!dstLw) errors.push(`Step ${n}: dest slot ${s.destSlot} not on deck`);
          else if (!s.destWell) errors.push(`Step ${n}: no destination well selected`);
          else {
            const def = LABWARE_DEFS[dstLw.def];
            if (def && !def.wells.includes(s.destWell))
              errors.push(`Step ${n}: dest well ${s.destWell} not in ${dstLw.label || s.destSlot}`);
          }
        }
        (s.multiDests || []).forEach((md, mi) => {
          if (!md.slot || !md.well) {
            errors.push(`Step ${n}: additional dest ${mi + 1} missing slot or well`);
          } else {
            const mdLw = labware.find(l => l.slot === md.slot);
            if (!mdLw) errors.push(`Step ${n}: additional dest ${mi + 1} slot ${md.slot} not on deck`);
            else {
              const def = LABWARE_DEFS[mdLw.def];
              if (def && !def.wells.includes(md.well))
                errors.push(`Step ${n}: additional dest ${mi + 1} well ${md.well} not valid`);
            }
          }
        });
      }
    }

    if (s.pipette) {
      const pd = PIPETTES[s.pipette];
      if (pd) {
        if (mounts[pd.mount] && mounts[pd.mount] !== s.pipette)
          errors.push(`Mount conflict: two pipettes assigned to ${pd.mount} mount`);
        mounts[pd.mount] = s.pipette;

        const tDef = pd.maxVol >= 1000
          ? "opentrons_flex_96_tiprack_1000ul"
          : "opentrons_flex_96_tiprack_50ul";
        if (!labware.find(l => l.def === tDef) && !warnedRacks.has(tDef)) {
          warnings.push(`No ${pd.maxVol}µL tip rack on deck (used by step ${n})`);
          warnedRacks.add(tDef);
        }

        if (s.airGap > 0 && s.airGap >= pd.maxVol)
          errors.push(`Step ${n}: airGap (${s.airGap}µL) >= pipette max (${pd.maxVol}µL) — no room for liquid`);

        if (s.volume && s.volume > pd.maxVol) {
          const safeTrips = Math.ceil(s.volume / Math.max(1, pd.maxVol - (s.airGap || 0)));
          ok.push(`Step ${n}: ${safeTrips}-trip transfer (${s.volume}µL > ${pd.maxVol}µL max)`);
        }
      }
    }
  });

  if (errors.length === 0 && warnings.length === 0) ok.unshift("Protocol looks valid ✓");
  return { errors, warnings, ok };
}

// ── Python .py File Parser ────────────────────────────────────────────────────

function parseProtocolPy(text) {
  const result = {
    labware: [], steps: [], liquids: [],
    protocolName: "Imported Protocol", author: "", description: "",
    liquidSensing: true,
  };

  // Metadata
  const nameMatch = text.match(/"protocolName"\s*:\s*"([^"]+)"/);
  if (nameMatch) result.protocolName = nameMatch[1];
  const authorMatch = text.match(/"author"\s*:\s*"([^"]+)"/);
  if (authorMatch) result.author = authorMatch[1];
  const descMatch = text.match(/"description"\s*:\s*"([^"]+)"/);
  if (descMatch) result.description = descMatch[1];

  // Liquid sensing
  if (/liquid_presence_detection\s*=\s*False/i.test(text)) {
    result.liquidSensing = false;
  }

  // Labware — match load_labware("def", "slot", "label")
  const lwRe = /protocol\.load_labware\(\s*"([^"]+)"\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]*)")?\)/g;
  let m;
  while ((m = lwRe.exec(text)) !== null) {
    const [, def, slot, label = ""] = m;
    if (LABWARE_DEFS[def] && !result.labware.find(l => l.slot === slot)) {
      result.labware.push({ slot, def, label, id: `${slot}-import` });
    }
  }
  result.labware.push({ slot: "A3", def: "_trash", label: "Trash", id: "trash" });

  // Best-effort: pair aspirate → dispense to create transfer steps
  // Look for patterns like: pip_xxx.aspirate(vol, lw_b1["A1"]...)
  const aspRe = /pip[\w_]*\.aspirate\(\s*([\d.]+)\s*,\s*lw_(\w+)\["([^"]+)"\]/g;
  const disRe = /pip[\w_]*\.dispense\([^,]+,\s*lw_(\w+)\["([^"]+)"\]/g;
  const asps = [], diss = [];
  while ((m = aspRe.exec(text)) !== null) asps.push({ vol: parseFloat(m[1]), slot: m[2].toUpperCase(), well: m[3] });
  while ((m = disRe.exec(text)) !== null) diss.push({ slot: m[1].toUpperCase(), well: m[2] });

  // Detect pipette from variable names like pip_flex_1channel_50
  let detectedPipette = "flex_1channel_1000";
  for (const pip of Object.keys(PIPETTES)) {
    if (text.includes(`pip_${pip}`) || text.includes(`"${pip}"`)) {
      detectedPipette = pip; break;
    }
  }

  for (let i = 0; i < Math.min(asps.length, diss.length, 30); i++) {
    result.steps.push({
      type: "transfer",
      sourceSlot: asps[i].slot, sourceWell: asps[i].well,
      destSlot: diss[i].slot,   destWell: diss[i].well,
      multiDests: [], volume: asps[i].vol || 100,
      pipette: detectedPipette, tipPolicy: "new_each",
      prewet: false, touchTip: false, airGap: 0, mixReps: 3,
      aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
      delayAfterAspirate: 0, delayAfterDispense: 0, meniscusOffset: -5,
      dispenseRef: "top", dispenseTopOffset: -2,
      blowoutRef: "top", blowoutTopOffset: -2, remeasureEachAsp: false,
    });
  }

  return result;
}

// ── Volume display helpers ─────────────────────────────────────────────────────
// Tubes (15mL, 50mL) show in mL; small vials show in µL
function fmtVol(uL, labwareDef) {
  const isTube = labwareDef?.shape === "tube";
  if (isTube) {
    const ml = uL / 1000;
    return ml === Math.floor(ml) ? `${ml} mL` : `${ml.toFixed(2).replace(/\.?0+$/, "")} mL`;
  }
  return `${Math.round(uL)} µL`;
}
function parseVolInput(val, isTube) {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return isTube ? n * 1000 : n; // tubes: input is mL, store as µL
}


// Returns { [slot:well]: { remaining, initial, capacity, deadVol } }

function computeVolumeMap(labware, steps, liquids) {
  const map = {}; // key = "slot:well"

  // Seed from liquids
  liquids.forEach(liq => {
    if (!liq.slot || !liq.well) return;
    const k = `${liq.slot}:${liq.well}`;
    if (!map[k]) map[k] = { initial: 0, remaining: 0 };
    map[k].initial += liq.volume || 0;
    map[k].remaining += liq.volume || 0;
  });

  // Annotate with capacity / dead volume
  labware.forEach(lw => {
    const def = LABWARE_DEFS[lw.def];
    if (!def || def.shape === "tips") return;
    const cap = WELL_CAPACITY[lw.def] || {};
    const dead = DEAD_VOLUME[lw.def] || {};
    def.wells.forEach(w => {
      const sz = def.wellSizes?.[w] || "sm";
      const k = `${lw.slot}:${w}`;
      if (!map[k]) map[k] = { initial: 0, remaining: 0 };
      map[k].capacity = cap[sz] || 0;
      map[k].deadVol  = dead[sz] || 0;
    });
  });

  // Simulate steps
  steps.forEach(s => {
    if (s.type !== "transfer" || !s.sourceSlot || !s.sourceWell) return;
    const srcKey = `${s.sourceSlot}:${s.sourceWell}`;
    const dests = [
      ...(s.destSlot && s.destWell ? [{ slot: s.destSlot, well: s.destWell }] : []),
      ...(s.multiDests || []),
    ];
    const vol = s.volume || 0;
    const totalOut = vol * dests.length;
    if (!map[srcKey]) map[srcKey] = { initial: 0, remaining: 0 };
    map[srcKey].remaining -= totalOut;

    dests.forEach(d => {
      if (!d.slot || !d.well) return;
      const dk = `${d.slot}:${d.well}`;
      if (!map[dk]) map[dk] = { initial: 0, remaining: 0 };
      map[dk].remaining += vol;
    });
  });

  return map;
}

// ── CSV Transfer Import ───────────────────────────────────────────────────────
// Parses: srcSlot, srcWell, dstSlot, dstWell, volume (µL)
// Header row is auto-detected. Returns array of step objects.

function parseTransferCSV(text, defaultPipette = "flex_1channel_1000") {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error("Empty file");

  // Detect header
  const first = lines[0].toLowerCase();
  const hasHeader = /slot|well|vol|source|dest/i.test(first);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const steps = [];
  dataLines.forEach((line, li) => {
    const cols = line.split(/[,\t]/).map(c => c.trim());
    if (cols.length < 5) return; // skip short rows
    const [srcSlot, srcWell, dstSlot, dstWell, volStr] = cols;
    const vol = parseFloat(volStr);
    if (!srcSlot || !srcWell || !dstSlot || !dstWell || isNaN(vol)) return;
    steps.push({
      type: "transfer",
      sourceSlot: srcSlot.toUpperCase(), sourceWell: srcWell.toUpperCase(),
      destSlot: dstSlot.toUpperCase(),   destWell: dstWell.toUpperCase(),
      multiDests: [], volume: vol,
      pipette: defaultPipette, tipPolicy: "new_each",
      prewet: false, touchTip: false, airGap: 0, mixReps: 3, remeasureEachAsp: false,
      aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
      delayAfterAspirate: 0, delayAfterDispense: 0, meniscusOffset: -5,
      dispenseRef: "top", dispenseTopOffset: -2, blowoutRef: "top", blowoutTopOffset: -2,
    });
  });

  if (!steps.length) throw new Error("No valid rows found (expected: srcSlot, srcWell, dstSlot, dstWell, volume)");
  return steps;
}

// ── Code Generator ────────────────────────────────────────────────────────────

function generateCode({ labware, steps, liquids, protocolName, author, description, liquidSensing = true }) {
  const L = [];
  const push = (s = "") => L.push(s);

  push(`from opentrons import protocol_api`);
  push();
  push(`metadata = {`);
  push(`    "protocolName": "${protocolName || 'Custom Protocol'}",`);
  push(`    "author": "${author || 'Lab User'}",`);
  if (description) push(`    "description": "${description.replace(/"/g, "'")}",`);
  push(`    "source": "Opentrons Builder"`);
  push(`}`);
  push(`requirements = {"robotType": "Flex", "apiLevel": "2.23"}`);
  push();
  push(`def run(protocol: protocol_api.ProtocolContext):`);
  push();
  push(`    protocol.load_trash_bin("A3")`);
  push();

  // Labware
  const nonTrash = labware.filter(lw => lw.slot !== "A3" && lw.def !== "_trash");
  nonTrash.forEach(lw => {
    const varName = lwVar(lw.slot);
    push(`    ${varName} = protocol.load_labware("${lw.def}", "${lw.slot}", "${lw.label || lw.slot}")`);
  });
  push();

  // Pipettes — deduplicate, find tip racks
  const usedPipettes = {};
  steps.forEach(s => { if (s.pipette) usedPipettes[s.pipette] = true; });
  Object.keys(usedPipettes).forEach(pip => {
    const pd = PIPETTES[pip]; if (!pd) return;
    const tDef = pd.maxVol >= 1000 ? "opentrons_flex_96_tiprack_1000ul" : "opentrons_flex_96_tiprack_50ul";
    const tRacks = labware.filter(lw => lw.def === tDef);
    const trVars = tRacks.map(t => lwVar(t.slot)).join(", ");
    if (tRacks.length > 0) {
      push(`    pip_${pip} = protocol.load_instrument("${pip}", mount="${pd.mount}", tip_racks=[${trVars}], liquid_presence_detection=${liquidSensing ? "True" : "False"})`);
    } else {
      push(`    # WARNING: No ${tDef} found on deck — add one to the deck layout`);
      push(`    pip_${pip} = protocol.load_instrument("${pip}", mount="${pd.mount}", tip_racks=[], liquid_presence_detection=${liquidSensing ? "True" : "False"})`);
    }
  });
  push();

  // Liquids
  if (liquids && liquids.length > 0) {
    push(`    # ── Liquid definitions ──`);
    liquids.forEach(liq => {
      const varName = `liq_${liq.name.replace(/\W+/g, "_").toLowerCase()}`;
      push(`    ${varName} = protocol.define_liquid(`);
      push(`        name="${liq.name}",`);
      push(`        description="${liq.description || ''}",`);
      push(`        display_color="${liq.color}"`);
      push(`    )`);
    });
    push();
    // load_liquid assignments
    liquids.forEach(liq => {
      if (!liq.slot || !liq.well) return;
      const varName = `liq_${liq.name.replace(/\W+/g, "_").toLowerCase()}`;
      const lwV = lwVar(liq.slot);
      push(`    ${lwV}["${liq.well}"].load_liquid(${varName}, volume=${liq.volume || 0})`);
    });
    push();
  }

  // Steps
  steps.forEach((step, i) => {
    if (!step.sourceSlot || !step.pipette) {
      push(`    # Step ${i+1}: INCOMPLETE — skipped`); push(); return;
    }
    const pip = `pip_${step.pipette}`;
    const maxVol = PIPETTES[step.pipette]?.maxVol || 1000;
    const srcV = lwVar(step.sourceSlot);
    const stepLabel = step.type === "transfer"
      ? `Transfer ${step.volume}µL from ${step.sourceSlot}[${step.sourceWell}]`
      : `Mix ${step.mixReps||3}× ${step.volume}µL in ${step.sourceSlot}[${step.sourceWell}]`;

    push(`    # ── Step ${i+1}: ${stepLabel} ──`);
    push(`    protocol.comment("=== Step ${i+1}: ${stepLabel} ===")`);

    if (step.type === "mix") {
      push(`    ${pip}.flow_rate.aspirate = ${step.aspirateRate||150}`);
      push(`    ${pip}.flow_rate.dispense = ${step.dispenseRate||300}`);
      push(`    ${pip}.flow_rate.blow_out = ${step.blowoutRate||200}`);
      push(`    ${pip}.pick_up_tip()`);
      push(`    ${pip}.mix(${step.mixReps||3}, ${step.volume||50}, ${srcV}["${step.sourceWell}"].meniscus(z=${step.meniscusOffset||-5}, target="end"))`);
      push(`    ${pip}.blow_out(${srcV}["${step.sourceWell}"].top(${step.blowoutTopOffset||-2}))`);
      push(`    ${pip}.drop_tip()`);
      push();
      return;
    }

    // Transfer step
    if (!step.destSlot) { push(`    # Step ${i+1}: INCOMPLETE — skipped`); push(); return; }

    const dests = step.multiDests && step.multiDests.length > 0
      ? step.multiDests
      : [{ slot: step.destSlot, well: step.destWell }];

    const menOffset = step.meniscusOffset ?? -5;
    const dispRef = step.dispenseRef || "top";
    const dispOffset = step.dispenseTopOffset ?? -2;
    const blowRef = step.blowoutRef || "top";
    const blowOffset = step.blowoutTopOffset ?? -2;
    const delayAsp = step.delayAfterAspirate ?? 0;
    const delayDisp = step.delayAfterDispense ?? 0;
    const airGap = step.airGap || 0;
    const tipPolicy = step.tipPolicy || "new_each";

    const dispLocation = (dstV, dstW) =>
      dispRef === "bottom"
        ? `${dstV}["${dstW}"].bottom(${dispOffset})`
        : `${dstV}["${dstW}"].top(${dispOffset})`;

    const blowLocation = (dstV, dstW) =>
      blowRef === "bottom"
        ? `${dstV}["${dstW}"].bottom(${blowOffset})`
        : `${dstV}["${dstW}"].top(${blowOffset})`;

    push(`    ${pip}.flow_rate.aspirate = ${step.aspirateRate||150}`);
    push(`    ${pip}.flow_rate.dispense = ${step.dispenseRate||300}`);
    push(`    ${pip}.flow_rate.blow_out = ${step.blowoutRate||200}`);

    if (tipPolicy === "one_total" || tipPolicy === "one_per_source") {
      push(`    ${pip}.pick_up_tip()`);
      if (liquidSensing) push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
      if (step.prewet) emitPrewet(L, pip, srcV, step.sourceWell, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing);
    }

    dests.forEach((dst, di) => {
      const dstV = lwVar(dst.slot);
      const dstW = dst.well;
      const totalVol = step.volume || 0;
      const trips = Math.ceil(totalVol / Math.max(1, maxVol - airGap));
      const volPerTrip = totalVol / trips;

      const aspirateLoc = liquidSensing
        ? `${srcV}["${step.sourceWell}"].meniscus(z=${menOffset}, target="end")`
        : `${srcV}["${step.sourceWell}"].bottom(5)`;

      if (tipPolicy === "new_each") {
        push(`    ${pip}.pick_up_tip()`);
        if (liquidSensing && (step.remeasureEachAsp || di === 0)) {
          push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
        }
        if (di === 0 && step.prewet) emitPrewet(L, pip, srcV, step.sourceWell, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing);
      } else if (liquidSensing && step.remeasureEachAsp) {
        push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
      }

      if (trips > 1) {
        push(`    for _ in range(${trips}):`);
        push(`        ${pip}.aspirate(${fmt(volPerTrip)}, ${aspirateLoc}, rate=1.0)`);
        if (delayAsp > 0) push(`        protocol.delay(seconds=${delayAsp})`);
        if (airGap > 0) push(`        ${pip}.air_gap(${airGap})`);
        push(`        ${pip}.dispense(${fmt(volPerTrip + airGap)}, ${dispLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`        protocol.delay(seconds=${delayDisp})`);
        push(`        ${pip}.blow_out(${blowLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`        protocol.delay(seconds=${delayDisp})`);
        if (step.touchTip) push(`        ${pip}.touch_tip(${dstV}["${dstW}"], v_offset=-2, radius=0.9, speed=20)`);
      } else {
        push(`    ${pip}.aspirate(${fmt(totalVol)}, ${aspirateLoc}, rate=1.0)`);
        if (delayAsp > 0) push(`    protocol.delay(seconds=${delayAsp})`);
        if (airGap > 0) push(`    ${pip}.air_gap(${airGap})`);
        push(`    ${pip}.dispense(${fmt(totalVol + airGap)}, ${dispLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`    protocol.delay(seconds=${delayDisp})`);
        push(`    ${pip}.blow_out(${blowLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`    protocol.delay(seconds=${delayDisp})`);
        if (step.touchTip) push(`    ${pip}.touch_tip(${dstV}["${dstW}"], v_offset=-2, radius=0.9, speed=20)`);
      }

      if (tipPolicy === "new_each") {
        push(`    ${pip}.drop_tip()`);
      }
    });

    if (tipPolicy === "one_total" || tipPolicy === "one_per_source") {
      push(`    ${pip}.drop_tip()`);
    }

    push();
  });

  push(`    protocol.comment("=== Protocol complete ===")`);
  return L.join("\n");
}

function emitPrewet(L, pip, srcV, srcW, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing = true) {
  const pw = Math.min(20, maxVol);
  const aspirateLoc = liquidSensing
    ? `${srcV}["${srcW}"].meniscus(z=${menOffset}, target="end")`
    : `${srcV}["${srcW}"].bottom(5)`;
  L.push(`    # Pre-wet`);
  L.push(`    ${pip}.aspirate(${pw}, ${aspirateLoc}, rate=1.0)`);
  if (delayAsp > 0) L.push(`    protocol.delay(seconds=${delayAsp})`);
  L.push(`    ${pip}.dispense(${pw}, ${srcV}["${srcW}"].top(${dispOffset}))`);
  L.push(`    ${pip}.blow_out(${srcV}["${srcW}"].top(${blowOffset}))`);
  if (delayDisp > 0) L.push(`    protocol.delay(seconds=${delayDisp})`);
}

function lwVar(slot) { return `lw_${slot.toLowerCase()}`; }
function fmt(n) { return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(1)); }

// ── Well Grid ─────────────────────────────────────────────────────────────────

function WellGrid({ lw, def, onWellDragStart, onWellDrop, onWellDragOver, draggingFrom, hoveredWell, setHoveredWell, onWellRef, connectedWells, volumeMap, liquidsBySlot, onWellClick }) {
  if (!def || def.shape === "tips") return (
    <div style={{ padding: 10, textAlign: "center", fontSize: 13, color: def?.color || "#94a3b8", opacity: 0.5 }}>
      {def?.icon} Tip Rack
    </div>
  );

  const rows = def.rows || 2, cols = def.cols || 3;
  // Well sizing — larger cells for better drag targets
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

          // Shape: 50mL conical = rounded square, everything else = circle
          const br = sz === "lg" ? "28%" : "50%";
          // Consistent scale — wells are large and clear
          const sc = isFrom ? 0.90 : isHov ? 0.86 : 0.80;

          // Color state
          let ringColor = null;
          if (isSrc && isDst) ringColor = "#f59e0b";
          else if (isSrc) ringColor = "#22d3ee";
          else if (isDst) ringColor = "#a78bfa";

          // Vacant = hollow, transparent fill, dim border
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
                  : (vm?.initial > 0 ? 0.5 : 0); // if no capacity known but has liquid, show half
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
                    {/* Liquid fill bar — from bottom, clipped by border-radius */}
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
                    {/* Ring color overlay if connected */}
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

// ── Deck Canvas ───────────────────────────────────────────────────────────────

function DeckCanvas({ labware, steps, selectedSlot, onSlotClick, draggingFrom, setDraggingFrom, hoveredWell, setHoveredWell, onWellDragOver, onConnectionDrop, onSlotDrop, onLabelEdit, onWellClick, theme = THEMES.dark, volumeMap = {}, liquidsBySlot = {} }) {
  const slotRefs = useRef({});
  const wellRefs = useRef({}); // wellRefs.current["B3"]["A1"] = DOM el
  const containerRef = useRef(null);
  const [positions, setPositions] = useState({}); // slot-level fallback
  const [wellPositions, setWellPositions] = useState({}); // "slot:well" -> {x,y}
  const [mousePos, setMousePos] = useState(null);

  // Register individual well DOM elements
  const handleWellRef = useCallback((slot, well, el) => {
    if (!wellRefs.current[slot]) wellRefs.current[slot] = {};
    wellRefs.current[slot][well] = el;
  }, []);

  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();

    // Slot-level positions (fallback)
    const np = {};
    Object.entries(slotRefs.current).forEach(([slot, el]) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      np[slot] = { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    });
    setPositions(np);

    // Per-well positions
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

  // Re-measure after any render (catches well grid paint)
  useEffect(() => {
    const t = setTimeout(updatePositions, 80);
    return () => clearTimeout(t);
  }, [labware, steps, updatePositions]);

  // Resolve position for a slot+well, falling back to slot center
  const resolvePos = (slot, well) => {
    const key = `${slot}:${well}`;
    if (wellPositions[key]) return wellPositions[key];
    if (positions[slot]) return positions[slot];
    return null;
  };

  // Build connection lines — one per destination (including multiDests), colored by pipette
  const connections = [];
  steps.forEach((s, si) => {
    if (s.type !== "transfer" || !s.sourceSlot || !s.sourceWell) return;
    const srcPos = resolvePos(s.sourceSlot, s.sourceWell);
    if (!srcPos) return;

    const lineColor = PIPETTE_COLORS[s.pipette] || "#22d3ee";

    const allDests = [
      ...(s.destSlot && s.destWell ? [{ slot: s.destSlot, well: s.destWell }] : []),
      ...(s.multiDests || []),
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
        volLabel: s.volume,
        markerId: `arr-pip-${(s.pipette || "default").replace(/\W/g, "_")}`,
      });
    });
  });

  // Build per-slot connected-wells sets for highlighting
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

  // Draft line: dragging from a well
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
          {/* One arrowhead marker per unique pipette color */}
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
          const margin = 7;
          const x1 = c.x1 + ux*margin, y1 = c.y1 + uy*margin;
          const x2 = c.x2 - ux*margin, y2 = c.y2 - uy*margin;
          const mx = (x1+x2)/2, my = (y1+y2)/2;
          const perp = 18;
          const cpx = mx - uy*perp, cpy = my + ux*perp;
          const midBx = (x1 + 2*cpx + x2)/4, midBy = (y1 + 2*cpy + y2)/4;
          return (
            <g key={c.key}>
              {/* Glow underline */}
              <path d={`M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`}
                stroke={c.color} strokeWidth="3" strokeOpacity="0.12" fill="none" />
              {/* Main line */}
              <path d={`M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`}
                stroke={c.color} strokeWidth="1.5" strokeOpacity="0.7" fill="none"
                strokeDasharray="5 3" markerEnd={`url(#${c.markerId})`} />
              {/* Source dot */}
              <circle cx={x1} cy={y1} r={3} fill={c.color} opacity="0.9" />
              {/* Label pill at curve midpoint */}
              <rect x={midBx-24} y={midBy-9} width={48} height={18} rx={5}
                fill={theme.bg} stroke={c.color} strokeOpacity="0.6" strokeWidth="1" />
              <text x={midBx} y={midBy-1} textAnchor="middle" fill={c.color}
                fontSize="7" fontFamily="monospace" opacity="0.95">{c.srcWell}→{c.dstWell}</text>
              <text x={midBx} y={midBy+7} textAnchor="middle" fill={c.color}
                fontSize="6" fontFamily="monospace" opacity="0.7">{c.volLabel}µL</text>
            </g>
          );
        })}

        {/* Draft line while dragging from a well */}
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
          const lw = labware.find(l => l.slot === slot);
          const def = lw ? LABWARE_DEFS[lw.def] : null;
          const isTrash = slot === "A3";
          const isSel = selectedSlot === slot;
          return (
            <div key={slot} ref={el => slotRefs.current[slot] = el}
              onClick={() => onSlotClick(slot)}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); onSlotDrop(slot, e); }}
              style={{
                minHeight: 140, borderRadius: 10, overflow: "hidden", position: "relative",
                border: `2px ${lw ? "solid" : "dashed"} ${isSel ? "#fbbf24" : lw ? (def?.color || "#475569") : "#0f172a"}`,
                background: lw ? `${(def?.color || "#475569")}0c` : theme.bgSlot,
                cursor: lw && !isTrash ? "pointer" : "default",
                transition: "border-color 0.12s, background 0.12s",
              }}>
              <div style={{ fontSize: 11, color: "#64748b", position: "absolute", top: 4, left: 6, fontFamily: "monospace", fontWeight: 700, zIndex: 2, letterSpacing: 0.5 }}>{slot}</div>
              {isTrash ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.25 }}>
                  <span style={{ fontSize: 22 }}>🗑️</span>
                  <span style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>Trash</span>
                </div>
              ) : lw && def ? (
                <>
                  <div
                    draggable
                    onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData("text/plain", JSON.stringify({ type: "labware-move", fromSlot: slot, def: lw.def })); e.dataTransfer.effectAllowed = "move"; }}
                    onClick={e => { e.stopPropagation(); onLabelEdit && onLabelEdit(slot, lw.label || ""); }}
                    title="Drag to move · Click to rename"
                    style={{
                      position: "absolute", top: 4, right: 6, fontSize: 9, color: def.color,
                      fontWeight: 700, maxWidth: 90, textAlign: "right", zIndex: 2, lineHeight: 1.2,
                      cursor: "grab", padding: "1px 4px", borderRadius: 3,
                      border: "1px solid transparent", transition: "border-color 0.12s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${def.color}55`}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
                  >
                    ⠿ {lw.label || def.shortLabel}
                  </div>
                  <div style={{ paddingTop: 16 }}>
                    <WellGrid lw={lw} def={def}
                      onWellDragStart={(e, s, w) => { setDraggingFrom({ slot: s, well: w }); e.dataTransfer.setData("text/plain", JSON.stringify({ type: "well-drag", slot: s, well: w })); }}
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
                  <div style={{ fontSize: 24, opacity: 0.15 }}>+</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", opacity: 0.5 }}>drop labware</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({ step, index, labware, onRemove, onUpdate, onMoveUp, onMoveDown, onDuplicate, isFirst, isLast, autoExpand, onExpandedChange, steps, onCopySettings }) {
  const [expanded, setExpanded] = useState(false);
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copyTargets, setCopyTargets] = useState(new Set());
  const prevAutoExpand = useRef(false);

  useEffect(() => {
    if (autoExpand && !prevAutoExpand.current) {
      setExpanded(true);
    }
    prevAutoExpand.current = !!autoExpand;
  }, [autoExpand]);

  const src = labware.find(l => l.slot === step.sourceSlot);
  const dst = labware.find(l => l.slot === step.destSlot);
  const srcDef = src ? LABWARE_DEFS[src.def] : null;
  const dstDef = dst ? LABWARE_DEFS[dst.def] : null;
  const pip = PIPETTES[step.pipette];
  const volWarn = pip && step.volume && step.volume > pip.maxVol;
  const incomplete = !step.sourceSlot || !step.pipette || (step.type === "transfer" && !step.destSlot);
  const isTx = step.type === "transfer";

  const inp = {
    fontSize: 12,
    background: "var(--input-bg, #0a1628)",
    border: "1px solid var(--input-border, #1e293b)",
    borderRadius: 4, padding: "4px 7px",
    color: "var(--input-color, #e2e8f0)",
    width: "100%", fontFamily: "inherit", boxSizing: "border-box"
  };
  const sel = { ...inp };

  const applyPreset = key => {
    const p = SOLVENT_PRESETS[key];
    Object.entries(p).forEach(([k, v]) => {
      if (k !== "label") onUpdate(index, k, v);
    });
  };

  const multiDests = step.multiDests || [];

  return (
    <div style={{
      background: "var(--bg-panel, #060e1d)",
      border: `1px solid ${incomplete ? "#450a0a" : "var(--border, #0f172a)"}`,
      borderLeft: `3px solid ${isTx ? (PIPETTE_COLORS[step.pipette] || "#22d3ee") : "#a78bfa"}`,
      borderRadius: 7, overflow: "hidden"
    }}>
      {/* Header */}
      <div onClick={() => { const next = !expanded; setExpanded(next); onExpandedChange?.(next); }}
        style={{ padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 10,
            background: isTx ? `${PIPETTE_COLORS[step.pipette] || "#22d3ee"}18` : "#a78bfa18",
            color: isTx ? (PIPETTE_COLORS[step.pipette] || "#22d3ee") : "#a78bfa",
            padding: "2px 6px", borderRadius: 20, fontWeight: 700, letterSpacing: 0.8, flexShrink: 0
          }}>{isTx ? "XFER" : "MIX"}</span>
          {pip && <span style={{ fontSize: 10, flexShrink: 0 }}>{pip.icon}</span>}
          <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isTx ? (() => {
              const destCount = (step.multiDests?.filter(d => d.slot && d.well).length || 0) + (step.destSlot && step.destWell ? 1 : 0);
              const totalVol = (step.volume || 0) * Math.max(1, destCount);
              const destLabel = destCount > 1
                ? `${destCount} dests · ${totalVol}µL total`
                : `${step.destSlot||"?"}[${step.destWell||"?"}] · ${step.volume||"?"}µL`;
              return `${step.sourceSlot||"?"}[${step.sourceWell||"?"}] → ${destLabel}`;
            })()
              : `${step.mixReps||3}× ${step.volume||"?"}µL in ${step.sourceSlot||"?"}[${step.sourceWell||"?"}]`
            }
          </span>
          {incomplete && <span style={{ fontSize: 10, color: "#ef4444", flexShrink: 0 }}>⚠</span>}
          {volWarn && <span style={{ fontSize: 10, color: "#f59e0b", flexShrink: 0 }} title="Volume exceeds pipette max — will multi-trip">⚡</span>}
        </div>
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {!isFirst && <button onClick={e => { e.stopPropagation(); onMoveUp(index); }} style={btnXs}>↑</button>}
          {!isLast && <button onClick={e => { e.stopPropagation(); onMoveDown(index); }} style={btnXs}>↓</button>}
          <button onClick={e => { e.stopPropagation(); onDuplicate(index); }} style={{ ...btnXs, color: "#06b6d4" }} title="Duplicate step">⎘</button>
          <button onClick={e => { e.stopPropagation(); onRemove(index); }} style={{ ...btnXs, color: "#ef4444" }}>✕</button>
          <span style={{ color: "#475569", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 12px 13px", borderTop: "1px solid var(--border, #0f172a)", paddingTop: 10 }}>

          {/* Source / Dest */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 18px 1fr", gap: 6, alignItems: "start", marginBottom: 8 }}>
            <div>
              <Label>FROM</Label>
              <select value={step.sourceSlot||""} onChange={e => onUpdate(index,"sourceSlot",e.target.value)} style={sel}>
                <option value="">Slot…</option>
                {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => (
                  <option key={l.slot} value={l.slot}>{l.slot}: {l.label || LABWARE_DEFS[l.def]?.shortLabel}</option>
                ))}
              </select>
              {srcDef && <select value={step.sourceWell||""} onChange={e => onUpdate(index,"sourceWell",e.target.value)} style={{ ...sel, marginTop: 3 }}>
                <option value="">Well…</option>
                {srcDef.wells.map(w => <option key={w} value={w}>{w}</option>)}
              </select>}
            </div>
            <div style={{ color: "#22d3ee", fontSize: 14, textAlign: "center", paddingTop: 20 }}>→</div>
            <div>
              {isTx ? (
                <>
                  <Label>TO</Label>
                  <select value={step.destSlot||""} onChange={e => onUpdate(index,"destSlot",e.target.value)} style={sel}>
                    <option value="">Slot…</option>
                    {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => (
                      <option key={l.slot} value={l.slot}>{l.slot}: {l.label || LABWARE_DEFS[l.def]?.shortLabel}</option>
                    ))}
                  </select>
                  {dstDef && <select value={step.destWell||""} onChange={e => onUpdate(index,"destWell",e.target.value)} style={{ ...sel, marginTop: 3 }}>
                    <option value="">Well…</option>
                    {dstDef.wells.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>}
                </>
              ) : <div style={{ fontSize: 11, color: "var(--text-dim,#64748b)", fontStyle: "italic", paddingTop: 20 }}>same well</div>}
            </div>
          </div>

          {/* Multi-destination */}
          {isTx && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <Label>ADDITIONAL DESTINATIONS ({multiDests.length})</Label>
                <button onClick={() => onUpdate(index, "multiDests", [...multiDests, { slot: step.destSlot||"", well: "" }])}
                  style={{ fontSize: 10, background: "#22d3ee15", border: "1px solid #22d3ee33", color: "#22d3ee", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              </div>
              {multiDests.map((md, mi) => {
                const mdDef = labware.find(l => l.slot === md.slot);
                const mdLwDef = mdDef ? LABWARE_DEFS[mdDef.def] : null;
                return (
                  <div key={mi} style={{ display: "flex", gap: 4, marginBottom: 3, alignItems: "center" }}>
                    <select value={md.slot||""} onChange={e => { const nd = [...multiDests]; nd[mi] = { ...nd[mi], slot: e.target.value }; onUpdate(index, "multiDests", nd); }} style={{ ...sel, flex: 1 }}>
                      <option value="">Slot…</option>
                      {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => (
                        <option key={l.slot} value={l.slot}>{l.slot}</option>
                      ))}
                    </select>
                    <select value={md.well||""} onChange={e => { const nd = [...multiDests]; nd[mi] = { ...nd[mi], well: e.target.value }; onUpdate(index, "multiDests", nd); }} style={{ ...sel, flex: 1 }}>
                      <option value="">Well…</option>
                      {(mdLwDef?.wells || []).map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <button onClick={() => onUpdate(index, "multiDests", multiDests.filter((_,j) => j !== mi))}
                      style={{ fontSize: 12, background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0 3px" }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Core params */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 7 }}>
            <div>
              <Label>Pipette</Label>
              <select value={step.pipette||""} onChange={e => onUpdate(index,"pipette",e.target.value)} style={sel}>
                <option value="">Select…</option>
                {Object.entries(PIPETTES).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Volume (µL)</Label>
              <input type="number" value={step.volume||""} onChange={e => onUpdate(index,"volume",parseFloat(e.target.value))} style={inp} placeholder="100" />
              {pip && step.volume > pip.maxVol && <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>⚡ {Math.ceil(step.volume/pip.maxVol)} trips</div>}
            </div>
            {isTx
              ? <div><Label>Air gap (µL)</Label><input type="number" value={step.airGap||""} onChange={e => onUpdate(index,"airGap",parseFloat(e.target.value)||0)} style={inp} placeholder="0" /></div>
              : <div><Label>Reps</Label><input type="number" value={step.mixReps||3} onChange={e => onUpdate(index,"mixReps",parseInt(e.target.value))} style={inp} /></div>
            }
          </div>

          {/* Tip policy */}
          {isTx && (
            <div style={{ marginBottom: 7 }}>
              <Label>TIP POLICY</Label>
              <select value={step.tipPolicy||"new_each"} onChange={e => onUpdate(index,"tipPolicy",e.target.value)} style={sel}>
                {Object.entries(TIP_POLICIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}

          {/* Solvent preset */}
          {isTx && (
            <div style={{ marginBottom: 7 }}>
              <Label>SOLVENT PRESET</Label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.entries(SOLVENT_PRESETS).map(([k, p]) => (
                  <button key={k} onClick={() => applyPreset(k)} style={{
                    background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)",
                    borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                    transition: "all 0.1s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#22d3ee"; e.currentTarget.style.color = "#22d3ee"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--input-border,#1e293b)"; e.currentTarget.style.color = "var(--text-dim,#64748b)"; }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Flow rates */}
          {isTx && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 7 }}>
              <div><Label>Aspirate (µL/s)</Label><input type="number" value={step.aspirateRate||150} onChange={e => onUpdate(index,"aspirateRate",parseFloat(e.target.value))} style={inp} /></div>
              <div><Label>Dispense (µL/s)</Label><input type="number" value={step.dispenseRate||300} onChange={e => onUpdate(index,"dispenseRate",parseFloat(e.target.value))} style={inp} /></div>
              <div><Label>Blowout (µL/s)</Label><input type="number" value={step.blowoutRate||200} onChange={e => onUpdate(index,"blowoutRate",parseFloat(e.target.value))} style={inp} /></div>
            </div>
          )}

          {/* Delays */}
          {isTx && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 7 }}>
              <div><Label>Delay after aspirate (s)</Label><input type="number" step="0.1" value={step.delayAfterAspirate||0} onChange={e => onUpdate(index,"delayAfterAspirate",parseFloat(e.target.value)||0)} style={inp} /></div>
              <div><Label>Delay after dispense (s)</Label><input type="number" step="0.1" value={step.delayAfterDispense||0} onChange={e => onUpdate(index,"delayAfterDispense",parseFloat(e.target.value)||0)} style={inp} /></div>
            </div>
          )}

          {/* Height offsets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 7 }}>
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

          {/* Checkboxes */}
          {isTx && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {[["prewet","Pre-wet"],["touchTip","Touch tip"],["remeasureEachAsp","Re-measure each asp"]].map(([k,l]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#64748b", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!step[k]} onChange={e => onUpdate(index,k,e.target.checked)} style={{ accentColor: "#22d3ee" }} />
                  {l}
                </label>
              ))}
            </div>
          )}

          {/* Copy settings to other steps */}
          {steps && steps.length > 1 && (
            <div style={{ marginTop: 10, borderTop: "1px solid var(--border,#0f172a)", paddingTop: 9 }}>
              {!showCopyPanel ? (
                <button onClick={() => { setShowCopyPanel(true); setCopyTargets(new Set()); }}
                  style={{ fontSize: 10, background: "none", border: "1px solid var(--border,#0f172a)", color: "var(--text-dim,#64748b)", borderRadius: 4, padding: "3px 9px", cursor: "pointer", fontFamily: "inherit" }}>
                  ⊕ Copy settings to other steps…
                </button>
              ) : (
                <div>
                  <div style={{ fontSize: 10, color: "#22d3ee", fontWeight: 700, marginBottom: 6, letterSpacing: 0.8 }}>COPY FLOW RATES + DELAYS + OFFSETS TO:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
                    {steps.map((s, si) => {
                      if (si === index) return null;
                      if (s.type !== step.type) return null;
                      const checked = copyTargets.has(si);
                      return (
                        <label key={si} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: checked ? "#22d3ee" : "var(--text-dim,#64748b)", cursor: "pointer",
                          background: checked ? "#22d3ee15" : "var(--bg-panel,#060e1d)", border: `1px solid ${checked ? "#22d3ee44" : "var(--border,#0f172a)"}`, borderRadius: 4, padding: "3px 7px" }}>
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
                      style={{ fontSize: 10, background: "none", border: "1px solid var(--border,#0f172a)", color: "var(--text-dim,#64748b)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                      Cancel
                    </button>
                    <button
                      disabled={copyTargets.size === 0}
                      onClick={() => {
                        const fields = ["aspirateRate","dispenseRate","blowoutRate","delayAfterAspirate","delayAfterDispense","meniscusOffset","dispenseRef","dispenseTopOffset","blowoutRef","blowoutTopOffset","airGap","prewet","touchTip","remeasureEachAsp"];
                        onCopySettings?.(index, [...copyTargets], fields);
                        setShowCopyPanel(false);
                      }}
                      style={{ fontSize: 10, background: copyTargets.size > 0 ? "#22d3ee18" : "none", border: `1px solid ${copyTargets.size > 0 ? "#22d3ee44" : "var(--border,#0f172a)"}`, color: copyTargets.size > 0 ? "#22d3ee" : "var(--text-dim,#64748b)", borderRadius: 4, padding: "3px 9px", cursor: copyTargets.size > 0 ? "pointer" : "default", fontFamily: "inherit", fontWeight: 700 }}>
                      Apply to {copyTargets.size} step{copyTargets.size !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Well Info Modal ───────────────────────────────────────────────────────────
// Shown when the user clicks a tube/vial well

function WellInfoModal({ slot, well, lw, def, volumeMap, liquids, setLiquids, labware, onClose }) {
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
  const storedVol = existingLiq?.volume || 0;

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
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
            {lw?.label || slot} — <span style={{ color: def?.color || "#06b6d4" }}>{well}</span>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            {wellLabel}{capacity ? ` · ${fmtVol(capacity, def)} capacity` : ""}
            {dead ? ` · ${fmtVol(dead, def)} dead vol` : ""}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px" }}>✕</button>
      </div>

      {/* Volume tracker display */}
      {vm && vm.initial > 0 && (
        <div style={{ background: "#060e1d", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>VOLUME TRACKER</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "#94a3b8" }}>Initial</span>
            <span style={{ color: "#e2e8f0" }}>{fmtVol(vm.initial, def)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
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

      {/* Liquid assignment */}
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
        {existingLiq ? "EDIT LIQUID" : "ASSIGN LIQUID"}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
          style={{ width: 28, height: 28, border: "none", background: "none", cursor: "pointer", borderRadius: 4, flexShrink: 0 }} />
        <input value={editName} onChange={e => setEditName(e.target.value)}
          placeholder="Liquid name (e.g. Hexane, BHA Matrix)"
          style={{ flex: 1, fontSize: 12, background: "#0a1628", border: "1px solid #1e293b", borderRadius: 4, padding: "5px 8px", color: "#f1f5f9", fontFamily: "inherit" }} />
      </div>

      {/* Quick color swatches */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        {QUICK_COLORS.map(c => (
          <div key={c} onClick={() => setEditColor(c)}
            style={{ width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer", border: `2px solid ${editColor === c ? "#fff" : "transparent"}`, transition: "border-color 0.1s" }} />
        ))}
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>INITIAL VOLUME ({unit})</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="number" value={editVol} onChange={e => setEditVol(e.target.value)}
            placeholder={isTube ? "e.g. 10 mL" : "e.g. 500 µL"}
            style={{ flex: 1, fontSize: 12, background: "#0a1628", border: "1px solid #1e293b", borderRadius: 4, padding: "5px 8px", color: "#f1f5f9", fontFamily: "inherit" }} />
          <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{unit}</span>
        </div>
        {isTube && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Enter in mL — pipette steps use µL</div>}
      </div>

      <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
        placeholder="Description (optional)"
        style={{ width: "100%", fontSize: 11, background: "#0a1628", border: "1px solid #1e293b", borderRadius: 4, padding: "4px 8px", color: "#94a3b8", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />

      <div style={{ display: "flex", gap: 6 }}>
        {existingLiq && (
          <button onClick={removeLiquid}
            style={{ background: "#ef444415", border: "1px solid #ef444430", color: "#ef4444", borderRadius: 5, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
            Remove
          </button>
        )}
        <button onClick={onClose}
          style={{ flex: 1, background: "#0a1628", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 5, padding: "6px 0", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={save}
          style={{ flex: 2, background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 5, padding: "6px 0", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
          {existingLiq ? "Save" : "Assign Liquid"}
        </button>
      </div>
    </Modal>
  );
}

// ── Liquid Panel ──────────────────────────────────────────────────────────────

function LiquidPanel({ liquids, setLiquids, labware }) {
  const addLiquid = () => setLiquids(prev => [...prev, {
    id: Date.now(), name: "", description: "", color: "#06b6d4", slot: "", well: "", volume: 0
  }]);
  const update = (id, k, v) => setLiquids(prev => prev.map(l => l.id === id ? { ...l, [k]: v } : l));
  const remove = id => setLiquids(prev => prev.filter(l => l.id !== id));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 1.5 }}>LIQUIDS ({liquids.length})</div>
        <button onClick={addLiquid} style={{ fontSize: 10, background: "#06b6d415", border: "1px solid #06b6d433", color: "#06b6d4", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>+ Liquid</button>
      </div>
      {liquids.length === 0 && (
        <div style={{ textAlign: "center", color: "#64748b", padding: "16px 0", border: "2px dashed #334155", borderRadius: 8, fontSize: 11, lineHeight: 1.7 }}>
          Define liquids for volume tracking<br />
          <span style={{ fontSize: 10, color: "#475569" }}>Tip: click any tube/vial on the deck</span>
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
                style={{ flex: 1, fontSize: 12, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 4, padding: "3px 7px", color: "var(--input-color,#f1f5f9)", fontFamily: "inherit" }} />
              <button onClick={() => remove(liq.id)} style={{ fontSize: 12, background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
            </div>
            <input value={liq.description||""} onChange={e => update(liq.id,"description",e.target.value)}
              placeholder="Description (optional)"
              style={{ width: "100%", fontSize: 11, background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 7px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 5 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              <select value={liq.slot||""} onChange={e => update(liq.id,"slot",e.target.value)}
                style={{ fontSize: 11, background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 6px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit" }}>
                <option value="">Slot…</option>
                {labware.filter(l => !l.def.includes("tiprack") && l.slot !== "A3").map(l => <option key={l.slot} value={l.slot}>{l.slot}: {l.label || LABWARE_DEFS[l.def]?.shortLabel}</option>)}
              </select>
              <select value={liq.well||""} onChange={e => update(liq.id,"well",e.target.value)}
                style={{ fontSize: 11, background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 6px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit" }}>
                <option value="">Well…</option>
                {(slotDef?.wells || []).map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <input type="number" value={displayVol||""} onChange={e => {
                  const raw = parseFloat(e.target.value)||0;
                  update(liq.id,"volume", isTube ? raw * 1000 : raw);
                }}
                  placeholder="Vol"
                  style={{ fontSize: 11, background: "var(--input-bg,#0a1628)", border: "1px solid var(--border,#0f172a)", borderRadius: 4, padding: "3px 4px", color: "var(--text-dim,#94a3b8)", fontFamily: "inherit", width: "100%", minWidth: 0 }} />
                <span style={{ fontSize: 9, color: "#64748b", flexShrink: 0 }}>{unit}</span>
              </div>
            </div>
            {isTube && <div style={{ fontSize: 9, color: "#475569", marginTop: 3 }}>Volume in mL — stored as µL for protocol</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Label({ children }) {
  return <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", marginBottom: 3, letterSpacing: 0.8, textTransform: "uppercase" }}>{children}</div>;
}

const btnXs = {
  background: "none", border: "none", cursor: "pointer", fontSize: 13,
  padding: "1px 3px", fontFamily: "inherit", color: "#475569"
};

function StatBox({ icon, label, value, color }) {
  return (
    <div style={{ background: "var(--bg-panel,#060e1d)", borderRadius: 5, padding: "7px 9px", border: "1px solid var(--border,#0f172a)", marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: 12 }}>{icon} <span style={{ fontSize: 10, color: "#475569" }}>{label}</span></div>
      <div style={{ fontSize: 18, color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Modal({ children, wide = false }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{
        background: "var(--modal-bg, #06101e)", border: "1px solid var(--modal-border, #1e293b)", borderRadius: 10, padding: 20,
        width: wide ? 520 : 340, fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "var(--input-color,#e2e8f0)",
        maxHeight: "80vh", overflowY: "auto"
      }}>
        {children}
      </div>
    </div>
  );
}

function ConnectionModal({ conn, labware, onConfirm, onAddToStep, onCancel }) {
  const [vol, setVol] = useState(100);
  const [pipette, setPipette] = useState("flex_1channel_1000");
  const [preset, setPreset] = useState("");
  // "new" | step index (number) — which action the user has chosen
  const [mode, setMode] = useState(conn.existingSourceSteps?.length > 0 ? "choose" : "new");
  const srcLw = labware.find(l => l.slot === conn.srcSlot);
  const dstLw = labware.find(l => l.slot === conn.dstSlot);
  const existing = conn.existingSourceSteps || [];

  const routeLabel = (
    <span style={{ fontSize: 11, color: "var(--text-dim,#64748b)" }}>
      <span style={{ color: "#22d3ee" }}>{srcLw?.label || conn.srcSlot}[{conn.srcWell}]</span>
      {" → "}
      <span style={{ color: "#a78bfa" }}>{dstLw?.label || conn.dstSlot}[{conn.dstWell}]</span>
    </span>
  );

  // Mode = choose: show existing steps + "new step" option
  if (mode === "choose") {
    return (
      <Modal>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Wire {routeLabel}</div>
        <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", marginBottom: 10 }}>
          This source well already has {existing.length} step{existing.length !== 1 ? "s" : ""}. Add as a destination or create a new step.
        </div>
        {existing.map(({ s, i }) => {
          const destCount = (s.multiDests?.filter(d => d.slot && d.well).length || 0) + (s.destSlot && s.destWell ? 1 : 0);
          return (
            <div key={i} onClick={() => onAddToStep(i, conn.dstSlot, conn.dstWell)}
              style={{ background: "var(--bg-panel,#060e1d)", border: "1px solid #22d3ee33", borderLeft: "3px solid #22d3ee", borderRadius: 7, padding: "9px 12px", marginBottom: 6, cursor: "pointer", transition: "border-color 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#22d3ee88"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#22d3ee33"}>
              <div style={{ fontSize: 11, color: "#22d3ee", fontWeight: 700, marginBottom: 2 }}>
                ➕ Add to Step {i + 1}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)" }}>
                {PIPETTES[s.pipette]?.label || "?"} · {s.volume}µL · {destCount} dest{destCount !== 1 ? "s" : ""} currently
              </div>
            </div>
          );
        })}
        <div onClick={() => setMode("new")}
          style={{ background: "var(--bg-panel,#060e1d)", border: "1px solid var(--border,#1e293b)", borderLeft: "3px solid #6366f1", borderRadius: 7, padding: "9px 12px", marginBottom: 10, cursor: "pointer", transition: "border-color 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#6366f1"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border,#1e293b)"}>
          <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700 }}>🆕 Create new transfer step</div>
        </div>
        <button onClick={onCancel} style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>Cancel</button>
      </Modal>
    );
  }

  return (
    <Modal>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {existing.length > 0 && (
          <button onClick={() => setMode("choose")} style={{ background: "none", border: "none", color: "var(--text-dim,#64748b)", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>←</button>
        )}
        <div style={{ fontSize: 13, fontWeight: 700 }}>New Transfer</div>
      </div>
      <div style={{ fontSize: 11, marginBottom: 12 }}>{routeLabel}</div>
      <div style={{ marginBottom: 8 }}>
        <Label>VOLUME (µL)</Label>
        <input type="number" value={vol} onChange={e => setVol(parseFloat(e.target.value))}
          style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 5, padding: "6px 8px", color: "var(--input-color,#e2e8f0)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <Label>PIPETTE</Label>
        <select value={pipette} onChange={e => setPipette(e.target.value)}
          style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 5, padding: "6px 8px", color: "var(--input-color,#e2e8f0)", fontSize: 12, fontFamily: "inherit" }}>
          {Object.entries(PIPETTES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>SOLVENT PRESET</Label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[["", "None"], ...Object.entries(SOLVENT_PRESETS).map(([k, p]) => [k, p.label])].map(([k, l]) => (
            <button key={k} onClick={() => setPreset(k)}
              style={{ background: preset === k ? "#22d3ee" : "var(--input-bg,#0a1628)", color: preset === k ? "#020817" : "var(--text-dim,#64748b)", border: `1px solid ${preset === k ? "#22d3ee" : "var(--input-border,#1e293b)"}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        <button onClick={onCancel} style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>Cancel</button>
        <button onClick={() => onConfirm(vol, pipette, preset || null)} style={{ flex: 2, background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>Add Transfer</button>
      </div>
    </Modal>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem("ot-builder-theme") || "dark"; } catch { return "dark"; }
  });
  const theme = THEMES[themeName] || THEMES.dark;
  const toggleTheme = () => {
    const next = themeName === "dark" ? "light" : "dark";
    setThemeName(next);
    try { localStorage.setItem("ot-builder-theme", next); } catch {}
  };

  const [labware, setLabware] = useState([{ slot: "A3", def: "_trash", label: "Trash", id: "trash" }]);
  const [steps, setSteps] = useState([]);
  const [liquids, setLiquids] = useState([]);
  const [activeTab, setActiveTab] = useState("build");
  const [sidePanel, setSidePanel] = useState("steps");
  const [protocolName, setProtocolName] = useState("My Custom Protocol");
  const [author, setAuthor] = useState("Lab User");
  const [description, setDescription] = useState("");
  const [liquidSensing, setLiquidSensing] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingLabel, setEditingLabel] = useState(null); // { slot, value }
  const [draggingFrom, setDraggingFrom] = useState(null);
  const [hoveredWell, setHoveredWell] = useState(null);
  const [showConnectionModal, setShowConnectionModal] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState("");
  const [pendingRemoveSlot, setPendingRemoveSlot] = useState(null);
  const [pendingRemoveStep, setPendingRemoveStep] = useState(null); // index
  const [showNewModal, setShowNewModal] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null); // index of auto-expanded step
  const [wellInfoModal, setWellInfoModal] = useState(null); // { slot, well }
  const fileInputRef = useRef(null);
  const stepEditTimerRef = useRef(null);

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  const [history, setHistory] = useState([]);
  const [future,  setFuture]  = useState([]);

  const snapshot = useCallback(() => ({
    labware, steps, liquids,
    protocolName, author, description, liquidSensing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [labware, steps, liquids, protocolName, author, description, liquidSensing]);

  const restoreSnapshot = useCallback(s => {
    setLabware(s.labware);
    setSteps(s.steps);
    setLiquids(s.liquids);
    if (s.protocolName !== undefined) setProtocolName(s.protocolName);
    if (s.author !== undefined) setAuthor(s.author);
    if (s.description !== undefined) setDescription(s.description);
    if (s.liquidSensing !== undefined) setLiquidSensing(s.liquidSensing);
  }, []);

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-29), snapshot()]);
    setFuture([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture(f => [snapshot(), ...f]);
      restoreSnapshot(prev);
      return h.slice(0, -1);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, restoreSnapshot]);

  const redo = useCallback(() => {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[0];
      setHistory(h => [...h, snapshot()]);
      restoreSnapshot(next);
      return f.slice(1);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, restoreSnapshot]);

  useEffect(() => {
    const handler = e => {
      // Ignore shortcuts when user is typing in an input/textarea/select
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
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);


  // ── Core mutations ───────────────────────────────────────────────────────────

  const handleSlotDrop = (slot, e) => {
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
        // Moving existing labware from one slot to another
        if (data.fromSlot === slot) return; // no-op same slot
        pushHistory();
        // Update all step references from old slot to new slot
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
          if (displaced) base = [...base, { ...displaced, slot: data.fromSlot }]; // swap
          return [...base, moved];
        });
        if (selectedSlot === data.fromSlot) setSelectedSlot(slot);
      }
    } catch {}
  };

  const handleConnectionDrop = (dstSlot, dstWell) => {
    if (!draggingFrom) return;
    const { slot: srcSlot, well: srcWell } = draggingFrom;
    if (srcSlot === dstSlot && srcWell === dstWell) { setDraggingFrom(null); return; }
    // Find existing transfer steps from this exact source well
    const existingSourceSteps = steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.type === "transfer" && s.sourceSlot === srcSlot && s.sourceWell === srcWell);
    setShowConnectionModal({ srcSlot, srcWell, dstSlot, dstWell, existingSourceSteps });
    setDraggingFrom(null);
    setHoveredWell(null);
  };

  const confirmConnection = (vol, pipette, preset) => {
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
    }]);
    setShowConnectionModal(null);
    setSidePanel("steps");
    setSteps(prev => { setExpandedStep(prev.length - 1); return prev; });
  };

  const handleAddToStep = (stepIdx, dstSlot, dstWell) => {
    pushHistory();
    setSteps(prev => prev.map((s, i) => {
      if (i !== stepIdx) return s;
      // Append as multiDest (don't clobber primary dest if set)
      const newDest = { slot: dstSlot, well: dstWell };
      const multiDests = [...(s.multiDests || []), newDest];
      return { ...s, multiDests };
    }));
    setShowConnectionModal(null);
    setSidePanel("steps");
    setExpandedStep(stepIdx);
  };

  const addStep = type => {
    pushHistory();
    setSteps(prev => {
      const newSteps = [...prev, {
        type, volume: type === "transfer" ? 100 : 50,
        sourceSlot: "", sourceWell: "A1",
        destSlot: "", destWell: "A1",
        multiDests: [],
        pipette: "", tipPolicy: "new_each",
        prewet: false, touchTip: false, remeasureEachAsp: false,
        airGap: 0, mixReps: 3,
        aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
        delayAfterAspirate: 0, delayAfterDispense: 0,
        meniscusOffset: -5,
        dispenseRef: "top", dispenseTopOffset: -2,
        blowoutRef: "top", blowoutTopOffset: -2,
      }];
      setExpandedStep(newSteps.length - 1);
      return newSteps;
    });
    setSidePanel("steps");
  };

  const updateStep = (i, k, v) => {
    // Push history on first edit of a step, debounced — groups rapid field changes into one undo point
    if (stepEditTimerRef.current) clearTimeout(stepEditTimerRef.current);
    stepEditTimerRef.current = setTimeout(() => {
      pushHistory();
      stepEditTimerRef.current = null;
    }, 600);
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  };
  const removeStep = i => {
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
  };
  const duplicateStep = i => { pushHistory(); setSteps(prev => [...prev.slice(0, i + 1), { ...prev[i] }, ...prev.slice(i + 1)]); };
  const moveStep = (i, dir) => {
    pushHistory();
    setSteps(prev => {
      const a = [...prev]; const j = i + dir;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]]; return a;
    });
  };
  const stepsReferencingSlot = slot =>
    steps.filter(s =>
      s.sourceSlot === slot ||
      s.destSlot === slot ||
      (s.multiDests || []).some(d => d.slot === slot)
    );

  const executeRemoveLabware = slot => {
    pushHistory();
    setLabware(prev => prev.filter(l => l.slot !== slot));
    setSteps(prev => prev
      .map(s => {
        const cleanedMultiDests = (s.multiDests || []).filter(d => d.slot !== slot);
        if (s.sourceSlot === slot) return null;
        const newDestSlot = s.destSlot === slot ? "" : s.destSlot;
        const newDestWell  = s.destSlot === slot ? "" : s.destWell;
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
  };

  const removeLabware = slot => {
    const affected = stepsReferencingSlot(slot);
    if (affected.length > 0) {
      setPendingRemoveSlot(slot);
    } else {
      executeRemoveLabware(slot);
    }
  };

  // ── Inline label editing (click the label on the slot card) ─────────────────

  const startLabelEdit = (slot, currentLabel) => {
    setEditingLabel({ slot, value: currentLabel });
  };

  const commitLabel = () => {
    if (!editingLabel) return;
    setLabware(prev => prev.map(l => l.slot === editingLabel.slot ? { ...l, label: editingLabel.value } : l));
    setEditingLabel(null);
  };

  // ── Save / Load ──────────────────────────────────────────────────────────────

  const saveJSON = () => {
    const state = { labware, steps, liquids, protocolName, author, description, liquidSensing };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    a.download = `${protocolName.replace(/\s+/g, "_")}.json`;
    a.click();
  };

  const loadState = state => {
    pushHistory();
    if (state.labware)      setLabware(state.labware);
    if (state.steps)        setSteps(state.steps);
    if (state.liquids)      setLiquids(state.liquids);
    if (state.protocolName) setProtocolName(state.protocolName);
    if (state.author)       setAuthor(state.author);
    if (state.description !== undefined) setDescription(state.description);
    if (state.liquidSensing !== undefined) setLiquidSensing(state.liquidSensing);
  };

  const handleImportFile = e => {
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
          setImportError("Unsupported file type. Use .json, .py (Opentrons protocol), or .csv (transfer list).");
        }
      } catch (err) {
        setImportError(`Parse error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Templates ────────────────────────────────────────────────────────────────

  const applyTemplate = key => {
    const t = TEMPLATES[key];
    if (!t) return;
    loadState({
      labware: t.labware,
      steps: t.steps,
      liquids: t.liquids,
      protocolName: t.name,
      description: t.description,
      liquidSensing: t.liquidSensing,
    });
    setShowTemplateModal(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const code = generateCode({ labware, steps, liquids, protocolName, author, description, liquidSensing });
  const validation = runValidation({ labware, steps });
  const volumeMap = computeVolumeMap(labware, steps, liquids);
  const runTimeSecs = estimateRunTime(steps);
  const runTimeLabel = formatDuration(runTimeSecs);

  // Build slot:well -> liquid color+name map for well fill indicators
  const liquidsBySlot = {};
  liquids.forEach(liq => {
    if (!liq.slot || !liq.well) return;
    liquidsBySlot[`${liq.slot}:${liq.well}`] = { color: liq.color, name: liq.name };
  });

  // Volume warnings derived from volumeMap
  const volWarnings = [];
  Object.entries(volumeMap).forEach(([key, v]) => {
    const [slot, well] = key.split(":");
    const lw = labware.find(l => l.slot === slot);
    const def = lw ? LABWARE_DEFS[lw.def] : null;
    if (v.remaining < 0) volWarnings.push(`${key}: insufficient (deficit ${fmtVol(Math.abs(v.remaining), def)})`);
    if (v.capacity && v.remaining > v.capacity) volWarnings.push(`${key}: overfill risk (${fmtVol(v.remaining, def)} > ${fmtVol(v.capacity, def)})`);
    if (v.deadVol && v.remaining > 0 && v.remaining < v.deadVol) volWarnings.push(`${key}: below dead volume (${fmtVol(v.remaining, def)} remaining)`);
  });

  const tipCount = steps.reduce((acc, s) => {
    if (!s.pipette) return acc;
    if (s.type === "mix") return acc + 1; // mix always uses 1 tip
    const primaryDest = (s.destSlot && s.destWell) ? 1 : 0;
    const multiDestsCount = s.multiDests?.filter(d => d.slot && d.well).length || 0;
    const totalDests = primaryDest + multiDestsCount;
    return acc + (s.tipPolicy === "new_each" ? Math.max(1, totalDests) : 1);
  }, 0);

  const copyCode = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const downloadCode = () => {
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    a.download = `${protocolName.replace(/\s+/g, "_")}_${ts}.py`;
    a.click();
  };

  const selectedLw = labware.find(l => l.slot === selectedSlot);
  const selectedDef = selectedLw ? LABWARE_DEFS[selectedLw.def] : null;

  const inp = (extra = {}) => ({
    background: "var(--input-bg,#060e1d)", border: "1px solid var(--border,#0f172a)", borderRadius: 5,
    padding: "5px 8px", color: "var(--input-color,#e2e8f0)", fontSize: 12,
    fontFamily: "inherit", boxSizing: "border-box", width: "100%", ...extra
  });

  const SIDE_TABS = [
    { id: "summary",  label: "📊", title: "Summary" },
    { id: "steps",    label: "⚡", title: `Steps (${steps.length})` },
    { id: "settings", label: "⚙️",  title: "Settings" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "'IBM Plex Mono','Courier New',monospace", color: theme.text, display: "flex", flexDirection: "column",
      "--modal-bg": theme.bgCard, "--modal-border": theme.borderMid,
      "--input-bg": theme.bgInput, "--input-border": theme.border,
      "--input-color": theme.text, "--text-dim": theme.textDim,
      "--text-mid": theme.textMid, "--bg-panel": theme.bgPanel,
      "--border": theme.border, "--border-mid": theme.borderMid,
    }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #0f172a", padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.bgHeader, flexShrink: 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#06b6d4,#6366f1)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚗</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.8, color: "#f1f5f9" }}>OPENTRONS FLEX</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {editingLabel?.slot === "__protocol_name" ? (
                <input
                  autoFocus
                  value={editingLabel.value}
                  onChange={e => setEditingLabel(el => ({ ...el, value: e.target.value }))}
                  onBlur={() => { setProtocolName(editingLabel.value || protocolName); setEditingLabel(null); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { if (e.key === "Enter") setProtocolName(editingLabel.value || protocolName); setEditingLabel(null); } }}
                  style={{ fontSize: 9, background: "transparent", border: "none", borderBottom: "1px solid #22d3ee", color: "#94a3b8", fontFamily: "inherit", letterSpacing: 2, outline: "none", width: 160, padding: "0 2px" }}
                />
              ) : (
                <div
                  onClick={() => setEditingLabel({ slot: "__protocol_name", value: protocolName })}
                  title="Click to rename protocol"
                  style={{ fontSize: 9, color: "var(--text-dim,#64748b)", letterSpacing: 2, cursor: "text", padding: "1px 3px", borderRadius: 2, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#64748b"}
                  onMouseLeave={e => e.currentTarget.style.color = "#334155"}
                >
                  {protocolName.toUpperCase()} ✏
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>

          {/* Undo / Redo */}
          <button onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)"
            style={{ ...btnXs, fontSize: 14, padding: "2px 7px", border: "1px solid #0f172a", borderRadius: 4, color: "#94a3b8", opacity: history.length ? 1 : 0.3 }}>↩</button>
          <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)"
            style={{ ...btnXs, fontSize: 14, padding: "2px 7px", border: "1px solid #0f172a", borderRadius: 4, color: "#94a3b8", opacity: future.length ? 1 : 0.3 }}>↪</button>

          <div style={{ width: 1, height: 18, background: "#0f172a", margin: "0 2px" }} />

          {/* Import / Save / New */}
          <button onClick={() => setShowNewModal(true)}
            style={{ padding: "4px 9px", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: "#475569", border: "1px solid #0f172a" }}>
            🗋 New
          </button>
          <button onClick={() => { setImportError(""); setShowImportModal(true); }}
            style={{ padding: "4px 9px", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: "#475569", border: "1px solid #0f172a" }}>
            📂 Import
          </button>
          <button onClick={saveJSON}
            style={{ padding: "4px 9px", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: "#475569", border: "1px solid #0f172a" }}>
            💾 Save
          </button>
          <button onClick={() => setShowTemplateModal(true)}
            style={{ padding: "4px 9px", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "#6366f115", color: "#818cf8", border: "1px solid #6366f130" }}>
            📋 Templates
          </button>

          <div style={{ width: 1, height: 18, background: "#0f172a", margin: "0 2px" }} />

          {/* LLD toggle */}
          <button onClick={() => setLiquidSensing(v => !v)}
            style={{ padding: "4px 9px", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: liquidSensing ? "#06b6d415" : "transparent", color: liquidSensing ? "#06b6d4" : "#334155", border: `1px solid ${liquidSensing ? "#06b6d444" : "#0f172a"}` }}>
            {liquidSensing ? "💧 LLD ON" : "💧 LLD OFF"}
          </button>

          {/* Theme toggle */}
          <button onClick={toggleTheme} title={`Switch to ${theme.iconLabel} mode`}
            style={{ padding: "4px 9px", fontSize: 10, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", borderRadius: 5, background: "transparent", color: theme.textDim, border: `1px solid ${theme.border}` }}>
            {theme.icon} {theme.iconLabel}
          </button>

          {/* Build / Code tabs */}
          {["build", "code"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "4px 12px", background: activeTab === tab ? "#06b6d4" : "transparent",
              color: activeTab === tab ? "#020817" : "#475569",
              border: `1px solid ${activeTab === tab ? "#06b6d4" : "#0f172a"}`,
              borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700
            }}>
              {tab === "build" ? "🔧 BUILD" : "‹/› CODE"}
              {tab === "code" && validation.errors.length > 0 && (
                <span style={{ marginLeft: 4, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "0 4px", fontSize: 10 }}>
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
          <div style={{ width: 200, borderRight: `1px solid ${theme.border}`, padding: "12px 10px", overflowY: "auto", background: theme.bgPanel, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>DRAG TO DECK</div>
            {Object.entries(LABWARE_DEFS).map(([key, def]) => (
              <div key={key} draggable
                onDragStart={e => e.dataTransfer.setData("text/plain", JSON.stringify({ type: "labware", def: key }))}
                style={{ padding: "8px 10px", background: `${def.color}12`, border: `1px solid ${def.color}28`, borderRadius: 6, cursor: "grab", display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 11, color: "var(--input-color,#cbd5e1)", transition: "background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = `${def.color}28`}
                onMouseLeave={e => e.currentTarget.style.background = `${def.color}12`}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{def.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{def.shortLabel || def.label}</div>
                  {def.paletteDesc && <div style={{ fontSize: 9, color: `${def.color}77`, lineHeight: 1.3, marginTop: 1 }}>{def.paletteDesc}</div>}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, fontSize: 9, color: "#475569", lineHeight: 1.8, borderTop: "1px solid #334155", paddingTop: 9 }}>
              <div style={{ color: "#475569", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>HOW TO USE</div>
              1. Drag labware to deck<br />
              2. Click label ✏ to rename<br />
              3. Drag well→well to transfer<br />
              4. Edit steps in sidebar<br />
              5. T = new transfer · M = mix<br />
              6. Ctrl+Z to undo
            </div>
          </div>

          {/* ── Center: Deck ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1.2, display: "flex", alignItems: "center", gap: 10 }}>
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
                if (lw && lw.def !== "_trash" && !lw.def.includes("tiprack")) {
                  setWellInfoModal({ slot, well });
                }
              }}
            />

            {/* Selected labware info bar */}
            {selectedLw && selectedDef && (
              <div style={{ background: `${selectedDef.color}0a`, border: `1px solid ${selectedDef.color}22`, borderRadius: 7, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: selectedDef.color, fontWeight: 700 }}>{selectedLw.slot}: {selectedDef.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", marginTop: 1 }}>
                    {selectedDef.wells.length} wells · {selectedDef.wells.slice(0, 12).join(", ")}{selectedDef.wells.length > 12 ? "…" : ""}
                  </div>
                </div>
                <button onClick={() => removeLabware(selectedSlot)}
                  style={{ background: "#ef444413", border: "1px solid #ef444430", color: "#ef4444", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                  Remove{stepsReferencingSlot(selectedSlot).length > 0
                    ? ` (${stepsReferencingSlot(selectedSlot).length} step${stepsReferencingSlot(selectedSlot).length !== 1 ? "s" : ""})`
                    : ""}
                </button>
              </div>
            )}

            {/* Quick add buttons */}
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => addStep("transfer")}
                style={{ background: "#22d3ee12", border: "1px solid #22d3ee30", color: "#22d3ee", borderRadius: 5, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
                + Transfer
              </button>
              <button onClick={() => addStep("mix")}
                style={{ background: "#a78bfa12", border: "1px solid #a78bfa30", color: "#a78bfa", borderRadius: 5, padding: "5px 14px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
                + Mix
              </button>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div style={{ width: 330, borderLeft: `1px solid ${theme.border}`, background: theme.bgPanel, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
              {SIDE_TABS.map(t => (
                <button key={t.id} onClick={() => setSidePanel(t.id)} style={{
                  flex: 1, padding: "11px 4px", fontSize: 11, fontFamily: "inherit", fontWeight: 700,
                  letterSpacing: 0.5, cursor: "pointer", border: "none",
                  borderBottom: `2px solid ${sidePanel === t.id ? "#06b6d4" : "transparent"}`,
                  background: sidePanel === t.id ? "#06b6d408" : "transparent",
                  color: sidePanel === t.id ? "#06b6d4" : "#334155",
                  transition: "all 0.1s"
                }} title={t.title}>
                  {t.label}
                  <div style={{ fontSize: 9, marginTop: 2, letterSpacing: 0.8 }}>{t.title}</div>
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>

              {/* ── SUMMARY ── */}
              {sidePanel === "summary" && (
                <div>
                  <StatBox icon="🧪" label="Labware" value={labware.filter(l => l.def !== "_trash" && l.slot !== "A3").length} color="#22d3ee" />
                  <StatBox icon="⚡" label="Steps"   value={steps.length}   color="#a78bfa" />
                  <StatBox icon="💧" label="Liquids"  value={liquids.length} color="#06b6d4" />
                  <StatBox icon="💡" label="Tips est." value={tipCount}       color="#f59e0b" />
                  <StatBox icon="⏱" label="Run est." value={runTimeLabel}   color="#34d399" />
                  {volWarnings.length > 0 && (
                    <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>VOLUME WARNINGS</div>
                      {volWarnings.map((w, i) => (
                        <div key={i} style={{ fontSize: 10, color: "#f59e0b", marginBottom: 2 }}>⚠ {w}</div>
                      ))}
                    </div>
                  )}

                  {/* Validation */}
                  <div style={{ background: "var(--bg-panel,#060e1d)", borderRadius: 6, padding: "9px 10px", border: "1px solid var(--border,#0f172a)", marginTop: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "var(--text-dim,#64748b)", marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>VALIDATION</div>
                    {validation.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 10, color: "#ef4444", marginBottom: 3 }}>✗ {e}</div>
                    ))}
                    {validation.warnings.map((w, i) => (
                      <div key={i} style={{ fontSize: 10, color: "#f59e0b", marginBottom: 3 }}>⚠ {w}</div>
                    ))}
                    {validation.ok.map((o, i) => (
                      <div key={i} style={{ fontSize: 10, color: "#22c55e", marginBottom: 3 }}>✓ {o}</div>
                    ))}
                  </div>

                  {/* On deck */}
                  <div style={{ background: "var(--bg-panel,#060e1d)", borderRadius: 6, padding: "9px 10px", border: "1px solid var(--border,#0f172a)", marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "var(--text-dim,#64748b)", marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>ON DECK</div>
                    {labware.filter(l => l.def !== "_trash" && l.slot !== "A3").length === 0
                      ? <div style={{ fontSize: 10, color: "#475569" }}>No labware placed</div>
                      : labware.filter(l => l.def !== "_trash" && l.slot !== "A3").map(l => {
                          const d = LABWARE_DEFS[l.def];
                          return d ? (
                            <div key={l.slot} style={{ fontSize: 11, color: "#475569", marginBottom: 4, display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ color: d.color, fontWeight: 700, minWidth: 24 }}>{l.slot}</span>
                              <span style={{ fontSize: 10, color: "var(--text-dim,#64748b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {l.label || d.shortLabel}
                              </span>
                            </div>
                          ) : null;
                        })
                    }
                  </div>

                  <button onClick={() => setActiveTab("code")}
                    style={{ width: "100%", background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", borderRadius: 6, padding: "9px 0", color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1 }}>
                    GENERATE CODE →
                  </button>
                </div>
              )}

              {/* ── STEPS ── */}
              {sidePanel === "steps" && (
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", letterSpacing: 1.5, marginBottom: 10 }}>STEPS ({steps.length})</div>
                  {steps.length === 0
                    ? <div style={{ textAlign: "center", color: "#475569", padding: "28px 0", border: "2px dashed #334155", borderRadius: 8, fontSize: 11 }}>
                        Drag well→well on the deck,<br />or use + Transfer / + Mix below
                      </div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {steps.map((step, i) => (
                          <StepCard key={i} step={step} index={i} labware={labware}
                            onRemove={removeStep}
                            onUpdate={updateStep}
                            onDuplicate={duplicateStep}
                            onMoveUp={i => moveStep(i, -1)}
                            onMoveDown={i => moveStep(i, 1)}
                            isFirst={i === 0}
                            isLast={i === steps.length - 1}
                            autoExpand={expandedStep === i}
                            onExpandedChange={open => { if (open) setExpandedStep(i); else if (expandedStep === i) setExpandedStep(null); }}
                            steps={steps}
                            onCopySettings={(srcIdx, targetIdxs, fields) => {
                              pushHistory();
                              setSteps(prev => prev.map((s, si) => {
                                if (!targetIdxs.includes(si)) return s;
                                const patch = {};
                                fields.forEach(f => { patch[f] = prev[srcIdx][f]; });
                                return { ...s, ...patch };
                              }));
                            }}
                          />
                        ))}
                      </div>
                  }
                </div>
              )}

              {/* ── SETTINGS ── */}
              {sidePanel === "settings" && (
                <div>
                  {/* Metadata */}
                  <div style={{ fontSize: 10, color: "#22d3ee", letterSpacing: 1, marginBottom: 7, fontWeight: 700, paddingBottom: 4, borderBottom: "1px solid var(--border,#0f172a)" }}>METADATA</div>
                  <Label>Protocol Name</Label>
                  <input value={protocolName} onChange={e => setProtocolName(e.target.value)} style={{ ...inp(), marginBottom: 7 }} />
                  <Label>Author</Label>
                  <input value={author} onChange={e => setAuthor(e.target.value)} style={{ ...inp(), marginBottom: 7 }} />
                  <Label>Description</Label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                    placeholder="Optional protocol description…"
                    style={{ ...inp(), resize: "vertical", color: description ? "#e2e8f0" : "#334155", marginBottom: 16 }} />

                  {/* Liquid sensing */}
                  <div style={{ fontSize: 10, color: "#22d3ee", letterSpacing: 1, marginBottom: 7, fontWeight: 700, paddingBottom: 4, borderBottom: "1px solid var(--border,#0f172a)" }}>LIQUID LEVEL DETECTION</div>
                  <div style={{ background: "var(--bg-panel,#060e1d)", border: `1px solid ${liquidSensing ? "#06b6d444" : "var(--border,#0f172a)"}`, borderRadius: 7, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: liquidSensing ? "#06b6d4" : "#475569", fontWeight: 700 }}>Liquid Presence Detection</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", marginTop: 2, lineHeight: 1.5 }}>
                        Enables measure_liquid_height()<br />and well.meniscus() tracking
                      </div>
                    </div>
                    <div onClick={() => setLiquidSensing(v => !v)} style={{
                      width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                      background: liquidSensing ? "#06b6d4" : "var(--border,#0f172a)",
                      border: `1px solid ${liquidSensing ? "#06b6d4" : "var(--input-border,#1e293b)"}`,
                      position: "relative", transition: "background 0.2s", flexShrink: 0
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%", background: "#fff",
                        position: "absolute", top: 2, left: liquidSensing ? 19 : 2,
                        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
                      }} />
                    </div>
                  </div>
                  {liquidSensing ? (
                    <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", background: "var(--bg-panel,#060e1d)", border: "1px solid var(--border,#0f172a)", borderRadius: 5, padding: "7px 10px", lineHeight: 1.7, marginBottom: 16 }}>
                      <span style={{ color: "#06b6d4" }}>✓</span> liquid_presence_detection=True on all pipettes<br />
                      <span style={{ color: "#06b6d4" }}>✓</span> measure_liquid_height() before each aspirate<br />
                      <span style={{ color: "#06b6d4" }}>✓</span> well.meniscus(z=offset) for aspirate position
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", background: "var(--bg-panel,#060e1d)", border: "1px solid var(--border,#0f172a)", borderRadius: 5, padding: "7px 10px", lineHeight: 1.7, marginBottom: 16 }}>
                      <span style={{ color: "#475569" }}>–</span> liquid_presence_detection=False<br />
                      <span style={{ color: "#475569" }}>–</span> Aspirate from well.bottom(5) by default<br />
                      <span style={{ color: "#475569" }}>–</span> No height tracking
                    </div>
                  )}

                  {/* Liquid definitions — use shared LiquidPanel */}
                  <div style={{ fontSize: 10, color: "#22d3ee", letterSpacing: 1, marginBottom: 7, fontWeight: 700, paddingBottom: 4, borderBottom: "1px solid var(--border,#0f172a)" }}>LIQUID DEFINITIONS</div>
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
              <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", letterSpacing: 1.5 }}>GENERATED PYTHON — Opentrons Flex API 2.23</div>
              {validation.errors.length > 0 && (
                <span style={{ fontSize: 10, background: "#ef444418", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 4, padding: "2px 7px" }}>
                  {validation.errors.length} error{validation.errors.length !== 1 ? "s" : ""}
                </span>
              )}
              {validation.warnings.length > 0 && (
                <span style={{ fontSize: 10, background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b30", borderRadius: 4, padding: "2px 7px" }}>
                  {validation.warnings.length} warning{validation.warnings.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={copyCode}
                style={{ background: copied ? "#22c55e18" : "#060e1d", border: `1px solid ${copied ? "#22c55e" : "#0f172a"}`, color: copied ? "#22c55e" : "#475569", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
                {copied ? "✓ Copied!" : "Copy"}
              </button>
              <button onClick={downloadCode}
                style={{ background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
                ↓ Download .py
              </button>
              <button onClick={saveJSON}
                style={{ background: "var(--input-bg,#060e1d)", border: "1px solid var(--border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
                ↓ Export .json
              </button>
            </div>
          </div>
          <pre style={{ flex: 1, background: theme.bgDeck, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 18, overflowY: "auto", fontSize: 13, lineHeight: 1.9, color: theme.text, margin: 0, whiteSpace: "pre-wrap" }}>
            {code.split("\n").map((line, i) => {
              let c = "#94a3b8";
              const t = line.trimStart();
              if (t.startsWith("#")) c = "#4a6741";
              else if (/^(from|import)\s/.test(t)) c = "#b48ead";
              else if (/^def\s/.test(t)) c = "#d08770";
              else if (/protocol\.comment/.test(line)) c = "#5e8c6a";
              else if (/=\s*protocol\.load/.test(line) || /protocol\.define_liquid/.test(line)) c = "#81a1c1";
              else if (/\.flow_rate\./.test(line)) c = "#88c0d0";
              else if (/protocol\.delay/.test(line)) c = "#ebcb8b";
              else if (/pick_up_tip|drop_tip|measure_liquid/.test(line)) c = "#a3be8c";
              else if (/aspirate|dispense|blow_out|air_gap|touch_tip|mix/.test(line)) c = "#e2e8f0";
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
      {editingLabel && (
        <Modal>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Rename slot {editingLabel.slot}</div>
          <input autoFocus value={editingLabel.value}
            onChange={e => setEditingLabel(el => ({ ...el, value: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") setEditingLabel(null); }}
            placeholder="e.g. Hexane Source, BHA Matrix…"
            style={{ width: "100%", background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", borderRadius: 5, padding: "7px 9px", color: "var(--input-color,#e2e8f0)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
            <button onClick={() => setEditingLabel(null)}
              style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>Cancel</button>
            <button onClick={commitLabel}
              style={{ flex: 2, background: "#06b6d4", border: "none", color: "#020817", borderRadius: 5, padding: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>Save</button>
          </div>
        </Modal>
      )}

      {/* ── Template picker ── */}
      {showTemplateModal && (
        <Modal wide>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Load Template</div>
            <button onClick={() => setShowTemplateModal(false)}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <div key={key} onClick={() => applyTemplate(key)}
              style={{ background: "var(--bg-panel,#060e1d)", border: "1px solid var(--border,#0f172a)", borderRadius: 8, padding: "12px 14px", marginBottom: 8, cursor: "pointer", transition: "border-color 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#06b6d4"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border,#0f172a)"}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--input-color,#e2e8f0)", marginBottom: 3 }}>{t.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim,#475569)", marginBottom: 6 }}>{t.description}</div>
              <div style={{ display: "flex", gap: 10, fontSize: 9, color: "var(--text-dim,#64748b)" }}>
                <span>🧪 {t.labware.filter(l => l.def !== "_trash" && l.slot !== "A3").length} labware</span>
                <span>⚡ {t.steps.length} step{t.steps.length !== 1 ? "s" : ""}</span>
                <span>💧 {t.liquids.length} liquid{t.liquids.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "var(--text-dim,#64748b)", marginTop: 8, textAlign: "center" }}>
            Loading a template replaces your current deck and steps
          </div>
        </Modal>
      )}

      {/* ── Import modal ── */}
      {showImportModal && (
        <Modal>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Import Protocol</div>
            <button onClick={() => setShowImportModal(false)}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 12, lineHeight: 1.7 }}>
            Load a saved builder state <span style={{ color: "var(--text-dim,#64748b)" }}>(.json)</span> or import an existing Opentrons Python protocol <span style={{ color: "var(--text-dim,#64748b)" }}>(.py)</span>.<br />
            Python import reconstructs deck layout and best-effort transfer steps.
          </div>
          <input ref={fileInputRef} type="file" accept=".json,.py,.csv,.tsv" onChange={handleImportFile} style={{ display: "none" }} />
          <button onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%", background: "linear-gradient(135deg,#06b6d4,#6366f1)", border: "none", color: "#fff", borderRadius: 7, padding: "12px 0", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700, marginBottom: 8 }}>
            📂 Browse / Choose File
          </button>
          {importError && (
            <div style={{ fontSize: 10, color: "#ef4444", background: "#ef444410", border: "1px solid #ef444430", borderRadius: 5, padding: "7px 10px", marginTop: 6 }}>
              {importError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 9, color: "#475569", justifyContent: "center" }}>
            <span>.json — full builder state</span>
            <span>·</span>
            <span>.py — Opentrons protocol</span>
            <span>·</span>
            <span>.csv — transfer list</span>
          </div>
        </Modal>
      )}

      {/* ── Connection modal ── */}
      {showConnectionModal && (
        <ConnectionModal
          conn={showConnectionModal}
          labware={labware}
          onConfirm={confirmConnection}
          onAddToStep={handleAddToStep}
          onCancel={() => setShowConnectionModal(null)}
        />
      )}

      {/* ── Remove labware confirmation ── */}
      {pendingRemoveSlot && (() => {
        const lw = labware.find(l => l.slot === pendingRemoveSlot);
        const def = lw ? LABWARE_DEFS[lw.def] : null;
        const affected = stepsReferencingSlot(pendingRemoveSlot);
        const affectedLiquids = liquids.filter(l => l.slot === pendingRemoveSlot);
        const willDelete = affected.filter(s => {
          if (s.sourceSlot === pendingRemoveSlot) return true;
          const cleanedMulti = (s.multiDests || []).filter(d => d.slot !== pendingRemoveSlot);
          return s.destSlot === pendingRemoveSlot && cleanedMulti.length === 0;
        });
        const willPrune = affected.filter(s => !willDelete.includes(s));
        return (
          <Modal>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Remove labware?</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
              <span style={{ color: def?.color || "#ef4444", fontWeight: 700 }}>
                {lw?.label || pendingRemoveSlot}
              </span>
              {" "}({def?.shortLabel || pendingRemoveSlot}) is referenced by {affected.length} step{affected.length !== 1 ? "s" : ""}.
            </div>
            {willDelete.length > 0 && (
              <div style={{ background: "#ef444410", border: "1px solid #ef444430", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, marginBottom: 4 }}>
                  ✕ {willDelete.length} step{willDelete.length !== 1 ? "s" : ""} will be deleted
                </div>
                {willDelete.map((s, i) => {
                  const stepIdx = steps.indexOf(s) + 1;
                  return (
                    <div key={i} style={{ fontSize: 12, color: "#ef444499", marginBottom: 2 }}>
                      Step {stepIdx}: {s.type === "transfer"
                        ? `${s.sourceSlot}[${s.sourceWell}] → ${s.destSlot || "?"}[${s.destWell || "?"}]`
                        : `Mix in ${s.sourceSlot}[${s.sourceWell}]`}
                    </div>
                  );
                })}
              </div>
            )}
            {willPrune.length > 0 && (
              <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, marginBottom: 4 }}>
                  ⚠ {willPrune.length} step{willPrune.length !== 1 ? "s" : ""} will lose a destination
                </div>
                {willPrune.map((s, i) => {
                  const stepIdx = steps.indexOf(s) + 1;
                  const removedDests = (s.multiDests || []).filter(d => d.slot === pendingRemoveSlot).length
                    + (s.destSlot === pendingRemoveSlot ? 1 : 0);
                  return (
                    <div key={i} style={{ fontSize: 12, color: "#f59e0b99", marginBottom: 2 }}>
                      Step {stepIdx}: {removedDests} destination{removedDests !== 1 ? "s" : ""} removed
                    </div>
                  );
                })}
              </div>
            )}
            {affectedLiquids.length > 0 && (
              <div style={{ background: "#06b6d410", border: "1px solid #06b6d430", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#06b6d4", fontWeight: 700, marginBottom: 2 }}>
                  💧 {affectedLiquids.length} liquid definition{affectedLiquids.length !== 1 ? "s" : ""} will be unassigned
                </div>
                {affectedLiquids.map((l, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#06b6d499" }}>{l.name}</div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12, marginTop: 4 }}>
              This is undoable with Ctrl+Z.
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => setPendingRemoveSlot(null)}
                style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={() => { executeRemoveLabware(pendingRemoveSlot); setPendingRemoveSlot(null); }}
                style={{ flex: 2, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
                Remove + clean up {affected.length} step{affected.length !== 1 ? "s" : ""}
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ── New Protocol confirmation ── */}
      {showNewModal && (
        <Modal>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Start a new protocol?</div>
          <div style={{ fontSize: 11, color: "var(--text-dim,#64748b)", marginBottom: 16, lineHeight: 1.6 }}>
            This will clear all labware, steps, and liquids.
            {history.length > 0 && " Your current work will be saved to undo history."}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => setShowNewModal(false)}
              style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>
              Cancel
            </button>
            <button onClick={() => {
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
            }}
              style={{ flex: 2, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>
              Clear + Start fresh
            </button>
          </div>
        </Modal>
      )}

      {/* ── New Protocol confirmation ── */}
      {showNewModal && (
        <Modal>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Start a new protocol?</div>
          <div style={{ fontSize: 11, color: "var(--text-dim,#64748b)", marginBottom: 16, lineHeight: 1.6 }}>
            This will clear all labware, steps, and liquids.
            {history.length > 0 && " Your current work will be saved to undo history."}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => setShowNewModal(false)}
              style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "var(--text-dim,#64748b)", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>
              Cancel
            </button>
            <button onClick={() => {
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
            }}
              style={{ flex: 2, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>
              Clear + Start fresh
            </button>
          </div>
        </Modal>
      )}

      {/* ── Well Info Modal ── */}
      {wellInfoModal && (() => {
        const lw = labware.find(l => l.slot === wellInfoModal.slot);
        const def = lw ? LABWARE_DEFS[lw.def] : null;
        if (!lw || !def) { setWellInfoModal(null); return null; }
        return (
          <WellInfoModal
            slot={wellInfoModal.slot}
            well={wellInfoModal.well}
            lw={lw} def={def}
            volumeMap={volumeMap}
            liquids={liquids}
            setLiquids={l => { pushHistory(); setLiquids(l); }}
            labware={labware}
            onClose={() => setWellInfoModal(null)}
          />
        );
      })()}

      {/* ── Remove step confirmation ── */}
      {pendingRemoveStep !== null && (() => {
        const s = steps[pendingRemoveStep];
        if (!s) { setPendingRemoveStep(null); return null; }
        const isTx = s.type === "transfer";
        const destCount = (s.multiDests?.filter(d => d.slot && d.well).length || 0) + (s.destSlot && s.destWell ? 1 : 0);
        const totalVol = (s.volume || 0) * Math.max(1, destCount);
        return (
          <Modal>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Delete step {pendingRemoveStep + 1}?</div>
            <div style={{ background: "var(--bg-panel,#060e1d)", border: "1px solid var(--border,#0f172a)", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
              {isTx ? (
                <>
                  <div style={{ fontSize: 11, color: "#22d3ee", marginBottom: 3 }}>
                    {s.sourceSlot}[{s.sourceWell}] → {destCount > 1 ? `${destCount} destinations` : `${s.destSlot}[${s.destWell}]`}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {s.volume}µL × {destCount} = {totalVol}µL · {PIPETTES[s.pipette]?.label || s.pipette || "no pipette"} · {TIP_POLICIES[s.tipPolicy] || s.tipPolicy}
                  </div>
                  {s.multiDests?.length > 0 && (
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                      + {s.multiDests.length} additional destination{s.multiDests.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: "#a78bfa" }}>
                  Mix {s.mixReps || 3}× {s.volume}µL in {s.sourceSlot}[{s.sourceWell}]
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 12 }}>This is undoable with Ctrl+Z.</div>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => setPendingRemoveStep(null)}
                style={{ flex: 1, background: "var(--input-bg,#0a1628)", border: "1px solid var(--input-border,#1e293b)", color: "#64748b", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>
                Cancel
              </button>
              <button onClick={() => {
                pushHistory();
                setSteps(prev => prev.filter((_, idx) => idx !== pendingRemoveStep));
                setPendingRemoveStep(null);
              }}
                style={{ flex: 2, background: "#ef444420", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>
                Delete step {pendingRemoveStep + 1}
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
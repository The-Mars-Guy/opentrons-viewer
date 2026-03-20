// ── Labware Definitions ───────────────────────────────────────────────────────

export const LABWARE_DEFS = {
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
    wells: ["A1"], rows: 1, cols: 1, shape: "tips", icon: "💉"
  },
  "opentrons_flex_96_tiprack_50ul": {
    label: "Flex 96 tip rack — 50µL",
    shortLabel: "Tips 50µL",
    paletteDesc: "96-well tip rack, 50µL capacity",
    color: "#b45309",
    wells: ["A1"], rows: 1, cols: 1, shape: "tips", icon: "💉"
  }
};

export const DECK_SLOTS = ["A1","A2","A3","B1","B2","B3","C1","C2","C3","D1","D2","D3"];

// ── Pipettes — 1-channel only (1000µL right mount, 50µL left mount) ───────────

export const PIPETTES = {
  "flex_1channel_1000": { label: "1-Ch 1000µL", mount: "right", maxVol: 1000, icon: "🔵" },
  "flex_1channel_50":   { label: "1-Ch 50µL",   mount: "left",  maxVol: 50,   icon: "🟢" },
};

// ── Liquid classes (API 2.24+) ────────────────────────────────────────────────
// Maps to the built-in Opentrons liquid class names used in
// get_liquid_class() / transfer_with_liquid_class().
// "" = manual (use legacy aspirate/dispense with explicit flow rates).

export const LIQUID_CLASSES = {
  "":         { label: "Manual (custom flow rates)", apiName: null },
  "aqueous":  { label: "Aqueous (built-in)",          apiName: "aqueous" },
  "volatile": { label: "Volatile (built-in)",          apiName: "volatile" },
  "viscous":  { label: "Viscous (built-in)",           apiName: "viscous" },
};

// ── Solvent presets (manual mode — used when liquidClass = "") ────────────────
// These drive the explicit flow-rate fields in the UI and the legacy code path.

export const SOLVENT_PRESETS = {
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

export const TIP_POLICIES = {
  new_each:       "New tip each destination",
  one_per_source: "One tip per source",
  one_total:      "One tip total",
};

export const DISPENSE_REFERENCES = { top: "top()", bottom: "bottom()" };

// API version this app targets
export const API_VERSION = "2.27";

// ── Theme System ──────────────────────────────────────────────────────────────

export const THEMES = {
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

export const WELL_CAPACITY = {
  "opentrons_6_tuberack_falcon_50ml_conical":             { lg: 50000 },
  "opentrons_10_tuberack_falcon_4x50ml_6x15ml_conical":  { lg: 50000, sm: 15000 },
  "opentrons_15_tuberack_falcon_15ml_conical":            { sm: 15000 },
  "waters_48_tuberack_2000ul":                            { xs: 2000 },
};

export const DEAD_VOLUME = {
  "opentrons_6_tuberack_falcon_50ml_conical":             { lg: 1500 },
  "opentrons_10_tuberack_falcon_4x50ml_6x15ml_conical":  { lg: 1500, sm: 800 },
  "opentrons_15_tuberack_falcon_15ml_conical":            { sm: 800 },
  "waters_48_tuberack_2000ul":                            { xs: 100 },
};

// Connection line colors keyed by pipette
export const PIPETTE_COLORS = {
  "flex_1channel_1000": "#22d3ee",
  "flex_1channel_50":   "#a3e635",
};

// ── Templates ─────────────────────────────────────────────────────────────────

export const TEMPLATES = {
  bha_prep: {
    name: "BHA 8-Destination Prep",
    description: "Base matrix dispensed from one 50 mL tube into 8 sample vials. Aqueous liquid class, one tip per source, LLD on.",
    labware: [
      { slot: "B1", def: "opentrons_6_tuberack_falcon_50ml_conical", label: "BHA Matrix" },
      { slot: "C1", def: "waters_48_tuberack_2000ul",                label: "Sample Vials" },
      { slot: "D1", def: "opentrons_flex_96_tiprack_1000ul",         label: "Tips 1mL" },
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
        liquidClass: "aqueous",
        tipPolicy: "one_per_source", prewet: false, touchTip: false, airGap: 0, mixReps: 3,
        aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
        delayAfterAspirate: 0.5, delayAfterDispense: 0.3,
        meniscusOffset: -5, dispenseRef: "top", dispenseTopOffset: -2,
        blowoutRef: "top", blowoutTopOffset: -2, remeasureEachAsp: true,
        keepTipAfterStep: false, endLocation: "", movementDelay: 0,
      },
    ],
    liquids: [
      { id: 1, name: "BHA Matrix", description: "Base matrix solution", color: "#2563eb", slot: "B1", well: "A1", volume: 10000 },
    ],
    liquidSensing: true,
  },
  calibration_curve: {
    name: "Methanol Calibration Curve",
    description: "IS added to 8 calibration vials. Volatile liquid class, one tip total, re-measure each aspirate.",
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
        liquidClass: "volatile",
        tipPolicy: "one_total", prewet: true, touchTip: false, airGap: 5, mixReps: 3,
        aspirateRate: 30, dispenseRate: 50, blowoutRate: 30,
        delayAfterAspirate: 1.5, delayAfterDispense: 0.8,
        meniscusOffset: -6, dispenseRef: "bottom", dispenseTopOffset: 10,
        blowoutRef: "top", blowoutTopOffset: 0, remeasureEachAsp: true,
        keepTipAfterStep: false, endLocation: "", movementDelay: 0,
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
    description: "1 mL hexane to 5 vials. Volatile liquid class, new tip each, air gap 5 µL.",
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
        liquidClass: "volatile",
        tipPolicy: "new_each", prewet: true, touchTip: false, airGap: 5, mixReps: 3,
        aspirateRate: 30, dispenseRate: 50, blowoutRate: 30,
        delayAfterAspirate: 1.5, delayAfterDispense: 0.8,
        meniscusOffset: -6, dispenseRef: "top", dispenseTopOffset: -2,
        blowoutRef: "top", blowoutTopOffset: 0, remeasureEachAsp: false,
        keepTipAfterStep: false, endLocation: "", movementDelay: 0,
      },
    ],
    liquids: [
      { id: 1, name: "Hexane", description: "n-Hexane volatile solvent", color: "#f97316", slot: "B1", well: "A1", volume: 20000 },
    ],
    liquidSensing: true,
  },
};

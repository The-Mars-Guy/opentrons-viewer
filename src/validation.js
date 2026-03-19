import { LABWARE_DEFS, PIPETTES, LIQUID_CLASSES, API_VERSION } from "./constants";

// ── Protocol Validation ───────────────────────────────────────────────────────

export function runValidation({ labware, steps }) {
  const errors = [], warnings = [], ok = [];

  const realLabware = labware.filter(l => l.def !== "_trash" && l.slot !== "A3");
  if (realLabware.length === 0) errors.push("No labware on deck");
  if (steps.length === 0) warnings.push("No steps defined yet");

  const slotCounts = {};
  labware.forEach(l => { slotCounts[l.slot] = (slotCounts[l.slot] || 0) + 1; });
  Object.entries(slotCounts).forEach(([slot, count]) => {
    if (count > 1) errors.push(`Duplicate labware in slot ${slot}`);
  });

  const mounts     = {};
  const warnedRacks = new Set();

  steps.forEach((s, i) => {
    const n = i + 1;

    // Source
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

    // Pipette
    if (!s.pipette) {
      errors.push(`Step ${n}: no pipette selected`);
    } else {
      const pd = PIPETTES[s.pipette];
      if (!pd) {
        errors.push(`Step ${n}: unknown pipette "${s.pipette}" — only 1-channel pipettes are supported`);
      } else {
        // Mount conflict check
        if (mounts[pd.mount] && mounts[pd.mount] !== s.pipette)
          errors.push(`Mount conflict: two pipettes assigned to ${pd.mount} mount`);
        mounts[pd.mount] = s.pipette;

        // Tip rack check
        const tDef = pd.maxVol >= 1000
          ? "opentrons_flex_96_tiprack_1000ul"
          : "opentrons_flex_96_tiprack_50ul";
        if (!labware.find(l => l.def === tDef) && !warnedRacks.has(tDef)) {
          warnings.push(`No ${pd.maxVol}µL tip rack on deck (needed by step ${n})`);
          warnedRacks.add(tDef);
        }

        // Air gap sanity
        if (s.airGap > 0 && s.airGap >= pd.maxVol)
          errors.push(`Step ${n}: airGap (${s.airGap}µL) ≥ pipette max (${pd.maxVol}µL) — no room for liquid`);

        // Per-dest volume checks (default vol + any overrides)
        const allDestVols = [
          (s.destVolume != null && s.destVolume !== "") ? Number(s.destVolume) : (s.volume || 0),
          ...(s.multiDests || []).map(d =>
            (d.volume != null && d.volume !== "") ? Number(d.volume) : (s.volume || 0)
          ),
        ];
        allDestVols.forEach((v, vi) => {
          if (!v) return;
          if (v > pd.maxVol) {
            const safeTrips = Math.ceil(v / Math.max(1, pd.maxVol - (s.airGap || 0)));
            const label = vi === 0 ? "primary dest" : `dest ${vi + 1}`;
            ok.push(`Step ${n} (${label}): ${safeTrips}-trip transfer (${v}µL > ${pd.maxVol}µL max)`);
          }
        });

        // Liquid class validation
        if (s.liquidClass && s.liquidClass !== "") {
          const lc = LIQUID_CLASSES[s.liquidClass];
          if (!lc || !lc.apiName) {
            errors.push(`Step ${n}: unknown liquid class "${s.liquidClass}"`);
          } else {
            ok.push(`Step ${n}: using built-in liquid class "${lc.apiName}" (API ${API_VERSION})`);
          }
          // In liquid-class mode, manual flow rate fields are ignored — warn if they look non-default
          if (s.liquidClass !== "" && (s.aspirateRate !== 150 || s.dispenseRate !== 300)) {
            warnings.push(`Step ${n}: custom flow rates are ignored when a liquid class is selected`);
          }
        }

        // Tip carry validation
        if (s.keepTipAfterStep) {
          const nextStep = steps[i + 1];
          if (!nextStep) {
            warnings.push(`Step ${n}: "Keep tip" set on last step — tip will be safety-dropped`);
          } else if (nextStep.pipette && nextStep.pipette !== s.pipette) {
            warnings.push(`Step ${n}: "Keep tip" but step ${n+1} uses a different pipette — tip will be force-dropped`);
          }
        }
      }
    }

    // Transfer destinations
    if (s.type === "transfer") {
      const hasPrimary = s.destSlot && s.destWell;
      const hasMulti   = s.multiDests?.length > 0;
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
  });

  if (errors.length === 0 && warnings.length === 0) ok.unshift(`Protocol looks valid ✓  (API ${API_VERSION})`);
  return { errors, warnings, ok };
}

// ── Python .py File Parser ────────────────────────────────────────────────────
// Best-effort import of existing Opentrons Python protocols.
// Handles 2.23+ syntax — reconstructs deck layout and transfer steps.

export function parseProtocolPy(text) {
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

  if (/liquid_presence_detection\s*=\s*False/i.test(text)) result.liquidSensing = false;

  // Labware
  const lwRe = /protocol\.load_labware\(\s*"([^"]+)"\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]*)")?\)/g;
  let m;
  while ((m = lwRe.exec(text)) !== null) {
    const [, def, slot, label = ""] = m;
    if (LABWARE_DEFS[def] && !result.labware.find(l => l.slot === slot)) {
      result.labware.push({ slot, def, label, id: `${slot}-import` });
    }
  }
  result.labware.push({ slot: "A3", def: "_trash", label: "Trash", id: "trash" });

  // Best-effort aspirate → dispense pairing
  const aspRe = /pip[\w_]*\.aspirate\(\s*([\d.]+)\s*,\s*lw_(\w+)\["([^"]+)"\]/g;
  const disRe = /pip[\w_]*\.dispense\([^,]+,\s*lw_(\w+)\["([^"]+)"\]/g;
  const asps = [], diss = [];
  while ((m = aspRe.exec(text)) !== null) asps.push({ vol: parseFloat(m[1]), slot: m[2].toUpperCase(), well: m[3] });
  while ((m = disRe.exec(text)) !== null) diss.push({ slot: m[1].toUpperCase(), well: m[2] });

  // Detect pipette — only 1-channel are supported now
  let detectedPipette = "flex_1channel_1000";
  for (const pip of Object.keys(PIPETTES)) {
    if (text.includes(`pip_${pip}`) || text.includes(`"${pip}"`)) {
      detectedPipette = pip; break;
    }
  }

  // Detect liquid class usage
  let detectedClass = "";
  for (const [key, lc] of Object.entries(LIQUID_CLASSES)) {
    if (lc.apiName && text.includes(`get_liquid_class("${lc.apiName}")`)) {
      detectedClass = key; break;
    }
  }

  for (let i = 0; i < Math.min(asps.length, diss.length, 30); i++) {
    result.steps.push({
      type: "transfer",
      sourceSlot: asps[i].slot, sourceWell: asps[i].well,
      destSlot:   diss[i].slot, destWell:   diss[i].well,
      multiDests: [], volume: asps[i].vol || 100,
      pipette: detectedPipette, tipPolicy: "new_each",
      liquidClass: detectedClass,
      keepTipAfterStep: false,
      prewet: false, touchTip: false, airGap: 0, mixReps: 3,
      aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
      delayAfterAspirate: 0, delayAfterDispense: 0, meniscusOffset: -5,
      dispenseRef: "top", dispenseTopOffset: -2,
      blowoutRef:  "top", blowoutTopOffset:  -2, remeasureEachAsp: false,
      endLocation: "", movementDelay: 0,
    });
  }

  return result;
}

// ── CSV Transfer Import ───────────────────────────────────────────────────────

export function parseTransferCSV(text, defaultPipette = "flex_1channel_1000") {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error("Empty file");

  const hasHeader = /slot|well|vol|source|dest/i.test(lines[0].toLowerCase());
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const steps = [];
  dataLines.forEach(line => {
    const cols = line.split(/[,\t]/).map(c => c.trim());
    if (cols.length < 5) return;
    const [srcSlot, srcWell, dstSlot, dstWell, volStr] = cols;
    const vol = parseFloat(volStr);
    if (!srcSlot || !srcWell || !dstSlot || !dstWell || isNaN(vol)) return;
    steps.push({
      type: "transfer",
      sourceSlot: srcSlot.toUpperCase(), sourceWell: srcWell.toUpperCase(),
      destSlot:   dstSlot.toUpperCase(), destWell:   dstWell.toUpperCase(),
      multiDests: [], volume: vol,
      pipette: defaultPipette, tipPolicy: "new_each",
      liquidClass: "", keepTipAfterStep: false,
      prewet: false, touchTip: false, airGap: 0, mixReps: 3, remeasureEachAsp: false,
      aspirateRate: 150, dispenseRate: 300, blowoutRate: 200,
      delayAfterAspirate: 0, delayAfterDispense: 0, meniscusOffset: -5,
      dispenseRef: "top", dispenseTopOffset: -2,
      blowoutRef:  "top", blowoutTopOffset:  -2,
      endLocation: "", movementDelay: 0,
    });
  });

  if (!steps.length) throw new Error("No valid rows found (expected: srcSlot, srcWell, dstSlot, dstWell, volume)");
  return steps;
}

import { PIPETTES, LABWARE_DEFS, WELL_CAPACITY, DEAD_VOLUME } from "./constants";

// ── Run-time estimate (very rough, seconds) ───────────────────────────────────

// Returns total run time in seconds
export function estimateRunTime(steps) {
  return estimateRunTimePerStep(steps).reduce((a, b) => a + b, 10); // 10s startup
}

// Returns array of per-step estimates (seconds), same length as steps
export function estimateRunTimePerStep(steps) {
  return steps.map(s => {
    if (!s.pipette) return 0;
    const pip = PIPETTES[s.pipette];
    if (!pip) return 0;

    if (s.type === "mix") {
      const vol = s.volume || 0;
      return Math.round(3 + (s.mixReps || 3) * (vol / (pip.maxVol * 0.5)) * 2);
    }

    // Build dest list with per-dest volumes
    const destList = [
      ...(s.destSlot && s.destWell ? [s.volume || 0] : []),
      ...(s.multiDests || []).map(d =>
        (d.volume != null && d.volume !== "") ? Number(d.volume) : (s.volume || 0)
      ),
    ];
    if (!destList.length) return 0;

    const airGap = s.airGap || 0;
    const safeMax = Math.max(1, pip.maxVol - airGap);

    let stepSecs = s.tipPolicy === "new_each" ? 0 : 2; // pick up once for non-new_each
    if (s.prewet) stepSecs += 3;

    destList.forEach(vol => {
      const trips = Math.ceil(vol / safeMax);
      const perTrip =
        (vol / trips / (s.aspirateRate || 150)) +
        (s.delayAfterAspirate || 0) +
        (airGap ? 0.3 : 0) +
        (vol / trips / (s.dispenseRate || 300)) +
        (s.delayAfterDispense || 0) +
        0.5; // blow out
      stepSecs += trips * perTrip + (s.touchTip ? 1 : 0);
      if (s.tipPolicy === "new_each") stepSecs += 4; // pick up + drop
    });

    return Math.round(stepSecs);
  });
}

export function formatDuration(secs) {
  if (secs < 60) return `~${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

// ── Volume display helpers ─────────────────────────────────────────────────────

export function fmtVol(uL, labwareDef) {
  const isTube = labwareDef?.shape === "tube";
  if (isTube) {
    const ml = uL / 1000;
    return ml === Math.floor(ml) ? `${ml} mL` : `${ml.toFixed(2).replace(/\.?0+$/, "")} mL`;
  }
  return `${Math.round(uL)} µL`;
}

export function parseVolInput(val, isTube) {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return isTube ? n * 1000 : n; // tubes: input is mL, store as µL
}

// ── Volume map computation ─────────────────────────────────────────────────────
// Returns { [slot:well]: { remaining, initial, capacity, deadVol } }

export function computeVolumeMap(labware, steps, liquids) {
  const map = {};

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

  // Simulate steps — respects per-dest volume overrides (d.volume ?? s.volume)
  steps.forEach(s => {
    if (s.type !== "transfer" || !s.sourceSlot || !s.sourceWell) return;
    const srcKey = `${s.sourceSlot}:${s.sourceWell}`;

    const dests = [
      ...(s.destSlot && s.destWell
        ? [{ slot: s.destSlot, well: s.destWell, volume: s.volume || 0 }]
        : []),
      ...(s.multiDests || []).map(d => ({
        slot: d.slot, well: d.well,
        volume: (d.volume != null && d.volume !== "") ? Number(d.volume) : (s.volume || 0),
      })),
    ];

    const totalOut = dests.reduce((sum, d) => sum + (d.volume || 0), 0);
    if (!map[srcKey]) map[srcKey] = { initial: 0, remaining: 0 };
    map[srcKey].remaining -= totalOut;

    dests.forEach(d => {
      if (!d.slot || !d.well) return;
      const dk = `${d.slot}:${d.well}`;
      if (!map[dk]) map[dk] = { initial: 0, remaining: 0 };
      map[dk].remaining += d.volume || 0;
    });
  });

  return map;
}

// ── Python code generator helpers ─────────────────────────────────────────────

export function lwVar(slot) { return `lw_${slot.toLowerCase()}`; }
export function fmt(n) { return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(1)); }

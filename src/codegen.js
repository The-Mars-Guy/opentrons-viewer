import { PIPETTES, LABWARE_DEFS, LIQUID_CLASSES, API_VERSION } from "./constants";
import { lwVar, fmt } from "./utils";

// ── Code Generator ────────────────────────────────────────────────────────────
// Targets Opentrons Flex Python Protocol API 2.23.
//
// Per-destination volumes: each dest (primary + multiDests) may carry its own
// `volume` field. When absent, the step-level `step.volume` is used as default.
//
// Code path selection:
//   liquidClass != "" → transfer_with_liquid_class() (requires robot software v8.3+ / API 2.24+)
//   liquidClass == "" → manual aspirate/dispense with explicit flow rates

export function generateCode({ labware, steps, liquids, protocolName, author, description, liquidSensing = true }) {
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
  push(`requirements = {"robotType": "Flex", "apiLevel": "${API_VERSION}"}`);
  push();
  push(`def run(protocol: protocol_api.ProtocolContext):`);
  push();
  push(`    protocol.load_trash_bin("A3")`);
  push();

  // Labware
  const nonTrash = labware.filter(lw => lw.slot !== "A3" && lw.def !== "_trash");
  nonTrash.forEach(lw => {
    push(`    ${lwVar(lw.slot)} = protocol.load_labware("${lw.def}", "${lw.slot}", "${lw.label || lw.slot}")`);
  });
  push();

  // Pipettes
  const usedPipettes = {};
  steps.forEach(s => { if (s.pipette) usedPipettes[s.pipette] = true; });
  Object.keys(usedPipettes).forEach(pip => {
    const pd = PIPETTES[pip]; if (!pd) return;
    const tDef   = pd.maxVol >= 1000 ? "opentrons_flex_96_tiprack_1000ul" : "opentrons_flex_96_tiprack_50ul";
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

  // Liquid class instances are NOT emitted — get_liquid_class() has a known
  // bug in the Opentrons App that causes it to fail with "version 1 not found"
  // regardless of robot software version. We always use explicit building-block
  // commands with the equivalent flow rates instead.

  // Liquid definitions
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
    liquids.forEach(liq => {
      if (!liq.slot || !liq.well) return;
      const varName = `liq_${liq.name.replace(/\W+/g, "_").toLowerCase()}`;
      push(`    ${lwVar(liq.slot)}["${liq.well}"].load_liquid(${varName}, volume=${liq.volume || 0})`);
    });
    push();
  }

  // ── Inter-step tip carry state ─────────────────────────────────────────────
  const tipCarried = {};

  steps.forEach((step, i) => {
    const nextStep = steps[i + 1] || null;

    if (!step.sourceSlot || !step.pipette) {
      if (tipCarried[step.pipette]) {
        push(`    pip_${step.pipette}.drop_tip()  # carried tip dropped — step ${i+1} incomplete`);
        tipCarried[step.pipette] = false;
      }
      push(`    # Step ${i+1}: INCOMPLETE — skipped`); push(); return;
    }

    const pip     = `pip_${step.pipette}`;
    const maxVol  = PIPETTES[step.pipette]?.maxVol || 1000;
    const srcV    = lwVar(step.sourceSlot);
    const lcName  = LIQUID_CLASSES[step.liquidClass]?.apiName || null;
    // Always use manual building-block path — transfer_with_liquid_class() /
    // get_liquid_class() has a known Opentrons App bug ("version 1 not found").
    // Instead, map the selected liquid class to its equivalent flow rates.
    const useLiquidClass = false;
    // Flow rate presets per liquid class (used in manual path below)
    const LC_RATES = {
      aqueous:  { asp: 150, disp: 300, blow: 200, airGap: 0,  touchTip: false, prewet: false },
      volatile: { asp: 30,  disp: 50,  blow: 30,  airGap: 5,  touchTip: false, prewet: true  },
      viscous:  { asp: 20,  disp: 30,  blow: 20,  airGap: 0,  touchTip: true,  prewet: true  },
    };
    const lcRates = (lcName && LC_RATES[lcName]) ? LC_RATES[lcName] : null;

    const stepLabel = step.type === "transfer"
      ? `Transfer from ${step.sourceSlot}[${step.sourceWell}]`
      : `Mix ${step.mixReps||3}× ${step.volume}µL in ${step.sourceSlot}[${step.sourceWell}]`;

    push(`    # ── Step ${i+1}: ${stepLabel} ──`);
    // Emit custom note if set, otherwise the auto-generated label
    const commentLine = step.note
      ? `=== Step ${i+1}: ${step.note} ===`
      : `=== Step ${i+1}: ${stepLabel} ===`;
    push(`    protocol.comment("${commentLine.replace(/"/g, "'")}")`);

    // Drop any tip from a different pipette
    Object.keys(tipCarried).forEach(carriedPip => {
      if (tipCarried[carriedPip] && carriedPip !== step.pipette) {
        push(`    pip_${carriedPip}.drop_tip()  # WARNING: carried tip dropped — pipette changed`);
        tipCarried[carriedPip] = false;
      }
    });

    const incomingTip = !!tipCarried[step.pipette];
    const keepTip     = step.keepTipAfterStep === true
      && nextStep && nextStep.pipette === step.pipette;

    // ── Mix step ──────────────────────────────────────────────────────────────
    if (step.type === "mix") {
      if (!incomingTip) push(`    ${pip}.pick_up_tip()`);
      else push(`    # Tip carried in from previous step`);

      if (useLiquidClass) {
        push(`    ${pip}.mix(`);
        push(`        repetitions=${step.mixReps||3},`);
        push(`        volume=${step.volume||50},`);
        push(`        location=${srcV}["${step.sourceWell}"].meniscus(z=${step.meniscusOffset||-5}),`);
        push(`        liquid_class=lc_${lcName}`);
        push(`    )`);
      } else {
        push(`    ${pip}.flow_rate.aspirate = ${step.aspirateRate||150}`);
        push(`    ${pip}.flow_rate.dispense = ${step.dispenseRate||300}`);
        push(`    ${pip}.flow_rate.blow_out = ${step.blowoutRate||200}`);
        push(`    ${pip}.mix(${step.mixReps||3}, ${step.volume||50}, ${srcV}["${step.sourceWell}"].meniscus(z=${step.meniscusOffset||-5}))`);
        push(`    ${pip}.blow_out(${srcV}["${step.sourceWell}"].top(${step.blowoutTopOffset||-2}))`);
      }

      if (keepTip) { push(`    # Tip retained — carrying into step ${i+2}`); tipCarried[step.pipette] = true; }
      else { push(`    ${pip}.drop_tip()`); tipCarried[step.pipette] = false; }
      push(); return;
    }

    // ── Transfer step ─────────────────────────────────────────────────────────
    if (!step.destSlot) { push(`    # Step ${i+1}: INCOMPLETE — skipped`); push(); return; }

    // Build dest list — primary dest always uses step.volume;
    // additional dests may carry their own volume override (null = use step.volume)
    const allDests = [
      { slot: step.destSlot, well: step.destWell, volume: step.volume || 0 },
      ...(step.multiDests || []).map(d => ({
        slot: d.slot,
        well: d.well,
        volume: (d.volume != null && d.volume !== "") ? Number(d.volume) : (step.volume || 0),
      })),
    ];

    const tipPolicy  = step.tipPolicy || "new_each";
    const airGap     = step.airGap || 0;
    const menOffset  = step.meniscusOffset ?? -5;
    const dispRef    = step.dispenseRef || "top";
    const dispOffset = step.dispenseTopOffset ?? -2;
    const blowRef    = step.blowoutRef || "top";
    const blowOffset = step.blowoutTopOffset ?? -2;
    const delayAsp   = step.delayAfterAspirate ?? 0;
    const delayDisp  = step.delayAfterDispense ?? 0;
    const endLoc     = step.endLocation || "";
    const moveDelay  = step.movementDelay || 0;

    const dispLocation = (dstV, dstW) =>
      dispRef === "bottom" ? `${dstV}["${dstW}"].bottom(${dispOffset})` : `${dstV}["${dstW}"].top(${dispOffset})`;
    const blowLocation = (dstV, dstW) =>
      blowRef === "bottom" ? `${dstV}["${dstW}"].bottom(${blowOffset})` : `${dstV}["${dstW}"].top(${blowOffset})`;

    // ── Manual path ──────────────────────────────────────────────────────────
    // Note: liquid class path (transfer_with_liquid_class) is intentionally
    // disabled due to a known Opentrons App bug. Flow rates from the selected
    // liquid class are applied below instead.
    // If a liquid class is selected, use its preset rates instead of manual fields
    const _asp  = lcRates ? lcRates.asp  : (step.aspirateRate || 150);
    const _disp = lcRates ? lcRates.disp : (step.dispenseRate || 300);
    const _blow = lcRates ? lcRates.blow : (step.blowoutRate  || 200);
    // Override airGap and touchTip from liquid class if set
    const effectiveAirGap  = lcRates ? lcRates.airGap  : airGap;
    const effectiveTouchTip = lcRates ? lcRates.touchTip : step.touchTip;
    const effectivePrewet   = lcRates ? lcRates.prewet   : step.prewet;

    if (lcRates) push(`    # Liquid class "${lcName}" — using equivalent manual flow rates`);
    push(`    ${pip}.flow_rate.aspirate = ${_asp}`);
    push(`    ${pip}.flow_rate.dispense = ${_disp}`);
    push(`    ${pip}.flow_rate.blow_out = ${_blow}`);

    if (tipPolicy === "one_total" || tipPolicy === "one_per_source") {
      if (!incomingTip) push(`    ${pip}.pick_up_tip()`);
      else push(`    # Tip carried in from previous step`);
      if (liquidSensing) push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
      if (effectivePrewet) emitPrewet(L, pip, srcV, step.sourceWell, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing);
    }

    allDests.forEach((dst, di) => {
      if (!dst.slot || !dst.well) return;
      const dstV       = lwVar(dst.slot);
      const dstW       = dst.well;
      // Use this dest's resolved volume
      const totalVol   = dst.volume;
      const trips      = Math.ceil(totalVol / Math.max(1, maxVol - effectiveAirGap));
      const volPerTrip = totalVol / trips;

      const aspirateLoc = liquidSensing
        ? `${srcV}["${step.sourceWell}"].meniscus(z=${menOffset})`
        : `${srcV}["${step.sourceWell}"].bottom(5)`;

      if (tipPolicy === "new_each") {
        if (di === 0 && incomingTip) push(`    # Tip carried in from previous step`);
        else push(`    ${pip}.pick_up_tip()`);
        if (liquidSensing && (step.remeasureEachAsp || di === 0))
          push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
        if (di === 0 && effectivePrewet) emitPrewet(L, pip, srcV, step.sourceWell, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing);
      } else if (liquidSensing && step.remeasureEachAsp) {
        push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
      }

      const aspKwargs = [];
      if (endLoc === "bottom") aspKwargs.push(`end_location=${srcV}["${step.sourceWell}"].bottom(1)`);
      if (moveDelay > 0)       aspKwargs.push(`movement_delay=${moveDelay}`);

      if (trips > 1) {
        push(`    for _ in range(${trips}):`);
        if (aspKwargs.length) {
          push(`        ${pip}.aspirate(${fmt(volPerTrip)}, ${aspirateLoc}, rate=1.0, ${aspKwargs.join(", ")})`);
        } else {
          push(`        ${pip}.aspirate(${fmt(volPerTrip)}, ${aspirateLoc}, rate=1.0)`);
        }
        if (delayAsp > 0)  push(`        protocol.delay(seconds=${delayAsp})`);
        if (effectiveAirGap > 0)    push(`        ${pip}.air_gap(${effectiveAirGap})`);
        push(`        ${pip}.dispense(${fmt(volPerTrip + effectiveAirGap)}, ${dispLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`        protocol.delay(seconds=${delayDisp})`);
        push(`        ${pip}.blow_out(${blowLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`        protocol.delay(seconds=${delayDisp})`);
        if (effectiveTouchTip) push(`        ${pip}.touch_tip(${dstV}["${dstW}"], v_offset=-2, radius=0.9, speed=20)`);
      } else {
        if (aspKwargs.length) {
          push(`    ${pip}.aspirate(${fmt(totalVol)}, ${aspirateLoc}, rate=1.0, ${aspKwargs.join(", ")})`);
        } else {
          push(`    ${pip}.aspirate(${fmt(totalVol)}, ${aspirateLoc}, rate=1.0)`);
        }
        if (delayAsp > 0)  push(`    protocol.delay(seconds=${delayAsp})`);
        if (effectiveAirGap > 0)    push(`    ${pip}.air_gap(${effectiveAirGap})`);
        push(`    ${pip}.dispense(${fmt(totalVol + effectiveAirGap)}, ${dispLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`    protocol.delay(seconds=${delayDisp})`);
        push(`    ${pip}.blow_out(${blowLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`    protocol.delay(seconds=${delayDisp})`);
        if (effectiveTouchTip) push(`    ${pip}.touch_tip(${dstV}["${dstW}"], v_offset=-2, radius=0.9, speed=20)`);
      }

      if (tipPolicy === "new_each") {
        const isLastDest = di === allDests.length - 1;
        if (isLastDest && keepTip) { push(`    # Tip retained — carrying into step ${i+2}`); tipCarried[step.pipette] = true; }
        else { push(`    ${pip}.drop_tip()`); if (isLastDest) tipCarried[step.pipette] = false; }
      }
    });

    if (tipPolicy === "one_total" || tipPolicy === "one_per_source") {
      if (keepTip) { push(`    # Tip retained — carrying into step ${i+2}`); tipCarried[step.pipette] = true; }
      else { push(`    ${pip}.drop_tip()`); tipCarried[step.pipette] = false; }
    }

    push();
  });

  // Safety drop
  Object.keys(tipCarried).forEach(pip => {
    if (tipCarried[pip]) push(`    pip_${pip}.drop_tip()  # safety drop — tip carried past last step`);
  });

  push(`    protocol.comment("=== Protocol complete ===")`);
  return L.join("\n");
}

function emitPrewet(L, pip, srcV, srcW, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing = true) {
  const pw = Math.min(20, maxVol);
  const aspirateLoc = liquidSensing
    ? `${srcV}["${srcW}"].meniscus(z=${menOffset})`
    : `${srcV}["${srcW}"].bottom(5)`;
  L.push(`    # Pre-wet`);
  L.push(`    ${pip}.aspirate(${pw}, ${aspirateLoc}, rate=1.0)`);
  if (delayAsp > 0) L.push(`    protocol.delay(seconds=${delayAsp})`);
  L.push(`    ${pip}.dispense(${pw}, ${srcV}["${srcW}"].top(${dispOffset}))`);
  L.push(`    ${pip}.blow_out(${srcV}["${srcW}"].top(${blowOffset}))`);
  if (delayDisp > 0) L.push(`    protocol.delay(seconds=${delayDisp})`);
}

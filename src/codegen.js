import { PIPETTES, LABWARE_DEFS, LIQUID_CLASSES, API_VERSION } from "./constants";
import { lwVar, fmt } from "./utils";

// ── Code Generator ────────────────────────────────────────────────────────────
// Targets Opentrons Flex Python Protocol API 2.27.
//
// Per-destination volumes: each dest (primary + multiDests) may carry its own
// `volume` field. When absent, the step-level `step.volume` is used as default.
//
// Code path selection:
//   liquidClass != "" → transfer_with_liquid_class() (API 2.24+)
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

  // Liquid class instances
  const usedClasses = new Set(
    steps.map(s => LIQUID_CLASSES[s.liquidClass]?.apiName).filter(Boolean)
  );
  if (usedClasses.size > 0) {
    push(`    # ── Liquid class instances (API ${API_VERSION}) ──`);
    usedClasses.forEach(cls => {
      push(`    lc_${cls} = protocol.get_liquid_class("${cls}")`);
    });
    push();
  }

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
    const useLiquidClass = !!lcName;

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
        push(`        location=${srcV}["${step.sourceWell}"].meniscus(z=${step.meniscusOffset||-5}, target="end"),`);
        push(`        liquid_class=lc_${lcName}`);
        push(`    )`);
      } else {
        push(`    ${pip}.flow_rate.aspirate = ${step.aspirateRate||150}`);
        push(`    ${pip}.flow_rate.dispense = ${step.dispenseRate||300}`);
        push(`    ${pip}.flow_rate.blow_out = ${step.blowoutRate||200}`);
        push(`    ${pip}.mix(${step.mixReps||3}, ${step.volume||50}, ${srcV}["${step.sourceWell}"].meniscus(z=${step.meniscusOffset||-5}, target="end"))`);
        push(`    ${pip}.blow_out(${srcV}["${step.sourceWell}"].top(${step.blowoutTopOffset||-2}))`);
      }

      if (keepTip) { push(`    # Tip retained — carrying into step ${i+2}`); tipCarried[step.pipette] = true; }
      else { push(`    ${pip}.drop_tip()`); tipCarried[step.pipette] = false; }
      push(); return;
    }

    // ── Transfer step ─────────────────────────────────────────────────────────
    if (!step.destSlot) { push(`    # Step ${i+1}: INCOMPLETE — skipped`); push(); return; }

    // Build dest list — each dest carries its own resolved volume
    // dst.volume overrides step.volume; fall back to step.volume if not set
    const primaryDest = {
      slot: step.destSlot,
      well: step.destWell,
      volume: (step.destVolume != null && step.destVolume !== "") ? Number(step.destVolume) : (step.volume || 0),
    };
    const allDests = [
      primaryDest,
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

    // ── Liquid class path ─────────────────────────────────────────────────────
    if (useLiquidClass) {
      if (!incomingTip && (tipPolicy === "one_total" || tipPolicy === "one_per_source")) {
        push(`    ${pip}.pick_up_tip()`);
      } else if (incomingTip) {
        push(`    # Tip carried in from previous step`);
      }

      // If all volumes are the same, use scalar; otherwise per-dest calls
      const validDests = allDests.filter(d => d.slot && d.well);
      const allSameVol = validDests.every(d => d.volume === validDests[0].volume);

      if (allSameVol || validDests.length === 1) {
        const destList = validDests.map(d => `${lwVar(d.slot)}["${d.well}"]`).join(", ");
        push(`    ${pip}.transfer_with_liquid_class(`);
        push(`        volume=${validDests[0].volume},`);
        push(`        source=${srcV}["${step.sourceWell}"],`);
        push(`        dest=${validDests.length === 1 ? destList : `[${destList}]`},`);
        push(`        liquid_class=lc_${lcName},`);
        push(`        new_tip="${tipPolicy === "new_each" ? "always" : "never"}",`);
        if (liquidSensing) push(`        liquid_presence_detection=True,`);
        push(`    )`);
      } else {
        // Different volumes — emit one transfer_with_liquid_class per dest
        push(`    # Different volumes per destination — emitting individual transfers`);
        validDests.forEach((dst, di) => {
          if (tipPolicy === "new_each") {
            if (di === 0 && incomingTip) push(`    # Tip carried in from previous step`);
            else push(`    ${pip}.pick_up_tip()`);
          }
          push(`    ${pip}.transfer_with_liquid_class(`);
          push(`        volume=${dst.volume},`);
          push(`        source=${srcV}["${step.sourceWell}"],`);
          push(`        dest=${lwVar(dst.slot)}["${dst.well}"],`);
          push(`        liquid_class=lc_${lcName},`);
          push(`        new_tip="never",`);
          if (liquidSensing) push(`        liquid_presence_detection=True,`);
          push(`    )`);
          if (tipPolicy === "new_each") {
            const isLast = di === validDests.length - 1;
            if (isLast && keepTip) { push(`    # Tip retained — carrying into step ${i+2}`); tipCarried[step.pipette] = true; }
            else push(`    ${pip}.drop_tip()`);
          }
        });
      }

      if (tipPolicy !== "new_each") {
        if (keepTip) { push(`    # Tip retained — carrying into step ${i+2}`); tipCarried[step.pipette] = true; }
        else { push(`    ${pip}.drop_tip()`); tipCarried[step.pipette] = false; }
      } else if (!allSameVol || validDests.length <= 1) {
        // already handled per-dest above
      } else {
        tipCarried[step.pipette] = false;
      }

      push(); return;
    }

    // ── Manual path ───────────────────────────────────────────────────────────
    push(`    ${pip}.flow_rate.aspirate = ${step.aspirateRate||150}`);
    push(`    ${pip}.flow_rate.dispense = ${step.dispenseRate||300}`);
    push(`    ${pip}.flow_rate.blow_out = ${step.blowoutRate||200}`);

    if (tipPolicy === "one_total" || tipPolicy === "one_per_source") {
      if (!incomingTip) push(`    ${pip}.pick_up_tip()`);
      else push(`    # Tip carried in from previous step`);
      if (liquidSensing) push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
      if (step.prewet) emitPrewet(L, pip, srcV, step.sourceWell, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing);
    }

    allDests.forEach((dst, di) => {
      if (!dst.slot || !dst.well) return;
      const dstV       = lwVar(dst.slot);
      const dstW       = dst.well;
      // Use this dest's resolved volume
      const totalVol   = dst.volume;
      const trips      = Math.ceil(totalVol / Math.max(1, maxVol - airGap));
      const volPerTrip = totalVol / trips;

      const aspirateLoc = liquidSensing
        ? `${srcV}["${step.sourceWell}"].meniscus(z=${menOffset}, target="end")`
        : `${srcV}["${step.sourceWell}"].bottom(5)`;

      if (tipPolicy === "new_each") {
        if (di === 0 && incomingTip) push(`    # Tip carried in from previous step`);
        else push(`    ${pip}.pick_up_tip()`);
        if (liquidSensing && (step.remeasureEachAsp || di === 0))
          push(`    ${pip}.measure_liquid_height(${srcV}["${step.sourceWell}"])`);
        if (di === 0 && step.prewet) emitPrewet(L, pip, srcV, step.sourceWell, maxVol, menOffset, dispOffset, blowOffset, delayAsp, delayDisp, liquidSensing);
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
        if (airGap > 0)    push(`        ${pip}.air_gap(${airGap})`);
        push(`        ${pip}.dispense(${fmt(volPerTrip + airGap)}, ${dispLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`        protocol.delay(seconds=${delayDisp})`);
        push(`        ${pip}.blow_out(${blowLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`        protocol.delay(seconds=${delayDisp})`);
        if (step.touchTip) push(`        ${pip}.touch_tip(${dstV}["${dstW}"], v_offset=-2, radius=0.9, speed=20)`);
      } else {
        if (aspKwargs.length) {
          push(`    ${pip}.aspirate(${fmt(totalVol)}, ${aspirateLoc}, rate=1.0, ${aspKwargs.join(", ")})`);
        } else {
          push(`    ${pip}.aspirate(${fmt(totalVol)}, ${aspirateLoc}, rate=1.0)`);
        }
        if (delayAsp > 0)  push(`    protocol.delay(seconds=${delayAsp})`);
        if (airGap > 0)    push(`    ${pip}.air_gap(${airGap})`);
        push(`    ${pip}.dispense(${fmt(totalVol + airGap)}, ${dispLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`    protocol.delay(seconds=${delayDisp})`);
        push(`    ${pip}.blow_out(${blowLocation(dstV, dstW)})`);
        if (delayDisp > 0) push(`    protocol.delay(seconds=${delayDisp})`);
        if (step.touchTip) push(`    ${pip}.touch_tip(${dstV}["${dstW}"], v_offset=-2, radius=0.9, speed=20)`);
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
    ? `${srcV}["${srcW}"].meniscus(z=${menOffset}, target="end")`
    : `${srcV}["${srcW}"].bottom(5)`;
  L.push(`    # Pre-wet`);
  L.push(`    ${pip}.aspirate(${pw}, ${aspirateLoc}, rate=1.0)`);
  if (delayAsp > 0) L.push(`    protocol.delay(seconds=${delayAsp})`);
  L.push(`    ${pip}.dispense(${pw}, ${srcV}["${srcW}"].top(${dispOffset}))`);
  L.push(`    ${pip}.blow_out(${srcV}["${srcW}"].top(${blowOffset}))`);
  if (delayDisp > 0) L.push(`    protocol.delay(seconds=${delayDisp})`);
}

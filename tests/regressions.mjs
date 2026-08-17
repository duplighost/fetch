// regressions.mjs -- focused laws restored during the Codex polish pass.
//
// This suite deliberately complements (rather than duplicates) autotest and the
// full playthrough. Each scenario boots a fresh ?test=1 page, advances only the
// deterministic fixed-step simulation, and probes the real system-Chrome build.
//
// Run: node tests/regressions.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const report = {
  url: `${URL_BASE}/?test=1&mute=1`,
  scenarios: [],
  checks: [],
  browserErrors: [],
  assumptions: [
    'window.__game remains the test-only white-box companion to window.__FETCH',
    'hard act teleports are setup only; progression assertions use zone updates or real movement',
    'set-piece callbacks are invoked exactly as the skull hit dispatcher invokes them',
  ],
};

function record(scenario, check) {
  const item = {
    scenario,
    name: check.name,
    passed: check.skipped ? true : !!check.passed,
    skipped: !!check.skipped,
    details: check.details ?? null,
  };
  report.checks.push(item);
  const status = item.skipped ? 'SKIP' : item.passed ? 'PASS' : 'FAIL';
  console.log(` ${status} ${scenario}: ${item.name}`
    + (item.details == null ? '' : ` -- ${JSON.stringify(item.details)}`));
}

const server = await ensureServer();
const browser = await launchBrowser();

async function scenario(name, evaluate) {
  const startedAt = Date.now();
  let page = null;
  let errors = [];
  try {
    const opened = await openPage(browser, report.url);
    page = opened.page;
    errors = opened.errors;
    await page.waitForFunction(
      () => window.__FETCH && window.__FETCH.ready === true && window.__game,
      null,
      // 300s: boots take 24-45s when a concurrent agent's test battery owns
      // the GPU (see HANDOFF 2026-08-14). Wall-clock slowness is not failure.
      { timeout: 300000, polling: 100 },
    );
    const result = await page.evaluate(evaluate);
    for (const check of result.checks || []) record(name, check);
    if (result.diagnostics != null) {
      report.scenarios.push({ name, diagnostics: result.diagnostics, elapsedMs: Date.now() - startedAt });
    } else {
      report.scenarios.push({ name, diagnostics: null, elapsedMs: Date.now() - startedAt });
    }
    record(name, {
      name: 'zero browser errors',
      passed: errors.length === 0,
      details: errors.length ? errors.slice() : null,
    });
    report.browserErrors.push(...errors.map((error) => ({ scenario: name, error })));
  } catch (error) {
    const details = error && (error.stack || error.message) || String(error);
    record(name, { name: 'scenario completed without exception', passed: false, details });
    report.scenarios.push({ name, exception: details, elapsedMs: Date.now() - startedAt });
    report.browserErrors.push(...errors.map((entry) => ({ scenario: name, error: entry })));
  } finally {
    await page?.close().catch(() => {});
  }
}

try {
  await scenario('skull-growth-law', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const FIXED_DT = 1 / 120;

    F.start();
    // THE NEW OPENING: a fresh boot wakes empty-handed; the skull arrives by
    // shattering the bedroom window only after the bell is found and rung.
    // This scenario is about the throw/growth laws, not the arrival — jump
    // through the canonical test contract (a hard teleport completes the
    // arrival silently and hands over the skull) before exercising the
    // grammar. The arrival itself is asserted by the bedroom-arrival
    // scenarios below and by the playthrough's act-0 beats.
    F.teleport('bedroom');
    F.stepWith(FIXED_DT, {}, false);

    const skull = g.skull;
    const metadata = {
      requestedVariant: skull.variant,
      rootName: skull.root.name,
      variant: skull.root.userData.variant,
      source: skull.root.userData.source,
      triangleCount: skull.root.userData.triangleCount,
      triangleBudget: skull.root.userData.triangleBudget,
    };
    // The realism rounds are resolved: the continuous anatomical shell is the
    // shipping sculpt. Named comparison variants (including v0) remain opt-in.
    check(
      'default query ships the continuous anatomical shell',
      skull.variant === 'e' && skull.root.name === 'skull'
        && skull.root.userData.variant === 'e'
        && skull.root.userData.source === 'real-shell'
        && skull.root.userData.triangleCount <= skull.root.userData.triangleBudget,
      metadata,
    );
    check(
      'shipping skull rig is complete (jaw, mount, sockets, eyes, stages)',
      !!skull.jaw && !!skull.jawMount && Array.isArray(skull.sockets)
        && skull.sockets.length >= 2 && !!skull.eyeL && !!skull.eyeR
        && Array.isArray(skull.stageSets) && skull.stageSets.length === 6,
      { sockets: skull.sockets?.length, stageSets: skull.stageSets?.length },
    );

    // Exercise the real press/hold/release path before changing growth state.
    // The filament and the last-hand-span settle are presentation, but they
    // must follow the sacred input grammar instead of inventing a second mode.
    F.stepWith(FIXED_DT, { throwPressed: true, throwHeld: true }, false);
    const tetherAttr = skull.tether.geometry.getAttribute('position');
    const tetherFinite = Array.from(tetherAttr.array).every(Number.isFinite);
    check(
      'a held throw draws one finite depth-tested tether from hands to skull',
      skull.mode === 'outbound'
        && skull.tether.visible
        && skull.tether.material.depthWrite === false
        && skull.tether.material.opacity > 0
        && tetherFinite,
      {
        mode: skull.mode,
        visible: skull.tether.visible,
        opacity: skull.tether.material.opacity,
        points: tetherAttr.count,
        finite: tetherFinite,
      },
    );
    F.stepWith(FIXED_DT, { throwReleased: true }, false);
    for (let i = 0; i < 300 && skull.mode !== 'held'; i++) {
      F.stepWith(FIXED_DT, {}, false);
    }
    const caughtWithSettle = skull.mode === 'held' && !!skull._catchFx;
    check(
      'ordinary release catches into an animated hand-span settle and hides the tether',
      caughtWithSettle && !skull.tether.visible && skull._grip < 0.2,
      {
        mode: skull.mode,
        settle: skull._catchFx ? { t: skull._catchFx.t, dur: skull._catchFx.dur } : null,
        tetherVisible: skull.tether.visible,
        grip: skull._grip,
      },
    );
    check(
      'ordinary catch adds no global hit stop or input-freezing delay',
      g.hitStop <= 0,
      { hitStop: g.hitStop, fovKick: g.fovKick },
    );
    F.stepWith(0.32, {}, false);
    check(
      'catch settle ends in the exact calibrated cradle without retaining hidden state',
      skull.mode === 'held'
        && !skull._catchFx
        && Math.hypot(skull.root.position.x, skull.root.position.y,
          skull.root.position.z - 0.02) < 0.0001,
      {
        mode: skull.mode,
        settleActive: !!skull._catchFx,
        root: skull.root.position.toArray(),
      },
    );

    skull.setStage(0);
    const originalSetStage = skull.setStage;
    let applications = 0;
    skull.setStage = function countedSetStage(stage) {
      applications += 1;
      return originalSetStage.call(this, stage);
    };

    try {
      skull.requestStage(3);
      F.stepWith(0.25, {}, false);
      check(
        'requested growth waits while the skull is held in the foreground',
        skull.stage === 0 && skull.pendingStage === 3 && applications === 0,
        { stage: skull.stage, pendingStage: skull.pendingStage, applications },
      );

      g.camera.updateMatrixWorld(true);
      const forward = g.camera.getWorldDirection(skull.pos.clone());
      const onScreen = g.camera.position.clone().addScaledVector(forward, 2.2);
      F.setSkull(onScreen.x, onScreen.y, onScreen.z, 0, 0, 0, 'outbound');
      skull.root.position.copy(onScreen);
      skull.root.updateMatrixWorld(true);
      const onScreenNdc = onScreen.clone().project(g.camera);
      F.stepWith(FIXED_DT, { throwHeld: true }, false);
      check(
        'requested growth also waits while an outbound skull is on-screen',
        Math.abs(onScreenNdc.x) < 1
          && Math.abs(onScreenNdc.y) < 1
          && onScreenNdc.z > -1
          && onScreenNdc.z < 1
          && skull.stage === 0
          && applications === 0,
        {
          ndc: [+onScreenNdc.x.toFixed(3), +onScreenNdc.y.toFixed(3), +onScreenNdc.z.toFixed(3)],
          stage: skull.stage,
          applications,
        },
      );

      const behind = g.camera.position.clone().addScaledVector(forward, -3);
      F.setSkull(behind.x, behind.y, behind.z, 0, 0, 0, 'outbound');
      skull.root.position.copy(behind);
      skull.root.updateMatrixWorld(true);
      F.stepWith(FIXED_DT, { throwHeld: true }, false);
      const firstUnseenApplications = applications;
      check(
        'pending growth applies exactly once when the skull becomes unseen',
        skull.stage === 3 && skull.pendingStage === 3 && firstUnseenApplications === 1,
        { stage: skull.stage, pendingStage: skull.pendingStage, applications },
      );

      F.stepWith(0.2, { throwHeld: true }, false);
      check(
        'an already-applied unseen stage is not re-applied on later steps',
        skull.stage === 3 && applications === firstUnseenApplications,
        { stage: skull.stage, applications },
      );

      skull.requestStage(5);
      skull.vanish();
      F.stepWith(FIXED_DT, {}, false);
      const firstGoneApplications = applications;
      F.stepWith(0.2, {}, false);
      check(
        'gone skull accepts its pending stage once, then remains stable',
        skull.mode === 'gone'
          && skull.stage === 5
          && skull.pendingStage === 5
          && firstGoneApplications === firstUnseenApplications + 1
          && applications === firstGoneApplications,
        {
          mode: skull.mode,
          stage: skull.stage,
          pendingStage: skull.pendingStage,
          applications,
        },
      );
      check(
        'final anatomical growth keeps the apertures open and retires the temporary nose',
        skull.sockets.every((socket) => socket.visible)
          && skull.stage5Hide.length >= 5
          && skull.stage5Hide.every((mesh) => !mesh.visible)
          && skull.eyeL.visible
          && skull.eyeR.visible,
        {
          sockets: skull.sockets.map((socket) => socket.visible),
          stage5Hidden: skull.stage5Hide.map((mesh) => !mesh.visible),
          eyes: [skull.eyeL.visible, skull.eyeR.visible],
        },
      );
    } finally {
      skull.setStage = originalSetStage;
    }

    return { checks, diagnostics: { metadata, finalStage: skull.stage, applications } };
  });

  await scenario('progression-gates', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const order = ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror'];

    F.start();
    F.teleport('graveyard');
    F.stepWith(1 / 120, {}, false);

    const earlierZone = g.world.zones.map((zone) => {
      const pos = {
        x: (zone.min.x + zone.max.x) / 2,
        y: (zone.min.y + zone.max.y) / 2,
        z: (zone.min.z + zone.max.z) / 2,
      };
      return { zone, pos, resolvesAs: g.world.zoneAt(pos) };
    }).find(({ zone, resolvesAs }) => order.indexOf(zone.name) >= 0
      && order.indexOf(zone.name) < order.indexOf('graveyard')
      && resolvesAs === zone.name);

    const actBeforeEarlierZone = g.act;
    if (earlierZone) {
      g.player.pos.set(earlierZone.pos.x, earlierZone.pos.y, earlierZone.pos.z);
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      g.director.update(1 / 120);
    }
    check(
      'entering an earlier authored zone cannot move story progression backward',
      !!earlierZone && actBeforeEarlierZone === 'graveyard' && g.act === 'graveyard',
      {
        sampledZone: earlierZone?.zone.name ?? null,
        zoneAtPlayer: earlierZone ? g.world.zoneAt(g.player.pos) : null,
        before: actBeforeEarlierZone,
        after: g.act,
      },
    );

    F.teleport('clearing');
    F.stepWith(1 / 120, {}, false);
    const basin = g.clearingBasin;
    const poolRadius = g.clearingPool?.userData.radius;
    check(
      'visible plunge-pool water covers the full mathematical basin',
      !!basin && Number.isFinite(poolRadius) && poolRadius >= basin.outerR + 0.2,
      { poolRadius: poolRadius ?? null, basinOuterRadius: basin?.outerR ?? null },
    );
    const caveCenter = {
      x: (g.caveZone.min.x + g.caveZone.max.x) / 2,
      y: (g.caveZone.min.y + g.caveZone.max.y) / 2,
      z: (g.caveZone.min.z + g.caveZone.max.z) / 2,
    };
    check(
      'cave story zone is disabled until the waterfall takes the skull',
      !g.flags.has('waterfallTaken')
        && g.caveZone.enabled === false
        && g.world.zoneAt(caveCenter) !== 'cave',
      {
        waterfallTaken: g.flags.has('waterfallTaken'),
        caveEnabled: g.caveZone.enabled,
        resolvedZone: g.world.zoneAt(caveCenter),
      },
    );

    const C = g.clearingCenter;
    const startZ = C.z + 6;
    const startY = g.world.groundHeightAt(C.x, startZ, 10);
    g.player.pos.set(C.x, startY, startZ);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player.frozen = false;
    g.player.movementLocked = false;
    g.player.yaw = Math.PI;
    g.player.pitch = 0;
    g.player._sync(0);
    F.stepWith(4, { moveZ: 1, run: true }, false);
    const barrierStop = {
      z: g.player.pos.z,
      barrierMinZ: g.bridgeBarrier.min.z,
      act: g.act,
      dead: g.dead,
    };
    check(
      'simulated forward movement cannot reach the cave before the bargain',
      g.act === 'clearing'
        && g.player.pos.z < g.caveZone.min.z
        // The authored outcome is physical, not an invisible stop: walking
        // into the unbridged plunge pool kills; stopping before its far lip is
        // also acceptable if geometry catches a different frame cadence.
        && (g.dead || g.player.pos.z < g.bridgeBarrier.min.z - 0.1),
      barrierStop,
    );

    const hatch = g.world.interactables.find((object) => object.userData.inter?.id === 'caveHatch');
    const previousAct = g.act;
    if (hatch) {
      // Isolate the redundant hatch guard: even an illegally injected cave act
      // must not bypass the missing waterfall flag.
      g.act = 'cave';
      hatch.userData.inter.action(g);
      F.stepWith(2, {}, false);
    }
    check(
      'cave hatch independently rejects use without waterfallTaken',
      !!hatch
        && !g.flags.has('waterfallTaken')
        && !g.finale.active
        && !g.flags.has('ended'),
      {
        hatchFound: !!hatch,
        injectedAct: hatch ? 'cave' : null,
        previousAct,
        finaleActive: g.finale.active,
        ended: g.flags.has('ended'),
      },
    );

    return { checks, diagnostics: { earlierZone: earlierZone?.zone.name ?? null, barrierStop } };
  });

  await scenario('input-and-no-hud', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const skip = (name, details) => checks.push({ name, skipped: true, details });

    // OUR crosshair decision: a wordless 4px dot that brightens on target —
    // the one aim affordance, state carried via dataset, no words ever.
    const crosshair = document.getElementById('crosshair');
    check(
      'crosshair is the wordless dot (exists, textless, state via dataset)',
      !!crosshair && crosshair.textContent.trim() === ''
        && 'target' in crosshair.dataset && 'skull' in crosshair.dataset,
      {
        found: !!crosshair,
        text: crosshair?.textContent ?? null,
        dataset: crosshair ? { ...crosshair.dataset } : null,
      },
    );

    if (!g.input || typeof g.input.clearKeys !== 'function' || typeof g.input.frame !== 'function') {
      skip('clearKeys converts a lost held button into one release edge', 'InputState is not exposed to the test page');
    } else {
      g.input.keys.add('KeyW');
      g.input.throwHeld = true;
      g.input.pending.throwReleased = false;
      g.input.clearKeys();
      const first = g.input.frame(true);
      const second = g.input.frame(true);
      check(
        'clearKeys converts a lost held button into one release edge',
        g.input.keys.size === 0
          && g.input.throwHeld === false
          && first.throwHeld === false
          && first.throwReleased === true
          && second.throwReleased === false,
        {
          keyCount: g.input.keys.size,
          throwHeld: g.input.throwHeld,
          firstRelease: first.throwReleased,
          secondRelease: second.throwReleased,
        },
      );
    }

    // Browser resume/test harnesses can surface a stale RAF timestamp. A
    // negative cosmetic delta used to increase the FOV kick until perspective
    // inverted past 180 degrees (the giant wedges/fisheye captures).
    const savedDt = g._lastShakeDt;
    const savedKick = g.fovKick;
    const savedShake = g._shake;
    g._lastShakeDt = undefined;
    g._shake = 0.24;
    g.render();
    const coldStartShake = g._shake;
    g._lastShakeDt = -20;
    g.fovKick = 0;
    g.render();
    const projection = g.camera.projectionMatrix.elements;
    check(
      'a stale negative render timestamp cannot invert the camera projection',
      g.camera.fov >= 70 && g.camera.fov <= 75
        && projection[0] > 0 && projection[5] > 0
        && Number.isFinite(coldStartShake) && coldStartShake < 0.24,
      {
        fov: g.camera.fov,
        projectionX: projection[0],
        projectionY: projection[5],
        coldStartShake,
      },
    );
    g._lastShakeDt = savedDt;
    g.fovKick = savedKick;
    g._shake = savedShake;

    // The physical lantern and the foreground cradle deliberately share a
    // transform but no longer share a lighting pass. Prove a catch/hold reset
    // cannot put the 58-cd world lamp back on the held layer and bleach hands.
    g.skull.holdNow();
    g.render();
    const heldMeshes = [];
    g.skull.hold.traverse((object) => { if (object.isMesh) heldMeshes.push(object.layers.mask); });
    check(
      'world lantern and held cradle remain isolated across a hold reset',
      g.skullLight.layers.mask === 1
        && heldMeshes.length > 20 && heldMeshes.every((mask) => mask === (1 << 2))
        && g.camera.layers.mask === ((1 << 0) | (1 << 2))
        && g.lastRender.drawCalls > 0 && g.lastRender.drawCalls < 700,
      {
        lightMask: g.skullLight.layers.mask,
        heldMeshes: heldMeshes.length,
        heldMasks: [...new Set(heldMeshes)],
        cameraMask: g.camera.layers.mask,
        drawCalls: g.lastRender.drawCalls,
      },
    );

    return { checks, diagnostics: { inputAccessible: !!g.input } };
  });

  await scenario('graveyard-attack-tokens', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    g.player.pos.set(2, g.world.groundHeightAt(2, 21, 2), 21);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(0.1, {}, false);
    g.enemies.clear((e) => e.graveArena);
    g.enemies._graveClaimRecovery = 0;

    const first = g.enemies.spawn('walker', 2.72, 21, 'chase');
    const second = g.enemies.spawn('walker', 6.5, 21, 'chase');
    first.graveArena = true;
    second.graveArena = true;
    F.stepWith(1 / 120, {}, false);

    const claimedNow = () => g.enemies.list.filter((e) => e.graveClaimed);
    check(
      'early wave owns exactly one persistent claimant',
      claimedNow().length === 1 && claimedNow()[0] === first,
      claimedNow().map((e) => ({ pressure: !!e.gravePressure, state: e.state })),
    );
    check(
      'Standing pressure figures never steal a wave token',
      !g.enemies.list.some((e) => e.gravePressure && e.graveClaimed),
    );
    g.player.running = false;
    const claimRecoveryBeforeStep = g.enemies._graveClaimRecovery;
    g.director.onPlayerStep('grass');
    check(
      'ordinary graveyard footsteps preserve the committed attack token',
      claimedNow().length === 1 && claimedNow()[0] === first
        && g.enemies._graveClaimRecovery === claimRecoveryBeforeStep,
      {
        claimed: claimedNow().map((e) => ({ state: e.state, x: e.pos.x, z: e.pos.z })),
        recoveryBefore: claimRecoveryBeforeStep,
        recoveryAfter: g.enemies._graveClaimRecovery,
      },
    );

    F.stepWith(0.08, {}, false);
    second.pos.set(2.12, second.pos.y, 21);
    F.stepWith(0.08, {}, false);
    check(
      'a committed strike keeps its token when another body becomes nearer',
      first.state === 'strike' && first.graveClaimed && !second.graveClaimed
        && claimedNow().length === 1,
      {
        first: { state: first.state, claimed: !!first.graveClaimed },
        second: { state: second.state, claimed: !!second.graveClaimed },
        count: claimedNow().length,
      },
    );

    second.pos.set(8, second.pos.y, 21);
    g.enemies.resonancePulse(first.pos.clone(), 0.65, 1.5);
    F.stepWith(0.2, {}, false);
    check(
      'quiet stun releases the token without immediate reassignment',
      first.state === 'stunned' && claimedNow().length === 0
        && g.enemies._graveClaimRecovery > 0,
      { state: first.state, claimed: claimedNow().length, recovery: g.enemies._graveClaimRecovery },
    );
    const recoveryAfterStun = g.enemies._graveClaimRecovery;
    g.director.onPlayerStep('grass');
    check(
      'ordinary graveyard footsteps preserve the post-stun recovery breath',
      claimedNow().length === 0 && g.enemies._graveClaimRecovery === recoveryAfterStun,
      {
        claimed: claimedNow().length,
        recoveryBefore: recoveryAfterStun,
        recoveryAfter: g.enemies._graveClaimRecovery,
      },
    );

    F.stepWith(0.6, {}, false);
    check(
      'a new attacker claims only after the recovery breath',
      claimedNow().length === 1 && !claimedNow()[0].gravePressure,
      claimedNow().map((e) => ({ state: e.state, pressure: !!e.gravePressure })),
    );

    return {
      checks,
      diagnostics: {
        recovery: g.enemies._graveClaimRecovery,
        claimed: claimedNow().map((e) => ({ state: e.state, x: e.pos.x, z: e.pos.z })),
      },
    };
  });

  await scenario('ossuary-climb', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.2, {}, false);
    g.ossuary.unlock('regression');
    g.skull.holdNow();
    const m = g.ritualMausoleum;
    g.player.pos.set(m.x, 0.04, m.z + 0.4);
    g.player._sync(0);
    F.stepWith(0.3, {});
    check('the mausoleum throat swaps into the district',
      g.ossuary.inOssuary === true, { pos: g.player.pos.toArray().map((v) => +v.toFixed(1)) });
    check('the resident is the real Standing Kind, spared by the district seal',
      !!g.ossuary.resident && g.enemies.list.includes(g.ossuary.resident)
      && g.ossuary.resident.standing === true
      && g.ossuary.resident.mesh.userData.keepInOssuary === true
      && g.ossuary.resident.mesh.visible === true
      && g.world.lightRoot.visible === true,
      { state: g.ossuary.resident?.state });

    // force the solve exactly the way the director restore does: exitT is
    // the ONE number, and it must seat slab + hatch + arrival together
    g.ossuary.solved = true;
    g.ossuary.exitT = 1;
    F.stepWith(0.4, {});
    // The slab still sinks off exitT. The far end does NOT: the forest has one
    // door now — the three-key gate — so the deck hatch is chained shut for
    // good and its verb can never be live. Sealed scenery, and the pin says so.
    check('a forced restore sinks the slab and leaves the far hatch chained',
      g.ossuary.exitCollider.max.y === g.ossuary.exitCollider.min.y
      && g.ossuary.lidPivot.rotation.x < 0.02
      && g.ossuary.arrival.pivot.rotation.x > -0.02,
      { lid: +g.ossuary.lidPivot.rotation.x.toFixed(2),
        arrival: +g.ossuary.arrival.pivot.rotation.x.toFixed(2) });

    // the climb is driven by INPUT only; y rises through real ground contact.
    // The corridor's three baffles alternate sides — slalom them the way the
    // playthrough bot does, then take flight A, the turn, and flight B.
    const OX = g.ossuary.origin.x;
    const OZ = g.ossuary.origin.z;
    const waypoints = [
      [OX + 1.8, OZ + 8.6], [OX - 1.8, OZ + 15.6], [OX + 1.8, OZ + 23.2],
      [OX + 1.75, OZ + 30.2], [OX + 1.75, OZ + 33.6], [OX - 2.45, OZ + 34.65],
    ];
    const samples = [];
    let regressed = 0;
    let wp = 0;
    const atTop = () => g.player.pos.y > g.ossuary.origin.floor + 3.05
      && g.player.pos.x < OX - 2.0 && g.player.pos.z > OZ + 33.9;
    for (let t = 0; t < 40 && !atTop(); t += 0.1) {
      const p = g.player.pos;
      const target = waypoints[Math.min(wp, waypoints.length - 1)];
      const dx = target[0] - p.x;
      const dz = target[1] - p.z;
      if (Math.hypot(dx, dz) < 0.8 && wp < waypoints.length - 1) wp++;
      g.player.yaw = Math.atan2(-dx, -dz);
      F.stepWith(0.1, { moveZ: 1 });
      const y = g.player.pos.y;
      if (samples.length && y < samples[samples.length - 1] - 0.3) regressed++;
      samples.push(+y.toFixed(2));
    }
    // The shaft is still a real climb — the flights, the turn, the platform,
    // all reached by ground contact — it just does not lead OUT any more. So
    // the pin keeps the thing worth keeping (a monotonic rise driven by input
    // alone) and adds the seal: at the top, the mouth refuses.
    const mx = OX - 2.45, mz = OZ + 34.75;
    const my = g.ossuary.origin.floor + 5.43;
    const dxT = mx - g.player.pos.x, dzT = mz - g.player.pos.z;
    g.player.yaw = Math.atan2(-dxT, -dzT);
    g.player.pitch = Math.max(-1.15, Math.min(1.15,
      Math.atan2(my - (g.player.pos.y + 1.62), Math.hypot(dxT, dzT) || 0.001)));
    g.player._sync(0);
    F.stepWith(1 / 120, { interactPressed: true });
    F.stepWith(0.3, {});
    const peak = Math.max(...samples);
    check('the shaft is still a grounded climb, and the hatch at the top is shut',
      peak > g.ossuary.origin.floor + 3.0 && regressed === 0
      && !g.flags.has('ossuaryExited') && g.act === 'graveyard' && g.ossuary.inOssuary,
      { peak, regressed, act: g.act, exited: g.flags.has('ossuaryExited') });

    return { checks, diagnostics: { climbTail: samples.slice(-10) } };
  });

  await scenario('ossuary-kennel', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.2, {}, false);
    g.ossuary.unlock('regression');
    g.skull.holdNow();
    const m = g.ritualMausoleum;
    g.player.pos.set(m.x, 0.04, m.z + 0.4);
    g.player._sync(0);
    F.stepWith(0.3, {});
    const OX = g.ossuary.origin.x;
    const OZ = g.ossuary.origin.z;
    const FLOOR = g.ossuary.origin.floor;

    // stand at the west pocket mouth and throw at the cradle behind the bars
    g.player.pos.set(OX - 2.6, FLOOR, OZ + 12);
    const cradleY = FLOOR + 1.02;
    const dx = (OX - 4.75) - g.player.pos.x;
    const dz = (OZ + 12) - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(cradleY - (g.player.pos.y + 1.62), Math.hypot(dx, dz));
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
    for (let k = 0; k < 150 && g.skull.mode !== 'anchored'; k++) {
      F.stepWith(1 / 60, { throwHeld: true });
    }
    check('the cradle catches an outbound skull through the bars',
      g.skull.mode === 'anchored' && g.skull.anchor?.puzzleId === 'ossuaryKennel',
      { mode: g.skull.mode });
    F.stepWith(1.5, { throwHeld: true });
    check('a held weight raises the shutter and latches the kennel',
      g.flags.has('ossuaryKennelSolved') && g.ossuaryKennel.solved
      && g.ossuaryKennel.shutter.position.y > FLOOR + 2.2,
      { shutterY: +g.ossuaryKennel.shutter.position.y.toFixed(2) });
    F.stepWith(1 / 120, { throwReleased: true });
    for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {});
    check('the skull returns home through the bars', g.skull.mode === 'held',
      { mode: g.skull.mode });
    for (let t = 0; t < 2; t += 0.1) {
      g.player.yaw = Math.PI / 2;
      F.stepWith(0.1, { moveZ: 1 });
    }
    check('the bars still stop the player after the solve',
      g.player.pos.x > OX - 3.8, { x: +g.player.pos.x.toFixed(2) });

    return { checks, diagnostics: null };
  });

  await scenario('marrow-descent', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.2, {}, false);
    g.flag('graveyardResolved');   // the yard's business is done; the pit wakes
    g.skull.holdNow();
    F.stepWith(0.3, {}, false);
    check('the pit mouth offers its verb once the marrow is open',
      g.marrowPit && g.marrowPit.pit.userData.inter?.enabled === true
      && g.marrowPit.collider.max.y > g.marrowPit.collider.min.y,
      { enabled: g.marrowPit?.pit?.userData?.inter?.enabled });
    // descending is USED now, never walked-over: stand at the lip, look
    // into the mouth, E
    // the mouth moved under the sealed mausoleum, where the funeral unseals
    // it — read it off game.marrowPit rather than pinning the old coordinates
    const MO = g.marrowPit;
    g.player.pos.set(MO.x, 0.05, MO.z - 1.25);
    g.player.vel.set(0, 0, 0);
    g.player.yaw = Math.PI;
    g.player.pitch = Math.atan2(0.02 - (0.05 + 1.62), 1.25);
    g.player._sync(0);
    F.stepWith(1 / 120, { interactPressed: true });
    F.stepWith(0.3, {});
    const M = g.marrow;
    check('using the mouth descends into the marrow',
      M.inMarrow === true && g.flags.has('marrow:entered') && g.flags.has('marrow:witnessed'),
      { pos: g.player.pos.toArray().map((v) => +v.toFixed(1)) });
    // the palette EASES in now (fog is a weather system, never a snap), so
    // assert proximity to the crypt colour rather than exact hex equality
    F.stepWith(2.5, {});
    // compare in sRGB bytes (getHex), not the linear-light channel floats
    const fogHex = g.scene.fog.color.getHex();
    const nearCrypt = Math.abs(((fogHex >> 16) & 255) - 0x16) < 14
      && Math.abs(((fogHex >> 8) & 255) - 0x06) < 14
      && Math.abs((fogHex & 255) - 0x11) < 14;
    check('the marrow wears its own palette while fetch waits above',
      g.scene.fog && nearCrypt,
      { fog: fogHex.toString(16) });
    // let the introduction play out: it claws up, stares, folds away, and is
    // already waiting at the altar
    F.stepWith(6.0, {});
    const P = M.presence.group;
    check('after the introduction the presence guards the altar',
      P.visible === true && Math.abs(P.position.z - (M.origin.z + 26 - 3.6)) < 0.5,
      { at: P.position.toArray().map((v) => +v.toFixed(1)) });

    // the skull passes THROUGH it: your verb is not from its game
    g.player.pos.set(M.origin.x, M.origin.floor, M.origin.z + 17);
    const dxT = P.position.x - g.player.pos.x;
    const dzT = P.position.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dxT, -dzT);
    g.player.pitch = Math.atan2(1.3 - 1.62, Math.hypot(dxT, dzT));
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
    F.stepWith(1.2, { throwHeld: true });
    F.stepWith(1 / 120, { throwReleased: true });
    for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {});
    check('a thrown skull passes through the guardian and comes home',
      g.skull.mode === 'held' && P.visible === true && M.yielded === false,
      { mode: g.skull.mode, visible: P.visible });

    // MARROW's way: walk into the loom until it yields
    for (let t = 0; t < 8 && !M.yielded; t += 0.1) {
      const dx = P.position.x - g.player.pos.x;
      const dz = P.position.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      F.stepWith(0.1, { moveZ: 1 });
    }
    F.stepWith(2.0, {});
    check('walking into the loom makes the guardian yield through the floor',
      M.yielded === true && g.flags.has('marrow:guardianYielded'),
      { dist: +M.guardianDist.toFixed(2) });

    // the altar holds GATE KEY 2 and nothing else now — the relic went up to
    // the yard's hero grave beside the canine — and one throw takes it
    const key2 = g.gateKeys.list[1];
    check('the altar holds only the key, and the guardian was the lock',
      key2.revealed === true && key2.target.enabled === true
      && !g.scene.getObjectByName('the relic'),
      { revealed: key2.revealed, fetchable: key2.target.enabled });
    g.player.pos.set(M.origin.x, M.origin.floor, M.origin.z + 26 - 4.6);
    const keyY = M.origin.floor + 1.24;
    const dz2 = (M.origin.z + 26 - 2.2) - g.player.pos.z;
    g.player.yaw = Math.atan2(0, -dz2);
    g.player.pitch = Math.atan2(keyY - (g.player.pos.y + 1.62), Math.abs(dz2));
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
    F.stepWith(0.8, { throwHeld: true });
    F.stepWith(1 / 120, { throwReleased: true });
    for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {});
    check('the key is taken and rides in the skull jaw',
      g.flags.has('gotgateKey2') && g.skull.carry?.id === 'gateKey2',
      { carry: g.skull.carry ? g.skull.carry.id : null });

    // the theft breaks the truce: while unobserved the mourners DASH.
    // Hunting began the moment the key left the altar, so first re-seat
    // every statue at its post for a known board. st0 is the subject of
    // every check; the other three park at the far end (the player faces
    // them while st0 works from behind) or four simultaneous hunters end
    // the test before the throw leg.
    const st0 = M.statues[0];
    for (const st of M.statues) {
      st.position.copy(st.userData.home);
      st.userData.stagger = 0;
    }
    for (const st of M.statues.slice(1)) {
      st.position.set(M.origin.x + 3.2, M.origin.floor, M.origin.z + 24.8);
    }
    const preDash = st0.position.clone();
    g.player.pos.set(M.origin.x, M.origin.floor, M.origin.z + 13);
    g.player.vel.set(0, 0, 0);
    g.player.yaw = Math.PI;   // facing up-hall; statue 0 is behind, unseen
    g.player.pitch = 0;
    g.player._sync(0);
    F.stepWith(1.0, {});
    const advanced = preDash.distanceTo(st0.position);
    check('after the theft an unobserved statue closes the distance fast',
      advanced > 1.2, { advanced: +advanced.toFixed(2) });

    // watched, it freezes mid-hunt
    const preWatch = st0.position.clone();
    const dxs = st0.position.x - g.player.pos.x;
    const dzs = st0.position.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dxs, -dzs);
    g.player._sync(0);
    F.stepWith(0.8, {});
    check('a watched statue freezes mid-hunt',
      preWatch.distanceTo(st0.position) < 0.05,
      { moved: +preWatch.distanceTo(st0.position).toFixed(3) });

    // the skull's hit shoves marble like any other creature
    const preHit = st0.position.clone();
    let minSd = 99;
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
    for (let i = 0; i < 60; i++) {
      F.step(1 / 120, 1, false);
      minSd = Math.min(minSd,
        Math.hypot(g.skull.pos.x - st0.position.x, g.skull.pos.z - st0.position.z));
    }
    F.stepWith(1 / 120, { throwReleased: true });
    for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {});
    const shoved = preHit.distanceTo(st0.position);
    check('a skull hit staggers the hunter back',
      shoved > 0.8, { shoved: +shoved.toFixed(2), minSd: +minSd.toFixed(2) });

    // and you cannot let them get you
    const dxa = st0.position.x - g.player.pos.x;
    const dza = st0.position.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dxa, -dza) + Math.PI;   // look away again
    g.player._sync(0);
    for (let t = 0; t < 6 && !g.dead; t += 0.1) F.stepWith(0.1, {});
    check('letting a mourner reach you is the end', g.dead === true, { dead: g.dead });

    g.director.respawn();
    F.stepWith(0.5, {});
    check('respawn stands you back up inside the marrow with the mourners reposted',
      M.inMarrow === true && !g.dead
      && M.statues[0].position.distanceTo(M.statues[0].userData.home) < 0.05,
      { pos: g.player.pos.toArray().map((v) => +v.toFixed(1)) });

    // leave: E on the hanging bone toggle; the surface takes its air back
    g.player.pos.set(M.origin.x, M.origin.floor, M.origin.z + 2.2);
    g.player.vel.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = -0.06;
    g.player._sync(0);
    F.stepWith(1 / 120, { interactPressed: true });
    F.stepWith(0.4, {});
    check('using the way-up toggle surfaces beside the grave and restores the fog',
      M.inMarrow === false && g.act === 'graveyard'
      && g.scene.fog.color.getHex() !== 0x160611,
      { pos: g.player.pos.toArray().map((v) => +v.toFixed(1)) });

    return { checks, diagnostics: { escorted: g.flags.has('marrow:escorted') } };
  });

  await scenario('forest-mouth-boundary', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('forest');
    F.stepWith(1 / 120, {}, false);
    const forest = g.forest;
    const last = forest.samples[forest.length - 1];
    const half = forest.halfW[forest.length - 1];

    // A point beside the final sample used to inherit s=last and bypass every
    // clamp, leaving the clearing end of the forest open to empty space.
    forest._lastIdx = forest.length - 1;
    const side = g.player.pos.clone().set(
      last.x + -last.tz * (half + 15),
      0,
      last.z + last.tx * (half + 15),
    );
    forest.clampPlayer(side, 1 / 120);
    const sideProjection = forest.project(side.x, side.z);
    check(
      'final forest side remains authoritative even after a very large lateral breach',
      !!sideProjection && Math.abs(sideProjection.lat) <= half - 0.15,
      { beforeLat: half + 15, afterLat: sideProjection?.lat ?? null, half },
    );

    // The authored mouth itself must still release forward into the clearing.
    const exit = g.player.pos.clone().set(
      last.x + last.tx * 2.5,
      0,
      last.z + last.tz * 2.5,
    );
    const before = exit.clone();
    forest.clampPlayer(exit, 1 / 120);
    check(
      'the narrow forward mouth still releases into the clearing',
      exit.distanceTo(before) < 0.0001,
      { moved: exit.distanceTo(before), exit: [exit.x, exit.z] },
    );

    F.teleport('mirror');
    const mirrorBefore = g.player.pos.clone();
    forest.clampPlayer(g.player.pos, 1 / 120);
    check(
      'forest post-clamp never rewrites the distant mirror room',
      g.act === 'mirror' && g.player.pos.distanceTo(mirrorBefore) < 0.0001,
      {
        act: g.act,
        before: [mirrorBefore.x, mirrorBefore.y, mirrorBefore.z],
        after: [g.player.pos.x, g.player.pos.y, g.player.pos.z],
      },
    );

    return { checks, diagnostics: { sideLat: sideProjection?.lat ?? null, half } };
  });

  await scenario('forest-chain', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('forest');
    F.stepWith(1 / 120, {}, false);
    const forest = g.forest;

    // (a) THE CHAIN IS NEVER THE ONLY ROUTE. Walk the whole chain run on foot
    // with no throws: a missed link must be a landing, never a soft-lock.
    const startPos = forest.posAt(160, 0);
    g.player.pos.set(startPos.x, forest.heightAt(startPos.x, startPos.z), startPos.z);
    forest.recentre(g.player.pos);
    g.player._sync(0);
    for (let t = 0; t < 30; t += 0.1) {
      const pr = forest.project(g.player.pos.x, g.player.pos.z);
      if (!pr || pr.s > 205 || g.dead) break;
      const ahead = forest.posAt(Math.min(forest.length - 1, (pr?.s ?? 160) + 4), 0);
      g.player.yaw = Math.atan2(-(ahead.x - g.player.pos.x), -(ahead.z - g.player.pos.z));
      F.stepWith(0.1, { moveZ: 1, run: true }, false);
    }
    const walkedS = forest.project(g.player.pos.x, g.player.pos.z)?.s ?? -1;
    check('the chain run is walkable on foot with no throws',
      walkedS > 205 && !g.dead, { walkedS, dead: g.dead });

    // (b) the chain's anchors never retire: every knot target enabled after use
    const knots = g.world.fetchTargets.filter((t) => String(t.id).startsWith('forestChain'));
    check('all six chain targets exist and stay enabled',
      knots.length === 6 && knots.every((t) => t.enabled !== false),
      { count: knots.length, enabled: knots.map((t) => t.enabled !== false) });

    // (c) DEATH MID-CHAIN RESTORES CLEAN: kill the player airborne on a link
    // and assert the swing is gone, the respawn is grounded and on-trail.
    const link = forest.chainLinks.find((l) => l.s === 182);
    g.player.pos.set(link.pivot.x, forest.heightAt(link.pivot.x, link.pivot.z), link.pivot.z - 6);
    forest.recentre(g.player.pos);
    g.player._sync(0);
    F.setSkull(link.pivot.x, link.pivot.y, link.pivot.z, 0, 0, 0, 'outbound');
    const directive = link.target.onHit.call(link.target, g.skull);
    F.stepWith(0.4, { throwHeld: true }, false);
    const midSwing = !!g.player.swing;
    g.director.death(null);
    F.stepWith(1.2, {}, false);
    g.director.respawn();
    F.stepWith(0.2, {}, false);
    const pr = forest.project(g.player.pos.x, g.player.pos.z);
    check('death mid-chain drops the rope and restores a grounded on-trail pose',
      directive === 'anchor' && midSwing
      && g.player.swing === null && !g.dead
      && pr && Math.abs(pr.lat) < forest.halfW[Math.round(pr.s)] + 0.5,
      { directive, midSwing, swing: g.player.swing, dead: g.dead, s: pr?.s, lat: pr?.lat });

    return { checks };
  });

  await scenario('forest-checkpoint', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('forest');
    F.stepWith(1 / 120, {}, false);

    const forest = g.forest;
    const ravineS = forest.ravineS();
    const launchFrom = forest.posAt(ravineS - 5);
    // Hard setup skipped the real approach, so seed the spline's warm-start at
    // the same point a walking player would have reached. This does not change
    // the rope callback or checkpoint behavior under test.
    forest._lastIdx = ravineS - 5;
    const launchY = g.world.groundHeightAt(launchFrom.x, launchFrom.z, 10);
    g.player.pos.set(launchFrom.x, launchY, launchFrom.z);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player.abortSwing && g.player.abortSwing();
    g.player._sync(0);
    g.enemies.clear();

    const rope = g.world.fetchTargets.find((target) => target.id === 'ravineRope');
    let directive = null;
    if (rope) {
      // A short, failed grab must leave the anchor available. A one-shot rope
      // made an ordinary early release an unrecoverable traversal failure.
      F.setSkull(rope.pos.x, rope.pos.y, rope.pos.z, 0, 0, 0, 'outbound');
      const firstDirective = rope.onHit.call(rope, g.skull);
      // The backup-call verb must release both halves of an active rope in the
      // same fixed step, even if the primary throw button remains held.
      F.stepWith(1 / 120, { callTap: true, throwHeld: true }, false);
      const calledMode = g.skull.mode;
      const swingAfterCall = !!g.player.swing;
      F.stepWith(0.12, { throwHeld: false }, false);
      check(
        'failed rope attempt stays retryable until the crossing is real',
        firstDirective === 'anchor' && rope.enabled === true
          && calledMode === 'returning' && !swingAfterCall && !g.player.swing,
        {
          firstDirective,
          ropeEnabled: rope.enabled,
          calledMode,
          swingAfterCall,
          swingActive: !!g.player.swing,
        },
      );
      g.player.abortSwing && g.player.abortSwing();
      g.skull.holdNow();
      g.player.pos.set(launchFrom.x, launchY, launchFrom.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);

      F.setSkull(rope.pos.x, rope.pos.y, rope.pos.z, 0, 0, 0, 'outbound');
      directive = rope.onHit.call(rope, g.skull);
      let elapsed = 0;
      // The rope is a verb now, not a scripted launch: it lives exactly as long
      // as the button is held. Hold it, then let go and let the arc land.
      while (elapsed < 4) {
        F.stepWith(0.05, { throwHeld: elapsed < 2.0 }, false);
        elapsed += 0.05;
        if (elapsed > 2.4 && g.player.grounded && !g.player.swing) break;
      }
    }

    const checkpoint = g.checkpointPose ? { ...g.checkpointPose } : null;
    const checkpointProjection = checkpoint
      ? forest.project(checkpoint.x, checkpoint.z)
      : null;
    check(
      'successful rope crossing spends the anchor and creates a far-side checkpoint',
      !!rope
        && directive === 'anchor'
        && rope.enabled === false
        && g.flags.has('ropeLatched')
        && !g.player.swing
        && checkpoint?.act === 'forest'
        && checkpointProjection?.s >= ravineS + 1,
      {
        ropeFound: !!rope,
        directive,
        ropeEnabled: rope?.enabled ?? null,
        ropeLatched: g.flags.has('ropeLatched'),
        swingActive: !!g.player.swing,
        checkpoint,
        checkpointS: checkpointProjection?.s ?? null,
        ravineS,
      },
    );

    // Put the doomed body back on the wrong side so only the saved spatial
    // checkpoint can rescue this irreversible state.
    const doomed = forest.posAt(ravineS - 6);
    g.player.pos.set(doomed.x, g.world.groundHeightAt(doomed.x, doomed.z, 10), doomed.z);
    g.player._sync(0);
    g.director.death(null);
    F.stepWith(1.2, {}, false);
    g.director.respawn();

    const restored = {
      x: g.player.pos.x,
      y: g.player.pos.y,
      z: g.player.pos.z,
      act: g.act,
      dead: g.dead,
      frozen: g.player.frozen,
      movementLocked: g.player.movementLocked,
      swing: !!g.player.swing,
    };
    const restoredProjection = forest.project(restored.x, restored.z);
    const restoreDistance = checkpoint
      ? Math.hypot(restored.x - checkpoint.x, restored.y - checkpoint.y, restored.z - checkpoint.z)
      : Infinity;
    check(
      'death restores the exact far-side checkpoint while preserving the spent rope',
      !!checkpoint
        && restoreDistance < 0.01
        && restored.act === 'forest'
        && restored.dead === false
        && restored.frozen === false
        && restored.movementLocked === false
        && restored.swing === false
        && rope?.enabled === false
        && g.flags.has('ropeLatched')
        && restoredProjection?.s >= ravineS + 1,
      {
        checkpoint,
        restored,
        restoreDistance: Number.isFinite(restoreDistance) ? +restoreDistance.toFixed(5) : null,
        restoredS: restoredProjection?.s ?? null,
        ravineS,
        ropeEnabled: rope?.enabled ?? null,
      },
    );

    let continuedS = restoredProjection?.s ?? -Infinity;
    if (restoredProjection) {
      const target = forest.posAt(Math.min(forest.length - 1, restoredProjection.s + 5));
      g.player.yaw = Math.atan2(-(target.x - g.player.pos.x), -(target.z - g.player.pos.z));
      g.player._sync(0);
      F.stepWith(1.5, { moveZ: 1, run: true }, false);
      continuedS = forest.project(g.player.pos.x, g.player.pos.z)?.s ?? -Infinity;
    }
    check(
      'restored far-side pose can continue forward without reusing the rope',
      !!restoredProjection
        && continuedS > restoredProjection.s + 1
        && rope?.enabled === false
        && !g.dead,
      {
        restoredS: restoredProjection?.s ?? null,
        continuedS: Number.isFinite(continuedS) ? continuedS : null,
        ropeEnabled: rope?.enabled ?? null,
        dead: g.dead,
      },
    );

    return { checks, diagnostics: { checkpoint, restored, continuedS } };
  });

  await scenario('waterfall-respawn', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('clearing');
    F.stepWith(1 / 120, {}, false);
    // the falls arrive FROZEN now and the bargain is not on the table until
    // both fires are lit; this scenario is about what happens AFTER it is
    // taken, so hand it the thawed world the two machines would have made
    g.flag('fallsThawed');
    g.director.armWaterfall();
    F.stepWith(1 / 120, {}, false);

    const waterfall = g.world.fetchTargets.find((target) => target.id === 'waterfall');
    let directive = null;
    if (waterfall?.enabled) {
      directive = waterfall.onHit.call(waterfall, g.skull, waterfall.pos, {});
      if (directive === 'gone') g.skull.vanish(); // mirrors Skull._checkTargets
    }
    check(
      'waterfall bargain records the flag, opens progression, and removes the skull',
      !!waterfall
        && directive === 'gone'
        && g.flags.has('waterfallTaken')
        && g.skull.mode === 'gone'
        && g.skull.root.parent == null
        && g.caveZone.enabled === true
        && g.bridgeBarrier.max.y === g.bridgeBarrier.min.y,
      {
        waterfallFound: !!waterfall,
        enabled: waterfall?.enabled ?? null,
        directive,
        waterfallTaken: g.flags.has('waterfallTaken'),
        skullMode: g.skull.mode,
        skullParent: g.skull.root.parent?.name ?? null,
        caveEnabled: g.caveZone.enabled,
        barrierCollapsed: g.bridgeBarrier.max.y === g.bridgeBarrier.min.y,
      },
    );

    g.director.death(null);
    F.stepWith(1.2, {}, false);
    g.director.respawn();
    F.stepWith(1 / 120, { callTap: true }, false);
    F.stepWith(1, {}, false);

    check(
      'death and recall cannot undo the waterfall loss',
      !g.dead
        && !g.player.frozen
        && !g.player.movementLocked
        && g.flags.has('waterfallTaken')
        && g.skull.mode === 'gone'
        && g.skull.root.parent == null
        && g.caveZone.enabled === true
        && g.bridgeBarrier.max.y === g.bridgeBarrier.min.y,
      {
        act: g.act,
        dead: g.dead,
        frozen: g.player.frozen,
        movementLocked: g.player.movementLocked,
        waterfallTaken: g.flags.has('waterfallTaken'),
        skullMode: g.skull.mode,
        skullParent: g.skull.root.parent?.name ?? null,
        caveEnabled: g.caveZone.enabled,
        barrierCollapsed: g.bridgeBarrier.max.y === g.bridgeBarrier.min.y,
      },
    );

    return {
      checks,
      diagnostics: {
        directive,
        checkpoint: g.checkpointPose,
        skull: g.skull.getState(),
      },
    };
  });

  await scenario('finale-contact', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    // Complete the bedroom arrival FIRST (hard-teleport contract), exactly as
    // a real run reaches the mirror room with 'skullArrived' long since
    // flagged. Only then does the waterfall's vanish() hold: teleport's
    // instant-completion keys on the missing flag, and simulating the
    // bargain before the flag exists would resurrect the skull.
    F.teleport('bedroom');
    F.stepWith(0.2, {}, false);
    g.skull.vanish();
    const audioCalls = [];
    for (const name of ['skullMoanStart', 'skullMoanUpdate', 'skullMoanStop', 'catchThud', 'gasp']) {
      const original = g.audio[name].bind(g.audio);
      g.audio[name] = (...args) => {
        if (!audioCalls.includes(name)) audioCalls.push(name);
        return original(...args);
      };
    }
    F.teleport('mirror');
    F.stepWith(0.2, {}, false);
    const mirrorSpawn = g.player.pos.clone();
    const spawnCamera = g.camera.position.clone();

    // The absent skull stays absent. Old verbs remain available to press but
    // do not resurrect it or skip the physical struggle.
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true, callTap: true }, false);
    F.stepWith(1 / 120, { throwReleased: true }, false);
    check(
      'mirror-room throw and call inputs stay silent without resurrecting the skull',
      g.skull.mode === 'gone' && g.finale.phase === 'still' && !g.flags.has('ended'),
      { skullMode: g.skull.mode, phase: g.finale.phase, ended: g.flags.has('ended') },
    );

    const beforeMove = g.player.pos.clone();
    const beforeYaw = g.player.yaw;
    F.stepWith(0.35, { moveZ: 1, run: true }, false);
    F.stepWith(1 / 120, { lookX: 12 }, false);
    check(
      'player retains real movement and look control before the walls arrive',
      g.player.pos.distanceTo(beforeMove) > 0.1
        && Math.abs(g.player.yaw - beforeYaw) > 0.001
        && !g.player.frozen,
      {
        moved: g.player.pos.distanceTo(beforeMove),
        yawDelta: g.player.yaw - beforeYaw,
        frozen: g.player.frozen,
      },
    );

    let previousHalf = g.finale.half;
    let monotonic = true;
    let guard = 0;
    while (g.finale.phase !== 'contact' && guard < 300) {
      F.stepWith(0.15, {}, false);
      if (g.finale.half > previousHalf + 1e-7) monotonic = false;
      previousHalf = g.finale.half;
      guard++;
    }
    F.stepWith(1.05, {}, false);
    const jaw = g.finale.figure?.userData?.exactJaw;
    const contactYaw = g.player.yaw;
    F.stepWith(1 / 120, { lookX: -9 }, false);
    check(
      'closing is monotonic and reaches a visible, controllable contact phase',
      monotonic
        && g.finale.phase === 'contact'
        && g.finale.half <= 0.371
        && !g.player.frozen
        && Math.abs(g.player.yaw - contactYaw) > 0.001
        && jaw?.rotation.x > 0.3,
      {
        monotonic,
        phase: g.finale.phase,
        half: g.finale.half,
        frozen: g.player.frozen,
        jaw: jaw?.rotation.x ?? null,
        lookDelta: g.player.yaw - contactYaw,
        guard,
      },
    );

    F.stepWith(3.6, {}, false);
    g.render();
    const expectedAudio = ['skullMoanStart', 'skullMoanUpdate', 'skullMoanStop', 'catchThud', 'gasp'];
    const endTag = g.el.title.querySelector('.tag').textContent;
    check(
      'impossible recall, hard black, catch, and localized human gasp occur in order',
      g.finale.phase === 'end'
        && g.flags.has('ended')
        && g.player.frozen
        && !g.finale.active
        && endTag === ''
        && expectedAudio.every((name, i) => audioCalls.indexOf(name) === i)
        && g.lastRender.drawCalls < 700,
      {
        phase: g.finale.phase,
        ended: g.flags.has('ended'),
        frozen: g.player.frozen,
        finaleActive: g.finale.active,
        endTag,
        audioCalls,
        drawCalls: g.lastRender.drawCalls,
      },
    );
    check(
      'mirror player and camera remain co-located far outside forest jurisdiction',
      mirrorSpawn.x > 490 && mirrorSpawn.z > 490
        && spawnCamera.distanceTo(mirrorSpawn.clone().setY(spawnCamera.y)) < 0.2
        && g.player.pos.x > 490 && g.player.pos.z > 490,
      {
        mirrorSpawn: [mirrorSpawn.x, mirrorSpawn.y, mirrorSpawn.z],
        spawnCamera: [spawnCamera.x, spawnCamera.y, spawnCamera.z],
        finalPlayer: [g.player.pos.x, g.player.pos.y, g.player.pos.z],
      },
    );

    return { checks, diagnostics: { audioCalls, guard, half: g.finale.half } };
  });

  // ---- THE NEW OPENING: three arrival traps -------------------------------
  // Alex: "Make sure it doesn't get the key on the way in when you first meet
  // it shattering the window." The room boots skull-less; the bell (hidden
  // under a floorboard, gated behind the rug search) summons the skull through
  // the strong-glass window. These scenarios drive the real interact
  // dispatcher — hard player placement is setup, every E press is a real
  // input frame — then assert the three state truths restarts must preserve.

  await scenario('arrival-never-takes-the-key', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.stepWith(0.5, {}, false);
    const A = g.bedroomArrival;
    const glass = g.bedroomGlass;
    // stand at a probe-verified pose, put the crosshair on the world point,
    // press E through the real input frame
    const useAt = (sx, sz, tx, ty, tz) => {
      g.player.pos.set(sx, 3.6, sz);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player._sync(0);
      const cam = g.camera.getWorldPosition(new (g.scene.position.constructor)());
      const dx = tx - cam.x, dy = ty - cam.y, dz = tz - cam.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
      F.stepWith(1 / 60, {}, false);
      F.stepWith(0.06, { interactPressed: true }, false);
    };

    check(
      'the room boots skull-less behind strong glass',
      g.skull.mode === 'gone' && g.skull.root.parent === null
        && A.state === 'searching' && !glass.broken && !!glass.pane.parent
        && glass.collider.max.y > glass.collider.min.y,
      { mode: g.skull.mode, state: A.state, broken: glass.broken },
    );

    // the two-step find: rug corner reveals the floorboard, floorboard the bell
    useAt(10.4, 1.25, 10.65, 3.64, 2.02);   // S4 rug corner
    F.stepWith(1.2, {}, false);
    useAt(10.3, 1.35, 10.6, 3.64, 2.16);    // S5 loose floorboard
    F.stepWith(1.2, {}, false);
    check(
      'the rug-then-floorboard find surfaces the bell',
      g.bedroomSearch.rug.done && g.bedroomSearch.floorboard.done
        && A.bellFound && A.state === 'bellFound',
      { state: A.state, bellFound: A.bellFound },
    );
    useAt(10.0, 1.5, 10.42, 3.7, 2.16);     // ring it where it lies
    check('the bell answers with the summons', A.bellRung && A.state === 'called', A.state);

    // run the whole arrival; sample the flight's mode/carry the entire way
    const trace = [];
    for (let i = 0; i < 170 && A.state !== 'done'; i++) {
      F.stepWith(0.15, {}, false);
      trace.push({
        state: A.state,
        mode: g.skull.mode,
        carry: g.skull.carry ? g.skull.carry.id : null,
      });
    }
    check(
      'the summons runs to the settled catch',
      A.state === 'done' && g.flags.has('skullArrived')
        && g.skull.mode === 'held' && !g.skull.introFlicker,
      { state: A.state, mode: g.skull.mode },
    );
    check(
      'the inbound flight ran in mode gone (no target can fire)',
      trace.some((r) => r.state === 'inbound' && r.mode === 'gone'),
      { states: [...new Set(trace.map((r) => r.state + '/' + r.mode))] },
    );
    check(
      'the window burst inward and stays burst',
      glass.broken && glass.pane.parent === null
        && glass.collider.max.y === glass.collider.min.y && glass.shards.visible,
      { broken: glass.broken },
    );
    const treeKey = g.world.fetchTargets.find((t) => t.id === 'treeKey');
    check(
      'the arrival never takes the key',
      g.skull.carry === null && trace.every((r) => r.carry === null)
        && !g.flags.has('gotBedroomKey')
        && !!treeKey && treeKey.enabled === true && treeKey.object.parent === g.scene,
      {
        carry: g.skull.carry,
        everCarried: trace.some((r) => r.carry !== null),
        treeKeyEnabled: treeKey?.enabled ?? null,
        keyInScene: treeKey ? treeKey.object.parent === g.scene : null,
      },
    );

    return { checks, diagnostics: { samples: trace.length } };
  });

  await scenario('restart-before-arrival-keeps-the-room-skull-less', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.stepWith(0.5, {}, false);
    const A = g.bedroomArrival;
    const glass = g.bedroomGlass;
    const useAt = (sx, sz, tx, ty, tz) => {
      g.player.pos.set(sx, 3.6, sz);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player._sync(0);
      const cam = g.camera.getWorldPosition(new (g.scene.position.constructor)());
      const dx = tx - cam.x, dy = ty - cam.y, dz = tz - cam.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
      F.stepWith(1 / 60, {}, false);
      F.stepWith(0.06, { interactPressed: true }, false);
    };

    // two honest searches, then die-and-restart in the search phase
    useAt(9.35, 4.1, 9.35, 4.12, 5.2);      // S1 dresser
    F.stepWith(1.2, {}, false);
    useAt(6.0, 4.6, 5.99, 5.2, 5.84);       // S6 curtains
    F.stepWith(1.4, {}, false);
    const searchedBefore = A.searchedCount;
    F.pause('regression');
    F.restartCheckpoint();
    F.stepWith(0.5, {}, false);

    check(
      'restart keeps the room skull-less',
      g.skull.mode === 'gone' && g.skull.root.parent === null
        && !g.flags.has('skullArrived') && A.state === 'searching',
      { mode: g.skull.mode, state: A.state },
    );
    check(
      'searches persist across the restart (they are world truth)',
      searchedBefore === 2 && A.searchedCount === 2
        && g.bedroomSearch.dresser.done && g.bedroomSearch.curtains.done
        && Math.abs(g.bedroomProps.dresser.group.position.z - (5.235 - 0.24)) < 0.02,
      {
        searched: A.searchedCount,
        drawerZ: +g.bedroomProps.dresser.group.position.z.toFixed(3),
      },
    );
    check(
      'the glass is still whole and strong',
      !glass.broken && !!glass.pane.parent
        && glass.collider.max.y > glass.collider.min.y && !glass.shards.visible,
      { broken: glass.broken },
    );

    // the bell is still findable, and still answers
    useAt(10.4, 1.25, 10.65, 3.64, 2.02);   // S4 rug corner
    F.stepWith(1.2, {}, false);
    useAt(10.3, 1.35, 10.6, 3.64, 2.16);    // S5 loose floorboard
    F.stepWith(1.2, {}, false);
    check(
      'the bell is still findable after the restart',
      A.bellFound && A.state === 'bellFound' && A.searchedCount === 4,
      { state: A.state, searched: A.searchedCount },
    );
    useAt(10.0, 1.5, 10.42, 3.7, 2.16);
    check('and still re-ringable', A.bellRung && A.state === 'called', A.state);

    return { checks, diagnostics: { searched: A.searchedCount } };
  });

  await scenario('restart-after-arrival-keeps-skull-and-broken-window', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('bedroom');                   // completes the arrival (test contract)
    F.stepWith(0.3, {}, false);
    const A = g.bedroomArrival;
    const glass = g.bedroomGlass;
    check(
      'teleport hands over the post-arrival room',
      g.flags.has('skullArrived') && g.skull.mode === 'held'
        && A.state === 'done' && glass.broken,
      { state: A.state, mode: g.skull.mode },
    );

    F.pause('regression');
    F.restartCheckpoint();
    F.stepWith(0.5, {}, false);

    check(
      'restart keeps the skull in the hands',
      g.flags.has('skullArrived') && g.skull.mode === 'held'
        && !g.skull.introFlicker && A.state === 'done',
      { mode: g.skull.mode, state: A.state, flicker: !!g.skull.introFlicker },
    );
    check(
      'restart keeps the broken window broken',
      glass.broken && glass.pane.parent === null
        && glass.collider.max.y === glass.collider.min.y && glass.shards.visible,
      { broken: glass.broken, shards: glass.shards.visible },
    );
    const bellInter = g.world.interactables
      .map((o) => o.userData.inter).find((i) => i && i.id === 'bedroomBell');
    check(
      'the bell verb stays spent',
      !!bellInter && bellInter.enabled === false,
      { found: !!bellInter, enabled: bellInter?.enabled ?? null },
    );

    return { checks, diagnostics: null };
  });

  // THE THREE-KEY GATE. Any order, and only three opens it — the sockets are
  // the counter, so the counter has to be right.
  await scenario('gate-takes-three-keys-in-any-order', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.2, {}, false);
    g.skull.holdNow();
    F.stepWith(0.2, {}, false);

    check('the gate is shut and every socket is empty',
      g.gateKeys.banked() === 0 && !g.graveyardGate.opening && !g.graveyardGate.open,
      { banked: g.gateKeys.banked() });
    // the retired northeast pit is scenery now: no verb, ever
    const nearOldPit = g.world.interactables.filter((o) => {
      const w = o.getWorldPosition(new g.skull.pos.constructor());
      return Math.hypot(w.x - 11.8, w.z - 36.2) < 2.0;
    });
    check('the way down is under the sealed mausoleum, and the old grave is inert',
      !!g.marrowPit && Math.abs(g.marrowPit.x - 15.6) < 0.2 && g.marrowPit.z > 30
      && nearOldPit.length === 0,
      { mouth: [g.marrowPit?.x, g.marrowPit?.z], strayVerbs: nearOldPit.length });

    // bank out of order: middle socket, then top, then bottom
    const order = [1, 2, 0];
    let opened = null;
    for (let i = 0; i < order.length; i++) {
      const rec = g.gateKeys.list[i];
      rec.reveal(g.player.pos.x, g.player.pos.y + 1.2, g.player.pos.z + 1.2);
      rec.giveToJaw();
      const socket = g.gateKeys.sockets[order[i]];
      const banked = socket.bank();
      F.stepWith(0.1, {}, false);
      check(`key ${i + 1} banks into socket ${order[i]}`,
        banked === true && socket.filled === true
        && g.gateKeys.banked() === i + 1,
        { banked: g.gateKeys.banked(), filled: socket.filled });
      // the latch weights ARE the tally: one lets go per banked key, at the
      // gate, two metres from the stone the player is standing at
      const letGo = g.graveyardGate.weights
        .filter((w) => w.position.y < w.userData.homeY - 0.005).length;
      check(`weight ${i + 1} lets go with the key`, letGo === i + 1, { letGo });
      if (i < 2) opened = g.graveyardGate.opening || g.graveyardGate.open;
    }
    check('two keys are not enough — the gate never twitched before the third',
      opened === false, { opened });
    F.stepWith(1.6, {}, false);
    check('the third key gives the gate',
      g.graveyardGate.opening === true && g.flags.has('graveyardCleared'),
      { opening: g.graveyardGate.opening });
    // ...and nothing is left hanging in the doorway. The weights draw up flush
    // into the header as the leaves swing: the walk band (y 0.3..2.2) across
    // the whole 3.2 m gap has to be empty of anything without a collider.
    F.stepWith(3.4, {}, false);
    const weightY = g.graveyardGate.weights.map((w) => +w.position.y.toFixed(3));
    check('the gate is open and nothing hangs in the walkway',
      g.graveyardGate.open === true && weightY.every((y) => y >= 2.2),
      { open: g.graveyardGate.open, weightY });
    return { checks, diagnostics: null };
  });

  // THE KEY TREE. One limb, hung where a throw can reach it; the key visible
  // up near the leaves and NOT takeable until the limb comes down. One hit.
  await scenario('the-key-tree-gives-on-one-hit', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.skull.holdNow();
    F.stepWith(0.2, {}, false);
    const climb = g.keyTreeClimb;
    const key3 = g.gateKeys.list[2];

    check('nothing hangs out of the tree before the funeral',
      climb.dropped === false && climb.arm.visible === false
      && climb.branchTarget.enabled === false && key3.target.enabled === false);

    g.director._completeGraveyard('loud');
    for (let i = 0; i < 90; i++) F.stepWith(0.1, {}, false);   // reveal at 4.0s + payout
    check('the tree lets one branch down, and it answers a throw',
      climb.dropped === true && climb.arm.visible === true
      && climb.branchTarget.enabled === true && climb.branchTarget.radius > 2,
      { hangY: +climb.branchTarget.pos.y.toFixed(2) });
    check('the key is up there, in sight and out of reach',
      key3.key.visible === true && key3.target.enabled === false && key3.home.y > 3.0,
      { visible: key3.key.visible, fetchable: key3.target.enabled, y: +key3.home.y.toFixed(2) });
    check('the branch hangs where a level throw meets it',
      climb.branchTarget.pos.y > 2.0 && climb.branchTarget.pos.y < 4.6,
      { y: +climb.branchTarget.pos.y.toFixed(2) });

    climb.tear();
    check('a second hit changes nothing — one is the whole count',
      climb.tear() === false);
    for (let i = 0; i < 70; i++) F.stepWith(0.1, {}, false);
    check('the key and the bones came down into the grass',
      g.flags.has('keyTreeFelled') && key3.home.y < 1.2
      && climb.bones.position.y < 0.9 && climb.shards.visible === true,
      { keyY: +key3.home.y.toFixed(2), boneY: +climb.bones.position.y.toFixed(2) });
    check('and only now can it be fetched',
      key3.target.enabled === true, { enabled: key3.target.enabled });
    // a felled branch still answers — it just does not eat the throw, because
    // the key it dropped is lying in the grass behind it
    check('the torn limb still answers, and still lets the skull through',
      climb.branchTarget.enabled === true && climb.branchTarget.radius < 2.0,
      { radius: climb.branchTarget.radius });
    return { checks, diagnostics: null };
  });

  // ONE BROKEN STONE, TWO PRIZES, IN ORDER. "might as well remove that powerup
  // and put both powerups in the same spot as the first powerup is in now that
  // comes out of that destroyed gravestone."
  await scenario('the-hero-grave-yields-two-in-order', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.skull.holdNow();
    F.stepWith(0.2, {}, false);
    const canine = g.world.fetchTargets.find((t) => t.id === 'ironCanine');
    const relic = g.world.fetchTargets.find((t) => t.id === 'marrowRelic');
    check('nothing is in the rubble until the stone comes down',
      !!canine && !!relic && canine.object.visible === false && relic.object.visible === false);

    g.destructibleGraves[5].hits = 2;
    F.stepWith(2.0, {}, false);
    check('the stone gives up the canine first, and only the canine',
      canine.object.visible === true && canine.enabled === true
      && relic.object.visible === false && relic.enabled === false);

    g.flag('skullSharpened');
    F.stepWith(2.0, {}, false);
    check('the sharpened bite applies, and the second thing lights up behind it',
      g.skullPower === 2 && canine.object.visible === false
      && relic.object.visible === true && relic.enabled === true);
    check('and it stands clear of the first, not on top of it',
      Math.hypot(relic.object.position.x - 18.52, relic.object.position.z - 37.5) > 0.4,
      { at: relic.object.position.toArray().map((v) => +v.toFixed(2)) });

    g.flag('relicKept');
    F.stepWith(0.6, {}, false);
    check('the keepsake rides the jaw, derived from the flag so a reload rebuilds it',
      !!g.relicDangle && g.relicDangle.parent === g.skull.jaw
      && relic.object.visible === false,
      { applied: g._relicApplied });
    return { checks, diagnostics: null };
  });

  // THE PIERCE. The canine's real gift: ordinary bodies drop on contact and
  // the skull keeps going. Unkillables are untouched by it.
  await scenario('the-canine-pierces-ordinary-bodies', () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.skull.holdNow();
    g.enemies.clear(() => true);
    F.stepWith(0.2, {}, false);

    const line = (power) => {
      g.skullPower = power;
      g.enemies.clear(() => true);
      g.player.pos.set(0, 0, 20);
      g.player.vel.set(0, 0, 0);
      g.player.yaw = Math.PI;                      // +z, straight down the line
      g.player.pitch = 0;
      g.player._sync(0);
      const a = g.enemies.spawn('walker', 0, 24, 'chase');
      const b = g.enemies.spawn('walker', 0, 27, 'chase');
      a.graveRiseT = 0; b.graveRiseT = 0;
      F.stepWith(0.2, {}, false);
      g.skull.holdNow();
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      F.stepWith(0.75, { throwHeld: true }, false);
      const state = { a: a.state, b: b.state, mode: g.skull.mode };
      F.stepWith(1 / 120, { throwReleased: true }, false);
      for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {}, false);
      return state;
    };

    const plain = line(1);
    check('at power 1 the first body is STUNNED and the throw comes home',
      plain.a === 'stunned' && plain.b !== 'dying' && plain.mode !== 'outbound',
      plain);
    const sharp = line(2);
    check('at power 2 the first body DROPS and the skull is still in flight',
      sharp.a === 'dying' && (sharp.mode === 'outbound' || sharp.mode === 'poised'),
      sharp);
    check('and it reaches the body standing behind it',
      sharp.b === 'dying', sharp);

    // the unkillables keep every existing rule
    g.enemies.clear(() => true);
    g.skullPower = 2;
    g.player.pos.set(0, 0, 20);
    g.player.yaw = Math.PI;
    g.player.pitch = 0;
    g.player._sync(0);
    const k = g.enemies.spawn('kneeler', 0, 25, 'chase');
    k.graveRiseT = 0;
    F.stepWith(0.2, {}, false);
    g.skull.holdNow();
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.7, { throwHeld: true }, false);
    check('a kneeler still cannot be put down, powered or not',
      k.state !== 'dying', { state: k.state });
    g.skullPower = 1;
    return { checks, diagnostics: null };
  });
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

const failures = report.checks.filter((check) => !check.skipped && !check.passed);
report.pass = failures.length === 0;
report.elapsedMs = report.scenarios.reduce((sum, item) => sum + (item.elapsedMs || 0), 0);
writeFileSync(resultsPath('regressions.json'), JSON.stringify(report, null, 2));

console.log(failures.length
  ? `\nREGRESSIONS FAIL: ${failures.length} failed check(s).`
  : `\nREGRESSIONS PASS: ${report.checks.length} checks (${report.checks.filter((c) => c.skipped).length} skipped).`);
process.exit(failures.length ? 1 : 0);

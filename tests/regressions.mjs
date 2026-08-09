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
      { timeout: 60000, polling: 100 },
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
    // OUR skull-off protocol: the courier sculpt stays default until Alex
    // crowns a winner in-game; a/b/c/d/a2 all mount behind ?skull=.
    check(
      'default query ships the courier sculpt (no variant pre-empted)',
      skull.variant == null && skull.root.name === 'skull',
      metadata,
    );
    check(
      'shipping skull rig is complete (jaw, mount, sockets, eyes, stages)',
      !!skull.jaw && !!skull.jawMount && Array.isArray(skull.sockets)
        && skull.sockets.length >= 2 && !!skull.eyeL && !!skull.eyeR
        && Array.isArray(skull.stageSets) && skull.stageSets.length === 6,
      { sockets: skull.sockets?.length, stageSets: skull.stageSets?.length },
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

    return { checks, diagnostics: { inputAccessible: !!g.input } };
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
      'one-use rope launch creates a spatial checkpoint on the far side',
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

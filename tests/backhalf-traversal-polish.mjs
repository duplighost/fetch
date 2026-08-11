// Focused acceptance gate for the graveyard-to-clearing traversal polish.
// Every motion assertion uses the live fixed-step player/skull grammar.  Direct
// placement is used only to isolate authored starts, never to award a latch,
// a landing, an enemy yield, or an ossuary crossing.
//   node tests/backhalf-traversal-polish.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath, shotPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1&mute=1&warmup=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true
      && window.__game?.forest?.canopyChain?.stages?.length === 3
      && window.__game?.ossuary?.entranceConnector
      && window.__game?.bridgeStones?.length === 8,
    null,
    { timeout: 60000, polling: 100 },
  );
  // The first occupied under-yard frame is the acceptance target, so let the
  // shipping async warmup finish before moving. This is not a test-only compile:
  // the same `ossuary` variant runs from the title/next task in ordinary play.
  await page.evaluate(() => {
    window.__FETCH.start();
    window.__game._selfStep = false;
  });
  await page.evaluate(async () => {
    const g = window.__game;
    const generation = g._webglGeneration;
    const hardDeadline = performance.now() + 240000;
    let progressDeadline = performance.now() + 30000;
    let signature = null;
    const snapshot = () => {
      const shader = g.shaderWarmup;
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const lastJob = shader?.compileJobs?.at(-1) || null;
      return {
        generation: g._webglGeneration,
        shaderGeneration: shader?.generation ?? null,
        status: shader?.status || null,
        recoveryScheduled: !!shader?.recoveryScheduled,
        hasOssuary: shader?.variants?.includes('ossuary') || false,
        readyVariants: shader?.readyVariants?.length ?? null,
        lastReadyVariant: shader?.readyVariants?.at(-1) || null,
        setupSlices: shader?.setupSlices?.length ?? null,
        compileSlices: shader?.compileSlices?.length ?? null,
        textureSlices: shader?.textureSlices?.length ?? null,
        compileJobs: shader?.compileJobs?.length ?? null,
        compileJobsInFlight: shader?.compileJobsInFlight ?? null,
        compileInFlightLabel: shader?.compileInFlightLabel || null,
        pendingTextures: shader?.pendingTextures ?? null,
        lastJob: lastJob ? {
          label: lastJob.label || null,
          settledMs: lastJob.settledMs ?? null,
          error: lastJob.error || null,
        } : null,
        activeKey: residency?.activeKey || null,
        progressKey: progress?.key || null,
        queue: progress?.queue?.length ?? null,
        exactQueue: progress?.exactQueue?.length ?? null,
        exactCovered: progress?.exactCovered?.size ?? null,
        exactUniverse: progress?.exactUniverse?.size ?? null,
        exactShaderRevision: progress?.exactShaderRevision ?? null,
        houseTarget: g._houseMirrorTargetWarmState?.status || null,
        finaleTarget: g.finale?._targetWarmState?.status || null,
        errors: shader?.errors?.length ?? null,
      };
    };
    while (performance.now() < hardDeadline) {
      const current = snapshot();
      if (current.generation !== generation || current.shaderGeneration !== generation) {
        throw new Error(`back-half warmup generation drift: ${JSON.stringify(current)}`);
      }
      if (current.status === 'ready' && current.hasOssuary) return;
      if (current.status === 'invalidated' || current.status === 'skipped'
          || (current.status === 'degraded' && !current.recoveryScheduled)) {
        throw new Error(`back-half warmup terminal state: ${JSON.stringify(current)}`);
      }
      const nextSignature = JSON.stringify(current);
      if (nextSignature !== signature) {
        signature = nextSignature;
        progressDeadline = performance.now() + 30000;
      } else if (performance.now() >= progressDeadline) {
        throw new Error(`back-half warmup made no progress: ${nextSignature}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`back-half warmup exceeded 240s: ${JSON.stringify(snapshot())}`);
  });

  // Preserve the exact ordinary-height approach frame for human review.  The
  // focused checks below still prove physical ground; this image proves the
  // first treads are not hidden by the old full-length black plane.
  await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    g.enemies.clear();
    g.ossuary.unlock('visual-review');
    F.stepWith(1.6, {}, false);
    const c = g.ossuary.entranceConnector;
    const x = g.ritualMausoleum.x + 0.38;
    const z = c.z0 - 0.9;
    g.player.pos.set(x, g.world.groundHeightAt(x, z, 2), z);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    const dx = g.ritualMausoleum.x - 0.28 - x;
    const dz = c.breakZ - z;
    const targetY = 0.05;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(targetY - (g.player.pos.y + 1.62), Math.hypot(dx, dz));
    g.player._sync(0);
    g.render();
  });
  // The title veil is a real CSS transition, not fixed-step simulation time.
  // Wait for the ordinary 2.4s opening fade before judging the player-height
  // plate; otherwise a fast headless run photographs the veil, not the stair.
  await page.waitForTimeout(2500);
  const plate = await page.evaluate(async () => {
    const g = window.__game;
    const generation = g._webglGeneration;
    const expectedKey = g._currentGpuResidencyKey();
    const hardDeadline = performance.now() + 240000;
    let progressDeadline = performance.now() + 30000;
    let signature = null;
    while (performance.now() < hardDeadline) {
      const residency = g.currentGpuResidency;
      const progress = residency?.progressive;
      const shader = g.shaderWarmup;
      if (g._webglGeneration !== generation || residency?.generation !== generation
          || g._currentGpuResidencyKey() !== expectedKey) {
        throw new Error('graveyard visual plate residency identity drift');
      }
      if (residency?.activeKey === expectedKey && progress?.key === expectedKey
          && residency.physical.has(expectedKey) && !g.lastRender?.reducedDetail
          && g.lastRender?.residencyKey === expectedKey
          && g.lastRender?.worldDrawCalls > 0) {
        return g.renderer.domElement.toDataURL('image/png');
      }
      if (shader?.status === 'invalidated' || shader?.status === 'skipped'
          || (shader?.status === 'degraded' && !shader?.recoveryScheduled)
          || residency?.errors?.length || progress?.blockedCritical) {
        throw new Error(`graveyard visual plate residency terminal: ${JSON.stringify({
          shaderStatus: shader?.status,
          residencyErrors: residency?.errors,
          blockedCritical: progress?.blockedCritical,
        })}`);
      }
      const nextSignature = JSON.stringify({
        shaderStatus: shader?.status,
        currentExactStatus: shader?.currentExactStatus,
        currentExactKey: shader?.currentExactKey,
        currentExactRevision: shader?.currentExactRevision,
        compileJobs: shader?.compileJobs?.length,
        compileJobsInFlight: shader?.compileJobsInFlight,
        activeKey: residency?.activeKey,
        progressKey: progress?.key,
        snapshotPhase: progress?.snapshotPhase,
        queue: progress?.queue?.length,
        pendingReducedReveal: progress?.pendingReducedReveal?.length,
        exactQueue: progress?.exactQueue?.length,
        exactCovered: progress?.exactCovered?.size,
        exactUniverse: progress?.exactUniverse?.size,
        exactRevision: progress?.exactShaderRevision,
        reduced: residency?.reduced?.has(expectedKey),
        physical: residency?.physical?.has(expectedKey),
      });
      if (nextSignature !== signature) {
        signature = nextSignature;
        progressDeadline = performance.now() + 30000;
      } else if (performance.now() >= progressDeadline) {
        throw new Error(`graveyard visual plate residency made no progress: ${nextSignature}`);
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    throw new Error(`graveyard visual plate residency exceeded 240s: ${signature}`);
  });
  writeFileSync(shotPath('ossuary-physical-descent.png'),
    Buffer.from(plate.slice(plate.indexOf(',') + 1), 'base64'));

  report.checks = await page.evaluate(async () => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
    const wrapAngle = (n) => Math.atan2(Math.sin(n), Math.cos(n));
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const controlsLive = () => !g.player.frozen && !g.player.movementLocked && !g.dead;
    const sameCheckpoint = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
    const aimAt = (point) => {
      const dx = point.x - g.player.pos.x;
      const dz = point.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(point.y - (g.player.pos.y + 1.62), Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const stepToward = (point, seconds, extra = {}) => {
      aimAt(point);
      F.stepWith(seconds, { moveZ: 1, ...extra }, false);
    };
    const waitHeld = (seconds = 3.2, steer = null) => {
      let elapsed = 0;
      while (g.skull.mode !== 'held' && elapsed < seconds) {
        if (steer) aimAt(steer);
        F.stepWith(1 / 120, { moveZ: steer ? 1 : 0, run: !!steer }, false);
        elapsed += 1 / 120;
      }
      return { held: g.skull.mode === 'held', elapsed };
    };

    F.start();

    // ----------------------------------------------------- dead-time one-shots
    // Player-facing timers and one-shot reveals must pause as a family during
    // death. Prove both the hidden threshold and the live retry, then leave the
    // house state clean for the traversal matrix below.
    F.teleport('house');
    F.stepWith(0.08, {}, false);
    g.enemies.clear();
    g.director.resident = null;
    const mb = g.musicBox;
    if (mb.thing) { g.scene.remove(mb.thing); mb.thing = null; }
    mb.wound = 0;
    mb.spawned = false;
    g.player.pos.set(-8, 3.6, 3);
    g.player._sync(0);
    g.director._updateMusicBox(0.01);
    mb.thing.scale.setScalar(0.959);
    const musicScaleBeforeDeath = mb.thing.scale.x;
    const musicEnemyCount = g.enemies.list.length;
    g.director.death(null);
    F.stepWith(0.35, {}, false);
    const musicDeadState = {
      dead: g.dead, scale: round(mb.thing?.scale.x), spawned: mb.spawned,
      enemyDelta: g.enemies.list.length - musicEnemyCount,
    };
    g.director.respawn();
    F.stepWith(0.08, {}, false);
    F.teleport('house');
    F.stepWith(0.05, {}, false);
    g.player.pos.set(-8, 3.6, 3);
    g.player._sync(0);
    mb.wound = 0;
    if (!mb.thing) g.director._updateMusicBox(0.01);
    mb.thing.scale.setScalar(0.959);
    g.director._updateMusicBox(0.25);
    const musicLiveRetry = { spawned: mb.spawned, thing: !!mb.thing, scale: round(mb.thing?.scale.x) };
    check(
      'music-box threshold pauses during death and commits on the living retry',
      musicDeadState.dead && Math.abs(musicDeadState.scale - musicScaleBeforeDeath) < 0.001
        && !musicDeadState.spawned && musicDeadState.enemyDelta === 0
        && musicLiveRetry.spawned && !musicLiveRetry.thing,
      { musicScaleBeforeDeath: round(musicScaleBeforeDeath), musicDeadState, musicLiveRetry },
    );
    g.enemies.clear();
    mb.spawned = false;
    if (mb.thing) { g.scene.remove(mb.thing); mb.thing = null; }

    // Force the closed-door scare branch and a queued ceiling pace. Neither
    // may change world state or make a footstep while dead; the same scare is
    // still eligible immediately after respawn.
    const scareDoor = g.world.doors[0];
    const scareDoorWasOpen = scareDoor?.open;
    const scareDoorWasLocked = scareDoor?.locked;
    if (scareDoor) {
      scareDoor.locked = null;
      scareDoor.setOpen(false);
      g.player.pos.set(scareDoor.group.position.x, scareDoor.group.position.y - 1.1,
        scareDoor.group.position.z + 1.8);
      g.player._sync(0);
    }
    const originalRandom = Math.random;
    const originalFootstep = g.audio.footstep;
    let deadPaceSteps = 0;
    g.audio.footstep = (...args) => { deadPaceSteps++; return originalFootstep.apply(g.audio, args); };
    g.director.scareT = -0.01;
    g.director._paceOverhead(3);
    g.director.death(null);
    Math.random = () => 0.75;
    g.director._updateScares(0.25);
    const deadScareT = g.director.scareT;
    F.stepWith(1.0, {}, false);
    const deadDoorOpen = !!scareDoor?.open;
    g.director.respawn();
    F.stepWith(0.08, {}, false);
    F.teleport('house');
    F.stepWith(0.05, {}, false);
    if (scareDoor) {
      g.player.pos.set(scareDoor.group.position.x, scareDoor.group.position.y - 1.1,
        scareDoor.group.position.z + 1.8);
      g.player._sync(0);
    }
    g.director.scareT = -0.01;
    g.director._updateScares(0.25);
    const liveDoorOpen = !!scareDoor?.open;
    Math.random = originalRandom;
    g.audio.footstep = originalFootstep;
    check(
      'forced door scare and queued pacing cannot spend themselves during death',
      !!scareDoor && deadScareT === -0.01 && !deadDoorOpen && deadPaceSteps === 0
        && liveDoorOpen,
      { door: scareDoor?.id, deadScareT: round(deadScareT), deadDoorOpen, deadPaceSteps, liveDoorOpen },
    );
    if (scareDoor) {
      scareDoor.setOpen(!!scareDoorWasOpen);
      scareDoor.locked = scareDoorWasLocked;
    }

    // The Resident may be removed by a direct actor cleanup before its delayed
    // footstep. This used to dereference null in the callback.
    F.teleport('house');
    F.stepWith(0.05, {}, false);
    g.enemies.clear();
    g.director.resident = null;
    const residentStarted = g.director.residentHeard(1);
    const scheduledResident = g.director.resident;
    g.director._removeResident();
    F.stepWith(0.92, {}, false);
    check(
      'delayed Resident footstep survives direct cleanup without a ghost or exception',
      residentStarted && !!scheduledResident && !g.director.resident
        && !g.enemies.list.includes(scheduledResident),
      {
        residentStarted, scheduled: !!scheduledResident,
        residentPresent: !!g.director.resident,
        listed: !!scheduledResident && g.enemies.list.includes(scheduledResident),
      },
    );

    F.teleport('basement');
    F.stepWith(0.08, {}, false);
    g.director._storeArmed = true;
    g.director._lie1 = false;
    g.director._truth = false;
    g.player.pos.set(-4, -3, -3);
    g.player._sync(0);
    g.director.death(null);
    g.director._updateStoreroom(0.2);
    const deadStore = { lie: !!g.director._lie1, truth: !!g.director._truth };
    g.director.respawn();
    F.stepWith(0.08, {}, false);
    g.player.pos.set(-4, -3, -3);
    g.player._sync(0);
    g.director._updateStoreroom(0.2);
    const liveStore = { lie: !!g.director._lie1, truth: !!g.director._truth };
    check(
      'storeroom lies and truth remain unspent until the player is alive',
      !deadStore.lie && !deadStore.truth && liveStore.lie && liveStore.truth,
      { deadStore, liveStore },
    );

    // ---------------------------------------------------------------- ossuary
    F.teleport('graveyard');
    F.stepWith(0.1, {}, false);
    g.enemies.clear();

    // The loud funeral route has the same adversarial lifecycle as the later
    // forest arena: pending arrivals and a mutual final kill must pause while
    // dead, with no invisible spawn, resolution, hatch unlock or corpse pose
    // checkpoint. A later living retry is still allowed to commit once.
    g.flags.delete('graveyardResolved');
    g.flags.delete('graveyardCleared');
    g.flags.delete('ossuaryOpened');
    g.ossuary.reset();
    g.director.graveArena = {
      wave: 0, pending: 0, t: -0.01, done: false, engaged: false,
    };
    const graveCallbackCheckpoint = g.checkpointPose ? { ...g.checkpointPose } : null;
    g.director._updateGraveyardArena(0.02);
    const graveScheduledPending = g.director.graveArena.pending;
    const graveCallbackArena = g.director.graveArena;
    g.director.death(null);
    F.stepWith(2.35, {}, false);
    const graveCallbackDeadState = {
      dead: g.dead, wave: graveCallbackArena.wave, pending: graveCallbackArena.pending,
      done: graveCallbackArena.done,
      spawned: g.enemies.list.filter((enemy) => enemy.graveArena).length,
      resolved: g.flags.has('graveyardResolved'), opened: g.ossuary.unlocked,
      checkpointSame: sameCheckpoint(graveCallbackCheckpoint, g.checkpointPose),
    };
    check(
      'graveyard wave callbacks pause while dead without spawning or resolving the route',
      graveScheduledPending === 4 && graveCallbackDeadState.dead
        && graveCallbackDeadState.wave === 1 && graveCallbackDeadState.pending === 4
        && !graveCallbackDeadState.done && graveCallbackDeadState.spawned === 0
        && !graveCallbackDeadState.resolved && !graveCallbackDeadState.opened
        && graveCallbackDeadState.checkpointSame,
      { graveScheduledPending, ...graveCallbackDeadState },
    );
    g.director.respawn();
    F.stepWith(0.12, {}, false);

    g.enemies.clear();
    g.flags.delete('graveyardResolved');
    g.flags.delete('graveyardCleared');
    g.flags.delete('ossuaryOpened');
    const graveMutualCheckpoint = g.checkpointPose ? { ...g.checkpointPose } : null;
    const graveMutualArena = {
      wave: 3, pending: 0, t: 0, done: false, engaged: false,
    };
    g.director.graveArena = graveMutualArena;
    const graveLast = g.enemies.spawn('walker', -2, 24, 'chase');
    graveLast.graveArena = true;
    graveLast.state = 'dying';
    g.director.death(graveLast);
    F.stepWith(2.4, {}, false);
    const graveMutualDeadState = {
      dead: g.dead, done: graveMutualArena.done,
      resolved: g.flags.has('graveyardResolved'), opened: g.ossuary.unlocked,
      checkpointSame: sameCheckpoint(graveMutualCheckpoint, g.checkpointPose),
    };
    check(
      'a mutual graveyard kill cannot unlock or checkpoint the ossuary before respawn',
      graveMutualDeadState.dead && !graveMutualDeadState.done
        && !graveMutualDeadState.resolved && !graveMutualDeadState.opened
        && graveMutualDeadState.checkpointSame,
      graveMutualDeadState,
    );
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    g.enemies.clear();
    g.director.graveArena = {
      wave: 3, pending: 0, t: -0.01, done: false, engaged: false,
    };
    F.stepWith(0.08, {}, false);
    check(
      'the same graveyard completion commits once when retried alive',
      g.flags.has('graveyardResolved') && g.ossuary.unlocked
        && g.ossuary.route === 'loud' && g.director.graveArena.done
        && g.checkpointPose?.act === 'graveyard',
      {
        resolved: g.flags.has('graveyardResolved'), opened: g.ossuary.unlocked,
        route: g.ossuary.route, done: g.director.graveArena?.done,
        checkpoint: g.checkpointPose,
      },
    );

    g.ossuary.unlock('traversal-polish-test');
    g.skull.holdNow();
    const o = g.ossuary;
    const entry = o.entranceConnector;
    const entryRamp = g.world.ramps.find((r) => r.id === 'ossuarySurfaceDescent');
    const entrySamples = Array.from({ length: 9 }, (_, i) => {
      const z = entry.z0 + (entry.z1 - entry.z0) * (i / 8);
      return g.world.groundHeightAt(g.ritualMausoleum.x, z, 1 - i * 0.65);
    });
    const terrain = g.graveyardGround;
    const aperture = terrain.userData.ossuaryOpening;
    const terrainPos = terrain.geometry.getAttribute('position');
    const terrainIndex = terrain.geometry.index;
    let apertureCoveringTriangles = 0;
    for (let i = 0; i < terrainIndex.count; i += 3) {
      const ia = terrainIndex.getX(i), ib = terrainIndex.getX(i + 1), ic = terrainIndex.getX(i + 2);
      const cx = (terrainPos.getX(ia) + terrainPos.getX(ib) + terrainPos.getX(ic)) / 3 + terrain.position.x;
      const cz = (terrainPos.getZ(ia) + terrainPos.getZ(ib) + terrainPos.getZ(ic)) / 3 + terrain.position.z;
      if (cx > aperture.x0 && cx < aperture.x1 && cz > aperture.z0 && cz < aperture.z1) {
        apertureCoveringTriangles++;
      }
    }
    const grass = g.scene.getObjectByName('graveyard grass');
    const clearance = entry.apertureClearance;
    let apertureVegetation = 0;
    const grassMatrices = grass?.instanceMatrix?.array;
    for (let i = 0; i < (grass?.count || 0); i++) {
      const x = grassMatrices[i * 16 + 12];
      const y = grassMatrices[i * 16 + 13];
      const z = grassMatrices[i * 16 + 14];
      if (y > -5
          && x >= clearance.x0 && x <= clearance.x1
          && z >= clearance.z0 && z <= clearance.z1) {
        apertureVegetation++;
      }
    }
    check(
      'opened mausoleum owns a continuous physical descent instead of a flat trigger',
      o.unlocked && entry.active && !!entryRamp
        && entrySamples[0] > -0.2 && entrySamples.at(-1) < -3.9
        && entrySamples.every((y, i) => i === 0 || y < entrySamples[i - 1] + 0.04)
        && o.surfacePit.geometry.parameters.height < 0.7
        && entry.treadCount === 12
        && terrain.userData.ossuaryOpeningCut
        && apertureCoveringTriangles === 0
        && clearance.attempted && clearance.removed > 0
        && apertureVegetation === 0,
      {
        active: entry.active, entrySamples: entrySamples.map(round), entry,
        shadowLipLength: o.surfacePit.geometry.parameters.height,
        treadCount: entry.treadCount, aperture, apertureCoveringTriangles,
        clearance, apertureVegetation,
      },
    );

    // A dead body may overlap any hidden coordinate seam while the death veil
    // continues simulating. Exercise every seam with every persistent skull
    // state: none may translate, change act/culling, set progression flags, or
    // spend a checkpoint before respawn restores a living context.
    const stageSkullMode = (mode, anchorPoint) => {
      g.skull.holdNow();
      if (mode === 'held') return;
      aimAt(anchorPoint);
      g.skull.tryThrow({ playerVel: g.player.vel });
      if (mode === 'returning') g.skull.beginReturn('snap');
      else g.skull.anchorAt(anchorPoint, {
        releaseable: true, maxHold: 6, puzzleId: 'deadSeamAdversary',
      });
    };
    const portalDeathResults = [];
    const seamModes = ['held', 'returning', 'anchored'];
    for (const seam of ['entry', 'backtrack', 'far']) {
      for (const mode of seamModes) {
        if (g.dead) g.director.respawn();
        g.dead = false;
        g.player.frozen = false;
        g.player.movementLocked = false;
        g.director.setAct('graveyard', true);
        g.flags.delete('ossuaryEntered');
        g.flags.delete('ossuaryExited');
        o.portalCooldown = 0;
        o.inOssuary = seam !== 'entry';
        o.solved = seam === 'far';
        if (seam === 'far') o.exitCollider.max.y = o.exitCollider.min.y;
        else o.exitCollider.max.y = o.origin.floor + 2.85;
        const safe = seam === 'entry'
          ? { x: g.ritualMausoleum.x, y: 0.02, z: entry.z0 - 0.8 }
          : { x: o.origin.x, y: o.origin.floor, z: o.origin.z + 2 };
        g.player.pos.set(safe.x, safe.y, safe.z);
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        const anchorPoint = g.player.pos.clone().add({ x: 0, y: 1.2, z: 1.8 });
        stageSkullMode(mode, anchorPoint);
        const checkpointBefore = g.checkpointPose ? { ...g.checkpointPose } : null;
        const actBefore = g.act;
        g.director.death(null);
        if (seam === 'entry') {
          g.player.pos.set(g.ritualMausoleum.x, o.origin.floor + 0.2, entry.portalZ + 0.04);
        } else if (seam === 'backtrack') {
          g.player.pos.set(o.origin.x, o.origin.floor, o.origin.z + 0.12);
        } else {
          g.player.pos.set(o.origin.x, -0.2, o.farConnector.z1 - 0.1);
        }
        g.player.vel.set(0, 0, 1.8);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        const posBefore = g.player.pos.clone();
        F.stepWith(0.26, { throwHeld: true, moveZ: 1 }, false);
        const expectedInside = seam !== 'entry';
        portalDeathResults.push({
          seam, mode,
          noCommit: g.dead && g.act === actBefore && o.inOssuary === expectedInside
            && !g.flags.has('ossuaryEntered') && !g.flags.has('ossuaryExited')
            && sameCheckpoint(checkpointBefore, g.checkpointPose)
            // Ordinary dead-body integration may settle a few centimetres or
            // bleed pre-death velocity. A portal translation is tens of metres.
            && g.player.pos.distanceTo(posBefore) < 0.8,
          act: g.act, inOssuary: o.inOssuary,
          moved: round(g.player.pos.distanceTo(posBefore)),
          entered: g.flags.has('ossuaryEntered'), exited: g.flags.has('ossuaryExited'),
          checkpointSame: sameCheckpoint(checkpointBefore, g.checkpointPose),
          skull: g.skull.mode,
        });
        g.director.respawn();
        F.stepWith(0.08, {}, false);
      }
    }
    check(
      'all ossuary portals ignore dead held, returning, and anchored skull states',
      portalDeathResults.length === 9 && portalDeathResults.every((result) => result.noCommit),
      portalDeathResults,
    );

    // Zone advancement is a separate route into setAct and therefore needs a
    // direct corpse-in-forward-zone adversary in addition to the portal matrix.
    F.teleport('graveyard');
    F.stepWith(0.08, {}, false);
    const forestZonePoint = g.forest.posAt(8, 0);
    const zoneCheckpoint = g.checkpointPose ? { ...g.checkpointPose } : null;
    g.director.death(null);
    g.player.pos.copy(forestZonePoint).setY(g.forest.heightAt(forestZonePoint.x, forestZonePoint.z));
    F.stepWith(0.45, {}, false);
    const deadZoneState = {
      act: g.act, checkpointSame: sameCheckpoint(zoneCheckpoint, g.checkpointPose), dead: g.dead,
    };
    check(
      'a corpse in a later zone cannot advance act or checkpoint ownership',
      deadZoneState.dead && deadZoneState.act === 'graveyard' && deadZoneState.checkpointSame,
      deadZoneState,
    );
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    F.teleport('graveyard');
    F.stepWith(0.8, {}, false);
    o.inOssuary = false;
    o.solved = false;
    o.progress = 0;
    o.portalCooldown = 0;
    o.exitCollider.max.y = o.origin.floor + 2.85;
    g.flags.delete('ossuaryEntered');
    g.flags.delete('ossuaryExited');
    g.skull.holdNow();
    // The adversarial seam matrix above deliberately toggles occupancy. Close
    // that synthetic edge, then zero instrumentation so the physical walk owns
    // one unambiguous entry transaction.
    F.stepWith(0.02, {}, false);
    Object.assign(o.visibility, {
      enterPasses: 0, exitPasses: 0, topLevelVisits: 0, writes: 0,
      keptLights: 0, lastVisibleLights: 0, reassertPasses: 0,
    });

    const entryStart = {
      x: g.ritualMausoleum.x,
      y: g.world.groundHeightAt(g.ritualMausoleum.x, entry.z0 - 0.12, 1),
      z: entry.z0 - 0.12,
    };
    g.player.pos.set(entryStart.x, entryStart.y, entryStart.z);
    g.player.vel.set(0, 0, 2.25);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player.yaw = Math.PI;
    g.player.pitch = 0.237;
    g.player._sync(0);
    g.render();
    const surfaceProgramsBeforeEntry = g.renderer.info.programs?.length ?? 0;
    const surfaceDrawsBeforeEntry = g.lastRender.drawCalls;
    const entryView = { yaw: g.player.yaw, pitch: g.player.pitch };
    let descendedY = g.player.pos.y;
    let entryElapsed = 0;
    while (!o.inOssuary && entryElapsed < 6) {
      F.stepWith(1 / 120, { moveZ: 1 }, false);
      descendedY = Math.min(descendedY, g.player.pos.y);
      entryElapsed += 1 / 120;
    }
    check(
      'walking the opened stair reaches its occluded seam only after a real descent',
      o.inOssuary && descendedY < -3.35 && entryElapsed > 0.65 && entryElapsed < 5.8,
      { inOssuary: o.inOssuary, descendedY: round(descendedY), entryElapsed: round(entryElapsed), pos: g.player.pos.toArray().map(round) },
    );
    check(
      'ossuary entry preserves exact look and horizontal intent',
      Math.abs(wrapAngle(g.player.yaw - entryView.yaw)) < 0.002
        && Math.abs(g.player.pitch - entryView.pitch) < 0.002
        && Math.hypot(g.player.vel.x, g.player.vel.z) > 0.2
        && controlsLive(),
      { before: entryView, after: { yaw: round(g.player.yaw), pitch: round(g.player.pitch), speed: round(Math.hypot(g.player.vel.x, g.player.vel.z)) } },
    );

    const firstOccupiedRenders = [];
    const steadyOccupiedRenders = [];
    let occupiedRenderCount = 0;
    let firstNonzero = null;
    let firstReduced = null;
    let firstFull = null;
    const realRender = g.render;
    let renderSerial = 0;
    let latestRender = null;
    g.render = function backHalfOccupiedRenderTrace(...args) {
      const startedAt = performance.now();
      const result = realRender.apply(this, args);
      const completedAt = performance.now();
      latestRender = {
        serial: ++renderSerial,
        programs: g.renderer.info.programs?.length ?? 0,
        drawCalls: g.lastRender.drawCalls,
        worldDrawCalls: g.lastRender.worldDrawCalls,
        heldDrawCalls: g.lastRender.heldDrawCalls,
        triangles: g.lastRender.triangles,
        reducedDetail: !!g.lastRender.reducedDetail,
        snapshotProgress: !!g.lastRender.snapshotProgress,
        reducedBatchSubmitted: !!g.lastRender.reducedBatchSubmitted,
        reducedBatchRevealed: !!g.lastRender.reducedBatchRevealed,
        visibleProgramDelta: g.lastRender.visibleProgramDelta || 0,
        visibleTextureDelta: g.lastRender.visibleTextureDelta || 0,
        visibleGeometryDelta: g.lastRender.visibleGeometryDelta || 0,
        residencyKey: g.lastRender.residencyKey || null,
        renderMs: completedAt - startedAt,
      };
      return result;
    };
    try {
      const generation = g._webglGeneration;
      const expectedKey = g._currentGpuResidencyKey();
      const hardDeadline = performance.now() + 240000;
      let progressDeadline = performance.now() + 30000;
      let signature = null;
      const nextRender = async () => {
        const previousSerial = renderSerial;
        for (let waits = 0; waits < 4 && renderSerial === previousSerial; waits++) await frame();
        return renderSerial > previousSerial && latestRender ? { ...latestRender } : null;
      };
      while (!firstFull && performance.now() < hardDeadline) {
        const sample = await nextRender();
        if (!sample) continue;
        occupiedRenderCount++;
        if (firstOccupiedRenders.length < 32) firstOccupiedRenders.push(sample);
        if (sample.worldDrawCalls > 0 && !firstNonzero) firstNonzero = sample;
        if (sample.worldDrawCalls > 0 && sample.reducedDetail && !firstReduced) {
          firstReduced = sample;
        }
        const residency = g.currentGpuResidency;
        const progress = residency?.progressive;
        const shader = g.shaderWarmup;
        if (g._webglGeneration !== generation || residency?.generation !== generation
            || g._currentGpuResidencyKey() !== expectedKey) {
          throw new Error(`ossuary residency identity drift: ${JSON.stringify({
            generation: g._webglGeneration,
            residencyGeneration: residency?.generation,
            expectedKey,
            currentKey: g._currentGpuResidencyKey(),
          })}`);
        }
        if (sample.worldDrawCalls > 0 && sample.heldDrawCalls > 0
            && !sample.reducedDetail
            && sample.residencyKey === expectedKey
            && residency?.activeKey === expectedKey && progress?.key === expectedKey
            && residency.physical.has(expectedKey)) {
          firstFull = sample;
          break;
        }
        if (shader?.status === 'invalidated' || shader?.status === 'skipped'
            || (shader?.status === 'degraded' && !shader?.recoveryScheduled)
            || residency?.errors?.length || progress?.blockedCritical) {
          throw new Error(`ossuary residency terminal state: ${JSON.stringify({
            shaderStatus: shader?.status,
            recoveryScheduled: shader?.recoveryScheduled,
            residencyErrors: residency?.errors,
            blockedCritical: progress?.blockedCritical,
          })}`);
        }
        const nextSignature = JSON.stringify({
          shaderStatus: shader?.status,
          currentExactStatus: shader?.currentExactStatus,
          currentExactKey: shader?.currentExactKey,
          currentExactRevision: shader?.currentExactRevision,
          compileJobs: shader?.compileJobs?.length,
          compileJobsInFlight: shader?.compileJobsInFlight,
          compileInFlightLabel: shader?.compileInFlightLabel,
          activeKey: residency?.activeKey,
          progressKey: progress?.key,
          snapshotPhase: progress?.snapshotPhase,
          queue: progress?.queue?.length,
          pendingReducedReveal: progress?.pendingReducedReveal?.length,
          exactQueue: progress?.exactQueue?.length,
          exactCovered: progress?.exactCovered?.size,
          exactUniverse: progress?.exactUniverse?.size,
          exactRevision: progress?.exactShaderRevision,
          reduced: residency?.reduced?.has(expectedKey),
          physical: residency?.physical?.has(expectedKey),
        });
        if (nextSignature !== signature) {
          signature = nextSignature;
          progressDeadline = performance.now() + 30000;
        } else if (performance.now() >= progressDeadline) {
          throw new Error(`ossuary residency made no progress: ${nextSignature}`);
        }
      }
      if (!firstFull) throw new Error(`ossuary residency exceeded 240s after ${occupiedRenderCount} renders`);
      const steadyHardDeadline = performance.now() + 240000;
      let steadyProgressDeadline = performance.now() + 30000;
      let steadySignature = null;
      while (steadyOccupiedRenders.length < 3 && performance.now() < steadyHardDeadline) {
        const sample = await nextRender();
        if (!sample) continue;
        const residency = g.currentGpuResidency;
        const progress = residency?.progressive;
        const shader = g.shaderWarmup;
        if (g._webglGeneration !== generation || residency?.generation !== generation
            || g._currentGpuResidencyKey() !== expectedKey
            || residency?.activeKey !== expectedKey || progress?.key !== expectedKey) {
          throw new Error(`steady ossuary residency identity drift: ${JSON.stringify({
            generation: g._webglGeneration,
            residencyGeneration: residency?.generation,
            expectedKey,
            currentKey: g._currentGpuResidencyKey(),
            activeKey: residency?.activeKey,
            progressKey: progress?.key,
          })}`);
        }
        if (shader?.status === 'invalidated' || shader?.status === 'skipped'
            || (shader?.status === 'degraded' && !shader?.recoveryScheduled)
            || residency?.errors?.length || progress?.blockedCritical) {
          throw new Error(`steady ossuary residency terminal state: ${JSON.stringify({
            shaderStatus: shader?.status,
            recoveryScheduled: shader?.recoveryScheduled,
            residencyErrors: residency?.errors,
            blockedCritical: progress?.blockedCritical,
          })}`);
        }
        if (sample.residencyKey === expectedKey && !sample.reducedDetail
            && sample.worldDrawCalls > 0 && sample.heldDrawCalls > 0
            && residency.physical.has(expectedKey)) {
          steadyOccupiedRenders.push(sample);
          continue;
        }
        const nextSteadySignature = JSON.stringify({
          shaderStatus: shader?.status,
          currentExactStatus: shader?.currentExactStatus,
          compileJobs: shader?.compileJobs?.length,
          compileJobsInFlight: shader?.compileJobsInFlight,
          snapshotPhase: progress?.snapshotPhase,
          deferredQueue: progress?.deferredQueue?.length,
          deferredExactQueue: progress?.deferredExactQueue?.length,
          deferredCovered: progress?.deferredCovered?.size,
          deferredExactCovered: progress?.deferredExactCovered?.size,
          deferredRecorded: progress?.deferredRecorded,
          deferredExactRecorded: progress?.deferredExactRecorded,
          finalizationProgress: !!g.lastRender?.finalizationProgress,
          universeFinalizePasses: residency?.universeFinalizePasses?.length,
        });
        if (nextSteadySignature !== steadySignature) {
          steadySignature = nextSteadySignature;
          steadyProgressDeadline = performance.now() + 30000;
        } else if (performance.now() >= steadyProgressDeadline) {
          throw new Error(`steady ossuary residency made no progress: ${nextSteadySignature}`);
        }
      }
      if (steadyOccupiedRenders.length !== 3) {
        throw new Error(`steady ossuary residency exceeded 240s after ${steadyOccupiedRenders.length} full submissions`);
      }
    } finally {
      g.render = realRender;
    }
    const expectedWorldLights = new Set([
      g.fillLight, g._impactLight,
      g.world.candlePool[0], g.world.candlePool[1],
      g.skullLight, g.skull.carryLight,
    ]);
    const occupiedWorldLights = [];
    g.scene.traverseVisible((object) => {
      if (object.isLight && (object.layers.mask & 1) !== 0) occupiedWorldLights.push(object);
    });
    const occupiedLightTypes = occupiedWorldLights.reduce((counts, light) => {
      counts[light.type] = (counts[light.type] || 0) + 1;
      return counts;
    }, {});
    const ballastWorldLights = occupiedWorldLights
      .filter((light) => light.userData.fetchShaderBallast);
    const identifyLight = (light) => ({
      type: light.type, name: light.name || '',
      fill: light === g.fillLight, impact: light === g._impactLight,
      candle: g.world.candlePool.indexOf(light),
      skull: light === g.skullLight, carry: light === g.skull.carryLight,
      ballast: !!light.userData.fetchShaderBallast,
      intensity: round(light.intensity),
    });
    const unexpectedWorldLights = occupiedWorldLights
      .filter((light) => !expectedWorldLights.has(light)
        && !light.userData.fetchShaderBallast).map(identifyLight);
    const missingWorldLights = [...expectedWorldLights]
      .filter((light) => !occupiedWorldLights.includes(light)).map(identifyLight);
    const warmupEvidence = {
      status: g.shaderWarmup?.status,
      hasVariant: g.shaderWarmup?.variants?.includes('ossuary'),
      errors: [...(g.shaderWarmup?.errors || [])],
    };
    check(
      'the physical first ossuary entry submits the exact prewarmed rig with zero visible allocation',
      warmupEvidence.status === 'ready' && warmupEvidence.hasVariant
        && warmupEvidence.errors.length === 0
        && occupiedLightTypes.AmbientLight === 1
        && occupiedLightTypes.HemisphereLight === 1
        && occupiedLightTypes.DirectionalLight === 1
        && occupiedLightTypes.SpotLight === 1
        && occupiedLightTypes.PointLight === 16
        && occupiedWorldLights.length === expectedWorldLights.size + ballastWorldLights.length
        && ballastWorldLights.length === 14
        && ballastWorldLights.every((light) => light.intensity === 0)
        && unexpectedWorldLights.length === 0 && missingWorldLights.length === 0
        && occupiedRenderCount > 0
        && firstFull && firstFull.worldDrawCalls < 450 && firstFull.triangles > 0
        && firstFull.visibleProgramDelta === 0
        && firstFull.visibleTextureDelta === 0
        && firstFull.visibleGeometryDelta === 0
        && steadyOccupiedRenders.length === 3
        && steadyOccupiedRenders.every((sample) =>
          sample.residencyKey === firstFull.residencyKey
          && !sample.reducedDetail && sample.worldDrawCalls > 0
          && sample.heldDrawCalls > 0 && sample.worldDrawCalls < 450
          && sample.triangles > 0
          && sample.visibleProgramDelta === 0
          && sample.visibleTextureDelta === 0
          && sample.visibleGeometryDelta === 0),
      {
        warmupEvidence, surfaceProgramsBeforeEntry, surfaceDrawsBeforeEntry,
        occupiedRenderCount, firstNonzero, firstReduced, firstFull,
        firstOccupiedRenders, steadyOccupiedRenders,
        occupiedLightTypes,
        ballastWorldLights: ballastWorldLights.map(identifyLight),
        occupiedWorldLights: occupiedWorldLights.map(identifyLight),
        unexpectedWorldLights, missingWorldLights,
      },
    );

    // The offset district culler is an entry/exit transaction, not fixed-step
    // work. Render once to establish its light-count program, soak 240 ordinary
    // steps, and require no second top-level scan, visibility write or shader
    // program while only the two owned candle slots/effect light remain live.
    g.render();
    const cullBeforeSoak = { ...o.visibility };
    const programsBeforeSoak = g.renderer.info.programs?.length ?? 0;
    F.stepWith(2.0, {}, false);
    g.render();
    const cullAfterSoak = { ...o.visibility };
    const programsAfterSoak = g.renderer.info.programs?.length ?? 0;
    const visibleOssuaryLights = g.scene.children
      .filter((child) => child.isLight && child.visible
        && !child.userData.fetchShaderBallast)
      .map((light) => ({
        type: light.type,
        owned: !!light.userData.ossuaryOwned,
        impact: light === g._impactLight,
        source: light.userData.c === null ? null
          : light.userData.c === g.world.candles[0] ? 'owned-0'
            : light.userData.c === g.world.candles[1] ? 'owned-1' : 'foreign',
      }));
    check(
      'ossuary culling is edge-triggered with owned lights and a stable render program',
      cullBeforeSoak.enterPasses === 1
        && cullAfterSoak.enterPasses === cullBeforeSoak.enterPasses
        && cullAfterSoak.exitPasses === cullBeforeSoak.exitPasses
        && cullAfterSoak.topLevelVisits === cullBeforeSoak.topLevelVisits
        && cullAfterSoak.writes === cullBeforeSoak.writes
        && visibleOssuaryLights.length > 0 && visibleOssuaryLights.length <= 3
        && visibleOssuaryLights.every((light) => light.owned || light.impact)
        && programsAfterSoak === programsBeforeSoak,
      {
        fixedSteps: 240, cullBeforeSoak, cullAfterSoak,
        visibleOssuaryLights, programsBeforeSoak, programsAfterSoak,
      },
    );

    // Death inside the offset district used to be untested: respawn first
    // visits the graveyard act spawn, then restores the saved pose.  Prove the
    // connector's occupancy, culler and authored checkpoint survive that whole
    // lifecycle instead of returning a live player to an invisible room.
    const insideCheckpoint = g.checkpointPose ? { ...g.checkpointPose } : null;
    const insideBeforeDeath = {
      x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z,
      yaw: g.player.yaw, pitch: g.player.pitch,
    };
    const insideSkullStage = g.skull.stage;
    g.director.death(null);
    F.stepWith(1.12, {}, false);
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    const allowedInsideRoot = (child) => child === g.camera
      || child === g.skull.root
      || child === o.root
      || child === g._impactRing
      || child === g._impactLight
      || (child.isLight && child.userData.ossuaryOwned);
    const insideVisibilityLeaks = g.scene.children
      .filter((child) => child.visible && !allowedInsideRoot(child))
      .map((child) => ({
        name: child.name || '', type: child.type, uuid: child.uuid,
        sceneIndex: g.scene.children.indexOf(child),
        houseIndex: (g.houseRenderRoots || []).indexOf(child),
        outsideIndex: (g.outsideRenderRoots || []).indexOf(child),
        position: child.position.toArray().map(round),
        geometry: child.geometry?.type || '',
        geometryParameters: child.geometry?.parameters || null,
        material: child.material?.name || child.material?.type || '',
        materialColor: child.material?.color?.getHexString?.() || '',
        musicThing: child === g.musicBox?.thing,
        surfaceSlab: child === o.surfaceSlab,
        fetchGorePool: !!child.userData.fetchGorePool,
        fetchEnemyStainPool: !!child.userData.fetchEnemyStainPool,
      }));
    check(
      'death inside the ossuary restores the occupied route, saved pose, view, skull and controls',
      o.inOssuary && o.root.visible && insideVisibilityLeaks.length === 0
        && o.visibility.enterPasses === 1 && o.visibility.exitPasses === 0
        && o.visibility.reassertPasses === 1
        && g.crawlSecret?.shutterCable?.visible === false
        && insideCheckpoint?.act === 'graveyard'
        && Math.hypot(g.player.pos.x - insideCheckpoint.x,
          g.player.pos.z - insideCheckpoint.z) < 0.04
        && Math.abs(g.player.pos.y - insideCheckpoint.y) < 0.04
        && Math.abs(wrapAngle(g.player.yaw - insideBeforeDeath.yaw)) < 0.002
        && Math.abs(g.player.pitch - insideBeforeDeath.pitch) < 0.002
        && g.skull.mode === 'held' && g.skull.stage === insideSkullStage
        && controlsLive(),
      {
        inOssuary: o.inOssuary, routeVisible: o.root.visible,
        visibility: { ...o.visibility },
        shutterCable: {
          name: g.crawlSecret?.shutterCable?.name,
          visible: g.crawlSecret?.shutterCable?.visible,
        },
        checkpoint: insideCheckpoint,
        restored: {
          x: round(g.player.pos.x), y: round(g.player.pos.y), z: round(g.player.pos.z),
          yaw: round(g.player.yaw), pitch: round(g.player.pitch),
        },
        leaks: insideVisibilityLeaks, skull: { mode: g.skull.mode, stage: g.skull.stage },
        dead: g.dead, frozen: g.player.frozen, movementLocked: g.player.movementLocked,
      },
    );

    // Backtracking must return to the bottom of that same physical stair, not
    // pop to the yard.  Then ordinary movement climbs all the way back out.
    F.stepWith(0.48, {}, false);
    g.player.yaw = 0;
    g.player.pitch = -0.191;
    g.player._sync(0);
    const backView = { yaw: g.player.yaw, pitch: g.player.pitch };
    while (o.inOssuary && entryElapsed < 9) {
      F.stepWith(1 / 120, { moveZ: 1 }, false);
      entryElapsed += 1 / 120;
    }
    const backAtBottom = !o.inOssuary && g.player.pos.y < -3.5
      && g.player.pos.z < entry.portalZ
      && g.player.pos.z > entry.portalZ - 0.3;
    F.stepWith(0.72, {}, false);
    const backtrackDoesNotBounce = !o.inOssuary && g.player.pos.z < entry.portalZ;
    let climbedY = g.player.pos.y;
    for (let t = 0; t < 4.4; t += 1 / 120) {
      F.stepWith(1 / 120, { moveZ: 1 }, false);
      climbedY = Math.max(climbedY, g.player.pos.y);
      if (g.player.pos.z < entry.z0 - 0.2) break;
    }
    check(
      'backtrack emerges at the matching stair bottom and can be physically climbed',
      backAtBottom && backtrackDoesNotBounce && climbedY > -0.22
        && Math.abs(wrapAngle(g.player.yaw - backView.yaw)) < 0.002
        && Math.abs(g.player.pitch - backView.pitch) < 0.002
        && controlsLive(),
      { backAtBottom, backtrackDoesNotBounce, climbedY: round(climbedY), pos: g.player.pos.toArray().map(round), view: { yaw: round(g.player.yaw), pitch: round(g.player.pitch) } },
    );

    // A live tether is allowed through the same spatial seam.  This is a real
    // input sequence—press, keep holding, walk—and the skull must retain its
    // world-space mode and relative position after both coordinates translate.
    o.portalCooldown = 0;
    g.skull.holdNow();
    // Launch from the authored lower tread, already beneath the mausoleum's
    // visible rear footing.  A throw from the porch correctly hits that stone
    // before the player can walk 3.2m; it cannot prove the hidden seam itself.
    const outboundZ = entry.portalZ - 0.58;
    const outboundY = g.world.groundHeightAt(entryStart.x, outboundZ, -2.4);
    g.player.pos.set(entryStart.x, outboundY, outboundZ);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player.yaw = Math.PI;
    // Send the live tether through the open throat, above the descending
    // tread noses.  A downward throw here honestly ricochets off the physical
    // stair it is meant to reveal; that tests collision, not seam continuity.
    g.player.pitch = 0.06;
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    const outboundLaunch = {
      mode: g.skull.mode,
      basementExit: !!g._basementExit,
      dead: g.dead,
      ended: g.flags.has('ended'),
      pos: g.skull.pos.toArray().map(round),
      vel: g.skull.vel.toArray().map(round),
    };
    let outboundElapsed = 0;
    let modeBeforeSeam = null;
    let relativeBefore = null;
    while (!o.inOssuary && outboundElapsed < 6) {
      if (g.player.pos.z > entry.portalZ - 0.12 && !modeBeforeSeam) {
        modeBeforeSeam = g.skull.mode;
        relativeBefore = g.skull.pos.clone().sub(g.player.pos);
      }
      F.stepWith(1 / 120, { throwHeld: true, moveZ: 1 }, false);
      outboundElapsed += 1 / 120;
    }
    const relativeAfter = g.skull.pos.clone().sub(g.player.pos);
    check(
      'an outbound held throw crosses the occluded seam without an invisible wall or recall theft',
      o.inOssuary && modeBeforeSeam && modeBeforeSeam !== 'held'
        && g.skull.mode !== 'held' && g.skull.mode !== 'gone'
        && relativeBefore && relativeAfter.distanceTo(relativeBefore) < 1.6
        && outboundElapsed < 5.8 && controlsLive(),
      {
        outboundLaunch, modeBeforeSeam, modeAfter: g.skull.mode, elapsed: round(outboundElapsed),
        relativeDelta: relativeBefore ? round(relativeAfter.distanceTo(relativeBefore)) : null,
      },
    );
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    waitHeld(3.2);

    // The wheel is a held counterweight, not a one-click button. Exercise the
    // whole adversarial lifecycle with live throw input: a short pull must
    // release and decay; dying during a partial pull must not let a dead-life
    // anchor finish the gate; then the same honest retry must solve it.
    const stageWheelAttempt = () => {
      o.inOssuary = true;
      o.solved = false;
      o.pulling = false;
      o.target.enabled = true;
      o.portalCooldown = 0.45;
      g.flags.delete('ossuaryCleared');
      g.flags.delete('graveyardCleared');
      g.director.setAct('graveyard', true);
      g.player.pos.set(o.origin.x, o.origin.floor, o.origin.z + 23.35);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.skull.holdNow();
      const target = o.wheel.getWorldPosition(g.player.pos.clone());
      aimAt(target);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      let elapsed = 0;
      while (g.skull.mode !== 'anchored' && elapsed < 1.1) {
        F.stepWith(1 / 120, { throwHeld: true }, false);
        elapsed += 1 / 120;
      }
      return { latched: g.skull.mode === 'anchored', elapsed };
    };

    o.progress = 0;
    const earlyLatch = stageWheelAttempt();
    F.stepWith(0.46, { throwHeld: true }, false);
    const earlyProgress = o.progress;
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    const earlyReleaseMode = g.skull.mode;
    F.stepWith(0.32, {}, false);
    const decayedProgress = o.progress;
    const earlyReturn = waitHeld(3.0);
    F.stepWith(0.08, {}, false);
    check(
      'releasing an early ossuary pull returns immediately and partial progress visibly decays',
      earlyLatch.latched && earlyProgress > 0.12 && earlyProgress < 0.65
        && earlyReleaseMode === 'returning'
        && decayedProgress < earlyProgress - 0.12
        && earlyReturn.held && o.target.enabled && !o.solved,
      {
        earlyLatch, earlyProgress: round(earlyProgress), earlyReleaseMode,
        decayedProgress: round(decayedProgress), earlyReturn,
        targetEnabled: o.target.enabled, solved: o.solved,
      },
    );

    o.progress = 0;
    const deathLatch = stageWheelAttempt();
    F.stepWith(0.52, { throwHeld: true }, false);
    const deathProgress = o.progress;
    const checkpointBeforePullDeath = g.checkpointPose ? { ...g.checkpointPose } : null;
    const closedExitBeforePullDeath = o.exitCollider.max.y;
    const gateBeforePullDeath = {
      opening: g.graveyardGate?.opening,
      open: g.graveyardGate?.open,
      ritualTarget: g.graveyardGate?.ritualTarget,
      t: g.graveyardGate?.t,
    };
    g.director.death(null);
    // Maliciously keep the browser button held well past the 1.7s solve time.
    // Source—not a manufactured release edge—must cancel the dead-life pull.
    F.stepWith(2.15, { throwHeld: true }, false);
    const checkpointUnchangedWhileDead = checkpointBeforePullDeath && g.checkpointPose
      && ['act', 'x', 'y', 'z', 'yaw', 'pitch']
        .every((key) => g.checkpointPose[key] === checkpointBeforePullDeath[key]);
    const deadLifeState = {
      dead: g.dead,
      progress: o.progress,
      solved: o.solved,
      mode: g.skull.mode,
      exitMaxY: o.exitCollider.max.y,
      gate: {
        opening: g.graveyardGate?.opening,
        open: g.graveyardGate?.open,
        ritualTarget: g.graveyardGate?.ritualTarget,
        t: g.graveyardGate?.t,
      },
      checkpointUnchanged: checkpointUnchangedWhileDead,
      cleared: g.flags.has('ossuaryCleared') || g.flags.has('graveyardCleared'),
    };
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    F.stepWith(1.7, {}, false);
    check(
      'death during a partial pull cannot finish or ghost-trigger the ossuary gate',
      deathLatch.latched && deathProgress > 0.14 && deathProgress < 0.7
        && deadLifeState.dead && deadLifeState.progress < 0.01 && !deadLifeState.solved
        && !deadLifeState.cleared
        && deadLifeState.exitMaxY === closedExitBeforePullDeath
        && deadLifeState.gate.opening === gateBeforePullDeath.opening
        && deadLifeState.gate.open === gateBeforePullDeath.open
        && deadLifeState.gate.ritualTarget === gateBeforePullDeath.ritualTarget
        && deadLifeState.gate.t === gateBeforePullDeath.t
        && deadLifeState.checkpointUnchanged
        && !o.solved && o.progress < 0.01
        && !g.flags.has('ossuaryCleared') && !g.flags.has('graveyardCleared')
        && o.target.enabled && g.skull.mode === 'held' && controlsLive(),
      {
        deathLatch, deathProgress: round(deathProgress),
        deadLifeState,
        progressAfterRespawn: round(o.progress), solved: o.solved,
        clearedFlags: {
          ossuary: g.flags.has('ossuaryCleared'), graveyard: g.flags.has('graveyardCleared'),
        },
        targetEnabled: o.target.enabled, skull: g.skull.mode,
        inOssuary: o.inOssuary, controlsLive: controlsLive(),
      },
    );

    o.progress = 0;
    const retryLatch = stageWheelAttempt();
    F.stepWith(1.86, { throwHeld: true }, false);
    check(
      'retrying and holding the same wheel pull opens both authored exits',
      retryLatch.latched && o.solved && o.progress >= 1
        && g.flags.has('ossuaryCleared') && g.flags.has('graveyardCleared')
        && o.exitCollider.max.y === o.exitCollider.min.y
        && g.graveyardGate?.opening && g.graveyardGate?.ritualTarget === 3,
      {
        retryLatch, solved: o.solved, progress: round(o.progress),
        exitOpen: o.exitCollider.max.y === o.exitCollider.min.y,
        gateOpening: g.graveyardGate?.opening,
        gateRitualTarget: g.graveyardGate?.ritualTarget,
      },
    );
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    waitHeld(3.2);

    // The solved route must still require a real floor-to-surface climb before
    // the forest handoff can occur.
    o.inOssuary = true;
    o.portalCooldown = 0;
    g.director.setAct('graveyard', true);
    const far = o.farConnector;
    g.player.pos.set(o.origin.x, o.origin.floor, far.z0 - 0.14);
    g.player.vel.set(0, 0, 2.1);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player.yaw = Math.PI;
    g.player.pitch = 0.284;
    g.player._sync(0);
    const farView = { yaw: g.player.yaw, pitch: g.player.pitch };
    let farHighest = g.player.pos.y;
    let farElapsed = 0;
    while (!g.flags.has('ossuaryExited') && farElapsed < 8) {
      F.stepWith(1 / 120, { moveZ: 1 }, false);
      farHighest = Math.max(farHighest, g.player.pos.y);
      farElapsed += 1 / 120;
    }
    const farProjection = g.forest.project(g.player.pos.x, g.player.pos.z);
    const farTreads = far.treadCount;
    check(
      'far ossuary exit requires a physical floor-to-surface climb',
      g.flags.has('ossuaryExited') && farHighest > -0.8 && farElapsed > 0.9
        && farTreads === 15
        && far.surface?.name === 'forest-side ossuary emergence hatch',
      { exited: g.flags.has('ossuaryExited'), farHighest: round(farHighest), elapsed: round(farElapsed), farTreads, surface: far.surface?.name },
    );
    check(
      'forest emergence preserves view, live controls, and a coherent gate-side position',
      g.act === 'forest' && farProjection && farProjection.s < 2.2
        && Math.abs(wrapAngle(g.player.yaw - farView.yaw)) < 0.002
        && Math.abs(g.player.pitch - farView.pitch) < 0.002
        && controlsLive(),
      { act: g.act, projection: farProjection && { s: round(farProjection.s), lat: round(farProjection.lat) }, view: { yaw: round(g.player.yaw), pitch: round(g.player.pitch) } },
    );

    // ------------------------------------------------------------- rope chain
    F.teleport('forest');
    F.stepWith(0.1, {}, false);
    g.enemies.clear();
    g.director.kneeler = null;
    g.director._kneelerGrace = 999;
    const forest = g.forest;
    const chain = forest.canopyChain;

    // Completed seal trees remain as cumulative geometry but leave the hot
    // animation list. Once a non-forest district owns the frame, story-prop and
    // seal visit counters must stay flat across ordinary fixed steps.
    forest.sealS = 12;
    forest._sealPlaced = 7;
    forest._placeSeal(false);
    const sealHistoryBeforeRetire = forest.sealAnim.length;
    const sealActiveBeforeRetire = forest._sealActive.length;
    F.stepWith(4.8, {}, false);
    const sealRetiredInForest = forest._sealActive.length;
    F.teleport('graveyard');
    F.stepWith(0.12, {}, false);
    const inactiveStatsBefore = { ...forest.runtimeStats };
    F.stepWith(1.0, {}, false);
    const inactiveStatsAfter = { ...forest.runtimeStats };
    check(
      'forest hot loops retire completed seals and early-out outside the forest',
      sealHistoryBeforeRetire > 0 && sealActiveBeforeRetire > 0
        && sealRetiredInForest === 0 && forest._sealActive.length === 0
        && inactiveStatsAfter.storyLivePasses === inactiveStatsBefore.storyLivePasses
        && inactiveStatsAfter.sealActiveVisits === inactiveStatsBefore.sealActiveVisits
        && forest.storyProps.every((prop) => !prop.target.enabled && !prop.loop),
      {
        sealHistoryBeforeRetire, sealActiveBeforeRetire, sealRetiredInForest,
        inactiveStatsBefore, inactiveStatsAfter,
      },
    );
    F.teleport('forest');
    F.stepWith(0.12, {}, false);
    g.enemies.clear();
    g.director.kneeler = null;
    g.director._kneelerGrace = 999;

    // Reaching an optional rope's hidden landing is itself an authored reveal.
    // A corpse settling there must not mint the flag or consume its one-shot;
    // the identical living position after respawn still earns both.
    const secretLine = forest.optionalRopes.find((line) => line.id === 'searchers-line');
    g.flags.delete(secretLine.flag);
    g.flags.add(`${secretLine.flag}:latched`);
    secretLine.boundary.openT = 1;
    secretLine.boundary.group.visible = false;
    const originalSecretCue = g.audio.metalDrop;
    let secretCueCount = 0;
    g.audio.metalDrop = (...args) => {
      secretCueCount++;
      return originalSecretCue.apply(g.audio, args);
    };
    g.player.pos.copy(secretLine.secretPos);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    g.director.death(null);
    F.stepWith(0.22, {}, false);
    const deadSecretState = {
      dead: g.dead, discovered: g.flags.has(secretLine.flag), cues: secretCueCount,
    };
    g.director.respawn();
    F.stepWith(0.08, {}, false);
    F.teleport('forest');
    F.stepWith(0.05, {}, false);
    g.player.pos.copy(secretLine.secretPos);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(0.05, {}, false);
    const liveSecretState = {
      dead: g.dead, discovered: g.flags.has(secretLine.flag), cues: secretCueCount,
    };
    g.audio.metalDrop = originalSecretCue;
    check(
      'optional rope discovery and its one-shot wait for the living retry',
      deadSecretState.dead && !deadSecretState.discovered && deadSecretState.cues === 0
        && !liveSecretState.dead && liveSecretState.discovered && liveSecretState.cues === 1,
      { id: secretLine.id, deadSecretState, liveSecretState },
    );

    // A loud world object may invite bounded company, but the delayed arrival
    // cannot materialize or consume its reservation behind the death veil.
    // Respawn cancels that dead-life invitation; repeating the same live noise
    // must still produce the authored consequence.
    g.director.arena = null;
    g.director._companyDebt = 0;
    g.director._companyPending = 0;
    const companyNoiseAt = forest.posAt(28, 0);
    const companyScheduled = g.director.forestNoise(companyNoiseAt, 1, 'impact');
    const companyPendingBeforeDeath = g.director._companyPending;
    g.director.death(null);
    const debtBeforeDeadNoise = g.director._companyDebt;
    const deadNoiseAccepted = g.director.forestNoise(companyNoiseAt, 1, 'impact');
    F.stepWith(2.72, {}, false);
    const deadCompanyState = {
      dead: g.dead,
      pending: g.director._companyPending,
      spawned: g.enemies.list.filter((enemy) => enemy.forestCompany).length,
      debt: round(g.director._companyDebt),
    };
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    g.enemies.clear();
    g.director._kneelerGrace = 999;
    g.director.arena = null;
    g.director._companyDebt = 0;
    const companyRetry = g.director.forestNoise(companyNoiseAt, 1, 'impact');
    F.stepWith(2.55, {}, false);
    const liveCompany = g.enemies.list.filter((enemy) => enemy.forestCompany);
    check(
      'forest company invitation pauses during death and remains available on retry',
      companyScheduled && companyPendingBeforeDeath === 1 && !deadNoiseAccepted
        && deadCompanyState.dead && deadCompanyState.pending === 1
        && deadCompanyState.spawned === 0
        && Math.abs(deadCompanyState.debt - debtBeforeDeadNoise) < 0.001
        && companyRetry && liveCompany.length === 1 && g.director._companyPending === 0,
      {
        companyScheduled, companyPendingBeforeDeath, deadNoiseAccepted,
        debtBeforeDeadNoise: round(debtBeforeDeadNoise), deadCompanyState,
        companyRetry, liveCompany: liveCompany.length, pendingAfterRetry: g.director._companyPending,
      },
    );
    g.enemies.clear();
    g.director._companyDebt = 0;
    g.director._companyPending = 0;

    const resetChain = () => {
      g.player.abortSwing();
      g.skull.holdNow();
      chain.progress = 0;
      chain.completed = false;
      for (const stage of chain.stages) {
        g.flags.delete(stage.latchedFlag);
        g.flags.delete(stage.landedFlag);
        stage.target.enabled = stage.index === 0;
      }
      g.flags.delete('forestCanopyCleared');
    };
    const placeAt = (point, yawTarget = null) => {
      g.dead = false;
      g.player.abortSwing();
      forest.reseat(point.x, point.z);
      const y = forest.heightAt(point.x, point.z);
      g.player.pos.set(point.x, y + 0.025, point.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.frozen = false;
      g.player.movementLocked = false;
      g.player.noise = 0;
      g.player._sync(0);
      if (yawTarget) aimAt(yawTarget);
    };
    const takeLatch = (stage, seconds = 1.5) => {
      aimAt(stage.pivot);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true, moveZ: 1, run: true }, false);
      let elapsed = 1 / 120;
      while (!g.player.swing && elapsed < seconds) {
        aimAt(stage.pivot);
        F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
        elapsed += 1 / 120;
      }
      return { latched: !!g.player.swing && g.flags.has(stage.latchedFlag), elapsed };
    };

    // Each earned latch is allowed to survive a death, but the dead body is
    // never allowed to "land," unlock the next target, clear the chain, or
    // spend a checkpoint. Move the corpse onto every landing deliberately so
    // this tests source gating rather than relying on ordinary respawn motion.
    const deadLandingResults = [];
    for (let index = 0; index < chain.stages.length; index++) {
      resetChain();
      for (let prior = 0; prior < index; prior++) {
        g.flag(chain.stages[prior].latchedFlag);
        g.flag(chain.stages[prior].landedFlag);
      }
      F.stepWith(0.03, {}, false);
      const stage = chain.stages[index];
      placeAt(stage.start);
      g.checkpoint('forest');
      const checkpointBefore = g.checkpointPose ? { ...g.checkpointPose } : null;
      const latch = takeLatch(stage);
      g.director.death(null);
      g.player.abortSwing();
      g.skull.holdNow();
      g.player.pos.copy(stage.landing);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);
      F.stepWith(0.72, { throwHeld: true }, false);
      deadLandingResults.push({
        stage: index + 1, latched: latch.latched,
        noLanding: !g.flags.has(stage.landedFlag),
        noClear: !g.flags.has('forestCanopyCleared') && !chain.completed,
        targetsDisabled: chain.stages.every((candidate) => !candidate.target.enabled),
        checkpointSame: sameCheckpoint(checkpointBefore, g.checkpointPose),
        dead: g.dead,
      });
      g.director.respawn();
      F.stepWith(0.12, {}, false);
    }
    check(
      'death before any canopy landing cannot enable, checkpoint, or clear the route',
      deadLandingResults.length === 3
        && deadLandingResults.every((result) => result.latched && result.noLanding
          && result.noClear && result.targetsDisabled && result.checkpointSame && result.dead),
      deadLandingResults,
    );
    g.director._kneelerGrace = 999;
    resetChain();

    const stageGeometry = chain.stages.map((stage) => {
      const start = forest.project(stage.start.x, stage.start.z);
      const landing = forest.project(stage.landing.x, stage.landing.z);
      return {
        id: stage.id,
        startS: round(start?.s), landingS: round(landing?.s),
        startLat: round(start?.lat), landingLat: round(landing?.lat),
        throwDistance: round(stage.start.distanceTo(stage.pivot)),
        landingGround: round(forest.heightAt(stage.landing.x, stage.landing.z)),
        landingY: round(stage.landing.y),
      };
    });
    check(
      'three visible knots form one reachable route over and beyond the Kneeler',
      chain.root?.name === 'reachable Kneeler canopy bypass chain'
        && chain.stages.length === 3 && chain.startS < chain.kneelerS
        && chain.endS > chain.kneelerS + 7
        && chain.stages[0].target.enabled && !chain.stages[1].target.enabled
        && stageGeometry.every((s) => s.throwDistance < 8.4
          && Math.abs(s.landingGround - s.landingY) < 0.03
          && Math.abs(s.startLat) < 1.2 && Math.abs(s.landingLat) < 1.2),
      { startS: chain.startS, kneelerS: chain.kneelerS, endS: chain.endS, stages: stageGeometry },
    );

    // Forgiving route: swing, release, catch, land on the marked trail scar,
    // then use the next knot from ordinary ground.
    resetChain();
    placeAt(chain.stages[0].start);
    const shelfLatch = takeLatch(chain.stages[0]);
    for (let t = 0; t < 0.64 && g.player.swing; t += 1 / 120) {
      aimAt(chain.stages[0].landing.clone().setY(g.player.pos.y + 1.62));
      F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
    }
    const shelfReleaseY = g.player.pos.y;
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false, moveZ: 1, run: true }, false);
    let shelfElapsed = 0;
    while ((!g.player.grounded || g.skull.mode !== 'held') && shelfElapsed < 4.2) {
      stepToward(chain.stages[0].landing.clone().setY(g.player.pos.y + 1.62), 1 / 120, { run: true });
      shelfElapsed += 1 / 120;
    }
    F.stepWith(0.08, {}, false);
    const shelfProjection = forest.project(g.player.pos.x, g.player.pos.z);
    const shelfSecond = takeLatch(chain.stages[1]);
    check(
      'ordinary shelf route releases, returns, lands, and starts the next real throw',
      shelfLatch.latched && shelfReleaseY > forest.heightAt(g.player.pos.x, g.player.pos.z) + 0.3
        && g.skull.mode === 'anchored' && shelfSecond.latched
        && shelfProjection?.s >= chain.stages[0].landingS - 2.3
        && g.flags.has(chain.stages[0].landedFlag)
        && controlsLive(),
      {
        firstLatch: shelfLatch, releaseY: round(shelfReleaseY),
        shelfElapsed: round(shelfElapsed), projection: shelfProjection && { s: round(shelfProjection.s), lat: round(shelfProjection.lat) },
        returnedBeforeSecond: shelfSecond.latched, landedFlag: g.flags.has(chain.stages[0].landedFlag),
      },
    );
    // Cleanly release the second shelf probe before the stylish run.
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    waitHeld(3.2);

    // Stylish route: release knot one, catch the returning skull in the air,
    // and press again immediately.  Stage two must be earned by a second live
    // outbound flight while feet are still above the trail—never auto-grabbed.
    resetChain();
    placeAt(chain.stages[0].start);
    const airFirst = takeLatch(chain.stages[0]);
    let airHold = 0;
    while (g.player.swing && airHold < 0.82) {
      aimAt(chain.stages[0].landing.clone().setY(g.player.pos.y + 1.62));
      F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
      airHold += 1 / 120;
      if (g.player.pos.y > chain.stages[0].landing.y + 1.15 && airHold > 0.32) break;
    }
    const airReleaseY = g.player.pos.y;
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false, moveZ: 1, run: true }, false);
    let catchElapsed = 0;
    let caughtAirborne = false;
    while (g.skull.mode !== 'held' && catchElapsed < 2.4) {
      aimAt(chain.stages[1].pivot);
      F.stepWith(1 / 120, { moveZ: 1, run: true }, false);
      catchElapsed += 1 / 120;
    }
    if (g.skull.mode === 'held' && !g.player.grounded
      && g.player.pos.y > forest.heightAt(g.player.pos.x, g.player.pos.z) + 0.18) {
      caughtAirborne = true;
      aimAt(chain.stages[1].pivot);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true, moveZ: 1, run: true }, false);
    }
    let secondElapsed = 0;
    while (!g.player.swing && g.skull.mode !== 'held' && secondElapsed < 1.4) {
      aimAt(chain.stages[1].pivot);
      F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
      secondElapsed += 1 / 120;
    }
    const secondLatchedAirborne = caughtAirborne && !!g.player.swing
      && g.flags.has(chain.stages[1].latchedFlag);
    check(
      'a genuine release-catch-rethrow transfer reaches knot two before landing',
      airFirst.latched && airReleaseY > chain.stages[0].landing.y + 0.35
        && caughtAirborne && secondLatchedAirborne && controlsLive(),
      {
        firstLatch: airFirst, hold: round(airHold), releaseY: round(airReleaseY),
        catchElapsed: round(catchElapsed), caughtAirborne, secondElapsed: round(secondElapsed),
        secondLatchedAirborne, playerY: round(g.player.pos.y), ground: round(forest.heightAt(g.player.pos.x, g.player.pos.z)),
      },
    );

    // Finish stage two to its forgiving floor and take stage three normally;
    // completion must checkpoint the far side for an ordinary death/respawn.
    for (let t = 0; t < 0.58 && g.player.swing; t += 1 / 120) {
      aimAt(chain.stages[1].landing.clone().setY(g.player.pos.y + 1.62));
      F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
    }
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false, moveZ: 1, run: true }, false);
    let secondLandT = 0;
    while ((!g.player.grounded || g.skull.mode !== 'held') && secondLandT < 4.5) {
      stepToward(chain.stages[1].landing.clone().setY(g.player.pos.y + 1.62), 1 / 120, { run: true });
      secondLandT += 1 / 120;
    }
    F.stepWith(0.08, {}, false);
    const thirdLatch = takeLatch(chain.stages[2]);
    for (let t = 0; t < 0.62 && g.player.swing; t += 1 / 120) {
      aimAt(chain.stages[2].landing.clone().setY(g.player.pos.y + 1.62));
      F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
    }
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false, moveZ: 1, run: true }, false);
    let finalLandT = 0;
    while ((!g.player.grounded || g.skull.mode !== 'held' || !g.flags.has('forestCanopyCleared')) && finalLandT < 5.5) {
      stepToward(chain.stages[2].landing.clone().setY(g.player.pos.y + 1.62), 1 / 120, { run: true });
      finalLandT += 1 / 120;
    }
    const finalProjection = forest.project(g.player.pos.x, g.player.pos.z);
    check(
      'rope chain has a bounded grounded recovery and rejoins beyond the strike corridor',
      thirdLatch.latched && chain.completed && g.flags.has('forestCanopyCleared')
        && finalProjection?.s > chain.kneelerS + 6
        && g.player.grounded && g.skull.mode === 'held' && controlsLive(),
      { thirdLatch, finalLandT: round(finalLandT), completed: chain.completed, projection: finalProjection && { s: round(finalProjection.s), lat: round(finalProjection.lat) } },
    );

    const checkpointBeforeDeath = { ...g.checkpointPose };
    g.director.death(null);
    F.stepWith(1.15, {}, false);
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    const respawnProjection = forest.project(g.player.pos.x, g.player.pos.z);
    const graceBefore = g.director._kneelerGrace;
    // Outwait the entire grace while standing in place.  The pass flag—not a
    // conveniently short test window—must prevent the original instant boss
    // rebuild at the far checkpoint.
    F.stepWith(3.65, {}, false);
    check(
      'canopy checkpoint survives death with a live return route and Kneeler grace',
      checkpointBeforeDeath?.act === 'forest'
        && respawnProjection?.s > chain.kneelerS + 5
        && g.flags.has('forestCanopyCleared')
        && g.flags.has('kneelerPassed')
        && graceBefore > 3 && g.director._kneelerGrace <= 0 && !g.director.kneeler
        && controlsLive(),
      {
        checkpoint: checkpointBeforeDeath,
        respawn: respawnProjection && { s: round(respawnProjection.s), lat: round(respawnProjection.lat) },
        graceBefore: round(graceBefore), graceAfter: round(g.director._kneelerGrace),
        passed: g.flags.has('kneelerPassed'), kneelerRespawned: !!g.director.kneeler,
      },
    );

    // ------------------------------------------------------- dead arena time
    // First, schedule the final wave and die before its zero-delay member gets
    // a living tick. All four reservations must remain reservations while the
    // veil is up; no callback may silently decrement its way to completion.
    g.enemies.clear();
    g.flags.delete('arenaCleared');
    g.director.setAct('forest', true);
    g.director.arena = null;
    const arenaCenter = forest.posAt(forest.arenaS(), 0);
    placeAt(arenaCenter);
    g.checkpoint('forest');
    const callbackCheckpoint = g.checkpointPose ? { ...g.checkpointPose } : null;
    const callbackArena = {
      center: arenaCenter.clone(), wave: 2, alive: 0, pending: 0, t: -0.01,
      done: false, status: 'active', cancelReason: null,
    };
    g.director.arena = callbackArena;
    g.director._updateArena(0.02);
    const scheduledPending = callbackArena.pending;
    g.director.death(null);
    F.stepWith(3.8, {}, false);
    const callbackDeadState = {
      dead: g.dead, wave: callbackArena.wave, pending: callbackArena.pending,
      done: callbackArena.done, status: callbackArena.status,
      spawned: g.enemies.list.filter((enemy) => enemy.forestArena).length,
      cleared: g.flags.has('arenaCleared'),
      checkpointSame: sameCheckpoint(callbackCheckpoint, g.checkpointPose),
    };
    check(
      'forest wave callbacks pause while dead without spawning or spending completion',
      scheduledPending === 4 && callbackDeadState.dead
        && callbackDeadState.wave === 3 && callbackDeadState.pending === 4
        && !callbackDeadState.done && callbackDeadState.status === 'active'
        && callbackDeadState.spawned === 0 && !callbackDeadState.cleared
        && callbackDeadState.checkpointSame,
      { scheduledPending, ...callbackDeadState },
    );
    g.director.respawn();
    F.stepWith(0.12, {}, false);

    // Then model the exact mutual-kill seam: the final arena enemy is already
    // dying on the same frame as the player. Waiting beyond the death reveal
    // must not grow the skull, set arenaCleared, or checkpoint the corpse.
    g.flags.delete('arenaCleared');
    placeAt(arenaCenter);
    g.checkpoint('forest');
    const mutualCheckpoint = g.checkpointPose ? { ...g.checkpointPose } : null;
    const mutualArena = {
      center: arenaCenter.clone(), wave: 3, alive: 1, pending: 0, t: 0,
      done: false, status: 'active', cancelReason: null,
    };
    g.director.arena = mutualArena;
    const lastEnemy = g.enemies.spawn('walker', arenaCenter.x + 2, arenaCenter.z, 'chase');
    lastEnemy.forestArena = true;
    lastEnemy.state = 'dying';
    const stageBeforeMutual = g.director.stageGrown;
    g.director.death(lastEnemy);
    F.stepWith(2.4, {}, false);
    const mutualDeadState = {
      dead: g.dead, done: mutualArena.done, status: mutualArena.status,
      cleared: g.flags.has('arenaCleared'), stageGrown: g.director.stageGrown,
      checkpointSame: sameCheckpoint(mutualCheckpoint, g.checkpointPose),
    };
    check(
      'a mutual kill cannot complete the forest arena before respawn',
      mutualDeadState.dead && !mutualDeadState.done && mutualDeadState.status === 'active'
        && !mutualDeadState.cleared && mutualDeadState.stageGrown === stageBeforeMutual
        && mutualDeadState.checkpointSame,
      { stageBeforeMutual, ...mutualDeadState },
    );
    g.director.respawn();
    F.stepWith(0.12, {}, false);

    // Death also pauses the two authored non-combat gestures in this stretch:
    // the Kneeler may not wake/sting and the skull may not gaze/whisper while
    // Alex has no movement with which to answer them.
    g.enemies.clear();
    g.director.kneeler = null;
    g.flags.delete('kneelerPassed');
    g.director._kneelerGrace = 0;
    placeAt(forest.posAt(chain.kneelerS - 2.5, 0));
    g.director._placeKneeler();
    const pausedKneeler = g.director.kneeler;
    pausedKneeler.state = 'dormant';
    g.player.noise = 1;
    g.director._gesturing = true;
    g.director._gestureT = 0;
    g.skull.holdNow();
    g.skull.gazeOverride = null;
    g.director.death(null);
    F.stepWith(0.65, {}, false);
    const pausedGestureState = {
      dead: g.dead, kneeler: pausedKneeler.state,
      gestureT: round(g.director._gestureT), gaze: !!g.skull.gazeOverride,
    };
    check(
      'Kneeler wake and skull gesture remain paused throughout death',
      pausedGestureState.dead && pausedGestureState.kneeler === 'dormant'
        && pausedGestureState.gestureT === 0 && !pausedGestureState.gaze,
      pausedGestureState,
    );
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    g.director._gesturing = false;

    // ------------------------------------------------------------- Kneeler
    g.enemies.clear();
    g.director.kneeler = null;
    g.director._kneelerGrace = 0;
    g.flags.delete('kneelerPassed');
    placeAt(forest.posAt(chain.kneelerS - 7.2, 0));
    g.skull.holdNow();
    g.director._placeKneeler();
    const kneeler = g.director.kneeler;
    const marker = kneeler?.mesh.userData.kneeler;
    // Aim through the authored pale burden itself.  A torso hit would prove
    // only the old generic capsule, not that the new wordless affordance tells
    // the truth at the exact bright silhouette the player sees.
    const target = marker.burden.getWorldPosition(marker.basePosition.clone());
    aimAt(target);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    let hitT = 0;
    while (kneeler.state !== 'stunned' && hitT < 1.5) {
      aimAt(target);
      F.stepWith(1 / 120, { throwHeld: true }, false);
      hitT += 1 / 120;
    }
    const stunAtHit = kneeler.stunT;
    F.stepWith(0.08, {}, false);
    const collapsed = marker && marker.burden.position.y < marker.basePosition.y - 0.25
      && marker.burden.scale.y < 0.75
      && marker.upper.rotation.x > 0.32
      && marker.head.position.y < marker.headBase.y - 0.12;
    let passT = 0;
    let maxS = forest.project(g.player.pos.x, g.player.pos.z)?.s || 0;
    while (passT < 2.25 && !g.dead) {
      const pr = forest.project(g.player.pos.x, g.player.pos.z);
      const forward = forest.posAt(Math.min(forest.length - 1, pr.s + 5), 0);
      stepToward(forward.clone().setY(g.player.pos.y + 1.62), 1 / 120, { run: true });
      maxS = Math.max(maxS, forest.project(g.player.pos.x, g.player.pos.z)?.s || 0);
      passT += 1 / 120;
    }
    check(
      'one skull hit visibly bows the immortal Kneeler for a usable ground window',
      hitT < 1.5 && g.flags.has('kneelerYielded') && stunAtHit > 2.45
        && collapsed && maxS > kneeler.authoredS + 2.6 && !g.dead,
      {
        hitT: round(hitT), target: target.toArray().map(round),
        targetAboveRoot: round(target.y - kneeler.pos.y), stunAtHit: round(stunAtHit),
        collapsed, bow: marker && {
          upperX: round(marker.upper.rotation.x),
          headDrop: round(marker.headBase.y - marker.head.position.y),
        },
        maxS: round(maxS), kneelerS: round(kneeler.authoredS), state: kneeler.state, dead: g.dead,
      },
    );
    check(
      'Kneeler affordance is high-value shape-and-motion, not hue-only UI',
      marker?.burden?.visible !== false && marker?.prongs?.length === 3
        && marker.ring?.geometry?.type === 'TorusGeometry'
        && kneeler.spec.hp === Infinity,
      { prongs: marker?.prongs?.length, ring: marker?.ring?.geometry?.type, hp: String(kneeler.spec.hp) },
    );

    // ------------------------------------------------------------- clearing
    F.teleport('clearing');
    F.stepWith(0.1, {}, false);
    const stones = g.bridgeStones;
    const submergedNear = stones[0];
    const submerged = {
      y: submergedNear.position.y,
      top: submergedNear.position.y + 0.25,
      ground: g.world.groundHeightAt(submergedNear.position.x, submergedNear.position.z, 0.5),
    };
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    F.stepWith(2.3, {}, false);
    const rising = {
      y: submergedNear.position.y,
      top: submergedNear.position.y + 0.25,
      ground: g.world.groundHeightAt(submergedNear.position.x, submergedNear.position.z, 0.5),
    };
    F.stepWith(6.2, {}, false);
    const near = stones[0];
    const second = stones[1];
    const nearTop = near.position.y + 0.25;
    const physicalTop = g.world.groundHeightAt(near.position.x, near.position.z, nearTop + 0.2);
    const dryLipZ = g.clearingCenter.z + 7;
    check(
      'the plunge pool begins with a real near-shore eighth stepping stone',
      stones.length === 8 && near.userData.nearShore
        && near.name === 'near-shore waterfall stepping stone'
        && Math.abs(near.position.z - dryLipZ) < 0.45
        && Math.hypot(second.position.x - near.position.x, second.position.z - near.position.z) < 2.15,
      { count: stones.length, name: near.name, dryGap: round(near.position.z - dryLipZ), nextGap: round(Math.hypot(second.position.x - near.position.x, second.position.z - near.position.z)) },
    );
    check(
      'the new visible stone top is the same collision ground the player uses',
      near.position.y > -0.2 && Math.abs(physicalTop - nearTop) < 0.035,
      { meshY: round(near.position.y), nearTop: round(nearTop), physicalTop: round(physicalTop) },
    );
    check(
      'submerged and still-rising stones do not become invisible support before the authored threshold',
      submerged.y < -0.35
        && Math.abs(submerged.ground - submerged.top) > 0.12
        && rising.y < -0.35
        && Math.abs(rising.ground - submerged.ground) < 0.0001,
      {
        submerged: Object.fromEntries(Object.entries(submerged).map(([k, v]) => [k, round(v)])),
        rising: Object.fromEntries(Object.entries(rising).map(([k, v]) => [k, round(v)])),
      },
    );
    g.player.pos.set(near.position.x, nearTop + 0.025, near.position.z);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    F.stepWith(0.35, {}, false);
    check(
      'standing on the added shore stone is stable and does not fall through',
      g.player.grounded && Math.abs(g.player.pos.y - nearTop) < 0.06 && !g.dead,
      { grounded: g.player.grounded, y: round(g.player.pos.y), top: round(nearTop), dead: g.dead },
    );

    const bridgeStateBeforeDeath = stones.map((stone) => stone.position.y);
    g.director.death(null);
    F.stepWith(0.42, {}, false);
    g.director.respawn();
    F.stepWith(0.3, {}, false);
    const respawnGround = g.world.groundHeightAt(g.player.pos.x, g.player.pos.z, g.player.pos.y + 0.4);
    check(
      'death on the first stone preserves the raised bridge and restores a live clearing checkpoint',
      !g.dead && g.act === 'clearing' && g.flags.has('waterfallTaken')
        && stones.every((stone, i) => Math.abs(stone.position.y - bridgeStateBeforeDeath[i]) < 1e-6)
        && Math.abs(g.player.pos.y - respawnGround) < 0.08,
      {
        act: g.act, dead: g.dead, player: g.player.pos.toArray().map(round),
        ground: round(respawnGround), bridge: stones.map((stone) => round(stone.position.y)),
      },
    );

    const dryStartZ = g.clearingCenter.z + 6.72;
    const dryStartY = g.world.groundHeightAt(g.clearingCenter.x, dryStartZ, 1);
    g.player.pos.set(g.clearingCenter.x, dryStartY, dryStartZ);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    const crossed = [];
    for (const stone of stones) {
      let frames = 0;
      while (Math.hypot(g.player.pos.x - stone.position.x, g.player.pos.z - stone.position.z) > 0.28
          && frames < 180 && !g.dead) {
        stepToward(stone.position.clone().setY(g.player.pos.y + 1.62), 1 / 120);
        frames++;
      }
      F.stepWith(0.1, {}, false);
      const top = stone.position.y + 0.25;
      crossed.push({
        index: stone.userData.bridgeIndex,
        frames,
        distance: Math.hypot(g.player.pos.x - stone.position.x, g.player.pos.z - stone.position.z),
        yError: Math.abs(g.player.pos.y - top),
        grounded: g.player.grounded,
      });
    }
    check(
      'ordinary movement crosses all eight overlapping physical stepping stones without a hidden gap',
      crossed.length === 8 && crossed.every((visit) => visit.frames < 180
        && visit.distance < 0.38 && visit.yError < 0.1 && visit.grounded) && !g.dead,
      crossed.map((visit) => ({ ...visit, distance: round(visit.distance), yError: round(visit.yError) })),
    );

    return checks;
  });

  for (const c of report.checks) {
    console.log(` ${c.passed ? 'PASS' : 'FAIL'} ${c.name}`
      + (c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`));
    if (!c.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(` browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
  writeFileSync(resultsPath('backhalf-traversal-polish.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);

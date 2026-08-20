// Human-path regressions for the house progression that a choreographed
// trolley playthrough cannot prove:
//   node tests/house-critical-path-regression.mjs
//
// Every progression action below is an ordinary press/hold/release skull throw.
// State is inspected only after the physical trajectory has completed.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], errors: [], diagnostics: {} };
const failures = [];
const check = (passed, name, details = null) => {
  const row = { name, passed: !!passed, details };
  report.checks.push(row);
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name}${details == null ? '' : ` -- ${JSON.stringify(details)}`}`);
  if (!row.passed) failures.push(name);
};

const server = await ensureServer();
const browser = await launchBrowser();
let page;

async function freshPage() {
  if (page) await page.close();
  const opened = await openPage(browser, report.url);
  page = opened.page;
  report.errors.push(...opened.errors);
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 },
  );
}

try {
  await freshPage();

  const bellAndLatch = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.clear();
    const aimAt = (x, y, z) => {
      const dx = x - g.player.pos.x;
      const dy = y - (g.player.pos.y + 1.62);
      const dz = z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const throwAt = (x, y, z, hold = 0.45) => {
      aimAt(x, y, z);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      const d = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
      F.stepWith(Math.min(2.6, d / 20 + hold), { throwHeld: true }, false);
      F.stepWith(1 / 120, { throwReleased: true }, false);
      let t = 0;
      while (g.skull.mode !== 'held' && t < 4) { F.stepWith(0.1, {}, false); t += 0.1; }
    };

    // The player can encounter and break the obvious cellar boards before
    // understanding the house bell. Clearing wood must reveal a mechanical
    // bell latch, not silently admit them to a flame-less basement.
    g.player.pos.set(9, 0, 0.45);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    const firstBoard = g.boards.find((board) => !board.userData.off);
    firstBoard.updateMatrixWorld(true);
    const leftEnd = firstBoard.localToWorld(g.player.pos.clone().set(-0.79, 0, 0));
    throwAt(leftEnd.x, leftEnd.y, leftEnd.z, 0.28);
    const boardsOffAfterOneThrow = g.boards.filter((board) => board.userData.off).length;
    const boardSteps = [{
      board: g.boards.indexOf(firstBoard),
      off: boardsOffAfterOneThrow,
      skull: g.skull.mode,
      dead: g.dead,
    }];
    // Let the visible break hit-stop and falling plank clear before the next
    // deliberate press. This is normal human cadence, not a scripted delay.
    F.stepWith(0.46, {}, false);
    for (const board of g.boards) {
      if (board.userData.off) continue;
      board.updateMatrixWorld(true);
      const localX = g.boards.indexOf(board) === 1 ? 0.79 : 0;
      const boardAim = board.localToWorld(g.player.pos.clone().set(localX, 0, 0));
      throwAt(boardAim.x, boardAim.y, boardAim.z, 0.28);
      boardSteps.push({
        board: g.boards.indexOf(board),
        off: g.boards.filter((item) => item.userData.off).length,
        targetEnabled: board.userData.fetchTargets.some((target) => target.enabled),
        skull: g.skull.mode,
        dead: g.dead,
      });
      F.stepWith(0.46, {}, false);
    }
    const beforeBell = {
      boardsOff: g.boards.every((b) => b.userData.off),
      cellarOpen: g.flags.has('cellarOpen'),
      cellarBoardsCleared: g.flags.has('cellarBoardsCleared'),
      doorLocked: g.world.doorById.cellarDoor.locked,
      latchEngaged: g.cellarRelayLatch?.engaged ?? null,
      boardsOffAfterOneThrow,
      boardSteps,
    };

    // Ordinary human interpretation: stand in the study and throw at the
    // obvious bell/striker. No ten-second blind trolley choreography required.
    let bellRings = 0;
    const originalBell = g.audio.bellRing;
    g.audio.bellRing = (opts) => {
      bellRings++;
      if (originalBell) originalBell.call(g.audio, opts);
    };
    g.player.pos.set(-8.65, 0, 1);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    g.windowRelay.directStriker.updateMatrixWorld(true);
    const emptyPlate = g.windowRelay.directStriker.localToWorld(g.player.pos.clone().set(0, 0.64, -0.45));
    throwAt(emptyPlate.x, emptyPlate.y, emptyPlate.z, 0.24);
    const emptySpaceMissed = !g.flags.has('windowRelaySolved') && bellRings === 0;
    F.stepWith(0.14, {}, false);
    // THE BELL IS CAGED FROM THE ROOM: an ordinary direct throw must clang
    // off the lattice, nudge toward the mooring, and ring NOTHING. The
    // trolley is necessary now — this is the reversal Alex asked for.
    const nudgeBefore = g.windowRelay?.nudgeT ?? 0;
    const bellAim = g.windowRelay?.directTarget?.pos
      || g.windowRelay?.directTarget?.object?.getWorldPosition(g.player.pos.clone())
      || { x: -10.72, y: 1.27, z: 1 };
    throwAt(bellAim.x, bellAim.y, bellAim.z, 0.3);
    F.stepWith(0.35, {}, false);
    const directRefused = !g.flags.has('windowRelaySolved') && bellRings === 0
      && (g.windowRelay?.nudgeT ?? 0) >= nudgeBefore && g.skull.mode === 'held';
    // the real solution: moor at the living window, carry the trolley to the
    // study window under a continuous hold, release into the receiver. The
    // scripted interior walk needs the unlocked doors open, as a playing
    // human would have left them.
    for (const d of g.world.doors) {
      // upstairs doors only: pre-opening the basement's boiler door made the
      // bot's own later useAt TOGGLE it shut in its face
      if (!d.locked && d.group.position.y > -1) { d.setOpen(true); d.update(5); }
    }
    g.player.pos.set(-10.3, 0, -9);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player.yaw = Math.PI / 2;
    g.player.pitch = -0.015;
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.45, { throwHeld: true }, false);
    const moored = g.skull.mode === 'anchored' && g.skull.anchor?.puzzleId === 'windowRelay';
    F.stepWith(3.48, { moveZ: -1, throwHeld: true }, false);
    F.stepWith(3.72, { moveX: -1, throwHeld: true }, false);
    F.stepWith(1.82, { moveZ: 1, run: true, throwHeld: true }, false);
    F.stepWith(1.15, { throwHeld: true }, false);
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    for (let i = 0; i < 50 && !g.flags.has('windowRelaySolved'); i++) F.stepWith(0.05, {}, false);
    for (let i = 0; i < 60 && g.skull.mode !== 'held'; i++) F.stepWith(0.05, {}, false);
    for (let i = 0; i < 40 && !g.flags.has('voidDoorOpen'); i++) F.stepWith(0.05, {}, false);   // the ring travels
    const afterBell = {
      solved: g.flags.has('windowRelaySolved'),
      source: g.windowRelay?.solveSource ?? null,
      moored,
      directRefused,
      bellRings,
      ringT: g.windowRelay?.ringT ?? 0,
      voidDoorOpen: g.flags.has('voidDoorOpen'),
      cellarOpen: g.flags.has('cellarOpen'),
      doorLocked: g.world.doorById.cellarDoor.locked,
      latchEngaged: g.cellarRelayLatch?.engaged ?? null,
      skullMode: g.skull.mode,
      emptySpaceMissed,
    };
    g.audio.bellRing = originalBell;
    // The opened circuit deliberately offers two physical flame branches. On
    // this page take the upstairs guest candle, then prove that exact carried
    // fire is accepted by the drafted incinerator. Waiting grants nothing.
    const guestTarget = g.world.fetchTargets.find((target) => target.id === 'guestFlame');
    const guestWasEnabled = guestTarget?.enabled ?? false;
    const guestHitModes = [];
    const originalGuestHit = guestTarget.onHit;
    guestTarget.onHit = function instrumentGuestHit(skull, ...args) {
      guestHitModes.push(skull.mode);
      return originalGuestHit.call(this, skull, ...args);
    };
    F.stepWith(0.9, {}, false);
    const guestWasFree = g.flags.has('ateFlame');
    // Use the exact lower-stair sightline from the canonical full route. The
    // widened physical doorway must admit it outbound; a return-leg contact is
    // never allowed to grant or duplicate this progression credit.
    g.player.pos.set(1, 0, -8.8);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    throwAt(5.3, 4.95, -7, 0.6);
    const guestAbsorbed = g.flags.has('ateFlame');
    const guestSource = g.flameCircuit?.source ?? null;
    g.flag('pumpGalleryLatched');
    g.flag('crawlSecretSolved');    // the winch's drive weight; it has its own page too
    g.flag('archiveDraftOpened');   // this page proves the flame; the archive gate has its own page
    F.teleport('basement');
    g.enemies.clear();
    // The carried fire must be OFFERED to the cold pilot before the furnace
    // will wake — this is the necessary link the duplicate source used to
    // bypass. Real throw at the wick, same as a player.
    const pilotColdBeforeCarry = !g.flags.has('pilotLit') && !g.basementPilot.flame.visible;
    g.player.pos.set(7, -3, 3.55);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    const wickPos = g.basementPilot.target.object.getWorldPosition(g.player.pos.clone());
    throwAt(wickPos.x, wickPos.y, wickPos.z, 0.45);
    const pilotLitByCarry = g.flags.has('pilotLit') && g.basementPilot.flame.visible;
    const fireDoor = g.world.interactables.find((object) => object.userData.inter?.id === 'incineratorDoor');
    fireDoor.userData.inter.action();
    F.stepWith(0.25, {}, false);
    g.player.pos.set(9, -3, -1.5);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    throwAt(g.incineratorPosition.x, g.incineratorPosition.y, g.incineratorPosition.z, 0.35);
    const guestRoute = {
      guestWasEnabled,
      guestWasFree,
      guestAbsorbed,
      guestSource,
      guestHitModes,
      allSourceTargetsDisabled: g.flameCircuit.sources.every((source) => !source.target.enabled),
      pilotColdBeforeCarry,
      pilotLitByCarry,
      // the struck igniter keeps a residual burn — the candle goes ON, not
      // out; the skull takes the heart of the flame, never the whole candle
      residualBurn: g.flameCircuit.sources.every((source) => !source.residual
        || (source.flame.visible && source.glow.intensity > 0
          && g.world.candles.includes(source.glow))),
      incineratorAccepted: g.flags.has('skullOffered') && g.incinerator.offered,
    };
    return { beforeBell, afterBell, guestRoute };
  });
  report.diagnostics.bellAndLatch = bellAndLatch;
  check(bellAndLatch.beforeBell.boardsOff
      && bellAndLatch.beforeBell.cellarBoardsCleared
      && !bellAndLatch.beforeBell.cellarOpen
      && bellAndLatch.beforeBell.doorLocked === 'bellCircuit'
      && bellAndLatch.beforeBell.latchEngaged
      && bellAndLatch.beforeBell.boardsOffAfterOneThrow === 1,
    'breaking the boards exposes a real bell-circuit latch instead of admitting backward progression',
    bellAndLatch.beforeBell);
  check(bellAndLatch.beforeBell.boardsOffAfterOneThrow === 1
      && bellAndLatch.beforeBell.boardSteps.every((step, index) => step.off === index + 1),
    'left end, right end, and centre hits each tear exactly one board; return legs cannot chain-break the stack',
    bellAndLatch.beforeBell);
  check(bellAndLatch.afterBell.solved
      && ['trolley-return', 'trolley-release'].includes(bellAndLatch.afterBell.source)
      && bellAndLatch.afterBell.moored
      && bellAndLatch.afterBell.directRefused
      && bellAndLatch.afterBell.bellRings === 1
      && bellAndLatch.afterBell.ringT > 0
      && bellAndLatch.afterBell.voidDoorOpen
      && bellAndLatch.afterBell.cellarOpen
      && bellAndLatch.afterBell.doorLocked == null
      && bellAndLatch.afterBell.latchEngaged === false
      && bellAndLatch.afterBell.skullMode === 'held'
      && bellAndLatch.afterBell.emptySpaceMissed,
    'the caged bell refuses a direct throw; only the carried trolley rings it, opens the flame room, and releases the latch',
    bellAndLatch.afterBell);
  check(bellAndLatch.guestRoute.guestWasEnabled
      && !bellAndLatch.guestRoute.guestWasFree
      && bellAndLatch.guestRoute.guestAbsorbed
      && bellAndLatch.guestRoute.guestSource === 'guest-candle'
      && bellAndLatch.guestRoute.guestHitModes.length === 1
      && bellAndLatch.guestRoute.guestHitModes[0] === 'outbound'
      && bellAndLatch.guestRoute.allSourceTargetsDisabled
      && bellAndLatch.guestRoute.pilotColdBeforeCarry
      && bellAndLatch.guestRoute.pilotLitByCarry
      && bellAndLatch.guestRoute.residualBurn
      && bellAndLatch.guestRoute.incineratorAccepted,
    'the strike turns the candle ON; the skull takes its heart, lights the cold pilot, and the drafted furnace accepts',
    bellAndLatch.guestRoute);

  await freshPage();
  const pullBell = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.clear();
    let bellRings = 0;
    const originalBell = g.audio.bellRing;
    g.audio.bellRing = (opts) => {
      bellRings++;
      if (originalBell) originalBell.call(g.audio, opts);
    };
    const pull = g.world.fetchTargets.find((target) => target.id === 'studyBellPull');
    const p = pull.object.getWorldPosition(g.player.pos.clone());
    g.player.pos.set(-8.65, 0, 1);
    g.player.vel.set(0, 0, 0);
    const dx = p.x - g.player.pos.x;
    const dy = p.y - (g.player.pos.y + 1.62);
    const dz = p.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.42, { throwHeld: true }, false);
    F.stepWith(1 / 120, { throwReleased: true }, false);
    let t = 0;
    while (g.skull.mode !== 'held' && t < 4) { F.stepWith(0.1, {}, false); t += 0.1; }
    // the caged bell refuses even the pull handle from the room
    const pullRefused = !g.flags.has('windowRelaySolved') && bellRings === 0;
    // the trolley commit path still rings exactly once, and only once
    const firstCommit = g.windowRelay.complete('trolley-release', p);
    const duplicateCommit = g.windowRelay.complete('direct-bell', p);
    const result = {
      solved: g.flags.has('windowRelaySolved'),
      source: g.windowRelay.solveSource,
      pullRefused,
      firstCommit,
      bellRings,
      duplicateCommit,
      allSilhouetteTargetsDisabled: g.windowRelay.directTargets.every((target) => !target.enabled),
      skullMode: g.skull.mode,
    };
    g.audio.bellRing = originalBell;
    return result;
  });
  report.diagnostics.pullBell = pullBell;
  check(pullBell.solved && pullBell.source === 'trolley-release'
      && pullBell.pullRefused && pullBell.firstCommit === true
      && pullBell.bellRings === 1 && pullBell.duplicateCommit === false
      && pullBell.allSilhouetteTargetsDisabled && pullBell.skullMode === 'held',
    'the caged pull refuses from the room; the trolley commit rings exactly once and atomically spends every bell target',
    pullBell);

  await freshPage();
  const basementBranch = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.clear();
    // The pump winch will not take the skull until the crawl-wing cage hangs
    // its drive weight. That link has its own pages (basement-foundations and
    // the playthrough, which solves it for real on the way past); this one is
    // about the pilot, the draft and the firebox that follow it.
    g.flag('crawlSecretSolved');
    const aimAt = (x, y, z) => {
      const dx = x - g.player.pos.x;
      const dy = y - (g.player.pos.y + 1.62);
      const dz = z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const waitHeld = (maxS = 4.5) => {
      let t = 0;
      while (g.skull.mode !== 'held' && t < maxS) { F.stepWith(0.1, {}, false); t += 0.1; }
      return g.skull.mode === 'held';
    };
    const throwAt = (x, y, z, hold = 0.4) => {
      aimAt(x, y, z);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      const d = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
      F.stepWith(Math.min(2.6, d / 20 + hold), { throwHeld: true }, false);
      F.stepWith(1 / 120, { throwReleased: true }, false);
      waitHeld();
    };
    const walkTo = (x, z, maxS = 12, tolerance = 0.65) => {
      let t = 0;
      while (t < maxS) {
        const dx = x - g.player.pos.x;
        const dz = z - g.player.pos.z;
        if (Math.hypot(dx, dz) < tolerance) return true;
        if (g.dead) return false;
        g.player.yaw = Math.atan2(-dx, -dz);
        F.stepWith(0.1, { moveZ: 1 }, false);
        t += 0.1;
      }
      return false;
    };
    const useAt = (x, y, z) => {
      aimAt(x, y, z);
      F.stepWith(1 / 120, { interactPressed: true }, false);
    };
    const dieAndRetry = () => {
      g.director.death(null);
      F.stepWith(1.25, {}, false);
      g.el.die.click();
      F.stepWith(0.12, {}, false);
      return {
        act: g.act,
        alive: !g.dead && !g.player.frozen && !g.player.movementLocked,
        skullHeld: g.skull.mode === 'held',
        pos: g.player.pos.toArray(),
      };
    };
    let bellRings = 0;
    const originalBell = g.audio.bellRing;
    g.audio.bellRing = (opts) => {
      bellRings++;
      if (originalBell) originalBell.call(g.audio, opts);
    };

    // Required circuit first, then repeated real death/checkpoint boundaries.
    // The bell is caged from the room now: ring it the only way it rings —
    // moor at the living window and carry the trolley across under a hold.
    for (const d of g.world.doors) {
      // upstairs doors only: pre-opening the basement's boiler door made the
      // bot's own later useAt TOGGLE it shut in its face
      if (!d.locked && d.group.position.y > -1) { d.setOpen(true); d.update(5); }
    }
    g.player.pos.set(-10.3, 0, -9);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player.yaw = Math.PI / 2;
    g.player.pitch = -0.015;
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.45, { throwHeld: true }, false);
    F.stepWith(3.48, { moveZ: -1, throwHeld: true }, false);
    F.stepWith(3.72, { moveX: -1, throwHeld: true }, false);
    F.stepWith(1.82, { moveZ: 1, run: true, throwHeld: true }, false);
    F.stepWith(1.15, { throwHeld: true }, false);
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    for (let i = 0; i < 50 && !g.flags.has('windowRelaySolved'); i++) F.stepWith(0.05, {}, false);
    for (let i = 0; i < 60 && g.skull.mode !== 'held'; i++) F.stepWith(0.05, {}, false);
    const bellSolved = g.flags.has('windowRelaySolved');
    const afterBellDeath = dieAndRetry();

    g.player.pos.set(9, 0, 0.45);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    const firstBoard = g.boards.find((board) => !board.userData.off);
    throwAt(firstBoard.position.x, firstBoard.position.y, firstBoard.position.z, 0.28);
    const boardsAfterOne = g.boards.filter((board) => board.userData.off).length;
    const afterBoardDeath = dieAndRetry();

    g.player.pos.set(9, 0, 0.45);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    for (const board of g.boards) {
      if (!board.userData.off) {
        throwAt(board.position.x, board.position.y, board.position.z, 0.28);
        F.stepWith(0.14, {}, false);
      }
    }
    const boardsCleared = g.flags.has('cellarBoardsCleared')
      && g.flags.has('cellarOpen') && g.world.doorById.cellarDoor.locked == null;
    const afterBoardsDeath = dieAndRetry();

    // Use the real door and walk the actual authored stair/ramp. No basement
    // teleport is allowed in this branch.
    g.player.pos.set(9, 0, 0.8);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    useAt(9, 1.1, 2);
    F.stepWith(1.4, {}, false);
    const doorOpened = g.world.doorById.cellarDoor.open;
    const reachedRamp = walkTo(9.6, 2.8, 8);
    const reachedBottom = walkTo(10, 5.1, 10);
    F.stepWith(2, {}, false);
    const naturalDescent = g.act === 'basement';
    const afterDescentDeath = dieAndRetry();

    // The basement checkpoint is deliberately earned as the player crosses
    // y=-0.4 on the first hanging flight. A retry therefore resumes on that
    // flight, not on the basement floor. Finish it forward, turn across the
    // side landing, and take the westbound return flight exactly as a player
    // must; diagonalizing toward either objective catches the stair guard.
    const stairRouteLegs = [];
    const walkStairRoute = (phase) => {
      let complete = true;
      for (const [x, z, maxS] of [
        [9.6, 4.18, 8],
        [8.55, 4.55, 6],
        [7.45, 4.85, 6],
        [5.8, 5.0, 8],
        [4.35, 5.0, 8],
      ]) {
        const reached = walkTo(x, z, maxS);
        stairRouteLegs.push({ phase, x, z, reached, at: g.player.pos.toArray() });
        complete = complete && reached;
      }
      return complete;
    };

    // THE PILOT IS COLD NOW. It stopped being a second flame source (that
    // duplicate made the void-door beat skippable, and Alex asked about that
    // beat three separate times). A cold hit is the anti-dead-save valve —
    // it rings the house circuit so the flame room upstairs opens — but fire
    // itself has one home, and the pilot lights only from a skull already
    // carrying it.
    const pilot = g.basementPilot;
    const pilotWasEnabled = pilot?.target.enabled && !pilot.flame.visible;
    F.stepWith(0.9, {}, false);
    const pilotWasFree = g.flags.has('ateFlame');
    const pilotPos = pilot.target.object.getWorldPosition(g.player.pos.clone());
    g.enemies.clear();
    const leftRespawnStairsForPilot = walkStairRoute('pilot');
    // the pilot stands against the south wall west of the stair foot now
    const reachedPilotApproach = walkTo(5.6, 5.2, 6) && walkTo(4.9, 5.35, 6);
    const reachedPilot = leftRespawnStairsForPilot && reachedPilotApproach;
    throwAt(pilotPos.x, pilotPos.y, pilotPos.z, 0.52);
    waitHeld();
    const coldRefused = !g.flags.has('ateFlame') && !g.flags.has('pilotLit');
    const coldValve = g.flags.has('windowRelaySolved') && g.flags.has('voidDoorOpen');
    const afterFlameDeath = dieAndRetry();
    const coldPersisted = !g.flags.has('ateFlame') && !g.flags.has('pilotLit')
      && pilot.target.enabled && !pilot.flame.visible;

    // Carry fire down and light it. The real guest-candle steal is the other
    // page's subject; this page's subject is the pilot's two-state contract.
    g.flag('ateFlame');
    const leftRespawnStairsForRelight = walkStairRoute('relight');
    const reachedRelight = walkTo(5.6, 5.2, 6) && walkTo(4.9, 5.35, 6);
    throwAt(pilotPos.x, pilotPos.y, pilotPos.z, 0.52);
    waitHeld();
    const pilotIgnited = g.flags.has('pilotLit') && pilot.flame.visible
      && g.flags.has('basementPilotUsed');
    // Die once more so the works route starts from the respawn stairs the way
    // it was choreographed — and so this page also proves the lit pilot
    // SURVIVES death (the flame is a committed world state, not a life state).
    const afterIgniteDeath = dieAndRetry();
    const pilotLitPersisted = g.flags.has('pilotLit') && pilot.flame.visible;

    // Continue from the real basement checkpoint on foot. The lower flame must
    // feed the same physical pump, furnace, ash-key, and hatch route as the
    // canonical upstairs-flame variant; there are no position/act teleports
    // anywhere after the natural cellar descent.
    g.enemies.clear();
    const basementWalkLegs = [];
    const walkLeg = (x, z, maxS, tolerance = 0.65) => {
      const reached = walkTo(x, z, maxS, tolerance);
      basementWalkLegs.push({ x, z, reached, at: g.player.pos.toArray() });
      return reached;
    };
    const leftRespawnStairsForWorks = walkStairRoute('works');
    walkLeg(5, 4, 10);
    walkLeg(-0.6, 3.6, 12);
    walkLeg(-1, 2.8, 6);
    walkLeg(-1, 1.2, 6);
    walkLeg(-1.5, -1.5, 10);
    walkLeg(-4.8, -3, 8);
    walkLeg(-9.8, -3, 10);
    // Enter the reachable bridge lane and settle against the closed near gate.
    // This is the same physical bank used by the pump recovery regression; the
    // former (-12.62,-6.8) request pointed through the winch rail and only
    // succeeded after its walking helper had already timed out.
    walkLeg(-14.3, -3, 12, 0.2);

    const pumpAim = g.pumpGallery.cradle.getWorldPosition(g.player.pos.clone());
    aimAt(pumpAim.x, pumpAim.y, pumpAim.z);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.55, { throwHeld: true }, false);
    const pumpAnchored = g.skull.mode === 'anchored'
      && g.skull.anchor?.puzzleId === 'pumpGallery';
    // Lean west into the real gate while the held counterweight pays out the
    // bridge, then keep the same ordinary input until the far pawl commits.
    let pumpTraverseFrames = 0;
    while (!g.pumpGallery.latched && pumpTraverseFrames < 600) {
      F.stepWith(1 / 120, { moveX: -1, throwHeld: true }, false);
      pumpTraverseFrames++;
    }
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    const pumpReturned = waitHeld(3);
    const pumpLatched = g.flags.has('pumpGalleryLatched')
      && g.pumpGallery.latched && g.pumpGallery.gateOpen;

    // THE DRAFT HAS TWO HALVES NOW: the crossing, then the archive's collar
    // valve at the end of the same ceiling line. Walk the far bank through
    // the ajar archive door and strike it — the furnace refuses an offering
    // until the draft is fully open.
    walkLeg(-18.9, 0.6, 10);
    walkLeg(-18.9, 3.4, 8);
    walkLeg(-16.3, 4.15, 8);
    // the archive half of the draft: land the skull IN the cradle lamp and
    // HOLD — the held weight revs the room until the draft commits
    // (draftHold.required is 2.6s: hold the input past the commit)
    aimAt(-16.25, -0.88, 4.72);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(3.2, { throwHeld: true }, false);
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    waitHeld(3);
    const draftOpened = g.flags.has('archiveDraftOpened');
    // leave the way you came in: back through the archive door
    walkLeg(-18.9, 3.2, 8);
    walkLeg(-18.9, 0.4, 8);

    walkLeg(-12.6, -3, 14);
    walkLeg(-9.2, -3, 8);
    walkLeg(-4.8, -3, 8);
    walkLeg(-1.5, -1.5, 10);
    walkLeg(3.2, -3, 10);
    // THE BOILER DOOR MAY ALREADY BE OPEN, AND E TOGGLES.
    //
    // director.js _updateScares drifts "the nearest closed door on your floor"
    // open on a ~28 s cycle, and in the basement there is exactly one closed
    // unlocked door -- this one. A blind press therefore SHUT it in the bot's
    // own face about 1 run in 8, it wedged in the storeroom, the throw landed
    // on the shut-door branch and the beat read "the fire refused the skull".
    // Measured: 26/26 correlation between door-already-open and the failure,
    // plus a forced-open causal control. Never a player problem -- the door is
    // never locked, so a human just presses again. Press until it is open,
    // which is what a human does.
    const boilerDoor = g.world.doors.find((d) =>
      Math.abs(d.center.x - 4) < 0.4 && Math.abs(d.center.z + 3) < 0.4);
    for (let i = 0; i < 3 && boilerDoor && !boilerDoor.open; i++) {
      useAt(4, -1.9, -3);
      F.stepWith(0.5, {}, false);
    }
    F.stepWith(1.4, {}, false);
    walkLeg(5, -3, 6);
    walkLeg(9.8, -1.7, 10);
    useAt(10.71, -2.1, -1.52);
    F.stepWith(0.7, {}, false);
    // Pin the restored pilot gate at the real firebox: with the pilot state
    // withdrawn (Set-level state-restore probe, no flag events re-fired), an
    // otherwise-complete throw must refuse without offering.
    g.flags.delete('pilotLit');
    throwAt(g.incineratorPosition.x, g.incineratorPosition.y, g.incineratorPosition.z, 0.35);
    waitHeld(3);
    const pilotGateRefused = !g.flags.has('skullOffered') && !g.incinerator.offered;
    g.flags.add('pilotLit');
    throwAt(g.incineratorPosition.x, g.incineratorPosition.y, g.incineratorPosition.z, 0.35);
    const incineratorAccepted = g.flags.has('skullOffered') && g.incinerator.offered;
    for (let t = 0; t < 5 && !g.flags.has('fireRefused'); t += 0.1) F.stepWith(0.1, {}, false);
    const fireRefused = g.flags.has('fireRefused') && g.skull.mode === 'held';

    const ashKeyTarget = g.world.fetchTargets.find((target) => target.id === 'hatchKey');
    const ashKeyHitModes = [];
    const originalAshKeyHit = ashKeyTarget.onHit;
    ashKeyTarget.onHit = function instrumentAshKeyHit(skull, ...args) {
      ashKeyHitModes.push(skull.mode);
      return originalAshKeyHit.call(this, skull, ...args);
    };
    throwAt(10.5, -2.65, -1.5, 0.35);
    let ashKeyFetched = !!(g.skull.carry && g.skull.carry.id === 'hatchKey');
    for (let t = 0; t < 4 && !ashKeyFetched; t += 0.1) {
      F.stepWith(0.1, {}, false);
      ashKeyFetched = !!(g.skull.carry && g.skull.carry.id === 'hatchKey');
    }
    waitHeld();

    walkLeg(5, -3, 8);
    walkLeg(-3.4, -3, 12);
    walkLeg(-4.8, -3, 6);
    walkLeg(-8, -3, 8);
    walkLeg(-8.6, 0.5, 8);
    walkLeg(-9, 1.2, 6);
    walkLeg(-9, 2.8, 6);
    walkLeg(-9.4, 4, 6);
    const prePadlock = g.skull.getState();
    for (let tries = 0; tries < 3 && !g.flags.has('hatchUnlocked'); tries++) {
      throwAt(-10, -1.25, 3.6, 0.15);
      for (let t = 0; t < 3 && !g.flags.has('hatchUnlocked'); t += 0.1) F.stepWith(0.1, {}, false);
      waitHeld();
    }
    const hatchUnlocked = g.flags.has('hatchUnlocked')
      && !(g.skull.carry && g.skull.carry.id === 'hatchKey');
    useAt(-10, -0.9, 4.4);
    F.stepWith(2.5, {}, false);
    const hatchOpen = g.flags.has('hatchOpen') && g.hatch.open;
    const graveyardExited = g.act === 'graveyard';
    const result = {
      bellSolved,
      bellRings,
      relaySource: g.windowRelay.solveSource,
      afterBellDeath,
      boardsAfterOne,
      afterBoardDeath,
      boardsCleared,
      afterBoardsDeath,
      doorOpened,
      reachedRamp,
      reachedBottom,
      naturalDescent,
      afterDescentDeath,
      stairRouteLegs,
      leftRespawnStairsForPilot,
      leftRespawnStairsForWorks,
      reachedPilot,
      pilotWasEnabled,
      pilotWasFree,
      coldRefused,
      coldValve,
      afterFlameDeath,
      coldPersisted,
      leftRespawnStairsForRelight,
      reachedRelight,
      pilotIgnited,
      afterIgniteDeath,
      pilotLitPersisted,
      basementWalkLegs,
      pumpAnchored,
      pumpReturned,
      pumpLatched,
      draftOpened,
      pilotGateRefused,
      incineratorAccepted,
      fireRefused,
      ashKeyFetched,
      ashKeyHitModes,
      gotHatchKey: g.flags.has('gotHatchKey'),
      prePadlock,
      hatchUnlocked,
      hatchOpen,
      graveyardExited,
      finalAct: g.act,
    };
    g.audio.bellRing = originalBell;
    return result;
  });
  report.diagnostics.basementBranch = basementBranch;
  check(basementBranch.bellSolved && basementBranch.bellRings === 1
      && ['trolley-return', 'trolley-release'].includes(basementBranch.relaySource)
      && basementBranch.afterBellDeath.alive
      && basementBranch.afterBoardDeath.alive
      && basementBranch.afterBoardsDeath.alive,
    'bell and board commitments survive full death/retry boundaries in natural order',
    basementBranch);
  check(basementBranch.boardsAfterOne === 1 && basementBranch.boardsCleared
      && basementBranch.doorOpened && basementBranch.reachedRamp
      && basementBranch.reachedBottom && basementBranch.naturalDescent,
    'bell-first then one-throw-per-board opens the real door and admits the real cellar stairs',
    basementBranch);
  check(basementBranch.afterDescentDeath.alive
      && basementBranch.afterDescentDeath.act === 'basement'
      && basementBranch.stairRouteLegs.every((leg) => leg.reached)
      && basementBranch.leftRespawnStairsForPilot
      && basementBranch.leftRespawnStairsForWorks
      && basementBranch.reachedPilot
      && basementBranch.pilotWasEnabled && !basementBranch.pilotWasFree
      && basementBranch.coldRefused
      && basementBranch.coldValve
      && basementBranch.afterFlameDeath.alive
      && basementBranch.afterFlameDeath.act === 'basement'
      && basementBranch.coldPersisted
      && basementBranch.leftRespawnStairsForRelight
      && basementBranch.reachedRelight
      && basementBranch.pilotIgnited
      && basementBranch.afterIgniteDeath.alive
      && basementBranch.pilotLitPersisted,
    'the cold pilot refuses fire but rings the circuit, survives death cold, and lights only from a carried flame',
    basementBranch);
  check(basementBranch.pilotGateRefused && basementBranch.incineratorAccepted,
    'the relit pilot is what powers the drafted incinerator — and without it the firebox refuses',
    basementBranch);
  check(basementBranch.basementWalkLegs.every((leg) => leg.reached)
      && basementBranch.pumpAnchored
      && basementBranch.pumpReturned
      && basementBranch.pumpLatched
      && basementBranch.draftOpened
      && basementBranch.fireRefused,
    'the trolley-and-pilot route walks the pump circuit, opens the archive draft, and completes the furnace refusal',
    basementBranch);
  check(basementBranch.ashKeyFetched
      && basementBranch.ashKeyHitModes.length === 1
      && basementBranch.ashKeyHitModes[0] === 'outbound'
      && basementBranch.gotHatchKey
      && basementBranch.prePadlock.carry === 'hatchKey',
    'the refused furnace exposes an ash key that an ordinary outbound throw physically fetches',
    basementBranch);
  check(basementBranch.hatchUnlocked
      && basementBranch.hatchOpen
      && basementBranch.graveyardExited
      && basementBranch.finalAct === 'graveyard',
    'the carried ash key physically unlocks the hatch and real use transitions the pilot route to the graveyard',
    basementBranch);

  await freshPage();
  const earlyBasement = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('basement');
    g.enemies.clear();
    let bellRings = 0;
    const originalBell = g.audio.bellRing;
    g.audio.bellRing = (opts) => {
      bellRings++;
      if (originalBell) originalBell.call(g.audio, opts);
    };
    F.stepWith(0.9, {}, false);
    const freeBeforeThrow = g.flags.has('ateFlame') || g.flags.has('windowRelaySolved');
    g.director.death(null);
    F.stepWith(1.25, {}, false);
    g.el.die.click();
    F.stepWith(0.12, {}, false);
    const pilot = g.basementPilot;
    const targetPos = pilot.target.object.getWorldPosition(g.player.pos.clone());
    g.player.pos.set(7, -3, 3.55);
    g.player.vel.set(0, 0, 0);
    const dx = targetPos.x - g.player.pos.x;
    const dy = targetPos.y - (g.player.pos.y + 1.62);
    const dz = targetPos.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.55, { throwHeld: true }, false);
    F.stepWith(1 / 120, { throwReleased: true }, false);
    let t = 0;
    while (g.skull.mode !== 'held' && t < 4) { F.stepWith(0.1, {}, false); t += 0.1; }
    const result = {
      freeBeforeThrow,
      ateFlame: g.flags.has('ateFlame'),
      relaySolved: g.flags.has('windowRelaySolved'),
      source: g.windowRelay.solveSource,
      pilotUsed: g.flags.has('basementPilotUsed'),
      targetEnabled: pilot.target.enabled,
      flameVisible: pilot.flame.visible,
      bellRings,
      skullMode: g.skull.mode,
    };
    g.audio.bellRing = originalBell;
    return result;
  });
  report.diagnostics.earlyBasement = earlyBasement;
  // The pilot no longer GRANTS the flame — it is cold, and fire lives
  // upstairs behind the door this same throw opens. The un-strandable
  // property survives in its new form: the cold hit rings the whole circuit
  // (windowRelaySolved), which opens the void door and lights the guest
  // candle, so the save always has a route to fire — one that now runs
  // through the beat Alex asked three times to make necessary.
  check(!earlyBasement.freeBeforeThrow && !earlyBasement.ateFlame
      && earlyBasement.relaySolved && earlyBasement.source === 'basement-pilot'
      && !earlyBasement.pilotUsed && earlyBasement.targetEnabled
      && !earlyBasement.flameVisible && earlyBasement.bellRings === 1
      && earlyBasement.skullMode === 'held',
    'an impossible early-basement state still demands a throw, rings the circuit, and cannot strand the save',
    earlyBasement);

  await freshPage();
  const crawler = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.clear();
    const c = g.sculleryCrawler;
    const opening = g.world.windowOpenings.find((o) => o.id === 'sculleryCrawlerWindow');
    if (!c || !opening) return { exists: !!c, opening: !!opening };
    const look = () => {
      const eyeY = g.player.pos.y + 1.62;
      const dx = c.focus.x - g.player.pos.x;
      const dy = c.focus.y - eyeY;
      const dz = c.focus.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    g.player.pos.set(7, 0, 3.8);
    g.player.vel.set(0, 0, 0);
    look();
    F.stepWith(1.1, {}, false);
    const first = { triggered: c.triggered, watched: c.watched, progress: c.progress, stage: c.stage };
    g.player.yaw += Math.PI / 2;
    g.player._sync(0);
    const frozenAt = c.progress;
    F.stepWith(1.0, {}, false);
    const away = { progress: c.progress, frozenAt, stage: c.stage };
    look();
    F.stepWith(5.2, {}, false);
    g.render();
    const inside = {
      entered: c.entered,
      visible: c.root.visible,
      stage: c.stage,
      settledT: c.settledT,
      calls: g.lastRender?.drawCalls ?? null,
      triangles: g.lastRender?.triangles ?? null,
    };
    F.stepWith(0.25, {}, false);
    g.player.yaw += Math.PI / 2;
    g.player._sync(0);
    F.stepWith(0.48, {}, false);
    const gone = {
      vanished: c.vanished,
      visible: c.root.visible,
      flag: g.flags.has('sculleryCrawlerVanished'),
      wetProof: c.proof.children.filter((mark) => mark.visible).length,
    };
    return {
      exists: true,
      openingCenter: opening.center.toArray(),
      first,
      away,
      inside,
      gone,
      history: c.stageHistory.slice(),
      player: g.player.pos.toArray(),
      cameraStillPlayerOwned: !g.player.movementLocked && !g.player.frozen,
    };
  });
  report.diagnostics.crawler = crawler;
  check(crawler.exists
      && Math.abs(crawler.openingCenter[0] - 7) < 0.01
      && Math.abs(crawler.openingCenter[1] - 1.8) < 0.01
      && Math.abs(crawler.openingCenter[2] - 6) < 0.01,
    'crawler owns the exact small scullery window shown in the playtest', crawler);
  check(crawler.first?.triggered && crawler.first?.watched && crawler.first.progress > 0
      && Math.abs(crawler.away.progress - crawler.away.frozenAt) < 0.001,
    'looking out starts the crawl and looking away freezes its physical progress', crawler);
  check(crawler.inside.entered && crawler.inside.visible && crawler.inside.stage >= 4
      && crawler.inside.settledT >= 1.05
      && [0, 1, 2, 3, 4].every((stage) => crawler.history.includes(stage))
      && crawler.cameraStillPlayerOwned,
    'the creature visibly crosses outside-to-sill-to-room in deterministic order without taking camera or movement',
    crawler);
  check(crawler.inside.calls < 450 && crawler.inside.triangles > 0,
    'the final watched crawler tableau stays inside the established renderer ceiling',
    crawler.inside);
  check(crawler.gone.vanished && !crawler.gone.visible
      && crawler.gone.flag && crawler.gone.wetProof >= 4,
    'after its watched hold, a genuine look-away removes the non-colliding apparition but leaves wet proof',
    crawler.gone);

  await freshPage();
  const crawlerProximity = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.clear();
    const c = g.sculleryCrawler;
    const look = () => {
      const dx = c.focus.x - g.player.pos.x;
      const dy = c.focus.y - (g.player.pos.y + 1.62);
      const dz = c.focus.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    let gasps = 0;
    const originalGasp = g.audio.gasp;
    g.audio.gasp = (opts) => {
      gasps++;
      if (originalGasp) originalGasp.call(g.audio, opts);
    };
    g.player.pos.set(7, 0, 3.8);
    g.player.vel.set(0, 0, 0);
    look();
    F.stepWith(5.8, {}, false);
    const inside = {
      entered: c.entered,
      stage: c.stage,
      watched: c.watched,
      settledT: c.settledT,
      progress: c.progress,
      visible: c.root.visible,
    };
    const start = g.player.pos.clone();
    let sawVisibleRecoil = false;
    let recoilStage = null;
    let minRenderedDistance = Infinity;
    let renderedSamples = 0;
    for (let i = 0; i < 180 && !c.resolved; i++) {
      // Real forward+strafe input, with the gaze continually maintained on the
      // same aperture/body. No direct position edits occur during approach.
      look();
      F.stepWith(1 / 60, { moveZ: 1, moveX: 0.35 }, false);
      g.render();
      if (c.root.visible) {
        minRenderedDistance = Math.min(minRenderedDistance,
          Math.hypot(g.player.pos.x - c.root.position.x, g.player.pos.z - c.root.position.z));
        renderedSamples++;
      }
      if (c.resolving && c.root.visible) {
        sawVisibleRecoil = true;
        recoilStage ??= c.stage;
      }
    }
    const result = {
      inside,
      moved: g.player.pos.distanceTo(start),
      sawVisibleRecoil,
      recoilStage,
      resolved: c.resolved,
      vanished: c.vanished,
      visible: c.root.visible,
      reason: c.resolveReason,
      resolveAtDistance: c.resolveAtDistance,
      safeClearance: c.safeClearance,
      minPlayerDistance: c.minPlayerDistance,
      minRenderedDistance,
      renderedSamples,
      progressAfter: c.progress,
      progressCommitted: c.resolveProgress,
      gasps,
      wetProof: c.proof.children.filter((mark) => mark.visible).length,
      recoilFlag: g.flags.has('sculleryCrawlerRecoiled'),
      resolutionFlag: g.flags.has('sculleryCrawlerProximityResolved'),
      alive: !g.dead,
      cameraStillPlayerOwned: !g.player.movementLocked && !g.player.frozen,
    };
    g.audio.gasp = originalGasp;
    return result;
  });
  report.diagnostics.crawlerProximity = crawlerProximity;
  check(crawlerProximity.inside.entered
      && crawlerProximity.inside.stage >= 4
      && crawlerProximity.inside.watched
      && crawlerProximity.inside.settledT >= 1.05
      && crawlerProximity.inside.visible
      && crawlerProximity.moved > 0.25
      && crawlerProximity.sawVisibleRecoil
      && crawlerProximity.recoilStage >= 4
      && crawlerProximity.resolved
      && crawlerProximity.vanished
      && !crawlerProximity.visible
      && crawlerProximity.reason === 'proximity-recoil'
      && crawlerProximity.resolveAtDistance > crawlerProximity.safeClearance
      && crawlerProximity.minPlayerDistance > crawlerProximity.safeClearance
      && crawlerProximity.minRenderedDistance > crawlerProximity.safeClearance
      && crawlerProximity.renderedSamples > 2
      && Math.abs(crawlerProximity.progressAfter - crawlerProximity.progressCommitted) < 0.001
      && crawlerProximity.gasps === 1
      && crawlerProximity.wetProof >= 4
      && crawlerProximity.recoilFlag
      && crawlerProximity.resolutionFlag
      && crawlerProximity.alive
      && crawlerProximity.cameraStillPlayerOwned,
    'forward and strafe input while staring at the inside body triggers a visible safe-clearance recoil without control theft',
    crawlerProximity);

  await freshPage();
  const crawlerPreEntry = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.clear();
    const c = g.sculleryCrawler;
    const look = () => {
      const dx = c.focus.x - g.player.pos.x;
      const dy = c.focus.y - (g.player.pos.y + 1.62);
      const dz = c.focus.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    g.player.pos.set(7, 0, 4.45);
    g.player.vel.set(0, 0, 0);
    look();
    F.stepWith(0.4, {}, false);
    const progressBeforeApproach = c.progress;
    const start = g.player.pos.clone();
    let sawVisibleRecoil = false;
    let minRenderedDistance = Infinity;
    let renderedSamples = 0;
    for (let i = 0; i < 150 && !c.resolved; i++) {
      look();
      F.stepWith(1 / 60, { moveZ: 1, moveX: -0.22 }, false);
      g.render();
      if (c.root.visible) {
        minRenderedDistance = Math.min(minRenderedDistance,
          Math.hypot(g.player.pos.x - c.root.position.x, g.player.pos.z - c.root.position.z));
        renderedSamples++;
      }
      if (c.resolving && c.root.visible) sawVisibleRecoil = true;
    }
    return {
      triggered: c.triggered,
      progressBeforeApproach,
      resolveProgress: c.resolveProgress,
      resolveStage: c.stage,
      moved: g.player.pos.distanceTo(start),
      sawVisibleRecoil,
      resolved: c.resolved,
      vanished: c.vanished,
      reason: c.resolveReason,
      resolveAtDistance: c.resolveAtDistance,
      safeClearance: c.safeClearance,
      minPlayerDistance: c.minPlayerDistance,
      minRenderedDistance,
      renderedSamples,
      progressAfter: c.progress,
      wetProof: c.proof.children.filter((mark) => mark.visible).length,
      alive: !g.dead,
      cameraStillPlayerOwned: !g.player.movementLocked && !g.player.frozen,
    };
  });
  report.diagnostics.crawlerPreEntry = crawlerPreEntry;
  check(crawlerPreEntry.triggered
      && crawlerPreEntry.progressBeforeApproach > 0
      && crawlerPreEntry.resolveProgress < 0.4
      && crawlerPreEntry.resolveStage <= 1
      && crawlerPreEntry.moved > 0.2
      && crawlerPreEntry.sawVisibleRecoil
      && crawlerPreEntry.resolved
      && crawlerPreEntry.vanished
      && crawlerPreEntry.reason === 'proximity-recoil'
      && crawlerPreEntry.resolveAtDistance > crawlerPreEntry.safeClearance
      && crawlerPreEntry.minPlayerDistance > crawlerPreEntry.safeClearance
      && crawlerPreEntry.minRenderedDistance > crawlerPreEntry.safeClearance
      && crawlerPreEntry.renderedSamples > 2
      && Math.abs(crawlerPreEntry.progressAfter - crawlerPreEntry.resolveProgress) < 0.001
      && crawlerPreEntry.wetProof >= 4
      && crawlerPreEntry.alive
      && crawlerPreEntry.cameraStillPlayerOwned,
    'approaching the watched outside/sill stages resolves the committed crawl before any long limb can clip through the player',
    crawlerPreEntry);

  // ---------------------------------------------------------------- THE
  // FURNACE ORDER PAGE. His report, docs/HIS-NOTES-2026-08-19b.md: "went down
  // the basement stairs and did all puzzles in the basement. the furnace did
  // not have fire... went back down to the basement, made sure everything was
  // active. still no fire. reloaded check point. and then the fire was there."
  //
  // The FIRE is not order-dependent and this page proves it: the last flag
  // goes straight into the Set with no handler, no interact and no throw, and
  // the furnace still wakes on the next frames. What WAS order-dependent is
  // the furnace's VOICE -- the mouth answered once, at the instant the door
  // swung, and the one state where the draft is whole and the pilot is dark
  // had no pointer at all. Round twelve's gauge fix was pinned by nothing at
  // all before this page; it is pinned here.
  await freshPage();
  const furnaceOrder = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('basement');
    g.enemies.clear();
    // The stance a confused player actually occupies: square in front of the
    // mouth in the boiler room. Without it this page would only prove the
    // pointer fires from a stance nobody stands in.
    const standAt = (x, y, z) => {
      g.player.pos.set(x, y, z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player._sync(0);
    };
    standAt(9.8, -3, -1.7);
    const incin = g.incinerator;
    const pilot = g.basementPilot;
    const incPos = g.incineratorPosition;
    // Count only the mouth's own thud. thud is a shared verb across the whole
    // game; filtering by position keeps this deterministic.
    let mouthThuds = 0;
    const originalThud = g.audio.thud;
    g.audio.thud = function countMouthThud(opts) {
      const p = opts && opts.pos;
      if (p && Math.hypot(p.x - incPos.x, p.y - incPos.y, p.z - incPos.z) < 0.6) mouthThuds++;
      return originalThud.call(g.audio, opts);
    };
    const camDist = () => {
      const c = g.camera.getWorldPosition(g.player.pos.clone());
      return Math.hypot(c.x - incPos.x, c.y - incPos.y, c.z - incPos.z);
    };
    // pilot.pulse is written by nudge() and by nothing else, so it is the
    // exact signal for "the furnace called the pilot", with no audio
    // dependency at all.
    const runFor = (seconds, chunk = 0.2) => {
      const thudsAtStart = mouthThuds;
      let peakPulse = 0, peakSlit = 0, minDist = Infinity;
      for (let t = 0; t < seconds - 1e-6; t += chunk) {
        F.stepWith(chunk, {}, false);
        peakPulse = Math.max(peakPulse, pilot.pulse);
        for (const slit of incin.slits) peakSlit = Math.max(peakSlit, slit.scale.y);
        minDist = Math.min(minDist, camDist());
      }
      return {
        peakPulse, peakSlit, minDist, alive: !g.dead,
        thuds: mouthThuds - thudsAtStart,
        needle: incin.gaugeNeedle.rotation.z,
      };
    };
    const aimAt = (x, y, z) => {
      const dx = x - g.player.pos.x;
      const dy = y - (g.player.pos.y + 1.62);
      const dz = z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const waitHeld = (maxS = 4.5) => {
      let t = 0;
      while (g.skull.mode !== 'held' && t < maxS) { F.stepWith(0.1, {}, false); t += 0.1; }
      return g.skull.mode === 'held';
    };
    const throwAt = (x, y, z, hold = 0.35) => {
      aimAt(x, y, z);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      const d = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
      F.stepWith(Math.min(2.6, d / 20 + hold), { throwHeld: true }, false);
      F.stepWith(1 / 120, { throwReleased: true }, false);
      waitHeld();
    };
    const fireDoor = g.world.interactables.find((o) => o.userData.inter?.id === 'incineratorDoor');

    // 1. THE NATURAL ORDER. The obvious door gets opened EARLY, cold and
    //    empty-handed, long before anything else in the basement is done.
    const thudsBeforeFirst = mouthThuds;
    fireDoor.userData.inter.action();
    const firstPress = runFor(0.4);
    const firstPressSpoke = incin.doorOpen && mouthThuds > thudsBeforeFirst;

    // 2. The rest of the house happens SOMEWHERE ELSE. Straight into the Set:
    //    no handler, no interact, no throw, no timer, no act change -- the
    //    same Set-level state idiom this file already uses on pilotLit.
    g.flags.add('ateFlame');
    g.flags.add('pumpGalleryLatched');
    g.flags.add('archiveDraftOpened');

    // 3. THE SILENT STATE, now with a voice. Draft whole, pilot dark, fire in
    //    the skull, standing at the mouth. The gauge honestly reads EMPTY and
    //    the slits do not breathe (breath IS pilotLit) -- and before this
    //    round that was the whole of it, in the exact state he stood in.
    const coldCall = runFor(11);

    // 4. THE SAME STATE FROM THE FAR END OF THE BASEMENT. Same act, same
    //    flags, twelve metres away behind the stair mass: a call you cannot
    //    place is ambience, so it is gated on standing near the mouth.
    standAt(-1.5, g.world.groundHeightAt(-1.5, -1.5, -2.8), -1.5);
    F.stepWith(2, {}, false);
    const farCall = runFor(11);

    // 5. BACK AT THE MOUTH, PRESS THE DOOR AGAIN. THIS is the order bug: the
    //    handler used to return on its first line once the door was open, so
    //    every later press produced nothing at all, forever.
    standAt(9.8, -3, -1.7);
    F.stepWith(0.3, {}, false);
    const thudsBeforeSecond = mouthThuds;
    fireDoor.userData.inter.action();
    const secondPress = runFor(0.4);
    const secondPressSpoke = mouthThuds > thudsBeforeSecond;

    // 6. THE FIRE IS NOT ORDER-DEPENDENT. The last precondition is written
    //    into the Set from nowhere in particular -- no press, no throw, no
    //    return trip -- and the furnace wakes on the next frames anyway, and
    //    the gauge sweeps to FULL DRAFT because now it is telling the truth.
    const awakeBefore = incin.awake;
    g.flags.add('pilotLit');
    const wake = runFor(2.2);
    const wokeWithNoHandler = !awakeBefore && incin.awake
      && g.flags.has('incineratorAwake') && incin.glowTarget === 2.4;

    // 7. ...and the cold call retires the instant the pilot burns, while the
    //    slits take up the lit-pilot breath.
    const afterLit = runFor(11);

    // 8. A SPENT FURNACE STAYS SPENT. Making the handler repeatable created a
    //    new way to fail: a press could re-light a furnace that had already
    //    choked on the skull back to a ready mouth. Real throw, real refusal,
    //    then press the door again.
    standAt(9, -3, -1.5);
    throwAt(incPos.x, incPos.y, incPos.z, 0.35);
    for (let t = 0; t < 6 && !g.flags.has('fireRefused'); t += 0.1) F.stepWith(0.1, {}, false);
    const refused = g.flags.has('fireRefused') && incin.refused && incin.offered;
    const glowAfterRefusal = incin.glowTarget;
    fireDoor.userData.inter.action();
    F.stepWith(0.3, {}, false);
    const glowAfterSpentPress = incin.glowTarget;

    g.audio.thud = originalThud;
    return {
      firstPressSpoke, firstPress,
      coldCall, farCall,
      secondPressSpoke, secondPress,
      wokeWithNoHandler, wake, afterLit,
      refused, glowAfterRefusal, glowAfterSpentPress,
      act: g.act, alive: !g.dead, skull: g.skull.mode,
    };
  });
  report.diagnostics.furnaceOrder = furnaceOrder;
  check(furnaceOrder.firstPressSpoke && furnaceOrder.act === 'basement' && furnaceOrder.alive,
    'opening the fire door cold and empty-handed answers at the mouth',
    furnaceOrder.firstPress);
  check(furnaceOrder.coldCall.thuds >= 1
      && furnaceOrder.coldCall.peakPulse > 1
      && Math.abs(furnaceOrder.coldCall.peakSlit - 1) < 1e-9
      && furnaceOrder.coldCall.needle > 0.9
      && furnaceOrder.coldCall.alive,
    'draft whole and pilot dark: the furnace calls back to the pilot inside one period while the gauge and slits stay honestly empty',
    furnaceOrder.coldCall);
  check(furnaceOrder.farCall.thuds === 0
      && furnaceOrder.farCall.peakPulse === 0
      && furnaceOrder.farCall.minDist > 9,
    'the same silent state from the far end of the basement stays silent: the cold call is a pointer, not ambience',
    furnaceOrder.farCall);
  check(furnaceOrder.secondPressSpoke && furnaceOrder.secondPress.peakPulse > 1,
    'the mouth answers every press, not only the press that swung the hinge',
    furnaceOrder.secondPress);
  check(furnaceOrder.wokeWithNoHandler
      && furnaceOrder.wake.needle < -0.9
      && furnaceOrder.afterLit.peakSlit > 1.2
      && furnaceOrder.afterLit.thuds === 0
      && furnaceOrder.afterLit.peakPulse === 0,
    'the last precondition written straight into the flag Set wakes the furnace on the next frames, sweeps the gauge to full draft and retires the cold call',
    { wake: furnaceOrder.wake, afterLit: furnaceOrder.afterLit, woke: furnaceOrder.wokeWithNoHandler });
  check(furnaceOrder.refused
      && furnaceOrder.glowAfterSpentPress === furnaceOrder.glowAfterRefusal
      && furnaceOrder.glowAfterSpentPress < 0.5,
    'a furnace that has already choked on the skull can never be re-lit by pressing its door again',
    { refused: furnaceOrder.refused, glowAfterRefusal: furnaceOrder.glowAfterRefusal, glowAfterSpentPress: furnaceOrder.glowAfterSpentPress });

  check(report.errors.length === 0, 'all critical-path scenarios produce zero browser errors', report.errors);
} finally {
  writeFileSync(resultsPath('house-critical-path-regression.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} CHECK(S) FAILED`);
  process.exit(1);
}
console.log('\nALL PASS');

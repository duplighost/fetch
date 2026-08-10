// Progression-caused return-route horror regression.
// Verifies flag gating, physical observation rules, exact spatial ordering,
// death/re-entry idempotence, door safety, and the one-shot Resident handoff.
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

try {
  const opened = await openPage(browser, report.url);
  page = opened.page;
  report.errors = opened.errors;
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 });

  const result = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.director.scareT = 9999;
    g.enemies.clear();
    g.director.resident = null;
    const H = g.houseReturnHorror;

    const pose = (x, y, z, yaw = 0, pitch = 0) => {
      g.player.pos.set(x, y, z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.yaw = yaw;
      g.player.pitch = pitch;
      g.player._sync(0);
    };
    const lookAt = (point) => {
      const dx = point.x - g.player.pos.x;
      const dz = point.z - g.player.pos.z;
      const dy = point.y - (g.player.pos.y + 1.62);
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    const transform = (o) => ({
      p: o.position.toArray(), r: [o.rotation.x, o.rotation.y, o.rotation.z],
    });
    const sameTransform = (a, b) => a.p.every((v, i) => Math.abs(v - b.p[i]) < 1e-6)
      && a.r.every((v, i) => Math.abs(v - b.r[i]) < 1e-6);
    const stepUntil = (predicate, maxFrames = 600) => {
      for (let i = 0; i < maxFrames && !predicate(); i++) F.stepWith(1 / 60, {}, false);
      return predicate();
    };

    // The bedroom/landing route gives a fair first look at the rocker; the
    // stair foot gives the same first look through the dining doorway.
    pose(-1.15, 3.6, 3.1, Math.PI / 2, 0);
    F.stepWith(0.08, {}, false);
    pose(1.55, 0, -8.35, Math.PI / 2, 0);
    F.stepWith(0.08, {}, false);

    const initial = {
      events: H.events.length,
      active: H.active,
      moved: { ...H.moved },
      rocker: transform(H.props.rockingChair),
      diningChair: transform(H.props.diningChair),
      portrait: transform(H.props.diningPortrait),
      door: {
        locked: H.returnDoor?.locked ?? null,
        open: H.returnDoor?.open ?? null,
        target: H.returnDoor?.target ?? null,
        center: H.returnDoor ? [H.returnDoor.center.x, H.returnDoor.center.z] : null,
      },
      visits: { ...H.visits },
    };
    F.stepWith(2.5, {}, false);
    const beforeFlags = { events: H.events.length, active: H.active, moved: { ...H.moved } };
    g.flag('windowRelaySolved');
    F.stepWith(1.1, {}, false);
    const oneFlag = { events: H.events.length, active: H.active, moved: { ...H.moved } };
    g.flag('ateFlame');

    // Advance exactly through the upstairs landing beat, then put the changed
    // chair in the crosshair before the following fixed frame can mutate it.
    pose(10.2, 3.6, 4.8, 0, 0);
    const reachedRockerTurn = stepUntil(() => H.index === 5);
    pose(-4.85, 3.6, 3.72);
    lookAt({ x: -6.3, y: 4.32, z: 5.0 });
    const rockerWatchedBefore = transform(H.props.rockingChair);
    const indexBeforeRockerWatch = H.index;
    F.stepWith(0.92, {}, false);
    const rockerWatchedAfter = transform(H.props.rockingChair);

    // Descending makes the nursery a real previous visit. The mutation happens
    // off-floor, and the next visitor footfall is allowed down the stairs.
    pose(1.05, 0, -3.8, 0, 0);
    F.stepWith(0.9, {}, false);
    const rockerAfterLeave = transform(H.props.rockingChair);
    const rockerMoved = H.moved.rocker;

    // Pause a life between route beats. There are no callbacks to leak through
    // death, and the completed prefix must not replay after respawn.
    const reachedDiningBeat = stepUntil(() => H.index === 7);
    const beforeDeath = { index: H.index, events: H.events.map((e) => e.id) };
    g.checkpoint('house');
    g.director.death(null);
    F.stepWith(1.45, {}, false);
    const duringDeath = { index: H.index, events: H.events.map((e) => e.id), dead: g.dead };
    g.director.respawn();
    F.stepWith(0.12, {}, false);
    const afterRespawn = {
      index: H.index, events: H.events.map((e) => e.id), dead: g.dead,
      frozen: g.player.frozen, movementLocked: g.player.movementLocked,
    };

    // The dining tableau has been seen and left, but remains literally fixed
    // while watched. It changes only after the player turns into the kitchen.
    pose(6.75, 0, -7.18);
    lookAt({ x: 6.2, y: 1.05, z: -8.8 });
    const diningWatchedBefore = {
      chair: transform(H.props.diningChair), portrait: transform(H.props.diningPortrait),
    };
    F.stepWith(0.88, {}, false);
    const diningWatchedAfter = {
      chair: transform(H.props.diningChair), portrait: transform(H.props.diningPortrait),
      index: H.index,
    };

    pose(6.1, 0, -1.45, 0, 0);
    F.stepWith(0.95, {}, false);
    const diningAfterLeave = {
      chair: transform(H.props.diningChair), portrait: transform(H.props.diningPortrait),
      moved: H.moved.dining,
    };
    const crackedDoor = {
      exists: !!H.returnDoor,
      locked: H.returnDoor?.locked ?? null,
      open: H.returnDoor?.open ?? null,
      target: H.returnDoor?.target ?? null,
      anim: H.returnDoor?.anim ?? null,
      colliderHeight: H.returnDoor ? H.returnDoor.collider.max.y - H.returnDoor.collider.min.y : null,
      creep: H.doorCreep,
    };

    // Approach the still-boarded cellar while looking away from the final step.
    // Record view/control state on both sides to catch camera or input theft.
    pose(7.0, 0, -2.0, 0, -0.08);
    const controlBefore = {
      yaw: g.player.yaw, pitch: g.player.pitch,
      frozen: g.player.frozen, movementLocked: g.player.movementLocked,
    };
    F.stepWith(1.05, {}, false);
    const controlAfter = {
      yaw: g.player.yaw, pitch: g.player.pitch,
      frozen: g.player.frozen, movementLocked: g.player.movementLocked,
    };
    const completed = {
      complete: H.complete,
      completionCount: H.completionCount,
      handoffCount: H.handoffCount,
      events: H.events.map((e) => ({ id: e.id, ordinal: e.ordinal, pos: e.pos, sound: e.sound })),
      mutations: H.mutations.map((m) => ({ ...m })),
      residentSerial: H.residentSerial,
      residentCount: g.enemies.list.filter((e) => e.kind === 'resident').length,
      residentState: g.director.resident?.state ?? null,
      flags: [...g.flags].filter((f) => f.startsWith('houseReturn')),
    };
    F.stepWith(2.2, {}, false);
    const idempotent = {
      events: H.events.length,
      completionCount: H.completionCount,
      handoffCount: H.handoffCount,
      residentCount: g.enemies.list.filter((e) => e.kind === 'resident').length,
    };

    // A player action, not the scare, owns passage. The real door API still
    // opens it fully and drops the collider after the visual crack.
    H.returnDoor.tryUse(g);
    const doorAfterUse = {
      open: H.returnDoor.open,
      target: H.returnDoor.target,
      colliderHeight: H.returnDoor.collider.max.y - H.returnDoor.collider.min.y,
    };

    return {
      initial, beforeFlags, oneFlag, reachedRockerTurn,
      rocker: {
        watchedHeld: sameTransform(rockerWatchedBefore, rockerWatchedAfter),
        movedAfterLeave: rockerMoved && !sameTransform(initial.rocker, rockerAfterLeave),
        indexBeforeWatch: indexBeforeRockerWatch,
      },
      reachedDiningBeat, beforeDeath, duringDeath, afterRespawn,
      dining: {
        watchedHeld: sameTransform(diningWatchedBefore.chair, diningWatchedAfter.chair)
          && sameTransform(diningWatchedBefore.portrait, diningWatchedAfter.portrait),
        changedAfterLeave: diningAfterLeave.moved
          && !sameTransform(initial.diningChair, diningAfterLeave.chair)
          && !sameTransform(initial.portrait, diningAfterLeave.portrait),
        indexWhileWatched: diningWatchedAfter.index,
      },
      crackedDoor, controlBefore, controlAfter, completed, idempotent, doorAfterUse,
    };
  });
  report.diagnostics = result;

  check(result.initial.events === 0 && !result.initial.active
      && !result.initial.moved.rocker && !result.initial.moved.dining
      && result.beforeFlags.events === 0 && !result.beforeFlags.active,
    'the return sequence and every physical mutation are inert before both causes',
    { initial: result.initial, beforeFlags: result.beforeFlags });
  check(result.oneFlag.events === 0 && !result.oneFlag.active,
    'the required window relay alone cannot start the flame-caused return', result.oneFlag);
  check(result.initial.visits.rocker && result.initial.visits.dining,
    'the existing landing and stair-foot sightlines register real prior visits', result.initial.visits);
  check(result.reachedRockerTurn && result.rocker.indexBeforeWatch === 5
      && result.rocker.watchedHeld && result.rocker.movedAfterLeave,
    'the nursery rocker changes once, only after its prior visit leaves the observed frame', result.rocker);
  check(result.reachedDiningBeat && result.dining.indexWhileWatched === 7
      && result.dining.watchedHeld && result.dining.changedAfterLeave,
    'the dining chair and portrait remain fixed under observation and reorient between visits', result.dining);
  check(result.duringDeath.dead
      && result.duringDeath.index === result.beforeDeath.index
      && JSON.stringify(result.duringDeath.events) === JSON.stringify(result.beforeDeath.events)
      && !result.afterRespawn.dead && !result.afterRespawn.frozen && !result.afterRespawn.movementLocked
      && result.afterRespawn.index === result.beforeDeath.index
      && JSON.stringify(result.afterRespawn.events) === JSON.stringify(result.beforeDeath.events),
    'death pauses the exact prefix and re-entry resumes it without a stale callback or duplicate visitor',
    { before: result.beforeDeath, during: result.duringDeath, after: result.afterRespawn });

  const expectedRoute = [
    ['living-aperture', [-11.28, 0.08, -9]],
    ['living-door', [-4.18, 0.08, -8.95]],
    ['stair-foot', [1.15, 0.08, -8.2]],
    ['guest-threshold', [4.22, 3.68, -7]],
    ['landing-turn', [0.8, 3.68, 1]],
    ['stair-descent', [1.05, 2.15, -3.8]],
    ['dining-return', [5.05, 0.08, -8.9]],
    ['kitchen-door', [4, 0.08, 3]],
    ['cellar-boards', [9, 0.08, 1.82]],
  ];
  const exactRoute = result.completed.events.length === expectedRoute.length
    && result.completed.events.every((e, i) => e.id === expectedRoute[i][0]
      && e.ordinal === i
      && e.pos.every((v, j) => Math.abs(v - expectedRoute[i][1][j]) < 1e-6));
  check(exactRoute,
    'all nine one-shot footsteps follow the authored living, guest, landing, kitchen, and cellar coordinates in order',
    result.completed.events);
  check(result.crackedDoor.exists && result.crackedDoor.locked === null
      && !result.crackedDoor.open && result.crackedDoor.target === 0.14
      && result.crackedDoor.anim > 0 && result.crackedDoor.anim <= 0.141
      && result.crackedDoor.colliderHeight > 2 && result.crackedDoor.creep === 'cracked'
      && result.initial.door.center[0] === 4 && result.initial.door.center[1] === 3,
    'the real unlocked scullery return door cracks a few inches without dropping its collider',
    result.crackedDoor);
  check(result.doorAfterUse.open && result.doorAfterUse.target === 1
      && result.doorAfterUse.colliderHeight === 0,
    'normal player use still opens that valid door fully; the scare never owns passage', result.doorAfterUse);
  check(result.completed.complete && result.completed.completionCount === 1
      && result.completed.handoffCount === 1 && result.completed.residentCount === 1
      && ['wind', 'chase', 'strike'].includes(result.completed.residentState)
      && result.completed.residentSerial !== null
      && result.idempotent.events === 9 && result.idempotent.completionCount === 1
      && result.idempotent.handoffCount === 1 && result.idempotent.residentCount === 1,
    'the cellar culmination hands off exactly once to one existing Resident response',
    { completed: result.completed, idempotent: result.idempotent });
  check(Math.abs(result.controlAfter.yaw - result.controlBefore.yaw) < 1e-9
      && Math.abs(result.controlAfter.pitch - result.controlBefore.pitch) < 1e-9
      && !result.controlBefore.frozen && !result.controlBefore.movementLocked
      && !result.controlAfter.frozen && !result.controlAfter.movementLocked,
    'the entire culmination preserves look, movement, and camera control',
    { before: result.controlBefore, after: result.controlAfter });
  check(report.errors.length === 0, 'the complete death/re-entry route produces zero browser errors', report.errors);
} catch (error) {
  failures.push('exception');
  report.errors.push(error?.stack || String(error));
  console.error(error?.stack || error);
} finally {
  writeFileSync(resultsPath('house-return-horror-regression.json'), JSON.stringify(report, null, 2));
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s): ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`\nALL PASS (${report.checks.length} checks)`);

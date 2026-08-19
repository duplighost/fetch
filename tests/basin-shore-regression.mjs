// basin-shore-regression.mjs -- the plunge pool is the only walk-in death
// water in the game, and its shore is now a physical fact.
//
// Round five, his notes 2 and 3. The basin's stone lip skips |x| < 3.0 because
// the bridge stones rise through that lane, which left a clean six-metre gap
// that read exactly like a ford at the one place in the field where walking in
// kills you (director.js kills below y -1.5 in this act). His own words about
// the fix: "I want to make whatever we do, something we do careful. because the
// game does work."
//
// So this drives a player AT the water from every bearing, the way a player
// wanders, and asserts the water never takes them — and then asserts the
// crossing still opens, still completes, and never desyncs across a death. The
// six "concrete brick" masses are part of that ring now: they were standing in
// a meadow eight metres from where their own comment said they belonged.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const failures = [];
const checks = [];
const check = (condition, message, detail = '') => {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}${suffix}`);
  checks.push({ message, detail, passed: !!condition });
  if (!condition) failures.push(`${message}${suffix}`);
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

  const report = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const C = g.clearingCenter;
    const BASIN_Z = 15.2;                       // CLEARING_BASIN.centerZ
    const DEATH_Y = -1.5;                       // director.js, act 'clearing'

    F.start();
    F.teleport('clearing');
    F.stepWith(0.5);

    const place = (x, z, yaw) => {
      // A death leaves the controller frozen; clearing only `dead` leaves the
      // next drive inching forward and reads as a wall that is not there.
      g.dead = false;
      g.player.frozen = false;
      g.player.pos.set(x, g.world.groundHeightAt(x, z, 2) + 0.05, z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.yaw = yaw;
      g.player._sync(0);
    };
    // Walk straight at a point and report the worst (lowest) y reached.
    const drive = (fromX, fromZ, toX, toZ, seconds = 7, stopAtTarget = false) => {
      place(fromX, fromZ, Math.atan2(-(toX - fromX), -(toZ - fromZ)));
      let worstY = g.player.pos.y;
      let died = false;
      for (let t = 0; t < seconds; t += 0.1) {
        // Re-aim like a walking player rather than a thrown stone: a wanderer
        // who meets the lip keeps trying, which is the harder case for it.
        // (Yaw only — calling _sync mid-walk re-seats the controller and the
        // player never leaves the spot.)
        g.player.yaw = Math.atan2(-(toX - g.player.pos.x), -(toZ - g.player.pos.z));
        F.stepWith(0.1, { moveZ: 1 }, false);
        worstY = Math.min(worstY, g.player.pos.y);
        if (g.dead) { died = true; break; }
        if (stopAtTarget && Math.hypot(toX - g.player.pos.x, toZ - g.player.pos.z) < 1.1) break;
      }
      return {
        worstY: +worstY.toFixed(2),
        died,
        end: [+(g.player.pos.x - C.x).toFixed(1), +(g.player.pos.z - C.z).toFixed(1)],
      };
    };

    // ---- pre-thaw: every bearing walks into stone, not water --------------
    const bearings = [];
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      const bx = Math.sin(th), bz = -Math.cos(th);
      // start outside the ring, aim through the middle of the pool
      const fromX = C.x + bx * 13.5;
      const fromZ = C.z + BASIN_Z + bz * 13.5;
      const r = drive(fromX, fromZ, C.x, C.z + BASIN_Z, 8);
      bearings.push({ deg: Math.round((th * 180) / Math.PI), ...r });
    }

    // ---- the beats the ring must not have broken -------------------------
    const locket = drive(C.x + 12, C.z + 20, C.x + 9.3, C.z + 17.5, 12, true);
    const locketReached = Math.hypot(g.player.pos.x - (C.x + 9.3), g.player.pos.z - (C.z + 17.5)) < 1.6;
    const machineWest = drive(C.x, C.z + 2, C.x - 13.5, C.z + 9.6, 16, true);
    const machineWestReached = Math.hypot(g.player.pos.x - (C.x - 13.5), g.player.pos.z - (C.z + 9.6)) < 1.8;
    const throwStance = drive(C.x, C.z - 2, C.x, C.z + 6, 12, true);
    const throwStanceReached = Math.abs(g.player.pos.z - (C.z + 6)) < 1.4;

    const sillBefore = {
      barred: g.basinSill.collider.max.y > g.basinSill.collider.min.y,
      meshY: +g.basinSill.mesh.position.y.toFixed(2),
      homeY: +g.basinSill.homeY.toFixed(2),
    };
    // and the lane itself, pre-thaw: the bar holds
    const lane = drive(C.x, C.z + 2, C.x, C.z + 16, 9);

    // ---- the thaw: the bar goes down with the first stone -----------------
    // A real post-thaw world: the ice sheet comes down first (the game's own
    // reload-past-the-thaw path), then the bargain.
    // How deep the water beside the stones is BEFORE the bargain. The bar
    // round six raises under the lane is post-bargain only: before it, the
    // deep water is the lock.
    const laneBefore = [10, 13, 16, 18].map((dz) => +g.world.terrainHeight(C.x + 2.4, C.z + dz).toFixed(2));
    g.flag('fallsThawed');
    F.stepWith(0.3, {}, false);
    g.director.waterfallTaken();
    for (let t = 0; t < 3; t += 0.1) F.stepWith(0.1, {}, false);
    const sillAtThaw = {
      barred: g.basinSill.collider.max.y > g.basinSill.collider.min.y,
      sinking: g.basinSill.sinking,
      meshY: +g.basinSill.mesh.position.y.toFixed(2),
    };
    for (let t = 0; t < 9; t += 0.1) F.stepWith(0.1, {}, false);
    const sillDown = {
      barred: g.basinSill.collider.max.y > g.basinSill.collider.min.y,
      done: g.basinSill.done,
      dropped: +(g.basinSill.homeY - g.basinSill.mesh.position.y).toFixed(2),
    };
    const crossing = drive(C.x, C.z + 2, C.x, C.z + 19, 16);
    const crossed = g.player.pos.z - C.z > 16;

    // ---- HIS NOTE, ROUND SIX: off the SIDES of the stones ----------------
    // "you can still fall off the sides of the rocks into the water when
    // crossing them into the waterfall." Round five made the SHORE safe and
    // left the water beside the stones alone; this is the second asking, so it
    // is a gate now. The bargain raises a rubble bar under the lane
    // (terrainHeightFn, outside.js): step off EVERY stone, to BOTH sides, and
    // keep walking for 1.6 s — about four metres, further than any mis-step
    // carries — and the water must not take you.
    //
    // Running that far sideways is not a mis-step, it is leaving. The pool is
    // still a pool out past the bar, and the bar's edge is marked with broken
    // water (atmosphere.js) so the player can see where the shallow ends.
    const laneAfter = [10, 13, 16, 18].map((dz) => +g.world.terrainHeight(C.x + 2.4, C.z + dz).toFixed(2));
    const sideSteps = [];
    for (let i = 0; i < g.bridgeStones.length; i++) {
      const st = g.bridgeStones[i];
      for (const side of [-1, 1]) {
        // A death leaves the director mid-beat; clearing only `dead` leaves the
        // next drive inching forward and reads as a wall that is not there.
        if (g.dead) { g.director.respawn(); F.stepWith(0.5, {}, false); }
        const r = drive(st.position.x, st.position.z, st.position.x + side * 8, st.position.z, 1.6);
        sideSteps.push({ stone: i, dz: +(st.position.z - C.z).toFixed(1), side, ...r });
      }
    }
    g.director.respawn();
    F.stepWith(0.5, {}, false);

    // ---- HIS NOTE 4: "I died entering the cave" --------------------------
    // The mouth is the one place where a player believes they have arrived and
    // the game still thinks they are in the clearing: the cave's lateral clamp
    // engages on the act line, and the act line is the same z as the last
    // stone. Step off the top of the crossing, from either side, at the exact
    // moment the inside of the cave is already on screen.
    const arrival = [];
    for (const dx of [-2.6, -1.6, -0.8, 0.8, 1.6, 2.6]) {
      // The arrival band only: from the veil (z+19.55) inward. South of that a
      // sideways step is still the crossing, and the crossing is meant to be
      // one — the stones are the way, and the water beside them is the risk he
      // took the bargain for.
      for (const dz of [19.4, 19.9, 20.3]) {
        // A STEP, not an expedition: 1.4 s is about three metres, aimed
        // straight out to the side. (Aim even slightly forward and the walker
        // passes its own target, turns round, and walks back down the crossing
        // — which is water, by design, and not what this is asking about.)
        const r = drive(C.x + dx * 0.35, C.z + dz, C.x + dx * 4, C.z + dz, 1.4);
        arrival.push({ dx, dz, ...r });
      }
    }
    // and the straight walk in, which must simply arrive. Respawn first: the
    // probes above deliberately drown people, and a death leaves the director
    // mid-beat — the next walk then inches forward and reads as a wall.
    const walkTrace = [];
    {
      g.director.respawn();
      F.stepWith(0.6, {}, false);
      g.dead = false;
      g.player.frozen = false;
      g.player.pos.set(C.x, g.world.groundHeightAt(C.x, C.z + 16.4, 2) + 0.05, C.z + 16.4);
      g.player.vel.set(0, 0, 0);
      g.player.grounded = true;
      g.player.yaw = Math.PI;
      g.player._sync(0);
      for (let t = 0; t < 12; t += 0.1) {
        F.stepWith(0.1, { moveZ: 1 }, false);
        walkTrace.push([+(g.player.pos.z - C.z).toFixed(2), +g.player.pos.y.toFixed(2), g.act]);
        if (g.player.pos.z - C.z > 26 || g.dead) break;
      }
    }
    const walkIn = {
      end: [+(g.player.pos.x - C.x).toFixed(2), +(g.player.pos.z - C.z).toFixed(2)],
      died: g.dead,
      stalledAt: walkTrace.length > 4
        ? walkTrace.slice(-4).map((s) => s.join('/')).join(' ')
        : 'no trace',
    };
    const walkedIn = g.player.pos.z - C.z > 24 && !g.dead;

    // ---- and after a death, without replaying the beat --------------------
    g.director.death(null);
    for (let t = 0; t < 2; t += 0.1) F.stepWith(0.1, {}, false);
    g.director.respawn();
    F.stepWith(0.5, {}, false);
    const afterRespawn = {
      barred: g.basinSill.collider.max.y > g.basinSill.collider.min.y,
      dropped: +(g.basinSill.homeY - g.basinSill.mesh.position.y).toFixed(2),
      done: g.basinSill.done,
    };
    const crossingAgain = drive(C.x, C.z + 2, C.x, C.z + 19, 16);
    const crossedAgain = g.player.pos.z - C.z > 16;

    return {
      bearings, locket, locketReached, machineWest, machineWestReached,
      throwStance, throwStanceReached, sillBefore, lane, arrival, walkIn, walkedIn,
      laneBefore, laneAfter, sideSteps,
      sillAtThaw, sillDown, crossing, crossed, afterRespawn, crossingAgain, crossedAgain,
      draws: g.lastRender.drawCalls,
    };
  });

  const drowned = report.bearings.filter((b) => b.died || b.worstY < -1.5);
  check(drowned.length === 0,
    'driven at the pool from 24 bearings, the shore never lets a player into the deep',
    drowned.length ? drowned.map((b) => `${b.deg}deg y${b.worstY}${b.died ? ' DIED' : ''}`).join(', ')
      : `worst y ${Math.min(...report.bearings.map((b) => b.worstY)).toFixed(2)}`);
  check(!report.lane.died && report.lane.worstY >= -1.5,
    'and the lane, the one gap in the lip, is barred before the crossing is real',
    `y ${report.lane.worstY}${report.lane.died ? ' DIED' : ''}, stopped at ${report.lane.end}`);
  check(report.sillBefore.barred && Math.abs(report.sillBefore.meshY - report.sillBefore.homeY) < 0.01,
    'the bar stands where it was built until something opens it',
    JSON.stringify(report.sillBefore));

  check(report.locketReached && !report.locket.died,
    'the shore locket is still walked to, not fenced off',
    `${report.locketReached} y${report.locket.worstY} end ${report.locket.end}`);
  check(report.machineWestReached && !report.machineWest.died,
    'the pre-thaw walk to the west machine is untouched',
    `${report.machineWestReached} end ${report.machineWest.end}`);
  check(report.throwStanceReached && !report.throwStance.died,
    'the stance the throw is made from is still reachable, and still dry',
    `${report.throwStanceReached} y${report.throwStance.worstY} end ${report.throwStance.end}`);

  check(!report.sillAtThaw.barred && report.sillAtThaw.sinking,
    'the bar goes down with the first stone, not with the bargain',
    JSON.stringify(report.sillAtThaw));
  check(!report.sillDown.barred && report.sillDown.done && report.sillDown.dropped > 1.2,
    'and it sinks all the way out of the way',
    JSON.stringify(report.sillDown));
  check(report.crossed, 'the crossing still crosses', JSON.stringify(report.crossing));
  const sideDrowned = report.sideSteps.filter((s) => s.died || s.worstY < -1.5);
  check(sideDrowned.length === 0,
    'stepping off the side of every stone lands on the bar, not in the deep',
    sideDrowned.length
      ? sideDrowned.map((s) => `stone${s.stone} dz${s.dz} side${s.side} y${s.worstY} end[${s.end}]${s.died ? ' DIED' : ''}`).join(', ')
      : `${report.sideSteps.length} steps, worst y ${Math.min(...report.sideSteps.map((s) => s.worstY)).toFixed(2)}`);
  check(report.laneBefore.every((y) => y < -2.4) && report.laneAfter.every((y) => y > -1.2),
    'and the bar is the bargain: deep beside the stones before it, shallow after',
    `before ${report.laneBefore.join('/')} -> after ${report.laneAfter.join('/')}`);
  const arrivalDeaths = report.arrival.filter((a) => a.died || a.worstY < -1.5);
  check(arrivalDeaths.length === 0,
    'stepping off the top of the crossing, where the cave is already on screen, no longer drowns',
    arrivalDeaths.length
      ? arrivalDeaths.map((a) => `dx${a.dx} z${a.dz} y${a.worstY} end[${a.end}]${a.died ? ' DIED' : ''}`).join(', ')
      : `${report.arrival.length} steps, worst y ${Math.min(...report.arrival.map((a) => a.worstY)).toFixed(2)}`);
  check(report.walkedIn, 'and walking straight in simply arrives',
    JSON.stringify(report.walkIn));

  check(!report.afterRespawn.barred && report.afterRespawn.done && report.afterRespawn.dropped > 1.2,
    'a death after the thaw cannot put the bar back across an open crossing',
    JSON.stringify(report.afterRespawn));
  check(report.crossedAgain, 'and the crossing still crosses after that death',
    JSON.stringify(report.crossingAgain));
  check(errors.length === 0, 'the shore produces zero page/console errors', errors.slice(0, 4).join(' | '));

  writeFileSync(resultsPath('basin-shore-regression.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.log(`\nBASIN SHORE REGRESSIONS FAILED (${failures.length})`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll basin-shore regressions passed.');

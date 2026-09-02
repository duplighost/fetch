// house-chase-doors-regression.mjs -- the house chase routes over the real
// cell graph, and closing a door is a verb that costs the pursuer time.
//
// Alex: "the enemy in the house should come out pretty early and be a better
// chaser so you have to close doors to avoid it." The old router steered at
// whichever OPEN door scored best by straight-line distance -- a door the
// player just shut was invisible to it, there was no second hop, and no
// memory, so it oscillated. These checks pin the new mechanism.
import { ensureServer, launchBrowser, openPage, URL_BASE } from './lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });

const results = await page.evaluate(async () => {
  const g = window.__game, F = window.__FETCH;
  const out = [];
  const check = (name, ok, info) => out.push({ name, ok: !!ok, info });
  F.start();
  F.teleport('house');
  F.stepWith(0.4, {}, false);

  // ---- 1. the graph itself ------------------------------------------------
  const nav = g.world.houseNav;
  check('nav graph exists with cells, doors and holes',
    !!nav && Object.keys(nav.levels).length >= 3
    && nav.levels.ground?.cells.size > 20
    && nav.levels.ground?.doorAt.size >= 4
    && [...Object.values(nav.levels)].some((l) => l.holes.size > 0),
    {
      levels: Object.keys(nav?.levels || {}),
      groundCells: nav?.levels?.ground?.cells.size,
      groundDoors: nav?.levels?.ground?.doorAt.size,
    });

  // the player's own cell resolves
  const pc = g.world.houseCellAt(g.player.pos.x, g.player.pos.z, g.player.pos.y);
  check('player position resolves to a nav cell', !!pc, pc);

  // ---- 2. a shut door blocks a walker's route, and it detours -------------
  g.enemies.clear();
  // find a door on the ground floor that is currently closed and unlocked
  const doors = g.world.doors.filter((d) => d.edge?.lv === 'ground');
  const testDoor = doors.find((d) => !d.open && !d.locked) || doors[0];
  check('found a ground-floor door with a graph edge', !!testDoor?.edge, testDoor?.id || 'anon');

  // stand the player on one side of that door and a walker on the other
  const level = g.world.houseNav.levels.ground;
  const { orient, ex, ez } = testDoor.edge;
  const cellA = orient === 'H' ? [ex, ez - 1] : [ex - 1, ez];
  const cellB = [ex, ez];
  const w = (cx, cz) => [nav.ox + (cx + 0.5) * nav.cs, nav.oz + (cz + 0.5) * nav.cs];
  const [ax, az] = w(...cellA);
  const [bx, bz] = w(...cellB);
  g.player.pos.set(ax, level.floorY, az);
  g.player._sync(0);
  const e = g.enemies.spawn('walker', bx, bz, 'chase');
  e.pos.y = level.floorY;

  testDoor.setOpen(false);
  const passShut = g.world.housePassable('ground', cellB[0], cellB[1],
    orient === 'H' ? 'N' : 'W', false);
  testDoor.setOpen(true);
  const passOpen = g.world.housePassable('ground', cellB[0], cellB[1],
    orient === 'H' ? 'N' : 'W', false);
  check('graph edge: shut door blocks a walker, open door passes',
    passShut === false && passOpen === true, { passShut, passOpen });

  // resident can pass a shut-but-unlocked door on the graph
  testDoor.setOpen(false);
  const passResident = g.world.housePassable('ground', cellB[0], cellB[1],
    orient === 'H' ? 'N' : 'W', true);
  check('graph edge: the Resident routes through shut unlocked doors',
    passResident === true, { passResident });

  // ---- 3. routing never targets the shut door, and detours exist ----------
  const route = g.enemies._houseRoute(e);
  check('route with the door shut avoids it or is null (walker)',
    route === null || route.every((wp) => wp.door !== testDoor),
    { routeLen: route?.length ?? null, doors: route?.map((r) => r.door?.id || 'anon') });

  // ---- 4. closing a door in the pursuer's face costs it time --------------
  testDoor.setOpen(true);
  e.pos.set(bx, level.floorY, bz);
  e.state = 'chase';
  e._doorT = 0.9;                     // mid-commitment on the knob
  e._route = [{ x: 0, z: 0, door: testDoor }];
  e._via = e._route[0];
  testDoor.tryUse(g);                 // the player slams it
  check('slam staggers the pursuer and clears its plan',
    e._doorT === -0.6 && e._route === null && e._via === null && e._viaLast === testDoor,
    { doorT: e._doorT, route: e._route, viaLast: e._viaLast === testDoor });

  // ---- 5. the knob-turn tell precedes the Resident opening a door ---------
  g.enemies.clear();
  const r = g.enemies.spawn('resident', bx, bz, 'chase');
  r.pos.set(bx, level.floorY, bz);
  testDoor.setOpen(false);
  r.pos.x = testDoor.center.x + (orient === 'V' ? 0.9 : 0);
  r.pos.z = testDoor.center.z + (orient === 'H' ? 0.9 : 0);
  r.pos.y = level.floorY;
  let sawRattleBeforeOpen = false;
  let opened = false;
  for (let t = 0; t < 2.0 && !opened; t += 1 / 60) {
    g.enemies._tryOpenDoor(r, 1 / 60);
    if (!opened && testDoor.rattleT > 0 && !testDoor.open) sawRattleBeforeOpen = true;
    if (testDoor.open) opened = true;
  }
  check('knob turns (rattle) before the door opens, and it does open',
    sawRattleBeforeOpen && opened, { sawRattleBeforeOpen, opened });

  // ---- 6. the house is occupied early -------------------------------------
  g.enemies.clear();
  g.director.resident = null;
  g.director._houseResidentT = undefined;
  F.teleport('house');
  F.stepWith(0.2, {}, false);
  const before = g.enemies.list.some((x) => x.kind === 'resident');
  // HOUSE_RESIDENT_DELAY is 18 -- AND THE CLOCK IS HELD WHILE THE LANDING
  // WINDOW SCARE RUNS. _updateResident parks it for the whole entry sequence
  // on purpose ('a Resident arriving mid-fold does not stack, it steps on the
  // only scare in the room'), and that sequence is ~9 s: measured, the clock
  // runs 17.8 -> 5.3 by twelve seconds, then holds through press/sash/fold/
  // skitter/done and the body arrives around 27 s
  // (tools/probe-resident-clock.mjs). A flat 19.5 s budget was written against
  // the bare constant and has been red ever since the hold was added -- it was
  // failing the game for obeying its own design.
  //
  // Wait for the arrival instead of guessing at it, and assert BOTH halves:
  // it comes unprompted, and it does not come before the constant Alex dialled.
  let arrivedAt = null;
  for (let t = 0.5; t <= 40 && arrivedAt === null; t += 0.5) {
    F.stepWith(0.5, {}, false);
    if (g.enemies.list.some((x) => x.kind === 'resident')) arrivedAt = +t.toFixed(1);
  }
  const after = arrivedAt !== null && arrivedAt >= 18;
  check('the Resident walks the house early, unprompted',
    before === false && after === true, { before, after, arrivedAt });

  // and the director pointer self-heals when tests clear the list
  g.enemies.clear();
  F.stepWith(19.5, {}, false);
  check('a cleared list grows a new Resident (self-healing pointer)',
    g.enemies.list.some((x) => x.kind === 'resident'),
    { count: g.enemies.list.length });

  // ======================================================================
  // The house-chaser navigation fix. Alex: "He gets stuck on the stairs and
  // often stuck a lot of places where he can't find his way to you." The
  // storeys are one graph now (stair links), windT means genuine failure,
  // and Marrow's watchdog un-wedges bodies — relocating ONLY while unseen.

  // ---- 10. the stair graph: the main flight is an edge; the cellar is not
  const stairs = nav.stairs || [];
  const mainLink = stairs.find((s) => s.id === 'mainStairs');
  check('stair graph: mainStairs links ground to a non-hole first-floor cell',
    !!mainLink && mainLink.lo.lv === 'ground'
    && mainLink.lo.cx >= 6 && mainLink.lo.cx <= 7
    && mainLink.lo.cz >= 2 && mainLink.lo.cz <= 5
    && mainLink.hi.lv === 'first'
    && !nav.levels.first.holes.has(mainLink.hi.cx + ',' + mainLink.hi.cz),
    mainLink
      ? { lo: [mainLink.lo.lv, mainLink.lo.cx, mainLink.lo.cz], hi: [mainLink.hi.lv, mainLink.hi.cx, mainLink.hi.cz] }
      : { stairs: stairs.map((s) => s.id) });
  check('stair graph: the cellar flights stay off-graph (basement enemy-free)',
    stairs.length > 0 && stairs.every((s) => s.id !== 'cellarStairs' && s.id !== 'cellarReturn'
      && s.lo.lv !== 'basement' && s.hi.lv !== 'basement'),
    { ids: stairs.map((s) => s.id) });

  // ---- 11. a mid-flight body is still on the graph (the frozen-statue
  // spot: world (2, y 1.8, z -6), the centre of the main flight)
  const midCell = g.world.houseCellAt(2, -6, 1.8);
  check('mid-flight body resolves to a tagged stair cell, not null',
    !!midCell && midCell.stair === 'mainStairs', midCell);

  // ---- 12. cross-level route shape: ...doors first, then the flight lo->hi
  g.enemies.clear();
  g.director.resident = null;
  g.director._houseResidentT = 999;          // keep the auto-spawn out of the lab
  g.player.pos.set(2, 3.6, -1);              // top of the flight (stairwell row)
  g.player._sync(0);
  const w2 = g.enemies.spawn('walker', 2, -12, 'chase', 1);   // entry, ground floor
  const cross = g.enemies._houseRoute(w2);
  const lastTwo = cross?.slice(-2) || [];
  check('cross-level route ends with the flight lo->hi centreline waypoints',
    !!cross && cross.length >= 2
    && lastTwo[0]?.stair === 'mainStairs' && lastTwo[1]?.stair === 'mainStairs'
    && Math.abs(lastTwo[0].x - 2) < 0.01 && Math.abs(lastTwo[1].x - 2) < 0.01
    && (lastTwo[0].y ?? 99) < (lastTwo[1].y ?? -99),
    {
      route: cross?.map((wp) => wp.stair
        ? ['stair', +wp.x.toFixed(1), +wp.z.toFixed(1), +(wp.y ?? -1).toFixed(2)]
        : ['door', wp.door?.id || 'anon']),
    });

  // ---- 13. THE ALEX CHECK: a ground-floor Resident reaches an upstairs
  // player: fast, without one stall, without one teleport.
  g.enemies.clear();
  g.director.resident = null;
  const sd = g.world.doorById.stairDoor;
  sd.locked = null; sd.setOpen(false);       // unlocked but SHUT: it must work the knob
  g.player.pos.set(0, 3.6, 3);               // the second-floor landing
  g.player._sync(0);
  const res = g.enemies.spawn('resident', -2, -8, 'chase', 1);   // foyer, ground floor
  res.windT = 3; res._chaseT = 3;
  g.director.resident = res;
  const trail = [];
  let arrived = -1;
  // measured 5.4 s once green; pinned at ~2x so the gate tests the mechanism
  // (the climb + one worked knob), not a lucky run
  for (let t = 0; t < 12 && arrived < 0; t += 0.1) {
    F.stepWith(0.1, {}, false);
    const dist = Math.hypot(g.player.pos.x - res.pos.x, g.player.pos.z - res.pos.z);
    trail.push({ x: res.pos.x, y: res.pos.y, z: res.pos.z, dist });
    if (dist < 1.6 && Math.abs(g.player.pos.y - res.pos.y) < 1.8) arrived = t;
  }
  const tail = trail[trail.length - 1];
  check('THE ALEX CHECK: ground-spawn Resident reaches the landing in < 12 s',
    arrived >= 0,
    {
      arrived: arrived >= 0 ? +arrived.toFixed(1) : null,
      end: [+tail.x.toFixed(1), +tail.y.toFixed(1), +tail.z.toFixed(1), +tail.dist.toFixed(1)],
    });
  let stallWin = null;
  for (let i = 20; i < trail.length && stallWin === null; i++) {
    const a = trail[i - 20], b = trail[i];
    const far = trail.slice(i - 20, i + 1).every((s) => s.dist > 2.2);
    if (far && Math.hypot(b.x - a.x, b.z - a.z) < 0.4) stallWin = +(i * 0.1).toFixed(1);
  }
  check('THE ALEX CHECK: zero >2 s stalls on the pursuit', stallWin === null, { stallWin });
  let maxSlice13 = 0;
  for (let i = 1; i < trail.length; i++) {
    maxSlice13 = Math.max(maxSlice13,
      Math.hypot(trail[i].x - trail[i - 1].x, trail[i].z - trail[i - 1].z));
  }
  check('THE ALEX CHECK: per-slice movement bounded (no teleport, seen or not)',
    maxSlice13 <= res.spec.chase * 0.1 * 3,
    { maxSlice: +maxSlice13.toFixed(2), bound: +(res.spec.chase * 0.1 * 3).toFixed(2) });

  // ---- 14. the stair-freeze regression: mid-flight body, player below
  // (the probe's exact 10.9 s statue at y=1.81)
  g.enemies.clear();
  g.director.resident = null;
  g.player.pos.set(-2, 0, -8);               // foyer, ground floor
  g.player._sync(0);
  const res2 = g.enemies.spawn('resident', 2, -6, 'chase', 2);  // mid-flight
  res2.windT = 3; res2._chaseT = 3;
  g.director.resident = res2;
  const spawnY = res2.pos.y;
  let reengaged = -1;
  for (let t = 0; t < 6 && reengaged < 0; t += 0.1) {
    F.stepWith(0.1, {}, false);
    const dist = Math.hypot(g.player.pos.x - res2.pos.x, g.player.pos.z - res2.pos.z);
    if (dist < 2.5 && Math.abs(g.player.pos.y - res2.pos.y) < 1.8) reengaged = t;
  }
  check('a mid-flight Resident walks DOWN and re-engages in < 6 s',
    spawnY > 1.2 && reengaged >= 0,
    {
      spawnY: +spawnY.toFixed(2),
      reengaged: reengaged >= 0 ? +reengaged.toFixed(1) : null,
      at: [+res2.pos.x.toFixed(1), +res2.pos.y.toFixed(1), +res2.pos.z.toFixed(1)],
    });

  // ---- 15. the walker besiege: a sealed room is an audible paw at the
  // door, never a silent infinite grind — and never a pass-through
  g.enemies.clear();
  g.director.resident = null;
  g.director._houseResidentT = 999;
  const scull = g.world.doors.find((d) => d.edge?.lv === 'ground'
    && d.edge.orient === 'V' && d.edge.ex === 8 && d.edge.ez === 8);
  check('found the scullery door', !!scull, scull?.edge || null);
  scull.setOpen(false);
  g.player.pos.set(0, 0, 2);                 // backhall, one shut door away
  g.player._sync(0);
  const w3 = g.enemies.spawn('walker', 6.4, 3.4, 'chase', 1);   // sealed in the scullery
  w3.windT = 3; w3._chaseT = 3;
  let paws = 0, lastRattle = 0, crossed = false;
  for (let i = 0; i < 80; i++) {
    F.stepWith(0.1, {}, false);
    if ((scull.rattleT || 0) > lastRattle + 0.2) paws++;
    lastRattle = scull.rattleT || 0;
    if (w3.pos.x < 3.9) crossed = true;      // west of the door plane = through the wall
  }
  check('besiege: >= 2 paw pulses in 8 s, the walker never crosses, the door stays shut',
    paws >= 2 && !crossed && !scull.open,
    { paws, crossed, open: scull.open, at: [+w3.pos.x.toFixed(2), +w3.pos.z.toFixed(2)] });

  // ---- 16. the relocate law: only unseen, and announced
  g.enemies.clear();
  g.director.resident = null;
  g.director._houseResidentT = 999;
  const diningDoor = g.world.doors.find((d) => d.edge?.lv === 'ground'
    && d.edge.orient === 'H' && d.edge.ex === 9 && d.edge.ez === 4);   // kitchen->dining
  diningDoor.setOpen(true);
  // (a) camera turned away: the wedged body may silently take its waypoint
  g.player.pos.set(10.5, 0, -12.5);          // dining, far corner
  g.player._sync(0);
  const w4 = g.enemies.spawn('walker', 6, -8, 'chase', 1);
  g.player.yaw = Math.atan2(w4.pos.x - g.player.pos.x, w4.pos.z - g.player.pos.z);  // facing AWAY
  g.player._sync(0);
  w4.windT = 3; w4._chaseT = 3;
  w4._route = [{ x: diningDoor.center.x, z: diningDoor.center.z, door: diningDoor }];
  w4._via = w4._route[0];
  w4._stallT = 7; w4._noGainT = 1;
  w4._unstuck1 = w4._unstuck2 = true;        // pin the ladder at the relocate rung
  F.stepWith(1 / 120, {}, false);
  check('unseen relocate: an unobserved wedged body takes its proven waypoint',
    Math.hypot(w4.pos.x - diningDoor.center.x, w4.pos.z - diningDoor.center.z) < 0.7,
    {
      at: [+w4.pos.x.toFixed(2), +w4.pos.z.toFixed(2)],
      via: [diningDoor.center.x, diningDoor.center.z],
    });
  // (b) camera straight ON it: position continuity for the full window
  g.enemies.clear();
  g.player.pos.set(11, 0, -13);              // deeper in the corner: no contact possible
  g.player._sync(0);
  const w5 = g.enemies.spawn('walker', 6, -8, 'chase', 1);
  w5.graveRiseT = 0;
  g.player.yaw = Math.atan2(-(w5.pos.x - g.player.pos.x), -(w5.pos.z - g.player.pos.z));  // facing IT
  g.player._sync(0);
  w5.windT = 3; w5._chaseT = 3;
  let sawIt = false, maxSlice16 = 0;
  let px16 = w5.pos.x, pz16 = w5.pos.z;
  for (let i = 0; i < 12; i++) {
    w5._route = [{ x: diningDoor.center.x, z: diningDoor.center.z, door: diningDoor }];
    w5._via = w5._route[0];
    w5._stallT = 7; w5._noGainT = 1;         // keep the relocate rung armed all window
    w5._unstuck1 = w5._unstuck2 = true;
    F.stepWith(0.1, {}, false);
    if (w5._losClear) sawIt = true;
    maxSlice16 = Math.max(maxSlice16, Math.hypot(w5.pos.x - px16, w5.pos.z - pz16));
    px16 = w5.pos.x; pz16 = w5.pos.z;
  }
  check('observed stall NEVER relocates (continuity while the camera is on it)',
    sawIt && maxSlice16 <= w5.spec.chase * 0.1 * 3,
    { sawIt, maxSlice: +maxSlice16.toFixed(2), bound: +(w5.spec.chase * 0.1 * 3).toFixed(2) });

  return out;
});

let fails = 0;
for (const r of results) {
  console.log(` ${r.ok ? 'PASS' : 'FAIL'} ${r.name} -- ${JSON.stringify(r.info)}`);
  if (!r.ok) fails++;
}
if (errors.length) { console.log('browser errors:', errors.join(' | ')); fails++; }
console.log(fails ? `FAIL: ${fails} checks` : `PASS: ${results.length} checks, 0 browser errors`);
await browser.close();
server.stop();
process.exit(fails ? 1 : 0);

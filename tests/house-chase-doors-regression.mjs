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
  F.stepWith(19.5, {}, false);        // HOUSE_RESIDENT_DELAY is 18
  const after = g.enemies.list.some((x) => x.kind === 'resident');
  check('the Resident walks the house early, unprompted',
    before === false && after === true, { before, after });

  // and the director pointer self-heals when tests clear the list
  g.enemies.clear();
  F.stepWith(19.5, {}, false);
  check('a cleared list grows a new Resident (self-healing pointer)',
    g.enemies.list.some((x) => x.kind === 'resident'),
    { count: g.enemies.list.length });

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

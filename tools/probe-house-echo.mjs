// probe-house-echo.mjs -- Alex, 2026-09-01: "There is an enemy that looks like
// it is still in the house making sounds when you get to the graveyard."
//
// It was. Two separate ways, and this probe measures both.
//
//   1. NOTHING EVER CLEARED THE HOUSE. _enterBasement's _removeResident only
//      fires if a Resident happens to exist at that instant, and round eighteen
//      let residentHeard spawn one whenever the player is physically upstairs --
//      basement act included. Walk out to the graveyard and the body is still
//      standing in the kitchen, frozen (_updateResident refuses to run outdoors)
//      but still driving a presence loop at ENEMIES[kind].floor from twenty
//      metres away, and still wakeable by a pop.
//
//   2. THE YARD SENT ITS OWN BODIES INDOORS. The chase's stall handler routes a
//      stuck body through the house door graph, and the guard that kept
//      graveyard bodies out of it tested an arena FLAG rather than where the
//      body was standing. Anything in the yard without that flag -- the wreck's
//      passenger, most obviously -- walked itself into the house and stayed
//      there, sounding from inside it for the rest of the act.
//
// The presence floor is the Behind You law and it is right for a threat sharing
// your space; across a wall and forty metres of night it is a creature that
// followed you out of the building. So the floor is now multiplied by whether
// the body and the ears are in the same building, and the yard clears its own
// house on the way past.
//
//   node tools/probe-house-echo.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let failures = 0;
const check = (ok, name, details) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${details === undefined ? '' : ' -- ' + JSON.stringify(details)}`);
};
try {
  // NOT muted: enemyLoop returns a no-op stub when audio is not ready, and a
  // stub cannot be measured. The whole question is what the loop is doing.
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 300000, polling: 100 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.5, {}, false);
    if (!g.audio._ready && g.audio.init) { try { g.audio.init(); } catch { /* no gesture */ } }
    F.stepWith(0.5, {}, false);
    const R = { audio: !!g.audio.ready };

    // Read what a presence loop is actually asking for. setThreat is the only
    // writer; wrapping it records the volume the loop was told to hold.
    const watchLoop = (e) => {
      if (!e || !e.loop || !e.loop.setThreat) return;
      const real = e.loop.setThreat.bind(e.loop);
      e._lastCarry = null;
      e.loop.setThreat = (threat, near, rear, carry = 1) => {
        e._lastThreat = +threat.toFixed(3);
        e._lastCarry = carry;
        return real(threat, near, rear, carry);
      };
    };

    // ---- the house, inhabited --------------------------------------------
    F.teleport('house');
    F.stepWith(0.4, {}, false);
    g.director.residentHeard(1);
    F.stepWith(1.0, {}, false);
    const houseWalker = g.enemies.spawn('walker', -6, -8, 'stalk');
    watchLoop(houseWalker);
    const resident = g.enemies.list.find((e) => e.kind === 'resident');
    watchLoop(resident);
    F.stepWith(0.6, {}, false);
    R.inHouse = {
      kinds: g.enemies.list.map((e) => e.kind),
      residentLoop: !!resident?.loop,
      walkerLoop: !!houseWalker.loop,
      residentCarryIndoors: resident?._lastCarry ?? null,
    };

    // ---- and the graveyard ------------------------------------------------
    F.teleport('graveyard');
    F.stepWith(1.2, {}, false);
    const p = g.player.pos;
    const survivors = g.enemies.list.map((e) => ({
      kind: e.kind, state: e.state,
      pos: [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1)],
      dist: +Math.hypot(e.pos.x - p.x, e.pos.z - p.z).toFixed(1),
      house: e === houseWalker || e === resident,
    }));
    R.afterWalkingOut = {
      player: [+p.x.toFixed(1), +p.z.toFixed(1)],
      survivors,
      houseBodiesLeft: survivors.filter((e) => e.house).length,
      residentPointer: !!g.director.resident,
    };

    // ---- and now the general law, with a body PUT there deliberately -------
    // A yard body can still end up indoors by any route; the floor must not
    // carry across the wall whatever put it there.
    const planted = g.enemies.spawn('walker', -3, -10, 'stalk');
    watchLoop(planted);
    F.stepWith(0.8, {}, false);
    const yardBody = g.enemies.list.find((e) => e.graveArena && e.kind === 'walker');
    watchLoop(yardBody);
    F.stepWith(0.8, {}, false);
    R.law = {
      indoorBodyCarry: planted._lastCarry,
      indoorBodyAt: [+planted.pos.x.toFixed(1), +planted.pos.z.toFixed(1)],
      yardBodyCarry: yardBody ? yardBody._lastCarry : null,
      yardBodyAt: yardBody ? [+yardBody.pos.x.toFixed(1), +yardBody.pos.z.toFixed(1)] : null,
    };

    // ---- and a yard body under stall pressure must not route indoors -------
    // Drive the stall handler directly: park a wreck-passenger-shaped body in
    // the yard, jam its stall clock, and see where it decides to go.
    const stuck = g.enemies.spawn('walker', -9, 13, 'chase');
    stuck.wreckPassenger = true;
    stuck._stallT = 5;
    stuck._noGainT = 5;
    for (let t = 0; t < 4; t += 0.1) {
      stuck._stallT = Math.max(stuck._stallT, 1.2);
      F.stepWith(0.1, {}, false);
    }
    R.stall = {
      at: [+stuck.pos.x.toFixed(1), +stuck.pos.z.toFixed(1)],
      via: stuck._via ? [+stuck._via.x.toFixed(1), +stuck._via.z.toFixed(1)] : null,
      indoors: !!(g.houseShell && stuck.pos.x >= g.houseShell.minX && stuck.pos.x <= g.houseShell.maxX
        && stuck.pos.z >= g.houseShell.minZ && stuck.pos.z <= g.houseShell.maxZ),
    };
    return R;
  });

  console.log(JSON.stringify(out, null, 2));
  console.log('');
  check(out.audio, 'a real AudioContext, so the loops are real', { audio: out.audio });
  check(out.inHouse.residentLoop && out.inHouse.walkerLoop,
    'the house is inhabited and both bodies own a presence loop', out.inHouse);
  check(out.inHouse.residentCarryIndoors === 1,
    'indoors, sharing your space, the floor is carried in full', { carry: out.inHouse.residentCarryIndoors });
  check(out.afterWalkingOut.houseBodiesLeft === 0 && !out.afterWalkingOut.residentPointer,
    'walking out to the graveyard leaves the house its own dead', out.afterWalkingOut);
  check(out.law.indoorBodyCarry === 0,
    'a body inside the house sounds with NO floor while you stand in the yard', out.law);
  check(out.law.yardBodyCarry === 1,
    'and a body out in the yard with you keeps its floor exactly as before', out.law);
  check(!out.stall.indoors && (!out.stall.via || out.stall.via[1] > 6.5),
    'a stalled yard body takes an in-yard leg, never a house doorway node', out.stall);
  console.log('\nerrors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('house-echo.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
console.log(failures ? `\nFAIL: ${failures} checks` : '\nAll checks passed');
if (failures) process.exitCode = 1;

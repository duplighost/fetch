// probe-grave-passenger.mjs -- the funeral's attack budget, with the wreck's
// passenger deliberately awake.
//
// Round eighteen folded a body into the station wagon's cargo well and let it
// out on the car's second hit. It was spawned with none of the graveyard's
// flags, so every list the fight is built on -- graveCandidates, the
// hold-the-ring gate, the claim releases -- filtered right past it, and it
// closed and struck whenever it liked ON TOP of the one or two attackers the
// arena had budgeted. Measured against e166da4 in matched worktrees,
// tests/playthrough.mjs went from 4/4 survived to 2/6, and every beat after the
// funeral failed behind the death.
//
// playthrough only wakes it when a stray throw happens to hit the car twice
// (once in six runs), so it cannot be the gate for this. This wakes it on
// purpose and asks the only two questions that matter:
//
//   DURING the funeral -- does it walk the ring like the Standing Kind, or does
//   it commit to strikes the wave did not budget?
//   AFTER  the funeral -- does it come for you? (The beat must survive the fix.)
//
//   node tools/probe-grave-passenger.mjs
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
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 300000, polling: 100 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;

    // Stand the player in the middle of the yard with the funeral running and
    // the passenger awake, then watch. The player never moves: this measures
    // what the CROWD does, not what a route can dodge.
    const arm = () => {
      F.start();
      F.teleport('graveyard');
      F.stepWith(0.2, {}, false);
      g.player.pos.set(-6, g.world.groundHeightAt(-6, 20, 3), 20);
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      g.skull.holdNow();
      F.stepWith(0.4, {}, false);
    };

    const watch = (seconds, subject = null) => {
      const seen = { strikes: 0, closest: 99, ring: 0, samples: 0, states: {} };
      const P = () => subject || g.wreck.passenger.actor;
      for (let t = 0; t < seconds; t += 1 / 60) {
        F.stepWith(1 / 60, {}, false);
        const e = P();
        if (!e || !g.enemies.list.includes(e)) continue;
        seen.samples++;
        seen.states[e.state] = (seen.states[e.state] || 0) + 1;
        if (e.state === 'strike') seen.strikes++;
        const d = Math.hypot(e.pos.x - g.player.pos.x, e.pos.z - g.player.pos.z);
        if (d < seen.closest) seen.closest = d;
        if (d > 2.6 && d < 6.0) seen.ring++;
        if (g.dead) { seen.died = true; g.dead = false; g.player.frozen = false; }
      }
      seen.closest = +seen.closest.toFixed(2);
      const e = P();
      if (e) {
        seen.end = {
          pos: [+e.pos.x.toFixed(1), +e.pos.y.toFixed(2), +e.pos.z.toFixed(1)],
          player: [+g.player.pos.x.toFixed(1), +g.player.pos.y.toFixed(2), +g.player.pos.z.toFixed(1)],
          state: e.state, windT: +(e.windT || 0).toFixed(1), chaseT: +(e._chaseT || 0).toFixed(1),
          riseFrozen: !!e.riseFrozen, claimed: !!e.graveClaimed,
          arenaOn: !!(g.director.graveArena && !g.director.graveArena.done),
          home: e.home ? [+e.home.x.toFixed(1), +e.home.z.toFixed(1)] : null,
          via: !!e._via, besiege: !!e._besiege, iframes: +(e.iframes || 0).toFixed(2),
        };
      }
      return seen;
    };

    // ---- 1. DURING the funeral -----------------------------------------
    arm();
    // trigger the funeral the way crossing the yard does, then let the waves
    // actually arm before the car is opened
    g.director._updateGraveyardArena?.(0.1);
    for (let t = 0; t < 6; t += 0.1) F.stepWith(0.1, {}, false);
    const during = { armed: !!g.director.graveArena && !g.director.graveArena.done };
    g.wreck.hits = 1;
    g.wreck.passenger.trigger();
    F.stepWith(1.4, {}, false);                       // let the reveal finish
    during.woke = !!g.wreck.passenger.actor;
    during.wave = g.director.graveArena?.wave ?? null;
    Object.assign(during, watch(26));
    during.arenaStillOn = !!g.director.graveArena && !g.director.graveArena.done;

    // ---- 2. AFTER the funeral ------------------------------------------
    arm();
    g.flag('graveyardResolved');
    if (g.director.graveArena) { g.director.graveArena.done = true; g.director.graveArena.pending = 0; }
    else g.director.graveArena = { wave: 3, pending: 0, t: 0, engaged: false, done: true, route: 'restored' };
    g.enemies.clear();
    g.wreck.passenger.reset();
    g.wreck.hits = 1;
    F.stepWith(0.4, {}, false);
    g.wreck.passenger.trigger();
    F.stepWith(1.4, {}, false);
    const after = { woke: !!g.wreck.passenger.actor };
    Object.assign(after, watch(22));

    // ---- 3. CONTROL: an ordinary walker on the same grass ---------------
    // The AFTER measurement is only meaningful against one of these. If a plain
    // graveyard walker started beside the wagon cannot close on a standing
    // player either, the number is the yard's own outdoor pathing and not
    // anything this change did to the passenger.
    arm();
    g.flag('graveyardResolved');
    if (g.director.graveArena) { g.director.graveArena.done = true; g.director.graveArena.pending = 0; }
    g.enemies.clear();
    g.wreck.passenger.reset();
    F.stepWith(0.4, {}, false);
    const ctrlAt = g.wreck.passenger.actor ? null : null;
    const ctrl = g.enemies.spawn('walker', -12, 14, 'wind', 3);
    F.stepWith(0.4, {}, false);
    const control = { spawned: !!ctrl, at: [+ctrl.pos.x.toFixed(1), +ctrl.pos.z.toFixed(1)] };
    Object.assign(control, watch(22, ctrl));

    return { during, after, control, errors: [] };
  });

  console.log('DURING the funeral:', JSON.stringify(out.during));
  console.log('AFTER  the funeral:', JSON.stringify(out.after));
  console.log('CONTROL plain walker:', JSON.stringify(out.control));
  console.log('');
  check(out.during.armed && out.during.woke, 'the funeral is running and the car gave up its passenger',
    { armed: out.during.armed, woke: out.during.woke, wave: out.during.wave });
  check(out.during.strikes === 0,
    'DURING the funeral it walks the ring and commits to no strike the wave did not budget',
    { strikeFrames: out.during.strikes, closest: out.during.closest, states: out.during.states });
  check(out.during.ring > 0, 'DURING the funeral it is still present pressure, out on the ring',
    { ringFrames: out.during.ring, samples: out.during.samples });
  check(out.after.woke, 'AFTER the funeral the car still gives up its passenger', { woke: out.after.woke });
  check(out.after.closest <= out.control.closest + 0.5,
    'AFTER the funeral it closes at least as well as an ordinary walker does',
    { passenger: out.after.closest, control: out.control.closest });
  console.log('\nerrors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('grave-passenger.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
console.log(failures ? `\nFAIL: ${failures} checks` : '\nAll checks passed');
if (failures) process.exitCode = 1;

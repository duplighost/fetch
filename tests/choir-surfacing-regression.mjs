// choir-surfacing-regression.mjs -- the Drowned Choir comes up IN FRONT of you.
//
// His note 3, round six: "in the under waterfall cave area make that enemy
// teleport in front of you, a few times. but not so close that it instantly
// gets you." It is the SECOND asking — enemies.js already carried "should spawn
// way in front of you" from the first, built as one far spawn at the start of
// the act — so it is a gate now.
//
// What this pins, and why each one is a law rather than a preference:
//  - AT MOST THREE. "a few times", not a mechanic.
//  - NEVER NEARER THAN TEN METRES, measured at the instant it arrives, not when
//    the beat began: the player walks three metres during the hush, and the
//    first build measured at the wrong end and delivered 7.4.
//  - ALWAYS ON THE ROUTE, and never in a corridor its body could plug. Running
//    past this thing is the whole escape; a surfacing that seals a corridor is
//    not a scare, it is a wall.
//  - AND NOT ONE NUMBER IN DROWNED_CHOIR MOVES. He asked for placement, not
//    lethality. heardSpeed 4.35 sits under RUN 4.7 and that inequality is the
//    escape rail; the walking bot walking the whole route alive is the proof.
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
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 90000, polling: 100 });

  const report = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game, U = g.underfalls;
    F.start();
    F.teleport('clearing');
    F.stepWith(1 / 120, {}, false);
    const waterfall = g.world.fetchTargets.find((t) => t.id === 'waterfall');
    if (waterfall?.onHit?.call(waterfall, g.skull, waterfall.pos, {}) === 'gone') g.skull.vanish();
    F.teleport('cave');
    F.stepWith(0.5, {}, false);

    const total = U.mainPointAt(1e9).total;
    const seat = (d) => {
      const p = U.mainPointAt(d);
      g.dead = false;
      g.player.frozen = false;
      g.player.pos.set(p.x, U.groundAt(p.x, p.z), p.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);
    };

    // Three laps of the main route at WALK. A single nonstop lap takes about
    // 43 s against a 25 s cooldown, so one lap can only ever show one
    // surfacing — and the obvious way to stretch a lap, standing still, is
    // death by design. Laps are the honest way to reach the cap.
    let deaths = 0, minDist = Infinity, seconds = 0, spec = null;
    for (let lap = 0; lap < 3; lap++) {
      seat(1.5);
      for (let s = 0; s < 90; s += 0.1, seconds += 0.1) {
        const p = g.player.pos;
        const here = U.projectMain(p.x, p.z);
        const wp = U.mainPointAt((here?.routeDistance ?? 0) + 3.0);
        if (wp) { g.player.yaw = Math.atan2(-(wp.x - p.x), -(wp.z - p.z)); g.player.pitch = 0; }
        F.stepWith(0.1, { moveZ: 1 }, false);
        const c = g.enemies.choir;
        if (c) {
          spec = { ...c.spec };
          minDist = Math.min(minDist, Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
        }
        if (g.dead) { deaths++; break; }
        if ((here?.routeDistance ?? 0) > total - 2.5) break;
      }
    }

    const surfacings = (g.enemies.choirSurfaceLog || []).map((s) => {
      const proj = U.projectMain(s.x, s.z);
      return {
        ...s,
        onRoute: !!proj && proj.clearance <= 0,
        clearance: +(proj?.clearance ?? 9).toFixed(2),
      };
    });
    return {
      total: +total.toFixed(1), seconds: +seconds.toFixed(1), deaths,
      minDist: +minDist.toFixed(2), surfacings, spec,
    };
  });

  const s = report.surfacings;
  check(s.length > 0 && s.length <= 3,
    'it comes up in front of you a few times, and never more than three',
    `${s.length} surfacings over ${report.seconds}s of walking`);
  const tooClose = s.filter((x) => x.playerDist < 10);
  check(tooClose.length === 0,
    'and never closer than ten metres, measured when it arrives',
    tooClose.length ? tooClose.map((x) => `#${x.n} ${x.playerDist}m`).join(', ')
      : s.map((x) => `${x.playerDist}m`).join(' / '));
  const offRoute = s.filter((x) => !x.onRoute);
  check(offRoute.length === 0, 'every surfacing lands on the main route, not inside rock',
    offRoute.length ? offRoute.map((x) => `#${x.n} clearance ${x.clearance}`).join(', ')
      : s.map((x) => `clearance ${x.clearance}`).join(' / '));
  const plugged = s.filter((x) => x.w < 1.05);
  check(plugged.length === 0,
    'and never in a corridor narrow enough for its body to plug: running past it is the escape',
    plugged.length ? plugged.map((x) => `#${x.n} half-width ${x.w}`).join(', ')
      : s.map((x) => `half-width ${x.w}`).join(' / '));

  // THE NUMBERS. He asked for placement, not lethality.
  const spec = report.spec || {};
  const pinned = {
    warning: 2.20, drySpeed: 2.60, heardSpeed: 4.35, attackRange: 2.30,
    attackCommit: 0.92, attackRadius: 1.30, recovery: 0.95,
  };
  const drifted = Object.entries(pinned).filter(([k, v]) => spec[k] !== v);
  check(drifted.length === 0,
    'not one number in DROWNED_CHOIR moved — heardSpeed 4.35 is still under RUN 4.7',
    drifted.length ? drifted.map(([k, v]) => `${k} ${v} -> ${spec[k]}`).join(', ')
      : JSON.stringify(pinned));
  check(report.deaths === 0,
    'and the walking bot still walks the whole route alive, three times over',
    `${report.deaths} deaths, closest approach ${report.minDist} m`);
  check(errors.length === 0, 'the cave produces zero page/console errors', errors.slice(0, 4).join(' | '));

  writeFileSync(resultsPath('choir-surfacing-regression.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.log(`\nCHOIR SURFACING REGRESSIONS FAILED (${failures.length})`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll choir-surfacing regressions passed.');

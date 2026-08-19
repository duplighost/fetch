// probe-choir-surfacing.mjs -- his note 3: "in the under waterfall cave area
// make that enemy teleport in front of you, a few times. but not so close that
// it instantly gets you."
//
// Walk the main route at WALK speed and report every surfacing: where it came
// up, how far ahead of the player, how wide the corridor was there, and whether
// the walk still survives (that it does is the fairness contract).
//
// It walks the route more than once on purpose. A nonstop lap takes 43 s and
// the cooldown is 25, so one lap can only ever show one surfacing — and the
// obvious way to lengthen a lap, standing still, is death by design ("a player
// who keeps walking still always escapes; a player who stops still dies"). Laps
// are the honest way to reach the cap of three.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const LAPS = Number(process.argv.find((a) => a.startsWith('--laps='))?.split('=')[1]) || 4;

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 90000, polling: 100 });

  const report = await page.evaluate((laps) => {
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

    const trace = [];
    let heardSpeed = null, deaths = 0, minDist = Infinity, t = 0;
    for (let lap = 0; lap < laps; lap++) {
      seat(1.5);
      for (let s = 0; s < 90; s += 0.1, t += 0.1) {
        const p = g.player.pos;
        const here = U.projectMain(p.x, p.z);
        const wp = U.mainPointAt((here?.routeDistance ?? 0) + 3.0);
        if (wp) { g.player.yaw = Math.atan2(-(wp.x - p.x), -(wp.z - p.z)); g.player.pitch = 0; }
        F.stepWith(0.1, { moveZ: 1 }, false);
        const c = g.enemies.choir;
        if (c) {
          heardSpeed = c.spec.heardSpeed;
          minDist = Math.min(minDist, Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
        }
        if (Math.round(t * 10) % 100 === 0) {
          trace.push([+t.toFixed(1), lap, +(here?.routeDistance ?? -1).toFixed(1),
            c ? +Math.hypot(c.pos.x - p.x, c.pos.z - p.z).toFixed(1) : null, c?.state || '-']);
        }
        if (g.dead) { deaths++; break; }
        if ((here?.routeDistance ?? 0) > total - 2.5) break;
      }
    }
    // Every surfacing point re-examined from outside the moment it happened.
    const surfacings = (g.enemies.choirSurfaceLog || []).map((s) => {
      const proj = U.projectMain(s.x, s.z);
      return { ...s, onRoute: !!proj && proj.clearance <= 0, clearance: +(proj?.clearance ?? 9).toFixed(2) };
    });
    return {
      total: +total.toFixed(1), seconds: +t.toFixed(1), laps, deaths,
      minDist: +minDist.toFixed(2), heardSpeed, surfacings, trace,
      spec: { ...g.enemies.choir?.spec } || null,
    };
  }, LAPS);

  console.log(`route ${report.total} m, ${report.laps} laps, ${report.seconds} s of walking, ${report.deaths} deaths`);
  console.log(`closest approach ${report.minDist} m; heardSpeed ${report.heardSpeed}`);
  console.log(`SURFACINGS (${report.surfacings.length}):`);
  for (const s of report.surfacings) {
    console.log(`  #${s.n} t${s.t}s at [${s.x}, ${s.z}]  ${s.playerDist} m from the player, `
      + `${s.ahead} m along the route, half-width ${s.w}, on route ${s.onRoute} (clearance ${s.clearance})`);
  }
  console.log('trace [t, lap, routeDist, choirDist, state]:');
  for (const row of report.trace) console.log('  ' + JSON.stringify(row));
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('probe-choir-surfacing.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.stop();
}

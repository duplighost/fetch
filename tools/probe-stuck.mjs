// probe-stuck.mjs — walk the whole forest corridor and find every place the
// player stops being able to move. Reports where, and everything the corridor
// systems believed at that moment.
//   node tools/probe-stuck.mjs [runs]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const RUNS = +(process.argv[2] || 4);
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true, null, { timeout: 60000, polling: 200 });
  const out = await page.evaluate(async (runs) => {
    const F = window.__FETCH, g = window.__game;
    const pins = [];
    F.start();
    for (let r = 0; r < runs; r++) {
      F.teleport('forest');
      F.stepWith(0.4);
      g.enemies.clear();
      const f = g.forest;
      // r0 straight ahead; the others weave, which is what a player does
      let stuckFor = 0;
      let prev = g.player.pos.clone();
      for (let i = 0; i < 900; i++) {
        // Steer like a player: face down the trail, then wander around it.
        // A probe that holds W into a bend and never turns just proves that
        // walls stop you, which is not the bug we are hunting.
        const phase = i * 0.06 + r * 2.1;
        const pr0 = f.project(g.player.pos.x, g.player.pos.z);
        if (pr0) {
          const ahead = f.posAt(Math.min(f.length - 1, pr0.s + 4));
          const want = Math.atan2(-(ahead.x - g.player.pos.x), -(ahead.z - g.player.pos.z));
          let d = want - g.player.yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          g.player.yaw += Math.max(-0.12, Math.min(0.12, d)) + Math.sin(phase * 0.37) * 0.03 * r;
        }
        const mX = r === 0 ? 0 : Math.sin(phase) * (r === 3 ? 1 : 0.7);
        F.stepWith(0.1, { moveZ: 1, moveX: mX, run: r % 2 === 0 }, false);
        const p = g.player.pos;
        const moved = prev.distanceTo(p);
        prev = p.clone();
        if (moved < 0.02) stuckFor += 0.1; else stuckFor = 0;
        // A real player who stops moving throws the skull at whatever is in the
        // way. A probe that only walks proves nothing except that walls block.
        if (stuckFor > 0.8) {
          const t = g.world.fetchTargets.find((q) => q.enabled && q.object
            && q.object.position.distanceTo(p) < 7);
          if (t) {
            const o = t.object.position;
            g.player.yaw = Math.atan2(-(o.x - p.x), -(o.z - p.z));
            F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
            F.stepWith(0.5, { throwHeld: true }, false);
            F.stepWith(1 / 120, { throwReleased: true }, false);
            F.stepWith(1.2, {}, false);
            stuckFor = 0;
            prev = g.player.pos.clone();
            continue;
          }
        }
        if (stuckFor > 1.5) {
          const pr = f.project(p.x, p.z);
          const sm = pr ? f.posAt(pr.s) : null;
          pins.push({
            run: r, t: +(i * 0.1).toFixed(1),
            pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
            s: pr ? +pr.s.toFixed(1) : null,
            lat: sm ? +Math.hypot(p.x - sm.x, p.z - sm.z).toFixed(2) : null,
            halfW: pr ? +f.halfW[Math.max(0, Math.min(f.length - 1, Math.round(pr.s)))].toFixed(2) : null,
            sealS: +f.sealS.toFixed(1),
            gapToSeal: pr ? +(pr.s - f.sealS).toFixed(2) : null,
            ravineS: f.ravineS(), fallenS: f.fallenS ? f.fallenS() : null, arenaS: f.arenaS(),
            grounded: g.player.grounded, dead: g.dead,
            // which AABB is actually holding them? stop guessing.
            near: g.world.colliders.filter((c) => p.x > c.min.x - 1.2 && p.x < c.max.x + 1.2
              && p.z > c.min.z - 1.2 && p.z < c.max.z + 1.2 && c.max.y > p.y + 0.05)
              .map((c) => ({ x: [+c.min.x.toFixed(1), +c.max.x.toFixed(1)],
                             y: [+c.min.y.toFixed(1), +c.max.y.toFixed(1)],
                             z: [+c.min.z.toFixed(1), +c.max.z.toFixed(1)] })).slice(0, 6),
          });
          stuckFor = 0;
          if (pins.length > 22) break;
          if (pins.filter((q) => q.run === r).length > 3) break;   // one run cannot own the report
        }
        if (g.dead) break;
      }
      if (pins.length > 22) break;
    }
    return pins;
  }, RUNS);

  if (!out.length) console.log('no pins: the corridor never trapped the player');
  else {
    console.log(`PINNED ${out.length} time(s):`);
    for (const p of out) console.log(' ', JSON.stringify(p));
  }
  if (errors.length) console.log('ERRORS:', errors.join(' | '));
  process.exit(out.length ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

// probe-causeway.mjs -- "you can still fall off the sides of the rocks into the
// water when crossing them into the waterfall." Step off EVERY risen stone, to
// both sides, walking and running, and report the worst y reached against the
// -1.5 death line in director.js's clearing act.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

  const report = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const C = g.clearingCenter;
    F.start();
    F.teleport('clearing');
    F.stepWith(0.5, {}, false);

    // the real post-bargain world
    g.flag('fallsThawed');
    F.stepWith(0.3, {}, false);
    g.director.waterfallTaken();
    for (let t = 0; t < 14; t += 0.1) F.stepWith(0.1, {}, false);

    const stones = g.bridgeStones.map((st) => ({
      dx: +(st.position.x - C.x).toFixed(2),
      dz: +(st.position.z - C.z).toFixed(2),
      y: +st.position.y.toFixed(2),
      top: +g.world.groundHeightAt(st.position.x, st.position.z, 2).toFixed(2),
    }));

    const place = (x, z, yaw) => {
      // A death leaves the director mid-beat and the controller frozen; the
      // next drive then inches forward and reads as a wall that is not there.
      // (This probe drowns people on purpose, so it happens constantly.)
      if (g.dead) {
        F.stepWith(0.5, {}, false);
        g.director.respawn();
        F.stepWith(0.5, {}, false);
      }
      g.dead = false;
      g.player.frozen = false;
      g.player.pos.set(x, g.world.groundHeightAt(x, z, 2) + 0.05, z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.yaw = yaw;
      g.player._sync(0);
    };
    // Walk from a point along a heading and report the worst y reached.
    const step = (fromX, fromZ, headX, headZ, seconds, run) => {
      place(fromX, fromZ, Math.atan2(-headX, -headZ));
      let worstY = g.player.pos.y;
      let died = false;
      for (let t = 0; t < seconds; t += 0.1) {
        F.stepWith(0.1, { moveZ: 1, run: !!run }, false);
        worstY = Math.min(worstY, g.player.pos.y);
        if (g.dead) { died = true; break; }
      }
      return {
        worstY: +worstY.toFixed(2), died,
        end: [+(g.player.pos.x - C.x).toFixed(1), +(g.player.pos.z - C.z).toFixed(1)],
      };
    };

    // ---- off every stone, both sides, walking and running ---------------
    const offs = [];
    g.bridgeStones.forEach((st, i) => {
      for (const side of [-1, 1]) {
        for (const run of [false, true]) {
          const r = step(st.position.x, st.position.z, side, 0, 1.6, run);
          offs.push({ stone: i, dz: +(st.position.z - C.z).toFixed(1), side, run, ...r });
        }
      }
    });
    // and the diagonal, which carries furthest: sideways AND forward
    const diagonals = [];
    g.bridgeStones.forEach((st, i) => {
      for (const side of [-1, 1]) {
        const r = step(st.position.x, st.position.z, side * 0.72, 0.7, 1.6, true);
        diagonals.push({ stone: i, side, ...r });
      }
    });

    // ---- the crossing itself still crosses -------------------------------
    place(C.x, C.z + 2, Math.PI);
    let crossWorst = g.player.pos.y;
    for (let t = 0; t < 16; t += 0.1) {
      g.player.yaw = Math.atan2(-(C.x - g.player.pos.x), -(C.z + 19 - g.player.pos.z));
      F.stepWith(0.1, { moveZ: 1 }, false);
      crossWorst = Math.min(crossWorst, g.player.pos.y);
      if (g.dead) break;
    }
    const crossing = {
      crossed: g.player.pos.z - C.z > 16, died: g.dead,
      worstY: +crossWorst.toFixed(2),
      end: [+(g.player.pos.x - C.x).toFixed(1), +(g.player.pos.z - C.z).toFixed(1)],
    };

    // ---- and how deep the lane actually is, sampled ----------------------
    const profile = [];
    for (let dz = 6; dz <= 21; dz += 1) {
      const row = [];
      for (const dx of [0, 1, 2, 3, 3.5, 4, 5, 6]) {
        row.push(+g.world.terrainHeight(C.x + dx, C.z + dz).toFixed(2));
      }
      profile.push({ dz, row });
    }
    return { stones, offs, diagonals, crossing, profile, draws: g.lastRender?.drawCalls };
  });

  const bad = report.offs.filter((o) => o.died || o.worstY < -1.5);
  const badDiag = report.diagonals.filter((o) => o.died || o.worstY < -1.5);
  console.log('stones:', report.stones.map((s) => `${s.dz}@${s.y}/top${s.top}`).join(' '));
  console.log(`\nSTEP OFF: ${report.offs.length} steps, worst y ${Math.min(...report.offs.map((o) => o.worstY)).toFixed(2)}, drowned ${bad.length}`);
  for (const o of bad) console.log(`  DROWN stone${o.stone} dz${o.dz} side${o.side} run${o.run} y${o.worstY} end[${o.end}]${o.died ? ' DIED' : ''}`);
  console.log(`DIAGONAL: ${report.diagonals.length} steps, worst y ${Math.min(...report.diagonals.map((o) => o.worstY)).toFixed(2)}, drowned ${badDiag.length}`);
  for (const o of badDiag) console.log(`  DROWN stone${o.stone} side${o.side} y${o.worstY} end[${o.end}]${o.died ? ' DIED' : ''}`);
  console.log('CROSSING:', JSON.stringify(report.crossing));
  console.log('\nlane profile (dx 0,1,2,3,3.5,4,5,6):');
  for (const p of report.profile) console.log(`  dz ${String(p.dz).padStart(2)}  ${p.row.map((v) => String(v).padStart(6)).join('')}`);
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('probe-causeway.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.stop();
}

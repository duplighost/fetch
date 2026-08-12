// probe-swing-arc.mjs -- does the ravine rope actually carry the player across?
//
// The rope can only LIFT when the line to the anchor is steeper than
// asin(GRAV/PULL) = asin(14/30) = 27.8 degrees. Below that the vertical pull
// loses to gravity and the swing sinks. This walks the real approach, throws
// through the real input path, and records the whole arc so the claim can be
// checked against numbers instead of intuition.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });
const r = await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  F.start(); F.teleport('forest'); F.stepWith(0.4, {});
  const f = g.forest;
  const anchor = f.ropeAnchor ? f.ropeAnchor.clone() : null;
  // walk the trail until the rope target is within throwing distance
  // put the player on the trail just short of the ravine rather than walking
  // the whole forest: the corridor, the fallen log and the arena all stop a
  // naive bot long before it gets there.
  let bestS = 0, bestD = 1e9;
  for (let ss = 0; ss < f.length; ss += 0.5) {
    const q = f.posAt(ss, 0);
    const d = Math.hypot(q.x - anchor.x, q.z - anchor.z);
    if (d < bestD) { bestD = d; bestS = ss; }
  }
  const approach = f.posAt(Math.max(0, bestS - 9), 0);
  g.player.pos.set(approach.x, f.heightAt(approach.x, approach.z), approach.z);
  f.recentre(g.player.pos);
  g.player._sync(0);
  F.stepWith(0.25, {});
  const trace = [];
  const debug = { bestS: +bestS.toFixed(1), bestD: +bestD.toFixed(2) };
  let latched = false, latchInfo = null;
  for (let i = 0; i < 260 && !latched; i++) {
    F.stepWith(1 / 30, { moveZ: 1, run: true });
    const p = g.player.pos;
    const d = anchor ? Math.hypot(anchor.x - p.x, anchor.z - p.z) : 999;
    if (d < 11 && g.skull.mode === 'held') {
      // aim at the anchor and throw
      const dx = anchor.x - p.x, dz = anchor.z - p.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(anchor.y - (p.y + 1.62), Math.hypot(dx, dz));
      g.player._sync(0);
      F.stepWith(1 / 60, { throwPressed: true, throwHeld: true });
      for (let k = 0; k < 60 && !g.player.swing; k++) F.stepWith(1 / 60, { throwHeld: true });
      if (g.player.swing) {
        latched = true;
        const pv = g.player.swing.point;
        latchInfo = {
          playerAt: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
          pivot: [+pv.x.toFixed(2), +pv.y.toFixed(2), +pv.z.toFixed(2)],
          horiz: +Math.hypot(pv.x - p.x, pv.z - p.z).toFixed(2),
          rise: +(pv.y - (p.y + 1.62)).toFixed(2),
        };
        latchInfo.elevationDeg = +(Math.atan2(latchInfo.rise, latchInfo.horiz) * 180 / Math.PI).toFixed(1);
      }
    }
  }
  if (!latched) return { latched: false, debug, playerEnd: g.player.pos.toArray().map(n=>+n.toFixed(2)), anchor: anchor.toArray().map(n => +n.toFixed(2)) };
  // hold the rope and record the arc
  const start = g.player.pos.clone();
  for (let i = 0; i < 260; i++) {
    F.stepWith(1 / 60, { throwHeld: true });
    const p = g.player.pos;
    const pv = g.player.swing?.point;
    trace.push({
      t: +(i / 60).toFixed(2),
      y: +p.y.toFixed(2),
      fwd: +(p.z - start.z).toFixed(2),
      vy: +g.player.fallV.toFixed(2),
      vh: +Math.hypot(g.player.vel.x, g.player.vel.z).toFixed(2),
      onRope: !!g.player.swing,
      d: pv ? +Math.hypot(pv.x - p.x, pv.y - (p.y + 1.62), pv.z - p.z).toFixed(2) : null,
    });
    if (!g.player.swing && i > 5) break;
  }
  return {
    latched: true, latchInfo, dead: g.dead, debug,
    endPos: g.player.pos.toArray().map(n => +n.toFixed(2)),
    trace: trace.filter((_, i) => i % 6 === 0 || i === trace.length - 1),
    ropeFrames: trace.filter(t => t.onRope).length,
  };
});
await browser.close(); server.stop();
if (!r.latched) { console.log('NEVER LATCHED. anchor:', r.anchor, 'debug:', JSON.stringify(r.debug), 'playerEnd:', r.playerEnd); process.exit(1); }
console.log('latch:', JSON.stringify(r.latchInfo));
console.log('lift threshold: asin(14/30) = 27.8 deg  ->', r.latchInfo.elevationDeg >= 27.8 ? 'CAN LIFT' : 'CANNOT LIFT (sinks)');
console.log('rope frames:', r.ropeFrames, ' dead:', r.dead, ' end:', r.endPos);
console.log('\n   t      y     fwd     vy     vh    dist  rope');
for (const q of r.trace) console.log(`${String(q.t).padStart(5)} ${String(q.y).padStart(6)} ${String(q.fwd).padStart(7)} ${String(q.vy).padStart(6)} ${String(q.vh).padStart(6)} ${String(q.d).padStart(7)}  ${q.onRope ? 'yes' : 'NO'}`);

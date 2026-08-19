// probe-chain.mjs -- ride THE CHAIN through the real input path, exactly as a
// player would: aim at the knot, press (throw), hold while the arc carries
// you, release past the overhead point, catch, and throw at the next one.
// Reports every link's latch, the arc it produced, and where you landed.
//
//   node tools/probe-chain.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });
const r = await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  F.start(); F.teleport('forest'); F.stepWith(0.4, {});
  const f = g.forest;
  const start = f.posAt(160, 0);
  g.player.pos.set(start.x, f.heightAt(start.x, start.z), start.z);
  f.recentre(g.player.pos);
  g.player._sync(0);
  F.stepWith(0.3, {});

  const legs = [];
  for (const link of f.chainLinks.filter((l) => l.s >= 160)) {
    const leg = { s: link.s, latched: false, released: false };
    // walk until the knot is inside throw range
    for (let t = 0; t < 12; t += 0.1) {
      const d = Math.hypot(link.pivot.x - g.player.pos.x, link.pivot.z - g.player.pos.z);
      if (d < 11) break;   // maxRange is 40 — throw from the landing, walk only if truly far
      const dx = link.pivot.x - g.player.pos.x, dz = link.pivot.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      F.stepWith(0.1, { moveZ: 1 });
    }
    // aim and throw
    const p = g.player.pos;
    const dx = link.pivot.x - p.x, dz = link.pivot.z - p.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(link.pivot.y - (p.y + 1.62), Math.hypot(dx, dz));
    g.player._sync(0);
    F.stepWith(1 / 60, { throwPressed: true, throwHeld: true });
    for (let k = 0; k < 90 && !g.player.swing; k++) F.stepWith(1 / 60, { throwHeld: true });
    leg.latched = !!g.player.swing;
    if (!leg.latched) { legs.push(leg); break; }
    leg.latchDist = +Math.hypot(link.pivot.x - p.x, link.pivot.z - p.z).toFixed(1);
    // hold while the pivot is ahead; release once it passes overhead
    let held = 0;
    let maxY = g.player.pos.y;
    while (g.player.swing && held < 4) {
      F.stepWith(1 / 60, { throwHeld: true });
      held += 1 / 60;
      maxY = Math.max(maxY, g.player.pos.y);
      const fw = Math.hypot(link.pivot.x - g.player.pos.x, link.pivot.z - g.player.pos.z);
      if (fw < 1.9 && held > 0.35) break;   // under/past the knot: let go
    }
    F.stepWith(1 / 60, { throwReleased: true });
    leg.released = true;
    leg.heldFor = +held.toFixed(2);
    leg.peakY = +maxY.toFixed(2);
    // fly + land + recall
    for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {});
    leg.walked = 0;
    leg.landS = +(f.project(g.player.pos.x, g.player.pos.z)?.s ?? -1).toFixed(1);
    leg.dead = g.dead;
    legs.push(leg);
    if (g.dead) break;
  }
  F.stepWith(3, { moveZ: 1 });   // walk off the last landing
  const flags = [...g.flags].filter((x) => x.startsWith('forestChain'));
  const endS = +(f.project(g.player.pos.x, g.player.pos.z)?.s ?? -1).toFixed(1);
  return { legs, flags, endS, dead: g.dead };
});
await browser.close(); server.stop();
console.log('legs:');
for (const l of r.legs) {
  console.log(`  s=${l.s}  latched=${l.latched} dist=${l.latchDist ?? '-'}  held=${l.heldFor ?? '-'}s  peakY=${l.peakY ?? '-'}  landedAt s=${l.landS ?? '-'}  dead=${l.dead}`);
}
console.log('latch flags:', r.flags.join(', ') || '(none)');
console.log('final s:', r.endS, ' dead:', r.dead);
const okCount = r.legs.filter((l) => l.latched && l.released && !l.dead).length;
console.log(okCount >= 5 && r.endS > 202 ? '\nCHAIN RIDES END TO END' : '\nCHAIN INCOMPLETE');
process.exit(okCount >= 5 && r.endS > 202 ? 0 : 1);

// probe-geo-lazy.mjs -- is perf-pool's +2 a GORE POOL LEAK, or a web uploading late?
//
// perf-pool-regression asserts renderer.info.memory.geometries is identical
// across two gore bursts. With the new webs it moved 831 -> 833. That check
// exists to catch the gore pool allocating per burst, and +2 is exactly one
// web (a main LineSegments and a dew LineSegments). Three increments that
// counter the first time a geometry is USED IN A DRAW, so a scene object that
// has never entered the frustum has never been counted -- and will be, later,
// for reasons that have nothing to do with gore.
//
// This distinguishes the two. If forcing every web to draw makes the counter
// jump and then the burst delta vanishes, the cause is lazy upload, not a leak.
//   node tools/probe-geo-lazy.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });

const out = await page.evaluate(() => {
  const g = window.__game;
  const geo = () => g.renderer.info.memory.geometries;
  const R = {};

  // --- reproduce perf-pool's sequence exactly ---
  g.render();
  R.afterBoot = geo();
  g.gore(g.player.pos, 100, 40);
  g.render();
  R.afterFirstBurst = geo();
  g._updateGore(1.8);
  g.gore(g.player.pos, 100, 40);
  g.render();
  R.afterSecondBurst = geo();
  R.burstDelta = R.afterSecondBurst - R.afterFirstBurst;

  // --- now force every web to draw, and see what that alone costs ---
  const saved = [];
  for (const w of g.webs) {
    w.traverse((o) => {
      if (!o.geometry) return;
      saved.push([o, o.visible, o.frustumCulled]);
      o.visible = true; o.frustumCulled = false;
    });
  }
  g.render();
  R.afterForcingWebs = geo();
  R.webUploadCost = R.afterForcingWebs - R.afterSecondBurst;
  for (const [o, v, f] of saved) { o.visible = v; o.frustumCulled = f; }

  // --- and repeat the burst pair with every web already uploaded ---
  g.render();
  g.gore(g.player.pos, 100, 40);
  g.render();
  const a = geo();
  g._updateGore(1.8);
  g.gore(g.player.pos, 100, 40);
  g.render();
  R.burstDeltaAfterWarm = geo() - a;

  R.webGeometryTotal = g.webs.reduce((n, w) => { let c = 0; w.traverse((o) => { if (o.geometry) c++; }); return n + c; }, 0);
  return R;
});

console.log('after boot render        :', out.afterBoot);
console.log('after first gore burst   :', out.afterFirstBurst);
console.log('after second gore burst  :', out.afterSecondBurst);
console.log('BURST DELTA (the gate)   :', out.burstDelta, out.burstDelta === 0 ? '(clean)' : '<-- perf-pool fails on this');
console.log('');
console.log('geometries under all webs:', out.webGeometryTotal);
console.log('forcing every web to draw:', out.afterForcingWebs, `(+${out.webUploadCost} uploaded only now)`);
console.log('');
console.log('BURST DELTA once warm    :', out.burstDeltaAfterWarm,
  out.burstDeltaAfterWarm === 0 ? '<-- pool is CLEAN; the +2 was a late upload' : '<-- pool really is allocating');
await browser.close(); await server?.close?.();

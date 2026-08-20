// probe-geo-census.mjs -- WHICH geometries exist, by owner.
// perf-pool-regression's baseline moved 727 -> 831 across one commit, which is
// +104 where the arithmetic predicted -17. Rather than reason about it, count.
//   node tools/probe-geo-census.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });
const out = await page.evaluate(() => {
  const g = window.__game;
  g.render();
  const uploaded = g.renderer.info.memory.geometries;
  const byType = {}, seen = new Set();
  let meshes = 0, lines = 0;
  g.scene.traverse((o) => {
    if (!o.geometry) return;
    if (o.isLineSegments) lines++; else if (o.isMesh) meshes++;
    if (seen.has(o.geometry.uuid)) return;
    seen.add(o.geometry.uuid);
    const t = o.geometry.type + (o.isLineSegments ? ' [lines]' : '');
    byType[t] = (byType[t] || 0) + 1;
  });
  const webGeos = (g.webs || []).reduce((n, w) => {
    let c = 0; w.traverse((o) => { if (o.geometry) c++; }); return n + c;
  }, 0);
  return { uploaded, distinctInScene: seen.size, meshes, lines, webs: (g.webs || []).length, webGeos, byType };
});
console.log('renderer.info.memory.geometries :', out.uploaded);
console.log('distinct geometries in scene    :', out.distinctInScene);
console.log('meshes', out.meshes, ' lineSegments', out.lines, ' webs', out.webs, ' geometries under webs', out.webGeos);
console.log('by type:');
for (const [k, v] of Object.entries(out.byType).sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log('  ', String(v).padStart(4), k);
await browser.close(); await server?.close?.();

// probe-perfpool-camera.mjs -- does the camera MOVE between perf-pool's two samples?
// The claim under test: the +2 geometries are two decorative web LineSegments
// entering the frustum because a gore burst shakes the camera, not the fragment
// pool allocating. If the camera pose is identical at both samples, that claim
// is WRONG and something else is going on.
//   node tools/probe-perfpool-camera.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });
await page.evaluate(() => window.__FETCH.start());
await page.waitForFunction(() => ['ready', 'degraded', 'skipped'].includes(window.__game.shaderWarmup.status), null, { timeout: 120000, polling: 100 });

const out = await page.evaluate(() => {
  const g = window.__game;
  const pose = () => ({
    p: g.camera.position.toArray().map((n) => +n.toFixed(5)),
    q: g.camera.quaternion.toArray().map((n) => +n.toFixed(5)),
    fov: +g.camera.fov.toFixed(4),
    shake: +(g._shake ?? 0).toFixed(5),
    fovKick: +(g.fovKick ?? 0).toFixed(5),
    geo: g.renderer.info.memory.geometries,
  });
  g.render(); g.render();
  const settled = pose();
  g.gore(g.player.pos, 100, 40); g.render();
  const first = pose();
  g._updateGore(1.8); g.gore(g.player.pos, 100, 40); g.render();
  const second = pose();

  // and the same pair with the project's own settle discipline applied
  g._shake = 0; g.fovKick = 0; g.render();
  g.gore(g.player.pos, 100, 40); g._shake = 0; g.fovKick = 0; g.render();
  const firstSettled = pose();
  g._updateGore(1.8); g.gore(g.player.pos, 100, 40); g._shake = 0; g.fovKick = 0; g.render();
  const secondSettled = pose();
  return { settled, first, second, firstSettled, secondSettled };
});

const row = (k, v) => console.log(`  ${k.padEnd(14)} geo=${String(v.geo).padStart(4)}  shake=${String(v.shake).padStart(8)}  fovKick=${String(v.fovKick).padStart(8)}  pos=${v.p.join(',')}`);
console.log('AS THE GATE RUNS IT:');
row('settled', out.settled); row('first burst', out.first); row('second burst', out.second);
console.log(`  --> geometry delta ${out.second.geo - out.first.geo}, camera moved: ${JSON.stringify(out.first.p) !== JSON.stringify(out.second.p)}`);
console.log('\nWITH _shake/fovKick ZEROED (the legibility gate\'s settle discipline):');
row('first burst', out.firstSettled); row('second burst', out.secondSettled);
console.log(`  --> geometry delta ${out.secondSettled.geo - out.firstSettled.geo}, camera moved: ${JSON.stringify(out.firstSettled.p) !== JSON.stringify(out.secondSettled.p)}`);
await browser.close(); await server?.close?.();

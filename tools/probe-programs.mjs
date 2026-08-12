// probe-programs.mjs -- name the programs that compile during play.
//
// probe-hitch proved every stall coincides with new shader programs. This says
// WHICH ones. three.js keeps a live WebGLProgram list on renderer.info.programs;
// each entry carries the material name/type and its cacheKey. Diffing that list
// across an act change or a skull hit names the exact materials that were not
// warmed at boot, which is the difference between guessing at a fix and making
// one.
//
//   node tools/probe-programs.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

const report = await page.evaluate(async () => {
  const g = window.__game;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

  // A program's identity for reporting: three stores type + the material that
  // built it. cacheKey encodes the light counts and defines, which is exactly
  // the axis a curated warm scene gets wrong.
  const snap = () => new Map(g.renderer.info.programs.map((p) => [p.cacheKey, p]));
  const describe = (p) => ({
    name: p.name || '(unnamed)',
    lights: /lights:(\d+)/.exec(p.cacheKey || '')?.[1] ?? null,
    key: (p.cacheKey || '').slice(0, 90),
  });

  const steps = [];
  const record = async (label, fn) => {
    const before = snap();
    const t0 = performance.now();
    await fn();
    const ms = performance.now() - t0;
    const added = [];
    for (const [key, p] of snap()) if (!before.has(key)) added.push(describe(p));
    steps.push({ label, ms: +ms.toFixed(0), added, total: g.renderer.info.programs.length });
  };

  await record('boot->start', async () => { window.__FETCH.start(); for (let i = 0; i < 40; i++) await frame(); });

  for (const act of ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
    await record('enter:' + act, async () => {
      g.teleport(act);
      for (let i = 0; i < 50; i++) await frame();
      await wait(300);
    });
  }

  // Back to the clearing, then fire the two targets that stalled worst, in
  // their own act rather than from the mirror room.
  await record('back:clearing', async () => { g.teleport('clearing'); for (let i = 0; i < 40; i++) await frame(); });
  const fire = (id) => async () => {
    const t = g.world.fetchTargets.find((x) => x.id === id);
    if (!t) return;
    t.enabled = true;
    const p = t.mesh?.getWorldPosition?.(new THREE.Vector3()) || t.pos;
    window.__FETCH.setSkull(p.x, p.y, p.z, 0, 0, 0, 'outbound');
    for (let i = 0; i < 60; i++) await frame();
    await wait(400);
  };
  await record('hit:waterfall', fire('waterfall'));
  await record('enter:cave(after waterfall)', async () => { g.teleport('cave'); for (let i = 0; i < 50; i++) await frame(); });

  return steps;
});

await browser.close();
server.stop();

for (const s of report) {
  console.log(`\n=== ${s.label}  ${s.ms}ms  (+${s.added.length} programs, total ${s.total})`);
  const byName = new Map();
  for (const a of s.added) {
    const k = `${a.name}  lights:${a.lights}`;
    byName.set(k, (byName.get(k) || 0) + 1);
  }
  for (const [k, n] of [...byName].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(3)}x  ${k}`);
  }
}

writeFileSync(resultsPath('programs.json'), JSON.stringify(report, null, 2));
console.log(`\nfull record: ${resultsPath('programs.json')}`);

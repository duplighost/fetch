// probe-compile-slice.mjs -- the last stall: is handing the driver 261 programs
// in ONE call what starves the page for seven seconds, or is that seven seconds
// simply what a cold driver costs?
//
// Measured on the untouched tree AND on the first-draw-warm tree, identically:
// about seven seconds after the warm compile the page stops receiving frames for
// ~7 s, with no JavaScript call over 60 ms anywhere inside it (probe-bedroom-
// block wraps step, render, compile, initTexture and the warm pass and none of
// them own it). So the time is in the GPU process, and it lands at the tail of
// the driver's link work, which tools/probe-link-poll.mjs clocks at 10.1 s.
//
// A/B, one fresh browser each, both in test mode so nothing but the compile
// differs:
//   GULP   one renderer.compile(scene, camera), the way the game does it
//   SLICED the same materials, a few scene children per frame, using
//          compile(subtree, camera, scene) so the light census still comes from
//          the real scene
//
// Same programs either way. If the stall is queue depth, SLICED spreads it into
// nothing; if it is total driver work, both stall the same and the honest answer
// is that a cold profile costs seven seconds once.
//
//   node tools/probe-compile-slice.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();

const run = async (label, mode) => {
  const browser = await launchBrowser();          // fresh profile: cold program cache
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

  await page.evaluate(() => {
    const rec = window.__slice = { frames: [], marks: [] };
    rec.mark = (label) => rec.marks.push({ label, t: +performance.now().toFixed(0) });
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      rec.frames.push({ t: +now.toFixed(0), dt: +(now - last).toFixed(0), programs: window.__game.renderer.info.programs.length });
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const compiled = await page.evaluate(async (mode) => {
    const g = window.__game;
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const camera = g.camera;
    const mask = camera.layers.mask;
    camera.layers.set(0);
    window.__slice.mark('compile:begin');
    const t0 = performance.now();
    const slices = [];
    if (mode === 'gulp') {
      g.renderer.compile(g.scene, camera);
    } else {
      // Top-level children, a couple per frame. compile(subtree, camera, scene)
      // takes its LIGHTS from the third argument, so the census is the real
      // one and the cache keys match what the game will draw with.
      const children = g.scene.children.slice();
      for (let i = 0; i < children.length; i += 2) {
        const s0 = performance.now();
        for (const child of children.slice(i, i + 2)) g.renderer.compile(child, camera, g.scene);
        slices.push(+(performance.now() - s0).toFixed(0));
        await frame();
      }
    }
    camera.layers.mask = mask;
    window.__slice.mark('compile:end');
    return { ms: +(performance.now() - t0).toFixed(0), programs: g.renderer.info.programs.length, slices };
  }, mode);

  await page.waitForTimeout(30000);
  const rec = await page.evaluate(() => window.__slice);
  await browser.close();

  const long = rec.frames.filter((f) => f.dt > 150).sort((a, b) => b.dt - a.dt);
  const begin = rec.marks.find((m) => m.label === 'compile:begin')?.t ?? 0;
  console.log(`\n=== ${label} ===`);
  console.log(`  compile: ${compiled.ms}ms wall, ${compiled.programs} programs${compiled.slices.length ? `, ${compiled.slices.length} slices worst ${Math.max(...compiled.slices)}ms` : ''}`);
  console.log(`  frames over 150ms after the compile began:`);
  for (const f of long.slice(0, 8)) console.log(`    ${String(f.dt).padStart(6)}ms  at +${((f.t - begin) / 1000).toFixed(1)}s  (programs ${f.programs})`);
  console.log(`  total stall over 150ms: ${long.reduce((n, f) => n + f.dt, 0)}ms across ${long.length} frames`);
  if (errors.length) console.log('  errors: ' + errors.slice(0, 3).join(' | '));
  return { label, compiled, long: long.slice(0, 20) };
};

const results = [];
results.push(await run('GULP    one compile() for the whole scene', 'gulp'));
results.push(await run('SLICED  two scene children per frame', 'sliced'));
server.stop();
writeFileSync(resultsPath('compile-slice.json'), JSON.stringify(results, null, 2));

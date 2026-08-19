// probe-warm-experiment.mjs -- decide the warmup strategy by measurement.
//
// A first version of this file toured the acts WITHOUT starting the game and
// concluded a tour warms nothing. That was an invalid instrument: g.teleport()
// on a game that never started does not switch act lighting, and programs are
// keyed on the light configuration, so the tour compiled bedroom variants eight
// times. The game is started first here.
//
// The experiment: tour every act once with a compileAsync at each stop, return
// to the start, then tour again and measure the second pass. If the warm tour
// works, pass two is smooth; if programs are still being created in pass two,
// they come from objects that do not exist during the tour and need a
// different fix.
//
//   node tools/probe-warm-experiment.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const ACTS = ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror'];

const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

const result = await page.evaluate(async (ACTS) => {
  const g = window.__game;
  const gl = g.renderer.getContext();
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const out = { parallelExt: !!gl.getExtension('KHR_parallel_shader_compile') };

  window.__FETCH.start();
  for (let i = 0; i < 40; i++) await frame();
  out.programsAfterStart = g.renderer.info.programs.length;

  // ---- pass one: tour with a compile at each stop ------------------------
  const warm = [];
  for (const act of ACTS) {
    const before = g.renderer.info.programs.length;
    g.teleport(act);
    // One rendered frame first so the renderer's light state matches the act,
    // then compile the real, assembled scene against that state.
    await frame();
    const t0 = performance.now();
    await g.renderer.compileAsync(g.scene, g.camera);
    const compileMs = performance.now() - t0;
    for (let i = 0; i < 30; i++) await frame();
    warm.push({
      act,
      compileMs: +compileMs.toFixed(0),
      newPrograms: g.renderer.info.programs.length - before,
    });
  }
  out.warmPass = warm;
  out.programsAfterWarm = g.renderer.info.programs.length;

  // ---- pass two: the same tour, measured -------------------------------
  const measured = [];
  for (const act of ACTS) {
    const before = g.renderer.info.programs.length;
    g.teleport(act);
    let worst = 0;
    let last = performance.now();
    for (let i = 0; i < 60; i++) {
      await frame();
      const now = performance.now();
      worst = Math.max(worst, now - last);
      last = now;
    }
    measured.push({
      act,
      worstFrameMs: +worst.toFixed(0),
      newPrograms: g.renderer.info.programs.length - before,
    });
  }
  out.measuredPass = measured;
  out.programsFinal = g.renderer.info.programs.length;
  return out;
}, ACTS);

await browser.close();
server.stop();

console.log(`KHR_parallel_shader_compile: ${result.parallelExt}`);
console.log(`programs after start: ${result.programsAfterStart}`);
console.log('\npass 1 -- tour with compileAsync at each stop:');
console.log('  act          compile   +programs');
let total = 0;
for (const a of result.warmPass) {
  total += a.compileMs;
  console.log(`  ${a.act.padEnd(11)} ${String(a.compileMs).padStart(7)}ms ${String(a.newPrograms).padStart(10)}`);
}
console.log(`  tour compile total: ${total}ms   programs now: ${result.programsAfterWarm}`);

console.log('\npass 2 -- same tour, already warm:');
console.log('  act          worst frame   +programs');
for (const a of result.measuredPass) {
  const flag = a.worstFrameMs > 100 ? '  <-- STILL STALLS' : '';
  console.log(`  ${a.act.padEnd(11)} ${String(a.worstFrameMs).padStart(11)}ms ${String(a.newPrograms).padStart(10)}${flag}`);
}
console.log(`\nfinal programs: ${result.programsFinal}`);

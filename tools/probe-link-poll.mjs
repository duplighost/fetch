// probe-link-poll.mjs -- what does it COST to ask the driver whether it has
// finished linking, and how long does it take to say yes?
//
// The first-draw warm pass must not issue its first draw while the driver is
// still linking: measured, that one draw waits 6867 ms (it appears to drain the
// whole pending queue, not just its own program). KHR_parallel_shader_compile
// exists to ask without waiting -- but an earlier probe polled it every frame
// and the frames went to ~550 ms, which reads like the question is not free.
//
// So: time one full poll of every program, sampled at a realistic interval, and
// record when the answer flips to "all linked" relative to the compile.
//
//   node tools/probe-link-poll.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

const out = await page.evaluate(async () => {
  const g = window.__game;
  const gl = g.renderer.getContext();
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!ext) return { ext: false };

  // Wait for the compile to have happened at all (idle-scheduled).
  const t0 = performance.now();
  while (!['created', 'ready', 'degraded'].includes(g.shaderWarmup.status) && performance.now() - t0 < 30000) {
    await wait(50);
  }
  const compiledAt = performance.now();

  const poll = () => {
    const list = g.renderer.info.programs || [];
    const s0 = performance.now();
    let done = 0;
    for (const p of list) {
      try { if (gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)) done++; } catch { /* disposed */ }
    }
    return { done, total: list.length, ms: +(performance.now() - s0).toFixed(2) };
  };

  const samples = [];
  let settledAt = null;
  for (let i = 0; i < 60; i++) {
    const s = poll();
    s.t = +(performance.now() - compiledAt).toFixed(0);
    samples.push(s);
    if (settledAt === null && s.total > 0 && s.done === s.total) { settledAt = s.t; break; }
    await wait(400);
  }
  return { ext: true, compiledAfterBootMs: +(compiledAt - t0).toFixed(0), settledAt, samples };
});

await browser.close();
server.stop();

if (!out.ext) { console.log('KHR_parallel_shader_compile NOT available'); process.exit(0); }
console.log(`all programs report linked ${out.settledAt}ms after the warm compile`);
console.log('poll cost / progress:');
for (const s of out.samples) console.log(`  t=${String(s.t).padStart(6)}ms  ${s.done}/${s.total}  poll took ${s.ms}ms`);
const costs = out.samples.map((s) => s.ms);
console.log(`\npoll cost: median ${costs.sort((a, b) => a - b)[costs.length >> 1]}ms, worst ${Math.max(...costs)}ms`);
if (errors.length) console.log('errors: ' + errors.slice(0, 4).join(' | '));

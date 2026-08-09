// smoke.mjs -- the gate. Headless drive of FETCH on the real GPU (d3d11 ANGLE).
// Boots ?test=1, waits for the __FETCH debug API, teleports through every act,
// steps the sim 90 frames each and screenshots it, wall-clock times a 300-step
// render-free simulation burst, and enforces render budgets. This is not an FPS
// benchmark. Exits non-zero on any failed assertion.
//   node tests/smoke.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const ACTS = ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror'];
const REQUIRED = ['start', 'step', 'state', 'teleport'];

const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

const report = { url: '', version: null, acts: {}, perf: null, render: null, errors: [], fails };

const server = await ensureServer();
const browser = await launchBrowser();
try {
  report.url = `${URL_BASE}/?test=1`;
  const { page, errors } = await openPage(browser, report.url);
  report.errors = errors;

  await page.waitForFunction(
    () => window.__FETCH && window.__FETCH.ready === true,
    null, { timeout: 60000, polling: 200 },
  );
  ok(true, 'boot: __FETCH.ready === true');
  ok(errors.length === 0, 'boot: zero page errors' + (errors.length ? ' -- ' + errors.slice(0, 5).join(' | ') : ''));

  // Contract check first: a missing method should read as a contract break, not a cryptic evaluate error.
  const missing = await page.evaluate(
    (names) => names.filter(n => typeof window.__FETCH[n] !== 'function'), REQUIRED,
  );
  if (missing.length) {
    throw new Error('window.__FETCH is missing required methods: ' + missing.join(', ')
      + ' -- smoke contract needs { ' + REQUIRED.join(', ') + ' }');
  }

  report.version = await page.evaluate(() => window.__FETCH.version ?? null);
  console.log('  __FETCH version:', report.version);

  await page.evaluate(() => window.__FETCH.start());

  for (const act of ACTS) {
    const errBefore = errors.length;
    // Preserve the story's one broken promise in visual coverage: the cave and
    // mirror are only representative when the waterfall has actually kept it.
    if (act === 'cave') await page.evaluate(() => {
      const g = window.__game;
      if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
      g.skull.vanish();
    });
    await page.evaluate((a) => window.__FETCH.teleport(a), act);
    if (act === 'mirror') await page.evaluate(() => {
      const g = window.__game;
      g.player.yaw = 0;
      g.player.pitch = 0;
      g.player._sync(0);
    });
    await page.evaluate((frames) => window.__FETCH.step(1 / 60, frames, false), act === 'mirror' ? 540 : 90);
    // Sample the act we just exercised. Sim-only stepping does not render, and
    // reading state first used to leave the previous/easiest act's renderer
    // counters in place while claiming every act was under budget.
    await page.evaluate(() => window.__game.render());
    const state = await page.evaluate(() => window.__FETCH.state());
    report.acts[act] = state;
    ok(state && state.act === act, `act ${act}: state.act === '${act}'`
      + (state && state.act !== act ? ` (got '${state && state.act}')` : ''));
    ok(errors.length === errBefore, `act ${act}: no new page errors`
      + (errors.length > errBefore ? ' -- ' + errors.slice(errBefore).join(' | ') : ''));
    const actRender = state?.render;
    ok(actRender && typeof actRender.drawCalls === 'number' && typeof actRender.geometries === 'number',
      `act ${act}: exposes render counters`);
    if (actRender) {
      ok(actRender.drawCalls < 700,
        `act ${act}: drawCalls ${actRender.drawCalls} < 700`);
      ok(actRender.geometries < 1500,
        `act ${act}: geometries ${actRender.geometries} < 1500`);
    }
    // page.screenshot can't composite the accelerated canvas headless — read the
    // canvas itself (preserveDrawingBuffer is on for exactly this)
    const dataUrl = await page.evaluate(() => {
      window.__game.render();
      return window.__game.renderer.domElement.toDataURL('image/png');
    });
    writeFileSync(shotPath(act + '.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }

  // Simulation-throughput probe: no render calls occur inside this burst.
  const elapsedMs = await page.evaluate(async () => {
    const t0 = performance.now();
    await window.__FETCH.step(1 / 60, 300, false);
    return performance.now() - t0;
  });
  const simFps = 300 / (elapsedMs / 1000);
  report.perf = { frames: 300, elapsedMs, simFps, kind: 'render-free simulation steps per second' };
  ok(simFps > 25, `perf: simulation throughput ${simFps.toFixed(1)} steps/s > 25 (300 steps in ${elapsedMs.toFixed(0)}ms)`);

  // Preserve one compact worst-act summary for machines that consume the JSON,
  // while the assertions above protect every sampled act individually.
  const renderedActs = Object.entries(report.acts)
    .filter(([, state]) => state?.render && typeof state.render.drawCalls === 'number');
  const [worstAct, worstState] = renderedActs.reduce((worst, entry) => (
    !worst || entry[1].render.drawCalls > worst[1].render.drawCalls ? entry : worst
  ), null) || [null, null];
  const geometryWorst = renderedActs.reduce((worst, entry) => (
    !worst || entry[1].render.geometries > worst[1].render.geometries ? entry : worst
  ), null);
  const render = worstState?.render || null;
  report.render = render ? {
    ...render,
    act: worstAct,
    maxGeometryAct: geometryWorst?.[0] || worstAct,
    maxGeometries: geometryWorst?.[1]?.render?.geometries ?? render.geometries,
  } : null;
  ok(render && typeof render.drawCalls === 'number' && typeof render.geometries === 'number',
    'state().render exposes {drawCalls, triangles, geometries, textures}');
  if (render) {
    console.log('  render:', JSON.stringify(render));
    ok(render.drawCalls < 700, `budget: drawCalls ${render.drawCalls} < 700`);
    ok(render.geometries < 1500, `budget: geometries ${render.geometries} < 1500`);
  }

  ok(errors.length === 0, 'overall: zero page/console errors'
    + (errors.length ? ' -- ' + errors.slice(0, 8).join(' | ') : ''));
} catch (e) {
  const msg = 'exception: ' + (e && e.message || e);
  fails.push(msg);
  console.log('FAIL ' + msg);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

report.pass = fails.length === 0;
writeFileSync(resultsPath('smoke.json'), JSON.stringify(report, null, 2));
console.log(fails.length
  ? `\n${fails.length} FAILURES:\n` + fails.map(f => '  - ' + f).join('\n')
  : '\nALL PASS');
process.exit(fails.length ? 1 : 0);

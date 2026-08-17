// probe-cold-start.mjs -- reproduce ALEX'S start, not a patient one.
//
// probe-programs waits for __FETCH.ready and then spends a page.evaluate before
// it presses start, which is long enough for the idle-scheduled shader warmup
// to have already run: it measures a WARM boot and reports a nearly clean run.
// Alex spams the title button. The button is in the static HTML, so the first
// click that lands after _wireOverlays() starts the game -- typically hundreds
// of milliseconds before requestIdleCallback's 1200 ms timeout fires. This
// probe does exactly that: hammer the start control from page load, then walk
// the acts and record every long frame with the program census either side of
// it. Long frame + new programs on the same frame = a compile stall, which is
// what Alex feels as "many many areas of the game freeze for a few seconds".
//
//   node tools/probe-cold-start.mjs            # spam-click (his path)
//   node tools/probe-cold-start.mjs --patient  # wait for the warmup first
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const PATIENT = process.argv.includes('--patient');

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1&hitch=1`);

// The spam. Installed as an init script and re-run from page load, so the very
// first click the wired listener can see is the one that starts the game.
if (!PATIENT) {
  await page.addInitScript(() => {
    const hammer = () => {
      const button = document.querySelector('#title [data-action="start"]');
      if (button) button.click();
      if (!window.__game?.started) requestAnimationFrame(hammer);
    };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', hammer);
    else hammer();
  });
}
// Frame recorder: raw rAF deltas plus the program census, installed before boot.
await page.addInitScript(() => {
  window.__frames = { long: [], count: 0, worstMs: 0 };
  let last = performance.now();
  const tick = (now) => {
    const ms = now - last;
    last = now;
    const f = window.__frames;
    f.count++;
    if (ms > f.worstMs) f.worstMs = ms;
    if (ms > 100) {
      const g = window.__game;
      f.long.push({
        ms: +ms.toFixed(0),
        at: +(now / 1000).toFixed(2),
        act: g?.act || null,
        started: !!g?.started,
        programs: g?.renderer?.info?.programs?.length ?? null,
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

if (PATIENT) {
  await page.waitForFunction(
    () => ['ready', 'degraded', 'skipped'].includes(window.__game.shaderWarmup.status),
    null, { timeout: 90000, polling: 100 },
  );
  await page.evaluate(() => window.__FETCH.start());
}
await page.waitForFunction(() => window.__game?.started === true, null, { timeout: 90000, polling: 50 });
await page.waitForTimeout(1500);

const report = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const steps = [];
  // Name what compiled. three keeps material name + cacheKey on every live
  // program, and the cacheKey encodes the light count — the axis a warm pass
  // gets wrong. An unnamed program with lights:null is a material built on
  // demand, which is the thing to go and build at boot instead.
  const snap = () => new Map(g.renderer.info.programs.map((p) => [p.cacheKey, p]));
  const describe = (p) => ({
    name: p.name || '(unnamed)',
    lights: /lights:(\d+)/.exec(p.cacheKey || '')?.[1] ?? null,
    key: (p.cacheKey || '').slice(0, 120),
  });
  const record = async (label, fn) => {
    const before = snap();
    const marker = window.__frames.long.length;
    const hitchMark = window.__FETCH.hitches().length;
    const t0 = performance.now();
    await fn();
    const added = [];
    for (const [key, p] of snap()) if (!before.has(key)) added.push(describe(p));
    steps.push({
      label,
      ms: +(performance.now() - t0).toFixed(0),
      programs: g.renderer.info.programs.length,
      added,
      hitches: window.__FETCH.hitches().slice(hitchMark),
      longFrames: window.__frames.long.slice(marker),
    });
  };
  const split = {};
  for (const act of ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
    await record('enter:' + act, async () => {
      // Separate the CPU build from the GPU first-draw: teleport() constructs
      // and reveals, the next rendered frame is where anything unseen becomes
      // a buffer upload. Which of the two is bigger decides whether the fix is
      // "build it at boot" or "draw it once at boot".
      const t0 = performance.now();
      g.teleport(act);
      const buildMs = performance.now() - t0;
      const geoAfterBuild = g.renderer.info.memory.geometries;
      const r0 = performance.now();
      await frame();
      await frame();
      const drawMs = performance.now() - r0;
      split[act] = {
        buildMs: +buildMs.toFixed(0),
        drawMs: +drawMs.toFixed(0),
        geoAfterBuild,
        geoAfterDraw: g.renderer.info.memory.geometries,
      };
      for (let i = 0; i < 48; i++) await frame();
      await wait(300);
    });
  }
  window.__split = split;
  return {
    warmup: { ...g.shaderWarmup },
    textureWarmup: g.textureWarmup ? { ...g.textureWarmup } : null,
    programsAtEntry: g._programsAtEntry ?? null,
    programsNow: g.renderer.info.programs.length,
    frames: { count: window.__frames.count, worstMs: +window.__frames.worstMs.toFixed(0) },
    longFrames: window.__frames.long,
    hitches: window.__FETCH.hitches(),
    split,
    steps,
  };
});

await browser.close();
server.stop();

console.log(`mode: ${PATIENT ? 'patient (warmup allowed to finish)' : 'SPAM CLICK (Alex)'}`);
console.log(`warmup: ${report.warmup.status}${report.warmup.reason ? ' / ' + report.warmup.reason : ''}`
  + (report.warmup.durationMs ? ` (${report.warmup.durationMs.toFixed(0)}ms)` : ''));
if (report.textureWarmup) {
  console.log(`textures: ${report.textureWarmup.status} ${report.textureWarmup.uploaded ?? '?'} uploaded`
    + (report.textureWarmup.durationMs ? ` (${report.textureWarmup.durationMs.toFixed(0)}ms)` : ''));
}
console.log(`programs total ${report.programsNow}; worst frame ${report.frames.worstMs}ms over ${report.frames.count} frames`);
for (const s of report.steps) {
  const worst = s.longFrames.reduce((n, f) => Math.max(n, f.ms), 0);
  console.log(`  ${s.label.padEnd(20)} +${String(s.added.length).padStart(3)} programs  ${String(s.longFrames.length).padStart(2)} long frames  worst ${worst}ms`);
  const byName = new Map();
  for (const a of s.added) {
    const k = `${a.name}  lights:${a.lights}`;
    byName.set(k, (byName.get(k) || 0) + 1);
  }
  for (const [k, n] of [...byName].sort((a, b) => b[1] - a[1])) console.log(`        ${String(n).padStart(3)}x ${k}`);
  for (const h of s.hitches) {
    console.log(`        HITCH ${h.ms}ms  +${h.programs} programs  +${h.geometries} geometries  +${h.textures} textures  @${h.pos}`);
  }
}
console.log('\nbuild vs first draw, per act:');
for (const [act, s] of Object.entries(report.split || {})) {
  console.log(`  ${act.padEnd(10)} build ${String(s.buildMs).padStart(5)}ms -> ${s.geoAfterBuild} geometries`
    + `   first draws ${String(s.drawMs).padStart(5)}ms -> ${s.geoAfterDraw} (+${s.geoAfterDraw - s.geoAfterBuild})`);
}
console.log('\nlong frames, whole session:');
for (const f of report.longFrames) console.log(`  ${String(f.ms).padStart(5)}ms  t=${f.at}s  act=${f.act}  programs=${f.programs}`);
console.log('\ngame hitch log (?hitch=1):');
for (const h of report.hitches || []) {
  console.log(`  ${String(h.ms).padStart(5)}ms  t=${h.at}s  ${String(h.act).padEnd(10)} +${h.programs}p +${h.geometries}g +${h.textures}t  @${h.pos}`);
}
if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));

const file = resultsPath(PATIENT ? 'cold-start-patient.json' : 'cold-start.json');
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`\nfull record: ${file}`);

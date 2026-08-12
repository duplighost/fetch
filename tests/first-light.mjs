// FIRST LIGHT GATE — the test 0.6.0 was missing.
//
// Every canonical suite boots ?test=1, which skips shader warmup and asserts
// on renderer counters; a renderer can pass all of them while presenting
// black. 0.6.0 shipped two composing defects on the real player path:
//
//   1. COMPOSITOR: reduced-detail frames rendered the playable silhouette,
//      then the grain pass cleared it to black (autoClear was never disabled
//      on that branch). Found by Codex on production pixels.
//   2. RACE: the warmup itinerary captured the live view exactly once at a
//      fixed position; a Wake click after that point stranded the game in
//      reduced detail forever.
//
// This gate boots the REAL player path (no test flag) and clicks Wake at
// three adversarial times. Instrumentation is deliberately paranoid, because
// the first two versions of this very test produced false greens:
//   - pixels come from a passive rAF observer registered after the game's
//     own loop — the harness NEVER calls g.render();
//   - stalls come from PerformanceObserver('longtask') — rAF timestamps are
//     stamped before callbacks run and hide in-frame freezes;
//   - deadlines are enforced on node-side wall clock, not in-page numbers.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const FALLBACK_DEADLINE_S = 4;    // click → first visible frame (silhouette ok)
const WORLD_DEADLINE_S = 120;     // click → authored world, cold 980M under load
const STALL_LIMIT_MS = 2500;      // longest tolerated post-click main-thread block
const SILHOUETTE_LUMA = 8;        // reduced+grain composite measures ~25
const WORLD_LUMA = 60;            // authored bedroom peaks ~230

const installObserver = (page) => page.evaluate(({ SILHOUETTE_LUMA, WORLD_LUMA }) => {
  const fl = window.__fl = {
    clickAt: null, firstNonBlackMs: null, firstWorldMs: null,
    longestTaskMs: 0, reducedProof: null,
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (fl.clickAt != null && entry.startTime + entry.duration > fl.clickAt
          && entry.duration > fl.longestTaskMs) fl.longestTaskMs = entry.duration;
    }
  }).observe({ entryTypes: ['longtask'] });
  const probe = document.createElement('canvas');
  probe.width = 96; probe.height = 54;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const tick = (t) => {
    const g = window.__game;
    if (g?.renderer?.domElement && g.started && fl.clickAt != null) {
      try {
        ctx.drawImage(g.renderer.domElement, 0, 0, 96, 54);
        const d = ctx.getImageData(0, 0, 96, 54).data;
        let max = 0;
        for (let i = 0; i < d.length; i += 4) {
          const luma = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
          if (luma > max) max = luma;
        }
        const now = performance.now();
        const r = g.lastRender || {};
        if (max >= SILHOUETTE_LUMA && fl.firstNonBlackMs == null) fl.firstNonBlackMs = now - fl.clickAt;
        if (max >= WORLD_LUMA && fl.firstWorldMs == null) fl.firstWorldMs = now - fl.clickAt;
        if (!fl.reducedProof && r.reducedDetail === true && (r.worldDrawCalls || 0) > 0
            && r.grainSubmitted === true && max >= SILHOUETTE_LUMA) {
          fl.reducedProof = { luma: +max.toFixed(1), worldDrawCalls: r.worldDrawCalls };
        }
      } catch { /* context mid-boot or lost; keep observing */ }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, { SILHOUETTE_LUMA, WORLD_LUMA });

const clickWake = (page) => page.evaluate(() => {
  window.__fl.clickAt = performance.now();
  document.querySelector('[data-action="start"]')?.click();
});

const readObserver = (page) => page.evaluate(() => ({
  fallbackS: window.__fl.firstNonBlackMs != null ? +(window.__fl.firstNonBlackMs / 1000).toFixed(2) : null,
  worldS: window.__fl.firstWorldMs != null ? +(window.__fl.firstWorldMs / 1000).toFixed(2) : null,
  stallMs: Math.round(window.__fl.longestTaskMs),
  reducedProof: window.__fl.reducedProof,
}));

const server = await ensureServer();
const browser = await launchBrowser();
const report = { limits: { FALLBACK_DEADLINE_S, WORLD_DEADLINE_S, STALL_LIMIT_MS }, scenarios: [] };
const failures = [];
const record = (name, pass, detail, message) => {
  report.scenarios.push({ name, pass, ...detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${message}`);
  if (!pass) failures.push(name);
};

// --- Scenarios 1-3: Wake timing vs the warmup itinerary --------------------
const wakeScenarios = [
  { name: 'immediate-wake', before: async () => {} },
  { name: 'mid-itinerary-wake', before: (page) => page.waitForTimeout(9000) },
  {
    // The regime that deadlocked 0.6.0: idle on the title until the bulk
    // chapters compiled, then click — the one-shot capture point is long past.
    name: 'late-wake-after-itinerary',
    before: (page) => page.waitForFunction(
      () => (window.__game?.shaderWarmup?.readyVariants || []).includes('house-world'),
      null, { timeout: 150000 },
    ).then(() => page.waitForTimeout(3000)),
  },
];

for (const scenario of wakeScenarios) {
  const { page, errors } = await openPage(browser, `${URL_BASE}/`, { quiet: true });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  await installObserver(page);
  await scenario.before(page);
  const wallStart = Date.now();
  await clickWake(page);
  let row = await readObserver(page);
  while (Date.now() - wallStart < WORLD_DEADLINE_S * 1000) {
    row = await readObserver(page);
    if (row.worldS != null) break;
    await page.waitForTimeout(500);
  }
  const wallWorldS = row.worldS != null ? +((Date.now() - wallStart) / 1000).toFixed(1) : null;
  const pageErrors = errors.filter((line) => !/favicon|404/i.test(line));
  const pass = row.fallbackS != null && row.fallbackS <= FALLBACK_DEADLINE_S
    && row.worldS != null && wallWorldS != null && wallWorldS <= WORLD_DEADLINE_S
    && row.stallMs <= STALL_LIMIT_MS
    && pageErrors.length === 0;
  record(scenario.name, pass, { ...row, wallWorldS, pageErrors },
    `fallback ${row.fallbackS ?? 'NEVER'}s, world ${row.worldS ?? 'NEVER'}s`
    + ` (wall ${wallWorldS ?? '>' + WORLD_DEADLINE_S}s), longest stall ${row.stallMs}ms`
    + (pageErrors.length ? ', errors: ' + pageErrors.join(' | ') : ''));
  await page.close();
}

// --- Scenario 4: the reduced compositor where it legitimately runs ---------
// Reach the authored world, then lose and restore the WebGL context.
// Generation 1 re-enters reduced detail while the warmup re-runs; those
// frames MUST compose non-black. This is the exact frame class 0.6.0 erased.
{
  const { page, errors } = await openPage(browser, `${URL_BASE}/`, { quiet: true });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  await installObserver(page);
  await clickWake(page);
  const wallStart = Date.now();
  let up = null;
  while (Date.now() - wallStart < WORLD_DEADLINE_S * 1000) {
    up = await readObserver(page);
    if (up.worldS != null) break;
    await page.waitForTimeout(500);
  }
  if (up?.worldS == null) {
    record('reduced-compositor-visible', false, { up }, 'never reached the authored world before context loss');
  } else {
    await page.evaluate(() => {
      window.__loseExt = window.__game.renderer.getContext().getExtension('WEBGL_lose_context');
      window.__loseExt.loseContext();
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      window.__fl.reducedProof = null; // only count post-restore frames
      window.__loseExt.restoreContext();
    });
    let proof = null;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const r = await readObserver(page);
      if (r.reducedProof) { proof = r.reducedProof; break; }
      await page.waitForTimeout(300);
    }
    const pageErrors = errors.filter((line) => !/favicon|404|CONTEXT_LOST/i.test(line));
    record('reduced-compositor-visible', !!proof && pageErrors.length === 0, { proof, pageErrors },
      proof
        ? `reduced frame composed non-black after context restore (luma ${proof.luma}, world calls ${proof.worldDrawCalls})`
        : 'no visible reduced+grain frame within 45s of context restore');
  }
  await page.close();
}

writeFileSync(resultsPath('first-light.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
server.stop();
if (failures.length) {
  console.error(`FIRST LIGHT FAILED: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('ALL PASS — visible fast, authored world within deadline, no seizure, reduced compositor presents');

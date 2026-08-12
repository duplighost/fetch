// FIRST LIGHT GATE — the test 0.6.0 was missing.
//
// Every canonical suite boots ?test=1, which skips shader warmup and asserts
// on renderer counters; a renderer can pass all of them while presenting
// black. 0.6.0 shipped two composing defects on the real player path
// (reduced compositor erased by the grain pass; one-shot view capture losing
// the Wake race), and the first repair attempt (0.6.1) revealed a third
// truth on a real playtest: the reduced silhouette cannot draw the HELD
// pass, so the skull — the player's light, weapon and key-fetcher — was
// invisible in the player's own hands. 0.6.2 renders the authored world
// from the first started frame at generation 0 (full wake); the silhouette
// machinery governs restored contexts only.
//
// Instrumentation is deliberately paranoid, because the first two versions
// of this very test produced false greens:
//   - pixels come from a passive rAF observer registered after the game's
//     own loop — the harness NEVER calls g.render();
//   - stalls come from PerformanceObserver('longtask') — rAF timestamps are
//     stamped before callbacks run and hide in-frame freezes;
//   - deadlines are enforced on node-side wall clock, not in-page numbers.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const WORLD_DEADLINE_S = 25;      // Wake → authored world, cold 980M under load
const BOOT_STALL_LIMIT_MS = 16000; // one-time driver compile at Wake, worst cold case
const STEADY_STALL_LIMIT_MS = 2500; // after restore, machinery may not seize the thread
const SILHOUETTE_LUMA = 8;        // reduced+grain composite measures ~25
const WORLD_LUMA = 60;            // authored bedroom peaks ~230

const installObserver = (page) => page.evaluate(({ SILHOUETTE_LUMA, WORLD_LUMA }) => {
  const fl = window.__fl = {
    clickAt: null, firstNonBlackMs: null, firstWorldMs: null,
    firstHeldMs: null, longestTaskMs: 0, reducedProof: null,
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
  const tick = () => {
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
        if ((r.heldDrawCalls || 0) > 0 && fl.firstHeldMs == null) fl.firstHeldMs = now - fl.clickAt;
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
  heldS: window.__fl.firstHeldMs != null ? +(window.__fl.firstHeldMs / 1000).toFixed(2) : null,
  stallMs: Math.round(window.__fl.longestTaskMs),
  reducedProof: window.__fl.reducedProof,
}));

const server = await ensureServer();
const browser = await launchBrowser();
const report = { limits: { WORLD_DEADLINE_S, BOOT_STALL_LIMIT_MS, STEADY_STALL_LIMIT_MS }, scenarios: [] };
const failures = [];
const record = (name, pass, detail, message) => {
  report.scenarios.push({ name, pass, ...detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${message}`);
  if (!pass) failures.push(name);
};

// --- Scenarios 1-3: Wake timing vs the warmup itinerary --------------------
// Full wake must show the AUTHORED world (skull included) regardless of when
// the click lands relative to the background compile itinerary.
const wakeScenarios = [
  { name: 'immediate-wake', before: async () => {} },
  { name: 'mid-itinerary-wake', before: (page) => page.waitForTimeout(9000) },
  {
    name: 'late-wake-after-itinerary',
    before: (page) => page.waitForFunction(
      () => (window.__game?.shaderWarmup?.readyVariants || []).includes('house-world'),
      null, { timeout: 150000 },
    ).then(() => page.waitForTimeout(3000)),
  },
];

const runWake = async (name, before, playDuringBoot) => {
  const { page, errors } = await openPage(browser, `${URL_BASE}/`, { quiet: true });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  await installObserver(page);
  await before(page);
  const wallStart = Date.now();
  await clickWake(page);
  if (playDuringBoot) {
    await page.keyboard.down('w');
    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    for (let i = 0; i < 6 && Date.now() - wallStart < WORLD_DEADLINE_S * 1000; i++) {
      await page.mouse.move(box.x + box.width / 2 + i * 17, box.y + box.height / 2);
      await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
      await page.waitForTimeout(900);
    }
    await page.keyboard.up('w');
  }
  let row = await readObserver(page);
  while (Date.now() - wallStart < WORLD_DEADLINE_S * 1000) {
    row = await readObserver(page);
    if (row.worldS != null && row.heldS != null) break;
    await page.waitForTimeout(500);
  }
  const wallS = +((Date.now() - wallStart) / 1000).toFixed(1);
  const pageErrors = errors.filter((line) => !/favicon|404/i.test(line));
  const pass = row.worldS != null && wallS <= WORLD_DEADLINE_S + 1
    && row.heldS != null
    && row.stallMs <= BOOT_STALL_LIMIT_MS
    && pageErrors.length === 0;
  record(name, pass, { ...row, wallS, pageErrors },
    `world ${row.worldS ?? 'NEVER'}s, skull-in-hand ${row.heldS ?? 'NEVER'}s`
    + ` (wall ${wallS}s), longest stall ${row.stallMs}ms`
    + (pageErrors.length ? ', errors: ' + pageErrors.join(' | ') : ''));
  await page.close();
};

for (const s of wakeScenarios) await runWake(s.name, s.before, false);

// --- Scenario 4: play DURING boot -------------------------------------------
// 0.6.1's playtest failure mode: the player walks and throws immediately.
// Input must not delay or destroy first light, and the held skull must draw.
await runWake('play-during-boot', async () => {}, true);

// --- Scenario 5: the reduced compositor where it legitimately runs ---------
// Reach the authored world, then lose and restore the WebGL context.
// Generation 1 has no full-wake bypass: the machinery must hold on VISIBLE
// reduced frames (silhouette + grain composed non-black) while re-warming,
// without seizing the thread.
{
  const { page, errors } = await openPage(browser, `${URL_BASE}/`, { quiet: true });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  await installObserver(page);
  const wallStart = Date.now();
  await clickWake(page);
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
      window.__stallBase = window.__fl.longestTaskMs;
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
      if (r.reducedProof) { proof = r; break; }
      await page.waitForTimeout(300);
    }
    const restoreStall = proof
      ? await page.evaluate(() => Math.round(window.__fl.longestTaskMs - (window.__stallBase || 0)))
      : null;
    const pageErrors = errors.filter((line) => !/favicon|404|CONTEXT_LOST/i.test(line));
    const pass = !!proof && (restoreStall ?? Infinity) <= STEADY_STALL_LIMIT_MS && pageErrors.length === 0;
    record('reduced-compositor-visible', pass, { proof: proof?.reducedProof, restoreStall, pageErrors },
      proof
        ? `reduced frame composed non-black after context restore (luma ${proof.reducedProof.luma}, world calls ${proof.reducedProof.worldDrawCalls}, added stall ${restoreStall}ms)`
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
console.log('ALL PASS — authored world and held skull after Wake in every regime; restored-context silhouette presents');

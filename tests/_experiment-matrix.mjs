// FACTORIAL: variants A (0.6.0 as shipped), C (compositor fix only),
// D (compositor + re-armable capture), E (D + bootFirstLight) across three
// Wake timings. Pure observation: an in-page rAF sampler reads the presented
// canvas after the game's own render each frame — the harness NEVER calls
// g.render(). rAF gap spikes measure event-loop stalls.
import { spawn } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, openPage, ROOT } from './lib/harness.mjs';

const VARIANTS_DIR = process.argv[2];
const MAIN = join(ROOT, 'src', 'main.js');
const OBSERVE_S = { A: 110, C: 110, D: 110, E: 60 };
const WAKES = ['immediate', 'mid', 'late'];
const SILHOUETTE = 8, WORLD = 60;

const results = [];
const browser = await launchBrowser();

const RUN = (process.argv[3] || 'A,C,D,E').split(',');
for (const variant of RUN) {
  copyFileSync(join(VARIANTS_DIR, `${variant}.js`), MAIN);
  const port = 9700 + Math.floor(Math.random() * 250);
  const server = spawn(process.execPath, [join(ROOT, 'serve.mjs'), String(port)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));

  for (const wake of WAKES) {
    const { page } = await openPage(browser, `http://localhost:${port}/`, { quiet: true });
    await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
    // Install the passive observer AFTER the game's loop so our callback runs
    // after its render inside each frame task and sees the presented pixels.
    await page.evaluate(({ SILHOUETTE, WORLD }) => {
      const fl = window.__fl = {
        clickAt: null, firstNonBlack: null, firstWorld: null,
        maxGapAfterClick: 0, reducedProof: null, last: 0, frames: 0,
      };
      const probe = document.createElement('canvas');
      probe.width = 96; probe.height = 54;
      const ctx = probe.getContext('2d', { willReadFrequently: true });
      const tick = (t) => {
        if (fl.last && fl.clickAt != null) {
          const gap = t - fl.last;
          if (gap > fl.maxGapAfterClick) fl.maxGapAfterClick = gap;
        }
        fl.last = t; fl.frames++;
        const g = window.__game;
        if (g?.renderer?.domElement && g.started && fl.clickAt != null) {
          try {
            ctx.drawImage(g.renderer.domElement, 0, 0, 96, 54);
            const d = ctx.getImageData(0, 0, 96, 54).data;
            let max = 0;
            for (let i = 0; i < d.length; i += 4) {
              const l = d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722;
              if (l > max) max = l;
            }
            const r = g.lastRender || {};
            if (max >= SILHOUETTE && fl.firstNonBlack == null) fl.firstNonBlack = t - fl.clickAt;
            if (max >= WORLD && fl.firstWorld == null) fl.firstWorld = t - fl.clickAt;
            if (!fl.reducedProof && r.reducedDetail === true && (r.worldDrawCalls || 0) > 0
                && r.grainSubmitted === true && max >= SILHOUETTE) {
              fl.reducedProof = { luma: +max.toFixed(1), calls: r.worldDrawCalls, atMs: Math.round(t - fl.clickAt) };
            }
          } catch { /* mid-boot */ }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { SILHOUETTE, WORLD });

    if (wake === 'mid') await page.waitForTimeout(9000);
    if (wake === 'late') {
      await page.waitForFunction(
        () => (window.__game?.shaderWarmup?.readyVariants || []).includes('house-world')
          || (window.__game?.shaderWarmup?.status || '') === 'skipped',
        null, { timeout: 150000 },
      ).catch(() => {});
      await page.waitForTimeout(3000);
    }
    await page.evaluate(() => {
      window.__fl.clickAt = performance.now();
      window.__fl.last = window.__fl.clickAt; // stall clock starts AT the click
      document.querySelector('[data-action="start"]')?.click();
    });

    const deadline = Date.now() + OBSERVE_S[variant] * 1000;
    let row = null;
    while (Date.now() < deadline) {
      row = await page.evaluate(() => ({
        nonBlackS: window.__fl.firstNonBlack != null ? +(window.__fl.firstNonBlack / 1000).toFixed(2) : null,
        worldS: window.__fl.firstWorld != null ? +(window.__fl.firstWorld / 1000).toFixed(2) : null,
        stallMs: Math.round(window.__fl.maxGapAfterClick),
        reducedProof: window.__fl.reducedProof,
        frames: window.__fl.frames,
      }));
      if (row.worldS != null) break;
      await page.waitForTimeout(1000);
    }
    results.push({ variant, wake, ...row });
    console.log(JSON.stringify({ variant, wake, ...row }));
    await page.close();
  }
  server.kill();
}
await browser.close();

console.log('\n=== MATRIX (fallbackS / worldS / stallMs / reducedVisible) ===');
for (const v of RUN) {
  const cells = WAKES.map((w) => {
    const r = results.find((x) => x.variant === v && x.wake === w) || {};
    return `${w}: ${r.nonBlackS ?? 'NEVER'} / ${r.worldS ?? 'NEVER'} / ${r.stallMs ?? '-'}ms / ${r.reducedProof ? 'yes' : 'no'}`;
  });
  console.log(`${v}  ${cells.join('   ')}`);
}

// Why is 0.6.0 black? Watch the residency/warmup gates that gate world submission.
import { spawn } from 'node:child_process';
import { launchBrowser, openPage } from './lib/harness.mjs';

const root = process.argv[2];
const port = 9880;
const proc = spawn(process.execPath, ['C:/Users/Alex/Projects/qualiacology/build/scripts/static-server.mjs', `--root=${root}`, `--port=${port}`], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const browser = await launchBrowser();
const { page } = await openPage(browser, `http://localhost:${port}/fetch/`, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('[data-action="start"]')?.click());
await page.waitForTimeout(1500);

// Wrap render to capture the gate decisions it makes.
await page.evaluate(() => {
  const g = window.__game;
  window.__gate = [];
  const origPrep = g._prepareCurrentGpuResidency.bind(g);
  g._prepareCurrentGpuResidency = function (...a) {
    const p = origPrep(...a);
    try {
      window.__gate.push({
        full: p.full, key: p.key,
        justCertified: !!p.justCertified, justReduced: !!p.justReduced,
        snapshotProgress: !!p.snapshotProgress, finalizationProgress: !!p.finalizationProgress,
        ownerProgress: !!p.ownerProgress, deferredProgress: !!p.deferredProgress,
        ownerExactProgress: !!p.ownerExactProgress, deferredExactProgress: !!p.deferredExactProgress,
        shielded: g._shaderDistrictRenderShielded?.(),
        warm: g.shaderWarmup?.status,
      });
    } catch (e) { window.__gate.push({ err: String(e) }); }
    return p;
  };
});

for (let i = 0; i < 60; i++) { await page.evaluate(() => window.__game?.render?.()); await page.waitForTimeout(30); }

const out = await page.evaluate(() => {
  const g = window.__game, gate = window.__gate || [];
  const count = (k) => gate.filter(x => x[k]).length;
  return {
    frames: gate.length,
    first: gate[0], last: gate[gate.length - 1],
    everFull: count('full'), everShielded: count('shielded'),
    warmupStatus: g.shaderWarmup?.status,
    warmupKeys: g.shaderWarmup ? Object.keys(g.shaderWarmup).slice(0, 25) : null,
    warmupPending: g.shaderWarmup?.pending?.size ?? g.shaderWarmup?.queue?.length ?? null,
    lastRender: g.lastRender,
    tally: {
      justCertified: count('justCertified'), justReduced: count('justReduced'),
      snapshotProgress: count('snapshotProgress'), finalizationProgress: count('finalizationProgress'),
      ownerProgress: count('ownerProgress'), deferredProgress: count('deferredProgress'),
      ownerExactProgress: count('ownerExactProgress'), deferredExactProgress: count('deferredExactProgress'),
    },
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); proc.kill();

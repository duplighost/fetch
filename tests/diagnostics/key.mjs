// Is the warmup's current-view-exact gate ever true? Compare progressive.key
// vs activeKey at warmup time, and dump the warmup scheduling counters.
import { spawn } from 'node:child_process';
import { launchBrowser, openPage } from './lib/harness.mjs';

const root = process.argv[2];
const port = 9895;
const proc = spawn(process.execPath, ['C:/Users/Alex/Projects/qualiacology/build/scripts/static-server.mjs', `--root=${root}`, `--port=${port}`], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await launchBrowser();
const { page } = await openPage(browser, `http://localhost:${port}/fetch/`, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('[data-action="start"]')?.click());

for (let i = 0; i < 8; i++) {
  const s = await page.evaluate(() => {
    const g = window.__game, r = g.currentGpuResidency || {}, w = g.shaderWarmup || {};
    return {
      t: Math.round(performance.now()),
      progressiveKey: r.progressive?.key ?? null,
      activeKey: r.activeKey ?? null,
      keysEqual: (r.progressive?.key ?? null) === (r.activeKey ?? null),
      reducedSet: r.reduced ? [...r.reduced] : null,
      exactStatus: w.currentExactStatus ?? null,
      exactKey: w.currentExactKey ?? null,
      ready: w.readyVariants || [],
      status: w.status, reason: w.reason ?? null,
      itineraryRestarts: w.restarts ?? w.itineraryRestarts ?? null,
    };
  });
  console.log(JSON.stringify(s));
  await page.waitForTimeout(2500);
}
await browser.close(); proc.kill();

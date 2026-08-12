// Does 0.6.0 EVER certify and show a picture? 3-minute probe, 10s samples.
import { spawn } from 'node:child_process';
import { launchBrowser, openPage } from './lib/harness.mjs';

const root = process.argv[2];
const port = 9898;
const proc = spawn(process.execPath, ['C:/Users/Alex/Projects/qualiacology/build/scripts/static-server.mjs', `--root=${root}`, `--port=${port}`], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await launchBrowser();
const { page } = await openPage(browser, `http://localhost:${port}/fetch/`, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('[data-action="start"]')?.click());

for (let i = 0; i < 18; i++) {
  const s = await page.evaluate(() => {
    const g = window.__game, w = g.shaderWarmup || {}, r = g.currentGpuResidency || {};
    let luma = -1;
    try {
      g.render();
      const c = g.renderer.domElement, o = document.createElement('canvas');
      o.width = 96; o.height = 54;
      const cx = o.getContext('2d'); cx.drawImage(c, 0, 0, 96, 54);
      const d = cx.getImageData(0, 0, 96, 54).data;
      let mx = 0; for (let k = 0; k < d.length; k += 4) { const l = d[k] * .2126 + d[k+1] * .7152 + d[k+2] * .0722; if (l > mx) mx = l; }
      luma = +mx.toFixed(1);
    } catch {}
    return {
      t: Math.round(performance.now() / 1000),
      status: w.status, exact: w.currentExactStatus,
      ready: (w.readyVariants || []).join(','),
      variants: (w.variants || []).length,
      compileSlices: Array.isArray(w.compileSlices) ? w.compileSlices.length : w.compileSlices,
      jobsInFlight: w.compileJobsInFlight, slotWaits: w.compileSlotWaits,
      fullFrames: r.fullFrames, reducedFrames: r.reducedFrames,
      maxLuma: luma,
    };
  });
  console.log(JSON.stringify(s));
  if (s.fullFrames > 0 && s.maxLuma > 10) { console.log('>>> CERTIFIED at ~' + s.t + 's'); break; }
  await page.waitForTimeout(10000);
}
await browser.close(); proc.kill();

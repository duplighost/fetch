// Theory test: warmup runs on the TITLE screen. If you idle there before
// clicking Wake, the post-click black window shrinks from ~90s to the
// current-view-exact tail only. Measures both phases.
import { spawn } from 'node:child_process';
import { launchBrowser, openPage } from './lib/harness.mjs';

const root = process.argv[2];
const port = 9899;
const proc = spawn(process.execPath, ['C:/Users/Alex/Projects/qualiacology/build/scripts/static-server.mjs', `--root=${root}`, `--port=${port}`], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `http://localhost:${port}/fetch/`, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });

// PHASE 1: idle on the title. Watch warmup progress WITHOUT clicking.
const t0 = Date.now();
let titleReady = null;
for (let i = 0; i < 40; i++) {
  const w = await page.evaluate(() => ({
    status: window.__game.shaderWarmup?.status,
    ready: (window.__game.shaderWarmup?.readyVariants || []).join(','),
  }));
  const elapsed = Math.round((Date.now() - t0) / 1000);
  if (i % 4 === 0 || /house-world/.test(w.ready)) console.log(`title+${elapsed}s status=${w.status} ready=[${w.ready}]`);
  if (/house-world/.test(w.ready)) { titleReady = elapsed; break; }
  await page.waitForTimeout(3000);
}
console.log(titleReady != null
  ? `>>> title-idle bulk warmup done at +${titleReady}s — clicking Wake now`
  : '>>> bulk never completed on title within 120s — clicking anyway');

await page.evaluate(() => { window.__rejections = []; addEventListener('unhandledrejection', (e) => window.__rejections.push(String(e.reason && e.reason.stack || e.reason))); });
const preClick = await page.evaluate(() => ({ status: window.__game.shaderWarmup?.status, reason: window.__game.shaderWarmup?.reason, exact: window.__game.shaderWarmup?.currentExactStatus, variants: (window.__game.shaderWarmup?.variants||[]).length }));
console.log('pre-click warmup: ' + JSON.stringify(preClick));
console.log('page errors so far: ' + JSON.stringify(errors));
// PHASE 2: click Wake and measure time to first visible pixels.
const tClick = Date.now();
await page.evaluate(() => document.querySelector('[data-action="start"]')?.click());
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => {
    const g = window.__game;
    let mx = 0;
    try {
      g.render();
      const c = g.renderer.domElement, o = document.createElement('canvas');
      o.width = 96; o.height = 54;
      const cx = o.getContext('2d'); cx.drawImage(c, 0, 0, 96, 54);
      const d = cx.getImageData(0, 0, 96, 54).data;
      for (let k = 0; k < d.length; k += 4) { const l = d[k] * .2126 + d[k+1] * .7152 + d[k+2] * .0722; if (l > mx) mx = l; }
    } catch {}
    return { mx: +mx.toFixed(1), full: g.currentGpuResidency?.fullFrames || 0, exact: g.shaderWarmup?.currentExactStatus };
  });
  const dt = ((Date.now() - tClick) / 1000).toFixed(1);
  if (i % 3 === 0 || s.mx > 10) console.log(`click+${dt}s maxLuma=${s.mx} fullFrames=${s.full} exact=${s.exact}`);
  if (s.mx > 10) { console.log(`>>> PICTURE at +${dt}s after click`); break; }
  await page.waitForTimeout(1000);
}
const post = await page.evaluate(() => ({ status: window.__game.shaderWarmup?.status, reason: window.__game.shaderWarmup?.reason, rejections: window.__rejections||[] }));
console.log('post: ' + JSON.stringify(post));
console.log('page errors: ' + JSON.stringify(errors));
await browser.close(); proc.kill();

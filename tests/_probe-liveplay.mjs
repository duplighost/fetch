// Evidence probe: does ACTIVE PLAY during warmup starve certification on the
// deployed build? Wake immediately, then hold W and throw repeatedly for two
// minutes. Records luma, warmup status, invalidation churn, and whether the
// held pass (the skull in your hands) ever draws.
import { launchBrowser, openPage } from './lib/harness.mjs';

const url = process.argv[2] || 'https://qualiacology.com/fetch/';
const browser = await launchBrowser();
const { page } = await openPage(browser, url, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 90000 });

await page.evaluate(() => {
  window.__probe = { invalidations: [], statuses: [] };
  const g = window.__game;
  const orig = g._invalidateShaderWarmup?.bind(g);
  if (orig) {
    g._invalidateShaderWarmup = (reason, opts) => {
      window.__probe.invalidations.push({ t: Math.round(performance.now()), reason: String(reason) });
      return orig(reason, opts);
    };
  }
  const probe = document.createElement('canvas'); probe.width = 96; probe.height = 54;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  window.__sample = () => {
    let max = 0;
    try {
      ctx.drawImage(g.renderer.domElement, 0, 0, 96, 54);
      const d = ctx.getImageData(0, 0, 96, 54).data;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722;
        if (l > max) max = l;
      }
    } catch {}
    const r = g.lastRender || {};
    const w = g.shaderWarmup || {};
    return {
      t: Math.round(performance.now() / 1000),
      luma: +max.toFixed(1),
      reduced: r.reducedDetail, heldCalls: r.heldDrawCalls || 0,
      exact: w.currentExactStatus, ready: (w.readyVariants || []).length,
      invalidations: window.__probe.invalidations.length,
      lastInvalidation: window.__probe.invalidations.slice(-1)[0]?.reason || null,
    };
  };
});

await page.evaluate(() => document.querySelector('[data-action="start"]')?.click());
const canvas = await page.$('canvas');
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

// Two minutes of real-ish play: walk, look, throw/recall on a cycle.
await page.keyboard.down('w');
const start = Date.now();
let lastLog = 0;
while (Date.now() - start < 120000) {
  await page.mouse.move(cx + (Math.random() - 0.5) * 200, cy + (Math.random() - 0.5) * 100);
  await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up(); // throw
  await page.waitForTimeout(1500);
  await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up(); // hold + recall
  if (Date.now() - lastLog > 10000) {
    lastLog = Date.now();
    console.log(JSON.stringify(await page.evaluate(() => window.__sample())));
  }
  await page.waitForTimeout(800);
}
await page.keyboard.up('w');
const final = await page.evaluate(() => ({
  ...window.__sample(),
  allInvalidations: window.__probe.invalidations.slice(-15),
}));
console.log('FINAL: ' + JSON.stringify(final, null, 1));
await browser.close();

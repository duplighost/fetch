// Valid input-play pixel probe. The first liveplay probe read the canvas
// OUTSIDE the frame task — with preserveDrawingBuffer:false that is black by
// construction, on any build. This one samples inside a rAF callback
// registered after the game's own loop (same-task readback, like the
// first-light gate), while driving keyboard+mouse play.
import { launchBrowser, openPage } from './lib/harness.mjs';

const url = process.argv[2];
const playSeconds = Number(process.argv[3] || 90);
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, url, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 90000 });

await page.evaluate(() => {
  const fl = window.__fl = { clickAt: null, samples: [], firstVisibleMs: null, firstWorldMs: null };
  const probe = document.createElement('canvas'); probe.width = 96; probe.height = 54;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  const tick = () => {
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
        const now = performance.now();
        if (max >= 8 && fl.firstVisibleMs == null) fl.firstVisibleMs = now - fl.clickAt;
        if (max >= 60 && fl.firstWorldMs == null) fl.firstWorldMs = now - fl.clickAt;
        const r = g.lastRender || {};
        fl.samples.push({ t: Math.round((now - fl.clickAt) / 1000), luma: +max.toFixed(1), held: r.heldDrawCalls ?? null });
        if (fl.samples.length > 4000) fl.samples.shift();
      } catch {}
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await page.evaluate(() => {
  window.__fl.clickAt = performance.now();
  document.querySelector('[data-action="start"]')?.click();
});
const canvas = await page.$('canvas');
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

await page.keyboard.down('w');
const start = Date.now();
while (Date.now() - start < playSeconds * 1000) {
  await page.mouse.move(cx + (Math.random() - 0.5) * 200, cy + (Math.random() - 0.5) * 100);
  await page.mouse.down(); await page.waitForTimeout(220); await page.mouse.up();
  await page.waitForTimeout(1400);
}
await page.keyboard.up('w');

const out = await page.evaluate(() => {
  const s = window.__fl.samples;
  const bySecond = new Map();
  for (const x of s) if (!bySecond.has(x.t) || x.luma > bySecond.get(x.t).luma) bySecond.set(x.t, x);
  const seconds = [...bySecond.values()];
  const visiblePct = +(100 * seconds.filter((x) => x.luma >= 8).length / Math.max(1, seconds.length)).toFixed(1);
  return {
    firstVisibleS: window.__fl.firstVisibleMs != null ? +(window.__fl.firstVisibleMs / 1000).toFixed(2) : null,
    firstWorldS: window.__fl.firstWorldMs != null ? +(window.__fl.firstWorldMs / 1000).toFixed(2) : null,
    visibleSecondsPct: visiblePct,
    lumaTimeline: seconds.filter((_, i) => i % 10 === 0).map((x) => `${x.t}s:${x.luma}`).join(' '),
    heldEver: seconds.some((x) => (x.held || 0) > 0),
  };
});
const pageErrors = errors.filter((line) => !/favicon|404/i.test(line));
console.log(JSON.stringify({ url, ...out, pageErrors }, null, 1));
const ok = out.firstWorldS != null && out.firstWorldS <= 20 && out.visibleSecondsPct >= 90 && pageErrors.length === 0;
console.log(ok ? 'PLAY VERIFY PASS' : 'PLAY VERIFY FAIL');
await browser.close();
process.exit(ok ? 0 : 1);

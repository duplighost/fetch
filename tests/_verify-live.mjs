// Pixel verification against a DEPLOYED url: click Wake like a player,
// passive observer, wall-clock deadlines. Usage: node tests/_verify-live.mjs <url>
import { launchBrowser, openPage } from './lib/harness.mjs';

const url = process.argv[2];
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, url, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 90000 });
await page.evaluate(() => {
  const fl = window.__fl = { clickAt: null, firstNonBlackMs: null, firstWorldMs: null, longestTaskMs: 0 };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (fl.clickAt != null && entry.startTime + entry.duration > fl.clickAt
          && entry.duration > fl.longestTaskMs) fl.longestTaskMs = entry.duration;
    }
  }).observe({ entryTypes: ['longtask'] });
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
        if (max >= 8 && fl.firstNonBlackMs == null) fl.firstNonBlackMs = now - fl.clickAt;
        if (max >= 60 && fl.firstWorldMs == null) fl.firstWorldMs = now - fl.clickAt;
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
const wallStart = Date.now();
let row = null;
while (Date.now() - wallStart < 130000) {
  row = await page.evaluate(() => ({
    fallbackS: window.__fl.firstNonBlackMs != null ? +(window.__fl.firstNonBlackMs / 1000).toFixed(2) : null,
    worldS: window.__fl.firstWorldMs != null ? +(window.__fl.firstWorldMs / 1000).toFixed(2) : null,
    stallMs: Math.round(window.__fl.longestTaskMs),
  }));
  if (row.worldS != null) break;
  await new Promise(r => setTimeout(r, 1000));
}
const pageErrors = errors.filter((line) => !/favicon|404/i.test(line));
console.log(JSON.stringify({ url, ...row, wallS: +((Date.now() - wallStart) / 1000).toFixed(1), pageErrors }));
const ok = row?.fallbackS != null && row.fallbackS <= 4 && row?.worldS != null && (row.stallMs || 0) <= 2500 && pageErrors.length === 0;
console.log(ok ? 'LIVE VERIFY PASS' : 'LIVE VERIFY FAIL');
await browser.close();
process.exit(ok ? 0 : 1);

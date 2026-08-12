// probe-forest-spline.mjs -- real geometry for placing a chain of swing anchors.
// The corridor's width, ground height and heading vary along the spline, so
// anchor spacing has to come from measurement, not from picking round numbers.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });
const r = await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  F.start(); F.teleport('forest'); F.stepWith(0.3, {});
  const f = g.forest;
  const rows = [];
  for (let s = 0; s <= f.length - 1; s += 5) {
    const p = f.posAt(s, 0);
    const i = Math.max(0, Math.min(f.length - 1, Math.round(s)));
    rows.push({ s, x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +f.heightAt(p.x, p.z).toFixed(2), halfW: +f.halfW[i].toFixed(2) });
  }
  return {
    length: f.length,
    pockets: (f.secretPockets || []).map(p => ({ id: p.id, centerS: p.centerS, fromS: p.fromS, landingS: p.landingS, side: p.side, landingLat: p.landingLat })),
    ravineS: f.ravineS ?? null,
    arenaS: f.arenaS ?? null,
    rows,
  };
});
await browser.close(); server.stop();
console.log('spline length:', r.length, ' ravineS:', r.ravineS, ' arenaS:', r.arenaS);
console.log('existing rope pockets:', JSON.stringify(r.pockets, null, 1));
console.log('\n   s      x       z      y   halfW');
for (const q of r.rows) console.log(`${String(q.s).padStart(4)} ${String(q.x).padStart(8)} ${String(q.z).padStart(8)} ${String(q.y).padStart(7)} ${String(q.halfW).padStart(6)}`);

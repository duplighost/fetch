// shot-texture.mjs -- write a boot-painted texture out as a PNG, so a painter
// can be judged as a painting instead of guessed at through a lit render.
//
// Round eight's first skin pass came back invisible on the hands and there was
// no way to tell whether the painter was too subtle, the bump too small or the
// lamp too dim. Two of those are answered by looking at the sheet.
//
//   node tools/shot-texture.mjs handSkin [out.png]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [which = 'handSkin', outFile = `scratch-hands/tex-${which}.png`] = process.argv.slice(2);
mkdirSync(dirname(outFile), { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });

  const out = await page.evaluate((which) => {
    const g = window.__game;
    const pick = () => {
      if (which === 'handSkin') return g.skull._handSkin?.skin?.map;
      return (g.mats || {})[which]?.map;
    };
    const tex = pick();
    if (!tex || !tex.image) return { error: 'no texture for ' + which };
    const img = tex.image;
    // scale up so the grain is legible next to a hand at hold scale
    const c = document.createElement('canvas');
    c.width = img.width * 3; c.height = img.height * 3;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    // and the histogram, because "is it too subtle" is a number
    const src = document.createElement('canvas');
    src.width = img.width; src.height = img.height;
    const sg = src.getContext('2d');
    sg.drawImage(img, 0, 0);
    const d = sg.getImageData(0, 0, img.width, img.height).data;
    let sum = 0, min = 255, max = 0;
    const vals = [];
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
      sum += v; vals.push(v);
      if (v < min) min = v; if (v > max) max = v;
    }
    vals.sort((a, b) => a - b);
    const pct = (p) => vals[Math.floor((vals.length - 1) * p)];
    return {
      png: c.toDataURL('image/png'),
      size: img.width + 'x' + img.height,
      mean: +(sum / vals.length / 255).toFixed(3),
      min: +(min / 255).toFixed(3), max: +(max / 255).toFixed(3),
      p05: +(pct(0.05) / 255).toFixed(3), p50: +(pct(0.5) / 255).toFixed(3), p95: +(pct(0.95) / 255).toFixed(3),
    };
  }, which);

  if (out.error) { console.log(out.error); process.exit(1); }
  writeFileSync(outFile, Buffer.from(out.png.split(',')[1], 'base64'));
  console.log('wrote', outFile, out.size);
  console.log(`mean ${out.mean}   min ${out.min}  p05 ${out.p05}  p50 ${out.p50}  p95 ${out.p95}  max ${out.max}`);
  console.log(`contrast p05..p95 = ${(out.p95 / Math.max(0.001, out.p05)).toFixed(2)}x`);
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

// compare.mjs -- two shots of the same pose, side by side, labelled. The whole
// judging method in this project is "open the PNGs", and a before next to an
// after in one image is the only honest way to show whether a change moved.
//
//   node tools/compare.mjs out.png "BEFORE" a.png "AFTER" b.png [x y w h scale]
import { launchBrowser } from '../tests/lib/harness.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [outFile, ...rest] = process.argv.slice(2);
const pairs = [];
let i = 0;
while (i + 1 < rest.length && rest[i + 1].endsWith('.png')) { pairs.push([rest[i], rest[i + 1]]); i += 2; }
const [x = 0, y = 0, w = 0, h = 0, scale = 1] = rest.slice(i).map(Number);
if (!outFile || pairs.length < 2) { console.error('usage: compare.mjs out.png LABEL a.png LABEL b.png [x y w h scale]'); process.exit(1); }
mkdirSync(dirname(outFile), { recursive: true });

const imgs = pairs.map(([label, file]) => ({ label, b64: readFileSync(file).toString('base64') }));
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  const out = await page.evaluate(async ({ imgs, x, y, w, h, scale }) => {
    const loaded = [];
    for (const it of imgs) {
      const im = new Image();
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = 'data:image/png;base64,' + it.b64; });
      loaded.push({ im, label: it.label });
    }
    const sw = w || loaded[0].im.width, sh = h || loaded[0].im.height;
    const tw = Math.round(sw * (scale || 1)), th = Math.round(sh * (scale || 1));
    const BAR = 34, GAP = 8;
    const c = document.createElement('canvas');
    c.width = tw * loaded.length + GAP * (loaded.length - 1);
    c.height = th + BAR;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0b0d';
    g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = 'high';
    loaded.forEach((it, k) => {
      const ox = k * (tw + GAP);
      g.drawImage(it.im, x, y, sw, sh, ox, BAR, tw, th);
      g.fillStyle = '#e8e4dc';
      g.font = '600 20px system-ui, sans-serif';
      g.textBaseline = 'middle';
      g.fillText(it.label, ox + 10, BAR / 2 + 1);
    });
    return c.toDataURL('image/png');
  }, { imgs, x, y, w, h, scale });
  writeFileSync(outFile, Buffer.from(out.split(',')[1], 'base64'));
  console.log('wrote', outFile);
} finally {
  await browser.close().catch(() => {});
}

// crop.mjs -- cut a region out of a shot and scale it up, so the hands can be
// JUDGED. Round seven's whole method is "open the PNGs"; at 1280x800 the
// cradle is 300 px wide and the joints that decide whether it reads as a hand
// are four pixels each. There is no image library in this tree (zero deps by
// law), so the decode happens in the same browser every other tool boots.
//
//   node tools/crop.mjs in.png out.png x y w h [scale]
//   node tools/crop.mjs in.png out.png hands            (the cradle preset)
import { launchBrowser } from '../tests/lib/harness.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const [inFile, outFile, ...rest] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('usage: crop.mjs in.png out.png x y w h [scale] | in.png out.png hands'); process.exit(1); }
// the cradle lives in the bottom middle of a 1280x800 frame
const PRESETS = { hands: [330, 430, 620, 370, 3], wide: [230, 330, 820, 470, 2.4] };
let [x, y, w, h, scale] = PRESETS[rest[0]] || rest.map(Number);
scale = scale || 3;

const b64 = readFileSync(inFile).toString('base64');
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  const out = await page.evaluate(async ({ b64, x, y, w, h, scale }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, { b64, x, y, w, h, scale });
  writeFileSync(outFile, Buffer.from(out.split(',')[1], 'base64'));
  console.log('wrote', outFile, `${Math.round(w * scale)}x${Math.round(h * scale)} from ${x},${y} ${w}x${h}`);
} finally {
  await browser.close().catch(() => {});
}

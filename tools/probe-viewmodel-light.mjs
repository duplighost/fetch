// probe-viewmodel-light.mjs — the hands and the held skull are on screen in
// every frame of the game, and they draw in their own depth pass with their own
// lamps, so nothing about the world reaches them. This measures the three
// regions that matter — cradle, skull, world behind — in every act, with the
// skull held and with the skull thrown, and prints the ratio that actually
// decides whether the hands look lit or look luminous.
//
// The rule this exists to keep: the cradle should sit at roughly 1.5-3x the
// brightness of the frame behind it. At 5x it reads as two glowing gloves.
//   node tools/probe-viewmodel-light.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-viewmodel');
mkdirSync(out, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const result = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    const frames = {};
    const rows = [];

    const c = g.renderer.domElement;
    const rd = document.createElement('canvas');
    rd.width = c.width; rd.height = c.height;
    const ctx = rd.getContext('2d');
    const region = (x0, y0, x1, y1) => {
      const W = rd.width, H = rd.height;
      const px = ctx.getImageData(Math.floor(x0 * W), Math.floor(y0 * H),
        Math.max(1, Math.floor((x1 - x0) * W)), Math.max(1, Math.floor((y1 - y0) * H))).data;
      let sum = 0, peak = 0, n = 0, clipped = 0;
      for (let i = 0; i < px.length; i += 4) {
        const l = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
        sum += l; if (l > peak) peak = l; if (l > 0.94) clipped++; n++;
      }
      return { mean: +(sum / n).toFixed(3), peak: +peak.toFixed(3), clip: +(clipped / n).toFixed(3) };
    };
    const measure = (scene, held) => {
      for (let i = 0; i < 4; i++) { g._lastShakeDt = 1 / 60; g.render(); }
      ctx.drawImage(c, 0, 0);
      const hands = region(0.44, 0.80, 0.78, 0.99);
      const skull = region(0.50, 0.55, 0.68, 0.78);
      const world = region(0.02, 0.20, 0.30, 0.55);
      frames[`${scene}-${held ? 'held' : 'away'}`] = c.toDataURL('image/png');
      rows.push({
        scene, held, hands, skull, world,
        ratio: +(hands.mean / Math.max(0.004, world.mean)).toFixed(2),
        vmLit: +(g._vmKey ? g._vmKey.lit : -1).toFixed(3),
      });
    };

    F.start();
    for (const scene of ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing']) {
      F.teleport(scene);
      F.stepWith(3.2, {}, false);      // let ambient AND the viewmodel key settle
      measure(scene, true);
      // throw it away and let the cradle answer
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      F.stepWith(1.1, { throwHeld: true }, false);
      measure(scene, false);
      F.stepWith(1 / 120, { throwReleased: true }, false);
      F.stepWith(3.0, {}, false);
    }
    return { frames, rows };
  });

  for (const [name, data] of Object.entries(result.frames)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('act        skull  vmLit  hands(mean/peak/clip)   skullpx(mean/peak/clip)  world   hands:world');
  for (const r of result.rows) {
    console.log(
      r.scene.padEnd(11),
      (r.held ? 'held' : 'away').padEnd(6),
      String(r.vmLit).padEnd(6),
      `${r.hands.mean}/${r.hands.peak}/${r.hands.clip}`.padEnd(24),
      `${r.skull.mean}/${r.skull.peak}/${r.skull.clip}`.padEnd(25),
      String(r.world.mean).padEnd(7),
      r.ratio);
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify(result.rows, null, 2));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

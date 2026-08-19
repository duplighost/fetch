// shot-graveyard-frames.mjs -- PHASE TWO's work queue, and the only honest way
// to build one.
//
// The tactic, from ROUND-SIX.md: you are not improving a car, you are improving
// the FRAMES a player stands in. Objects get improved as a side effect, and you
// stop when the frame reads, not when the object is finished — an object is
// never finished, a frame is.
//
// So: fourteen poses covering the graveyard the way a player moves through it,
// shot BEFORE any art change, ranked worst-first by one question — what is
// wrong with this picture at a glance? That ranked list is the work queue and
// the stopping condition. Do not add to it mid-pass.
//
// Every frame also reports its near band (mean/max/clipped) and its draw count,
// because "it reads" is not a number and the graveyard has no draw headroom at
// all looking south (~1130 against a 450 ceiling).
//
//   node tools/shot-graveyard-frames.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir = 'scratch-graveyard/before'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

// [name, fromX, fromZ, toX, toTargetY, toZ]  -- the walk, in order
const POSES = [
  ['01-arrival-from-the-house', 0, 7.5, 0, 1.4, 20],
  ['02-arrival-wide-east', 1, 9.5, 12, 1.6, 26],
  ['03-the-car-approaching', -5.2, 9.5, -9, 1.0, 14],
  ['04-the-car-beside-it', -12.2, 14.5, -9, 0.9, 14],
  ['05-the-car-from-its-beam', -3.6, 20.5, -9, 1.0, 14.5],
  ['06-the-first-body-ahead', -5.8, 15.4, -5.8, 0.3, 18.3],
  ['07-standing-over-a-body', 0.2, 20.2, 0.2, 0.1, 22.4],
  ['08-mid-yard-looking-SOUTH', 0, 30, 0, 1.4, 5],
  ['09-mid-yard-looking-north', 0, 30, 2, 1.6, 43],
  ['10-east-mausoleum-approach', 9.5, 25.5, 15.6, 1.8, 31.5],
  ['11-east-mausoleum-close', 15.6, 26.8, 15.6, 1.5, 31.5],
  ['12-west-mausoleum', -9.5, 29.5, -14.6, 1.8, 34.2],
  ['13-the-gate-approach', 2, 36.5, 2, 2.2, 43],
  ['14-among-the-stones-low', 7, 23.5, 10.5, 0.5, 33],
];

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async (poses) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(1.2, {}, false);
    g.skull.holdNow();
    F.stepWith(0.6, {}, false);
    const measure = () => {
      const canvas = g.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 100;
      const ctx = cv.getContext('2d');
      ctx.drawImage(canvas, 0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0, max = 0, clipped = 0, dark = 0, n = 0;
      for (let y = Math.floor(cv.height * 0.55); y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
          sum += v; n++;
          if (v > max) max = v;
          if (v > 232) clipped++;
          if (v < 12) dark++;
        }
      }
      return {
        mean: +(sum / n).toFixed(1), max: Math.round(max),
        clippedPct: +(100 * clipped / n).toFixed(2), darkPct: +(100 * dark / n).toFixed(1),
      };
    };
    const shots = [];
    for (const [name, px, pz, tx, ty, tz] of poses) {
      g.player.pos.set(px, g.world.groundHeightAt(px, pz, 3), pz);
      g.player.vel.set(0, 0, 0);
      const ey = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(ty - ey, Math.hypot(tx - px, tz - pz))));
      g.player._sync(0);
      F.stepWith(0.3, {}, false);
      g.render();
      shots.push({
        name, png: g.renderer.domElement.toDataURL('image/png'),
        band: measure(), draws: g.lastRender.drawCalls,
      });
    }
    return { shots, geometries: g.renderer.info.memory.geometries };
  }, POSES);

  const rows = [];
  for (const s of out.shots) {
    const file = join(outDir, `${s.name}.png`);
    writeFileSync(file, Buffer.from(s.png.split(',')[1], 'base64'));
    rows.push({ name: s.name, ...s.band, draws: s.draws });
    console.log(`${s.name.padEnd(30)} draws ${String(s.draws).padStart(4)}   `
      + `near band mean ${String(s.band.mean).padStart(5)}  max ${String(s.band.max).padStart(3)}  `
      + `clipped ${s.band.clippedPct}%  near-black ${s.band.darkPct}%`);
  }
  console.log(`geometries ${out.geometries}`);
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('graveyard-frames.json'), JSON.stringify(rows, null, 2));
} finally {
  await browser.close();
  server.stop();
}

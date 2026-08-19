// shot-crossing.mjs -- the crossing, from the places you fall off it.
//
// Round six, his note 2: "you can still fall off the sides of the rocks into
// the water when crossing them into the waterfall." The terrain answer (a
// rubble bar raised under the lane by the bargain) is invisible by
// construction — the pool has an opaque murk body — so the only thing that can
// tell the player the water beside the stones is shin-deep is the SURFACE.
// These are the frames that prove it: the approach, a stone top looking down,
// standing in the water itself, and the way back out.
//
// OPEN THE PNGs AND LOOK. Every wrong call in this repo came from reasoning
// about a frame instead of opening it.
//
//   node tools/shot-crossing.mjs           post-bargain (the real state)
//   node tools/shot-crossing.mjs --before  pre-bargain, which must be unchanged
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BEFORE = process.argv.includes('--before');
const outDir = 'scratch-crossing';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async (before) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('clearing');
    F.stepWith(1.0, {}, false);
    if (before) { g.skull.holdNow(); F.stepWith(0.3, {}, false); }
    else {
      g.flag('fallsThawed');
      F.stepWith(0.3, {}, false);
      g.director.waterfallTaken();      // the skull does not come back
      g.skull.vanish();                 // ...so shoot it the way he sees it: dark
      for (let t = 0; t < 14; t += 0.1) F.stepWith(0.1, {}, false);
    }
    const C = g.clearingCenter;
    const shots = [];
    const look = (px, pz, tx, ty, tz) => {
      g.player.pos.set(px, g.world.groundHeightAt(px, pz, 3), pz);
      g.player.vel.set(0, 0, 0);
      const ey = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(ty - ey, Math.hypot(tx - px, tz - pz))));
      g.player._sync(0);
      return +g.player.pos.y.toFixed(2);
    };
    const measure = () => {
      const canvas = g.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 100;
      const ctx = cv.getContext('2d');
      ctx.drawImage(canvas, 0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0, max = 0, clipped = 0, n = 0;
      for (let y = Math.floor(cv.height * 0.55); y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
          sum += v; n++;
          if (v > max) max = v;
          if (v > 232) clipped++;
        }
      }
      return { mean: +(sum / n).toFixed(1), max: Math.round(max), clippedPct: +(100 * clipped / n).toFixed(2) };
    };
    let footY = 0;
    const shoot = async (name) => {
      F.stepWith(0.2, {}, false);
      g.render();
      shots.push({ name, footY, png: g.renderer.domElement.toDataURL('image/png'), band: measure() });
    };

    // 1. The approach, from the bank: does the lane read as a channel?
    footY = look(C.x, C.z + 3.4, C.x, 1.2, C.z + 17);
    await shoot('01-approach-from-the-bank');

    // 2. On a stone, mid-crossing, looking DOWN at the water beside it. This is
    //    the frame his note is about: black depth, or visibly shallow?
    footY = look(C.x + 0.2, C.z + 13.96, C.x + 3.4, -1.2, C.z + 14.6);
    await shoot('02-on-a-stone-looking-down');

    // 3. Standing IN it, where a missed step puts you.
    footY = look(C.x + 1.9, C.z + 14.2, C.x + 4.6, -0.9, C.z + 15.2);
    await shoot('03-standing-in-it');

    // 4. From in the water, looking back the way out.
    footY = look(C.x + 1.9, C.z + 14.2, C.x, 0.4, C.z + 5);
    await shoot('04-the-way-back-out');

    // 5. And forward, at the falls, from the same wet stance.
    footY = look(C.x + 1.9, C.z + 14.2, C.x, 3.0, C.z + 20.4);
    await shoot('05-and-forward-at-the-falls');

    // 6. The far end, where the shelf takes over from the bar.
    footY = look(C.x - 1.6, C.z + 17.6, C.x - 3.6, -0.6, C.z + 18.6);
    await shoot('06-the-far-end');

    const profile = [];
    for (const dx of [0, 1, 2, 3, 4, 4.6, 5, 5.5, 6, 7]) {
      profile.push([dx, +g.world.terrainHeight(C.x + dx, C.z + 14).toFixed(2)]);
    }
    return {
      shots, profile,
      draws: g.lastRender.drawCalls,
      geometries: g.renderer.info.memory.geometries,
      programs: g.renderer.info.programs?.length,
    };
  }, BEFORE);

  for (const s of out.shots) {
    const file = join(outDir, `${BEFORE ? 'before-' : ''}${s.name}.png`);
    writeFileSync(file, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`wrote ${file}   feet y ${s.footY}   near band: mean ${s.band.mean}, max ${s.band.max}, clipped ${s.band.clippedPct}%`);
  }
  console.log('lane depth at dz 14:', out.profile.map(([x, y]) => `${x}m:${y}`).join('  '));
  console.log(`draws ${out.draws}, geometries ${out.geometries}, programs ${out.programs}`);
  if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 5).join('\n  '));
} finally {
  await browser.close();
  server.stop();
}

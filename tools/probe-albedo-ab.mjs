// probe-albedo-ab.mjs -- what does darkening this surface actually BUY?
//
// The standing project lesson is that it buys very little: measured on the
// clearing's shore lip, three materials a full fivefold apart in albedo came
// back only 1.4x apart in pixels, because a lit MeshStandard under a 58-candela
// lantern at two metres is riding the top of the tone curve and albedo has
// stopped being the variable. That lesson is real, and it is also FROM ANOTHER
// SURFACE AT ANOTHER DISTANCE, and this project's own law is to measure rather
// than to inherit a number.
//
// So: stand in the frame, scale the material's colour (a free change — no
// program, no texture, no define), re-render, and report what the frame and
// the object itself did. The colour multiplies the map, so scaling it by k is
// exactly equivalent to re-normalising the painter to k times its mean.
//
//   node tools/probe-albedo-ab.mjs [material] [pose] [k,k,k...]
//   node tools/probe-albedo-ab.mjs carPaint car 1,0.7,0.5,0.35,0.25
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MAT = process.argv[2] ?? 'carPaint';
const POSE_NAME = process.argv[3] ?? 'car';
const KS = (process.argv[4] ?? '1,0.7,0.5,0.35,0.25').split(',').map(Number);
const outDir = 'scratch-ab';
mkdirSync(outDir, { recursive: true });

const POSES = {
  car: [-12.2, 14.5, -9, 0.9, 14],          // 04, standing beside it
  carApproach: [-5.2, 9.5, -9, 1.0, 14],    // 03, first sight of it
  carBeam: [-3.6, 20.5, -9, 1.0, 14.5],     // 05, from inside its beam
  body: [0.2, 20.2, 0.2, 0.1, 22.4],        // 07
  mausoleum: [15.6, 26.8, 15.6, 1.5, 31.5], // 11
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async ({ mat, pose, ks }) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(1.2, {}, false);
    g.skull.holdNow();
    F.stepWith(0.6, {}, false);
    const [px, pz, tx, ty, tz] = pose;
    g.player.pos.set(px, g.world.groundHeightAt(px, pz, 3), pz);
    g.player.vel.set(0, 0, 0);
    const ey = g.player.pos.y + 1.62;
    g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
    g.player.pitch = Math.max(-1.2, Math.min(1.2,
      Math.atan2(ty - ey, Math.hypot(tx - px, tz - pz))));
    g.player._sync(0);
    F.stepWith(0.3, {}, false);

    const W = 320, H = 200;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => {
      g.render();
      ctx.drawImage(g.renderer.domElement, 0, 0, W, H);
      return ctx.getImageData(0, 0, W, H).data;
    };
    const settle = (limit = 40) => {
      let prev = grab();
      for (let i = 0; i < limit; i++) {
        const next = grab();
        let same = true;
        for (let k = 0; k < prev.length; k += 4) {
          if (prev[k] !== next[k] || prev[k + 1] !== next[k + 1] || prev[k + 2] !== next[k + 2]) { same = false; break; }
        }
        if (same) return next;
        prev = next;
      }
      return prev;
    };
    const band = (d) => {
      let sum = 0, max = 0, n = 0, clipped = 0;
      for (let y = Math.floor(H * 0.55); y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
          sum += v; n++;
          if (v > max) max = v;
          if (v > 232) clipped++;
        }
      }
      return { mean: +(sum / n).toFixed(2), max: Math.round(max), clippedPct: +(100 * clipped / n).toFixed(2) };
    };

    const m = g.mats[mat];
    if (!m) return { error: 'no such material', mat };
    const base = m.color.clone();
    // Which pixels belong to this material? Take one frame with it blacked out
    // and treat every pixel that moved as its own. Black, not hidden: the
    // material may be shared, and this keeps the geometry and depth identical.
    settle();
    const before = grab();
    m.color.setRGB(0, 0, 0);
    const blacked = grab();
    m.color.copy(base);
    const mask = [];
    for (let i = 0; i < before.length; i += 4) {
      const b = (before[i] + before[i + 1] + before[i + 2]) / 3;
      const a = (blacked[i] + blacked[i + 1] + blacked[i + 2]) / 3;
      if (Math.abs(b - a) >= 1.5) mask.push(i);
    }
    const onMask = (d) => {
      let sum = 0, max = 0, min = 255;
      for (const i of mask) {
        const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += v;
        if (v > max) max = v;
        if (v < min) min = v;
      }
      return {
        mean: mask.length ? +(sum / mask.length).toFixed(1) : 0,
        max: Math.round(max), min: Math.round(min),
        spread: Math.round(max - min),
      };
    };

    const rows = [];
    const shots = [];
    for (const k of ks) {
      m.color.copy(base).multiplyScalar(k);
      const d = grab();
      rows.push({ k, frame: band(d), surface: onMask(d) });
      shots.push({ k, png: g.renderer.domElement.toDataURL('image/png') });
    }
    m.color.copy(base);
    return { mat, maskPixels: mask.length, maskPct: +(100 * mask.length / (W * H)).toFixed(2), rows, shots };
  }, { mat: MAT, pose: POSES[POSE_NAME] || POSES.car, ks: KS });

  if (out.error) { console.log('ERROR', out); }
  else {
    for (const s of out.shots) {
      writeFileSync(join(outDir, `${MAT}-${POSE_NAME}-k${s.k}.png`),
        Buffer.from(s.png.split(',')[1], 'base64'));
    }
    console.log(`${out.mat} owns ${out.maskPixels} px (${out.maskPct}% of frame) at pose ${POSE_NAME}\n`);
    console.log('  k     frame mean   max  clip%     surface mean   min   max  spread');
    const first = out.rows[0];
    for (const r of out.rows) {
      console.log(`${String(r.k).padStart(5)}  ${String(r.frame.mean).padStart(10)} ${String(r.frame.max).padStart(5)}`
        + `  ${String(r.frame.clippedPct).padStart(5)}     ${String(r.surface.mean).padStart(11)}`
        + ` ${String(r.surface.min).padStart(5)} ${String(r.surface.max).padStart(5)} ${String(r.surface.spread).padStart(7)}`);
    }
    const last = out.rows[out.rows.length - 1];
    const albedoCut = (first.k / last.k).toFixed(1);
    const pixelCut = (first.surface.mean / Math.max(0.01, last.surface.mean)).toFixed(2);
    console.log(`\n${albedoCut}x albedo cut bought ${pixelCut}x on the surface's own pixels.`);
    writeFileSync(resultsPath(`albedo-ab-${MAT}-${POSE_NAME}.json`),
      JSON.stringify({ ...out, shots: undefined }, null, 2));
  }
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
} finally {
  await browser.close();
  server.stop();
}

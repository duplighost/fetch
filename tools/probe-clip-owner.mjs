// probe-clip-owner.mjs -- WHAT is blowing out in this frame?
//
// Frame 12 is the only shot in the graveyard set that clips, and two rounds of
// reasoning have now blamed two different objects for it — the mausoleum, then
// the headstones — and been wrong both times. So stop reasoning: find the
// clipped pixels, then hide every top-level scene object in turn and report
// whichever one makes them go away.
//
//   node tools/probe-clip-owner.mjs [poseName]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const POSE_NAME = process.argv[2] ?? 'west';
const outDir = 'scratch-clip';
mkdirSync(outDir, { recursive: true });

const POSES = {
  west: [-9.5, 29.5, -14.6, 1.8, 34.2],     // 12
  east: [15.6, 26.8, 15.6, 1.5, 31.5],      // 11
  car: [-12.2, 14.5, -9, 0.9, 14],          // 04
  gate: [2, 36.5, 2, 2.2, 43],              // 13
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async (pose) => {
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
    // the same near band and the same threshold the frame tool uses
    const clippedMask = (d) => {
      const idx = [];
      for (let y = Math.floor(H * 0.55); y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 232) idx.push(i);
        }
      }
      return idx;
    };

    const reference = settle();
    const clipped = clippedMask(reference);
    const stillClipped = (d) => clipped.filter((i) => (d[i] + d[i + 1] + d[i + 2]) / 3 > 232).length;

    const label = (o) => o.name || `${o.type}:${o.uuid.slice(0, 8)}`;
    const rows = [];
    for (const child of g.scene.children.slice()) {
      if (!child.visible || child.isLight) continue;
      child.visible = false;
      const shot = grab();
      child.visible = true;
      const left = stillClipped(shot);
      if (left < clipped.length) {
        rows.push({
          name: label(child), type: child.type,
          fixes: clipped.length - left,
          material: child.material?.type,
          color: child.material?.color?.getHexString?.(),
          emissive: child.material?.emissive?.getHexString?.(),
          count: child.count ?? null,
        });
      }
    }
    // the held cradle lives on its own layer and is not a scene child sweep
    const holdWas = g.skull.hold ? g.skull.hold.visible : null;
    let heldFixes = 0;
    if (g.skull.hold) {
      g.skull.hold.visible = false;
      heldFixes = clipped.length - stillClipped(grab());
      g.skull.hold.visible = holdWas;
    }
    return {
      clippedPixels: clipped.length,
      clippedPct: +(100 * clipped.length / (W * H * 0.45)).toFixed(2),
      heldFixes,
      rows: rows.sort((a, b) => b.fixes - a.fixes),
      png: g.renderer.domElement.toDataURL('image/png'),
    };
  }, POSES[POSE_NAME] || POSES.west);

  writeFileSync(join(outDir, `${POSE_NAME}.png`), Buffer.from(out.png.split(',')[1], 'base64'));
  console.log(`pose ${POSE_NAME}: ${out.clippedPixels} clipped pixels in the near band (${out.clippedPct}%)`);
  console.log(`the held cradle owns ${out.heldFixes} of them\n`);
  console.log('scene object                             fixes  material        colour   emissive  count');
  for (const r of out.rows) {
    console.log(`${r.name.slice(0, 38).padEnd(40)} ${String(r.fixes).padStart(5)}`
      + `  ${(r.material || '').padEnd(15)} #${r.color || '------'}  #${r.emissive || '------'}`
      + `  ${r.count ?? ''}`);
  }
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
} finally {
  await browser.close();
  server.stop();
}

// probe-body-attribution.mjs -- WHICH material owns the pale pixels on a body?
//
// "THE BODIES ARE PALE MANNEQUINS" is the third item on the round-seven queue,
// and outside.js already says in a comment that this was fixed once by dropping
// the skin to 0x241f1c — with the maths written out — and standing over one
// still gives a near-white figure on near-black ground. So the skin is not what
// owns those pixels, and the next person to change a colour on faith will be
// the third to do it.
//
// Same method as the shore's attribution pass: stand in the frame, hide one
// thing, re-measure, put it back. The bodies are batched, so each group is
// one merged mesh per material and hiding a child hides exactly one material's
// worth of surface.
//
// Reports, for each material of the body you stand over: how much of the near
// band's brightness it owns, and what its own pixels measure.
//
//   node tools/probe-body-attribution.mjs [bodyIndex]
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BODY = Number(process.argv[2] ?? 1);
const outDir = 'scratch-bodies';
mkdirSync(outDir, { recursive: true });

// pose 07: standing over a body, the frame the queue complains about
const POSE = [0.2, 20.2, 0.2, 0.1, 22.4];

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async ({ pose, bodyIndex }) => {
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
    // render() decays fovKick and the impact light every call; settle first or
    // every measurement below is that decay rather than the material.
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
    // The near band is the bottom 45% of frame, same window the frame tool uses
    const band = (d) => {
      let sum = 0, max = 0, n = 0;
      for (let y = Math.floor(H * 0.55); y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
          sum += v; n++;
          if (v > max) max = v;
        }
      }
      return { mean: +(sum / n).toFixed(2), max: Math.round(max) };
    };
    // Pixels this material OWNS: where hiding it changed the frame, how bright
    // were they before, and how many are there?
    const owned = (before, after) => {
      let n = 0, sumBefore = 0, maxBefore = 0, sumAfter = 0;
      for (let i = 0; i < before.length; i += 4) {
        const b = (before[i] + before[i + 1] + before[i + 2]) / 3;
        const a = (after[i] + after[i + 1] + after[i + 2]) / 3;
        if (Math.abs(b - a) < 1.5) continue;
        n++; sumBefore += b; sumAfter += a;
        if (b > maxBefore) maxBefore = b;
      }
      return {
        pixels: n,
        pctOfFrame: +(100 * n / (before.length / 4)).toFixed(2),
        meanBefore: n ? +(sumBefore / n).toFixed(1) : 0,
        meanAfter: n ? +(sumAfter / n).toFixed(1) : 0,
        maxBefore: Math.round(maxBefore),
      };
    };

    const body = (g.graveBodies || [])[bodyIndex];
    if (!body) return { error: 'no such body', count: (g.graveBodies || []).length };
    const reference = settle();
    const rows = [];
    for (const child of body.children) {
      if (!child.visible) continue;
      const m = child.material;
      child.visible = false;
      const shot = grab();
      child.visible = true;
      rows.push({
        name: child.name || child.type,
        material: m?.type,
        color: m?.color?.getHexString?.(),
        opacity: m?.opacity,
        transparent: m?.transparent,
        ...owned(reference, shot),
      });
    }
    // and the whole body, plus the two lights that fall on it
    const hideAll = (on) => { for (const c of body.children) c.visible = on; };
    hideAll(false);
    const withoutBody = grab();
    hideAll(true);
    const bodyOwned = owned(reference, withoutBody);

    // The wreck's headlight is the accused. Turn it down, not off — off would
    // change the light census; intensity is free.
    const spot = g.scene.children.find((o) => o.isSpotLight);
    const spotWas = spot ? spot.intensity : null;
    let dimmed = null;
    if (spot) {
      spot.intensity = spotWas * 0.5;
      const shot = grab();
      dimmed = { ...band(shot), bodyPixels: owned(reference, shot) };
      spot.intensity = spotWas;
    }
    return {
      bodyIndex, referenceBand: band(reference), rows, bodyOwned,
      spotWas, dimmed,
      png: g.renderer.domElement.toDataURL('image/png'),
    };
  }, { pose: POSE, bodyIndex: BODY });

  if (out.error) { console.log('ERROR', out); }
  else {
    writeFileSync(join(outDir, `pose07-body${BODY}.png`), Buffer.from(out.png.split(',')[1], 'base64'));
    console.log(`near band of the whole frame: mean ${out.referenceBand.mean}  max ${out.referenceBand.max}`);
    console.log(`the entire body owns ${out.bodyOwned.pixels} px (${out.bodyOwned.pctOfFrame}% of frame),`
      + ` mean ${out.bodyOwned.meanBefore} max ${out.bodyOwned.maxBefore}`);
    console.log('\nper material, worst first:');
    console.log('surface                          colour    px    %frame   mean  max   without');
    for (const r of out.rows.sort((a, b) => b.meanBefore * b.pixels - a.meanBefore * a.pixels)) {
      console.log(`${(r.name || '').slice(0, 30).padEnd(32)} #${r.color}  ${String(r.pixels).padStart(5)}`
        + `  ${String(r.pctOfFrame).padStart(6)}  ${String(r.meanBefore).padStart(5)} ${String(r.maxBefore).padStart(4)}`
        + `  ${String(r.meanAfter).padStart(6)}`);
    }
    if (out.dimmed) {
      console.log(`\nwreck headlight at half (${out.spotWas} -> ${out.spotWas * 0.5}):`
        + ` near band mean ${out.dimmed.mean} (was ${out.referenceBand.mean}), max ${out.dimmed.max}`);
      console.log(`  it moves ${out.dimmed.bodyPixels.pixels} px, mean ${out.dimmed.bodyPixels.meanBefore}`
        + ` -> ${out.dimmed.bodyPixels.meanAfter}`);
    }
    writeFileSync(resultsPath('body-attribution.json'), JSON.stringify(
      { ...out, png: undefined }, null, 2));
  }
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
} finally {
  await browser.close();
  server.stop();
}

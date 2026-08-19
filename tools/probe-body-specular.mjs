// probe-body-specular.mjs -- is the pale on the dead their ALBEDO at all?
//
// The decisive experiment, and it takes one render: set the material's colour
// to pure black and look at what is left. A MeshStandardMaterial's dielectric
// specular uses a fixed F0 of 0.04 REGARDLESS of albedo, so a surface painted
// at 0.004 linear under an irradiance of ~30 gets 0.12 of diffuse and 1.2 of
// specular — ten to one, and the ten is the part no recolour can reach. This
// project has already been here once, on the basement boiler: "the boiler
// stayed pale plastic through a 6.7x albedo cut because what was pale was
// never the albedo."
//
// If black albedo still renders bright, the cloth needs to stop being
// MeshStandard, not get darker.
//
//   node tools/probe-body-specular.mjs [body1|car]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const TARGET = process.argv[2] ?? 'body1';
 const POSE = TARGET === 'car'
  ? [-12.2, 14.5, -9, 0.9, 14]              // 04, standing beside the wreck
  : [0.2, 20.2, 0.2, 0.1, 22.4];            // 07, standing over a body

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async ({ pose, target }) => {
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

    const body = target === 'car' ? g.graveCar : (g.graveBodies || [])[1];
    if (!body) return { error: 'no target' };
    // the two biggest cloth surfaces, by the attribution pass
    const targets = body.children.filter((c) => c.material?.isMeshStandardMaterial
      && c.material.color && c.visible);
    const reference = settle();

    // which pixels are theirs? hide them all once
    const was = targets.map((c) => c.visible);
    targets.forEach((c) => { c.visible = false; });
    const hidden = grab();
    targets.forEach((c, i) => { c.visible = was[i]; });
    const mask = [];
    for (let i = 0; i < reference.length; i += 4) {
      const b = (reference[i] + reference[i + 1] + reference[i + 2]) / 3;
      const a = (hidden[i] + hidden[i + 1] + hidden[i + 2]) / 3;
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
      return { mean: mask.length ? +(sum / mask.length).toFixed(1) : 0, max: Math.round(max), min: Math.round(min) };
    };

    const bases = targets.map((c) => c.material.color.clone());
    const rough = targets.map((c) => c.material.roughness);
    const asIs = onMask(reference);

    targets.forEach((c) => c.material.color.setRGB(0, 0, 0));
    const black = onMask(grab());

    // ...and with the specular pushed as wide as it goes
    targets.forEach((c) => { c.material.roughness = 1; });
    const blackRough = onMask(grab());

    targets.forEach((c, i) => { c.material.color.copy(bases[i]); });
    const roughOnly = onMask(grab());
    targets.forEach((c, i) => { c.material.roughness = rough[i]; });

    return {
      maskPixels: mask.length,
      surfaces: targets.map((c) => ({
        name: c.name, color: c.material.color.getHexString(),
        roughness: c.material.roughness, metalness: c.material.metalness,
        type: c.material.type,
      })),
      asIs, black, blackRough, roughOnly,
    };
  }, { pose: POSE, target: TARGET });

  if (out.error) console.log('ERROR', out);
  else {
    console.log(`the body's lit cloth owns ${out.maskPixels} px\n`);
    console.log('  as authored                    mean', out.asIs.mean, ' min', out.asIs.min, ' max', out.asIs.max);
    console.log('  with albedo set to PURE BLACK  mean', out.black.mean, ' min', out.black.min, ' max', out.black.max);
    console.log('  black + roughness 1            mean', out.blackRough.mean, ' min', out.blackRough.min, ' max', out.blackRough.max);
    console.log('  authored + roughness 1         mean', out.roughOnly.mean, ' min', out.roughOnly.min, ' max', out.roughOnly.max);
    const specularShare = (100 * out.black.mean / Math.max(0.01, out.asIs.mean)).toFixed(0);
    console.log(`\n${specularShare}% of what you see on the dead survives a pure-black albedo.`);
    console.log('That part is dielectric specular, and no recolour can reach it.');
    console.log('\nsurfaces tested:');
    for (const s of out.surfaces) console.log(`  ${(s.name || '').padEnd(30)} #${s.color}  ${s.type} rough ${s.roughness} metal ${s.metalness}`);
  }
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
} finally {
  await browser.close();
  server.stop();
}

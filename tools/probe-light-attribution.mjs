// probe-light-attribution.mjs — stop guessing which light is bleaching a prop.
// Frames the subject, then turns each light contributor off in turn and reports
// what the subject's pixels are worth without it. The biggest drop is the
// culprit. Directional lights are included: they have no decay, so they never
// show up in a falloff ranking and are easy to miss.
//   node tools/probe-light-attribution.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const out = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    F.start(); F.teleport('graveyard'); F.stepWith(1.2, {}, false);

    const V = g.player.pos.constructor;
    let carPos = new V(-9, 0.6, 14);
    g.scene.traverse((o) => { if (o.name === 'wrecked station wagon') o.getWorldPosition(carPos); });

    const look = (px, pz, t) => {
      g.player.pos.set(px, 0.05, pz);
      g.player.vel.set(0, 0, 0); g.player.grounded = true;
      const dx = t.x - px, dz = t.z - pz;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(t.y - 1.67, Math.hypot(dx, dz));
      g.camera.fov = 62; g.camera.updateProjectionMatrix();
      g.player._sync(0);
    };
    look(carPos.x + 3.4, carPos.z - 2.6, { x: carPos.x, y: 0.8, z: carPos.z });
    F.stepWith(0.3, {}, false);

    const cv = document.createElement('canvas');
    cv.width = g.renderer.domElement.width; cv.height = g.renderer.domElement.height;
    const ctx = cv.getContext('2d');
    const sample = () => {
      for (let i = 0; i < 4; i++) { g._lastShakeDt = 1 / 60; g.render(); }
      ctx.drawImage(g.renderer.domElement, 0, 0);
      // the car body fills the middle-left band of this framing
      const x0 = Math.floor(cv.width * 0.24), y0 = Math.floor(cv.height * 0.44);
      const w = Math.floor(cv.width * 0.42), h = Math.floor(cv.height * 0.18);
      const d = ctx.getImageData(x0, y0, w, h).data;
      let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { s += (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255; n++; }
      return +(s / n).toFixed(4);
    };

    const lights = [];
    g.scene.traverse((o) => { if (o.isLight && o.visible) lights.push(o); });

    const base = sample();
    const rows = [];
    for (const L of lights) {
      const keep = L.intensity;
      if (!keep) continue;
      L.intensity = 0;
      const without = sample();
      L.intensity = keep;
      const drop = +(base - without).toFixed(4);
      if (Math.abs(drop) < 0.002) continue;
      rows.push({
        type: L.type,
        name: L.name || L.parent?.name || '',
        intensity: +keep.toFixed(2),
        decay: L.decay ?? null,
        without, drop,
        sharePct: +((drop / Math.max(1e-6, base)) * 100).toFixed(1),
      });
    }
    rows.sort((a, b) => b.drop - a.drop);
    return { base, rows, lights: lights.length };
  });

  console.log(`car body mean luminance with everything on: ${out.base}  (${out.lights} lights in scene)`);
  console.log('drop   share   without  int     decay  type              name');
  for (const r of out.rows) {
    console.log(
      String(r.drop).padStart(6),
      (r.sharePct + '%').padStart(7),
      String(r.without).padStart(8),
      String(r.intensity).padStart(7),
      String(r.decay).padStart(6),
      ' ', String(r.type).padEnd(17),
      r.name);
  }
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

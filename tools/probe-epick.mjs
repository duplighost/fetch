// probe-epick.mjs — can the player actually USE anything in the first room?
//   node tools/probe-epick.mjs
// Alex: "im stuck in the first room of the game. i cant interact with anything."
// Stands at the real wake pose, aims at each bedroom interactable in turn, and
// reports for each one: did the ray reach it at all, and if it did, did the
// occlusion test throw it away — and which collider did the throwing.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true,
    null, { timeout: 60000, polling: 200 });

  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    await F.step(1 / 60, 20);

    const rows = [];
    const V = g.skull.pos.constructor;
    for (const obj of g.world.interactables.slice()) {
      const it = obj.userData.inter;
      if (!it) continue;
      const wp = obj.getWorldPosition(new V());
      // stand 1.4 m back from it on the room side and look straight at it
      const from = new V(wp.x, 3.6, wp.z - 1.4);
      g.player.pos.copy(from);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player._sync(0);
      const cam = g.camera.getWorldPosition(new V());
      const dx = wp.x - cam.x, dy = wp.y - cam.y, dz = wp.z - cam.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
      await F.step(1 / 60, 2);

      // raw ray, before any occlusion opinion
      g.camera.updateMatrixWorld();
      g._ray.setFromCamera(g._center, g.camera);
      g._ray.far = 2.9;
      const hits = g._ray.intersectObjects(g.world.interactables, false);
      const mine = hits.find((h) => h.object === obj);
      const picked = g._crosshairTarget();
      let culprit = null;
      if (mine && (!picked || picked.id !== it.id) && g._occluded(mine.distance, obj)) {
        // find WHICH collider is doing it
        const o = g._ray.ray.origin, d = g._ray.ray.direction;
        for (const c of g.world.colliders) {
          if (c.max.y - c.min.y < 1e-4) continue;
          let t0 = 0, t1 = mine.distance - 0.12, hit = true;
          for (const ax of ['x', 'y', 'z']) {
            const dv = d[ax];
            if (Math.abs(dv) < 1e-8) {
              if (o[ax] < c.min[ax] || o[ax] > c.max[ax]) { hit = false; break; }
              continue;
            }
            let a = (c.min[ax] - o[ax]) / dv, b = (c.max[ax] - o[ax]) / dv;
            if (a > b) { const s = a; a = b; b = s; }
            if (a > t0) t0 = a;
            if (b < t1) t1 = b;
            if (t0 > t1) { hit = false; break; }
          }
          if (hit) {
            culprit = {
              id: c.id || null,
              min: [+c.min.x.toFixed(2), +c.min.y.toFixed(2), +c.min.z.toFixed(2)],
              max: [+c.max.x.toFixed(2), +c.max.y.toFixed(2), +c.max.z.toFixed(2)],
            };
            break;
          }
        }
      }
      rows.push({
        id: it.id, enabled: it.enabled !== false,
        rayReached: !!mine,
        picked: picked ? picked.id : null,
        ok: !!picked && picked.id === it.id,
        at: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
        culprit,
      });
    }
    return rows;
  });

  const bad = out.filter((r) => r.enabled && r.rayReached && !r.ok);
  console.log(`${out.length} interactables, ${bad.length} enabled-but-unusable\n`);
  for (const r of bad) console.log(JSON.stringify(r));
  if (!bad.length) console.log('every enabled interactable answers its own crosshair');
  console.log(errors.length ? '\nERRORS: ' + errors.join(' | ') : '\n(clean)');
  process.exit(0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

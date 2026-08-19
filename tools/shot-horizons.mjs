// shot-horizons.mjs — where does the world END, and can the player see it?
//
// Alex: "on some sides through the house the windows were open but it just
// kind of looks like black through the window and the end of the world" and
// "i wonder if the part when you get out of the forest still lets you walk
// around and see the end of the world type area with nothing on the sides."
// This looks OUTWARD from every place he named instead of inward at the rooms.
//   node tools/shot-horizons.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-horizons');
mkdirSync(out, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const result = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    const frames = {};
    const notes = [];

    const look = (px, py, pz, tx, ty, tz) => {
      g.player.pos.set(px, py, pz);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      const dx = tx - px, dz = tz - pz;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(ty - (py + 1.62), Math.hypot(dx, dz) || 0.001)));
      g.fovKick = 0; g._shake = 0; g.camera.fov = 71; g.camera.updateProjectionMatrix();
      g.player._sync(0);
    };
    const grab = (n) => { for (let i = 0; i < 4; i++) { g._lastShakeDt = 1 / 60; g.render(); } frames[n] = g.renderer.domElement.toDataURL('image/png'); };
    const shot = (n, fn) => { try { fn(); grab(n); } catch (e) { notes.push(n + ': ' + (e && e.message || e)); } };

    F.start();
    F.stepWith(2.4, {}, false);

    // ---- out of the house windows, from inside, standing at the sill
    const windowShots = () => {
      const list = g.world.windowOpenings || [];
      list.forEach((w, i) => {
        const c = w.center, n = w.normal;
        if (!c || !n) { notes.push(`window ${i}: no center/normal`); return; }
        // Stand back INSIDE and look straight out through the aperture. Both
        // sides get tried, because which one is the room depends on the wall.
        for (const side of [1, -1]) {
          shot(`w${i}${side > 0 ? 'a' : 'b'}-${w.id.replace(/[^a-z0-9]/gi, '_')}`, () => {
            const px = c.x + n.x * 1.7 * side, pz = c.z + n.z * 1.7 * side;
            const floorY = g.world.groundHeightAt(px, pz, c.y + 2);
            look(px, floorY, pz, c.x - n.x * 30 * side, c.y + 1.5, c.z - n.z * 30 * side);
          });
        }
      });
      if (!list.length) notes.push('no windowOpenings registered');
    };
    F.teleport('bedroom'); F.stepWith(0.8, {}, false);
    windowShots();

    // ---- the graveyard, looking OUT over its own fence in four directions
    shot('g1-out-west', () => { F.teleport('graveyard'); F.stepWith(1.0, {}, false); look(-16, 0.05, 18, -40, 2.5, 18); });
    shot('g2-out-east', () => look(20, 0.05, 18, 44, 2.5, 18));
    shot('g3-out-north', () => look(0, 0.05, 40, 0, 3.0, 70));
    shot('g4-out-south', () => look(0, 0.05, 2, 0, 3.0, -26));
    shot('g5-up', () => { look(0, 0.05, 20, 0, 3, 24); g.player.pitch = 1.0; g.player._sync(0); });

    // ---- the clearing: the place he asked about, looked at sideways and back
    shot('c1-clearing-left', () => {
      F.teleport('clearing'); F.stepWith(1.0, {}, false);
      const c = g.clearingCenter;
      look(c.x, 0.2, c.z, c.x - 40, 4, c.z);
    });
    shot('c2-clearing-right', () => { const c = g.clearingCenter; look(c.x, 0.2, c.z, c.x + 40, 4, c.z); });
    shot('c3-clearing-back', () => { const c = g.clearingCenter; look(c.x, 0.2, c.z - 4, c.x, 4, c.z - 44); });
    shot('c4-clearing-far-left', () => { const c = g.clearingCenter; look(c.x - 18, 0.2, c.z + 4, c.x - 48, 4, c.z + 6); });

    // ---- the forest exit, looking off the sides of the corridor
    shot('f1-forest-side', () => {
      F.teleport('forest'); F.stepWith(0.6, {}, false);
      F.stepWith(7.0, { moveZ: 1, run: true }, false);
      const p = g.player.pos;
      look(p.x, p.y, p.z, p.x + 40, 3, p.z);
    });
    shot('f2-forest-side-other', () => { const p = g.player.pos; look(p.x, p.y, p.z, p.x - 40, 3, p.z); });

    return { frames, notes };
  });

  for (const [name, data] of Object.entries(result.frames)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('wrote', Object.keys(result.frames).length, 'horizon shots to', out);
  if (result.notes.length) console.log('NOTES:\n  ' + result.notes.join('\n  '));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

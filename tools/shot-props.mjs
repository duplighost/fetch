// shot-props.mjs — close looks at the individual objects, not the rooms.
// The room shots flatter props: at room distance a flat-shaded box reads as
// "furniture". Stand in front of it and it reads as a box.
//   node tools/shot-props.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-props');
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
      g.fovKick = 0; g._shake = 0; g.camera.fov = 62; g.camera.updateProjectionMatrix();
      g.player._sync(0);
    };
    const grab = (n) => { for (let i = 0; i < 4; i++) { g._lastShakeDt = 1 / 60; g.render(); } frames[n] = g.renderer.domElement.toDataURL('image/png'); };
    const shot = (n, fn) => { try { fn(); grab(n); } catch (e) { notes.push(n + ': ' + (e && e.message || e)); } };

    // find a named mesh anywhere in the scene and return its world position
    const findPos = (needle) => {
      let hit = null;
      g.scene.traverse((o) => {
        if (hit) return;
        if ((o.name || '').toLowerCase().includes(needle.toLowerCase())) hit = o;
      });
      if (!hit) return null;
      const v = new (g.player.pos.constructor)();
      hit.getWorldPosition(v);
      return v;
    };

    F.start();
    F.stepWith(2.4, {}, false);

    // ---- basement furnace / boiler
    shot('p1-boiler', () => {
      F.teleport('basement'); F.stepWith(1.0, {}, false);
      const p = findPos('boiler-tank');
      if (!p) throw new Error('boiler-tank not found');
      look(p.x, -3, p.z + 2.2, p.x, p.y, p.z);
    });
    shot('p2-boiler-oblique', () => {
      const p = findPos('boiler-tank');
      look(p.x + 1.9, -3, p.z + 1.7, p.x, p.y, p.z);
    });

    // ---- a door, close, the thing every room has
    shot('p3-door', () => {
      F.teleport('house'); F.stepWith(0.8, {}, false);
      const d = g.world.doors.find((dd) => dd.group && dd.id !== 'frontDoor');
      const p = d.group.position;
      look(p.x, 3.6, p.z + 1.6, p.x, p.y + 1.0, p.z);
    });
    shot('p4-front-door', () => {
      const d = g.world.doorById.frontDoor;
      const p = d.group.position;
      look(p.x, 0.05, p.z + 1.7, p.x, p.y + 1.1, p.z);
    });

    // ---- bedroom furniture, close
    shot('p5-wardrobe', () => {
      F.teleport('bedroom'); F.stepWith(0.8, {}, false);
      look(9.0, 3.6, 5.4, 11.0, 4.6, 6.6);
    });
    shot('p6-bed', () => {
      look(10.6, 3.6, 4.2, 8.6, 4.0, 3.0);
    });

    // ---- graveyard: the car and the mausoleum
    shot('p7-car', () => {
      F.teleport('graveyard'); F.stepWith(1.0, {}, false);
      const p = findPos('wrecked station wagon') || { x: -9, y: 0.6, z: 9 };
      look(p.x + 3.4, 0.05, p.z - 2.6, p.x, 0.8, p.z);
    });
    shot('p8-car-side', () => {
      const p = findPos('wrecked station wagon') || { x: -9, y: 0.6, z: 9 };
      look(p.x - 0.4, 0.05, p.z - 4.2, p.x, 0.8, p.z);
    });
    shot('p9-mausoleum', () => {
      const m = g.ritualMausoleum;
      look(m.x + 3.6, 0.05, m.z - 5.0, m.x, 1.6, m.z);
    });
    shot('p10-headstones', () => {
      look(2.5, 0.05, 22.0, 4.5, 0.9, 26.0);
    });
    shot('p11-bodies', () => {
      const p = findPos('graveyard body 1') || { x: -4, y: 0.3, z: 14 };
      look(p.x + 2.2, 0.05, p.z - 2.0, p.x, 0.35, p.z);
    });
    return { frames, notes };
  });

  for (const [name, data] of Object.entries(result.frames)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('wrote', Object.keys(result.frames).length, 'prop shots to', out);
  if (result.notes.length) console.log('SKIPPED:\n  ' + result.notes.join('\n  '));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

// shot-visual-audit.mjs — LOOK AT THE WHOLE GAME. One pass, every act, from
// vantages a player actually stands in. Writes numbered PNGs plus a report of
// draw calls per frame so a prettier game cannot quietly blow the budget.
//   node tools/shot-visual-audit.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-visual-audit');
mkdirSync(out, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const result = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    const frames = {};
    const report = [];
    const notes = [];

    const render = () => { g._lastShakeDt = 1 / 60; g.render(); };
    const room = (id) => g.world.rooms.find((r) => r.id === id);
    const rc = (id) => { const r = room(id); return r ? { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: r.floorY } : null; };

    const look = (px, py, pz, tx, ty, tz) => {
      g.player.pos.set(px, py, pz);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      const dx = tx - px, dz = tz - pz;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(ty - (py + 1.62), Math.hypot(dx, dz) || 0.001)));
      g.fovKick = 0; g._shake = 0;
      g.camera.fov = 71; g.camera.updateProjectionMatrix();
      g.player._sync(0);
    };

    const grab = (name) => {
      for (let i = 0; i < 4; i++) render();
      frames[name] = g.renderer.domElement.toDataURL('image/png');
      report.push({ name, act: g.act, draws: g.lastRender.drawCalls, tris: g.lastRender.triangles });
    };

    const shot = (name, fn) => {
      try { fn(); grab(name); }
      catch (e) { notes.push(name + ': ' + String(e && e.message || e)); }
    };

    F.start();
    F.stepWith(2.6, {}, false);   // let the wake tilt finish

    // ---------------------------------------------------------------- bedroom
    shot('01-bedroom-wake', () => {
      F.teleport('bedroom'); F.stepWith(0.8, {}, false);
    });
    shot('02-bedroom-turned', () => {
      const b = rc('bedroom');
      look(b.x, b.y, b.z + 1.4, b.x - 2.2, b.y + 1.4, b.z - 2.4);
      F.stepWith(0.2, {}, false);
    });

    // ------------------------------------------------------------------ house
    shot('03-house-landing', () => {
      F.teleport('house'); F.stepWith(0.8, {}, false);
    });
    shot('04-house-nursery', () => {
      const n = rc('nursery');
      look(n.x + 1.6, n.y, n.z + 1.6, n.x - 1.4, n.y + 1.2, n.z - 1.6);
      F.stepWith(0.3, {}, false);
    });
    shot('05-house-stairwell-down', () => {
      const s = rc('stairwell');
      look(s.x, s.y, s.z + 1.2, s.x, s.y - 2.4, s.z - 2.6);
      F.stepWith(0.3, {}, false);
    });
    shot('06-house-guest', () => {
      const q = rc('guest');
      look(q.x + 1.8, q.y, q.z + 1.4, q.x - 1.8, q.y + 1.3, q.z - 1.2);
      F.stepWith(0.3, {}, false);
    });
    shot('07-house-foyer', () => {
      const f = rc('foyer');
      look(f.x, f.y, f.z + 1.8, f.x + 2.6, f.y + 1.4, f.z - 1.6);
      F.stepWith(0.3, {}, false);
    });
    shot('08-house-living', () => {
      const l = rc('living');
      look(l.x + 1.4, l.y, l.z + 1.4, l.x - 1.6, l.y + 1.2, l.z - 1.4);
      F.stepWith(0.3, {}, false);
    });
    shot('09-house-kitchen', () => {
      const k = rc('kitchen');
      look(k.x + 1.4, k.y, k.z - 1.4, k.x - 1.4, k.y + 1.3, k.z + 1.6);
      F.stepWith(0.3, {}, false);
    });
    shot('10-house-dining', () => {
      const d = rc('dining');
      look(d.x + 1.6, d.y, d.z - 1.2, d.x - 1.8, d.y + 1.3, d.z + 1.2);
      F.stepWith(0.3, {}, false);
    });

    // --------------------------------------------------------------- basement
    shot('11-basement-arrival', () => {
      F.teleport('basement'); F.stepWith(0.8, {}, false);
    });
    shot('12-basement-corridor', () => {
      const c = rc('bcorr');
      look(c.x + 3.0, c.y, c.z, c.x - 3.4, c.y + 1.3, c.z);
      F.stepWith(0.3, {}, false);
    });
    shot('13-basement-boiler', () => {
      const b = rc('boiler');
      look(b.x + 1.6, b.y, b.z + 1.8, b.x - 1.6, b.y + 1.4, b.z - 1.8);
      F.stepWith(0.3, {}, false);
    });
    shot('14-basement-storeroom', () => {
      const s = rc('storeroom');
      look(s.x + 1.6, s.y, s.z + 1.6, s.x - 1.6, s.y + 1.3, s.z - 1.6);
      F.stepWith(0.3, {}, false);
    });
    shot('15-basement-crawl', () => {
      const c = rc('crawl');
      look(c.x, c.y, c.z + 2.4, c.x, c.y + 1.2, c.z - 2.6);
      F.stepWith(0.3, {}, false);
    });
    shot('16-basement-pump-gallery', () => {
      const p = rc('pumpGallery');
      look(p.x, p.y, p.z + 2.6, p.x, p.y + 1.4, p.z - 2.8);
      F.stepWith(0.3, {}, false);
    });
    shot('17-basement-archive', () => {
      const a = rc('blindArchive');
      look(a.x + 2.2, a.y, a.z, a.x - 2.4, a.y + 1.5, a.z);
      F.stepWith(0.3, {}, false);
    });
    shot('18-basement-hatchbay', () => {
      const h = rc('hatchbay');
      look(h.x, h.y, h.z - 1.4, h.x, h.y + 2.2, h.z + 1.2);
      F.stepWith(0.3, {}, false);
    });

    // -------------------------------------------------------------- graveyard
    shot('19-graveyard-spawn', () => {
      F.teleport('graveyard'); F.stepWith(0.9, {}, false);
    });
    shot('20-graveyard-car', () => {
      look(-4.0, 0.05, 6.0, -9.0, 0.9, 9.0);
      F.stepWith(0.3, {}, false);
    });
    shot('21-graveyard-stones', () => {
      look(2.0, 0.05, 18.0, 8.0, 1.0, 30.0);
      F.stepWith(0.3, {}, false);
    });
    shot('22-graveyard-mausoleum', () => {
      const m = g.ritualMausoleum;
      look(m.x, 0.05, m.z - 6.5, m.x, 2.2, m.z);
      F.stepWith(0.3, {}, false);
    });
    shot('23-graveyard-gate', () => {
      look(11.0, 0.05, 26.0, 11.0, 2.4, 40.0);
      F.stepWith(0.3, {}, false);
    });

    // ----------------------------------------------------------------- forest
    shot('24-forest-trail', () => {
      F.teleport('forest'); F.stepWith(0.6, {}, false);
      F.stepWith(4.0, { moveZ: 1 }, false);
    });
    shot('25-forest-lookback', () => {
      g.player.yaw += Math.PI; F.stepWith(0.2, {}, false);
    });
    shot('26-forest-canopy', () => {
      g.player.yaw -= Math.PI; g.player.pitch = 0.85; F.stepWith(0.2, {}, false);
    });
    shot('27-forest-deep', () => {
      g.player.pitch = 0; F.stepWith(9.0, { moveZ: 1, run: true }, false);
    });

    // --------------------------------------------------------------- clearing
    shot('28-clearing-arrival', () => {
      F.teleport('clearing'); F.stepWith(0.9, {}, false);
    });
    shot('29-clearing-falls', () => {
      const c = g.clearingCenter;
      look(c.x - 10.5, 0.2, c.z + 2.0, c.x, 8.0, c.z + 19.5);
      F.stepWith(0.3, {}, false);
    });
    shot('30-clearing-pool', () => {
      const c = g.clearingCenter;
      look(c.x - 7.0, 0.2, c.z + 8.0, c.x + 1.0, -0.4, c.z + 15.0);
      F.stepWith(0.3, {}, false);
    });
    shot('31-clearing-stones', () => {
      const c = g.clearingCenter;
      look(c.x + 0.2, 0.2, c.z + 5.0, c.x + 0.2, 0.4, c.z + 16.0);
      F.stepWith(0.3, {}, false);
    });

    // ------------------------------------------------------------- underfalls
    shot('32-cave-arrival', () => {
      const t = g.world.fetchTargets.find((q) => q.id === 'waterfall');
      if (t && t.enabled) { const d = t.onHit.call(t, g.skull, t.pos, {}); if (d === 'gone') g.skull.vanish(); }
      F.stepWith(6, {}, false);
      F.teleport('cave'); F.stepWith(0.9, {}, false);
    });
    shot('33-cave-route', () => {
      const L = g.underfalls.layout;
      look(L.entrance.x, 0, L.entrance.z + 1.4, L.named['intake apse'].x, 1.6, L.named['intake apse'].z);
      F.stepWith(0.4, {}, false);
    });
    shot('34-cave-pump', () => {
      const L = g.underfalls.layout;
      const a = L.named['chapel west aisle'];
      look(a.x, 0, a.z, g.underfalls.pump.position.x, 2.1, g.underfalls.pump.position.z);
      F.stepWith(0.4, {}, false);
    });
    shot('35-cave-hatch', () => {
      const L = g.underfalls.layout;
      look(L.hatch.x - 1.8, 0, L.hatch.z - 1.8, L.hatch.x, 3.7, L.hatch.z);
      F.stepWith(0.4, {}, false);
    });

    // ------------------------------------------------------------------ final
    shot('36-mirror-room', () => {
      F.teleport('mirror'); F.stepWith(1.4, {}, false);
    });

    return { frames, report, notes, errors: [] };
  });

  for (const [name, data] of Object.entries(result.frames)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify({ report: result.report, notes: result.notes, errors }, null, 2));
  console.log('wrote', Object.keys(result.frames).length, 'shots to', out);
  for (const r of result.report) console.log(String(r.name).padEnd(28), String(r.act).padEnd(11), 'draws', r.draws, 'tris', r.tris);
  if (result.notes.length) console.log('SKIPPED:\n  ' + result.notes.join('\n  '));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

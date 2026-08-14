// probe-lantern-curve.mjs — the carried lantern's falloff, as a picture.
//
// Measured (probe-light-attribution): the skull's light is ~91% of everything
// a nearby prop is lit by. Its curve is intensity 58 / decay 1.6, which
// delivers irradiance ~131 at 0.6 m and ~1.25 at 11 m: a hundred to one across
// the room you are standing in. A surface clips at albedo x irradiance > 1, so
// at working distance (1.6 m, irradiance 27) a prop must be authored below
// 0.037 albedo to avoid blowing out — and below 0.007 to sit at mid value.
// That is why every close prop in this game reads as white plastic or as a
// black shape, and never as iron.
//
// This renders the same vantages under the shipped curve and a proposed one
// that trades near-field ferocity for reach. Nothing is changed on disk; the
// numbers are set at runtime so the comparison is honest.
//   node tools/probe-lantern-curve.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-lantern');
mkdirSync(out, { recursive: true });

// Fitted to cross the shipped curve at ~5 m, so mid-range reads the same.
const CURVES = {
  'A-shipped': { intensity: 58, decay: 1.6, distance: 11.5 },
  'B-proposed': { intensity: 26, decay: 1.05, distance: 13 },
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const result = await page.evaluate(async (CURVES) => {
    const g = window.__game, F = window.__FETCH;
    const frames = {};
    const rows = [];

    const look = (px, py, pz, tx, ty, tz) => {
      g.player.pos.set(px, py, pz);
      g.player.vel.set(0, 0, 0); g.player.grounded = true;
      const dx = tx - px, dz = tz - pz;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(ty - (py + 1.62), Math.hypot(dx, dz) || 0.001)));
      g.camera.fov = 62; g.camera.updateProjectionMatrix();
      g.player._sync(0);
    };
    const apply = (c) => {
      g.skullLight.intensity = c.intensity;
      g.skullLight.decay = c.decay;
      g.skullLight.distance = c.distance;
    };
    const cv = document.createElement('canvas');
    cv.width = g.renderer.domElement.width; cv.height = g.renderer.domElement.height;
    const ctx = cv.getContext('2d');
    const grab = (name) => {
      for (let i = 0; i < 4; i++) { g._lastShakeDt = 1 / 60; g.render(); }
      frames[name] = g.renderer.domElement.toDataURL('image/png');
      ctx.drawImage(g.renderer.domElement, 0, 0);
      const d = ctx.getImageData(0, Math.floor(cv.height * 0.25), cv.width, Math.floor(cv.height * 0.5)).data;
      let s = 0, n = 0, clip = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
        s += l; if (l > 0.94) clip++; n++;
      }
      return { mean: +(s / n).toFixed(3), clipped: +(clip / n).toFixed(4) };
    };

    F.start();
    F.stepWith(2.4, {}, false);

    const scenes = [
      ['boiler', () => { F.teleport('basement'); F.stepWith(1.0, {}, false); let p = null; g.scene.traverse((o) => { if (o.name === 'boiler-tank') p = o.getWorldPosition(new (g.player.pos.constructor)()); }); look(p.x, -3, p.z + 2.2, p.x, p.y, p.z); }],
      ['corridor', () => { F.teleport('basement'); F.stepWith(0.8, {}, false); const c = g.world.rooms.find((r) => r.id === 'bcorr'); look((c.x0 + c.x1) / 2 + 3, c.floorY, (c.z0 + c.z1) / 2, (c.x0 + c.x1) / 2 - 3.4, c.floorY + 1.3, (c.z0 + c.z1) / 2); }],
      ['car', () => { F.teleport('graveyard'); F.stepWith(1.0, {}, false); look(-5.6, 0.05, 11.4, -9, 0.8, 14); }],
      ['forest', () => { F.teleport('forest'); F.stepWith(0.6, {}, false); F.stepWith(4.0, { moveZ: 1 }, false); }],
      ['bedroom', () => { F.teleport('bedroom'); F.stepWith(1.0, {}, false); }],
    ];

    for (const [name, pose] of scenes) {
      for (const [label, curve] of Object.entries(CURVES)) {
        apply(curve);
        pose();
        F.stepWith(0.25, {}, false);
        const m = grab(`${name}-${label}`);
        rows.push({ scene: name, curve: label, ...m });
      }
    }
    apply(CURVES['A-shipped']);
    return { frames, rows };
  }, CURVES);

  for (const [name, data] of Object.entries(result.frames)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('scene      curve         frame mean   blown-out pixels');
  for (const r of result.rows) {
    console.log(r.scene.padEnd(11), r.curve.padEnd(13), String(r.mean).padEnd(12), (r.clipped * 100).toFixed(2) + '%');
  }
  console.log('\nirradiance by distance:');
  for (const [label, c] of Object.entries(CURVES)) {
    console.log('  ' + label.padEnd(12) + [0.6, 1.2, 1.6, 2, 3, 5, 8, 11].map((d) =>
      `${d}m:${(c.intensity / Math.pow(d, c.decay)).toFixed(1)}`).join('  '));
  }
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

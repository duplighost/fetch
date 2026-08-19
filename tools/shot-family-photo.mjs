// shot-family-photo.mjs -- LOOK at the photograph that replaced the mirror.
// Two poses: coming off the stairs (his freeze spot), and nose-to-glass with
// the lantern doing most of the lighting. Near-band measured: an old print
// must stay a print, not a white rectangle.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'scratch-photo';
mkdirSync(outDir, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    F.stepWith(0.8, {}, false);
    const P = { x: -3.765, y: 1.7, z: -11.25 };
    const shots = [];
    const look = (px, pz) => {
      g.player.pos.set(px, g.world.groundHeightAt(px, pz, 2) + 0.05, pz);
      g.player.vel.set(0, 0, 0);
      const ey = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-(P.x - px), -(P.z - pz));
      g.player.pitch = Math.atan2(P.y - ey, Math.hypot(P.x - px, P.z - pz));
      g.player._sync(0);
    };
    const measure = () => {
      const canvas = g.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 100;
      const ctx = cv.getContext('2d');
      ctx.drawImage(canvas, 0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0, max = 0, clipped = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += v; n++;
        if (v > max) max = v;
        if (v > 232) clipped++;
      }
      return { mean: +(sum / n).toFixed(1), max: Math.round(max), clippedPct: +(100 * clipped / n).toFixed(2) };
    };
    const shoot = (name) => {
      F.stepWith(0.3, {}, false);
      g.render();
      shots.push({ name, png: g.renderer.domElement.toDataURL('image/png'), band: measure() });
    };
    look(P.x + 4.0, P.z); shoot('01-from-the-stairs');
    look(P.x + 1.1, P.z); shoot('02-nose-to-glass');
    look(P.x + 2.2, P.z + 1.4); shoot('03-oblique');
    return { shots, draws: g.lastRender.drawCalls };
  });
  for (const s of out.shots) {
    const f = join(outDir, s.name + '.png');
    writeFileSync(f, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`wrote ${f}  band: mean ${s.band.mean} max ${s.band.max} clipped ${s.band.clippedPct}%`);
  }
  console.log('draws', out.draws);
  if (errors.length) console.log('errors:\n  ' + errors.slice(0, 5).join('\n  '));
} finally {
  await browser.close();
  server.stop();
}

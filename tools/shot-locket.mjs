// scratch-shot-locket.mjs -- the locket's read from the yard, before/after.
// Four poses a player actually stands in, four frames each 0.5s apart so at
// least one frame catches the glint wherever the animation phase happens to be.
//   node tools/scratch-shot-locket.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir = 'scratch-locket/before'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

// [name, fromX, fromZ, toX, toTargetY, toZ]
const POSES = [
  ['entry', 0, 9, 5.2, 7.4, 13.9],
  ['mid-yard-15m', 2, 26, 5.2, 7.4, 13.85],
  ['gate-24m', 2, 36.5, 5.2, 7.4, 13.85],
  ['under-tree', 5.2, 17.5, 5.2, 7.4, 13.85],
];

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async (poses) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(1.2, {}, false);
    g.skull.holdNow();
    F.stepWith(0.6, {}, false);
    const shots = [];
    for (const [name, px, pz, tx, ty, tz] of poses) {
      g.player.pos.set(px, g.world.groundHeightAt(px, pz, 3), pz);
      g.player.vel.set(0, 0, 0);
      const ey = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(ty - ey, Math.hypot(tx - px, tz - pz))));
      g.player._sync(0);
      for (let f = 0; f < 4; f++) {
        F.stepWith(0.5, {}, false);
        g.render();
        shots.push({
          name: `${name}-f${f}`, png: g.renderer.domElement.toDataURL('image/png'),
          draws: g.lastRender.drawCalls,
        });
      }
    }
    return { shots };
  }, POSES);

  for (const s of out.shots) {
    writeFileSync(join(outDir, `${s.name}.png`), Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`${s.name.padEnd(24)} draws ${s.draws}`);
  }
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
} finally {
  await browser.close();
  try { server?.close?.(); server?.stop?.(); } catch {}
}

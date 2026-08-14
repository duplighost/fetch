// Focused: the ossuary lid + handle from the climb platform.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-lid');
mkdirSync(out, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1440, height: 900 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000, polling: 100 });
  const res = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.flag('graveyardResolved');
    g.skull.holdNow();
    const O = g.ossuary;
    O.unlock('probe');
    O.inOssuary = true;
    O.solved = true;
    O.exitT = 1;
    g.player.pos.set(O.origin.x, O.origin.floor, O.origin.z + 20);
    g.player._sync(0);
    F.stepWith(1.5, {}, false);
    const shots = {};
    const grab = (name, px, py, pz, tx, ty, tz) => {
      g.player.pos.set(px, py, pz);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      const dx = tx - px, dz = tz - pz;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(ty - (py + 1.62), Math.hypot(dx, dz) || 0.001)));
      g.player._sync(0);
      F.stepWith(0.06, {}, false);
      g._lastShakeDt = 1 / 60;
      for (let i = 0; i < 4; i++) g.render();
      shots[name] = g.renderer.domElement.toDataURL('image/png');
    };
    const OX = O.origin.x, OZ = O.origin.z, FL = O.origin.floor;
    grab('lid-from-flightB', OX - 0.5, FL + 2.4, OZ + 33.6, OX - 2.45, FL + 5.35, OZ + 35.0);
    grab('lid-from-deck', OX - 2.45, FL + 3.3, OZ + 34.0, OX - 2.45, FL + 5.5, OZ + 35.3);
    return { keys: Object.keys(shots), shots, lidRot: +O.lidPivot.rotation.x.toFixed(2) };
  });
  for (const [name, data] of Object.entries(res.shots)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('lidRot', res.lidRot);
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

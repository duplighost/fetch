// Visual pass for the Aug 14 feedback batch: pit mouth, marrow exit rope,
// hunting statues, floating key, ossuary lid handle, cellar stair skirt,
// pool murk.  node tools/shot-aug14.mjs <outDir>
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-aug14');
mkdirSync(out, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1440, height: 900 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000, polling: 100 });
  const frames = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    const o = {};
    const look = (px, py, pz, tx, ty, tz) => {
      g.player.pos.set(px, py, pz);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      const dx = tx - px, dz = tz - pz;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(ty - (py + 1.62), Math.hypot(dx, dz) || 0.001)));
      g.player._sync(0);
    };
    const grab = (name) => {
      g._lastShakeDt = 1 / 60;
      for (let i = 0; i < 5; i++) g.render();
      o[name] = g.renderer.domElement.toDataURL('image/png');
    };
    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.flag('graveyardResolved');
    g.skull.holdNow();
    F.stepWith(1.0, {}, false);

    // 1. the breathing pit mouth from the lip
    look(11.8, 0.05, 34.6, 11.8, 0.0, 36.4);
    F.stepWith(0.2, {}, false);
    grab('01-pit-mouth');

    // 2. the floating key: topple grave 5 through its real hit path
    const g5 = g.destructibleGraves?.[5];
    if (g5) {
      g5.target.onHit.call(g5.target, { mode: 'outbound' }, g5.target.pos);
      g5.target.onHit.call(g5.target, { mode: 'outbound' }, g5.target.pos);
    }
    F.stepWith(2.2, {}, false);
    look(17.0, 0.05, 36.2, 18.52, 0.85, 37.5);
    F.stepWith(0.3, {}, false);
    grab('02-key-float');

    // 3. descend; the entry hall + exit rope behind
    look(11.8, 0.05, 34.85, 11.8, 0.02, 36.2);
    g.marrow.descend();
    F.stepWith(0.5, {}, false);
    const M = g.marrow;
    look(M.origin.x, M.origin.floor, M.origin.z + 4.0, M.origin.x, M.origin.floor + 1.5, M.origin.z + 0.8);
    F.stepWith(0.1, {}, false);
    grab('03-marrow-exit-rope');

    // 4. the hunting statues: arm and let them close while looking away,
    // then TURN to face what crossed the hall
    g.flag('gotgateKey2');
    look(M.origin.x, M.origin.floor, M.origin.z + 13, M.origin.x, M.origin.floor + 1.5, M.origin.z + 24);
    F.stepWith(1.4, {}, false);
    look(g.player.pos.x, g.player.pos.y, g.player.pos.z,
      M.statues[0].position.x, M.origin.floor + 1.6, M.statues[0].position.z);
    F.stepWith(0.05, {}, false);
    grab('04-statues-hunting');
    g.flags.delete('gotgateKey2');
    M.ascend();
    F.stepWith(0.5, {}, false);

    // 5. ossuary stair top: plain ceiling and the key hanging under it. (Was
    // the lid + handle; that hatch could never open and was deleted 2026-08-17
    // — Alex asked for "just be cieling like the rest", and the counterweight's
    // payout moved up here so the climb has a reason.)
    const O = g.ossuary;
    O.unlock('probe');
    O.inOssuary = true;
    O.solved = true;
    O.exitT = 1;
    O.progress = 1;
    g.player.pos.set(O.origin.x, O.origin.floor, O.origin.z + 0.85);
    g.player._sync(0);
    F.stepWith(0.6, {}, false);
    look(O.origin.x - 1.4, O.origin.floor + 3.25, O.origin.z + 33.4,
      O.origin.x - 2.45, O.origin.floor + 4.45, O.origin.z + 34.7);
    F.stepWith(0.1, {}, false);
    grab('05-ossuary-key-at-the-stair-top');
    O.inOssuary = false;
    F.stepWith(0.3, {}, false);

    // 6. cellar stairs from the kitchen doorway, looking down the flight
    F.teleport('house');
    F.stepWith(0.5, {}, false);
    look(10, 0.05, 2.3, 10, -2.2, 4.4);
    F.stepWith(0.2, {}, false);
    grab('06-cellar-stairs');

    // 7. the pool with a body: from the shore looking across
    F.teleport('clearing');
    F.stepWith(0.5, {}, false);
    const C = g.clearingCenter;
    look(C.x - 7.5, 0.2, C.z + 8.0, C.x, -0.6, C.z + 15.2);
    F.stepWith(0.2, {}, false);
    grab('07-pool-murk');
    return o;
  });
  for (const [name, data] of Object.entries(frames)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('wrote', Object.keys(frames).length, 'shots to', out);
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

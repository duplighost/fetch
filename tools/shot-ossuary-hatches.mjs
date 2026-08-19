// THE OSSUARY'S TWO REAL DOORS, and the ceiling that replaced the fake one.
// (Was shot-lid.mjs, which framed a stair-top hatch nailed shut by a hardcoded
// zero. That lid, its brass padlock and its chain X were deleted 2026-08-17;
// Alex asked for "just be cieling like the rest".)
//
//   node tools/shot-ossuary-hatches.mjs [outdir]
//
// Frames: the throat with the stone on it and off it, the near-end cap wall
// shut and open, the stair top with the key under plain ceiling, and the
// counterweight's wall framed as a gate. LOOK AT THESE — the project law is
// that every wrong conclusion came from reasoning instead of opening the PNG.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] || 'scratch-hatches');
mkdirSync(out, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1440, height: 900 });
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 300000, polling: 100 });
  const res = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.flag('graveyardResolved');
    g.skull.holdNow();
    const O = g.ossuary;
    O.unlock('probe');
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
    const m = g.ritualMausoleum;

    // 1-2. the entry throat, stone on and stone off
    grab('01-throat-with-the-stone-on', m.x, 0.04, m.z - 1.9, m.x, 0.2, m.z + 0.4);
    O.entryLid.moving = true;
    for (let i = 0; i < 60 && !O.entryLid.open; i++) F.stepWith(0.1, {}, false);
    grab('02-throat-with-the-stone-off', m.x, 0.04, m.z - 1.9, m.x, 0.2, m.z + 0.4);

    // 3-4. the near end: a wall that exists, with a hatch in it
    O.inOssuary = true;
    F.stepWith(0.4, {}, false);
    grab('03-the-near-end-is-a-wall', OX, FL, OZ + 4.2, OX, FL + 1.1, OZ);
    O.exitLid.moving = true;
    for (let i = 0; i < 60 && !O.exitLid.open; i++) F.stepWith(0.1, {}, false);
    grab('04-the-way-back-open', OX, FL, OZ + 4.2, OX, FL + 1.1, OZ);

    // 5. the counterweight's wall, framed as a gate, before it drops
    grab('05-the-wall-the-weight-lowers', OX, FL, OZ + 24.0, OX, FL + 1.4, OZ + 28.15);

    // 6-7. the stair top: plain ceiling, and the key hanging under it
    O.solved = true;
    O.exitT = 1;
    O.progress = 1;
    for (let i = 0; i < 40; i++) F.stepWith(0.1, {}, false);
    grab('06-the-stair-top-is-ceiling', OX - 1.2, FL + 3.25, OZ + 33.2,
      OX - 2.45, FL + 5.4, OZ + 34.7);
    grab('07-the-key-at-the-stair-top', OX - 1.4, FL + 3.25, OZ + 33.4,
      OX - 2.45, FL + 4.45, OZ + 34.7);

    // 8. the floor, moving
    grab('08-the-floor-is-moving', OX, FL, OZ + 9.0, OX, FL + 0.05, OZ + 11.5);

    const key1 = g.gateKeys.list[0];
    return { keys: Object.keys(shots), shots,
      entryLid: +O.entryLid.t.toFixed(2), exitLid: +O.exitLid.t.toFixed(2),
      keyHome: key1.revealed ? key1.home.toArray().map((v) => +v.toFixed(2)) : null,
      headroomAtTop: +(g.player.pos.y).toFixed(2),
      draws: g.lastRender ? g.lastRender.drawCalls : null };
  });
  for (const [name, data] of Object.entries(res.shots)) {
    writeFileSync(join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('wrote', res.keys.length, 'shots to', out);
  console.log(JSON.stringify({ entryLid: res.entryLid, exitLid: res.exitLid,
    keyHome: res.keyHome, draws: res.draws }, null, 1));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

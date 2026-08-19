// One-off: why does a thrown skull not stagger a hunting mourner?
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000, polling: 100 });
  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(0.2, {}, false);
    g.flag('graveyardResolved');
    g.skull.holdNow();
    F.stepWith(0.3, {}, false);
    const M = g.marrow;
    g.player.pos.set(11.8, 0.05, 34.85);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    M.descend();
    F.stepWith(0.3, {}, false);
    g.flag('gotgateKey2');           // arm the hunt directly
    const st0 = M.statues[0];
    st0.position.set(69.03, -5, 0.79);   // the post-dash spot from the regressions flow
    g.player.pos.set(M.origin.x, M.origin.floor, M.origin.z + 13);
    g.player.vel.set(0, 0, 0);
    const dx = st0.position.x - g.player.pos.x, dz = st0.position.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = 0;
    g.player._sync(0);
    const before = st0.position.toArray();
    const trail = [];
    const modeBefore = g.skull.mode;
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
    const modeAfterPress = g.skull.mode;
    for (let i = 0; i < 60; i++) {
      F.step(1 / 120, 1, false);
      if (i % 6 === 0) trail.push({ hold: true, mode: g.skull.mode,
        sd: +Math.hypot(g.skull.pos.x - st0.position.x, g.skull.pos.z - st0.position.z).toFixed(2),
        sy: +g.skull.pos.y.toFixed(2), stagger: +(st0.userData.stagger || 0).toFixed(2) });
    }
    F.stepWith(1 / 120, { throwReleased: true });
    trail.push({ modeBefore, modeAfterPress });
    for (let i = 0; i < 240; i++) {
      F.step(1 / 120, 1, false);
      if (i % 6 === 0) {
        trail.push({
          mode: g.skull.mode,
          sd: +Math.hypot(g.skull.pos.x - st0.position.x, g.skull.pos.z - st0.position.z).toFixed(2),
          sy: +g.skull.pos.y.toFixed(2),
          stagger: +(st0.userData.stagger || 0).toFixed(2),
        });
      }
      if (g.skull.mode === 'held' && i > 30) break;
    }
    return { before, after: st0.position.toArray(), floor: M.origin.floor,
      hunting: g.flags.has('gotgateKey2'), inMarrow: M.inMarrow,
      colliderTop: st0.userData.collider ? st0.userData.collider.max.y : null,
      colliderBottom: st0.userData.collider ? st0.userData.collider.min.y : null,
      hitCd: st0.userData.hitCd, act: g.act,
      trail: trail.slice(0, 20) };
  });
  console.log(JSON.stringify(out, null, 1));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

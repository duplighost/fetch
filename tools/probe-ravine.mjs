// probe-ravine.mjs — walk into the ravine on purpose and report what happens:
// does the fall get caught, does death fire, and where does respawn put you?
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true, null, { timeout: 60000, polling: 200 });
  const r = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('forest');
    F.stepWith(0.3);
    const f = g.forest;
    const rs = f.ravineS();
    // put them on the trail just short of the gash, facing along it
    const at = f.posAt(rs - 6);
    f._lastIdx = rs - 6;
    g.player.pos.set(at.x, g.world.groundHeightAt(at.x, at.z, 6), at.z);
    const ahead = f.posAt(rs - 5);
    g.player.yaw = Math.atan2(-(ahead.x - at.x), -(ahead.z - at.z));
    g.player._sync(0);
    g.enemies.clear();

    const trace = [];
    let deathAt = null;
    for (let i = 0; i < 90; i++) {
      F.stepWith(0.1, { moveZ: 1, run: true }, false);
      const p = g.player.pos;
      if (i % 3 === 0 || (p.y < -3 && trace.length < 40)) {
        trace.push({ t: +(i * 0.1).toFixed(1), y: +p.y.toFixed(2), act: g.act, dead: g.dead, grounded: g.player.grounded });
      }
      if (g.dead && deathAt === null) deathAt = { t: +(i * 0.1).toFixed(1), y: +p.y.toFixed(2), act: g.act };
      if (p.y < -60) break;
    }
    const low = Math.min(...trace.map((x) => x.y));
    const before = { ...g.player.pos };
    g.director.respawn();
    F.stepWith(0.4, {}, false);
    const rp = g.player.pos;
    const proj = f.project(rp.x, rp.z);
    // is the respawn point actually ON the trail, or inside the wall of trees?
    const lat = proj ? Math.hypot(rp.x - f.posAt(proj.s).x, rp.z - f.posAt(proj.s).z) : null;
    return {
      ravineS: rs, lowestY: +low.toFixed(2), deathAt, finalDead: g.dead,
      trace: trace.filter((x) => x.y < 0.5).slice(0, 14),
      respawn: { x: +rp.x.toFixed(1), y: +rp.y.toFixed(2), z: +rp.z.toFixed(1), act: g.act,
        s: proj ? +proj.s.toFixed(1) : null, lateralOffTrail: lat != null ? +lat.toFixed(2) : null,
        halfW: proj ? +f.halfW[Math.round(proj.s)].toFixed(2) : null },
      sealS: +f.sealS.toFixed(1),
    };
  });
  console.log(JSON.stringify(r, null, 1));
  if (errors.length) console.log('ERRORS:', errors.join(' | '));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

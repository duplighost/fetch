// probe-ossuary.mjs -- Alex's undercroft notes, looked at rather than reasoned
// about. Now covers the whole district end to end: the arrival, the kennel
// pocket, the resonant niches, the counterweight, the shaft climb with its
// chained hatch (pre and post solve), the platform under the open lid, and
// the forest-side arrival mouth. Solves the counterweight for real (throw,
// anchor, hold), CLIMBS out by input and USES the mouth's E-verb at the top
// (walking onto the platform no longer exits), then reports what it proved.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });
const grab = async (name, fn, arg) => {
  const url = await page.evaluate(fn, arg);
  writeFileSync(`tests/shots/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote tests/shots/' + name + '.png');
};
// posed shot: runs IN the browser with the pose passed as data — a closure
// over Node-side variables would not survive page.evaluate serialization
const posedShot = ([x, y, z, yaw, pitch]) => {
  const g = window.__game, F = window.__FETCH;
  g.player.pos.set(x, y, z);
  g.player.yaw = yaw; g.player.pitch = pitch;
  g.player.vel.set(0, 0, 0); g.player._sync(0);
  F.stepWith(0.25, {}); g.render();
  return g.renderer.domElement.toDataURL('image/png');
};
await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  F.start(); F.teleport('graveyard'); F.stepWith(0.4, {});
  g.ossuary.unlock('probe');
  // walk onto the stair throat the way the player does
  const m = g.ritualMausoleum;
  g.player.pos.set(m.x, 0.04, m.z + 0.4); g.player._sync(0);
  F.stepWith(0.5, {});
});
await grab('ossuary-arrival', () => {
  const g = window.__game; window.__FETCH.stepWith(0.2, {}); g.render();
  return g.renderer.domElement.toDataURL('image/png');
});
const O = await page.evaluate(() => {
  const s = window.__game.ossuary.origin;
  return { x: s.x, z: s.z, floor: s.floor };
});
// the kennel pocket: bars, cradle, shuttered gap, seam
await grab('ossuary-kennel', posedShot, [O.x - 2.5, O.floor, O.z + 12, Math.PI / 2, 0.03]);
// the niches, wearing whatever the surface graves wear right now
await grab('ossuary-niches', posedShot, [O.x + 3.4, O.floor, O.z + 19, -Math.PI / 2, 0.04]);
// the mechanism, mounted to its wall
await grab('ossuary-mechanism', posedShot, [O.x - 0.4, O.floor, O.z + 22.6, Math.PI, 0.02]);
// the sealed shaft from the corridor: slab shut, faint seam of glow past it
await grab('ossuary-shaft-sealed', posedShot, [O.x, O.floor, O.z + 25.6, Math.PI, 0.12]);
// solve the kennel for real (throw through the bars, hold), then look at
// what the shutter was hiding
const kennelSolved = await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  const p = g.player;
  const O2 = g.ossuary.origin;
  p.pos.set(O2.x - 2.6, O2.floor, O2.z + 12);
  const dx = (O2.x - 4.75) - p.pos.x, dz = 0;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2((O2.floor + 1.02) - (p.pos.y + 1.62), Math.hypot(dx, dz));
  p._sync(0);
  F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
  for (let k = 0; k < 150 && g.skull.mode !== 'anchored'; k++) F.stepWith(1 / 60, { throwHeld: true });
  F.stepWith(1.5, { throwHeld: true });
  F.stepWith(1 / 120, { throwReleased: true });
  for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {});
  F.stepWith(1.2, {});
  return { solved: g.ossuaryKennel.solved, flag: g.flags.has('ossuaryKennelSolved') };
});
console.log('kennel:', JSON.stringify(kennelSolved));
await grab('ossuary-kennel-open', posedShot, [O.x - 3.1, O.floor, O.z + 12, Math.PI / 2, 0.02]);
// solve the counterweight the real way: throw, anchor, hold, release
const solved = await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  const p = g.player;
  p.pos.set(-70, g.ossuary.origin.floor, g.ossuary.origin.z + 25.0);
  const ax = -70, ay = g.ossuary.origin.floor + 2.85 * 0.47, az = g.ossuary.origin.z + 26.25;
  const dx = ax - p.pos.x, dz = az - p.pos.z;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2(ay - (p.pos.y + 1.62), Math.hypot(dx, dz));
  p._sync(0);
  F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
  for (let k = 0; k < 150 && g.skull.mode !== 'anchored'; k++) F.stepWith(1 / 60, { throwHeld: true });
  const anchored = g.skull.mode === 'anchored';
  F.stepWith(2.0, { throwHeld: true });
  F.stepWith(1 / 120, { throwReleased: true });
  for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.1) F.stepWith(0.1, {});
  for (let t = 0; t < 4 && g.ossuary.exitT < 0.985; t += 0.1) F.stepWith(0.1, {});
  return {
    anchored, solved: g.ossuary.solved,
    exitT: +g.ossuary.exitT.toFixed(3),
    residentResting: !g.enemies.list.some((e) => e.ossuaryResident && e.state !== 'dying'),
  };
});
console.log('solve:', JSON.stringify(solved));
// the open way: slab gone, stairs up, lit mouth in the deck
await grab('ossuary-shaft-open', posedShot, [O.x, O.floor, O.z + 26.4, Math.PI, 0.14]);
// mid-climb on flight A, looking up at the turn
await grab('ossuary-climb', posedShot, [O.x + 1.75, O.floor + 1.2, O.z + 31.6, Math.PI, 0.3]);
// the platform under the open lid, chains fallen
const top = await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  // climb the last flight by input so the shot is a reachable pose, then aim
  // at the mouth and press E for real — the exit is an interact verb now, and
  // this tool exists to prove the route a player actually has
  const OX = g.ossuary.origin.x, OZ = g.ossuary.origin.z;
  const atTop = () => g.player.pos.y > g.ossuary.origin.floor + 3.05
    && g.player.pos.x < OX - 2.0 && g.player.pos.z > OZ + 33.9;
  for (let t = 0; t < 10 && !atTop(); t += 0.1) {
    const target = g.player.pos.z < OZ + 33.0 ? [OX + 1.75, OZ + 33.6] : [OX - 2.45, OZ + 34.65];
    const dx = target[0] - g.player.pos.x, dz = target[1] - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    F.stepWith(0.1, { moveZ: 1 });
  }
  if (!g.flags.has('ossuaryExited') && atTop()) {
    const mx = OX - 2.45, mz = OZ + 34.75;
    const my = g.ossuary.origin.floor + 5.43;
    const dx = mx - g.player.pos.x, dz = mz - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.max(-1.15, Math.min(1.15,
      Math.atan2(my - (g.player.pos.y + 1.62), Math.hypot(dx, dz) || 0.001)));
    g.player._sync(0);
    F.stepWith(1 / 120, { interactPressed: true });
    F.stepWith(0.3, {});
  }
  return {
    exited: g.flags.has('ossuaryExited'),
    act: g.act,
    pos: g.player.pos.toArray().map((v) => +v.toFixed(2)),
  };
});
console.log('climb:', JSON.stringify(top));
// the forest-side mouth the player came out of
await grab('ossuary-arrival-hatch', () => {
  const g = window.__game, F = window.__FETCH;
  g.player.yaw = 0; g.player.pitch = 0.28; g.player._sync(0);
  F.stepWith(0.2, {}); g.render();
  return g.renderer.domElement.toDataURL('image/png');
});
const verdict = solved.anchored && solved.solved && solved.exitT > 0.98
  && top.exited && top.act === 'forest' && kennelSolved.solved;
console.log(verdict ? 'OSSUARY ROUTE COMPLETE: entry, kennel, niches, solve, climb, arrival'
  : 'OSSUARY PROBE INCOMPLETE');
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
await browser.close(); server.stop();
process.exit(verdict && !errors.length ? 0 : 1);

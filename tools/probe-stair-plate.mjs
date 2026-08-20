// probe-stair-plate.mjs -- can the works plate on the stair door actually be
// read from where a player first meets it?
//
// His idea, and a sound one: a "no furnace" glyph on the one door every player
// must stand in front of and fail to open. But this project's recurring failure
// is the thing that works and cannot be seen, and that stairwell is unlit. A
// dark plate on a dark door is nothing. So: the round-ten method — toggle it
// off, re-render the SAME settled pose, and measure share-of-frame and CONTRAST
// (either direction; a silhouette reads as well as a lamp).
//
//   node tools/probe-stair-plate.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });

const out = await page.evaluate(() => {
  const F = window.__FETCH, g = window.__game;
  const door = g.world.doorById.stairDoor;
  const plates = [];
  door.panel.traverse((o) => { if (o.name === 'stair door works plate') plates.push(o); });

  const grab = () => {
    const c = g.renderer.domElement;
    const cv = document.createElement('canvas');
    cv.width = c.width; cv.height = c.height;
    const cx = cv.getContext('2d');
    cx.drawImage(c, 0, 0);
    return cx.getImageData(0, 0, cv.width, cv.height).data;
  };
  const same = (a, b) => { for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i]) return false; return true; };
  const settle = () => {
    g._shake = 0; g.fovKick = 0;
    let prev = null;
    for (let i = 0; i < 10; i++) { g.render(); const now = grab(); if (prev && same(prev, now)) return now; prev = now; }
    return prev;
  };

  F.start();
  F.teleport('house');
  g.skull.holdNow();

  // stand on the landing facing the shut stair door, the way he would
  const dp = door.panel.getWorldPosition(new (g.player.pos.constructor)());
  const read = (label, dist) => {
    const x = dp.x, z = dp.z + dist;
    // STAND ON THE DOOR'S OWN STOREY. groundHeightAt with a hint of 3 resolves
    // the highest floor at or BELOW it, which is the ground floor — the first
    // cut of this probe put the player a storey down and photographed a
    // ceiling. door.floor is the number that cannot be wrong.
    g.player.pos.set(x, door.floor + 0.02, z);
    g.player.yaw = Math.atan2(-(dp.x - x), -(dp.z - z));
    g.player.pitch = Math.atan2(dp.y - (door.floor + 1.62), Math.abs(dist));
    g.player._sync(0);
    F.stepWith(0.05, {}, false);
    const on = settle();
    const was = plates.map((p) => p.visible);
    plates.forEach((p) => { p.visible = false; });
    const off = settle();
    plates.forEach((p, i) => { p.visible = was[i]; });
    let changed = 0, sumOn = 0, sumOff = 0, n = 0;
    for (let i = 0; i < on.length; i += 4) {
      const lOn = on[i] * 0.2126 + on[i + 1] * 0.7152 + on[i + 2] * 0.0722;
      const lOff = off[i] * 0.2126 + off[i + 1] * 0.7152 + off[i + 2] * 0.0722;
      if (Math.abs(lOn - lOff) > 4) { changed++; sumOn += lOn; sumOff += lOff; n++; }
    }
    const ratio = n ? sumOn / Math.max(1, sumOff) : 1;
    return {
      label, dist,
      pctChanged: +(100 * changed / (on.length / 4)).toFixed(3),
      ratio: +ratio.toFixed(2),
      contrast: +Math.max(ratio, 1 / Math.max(ratio, 1e-6)).toFixed(2),
    };
  };

  const rows = [read('right at the door', 1.1), read('across the landing', 2.6), read('from the bedroom door', 4.2)];
  for (let i = 0; i < 3; i++) g.render();
  const shot = g.renderer.domElement.toDataURL('image/png');
  return { plates: plates.length, doorLocked: door.locked, rows, shot };
});

await browser.close();
server.stop();
console.log(`plates mounted: ${out.plates}   door locked with: ${out.doorLocked}`);
for (const r of out.rows) {
  console.log(`  ${r.label.padEnd(24)} ${String(r.dist).padStart(4)} m   ${String(r.pctChanged).padStart(6)}% of frame   ${String(r.contrast).padStart(6)}x contrast  (ratio ${r.ratio})`);
}
writeFileSync(shotPath('stair-plate'), Buffer.from(out.shot.split(',')[1], 'base64'));
console.log('shot: ' + shotPath('stair-plate'));
if (errors.length) console.log('errors: ' + errors.slice(0, 4).join(' | '));

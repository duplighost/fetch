// probe-basement-fixes.mjs -- look at the two basement repairs Alex asked for:
// the planks that stayed standing in the cellar doorway after he opened it,
// and the furnace that "never shows the fire".
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });
const grab = async (name, fn) => {
  const url = await page.evaluate(fn);
  writeFileSync(`tests/shots/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote tests/shots/' + name + '.png');
};

await grab('fix-boards', () => {
  const g = window.__game, F = window.__FETCH;
  F.start(); F.stepWith(0.3, {});
  // break all three planks the way the game does, then let them settle
  for (const b of g.boards) if (!b.userData.off) g.detachBoard(b);
  F.stepWith(3.0, {});
  const d = g.world.doorById.cellarDoor;
  d.locked = null; d.setOpen(true);
  F.stepWith(1.2, {});
  const p = d.group.position;
  const by = g.world.groundHeightAt(p.x + 0.6, p.z - 2.6, 2);
  g.player.pos.set(p.x + 0.6, by, p.z - 2.6);
  g.player.yaw = Math.PI; g.player.pitch = -0.30; g.player._sync(0);
  F.stepWith(0.1, {}); g.render();
  return g.renderer.domElement.toDataURL('image/png');
});

await grab('fix-firebox', () => {
  const g = window.__game, F = window.__FETCH;
  F.teleport('basement'); F.stepWith(0.4, {});
  g.flag('ateFlame'); g.flag('pumpGalleryLatched');
  g.incinerator.doorOpen = true;
  F.stepWith(4.0, {});                     // wake + door swing + fire ramp
  const p = g.incineratorPosition;
  const fy = g.world.groundHeightAt(p.x - 1.7, p.z + 0.75, p.y + 1);
  g.player.pos.set(p.x - 1.7, fy, p.z + 0.75);
  g.player.yaw = -Math.PI / 2 - 0.34; g.player.pitch = -0.02; g.player._sync(0);
  F.stepWith(0.1, {}); g.render();
  return g.renderer.domElement.toDataURL('image/png');
});
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
await browser.close(); server.stop();

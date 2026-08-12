// probe-ossuary.mjs -- Alex's undercroft notes, looked at rather than reasoned
// about: the arrival ("opens up to you facing a wall"), the counterweight
// ("attactch to wall with another piece"), and the far end.
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
await grab('ossuary-mechanism', () => {
  const g = window.__game, F = window.__FETCH;
  const mech = g.scene.getObjectByName('ossuary gate counterweight');
  const p = mech.position.clone();  // mechanism is parented to routeRoot at origin
  g.player.pos.set(p.x - 0.4, -4.2, p.z - 3.6);
  g.player.yaw = Math.PI; g.player.pitch = 0.02; g.player._sync(0);
  F.stepWith(0.2, {}); g.render();
  return g.renderer.domElement.toDataURL('image/png');
});
console.log('inOssuary:', await page.evaluate(() => window.__game.ossuary.inOssuary));
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
await browser.close(); server.stop();

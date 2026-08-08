// shot-forest.mjs — walk into the forest and capture what the corridor looks
// like from inside it, plus a look back at the seal.
//   node tools/shot-forest.mjs <outPrefix> [walkFrames]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const [prefix = 'scratch-sculpts/out-forest/forest', walk = '260'] = process.argv.slice(2);
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true, null, { timeout: 60000, polling: 200 });
  const shots = await page.evaluate(async (walkFrames) => {
    const F = window.__FETCH, g = window.__game;
    const out = {};
    F.start();
    F.teleport('forest');
    await F.step(1 / 60, 5);
    // walk in
    await F.stepWith({ forward: 1 }, 1 / 60, walkFrames);
    await F.step(1 / 60, 4);
    g.render();
    out.ahead = g.renderer.domElement.toDataURL('image/png');
    // and turn around: the seal should be a wall, not a picket line
    g.player.yaw += Math.PI;
    await F.step(1 / 60, 4);
    g.render();
    out.back = g.renderer.domElement.toDataURL('image/png');
    g.player.yaw -= Math.PI;
    g.player.pitch = 0.55;                       // look up: is there a sky left?
    await F.step(1 / 60, 4);
    g.render();
    out.up = g.renderer.domElement.toDataURL('image/png');
    out.render = JSON.stringify(g.lastRender);
    return out;
  }, +walk);
  for (const k of ['ahead', 'back', 'up']) {
    writeFileSync(`${prefix}-${k}.png`, Buffer.from(shots[k].split(',')[1], 'base64'));
  }
  console.log('wrote', prefix, shots.render, errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
  process.exit(errors.length ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

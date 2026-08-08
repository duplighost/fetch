// shot-room.mjs — boot the game, place the player, capture what they see.
//   node tools/shot-room.mjs <act> <x> <y> <z> <yaw> <pitch> <outPng>
// yaw: forward = (-sin yaw, -cos yaw)  =>  +x: -PI/2, -x: PI/2, -z: 0, +z: PI
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const [act, x, y, z, yaw, pitch, out] = process.argv.slice(2);
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true, null, { timeout: 60000, polling: 200 });
  const dataUrl = await page.evaluate(async ([act, x, y, z, yaw, pitch]) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport(act);
    await F.step(1 / 60, 5);
    g.player.pos.set(x, y, z);
    g.player.yaw = yaw; g.player.pitch = pitch;
    g.player.vel && g.player.vel.set(0, 0, 0);
    await F.step(1 / 60, 10);
    g.render();
    return g.renderer.domElement.toDataURL('image/png');
  }, [act, +x, +y, +z, +yaw, +pitch]);
  writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', out, errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
  process.exit(errors.length ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

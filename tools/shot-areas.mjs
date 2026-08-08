// shot-areas.mjs — one look at every act, from the spawn: forward, turned 120,
// turned 240, and straight up. The cheap way to see what the whole game looks
// like in one pass.  node tools/shot-areas.mjs <outDir>
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'scratch-sculpts/out-areas';
const ACTS = ['graveyard', 'forest', 'clearing', 'cave', 'mirror'];
mkdirSync(out, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true, null, { timeout: 60000, polling: 200 });
  for (const act of ACTS) {
    const shots = await page.evaluate(async (a) => {
      const F = window.__FETCH, g = window.__game;
      F.start();
      F.stepWith(2.5);            // let the wake-up tilt finish before we look anywhere
      F.teleport(a);
      F.stepWith(0.6);
      F.stepWith(2.2, { moveZ: 1 });          // a couple of steps in, not on the spawn pad
      const o = {};
      const grab = (name, yaw, pitch) => {
        g.player.yaw = yaw; g.player.pitch = pitch;
        F.stepWith(0.06);
        g.render();
        o[name] = g.renderer.domElement.toDataURL('image/png');
      };
      const y0 = g.player.yaw;
      grab('fwd', y0, 0);
      grab('left', y0 + 2.09, 0);
      grab('right', y0 - 2.09, 0);
      grab('up', y0, 0.8);
      o.render = JSON.stringify(g.lastRender);
      return o;
    }, act);
    for (const k of ['fwd', 'left', 'right', 'up']) {
      writeFileSync(join(out, `${act}-${k}.png`), Buffer.from(shots[k].split(',')[1], 'base64'));
    }
    console.log(act, shots.render);
  }
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

// Real-GPU visual proof for the throw tether and the ordinary catch settle.
// Writes ignored evidence frames under tests/shots/ and reports finite state.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve('tests/shots');
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
let failed = false;

async function capture(page, name) {
  const dataUrl = await page.evaluate(() => {
    window.__game.render();
    return window.__game.renderer.domElement.toDataURL('image/png');
  });
  const path = resolve(outDir, name);
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return path;
}

try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, {
    width: 1280,
    height: 800,
  });
  await page.waitForFunction(() => window.__FETCH?.ready && window.__game, null, {
    timeout: 60000,
    polling: 100,
  });

  await page.evaluate(() => {
    const F = window.__FETCH;
    F.start();
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.24, { throwHeld: true }, false);
  });
  const tetherPath = await capture(page, 'probe-skull-tether.png');
  const tether = await page.evaluate(() => {
    const s = window.__game.skull;
    const p = Array.from(s.tether.geometry.getAttribute('position').array);
    return {
      mode: s.mode,
      visible: s.tether.visible,
      opacity: s.tether.material.opacity,
      points: p.length / 3,
      finite: p.every(Number.isFinite),
      drawCalls: window.__game.lastRender.drawCalls,
    };
  });

  await page.evaluate(() => {
    const F = window.__FETCH;
    F.stepWith(1 / 120, { throwReleased: true }, false);
    for (let i = 0; i < 300 && window.__game.skull.mode !== 'held'; i++) {
      F.stepWith(1 / 120, {}, false);
    }
  });
  const catchPath = await capture(page, 'probe-skull-catch-settle.png');
  const caught = await page.evaluate(() => {
    const s = window.__game.skull;
    return {
      mode: s.mode,
      settleActive: !!s._catchFx,
      settle: s._catchFx ? { t: s._catchFx.t, dur: s._catchFx.dur } : null,
      grip: s._grip,
      tetherVisible: s.tether.visible,
      root: s.root.position.toArray(),
      drawCalls: window.__game.lastRender.drawCalls,
    };
  });

  const checks = {
    tether: ['outbound', 'poised', 'returning', 'anchored'].includes(tether.mode)
      && tether.visible && tether.opacity > 0
      && tether.finite && tether.drawCalls < 700,
    catch: caught.mode === 'held' && caught.settleActive && caught.grip < 0.2
      && !caught.tetherVisible && caught.drawCalls < 700,
    errors: errors.length === 0,
  };
  failed = !Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ checks, tether, caught, errors, captures: {
    tether: tetherPath,
    catch: catchPath,
  } }, null, 2));
} catch (error) {
  failed = true;
  console.error(error && (error.stack || error.message) || String(error));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(failed ? 1 : 0);

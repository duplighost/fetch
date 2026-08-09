// Real-GPU visual plates for the house/basement expansion. Mechanics are
// exercised by tests/house-expansion.mjs; this probe freezes those proven
// states so parallel gate runs cannot overwrite the images while they are being
// judged. The carried light remains active, but camera layer 2 (viewmodel) is
// omitted from the one captured frame.
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let page;
let pageErrors = [];
const boilerOnly = process.argv.includes('--boiler-only');

async function pose({ x, y, z, yaw, pitch = 0 }) {
  await page.evaluate((p) => {
    const g = window.__game;
    g.player.pos.set(p.x, p.y, p.z);
    g.player.yaw = p.yaw;
    g.player.pitch = p.pitch;
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    g._shake = 0;
    g.fovKick = 0;
    g.camera.fov = 71;
    g.camera.updateProjectionMatrix();
    // Let one real fixed-step propagate sector visibility, light ownership,
    // and other position-driven presentation before freezing the plate.
    window.__FETCH.stepWith(1 / 60, {}, false);
  }, { x, y, z, yaw, pitch });
}

async function shot(name, { includeViewmodel = false } = {}) {
  const data = await page.evaluate((showHeld) => {
    const g = window.__game;
    const mask = g.camera.layers.mask;
    if (!showHeld) g.camera.layers.disable(2);
    g.render();
    g.render();
    const png = g.renderer.domElement.toDataURL('image/png');
    g.camera.layers.mask = mask;
    return { png, render: g.lastRender };
  }, includeViewmodel);
  writeFileSync(shotPath(name), Buffer.from(data.png.split(',')[1], 'base64'));
  console.log(`${name}: ${JSON.stringify(data.render)}`);
}

try {
  const opened = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  page = opened.page;
  pageErrors = opened.errors;
  await page.waitForFunction(() => window.__FETCH?.ready && window.__game,
    null, { timeout: 60000, polling: 100 });
  if (opened.errors.length) throw new Error(opened.errors.join('\n'));
  if (boilerOnly) {
    await page.evaluate(() => {
      const F = window.__FETCH, g = window.__game;
      F.start();
      F.teleport('basement');
      g.enemies.list.length = 0;
      g.skull.holdNow();
    });
    await pose({ x: 9, y: -3, z: -4.2, yaw: 0, pitch: 0.44 });
    await shot('probe-house-boiler-flue.png');
    await pose({ x: 9, y: -3, z: -4.2, yaw: 0, pitch: 0.24 });
    await shot('probe-house-boiler-player-view.png', { includeViewmodel: true });
  } else {
    await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.list.length = 0;
    for (const d of g.world.doors) if (!d.locked) { d.setOpen(true); d.update(5); }
    // Visual-only solved state: the real route is proved separately by an
    // outbound clamp, continuous held traversal, and ordinary release flight.
    g.windowRelay.solved = true;
    g.windowRelay.state = 'rung';
    g.windowRelay.backplate.visible = false;
    g.windowRelay.plateCollider.min.y = -20;
    g.windowRelay.plateCollider.max.y = -19;
  });
  await pose({ x: -9.35, y: 0, z: 1, yaw: Math.PI / 2, pitch: 0.015 });
  await shot('probe-house-window-bell.png');

  await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    g.houseMirror.awakened = true;
    g.houseMirror.relay = true;
    g.player.pos.set(-1.8, 0, -11.25);
    g.player.yaw = Math.PI / 2;
    g.player.pitch = 0;
    g.player._sync(0);
    F.stepWith(1.35, {}, false);
  });
  await pose({ x: -1.55, y: 0, z: -11.25, yaw: Math.PI / 2 });
  await shot('probe-house-lag-mirror.png');

  await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.teleport('basement');
    g.enemies.list.length = 0;
    g.pumpGallery.latched = true;
    g.pumpGallery.progress = 1;
    g.pumpGallery.state = 'latched';
    F.stepWith(0.25, {}, false);
  });
  await pose({ x: -18.45, y: -3, z: -3, yaw: -Math.PI / 2, pitch: -0.06 });
  await shot('probe-house-pump-bridge.png');
  await pose({ x: -17.1, y: -3, z: 3.25, yaw: Math.PI, pitch: -0.03 });
  await shot('probe-house-pump-archive.png');
  await pose({ x: 9, y: -3, z: -4.2, yaw: 0, pitch: 0.44 });
  await shot('probe-house-boiler-flue.png');
  await pose({ x: 9, y: -3, z: -4.2, yaw: 0, pitch: 0.24 });
  await shot('probe-house-boiler-player-view.png', { includeViewmodel: true });
  }
  if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`);
} finally {
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  server.stop();
}

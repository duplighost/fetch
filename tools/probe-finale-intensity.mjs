// Truthful real-GPU plates for the finale's playable approach, crush, contact,
// and last pre-black image. Unlike a bare mirror teleport, this preserves the
// waterfall's broken promise: the skull is gone and only the empty hands remain.
// Every plate also clears cosmetic shake/FOV kick so composition defects cannot
// hide inside an automated-camera artifact.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] || 'scratch-finale-intensity';
mkdirSync(outDir, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();
let page;

try {
  const opened = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  page = opened.page;
  await page.waitForFunction(() => window.__FETCH?.ready && window.__game,
    null, { timeout: 60000, polling: 100 });
  if (opened.errors.length) throw new Error(opened.errors.join('\n'));

  const result = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    const frames = {};
    const states = {};
    const capture = (name) => {
      g._shake = 0;
      g.fovKick = 0;
      g.camera.fov = 71;
      g.camera.updateProjectionMatrix();
      g.player._sync(0);
      g.render();
      g.render();
      const figureMin = g.camera.position.clone().set(Infinity, Infinity, Infinity);
      const figureMax = g.camera.position.clone().set(-Infinity, -Infinity, -Infinity);
      g.finale.figure.updateMatrixWorld(true);
      g.finale.figure.traverse((object) => {
        if (!object.isMesh || !object.geometry) return;
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
        figureMin.min(box.min);
        figureMax.max(box.max);
      });
      const h = g.finale.emptyHands;
      states[name] = {
        phase: g.finale.phase,
        t: g.finale.t,
        half: g.finale.half,
        contactT: g.finale.contactT,
        fov: g.camera.fov,
        player: g.player.pos.toArray(),
        yaw: g.player.yaw,
        frozen: g.player.frozen,
        skullMode: g.skull.mode,
        handPressure: g.finale._handPressure,
        hold: h ? {
          position: h.hold.position.toArray(),
          rotation: [h.hold.rotation.x, h.hold.rotation.y, h.hold.rotation.z],
        } : null,
        jaw: g.finale.figure.userData.exactJaw?.rotation.x ?? null,
        figureBounds: {
          min: figureMin.toArray(), max: figureMax.toArray(),
        },
        fadeOpacity: Number.parseFloat(g.el?.fade?.style?.opacity || '0'),
        ended: g.flags.has('ended'),
        render: { ...g.lastRender },
      };
      frames[name] = g.renderer.domElement.toDataURL('image/png');
    };

    F.start();
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('mirror');
    g.player.yaw = Math.PI;
    g.player.pitch = 0;
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);

    F.stepWith(0.4, {}, false);
    capture('01-still');
    F.stepWith(8.45, {}, false);
    capture('02-mirror-reveal');

    let guard = 0;
    while (g.finale.phase === 'closing' && g.finale.half > 1.24 && guard++ < 500) {
      F.stepWith(0.08, {}, false);
    }
    capture('03-crushed-room');

    guard = 0;
    while (g.finale.phase === 'closing' && g.finale.half > 0.58 && guard++ < 500) {
      F.stepWith(0.06, { moveZ: 1, run: true }, false);
    }
    F.stepWith(0.18, { moveZ: 1, run: true }, false);
    capture('04-last-approach');

    guard = 0;
    while (g.finale.phase !== 'contact' && guard++ < 500) {
      F.stepWith(0.04, { moveZ: 1, run: true }, false);
    }
    F.stepWith(0.22, { moveZ: 1, run: true }, false);
    capture('05-contact-early');
    F.stepWith(0.78, { moveZ: 1, run: true }, false);
    capture('06-contact-mid');
    F.stepWith(1.08, { moveZ: 1, run: true, lookX: -0.8 }, false);
    capture('07-last-image');
    const yawBeforeBlack = g.player.yaw;
    F.stepWith(1.3, { lookX: 1.2 }, false);
    states['08-black'] = {
      phase: g.finale.phase,
      fadeOpacity: Number.parseFloat(g.el?.fade?.style?.opacity || '0'),
      frozen: g.player.frozen,
      ended: g.flags.has('ended'),
      yawBeforeBlack,
      yawAfterBlack: g.player.yaw,
    };
    return { frames, states };
  });

  for (const [name, dataUrl] of Object.entries(result.frames)) {
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  delete result.frames;
  const failures = [];
  result.browserErrors = [...opened.errors];
  if (result.browserErrors.length) {
    failures.push(`browser errors: ${result.browserErrors.join(' | ')}`);
  }
  const playableNames = [
    '01-still', '02-mirror-reveal', '03-crushed-room', '04-last-approach',
    '05-contact-early', '06-contact-mid', '07-last-image',
  ];
  for (const name of playableNames) {
    const state = result.states[name];
    if (state.fov !== 71) failures.push(`${name}: FOV drifted to ${state.fov}`);
    if (state.skullMode !== 'gone') failures.push(`${name}: skull mode is ${state.skullMode}`);
    if (state.frozen) failures.push(`${name}: controls froze before hard black`);
  }
  // Contact walls end at 500 +/- 0.37. Permit 2cm for the deliberately rough
  // low-poly skin, but fail the plate if the body crosses a mirror plane.
  const roomMin = 500 - 0.37 - 0.02;
  const roomMax = 500 + 0.37 + 0.02;
  for (const name of ['05-contact-early', '06-contact-mid', '07-last-image']) {
    const { min, max } = result.states[name].figureBounds;
    if (min[0] < roomMin || min[2] < roomMin || max[0] > roomMax || max[2] > roomMax) {
      failures.push(`${name}: reflected body crosses contact walls (${min[0]}, ${min[2]})..(${max[0]}, ${max[2]})`);
    }
  }
  const black = result.states['08-black'];
  if (!black.frozen || black.fadeOpacity < 0.99 || !black.ended) {
    failures.push(`08-black: expected frozen hard black and one ended flag, got ${JSON.stringify(black)}`);
  }
  result.checks = { passed: failures.length === 0, failures };
  writeFileSync(join(outDir, 'states.json'), JSON.stringify(result.states, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  server.stop();
}

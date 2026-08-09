// Focused deterministic finale probe: verifies room ownership, live look input,
// contact performance, and the hard-black ending while saving trustworthy
// WebGL canvas frames (page.screenshot composites this canvas black headless).
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] || 'scratch-codex-pass1';
mkdirSync(outDir, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();

try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 });
  const result = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    const frames = {};
    const shot = (name) => {
      g.render();
      frames[name] = g.renderer.domElement.toDataURL('image/png');
    };
    const state = () => ({
      phase: g.finale.phase,
      half: g.finale.half,
      player: [g.player.pos.x, g.player.pos.y, g.player.pos.z],
      camera: [g.camera.position.x, g.camera.position.y, g.camera.position.z],
      yaw: g.player.yaw,
      jaw: g.finale.figure?.userData?.exactJaw?.rotation?.x ?? null,
      frozen: g.player.frozen,
      ended: g.flags.has('ended'),
      render: { ...g.lastRender },
    });

    F.start();
    F.teleport('mirror');
    F.stepWith(0.4, {}, false);
    shot('finale-still');
    const still = state();

    F.stepWith(17, {}, false);
    shot('finale-closing');
    const closing = state();

    let guard = 0;
    while (g.finale.phase !== 'contact' && g.finale.phase !== 'black'
      && g.finale.phase !== 'end' && guard < 500) {
      F.stepWith(0.1, {}, false);
      guard++;
    }
    F.stepWith(0.95, {}, false);
    shot('finale-contact');
    const contact = state();
    F.stepWith(1 / 120, { lookX: 18, lookY: -4 }, false);
    const contactLookYaw = g.player.yaw;

    F.stepWith(3.4, {}, false);
    const ended = state();
    return { errors: [], frames, still, closing, contact, contactLookYaw, ended, guard };
  });

  for (const [name, dataUrl] of Object.entries(result.frames)) {
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  delete result.frames;
  const ownership = result.still.player[0] > 490 && result.still.player[2] > 490
    && Math.hypot(result.still.camera[0] - result.still.player[0],
      result.still.camera[2] - result.still.player[2]) < 0.2;
  const liveLook = Math.abs(result.contactLookYaw - result.contact.yaw) > 0.001;
  const contactJaw = result.contact.phase === 'contact'
    && Number.isFinite(result.contact.jaw) && result.contact.jaw > 0.25;
  const ended = result.ended.phase === 'end' && result.ended.ended && result.ended.frozen;
  console.log(JSON.stringify({
    browserErrors: errors,
    checks: { ownership, liveLook, contactJaw, ended },
    ...result,
  }, null, 2));
  process.exit(errors.length || !ownership || !liveLook || !contactJaw || !ended ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

// probe-black-quad.mjs -- WHAT is the dark angular shape under the left wrist?
// Alex: "are those black boxes under the hands supposed to be sleeves?"
// Stop guessing: same pose, hide one candidate at a time, and see which
// toggle removes the shape. Writes one frame per state.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'scratch-hands/black-quad';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });
  const shots = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    F.stepWith(1.2, {}, false);
    g.player.pitch = -0.62; g.player._sync(0);
    F.stepWith(0.3, {}, false);
    const out = [];
    const shoot = (name) => {
      F.stepWith(0.1, {}, false);
      g.render(); g.render();
      out.push({ name, png: g.renderer.domElement.toDataURL('image/png') });
    };
    const P = g.skull._handPose;
    const hands = P.hands;
    const fores = P.forearms || [];
    // find the sleeves: cylinder meshes that are direct children of each hand
    const sleeves = [];
    for (const hand of hands) {
      for (const c of hand.children) {
        if (c.isMesh && c.geometry?.type === 'CylinderGeometry') sleeves.push(c);
      }
    }
    shoot('0-all');
    for (const f of fores) f.visible = false;
    shoot('1-no-forearms');
    for (const f of fores) f.visible = true;
    for (const sl of sleeves) sl.visible = false;
    shoot('2-no-sleeves');
    for (const f of fores) f.visible = false;
    shoot('3-neither');
    for (const f of fores) f.visible = true;
    for (const sl of sleeves) sl.visible = true;
    return { out, sleeves: sleeves.length, fores: fores.length };
  });
  for (const s of shots.out) {
    writeFileSync(join(outDir, s.name + '.png'), Buffer.from(s.png.split(',')[1], 'base64'));
    console.log('wrote', s.name);
  }
  console.log('sleeves found:', shots.sleeves, 'forearms:', shots.fores);
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

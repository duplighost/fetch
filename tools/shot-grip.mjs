// shot-grip.mjs -- the GRIP, which is what his note 4 is about: "in this whole
// game, the hands are facing so the palm side is against the skull, so it
// doesn't look like he's holding the skull. its fine after the skull goes and
// we got it right in the last room of the game."
//
// The pose that is right is finale.js's RAISED_L/RAISED_R, and the reason it
// is right is written above them: the +-PI about each hand's own local Z is
// the finger axis, and it turns the hand OVER without mirroring it (mkHand
// puts handedness in the geometry). skull.js's cradle never got that half turn.
//
// Four frames, because a fix that only looks right while cradling is half a
// fix: holding, holding while looking down, mid-throw (the empty pose blends
// from the same constants), and the empty hands with nothing to explain them.
//
//   node tools/shot-grip.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir = 'scratch-hands'] = process.argv.slice(2);
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
    // face the lantern wall: the viewmodel is lit by what the room has
    const out = [];
    const shoot = (name) => {
      F.stepWith(0.15, {}, false);
      g.render();
      out.push({ name, png: g.renderer.domElement.toDataURL('image/png') });
    };
    const aim = (yaw, pitch) => {
      g.player.yaw = yaw; g.player.pitch = pitch;
      g.player._sync(0);
      F.stepWith(0.25, {}, false);
    };
    const yaw0 = g.player.yaw;
    aim(yaw0, -0.08);
    shoot('01-holding');
    aim(yaw0, -0.62);
    shoot('02-holding-looking-down');
    aim(yaw0, -0.30);
    shoot('03-holding-half-down');
    // THE BLEND, sampled directly. cradle -> empty is one interpolation of six
    // numbers, and a big turn hidden inside it would only show for a third of
    // a second during a throw — exactly the kind of thing this project ships
    // without noticing. Driving _applyHandPose is the honest way to see it.
    aim(yaw0, -0.30);
    for (const t of [0.25, 0.5, 0.75, 1]) {
      g.skull._applyHandPose(t, 0);
      g.render();
      out.push({ name: '04-blend-' + String(t).replace('.', 'p'), png: g.renderer.domElement.toDataURL('image/png') });
    }
    // and then the real input path, never a poke at internals
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(1.2, { throwHeld: true }, false);
    g.render();
    out.push({ name: '05-empty-mode-' + g.skull.mode, png: g.renderer.domElement.toDataURL('image/png') });
    aim(yaw0, -0.62);
    shoot('06-empty-looking-down');
    return out;
  });

  for (const s of shots) {
    const file = join(outDir, `${s.name}.png`);
    writeFileSync(file, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log('wrote', file);
  }
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

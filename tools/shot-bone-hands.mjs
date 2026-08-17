// "In the final room of the game, have the player raise their hands earlier.
// they must be actually bones like a skeleton. right now they don't look like
// that." Four frames: flesh (what he saw), bone raised, the glass press that
// is finally visible, and the last contact beat.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'scratch-hands';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    const shots = [];
    const shoot = (name) => { g.render(); shots.push({ name, png: g.renderer.domElement.toDataURL('image/png') }); };
    F.start();
    F.stepWith(0.6, {}, false);

    // 1. the hands as they are for the whole game, cradling
    F.stepWith(0.4, {}, false);
    shoot('01-flesh-cradle');

    // 2. into the last room, and forward to the beat the mirrors wake
    F.teleport('cave');
    g.skull.vanish();
    F.stepWith(0.3, {}, false);
    g.director.enterMirrorRoom();
    for (let i = 0; i < 90 && g.finale?.phase !== 'closing'; i++) F.stepWith(0.2, {}, false);
    F.stepWith(1.4, {}, false);
    const atClosing = {
      phase: g.finale.phase, raise: g.skull._handRaise, bone: g.skull._handsBone,
      boneVisible: (g.skull._handBone || []).filter((m) => m.visible).length,
      fleshVisible: (g.skull._handFlesh || []).filter((m) => m.visible).length,
      handsVisible: (g.skull._handPose?.hands || []).some((h) => h.visible),
      half: +g.finale.half.toFixed(2),
    };
    shoot('02-bone-raised-at-the-closing');

    // 3. let the walls come in until the palms are on the glass
    for (let i = 0; i < 300 && g.finale.half > 1.1; i++) F.stepWith(0.25, {}, false);
    shoot('03-palms-on-the-glass');
    for (let i = 0; i < 400 && g.finale.phase !== 'contact' && g.finale.phase !== 'end'; i++) {
      F.stepWith(0.25, {}, false);
    }
    F.stepWith(0.5, {}, false);
    shoot('04-contact');

    return { shots, atClosing, endPhase: g.finale.phase, half: +g.finale.half.toFixed(2) };
  });
  for (const s of out.shots) {
    writeFileSync(join(outDir, `${s.name}.png`), Buffer.from(s.png.split(',')[1], 'base64'));
  }
  console.log('wrote', out.shots.length, 'shots to', outDir);
  console.log(JSON.stringify({ atClosing: out.atClosing, endPhase: out.endPhase, half: out.half }, null, 1));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close();
  server.stop();
}

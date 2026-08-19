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
    // WHICH WAY ROUND ARE THEY? The hold group hangs off the CAMERA, so the
    // hand's orientation in camera space is just hold.quaternion * hand.quaternion
    // (Euler and quaternion stay linked in three, so both are current). The
    // hand's own axes: +Y is the DORSUM (back of the hand — mkHand flattens the
    // palm sphere so its normal is local ±Y) and +Z is the FINGER direction.
    // Alex's read — "they need to be rotated the other way so they look like
    // they're coming from the player" — is: backs of the hands toward the lens
    // (dorsal.z > 0) and fingertips up (fingers.y > 0). Rolled 180 deg about
    // the finger axis, both came out flat: dorsal.z ~ -0.04, fingers.y ~ +0.06.
    const orient = () => (g.skull._handPose?.hands || []).map((hand) => {
      const rel = g.skull.hold.quaternion.clone().multiply(hand.quaternion);
      const d = g.player.pos.clone().set(0, 1, 0).applyQuaternion(rel);
      const f = g.player.pos.clone().set(0, 0, 1).applyQuaternion(rel);
      return { dorsalZ: +d.z.toFixed(3), fingersY: +f.y.toFixed(3) };
    });
    const atClosing = {
      phase: g.finale.phase, raise: g.skull._handRaise, bone: g.skull._handsBone,
      boneVisible: (g.skull._handBone || []).filter((m) => m.visible).length,
      fleshVisible: (g.skull._handFlesh || []).filter((m) => m.visible).length,
      handsVisible: (g.skull._handPose?.hands || []).some((h) => h.visible),
      half: +g.finale.half.toFixed(2),
      orientation: orient(),
      // THE SCOPING PROOF, structural rather than eyeballed: the viewmodel sits
      // on LAYER_HELD and every mirror's reflect mask omits it, so nothing the
      // finale does to these hands can reach the glass. The hands in the mirror
      // are the reflection body's own, built separately on LAYER_DOUBLE.
      mirrorSeesViewmodel: (g.finale.mirrors?.list || g.finale.mirrors?.mirrors || [])
        .some((m) => ((m.reflectMask ?? 0) & (1 << 2)) !== 0),
    };
    shoot('02-bone-raised-at-the-closing');

    // 3. let the walls come in until the palms are on the glass
    for (let i = 0; i < 300 && g.finale.half > 1.1; i++) F.stepWith(0.25, {}, false);
    const atPress = orient();
    shoot('03-palms-on-the-glass');
    for (let i = 0; i < 400 && g.finale.phase !== 'contact' && g.finale.phase !== 'end'; i++) {
      F.stepWith(0.25, {}, false);
    }
    F.stepWith(0.5, {}, false);
    shoot('04-contact');

    return { shots, atClosing, atPress, endPhase: g.finale.phase, half: +g.finale.half.toFixed(2) };
  });
  for (const s of out.shots) {
    writeFileSync(join(outDir, `${s.name}.png`), Buffer.from(s.png.split(',')[1], 'base64'));
  }
  console.log('wrote', out.shots.length, 'shots to', outDir);
  console.log(JSON.stringify({ atClosing: out.atClosing, atPress: out.atPress,
    endPhase: out.endPhase, half: out.half }, null, 1));
  const ok = (rows) => rows.every((r) => r.dorsalZ > 0.6 && r.fingersY > 0.5);
  console.log(`${ok(out.atClosing.orientation) ? 'PASS' : 'FAIL'} raised: backs of the hands to the lens, fingers up`);
  console.log(`${ok(out.atPress) ? 'PASS' : 'FAIL'} pressed: the roll holds through the press (no spin-through)`);
  console.log(`${out.atClosing.mirrorSeesViewmodel === false ? 'PASS' : 'FAIL'} the mirrors cannot see the viewmodel`);
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close();
  server.stop();
}

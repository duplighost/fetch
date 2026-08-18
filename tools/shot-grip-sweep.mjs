// shot-grip-sweep.mjs -- solve the held grip by AIMING it, not by guessing
// Euler angles.
//
// His note 4: "the hands are facing so the palm side is against the skull, so
// it doesn't look like he's holding the skull." The reference image he posted
// is the target: fingers wrapped round the skull's SIDES, BACKS of the fingers
// to the camera, thumbs behind.
//
// Two facts about mkHand make this solvable directly:
//   - the fingers grow along the hand's local +Z, so +Z is the finger axis;
//   - the palm is the thin axis, and the fingers curl toward local +Y, so +Y
//     is the palm normal — which is why rolling PI about Z alone turns the
//     hand over AND inverts the curl, and the first attempt put both hands
//     below the bottom of the frame.
// And one about _applyHandPose: it applies (rx, -side*ry, -side*rz), so for the
// LEFT hand (side -1) the stored numbers ARE the applied Euler XYZ. Aim the
// left hand and read the constants straight off it.
//
//   node tools/shot-grip-sweep.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir = 'scratch-hands/sweep'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

// finger = where the fingers point, palm = which way the palm faces, both in
// the held rig's space (x right, y up, z toward the viewer).
// palm INWARD (+x, toward the skull) is the whole idea: the hand at the
// skull's left with its palm facing right shows the camera its BACK, and the
// fingers wrap the side. Palms facing the camera is his complaint; palms
// facing away only hides them behind the skull.
const CANDIDATES = [
  { name: 'g-palm-in', finger: [0.10, 0.92, -0.38], palm: [0.95, 0.00, -0.30] },
  { name: 'h-palm-in-flat', finger: [0.05, 0.85, -0.52], palm: [0.97, 0.05, -0.10] },
  { name: 'i-palm-in-tilt', finger: [0.25, 0.90, -0.35], palm: [0.88, -0.15, -0.45], pos: { y: -0.13 } },
  { name: 'j-fingers-forward', finger: [0.00, 0.80, -0.60], palm: [0.99, 0.05, 0.00] },
  { name: 'k-open-in', finger: [0.15, 0.95, -0.28], palm: [0.80, 0.00, 0.60] },
  { name: 'l-wide', finger: [0.35, 0.86, -0.37], palm: [0.92, -0.05, -0.38], pos: { x: 0.132, y: -0.13 } },
];

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });

  const shots = await page.evaluate(async (candidates) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    F.stepWith(1.2, {}, false);
    const yaw0 = g.player.yaw;
    const out = [];
    // Plain arithmetic rather than a THREE import: makeBasis(X,Y,Z) puts the
    // three axes in the COLUMNS, and Euler 'XYZ' reads back as
    // y = asin(m13), x = atan2(-m23, m33), z = atan2(-m12, m11).
    const solve = (fingerArr, palmArr) => {
      const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const Z = norm(fingerArr);
      const p = palmArr, d = dot(p, Z);
      const Y = norm([p[0] - Z[0] * d, p[1] - Z[1] * d, p[2] - Z[2] * d]);
      const X = [Y[1] * Z[2] - Y[2] * Z[1], Y[2] * Z[0] - Y[0] * Z[2], Y[0] * Z[1] - Y[1] * Z[0]];
      return {
        rx: +Math.atan2(-Z[1], Z[2]).toFixed(3),
        ry: +Math.asin(Math.max(-1, Math.min(1, Z[0]))).toFixed(3),
        rz: +Math.atan2(-Y[0], X[0]).toFixed(3),
      };
    };
    const home = { ...g.skull._handPose.cradle };
    for (const c of candidates) {
      const r = solve(c.finger, c.palm);
      const P = g.skull._handPose;
      P.cradle.rx = r.rx; P.cradle.ry = r.ry; P.cradle.rz = r.rz;
      P.cradle.x = c.pos?.x ?? home.x;
      P.cradle.y = c.pos?.y ?? home.y;
      P.cradle.z = c.pos?.z ?? home.z;
      for (const [name, pitch] of [['hold', -0.08], ['down', -0.30]]) {
        g.player.yaw = yaw0; g.player.pitch = pitch;
        g.player._sync(0);
        F.stepWith(0.3, {}, false);
        g.render();
        out.push({ name: `${c.name}-${name}`, r, png: g.renderer.domElement.toDataURL('image/png') });
      }
    }
    return out;
  }, CANDIDATES);

  for (const s of shots) {
    const file = join(outDir, `${s.name}.png`);
    writeFileSync(file, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`wrote ${file}   rx ${s.r.rx}  ry ${s.r.ry}  rz ${s.r.rz}`);
  }
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

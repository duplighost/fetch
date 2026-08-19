// shot-grip-sweep.mjs -- aim the held grip, and MEASURE how far it is buried.
//
// "oooo, those hands look nasty. and clip through. we need to have actual human
// hands holding a skull."
//
// Two failures in one sentence, with different fixes:
//   CLIP  -- the hands are inside the skull. probe-grip-clip.mjs says each hand
//     box is 0.355 x 0.365 x 0.296 in hold space against a skull of 0.212 x
//     0.257 x 0.29, seated at |x| 0.115 when the skull's own half-width is
//     0.106. So it is measurable: every candidate below reports the percentage
//     of its hand vertices sitting inside the skull's ellipsoid, and zero is
//     the bar.
//   NASTY -- the fingers curl AWAY from the camera, so nothing in frame reads
//     as a finger; you get the backs of four proximal lumps and no hand. The
//     answer is to lay the fingers ACROSS the skull rather than round its far
//     side, so they can be counted against it.
//
// Two facts about mkHand make the aiming solvable: the fingers grow along the
// hand's local +Z, and they curl toward local +Y, so +Y is the palm normal.
// And _applyHandPose applies (rx, -side*ry, -side*rz), so for the LEFT hand
// the stored numbers ARE the applied Euler XYZ.
//
//   node tools/shot-grip-sweep.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir = 'scratch-hands/sweep'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

// finger = where the fingers point, palm = which way the palm faces, both in
// the held rig's space (x right, y up, z toward the viewer), for the LEFT hand.
// pos overrides the cradle seat.
// Round two of the sweep: 'q' was the first to read as HANDS — back of the
// hand, thumb, knuckles, no clipping — but it holds nothing; the two of them
// float either side of the skull with a gap. So keep its aim and walk it back
// in, looking for the tightest seat that still measures 0% buried.
const Q_FINGER = [0.97, 0.18, -0.16];
const Q_PALM = [0.08, 0.22, -0.97];
// Round three: 'u' reads as hands and measures 0.5% buried, but the fingertips
// only kiss the skull — it cups rather than grips. Coming further IN buries
// them (t was 4.3%), so instead come FORWARD: at a larger z the fingers pass in
// front of the skull's side and overlap its silhouette from the camera without
// ever entering its volume.
// ROUND FIVE, and this one is aimed at the REFERENCE IMAGE, which is now
// posted and looked at rather than read about. What it actually shows:
//   - both wrists at the very bottom edge, forearms out of frame;
//   - the fingers pointing UP the sides of the cranium, nearly straight, laid
//     ON the bone and following its curve — not curled round anything;
//   - the backs of the hands and the backs of the fingers to the camera, the
//     thumbs hidden behind;
//   - fingertips reaching about eye-socket height;
//   - and the hands DARK. The skull is the pale thing in that frame; the hands
//     are weathered mid-dark. Pale pink hands are half of "look nasty".
// So: palms inward at the bone, fingers up, and seated LOW.
// a1 aimed right and measured clean, but seated at y -0.175 the fingertips
// only reach the jaw: a row of knuckles along the bottom edge. The reference
// has them at eye-socket height. So climb the seat, and widen x as it climbs,
// because the skull is at its widest exactly where the palm now wants to be
// (a3 and a6 buried 13% and 9.3% for want of that).
// Climbing with the fingers angled INWARD buries them: they converge into the
// cranium exactly as they rise past its widest point. The reference's fingers
// are near vertical — they hug a shape that widens and then narrows again
// instead of aiming at its middle. So: straight up, and a pair that splay very
// slightly outward.
const F_VERT = [0.02, 0.99, -0.12];
const P_VERT = [0.97, -0.05, -0.22];
const F_SPLAY = [-0.06, 0.99, -0.10];
const P_SPLAY = [0.98, 0.00, -0.20];
const CANDIDATES = [
  { name: 'c1-vert-150', finger: F_VERT, palm: P_VERT, pos: { x: 0.150, y: -0.150, z: 0.115 } },
  { name: 'c2-vert-135', finger: F_VERT, palm: P_VERT, pos: { x: 0.155, y: -0.135, z: 0.115 } },
  { name: 'c3-vert-120', finger: F_VERT, palm: P_VERT, pos: { x: 0.158, y: -0.120, z: 0.120 } },
  { name: 'c4-splay-135', finger: F_SPLAY, palm: P_SPLAY, pos: { x: 0.152, y: -0.135, z: 0.115 } },
  { name: 'c5-splay-118', finger: F_SPLAY, palm: P_SPLAY, pos: { x: 0.156, y: -0.118, z: 0.122 } },
  { name: 'c6-vert-140-fwd', finger: F_VERT, palm: P_VERT, pos: { x: 0.148, y: -0.140, z: 0.140 } },
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
    F.stepWith(1.5, {}, false);
    const yaw0 = g.player.yaw;
    const out = [];
    // makeBasis(X,Y,Z) puts the axes in the COLUMNS, and Euler 'XYZ' reads back
    // as y = asin(m13), x = atan2(-m23, m33), z = atan2(-m12, m11).
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
    // How much of each hand sits inside the skull? Sample every hand vertex
    // against the skull's own ellipsoid, in hold space.
    const hold = g.skull.hold;
    const skullChild = hold.children.find((c) => (c.name || '').toLowerCase().includes('skull'))
      || hold.children[hold.children.length - 1];
    const buriedPct = () => {
      hold.updateWorldMatrix(true, true);
      const inv = hold.matrixWorld.clone().invert();
      const V = new g.player.pos.constructor();
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      skullChild.traverse((o) => {
        if (!o.isMesh || !o.geometry?.getAttribute('position')) return;
        const pos = o.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          V.fromBufferAttribute(pos, i);
          if (o.isSkinnedMesh) o.applyBoneTransform(i, V);
          V.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          const xyz = [V.x, V.y, V.z];
          for (let k = 0; k < 3; k++) {
            if (xyz[k] < lo[k]) lo[k] = xyz[k];
            if (xyz[k] > hi[k]) hi[k] = xyz[k];
          }
        }
      });
      const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
      const r = [0, 1, 2].map((k) => Math.max(1e-6, (hi[k] - lo[k]) / 2));
      let inside = 0, total = 0, deepest = 0;
      for (const hand of [hold.children[0], hold.children[1]]) {
        hand.traverse((o) => {
          if (!o.isMesh || !o.geometry?.getAttribute('position')) return;
          const pos = o.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            V.fromBufferAttribute(pos, i);
            if (o.isSkinnedMesh) o.applyBoneTransform(i, V);
            V.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
            const d = ((V.x - c[0]) / r[0]) ** 2 + ((V.y - c[1]) / r[1]) ** 2 + ((V.z - c[2]) / r[2]) ** 2;
            total++;
            if (d < 1) { inside++; deepest = Math.max(deepest, 1 - Math.sqrt(d)); }
          }
        });
      }
      return { pct: +(100 * inside / Math.max(1, total)).toFixed(1), deepest: +deepest.toFixed(3) };
    };

    for (const c of candidates) {
      const r = solve(c.finger, c.palm);
      const P = g.skull._handPose;
      P.cradle.rx = r.rx; P.cradle.ry = r.ry; P.cradle.rz = r.rz;
      P.cradle.x = c.pos.x; P.cradle.y = c.pos.y; P.cradle.z = c.pos.z;
      g.skull._applyHandPose(0, 0);
      const buried = buriedPct();
      for (const pitch of [-0.08, -0.30]) {
        g.player.yaw = yaw0; g.player.pitch = pitch;
        g.player._sync(0);
        F.stepWith(0.3, {}, false);
        g.skull._applyHandPose(0, 0);
        g.render();
        out.push({
          name: c.name + (pitch === -0.08 ? '-hold' : '-down'),
          key: c.name, r, pos: c.pos, buried,
          png: g.renderer.domElement.toDataURL('image/png'),
        });
      }
    }
    return out;
  }, CANDIDATES);

  const seen = new Set();
  for (const s of shots) {
    writeFileSync(join(outDir, s.name + '.png'), Buffer.from(s.png.split(',')[1], 'base64'));
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    console.log(s.key.padEnd(22) + ' rx ' + s.r.rx + '  ry ' + s.r.ry + '  rz ' + s.r.rz
      + '  pos ' + JSON.stringify(s.pos) + '  BURIED ' + s.buried.pct + '% (deepest ' + s.buried.deepest + ')');
  }
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
  writeFileSync(resultsPath('grip-sweep.json'), JSON.stringify(shots.map(({ png, ...r }) => r), null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

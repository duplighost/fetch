// sweep-grip-contact.mjs -- find the seat where the hands actually TOUCH.
//
// probe-grip-contact.mjs measured the round-seven cradle and the number is the
// whole round: the fingertips sit 12-70 mm off the bone, mean 38. "It doesn't
// look like he is holding the skull" because he is not -- two hands rise on
// either side of a floating skull with a finger's length of air between.
//
// The old sweep (shot-grip-sweep) could not see this. It scored candidates on
// "percent of hand vertices inside an ellipsoid inscribed in the skull's AABB",
// and that ellipsoid is far smaller than the cranium: the AABB is tall because
// the jaw hangs below, so the inscribed ellipsoid pinches in exactly where the
// fingers pass. Zero buried against it means nothing.
//
// This one measures both ends honestly, against the skull's OWN surface:
//   GAP    -- nearest distance from each finger to the nearest bone, in mm
//   INSIDE -- percent of hand vertices inside the surface, by a star-shaped
//             radial test (max skull radius per spherical cell about its
//             centre), which follows the real silhouette instead of a box.
// Contact is a narrow target: gap near zero AND inside near zero. One without
// the other is either floating or clipping.
//
//   node tools/sweep-grip-contact.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'scratch-hands/contact-sweep';
mkdirSync(OUT, { recursive: true });

// a1/a2 are the held-pose bend constants update() produces at rest grip
// (current tree: 0.431 / 0.496).
const BASE = { x: 0.156, y: -0.118, z: 0.122, rx: -1.671, ry: -0.060, rz: -1.370, a1: 0.431, a2: 0.496 };
// ROUND THREE of the sweep, and it aims the hand instead of nudging Eulers.
//
// Round one said the gap is mostly in Z, not X: the cradle seated the hands at
// z 0.122 when the skull's own front face is at about 0.117, so they were not
// beside the skull at all, they were in front of it reaching back. Round two
// closed that and showed the next thing -- the fingers rise VERTICALLY, and
// the cranium is a dome, so a straight vertical finger leaves the surface the
// moment it passes the widest point. Curl alone answers that by hooking the
// tips over the cheek, which reads as clutching a face rather than cradling a
// skull.
//
// So sweep the AIM. `finger` is where the fingers point and `palm` is which
// way the palm faces, both in the held rig's space (x right, y up, z toward
// the viewer) for the LEFT hand -- which sits at NEGATIVE x, so a positive x
// component in `finger` leans the fingers IN over the dome and a negative one
// splays them out along its widening. The solver reads the Euler back off the
// basis, which works because _applyHandPose applies (rx, -side*ry, -side*rz):
// the stored numbers ARE the applied angles for the left hand.
const UP = [0.02, 0.99, -0.12];            // round seven's vertical aim
const PALM = [0.97, -0.05, -0.22];         // palm inward at the bone
const lean = (k) => [UP[0] + k, UP[1], UP[2]];
const CANDIDATES = [
  { name: 'r7-baseline' },
  // near-straight fingers, hand walked in: does the dome let them lie on it?
  { name: 'aim-in06-x134', finger: lean(0.06), palm: PALM, x: 0.134, z: 0.100 },
  { name: 'aim-in12-x134', finger: lean(0.12), palm: PALM, x: 0.134, z: 0.100 },
  { name: 'aim-in12-x124', finger: lean(0.12), palm: PALM, x: 0.124, z: 0.100 },
  { name: 'aim-in18-x124', finger: lean(0.18), palm: PALM, x: 0.124, z: 0.100 },
  { name: 'aim-out08-x124', finger: lean(-0.08), palm: PALM, x: 0.124, z: 0.100 },
  // ...and the same aims with the seat higher, so the fingers end at the eye
  // sockets rather than along the jaw
  { name: 'aim-in12-x134-hi', finger: lean(0.12), palm: PALM, x: 0.134, y: -0.095, z: 0.100 },
  { name: 'aim-in12-x124-hi', finger: lean(0.12), palm: PALM, x: 0.124, y: -0.095, z: 0.100 },
  { name: 'aim-in18-x124-hi', finger: lean(0.18), palm: PALM, x: 0.124, y: -0.095, z: 0.100 },
  { name: 'aim-in12-x124-hi-curl', finger: lean(0.12), palm: PALM, x: 0.124, y: -0.095, z: 0.100, a1: 0.60, a2: 0.70 },
  { name: 'aim-in12-x134-hi-curl', finger: lean(0.12), palm: PALM, x: 0.134, y: -0.095, z: 0.100, a1: 0.60, a2: 0.70 },
  { name: 'aim-in12-x134-hi-bk', finger: lean(0.12), palm: PALM, x: 0.134, y: -0.095, z: 0.085 },
  { name: 'aim-in18-x134-hi-bk', finger: lean(0.18), palm: PALM, x: 0.134, y: -0.095, z: 0.085 },
  { name: 'aim-in12-x128-hi2', finger: lean(0.12), palm: PALM, x: 0.128, y: -0.078, z: 0.100 },
];

// makeBasis(X,Y,Z) puts the axes in the COLUMNS, and Euler 'XYZ' reads back as
// y = asin(m13), x = atan2(-m23, m33), z = atan2(-m12, m11).
function solve(fingerArr, palmArr) {
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
}
for (const c of CANDIDATES) {
  if (c.finger && c.palm) Object.assign(c, solve(c.finger, c.palm));
}

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });

  const rows = await page.evaluate(({ BASE, CANDIDATES }) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    F.stepWith(1.5, {}, false);
    const hold = g.skull.hold;
    const V = new g.player.pos.constructor();
    const yaw0 = g.player.yaw;

    // ---------- the skull's own surface ----------
    // Sampled PER STAGE, because setStage() changes what the skull is: stage 0
    // is the bare cranium of the opening bedroom (0.166 wide) and stage 5 has
    // cheekbones, jaw and teeth (0.212). Building this cloud once and then
    // changing stage would measure the hands against a skull that is not there.
    hold.updateWorldMatrix(true, true);
    let inv = hold.matrixWorld.clone().invert();
    let pts = [], MM = 1, C = [0, 0, 0], size = [0, 0, 0];
    let grid = new Map();
    const CELL = 0.02, key = (a, b, c) => a + ',' + b + ',' + c;
    const NT = 48, NP = 24;
    let rad = new Float32Array(NT * NP);
    const sampleSkull = () => {
      hold.updateWorldMatrix(true, true);
      inv = hold.matrixWorld.clone().invert();
      pts = [];
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      g.skull.root.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
        const pos = o.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          V.fromBufferAttribute(pos, i);
          if (o.isSkinnedMesh) o.applyBoneTransform(i, V);
          V.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          pts.push(V.x, V.y, V.z);
          const xyz = [V.x, V.y, V.z];
          for (let k = 0; k < 3; k++) { if (xyz[k] < lo[k]) lo[k] = xyz[k]; if (xyz[k] > hi[k]) hi[k] = xyz[k]; }
        }
      });
      size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      MM = 145 / size[0];
      C = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      grid = new Map();
      for (let i = 0; i < pts.length; i += 3) {
        const k = key(Math.floor(pts[i] / CELL), Math.floor(pts[i + 1] / CELL), Math.floor(pts[i + 2] / CELL));
        let cell = grid.get(k); if (!cell) grid.set(k, cell = []); cell.push(i);
      }
      rad = new Float32Array(NT * NP);
      for (let i = 0; i < pts.length; i += 3) {
        const c = cellOf(pts[i], pts[i + 1], pts[i + 2]);
        if (c.r > rad[c.i]) rad[c.i] = c.r;
      }
    };
    const nearest = (x, y, z) => {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
      let best = Infinity;
      for (let ring = 0; ring < 6; ring++) {
        for (let a = cx - ring; a <= cx + ring; a++) for (let b = cy - ring; b <= cy + ring; b++) for (let c = cz - ring; c <= cz + ring; c++) {
          if (ring > 0 && Math.abs(a - cx) < ring && Math.abs(b - cy) < ring && Math.abs(c - cz) < ring) continue;
          const cell = grid.get(key(a, b, c)); if (!cell) continue;
          for (const i of cell) {
            const d = (pts[i] - x) ** 2 + (pts[i + 1] - y) ** 2 + (pts[i + 2] - z) ** 2;
            if (d < best) best = d;
          }
        }
        if (best < ((ring * CELL) ** 2)) break;
      }
      return Math.sqrt(best);
    };
    // star-shaped radial silhouette: max skull radius per (theta, phi) cell
    function cellOf(x, y, z) {
      const dx = x - C[0], dy = y - C[1], dz = z - C[2];
      const r = Math.hypot(dx, dy, dz) || 1e-9;
      const t = Math.min(NT - 1, Math.max(0, Math.floor((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI) * NT)));
      const p = Math.min(NP - 1, Math.max(0, Math.floor((Math.acos(Math.max(-1, Math.min(1, dy / r)))) / Math.PI * NP)));
      return { i: t * NP + p, r };
    }
    const insideSkull = (x, y, z) => { const c = cellOf(x, y, z); return rad[c.i] > 0 && c.r < rad[c.i] * 0.985; };

    // ---------- score one candidate ----------
    const measure = () => {
      hold.updateWorldMatrix(true, true);
      inv = hold.matrixWorld.clone().invert();
      const gaps = [];
      let insideN = 0, total = 0, deepestMM = 0;
      // the flesh is one SkinnedMesh per hand since the round-nine rebuild:
      // per-finger grouping rides skinIndex via userData.fingerOfBone
      {
        const mins = new Array(g.skull._fingers.length).fill(Infinity);
        let base = 0;
        for (const hand of [hold.children[0], hold.children[1]]) {
          let sm = null;
          hand.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
          if (sm) {
            const pos = sm.geometry.getAttribute('position');
            const sidx = sm.geometry.getAttribute('skinIndex');
            const map = sm.userData.fingerOfBone || [];
            for (let i = 0; i < pos.count; i++) {
              const fi = map[sidx.getX(i)];
              if (fi === undefined || fi < 0) continue;
              V.fromBufferAttribute(pos, i);
              sm.applyBoneTransform(i, V);
              V.applyMatrix4(sm.matrixWorld).applyMatrix4(inv);
              const d = nearest(V.x, V.y, V.z);
              if (d < mins[base + fi]) mins[base + fi] = d;
            }
          }
          base += 5;
        }
        for (const m of mins) gaps.push(+(m * MM).toFixed(1));
      }
      for (const hand of [hold.children[0], hold.children[1]]) {
        hand.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
          const pos = o.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            V.fromBufferAttribute(pos, i);
            if (o.isSkinnedMesh) o.applyBoneTransform(i, V);
            V.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
            total++;
            if (insideSkull(V.x, V.y, V.z)) {
              insideN++;
              const d = nearest(V.x, V.y, V.z) * MM;
              if (d > deepestMM) deepestMM = d;
            }
          }
        });
      }
      return {
        gaps,
        worstGapMM: Math.max(...gaps),
        meanGapMM: +(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1),
        insidePct: +(100 * insideN / Math.max(1, total)).toFixed(2),
        deepestMM: +deepestMM.toFixed(1),
      };
    };

    const pose = (c) => {
      const P = g.skull._handPose;
      P.cradle.x = c.x; P.cradle.y = c.y; P.cradle.z = c.z;
      P.cradle.rx = c.rx; P.cradle.ry = c.ry; P.cradle.rz = c.rz;
      g.skull._applyHandPose(0, 0);
      for (const f of g.skull._fingers) { f.k1.rotation.x = -c.a1; f.k2.rotation.x = -c.a2; }
    };

    // THE SKULL IS NOT ONE SIZE. setStage() adds parts as it grows: stage 0 is
    // the bare cranium the opening bedroom shows (0.166 wide) and stage 5 has
    // cheekbones, jaw and teeth (0.212). A seat tuned to the small one clips
    // the big one, so every candidate is scored against BOTH, and the number
    // that decides is the worst of the two.
    const atStage = (n, fn) => {
      const keep = g.skull.stage;
      g.skull.setStage(n);
      sampleSkull();
      const r = fn();
      g.skull.setStage(keep);
      return r;
    };

    const out = [];
    for (const cand of CANDIDATES) {
      const c = { ...BASE, ...cand };
      pose(c);
      const m0 = atStage(0, measure);
      const m5 = atStage(5, measure);
      const m = {
        gaps: m0.gaps,
        worstGapMM: m0.worstGapMM, meanGapMM: m0.meanGapMM,
        meanGapMM5: m5.meanGapMM,
        insidePct: m0.insidePct,
        insidePct5: m5.insidePct,
        deepestMM: Math.max(m0.deepestMM, m5.deepestMM),
      };
      g.player.yaw = yaw0; g.player.pitch = -0.08; g.player._sync(0);
      // settle: render() decays fovKick and the impact light, so the first
      // frames after a state change are not the scene
      for (let i = 0; i < 3; i++) { pose(c); g.render(); }
      pose(c);
      g.render();
      out.push({ name: c.name, x: c.x, y: c.y, z: c.z, a1: c.a1, a2: c.a2, ...m, png: g.renderer.domElement.toDataURL('image/png') });
    }
    return out;
  }, { BASE, CANDIDATES });

  console.log('name                  seat x/y/z          bend      worst  mean0  mean5  in0%  in5%  deep');
  for (const r of rows) {
    writeFileSync(join(OUT, r.name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(r.name.padEnd(22)
      + `${r.x} ${r.y} ${r.z}`.padEnd(20)
      + `${r.a1}/${r.a2}`.padEnd(10)
      + String(r.worstGapMM).padStart(6) + String(r.meanGapMM).padStart(7) + String(r.meanGapMM5).padStart(7)
      + String(r.insidePct).padStart(7) + String(r.insidePct5).padStart(6) + String(r.deepestMM).padStart(7));
  }
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
  writeFileSync(resultsPath('grip-contact-sweep.json'), JSON.stringify(rows.map(({ png, ...r }) => r), null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

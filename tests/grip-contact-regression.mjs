// grip-contact-regression.mjs -- the hands must TOUCH the skull.
//
// "in this whole game, the hands are facing so the palm side is against the
// skull, so it doesn't look like he's holding the skull." Three rounds read
// that as an orientation bug and turned the hands over. It was not. Round
// eight measured the thing nobody had measured -- the distance from each
// finger to the nearest bone -- and it came back 12 to 70 mm, MEAN 38. The
// hands were a finger's length away from the thing they were holding. Two
// hands rising either side of a floating skull.
//
// The old gate could not see it. shot-grip-sweep scores candidates on the
// percentage of hand vertices INSIDE an ellipsoid inscribed in the skull's
// AABB, and that box is tall because the jaw hangs off the bottom, so the
// ellipsoid it inscribes pinches in exactly where the fingers pass. Zero
// buried against it is compatible with floating in mid air, and for three
// rounds that is what it certified.
//
// So this asserts contact from both sides, against the skull's OWN surface:
//   - the fingers get CLOSE (mean fingertip gap, and a count that touch)
//   - and they do not go THROUGH (a star-shaped radial test that follows the
//     real silhouette instead of a box)
// at BOTH growth stages, because setStage() changes what the skull is: stage 0
// is the bare cranium of the opening bedroom and stage 5 has cheekbones, jaw
// and teeth, 28% wider. A seat tuned to one clips the other.
//
// If a future round moves the cradle, this is the gate that says whether the
// hands still hold anything.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const failures = [];
const check = (condition, message, detail = '') => {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}${suffix}`);
  if (!condition) failures.push(`${message}${suffix}`);
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

  const report = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    F.stepWith(1.5, {}, false);
    const hold = g.skull.hold;
    const V = new g.player.pos.constructor();

    const CELL = 0.02, key = (a, b, c) => a + ',' + b + ',' + c;
    const NT = 48, NP = 24;
    let pts = [], grid = new Map(), rad = new Float32Array(NT * NP);
    let MM = 1, C = [0, 0, 0], size = [0, 0, 0], inv = null;

    function cellOf(x, y, z) {
      const dx = x - C[0], dy = y - C[1], dz = z - C[2];
      const r = Math.hypot(dx, dy, dz) || 1e-9;
      const t = Math.min(NT - 1, Math.max(0, Math.floor((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI) * NT)));
      const p = Math.min(NP - 1, Math.max(0, Math.floor(Math.acos(Math.max(-1, Math.min(1, dy / r))) / Math.PI * NP)));
      return { i: t * NP + p, r };
    }
    const sampleSkull = () => {
      hold.updateWorldMatrix(true, true);
      inv = hold.matrixWorld.clone().invert();
      pts = [];
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      g.skull.root.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
        const pos = o.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          pts.push(V.x, V.y, V.z);
          const xyz = [V.x, V.y, V.z];
          for (let k = 0; k < 3; k++) { if (xyz[k] < lo[k]) lo[k] = xyz[k]; if (xyz[k] > hi[k]) hi[k] = xyz[k]; }
        }
      });
      size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      MM = 145 / size[0];                       // a human cranium is ~145 mm across
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
    const insideSkull = (x, y, z) => { const c = cellOf(x, y, z); return rad[c.i] > 0 && c.r < rad[c.i] * 0.985; };

    const measure = () => {
      const gaps = [];
      for (const f of g.skull._fingers) {
        let min = Infinity;
        f.k1.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
          const pos = o.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
            const d = nearest(V.x, V.y, V.z);
            if (d < min) min = d;
          }
        });
        gaps.push(+(min * MM).toFixed(1));
      }
      let insideN = 0, total = 0;
      for (const hand of [hold.children[0], hold.children[1]]) {
        hand.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
          const pos = o.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
            total++;
            if (insideSkull(V.x, V.y, V.z)) insideN++;
          }
        });
      }
      // the thumbs are tucked behind the bone on purpose; the eight fingers
      // are the ones that have to be seen touching it
      const fingersOnly = gaps.filter((_, i) => i % 5 !== 4);
      return {
        gaps,
        skullWidth: +size[0].toFixed(3),
        meanFingerGapMM: +(fingersOnly.reduce((a, b) => a + b, 0) / fingersOnly.length).toFixed(1),
        touchingCount: fingersOnly.filter((v) => v <= 6).length,
        worstFingerGapMM: Math.max(...fingersOnly),
        insidePct: +(100 * insideN / Math.max(1, total)).toFixed(2),
      };
    };

    const atStage = (n) => {
      const keep = g.skull.stage;
      g.skull.setStage(n);
      sampleSkull();
      const r = measure();
      g.skull.setStage(keep);
      return r;
    };

    // hand AABB in hold space -- the hands may improve, they may not grow
    sampleSkull();
    const box = (node) => {
      const l = [1e9, 1e9, 1e9], h = [-1e9, -1e9, -1e9];
      node.updateWorldMatrix(true, true);
      node.traverse((o) => {
        if (!o.isMesh || !o.geometry?.getAttribute('position')) return;
        const pos = o.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          const xyz = [V.x, V.y, V.z];
          for (let k = 0; k < 3; k++) { if (xyz[k] < l[k]) l[k] = xyz[k]; if (xyz[k] > h[k]) h[k] = xyz[k]; }
        }
      });
      return [0, 1, 2].map((k) => +(h[k] - l[k]).toFixed(3));
    };

    return { stage0: atStage(0), stage5: atStage(5), handL: box(hold.children[0]), handR: box(hold.children[1]) };
  });

  for (const [name, s] of [['opening cranium', report.stage0], ['grown skull', report.stage5]]) {
    check(s.meanFingerGapMM <= 16,
      `${name}: the eight fingers lie within 16 mm of the bone`,
      `mean ${s.meanFingerGapMM} mm, worst ${s.worstFingerGapMM}, skull ${s.skullWidth} wide`);
    check(s.touchingCount >= 4,
      `${name}: at least four fingers actually touch it (within 6 mm)`,
      `${s.touchingCount} of 8, gaps ${JSON.stringify(s.gaps)}`);
    check(s.insidePct <= 4,
      `${name}: and no more than 4% of the hands is inside the skull`,
      `${s.insidePct}%`);
  }
  // Round eight left them at 0.239 x 0.430 x 0.197 in hold space, having come
  // IN in x and y and out in z (the thumbs tucked back behind the bone).
  for (const [side, b] of [['left', report.handL], ['right', report.handR]]) {
    check(b[0] <= 0.245 && b[1] <= 0.441 && b[2] <= 0.205,
      `the ${side} hand stays within its measured envelope`, b.join(' x '));
  }
  check(errors.length === 0, 'the grip produces zero page/console errors', errors.slice(0, 4).join(' | '));

  writeFileSync(resultsPath('grip-contact-regression.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.log(`\nGRIP CONTACT REGRESSIONS FAILED (${failures.length})`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll grip-contact regressions passed.');

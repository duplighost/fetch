// probe-grip-contact.mjs -- HOW FAR IS EACH FINGER FROM THE BONE?
//
// The existing gate (shot-grip-sweep) asks "what percentage of the hand is
// INSIDE the skull", against an ellipsoid inscribed in the skull's AABB. That
// is the right question for CLIPPING and the wrong one for HOLDING: the AABB
// is tall because the jaw hangs off the bottom, so the ellipsoid it inscribes
// is narrower than the real cranium everywhere the fingers actually pass. A
// grip can measure a clean 0.2% buried and still float a centimetre off the
// bone -- which is what the round-seven frames show, and what "it doesn't look
// like he's holding the skull" has been about all along.
//
// So measure the GAP instead: for every flesh vertex of every finger, the
// distance to the nearest skull surface vertex, in hold space and in real
// millimetres (calibrated off the skull's own width -- a human cranium is
// ~145 mm across, and the skull measures 0.212 hold units, so 1 unit = 684 mm).
//
// Negative would mean inside; the sweep still owns that question. Here, small
// and positive is the target: a finger lying ON bone reads as 0-3 mm.
//
//   node tools/probe-grip-contact.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    F.stepWith(1.5, {}, false);
    const THREE = g.THREE || window.THREE;
    const hold = g.skull.hold;
    hold.updateWorldMatrix(true, true);
    const inv = hold.matrixWorld.clone().invert();
    const V = new g.player.pos.constructor();

    // ---- skull surface point cloud, in hold space ----
    const skullRoot = g.skull.root;
    const pts = [];
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    skullRoot.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
      const pos = o.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        pts.push(V.x, V.y, V.z);
        const xyz = [V.x, V.y, V.z];
        for (let k = 0; k < 3; k++) { if (xyz[k] < lo[k]) lo[k] = xyz[k]; if (xyz[k] > hi[k]) hi[k] = xyz[k]; }
      }
    });
    const skullSize = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    // millimetres per hold unit, from the skull's own width
    const MM = 145 / skullSize[0];

    // uniform grid over the cloud so 10k hand verts x 20k skull verts is cheap
    const CELL = 0.02;
    const key = (a, b, c) => a + ',' + b + ',' + c;
    const grid = new Map();
    for (let i = 0; i < pts.length; i += 3) {
      const k = key(Math.floor(pts[i] / CELL), Math.floor(pts[i + 1] / CELL), Math.floor(pts[i + 2] / CELL));
      let cell = grid.get(k);
      if (!cell) grid.set(k, cell = []);
      cell.push(i);
    }
    const nearest = (x, y, z) => {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
      let best = Infinity;
      for (let ring = 0; ring < 6; ring++) {
        for (let a = cx - ring; a <= cx + ring; a++) for (let b = cy - ring; b <= cy + ring; b++) for (let c = cz - ring; c <= cz + ring; c++) {
          if (ring > 0 && Math.abs(a - cx) < ring && Math.abs(b - cy) < ring && Math.abs(c - cz) < ring) continue;
          const cell = grid.get(key(a, b, c));
          if (!cell) continue;
          for (const i of cell) {
            const d = (pts[i] - x) ** 2 + (pts[i + 1] - y) ** 2 + (pts[i + 2] - z) ** 2;
            if (d < best) best = d;
          }
        }
        if (best < ((ring * CELL) ** 2)) break;
      }
      return Math.sqrt(best);
    };

    // ---- per finger: the closest any of its flesh gets to the bone ----
    const NAMES = ['pinky/index', 'ring/middle', 'middle/ring', 'index/pinky', 'THUMB'];
    const fingers = [];
    const fs = g.skull._fingers;
    for (let fi = 0; fi < fs.length; fi++) {
      const f = fs[fi];
      let min = Infinity, tipMin = Infinity;
      f.k1.updateWorldMatrix(true, true);
      f.k1.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
        const pos = o.geometry.getAttribute('position');
        // the distal group is the last link: its meshes are the pads
        const isTip = !!o.parent && o.parent !== f.k1 && o.parent !== f.k2;
        for (let i = 0; i < pos.count; i++) {
          V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          const d = nearest(V.x, V.y, V.z);
          if (d < min) min = d;
          if (isTip && d < tipMin) tipMin = d;
        }
      });
      fingers.push({
        hand: fi < 5 ? 'L' : 'R',
        finger: NAMES[fi % 5],
        gapMM: +(min * MM).toFixed(1),
        tipGapMM: +(tipMin * MM).toFixed(1),
      });
    }

    // ---- hand AABB in hold space (the existing gate's number) ----
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

    return {
      mmPerUnit: +MM.toFixed(1),
      skullSize: skullSize.map((v) => +v.toFixed(3)),
      handL: box(hold.children[0]),
      handR: box(hold.children[1]),
      fingers,
      worstGapMM: Math.max(...fingers.map((f) => f.gapMM)),
      meanTipGapMM: +(fingers.reduce((a, f) => a + f.tipGapMM, 0) / fingers.length).toFixed(1),
    };
  });

  console.log('mm per hold unit :', out.mmPerUnit, ' skull', out.skullSize.join(' x '));
  console.log('hand AABB        : L', out.handL.join(' x '), '  R', out.handR.join(' x '));
  console.log('');
  console.log('  hand  finger        nearest-bone   fingertip');
  for (const f of out.fingers) {
    console.log('   ' + f.hand + '    ' + f.finger.padEnd(14) + String(f.gapMM).padStart(7) + ' mm'
      + String(f.tipGapMM).padStart(11) + ' mm');
  }
  console.log('');
  console.log('worst finger gap :', out.worstGapMM, 'mm     mean fingertip gap:', out.meanTipGapMM, 'mm');
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
  writeFileSync(resultsPath('grip-contact.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

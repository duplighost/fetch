// Pure-node replay of the Underfalls flank-wall and sluice-gate placement math.
// No browser, no GPU: it loads the REAL src/underfalls.js (three stubbed out --
// createUnderfallsLayout only needs Vector3) so the route tables, the segment
// projection and the walkable union are the shipping ones, then re-runs the
// piece loop for the old and new seating rules and measures the thing that
// actually matters: how close a drawn face gets to a pose the clamp will hold.
//
//   node tools/probe-district-walls.mjs
//
// Why this exists: the camera's near plane is 0.2 (main.js), and installClamp
// returns early at clearance <= -0.04, so any drawn face within ~0.2 m of a
// legal pose is CLIPPED AWAY and the player looks straight through the wall.
// That is "some of these walls you basically have to walk through".
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const THREE_STUB = [
  'export class Vector3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} }',
  'export class Vector2 { constructor(x=0,y=0){this.x=x;this.y=y;} }',
  'export const NoColorSpace = 0;',
  'export const RepeatWrapping = 1000;',
  'export const ClampToEdgeWrapping = 1001;',
  'export class CanvasTexture { constructor(){} }',
].join('\n');
const dataUrl = (src) => 'data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64');
const stub = dataUrl(THREE_STUB);
const utilSrc = readFileSync(resolve(ROOT, 'src/util.js'), 'utf8')
  .replace("import * as THREE from 'three';", "import * as THREE from '" + stub + "';");
const underfallsSrc = readFileSync(resolve(ROOT, 'src/underfalls.js'), 'utf8')
  .replace("import * as THREE from 'three';", "import * as THREE from '" + stub + "';")
  .replace("from './util.js';", "from '" + dataUrl(utilSrc) + "';");
const U = await import(dataUrl(underfallsSrc));

const {
  createUnderfallsLayout, projectUnderfalls, underfallsContains,
  UNDERFALLS_SOLID_PAD, UNDERFALLS_WALL_PAD, UNDERFALLS_WALL_MAX_PUSH,
} = U;

// Local frame: the district is built as clearingCenter + local, and every
// number in the round-thirteen plan is quoted as an offset from that centre.
const L = createUnderfallsLayout({ x: 0, y: 0, z: 0 });
const lerp = (a, b, t) => a + (b - a) * t;
const r3 = (n) => +n.toFixed(3);

// ---------------------------------------------------------------------------
// Every pose the lateral clamp will hold, plus the head bob it never sees.
// installClamp: `if (!p || p.clearance <= -0.04) return;` so clearance -0.04 is
// a stable stand. player.js _sync adds sin(bobPhase*0.5)*0.02 to camera.x.
// ---------------------------------------------------------------------------
// A dense GRID over the whole district, not lateral offsets from a centre
// line: the union is corridors plus chamber discs, so the closest legal stand
// to a given wall is not always perpendicular to the leg that wall belongs to.
// Only the outer band matters -- a pose deep in the lane cannot be the nearest
// one to anything drawn outside it -- so poses with clearance below -1.2 are
// dropped, which is well past any face this district draws.
function reachablePoses(step = 0.05) {
  const poses = [];
  const b = L.bounds;
  for (let x = b.minX; x <= b.maxX; x += step) {
    for (let z = b.minZ; z <= b.maxZ; z += step) {
      const p = projectUnderfalls(L, x, z);
      if (!p || p.clearance > -0.039 || p.clearance < -1.2) continue;
      for (const bob of [-0.02, 0, 0.02]) poses.push({ x: x + bob, z });
    }
  }
  return poses;
}
const POSES = reachablePoses();
// Bucket them so the gap search is local instead of 460k x 360.
const CELL = 2.0;
const BUCKETS = new Map();
const key = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
for (const p of POSES) {
  const k = key(p.x, p.z);
  let list = BUCKETS.get(k);
  if (!list) BUCKETS.set(k, list = []);
  list.push(p);
}
function posesNear(x, z, reach) {
  const out = [];
  const span = Math.ceil((reach + CELL) / CELL);
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -span; i <= span; i++) {
    for (let j = -span; j <= span; j++) {
      const list = BUCKETS.get((cx + i) + ',' + (cz + j));
      if (list) out.push(...list);
    }
  }
  return out;
}

// Distance from a point to an oriented rectangle in XZ -- the box's true face,
// never its AABB. A 35-degree yawed 0.54 x 0.95 box has a 0.99 m AABB, 0.22 m
// fatter into the lane than the face, which is the forest-trap overstatement
// src/underfalls.js already warns about.
function gapToRect(p, q) {
  const dx = p.x - q.x, dz = p.z - q.z;
  const u = Math.abs(dx * q.nx + dz * q.nz) - q.halfN;
  const v = Math.abs(dx * q.tx + dz * q.tz) - q.halfT;
  return Math.hypot(Math.max(0, u), Math.max(0, v));
}
function closestPose(q) {
  let best = { gap: Infinity, at: null };
  for (const p of posesNear(q.x, q.z, Math.hypot(q.halfN, q.halfT) + 2)) {
    const gap = gapToRect(p, q);
    if (gap < best.gap) best = { gap, at: [r3(p.x), r3(p.z)] };
  }
  return best;
}
function worstGap(rects) {
  let worst = { gap: Infinity, at: null, rect: null };
  for (const q of rects) {
    const best = closestPose(q);
    if (best.gap < worst.gap) worst = { gap: best.gap, at: best.at, rect: q };
  }
  return worst;
}

// ---------------------------------------------------------------------------
// The flank piece loop, in three variants. `mode`:
//   'old'  -- what round twelve shipped: fixed pw + 0.42, drop on any intrusion
//   'new'  -- steps 1+2: seat outward against the union until it clears the pad
//   'new3' -- steps 1+2+3+3b: same, with the chamber test made per piece
// ---------------------------------------------------------------------------
function runFlank(mode) {
  const rects = [];
  const skirts = [];
  let generated = 0, dropped = 0;
  let maxPush = 0, minHeight = Infinity, maxHeight = -Infinity, maxSkirt = 0;
  const perLeg = [];
  for (const seg of L.segments) {
    const n = Math.max(2, Math.ceil(seg.length / 0.9));
    const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
    const nx = tz, nz = -tx;
    const opensIntoChamber = L.chambers.some((chamber) =>
      Math.hypot(seg.a.x - chamber.x, seg.a.z - chamber.z) < chamber.r * 0.94
      || Math.hypot(seg.b.x - chamber.x, seg.b.z - chamber.z) < chamber.r * 0.94);
    const avgY = (seg.a.y + seg.b.y) * 0.5;
    const legLabel = seg.kind + '#' + seg.index;
    let legDrawn = 0, legGen = 0;
    if (mode !== 'new3' && opensIntoChamber) {
      perLeg.push({ leg: legLabel, gen: 0, drawn: 0, skippedLeg: true });
      continue;
    }
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const px = lerp(seg.a.x, seg.b.x, t);
      const pz = lerp(seg.a.z, seg.b.z, t);
      const py = lerp(seg.a.y, seg.b.y, t);
      const pw = lerp(seg.a.w, seg.b.w, t);
      const depth = seg.length / n + 0.08;
      if (mode === 'new3' && L.chambers.some((chamber) =>
        Math.hypot(px - chamber.x, pz - chamber.z) < chamber.r * 0.94)) continue;
      for (const side of [1, -1]) {
        generated++; legGen++;
        if (mode === 'old') {
          const cx = px + side * nx * (pw + 0.42);
          const cz = pz + side * nz * (pw + 0.42);
          let intrudes = false;
          for (let a = -1; a <= 1 && !intrudes; a++) {
            for (let b = -1; b <= 1 && !intrudes; b++) {
              const ox = side * nx * (a * 0.27) + tx * (b * depth * 0.5);
              const oz = side * nz * (a * 0.27) + tz * (b * depth * 0.5);
              const hit = projectUnderfalls(L, cx + ox, cz + oz);
              if (hit && hit.clearance < 0) intrudes = true;
            }
          }
          if (intrudes) { dropped++; continue; }
          rects.push({
            x: cx, z: cz, nx, nz, tx, tz, halfN: 0.27, halfT: depth * 0.5, leg: legLabel, i, side,
            // round twelve's box: world.box(..., py + 2.35, ..., 0.54, 5.15, ...)
            top: py + 2.35 + 5.15 * 0.5, roofUnder: avgY + 4.86 - 0.23,
          });
          legDrawn++;
          continue;
        }
        // Written as the full nine-sample minimum on purpose. The shipping
        // loop stops at the first sample under the pad, which is the same
        // predicate with the work pruned; keeping the unpruned form here is a
        // second opinion on the seating rather than a copy of it.
        let cx = 0, cz = 0, seated = false, seatPush = 0;
        for (let push = 0; push <= UNDERFALLS_WALL_MAX_PUSH + 1e-9; push += 0.05) {
          cx = px + side * nx * (pw + 0.42 + push);
          cz = pz + side * nz * (pw + 0.42 + push);
          let worst = Infinity;
          for (let a = -1; a <= 1; a++) {
            for (let b = -1; b <= 1; b++) {
              const ox = side * nx * (a * 0.27) + tx * (b * depth * 0.5);
              const oz = side * nz * (a * 0.27) + tz * (b * depth * 0.5);
              const hit = projectUnderfalls(L, cx + ox, cz + oz);
              if (hit && hit.clearance < worst) worst = hit.clearance;
            }
          }
          if (worst >= UNDERFALLS_WALL_PAD) { seatPush = push; seated = true; break; }
        }
        if (!seated) { dropped++; continue; }
        const bottom = py - 0.225;
        const height = (avgY + 5.09) - bottom;
        const skirt = 0.15 + seatPush;
        maxPush = Math.max(maxPush, seatPush);
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
        maxSkirt = Math.max(maxSkirt, skirt);
        skirts.push({
          x: px + side * nx * (pw + skirt * 0.5), z: pz + side * nz * (pw + skirt * 0.5),
          nx, nz, tx, tz, halfN: (skirt + 0.06) * 0.5, halfT: depth * 0.5,
          leg: legLabel, floorY: py,
        });
        rects.push({
          x: cx, z: cz, nx, nz, tx, tz, halfN: 0.27, halfT: depth * 0.5,
          leg: legLabel, i, side, push: seatPush, height, bottom, top: bottom + height,
          roofUnder: avgY + 4.86 - 0.23,
        });
        legDrawn++;
      }
    }
    perLeg.push({ leg: legLabel, gen: legGen, drawn: legDrawn, skippedLeg: false });
  }
  return { rects, skirts, generated, dropped, drawn: rects.length, maxPush, minHeight, maxHeight, maxSkirt, perLeg };
}

// ---------------------------------------------------------------------------
// The sluice gate, old and new. The posts are the only gate part at body
// height: the lintel sits at y 3.72 and the teeth at y >= 2.15, both above
// HEAD (1.75), so they are overhead by design and are not solids.
// ---------------------------------------------------------------------------
function runGate(mode) {
  const lowerIndex = L.main.indexOf(L.lowerSluice);
  const overflowIndex = L.main.indexOf(L.overflow);
  const climb = L.main.slice(lowerIndex, overflowIndex + 1);
  const out = [];
  const rects = [];
  for (let localIndex = 0; localIndex < climb.length; localIndex++) {
    const p = climb[localIndex];
    const index = lowerIndex + localIndex;
    const prev = L.main[Math.max(0, index - 1)];
    const next = L.main[Math.min(L.main.length - 1, index + 1)];
    const yaw = Math.atan2(next.x - prev.x, next.z - prev.z);
    const ax = Math.cos(yaw), az = -Math.sin(yaw);
    const bx = Math.sin(yaw), bz = Math.cos(yaw);
    let half = p.w + 0.12;
    let seated = mode === 'old';
    if (mode !== 'old') {
      for (; half <= p.w + 1.0 + 1e-9; half += 0.02) {
        let worst = Infinity;
        for (const side of [-1, 1]) {
          for (const u of [-0.115, 0.115]) {
            for (const v of [-0.14, 0.14]) {
              const hit = projectUnderfalls(L,
                p.x + ax * side * (half + u) + bx * v,
                p.z + az * side * (half + u) + bz * v);
              if (hit && hit.clearance < worst) worst = hit.clearance;
            }
          }
        }
        if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
      }
    }
    const faces = [];
    for (const side of [-1, 1]) {
      const inner = projectUnderfalls(L,
        p.x + ax * side * (half - 0.115), p.z + az * side * (half - 0.115));
      faces.push(r3(inner.clearance));
      if (seated) {
        rects.push({
          x: p.x + ax * side * half, z: p.z + az * side * half,
          nx: ax, nz: az, tx: bx, tz: bz, halfN: 0.115, halfT: 0.14, node: p.name,
        });
      }
    }
    out.push({ node: p.name, w: r3(p.w), half: seated ? r3(half) : null, seated, innerClearance: faces });
  }
  return { gates: out, rects };
}

// ---------------------------------------------------------------------------
const old = runFlank('old');
const step2 = runFlank('new');
const step3 = runFlank('new3');
const gateOld = runGate('old');
const gateNew = runGate('new');

const show = (label, r) => {
  const w = worstGap(r.rects);
  console.log(label + ': generated ' + r.generated + ', drawn ' + r.drawn + ', dropped ' + r.dropped
    + ', min camera gap ' + r3(w.gap) + ' m'
    + (r.maxPush ? '  [max push ' + r3(r.maxPush) + ', height ' + r3(r.minHeight) + '..' + r3(r.maxHeight)
      + ', max skirt ' + r3(r.maxSkirt) + ']' : ''));
  return w;
};

console.log('constants: SOLID_PAD ' + UNDERFALLS_SOLID_PAD
  + ', WALL_PAD ' + UNDERFALLS_WALL_PAD + ', MAX_PUSH ' + UNDERFALLS_WALL_MAX_PUSH);
console.log('reachable camera poses sampled: ' + POSES.length);
show('round twelve (shipping)', old);
show('steps 1+2              ', step2);
show('steps 1+2+3+3b         ', step3);

const worstOldList = [];
for (const q of old.rects) {
  const best = closestPose(q);
  worstOldList.push({ leg: q.leg, i: q.i, side: q.side, box: [r3(q.x), r3(q.z)], gap: r3(best.gap), from: best.at });
}
worstOldList.sort((a, b) => a.gap - b.gap);
console.log('\nround twelve, three closest drawn walls:');
for (const e of worstOldList.slice(0, 3)) console.log('  ' + JSON.stringify(e));
console.log('round twelve walls closer than the 0.2 near plane: '
  + worstOldList.filter((e) => e.gap < 0.2).length + ' of ' + worstOldList.length);

console.log('\nlegs with structural backing:');
console.log('  round twelve: ' + old.perLeg.filter((e) => e.drawn > 0).map((e) => e.leg).join(', '));
console.log('  steps 1+2   : ' + step2.perLeg.filter((e) => e.drawn > 0).map((e) => e.leg).join(', '));
console.log('  + step 3    : ' + step3.perLeg.filter((e) => e.drawn > 0).map((e) => e.leg).join(', '));

const roofGap = (r) => {
  let worst = -Infinity;
  for (const q of r.rects) worst = Math.max(worst, q.roofUnder - q.top);
  return r3(worst);
};
const roofGapPerLeg = (r) => {
  const byLeg = new Map();
  for (const q of r.rects) {
    const slot = q.roofUnder - q.top;
    if (!byLeg.has(q.leg) || slot > byLeg.get(q.leg)) byLeg.set(q.leg, slot);
  }
  return [...byLeg].filter(([, v]) => v > 0.001).map(([k, v]) => k + ' ' + r3(v)).join(', ') || 'none';
};
console.log('\nround twelve, open slot between wall top and roof underside, per leg: '
  + roofGapPerLeg(old));

// main#7's yaw, and what believing its AABB instead of its face would cost.
{
  const seg = L.segments.find((s) => s.kind === 'main' && s.index === 7);
  const yaw = Math.atan2(seg.dx, seg.dz);
  const n = Math.max(2, Math.ceil(seg.length / 0.9));
  const d = seg.length / n + 0.08;
  const aabb = Math.abs(0.54 * Math.cos(yaw)) + Math.abs(d * Math.sin(yaw));
  console.log('main#7 yaw ' + r3(yaw * 180 / Math.PI) + ' deg; piece depth ' + r3(d)
    + ' m; a 0.54 x ' + r3(d) + ' box has a ' + r3(aabb) + ' m AABB across the lane ('
    + r3((aabb - 0.54) / 2) + ' m fatter per side than its face)');
}
console.log('\nworst wall-top vs roof-underside slot after steps 1+2: ' + roofGap(step2)
  + ' m (negative = the wall overlaps the roof)');
console.log('worst wall-top vs roof-underside slot after + step 3 : ' + roofGap(step3) + ' m');

// The shoulder skirt bridges floor edge -> wall face at the LEG's elevation.
// Where it overruns a chamber rim it would lay a slab at the wrong height
// inside a room, so measure the overrun and the storey difference.
function skirtVsChambers(r) {
  let worstOverrun = 0, worstLip = -Infinity, count = 0, where = null;
  for (const q of r.skirts) {
    for (const chamber of L.chambers) {
      const rr = chamber.r * 1.02;
      // sample the skirt's footprint
      for (let a = 0; a <= 1; a += 0.25) {
        for (let b = -1; b <= 1; b += 0.5) {
          const off = -q.halfN + q.halfN * 2 * a;
          const x = q.x + q.nx * off + q.tx * (b * q.halfT);
          const z = q.z + q.nz * off + q.tz * (b * q.halfT);
          const inside = rr - Math.hypot(x - chamber.x, z - chamber.z);
          if (inside <= 0) continue;
          count++;
          if (inside > worstOverrun) worstOverrun = inside;
          // > 0 means the skirt's top face stands PROUD of the chamber floor
          // (a visible lip); <= -0.22 means it is buried under it entirely.
          const lip = q.floorY - chamber.y;
          if (lip > worstLip) { worstLip = lip; where = { leg: q.leg, chamber: chamber.name }; }
        }
      }
    }
  }
  return {
    samplesInsideAChamberDisc: count, worstOverrun: r3(worstOverrun),
    worstLip: count ? r3(worstLip) : null, where,
  };
}
// Baseline: the SHIPPING route floor boxes (half-width = the local w) already
// cross chamber rims at their own storey, so measure that too -- a new lip only
// matters if it is a new KIND of thing, not one more of what is already there.
function shippingFloorVsChambers() {
  const boxes = [];
  for (const seg of L.segments) {
    const n = Math.max(2, Math.ceil(seg.length / 0.9));
    const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      boxes.push({
        x: lerp(seg.a.x, seg.b.x, t), z: lerp(seg.a.z, seg.b.z, t),
        nx: tz, nz: -tx, tx, tz,
        halfN: lerp(seg.a.w, seg.b.w, t), halfT: (seg.length / n + 0.08) * 0.5,
        floorY: lerp(seg.a.y, seg.b.y, t), leg: seg.kind + '#' + seg.index,
      });
    }
  }
  return skirtVsChambers({ skirts: boxes });
}
console.log('  shipping route floor ' + JSON.stringify(shippingFloorVsChambers()));
console.log('\nskirt vs chamber discs:');
console.log('  steps 1+2       ' + JSON.stringify(skirtVsChambers(step2)));
console.log('  steps 1+2+3+3b  ' + JSON.stringify(skirtVsChambers(step3)));
const bigPush = step3.rects.filter((q) => q.push > 0.6).length;
console.log('pieces seated further than 0.6 m out: ' + bigPush + ' of ' + step3.rects.length
  + ' (step 3), ' + step2.rects.filter((q) => q.push > 0.6).length + ' of ' + step2.rects.length + ' (step 2)');

console.log('\nsluice gates (union clearance of each post inner face):');
for (const g of gateOld.gates) console.log('  old ' + JSON.stringify(g));
for (const g of gateNew.gates) console.log('  new ' + JSON.stringify(g));
const gw0 = worstGap(gateOld.rects), gw1 = worstGap(gateNew.rects);
console.log('  min camera gap to a post: old ' + r3(gw0.gap) + ' m -> new ' + r3(gw1.gap) + ' m');

// Steps 2/3 also have to survive the pin in tests/underfalls-expansion.mjs,
// which reads layout.solids. Replay that predicate here so a red gate is not
// the first time anyone finds out.
const pinFail = (solids) => {
  let fails = 0, worst = Infinity, at = null;
  for (const q of solids) {
    const best = closestPose(q);
    if (best.gap < worst) { worst = best.gap; at = best.at; }
    if (best.gap < UNDERFALLS_SOLID_PAD - 1e-3) fails++;
  }
  return { failingSolids: fails, worstGap: r3(worst), at };
};
// The gate in tests/underfalls-expansion.mjs walks a coarser, differently
// shaped pose set than the grid above (samplePath at 0.55, lateral offsets
// only, and a final sample whose normal is a placeholder +X). Replay it
// exactly, so a red gate is not how anyone finds out.
function testProbePoses() {
  const out = [];
  const samplePath = (path, spacing = 0.55) => {
    const s = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.ceil(len / spacing));
      const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        s.push({
          x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
          w: a.w + (b.w - a.w) * t, nx: tz, nz: -tx,
        });
      }
    }
    s.push({ ...path[path.length - 1], nx: 1, nz: 0 });
    return s;
  };
  for (const s of [...samplePath(L.main), ...samplePath(L.secret)]) {
    for (const lateral of [-1, 1]) {
      const sx = s.x + s.nx * lateral * (s.w - 0.04);
      const sz = s.z + s.nz * lateral * (s.w - 0.04);
      if (!underfallsContains(L, sx, sz, -0.039)) continue;
      for (const bob of [-0.02, 0, 0.02]) out.push({ x: sx + bob, z: sz });
    }
  }
  return out;
}
const TEST_POSES = testProbePoses();
const testPin = (solids) => {
  let fails = 0, worst = Infinity, at = null;
  for (const p of TEST_POSES) {
    for (const q of solids) {
      const gap = gapToRect(p, q);
      if (gap < worst) { worst = gap; at = [r3(p.x), r3(p.z)]; }
      if (gap < 0.42 - 1e-3) { fails++; break; }
    }
  }
  return { probes: TEST_POSES.length, failingPoses: fails, worstGap: r3(worst), at };
};
console.log('\nthe gate\'s own probe set (tests/underfalls-expansion.mjs):');
console.log('  steps 1+2       ' + JSON.stringify(testPin([...step2.rects, ...gateNew.rects])));
console.log('  steps 1+2+3+3b  ' + JSON.stringify(testPin([...step3.rects, ...gateNew.rects])));

console.log('\npin replay (wall + gate solids vs every clamp-legal pose):');
console.log('  steps 1+2       ' + JSON.stringify(pinFail([...step2.rects, ...gateNew.rects])));
console.log('  steps 1+2+3+3b  ' + JSON.stringify(pinFail([...step3.rects, ...gateNew.rects])));

// Box census -> draw calls. world.box merges by material into ONE mesh per
// material in finishStatic, so more boxes is more vertices and zero more calls.
// world.js: seg(s) = clamp(round(s / AO_SEG 0.85), 1, 8); a BoxGeometry with
// (a,b,c) segments carries 2*((a+1)(b+1) + (b+1)(c+1) + (a+1)(c+1)) vertices.
const segOf = (s) => Math.max(1, Math.min(8, Math.round(s / 0.85)));
const boxVerts = (w, h, d) => {
  const a = segOf(w), b = segOf(h), c = segOf(d);
  return 2 * ((a + 1) * (b + 1) + (b + 1) * (c + 1) + (a + 1) * (c + 1));
};
const vertexCost = (r, oldStyle) => {
  let v = 0;
  for (const q of r.rects) v += boxVerts(0.54, oldStyle ? 5.15 : q.height, q.halfT * 2);
  for (const q of r.skirts) v += boxVerts(q.halfN * 2, 0.22, q.halfT * 2);
  return v;
};
const boxCount = (r) => r.rects.length + r.skirts.length;
console.log('\nbox census (all M.rock, one merged static mesh -> zero draw-call change):');
console.log('  round twelve ' + old.rects.length + ' walls + 0 skirts = ' + old.rects.length);
console.log('  steps 1+2    ' + step2.rects.length + ' walls + ' + step2.skirts.length
  + ' skirts = ' + boxCount(step2) + ' (+' + (boxCount(step2) - old.rects.length) + ')');
console.log('  + step 3     ' + step3.rects.length + ' walls + ' + step3.skirts.length
  + ' skirts = ' + boxCount(step3) + ' (+' + (boxCount(step3) - old.rects.length) + ')');
const v0 = vertexCost(old, true), v2 = vertexCost(step2), v3 = vertexCost(step3);
console.log('vertices in those boxes: round twelve ' + v0 + ', steps 1+2 ' + v2
  + ' (+' + (v2 - v0) + '), + step 3 ' + v3 + ' (+' + (v3 - v0) + ')');
console.log('legs still without backing after step 3: '
  + (step3.perLeg.filter((e) => e.drawn === 0).map((e) => e.leg).join(', ') || 'none'));

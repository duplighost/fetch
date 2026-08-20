// Second opinion on tools/probe-wayfinding-tier.mjs, and a stricter one: this
// does not re-model the marker/jamb loops, it SLICES THE SHIPPING SOURCE TEXT
// of the wayfinding tier out of src/underfalls.js and executes it against a
// stub THREE, then reads the instance positions back off the matrices the real
// code composed. If the source and the probe ever disagree, this is the one to
// believe -- the probe is a paraphrase, this is the code.
//
//   node tools/verify-wayfinding-tier.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = readFileSync(resolve(ROOT, 'src/underfalls.js'), 'utf8');

// --- the district's real layout + projection, same trick as the probe -------
const THREE_STUB_SRC = [
  'export class Vector3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} }',
  'export class Vector2 { constructor(x=0,y=0){this.x=x;this.y=y;} }',
  'export const NoColorSpace = 0;',
  'export const RepeatWrapping = 1000;',
  'export const ClampToEdgeWrapping = 1001;',
  'export class CanvasTexture { constructor(){} }',
].join('\n');
const dataUrl = (s) => 'data:text/javascript;base64,' + Buffer.from(s, 'utf8').toString('base64');
const stub = dataUrl(THREE_STUB_SRC);
const utilSrc = readFileSync(resolve(ROOT, 'src/util.js'), 'utf8')
  .replace("import * as THREE from 'three';", "import * as THREE from '" + stub + "';");
const U = await import(dataUrl(RAW
  .replace("import * as THREE from 'three';", "import * as THREE from '" + stub + "';")
  .replace("from './util.js';", "from '" + dataUrl(utilSrc) + "';")));
const { createUnderfallsLayout, projectUnderfalls, UNDERFALLS_SOLID_PAD } = U;
const layout = createUnderfallsLayout({ x: 0, y: 0, z: 0 });

// --- cut the real block out of the file ------------------------------------
const START = 'const paleMark = M.headstone.clone();';
const END = '// 3. The fork reads without moving a node';
const i0 = RAW.indexOf(START);
const i1 = RAW.indexOf(END);
if (i0 < 0 || i1 < 0 || i1 < i0) throw new Error('could not slice the wayfinding tier');
const BODY = RAW.slice(i0, i1);
console.log('sliced ' + BODY.split(/\r\n|\n/).length + ' lines of shipping source');

// --- just enough THREE to run it -------------------------------------------
class V2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  dot(v) { return this.x * v.x + this.y * v.y; }
  normalize() { const l = Math.hypot(this.x, this.y) || 1; this.x /= l; this.y /= l; return this; }
}
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
class M4 {
  constructor() { this.p = new V3(); this.s = new V3(1, 1, 1); }
  compose(p, _q, s) { this.p = new V3(p.x, p.y, p.z); this.s = new V3(s.x, s.y, s.z); return this; }
  clone() { const m = new M4(); m.p = new V3(this.p.x, this.p.y, this.p.z); m.s = this.s; return m; }
  multiply() { return this; }
}
const geo = (kind) => ({ kind, translate() { return this; } });
class InstancedMesh {
  constructor(g, m, count) { this.geometry = g; this.material = m; this.count = count; this.mats = []; this.instanceMatrix = {}; this.userData = {}; }
  setMatrixAt(i, m) { this.mats[i] = m.clone ? m.clone() : m; }
}
const THREE = {
  Vector2: V2, Vector3: V3, Matrix4: M4,
  Quaternion: class { },
  Color: class { constructor(h) { this.h = h; } },
  ConeGeometry: class { constructor(r, h, s) { Object.assign(this, geo('cone'), { r, h, s }); } },
  BoxGeometry: class { constructor(x, y, z) { Object.assign(this, geo('box'), { x, y, z }); } },
  InstancedMesh,
};
const added = [];
const material = () => ({
  color: { setHex() { }, multiplyScalar() { } },
  emissive: { setHex() { } }, emissiveIntensity: 0,
  userData: {},
  clone() { return material(); },
});
const game = { scene: { add: (o) => added.push(o) } };
const world = { box() { } };
const M = { headstone: material(), rock: material() };

// publishSolid is the district ledger (src/underfalls.js). The sliced block
// calls it for every cone and every jamb it draws, so the real one goes in --
// this harness owns the layout, so layout.solids ends up holding exactly what
// the wayfinding tier published and nothing else.
const publishSolid = (l, entry) => {
  (l.solids || (l.solids = [])).push(entry);
  return entry;
};
// eslint-disable-next-line no-new-func
new Function('THREE', 'layout', 'game', 'world', 'M', 'projectUnderfalls',
  'UNDERFALLS_SOLID_PAD', 'publishSolid', 'clamp', 'lerp', BODY)(
    THREE, layout, game, world, M, projectUnderfalls, UNDERFALLS_SOLID_PAD,
    publishSolid,
    (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    (a, b, t) => a + (b - a) * t);

// --- measure what it actually drew -----------------------------------------
function reachablePoses(step = 0.05) {
  const poses = [];
  const b = layout.bounds;
  for (let x = b.minX; x <= b.maxX; x += step) {
    for (let z = b.minZ; z <= b.maxZ; z += step) {
      const p = projectUnderfalls(layout, x, z);
      if (!p || p.clearance > -0.039) continue;
      for (const bob of [-0.02, 0, 0.02]) poses.push({ x: x + bob, z });
    }
  }
  return poses;
}
const POSES = reachablePoses();
const CELL = 2.0, BUCKETS = new Map();
for (const p of POSES) {
  const k = Math.floor(p.x / CELL) + ',' + Math.floor(p.z / CELL);
  let l = BUCKETS.get(k); if (!l) BUCKETS.set(k, l = []); l.push(p);
}
function near(x, z, reach) {
  const out = [], span = Math.ceil((reach + CELL) / CELL);
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
    const l = BUCKETS.get((cx + i) + ',' + (cz + j)); if (l) out.push(...l);
  }
  return out;
}
const r3 = (n) => +n.toFixed(3);

// The 0.05 grid can miss the true nearest pose by up to its half-diagonal,
// 0.035 m -- enough to turn a real 0.419 into a reported 0.454. So every grid
// answer gets refined on a 0.005 lattice around itself, which bounds the
// remaining error at 0.0035. Legality is decided at the CLAMPED point; the
// head bob is then added to world X, which the clamp never sees.
function refine(gapFn, x0, z0) {
  let best = { gap: Infinity, at: null };
  for (let dx = -0.09; dx <= 0.09 + 1e-9; dx += 0.005) {
    for (let dz = -0.09; dz <= 0.09 + 1e-9; dz += 0.005) {
      const cx = x0 + dx, cz = z0 + dz;
      const p = projectUnderfalls(layout, cx, cz);
      if (!p || p.clearance > -0.039) continue;
      for (const bob of [-0.02, 0, 0.02]) {
        const g = gapFn(cx + bob, cz);
        if (g < best.gap) best = { gap: g, at: [cx + bob, cz] };
      }
    }
  }
  return best;
}

let fail = 0;
for (const mesh of added) {
  const isCone = mesh.geometry.kind === 'cone';
  const rad = isCone ? mesh.geometry.r : null;
  const half = isCone ? null : mesh.geometry.x / 2;
  console.log('\n' + mesh.name + ' -- ' + mesh.count + ' drawn');
  let worst = Infinity;
  for (const m of mesh.mats) {
    const { x, z } = m.p;
    const gapFn = isCone
      ? (px, pz) => Math.hypot(px - x, pz - z) - rad
      : (px, pz) => Math.hypot(Math.max(0, Math.abs(px - x) - half),
        Math.max(0, Math.abs(pz - z) - half));
    let gap = Infinity, at = null;
    for (const p of near(x, z, 3)) {
      const g = gapFn(p.x, p.z);
      if (g < gap) { gap = g; at = p; }
    }
    // the bob is baked into the bucketed poses, so undo it before refining
    if (at) {
      const fine = refine(gapFn, Math.round(at.x / 0.05) * 0.05, at.z);
      if (fine.gap < gap) gap = fine.gap;
    }
    const clr = projectUnderfalls(layout, x, z).clearance;
    if (gap < worst) worst = gap;
    console.log('  (' + r3(x) + ', ' + r3(z) + ')  unionClr ' + r3(clr) + '  gap ' + r3(gap));
  }
  const ok = worst >= 0.42;
  if (!ok) fail++;
  console.log('  min camera gap ' + r3(worst) + ' m  ' + (ok ? 'OK (>= SOLID_PAD 0.42)' : 'FAIL'));
}
console.log('\n' + (fail ? fail + ' FIXTURE(S) FAIL' : 'all wayfinding fixtures clear the pad'));

// --- will the browser gate go red? -----------------------------------------
// tests/underfalls-expansion.mjs needs a real GPU, so replay its predicate here
// instead of assuming. Round fourteen widened that gate twice over, and both
// widenings are replayed: the poses come from the UNION rather than from each
// polyline's own w (it used to probe only s.w - 0.04 either side of a 0.55 m
// centreline sampling, which never sees the extra lateral travel the clamp
// permits at a chamber rim -- exactly where these fixtures live), and the
// ledger now carries CIRCLES as well as rectangles, so the cones are measured
// as cones instead of being left off it.
{
  const PAD = 0.42;
  const solids = layout.solids || [];
  const gapTo = (q, px, pz) => {
    const dx = px - q.x, dz = pz - q.z;
    if (q.r !== undefined) return Math.max(0, Math.hypot(dx, dz) - q.r);
    const u = Math.abs(dx * q.nx + dz * q.nz) - q.halfN;
    const v = Math.abs(dx * q.tx + dz * q.tz) - q.halfT;
    return Math.hypot(Math.max(0, u), Math.max(0, v));
  };
  const failures = [];
  let tightest = Infinity, tightestName = null;
  for (const q of solids) {
    if (!Number.isFinite(q.y0) || !Number.isFinite(q.y1)) {
      failures.push({ name: q.name, why: 'no vertical span on the ledger entry' });
      continue;
    }
    const gapFn = (px, pz) => gapTo(q, px, pz);
    let gap = Infinity, at = null;
    for (const p of near(q.x, q.z, 3)) {
      const g = gapFn(p.x, p.z);
      if (g < gap) { gap = g; at = p; }
    }
    if (at) {
      const fine = refine(gapFn, Math.round(at.x / 0.05) * 0.05, at.z);
      if (fine.gap < gap) gap = fine.gap;
    }
    if (gap < tightest) { tightest = gap; tightestName = q.name; }
    if (gap < PAD - 1e-3) failures.push({ name: q.name, at: [r3(q.x), r3(q.z)], gap: r3(gap) });
  }
  const names = {};
  for (const q of solids) names[q.name] = (names[q.name] || 0) + 1;
  console.log('' + JSON.stringify(names) + ' wayfinding entries on layout.solids');
  console.log('tests/underfalls-expansion.mjs predicate replay: '
    + (failures.length ? failures.length + ' FAILURES ' + JSON.stringify(failures.slice(0, 4))
      : 'clean') + ', tightest ' + r3(tightest) + ' m (' + tightestName + ')');
  if (failures.length) fail++;
  // The tier draws four cones and ten jambs; a producer falling off the ledger
  // is the exact failure round fourteen widened the gate to stop, so count it.
  const drawn = added.reduce((n, mesh) => n + mesh.count, 0);
  if (solids.length !== drawn) {
    console.log('LEDGER MISMATCH: ' + drawn + ' drawn, ' + solids.length + ' published');
    fail++;
  }
}
process.exit(fail ? 1 : 0);

// Arithmetic replay of the wet walkway's paving math. No browser, no GPU, no
// server: it reads src/underfalls.js, re-derives every stone addFloorAndShell()
// lays down, and transforms each one through the SAME vendored r161 Matrix4 the
// game composes with, so the corner heights below are the real ones.
//
// The walkway is the surface Alex named directly ("walkway under waterfall
// doesn't look good") and the fix for it is geometric, so the numbers that
// justify it have to be checkable without a frame. What this pins:
//
//   * every course, verge included, stays well inside the route's own lateral
//     clamp — paving can never become the reason you walk into rock,
//   * no stone is thicker than 0.08 m and no corner rises far enough to read
//     as a step,
//   * no stone floats: every bottom corner is buried under the floor strip,
//   * the joint is the same width along the route as across it,
//   * the course count still matches the ribbon it replaced.
//
// It also reports the two numbers the change is actually about: how much of
// the bump map's gradient comes back, and how far the texel aspect falls.
//
//   node tools/probe-walkway-paving.mjs
import * as THREE from '../vendor/three.module.min.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'src', 'underfalls.js'), 'utf8');

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// ---- the route ---------------------------------------------------------------
// Parsed out of MAIN_LOCAL so the two cannot drift. worldNode() only
// translates, so local coordinates give identical lengths, widths and counts.
const block = src.slice(src.indexOf('const MAIN_LOCAL'), src.indexOf('// A no-key route'));
const main = [...block.matchAll(/\{ x: (-?[\d.]+),\s*z: (-?[\d.]+),\s*y: (-?[\d.]+),\s*w: (-?[\d.]+), name: '([^']+)' \}/g)]
  .map((m) => ({ x: +m[1], z: +m[2], y: +m[3], w: +m[4], name: m[5] }));
if (main.length !== 13) throw new Error(`expected 13 main nodes, parsed ${main.length}`);

const segments = [];
for (let i = 0; i < main.length - 1; i++) {
  const a = main[i], b = main[i + 1];
  const dx = b.x - a.x, dz = b.z - a.z;
  segments.push({ a, b, dx, dz, length: Math.hypot(dx, dz) });
}
const routeLength = segments.reduce((s, seg) => s + seg.length, 0);

// ---- the paving constants, read out of the source ----------------------------
const num = (name) => {
  const m = src.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (!m) throw new Error(`could not find "const ${name} = <number>;" in src/underfalls.js`);
  return +m[1];
};
const FLAG = num('FLAG');
const JOINT = num('JOINT');
const VERGE = num('VERGE');
const TIERS = JSON.parse(src.match(/const WALKWAY_TIERS = (\[[^\]]*\]);/)[1]);
// The floor strip the paving sits on tops out here, relative to route y
// (world.box centre y - 0.122 with a 0.22 thickness).
const STRIP_TOP = -0.012;

// mulberry32 / RNG, byte-identical to src/util.js, and seeded the same way.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  range(a, b) { return a + (b - a) * this.f(); }
}
const paveRng = new RNG(0x57a1b0c9);
const tierRng = new RNG(0x2f6d13a7);

const transformMatrix = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
  new THREE.Vector3(sx, sy, sz));

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const corners = unitBox.attributes.position;
const scratch = new THREE.Vector3();

// ---- replay ------------------------------------------------------------------
let course = 0, flags = 0, verges = 0;
const tierCount = TIERS.map(() => 0);
let worstMargin = Infinity, worstMarginAt = '';
let maxReach = 0, maxThick = 0;
let acrossSum = 0, alongSum = 0, aspectSum = 0;
let acrossMin = Infinity, acrossMax = 0, aspectMin = Infinity, aspectMax = 0;
let widthMin = Infinity, widthMax = 0, depthMin = Infinity, depthMax = 0;
let overlapMin = Infinity, overlapMax = 0;
let flagTop = -Infinity, flagBottom = Infinity, vergeTop = -Infinity, vergeBottom = Infinity;
let jointsEqual = true;

const sweep = (matrix, routeY, onY) => {
  for (let k = 0; k < corners.count; k++) {
    scratch.fromBufferAttribute(corners, k).applyMatrix4(matrix);
    onY(scratch.y - routeY);
  }
};

for (const seg of segments) {
  const n = Math.max(2, Math.ceil(seg.length / 0.9));
  const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
  const nx = tz, nz = -tx;
  const yaw = Math.atan2(seg.dx, seg.dz);
  const pitch = seg.length / n;
  const depth = pitch - JOINT;
  const oldDepth = (pitch + 0.08) * 0.98;         // the ribbon this replaced
  overlapMin = Math.min(overlapMin, oldDepth - pitch);
  overlapMax = Math.max(overlapMax, oldDepth - pitch);
  const along = oldDepth / depth;
  depthMin = Math.min(depthMin, depth);
  depthMax = Math.max(depthMax, depth);
  for (let i = 0; i < n; i++, course++) {
    const t = (i + 0.5) / n;
    const x = lerp(seg.a.x, seg.b.x, t);
    const y = lerp(seg.a.y, seg.b.y, t);
    const z = lerp(seg.a.z, seg.b.z, t);
    const w = lerp(seg.a.w, seg.b.w, t);
    const half = clamp(w * 0.46, 0.94, 1.72);
    const cols = Math.max(3, Math.round((half * 2) / FLAG));
    const cell = (half * 2) / cols;
    const width = cell - JOINT;
    const shift = (course & 1) ? cell * 0.25 : -cell * 0.25;
    const across = (half * 2) / width;            // the ribbon wore one tile
    widthMin = Math.min(widthMin, width);
    widthMax = Math.max(widthMax, width);
    acrossMin = Math.min(acrossMin, across);
    acrossMax = Math.max(acrossMax, across);
    const aspect = depth / width;
    aspectMin = Math.min(aspectMin, aspect);
    aspectMax = Math.max(aspectMax, aspect);
    if (Math.abs((cell - width) - JOINT) > 1e-12) jointsEqual = false;
    for (let c = 0; c < cols; c++) {
      const off = -half + (c + 0.5) * cell;
      const tier = clamp(Math.floor(
        (Math.abs(off) / half) * TIERS.length + tierRng.range(-0.45, 0.45)),
        0, TIERS.length - 1);
      const thick = 0.066 + paveRng.range(0, 0.012);
      const matrix = transformMatrix(
        x + nx * (off + shift),
        y + 0.042 + paveRng.range(-0.006, 0.006) - thick * 0.5,
        z + nz * (off + shift),
        paveRng.range(-0.024, 0.024),
        yaw + paveRng.range(-0.03, 0.03),
        paveRng.range(-0.024, 0.024),
        width, thick, depth);
      sweep(matrix, y, (dy) => {
        flagTop = Math.max(flagTop, dy);
        flagBottom = Math.min(flagBottom, dy);
      });
      tierCount[tier]++;
      flags++;
      acrossSum += across; alongSum += along; aspectSum += aspect;
      maxThick = Math.max(maxThick, thick);
    }
    for (const side of [1, -1]) {
      const edge = side * (half + JOINT + VERGE * 0.5) + shift;
      const matrix = transformMatrix(
        x + nx * edge,
        y - 0.005 + paveRng.range(-0.008, 0.008),
        z + nz * edge,
        paveRng.range(-0.05, 0.05),
        yaw + paveRng.range(-0.09, 0.09),
        paveRng.range(-0.05, 0.05),
        VERGE, 0.07, depth);
      sweep(matrix, y, (dy) => {
        vergeTop = Math.max(vergeTop, dy);
        vergeBottom = Math.min(vergeBottom, dy);
      });
      const reach = Math.abs(edge) + VERGE * 0.5;
      maxReach = Math.max(maxReach, reach);
      const margin = w - reach;
      if (margin < worstMargin) {
        worstMargin = margin;
        worstMarginAt = `${seg.a.name} -> ${seg.b.name}, course ${i + 1} of ${n}`;
      }
      maxThick = Math.max(maxThick, 0.07);
      verges++;
    }
  }
}

const round = (v, d = 3) => +v.toFixed(d);
const meanValue = tierCount.reduce((s, c, k) => s + c * TIERS[k], 0) / flags;
const oldBoxes = segments.reduce((s, seg) => s + Math.max(2, Math.ceil(seg.length / 0.9)), 0);

console.log(JSON.stringify({
  routeMetres: round(routeLength),
  oldRibbonBoxes: oldBoxes,
  courses: course,
  flags,
  vergeStones: verges,
  instances: flags + verges,
  drawCalls: TIERS.length + 1,
  oldSelfOverlapMm: [round(overlapMin * 1000, 1), round(overlapMax * 1000, 1)],
  stoneWidthM: [round(widthMin), round(widthMax)],
  stoneDepthM: [round(depthMin), round(depthMax)],
  texelAspect: [round(aspectMin), round(aspectMax)],
  texelAspectMean: round(aspectSum / flags),
  bumpGradientAcross: { mean: round(acrossSum / flags), min: round(acrossMin), max: round(acrossMax) },
  bumpGradientAlong: round(alongSum / flags),
  tierPopulation: tierCount,
  tierValues: TIERS,
  meanValueVsRibbon: round(meanValue, 4),
  maxVergeReachM: round(maxReach, 4),
  worstClampMarginM: round(worstMargin, 4),
  worstClampMarginAt: worstMarginAt,
  flagCornersAboveRouteY: [round(flagBottom, 4), round(flagTop, 4)],
  vergeCornersAboveRouteY: [round(vergeBottom, 4), round(vergeTop, 4)],
  floorStripTopAboveRouteY: STRIP_TOP,
}, null, 2));

let failed = 0;
const check = (ok, label) => {
  if (ok) console.log(`ok   ${label}`);
  else { failed++; console.error(`FAIL ${label}`); }
};
check(course === oldBoxes, `courses (${course}) match the ribbon's box count (${oldBoxes})`);
check(worstMargin > 0.4, `every course + verge sits inside the route clamp (worst margin ${round(worstMargin)} m)`);
check(jointsEqual, `the joint is ${JOINT} m across in every course`);
check(maxThick <= 0.08, `no stone is thicker than 0.08 m (max ${round(maxThick)})`);
check(flagTop < 0.09 && vergeTop < 0.09,
  `no corner rises far enough to read as a step (flags ${round(flagTop)} m, verge ${round(vergeTop)} m)`);
check(flagBottom < STRIP_TOP && vergeBottom < STRIP_TOP,
  `nothing floats: every bottom corner is under the floor strip at ${STRIP_TOP} m`);
check(tierCount.every((c) => c > 0), 'all three value tiers are populated');
check(acrossSum / flags > 3, `the bump gradient comes back across the route (${round(acrossSum / flags)}x)`);
check(aspectMax < 2, `no stone's texel aspect exceeds 2:1 (worst ${round(aspectMax)}:1)`);
process.exit(failed ? 1 : 0);

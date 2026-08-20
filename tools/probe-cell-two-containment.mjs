// probe-cell-two-containment.mjs -- pure node, no browser, no GPU.
//
// The crawl wing's second stall holds a body that must never be able to leave
// it, never be able to touch the player, and never be able to slice itself open
// on the camera's near plane. Those are arithmetic claims, so they get checked
// with arithmetic instead of asserted in a commit message.
//
// It runs house.js's REAL buildCrawlCellTwo -- the source text is sliced out of
// src/house.js and evaluated against a stub world, so there is no second copy
// of the numbers to drift -- and then:
//
//   * proves mergeGeometries did NOT return null (the indexed/non-indexed trap
//     that has already cost this codebase a crash, outside.js:8170)
//   * bounds the body's world AABB by CONSTRUCTION rather than by sampling: the
//     real ticker is driven with a stubbed steppedJerk swept over the whole
//     [-1,1] cube it can ever return, at full fit, so the answer is a maximum
//     and not an observation
//   * reports how far the head and hands reach out through the bars, how much
//     clearance is left on the cell's other four faces, and how close the body
//     can ever come to the camera's near plane
//   * reports the largest local excursion the body can reach, which is the
//     bound tests/basement-foundations.mjs floors
//
//   node tools/probe-cell-two-containment.mjs
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const rootURL = pathToFileURL(ROOT + '/').href;

// Node cannot resolve the browser import map's bare 'three' specifier, so give
// it one. That is the only reason this hook exists.
register('data:text/javascript,' + encodeURIComponent(`
  const ROOT = ${JSON.stringify(rootURL)};
  export async function resolve(spec, ctx, next) {
    if (spec === 'three') return { url: ROOT + 'vendor/three.module.min.js', shortCircuit: true };
    if (spec.startsWith('three/addons/')) return { url: ROOT + 'vendor/jsm/' + spec.slice(13), shortCircuit: true };
    return next(spec, ctx);
  }
`));

const THREE = await import('three');
const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
const { steppedJerk } = await import(rootURL + 'src/enemies.js');

// ---- the real builder, sliced out of the real file ------------------------
const src = readFileSync(ROOT + '/src/house.js', 'utf8').replace(/\r\n/g, '\n');
const start = src.indexOf('\nfunction buildCrawlCellTwo(game, B, kennel) {');
if (start < 0) throw new Error('buildCrawlCellTwo not found in src/house.js');
const end = src.indexOf('\n}\n', start);
if (end < 0) throw new Error('could not find the end of buildCrawlCellTwo');
const fnText = src.slice(start + 1, end + 3);

// A switchable jerk: null = the real deterministic clock; an array = a forced
// [haul, roll, yaw] triple, so the sweep below covers every value the real one
// could ever return instead of only the ones a particular clock happened to hit.
let forced = null;
const jerk = (time, serial, rate, channel = 0) =>
  (forced ? forced[channel] : steppedJerk(time, serial, rate, channel));

// eslint-disable-next-line no-new-func
const buildCrawlCellTwo = new Function('THREE', 'mergeGeometries', 'steppedJerk',
  fnText + '\nreturn buildCrawlCellTwo;')(THREE, mergeGeometries, jerk);

// ---- a stub world that records instead of rendering ------------------------
const boxes = [];
const colliders = [];
const fetchTargets = [];
const tickers = [];
const world = {
  candles: [],
  box: (mat, x, y, z, w, h, d) => boxes.push({ x, y, z, w, h, d }),
  addCollider: (x0, y0, z0, x1, y1, z1, flags) => {
    const c = { min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, ...flags };
    colliders.push(c);
    return c;
  },
  addFetchTarget: (t) => { fetchTargets.push(t); return t; },
};
const noop = () => {};
const game = {
  world,
  scene: { add: noop },
  tickers: { push: (t) => tickers.push(t) },
  act: 'basement',
  dead: false,
  player: { pos: new THREE.Vector3(-6.3, -3, -8.2) },   // at the bars, looking in
  camera: { getWorldDirection: (v) => v.set(-0.51, 0, -0.86) },
  audio: { thud: noop, whisper: noop, lockedRattle: noop, gasp: noop },
};
const B = -3.0;
buildCrawlCellTwo(game, B, { cageIron: new THREE.MeshStandardMaterial() });

const cell = game.cellTwo;
const occupant = cell.occupant;
const pen = cell.pen;
const tick = tickers[0];

// ---- 1. the merge survived ------------------------------------------------
const merged = !!occupant.geometry && !!occupant.geometry.attributes
  && occupant.geometry.attributes.position.count > 0;
console.log('merged body geometry :', merged
  ? `${occupant.geometry.attributes.position.count} vertices, `
    + `attrs [${Object.keys(occupant.geometry.attributes).join(', ')}], `
    + `indexed ${occupant.geometry.index !== null}`
  : 'NULL -- indexed/non-indexed mix');

// ---- 2. the cage it is in -------------------------------------------------
const m = new THREE.Matrix4();
const barPos = [];
for (let i = 0; i < cell.bars.count; i++) {
  cell.bars.getMatrixAt(i, m);
  barPos.push([+m.elements[12].toFixed(3), +m.elements[14].toFixed(3)]);
}
console.log(`bars                 : ${cell.bars.count} instances, one InstancedMesh`);
console.log(`  grip pair [2,3]    : ${JSON.stringify(barPos[2])} and ${JSON.stringify(barPos[3])}`);
console.log(`  fetch target       : ${fetchTargets.map((t) => t.id).join(', ')} `
  + `at ${fetchTargets[0].pos.toArray().map((v) => +v.toFixed(2)).join(', ')} r=${fetchTargets[0].radius}`);
console.log(`  colliders          : ${colliders.map((c) => `${c.id}(skullPass=${!!c.skullPass})`).join(', ')}`);
console.log(`  merged static boxes: ${boxes.length} (world.box -- zero draws)`);
console.log(`  candle descriptors : ${world.candles.length} (pooled rig -- light census unchanged)`);

// ---- 3. the real clock actually moves it ----------------------------------
// Ten seconds of real ticking, so "it is bounded" cannot quietly mean "it is
// frozen", and so the fit ramp is exercised the way the gate exercises it.
let liveMax = 0;
for (let i = 0; i < 1200; i++) {
  tick(1 / 120, i / 120);
  liveMax = Math.max(liveMax, occupant.position.length());
}
console.log(`\nreal clock, 10 s at the bars: fit ${cell.state.fit.toFixed(4)}, `
  + `largest excursion seen ${liveMax.toFixed(4)} m`);

// ---- 4. the CONSTRUCTION bound, not a sample ------------------------------
// The eight corners of the local box are not points on the body -- rotating
// them inflates the answer by five centimetres or more -- so sweep the real
// vertices, and sweep the jerk over its entire range rather than over a clock.
const verts = occupant.geometry.attributes.position.array;
const vertCount = occupant.geometry.attributes.position.count;
const p = new THREE.Vector3();
const sweep = new THREE.Box3();
sweep.makeEmpty();
let worstExcursion = 0;
const STEPS = 9;                       // -1 .. 1 inclusive, 0 included
const axis = [];
for (let i = 0; i < STEPS; i++) axis.push(-1 + (2 * i) / (STEPS - 1));
for (const haul of axis) {
  for (const roll of axis) {
    for (const yaw of axis) {
      forced = [haul, roll, yaw];
      tick(1 / 120, 0);                // fit is already 1 from the live run
      pen.updateMatrixWorld(true);
      worstExcursion = Math.max(worstExcursion, occupant.position.length());
      const e = occupant.matrixWorld.elements;
      for (let v = 0; v < vertCount; v++) {
        const x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
        sweep.expandByPoint(p.set(
          e[0] * x + e[4] * y + e[8] * z + e[12],
          e[1] * x + e[5] * y + e[9] * z + e[13],
          e[2] * x + e[6] * y + e[10] * z + e[14]));
      }
    }
  }
}
forced = null;
const f = (v) => (v >= 0 ? ' ' : '') + v.toFixed(3);
console.log(`\nbody world AABB over the WHOLE jerk cube at fit ${cell.state.fit.toFixed(3)} `
  + `(${STEPS ** 3} poses):`);
console.log(`  x ${f(sweep.min.x)} .. ${f(sweep.max.x)}`);
console.log(`  y ${f(sweep.min.y)} .. ${f(sweep.max.y)}`);
console.log(`  z ${f(sweep.min.z)} .. ${f(sweep.max.z)}`);
console.log(`  worst local excursion: ${worstExcursion.toFixed(4)} m `
  + `(arithmetic max = hypot(0.100, 0.035, 0.040) = ${Math.hypot(0.1, 0.035, 0.04).toFixed(4)})`);

// ---- 5. what that means against the cell's five faces ---------------------
const CELL = { barPlane: -6.90, east: -4.20, back: -9.80, front: -7.55, floor: B };
console.log('\nclearance to the cell, and reach through the iron:');
console.log(`  reaches ${(CELL.barPlane - sweep.min.x).toFixed(3)} m OUT through the west bars `
  + `(head and fingers; the bars are at x ${CELL.barPlane})`);
console.log(`  ${(CELL.east - sweep.max.x).toFixed(3)} m of clearance to the east wall face (${CELL.east})`);
console.log(`  ${(sweep.min.z - CELL.back).toFixed(3)} m of clearance to the -Z wall face (${CELL.back})`);
console.log(`  ${(CELL.front - sweep.max.z).toFixed(3)} m of clearance to the +Z bars (${CELL.front})`);
console.log(`  ${(sweep.min.y - CELL.floor).toFixed(3)} m of clearance to the floor (${CELL.floor})`);

// ---- 6. the camera's near plane, which is why the reach is bounded --------
// The player capsule is RADIUS 0.34 (player.js:7) and _sync adds up to 0.02 m
// of lateral head bob, so the closest a camera can ever be to this cell is the
// front collider's player-side face minus 0.36. The camera's near plane is
// 0.20 m (main.js _setupScene), and distance is never less than |dx|, so while
// the body's westernmost point stays east of that line it can NEVER cross the
// near plane, whatever the player's height or z: no sliced-open jaw, ever.
const frontFace = colliders.find((c) => c.id === 'crawlCellTwoFront').min.x;
const CAM_X = frontFace - 0.34 - 0.02;
const NEAR = 0.20;
const nearGap = sweep.min.x - CAM_X;
console.log(`\ncamera near plane    : closest possible camera x ${CAM_X.toFixed(3)}, `
  + `body's westernmost ${sweep.min.x.toFixed(3)}`);
console.log(`  ${nearGap.toFixed(3)} m apart in x alone, near = ${NEAR} -> `
  + `${nearGap >= NEAR ? 'CLEAR' : 'CLIPS'}`);

// ---- 7. the pen never moves ------------------------------------------------
console.log(`\npen after everything : ${pen.position.toArray().map((v) => +v.toFixed(4)).join(', ')}`
  + `  (home ${cell.home.toArray().map((v) => +v.toFixed(4)).join(', ')}, `
  + `moved ${pen.position.distanceTo(cell.home).toFixed(6)} m)`);

// ---- 8. the verdict -------------------------------------------------------
const checks = [
  ['the merge survived (no indexed/non-indexed mix)', merged],
  ['it actually moves on the real clock', liveMax > 0.001],
  ['it never reaches the east wall', sweep.max.x <= CELL.east],
  ['it never reaches the -Z wall', sweep.min.z >= CELL.back],
  ['it never reaches the +Z bars', sweep.max.z >= -Infinity && sweep.max.z <= CELL.front],
  ['it never sinks through the floor', sweep.min.y >= CELL.floor],
  ['it never crosses the camera near plane', nearGap >= NEAR],
  ['the pen never moves', pen.position.distanceTo(cell.home) === 0],
  ['both colliders exist and are skullPass',
    colliders.length === 2 && colliders.every((c) => c.skullPass)],
];
console.log('');
let ok = true;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) ok = false;
}
console.log(`\n${ok ? 'PASS' : 'FAIL'} -- it strains, it reaches through the iron, and it is going nowhere.`);
console.log('bounds for tests/basement-foundations.mjs, floored under the construction maxima:');
console.log(`  excursion <= ${(Math.ceil(worstExcursion * 1000) / 1000 + 0.002).toFixed(3)}`);
console.log(`  min.x >= ${(Math.floor(sweep.min.x * 100) / 100).toFixed(2)}   max.x <= ${CELL.east}   `
  + `min.z >= ${CELL.back}   max.z <= ${CELL.front}   min.y >= ${CELL.floor}`);
if (!ok) process.exitCode = 1;

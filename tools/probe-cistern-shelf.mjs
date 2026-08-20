// Round fourteen, item 3 and the census behind it: WHICH DRAWN THINGS IN THE
// UNDERFALLS CAN YOU STAND INSIDE. It does not re-model any builder. It loads
// the vendored three, the real createUnderfallsLayout, and the shipping
// buildBellCistern / buildPumpChapel / buildHatchCistern, hands them stub
// materials and a stub world, and then reads every triangle back off the
// meshes that code actually composed -- instance matrices and world.box boxes
// included. It is the second opinion on the ledger in tests/underfalls-
// expansion.mjs: that gate measures the PRISMS src/underfalls.js publishes,
// this one measures the triangles three would draw.
//
//   node tools/probe-cistern-shelf.mjs
//
// The question, as always here, is never "did it draw" but "can you stand in
// it". A pose is one the district clamp will hold when the union clearance is
// <= -0.04 (installClamp) AND no collider pushes the player off it (player.js
// _moveAxis: closest point in XZ, RADIUS 0.34, skipping colliders that top out
// under feet+STEP_UP or start above feet+HEAD). The camera rides EYE 1.62 over
// that pose plus or minus 0.02 of world X from the bob the clamp never sees.
//
// A drawn silhouette is IN THE HEAD WINDOW when it reaches above feet+STEP_UP
// (0.5) and starts below feet+HEAD (1.75) -- the player's own two collider
// tests, quoted, and measured per pose against THAT pose's feet because this
// district's floor runs 0.00 to 3.20. Anything wholly outside that band is
// stepped over or walked under and is not a wall you walk through. What is
// inside it has to keep its guard's distance from every reachable pose, and
// anything within 0.24 of the camera is being eaten by the 0.2 near plane.
// It also reports the two gates a new collider has to pass -- the centreline
// check in tests/underfalls-expansion.mjs and the 0.42 m footprint enemies.js
// sweeps through every AABB -- and whether anything drawn hangs off the edge
// of a chamber's sixteen-gon floor.
import { register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = (p) => pathToFileURL(resolve(ROOT, p)).href;

const HOOK = [
  `const VENDOR = ${JSON.stringify(`${url('vendor')}/`)};`,
  `const UNDER = ${JSON.stringify(url('src/underfalls.js'))};`,
  "export async function resolve(spec, ctx, next) {",
  "  if (spec === 'three') return { url: VENDOR + 'three.module.min.js', shortCircuit: true };",
  "  if (spec.startsWith('three/addons/'))",
  "    return { url: VENDOR + 'jsm/' + spec.slice('three/addons/'.length), shortCircuit: true };",
  "  return next(spec, ctx);",
  "}",
  "export async function load(u, ctx, next) {",
  "  const r = await next(u, ctx);",
  "  if (u !== UNDER) return r;",
  "  return { ...r, source: `${r.source}\\nexport { buildBellCistern, buildPumpChapel, buildHatchCistern };\\n` };",
  "}",
].join('\n');
register(`data:text/javascript;base64,${Buffer.from(HOOK, 'utf8').toString('base64')}`, import.meta.url);

const THREE = await import('three');
const {
  createUnderfallsLayout, projectUnderfalls, underfallsGroundAt,
  UNDERFALLS_SOLID_PAD: PAD, buildBellCistern, buildPumpChapel, buildHatchCistern,
} = await import(url('src/underfalls.js'));

const EYE = 1.62;        // player.js
const RADIUS = 0.34;     // player.js
const STEP_UP = 0.5;     // player.js
const HEAD = 1.75;       // player.js
const BOB_X = 0.02;      // player.js _sync
const NEAR = 0.24;       // main.js camera near 0.2 + the 0.04 the clamp leaves
const LEGAL = -0.04;     // the clearance at which postClamp still holds a pose
// What a face is owed depends on what is holding the player off it. The clamp
// has an 0.08 dead band, so a clamp-guarded face owes UNDERFALLS_SOLID_PAD.
// A collider has none -- _moveAxis puts the centre exactly RADIUS from the
// AABB -- but the head bob then slides the camera up to 0.02 of world X
// further in without the collider ever seeing it, so a collider-guarded face
// owes RADIUS - BOB_X. Both are well past the near plane.
const BODY = RADIUS - BOB_X;

const r3 = (n) => (Number.isFinite(n) ? +n.toFixed(3) : n);
let failures = 0;
const report = (ok, line) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };

// ------------------------------------------------------- run the real builders
const layout = createUnderfallsLayout({ x: 0, y: 0, z: 0 });
const mats = new Proxy({}, {
  get(store, key) {
    if (typeof key !== 'string') return undefined;
    if (!(key in store)) store[key] = new THREE.MeshStandardMaterial();
    return store[key];
  },
});
const boxes = [];
const colliders = [];
const world = {
  colliders,
  candles: [],
  registerInteract() { },
  box(mat, x, y, z, w, h, d, ry = 0) { boxes.push({ name: 'world.box', x, y, z, w, h, d, ry }); },
  addCollider(x0, y0, z0, x1, y1, z1, flags) {
    const c = {
      min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) },
      max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) },
      ...flags,
    };
    colliders.push(c);
    return c;
  },
};
const scene = new THREE.Group();
const game = { scene, world, mats };
const state = { lights: [] };
buildBellCistern(game, layout, state);
buildPumpChapel(game, layout, state);
buildHatchCistern(game, layout, state);
// world.box draws into a merged static shell rather than into the scene graph,
// so re-materialise each one as the oriented box it is. The hatch chamber's
// three shell walls are the only body-height boxes these three builders make
// this way; the floor slab and the cap come with them and fall out of the head
// window on their own.
for (const b of boxes) {
  const g = new THREE.BoxGeometry(b.w, b.h, b.d);
  if (b.ry) g.rotateY(b.ry);
  g.translate(b.x, b.y, b.z);
  const mesh = new THREE.Mesh(g, null);
  mesh.name = `world.box ${r3(b.w)}x${r3(b.h)}x${r3(b.d)} at ${r3(b.x)},${r3(b.y)},${r3(b.z)}`;
  scene.add(mesh);
}

// ------------------------------------------------------------ drawn triangles
scene.updateMatrixWorld(true);
const tmpM = new THREE.Matrix4();
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
function trianglesOf(mesh, matrix) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index ? [...g.index.array] : [...Array(pos.count).keys()];
  const out = [];
  for (let i = 0; i < idx.length; i += 3) {
    va.fromBufferAttribute(pos, idx[i]).applyMatrix4(matrix);
    vb.fromBufferAttribute(pos, idx[i + 1]).applyMatrix4(matrix);
    vc.fromBufferAttribute(pos, idx[i + 2]).applyMatrix4(matrix);
    out.push([va.clone(), vb.clone(), vc.clone()]);
  }
  return out;
}
const drawn = [];
function collect(o) {
  if (o.isInstancedMesh) {
    const tris = [];
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, tmpM);
      tris.push(...trianglesOf(o, tmpM.premultiply(o.matrixWorld)));
    }
    drawn.push({ name: o.name || '(unnamed instances)', tris, instances: o.count });
  } else if (o.isMesh) {
    drawn.push({ name: o.name || o.geometry.type, tris: trianglesOf(o, o.matrixWorld), instances: 1 });
  }
  o.children.forEach(collect);
}
scene.children.forEach(collect);
for (const d of drawn) {
  let minY = Infinity, maxY = -Infinity;
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const t of d.tris) {
    for (const v of t) {
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
      if (v.x < b.minX) b.minX = v.x;
      if (v.x > b.maxX) b.maxX = v.x;
      if (v.z < b.minZ) b.minZ = v.z;
      if (v.z > b.maxZ) b.maxZ = v.z;
    }
  }
  d.minY = minY; d.maxY = maxY; d.bounds = b;
}

// ------------------------------------------------------------ reachable poses
const REACH = 3.0;
const area = drawn.reduce((b, d) => ({
  minX: Math.min(b.minX, d.bounds.minX), maxX: Math.max(b.maxX, d.bounds.maxX),
  minZ: Math.min(b.minZ, d.bounds.minZ), maxZ: Math.max(b.maxZ, d.bounds.maxZ),
}), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
const blockedBy = (x, z, feet) => colliders.find((c) => {
  if (c.max.y <= feet + STEP_UP) return false;
  if (c.min.y >= feet + HEAD) return false;
  const qx = Math.max(c.min.x, Math.min(x, c.max.x));
  const qz = Math.max(c.min.z, Math.min(z, c.max.z));
  return Math.hypot(x - qx, z - qz) < RADIUS;
});
const poses = [];
for (let x = area.minX - REACH; x <= area.maxX + REACH; x += 0.05) {
  for (let z = area.minZ - REACH; z <= area.maxZ + REACH; z += 0.05) {
    const p = projectUnderfalls(layout, x, z);
    if (!p || p.clearance > LEGAL) continue;
    const feet = underfallsGroundAt(layout, x, z);
    if (feet == null) continue;
    if (blockedBy(x, z, feet)) continue;
    for (const bob of [-BOB_X, 0, BOB_X]) poses.push({ x: x + bob, z, feet });
  }
}
const CELL = 2.0, BUCKETS = new Map();
for (const p of poses) {
  const k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
  let l = BUCKETS.get(k); if (!l) BUCKETS.set(k, l = []); l.push(p);
}
function posesNear(bounds, reach) {
  const out = [], span = Math.ceil(reach / CELL) + 1;
  const x0 = Math.floor(bounds.minX / CELL), x1 = Math.floor(bounds.maxX / CELL);
  const z0 = Math.floor(bounds.minZ / CELL), z1 = Math.floor(bounds.maxZ / CELL);
  for (let i = x0 - span; i <= x1 + span; i++) {
    for (let j = z0 - span; j <= z1 + span; j++) {
      const l = BUCKETS.get(`${i},${j}`); if (l) out.push(...l);
    }
  }
  return out;
}

// point-to-triangle, verbatim from tools/probe-mica-pump.mjs
function pointToTriangle(p, a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return a.clone();
  const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return b.clone();
  const vc2 = d1 * d4 - d3 * d2;
  if (vc2 <= 0 && d1 >= 0 && d3 <= 0) return a.clone().add(ab.clone().multiplyScalar(d1 / (d1 - d3)));
  const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return c.clone();
  const vb2 = d5 * d2 - d1 * d6;
  if (vb2 <= 0 && d2 >= 0 && d6 <= 0) return a.clone().add(ac.clone().multiplyScalar(d2 / (d2 - d6)));
  const va2 = d3 * d6 - d5 * d4;
  if (va2 <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return b.clone().add(c.clone().sub(b).multiplyScalar((d4 - d3) / ((d4 - d3) + (d5 - d6))));
  }
  const denom = 1 / (va2 + vb2 + vc2);
  return a.clone().add(ab.clone().multiplyScalar(vb2 * denom)).add(ac.clone().multiplyScalar(vc2 * denom));
}

const camera = new THREE.Vector3();
function measure(d) {
  let bodyGap = Infinity, bodyAt = null, camGap = Infinity, camAt = null, camHit = null;
  const reach = PAD + RADIUS + 1.2;
  for (const p of posesNear(d.bounds, reach)) {
    const lo = p.feet + STEP_UP, hi = p.feet + HEAD;
    if (d.maxY <= lo || d.minY >= hi) continue;
    camera.set(p.x, p.feet + EYE, p.z);
    for (const t of d.tris) {
      const tMinY = Math.min(t[0].y, t[1].y, t[2].y);
      const tMaxY = Math.max(t[0].y, t[1].y, t[2].y);
      if (tMaxY <= lo || tMinY >= hi) continue;
      const q = pointToTriangle(camera, t[0], t[1], t[2]);
      const flat = Math.hypot(p.x - q.x, p.z - q.z);
      if (flat < bodyGap) { bodyGap = flat; bodyAt = [r3(p.x), r3(p.z), r3(p.feet)]; }
      const solid = q.distanceTo(camera);
      if (solid < camGap) {
        camGap = solid;
        camAt = [r3(p.x), r3(p.z), r3(p.feet)];
        camHit = [r3(q.x), r3(q.y), r3(q.z)];
      }
    }
  }
  return { bodyGap, bodyAt, camGap, camAt, camHit };
}

// ------------------------------------------------------------------- the census
console.log(`drawn:     ${drawn.length} batches from buildBellCistern + buildPumpChapel`);
console.log(`poses:     ${poses.length} clamp-legal, collider-free stands over the two rooms`);
console.log(`colliders: ${colliders.length} -- ${colliders.map((c) => c.role).join(', ')}`);
console.log('');
console.log('  name                                          y span         head?  body gap  cam gap');
// THE HEAD WINDOW IS FEET-RELATIVE, and this district's floor runs 0.00 to
// 3.20. Testing a world y against a bare 0.5 would call the bell cistern's
// keepsake shelf (world 1.88..2.06 over a 1.25 floor) overhead. measure() does
// the band test per pose against that pose's own feet, so a batch is in the
// window exactly when some reachable pose has it there -- which is also the
// only definition under which the question means anything.
const rows = [];
for (const d of drawn) {
  const m = measure(d);
  const inWindow = Number.isFinite(m.bodyGap);
  rows.push({ ...d, inWindow, ...m });
  console.log(`  ${`${d.name} x${d.instances}`.padEnd(44)} ${String(r3(d.minY)).padStart(6)}..${String(r3(d.maxY)).padEnd(7)}`
    + ` ${inWindow ? ' yes ' : ' no  '} ${String(r3(m.bodyGap)).padStart(8)} ${String(r3(m.camGap)).padStart(8)}`
    + (m.bodyAt ? `  body at ${JSON.stringify(m.bodyAt)} cam at ${JSON.stringify(m.camAt)} hit ${JSON.stringify(m.camHit)}` : ''));
}
console.log('');

for (const row of rows) {
  if (!row.inWindow || !Number.isFinite(row.bodyGap)) continue;
  report(row.bodyGap >= BODY - 1e-3,
    `${row.name}: nearest reachable stand is ${r3(row.bodyGap)} m from the drawn face`
    + ` (collider floor ${r3(BODY)}, clamp pad ${PAD}${row.bodyGap < PAD - 1e-3 ? ' -- UNDER THE CLAMP PAD, so this one had better be behind a collider' : ''})`
    + `${row.bodyGap < 1e-3 ? ' -- YOU STAND INSIDE IT' : ''}`);
  report(row.camGap >= NEAR - 1e-3,
    `${row.name}: nearest the camera gets to it in 3D is ${r3(row.camGap)} m (near ${NEAR})`);
}

// ------------------------------------------- the two gates a collider must pass
// 1. tests/underfalls-expansion.mjs walks both polylines every 0.55 m and fails
//    any authored underfalls collider whose AABB, inflated by 0.32, contains a
//    sample that its height window overlaps. That is the "never counterfeit or
//    clip either centreline" check, replayed here verbatim.
// 2. enemies.js sweeps the Choir's 0.42 m footprint through every AABB when
//    findUnderfallsRoute asks whether a node chord is open, so a box that comes
//    within 0.42 m of a chord closes a navigation edge.
console.log('');
const samples = [];
for (const path of [layout.main, layout.secret]) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / 0.55));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  samples.push({ ...path[path.length - 1] });
}
let worstSample = { margin: Infinity, role: null, at: null };
for (const c of colliders) {
  for (const s of samples) {
    if (!(c.max.y > s.y + 0.55 && c.min.y < s.y + 1.75)) continue;
    // the gate's own predicate: contained on BOTH axes is a failure, so the
    // margin is how far the sample is outside the nearer of the two.
    const mx = Math.max(c.min.x - 0.32 - s.x, s.x - (c.max.x + 0.32));
    const mz = Math.max(c.min.z - 0.32 - s.z, s.z - (c.max.z + 0.32));
    const margin = Math.max(mx, mz);
    if (margin < worstSample.margin) worstSample = { margin, role: c.role, at: [r3(s.x), r3(s.z)] };
  }
}
report(worstSample.margin > 0,
  `centreline gate: closest route sample to any of these colliders clears the inflated`
  + ` box by ${r3(worstSample.margin)} m (${worstSample.role} at ${JSON.stringify(worstSample.at)})`);

// The Choir's footprint is swept as a slab against the AABB GROWN BY ITS
// RADIUS -- a Minkowski box, corners included -- not as a rounded capsule.
// enemies.js _choirRouteEdgeClear, verbatim, because the difference is not
// academic: measuring corner distance instead called a 1.15 m bell collider
// clear of the bell-cistern chord by 0.496 m when the real test blocks it.
const CHOIR_R = 0.42;
const chordEntersBox = (a, b, c, r) => {
  let lo = 0.002, hi = 0.998;
  const axes = [[a.x, b.x - a.x, c.min.x - r, c.max.x + r],
    [a.z, b.z - a.z, c.min.z - r, c.max.z + r]];
  for (const [o, d, min, max] of axes) {
    if (Math.abs(d) < 1e-8) { if (o < min || o > max) return false; continue; }
    let t0 = (min - o) / d, t1 = (max - o) / d;
    if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
    lo = Math.max(lo, t0); hi = Math.min(hi, t1);
    if (lo > hi) return false;
  }
  return true;
};
// A chord the corridor union already refuses costs the Choir nothing, so only
// live ones count. underfallsLineOfSight's dominant filter, replayed.
const unionChordOpen = (a, b) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.32));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = projectUnderfalls(layout, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (!p || p.clearance > -0.2 + 1e-4) return false;
  }
  return true;
};
const navNodes = [];
const navSeen = new Set();
for (const p of [...layout.main, ...layout.secret, ...layout.chambers,
  ...layout.navigationWaypoints]) {
  const key = p.x.toFixed(3) + ',' + p.z.toFixed(3);
  if (!navSeen.has(key)) { navSeen.add(key); navNodes.push(p); }
}
const lost = [];
for (const c of colliders) {
  for (let i = 0; i < navNodes.length; i++) {
    for (let j = i + 1; j < navNodes.length; j++) {
      const a = navNodes[i], b = navNodes[j];
      if (!chordEntersBox(a, b, c, CHOIR_R)) continue;
      if (!unionChordOpen(a, b)) continue;
      lost.push(c.role + ': ' + a.name + ' -> ' + b.name);
    }
  }
}
// THE BASELINE, MEASURED ON THE PARENT COMMIT (8debd96) RATHER THAN ASSUMED.
// Fourteen live chords are already closed by the fixtures this district had
// before round fourteen touched it -- seven nave pillars, the pump altar and
// the piston fill the chapel, and the bell costs the one chord round thirteen
// measured and accepted (pump undercroft -> service climb, 0.57 m of detour
// through the cistern node). This list is that baseline. A new entry is a
// navigation edge round fourteen spent, and it has to be argued, not
// discovered later: at 0.63 the pillars closed 'chapel east aisle -> dry
// return', which is why that number is 0.54.
//
// THE BELL'S LINE SAYS 'hung bell' NOW, AND IT IS THE SAME CHORD. This baseline
// was taken while the bell lay on the floor behind a role called 'fallen bell'
// with a 1.03 box 2.20 m off the node. Round fourteen's bell branch hung it
// back on its chain, which took the box to half 0.62 at round thirteen's
// 1.95 m -- SMALLER than the 0.75 round thirteen shipped, so it cannot cost a
// chord that box did not. The set is unchanged, entry for entry; only the role
// name moved. (The old note here about half-extent 1.15 also closing
// 'bell cistern -> service climb' was measured at the 2.20 m offset and is
// deleted with it rather than left standing over geometry that is gone.)
const KNOWN = [
  'hung bell: pump undercroft -> service climb',
  'pump chapel pillar: undertow throat -> bell cistern',
  'pump chapel pillar: pump approach -> chapel north transept',
  'pump chapel pillar: chapel west aisle -> east ambulatory',
  'pump chapel pillar: dry return -> chapel north transept',
  'pump chapel pillar: pump approach -> bell cistern',
  'pump chapel pillar: dry return -> bell cistern',
  'pump chapel pillar: pump undercroft -> service climb',
  'pump chapel pillar: bell cistern -> drowned pump chapel',
  'pump chapel pillar: east ambulatory -> pump undercroft',
  'pump chapel pillar: east ambulatory -> drowned pump chapel',
  'pump altar: chapel west aisle -> east ambulatory',
  'pump altar: east ambulatory -> drowned pump chapel',
  'pump piston: east ambulatory -> drowned pump chapel',
];
const unexpected = lost.filter((line) => !KNOWN.includes(line));
report(unexpected.length === 0,
  'Choir nav: ' + lost.length + ' live chord(s) blocked -- ' + JSON.stringify(lost)
  + (unexpected.length ? '  NEW: ' + JSON.stringify(unexpected) : ''));

// ----------------------------------------- is the drawn thing ON the drawn floor
// The chamber discs are CylinderGeometry(1,1,1,16) scaled by r * 1.02, so their
// real edge runs between a 3.4514 apothem and a 3.519 circumradius on a 3.45 m
// room. Anything drawn past the apothem is over the 0x03050c background.
console.log('');
for (const chamber of layout.chambers) {
  const apothem = chamber.r * 1.02 * Math.cos(Math.PI / 16);
  let worst = { over: -Infinity, name: null };
  for (const d of drawn) {
    if (!d.tris.length) continue;
    for (const t of d.tris) {
      for (const v of t) {
        const rad = Math.hypot(v.x - chamber.x, v.z - chamber.z);
        // only judge things that BELONG to this chamber: a vertex three rooms
        // away is not hanging off this floor.
        if (rad > chamber.r * 1.35) continue;
        if (rad - apothem > worst.over) worst = { over: rad - apothem, name: d.name, rad };
      }
    }
  }
  if (worst.name) {
    console.log(`  ${chamber.name}: floor edge ${r3(apothem)}..${r3(chamber.r * 1.02)},`
      + ` furthest drawn vertex ${r3(worst.rad)} (${worst.name})`);
  }
}

console.log('');
console.log(failures ? `FAIL: ${failures} checks` : 'PASS: every drawn silhouette in the head window keeps the pad');
process.exit(failures ? 1 : 0);

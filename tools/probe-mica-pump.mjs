// Second opinion on round fourteen's two pump-district walk-throughs: the mica
// trail (src/atmosphere.js) and the pump altar's flywheel and piston
// (src/underfalls.js). It does not re-model either one. It BUILDS THE SHIPPING
// CAVE DRESSING -- the real buildCaveDress, the real RNG, the real layout --
// and reads every crystal back off the matrices that code composed; and it
// reads the two collider radii straight out of the source text, so changing
// them re-measures rather than re-blesses.
//
// The question is never "did it draw" but "can you stand in it". A pose is one
// the clamp will hold when the route union's clearance is <= -0.04; the camera
// rides EYE 1.62 above the floor there, plus 0.05 of running bob or minus 0.14
// of landing dip, and plus or minus 0.02 of world X. Every drawn surface has to
// stay UNDERFALLS_SOLID_PAD from all of them, and anything inside 0.24 is being
// clipped by the 0.2 near plane -- that is the "wall you can see through" in
// his screenshots, and it is the same defect as the wall you walk through.
//
//   node tools/probe-mica-pump.mjs
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = (p) => pathToFileURL(resolve(ROOT, p)).href;

// Resolve the browser import map ('three', 'three/addons/') the way index.html
// does, and hand buildCaveDress out of atmosphere.js without touching the file.
const HOOK = [
  `const VENDOR = ${JSON.stringify(`${url('vendor')}/`)};`,
  `const ATMOS = ${JSON.stringify(url('src/atmosphere.js'))};`,
  "export async function resolve(spec, ctx, next) {",
  "  if (spec === 'three') return { url: VENDOR + 'three.module.min.js', shortCircuit: true };",
  "  if (spec.startsWith('three/addons/'))",
  "    return { url: VENDOR + 'jsm/' + spec.slice('three/addons/'.length), shortCircuit: true };",
  "  return next(spec, ctx);",
  "}",
  "export async function load(u, ctx, next) {",
  "  const r = await next(u, ctx);",
  "  if (u !== ATMOS) return r;",
  "  return { ...r, source: `${r.source}\\nexport { buildCaveDress };\\n` };",
  "}",
].join('\n');
register(`data:text/javascript;base64,${Buffer.from(HOOK, 'utf8').toString('base64')}`, import.meta.url);

const THREE = await import('three');
const { buildCaveDress } = await import(url('src/atmosphere.js'));
const {
  createUnderfallsLayout, projectUnderfalls, underfallsGroundAt, UNDERFALLS_SOLID_PAD: PAD,
} = await import(url('src/underfalls.js'));

const EYE = 1.62;        // player.js
const RADIUS = 0.34;     // player.js
const BOB_X = 0.02;      // player.js _sync
const NEAR = 0.24;       // main.js camera near 0.2 + the 0.04 of slack the clamp leaves
const LEGAL = -0.04;     // the clearance at which postClamp still holds a pose

const layout = createUnderfallsLayout({ x: 0, z: 0 });
const legal = (x, z) => projectUnderfalls(layout, x, z).clearance <= LEGAL;
let failures = 0;
const report = (ok, line) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`);
};

// ----------------------------------------------------------------- the mica
const scene = new THREE.Group();
buildCaveDress(
  {
    clearingCenter: { x: 0, z: 0 },
    underfalls: { layout },
    mats: {},
    scene,
    world: { groundHeightAt: () => 0, candles: [] },
  },
  (object) => scene.add(object), (x) => x, [],
);
const trail = [];
const collect = (o) => {
  if (/mica trail/.test(o.name || '')) trail.push(o);
  o.children.forEach(collect);
};
scene.children.forEach(collect);

// The culling and choir-occlusion regressions find this batch BY NAME and the
// other two tiers hang off it, so an empty tier one would take the trail with it.
report(
  trail.length === 3 && trail[0].name === 'cave mica trail (grows toward the way out)'
    && trail.every((m) => m.count > 0),
  `mica batches: ${trail.map((m) => `${m.name}=${m.count}`).join(', ')}`,
);

const geo = new THREE.OctahedronGeometry(1, 0);
const index = geo.index ? [...geo.index.array] : [...Array(geo.attributes.position.count).keys()];
function pointToTriangle(p, a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return a.clone();
  const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return b.clone();
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return a.clone().add(ab.clone().multiplyScalar(d1 / (d1 - d3)));
  const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return c.clone();
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return a.clone().add(ac.clone().multiplyScalar(d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return b.clone().add(c.clone().sub(b).multiplyScalar((d4 - d3) / ((d4 - d3) + (d5 - d6))));
  }
  const denom = 1 / (va + vb + vc);
  return a.clone()
    .add(ab.clone().multiplyScalar(vb * denom))
    .add(ac.clone().multiplyScalar(vc * denom));
}

const m4 = new THREE.Matrix4();
const axis = new THREE.Vector3(), spin = new THREE.Quaternion(), size = new THREE.Vector3();
const camera = new THREE.Vector3();
let crystals = 0, bodyInside = 0, clipped = 0, breaksPad = 0;
let worstGap = Infinity, worstAt = null;
for (const mesh of trail) {
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m4);
    m4.decompose(axis, spin, size);
    crystals++;
    if (legal(axis.x, axis.z)) bodyInside++;    // you can stand ON its axis
    const points = [];
    const attr = geo.attributes.position;
    for (let k = 0; k < attr.count; k++) {
      points.push(new THREE.Vector3().fromBufferAttribute(attr, k).applyMatrix4(m4));
    }
    let gap = Infinity;
    for (let a = 0; a < 240; a++) {
      const theta = a * Math.PI / 120, ux = Math.cos(theta), uz = Math.sin(theta);
      for (let r = 0.01; r <= 3.5; r += 0.01) {
        const px = axis.x + ux * r, pz = axis.z + uz * r;
        if (!legal(px, pz)) continue;
        const floor = underfallsGroundAt(layout, px, pz) ?? 0;
        for (const bx of [-BOB_X, 0, BOB_X]) {
          for (const lift of [-0.14, 0, 0.05]) {
            camera.set(px + bx, floor + EYE + lift, pz);
            for (let t = 0; t < index.length; t += 3) {
              gap = Math.min(gap, pointToTriangle(
                camera, points[index[t]], points[index[t + 1]], points[index[t + 2]],
              ).distanceTo(camera));
            }
          }
        }
        break;
      }
    }
    if (gap < NEAR) clipped++;
    if (gap < PAD) breaksPad++;
    if (gap < worstGap) { worstGap = gap; worstAt = `(${axis.x.toFixed(2)}, ${axis.z.toFixed(2)})`; }
  }
}
report(bodyInside === 0, `mica crystals whose own axis is a pose the clamp will hold: ${bodyInside} of ${crystals}`);
report(clipped === 0, `mica crystals inside the 0.2 near plane: ${clipped} of ${crystals}`);
report(breaksPad === 0, `mica crystals closer than THE ONE PAD (${PAD}): ${breaksPad} of ${crystals}`);
report(worstGap >= PAD, `worst camera-to-crystal gap in the district: ${worstGap.toFixed(3)} m at ${worstAt}`);

// ---------------------------------------------------- the pump altar's iron
// Read the shipped radii rather than restating them: change a collider and this
// re-measures instead of re-blessing.
const SRC = readFileSync(resolve(ROOT, 'src/underfalls.js'), 'utf8');
const grab = (role) => {
  const m = SRC.match(new RegExp(
    `addColliderCylinder\\(world,[^;]*?,\\s*([0-9.]+),\\s*(-?[0-9.]+),\\s*([0-9.]+),\\s*\\r?\\n?\\s*'${role}'`,
  ));
  return m ? { half: +m[1], y0: +m[2], y1: +m[3] } : null;
};
const altar = grab('pump altar');
const piston = grab('pump piston');
report(!!altar, `'pump altar' collider found in src/underfalls.js${altar ? ` (half ${altar.half})` : ''}`);
report(!!piston, `'pump piston' collider found in src/underfalls.js${piston ? ` (half ${piston.half})` : ''}`);

const chapel = layout.chapel;
const west = layout.named['chapel west aisle'], east = layout.named['chapel east aisle'];
const yaw = Math.atan2(east.x - west.x, east.z - west.z);
const A = { x: chapel.x + 6.05, z: chapel.z - 4.15 };                          // altar axis
const P = { x: A.x + Math.sin(yaw) * 1.85, z: A.z + Math.cos(yaw) * 1.85 };    // piston axis
const RING = 1.38, TUBE = 0.14;      // TorusGeometry(1.38, 0.14), plane = world ZY
const PISTON_R = 0.27;               // CylinderGeometry(0.22, 0.27, 2.5, 7)
const boxDistance = (x, z, c, half) =>
  Math.hypot(Math.max(Math.abs(x - c.x) - half, 0), Math.max(Math.abs(z - c.z) - half, 0));
const stopped = (x, z) =>
  (!!altar && boxDistance(x, z, A, altar.half) < RADIUS - 1e-9)
  || (!!piston && boxDistance(x, z, P, piston.half) < RADIUS - 1e-9);

// The wheel spins about its OWN axis, so its silhouette is a fixed circle of
// iron 1.52 m from the altar axis; the piston only ever moves in y.
let wheelGap = Infinity, pistonGap = Infinity;
for (let a = 0; a < 4000; a++) {
  const theta = a * Math.PI * 2 / 4000, ux = Math.cos(theta), uz = Math.sin(theta);
  for (let r = 0.1; r <= 6; r += 0.002) {
    const px = A.x + ux * r, pz = A.z + uz * r;
    if (stopped(px, pz)) continue;
    if (!legal(px, pz)) break;
    for (const bx of [-BOB_X, 0, BOB_X]) {
      for (let cy = EYE - 0.14; cy <= EYE + 0.051; cy += 0.005) {
        wheelGap = Math.min(
          wheelGap,
          Math.hypot(px + bx - A.x, Math.hypot(cy - 1.55, pz - A.z) - RING) - TUBE,
        );
        pistonGap = Math.min(pistonGap, Math.hypot(px + bx - P.x, pz - P.z) - PISTON_R);
      }
    }
    break;
  }
}
report(
  wheelGap >= PAD,
  `pump flywheel: closest camera to its iron ${wheelGap.toFixed(3)} m`
  + ` (altar collider half ${altar ? altar.half : 'MISSING'})`,
);
report(
  pistonGap >= PAD,
  `pump piston: closest camera to its iron ${pistonGap.toFixed(3)} m`
  + ` (piston collider half ${piston ? piston.half : 'MISSING'})`,
);
report(
  !!piston && piston.y1 >= 2.99 && piston.y0 <= 0,
  `pump piston collider spans its whole stroke (drawn y -0.09..2.99): ${piston ? `${piston.y0}..${piston.y1}` : 'MISSING'}`,
);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);

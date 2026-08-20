// Pure-node replay of the Underfalls WAYFINDING TIER placement math -- the pale
// turn markers and the pale chamber doorjambs (src/underfalls.js, the block
// commented "wayfinding tier"). Sibling of tools/probe-district-walls.mjs,
// which did the same for the flank walls and the sluice gates in round
// thirteen; this one covers the two pale fixtures that fix left behind.
//
//   node tools/probe-wayfinding-tier.mjs
//
// The question is the same one: how close does a DRAWN face get to a pose the
// lateral clamp will actually hold? Camera near plane is 0.2 (main.js) and
// installClamp returns early at clearance <= -0.04, so a face inside ~0.2 m of
// a legal stand is clipped away and the player looks straight through it.
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
  createUnderfallsLayout, projectUnderfalls, UNDERFALLS_SOLID_PAD,
} = U;

const L = createUnderfallsLayout({ x: 0, y: 0, z: 0 });
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r3 = (n) => (n === null || n === undefined ? 'n/a' : +n.toFixed(3));

// --- every pose the clamp will hold, plus the head bob it never sees --------
// NO DEPTH CUTOFF. probe-district-walls.mjs drops poses below clearance -1.2
// because a flank wall stands on the lane edge and cannot possibly be nearest
// to a pose deep in the lane. That shortcut is WRONG here: a jamb offset
// against its own segment's w lands in the MIDDLE of a neighbouring corridor
// (main#5's south jamb sits 2.53 m inside main#6), and with the cutoff on,
// that jamb reported a comfortable 0.727 m gap it does not have.
function reachablePoses(step = 0.05) {
  const poses = [];
  const b = L.bounds;
  for (let x = b.minX; x <= b.maxX; x += step) {
    for (let z = b.minZ; z <= b.maxZ; z += step) {
      const p = projectUnderfalls(L, x, z);
      if (!p || p.clearance > -0.039) continue;
      for (const bob of [-0.02, 0, 0.02]) poses.push({ x: x + bob, z });
    }
  }
  return poses;
}
const POSES = reachablePoses();
const CELL = 2.0;
const BUCKETS = new Map();
for (const p of POSES) {
  const k = Math.floor(p.x / CELL) + ',' + Math.floor(p.z / CELL);
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
// Oriented rectangle in XZ -- the box's true face, never its AABB.
function gapToRect(p, q) {
  const dx = p.x - q.x, dz = p.z - q.z;
  const u = Math.abs(dx * q.nx + dz * q.nz) - q.halfN;
  const v = Math.abs(dx * q.tx + dz * q.tz) - q.halfT;
  return Math.hypot(Math.max(0, u), Math.max(0, v));
}
function gapToCircle(p, q) {
  return Math.hypot(p.x - q.x, p.z - q.z) - q.r;
}
// The 0.05 grid can miss the true nearest pose by its half-diagonal, 0.035 m.
// That is the difference between a fixture at 0.419 and one at 0.454, so every
// grid answer is refined on a 0.005 lattice around itself (error <= 0.0035).
// Legality is decided at the CLAMPED point; the bob is then added to world X.
function closestPose(q) {
  const fn = q.r !== undefined ? gapToCircle : gapToRect;
  const reach = (q.r !== undefined ? q.r : Math.hypot(q.halfN, q.halfT)) + 2.5;
  let best = { gap: Infinity, at: null };
  for (const p of posesNear(q.x, q.z, reach)) {
    const gap = fn(p, q);
    if (gap < best.gap) best = { gap, at: p };
  }
  if (!best.at) return { gap: Infinity, at: null };
  const x0 = Math.round(best.at.x / 0.05) * 0.05, z0 = best.at.z;
  for (let dx = -0.09; dx <= 0.09 + 1e-9; dx += 0.005) {
    for (let dz = -0.09; dz <= 0.09 + 1e-9; dz += 0.005) {
      const cx = x0 + dx, cz = z0 + dz;
      const p = projectUnderfalls(L, cx, cz);
      if (!p || p.clearance > -0.039) continue;
      for (const bob of [-0.02, 0, 0.02]) {
        const gap = fn({ x: cx + bob, z: cz }, q);
        if (gap < best.gap) best = { gap, at: { x: cx + bob, z: cz } };
      }
    }
  }
  return { gap: best.gap, at: [r3(best.at.x), r3(best.at.z)] };
}

// --------------------------------------------------------------------------
// 1. TURN MARKERS. Cone r 0.34, offset b.w + 1.1 along the outside bisector.
//    The cone is widest at its base, and the player capsule stands on that
//    floor, so 0.34 is the footprint -- not the narrower slice at EYE.
// --------------------------------------------------------------------------
const MARK_R = 0.34;
function runMarkers(mode, maxPush = 1.5, step = 0.02) {
  const out = [];
  const main = L.main;
  for (let i = 1; i < main.length - 1; i++) {
    const a = main[i - 1], b = main[i], c = main[i + 1];
    const inLen = Math.hypot(b.x - a.x, b.z - a.z);
    const outLen = Math.hypot(c.x - b.x, c.z - b.z);
    const inD = { x: (b.x - a.x) / inLen, y: (b.z - a.z) / inLen };
    const outD = { x: (c.x - b.x) / outLen, y: (c.z - b.z) / outLen };
    const turn = Math.acos(clamp(inD.x * outD.x + inD.y * outD.y, -1, 1)) * 180 / Math.PI;
    if (turn < 45) continue;
    let bis = { x: inD.x - outD.x, y: inD.y - outD.y };
    const bl = Math.hypot(bis.x, bis.y);
    if (bl * bl < 1e-6) continue;
    bis = { x: bis.x / bl, y: bis.y / bl };
    const base = b.w + 1.1;
    let off = base, seated = mode === 'old', push = 0;
    if (mode !== 'old') {
      for (push = 0; push <= maxPush + 1e-9; push += step) {
        off = base + push;
        // whole footprint: the axis plus eight points on the base circle
        let worst = Infinity;
        for (let k = 0; k < 8; k++) {
          const th = k * Math.PI / 4;
          const hit = projectUnderfalls(L,
            b.x + bis.x * off + Math.cos(th) * MARK_R,
            b.z + bis.y * off + Math.sin(th) * MARK_R);
          if (hit && hit.clearance < worst) worst = hit.clearance;
        }
        const axis = projectUnderfalls(L, b.x + bis.x * off, b.z + bis.y * off);
        if (axis && axis.clearance < worst) worst = axis.clearance;
        if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
      }
    }
    const x = b.x + bis.x * off, z = b.z + bis.y * off;
    const axis = projectUnderfalls(L, x, z);
    const rec = {
      node: b.name, turn: r3(turn), w: r3(b.w), off: r3(off), push: r3(push),
      seated, x: r3(x), z: r3(z), axisClearance: r3(axis.clearance),
      h: r3(4.2 + Math.min(1.0, (turn - 45) / 90)),
    };
    if (seated) rec.gap = closestPose({ x, z, r: MARK_R });
    out.push(rec);
  }
  return out;
}

// --------------------------------------------------------------------------
// 2. DOORJAMBS. 0.3 x 0.3 posts, 2.6 tall, at the segment normal * (w + 0.55)
//    either side of every main/chamber-rim crossing.
// --------------------------------------------------------------------------
// The instanced box is composed with an IDENTITY quaternion, so its 0.3 x 0.3
// footprint is WORLD-axis-aligned however the segment runs. Test and measure
// it that way; pretending it is turned to face the route understates it by up
// to 0.062 m at the corners.
const JAMB_HALF = 0.15;
function jambSites() {
  const sites = [];
  for (const seg of L.mainSegments) {
    for (const chamber of L.chambers) {
      const fx = seg.a.x - chamber.x, fz = seg.a.z - chamber.z;
      const A = seg.dx * seg.dx + seg.dz * seg.dz;
      const Bq = 2 * (fx * seg.dx + fz * seg.dz);
      const Cq = fx * fx + fz * fz - chamber.r * chamber.r;
      const disc = Bq * Bq - 4 * A * Cq;
      if (disc <= 0) continue;
      const sq = Math.sqrt(disc);
      for (const t of [(-Bq - sq) / (2 * A), (-Bq + sq) / (2 * A)]) {
        if (t <= 0.02 || t >= 0.98) continue;
        sites.push({
          chamber: chamber.name, seg: 'main#' + seg.index, t: r3(t),
          x: seg.a.x + seg.dx * t, z: seg.a.z + seg.dz * t,
          y: lerp(seg.a.y, seg.b.y, t), w: lerp(seg.a.w, seg.b.w, t),
          nx: seg.dz / seg.length, nz: -seg.dx / seg.length,
          tx: seg.dx / seg.length, tz: seg.dz / seg.length,
        });
      }
    }
  }
  return sites;
}
function runJambs(mode, maxPush = 0.6, step = 0.02) {
  const out = [];
  for (const s of jambSites()) {
    const pair = [];
    for (const side of [-1, 1]) {
      const base = s.w + 0.55;
      let off = base, seated = mode === 'old', push = 0;
      if (mode !== 'old') {
        for (push = 0; push <= maxPush + 1e-9; push += step) {
          off = base + push;
          let worst = Infinity;
          for (const u of [-JAMB_HALF, 0, JAMB_HALF]) {
            for (const v of [-JAMB_HALF, 0, JAMB_HALF]) {
              const hit = projectUnderfalls(L,
                s.x + s.nx * side * off + u, s.z + s.nz * side * off + v);
              if (hit && hit.clearance < worst) worst = hit.clearance;
            }
          }
          if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
        }
      }
      const x = s.x + s.nx * side * off, z = s.z + s.nz * side * off;
      const axis = projectUnderfalls(L, x, z);
      pair.push({
        chamber: s.chamber, seg: s.seg, side, w: r3(s.w), off: r3(off),
        push: r3(push), seated, x: r3(x), z: r3(z),
        axisClearance: r3(axis.clearance),
      });
    }
    // A doorway is a PAIR. One post beside the route is not a doorway, it is a
    // pale rock -- exactly the "rocks and random things" this tier exists to
    // stop being. So the crossing is all-or-nothing, the way round thirteen's
    // sluice gate drops its posts, lintel and tooth bar together.
    if (mode !== 'old' && !pair.every((p) => p.seated)) {
      for (const p of pair) p.seated = false;
    }
    for (const p of pair) {
      if (p.seated) {
        p.gap = closestPose({
          x: +p.x, z: +p.z, nx: 1, nz: 0, tx: 0, tz: 1,
          halfN: JAMB_HALF, halfT: JAMB_HALF,
        });
      }
      out.push(p);
    }
  }
  return out;
}

// --------------------------------------------------------------------------
console.log('SOLID_PAD ' + UNDERFALLS_SOLID_PAD + ' | legal poses sampled ' + POSES.length);
const dump = (label, rows, keyName) => {
  console.log('\n=== ' + label + ' ===');
  let worst = Infinity, drawn = 0;
  for (const r of rows) {
    const g = r.seated ? r.gap.gap : null;
    if (r.seated) { drawn++; if (g < worst) worst = g; }
    console.log('  ' + String(r[keyName]).padEnd(22)
      + (r.side !== undefined ? ' side ' + (r.side > 0 ? '+' : '-') : '')
      + '  at (' + r.x + ', ' + r.z + ')'
      + '  w ' + r.w + ' off ' + r.off + ' push ' + r.push
      + '  unionClr ' + r.axisClearance
      + (r.seated ? '  gap ' + r3(g) : '  DROPPED'));
  }
  console.log('  -> drawn ' + drawn + '/' + rows.length + ', min camera gap '
    + (drawn ? r3(worst) : 'n/a') + ' m');
};
dump('turn markers BEFORE', runMarkers('old'), 'node');
dump('turn markers AFTER', runMarkers('seat'), 'node');
dump('doorjambs BEFORE', runJambs('old'), 'chamber');
dump('doorjambs AFTER', runJambs('seat'), 'chamber');

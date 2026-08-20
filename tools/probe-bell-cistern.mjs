// probe-bell-cistern.mjs — pure-node replay of the bell-cistern arithmetic.
//
// Round thirteen, his note 8: "what is this, it doesnt move or do anything."
// The fix steps the fallen bell off the secret lane so it can carry a real
// collider, moves its dry ring and its light with it, and gives it a toll that
// only sounds to someone standing in the culvert. Every number that fix asserts
// is derived here from the same authored tables src/underfalls.js uses, so the
// claims in the commit body are checked rather than guessed.
//
//   node tools/probe-bell-cistern.mjs

const MAIN = [
  { x: 0,  z: 22,  y: 0.00, w: 2.30, name: 'stone veil' },
  { x: 2,  z: 30,  y: 0.00, w: 2.45, name: 'undertow throat' },
  { x: 7,  z: 36,  y: 0.00, w: 3.20, name: 'intake apse' },
  { x: 14, z: 40,  y: 0.00, w: 4.60, name: 'pump approach' },
  { x: 16, z: 50,  y: 0.00, w: 4.75, name: 'chapel west aisle' },
  { x: 28, z: 56,  y: 0.00, w: 4.75, name: 'chapel east aisle' },
  { x: 36, z: 49,  y: 0.00, w: 3.00, name: 'east ambulatory' },
  { x: 35, z: 62,  y: 0.00, w: 2.65, name: 'lower sluice' },
  { x: 40, z: 69,  y: 1.60, w: 2.50, name: 'sluice rise' },
  { x: 46, z: 78,  y: 3.20, w: 2.55, name: 'upper sluice' },
  { x: 55, z: 87,  y: 3.20, w: 2.75, name: 'overflow gallery' },
  { x: 60, z: 96,  y: 0.00, w: 2.65, name: 'spill descent' },
  { x: 68, z: 104, y: 0.00, w: 3.80, name: 'hatch cistern' },
];
const SECRET = [
  { x: 14, z: 40, y: 0.00, w: 1.55, name: 'culvert mouth' },
  { x: 22, z: 48, y: 0.00, w: 1.45, name: 'dry return' },
  { x: 22, z: 59, y: 0.00, w: 1.55, name: 'pump undercroft' },
  { x: 27, z: 68, y: 1.25, w: 3.25, name: 'bell cistern' },
  { x: 37, z: 75, y: 2.40, w: 1.55, name: 'service climb' },
  { x: 46, z: 78, y: 3.20, w: 1.70, name: 'overflow shortcut' },
];
const CHAMBERS = [
  { x: 7,  z: 36,  y: 0.00, r: 4.30, name: 'intake apse' },
  { x: 22, z: 54,  y: 0.00, r: 10.50, name: 'drowned pump chapel' },
  { x: 27, z: 68,  y: 1.25, r: 3.45, name: 'bell cistern', secret: true },
  { x: 55, z: 87,  y: 3.20, r: 4.80, name: 'overflow gallery' },
  { x: 68, z: 104, y: 0.00, r: 4.25, name: 'hatch cistern' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const r3 = (n) => +n.toFixed(3);

function makeSegments(path, kind) {
  const out = [];
  let distance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    out.push({ a, b, dx, dz, length, length2: length * length, distance, kind, index: i });
    distance += length;
  }
  return out;
}
const segments = [...makeSegments(MAIN, 'main'), ...makeSegments(SECRET, 'secret')];

function segmentProjection(seg, x, z) {
  const t = clamp(((x - seg.a.x) * seg.dx + (z - seg.a.z) * seg.dz) / (seg.length2 || 1), 0, 1);
  const cx = seg.a.x + seg.dx * t, cz = seg.a.z + seg.dz * t;
  const d = Math.hypot(x - cx, z - cz);
  const w = lerp(seg.a.w, seg.b.w, t);
  return { type: 'segment', kind: seg.kind, name: seg.kind + '[' + seg.index + ']', d, w, clearance: d - w };
}
function chamberProjection(c, x, z) {
  const d = Math.hypot(x - c.x, z - c.z);
  return { type: 'chamber', kind: c.secret ? 'secret' : 'main', name: c.name, d, w: c.r, clearance: d - c.r };
}
function projectUnderfalls(x, z) {
  let best = null;
  for (const s of segments) { const p = segmentProjection(s, x, z); if (!best || p.clearance < best.clearance) best = p; }
  for (const c of CHAMBERS) { const p = chamberProjection(c, x, z); if (!best || p.clearance < best.clearance) best = p; }
  return best;
}

// ---- the placement -------------------------------------------------------
const C = CHAMBERS.find((c) => c.name === 'bell cistern');
const prev = SECRET[2], next = SECRET[4];
const unit = (ax, az) => { const L = Math.hypot(ax, az); return [ax / L, az / L]; };
const [inX, inZ] = unit(C.x - prev.x, C.z - prev.z);
const [outX, outZ] = unit(next.x - C.x, next.z - C.z);
const [mx, mz] = unit(inX + outX, inZ + outZ);
const normal = [mz, -mx];                       // outward, away from the shelf side
const OFFSET = 1.95;
console.log('mean heading          ', [r3(mx), r3(mz)]);
console.log('outward normal        ', [r3(normal[0]), r3(normal[1])]);
console.log('normal * 1.95         ', [r3(normal[0] * OFFSET), r3(normal[1] * OFFSET)]);

// The shipped offset, rounded to two decimals in source.
const OX = 1.63, OZ = -1.47;   // round fourteen: 1.95 -> 2.20 m out
const bx = C.x + OX, bz = C.z + OZ;
const offset = Math.hypot(OX, OZ);
console.log('\nSHIPPED OFFSET        ', [OX, OZ], 'magnitude', r3(offset));
const shelf = { x: C.x - 1.7527, z: C.z + 1.9475 };   // round fourteen: tangential at 2.62 m
console.log('bell/shelf separation ', r3(Math.hypot(bx - shelf.x, bz - shelf.z)), '(opposite flanks)');

// ---- perpendicular distance to both secret centrelines -------------------
const legIn = makeSegments([prev, C], 's')[0];
const legOut = makeSegments([C, next], 's')[0];
console.log('secret leg in  (22,59)->(27,68): bell axis is',
  r3(segmentProjection(legIn, bx, bz).d), 'm from the centreline');
console.log('secret leg out (27,68)->(37,75): bell axis is',
  r3(segmentProjection(legOut, bx, bz).d), 'm from the centreline');

// ---- gate 1: authored colliders never clip either centreline -------------
// tests/underfalls-expansion.mjs:167-182 samples both polylines at 0.55 m and
// fails any underfalls collider whose AABB, grown 0.32 m in x and z, contains
// a sample whose [y+0.55, y+1.75] band overlaps the collider's y range.
const R = 1.03, Y0 = C.y - 0.4, Y1 = C.y + 1.44;   // round fourteen: 0.75 -> 1.03
const box = { minX: bx - R, maxX: bx + R, minZ: bz - R, maxZ: bz + R, minY: Y0, maxY: Y1 };
function samplePath(path, spacing) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / spacing));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t) });
    }
  }
  out.push({ ...path[path.length - 1] });
  return out;
}
const allSamples = [...samplePath(MAIN, 0.55), ...samplePath(SECRET, 0.55)];
let worstPad = Infinity, worstSample = null;
for (const s of allSamples) {
  if (!(box.maxY > s.y + 0.55 && box.minY < s.y + 1.75)) continue;
  // how far outside the raw AABB the sample sits, per axis — the gate fails
  // only when BOTH axes are within 0.32, so the larger of the two decides.
  const padX = Math.max(box.minX - s.x, s.x - box.maxX, 0);
  const padZ = Math.max(box.minZ - s.z, s.z - box.maxZ, 0);
  const pad = Math.max(padX, padZ);
  if (pad < worstPad) { worstPad = pad; worstSample = s; }
}
console.log('\nGATE tests/underfalls-expansion.mjs:167 (threshold 0.32 m)');
console.log('  closest route sample sits', r3(worstPad), 'm outside the collider AABB ->',
  worstPad > 0.32 ? 'PASS' : 'FAIL', 'at', [r3(worstSample.x), r3(worstSample.z)]);

// ---- gate 2: the secret walk still arrives within 0.62 m of every node ----
// The walker steers straight at the next node; the player is a 0.34 m capsule.
const PR = 0.34;
function chordClearsBox(a, b, inflate) {
  const minX = box.minX - inflate, maxX = box.maxX + inflate;
  const minZ = box.minZ - inflate, maxZ = box.maxZ + inflate;
  let near = 0, far = 1;
  const dx = b.x - a.x, dz = b.z - a.z;
  const axes = [[a.x, dx, minX, maxX], [a.z, dz, minZ, maxZ]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return true; continue; }
    let t0 = (lo - o) / d, t1 = (hi - o) / d;
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    near = Math.max(near, t0); far = Math.min(far, t1);
    if (near > far) return true;
  }
  return false;                       // the chord enters the inflated box
}
console.log('\nGATE tests/underfalls-expansion.mjs:203 (secret walk, node to node)');
for (let i = 0; i < SECRET.length - 1; i++) {
  const a = SECRET[i], b = SECRET[i + 1];
  console.log('  ' + a.name + ' -> ' + b.name + ': straight walk '
    + (chordClearsBox(a, b, PR) ? 'never touches' : 'CROSSES') + ' the bell capsule');
}
for (const n of SECRET) {
  if (n.x >= box.minX - PR && n.x <= box.maxX + PR && n.z >= box.minZ - PR && n.z <= box.maxZ + PR) {
    console.log('  !! node ' + n.name + ' is inside the collider + player radius');
  }
}
console.log('  bell-cistern node stands',
  r3(Math.max(Math.max(box.minX - C.x, C.x - box.maxX), Math.max(box.minZ - C.z, C.z - box.maxZ))),
  'm clear of the collider face (player radius', PR + ')');

// ---- enemy navigation: the Choir's chords ---------------------------------
// findUnderfallsRoute only ever offers a chord that underfallsLineOfSight has
// already accepted, and that test's dominant filter is the corridor-union one:
// every 0.32 m sample must sit at clearance <= -0.2. A chord my collider blocks
// but the union test already rejected costs the Choir nothing.
function unionChordOpen(a, b, pad = 0.2, spacing = 0.32) {
  const distance = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = projectUnderfalls(lerp(a.x, b.x, t), lerp(a.z, b.z, t));
    if (!p || p.clearance > -pad + 1e-4) return false;
  }
  return true;
}
const CHOIR_R = 0.42;
console.log('\nCHOIR nav chords (enemies.js:2060 swept footprint, r =', CHOIR_R + ')');
const navKeys = new Map();
for (const p of [...MAIN, ...SECRET, ...CHAMBERS, { x: 29.25, z: 55.75, y: 0, name: 'chapel north transept' }]) {
  const key = p.x.toFixed(3) + ',' + p.y.toFixed(3) + ',' + p.z.toFixed(3);
  if (!navKeys.has(key)) navKeys.set(key, p);
}
const navNodes = [...navKeys.values()];
let blockedLive = 0, blockedDead = 0;
for (let i = 0; i < navNodes.length; i++) {
  for (let j = i + 1; j < navNodes.length; j++) {
    if (chordClearsBox(navNodes[i], navNodes[j], CHOIR_R)) continue;
    const live = unionChordOpen(navNodes[i], navNodes[j]);
    if (live) blockedLive++; else blockedDead++;
    console.log('  ' + (live ? 'BLOCKS a live chord: ' : 'blocks an already-dead chord: ')
      + navNodes[i].name + ' -> ' + navNodes[j].name);
  }
}
console.log('  live chords lost:', blockedLive, '| chords the corridor union already refused:', blockedDead);
{
  const a = SECRET[2], b = SECRET[4];
  const direct = Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y);
  const viaBell = Math.hypot(C.x - a.x, C.z - a.z, C.y - a.y) + Math.hypot(b.x - C.x, b.z - C.z, b.y - C.y);
  console.log('  the one lost chord costs the Choir', r3(viaBell - direct),
    'm of detour (' + r3(direct), '->', r3(viaBell) + ') via the bell-cistern node');
}
console.log('  every consecutive polyline chord still open:',
  [...MAIN.slice(1).map((n, i) => chordClearsBox(MAIN[i], n, CHOIR_R)),
    ...SECRET.slice(1).map((n, i) => chordClearsBox(SECRET[i], n, CHOIR_R))].every(Boolean));

// ---- the dry ring vs the chamber floor disc -------------------------------
// underfalls.js:620-627 draws each chamber floor as CylinderGeometry(1,1,1,16)
// scaled to chamber.r * 1.02 — a 16-gon, so the real edge at a given bearing is
// R*cos(pi/16)/cos(phi), phi being the offset from the nearest facet midpoint.
const R_DISC = C.r * 1.02;
const theta = Math.atan2(OX, OZ);                 // three.js lays vertices out as (sin, cos)
const step = (2 * Math.PI) / 16;
const facetMid = (Math.floor(theta / step) + 0.5) * step;
const phi = Math.abs(theta - facetMid);
const edgeAtBearing = R_DISC * Math.cos(Math.PI / 16) / Math.cos(phi);
console.log('\nDRY RING vs the chamber floor');
console.log('  floor disc circumradius        ', r3(R_DISC));
console.log('  16-gon edge at the bell bearing', r3(edgeAtBearing));
for (const [ri, ro] of [[2.05, 2.28], [1.22, 1.40], [1.05, 1.22]]) {
  console.log('  RingGeometry(' + ri + ', ' + ro + ') moved to the bell -> far edge at',
    r3(offset + ro), ro + offset < edgeAtBearing ? '(inside the floor)' : '(OVERHANGS the floor)');
  console.log('    nearest edge to the secret centreline:',
    r3(segmentProjection(legIn, bx, bz).d - ro), 'm');
}

// ---- the clapper cannot leave the bell ------------------------------------
const profile = [[0.18, 0.00], [0.24, 0.16], [0.38, 0.52], [0.53, 0.91], [0.76, 1.22], [0.98, 1.38], [1.03, 1.44]];
const clapperY = 0.28, clapperR = 0.24;
let inner = null;
for (let i = 0; i < profile.length - 1; i++) {
  const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
  if (clapperY >= y0 && clapperY <= y1) inner = lerp(r0, r1, (clapperY - y0) / (y1 - y0));
}
console.log('\nCLAPPER');
console.log('  lathe inner radius at y =', clapperY, '->', r3(inner));
console.log('  free travel before it pokes through the wall:', r3(inner - clapperR), 'm');
for (const amp of [0.11, 0.04]) {
  console.log('  swing amplitude ' + amp + ' ->',
    amp <= inner - clapperR ? 'stays inside' : 'BREAKS THE SILHOUETTE');
}

// ---- the light ------------------------------------------------------------
// PointLight(0xd7a468, 13.5, distance 12, decay 1.15). Three.js physical
// falloff: 1/d^decay windowed by (1 - (d/cutoff)^4)^2.
const irradiance = (d, cutoff = 12, decay = 1.15) => {
  const w = Math.max(0, 1 - Math.pow(d / cutoff, 4));
  return Math.pow(Math.max(d, 1e-4), -decay) * w * w;
};
const oldLight = { x: C.x - 0.6, y: C.y + 2.25, z: C.z + 0.5 };
const newLight = { x: bx - 1.05, y: C.y + 2.4, z: bz + 0.85 };
const rim = { x: bx, y: C.y + 1.44, z: bz };
const oldRim = { x: C.x, y: C.y + 1.44, z: C.z };
const keepsakes = { x: C.x - 1.7527, y: C.y + 0.9, z: C.z + 1.9475 };
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
console.log('\nBELL LIGHT (PointLight 13.5, distance 12, decay 1.15)');
console.log('  before: light->rim', r3(d3(oldLight, oldRim)), 'm   light->keepsakes', r3(d3(oldLight, keepsakes)), 'm');
console.log('  if the light had NOT moved: light->rim', r3(d3(oldLight, rim)), 'm');
console.log('  after : light->rim', r3(d3(newLight, rim)), 'm   light->keepsakes', r3(d3(newLight, keepsakes)), 'm');
const rimRatio = irradiance(d3(newLight, rim)) / irradiance(d3(oldLight, oldRim));
console.log('  rim irradiance x', r3(rimRatio),
  '(vs leaving the light behind: x', r3(irradiance(d3(oldLight, rim)) / irradiance(d3(oldLight, oldRim))) + ')');
console.log('  keepsake irradiance from THIS light x', r3(irradiance(d3(newLight, keepsakes)) / irradiance(d3(oldLight, keepsakes))));
// The tick ramps this light 13.5 -> 24.0 on a strike, decaying over ~3 s.
console.log('  on a strike the tick lifts it to 24.0, so the rim reads at x',
  r3(rimRatio * 24 / 13.5), 'of its old resting level, falling back to x', r3(rimRatio));
// The raw plan's un-pulled-back position, for the record.
const rawLight = { x: bx - 0.55, y: C.y + 2.4, z: bz + 0.45 };
console.log('  (raw-plan position bx-0.55/bz+0.45 would be rim x',
  r3(irradiance(d3(rawLight, rim)) / irradiance(d3(oldLight, oldRim))), ', keepsakes x',
  r3(irradiance(d3(rawLight, keepsakes)) / irradiance(d3(oldLight, keepsakes))) + ')');
// Round fourteen rewrote the shelf candle in the plank's own frame: 0.60 m
// along the row and 0.62 m out into the room, so it lights the keepsakes from
// where the player stands rather than from 0.29 m behind the plank.
const CANDLE = { x: C.x - 1.7605, z: C.z + 1.0836 };
console.log('  the pooled candle at', [r3(CANDLE.x), r3(CANDLE.z)], 'r 4.5;',
  r3(Math.hypot(CANDLE.x - keepsakes.x, CANDLE.z - keepsakes.z)), 'm from the keepsakes');

// ---- the earshot question -------------------------------------------------
const strike = { x: bx, y: C.y + 1.15, z: bz };
console.log('\nEARSHOT — straight-line distance from the strike point to MAIN route nodes');
const near25 = [];
for (const n of MAIN) {
  const d = Math.hypot(n.x - strike.x, n.z - strike.z);
  if (d < 25) near25.push(n.name + ' ' + r3(d));
}
console.log('  within 25 m:', near25.join(' | '));
console.log('  -> a 22 m radius gate would toll at the main route from',
  r3(Math.min(...MAIN.map((n) => Math.hypot(n.x - strike.x, n.z - strike.z)))),
  'm, through solid rock. Rejected.');

// The shipped gate is membership, not radius: projectUnderfalls().kind must be
// 'secret' AND clearance <= 0. Check no MAIN centreline sample satisfies it.
let leaks = 0;
for (const s of samplePath(MAIN, 0.35)) {
  const p = projectUnderfalls(s.x, s.z);
  if (p && p.kind === 'secret' && p.clearance <= 0) { leaks++; console.log('  LEAK at', [r3(s.x), r3(s.z)], p.name); }
}
console.log('  main-route samples that would hear the toll under the membership gate:', leaks);
const secretSamples = samplePath(SECRET, 0.35);
let heard = 0;
for (const s of secretSamples) {
  const p = projectUnderfalls(s.x, s.z);
  if (p && p.kind === 'secret' && p.clearance <= 0) heard++;
}
console.log('  secret-route samples that DO hear it: ' + heard + '/' + secretSamples.length);
// Where along the walk in does it start? The chapel chamber's r 10.5 disc
// swallows the first two culvert legs, so the toll opens partway up the last
// one: that is how far out the landmark becomes walkable-toward.
let onset = null;
for (const s of samplePath(SECRET, 0.05)) {
  const p = projectUnderfalls(s.x, s.z);
  const inside = !!p && p.kind === 'secret' && p.clearance <= 0;
  if (inside && !onset) onset = s;
  if (!inside) onset = null;
  if (onset && Math.hypot(s.x - strike.x, s.z - strike.z) < 3) break;
}
console.log('  walking in, the toll opens at', [r3(onset.x), r3(onset.z)], '-',
  r3(Math.hypot(onset.x - strike.x, onset.z - strike.z)), 'm short of the bell');

// ---- what the rock actually moves -----------------------------------------
const rimHeight = 1.44;
for (const [label, amp] of [['idle  ', 0.012], ['struck', 0.012 + 0.075]]) {
  console.log('ROCK ' + label + ': pivot angle ' + r3(amp) + ' rad -> rim travel',
    r3(Math.sin(amp) * rimHeight), 'm peak,', r3(2 * Math.sin(amp) * rimHeight), 'm peak-to-peak');
}

// ---- the snapped chain now hangs beside the bell, not over it -------------
const chain = { x: C.x + 0.48, y: C.y + 3.45, z: C.z - 0.2 };
const chainBottomY = chain.y - Math.cos(0.55) * 0.9;   // 1.8 m rod, rotation.z 0.55
console.log('\nSNAPPED CHAIN');
console.log('  offset from the bell axis  ', r3(Math.hypot(chain.x - bx, chain.z - bz)), 'm');
console.log('  its lowest point clears the bell rim by',
  r3(chainBottomY - (C.y + 1.44)), 'm');
console.log('  it stands', r3(segmentProjection(legIn, chain.x, chain.z).d), 'm off the walking line, at',
  r3(chainBottomY - C.y), 'm above the chamber floor');

// ---- what the square collider feels like against a round bell -------------
// addColliderCylinder writes an axis-aligned box, the same approximation the
// pump chapel's pillars and altar already use.
//
// ROUND FOURTEEN CORRECTS THIS SECTION, WHICH WAS WRONG WHEN IT WAS WRITTEN.
// It printed a face gap of -0.015 m -- the camera fifteen millimetres INSIDE
// the pale rim -- and then concluded "nothing pokes out, nothing floats". The
// number and the sentence under it disagreed and the sentence won, which is
// the failure this project has now paid for twice. Measured against every pose
// that collider really permitted: 0.068 m in plan and 0.094 m in space, i.e.
// your head inside the mouth of the bell with the rim clipped by the near
// plane. The rim came in to 0.955 major so its outer surface is flush with the
// 1.03 lip, the bell moved 0.20 m further out, and the box went to 1.15.
const RIM_OUTER = 0.955 + 0.075;
console.log('\nCOLLIDER vs the bell it stands for (half-extent', R + ', player radius', PR + ')');
console.log('  bell rim outer radius        ', RIM_OUTER);
console.log('  you stop this far from the axis on a face:', r3(R + PR),
  '-> gap to the rim', r3(R + PR - RIM_OUTER), 'm');
console.log('  ...and on a corner            :', r3(Math.hypot(R, R) + PR),
  '-> gap to the rim', r3(Math.hypot(R, R) + PR - RIM_OUTER), 'm');
console.log('  the bell is 0.18 m wide at the floor and 1.03 m at the mouth, and');
console.log('  the box is the MOUTH now, not the mid-body: nothing drawn pokes out.');

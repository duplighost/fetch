// probe-bell-cistern.mjs — pure-node replay of the bell-cistern arithmetic.
//
// ROUND FOURTEEN. Alex: "sure, hang it. if you can make it swing and stuff sure,
// let it swing or whatever if it's interactable by hitting it with the skull.
// make sure that's not what is causing the sound bug where that areas sound can
// completely go bad though."
//
// So the bell goes back to the height it was authored at, the chain goes back to
// holding it, the collider is re-sized for the bell that hangs there, and the
// toll is re-tuned to drive the cave's reverb bus LESS than the build he has
// already played. Every number the source comments and the commit body claim is
// derived here from the same authored tables src/underfalls.js uses, so the
// claims are checked rather than guessed. This object has moved twice on
// unchecked reasons; that is the whole reason this file exists.
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
const r4 = (n) => +n.toFixed(4);

function makeSegments(path, kind) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    out.push({ a, b, dx, dz, length, length2: length * length, kind, index: i });
  }
  return out;
}
const segments = [...makeSegments(MAIN, 'main'), ...makeSegments(SECRET, 'secret')];

function segmentProjection(seg, x, z) {
  const t = clamp(((x - seg.a.x) * seg.dx + (z - seg.a.z) * seg.dz) / (seg.length2 || 1), 0, 1);
  const cx = seg.a.x + seg.dx * t, cz = seg.a.z + seg.dz * t;
  const d = Math.hypot(x - cx, z - cz);
  const w = lerp(seg.a.w, seg.b.w, t);
  return {
    type: 'segment', kind: seg.kind, name: seg.kind + '[' + seg.index + ']',
    d, w, y: lerp(seg.a.y, seg.b.y, t), clearance: d - w,
  };
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
// underfallsGroundAt, re-modelled off the same tables (src/underfalls.js:297).
// It is here because the head window is measured from the player's FEET, and
// this chamber's floor is not flat: the service ramp climbs across the disc,
// so where you stand decides how much of a hanging bell is in your window.
function groundAt(x, z) {
  let nearest = null;
  for (const s of segments) {
    const q = segmentProjection(s, x, z);
    if (!nearest || q.d < nearest.d) nearest = q;
  }
  if (nearest && nearest.d <= nearest.w + 0.38) return nearest.y;
  let floor = null;
  for (const c of CHAMBERS) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d <= c.r && (!floor || d / c.r < floor.score)) floor = { y: c.y, score: d / c.r };
  }
  if (floor) return floor.y;
  return nearest ? nearest.y : 0;
}

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

// ---- the authored object -------------------------------------------------
const C = CHAMBERS.find((c) => c.name === 'bell cistern');
const PLAYER_R = 0.34, HEAD = 1.75, STEP_UP = 0.5;     // player.js
const PROFILE = [[0.18, 0.00], [0.24, 0.16], [0.38, 0.52], [0.53, 0.91], [0.76, 1.22], [0.98, 1.38], [1.03, 1.44]];
const radiusAt = (ly) => {
  if (ly <= 0) return PROFILE[0][0];
  if (ly >= 1.44) return 1.03;
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r0, y0] = PROFILE[i], [r1, y1] = PROFILE[i + 1];
    if (ly >= y0 && ly <= y1) return lerp(r0, r1, (ly - y0) / (y1 - y0));
  }
  return 1.03;
};
const CROWN = 1.18, RIM = CROWN + 1.44, CLAPPER_Y = 1.46, RING_R = 1.03, RING_TUBE = 0.075;
const APEX = 5.18 - 0.17;                    // atmosphere.js chamber vault underside
const VAULT_R = C.r * 0.96;
const OX = 1.45, OZ = -1.31;
const bx = C.x + OX, bz = C.z + OZ;
const BELL_MAX = 0.055, BELL_HALF = 0.62;              // src/underfalls.js

// THE RESEATED KEEPSAKE SHELF. Round fourteen's walkthrough branch lifted the
// 3.8 m plank at (C.x-1.8, C.z+2.0) yawed 0.28 -- a third of which hung over
// the background -- and put a 3.0 m one TANGENTIAL to the disc at 2.62 m on
// the same bearing, with the keepsake row and the shelf's pooled candle
// written in the plank's own frame. Re-modelled here from the same numbers.
const SHELF_RADIUS = 2.62;
const SHELF_OUT = (() => {
  const len = Math.hypot(1.8, 2.0);
  return { x: -1.8 / len, z: 2.0 / len };
})();
const SHELF_ALONG = { x: SHELF_OUT.z, z: -SHELF_OUT.x };
const SHELF = {
  x: C.x + SHELF_OUT.x * SHELF_RADIUS, y: C.y + 0.72, z: C.z + SHELF_OUT.z * SHELF_RADIUS,
};
const KEEPSAKES = { x: SHELF.x, y: C.y + 0.9, z: SHELF.z };
const SHELF_CANDLE = {
  x: SHELF.x + SHELF_ALONG.x * -0.60 + SHELF_OUT.x * -0.62,
  y: C.y + 1.05,
  z: SHELF.z + SHELF_ALONG.z * -0.60 + SHELF_OUT.z * -0.62,
};

// THE SWEPT SILHOUETTE, sampled rather than bounded. "radius + depth x sin"
// is an upper bound on the radius and it is WRONG about height: the point of
// a ring that drops furthest under a lean is the one on the far side, and
// that point moves INWARD, not outward. So walk every drawn circle at the
// lean and take where each point of it actually goes. src/underfalls.js
// publishes its ledger from the same construction; this is the replay of it.
function swungPoints(lean) {
  const cl = Math.cos(lean), sl = Math.sin(lean);
  const bell = [], sling = [];
  const ring = (into, rho, restY) => {
    const drop = APEX - restY;
    for (let k = 0; k <= 24; k++) {
      const u = k / 12 - 1;
      into.push([
        APEX - drop * cl + rho * u * sl,
        Math.hypot(rho * u * cl + drop * sl, rho * Math.sqrt(Math.max(0, 1 - u * u))),
      ]);
    }
  };
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r0, y0] = PROFILE[i], [r1, y1] = PROFILE[i + 1];
    const steps = Math.ceil((y1 - y0) / 0.01);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      ring(bell, lerp(r0, r1, t), CROWN + lerp(y0, y1, t));
    }
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    ring(bell, RING_R + Math.cos(a) * RING_TUBE, RIM + Math.sin(a) * RING_TUBE);
  }
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI;
    ring(bell, Math.sin(a) * 0.24 + 0.045, CLAPPER_Y - Math.cos(a) * 0.24);
  }
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    ring(sling, RING_R * (1 - t) + 0.05, RIM + (APEX - RIM) * t);
  }
  return { bell, sling };
}
const bandRadius = (pts, y0, y1) => {
  let r = 0;
  for (const [y, h] of pts) if (y >= y0 && y <= y1 && h > r) r = h;
  return r;
};
const spanOf = (pts) => {
  let lo = Infinity, hi = -Infinity, widest = 0;
  for (const [y, h] of pts) { if (y < lo) lo = y; if (y > hi) hi = y; if (h > widest) widest = h; }
  return { lo, hi, widest };
};
const SWUNG = swungPoints(BELL_MAX);
const BELL_SPAN = spanOf(SWUNG.bell), SLING_SPAN = spanOf(SWUNG.sling);

// WHERE THE PLAYER CAN ACTUALLY STAND, AND ON WHAT. Poses the clamp holds and
// the bell box does not push out of, reduced to the only two numbers a body of
// revolution can see: the ground under the pose, which sets the head window,
// and the distance to the axis. Kept as a frontier -- per ground height, the
// nearest such stand -- because the two constrain each other.
const FRONTIER = (() => {
  const map = new Map();
  for (let dx = -2.9; dx <= 2.9 + 1e-9; dx += 0.005) {
    for (let dz = -2.9; dz <= 2.9 + 1e-9; dz += 0.005) {
      const d = Math.hypot(dx, dz);
      if (d > 2.9) continue;
      const x = bx + dx, z = bz + dz;
      const q = projectUnderfalls(x, z);
      if (!q || q.clearance > -0.04) continue;          // the clamp would not hold it
      const feet = groundAt(x, z);
      const boxLive = !(C.y + RIM <= feet + STEP_UP || C.y + CROWN >= feet + HEAD);
      if (boxLive) {
        const cx = clamp(x, bx - BELL_HALF, bx + BELL_HALF);
        const cz = clamp(z, bz - BELL_HALF, bz + BELL_HALF);
        if (Math.hypot(x - cx, z - cz) < PLAYER_R - 1e-9) continue;
      }
      const key = Math.round((feet - C.y) / 0.005);
      const cur = map.get(key);
      if (cur === undefined || d < cur) map.set(key, d);
    }
  }
  return [...map.entries()].map(([k, d]) => ({ f: k * 0.005, d })).sort((a, b) => a.f - b.f);
})();
const FLOOR_LO = Math.min(...FRONTIER.map((s) => s.f));
const FLOOR_HI = Math.max(...FRONTIER.map((s) => s.f));
const NEAREST = FRONTIER.reduce((a, s) => {
  if (s.d < a.d - 1e-9) return s;
  return (Math.abs(s.d - a.d) <= 1e-9 && s.f > a.f) ? s : a;
});
const NEAREST_STAND = NEAREST.d;
const WINDOW_TOP = NEAREST.f + HEAD;                   // C-relative
const HIGHEST_WINDOW = FLOOR_HI + HEAD;
// The pose that holds the LEAST air is not always the nearest one: on a ramp,
// a stand a centimetre further out can be on ground high enough to take more
// of the cone into its window. Found once, used by both sections below.
const WORST_POSE = (() => {
  let best = null;
  for (const s of FRONTIER) {
    let reach = 0, at = 0;
    for (const [y, h] of SWUNG.bell) {
      if (y <= s.f + HEAD + 1e-9 && h > reach) { reach = h; at = y; }
    }
    const air = s.d - PLAYER_R - reach;
    if (!best || air < best.air) best = { ...s, reach, at, air };
  }
  return best;
})();

console.log('THE AUTHORED HANG, AND THE CLAIM ROUND TWELVE MADE ABOUT IT');
console.log('  base C.y +', CROWN, '| rim C.y +', RIM, '(= base + the profile\'s own 1.44 top)',
  '| clapper C.y +', CLAPPER_Y);
{
  // the authored snapped chain: CylinderGeometry(.035,.05,1.8,5) at
  // (C.x+0.48, C.y+3.45, C.z-0.2), rotation.z 0.55
  const end = { x: C.x + 0.48 + Math.sin(0.55) * 0.9, y: 3.45 - Math.cos(0.55) * 0.9, z: C.z - 0.2 };
  const radial = Math.hypot(end.x - C.x, end.z - C.z);
  const toCentreLine = Math.hypot(radial - RING_R, end.y - RIM);
  console.log('  the chain\'s free end sat', r4(toCentreLine), 'm from the rim ring\'s centre-line ->',
    r4(toCentreLine - RING_TUBE), 'm off its iron. It was hung ON it.');
  console.log('  FOUR parts agreed with each other. An inherited lathe offset moves ONE.');
  console.log('  and that same chain end is', r3(Math.hypot(end.x - bx, end.z - bz)),
    'm from where round thirteen left the bell — holding nothing.');
}

console.log('');
console.log('DOES A HUNG BELL NEED A COLLIDER?  (player.js: RADIUS', PLAYER_R,
  ', STEP_UP', STEP_UP, ', HEAD', HEAD + ')');
console.log('  _moveAxis ignores a box whose min.y >= feet + HEAD. The crown bottoms out at',
  CROWN, 'so it reaches', r3(HEAD - CROWN), "m into the window of a player standing at the NODE's height");
console.log('  -- and nobody stands there: this floor runs C.y', r3(FLOOR_LO), 'to C.y +', r3(FLOOR_HI),
  "inside the bell's own three metres, so the real figure at the nearest stand is", r3(WINDOW_TOP - CROWN) + '.');
console.log('  bell radius at that height', r3(radiusAt(WINDOW_TOP - CROWN)),
  '-> YES. It would take a crown at C.y +', r3(WINDOW_TOP), 'to need none, and a bell you cannot');
console.log('  reach is a bell you cannot ring.');

console.log('');
console.log('THE VAULT (atmosphere.js: a 0.34-tall cap at chamber.y + 5.18, radius r * 0.96)');
console.log('  underside C.y +', r3(APEX), '| radius', r3(VAULT_R),
  '| 12-gon apothem', r3(VAULT_R * Math.cos(Math.PI / 12)));
console.log('  the bell axis stands', r3(Math.hypot(OX, OZ)), 'm off the node ->',
  Math.hypot(OX, OZ) < VAULT_R * Math.cos(Math.PI / 12) ? 'covered' : 'NOT COVERED');

// ---- the axis, kept from round thirteen ----------------------------------
const unit = (ax, az) => { const L = Math.hypot(ax, az); return [ax / L, az / L]; };
const prev = SECRET[2], next = SECRET[4];
const [inX, inZ] = unit(C.x - prev.x, C.z - prev.z);
const [outX, outZ] = unit(next.x - C.x, next.z - C.z);
const [mx, mz] = unit(inX + outX, inZ + outZ);
const normal = [mz, -mx];
const legIn = makeSegments([prev, C], 's')[0], legOut = makeSegments([C, next], 's')[0];
console.log('');
console.log('THE AXIS — round thirteen\'s offset, re-derived and kept');
console.log('  interior bisector', [r3(normal[0]), r3(normal[1])], 'x 1.95 =',
  [r3(normal[0] * 1.95), r3(normal[1] * 1.95)], '-> shipped', [OX, OZ]);
console.log('  perpendicular to secret leg in ', r3(segmentProjection(legIn, bx, bz).d), 'm');
console.log('  perpendicular to secret leg out', r3(segmentProjection(legOut, bx, bz).d), 'm');
console.log('  the shelf sits on the opposite flank,',
  r3(Math.hypot(bx - SHELF.x, bz - SHELF.z)), 'm away (reseated tangential at',
  SHELF_RADIUS, 'm this same round -- the old 3.8 m plank at C.x-1.8 / C.z+2.0 is gone)');

// ---- the sling -----------------------------------------------------------
const slingLen = Math.hypot(RING_R, APEX - RIM);
const slingTilt = Math.atan2(RING_R, APEX - RIM);
console.log('');
console.log('THE SLING — two legs, apex on the bell axis at the vault, feet on the rim ring');
console.log('  leg length', r4(slingLen), '| tilt from vertical', r4(slingTilt), 'rad =',
  r3(slingTilt * 180 / Math.PI), 'deg | foot-to-ring-centre-line 0 by construction');
console.log('  ONE leg cannot hold it: the lathe shell\'s centroid is on the axis, so a bell hung');
{
  let sA = 0, sAy = 0;
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r0, y0] = PROFILE[i], [r1, y1] = PROFILE[i + 1];
    const slant = Math.hypot(r1 - r0, y1 - y0), a = Math.PI * (r0 + r1) * slant;
    sA += a; sAy += a * (y0 + y1) / 2;
  }
  const com = sAy / sA;
  const tilt = Math.atan2(RING_R, 1.44 - com);
  console.log('  by one rim point settles at', r3(tilt * 180 / Math.PI),
    'deg (centroid local y', r3(com) + ') and everything inside slides out.');
  const L = APEX - (CROWN + com);
  console.log('  PENDULUM: apex to centroid', r3(L), 'm -> g/L', r4(9.81 / L),
    ', period', r3(2 * Math.PI * Math.sqrt(L / 9.81)), 's');
}

// ---- the swing cap and the collider that follows from it -----------------
// AGAINST THE REAL WINDOW, NOT THE NODE'S. Every version of this arithmetic
// before now scanned the iron from the crown to C.y + HEAD, which is the
// window of a player standing at the cistern node's own height. This chamber's
// floor is a ramp, and the nearest stand the box permits is on ground above
// the node, so its window reaches higher and takes more of the cone in. That
// is most of the air this collider was credited with.
function worstReach(th, top = WINDOW_TOP) {
  let w = 0, at = 0;
  for (const [y, h] of swungPoints(th).bell) {
    if (y <= top + 1e-9 && h > w) { w = h; at = y; }
  }
  return { w, at };
}
console.log('');
console.log('THE CAP, AND THE COLLIDER DERIVED FROM IT');
console.log('  reachable floor C.y', r3(FLOOR_LO), 'to C.y +', r3(FLOOR_HI),
  '| nearest stand', r3(NEAREST_STAND), 'm out, on ground C.y +', r3(NEAREST.f),
  '-> its window tops out at C.y +', r3(WINDOW_TOP));
for (const H of [0.40, 0.50, 0.60, 0.62, 0.75]) {
  let th = 0;
  for (let t = 0; t <= 0.2; t += 0.0005) { if (worstReach(t).w <= H) th = t; else break; }
  console.log('  half-extent', H, '-> face stop', r3(H + PLAYER_R), ', corner stop',
    r3(Math.hypot(H, H) + PLAYER_R), ', largest safe swing', r4(th), 'rad');
}
console.log('  (that table holds the stands still. A wider box pushes them further out too,');
console.log('   so it guides the choice rather than promising it; the shipped row is measured.)');
const wr = { w: WORST_POSE.reach, at: WORST_POSE.at };
console.log('  SHIPPED: BELL_MAX', BELL_MAX, 'rad, BELL_HALF', BELL_HALF);
console.log('    the pose that holds the least air stands', r4(WORST_POSE.d), 'm out on ground C.y +',
  r3(WORST_POSE.f), '-> window top C.y +', r3(WORST_POSE.f + HEAD));
console.log('    widest iron inside THAT head window at full lean', r4(wr.w), 'm at C.y +', r3(wr.at));
console.log('    the capsule surface stands at', r4(WORST_POSE.d - PLAYER_R), '->',
  r4(WORST_POSE.air), 'm clear, always (0.0416 was the node-height answer this line printed)');
console.log('    crown travel', r3(2 * (APEX - CROWN) * Math.sin(BELL_MAX)), 'm peak-to-peak');
console.log('    rim travel  ', r3(2 * (APEX - RIM) * Math.sin(BELL_MAX)),
  'm peak-to-peak (round thirteen\'s rocking bell managed 0.250)');
console.log('    the mouth (radius', RING_R + RING_TUBE + ') is', r3(RIM - WINDOW_TOP),
  'm above the top of that capsule, so it can never be touched: an AABB drawn to it');
console.log('    would be a metre of invisible wall around a thin iron cone.');

// ---- gate 1: colliders never clip either centreline ----------------------
const box = {
  minX: bx - BELL_HALF, maxX: bx + BELL_HALF, minZ: bz - BELL_HALF, maxZ: bz + BELL_HALF,
  minY: C.y + CROWN, maxY: C.y + RIM,
};
const allSamples = [...samplePath(MAIN, 0.55), ...samplePath(SECRET, 0.55)];
let worstPad = Infinity, worstSample = null, banded = 0;
for (const s of allSamples) {
  if (!(box.maxY > s.y + 0.55 && box.minY < s.y + 1.75)) continue;
  banded++;
  const padX = Math.max(box.minX - s.x, s.x - box.maxX, 0);
  const padZ = Math.max(box.minZ - s.z, s.z - box.maxZ, 0);
  const pad = Math.max(padX, padZ);
  if (pad < worstPad) { worstPad = pad; worstSample = s; }
}
console.log('');
console.log('GATE "authored landmark colliders never counterfeit or clip either centerline" (0.32 m)');
console.log('  samples whose y band overlaps the box:', banded, 'of', allSamples.length);
console.log('  closest sits', r3(worstPad), 'm outside the AABB ->', worstPad > 0.32 ? 'PASS' : 'FAIL',
  'at', [r3(worstSample.x), r3(worstSample.z)]);

// ---- gate 2: the secret walk ---------------------------------------------
function chordClearsBox(a, b, inflate) {
  const minX = box.minX - inflate, maxX = box.maxX + inflate;
  const minZ = box.minZ - inflate, maxZ = box.maxZ + inflate;
  let near = 0, far = 1;
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [o, d, lo, hi] of [[a.x, dx, minX, maxX], [a.z, dz, minZ, maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return true; continue; }
    let t0 = (lo - o) / d, t1 = (hi - o) / d;
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    near = Math.max(near, t0); far = Math.min(far, t1);
    if (near > far) return true;
  }
  return false;
}
console.log('');
console.log('GATE "the optional culvert is physically reachable" (secret walk, node to node)');
for (let i = 0; i < SECRET.length - 1; i++) {
  console.log('  ' + SECRET[i].name + ' -> ' + SECRET[i + 1].name + ': straight walk '
    + (chordClearsBox(SECRET[i], SECRET[i + 1], PLAYER_R) ? 'never touches' : 'CROSSES') + ' the bell box');
}
console.log('  the cistern node stands',
  r3(Math.max(Math.max(box.minX - C.x, C.x - box.maxX), Math.max(box.minZ - C.z, C.z - box.maxZ))),
  'm clear of the collider face');

// ---- gate 3: nothing the collider permits stands inside the iron ---------
// EVERY POSE AGAINST ITS OWN GROUND. A single "required clearance" is only
// meaningful on a flat floor, and this one is not flat: the pose that holds
// the least air is not the pose that stands nearest.
const worstAir = WORST_POSE.air, worstAt = { s: WORST_POSE, reach: WORST_POSE.reach };
console.log('');
console.log('GATE "no pose the clamp and the collider both accept stands inside the bell"');
console.log('  ground heights the frontier found:', FRONTIER.length,
  '| nearest stand overall', r4(NEAREST_STAND), 'm');
console.log('  worst pose: ground C.y +', r3(worstAt.s.f), 'at', r4(worstAt.s.d),
  'm out, window top C.y +', r3(worstAt.s.f + HEAD), ', swept iron', r4(worstAt.reach), 'm');
console.log('  air between that iron and the capsule', r4(worstAir), '->',
  worstAir > 0 ? 'PASS' : 'FAIL');

// ---- enemy navigation ----------------------------------------------------
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
console.log('');
console.log('CHOIR nav chords (enemies.js swept footprint, r =', CHOIR_R + ')');
const navKeys = new Map();
for (const p of [...MAIN, ...SECRET, ...CHAMBERS, { x: 29.25, z: 55.75, y: 0, name: 'chapel north transept' }]) {
  const key = p.x.toFixed(3) + ',' + (p.y ?? 0).toFixed(3) + ',' + p.z.toFixed(3);
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
{
  const a = SECRET[2], b = SECRET[4];
  const direct = Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y);
  const viaBell = Math.hypot(C.x - a.x, C.z - a.z, C.y - a.y) + Math.hypot(b.x - C.x, b.z - C.z, b.y - C.y);
  console.log('  the one lost chord costs the Choir', r3(viaBell - direct), 'm of detour, via the cistern node');
}
console.log('  live chords lost:', blockedLive, '| already refused by the corridor union:', blockedDead,
  '(round thirteen\'s 0.75 box lost the same one; this box is smaller)');
console.log('  every consecutive polyline chord still open:',
  [...MAIN.slice(1).map((n, i) => chordClearsBox(MAIN[i], n, CHOIR_R)),
    ...SECRET.slice(1).map((n, i) => chordClearsBox(SECRET[i], n, CHOIR_R))].every(Boolean));

// ---- the light -----------------------------------------------------------
const irr = (d, cutoff = 12, decay = 1.15) => {
  const w = Math.max(0, 1 - Math.pow(d / cutoff, 4));
  return Math.pow(Math.max(d, 1e-4), -decay) * w * w;
};
const toRingIron = (L, rimY) => {
  const h = Math.hypot(L.x - bx, L.z - bz);
  return Math.max(0, Math.hypot(Math.abs(h - RING_R), Math.abs(L.y - rimY)) - RING_TUBE);
};
const keepsakes = KEEPSAKES;
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const LIVE_LIGHT = { x: bx - 1.05, y: C.y + 2.4, z: bz + 0.85 };
const NEW_LIGHT = { x: bx - 1.42, y: C.y + 2.0, z: bz + 1.15 };
console.log('');
console.log('THE CISTERN LIGHT (PointLight 13.5, distance 12, decay 1.15)');
console.log('  round thirteen, bell on the floor: nearest pale rim iron',
  r3(toRingIron(LIVE_LIGHT, C.y + 1.44)), 'm, irradiance', r3(irr(toRingIron(LIVE_LIGHT, C.y + 1.44))));
console.log('  the SAME light with the bell re-hung:      ',
  r3(toRingIron(LIVE_LIGHT, C.y + RIM)), 'm, irradiance', r3(irr(toRingIron(LIVE_LIGHT, C.y + RIM))),
  '<- a lantern at arm\'s length; it would clip the one pale thing in the room to white');
console.log('  SHIPPED (bx-1.42 / C.y+2.0 / bz+1.15):     ',
  r3(toRingIron(NEW_LIGHT, C.y + RIM)), 'm, irradiance', r3(irr(toRingIron(NEW_LIGHT, C.y + RIM))),
  '-> x' + r4(irr(toRingIron(NEW_LIGHT, C.y + RIM)) / irr(toRingIron(LIVE_LIGHT, C.y + 1.44))), 'of live');
console.log('  keepsakes, on the RESEATED plank:', r3(d3(LIVE_LIGHT, keepsakes)), '->',
  r3(d3(NEW_LIGHT, keepsakes)),
  'm, irradiance x' + r3(irr(d3(NEW_LIGHT, keepsakes)) / irr(d3(LIVE_LIGHT, keepsakes))));
console.log('  (the x1.249 this line printed before was measured against the 3.8 m plank the',
  'walkthrough branch replaced this same round)');
console.log('  the shelf\'s own pooled candle travelled with the plank:',
  r3(Math.hypot(SHELF_CANDLE.x - SHELF.x, SHELF_CANDLE.y - SHELF.y, SHELF_CANDLE.z - SHELF.z)),
  'm off the plank centre,', r3(d3(NEW_LIGHT, SHELF_CANDLE)), 'm from this lamp');
{
  let highest = -Infinity, nearestEye = Infinity;
  for (let dx = -3; dx <= 3 + 1e-9; dx += 0.02) {
    for (let dz = -3; dz <= 3 + 1e-9; dz += 0.02) {
      const x = NEW_LIGHT.x + dx, z = NEW_LIGHT.z + dz;
      const q = projectUnderfalls(x, z);
      if (!q || q.clearance > -0.04) continue;
      const feet = groundAt(x, z);
      const cx = clamp(x, bx - BELL_HALF, bx + BELL_HALF), cz = clamp(z, bz - BELL_HALF, bz + BELL_HALF);
      if (Math.hypot(x - cx, z - cz) < PLAYER_R - 1e-9) continue;
      const eye = feet + 1.62;
      if (Math.hypot(dx, dz) < 1.2 && eye > highest) highest = eye;
      nearestEye = Math.min(nearestEye, Math.hypot(dx, eye - NEW_LIGHT.y, dz));
    }
  }
  console.log('  the lamp is at', r3(NEW_LIGHT.y), 'and the highest eye within 1.2 m of it is',
    r3(highest), '->', r3(NEW_LIGHT.y - highest), 'm over it;', r3(nearestEye),
    'm from the nearest eye in space, so nobody can stand inside it');
  console.log('  ("0.38 m above EYE" was the node-height answer, and this floor is a ramp)');
}

// ---- the ledger the gate walks -------------------------------------------
// tests/underfalls-expansion.mjs measures what src/underfalls.js publishes to
// layout.solids. A prism reports ONE radius for its whole height, and a hung
// bell is a cone, so the bell goes on as a stack of discs whose rungs are the
// tops of head windows. This replays that stack off this file's own PROFILE
// and scores it the way the gate does: the flat gap while a rung crosses a
// pose's window (owed RADIUS less the 0.02 of head bob a collider never sees)
// and the 3D distance from that pose's eye, always (owed the 0.24 the 0.2 near
// plane eats at).
const LEDGER_BOB = 0.02, LEDGER_BODY = PLAYER_R - LEDGER_BOB, LEDGER_NEAR = 0.24, EYE = 1.62;
const RUNGS = [BELL_SPAN.lo, 1.87, 1.90, 2.10, BELL_SPAN.hi];
const LEDGER = [];
for (let i = 0; i < RUNGS.length - 1; i++) {
  LEDGER.push({
    name: 'hung bell', guard: 'collider', y0: RUNGS[i], y1: RUNGS[i + 1],
    r: bandRadius(SWUNG.bell, RUNGS[i], RUNGS[i + 1]),
  });
}
LEDGER.push({
  name: 'bell sling', guard: 'clamp', y0: SLING_SPAN.lo, y1: SLING_SPAN.hi, r: SLING_SPAN.widest,
});
console.log('');
console.log('THE LEDGER (layout.solids), replayed and scored the way the gate scores it');
console.log('  the swept bell spans C.y +', r3(BELL_SPAN.lo), 'to C.y +', r3(BELL_SPAN.hi),
  'and is', r4(BELL_SPAN.widest), 'm wide at its rim');
console.log('  the highest head window anything the gate can reach here raises tops out at C.y +',
  r3(HIGHEST_WINDOW) + ', under the last rung: nothing over that can be a wall you walk through');
for (const y of [1.86, 1.87, 1.88, 1.90, 1.95, 2.00, 2.10]) {
  let nearest = Infinity;
  for (const q of FRONTIER) if (q.f + HEAD > y) nearest = Math.min(nearest, q.d);
  console.log('    nearest stand whose window passes C.y +', y, ':',
    Number.isFinite(nearest) ? r4(nearest) + ' m' : 'none');
}
let worstBody = { gap: Infinity }, worstCam = { gap: Infinity };
for (const s of LEDGER) {
  const owed = s.guard === 'clamp' ? 0.42 : LEDGER_BODY;
  let body = Infinity, cam = Infinity;
  for (const q of FRONTIER) {
    const eye = q.f + EYE;
    const flat = Math.max(0, (q.d - LEDGER_BOB) - s.r);
    const vert = Math.max(0, s.y0 - eye, eye - s.y1);
    if (s.y1 > q.f + STEP_UP && s.y0 < q.f + HEAD) body = Math.min(body, flat);
    cam = Math.min(cam, Math.hypot(flat, vert));
  }
  console.log('  ' + s.name.padEnd(10), 'y C.y +' + r3(s.y0), '.. C.y +' + r3(s.y1),
    '| r', r4(s.r), '| body', Number.isFinite(body) ? r4(body) : 'never in a window',
    '| cam', r4(cam), '| owes', owed);
  if (Number.isFinite(body) && body - owed < worstBody.gap - (worstBody.owed || 0)) {
    worstBody = { gap: body, owed, name: s.name };
  }
  if (cam < worstCam.gap) worstCam = { gap: cam, name: s.name };
}
console.log('  worst body', r4(worstBody.gap), 'against', worstBody.owed, '->',
  worstBody.gap >= worstBody.owed - 1e-3 ? 'PASS' : 'FAIL');
console.log('  worst camera', r4(worstCam.gap), 'against', LEDGER_NEAR, '->',
  worstCam.gap >= LEDGER_NEAR - 1e-3 ? 'PASS' : 'FAIL');
console.log('  a ONE-DISC entry at the lip, which is what a FALLEN bell owes and what round');
console.log('  fourteen\'s walkthrough branch wrote here, would claim', r4(BELL_SPAN.widest),
  'm of iron across the whole');
console.log('  height and score', r4(Math.max(0, (NEAREST_STAND - LEDGER_BOB) - BELL_SPAN.widest)),
  '-> a gate measuring an object that is not there.');

// ---- earshot: unchanged from round thirteen, re-checked ------------------
const strike = { x: bx, y: C.y + CLAPPER_Y, z: bz };
let leaks = 0;
for (const s of samplePath(MAIN, 0.35)) {
  const p = projectUnderfalls(s.x, s.z);
  if (p && p.kind === 'secret' && p.clearance <= 0) leaks++;
}
const secretSamples = samplePath(SECRET, 0.35);
let heard = 0;
for (const s of secretSamples) {
  const p = projectUnderfalls(s.x, s.z);
  if (p && p.kind === 'secret' && p.clearance <= 0) heard++;
}
console.log('');
console.log('EARSHOT (membership, not radius — round thirteen\'s rule, kept)');
console.log('  nearest MAIN node to the strike point:',
  r3(Math.min(...MAIN.map((n) => Math.hypot(n.x - strike.x, n.z - strike.z)))),
  'm through solid rock — which is why a radius gate was refused');
console.log('  main-route samples that would hear the toll:', leaks);
console.log('  secret-route samples that DO hear it: ' + heard + '/' + secretSamples.length);

// ---- the reverb drive, which is his one condition ------------------------
// audio.js: bellRing({dark:true}) -> _bus duration 5.9 s, longest partial decay
// 4.85 s (+0.04 stop) = 4.89 s of tone. WET.cave 0.32, cave impulse 2.4 s.
// The proxy below is arithmetic on those source constants, NOT a measured DSP
// figure — it compares this object against itself before and after.
const TONE = 4.89;
const R13 = { verb: 0.96, mean: (7.3 + 11.6 + 9.1 + 13.8) / 4, min: 7.3 };
const R14 = { verb: 0.34, mean: 20.7, min: 7.3 };   // mean from the swing sim; min is the floor
console.log('');
console.log('REVERB DRIVE — "make sure that\'s not what is causing the sound bug"');
console.log('  send x tone / interval:');
console.log('    round thirteen  worst', r3(R13.verb * TONE / R13.min), '/s  | mean',
  r3(R13.verb * TONE / R13.mean), '/s   (+ a paired caveDrip at verb 0.9 on the same instant)');
console.log('    round fourteen  worst', r3(R14.verb * TONE / R14.min), '/s  | mean',
  r3(R14.verb * TONE / R14.mean), '/s   (nothing paired)');
console.log('    -> worst case', r3(100 * (1 - (R14.verb * TONE / R14.min) / (R13.verb * TONE / R13.min))) + '% lower,',
  'ordinary case', r3(100 * (1 - (R14.verb * TONE / R14.mean) / (R13.verb * TONE / R13.mean))) + '% lower.');
console.log('  single-event proxy (send x tone x zone wet 0.32 x impulse 2.4):');
console.log('    r13 toll', r3(0.96 * TONE * 0.32 * 2.4), '| r14 toll', r3(0.34 * TONE * 0.32 * 2.4),
  '| drownedCall, the next largest in the district, 1.484');
console.log('  no new voice type, no new send, no new loop, no new spray zone, no new drip site,');
console.log('  no new light. One call was DELETED (the paired caveDrip) and one send was cut.');

// ---- the swing, simulated on the shipped constants -----------------------
const DT = 1 / 120, W2 = 3.4045, W = Math.sqrt(W2), DAMP = 0.14;
const GUST = 0.054, TOLL = 0.028, GAP = 7.3, LOSS = 0.55, PUSH = 0.024;
function simulate(seconds, shove) {
  let ax = 0.008, az = 0, avx = 0, avz = 0.004;
  let gustT = 3.4, gi = 0, cd = 0, prev = ax * ax + az * az, toward = false;
  const tolls = [];
  let peak = 0;
  for (let t = 0; t < seconds; t += DT) {
    gustT -= DT; cd -= DT;
    if (gustT <= 0) {
      gustT = [7.3, 11.6, 9.1, 13.8][gi % 4];
      avx += GUST * Math.cos(gi * 2.399963); avz += GUST * Math.sin(gi * 2.399963); gi++;
    }
    if (shove && t >= shove.from && t < shove.to) {
      avx += PUSH * shove.speed * DT;
    }
    avx -= (W2 * Math.sin(ax) + DAMP * avx) * DT;
    avz -= (W2 * Math.sin(az) + DAMP * avz) * DT;
    ax += avx * DT; az += avz * DT;
    const amp = Math.hypot(Math.hypot(ax, az), Math.hypot(avx, avz) / W);
    if (amp > BELL_MAX) { const k = BELL_MAX / amp; ax *= k; az *= k; avx *= k; avz *= k; }
    peak = Math.max(peak, Math.hypot(ax, az));
    const lean2 = ax * ax + az * az;
    if (lean2 < prev) toward = true;
    else if (toward) {
      toward = false;
      if (amp >= TOLL && cd <= 0) { tolls.push(t); cd = GAP; avx *= LOSS; avz *= LOSS; }
    }
    prev = lean2;
  }
  const gaps = tolls.slice(1).map((v, i) => v - tolls[i]);
  return { n: tolls.length, mean: seconds / Math.max(1, tolls.length), peak,
    worstGap: gaps.length ? Math.min(...gaps) : Infinity };
}
console.log('');
console.log('THE SWING, simulated on the shipped constants at the shipped 1/120 step');
for (const [label, sec, shove] of [
  ['draught only, 10 minutes        ', 600, null],
  ['one 1.5 s shove at a walk       ', 90, { from: 20, to: 21.5, speed: 2.7 }],
  ['leaning on it for 20 s at a run ', 90, { from: 20, to: 40, speed: 4.7 }],
]) {
  const s = simulate(sec, shove);
  console.log('  ' + label, '->', String(s.n).padStart(3), 'tolls,', r3(s.mean).toFixed(1).padStart(6),
    's mean gap, worst gap', (Number.isFinite(s.worstGap) ? r3(s.worstGap) : '--'),
    's, peak lean', r4(s.peak), 'rad');
}
console.log('  the floor is', GAP, 's, and the inelastic strike (x' + LOSS + ' on the swing) is what');
console.log('  keeps the true rate well under it: the swing pays for the sound.');

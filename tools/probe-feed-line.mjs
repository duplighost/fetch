// probe-feed-line.mjs -- the basement pilot feed line, replayed in pure node.
//
// The wire laid in buildBasementPilot is 28 m of merged boxes in a district
// with no headroom and two doorways whose lintels it has to cross INSIDE. None
// of that can be eyeballed and none of it needs a browser: it is arithmetic off
// the same tables house.js and world.js build from, so it is replayed here.
// The round-twelve lesson is the reason this file exists at all -- a commit
// message asserted a lit candle that did not exist and a clearance check that
// ran eleven builders too early. Numbers in the commit body come from here.
//
//   node tools/probe-feed-line.mjs
const B = -3.0;               // HOUSE_TABLES.levels.basement.floor
const CEIL = -0.55;           // HOUSE_TABLES.levels.basement.ceil
const DOOR_H = 2.25;          // world.js
const WALL_T = 0.26;          // world.js
const EYE = 1.62;             // player.js
const HEAD = 1.75;            // player.js
const SECTION = 0.09;
const HALF = SECTION / 2;
const CULL_CUT = B + 2.42;    // buildPumpGallery's upper-sector test

const V = (x, y, z) => ({ x, y, z });
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

// the table exactly as house.js declares it
const FEED = [
  V(3.77, B + 2.12, 5.80),
  V(-1.00, B + 2.12, 5.80),
  V(-1.00, B + 2.34, 5.80),
  V(-1.00, B + 2.34, 1.80),
  V(-1.00, B + 2.12, 1.80),
  V(-1.00, B + 2.12, -3.00),
  V(3.30, B + 2.12, -3.00),
  V(3.30, B + 2.34, -3.00),
  V(4.70, B + 2.34, -3.00),
  V(4.70, B + 2.12, -3.00),
  V(11.05, B + 2.12, -3.00),
  V(11.05, B + 2.12, -1.90),
  V(11.05, B + 1.66, -1.90),
];
const CUM = [0];
for (let i = 1; i < FEED.length; i++) CUM.push(CUM[i - 1] + dist(FEED[i - 1], FEED[i]));
const LEN = CUM[CUM.length - 1];
const TIME = 3.4;
const arrival = (wp) => TIME * CUM[wp] / LEN;

console.log(`route: ${FEED.length} waypoints, ${FEED.length - 1} legs, ${LEN.toFixed(3)} m total`);
for (let i = 1; i < FEED.length; i++) {
  console.log(`  leg ${String(i - 1).padStart(2)}->${String(i).padStart(2)}  ${dist(FEED[i - 1], FEED[i]).toFixed(3).padStart(6)} m   cum ${CUM[i].toFixed(3).padStart(6)}`);
}
console.log(`\nfrom the bell, only leg 0->1 is in frame: ${CUM[1].toFixed(2)} m of ${LEN.toFixed(2)} m`
  + ` = ${(100 * CUM[1] / LEN).toFixed(1)}% of the run, ${arrival(1).toFixed(2)} s of sleeve travel`);

console.log('\nknock ladder, driven from the pulse itself (hand-typed cut in brackets):');
const HAND = { 1: 0.55, 3: 1.05, 5: 1.6, 8: 2.25, 11: 2.9 };
for (const wp of [1, 3, 5, 8, 11]) {
  console.log(`  FEED[${String(wp).padStart(2)}]  arrives ${arrival(wp).toFixed(3)} s   [was ${HAND[wp]} s, ${(arrival(wp) - HAND[wp]) >= 0 ? '+' : ''}${(arrival(wp) - HAND[wp]).toFixed(3)}]`);
}
console.log(`  closing metalDrop at FEED_TIME + 0.05 = ${(TIME + 0.05).toFixed(2)} s`);

// ---- clearances ---------------------------------------------------------
const eyeY = B + EYE, headY = B + HEAD, doorHead = B + DOOR_H;
const runY = B + 2.12, lintelY = B + 2.34;
console.log('\nclearances (pipe section 0.09, so +/- 0.045 off the centreline):');
console.log(`  -0.88 legs over a ${EYE} m eye at ${eyeY.toFixed(2)}     ${(runY - HALF - eyeY).toFixed(3)} m`);
console.log(`  -0.88 legs over a ${HEAD} m head at ${headY.toFixed(2)}    ${(runY - HALF - headY).toFixed(3)} m`);
console.log(`  -0.88 legs under the ${CEIL} ceiling         ${(CEIL - (runY + HALF)).toFixed(3)} m`);
console.log(`  -0.66 crossings over door heads at ${doorHead.toFixed(2)}  ${(lintelY - HALF - doorHead).toFixed(3)} m`);
console.log(`  -0.66 crossings under the ${CEIL} ceiling    ${(CEIL - (lintelY + HALF)).toFixed(3)} m  (no room for a hanger strap)`);

// the two wall penetrations land on the doorway centrelines
const wx = (c) => -12 + 2 * c, wz = (c) => -14 + 2 * c;
const storeDoorX = wx(5) + 1, storeDoorZ = wz(8);
const boilerDoorZ = wz(5) + 1, boilerDoorX = wx(8);
console.log('\ndoorway centrelines from the tables (origin -12,-14, CS 2):');
console.log(`  bcorr->storeroom  ['basement',5,8,'N']  x ${storeDoorX.toFixed(2)} on the z=${storeDoorZ} wall`
  + `   wire crosses at x ${FEED[3].x.toFixed(2)}, z ${storeDoorZ}: ${storeDoorX === FEED[3].x ? 'DEAD ON' : 'OFF'}`);
console.log(`  storeroom->boiler ['basement',8,5,'W']  z ${boilerDoorZ.toFixed(2)} on the x=${boilerDoorX} wall`
  + `   wire crosses at z ${FEED[8].z.toFixed(2)}, x ${boilerDoorX}: ${boilerDoorZ === FEED[8].z ? 'DEAD ON' : 'OFF'}`);
console.log(`  wall faces (WALL_T ${WALL_T}): z ${(storeDoorZ - WALL_T / 2).toFixed(2)} / ${(storeDoorZ + WALL_T / 2).toFixed(2)}`
  + ` and x ${(boilerDoorX - WALL_T / 2).toFixed(2)} / ${(boilerDoorX + WALL_T / 2).toFixed(2)} -- where the escutcheons go`);

// ---- the furnace crown, and the flue it has to miss ----------------------
// inc.position (11.2, B, -1.5), rotation.y = -PI/2, so local +x -> world +z
// and local +z -> world -x. crown Box(1.23, 0.1, 1.03) at local y 1.6.
const inc = { x: 11.2, z: -1.5 };
const crown = {
  x0: inc.x - 1.03 / 2, x1: inc.x + 1.03 / 2,
  z0: inc.z - 1.23 / 2, z1: inc.z + 1.23 / 2,
  top: B + 1.6 + 0.05,
};
const union = FEED[FEED.length - 1];
const flue = { x: inc.x - (-0.12), z: inc.z + 0.22, r: 0.15 };
const flueD = Math.hypot(flue.x - union.x, flue.z - union.z);
console.log('\nthe landing pad:');
console.log(`  crown footprint x ${crown.x0.toFixed(3)}..${crown.x1.toFixed(3)}  z ${crown.z0.toFixed(3)}..${crown.z1.toFixed(3)}  top ${crown.top.toFixed(2)}`);
console.log(`  union at (${union.x}, ${union.z}) inside it: `
  + `${union.x > crown.x0 && union.x < crown.x1 && union.z > crown.z0 && union.z < crown.z1 ? 'YES' : 'NO'}`);
console.log(`  flue axis (${flue.x.toFixed(2)}, ${flue.z.toFixed(2)}) r ${flue.r}: `
  + `${flueD.toFixed(3)} m centre to centre, ${(flueD - flue.r - HALF).toFixed(3)} m from the pipe's own surface`);

// ---- the merged geometry: box count, vertices, and the culler test -------
const parts = [];
const box = (cx, cy, cz, w, h, d, why) => parts.push({ cx, cy, cz, w, h, d, why });
for (let i = 1; i < FEED.length; i++) {
  const a = FEED[i - 1], b = FEED[i];
  box((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2,
    Math.abs(b.x - a.x) + SECTION, Math.abs(b.y - a.y) + SECTION, Math.abs(b.z - a.z) + SECTION, 'leg');
}
let cleats = 0;
for (let i = 1; i < FEED.length; i++) {
  const a = FEED[i - 1], b = FEED[i];
  if (a.y !== b.y || Math.abs(a.y - (B + 2.12)) > 1e-6) continue;
  const len = dist(a, b);
  const n = Math.max(0, Math.ceil(len / 2.0) - 1);
  const alongX = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    const cx = a.x + (b.x - a.x) * t, cz = a.z + (b.z - a.z) * t;
    box(cx, a.y, cz, alongX ? 0.07 : 0.2, 0.14, alongX ? 0.2 : 0.07, 'cleat');
    box(cx, (a.y + 0.03 + CEIL) / 2, cz, 0.05, CEIL - a.y - 0.03, 0.05, 'strap');
    cleats++;
  }
  console.log(`  leg ${i - 1}->${i} ${len.toFixed(2)} m -> ${n} cleat(s), ${n ? (len / (n + 1)).toFixed(2) : '-'} m apart`);
}
box(FEED[0].x, FEED[0].y, FEED[0].z, 0.15, 0.15, 0.15, 'tee');
for (const z of [1.87, 2.13]) box(-1.0, B + 2.34, z, 0.18, 0.18, 0.03, 'escutcheon');
for (const x of [3.87, 4.13]) box(x, B + 2.34, -3.0, 0.03, 0.18, 0.18, 'escutcheon');
box(11.05, B + 1.675, -1.9, 0.34, 0.05, 0.3, 'union flange');
box(11.05, B + 1.76, -1.9, 0.16, 0.14, 0.16, 'union gland');
for (const dx of [-0.13, 0.13]) box(11.05 + dx, B + 1.69, -1.9, 0.05, 0.06, 0.05, 'union bolt');

const bb = { minx: 1e9, miny: 1e9, minz: 1e9, maxx: -1e9, maxy: -1e9, maxz: -1e9 };
for (const p of parts) {
  bb.minx = Math.min(bb.minx, p.cx - p.w / 2); bb.maxx = Math.max(bb.maxx, p.cx + p.w / 2);
  bb.miny = Math.min(bb.miny, p.cy - p.h / 2); bb.maxy = Math.max(bb.maxy, p.cy + p.h / 2);
  bb.minz = Math.min(bb.minz, p.cz - p.d / 2); bb.maxz = Math.max(bb.maxz, p.cz + p.d / 2);
}
const tally = {};
for (const p of parts) tally[p.why] = (tally[p.why] || 0) + 1;
console.log(`\nmerged geometry: ${parts.length} boxes (${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', ')})`
  + `, ${parts.length * 24} vertices at 24 per indexed BoxGeometry`);
console.log(`  bounds x ${bb.minx.toFixed(3)}..${bb.maxx.toFixed(3)}  y ${bb.miny.toFixed(3)}..${bb.maxy.toFixed(3)}  z ${bb.minz.toFixed(3)}..${bb.maxz.toFixed(3)}`);
console.log(`  upper-sector cut is ${CULL_CUT.toFixed(2)}; min.y ${bb.miny.toFixed(3)} is `
  + `${bb.miny <= CULL_CUT ? 'BELOW it, so buildPumpGallery can never file it' : 'ABOVE it -- THE CULLER WILL BLANK THIS'}`);
console.log(`  lowest point is ${(crown.top - bb.miny).toFixed(3)} m inside the crown's top face, which hides the pipe end`);

// the sleeve, and the trap the challenge caught
const SLEEVE = 0.15;
for (const [name, at] of [['left at world (0,0,0)', V(0, 0, 0)], ['seated at FEED[0]', FEED[0]]]) {
  const minY = at.y - SLEEVE / 2;
  const maxX = at.x + SLEEVE / 2, minX = at.x - SLEEVE / 2;
  const maxZ = at.z + SLEEVE / 2, minZ = at.z - SLEEVE / 2;
  const sightline = maxX >= 5.8 && minX <= 13.0 && maxZ >= -0.2 && minZ <= 7.2;
  const filed = minY > CULL_CUT;
  console.log(`  sleeve ${name.padEnd(22)} min.y ${minY.toFixed(3)}  filed into upperSector: ${filed}`
    + `  cellarSightline: ${sightline}` + (filed && !sightline ? '   <-- CULLER ZEROES ITS WORLD LAYER' : ''));
}

// ---- draw calls ---------------------------------------------------------
// and the whole union assembly against the two round stacks on the crown: the
// flue and the collar are vertical cylinders, so the honest test is the
// horizontal distance from each box to their axis, less their radius.
const stacks = [
  { name: 'flue  ', x: 11.32, z: -1.28, r: 0.15, y0: B + 2.12 - 0.36, y1: B + 2.12 + 0.36 },
  { name: 'collar', x: 11.32, z: -1.28, r: 0.20, y0: B + 1.7 - 0.07, y1: B + 1.7 + 0.07 },
];
const gapToAxis = (p, s) => {
  const cx = Math.max(p.cx - p.w / 2, Math.min(s.x, p.cx + p.w / 2));
  const cz = Math.max(p.cz - p.d / 2, Math.min(s.z, p.cz + p.d / 2));
  return Math.hypot(s.x - cx, s.z - cz) - s.r;
};
console.log('\nthe union assembly, against the crown stacks it stands beside:');
for (const s of stacks) {
  let worst = Infinity, who = '';
  for (const p of parts) {
    if (p.cx < 10.5) continue;                                    // only the pieces on the crown
    if (p.cy - p.h / 2 > s.y1 || p.cy + p.h / 2 < s.y0) continue; // no overlap in height, no collision
    const g = gapToAxis(p, s);
    if (g < worst) { worst = g; who = p.why; }
  }
  console.log(`  ${s.name} (r ${s.r}, y ${s.y0.toFixed(2)}..${s.y1.toFixed(2)}): nearest is the ${who}, ${worst.toFixed(3)} m of air`);
}

console.log('\ndraw calls, counted as meshes:');
console.log('  removed: 5 guard bars + 2 cage rings + hanger + bell mouth = 9 -> 2 merged  (-7)');
console.log('  added:   1 feed line, always                                              (+1)');
console.log(`  added:   1 sleeve, visible only while the pulse walks (${TIME} s, once)     (+1)`);
console.log('  NET -6 at rest, -5 during the pulse -- when all of it is in frame.');

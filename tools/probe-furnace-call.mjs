// Pure-node arithmetic replay of the furnace's cold-call gate and of the two
// scoreboard thresholds the new house-critical-path page asserts. No browser,
// no GPU, no world: this only re-runs the builder's own maths so the numbers
// in the round record are derived rather than guessed.
//
//   node tools/probe-furnace-call.mjs

const B = -3;                                   // HOUSE_TABLES.levels.basement.floor
const EYE = 1.62;                               // player.pos.y + 1.62 is the camera
const inc = { x: 11.0, y: B + 0.9, z: -1.5 };   // game.incineratorPosition
const CALL_R2 = 49;                             // house.js: distanceToSquared(incPos) < 49

const camDist = (x, y, z) => Math.hypot(x - inc.x, (y + EYE) - inc.y, z - inc.z);
const row = (label, x, y, z) => {
  const d = camDist(x, y, z);
  return { label, d: +d.toFixed(3), inside: d * d < CALL_R2 };
};

console.log('--- who is inside the 7 m call radius (camera to incPos) ---');
for (const r of [
  row('boiler-room stance, the page and the report', 9.8, -3, -1.7),
  row('the throw stance this file already uses', 9, -3, -1.5),
  row('basement respawn (director.js spawns.basement)', 9, -3.0, 4.9),
  row('the pilot-throw stance (house-critical-path:206)', 7, -3, 3.55),
  row('walk waypoint (5,-3)', 5, -3, -3),
  row('walk waypoint (3.2,-3)', 3.2, -3, -3),
  row('the far stance the new page uses (-1.5,-1.5)', -1.5, -3, -1.5),
  row('the archive end of the basement zone', -20.5, -3, -1.5),
]) console.log(String(r.inside).padEnd(6), String(r.d).padStart(7), 'm  ', r.label);
console.log('basement zone x span: -20.5 .. 12 =', 12 - -20.5, 'm wide (house.js addZone)');

console.log('\n--- the gauge needle: does 2.2 s reach the FULL DRAFT assertion? ---');
// house.js: gaugeNeedle.rotation.z += (goal - z) * Math.min(1, dt * 4.6)
const DT = 1 / 120;
const step = Math.min(1, DT * 4.6);
let z = 1.18;                                   // the authored empty rest angle
const goal = -1.02;
let crossed = null;
for (let i = 1; i <= 120 * 3; i++) {
  z += (goal - z) * step;
  if (crossed === null && z < -0.9) crossed = i;
}
console.log('per-frame lerp factor          ', step.toFixed(6));
console.log('frames to cross -0.9           ', crossed, '=', (crossed * DT).toFixed(3), 's');
console.log('needle after the 2.2 s window  ', (() => {
  let v = 1.18;
  for (let i = 0; i < Math.round(2.2 / DT); i++) v += (goal - v) * step;
  return v.toFixed(4);
})(), '(assertion is < -0.9)');
console.log('needle at rest, draft missing  ', 1.18, '(assertion is > 0.9; goal == start, so it never moves)');

console.log('\n--- the door slits: can a 2.2 s window miss the > 1.2 assertion? ---');
// house.js: breath = 0.5 + 0.5*sin(t*1.6); slit.scale.y = 1 + breath*0.9
// scale.y > 1.2 needs breath > 0.2222 needs sin(t*1.6) > -0.5556
const need = (1.2 - 1) / 0.9;                   // breath
const s = 2 * need - 1;                         // sin threshold
const a = Math.asin(-s);                        // -0.5556 -> 0.5890
const deadArc = (2 * Math.PI - 2 * a) - Math.PI; // width of the arc where sin < s
console.log('breath needed                  ', need.toFixed(4));
console.log('sin(t*1.6) needed above        ', s.toFixed(4));
console.log('dead arc width (rad)           ', deadArc.toFixed(4));
console.log('2.2 s sweeps (rad)             ', (2.2 * 1.6).toFixed(4), deadArc < 2.2 * 1.6 ? '-> cannot miss' : '-> CAN MISS');
console.log('11 s sweeps (rad)              ', (11 * 1.6).toFixed(4), '-> cannot miss');
console.log('cold slit scale.y is exactly   ', 1 + 0 * 0.9, '(breath IS pilotLit)');

console.log('\n--- the call itself ---');
console.log('period 9 s == state-2 duct knock period; gain 0.30 == state-2 gain');
console.log('frames to reach the 9 s period ', Math.ceil(9 / DT), 'fixed steps at 1/120');
console.log('beat schedule after the thud   : +0.35 header end (5.38,', (B + 2.66).toFixed(2), ', 5.8)');
console.log('                                 +0.70 riser top  (3.77,', (B + 2.12).toFixed(2), ', 5.8)');
console.log('                                 +1.05 pilot chime at the wick');
console.log('the whole beat finishes in     ', 1.05, 's, inside the page\'s 11 s window');

console.log('\n--- cost ---');
console.log('geometry added: 0   materials added: 0   lights/candle descriptors added: 0');
console.log('per-frame work outside the basement: one string compare (game.act)');

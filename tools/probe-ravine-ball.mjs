// probe-ravine-ball.mjs — pure-node replay of the ravine ball's own arithmetic.
//
// No browser, no GPU, no three.js. It re-runs the exact lines the builder and
// the ticker execute, so the numbers that go into comments, commit messages and
// the legibility gate's floors are DERIVED rather than asserted:
//
//   1. where the beam's axis actually is at the hang lateral (the line length)
//   2. what the panner's exponential model leaves at 30 m / 3 m / 15 m / 8 m
//   3. how far the ball travels in a 30 s sample window on a beat and at rest,
//      SWEPT OVER EVERY PLAUSIBLE STARTING PHASE, because tests/legibility-
//      regression.mjs samples the free-running _chainPulseT and never re-phases
//      it: a floor set from one lucky phase is a gate that flakes later.
//
// This is what killed the plan's proposed 0.55 swing decay. At 0.55 the struck
// arc lives 1.82 s — SHORTER than the pendulum's own 2.61 s period — so at the
// worst phase it never completes one wide oscillation and the beat measures
// only 9 cm wider than the idle sway (2.4 cm at half-second sampling). At 0.34
// it lives 2.94 s and the beat is 17 cm+ wider at every phase swept.
//
//   node tools/probe-ravine-ball.mjs

const FIXED_DT = 1 / 120;                 // src/main.js
const SWING_DECAY = 0.34;                 // src/outside.js Forest.update
const SAMPLE_EVERY = 0.1;                 // tests/legibility-regression.mjs

// ---- 1. the geometry ------------------------------------------------------
// beam: CylinderGeometry(0.06, 0.06, 3.4, 5), rotation.z = 1.1, position.y = 3.4
const BEAM_LEN = 3.4, BEAM_ROLL = 1.1, BEAM_Y = 3.4, BEAM_R = 0.06;
const axis = { x: -Math.sin(BEAM_ROLL), y: Math.cos(BEAM_ROLL) };
const endA = { x: -axis.x * BEAM_LEN / 2, y: BEAM_Y - axis.y * BEAM_LEN / 2 };
const endB = { x: axis.x * BEAM_LEN / 2, y: BEAM_Y + axis.y * BEAM_LEN / 2 };
const LATERAL = 0.9;
const crossY = BEAM_Y + (LATERAL / axis.x) * axis.y;
const KNOT_Y = 1.25, HANG_Y = 2.94;
const HANG_LEN = HANG_Y - KNOT_Y;
console.log('1. GEOMETRY');
console.log(`   beam ends           (${endA.x.toFixed(4)}, ${endA.y.toFixed(4)}) and (${endB.x.toFixed(4)}, ${endB.y.toFixed(4)})`);
console.log(`   axis at x=${LATERAL}       y = ${crossY.toFixed(4)}`);
console.log(`   HANG_Y shipped      ${HANG_Y}  (${Math.abs(crossY - HANG_Y).toFixed(4)} m off the axis, beam radius ${BEAM_R})`);
console.log(`   old line 1.2 -> 3.4 overshot the axis by ${(3.4 - crossY).toFixed(4)} m`);
console.log(`   HANG_LEN            ${HANG_LEN.toFixed(2)} m; free rate sqrt(9.81/${HANG_LEN.toFixed(2)}) = ${Math.sqrt(9.81 / HANG_LEN).toFixed(4)} rad/s, period ${(2 * Math.PI / Math.sqrt(9.81 / HANG_LEN)).toFixed(3)} s`);
console.log(`   ball rest world y   ${(HANG_Y - HANG_LEN).toFixed(2)}  (ravineKnotAt/ropeAnchor unchanged: ${(HANG_Y - HANG_LEN) === KNOT_Y})`);

// ---- 2. the carry ---------------------------------------------------------
// audio.js hands ref/roll to a PannerNode's exponential model:
//   gain = (max(d, ref) / ref) ^ -roll
const carry = (d, ref, roll) => Math.pow(Math.max(d, ref) / ref, -roll);
const REF = 4.5, ROLL = 0.55, D_REF = 2.4, D_ROLL = 1.5;
console.log('\n2. CARRY');
console.log(`   at 30 m   ours ${carry(30, REF, ROLL).toFixed(4)}   kit default ${carry(30, D_REF, D_ROLL).toFixed(4)}`);
console.log(`   3 m / 15 m ratio ${(carry(3, REF, ROLL) / carry(15, REF, ROLL)).toFixed(4)}  (nearFalloff floor is 1.4)`);
console.log(`   an 8 m latch on the kit default retains ${carry(8, D_REF, D_ROLL).toFixed(4)} of source gain`);

// ---- 3. the swing ---------------------------------------------------------
// Forest.update, verbatim:
//   swing = max(0, swing - dt * 0.34);  breath = swing * swing
//   rotation.z = sin(t * 2.41) * (0.035 + 0.15 * breath) + sin(t * 0.62) * 0.045
//   callT -= dt; if (callT <= 0) { calls++;
//                 callT = 5.8 + (sin(calls * 2.399963) * 0.5 + 0.5) * 3.4;
//                 swing = 1; creak }
//
// The hang group is yawed about Y and swung about Z, and both children sit ON
// its Y axis, so for a local (0, -L, 0) the world offset is
//   (L*cos(yaw)*sin(th), -L*cos(th), -L*sin(yaw)*sin(th))
// — a planar pendulum whose plane is perpendicular to the lane tangent. The
// distance between two sampled angles therefore collapses to
//   L * 2 * |sin((th1 - th2) / 2)|
// so the sampled travel needs only the extreme angles, and the yaw drops out.
function runWindow({ t0, callT0, live, seconds = 30, sampleEvery = SAMPLE_EVERY, settle = 0 }) {
  let t = t0, callT = callT0, swing = 0, calls = 0;
  const sub = Math.round(sampleEvery / FIXED_DT);
  const stepFor = (secs, collect) => {
    const n = Math.round(secs / sampleEvery);
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < sub; i++) {
        t += FIXED_DT;
        swing = Math.max(0, swing - FIXED_DT * SWING_DECAY);
        if (live) {
          callT -= FIXED_DT;
          if (callT <= 0) {
            calls++;
            callT = 5.8 + (Math.sin(calls * 2.399963) * 0.5 + 0.5) * 3.4;
            swing = 1;
          }
        }
      }
      const breath = swing * swing;
      const th = Math.sin(t * 2.41) * (0.035 + 0.15 * breath) + Math.sin(t * 0.62) * 0.045;
      if (collect) collect.push(th);
    }
  };
  if (settle) stepFor(settle, null);
  const angles = [];
  stepFor(seconds, angles);
  const lo = Math.min(...angles), hi = Math.max(...angles);
  return { travel: 2 * HANG_LEN * Math.sin((hi - lo) / 2), calls, t };
}

// The gate cannot control the starting phase: _chainPulseT has been free-running
// since the forest was built and the block before it is not fixed-length. Sweep.
const beat = [], rest = [], callCounts = [];
for (let i = 0; i < 400; i++) {
  const t0 = i * 0.0731;                    // an incommensurate stride over ~29 s
  const w = runWindow({ t0, callT0: 2.05, live: true });
  beat.push(w.travel); callCounts.push(w.calls);
  // the gate's rest window: the crossing is spent, so no more calls, and it
  // waits out the last struck arc (2.94 s) before it starts sampling.
  rest.push(runWindow({ t0: w.t, callT0: 99, live: false, settle: 3.5 }).travel);
}
const stat = (a) => ({ min: Math.min(...a), max: Math.max(...a), mean: a.reduce((s, v) => s + v, 0) / a.length });
const B = stat(beat), R = stat(rest), D = stat(beat.map((v, i) => v - rest[i]));
const fmt = (s) => `min ${s.min.toFixed(3)}  mean ${s.mean.toFixed(3)}  max ${s.max.toFixed(3)}`;
console.log(`\n3. SWING, over 400 starting phases, ${Math.round(30 / SAMPLE_EVERY)} samples at ${SAMPLE_EVERY} s (30 s), as the gate takes them`);
console.log(`   calls in 30 s        min ${Math.min(...callCounts)}  max ${Math.max(...callCounts)}   (the 3+ floor)`);
console.log(`   travel on a beat     ${fmt(B)}  m`);
console.log(`   travel at rest       ${fmt(R)}  m`);
console.log(`   beat minus rest      ${fmt(D)}  m`);
console.log(`   envelope maxima      beat ${(2 * HANG_LEN * Math.sin(0.23)).toFixed(3)} m, rest ${(2 * HANG_LEN * Math.sin(0.08)).toFixed(3)} m`);
const floor = (v) => (Math.floor(v * 0.6 * 100) / 100).toFixed(2);
console.log('\n   FLOORS this supports (the gate file\'s own rule: ~0.6x the WORST measured case)');
console.log(`     swingRange              >= ${floor(B.min)}   (shipped: 0.15, the limb's own wording)`);
console.log(`     swingRange - restRange  >= ${floor(D.min)}`);

// ---- 4. does the arc stay inside the corridor? ----------------------------
// The forest spline is fully deterministic — RNG(0x51ab) drives a 26-step
// heading walk and nothing else touches it first — so it replays exactly here
// without a browser. mulberry32/gauss are copied from src/util.js verbatim.
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const f01 = mulberry32(0x51ab);
const gauss = () => (f01() + f01() + f01()) / 1.5 - 1;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pts = [];
let px = 2, pz = 44, h = 0;                 // FOREST_GATE.x, FOREST_GATE.z + 1
pts.push([px, pz]);
for (let i = 0; i < 26; i++) {
  h = clamp(h + gauss() * 0.42, -0.9, 0.9);
  px += Math.sin(h) * 8; pz += Math.cos(h) * 8;
  pts.push([px, pz]);
}
const samples = [];
for (let i = 0; i < pts.length - 1; i++) {
  const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len));
  for (let k = 0; k < n; k++) {
    const t = k / n;
    samples.push({ x: lerp(ax, bx, t), z: lerp(az, bz, t), tx: (bx - ax) / len, tz: (bz - az) / len });
  }
}
const LEN = samples.length;
const ravineS = Math.floor(LEN * 0.5);
const CHAIN = { widen: 1.35, widenAt: 182, span: 26 };
const POCKETS = [{ centerS: 74, widen: 5.45, span: 10.5 }, { centerS: 179, widen: 5.55, span: 10.5 }];
const FORKS = [
  { startS: 48, endS: 64, separation: 4.25, routeWidth: 1.28 },
  { startS: 118, endS: 139, separation: 4.4, routeWidth: 1.3 },
];
const arenaS = Math.floor(LEN * 0.72);      // Forest.arenaS()
const baseHalfW = samples.map((s, i) => {
  const t = i / LEN;
  let w = lerp(2.4, 1.5, smoothstep(0, 0.35, t)) * (0.9 + 0.2 * Math.sin(i * 0.29));
  w += 9 * Math.exp(-(((i - arenaS) / 14) ** 2));
  w += CHAIN.widen * Math.exp(-(((i - CHAIN.widenAt) / CHAIN.span) ** 2));
  return w;
});
const halfW = baseHalfW.map((base, i) => {
  let w = base;
  for (const p of POCKETS) w += p.widen * Math.exp(-(((i - p.centerS) / p.span) ** 2));
  for (const fk of FORKS) {
    const shoulder = smoothstep(fk.startS - 3.5, fk.startS + 3, i) * (1 - smoothstep(fk.endS - 3, fk.endS + 3.5, i));
    w = Math.max(w, base + shoulder * (fk.separation + fk.routeWidth + 1.45));
  }
  return w;
});
const bi = clamp(Math.round(ravineS + 4), 0, LEN - 1);
const sm = samples[bi];
// The ball hangs at a WORLD +0.9 x offset from the centreline point, so its
// lane-lateral coordinate is the projection of (0.9, 0) onto (-tz, tx).
const ballLat = -0.9 * sm.tz;
const armLat = HANG_LEN * Math.sin(0.23);   // the beat's peak lateral excursion
console.log('\n4. THE ARC AGAINST THE CORRIDOR (spline replayed from RNG(0x51ab))');
console.log(`   forest length ${LEN} m, ravineS ${ravineS}, ball at sample ${bi}`);
console.log(`   lane tangent        (${sm.tx.toFixed(4)}, ${sm.tz.toFixed(4)})`);
console.log(`   swing axis is the lane LATERAL (dot with tangent = ${(sm.tz * sm.tx + -sm.tx * sm.tz).toFixed(6)})`);
console.log(`   ball lane-lateral   ${ballLat.toFixed(3)} m, sweeping ${(ballLat - armLat).toFixed(3)} .. ${(ballLat + armLat).toFixed(3)} on a beat`);
console.log(`   corridor half-width ${halfW[bi].toFixed(3)} m (base ${baseHalfW[bi].toFixed(3)}); player is clamped to ${(baseHalfW[bi] - 0.38).toFixed(3)}`);
console.log(`   nearest wall on a beat: ${(halfW[bi] - Math.abs(ballLat) - armLat).toFixed(3)} m of clearance`);
const idleLat = HANG_LEN * Math.sin(0.08);  // the at-rest sway's lateral excursion
console.log(`   after the crossing the arc is idle only: ${(ballLat - idleLat).toFixed(3)} .. ${(ballLat + idleLat).toFixed(3)},`);
console.log(`   so the ball you walk past never comes nearer than ${Math.abs(ballLat + idleLat).toFixed(3)} m to the centreline`);

// ---- 5. what the two new legibility rows should measure -------------------
// Not a substitute for running the gate — this is the arithmetic that says
// whether the placeholder FLOORS in tests/legibility-regression.mjs are far
// enough under the truth to be safe until someone with a GPU replaces them.
// Camera: PerspectiveCamera(71) vertical, harness viewport 1280x800 at DPR 1.
const FOVY = 71 * Math.PI / 180, VH = 800, VW = 1280;
const PX_PER_RAD = VH / FOVY;
const eyeAt = (s) => ({ x: samples[s].x, y: 1.62, z: samples[s].z });
const ball = { x: samples[bi].x + 0.9, y: KNOT_Y, z: samples[bi].z };
const dist = (s) => { const e = eyeAt(s); return Math.hypot(ball.x - e.x, ball.y - e.y, ball.z - e.z); };
console.log('\n5. THE TWO NEW LEGIBILITY ROWS (estimate, NOT a measurement)');
for (const [label, s, floorPct] of [
  ['from the top of the mire approach', ravineS - 22, 0.01],
  ['from the near lip of the mire', ravineS - 5, 0.05],
]) {
  const d = dist(s);
  const haloPx = (1.6 / d) * PX_PER_RAD;                       // sprite is 1.6 m across
  const haloArea = Math.PI * (haloPx / 2) ** 2;
  const linePx = (HANG_LEN / d) * PX_PER_RAD * (0.084 / d) * PX_PER_RAD;
  const pct = 100 * (haloArea + linePx) / (VW * VH);
  console.log(`   ${label.padEnd(34)} ${d.toFixed(1)} m away, halo ${haloPx.toFixed(0)} px across`);
  console.log(`   ${''.padEnd(34)} ~${pct.toFixed(3)}% of frame at full alpha, ~${(pct * 0.36).toFixed(3)}% if only the`);
  console.log(`   ${''.padEnd(34)} inner 60% of the gradient clears the read's |dL| > 4 gate`);
  console.log(`   ${''.padEnd(34)} shipped floor ${floorPct}% => ${(pct * 0.36 / floorPct).toFixed(1)}x headroom on the pessimistic figure`);
}

// real-shell.js — REALISM ROUND, Opus entry: "THE REMAINS".
//
// Why this is built differently from every earlier sculpt. The previous
// attempts ASSEMBLED a skull out of separate bones — a cranium sphere, orbit
// rings, a maxilla loft, cheek plates. Real skulls have no seams, and every
// join between two meshes reads as a plate in raking candlelight. That is the
// "looks silly / doesn't look like a real skull" failure.
//
// So: ONE continuous cranio-facial shell. Its radius is a smooth union of
// anatomical volumes (neurocranium, frontal, occiput, midface, alveolar
// process, zygomatic bodies, mastoids), out of which the orbits, nasal
// aperture, temporal fossae and canine fossae are CARVED as deep radial pits.
// Nothing is stuck on. Only what is genuinely detached in a real skull stays a
// separate mesh: the zygomatic arches (you can see through the gap behind
// them), the teeth, and the mandible.
//
// Everything is placed against real cranial landmarks, measured from the orbit
// centre: vertex +98mm, glabella +24, nasion +14, orbit 0, nasal spine −48,
// upper alveolar margin −62, occlusal plane −73, gonion −82, menton −114.
// Guessing these is what makes procedural skulls read as eggs with holes.
//
// Two things do the realism heavy lifting:
//   1. Baked crevice occlusion. Every vertex samples the shell's own radius
//      around itself; where the neighbourhood stands proud, that vertex is
//      down a crack and collects dirt. Sockets, sutures, the temporal line,
//      the tooth line and every carved margin darken exactly where a real
//      skull darkens, for free.
//   2. Value-only aging. Alex is colourblind: every read here — sockets,
//      staining, crevices — is carried by BRIGHTNESS, never by hue.
//
// Contract: buildSkullMesh(boneMaterial) -> { root, jaw, jawMount, sockets,
// eyeL, eyeR, stageSets }. Face +Z. sockets[0..1] are the eye voids (the
// house.js ember beat slices those two). Tris budget <= 9000.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const bell = (x, s) => Math.exp(-(x * x) / (2 * s * s));
const band = (v, a0, a1, b1, b0) => ss(a0, a1, v) * (1 - ss(b1, b0, v));

// polynomial smooth max / min — blends two radii over a k-metre window without
// the log-sum-exp inflation that would puff the whole skull up
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// authored life-size (a real adult skull: 149mm across the parietals, 212mm
// vertex to chin), worn slightly large by an inner group so that root itself
// stays unscaled for the game's transforms
const WEAR = 1.10;

// ============================================================ the shell field
const VOL = [
  // [cx, cy, cz,  rx, ry, rz,  blend]
  [0, 0.018, -0.012, 0.0725, 0.0800, 0.0865, 0.018], // neurocranium
  [0, 0.030, 0.014, 0.0660, 0.0500, 0.0700, 0.020], // frontal
  [0, -0.006, -0.034, 0.0640, 0.0600, 0.0680, 0.018], // occiput
  [0, -0.018, 0.000, 0.0530, 0.0440, 0.0620, 0.016], // cranial base
  [0, -0.022, 0.024, 0.0430, 0.0300, 0.0590, 0.014], // midface
  [0, -0.046, 0.022, 0.0360, 0.0170, 0.0500, 0.011], // alveolar process
  // the malar mass sits BELOW the orbit floor — push it up into the socket and
  // the socket stops being one
  [-0.0505, -0.028, 0.0390, 0.0170, 0.0175, 0.0195, 0.017], // zygomatic body L
  [0.0505, -0.028, 0.0390, 0.0170, 0.0175, 0.0195, 0.017], // zygomatic body R
  [-0.0540, -0.036, -0.030, 0.0115, 0.0165, 0.0130, 0.010], // mastoid L
  [0.0540, -0.036, -0.030, 0.0115, 0.0165, 0.0130, 0.010], // mastoid R
];

// distance from the origin to an ellipsoid's far surface along d (-1 = miss)
function volRadius(v, dx, dy, dz) {
  const ax = dx / v[3], ay = dy / v[4], az = dz / v[5];
  const bx = -v[0] / v[3], by = -v[1] / v[4], bz = -v[2] / v[5];
  const A = ax * ax + ay * ay + az * az;
  const B = 2 * (bx * ax + by * ay + bz * az);
  const C = bx * bx + by * by + bz * bz - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return -1;
  return (-B + Math.sqrt(disc)) / (2 * A);
}

function unionRadius(dx, dy, dz) {
  let r = -1;
  for (let i = 0; i < VOL.length; i++) {
    const t = volRadius(VOL[i], dx, dy, dz);
    if (t < 0) continue;
    r = r < 0 ? t : smax(r, t, VOL[i][6]);
  }
  return r < 0 ? 0.02 : r;
}

// ------------------------------------------------------------- the apertures
// An aperture is defined the way an anatomist sees one: a shape on the OUTER
// surface, viewed down its own axis. Inside it, the surface plunges.
function apertureAxes(ax, ay, az) {
  const o = new THREE.Vector3(ax, ay, az).normalize();
  const u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), o).normalize();
  const v = new THREE.Vector3().crossVectors(o, u).normalize();
  return { o, u, v };
}
const ORBIT = { '-1': apertureAxes(-0.405, 0.030, 1), 1: apertureAxes(0.405, 0.030, 1) };
const NASAL = apertureAxes(0, -0.370, 1);

// normalised aperture coordinate q (1 == the rim)
function orbitQ(dx, dy, dz, s) {
  const A = ORBIT[s];
  const c = dx * A.o.x + dy * A.o.y + dz * A.o.z;
  if (c <= 0.30) return 9;
  const du = Math.atan2(dx * A.u.x + dy * A.u.y + dz * A.u.z, c);
  const dv = Math.atan2(dx * A.v.x + dy * A.v.y + dz * A.v.z, c);
  // the lateral corner of a real orbit sits a little low — but only a little;
  // tilt it far and you get an angry cartoon eyebrow instead of a socket
  const tl = -s * 0.055;
  const qu = du * Math.cos(tl) - dv * Math.sin(tl);
  const qv = du * Math.sin(tl) + dv * Math.cos(tl);
  // a real orbit is a rounded rectangle standing slightly wider than tall,
  // with a flat supraorbital margin across the top
  const q = Math.pow(Math.pow(Math.abs(qu) / ORB_AU, ORB_N) + Math.pow(Math.abs(qv) / ORB_AV, ORB_N), 1 / ORB_N);
  // medial wall runs almost straight down to the nose; lateral corner rounds off
  return q * (1 - 0.05 * ss(0.0, 0.5, qu * s / ORB_AU));
}
const ORB_N = 3.3, ORB_AU = 0.228, ORB_AV = 0.212;

// a direction sitting at fraction f of the way out to the orbit's rim, along
// the rim's own shape — used to lay the light-swallowing void across the whole
// aperture instead of a circle in the middle of it
function orbitDir(a, f, s, out) {
  const A = ORBIT[s];
  const cs = Math.cos(a), sn = Math.sin(a);
  const rho = f / Math.pow(Math.pow(Math.abs(cs) / ORB_AU, ORB_N) + Math.pow(Math.abs(sn) / ORB_AV, ORB_N), 1 / ORB_N);
  const tl = s * 0.055;                     // undo the aperture tilt
  const qu = rho * cs, qv = rho * sn;
  const du = qu * Math.cos(tl) - qv * Math.sin(tl);
  const dv = qu * Math.sin(tl) + qv * Math.cos(tl);
  return out.copy(A.o).addScaledVector(A.u, Math.tan(du)).addScaledVector(A.v, Math.tan(dv)).normalize();
}

function nasalQ(dx, dy, dz) {
  const c = dx * NASAL.o.x + dy * NASAL.o.y + dz * NASAL.o.z;
  if (c <= 0.30) return 9;
  const du = Math.atan2(dx * NASAL.u.x + dy * NASAL.u.y + dz * NASAL.u.z, c);
  const dv = Math.atan2(dx * NASAL.v.x + dy * NASAL.v.y + dz * NASAL.v.z, c);
  // pear: pinched to a slit up between the orbits, flaring at the base
  const AU = lerp(0.150, 0.058, ss(-0.04, 0.16, dv));
  const AV = dv > 0 ? 0.205 : 0.150;
  const n = 2.3;
  let q = Math.pow(Math.pow(Math.abs(du) / AU, n) + Math.pow(Math.abs(dv) / AV, n), 1 / n);
  q += 0.24 * bell(du, 0.055) * ss(-0.04, -0.13, dv);   // the notch over the spine
  return q;
}

// a direction at fraction f out to the piriform rim, along the pear's own
// outline. AU depends on height, so solve it by two fixed-point passes.
function nasalDir(a, f, out) {
  const cs = Math.cos(a), sn = Math.sin(a);
  let dv = 0;
  let rho = 0;
  for (let it = 0; it < 3; it++) {
    const AU = lerp(0.150, 0.058, ss(-0.04, 0.16, dv));
    const AV = dv > 0 ? 0.205 : 0.150;
    rho = f / Math.pow(Math.pow(Math.abs(cs) / AU, 2.3) + Math.pow(Math.abs(sn) / AV, 2.3), 1 / 2.3);
    dv = rho * sn;
  }
  return out.copy(NASAL.o).addScaledVector(NASAL.u, Math.tan(rho * cs))
    .addScaledVector(NASAL.v, Math.tan(dv)).normalize();
}

// --------------------------------------------------------------- the surface
function shellRadius(dx, dy, dz) {
  let r = unionRadius(dx, dy, dz);
  let px = dx * r, py = dy * r, pz = dz * r;

  // temporal fossa: a firm-edged hollow between the temporal line and the arch.
  // It is what makes the gap under the zygomatic arch readable at all.
  // — and it must stop BEHIND the cheekbone: run it forward into the zygomatic
  // body and it cuts a groove that leaves a flange standing off the face
  const tf = ss(0.042, 0.060, Math.abs(px))
    * band(py, -0.038, -0.012, 0.026, 0.046)
    * band(pz, -0.054, -0.020, 0.008, 0.032);
  r -= 0.0135 * tf;
  // the temporal line — a low crest along the fossa's upper margin
  r += 0.0019 * bell(py - 0.045, 0.010) * ss(0.032, 0.052, Math.abs(px)) * band(pz, -0.058, -0.030, 0.016, 0.044);

  // supraorbital torus: heavy over each orbit, dipping at the glabella
  const front = ss(0.020, 0.055, pz);
  r += 0.0068 * bell(py - 0.0245, 0.0120) * front
    * (0.55 + 0.95 * bell(Math.abs(px) - 0.0290, 0.0155) - 0.55 * bell(px, 0.0085));
  // the shadow line under the brow
  r -= 0.0052 * bell(py - 0.0120, 0.0072) * front;
  // the forehead falls away above the brow instead of bulging like a dome
  r -= 0.0062 * ss(0.034, 0.074, py) * front;

  // Orbits — deep funnels, sharp margins, the darkest thing on the skull.
  // Cut to an ABSOLUTE floor radius rather than by subtracting a fixed depth:
  // subtracting lets whatever volume bulges underneath (the cheekbone) push
  // the socket floor back out, which is what turns a socket into an eyebrow.
  for (const s of [-1, 1]) {
    const q = orbitQ(dx, dy, dz, s);
    if (q < 1.25) {
      const t = clamp(q, 0, 1);
      // steep walls, flat-ish floor: a rounded bowl catches the light across
      // most of its area and reads as a dimple, not a socket
      const floor = 0.0905 - 0.0415 * Math.sqrt(1 - t * t * t * t);
      r = smin(r, floor, 0.0032);
      r += 0.0034 * bell(q - 1.045, 0.042);        // a crisp raised orbital margin
    }
  }

  // nasal aperture — pear, bones tenting above it, spine below
  const nq = nasalQ(dx, dy, dz);
  if (nq < 1.35) {
    const t = clamp(nq, 0, 1);
    r = smin(r, 0.0880 - 0.0320 * Math.pow(1 - t * t, 0.56), 0.0030);
    r += 0.0017 * bell(nq - 1.05, 0.06);
  }
  // nasal bones: a narrow tent above the aperture with a ridge down the middle
  r += 0.0015 * bell(px, 0.0090) * band(py, -0.016, -0.002, 0.018, 0.030) * front;
  // anterior nasal spine: the small forward point at the aperture's floor —
  // any bigger and the profile grows a beak
  r += 0.0029 * bell(px, 0.0040) * bell(py + 0.0480, 0.0048) * ss(0.040, 0.065, pz);

  // canine fossa: the hollow under each orbit. Without it the cheek is one
  // flat plane from socket to tooth row and the face reads as a snout.
  r -= 0.0062 * bell(Math.abs(px) - 0.0255, 0.0135) * bell(py + 0.0375, 0.0145) * ss(0.026, 0.054, pz);
  // Juga — the vertical swells over the tooth ROOTS, and the canine eminence.
  // These are what make an alveolar process read as bone holding teeth rather
  // than a smooth shelf with pegs stuck in it. The period has to match the
  // actual tooth spacing (~8mm), not some arbitrary wave.
  r += 0.0021 * Math.max(0, Math.sin(px * 760 + 1.2)) * bell(py + 0.0545, 0.0095) * ss(0.026, 0.054, pz);
  r += 0.0026 * bell(Math.abs(px) - 0.0175, 0.0060) * bell(py + 0.0510, 0.0130) * ss(0.030, 0.058, pz);

  // the surface tucks in hard above the tooth row at the side of the muzzle
  r -= 0.0056 * ss(0.028, 0.044, Math.abs(px)) * band(py, -0.068, -0.056, -0.032, -0.020) * ss(0.005, 0.035, pz);

  // occiput: it protrudes, then breaks sharply into the nuchal plane. A cranium
  // that just curves round to the base is an egg, not a head.
  const back = ss(0.045, 0.090, -pz);
  r += 0.0042 * bell(py - 0.004, 0.030) * ss(0.55, 0.95, -dz);
  r += 0.0034 * bell(py + 0.0210, 0.0105) * bell(px, 0.030) * back;
  r -= 0.0056 * bell(py + 0.0400, 0.0175) * back;
  // and the crown is flatter than a sphere's — the parietals meet, not bulge
  r -= 0.0040 * Math.pow(clamp(dy, 0, 1), 6);

  // Vault landmarks. A real vault is not a smooth dome: paired frontal
  // eminences above the brow, paired parietal eminences behind the temporal
  // line, and a shallow trough between each pair. Without them a single point
  // light slides across the top and the skull reads as an egg.
  r += 0.0024 * bell(Math.abs(px) - 0.0245, 0.0165) * bell(py - 0.0520, 0.0190) * ss(0.020, 0.055, pz);
  r += 0.0028 * bell(Math.abs(px) - 0.0570, 0.0230) * bell(py - 0.0390, 0.0250) * bell(pz + 0.0140, 0.0330);
  r -= 0.0013 * bell(px, 0.0130) * band(py, 0.030, 0.055, 0.080, 0.098);

  // and the splits it earned in the ground
  r -= 0.0016 * crackMask(dx, dy, dz);

  // the groove in front of each mastoid tip
  r -= 0.0028 * bell(Math.abs(px) - 0.0470, 0.0090) * bell(py + 0.0450, 0.0105) * ss(0.010, -0.030, pz);

  px = dx * r; py = dy * r; pz = dz * r;

  // flattened cranial base — behind the muzzle the skull sits on a plane
  if (dy < -0.16) {
    const rear = 1 - ss(-0.012, 0.048, pz);
    if (rear > 0.01) r = lerp(r, smin(r, -0.0470 / dy, 0.016), rear);
  }

  // nothing that ever lived is symmetrical, and nothing buried stays perfect
  r += 0.00080 * Math.sin(41 * px + 27 * py + 1.7)
    + 0.00050 * Math.sin(83 * py + 61 * pz + 0.4)
    + 0.00028 * Math.sin(151 * px + 113 * pz + 2.9);
  // a shallow dent healed into the left parietal
  r -= 0.0040 * bell(px + 0.050, 0.021) * bell(py - 0.045, 0.026) * bell(pz + 0.026, 0.034);

  return r;
}

const shellPoint = (dx, dy, dz, out) => {
  const r = shellRadius(dx, dy, dz);
  return out.set(dx * r, dy * r, dz * r);
};

// ================================================================ vertex paint
// [x, y, z, radius, strength] — where the ground held it
const STAINS = [
  [-0.062, 0.026, -0.028, 0.030, 0.44],   // left temporal, the big one
  [0.040, 0.062, -0.046, 0.034, 0.34],    // right parietal, over the crown
  [-0.020, -0.050, 0.062, 0.024, 0.30],   // under the nose, down the maxilla
  [0.058, -0.030, 0.010, 0.022, 0.36],    // right cheek into the arch
  [0.006, 0.020, -0.092, 0.030, 0.32],    // the occiput, where it rested
];

function mottle(x, y, z) {
  return 0.50 + 0.26 * Math.sin(37 * x + 23 * y + 19 * z)
    + 0.16 * Math.sin(71 * y - 53 * z + 1.9)
    + 0.09 * Math.sin(131 * x + 97 * z + 4.1)
    + 0.05 * Math.sin(211 * y + 173 * x + 0.7);
}

// crevice occlusion sampled from the shell's own field: if the neighbourhood
// stands proud of this vertex, this vertex is down a crack and collects dirt
const AO_TAPS = [];
for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; AO_TAPS.push([Math.cos(a), Math.sin(a)]); }

function shellAO(dx, dy, dz, r, spread) {
  const d = new THREE.Vector3(dx, dy, dz);
  const u = new THREE.Vector3(0, 1, 0).cross(d);
  if (u.lengthSq() < 1e-8) u.set(1, 0, 0);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(d, u);
  let sum = 0;
  for (const [cu, cv] of AO_TAPS) {
    const nx = dx + (u.x * cu + v.x * cv) * spread;
    const ny = dy + (u.y * cu + v.y * cv) * spread;
    const nz = dz + (u.z * cu + v.z * cv) * spread;
    const l = Math.hypot(nx, ny, nz);
    sum += clamp((shellRadius(nx / l, ny / l, nz / l) - r) / 0.0070, 0, 1);
  }
  return sum / AO_TAPS.length;
}

// the cranial sutures, as directions on the unit sphere — drawn in dirt rather
// than geometry, so they cost nothing and never break the silhouette
const SUTURE_CURVES = [
  [[-0.93, 0.30, 0.22], [-0.62, 0.74, 0.20], [-0.20, 0.96, 0.16], [0.22, 0.95, 0.18], [0.63, 0.72, 0.22], [0.93, 0.28, 0.25]],
  [[0.00, 0.99, 0.12], [0.02, 0.93, -0.34], [-0.02, 0.74, -0.66], [0.01, 0.50, -0.86]],
  [[0.01, 0.50, -0.86], [-0.40, 0.36, -0.83], [-0.74, 0.18, -0.62]],
  [[0.01, 0.50, -0.86], [0.42, 0.34, -0.81], [0.76, 0.20, -0.60]],
  [[-0.96, 0.06, 0.30], [-0.87, 0.32, -0.02], [-0.80, 0.16, -0.42]],
  [[0.96, 0.05, 0.31], [0.87, 0.31, -0.03], [0.80, 0.15, -0.43]],
].map((pts, ci) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p).normalize()))
  .getPoints(44).map((p, i) => {
    // wander: a suture that reads as a clean arc reads as a seam in a model
    const w = 0.030 * Math.sin(i * 2.3 + ci * 1.7) + 0.018 * Math.sin(i * 6.1 + ci);
    return p.clone().add(new THREE.Vector3(w * 0.35 * p.y, w, w * 0.35 * p.x)).normalize();
  }));

// old bone splits. These are NOT sutures — a suture wanders and stays shut, a
// crack runs straight-ish, cuts across whatever is in its way, and holds a
// harder shadow. One over the frontal, one down the maxilla.
const CRACK_CURVES = [
  [[0.44, 0.26, 0.86], [0.46, 0.52, 0.72], [0.39, 0.74, 0.55], [0.28, 0.91, 0.30]],
  [[-0.35, -0.06, 0.94], [-0.335, -0.30, 0.90], [-0.30, -0.52, 0.80]],
].map((pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p).normalize()))
  .getPoints(30).map((p, i) => p.clone()
    .add(new THREE.Vector3(0.006 * Math.sin(i * 3.1), 0.005 * Math.sin(i * 4.7 + 1.1), 0)).normalize()));

function nearestDir(dx, dy, dz, curves) {
  let best = 9;
  for (const pts of curves) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const d = Math.hypot(dx - p.x, dy - p.y, dz - p.z);
      if (d < best) best = d;
    }
  }
  return best;
}
const sutureMask = (dx, dy, dz) => 1 - ss(0.008, 0.028, nearestDir(dx, dy, dz, SUTURE_CURVES));
const crackMask = (dx, dy, dz) => 1 - ss(0.003, 0.014, nearestDir(dx, dy, dz, CRACK_CURVES));

// ============================================================== small helpers
function gridGeo(uSeg, vSeg, fn) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= vSeg; j++) {
    for (let i = 0; i <= uSeg; i++) {
      const p = fn(i / uSeg, j / vSeg);
      pos.push(p[0], p[1], p[2]);
      uv.push(i / uSeg, j / vSeg);
    }
  }
  for (let j = 0; j < vSeg; j++) {
    for (let i = 0; i < uSeg; i++) {
      const a = j * (uSeg + 1) + i, b = a + 1, c = a + uSeg + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// sweep with an EXPLICIT outward reference. A parallel-transported frame rolls
// when the path turns from vertical (the mandibular ramus) to horizontal (the
// body), which flattens the chin the wrong way round; this does not.
function sweepGeo(pts, outward, sec, radial = 8, cap = true) {
  const n = pts.length, pos = [], uv = [], idx = [];
  const t = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    t.copy(pts[Math.min(i + 1, n - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
    e1.copy(outward(f, pts[i]));
    e1.addScaledVector(t, -e1.dot(t)).normalize();
    e2.crossVectors(t, e1).normalize();
    const { w, h } = sec(f);
    for (let r = 0; r < radial; r++) {
      const a = (r / radial) * TAU;
      const cw = Math.cos(a) * w, sh = Math.sin(a) * h;
      pos.push(pts[i].x + e1.x * cw + e2.x * sh,
        pts[i].y + e1.y * cw + e2.y * sh,
        pts[i].z + e1.z * cw + e2.z * sh);
      uv.push(f, r / radial);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let r = 0; r < radial; r++) {
      const r2 = (r + 1) % radial;
      idx.push(i * radial + r, (i + 1) * radial + r, i * radial + r2,
        i * radial + r2, (i + 1) * radial + r, (i + 1) * radial + r2);
    }
  }
  if (cap) {
    const c0 = pos.length / 3;
    pos.push(pts[0].x, pts[0].y, pts[0].z); uv.push(0, 0.5);
    const c1 = pos.length / 3;
    pos.push(pts[n - 1].x, pts[n - 1].y, pts[n - 1].z); uv.push(1, 0.5);
    for (let r = 0; r < radial; r++) {
      const r2 = (r + 1) % radial;
      idx.push(c0, r, r2);
      idx.push(c1, (n - 1) * radial + r2, (n - 1) * radial + r);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the same aging law for every bone part, driven by position, so the mandible
// and the arches stain continuously with the shell they sit against
function paintBone(geo, { ao = 0, extra = null } = {}) {
  const p = geo.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let v = 1 - 0.17 * mottle(x, y, z);
    v *= 1 - 0.55 * ao;
    v *= 1 - 0.32 * ss(-0.030, -0.098, y);
    if (extra) v *= extra(x, y, z);
    v = clamp(v, 0.05, 1.1);
    col[i * 3] = v; col[i * 3 + 1] = v * (1 - 0.04 * (1 - v)); col[i * 3 + 2] = v * (1 - 0.10 * (1 - v));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// ================================================================== the teeth
function toothGeo(def, upper, broken) {
  const R = 5;
  const dir = upper ? -1 : 1;
  const h = def.h * (broken ? 0.50 : 1);
  // The second ring is a COLLAR wider than the crown. Without it there is a
  // full-height black gap between every neighbouring tooth and black above the
  // gum line, and the row reads as loose pegs floating in a hole instead of
  // teeth set in bone.
  const rings = [
    { y: 0.0106 * -dir, sx: 0.34, sz: 0.36 },   // root, buried
    { y: 0.0030 * -dir, sx: 1.17, sz: 1.11 },   // alveolar collar
    { y: -0.0006 * -dir, sx: 0.96, sz: 0.96 },  // the cervical line
    { y: h * 0.52 * dir, sx: 1.00, sz: 1.00 },
  ];
  // Crowns must be HUMAN, not fangs. Every tooth converging to an apex is what
  // turns an open jaw into a bear trap, and the jaw is this game's radar — it
  // chatters constantly, so the open pose is on screen more than the closed one.
  // Only the canine gets a point; incisors get a chisel edge, the back teeth a
  // low table.
  let tip = { y: h * 0.93 * dir, sx: 0.90, sz: 0.52 }, capMul = 0.95;
  if (def.kind === 'canine') { tip = { y: h * 0.86 * dir, sx: 0.44, sz: 0.46 }; capMul = 1.10; }
  if (def.kind === 'premolar') { tip = { y: h * 0.90 * dir, sx: 0.76, sz: 0.66 }; capMul = 0.935; }
  if (def.kind === 'molar') { tip = { y: h * 0.91 * dir, sx: 0.92, sz: 0.90 }; capMul = 0.935; }
  if (broken) { tip = { y: h * 0.92 * dir, sx: 0.96, sz: 0.92 }; capMul = 0.93; }
  rings.push(tip);
  const capY = h * capMul * dir;
  const sq = def.kind === 'molar' ? 3.0 : 2.2;
  const TIP = rings.length - 1;
  const pos = [], uv = [], idx = [];
  rings.forEach((ring, ri) => {
    for (let r = 0; r < R; r++) {
      const a = (r / R) * TAU + (ri === TIP && broken ? Math.sin(r * 9.7) * 0.3 : 0);
      const cs = Math.cos(a), sn = Math.sin(a);
      const px = (def.w / 2) * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / sq) * ring.sx;
      const pz = (def.d / 2) * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / sq) * ring.sz;
      let py = ring.y;
      if (ri === TIP && def.kind === 'molar' && !broken) py += (r % 2 ? -0.0011 : 0.0004) * dir;
      if (ri === TIP && broken) py += Math.sin(r * 13.3) * 0.0022 * dir;
      pos.push(px, py, pz);
      uv.push(r / R, ri / TIP);
    }
  });
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let r = 0; r < R; r++) {
      const r2 = (r + 1) % R;
      const a = ri * R + r, b = ri * R + r2, c = (ri + 1) * R + r, d = (ri + 1) * R + r2;
      if (upper) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const cap = pos.length / 3;
  pos.push(0, capY, 0); uv.push(0.5, 1);
  const last = TIP * R;
  for (let r = 0; r < R; r++) {
    const r2 = (r + 1) % R;
    if (upper) idx.push(cap, last + r, last + r2); else idx.push(cap, last + r2, last + r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// front to back: 2 incisors, canine, 2 premolars, 2 molars, at real widths.
// The arch they sit on is ~55mm of curve per side and far narrower than the
// cheekbones — that is most of why earlier rows read as a grin, not as teeth.
const TOOTH_DEFS = [
  { kind: 'incisor', w: 0.0084, d: 0.0066, h: 0.0106 },
  { kind: 'incisor', w: 0.0066, d: 0.0060, h: 0.0096 },
  { kind: 'canine', w: 0.0074, d: 0.0074, h: 0.0114 },
  { kind: 'premolar', w: 0.0067, d: 0.0082, h: 0.0092 },
  { kind: 'premolar', w: 0.0065, d: 0.0084, h: 0.0089 },
  { kind: 'molar', w: 0.0097, d: 0.0101, h: 0.0083 },
  { kind: 'molar', w: 0.0090, d: 0.0098, h: 0.0079 },
];

function placeTeeth({ curve, parent, upper, mat, matStain, missing, broken, recede, add }) {
  const N = 200;
  const sp = curve.getSpacedPoints(N);
  const lens = [0];
  for (let i = 1; i <= N; i++) lens.push(lens[i - 1] + sp[i].distanceTo(sp[i - 1]));
  const total = lens[N];
  const at = (s) => {
    const target = clamp(s, 0, total);
    let i = 1;
    while (i < N && lens[i] < target) i++;
    const t = (target - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    return {
      p: sp[i - 1].clone().lerp(sp[i], t),
      tan: sp[Math.min(i + 1, N)].clone().sub(sp[Math.max(i - 2, 0)]).normalize(),
    };
  };
  const mid = total / 2;
  for (const side of [-1, 1]) {
    let cursor = 0.0006;
    TOOTH_DEFS.forEach((def, i) => {
      const w = def.w * (upper ? 1 : 0.93);
      const s = mid + side * (cursor + w / 2);
      cursor += w + 0.0005 + 0.0003 * Math.sin(i * 7.7 + side * 2.2);
      const key = `${side}:${i}`;
      if (missing === key) return;
      const isBroken = broken === key;
      const { p, tan } = at(s);
      const out = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
      if (out.z < 0) out.multiplyScalar(-1);
      const geo = paintBone(toothGeo({ ...def, w, h: def.h * (upper ? 1 : 0.94) }, upper, isBroken),
        { ao: def.kind === 'molar' ? 0.24 : 0.08 });
      const mesh = new THREE.Mesh(geo, (def.kind === 'molar' && side < 0) ? matStain : mat);
      mesh.position.copy(p);
      if (recede === key) mesh.position.y += upper ? 0.0028 : -0.0028;
      mesh.rotation.y = Math.atan2(out.x, out.z) + 0.035 * Math.sin(i * 5.1 + side * 3.7);
      mesh.rotation.z = 0.030 * Math.sin(i * 3.3 + side * 1.9);
      mesh.rotation.x = 0.026 * Math.sin(i * 2.1 + side);
      add(mesh, parent);
    });
  }
}

// ==================================================================== build
export function buildSkullMesh(boneMaterial) {
  const root = new THREE.Group();
  root.name = 'skull';
  const body = new THREE.Group();
  body.scale.setScalar(WEAR);
  root.add(body);

  const mk = (tint, rough, opts = {}) => {
    const m = boneMaterial.clone();
    m.color = new THREE.Color(tint);
    if (rough != null) m.roughness = rough;
    Object.assign(m, opts);
    return m;
  };
  // darker and rougher than the game's wall bone: a lit skull held at arm's
  // length blows straight to white otherwise, and white plastic is the whole
  // failure mode we are climbing out of
  // Much darker and rougher than the game's wall bone. The held skull sits
  // inside a strong viewmodel light: at wall-bone albedo it clips to white and
  // white plastic is the entire failure mode we are climbing out of. Dry buried
  // bone is a mid-value surface, not a bright one.
  const boneVC = mk(0x746d5e, 0.86, { vertexColors: true, bumpScale: 0.55 });
  // teeth barely above bone, never a bright keyboard in the middle of the face
  const enamel = mk(0x7f7867, 0.48, { vertexColors: true, bumpScale: 0.06 });
  const enamelStain = mk(0x6a6353, 0.60, { vertexColors: true, bumpScale: 0.07 });
  const muscle = mk(0x7d2a22, 0.44, { side: THREE.DoubleSide });
  const muscle2 = mk(0x963c2c, 0.52, { side: THREE.DoubleSide });
  const skin = mk(0xa88a74, 0.64, { side: THREE.DoubleSide });
  const skinPale = mk(0xbc9c85, 0.60, { side: THREE.DoubleSide });
  const hair = mk(0x241f1b, 0.97, { side: THREE.DoubleSide });
  // A pale ball in a black socket is a googly eye no matter how small it is.
  // What belongs in a half-grown socket is something DARK and wet that catches
  // one hard highlight — you find it by the glint, not by the white.
  const sclera = mk(0x3d3b33, 0.16);
  const iris = mk(0x141712, 0.20);
  const lip = mk(0x84544a, 0.54, { side: THREE.DoubleSide });
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x010101, side: THREE.DoubleSide });

  const stageSets = [[], [], [], [], [], []];
  const add = (mesh, parent, stage = 0) => {
    (parent || body).add(mesh);
    mesh.visible = stage === 0;
    stageSets[stage].push(mesh);
    return mesh;
  };
  const M = (geo, mat, parent, stage = 0) => add(new THREE.Mesh(geo, mat), parent, stage);

  // ------------------------------------------------------------- the shell
  // ring density is biased toward the face: the parametrisation spends its
  // triangles where the orbits, nose and tooth line are, not on the dome
  const U = 54, V = 38;
  const phiOf = (() => {
    const S = 400, cdf = new Array(S + 1);
    const dens = (i) => { const phi = (i / S) * Math.PI; return 1 + 1.55 * bell(phi - 1.88, 0.46) + 0.55 * bell(phi - 1.25, 0.34); };
    cdf[0] = 0;
    for (let i = 1; i <= S; i++) cdf[i] = cdf[i - 1] + (dens(i) + dens(i - 1)) * 0.5;
    const tot = cdf[S];
    return (t) => {
      const target = clamp(t, 0, 1) * tot;
      let i = 1;
      while (i < S && cdf[i] < target) i++;
      const f = (target - cdf[i - 1]) / Math.max(1e-9, cdf[i] - cdf[i - 1]);
      return ((i - 1 + f) / S) * Math.PI;
    };
  })();

  const pos = [], nrm = [], uvs = [], col = [], idx = [];
  const P = new THREE.Vector3(), Pu = new THREE.Vector3(), Pv = new THREE.Vector3();
  const Tu = new THREE.Vector3(), Tv = new THREE.Vector3(), Nv = new THREE.Vector3();
  const D = new THREE.Vector3(), D2 = new THREE.Vector3();
  const dOf = (u, v, out) => {
    const phi = phiOf(v), th = u * TAU, sp = Math.sin(phi);
    return out.set(sp * Math.sin(th), Math.cos(phi), sp * Math.cos(th));
  };
  for (let j = 0; j <= V; j++) {
    for (let i = 0; i <= U; i++) {
      const u = i / U, v = j / V;
      dOf(u, v, D);
      const r = shellRadius(D.x, D.y, D.z);
      P.set(D.x * r, D.y * r, D.z * r);
      // finite-difference normals across the field: seamless at the u wrap and
      // still crisp at every carved margin
      const h = 0.45 / U, hv = 0.45 / V;
      dOf(u + h, v, D2); shellPoint(D2.x, D2.y, D2.z, Pu);
      dOf(u - h, v, D2); shellPoint(D2.x, D2.y, D2.z, Tu); Pu.sub(Tu);
      dOf(u, clamp(v + hv, 0, 1), D2); shellPoint(D2.x, D2.y, D2.z, Pv);
      dOf(u, clamp(v - hv, 0, 1), D2); shellPoint(D2.x, D2.y, D2.z, Tv); Pv.sub(Tv);
      Nv.crossVectors(Pv, Pu).normalize();
      if (Nv.dot(D) < 0) Nv.negate();
      if (!isFinite(Nv.x) || Nv.lengthSq() < 0.5) Nv.copy(D);

      const ao = shellAO(D.x, D.y, D.z, r, 0.055);
      const sut = sutureMask(D.x, D.y, D.z);
      // blotching at two scales: broad patches where it lay against the earth,
      // then fine mottle. Value only — the colourblind law makes brightness the
      // only channel that is allowed to carry a read.
      let val = 1 - 0.22 * mottle(P.x, P.y, P.z);
      val *= 1 - 0.34 * clamp(0.5 + 0.9 * Math.sin(13 * P.x + 9 * P.y - 11 * P.z + 0.9)
        + 0.6 * Math.sin(19 * P.y + 7 * P.x + 2.4), 0, 1);
      // named stains — the patches where it lay against something for decades.
      // Broad, irregular, and much darker than the surrounding bone; this is the
      // difference between "aged" and "beige".
      for (const [sx, sy, sz, rad, amt] of STAINS) {
        val *= 1 - amt * bell(Math.hypot(P.x - sx, (P.y - sy) * 1.15, (P.z - sz) * 0.9), rad)
          * (0.55 + 0.45 * mottle(P.x * 5, P.y * 5, P.z * 5));
      }
      val *= 1 - 0.82 * ao;                                   // dirt in every crevice
      val *= 1 - 0.60 * sut * (0.5 + 0.5 * mottle(P.x * 3, P.y * 3, P.z * 3));
      val *= 1 - 0.74 * crackMask(D.x, D.y, D.z);             // the splits hold hard shadow
      val *= 1 - 0.36 * ss(-0.028, -0.092, P.y);              // buried-end staining
      val *= 1 - 0.20 * ss(0.020, -0.070, P.z) * ss(0.0, -0.030, P.y);
      // the apertures swallow light across their WHOLE area, not just the deep
      // middle, and hand back over a narrow band at the rim
      const oq = Math.min(orbitQ(D.x, D.y, D.z, -1), orbitQ(D.x, D.y, D.z, 1));
      val *= 1 - 0.96 * (1 - ss(0.78, 1.03, oq));
      val *= 1 - 0.93 * (1 - ss(0.76, 1.03, nasalQ(D.x, D.y, D.z)));
      val = clamp(val, 0.02, 1.1);

      pos.push(P.x, P.y, P.z);
      nrm.push(Nv.x, Nv.y, Nv.z);
      uvs.push(u * 3.6, v * 2.7);
      col.push(val, val * (1 - 0.04 * (1 - val)), val * (1 - 0.10 * (1 - val)));
    }
  }
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < U; i++) {
      const a = j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shellGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  shellGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  shellGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  shellGeo.setIndex(idx);
  M(shellGeo, boneVC);

  // ------------------------------------------------- the zygomatic arches
  // The one thing that must NOT be part of the shell: in a real skull you can
  // see daylight through the gap behind the arch. That gap is the silhouette
  // read that says "skull" from three-quarters, and no amount of shading fakes it.
  for (const s of [-1, 1]) {
    const geo = sweepGeo([
      new THREE.Vector3(s * 0.0560, -0.0250, 0.0380),
      new THREE.Vector3(s * 0.0655, -0.0250, 0.0185),
      new THREE.Vector3(s * 0.0682, -0.0252, -0.0030),
      new THREE.Vector3(s * 0.0630, -0.0268, -0.0230),
      // the far end has to end up INSIDE the temporal bone above the ear canal:
      // an arch that stops in mid-air is the "floating wire" tell
      new THREE.Vector3(s * 0.0480, -0.0290, -0.0330),
    ], () => new THREE.Vector3(s, 0, 0),
      (t) => ({ w: 0.0025 + 0.0004 * Math.sin(t * Math.PI), h: 0.0058 + 0.0020 * Math.sin(t * Math.PI) }), 7);
    M(paintBone(geo, { ao: 0.20 }), boneVC);
  }

  // ---------------------------------------------------- the dark places
  const sockets = [];
  const eyePivot = {};
  for (const s of [-1, 1]) {
    const A = ORBIT[s];
    // the void is laid across 88% of the aperture, in the aperture's own shape.
    // A socket only reads at a glance if the WHOLE hole is black — a lit funnel
    // wall with a dark spot in the middle reads as an eye, which is worse than
    // no socket at all.
    const dd = new THREE.Vector3();
    sockets.push(M(gridGeo(12, 2, (u, v) => {
      orbitDir(u * TAU, v * 0.88, s, dd);
      const r = shellRadius(dd.x, dd.y, dd.z) + 0.0005;
      return [dd.x * r, dd.y * r, dd.z * r];
    }), voidMat));

    // The eye sits DEEP and small — a wet glint far back in a dark socket. A
    // ball that fills the aperture with a flat iris disc and a pupil dot in the
    // middle is a bullseye, and a bullseye in a skull is a googly eye.
    const pivot = new THREE.Group();
    pivot.position.copy(A.o).multiplyScalar(shellRadius(A.o.x, A.o.y, A.o.z) + 0.0124);
    pivot.visible = false;
    body.add(pivot);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0106, 10, 7), sclera);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0078, 12), iris);
    ir.position.z = 0.00715;
    const pu = new THREE.Mesh(new THREE.CircleGeometry(0.0040, 10), new THREE.MeshBasicMaterial({ color: 0x020202 }));
    pu.position.z = 0.00735;
    pivot.add(ball, ir, pu);
    eyePivot[s] = pivot;
  }
  const nd = new THREE.Vector3();
  sockets.push(M(gridGeo(12, 2, (u, v) => {
    nasalDir(u * TAU, v * 0.86, nd);
    const r = shellRadius(nd.x, nd.y, nd.z) + 0.0005;
    return [nd.x * r, nd.y * r, nd.z * r];
  }), voidMat));

  const fm = M(new THREE.CircleGeometry(0.0105, 12), voidMat);
  fm.position.set(0, -0.0462, -0.0215);
  fm.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const ear = M(new THREE.CircleGeometry(0.0038, 10), voidMat);
    ear.position.set(s * 0.0522, -0.0130, -0.0245);
    ear.rotation.y = s * (Math.PI / 2);
    ear.rotation.z = 0.2;
  }

  // ------------------------------------------------------- the upper teeth
  placeTeeth({
    curve: new THREE.CatmullRomCurve3([
      [-0.0272, -0.0592, 0.0280], [-0.0266, -0.0600, 0.0388], [-0.0246, -0.0608, 0.0492],
      [-0.0198, -0.0616, 0.0594], [-0.0112, -0.0621, 0.0664], [0, -0.0624, 0.0688],
      [0.0112, -0.0621, 0.0664], [0.0198, -0.0616, 0.0594], [0.0246, -0.0608, 0.0492],
      [0.0266, -0.0600, 0.0388], [0.0272, -0.0592, 0.0280],
    ].map((p) => new THREE.Vector3(...p))),
    parent: body, upper: true, mat: enamel, matStain: enamelStain,
    missing: '1:1', broken: null, recede: '-1:2', add,
  });

  // ---------------------------------------------------------- the mandible
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  // it hinges at the condyle, level with and just in front of the ear canal —
  // hinging at the chin is what makes a jaw open like a puppet's
  const HINGE = new THREE.Vector3(0, -0.0100, -0.0230);
  jaw.position.copy(HINGE);
  body.add(jaw);
  const jawLocal = (p) => new THREE.Vector3(p[0], p[1], p[2]).sub(HINGE);

  // one path: left condyle -> down the ramus -> round the gonial angle ->
  // along the body -> chin -> and back up the far side, so the jawline has no
  // join anywhere along it
  const jawPath = [
    [-0.0505, -0.0100, -0.0230], [-0.0502, -0.0250, -0.0212], [-0.0496, -0.0400, -0.0186],
    [-0.0486, -0.0560, -0.0146], [-0.0474, -0.0700, -0.0096], [-0.0462, -0.0812, 0.0006],
    [-0.0432, -0.0860, 0.0176], [-0.0378, -0.0902, 0.0374], [-0.0302, -0.0928, 0.0552],
    [-0.0192, -0.0945, 0.0682], [-0.0068, -0.0955, 0.0754], [0.0068, -0.0955, 0.0754],
    [0.0192, -0.0945, 0.0682], [0.0302, -0.0928, 0.0552], [0.0378, -0.0902, 0.0374],
    [0.0432, -0.0860, 0.0176], [0.0462, -0.0812, 0.0006], [0.0474, -0.0700, -0.0096],
    [0.0486, -0.0560, -0.0146], [0.0496, -0.0400, -0.0186], [0.0502, -0.0250, -0.0212],
    [0.0505, -0.0100, -0.0230],
  ].map(jawLocal);
  const jawPts = new THREE.CatmullRomCurve3(jawPath).getPoints(34);
  // w rides the lateral axis, h the one perpendicular: at the ramus that makes
  // a thin plate standing tall front-to-back, and along the body a rounded bar
  // standing tall vertically — one section rule, two bones' worth of silhouette
  const jawSec = (t) => {
    const m = 1 - Math.abs(t - 0.5) * 2;             // 0 at the condyles, 1 at the chin
    const chin = bell(t - 0.5, 0.085);
    const taper = 0.52 + 0.48 * ss(0, 0.09, m);      // the condyle neck is slender
    return {
      w: lerp(0.0036, 0.0056, ss(0.06, 0.44, m)) * (1 + 0.28 * chin) * taper,
      h: lerp(0.0140, 0.0112, ss(0.06, 0.40, m)) * (1 + 0.26 * chin) * taper,
    };
  };
  const jawOut = (t, p) => {
    const m = 1 - Math.abs(t - 0.5) * 2;
    const ramus = 1 - ss(0.10, 0.34, m);
    const o = new THREE.Vector3(p.x, 0, p.z - 0.028).normalize();
    return o.lerp(new THREE.Vector3(Math.sign(p.x || 1), 0, 0), ramus).normalize();
  };
  M(paintBone(sweepGeo(jawPts, jawOut, jawSec, 8), { ao: 0.10 }), boneVC, jaw);

  for (const s of [-1, 1]) {
    // coronoid process — the blade that disappears behind the zygomatic arch
    M(paintBone(sweepGeo([
      jawLocal([s * 0.0466, -0.0520, 0.0060]),
      jawLocal([s * 0.0450, -0.0330, 0.0080]),
      jawLocal([s * 0.0434, -0.0160, 0.0100]),
    ], () => new THREE.Vector3(s, 0, 0), (t) => ({ w: 0.0029 - t * 0.0012, h: 0.0090 - t * 0.0054 }), 6),
      { ao: 0.26 }), boneVC, jaw);
    // the condyle: the hinge knob, sitting on the axis it turns about
    const cond = M(paintBone(new THREE.SphereGeometry(1, 8, 6).scale(0.0092, 0.0056, 0.0074), { ao: 0.12 }), boneVC, jaw);
    cond.position.copy(jawLocal([s * 0.0505, -0.0095, -0.0230]));
    cond.rotation.z = s * 0.25;
    // mental foramen — a real mandible has a hole here, and it holds shadow
    const mf = M(new THREE.CircleGeometry(0.0016, 8), voidMat, jaw);
    mf.position.copy(jawLocal([s * 0.0224, -0.0862, 0.0678]));
    mf.rotation.y = s * 0.55;
  }

  // the dark of the throat behind the tooth rows
  M(gridGeo(8, 2, (u, v) => {
    const a = lerp(-1.05, 1.05, u);
    return [Math.sin(a) * 0.024, lerp(-0.0640, -0.0880, v), 0.022 + Math.cos(a) * 0.008];
  }), voidMat);

  // lower arch: narrower than the upper and set a little behind it, so the
  // rows occlude instead of meeting edge to edge
  placeTeeth({
    curve: new THREE.CatmullRomCurve3([
      [-0.0248, -0.0796, 0.0268], [-0.0242, -0.0800, 0.0364], [-0.0224, -0.0804, 0.0458],
      [-0.0180, -0.0808, 0.0548], [-0.0102, -0.0811, 0.0608], [0, -0.0813, 0.0628],
      [0.0102, -0.0811, 0.0608], [0.0180, -0.0808, 0.0548], [0.0224, -0.0804, 0.0458],
      [0.0242, -0.0800, 0.0364], [0.0248, -0.0796, 0.0268],
    ].map(jawLocal)),
    parent: jaw, upper: false, mat: enamel, matStain: enamelStain,
    missing: null, broken: '-1:2', recede: '1:4', add,
  });

  const jawMount = new THREE.Object3D();     // carried keys clamp in the teeth
  jawMount.position.copy(jawLocal([0, -0.0770, 0.0780]));
  jaw.add(jawMount);

  // ========================================================= growth stages
  // It grows a face stage by stage. Everything here rides the same shell field,
  // so skin and muscle shrink-wrap the bone instead of floating over it.
  // Every soft-tissue patch is shrink-wrapped to the shell field AND its rim
  // lands exactly on the bone, tucking a hair under it. A patch whose border
  // floats above the surface shows a free silhouette edge, which is what turned
  // the growth stages into hexagonal plates stuck on a skull.
  const patch = (centreDir, angR, { offset = 0.0018, wobble = 0.24, seed = 1, uSeg = 9, vSeg = 4 }) => {
    const c = new THREE.Vector3(...centreDir).normalize();
    const t1 = new THREE.Vector3(0, 1, 0).cross(c);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    const t2 = new THREE.Vector3().crossVectors(c, t1);
    const d = new THREE.Vector3(), o = new THREE.Vector3();
    return gridGeo(uSeg, vSeg, (u, v) => {
      const a = u * TAU;
      const wob = 1 + wobble * Math.sin(a * 3 + seed * 2.1) + wobble * 0.6 * Math.sin(a * 7 - seed * 1.3)
        + wobble * 0.35 * Math.sin(a * 13 + seed * 0.7);
      const rr = v * angR * wob;
      d.copy(c).multiplyScalar(Math.cos(rr))
        .addScaledVector(t1, Math.sin(rr) * Math.cos(a))
        .addScaledVector(t2, Math.sin(rr) * Math.sin(a)).normalize();
      shellPoint(d.x, d.y, d.z, o)
        .addScaledVector(d, offset * (1 - v * v) - 0.0004 * ss(0.72, 1.0, v));
      return [o.x, o.y, o.z];
    });
  };
  const cap = (w, h, bulge, { wobble = 0.18, seed = 1, uSeg = 8, vSeg = 3 } = {}) =>
    gridGeo(uSeg, vSeg, (u, v) => {
      const a = u * TAU;
      const wob = 1 + wobble * Math.sin(a * 3 + seed * 1.9) + wobble * 0.5 * Math.sin(a * 5 + seed);
      const rr = v * wob;
      return [Math.cos(a) * w * rr, Math.sin(a) * h * rr, bulge * (1 - rr * rr)];
    });

  // stage 1 — muscle finds its anchors first, the way a body rebuilds
  M(patch([-0.88, 0.14, 0.32], 0.44, { seed: 31, uSeg: 8 }), muscle, body, 1);
  M(patch([0.89, 0.12, 0.28], 0.40, { seed: 37, uSeg: 8 }), muscle2, body, 1);
  for (const s of [-1, 1]) {
    M(sweepGeo([
      jawLocal([s * 0.0540, -0.0140, 0.0200]),
      jawLocal([s * 0.0516, -0.0440, 0.0130]),
      jawLocal([s * 0.0462, -0.0770, 0.0030]),
    ], () => new THREE.Vector3(s, 0, 0), (t) => ({ w: 0.0034, h: 0.0072 + 0.0042 * Math.sin(t * Math.PI) }), 5),
      s < 0 ? muscle : muscle2, jaw, 1);
  }
  M(patch([-0.22, 0.62, 0.75], 0.32, { offset: 0.0022, wobble: 0.3, seed: 5, uSeg: 8, vSeg: 3 }), muscle2, body, 1);

  // stage 2 — skin creeps in from the edges; the first eye arrives
  M(patch([-0.54, 0.70, 0.40], 0.48, { offset: 0.0022, seed: 41 }), skin, body, 2);
  M(patch([-0.62, -0.26, 0.74], 0.30, { offset: 0.0026, seed: 8, uSeg: 8, vSeg: 3 }), skin, body, 2);
  M(patch([0.86, 0.40, 0.10], 0.32, { offset: 0.0024, seed: 43, uSeg: 8 }), skinPale, body, 2);
  const eyeL = eyePivot[-1];

  // stage 3 — the second eye; more face than not
  M(patch([0.52, 0.68, 0.42], 0.46, { offset: 0.0022, seed: 47 }), skinPale, body, 3);
  M(patch([0.62, -0.26, 0.74], 0.30, { offset: 0.0026, seed: 9, uSeg: 8, vSeg: 3 }), skin, body, 3);
  M(patch([0.02, -0.56, 0.83], 0.19, { offset: 0.0022, seed: 10, uSeg: 7, vSeg: 3 }), skin, body, 3);
  const jawSkin = M(cap(0.017, 0.024, 0.005, { seed: 11 }), skinPale, jaw, 3);
  jawSkin.position.copy(jawLocal([-0.0468, -0.0790, 0.0170]));
  jawSkin.rotation.y = -1.15;
  const eyeR = eyePivot[1];

  // stage 4 — hair and a nose: it is becoming someone
  M(patch([0.02, 0.94, -0.28], 1.08, { offset: 0.0026, wobble: 0.2, seed: 53, uSeg: 10, vSeg: 4 }), hair, body, 4);
  for (const lock of [
    [[-0.048, 0.062, -0.052], [-0.064, 0.024, -0.062], [-0.068, -0.014, -0.056]],
    [[0.046, 0.064, -0.049], [0.062, 0.026, -0.058], [0.064, -0.013, -0.054]],
    [[-0.009, 0.054, -0.088], [-0.013, 0.011, -0.098], [-0.011, -0.026, -0.092]],
  ]) {
    M(sweepGeo(lock.map((p) => new THREE.Vector3(...p)), () => new THREE.Vector3(0, 1, 0),
      (t) => ({ w: 0.0018 * (1 - t * 0.5), h: 0.0018 * (1 - t * 0.5) }), 4), hair, body, 4);
  }
  // The nose has to have SIDES. A flat plate spanning the nasal aperture hangs
  // 30mm in front of a pit that has been carved 30mm back, and reads as a blade
  // stuck to the face. This is a ridge whose flanks curve back and land on the
  // maxilla either side of the aperture.
  M(gridGeo(8, 4, (u, v) => {
    const a = lerp(-1.86, 1.86, u);                 // past ±90° so the flanks tuck in
    const halfW = lerp(0.0078, 0.0182, v);
    const y = lerp(0.0140, -0.0450, v);
    const depth = lerp(0.0060, 0.0125, v);
    const zFront = lerp(0.0845, 0.0960, v);
    return [Math.sin(a) * halfW, y, zFront - (1 - Math.cos(a)) * depth];
  }), skinPale, body, 4);
  const tip = M(new THREE.SphereGeometry(1, 9, 6).scale(0.0132, 0.0106, 0.0118), skinPale, body, 4);
  tip.position.set(0.0005, -0.0420, 0.0920);
  for (const s of [-1, 1]) {
    const ala = M(new THREE.SphereGeometry(1, 8, 5).scale(0.0070, 0.0058, 0.0080), skin, body, 4);
    ala.position.set(s * 0.0098, -0.0452, 0.0862);
    const nos = M(new THREE.CircleGeometry(0.0021, 8), voidMat, body, 4);
    nos.position.set(s * 0.0052, -0.0498, 0.0886);
    nos.rotation.x = -1.05;
  }

  // stage 5 — a whole face, laid over the whole skull
  const faceGeo = (() => {
    const g = new THREE.SphereGeometry(1, 20, 13);
    const p = g.getAttribute('position');
    const d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize();
      // Skin does not fall into the sockets — it stretches across them. But it
      // must also sit OUTSIDE every ridge the bone adds on top of the union
      // (the orbital margin, the brow, the temporal line), or those poke
      // through the face and the sockets read straight back out of it.
      const r0 = Math.max(unionRadius(d.x, d.y, d.z), shellRadius(d.x, d.y, d.z)) + 0.0016;
      let x = d.x * r0, y = d.y * r0, z = d.z * r0;
      z += 0.0058 * bell(Math.abs(x) - 0.043, 0.018) * bell(y + 0.017, 0.022) * ss(0.01, 0.05, z);
      x += Math.sign(x) * 0.0058 * ss(0.045, 0.062, Math.abs(x)) * band(y, -0.03, 0, 0.035, 0.055);
      for (const s of [-1, 1]) {
        const dd = Math.hypot(x - s * 0.0335, y - 0.0015);
        z -= 0.0150 * bell(dd, 0.0104) * ss(0.02, 0.05, z);   // the eyes look out
      }
      if (y < -0.052 && z > 0.020) {                          // the mouth line
        const over = -0.052 - y;
        y = -0.052 - over * 0.20;
        z = Math.min(z, 0.0760 - over * 0.5);
      }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  })();
  M(faceGeo, skin, body, 5);
  M(sweepGeo(jawPts, jawOut, (t) => {
    const m = 1 - Math.abs(t - 0.5) * 2;
    return { w: 0.0086 + 0.0038 * ss(0.1, 0.6, m), h: 0.0148 + 0.0044 * ss(0.1, 0.6, m) };
  }, 6), skin, jaw, 5);
  for (const s of [-1, 1]) {
    const ear = M(cap(0.011, 0.019, 0.005, { seed: 17 + s, wobble: 0.18 }), skinPale, body, 5);
    ear.position.set(s * 0.0620, -0.0130, -0.0245);
    ear.rotation.y = s * (Math.PI / 2 - 0.15);
    // no lid ring: the face shell already dimples an opening here, and a
    // second ring on top of it reads as concentric circles drawn on the face
  }
  M(sweepGeo([
    new THREE.Vector3(-0.0248, -0.0680, 0.0560),
    new THREE.Vector3(-0.0094, -0.0656, 0.0716),
    new THREE.Vector3(0, -0.0664, 0.0734),
    new THREE.Vector3(0.0094, -0.0656, 0.0716),
    new THREE.Vector3(0.0248, -0.0680, 0.0560),
  ], () => new THREE.Vector3(0, 0, 1), (t) => ({ w: 0.0032, h: 0.0044 * Math.sin(clamp(t, 0.06, 0.94) * Math.PI) + 0.0013 }), 5), lip, body, 5);
  M(sweepGeo([
    jawLocal([-0.0238, -0.0760, 0.0600]),
    jawLocal([0, -0.0738, 0.0748]),
    jawLocal([0.0238, -0.0760, 0.0600]),
  ], () => new THREE.Vector3(0, 0, 1), (t) => ({ w: 0.0034, h: 0.0058 * Math.sin(clamp(t, 0.06, 0.94) * Math.PI) + 0.0013 }), 5), lip, jaw, 5);

  return { root, jaw, jawMount, sockets, eyeL, eyeR, stageSets };
}

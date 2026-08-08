// skull-variant-c.js — THE FAMILIAR — round-3 sculpt-off winner (mean 8.0/10;
// judges: "devastating locked-on eye contact", cleanest near-black read).
// Claude sculpt-off 2026-08-08; mounted as ?skull=c for Alex to judge in-game.
//
// Design: an appeal-forward companion skull the player will love and grieve.
// Oversized cranium (baby-schema dome), two BIG deep socket voids tilted up
// toward the viewer for devastating eye contact, a narrow tapered snout, and
// an expressive underbit jaw with a proud upturned chin — it always looks
// like it is listening (a ~3 degree head-cock is baked in under root, so the
// game's per-frame lookAt never undoes it).
//
// And it is kept WRONG, quietly: eleven crowded lower teeth (count them),
// two of them overlapping, one snaggle tooth hooked over the lip line; a
// hairline fracture meandering from the crown down into the right socket rim;
// a chipped bite out of the left rim; one socket larger than the other; and,
// once the eyes arrive, mismatched pupils. Identity lives in silhouette and
// value (pale dome / black voids / dark crack) — never in hue alone.
//
// Contract: buildSkullMesh(boneMaterial) -> { root, jaw, jawMount, sockets,
// eyeL, eyeR, stageSets }. Face +Z. All materials derived from boneMaterial
// via .clone() (MeshBasicMaterial black only for socket-class voids).
import * as THREE from 'three';

const TAU = Math.PI * 2;

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// deterministic per-index jitter, -1..1
function jit(i, salt) {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

export function buildSkullMesh(boneMaterial) {
  if (!boneMaterial || !boneMaterial.isMaterial) {
    throw new TypeError('buildSkullMesh(boneMaterial) requires a THREE.Material');
  }

  const root = new THREE.Group();
  root.name = 'skull-familiar';

  // the listening tilt — baked INSIDE root so lookAt keeps it forever
  const head = new THREE.Group();
  head.name = 'head';
  head.rotation.z = 0.03;
  root.add(head);

  // ---------------------------------------------------------- materials
  // every lit material is a clone of the game bone (keeps its aged-ivory
  // canvas map + bump, so growth stages inherit the same worn surface)
  const tint = (hex, o = {}) => {
    const m = boneMaterial.clone();
    m.color.set(hex);
    Object.assign(m, o);
    return m;
  };
  const bone = boneMaterial;
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });          // socket voids
  const crackMat = tint(0x241a12, { roughness: 0.92, side: THREE.DoubleSide });
  const muscleMat = tint(0x8a4034, { roughness: 0.8 });
  const muscle2Mat = tint(0x6d3230, { roughness: 0.85 });
  const skinMat = tint(0xb08e79, { roughness: 0.75, side: THREE.DoubleSide });
  const skin2Mat = tint(0x99705f, { roughness: 0.8 });
  const lipMat = tint(0x6d3c36, { roughness: 0.7 });
  const hairMat = tint(0x211c17, { roughness: 0.95 });
  const scarMat = tint(0x76544a, { roughness: 0.82, side: THREE.DoubleSide });
  const shadowMat = tint(0x241a14, { roughness: 0.95 });
  const scleraMat = tint(0xd8d1c1, { roughness: 0.28 });
  scleraMat.map = null; scleraMat.bumpMap = null;
  const irisMat = tint(0x4a453a, { roughness: 0.45 });
  irisMat.map = null; irisMat.bumpMap = null;
  const pupilMat = tint(0x0b0a09, { roughness: 0.35 });
  pupilMat.map = null; pupilMat.bumpMap = null;

  // ---------------------------------------------------------- stage plumbing
  const stageSets = [[], [], [], [], [], []];
  function register(obj, stage) {
    if (stage > 0) {
      obj.visible = false;
      stageSets[stage].push(obj);
    }
    return obj;
  }

  // ---------------------------------------------------------- geo helpers
  const sphereCache = new Map();
  const sphereGeo = (w, h) => {
    const k = w + 'x' + h;
    if (!sphereCache.has(k)) sphereCache.set(k, new THREE.SphereGeometry(1, w, h));
    return sphereCache.get(k);
  };
  const icoGeo = new THREE.IcosahedronGeometry(0.03, 1);

  function ell(parent, mat, p, s, r = [0, 0, 0], segs = [10, 7], stage = 0) {
    const m = new THREE.Mesh(sphereGeo(segs[0], segs[1]), mat);
    m.position.set(p[0], p[1], p[2]);
    m.scale.set(s[0], s[1], s[2]);
    m.rotation.set(r[0], r[1], r[2]);
    parent.add(m);
    return register(m, stage);
  }

  // flat organic patch hugging the surface (flattened along local z which we
  // aim at the skull center — no lookAt: world matrices aren't live yet)
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  function patch(parent, mat, p, sc, stage, sq = 0.26) {
    const m = new THREE.Mesh(icoGeo, mat);
    m.position.set(p[0], p[1], p[2]);
    const toCenter = new THREE.Vector3(-p[0], -p[1], -p[2]).normalize();
    m.quaternion.setFromUnitVectors(Z_AXIS, toCenter);
    m.scale.set(sc, sc, sc * sq);
    parent.add(m);
    return register(m, stage);
  }

  // ------------------------------------------------- the cranium (shared fn)
  // one surface function drives the bone dome, the stage-5 skin shell AND the
  // crack/scar ribbons, so damage sits exactly on the surface.
  const norm3 = ([x, y, z, a, k]) => {
    const l = Math.hypot(x, y, z);
    return { x: x / l, y: y / l, z: z / l, a, k };
  };
  const BUMPS = [
    [0.00, 0.55, 0.835, 0.0110, 7],    // forehead dome — oversized brow bulge
    [0.00, 0.26, 0.97, 0.0085, 20],    // supraorbital ledge (the profile step)
    [0.00, -0.08, 1.00, -0.0080, 7],   // face plane — flattened so the brow
                                       // overhangs and the features stand proud
    [0.00, -0.05, -0.998, 0.0065, 8],  // occiput
    [-0.78, 0.57, -0.25, 0.0080, 9],   // parietal boss L — the bigger one
    [0.78, 0.57, -0.25, 0.0042, 9],    // parietal boss R (asymmetry)
    [-0.985, 0.05, 0.17, -0.0060, 10], // temple pinch L
    [0.985, 0.05, 0.17, -0.0060, 10],  // temple pinch R
    // the socket dishes — carved into the BONE so the voids sit in real
    // depressions and the rims stand proud, instead of the dome swallowing them
    [-0.0355, -0.006, 0.080, -0.0135, 30],
    [0.0355, -0.006, 0.080, -0.0135, 30],
  ].map(norm3);
  const EYE_HOLES = [
    [-0.0355, -0.006, 0.080, 0.017, 55],
    [0.0355, -0.006, 0.080, 0.017, 55],
  ].map(norm3);

  function surfPoint(d, out, offset = 0, holes = false) {
    let r = 0.091;
    for (const b of BUMPS) {
      const dot = d.x * b.x + d.y * b.y + d.z * b.z;
      r += b.a * Math.exp((dot - 1) * b.k);
    }
    // the lower face recedes hard — the snout/teeth/chin break the silhouette
    const lowFront = smooth(0.10, 0.70, -d.y) * smooth(0.05, 0.55, d.z);
    r *= 1 - 0.24 * lowFront;
    r += offset;
    if (holes) {
      for (const h of EYE_HOLES) {
        const dot = d.x * h.x + d.y * h.y + d.z * h.z;
        r -= h.a * Math.exp((dot - 1) * h.k);
      }
    }
    out.set(d.x * r * 1.03, d.y * r * 0.96, d.z * r);
    return out;
  }

  function craniumGeometry(offset, holes) {
    const g = new THREE.SphereGeometry(1, 22, 16);
    const pos = g.getAttribute('position');
    const v = new THREE.Vector3(), o = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      surfPoint(v, o, offset, holes);
      pos.setXYZ(i, o.x, o.y, o.z);
    }
    g.computeVertexNormals();
    // weld normals across the sphere's duplicated UV-seam/pole vertices —
    // otherwise a hard vertical shading line splits the dome in profile
    const n = g.getAttribute('normal');
    const groups = new Map();
    for (let i = 0; i < pos.count; i++) {
      const k = pos.getX(i).toFixed(5) + ',' + pos.getY(i).toFixed(5) + ',' + pos.getZ(i).toFixed(5);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    }
    for (const idxs of groups.values()) {
      if (idxs.length < 2) continue;
      let sx = 0, sy = 0, sz = 0;
      for (const i of idxs) { sx += n.getX(i); sy += n.getY(i); sz += n.getZ(i); }
      const l = Math.hypot(sx, sy, sz) || 1;
      for (const i of idxs) n.setXYZ(i, sx / l, sy / l, sz / l);
    }
    n.needsUpdate = true;
    return g;
  }

  const cranium = new THREE.Mesh(craniumGeometry(0, false), bone);
  cranium.name = 'cranium';
  head.add(cranium);

  // ------------------------------------------------- crack + scar ribbons
  function ribbonGeo(dirList, w0, w1, offset) {
    const dirs = dirList.map((d) => new THREE.Vector3(d[0], d[1], d[2]).normalize());
    const pts = dirs.map((d) => surfPoint(d, new THREE.Vector3(), offset, false));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const n = p.clone().normalize();
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      const t = next.clone().sub(prev).normalize();
      const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) * 0.5;
      const s = t.cross(n).normalize().multiplyScalar(w);
      pos.push(p.x + s.x, p.y + s.y, p.z + s.z, p.x - s.x, p.y - s.y, p.z - s.z);
      uv.push(i / (pts.length - 1), 0, i / (pts.length - 1), 1);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // hairline fracture: crown -> zigzag down the right side -> right socket rim
  const CRACK_PATH = [
    [0.10, 0.97, 0.16], [0.24, 0.88, 0.28], [0.20, 0.76, 0.42],
    [0.33, 0.64, 0.50], [0.27, 0.50, 0.63], [0.38, 0.36, 0.72],
    [0.33, 0.22, 0.80], [0.42, 0.12, 0.83],
  ];
  const crack = new THREE.Mesh(ribbonGeo(CRACK_PATH, 0.0024, 0.0009, 0.0009), crackMat);
  crack.name = 'crack';
  head.add(crack);
  const crackBranch = new THREE.Mesh(ribbonGeo(
    [[0.27, 0.50, 0.63], [0.17, 0.43, 0.74], [0.13, 0.33, 0.82]],
    0.0013, 0.0006, 0.0009), crackMat);
  head.add(crackBranch);

  // ------------------------------------------------- sockets: the two voids
  // big, deep, tilted UP toward the held camera. Left one runs larger.
  const sockets = [];
  const rimGeoL = new THREE.TorusGeometry(0.021, 0.0042, 8, 14);
  const rimGeoR = new THREE.TorusGeometry(0.0196, 0.0042, 8, 14);
  for (const side of [-1, 1]) {
    const big = side < 0 ? 1.08 : 1.0;
    const rim = new THREE.Mesh(side < 0 ? rimGeoL : rimGeoR, bone);
    rim.position.set(side * 0.0355, -0.006, 0.0805);
    rim.rotation.set(-0.10, 0, 0);
    rim.scale.set(1, 1.08, 0.72);
    head.add(rim);

    const v = ell(head, voidMat,
      [side * 0.0355, -0.006, 0.076],
      [0.019 * big, 0.0218 * big, 0.011],
      [-0.10, 0, 0], [10, 7]);
    v.name = side < 0 ? 'socketL' : 'socketR';
    sockets.push(v);

    // supraorbital swell — outer end raised a touch: alert, never droopy
    ell(head, bone,
      [side * 0.043, 0.020, 0.074],
      [0.016, 0.005, 0.0075],
      [-0.3, 0, side * 0.10], [8, 5]);
  }

  // the chip: a bite taken out of the big left rim, lower-outer edge —
  // placed ON the rim ring so it reads as missing bone, not a floating mote
  const chip = ell(head, crackMat,
    [-0.0355 - 0.0172, -0.006 - 0.0131, 0.081], [0.0045, 0.0038, 0.0045],
    [-0.2, -0.3, 0.4], [6, 4]);
  chip.name = 'rimChip';

  // ------------------------------------------------- nose + snout + cheeks
  ell(head, voidMat, [0, -0.036, 0.076], [0.0092, 0.0125, 0.007], [-0.1, 0, 0], [8, 5])
    .name = 'nasalVoid';
  ell(head, bone, [0, -0.049, 0.061], [0.029, 0.019, 0.022], [0, 0, 0], [12, 8])
    .name = 'maxilla';
  for (const side of [-1, 1]) {
    ell(head, bone, [side * 0.053, -0.022, 0.056], [0.014, 0.012, 0.016],
      [0, side * -0.35, 0], [8, 6]);
  }

  // dark backplate behind the tooth rows so the bite reads as a mouth
  ell(head, shadowMat, [0, -0.0635, 0.050], [0.027, 0.012, 0.010], [0, 0, 0], [8, 5])
    .name = 'mouthShadow';

  // ------------------------------------------------- teeth
  // uppers: eight modest teeth, one chipped short (history)
  for (let i = 0; i < 8; i++) {
    const a = (i / 7 - 0.5) * 1.84;
    const chipped = i === 5;
    const h = chipped ? 0.0068 : 0.0125 + jit(i, 1) * 0.0006;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0024, h, 5), bone);
    t.position.set(Math.sin(a) * 0.0272, -0.0585 - h / 2, 0.056 + Math.cos(a) * 0.026);
    t.rotation.y = a;
    t.rotation.z = (chipped ? 0.35 : 0) + jit(i, 2) * 0.05;
    head.add(t);
  }

  // ------------------------------------------------- the jaw (radar, co-star)
  // pivot sits at condyle height; +x rotation swings it down-and-back.
  const JAW_PIVOT = [0, -0.016, -0.006];
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(JAW_PIVOT[0], JAW_PIVOT[1], JAW_PIVOT[2]);
  head.add(jaw);
  const rel = (x, y, z) => [x - JAW_PIVOT[0], y - JAW_PIVOT[1], z - JAW_PIVOT[2]];

  // mandible body: horseshoe swinging forward to a proud, slightly off-center chin
  const bodyPts = [
    [-0.047, -0.050, 0.030], [-0.043, -0.063, 0.054], [-0.024, -0.0735, 0.071],
    [0.001, -0.076, 0.0765],
    [0.026, -0.0735, 0.071], [0.044, -0.063, 0.054], [0.047, -0.050, 0.030],
  ].map((p) => new THREE.Vector3(...rel(p[0], p[1], p[2])));
  const bodyTube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bodyPts), 16, 0.0075, 5, false), bone);
  bodyTube.name = 'mandible';
  jaw.add(bodyTube);

  // chin knob — upturned, a millimeter off-center. The underbite's exclamation.
  ell(jaw, bone, rel(0.003, -0.0775, 0.073), [0.017, 0.012, 0.013], [-0.5, 0, 0.06], [10, 6])
    .name = 'chin';
  for (const side of [-1, 1]) {
    ell(jaw, bone, rel(side * 0.049, -0.032, 0.008), [0.0075, 0.023, 0.014], [-0.30, 0, 0], [8, 6]);           // ramus
    ell(jaw, bone, rel(side * 0.050, -0.011, -0.005), [0.008, 0.006, 0.008], [0, 0, 0], [6, 4]);               // condyle
    ell(jaw, bone, rel(side * 0.046, -0.056, 0.030), [0.010, 0.0115, 0.011], [0, 0, 0], [8, 5]);               // gonial angle
    ell(jaw, bone, rel(side * 0.041, -0.065, 0.051), [0.008, 0.011, 0.020], [0, side * -0.45, 0], [8, 5]);     // body plate
  }

  // lowers: ELEVEN crowded teeth (count them). Bases overlap, tips jitter,
  // two overlap outright, and one snaggle hooks up over the lip line —
  // it reads in silhouette, even in the dark.
  for (let i = 0; i < 11; i++) {
    const a = (i / 10 - 0.5) * 2.10;
    const snaggle = i === 3;
    const h = snaggle ? 0.022 : 0.013 + jit(i, 3) * 0.001;
    let x = Math.sin(a) * 0.030;
    let z = 0.060 + Math.cos(a) * 0.027 + jit(i, 4) * 0.0008;
    if (i === 6) x -= 0.0032;                      // shoved into its neighbour
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0042, h, 5), bone);
    const p = rel(x, -0.070 + h / 2, z);
    t.position.set(p[0], p[1], p[2]);
    t.rotation.y = a + jit(i, 5) * 0.1;
    t.rotation.z = (i === 5 ? 0.2 : 0) + jit(i, 6) * 0.08;
    if (snaggle) { t.rotation.x = -0.45; t.position.z += 0.002; }
    jaw.add(t);
  }

  // keys clamp here, right in the teeth
  const jawMount = new THREE.Object3D();
  jawMount.name = 'jawMount';
  const jm = rel(0, -0.062, 0.080);
  jawMount.position.set(jm[0], jm[1], jm[2]);
  jaw.add(jawMount);

  // ------------------------------------------------- the eyes
  // pivots centered in the sockets; balls FIT them (left bigger, like its
  // socket). Mismatched pupils — anisocoria — the third-look wrongness.
  function makeEye(side) {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'eyeL' : 'eyeR';
    pivot.position.set(side * 0.0355, -0.006, 0.0775);
    const R = side < 0 ? 0.0158 : 0.0146;
    const ball = new THREE.Mesh(sphereGeo(12, 9), scleraMat);
    ball.scale.setScalar(R);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(side < 0 ? 0.0068 : 0.0060, 14), irisMat);
    iris.position.z = R * 0.955;
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(side < 0 ? 0.0038 : 0.0026, 10), pupilMat);
    pupil.position.z = R * 0.968;
    pivot.add(ball, iris, pupil);
    pivot.visible = false;
    head.add(pivot);
    return pivot;
  }
  const eyeL = makeEye(-1);
  const eyeR = makeEye(1);

  // ------------------------------------------------- growth stages
  // 1 — muscle finds it first
  patch(head, muscleMat, [-0.077, 0.026, 0.004], 1.05, 1);
  patch(head, muscle2Mat, [0.018, -0.030, -0.084], 1.0, 1);
  patch(head, muscleMat, [0.049, -0.024, 0.052], 0.85, 1);
  const mass = patch(jaw, muscle2Mat, rel(0.047, -0.050, 0.032), 0.8, 1);
  mass.name = 'masseter';

  // 2 — skin creeps in; the first eye opens in the BIG socket
  patch(head, skin2Mat, [-0.028, 0.050, 0.066], 1.15, 2);
  patch(head, skin2Mat, [-0.050, -0.018, 0.050], 1.05, 2);
  patch(head, muscle2Mat, [0.000, 0.030, 0.076], 0.85, 2);
  stageSets[2].push(eyeL);

  // 3 — the second eye; more skin
  stageSets[3].push(eyeR);
  patch(head, skin2Mat, [0.066, 0.030, 0.018], 1.1, 3);
  patch(head, skin2Mat, [0.012, 0.086, 0.012], 1.25, 3);
  patch(jaw, skin2Mat, rel(-0.014, -0.068, 0.060), 0.8, 3);

  // 4 — lank, patchy hair (clustered left — asymmetry) and a small upturned nose
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const HAIR_DIRS = [
    [-0.45, 0.85, 0.15], [-0.6, 0.75, -0.1], [-0.3, 0.9, -0.25], [-0.15, 0.95, 0.1],
    [-0.7, 0.6, 0.2], [-0.5, 0.8, -0.4], [0.2, 0.94, -0.2], [0.45, 0.85, 0.05],
    [0.1, 0.9, 0.35], [0.6, 0.7, -0.3], [0, 0.85, -0.5],
  ];
  const dirV = new THREE.Vector3();
  HAIR_DIRS.forEach((d, i) => {
    dirV.set(d[0], d[1], d[2]).normalize();
    const len = 0.026 + Math.abs(jit(i, 7)) * 0.02;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.0052, len, 5), hairMat);
    const p = surfPoint(dirV, new THREE.Vector3(), -0.002, false);
    tuft.quaternion.setFromUnitVectors(Y_AXIS, dirV);
    tuft.position.copy(p).addScaledVector(dirV, len * 0.32);
    tuft.rotateX(jit(i, 8) * 0.35);
    tuft.rotateZ(jit(i, 9) * 0.35);
    head.add(tuft);
    register(tuft, 4);
  });
  // two long wisps hanging by the left ear
  for (let i = 0; i < 2; i++) {
    dirV.set(-0.9, 0.25 - i * 0.1, -0.05 + i * 0.16).normalize();
    const p = surfPoint(dirV, new THREE.Vector3(), -0.001, false);
    const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.0036, 0.06, 4), hairMat);
    const hang = new THREE.Vector3(-0.26, -1, i * 0.2 - 0.05).normalize();
    wisp.quaternion.setFromUnitVectors(Y_AXIS, hang.clone().negate());
    wisp.position.copy(p).addScaledVector(hang, 0.020);
    head.add(wisp);
    register(wisp, 4);
  }
  // nose — small, slightly upturned (it goes with the underbite)
  ell(head, skinMat, [0, -0.012, 0.081], [0.008, 0.020, 0.008], [-0.15, 0, 0], [8, 5], 4);
  ell(head, skinMat, [0, -0.032, 0.088], [0.012, 0.009, 0.011], [-0.2, 0, 0], [8, 6], 4);
  ell(head, skinMat, [-0.009, -0.035, 0.083], [0.006, 0.005, 0.007], [0, -0.2, 0], [6, 4], 4);
  ell(head, skinMat, [0.009, -0.035, 0.083], [0.006, 0.005, 0.007], [0, 0.2, 0], [6, 4], 4);

  // 5 — the finished face: same skull, now wearing skin. Eye-holed shell,
  // wide-open lids (it does not blink), underbite lips, uneven ears, and a
  // scar riding exactly the old crack line. The snaggle still clears the lip.
  const shell = new THREE.Mesh(craniumGeometry(0.0045, true), skinMat);
  shell.name = 'skinShell';
  head.add(shell);
  register(shell, 5);

  const jawSkin = ell(jaw, skinMat, rel(0.001, -0.066, 0.054), [0.036, 0.025, 0.031],
    [-0.1, 0, 0], [12, 8], 5);
  jawSkin.name = 'jawSkin';

  ell(head, lipMat, [0, -0.056, 0.0805], [0.0235, 0.0055, 0.008], [0, 0, 0], [8, 5], 5);    // upper lip
  ell(jaw, lipMat, rel(0, -0.0665, 0.0865), [0.021, 0.006, 0.009], [0, 0, 0], [8, 5], 5);   // lower lip (proud)
  ell(head, shadowMat, [0, -0.0605, 0.0795], [0.019, 0.0035, 0.005], [0, 0, 0], [6, 4], 5); // parted-lips shadow

  const lidGeoL = new THREE.TorusGeometry(0.0175, 0.0040, 7, 12);
  const lidGeoR = new THREE.TorusGeometry(0.0163, 0.0040, 7, 12);
  for (const side of [-1, 1]) {
    const lid = new THREE.Mesh(side < 0 ? lidGeoL : lidGeoR, skinMat);
    lid.position.set(side * 0.0355, -0.006, 0.083);
    lid.rotation.set(-0.10, 0, 0);
    lid.scale.set(1.02, 1.06, 0.6);
    head.add(lid);
    register(lid, 5);
  }
  // ears — slightly uneven heights
  ell(head, skinMat, [-0.097, 0.004, -0.010], [0.0075, 0.021, 0.013], [0, -0.25, 0.12], [8, 5], 5);
  ell(head, skinMat, [0.097, -0.002, -0.010], [0.0075, 0.021, 0.013], [0, 0.25, -0.12], [8, 5], 5);
  // the scar — the crack, remembered by the skin
  const scar = new THREE.Mesh(ribbonGeo(CRACK_PATH, 0.0036, 0.0014, 0.0055), scarMat);
  scar.name = 'scar';
  head.add(scar);
  register(scar, 5);

  return { root, jaw, jawMount, sockets, eyeL, eyeR, stageSets };
}

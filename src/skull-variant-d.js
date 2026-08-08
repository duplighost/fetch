// skull-variant-d.js — THE WRONG SKULL — round-3 sculpt-off runner-up (7.67/10;
// horror judge's pick: "authored, systematic uncanny that survives darkness").
// Claude sculpt-off 2026-08-08; mounted as ?skull=d for Alex to judge in-game.
// A skull that was never inside a living person. Nothing screams; everything
// is a few millimetres off. The crown is too tall and leans off the midline.
// The sockets sit too low and too far apart — and they don't match. The
// mandible is a size too big for the face; its corner flares wider than the
// cranium on one side only. The chin drifts off-axis. And it has HISTORY:
// a healed dent in the right rear crown with a crack wandering across it,
// the left cheek arch snapped clean (marrow showing), one tooth missing,
// one chipped. All of the wrongness lives in silhouette and value, not hue —
// it must read in near-darkness, at held size, by a colorblind designer.
//
// buildSkullMesh(boneMaterial) -> { root, jaw, jawMount, sockets, eyeL, eyeR, stageSets }
import * as THREE from 'three';

// ---------------------------------------------------------------- helpers
const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// merge duplicate positions (smooth shading across cuts) and DROP vertices
// no kept triangle references — phantom verts would poison the bbox
function weld(geo) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const p = geo.attributes.position;
  const srcIdx = geo.index ? geo.index.array : null;
  const n = srcIdx ? srcIdx.length : p.count;
  const map = new Map();
  const remap = new Map();
  const pos = [];
  const idx = [];
  const take = (i) => {
    if (remap.has(i)) return remap.get(i);
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = `${Math.round(x * 1e5)}_${Math.round(y * 1e5)}_${Math.round(z * 1e5)}`;
    let ni = map.get(k);
    if (ni === undefined) {
      ni = pos.length / 3;
      map.set(k, ni);
      pos.push(x, y, z);
    }
    remap.set(i, ni);
    return ni;
  };
  for (let i = 0; i < n; i += 3) {
    const a = take(srcIdx ? srcIdx[i] : i);
    const b = take(srcIdx ? srcIdx[i + 1] : i + 1);
    const c = take(srcIdx ? srcIdx[i + 2] : i + 2);
    if (a === b || b === c || a === c) continue;
    idx.push(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// deform a unit sphere per-vertex, drop triangles the keep() test rejects
function sculptSphere(ws, hs, mapFn, keepFn) {
  const base = new THREE.SphereGeometry(1, ws, hs);
  const p = base.attributes.position;
  const src = [];
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i);
    src.push(sx, sy, sz);
    const v = mapFn(sx, sy, sz);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const idx = base.index.array;
  const out = [];
  for (let i = 0; i < idx.length; i += 3) {
    const A = idx[i], B = idx[i + 1], C = idx[i + 2];
    if (keepFn) {
      const cx = (p.getX(A) + p.getX(B) + p.getX(C)) / 3;
      const cy = (p.getY(A) + p.getY(B) + p.getY(C)) / 3;
      const cz = (p.getZ(A) + p.getZ(B) + p.getZ(C)) / 3;
      const sx = (src[A * 3] + src[B * 3] + src[C * 3]) / 3;
      const sy = (src[A * 3 + 1] + src[B * 3 + 1] + src[C * 3 + 1]) / 3;
      const sz = (src[A * 3 + 2] + src[B * 3 + 2] + src[C * 3 + 2]) / 3;
      if (!keepFn(cx, cy, cz, sx, sy, sz)) continue;
    }
    out.push(A, B, C);
  }
  base.setIndex(out);
  const g = weld(base);
  base.dispose();
  return g;
}

// rotated (optionally teardrop) ellipse — used for both cuts and dish rings
function ellipsePoint(e, t, scale) {
  const c = Math.cos(t), s = Math.sin(t);
  let rx = e.rx;
  if (e.teardrop) rx *= 1 - 0.32 * Math.max(0, s);
  const u = c * rx * scale, v = s * e.ry * scale;
  const cr = Math.cos(e.rot || 0), sr = Math.sin(e.rot || 0);
  return [e.cx + u * cr - v * sr, e.cy + u * sr + v * cr];
}
function inEllipse(x, y, e) {
  const dx = x - e.cx, dy = y - e.cy;
  const c = Math.cos(-(e.rot || 0)), s = Math.sin(-(e.rot || 0));
  const u = dx * c - dy * s;
  const v = dx * s + dy * c;
  let rx = e.rx;
  if (e.teardrop) rx *= 1 - 0.32 * Math.max(0, v / e.ry);
  return (u * u) / (rx * rx) + (v * v) / (e.ry * e.ry) < 1;
}

function tube(points, radius, tubularSegments = 10, radialSegments = 5) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

// low-poly ragged dome, for muscle/skin scraps
function domePatch(rx, ry, bulge, segments = 12) {
  const positions = [0, 0, bulge];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const wob = 1 + 0.07 * Math.sin(t * 3 + 0.9) + 0.03 * Math.sin(t * 5 + 2.1);
    positions.push(Math.cos(t) * rx * wob, Math.sin(t) * ry * wob, 0);
  }
  for (let i = 0; i < segments; i++) indices.push(0, i + 1, ((i + 1) % segments) + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- build
export function buildSkullMesh(boneMaterial) {
  if (!boneMaterial) throw new Error('buildSkullMesh(boneMaterial) requires a material');

  const root = new THREE.Group();
  root.name = 'WrongSkull';
  root.rotation.order = 'YXZ';

  const stageSets = [[], [], [], [], [], []];
  const sockets = [];

  // every surface derives from the bone material — keeps the game's aged
  // texture + bump on everything, tinted by value (colorblind-safe reads)
  const tint = (color, extra = {}) => {
    const m = boneMaterial.clone();
    m.color = new THREE.Color(color);
    Object.assign(m, extra);
    return m;
  };
  const M = {
    bone: boneMaterial,
    enamel: tint(0xf6eedb, { roughness: 0.42 }),
    marrow: tint(0x5c5044, { roughness: 0.92 }),   // exposed break surfaces
    crack: tint(0x241d15, { roughness: 1.0 }),
    muscle: tint(0x6f2620, { roughness: 0.85 }),
    muscle2: tint(0x83352b, { roughness: 0.82 }),
    skin: tint(0xc59d87, { roughness: 0.7 }),
    skin2: tint(0xb78e79, { roughness: 0.74 }),
    lip: tint(0x5e3733, { roughness: 0.62 }),
    hair: tint(0x171310, { roughness: 0.96 }),
    sclera: tint(0xdad6ca, { roughness: 0.34 }),
    iris: tint(0x82877e, { roughness: 0.4 }),
    pupil: tint(0x0b0b0b, { roughness: 0.5 }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }),
  };

  const reg = (stage, mesh, parent = root) => {
    mesh.visible = stage === 0;
    parent.add(mesh);
    if (stage > 0) stageSets[stage].push(mesh);
    return mesh;
  };
  const blob = (stage, mat, pos, scale, rot = null, parent = root, ws = 10, hs = 7) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, ws, hs), mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    return reg(stage, m, parent);
  };

  // ------------------------------------------------------------ geometry law
  const Y0 = 0.030, Z0 = -0.006;
  const RX = 0.0755, RY_TOP = 0.088, RY_BOT = 0.080, RZ = 0.083;
  // dent: right rear crown, an old blow that healed flat
  const DENT = new THREE.Vector3(0.50, 0.60, -0.56).normalize();

  // the one deformation law all shells share — bone, hair, stage-5 face —
  // so every stage stays the same character
  function skullPoint(nx, ny, nz, o = {}) {
    const shell = !!o.shell;
    const ryBot = shell ? 0.112 : RY_BOT;
    const t = sm(-0.30, 0.30, ny);
    const ry = ryBot + (RY_TOP - ryBot) * t;
    let x = nx * RX;
    let y = Y0 + ny * ry;
    let z = Z0 + nz * RZ;
    x *= nx < 0 ? 1.045 : 0.982;              // left side fuller
    if (shell && ny < 0) {
      // flesh de-tapers over the oversized mandible: heavy square lower face
      x *= 1 + 0.44 * sm(-0.15, -0.85, ny) * (1 - Math.abs(nz) * 0.45);
      z += 0.048 * sm(-0.45, -1.0, ny) * Math.max(0, nz); // chin / jowl mass
    }
    const lean = sm(0.10, 1.0, ny);
    x -= 0.009 * lean * lean;                 // crown leans off the midline
    y += 0.003 * Math.pow(sm(0.78, 1.0, ny), 2);        // slight peak
    z -= 0.0042 * sm(0.30, 1.0, nz) * sm(0.05, 0.55, ny); // tall flat forehead
    z -= 0.0075 * sm(-0.35, -1.0, nz);        // occipital bun
    // the dent
    const dd = nx * DENT.x + ny * DENT.y + nz * DENT.z;
    const g = Math.exp(-Math.pow((1 - dd) / 0.075, 2));
    const depth = (shell ? 0.0038 : 0.0078) * g;
    x -= nx * depth; y -= ny * depth; z -= nz * depth;
    if (!shell && !o.smooth) {
      // worn cortical bone, not showroom bone
      const n = Math.sin(nx * 14.2 + ny * 7.7 + 1.3) * Math.sin(ny * 11.9 + nz * 9.1 + 0.7);
      const a = n * 0.0007;
      x += nx * a; y += ny * a; z += nz * a;
    }
    if (o.inflate) {
      const dx = x, dy = y - Y0, dz = z - Z0;
      const l = Math.hypot(dx, dy, dz) || 1;
      x += (dx / l) * o.inflate; y += (dy / l) * o.inflate; z += (dz / l) * o.inflate;
    }
    return new THREE.Vector3(x, y, z);
  }

  // approximate bone-surface z at a face point — dishes/rims sit ON the bone
  function surfZ(x, y) {
    let ny = (y - Y0) / 0.086;
    for (let k = 0; k < 3; k++) {
      const ry = RY_BOT + (RY_TOP - RY_BOT) * sm(-0.30, 0.30, ny);
      ny = (y - Y0) / ry;
    }
    const nx = x / (RX * (x < 0 ? 1.045 : 0.982));
    const s = Math.max(0.02, 1 - nx * nx - ny * ny);
    return Z0 + Math.sqrt(s) * RZ;
  }

  // sockets: too low, too wide-set, and they don't match
  const ORB_L = { cx: -0.0375, cy: -0.002, rx: 0.0260, ry: 0.0215, rot: 0.10 };
  const ORB_R = { cx: 0.0335, cy: 0.0045, rx: 0.0215, ry: 0.0180, rot: -0.07 };
  const NAS = { cx: 0.0035, cy: -0.0235, rx: 0.0105, ry: 0.0155, rot: 0.09, teardrop: true };

  // ------------------------------------------------------------ cranium
  // after cutting, snap the surviving edge vertices onto each hole's ellipse
  // so the sockets read as clean shapes, not broken windows
  const snapHoles = (geo, holes) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (z < 0.015) continue;
      for (const e of holes) {
        const dx = x - e.cx, dy = y - e.cy;
        const c = Math.cos(-(e.rot || 0)), s = Math.sin(-(e.rot || 0));
        const u = dx * c - dy * s;
        const v = dx * s + dy * c;
        let rx = e.rx;
        if (e.teardrop) rx *= 1 - 0.32 * Math.max(0, v / e.ry);
        const m = Math.hypot(u / rx, v / e.ry);
        if (m >= 1.22 || m < 1e-4) continue;
        const k = 1.05 / m;
        const cr = Math.cos(e.rot || 0), sr = Math.sin(e.rot || 0);
        const nxp = e.cx + u * k * cr - v * k * sr;
        const nyp = e.cy + u * k * sr + v * k * cr;
        p.setXYZ(i, nxp, nyp, surfZ(nxp, nyp) - 0.0004);
        break;
      }
    }
    geo.computeVertexNormals();
    return geo;
  };
  const cranium = new THREE.Mesh(
    snapHoles(sculptSphere(26, 18,
      (nx, ny, nz) => skullPoint(nx, ny, nz),
      (cx, cy, cz) => {
        if (cz > 0.02 && inEllipse(cx, cy, ORB_L)) return false;
        if (cz > 0.02 && inEllipse(cx, cy, ORB_R)) return false;
        if (cz > 0.02 && inEllipse(cx, cy, NAS)) return false;
        return true;
      }), [ORB_L, ORB_R, NAS]),
    M.bone);
  cranium.name = 'Cranium';
  reg(0, cranium);

  // black funnel built from the hole's own ellipse: ring hugs the cut edge
  // (following the curved bone surface), sinks to a deep centre. No leaks.
  const makeDish = (e, name) => {
    const SEG = 14;
    const positions = [];
    const indices = [];
    for (let i = 0; i < SEG; i++) {
      const t = (i / SEG) * Math.PI * 2;
      const [ox, oy] = ellipsePoint(e, t, 1.12);
      const [ix, iy] = ellipsePoint(e, t, 0.55);
      positions.push(ox, oy, surfZ(ox, oy) - 0.0006);
      positions.push(ix, iy, surfZ(e.cx, e.cy) - 0.0115);
    }
    const centerIndex = positions.length / 3;
    positions.push(e.cx, e.cy, surfZ(e.cx, e.cy) - 0.020);
    for (let i = 0; i < SEG; i++) {
      const ni = (i + 1) % SEG;
      const o0 = i * 2, i0 = i * 2 + 1, o1 = ni * 2, i1 = ni * 2 + 1;
      indices.push(o0, o1, i1, o0, i1, i0, i0, i1, centerIndex);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const dish = new THREE.Mesh(g, M.void);
    dish.name = name;
    reg(0, dish);
    sockets.push(dish);
    return dish;
  };
  makeDish(ORB_L, 'SocketL');
  makeDish(ORB_R, 'SocketR');
  makeDish(NAS, 'SocketNasal');

  // brow bone: shallow half-buried thickening above each socket — quiet
  // definition, no goggle rings, no helmet brim
  blob(0, M.bone, [-0.0365, 0.0230, surfZ(-0.0365, 0.0230) - 0.0038], [0.0195, 0.0066, 0.0080], [0.30, -0.35, 0.12]);
  blob(0, M.bone, [0.0325, 0.0285, surfZ(0.0325, 0.0285) - 0.0038], [0.0165, 0.0060, 0.0078], [0.30, 0.33, -0.08]);
  // glabella — small, keeps the midline quiet
  blob(0, M.bone, [0.001, 0.022, 0.056], [0.010, 0.012, 0.008]);

  // cheekbones: wide and low
  blob(0, M.bone, [-0.0540, -0.0125, 0.0385], [0.0185, 0.0125, 0.0155], [0, -0.25, 0.15]);
  blob(0, M.bone, [0.0515, -0.0090, 0.0410], [0.0160, 0.0115, 0.0145], [0, 0.22, -0.10]);

  // zygomatic arches — the LEFT one is snapped. marrow shows at the break.
  const archR = new THREE.Mesh(tube([
    new THREE.Vector3(0.0500, -0.0080, 0.0385),
    new THREE.Vector3(0.0660, -0.0020, 0.0230),
    new THREE.Vector3(0.0740, 0.0040, -0.0020),
    new THREE.Vector3(0.0695, 0.0105, -0.0245),
  ], 0.0044, 8, 5), M.bone);
  reg(0, archR);
  // rooted in the cheekbone, snapped mid-span; rear stub rooted in the temple
  const archLa = new THREE.Mesh(tube([
    new THREE.Vector3(-0.0520, -0.0110, 0.0370),
    new THREE.Vector3(-0.0680, -0.0050, 0.0230),
    new THREE.Vector3(-0.0752, -0.0005, 0.0100),
  ], 0.0050, 6, 5), M.bone);
  reg(0, archLa);
  const archLb = new THREE.Mesh(tube([
    new THREE.Vector3(-0.0775, 0.0045, -0.0075),
    new THREE.Vector3(-0.0720, 0.0105, -0.0250),
  ], 0.0048, 4, 5), M.bone);
  reg(0, archLb);
  blob(0, M.marrow, [-0.0754, -0.0005, 0.0102], [0.0046, 0.0052, 0.0052]);
  blob(0, M.marrow, [-0.0775, 0.0045, -0.0077], [0.0044, 0.0050, 0.0050]);

  // the crack: wanders from the dent down toward the right orbit
  const crackDirs = [
    [0.52, 0.66, -0.52], [0.44, 0.76, -0.28], [0.50, 0.80, -0.02],
    [0.40, 0.78, 0.26], [0.47, 0.66, 0.48], [0.37, 0.52, 0.66], [0.42, 0.38, 0.76],
  ].map((d) => {
    const v = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    return skullPoint(v.x, v.y, v.z, { smooth: true, inflate: 0.0007 });
  });
  reg(0, new THREE.Mesh(tube(crackDirs, 0.0011, 14, 4), M.crack));

  // maxillae flank the nasal hole; a U-shaped alveolar arch carries the
  // teeth and closes the mouth's side walls back to the cheeks
  blob(0, M.bone, [-0.0165, -0.0405, 0.0425], [0.0155, 0.0100, 0.0125], [0, -0.10, 0.05]);
  blob(0, M.bone, [0.0225, -0.0405, 0.0425], [0.0148, 0.0096, 0.0122], [0, 0.10, -0.04]);
  reg(0, new THREE.Mesh(tube([
    new THREE.Vector3(-0.0355, -0.0400, 0.0290),
    new THREE.Vector3(-0.0300, -0.0450, 0.0460),
    new THREE.Vector3(-0.0170, -0.0495, 0.0560),
    new THREE.Vector3(0.0020, -0.0510, 0.0590),
    new THREE.Vector3(0.0210, -0.0495, 0.0555),
    new THREE.Vector3(0.0330, -0.0450, 0.0455),
    new THREE.Vector3(0.0375, -0.0400, 0.0285),
  ], 0.0078, 12, 5), M.bone));
  // side fills between arch ends and cheekbones
  blob(0, M.bone, [-0.0340, -0.0330, 0.0300], [0.0115, 0.0105, 0.0180], [0, -0.3, 0.1]);
  blob(0, M.bone, [0.0360, -0.0330, 0.0295], [0.0110, 0.0100, 0.0175], [0, 0.3, -0.1]);

  // mouth interior — black behind and between the teeth so the tooth band
  // and the chatter read in the dark
  blob(0, M.void, [0.002, -0.052, 0.038], [0.026, 0.014, 0.014], null, root, 10, 6);
  blob(0, M.void, [0.002, -0.0575, 0.0555], [0.0290, 0.0090, 0.0055], null, root, 10, 6);

  // ------------------------------------------------------------ teeth
  // chunky, irregular, with a story: one missing (upper left), one chipped
  const toothMesh = (w, len, taper, mat, up = false) => {
    const g = up
      ? new THREE.CylinderGeometry(w * taper, w, len, 6)
      : new THREE.CylinderGeometry(w, w * taper, len, 6);
    return new THREE.Mesh(g, mat);
  };
  // fewer, larger teeth — they must stay countable at held size.
  // -0.0150 is MISSING (dark gap in the band); 0.0135 is chipped short.
  const upperX = [-0.0245, -0.0055, 0.0040, 0.0135, 0.0230];
  const upJit = [0.06, 0.03, -0.05, 0.12, -0.06];
  for (let i = 0; i < upperX.length; i++) {
    const x = upperX[i];
    const canine = x === 0.0230 || x === -0.0245;
    const chipped = x === 0.0135;
    const len = chipped ? 0.0075 : canine ? 0.0150 : 0.0132;
    const t = toothMesh(0.0036, len, canine ? 0.5 : 0.72, M.enamel);
    t.scale.x = 1.30;
    t.position.set(x, -0.0510 - len / 2, 0.0660 - Math.abs(x) * 0.28);
    t.rotation.z = upJit[i] + (chipped ? 0.10 : 0);
    t.rotation.y = -x * 2.2;
    reg(0, t);
  }

  // ------------------------------------------------------------ mandible
  // a size too big for the face; the right corner flares wider than the
  // cranium, the left doesn't. chin drifts off-axis.
  const JAW_PIVOT = new THREE.Vector3(0.002, -0.020, -0.010);
  const jaw = new THREE.Group();
  jaw.name = 'Mandible';
  jaw.position.copy(JAW_PIVOT);
  jaw.rotation.order = 'XYZ';
  root.add(jaw);

  const jawBody = new THREE.Mesh(tube([
    new THREE.Vector3(-0.0600, 0.0000, 0.0080),
    new THREE.Vector3(-0.0660, -0.0230, 0.0150),
    new THREE.Vector3(-0.0600, -0.0450, 0.0380),
    new THREE.Vector3(-0.0330, -0.0540, 0.0590),
    new THREE.Vector3(-0.0060, -0.0560, 0.0672),
    new THREE.Vector3(0.0150, -0.0560, 0.0678),
    new THREE.Vector3(0.0390, -0.0520, 0.0570),
    new THREE.Vector3(0.0650, -0.0430, 0.0345),
    new THREE.Vector3(0.0740, -0.0210, 0.0130),
    new THREE.Vector3(0.0620, 0.0020, 0.0070),
  ], 0.0095, 18, 5), M.bone);
  reg(0, jawBody, jaw);

  // bone mass so the jaw reads as jaw, not wire: chin, body, gonial corners
  blob(0, M.bone, [0.0045, -0.0530, 0.0660], [0.0165, 0.0110, 0.0115], [0.15, 0, 0.06], jaw);
  blob(0, M.bone, [-0.0400, -0.0480, 0.0480], [0.0150, 0.0095, 0.0135], [0, -0.45, 0.10], jaw);
  blob(0, M.bone, [0.0450, -0.0450, 0.0450], [0.0145, 0.0095, 0.0130], [0, 0.45, -0.10], jaw);
  blob(0, M.bone, [-0.0630, -0.0260, 0.0180], [0.0090, 0.0130, 0.0100], [0, -0.2, 0.1], jaw);
  blob(0, M.bone, [0.0710, -0.0240, 0.0160], [0.0095, 0.0135, 0.0100], [0, 0.2, -0.1], jaw);
  // condyles + coronoids
  blob(0, M.bone, [-0.0600, 0.0010, 0.0060], [0.0075, 0.0055, 0.0062], null, jaw, 8, 5);
  blob(0, M.bone, [0.0625, 0.0010, 0.0050], [0.0075, 0.0055, 0.0062], null, jaw, 8, 5);
  blob(0, M.bone, [-0.0510, -0.0060, 0.0230], [0.0050, 0.0100, 0.0045], [0, 0, 0.14], jaw, 8, 5);
  blob(0, M.bone, [0.0530, -0.0060, 0.0220], [0.0050, 0.0100, 0.0045], [0, 0, -0.14], jaw, 8, 5);
  // lower alveolar ridge — wider than the upper (the bite is off)
  blob(0, M.bone, [0.0005, -0.0510, 0.0570], [0.0340, 0.0100, 0.0175], null, jaw, 14, 8);

  // black slab behind the lower teeth (moves with the jaw)
  blob(0, M.void, [0.0005, -0.0450, 0.0660], [0.0250, 0.0080, 0.0048], null, jaw, 10, 6);

  const lowerX = [-0.0225, -0.0135, -0.0045, 0.0045, 0.0135, 0.0225];
  const loJit = [-0.05, 0.18, -0.03, 0.05, -0.06, 0.07];
  for (let i = 0; i < lowerX.length; i++) {
    const x = lowerX[i];
    const len = 0.0115;
    const t = toothMesh(0.0032, len, 0.75, M.enamel, true);
    t.scale.x = 1.26;
    t.position.set(x, -0.0500 + len / 2, 0.0810 - Math.abs(x + 0.002) * 0.28);
    t.rotation.z = loJit[i] * 0.6;
    t.rotation.y = loJit[i];
    reg(0, t, jaw);
  }

  const jawMount = new THREE.Object3D();
  jawMount.name = 'JawMount';
  jawMount.position.set(0.0005, -0.0420, 0.0660); // clamped at the lower teeth
  jaw.add(jawMount);

  // ------------------------------------------------------------ eyes
  // they fit their mismatched sockets — the left is bigger, with a wider
  // pupil. pupils toward +Z; the game turns the pivots to track threats.
  const mkEye = (name, e, r, pupilR, stage) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(e.cx, e.cy, surfZ(e.cx, e.cy) - r * 1.05);
    pivot.rotation.order = 'YXZ';
    root.add(pivot);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), M.sclera);
    pivot.add(ball);
    const irisR = pupilR * 1.9;
    const iris = new THREE.Mesh(new THREE.CircleGeometry(irisR, 14), M.iris);
    iris.position.z = Math.sqrt(Math.max(0, r * r - irisR * irisR)) + 0.0004;
    pivot.add(iris);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(pupilR, 12), M.pupil);
    pupil.position.z = iris.position.z + 0.0004;
    pivot.add(pupil);
    pivot.visible = false;
    stageSets[stage].push(pivot);
    return pivot;
  };
  const eyeL = mkEye('EyeL', ORB_L, 0.0128, 0.0036, 2);
  const eyeR = mkEye('EyeR', ORB_R, 0.0106, 0.0023, 3);

  // ------------------------------------------------------------ stage 1 — muscle
  const patch = (stage, mat, pos, rx, ry, bulge, rot, parent = root) => {
    const m = new THREE.Mesh(domePatch(rx, ry, bulge), mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    return reg(stage, m, parent);
  };
  patch(1, M.muscle, [-0.0660, 0.022, 0.004], 0.016, 0.024, 0.0042, [0, -1.45, 0.1]);
  patch(1, M.muscle2, [0.0640, 0.024, 0.002], 0.015, 0.023, 0.0040, [0, 1.45, -0.1]);
  patch(1, M.muscle, [-0.0560, -0.030, 0.028], 0.012, 0.019, 0.0044, [0.05, -1.15, -0.05], jaw);
  patch(1, M.muscle2, [0.0600, -0.028, 0.026], 0.012, 0.019, 0.0044, [0.05, 1.15, 0.05], jaw);
  patch(1, M.muscle, [0.0435, -0.024, 0.0500], 0.010, 0.013, 0.0034, [0.1, 0.42, -0.2]);

  // ------------------------------------------------------------ stage 2 — skin creeps (left) + first eye
  patch(2, M.skin, [-0.0360, 0.028, 0.0545], 0.019, 0.015, 0.0036, [-0.15, -0.30, 0.1]);
  patch(2, M.skin2, [-0.0490, -0.027, 0.0420], 0.015, 0.018, 0.0040, [0.05, -0.60, 0.15]);
  patch(2, M.skin, [-0.0700, 0.008, 0.0055], 0.014, 0.022, 0.0034, [0, -1.52, 0]);
  patch(2, M.skin2, [-0.0090, 0.0560, 0.0740], 0.019, 0.014, 0.0032, [-0.38, -0.05, 0.05]);

  // ------------------------------------------------------------ stage 3 — second eye + skin (right, chin)
  patch(3, M.skin2, [0.0330, 0.030, 0.0570], 0.017, 0.013, 0.0034, [-0.15, 0.28, -0.08]);
  patch(3, M.skin, [0.0460, -0.024, 0.0450], 0.014, 0.017, 0.0040, [0.05, 0.55, -0.12]);
  patch(3, M.skin2, [0.0660, 0.006, 0.0035], 0.014, 0.022, 0.0034, [0, 1.52, 0]);
  patch(3, M.skin, [0.0080, 0.0880, 0.0290], 0.020, 0.016, 0.0034, [-0.95, 0.05, 0]);
  patch(3, M.skin, [0.0020, -0.0580, 0.0720], 0.016, 0.010, 0.0036, [0.55, 0, 0.05], jaw);

  // ------------------------------------------------------------ stage 4 — hair + nose
  // lank patchy hair, receded high on the tall crown; scalp shows through
  const hairCap = new THREE.Mesh(
    sculptSphere(20, 12,
      (nx, ny, nz) => skullPoint(nx, ny, nz, { smooth: true, inflate: 0.0085 }),
      (cx, cy, cz, sx, sy, sz) => {
        const hl = -0.14 + 0.56 * sm(-0.55, 0.55, sz)
          + 0.06 * Math.sin(sx * 14.7 + sz * 11.3)
          + (sx < 0 ? 0.05 : 0);           // patchier on the left
        return sy > hl;
      }),
    M.hair);
  reg(4, hairCap);
  const strand = (dirs, r = 0.0013) => {
    const pts = dirs.map((d) => {
      const v = new THREE.Vector3(d[0], d[1], d[2]);
      if (d.length === 3) { v.normalize(); return skullPoint(v.x, v.y, v.z, { smooth: true, inflate: 0.009 }); }
      return v;
    });
    reg(4, new THREE.Mesh(tube(pts, r, 7, 4), M.hair));
  };
  strand([[-0.5, 0.5, -0.6], [-0.62, 0.1, -0.55], [-0.068, -0.028, -0.050, 1]]);
  strand([[0.55, 0.55, -0.5], [0.66, 0.1, -0.45], [0.060, -0.032, -0.042, 1]]);
  strand([[0.1, 0.6, -0.85], [0.06, 0.1, -0.92], [0.004, -0.038, -0.082, 1]]);
  strand([[-0.35, 0.55, -0.7], [-0.40, 0.05, -0.76], [-0.034, -0.042, -0.066, 1]]);
  strand([[-0.75, 0.5, 0.1], [-0.080, 0.006, 0.012, 1], [-0.076, -0.026, 0.016, 1]]);
  strand([[0.78, 0.55, 0.05], [0.082, 0.010, 0.006, 1], [0.080, -0.020, 0.012, 1]]);
  // one thin strand falls over the forehead
  strand([[0.18, 0.85, 0.35], [0.030, 0.080, 0.068, 1], [0.034, 0.046, 0.075, 1]], 0.0010);

  // the nose: too long, too thin, tip bent the way the crown leans back
  blob(4, M.skin, [0.0035, -0.004, 0.0690], [0.0062, 0.0170, 0.0090], [0.22, 0, 0.06]);
  blob(4, M.skin, [0.0062, -0.0225, 0.0790], [0.0072, 0.0062, 0.0068]);
  blob(4, M.skin2, [-0.0028, -0.0260, 0.0730], [0.0052, 0.0044, 0.0050]);
  blob(4, M.skin2, [0.0150, -0.0258, 0.0735], [0.0048, 0.0042, 0.0048]);
  const nostril = (x, s) => {
    const n = new THREE.Mesh(new THREE.CircleGeometry(1, 10), M.void);
    n.position.set(x, -0.0295, 0.0755);
    n.scale.set(s, s * 0.62, 1);
    n.rotation.x = -1.15;
    reg(4, n);
  };
  nostril(0.0015, 0.0023);
  nostril(0.0115, 0.0017);

  // ------------------------------------------------------------ stage 5 — the finished face
  // same law as the bone: tall leaning crown, low wide eyes, heavy jaw.
  const eyeHoleL = { cx: ORB_L.cx, cy: ORB_L.cy, rx: 0.0133, ry: 0.0120, rot: 0.1 };
  const eyeHoleR = { cx: ORB_R.cx, cy: ORB_R.cy, rx: 0.0113, ry: 0.0100, rot: -0.07 };
  const lowerFace = (cy, cz, cx) => cy < -0.045 && cz > 0.008 && Math.abs(cx) < 0.068;

  const shellMap = (nx, ny, nz) => skullPoint(nx, ny, nz, { shell: true, inflate: 0.0062 });
  const faceUpper = new THREE.Mesh(
    sculptSphere(24, 16, shellMap,
      (cx, cy, cz) => {
        if (cz > 0.02 && inEllipse(cx, cy, eyeHoleL)) return false;
        if (cz > 0.02 && inEllipse(cx, cy, eyeHoleR)) return false;
        return !lowerFace(cy, cz, cx);
      }),
    M.skin);
  faceUpper.name = 'Face5Upper';
  reg(5, faceUpper);

  const lowerGeo = sculptSphere(24, 16, shellMap, (cx, cy, cz) => lowerFace(cy, cz, cx));
  {
    const p = lowerGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) - JAW_PIVOT.x, p.getY(i) - JAW_PIVOT.y, p.getZ(i) - JAW_PIVOT.z);
    }
    lowerGeo.computeBoundingSphere();
  }
  const faceLower = new THREE.Mesh(lowerGeo, M.skin);
  faceLower.name = 'Face5Jaw';
  reg(5, faceLower, jaw);

  // lids ring the eye holes (and hide the cut edges)
  const lid = (e) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 5, 12), M.skin2);
    m.position.set(e.cx, e.cy, surfZ(e.cx, e.cy) + 0.0052);
    m.scale.set(e.rx, e.ry, 0.004);
    m.rotation.set(-e.cy * 2.0, e.cx * 5.0, e.rot);
    reg(5, m);
  };
  lid(eyeHoleL);
  lid(eyeHoleR);

  // brows: thin, dark, one raised
  reg(5, new THREE.Mesh(tube([
    new THREE.Vector3(-0.0530, 0.0155, 0.0640),
    new THREE.Vector3(-0.0375, 0.0220, 0.0710),
    new THREE.Vector3(-0.0225, 0.0175, 0.0690),
  ], 0.0016, 6, 4), M.hair));
  reg(5, new THREE.Mesh(tube([
    new THREE.Vector3(0.0210, 0.0245, 0.0700),
    new THREE.Vector3(0.0345, 0.0300, 0.0715),
    new THREE.Vector3(0.0480, 0.0240, 0.0650),
  ], 0.0016, 6, 4), M.hair));

  // lips — thin, and the mouth line droops a few degrees off level
  const upperLip = blob(5, M.lip, [0.003, -0.0580, 0.0790], [0.0165, 0.0028, 0.0042], [0, 0, 0.05], root, 12, 6);
  upperLip.name = 'Lip5Upper';
  const lowerLip = blob(5, M.lip,
    [0.003 - JAW_PIVOT.x, -0.0630 - JAW_PIVOT.y, 0.0792 - JAW_PIVOT.z],
    [0.0158, 0.0030, 0.0042], [0, 0, 0.05], jaw, 12, 6);
  lowerLip.name = 'Lip5Lower';

  // ears — small, set low, and not at the same height
  blob(5, M.skin, [-0.0840, -0.022, -0.006], [0.0085, 0.0190, 0.0058], [0, 0.10, 0.10]);
  blob(5, M.skin, [0.0820, -0.015, -0.004], [0.0082, 0.0180, 0.0056], [0, -0.10, -0.08]);
  blob(5, M.skin2, [-0.0857, -0.023, -0.003], [0.0038, 0.0105, 0.0022], [0, 0.10, 0.10]);
  blob(5, M.skin2, [0.0837, -0.016, -0.001], [0.0036, 0.0100, 0.0022], [0, -0.10, -0.08]);

  // ------------------------------------------------------------ finish
  for (let s = 1; s <= 5; s++) for (const m of stageSets[s]) m.visible = false;

  return { root, jaw, jawMount, sockets, eyeL, eyeR, stageSets };
}

// skull-variant-b.js — Pro farm submission B ("the engineer").
// Procedural human skull with TRUE cut openings: orbits and nasal aperture
// are removed from the cranium mesh with dark funnels behind; stage-5 head
// splits so the lower face rides the mandible. Verbatim from the courier
// drop, 2026-08-08.
import * as THREE from 'three';

/**
 * Procedural ~19 cm human skull / reconstruction prop.
 * Face points toward +Z. Positive jaw.rotation.x opens the mandible down/back.
 *
 * stageSets are additive:
 *   0 = base skull
 *   1 = exposed muscle patches
 *   2 = creeping skin + left eye
 *   3 = right eye + additional skin
 *   4 = hair + reconstructed nose
 *   5 = complete neutral head
 */
export function buildSkullMesh(boneMaterial) {
  if (!boneMaterial) {
    throw new Error('buildSkullMesh(boneMaterial) requires a THREE.Material.');
  }

  const root = new THREE.Group();
  root.name = 'ProceduralHumanSkull';
  root.rotation.order = 'YXZ';

  const stageSets = Array.from({ length: 6 }, () => []);
  const sockets = [];

  const cavityMaterial = new THREE.MeshStandardMaterial({
    color: 0x07090a,
    roughness: 0.98,
    metalness: 0
  });

  const deepCavityMaterial = new THREE.MeshStandardMaterial({
    color: 0x020303,
    roughness: 1,
    metalness: 0
  });

  const muscleMaterial = new THREE.MeshStandardMaterial({
    color: 0x651e1b,
    roughness: 0.78,
    metalness: 0
  });

  const tendonMaterial = new THREE.MeshStandardMaterial({
    color: 0xa26d5d,
    roughness: 0.82,
    metalness: 0
  });

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xc49a84,
    roughness: 0.72,
    metalness: 0
  });

  const patchSkinMaterial = new THREE.MeshStandardMaterial({
    color: 0xba8874,
    roughness: 0.76,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const noseSkinMaterial = new THREE.MeshStandardMaterial({
    color: 0xc39984,
    roughness: 0.69,
    metalness: 0,
    side: THREE.DoubleSide
  });

  const lipMaterial = new THREE.MeshStandardMaterial({
    color: 0x855452,
    roughness: 0.73,
    metalness: 0
  });

  const hairMaterial = new THREE.MeshStandardMaterial({
    color: 0x171415,
    roughness: 0.9,
    metalness: 0
  });

  const scleraMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6d1c7,
    roughness: 0.38,
    metalness: 0
  });

  const irisMaterial = new THREE.MeshStandardMaterial({
    color: 0x69736b,
    roughness: 0.46,
    metalness: 0
  });

  const pupilMaterial = new THREE.MeshStandardMaterial({
    color: 0x030404,
    roughness: 0.42,
    metalness: 0
  });

  const corneaMaterial = new THREE.MeshStandardMaterial({
    color: 0xdce6e8,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false
  });

  function registerMesh(stage, mesh, parent = root) {
    mesh.visible = stage === 0;
    parent.add(mesh);
    stageSets[stage].push(mesh);
    return mesh;
  }

  function makeSphereMesh(
    material,
    position,
    scale,
    ws = 12,
    hs = 7,
    rotation = null
  ) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, ws, hs),
      material
    );

    mesh.position.copy(position);
    mesh.scale.copy(scale);

    if (rotation) {
      mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    }

    return mesh;
  }

  function deformCraniumVertex(source) {
    const nx = source.x;
    const ny = source.y;
    const nz = source.z;

    const temporalBand =
      Math.exp(-Math.pow(ny / 0.52, 2)) *
      Math.exp(-Math.pow((nz + 0.02) / 0.7, 2));

    let rx = 0.069 * (1 - temporalBand * 0.055);
    const ry = 0.071;
    const rz = 0.067;

    if (ny < -0.42) {
      rx *= 1 + (ny + 0.42) * 0.08;
    }

    let x = nx * rx;
    let y = 0.026 + ny * ry;
    let z = -0.008 + nz * rz;

    // Slight frontal flattening.
    if (nz > 0.28) {
      z -= 0.0027 * Math.pow((nz - 0.28) / 0.72, 1.25);
    }

    // Occipital projection.
    if (nz < -0.34) {
      z -= 0.0042 * Math.pow((-nz - 0.34) / 0.66, 1.35);
    }

    // Subtle vertex-level cortical irregularity.
    const n =
      Math.sin(nx * 17.1 + ny * 7.3 + nz * 11.7) *
      Math.sin(nx * 8.9 - ny * 15.2 + nz * 5.4);

    const rough = n * 0.00034;

    const normal = new THREE.Vector3(
      nx / Math.max(rx, 1e-4),
      ny / ry,
      nz / rz
    ).normalize();

    x += normal.x * rough;
    y += normal.y * rough;
    z += normal.z * rough;

    return new THREE.Vector3(x, y, z);
  }

  function insideOrbit(x, y) {
    const ex = Math.abs(x) - 0.0265;
    const ey = y - 0.016;
    return (
      (ex * ex) / (0.0222 * 0.0222) +
        (ey * ey) / (0.0182 * 0.0182) <
      1
    );
  }

  function insideNasalAperture(x, y) {
    const yy = y + 0.008;
    let rx = 0.011;

    if (yy > 0) rx *= 0.8;
    else rx *= 1.08;

    return (
      (x * x) / (rx * rx) +
        (yy * yy) / (0.0215 * 0.0215) <
      1
    );
  }

  function makeCraniumGeometry() {
    const base = new THREE.SphereGeometry(1, 30, 18);
    const p = base.attributes.position;
    const idx = base.index.array;

    const out = [];

    const getV = (i) =>
      deformCraniumVertex(
        new THREE.Vector3(
          p.getX(i),
          p.getY(i),
          p.getZ(i)
        )
      );

    for (let i = 0; i < idx.length; i += 3) {
      const a = getV(idx[i]);
      const b = getV(idx[i + 1]);
      const c = getV(idx[i + 2]);

      const cx = (a.x + b.x + c.x) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      const cz = (a.z + b.z + c.z) / 3;

      // Cut true openings rather than painting black ovals onto a sphere.
      if (cz > 0.018 && insideOrbit(cx, cy)) continue;
      if (cz > 0.02 && insideNasalAperture(cx, cy)) continue;

      out.push(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z
      );
    }

    base.dispose();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(out, 3)
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function orbitShape(theta, rx, ry, cx, cy, scale = 1) {
    const s = Math.sin(theta);
    const c = Math.cos(theta);

    const upperWiden = 1 + Math.max(0, s) * 0.055;
    const lowerTaper = 1 - Math.max(0, -s) * 0.09;

    return new THREE.Vector2(
      cx + c * rx * scale * upperWiden * lowerTaper,
      cy + s * ry * scale
    );
  }

  function nasalShape(theta, rx, ry, cx, cy, scale = 1) {
    const s = Math.sin(theta);
    const c = Math.cos(theta);

    const width =
      1 -
      Math.max(0, s) * 0.34 +
      Math.max(0, -s) * 0.11;

    return new THREE.Vector2(
      cx + c * rx * width * scale,
      cy + s * ry * scale
    );
  }

  function makeDishGeometry({
    cx,
    cy,
    rx,
    ry,
    rimZ,
    innerZ,
    centerZ,
    segments = 16,
    shape = orbitShape
  }) {
    const positions = [];
    const indices = [];

    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;

      const outer = shape(t, rx, ry, cx, cy, 1);
      const inner = shape(t, rx, ry, cx, cy, 0.69);

      positions.push(outer.x, outer.y, rimZ);
      positions.push(inner.x, inner.y, innerZ);
    }

    const centerIndex = positions.length / 3;
    positions.push(cx, cy, centerZ);

    for (let i = 0; i < segments; i++) {
      const ni = (i + 1) % segments;

      const o0 = i * 2;
      const i0 = i * 2 + 1;
      const o1 = ni * 2;
      const i1 = ni * 2 + 1;

      indices.push(
        o0, o1, i1,
        o0, i1, i0,
        i0, i1, centerIndex
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeRimGeometry({
    cx,
    cy,
    rx,
    ry,
    z,
    thickness,
    segments = 16,
    shape = orbitShape
  }) {
    const positions = [];
    const indices = [];

    const innerScale = Math.max(
      0.68,
      1 - thickness / Math.max(rx, ry)
    );

    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;

      const outer = shape(t, rx, ry, cx, cy, 1);
      const inner = shape(t, rx, ry, cx, cy, innerScale);

      const zWarp = Math.cos(t * 2) * 0.00065;

      positions.push(
        outer.x,
        outer.y,
        z + zWarp
      );

      positions.push(
        inner.x,
        inner.y,
        z - 0.0011 + zWarp * 0.4
      );
    }

    for (let i = 0; i < segments; i++) {
      const ni = (i + 1) % segments;

      const o0 = i * 2;
      const i0 = i * 2 + 1;
      const o1 = ni * 2;
      const i1 = ni * 2 + 1;

      indices.push(o0, o1, i1, o0, i1, i0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeTube(points, radius, tubularSegments = 8, radialSegments = 5) {
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
      0.5
    );

    return new THREE.TubeGeometry(
      curve,
      tubularSegments,
      radius,
      radialSegments,
      false
    );
  }

  function makeDomedPatchGeometry(rx, ry, bulge, segments = 12) {
    const positions = [0, 0, bulge];
    const indices = [];

    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const wobble =
        1 +
        0.055 * Math.sin(t * 3 + 0.7) +
        0.025 * Math.sin(t * 5);

      positions.push(
        Math.cos(t) * rx * wobble,
        Math.sin(t) * ry * wobble,
        0
      );
    }

    for (let i = 0; i < segments; i++) {
      indices.push(
        0,
        i + 1,
        ((i + 1) % segments) + 1
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addPatch({
    stage,
    material,
    position,
    rx,
    ry,
    bulge,
    rotation = new THREE.Euler(),
    parent = root
  }) {
    const mesh = new THREE.Mesh(
      makeDomedPatchGeometry(rx, ry, bulge),
      material
    );

    mesh.position.copy(position);
    mesh.rotation.copy(rotation);

    return registerMesh(stage, mesh, parent);
  }

  function makeToothGeometry(
    width,
    height,
    depth,
    endScale = 0.8,
    direction = -1,
    segments = 8
  ) {
    const positions = [];
    const indices = [];

    const midScale = 0.92;
    const y0 = 0;
    const y1 = direction * height * 0.62;
    const y2 = direction * height;

    for (let ring = 0; ring < 3; ring++) {
      const yy = ring === 0 ? y0 : ring === 1 ? y1 : y2;
      const scale =
        ring === 0 ? 1 :
        ring === 1 ? midScale :
        endScale;

      for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;

        const asym =
          1 +
          0.035 * Math.sin(t * 3 + width * 900) +
          0.018 * Math.sin(t * 5);

        positions.push(
          Math.cos(t) * width * 0.5 * scale * asym,
          yy,
          Math.sin(t) * depth * 0.5 * scale
        );
      }
    }

    for (let ring = 0; ring < 2; ring++) {
      const a = ring * segments;
      const b = (ring + 1) * segments;

      for (let i = 0; i < segments; i++) {
        const ni = (i + 1) % segments;

        indices.push(
          a + i,
          a + ni,
          b + ni,
          a + i,
          b + ni,
          b + i
        );
      }
    }

    const gumCenter = positions.length / 3;
    positions.push(0, y0, 0);

    const endCenter = positions.length / 3;
    positions.push(0, y2, 0);

    for (let i = 0; i < segments; i++) {
      const ni = (i + 1) % segments;

      indices.push(
        gumCenter,
        ni,
        i
      );

      const e0 = 2 * segments + i;
      const e1 = 2 * segments + ni;

      indices.push(
        endCenter,
        e0,
        e1
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function deformHeadVertex(source) {
    const nx = source.x;
    const ny = source.y;
    const nz = source.z;

    let x = nx * 0.074;
    let y = 0.001 + ny * 0.095;
    let z = -0.006 + nz * 0.078;

    // Human jaw narrows below the cheekbones.
    if (ny < -0.22) {
      const amount = Math.min(1, (-ny - 0.22) / 0.78);
      x *= 1 - amount * 0.16;
    }

    // Forehead / midface are not a perfect ellipsoid.
    if (nz > 0) {
      z +=
        0.0044 *
        nz *
        nz *
        (1 - Math.min(0.7, Math.abs(ny) * 0.56));
    }

    // Chin shifts forward.
    if (ny < -0.43) {
      z +=
        0.020 *
        Math.pow((-ny - 0.43) / 0.57, 1.18);
    }

    // Slight cheek projection.
    const cheek =
      Math.exp(-Math.pow((Math.abs(nx) - 0.42) / 0.22, 2)) *
      Math.exp(-Math.pow((ny + 0.12) / 0.34, 2)) *
      Math.max(0, nz);

    z += cheek * 0.0032;

    return new THREE.Vector3(x, y, z);
  }

  const JAW_PIVOT = new THREE.Vector3(0, -0.038, -0.003);

  function headEyeHole(x, y, z) {
    if (z < 0.035) return false;

    const centerX = x < 0 ? -0.0265 : 0.0265;
    const dx = x - centerX;
    const dy = y - 0.017;

    return (
      (dx * dx) / (0.0168 * 0.0168) +
        (dy * dy) / (0.0108 * 0.0108) <
      1
    );
  }

  function makeHeadPartGeometry(part) {
    const base = new THREE.SphereGeometry(1, 24, 16);
    const p = base.attributes.position;
    const idx = base.index.array;
    const out = [];

    const worldV = (i) =>
      deformHeadVertex(
        new THREE.Vector3(
          p.getX(i),
          p.getY(i),
          p.getZ(i)
        )
      );

    for (let i = 0; i < idx.length; i += 3) {
      let a = worldV(idx[i]);
      let b = worldV(idx[i + 1]);
      let c = worldV(idx[i + 2]);

      const cx = (a.x + b.x + c.x) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      const cz = (a.z + b.z + c.z) / 3;

      if (headEyeHole(cx, cy, cz)) continue;

      const lowerFront =
        cy < -0.031 &&
        cz > 0.008 &&
        Math.abs(cx) < 0.067;

      if (part === 'upper' && lowerFront) continue;
      if (part === 'lower' && !lowerFront) continue;

      if (part === 'lower') {
        a = a.clone().sub(JAW_PIVOT);
        b = b.clone().sub(JAW_PIVOT);
        c = c.clone().sub(JAW_PIVOT);
      }

      out.push(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z
      );
    }

    base.dispose();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(out, 3)
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function makeHairCapGeometry() {
    const base = new THREE.SphereGeometry(1, 20, 12);
    const p = base.attributes.position;
    const idx = base.index.array;
    const out = [];

    const hairV = (i) => {
      const source = new THREE.Vector3(
        p.getX(i),
        p.getY(i),
        p.getZ(i)
      );

      const v = deformHeadVertex(source);

      v.x *= 1.025;
      v.z =
        -0.006 +
        (v.z + 0.006) * 1.03;

      if (v.y > 0.035) {
        v.y += 0.0014;
      }

      return { source, v };
    };

    for (let i = 0; i < idx.length; i += 3) {
      const A = hairV(idx[i]);
      const B = hairV(idx[i + 1]);
      const C = hairV(idx[i + 2]);

      const sy =
        (A.source.y + B.source.y + C.source.y) / 3;

      const sz =
        (A.source.z + B.source.z + C.source.z) / 3;

      // Irregular but conservative hairline.
      const threshold =
        sz > 0.2 ? 0.34 :
        sz > -0.25 ? 0.17 :
        0.05;

      if (sy < threshold) continue;

      out.push(
        A.v.x, A.v.y, A.v.z,
        B.v.x, B.v.y, B.v.z,
        C.v.x, C.v.y, C.v.z
      );
    }

    base.dispose();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(out, 3)
    );
    geometry.computeVertexNormals();
    return geometry;
  }

  function makeNoseGeometry() {
    const p = [
      -0.0050,  0.031, 0.067,
       0.0050,  0.031, 0.067,

      -0.0070,  0.006, 0.072,
       0.0070,  0.006, 0.072,

      -0.0130, -0.014, 0.073,
       0.0130, -0.014, 0.073,

       0.0000, -0.007, 0.091,
       0.0000, -0.020, 0.084,

      -0.0085, -0.021, 0.074,
       0.0085, -0.021, 0.074,

       0.0000,  0.029, 0.076,
       0.0000,  0.006, 0.081
    ];

    const idx = [
      0, 1, 10,
      0, 10, 2,
      1, 3, 10,

      2, 10, 11,
      10, 3, 11,

      2, 11, 4,
      3, 5, 11,

      4, 11, 6,
      11, 5, 6,

      4, 6, 8,
      5, 9, 6,

      8, 6, 7,
      6, 9, 7,

      8, 7, 9,

      0, 2, 4,
      0, 4, 8,

      1, 5, 3,
      1, 9, 5
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(p, 3)
    );
    geometry.setIndex(idx);
    geometry.computeVertexNormals();
    return geometry;
  }

  // ---------------------------------------------------------------------------
  // BASE SKULL
  // ---------------------------------------------------------------------------

  const cranium = registerMesh(
    0,
    new THREE.Mesh(makeCraniumGeometry(), boneMaterial)
  );
  cranium.name = 'Cranium';

  // Dark orbital funnels.
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(
      makeDishGeometry({
        cx: side * 0.0265,
        cy: 0.016,
        rx: 0.0212,
        ry: 0.0171,
        rimZ: 0.057,
        innerZ: 0.048,
        centerZ: 0.038,
        segments: 16,
        shape: orbitShape
      }),
      deepCavityMaterial
    );

    socket.name = side < 0 ? 'LeftOrbitSocket' : 'RightOrbitSocket';
    registerMesh(0, socket);
    sockets.push(socket);

    const rim = new THREE.Mesh(
      makeRimGeometry({
        cx: side * 0.0265,
        cy: 0.016,
        rx: 0.023,
        ry: 0.019,
        z: 0.059,
        thickness: 0.0031,
        segments: 16,
        shape: orbitShape
      }),
      boneMaterial
    );

    registerMesh(0, rim);
  }

  // Nasal aperture.
  const nasalCavity = registerMesh(
    0,
    new THREE.Mesh(
      makeDishGeometry({
        cx: 0,
        cy: -0.008,
        rx: 0.0108,
        ry: 0.021,
        rimZ: 0.057,
        innerZ: 0.049,
        centerZ: 0.040,
        segments: 14,
        shape: nasalShape
      }),
      deepCavityMaterial
    )
  );
  nasalCavity.name = 'NasalAperture';

  registerMesh(
    0,
    new THREE.Mesh(
      makeRimGeometry({
        cx: 0,
        cy: -0.008,
        rx: 0.0125,
        ry: 0.0225,
        z: 0.059,
        thickness: 0.0021,
        segments: 14,
        shape: nasalShape
      }),
      boneMaterial
    )
  );

  // Supraorbital / brow ridges.
  for (const side of [-1, 1]) {
    const brow = makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(side * 0.026, 0.036, 0.052),
      new THREE.Vector3(0.028, 0.0084, 0.0105),
      14,
      7,
      new THREE.Euler(0, side * 0.05, side * -0.09)
    );

    registerMesh(0, brow);

    const glabellaWing = makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(side * 0.009, 0.028, 0.053),
      new THREE.Vector3(0.009, 0.018, 0.008),
      12,
      6,
      new THREE.Euler(0, side * 0.08, side * 0.05)
    );

    registerMesh(0, glabellaWing);
  }

  // Glabella / upper nasal root.
  registerMesh(
    0,
    makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(0, 0.036, 0.049),
      new THREE.Vector3(0.012, 0.013, 0.010),
      12,
      6
    )
  );

  // Nasal bones.
  for (const side of [-1, 1]) {
    registerMesh(
      0,
      makeSphereMesh(
        boneMaterial,
        new THREE.Vector3(side * 0.0067, 0.007, 0.053),
        new THREE.Vector3(0.0058, 0.024, 0.007),
        12,
        6,
        new THREE.Euler(0, side * 0.06, side * 0.035)
      )
    );
  }

  // Zygomatic bodies and arches.
  for (const side of [-1, 1]) {
    const zygBody = makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(side * 0.043, -0.003, 0.044),
      new THREE.Vector3(0.017, 0.012, 0.015),
      12,
      7,
      new THREE.Euler(0, side * 0.16, side * 0.08)
    );
    registerMesh(0, zygBody);

    const archPoints = [
      new THREE.Vector3(side * 0.044, 0.004, 0.051),
      new THREE.Vector3(side * 0.053, -0.001, 0.043),
      new THREE.Vector3(side * 0.062, 0.005, 0.024),
      new THREE.Vector3(side * 0.064, 0.017, 0.001)
    ];

    registerMesh(
      0,
      new THREE.Mesh(
        makeTube(archPoints, 0.0035, 8, 5),
        boneMaterial
      )
    );
  }

  // Temporal plates / cranial base reinforcement.
  for (const side of [-1, 1]) {
    registerMesh(
      0,
      makeSphereMesh(
        boneMaterial,
        new THREE.Vector3(side * 0.060, 0.015, -0.011),
        new THREE.Vector3(0.0125, 0.028, 0.022),
        12,
        7,
        new THREE.Euler(0, 0, side * 0.055)
      )
    );

    registerMesh(
      0,
      makeSphereMesh(
        boneMaterial,
        new THREE.Vector3(side * 0.056, -0.018, -0.004),
        new THREE.Vector3(0.008, 0.015, 0.008),
        10,
        6
      )
    );
  }

  // Maxillae surrounding the aperture.
  for (const side of [-1, 1]) {
    registerMesh(
      0,
      makeSphereMesh(
        boneMaterial,
        new THREE.Vector3(side * 0.020, -0.023, 0.046),
        new THREE.Vector3(0.027, 0.022, 0.023),
        12,
        7,
        new THREE.Euler(0, side * 0.08, side * -0.03)
      )
    );
  }

  // Upper alveolar ridge.
  registerMesh(
    0,
    makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(0, -0.038, 0.056),
      new THREE.Vector3(0.038, 0.011, 0.019),
      14,
      7
    )
  );

  // Small anterior nasal spine.
  const nasalSpineGeo = new THREE.BufferGeometry();
  nasalSpineGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -0.003, -0.028, 0.061,
         0.003, -0.028, 0.061,
         0.000, -0.032, 0.071,

        -0.003, -0.028, 0.061,
         0.000, -0.032, 0.071,
         0.000, -0.029, 0.057,

         0.003, -0.028, 0.061,
         0.000, -0.029, 0.057,
         0.000, -0.032, 0.071
      ],
      3
    )
  );
  nasalSpineGeo.computeVertexNormals();
  registerMesh(
    0,
    new THREE.Mesh(nasalSpineGeo, boneMaterial)
  );

  // Upper teeth: incisors -> canine -> premolars -> first molar.
  const upperDistances = [
    0.0030,
    0.0086,
    0.0142,
    0.0200,
    0.0260,
    0.0325
  ];

  const upperWidths = [
    0.0058,
    0.0051,
    0.0053,
    0.0054,
    0.0056,
    0.0062
  ];

  const upperHeights = [
    0.0104,
    0.0095,
    0.0110,
    0.0088,
    0.0085,
    0.0079
  ];

  for (const side of [-1, 1]) {
    for (let i = 0; i < upperDistances.length; i++) {
      const x = side * upperDistances[i];
      const canine = i === 2;

      const tooth = new THREE.Mesh(
        makeToothGeometry(
          upperWidths[i],
          upperHeights[i],
          i < 2 ? 0.0048 : 0.0058,
          canine ? 0.34 : i === 5 ? 0.88 : 0.76,
          -1
        ),
        boneMaterial
      );

      tooth.position.set(
        x,
        -0.039,
        0.0715 - Math.abs(x) * 0.19
      );

      tooth.rotation.y = side * -(0.025 + i * 0.025);
      tooth.rotation.z = side * (i === 2 ? -0.025 : 0);

      registerMesh(0, tooth);
    }
  }

  // ---------------------------------------------------------------------------
  // MANDIBLE
  // ---------------------------------------------------------------------------

  const jaw = new THREE.Group();
  jaw.name = 'MandiblePivot';
  jaw.position.copy(JAW_PIVOT);
  jaw.rotation.order = 'XYZ';
  root.add(jaw);

  const jawCurvePoints = [
    new THREE.Vector3(-0.052, 0.001, 0.000),
    new THREE.Vector3(-0.051, -0.025, 0.010),
    new THREE.Vector3(-0.043, -0.042, 0.030),
    new THREE.Vector3(-0.025, -0.049, 0.042),
    new THREE.Vector3( 0.000, -0.052, 0.048),
    new THREE.Vector3( 0.025, -0.049, 0.042),
    new THREE.Vector3( 0.043, -0.042, 0.030),
    new THREE.Vector3( 0.051, -0.025, 0.010),
    new THREE.Vector3( 0.052, 0.001, 0.000)
  ];

  const jawBody = new THREE.Mesh(
    makeTube(jawCurvePoints, 0.0060, 14, 5),
    boneMaterial
  );
  registerMesh(0, jawBody, jaw);

  // Rami.
  for (const side of [-1, 1]) {
    const ramus = makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(side * 0.048, -0.018, 0.010),
      new THREE.Vector3(0.0095, 0.025, 0.008),
      12,
      7,
      new THREE.Euler(0, side * 0.08, side * 0.075)
    );
    registerMesh(0, ramus, jaw);

    const condyle = makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(side * 0.052, 0.002, -0.001),
      new THREE.Vector3(0.0083, 0.0058, 0.0065),
      10,
      6
    );
    registerMesh(0, condyle, jaw);

    const coronoid = makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(side * 0.041, 0.005, 0.018),
      new THREE.Vector3(0.0055, 0.014, 0.005),
      10,
      6,
      new THREE.Euler(0, 0, side * -0.16)
    );
    registerMesh(0, coronoid, jaw);
  }

  // Lower alveolar arch.
  registerMesh(
    0,
    makeSphereMesh(
      boneMaterial,
      new THREE.Vector3(0, -0.016, 0.048),
      new THREE.Vector3(0.037, 0.011, 0.018),
      14,
      7
    ),
    jaw
  );

  // Lower teeth.
  const lowerDistances = [
    0.0027,
    0.0077,
    0.0128,
    0.0186,
    0.0247
  ];

  for (const side of [-1, 1]) {
    for (let i = 0; i < lowerDistances.length; i++) {
      const x = side * lowerDistances[i];

      const tooth = new THREE.Mesh(
        makeToothGeometry(
          i < 2 ? 0.0045 : 0.0050,
          i === 2 ? 0.0083 : 0.0077,
          i < 2 ? 0.0043 : 0.0054,
          i === 2 ? 0.48 : 0.79,
          1
        ),
        boneMaterial
      );

      tooth.position.set(
        x,
        -0.017,
        0.0645 - Math.abs(x) * 0.16
      );

      tooth.rotation.y = side * -(0.018 + i * 0.025);
      registerMesh(0, tooth, jaw);
    }
  }

  const jawMount = new THREE.Object3D();
  jawMount.name = 'JawMount';
  jawMount.position.set(0, -0.030, 0.030);
  jawMount.rotation.set(0, 0, 0);
  jaw.add(jawMount);

  // ---------------------------------------------------------------------------
  // EYES
  // ---------------------------------------------------------------------------

  function createEye(name, x, stage) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0.0165, 0.0605);
    pivot.rotation.order = 'YXZ';
    root.add(pivot);

    const sclera = makeSphereMesh(
      scleraMaterial,
      new THREE.Vector3(),
      new THREE.Vector3(0.0113, 0.0100, 0.0095),
      14,
      8
    );
    sclera.name = `${name}_Sclera`;
    registerMesh(stage, sclera, pivot);

    const iris = new THREE.Mesh(
      new THREE.CircleGeometry(0.00425, 14),
      irisMaterial
    );
    iris.name = `${name}_Iris`;
    iris.position.z = 0.00945;
    registerMesh(stage, iris, pivot);

    const pupil = new THREE.Mesh(
      new THREE.CircleGeometry(0.00182, 12),
      pupilMaterial
    );
    pupil.name = `${name}_Pupil`;
    pupil.position.z = 0.00970;
    registerMesh(stage, pupil, pivot);

    const cornea = makeSphereMesh(
      corneaMaterial,
      new THREE.Vector3(0, 0, 0.00925),
      new THREE.Vector3(0.0049, 0.0049, 0.00175),
      10,
      6
    );
    cornea.name = `${name}_Cornea`;
    registerMesh(stage, cornea, pivot);

    /*
     * Couple the primary stage mesh to its pivot group's visibility.
     * This preserves:
     *   - eyeL/eyeR initially visible === false
     *   - stageSets containing only meshes
     *   - ordinary stageSets[n].forEach(m => m.visible = true) revealing eyes
     */
    let scleraVisible = sclera.visible;

    Object.defineProperty(sclera, 'visible', {
      configurable: true,
      enumerable: true,
      get() {
        return scleraVisible;
      },
      set(v) {
        scleraVisible = !!v;
        pivot.visible = scleraVisible;
      }
    });

    pivot.visible = false;
    pivot.userData.stage = stage;
    pivot.userData.sclera = sclera;
    pivot.userData.iris = iris;
    pivot.userData.pupil = pupil;
    pivot.userData.cornea = cornea;

    return pivot;
  }

  const eyeL = createEye('EyeL', -0.0265, 2);
  const eyeR = createEye('EyeR',  0.0265, 3);

  // ---------------------------------------------------------------------------
  // STAGE 1 — MUSCLE
  // ---------------------------------------------------------------------------

  addPatch({
    stage: 1,
    material: muscleMaterial,
    position: new THREE.Vector3(-0.064, 0.028, 0.003),
    rx: 0.018,
    ry: 0.025,
    bulge: 0.004,
    rotation: new THREE.Euler(0, -Math.PI * 0.50, -0.05)
  });

  addPatch({
    stage: 1,
    material: muscleMaterial,
    position: new THREE.Vector3(0.064, 0.028, 0.003),
    rx: 0.018,
    ry: 0.025,
    bulge: 0.004,
    rotation: new THREE.Euler(0, Math.PI * 0.50, 0.05)
  });

  addPatch({
    stage: 1,
    material: muscleMaterial,
    position: new THREE.Vector3(-0.041, -0.009, 0.061),
    rx: 0.013,
    ry: 0.018,
    bulge: 0.0033,
    rotation: new THREE.Euler(0.05, -0.24, 0.12)
  });

  addPatch({
    stage: 1,
    material: muscleMaterial,
    position: new THREE.Vector3(0.038, 0.010, 0.060),
    rx: 0.010,
    ry: 0.014,
    bulge: 0.0030,
    rotation: new THREE.Euler(-0.03, 0.18, -0.15)
  });

  // Masseter patches move with the jaw.
  addPatch({
    stage: 1,
    material: muscleMaterial,
    position: new THREE.Vector3(-0.050, -0.020, 0.022),
    rx: 0.013,
    ry: 0.020,
    bulge: 0.0042,
    rotation: new THREE.Euler(0.03, -1.08, -0.07),
    parent: jaw
  });

  addPatch({
    stage: 1,
    material: muscleMaterial,
    position: new THREE.Vector3(0.050, -0.020, 0.022),
    rx: 0.013,
    ry: 0.020,
    bulge: 0.0042,
    rotation: new THREE.Euler(0.03, 1.08, 0.07),
    parent: jaw
  });

  addPatch({
    stage: 1,
    material: tendonMaterial,
    position: new THREE.Vector3(0.009, -0.023, 0.069),
    rx: 0.007,
    ry: 0.011,
    bulge: 0.0018,
    rotation: new THREE.Euler(0.08, 0.04, -0.14)
  });

  // ---------------------------------------------------------------------------
  // STAGE 2 — CREEPING SKIN + FIRST EYE
  // ---------------------------------------------------------------------------

  addPatch({
    stage: 2,
    material: patchSkinMaterial,
    position: new THREE.Vector3(-0.022, 0.060, 0.061),
    rx: 0.024,
    ry: 0.019,
    bulge: 0.0035,
    rotation: new THREE.Euler(-0.13, -0.05, 0.07)
  });

  addPatch({
    stage: 2,
    material: patchSkinMaterial,
    position: new THREE.Vector3(-0.043, -0.008, 0.066),
    rx: 0.018,
    ry: 0.021,
    bulge: 0.0040,
    rotation: new THREE.Euler(0.03, -0.21, 0.12)
  });

  addPatch({
    stage: 2,
    material: patchSkinMaterial,
    position: new THREE.Vector3(-0.061, 0.028, 0.008),
    rx: 0.017,
    ry: 0.023,
    bulge: 0.0032,
    rotation: new THREE.Euler(0, -1.34, -0.03)
  });

  addPatch({
    stage: 2,
    material: patchSkinMaterial,
    position: new THREE.Vector3(-0.014, -0.018, 0.071),
    rx: 0.012,
    ry: 0.012,
    bulge: 0.0027,
    rotation: new THREE.Euler(0.03, -0.08, 0.08)
  });

  // ---------------------------------------------------------------------------
  // STAGE 3 — SECOND EYE + MORE SKIN
  // ---------------------------------------------------------------------------

  addPatch({
    stage: 3,
    material: patchSkinMaterial,
    position: new THREE.Vector3(0.026, 0.057, 0.063),
    rx: 0.026,
    ry: 0.021,
    bulge: 0.0038,
    rotation: new THREE.Euler(-0.12, 0.05, -0.05)
  });

  addPatch({
    stage: 3,
    material: patchSkinMaterial,
    position: new THREE.Vector3(0.044, -0.006, 0.066),
    rx: 0.019,
    ry: 0.022,
    bulge: 0.0041,
    rotation: new THREE.Euler(0.03, 0.22, -0.10)
  });

  addPatch({
    stage: 3,
    material: patchSkinMaterial,
    position: new THREE.Vector3(0.061, 0.025, 0.007),
    rx: 0.017,
    ry: 0.023,
    bulge: 0.0032,
    rotation: new THREE.Euler(0, 1.34, 0.03)
  });

  addPatch({
    stage: 3,
    material: patchSkinMaterial,
    position: new THREE.Vector3(-0.004, -0.044, 0.073),
    rx: 0.026,
    ry: 0.011,
    bulge: 0.0030,
    rotation: new THREE.Euler(0.03, -0.02, 0.02)
  });

  addPatch({
    stage: 3,
    material: patchSkinMaterial,
    position: new THREE.Vector3(0.012, -0.013, 0.057),
    rx: 0.013,
    ry: 0.015,
    bulge: 0.0025,
    rotation: new THREE.Euler(0.02, 0.08, -0.06)
  });

  addPatch({
    stage: 3,
    material: patchSkinMaterial,
    position: new THREE.Vector3(0, -0.033, 0.060),
    rx: 0.023,
    ry: 0.010,
    bulge: 0.0026,
    rotation: new THREE.Euler(0.02, 0, 0),
    parent: jaw
  });

  // ---------------------------------------------------------------------------
  // STAGE 4 — HAIR + NOSE
  // ---------------------------------------------------------------------------

  const hairCap = new THREE.Mesh(
    makeHairCapGeometry(),
    hairMaterial
  );
  hairCap.name = 'ReconstructedHair';
  registerMesh(4, hairCap);

  const hairStrands = [
    [
      new THREE.Vector3(-0.048, 0.061, 0.058),
      new THREE.Vector3(-0.055, 0.044, 0.063),
      new THREE.Vector3(-0.060, 0.025, 0.057),
      new THREE.Vector3(-0.062, 0.005, 0.046)
    ],
    [
      new THREE.Vector3(-0.035, 0.072, 0.060),
      new THREE.Vector3(-0.044, 0.054, 0.068),
      new THREE.Vector3(-0.050, 0.032, 0.066)
    ],
    [
      new THREE.Vector3(0.047, 0.061, 0.058),
      new THREE.Vector3(0.055, 0.042, 0.063),
      new THREE.Vector3(0.060, 0.023, 0.056),
      new THREE.Vector3(0.062, 0.004, 0.045)
    ],
    [
      new THREE.Vector3(0.031, 0.073, 0.061),
      new THREE.Vector3(0.041, 0.053, 0.068),
      new THREE.Vector3(0.049, 0.030, 0.065)
    ]
  ];

  for (const strand of hairStrands) {
    registerMesh(
      4,
      new THREE.Mesh(
        makeTube(strand, 0.00115, 6, 4),
        hairMaterial
      )
    );
  }

  const nose = new THREE.Mesh(
    makeNoseGeometry(),
    noseSkinMaterial
  );
  nose.name = 'ReconstructedNose';
  registerMesh(4, nose);

  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(
      new THREE.CircleGeometry(1, 10),
      cavityMaterial
    );

    nostril.position.set(
      side * 0.0054,
      -0.0157,
      0.0855
    );

    nostril.scale.set(0.0025, 0.00135, 1);
    nostril.rotation.x = 0.62;
    nostril.rotation.z = side * 0.13;

    registerMesh(4, nostril);
  }

  // ---------------------------------------------------------------------------
  // STAGE 5 — COMPLETE NEUTRAL HEAD
  // ---------------------------------------------------------------------------

  const upperHead = new THREE.Mesh(
    makeHeadPartGeometry('upper'),
    skinMaterial
  );
  upperHead.name = 'CompleteHeadUpper';
  registerMesh(5, upperHead);

  const lowerHead = new THREE.Mesh(
    makeHeadPartGeometry('lower'),
    skinMaterial
  );
  lowerHead.name = 'CompleteHeadJaw';
  registerMesh(5, lowerHead, jaw);

  // Ears.
  for (const side of [-1, 1]) {
    const ear = makeSphereMesh(
      skinMaterial,
      new THREE.Vector3(side * 0.076, -0.002, -0.002),
      new THREE.Vector3(0.0085, 0.0195, 0.0060),
      12,
      6,
      new THREE.Euler(0, side * -0.09, side * 0.04)
    );
    registerMesh(5, ear);

    const earInset = makeSphereMesh(
      patchSkinMaterial,
      new THREE.Vector3(side * 0.078, -0.003, 0.002),
      new THREE.Vector3(0.0038, 0.0115, 0.0020),
      10,
      5,
      new THREE.Euler(0, side * -0.10, side * 0.04)
    );
    registerMesh(5, earInset);
  }

  // Thin, expressionless lips.
  const upperLip = makeSphereMesh(
    lipMaterial,
    new THREE.Vector3(0, -0.0352, 0.0752),
    new THREE.Vector3(0.018, 0.0025, 0.0034),
    12,
    6
  );
  registerMesh(5, upperLip);

  const lowerLipWorld = new THREE.Vector3(
    0,
    -0.0405,
    0.0750
  );

  const lowerLip = makeSphereMesh(
    lipMaterial,
    lowerLipWorld.clone().sub(JAW_PIVOT),
    new THREE.Vector3(0.0175, 0.0028, 0.0035),
    12,
    6
  );
  registerMesh(5, lowerLip, jaw);

  // Eyelid edges.
  for (const side of [-1, 1]) {
    const cx = side * 0.0265;

    const topLid = [
      new THREE.Vector3(cx - 0.0135, 0.0180, 0.0710),
      new THREE.Vector3(cx - 0.0070, 0.0240, 0.0720),
      new THREE.Vector3(cx,          0.0260, 0.0722),
      new THREE.Vector3(cx + 0.0070, 0.0240, 0.0720),
      new THREE.Vector3(cx + 0.0135, 0.0180, 0.0710)
    ];

    const lowerLid = [
      new THREE.Vector3(cx - 0.0130, 0.0160, 0.0708),
      new THREE.Vector3(cx - 0.0065, 0.0105, 0.0713),
      new THREE.Vector3(cx,          0.0092, 0.0715),
      new THREE.Vector3(cx + 0.0065, 0.0105, 0.0713),
      new THREE.Vector3(cx + 0.0130, 0.0160, 0.0708)
    ];

    registerMesh(
      5,
      new THREE.Mesh(
        makeTube(topLid, 0.00085, 6, 4),
        skinMaterial
      )
    );

    registerMesh(
      5,
      new THREE.Mesh(
        makeTube(lowerLid, 0.00070, 6, 4),
        skinMaterial
      )
    );

    const browPoints = [
      new THREE.Vector3(cx - 0.014, 0.035, 0.0718),
      new THREE.Vector3(cx - 0.006, 0.039, 0.0732),
      new THREE.Vector3(cx + 0.003, 0.0395, 0.0730),
      new THREE.Vector3(cx + 0.014, 0.0350, 0.0712)
    ];

    registerMesh(
      5,
      new THREE.Mesh(
        makeTube(browPoints, 0.0009, 6, 4),
        hairMaterial
      )
    );
  }

  // Philtrum shadows: tiny flesh ridges, deliberately neutral.
  for (const side of [-1, 1]) {
    const philtrum = makeSphereMesh(
      patchSkinMaterial,
      new THREE.Vector3(
        side * 0.0034,
        -0.027,
        0.0755
      ),
      new THREE.Vector3(0.0017, 0.0062, 0.0012),
      8,
      5,
      new THREE.Euler(0, 0, side * -0.10)
    );
    registerMesh(5, philtrum);
  }

  // Slight chin pad moves with the jaw.
  const chinPad = makeSphereMesh(
    skinMaterial,
    new THREE.Vector3(0, -0.047, 0.050),
    new THREE.Vector3(0.027, 0.013, 0.015),
    12,
    6
  );
  registerMesh(5, chinPad, jaw);

  // Everything reconstructed is hidden initially.
  for (let stage = 1; stage <= 5; stage++) {
    for (const mesh of stageSets[stage]) {
      mesh.visible = false;
    }
  }

  eyeL.visible = false;
  eyeR.visible = false;

  // Useful metadata without altering the requested return shape.
  let triangleCount = 0;

  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;

    const geometry = object.geometry;

    if (geometry.index) {
      triangleCount += geometry.index.count / 3;
    } else if (geometry.attributes.position) {
      triangleCount += geometry.attributes.position.count / 3;
    }

    object.castShadow = true;
    object.receiveShadow = true;
  });

  root.userData.triangleCount = Math.round(triangleCount);
  root.userData.nominalHeightMeters = 0.19;
  root.userData.forward = '+Z';
  root.userData.stageSetsAreAdditive = true;

  jaw.userData.closedRotationX = 0;
  jaw.userData.typicalOpenRotationX = 0.42;
  jaw.userData.maximumSuggestedRotationX = 0.62;

  return {
    root,
    jaw,
    jawMount,
    sockets,
    eyeL,
    eyeR,
    stageSets
  };
}

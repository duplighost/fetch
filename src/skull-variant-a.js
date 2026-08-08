// skull-variant-a.js — Pro farm submission A ("the anatomist").
// Procedural human skull: gaussian-deformed cranium, ringed orbital rims,
// tube zygomatic arches, per-tooth cusped geometry, lip ribbons with a
// cupid's bow. Verbatim from the courier drop, 2026-08-08.
import * as THREE from 'three';

const TAU = Math.PI * 2;

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian2(x, y, sx, sy) {
  return Math.exp(-((x * x) / (sx * sx) + (y * y) / (sy * sy)));
}

function triangleCount(geometry) {
  if (!geometry) return 0;
  if (geometry.index) return geometry.index.count / 3;
  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}

function makeMaterial(parameters) {
  return new THREE.MeshStandardMaterial({
    metalness: 0,
    ...parameters,
  });
}

function createCraniumGeometry() {
  const geometry = new THREE.SphereGeometry(1, 26, 16);
  const position = geometry.getAttribute('position');
  const v = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    const nx = v.x;
    const ny = v.y;
    const nz = v.z;

    const lower = Math.max(0, -ny);
    const temple = gaussian2(ny + 0.12, nz - 0.12, 0.42, 0.58)
      * Math.pow(Math.abs(nx), 1.55);
    const sideTaper = 1 - 0.095 * lower * lower - 0.085 * temple;

    let x = nx * 0.066 * sideTaper;
    let y = 0.020 + ny * 0.079;
    let z;

    if (nz >= 0) {
      const foreheadRound = 0.86 + 0.10 * smoothstep(-0.05, 0.88, ny);
      const lowerFaceCut = 1 - 0.18 * smoothstep(-0.75, -0.05, -ny);
      z = -0.010 + nz * 0.079 * foreheadRound * lowerFaceCut;
    } else {
      const occipital = 1 + 0.065 * gaussian2(ny + 0.20, nz + 0.78, 0.55, 0.52);
      z = -0.010 + nz * 0.082 * occipital;
    }

    const asymmetry = 0.00032 * Math.sin(13 * nx + 7 * ny - 9 * nz)
      + 0.00016 * Math.sin(31 * nx * ny + 4 * nz);
    x += asymmetry * 0.35;
    y += asymmetry * 0.22;
    z += asymmetry;

    position.setXYZ(i, x, y, z);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createHeadShellGeometry() {
  const geometry = new THREE.SphereGeometry(1, 22, 13, 0, TAU, 0, Math.PI * 0.78);
  const position = geometry.getAttribute('position');
  const v = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    const nx = v.x;
    const ny = v.y;
    const nz = v.z;

    const lower = smoothstep(0.02, 0.83, -ny);
    const widthScale = 1 - 0.20 * Math.pow(lower, 1.18);
    let x = nx * 0.073 * widthScale;
    let y = 0.009 + ny * 0.092;

    let frontRadius = nz > 0 ? 0.098 : 0.091;

    if (nz > 0) {
      frontRadius *= 0.96 - 0.065 * lower;

      const preliminaryX = nx * 0.073 * widthScale;
      const preliminaryY = y;

      const eyeDentL = gaussian2(
        preliminaryX + 0.027,
        preliminaryY - 0.014,
        0.017,
        0.011,
      );
      const eyeDentR = gaussian2(
        preliminaryX - 0.027,
        preliminaryY - 0.014,
        0.017,
        0.011,
      );
      const cheekL = gaussian2(
        preliminaryX + 0.040,
        preliminaryY + 0.006,
        0.022,
        0.023,
      );
      const cheekR = gaussian2(
        preliminaryX - 0.040,
        preliminaryY + 0.006,
        0.022,
        0.023,
      );
      const mouthPlane = gaussian2(
        preliminaryX,
        preliminaryY + 0.047,
        0.036,
        0.017,
      );

      frontRadius += 0.0028 * (cheekL + cheekR)
        - 0.0062 * (eyeDentL + eyeDentR)
        - 0.0022 * mouthPlane;
    }

    let z = -0.004 + nz * frontRadius;

    const asymmetry = 0.00025 * Math.sin(11 * nx - 17 * ny + 5 * nz);
    x += asymmetry * 0.25;
    y += asymmetry * 0.15;
    z += asymmetry;

    position.setXYZ(i, x, y, z);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createJawSkinGeometry() {
  const geometry = new THREE.SphereGeometry(1, 14, 8);
  const position = geometry.getAttribute('position');
  const v = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();

    const nx = v.x;
    const ny = v.y;
    const nz = v.z;
    const topness = (ny + 1) * 0.5;
    const width = 0.043 + 0.014 * topness;

    const x = nx * width;
    const y = ny * 0.030;
    const frontScale = nz > 0 ? 0.056 : 0.040;
    const z = nz * frontScale
      + (nz > 0 ? 0.0018 * (1 - Math.abs(nx)) : 0);

    position.setXYZ(i, x, y, z);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createEllipticalRingGeometry({
  outerX,
  outerY,
  innerX,
  innerY,
  depth,
  segments = 18,
  start = 0,
  end = TAU,
  shape = null,
}) {
  const vertices = [];
  const indices = [];
  const span = end - start;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const a = start + span * t;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const scale = shape ? shape(a) : 1;

    const ox = c * outerX * scale;
    const oy = s * outerY;
    const ix = c * innerX * scale;
    const iy = s * innerY;

    vertices.push(
      ox, oy, depth * 0.5,
      ix, iy, depth * 0.5,
      ox, oy, -depth * 0.5,
      ix, iy, -depth * 0.5,
    );
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 4;
    const b = (i + 1) * 4;

    indices.push(
      a, b, a + 1,
      b, b + 1, a + 1,

      a + 2, a + 3, b + 2,
      b + 2, a + 3, b + 3,

      a, a + 2, b,
      b, a + 2, b + 2,

      a + 1, b + 1, a + 3,
      b + 1, b + 3, a + 3,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createEllipticalBandGeometry({
  outerX,
  outerY,
  innerX,
  innerY,
  segments = 12,
  start = 0,
  end = Math.PI,
  arch = 0,
}) {
  const vertices = [];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const a = THREE.MathUtils.lerp(start, end, t);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const z = arch * Math.sin(Math.PI * t);

    vertices.push(
      c * outerX, s * outerY, z,
      c * innerX, s * innerY, z + 0.0002,
    );
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    const b = (i + 1) * 2;

    indices.push(
      a, b, a + 1,
      b, b + 1, a + 1,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createConcaveDiscGeometry(
  rx,
  ry,
  depth,
  segments = 18,
  shape = null,
) {
  const vertices = [0, 0, -depth];
  const indices = [];

  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * TAU;
    const scale = shape ? shape(a) : 1;

    vertices.push(
      Math.cos(a) * rx * scale,
      Math.sin(a) * ry,
      0,
    );
  }

  for (let i = 0; i < segments; i += 1) {
    indices.push(
      0,
      i + 1,
      ((i + 1) % segments) + 1,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createCreepingPatchGeometry(
  rx,
  ry,
  seed,
  segments = 12,
) {
  const vertices = [0, 0, 0.0021];
  const indices = [];

  for (let ring = 0; ring < 2; ring += 1) {
    const baseRadius = ring === 0 ? 0.54 : 1;
    const z = ring === 0 ? 0.0014 : 0;

    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * TAU;
      const wobble = 1
        + 0.13 * Math.sin(a * 3 + seed * 1.7)
        + 0.07 * Math.sin(a * 7 - seed * 0.9);
      const radius = baseRadius * (ring === 0 ? 1 : wobble);

      vertices.push(
        Math.cos(a) * rx * radius,
        Math.sin(a) * ry * radius,
        z,
      );
    }
  }

  const innerStart = 1;
  const outerStart = 1 + segments;

  for (let i = 0; i < segments; i += 1) {
    const ni = (i + 1) % segments;

    indices.push(
      0,
      innerStart + i,
      innerStart + ni,
    );

    indices.push(
      innerStart + i,
      outerStart + i,
      innerStart + ni,

      innerStart + ni,
      outerStart + i,
      outerStart + ni,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createToothGeometry(
  width,
  depth,
  height,
  upper,
  kind = 'incisor',
) {
  const segments = 8;
  const vertices = [];
  const indices = [];

  const direction = upper ? -1 : 1;
  const rootY = -direction * height * 0.5;
  const neckY = -direction * height * 0.08;
  const crownBaseY = direction * height * 0.5;

  const cuspStrength = kind === 'canine'
    ? 0.0014
    : kind === 'molar'
      ? 0.00055
      : 0.00025;

  const squareness = kind === 'molar'
    ? 0.15
    : kind === 'incisor'
      ? 0.08
      : 0.03;

  const rings = [
    {
      y: rootY,
      rx: width * 0.29,
      rz: depth * 0.28,
    },
    {
      y: neckY,
      rx: width * 0.41,
      rz: depth * 0.39,
    },
    {
      y: crownBaseY,
      rx: width * 0.50,
      rz: depth * 0.50,
    },
  ];

  for (let r = 0; r < rings.length; r += 1) {
    const ring = rings[r];

    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * TAU;
      const block = 1 + squareness * Math.cos(4 * a);
      const cusp = r === 2
        ? direction
          * cuspStrength
          * (
            0.30
            + 0.70
            * Math.max(
              0,
              Math.cos((kind === 'molar' ? 4 : 2) * a),
            )
          )
        : 0;

      vertices.push(
        Math.cos(a) * ring.rx * block,
        ring.y + cusp,
        Math.sin(a) * ring.rz * block,
      );
    }
  }

  for (let r = 0; r < rings.length - 1; r += 1) {
    const aStart = r * segments;
    const bStart = (r + 1) * segments;

    for (let i = 0; i < segments; i += 1) {
      const ni = (i + 1) % segments;

      if (upper) {
        indices.push(
          aStart + i,
          aStart + ni,
          bStart + i,

          aStart + ni,
          bStart + ni,
          bStart + i,
        );
      } else {
        indices.push(
          aStart + i,
          bStart + i,
          aStart + ni,

          aStart + ni,
          bStart + i,
          bStart + ni,
        );
      }
    }
  }

  const crownCenter = vertices.length / 3;
  vertices.push(
    0,
    direction * (height * 0.5 + cuspStrength * 0.38),
    0,
  );

  const crownStart = (rings.length - 1) * segments;

  for (let i = 0; i < segments; i += 1) {
    const ni = (i + 1) % segments;

    if (upper) {
      indices.push(
        crownCenter,
        crownStart + i,
        crownStart + ni,
      );
    } else {
      indices.push(
        crownCenter,
        crownStart + ni,
        crownStart + i,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createWedgeGeometry(width, height, depth) {
  const w = width * 0.5;
  const h = height * 0.5;
  const d = depth * 0.5;

  const vertices = [
    -w, h, d,
    w, h, d,
    0, -h, d,

    -w, h, -d,
    w, h, -d,
    0, -h, -d,
  ];

  const indices = [
    0, 2, 1,
    3, 4, 5,

    0, 1, 3,
    1, 4, 3,

    0, 3, 2,
    3, 5, 2,

    1, 2, 4,
    2, 5, 4,
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createHairCapGeometry(
  radialSegments = 18,
  verticalSegments = 7,
) {
  const vertices = [0, 0.104, -0.006];
  const indices = [];

  for (let j = 1; j <= verticalSegments; j += 1) {
    const t = j / verticalSegments;

    for (let i = 0; i < radialSegments; i += 1) {
      const phi = (i / radialSegments) * TAU;
      const front = Math.max(0, Math.sin(phi));
      const thetaEnd = THREE.MathUtils.lerp(
        1.49,
        0.96,
        front * front,
      );
      const theta = thetaEnd * t;
      const noise = 1
        + 0.012 * Math.sin(phi * 7 + t * 11)
        + 0.007 * Math.sin(phi * 13 - t * 5);

      const st = Math.sin(theta);
      const ct = Math.cos(theta);

      vertices.push(
        Math.cos(phi) * st * 0.076 * noise,
        0.009 + ct * 0.095 * noise,
        -0.006 + Math.sin(phi) * st * 0.094 * noise,
      );
    }
  }

  for (let i = 0; i < radialSegments; i += 1) {
    indices.push(
      0,
      1 + i,
      1 + ((i + 1) % radialSegments),
    );
  }

  for (let j = 0; j < verticalSegments - 1; j += 1) {
    const aStart = 1 + j * radialSegments;
    const bStart = aStart + radialSegments;

    for (let i = 0; i < radialSegments; i += 1) {
      const ni = (i + 1) % radialSegments;

      indices.push(
        aStart + i,
        bStart + i,
        aStart + ni,

        aStart + ni,
        bStart + i,
        bStart + ni,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function createLipRibbonGeometry(
  width,
  height,
  upper,
  segments = 12,
) {
  const vertices = [];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const x = (t - 0.5) * width;
    const normalizedX = x / (width * 0.5);

    const cupid = upper
      ? 0.00125 * (
        Math.exp(
          -Math.pow((normalizedX - 0.24) / 0.22, 2),
        )
        + Math.exp(
          -Math.pow((normalizedX + 0.24) / 0.22, 2),
        )
        - 0.55
        * Math.exp(
          -Math.pow(normalizedX / 0.18, 2),
        )
      )
      : -0.00045 * normalizedX * normalizedX;

    const edgeFade = Math.pow(
      Math.max(0, 1 - normalizedX * normalizedX),
      0.65,
    );
    const half = height * 0.5 * edgeFade;

    vertices.push(
      x,
      cupid + half,
      0.00055 * edgeFade,

      x,
      cupid - half,
      0,
    );
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    const b = (i + 1) * 2;

    indices.push(
      a, b, a + 1,
      b, b + 1, a + 1,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function setMeshDefaults(mesh, name) {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = true;

  return mesh;
}

/**
 * Procedurally builds a roughly life-size human skull and its five
 * flesh-growth stages. The skull faces +Z. Positive jaw.rotation.x opens
 * the mandible down and back.
 */
export function buildSkullMesh(boneMaterial) {
  if (!boneMaterial || boneMaterial.isMaterial !== true) {
    throw new TypeError(
      'buildSkullMesh(boneMaterial) requires a THREE.Material.',
    );
  }

  const root = new THREE.Group();
  root.name = 'proceduralHumanSkull';
  root.userData.heightMeters = 0.19;
  root.userData.faceDirection = '+Z';
  root.userData.stageSetsAreIncremental = true;

  const jaw = new THREE.Group();
  jaw.name = 'mandiblePivot';
  jaw.position.set(0, -0.018, 0);
  jaw.rotation.order = 'XYZ';
  jaw.userData.openAxis = 'x';
  jaw.userData.openDirection = 1;
  jaw.userData.suggestedOpenRange = [0, 0.68];
  root.add(jaw);

  const jawMount = new THREE.Object3D();
  jawMount.name = 'jawMount';
  jawMount.position.set(0, -0.025, 0.066);
  jawMount.userData.clampForward = '+Z';
  jaw.add(jawMount);

  const stageSets = Array.from(
    { length: 6 },
    () => [],
  );
  const allMeshes = [];

  function register(mesh, stage = 0) {
    setMeshDefaults(
      mesh,
      mesh.name || `stage${stage}Mesh`,
    );

    mesh.visible = stage === 0;
    stageSets[stage].push(mesh);
    allMeshes.push(mesh);

    return mesh;
  }

  function meshFrom(
    geometry,
    material,
    name,
    parent = root,
    stage = 0,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    parent.add(mesh);

    return register(mesh, stage);
  }

  const socketMaterial = makeMaterial({
    color: 0x05070a,
    roughness: 0.98,
    side: THREE.BackSide,
  });

  const voidMaterial = makeMaterial({
    color: 0x040507,
    roughness: 1,
    side: THREE.DoubleSide,
  });

  const muscleMaterial = makeMaterial({
    color: 0x5f1718,
    roughness: 0.78,
  });

  const muscleLightMaterial = makeMaterial({
    color: 0x8b3029,
    roughness: 0.82,
  });

  const rawSkinMaterial = makeMaterial({
    color: 0x805448,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });

  const skinMaterial = makeMaterial({
    color: 0x9a6b5c,
    roughness: 0.78,
  });

  const skinShadowMaterial = makeMaterial({
    color: 0x68433d,
    roughness: 0.90,
    side: THREE.DoubleSide,
  });

  const lipMaterial = makeMaterial({
    color: 0x633a3d,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });

  const hairMaterial = makeMaterial({
    color: 0x171619,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });

  const scleraMaterial = makeMaterial({
    color: 0xd4d0c4,
    roughness: 0.38,
  });

  const irisMaterial = makeMaterial({
    color: 0x596762,
    roughness: 0.48,
  });

  const pupilMaterial = makeMaterial({
    color: 0x030405,
    roughness: 0.36,
  });

  const wetHighlightMaterial = makeMaterial({
    color: 0xf0eee8,
    roughness: 0.16,
    emissive: 0x111111,
    emissiveIntensity: 0.14,
  });

  const sphereCache = new Map();

  function sphereGeometry(widthSegments, heightSegments) {
    const key = `${widthSegments}x${heightSegments}`;

    if (!sphereCache.has(key)) {
      sphereCache.set(
        key,
        new THREE.SphereGeometry(
          1,
          widthSegments,
          heightSegments,
        ),
      );
    }

    return sphereCache.get(key);
  }

  function ellipsoid({
    name,
    parent = root,
    material = boneMaterial,
    stage = 0,
    position = [0, 0, 0],
    scale = [1, 1, 1],
    rotation = [0, 0, 0],
    segments = [12, 7],
  }) {
    const mesh = meshFrom(
      sphereGeometry(segments[0], segments[1]),
      material,
      name,
      parent,
      stage,
    );

    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);

    return mesh;
  }

  meshFrom(
    createCraniumGeometry(),
    boneMaterial,
    'cranium',
    root,
    0,
  );

  ellipsoid({
    name: 'temporalBoneL',
    position: [-0.058, 0.001, -0.006],
    scale: [0.010, 0.033, 0.037],
    rotation: [0.04, -0.08, -0.08],
  });

  ellipsoid({
    name: 'temporalBoneR',
    position: [0.058, 0.001, -0.006],
    scale: [0.010, 0.033, 0.037],
    rotation: [0.04, 0.08, 0.08],
  });

  ellipsoid({
    name: 'mastoidProcessL',
    position: [-0.052, -0.035, -0.026],
    scale: [0.008, 0.014, 0.010],
    rotation: [0.18, 0, -0.18],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'mastoidProcessR',
    position: [0.052, -0.035, -0.026],
    scale: [0.008, 0.014, 0.010],
    rotation: [0.18, 0, 0.18],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'browRidgeL',
    position: [-0.027, 0.037, 0.068],
    scale: [0.029, 0.0075, 0.010],
    rotation: [0.04, -0.06, -0.07],
    segments: [12, 6],
  });

  ellipsoid({
    name: 'browRidgeR',
    position: [0.027, 0.037, 0.068],
    scale: [0.029, 0.0075, 0.010],
    rotation: [0.04, 0.06, 0.07],
    segments: [12, 6],
  });

  const orbitalShape = (a) => (
    1
    + 0.045 * Math.cos(2 * a)
    - 0.035 * Math.sin(a)
  );

  const orbitGeometry = createEllipticalRingGeometry({
    outerX: 0.026,
    outerY: 0.022,
    innerX: 0.0193,
    innerY: 0.0157,
    depth: 0.0062,
    segments: 18,
    shape: orbitalShape,
  });

  const orbitalRimL = meshFrom(
    orbitGeometry,
    boneMaterial,
    'orbitalRimL',
    root,
    0,
  );
  orbitalRimL.position.set(
    -0.027,
    0.014,
    0.073,
  );
  orbitalRimL.rotation.z = -0.035;

  const orbitalRimR = meshFrom(
    orbitGeometry,
    boneMaterial,
    'orbitalRimR',
    root,
    0,
  );
  orbitalRimR.position.set(
    0.027,
    0.014,
    0.073,
  );
  orbitalRimR.rotation.z = 0.035;

  const socketL = ellipsoid({
    name: 'socketL',
    material: socketMaterial,
    position: [-0.027, 0.014, 0.064],
    scale: [0.0202, 0.0172, 0.018],
    segments: [12, 7],
  });

  const socketR = ellipsoid({
    name: 'socketR',
    material: socketMaterial,
    position: [0.027, 0.014, 0.064],
    scale: [0.0202, 0.0172, 0.018],
    segments: [12, 7],
  });

  const sockets = [socketL, socketR];

  ellipsoid({
    name: 'nasalBridge',
    position: [0, 0.004, 0.075],
    scale: [0.0085, 0.027, 0.0095],
    rotation: [-0.04, 0, 0],
    segments: [10, 6],
  });

  const nasalPear = (a) => (
    0.90 - 0.20 * Math.sin(a)
  );

  const nasalAperture = meshFrom(
    createConcaveDiscGeometry(
      0.0102,
      0.0182,
      0.010,
      18,
      nasalPear,
    ),
    voidMaterial,
    'nasalAperture',
    root,
    0,
  );
  nasalAperture.position.set(
    0,
    -0.020,
    0.083,
  );

  const nasalRim = meshFrom(
    createEllipticalRingGeometry({
      outerX: 0.0125,
      outerY: 0.0204,
      innerX: 0.0100,
      innerY: 0.0174,
      depth: 0.0042,
      segments: 18,
      shape: nasalPear,
    }),
    boneMaterial,
    'nasalRim',
    root,
    0,
  );
  nasalRim.position.set(
    0,
    -0.020,
    0.081,
  );

  const nasalSpine = meshFrom(
    createWedgeGeometry(
      0.0085,
      0.010,
      0.011,
    ),
    boneMaterial,
    'anteriorNasalSpine',
    root,
    0,
  );
  nasalSpine.position.set(
    0,
    -0.041,
    0.083,
  );
  nasalSpine.rotation.x = -0.10;

  ellipsoid({
    name: 'zygomaticBodyL',
    position: [-0.050, -0.006, 0.056],
    scale: [0.016, 0.025, 0.017],
    rotation: [-0.03, -0.30, -0.10],
  });

  ellipsoid({
    name: 'zygomaticBodyR',
    position: [0.050, -0.006, 0.056],
    scale: [0.016, 0.025, 0.017],
    rotation: [-0.03, 0.30, 0.10],
  });

  function zygomaticArch(side) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(
        side * 0.050,
        -0.004,
        0.061,
      ),
      new THREE.Vector3(
        side * 0.064,
        -0.006,
        0.038,
      ),
      new THREE.Vector3(
        side * 0.068,
        -0.008,
        0.006,
      ),
      new THREE.Vector3(
        side * 0.060,
        -0.012,
        -0.022,
      ),
    ]);

    const geometry = new THREE.TubeGeometry(
      curve,
      12,
      0.0036,
      5,
      false,
    );

    return meshFrom(
      geometry,
      boneMaterial,
      side < 0
        ? 'zygomaticArchL'
        : 'zygomaticArchR',
      root,
      0,
    );
  }

  zygomaticArch(-1);
  zygomaticArch(1);

  ellipsoid({
    name: 'maxillaL',
    position: [-0.021, -0.028, 0.059],
    scale: [0.027, 0.031, 0.020],
    rotation: [0.04, -0.05, -0.04],
  });

  ellipsoid({
    name: 'maxillaR',
    position: [0.021, -0.028, 0.059],
    scale: [0.027, 0.031, 0.020],
    rotation: [0.04, 0.05, 0.04],
  });

  const upperArchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(
      -0.050,
      -0.052,
      0.049,
    ),
    new THREE.Vector3(
      -0.035,
      -0.052,
      0.068,
    ),
    new THREE.Vector3(
      -0.017,
      -0.052,
      0.081,
    ),
    new THREE.Vector3(
      0,
      -0.052,
      0.085,
    ),
    new THREE.Vector3(
      0.017,
      -0.052,
      0.081,
    ),
    new THREE.Vector3(
      0.035,
      -0.052,
      0.068,
    ),
    new THREE.Vector3(
      0.050,
      -0.052,
      0.049,
    ),
  ]);

  meshFrom(
    new THREE.TubeGeometry(
      upperArchCurve,
      20,
      0.0043,
      5,
      false,
    ),
    boneMaterial,
    'upperAlveolarRidge',
    root,
    0,
  );

  const mouthCavity = ellipsoid({
    name: 'mouthCavity',
    material: socketMaterial,
    position: [0, -0.064, 0.061],
    scale: [0.042, 0.015, 0.017],
    segments: [12, 6],
  });
  mouthCavity.rotation.x = 0.03;

  const dentalHalf = [
    {
      x: 0.0040,
      z: 0.0840,
      width: 0.0076,
      depth: 0.0060,
      height: 0.0130,
      kind: 'incisor',
    },
    {
      x: 0.0118,
      z: 0.0828,
      width: 0.0065,
      depth: 0.0058,
      height: 0.0120,
      kind: 'incisor',
    },
    {
      x: 0.0190,
      z: 0.0795,
      width: 0.0073,
      depth: 0.0067,
      height: 0.0132,
      kind: 'canine',
    },
    {
      x: 0.0268,
      z: 0.0742,
      width: 0.0072,
      depth: 0.0074,
      height: 0.0110,
      kind: 'premolar',
    },
    {
      x: 0.0345,
      z: 0.0677,
      width: 0.0076,
      depth: 0.0079,
      height: 0.0104,
      kind: 'premolar',
    },
    {
      x: 0.0423,
      z: 0.0593,
      width: 0.0090,
      depth: 0.0097,
      height: 0.0096,
      kind: 'molar',
    },
    {
      x: 0.0496,
      z: 0.0498,
      width: 0.0090,
      depth: 0.0098,
      height: 0.0089,
      kind: 'molar',
    },
  ];

  for (const side of [-1, 1]) {
    dentalHalf.forEach((tooth, index) => {
      const mesh = meshFrom(
        createToothGeometry(
          tooth.width,
          tooth.depth,
          tooth.height,
          true,
          tooth.kind,
        ),
        boneMaterial,
        `upperTooth_${
          side < 0 ? 'L' : 'R'
        }_${index + 1}`,
        root,
        0,
      );

      mesh.position.set(
        side * tooth.x,
        -0.0587 + index * 0.00035,
        tooth.z,
      );

      mesh.rotation.y = (
        side * (index / 6) * 0.58
      );

      mesh.rotation.z = side * (
        index > 1
          ? 0.018 * index
          : 0.008 * index
      );
    });
  }

  const mandibularBodyCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(
      -0.054,
      -0.034,
      0.014,
    ),
    new THREE.Vector3(
      -0.049,
      -0.044,
      0.041,
    ),
    new THREE.Vector3(
      -0.031,
      -0.054,
      0.065,
    ),
    new THREE.Vector3(
      0,
      -0.059,
      0.078,
    ),
    new THREE.Vector3(
      0.031,
      -0.054,
      0.065,
    ),
    new THREE.Vector3(
      0.049,
      -0.044,
      0.041,
    ),
    new THREE.Vector3(
      0.054,
      -0.034,
      0.014,
    ),
  ]);

  meshFrom(
    new THREE.TubeGeometry(
      mandibularBodyCurve,
      24,
      0.0063,
      5,
      false,
    ),
    boneMaterial,
    'mandibularBody',
    jaw,
    0,
  );

  ellipsoid({
    name: 'mentalProtuberance',
    parent: jaw,
    position: [0, -0.057, 0.075],
    scale: [0.018, 0.018, 0.013],
    rotation: [-0.05, 0, 0],
  });

  ellipsoid({
    name: 'ramusL',
    parent: jaw,
    position: [-0.053, -0.018, 0.013],
    scale: [0.0085, 0.027, 0.0125],
    rotation: [-0.12, -0.05, -0.06],
    segments: [10, 6],
  });

  ellipsoid({
    name: 'ramusR',
    parent: jaw,
    position: [0.053, -0.018, 0.013],
    scale: [0.0085, 0.027, 0.0125],
    rotation: [-0.12, 0.05, 0.06],
    segments: [10, 6],
  });

  ellipsoid({
    name: 'condyleL',
    parent: jaw,
    position: [-0.053, 0.0015, 0.003],
    scale: [0.0105, 0.0068, 0.009],
    segments: [8, 5],
  });

  ellipsoid({
    name: 'condyleR',
    parent: jaw,
    position: [0.053, 0.0015, 0.003],
    scale: [0.0105, 0.0068, 0.009],
    segments: [8, 5],
  });

  const coronoidGeometry = createWedgeGeometry(
    0.013,
    0.025,
    0.007,
  );

  const coronoidL = meshFrom(
    coronoidGeometry,
    boneMaterial,
    'coronoidProcessL',
    jaw,
    0,
  );
  coronoidL.position.set(
    -0.045,
    -0.001,
    0.027,
  );
  coronoidL.rotation.z = -0.10;

  const coronoidR = meshFrom(
    coronoidGeometry,
    boneMaterial,
    'coronoidProcessR',
    jaw,
    0,
  );
  coronoidR.position.set(
    0.045,
    -0.001,
    0.027,
  );
  coronoidR.rotation.z = 0.10;

  const lowerArchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(
      -0.049,
      -0.047,
      0.047,
    ),
    new THREE.Vector3(
      -0.034,
      -0.050,
      0.066,
    ),
    new THREE.Vector3(
      -0.016,
      -0.052,
      0.078,
    ),
    new THREE.Vector3(
      0,
      -0.053,
      0.082,
    ),
    new THREE.Vector3(
      0.016,
      -0.052,
      0.078,
    ),
    new THREE.Vector3(
      0.034,
      -0.050,
      0.066,
    ),
    new THREE.Vector3(
      0.049,
      -0.047,
      0.047,
    ),
  ]);

  meshFrom(
    new THREE.TubeGeometry(
      lowerArchCurve,
      20,
      0.0041,
      5,
      false,
    ),
    boneMaterial,
    'lowerAlveolarRidge',
    jaw,
    0,
  );

  for (const side of [-1, 1]) {
    dentalHalf.forEach((tooth, index) => {
      const lowerWidth = tooth.width * (
        index < 3 ? 0.92 : 0.96
      );
      const lowerDepth = tooth.depth * 0.94;

      const mesh = meshFrom(
        createToothGeometry(
          lowerWidth,
          lowerDepth,
          tooth.height * 0.92,
          false,
          tooth.kind,
        ),
        boneMaterial,
        `lowerTooth_${
          side < 0 ? 'L' : 'R'
        }_${index + 1}`,
        jaw,
        0,
      );

      mesh.position.set(
        side * tooth.x * 0.98,
        -0.0555 + index * 0.00055,
        tooth.z - 0.0025,
      );

      mesh.rotation.y = (
        side * (index / 6) * 0.56
      );

      mesh.rotation.z = -side * (
        index > 1
          ? 0.013 * index
          : 0.006 * index
      );
    });
  }

  ellipsoid({
    name: 'stage1_temporalisL',
    material: muscleMaterial,
    stage: 1,
    position: [-0.066, 0.019, -0.003],
    scale: [0.0045, 0.038, 0.032],
    rotation: [0.02, -0.10, -0.10],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'stage1_temporalisR',
    material: muscleMaterial,
    stage: 1,
    position: [0.066, 0.019, -0.003],
    scale: [0.0045, 0.038, 0.032],
    rotation: [0.02, 0.10, 0.10],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'stage1_masseterL',
    parent: jaw,
    material: muscleLightMaterial,
    stage: 1,
    position: [-0.055, -0.027, 0.031],
    scale: [0.0055, 0.025, 0.017],
    rotation: [-0.10, -0.10, -0.05],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'stage1_masseterR',
    parent: jaw,
    material: muscleLightMaterial,
    stage: 1,
    position: [0.055, -0.027, 0.031],
    scale: [0.0055, 0.025, 0.017],
    rotation: [-0.10, 0.10, 0.05],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'stage1_frontalisPatch',
    material: muscleLightMaterial,
    stage: 1,
    position: [-0.010, 0.064, 0.061],
    scale: [0.028, 0.020, 0.0038],
    rotation: [-0.11, 0.02, -0.10],
    segments: [10, 5],
  });

  function creepingPatch({
    name,
    stage,
    position,
    rotation = [0, 0, 0],
    size,
    seed,
    parent = root,
  }) {
    const patch = meshFrom(
      createCreepingPatchGeometry(
        size[0],
        size[1],
        seed,
        12,
      ),
      rawSkinMaterial,
      name,
      parent,
      stage,
    );

    patch.position.set(...position);
    patch.rotation.set(...rotation);

    return patch;
  }

  creepingPatch({
    name: 'stage2_skinLeftForehead',
    stage: 2,
    position: [-0.029, 0.054, 0.075],
    rotation: [-0.09, -0.12, 0.12],
    size: [0.025, 0.018],
    seed: 1.1,
  });

  creepingPatch({
    name: 'stage2_skinLeftCheek',
    stage: 2,
    position: [-0.045, -0.014, 0.076],
    rotation: [0.02, -0.30, -0.08],
    size: [0.022, 0.026],
    seed: 2.3,
  });

  creepingPatch({
    name: 'stage2_skinLeftJaw',
    stage: 2,
    parent: jaw,
    position: [-0.032, -0.045, 0.074],
    rotation: [0.03, -0.18, -0.10],
    size: [0.024, 0.017],
    seed: 3.7,
  });

  function createEye(name, x, revealStage) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, 0.014, 0.079);
    pivot.rotation.order = 'YXZ';
    pivot.visible = false;
    pivot.userData.revealStage = revealStage;
    pivot.userData.forwardAxis = '+Z';
    root.add(pivot);

    const globe = meshFrom(
      sphereGeometry(14, 9),
      scleraMaterial,
      `${name}_globe`,
      pivot,
      revealStage,
    );
    globe.scale.setScalar(0.0117);

    const iris = meshFrom(
      new THREE.CircleGeometry(
        0.00415,
        16,
      ),
      irisMaterial,
      `${name}_iris`,
      pivot,
      revealStage,
    );
    iris.position.z = 0.01138;

    const pupil = meshFrom(
      new THREE.CircleGeometry(
        0.00185,
        12,
      ),
      pupilMaterial,
      `${name}_pupil`,
      pivot,
      revealStage,
    );
    pupil.position.z = 0.01154;

    const highlight = meshFrom(
      sphereGeometry(6, 4),
      wetHighlightMaterial,
      `${name}_highlight`,
      pivot,
      revealStage,
    );
    highlight.scale.setScalar(0.00078);
    highlight.position.set(
      -0.0021,
      0.0024,
      0.01125,
    );

    pivot.userData.meshes = [
      globe,
      iris,
      pupil,
      highlight,
    ];

    return pivot;
  }

  const eyeL = createEye(
    'eyeL',
    -0.027,
    2,
  );

  creepingPatch({
    name: 'stage3_skinRightForehead',
    stage: 3,
    position: [0.028, 0.052, 0.075],
    rotation: [-0.09, 0.12, -0.11],
    size: [0.024, 0.020],
    seed: 5.2,
  });

  creepingPatch({
    name: 'stage3_skinRightCheek',
    stage: 3,
    position: [0.044, -0.015, 0.076],
    rotation: [0.02, 0.29, 0.08],
    size: [0.022, 0.027],
    seed: 6.4,
  });

  creepingPatch({
    name: 'stage3_skinPhiltrum',
    stage: 3,
    position: [0, -0.042, 0.090],
    rotation: [-0.04, 0, 0.02],
    size: [0.018, 0.015],
    seed: 7.8,
  });

  creepingPatch({
    name: 'stage3_skinRightJaw',
    stage: 3,
    parent: jaw,
    position: [0.032, -0.045, 0.074],
    rotation: [0.03, 0.18, 0.10],
    size: [0.024, 0.017],
    seed: 9.0,
  });

  const eyeR = createEye(
    'eyeR',
    0.027,
    3,
  );

  meshFrom(
    createHairCapGeometry(18, 7),
    hairMaterial,
    'stage4_hairCap',
    root,
    4,
  );

  const hairLockXs = [
    -0.034,
    -0.018,
    0,
    0.018,
    0.034,
  ];

  hairLockXs.forEach((x, index) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(
        x * 0.55,
        0.095 - Math.abs(x) * 0.08,
        0.018,
      ),
      new THREE.Vector3(
        x * 0.82,
        0.073,
        0.057 + 0.002 * Math.cos(index),
      ),
      new THREE.Vector3(
        x,
        0.051 + 0.003 * Math.sin(index * 1.7),
        0.077,
      ),
    ]);

    meshFrom(
      new THREE.TubeGeometry(
        curve,
        5,
        0.00145,
        3,
        false,
      ),
      hairMaterial,
      `stage4_hairLock${index + 1}`,
      root,
      4,
    );
  });

  function eyebrow(side) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(
        side * 0.010,
        0.031,
        0.089,
      ),
      new THREE.Vector3(
        side * 0.026,
        0.034,
        0.092,
      ),
      new THREE.Vector3(
        side * 0.042,
        0.030,
        0.087,
      ),
    ]);

    return meshFrom(
      new THREE.TubeGeometry(
        curve,
        8,
        0.00135,
        3,
        false,
      ),
      hairMaterial,
      side < 0
        ? 'stage4_browL'
        : 'stage4_browR',
      root,
      4,
    );
  }

  eyebrow(-1);
  eyebrow(1);

  ellipsoid({
    name: 'stage4_noseBridge',
    material: skinMaterial,
    stage: 4,
    position: [0, -0.003, 0.086],
    scale: [0.0095, 0.0285, 0.0105],
    rotation: [-0.06, 0, 0],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'stage4_noseTip',
    material: skinMaterial,
    stage: 4,
    position: [0, -0.027, 0.098],
    scale: [0.0145, 0.0110, 0.0135],
    rotation: [-0.05, 0, 0],
    segments: [10, 5],
  });

  ellipsoid({
    name: 'stage4_alaL',
    material: skinMaterial,
    stage: 4,
    position: [-0.0105, -0.030, 0.095],
    scale: [0.0080, 0.0068, 0.0090],
    rotation: [0, -0.18, -0.08],
    segments: [8, 4],
  });

  ellipsoid({
    name: 'stage4_alaR',
    material: skinMaterial,
    stage: 4,
    position: [0.0105, -0.030, 0.095],
    scale: [0.0080, 0.0068, 0.0090],
    rotation: [0, 0.18, 0.08],
    segments: [8, 4],
  });

  for (const side of [-1, 1]) {
    const nostril = meshFrom(
      new THREE.CircleGeometry(
        0.0023,
        10,
      ),
      voidMaterial,
      side < 0
        ? 'stage4_nostrilL'
        : 'stage4_nostrilR',
      root,
      4,
    );

    nostril.position.set(
      side * 0.0063,
      -0.033,
      0.1075,
    );
    nostril.rotation.x = 0.16;
  }

  meshFrom(
    createHeadShellGeometry(),
    skinMaterial,
    'stage5_upperHeadShell',
    root,
    5,
  );

  const jawSkin = meshFrom(
    createJawSkinGeometry(),
    skinMaterial,
    'stage5_lowerFace',
    jaw,
    5,
  );
  jawSkin.position.set(
    0,
    -0.044,
    0.038,
  );

  for (const side of [-1, 1]) {
    ellipsoid({
      name: side < 0
        ? 'stage5_earL'
        : 'stage5_earR',
      material: skinMaterial,
      stage: 5,
      position: [
        side * 0.074,
        -0.003,
        -0.006,
      ],
      scale: [
        0.0090,
        0.0255,
        0.0120,
      ],
      rotation: [
        0.02,
        side * 0.12,
        side * 0.08,
      ],
      segments: [10, 6],
    });

    const innerEar = meshFrom(
      createCreepingPatchGeometry(
        0.0045,
        0.0135,
        side < 0 ? 12.4 : 13.8,
        12,
      ),
      skinShadowMaterial,
      side < 0
        ? 'stage5_innerEarL'
        : 'stage5_innerEarR',
      root,
      5,
    );

    innerEar.position.set(
      side * 0.0805,
      -0.003,
      0.001,
    );
    innerEar.rotation.y = side * 0.88;
    innerEar.rotation.z = side * 0.05;
  }

  function eyelids(side) {
    const upper = meshFrom(
      createEllipticalBandGeometry({
        outerX: 0.0133,
        outerY: 0.0073,
        innerX: 0.0112,
        innerY: 0.0054,
        segments: 12,
        start: 0,
        end: Math.PI,
        arch: 0.0008,
      }),
      skinMaterial,
      side < 0
        ? 'stage5_upperLidL'
        : 'stage5_upperLidR',
      root,
      5,
    );

    upper.position.set(
      side * 0.027,
      0.014,
      0.0912,
    );

    const lower = meshFrom(
      createEllipticalBandGeometry({
        outerX: 0.0131,
        outerY: 0.0068,
        innerX: 0.0111,
        innerY: 0.0052,
        segments: 12,
        start: Math.PI,
        end: TAU,
        arch: -0.00025,
      }),
      skinMaterial,
      side < 0
        ? 'stage5_lowerLidL'
        : 'stage5_lowerLidR',
      root,
      5,
    );

    lower.position.set(
      side * 0.027,
      0.014,
      0.0910,
    );
  }

  eyelids(-1);
  eyelids(1);

  const upperLip = meshFrom(
    createLipRibbonGeometry(
      0.044,
      0.0060,
      true,
      12,
    ),
    lipMaterial,
    'stage5_upperLip',
    root,
    5,
  );
  upperLip.position.set(
    0,
    -0.0505,
    0.0935,
  );

  const lowerLip = meshFrom(
    createLipRibbonGeometry(
      0.042,
      0.0062,
      false,
      12,
    ),
    lipMaterial,
    'stage5_lowerLip',
    jaw,
    5,
  );
  lowerLip.position.set(
    0,
    -0.0365,
    0.0937,
  );

  eyeL.visible = false;
  eyeR.visible = false;

  root.userData.triangleCount = Math.round(
    allMeshes.reduce(
      (sum, mesh) => (
        sum + triangleCount(mesh.geometry)
      ),
      0,
    ),
  );

  root.userData.triangleBudget = 9000;
  root.userData.eyeRevealStages = {
    eyeL: 2,
    eyeR: 3,
  };

  if (
    root.userData.triangleCount
    > root.userData.triangleBudget
  ) {
    throw new Error(
      `Procedural skull triangle budget exceeded: ${
        root.userData.triangleCount
      } > 9000`,
    );
  }

  return {
    root,
    jaw,
    jawMount,
    sockets,
    eyeL,
    eyeR,
    stageSets,
  };
}

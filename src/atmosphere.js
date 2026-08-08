// atmosphere.js — a batched visual polish layer for the exterior journey.
//
// This module deliberately owns no progression, colliders, targets, audio, or
// input.  It can be mounted after buildOutside() and removed without changing
// a single gameplay result.  The palette communicates through luminance first:
// moon-pale stone, near-black silhouettes, cyan route flora, and a small amber
// oasis accent remain distinct under common red/green colour deficiencies.
import * as THREE from 'three';
import { RNG, TAU } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Add the exterior atmosphere pass.
 *
 * Expected call site: after buildOutside(game), once clearingCenter and the
 * authored forest spline exist.  Missing optional systems are skipped safely.
 * Returns a small inspection/disposal API useful to tests and hot reloads.
 */
export function buildAtmosphere(game) {
  const scene = game && game.scene;
  const stats = { drawCalls: 0, triangles: 0, instances: 0, points: 0 };
  if (!scene) return { group: null, stats, dispose() {} };

  const root = new THREE.Group();
  root.name = 'FETCH atmosphere';
  root.userData.decorativeOnly = true;
  scene.add(root);

  const ownedMaterials = new Set();
  const tickers = [];
  const track = (object, instances = 1) => {
    root.add(object);
    stats.drawCalls++;
    if (object.isPoints) stats.points += object.geometry.attributes.position?.count || 0;
    else {
      const g = object.geometry;
      const tris = g ? (g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3) : 0;
      stats.triangles += Math.round(tris * instances);
      stats.instances += instances;
    }
    return object;
  };
  const own = (material) => { ownedMaterials.add(material); return material; };

  buildNightSky(game, root, track, own, tickers);
  buildGraveyardDress(game, track, own);
  buildForestDress(game, track, own, tickers);
  buildClearingDress(game, track, own, tickers);
  buildCaveDress(game, track, own);

  const ticker = (dt, t) => {
    for (const fn of tickers) fn(dt, t);
  };
  if (Array.isArray(game.tickers)) game.tickers.push(ticker);

  root.userData.stats = stats;
  return {
    group: root,
    stats,
    dispose() {
      if (Array.isArray(game.tickers)) {
        const i = game.tickers.indexOf(ticker);
        if (i >= 0) game.tickers.splice(i, 1);
      }
      scene.remove(root);
      const geometries = new Set();
      root.traverse((o) => { if (o.geometry) geometries.add(o.geometry); });
      for (const g of geometries) g.dispose();
      for (const m of ownedMaterials) m.dispose();
    },
  };
}

// --------------------------------------------------------------------- sky
function buildNightSky(game, root, track, own, tickers) {
  const camera = game.camera;
  if (!camera) return;

  const sky = new THREE.Group();
  sky.name = 'moon sky';
  root.add(sky);

  const domeMat = own(new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vHeight;
      void main() {
        float h = clamp(vHeight * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = vec3(0.030, 0.047, 0.078);
        vec3 zenith = vec3(0.006, 0.009, 0.027);
        vec3 col = mix(horizon, zenith, smoothstep(0.10, 0.92, h));
        col += vec3(0.018, 0.026, 0.050) * pow(max(vHeight, 0.0), 5.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(218, 32, 16), domeMat);
  dome.name = 'graded night dome';
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  sky.add(dome);
  noteObject(statsProxy(track), dome, 1);

  const rng = new RNG(0x51a7f00d);
  const starPos = [];
  const starCol = [];
  const cyan = new THREE.Color(0xb9def0);
  const violet = new THREE.Color(0xc9c2ef);
  const dim = new THREE.Color(0x7087a4);
  const colour = new THREE.Color();
  for (let i = 0; i < 540; i++) {
    const y = rng.range(-0.18, 0.98);
    const a = rng.range(0, TAU);
    const r = rng.range(176, 208);
    const flat = Math.sqrt(Math.max(0, 1 - y * y));
    starPos.push(Math.cos(a) * flat * r, y * r, Math.sin(a) * flat * r);
    const base = rng.float() < 0.18 ? violet : (rng.float() < 0.68 ? cyan : dim);
    colour.copy(base).multiplyScalar(rng.range(0.55, 1.12));
    starCol.push(colour.r, colour.g, colour.b);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3));
  const stars = new THREE.Points(starGeo, own(new THREE.PointsMaterial({
    size: 0.72,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    fog: false,
  })));
  stars.name = 'fixed stars';
  stars.renderOrder = -990;
  stars.frustumCulled = false;
  sky.add(stars);
  noteObject(statsProxy(track), stars, 1);

  const moonPos = new THREE.Vector3(-74, 54, -144);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(5.8, 48),
    own(new THREE.MeshBasicMaterial({ color: 0xe6f2f2, depthWrite: false, fog: false, side: THREE.DoubleSide })),
  );
  moon.position.copy(moonPos);
  moon.lookAt(0, 0, 0);
  moon.name = 'moon disc';
  moon.renderOrder = -980;
  sky.add(moon);
  noteObject(statsProxy(track), moon, 1);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    own(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vUv;
        void main(){
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 2.6) * 0.22;
          gl_FragColor = vec4(0.48, 0.72, 0.90, a);
        }
      `,
    })),
  );
  halo.position.copy(moonPos).addScaledVector(moonPos.clone().normalize(), 0.2);
  halo.quaternion.copy(moon.quaternion);
  halo.name = 'moon halo';
  halo.renderOrder = -979;
  sky.add(halo);
  noteObject(statsProxy(track), halo, 1);

  sky.position.copy(camera.position);
  tickers.push((dt, t) => {
    sky.position.copy(camera.position);
    stars.rotation.y = t * 0.00035;
    halo.scale.setScalar(1 + Math.sin(t * 0.19) * 0.025);
  });
}

// buildNightSky owns a nested group, while the normal tracker adds directly to
// the root.  This adapter records nested sky objects without re-parenting them.
function statsProxy(track) {
  return (object, instances) => {
    const parent = object.parent;
    track(object, instances);
    if (parent) parent.add(object);
  };
}

function noteObject(track, object, instances) { track(object, instances); }

// --------------------------------------------------------------- graveyard
function buildGraveyardDress(game, track, own) {
  const rng = new RNG(0xc0ff1e);
  const stoneMat = own(cloneTint(game.mats?.headstone, 0x98a4aa,
    () => new THREE.MeshLambertMaterial({ color: 0x98a4aa })));
  stoneMat.emissive = new THREE.Color(0x101923);
  stoneMat.emissiveIntensity = 0.16;

  const stones = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if (rng.chance(0.34)) continue;
      const x = -16 + col * 5.7 + rng.range(-0.72, 0.72);
      const z = 10.5 + row * 4.55 + rng.range(-0.55, 0.55);
      if (Math.abs(x - 2) < 2.5 && z > 34) continue;
      if (Math.hypot(x + 9, z - 14) < 3.8) continue;
      stones.push({ x, z, tall: rng.range(0.85, 1.35), lean: rng.range(-0.16, 0.16), yaw: rng.range(-0.28, 0.28) });
    }
  }
  // The gate is legible by silhouette: two taller stones frame, never occupy,
  // the playable opening.
  stones.push({ x: -0.65, z: 40.4, tall: 1.65, lean: -0.08, yaw: 0.08 });
  stones.push({ x: 4.65, z: 40.4, tall: 1.72, lean: 0.07, yaw: -0.09 });

  const gothicGeo = makeGothicStoneGeometry();
  const gothic = new THREE.InstancedMesh(gothicGeo, stoneMat, stones.length);
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  stones.forEach((it, i) => {
    e.set(0, it.yaw, it.lean);
    // some of them are being swallowed. A row of stones all standing at the
    // same height on the same plane reads as a row of props; a few sunk to
    // their shoulders reads as ground that has been moving for a century.
    it.sink = rng.chance(0.3) ? rng.range(-0.34, -0.12) : rng.range(-0.04, 0.02);
    m.compose(p.set(it.x, it.sink, it.z), q.setFromEuler(e), s.set(rng.range(0.8, 1.18), it.tall, rng.range(0.82, 1.1)));
    gothic.setMatrixAt(i, m);
    // and no two of them weathered the same. Value only — the whole yard was
    // one flat pale grey before this line.
    gothic.setColorAt(i, col.setScalar(rng.range(0.48, 1.04)));
  });
  if (gothic.instanceColor) gothic.instanceColor.needsUpdate = true;
  finishInstances(gothic, true, true);
  gothic.name = 'carved grave silhouettes';
  track(gothic, stones.length);

  const crossSites = stones.filter((_, i) => i % 5 === 2).slice(0, 10);
  const upright = new THREE.InstancedMesh(new THREE.BoxGeometry(0.10, 1.16, 0.10), stoneMat, crossSites.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.10, 0.10), stoneMat, crossSites.length);
  crossSites.forEach((it, i) => {
    const yaw = it.yaw + rng.range(-0.1, 0.1);
    q.setFromEuler(e.set(0, yaw, it.lean));
    m.compose(p.set(it.x + 0.45, 0.65, it.z + 0.18), q, s.setScalar(1));
    upright.setMatrixAt(i, m);
    m.compose(p.set(it.x + 0.45, 0.83, it.z + 0.18), q, s.setScalar(1));
    arms.setMatrixAt(i, m);
  });
  finishInstances(upright, true, true);
  finishInstances(arms, true, true);
  upright.name = 'grave crosses upright';
  arms.name = 'grave crosses arms';
  track(upright, crossSites.length);
  track(arms, crossSites.length);

  // ---- the three things that were actually missing from this yard ----

  // 1. GRAVE MOUNDS. A headstone standing on flat ground is a slab in a field.
  // The mound in front of it is what says something is buried there, and it is
  // the cheapest possible geometry: a squashed hemisphere.
  const moundGeo = new THREE.SphereGeometry(1, 9, 5, 0, TAU, 0, Math.PI / 2);
  const moundMat = own(cloneTint(game.mats?.dirt, 0x3b3a30,
    () => new THREE.MeshLambertMaterial({ color: 0x3b3a30 })));
  moundMat.vertexColors = true;
  const mounds = new THREE.InstancedMesh(moundGeo, moundMat, stones.length);
  stones.forEach((it, i) => {
    const sunken = it.sink < -0.1;                     // an old grave has fallen IN
    q.setFromEuler(e.set(0, it.yaw, 0));
    m.compose(
      p.set(it.x + Math.sin(it.yaw) * 0.1, sunken ? -0.30 : -0.16, it.z + 1.15 + rng.range(-0.15, 0.15)),
      q, s.set(rng.range(0.78, 1.05), sunken ? rng.range(0.16, 0.26) : rng.range(0.30, 0.44), rng.range(1.5, 1.95)),
    );
    mounds.setMatrixAt(i, m);
    mounds.setColorAt(i, col.setScalar(rng.range(0.55, 1.0)));
  });
  if (mounds.instanceColor) mounds.instanceColor.needsUpdate = true;
  finishInstances(mounds, false, true);
  mounds.name = 'grave mounds';
  track(mounds, stones.length);

  // 2. GRASS. The ground was a bare sheet with props standing on it; nothing
  // grew anywhere. Crossed alpha planes, same trick as the forest understory.
  const bladeTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    for (let i = 0; i < 54; i++) {
      const x = 4 + rng.float() * 56, w = rng.range(0.7, 1.9), h = rng.range(18, 54);
      g.fillStyle = ['#2a2e26', '#22261f', '#31352c', '#191c17'][rng.int(0, 3)];
      g.beginPath();
      g.moveTo(x, 64);
      g.quadraticCurveTo(x + rng.range(-9, 9), 64 - h * 0.6, x + rng.range(-14, 14), 64 - h);
      g.lineTo(x + w, 64 - h * 0.94);
      g.quadraticCurveTo(x + w + rng.range(-9, 9), 64 - h * 0.55, x + w, 64);
      g.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const tuftGeo = (() => {
    const g = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    for (let k = 0; k < 2; k++) {
      const a = (k * Math.PI) / 2, c = Math.cos(a), sn = Math.sin(a), o = k * 4;
      pos.push(-c, 0, -sn, c, 0, sn, c, 1, sn, -c, 1, -sn);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  const tuftMat = own(new THREE.MeshLambertMaterial({
    color: 0xffffff, map: bladeTex, alphaTest: 0.45, side: THREE.DoubleSide,
  }));
  const tufts = [];
  for (let n = 0; n < 620; n++) {
    const x = rng.range(-19.4, 23.4), z = rng.range(7.2, 41.4);
    if (Math.abs(x - 2) < 1.9 && z > 33) continue;             // keep the gate lane bare
    if (Math.abs(x) < 12 && z < 6.6) continue;                 // and the house apron
    tufts.push({ x, z, sc: rng.range(0.13, 0.34), rotY: rng.float() * TAU, tint: rng.range(0.3, 0.78) });
  }
  const tuftMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
  tufts.forEach((it, i) => {
    q.setFromEuler(e.set(0, it.rotY, 0));
    m.compose(p.set(it.x, -0.02, it.z), q, s.set(it.sc * 1.8, it.sc, it.sc * 1.8));
    tuftMesh.setMatrixAt(i, m);
    tuftMesh.setColorAt(i, col.setScalar(it.tint));
  });
  if (tuftMesh.instanceColor) tuftMesh.instanceColor.needsUpdate = true;
  finishInstances(tuftMesh, false, false);
  tuftMesh.name = 'graveyard grass';
  track(tuftMesh, tufts.length);

  // 3. A TREELINE. Beyond the fence there was nothing — the middle distance
  // just stopped, and a yard with no horizon reads as a diorama on a table.
  // These are pure silhouette: unlit, flat, fogged, never approached.
  const wallMat = own(new THREE.MeshBasicMaterial({ color: 0x060d13, fog: true }));
  const wallGeo = new THREE.IcosahedronGeometry(1, 0);
  const wall = new THREE.InstancedMesh(wallGeo, wallMat, 120);
  for (let i = 0; i < 120; i++) {
    const a = rng.range(-0.35, Math.PI + 0.35);
    const r = rng.range(46, 74);
    const h = rng.range(7, 15);
    q.setFromEuler(e.set(0, rng.float() * TAU, 0));
    m.compose(p.set(2 + Math.cos(a) * r, h * 0.35, 24 + Math.sin(a) * r * 0.85), q,
      s.set(rng.range(4, 9), h, rng.range(4, 9)));
    wall.setMatrixAt(i, m);
  }
  finishInstances(wall, false, false);
  wall.name = 'far treeline silhouette';
  track(wall, 120);
}

function makeGothicStoneGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.39, 0);
  shape.lineTo(-0.39, 0.60);
  shape.quadraticCurveTo(-0.38, 0.93, 0, 1.11);
  shape.quadraticCurveTo(0.38, 0.93, 0.39, 0.60);
  shape.lineTo(0.39, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.15,
    curveSegments: 4,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.035,
    bevelThickness: 0.025,
  });
  g.translate(0, 0, -0.075);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ forest
function buildForestDress(game, track, own, tickers) {
  const forest = game.forest;
  if (!forest || !Array.isArray(forest.samples) || !forest.samples.length ||
      !Array.isArray(forest.halfW) || typeof forest.ravineS !== 'function' ||
      typeof forest.arenaS !== 'function') return;
  const forestLength = Number.isFinite(forest.length) ? forest.length : forest.samples.length;
  const rng = new RNG(0xfa115eed);
  const barkMat = game.mats?.bark || own(new THREE.MeshLambertMaterial({ color: 0x16140f }));
  const branchMatrices = [];
  const branchGeo = new THREE.CylinderGeometry(0.055, 0.105, 1, 6, 1);

  for (let i = 12; i < forestLength - 10; i += 13) {
    if (Math.abs(i - forest.ravineS()) < 9 || Math.abs(i - forest.arenaS()) < 20) continue;
    const sm = forest.samples[i];
    const hw = forest.halfW[i];
    const nx = -sm.tz, nz = sm.tx;
    const left = new THREE.Vector3(sm.x - nx * (hw + 0.55), 3.4 + rng.range(-0.3, 0.5), sm.z - nz * (hw + 0.55));
    const right = new THREE.Vector3(sm.x + nx * (hw + 0.55), 3.5 + rng.range(-0.3, 0.5), sm.z + nz * (hw + 0.55));
    const crown = new THREE.Vector3(sm.x + rng.range(-0.5, 0.5), 6.4 + rng.range(-0.5, 0.8), sm.z + rng.range(-0.35, 0.35));
    branchMatrices.push(segmentMatrix(left, crown, rng.range(0.9, 1.25)));
    branchMatrices.push(segmentMatrix(right, crown, rng.range(0.9, 1.25)));
    branchMatrices.push(segmentMatrix(crown, crown.clone().add(new THREE.Vector3(sm.tx * rng.range(1.8, 3.2), rng.range(-0.7, 0.2), sm.tz * rng.range(1.8, 3.2))), 0.66));
  }

  // Surface roots break the corridor's perfectly smooth edge without stealing
  // movement space.  They begin outside the authored half-width.
  for (let i = 7; i < forestLength - 5; i += 5) {
    const sm = forest.samples[i];
    const hw = forest.halfW[i];
    const nx = -sm.tz, nz = sm.tx;
    for (const side of [-1, 1]) {
      const a = new THREE.Vector3(sm.x + nx * side * (hw + 0.35), 0.09, sm.z + nz * side * (hw + 0.35));
      const length = rng.range(0.9, 2.2);
      const b = a.clone().add(new THREE.Vector3(nx * side * length + sm.tx * rng.range(-0.6, 0.6), rng.range(-0.02, 0.10), nz * side * length + sm.tz * rng.range(-0.6, 0.6)));
      branchMatrices.push(segmentMatrix(a, b, rng.range(0.42, 0.7)));
    }
  }
  const branches = new THREE.InstancedMesh(branchGeo, barkMat, branchMatrices.length);
  branchMatrices.forEach((matrix, i) => branches.setMatrixAt(i, matrix));
  finishInstances(branches, false, true);
  branches.name = 'forest arches and roots';
  track(branches, branchMatrices.length);

  const fernGeo = makeFernGeometry();
  // Was a glowing cyan understory. Two problems: Alex is colourblind, so a read
  // carried by hue is no read at all — and self-lit flat triangles in an unlit
  // forest look like teal paper cutouts hanging in the dark. Now they are dark
  // foliage that reads by silhouette and by how the skull's light crosses them,
  // which is the read that survives for him.
  const fernMat = own(new THREE.MeshLambertMaterial({
    color: 0x2b3329,
    emissive: 0x080d09,
    emissiveIntensity: 0.06,
    side: THREE.DoubleSide,
  }));
  const fernMatrices = [];
  for (let i = 4; i < forestLength - 3; i += 3) {
    const sm = forest.samples[i];
    const hw = forest.halfW[i];
    const nx = -sm.tz, nz = sm.tx;
    for (const side of [-1, 1]) {
      const off = hw + rng.range(0.22, 1.35);
      const yaw = Math.atan2(sm.tx, sm.tz) + rng.range(-0.9, 0.9);
      const scale = rng.range(0.55, 1.18);
      fernMatrices.push(compose(
        sm.x + nx * side * off + rng.range(-0.35, 0.35),
        0.02,
        sm.z + nz * side * off + rng.range(-0.35, 0.35),
        0,
        yaw,
        rng.range(-0.1, 0.1),
        scale * rng.range(0.8, 1.2),
        scale,
        scale,
      ));
    }
  }
  const ferns = new THREE.InstancedMesh(fernGeo, fernMat, fernMatrices.length);
  fernMatrices.forEach((matrix, i) => ferns.setMatrixAt(i, matrix));
  finishInstances(ferns, false, false);
  ferns.name = 'forest understory';
  track(ferns, fernMatrices.length);

  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
  const canopyMat = own(new THREE.MeshLambertMaterial({ color: 0x101923, emissive: 0x030710, emissiveIntensity: 0.3 }));
  const canopyMatrices = [];
  for (let i = 8; i < forestLength - 4; i += 8) {
    const sm = forest.samples[i];
    const hw = forest.halfW[i];
    const nx = -sm.tz, nz = sm.tx;
    for (const side of [-1, 1]) {
      const size = rng.range(1.3, 2.35);
      canopyMatrices.push(compose(
        sm.x + nx * side * (hw + rng.range(1.0, 2.8)),
        rng.range(5.4, 7.7),
        sm.z + nz * side * (hw + rng.range(1.0, 2.8)),
        rng.range(-0.2, 0.2), rng.range(0, TAU), rng.range(-0.2, 0.2),
        size * 1.45, size * 0.62, size * 1.25,
      ));
    }
  }
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, canopyMatrices.length);
  canopyMatrices.forEach((matrix, i) => canopies.setMatrixAt(i, matrix));
  finishInstances(canopies, false, false);
  canopies.name = 'layered forest canopy';
  track(canopies, canopyMatrices.length);

  const guidePos = [];
  const guidePhase = [];
  for (let i = 9; i < forestLength - 4; i += 10) {
    const sm = forest.samples[i];
    const near = Math.min(forest.halfW[i] * 0.73, 1.45);
    const nx = -sm.tz, nz = sm.tx;
    for (let k = 0; k < 3; k++) {
      const side = k === 2 ? -1 : 1;
      guidePos.push(sm.x + nx * side * (near + k * 0.16), 0.13 + k * 0.13, sm.z + nz * side * (near + k * 0.16));
      guidePhase.push(rng.range(0, TAU));
    }
  }
  const guide = makeGlowPoints(guidePos, guidePhase, null, own, {
    cyan: new THREE.Color(0x64d8e8), amber: new THREE.Color(0xffc56d), size: 8.0, opacity: 0.72,
  });
  guide.name = 'pathside foxfire';
  track(guide, 1);
  tickers.push((dt, t) => { guide.material.uniforms.uTime.value = t % 600; });
}

function makeFernGeometry() {
  const pos = [];
  const tri = (ax, ay, bx, by, cx, cy) => pos.push(ax, ay, 0, bx, by, 0, cx, cy, 0);
  tri(-0.025, 0, 0.025, 0, 0.018, 1.14);
  for (let i = 0; i < 6; i++) {
    const y = 0.18 + i * 0.14;
    const w = 0.43 * (1 - i * 0.105);
    const rise = 0.12 + i * 0.008;
    tri(0, y, -w, y + rise * 0.35, -w * 0.18, y + rise);
    tri(0, y + 0.025, w, y + rise * 0.48, w * 0.18, y + rise * 1.08);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// --------------------------------------------------------------- clearing
function buildClearingDress(game, track, own, tickers) {
  const C = game.clearingCenter;
  if (!C) return;
  const rng = new RNG(0x0a515f00);

  const rockMat = own(cloneTint(game.mats?.rock, 0x687882,
    () => new THREE.MeshStandardMaterial({ color: 0x687882, roughness: 0.82, metalness: 0.04 })));
  if ('roughness' in rockMat) rockMat.roughness = 0.82;
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const matrices = [];
  const colours = [];
  const darkRock = new THREE.Color(0x46535d);
  const wetRock = new THREE.Color(0x788c98);

  // A low-poly talus facade dissolves the original monolithic cliff box.
  for (let y = 0.4; y < 18.8; y += 2.05) {
    for (let x = -29.0; x <= 29.0; x += 2.15) {
      if (Math.abs(x) < 3.35 && y < 18) continue;
      const scale = rng.range(1.15, 1.85) * (1 + y / 70);
      matrices.push(compose(
        C.x + x + rng.range(-0.75, 0.75),
        y + rng.range(-0.65, 0.65),
        C.z + 19.25 + rng.range(-0.45, 0.55),
        rng.range(-0.55, 0.55), rng.range(0, TAU), rng.range(-0.55, 0.55),
        scale * rng.range(0.75, 1.35), scale * rng.range(0.7, 1.25), scale * rng.range(0.72, 1.2),
      ));
      colours.push((Math.abs(x) < 6 ? wetRock : darkRock).clone().multiplyScalar(rng.range(0.75, 1.15)));
    }
  }
  // Basin shoulders pull the composition inward toward the fall and bridge.
  for (let i = 0; i < 42; i++) {
    const a = rng.range(Math.PI * 0.10, Math.PI * 0.90);
    const r = rng.range(7.0, 9.5);
    const x = Math.cos(a) * r;
    const z = 15.2 - Math.sin(a) * r;
    if (Math.abs(x) < 3.0) continue; // never counterfeit the bridge's collision language
    const scale = rng.range(0.45, 1.15);
    matrices.push(compose(C.x + x, rng.range(-0.1, 0.3), C.z + z,
      rng.range(-0.3, 0.3), rng.range(0, TAU), rng.range(-0.3, 0.3), scale * 1.5, scale, scale * 1.2));
    colours.push(darkRock.clone().multiplyScalar(rng.range(0.78, 1.12)));
  }
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, matrices.length);
  matrices.forEach((matrix, i) => { rocks.setMatrixAt(i, matrix); rocks.setColorAt(i, colours[i]); });
  finishInstances(rocks, true, true);
  rocks.name = 'waterfall talus and basin rim';
  track(rocks, matrices.length);

  const waterMat = own(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main(){
        vUv = uv;
        vec3 p = position;
        float edge = sin(uv.y * 24.0 + uTime * 5.0 + uv.x * 17.0);
        p.x += edge * 0.045 * sin(uv.x * 3.14159);
        p.z += sin(uv.y * 38.0 - uTime * 7.0 + uv.x * 11.0) * 0.035;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main(){
        float ribbons = 0.5 + 0.5 * sin(vUv.x * 82.0 + sin(vUv.y * 17.0 - uTime * 3.2) * 1.8);
        float ripple = 0.5 + 0.5 * sin(vUv.y * 58.0 - uTime * 9.0 + vUv.x * 12.0);
        float edge = smoothstep(0.0, 0.11, vUv.x) * smoothstep(0.0, 0.11, 1.0 - vUv.x);
        float footFoam = 1.0 - smoothstep(0.0, 0.16, vUv.y);
        vec3 col = mix(vec3(0.25,0.53,0.66), vec3(0.82,0.95,0.98), ribbons * 0.45 + footFoam * 0.35);
        float alpha = edge * (0.42 + ribbons * 0.28 + ripple * 0.08 + footFoam * 0.15);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  }));
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(6.75, 18.9, 20, 56), waterMat);
  fall.position.set(C.x, 9.5, C.z + 19.70);
  fall.name = 'layered waterfall veil';
  track(fall, 1);
  tickers.push((dt, t) => { waterMat.uniforms.uTime.value = t % 600; });

  // Foam, lifting mist, and a few warm fireflies share one draw call.  Their
  // size, motion, and brightness—not red/green identity—carry their roles.
  const p = [];
  const phase = [];
  const kind = [];
  for (let i = 0; i < 150; i++) {
    const a = rng.range(0, TAU), r = Math.sqrt(rng.float()) * 5.9;
    p.push(C.x + Math.cos(a) * r, 0.12 + rng.range(0, 0.18), C.z + 15.2 + Math.sin(a) * r * 0.55);
    phase.push(rng.range(0, TAU)); kind.push(0);
  }
  for (let i = 0; i < 105; i++) {
    p.push(C.x + rng.range(-5.2, 5.2), rng.range(0.18, 3.0), C.z + rng.range(14.0, 19.4));
    phase.push(rng.range(0, TAU)); kind.push(1);
  }
  for (let i = 0; i < 34; i++) {
    p.push(C.x + rng.range(-17, 17), rng.range(0.35, 2.8), C.z + rng.range(-9, 10));
    phase.push(rng.range(0, TAU)); kind.push(2);
  }
  const spray = makeGlowPoints(p, phase, kind, own, {
    cyan: new THREE.Color(0xa8edf4), amber: new THREE.Color(0xffc968), size: 17.0, opacity: 0.62,
  });
  spray.name = 'foam mist and oasis fireflies';
  track(spray, 1);
  const sprayMat = spray.material;
  tickers.push((dt, t) => { sprayMat.uniforms.uTime.value = t % 600; });

  const fernGeo = makeFernGeometry();
  // the clearing is the one kind place in the game, so its understory sits a
  // touch paler than the forest's — by VALUE, not by glowing teal
  const fernMat = own(new THREE.MeshLambertMaterial({ color: 0x3a4436, emissive: 0x0b120c, emissiveIntensity: 0.08, side: THREE.DoubleSide }));
  const fernMatrices = [];
  for (let i = 0; i < 104; i++) {
    const a = rng.range(0, TAU);
    const r = rng.range(10.0, 23.5);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.78;
    if (z > 12 || (z < -14 && Math.abs(x) < 5)) continue;
    const scale = rng.range(0.65, 1.35);
    fernMatrices.push(compose(C.x + x, 0.01, C.z + z, 0, -a + rng.range(-0.7, 0.7), 0,
      scale * rng.range(0.75, 1.2), scale, scale));
  }
  const ferns = new THREE.InstancedMesh(fernGeo, fernMat, fernMatrices.length);
  fernMatrices.forEach((matrix, i) => ferns.setMatrixAt(i, matrix));
  finishInstances(ferns, false, false);
  ferns.name = 'clearing fern ring';
  track(ferns, fernMatrices.length);
}

// -------------------------------------------------------------------- cave
function buildCaveDress(game, track, own) {
  const C = game.clearingCenter;
  if (!C) return;
  const path = [
    [C.x, C.z + 22], [C.x + 2, C.z + 30], [C.x + 7, C.z + 36],
    [C.x + 14, C.z + 40], [C.x + 22, C.z + 42],
  ];
  const rng = new RNG(0xca9e51de);
  const rockMat = own(cloneTint(game.mats?.rock, 0x3e4c56,
    () => new THREE.MeshStandardMaterial({ color: 0x3e4c56, roughness: 0.88, metalness: 0.03 })));
  if ('roughness' in rockMat) rockMat.roughness = 0.88;
  const rockMatrices = [];

  for (let leg = 0; leg < path.length - 1; leg++) {
    const [ax, az] = path[leg], [bx, bz] = path[leg + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len;
    const nx = tz, nz = -tx;
    const n = Math.max(6, Math.round(len / 0.92));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + dx * t, z = az + dz * t;
      for (const side of [-1, 1]) {
        // Four interlocked low-poly stones turn the structural wall backing
        // into a continuous, irregular cave silhouette.  Their inner edge
        // remains just outside the authored 1.65m movement spine.
        for (const layerY of [0.42, 1.30, 2.18, 3.02]) {
          const sc = rng.range(0.50, 0.78);
          rockMatrices.push(compose(
            x + nx * side * rng.range(1.94, 2.10),
            layerY + rng.range(-0.24, 0.24),
            z + nz * side * rng.range(1.94, 2.10),
            rng.range(-0.7, 0.7), rng.range(0, TAU), rng.range(-0.7, 0.7),
            sc * rng.range(0.78, 1.02), sc * rng.range(0.90, 1.28), sc * rng.range(1.00, 1.34),
          ));
        }
      }
      if (i % 2 === 0) {
        const sc = rng.range(0.52, 0.78);
        rockMatrices.push(compose(x + rng.range(-0.82, 0.82), 3.48, z + rng.range(-0.82, 0.82),
          rng.range(-0.35, 0.35), rng.range(0, TAU), rng.range(-0.35, 0.35), sc * 1.4, sc * 0.72, sc * 1.18));
      }
    }
  }
  const caveRocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, rockMatrices.length);
  rockMatrices.forEach((matrix, i) => caveRocks.setMatrixAt(i, matrix));
  finishInstances(caveRocks, true, true);
  caveRocks.name = 'cave broken wall skin';
  track(caveRocks, rockMatrices.length);

  const toothMat = own(cloneTint(game.mats?.rock, 0x5b6670,
    () => new THREE.MeshLambertMaterial({ color: 0x5b6670 })));
  const toothMatrices = [];
  for (let leg = 0; leg < path.length - 1; leg++) {
    const [ax, az] = path[leg], [bx, bz] = path[leg + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len;
    const nx = tz, nz = -tx;
    for (let d = 1.2; d < len; d += 2.1) {
      const x = ax + tx * d, z = az + tz * d;
      const side = rng.sign();
      const h = rng.range(0.55, 1.45);
      toothMatrices.push(compose(x + nx * side * rng.range(1.82, 2.02), 3.30, z + nz * side * rng.range(1.82, 2.02),
        Math.PI, rng.range(0, TAU), 0, rng.range(0.65, 1.15), h, rng.range(0.65, 1.15)));
      if (rng.chance(0.58)) {
        toothMatrices.push(compose(x - nx * side * rng.range(1.82, 2.02), h * 0.42, z - nz * side * rng.range(1.82, 2.02),
          0, rng.range(0, TAU), 0, rng.range(0.55, 0.95), h * 0.75, rng.range(0.55, 0.95)));
      }
    }
  }
  const teeth = new THREE.InstancedMesh(new THREE.ConeGeometry(0.24, 1, 6), toothMat, toothMatrices.length);
  toothMatrices.forEach((matrix, i) => teeth.setMatrixAt(i, matrix));
  finishInstances(teeth, true, true);
  teeth.name = 'cave stalactites';
  track(teeth, toothMatrices.length);

  // This was a wayfinding read carried by HUE — bright cyan mica against grey
  // rock, and the authored comment said out loud that it was meant to become a
  // spatial memory. Alex is colourblind: to him it was grey mica on grey rock,
  // which is no trail at all. Same idea, legal channel — the crystals GROW and
  // BRIGHTEN the closer you get to the way out, so the read is "these are
  // getting bigger, I am going the right way".
  const crystalMat = own(new THREE.MeshStandardMaterial({
    color: 0xc9d4d6,
    emissive: 0x8fa6ab,
    emissiveIntensity: 0.85,
    roughness: 0.24,
    metalness: 0.12,
    vertexColors: true,
  }));
  const crystalMatrices = [];
  const crystalTints = [];
  const legs = Math.max(1, path.length - 1);
  for (let leg = 0; leg < path.length - 1; leg++) {
    const [ax, az] = path[leg], [bx, bz] = path[leg + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len;
    const nx = tz, nz = -tx;
    for (let d = 0.9; d < len; d += 2.35) {
      const x = ax + tx * d, z = az + tz * d;
      const t = (leg + d / len) / legs;                 // 0 at the mouth, 1 at the way out
      const grow = 0.52 + 0.95 * t;
      const bright = 0.38 + 0.62 * t;
      const sc = rng.range(0.22, 0.42) * grow;
      crystalMatrices.push(compose(x + nx * 1.52, rng.range(0.42, 1.55), z + nz * 1.52,
        rng.range(-0.45, 0.45), rng.range(0, TAU), rng.range(-0.45, 0.45), sc, sc * rng.range(2.4, 4.2), sc));
      crystalTints.push(bright);
      if (leg > 0 && rng.chance(0.38)) {
        const floorSc = sc * rng.range(0.58, 0.82);
        crystalMatrices.push(compose(x - nx * 1.10, floorSc * 1.2, z - nz * 1.10,
          rng.range(-0.2, 0.2), rng.range(0, TAU), rng.range(-0.2, 0.2),
          floorSc, floorSc * rng.range(1.8, 3.0), floorSc));
        crystalTints.push(bright * 0.9);
      }
    }
  }
  const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), crystalMat, crystalMatrices.length);
  const tintCol = new THREE.Color();
  crystalMatrices.forEach((matrix, i) => {
    crystals.setMatrixAt(i, matrix);
    crystals.setColorAt(i, tintCol.setScalar(crystalTints[i]));
  });
  if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
  finishInstances(crystals, false, false);
  crystals.name = 'cave mica trail (grows toward the way out)';
  track(crystals, crystalMatrices.length);
}

// --------------------------------------------------------------- utilities
function cloneTint(source, hex, fallback) {
  const m = source?.clone ? source.clone() : fallback();
  if (m.color) m.color.setHex(hex);
  return m;
}

function compose(x, y, z, rx, ry, rz, sx, sy, sz) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
}

function segmentMatrix(a, b, radiusScale = 1) {
  const delta = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, delta.length());
  const q = new THREE.Quaternion().setFromUnitVectors(UP, delta.multiplyScalar(1 / len));
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(radiusScale, len, radiusScale));
}

function finishInstances(mesh, castShadow, receiveShadow) {
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

function makeGlowPoints(position, phase, kind, own, opts) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kind || new Array(phase.length).fill(0), 1));
  const material = own(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uCyan: { value: opts.cyan },
      uAmber: { value: opts.amber },
      uSize: { value: opts.size },
      uOpacity: { value: opts.opacity },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aKind;
      varying float vKind;
      varying float vPulse;
      uniform float uTime;
      uniform float uSize;
      void main(){
        vec3 p = position;
        vKind = aKind;
        if(aKind < 0.5){
          p.y += sin(uTime * 2.4 + aPhase) * 0.035;
          p.x += sin(uTime * 0.8 + aPhase) * 0.025;
        } else if(aKind < 1.5){
          p.y += mod(uTime * 0.13 + aPhase * 0.16, 1.15);
          p.x += sin(uTime * 0.24 + aPhase) * 0.18;
        } else {
          p.y += sin(uTime * 0.47 + aPhase) * 0.22;
          p.x += sin(uTime * 0.31 + aPhase * 1.7) * 0.13;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float kindSize = aKind < 0.5 ? 0.42 : (aKind < 1.5 ? 1.55 : 0.72);
        gl_PointSize = clamp(uSize * kindSize * (44.0 / max(1.0, -mv.z)), 1.0, 34.0);
        vPulse = 0.72 + 0.28 * sin(uTime * (aKind > 1.5 ? 2.1 : 0.72) + aPhase);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vKind;
      varying float vPulse;
      uniform vec3 uCyan;
      uniform vec3 uAmber;
      uniform float uOpacity;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if(d > 1.0) discard;
        float core = pow(max(0.0, 1.0 - d), vKind < 1.5 ? 1.7 : 3.0);
        vec3 colour = vKind > 1.5 ? uAmber : uCyan;
        gl_FragColor = vec4(colour, core * uOpacity * vPulse);
      }
    `,
  }));
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

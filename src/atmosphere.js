// atmosphere.js — a batched visual polish layer for the exterior journey.
//
// This module deliberately owns no progression, colliders, targets, audio, or
// input.  It can be mounted after buildOutside() and removed without changing
// a single gameplay result.  The palette communicates through luminance first:
// moon-pale stone, near-black silhouettes, cyan route flora, and a small amber
// oasis accent remain distinct under common red/green colour deficiencies.
import * as THREE from 'three';
import { RNG, TAU } from './util.js';
import { CLEARING_BASIN } from './outside.js';
import { projectUnderfalls } from './underfalls.js';

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
  const ownedTextures = new Set();
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
  const ownTexture = (texture) => { ownedTextures.add(texture); return texture; };

  buildNightSky(game, root, track, own, tickers);
  buildGraveyardDress(game, track, own, ownTexture);
  buildForestDress(game, track, own, tickers);
  buildClearingDress(game, track, own, tickers);
  buildCaveDress(game, track, own, tickers);

  // Cave dressing shares the decorative root with the exterior for batching,
  // but it must not leak draw calls (or stars through a shell gap) into the
  // house, graveyard, forest or clearing. Underfalls' visibility law performs
  // the inverse operation while inside: these six batches wake, exterior
  // siblings sleep.
  const caveNames = new Set([
    'cave broken wall skin',
    'underfalls chamber ceiling vaults',
    'cave stalactites',
    'cave mica trail (grows toward the way out)',
    'underfalls interior cataracts',
    'underfalls displaced spray',
  ]);
  const caveDress = root.children.filter((child) => caveNames.has(child.name));
  for (const child of caveDress) child.visible = false;
  let caveDressVisible = false;
  // From the oasis, the forest should remain a black wooded history behind the
  // player, not resolve into a luminous ruler of hundreds of distant ferns and
  // cyan guidance points. Keep its trunks/canopy silhouette; retire the two
  // close-reading layers once the forest chapter has actually been escaped.
  const forestCloseDress = root.children.filter((child) =>
    child.name === 'forest understory' || child.name === 'pathside foxfire');
  let forestCloseVisible = true;

  const ticker = (dt, t) => {
    const nextCaveVisible = game.act === 'cave';
    if (nextCaveVisible !== caveDressVisible) {
      caveDressVisible = nextCaveVisible;
      for (const child of caveDress) child.visible = nextCaveVisible;
    }
    const nextForestCloseVisible = game.act !== 'clearing'
      && game.act !== 'cave' && game.act !== 'mirror';
    if (nextForestCloseVisible !== forestCloseVisible) {
      forestCloseVisible = nextForestCloseVisible;
      for (const child of forestCloseDress) child.visible = nextForestCloseVisible;
    }
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
      for (const t of ownedTextures) t.dispose();
      for (const m of ownedMaterials) m.dispose();
    },
  };
}

// --------------------------------------------------------------------- sky
// One moon, agreed on by the disc, its halo and the sky it hangs in.
const MOON_POS = new THREE.Vector3(-74, 54, -144);
const MOON_DIR = MOON_POS.clone().normalize();

function buildNightSky(game, root, track, own, tickers) {
  const camera = game.camera;
  if (!camera) return;

  const sky = new THREE.Group();
  sky.name = 'moon sky';
  root.add(sky);

  // The sky was an honest vertical gradient and nothing else: every outdoor
  // frame in the game — the graveyard, the whole forest looking up, the
  // clearing the waterfall stands in — ended in the same flat navy wash, so
  // every silhouette the act builds had nothing to be a silhouette AGAINST.
  // Three things fix that and all three are pixels, not objects: weather
  // (drifting cloud, so the sky has form and the tree line has an edge), a moon
  // that actually lights the air around it, and a horizon a shade warmer than
  // the zenith so up feels like up. The moon disc below already sits at
  // MOON_DIR; the sky now agrees with it.
  const domeMat = own(new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 }, uMoon: { value: MOON_DIR.clone() } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform float uTime;
      uniform vec3 uMoon;
      float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                   mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = vec3(0.034, 0.050, 0.082);
        vec3 zenith = vec3(0.005, 0.008, 0.024);
        vec3 col = mix(horizon, zenith, smoothstep(0.10, 0.92, h));
        col += vec3(0.018, 0.026, 0.050) * pow(max(vDir.y, 0.0), 5.0);

        // the moon owns the air: one tight corona, one broad wash across its
        // whole quarter of the sky
        float md = max(0.0, dot(vDir, uMoon));
        col += vec3(0.085, 0.125, 0.185) * pow(md, 30.0);
        col += vec3(0.020, 0.030, 0.048) * pow(md, 3.2);

        // cloud, on a plane overhead so it foreshortens toward the horizon
        // the way real overcast does. Drifting, never repeating on screen.
        vec2 cp = vDir.xz / max(0.10, vDir.y + 0.24);
        float n = vnoise(cp * 0.85 + vec2(uTime * 0.0042, uTime * 0.0022)) * 0.56
                + vnoise(cp * 2.10 - vec2(uTime * 0.0075, 0.0)) * 0.30
                + vnoise(cp * 4.90) * 0.14;
        float cloud = smoothstep(0.44, 0.88, n) * smoothstep(-0.03, 0.26, vDir.y);
        vec3 lit = mix(vec3(0.016, 0.021, 0.034), vec3(0.115, 0.145, 0.195), pow(md, 1.9));
        col = mix(col, lit, cloud * 0.82);
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
  const stars = new THREE.Points(starGeo, own(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      void main(){
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(245.0 / max(1.0, -mv.z), 1.0, 2.4);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = 1.0 - smoothstep(0.22, 0.5, d);
        gl_FragColor = vec4(vColor, a * 0.86);
      }
    `,
  })));
  stars.name = 'fixed stars';
  stars.renderOrder = -990;
  stars.frustumCulled = false;
  sky.add(stars);
  noteObject(statsProxy(track), stars, 1);

  const moonPos = MOON_POS.clone();
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
    // Weather moves. Slowly — this is one still night, not a time-lapse.
    domeMat.uniforms.uTime.value = t % 100000;
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
function buildGraveyardDress(game, track, own, ownTexture) {
  const rng = new RNG(0xc0ff1e);
  const stoneMat = own(cloneTint(game.mats?.headstone, 0x98a4aa,
    () => new THREE.MeshLambertMaterial({ color: 0x98a4aa })));
  if (stoneMat.color) stoneMat.color.multiplyScalar(0.58);
  stoneMat.emissive = new THREE.Color(0x101923);
  stoneMat.emissiveIntensity = 0.11;

  const funeralPath = [[-8, 8.2], [-4.4, 14.8], [-1.6, 21.5], [1.2, 29.4], [2, 41.4]];
  const nearPath = (x, z, pad = 1.65) => {
    for (let i = 0; i < funeralPath.length - 1; i++) {
      const [ax, az] = funeralPath[i], [bx, bz] = funeralPath[i + 1];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < pad) return true;
    }
    return false;
  };
  const reserved = [
    [-9, 14, 4.25], [15.6, 31.5, 3.5], [-14.6, 34.2, 3.5],
    [-7.2, 27, 1.9], [9.2, 23, 1.9], [-14.2, 18.4, 1.9], [11.8, 36.2, 1.9],
    [-15.2, 27.2, 1.9], [14.5, 19.4, 1.9], [7.4, 35, 1.9],
    // the key tree and the staircase of lights that comes down out of it, and
    // the lock-stone west of the forest gate — a new landmark without a
    // reservation gets instanced headstones driven through it
    [5.5, 12.8, 3.4], [-0.35, 41.72, 1.35],
  ];
  const stones = [];
  for (let row = 0; row < 9; row++) {
    for (let colI = 0; colI < 10; colI++) {
      if (rng.chance(0.22)) continue;
      const x = -17 + colI * 4.15 + rng.range(-0.78, 0.78);
      const z = 9.2 + row * 3.75 + rng.range(-0.7, 0.7);
      if (x > 23.2 || nearPath(x, z)) continue;
      if (reserved.some(([rx, rz, rr]) => Math.hypot(x - rx, z - rz) < rr)) continue;
      const roll = rng.float();
      const kind = roll < 0.14 ? 'cross' : roll < 0.30 ? 'shouldered' : roll < 0.40 ? 'obelisk' : roll < 0.51 ? 'broken' : 'gothic';
      stones.push({
        x, z, kind,
        tall: rng.range(0.78, 1.46),
        lean: rng.range(-0.2, 0.2),
        yaw: rng.range(-0.34, 0.34),
        fallen: kind === 'broken' && rng.chance(0.42),
      });
    }
  }
  // The gate is legible by silhouette: two taller stones frame, never occupy,
  // the playable opening.
  stones.push({ x: -0.65, z: 40.4, kind: 'gothic', tall: 1.65, lean: -0.08, yaw: 0.08, fallen: false });
  stones.push({ x: 4.65, z: 40.4, kind: 'gothic', tall: 1.72, lean: 0.07, yaw: -0.09, fallen: false });

  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  stones.forEach((it) => {
    // some of them are being swallowed. A row of stones all standing at the
    // same height on the same plane reads as a row of props; a few sunk to
    // their shoulders reads as ground that has been moving for a century.
    it.sink = rng.chance(0.3) ? rng.range(-0.34, -0.12) : rng.range(-0.04, 0.02);
    it.width = rng.range(0.78, 1.2);
    it.value = rng.range(0.36, 0.84);
    // and no two of them weathered the same. Value only — the whole yard was
    // one flat pale grey before this line.
  });

  const stoneFamily = (kind, geo, name) => {
    const sites = stones.filter((it) => it.kind === kind);
    const mesh = new THREE.InstancedMesh(geo, stoneMat, sites.length);
    sites.forEach((it, i) => {
      e.set(it.fallen ? Math.PI * 0.47 : 0, it.yaw, it.lean);
      q.setFromEuler(e);
      m.compose(
        p.set(it.x, it.fallen ? 0.08 : it.sink, it.z), q,
        s.set(it.width, it.tall, rng.range(0.86, 1.14)),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setScalar(it.value));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    finishInstances(mesh, true, true);
    mesh.name = name;
    track(mesh, sites.length);
  };
  stoneFamily('gothic', makeGothicStoneGeometry(), 'arched family headstones');
  stoneFamily('shouldered', makeShoulderedStoneGeometry(), 'shouldered family headstones');
  stoneFamily('broken', makeBrokenStoneGeometry(), 'broken and fallen headstones');
  // Broken memorial columns, not perfect pyramid-topped lawn ornaments.
  const obeliskShape = new THREE.Shape();
  obeliskShape.moveTo(-0.31, 0);
  obeliskShape.lineTo(-0.31, 0.16);
  obeliskShape.lineTo(-0.19, 0.23);
  obeliskShape.lineTo(-0.16, 0.82);
  obeliskShape.lineTo(-0.06, 1.04);
  obeliskShape.lineTo(0.06, 0.91);
  obeliskShape.lineTo(0.17, 1.01);
  obeliskShape.lineTo(0.19, 0.23);
  obeliskShape.lineTo(0.31, 0.16);
  obeliskShape.lineTo(0.31, 0);
  obeliskShape.closePath();
  const obeliskGeo = new THREE.ExtrudeGeometry(obeliskShape, {
    depth: 0.22, curveSegments: 1, bevelEnabled: true,
    bevelSegments: 1, bevelSize: 0.018, bevelThickness: 0.016,
  });
  obeliskGeo.translate(0, 0, -0.11);
  obeliskGeo.computeVertexNormals();
  stoneFamily('obelisk', obeliskGeo, 'broken grave obelisk memorial columns');

  const crossSites = stones.filter((it) => it.kind === 'cross');
  const upright = new THREE.InstancedMesh(new THREE.BoxGeometry(0.10, 1.16, 0.10), stoneMat, crossSites.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.10, 0.10), stoneMat, crossSites.length);
  crossSites.forEach((it, i) => {
    q.setFromEuler(e.set(0, it.yaw, it.lean));
    m.compose(p.set(it.x, it.sink + 0.58 * it.tall, it.z), q, s.set(it.width, it.tall, it.width));
    upright.setMatrixAt(i, m);
    upright.setColorAt(i, col.setScalar(it.value));
    m.compose(p.set(it.x, it.sink + 0.82 * it.tall, it.z), q, s.set(it.width, it.tall, it.width));
    arms.setMatrixAt(i, m);
    arms.setColorAt(i, col.setScalar(it.value));
  });
  if (upright.instanceColor) upright.instanceColor.needsUpdate = true;
  if (arms.instanceColor) arms.instanceColor.needsUpdate = true;
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

  // A single broken funeral walk composes the arena from the back door to the
  // forest gate.  It is a value/texture read, never a collider or hue signal,
  // and its bends preserve broad combat loops around the car and mausoleums.
  const pathPos = [], pathUv = [], pathIdx = [];
  for (let i = 0; i < funeralPath.length - 1; i++) {
    const [ax, az] = funeralPath[i], [bx, bz] = funeralPath[i + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;
    const w0 = 0.92 + (i % 2) * 0.12, w1 = 0.98 + ((i + 1) % 2) * 0.11;
    const k = pathPos.length / 3;
    pathPos.push(
      ax + nx * w0, 0.025, az + nz * w0,
      ax - nx * w0, 0.025, az - nz * w0,
      bx + nx * w1, 0.025, bz + nz * w1,
      bx - nx * w1, 0.025, bz - nz * w1,
    );
    pathUv.push(0, i, 1, i, 0, i + 1, 1, i + 1);
    pathIdx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pathPos, 3));
  pathGeo.setAttribute('uv', new THREE.Float32BufferAttribute(pathUv, 2));
  pathGeo.setIndex(pathIdx);
  pathGeo.computeVertexNormals();
  const pathMat = own(cloneTint(game.mats?.dirt, 0x5b5e55,
    () => new THREE.MeshLambertMaterial({ color: 0x5b5e55 })));
  if ('roughness' in pathMat) pathMat.roughness = 1;
  const funeralWalk = new THREE.Mesh(pathGeo, pathMat);
  funeralWalk.receiveShadow = true;
  funeralWalk.name = 'broken funeral walk';
  track(funeralWalk, 1);

  // Lantern cages ration pale verticals at the path bends.  They are emissive
  // silhouettes only (no extra dynamic lights), keeping both performance and
  // combat visibility predictable.
  const lanternSites = [[-3.4, 15.6, -0.12], [0.45, 23.4, 0.08], [3.2, 32.0, -0.08]];
  const postMat = own(cloneTint(game.mats?.metal, 0x20262a,
    () => new THREE.MeshLambertMaterial({ color: 0x20262a })));
  if (postMat.color) postMat.color.multiplyScalar(0.38);
  const cageMat = own(new THREE.MeshBasicMaterial({ color: 0x343b3e, wireframe: true, fog: true }));
  const emberMat = own(new THREE.MeshBasicMaterial({ color: 0xe4e7d6, fog: true }));
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.07, 2.35, 6), postMat, lanternSites.length);
  const cages = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), cageMat, lanternSites.length);
  const embers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.105, 0), emberMat, lanternSites.length);
  lanternSites.forEach(([x, z, lean], i) => {
    q.setFromEuler(e.set(0, 0, lean));
    m.compose(p.set(x, 1.18, z), q, s.setScalar(1)); posts.setMatrixAt(i, m);
    m.compose(p.set(x - lean * 0.2, 2.28, z), q, s.setScalar(1)); cages.setMatrixAt(i, m);
    m.compose(p.set(x - lean * 0.2, 2.28, z), q, s.setScalar(1)); embers.setMatrixAt(i, m);
  });
  finishInstances(posts, true, true);
  finishInstances(cages, true, true);
  finishInstances(embers, false, false);
  posts.name = 'funeral walk lantern posts';
  cages.name = 'funeral walk lantern cages';
  embers.name = 'funeral walk pale embers';
  track(posts, lanternSites.length);
  track(cages, lanternSites.length);
  track(embers, lanternSites.length);

  // Three static mourners live at the outer combat boundary.  Their averted
  // heads make the yard feel inhabited without adding an enemy read or taking
  // one centimetre from the player capsule.
  const statueSites = [[-18.1, 12.8, 0.45], [21.5, 27.0, -0.75], [-17.6, 39.2, 0.18]];
  const statueMat = own(cloneTint(game.mats?.headstone, 0x69747a,
    () => new THREE.MeshLambertMaterial({ color: 0x69747a })));
  const plinths = new THREE.InstancedMesh(new THREE.BoxGeometry(0.84, 0.42, 0.84), statueMat, statueSites.length);
  const robes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.38, 1.62, 7), statueMat, statueSites.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), statueMat, statueSites.length);
  statueSites.forEach(([x, z, yaw], i) => {
    q.setFromEuler(e.set(0, yaw, 0));
    m.compose(p.set(x, 0.21, z), q, s.setScalar(1)); plinths.setMatrixAt(i, m);
    m.compose(p.set(x, 1.19, z), q, s.set(1, 1, 0.88)); robes.setMatrixAt(i, m);
    m.compose(p.set(x + Math.sin(yaw) * 0.08, 2.14, z + Math.cos(yaw) * 0.08), q, s.set(0.9, 1.18, 0.94)); heads.setMatrixAt(i, m);
  });
  finishInstances(plinths, true, true);
  finishInstances(robes, true, true);
  finishInstances(heads, true, true);
  plinths.name = 'mourner plinths'; robes.name = 'averted mourner robes'; heads.name = 'averted mourner heads';
  track(plinths, statueSites.length); track(robes, statueSites.length); track(heads, statueSites.length);

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
    t.name = 'atmosphere graveyard grass alpha';
    return ownTexture(t);
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
  for (let n = 0; n < 800; n++) {
    // past the rails now, too: the first metres beyond the fence were bald
    // dirt, and bald ground at the edge of frame is what "drops off onto
    // nothing" actually looks like
    const x = rng.range(-25.5, 29.5), z = rng.range(6.6, 46.0);
    if (Math.abs(x - 2) < 1.9 && z > 33) continue;             // keep the gate lane bare
    if (Math.abs(x) < 12 && z < 6.6) continue;                 // and the house apron
    if (z > 42.6 && Math.abs(x - 2) < 5) continue;             // and the way into the forest
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
  // These are pure silhouette: unlit, fogged, never approached.  The old
  // icosahedra read as a row of angular mountains; tapered yews read as trees.
  const treeTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 128;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 128);
    g.fillStyle = '#ffffff';
    g.fillRect(29, 91, 6, 37);
    // Irregular branch tiers make the distant boundary read as woods instead
    // of the old perfect-cone mountain saw. The texture is luminance-only.
    for (let tier = 0; tier < 9; tier++) {
      const y = 12 + tier * 10.2;
      const half = 7 + tier * 2.55 + Math.sin(tier * 3.7) * 2.1;
      g.beginPath();
      g.moveTo(32, Math.max(1, y - 13));
      g.lineTo(32 - half * 0.72, y + 2);
      g.lineTo(32 - half, y + 8 + (tier % 2) * 2);
      g.lineTo(32 - half * 0.36, y + 6);
      g.lineTo(32, y + 13);
      g.lineTo(32 + half * 0.42, y + 6);
      g.lineTo(32 + half, y + 9 - (tier % 2));
      g.lineTo(32 + half * 0.66, y + 1);
      g.closePath();
      g.fill();
    }
    const texture = new THREE.CanvasTexture(cv);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.name = 'atmosphere graveyard treeline alpha';
    return ownTexture(texture);
  })();
  const wallMat = own(new THREE.MeshBasicMaterial({
    color: 0x071016, map: treeTex, alphaTest: 0.42,
    side: THREE.DoubleSide, fog: true,
  }));
  const wallGeo = (() => {
    const geometry = new THREE.BufferGeometry();
    const positions = [], uv = [], indices = [];
    for (let k = 0; k < 2; k++) {
      const a = k * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), o = k * 4;
      positions.push(-c, 0, -sn, c, 0, sn, c, 1, sn, -c, 1, -sn);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  })();
  // The far ring at 44-70 m dissolves in 0.034 fog, and Alex looked SIDEWAYS
  // along the fence rather than at the horizon: "it still looks like empty
  // space that drops off onto nothing." A second, NEARER ring at 26-42 m sits
  // inside the band that still reads (~26% transmittance at 40 m), and it is
  // instances on the same InstancedMesh, so it costs exactly nothing.
  const trees = [];
  for (let i = 0; i < 156; i++) {
    trees.push({ a: rng.range(-0.35, Math.PI + 0.35), r: rng.range(44, 70),
      h: rng.range(8, 17), ry: rng.float() * TAU,
      w: rng.range(2.8, 5.7), d: rng.range(2.8, 5.7) });
  }
  for (let guard = 0, made = 0; guard < 400 && made < 76; guard++) {
    const a = rng.range(-0.55, Math.PI + 0.55);
    const r = rng.range(26, 42);
    const x = 2 + Math.cos(a) * r, z = 24 + Math.sin(a) * r * 0.85;
    // never in the walled yard, never in the gate's lane or the forest
    // corridor mouth, and never close enough to hide the key tree
    if (x > -23 && x < 27 && z > 4 && z < 43) continue;
    if (Math.abs(x - 2) < 13 && z > 40) continue;
    if (Math.hypot(x - 5.5, z - 13.6) < 12) continue;
    made++;
    trees.push({ a, r, h: rng.range(7, 14), ry: rng.float() * TAU,
      w: rng.range(2.6, 5.0), d: rng.range(2.6, 5.0) });
  }
  const wall = new THREE.InstancedMesh(wallGeo, wallMat, trees.length);
  trees.forEach((t, i) => {
    q.setFromEuler(e.set(0, t.ry, 0));
    m.compose(p.set(2 + Math.cos(t.a) * t.r, -0.4, 24 + Math.sin(t.a) * t.r * 0.85), q,
      s.set(t.w, t.h, t.d));
    wall.setMatrixAt(i, m);
  });
  finishInstances(wall, false, false);
  wall.name = 'far treeline silhouette';
  track(wall, trees.length);

  // Stable inspection data for deterministic composition/clearance probes.
  // It deliberately contains no progression state and owns no collisions.
  game.graveyardVisualLayout = {
    funeralPath: funeralPath.map(([x, z]) => ({ x, z })),
    lanternSites: lanternSites.map(([x, z]) => ({ x, z })),
    statueSites: statueSites.map(([x, z]) => ({ x, z })),
    stoneCount: stones.length,
    stoneFamilies: [...new Set(stones.map((stone) => stone.kind))],
  };
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

function makeShoulderedStoneGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.42, 0);
  shape.lineTo(-0.42, 0.7);
  shape.lineTo(-0.28, 0.92);
  shape.lineTo(-0.08, 0.86);
  shape.lineTo(0.08, 0.96);
  shape.lineTo(0.3, 0.84);
  shape.lineTo(0.42, 0.68);
  shape.lineTo(0.42, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16, curveSegments: 1, bevelEnabled: true,
    bevelSegments: 1, bevelSize: 0.025, bevelThickness: 0.022,
  });
  g.translate(0, 0, -0.08);
  g.computeVertexNormals();
  return g;
}

function makeBrokenStoneGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.39, 0);
  shape.lineTo(-0.39, 0.72);
  shape.lineTo(-0.17, 0.82);
  shape.lineTo(-0.03, 0.63);
  shape.lineTo(0.19, 0.79);
  shape.lineTo(0.39, 0.68);
  shape.lineTo(0.39, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18, curveSegments: 1, bevelEnabled: true,
    bevelSegments: 1, bevelSize: 0.02, bevelThickness: 0.018,
  });
  g.translate(0, 0, -0.09);
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

  // Far crowns supply depth behind the authored alpha-leaf canopy. Smooth,
  // raised ellipsoids avoid the old giant triangular underside while staying
  // far enough off the centreline that a straight-up look still sees layered
  // leaf holes and night beyond it.
  const canopyGeo = new THREE.SphereGeometry(1, 12, 8);
  const canopyPos = canopyGeo.attributes.position;
  for (let i = 0; i < canopyPos.count; i++) {
    const x = canopyPos.getX(i), y = canopyPos.getY(i), z = canopyPos.getZ(i);
    const wobble = 1 + Math.sin(x * 8.2 + z * 5.7 + y * 2.8) * 0.065;
    canopyPos.setXYZ(i, x * wobble, y * wobble * 0.68, z * wobble);
  }
  canopyGeo.computeVertexNormals();
  const canopyMat = own(new THREE.MeshLambertMaterial({
    color: 0x1b2520,
    emissive: 0x050906,
    emissiveIntensity: 0.18,
  }));
  const canopyMatrices = [];
  for (let i = 8; i < forestLength - 4; i += 8) {
    const sm = forest.samples[i];
    const hw = forest.halfW[i];
    const nx = -sm.tz, nz = sm.tx;
    for (const side of [-1, 1]) {
      const size = rng.range(1.15, 1.88);
      canopyMatrices.push(compose(
        sm.x + nx * side * (hw + rng.range(1.8, 3.5)),
        rng.range(7.4, 9.8),
        sm.z + nz * side * (hw + rng.range(1.8, 3.5)),
        rng.range(-0.2, 0.2), rng.range(0, TAU), rng.range(-0.2, 0.2),
        size * 1.35, size * 0.72, size * 1.22,
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
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const fronds = [
    { lean: 0.02, height: 1.14, width: 0.3, curve: 0.03, leaves: 7 },
    { lean: -0.34, height: 0.88, width: 0.23, curve: 0.11, leaves: 5 },
    { lean: 0.32, height: 0.92, width: 0.24, curve: -0.1, leaves: 5 },
  ];
  for (const [frondIndex, frond] of fronds.entries()) {
    const zBase = (frondIndex - 1) * 0.024;
    const endX = frond.lean;
    const endZ = zBase + frond.curve;
    const stem = 0.014;
    quad([-stem, 0, zBase], [stem, 0, zBase],
      [endX + stem, frond.height, endZ], [endX - stem, frond.height, endZ]);
    for (let i = 0; i < frond.leaves; i++) {
      const t = (i + 1) / (frond.leaves + 1);
      const cx = frond.lean * t;
      const cy = 0.08 + frond.height * t * 0.88;
      const cz = zBase + Math.sin(t * Math.PI) * frond.curve;
      const width = frond.width * (1 - t * 0.58);
      const rise = 0.07 + t * 0.065;
      for (const side of [-1, 1]) {
        const root = [cx + side * 0.012, cy, cz];
        const shoulder = [cx + side * width * 0.5, cy + rise * 0.32,
          cz + side * (0.018 + t * 0.018)];
        const tip = [cx + side * width, cy + rise,
          cz + side * (0.045 + t * 0.028)];
        const back = [cx + side * width * 0.36, cy + rise * 0.9,
          cz - side * 0.012];
        quad(root, shoulder, tip, back);
      }
    }
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
  const sideFalls = [
    [-14.4, 3.3, 10.8, -0.08], [-9.5, 2.5, 14.4, 0.05], [-5.3, 1.45, 8.4, -0.04],
    [5.4, 1.55, 9.5, 0.05], [9.7, 2.45, 15.8, -0.04], [14.7, 3.15, 12.1, 0.07],
  ];
  const feederPools = [
    { x: -13.4, z: -2.8, rx: 3.0, rz: 1.65 },
    { x: 12.8, z: -0.4, rx: 2.7, rz: 1.5 },
    { x: -7.2, z: 5.7, rx: 2.15, rz: 1.12 },
  ];

  // A low-poly talus facade dissolves the original monolithic cliff box.
  for (let y = 0.4; y < 18.8; y += 2.05) {
    for (let x = -29.0; x <= 29.0; x += 2.15) {
      if (Math.abs(x) < 3.35 && y < 18) continue;
      if (sideFalls.some(([fallX, width, height]) =>
        y < height + 0.55 && Math.abs(x - fallX) < width * 0.52 + 0.72)) continue;
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
    const z = CLEARING_BASIN.centerZ - Math.sin(a) * r;
    if (Math.abs(x) < 3.0) continue; // never counterfeit the bridge's collision language
    const scale = rng.range(0.45, 1.15);
    matrices.push(compose(C.x + x, rng.range(-0.1, 0.3), C.z + z,
      rng.range(-0.3, 0.3), rng.range(0, TAU), rng.range(-0.3, 0.3), scale * 1.5, scale, scale * 1.2));
    colours.push(darkRock.clone().multiplyScalar(rng.range(0.78, 1.12)));
  }

  // THE LIP, and it is SOLID. Round five: the plunge pool is the only walk-in
  // death water in the game (director.js kills below y -1.5 in this act), and a
  // player driven at it from 24 bearings drowned on most of them. His answer,
  // and the right one: ring the water line with bank you cannot walk through.
  //
  // These are instances on the talus mesh that is already being built two
  // dozen lines above, so the whole ring costs no draw call and no geometry —
  // and, more to the point, it inherits the talus VALUE. The first attempt used
  // world.box(M.rock), which is also free, and the shot showed exactly what
  // round four learned from the falls kin: a lit MeshStandard blows to white
  // under the lantern, and the shore came out as a run of pale slabs — his
  // "concrete/brick" complaint moved to the water's edge. Rock has to be lit
  // like the rock beside it.
  //
  // The lane (|x| < 3.05, widening to 3.4 where it passes the veil) is the one
  // gap: the bridge stones rise through it, and outside.js bars it with a sill
  // that sinks when they do.
  {
    const world = game.world;
    const ground = game.world.terrainHeight;
    const LIP_R = CLEARING_BASIN.outerR + 0.1;
    const LANE = 3.05, VEIL_LANE = 3.4, VEIL_Z = 18.5;
    const RING = 52;
    for (let i = 0; i < RING; i++) {
      const th = (i / RING) * TAU;                 // 0 = the near shore, PI = the falls
      const r = LIP_R + rng.range(-0.2, 0.2);
      const x = Math.sin(th) * r;
      const z = CLEARING_BASIN.centerZ - Math.cos(th) * r;
      if (Math.abs(x) < (z > VEIL_Z ? VEIL_LANE : LANE)) continue;
      // Stop short of the Underfalls' own ground (its bounds begin at z+20.35).
      // A collider past that line is an invisible rock INSIDE the cave, and
      // "I walked behind the first wall" is already one of his notes — the shore
      // must not answer it with a stone he cannot see. The water north of here
      // is unreachable anyway: everything inside the ring is behind the ring.
      if (z > 19.8) continue;
      const y = ground ? ground(C.x + x, C.z + z) : 0;
      const scale = rng.range(0.86, 1.12);
      const w = scale * 1.55, h = scale * 1.02, d = scale * 1.2;
      // Seated so the crown stands ~0.9 over the ground: STEP_UP is 0.5, so
      // this is a lip you go around, not a kerb you stroll over.
      const cy = y + h * 0.42;
      matrices.push(compose(C.x + x, cy, C.z + z,
        rng.range(-0.22, 0.22), rng.range(0, TAU), rng.range(-0.22, 0.22), w, h, d));
      // Darker than the shoulders behind them BECAUSE they are the rock the
      // player walks up to: the lantern is most of what lights anything within
      // two metres, and at the shoulders' value this ring photographed as a run
      // of pale slabs (near-band mean 77 against a 13-30 scene). Value is also
      // the only channel he reads — no part of this may lean on hue.
      colours.push(darkRock.clone().multiplyScalar(rng.range(0.34, 0.52)));
      const half = Math.max(w, d) * 0.62;
      world.addCollider(C.x + x - half, y - 1.4, C.z + z - half,
        C.x + x + half, cy + h * 0.62, C.z + z + half);
    }

    // AND THE NORTH LIP, straight, because the circle cannot reach it. The
    // ring has to stop short of the Underfalls' ground at z+20.35, which
    // leaves the water either side of the crossing's LAST stones open — and
    // that is where he died entering the cave: the cave's lateral clamp only
    // engages once the act flips at z+20.35, so a step sideways at z 19-20 is
    // still the clearing, still three metres deep, and still fatal. Two short
    // runs close it against the falls, leaving the lane itself untouched.
    // These stand IN the water, not on the bottom. The first attempt seated
    // them on ground() like the ring, and ground() out here is the basin floor
    // three to five metres down — the colliders came out with their tops at
    // y -0.32, -1.23, -2.33, entirely below the player, and the shore probe
    // walked over them into the deep exactly as before. One crown height for
    // the whole run, taken from its dry end, and each stone grown downward to
    // meet whatever is under it.
    const shoreY = ground ? ground(C.x + 8.1, C.z + 19.75) : 0;
    for (const side of [-1, 1]) {
      for (let x = 3.5; x <= 7.6; x += 0.9) {
        const bx = side * x;
        const bz = 19.75 + (x % 1.8 < 0.9 ? 0.12 : -0.14);
        const floor = ground ? ground(C.x + bx, C.z + bz) : 0;
        const top = shoreY + rng.range(0.82, 0.98);
        const scale = rng.range(0.9, 1.12);
        const w = scale * 1.5, d = scale * 1.2;
        const h = Math.max(1.05, top - floor + 0.4);
        matrices.push(compose(C.x + bx, top - h * 0.5, C.z + bz,
          rng.range(-0.16, 0.16), rng.range(0, TAU), rng.range(-0.16, 0.16), w, h, d));
        colours.push(darkRock.clone().multiplyScalar(rng.range(0.34, 0.52)));
        const half = Math.max(w, d) * 0.6;
        world.addCollider(C.x + bx - half, Math.min(floor, top) - 0.5, C.z + bz - half,
          C.x + bx + half, top, C.z + bz + half);
      }
    }
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
    uniforms: { uTime: { value: 0 }, uSeal: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uSeal;
      void main(){
        vUv = uv;
        vec3 p = position;
        float edge = sin(uv.y * 24.0 + uTime * 5.0 + uv.x * 17.0);
        p.x += edge * 0.045 * sin(uv.x * 3.14159);
        p.z += sin(uv.y * 38.0 - uTime * 7.0 + uv.x * 11.0) * 0.035;
        vec4 localPosition = vec4(p, 1.0);
        #ifdef USE_INSTANCING
          localPosition = instanceMatrix * localPosition;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * localPosition;
      }
    `,
    // One sine at 82 cycles across the width, crossed with another at 58 down
    // it, is a plaid — and that is exactly what the falls read as: corrugated
    // plastic, the single least convincing surface in the game and the backdrop
    // of its most important beat. Water does not have one frequency. This is
    // three ribbon widths of value noise, none of them periodic on screen, all
    // of them FALLING: packets run down the sheet and accelerate as they go,
    // the lip stays glassy enough to see the rock through, and the whole thing
    // breaks into foam by the time it reaches the basin.
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uSeal;
      float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
      float bands(float x, float f, float s){
        float p = x * f + s;
        float i = floor(p), q = fract(p);
        q = q * q * (3.0 - 2.0 * q);
        return mix(h11(i), h11(i + 1.0), q);
      }
      void main(){
        float x = vUv.x, y = vUv.y, t = uTime;
        float w1 = bands(x + sin(y * 2.6 + t * 0.5) * 0.010, 7.0, 0.0);
        float w2 = bands(x + sin(y * 5.1 - t * 0.8) * 0.016, 17.0, 5.1);
        float w3 = bands(x, 41.0, 13.7);
        float ribbon = w1 * 0.52 + w2 * 0.31 + w3 * 0.17;
        // gravity: the run repeats faster the further it has fallen. Two runs
        // at different rates and phases, both smeared wide — one crisp run
        // draws a chevron front right across the sheet, which is just the
        // barcode again lying on its side.
        float runA = fract(y * 1.4 + t * (0.85 + 1.5 * (1.0 - y)) + w2 * 3.1 + w3 * 1.3);
        float runB = fract(y * 2.3 - t * (1.15 + 0.9 * (1.0 - y)) + w1 * 4.7);
        float packet = smoothstep(0.18, 1.0, runA) * 0.62 + smoothstep(0.3, 1.0, runB) * 0.38;
        float breakUp = smoothstep(0.88, 0.12, y);        // glassy at the lip
        float foot = 1.0 - smoothstep(0.0, 0.21, y);      // foam in the basin
        float bright = ribbon * 0.55 + packet * breakUp * 0.5 + foot * 0.8;
        float edge = smoothstep(0.0, 0.13, x) * smoothstep(0.0, 0.13, 1.0 - x);
        vec3 col = mix(vec3(0.14,0.27,0.37), vec3(0.80,0.92,0.97), clamp(bright, 0.0, 1.0));
        float alpha = edge * (0.20 + ribbon * 0.33 + packet * breakUp * 0.26 + foot * 0.32)
                    * (1.0 - uSeal * 0.94);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }
    `,
  }));
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(6.75, 18.9, 20, 56), waterMat);
  fall.position.set(C.x, 9.5, C.z + 19.70);
  fall.name = 'layered waterfall veil';
  track(fall, 1);
  let sealT = 0;
  tickers.push((dt, t) => {
    waterMat.uniforms.uTime.value = t % 600;
    const sealed = game.flags?.has('waterfallTaken') && game.act === 'cave';
    sealT += ((sealed ? 1 : 0) - sealT) * Math.min(1, dt * 0.62);
    waterMat.uniforms.uSeal.value = sealT;
  });

  // DUSKFALL's strongest waterfall lesson was depth, not one bright rectangle:
  // narrow side cataracts, each with a different drop and lean, turn the whole
  // cliff into a watershed while the central veil remains the progression read.
  const sideWaterMat = own(waterMat.clone());
  sideWaterMat.uniforms.uSeal.value = 0;
  const sideGeo = new THREE.PlaneGeometry(1, 1, 5, 22);
  const sideMesh = new THREE.InstancedMesh(sideGeo, sideWaterMat, sideFalls.length);
  sideFalls.forEach(([x, w, h, lean], i) => {
    sideMesh.setMatrixAt(i, compose(C.x + x, h * 0.5 + 0.12, C.z + 19.66,
      0, 0, lean, w, h, 1));
  });
  finishInstances(sideMesh, false, false);
  sideMesh.name = 'six side cataracts';
  track(sideMesh, sideFalls.length);
  tickers.push((dt, t) => { sideWaterMat.uniforms.uTime.value = (t * 0.91) % 600; });

  // Never draw a luminous ruler across the top of a fall. The old box lips
  // exposed exactly how the water planes were suspended and their rectangular
  // side cuts read like shower curtains. Irregular rock crowns now overlap the
  // top seam while wet buttress stones step down both cut edges. Broken foam
  // beads occupy only the gaps, so the authored skull aperture stays open.
  const edgeRng = new RNG(0xfa115eed);
  const edgeMatrices = [], edgeColours = [], foamMatrices = [];
  const addEdgeRock = (x, y, sx, sy, sz, lean = 0) => {
    edgeMatrices.push(compose(x, y, C.z + 19.28 + edgeRng.range(-0.08, 0.12),
      edgeRng.range(-0.42, 0.42), edgeRng.range(0, TAU), lean + edgeRng.range(-0.28, 0.28),
      sx, sy, sz));
    edgeColours.push(wetRock.clone().multiplyScalar(edgeRng.range(0.58, 0.86)));
  };
  const crown = (x, w, h, lean, central = false) => {
    const chunks = Math.max(4, Math.ceil(w / 0.72));
    for (let k = 0; k < chunks; k++) {
      const localX = -w * 0.5 + ((k + 0.5) / chunks) * w;
      const y = h + Math.tan(lean) * localX + edgeRng.range(-0.28, 0.34);
      const gap = central && Math.abs(localX) < 0.62;
      if (!gap || k % 2 === 0) {
        addEdgeRock(C.x + x + localX, y, edgeRng.range(0.48, 0.82),
          edgeRng.range(0.32, 0.58), edgeRng.range(0.5, 0.84), lean);
      }
      if (k % 2 === 0 || edgeRng.chance(0.34)) {
        foamMatrices.push(compose(C.x + x + localX + edgeRng.range(-0.18, 0.18),
          y - edgeRng.range(0.18, 0.42), C.z + 19.18,
          0, edgeRng.range(0, TAU), lean,
          edgeRng.range(0.22, 0.48), edgeRng.range(0.08, 0.17), edgeRng.range(0.16, 0.3)));
      }
    }
  };
  for (const [x, w, h, lean] of sideFalls) {
    crown(x, w, h, lean, false);
    for (const side of [-1, 1]) {
      for (let y = 0.65; y < h - 0.55; y += edgeRng.range(1.05, 1.45)) {
        // Stagger rather than tile: water still flashes between the stones,
        // but no uninterrupted ruler-straight cut survives.
        const localX = side * w * 0.51 + edgeRng.range(-0.18, 0.18);
        addEdgeRock(C.x + x + localX - Math.sin(lean) * (y - h * 0.5),
          y + Math.sin(lean) * localX + edgeRng.range(-0.16, 0.16),
          edgeRng.range(0.42, 0.74), edgeRng.range(0.48, 0.82), edgeRng.range(0.48, 0.8), lean);
      }
    }
  }
  crown(0, 6.75, 18.9, 0, true);
  for (const side of [-1, 1]) {
    for (let y = 1.1; y < 18.1; y += edgeRng.range(1.35, 1.8)) {
      addEdgeRock(C.x + side * 3.35 + edgeRng.range(-0.22, 0.18), y,
        edgeRng.range(0.55, 0.9), edgeRng.range(0.58, 0.96), edgeRng.range(0.58, 0.92));
    }
  }
  const edgeRocks = new THREE.InstancedMesh(rockGeo, rockMat, edgeMatrices.length);
  edgeMatrices.forEach((matrix, i) => {
    edgeRocks.setMatrixAt(i, matrix);
    edgeRocks.setColorAt(i, edgeColours[i]);
  });
  finishInstances(edgeRocks, true, true);
  edgeRocks.name = 'cataract rock crowns and buttresses';
  track(edgeRocks, edgeMatrices.length);

  const lipMat = own(new THREE.MeshBasicMaterial({
    color: 0xc5d9dc, transparent: true, opacity: 0.28,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const lips = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 4), lipMat, foamMatrices.length);
  foamMatrices.forEach((matrix, i) => lips.setMatrixAt(i, matrix));
  finishInstances(lips, false, false);
  lips.name = 'broken cataract lip foam';
  track(lips, foamMatrices.length);

  // Only after the player crosses does the promised water become a rock seal
  // behind them. It never collides or steals control; it is a silhouette and a
  // one-way emotional fact, not another door mechanic.
  const sealMat = own(cloneTint(game.mats?.rock, 0x10191d,
    () => new THREE.MeshStandardMaterial({ color: 0x10191d, roughness: 0.95 })));
  sealMat.transparent = true;
  sealMat.opacity = 0;
  sealMat.depthWrite = false;
  const sealMatrices = [];
  for (let y = 0.55; y <= 6.1; y += 1.25) {
    for (let x = -2.35; x <= 2.35; x += 1.12) {
      sealMatrices.push(compose(C.x + x + Math.sin(y * 3.7 + x) * 0.18,
        y, C.z + 19.92 + Math.sin(x * 4.1) * 0.13,
        x * 0.08, y * 0.21, x * -0.11, 0.78, 0.74, 0.62));
    }
  }
  const seal = new THREE.InstancedMesh(rockGeo, sealMat, sealMatrices.length);
  sealMatrices.forEach((matrix, i) => seal.setMatrixAt(i, matrix));
  finishInstances(seal, true, true);
  seal.name = 'waterfall stone seal silhouette';
  track(seal, sealMatrices.length);
  tickers.push(() => { sealMat.opacity = sealT * 0.97; });
  if (game.underfalls) game.underfalls.veilSeal = { mesh: seal, material: sealMat, get progress() { return sealT; } };

  // Foam, lifting mist, and a few warm fireflies share one draw call.  Their
  // size, motion, and brightness—not red/green identity—carry their roles.
  const p = [];
  const phase = [];
  const kind = [];
  for (let i = 0; i < 150; i++) {
    const a = rng.range(0, TAU), r = Math.sqrt(rng.float()) * 5.9;
    p.push(C.x + Math.cos(a) * r, 0.12 + rng.range(0, 0.18), C.z + CLEARING_BASIN.centerZ + Math.sin(a) * r * 0.55);
    phase.push(rng.range(0, TAU)); kind.push(0);
  }
  for (let i = 0; i < 105; i++) {
    p.push(C.x + rng.range(-5.2, 5.2), rng.range(0.18, 3.0), C.z + rng.range(14.0, 19.4));
    phase.push(rng.range(0, TAU)); kind.push(1);
  }
  for (let i = 0; i < 84; i++) {
    const fall = sideFalls[i % sideFalls.length];
    p.push(C.x + fall[0] + rng.range(-fall[1] * 0.55, fall[1] * 0.55),
      rng.range(0.1, Math.min(3.4, fall[2] * 0.35)), C.z + rng.range(18.65, 19.55));
    phase.push(rng.range(0, TAU)); kind.push(1);
  }
  for (let i = 0; i < 34; i++) {
    p.push(C.x + rng.range(-17, 17), rng.range(0.35, 2.8), C.z + rng.range(-9, 10));
    phase.push(rng.range(0, TAU)); kind.push(2);
  }
  for (const pool of feederPools) {
    for (let i = 0; i < 12; i++) {
      const a = rng.range(0, TAU);
      p.push(C.x + pool.x + Math.cos(a) * rng.range(pool.rx * 0.65, pool.rx * 1.12),
        rng.range(0.22, 1.18),
        C.z + pool.z + Math.sin(a) * rng.range(pool.rz * 0.7, pool.rz * 1.18));
      phase.push(rng.range(0, TAU)); kind.push(2);
    }
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

  // The waterfall used to own the only composed view in the oasis. Turning
  // sideways revealed empty black terrain and a distant row of flat trees,
  // which made the sincere clearing feel like a set facing rather than a
  // place. Two shallow feeder waters and a pale-barked side grove now give the
  // player a watershed to stand inside. They are deliberately decorative:
  // the central plunge basin and its stone bridge remain the only progression
  // collision language.
  // A horizontal pool cannot reuse the waterfall's vertical ribbon shader:
  // its UV edge mask turns a grazing-angle pond into a luminous ruler. These
  // surfaces are dark, broad reflections with just enough self-value to read
  // their shape when the skull-light is elsewhere.
  const feederWaterMat = own(new THREE.MeshStandardMaterial({
    color: 0x21424a,
    roughness: 0.24,
    metalness: 0.2,
    emissive: 0x0b1c20,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const feederMatrices = [];
  for (const pool of feederPools) {
    const y = game.world.groundHeightAt(C.x + pool.x, C.z + pool.z, 2) + 0.055;
    feederMatrices.push(compose(C.x + pool.x, y, C.z + pool.z,
      -Math.PI / 2, 0, 0, pool.rx, pool.rz, 1));
  }
  const feederPoolMesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 24), feederWaterMat, feederMatrices.length,
  );
  feederMatrices.forEach((matrix, i) => feederPoolMesh.setMatrixAt(i, matrix));
  finishInstances(feederPoolMesh, false, false);
  feederPoolMesh.name = 'three clearing feeder pools';
  track(feederPoolMesh, feederMatrices.length);

  const feederPos = [];
  const feederUv = [];
  const feederIdx = [];
  const addFeeder = (points, widths) => {
    const base = feederPos.length / 3;
    let travelled = 0;
    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const tx = next[0] - prev[0], tz = next[1] - prev[1];
      const length = Math.hypot(tx, tz) || 1;
      const nx = -tz / length, nz = tx / length;
      if (i > 0) travelled += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      const half = widths[i] * 0.5;
      const x = C.x + points[i][0], z = C.z + points[i][1];
      const y = game.world.groundHeightAt(x, z, 2) + 0.06;
      feederPos.push(x - nx * half, y, z - nz * half, x + nx * half, y, z + nz * half);
      feederUv.push(0, travelled * 0.18, 1, travelled * 0.18);
      if (i > 0) {
        const a = base + (i - 1) * 2, b = base + i * 2;
        feederIdx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  };
  addFeeder([[-13.4, -1.3], [-11.8, 0.2], [-10.2, 2.0], [-8.7, 4.4], [-6.6, 7.0]],
    [1.05, 0.92, 0.82, 0.74, 0.68]);
  addFeeder([[12.8, 0.9], [11.5, 2.4], [10.1, 4.2], [8.2, 5.7], [6.4, 7.5]],
    [0.98, 0.9, 0.78, 0.72, 0.66]);
  const feederGeo = new THREE.BufferGeometry();
  feederGeo.setAttribute('position', new THREE.Float32BufferAttribute(feederPos, 3));
  feederGeo.setAttribute('uv', new THREE.Float32BufferAttribute(feederUv, 2));
  feederGeo.setIndex(feederIdx);
  feederGeo.computeVertexNormals();
  const feederStreams = new THREE.Mesh(feederGeo, feederWaterMat);
  feederStreams.name = 'paired oasis feeder streams';
  feederStreams.receiveShadow = true;
  track(feederStreams, 1);

  const terraceMatrices = [];
  for (const pool of feederPools) {
    for (let i = 0; i < 13; i++) {
      const a = i / 13 * TAU;
      const x = C.x + pool.x + Math.cos(a) * pool.rx * 1.04;
      const z = C.z + pool.z + Math.sin(a) * pool.rz * 1.04;
      const y = game.world.groundHeightAt(x, z, 2) + rng.range(0.02, 0.14);
      const s = rng.range(0.28, 0.56);
      terraceMatrices.push(compose(x, y, z, rng.range(-0.3, 0.3), a,
        rng.range(-0.3, 0.3), s * 1.35, s * 0.72, s));
    }
  }
  const terraceRocks = new THREE.InstancedMesh(rockGeo, rockMat, terraceMatrices.length);
  terraceMatrices.forEach((matrix, i) => terraceRocks.setMatrixAt(i, matrix));
  finishInstances(terraceRocks, true, true);
  terraceRocks.name = 'feeder pool stone terraces';
  track(terraceRocks, terraceMatrices.length);

  const groveBark = own(new THREE.MeshStandardMaterial({
    color: 0x71807a, roughness: 0.96, metalness: 0,
    emissive: 0x111b18, emissiveIntensity: 0.14,
  }));
  const groveLeaf = own(new THREE.MeshLambertMaterial({
    color: 0x314a3d, emissive: 0x0b1710, emissiveIntensity: 0.15,
  }));
  const groveTrunkGeo = new THREE.CylinderGeometry(0.13, 0.25, 1, 7);
  const groveBranchGeo = new THREE.CylinderGeometry(0.055, 0.105, 1, 6);
  const groveCrownGeo = new THREE.SphereGeometry(1, 10, 7);
  const trunkMatrices = [];
  const branchMatrices = [];
  const crownMatrices = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const x = side * (15.2 + (i % 5) * 1.7 + rng.range(-0.55, 0.55));
      const z = -14.4 + i * 1.72 + rng.range(-0.75, 0.75);
      if (z > 12.8) continue;
      const y = game.world.groundHeightAt(C.x + x, C.z + z, 3);
      const h = rng.range(5.4, 8.4);
      const lean = side * rng.range(-0.09, 0.05);
      trunkMatrices.push(compose(C.x + x, y + h * 0.5, C.z + z,
        lean, rng.range(0, TAU), rng.range(-0.06, 0.06), 1, h, 1));
      const top = new THREE.Vector3(C.x + x + lean * h * 0.7,
        y + h * 0.78, C.z + z);
      const forkA = top.clone().add(new THREE.Vector3(side * rng.range(0.7, 1.2),
        rng.range(0.9, 1.45), rng.range(-0.8, 0.8)));
      const forkB = top.clone().add(new THREE.Vector3(-side * rng.range(0.45, 0.9),
        rng.range(0.7, 1.25), rng.range(-0.75, 0.75)));
      branchMatrices.push(segmentMatrix(top, forkA, rng.range(0.72, 1.0)));
      branchMatrices.push(segmentMatrix(top, forkB, rng.range(0.62, 0.9)));
      const crownSites = [
        forkA.clone().add(new THREE.Vector3(0, rng.range(0.35, 0.7), 0)),
        forkB.clone().add(new THREE.Vector3(0, rng.range(0.25, 0.62), 0)),
        top.clone().add(new THREE.Vector3(rng.range(-0.35, 0.35), rng.range(1.3, 1.85), rng.range(-0.3, 0.3))),
      ];
      for (let lobe = 0; lobe < crownSites.length; lobe++) {
        const crownSize = rng.range(0.92, 1.48) * (lobe === 2 ? 1.12 : 1);
        crownMatrices.push(compose(crownSites[lobe].x, crownSites[lobe].y, crownSites[lobe].z,
          rng.range(-0.28, 0.28), rng.range(0, TAU), rng.range(-0.28, 0.28),
          crownSize * rng.range(1.15, 1.55), crownSize * rng.range(0.62, 0.88),
          crownSize * rng.range(0.9, 1.25)));
      }
    }
  }
  // A few storm-thrown trunks make the pools feel found rather than placed.
  // They share the branch draw and sit on the outer bank, never across the
  // central route or the progression basin.
  for (const pool of feederPools) {
    const bankZ = C.z + pool.z + pool.rz * 1.16;
    const bankY = game.world.groundHeightAt(C.x + pool.x, bankZ, 3) + 0.18;
    const a = new THREE.Vector3(C.x + pool.x - pool.rx * 0.72, bankY, bankZ);
    const b = new THREE.Vector3(C.x + pool.x + pool.rx * 0.72, bankY + 0.12, bankZ + 0.14);
    branchMatrices.push(segmentMatrix(a, b, 2.2));
    const fork = b.clone().add(new THREE.Vector3(pool.x < 0 ? -0.7 : 0.7, 0.45, 0.52));
    branchMatrices.push(segmentMatrix(b.clone().lerp(a, 0.22), fork, 1.25));
  }
  const groveTrunks = new THREE.InstancedMesh(groveTrunkGeo, groveBark, trunkMatrices.length);
  trunkMatrices.forEach((matrix, i) => groveTrunks.setMatrixAt(i, matrix));
  finishInstances(groveTrunks, true, true);
  groveTrunks.name = 'moon-pale clearing side grove';
  track(groveTrunks, trunkMatrices.length);
  const groveBranches = new THREE.InstancedMesh(groveBranchGeo, groveBark, branchMatrices.length);
  branchMatrices.forEach((matrix, i) => groveBranches.setMatrixAt(i, matrix));
  finishInstances(groveBranches, true, true);
  groveBranches.name = 'forked clearing grove branches';
  track(groveBranches, branchMatrices.length);
  const groveCrowns = new THREE.InstancedMesh(groveCrownGeo, groveLeaf, crownMatrices.length);
  crownMatrices.forEach((matrix, i) => groveCrowns.setMatrixAt(i, matrix));
  finishInstances(groveCrowns, false, false);
  groveCrowns.name = 'clearing side grove crowns';
  track(groveCrowns, crownMatrices.length);

  game.clearingPlacehood = {
    feederPools: feederPools.length,
    feederStreams: 2,
    terraceStones: terraceMatrices.length,
    groveTrees: trunkMatrices.length,
    groveBranches: branchMatrices.length,
    groveCrownLobes: crownMatrices.length,
  };
}

// -------------------------------------------------------------------- cave
function buildCaveDress(game, track, own, tickers) {
  const C = game.clearingCenter;
  if (!C) return;
  const layout = game.underfalls?.layout;
  const path = layout?.main?.map((p) => [p.x, p.z, p.y, p.w]) || [
    [C.x, C.z + 22, 0, 2.2], [C.x + 2, C.z + 30, 0, 2.2],
    [C.x + 7, C.z + 36, 0, 2.2], [C.x + 14, C.z + 40, 0, 2.2],
    [C.x + 22, C.z + 42, 0, 2.2],
  ];
  const rng = new RNG(0xca9e51de);
  // Dress rocks may thicken walls but never stand in walkable space: every
  // wall-skin, ring, and floor-spike instance is projected against the FULL
  // route union (main + secret corridors + chambers) and pushed outward
  // along its radial until its footprint clears the lane;
  // centerline-degenerate instances have no radial and are dropped. Each
  // push re-projects, so a rock leaving one leg cannot land inside a
  // neighbouring leg or the secret culvert. Deliberately elevation-blind:
  // crossing corridors sit at different storeys (bell cistern vs service
  // climb), so an "overhead" course by its own floor can be head-height in
  // the lane it intrudes on. Only the mid-lane ceiling course and hanging
  // teeth stay exempt — they roof the corridor by design.
  const clearOfRoute = (x, z, half) => {
    if (!layout) return { x, z };
    const margin = half + 0.35;
    let px = x, pz = z;
    for (let guard = 0; guard < 6; guard++) {
      const p = projectUnderfalls(layout, px, pz);
      if (!p || p.clearance >= margin) return { x: px, z: pz };
      if (p.d < 1e-4) return null;
      const push = margin - p.clearance + 0.01;
      px += (px - p.cx) / p.d * push;
      pz += (pz - p.cz) / p.d * push;
    }
    const p = projectUnderfalls(layout, px, pz);
    return p && p.clearance >= margin ? { x: px, z: pz } : null;
  };
  const rockMat = own(cloneTint(game.mats?.rock, 0x3e4c56,
    () => new THREE.MeshStandardMaterial({ color: 0x3e4c56, roughness: 0.88, metalness: 0.03 })));
  if ('roughness' in rockMat) rockMat.roughness = 0.88;
  if ('emissive' in rockMat) {
    rockMat.emissive.setHex(0x071015);
    rockMat.emissiveIntensity = 0.23;
  }
  const rockMatrices = [];
  const rockTiers = [];   // 0 = floor course, 3 = ceiling course — the value ladder

  for (let leg = 0; leg < path.length - 1; leg++) {
    const [ax, az, ay = 0, aw = 2.2] = path[leg];
    const [bx, bz, by = 0, bw = 2.2] = path[leg + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len;
    const nx = tz, nz = -tx;
    const n = Math.max(6, Math.round(len / 0.92));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + dx * t, z = az + dz * t;
      const floorY = ay + (by - ay) * t;
      const halfW = aw + (bw - aw) * t;
      const inChamber = layout?.chambers?.some((chamber) =>
        Math.hypot(x - chamber.x, z - chamber.z) < chamber.r * 0.94);
      if (inChamber) continue;
      for (const side of [-1, 1]) {
        // Four interlocked low-poly stones turn the structural wall backing
        // into a continuous, irregular cave silhouette.  Their inner edge
        // remains just outside the authored 1.65m movement spine — enforced
        // against the whole union, not just this leg, so skin from one leg
        // can never stand inside a crossing corridor.
        for (const layerY of [0.48, 1.38, 2.28, 3.14]) {
          const sc = rng.range(0.42, 0.64);
          const offX = rng.range(0.92, 1.28);
          const jitterY = rng.range(-0.16, 0.16);
          const offZ = rng.range(0.92, 1.28);
          const rotX = rng.range(-0.48, 0.48);
          const rotY = rng.range(0, TAU);
          const rotZ = rng.range(-0.48, 0.48);
          const sx = sc * rng.range(0.82, 1.0);
          const sy = sc * rng.range(1.02, 1.34);
          const sz = sc * rng.range(0.92, 1.18);
          const placed = clearOfRoute(
            x + nx * side * (halfW + offX), z + nz * side * (halfW + offZ),
            Math.max(sx, sz));
          if (!placed) continue;
          rockTiers.push([0.48, 1.38, 2.28, 3.14].indexOf(layerY));
          rockMatrices.push(compose(
            placed.x, floorY + layerY + jitterY, placed.z,
            rotX, rotY, rotZ, sx, sy, sz,
          ));
        }
      }
      if (i % 2 === 0) {
        const sc = rng.range(0.34, 0.52);
        rockTiers.push(3);
        rockMatrices.push(compose(x + rng.range(-halfW * 0.58, halfW * 0.58), floorY + 4.62, z + rng.range(-halfW * 0.58, halfW * 0.58),
          rng.range(-0.24, 0.24), rng.range(0, TAU), rng.range(-0.24, 0.24), sc * 1.35, sc * 0.58, sc * 1.12));
      }
    }
  }
  if (layout?.chambers) {
    for (const chamber of layout.chambers) {
      const n = Math.max(14, Math.round(chamber.r * 2.8));
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        // The full ring never consulted the corridors crossing each rim; the
        // union guard turns those crossings into real doorways instead of a
        // rock fence across the walkable lane.
        for (const layerY of [0.58, 1.72, 2.86, 4.02]) {
          const scale = rng.range(0.46, 0.68);
          const ringA = rng.range(1.02, 1.42);
          const jitterY = rng.range(-0.14, 0.14);
          const ringB = rng.range(1.02, 1.42);
          const rotX = rng.range(-0.42, 0.42);
          const rotYJ = rng.range(-0.35, 0.35);
          const rotZ = rng.range(-0.42, 0.42);
          const sy = scale * rng.range(1.18, 1.55);
          const placed = clearOfRoute(
            chamber.x + Math.cos(a) * (chamber.r + ringA),
            chamber.z + Math.sin(a) * (chamber.r + ringB),
            scale * 1.08);
          if (!placed) continue;
          rockTiers.push([0.58, 1.72, 2.86, 4.02].indexOf(layerY));
          rockMatrices.push(compose(
            placed.x, chamber.y + layerY + jitterY, placed.z,
            rotX, a + rotYJ, rotZ, scale * 1.08, sy, scale,
          ));
        }
      }
    }
  }
  // The value ladder (textures.js's own law: pale > ceiling > walls > floors).
  // One flat material made 1165 wall stones read as undifferentiated noise —
  // floor course and ceiling course were the same grey, so the eye had no
  // horizon anywhere in the district. Four courses, brightest at the floor,
  // darkening upward; the gradient lives in BOTH diffuse and emissive so it
  // survives the stretches no light reaches. First tier keeps the canonical
  // name and carries the other three, so the district culler still finds one
  // batch.
  const rockGeoCave = new THREE.DodecahedronGeometry(1, 0);
  const TIER_VALUE = [1.0, 0.84, 0.7, 0.56];
  let caveRocks = null;
  TIER_VALUE.forEach((value, tier) => {
    const idx = [];
    for (let i = 0; i < rockMatrices.length; i++) if (rockTiers[i] === tier) idx.push(i);
    if (!idx.length) return;
    const mat = own(rockMat.clone());
    mat.color.multiplyScalar(value);
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = rockMat.emissiveIntensity * value;
    const mesh = new THREE.InstancedMesh(rockGeoCave, mat, idx.length);
    idx.forEach((src, k) => mesh.setMatrixAt(k, rockMatrices[src]));
    finishInstances(mesh, true, true);
    track(mesh, idx.length);
    if (!caveRocks) {
      caveRocks = mesh;
      mesh.name = 'cave broken wall skin';
    } else {
      mesh.name = `cave broken wall skin course ${tier + 1}`;
      caveRocks.add(mesh);
    }
  });

  if (layout?.chambers) {
    const capMatrices = layout.chambers.map((chamber) => compose(
      chamber.x, chamber.y + (chamber.name === 'drowned pump chapel' ? 5.72 : 5.18), chamber.z,
      0, Math.sin(chamber.x * 0.13) * 0.18, 0,
      chamber.r * 0.96, 0.34, chamber.r * 0.96,
    ));
    const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12), rockMat, capMatrices.length);
    capMatrices.forEach((matrix, i) => caps.setMatrixAt(i, matrix));
    finishInstances(caps, true, true);
    caps.name = 'underfalls chamber ceiling vaults';
    track(caps, capMatrices.length);
  }

  const toothMat = own(cloneTint(game.mats?.rock, 0x5b6670,
    () => new THREE.MeshLambertMaterial({ color: 0x5b6670 })));
  const toothMatrices = [];
  for (let leg = 0; leg < path.length - 1; leg++) {
    const [ax, az, ay = 0, aw = 2.2] = path[leg];
    const [bx, bz, by = 0, bw = 2.2] = path[leg + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len;
    const nx = tz, nz = -tx;
    for (let d = 1.2; d < len; d += 2.1) {
      const x = ax + tx * d, z = az + tz * d;
      const routeT = d / len;
      const floorY = ay + (by - ay) * routeT;
      const halfW = aw + (bw - aw) * routeT;
      if (layout?.chambers?.some((chamber) =>
        Math.hypot(x - chamber.x, z - chamber.z) < chamber.r * 0.94)) continue;
      const side = rng.sign();
      const h = rng.range(0.55, 1.45);
      toothMatrices.push(compose(x + nx * side * (halfW + 0.18), floorY + 4.24, z + nz * side * (halfW + 0.18),
        Math.PI, rng.range(0, TAU), 0, rng.range(0.65, 1.15), h, rng.range(0.65, 1.15)));
      if (rng.chance(0.58)) {
        // floor spikes used to sit at halfW+0.18 minus their own radius —
        // INSIDE the movement clamp, so the player walked through rock,
        // which is the exact "feeling your way through rocks" complaint.
        // They stand clear of the lane now — clear of the whole union, not
        // just this leg's shoulder; the walls keep their teeth.
        const rotY = rng.range(0, TAU);
        const spx = rng.range(0.55, 0.95);
        const spz = rng.range(0.55, 0.95);
        const placed = clearOfRoute(
          x - nx * side * (halfW + 0.62), z - nz * side * (halfW + 0.62),
          Math.max(spx, spz));
        if (placed) {
          toothMatrices.push(compose(placed.x, floorY + h * 0.42, placed.z,
            0, rotY, 0, spx, h * 0.75, spz));
        }
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
    color: 0x8f9ea1,
    emissive: 0x586d72,
    emissiveIntensity: 0.48,
    roughness: 0.24,
    metalness: 0.12,
    vertexColors: true,
  }));
  const crystalMatrices = [];
  const crystalTints = [];
  const legs = Math.max(1, path.length - 1);
  for (let leg = 0; leg < path.length - 1; leg++) {
    const [ax, az, ay = 0, aw = 2.2] = path[leg];
    const [bx, bz, by = 0, bw = 2.2] = path[leg + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len;
    const nx = tz, nz = -tx;
    for (let d = 0.9; d < len; d += 2.35) {
      const x = ax + tx * d, z = az + tz * d;
      const routeT = d / len;
      const floorY = ay + (by - ay) * routeT;
      const halfW = aw + (bw - aw) * routeT;
      // 0.88 of the chamber radius used to delete the trail across every
      // chamber -- roughly forty metres of it, including the whole chapel
      // crossing. The trail therefore vanished at the biggest rooms, which are
      // exactly the places the player has to choose a direction. Only the
      // middle of a chamber is kept clear now, where the machines actually
      // stand; the crystals continue along the route's edge past them.
      if (layout?.chambers?.some((chamber) =>
        Math.hypot(x - chamber.x, z - chamber.z) < chamber.r * 0.42)) continue;
      const t = (leg + d / len) / legs;                 // 0 at the mouth, 1 at the way out
      const grow = 0.52 + 0.95 * t;
      const bright = 0.38 + 0.62 * t;
      const sc = rng.range(0.10, 0.21) * grow;
      crystalMatrices.push(compose(x + nx * (halfW - 0.16), floorY + rng.range(0.34, 1.16), z + nz * (halfW - 0.16),
        rng.range(-0.38, 0.38), rng.range(0, TAU), rng.range(-0.38, 0.38), sc, sc * rng.range(2.0, 3.15), sc));
      crystalTints.push(bright);
      if (leg > 0 && rng.chance(0.38)) {
        const floorSc = sc * rng.range(0.62, 0.86);
        crystalMatrices.push(compose(x - nx * (halfW - 0.28), floorY + floorSc * 1.1, z - nz * (halfW - 0.28),
          rng.range(-0.2, 0.2), rng.range(0, TAU), rng.range(-0.2, 0.2),
          floorSc, floorSc * rng.range(1.7, 2.65), floorSc));
        crystalTints.push(bright * 0.9);
      }
    }
  }
  // The brightening half of this trail was a no-op, and it is the half that
  // was supposed to replace the illegal cyan. setColorAt writes per-instance
  // colour into vColor, and r161's color_fragment is exactly
  // `diffuseColor.rgb *= vColor` -- it never touches totalEmissiveRadiance.
  // Out here the crystals sit mostly beyond the reach of any light, so
  // EMISSIVE is the visible term and the authored 0.38 -> 1.00 gradient was
  // modulating an albedo nobody was lighting. The size gradient worked; the
  // brightness gradient did not exist.
  //
  // Per-instance emissive needs either a shader patch or separate materials.
  // Separate materials, because they are in the scene from boot and so are
  // covered by the boot warmup, and because nothing here should risk the
  // pinned shader census for two extra draw calls against a 700 budget.
  // The three tiers stay nested under ONE batch keeping the original name,
  // because that name is how the district culler recognises cave dressing
  // (see caveNames above) and how the culling regression counts batches.
  // Hiding the group hides all three.
  // The first tier keeps the canonical name and the other two hang off it,
  // rather than a wrapper Group: buildCaveDress only receives `track`, which
  // both parents into the atmosphere root AND counts a draw call, so a Group
  // would bill one draw call for something that draws nothing. Children
  // inherit visibility, so hiding tier one still sleeps the whole trail.
  const crystalGeo = new THREE.OctahedronGeometry(1, 0);
  let trailRoot = null;
  const TIERS = [
    { max: 0.34, emissive: 0.20 },
    { max: 0.67, emissive: 0.55 },
    { max: 1.01, emissive: 1.15 },
  ];
  const tintCol = new THREE.Color();
  TIERS.forEach((tier, ti) => {
    const lo = ti === 0 ? -1 : TIERS[ti - 1].max;
    const idx = [];
    for (let i = 0; i < crystalMatrices.length; i++) {
      const t = (crystalTints[i] - 0.38) / 0.62;          // back to 0..1 route position
      if (t > lo && t <= tier.max) idx.push(i);
    }
    if (!idx.length) return;
    const mat = own(crystalMat.clone());
    mat.emissiveIntensity = crystalMat.emissiveIntensity * tier.emissive;
    const mesh = new THREE.InstancedMesh(crystalGeo, mat, idx.length);
    idx.forEach((src, k) => {
      mesh.setMatrixAt(k, crystalMatrices[src]);
      mesh.setColorAt(k, tintCol.setScalar(crystalTints[src]));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    finishInstances(mesh, false, false);
    track(mesh, idx.length);   // parents into the atmosphere root, counts the draw call
    if (!trailRoot) {
      trailRoot = mesh;
      mesh.name = 'cave mica trail (grows toward the way out)';
    } else {
      mesh.name = `cave mica trail tier ${ti + 1} of 3`;
      trailRoot.add(mesh);     // reparented off the root, under the named batch
    }
  });

  if (layout) {
    // The interior keeps changing its water vocabulary: wall leaks at the
    // mouth, full sheets framing the pump nave, then a high spill that the
    // player walks behind. One instanced draw call carries every drop.
    const chapel = layout.chapel;
    const overflow = layout.overflow;
    const drops = [
      [layout.main[1].x - 2.9, 0.0, layout.main[1].z + 1.8, 1.15, 4.4, -0.35],
      [layout.main[2].x + 3.8, 0.0, layout.main[2].z + 0.8, 1.55, 5.0, 0.55],
      [chapel.x - 6.0, chapel.y, chapel.z - 1.2, 2.25, 5.35, 0.72],
      [chapel.x + 6.2, chapel.y, chapel.z + 2.1, 1.75, 4.85, -0.48],
      [layout.sluiceRise.x + 1.75, layout.sluiceRise.y, layout.sluiceRise.z - 1.15, 1.55, 4.65, 0.58],
      [overflow.x - 3.25, overflow.y, overflow.z - 0.7, 2.45, 5.6, 0.66],
      [overflow.x + 3.05, overflow.y, overflow.z + 1.8, 1.35, 4.6, -0.52],
    ];
    // WALK-THROUGH WATER, ACROSS the route. Alex: "if you have to walk
    // through things, they should be waterfalls and not rocks." The sheets
    // above hang BESIDE the lane; these span it, perpendicular to their leg,
    // so the traverse's tight moments are curtains of falling water the
    // player passes through — same instanced draw, no collider, no lights.
    // A pooled candle descriptor at each curtain makes them the corridor's
    // luminous landmarks (descriptors are census-free).
    const curtainAt = (a, b, lift = 0) => {
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const my = ((a.y || 0) + (b.y || 0)) / 2 + lift;
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const width = ((a.w || 2.5) + (b.w || 2.5)) + 0.6;
      game.world.candles.push({ x: mx, y: my + 1.35, z: mz, intensity: 0.55, r: 4.2 });
      return [mx, my, mz, width, 4.55, yaw];
    };
    drops.push(
      curtainAt(layout.main[0], layout.main[1]),
      curtainAt(layout.main[1], layout.main[2]),
      curtainAt(layout.main[8], layout.main[9]),
      curtainAt(layout.main[9], layout.main[10]),
      curtainAt(layout.main[11], layout.main[12]),
    );
    if (layout.secret?.[0] && layout.secret?.[1]) {
      drops.push(curtainAt(layout.secret[0], layout.secret[1]));
    }
    const dropMat = own(new THREE.ShaderMaterial({
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
          p.x += sin(uv.y * 31.0 - uTime * 5.1 + uv.x * 12.0) * 0.035;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main(){
          float seam = 0.5 + 0.5 * sin(vUv.x * 53.0 + vUv.y * 11.0 - uTime * 2.3);
          float bead = 0.5 + 0.5 * sin(vUv.y * 71.0 - uTime * 8.4 + vUv.x * 17.0);
          float edge = smoothstep(0.0,0.13,vUv.x) * smoothstep(0.0,0.13,1.0-vUv.x);
          float foot = 1.0 - smoothstep(0.0,0.20,vUv.y);
          vec3 col = mix(vec3(0.15,0.27,0.32), vec3(0.82,0.93,0.96), seam * 0.5 + foot * 0.35);
          gl_FragColor = vec4(col, edge * (0.25 + seam * 0.24 + bead * 0.08 + foot * 0.22));
        }
      `,
    }));
    const dropMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1, 6, 24), dropMat, drops.length);
    drops.forEach(([x, y, z, w, h, yaw], i) => {
      dropMesh.setMatrixAt(i, compose(x, y + h * 0.5, z, 0, yaw, 0, w, h, 1));
    });
    finishInstances(dropMesh, false, false);
    dropMesh.name = 'underfalls interior cataracts';
    track(dropMesh, drops.length);
    tickers.push((dt, t) => { dropMat.uniforms.uTime.value = t % 600; });

    const mistPos = [], mistPhase = [], mistKind = [];
    for (let i = 0; i < 132; i++) {
      const d = drops[i % drops.length];
      mistPos.push(d[0] + rng.range(-d[3], d[3]), d[1] + rng.range(0.08, 2.25), d[2] + rng.range(-1.1, 1.1));
      mistPhase.push(rng.range(0, TAU));
      mistKind.push(1);
    }
    const mist = makeGlowPoints(mistPos, mistPhase, mistKind, own, {
      cyan: new THREE.Color(0xb8dadd), amber: new THREE.Color(0xd9c48d), size: 14.0, opacity: 0.34,
    });
    mist.name = 'underfalls displaced spray';
    track(mist, 1);
    tickers.push((dt, t) => { mist.material.uniforms.uTime.value = t % 600; });
  }
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

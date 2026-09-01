// marrow.js — THE MARROW. An area inhabited by the creatures of MARROW,
// Alex's other game, ported from its shipped source (qualiacology/marrow).
// "the enemies in the game i made called 'marrow' ... are actually really
// freaky and cool. I wish we could have an area with them."
//
// After the graveyard's business is done, the northeast open grave stops
// being a lie: it breathes warm light and something knocks underneath.
// Step in and you are in a candle-lined crypt hall sixty metres under
// nothing, in MARROW's palette. Its rules come with it:
//  - THE MOURNING STATUES turn to face you only while unseen.
//  - THE DARK EYES live in the spaces the candles do not reach.
//  - THE PRESENCE guards the Relic. The skull passes THROUGH it — your
//    verb does not work on something from another game. The only way is
//    MARROW's way: walk into the loom until it yields.
//
// Laws honoured: no runtime lights (emissive + additive sprites + pooled
// candle descriptors only; the Presence was BUILT to read at zero lights),
// no control theft (MARROW's speed-drain near the guardian is deliberately
// NOT ported), value/shape/motion only, no words anywhere, the sealed-
// district visibility pattern with world.lightRoot spared, and derived
// state everywhere so death can never desync it.
import * as THREE from 'three';
import { RNG, clamp, lerp, smoothstep, TAU } from './util.js';

// THE RELIC, as a recipe rather than a fixture. It grants nothing — danger
// sense moved to the iron canine and skullPower has no third level — so Alex
// pulled it out of the crypt ("might as well remove that powerup and put both
// powerups in the same spot as the first powerup is in") and it now waits in
// the yard's toppled hero grave. Exported so outside.js builds both the world
// object and the jaw keepsake from one description, and so a reload re-derives
// the dangle instead of remembering it.
export function makeRelic() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a0a0e, roughness: 0.32, emissive: 0x5a0008, emissiveIntensity: 0.8,
  });
  const geo = new THREE.IcosahedronGeometry(0.13, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + Math.sin(x * 30) * 0.06 + Math.cos(y * 24) * 0.05;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'the relic';
  return { mesh, geo, mat };
}

const MX = 70;                 // mirror of the ossuary's offset, east
const MZ = -10;
const FLOOR = -5.0;
const HALF_W = 4;
const LENGTH = 26;
const HEIGHT = 3.4;

// MARROW's malform(): trig noise pushes every primitive around so nothing
// reads as a clean capsule. Ported verbatim (entity.js:12-23), seeded.
function malform(geo, amp, seed = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 7.3 + seed) * Math.cos(y * 5.1 + seed * 2.1) * Math.sin(z * 6.7 + seed * 3.3)
      + Math.sin(y * 11.0 + seed) * 0.4;
    const k = 1 + n * amp;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// MARROW's candle: wax stub + one additive sprite. Sprite-only flicker,
// no light — the pooled descriptors carry the actual illumination.
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,207,135,1)');
  grad.addColorStop(0.45, 'rgba(255,178,74,0.55)');
  grad.addColorStop(1, 'rgba(255,178,74,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------ THE PRESENCE
// Ported whole from marrow entity.js:67-235 — the starved broken thing:
// hunched ribcage, arms past its knees, head wrenched around a hanging jaw,
// a half-formed second face in its shoulder, eyes in its chest, and the
// stop-motion jitter that makes it read as bad claymation. Its two point
// lights are NOT ported; the emissive ranges were authored to carry it.
export function buildPresence(rng = new RNG(0x3aa2)) {
  const P = {};
  const g = new THREE.Group();
  g.name = 'the presence';
  const flesh = new THREE.MeshPhysicalMaterial({
    color: 0x090606, roughness: 0.58, metalness: 0.0,
    clearcoat: 0.42, clearcoatRoughness: 0.74, emissive: 0x070202, emissiveIntensity: 0.08,
  });
  const bone = new THREE.MeshStandardMaterial({ color: 0x18130f, roughness: 0.82 });
  const cavity = new THREE.MeshBasicMaterial({ color: 0x040203 });
  P.mawMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a0608, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.62,
    emissive: 0x4a0206, emissiveIntensity: 0.0,
  });
  const shadowSkin = new THREE.MeshStandardMaterial({
    color: 0x171014, roughness: 0.8, transparent: true, opacity: 0.62, depthWrite: false,
  });
  const blackVeil = new THREE.MeshBasicMaterial({
    color: 0x050304, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false,
  });
  P.veinMat = new THREE.MeshStandardMaterial({
    color: 0x3a0508, roughness: 0.36, emissive: 0x140002, emissiveIntensity: 0.12,
  });
  P.eyeMat = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xd8e0cf, emissiveIntensity: 1.7, roughness: 1,
  });

  const pelvis = new THREE.Mesh(malform(new THREE.CapsuleGeometry(0.13, 0.16, 4, 8), 0.16, 5), flesh);
  pelvis.position.y = 0.98; g.add(pelvis);
  const torso = new THREE.Mesh(malform(new THREE.CapsuleGeometry(0.17, 0.85, 5, 12), 0.2, 3), flesh);
  torso.position.set(0.02, 1.35, 0); torso.scale.set(1, 1, 0.6); torso.rotation.x = 0.14; g.add(torso);
  P.torso = torso;
  P.veins = [];
  for (let i = 0; i < 6; i++) {
    const vein = new THREE.Mesh(new THREE.CapsuleGeometry(0.006 + (i % 2) * 0.003, 0.26 + i * 0.025, 2, 5), P.veinMat);
    vein.position.set((i - 2.5) * 0.04, 1.35 + Math.sin(i * 1.7) * 0.18, 0.112);
    vein.rotation.set(0.32 + i * 0.04, 0.12 * Math.sin(i), (i - 2.5) * 0.22);
    g.add(vein); P.veins.push(vein);
  }
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.135 - i * 0.014, 0.011, 6, 12, Math.PI), bone);
    rib.position.set(0, 1.62 - i * 0.12, 0.05); rib.rotation.set(Math.PI / 2, 0, (i % 2 ? 1 : -1) * 0.06);
    g.add(rib);
  }
  const clav = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.34, 3, 6), bone);
  clav.position.set(0, 1.76, 0.05); clav.rotation.z = Math.PI / 2; g.add(clav);
  // the crooked rib-halo: antlers for one frame, exposed anatomy the next
  P.spines = [];
  for (let i = 0; i < 7; i++) {
    const sx = (i - 3) * 0.055;
    const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.48 + Math.abs(i - 3) * 0.08, 3, 6), bone);
    spine.position.set(sx, 1.73 - Math.abs(i - 3) * 0.035, -0.09);
    spine.rotation.set(0.68 + Math.abs(i - 3) * 0.08, sx * 4.5, sx * 3.0);
    g.add(spine); P.spines.push(spine);
  }
  P.head = new THREE.Group(); P.head.position.set(0.04, 1.92, 0.01); g.add(P.head);
  const tilt = new THREE.Group(); tilt.rotation.set(0.16, 0.05, 0.26); P.head.add(tilt);
  const skullM = new THREE.Mesh(malform(new THREE.SphereGeometry(0.15, 18, 18), 0.16, 7), flesh);
  skullM.scale.set(0.78, 1.28, 0.9); skullM.position.z = 0.01; tilt.add(skullM);
  // deep sockets, eyes too far back, plus a third wrong one
  const eyePts = [[-0.06, 0.03, 0.12], [0.065, 0.02, 0.12], [0.005, 0.11, 0.115]];
  eyePts.forEach((e, i) => {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), cavity);
    socket.position.set(e[0], e[1], e[2] - 0.03); socket.scale.set(1, 1.3, 0.5); tilt.add(socket);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(i === 2 ? 0.015 : 0.023, 10, 10), P.eyeMat);
    eye.position.set(e[0], e[1], e[2] + 0.028); tilt.add(eye);
  });
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), P.mawMat);
  maw.scale.set(0.62, 1.7, 0.6); maw.position.set(0, -0.07, 0.1); tilt.add(maw);
  P.jaw = new THREE.Group(); P.jaw.position.set(0, -0.04, 0.05); tilt.add(P.jaw);
  const jawMesh = new THREE.Mesh(malform(new THREE.BoxGeometry(0.11, 0.13, 0.11), 0.18, 9), flesh);
  jawMesh.position.y = -0.085; P.jaw.add(jawMesh);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.04, 4), bone);
    const a = (i / 6) * TAU;
    tooth.position.set(Math.cos(a) * 0.04, -0.02 + Math.sin(a) * 0.05, 0.12);
    tooth.rotation.x = Math.PI; tilt.add(tooth);
  }
  // the half-formed second face in the shoulder — there for the light to
  // accidentally find
  P.sideFace = new THREE.Group();
  P.sideFace.position.set(-0.19, 1.66, 0.04);
  P.sideFace.rotation.set(0.25, -0.72, -0.15);
  g.add(P.sideFace);
  const sideSkull = new THREE.Mesh(malform(new THREE.SphereGeometry(0.075, 12, 10), 0.2, 41), flesh);
  sideSkull.scale.set(0.65, 1.0, 0.8); P.sideFace.add(sideSkull);
  const sideEye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), P.eyeMat);
  sideEye.position.set(-0.018, 0.018, 0.065); P.sideFace.add(sideEye);
  const sideMaw = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.06, 0.012), P.mawMat);
  sideMaw.position.set(0.012, -0.035, 0.066); P.sideFace.add(sideMaw);
  // arms: too long, asymmetric, bent, splayed fingers
  P.arms = [];
  [[-1, 1.0, 11], [1, 1.18, 13]].forEach(([sx, len, seed]) => {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.16, 1.74, 0); g.add(pivot);
    const upper = new THREE.Mesh(malform(new THREE.CapsuleGeometry(0.038, 0.46 * len, 3, 6), 0.12, seed), flesh);
    upper.position.y = -0.26 * len; pivot.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.52 * len; elbow.rotation.x = 0.55; pivot.add(elbow);
    const fore = new THREE.Mesh(malform(new THREE.CapsuleGeometry(0.03, 0.46 * len, 3, 6), 0.12, seed + 1), flesh);
    fore.position.y = -0.26 * len; elbow.add(fore);
    const hand = new THREE.Group(); hand.position.y = -0.52 * len; elbow.add(hand);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.016, 0.2, 5), flesh);
      finger.geometry.translate(0, -0.1, 0);
      finger.position.set((f - 1.5) * 0.022, 0, 0.01); finger.rotation.x = 0.25 + f * 0.04; hand.add(finger);
    }
    P.arms.push(pivot);
  });
  // wrong extra limbs folded against the ribs
  for (let i = 0; i < 3; i++) {
    const sx = i === 1 ? 0 : (i === 0 ? -1 : 1);
    const limb = new THREE.Mesh(malform(new THREE.CapsuleGeometry(0.022, 0.85 + i * 0.18, 3, 6), 0.18, 31 + i), flesh);
    limb.position.set(sx * (0.12 + i * 0.04), 1.34 - i * 0.08, -0.06);
    limb.rotation.set(0.9 + i * 0.25, sx * 0.35, sx * (0.65 + i * 0.2));
    g.add(limb);
  }
  // veil strips + ragged black negative-space; the rags stay unlit so the
  // silhouette stays wrong even under the skull's light
  P.veils = [];
  for (let i = 0; i < 7; i++) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.04 + (i % 3) * 0.018, 0.85 + rng.float() * 0.6), shadowSkin);
    strip.position.set((i - 3) * 0.035, 1.62 - rng.float() * 0.25, -0.10 - rng.float() * 0.06);
    strip.rotation.set(0.2 + rng.float() * 0.3, (rng.float() - 0.5) * 0.4, (rng.float() - 0.5) * 0.5);
    g.add(strip); P.veils.push(strip);
  }
  P.rags = [];
  for (let i = 0; i < 9; i++) {
    const rag = new THREE.Mesh(new THREE.PlaneGeometry(0.055 + (i % 3) * 0.025, 1.0 + rng.float() * 0.7), blackVeil);
    rag.position.set((i - 4) * 0.045, 1.16 + rng.float() * 0.26, 0.03 + (i % 2) * 0.035);
    rag.rotation.set((rng.float() - 0.5) * 0.22, (rng.float() - 0.5) * 0.8, (i - 4) * 0.08);
    rag.renderOrder = 2;
    g.add(rag); P.rags.push(rag);
  }
  P.chestEyes = [];
  for (let i = 0; i < 5; i++) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012 + (i % 2) * 0.006, 8, 8), P.eyeMat);
    eye.position.set((i - 2) * 0.045, 1.48 + Math.sin(i) * 0.09, 0.16);
    g.add(eye); P.chestEyes.push(eye);
  }
  P.legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.08, 0.92, 0); g.add(pivot);
    const thigh = new THREE.Mesh(malform(new THREE.CapsuleGeometry(0.05, 0.38, 3, 6), 0.1, sx + 5), flesh);
    thigh.position.y = -0.21; pivot.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.43; knee.rotation.x = -0.2; pivot.add(knee);
    const shin = new THREE.Mesh(malform(new THREE.CapsuleGeometry(0.038, 0.42, 3, 6), 0.1, sx + 7), flesh);
    shin.position.y = -0.22; knee.add(shin);
    P.legs.push(pivot);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  P.group = g;
  P.phase = 0;
  P._twitchUntil = 0;
  P._twitch = new THREE.Vector3();
  return P;
}

// Underfalls borrows the Presence as an authored creature vocabulary, not as
// a second copy of all its geometry. Object3D.clone already shares geometry;
// this companion maps the animation handles onto the clone and gives it fresh
// materials so the drowned Witness can twitch and glow without recolouring the
// original guardian in MARROW. No new geometry and no new shader signatures.
export function clonePresence(source) {
  const group = source.group.clone(true);
  const objects = new Map();
  const materials = new Map();
  const materialClone = (material) => {
    if (Array.isArray(material)) return material.map(materialClone);
    if (!materials.has(material)) materials.set(material, material.clone());
    return materials.get(material);
  };
  const mapTree = (from, to) => {
    objects.set(from, to);
    if (from.material) to.material = materialClone(from.material);
    for (let i = 0; i < from.children.length; i++) mapTree(from.children[i], to.children[i]);
  };
  mapTree(source.group, group);
  const object = (value) => objects.get(value);
  const objectList = (values) => values.map(object);
  return {
    group,
    torso: object(source.torso),
    head: object(source.head),
    jaw: object(source.jaw),
    sideFace: object(source.sideFace),
    veins: objectList(source.veins),
    spines: objectList(source.spines),
    arms: objectList(source.arms),
    veils: objectList(source.veils),
    rags: objectList(source.rags),
    chestEyes: objectList(source.chestEyes),
    legs: objectList(source.legs),
    mawMat: materialClone(source.mawMat),
    veinMat: materialClone(source.veinMat),
    eyeMat: materialClone(source.eyeMat),
    phase: 0,
    _twitchUntil: 0,
    _twitch: new THREE.Vector3(),
  };
}

// MARROW's wrongness ticker (entity.js:466-549), guard/erupt/fold only —
// the modes this district uses. `ag` is the one aggression scalar.
export function tickPresence(P, dt, dist, mode, anims) {
  P.phase += dt;
  const guardLoom = mode === 'guard' ? clamp(1 - (dist - 1.0) / 7, 0, 1) : 0;
  const ag = mode === 'guard' ? clamp(0.35 + guardLoom * 0.65, 0, 1) : anims.ag ?? 0.6;
  P.group.scale.set(1 + guardLoom * 0.16, 1 + guardLoom * 0.40, 1 + guardLoom * 0.16);
  // sharp involuntary head twitches
  if (P.phase > P._twitchUntil) {
    P._twitchUntil = P.phase + 0.25 + Math.random() * (1.4 - ag);
    P._twitch.set((Math.random() - 0.5) * (0.3 + ag * 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4);
  }
  const tw = P._twitch, sw = 1 - Math.min(1, (P._twitchUntil - P.phase) * 4);
  const lean = mode === 'guard' ? -guardLoom * 0.72 : 0;
  P.head.rotation.x = lean + tw.x * sw + Math.sin(P.phase * 9) * 0.02;
  P.head.rotation.y = tw.y * sw;
  P.head.rotation.z = tw.z * sw + Math.sin(P.phase * 6.1) * 0.03;
  P.jaw.rotation.x = 0.25 + ag * 0.7 + Math.sin(P.phase * 5) * 0.05 * ag;
  P.mawMat.emissiveIntensity = ag * (1.2 + Math.sin(P.phase * 11) * 0.4);
  P.eyeMat.emissiveIntensity = (mode === 'guard' ? 2.2 : 1.5) + ag * 1.5 + Math.sin(P.phase * 13) * 0.25 * ag;
  P.veinMat.emissiveIntensity = 0.1 + ag * 0.42;
  // the stop-motion jitter: held frames hashed by step index
  const jit = 0.006 + ag * 0.02;
  const step = Math.floor(P.phase * 14);
  const frac = (n) => n - Math.floor(n);
  const jx = frac(Math.sin(step * 12.9898) * 43758.5453) - 0.5;
  const jz = frac(Math.sin(step * 78.233 + 9.7) * 24634.6345) - 0.5;
  P.group.position.x = anims.x + jx * jit;
  P.group.position.z = anims.z + jz * jit;
  // secondary motion: veils, rags, chest eyes, spines, the turning side face
  for (let i = 0; i < P.veils.length; i++) {
    P.veils[i].rotation.z = Math.sin(P.phase * 3.1 + i) * 0.14;
    P.veils[i].material.opacity = 0.42 + ag * 0.26 + Math.sin(P.phase * 11 + i) * 0.08;
  }
  for (let i = 0; i < P.rags.length; i++) {
    P.rags[i].scale.y = 1 + Math.sin(P.phase * 2.3 + i * 1.7) * 0.06;
    P.rags[i].material.opacity = 0.52 + ag * 0.22;
  }
  for (let i = 0; i < P.chestEyes.length; i++) {
    P.chestEyes[i].scale.setScalar(0.7 + ag * 0.9 + Math.sin(P.phase * 17 + i) * 0.18);
  }
  for (let i = 0; i < P.spines.length; i++) {
    P.spines[i].rotation.y += Math.sin(P.phase * 1.9 + i) * 0.0006;
  }
  P.sideFace.rotation.y = -0.72 + Math.sin(P.phase * 7.5) * 0.08 + ag * 0.18;
}

export function buildMarrowArea(game) {
  const { world, scene, mats: M } = game;
  const rng = new RNG(0x3aa2);
  const marrowRoot = new THREE.Group();
  marrowRoot.name = 'the marrow';
  marrowRoot.visible = false;
  scene.add(marrowRoot);
  // GATE KEY 2 — the crypt's share of the gate, and now the ONLY thing on the
  // altar. A marrowRoot child, so the district's own seal owns its visibility
  // until skull.grab lifts it out. It is visible on the altar from the moment
  // you walk in — that is what the Presence is standing over — and it is not
  // takeable until the guardian yields. Same sentence the key tree speaks.
  const gateKey2 = game.makeGateKey
    ? game.makeGateKey(2, marrowRoot, () => true, () => state.yielded)
    : null;

  // ---- the hall: MARROW's crypt vocabulary -------------------------------
  const fleshWall = new THREE.MeshLambertMaterial({ color: 0x35272a });
  fleshWall.emissive = new THREE.Color(0x0a0001);
  fleshWall.emissiveIntensity = 0.3;
  const fleshRoof = new THREE.MeshLambertMaterial({ color: 0x1d1315 });
  fleshRoof.emissive = new THREE.Color(0x060001);
  fleshRoof.emissiveIntensity = 0.25;
  const darkStone = M.stone.clone();
  darkStone.color.multiplyScalar(0.34);
  const wetFloor = new THREE.MeshStandardMaterial({ color: 0x241418, roughness: 0.22, metalness: 0.3 });
  const boneMat = M.bone.clone();
  boneMat.color.multiplyScalar(0.5);
  const addBox = (mat, x, y, z, w, h, d, name = '') => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.name = name;
    mesh.receiveShadow = true;
    marrowRoot.add(mesh);
    return mesh;
  };
  addBox(wetFloor, MX, FLOOR - 0.08, MZ + LENGTH / 2, HALF_W * 2, 0.16, LENGTH, 'marrow floor');
  addBox(fleshRoof, MX, FLOOR + HEIGHT + 0.12, MZ + LENGTH / 2, HALF_W * 2, 0.24, LENGTH, 'marrow roof');
  for (const side of [-1, 1]) {
    addBox(fleshWall, MX + side * (HALF_W + 0.15), FLOOR + HEIGHT / 2, MZ + LENGTH / 2,
      0.3, HEIGHT, LENGTH, 'marrow wall');
    world.addCollider(MX + side * (HALF_W + 0.3), FLOOR - 0.5, MZ,
      MX + side * HALF_W, FLOOR + HEIGHT, MZ + LENGTH, { marrow: true });
  }
  addBox(fleshWall, MX, FLOOR + HEIGHT / 2, MZ - 0.15, HALF_W * 2 + 0.6, HEIGHT, 0.3, 'marrow south wall');
  world.addCollider(MX - HALF_W - 0.3, FLOOR - 0.5, MZ - 0.3, MX + HALF_W + 0.3, FLOOR + HEIGHT, MZ, { marrow: true });
  addBox(fleshWall, MX, FLOOR + HEIGHT / 2, MZ + LENGTH + 0.15, HALF_W * 2 + 0.6, HEIGHT, 0.3, 'marrow north wall');
  world.addCollider(MX - HALF_W - 0.3, FLOOR - 0.5, MZ + LENGTH, MX + HALF_W + 0.3, FLOOR + HEIGHT, MZ + LENGTH + 0.3, { marrow: true });
  // rib baffles: MARROW's crypt arches, alternating like the ossuary's but
  // fleshier — a torus half sunk in each wall pair
  for (let i = 0; i < 3; i++) {
    const z = MZ + 6 + i * 6.5;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(HALF_W - 0.4, 0.22, 8, 18, Math.PI), darkStone);
    arch.position.set(MX, FLOOR + 0.4, z);
    arch.rotation.z = 0;
    marrowRoot.add(arch);
  }
  world.rooms.push({
    id: 'marrowHall', level: 'marrow', floorY: FLOOR,
    x0: MX - HALF_W, z0: MZ, x1: MX + HALF_W, z1: MZ + LENGTH,
  });
  // interior audio bed: the basement's interior verb, not graveyard wind
  world.addZone('basement', MX - HALF_W - 1, MZ - 1, MX + HALF_W + 1, MZ + LENGTH + 1,
    FLOOR - 2, FLOOR + HEIGHT + 1);
  world.addSurface('stone', MX - HALF_W - 1, MZ - 1, MX + HALF_W + 1, MZ + LENGTH + 1,
    FLOOR - 2, FLOOR + HEIGHT + 1);

  // ---- candles: MARROW's sprite stubs + pooled descriptors ---------------
  const dotTex = softDot();
  const candleSprites = [];
  const waxMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1, emissive: 0x140a02, emissiveIntensity: 0.3 });
  const clusterZ = [MZ + 3, MZ + 9.5, MZ + 16, MZ + 22.5];
  clusterZ.forEach((cz, ci) => {
    for (let k = 0; k < 4; k++) {
      const side = k % 2 ? 1 : -1;
      const h = 0.09 + rng.float() * 0.09;
      const cx = MX + side * (HALF_W - 0.55 - rng.float() * 0.4);
      const czz = cz + (rng.float() - 0.5) * 1.6;
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, h, 6), waxMat);
      wax.position.set(cx, FLOOR + h / 2, czz);
      marrowRoot.add(wax);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dotTex, color: 0xffb24a, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.scale.set(0.09, 0.16, 1);
      spr.position.set(cx, FLOOR + h + 0.05, czz);
      marrowRoot.add(spr);
      candleSprites.push({ spr, seed: rng.float() * 100 });
    }
    world.candles.push({ x: MX + (ci % 2 ? 1.8 : -1.8), y: FLOOR + 0.6, z: cz, intensity: 0.62, r: 4.5 });
  });

  // ---- THE MOURNING STATUES (graveyard.js:182-210, scaled 1.4) -----------
  const statueMat = new THREE.MeshStandardMaterial({ color: 0xb4bebb, roughness: 0.85 });
  const statues = [];
  for (const [sx, sz, side] of [[-2.2, 8, 1], [2.3, 11.5, -1], [-2.4, 15, 1], [2.1, 18.5, -1]]) {
    const st = new THREE.Group();
    st.name = 'mourning statue';
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), darkStone);
    plinth.position.y = 0.25; st.add(plinth);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.7, 7), statueMat);
    robe.position.y = 1.35; st.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), statueMat);
    head.position.set(0, 2.3, 0.03); head.scale.y = 1.2; st.add(head);
    const shoulderL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), statueMat);
    shoulderL.position.set(-0.26, 1.8, 0.12); shoulderL.rotation.z = 0.5; st.add(shoulderL);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.26; shoulderR.rotation.z = -0.5; st.add(shoulderR);
    st.scale.setScalar(1.4);
    st.position.set(MX + sx, FLOOR, MZ + sz);
    st.rotation.y = rng.float() * TAU;
    marrowRoot.add(st);
    statues.push(st);
    st.userData.home = st.position.clone();
    st.userData.homeRot = st.rotation.y;
    st.userData.collider = world.addCollider(MX + sx - 0.62, FLOOR - 0.5, MZ + sz - 0.62,
      MX + sx + 0.62, FLOOR + 2.6, MZ + sz + 0.62, { marrow: true });
    void side;
  }

  // ---- THE ALTAR ---------------------------------------------------------
  // "definitely take it out of the underground marrow/special enemy area so
  // just the key is there." The relic granted nothing — danger sense moved to
  // the iron canine in the yard in the aug15 build and skullPower has no third
  // level — so it was a keepsake sitting on top of the real prize, and it went
  // up to the toppled hero grave to stand beside the canine. What the guardian
  // is standing over down here is GATE KEY 2, alone, and it takes ONE throw.
  const altar = addBox(darkStone, MX, FLOOR + 0.55, MZ + LENGTH - 2.2, 1.5, 1.1, 0.9, 'marrow altar');
  altar.castShadow = true;
  const ALTAR_TOP = new THREE.Vector3(MX, FLOOR + 1.24, MZ + LENGTH - 2.2);
  const relicGlow = { x: MX, y: FLOOR + 1.5, z: MZ + LENGTH - 2.2, intensity: 0.9, r: 5 };
  world.candles.push(relicGlow);
  // the altar is stone, not a suggestion: no walking through the pedestal.
  // The SKULL still passes — a low throw at the key must never clank off
  // an invisible box under it.
  world.addCollider(MX - 0.78, FLOOR - 0.5, MZ + LENGTH - 2.68,
    MX + 0.78, FLOOR + 1.12, MZ + LENGTH - 1.72, { marrow: true, skullPass: true });

  // ---- THE PRESENCE ------------------------------------------------------
  const presence = buildPresence(rng);
  presence.group.position.set(MX, FLOOR, MZ + LENGTH - 3.6);   // between you and the altar
  presence.group.visible = false;
  marrowRoot.add(presence.group);

  // ---- THE DARK EYES (scares.js:198-240): ephemeral, unlit, LOS-free in
  // a hall this simple — spawn against a wall the player is not near
  const eyeGroup = new THREE.Group();
  eyeGroup.visible = false;
  marrowRoot.add(eyeGroup);
  const eyeShadowMat = new THREE.MeshBasicMaterial({
    color: 0x010101, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide,
  });
  const eyeShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.65), eyeShadowMat);
  eyeShadow.position.y = 0.05;
  eyeGroup.add(eyeShadow);
  const eyeMats = [eyeShadowMat];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xd8e0cf, transparent: true, opacity: 0.95 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(i === 2 ? 0.022 : 0.034, 10, 8), m);
    const pair = i < 2 ? (i === 0 ? -1 : 1) : 0;
    eye.position.set(pair * 0.12 + (i === 2 ? 0.02 : 0), 0.22 + (i === 2 ? 0.15 : 0), 0.055);
    eye.scale.y = 0.48;   // slitted
    eyeGroup.add(eye);
    eyeMats.push(m);
  }
  const darkEyes = { age: 0, life: 0.82, active: false, nextAt: 8 };

  // ---- the pit entrance (surface side) -----------------------------------
  // The broken floor of the SEALED MAUSOLEUM; game.marrowPit is set by
  // buildGraveyard, and every surface coordinate below is read from it — the
  // mouth has moved once already and will not be hardcoded again.
  // "i didn't see any enemies from marrow if they existed" — the mouth was
  // too quiet. Once open it is UNMISSABLE now: a breathing ember shimmer
  // floats over the black, the glow is strong, the under-knocks carry
  // twelve metres, and the moment the yard resolves the pit announces itself.
  const MOUTH = game.marrowPit
    ? { x: game.marrowPit.x, z: game.marrowPit.z }
    : { x: 15.6, z: 31.95 };
  const pitGlow = { x: MOUTH.x, y: 0.45, z: MOUTH.z, intensity: 0, r: 4.5 };
  world.candles.push(pitGlow);
  const pitEmber = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 1.4),
    new THREE.MeshBasicMaterial({
      color: 0xff7a3a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
  pitEmber.rotation.x = -Math.PI / 2;
  pitEmber.position.set(MOUTH.x, 0.03, MOUTH.z);
  scene.add(pitEmber);

  const state = {
    origin: { x: MX, z: MZ, floor: FLOOR },
    root: marrowRoot,
    inMarrow: false,
    witnessed: false,
    yielded: false,
    escorted: false,
    presence, statues,
    guardianDist: 99,
    _knockAt: 0,
    _fogSaved: null,
  };
  game.marrow = state;

  // sealed-district visibility (the ossuary pattern; lightRoot spared)
  const marrowSaved = new Map();
  let sealActive = false;
  const keepInMarrow = (child) => child === game.camera
    || child === game.skull?.root
    || child === marrowRoot
    || child === game._impactRing
    || child === game._impactLight
    || child.isLight
    || child === world.lightRoot
    || child.userData?.keepInMarrow === true;
  const syncMarrowVisibility = () => {
    if (state.inMarrow) {
      sealActive = true;
      for (const child of scene.children) {
        if (keepInMarrow(child)) continue;
        if (!marrowSaved.has(child)) marrowSaved.set(child, child.visible);
        child.visible = false;
      }
      return;
    }
    if (!sealActive) return;
    for (const [child, visible] of marrowSaved) child.visible = visible;
    marrowSaved.clear();
    sealActive = false;
  };

  // MARROW's palette rides the fog TARGETS (the main loop eases colour and
  // density as one weather system) — the descent grades into the wine-dark
  // and the surface takes its own air back on the way out. Setting the fog
  // directly would fight the easing every frame.
  const enterPalette = () => {
    state._fogSaved = {
      color: game.fogColorTarget ? game.fogColorTarget.getHex() : scene.fog.color.getHex(),
      density: game.fogTarget ?? scene.fog.density,
      bg: game.bgColorTarget ? game.bgColorTarget.getHex() : (scene.background?.getHex?.() ?? 0x03050a),
    };
    game.fogColorTarget = new THREE.Color(0x160611);
    game.bgColorTarget = new THREE.Color(0x0d030a);
    game.fogTarget = 0.052;
  };
  const exitPalette = () => {
    if (!state._fogSaved) return;
    game.fogColorTarget = new THREE.Color(state._fogSaved.color);
    game.bgColorTarget = new THREE.Color(state._fogSaved.bg);
    game.fogTarget = state._fogSaved.density;
    state._fogSaved = null;
  };

  // the guardian's fold-down (entity.js:334-347) and erupt (362-382),
  // driven as anims. anim = {kind:'erupt'|'fold', t, dur}
  let anim = null;
  const startErupt = (x, z, dur = 0.85) => {
    presence.group.visible = true;
    presence.group.position.set(x, FLOOR, z);
    anim = { kind: 'erupt', t: 0, dur, x, z };
    game.audio.thud({ pos: new THREE.Vector3(x, FLOOR, z), gain: 0.85, rate: 0.5, crack: true });
    game.shake(0.22);
  };
  const startFold = (dur = 0.32) => {
    anim = { kind: 'fold', t: 0, dur, x: presence.group.position.x, z: presence.group.position.z };
    game.audio.whisper({ pos: presence.group.position, gain: 0.34, rate: 0.42, verb: 1.1 });
  };

  // THE WAY OUT. The walls answer once the key leaves the altar: knocks circle
  // nearer, and then the guardian rises one last time between you and the door
  // — and lets you pass. It used to hang off the relic take; it hangs off the
  // KEY take now, which is the same frame the mourners start hunting.
  const runEscort = () => {
    if (state.escorted) return;
    state.escorted = true;
    game.flag('marrow:escorted');
    game.after(2.2, () => {
      if (!state.inMarrow) return;
      const p = game.player.pos, gp = presence.group.position;
      const ang = Math.atan2(gp.x - p.x, gp.z - p.z);
      const knocks = 5;
      let gap = 0.62;
      let acc = 0.9;
      for (let i = 0; i <= knocks; i++) {
        const d = 5.5 - (i / knocks) * 3.2;
        const a = ang + (i % 2 ? 1 : -1) * (0.9 + i * 0.5);
        game.after(acc, () => {
          if (!state.inMarrow) return;
          const kp = game.player.pos;
          game.audio.knock({
            pos: new THREE.Vector3(kp.x + Math.sin(a) * d, FLOOR + 1.2, kp.z + Math.cos(a) * d),
            gain: 0.35 + i * 0.06, rate: 0.6 - i * 0.03,
          });
        }, { global: true });
        acc += gap;
        gap *= 0.86;
      }
      game.after(acc + 0.7, () => {
        if (!state.inMarrow) return;
        const kp = game.player.pos;
        startErupt(kp.x, clamp(kp.z - 4.5, MZ + 2, MZ + LENGTH - 2), 0.85);
        game.after(2.4, () => { if (presence.group.visible) startFold(); }, { global: true });
      }, { global: true });
    }, { global: true });
  };

  // "it feels like you touch it and teleport" — descending and leaving are
  // now VERBS: E on the breathing mouth to go down; E on the hanging bone
  // toggle to climb back out. Same grammar as every hatch in the game.
  //
  // The verb only ARMS the swap; the ticker executes it. E fires before
  // forest.update in the step, and a teleport the forest cullers see before
  // the seal snapshots poisons the save/restore maps (details culled for
  // the marrow position get saved as the surface state). Deferring to the
  // ticker keeps the old walk-over ordering: cullers run on the surface
  // pose, then the swap and the seal happen together.
  const doDescend = () => {
    const player = game.player;
    if (state.inMarrow || game.act !== 'graveyard') return;
    if (!game.flags.has('graveyardResolved') || game.skull?.mode !== 'held') return;
    if (Math.hypot(player.pos.x - MOUTH.x, player.pos.z - MOUTH.z) > 2.6) return;
    state.inMarrow = true;
    player.pos.set(MX, FLOOR, MZ + 1.5);
    player.vel.set(0, 0, 0);
    player.fallV = 0;
    player.grounded = true;
    player.yaw = Math.PI;
    player.pitch = 0;
    player._sync(0);
    game.flag('marrow:entered');
    game.checkpoint('graveyard');
    enterPalette();
    game.audio.stoneGrind({ pos: new THREE.Vector3(MX, FLOOR, MZ), gain: 0.4, rate: 0.45 });
    game.audio.duck(0.3, 2.2);
    if (!state.witnessed) {
      state.witnessed = true;
      game.flag('marrow:witnessed');
      game.after(1.1, () => {
        if (!state.inMarrow) return;
        startErupt(MX + 0.8, MZ + 9);
        game.after(2.6, () => { if (state.inMarrow && !state.yielded) startFold(); }, { global: true });
      }, { global: true });
    }
  };
  const doAscend = () => {
    const player = game.player;
    if (!state.inMarrow || game.skull?.mode !== 'held') return;
    if (player.pos.z > MZ + 3.4) return;
    state.inMarrow = false;
    exitPalette();
    // up into the standing room between the hole and the mausoleum's doorway,
    // facing the way out
    player.pos.set(MOUTH.x, 0.12, MOUTH.z - 1.25);
    player.vel.set(0, 0, 0);
    player.fallV = 0;
    player.grounded = true;
    player.yaw = 0;
    player._sync(0);
    game.checkpoint('graveyard');
    game.audio.stoneGrind({ pos: new THREE.Vector3(MOUTH.x, 0, MOUTH.z), gain: 0.4, rate: 0.6 });
  };
  const descend = () => { state._pendingDescend = true; };
  const ascend = () => { state._pendingAscend = true; };
  state.descend = descend;
  state.ascend = ascend;
  let pitInter = null;
  if (game.marrowPit) {
    pitInter = world.registerInteract(game.marrowPit.pit, 'marrowDescend', descend);
    pitInter.enabled = false;
  }
  // the way up hangs where you arrived: a rope and a bone toggle
  const ropeMat = new THREE.MeshLambertMaterial({ color: 0x6a6458 });
  const exitRope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 1.7, 6), ropeMat);
  exitRope.position.set(MX, FLOOR + HEIGHT - 0.85, MZ + 1.0);
  marrowRoot.add(exitRope);
  const exitToggle = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.24, 3, 6), boneMat);
  exitToggle.name = 'marrow way up';
  exitToggle.position.set(MX, FLOOR + 1.55, MZ + 1.0);
  marrowRoot.add(exitToggle);
  const exitInter = world.registerInteract(exitToggle, 'marrowAscend', ascend);
  exitInter.enabled = false;

  const pv = new THREE.Vector3();
  game.tickers.push((dt, time) => {
    const player = game.player;
    const p = player.pos;
    const skull = game.skull;
    const opened = game.flags.has('graveyardResolved');

    // the pit breathes once the yard's business is done
    pitGlow.intensity += (((opened && !state.inMarrow) ? 1.4 + Math.sin(time * 1.3) * 0.3 : 0)
      - pitGlow.intensity) * Math.min(1, dt * 2);
    pitEmber.material.opacity += (((opened && !state.inMarrow)
      ? 0.16 + Math.max(0, Math.sin(time * 1.3)) * 0.14 : 0)
      - pitEmber.material.opacity) * Math.min(1, dt * 2);
    // a shut mouth costs no draw — and a per-tick visibility drive must
    // never fight another district's seal, so it defers to any active one
    pitEmber.visible = pitEmber.material.opacity > 0.012
      && game.act === 'graveyard' && !game.ossuary?.inOssuary && !state.inMarrow;
    // the one-time announcement: the yard resolves, and somewhere northeast
    // a grave clears its throat three times
    if (opened && !state._invited && game.act === 'graveyard') {
      state._invited = true;
      const under = new THREE.Vector3(MOUTH.x, -0.6, MOUTH.z);
      game.after(2.4, () => game.audio.knock({ pos: under, gain: 0.62, rate: 0.46 }), { global: true });
      game.after(3.1, () => game.audio.knock({ pos: under, gain: 0.66, rate: 0.42 }), { global: true });
      game.after(3.9, () => game.audio.knock({ pos: under, gain: 0.7, rate: 0.38 }), { global: true });
    }
    if (opened && !state.inMarrow && game.act === 'graveyard' && time > state._knockAt) {
      const nearPit = Math.hypot(p.x - MOUTH.x, p.z - MOUTH.z) < 12;
      state._knockAt = time + 6 + Math.random() * 4;
      if (nearPit) {
        game.audio.knock({ pos: new THREE.Vector3(MOUTH.x, -0.6, MOUTH.z), gain: 0.52, rate: 0.48 });
      }
    }
    // descending and leaving are USED (E on the mouth, E on the way-up
    // rope), never walked-over — "everything you can open should kind of
    // work the same way." The mouth stays a hole you lean over (collider
    // permanently raised); the crosshair only offers the verb when it's live.
    if (pitInter) pitInter.enabled = opened && !state.inMarrow && game.act === 'graveyard';
    exitInter.enabled = state.inMarrow;

    // armed verbs execute HERE, after the frame's cullers ran on the old
    // pose — the swap and the seal land in the same ticker pass
    if (state._pendingDescend) { state._pendingDescend = false; doDescend(); }
    if (state._pendingAscend) { state._pendingAscend = false; doAscend(); }

    marrowRoot.visible = state.inMarrow;
    syncMarrowVisibility();

    // GATE KEY 2 stands on the altar from the first frame of the room and is
    // takeable the moment the guardian yields — ONE throw, and the room turns
    // on that same frame. The aug15 auto-jaw existed to spare the player a
    // second aimed throw with the mourners already hunting; a single fetch has
    // the same safety, and the take is finally a counted event he can hear.
    if (gateKey2 && !gateKey2.revealed) gateKey2.reveal(ALTAR_TOP.x, ALTAR_TOP.y, ALTAR_TOP.z);
    // the theft breaks the truce — derived off the flag, so a restore finds it
    if (!state.escorted && game.flags.has('gotgateKey2') && state.inMarrow) runEscort();

    if (!state.inMarrow) return;

    // a hard respawn re-seats the surface palette; the crypt takes its air
    // back on the next tick (idempotent — never re-saves the surface)
    if (state._fogSaved && game.fogColorTarget?.getHex() !== 0x160611) {
      game.fogColorTarget = new THREE.Color(0x160611);
      game.bgColorTarget = new THREE.Color(0x0d030a);
      game.fogTarget = 0.052;
    }
    // death inside the crypt: when the player stands back up, the mourners
    // are at their posts again — grace, never an ambush
    if (game.dead) state._deadSeen = true;
    else if (state._deadSeen) {
      state._deadSeen = false;
      for (const st of statues) {
        st.position.copy(st.userData.home);
        st.rotation.set(0, st.userData.homeRot, 0);
        st.userData.stagger = 0;
        st.userData.hitCd = 0;
        st.userData.shiverT = 0;
      }
    }

    // candle flicker (sprite-only, MARROW's crypt trick)
    for (const c of candleSprites) {
      const n = Math.sin(time * 14 + c.seed) * 0.5 + Math.sin(time * 6.1 + c.seed * 2) * 0.5;
      c.spr.scale.set(0.08 + n * 0.02, 0.15 + n * 0.04, 1);
      c.spr.material.opacity = 0.75 + n * 0.25;
    }

    // THE MOURNING STATUES: they turn to face you only while unseen — until
    // the key leaves the altar. Then the mourning is over: while your eyes
    // are elsewhere they DASH, the skull's hit shoves them back like any
    // other creature, and their touch is the end. Weeping-angel grammar the
    // player already learned on the way in; the theft breaks the truce.
    game.camera.getWorldDirection(pv);
    const hunting = game.flags.has('gotgateKey2');
    for (const st of statues) {
      const H = st.userData;
      if (H.collider) {
        // hunting statues abandon their plinth boxes (the catch radius is
        // the body now); the truce restores them
        H.collider.max.y = hunting ? H.collider.min.y : FLOOR + 2.6;
      }
      const dx = p.x - st.position.x, dz = p.z - st.position.z;
      const d = Math.hypot(dx, dz);
      // the skull's reach is mode-blind: one proximity test feeds both
      // branches. Marble is a BIG target (1.4-scale cone), and the
      // boomerang arc bends off the aim line — the radius honours both.
      let hit = false;
      if (skull && (skull.mode === 'outbound' || skull.mode === 'returning') && time > (H.hitCd || 0)) {
        const sd = Math.hypot(skull.pos.x - st.position.x, skull.pos.z - st.position.z);
        hit = sd < 1.0 && skull.pos.y > FLOOR && skull.pos.y < FLOOR + 3;
      }
      if (!hunting) {
        H.shiverT = Math.max(0, (H.shiverT || 0) - dt);
        if (hit) {
          // truce: marble answers — a shiver and a soft crack, never a
          // shove. Position and stagger must stay untouched or the hit
          // reads as the combat verb working pre-theft.
          H.hitCd = time + 0.7;
          H.shiverT = 0.8;
          game.audio.thud({ pos: st.position, gain: 0.55, rate: 0.62, crack: true });
          game.impact('break', st.position);
        }
        if (H.shiverT > 0) {
          st.rotation.y += Math.sin(time * 31 + st.userData.home.x) * 0.02;
          continue;
        }
        if (d > 16) continue;
        const facing = (pv.x * -dx + pv.z * -dz) / (d || 1) > 0.42;
        if (!facing) {
          const want = Math.atan2(dx, dz);
          let diff = ((want - st.rotation.y + Math.PI) % TAU) - Math.PI;
          st.rotation.y += diff * Math.min(1, dt * 0.4);
        }
        continue;
      }
      H.stagger = Math.max(0, (H.stagger || 0) - dt);
      // the skull's answer: bone shoves marble, harder with the iron canine
      if (hit) {
        H.hitCd = time + 0.7;
        H.stagger = 1.5;
        const kx = st.position.x - skull.pos.x, kz = st.position.z - skull.pos.z;
        const kd = Math.hypot(kx, kz) || 1;
        const push = 1.9 * (game.skullPower || 1);
        st.position.x = clamp(st.position.x + (kx / kd) * push, MX - (HALF_W - 0.6), MX + (HALF_W - 0.6));
        st.position.z = clamp(st.position.z + (kz / kd) * push, MZ + 1.0, MZ + LENGTH - 1.0);
        st.rotation.z = (rng.float() - 0.5) * 0.14;   // knocked off true
        game.audio.thud({ pos: st.position, gain: 0.7, rate: 0.62, crack: true });
        game.impact('pop', st.position);
      }
      if (H.stagger > 0) {
        // a struck statue shivers where it stands
        st.rotation.y += Math.sin(time * 31 + st.userData.home.x) * 0.02;
        continue;
      }
      const facing = (pv.x * -dx + pv.z * -dz) / (d || 1) > 0.38;
      if (!facing && d > 0.05) {
        const want = Math.atan2(dx, dz);
        let diff = ((want - st.rotation.y + Math.PI) % TAU) - Math.PI;
        st.rotation.y += diff * Math.min(1, dt * 6);
        const nx = dx / (d || 1), nz = dz / (d || 1);
        st.position.x = clamp(st.position.x + nx * 3.3 * dt, MX - (HALF_W - 0.6), MX + (HALF_W - 0.6));
        st.position.z = clamp(st.position.z + nz * 3.3 * dt, MZ + 1.0, MZ + LENGTH - 1.0);
        // marble scraping stone, only while it moves — heard, never seen
        H.scrapeT = (H.scrapeT || 0) - dt;
        if (H.scrapeT <= 0) {
          H.scrapeT = 0.34 + rng.float() * 0.2;
          game.audio.stoneGrind({ pos: st.position, gain: 0.22, rate: 1.7 });
        }
      }
      if (d < 0.85 && !game.dead) game.director.death(st);
    }

    // THE DARK EYES: the spaces between candles blink
    if (!darkEyes.active && time > darkEyes.nextAt) {
      darkEyes.active = true;
      darkEyes.age = 0;
      darkEyes.nextAt = time + 9 + Math.random() * 8;
      const side = Math.random() < 0.5 ? -1 : 1;
      const ez = clamp(p.z + (Math.random() < 0.6 ? 5 : -4) + Math.random() * 3, MZ + 2, MZ + LENGTH - 2);
      eyeGroup.position.set(MX + side * (HALF_W - 0.7), FLOOR + 1.35, ez);
      eyeGroup.rotation.y = Math.atan2(p.x - eyeGroup.position.x, p.z - eyeGroup.position.z);
      eyeGroup.visible = true;
      game.audio.eyeGlimpse?.({ pos: eyeGroup.position });
    }
    if (darkEyes.active) {
      darkEyes.age += dt;
      const k = clamp(1 - darkEyes.age / darkEyes.life, 0, 1);
      const pulse = 1 + Math.sin(darkEyes.age * 38) * 0.035;   // the 38Hz buzz
      eyeGroup.scale.setScalar((0.92 + k * 0.08) * pulse);
      for (const m of eyeMats) m.opacity = (m.userData.base ??= m.opacity) * k * k;
      if (darkEyes.age >= darkEyes.life) {
        darkEyes.active = false;
        eyeGroup.visible = false;
        for (const m of eyeMats) m.opacity = m.userData.base;
      }
    }

    // THE PRESENCE
    const gp = presence.group.position;
    const dist = Math.hypot(p.x - gp.x, p.z - gp.z);
    state.guardianDist = dist;
    if (anim) {
      anim.t += dt;
      const k = clamp(anim.t / anim.dur, 0, 1);
      if (anim.kind === 'erupt') {
        presence.phase += dt * 2.5;
        gp.y = FLOOR - 1.7 * (1 - k) * (1 - k);
        presence.group.scale.set(1, 0.3 + k * 0.7, 1);
        presence.head.rotation.z = Math.sin(presence.phase * 21) * 0.4 * (1 - k);
        presence.jaw.rotation.x = 0.4 + k * 0.6;
        presence.mawMat.emissiveIntensity = 0.6 + k * 0.9;
        presence.eyeMat.emissiveIntensity = 1.2 + k * 1.6;
        const yaw = Math.atan2(p.x - gp.x, p.z - gp.z);
        presence.group.rotation.y = yaw;
        if (k >= 1) anim = null;
      } else {
        presence.phase += dt * 3;
        const kk = 1 - k;
        gp.y = -(1 - kk) * 0.7 + FLOOR;
        presence.group.scale.set(0.55 + kk * 0.45, kk * kk, 0.55 + kk * 0.45);
        presence.head.rotation.z += (Math.random() - 0.5) * 0.5 * k;
        presence.eyeMat.emissiveIntensity *= 0.84;
        presence.jaw.rotation.x += dt * 4 * k;
        if (k >= 1) {
          anim = null;
          presence.group.visible = false;
          presence.group.scale.setScalar(1);
          gp.y = FLOOR;
          // after the introduction, it is already waiting at the altar
          if (!state.yielded) {
            presence.group.position.set(MX, FLOOR, MZ + LENGTH - 3.6);
            presence.group.visible = true;
            presence.group.rotation.y = Math.PI;   // facing down the hall, at you
          }
        }
      }
    } else if (presence.group.visible && !state.yielded) {
      // GUARD: it stands on the thing you want and looms as you close
      tickPresence(presence, dt, dist, 'guard', { x: gp.x, z: gp.z });
      const yaw = Math.atan2(p.x - gp.x, p.z - gp.z);
      presence.group.rotation.y += ((yaw - presence.group.rotation.y + Math.PI) % TAU - Math.PI) * Math.min(1, dt * 3);
      // the skull passes THROUGH it: your verb is not from its game. It
      // flinches — a twitch burst and a whisper — and nothing more.
      if (skull && (skull.mode === 'outbound' || skull.mode === 'returning')) {
        const sd = Math.hypot(skull.pos.x - gp.x, skull.pos.z - gp.z);
        if (sd < 0.55 && time > (state._flinchAt || 0)) {
          state._flinchAt = time + 0.8;
          presence._twitchUntil = 0;   // force an immediate hard twitch
          game.audio.whisper({ pos: gp, gain: 0.4, rate: 0.5, verb: 1.0 });
        }
      }
      // loom thresholds: one positional moan per band, closing
      const near = clamp(1 - (dist - 1.0) / 7, 0, 1);
      const band = near > 0.85 ? 3 : near > 0.55 ? 2 : near > 0.25 ? 1 : 0;
      if (band > (state._loomBand || 0)) {
        state._loomBand = band;
        game.audio.creak({ pos: gp, gain: 0.3 + band * 0.14, rate: 0.5 - band * 0.06, verb: 0.9 });
        if (band === 3) game.audio.duck(0.25, 1.6);
      } else if (band < (state._loomBand || 0)) {
        state._loomBand = band;
      }
      // THE SUBMERGENCE: commit all the way and it yields — it folds down
      // through the floor and the earth thuds under your feet. It did not
      // leave. It is below, and it lets you take it.
      if (dist < 1.15) {
        state.yielded = true;
        game.flag('marrow:guardianYielded');
        startFold(0.4);
        game.after(0.55, () => {
          game.audio.thud({ pos: new THREE.Vector3(p.x, FLOOR - 0.5, p.z), gain: 0.9, rate: 0.42, crack: true });
          game.shake(0.6);
        }, { global: true });
        game.after(1.25, () => {
          game.audio.thud({ pos: new THREE.Vector3(p.x + 1.5, FLOOR - 0.5, p.z - 2), gain: 0.6, rate: 0.4 });
        }, { global: true });
      }
    }

    // THE ALTAR: guarded is still and dim; yielded beats and lifts. The state
    // lives on the object the player is aiming at, in brightness and motion.
    // (makeGateKey's own hover already turns and bobs the key; the altar's
    // candle and the lift are what say GUARDED vs GIVEN.)
    const taken = game.flags.has('gotgateKey2');
    if (!taken) {
      const takeable = state.yielded;
      let throb = 0;
      if (takeable) {
        state._altarPulseT = (state._altarPulseT || 0) + dt * 1.6;
        const beat = Math.max(0, Math.sin(state._altarPulseT * TAU));
        throb = beat * beat;
        state._altarRiseT = Math.min(1, (state._altarRiseT || 0) + dt);
        if (gateKey2) {
          gateKey2.home.y = ALTAR_TOP.y + smoothstep(0, 1, state._altarRiseT) * 0.16;
        }
      }
      relicGlow.intensity = takeable ? 1.4 + throb * 0.6 : 0.62;
    } else {
      relicGlow.intensity = 0.2;
    }
    // A THROW AT A GUARDED KEY STILL GETS AN ANSWER. Without this the key's
    // own fetch target is simply disabled before the yield and the skull sails
    // through in silence — the exact failure this project keeps shipping.
    if (!taken && skull && (skull.mode === 'outbound' || skull.mode === 'returning')) {
      const rd = Math.hypot(skull.pos.x - ALTAR_TOP.x, skull.pos.z - ALTAR_TOP.z);
      const inWindow = rd < 0.8 && Math.abs(skull.pos.y - ALTAR_TOP.y) < 0.95;
      if (inWindow && !state.yielded && time > (state._refuseAt || 0)) {
        // the refusal: the gate is a rule, not a bug — a dry dead knock
        // (nothing like the take's unlock chord), and it points at WHO is
        // refusing: a hard twitch, an eye-flare, a placed whisper
        state._refuseAt = time + 0.7;
        game.audio.knock({ pos: ALTAR_TOP, gain: 0.42, rate: 1.35 });
        presence._twitchUntil = 0;
        state._eyeFlareT = 0.3;
        game.audio.whisper({ pos: gp, gain: 0.45, rate: 0.5 });
      }
    }
    // the refusal eye-flare rides ON TOP of tickPresence's per-tick write,
    // applied after it in the same pass so the guard drive can't stomp it
    if (state._eyeFlareT > 0) {
      state._eyeFlareT = Math.max(0, state._eyeFlareT - dt);
      presence.eyeMat.emissiveIntensity += (state._eyeFlareT / 0.3) * 2.6;
    }
  });
}

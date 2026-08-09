// outside.js — Acts 3-5: graveyard backyard, the sealing forest, the clearing,
// the cave behind the waterfall. Forest is an authored spline corridor
// (eaten-path pattern): movement is projection onto the polyline, the seal
// frontier IS the collider, rising instanced trees are its body.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RNG, clamp, lerp, damp, smoothstep, TAU } from './util.js';
import { LAYER_HELD } from './mirrors.js';
import { buildUnderfalls } from './underfalls.js';

export const FOREST_GATE = { x: 2, z: 43 };
export const CLEARING_BASIN = Object.freeze({
  centerZ: 15.2,
  innerR: 5.4,
  outerR: 8.2,
  waterR: 8.45,
  depth: 3.15,
});

// Collapse a static prop hierarchy to one mesh per material while preserving
// its authored root transform. Exterior props often need many little pieces
// to read (fingers, car pillars, torn panels), but none of those pieces moves
// independently; paying a draw for each one is pure bookkeeping.
function batchStaticGroup(group, name) {
  group.updateWorldMatrix(true, true);
  const inverseRoot = group.matrixWorld.clone().invert();
  const buckets = new Map();
  group.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || !object.geometry || Array.isArray(object.material)) return;
    const material = object.material;
    if (!buckets.has(material)) buckets.set(material, {
      geometries: [], objects: [], cast: false, receive: false,
    });
    const bucket = buckets.get(material);
    const relative = inverseRoot.clone().multiply(object.matrixWorld);
    let geometry = object.geometry.clone();
    if (geometry.index) {
      const indexed = geometry;
      geometry = indexed.toNonIndexed();
      indexed.dispose();
    }
    geometry.applyMatrix4(relative);
    bucket.geometries.push(geometry);
    bucket.objects.push(object);
    bucket.cast ||= object.castShadow;
    bucket.receive ||= object.receiveShadow;
  });
  let i = 0;
  for (const [material, bucket] of buckets) {
    if (!bucket.geometries.length) continue;
    const commonAttributes = new Set(Object.keys(bucket.geometries[0].attributes));
    for (const geometry of bucket.geometries.slice(1)) {
      for (const attribute of [...commonAttributes]) {
        if (!geometry.getAttribute(attribute)) commonAttributes.delete(attribute);
      }
    }
    for (const geometry of bucket.geometries) {
      for (const attribute of Object.keys(geometry.attributes)) {
        if (!commonAttributes.has(attribute)) geometry.deleteAttribute(attribute);
      }
    }
    const geometry = mergeGeometries(bucket.geometries, false);
    for (const source of bucket.geometries) source.dispose();
    if (!geometry) continue;
    for (const object of bucket.objects) object.parent?.remove(object);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${name} material ${++i}`;
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    group.add(mesh);
  }
  group.userData.batchedMaterials = i;
  return group;
}

// ------------------------------------------------------------------ terrain
export function terrainHeightFn(game) {
  return (x, z) => {
    const C = game.clearingCenter;
    const underfallsY = game.underfalls?.groundAt(x, z);
    if (underfallsY != null) return underfallsY;
    if (C && Math.abs(x - C.x) < 30 && z > C.z - 27 && z < C.z + 30) {
      // The plunge pool is a real obstacle. Once the bridge rises, its moving
      // stone tops become the only walkable ground across the basin.
      for (const st of game.bridgeStones || []) {
        if (st.position.y < -0.35) continue;
        if (Math.hypot(x - st.position.x, z - st.position.z) < 1.03) return st.position.y + 0.25;
      }
      const lx = x - C.x, lz = z - C.z;
      const r = Math.hypot(lx, lz);
      const poolR = Math.hypot(lx, lz - CLEARING_BASIN.centerZ);
      const basin = -CLEARING_BASIN.depth *
        (1 - smoothstep(CLEARING_BASIN.innerR, CLEARING_BASIN.outerR, poolR));
      return -0.4 * Math.exp(-((r / 22) ** 2)) + Math.sin(lx * 0.4) * 0.08 + basin + 0.02;
    }
    if (game.forest && game.forest.contains(x, z)) return game.forest.heightAt(x, z);
    if (z < 6) return 0;                          // around the house
    return Math.sin(x * 0.23) * Math.sin(z * 0.31) * 0.22;
  };
}

export function buildOutside(game) {
  buildGraveyard(game);
  game.forest = new Forest(game);
  buildClearing(game);
  buildCave(game);
  game.world.addZone('forest', -120, 44, 140, 400, -8, 30);
  game.world.addSurface('leaves', -120, 44, 140, 400, -8, 30);
  game.world.terrainHeight = terrainHeightFn(game);
}

// ---------------------------------------------------------------- graveyard
function buildGraveyard(game) {
  const { world, scene, mats: M } = game;

  world.addZone('graveyard', -22, 6, 26, 44, -2, 12);
  world.addSurface('dirt', -22, 6, 26, 44, -2, 12);

  // ground: displaced plane that starts BEHIND the house line (never under it)
  const g = new THREE.PlaneGeometry(48, 38, 24, 19);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 2, z = pos.getZ(i) + 25;
    pos.setY(i, Math.sin(x * 0.23) * Math.sin(z * 0.31) * 0.22 - 0.02);
  }
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, M.grass);
  ground.position.set(2, 0, 25);
  ground.receiveShadow = true;
  scene.add(ground);
  // strips flanking the house so no plane crosses under it
  world.box(M.dirt, 0, -0.06, 5.2, 48, 0.1, 2.4);
  world.box(M.dirt, -16, -0.06, -4, 8, 0.1, 22);
  world.box(M.dirt, 16, -0.06, -4, 8, 0.1, 22);
  world.box(M.dirt, 0, -0.06, -16, 40, 0.1, 5);

  // iron fence perimeter with one gap: the forest gate
  const fenceY = 1.1;
  const rails = [];
  const addFence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.round(len / 1.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      rails.push([lerp(x0, x1, t), lerp(z0, z1, t)]);
    }
    world.box(M.metal, (x0 + x1) / 2, fenceY - 0.15, (z0 + z1) / 2,
      Math.max(Math.abs(x1 - x0), 0.06), 0.06, Math.max(Math.abs(z1 - z0), 0.06));
    world.addCollider(Math.min(x0, x1) - 0.1, -1, Math.min(z0, z1) - 0.1,
      Math.max(x0, x1) + 0.1, 2.2, Math.max(z0, z1) + 0.1);
  };
  addFence(-20, 6.5, -20, 42);
  addFence(24, 6.5, 24, 42);
  addFence(-20, 42, FOREST_GATE.x - 1.6, 42);
  addFence(FOREST_GATE.x + 1.6, 42, 24, 42);
  // south runs tuck into the house corners — the yard is CLOSED. Playtest 3:
  // Alex walked off the back of the map past the side of the house.
  addFence(-20, 6.5, -11.9, 6.5);
  addFence(11.9, 6.5, 24, 6.5);
  const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.5, 5);
  const postMesh = new THREE.InstancedMesh(postGeo, M.metal, rails.length);
  const mtx = new THREE.Matrix4();
  rails.forEach(([x, z], i) => {
    mtx.makeTranslation(x, 0.75, z);
    postMesh.setMatrixAt(i, mtx);
  });
  scene.add(postMesh);

  // headstones — pale against the dark, in uneven rows
  const rng = new RNG(0x9d2f);
  // atmosphere.js supplies the carved, sunk and mounded stones. The former
  // base population was sixty-four identical bright boxes beneath that pass.
  buildGraveyardLandmarks(game);

  // the crashed car — headlights still on, dying
  buildWreckedCar(game);
  const head = new THREE.SpotLight(0xcfd6d0, 300, 26, 0.4, 0.6, 1.4);
  head.position.set(-8.2, 0.8, 15.6);
  head.target.position.set(-2, 0.4, 24);
  scene.add(head, head.target);
  game.tickers.push((dt, t) => {
    // dying flicker — brightness carries the unease, not color
    head.intensity = (Math.sin(t * 13) > -0.82 ? 1 : 0.15) * (280 + Math.sin(t * 3.1) * 50);
  });

  // the bodies. prone, wrong — every one of them crawling AWAY from the forest
  // gate. the dead are a compass: they all fled where you must go.
  buildGraveyardBodies(game);

  // dead trees
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.3, 5.5, 7);
  for (let i = 0; i < 7; i++) {
    const tr = new THREE.Mesh(trunkGeo, M.bark);
    const x = rng.range(-18, 22), z = rng.range(8, 40);
    if (Math.abs(x - FOREST_GATE.x) < 3 && z > 34) continue;
    tr.position.set(x, 2.4, z);
    tr.rotation.set(rng.range(-0.12, 0.12), 0, rng.range(-0.12, 0.12));
    scene.add(tr);
  }
}

function buildGraveyardLandmarks(game) {
  const { world, scene, mats: M } = game;
  const stone = M.headstone.clone();
  stone.color.multiplyScalar(0.64);
  if ('emissive' in stone) {
    // A distant mausoleum must stay a room-shaped value landmark even after
    // the skull light falls off; the doorway remains absolute black.
    stone.emissive = new THREE.Color(0x343a3c);
    stone.emissiveIntensity = 0.38;
  }
  const soil = M.dirt.clone();
  soil.color.multiplyScalar(0.72);
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x010204 });
  const roofGeo = new THREE.ConeGeometry(2.55, 1.45, 4);
  const landmarks = [];

  // MARROW supplied the useful composition rather than the stone sculpt:
  // mausoleums break firing lines into loops, and apparently open graves are
  // solid gameplay obstacles so an arena never kills by an unreadable hole.
  for (const [x, z, mirror] of [[15.6, 31.5, 1], [-14.6, 34.2, -1]]) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(3.6, 2.65, 0.34), stone, 0, 1.3, 1.55);
    add(new THREE.BoxGeometry(0.38, 2.65, 3.2), stone, -1.62, 1.3, 0);
    add(new THREE.BoxGeometry(0.38, 2.65, 3.2), stone, 1.62, 1.3, 0);
    // front wall leaves a human-width black doorway and a shallow porch.
    add(new THREE.BoxGeometry(1.15, 2.65, 0.34), stone, -1.22, 1.3, -1.55);
    add(new THREE.BoxGeometry(1.15, 2.65, 0.34), stone, 1.22, 1.3, -1.55);
    add(new THREE.BoxGeometry(0.92, 0.42, 0.34), stone, 0, 2.43, -1.55);
    add(new THREE.BoxGeometry(4.25, 0.18, 1.15), stone, 0, 0.09, -1.75);
    const roof = add(roofGeo, stone, 0, 3.15, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.82;
    const darkness = add(new THREE.PlaneGeometry(1.04, 2.05), voidMat, 0, 1.18, -1.735);
    darkness.rotation.y = mirror < 0 ? Math.PI : 0;
    scene.add(g);
    world.addCollider(x - 1.82, -0.5, z + 1.35, x + 1.82, 3, z + 1.75);
    world.addCollider(x - 1.82, -0.5, z - 1.75, x - 1.42, 3, z + 1.75);
    world.addCollider(x + 1.42, -0.5, z - 1.75, x + 1.82, 3, z + 1.75);
    world.addCollider(x - 1.82, -0.5, z - 1.75, x - 0.5, 3, z - 1.35);
    world.addCollider(x + 0.5, -0.5, z - 1.75, x + 1.82, 3, z - 1.35);
    landmarks.push(g);
  }

  const moundGeo = new THREE.DodecahedronGeometry(0.34, 0);
  const graveSites = [[-7.2, 27.0, -0.08], [9.2, 23.0, 0.12], [-14.2, 18.4, -0.16], [11.8, 36.2, 0.1]];
  for (const [x, z, ry] of graveSites) {
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.42), voidMat);
    pit.rotation.set(-Math.PI / 2, 0, ry);
    pit.position.set(x, 0.018, z);
    scene.add(pit);
    for (let i = 0; i < 12; i++) {
      const side = i < 6 ? -1 : 1;
      const k = i % 6;
      const clod = new THREE.Mesh(moundGeo, soil);
      clod.position.set(x + side * (0.62 + (i % 2) * 0.08), 0.08 + (i % 3) * 0.025,
        z - 1.04 + k * 0.42 + Math.sin(i * 7.1) * 0.08);
      clod.scale.set(1.1 + (i % 3) * 0.18, 0.45, 0.8 + (i % 2) * 0.2);
      clod.rotation.y = ry + i * 0.63;
      scene.add(clod);
    }
    // The player reads a hole and walks around it; the skull can still cross
    // the opening, preserving combat lines and avoiding invisible ricochets.
    world.addCollider(x - 0.62, -0.8, z - 1.28, x + 0.62, 0.82, z + 1.28, { skullPass: true });
    landmarks.push(pit);
  }
  game.graveLandmarks = landmarks;
  buildResonantGraves(game);
  buildGraveyardGate(game);
}

function buildResonantGraves(game) {
  const { world, scene, mats: M } = game;
  const stone = M.headstone.clone();
  stone.color.multiplyScalar(0.52);
  if ('emissive' in stone) {
    stone.emissive = new THREE.Color(0xb9d4dc);
    stone.emissiveIntensity = 0.04;
  }
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xd8edf0, transparent: true, opacity: 0.4 });
  const pulseGeo = new THREE.RingGeometry(0.75, 1, 32);
  const pulses = [];
  const sites = [[-15.2, 27.2], [14.5, 19.4], [7.4, 35.0]];
  const graves = [];

  for (const [x, z] of sites) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.name = 'resonant grave';
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 0.35, 6), stone);
    base.position.y = 0.18;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, 2.35, 5), stone);
    shaft.position.y = 1.38;
    // The interactable marker used to finish in a perfect cone and read as a
    // toy rocket. A split tuning-fork crown keeps its strong combat silhouette
    // while making the resonance fiction physical and funerary.
    const crownLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.72, 5), stone);
    crownLeft.position.set(-0.16, 2.82, 0);
    crownLeft.rotation.z = -0.23;
    const crownRight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, 0.62, 5), stone);
    crownRight.position.set(0.17, 2.77, 0.02);
    crownRight.rotation.z = 0.3;
    const brokenCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), stone);
    brokenCap.position.set(-0.04, 2.49, 0);
    brokenCap.scale.set(1.25, 0.65, 0.8);
    group.add(base, shaft, crownLeft, crownRight, brokenCap);
    for (let i = 0; i < 3; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.45, 0.012), seamMat);
      seam.position.set(Math.sin(i * 2.1) * 0.29, 1.55, Math.cos(i * 2.1) * 0.4);
      seam.rotation.z = (i - 1) * 0.13;
      group.add(seam);
    }
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(group);
    world.addCollider(x - 0.66, -0.5, z - 0.66, x + 0.66, 2.65, z + 0.66);
    const state = { group, shaft, cooldown: 0, flare: 0 };
    state.target = world.addFetchTarget({
      id: `resonantGrave:${graves.length + 1}`,
      object: shaft,
      radius: 0.82,
      onHit(skull, at) {
        if (state.cooldown > 0) return 'return';
        state.cooldown = 3.4;
        state.flare = 1;
        const pos = new THREE.Vector3(x, 0.05, z);
        const caught = game.enemies.resonancePulse
          ? game.enemies.resonancePulse(pos, 8.2, 1.65)
          : 0;
        game.impact('hurt', at || pos);
        game.audio.stoneGrind({ pos, gain: 0.62, rate: 1.65, verb: 0.7 });
        game.audio.metalDrop({ pos: new THREE.Vector3(x, 1.2, z), gain: 0.42 + Math.min(0.25, caught * 0.04), rate: 1.5 });
        const mat = new THREE.MeshBasicMaterial({
          color: 0xd8edf0, transparent: true, opacity: 0.72,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const ring = new THREE.Mesh(pulseGeo, mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(pos);
        ring.scale.setScalar(0.25);
        scene.add(ring);
        pulses.push({ mesh: ring, mat, t: 0 });
        return 'return';
      },
    });
    graves.push(state);
  }

  game.tickers.push((dt) => {
    for (const g of graves) {
      g.cooldown = Math.max(0, g.cooldown - dt);
      g.flare = Math.max(0, g.flare - dt * 1.9);
      const k = g.flare * g.flare;
      g.group.scale.y = 1 + Math.sin((1 - g.flare) * Math.PI) * k * 0.06;
      for (let i = 1; i < g.group.children.length; i++) {
        const child = g.group.children[i];
        if (child.material === seamMat) child.material.opacity = 0.4 + k * 0.6;
      }
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += dt;
      p.mesh.scale.setScalar(0.25 + p.t * 9.2);
      p.mat.opacity = Math.max(0, 0.72 * (1 - p.t / 0.9));
      if (p.t >= 0.9) {
        scene.remove(p.mesh);
        p.mat.dispose();
        pulses.splice(i, 1);
      }
    }
  });
  game.resonantGraves = graves;
}

function buildGraveyardGate(game) {
  const { world, scene, mats: M } = game;
  const gate = { t: 0, opening: false, open: false };
  const makeLeaf = (dir) => {
    const leaf = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.25, 5), M.metal);
      bar.position.set(dir * (0.12 + i * 0.27), 1.12, 0);
      leaf.add(bar);
      if (i % 2 === 0) {
        const spear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.25, 4), M.metal);
        spear.position.set(bar.position.x, 2.36, 0);
        leaf.add(spear);
      }
    }
    for (const y of [0.52, 1.65]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.065, 0.08), M.metal);
      rail.position.set(dir * 0.79, y, 0);
      leaf.add(rail);
    }
    leaf.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return leaf;
  };
  gate.left = makeLeaf(1);
  gate.right = makeLeaf(-1);
  gate.left.position.set(FOREST_GATE.x - 1.6, 0, 42);
  gate.right.position.set(FOREST_GATE.x + 1.6, 0, 42);
  scene.add(gate.left, gate.right);
  gate.collider = world.addCollider(FOREST_GATE.x - 1.68, -1, 41.82,
    FOREST_GATE.x + 1.68, 2.55, 42.18);
  gate.openGate = () => { gate.opening = true; };
  gate.reset = () => {
    gate.t = 0;
    gate.opening = false;
    gate.open = false;
    gate.left.rotation.y = 0;
    gate.right.rotation.y = 0;
    gate.collider.max.y = 2.55;
  };
  game.tickers.push((dt) => {
    if (!gate.opening || gate.open) return;
    gate.t = Math.min(1, gate.t + dt * 0.48);
    const e = 1 - (1 - gate.t) ** 3;
    gate.left.rotation.y = -e * 1.42;
    gate.right.rotation.y = e * 1.42;
    if (gate.t > 0.32) gate.collider.max.y = gate.collider.min.y;
    if (gate.t >= 1) gate.open = true;
  });
  game.graveyardGate = gate;
}

function buildWreckedCar(game) {
  const { world, scene, mats: M } = game;
  const car = new THREE.Group();
  car.name = 'wrecked station wagon';
  const paint = M.metal.clone();
  paint.color.setHex(0x273139);
  paint.roughness = 0.72;
  paint.metalness = 0.46;
  const rust = M.metal.clone();
  rust.color.setHex(0x3b302b);
  rust.roughness = 0.92;
  const glass = new THREE.MeshStandardMaterial({
    color: 0x111d24, roughness: 0.12, metalness: 0.35,
    transparent: true, opacity: 0.76,
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x070809, roughness: 0.98 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xdde6de });
  const cavity = new THREE.MeshBasicMaterial({ color: 0x020304 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    car.add(m);
    return m;
  };

  const lower = new THREE.Shape();
  lower.moveTo(-2.25, 0.28);
  lower.lineTo(-2.32, 0.56);
  lower.quadraticCurveTo(-2.2, 0.86, -1.75, 0.91);
  lower.lineTo(1.72, 0.93);
  lower.quadraticCurveTo(2.18, 0.9, 2.34, 0.62);
  lower.lineTo(2.25, 0.28);
  lower.closePath();
  const shellGeo = new THREE.ExtrudeGeometry(lower, {
    depth: 1.72, steps: 1, bevelEnabled: true, bevelSegments: 2,
    bevelSize: 0.07, bevelThickness: 0.06,
  });
  shellGeo.translate(0, 0, -0.86);
  // Crush and yaw the impact end at the vertex level. The old silhouette was
  // still an intact station wagon with damage props stuck onto it; this makes
  // the chassis itself carry the collision before the player sees any detail.
  const shellPos = shellGeo.attributes.position;
  for (let i = 0; i < shellPos.count; i++) {
    const x = shellPos.getX(i), y = shellPos.getY(i), z = shellPos.getZ(i);
    const crush = smoothstep(1.0, 2.42, x);
    shellPos.setXYZ(i,
      x - crush * (0.13 + Math.sin(z * 8.3 + y * 5.1) * 0.07),
      y + crush * (Math.sin(z * 6.7) * 0.11 - 0.055),
      z * (1 - crush * 0.16) + crush * 0.055,
    );
  }
  shellGeo.computeVertexNormals();
  const shell = add(shellGeo, paint, 0, 0, 0, 0.035, 0, -0.025);

  // A dark glasshouse with real roof line and pillars instead of a second box.
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-1.18, 0.88);
  cabinShape.lineTo(-0.72, 1.55);
  cabinShape.quadraticCurveTo(-0.5, 1.7, -0.12, 1.72);
  cabinShape.lineTo(0.72, 1.64);
  cabinShape.lineTo(1.27, 0.92);
  cabinShape.closePath();
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
    depth: 1.46, steps: 1, bevelEnabled: true, bevelSegments: 1,
    bevelSize: 0.025, bevelThickness: 0.02,
  });
  cabinGeo.translate(0, 0, -0.73);
  const cabin = add(cabinGeo, glass, -0.05, 0, -0.01, 0.035, 0, -0.025);
  const roof = add(new THREE.BoxGeometry(2.65, 0.11, 1.58), paint, -0.03, 1.68, 0, 0.02, 0, -0.025);
  for (const x of [-1.06, 0.1, 1.07]) {
    add(new THREE.BoxGeometry(0.105, 0.82, 1.55), paint, x, 1.26, 0, 0, 0, x * -0.12);
  }
  add(new THREE.BoxGeometry(1.4, 0.08, 1.74), rust, 1.58, 0.99, 0, 0, 0, 0.12);
  add(new THREE.BoxGeometry(0.1, 0.48, 1.74), paint, 2.25, 0.65, 0);
  add(new THREE.SphereGeometry(0.13, 10, 7), lamp, 2.31, 0.7, -0.52, 0, Math.PI / 2, 0);
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10), cavity, 2.315, 0.7, 0.52, 0, 0, Math.PI / 2);

  // The glasshouse used to be an empty tinted volume.  Seats, a crooked wheel
  // and a shattered windscreen turn it into the remains of an occupied car;
  // crumple ribs and a torn bumper keep the silhouette from reading pristine.
  const upholstery = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.98 });
  for (const [x, z, lean] of [[0.34, -0.39, -0.08], [0.3, 0.39, 0.11], [-0.55, -0.38, 0.04], [-0.55, 0.38, -0.05]]) {
    add(new THREE.BoxGeometry(0.46, 0.66, 0.48), upholstery, x, 1.05, z, 0, 0, lean);
    add(new THREE.BoxGeometry(0.38, 0.42, 0.12), upholstery, x - 0.08, 1.48, z, 0, 0, lean * 1.4);
  }
  add(new THREE.BoxGeometry(0.42, 0.18, 1.35), rust, 0.98, 1.02, 0, 0, 0, -0.08);
  add(new THREE.TorusGeometry(0.19, 0.027, 6, 15), rust, 0.72, 1.28, 0.46, 0.12, Math.PI / 2, 0.08);
  add(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6), rust, 0.91, 1.13, 0.46, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    add(new THREE.BoxGeometry(0.08, 0.08, 1.58), i % 2 ? rust : paint,
      1.28 + i * 0.25, 1.02 + Math.sin(i * 2.2) * 0.09, 0,
      0, 0, 0.09 + (i - 1.5) * 0.035);
  }
  const engineVoid = add(new THREE.BoxGeometry(0.18, 0.48, 1.28), cavity, 2.15, 1.08, 0, 0, 0, 0.08);
  const tornHood = add(new THREE.BoxGeometry(0.92, 0.045, 1.22), paint, 1.72, 1.25, -0.03, 0.03, 0.04, 0.19);
  tornHood.name = 'peeled hood sheet';
  engineVoid.name = 'exposed engine cavity';
  add(new THREE.BoxGeometry(0.12, 0.16, 1.82), rust, 2.43, 0.39, 0.06, 0.04, 0.08, 0.16);

  const crackPos = [];
  const crackCenter = new THREE.Vector3(1.245, 1.36, -0.18);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399;
    const end = crackCenter.clone().add(new THREE.Vector3(
      Math.sin(i * 17.3) * 0.055,
      Math.sin(a) * (0.22 + (i % 3) * 0.045),
      Math.cos(a) * (0.34 + (i % 2) * 0.08),
    ));
    crackPos.push(crackCenter.x, crackCenter.y, crackCenter.z, end.x, end.y, end.z);
    if (i % 2 === 0) {
      const fork = end.clone().add(new THREE.Vector3(-0.015, Math.cos(a) * 0.09, Math.sin(a) * 0.12));
      crackPos.push(end.x, end.y, end.z, fork.x, fork.y, fork.z);
    }
  }
  const crackGeo = new THREE.BufferGeometry();
  crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackPos, 3));
  const cracks = new THREE.LineSegments(crackGeo, new THREE.LineBasicMaterial({
    color: 0xaeb8b5, transparent: true, opacity: 0.52,
  }));
  cracks.name = 'shattered windshield star';
  car.add(cracks);

  const wheelGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.23, 14);
  const hubGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.25, 10);
  const wheelSites = [[-1.42, -0.91, false], [1.42, -0.91, false], [1.42, 0.91, true]];
  for (const [x, z, flat] of wheelSites) {
    const w = add(wheelGeo, tyre, x, 0.39, z, Math.PI / 2);
    if (flat) w.scale.y = 0.64;
    add(hubGeo, rust, x, 0.39, z * 1.01, Math.PI / 2);
  }
  // The missing rear wheel leaves a naked hub; the wheel itself lies in grass.
  add(hubGeo, rust, -1.42, 0.42, 0.92, Math.PI / 2);
  const loose = new THREE.Mesh(wheelGeo, tyre);
  loose.position.set(-7.4, 0.25, 16.0);
  loose.rotation.set(1.2, 0.35, 0.4);
  loose.scale.y = 0.72;
  loose.castShadow = true;
  scene.add(loose);

  // One door hangs open. Its glass and inner panel make the wreck readable as
  // a place somebody escaped from, not merely a vehicle prop.
  const door = new THREE.Group();
  door.position.set(-0.18, 0.43, 0.88);
  door.rotation.y = -0.82;
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.72, 0.09), paint);
  doorPanel.position.set(0.58, 0.36, 0);
  const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.48, 0.035), glass);
  doorGlass.position.set(0.58, 0.94, 0);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.035, 0.035), rust);
  handle.position.set(0.88, 0.65, 0.06);
  door.add(doorPanel, doorGlass, handle);
  car.add(door);

  // Dozens of little seat, pillar, crack and wheel meshes used to cast their
  // own moon/headlight shadow draw. Their silhouettes are already carried by
  // the shell, roof and open door; shadowing every dashboard rib added more
  // cost than visual truth in the widest arena view.
  car.traverse((o) => { if (o.isMesh || o.isLine) o.castShadow = false; });
  shell.castShadow = true;
  roof.castShadow = true;
  doorPanel.castShadow = true;
  cabin.castShadow = false;

  batchStaticGroup(car, 'wrecked wagon');

  car.position.set(-9, -0.02, 14);
  car.rotation.set(0.035, -0.96, 0.08);
  scene.add(car);
  car.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(car);
  world.addCollider(bounds.min.x + 0.12, -0.2, bounds.min.z + 0.12,
    bounds.max.x - 0.12, Math.min(1.75, bounds.max.y), bounds.max.z - 0.12);

  // Debris stays outside the car group so the tight gameplay collider is not
  // silently enlarged by a suitcase or glass shard several metres away.
  const debris = new THREE.Group();
  debris.name = 'station wagon ejected belongings';
  const caseMat = M.curtain.clone();
  if (caseMat.color) caseMat.color.multiplyScalar(0.55);
  for (const [x, z, yaw, sc] of [[-6.55, 13.3, 0.34, 1], [-7.15, 12.65, -0.62, 0.76]]) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.68 * sc, 0.3 * sc, 0.5 * sc), caseMat);
    bag.position.set(x, 0.14 * sc, z);
    bag.rotation.set(0.08, yaw, yaw * 0.08);
    bag.castShadow = true;
    debris.add(bag);
  }
  const map = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.48),
    new THREE.MeshLambertMaterial({ color: 0x77776d, side: THREE.DoubleSide }));
  map.rotation.set(-Math.PI / 2, 0, -0.38);
  map.position.set(-6.75, 0.025, 12.15);
  debris.add(map);
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -7.7, 0.025, 14.0, -7.35, 0.025, 13.78, -7.2, 0.025, 14.15,
    -6.9, 0.026, 14.55, -6.55, 0.026, 14.18, -6.38, 0.026, 14.64,
    -7.45, 0.027, 12.95, -7.12, 0.027, 12.83, -7.2, 0.027, 13.24,
  ], 3));
  const shard = new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({
    color: 0x43525a, roughness: 0.18, metalness: 0.42,
    transparent: true, opacity: 0.66, side: THREE.DoubleSide,
  }));
  debris.add(shard);
  scene.add(debris);
  game.graveCar = car;
  game.graveCarDebris = debris;
}

function buildGraveyardBodies(game) {
  const { scene } = game;
  const clothes = [0x202329, 0x2b2628, 0x1c2526, 0x292922].map((color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  // Desaturated, low-value flesh stays recognisably human under the headlight
  // without turning the victims into white shop mannequins.
  const skin = new THREE.MeshStandardMaterial({ color: 0x373634, roughness: 0.98 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.98 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x11100f, roughness: 1 });
  const Y = new THREE.Vector3(0, 1, 0);
  const bodies = [];
  const poses = [
    { le: [-0.53, 0.13, -0.28], lh: [-0.78, 0.08, -0.63], re: [0.34, 0.19, -0.46], rh: [0.18, 0.08, -0.84], lk: [-0.3, 0.14, 0.96], lf: [-0.48, 0.1, 1.45], rk: [0.38, 0.13, 0.82], rf: [0.7, 0.08, 1.16] },
    { le: [-0.26, 0.2, -0.54], lh: [-0.08, 0.08, -0.9], re: [0.55, 0.13, -0.22], rh: [0.82, 0.06, -0.52], lk: [-0.45, 0.14, 0.82], lf: [-0.76, 0.08, 1.12], rk: [0.27, 0.13, 1.02], rf: [0.16, 0.08, 1.5] },
    { le: [-0.58, 0.12, -0.08], lh: [-0.86, 0.07, 0.22], re: [0.2, 0.23, -0.55], rh: [0.48, 0.08, -0.83], lk: [-0.25, 0.15, 1.04], lf: [-0.14, 0.08, 1.5], rk: [0.48, 0.13, 0.78], rf: [0.82, 0.08, 1.08] },
    { le: [-0.34, 0.22, -0.52], lh: [-0.6, 0.08, -0.83], re: [0.62, 0.12, -0.1], rh: [0.9, 0.07, 0.18], lk: [-0.5, 0.13, 0.76], lf: [-0.82, 0.08, 1.1], rk: [0.22, 0.16, 1.02], rf: [0.52, 0.08, 1.4] },
  ];
  const sites = [[-5.8, 18.3], [0.2, 22.4], [5.9, 27.1], [-1.6, 33.1]];

  // Flattened drag shadows do more for the story than bright gore: every mark
  // begins under a body and points back toward the house, while the hands and
  // heads keep reaching for the shut forest gate.  The direction reads at a
  // glance even when colour does not.
  const dragGeo = new THREE.PlaneGeometry(0.86, 3.2);
  dragGeo.rotateX(-Math.PI / 2);
  const dragMat = new THREE.MeshBasicMaterial({
    color: 0x030405, transparent: true, opacity: 0.62,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const dragMarks = new THREE.InstancedMesh(dragGeo, dragMat, sites.length);
  const dragMtx = new THREE.Matrix4(), dragQ = new THREE.Quaternion();
  const dragP = new THREE.Vector3(), dragScale = new THREE.Vector3();
  const dragEuler = new THREE.Euler();
  sites.forEach(([x, z], i) => {
    const away = new THREE.Vector3(x - FOREST_GATE.x, 0, z - FOREST_GATE.z).normalize();
    const gy = Math.sin(x * 0.23) * Math.sin(z * 0.31) * 0.22;
    dragQ.setFromEuler(dragEuler.set(0, Math.atan2(away.x, away.z), 0));
    dragMtx.compose(
      dragP.set(x + away.x * 1.12, gy + 0.018, z + away.z * 1.12),
      dragQ, dragScale.set(0.82 + i * 0.08, 1, 0.9 + (i % 2) * 0.25),
    );
    dragMarks.setMatrixAt(i, dragMtx);
  });
  dragMarks.instanceMatrix.needsUpdate = true;
  dragMarks.name = 'graveyard body drag marks';
  scene.add(dragMarks);

  const limb = (group, a, b, radius, mat) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.02, len - radius * 2), 3, 7), mat);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  sites.forEach(([x, z], i) => {
    const group = new THREE.Group();
    group.name = 'graveyard body ' + (i + 1);
    const cloth = clothes[i % clothes.length];
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.53, 4, 9), cloth);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.24, 0.04);
    torso.scale.set(1.05, 1, 0.76);
    torso.castShadow = true;
    group.add(torso);
    // A torn coat/skirt panel breaks the toy-doll capsule silhouette and pools
    // against the ground in the direction the body was dragged.
    const ragGeo = new THREE.BufferGeometry();
    ragGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.29, 0, -0.08, 0.29, 0, -0.08, 0.42, 0, 0.74,
      -0.29, 0, -0.08, 0.42, 0, 0.74, -0.34, 0, 0.91,
    ], 3));
    ragGeo.computeVertexNormals();
    const rag = new THREE.Mesh(ragGeo, cloth);
    rag.position.set(0, 0.16, 0.12);
    rag.rotation.y = (i - 1.5) * 0.08;
    rag.castShadow = true;
    group.add(rag);
    const coat = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.92, 7, 1, true), cloth);
    coat.rotation.x = Math.PI / 2;
    coat.rotation.z = (i - 1.5) * 0.08;
    coat.position.set(0, 0.25, 0.08);
    coat.scale.set(1.16, 1, 0.82);
    group.add(coat);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.24, 9, 7), cloth);
    pelvis.position.set(0, 0.2, 0.48);
    pelvis.scale.set(1.25, 0.65, 0.92);
    group.add(pelvis);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 11, 8), skin);
    head.position.set(i === 2 ? 0.09 : 0, 0.21, -0.7);
    head.scale.set(0.9, 0.72, 1.06);
    head.rotation.y = (i - 1.5) * 0.35;
    group.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 7), skin);
    neck.rotation.x = Math.PI / 2;
    neck.position.set(0, 0.2, -0.5);
    group.add(neck);
    const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.195, 9, 6, 0, TAU, 0, Math.PI * 0.56), hair);
    scalp.position.copy(head.position);
    scalp.rotation.copy(head.rotation);
    scalp.scale.copy(head.scale).multiplyScalar(1.01);
    group.add(scalp);
    const p = poses[i];
    const armSegments = [
      [[-0.2, 0.25, -0.25], p.le, false], [p.le, p.lh, true],
      [[0.2, 0.25, -0.25], p.re, false], [p.re, p.rh, true],
    ];
    for (const [a, b, forearm] of armSegments) {
      limb(group, a, b, 0.065, i === 1 && forearm ? skin : cloth);
    }
    for (const hand of [p.lh, p.rh]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), skin);
      h.position.set(...hand);
      h.scale.set(0.75, 0.45, 1.15);
      group.add(h);
    }
    for (const [a, b, foot] of [
      [[-0.14, 0.2, 0.48], p.lk, p.lf], [[0.14, 0.2, 0.48], p.rk, p.rf],
    ]) {
      limb(group, a, b, 0.085, cloth);
      limb(group, b, foot, 0.072, cloth);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.3), shoe);
      f.position.set(...foot);
      f.rotation.y = i * 0.37;
      group.add(f);
    }
    if (i === 3) {
      const sheetMat = new THREE.MeshStandardMaterial({ color: 0x4a4d49, roughness: 1, side: THREE.DoubleSide });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.45, 3, 4), sheetMat);
      sheet.rotation.x = -Math.PI / 2;
      sheet.rotation.z = -0.12;
      sheet.position.set(0.04, 0.34, 0.24);
      sheet.castShadow = true;
      group.add(sheet);
    }
    // A body needs one coherent ground shadow, not a separate shadow-map draw
    // for every finger, shoe and hair cap. Keep the torso/coat silhouette and
    // let the smaller anatomy receive light without multiplying arena cost.
    group.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = true;
    });
    torso.castShadow = true;
    rag.castShadow = true;
    coat.castShadow = true;
    const gy = Math.sin(x * 0.23) * Math.sin(z * 0.31) * 0.22;
    group.position.set(x, gy + 0.02, z);
    const away = new THREE.Vector3(x - FOREST_GATE.x, 0, z - FOREST_GATE.z).normalize();
    group.lookAt(new THREE.Vector3(x + away.x, group.position.y, z + away.z));
    batchStaticGroup(group, `dragged body ${i + 1}`);
    scene.add(group);
    bodies.push(group);
  });
  game.graveBodies = bodies;
  game.graveDragMarks = dragMarks;
}

// ------------------------------------------------------------------- forest
const SEAL_TRAIL = 10;
const _lookA = new THREE.Vector3(), _lookB = new THREE.Vector3(), _lookC = new THREE.Vector3();

export class Forest {
  constructor(game) {
    this.game = game;
    const { world, scene, mats: M } = game;
    const rng = new RNG(0x51ab);

    // authored heading walk from the gate, ~210m of corridor
    const pts = [];
    let x = FOREST_GATE.x, z = FOREST_GATE.z + 1, h = 0;   // heading 0 = +z
    pts.push([x, z]);
    for (let i = 0; i < 26; i++) {
      h = clamp(h + rng.gauss() * 0.42, -0.9, 0.9);
      x += Math.sin(h) * 8;
      z += Math.cos(h) * 8;
      pts.push([x, z]);
    }
    // resample to 1m arc steps
    this.samples = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        this.samples.push({
          x: lerp(ax, bx, t), z: lerp(az, bz, t),
          tx: (bx - ax) / len, tz: (bz - az) / len,
        });
      }
    }
    this.length = this.samples.length;

    // Two optional side chapters interrupt the long forward pressure without
    // changing the mandatory centreline. The ground is broad enough for a real
    // held-throw swing, but the forest keeps its side wall closed until that
    // pocket's knot has actually caught an outbound skull. Once caught, the
    // same mouth stays walkable so release, landing, retry, and return are safe.
    this.secretPockets = [
      {
        id: 'searchers-line', targetId: 'forestRope:searchersLine', flag: 'forestSecret:searchersBlind',
        centerS: 74, fromS: 65, landingS: 75.5, side: 1, landingLat: 5.35,
        widen: 5.45, span: 10.5,
      },
      {
        id: 'bell-line', targetId: 'forestRope:bellLine', flag: 'forestSecret:bellCopse',
        centerS: 179, fromS: 170, landingS: 181, side: -1, landingLat: 5.35,
        widen: 5.55, span: 10.5,
      },
    ];
    // Keep the ordinary corridor separate from its authored side-pocket ground.
    // `halfW` still describes all rendered/grounded space; clampPlayer decides
    // which one-sided pocket has been earned through the matching skull latch.
    this.baseHalfW = this.samples.map((s, i) => {
      const t = i / this.length;
      let w = lerp(2.4, 1.5, smoothstep(0, 0.35, t)) * (0.9 + 0.2 * Math.sin(i * 0.29));
      w += 9 * Math.exp(-(((i - this.arenaS()) / 14) ** 2));       // the arena bulge
      return w;
    });
    this.halfW = this.baseHalfW.map((base, i) => {
      let w = base;
      for (const pocket of this.secretPockets) {
        w += pocket.widen * Math.exp(-(((i - pocket.centerS) / pocket.span) ** 2));
      }
      return w;
    });

    this.sealS = -SEAL_TRAIL;
    this._lastIdx = 0;
    this.entered = false;
    this._sealMtx = new THREE.Matrix4();
    this._sealPos = new THREE.Vector3();
    this._sealScale = new THREE.Vector3();
    this._sealQuat = new THREE.Quaternion();

    this._buildFlora(rng);
    this._buildSealPool();
    this._setpieces();
    this._buildForestLandmarks();
    this._buildOptionalRopes();

    // NOTE: the forest zone/surface are registered in buildOutside AFTER the
    // clearing and cave, so their tighter rects win the first-match scan.
    world.postClamp = (pos, dt) => this.clampPlayer(pos, dt);
  }

  arenaS() { return Math.floor(this.length * 0.72); }
  ravineS() { return Math.floor(this.length * 0.5); }

  // Re-seat every piece of forest state on a position the player has just been
  // PUT at rather than walked to. Without this, a death in the forest respawns
  // you at the gate while the spline still believes you are 90m in and the seal
  // frontier is still parked where you died — so the corridor clamp and the
  // wall of trees are both computed for somewhere you are not, and you walk
  // through trees into a hole.
  reseat(x, z) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.length; i++) {
      const s = this.samples[i];
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    this._lastIdx = best;
    const pr = this.project(x, z);
    const s = pr ? pr.s : best;
    this.sealS = Math.max(-SEAL_TRAIL, s - SEAL_TRAIL);
    this.entered = s > 2;
    // Cumulative seal rows belong to one life. Merely moving the numeric
    // frontier does not move or remove the already-stamped instances, so a
    // checkpoint behind the place of death can otherwise wake inside the old
    // solid wall. Rebuild only the local barrier behind the restored seat.
    // Normal forward play never calls reseat(), so its cumulative look-back
    // history remains untouched until a teleport/respawn explicitly begins a
    // new spatial life.
    if (this.sealAnim && this.sealMesh) {
      this.sealAnim.length = 0;
      this.sealMesh.count = 0;
      this.sealMesh.instanceMatrix.needsUpdate = true;
      this._sealPlaced = -999;
      this._sealCreakT = 0;
      this._lookWindow = 0;
      this._idleT = 0;
      this._idleS = s;
      if (this.entered && this.sealS >= 0) this._placeSeal(true);
    }
    return s;
  }

  // Authored no-surprises restore point for a requested spline distance. The
  // centerline is always clear except for two deliberate beats; those beats get
  // side-preserving pads rather than a magic teleport across their consequence.
  // Returning both the resolved s and position lets probes verify the contract
  // without knowing the forest's shape.
  safeRespawnPad(requestedS) {
    let s = clamp(requestedS, 1.25, this.length - 3.0);
    const fallen = this.fallenS();
    if (!this.game.flags.has('treeCleared') && Math.abs(s - fallen) < 3.4) {
      s = s < fallen ? fallen - 3.6 : fallen + 3.6;
    }
    const ravine = this.ravineS();
    // The rope's authored far-side checkpoint lands on the shallow outer lip
    // around +3m and must restore exactly. Only relocate points in the actual
    // deep gash, not legitimate grounded landings beside it.
    if (Math.abs(s - ravine) < 2.75) {
      s = s < ravine ? ravine - 4.25 : ravine + 4.25;
    }
    const pos = this.posAt(s, 0);
    pos.y = this.heightAt(pos.x, pos.z) + 0.025;
    return { s, pos };
  }

  // Put a position back ON the trail. Respawn hands us wherever the player died
  // or wherever a checkpoint was taken, and "in the trees" is a legal answer to
  // both — Alex: "especially if you die in the forest. respawn is often in
  // trees". Re-seating fixes what the forest BELIEVES; this fixes where the
  // player actually stands.
  recentre(pos) {
    const original = pos.clone();
    const requestedS = this.reseat(pos.x, pos.z);
    const originalPr = this.project(original.x, original.z);
    const safe = this.safeRespawnPad(requestedS);
    const originalGround = this.heightAt(original.x, original.z);
    const exactPoseIsSafe = originalPr
      && Math.abs(originalPr.lat) <= 0.35
      && Math.abs(safe.s - requestedS) < 1e-3
      && Number.isFinite(original.y)
      && Math.abs(original.y - originalGround) <= 0.4;
    // Preserve an already-authored safe checkpoint byte-for-byte (notably the
    // far-side rope landing). Edge-biased or hazardous restores use the pad.
    pos.copy(exactPoseIsSafe ? original : safe.pos);
    // The pad may have stepped away from the fallen log or ravine lip. Seat a
    // second time on that actual final position so projection, seal frontier,
    // and rendered seal rows all describe the same place before the next frame.
    this.reseat(pos.x, pos.z);
    return safe.s;
  }
  fallenS() { return Math.floor(this.length * 0.22); }

  contains(x, z) {
    return z > 42 || (z > 30 && Math.abs(x) > 40);
  }

  heightAt(x, z) {
    const pr = this.project(x, z);
    if (pr && Math.abs(pr.s - this.ravineS()) < 3.2) {
      // the ravine: a black gash you do not walk across
      const d = Math.abs(pr.s - this.ravineS());
      return lerp(-7, 0, smoothstep(1.4, 3.2, d));
    }
    return Math.sin(x * 0.23) * Math.sin(z * 0.31) * 0.22;
  }

  project(x, z) {
    // nearest sample, warm-started from last query
    let best = -1, bestD = Infinity;
    const from = Math.max(0, this._lastIdx - 40), to = Math.min(this.length - 1, this._lastIdx + 40);
    for (let i = from; i <= to; i++) {
      const s = this.samples[i];
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return null;
    // Cold-scan whenever the warm window's answer is implausible — NOT only when
    // the warm index happens to sit at an end. That guard meant any stale index
    // in the middle of the spline (a death respawn, a teleport, a checkpoint
    // restore) returned a projection tens of metres off the trail, and every
    // system downstream — ground height, the corridor clamp, the seal frontier —
    // then agreed with each other about a place the player was not.
    if (bestD > 40 * 40) {
      // cold start: full scan once
      for (let i = 0; i < this.length; i++) {
        const s = this.samples[i];
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    // FRACTIONAL s (eaten-path law): refine against the two adjacent polyline
    // edges so the seal clamp resolves to a position that satisfies itself.
    // Integer quantization here is what pinned Alex in place (playtest 3):
    // the push rounded to a sample still behind the clamp and re-fired forever.
    let fs = best, fx = this.samples[best].x, fz = this.samples[best].z;
    for (const j of [best - 1, best + 1]) {
      if (j < 0 || j >= this.length) continue;
      const a = this.samples[Math.min(best, j)], b = this.samples[Math.max(best, j)];
      const ex = b.x - a.x, ez = b.z - a.z;
      const L2 = ex * ex + ez * ez;
      if (L2 < 1e-6) continue;
      const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / L2, 0, 1);
      const px = a.x + ex * t, pz = a.z + ez * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bestD) { bestD = d; fs = Math.min(best, j) + t; fx = px; fz = pz; }
    }
    const si = this.samples[clamp(Math.round(fs), 0, this.length - 1)];
    const lat = (x - fx) * -si.tz + (z - fz) * si.tx;   // signed lateral
    // fx/fz is the FOOT of the projection — the point lat is measured from.
    // Anything that reconstructs a position from lat must use this and not
    // `sample`, or it rebuilds in a different frame than the one it measured in.
    return { s: fs, i: clamp(Math.round(fs), 0, this.length - 1), lat, sample: si, fx, fz };
  }

  posAt(s, lat = 0) {
    // fractional interpolation — pairs with project()'s fractional s
    const sc = clamp(s, 0, this.length - 1);
    const i0 = Math.floor(sc), i1 = Math.min(this.length - 1, i0 + 1), t = sc - i0;
    const a = this.samples[i0], b = this.samples[i1];
    const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    const tx = lerp(a.tx, b.tx, t), tz = lerp(a.tz, b.tz, t);
    return new THREE.Vector3(x + -tz * lat, 0, z + tx * lat);
  }

  clampPlayer(pos, dt) {
    // postClamp is a global World hook, but this corridor owns the player only
    // during the forest act. Without this guard the mirror room at (500, 500)
    // projected onto the forest every frame, teleporting its camera/figure back
    // outdoors and producing the finale's open-sky geometry explosion.
    if (this.game.act !== 'forest') return;
    if (pos.z < 42) return;              // not in the forest yet
    const pr = this.project(pos.x, pos.z);
    if (!pr) return;
    const beforeClampX = pos.x;
    const beforeClampZ = pos.z;
    // The final spline samples are the one authored exit. Never relinquish
    // containment merely because a lateral breach got far enough away: that
    // used to disable both the wall correction and the fall rescue.
    // At the end, release only through the narrow forward mouth. A point far
    // beside the last sample also projects to the end, but it is still a side
    // breach and must remain under the forest's jurisdiction.
    const last = this.samples[this.length - 1];
    const endDx = pos.x - last.x, endDz = pos.z - last.z;
    const beyondEnd = endDx * last.tx + endDz * last.tz;
    const mouthLat = endDx * -last.tz + endDz * last.tx;
    const mouthHalf = this.halfW[this.length - 1] - 0.2;
    if (pr.s >= this.length - 2 && beyondEnd > -0.5 && Math.abs(mouthLat) <= mouthHalf) return;
    this._lastIdx = pr.i;
    if (!this.entered && pr.s > 4) {
      this.entered = true;
      this.game.flag('forestEntered');
      // the gate slams: the way back is already gone. the first look back
      // teaches the whole mechanic (eaten-path law).
      this.sealS = Math.max(this.sealS, pr.s - 6);
      this._placeSeal(true);
      this.game.audio.brushCrash({ pos: this.posAt(this.sealS), gain: 0.85, rate: 0.8 });
      this.game.audio.stoneGrind({ pos: this.posAt(this.sealS), gain: 0.5 });
      this._lookWindow = 5.0;
    }
    // fall rescue: terrain gaps must never eat the player (playtest 3b —
    // "i fell into the ground into nothingness"). The path takes you back.
    if (pos.y < -6) {
      const p = this.posAt(Math.max(pr.s, this.sealS + SEAL_TRAIL));
      pos.x = p.x; pos.z = p.z; pos.y = 0.6;
    }
    // Pocket widening is intentionally asymmetric and conditional. Before the
    // matching outbound skull latch, ordinary walking only owns the base route;
    // after it, that pocket's side opens all the way to its real grounded shelf.
    // A tiny Gaussian tail is ignored so there is no invisible kilometre-long
    // clamp, while every practically walkable part of the widening stays gated.
    const baseHw = this.baseHalfW[pr.i] - 0.38;
    let minLat = -baseHw;
    let maxLat = baseHw;
    for (const pocket of this.secretPockets) {
      const extra = pocket.widen * Math.exp(-(((pr.s - pocket.centerS) / pocket.span) ** 2));
      if (extra < 0.08 || !this.game.flags.has(`${pocket.flag}:latched`)) continue;
      if (pocket.side > 0) maxLat = Math.max(maxLat, baseHw + extra);
      else minLat = Math.min(minLat, -baseHw - extra);
    }
    const lat = clamp(pr.lat, minLat, maxLat);
    // self-heal: if the frontier is impossibly far AHEAD of the player, a
    // respawn/teleport put them behind sealed path — the forest re-opens to
    // them rather than crushing them (the wall stays standing; only the
    // clamp regresses). Normal play can never trigger this: the frontier
    // always trails by SEAL_TRAIL.
    if (this.sealS + 2.2 > pr.s + 6) this.sealS = pr.s - SEAL_TRAIL;
    // seal frontier IS the wall behind you
    const minS = this.sealS + 2.2;
    if (pr.s < minS) {
      // seal push: a hard forward reposition — never soften this one.
      // fractional posAt guarantees the pushed position satisfies the clamp,
      // so it fires once and quiesces (integer rounding here once pinned a
      // player in place for good — playtest 3).
      const p = this.posAt(minS, lat);
      pos.x = p.x;
      pos.z = p.z;
    } else if (lat !== pr.lat) {
      // WALL SLIDE. This rebuilt the position from pr.sample — the ROUNDED
      // sample — while `lat` had been measured from the fractional foot of the
      // projection. Two different frames: the correction landed at a point whose
      // own projection was wrong by the same offset again, so it re-fired every
      // frame and the player was nailed in place walking forward into a bend.
      // (Alex: "the forest is easy to get stuck in and not be able to go
      // anywhere." tools/probe-stuck.mjs pinned there for 33 seconds.)
      // Rebuild from the foot, in the frame lat was measured in. `along` is ~0
      // by construction — the foot IS the closest point — so this slides you
      // sideways off the wall and leaves your progress along the trail alone.
      const si = pr.sample;
      const along = (pos.x - pr.fx) * si.tx + (pos.z - pr.fz) * si.tz;
      pos.x = pr.fx + -si.tz * lat + si.tx * along;
      pos.z = pr.fz + si.tx * lat + si.tz * along;
    }
    // frontier chases; lingering makes it creep — the creaks ask you to turn
    if (this.entered) {
      this._idleT = (Math.abs(pr.s - (this._idleS || 0)) < 0.5) ? (this._idleT || 0) + dt : 0;
      this._idleS = pr.s;
      let target = pr.s - SEAL_TRAIL;
      if (this._idleT > 32) target = Math.max(target, pr.s - 7);
      if (target > this.sealS) {
        const rate = this._idleT > 32 ? 0.3 : Math.max(1.5, (target - this.sealS) * 2.4);
        this.sealS = Math.min(target, this.sealS + rate * dt);
        this._placeSeal();
      }
    }
    // Player vertical integration ran before postClamp. If this hook changes
    // XZ, the old `gh` belongs to a different point—occasionally the other side
    // of a terrain ripple or a seam—and the next frame begins below its new
    // floor. Resolve grounded feet against the corrected point in this same
    // frame. Airborne motion stays airborne; only penetration is lifted. The
    // authored ravine remains a real absence and is never paved by this safety.
    if (Math.hypot(pos.x - beforeClampX, pos.z - beforeClampZ) > 1e-5) {
      const finalPr = this.project(pos.x, pos.z);
      if (finalPr) this._lastIdx = finalPr.i;
      const inRavine = finalPr && Math.abs(finalPr.s - this.ravineS()) < 3.2;
      if (!inRavine) {
        const ground = this.heightAt(pos.x, pos.z);
        const player = this.game.player;
        if (player?.grounded) {
          pos.y = ground;
          player.fallV = 0;
        } else if (pos.y < ground) {
          pos.y = ground;
        }
      }
    }
  }

  // The forest LOOK, ported from THE EATEN PATH (docs/analysis/eaten-path.json).
  // The seal mechanics already came across; this is the other half — why that
  // forest reads as a place and this one read as poles on a floor. Five things
  // do nearly all of it: trunks that LEAN over the path, canopy that closes the
  // sky above it, branches that knit across it, shrub walls that give the
  // corridor surfaces, and two ground ribbons instead of one flat strip.
  _buildFlora(rng) {
    const { scene, mats: M } = this.game;
    const at = (i, lat) => {
      const sm = this.samples[clamp(Math.round(i), 0, this.length - 1)];
      return { x: sm.x + -sm.tz * lat, z: sm.z + sm.tx * lat, tx: sm.tx, tz: sm.tz };
    };

    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.26, 1, 7);
    trunkGeo.translate(0, 0.5, 0);
    const branchGeo = new THREE.CylinderGeometry(0.05, 0.085, 1, 5);
    branchGeo.translate(0, 0.5, 0);
    const rootGeo = new THREE.TorusGeometry(1, 0.09, 4, 8, Math.PI * 0.85);
    // crossed planes: the cheapest thing that still reads as a mass of leaves
    const shrubGeo = (() => {
      const g = new THREE.BufferGeometry();
      const pos = [], uv = [], idx = [];
      for (let k = 0; k < 2; k++) {
        const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
        const o = k * 4;
        pos.push(-c, 0, -s, c, 0, s, c, 1.6, s, -c, 1.6, -s);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    // A crown made from several torn, intersecting leaf planes keeps the sky
    // sealed without becoming a single black polygon when the player looks
    // up.  The same alpha silhouette is reused by hundreds of instances, so
    // this still costs one draw and leaves pinholes of moon-depth between
    // overlapping layers.
    const canopyGeo = (() => {
      const plane = (rx, ry, rz, y) => {
        const g = new THREE.PlaneGeometry(2, 2, 1, 1);
        g.rotateX(rx);
        g.rotateY(ry);
        g.rotateZ(rz);
        g.translate(0, y, 0);
        return g;
      };
      return mergeGeometries([
        plane(-Math.PI / 2, 0, 0.12, 0.10),
        plane(-Math.PI / 2 + 0.34, 0.46, -0.28, 0.18),
        plane(-Math.PI / 2 - 0.31, -0.61, 0.37, -0.08),
        plane(-0.12, 0.84, 0.16, 0.02),
      ], false);
    })();
    const shrubTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      g.clearRect(0, 0, 64, 64);
      const cols = ['#1c2818', '#16211a', '#212e1a', '#0f1810'];
      for (let i = 0; i < 120; i++) {
        const x = 5 + rng.float() * 54, y = 64 - rng.float() * 60, r = rng.range(1.8, 5.2);
        g.fillStyle = cols[rng.int(0, 3)];
        g.beginPath();
        g.ellipse(x, y, r, r * rng.range(0.55, 1), rng.float() * TAU, 0, TAU);
        g.fill();
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();

    const trunks = [], canopies = [], branches = [], shrubs = [], roots = [], sideMasses = [];
    for (let i = 2; i < this.length - 2; i += 2) {
      const hw = this.halfW[i];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const off = hw + 0.8 + -Math.log(1 - rng.float()) * 2.6;
          if (off > hw + 12) continue;
          const p = at(i + rng.gauss() * 0.7, side * off);
          const h = rng.range(5, 9.5);
          // near-wall trunks lean OVER the corridor — this is the single
          // cheapest thing that turns a row of poles into a forest wall
          const lean = off < hw + 2.4 ? rng.range(0.05, 0.17) : rng.range(-0.04, 0.06);
          trunks.push({ x: p.x, z: p.z, tx: p.tx, tz: p.tz, h, lean, side, tint: rng.range(0.42, 0.86) });
          canopies.push({
            x: p.x + rng.gauss() * 0.8, y: Math.max(7.0, h * rng.range(1.05, 1.17)), z: p.z + rng.gauss() * 0.8,
            sc: rng.range(1.0, 1.72), tint: rng.range(0.72, 1.06),
          });
        }
      }
      // the sky closes over the path: low canopy blobs above the corridor
      if (rng.chance(0.38)) {
        // Close the crown from alternating shoulders, never by parking one
        // enormous solid object directly over the camera centreline.
        const side = rng.chance(0.5) ? -1 : 1;
        const p = at(i, side * (0.45 + hw * rng.range(0.24, 0.48)));
        canopies.push({
          x: p.x, y: rng.range(8.0, 10.3), z: p.z,
          sc: rng.range(1.05, 1.62), tint: rng.range(0.65, 0.94),
        });
      }
      // and branches knit across it, low enough to duck under
      if (rng.chance(0.13)) {
        const y = rng.range(2.9, 4.3);
        const a = at(i, -(hw + rng.range(0, 0.9))), b = at(i + rng.gauss() * 1.2, hw + rng.range(0, 0.9));
        const av = new THREE.Vector3(a.x, y + rng.gauss() * 0.4, a.z);
        const bv = new THREE.Vector3(b.x, y + rng.gauss() * 0.4, b.z);
        const mid = av.clone().lerp(bv, rng.range(0.42, 0.58));
        mid.y += rng.range(-0.48, 0.62);
        mid.x += -a.tz * rng.range(-0.65, 0.65);
        mid.z += a.tx * rng.range(-0.65, 0.65);
        branches.push({ a: av, b: mid }, { a: mid, b: bv });
      }
    }
    // shrub walls line the corridor — the surfaces you actually walk between.
    // Use the UNPINCHED width so foliage never presses against the lens.
    const shoulderLandmarks = [
      21, this.ravineS() - 13, this.ravineS() + 18,
      this.arenaS(), this.length - 11,
      ...this.secretPockets.map((pocket) => pocket.centerS),
    ];
    for (let i = 2; i < this.length - 2; i += 1) {
      if (rng.chance(0.25)) continue;
      // Leave a narrow readable silhouette slot around authored objects while
      // the deeper batched belt remains solid behind them. This is not an open
      // side: it is the difference between seeing a waystone and seeing a
      // shrub alpha-card pasted over a waystone.
      if (shoulderLandmarks.some((s) => Math.abs(i - s) < 3.4)) continue;
      const wallW = Math.max(this.halfW[i], 1.9);
      for (const side of [-1, 1]) {
        const p = at(i, side * (wallW + rng.range(0.3, 1.1)));
        shrubs.push({ x: p.x, z: p.z, sc: rng.range(0.55, 1.15), rotY: rng.float() * TAU, tint: rng.range(0.48, 0.86) });
        if (rng.chance(0.28)) {
          const p2 = at(i, side * (wallW + rng.range(1.7, 3.8)));
          shrubs.push({ x: p2.x, z: p2.z, sc: rng.range(0.75, 1.5), rotY: rng.float() * TAU, tint: rng.range(0.38, 0.7) });
        }
      }
    }
    // The former forest had enough trunks on a top-down count and still showed
    // long blue rectangles of empty world between them at eye level.  Two
    // volumetric belts close those sightlines: a low shoulder behind the alpha
    // shrubs and a taller irregular mass behind the trunks.  They are visual
    // only and begin outside the authored clamp, so density cannot become an
    // invisible collision maze.  One InstancedMesh carries the whole 208m run.
    for (let i = 1; i < this.length - 1; i += 1) {
      const hw = this.halfW[i];
      for (const side of [-1, 1]) {
        const near = at(i + rng.gauss() * 0.28, side * (hw + rng.range(1.9, 2.7)));
        sideMasses.push({
          x: near.x, baseY: 0, z: near.z,
          sx: rng.range(0.9, 1.45), sy: rng.range(1.05, 1.75), sz: rng.range(1.15, 1.8),
          rotY: rng.float() * TAU, tint: rng.range(0.54, 0.9),
        });
        const far = at(i + rng.gauss() * 0.45, side * (hw + rng.range(3.8, 5.4)));
        sideMasses.push({
          x: far.x, baseY: rng.range(0.25, 0.75), z: far.z,
          sx: rng.range(1.45, 2.35), sy: rng.range(1.65, 2.85), sz: rng.range(1.55, 2.6),
          rotY: rng.float() * TAU, tint: rng.range(0.42, 0.74),
        });
        const upper = at(i + rng.gauss() * 0.55, side * (hw + rng.range(3.0, 5.2)));
        sideMasses.push({
          x: upper.x, baseY: rng.range(2.5, 3.4), z: upper.z,
          sx: rng.range(1.2, 2.0), sy: rng.range(1.4, 2.45), sz: rng.range(1.35, 2.3),
          rotY: rng.float() * TAU, tint: rng.range(0.34, 0.62),
        });
      }
    }
    // roots breaking out of the dirt across the trail
    for (let n = 0; n < 26; n++) {
      const i = rng.range(4, this.length - 6);
      const p = at(i, rng.gauss() * this.halfW[Math.round(i)] * 0.5);
      roots.push({ x: p.x, z: p.z, sc: rng.range(0.5, 1.15), rotY: rng.float() * TAU, tip: rng.range(-0.3, 0.3) });
    }

    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const v = new THREE.Vector3(), sv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(), col = new THREE.Color();
    const bake = (geo, mat, items, place, tintOf) => {
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => {
        place(it, i);
        im.setMatrixAt(i, mtx);
        // per-instance tint jitter, so 800 copies of one trunk stop looking
        // like 800 copies of one trunk
        if (tintOf) im.setColorAt(i, col.setScalar(tintOf(it)));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      scene.add(im);
      return im;
    };

    bake(trunkGeo, M.bark, trunks, (it) => {
      // tilt the trunk's up-axis toward the corridor centre
      dir.set(-it.tz, 0, it.tx).multiplyScalar(-it.side);
      v.copy(up).addScaledVector(dir, Math.tan(it.lean)).normalize();
      q.setFromUnitVectors(up, v);
      mtx.compose(sv.set(it.x, 0, it.z), q, v.set(1.1, it.h, 1.1));
    }, (it) => it.tint);

    const canopyMat = new THREE.MeshLambertMaterial({
      color: 0xd5ddd0,
      map: shrubTex,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      emissive: 0x070b07,
      emissiveIntensity: 0.2,
    });
    bake(canopyGeo, canopyMat, canopies, (it) => {
      e.set(0, it.tint * 6, 0); q.setFromEuler(e);
      mtx.compose(v.set(it.x, it.y, it.z), q, sv.set(it.sc * 1.65, it.sc * 0.92, it.sc * 1.65));
    }, (it) => it.tint);

    bake(branchGeo, M.bark, branches, (it) => {
      dir.subVectors(it.b, it.a);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      mtx.compose(it.a, q, sv.set(1, len, 1));
    }, () => 0.85);

    const shrubMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: shrubTex,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      emissive: 0x080b07,
      emissiveIntensity: 0.13,
    });
    // The deep belts deliberately use the same perforated leaf silhouette as
    // the shoulder shrubs.  Solid polyhedra closed the view but looked like
    // green boulders; crossed foliage closes the void while preserving dozens
    // of little depth holes and edges for the skull light to rake across.
    const sideBeltMesh = bake(shrubGeo, shrubMat, sideMasses, (it) => {
      e.set(0, it.rotY, 0); q.setFromEuler(e);
      mtx.compose(v.set(it.x, it.baseY || 0, it.z), q, sv.set(it.sx, it.sy, it.sz));
    }, (it) => it.tint);
    sideBeltMesh.name = 'sealed forest side belts';
    this.sideBeltMesh = sideBeltMesh;
    this.floraStats = {
      sideBeltInstances: sideMasses.length,
      shoulderShrubs: shrubs.length,
      trunks: trunks.length,
      canopies: canopies.length,
    };
    bake(shrubGeo, shrubMat, shrubs, (it) => {
      e.set(0, it.rotY, 0); q.setFromEuler(e);
      mtx.compose(v.set(it.x, 0, it.z), q, sv.set(it.sc, it.sc, it.sc));
    }, (it) => it.tint);

    bake(rootGeo, new THREE.MeshLambertMaterial({ color: 0x2c2118 }), roots, (it) => {
      e.set(Math.PI / 2 + it.tip, it.rotY, 0); q.setFromEuler(e);
      mtx.compose(v.set(it.x, -0.06, it.z), q, sv.set(it.sc, it.sc, it.sc));
    }, null);

    // ---- ground: two ribbons, not one. A wide vertex-jittered fringe under
    // the trees so the floor is never a flat sheet, and a raised paler trail
    // on top of it so the path itself stays readable in the dark.
    const ribbonMesh = (widthFn, y, colorFn, mat) => {
      const pos = [], uv = [], colA = [], idx = [];
      let prev = -1;
      for (let i = 0; i < this.length; i++) {
        // the ravine is a black gash across the trail — the ground stops at it
        if (Math.abs(i - this.ravineS()) < 3) { prev = -1; continue; }
        const hw = widthFn(i);
        const a = at(i, -hw), b = at(i, hw);
        const k = pos.length / 3;
        pos.push(a.x, y, a.z, b.x, y, b.z);
        uv.push(0, i * 0.26, hw * 0.5, i * 0.26);
        const [c1, c2] = colorFn(i);
        colA.push(...c1, ...c2);
        if (prev >= 0) idx.push(prev, k, prev + 1, prev + 1, k, k + 1);
        prev = k;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;             // the trunks have to land ON something
      scene.add(m);
      return m;
    };
    const fringeMat = M.dirt.clone(); fringeMat.vertexColors = true; fringeMat.side = THREE.DoubleSide;
    const trailMat = M.dirt.clone(); trailMat.vertexColors = true; trailMat.side = THREE.DoubleSide;
    const jit = () => { const c = rng.range(0.30, 0.56); return [c, c * 0.97, c * 0.88]; };
    ribbonMesh((i) => this.halfW[i] + 7.5, 0, () => [jit(), jit()], fringeMat);
    ribbonMesh((i) => Math.min(this.halfW[i] * 0.72, 2.0), 0.03,
      () => { const c = [0.72, 0.66, 0.55]; return [c, c]; }, trailMat);

    // wide under-floor so gaps between trees never show the void
    const under = new THREE.Mesh(new THREE.PlaneGeometry(320, 400), M.dirt);
    under.rotation.x = -Math.PI / 2;
    under.position.set(10, -0.35, 220);
    scene.add(under);
    // the ravine's black throat
    const rvs = this.posAt(this.ravineS());
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ color: 0x010102 }));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(rvs.x, -5.8, rvs.z);
    scene.add(pit);
  }

  _buildSealPool() {
    // CUMULATIVE (eaten-path law): trunks appended as the frontier advances
    // and NEVER repositioned — looking back must always show solid forest
    // where path used to be. The old 48-instance recycler teleported its
    // trunks forward, leaving the sealed corridor visibly empty (playtest 3:
    // "no reason for me to look back at all").
    const { scene, mats: M } = this.game;
    const N = Math.ceil(this.length * 3.2) + 64;
    this.sealMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.16, 0.3, 1, 6), M.bark, N);
    this.sealMesh.frustumCulled = false;
    this.sealMesh.count = 0;
    scene.add(this.sealMesh);
    this.sealCap = N;
    this.sealAnim = [];                  // {x, z, h, t, dur} — t<0 is stagger delay
    this._sealPlaced = -999;
    this._sealCreakT = 0;
    this._lookWindow = 0;
    this._sealMtx = this._sealMtx || new THREE.Matrix4();
    this._sealPos = this._sealPos || new THREE.Vector3();
    this._sealQuat = this._sealQuat || new THREE.Quaternion();
    this._sealScale = this._sealScale || new THREE.Vector3();
  }

  _placeSeal(instant = false) {
    // append rows from the last placed point up to the frontier
    if (!instant && this.sealS - this._sealPlaced < 1.2) return;
    const from = Math.max(0, this._sealPlaced < -100 ? this.sealS - 4 : this._sealPlaced + 1.2);
    const rng = new RNG(0x77 + Math.floor(this.sealS * 7));
    let spawned = 0;
    for (let s = from; s <= this.sealS && this.sealAnim.length < this.sealCap - 5; s += 1.2) {
      const i = clamp(Math.round(s), 0, this.length - 1);
      const sm = this.samples[i];
      const hw = this.halfW[i];
      // trunks across the full corridor width AND its shoulders — a wall, not a picket
      for (let k = 0; k < 4 && this.sealAnim.length < this.sealCap; k++) {
        const lat = (k / 3 - 0.5) * 2 * (hw + 1.2) + rng.range(-0.6, 0.6);
        this.sealAnim.push({
          x: sm.x + -sm.tz * lat + rng.range(-0.4, 0.4),
          z: sm.z + sm.tx * lat + rng.range(-0.4, 0.4),
          h: rng.range(4.5, 8.5),
          t: instant ? 1 : -rng.range(0, 0.5),
          dur: rng.range(1.9, 3.0),
        });
        spawned++;
      }
    }
    if (!spawned) return;
    this._sealPlaced = this.sealS;
    this.sealMesh.count = this.sealAnim.length;
    if (instant) {
      // fully risen — stamp matrices now
      const mtx = this._sealMtx, v = this._sealPos, sv = this._sealScale, q = this._sealQuat;
      this.sealAnim.forEach((a, i) => {
        if (a.t < 1) return;
        mtx.compose(v.set(a.x, a.h / 2, a.z), q, sv.set(1.2, a.h, 1.2));
        this.sealMesh.setMatrixAt(i, mtx);
      });
      this.sealMesh.instanceMatrix.needsUpdate = true;
      return;
    }
    this._lookWindow = 4.5;              // a fresh row is worth turning for
    if (this._sealCreakT <= 0) {
      this._sealCreakT = 2.2 + Math.random() * 2.3;
      this.game.audio.creak({ pos: this.posAt(this.sealS), gain: 0.55, rate: 0.75 });
    }
  }

  update(dt) {
    const mtx = this._sealMtx, v = this._sealPos, sv = this._sealScale, q = this._sealQuat;
    let dirty = false;
    this.sealAnim.forEach((a, i) => {
      if (a.t >= 1) return;
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = a.t < 0 ? 0 : smoothstep(0, 1, a.t);
      mtx.compose(v.set(a.x, -a.h / 2 + e * a.h, a.z), q, sv.set(1.2, a.h, 1.2));
      this.sealMesh.setMatrixAt(i, mtx);
      dirty = true;
    });
    if (dirty) this.sealMesh.instanceMatrix.needsUpdate = true;
    this._sealCreakT -= dt;
    // the look-back reward: face the wall that ate the path and the forest
    // answers — once per fresh row (eaten-path's sealSting, our voice)
    if (this._lookWindow > 0) {
      this._lookWindow -= dt;
      const cam = this.game.camera;
      const camPos = cam.getWorldPosition(_lookA);
      const toF = _lookB.copy(this.posAt(this.sealS)).sub(camPos);
      toF.y = 0;
      const d = toF.length();
      if (d < 28) {
        const dir = cam.getWorldDirection(_lookC);
        if (toF.normalize().dot(dir) > 0.55) {
          this._lookWindow = 0;
          this.game.audio.sting(0.32);
          this.game.shake(0.07);
        }
      }
    }
  }

  _setpieces() {
    const { world, scene, mats: M, audio } = this.game;
    const game = this.game;

    // fallen tree blocking the path — the skull clears it (3 hits)
    const fs = this.fallenS();
    const fsm = this.samples[fs];
    // A trunk you cannot climb over has to LOOK like one. This was a bare
    // 1.1m-wide cylinder with a 1.6m-tall invisible wall standing in front of
    // it — so it stopped you at chest height for no visible reason — and its
    // three hits were instant 5-degree snaps with no motion at all.
    const log = new THREE.Group();
    const LOG_R = 0.78;
    const bole = new THREE.Mesh(new THREE.CylinderGeometry(LOG_R * 0.82, LOG_R, 7.4, 10), M.bark);
    bole.rotation.z = Math.PI / 2;
    log.add(bole);
    // root plate at the torn end: the reason it is lying here
    const roots = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), M.bark);
    roots.position.set(-3.7, 0.1, 0);
    roots.scale.set(0.55, 1, 1);
    log.add(roots);
    // snapped limbs — they read as "you are not stepping over this"
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7;
      const lim = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 1.5 + (i % 3) * 0.6, 5), M.bark);
      lim.position.set(-2.4 + i * 1.35, LOG_R * 0.5, 0);
      lim.rotation.set(Math.sin(a) * 0.7, a, 0.5 + Math.cos(a) * 0.8);
      log.add(lim);
    }
    log.position.set(fsm.x, LOG_R, fsm.z);
    log.rotation.set(0, Math.atan2(fsm.tx, -fsm.tz), 0.06);
    scene.add(log);
    // A DIAGONAL LOG CANNOT BE ONE AXIS-ALIGNED BOX.
    // It used to be exactly that — a fixed 6.8 x 1.6 box written as if the
    // corridor always ran along X. Here the trail runs at about 37 degrees, so
    // the tight AABB around a 7.4m log is roughly SIX BY SEVEN METRES: it spans
    // the whole 3m corridor and three and a half metres of its length, and the
    // player is stopped dead that far short of a log they can plainly see, with
    // no way round. That is Alex's "the forest is easy to get stuck in and not
    // be able to go anywhere" — tools/probe-stuck.mjs pins there on every run.
    // Step it instead: a row of small boxes along the log's own axis, each one
    // tight because each one is short. Same wall, a tenth of the footprint.
    const px = -fsm.tz, pz = fsm.tx;                       // the log's long axis
    const SEGS = 9, halfSeg = 3.6 / SEGS + 0.06, halfThick = 0.8;
    const hx = Math.abs(px) * halfSeg + Math.abs(fsm.tx) * halfThick;
    const hz = Math.abs(pz) * halfSeg + Math.abs(fsm.tz) * halfThick;
    const logCols = [];
    for (let i = 0; i < SEGS; i++) {
      const u = (i / (SEGS - 1) - 0.5) * 7.2;
      const cx = fsm.x + px * u, cz = fsm.z + pz * u;
      logCols.push(world.addCollider(cx - hx, 0, cz - hz, cx + hx, LOG_R * 1.75, cz + hz));
    }
    let logHits = 0;
    // dt-driven roll (chamber law: no setTimeout anywhere in a beat)
    const roll = { t: 1, from: 0, to: 0, dropFrom: 0, dropTo: 0, shove: 0 };
    game.tickers.push((dt) => {
      if (roll.t >= 1) return;
      roll.t = Math.min(1, roll.t + dt * 2.6);
      const e = 1 - (1 - roll.t) * (1 - roll.t) * (1 - roll.t);       // it settles, it doesn't snap
      log.rotation.x = lerp(roll.from, roll.to, e);
      log.position.y = lerp(roll.dropFrom, roll.dropTo, e);
      log.position.x = fsm.x + -fsm.tz * Math.sin(roll.t * Math.PI) * roll.shove;
      log.position.z = fsm.z + fsm.tx * Math.sin(roll.t * Math.PI) * roll.shove;
    });
    world.addFetchTarget({
      id: 'fallenTree', object: log, radius: 1.6,
      onHit(skull, at) {
        logHits++;
        game.impact('hurt', at);
        audio.pop({ pos: log.position, gain: 0.32, rate: 0.7 });
        audio.creak({ pos: log.position, gain: 0.45, rate: 0.8 });   // wood complaining
        roll.from = log.rotation.x;
        roll.to = log.rotation.x + 0.55;                             // it ROLLS, visibly
        roll.dropFrom = log.position.y;
        roll.dropTo = Math.max(0.3, log.position.y - 0.14);
        roll.shove = 0.16;
        roll.t = 0;
        if (logHits >= 3) {
          this.enabled = false;
          for (const c of logCols) c.max.y = c.min.y;
          roll.dropTo = 0.34;
          roll.to = log.rotation.x + 1.35;                           // the last one rolls it clear
          game.flag('treeCleared');
          audio.brushCrash({ pos: log.position, gain: 0.7 });
        }
        return 'return';
      },
    });

    // the rope over the ravine
    const rs = this.ravineS();
    const far = this.posAt(rs + 4);
    const rope = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), M.bark);
    beam.rotation.z = 1.1;
    beam.position.y = 3.4;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 4), M.curtain);
    line.position.set(0.9, 2.3, 0);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), M.curtain);
    knot.position.set(0.9, 1.25, 0);
    rope.add(beam, line, knot);
    rope.position.set(far.x, 0, far.z);
    scene.add(rope);
    this.ropeAnchor = new THREE.Vector3(far.x + 0.9, 1.4, far.z);
    const landing = this.posAt(rs + 7);   // clear of the gash, not on its lip
    const ravineRopeTarget = world.addFetchTarget({
      id: 'ravineRope', pos: this.ropeAnchor, radius: 1.1,
      onHit(skull) {
        // A bad release cannot spend the only crossing. The director disables
        // the target only once the player is grounded on the far side.
        if (game.player.swing) return 'return';
        // The pivot sits ABOVE THE FAR-SIDE LANDING, not on the rope itself.
        // Anchoring on the rope pulls you into the lip of the gash; anchoring
        // over the ground beyond it means holding carries you up and across,
        // and letting go drops you where the old scripted launch used to put
        // you — same destination, except now you fly there under your own arc.
        const pivot = new THREE.Vector3(landing.x, 3.4, landing.z);
        skull.anchorAt(pivot, { swing: true, maxHold: 7 });
        game.flag('ropeLatched');
        audio.creak({ pos: rope.position, gain: 0.6 });
        game.player.beginSwing(pivot);
        return 'anchor';
      },
    });
    game.ravineRopeTarget = ravineRopeTarget;
  }

  _buildForestLandmarks() {
    const { scene, mats: M } = this.game;
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), scale = new THREE.Vector3();
    const dir = new THREE.Vector3(), e = new THREE.Euler(), mtx = new THREE.Matrix4();
    const wood = [], pale = [], stones = [];
    const landmarks = [];

    const groundPoint = (s, lat = 0) => {
      const v = this.posAt(s, lat);
      v.y = this.heightAt(v.x, v.z);
      return v;
    };
    const segment = (a, b, radius, isPale = false) => {
      const d = b.clone().sub(a);
      const len = d.length();
      if (len < 0.02) return;
      (isPale ? pale : wood).push({
        p: a.clone().add(b).multiplyScalar(0.5),
        q: new THREE.Quaternion().setFromUnitVectors(up, d.divideScalar(len)),
        radius, len,
      });
    };
    const arch = (id, s, height, skew = 0) => {
      const i = clamp(Math.round(s), 0, this.length - 1);
      const spread = this.halfW[i] + 0.72;
      const left = groundPoint(s - 0.45, -spread);
      const right = groundPoint(s + 0.45, spread);
      const crown = groundPoint(s + 0.7, skew);
      crown.y += height;
      segment(left, crown, 0.31);
      segment(right, crown, 0.29);
      const hook = groundPoint(s + 3.4, -skew * 0.5);
      hook.y = crown.y - 1.0;
      segment(crown, hook, 0.13);
      const pos = groundPoint(s, 0);
      landmarks.push({ id, s, pos });
    };

    // A handful of silhouettes divide the 208m run into remembered chapters.
    // They sit beyond the movement shoulder and are shape/value landmarks, not
    // glowing breadcrumbs: a split gate, a lightning-white snag, old stones,
    // the arena ring, and a final crooked arch before the oasis opens.
    arch('split-gate', 21, 6.1, -0.5);
    arch('crooked-exit', this.length - 11, 5.7, 0.65);

    const snagS = this.ravineS() - 13;
    const snagI = Math.round(snagS);
    const snag = groundPoint(snagS, -(this.halfW[snagI] + 0.8));
    const snagTop = snag.clone().add(new THREE.Vector3(0, 8.7, 0));
    segment(snag, snagTop, 0.34);
    const sm = this.samples[snagI];
    for (const [along, side, y] of [[2.7, 1.65, 6.8], [-2.0, 1.25, 5.4], [1.3, -1.75, 7.7]]) {
      const tip = snag.clone().add(new THREE.Vector3(
        sm.tx * along + -sm.tz * side, y, sm.tz * along + sm.tx * side,
      ));
      segment(snag.clone().setY(snag.y + y * 0.72), tip, 0.105, true);
    }
    landmarks.push({ id: 'lightning-snag', s: snagS, pos: snag.clone() });

    const addStone = (s, lat, h, yaw = 0, lean = 0) => {
      const v = groundPoint(s, lat);
      stones.push({ p: v, h, yaw, lean, sx: 0.48 + (h % 0.37) * 0.3 });
    };
    const wayS = this.ravineS() + 18;
    for (const [ds, side, h, lean] of [[-3, -1, 2.4, -0.12], [0, 1, 3.1, 0.08], [4, -1, 2.0, 0.17], [7, 1, 2.7, -0.1]]) {
      const i = clamp(Math.round(wayS + ds), 0, this.length - 1);
      addStone(wayS + ds, side * (this.halfW[i] + 0.72), h, side * 0.24, lean);
    }
    landmarks.push({ id: 'old-waystones', s: wayS, pos: groundPoint(wayS, 0) });

    const arena = this.arenaS();
    for (const [ds, side, h] of [[-9, -1, 3.5], [-3, -1, 2.8], [5, -1, 4.0], [-8, 1, 2.7], [-1, 1, 3.8], [7, 1, 3.1]]) {
      const i = clamp(Math.round(arena + ds), 0, this.length - 1);
      addStone(arena + ds, side * Math.max(5.8, this.halfW[i] * 0.72), h, side * 0.35 + ds * 0.015, side * 0.06);
    }
    // Three high dead-tree ribs turn the wide arena bulge into a room rather
    // than a sudden patch of blackness. They remain well above and outside the
    // combat lane; their job is silhouette, scale, and a remembered threshold.
    for (const [ds, lean] of [[-7.5, -0.8], [0, 0.55], [7.2, -0.35]]) {
      const s = arena + ds;
      const i = clamp(Math.round(s), 0, this.length - 1);
      const spread = Math.max(5.4, this.halfW[i] * 0.68);
      const left = groundPoint(s - 0.35, -spread);
      const right = groundPoint(s + 0.35, spread);
      const crown = groundPoint(s + lean, 0);
      crown.y += 5.5 + (ds === 0 ? 0.8 : 0);
      segment(left, crown.clone().add(new THREE.Vector3(-0.2, 0, 0.15)), 0.22);
      segment(right, crown.clone().add(new THREE.Vector3(0.2, 0.1, -0.15)), 0.2);
      const brokenTip = groundPoint(s + 2.1 + lean, 0.55 * Math.sign(lean || 1));
      brokenTip.y = crown.y - 0.75;
      segment(crown, brokenTip, 0.085, true);
    }
    landmarks.push({ id: 'arena-ring', s: arena, pos: groundPoint(arena, 0) });

    const bakeSegments = (items, material, name) => {
      if (!items.length) return;
      const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 7), material, items.length);
      items.forEach((it, i) => {
        mtx.compose(it.p, it.q, scale.set(it.radius, it.len, it.radius));
        mesh.setMatrixAt(i, mtx);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      scene.add(mesh);
    };
    bakeSegments(wood, M.bark, 'authored forest landmark wood');
    const paleMat = M.headstone.clone();
    paleMat.color.multiplyScalar(0.72);
    if ('emissive' in paleMat) {
      paleMat.emissive = new THREE.Color(0x24282a);
      paleMat.emissiveIntensity = 0.16;
    }
    bakeSegments(pale, paleMat, 'lightning snag splinters');

    const stoneMat = M.headstone.clone();
    stoneMat.color.setHex(0x303638);
    if ('emissive' in stoneMat) {
      stoneMat.emissive = new THREE.Color(0x080d0f);
      stoneMat.emissiveIntensity = 0.1;
    }
    const standingStoneGeo = new THREE.CylinderGeometry(0.52, 0.68, 1, 5, 1);
    standingStoneGeo.translate(0, 0.5, 0);
    const standingPos = standingStoneGeo.attributes.position;
    for (let i = 0; i < standingPos.count; i++) {
      const x = standingPos.getX(i), y = standingPos.getY(i), z = standingPos.getZ(i);
      const high = smoothstep(0.45, 1, y);
      const edge = 1 + Math.sin(Math.atan2(z, x) * 5 + y * 8.1) * 0.055;
      standingPos.setXYZ(i, x * edge + high * 0.075, y, z * (2 - edge) - high * 0.035);
    }
    standingStoneGeo.computeVertexNormals();
    const stoneMesh = new THREE.InstancedMesh(standingStoneGeo, stoneMat, stones.length);
    stones.forEach((it, i) => {
      q.setFromEuler(e.set(it.lean * 0.45, it.yaw, it.lean));
      mtx.compose(p.set(it.p.x, it.p.y, it.p.z), q,
        scale.set(it.sx, it.h, 0.42 + it.sx * 0.18));
      stoneMesh.setMatrixAt(i, mtx);
      stoneMesh.setColorAt(i, new THREE.Color().setScalar(0.72 + (i % 4) * 0.08));
    });
    stoneMesh.instanceMatrix.needsUpdate = true;
    if (stoneMesh.instanceColor) stoneMesh.instanceColor.needsUpdate = true;
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    stoneMesh.name = 'old waystones and arena ring';
    scene.add(stoneMesh);
    this.landmarks = landmarks;
  }

  _buildOptionalRopes() {
    const game = this.game;
    const { world, scene, mats: M, audio } = game;
    const up = new THREE.Vector3(0, 1, 0);
    const ropeMat = M.curtain.clone();
    if (ropeMat.color) ropeMat.color.multiplyScalar(1.35);
    const knotMat = M.headstone.clone();
    if (knotMat.color) knotMat.color.multiplyScalar(0.86);
    if ('emissive' in knotMat) {
      knotMat.emissive = new THREE.Color(0x41474a);
      knotMat.emissiveIntensity = 0.24;
    }
    const markerMat = new THREE.MeshLambertMaterial({ color: 0x0f1314 });
    const packMat = new THREE.MeshLambertMaterial({ color: 0x0b0d0a });
    const blindMat = M.curtain.clone();
    if (blindMat.color) blindMat.color.setHex(0x20241f);
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0x171916, roughness: 0.9, metalness: 0.36,
    });
    const iron = M.metal;
    const optionalRopes = [];
    const discovered = new Set();

    const addSegment = (group, a, b, radius, mat, sides = 6) => {
      const d = b.clone().sub(a);
      const len = d.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, len, sides), mat);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, d.divideScalar(len));
      mesh.castShadow = radius > 0.06;
      group.add(mesh);
      return mesh;
    };
    const ground = (v) => {
      v.y = this.heightAt(v.x, v.z);
      return v;
    };

    for (const spec of this.secretPockets) {
      const i = clamp(Math.round(spec.centerS), 0, this.length - 1);
      const start = ground(this.posAt(spec.fromS, 0));
      const landing = ground(this.posAt(spec.landingS, spec.side * spec.landingLat));
      const secretPos = ground(this.posAt(spec.centerS, spec.side * (spec.landingLat + 0.2)));
      const supportBase = ground(this.posAt(spec.centerS - 0.7,
        spec.side * (this.halfW[i] - 0.45)));
      const supportTop = supportBase.clone().add(new THREE.Vector3(0, 7.2, 0));
      const pivot = landing.clone().add(new THREE.Vector3(0, 4.25, 0));
      const group = new THREE.Group();
      group.name = `optional skull line: ${spec.id}`;
      addSegment(group, supportBase, supportTop, 0.27, M.bark, 7);
      addSegment(group, supportTop, pivot.clone().add(new THREE.Vector3(0, 1.15, 0)), 0.12, M.bark, 6);
      addSegment(group, pivot.clone().add(new THREE.Vector3(0, 1.15, 0)), pivot, 0.026, ropeMat, 5);
      const knot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), knotMat);
      knot.position.copy(pivot);
      knot.scale.set(1.0, 1.35, 1.0);
      knot.name = `${spec.id} pale knot`;
      group.add(knot);
      const streamerGeo = new THREE.PlaneGeometry(0.18, 0.92, 1, 3);
      const streamerPos = streamerGeo.attributes.position;
      for (let v = 0; v < streamerPos.count; v++) {
        const y = streamerPos.getY(v);
        streamerPos.setX(v, streamerPos.getX(v) + (0.46 - y) * 0.08);
      }
      streamerGeo.computeVertexNormals();
      const streamer = new THREE.Mesh(streamerGeo, ropeMat);
      streamer.position.copy(pivot).add(new THREE.Vector3(0.11 * spec.side, -0.57, 0.03));
      streamer.rotation.y = Math.atan2(start.x - pivot.x, start.z - pivot.z);
      streamer.name = `${spec.id} torn knot streamer`;
      group.add(streamer);

      // A long, low deadfall makes the still-closed rule physical instead of
      // asking the player to discover an invisible clamp. It follows the base
      // route edge far enough to cover every useful metre of the pocket's
      // Gaussian widening. The successful latch makes the forest swallow it;
      // by the time the player lands, the same opening is a clean walk-out.
      const deadfall = new THREE.Group();
      deadfall.name = `${spec.id} closed side-pocket deadfall`;
      const gateReach = spec.span * 2.04;
      const gateCount = 13;
      let previousTop = null;
      for (let k = 0; k < gateCount; k++) {
        const gateS = spec.centerS + lerp(-gateReach, gateReach, k / (gateCount - 1));
        const gateI = clamp(Math.round(gateS), 0, this.length - 1);
        const edgeLat = spec.side * (this.baseHalfW[gateI] - 0.13);
        const root = ground(this.posAt(gateS, edgeLat));
        const crown = ground(this.posAt(
          gateS + (k % 2 ? -0.7 : 0.7),
          edgeLat + spec.side * (0.28 + (k % 3) * 0.08),
        ));
        crown.y = root.y + 1.2 + (k % 4) * 0.18;
        addSegment(deadfall, root, crown, 0.09 + (k % 3) * 0.012, M.bark, 6);
        if (previousTop) {
          const braceEnd = root.clone().lerp(crown, k % 2 ? 0.34 : 0.52);
          addSegment(deadfall, previousTop, braceEnd, 0.052 + (k % 2) * 0.012, M.bark, 5);
        }
        previousTop = crown.clone().lerp(root, 0.18);
      }
      group.add(deadfall);
      const boundary = {
        group: deadfall,
        openT: game.flags.has(`${spec.flag}:latched`) ? 1 : 0,
      };
      deadfall.position.y = boundary.openT ? -2.9 : 0;
      deadfall.visible = boundary.openT < 0.995;

      // The pockets tell two small pieces of the search story without text.
      // One is an abandoned search blind (pack, boots, dead lamp); the other is
      // a bell copse whose marker stones all face back toward the house.
      if (spec.id === 'searchers-line') {
        // A real three-pole blind gives the pocket a readable silhouette. The
        // tarp is torn open toward the route, as if whoever waited here left
        // through the forest wall rather than back along the path.
        const blindLeft = secretPos.clone().add(new THREE.Vector3(-1.35, 0.04, -0.72));
        const blindRight = secretPos.clone().add(new THREE.Vector3(1.3, 0.04, -0.63));
        const blindPeak = secretPos.clone().add(new THREE.Vector3(-0.1, 1.55, 0.24));
        addSegment(group, blindLeft, blindPeak, 0.055, M.bark, 5);
        addSegment(group, blindRight, blindPeak, 0.052, M.bark, 5);
        addSegment(group, blindLeft, blindRight, 0.04, M.bark, 5);
        const tarpGeo = new THREE.BufferGeometry();
        tarpGeo.setAttribute('position', new THREE.Float32BufferAttribute([
          blindLeft.x, blindLeft.y + 0.04, blindLeft.z,
          blindPeak.x - 0.14, blindPeak.y - 0.08, blindPeak.z,
          secretPos.x - 0.15, secretPos.y + 0.12, secretPos.z - 0.62,
        ], 3));
        tarpGeo.computeVertexNormals();
        const tarp = new THREE.Mesh(tarpGeo, blindMat);
        tarp.name = 'torn search blind tarp';
        group.add(tarp);

        const pack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 1), packMat);
        pack.position.copy(secretPos).add(new THREE.Vector3(0.25, 0.42, 0.08));
        pack.rotation.set(-0.08, 0.48, 0.14);
        pack.scale.set(0.82, 1.05, 0.48);
        const flap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.36, 0.09, 8, 1, false, 0, Math.PI), packMat);
        flap.position.copy(pack.position).add(new THREE.Vector3(0, 0.27, -0.15));
        flap.rotation.set(Math.PI / 2, 0.48, 0);
        group.add(pack, flap);
        for (let k = 0; k < 2; k++) {
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.42), markerMat);
          boot.position.copy(secretPos).add(new THREE.Vector3(-0.58 + k * 0.4, 0.09, -0.48 - k * 0.08));
          boot.rotation.y = 0.18 + k * 0.4;
          group.add(boot);
        }
        const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), knotMat);
        lamp.position.copy(secretPos).add(new THREE.Vector3(-0.42, 0.28, 0.42));
        group.add(lamp);
      } else {
        const postA = secretPos.clone().add(new THREE.Vector3(-1.18, 0, -0.2));
        const postB = secretPos.clone().add(new THREE.Vector3(1.06, 0, 0.14));
        const topA = postA.clone().add(new THREE.Vector3(0.22, 2.45, 0.02));
        const topB = postB.clone().add(new THREE.Vector3(-0.14, 2.25, -0.04));
        addSegment(group, postA, topA, 0.09, M.bark, 6);
        addSegment(group, postB, topB, 0.085, M.bark, 6);
        addSegment(group, topA, topB, 0.075, M.bark, 6);
        const bellPos = topA.clone().lerp(topB, 0.52).add(new THREE.Vector3(0, -0.68, 0));
        addSegment(group, topA.clone().lerp(topB, 0.52), bellPos.clone().add(new THREE.Vector3(0, 0.23, 0)), 0.018, ropeMat, 5);
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.64, 11, 1, true), bellMat);
        bell.position.copy(bellPos);
        bell.rotation.z = -0.13;
        const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), knotMat);
        clapper.position.copy(bellPos).add(new THREE.Vector3(0.06, -0.35, 0));
        group.add(bell, clapper);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + 0.3;
          const markerH = 0.62 + (k % 2) * 0.28;
          const markerGeo = new THREE.CylinderGeometry(0.13, 0.2, markerH, 5);
          const marker = new THREE.Mesh(markerGeo, markerMat);
          marker.position.copy(secretPos).add(new THREE.Vector3(Math.cos(a) * 1.5, markerH * 0.5, Math.sin(a) * 1.5));
          marker.rotation.set((k - 2) * 0.035, a + Math.PI, (k % 2 ? -1 : 1) * 0.12);
          group.add(marker);
        }
      }
      group.traverse((o) => {
        if (o.isMesh) { o.castShadow = o.castShadow || false; o.receiveShadow = true; }
      });
      scene.add(group);

      const target = world.addFetchTarget({
        id: spec.targetId,
        object: knot,
        radius: 0.92,
        onHit(skull) {
          // A repeatable knot must still distinguish a fresh throw from the
          // same skull returning through the sphere it just occupied. Without
          // this mode guard, release began the recall and the very next swept
          // segment bit the knot again forever. `continue` preserves the live
          // return; the target remains enabled for the next outbound throw.
          if (skull.mode !== 'outbound' || game.player.swing) return 'continue';
          skull.anchorAt(pivot, { swing: true, maxHold: 5.8 });
          game.player.beginSwing(pivot, { maxT: 5.8 });
          game.flag(`${spec.flag}:latched`);
          boundary.openT = Math.max(boundary.openT, 0.06);
          if (audio?.creak) audio.creak({ pos: supportTop, gain: 0.5, rate: spec.side > 0 ? 1.04 : 0.74 });
          return 'anchor';
        },
      });
      optionalRopes.push({
        id: spec.id,
        target,
        targetId: spec.targetId,
        start: start.clone(),
        pivot: pivot.clone(),
        landing: landing.clone(),
        secretPos: secretPos.clone(),
        flag: spec.flag,
        centerS: spec.centerS,
        fromS: spec.fromS,
        landingS: spec.landingS,
        side: spec.side,
        boundary,
      });
    }

    game.tickers.push((dt) => {
      if (game.act !== 'forest') return;
      for (const line of optionalRopes) {
        const open = game.flags.has(`${line.flag}:latched`);
        line.boundary.openT = clamp(line.boundary.openT + (open ? dt * 2.8 : -dt * 3.6), 0, 1);
        const swallowed = smoothstep(0, 1, line.boundary.openT);
        line.boundary.group.position.y = -2.9 * swallowed;
        line.boundary.group.visible = line.boundary.openT < 0.995;
        if (discovered.has(line.flag) || game.flags.has(line.flag)) continue;
        if (Math.hypot(game.player.pos.x - line.secretPos.x, game.player.pos.z - line.secretPos.z) > 2.15) continue;
        discovered.add(line.flag);
        game.flag(line.flag);
        const pos = line.secretPos.clone().setY(line.secretPos.y + 0.7);
        if (line.id === 'searchers-line' && audio?.metalDrop) {
          audio.metalDrop({ pos, gain: 0.34, rate: 1.32 });
        } else if (audio?.whisper) {
          audio.whisper({ pos, gain: 0.25, rate: 0.78 });
        }
      }
    });
    this.optionalRopes = optionalRopes;
  }
}

// ----------------------------------------------------------------- clearing
export function buildClearing(game) {
  const { world, scene, mats: M } = game;
  const end = game.forest.posAt(game.forest.length - 1);
  const C = { x: end.x, z: end.z + 22 };
  game.clearingCenter = C;

  world.addZone('clearing', C.x - 30, C.z - 24, C.x + 30, C.z + 20.4, -4, 30);
  world.addSurface('dirt', C.x - 30, C.z - 24, C.x + 30, C.z + 30, -4, 30);

  // soft ground bowl
  const g = new THREE.PlaneGeometry(60, 54, 40, 36);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const poolR = Math.hypot(x, z - CLEARING_BASIN.centerZ);
    const basin = -CLEARING_BASIN.depth *
      (1 - smoothstep(CLEARING_BASIN.innerR, CLEARING_BASIN.outerR, poolR));
    pos.setY(i, -0.4 * Math.exp(-((r / 22) ** 2)) + Math.sin(x * 0.4) * 0.08 + basin);
  }
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, M.grass);
  ground.position.set(C.x, 0.02, C.z);
  scene.add(ground);

  // streams feeding a pool at the cliff face
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(3, 26), M.water);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(C.x - 4, 0.06, C.z + 2);
  stream.rotation.z = 0.2;
  scene.add(stream);
  // The visible surface must cover the entire collision basin. It used to end
  // 1.2m before the mathematical depression, creating an invisible pit around
  // apparently dry shore.
  const pool = new THREE.Mesh(new THREE.CircleGeometry(CLEARING_BASIN.waterR, 40), M.water);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(C.x, 0.08, C.z + CLEARING_BASIN.centerZ);
  pool.name = 'clearing plunge pool';
  pool.userData.radius = CLEARING_BASIN.waterR;
  scene.add(pool);
  game.clearingPool = pool;
  game.clearingBasin = CLEARING_BASIN;
  game.tickers.push((dt, t) => {
    if (M.water.map) M.water.map.offset.y = (t * 0.25) % 1;
  });

  // the cliff and the giant waterfall
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(60, 20, 4), M.rock);
  cliff.position.set(C.x, 9, C.z + 22);
  scene.add(cliff);
  world.addCollider(C.x - 30, -2, C.z + 20, C.x - 3.2, 20, C.z + 24);
  world.addCollider(C.x + 3.2, -2, C.z + 20, C.x + 30, 20, C.z + 24);
  // the fall itself — a bright animated sheet; you can WALK through it
  const fallMat = new THREE.MeshStandardMaterial({
    color: 0xaebfc8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82,
    emissive: 0x8fa4b2, emissiveIntensity: 0.3,   // moonlit water carries its own pale glow
  });
  const fallGlow = new THREE.PointLight(0xa8c0cc, 120, 26, 1.5);
  fallGlow.position.set(C.x, 6, C.z + 16);
  scene.add(fallGlow);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 19), fallMat);
  fall.position.set(C.x, 9.5, C.z + 19.9);
  // atmosphere.js supplies the final layered water veil. Retain this authored
  // anchor for progression/debug contracts, but do not overlap two transparent
  // sheets and create moire bands.
  fall.visible = false;
  scene.add(fall);
  game.waterfall = fall;
  game.tickers.push((dt, t) => {
    fall.position.y = 9.5 + Math.sin(t * 9) * 0.05;
    fallMat.opacity = 0.78 + Math.sin(t * 7.3) * 0.05;
  });

  // pale glow-motes — the first place that doesn't want you dead
  const moteGeo = new THREE.BufferGeometry();
  const rng = new RNG(0xbee5);
  const arr = [];
  for (let i = 0; i < 90; i++) {
    arr.push(C.x + rng.range(-22, 22), rng.range(0.4, 4), C.z + rng.range(-18, 14));
  }
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: 0xcfe8d8, size: 0.06, transparent: true, opacity: 0.7, sizeAttenuation: true,
  }));
  motes.frustumCulled = false;
  scene.add(motes);
  game.tickers.push((dt, t) => { motes.position.y = Math.sin(t * 0.5) * 0.3; });

  // The water itself is the bridge gate: before the stones rise, the player
  // falls into the deep basin. A real rock/water curtain at the cave mouth is
  // the second physical lock, preventing a wide detour from breaking the pact.
  game.waterfallBarrier = world.addCollider(C.x - 3.2, -2, C.z + 19.55, C.x + 3.2, 20, C.z + 20.35);
  game.bridgeBarrier = game.waterfallBarrier; // retained debug/older-test name
  game.bridgeStones = [];
  for (let i = 0; i < 7; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 0.5, 9), M.rock);
    st.position.set(C.x + Math.sin(i * 1.7) * 0.34, -1.4, C.z + 8.8 + i * 1.72);
    st.rotation.y = i * 0.73;
    st.castShadow = true;
    st.receiveShadow = true;
    scene.add(st);
    game.bridgeStones.push(st);
  }

  // the target behind the curtain of water
  world.addFetchTarget({
    id: 'waterfall', pos: new THREE.Vector3(C.x, 8, C.z + 20.5), radius: 3.4,
    enabled: false,                                  // armed by the director at act 5
    onHit(skull) {
      game.director.waterfallTaken();
      return 'gone';
    },
  });

  // ---- the one it kept -------------------------------------------------
  // The falls take the skull. They do not take the keepsake. A few breaths
  // after the bargain, the locket is lying on the shore at the pool's rim —
  // the chain snapped clean. The game's only pocketable thing: picked up, it
  // is carried in your otherwise-empty hands to the very end. (The
  // reflection's skull, when you meet it, still wears its own.)
  const shoreLocket = new THREE.Group();
  {
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb9a06a, metalness: 0.85, roughness: 0.3, emissive: 0x4a3c14, emissiveIntensity: 0.9 });
    const oval = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), brassMat);
    oval.scale.set(0.8, 1, 0.34);
    oval.rotation.x = -Math.PI / 2 + 0.3;
    shoreLocket.add(oval);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 5, 12, Math.PI * 1.4),
      new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
    chain.rotation.x = -Math.PI / 2;
    chain.position.set(0.08, 0.005, 0.03);
    shoreLocket.add(chain);
    shoreLocket.visible = false;
    // position at build time: registerInteract bakes a static world-space
    // hitbox from wherever the object IS when registered
    shoreLocket.position.set(C.x + 9.3, 0.3, C.z + 17.5);
    scene.add(shoreLocket);
  }
  let shoreT = 0;
  game.tickers.push((dt, t) => {
    if (game.flags.has('locketKept')) return;
    if (shoreLocket.visible) {
      // it catches what light there is
      shoreLocket.children[0].material.emissiveIntensity = 0.6 + Math.max(0, Math.sin(t * 1.7)) * 0.9;
      return;
    }
    if (!game.flags.has('waterfallTaken') || !game.flags.has('keepsake')) return;
    shoreT += dt;
    if (shoreT > 5.5) {
      shoreLocket.position.y = game.world.groundHeightAt(shoreLocket.position.x, shoreLocket.position.z, 2) + 0.06;
      shoreLocket.visible = true;
      game.audio.glassTink({ pos: shoreLocket.position, gain: 0.5, rate: 0.6 });
    }
  });
  world.registerInteract(shoreLocket, 'shoreLocket', () => {
    if (!shoreLocket.visible || game.flags.has('locketKept')) return;
    shoreLocket.visible = false;
    // wrapped around the fingers of the hand that used to hold it
    const held = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb9a06a, metalness: 0.85, roughness: 0.3, emissive: 0x4a3c14, emissiveIntensity: 0.5 });
    const oval = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), brassMat);
    oval.scale.set(0.8, 1, 0.34);
    oval.position.set(0, -0.045, 0.02);
    held.add(oval);
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 5, 10, Math.PI * 1.6),
      new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
    wrap.rotation.y = 0.6;
    held.add(wrap);
    held.position.set(-0.128, -0.243, 0.03);
    game.skull.hold.add(held);
    held.traverse((o) => o.layers.set(LAYER_HELD));
    game.flag('locketKept');
    game.audio.glassTink({ pos: game.player.pos, gain: 0.5, rate: 0.95 });
  });
}

// --------------------------------------------------------------------- cave
export function buildCave(game) {
  return buildUnderfalls(game);
}

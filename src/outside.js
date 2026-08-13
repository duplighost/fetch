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
    let owner = object;
    while (owner && owner !== group) {
      if (owner.userData?.noBatch) return;
      owner = owner.parent;
    }
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
  const graveRenderStart = game.scene.children.length;
  buildGraveyard(game);
  game.graveyardRenderRoots = game.scene.children.slice(graveRenderStart);
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
  ground.name = 'graveyard terrain';
  ground.position.set(2, 0, 25);
  ground.receiveShadow = true;
  scene.add(ground);
  game.graveyardGround = ground;
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
  postMesh.name = 'graveyard perimeter fence posts';
  const mtx = new THREE.Matrix4();
  rails.forEach(([x, z], i) => {
    mtx.makeTranslation(x, 0.75, z);
    postMesh.setMatrixAt(i, mtx);
  });
  scene.add(postMesh);
  game.graveyardFencePosts = postMesh;

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
    if (x < 0) game.ritualMausoleum = { group: g, darkness, x, z };
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
  buildDestructibleGraves(game);
  buildResonantGraves(game);
  buildGraveyardGate(game);
  buildOssuaryRoute(game);
}

function buildDestructibleGraves(game) {
  const { world, scene, mats: M } = game;
  const sites = [
    [-16.2, 12.1, -0.13], [-2.5, 12.7, 0.08], [7.2, 13.4, -0.06],
    [18.3, 16.8, 0.12], [-10.8, 30.1, -0.1], [18.1, 37.2, 0.07],
  ];
  const stoneMat = M.headstone.clone();
  stoneMat.color.multiplyScalar(0.58);
  stoneMat.roughness = 0.96;
  const shaftMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.72, 1.34, 0.25), stoneMat, sites.length,
  );
  const baseMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.02, 0.22, 0.54), stoneMat, sites.length,
  );
  const capMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.38, 0), stoneMat, sites.length,
  );
  shaftMesh.name = 'destructible hero headstone shafts';
  baseMesh.name = 'destructible hero headstone bases';
  capMesh.name = 'destructible hero headstone crowns';
  for (const mesh of [shaftMesh, baseMesh, capMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // One fixed pool for every chip and topple. Breaking all six stones cannot
  // allocate another Mesh or grow the scene: exhausted cosmetics are dropped.
  const DEBRIS_CAP = 36;
  const debrisMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.12, 0), stoneMat, DEBRIS_CAP,
  );
  debrisMesh.name = 'bounded destructible-grave debris';
  debrisMesh.castShadow = true;
  debrisMesh.frustumCulled = false;
  scene.add(debrisMesh);
  const debris = Array.from({ length: DEBRIS_CAP }, () => ({
    active: false, owner: -1, p: new THREE.Vector3(), v: new THREE.Vector3(),
    spin: new THREE.Vector3(), age: 0, scale: 0, settled: false,
  }));
  const Mtx = new THREE.Matrix4();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const hiddenQ = new THREE.Quaternion();
  const hideDebris = (i) => {
    Mtx.compose(P.set(0, -100, 0), hiddenQ, S.set(0, 0, 0));
    debrisMesh.setMatrixAt(i, Mtx);
  };
  for (let i = 0; i < DEBRIS_CAP; i++) hideDebris(i);
  debrisMesh.instanceMatrix.needsUpdate = true;

  const states = sites.map(([x, z, lean], index) => {
    const yaw = (index * 1.73) % 0.7 - 0.35;
    const collider = world.addCollider(x - 0.5, -0.4, z - 0.36, x + 0.5, 1.72, z + 0.36,
      { destructibleGrave: index });
    const state = {
      index, x, z, yaw, lean, collider, hits: 0,
      rock: 0, chip: 0, chipTarget: 0, topple: 0, toppleTarget: 0,
      target: null, _visualDirty: true,
      reset() {
        this.hits = 0;
        this.rock = 0;
        this.chip = this.chipTarget = 0;
        this.topple = this.toppleTarget = 0;
        this._visualDirty = true;
        this.collider.max.y = 1.72;
        if (this.target) this.target.enabled = true;
        for (let i = 0; i < debris.length; i++) {
          if (debris[i].owner !== this.index) continue;
          debris[i].active = false;
          debris[i].owner = -1;
          debris[i].settled = false;
          hideDebris(i);
        }
        debrisMesh.instanceMatrix.needsUpdate = true;
      },
    };
    state.target = world.addFetchTarget({
      id: `breakableGrave:${index + 1}`,
      pos: new THREE.Vector3(x, 0.9, z),
      radius: 0.92,
      onHit(skull, at) {
        if (skull.mode !== 'outbound') return 'continue';
        if (state.hits >= 2) return 'return';
        state.hits++;
        state.rock = 1;
        state.chipTarget = 1;
        state._visualDirty = true;
        const fragments = state.hits === 2 ? 5 : 2;
        let made = 0;
        for (let i = 0; i < debris.length && made < fragments; i++) {
          const d = debris[i];
          if (d.active) continue;
          const angle = index * 1.71 + made * 2.17;
          d.active = true;
          d.owner = index;
          d.age = 0;
          d.settled = false;
          d.scale = 0.65 + ((index + made * 3) % 5) * 0.12;
          d.p.set(x + Math.cos(angle) * 0.14, 0.72 + made * 0.08, z + Math.sin(angle) * 0.14);
          d.v.set(Math.cos(angle) * (0.65 + made * 0.13), 1.45 + made * 0.22,
            Math.sin(angle) * (0.65 + made * 0.13));
          d.spin.set(2.1 + made, angle, 1.4 + index * 0.17);
          made++;
        }
        game.impact('hurt', at || state.target.pos);
        game.audio.stoneGrind({ pos: state.target.pos, gain: state.hits === 2 ? 0.78 : 0.48,
          rate: state.hits === 2 ? 0.68 : 0.92, verb: 0.75 });
        game.player.noise = 1;
        if (state.hits === 2) {
          state.toppleTarget = 1;
          state.collider.max.y = 0.25;
          state.target.enabled = false;
          game.enemies.resonancePulse?.(state.target.pos, 5.4, 1.15);
          game.flag(`graveToppled:${index + 1}`);
          game.audio.metalDrop({ pos: state.target.pos, gain: 0.55, rate: 0.62 });
        }
        return 'return';
      },
    });
    return state;
  });

  const writeStones = (dt, force = false) => {
    let dirty = false;
    for (const st of states) {
      const oldRock = st.rock;
      const oldChip = st.chip;
      const oldTopple = st.topple;
      st.rock = Math.max(0, st.rock - dt * 2.7);
      st.chip += (st.chipTarget - st.chip) * Math.min(1, dt * 8);
      st.topple += (st.toppleTarget - st.topple) * Math.min(1, dt * 3.2);
      if (Math.abs(st.chipTarget - st.chip) < 0.0001) st.chip = st.chipTarget;
      if (Math.abs(st.toppleTarget - st.topple) < 0.0001) st.topple = st.toppleTarget;
      const changed = force || st._visualDirty
        || Math.abs(st.rock - oldRock) > 1e-7
        || Math.abs(st.chip - oldChip) > 1e-7
        || Math.abs(st.topple - oldTopple) > 1e-7;
      st._visualDirty = false;
      if (!changed) continue;
      dirty = true;
      const wobble = Math.sin(st.rock * Math.PI * 5) * st.rock * 0.09;
      const ground = Math.sin(st.x * 0.23) * Math.sin(st.z * 0.31) * 0.22;
      const fall = smoothstep(0, 1, st.topple);

      Q.setFromEuler(E.set(fall * (1.32 + (st.index % 2) * 0.18), st.yaw,
        st.lean + wobble + fall * (st.index % 2 ? -0.28 : 0.28)));
      Mtx.compose(P.set(st.x + Math.sin(st.yaw) * fall * 0.32,
        ground + 0.78 - fall * 0.52, st.z + Math.cos(st.yaw) * fall * 0.32),
      Q, S.set(1 - st.chip * 0.06, 1 - st.chip * 0.08, 1));
      shaftMesh.setMatrixAt(st.index, Mtx);

      Q.setFromEuler(E.set(0, st.yaw, 0));
      Mtx.compose(P.set(st.x, ground + 0.11, st.z), Q, S.set(1, 1, 1));
      baseMesh.setMatrixAt(st.index, Mtx);

      Q.setFromEuler(E.set(st.chip * 0.5 + fall * 1.1, st.yaw + st.chip * 0.35,
        st.lean + fall * 0.45));
      Mtx.compose(P.set(st.x + st.chip * 0.24 + fall * 0.42,
        ground + 1.55 - st.chip * 0.32 - fall * 1.24,
        st.z + st.chip * (st.index % 2 ? -0.16 : 0.16)), Q,
      S.set(1.05, 0.68, 0.8));
      capMesh.setMatrixAt(st.index, Mtx);
    }
    if (dirty) {
      shaftMesh.instanceMatrix.needsUpdate = true;
      capMesh.instanceMatrix.needsUpdate = true;
      if (force) baseMesh.instanceMatrix.needsUpdate = true;
    }
  };
  writeStones(0, true);

  game.tickers.push((dt) => {
    writeStones(dt);
    let dirty = false;
    for (let i = 0; i < debris.length; i++) {
      const d = debris[i];
      if (!d.active || d.settled) continue;
      dirty = true;
      d.age += dt;
      if (d.p.y > 0.08 || d.v.y > 0) {
        d.v.y -= 8.8 * dt;
        d.p.addScaledVector(d.v, dt);
        if (d.p.y < 0.08) {
          d.p.y = 0.08;
          d.v.multiplyScalar(0.28);
          d.v.y = Math.abs(d.v.y) * 0.16;
        }
      }
      if (d.p.y <= 0.0801 && d.v.lengthSq() < 0.0064) {
        d.p.y = 0.08;
        d.v.set(0, 0, 0);
        d.settled = true;
      }
      Q.setFromEuler(E.set(d.spin.x * d.age, d.spin.y + d.age, d.spin.z * d.age));
      Mtx.compose(d.p, Q, S.setScalar(d.scale));
      debrisMesh.setMatrixAt(i, Mtx);
    }
    if (dirty) debrisMesh.instanceMatrix.needsUpdate = true;
  });
  game.destructibleGraves = states;
  game.graveDebrisPool = { mesh: debrisMesh, entries: debris, capacity: DEBRIS_CAP };
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
    const state = {
      group, shaft, crownLeft, crownRight, brokenCap,
      index: graves.length, cooldown: 0, flare: 0,
      credited: false, credit: 0, creditTarget: 0,
      setCredited(on = true) {
        this.credited = !!on;
        this.creditTarget = on ? 1 : 0;
      },
      reset() {
        this.cooldown = 0;
        this.flare = 0;
        this.credited = false;
        this.credit = 0;
        this.creditTarget = 0;
      },
    };
    state.target = world.addFetchTarget({
      id: `resonantGrave:${graves.length + 1}`,
      object: shaft,
      radius: 0.82,
      onHit(skull, at) {
        // One ritual statement belongs to one committed throw. A curved return
        // may pass another headstone on its way home, but it must not solve a
        // second grave backwards or emit a second resonance consequence.
        if (skull.mode !== 'outbound') return 'continue';
        if (state.cooldown > 0) return 'return';
        state.cooldown = 3.4;
        state.flare = 1;
        const pos = new THREE.Vector3(x, 0.05, z);
        const caught = game.enemies.resonancePulse
          ? game.enemies.resonancePulse(pos, 8.2, 1.65)
          : 0;
        game.director.onGraveResonance?.(state.index, pos);
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
      g.credit += (g.creditTarget - g.credit) * Math.min(1, dt * 4.2);
      const k = g.flare * g.flare;
      g.group.scale.y = 1 + Math.sin((1 - g.flare) * Math.PI) * k * 0.06;
      // A credited grave does not merely change color: the fork bows and the
      // stone's whole mass settles, a permanent silhouette the player can read
      // from the opposite side of the yard.
      g.shaft.position.y = 1.38 - g.credit * 0.16;
      g.crownLeft.position.y = 2.82 - g.credit * 0.28;
      g.crownRight.position.y = 2.77 - g.credit * 0.24;
      g.crownLeft.rotation.z = -0.23 - g.credit * 0.34;
      g.crownRight.rotation.z = 0.3 + g.credit * 0.38;
      g.brokenCap.position.y = 2.49 - g.credit * 0.18;
      for (let i = 1; i < g.group.children.length; i++) {
        const child = g.group.children[i];
        if (child.material === seamMat) child.material.opacity = 0.4 + k * 0.6 + g.credit * 0.2;
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
  const gate = { t: 0, opening: false, open: false, ritualStage: 0, ritualTarget: 0 };
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
  // Three bright, heavy latch weights turn the three distant graves into one
  // readable physical sentence. Each first toll drops a different weight; no
  // counter, prompt or hue is needed to understand what the gate is learning.
  const latchMat = M.metal.clone();
  latchMat.color.setHex(0x8c887d);
  latchMat.roughness = 0.58;
  const header = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.13, 0.18), M.metal);
  header.position.set(FOREST_GATE.x, 2.7, 41.96);
  header.castShadow = true;
  scene.add(header);
  gate.header = header;
  gate.weights = [];
  for (let i = 0; i < 3; i++) {
    const weight = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.24), latchMat);
    weight.position.set(FOREST_GATE.x + (i - 1) * 0.62, 2.37, 41.82);
    weight.rotation.z = (i - 1) * 0.045;
    weight.castShadow = true;
    weight.userData.homeY = weight.position.y;
    scene.add(weight);
    gate.weights.push(weight);
  }
  gate.collider = world.addCollider(FOREST_GATE.x - 1.68, -1, 41.82,
    FOREST_GATE.x + 1.68, 2.55, 42.18);
  gate.setRitualStage = (stage) => {
    gate.ritualStage = Math.max(gate.ritualStage, clamp(Math.floor(stage), 0, 3));
    gate.ritualTarget = gate.ritualStage;
  };
  gate.openGate = () => {
    if (gate.opening || gate.open) return false;
    gate.setRitualStage(3);
    gate.opening = true;
    game.audio.ironGateCreak({
      pos: new THREE.Vector3(FOREST_GATE.x, 1.15, 42), gain: 0.92, rate: 0.78,
    });
    return true;
  };
  gate.reset = () => {
    gate.t = 0;
    gate.opening = false;
    gate.open = false;
    gate.ritualStage = 0;
    gate.ritualTarget = 0;
    gate.left.rotation.y = 0;
    gate.right.rotation.y = 0;
    gate.collider.max.y = 2.55;
    for (const [i, weight] of gate.weights.entries()) {
      weight.position.y = weight.userData.homeY;
      weight.rotation.x = 0;
      weight.rotation.z = (i - 1) * 0.045;
    }
  };
  game.tickers.push((dt) => {
    for (let i = 0; i < gate.weights.length; i++) {
      const weight = gate.weights[i];
      const down = i < gate.ritualTarget;
      const targetY = weight.userData.homeY - (down ? 1.48 : 0);
      weight.position.y += (targetY - weight.position.y) * Math.min(1, dt * 5.4);
      const fall = clamp((weight.userData.homeY - weight.position.y) / 1.48, 0, 1);
      weight.rotation.x = fall * (0.28 + i * 0.09);
      weight.rotation.z = (i - 1) * 0.045 + fall * (i === 1 ? -0.12 : (i - 1) * 0.16);
    }
    if (!gate.opening || gate.open) return;
    gate.t = Math.min(1, gate.t + dt * 0.48);
    const e = 1 - (1 - gate.t) ** 3;
    gate.left.rotation.y = -e * 1.42;
    gate.right.rotation.y = e * 1.42;
    if (gate.t > 0.32) gate.collider.max.y = gate.collider.min.y;
    if (gate.t >= 1) gate.open = true;
  });
  game.graveyardGate = gate;
  game.graveyardLookbackRoots = [
    game.graveyardGround,
    game.graveyardFencePosts,
    gate.left,
    gate.right,
    gate.header,
    ...gate.weights,
  ].filter(Boolean);
}

// --------------------------------------------------------- the under-yard
// The funeral does not magically open the surface gate. It opens the left
// mausoleum, whose short authored ossuary turns the three distant resonances
// into a physical under-yard route. Three alternating baffles keep the path
// legible (Marrow's active crypt law), while one held skull counterweight opens
// both the forest-side hatch and the gate above. One verb, one causal chain.
function buildOssuaryRoute(game) {
  const { world, scene, mats: M } = game;
  const mausoleum = game.ritualMausoleum;
  if (!mausoleum) return;

  const OX = -70;
  const OZ = -10;
  const FLOOR = -4.2;
  const HALF_W = 3;
  const LENGTH = 30;
  const HEIGHT = 2.85;
  const routeRoot = new THREE.Group();
  routeRoot.name = 'required graveyard ossuary';
  routeRoot.visible = false;
  scene.add(routeRoot);
  const wallMat = M.stone.clone();
  wallMat.color.multiplyScalar(0.47);
  wallMat.roughness = 0.96;
  const floorMat = M.dirt.clone();
  floorMat.color.multiplyScalar(0.38);
  const ironMat = M.metal.clone();
  ironMat.color.setHex(0x3b3c3a);
  ironMat.roughness = 0.72;
  const boneMat = M.bone.clone();
  boneMat.color.multiplyScalar(0.42);
  if ('emissive' in boneMat) {
    boneMat.emissive = new THREE.Color(0x171817);
    boneMat.emissiveIntensity = 0.28;
  }
  const wetMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c0b, roughness: 0.2, metalness: 0.08,
    transparent: true, opacity: 0.76, depthWrite: false,
  });
  const addMeshBox = (mat, x, y, z, w, h, d, name = '') => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.name = name;
    mesh.receiveShadow = true;
    routeRoot.add(mesh);
    return mesh;
  };
  const addWall = (x, z, w, d, name = 'ossuary wall') => {
    addMeshBox(wallMat, x, FLOOR + HEIGHT / 2, z, w, HEIGHT, d, name);
    return world.addCollider(x - w / 2, FLOOR - 0.5, z - d / 2,
      x + w / 2, FLOOR + HEIGHT, z + d / 2, { ossuary: true });
  };
  const addFloor = (x, z, w, d) => {
    addMeshBox(floorMat, x, FLOOR - 0.08, z, w, 0.16, d, 'ossuary dirt floor');
    addMeshBox(wallMat, x, FLOOR + HEIGHT + 0.12, z, w, 0.24, d, 'ossuary roof');
  };

  // Main ambulatory and two deliberately shallow pockets. They are spaces to
  // look into, not side-quest clutter or alternate solutions.
  addFloor(OX, OZ + LENGTH / 2, HALF_W * 2, LENGTH);
  addFloor(OX - 4.45, OZ + 12, 2.9, 2.6);
  addFloor(OX + 4.45, OZ + 19, 2.9, 2.6);
  world.rooms.push(
    { id: 'ossuaryMain', level: 'ossuary', floorY: FLOOR,
      x0: OX - HALF_W, z0: OZ, x1: OX + HALF_W, z1: OZ + LENGTH },
    { id: 'ossuaryPocketWest', level: 'ossuary', floorY: FLOOR,
      x0: OX - 5.9, z0: OZ + 10.7, x1: OX - HALF_W, z1: OZ + 13.3 },
    { id: 'ossuaryPocketEast', level: 'ossuary', floorY: FLOOR,
      x0: OX + HALF_W, z0: OZ + 17.7, x1: OX + 5.9, z1: OZ + 20.3 },
  );
  world.addZone('graveyard', OX - 6.2, OZ - 1, OX + 6.2, OZ + LENGTH + 1,
    FLOOR - 2, FLOOR + HEIGHT + 1);
  // Dirt, because the floor IS dirt (floorMat = M.dirt): footsteps that said
  // stone on a soil floor were a small lie underfoot for the whole corridor.
  world.addSurface('dirt', OX - 6.2, OZ - 1, OX + 6.2, OZ + LENGTH + 1,
    FLOOR - 2, FLOOR + HEIGHT + 1);

  // Side shells leave one human-width opening into each pocket.
  addWall(OX - HALF_W - 0.15, OZ + 5.35, 0.3, 10.7);
  addWall(OX - HALF_W - 0.15, OZ + 21.65, 0.3, 16.7);
  addWall(OX + HALF_W + 0.15, OZ + 9.35, 0.3, 18.7);
  addWall(OX + HALF_W + 0.15, OZ + 25.15, 0.3, 9.7);
  // Pocket shells. The west back wall leaves a shuttered gap — the kennel's
  // false back lives behind it (DESIGN.md: "a mausoleum with a false back").
  addWall(OX - 5.9, OZ + 10.95, 0.3, 0.8);
  addWall(OX - 5.9, OZ + 13.05, 0.3, 0.8);
  addWall(OX - 4.45, OZ + 10.55, 2.9, 0.3);
  addWall(OX - 4.45, OZ + 13.45, 2.9, 0.3);
  addWall(OX + 5.9, OZ + 19, 0.3, 2.9);
  addWall(OX + 4.45, OZ + 17.55, 2.9, 0.3);
  addWall(OX + 4.45, OZ + 20.45, 2.9, 0.3);

  // Three alternating ribs: a short maze-shaped sentence, never a procedural
  // wall lottery. The 1.75m mouths clear player, skull, and return leg.
  const baffleZ = [OZ + 7.5, OZ + 14.5, OZ + 22];
  const baffleColliders = [];
  baffleZ.forEach((z, i) => {
    const blocksLeft = i % 2 === 0;
    const w = HALF_W * 2 - 1.75;
    const x = OX + (blocksLeft ? -1 : 1) * (HALF_W - w / 2);
    baffleColliders.push(addWall(x, z, w, 0.36, `ossuary baffle ${i + 1}`));
    // A toothed cap makes each baffle a rib silhouette instead of another box.
    for (let k = 0; k < 5; k++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38 + k * 0.025, 5), boneMat);
      tooth.position.set(x - w / 2 + 0.45 + k * (w - 0.9) / 4,
        FLOOR + HEIGHT - 0.27, z + (blocksLeft ? 0.05 : -0.05));
      tooth.rotation.z = Math.PI;
      routeRoot.add(tooth);
    }
  });

  // Dirty center track, pooled water, and one instanced rib population give
  // the route an authored material history without one draw per bone.
  for (let i = 0; i < 7; i++) {
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.35 + (i % 3) * 0.12, 12), wetMat);
    stain.rotation.x = -Math.PI / 2;
    stain.scale.set(0.65 + (i % 2) * 0.4, 1.5 + (i % 3) * 0.3, 1);
    stain.position.set(OX + Math.sin(i * 2.4) * 1.35, FLOOR + 0.012, OZ + 3 + i * 3.5);
    routeRoot.add(stain);
  }
  // A light rhythm for the 30 m tube: one dim descriptor behind each baffle,
  // so the corridor reads as three rooms instead of one unlit pipe. Candle
  // DESCRIPTORS only — the pooled lights carry them; the census never moves.
  baffleZ.forEach((z, i) => {
    world.candles.push({
      x: OX + (i % 2 === 0 ? 1.35 : -1.35), y: FLOOR + 1.7, z: z + 1.1,
      intensity: 0.5, r: 4.4,
    });
  });

  // Authored remains between the baffles — the ossuary earns its name. Wall
  // recesses of stacked long-bones with a skull seated on each stack, all in
  // two instanced draws inside routeRoot.
  {
    const boneGeo = new THREE.CapsuleGeometry(0.045, 0.5, 3, 6);
    const skullGeo = new THREE.DodecahedronGeometry(0.13, 0);
    const bonePos = [];
    const skullPos = [];
    const niches = [
      [OX - HALF_W + 0.32, OZ + 4.1, 1], [OX + HALF_W - 0.32, OZ + 10.6, -1],
      [OX - HALF_W + 0.32, OZ + 17.9, 1], [OX + HALF_W - 0.32, OZ + 24.9, -1],
      [OX - HALF_W + 0.32, OZ + 26.6, 1],
    ];
    for (const [nx, nz, face] of niches) {
      const rows = 4 + (Math.abs(Math.round(nz)) % 3);
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < 3; k++) {
          bonePos.push({
            x: nx + face * 0.02 * r, y: FLOOR + 0.09 + r * 0.1,
            z: nz - 0.36 + k * 0.36 + (r % 2) * 0.09,
            roll: (r % 3 - 1) * 0.08,
          });
        }
      }
      skullPos.push({ x: nx + face * 0.05, y: FLOOR + 0.09 + rows * 0.1 + 0.1, z: nz, yaw: face * (0.5 + (Math.round(nz) % 3) * 0.4) });
    }
    const boneMesh = new THREE.InstancedMesh(boneGeo, boneMat, bonePos.length);
    const m4 = new THREE.Matrix4();
    const qq = new THREE.Quaternion();
    const ee = new THREE.Euler();
    const ss = new THREE.Vector3(1, 1, 1);
    bonePos.forEach((p, i) => {
      qq.setFromEuler(ee.set(0, 0, Math.PI / 2 + p.roll));
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), qq, ss);
      boneMesh.setMatrixAt(i, m4);
    });
    boneMesh.instanceMatrix.needsUpdate = true;
    boneMesh.name = 'ossuary stacked long-bones';
    routeRoot.add(boneMesh);
    const skullMesh = new THREE.InstancedMesh(skullGeo, boneMat, skullPos.length);
    skullPos.forEach((p, i) => {
      qq.setFromEuler(ee.set(0, p.yaw, 0));
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), qq, ss);
      skullMesh.setMatrixAt(i, m4);
    });
    skullMesh.instanceMatrix.needsUpdate = true;
    skullMesh.name = 'ossuary seated skulls';
    routeRoot.add(skullMesh);
  }

  const ribGeo = new THREE.TorusGeometry(0.44, 0.035, 4, 10, Math.PI);
  const ribs = new THREE.InstancedMesh(ribGeo, boneMat, 30);
  ribs.name = 'ossuary instanced ribs';
  const ribMtx = new THREE.Matrix4();
  const ribPos = new THREE.Vector3();
  const ribQuat = new THREE.Quaternion();
  const ribScale = new THREE.Vector3();
  const ribEuler = new THREE.Euler();
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? -1 : 1;
    ribPos.set(OX + side * (2.55 + (i % 3) * 0.08), FLOOR + 0.18 + (i % 4) * 0.08,
      OZ + 1.2 + (i / 30) * 27.4);
    ribQuat.setFromEuler(ribEuler.set(Math.PI / 2, side * Math.PI / 2, side * 0.18));
    ribScale.set(0.65 + (i % 4) * 0.08, 0.75 + (i % 3) * 0.09, 1);
    ribMtx.compose(ribPos, ribQuat, ribScale);
    ribs.setMatrixAt(i, ribMtx);
  }
  ribs.instanceMatrix.needsUpdate = true;
  routeRoot.add(ribs);

  // The surface mausoleum physically opens: its false black doorway clears,
  // a floor slab sinks, and a bright stair throat replaces it.
  const surfacePit = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.48),
    new THREE.MeshBasicMaterial({ color: 0x010202, side: THREE.DoubleSide }));
  surfacePit.rotation.x = -Math.PI / 2;
  surfacePit.position.set(mausoleum.x, 0.035, mausoleum.z + 0.15);
  surfacePit.visible = false;
  scene.add(surfacePit);
  const surfaceSlab = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.16, 1.5), wallMat);
  surfaceSlab.position.set(mausoleum.x, 0.11, mausoleum.z + 0.15);
  surfaceSlab.castShadow = true;
  scene.add(surfaceSlab);
  const stairThroat = new THREE.Group();
  stairThroat.visible = false;
  scene.add(stairThroat);
  for (let i = 0; i < 5; i++) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.17, 0.31), wallMat);
    tread.position.set(mausoleum.x, -0.02 - i * 0.15, mausoleum.z - 0.38 + i * 0.27);
    stairThroat.add(tread);
  }
  const entryLamp = { x: mausoleum.x, y: 0.74, z: mausoleum.z + 0.45, intensity: 0, r: 5.5 };
  world.candles.push(entryLamp);

  // Final physical pawl and rising forest-side hatch.
  const mechanism = new THREE.Group();
  mechanism.name = 'ossuary gate counterweight';
  mechanism.userData.noBatch = true;
  mechanism.position.set(OX, FLOOR, OZ + 26.2);
  routeRoot.add(mechanism);
  // MOUNTED, not hovering. Alex photographed this thing and wrote "attactch to
  // wall with another piece" — and he was right twice over: the wheel hung at
  // y 1.35 in the middle of a six-metre corridor with nothing touching it, and
  // the chain ran from y 1.8 to y 3.5 through a ceiling that is at 2.85. It
  // now has an axle into the east wall, a bearing plate where it lands, a
  // plinth carrying it off the floor, and a corbel the counterweight hangs
  // from. The machine is the same machine; it is just bolted to the room.
  const WALL_X = HALF_W - 0.1;
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, 1.35, 0.1);
  mechanism.add(wheelGroup);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.075, 8, 24), ironMat);
  wheel.rotation.y = Math.PI / 2;
  wheelGroup.add(wheel);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.98, 5), ironMat);
    // Parented to the wheel now. The spokes used to be siblings with a fixed
    // rotation while only the torus turned, so the one moving part in the room
    // read as a smooth ring sliding inside a static star.
    spoke.rotation.x = i / 6 * Math.PI;
    wheelGroup.add(spoke);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, WALL_X - 0.05, 8), ironMat);
  axle.rotation.z = Math.PI / 2;
  axle.position.set((WALL_X - 0.05) / 2, 1.35, 0.1);
  mechanism.add(axle);
  const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.62), ironMat);
  bearing.position.set(WALL_X - 0.02, 1.35, 0.1);
  mechanism.add(bearing);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.46), ironMat);
  plinth.position.set(0, 0.35, 0.1);
  mechanism.add(plinth);
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.62, 6), ironMat);
  yoke.position.set(0, 1.0, 0.1);
  mechanism.add(yoke);
  // the corbel the counterweight hangs off, running back to the same wall
  const CORBEL_Y = 2.62;
  const corbel = new THREE.Mesh(new THREE.BoxGeometry(WALL_X - 1.0, 0.15, 0.24), ironMat);
  corbel.position.set(1.15 + (WALL_X - 1.15) / 2, CORBEL_Y, 0);
  mechanism.add(corbel);
  const weight = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.5), ironMat);
  weight.position.set(1.15, 1.66, 0);
  mechanism.add(weight);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), ironMat);
  chain.position.set(1.15, CORBEL_Y - 0.275, 0);
  mechanism.add(chain);
  const exitSlab = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 - 0.35, 2.65, 0.34), wallMat);
  exitSlab.userData.noBatch = true;
  exitSlab.position.set(OX, FLOOR + 1.33, OZ + 28.15);
  routeRoot.add(exitSlab);
  const exitCollider = world.addCollider(OX - HALF_W, FLOOR - 0.5, OZ + 27.94,
    OX + HALF_W, FLOOR + HEIGHT, OZ + 28.34, { ossuaryExit: true });
  // ------------------------------------------------------------- THE CLIMB
  // Past the slab the corridor becomes a vertical shaft: two masonry flights
  // turn 90 degrees so the top is out of sight of the bottom, and the same
  // counterweight number that sinks the slab unbolts a deck hatch over the
  // stair head. The player walks up under their own power — ramp records for
  // ground height, tread colliders for feet, no new movement system. The old
  // three decorative rungs (three bars at one height, no collider) are gone.
  const DECK_Y = FLOOR + 5.25;              // hatch deck over the stair head
  const WALL_TOP = DECK_Y + 1.65;           // walls reach the void ceiling: sealed
  // floor + tall walls for the chamber past the corridor's roofline
  addMeshBox(floorMat, OX, FLOOR - 0.08, OZ + 32.7, HALF_W * 2, 0.16, 5.4, 'shaft dirt floor');
  for (const side of [-1, 1]) {
    addMeshBox(wallMat, OX + side * (HALF_W + 0.15), (FLOOR + WALL_TOP) / 2, OZ + 32.7,
      0.3, WALL_TOP - FLOOR, 5.4, 'shaft side wall');
    world.addCollider(OX + side * (HALF_W + 0.3), FLOOR - 0.5, OZ + 30,
      OX + side * HALF_W, WALL_TOP, OZ + 35.4, { ossuary: true });
  }
  addMeshBox(wallMat, OX, (FLOOR + WALL_TOP) / 2, OZ + 35.55, HALF_W * 2 + 0.6,
    WALL_TOP - FLOOR, 0.3, 'shaft cap wall');
  world.addCollider(OX - HALF_W - 0.3, FLOOR - 0.5, OZ + 35.4,
    OX + HALF_W + 0.3, WALL_TOP, OZ + 35.7, { ossuary: true });
  // header face where the corridor's low roof meets the tall shaft
  addMeshBox(wallMat, OX, (FLOOR + HEIGHT + 0.24 + WALL_TOP) / 2, OZ + 29.95,
    HALF_W * 2, WALL_TOP - (FLOOR + HEIGHT + 0.24), 0.3, 'shaft header');
  // absolute black above the shaft; the lid opens into this, never into sky,
  // so the sealed-district invariant (zero exterior roots visible) holds
  const shaftVoid = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 0.6, 6.0),
    new THREE.MeshBasicMaterial({ color: 0x010204, side: THREE.DoubleSide }));
  shaftVoid.rotation.x = Math.PI / 2;
  shaftVoid.position.set(OX, WALL_TOP - 0.05, OZ + 32.85);
  routeRoot.add(shaftVoid);

  // flight A: floor to landing along +z on the east side, 11 treads
  const A = { x0: OX + 0.7, x1: OX + 2.85, z0: OZ + 29.55, z1: OZ + 33.25, rise: 2.1, steps: 11 };
  const aStep = (A.z1 - A.z0) / A.steps;
  for (let i = 0; i < A.steps; i++) {
    const top = FLOOR + ((i + 1) / A.steps) * A.rise;
    const z0 = A.z0 + i * aStep;
    addMeshBox(wallMat, (A.x0 + A.x1) / 2, top - 0.06, z0 + (aStep + 0.01) / 2,
      A.x1 - A.x0, 0.12, aStep + 0.01, 'shaft tread');
    world.addCollider(A.x0, top - 0.12, z0, A.x1, top, z0 + aStep + 0.01,
      { stairId: 'ossuaryFlightA', stairPart: 'tread', stairStep: i });
  }
  world.ramps.push({ id: 'ossuaryFlightA', axis: 'z', x0: A.x0, x1: A.x1,
    z0: A.z0, z1: A.z1, y0: FLOOR, y1: FLOOR + A.rise });
  // masonry fill so the flight is carried, not floating
  addMeshBox(wallMat, (A.x0 + A.x1) / 2, FLOOR + 0.33, OZ + 30.35, A.x1 - A.x0, 0.66, 1.4);
  addMeshBox(wallMat, (A.x0 + A.x1) / 2, FLOOR + 0.75, OZ + 31.7, A.x1 - A.x0, 1.5, 1.3);
  addMeshBox(wallMat, (A.x0 + A.x1) / 2, FLOOR + 1.35, OZ + 32.85, A.x1 - A.x0, 2.7, 0.8);

  // landing: a solid corner pillar at the turn
  addMeshBox(wallMat, (A.x0 + A.x1) / 2, FLOOR + 1.05, OZ + 34.325,
    A.x1 - A.x0, 2.1, 2.15, 'shaft landing');
  world.addCollider(A.x0, FLOOR - 0.5, OZ + 33.25, A.x1, FLOOR + 2.1, OZ + 35.4,
    { ossuary: true });

  // flight B: landing to the hatch platform along -x under the cap wall
  const BF = { x0: OX - 2.0, x1: OX + 0.7, z0: OZ + 33.9, z1: OZ + 35.4, steps: 6 };
  const bStep = (BF.x1 - BF.x0) / BF.steps;
  for (let i = 0; i < BF.steps; i++) {
    const top = FLOOR + 2.1 + ((i + 1) / BF.steps) * 1.15;
    const x1 = BF.x1 - i * bStep;
    addMeshBox(wallMat, x1 - (bStep + 0.01) / 2, top - 0.06, (BF.z0 + BF.z1) / 2,
      bStep + 0.01, 0.12, BF.z1 - BF.z0, 'shaft tread');
    world.addCollider(x1 - bStep - 0.01, top - 0.12, BF.z0, x1, top, BF.z1,
      { stairId: 'ossuaryFlightB', stairPart: 'tread', stairStep: i });
  }
  world.ramps.push({ id: 'ossuaryFlightB', axis: 'x', x0: BF.x0, x1: BF.x1,
    z0: BF.z0, z1: BF.z1, y0: FLOOR + 3.25, y1: FLOOR + 2.1 });

  // hatch platform: solid pillar in the far corner, under the deck mouth
  addMeshBox(wallMat, OX - 2.5, FLOOR + 1.625, OZ + 34.65, 1.0, 3.25, 1.5, 'shaft platform');
  world.addCollider(OX - 3.0, FLOOR - 0.5, OZ + 33.9, OX - 2.0, FLOOR + 3.25, OZ + 35.4,
    { ossuary: true });
  world.rooms.push(
    { id: 'ossuaryShaft', level: 'ossuary', floorY: FLOOR,
      x0: OX - HALF_W, z0: OZ + 28.6, x1: OX + HALF_W, z1: OZ + 35.4 },
    { id: 'ossuaryShaftLanding', level: 'ossuary', floorY: FLOOR + 2.1,
      x0: A.x0, z0: OZ + 33.25, x1: A.x1, z1: OZ + 35.4 },
    { id: 'ossuaryShaftTop', level: 'ossuary', floorY: FLOOR + 3.25,
      x0: OX - 3.0, z0: OZ + 33.9, x1: OX - 2.0, z1: OZ + 35.4 },
  );

  // parapets: the visual rail is stepped; the collider is one solid band per
  // open edge, tall enough that no tread's feet+0.5 clears it
  addMeshBox(wallMat, A.x0 - 0.055, FLOOR + 1.0, OZ + 30.15, 0.11, 0.85, 1.25);
  addMeshBox(wallMat, A.x0 - 0.055, FLOOR + 1.7, OZ + 31.4, 0.11, 0.85, 1.25);
  addMeshBox(wallMat, A.x0 - 0.055, FLOOR + 2.4, OZ + 32.65, 0.11, 0.85, 1.25);
  world.addCollider(A.x0 - 0.11, FLOOR - 0.5, A.z0, A.x0, FLOOR + 2.85, OZ + 33.9,
    { stairId: 'ossuaryFlightA', stairPart: 'edge' });
  addMeshBox(wallMat, OX - 0.65, FLOOR + 2.75, OZ + 33.845, 2.7, 0.8, 0.11);
  world.addCollider(BF.x0, FLOOR + 1.9, OZ + 33.79, OX + 0.45, FLOOR + 4.0, OZ + 33.9,
    { stairId: 'ossuaryFlightB', stairPart: 'edge' });
  addMeshBox(wallMat, OX - 2.5, FLOOR + 3.65, OZ + 33.845, 1.0, 0.8, 0.11);
  world.addCollider(OX - 3.0, FLOOR + 2.9, OZ + 33.79, OX - 2.0, FLOOR + 4.3, OZ + 33.9,
    { stairId: 'ossuaryShaftTop', stairPart: 'edge' });

  // the deck the hatch lives in, with one mouth over the platform. Plates
  // tuck INTO the walls — a plate ending flush at a wall face leaked a bright
  // seam of the mouth's light along the joint.
  addMeshBox(wallMat, OX + 0.625, DECK_Y, OZ + 34.7, 5.35, 0.2, 2.0, 'hatch deck');
  addMeshBox(wallMat, OX - 2.45, DECK_Y, OZ + 33.93, 0.9, 0.2, 0.46, 'hatch deck south');
  addMeshBox(wallMat, OX - 3.075, DECK_Y, OZ + 34.7, 0.45, 0.2, 2.0, 'hatch deck west');

  // the lid: a bolted iron panel, chain X, hasp and fat padlock underneath —
  // the game's existing sealed-then-open language (the basement bilco kit).
  // Everything is DRIVEN parametrically off state.exitT so a forced restore
  // (director teleport, respawn) seats the whole pose in one assignment.
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xa98748, roughness: 0.34, metalness: 0.78 });
  const sootMat = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.7, metalness: 0.5 });
  const lidPivot = new THREE.Group();
  lidPivot.name = 'ossuary hatch lid';
  lidPivot.userData.noBatch = true;
  lidPivot.position.set(OX - 2.45, DECK_Y + 0.07, OZ + 35.3);
  routeRoot.add(lidPivot);
  const lidPanel = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.1, 1.14), ironMat);
  lidPanel.position.z = -0.57;
  lidPivot.add(lidPanel);
  const hatchChains = new THREE.Group();
  hatchChains.name = 'ossuary hatch chains';
  hatchChains.userData.noBatch = true;
  routeRoot.add(hatchChains);
  {
    const linkGeo = new THREE.TorusGeometry(0.045, 0.015, 6, 10);
    const mouthY = DECK_Y - 0.14;
    const corners = [
      [[OX - 2.83, OZ + 34.22], [OX - 2.07, OZ + 35.28]],
      [[OX - 2.07, OZ + 34.22], [OX - 2.83, OZ + 35.28]],
    ];
    for (const [a, b] of corners) {
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const link = new THREE.Mesh(linkGeo, sootMat);
        link.position.set(a[0] + (b[0] - a[0]) * t, mouthY, a[1] + (b[1] - a[1]) * t);
        link.lookAt(b[0], mouthY, b[1]);
        link.rotateY(Math.PI / 2);
        if (i % 2) link.rotateX(Math.PI / 2);
        hatchChains.add(link);
      }
    }
    const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), sootMat);
    hasp.position.set(OX - 2.45, mouthY - 0.02, OZ + 34.75);
    hatchChains.add(hasp);
    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.1), brassMat);
    lockBody.position.set(OX - 2.45, mouthY - 0.24, OZ + 34.75);
    hatchChains.add(lockBody);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.024, 8, 10, Math.PI), sootMat);
    shackle.position.set(OX - 2.45, mouthY - 0.1, OZ + 34.75);
    hatchChains.add(shackle);
  }
  // The shaft's one light sits INSIDE the mouth: the brightest thing in the
  // district is a hole in the ceiling, seen from the corridor once the slab
  // is gone. Pre-solve it leaks a faint seam around the slab's 17cm gaps.
  const shaftGlow = { x: OX - 2.45, y: DECK_Y - 0.6, z: OZ + 34.75, intensity: 1.0, r: 7 };
  world.candles.push(shaftGlow);

  // ------------------------------------------------- THE WEST POCKET KENNEL
  // The false back DESIGN.md promises. Bars the player cannot pass but the
  // skull can, a cradle that takes a held weight, a shutter the hold raises —
  // the crawl kennel's grammar restated underground. Behind it: a wrongness,
  // never a mechanic. The reward is the seated one in the wall.
  const kennel = (() => {
    const cageIron = new THREE.MeshStandardMaterial({ color: 0x242829, roughness: 0.72, metalness: 0.52 });
    const wornIron = new THREE.MeshStandardMaterial({
      color: 0x747774, roughness: 0.48, metalness: 0.72,
      emissive: 0x151817, emissiveIntensity: 0.65,
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xe2e7e2, transparent: true, opacity: 0.035 });
    const barX = OX - 3.85;
    // bars: one instanced draw, skull passes between them, the player never
    const barPoints = [];
    for (let z = OZ + 10.92; z <= OZ + 13.1; z += 0.31) barPoints.push(z);
    const bars = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.027, 0.034, HEIGHT - 0.25, 7), cageIron, barPoints.length);
    const barM4 = new THREE.Matrix4();
    barPoints.forEach((z, i) => {
      barM4.makeTranslation(barX, FLOOR + (HEIGHT - 0.25) / 2, z);
      bars.setMatrixAt(i, barM4);
    });
    bars.instanceMatrix.needsUpdate = true;
    bars.name = 'ossuary kennel bars';
    bars.userData.noBatch = true;
    routeRoot.add(bars);
    for (const railY of [FLOOR + 0.14, FLOOR + 1.3, FLOOR + 2.5]) {
      addMeshBox(cageIron, barX, railY, OZ + 12, 0.09, 0.09, 2.5, 'kennel rail');
    }
    world.addCollider(barX - 0.07, FLOOR - 0.05, OZ + 10.7, barX + 0.07, FLOOR + HEIGHT,
      OZ + 13.3, { id: 'ossuaryKennelBars', skullPass: true });

    // the alcove behind the wall gap; its back is a REAL collider so a wild
    // throw bounces off stone, never off invisible air
    addMeshBox(wallMat, OX - 6.55, FLOOR + 0.85, OZ + 12, 0.3, 1.9, 1.9, 'alcove back');
    addMeshBox(wallMat, OX - 6.15, FLOOR + 1.86, OZ + 12, 1.1, 0.16, 1.9, 'alcove roof');
    addMeshBox(wallMat, OX - 6.15, FLOOR + 0.85, OZ + 11.02, 1.1, 1.9, 0.16, 'alcove side');
    addMeshBox(wallMat, OX - 6.15, FLOOR + 0.85, OZ + 12.98, 1.1, 1.9, 0.16, 'alcove side');
    addMeshBox(floorMat, OX - 6.15, FLOOR - 0.06, OZ + 12, 1.1, 0.12, 1.9, 'alcove floor');
    world.addCollider(OX - 6.7, FLOOR - 0.5, OZ + 11.0, OX - 6.4, FLOOR + 1.9, OZ + 13.0,
      { ossuary: true });

    // the seated one — the witness geometry, moved into the wall. It faces
    // the bars. It was here before the shutter was.
    const seated = new THREE.Group();
    seated.name = 'ossuary seated witness';
    const seatedBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.62, 3, 7),
      new THREE.MeshStandardMaterial({ color: 0x090a0a, roughness: 1 }));
    seatedBody.position.y = 0.62;
    seatedBody.scale.set(0.68, 1, 0.48);
    seated.add(seatedBody);
    const seatedHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 9, 7), boneMat);
    seatedHead.position.y = 1.18;
    seatedHead.scale.set(0.68, 1.15, 0.78);
    seatedHead.rotation.z = 0.34;
    seated.add(seatedHead);
    const reach = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.72, 6), boneMat);
    reach.position.set(0.42, 0.36, 0.1);
    reach.rotation.z = -1.12;
    seated.add(reach);
    for (let i = 0; i < 3; i++) {
      const pileBone = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.4, 3, 6), boneMat);
      pileBone.position.set(0.1 + i * 0.14, 0.06, -0.22 + i * 0.16);
      pileBone.rotation.set(Math.PI / 2, 0, i * 0.8);
      seated.add(pileBone);
    }
    seated.position.set(OX - 6.05, FLOOR, OZ + 12);
    seated.rotation.y = Math.PI / 2 - 0.18;
    routeRoot.add(seated);

    // shutter over the gap, and the cradle that raises it
    const shutterBaseY = FLOOR + 0.92;
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 1.34), cageIron);
    shutter.name = 'ossuary kennel shutter';
    shutter.userData.noBatch = true;
    shutter.position.set(OX - 5.83, shutterBaseY, OZ + 12);
    routeRoot.add(shutter);
    addMeshBox(cageIron, OX - 5.82, FLOOR + 1.1, OZ + 11.28, 0.14, 2.2, 0.1, 'shutter jamb');
    addMeshBox(cageIron, OX - 5.82, FLOOR + 1.1, OZ + 12.72, 0.14, 2.2, 0.1, 'shutter jamb');
    addMeshBox(cageIron, OX - 5.82, FLOOR + 2.24, OZ + 12, 0.14, 0.1, 1.6, 'shutter lintel');
    // the wall gap is full-height but the shutter is not: stone above the
    // lintel, or the corridor sees straight out of the sealed district
    addMeshBox(wallMat, OX - 5.9, FLOOR + 2.57, OZ + 12, 0.3, 0.66, 1.4, 'shutter transom');
    const sliverMat = new THREE.MeshBasicMaterial({
      color: 0xd9e2de, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false,
    });
    const sliver = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 1.22), sliverMat);
    sliver.name = 'ossuary kennel seam';
    sliver.userData.noBatch = true;
    sliver.position.set(OX - 5.76, FLOOR + 0.035, OZ + 12);
    routeRoot.add(sliver);

    // one cold fixture supplies both the pre-solve seam and the revealed
    // alcove. Real PointLight created at BUILD time (before pinLightCensus),
    // only ever intensity-ramped — the census never moves.
    const lampCore = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 7), coreMat.clone());
    lampCore.name = 'ossuary kennel lamp';
    lampCore.userData.noBatch = true;
    lampCore.position.set(OX - 6.3, FLOOR + 1.52, OZ + 12.42);
    routeRoot.add(lampCore);
    const lamp = new THREE.PointLight(0xd9e2de, 0, 5.5, 1.8);
    lamp.position.copy(lampCore.position);
    scene.add(lamp);
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.2, 7), wornIron);
    bracket.position.set(OX - 6.42, FLOOR + 1.52, OZ + 12.42);
    bracket.rotation.z = Math.PI / 2;
    routeRoot.add(bracket);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 9, 1, true), wornIron);
    hood.position.set(OX - 6.33, FLOOR + 1.6, OZ + 12.42);
    hood.rotation.z = -Math.PI / 2;
    routeRoot.add(hood);

    const cradleBase = new THREE.Vector3(OX - 4.75, FLOOR + 1.02, OZ + 12);
    const cradle = new THREE.Group();
    cradle.name = 'ossuary kennel cradle';
    cradle.userData.noBatch = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 7, 22), wornIron);
    ring.rotation.x = Math.PI / 2;
    cradle.add(ring);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.32, 0.07, 12), M.metal);
    dish.position.y = -0.09;
    cradle.add(dish);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.48, 6), wornIron);
      arm.position.set(Math.cos(a) * 0.27, 0.2, Math.sin(a) * 0.27);
      arm.rotation.z = Math.cos(a) * 0.22;
      arm.rotation.x = Math.sin(a) * 0.22;
      cradle.add(arm);
    }
    const targetGlow = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.012, 5, 20), coreMat);
    targetGlow.rotation.x = Math.PI / 2;
    targetGlow.position.y = 0.015;
    cradle.add(targetGlow);
    cradle.position.copy(cradleBase);
    routeRoot.add(cradle);

    const puzzle = {
      id: 'ossuaryKennel', state: 'idle', solved: false,
      holdTime: 0, progress: 0, requiredHold: 1.25,
      cradle, shutter, seated, lamp, target: null,
      _strainT: 0, _wasWeighing: false,
    };
    const kennelAnchor = new THREE.Vector3();
    puzzle.target = world.addFetchTarget({
      id: 'ossuaryKennelCradle', object: cradle, radius: 0.56,
      onHit(skull) {
        if (puzzle.solved) return 'return';
        if (skull.mode !== 'outbound') return 'continue';
        this.enabled = false;
        puzzle.state = 'weighing';
        cradle.getWorldPosition(kennelAnchor);
        skull.anchorAt(kennelAnchor, { swing: true, maxHold: 4.5, puzzleId: puzzle.id });
        game.impact('locked', kennelAnchor);
        game.audio.creak({ pos: kennelAnchor, gain: 0.55, rate: 0.72 });
        return 'anchor';
      },
    });
    return {
      puzzle, cradleBase, shutterBaseY, sliverMat, lamp, lampCore, coreMat,
      solvePos: new THREE.Vector3(OX - 5.83, FLOOR + 1.0, OZ + 12),
      remainsPos: new THREE.Vector3(OX - 6.05, FLOOR + 0.9, OZ + 12),
    };
  })();
  game.ossuaryKennel = kennel.puzzle;

  // ------------------------------------------------ THE EAST POCKET NICHES
  // The payoff the route's header promises: three niches, one per resonant
  // grave, each wearing the settled, bowed silhouette its surface grave wears
  // right now — read live off game.resonantGraves[i].credit. Silhouette and
  // value only, no hue. The under-yard answers what you already did.
  const nicheMinis = [];
  {
    const nicheStone = M.headstone.clone();
    nicheStone.color.multiplyScalar(0.62);
    if ('emissive' in nicheStone) {
      nicheStone.emissive = new THREE.Color(0xb9d4dc);
      nicheStone.emissiveIntensity = 0.07;
    }
    const nicheVoid = new THREE.MeshBasicMaterial({ color: 0x010204 });
    const wallFace = OX + 5.72;
    [OZ + 18.2, OZ + 19.0, OZ + 19.8].forEach((nz, i) => {
      const backing = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.42), nicheVoid);
      backing.position.set(wallFace + 0.02, FLOOR + 1.05, nz);
      backing.rotation.y = -Math.PI / 2;
      routeRoot.add(backing);
      addMeshBox(wallMat, wallFace - 0.1, FLOOR + 0.3, nz, 0.26, 0.1, 0.8, 'niche sill');
      addMeshBox(wallMat, wallFace - 0.08, FLOOR + 1.05, nz - 0.42, 0.2, 1.55, 0.1, 'niche jamb');
      addMeshBox(wallMat, wallFace - 0.08, FLOOR + 1.05, nz + 0.42, 0.2, 1.55, 0.1, 'niche jamb');
      addMeshBox(wallMat, wallFace - 0.08, FLOOR + 1.86, nz, 0.2, 0.1, 0.94, 'niche header');
      const mini = new THREE.Group();
      mini.name = `ossuary resonant niche ${i + 1}`;
      mini.userData.noBatch = true;
      const mBase = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.205, 0.088, 6), nicheStone);
      mBase.position.y = 0.045;
      mini.add(mBase);
      const mShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.588, 5), nicheStone);
      mini.add(mShaft);
      const mCrownL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.043, 0.18, 5), nicheStone);
      mini.add(mCrownL);
      const mCrownR = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.043, 0.155, 5), nicheStone);
      mini.add(mCrownR);
      const mCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), nicheStone);
      mCap.scale.set(1.25, 0.65, 0.8);
      mini.add(mCap);
      mini.position.set(wallFace - 0.16, FLOOR + 0.35, nz);
      mini.rotation.y = Math.PI / 2;
      routeRoot.add(mini);
      nicheMinis.push({ index: i, shaft: mShaft, crownL: mCrownL, crownR: mCrownR, cap: mCap });
    });
    world.candles.push({ x: OX + 4.45, y: FLOOR + 2.2, z: OZ + 19, intensity: 0.42, r: 4.2 });
  }

  const state = {
    origin: { x: OX, z: OZ, floor: FLOOR }, root: routeRoot,
    unlocked: false, route: null, inOssuary: false, solved: false,
    pulling: false, progress: 0, slabT: 0, exitT: 0,
    surfaceSlab, surfacePit, stairThroat, exitSlab, exitCollider,
    mechanism, wheel, weight, lidPivot, hatchChains, resident: null, target: null,
    unlock(route = 'ritual') {
      if (this.unlocked) return false;
      this.unlocked = true;
      this.route = route;
      game.flag('graveyardResolved');
      game.flag('ossuaryOpened');
      mausoleum.darkness.visible = false;
      surfacePit.visible = true;
      stairThroat.visible = true;
      game.audio.stoneGrind({ pos: new THREE.Vector3(mausoleum.x, 0, mausoleum.z), gain: 0.82, rate: 0.68 });
      return true;
    },
    reset() {
      if (game.flags.has('graveyardResolved')) return;
      this.unlocked = false;
      this.route = null;
      this.inOssuary = false;
      this.solved = false;
      this.pulling = false;
      this.progress = 0;
      this.slabT = 0;
      this.exitT = 0;
      surfaceSlab.position.set(mausoleum.x, 0.11, mausoleum.z + 0.15);
      surfaceSlab.rotation.x = 0;
      surfacePit.visible = false;
      stairThroat.visible = false;
      mausoleum.darkness.visible = true;
      exitSlab.position.y = FLOOR + 1.33;
      exitCollider.max.y = FLOOR + HEIGHT;
      if (this.target) this.target.enabled = true;
    },
  };
  game.ossuary = state;

  // A solid wall still costs every draw behind it: WebGL performs depth
  // rejection, not whole-scene portal culling. From the east pocket the camera
  // frustum also contains the house and most of the graveyard, which formerly
  // submitted more than a thousand hidden draws. Treat this offset under-yard
  // as a sealed district while occupied, preserving and restoring every
  // exterior root's live visibility exactly.
  const ossuarySaved = new Map();
  let ossuaryVisibilityActive = false;
  const keepInOssuary = (child) => child === game.camera
    || child === game.skull?.root
    || child === routeRoot
    || child === game._impactRing
    || child === game._impactLight
    || child.isLight
    // pinLightCensus lifts every boot light into world.lightRoot, a GROUP —
    // hiding it here dropped the whole census out of traverseVisible, which
    // both unlit the district's own candle descriptors and re-triggered the
    // exact whole-scene shader recompile the pin exists to prevent.
    || child === world.lightRoot
    // runtime residents (the district's Standing One) opt in by marker
    || child.userData?.keepInOssuary === true;
  const syncOssuaryVisibility = () => {
    if (state.inOssuary) {
      ossuaryVisibilityActive = true;
      for (const child of scene.children) {
        if (keepInOssuary(child)) continue;
        if (!ossuarySaved.has(child)) ossuarySaved.set(child, child.visible);
        child.visible = false;
      }
      return;
    }
    if (!ossuaryVisibilityActive) return;
    for (const [child, visible] of ossuarySaved) child.visible = visible;
    ossuarySaved.clear();
    ossuaryVisibilityActive = false;
  };

  const anchorPos = new THREE.Vector3(OX, FLOOR + 1.35, OZ + 26.1);
  state.target = world.addFetchTarget({
    id: 'ossuaryCounterweight', object: wheel, radius: 0.86,
    onHit(skull, at) {
      if (state.solved) return 'return';
      if (skull.mode !== 'outbound') return 'continue';
      this.enabled = false;
      state.pulling = true;
      skull.anchorAt(anchorPos, { maxHold: 4.5, puzzleId: 'ossuaryCounterweight' });
      game.impact('locked', at || anchorPos);
      game.audio.metalDrop({ pos: anchorPos, gain: 0.62, rate: 0.72 });
      return 'anchor';
    },
  });

  // ---------------------------------------------- THE FOREST-SIDE ARRIVAL
  // The far end is no longer a teleport onto bare grass: a stone hatch waits
  // at the gate, flush and shut until the counterweight pays out, standing
  // open over a black throat afterwards. The player lands in its mouth and
  // can turn around and see the hole they came out of. Registered as a
  // lookback root so forest back-district culling keeps it.
  const arrival = new THREE.Group();
  arrival.name = 'ossuary arrival hatch';
  scene.add(arrival);
  {
    const stone = M.headstone.clone();
    stone.color.multiplyScalar(0.6);
    const ax = FOREST_GATE.x;
    const az = FOREST_GATE.z + 0.3;
    arrival.position.set(ax, 0.08, az);
    const curb = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), stone);
      m.position.set(x, 0.09, z);
      m.castShadow = true;
      m.receiveShadow = true;
      arrival.add(m);
    };
    curb(0, -0.66, 1.5, 0.18);
    curb(0, 0.66, 1.5, 0.18);
    curb(-0.66, 0, 0.18, 1.14);
    curb(0.66, 0, 0.18, 1.14);
    const mouthVoid = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.14),
      new THREE.MeshBasicMaterial({ color: 0x010204 }));
    mouthVoid.rotation.x = -Math.PI / 2;
    mouthVoid.position.y = 0.02;
    arrival.add(mouthVoid);
    for (const [sx, sz, w, d] of [[0, -0.53, 1.1, 0.1], [0, 0.53, 1.1, 0.1],
      [-0.53, 0, 0.1, 0.96], [0.53, 0, 0.1, 0.96]]) {
      const wallDown = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, d), stone);
      wallDown.position.set(sx, -0.42, sz);
      arrival.add(wallDown);
    }
    const arrivalPivot = new THREE.Group();
    arrivalPivot.position.set(0, 0.16, -0.6);
    arrival.add(arrivalPivot);
    const arrivalLid = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.1, 1.3), stone);
    arrivalLid.position.z = 0.62;
    arrivalLid.castShadow = true;
    arrivalPivot.add(arrivalLid);
    // the player walks AROUND the open mouth; the skull still crosses it
    world.addCollider(ax - 0.68, -0.8, az - 0.68, ax + 0.68, 0.8, az + 0.68,
      { skullPass: true });
    state.arrival = { root: arrival, pivot: arrivalPivot };
  }
  (game.graveyardLookbackRoots ||= []).push(arrival);

  const kAnchor = new THREE.Vector3();
  let hatchCreaked = false;
  game.tickers.push((dt, time) => {
    let crossedFarExit = false;
    state.slabT += ((state.unlocked ? 1 : 0) - state.slabT) * Math.min(1, dt * 1.6);
    surfaceSlab.position.y = 0.11 - state.slabT * 1.06;
    surfaceSlab.position.z = mausoleum.z + 0.15 + state.slabT * 0.72;
    surfaceSlab.rotation.x = -state.slabT * 0.42;
    entryLamp.intensity += ((state.unlocked ? 3.2 : 0) - entryLamp.intensity) * Math.min(1, dt * 2.4);

    const player = game.player;
    const p = player.pos;
    const skull = game.skull;
    // Crossing the black stair throat swaps to an enclosed offset district on
    // the same act. There is no prompt, camera pan, or input lock.
    if (state.unlocked && !state.inOssuary && game.act === 'graveyard'
      && skull?.mode === 'held'
      && Math.abs(p.x - mausoleum.x) < 0.58
      && p.z > mausoleum.z - 0.12 && p.z < mausoleum.z + 1.2 && p.y > -1) {
      state.inOssuary = true;
      p.set(OX, FLOOR, OZ + 0.85);
      player.vel.set(0, 0, 0);
      player.fallV = 0;
      player.grounded = true;
      // Face DOWN the corridor. Player forward is (-sin yaw, -cos yaw), so
      // yaw 0 looks along -z while the ossuary runs +z from OZ to OZ+28 --
      // the arrival put the player's nose against the wall behind the stair
      // throat, in the dark, with the entire authored route out of shot.
      // Alex screenshotted the result: an almost black frame, captioned
      // "passage through graveyard opens up to you facing a wall".
      player.yaw = Math.PI;
      player.pitch = 0;
      player._sync(0);
      game.enemies.clear((enemy) => enemy.graveArena || enemy.gravePressure);
      game.flag('ossuaryEntered');
      game.checkpoint('graveyard');
      game.audio.stoneGrind({ pos: new THREE.Vector3(OX, FLOOR, OZ), gain: 0.34, rate: 0.54 });
      // The district's one inhabitant is the real Standing Kind: it moves
      // only while unobserved, so the corridor is walked with glances over
      // the shoulder. It stands past the last baffle, before the wheel —
      // the player passes it, then holds the counterweight with it behind
      // them. The keepInOssuary marker spares it from the district seal.
      const residentAlive = state.resident && game.enemies.list.includes(state.resident);
      if (!state.solved && !residentAlive) {
        // posted on the WEST side: the last baffle forces the east gap, so
        // the player passes it at arm's-plus length — watched, never blocked
        const res = game.enemies.spawn('walker', OX - 1.6, OZ + 20.4, 'standing', FLOOR + 1);
        res.standing = true;
        res.ossuaryResident = true;
        res.home = { x: OX - 1.6, z: OZ + 20.4 };
        // it closes while your back is turned, but never leaves its post —
        // the corridor stays a walk of glances, not a pursuit
        res.tether = 2.2;
        res.mesh.userData.keepInOssuary = true;
        state.resident = res;
      }
    }
    if (state.inOssuary && !state.solved && p.z < OZ + 0.28 && skull?.mode === 'held') {
      state.inOssuary = false;
      p.set(mausoleum.x, 0.04, mausoleum.z - 1.2);
      player.vel.set(0, 0, 0);
      player.fallV = 0;
      player.grounded = true;
      player.yaw = Math.PI;
      player._sync(0);
      game.checkpoint('graveyard');
      // the resident stays with its district; it does not follow into the yard
      game.enemies.clear((enemy) => enemy.ossuaryResident);
      state.resident = null;
    }

    const anchored = skull?.mode === 'anchored'
      && skull.anchor?.puzzleId === 'ossuaryCounterweight';
    if (!state.solved) {
      if (anchored) state.progress = Math.min(1, state.progress + dt / 1.7);
      else state.progress = Math.max(0, state.progress - dt * 1.4);
      if (!anchored && skull?.mode === 'held') {
        state.pulling = false;
        state.target.enabled = true;
      }
    }
    // The chain now PAYS OUT from a fixed corbel instead of growing in both
    // directions from its own middle: its top stays bolted where it hangs and
    // the weight rides its bottom end down. The old maths ran the chain from
    // y 1.8 to y 3.5 at rest, through a ceiling that is at 2.85, and the two
    // parts never stayed connected to each other.
    wheelGroup.rotation.x = state.progress * TAU * 1.45;
    const payout = 0.55 + state.progress * 1.1;
    chain.scale.y = payout / 1.7;
    chain.position.y = CORBEL_Y - payout / 2;
    weight.position.y = CORBEL_Y - payout - 0.41;
    if (!state.solved && state.progress >= 1) {
      state.solved = true;
      state.pulling = false;
      state.target.enabled = false;
      game.flag('ossuaryCleared');
      game.flag('graveyardCleared');
      game.graveyardGate?.openGate?.('ossuary');
      // (the exit collider is not collapsed here — it tracks the sinking
      // slab in the ticker below, so the way opens when the stone is gone)
      game.audio.metalDrop({ pos: anchorPos, gain: 0.88, rate: 0.62 });
      game.audio.duck(0.2, 2.8);
      game.checkpoint('graveyard');
      // the Standing One lays itself to rest as the counterweight pays out —
      // the ritual it was standing for is complete
      if (state.resident && game.enemies.list.includes(state.resident)) {
        game.enemies._layToRest?.(state.resident);
      }
    }
    state.exitT += ((state.solved ? 1 : 0) - state.exitT) * Math.min(1, dt * 1.8);
    exitSlab.position.y = FLOOR + 1.33 - state.exitT * 3.1;
    exitSlab.rotation.z = state.exitT * 0.08;
    // The collider follows the STONE, not the solve flag. It used to collapse
    // on the solve frame while the slab spent the next two seconds visibly
    // sinking — so the wall was walk-through-able while it still filled the
    // corridor, which is precisely the "you touch a wall to exit" feel Alex
    // reported. Open only once the slab's top has sunk below the floor.
    const slabTop = exitSlab.position.y + 1.325;
    exitCollider.max.y = slabTop < FLOOR + 0.05 ? exitCollider.min.y : FLOOR + HEIGHT;
    // The same number drives every stage of the way out: the slab sinks, the
    // chain X drops off the hatch, the lid swings, the glow in the mouth
    // blooms. All poses derive from exitT so a forced restore (director
    // teleport, respawn) seats the entire far end with one assignment.
    hatchChains.position.y = -smoothstep(0.04, 0.34, state.exitT) * 1.85;
    lidPivot.rotation.x = smoothstep(0.3, 0.98, state.exitT) * 1.92;
    if (!hatchCreaked && state.exitT > 0.32) {
      hatchCreaked = true;
      game.audio.stoneGrind({
        pos: new THREE.Vector3(OX - 2.45, DECK_Y, OZ + 34.75), gain: 0.5, rate: 0.9,
      });
    }
    shaftGlow.intensity += ((1.0 + state.exitT * 3.4) - shaftGlow.intensity)
      * Math.min(1, dt * 2.2);
    // the forest-side mouth opens on the same payout — parametric off exitT
    // like everything else at the far end, so one forced assignment seats it
    state.arrival.pivot.rotation.x = -smoothstep(0.05, 0.95, state.exitT) * 1.85;

    // the kennel: a held weight raises the shutter; letting go drops it
    {
      const kp = kennel.puzzle;
      const weighing = skull && skull.mode === 'anchored'
        && skull.anchor && skull.anchor.puzzleId === kp.id;
      if (!kp.solved) {
        if (!weighing && skull && skull.mode === 'held') kp.target.enabled = true;
        if (weighing) kp.holdTime = Math.min(kp.requiredHold, kp.holdTime + dt);
        else kp.holdTime = Math.max(0, kp.holdTime - dt * 1.8);
        kp.state = weighing ? 'weighing' : kp.holdTime > 0 ? 'resetting' : 'idle';
        kp.progress = clamp(kp.holdTime / kp.requiredHold, 0, 1);
        if (kp.progress >= 1) {
          kp.solved = true;
          kp.state = 'latched';
          kp.target.enabled = false;
          game.flag('ossuaryKennelSolved');
          game.audio.unlock({ pos: kennel.solvePos, gain: 0.85, rate: 0.72 });
          game.audio.metalDrop({ pos: kennel.solvePos, gain: 0.7, rate: 0.62 });
          game.after(0.62, () => game.audio.knock({ pos: kennel.remainsPos, gain: 0.34, rate: 0.76 }));
          game.after(1.15, () => game.audio.whisper({ pos: kennel.remainsPos, gain: 0.28, rate: 0.7, verb: 0.85 }));
        }
      } else kp.progress = 1;
      const ke = kp.progress * kp.progress * (3 - 2 * kp.progress);
      kp.cradle.position.y = kennel.cradleBase.y - ke * 0.5;
      kp.shutter.position.y = kennel.shutterBaseY + ke * 1.86;
      if (weighing && skull?.anchor) {
        kp.cradle.getWorldPosition(kAnchor);
        skull.pos.copy(kAnchor);
        skull.root.position.copy(kAnchor);
        skull.anchor.point.copy(kAnchor);
      }
      if (weighing) {
        kp._strainT -= dt;
        if (kp._strainT <= 0) {
          kp._strainT = 0.34;
          game.audio.creak({
            pos: kennel.solvePos,
            gain: 0.3 + kp.progress * 0.25, rate: 0.55 + kp.progress * 0.5,
          });
        }
      } else if (kp._wasWeighing && !kp.solved && kp.holdTime > 0.1) {
        game.audio.stoneGrind({ pos: kennel.solvePos, gain: 0.62, rate: 1.4 });
        game.shake(0.12);
      }
      kp._wasWeighing = weighing;
      const kBreath = Math.sin(time * 2.1);
      const lampTarget = kp.solved ? 9.5 + kBreath * 0.5 : 1.6 + kBreath * 0.14;
      kennel.lamp.intensity += (lampTarget - kennel.lamp.intensity) * Math.min(1, dt * 2.5);
      const coreTarget = kp.solved ? 0.7 + kBreath * 0.03 : 0.16 + kBreath * 0.015;
      kennel.lampCore.material.opacity += (coreTarget - kennel.lampCore.material.opacity)
        * Math.min(1, dt * 3.5);
      const seamTarget = kp.solved ? 0 : 0.3 + kBreath * 0.02;
      kennel.sliverMat.opacity += (seamTarget - kennel.sliverMat.opacity) * Math.min(1, dt * 4.5);
      kennel.coreMat.opacity = 0.035 + (weighing ? 0.28 + Math.sin(time * 17) * 0.04 : 0);
    }

    // The niches wear the surface graves' settled silhouettes, live. The
    // minis are quarter-scale sculpts of the resonant graves, so every donor
    // offset scales by the same 0.25 — geometry and position must agree or
    // the crowns float off their shafts.
    for (const m of nicheMinis) {
      const c = game.resonantGraves?.[m.index]?.credit ?? 0;
      m.shaft.position.y = (1.38 - c * 0.16) * 0.25;
      m.crownL.position.set(-0.04, (2.82 - c * 0.28) * 0.25, 0);
      m.crownL.rotation.z = -0.23 - c * 0.34;
      m.crownR.position.set(0.0425, (2.77 - c * 0.24) * 0.25, 0.005);
      m.crownR.rotation.z = 0.3 + c * 0.38;
      m.cap.position.set(-0.01, (2.49 - c * 0.18) * 0.25, 0);
    }

    // The way out is now the TOP of the climb: standing on the hatch platform
    // with the lid fully open, walls filling the frame, skull in hand — the
    // same masking the entry throat gets. No more crossing a plane at a slab.
    if (state.inOssuary && state.solved && state.exitT > 0.98
      && p.y > FLOOR + 3.05 && p.x < OX - 2.0 && p.z > OZ + 33.9
      && skull?.mode === 'held') {
      state.inOssuary = false;
      p.set(FOREST_GATE.x, 0.12, FOREST_GATE.z + 1.35);
      player.vel.set(0, 0, 0);
      player.fallV = 0;
      player.grounded = true;
      // The hatch rises beyond the gate. Face into the new chapter instead of
      // back toward the completed 1,000-draw yard, and commit the forest act
      // in this same fixed step rather than exposing one graveyard frame.
      player.yaw = Math.PI;
      player.pitch = 0;
      player._sync(0);
      game.flag('ossuaryExited');
      game.enemies.clear((enemy) => enemy.ossuaryResident);
      state.resident = null;
      game.director.setAct('forest');
      game.forest?.recentre(player.pos);
      game.checkpoint('forest');
      game.audio.stoneGrind({ pos: new THREE.Vector3(FOREST_GATE.x, 0, 42.4), gain: 0.46, rate: 0.8 });
      crossedFarExit = true;
    }
    routeRoot.visible = state.inOssuary;
    syncOssuaryVisibility();
    if (crossedFarExit) game.forest?.syncBackDistrictCulling(true);
  });

  // Keep the room's static detail to four-ish draws (batched materials plus
  // one InstancedMesh) instead of paying for every rib, stain, and baffle.
  batchStaticGroup(routeRoot, 'ossuary shell');
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
  // Value separation does the anatomical work at gameplay distance. Clothing
  // sits close to the night while the small areas of exposed skin remain
  // legible in the skull light; the former shared mid-grey made every body read
  // as one injection-moulded mannequin.
  const clothes = [0x12191e, 0x211317, 0x111b19, 0x1d1c14].map((color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.98 }));
  const trousers = [0x090c0f, 0x100b0e, 0x0a100f, 0x11110d].map((color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.99 }));
  const seam = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x554941, roughness: 1 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.98 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x11100f, roughness: 1 });
  const faceDark = new THREE.MeshStandardMaterial({ color: 0x080909, roughness: 1 });
  const contactMat = new THREE.MeshBasicMaterial({
    color: 0x010202, transparent: true, opacity: 0.58, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1,
  });
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

  // A small ring-volume builder gives the torso and head an actual anatomical
  // outline: shoulder shelf, rib cage, waist, jaw and occiput.  It is cheaper
  // than stacking spheres and, crucially, never presents a circular capsule
  // silhouette to the camera.
  const sectionGeometry = (sections, sides = 8) => {
    const positions = [];
    const indices = [];
    for (const s of sections) {
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * TAU + Math.PI / sides;
        const irregular = 1 + ((j & 1) ? 0.025 : -0.018);
        positions.push(
          (s.x || 0) + Math.cos(a) * s.w * irregular,
          s.y + Math.sin(a) * s.h,
          s.z,
        );
      }
    }
    for (let i = 0; i < sections.length - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const n = (j + 1) % sides;
        const a = i * sides + j, b = i * sides + n;
        const c = (i + 1) * sides + n, d = (i + 1) * sides + j;
        indices.push(a, b, d, b, c, d);
      }
    }
    const firstCenter = positions.length / 3;
    const first = sections[0];
    positions.push(first.x || 0, first.y, first.z);
    const lastCenter = positions.length / 3;
    const last = sections.at(-1);
    positions.push(last.x || 0, last.y, last.z);
    for (let j = 0; j < sides; j++) {
      const n = (j + 1) % sides;
      indices.push(firstCenter, n, j);
      const base = (sections.length - 1) * sides;
      indices.push(lastCenter, base + j, base + n);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  // Limbs follow a three-ring bent path with elliptical cross-sections and
  // different joint radii.  The old CapsuleGeometry had the same rubber-hose
  // radius at shoulder, wrist, thigh and ankle.
  const limbGeometry = (a, b, r0, r1, flatten = 0.7, bend = 0) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const axis = vb.clone().sub(va).normalize();
    const lateral = new THREE.Vector3().crossVectors(Y, axis);
    if (lateral.lengthSq() < 0.001) lateral.set(1, 0, 0);
    lateral.normalize();
    const mid = va.clone().lerp(vb, 0.52).addScaledVector(lateral, bend);
    mid.y += Math.min(0.022, va.distanceTo(vb) * 0.035);
    const path = [va, mid, vb];
    const radii = [r0, (r0 + r1) * 0.525, r1];
    const sides = 7;
    const positions = [], indices = [];
    for (let i = 0; i < path.length; i++) {
      const tangent = (i === 0 ? path[1].clone().sub(path[0])
        : i === path.length - 1 ? path[i].clone().sub(path[i - 1])
          : path[i + 1].clone().sub(path[i - 1])).normalize();
      const side = new THREE.Vector3().crossVectors(Y, tangent);
      if (side.lengthSq() < 0.001) side.set(1, 0, 0);
      side.normalize();
      const up = new THREE.Vector3().crossVectors(tangent, side).normalize();
      for (let j = 0; j < sides; j++) {
        const angle = (j / sides) * TAU + 0.19;
        const ring = path[i].clone()
          .addScaledVector(side, Math.cos(angle) * radii[i] * (j & 1 ? 0.98 : 1.04))
          .addScaledVector(up, Math.sin(angle) * radii[i] * flatten);
        positions.push(ring.x, ring.y, ring.z);
      }
    }
    for (let i = 0; i < path.length - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const n = (j + 1) % sides;
        const p0 = i * sides + j, p1 = i * sides + n;
        const p2 = (i + 1) * sides + n, p3 = (i + 1) * sides + j;
        indices.push(p0, p1, p3, p1, p2, p3);
      }
    }
    const start = positions.length / 3;
    positions.push(va.x, va.y, va.z);
    const end = positions.length / 3;
    positions.push(vb.x, vb.y, vb.z);
    for (let j = 0; j < sides; j++) {
      const n = (j + 1) % sides;
      indices.push(start, n, j);
      const base = (path.length - 1) * sides;
      indices.push(end, base + j, base + n);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };
  const limb = (group, a, b, r0, r1, mat, flatten = 0.7, bend = 0) => {
    const mesh = new THREE.Mesh(limbGeometry(a, b, r0, r1, flatten, bend), mat);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const digit = (group, a, b, r0, r1, mat) => limb(group, a, b, r0, r1, mat, 0.62);

  // Faceted wedge shared by palms and shoes. A narrow heel/wrist and broad,
  // lowered toe/finger edge reads as a hand or boot instead of a Lego brick.
  const wedgeGeometry = (length, heelWidth, toeWidth, height) => {
    const h = height * 0.5, l = length * 0.5;
    const positions = [
      -heelWidth, -h, -l, heelWidth, -h, -l, -toeWidth, -h, l, toeWidth, -h, l,
      -heelWidth * 0.92, h, -l, heelWidth * 0.92, h, -l,
      -toeWidth * 0.88, h * 0.56, l, toeWidth * 0.88, h * 0.56, l,
    ];
    const indices = [
      0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6,
      0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7,
      0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  const panelGeometry = (vertices, indices) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  const contactShape = new THREE.Shape();
  contactShape.moveTo(-0.2, -0.9);
  contactShape.bezierCurveTo(-0.5, -0.65, -0.48, -0.08, -0.32, 0.25);
  contactShape.bezierCurveTo(-0.42, 0.67, -0.26, 1.25, -0.12, 1.57);
  contactShape.lineTo(0.14, 1.52);
  contactShape.bezierCurveTo(0.28, 1.08, 0.45, 0.55, 0.31, 0.2);
  contactShape.bezierCurveTo(0.5, -0.2, 0.42, -0.68, 0.2, -0.92);
  contactShape.closePath();
  const contactGeo = new THREE.ShapeGeometry(contactShape, 4);
  contactGeo.rotateX(Math.PI / 2);

  sites.forEach(([x, z], i) => {
    const group = new THREE.Group();
    group.name = 'graveyard body ' + (i + 1);
    const cloth = clothes[i % clothes.length];
    const trouser = trousers[i % trousers.length];
    const shoulderSkew = (i - 1.5) * 0.018;
    const torso = new THREE.Mesh(sectionGeometry([
      { x: -shoulderSkew, y: 0.22, z: -0.35, w: 0.23, h: 0.13 },
      { x: shoulderSkew, y: 0.235, z: -0.24, w: 0.36, h: 0.17 },
      { x: shoulderSkew * 0.5, y: 0.225, z: -0.02, w: 0.315, h: 0.175 },
      { x: -shoulderSkew, y: 0.205, z: 0.22, w: 0.22, h: 0.135 },
      { x: 0.015 * (i & 1 ? 1 : -1), y: 0.2, z: 0.34, w: 0.235, h: 0.13 },
    ], 9), cloth);
    torso.castShadow = true;
    group.add(torso);
    const pelvis = new THREE.Mesh(sectionGeometry([
      { x: 0.01, y: 0.19, z: 0.25, w: 0.22, h: 0.12 },
      { x: -0.01, y: 0.19, z: 0.43, w: 0.3, h: 0.145 },
      { x: 0.018 * (i % 2 ? -1 : 1), y: 0.175, z: 0.58, w: 0.265, h: 0.12 },
    ], 8), trouser);
    group.add(pelvis);

    // The irregular hem and raised lapel create cloth-over-body layering, not
    // a second cone pasted over the same smooth torso.
    const ragGeo = panelGeometry([
      -0.3, 0.305, 0.05, 0.3, 0.31, 0.04, 0.35, 0.16, 0.48,
      0.08, 0.135, 0.62, -0.19, 0.145, 0.54, -0.36, 0.15, 0.39,
      -0.04, 0.335, 0.22,
    ], [0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
    const rag = new THREE.Mesh(ragGeo, cloth);
    rag.rotation.z = (i - 1.5) * 0.025;
    rag.castShadow = true;
    group.add(rag);
    const coat = new THREE.Mesh(panelGeometry([
      -0.31, 0.335, -0.25, -0.035, 0.405, -0.16, -0.07, 0.33, 0.18,
      0.035, 0.405, -0.16, 0.3, 0.34, -0.23, 0.08, 0.335, 0.2,
    ], [0, 1, 2, 1, 3, 2, 3, 4, 5]), cloth);
    group.add(coat);
    for (const [x0, z0, x1, z1] of [
      [-0.24, -0.13, -0.04, 0.1], [0.2, -0.08, 0.055, 0.13], [-0.18, 0.33, -0.02, 0.5],
    ]) {
      const fold = limb(group, [x0, 0.344, z0], [x1, 0.338, z1], 0.011, 0.005,
        seam, 0.24, 0.004 * (i % 2 ? -1 : 1));
      fold.castShadow = false;
    }

    const neck = limb(group, [0, 0.19, -0.35], [0, 0.185, -0.52],
      0.105, 0.085, skin, 0.68, shoulderSkew);
    const headRig = new THREE.Group();
    headRig.position.set(i === 2 ? 0.07 : 0, 0.19, -0.7);
    headRig.rotation.y = [-0.82, 0.7, -0.56, 0.9][i];
    const head = new THREE.Mesh(sectionGeometry([
      { x: 0, y: -0.015, z: -0.2, w: 0.1, h: 0.085 },
      { x: 0, y: 0, z: -0.13, w: 0.145, h: 0.12 },
      { x: 0, y: 0.015, z: 0.015, w: 0.18, h: 0.145 },
      { x: 0, y: 0.015, z: 0.15, w: 0.145, h: 0.125 },
    ], 9), skin);
    headRig.add(head);
    const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.195, 9, 6, 0, TAU, 0, Math.PI * 0.56), hair);
    scalp.position.set(0, 0.042, 0.018);
    scalp.scale.set(0.9, 0.72, 1.02);
    headRig.add(scalp);
    if (i !== 3) {
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.105, 5), skin);
      nose.position.set(0, 0.012, -0.235);
      nose.rotation.x = -Math.PI / 2;
      headRig.add(nose);
    }
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.TetrahedronGeometry(0.052, 0), skin);
      ear.position.set(side * 0.164, 0.004, 0);
      ear.scale.set(0.48, 0.9, 0.65);
      headRig.add(ear);
      const socket = new THREE.Mesh(new THREE.CircleGeometry(0.031, 7), faceDark);
      socket.position.set(side * 0.062, 0.035, -0.184);
      socket.rotation.x = -0.16;
      headRig.add(socket);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.01, 0.008), faceDark);
    mouth.position.set(0, -0.052, -0.195);
    mouth.rotation.z = (i - 1.5) * 0.055;
    headRig.add(mouth);
    group.add(headRig);

    const p = poses[i];
    const armSegments = [
      [[-0.2, 0.25, -0.25], p.le, false], [p.le, p.lh, true],
      [[0.2, 0.25, -0.25], p.re, false], [p.re, p.rh, true],
    ];
    armSegments.forEach(([a, b, forearm], segment) => {
      const exposed = i === 1 && forearm;
      limb(group, a, b, forearm ? 0.07 : 0.095, forearm ? 0.048 : 0.072,
        exposed ? skin : cloth, forearm ? 0.66 : 0.74,
        (segment % 2 ? -1 : 1) * (0.012 + i * 0.002));
    });
    for (const [elbow, hand, handed] of [[p.le, p.lh, -1], [p.re, p.rh, 1]]) {
      const handPos = new THREE.Vector3(...hand);
      const reach = handPos.clone().sub(new THREE.Vector3(...elbow)).setY(0).normalize();
      const across = new THREE.Vector3(-reach.z, 0, reach.x);
      const palm = new THREE.Mesh(wedgeGeometry(0.15, 0.05, 0.066, 0.045), skin);
      palm.position.copy(handPos).addScaledVector(reach, 0.032);
      palm.rotation.y = Math.atan2(reach.x, reach.z);
      group.add(palm);
      for (let finger = 0; finger < 4; finger++) {
        const splay = (finger - 1.5) * 0.026;
        const start = handPos.clone().addScaledVector(reach, 0.088).addScaledVector(across, splay);
        const length = 0.065 + (finger === 1 || finger === 2 ? 0.024 : 0);
        const end = start.clone().addScaledVector(reach, length)
          .addScaledVector(across, splay * 0.55);
        digit(group, start.toArray(), end.toArray(), 0.012, 0.0065, skin);
      }
      const thumbStart = handPos.clone().addScaledVector(reach, 0.025)
        .addScaledVector(across, handed * 0.052);
      const thumbEnd = thumbStart.clone().addScaledVector(reach, 0.055)
        .addScaledVector(across, handed * 0.045);
      digit(group, thumbStart.toArray(), thumbEnd.toArray(), 0.014, 0.007, skin);
    }
    for (const [legIndex, [a, b, foot]] of [
      [[-0.14, 0.2, 0.48], p.lk, p.lf], [[0.14, 0.2, 0.48], p.rk, p.rf],
    ].entries()) {
      limb(group, a, b, 0.135, 0.098, trouser, 0.7,
        (legIndex ? -1 : 1) * (0.014 + i * 0.002));
      limb(group, b, foot, 0.095, 0.062, trouser, 0.66,
        (legIndex ? 1 : -1) * 0.01);
      const footDir = new THREE.Vector3(...foot).sub(new THREE.Vector3(...b));
      footDir.y = 0;
      footDir.normalize();
      const f = new THREE.Mesh(wedgeGeometry(0.32, 0.062, 0.096, 0.105), shoe);
      f.position.set(...foot).addScaledVector(footDir, 0.055);
      f.rotation.y = Math.atan2(footDir.x, footDir.z);
      f.rotation.z = (i % 2 ? -1 : 1) * 0.035;
      group.add(f);
    }
    if (i === 3) {
      const sheetMat = new THREE.MeshStandardMaterial({ color: 0x353834, roughness: 1, side: THREE.DoubleSide });
      const rows = 6, cols = 5, vertices = [], indices = [];
      for (let row = 0; row < rows; row++) {
        const t = row / (rows - 1);
        const zz = -0.3 + t * 1.22;
        const half = 0.5 - Math.abs(t - 0.48) * 0.075;
        const bodyRise = 0.19 + Math.exp(-(((zz - 0.06) / 0.42) ** 2)) * 0.22
          + Math.exp(-(((zz - 0.55) / 0.3) ** 2)) * 0.08;
        for (let col = 0; col < cols; col++) {
          const u = col / (cols - 1);
          const xx = (u * 2 - 1) * half + Math.sin(row * 2.2) * 0.018;
          const edgeDrop = Math.abs(u * 2 - 1) ** 1.7 * 0.15;
          vertices.push(xx, bodyRise - edgeDrop + Math.sin(row * 1.7 + col * 2.1) * 0.018, zz);
        }
      }
      for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
          const a = row * cols + col, b = a + 1, c = a + cols + 1, d = a + cols;
          indices.push(a, b, d, b, c, d);
        }
      }
      const sheet = new THREE.Mesh(panelGeometry(vertices, indices), sheetMat);
      sheet.rotation.y = -0.12;
      sheet.position.set(0.04, 0.015, 0.06);
      sheet.castShadow = true;
      group.add(sheet);
    }
    const contact = new THREE.Mesh(contactGeo, contactMat);
    contact.position.set((i - 1.5) * 0.015, 0.006, 0.28);
    contact.scale.set(0.92 + i * 0.035, 1, 0.88 + (i % 2) * 0.09);
    group.add(contact);
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
    // Forest props are authored as independent top-level roots so they can
    // animate and receive skull hits. Keep an exact ownership boundary around
    // those roots: submitting both optional pockets, every appliance, both
    // forks, the mire and the arena while the player is still at the house or
    // graveyard cost more than a hundred invisible/off-route draws on the
    // target laptop. The distant atmosphere pass supplies the treeline until
    // the player reaches the gate; these close details wake just before entry.
    const detailStart = scene.children.length;

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

    // Two short braids make route choice a physical forest verb instead of a
    // painted fork sign. Progress remains the same monotonic spline distance,
    // so the seal, checkpoints, arena trigger and every old test keep one
    // shared clock. The alternatives are lateral authored ribbons that diverge
    // from and return to that clock.
    this.forks = [
      {
        id: 'switchboard-braid', startS: 48, endS: 64, commitDistance: 6,
        separation: 4.25, routeWidth: 1.28, defaultSide: -1,
      },
      {
        id: 'washhouse-braid', startS: 118, endS: 139, commitDistance: 6,
        separation: 4.4, routeWidth: 1.3, defaultSide: 1,
      },
    ].map((fork) => ({
      ...fork,
      commitS: fork.startS + fork.commitDistance,
      selected: null,
      previewSide: fork.defaultSide,
      committedAt: null,
      closureT: 0,
      closureTarget: 0,
      closures: null,
    }));

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
    // THE CHAIN (STATE-OF-PLAY §8, verb 3; Alex, twice: "there should be more
    // swingy things in the forest that you can use consecutively"). Five knots
    // on the centreline of the straightest run in the forest — s 163→204 bows
    // less than 0.08 m at these gaps — each knot placed inside the previous
    // one's lamp. The numbers are laws, not taste:
    //   height 7.0  — a latch anchor LIFTS only while 30·sin(elev) > 14, i.e.
    //                 the pivot must sit ≥ 0.53 × horizontal reach above the
    //                 eye. 7 m over an ~8 m latch clears it; the old ravine
    //                 pivot at 3.4 never did, and held swings sank.
    //   gaps ≤ 9    — the skull's carried lamp reaches 11.5 m, and while the
    //                 skull is ANCHORED the lamp hangs at the knot: each knot
    //                 lights exactly the next one. That is the whole tutorial —
    //                 no HUD, no words, no hue.
    // The seed knot at s=65 teaches the link before it is required: its arc
    // releases the player ~8 m from the searchers-line pocket knot, one
    // comfortable throw, on the forest's other straightest stretch.
    this.chain = {
      seedS: 65,
      knotS: [165, 173, 182, 191, 200],
      height: 7.0,
      widen: 1.35, widenAt: 182, span: 26,
    };
    // Keep the ordinary corridor separate from its authored side-pocket ground.
    // `halfW` still describes all rendered/grounded space; clampPlayer decides
    // which one-sided pocket has been earned through the matching skull latch.
    this.baseHalfW = this.samples.map((s, i) => {
      const t = i / this.length;
      let w = lerp(2.4, 1.5, smoothstep(0, 0.35, t)) * (0.9 + 0.2 * Math.sin(i * 0.29));
      w += 9 * Math.exp(-(((i - this.arenaS()) / 14) ** 2));       // the arena bulge
      // the chain's aisle: the run of consecutive swings gets a wider lane, in
      // the same Gaussian idiom as the pockets, so an arc's lateral drift is
      // landing room instead of an invisible clamp fight
      w += this.chain.widen * Math.exp(-(((i - this.chain.widenAt) / this.chain.span) ** 2));
      return w;
    });
    this.halfW = this.baseHalfW.map((base, i) => {
      let w = base;
      for (const pocket of this.secretPockets) {
        w += pocket.widen * Math.exp(-(((i - pocket.centerS) / pocket.span) ** 2));
      }
      for (const fork of this.forks) {
        const shoulder = smoothstep(fork.startS - 3.5, fork.startS + 3, i)
          * (1 - smoothstep(fork.endS - 3, fork.endS + 3.5, i));
        w = Math.max(w, base + shoulder * (fork.separation + fork.routeWidth + 1.45));
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
    this._buildForkTopology();
    this._setpieces();
    this._buildForestLandmarks();
    this._buildOptionalRopes();
    this._buildChain();
    this._buildForestStoryProps();

    this.detailRoots = scene.children.slice(detailStart);
    this._detailBaseVisibility = new Map(this.detailRoots.map((root) => [root, root.visible]));
    this._detailsVisible = false;
    for (const root of this.detailRoots) root.visible = false;

    // The gate is a one-way composition boundary. Once crossed, keep only the
    // gate, fence, and ground as a cheap look-back silhouette; the completed
    // house and graveyard props no longer need to submit hundreds of draws
    // whenever the player turns south in the forest.
    const lookback = new Set(game.graveyardLookbackRoots || []);
    this.backDistrictRoots = [
      ...(game.houseRenderRoots || []),
      ...(game.graveyardRenderRoots || []),
    ].filter((root) => !lookback.has(root));
    this.backDistrictVisibility = new Map();
    this.backDistrictCullActive = false;

    // NOTE: the forest zone/surface are registered in buildOutside AFTER the
    // clearing and cave, so their tighter rects win the first-match scan.
    world.postClamp = (pos, dt) => this.clampPlayer(pos, dt);
  }

  arenaS() { return Math.floor(this.length * 0.72); }
  ravineS() { return Math.floor(this.length * 0.5); }

  forkAtS(s, margin = 0) {
    return this.forks.find((fork) => s >= fork.startS - margin && s <= fork.endS + margin) || null;
  }

  forkRouteOffset(forkOrId, s) {
    const fork = typeof forkOrId === 'string'
      ? this.forks.find((candidate) => candidate.id === forkOrId)
      : forkOrId;
    if (!fork) return 0;
    const u = clamp((s - fork.startS) / (fork.endS - fork.startS), 0, 1);
    return fork.separation * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.82);
  }

  forkRoutePoint(forkOrId, side, s) {
    const fork = typeof forkOrId === 'string'
      ? this.forks.find((candidate) => candidate.id === forkOrId)
      : forkOrId;
    if (!fork) return this.posAt(s, 0);
    const point = this.posAt(s, (side < 0 ? -1 : 1) * this.forkRouteOffset(fork, s));
    point.y = this.heightAt(point.x, point.z);
    return point;
  }

  _setForkClosures(fork, closed) {
    fork.closureTarget = closed ? 1 : 0;
    if (!fork.closures) return;
    const selected = fork.selected;
    for (const row of fork.closures.rows) {
      const active = !!closed && (row.kind === 'parent' || row.side === -selected);
      row.target = active ? 1 : 0;
    }
  }

  _commitFork(fork, side, atS, { restore = false } = {}) {
    if (fork.selected) return fork.selected;
    fork.selected = side < 0 ? -1 : 1;
    fork.previewSide = fork.selected;
    fork.committedAt = atS;
    this._setForkClosures(fork, true);
    this.game.flags.delete(`forestFork:${fork.id}:left`);
    this.game.flags.delete(`forestFork:${fork.id}:right`);
    this.game.flag(`forestFork:${fork.id}:${fork.selected < 0 ? 'left' : 'right'}`);
    if (!restore) {
      const mouth = this.forkRoutePoint(fork, -fork.selected, fork.startS + 2.8);
      this.game.audio.brushCrash({ pos: mouth, gain: 0.7, rate: fork.selected < 0 ? 0.82 : 0.72 });
      this.game.audio.creak({ pos: this.posAt(fork.startS - 0.35), gain: 0.48, rate: 0.66 });
      // A choice that closes the parent path is an irreversible spatial beat.
      // Own a checkpoint just beyond the commitment line, on the selected
      // ribbon, so death cannot return the player behind their own new wall.
      const checkpointS = Math.min(fork.endS - 1.2, fork.commitS + 0.9);
      const checkpointPos = this.forkRoutePoint(fork, fork.selected, checkpointS);
      checkpointPos.y += 0.025;
      const ahead = this.forkRoutePoint(fork, fork.selected, checkpointS + 0.45);
      const yaw = Math.atan2(-(ahead.x - checkpointPos.x), -(ahead.z - checkpointPos.z));
      this.game.checkpoint('forest', { pos: checkpointPos, yaw, pitch: 0 });
      fork.checkpoint = { s: checkpointS, pos: checkpointPos.clone(), yaw, pitch: 0 };
    }
    return fork.selected;
  }

  _resetFork(fork) {
    fork.selected = null;
    fork.previewSide = fork.defaultSide;
    fork.committedAt = null;
    this._setForkClosures(fork, false);
    this.game.flags.delete(`forestFork:${fork.id}:left`);
    this.game.flags.delete(`forestFork:${fork.id}:right`);
    if (fork.closures) {
      for (const row of fork.closures.rows) {
        row.t = 0;
        for (const collider of row.colliders) {
          collider.max.y = collider.min.y;
          collider.forkClosureActive = false;
        }
      }
    }
  }

  _restoreForksForSeat(s, lat = 0) {
    for (const fork of this.forks) {
      // A checkpoint behind the mouth must never wake behind our own fixed
      // parent wall. Inside the six-metre trial, both branches are restored.
      if (s <= fork.startS + 0.75 || (s < fork.commitS && s <= fork.endS)) {
        this._resetFork(fork);
        if (s > fork.startS + 0.75 && Math.abs(lat) > 0.35) fork.previewSide = lat < 0 ? -1 : 1;
        continue;
      }
      if (s < fork.endS - 0.35 && !fork.selected) {
        this._commitFork(fork, Math.abs(lat) > 0.35 ? Math.sign(lat) : fork.defaultSide, s, { restore: true });
      } else if (fork.selected) {
        this._setForkClosures(fork, true);
      }
    }
  }

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
    this._restoreForksForSeat(s, pr?.lat || 0);
    this.sealS = Math.max(-SEAL_TRAIL, s - SEAL_TRAIL);
    this.entered = s > 2;
    this._mireDepth = 0;
    this._mireAudioT = 0;
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
    const fork = this.forkAtS(s);
    const side = fork ? (fork.selected || fork.previewSide || fork.defaultSide) : 0;
    const pos = fork ? this.forkRoutePoint(fork, side, s) : this.posAt(s, 0);
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
    // The lateral tolerance is the corridor's own width at this s, not a
    // fixed 0.35. That constant dated from when the ravine rope skimmed the
    // player along the centreline; with a pivot high enough to actually lift
    // (see the ravine anchor), a legitimate landing can be a metre or more
    // off-centre on ground the player can stand on — and snapping such a
    // checkpoint to the pad broke exact-restore. Where the corridor is
    // narrow this still clamps exactly as before.
    const latIdx = clamp(Math.round(requestedS), 0, this.length - 1);
    const latLimit = Math.max(0.35, (this.halfW[latIdx] ?? 0.8) - 0.45);
    const exactPoseIsSafe = originalPr
      && Math.abs(originalPr.lat) <= latLimit
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
      // What looked like an unloaded map edge is now a real forest mire. Its
      // rendered skin is walkable ground; postClamp owns the gradual sinking
      // state so look, movement, throw, recall, and the rope all stay live.
      const d = Math.abs(pr.s - this.ravineS());
      return lerp(-0.16, 0, smoothstep(1.9, 3.2, d));
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
    const warmAnswerHitEdge = best === from || best === to;
    // An edge winner means the true nearest sample may be just outside this
    // window even when it is physically close (the authored path has bends).
    // Scan the short 210m spine once instead of silently quantising progress to
    // the warm boundary; that is especially important at a fork mouth.
    if (bestD > 40 * 40 || warmAnswerHitEdge) {
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
    const player = this.game.player;
    const mireDistance = Math.abs(pr.s - this.ravineS());
    const inMire = mireDistance < 3.08 && !player.swing;
    this._inMire = inMire;
    this._mireDepth = this._mireDepth || 0;
    this._mireAudioT = Math.max(0, (this._mireAudioT || 0) - dt);
    if (inMire) {
      const suction = 1 - smoothstep(1.7, 3.08, mireDistance);
      this._mireDepth = Math.min(1.72,
        this._mireDepth + dt * (0.22 + suction * 0.92 + this._mireDepth * 0.17));
      // Thickening drag still leaves a positive response to every movement
      // input. Throw/recall remain untouched, and taking the rope clears this
      // branch entirely because beginSwing is the authored rescue.
      player.vel.multiplyScalar(Math.exp(-dt * (2.4 + suction * 3.2 + this._mireDepth * 1.1)));
      const mudY = this.heightAt(pos.x, pos.z);
      pos.y = mudY - this._mireDepth;
      player.fallV = 0;
      player.grounded = true;
      if (this._mireAudioT <= 0) {
        this._mireAudioT = 0.72 - suction * 0.24;
        this.game.audio.thud({ pos, gain: 0.16 + suction * 0.12, rate: 0.48 + (1 - suction) * 0.12 });
        this.game.shake(0.018 + this._mireDepth * 0.012);
      }
      if (this._mireDepth >= 1.48 && !this.game.dead) this.game.director.death(null);
    } else {
      this._mireDepth = Math.max(0, this._mireDepth - dt * (player.swing ? 3.6 : 2.15));
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
    const fork = this.forkAtS(pr.s);
    if (fork) {
      const offset = this.forkRouteOffset(fork, pr.s);
      if (!fork.selected && Math.abs(pr.lat) > 0.35) fork.previewSide = pr.lat < 0 ? -1 : 1;

      // Crossing the line on a real route is the commitment. Merely standing
      // at its mouth, aiming down it, or exploring the first 5.99 metres cannot
      // close anything behind the player.
      if (!fork.selected && pr.s >= fork.commitS && pr.s < fork.endS - 0.7) {
        const candidate = Math.abs(pr.lat) > 0.35 ? (pr.lat < 0 ? -1 : 1) : fork.previewSide;
        const routeLat = candidate * offset;
        if (Math.abs(pr.lat - routeLat) <= fork.routeWidth + 0.7) {
          this._commitFork(fork, candidate, pr.s);
        }
      }

      const sides = fork.selected ? [fork.selected] : [-1, 1];
      const intervals = sides.map((side) => ({
        side,
        min: side * offset - fork.routeWidth,
        max: side * offset + fork.routeWidth,
      }));
      let chosen = intervals[0];
      if (intervals.length === 2) {
        const overlap = intervals[0].max >= intervals[1].min && intervals[1].max >= intervals[0].min;
        if (overlap) {
          chosen = {
            side: fork.previewSide,
            min: Math.min(intervals[0].min, intervals[1].min),
            max: Math.max(intervals[0].max, intervals[1].max),
          };
        } else {
          const distanceTo = (span) => pr.lat < span.min ? span.min - pr.lat
            : pr.lat > span.max ? pr.lat - span.max : 0;
          chosen = distanceTo(intervals[1]) < distanceTo(intervals[0]) ? intervals[1] : intervals[0];
        }
      }
      fork.activeSide = chosen.side;
      minLat = chosen.min;
      maxLat = chosen.max;
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
    // A lateral route offset on a tight bend can shift the nearest centreline
    // foot by a few tenths after the first reconstruction. Resolve that new
    // foot once more against the chosen ribbon so its physical envelope and
    // rendered edge agree on both the inside and outside of the bend.
    if (fork) {
      const routed = this.project(pos.x, pos.z);
      if (routed) {
        const routeSide = fork.selected || fork.activeSide || fork.previewSide;
        const routeCentre = routeSide * this.forkRouteOffset(fork, routed.s);
        const routeLat = clamp(routed.lat,
          routeCentre - fork.routeWidth, routeCentre + fork.routeWidth);
        if (Math.abs(routeLat - routed.lat) > 1e-4) {
          const routedAlong = (pos.x - routed.fx) * routed.sample.tx
            + (pos.z - routed.fz) * routed.sample.tz;
          pos.x = routed.fx + -routed.sample.tz * routeLat + routed.sample.tx * routedAlong;
          pos.z = routed.fz + routed.sample.tx * routeLat + routed.sample.tz * routedAlong;
        }
      }
    }
    // frontier chases; lingering makes it creep — the creaks ask you to turn
    if (this.entered && !this._inMire) {
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
    // The chain's flight envelope: no centreline canopy and no cross-branches
    // near a knot — a 7 m pivot swing needs the air above the road. The RNG is
    // still consumed exactly as before and only the RESULT is discarded, so
    // every other tree in the forest stays where it has always been.
    const chainS = this.chain ? [this.chain.seedS, ...this.chain.knotS] : [];
    const nearChain = (i) => chainS.some((s) => Math.abs(i - s) < 3);
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
        const blob = {
          x: p.x, y: rng.range(8.0, 10.3), z: p.z,
          sc: rng.range(1.05, 1.62), tint: rng.range(0.65, 0.94),
        };
        // a 1.62-scale blob at y 8.0 has a lower edge near 6.4 m — it would
        // swallow a 7.0 m chain knot. rng fully consumed above; only the push
        // is withheld.
        if (!nearChain(i)) canopies.push(blob);
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
        // the player passes through 2.9-4.3 m at the bottom of every chain
        // arc; a knit branch there is a clothesline. rng consumed as before.
        if (!nearChain(i)) branches.push({ a: av, b: mid }, { a: mid, b: bv });
      }
    }
    // shrub walls line the corridor — the surfaces you actually walk between.
    // Use the UNPINCHED width so foliage never presses against the lens.
    const shoulderLandmarks = [
      21, this.ravineS() - 13, this.ravineS() + 18,
      this.arenaS(), this.length - 11,
      ...this.secretPockets.map((pocket) => pocket.centerS),
      // the chain's support trunks each get the same silhouette slot every
      // authored landmark gets — a knot buried in shrub cards is no road sign
      ...chainS,
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
    // The old ravine was literally an absent ribbon with a black plane six
    // metres below it. From first person it read as falling out of the map.
    // Give the exact same rope-or-die beat a visible body: a skin of sucking
    // peat, edge reeds, breath rings, and one half-swallowed chair.
    const mireS = this.ravineS();
    const mirePos = [];
    for (const s of [mireS - 3.25, mireS + 3.25]) {
      const i = clamp(Math.round(s), 0, this.length - 1);
      const width = this.halfW[i] + 1.05;
      for (const lat of [-width, width]) {
        const vtx = this.posAt(s, lat);
        mirePos.push(vtx.x, -0.075, vtx.z);
      }
    }
    const mireGeo = new THREE.BufferGeometry();
    mireGeo.setAttribute('position', new THREE.Float32BufferAttribute(mirePos, 3));
    mireGeo.setIndex([0, 2, 1, 1, 2, 3]);
    mireGeo.computeVertexNormals();
    const mireMat = new THREE.MeshStandardMaterial({
      color: 0x17120d, roughness: 0.24, metalness: 0.18,
      transparent: true, opacity: 0.96, side: THREE.DoubleSide,
    });
    const mire = new THREE.Mesh(mireGeo, mireMat);
    mire.name = 'sucking forest mire';
    mire.receiveShadow = true;
    scene.add(mire);

    const reedCount = 24;
    const reedMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.018, 0.032, 1, 4),
      new THREE.MeshLambertMaterial({ color: 0x514b2d }), reedCount,
    );
    reedMesh.name = 'mire edge reeds';
    const reedMatrix = new THREE.Matrix4();
    const reedQuat = new THREE.Quaternion();
    const reedEuler = new THREE.Euler();
    const reedPosition = new THREE.Vector3();
    const reedSize = new THREE.Vector3();
    for (let i = 0; i < reedCount; i++) {
      const side = (i & 1) ? -1 : 1;
      const s = mireS - 3 + (i / (reedCount - 1)) * 6;
      const si = clamp(Math.round(s), 0, this.length - 1);
      const lat = side * (this.halfW[si] - 0.15 - ((i * 17) % 5) * 0.11);
      const vtx = this.posAt(s, lat);
      const h = 0.55 + ((i * 13) % 7) * 0.12;
      reedQuat.setFromEuler(reedEuler.set(side * 0.08, i * 0.93, (i % 3 - 1) * 0.12));
      reedMatrix.compose(reedPosition.set(vtx.x, -0.08 + h * 0.5, vtx.z), reedQuat,
        reedSize.set(1, h, 1));
      reedMesh.setMatrixAt(i, reedMatrix);
    }
    reedMesh.instanceMatrix.needsUpdate = true;
    scene.add(reedMesh);

    const ringCount = 7;
    const ringMesh = new THREE.InstancedMesh(
      new THREE.TorusGeometry(1, 0.025, 4, 16),
      new THREE.MeshBasicMaterial({ color: 0x75664a, transparent: true, opacity: 0.42 }), ringCount,
    );
    ringMesh.name = 'mire suction rings';
    const ringQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    for (let i = 0; i < ringCount; i++) {
      const s = mireS - 2.35 + i * 0.72;
      const vtx = this.posAt(s, ((i * 5) % 4 - 1.5) * 0.48);
      const r = 0.14 + (i % 3) * 0.07;
      reedMatrix.compose(reedPosition.set(vtx.x, -0.055, vtx.z), ringQ, reedSize.set(r, r, r));
      ringMesh.setMatrixAt(i, reedMatrix);
    }
    ringMesh.instanceMatrix.needsUpdate = true;
    scene.add(ringMesh);

    const chair = new THREE.Group();
    chair.name = 'half-swallowed mire chair';
    const addChairBox = (w, h, d, x, y, z, rx = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.bark);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      chair.add(mesh);
    };
    addChairBox(0.72, 0.10, 0.68, 0, 0.11, 0, -0.15);
    addChairBox(0.08, 1.15, 0.08, -0.29, 0.64, 0.26, -0.22);
    addChairBox(0.08, 1.15, 0.08, 0.29, 0.64, 0.26, -0.22);
    addChairBox(0.66, 0.08, 0.08, 0, 0.98, 0.37, -0.22);
    const chairAt = this.posAt(mireS + 0.45, this.halfW[Math.round(mireS)] * 0.47);
    chair.position.set(chairAt.x, -0.42, chairAt.z);
    chair.rotation.set(-0.33, Math.atan2(this.samples[Math.round(mireS)].tx,
      this.samples[Math.round(mireS)].tz) + 0.48, 0.18);
    scene.add(batchStaticGroup(chair, 'mire chair'));
    this.mire = { mesh: mire, reeds: reedMesh, rings: ringMesh, chair };
  }

  _buildForkTopology() {
    const { world, scene, mats: M } = this.game;
    const routePositions = [];
    const routeIndices = [];
    const scarPositions = [];
    const scarIndices = [];
    const routePoint = new THREE.Vector3();
    const before = new THREE.Vector3();
    const after = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const across = new THREE.Vector3();
    const pushRibbon = (positions, indices, fork, side, fromS, toS, halfWidth, step = 0.72) => {
      let previous = -1;
      for (let s = fromS; s <= toS + 1e-4; s = Math.min(toS, s + step)) {
        if (side) routePoint.copy(this.forkRoutePoint(fork, side, s));
        else routePoint.copy(this.posAt(s, 0)).setY(this.heightAt(routePoint.x, routePoint.z));
        before.copy(side ? this.forkRoutePoint(fork, side, Math.max(fromS, s - 0.22))
          : this.posAt(Math.max(fromS, s - 0.22), 0));
        after.copy(side ? this.forkRoutePoint(fork, side, Math.min(toS, s + 0.22))
          : this.posAt(Math.min(toS, s + 0.22), 0));
        tangent.subVectors(after, before).setY(0).normalize();
        across.set(-tangent.z, 0, tangent.x);
        const index = positions.length / 3;
        positions.push(
          routePoint.x - across.x * halfWidth, routePoint.y + (side ? 0.055 : 0.048), routePoint.z - across.z * halfWidth,
          routePoint.x + across.x * halfWidth, routePoint.y + (side ? 0.055 : 0.048), routePoint.z + across.z * halfWidth,
        );
        if (previous >= 0) indices.push(previous, index, previous + 1, previous + 1, index, index + 1);
        previous = index;
        if (s >= toS - 1e-4) break;
      }
    };

    for (const fork of this.forks) {
      pushRibbon(routePositions, routeIndices, fork, -1, fork.startS, fork.endS, fork.routeWidth + 0.13);
      pushRibbon(routePositions, routeIndices, fork, 1, fork.startS, fork.endS, fork.routeWidth + 0.13);
      // Cover the obsolete bright centre stripe once the paths have visibly
      // divided. This is dirt, not a magic black patch; the knitted divider
      // rising through it supplies the actual silhouette and collision.
      pushRibbon(scarPositions, scarIndices, fork, 0, fork.startS + 2.1, fork.endS - 2.1, 1.16, 0.8);
    }
    const makeRibbon = (positions, indices, material, name) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const routeMat = M.dirt.clone();
    // The fork must be readable as two routes before the player is nose-first
    // against its physical divider. Carry the choice by ground value and
    // silhouette, never by a coloured magic stripe.
    routeMat.color.setHex(0x9a8a70);
    if ('emissive' in routeMat) {
      routeMat.emissive = new THREE.Color(0x17140f);
      routeMat.emissiveIntensity = 0.16;
    }
    routeMat.roughness = 1;
    const scarMat = M.dirt.clone();
    scarMat.color.setHex(0x191b13);
    scarMat.roughness = 1;
    this.forkRouteMesh = makeRibbon(routePositions, routeIndices, routeMat, 'two authored braided forest routes');
    this.forkScarMesh = makeRibbon(scarPositions, scarIndices, scarMat, 'dark earth beneath fork dividers');

    // The divider is one fixed instance pool. It gives the lateral clamp a
    // visible body and makes a committed route feel like somewhere the player
    // actually walked, not a coordinate branch in a script.
    const dividerData = [];
    for (const fork of this.forks) {
      let index = 0;
      for (let s = fork.startS + 3.2; s <= fork.endS - 3.2; s += 1.12) {
        const p = this.posAt(s, ((index % 3) - 1) * 0.22);
        p.y = this.heightAt(p.x, p.z);
        dividerData.push({
          p,
          h: 2.2 + ((index * 7 + fork.startS) % 9) * 0.19,
          lean: ((index % 5) - 2) * 0.045,
          yaw: index * 1.73 + fork.startS,
        });
        const sm = this.samples[clamp(Math.round(s), 0, this.length - 1)];
        const hx = Math.abs(sm.tx) * 0.38 + Math.abs(sm.tz) * 0.48;
        const hz = Math.abs(sm.tz) * 0.38 + Math.abs(sm.tx) * 0.48;
        world.addCollider(p.x - hx, -0.25, p.z - hz, p.x + hx, 2.65, p.z + hz, {
          skullPass: true, forkDivider: fork.id,
        });
        index++;
      }
    }
    const dividerMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.34, 1, 6), M.bark, dividerData.length,
    );
    dividerMesh.name = 'physical braided-route divider trees';
    dividerMesh.castShadow = true;
    dividerMesh.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    for (let i = 0; i < dividerData.length; i++) {
      const data = dividerData[i];
      quat.setFromEuler(euler.set(data.lean, data.yaw, -data.lean * 0.7));
      matrix.compose(routePoint.set(data.p.x, data.p.y + data.h * 0.5, data.p.z), quat,
        scale.set(1, data.h, 1));
      dividerMesh.setMatrixAt(i, matrix);
    }
    dividerMesh.instanceMatrix.needsUpdate = true;
    scene.add(dividerMesh);
    this.forkDividerMesh = dividerMesh;

    // Three potential closure rows per fork share one visual pool. Only two
    // rise after commitment: the parent path and the route not chosen.
    const closureEntries = [];
    const addClosureRow = (fork, kind, side, s, width) => {
      const centre = side ? this.forkRoutePoint(fork, side, s) : this.posAt(s, 0);
      centre.y = this.heightAt(centre.x, centre.z);
      const a = side ? this.forkRoutePoint(fork, side, Math.max(fork.startS, s - 0.28))
        : this.posAt(Math.max(0, s - 0.28), 0);
      const b = side ? this.forkRoutePoint(fork, side, Math.min(fork.endS, s + 0.28))
        : this.posAt(Math.min(this.length - 1, s + 0.28), 0);
      tangent.subVectors(b, a).setY(0).normalize();
      across.set(-tangent.z, 0, tangent.x);
      const row = { kind, side, s, centre: centre.clone(), width, t: 0, target: 0, colliders: [], entries: [] };
      for (let k = 0; k < 10; k++) {
        const lateral = lerp(-width * 0.5, width * 0.5, k / 9) + ((k % 3) - 1) * 0.08;
        const h = 2.9 + ((k * 7 + fork.startS) % 8) * 0.24;
        const entry = {
          row,
          p: centre.clone().addScaledVector(across, lateral).addScaledVector(tangent, ((k % 2) - 0.5) * 0.32),
          h,
          yaw: k * 1.27 + side * 0.43,
          delay: (k % 4) * 0.08,
        };
        row.entries.push(entry);
        closureEntries.push(entry);
      }
      const segments = 5;
      for (let k = 0; k < segments; k++) {
        const lateral = lerp(-width * 0.42, width * 0.42, k / (segments - 1));
        const c = centre.clone().addScaledVector(across, lateral);
        const halfAcross = width / segments * 0.62;
        const hx = Math.abs(across.x) * halfAcross + Math.abs(tangent.x) * 0.34;
        const hz = Math.abs(across.z) * halfAcross + Math.abs(tangent.z) * 0.34;
        const collider = world.addCollider(c.x - hx, -0.22, c.z - hz, c.x + hx, -0.22, c.z + hz, {
          forkClosure: fork.id,
          forkClosureKind: kind,
          forkClosureSide: side,
          forkClosureActive: false,
        });
        collider.forkClosedMaxY = 3.2;
        row.colliders.push(collider);
      }
      return row;
    };

    for (const fork of this.forks) {
      const parentWidth = this.baseHalfW[clamp(Math.round(fork.startS), 0, this.length - 1)] * 2 + 1.05;
      const rows = [
        addClosureRow(fork, 'parent', 0, fork.startS - 0.45, parentWidth),
        addClosureRow(fork, 'mouth', -1, fork.startS + 2.8, fork.routeWidth * 2 + 0.85),
        addClosureRow(fork, 'mouth', 1, fork.startS + 2.8, fork.routeWidth * 2 + 0.85),
      ];
      fork.closures = { rows };
    }
    const closureMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.16, 0.3, 1, 6), M.bark, closureEntries.length,
    );
    closureMesh.name = 'bounded fork knitting pool';
    closureMesh.castShadow = true;
    closureMesh.receiveShadow = true;
    closureMesh.frustumCulled = false;
    scene.add(closureMesh);
    this.forkClosureMesh = closureMesh;
    this.forkClosureEntries = closureEntries;
    this.forkTopologyStats = {
      forks: this.forks.length,
      routeVertices: routePositions.length / 3,
      dividerInstances: dividerData.length,
      closureCapacity: closureEntries.length,
      commitDistance: 6,
    };
    this._writeForkClosures(0);
  }

  _writeForkClosures(dt) {
    if (!this.forkClosureMesh) return;
    let dirty = !this._forkClosuresWritten;
    const matrix = this._forkClosureMatrix || (this._forkClosureMatrix = new THREE.Matrix4());
    const quat = this._forkClosureQuat || (this._forkClosureQuat = new THREE.Quaternion());
    const euler = this._forkClosureEuler || (this._forkClosureEuler = new THREE.Euler());
    const pos = this._forkClosurePosition || (this._forkClosurePosition = new THREE.Vector3());
    const scale = this._forkClosureScale || (this._forkClosureScale = new THREE.Vector3());
    for (const fork of this.forks) {
      if (!fork.closures) continue;
      for (const row of fork.closures.rows) {
        const previousT = row.t;
        const targetChanged = row._writtenTarget !== row.target;
        row.t += (row.target - row.t) * Math.min(1, dt * (row.target ? 4.1 : 7.5));
        if (Math.abs(row.target - row.t) < 0.0001) row.t = row.target;
        const rowDirty = !this._forkClosuresWritten || targetChanged
          || Math.abs(row.t - previousT) > 0.000001;
        row._writtenTarget = row.target;
        if (!rowDirty) continue;
        dirty = true;
        // Collision grows out of the dirt with the trunks. There is never a
        // chest-high invisible wall while the corresponding row is still
        // underground, and a reset removes both in the same authored frame.
        const visibleBody = smoothstep(0, 1, row.t);
        const physicalRise = clamp((visibleBody - 0.02) / 0.98, 0, 1);
        for (const collider of row.colliders) {
          collider.max.y = collider.min.y
            + (collider.forkClosedMaxY - collider.min.y) * physicalRise;
          collider.forkClosureActive = row.target > 0 && physicalRise > 0.035;
        }
      }
    }
    // A converged closure is static scenery. Avoid rebuilding and uploading
    // all 60 instance matrices at 120 Hz after its last visible movement.
    if (!dirty) return;
    for (let i = 0; i < this.forkClosureEntries.length; i++) {
      const entry = this.forkClosureEntries[i];
      const rise = smoothstep(0, 1, clamp((entry.row.t - entry.delay) / (1 - entry.delay), 0, 1));
      quat.setFromEuler(euler.set((i % 3 - 1) * 0.035 * rise, entry.yaw, (i % 4 - 1.5) * 0.035 * rise));
      pos.set(entry.p.x, entry.p.y - entry.h * 0.52 + entry.h * rise, entry.p.z);
      matrix.compose(pos, quat, scale.set(1, entry.h, 1));
      this.forkClosureMesh.setMatrixAt(i, matrix);
    }
    this.forkClosureMesh.instanceMatrix.needsUpdate = true;
    this._forkClosuresWritten = true;
  }

  // THE CHAIN — five reusable centreline knots plus the seed link. Same art
  // vocabulary as the optional-rope pockets (support trunk, bough, dropped
  // line, pale knot), but on the road rather than beside it: off-line knots
  // are secrets, on-line knots are the route. Everything static bakes into
  // three InstancedMeshes (bark, rope, knots) so six anchors cost three draw
  // calls, not twenty-five.
  _buildChain() {
    const game = this.game;
    const { world, scene, mats: M, audio } = game;
    const up = new THREE.Vector3(0, 1, 0);
    const ropeMat = M.curtain.clone();
    if (ropeMat.color) ropeMat.color.multiplyScalar(1.48);
    const knotMat = M.headstone.clone();
    if (knotMat.color) knotMat.color.multiplyScalar(1.06);
    if ('emissive' in knotMat) {
      knotMat.emissive = new THREE.Color(0x394145);
      knotMat.emissiveIntensity = 0.38;
    }

    const segs = [];
    const seg = (a, b, radius, rope = false) => {
      const d = b.clone().sub(a);
      const len = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().divideScalar(len));
      segs.push({ p: a.clone().add(b).multiplyScalar(0.5), q, len, radius, rope });
    };
    const ground = (v) => { v.y = this.heightAt(v.x, v.z); return v; };

    const knots = [];
    const links = [];
    const addLink = (s, index) => {
      const i = clamp(Math.round(s), 0, this.length - 1);
      const pivot = ground(this.posAt(s, 0));
      pivot.y += this.chain.height;
      // support trunk at the corridor edge, alternating sides so the aisle
      // reads as a lane you pass through rather than a fence
      const side = index % 2 ? 1 : -1;
      const base = ground(this.posAt(s - 0.7, side * (this.halfW[i] - 0.45)));
      const top = base.clone().add(new THREE.Vector3(0, this.chain.height + 1.35, 0));
      seg(base, top, 0.27);
      seg(top, pivot.clone().add(new THREE.Vector3(0, 1.15, 0)), 0.12);
      // The dropped line and its bone-pale knot are the aiming surface. They
      // used to disappear into the canopy at ordinary mouse-look distance,
      // even though the generous physical target was already correct. Make
      // the authored object match that affordance; do not touch swing math or
      // the derived knot positions.
      seg(pivot.clone().add(new THREE.Vector3(0, 1.15, 0)), pivot, 0.042, true);
      knots.push(pivot.clone());

      const flag = `forestChain:${index}`;
      const target = world.addFetchTarget({
        id: `forestChain:${index}`, pos: pivot.clone(), radius: 0.92,
        onHit(skull) {
          // Same guard as the pocket knots: a fresh outbound throw latches,
          // a returning skull passes, and a live swing is never stolen.
          // The target NEVER retires — the chain is a road, not a set-piece.
          if (skull.mode !== 'outbound' || game.player.swing) return 'continue';
          skull.anchorAt(pivot, { swing: true, maxHold: 5.8 });
          game.player.beginSwing(pivot, { maxT: 5.8 });
          game.flag(`${flag}:latched`);
          if (audio?.creak) audio.creak({ pos: pivot, gain: 0.5, rate: 0.82 + index * 0.045 });
          // Once the current knot has answered, the next physical knot gives
          // one quiet directional complaint. It teaches the consecutive route
          // through the world and HRTF position, never through a HUD marker or
          // invisible aim correction.
          if (link?.nextPivot && game.after) {
            game.after(0.24, () => {
              if (!game.player.swing || game.act !== 'forest') return;
              audio?.creak?.({ pos: link.nextPivot, gain: 0.23, rate: 1.28 });
            });
          }
          return 'anchor';
        },
      });
      const link = { s, pivot: pivot.clone(), target, nextPivot: null };
      links.push(link);
    };

    addLink(this.chain.seedS, 5);          // the teacher: hands to the searchers-line pocket
    this.chain.knotS.forEach((s, k) => addLink(s, k));

    // The dropped lines bake apart from the bark so they can actually carry
    // the brightened rope material — baked into M.bark they rendered as more
    // canopy, which is the exact disappearance the seg comment above fixes.
    const barkSegs = segs.filter((it) => !it.rope);
    const ropeSegs = segs.filter((it) => it.rope);
    const wood = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1.08, 1, 7), M.bark, barkSegs.length);
    const mtx = new THREE.Matrix4();
    const sc = new THREE.Vector3();
    barkSegs.forEach((it, i) => {
      mtx.compose(it.p, it.q, sc.set(it.radius, it.len, it.radius));
      wood.setMatrixAt(i, mtx);
    });
    wood.instanceMatrix.needsUpdate = true;
    wood.castShadow = true;
    wood.receiveShadow = true;
    wood.name = 'chain supports and lines';
    scene.add(wood);

    const ropeMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1.08, 1, 5), ropeMat, ropeSegs.length);
    ropeSegs.forEach((it, i) => {
      mtx.compose(it.p, it.q, sc.set(it.radius, it.len, it.radius));
      ropeMesh.setMatrixAt(i, mtx);
    });
    ropeMesh.instanceMatrix.needsUpdate = true;
    ropeMesh.name = 'chain dropped lines';
    scene.add(ropeMesh);

    const knotGeo = new THREE.DodecahedronGeometry(0.19, 0);
    const knotMesh = new THREE.InstancedMesh(knotGeo, knotMat, knots.length);
    const kq = new THREE.Quaternion();
    knots.forEach((p, i) => {
      mtx.compose(p, kq, sc.set(1.0, 1.5, 1.0));
      knotMesh.setMatrixAt(i, mtx);
    });
    knotMesh.instanceMatrix.needsUpdate = true;
    knotMesh.name = 'chain pale knots';
    scene.add(knotMesh);

    // Link only the five consecutive road knots. The seed knot teaches the
    // verb into a side pocket and should not call across half the forest.
    for (let i = 1; i < links.length - 1; i++) links[i].nextPivot = links[i + 1].pivot;

    this.chainLinks = links;
  }

  _buildForestStoryProps() {
    const game = this.game;
    const { world, scene, mats: M } = game;
    const forkOne = this.forks[0];
    const forkTwo = this.forks[1];
    const searchers = this.optionalRopes?.find((line) => line.id === 'searchers-line');
    const bellCopse = this.optionalRopes?.find((line) => line.id === 'bell-line');
    const atRoute = (fork, side, s) => ({ p: this.forkRoutePoint(fork, side, s), forkId: fork.id, side, s });
    const atSpine = (s, lat) => ({ p: this.posAt(s, lat), forkId: null, side: 0, s });
    const anchors = [
      { id: 'radio-chair', kind: 'radio', ...atRoute(forkOne, -1, 57.2), gain: 0.22 },
      { id: 'stump-phone', kind: 'phone', ...atRoute(forkOne, 1, 57.6), gain: 0.2 },
      { id: 'searchers-swing', kind: 'swing', p: searchers?.secretPos.clone() || this.posAt(75, 4.5), forkId: null, side: 1, s: 75, gain: 0.21 },
      { id: 'ditch-crt', kind: 'crt', ...atSpine(91, -this.baseHalfW[91] * 0.62), gain: 0.17 },
      { id: 'washer', kind: 'washer', ...atRoute(forkTwo, -1, 128.2), gain: 0.22 },
      { id: 'refrigerator', kind: 'fridge', ...atRoute(forkTwo, 1, 129.4), gain: 0.17 },
      { id: 'arena-generator', kind: 'generator', ...atSpine(144.2, this.baseHalfW[144] * 0.56), gain: 0.2 },
      { id: 'copse-bell', kind: 'bell', p: bellCopse?.secretPos.clone() || this.posAt(181, -4.5), forkId: null, side: -1, s: 181, gain: 0.24 },
    ];

    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    const unitTorus = new THREE.TorusGeometry(0.5, 0.085, 6, 14);
    const unitCone = new THREE.ConeGeometry(0.44, 0.7, 8, 1, true);
    const props = [];
    const addMesh = (parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, rotation = null) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    for (let index = 0; index < anchors.length; index++) {
      const spec = anchors[index];
      const root = new THREE.Group();
      root.name = `forest story prop: ${spec.id}`;
      const ground = this.heightAt(spec.p.x, spec.p.z);
      root.position.set(spec.p.x, ground, spec.p.z);
      const sm = this.samples[clamp(Math.round(spec.s), 0, this.length - 1)];
      root.rotation.y = Math.atan2(sm.tx, sm.tz) + (index % 2 ? -0.34 : 0.27);
      const moving = new THREE.Group();
      moving.name = `${spec.id} powered motion`;
      moving.userData.noBatch = true;
      root.add(moving);
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0xaaa493,
        emissive: 0xd8cba8,
        emissiveIntensity: 0.62,
        roughness: 0.66,
        metalness: 0.08,
      });
      let targetY = 0.9;
      let colliderHalf = 0.62;
      let colliderTop = 1.75;

      if (spec.kind === 'radio') {
        // The chair is pointed away from the path. The radio occupies its seat
        // as if the listener stood up and never returned.
        addMesh(root, unitBox, M.woodDark, 0, 0.46, 0.12, 0.76, 0.1, 0.7);
        for (const x of [-0.3, 0.3]) for (const z of [-0.16, 0.39]) {
          addMesh(root, unitBox, M.woodDark, x, 0.23, z, 0.08, 0.48, 0.08, [z > 0 ? -0.12 : 0.08, 0, 0]);
        }
        addMesh(root, unitBox, M.woodDark, 0, 0.98, 0.43, 0.72, 0.88, 0.09, [-0.13, 0, 0]);
        addMesh(root, unitBox, M.metal, 0, 0.75, 0.02, 0.56, 0.34, 0.3);
        addMesh(root, unitBox, glowMat, 0, 0.77, -0.145, 0.31, 0.16, 0.018);
        const dial = addMesh(moving, unitCylinder, M.metal, 0.2, 0.73, -0.18, 0.13, 0.05, 0.13, [Math.PI / 2, 0, 0]);
        moving.userData.part = dial;
      } else if (spec.kind === 'phone') {
        addMesh(root, unitCylinder, M.bark, 0, 0.5, 0, 1.18, 1, 1.18);
        addMesh(root, unitBox, M.metal, 0, 1.08, 0, 0.58, 0.22, 0.42, [-0.08, 0, 0]);
        addMesh(root, unitCylinder, glowMat, 0, 1.2, -0.24, 0.21, 0.035, 0.21, [Math.PI / 2, 0, 0]);
        addMesh(moving, unitBox, M.woodDark, 0, 1.36, -0.03, 0.72, 0.1, 0.12);
        addMesh(moving, unitCylinder, M.woodDark, -0.34, 1.36, -0.03, 0.2, 0.18, 0.2, [0, 0, Math.PI / 2]);
        addMesh(moving, unitCylinder, M.woodDark, 0.34, 1.36, -0.03, 0.2, 0.18, 0.2, [0, 0, Math.PI / 2]);
        targetY = 1.25;
      } else if (spec.kind === 'swing') {
        colliderHalf = 1.12; colliderTop = 2.8; targetY = 1.45;
        for (const x of [-0.95, 0.95]) {
          addMesh(root, unitCylinder, M.bark, x, 1.35, 0, 0.14, 2.7, 0.14, [0, 0, x * 0.07]);
        }
        addMesh(root, unitCylinder, M.bark, 0, 2.68, 0, 0.14, 2.12, 0.14, [0, 0, Math.PI / 2]);
        addMesh(moving, unitCylinder, M.curtain, -0.31, 1.93, 0, 0.035, 1.42, 0.035);
        addMesh(moving, unitCylinder, M.curtain, 0.31, 1.93, 0, 0.035, 1.42, 0.035);
        addMesh(moving, unitBox, M.woodDark, 0, 1.22, 0, 0.78, 0.1, 0.34);
        moving.position.y = 1.46;
        moving.children.forEach((child) => { child.position.y -= 1.46; });
      } else if (spec.kind === 'washer') {
        addMesh(root, unitBox, M.metal, 0, 0.72, 0, 1.02, 1.42, 0.86, [0, 0, 0.035]);
        addMesh(root, unitTorus, M.metal, 0, 0.72, -0.46, 0.64, 0.64, 0.64, [Math.PI / 2, 0, 0]);
        addMesh(moving, unitCylinder, glowMat, 0, 0.72, -0.48, 0.48, 0.055, 0.48, [Math.PI / 2, 0, 0]);
        targetY = 0.78;
      } else if (spec.kind === 'fridge') {
        colliderHalf = 0.66; colliderTop = 2.25; targetY = 1.1;
        addMesh(root, unitBox, M.metal, 0, 1.08, 0, 1.08, 2.16, 0.82, [0, 0, -0.025]);
        addMesh(root, unitBox, M.woodDark, 0.38, 1.28, -0.44, 0.075, 0.72, 0.08);
        addMesh(root, unitBox, M.woodDark, 0, 1.53, -0.43, 0.96, 0.035, 0.06);
        addMesh(root, unitBox, glowMat, -0.34, 1.76, -0.44, 0.11, 0.05, 0.025);
        addMesh(moving, unitBox, M.metal, 0, 0.23, 0.46, 0.62, 0.28, 0.16);
      } else if (spec.kind === 'crt') {
        addMesh(root, unitBox, M.woodDark, 0, 0.72, 0, 0.92, 0.78, 0.76, [-0.04, 0.16, 0.02]);
        addMesh(root, unitBox, M.metal, 0, 0.23, 0, 0.64, 0.42, 0.52);
        addMesh(moving, unitBox, glowMat, 0, 0.75, -0.395, 0.66, 0.5, 0.025);
        addMesh(root, unitCylinder, M.metal, -0.18, 1.31, 0, 0.025, 0.64, 0.025, [0.18, 0, -0.35]);
        addMesh(root, unitCylinder, M.metal, 0.18, 1.31, 0, 0.025, 0.64, 0.025, [-0.18, 0, 0.35]);
      } else if (spec.kind === 'bell') {
        colliderHalf = 0.82; colliderTop = 2.2; targetY = 1.42;
        addMesh(root, unitCylinder, M.headstone, 0, 0.34, 0, 1.36, 0.68, 1.36);
        addMesh(root, unitCylinder, M.bark, -0.64, 1.22, 0, 0.12, 1.85, 0.12);
        addMesh(root, unitCylinder, M.bark, 0.64, 1.22, 0, 0.12, 1.85, 0.12);
        addMesh(root, unitCylinder, M.bark, 0, 2.1, 0, 0.12, 1.45, 0.12, [0, 0, Math.PI / 2]);
        addMesh(moving, unitCone, glowMat, 0, 1.68, 0, 0.58, 0.78, 0.58);
        moving.position.y = 2.03;
        moving.children.forEach((child) => { child.position.y -= 2.03; });
      } else {
        addMesh(root, unitBox, M.metal, 0, 0.58, 0, 1.18, 0.92, 0.78);
        addMesh(root, unitBox, M.woodDark, 0, 0.19, 0, 1.42, 0.12, 1.0);
        addMesh(root, unitBox, glowMat, -0.31, 0.83, -0.41, 0.26, 0.12, 0.03);
        addMesh(moving, unitTorus, M.metal, 0.62, 0.53, 0, 0.72, 0.72, 0.72, [0, Math.PI / 2, 0]);
      }

      batchStaticGroup(root, spec.id);
      scene.add(root);
      const collider = world.addCollider(
        root.position.x - colliderHalf, ground - 0.25, root.position.z - colliderHalf,
        root.position.x + colliderHalf, ground + colliderTop, root.position.z + colliderHalf,
        { skullPass: true, forestStoryProp: spec.id },
      );
      const targetPos = new THREE.Vector3(root.position.x, ground + targetY, root.position.z);
      const state = {
        ...spec,
        index,
        root,
        moving,
        glowMat,
        collider,
        targetPos,
        audibleRadius: 34,
        visibleReadRadius: 15,
        audibleBeforeVisible: true,
        silenced: false,
        visualLevel: 1,
        phase: index * 0.73,
        loop: null,
        target: null,
        stopLoop() {
          if (!this.loop) return;
          this.loop.stop();
          this.loop = null;
        },
        silence(at = this.targetPos) {
          if (this.silenced) return false;
          this.silenced = true;
          this.stopLoop();
          if (this.target) this.target.enabled = false;
          game.flag(`forestStorySilenced:${this.id}`);
          game.player.noise = 1;
          game.audio.forestStoryBreak?.(this.kind, { pos: this.targetPos, gain: 0.88, verb: 0.58 });
          game.audio.brushCrash({ pos: this.targetPos, gain: 0.42, rate: 0.63 });
          game.impact('hurt', at || this.targetPos);
          game.director?.forestNoise?.(this.targetPos, 1, 'appliance');
          return true;
        },
      };
      state.target = world.addFetchTarget({
        id: `forestStory:${state.id}`,
        pos: targetPos,
        radius: state.kind === 'swing' ? 1.05 : 0.88,
        onHit(skull, at) {
          state.silence(at);
          return 'return';
        },
      });
      props.push(state);
    }
    this.storyProps = props;
    this.storySoundStats = {
      propCount: props.length,
      continuousCap: 2,
      hrtf: true,
      deterministicAnchors: props.map((prop) => ({
        id: prop.id, kind: prop.kind, s: prop.s, x: prop.targetPos.x, y: prop.targetPos.y, z: prop.targetPos.z,
      })),
    };
  }

  _stopForestStoryLoops() {
    for (const prop of this.storyProps || []) prop.stopLoop();
  }

  _updateForestStoryProps(dt) {
    const props = this.storyProps;
    if (!props?.length) return;
    const game = this.game;
    const live = game.act === 'forest' && !game.dead && !game.terminal && !game.endingTail;
    const playerPos = game.player.pos;
    const candidates = [];
    for (const prop of props) {
      const fork = prop.forkId && this.forks.find((candidate) => candidate.id === prop.forkId);
      const wrongCommittedBranch = !!(fork?.selected && fork.selected !== prop.side);
      const behindSeal = prop.s <= this.sealS + 0.8;
      const canSpeak = live && !prop.silenced && !wrongCommittedBranch && !behindSeal;
      // A swept skull target obeys the same reachability law as its sound.
      // Otherwise a held throw could collect a dead appliance through the
      // newly knitted rejected mouth or from behind the cumulative seal.
      if (!prop.silenced && prop.target) prop.target.enabled = canSpeak;
      const targetVisual = canSpeak ? 1 : 0;
      prop.visualLevel += (targetVisual - prop.visualLevel) * Math.min(1, dt * (targetVisual ? 3.6 : 7.5));
      prop.glowMat.emissiveIntensity = 0.04 + prop.visualLevel * 0.58;
      prop.phase += dt * (0.7 + prop.index * 0.035);
      if (prop.kind === 'swing' || prop.kind === 'bell') {
        prop.moving.rotation.z = Math.sin(prop.phase * (prop.kind === 'bell' ? 1.9 : 1.1)) * 0.16 * prop.visualLevel;
      } else if (prop.kind === 'phone') {
        prop.moving.rotation.z = Math.sin(prop.phase * 18) * 0.018 * prop.visualLevel;
      } else if (prop.kind === 'fridge') {
        prop.moving.position.x = Math.sin(prop.phase * 25) * 0.012 * prop.visualLevel;
      } else if (prop.kind === 'crt') {
        const screen = prop.moving.children[0];
        if (screen) screen.scale.x = 0.66 * (0.985 + Math.sin(prop.phase * 31) * 0.015 * prop.visualLevel);
      } else {
        const part = prop.moving.children[0];
        if (part) part.rotation.z += dt * (1.1 + prop.index * 0.13) * prop.visualLevel;
      }

      if (!canSpeak) {
        prop.stopLoop();
        continue;
      }
      const distance = Math.hypot(
        playerPos.x - prop.targetPos.x,
        (playerPos.y + 1.2) - prop.targetPos.y,
        playerPos.z - prop.targetPos.z,
      );
      if (distance <= prop.audibleRadius) candidates.push({ prop, distance });
      else prop.stopLoop();
    }
    candidates.sort((a, b) => a.distance - b.distance || a.prop.index - b.prop.index);
    const desired = new Set(candidates.slice(0, 2).map((candidate) => candidate.prop));
    for (const prop of props) {
      if (!desired.has(prop)) prop.stopLoop();
    }
    if (!game.audio.ready) return;
    for (const { prop } of candidates.slice(0, 2)) {
      if (prop.loop) continue;
      prop.loop = game.audio.forestStoryLoop?.(prop.kind, prop.targetPos, {
        gain: prop.gain, ref: 8.5, roll: 1.12, verb: 0.38,
      }) || null;
    }
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

  syncBackDistrictCulling(force = null) {
    const act = this.game.act;
    const pastGate = force ?? (act === 'forest' || act === 'clearing'
      || act === 'cave' || act === 'mirror'
      || (act === 'graveyard' && !this.game.ossuary?.inOssuary
        && this.game.player.pos.z > FOREST_GATE.z - 0.45));
    if (pastGate === this.backDistrictCullActive) return;
    this.backDistrictCullActive = pastGate;
    if (pastGate) {
      this.backDistrictVisibility.clear();
      for (const root of this.backDistrictRoots) {
        if (root.parent !== this.game.scene) continue;
        this.backDistrictVisibility.set(root, root.visible);
        root.visible = false;
      }
      return;
    }
    for (const [root, visible] of this.backDistrictVisibility) {
      if (root.parent === this.game.scene) root.visible = visible;
    }
    this.backDistrictVisibility.clear();
  }

  update(dt) {
    this.syncBackDistrictCulling();
    // Preserve a composed view through the now-open graveyard gate without
    // rendering the entire 208m chapter from the house. The threshold is well
    // before the act boundary, so there is no visible pop while crossing it.
    const detailsVisible = this.game.act === 'forest'
      || (this.game.act === 'graveyard' && this.game.player.pos.z > 31.5);
    if (detailsVisible !== this._detailsVisible) {
      this._detailsVisible = detailsVisible;
      for (const root of this.detailRoots) {
        root.visible = detailsVisible && this._detailBaseVisibility.get(root) !== false;
      }
    }
    this._writeForkClosures(dt);
    this._updateForestStoryProps(dt);
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

    // THE EATEN PATH's best forest lesson is visual: a blocked route should
    // look knitted shut. Eighteen crossed branches make all three required
    // hits physically legible. Each strike tears away one silhouette/collision
    // layer instead of incrementing an invisible counter.
    const branchCount = 18;
    const branchGeo = new THREE.CylinderGeometry(0.075, 0.14, 1, 6);
    const branchMesh = new THREE.InstancedMesh(branchGeo, M.bark, branchCount);
    branchMesh.name = 'three-layer knitted fallen-tree branches';
    branchMesh.castShadow = true;
    branchMesh.frustumCulled = false;
    scene.add(branchMesh);
    const branchMtx = new THREE.Matrix4();
    const branchQ = new THREE.Quaternion();
    const branchPos = new THREE.Vector3();
    const branchScale = new THREE.Vector3();
    const branchDir = new THREE.Vector3();
    const branchUp = new THREE.Vector3(0, 1, 0);
    const branchPush = new THREE.Vector3(fsm.tx, 0, fsm.tz);
    const branchLayerColliders = [[], [], []];
    const branchLayers = [0, 0, 0];
    const branchData = [];
    for (let i = 0; i < branchCount; i++) {
      const layer = Math.floor(i / 6);
      const k = i % 6;
      const u = -3.0 + k * 1.18 + (layer - 1) * 0.13;
      const side = ((k + layer) & 1) ? -1 : 1;
      const length = 2.0 + ((k * 7 + layer * 3) % 4) * 0.26;
      const root = new THREE.Vector3(
        fsm.x + px * u,
        0.12 + layer * 0.42,
        fsm.z + pz * u,
      );
      const dir = new THREE.Vector3(
        fsm.tx * side * (0.72 + layer * 0.1) + px * ((k - 2.5) * 0.07),
        0.42 + ((k + layer) % 3) * 0.16,
        fsm.tz * side * (0.72 + layer * 0.1) + pz * ((k - 2.5) * 0.07),
      ).normalize();
      branchData.push({ layer, root, dir, length, phase: k * 0.37 + layer * 0.91 });

      // The skull can cross these low branch volumes to hit the obstruction;
      // the player's capsule cannot pretend the visible brush is empty.
      if (layer < 2) {
        const mid = root.clone().addScaledVector(dir, length * 0.42);
        const hxB = Math.abs(dir.x) * length * 0.43 + 0.13;
        const hzB = Math.abs(dir.z) * length * 0.43 + 0.13;
        const c = world.addCollider(
          mid.x - hxB, 0, mid.z - hzB,
          mid.x + hxB, Math.max(0.88, mid.y + Math.abs(dir.y) * length * 0.5), mid.z + hzB,
          { skullPass: true, fallenTreeLayer: layer },
        );
        branchLayerColliders[layer].push(c);
      }
    }
    const writeBranches = (dt = 0) => {
      if (dt > 0) {
        for (let layer = 0; layer < branchLayers.length; layer++) {
          if (branchLayers[layer] > 0) {
            branchLayers[layer] = Math.min(1, branchLayers[layer] + dt * 2.25);
          }
        }
      }
      for (let i = 0; i < branchData.length; i++) {
        const data = branchData[i];
        const t = smoothstep(0, 1, branchLayers[data.layer]);
        branchDir.copy(data.dir);
        if (t > 0) {
          branchDir.x += fsm.tx * (data.layer === 1 ? -0.7 : 0.55) * t;
          branchDir.z += fsm.tz * (data.layer === 1 ? -0.7 : 0.55) * t;
          branchDir.y -= 1.5 * t;
          branchDir.normalize();
        }
        branchPos.copy(data.root)
          .addScaledVector(data.dir, data.length * 0.5)
          .addScaledVector(branchPush, Math.sin(data.phase) * t * 0.7);
        branchPos.y -= t * (0.75 + data.layer * 0.32);
        branchQ.setFromUnitVectors(branchUp, branchDir);
        branchMtx.compose(branchPos, branchQ, branchScale.set(1, data.length, 1));
        branchMesh.setMatrixAt(i, branchMtx);
      }
      branchMesh.instanceMatrix.needsUpdate = true;
    };
    writeBranches();
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
    const roll = {
      t: 1, from: 0, to: 0, dropFrom: 0, dropTo: 0, shove: 0,
      side: 0, sideFrom: 0, sideTo: 0, clearPending: false, collidersCleared: false,
      rootT: 1, rootFrom: 0, rootTo: 0,
    };
    game.tickers.push((dt) => {
      writeBranches(dt);
      if (roll.rootT < 1) {
        roll.rootT = Math.min(1, roll.rootT + dt * 2.0);
        const r = smoothstep(0, 1, roll.rootT);
        const tear = lerp(roll.rootFrom, roll.rootTo, r);
        roots.rotation.z = tear * 0.62;
        roots.position.y = 0.1 - tear * 0.45;
        roots.scale.set(0.55 + tear * 0.16, 1 - tear * 0.35, 1 + tear * 0.08);
      }
      if (roll.t < 1) {
        roll.t = Math.min(1, roll.t + dt * 2.6);
        const e = 1 - (1 - roll.t) * (1 - roll.t) * (1 - roll.t);     // it settles, it doesn't snap
        log.rotation.x = lerp(roll.from, roll.to, e);
        log.position.y = lerp(roll.dropFrom, roll.dropTo, e);
        roll.side = lerp(roll.sideFrom, roll.sideTo, e);
        const side = roll.side + Math.sin(roll.t * Math.PI) * roll.shove;
        log.position.x = fsm.x + px * side;
        log.position.z = fsm.z + pz * side;
        if (roll.clearPending && !roll.collidersCleared && Math.abs(roll.side) >= 4.95) {
          roll.collidersCleared = true;
          for (const c of logCols) c.max.y = c.min.y;
          game.flag('treeCleared');
        }
      }
    });
    const fallenTreeTarget = world.addFetchTarget({
      id: 'fallenTree', object: log, radius: 2.55,
      onHit(skull, at) {
        if (skull.mode !== 'outbound') return 'continue';
        logHits++;
        const layer = Math.min(2, logHits - 1);
        branchLayers[layer] = Math.max(branchLayers[layer], 0.001);
        for (const c of branchLayerColliders[layer]) c.max.y = c.min.y;
        game.impact('hurt', at);
        audio.pop({ pos: log.position, gain: 0.32, rate: 0.7 });
        audio.creak({ pos: log.position, gain: 0.45, rate: 0.8 });   // wood complaining
        roll.from = log.rotation.x;
        roll.to = log.rotation.x + 0.55;                             // it ROLLS, visibly
        roll.dropFrom = log.position.y;
        roll.dropTo = Math.max(0.3, log.position.y - 0.14);
        roll.sideFrom = roll.side;
        roll.sideTo = roll.side;
        roll.shove = 0.16;
        roll.t = 0;
        if (logHits === 2) {
          roll.rootFrom = roll.rootTo;
          roll.rootTo = 1;
          roll.rootT = 0;
          audio.brushCrash({ pos: roots.getWorldPosition(new THREE.Vector3()), gain: 0.46, rate: 0.72 });
        }
        if (logHits >= 3) {
          this.enabled = false;
          roll.dropTo = 0.34;
          roll.to = log.rotation.x + 1.35;                           // the last one rolls it clear
          // The torn root mass drags the bole lengthwise into the shoulder.
          // Collision remains until its nearest visible end has actually
          // cleared the capsule-wide route; there is never a walk-through log.
          roll.sideTo = 5.65;
          roll.clearPending = true;
          audio.brushCrash({ pos: log.position, gain: 0.7 });
        }
        return 'return';
      },
    });
    game.fallenTreeSetpiece = {
      log, bole, roots, branches: branchMesh, target: fallenTreeTarget,
      colliders: logCols, roll, center: new THREE.Vector3(fsm.x, LOG_R, fsm.z),
      get hits() { return logHits; },
    };

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
        if (skull.mode !== 'outbound') return 'continue';
        // A bad release cannot spend the only crossing. The director disables
        // the target only once the player is grounded on the far side.
        if (game.player.swing) return 'return';
        // The pivot sits ABOVE THE FAR-SIDE LANDING, not on the rope itself.
        // Anchoring on the rope pulls you into the lip of the gash; anchoring
        // over the ground beyond it means holding carries you up and across,
        // and letting go drops you where the old scripted launch used to put
        // you — same destination, except now you fly there under your own arc.
        //
        // Height 6.9, not 3.4, and the reason is arithmetic: the rope can only
        // LIFT while the line to the pivot is steeper than asin(GRAV/PULL) =
        // asin(14/30) = 27.8°. From the near lip, 3.4 m of rise over 7-11 m of
        // run is 17-26° — always below threshold — so a player who held on
        // skimmed at ankle height (measured: max rise 0.83 m over the whole
        // arc) and was then pendulum-hauled BACKWARDS across the gash they had
        // just crossed. At 6.9 m the latch line starts at 32-44°: holding
        // climbs, releasing keeps the arc, and the verb this anchor exists to
        // teach behaves like the one Alex asked to see reused.
        const pivot = new THREE.Vector3(landing.x, 6.9, landing.z);
        // 6, matching beginSwing's default maxT below — the skull's hold
        // used to outlive the player's swing by a full second, leaving it
        // anchored in the air over a player already walking away.
        skull.anchorAt(pivot, { swing: true, maxHold: 6 });
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
  // Eight, not seven. The arithmetic run of seven ends at dz 19.12 while the
  // far bank does not begin until dz ~20.5, and the basin floor between them
  // is at -3.3 -- so the last thing the crossing asked of the player was a
  // stride over open deep water at the exact point the stones stop helping.
  // Alex marked that spot: "one more stone here is needed". The eighth breaks
  // the sequence deliberately, sitting closer than 1.72 m, because it is
  // bridging to a bank rather than continuing a rhythm.
  //
  // Worth knowing before retuning the run: the first five stones sit on the
  // shallow shelf (ground 0.37, stone top 0.12), so they are scenery. Only the
  // stones past dz 16.5 are load-bearing, and there were two of them.
  const bridgeZ = [8.8, 10.52, 12.24, 13.96, 15.68, 17.4, 19.12, 20.42];
  bridgeZ.forEach((dz, i) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 0.5, 9), M.rock);
    st.position.set(C.x + Math.sin(i * 1.7) * 0.34, -1.4, C.z + dz);
    st.rotation.y = i * 0.73;
    st.castShadow = true;
    st.receiveShadow = true;
    scene.add(st);
    game.bridgeStones.push(st);
  });

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

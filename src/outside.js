// outside.js — Acts 3-5: graveyard backyard, the sealing forest, the clearing,
// the cave behind the waterfall. Forest is an authored spline corridor
// (eaten-path pattern): movement is projection onto the polyline, the seal
// frontier IS the collider, rising instanced trees are its body.
import * as THREE from 'three';
import { RNG, clamp, lerp, damp, smoothstep, TAU } from './util.js';

export const FOREST_GATE = { x: 2, z: 43 };

// ------------------------------------------------------------------ terrain
export function terrainHeightFn(game) {
  return (x, z) => {
    const C = game.clearingCenter;
    if (C && x > C.x - 6 && x < C.x + 30 && z > C.z + 20.4 && z < C.z + 50) return 0;   // cave floor
    if (C && Math.abs(x - C.x) < 30 && z > C.z - 27 && z < C.z + 30) {
      // must match the clearing bowl mesh exactly
      const r = Math.hypot(x - C.x, z - C.z);
      return -0.4 * Math.exp(-((r / 22) ** 2)) + Math.sin((x - C.x) * 0.4) * 0.08 + 0.02;
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
  const stoneGeo = new THREE.BoxGeometry(0.62, 0.9, 0.14);
  const stones = new THREE.InstancedMesh(stoneGeo, M.headstone, 64);
  let si = 0;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (let row = 0; row < 8 && si < 64; row++) {
    for (let col = 0; col < 9 && si < 64; col++) {
      if (rng.chance(0.18)) continue;
      const x = -16 + col * 4.4 + rng.range(-0.8, 0.8);
      const z = 10 + row * 3.9 + rng.range(-0.7, 0.7);
      if (Math.abs(x - FOREST_GATE.x) < 2.2 && z > 36) continue;   // keep the lane clear
      p.set(x, 0.42 + rng.range(-0.06, 0.02), z);
      e.set(rng.range(-0.06, 0.06), rng.range(0, TAU), rng.range(-0.14, 0.14));
      s.set(rng.range(0.8, 1.25), rng.range(0.8, 1.4), 1);
      mtx.compose(p, q.setFromEuler(e), s);
      stones.setMatrixAt(si++, mtx);
    }
  }
  stones.count = si;
  stones.castShadow = true;
  scene.add(stones);

  // the crashed car — headlights still on, dying
  const car = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 4.2), M.metal);
  body.position.y = 0.65;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.0), M.metal);
  cabin.position.set(0, 1.25, -0.3);
  cabin.rotation.x = 0.06;
  car.add(body, cabin);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.5]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10), M.metal);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    car.add(wheel);
  }
  car.position.set(-9, 0, 14);
  car.rotation.set(0.05, 2.4, 0.12);
  scene.add(car);
  world.addCollider(-10.4, 0, 12.4, -7.6, 1.6, 15.6);
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
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1d1a20 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.62, 4, 8), bodyMat);
    torso.rotation.x = Math.PI / 2;
    torso.position.y = 0.2;
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 3, 6), bodyMat);
    limb.rotation.set(Math.PI / 2, 0, 0.9 + i * 0.4);
    limb.position.set(0.3, 0.14, 0.2);
    b.add(torso, limb);
    b.position.set(-6 + i * 3.4, 0, 17 + i * 4.6);
    b.rotation.y = Math.atan2(b.position.x - FOREST_GATE.x, b.position.z - FOREST_GATE.z);
    scene.add(b);
  }

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

// ------------------------------------------------------------------- forest
const SEAL_TRAIL = 10;

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
    // corridor half-width narrows with depth, breathes, and opens at the arena
    this.halfW = this.samples.map((s, i) => {
      const t = i / this.length;
      let w = lerp(2.4, 1.5, smoothstep(0, 0.35, t)) * (0.9 + 0.2 * Math.sin(i * 0.29));
      w += 9 * Math.exp(-(((i - this.arenaS()) / 14) ** 2));       // the arena bulge
      return w;
    });

    this.sealS = -SEAL_TRAIL;
    this._lastIdx = 0;
    this.entered = false;

    this._buildFlora(rng);
    this._buildSealPool();
    this._setpieces();

    // NOTE: the forest zone/surface are registered in buildOutside AFTER the
    // clearing and cave, so their tighter rects win the first-match scan.
    world.postClamp = (pos, dt) => this.clampPlayer(pos, dt);
  }

  arenaS() { return Math.floor(this.length * 0.72); }
  ravineS() { return Math.floor(this.length * 0.5); }
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
    if (bestD > 40 * 40 && (this._lastIdx === 0 || this._lastIdx === this.length - 1)) {
      // cold start: full scan once
      for (let i = 0; i < this.length; i++) {
        const s = this.samples[i];
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    const s = this.samples[best];
    const lat = (x - s.x) * -s.tz + (z - s.z) * s.tx;   // signed lateral
    return { s: best, lat, sample: s };
  }

  posAt(s, lat = 0) {
    const i = clamp(Math.round(s), 0, this.length - 1);
    const sm = this.samples[i];
    return new THREE.Vector3(sm.x + -sm.tz * lat, 0, sm.z + sm.tx * lat);
  }

  clampPlayer(pos, dt) {
    if (pos.z < 42) return;              // not in the forest yet
    const pr = this.project(pos.x, pos.z);
    if (!pr) return;
    // jurisdiction: beyond the treeline (clearing, cave, mirror) we let go
    const dist = Math.hypot(pos.x - pr.sample.x, pos.z - pr.sample.z);
    if (dist > this.halfW[pr.s] + 3) return;
    // the mouth: within the last two samples the forest simply releases you —
    // the reprojection can't represent 'beyond the end' and would pin you here
    if (pr.s >= this.length - 2) return;
    this._lastIdx = pr.s;
    if (!this.entered && pr.s > 4) {
      this.entered = true;
      this.game.flag('forestEntered');
    }
    const hw = this.halfW[pr.s] - 0.38;
    const lat = clamp(pr.lat, -hw, hw);
    // seal frontier IS the wall behind you
    const minS = this.sealS + 2.2;
    const s = Math.max(pr.s + 0, minS);
    if (s !== pr.s) {
      // seal push: a hard forward reposition — never soften this one
      const sm = this.samples[clamp(Math.round(s), 0, this.length - 1)];
      pos.x = sm.x + -sm.tz * lat;
      pos.z = sm.z + sm.tx * lat;
    } else if (lat !== pr.lat) {
      // wall slide: clamp lateral, preserve along-track so motion isn't erased
      const sm = pr.sample;
      const along = (pos.x - sm.x) * sm.tx + (pos.z - sm.z) * sm.tz;
      pos.x = sm.x + -sm.tz * lat + sm.tx * along;
      pos.z = sm.z + sm.tx * lat + sm.tz * along;
    }
    // frontier chases
    if (this.entered) {
      const target = pr.s - SEAL_TRAIL;
      if (target > this.sealS) {
        this.sealS = Math.min(target, this.sealS + Math.max(1.5, (target - this.sealS) * 2.4) * dt);
        this._placeSeal();
      }
    }
  }

  _buildFlora(rng) {
    const { scene, mats: M } = this.game;
    // trees hug the corridor edge with exponential falloff — eaten-path discipline
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.26, 1, 7);
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    const items = [];
    for (let i = 0; i < this.length; i += 2) {
      const sm = this.samples[i];
      const hw = this.halfW[i];
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const off = hw + 0.8 + -Math.log(1 - rng.float()) * 2.6;
          if (off > hw + 12) continue;
          const x = sm.x + -sm.tz * side * off + rng.range(-0.7, 0.7);
          const z = sm.z + sm.tx * side * off + rng.range(-0.7, 0.7);
          const h = rng.range(5, 9);
          items.push({ x, z, h, r: rng.range(0.8, 1.5), tilt: rng.gauss() * 0.05 });
        }
      }
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, M.bark, items.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshLambertMaterial({ color: 0x0c1410 }), items.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    items.forEach((it, i) => {
      e.set(it.tilt, 0, it.tilt * 0.7);
      q.setFromEuler(e);
      mtx.compose(v.set(it.x, it.h / 2, it.z), q, sv.set(1.1, it.h, 1.1));
      trunks.setMatrixAt(i, mtx);
      mtx.compose(v.set(it.x, it.h * 0.92, it.z), q, sv.set(it.r * 2.2, it.r * 1.6, it.r * 2.2));
      canopies.setMatrixAt(i, mtx);
    });
    scene.add(trunks, canopies);

    // path ribbon (skips the ravine — a black gash crosses the trail there)
    const ribbon = [];
    for (let i = 0; i < this.length - 1; i++) {
      if (Math.abs(i - this.ravineS()) < 3) continue;
      const a = this.samples[i], b = this.samples[i + 1];
      const wA = Math.min(this.halfW[i] * 0.8, 2.2), wB = Math.min(this.halfW[i + 1] * 0.8, 2.2);
      ribbon.push(
        a.x + -a.tz * -wA, 0.02, a.z + a.tx * -wA,
        a.x + -a.tz * wA, 0.02, a.z + a.tx * wA,
        b.x + -b.tz * wB, 0.02, b.z + b.tx * wB,
        a.x + -a.tz * -wA, 0.02, a.z + a.tx * -wA,
        b.x + -b.tz * wB, 0.02, b.z + b.tx * wB,
        b.x + -b.tz * -wB, 0.02, b.z + b.tx * -wB,
      );
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(ribbon, 3));
    rg.computeVertexNormals();
    const rib = new THREE.Mesh(rg, M.dirt);
    scene.add(rib);
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
    const { scene, mats: M } = this.game;
    const N = 48;
    this.sealMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.16, 0.3, 1, 6), M.bark, N);
    this.sealMesh.frustumCulled = false;
    scene.add(this.sealMesh);
    this.sealAnim = new Array(N).fill(0).map(() => ({ x: 0, z: 0, h: 6, t: 1, delay: 0 }));
    this._sealPlaced = -999;
  }

  _placeSeal() {
    // re-seed the rising wall when the frontier has moved enough
    if (this.sealS - this._sealPlaced < 2.5) return;
    this._sealPlaced = this.sealS;
    const rng = new RNG(0x77 + Math.floor(this.sealS));
    const base = clamp(Math.floor(this.sealS), 0, this.length - 1);
    let i = 0;
    for (const a of this.sealAnim) {
      const s = clamp(base - Math.floor(i / 8) * 1.5, 0, this.length - 1);
      const sm = this.samples[Math.floor(s)];
      const lat = rng.range(-1, 1) * (this.halfW[Math.floor(s)] + 1.5);
      a.x = sm.x + -sm.tz * lat + rng.range(-0.5, 0.5);
      a.z = sm.z + sm.tx * lat + rng.range(-0.5, 0.5);
      a.h = rng.range(4.5, 8);
      a.t = Math.min(a.t, 0);          // restart rise if it was done
      a.delay = rng.range(0, 0.5);
      i++;
    }
    this.game.audio.brushCrash({ pos: this.posAt(base), gain: 0.5 });
  }

  update(dt) {
    const mtx = new THREE.Matrix4(), v = new THREE.Vector3(), sv = new THREE.Vector3(), q = new THREE.Quaternion();
    let dirty = false;
    this.sealAnim.forEach((a, i) => {
      if (a.t >= 1) return;
      a.t = Math.min(1, a.t + dt / 2.2);
      const e = a.t < 0 ? 0 : smoothstep(0, 1, a.t);
      mtx.compose(v.set(a.x, -a.h / 2 + e * a.h, a.z), q, sv.set(1.2, a.h, 1.2));
      this.sealMesh.setMatrixAt(i, mtx);
      dirty = true;
    });
    if (dirty) this.sealMesh.instanceMatrix.needsUpdate = true;
  }

  _setpieces() {
    const { world, scene, mats: M, audio } = this.game;
    const game = this.game;

    // fallen tree blocking the path — the skull clears it (3 hits)
    const fs = this.fallenS();
    const fsm = this.samples[fs];
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 7, 8), M.bark);
    log.position.set(fsm.x, 0.55, fsm.z);
    log.rotation.set(0.1, Math.atan2(fsm.tx, -fsm.tz), Math.PI / 2 * 0.94);
    scene.add(log);
    const logCol = world.addCollider(fsm.x - 3.4, 0, fsm.z - 0.8, fsm.x + 3.4, 1.6, fsm.z + 0.8);
    let logHits = 0;
    world.addFetchTarget({
      id: 'fallenTree', object: log, radius: 1.4,
      onHit(skull, at) {
        logHits++;
        game.impact('hurt', at);
        audio.pop({ pos: log.position, gain: 0.32, rate: 0.7 });
        log.rotation.x += 0.09;
        log.position.y -= 0.1;
        if (logHits >= 3) {
          this.enabled = false;
          logCol.max.y = logCol.min.y;
          log.position.y = 0.18;
          log.rotation.z = Math.PI / 2 * 0.99;
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
    world.addFetchTarget({
      id: 'ravineRope', pos: this.ropeAnchor, radius: 1.1,
      onHit(skull) {
        this.enabled = false;   // one launch; a used rope must never re-anchor a combat throw
        skull.anchorAt(new THREE.Vector3().copy(rope.position).setY(1.5).add(new THREE.Vector3(0.9, 0, 0)));
        game.flag('ropeLatched');
        audio.creak({ pos: rope.position, gain: 0.6 });
        game.player.launchTo(new THREE.Vector3(landing.x, 1.2, landing.z), () => {
          skull.anchor = null;
          skull.beginReturn('snap');
        });
        return 'anchor';
      },
    });
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
  const g = new THREE.PlaneGeometry(60, 54, 20, 18);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    pos.setY(i, -0.4 * Math.exp(-((r / 22) ** 2)) + Math.sin(pos.getX(i) * 0.4) * 0.08);
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
  const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 24), M.water);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(C.x, 0.08, C.z + 16);
  scene.add(pool);
  game.tickers.push((dt, t) => {
    if (M.water.map) M.water.map.offset.y = (t * 0.25) % 1;
  });

  // the cliff and the giant waterfall
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(44, 20, 4), M.rock);
  cliff.position.set(C.x, 9, C.z + 22);
  scene.add(cliff);
  world.addCollider(C.x - 22, -2, C.z + 20, C.x - 3.2, 20, C.z + 24);
  world.addCollider(C.x + 3.2, -2, C.z + 20, C.x + 22, 20, C.z + 24);
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

  // stepping-stone bridge — hidden underwater until the skull goes through
  game.bridgeStones = [];
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 7), M.rock);
    st.position.set(C.x + (i - 2) * 0.3, -1.4, C.z + 11 + i * 1.9);
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
}

// --------------------------------------------------------------------- cave
export function buildCave(game) {
  const { world, scene, mats: M } = game;
  const C = game.clearingCenter;
  // tunnel behind the fall, kinking right, rising to the hatch chamber
  const path = [
    [C.x, C.z + 22], [C.x + 2, C.z + 30], [C.x + 7, C.z + 36],
    [C.x + 14, C.z + 40], [C.x + 22, C.z + 42],
  ];
  world.addZone('cave', C.x - 6, C.z + 20.4, C.x + 30, C.z + 50, -4, 12);
  world.addSurface('stone', C.x - 6, C.z + 20.4, C.x + 30, C.z + 50, -4, 12);

  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    // floor + walls + roof as rough slabs
    world.box(M.rock, mx, -0.15, mz, 4.6, 0.3, len + 1.6, ang);
    world.box(M.rock, mx + Math.cos(ang) * 2.1, 1.7, mz - Math.sin(ang) * 2.1, 0.8, 4.2, len + 1.6, ang);
    world.box(M.rock, mx - Math.cos(ang) * 2.1, 1.7, mz + Math.sin(ang) * 2.1, 0.8, 4.2, len + 1.6, ang);
    world.box(M.rock, mx, 3.6, mz, 4.9, 0.5, len + 1.6, ang);
    // NOTE: no wall colliders here — axis-aligned boxes on diagonal legs pinch
    // the walkway shut at every elbow. The tunnel is kept walkable by a spine
    // clamp below (forest-style projection); the rock walls stay visual.
    // candles along the wall — someone lit these
    world.candles.push({ x: mx + Math.cos(ang) * 1.6, y: 1.1, z: mz - Math.sin(ang) * 1.6, intensity: 1.3, r: 4 });
  }

  // spine clamp: project onto the tunnel polyline, clamp lateral drift.
  // The hatch chamber (east of ex-1) is exempt — its real walls collide.
  const [cex, cez] = path[path.length - 1];
  const prevClamp = world.postClamp;
  world.postClamp = (pos, dt) => {
    const inCave = pos.x > C.x - 6 && pos.x < C.x + 30 && pos.z > C.z + 21 && pos.z < C.z + 50;
    if (!inCave) { if (prevClamp) prevClamp(pos, dt); return; }
    if (pos.x > cex - 1) return;                        // the chamber
    let bestD = Infinity, bx2 = pos.x, bz2 = pos.z;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i], [bx, bz] = path[i + 1];
      const vx = bx - ax, vz = bz - az;
      const L2 = vx * vx + vz * vz;
      const t = clamp(((pos.x - ax) * vx + (pos.z - az) * vz) / L2, 0, 1);
      const px = ax + vx * t, pz = az + vz * t;
      const d = Math.hypot(pos.x - px, pos.z - pz);
      if (d < bestD) { bestD = d; bx2 = px; bz2 = pz; }
    }
    const HW = 1.65;
    if (bestD > HW) {
      const k = HW / bestD;
      pos.x = bx2 + (pos.x - bx2) * k;
      pos.z = bz2 + (pos.z - bz2) * k;
    }
  };

  // hatch chamber at the end
  const [ex, ez] = path[path.length - 1];
  world.box(M.rock, ex + 2, -0.15, ez, 6, 0.3, 6);
  world.box(M.rock, ex + 5, 1.9, ez, 0.8, 4.4, 6);
  world.box(M.rock, ex + 2, 1.9, ez + 3, 6, 4.4, 0.8);
  world.box(M.rock, ex + 2, 1.9, ez - 3, 6, 4.4, 0.8);
  world.box(M.rock, ex + 2, 4.0, ez, 6.4, 0.5, 6.4);
  world.addCollider(ex + 4.6, -1, ez - 3, ex + 5.4, 4, ez + 3);
  world.addCollider(ex - 1, -1, ez + 2.6, ex + 5, 4, ez + 3.4);
  world.addCollider(ex - 1, -1, ez - 3.4, ex + 5, 4, ez - 2.6);
  world.candles.push({ x: ex + 2, y: 0.6, z: ez, intensity: 1.5, r: 5 });

  // the hatch above — through it, a room much like the first
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.1), M.woodDark);
  hatch.position.set(ex + 2, 3.75, ez);
  scene.add(hatch);
  // invisible reach-post below it: a ceiling hatch aimed at through a pitch
  // clamp needs a forgiving target — E works from anywhere underneath
  const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1.4),
    new THREE.MeshBasicMaterial({ visible: false }));
  post.position.set(ex + 2, 2.9, ez);
  scene.add(post);
  world.registerInteract(post, 'caveHatch', () => {
    if (game.act !== 'cave') return;
    game.director.enterMirrorRoom();
  });
  game.caveEnd = new THREE.Vector3(ex + 2, 0, ez);
}

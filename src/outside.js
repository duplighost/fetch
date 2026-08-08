// outside.js — Acts 3-5: graveyard backyard, the sealing forest, the clearing,
// the cave behind the waterfall. Forest is an authored spline corridor
// (eaten-path pattern): movement is projection onto the polyline, the seal
// frontier IS the collider, rising instanced trees are its body.
import * as THREE from 'three';
import { RNG, clamp, lerp, damp, smoothstep, TAU } from './util.js';
import { LAYER_HELD } from './mirrors.js';

export const FOREST_GATE = { x: 2, z: 43 };

// ------------------------------------------------------------------ terrain
export function terrainHeightFn(game) {
  return (x, z) => {
    const C = game.clearingCenter;
    if (C && x > C.x - 6 && x < C.x + 30 && z > C.z + 20.4 && z < C.z + 50) return 0;   // cave floor
    if (C && Math.abs(x - C.x) < 30 && z > C.z - 27 && z < C.z + 30) {
      // The plunge pool is a real obstacle. Once the bridge rises, its moving
      // stone tops become the only walkable ground across the basin.
      for (const st of game.bridgeStones || []) {
        if (st.position.y < -0.35) continue;
        if (Math.hypot(x - st.position.x, z - st.position.z) < 1.03) return st.position.y + 0.25;
      }
      const lx = x - C.x, lz = z - C.z;
      const r = Math.hypot(lx, lz);
      const poolR = Math.hypot(lx, lz - 15.2);
      const basin = -3.15 * (1 - smoothstep(5.4, 8.2, poolR));
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
    this._sealMtx = new THREE.Matrix4();
    this._sealPos = new THREE.Vector3();
    this._sealScale = new THREE.Vector3();
    this._sealQuat = new THREE.Quaternion();

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
    return { s: fs, i: clamp(Math.round(fs), 0, this.length - 1), lat, sample: si };
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
    if (pos.z < 42) return;              // not in the forest yet
    const pr = this.project(pos.x, pos.z);
    if (!pr) return;
    // jurisdiction: beyond the treeline (clearing, cave, mirror) we let go
    const dist = Math.hypot(pos.x - pr.sample.x, pos.z - pr.sample.z);
    if (dist > this.halfW[pr.i] + 3) return;
    // the mouth: within the last two samples the forest simply releases you —
    // the reprojection can't represent 'beyond the end' and would pin you here
    if (pr.s >= this.length - 2) return;
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
    const hw = this.halfW[pr.i] - 0.38;
    const lat = clamp(pr.lat, -hw, hw);
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
      // wall slide: clamp lateral, preserve along-track so motion isn't erased
      const sm = pr.sample;
      const along = (pos.x - sm.x) * sm.tx + (pos.z - sm.z) * sm.tz;
      pos.x = sm.x + -sm.tz * lat + sm.tx * along;
      pos.z = sm.z + sm.tx * lat + sm.tz * along;
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
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    canopyGeo.scale(1, 0.62, 1);
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

    const trunks = [], canopies = [], branches = [], shrubs = [], roots = [];
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
            x: p.x + rng.gauss() * 0.8, y: h * rng.range(0.84, 0.98), z: p.z + rng.gauss() * 0.8,
            sc: rng.range(1.6, 2.9), tint: rng.range(0.45, 0.92),
          });
        }
      }
      // the sky closes over the path: low canopy blobs above the corridor
      if (rng.chance(0.42)) {
        const p = at(i, rng.gauss() * hw * 0.6);
        canopies.push({ x: p.x, y: rng.range(4.6, 7.2), z: p.z, sc: rng.range(2.1, 3.4), tint: rng.range(0.34, 0.66) });
      }
      // and branches knit across it, low enough to duck under
      if (rng.chance(0.24)) {
        const y = rng.range(2.9, 4.3);
        const a = at(i, -(hw + rng.range(0, 0.9))), b = at(i + rng.gauss() * 1.2, hw + rng.range(0, 0.9));
        branches.push({ a: new THREE.Vector3(a.x, y + rng.gauss() * 0.4, a.z), b: new THREE.Vector3(b.x, y + rng.gauss() * 0.4, b.z) });
      }
    }
    // shrub walls line the corridor — the surfaces you actually walk between.
    // Use the UNPINCHED width so foliage never presses against the lens.
    for (let i = 2; i < this.length - 2; i += 1) {
      if (rng.chance(0.25)) continue;
      const wallW = Math.max(this.halfW[i], 1.9);
      for (const side of [-1, 1]) {
        const p = at(i, side * (wallW + rng.range(0.3, 1.1)));
        shrubs.push({ x: p.x, z: p.z, sc: rng.range(0.55, 1.15), rotY: rng.float() * TAU, tint: rng.range(0.34, 0.72) });
        if (rng.chance(0.28)) {
          const p2 = at(i, side * (wallW + rng.range(1.7, 3.8)));
          shrubs.push({ x: p2.x, z: p2.z, sc: rng.range(0.75, 1.5), rotY: rng.float() * TAU, tint: rng.range(0.26, 0.58) });
        }
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

    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x0e1712 });
    bake(canopyGeo, canopyMat, canopies, (it) => {
      e.set(0, it.tint * 6, 0); q.setFromEuler(e);
      mtx.compose(v.set(it.x, it.y, it.z), q, sv.set(it.sc * 2.1, it.sc * 1.5, it.sc * 2.1));
    }, (it) => it.tint);

    bake(branchGeo, M.bark, branches, (it) => {
      dir.subVectors(it.b, it.a);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      mtx.compose(it.a, q, sv.set(1, len, 1));
    }, () => 0.85);

    const shrubMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, map: shrubTex, alphaTest: 0.42, side: THREE.DoubleSide,
    });
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
          game.checkpoint('forest');
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
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const poolR = Math.hypot(x, z - 15.2);
    const basin = -3.15 * (1 - smoothstep(5.4, 8.2, poolR));
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
  const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 24), M.water);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(C.x, 0.08, C.z + 16);
  scene.add(pool);
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
  const { world, scene, mats: M } = game;
  const C = game.clearingCenter;
  // tunnel behind the fall, kinking right, rising to the hatch chamber
  const path = [
    [C.x, C.z + 22], [C.x + 2, C.z + 30], [C.x + 7, C.z + 36],
    [C.x + 14, C.z + 40], [C.x + 22, C.z + 42],
  ];
  game.caveZone = world.addZone('cave', C.x - 6, C.z + 20.4, C.x + 30, C.z + 50, -4, 12);
  game.caveZone.enabled = game.flags.has('waterfallTaken');
  world.addSurface('stone', C.x - 6, C.z + 20.4, C.x + 30, C.z + 50, -4, 12);

  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    // floor + walls + roof as rough slabs
    world.box(M.rock, mx, -0.15, mz, 4.6, 0.3, len + 1.6, ang);
    // The slabs are only the dark backing behind the decorative rock skin.
    // Keep their inner faces wide enough that the tunnel reads as a route,
    // rather than two flat panels pinching the camera at every elbow.
    world.box(M.rock, mx + Math.cos(ang) * 2.18, 1.7, mz - Math.sin(ang) * 2.18, 0.52, 4.2, len + 1.35, ang);
    world.box(M.rock, mx - Math.cos(ang) * 2.18, 1.7, mz + Math.sin(ang) * 2.18, 0.52, 4.2, len + 1.35, ang);
    world.box(M.rock, mx, 3.68, mz, 4.75, 0.34, len + 1.35, ang);
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
    if (game.act !== 'cave' || !game.flags.has('waterfallTaken')) return;
    game.director.enterMirrorRoom();
  });
  game.caveEnd = new THREE.Vector3(ex + 2, 0, ez);
}

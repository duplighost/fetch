// enemies.js — walkers, the Resident, the horde. Announced by footsteps and the
// skull's chatter long before they're seen. Faster than you. Stun is quiet;
// popping is LOUD and the dark answers it.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, TAU } from './util.js';

const KIND = {
  walker: {
    h: 2.05, r: 0.3, chase: 5.6, stalk: 1.1, hp: 1, stun: 2.8, scale: 1, windup: 1.1,
    hit: { y0: 0.22, y1: 1.58, r: 0.32, shoulderY: 1.48, shoulderR: 0.42, headY: 1.79, headR: 0.23 },
  },
  resident: {
    h: 2.5, r: 0.38, chase: 4.9, stalk: 0.9, hp: Infinity, stun: 1.6, scale: 1.22, windup: 0.8,
    hit: { y0: 0.24, y1: 2.02, r: 0.46, shoulderY: 1.72, shoulderR: 0.62, headY: 2.14, headR: 0.3 },
  },
  kneeler: {
    h: 4.4, r: 0.9, chase: 6.2, stalk: 0, hp: Infinity, stun: 0.4, scale: 2.4, windup: 2.2,
    hit: { y0: 0.22, y1: 3.58, r: 0.9, shoulderY: 3.12, shoulderR: 1.15, headY: 3.38, headR: 0.68 },
  },
};

const BASE_COLOR = { walker: 0x16141a, resident: 0x100d12, kneeler: 0x16141a };
const STAIN_GEO = new THREE.CircleGeometry(0.55, 10);
const STAIN_MAT = new THREE.MeshBasicMaterial({ color: 0x0b0910, transparent: true, opacity: 0.85, depthWrite: false });
const V = {
  a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
  d: new THREE.Vector3(),
};

// Every enemy reuses this small geometry kit. The old figure allocated nine new
// geometries per spawn; the authored horde and retries should spend meshes, not
// leak a fresh set of GPU buffers each time a footstep enters the dark.
const FIGURE_GEO = {
  capsule: new THREE.CapsuleGeometry(0.5, 1, 3, 7),
  limb: new THREE.CapsuleGeometry(0.5, 1, 3, 6),
  sphere: new THREE.SphereGeometry(0.5, 9, 7),
  smallSphere: new THREE.SphereGeometry(0.5, 6, 4),
  coat: new THREE.CylinderGeometry(0.46, 0.7, 1, 7),
  slab: new THREE.BoxGeometry(1, 1, 1),
  spike: new THREE.ConeGeometry(0.5, 1, 5),
};
const GLINT_MAT = new THREE.MeshBasicMaterial({ color: 0xe8ecef });

function addPart(parent, geometry, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

function addEyes(head, spread, y, z, sx = 0.025, sy = 0.018) {
  for (const s of [-1, 1]) {
    addPart(head, FIGURE_GEO.smallSphere, GLINT_MAT, s * spread, y, z, sx, sy, 0.012);
  }
}

function pointSegmentDistanceSq(px, py, pz, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 1e-8
    ? ((px - a.x) * abx + (py - a.y) * aby + (pz - a.z) * abz) / len2
    : 0;
  t = clamp(t, 0, 1);
  const dx = a.x + abx * t - px;
  const dy = a.y + aby * t - py;
  const dz = a.z + abz * t - pz;
  return dx * dx + dy * dy + dz * dz;
}

// Squared distance between the skull's swept segment and a vertical body-axis
// segment. This is the standard clamped segment/segment solution, specialized
// to a vertical second segment so it stays allocation-free in the hot loop.
function segmentVerticalDistanceSq(a, b, x, y0, y1, z) {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vy = y1 - y0;
  const wx = a.x - x, wy = a.y - y0, wz = a.z - z;
  const aa = ux * ux + uy * uy + uz * uz;
  const bb = uy * vy;
  const cc = vy * vy;
  const dd = ux * wx + uy * wy + uz * wz;
  const ee = vy * wy;
  const denom = aa * cc - bb * bb;
  const eps = 1e-8;

  let sN, sD = denom;
  let tN, tD = denom;
  if (denom < eps) {
    sN = 0;
    sD = 1;
    tN = ee;
    tD = cc;
  } else {
    sN = bb * ee - cc * dd;
    tN = aa * ee - bb * dd;
    if (sN < 0) {
      sN = 0;
      tN = ee;
      tD = cc;
    } else if (sN > sD) {
      sN = sD;
      tN = ee + bb;
      tD = cc;
    }
  }

  if (tN < 0) {
    tN = 0;
    if (-dd < 0) sN = 0;
    else if (-dd > aa) sN = sD;
    else { sN = -dd; sD = aa; }
  } else if (tN > tD) {
    tN = tD;
    if (-dd + bb < 0) sN = 0;
    else if (-dd + bb > aa) sN = sD;
    else { sN = -dd + bb; sD = aa; }
  }

  const sc = Math.abs(sN) < eps ? 0 : sN / sD;
  const tc = Math.abs(tN) < eps ? 0 : tN / tD;
  const dx = wx + sc * ux;
  const dy = wy + sc * uy - tc * vy;
  const dz = wz + sc * uz;
  return dx * dx + dy * dy + dz * dz;
}

function buildWalker(g, mat, limbs) {
  // A starved, forward-drawn thing: narrow trunk, coat-hanger shoulders, arms
  // that end below its knees, and a skull carried at an inquisitive angle.
  addPart(g, FIGURE_GEO.capsule, mat, 0, 1.08, -0.015, 0.27, 0.61, 0.22, -0.08);
  addPart(g, FIGURE_GEO.capsule, mat, 0, 1.48, -0.025, 0.17, 0.55, 0.18, 0, 0, Math.PI / 2);
  addPart(g, FIGURE_GEO.sphere, mat, 0, 1.38, -0.13, 0.3, 0.28, 0.18);

  const head = new THREE.Group();
  head.position.set(0.035, 1.78, 0.055);
  head.rotation.set(-0.08, 0, 0.2);
  addPart(head, FIGURE_GEO.sphere, mat, 0, 0, 0, 0.2, 0.24, 0.18);
  addPart(head, FIGURE_GEO.slab, mat, 0, -0.19, 0.035, 0.17, 0.12, 0.14, 0.05);
  addEyes(head, 0.062, 0.025, 0.17, 0.027, 0.018);
  g.add(head);

  for (const s of [-1, 1]) {
    const armP = new THREE.Group();
    armP.position.set(s * 0.29, 1.5, 0.015);
    armP.rotation.z = s * -0.08;
    addPart(armP, FIGURE_GEO.limb, mat, 0, s < 0 ? -0.5 : -0.54, 0.025,
      0.085, s < 0 ? 0.52 : 0.56, 0.075);
    addPart(armP, FIGURE_GEO.sphere, mat, 0, s < 0 ? -1.02 : -1.1, 0.04, 0.11, 0.16, 0.075);
    limbs.arms.push(armP);
    g.add(armP);

    const legP = new THREE.Group();
    legP.position.set(s * 0.105, 0.75, -0.02);
    legP.rotation.z = s * 0.08;
    addPart(legP, FIGURE_GEO.limb, mat, 0, -0.39, 0, 0.105, 0.42, 0.095);
    addPart(legP, FIGURE_GEO.slab, mat, 0, -0.81, 0.09, 0.14, 0.08, 0.27, -0.08);
    limbs.legs.push(legP);
    g.add(legP);
  }
  return head;
}

function buildResident(g, mat, limbs) {
  // The house's owner fills a doorway before it enters: a sloped coat, a high
  // back, and wall-reaching hands around a small, almost buried face.
  addPart(g, FIGURE_GEO.coat, mat, 0, 0.78, -0.02, 0.72, 1.4, 0.55);
  addPart(g, FIGURE_GEO.capsule, mat, 0, 1.3, -0.12, 0.48, 0.52, 0.34, -0.18);
  addPart(g, FIGURE_GEO.capsule, mat, 0, 1.53, -0.04, 0.28, 0.72, 0.28, 0, 0, Math.PI / 2);
  addPart(g, FIGURE_GEO.sphere, mat, 0, 1.55, -0.25, 0.58, 0.4, 0.32);

  const head = new THREE.Group();
  head.position.set(-0.03, 1.76, 0.075);
  head.rotation.set(-0.16, 0, -0.12);
  addPart(head, FIGURE_GEO.sphere, mat, 0, 0, 0, 0.23, 0.27, 0.2);
  addPart(head, FIGURE_GEO.slab, mat, 0, -0.2, 0.035, 0.2, 0.13, 0.15);
  addEyes(head, 0.07, 0.015, 0.19, 0.032, 0.014);
  g.add(head);

  for (const s of [-1, 1]) {
    const armP = new THREE.Group();
    armP.position.set(s * 0.43, 1.5, 0.025);
    armP.rotation.z = s * -0.18;
    addPart(armP, FIGURE_GEO.limb, mat, 0, -0.56, 0.06, 0.13, 0.58, 0.11);
    addPart(armP, FIGURE_GEO.sphere, mat, 0, -1.12, 0.1, 0.19, 0.22, 0.1);
    for (let i = -1; i <= 1; i++) {
      addPart(armP, FIGURE_GEO.spike, mat, i * 0.085, -1.36, 0.14,
        0.045, 0.3 + (i === 0 ? 0.05 : 0), 0.045, 0, 0, Math.PI);
    }
    limbs.arms.push(armP);
    g.add(armP);

    const legP = new THREE.Group();
    legP.position.set(s * 0.2, 0.58, -0.05);
    addPart(legP, FIGURE_GEO.limb, mat, 0, -0.32, 0, 0.16, 0.36, 0.14);
    addPart(legP, FIGURE_GEO.slab, mat, 0, -0.68, 0.13, 0.22, 0.1, 0.34, -0.08);
    limbs.legs.push(legP);
    g.add(legP);
  }
  return head;
}

function buildKneeler(g, mat, limbs) {
  // A load-bearing animal silhouette rather than a scaled walker: enormous
  // shoulder shelf, bowed spine, low forward face, and forelimbs made to plant.
  addPart(g, FIGURE_GEO.capsule, mat, 0, 1.08, -0.12, 0.46, 0.52, 0.4, -0.32);
  addPart(g, FIGURE_GEO.sphere, mat, 0, 1.47, -0.25, 0.54, 0.47, 0.42);
  addPart(g, FIGURE_GEO.capsule, mat, 0, 1.38, -0.04, 0.28, 0.78, 0.3, 0, 0, Math.PI / 2);
  for (let i = -1; i <= 1; i++) {
    addPart(g, FIGURE_GEO.spike, mat, i * 0.16, 1.79 - Math.abs(i) * 0.08, -0.28,
      0.1, 0.42 - Math.abs(i) * 0.08, 0.1, -0.35);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.38, 0.36);
  head.rotation.x = -0.22;
  addPart(head, FIGURE_GEO.sphere, mat, 0, 0, 0, 0.3, 0.25, 0.31);
  addPart(head, FIGURE_GEO.slab, mat, 0, -0.17, 0.17, 0.27, 0.14, 0.32, -0.18);
  addEyes(head, 0.095, 0.025, 0.29, 0.04, 0.018);
  g.add(head);

  for (const s of [-1, 1]) {
    const armP = new THREE.Group();
    armP.position.set(s * 0.38, 1.32, 0.06);
    armP.rotation.z = s * -0.15;
    addPart(armP, FIGURE_GEO.limb, mat, 0, -0.52, 0.16, 0.18, 0.56, 0.16, -0.12);
    addPart(armP, FIGURE_GEO.sphere, mat, 0, -1.04, 0.27, 0.28, 0.17, 0.34);
    limbs.arms.push(armP);
    g.add(armP);

    const legP = new THREE.Group();
    legP.position.set(s * 0.25, 0.72, -0.28);
    legP.rotation.z = s * 0.2;
    addPart(legP, FIGURE_GEO.limb, mat, 0, -0.3, -0.08, 0.2, 0.34, 0.18, 0.42);
    addPart(legP, FIGURE_GEO.slab, mat, 0, -0.62, 0.18, 0.28, 0.11, 0.42, -0.08);
    limbs.legs.push(legP);
    g.add(legP);
  }
  return head;
}

function makeFigure(kind) {
  const spec = KIND[kind];
  const mat = new THREE.MeshLambertMaterial({ color: BASE_COLOR[kind] });
  const g = new THREE.Group();
  const limbs = { arms: [], legs: [] };
  const head = kind === 'resident'
    ? buildResident(g, mat, limbs)
    : kind === 'kneeler'
      ? buildKneeler(g, mat, limbs)
      : buildWalker(g, mat, limbs);
  g.scale.setScalar(spec.scale);
  // Contract consumed by gait and stun code: keep these exact keys stable.
  g.userData = { mat, head, limbs };
  return g;
}

export class Enemies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this._spawnSerial = 0;
    this._graveClaimRecovery = 0;
  }

  spawn(kind, x, z, state = 'stalk', yHint = 3) {
    // yHint picks the STOREY: groundHeightAt resolves the highest floor at or
    // below it (a basement spawn with the default hint lands on the stairs above)
    const spec = KIND[kind];
    const mesh = makeFigure(kind);
    const e = {
      kind, spec, mesh, state,
      pos: new THREE.Vector3(x, this.game.world.groundHeightAt(x, z, yHint), z),
      phase: Math.random() * TAU,
      stunT: 0, windT: 0, stepT: 0,
      loop: this.game.audio.ready ? this.game.audio.enemyLoop(kind) : null,
      hits: 0,
      orbitAngle: (this._spawnSerial * 2.399963) % TAU,
      orbitSign: this._spawnSerial++ % 2 ? 1 : -1,
    };
    mesh.position.copy(e.pos);
    this.game.scene.add(mesh);
    this.list.push(e);
    (this.game.spawnLog ||= []).push([kind, state, Math.round(x), Math.round(z), +this.game.time.toFixed(1)]);
    return e;
  }

  clear(pred) {
    for (const e of this.list.slice()) {
      if (pred && !pred(e)) continue;
      this._remove(e);
    }
  }

  _remove(e) {
    if (e.loop) e.loop.stop();
    this.game.scene.remove(e.mesh);
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  wakeAll(centerX, centerZ, radius) {
    for (const e of this.list) {
      if (e.state !== 'dormant') continue;
      const d = Math.hypot(e.pos.x - centerX, e.pos.z - centerZ);
      if (d < radius) { e.state = 'wind'; e.windT = 0; }
    }
  }

  _releaseGraveClaim(e, recovery = 0.55) {
    if (!e.graveClaimed) return;
    e.graveClaimed = false;
    this._graveClaimRecovery = Math.max(this._graveClaimRecovery, recovery);
  }

  // The carved graves are crowd-control instruments, not damage buttons. A
  // pulse creates breathing room, keeps a solid environmental hit meaningful,
  // and leaves the quiet-stun / loud-pop kill decision in the player's hands.
  resonancePulse(pos, radius = 8, stun = 1.5) {
    let caught = 0;
    for (const e of this.list) {
      if (e.state === 'dying') continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      this._releaseGraveClaim(e, 0.65);
      e.state = 'stunned';
      e.stunT = Math.max(e.stunT || 0, stun * (1 - d / radius * 0.35));
      e.recoilT = Math.max(e.recoilT || 0, 0.12);
      e.iframes = Math.max(e.iframes || 0, 0.45);
      if (!e.knockV) e.knockV = new THREE.Vector3();
      if (d > 0.05) e.knockV.set(dx / d, 0, dz / d).multiplyScalar(0.9 * (1 - d / radius * 0.5));
      caught++;
    }
    return caught;
  }

  update(dt, ctx) {
    const game = this.game;
    const player = game.player;
    const skull = game.skull;
    const camPos = game.camera.getWorldPosition(V.a);
    const camFwd = game.camera.getWorldDirection(V.b);
    camFwd.y = 0; camFwd.normalize();

    // CINDERBLOOM's useful crowd law, reduced to FETCH scale: an attack token
    // persists through approach and strike. A stun, pop, or missed commitment
    // releases it and creates a brief recovery before the crowd can reassign
    // the slot. The Standing Kind remain orbiting pressure and never steal
    // wave tokens. Early waves commit one attacker; later waves earn two.
    const graveArena = game.director?.graveArena;
    const graveWave = graveArena?.wave ?? 0;
    const graveClaimBudget = graveWave >= 2 ? 2 : 1;
    const claimableState = (e) => e.state === 'standing' || e.state === 'wind' ||
      e.state === 'chase' || e.state === 'strike';
    const graveCandidates = graveArena && !graveArena.done
      ? this.list.filter((e) => e.graveArena && e.kind === 'walker' && claimableState(e))
      : [];
    const candidateSet = new Set(graveCandidates);
    this._graveClaimRecovery = Math.max(0, this._graveClaimRecovery - dt);
    for (const e of this.list) {
      if (!e.graveClaimed || candidateSet.has(e)) continue;
      e.graveClaimed = false;
      if (graveArena && !graveArena.done) {
        this._graveClaimRecovery = Math.max(this._graveClaimRecovery, 0.55);
      }
    }
    const claimed = graveCandidates
      .filter((e) => e.graveClaimed)
      .sort((a, b) => a.pos.distanceToSquared(player.pos) - b.pos.distanceToSquared(player.pos));
    while (claimed.length > graveClaimBudget) claimed.pop().graveClaimed = false;
    if (this._graveClaimRecovery <= 0 && claimed.length < graveClaimBudget) {
      const unclaimed = graveCandidates
        .filter((e) => !e.graveClaimed)
        .sort((a, b) => a.pos.distanceToSquared(player.pos) - b.pos.distanceToSquared(player.pos));
      while (claimed.length < graveClaimBudget && unclaimed.length) {
        const e = unclaimed.shift();
        e.graveClaimed = true;
        claimed.push(e);
      }
    }
    const graveClaims = new Set(claimed);

    let maxThreat = 0;
    let threatDir = null;

    for (const e of this.list.slice()) {
      const toP = V.c.set(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z);
      const dist = toP.length();
      // no hunting through floors: a storey of separation makes you unreachable
      const sameLevel = Math.abs(player.pos.y - e.pos.y) < 1.8;

      // ---- state machine ----
      switch (e.state) {
        case 'dormant':
          // statue-still until you have PASSED it, or it hears you
          if (sameLevel && dist < 3.2 && player.noise > 0.5) { e.state = 'wind'; e.windT = 0; }
          break;
        case 'standing': {
          if (!sameLevel) break;
          if (e.gravePressure && game.director?.graveArena && !graveClaims.has(e)) {
            // In the horde, the Standing Kind obeys the same readable attack
            // budget as risen walkers instead of bypassing it with a silent
            // touch kill. Unclaimed figures occupy slow outer slots.
            const angle = e.orbitAngle + game.time * e.orbitSign * 0.16;
            const ring = 4.1 + (e.orbitAngle % 1.2);
            const tx = player.pos.x + Math.cos(angle) * ring;
            const tz = player.pos.z + Math.sin(angle) * ring;
            const dx = tx - e.pos.x, dz = tz - e.pos.z;
            const d = Math.hypot(dx, dz) || 1;
            this._moveWithPush(e, dx / d * 0.72 * dt, dz / d * 0.72 * dt);
            e.phase += dt * 1.8;
            break;
          }
          // the Standing Kind: moves ONLY while unobserved — and only inside its
          // territory. Without the leash they trail the player's bubble across
          // the whole game and arrive three acts later as phantom stragglers.
          if (!e.home) e.home = { x: e.pos.x, z: e.pos.z };
          if (Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z) > 24) break;
          const toE = V.d.set(e.pos.x - camPos.x, 0, e.pos.z - camPos.z);
          const d2 = toE.length();
          const inView = d2 < 42 && camFwd.dot(toE.divideScalar(Math.max(d2, 0.001))) > 0.28;
          let observed = false;
          if (inView) {
            e._losT = (e._losT || 0) - dt;
            if (e._losT <= 0) {
              // Sight is structural, not psychic: shut doors and walls freeze it;
              // an open door (collapsed collider) or open window does not.
              e._losT = 0.08;
              const lookY = e.pos.y + Math.min(e.spec.h * 0.72, e.spec.h - 0.2);
              e._losClear = !this._segmentBlocked(
                camPos.x, camPos.y, camPos.z, e.pos.x, lookY, e.pos.z,
              );
            }
            observed = !!e._losClear;
          } else {
            e._losT = 0;
            e._losClear = false;
          }
          if (!observed && d2 < 30 && dist > 0.9) {
            toP.normalize();
            this._moveWithPush(e, toP.x * 0.85 * dt, toP.z * 0.85 * dt);
            e.phase += dt * 2.2;                 // silent gait — no footsteps. worse.
          } else if (dist <= 0.9 && !game.dead) {
            if (e.gravePressure && game.director?.graveArena) {
              // In a crowd, even the Standing Kind has to commit. Its silence
              // gets it close; lifted arms and breath give the player one last
              // physical answer instead of converting overlap into death.
              e.state = 'strike';
              e.strikeT = 0;
            } else {
              game.director.death(e);
            }
          }
          break;
        }
        case 'stalk': {
          if (dist > 1 && sameLevel) {
            toP.normalize();
            this._moveWithPush(e, toP.x * e.spec.stalk * dt, toP.z * e.spec.stalk * dt);
          }
          if (sameLevel && dist < 9 && (player.noise > 0.3 || dist < 5)) { e.state = 'wind'; e.windT = 0; }
          break;
        }
        case 'wind': {
          // the wind-up IS the mercy: sound tells you it's coming before it moves
          e.windT += dt;
          if (e.windT === dt) game.audio.whisper({ pos: e.pos, gain: 0.7, rate: 0.6 });
          e.mesh.userData.limbs.arms.forEach((a) => { a.rotation.x = -1.9 * Math.min(1, e.windT / e.spec.windup); });
          if (e.windT >= e.spec.windup) e.state = 'chase';
          break;
        }
        case 'chase': {
          if (!sameLevel) { e.windT += dt; break; }   // it waits below. it hears you.
          if ((e.graveArena || e.gravePressure) && !graveClaims.has(e)) {
            const angle = e.orbitAngle + game.time * e.orbitSign * 0.22;
            const ring = 3.3 + (e.orbitAngle % 1.4);
            const tx = player.pos.x + Math.cos(angle) * ring;
            const tz = player.pos.z + Math.sin(angle) * ring;
            const dx = tx - e.pos.x, dz = tz - e.pos.z;
            const d = Math.hypot(dx, dz) || 1;
            this._moveWithPush(e, dx / d * e.spec.chase * 0.62 * dt, dz / d * e.spec.chase * 0.62 * dt);
            e.phase += dt * 7;
            e.stepT -= dt;
            if (e.stepT <= 0) {
              e.stepT = 0.34 + Math.random() * 0.08;
              game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.58, rate: 0.92 });
            }
            break;
          }
          if (dist > 0.85) {
            // The graveyard is a sustained crowd fight, not the isolated
            // one-touch house chase. Claimed attackers remain faster than a
            // walking player but just slower than a committed run, so spatial
            // mastery and a clean throw can actually create breathing room.
            const arenaPace = (e.graveArena || e.gravePressure) ? 0.8 : 1;
            const sp = e.spec.chase * arenaPace * Math.min(1, 0.35 + e.windT * 0.4);
            e.windT += dt;
            // door-node steering: straight lines end at shut doors. When
            // progress stalls, route through the doorway that best closes on
            // the player. The Resident goes further: it does doors (below).
            let tx = player.pos.x, tz = player.pos.z;
            if (e._via) {
              const vd = Math.hypot(e._via.x - e.pos.x, e._via.z - e.pos.z);
              if (vd < 0.9) e._via = null;
              else { tx = e._via.x; tz = e._via.z; }
            }
            const dl = Math.hypot(tx - e.pos.x, tz - e.pos.z) || 1;
            const dirX = (tx - e.pos.x) / dl, dirZ = (tz - e.pos.z) / dl;
            const preX = e.pos.x, preZ = e.pos.z;
            this._moveWithPush(e, dirX * sp * dt, dirZ * sp * dt);
            const moved = Math.hypot(e.pos.x - preX, e.pos.z - preZ);
            if (moved < sp * dt * 0.35) e._stallT = (e._stallT || 0) + dt;
            else e._stallT = Math.max(0, (e._stallT || 0) - dt * 2);
            if (e._stallT > 0.8) {
              if (e.graveArena || e.gravePressure) {
                // House doorway nodes are poison for outdoor enemies: a risen
                // body stalled against the rear wall used to route south into
                // the house and leave the arena forever. Give graveyard bodies
                // a short in-yard avoidance leg, including explicit side
                // aisles around the house's back corners.
                if (e.pos.z < 10 && Math.abs(e.pos.x) < 13) {
                  e._via = { x: e.pos.x <= 0 ? -14 : 14, z: 11 };
                } else {
                  const px = player.pos.x - e.pos.x, pz = player.pos.z - e.pos.z;
                  const pl = Math.hypot(px, pz) || 1;
                  e._avoidSign = -(e._avoidSign || e.orbitSign || 1);
                  e._via = {
                    x: clamp(e.pos.x - pz / pl * e._avoidSign * 3.5, -18.2, 22.2),
                    z: clamp(e.pos.z + px / pl * e._avoidSign * 3.5, 8.2, 40.2),
                  };
                }
              } else {
                e._via = this._bestDoorNode(e);
              }
              e._stallT = 0;
            }
            if (e.kind === 'resident') this._tryOpenDoor(e, dt);
            e.stepT -= dt;
            if (e.stepT <= 0) {
              e.stepT = 0.26 + Math.random() * 0.06;
              game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.85, rate: 1.25 });
            }
          } else if (!game.dead) {
            if (e.graveArena || e.gravePressure) {
              // Arena contact begins a committed attack, not an invisible
              // one-frame kill. Running clears it; freezing in reach does not.
              e.state = 'strike';
              e.strikeT = 0;
            } else {
              game.director.death(e);
            }
          }
          break;
        }
        case 'strike': {
          // The horde keeps the one-hit consequence, but earns it with a short
          // readable commitment. Attack tokens continue to count this body, so
          // a second walker cannot steal the warning window in early waves.
          if (!sameLevel) {
            e.state = e.standing ? 'standing' : 'wind';
            e.windT = 0;
            break;
          }
          e.strikeT = (e.strikeT || 0) + dt;
          if (e.strikeT === dt) {
            game.audio.whisper({ pos: e.pos, gain: 0.72, rate: 0.58, verb: 0.32 });
          }
          const lift = Math.min(1, e.strikeT / 0.18);
          e.mesh.userData.limbs.arms.forEach((a) => { a.rotation.x = -2.35 * lift; });
          if (e.strikeT >= 0.48) {
            if (dist <= 0.95 && !game.dead) {
              game.director.death(e);
            } else {
              this._releaseGraveClaim(e, 0.42);
              e.state = e.standing ? 'standing' : 'wind';
              e.windT = 0;
            }
          }
          break;
        }
        case 'stunned': {
          e.stunT -= dt;
          // the body gives ground: recoil snap, then a stagger it has to catch
          if (e.recoilT > 0) {
            e.recoilT -= dt;
            e.mesh.rotation.x = -0.3 * (e.recoilT / 0.12);
          } else if (Math.abs(e.mesh.rotation.x) > 0.001) {
            e.mesh.rotation.x *= Math.exp(-8 * dt);
          }
          if (e.knockV && e.knockV.lengthSq() > 0.001) {
            this._moveWithPush(e, e.knockV.x * dt * 6, e.knockV.z * dt * 6);
            e.knockV.multiplyScalar(Math.exp(-8 * dt));
          }
          // convulsion + dimming — never a hue change
          const k = Math.sin(e.stunT * 34) * 0.12;
          e.mesh.rotation.z = k;
          e.mesh.userData.mat.color.setScalar(0.06 + Math.abs(k));
          if (e.stunT <= 0) {
            e.mesh.rotation.z = 0;
            e.mesh.rotation.x = 0;
            e.mesh.userData.mat.color.setHex(BASE_COLOR[e.kind]);
            e.state = 'wind';
            e.windT = e.spec.windup * 0.5;
          }
          break;
        }
        case 'dying': {
          // a physical death: launched along the throw, tumbling, shrinking —
          // a corpse that goes somewhere instead of a mesh that blinks out
          e.deadT -= dt;
          e.pos.x += e.deadV.x * dt;
          e.pos.z += e.deadV.z * dt;
          e.deadY = Math.max(0, (e.deadY ?? 0) + e.deadV.y * dt);
          e.deadV.y -= 13 * dt;
          e.pos.y = game.world.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1) + e.deadY;
          e.mesh.rotation.x += dt * 5.5;
          e.mesh.scale.setScalar(Math.pow(Math.max(0.001, e.deadT / 0.62), 0.65) * e.spec.scale);
          if (e.deadT <= 0) this._remove(e);
          break;
        }
      }

      // ---- gait ----
      if (e.state === 'chase' || e.state === 'stalk') {
        const rate = e.state === 'chase' ? 11 : 3.5;
        e.phase += dt * rate;
        const L = e.mesh.userData.limbs;
        L.legs[0].rotation.x = Math.sin(e.phase) * 0.6;
        L.legs[1].rotation.x = -Math.sin(e.phase) * 0.6;
        if (e.state === 'chase') {
          L.arms[0].rotation.x = -1.7 + Math.sin(e.phase * 2) * 0.15;   // reaching for you
          L.arms[1].rotation.x = -1.7 - Math.sin(e.phase * 2) * 0.15;
        } else {
          L.arms[0].rotation.x = -Math.sin(e.phase) * 0.35;
          L.arms[1].rotation.x = Math.sin(e.phase) * 0.35;
        }
      }
      if (e.state !== 'dying') e.pos.y = game.world.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1);
      e.mesh.position.copy(e.pos);
      if (e.state !== 'dormant' && e.state !== 'dying' && dist > 0.1) {
        e.mesh.rotation.y = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
      }
      // a stunned Standing One resumes standing, not chasing
      if (e.state === 'wind' && e.kind === 'walker' && e.standing) { e.state = 'standing'; }

      // ---- skull contact ----
      // iframes: without them the return flight sweeps back through the body it
      // just stunned and auto-pops it — making the quiet option impossible.
      // A hit grants 0.6s immunity; popping takes a deliberate second THROW.
      e.iframes = Math.max(0, (e.iframes || 0) - dt);
      if (e.state !== 'dying' && e.iframes <= 0 && (skull.mode === 'outbound' || skull.mode === 'returning') && skull.vel.length() > 8) {
        if (this._skullIntersects(e, skull.prevPos, skull.pos)) {
          e.iframes = 0.6;
          const speed = skull.vel.length();
          const hitInt = clamp((speed - 8) / 30, 0, 1);
          // the carom: contact must be visible in the trajectory — the skull
          // kicks off the body BEFORE the return law bends it home. No clock
          // is touched, so the kick-ball law survives intact.
          const away = V.d.set(skull.pos.x - e.pos.x, (skull.pos.y - (e.pos.y + 1.2)) * 0.3, skull.pos.z - e.pos.z).normalize();
          const travX = skull.pos.x - skull.prevPos.x, travZ = skull.pos.z - skull.prevPos.z;
          const travL = Math.hypot(travX, travZ) || 1;
          if (e.state === 'stunned' && e.spec.hp !== Infinity) {
            this._pop(e, travX / travL, travZ / travL, speed);
            skull.vel.copy(away).multiplyScalar(speed * 0.5);
            skull.jaw.rotation.x = 0.65;             // it comes back grinning
            skull.beginReturn('hit');
          } else if (e.state !== 'stunned') {
            // QUIET tier: it staggers, gives ground, and its voice gasps
            this._releaseGraveClaim(e, 0.65);
            e.state = 'stunned';
            e.stunT = e.spec.stun;
            e.recoilT = 0.12;
            if (!e.knockV) e.knockV = new THREE.Vector3();
            e.knockV.set(travX / travL, 0, travZ / travL)
              .multiplyScalar(clamp(speed * 0.03, 0.45, 0.9));
            game.impact('hurt', skull.pos);
            game.audio.thud({ pos: e.pos, gain: 0.55 + hitInt * 0.35, rate: 0.9 + hitInt * 0.3, intensity: hitInt, crack: true });
            if (e.loop && e.loop.choke) e.loop.choke();
            skull._flourishT = 0.3;                  // the tooth CLACK is the hit marker
            game.audio.catchThud({ pos: skull.pos, gain: 0.35, rate: 1.8 });
            skull.vel.copy(away).multiplyScalar(speed * 0.35);
            skull.beginReturn('hit');
          } else {
            // re-hitting a stunned unkillable: the collapsing ring — it cannot
            // be put down, only paused. taught with zero words.
            game.impact('locked', skull.pos);
            game.audio.thud({ pos: e.pos, gain: 0.5, rate: 0.55, intensity: 0.2 });
            skull.vel.copy(away).multiplyScalar(speed * 0.45);
            skull.beginReturn('hit');
          }
        }
      }

      // ---- audio threat (Behind You math; rear term needs flat vectors) ----
      if (e.loop) {
        e.loop.setPos(e.pos.x, e.pos.y + 1.5, e.pos.z);
        const warn = e.kind === 'kneeler' ? 40 : 24;
        const threat = smoothstep(0, 1, 1 - clamp((dist - 1) / warn, 0, 1));
        const near = smoothstep(0, 1, 1 - clamp((dist - 1) / 9, 0, 1));
        const toE = V.c.set(e.pos.x - camPos.x, 0, e.pos.z - camPos.z).normalize();
        const rear = clamp(-camFwd.dot(toE), 0, 1) * near;
        const active = e.state === 'chase' || e.state === 'wind' || e.state === 'strike'
          ? 1 : e.state === 'dormant' ? 0.25 : 0.6;
        e.loop.setThreat(threat * active, near * active, rear * active);
      }

      // ---- skull radar ----
      if (e.state !== 'dormant' && Math.abs(player.pos.y - e.pos.y) < 2.5) {
        const level = clamp(1 - dist / 26, 0, 1) *
          (e.state === 'chase' || e.state === 'strike' ? 1 : 0.55);
        if (level > maxThreat) {
          maxThreat = level;
          threatDir = V.c.set(e.pos.x - camPos.x, 0, e.pos.z - camPos.z).normalize().clone();
        }
      }
    }

    skull.setThreat(maxThreat, threatDir);
    game.lastThreat = maxThreat;
    game.audio.setTension(Math.max(game.baseTension || 0, maxThreat));
  }

  _pop(e, dirX = 0, dirZ = 0, speed = 20) {
    const game = this.game;
    this._releaseGraveClaim(e, 0.72);
    // the LOUD tier owns the longest stop in the game — the load-bearing
    // distinction is time: if the game stutters, you ended something.
    game.impact('pop', e.pos);
    game.audio.pop({ pos: e.pos, gain: 1.0 });
    game.gore(e.pos, 10 + Math.round(clamp((speed - 8) / 30, 0, 1) * 8), speed);
    // the corpse goes SOMEWHERE: launched along the throw, tumbling, shrinking
    e.state = 'dying';
    e.deadT = 0.62;
    e.deadY = 0.9;
    e.deadV = new THREE.Vector3(dirX, 0, dirZ).multiplyScalar(5.5);
    e.deadV.y = 4.5;
    if (e.loop) { e.loop.stop(); e.loop = null; }
    // the house keeps the score: a dark stain where it burst, forever
    const stain = new THREE.Mesh(STAIN_GEO, STAIN_MAT);
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(e.pos.x,
      game.world.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1) + 0.015, e.pos.z);
    stain.rotation.z = Math.random() * Math.PI;
    stain.scale.set(0.8 + Math.random() * 0.5, 1 + Math.random() * 0.6, 1);
    game.scene.add(stain);
    game.flag('firstPop');
    // popping is loud. everything nearby turns toward the sound.
    this.wakeAll(e.pos.x, e.pos.z, 30);
    if (game.director) game.director.onPop(e);
  }

  _bestDoorNode(e) {
    // nearest useful doorway: passable (open — or merely unlocked, if you are
    // the Resident) on this storey, scoring approach + remaining distance
    const player = this.game.player;
    let best = null, bestScore = Infinity;
    for (const d of this.game.world.doors) {
      if (Math.abs(d.floor - e.pos.y) > 1.8) continue;
      const passable = d.open || (e.kind === 'resident' && !d.locked);
      if (!passable) continue;
      const de = Math.hypot(d.center.x - e.pos.x, d.center.z - e.pos.z);
      if (de < 1.2 || de > 30) continue;
      const dp = Math.hypot(d.center.x - player.pos.x, d.center.z - player.pos.z);
      const score = de + dp * 1.2;
      if (score < bestScore) { bestScore = score; best = { x: d.center.x, z: d.center.z, door: d }; }
    }
    return best;
  }

  _tryOpenDoor(e, dt) {
    // the Resident does doors. A shut door buys you a breath, not safety:
    // it stands there a moment — and then the knob turns.
    let door = null;
    for (const d of this.game.world.doors) {
      if (d.open || d.locked) continue;
      if (Math.abs(d.floor - e.pos.y) > 1.8) continue;
      if (Math.hypot(d.center.x - e.pos.x, d.center.z - e.pos.z) < 1.25) { door = d; break; }
    }
    if (door) {
      e._doorT = (e._doorT || 0) + dt;
      if (e._doorT > 1.15) {
        e._doorT = 0;
        door.setOpen(true);
        this.game.audio.doorOpen(true, { pos: door.group.position });
      }
    } else {
      e._doorT = 0;
    }
  }

  _moveWithPush(e, dx, dz) {
    e.pos.x += dx; e.pos.z += dz;
    const r = e.spec.r;
    for (const c of this.game.world.colliders) {
      if (c.max.y <= e.pos.y + 0.5 || c.min.y >= e.pos.y + 1.8) continue;
      const cx = clamp(e.pos.x, c.min.x, c.max.x);
      const cz = clamp(e.pos.z, c.min.z, c.max.z);
      const px = e.pos.x - cx, pz = e.pos.z - cz;
      const d2 = px * px + pz * pz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        e.pos.x += px * push;
        e.pos.z += pz * push;
        continue;
      }

      // When the center lands inside an AABB, clamping returns the center and
      // there is no radial normal. Escape through the nearest expanded face.
      const left = e.pos.x - (c.min.x - r);
      const right = (c.max.x + r) - e.pos.x;
      const back = e.pos.z - (c.min.z - r);
      const front = (c.max.z + r) - e.pos.z;
      const nearest = Math.min(left, right, back, front);
      if (nearest === left) e.pos.x = c.min.x - r;
      else if (nearest === right) e.pos.x = c.max.x + r;
      else if (nearest === back) e.pos.z = c.min.z - r;
      else e.pos.z = c.max.z + r;
    }
  }

  _segmentBlocked(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    for (const c of this.game.world.colliders) {
      if (c.skullPass || c.max.y <= c.min.y) continue;
      let near = 0.002, far = 0.998;

      if (Math.abs(dx) < 1e-8) {
        if (ax < c.min.x || ax > c.max.x) continue;
      } else {
        let t0 = (c.min.x - ax) / dx, t1 = (c.max.x - ax) / dx;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        near = Math.max(near, t0); far = Math.min(far, t1);
        if (near > far) continue;
      }

      if (Math.abs(dy) < 1e-8) {
        if (ay < c.min.y || ay > c.max.y) continue;
      } else {
        let t0 = (c.min.y - ay) / dy, t1 = (c.max.y - ay) / dy;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        near = Math.max(near, t0); far = Math.min(far, t1);
        if (near > far) continue;
      }

      if (Math.abs(dz) < 1e-8) {
        if (az < c.min.z || az > c.max.z) continue;
      } else {
        let t0 = (c.min.z - az) / dz, t1 = (c.max.z - az) / dz;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        near = Math.max(near, t0); far = Math.min(far, t1);
        if (near > far) continue;
      }
      return true;
    }
    return false;
  }

  _skullIntersects(e, a, b) {
    const h = e.spec.hit;
    const skullR = 0.11;
    const bodyR = h.r + skullR;
    if (segmentVerticalDistanceSq(
      a, b, e.pos.x, e.pos.y + h.y0, e.pos.y + h.y1, e.pos.z,
    ) <= bodyR * bodyR) return true;

    const shoulderR = h.shoulderR + skullR;
    if (pointSegmentDistanceSq(
      e.pos.x, e.pos.y + h.shoulderY, e.pos.z, a, b,
    ) <= shoulderR * shoulderR) return true;

    const headR = h.headR + skullR;
    return pointSegmentDistanceSq(
      e.pos.x, e.pos.y + h.headY, e.pos.z, a, b,
    ) <= headR * headR;
  }
}

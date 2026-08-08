// enemies.js — walkers, the Resident, the horde. Announced by footsteps and the
// skull's chatter long before they're seen. Faster than you. Stun is quiet;
// popping is LOUD and the dark answers it.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, TAU } from './util.js';

const KIND = {
  walker: { h: 2.05, r: 0.3, chase: 5.6, stalk: 1.1, hp: 1, stun: 2.8, scale: 1, windup: 1.1 },
  resident: { h: 2.5, r: 0.38, chase: 4.9, stalk: 0.9, hp: Infinity, stun: 1.6, scale: 1.22, windup: 0.8 },
  kneeler: { h: 4.4, r: 0.9, chase: 6.2, stalk: 0, hp: Infinity, stun: 0.4, scale: 2.4, windup: 2.2 },
};

const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };

function makeFigure(kind) {
  const spec = KIND[kind];
  const mat = new THREE.MeshLambertMaterial({ color: kind === 'resident' ? 0x100d12 : 0x16141a });
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.7, 4, 8), mat);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), mat);
  head.position.y = 1.78;
  head.rotation.z = 0.16;                       // the tilt is the wrongness
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xe8ecef });
  for (const s of [-1, 1]) {
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), glintMat);
    glint.position.set(s * 0.045, 1.79, 0.1);
    g.add(glint);
  }
  const limbs = { arms: [], legs: [] };
  for (const s of [-1, 1]) {
    const armP = new THREE.Group();
    armP.position.set(s * 0.22, 1.52, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.78, 3, 6), mat);
    arm.position.y = -0.42;
    armP.add(arm);
    limbs.arms.push(armP);
    const legP = new THREE.Group();
    legP.position.set(s * 0.1, 0.82, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.72, 3, 6), mat);
    leg.position.y = -0.4;
    legP.add(leg);
    limbs.legs.push(legP);
    g.add(armP, legP);
  }
  g.add(torso, head);
  g.scale.setScalar(spec.scale);
  g.userData = { mat, head, limbs };
  return g;
}

export class Enemies {
  constructor(game) {
    this.game = game;
    this.list = [];
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

  update(dt, ctx) {
    const game = this.game;
    const player = game.player;
    const skull = game.skull;
    const camPos = game.camera.getWorldPosition(V.a);
    const camFwd = game.camera.getWorldDirection(V.b);
    camFwd.y = 0; camFwd.normalize();

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
          // the Standing Kind: moves ONLY while unobserved — and only inside its
          // territory. Without the leash they trail the player's bubble across
          // the whole game and arrive three acts later as phantom stragglers.
          if (!e.home) e.home = { x: e.pos.x, z: e.pos.z };
          if (Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z) > 24) break;
          const toE = V.c.set(e.pos.x - camPos.x, 0, e.pos.z - camPos.z);
          const d2 = toE.length();
          const observed = d2 < 42 && camFwd.dot(toE.divideScalar(Math.max(d2, 0.001))) > 0.28;
          if (!observed && d2 < 30 && dist > 0.9) {
            toP.normalize();
            e.pos.addScaledVector(toP, 0.85 * dt);
            e.phase += dt * 2.2;                 // silent gait — no footsteps. worse.
          } else if (dist <= 0.9 && !game.dead) {
            game.director.death(e);
          }
          break;
        }
        case 'stalk': {
          if (dist > 1 && sameLevel) {
            toP.normalize();
            e.pos.addScaledVector(toP, e.spec.stalk * dt);
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
          if (dist > 0.85) {
            const sp = e.spec.chase * Math.min(1, 0.35 + e.windT * 0.4);
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
            if (e._stallT > 0.8) { e._via = this._bestDoorNode(e); e._stallT = 0; }
            if (e.kind === 'resident') this._tryOpenDoor(e, dt);
            e.stepT -= dt;
            if (e.stepT <= 0) {
              e.stepT = 0.26 + Math.random() * 0.06;
              game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.85, rate: 1.25 });
            }
          } else if (!game.dead) {
            game.director.death(e);
          }
          break;
        }
        case 'stunned': {
          e.stunT -= dt;
          // convulsion + dimming — never a hue change
          const k = Math.sin(e.stunT * 34) * 0.12;
          e.mesh.rotation.z = k;
          e.mesh.userData.mat.color.setScalar(0.06 + Math.abs(k));
          if (e.stunT <= 0) {
            e.mesh.rotation.z = 0;
            e.mesh.userData.mat.color.setHex(e.kind === 'resident' ? 0x100d12 : 0x16141a);
            e.state = 'wind';
            e.windT = e.spec.windup * 0.5;
          }
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
      e.pos.y = game.world.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1);
      e.mesh.position.copy(e.pos);
      if (e.state !== 'dormant' && dist > 0.1) {
        e.mesh.rotation.y = Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
      }
      // a stunned Standing One resumes standing, not chasing
      if (e.state === 'wind' && e.kind === 'walker' && e.standing) { e.state = 'standing'; }

      // ---- skull contact ----
      // iframes: without them the return flight sweeps back through the body it
      // just stunned and auto-pops it — making the quiet option impossible.
      // A hit grants 0.6s immunity; popping takes a deliberate second THROW.
      e.iframes = Math.max(0, (e.iframes || 0) - dt);
      if (e.iframes <= 0 && (skull.mode === 'outbound' || skull.mode === 'returning') && skull.vel.length() > 8) {
        const segD = this._pointSegDist(e.pos, skull.prevPos, skull.pos, e.spec.h * 0.5);
        if (segD < e.spec.r + 0.22) {
          e.iframes = 0.6;
          if (e.state === 'stunned' && e.spec.hp !== Infinity) {
            this._pop(e);
            skull.beginReturn('hit');
          } else if (e.state !== 'stunned') {
            e.state = 'stunned';
            e.stunT = e.spec.stun;
            game.impact('break', skull.pos);
            game.audio.thud({ pos: e.pos, gain: 0.8, rate: 0.7 });
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
        const active = e.state === 'chase' || e.state === 'wind' ? 1 : e.state === 'dormant' ? 0.25 : 0.6;
        e.loop.setThreat(threat * active, near * active, rear * active);
      }

      // ---- skull radar ----
      if (e.state !== 'dormant' && Math.abs(player.pos.y - e.pos.y) < 2.5) {
        const level = clamp(1 - dist / 26, 0, 1) * (e.state === 'chase' ? 1 : 0.55);
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

  _pop(e) {
    const game = this.game;
    game.impact('break', e.pos);
    game.audio.pop({ pos: e.pos, gain: 1.0 });
    game.gore(e.pos, 14);
    this._remove(e);
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
      if (d2 >= r * r || d2 < 1e-8) continue;
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      e.pos.x += px * push;
      e.pos.z += pz * push;
    }
  }

  _pointSegDist(p, a, b, yOffset) {
    const px = p.x, py = p.y + yOffset, pz = p.z;
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const len2 = abx * abx + aby * aby + abz * abz;
    let t = len2 > 1e-8 ? ((px - a.x) * abx + (py - a.y) * aby + (pz - a.z) * abz) / len2 : 0;
    t = clamp(t, 0, 1);
    const dx = a.x + abx * t - px, dy = a.y + aby * t - py, dz = a.z + abz * t - pz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

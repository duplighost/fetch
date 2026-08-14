// player.js — first-person controller. Capsule-vs-AABB with axis separation and
// stairs-as-ground-height, ported from the uninvited engine (its most proven part).
import * as THREE from 'three';
import { clamp, lerp, damp } from './util.js';

export const EYE = 1.62;
const RADIUS = 0.34;
const STEP_UP = 0.5;     // colliders topping out below feet+this are walkable
const HEAD = 1.75;       // colliders starting above feet+this are overhead
const WALK = 2.7;
const RUN = 4.7;
const GRAV = 14;
const JUMP_V = 5.2;
const SENS = 0.0022;

export class Player {
  constructor(camera, world, audio) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;

    this.pos = new THREE.Vector3(0, 0, 0);   // feet
    this.vel = new THREE.Vector3();          // smoothed horizontal intent
    this.fallV = 0;
    this.grounded = true;
    this.yaw = 0;
    this.pitch = 0;
    this.yawVel = 0;                          // rad/s, feeds skull steering bonus
    this.pitchVel = 0;

    this.bobPhase = 0;
    this.bobY = 0;
    this.landKick = 0;
    this.frozen = false;                      // cutscenes / overlays
    this.movementLocked = false;               // death may stop feet while preserving look
    this.reel = null;                         // retired; kept falsy for old checks
    this.swing = null;                        // { point, t, onLand, maxT } while on a rope
    this.running = false;
    this.speedRatio = 0;
    this.noise = 0;                           // how loud you are (walkers listen)
    this._railTouch = 0;                      // stair-guard contact this frame
    this._railHoldT = 0;                      // sustained contact -> one creak
    this._railCreakCd = 0;
    this._railPos = null;
  }

  look(dx, dy) {
    if (this.frozen) return;
    this.yaw -= dx * SENS;
    this.pitch = clamp(this.pitch - dy * SENS, -1.35, 1.35);
  }

  // THE LOSSLESS GRAB. This used to be launchTo(): it zeroed your fall, took
  // your input for three seconds and walked your position along a straight line
  // to a fixed landing pad. The rope was the best-feeling thing in the game and
  // it was a cutscene — and it broke the house rule that control is never taken.
  //
  // Now the bite CONVERTS your approach instead of discarding it. Whatever speed
  // you arrived with is rotated onto the tangent of the sphere around the anchor
  // and handed straight back. Nothing is subtracted. Run at it and it whips you
  // around it; fly past it and it swings you back; there is no such thing as a
  // grab you regret taking.
  beginSwing(point, opts = {}) {
    const a = point.clone();
    const eye = this.pos.y + EYE;
    const radial = new THREE.Vector3(a.x - this.pos.x, a.y - eye, a.z - this.pos.z);
    const d = Math.max(0.4, radial.length());
    radial.divideScalar(d);

    const v = new THREE.Vector3(this.vel.x, this.fallV, this.vel.z);
    const sp = v.length();
    const tan = v.clone().addScaledVector(radial, -v.dot(radial));
    if (tan.lengthSq() > 1e-5 && sp > 0.2) {
      tan.normalize().multiplyScalar(sp);
      this.vel.x = tan.x; this.vel.z = tan.z; this.fallV = tan.y;
    }
    this.swing = { point: a, t: 0, onLand: opts.onLand || null, maxT: opts.maxT || 6 };
    this.grounded = false;
    this.reel = null;
  }

  endSwing() {
    const s = this.swing;
    this.swing = null;
    if (!s) return;
    // you leave with the arc you built. No arrival pop, no reset to zero.
    if (s.onLand) s.onLand();
  }

  // death, respawn and teleports drop the rope without paying out its reward
  abortSwing() {
    this.swing = null;
  }

  update(dt, frame) {
    const prevYaw = this.yaw, prevPitch = this.pitch;
    if (frame && !this.frozen) {
      if (frame.lookX || frame.lookY) this.look(frame.lookX || 0, frame.lookY || 0);
    }
    this.yawVel = (this.yaw - prevYaw) / Math.max(dt, 1e-4);
    this.pitchVel = (this.pitch - prevPitch) / Math.max(dt, 1e-4);

    const motionLocked = this.frozen || this.movementLocked;
    const mX = motionLocked ? 0 : (frame ? frame.moveX || 0 : 0);
    const mZ = motionLocked ? 0 : (frame ? frame.moveZ || 0 : 0);
    this.running = !motionLocked && !!(frame && frame.run) && mZ > 0.01;
    const speed = this.running ? RUN : WALK;

    // wish direction: forward = (-sin yaw, -cos yaw)
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const fx = -s, fz = -c, rx = c, rz = -s;
    let wx = rx * mX + fx * mZ, wz = rz * mX + fz * mZ;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    if (this.swing) {
      // The rope pulls, gravity still argues with it, and the ordinary
      // integration and collision below still run — so you are never inside
      // geometry and never out of control. Air-steer stays live at a fraction
      // of ground authority: you can shape the arc, you cannot cancel it.
      const s = this.swing;
      s.t += dt;
      const eye = this.pos.y + EYE;
      const to = new THREE.Vector3(s.point.x - this.pos.x, s.point.y - eye, s.point.z - this.pos.z);
      const d = to.length();
      const held = !!(frame && frame.throwHeld) && !motionLocked;
      if (!held || d < 1.15 || s.t > s.maxT) {
        this.endSwing();
      } else {
        to.divideScalar(d);
        const PULL = 30;                       // vs GRAV 14 — it can lift you
        this.vel.x += to.x * PULL * dt + wx * speed * dt * 1.6;
        this.vel.z += to.z * PULL * dt + wz * speed * dt * 1.6;
        this.fallV += to.y * PULL * dt;
        const h = Math.hypot(this.vel.x, this.vel.z);
        if (h > 21) { this.vel.x *= 21 / h; this.vel.z *= 21 / h; }
        this.grounded = false;
      }
    } else {
      this.vel.x = lerp(this.vel.x, wx * speed, Math.min(1, dt * 10));
      this.vel.z = lerp(this.vel.z, wz * speed, Math.min(1, dt * 10));
    }

    // axis-separated integration against AABBs
    this._moveAxis(this.vel.x * dt, 0);
    this._moveAxis(0, this.vel.z * dt);

    // sustained rail contact answers as wood, not void — one quiet creak,
    // rate-limited so a held lean cannot machine-gun it
    this._railCreakCd = Math.max(0, this._railCreakCd - dt);
    if (this._railTouch) {
      this._railTouch = 0;
      this._railHoldT += dt;
      if (this._railHoldT > 0.25 && this._railCreakCd <= 0) {
        this._railCreakCd = 2.4;
        this.audio.creak({ pos: this._railPos, gain: 0.38, rate: 0.8 });
      }
    } else {
      this._railHoldT = 0;
    }

    // vertical: ground height with stair glide
    const gh = this.world.groundHeightAt(this.pos.x, this.pos.z, this.pos.y);
    const dy = this.pos.y - gh;
    if (frame && frame.jumpPressed && this.grounded && !motionLocked) {
      this.fallV = JUMP_V;
      this.grounded = false;
    }
    if (!this.grounded || dy > 0.35) {
      this.fallV -= GRAV * dt;
      this.pos.y += this.fallV * dt;
      if (this.pos.y <= gh) {
        if (this.fallV < -6) {
          this.landKick = clamp(-this.fallV / 14, 0.2, 1);
          this.audio.footstep(this.world.surfaceAt(this.pos), { gain: 0.5 });
          this.noise = Math.max(this.noise, 0.7);
        }
        this.pos.y = gh;
        this.fallV = 0;
        this.grounded = true;
      }
    } else if (dy > 0.02) {
      this.pos.y = Math.max(gh, this.pos.y - 8 * dt);       // descending stairs glide
    } else {
      this.pos.y = lerp(this.pos.y, gh, Math.min(1, dt * 14)); // climbing steps
      this.grounded = true;
    }

    // world may clamp us into a corridor (forest spline)
    if (this.world.postClamp) this.world.postClamp(this.pos, dt);

    // head bob drives footsteps — feet and sound can never desync
    const horiz = Math.hypot(this.vel.x, this.vel.z);
    this.speedRatio = clamp(horiz / RUN, 0, 1);
    if (this.grounded && horiz > 0.3) {
      const rate = this.running ? 9.4 : 6.2;
      const prev = Math.sin(this.bobPhase);
      this.bobPhase += dt * rate * (0.4 + this.speedRatio * 0.6);
      if (prev >= 0 && Math.sin(this.bobPhase) < 0 || prev < 0 && Math.sin(this.bobPhase) >= 0) {
        const surf = this.world.surfaceAt(this.pos);
        this.audio.footstep(surf, { gain: this.running ? 0.5 : 0.3 });
        this.noise = Math.max(this.noise, this.running ? 0.85 : 0.35);
        if (this.onStep) this.onStep(surf);
      }
    }
    this.noise = Math.max(0, this.noise - dt * 1.6);
    this._sync(dt);
  }

  _moveAxis(dx, dz) {
    this.pos.x += dx;
    this.pos.z += dz;
    const feet = this.pos.y;
    for (const c of this.world.colliders) {
      if (c.max.y <= feet + STEP_UP) continue;   // walkable step
      if (c.min.y >= feet + HEAD) continue;      // overhead
      // closest point in XZ
      const cx = clamp(this.pos.x, c.min.x, c.max.x);
      const cz = clamp(this.pos.z, c.min.z, c.max.z);
      let px = this.pos.x - cx, pz = this.pos.z - cz;
      const d2 = px * px + pz * pz;
      if (d2 >= RADIUS * RADIUS) continue;
      const bx = this.pos.x, bz = this.pos.z;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (RADIUS - d) / d;
        this.pos.x += px * push;
        this.pos.z += pz * push;
      } else {
        // center inside the box: push out the shallowest face
        const outs = [
          [this.pos.x - (c.min.x - RADIUS), -1, 0],
          [(c.max.x + RADIUS) - this.pos.x, 1, 0],
          [this.pos.z - (c.min.z - RADIUS), 0, -1],
          [(c.max.z + RADIUS) - this.pos.z, 0, 1],
        ].sort((a, b) => a[0] - b[0])[0];
        this.pos.x += outs[1] * outs[0];
        this.pos.z += outs[2] * outs[0];
      }
      if (this.grounded) {
        this._railShed(c, this.pos.x - bx, this.pos.z - bz, cx, cz);
      }
    }
  }

  // A flight's side barrier — the tagged edge-guard AABB, or the storey wall
  // whose bottom hangs into the head window over the open stair edge — used to
  // delete the whole blocked component and pin the player dead mid-flight
  // ("the basement was catching me"). Grounded on that flight's treads, the
  // blocked perpendicular motion is re-aimed down-flight instead: the rail
  // still stops you, then sheds you along it like a banister. Not standing on
  // treads means no ramp resolves here, so ordinary wall sliding is untouched.
  _railShed(c, pushX, pushZ, cx, cz) {
    let ramp = null;
    for (const r of this.world.ramps) {
      if (!r.treadColliders || !r.treadColliders.length) continue;
      if (this.pos.x < r.x0 || this.pos.x > r.x1 ||
          this.pos.z < r.z0 || this.pos.z > r.z1) continue;
      const on = r.treadColliders.some((t) =>
        this.pos.x >= t.min.x && this.pos.x <= t.max.x &&
        this.pos.z >= t.min.z && this.pos.z <= t.max.z &&
        this.pos.y >= t.max.y - 0.05 && this.pos.y <= t.max.y + 0.3);
      if (on) { ramp = r; break; }
    }
    if (!ramp) return;
    const alongZ = ramp.axis === 'z';
    // only barriers hugging this flight's side boundary read as its rail
    const isRail = c.stairPart === 'edge'
      ? c.stairId === (ramp.id || 'stairs')
      : alongZ
        ? (c.max.x <= ramp.x0 + 0.15 || c.min.x >= ramp.x1 - 0.15)
        : (c.max.z <= ramp.z0 + 0.15 || c.min.z >= ramp.z1 - 0.15);
    if (!isRail) return;
    const blocked = Math.abs(alongZ ? pushX : pushZ);   // perpendicular pushback only
    if (blocked < 1e-7) return;
    const downhill = Math.sign(
      (ramp.y0 - ramp.y1) * (alongZ ? ramp.z1 - ramp.z0 : ramp.x1 - ramp.x0));
    if (!downhill) return;
    // input keeps full authority: an intentional climb is never dragged back
    const vAlong = alongZ ? this.vel.z : this.vel.x;
    if (vAlong * downhill < -0.4) return;
    if (alongZ) this.pos.z += downhill * blocked;
    else this.pos.x += downhill * blocked;
    this._railTouch = 1;
    this._railPos = { x: cx, y: this.pos.y + 0.9, z: cz };
  }

  _sync(dt) {
    this.bobY = 0;
    if (this.grounded) {
      const amp = this.running ? 0.05 : 0.028;
      this.bobY = Math.abs(Math.sin(this.bobPhase)) * amp * this.speedRatio;
    }
    this.landKick = Math.max(0, this.landKick - dt * 2.8);
    const dip = this.landKick * this.landKick * 0.14;
    this.camera.position.set(
      this.pos.x + Math.sin(this.bobPhase * 0.5) * 0.02 * this.speedRatio,
      this.pos.y + EYE + this.bobY - dip,
      this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase * 0.5) * 0.004 * this.speedRatio, 'YXZ');
  }
}

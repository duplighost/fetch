// skull.js — the cursed skull: throw / return / fetch / latch / grow.
// The return law is ported from kick-ball's FEEL_PROFILE (the law): exponential
// velocity bend, never decelerates on approach, monotonic clocks, duration-only
// quick call. Scaled for interiors.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, TAU } from './util.js';
import { LAYER_HELD } from './mirrors.js';
import { buildSkullMesh as buildVariantA } from './skull-variant-a.js';
import { buildSkullMesh as buildVariantB } from './skull-variant-b.js';

export const FEEL_PROFILE = Object.freeze({
  name: 'fetch-core',
  chargeTime: 0.6,           // (unused — charge removed; the button is the tether)
  launchBase: 26,
  launchCharge: 22,          // (unused)
  inheritVel: 0.22,
  outboundBase: 0.8,
  outboundCharge: 0.5,
  hardAwayBase: 1.9,
  hardAwayCharge: 0.5,
  poiseDrift: 6.5,           // aim-steer speed while poised (m/s)
  poiseMax: 22,              // poised failsafe — it never hangs forever
  bounceReturnTime: 0.40,
  guideStrength: 8.5,
  gravityOut: 6.5,
  maxRangeBase: 14,
  maxRangeCharge: 26,
  bounceGain: 1.05,
  bounceCap: 44,
  returnFallback: 2.4,
  returnStuckFallback: 0.7,
  returnSpeedFloor: 26,
  returnSpeedRetention: 0.93,
  returnSpeedCap: 50,
  returnSnapBonus: 14,
  returnBendRate: 9,
  returnSnapBendRate: 15,
  catchRadius: 1.35,
  cradleDist: 2.4,
  cradleDrop: 0.75,
  snapBuffer: 0.12,
});

const MODES = ['held', 'outbound', 'poised', 'returning', 'anchored', 'gone'];

const V = {
  a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
  d: new THREE.Vector3(), e: new THREE.Vector3(), f: new THREE.Vector3(),
};
// _checkTargets runs mid-flight-update and must NOT alias V.* — camPos/viewDir
// live there across the call (aliasing them cost a day of 'why does the forest
// eat throws')
const W = {
  a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
  d: new THREE.Vector3(),
};

export class Skull {
  constructor({ scene, camera, audio, world, mats, variant }) {
    this.variant = variant || null;
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.world = world;
    this.mats = mats;

    this.mode = 'held';
    this.stage = 0;
    this.carry = null;          // { id, mesh } clamped in the teeth
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.charge = 0;
    this.charging = false;

    // flight clocks — MONOTONIC; nothing may rewind them (kick-ball law)
    this.flightTime = 0;        // real time since launch
    this.freeFlightTime = 0;    // scaled by controlled-hold; only ever advances
    this.outboundDuration = 0;
    this.hardAway = 0;
    this.maxRange = 0;
    this.bounced = false;
    this.lastFlightSpeed = 0;
    this.returnTime = 0;
    this.returnStuck = 0;
    this.returnSide = 1;
    this.snapReturn = false;
    this.anchor = null;         // { point, onArrive } while latched

    // threat radar (set each frame by enemies/director)
    this.threat = 0;
    this.threatDir = new THREE.Vector3(0, 0, -1);
    this._gazeWander = 0;
    this._idleT = 0;
    this._jawSnapT = 2.5;
    this._spin = 0;

    this._buildMesh();
    this._buildViewmodel();
    this.holdNow();
  }

  // ---------------------------------------------------------------- mesh
  _buildMesh() {
    // Pro-farm variants: ?skull=a (the anatomist) / ?skull=b (the engineer).
    // Alex judges in-game; the winner becomes the default.
    if (this.variant === 'a' || this.variant === 'b') {
      const parts = (this.variant === 'a' ? buildVariantA : buildVariantB)(this.mats.bone);
      this.root = parts.root;
      this.jaw = parts.jaw;
      this.jawMount = parts.jawMount;
      this.sockets = parts.sockets;
      this.eyeL = parts.eyeL;
      this.eyeR = parts.eyeR;
      this.stageSets = parts.stageSets;
      return;
    }
    const bone = this.mats.bone;
    const g = new THREE.Group();
    g.name = 'skull';

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16), bone);
    cranium.scale.set(1, 0.92, 1.12);
    g.add(cranium);

    const cheekGeo = new THREE.SphereGeometry(0.028, 10, 8);
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(cheekGeo, bone);
      cheek.position.set(s * 0.055, -0.03, 0.062);
      cheek.scale.set(1, 0.75, 0.9);
      g.add(cheek);
    }

    const socketMat = new THREE.MeshBasicMaterial({ color: 0x030303 });
    const socketGeo = new THREE.SphereGeometry(0.027, 10, 8);
    this.sockets = [];
    for (const s of [-1, 1]) {
      const socket = new THREE.Mesh(socketGeo, socketMat);
      socket.position.set(s * 0.037, -0.004, 0.077);
      socket.scale.set(1, 1.15, 0.5);
      g.add(socket);
      this.sockets.push(socket);
    }
    const nasal = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.032, 4), socketMat);
    nasal.position.set(0, -0.038, 0.088);
    nasal.rotation.x = Math.PI;
    g.add(nasal);

    // teeth: upper row fixed, lower row rides the jaw
    const toothGeo = new THREE.BoxGeometry(0.011, 0.016, 0.008);
    const upper = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 1.15;
      const t = new THREE.Mesh(toothGeo, bone);
      t.position.set(Math.sin(a) * 0.052, -0.066, Math.cos(a) * 0.078);
      t.rotation.y = a;
      upper.add(t);
    }
    g.add(upper);

    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.055, 0.01);
    const jawArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.013, 8, 14, Math.PI * 1.1), bone);
    jawArc.rotation.x = Math.PI / 2;
    jawArc.rotation.z = Math.PI * -0.05;
    jawArc.position.set(0, -0.028, 0.028);
    this.jaw.add(jawArc);
    for (let i = 0; i < 6; i++) {
      const a = (i / 5 - 0.5) * 1.05;
      const t = new THREE.Mesh(toothGeo, bone);
      t.position.set(Math.sin(a) * 0.048, -0.02, Math.cos(a) * 0.072 + 0.008);
      t.rotation.y = a;
      this.jaw.add(t);
    }
    this.jawMount = new THREE.Object3D();   // carried items clamp here
    this.jawMount.position.set(0, -0.028, 0.085);
    this.jaw.add(this.jawMount);
    g.add(this.jaw);

    // ---- growth stages ----
    const muscleMat = new THREE.MeshStandardMaterial({ color: 0x4a2622, roughness: 0.55 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d8178, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x131110, roughness: 0.95 });
    this.stageSets = [[], [], [], [], [], []];

    const patch = (mat, x, y, z, sc, sq = 0.45) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 1), mat);
      m.position.set(x, y, z);
      m.scale.set(sc, sc * sq, sc);
      m.lookAt(0, 0, 0);
      g.add(m);
      m.visible = false;
      return m;
    };
    // stage 1 — patches of muscle
    this.stageSets[1].push(
      patch(muscleMat, 0.075, -0.02, 0.045, 1.2),
      patch(muscleMat, -0.06, 0.03, 0.06, 1.0),
      patch(muscleMat, 0.05, 0.055, -0.04, 1.35),
      patch(muscleMat, -0.075, -0.035, 0.02, 0.9),
    );
    // stage 2 — skin creeps in, first eye
    this.stageSets[2].push(
      patch(skinMat, 0.07, 0.01, 0.055, 1.5),
      patch(skinMat, -0.05, 0.06, 0.03, 1.3),
      patch(muscleMat, 0, 0.04, 0.085, 1.1),
    );
    const mkEye = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.037, -0.004, 0.075);
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.15 }));
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.0085, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
      pupil.position.z = 0.017;
      pivot.add(ball, pupil);
      pivot.visible = false;
      g.add(pivot);
      return pivot;
    };
    this.eyeL = mkEye(-1);
    this.eyeR = mkEye(1);
    this.stageSets[2].push(this.eyeL);
    // stage 3 — second eye, more skin
    this.stageSets[3].push(
      this.eyeR,
      patch(skinMat, -0.07, -0.01, 0.045, 1.5),
      patch(skinMat, 0.05, -0.045, 0.055, 1.2),
      patch(skinMat, 0, 0.08, 0, 1.8),
    );
    // stage 4 — hair, nose
    const hairSet = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const r = 0.055 + (i % 3) * 0.012;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05 + (i % 4) * 0.02, 5), hairMat);
      tuft.position.set(Math.cos(a) * r, 0.085, Math.sin(a) * r * 0.8 - 0.02);
      tuft.rotation.z = Math.cos(a) * 0.5;
      tuft.rotation.x = -Math.sin(a) * 0.5;
      tuft.visible = false;
      g.add(tuft);
      hairSet.push(tuft);
    }
    const nose = patch(skinMat, 0, -0.032, 0.092, 0.85, 0.8);
    this.stageSets[4].push(...hairSet, nose);
    // stage 5 — a complete head
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.0975, 20, 16), skinMat);
    face.scale.set(1, 0.93, 1.1);
    face.visible = false;
    g.add(face);
    const lips = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 12), muscleMat);
    lips.position.set(0, -0.062, 0.088);
    lips.scale.set(1, 0.6, 0.5);
    lips.visible = false;
    g.add(lips);
    this.stageSets[5].push(face, lips);
    this.face5 = face;

    this.root = g;
  }

  _buildViewmodel() {
    // real hands cradling the skull from below — fingers, knuckles, a thumb.
    // The grip is expressive: it tightens with threat, trembles with the
    // chatter, and falls open and empty while the skull is away.
    const hold = new THREE.Group();
    hold.position.set(0.17, -0.31, -0.7);
    hold.scale.setScalar(1.15);
    const skin = new THREE.MeshStandardMaterial({ color: 0x584d42, roughness: 0.82 });
    const knuckleSkin = new THREE.MeshStandardMaterial({ color: 0x60544a, roughness: 0.76 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });

    const mkFinger = (parent, x, y, z, scale, yaw) => {
      const k1 = new THREE.Group();
      k1.position.set(x, y, z);
      k1.rotation.y = yaw;
      const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011 * scale, 0.034 * scale, 3, 6), skin);
      s1.rotation.x = Math.PI / 2;
      s1.position.z = 0.026 * scale;
      k1.add(s1);
      const k2 = new THREE.Group();
      k2.position.set(0, 0, 0.052 * scale);
      const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095 * scale, 0.03 * scale, 3, 6), knuckleSkin);
      s2.rotation.x = Math.PI / 2;
      s2.position.z = 0.021 * scale;
      k2.add(s2);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0095 * scale, 6, 5), skin);
      tip.position.set(0, 0.002, 0.042 * scale);
      k2.add(tip);
      k1.add(k2);
      parent.add(k1);
      return { k1, k2 };
    };

    this._fingers = [];
    const mkHand = (side) => {
      const hand = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), skin);
      palm.scale.set(1.15, 0.42, 1.45);
      hand.add(palm);
      const heel = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), skin);
      heel.position.set(0, -0.004, -0.05);
      heel.scale.set(1.2, 0.55, 0.9);
      hand.add(heel);
      for (let i = 0; i < 4; i++) {
        const f = mkFinger(hand, (i - 1.5) * 0.027, 0.006, 0.062, 1 - Math.abs(i - 1.2) * 0.09, (i - 1.5) * 0.06);
        f.phase = i * 0.9;
        this._fingers.push(f);
      }
      const thumb = mkFinger(hand, side * -0.055, 0.004, 0.005, 1.12, side * -1.15);
      thumb.phase = 4.2;
      thumb.thumb = true;
      this._fingers.push(thumb);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.24, 8), sleeveMat);
      sleeve.position.set(0, -0.03, -0.15);
      sleeve.rotation.x = 1.3;
      hand.add(sleeve);
      return hand;
    };

    const L = mkHand(-1);
    L.position.set(-0.118, -0.2, 0.035);
    L.rotation.set(-0.7, 0.78, 0.3);
    const R = mkHand(1);
    R.position.set(0.118, -0.2, 0.035);
    R.rotation.set(-0.7, -0.78, -0.3);
    hold.add(L, R);

    // forearms: sleeves running off the bottom corners of the frame — the
    // hands must read as YOURS, arms rooted in your body, never as parts of
    // the skull (playtest 2: "hands making glasses around its eyes")
    const mkForearm = (side) => {
      const a = new THREE.Vector3(side * 0.115, -0.2, -0.02);
      const b = new THREE.Vector3(side * 0.3, -0.62, 0.34);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.07, len, 10), sleeveMat);
      fore.position.copy(a).addScaledVector(dir, 0.5);
      fore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      hold.add(fore);
    };
    mkForearm(-1);
    mkForearm(1);

    this._grip = 0.55;
    this.hold = hold;
    this.camera.add(hold);
  }

  _updateHands(dt) {
    // grip target: cradling when held, tightening with threat, open when empty
    const held = this.mode === 'held';
    const target = held ? 0.5 + this.threat * 0.42 : 0.08;
    this._grip = damp(this._grip, target, held ? 6 : 3, dt);
    this._handT = (this._handT || 0) + dt;
    const tremble = held && this.threat > 0.05 ? Math.sin(this._handT * (10 + this.threat * 18)) * 0.05 * this.threat : 0;
    for (const f of this._fingers) {
      const wave = Math.sin(this._handT * 0.7 + f.phase) * 0.03;   // idle micro-life
      const curl = this._grip * (f.thumb ? 0.9 : 1.25) + wave + tremble;
      f.k1.rotation.x = -(0.35 + curl * 0.75);
      f.k2.rotation.x = -(0.3 + curl * 0.95);
    }
  }

  setLayers(layerFn) {
    // main.js calls this to put viewmodel content on LAYER_HELD
    this.hold.traverse(layerFn);
  }

  setStage(n) {
    this.stage = clamp(n | 0, 0, 5);
    for (let s = 1; s <= 5; s++) {
      const on = s <= this.stage;
      for (const m of this.stageSets[s]) m.visible = on;
    }
    if (this.eyeL) this.eyeL.visible = this.stage >= 2;
    if (this.eyeR) this.eyeR.visible = this.stage >= 3;
    // once it has a full face, sockets hide behind it
    for (const s of this.sockets) s.visible = this.stage < 5;
  }

  // ---------------------------------------------------------------- state
  holdNow() {
    this.mode = 'held';
    this.anchor = null;
    if (this.root.parent) this.root.parent.remove(this.root);
    this.root.position.set(0, 0, 0.02);
    this.root.rotation.set(0.52, 0, 0);   // face tipped up: it is looking at you
    this.root.scale.setScalar(1);
    this.hold.add(this.root);
    this.root.traverse((o) => o.layers.set(LAYER_HELD));
    this.audio.skullMoanStop();
  }

  gazeAt(dir, seconds = 3) {
    // scripted stare (the waterfall ask) — yields to real threats
    this.gazeOverride = { dir: dir.clone(), t: seconds };
  }

  grab(id, mesh) {
    // called by fetch targets: clamp an item in the teeth — and make sure the
    // player FEELS the clamp: snap-shut jaw, flourish spin, chime
    this.carry = { id, mesh };
    if (mesh.parent) mesh.parent.remove(mesh);
    mesh.position.set(0, -0.01, 0.045);
    mesh.rotation.set(0.4, 0, 0);
    this.jawMount.add(mesh);
    this.jaw.rotation.x = 0.3;
    this._flourishT = 0.45;
    this.audio.catchThud({ pos: this.pos, gain: 0.55, rate: 1.6 });   // tooth CLACK
    this.audio.unlock({ pos: this.pos, gain: 0.5, rate: 1.3 });       // bright metal chime
  }

  dropCarry() {
    if (!this.carry) return null;
    const c = this.carry;
    this.jawMount.remove(c.mesh);
    this.carry = null;
    return c;
  }

  tryThrow(ctx) {
    // Alex's grammar: press = throw, HOLD = it stays out, release = it comes
    // back. No charge — the button is the tether.
    if (this.mode !== 'held') return false;
    const P = FEEL_PROFILE;
    const dir = this.camera.getWorldDirection(V.a).clone();
    const camPos = this.camera.getWorldPosition(V.b);

    this.hold.remove(this.root);
    this.scene.add(this.root);
    this.root.traverse((o) => o.layers.set(0));
    this.pos.copy(camPos).addScaledVector(dir, 0.55);
    this.pos.y -= 0.08;
    this.prevPos.copy(this.pos);
    const speed = P.launchBase;
    this.vel.copy(dir).multiplyScalar(speed);
    if (ctx && ctx.playerVel) this.vel.addScaledVector(ctx.playerVel, P.inheritVel);

    this.mode = 'outbound';
    this.flightTime = 0;
    this.freeFlightTime = 0;
    this.bounced = false;
    this._bounceTimes = [];
    this._lastBounceSfx = undefined;
    this._poiseT = 0;
    this.outboundDuration = P.outboundBase;      // failsafe window for UNHELD flights
    this.hardAway = this.fearHome ? P.hardAwayBase * 0.6 : P.hardAwayBase;
    this.maxRange = P.maxRangeBase + P.maxRangeCharge;
    this.lastFlightSpeed = speed;
    this.returnSide = Math.random() < 0.5 ? -1 : 1;
    this.snapReturn = false;
    this._spin = 0;
    this.jaw.rotation.x = this.carry ? 0.3 : 0.55;   // it opens wide as it flies
    this.audio.skullMoanStart();
    return true;
  }

  call() {
    // duration-only quick call — never gated on motion (kick-ball law)
    if (this.mode === 'outbound' || this.mode === 'poised') {
      this.beginReturn('snap');
      return true;
    }
    if (this.mode === 'anchored') {
      this.anchor = null;
      this.beginReturn('snap');
      return true;
    }
    return false;
  }

  beginReturn(reason) {
    if (this.mode === 'returning' || this.mode === 'held' || this.mode === 'gone') return;
    this.mode = 'returning';
    this.returnTime = 0;
    this.returnStuck = 0;
    this.snapReturn = reason === 'snap';
    this.lastFlightSpeed = Math.max(this.lastFlightSpeed, this.vel.length());
  }

  anchorAt(point, opts = {}) {
    this.mode = 'anchored';
    this.anchor = { point: point.clone(), t: 0, ...opts };
    this.pos.copy(point);
    this.vel.set(0, 0, 0);
    this.jaw.rotation.x = 0.1;   // teeth clamp shut on the rope
  }

  vanish() {
    // the waterfall. it does not come back.
    this.mode = 'gone';
    if (this.root.parent) this.root.parent.remove(this.root);
    this.audio.skullMoanStop();
  }

  setThreat(level, dir) {
    this.threat = clamp(level, 0, 1);
    if (dir) this.threatDir.copy(dir);
  }

  // ---------------------------------------------------------------- update
  update(dt, ctx) {
    this._updateHands(dt);
    switch (this.mode) {
      case 'held': this._updateHeld(dt, ctx); break;
      case 'outbound': this._updateFlight(dt, ctx, false); break;
      case 'poised': this._updatePoised(dt, ctx); break;
      case 'returning': this._updateFlight(dt, ctx, true); break;
      case 'anchored': this._updateAnchored(dt, ctx); break;
      case 'gone': break;
    }
  }

  _updatePoised(dt, ctx) {
    // Alex's ask: "keep it stopped, then zip it back — aim it a little while
    // it's far away." It hangs where you parked it; holding the call button
    // drifts it toward your aim; tapping zips it home.
    const P = FEEL_PROFILE;
    this._poiseT = (this._poiseT || 0) + dt;
    this.vel.multiplyScalar(Math.exp(-10 * dt));
    if (ctx && ctx.callHeld && this._poiseT > 0.4) {
      const camPos = this.camera.getWorldPosition(V.a);
      const viewDir = this.camera.getWorldDirection(V.b);
      const guide = V.c.copy(camPos).addScaledVector(viewDir,
        clamp(this.pos.distanceTo(camPos), 3, 40));
      const to = V.d.copy(guide).sub(this.pos);
      const d = to.length();
      if (d > 0.2) this.pos.addScaledVector(to.divideScalar(d), Math.min(P.poiseDrift * dt, d));
    }
    this.pos.y += Math.sin(this._poiseT * 2.4) * 0.035 * dt * 8;   // it treads air
    this._collide(ctx);
    this._checkTargets(ctx);
    if (this.mode !== 'poised') return;
    // face the player. it waits, watching you.
    this.root.position.copy(this.pos);
    this.root.lookAt(this.camera.getWorldPosition(V.e));
    this.audio.skullMoanUpdate(this.pos, 1.5, 0.15);
    if (this._poiseT > P.poiseMax) this.beginReturn('auto');
  }

  _updateHeld(dt, ctx) {
    this._idleT += dt;
    const t = this._idleT;

    // breathing sway; pulls back and up while charging — it knows what's coming
    const c = this.charge;
    this.hold.position.x = 0.17 + Math.sin(t * 0.8) * 0.004;
    this.hold.position.y = -0.31 + Math.sin(t * 1.7) * 0.006 + (ctx ? ctx.bobY * 0.4 : 0) + c * 0.05;
    this.hold.position.z = -0.7 + c * 0.13;
    this.hold.rotation.z = Math.sin(t * 0.5) * 0.02 - c * 0.25;
    this.hold.rotation.x = c * 0.4;

    // eye contact (playtest-2 law): the held skull faces YOU — exactly,
    // always, whatever the hold sway or your pitch is doing. Its face is +Z.
    this.root.getWorldPosition(V.e);
    this.camera.getWorldPosition(V.f);
    if (V.e.distanceToSquared(V.f) > 1e-6) this.root.lookAt(V.f);

    // jaw: slow drift open, then SNAP shut. while charging it opens wide.
    this._jawSnapT -= dt;
    if (c > 0.05) {
      this.jaw.rotation.x = damp(this.jaw.rotation.x, 0.5 + c * 0.25, 8, dt);
    } else if (this.threat > 0.02) {
      // chatter: rate and bite scale with threat — this is the radar
      const rate = 6 + this.threat * 20;
      this.jaw.rotation.x = Math.max(0, Math.sin(t * rate * TAU * 0.5)) * (0.05 + this.threat * 0.14);
      this.audio.skullChatter(this.threat, this.root.getWorldPosition(V.c));
    } else if (this._jawSnapT < 0.35 && this._jawSnapT > 0) {
      this.jaw.rotation.x = damp(this.jaw.rotation.x, 0.4, 3, dt);   // slow creep open
    } else if (this._jawSnapT <= 0) {
      this.jaw.rotation.x = 0;                                       // SNAP
      this._jawSnapT = 3 + Math.random() * 6;
      this.audio.skullChatter(0.25, this.root.getWorldPosition(V.c));
    } else {
      this.jaw.rotation.x = damp(this.jaw.rotation.x, 0, 6, dt);
    }

    // eyes (stage 2+): track threats; otherwise wander; sometimes stare AT you
    if (this.gazeOverride) {
      this.gazeOverride.t -= dt;
      if (this.gazeOverride.t <= 0) this.gazeOverride = null;
      else if (this.threat < 0.3) this.threatDir.copy(this.gazeOverride.dir);
    }
    if (this.stage >= 2) {
      this._gazeWander -= dt;
      let gx = 0, gy = 0;
      if (this.threat > 0.05 || (this.gazeOverride && this.threat < 0.3)) {
        // threat direction in camera space → eye deflection past your shoulder
        const local = V.d.copy(this.threatDir);
        this.camera.worldToLocal(V.e.copy(this.camera.getWorldPosition(V.f)).add(local));
        gx = clamp(V.e.x * 1.4, -0.6, 0.6);
        gy = clamp(V.e.y * 1.0, -0.4, 0.4);
      } else if (this._gazeWander < 0) {
        this._gazeWander = 1.2 + Math.random() * 3;
        this._gazeTx = Math.random() < 0.3 ? 0 : (Math.random() - 0.5) * 0.9;  // 30%: stare at you
        this._gazeTy = Math.random() < 0.3 ? 0.1 : (Math.random() - 0.5) * 0.5;
      }
      if (this.threat <= 0.05) { gx = this._gazeTx || 0; gy = this._gazeTy || 0; }
      for (const eye of [this.eyeL, this.eyeR]) {
        if (!eye.visible) continue;
        eye.rotation.y = damp(eye.rotation.y, gx, 6, dt);
        eye.rotation.x = damp(eye.rotation.x, -gy, 6, dt);
      }
    }

    // stage 3+: it breathes
    if (this.stage >= 3) {
      const b = 1 + Math.sin(t * 2.1) * 0.012;
      this.root.scale.setScalar(b);
    }
  }

  _updateFlight(dt, ctx, returning) {
    const P = FEEL_PROFILE;
    const camPos = this.camera.getWorldPosition(V.a);
    const viewDir = this.camera.getWorldDirection(V.b);

    this.prevPos.copy(this.pos);

    if (!returning) {
      this.flightTime += dt;
      const held = !!(ctx && ctx.throwHeld);
      // held = out on the tether: the away-clock freezes; unheld flights
      // (bounced free, simulated) still auto-return on the failsafe window
      this.freeFlightTime += held ? 0 : dt;

      const sepNow = this.pos.distanceTo(camPos);
      const guide = V.c.copy(camPos).addScaledVector(viewDir,
        clamp(held ? sepNow + 7 : sepNow + 6, 8, this.maxRange));
      const speed = this.vel.length();
      const toGuide = V.d.copy(guide).sub(this.pos);
      const arrived = toGuide.length() < 1.2;

      if (held && (arrived || speed < 3)) {
        // it TREADS AIR where you parked it, facing you, tracking your aim
        this._poiseT += dt;
        this.vel.multiplyScalar(Math.exp(-10 * dt));
        const d = toGuide.length();
        if (d > 0.3) this.pos.addScaledVector(toGuide.divideScalar(d), Math.min(P.poiseDrift * dt, d));
        this.pos.y += Math.sin(this._poiseT * 2.4) * 0.03 * dt * 8;
        this._collide(ctx);
        this._checkTargets(ctx);
        if (this.mode !== 'outbound') { this._flightDress(dt, returning); return; }
        this.root.position.copy(this.pos);
        this.root.lookAt(camPos);
        this.audio.skullMoanUpdate(this.pos, 1.5, 0.15);
        if (this.flightTime > P.poiseMax) this.beginReturn('auto');   // never out forever
        return;
      }

      // in transit: steer toward the guide, direction-space, speed preserved
      if (speed > 1) {
        const want = V.d.copy(guide).sub(this.pos).normalize();
        const cur = V.e.copy(this.vel).divideScalar(speed);
        const sweep = ctx ? Math.min(4.5, Math.abs(ctx.yawVel) * 0.14 + Math.abs(ctx.pitchVel) * 0.1) : 0;
        const maxSteer = (P.guideStrength + sweep) * dt;
        const d = V.f.copy(want).sub(cur);
        if (d.length() > maxSteer) d.setLength(maxSteer);
        cur.add(d).normalize();
        this.vel.copy(cur).multiplyScalar(speed);
      }
      this.vel.y -= P.gravityOut * dt * (held ? 0.4 : 1);   // the tether carries some of its weight
      this.lastFlightSpeed = Math.max(this.lastFlightSpeed * 0.999, this.vel.length());

      this.pos.addScaledVector(this.vel, dt);
      this._collide(ctx);
      this._checkTargets(ctx);
      if (this.mode !== 'outbound') { this._flightDress(dt, returning); return; }

      const sep = this.pos.distanceTo(camPos);
      if (this.freeFlightTime >= this.outboundDuration ||
          (!held && this.flightTime >= this.hardAway) ||
          sep >= this.maxRange ||
          (!held && this.bounced && this.freeFlightTime > P.bounceReturnTime) ||
          (!held && this.vel.length() < 3.5) ||
          this.flightTime > P.poiseMax) {
        this.beginReturn('auto');
      }
    } else {
      this.returnTime += dt;
      const cradle = V.c.copy(camPos).addScaledVector(viewDir, P.cradleDist);
      cradle.y -= P.cradleDrop;
      const toC = V.d.copy(cradle).sub(this.pos);
      const d = toC.length();

      const earned = Math.max(P.returnSpeedFloor, this.lastFlightSpeed * P.returnSpeedRetention);
      const desired = Math.min(P.returnSpeedCap, earned + (this.snapReturn ? P.returnSnapBonus : 0));
      const dir = toC.divideScalar(Math.max(d, 0.001));

      // sideways arc — flattened 76% when called (the hot, straight line home)
      const arcAmt = this.returnSide *
        smoothstep(1.5, 8, d) * (1 - smoothstep(20, 40, d)) *
        (4.5 + Math.min(5, d * 0.14)) * (this.snapReturn ? 0.24 : 1);
      const right = V.e.set(-viewDir.z, 0, viewDir.x).normalize();
      const desiredVel = V.f.copy(dir).multiplyScalar(desired).addScaledVector(right, arcAmt);

      const bend = this.snapReturn ? P.returnSnapBendRate : P.returnBendRate;
      this.vel.lerp(desiredVel, 1 - Math.exp(-bend * dt));
      this.pos.addScaledVector(this.vel, dt);
      this._collide(ctx);
      this._checkTargets(ctx);
      if (this.mode !== 'returning') { this._flightDress(dt, returning); return; }

      // stuck detection: distance must keep shrinking
      const progress = this._lastD !== undefined ? this._lastD - d : 1;
      this._lastD = d;
      if (progress < 0.02 * (dt * 120)) this.returnStuck += dt;
      else this.returnStuck = Math.max(0, this.returnStuck - 1.7 * dt);

      const distPlayer = this.pos.distanceTo(camPos);
      if (d < 0.6 || distPlayer < P.catchRadius ||
          this.returnTime > P.returnFallback ||
          this.returnStuck > P.returnStuckFallback) {
        const hard = this.returnTime > P.returnFallback || this.returnStuck > P.returnStuckFallback;
        this._completeCatch(ctx, hard);
        return;
      }
    }
    this._flightDress(dt, returning);
  }

  _flightDress(dt, returning) {
    if (this.mode !== 'outbound' && this.mode !== 'returning') return;
    const speed = this.vel.length();
    this.root.position.copy(this.pos);
    if (returning) {
      // it comes back FACE FIRST, looking at you the whole way
      this.root.lookAt(this.camera.getWorldPosition(V.a));
      this.root.rotation.z = Math.sin(this.returnTime * 14) * 0.12;   // wobble, not tumble
    } else if (speed > 0.5) {
      // outbound: tumbling object, spin about the lateral axis
      this._spin += speed * dt * 2.2;
      V.a.copy(this.pos).add(this.vel);
      this.root.lookAt(V.a);
      this.root.rotateX(this._spin);
    }
    // grab flourish: a quick proud spin + swell when it takes something
    if (this._flourishT > 0) {
      this._flourishT = Math.max(0, this._flourishT - dt);
      const k = this._flourishT / 0.45;
      this.root.rotateZ(k * k * 0.5);
      this.root.scale.setScalar(1 + Math.sin((1 - k) * Math.PI) * 0.22);
    } else if (this.root.scale.x !== 1) {
      this.root.scale.setScalar(1);
    }
    const camPos = this.camera.getWorldPosition(V.b);
    const tension = returning
      ? 1 - clamp(this.pos.distanceTo(camPos) / 30, 0, 1)
      : clamp(this.freeFlightTime / Math.max(this.outboundDuration, 0.01), 0, 1) * 0.5;
    this.audio.skullMoanUpdate(this.pos, speed, this.snapReturn ? Math.max(tension, 0.6) : tension);
  }

  _completeCatch(ctx, hard) {
    // hard = failsafe fired: it is simply in your hands again. don't explain.
    const impact = clamp((this.vel.length() - 14) / 30, 0, 1);
    this.holdNow();
    this._lastD = undefined;
    this.audio.catchThud({ gain: 0.5 + impact * 0.5, rate: hard ? 0.8 : 1 });
    if (ctx && ctx.onCatch) ctx.onCatch(impact, hard);
  }

  _updateAnchored(dt, ctx) {
    const a = this.anchor;
    if (!a) { this.beginReturn('auto'); return; }
    a.t += dt;
    this.root.position.copy(this.pos);
    this.root.rotation.y += dt * 0.4;
    // failsafe: never hang forever
    if (a.t > (a.maxHold || 3.5)) {
      this.anchor = null;
      this.beginReturn('auto');
    }
  }

  // ------------------------------------------------------------- collision
  _collide(ctx) {
    const P = FEEL_PROFILE;
    const r = 0.1;
    const w = this.world;

    // ground
    const gh = w.groundHeightAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y - r < gh) {
      this.pos.y = gh + r;
      if (this.vel.y < 0) {
        this.vel.y *= -0.62;
        this.vel.x *= 0.96; this.vel.z *= 0.96;
        this._bounceFx(Math.abs(this.vel.y));
      }
    }

    // AABBs: push out along shallowest axis, reflect, bounce GAINS speed
    for (const c of w.colliders) {
      if (c.skullPass) continue;               // the open window lets it through
      if (this.pos.x < c.min.x - r || this.pos.x > c.max.x + r ||
          this.pos.y < c.min.y - r || this.pos.y > c.max.y + r ||
          this.pos.z < c.min.z - r || this.pos.z > c.max.z + r) continue;
      const dxl = this.pos.x - (c.min.x - r), dxr = (c.max.x + r) - this.pos.x;
      const dyl = this.pos.y - (c.min.y - r), dyr = (c.max.y + r) - this.pos.y;
      const dzl = this.pos.z - (c.min.z - r), dzr = (c.max.z + r) - this.pos.z;
      const m = Math.min(dxl, dxr, dyl, dyr, dzl, dzr);
      let n;
      if (m === dxl) { this.pos.x = c.min.x - r; n = 'x-'; }
      else if (m === dxr) { this.pos.x = c.max.x + r; n = 'x+'; }
      else if (m === dyl) { this.pos.y = c.min.y - r; n = 'y-'; }
      else if (m === dyr) { this.pos.y = c.max.y + r; n = 'y+'; }
      else if (m === dzl) { this.pos.z = c.min.z - r; n = 'z-'; }
      else { this.pos.z = c.max.z + r; n = 'z+'; }
      const speed = this.vel.length();
      if (n[0] === 'x') this.vel.x = -this.vel.x;
      else if (n[0] === 'y') this.vel.y = -this.vel.y;
      else this.vel.z = -this.vel.z;
      // a bounce gains speed — a skull that dies after two hits stops being fun
      this.vel.setLength(Math.min(P.bounceCap, Math.max(speed * P.bounceGain, 6)));
      this._bounceFx(speed);
      break;
    }
  }

  _bounceFx(speed) {
    this.bounced = true;
    const now = this.flightTime + this.returnTime;
    // pinball guard: ricochet storms wreck the mix and feel broken — three
    // bounces inside 0.4s means it's wedged in geometry; it comes home.
    this._bounceTimes = (this._bounceTimes || []).filter((t) => now - t < 0.4);
    this._bounceTimes.push(now);
    if (this._bounceTimes.length >= 3 && this.mode === 'outbound') {
      this.beginReturn('auto');
      return;
    }
    // SFX cooldown so stacked thuds can't max the compressor out
    if (this._lastBounceSfx !== undefined && now - this._lastBounceSfx < 0.1) return;
    this._lastBounceSfx = now;
    const g = clamp(speed / 28, 0.1, 1);
    this.audio.thud({ pos: this.pos, gain: 0.22 + g * 0.4, rate: 1.1 + Math.random() * 0.2 });
  }

  _checkTargets(ctx) {
    // swept segment prevPos→pos vs target spheres
    const seg = W.a.copy(this.pos).sub(this.prevPos);
    const segLen = seg.length();
    for (const t of this.world.fetchTargets) {
      if (!t.enabled) continue;
      const tp = t.object ? t.object.getWorldPosition(W.b) : W.b.copy(t.pos);
      const toT = W.c.copy(tp).sub(this.prevPos);
      const proj = segLen > 0.0001 ? clamp(toT.dot(seg) / (segLen * segLen), 0, 1) : 0;
      const closest = W.d.copy(this.prevPos).addScaledVector(seg, proj);
      if (closest.distanceTo(tp) > (t.radius || 0.5)) continue;
      const directive = t.onHit(this, closest, ctx) || 'return';
      if (directive === 'return') this.beginReturn('hit');
      else if (directive === 'gone') this.vanish();
      // 'continue' and 'anchor' (anchorAt was called inside onHit) fall through
      if (this.mode !== 'outbound' && this.mode !== 'returning') return;
      if (directive === 'return') return;
    }
  }

  getState() {
    return {
      mode: this.mode,
      stage: this.stage,
      carry: this.carry ? this.carry.id : null,
      pos: [+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), +this.pos.z.toFixed(2)],
      speed: +this.vel.length().toFixed(2),
      charge: +this.charge.toFixed(2),
      threat: +this.threat.toFixed(2),
    };
  }
}

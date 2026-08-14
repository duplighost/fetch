// skull.js — the cursed skull: throw / return / fetch / latch / grow.
// The return law is ported from kick-ball's FEEL_PROFILE (the law): exponential
// velocity bend, never decelerates on approach, monotonic clocks, duration-only
// quick call. Scaled for interiors.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, TAU } from './util.js';
import { LAYER_HELD } from './mirrors.js';

const _anchorLook = new THREE.Vector3();
import { buildSkullMesh as buildVariantA } from './skull-variant-a.js';
import { buildSkullMesh as buildVariantB } from './skull-variant-b.js';
import { buildSkullMesh as buildVariantC } from './skull-variant-c.js';
import { buildSkullMesh as buildVariantD } from './skull-variant-d.js';
import { buildSkullMesh as buildVariantA2 } from './skull-variant-a2.js';
import { buildSkullMesh as buildVariantE } from './skull-variant-e.js';

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
const HOLD_POSE = Object.freeze({ x: 0.13, y: -0.19, z: -0.64, scale: 1.34 });

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
    // The continuous anatomical shell is the shipping sculpt. `?skull=v0`
    // deliberately falls through to the original inline courier for visual
    // comparisons; the named sculpt-off variants remain available as well.
    this.variant = variant || 'e';
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.world = world;
    this.mats = mats;

    this.mode = 'held';
    this.stage = 0;
    this.pendingStage = 0;
    this.graveFear = false;       // expression only; never changes throw handling
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
    // Phase-local clocks reset at launch/recall, so their sum is not a valid
    // chronology for contact audio. This clock only advances.
    this._sfxClock = 0;

    // threat radar (set each frame by enemies/director)
    this.threat = 0;
    this.threatDir = new THREE.Vector3(0, 0, -1);
    this._gazeWander = 0;
    this._idleT = 0;
    this._jawSnapT = 2.5;
    this._spin = 0;

    this._buildMesh();
    this._buildViewmodel();
    this._buildTether();
    // A tiny jaw lamp only exists to make a carried key or charm readable in
    // flight. It is not a second flashlight and never changes progression.
    this.carryLight = new THREE.PointLight(0xd6b879, 0, 1.15, 2.0);
    this.carryLight.layers.set(0);
    this.jawMount.add(this.carryLight);
    this.holdNow();
  }

  // ---------------------------------------------------------------- mesh
  _buildMesh() {
    // Sculpt-off variants: ?skull=a (anatomist) / b (engineer) / c (the
    // familiar) / d (the wrong skull) / e (the continuous anatomical shell).
    // `e` is the shipping default; `v0` keeps the old courier reachable.
    const VARIANTS = { a: buildVariantA, b: buildVariantB, c: buildVariantC, d: buildVariantD, a2: buildVariantA2, e: buildVariantE };
    if (VARIANTS[this.variant]) {
      const parts = VARIANTS[this.variant](this.mats.bone);
      this.root = parts.root;
      this.jaw = parts.jaw;
      this.jawMount = parts.jawMount;
      this.sockets = parts.sockets;
      this.eyeL = parts.eyeL;
      this.eyeR = parts.eyeR;
      this.stageSets = parts.stageSets;
      this.stage5Hide = parts.stage5Hide || [];
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
    hold.position.set(HOLD_POSE.x, HOLD_POSE.y, HOLD_POSE.z);
    hold.scale.setScalar(HOLD_POSE.scale);
    // human hands, not talons (playtest 3b): fleshy tapered phalanges that
    // overlap at the joints, knuckle mass, a static distal curl with a
    // NAIL — the anim contract (k1/k2 rotation.x) is unchanged.
    // These must read as the player's living hands, not a second skeleton.
    // A physically lit, very rough surface gives the joints their volume; the
    // viewmodel key in main.js is deliberately far enough away that it cannot
    // clip the skin to white at point-blank range.
    // Slightly off the old orange-red: under the warm viewmodel key a saturated
    // albedo came back as salmon plastic. These sit a step darker and a step
    // less saturated so the key can do the warming.
    const skin = new THREE.MeshStandardMaterial({ color: 0x5d3f36, roughness: 0.97, metalness: 0 });
    const crease = new THREE.MeshStandardMaterial({ color: 0x4b3029, roughness: 1.0, metalness: 0 });
    const nailMat = new THREE.MeshStandardMaterial({ color: 0x6b5046, roughness: 0.82, metalness: 0 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 1.0, metalness: 0 });

    const mkFinger = (parent, x, y, z, scale, yaw) => {
      const k1 = new THREE.Group();
      k1.position.set(x, y, z);
      k1.rotation.y = yaw;
      // proximal: fattest, sunk into the palm so no gap shows
      const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0145 * scale, 0.03 * scale, 4, 10), skin);
      s1.rotation.x = Math.PI / 2;
      s1.position.z = 0.02 * scale;
      k1.add(s1);
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.0122 * scale, 10, 8), crease);
      kn.position.z = 0.046 * scale;
      kn.scale.set(1, 0.9, 0.85);
      k1.add(kn);
      const k2 = new THREE.Group();
      k2.position.set(0, 0, 0.048 * scale);
      // middle phalanx
      const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125 * scale, 0.024 * scale, 4, 10), skin);
      s2.rotation.x = Math.PI / 2;
      s2.position.z = 0.018 * scale;
      k2.add(s2);
      // distal: a static curl off k2 — pad, slight inward bend, nail on top
      const d = new THREE.Group();
      d.position.set(0, -0.001, 0.0335 * scale);
      d.rotation.x = -0.35;
      const s3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011 * scale, 0.016 * scale, 4, 10), skin);
      s3.rotation.x = Math.PI / 2;
      s3.position.z = 0.012 * scale;
      d.add(s3);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.0105 * scale, 10, 8), skin);
      pad.position.set(0, -0.002, 0.024 * scale);
      pad.scale.set(1, 0.85, 1);
      d.add(pad);
      const nail = new THREE.Mesh(new THREE.BoxGeometry(0.0115 * scale, 0.0022, 0.014 * scale), nailMat);
      nail.position.set(0, 0.0085 * scale, 0.02 * scale);
      nail.rotation.x = 0.18;
      d.add(nail);
      k2.add(d);
      k1.add(k2);
      parent.add(k1);
      return { k1, k2 };
    };

    this._fingers = [];
    const mkHand = (side) => {
      const hand = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), skin);
      palm.scale.set(1.28, 0.58, 1.35);
      hand.add(palm);
      const heel = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), skin);
      heel.position.set(0, -0.004, -0.04);
      heel.scale.set(1.3, 0.65, 0.9);
      hand.add(heel);
      // webbing: flesh across the finger bases so they grow FROM the hand
      const web = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), skin);
      web.position.set(0, 0.004, 0.058);
      web.scale.set(2.05, 0.62, 0.7);
      hand.add(web);
      // Human fingers terminate at meaningfully different heights.  The old
      // near-flat profile made each hand read as four identical organ pipes,
      // especially while empty.  Mirror the hierarchy so the index remains
      // nearest each thumb: pinky, ring, middle, index on the left hand and
      // the reverse on the right.
      const fingerScale = side < 0
        ? [0.76, 0.96, 1.0, 0.84]
        : [0.84, 1.0, 0.96, 0.76];
      const rootArc = side < 0
        ? [-0.004, 0.001, 0.003, 0.0]
        : [0.0, 0.003, 0.001, -0.004];
      for (let i = 0; i < 4; i++) {
        const f = mkFinger(
          hand,
          (i - 1.5) * 0.028,
          0.006,
          0.062 + rootArc[i],
          fingerScale[i],
          (i - 1.5) * 0.105,
        );
        f.phase = i * 0.9;
        this._fingers.push(f);
      }
      // The thumb is the single strongest "this is a hand" cue, and it used to
      // point straight into the gap between the two hands, where the other
      // hand's fingers hid it completely. Raised onto the top of the palm and
      // swung further across so it breaks the finger line in silhouette.
      const thumb = mkFinger(hand, side * -0.058, 0.028, 0.004, 1.12, side * -0.72);
      // A thumb is a short, thick opposing mass, not a fifth long finger.
      // Scaling its existing rig preserves the animation contract while making
      // the cradle silhouette unmistakably human.
      thumb.k1.scale.set(1.22, 1.12, 0.72);
      thumb.phase = 4.2;
      thumb.thumb = true;
      this._fingers.push(thumb);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.24, 12), sleeveMat);
      sleeve.position.set(0, -0.03, -0.15);
      sleeve.rotation.x = 1.3;
      hand.add(sleeve);
      return hand;
    };

    // Framing, which is the whole of Alex's "these do not look like human
    // hands". The palm, the thumb, the knuckle line and the wrist are the four
    // things that say HAND, and every one of them used to sit below the bottom
    // of the screen: the frame cut at the first knuckle, so all the player ever
    // saw was eight parallel tubes. The geometry was already right — it was
    // never on camera. Raised into frame, turned out of the edge-on yaw that
    // hid the backs of the hands, and separated so they read as two hands
    // rather than one mass.
    // TWO POSES, not one compromise. Cradling and empty want opposite things
    // from the camera and the old single pose served only the first:
    //
    //   CRADLE - the hands come in behind and under the skull to hold it, so
    //     most of each hand is hidden by the thing it is holding. Correct.
    //   EMPTY  - nothing is hiding them any more and they are the only thing
    //     on screen. Held in the cradle pose they read as eight parallel
    //     tubes: the frame cuts at the first knuckle, the palms and thumbs are
    //     below the bottom of the screen, and the fingers point at the camera
    //     end-on. That is Alex's "these do not look like human hands".
    //
    // So the hands turn over when the skull leaves: they drop, open outward,
    // and roll until the backs, the knuckle line and both thumbs are in frame.
    // It costs nothing and it reads as relief — the grip letting go — which is
    // the state the player is in anyway.
    const L = mkHand(-1);
    const R = mkHand(1);
    this._handPose = {
      hands: [L, R],
      cradle: { x: 0.114, y: -0.168, z: 0.052, rx: -0.58, ry: 0.71, rz: 0.27 },
      empty: { x: 0.133, y: -0.147, z: 0.043, rx: -0.33, ry: 0.50, rz: 0.15 },
      // After the waterfall bargain the skull is GONE — nothing is coming
      // back to these hands, so they stop waiting for it. Mostly out of
      // frame, arms at rest. ("I do not even think the player needs their
      // hands up after the skull is gone.") Hands only — hold itself never
      // moves, so the kept locket and the finale's pose capture are safe.
      lowered: { x: 0.152, y: -0.56, z: 0.028, rx: -0.06, ry: 0.34, rz: 0.05 },
      t: 0,   // 0 = cradle, 1 = empty
      g: 0,   // 0 = waiting poses above, 1 = lowered (skull permanently gone)
    };
    this._applyHandPose(0);
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
      fore.userData.baseY = fore.position.y;
      hold.add(fore);
      return fore;
    };
    // the sleeves must sink WITH the lowered hands after the bargain — left
    // behind, they read as a black outline at the bottom of the frame
    this._handPose.forearms = [mkForearm(-1), mkForearm(1)];

    this._grip = 0.55;
    this.hold = hold;
    this.camera.add(hold);
  }

  _buildTether() {
    // The button has always *behaved* like a tether. Give that relationship a
    // physical read: a hair-thin, sagging dark filament from the open hands to
    // the skull. It is depth-tested, so walls can swallow it, and value/motion
    // carry the read rather than colour. This is presentation only; none of the
    // calibrated flight law consults it.
    const points = 13;
    const positions = new Float32Array(points * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0x8a5f55,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    const tether = new THREE.Line(geometry, material);
    tether.name = 'skull-tether';
    tether.frustumCulled = false;
    tether.visible = false;
    tether.renderOrder = 3;
    this.scene.add(tether);
    this.tether = tether;
    this._tetherPoints = points;
    this._tetherStart = new THREE.Vector3();
    this._tetherEnd = new THREE.Vector3();
    this._tetherDelta = new THREE.Vector3();
    this._tetherSide = new THREE.Vector3();
    this._tetherPoint = new THREE.Vector3();
  }

  _updateTether() {
    const live = this.mode === 'outbound' || this.mode === 'poised'
      || this.mode === 'returning' || this.mode === 'anchored';
    if (!live) {
      this.tether.visible = false;
      this.tether.material.opacity = 0;
      return;
    }

    this.camera.updateMatrixWorld();
    // The hands open when the skull leaves. The filament begins in the gap
    // between them, so it can never be mistaken for a wrist-mounted weapon.
    const start = this._tetherStart.set(0.055, -0.245, -0.46)
      .applyMatrix4(this.camera.matrixWorld);
    const end = this._tetherEnd.copy(this.pos);
    const delta = this._tetherDelta.copy(end).sub(start);
    const distance = delta.length();
    const side = this._tetherSide.set(-delta.z, 0, delta.x);
    if (side.lengthSq() > 1e-6) side.normalize();
    const attr = this.tether.geometry.getAttribute('position');
    for (let i = 0; i < this._tetherPoints; i++) {
      const u = i / (this._tetherPoints - 1);
      const arc = Math.sin(u * Math.PI);
      const p = this._tetherPoint.copy(start).addScaledVector(delta, u);
      // A little gravity and a smaller heartbeat keep the line organic, never
      // laser-straight. Both fade to zero at its endpoints.
      p.y -= arc * Math.min(0.68, 0.045 + distance * 0.018);
      p.addScaledVector(side, arc * Math.sin(this._sfxClock * 6.2 + u * 8.0)
        * Math.min(0.032, distance * 0.0018));
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
    this.tether.visible = true;
    const stateGain = this.mode === 'returning' ? 1
      : this.mode === 'anchored' ? 0.76 : 0.58;
    this.tether.material.opacity = (0.32 + Math.min(distance / 28, 1) * 0.22)
      * stateGain;
  }

  // Blend the two authored hand poses. side = -1 mirrors in x and in both of
  // the rotations that carry handedness.
  _applyHandPose(t, g = this._handPose?.g || 0) {
    const P = this._handPose;
    if (!P) return;
    const c = P.cradle, e = P.empty, l = P.lowered;
    let x = lerp(c.x, e.x, t), y = lerp(c.y, e.y, t), z = lerp(c.z, e.z, t);
    let rx = lerp(c.rx, e.rx, t), ry = lerp(c.ry, e.ry, t), rz = lerp(c.rz, e.rz, t);
    if (g > 0) {
      x = lerp(x, l.x, g); y = lerp(y, l.y, g); z = lerp(z, l.z, g);
      rx = lerp(rx, l.rx, g); ry = lerp(ry, l.ry, g); rz = lerp(rz, l.rz, g);
    }
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      P.hands[i].position.set(side * x, y, z);
      P.hands[i].rotation.set(rx, -side * ry, -side * rz);
      // fully sunk = fully gone: no aspect ratio may catch a knuckle
      P.hands[i].visible = g < 0.985;
    }
    for (const fore of P.forearms || []) {
      fore.position.y = fore.userData.baseY - g * 0.5;
      fore.visible = g < 0.985;
    }
    P.t = t;
    P.g = g;
  }

  _updateHands(dt) {
    // grip target: cradling when held, tightening with threat, open when empty
    const held = this.mode === 'held';
    const catchClose = this._catchFx
      ? smoothstep(0.24, 0.86, this._catchFx.t / this._catchFx.dur)
      : 1;
    const target = held ? (0.5 + this.threat * 0.42) * catchClose : 0.08;
    this._grip = damp(this._grip, target, held ? 6 : 3, dt);
    // The hands turn over on the same signal as the grip, so opening and
    // rolling over are one gesture rather than two. Closing is quicker than
    // opening: a catch should feel caught, a throw should feel let go of.
    // 'gone' is permanent (the waterfall keeps what it takes): the hands
    // sink out of frame instead of waiting forever for a catch.
    const goneBlend = damp(this._handPose ? this._handPose.g : 0,
      this.mode === 'gone' ? 1 : 0, 2.2, dt);
    this._applyHandPose(damp(this._handPose ? this._handPose.t : 0, held ? 0 : 1, held ? 7 : 3.4, dt), goneBlend);
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
    this.hold.traverse((object) => { if (!object.isLight) layerFn(object); });
  }

  setStage(n) {
    this.stage = clamp(n | 0, 0, 5);
    this.pendingStage = this.stage;
    for (let s = 1; s <= 5; s++) {
      const on = s <= this.stage;
      for (const m of this.stageSets[s]) m.visible = on;
    }
    for (const m of this.stage5Hide || []) m.visible = this.stage === 4;
    if (this.eyeL) this.eyeL.visible = this.stage >= 2;
    if (this.eyeR) this.eyeR.visible = this.stage >= 3;
    // The anatomical shell ends as a torn, incomplete face. Keep its dark
    // apertures readable through the tissue instead of creating a blank mask.
    const openFinalApertures = this.variant === 'e' && this.stage === 5;
    for (const s of this.sockets) s.visible = this.stage < 5 || openFinalApertures;
  }

  requestStage(n) {
    // Growth is allowed to wait indefinitely. The player's next natural throw
    // supplies an unseen moment; the game never turns their head or steals input.
    this.pendingStage = Math.max(this.pendingStage, clamp(n | 0, 0, 5));
  }

  _applyPendingStageIfUnseen() {
    if (this.pendingStage <= this.stage) return;
    if (this.mode === 'gone') { this.setStage(this.pendingStage); return; }
    if (this.mode === 'held') return;              // guaranteed foreground view

    this.camera.updateMatrixWorld();
    this.root.updateMatrixWorld();
    const ndc = this.root.getWorldPosition(V.f).project(this.camera);
    const onScreen = ndc.z > -1 && ndc.z < 1
      && Math.abs(ndc.x) < 1.12 && Math.abs(ndc.y) < 1.12;
    if (!onScreen) this.setStage(this.pendingStage);
  }

  // ---------------------------------------------------------------- state
  holdNow() {
    this.mode = 'held';
    this.anchor = null;
    this._catchFx = null;
    if (this.root.parent) this.root.parent.remove(this.root);
    this.root.position.set(0, 0, 0.02);
    this.root.rotation.set(0.52, 0, 0);   // face tipped up: it is looking at you
    this.root.scale.setScalar(1);
    this.hold.add(this.root);
    // Keep the carried lantern on the world layer. The viewmodel is rendered
    // in its own pass so the 58-cd world light cannot bleach the hands; after a
    // return the light must not inherit the held mesh layer with the skull.
    this.root.traverse((o) => { if (!o.isLight) o.layers.set(LAYER_HELD); });
    this.audio.skullMoanStop();
  }

  gazeAt(dir, seconds = 3) {
    // scripted stare (the waterfall ask) — yields to real threats
    this.gazeOverride = { dir: dir.clone(), t: seconds };
  }

  grab(id, mesh) {
    // called by fetch targets: clamp an item in the teeth — and make sure the
    // player FEELS the clamp: snap-shut jaw, flourish spin, chime
    this.carry = { id, mesh, scale: mesh.scale.x };
    if (mesh.parent) mesh.parent.remove(mesh);
    mesh.position.set(0, -0.018, 0.057);
    mesh.rotation.set(0.4, 0, 0);
    // Do not make the objective vanish at the exact moment it is acquired.
    // It hangs below and ahead of the incisors, large enough to read while the
    // skull is returning without becoming a key-shaped billboard.
    mesh.scale.setScalar(Math.min(mesh.scale.x, 1.15));
    this.jawMount.add(mesh);
    this.carryLight.intensity = 0.82;
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
    this.carryLight.intensity = 0;
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
    this.hardAway = P.hardAwayBase;
    this.maxRange = P.maxRangeBase + P.maxRangeCharge;
    this.lastFlightSpeed = speed;
    this.returnSide = Math.random() < 0.5 ? -1 : 1;
    this.snapReturn = false;
    this._spin = 0;
    this.jaw.rotation.x = this.carry ? 0.3 : 0.55;   // it opens wide as it flies
    this.audio.skullMoanStart(this.pos);
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
    // Its LIGHTS must not leave with it, though. skull.root carries the
    // carried lantern and the ember socket light, and pulling that subtree out
    // of the scene drops two point lights out of the shader light census --
    // which makes three.js recompile every lit material in the game. Measured
    // at four to seven seconds of hard freeze landing precisely on the one
    // beat the whole act is built to deliver. Park them in the pinned census
    // root instead, muted: no pixel changes, the count never moves.
    const lightRoot = this.world?.lightRoot;
    if (lightRoot) {
      const carried = [];
      this.root.traverse((o) => { if (o.isLight) carried.push(o); });
      for (const light of carried) {
        lightRoot.attach(light);
        light.visible = false;   // World.pinLight mutes to black, never hides
      }
    }
    if (this.root.parent) this.root.parent.remove(this.root);
    this.tether.visible = false;
    this.audio.skullMoanStop();
  }

  setThreat(level, dir) {
    this.threat = clamp(level, 0, 1);
    if (dir) this.threatDir.copy(dir);
  }

  // ---------------------------------------------------------------- update
  update(dt, ctx) {
    this._sfxClock += dt;
    this._applyPendingStageIfUnseen();
    this._updateHands(dt);
    switch (this.mode) {
      case 'held': this._updateHeld(dt, ctx); break;
      case 'outbound': this._updateFlight(dt, ctx, false); break;
      case 'poised': this._updatePoised(dt, ctx); break;
      case 'returning': this._updateFlight(dt, ctx, true); break;
      case 'anchored': this._updateAnchored(dt, ctx); break;
      case 'gone': break;
    }
    this._updateTether();
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
    const fearTremble = this.graveFear ? Math.sin(t * 23) * 0.0035 : 0;
    this.hold.position.x = HOLD_POSE.x + Math.sin(t * 0.8) * 0.004 + fearTremble;
    this.hold.position.y = HOLD_POSE.y + Math.sin(t * 1.7) * 0.006 + (ctx ? ctx.bobY * 0.4 : 0) + c * 0.05
      + (this.graveFear ? 0.018 : 0);
    this.hold.position.z = HOLD_POSE.z + c * 0.11;
    this.hold.rotation.z = Math.sin(t * 0.5) * 0.02 - c * 0.25;
    this.hold.rotation.x = c * 0.4;

    // A normal catch does not teleport from world space into a perfect grip.
    // It crosses the last hand-span, overshoots by a few millimetres, and the
    // fingers close *after* the bone is already between them. Hard failsafes
    // still reseat instantly, preserving their invisible recovery contract.
    let catchScale = 1;
    if (this._catchFx) {
      this._catchFx.t = Math.min(this._catchFx.dur, this._catchFx.t + dt);
      const u = this._catchFx.t / this._catchFx.dur;
      const q = u - 1;
      const settle = 1 + 2.35 * q * q * q + 1.35 * q * q;
      this.root.position.lerpVectors(this._catchFx.start, this._catchFx.target, settle);
      catchScale = 1 + Math.sin(u * Math.PI) * 0.075;
      if (u >= 1) {
        this.root.position.copy(this._catchFx.target);
        this._catchFx = null;
      }
    }

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
    if (this.carry) {
      // An occupied mouth never seals the objective behind its own teeth.
      const clampTick = Math.max(0, Math.sin(t * 3.7)) * 0.035;
      this.jaw.rotation.x = Math.max(this.jaw.rotation.x, 0.14 + clampTick);
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
      this.root.scale.setScalar(b * catchScale);
    } else {
      this.root.scale.setScalar(catchScale);
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
    const catchPos = this.camera.getWorldPosition(V.a).clone();
    this.hold.updateMatrixWorld(true);
    const incomingLocal = this.hold.worldToLocal(this.pos.clone());
    this.holdNow();
    if (!hard) {
      const target = new THREE.Vector3(0, 0, 0.02);
      const offset = incomingLocal.sub(target);
      if (offset.length() > 0.44) offset.setLength(0.44);
      const start = target.clone().add(offset);
      this._catchFx = { t: 0, dur: 0.24, start, target };
      this.root.position.copy(start);
      this._grip = 0.06;
    }
    this._lastD = undefined;
    this.audio.catchThud({ pos: catchPos, gain: 0.5 + impact * 0.5, rate: hard ? 0.8 : 1 });
    if (ctx && ctx.onCatch) ctx.onCatch(impact, hard);
  }

  _updateAnchored(dt, ctx) {
    const a = this.anchor;
    if (!a) { this.beginReturn('auto'); return; }
    a.t += dt;
    this.root.position.copy(this.pos);
    if (a.swing) {
      // A swing anchor lives exactly as long as you hold the button — the same
      // grammar as every other throw. It also keeps facing you while it holds,
      // because it is still your light and you are still going to need it.
      this.root.lookAt(this.camera.getWorldPosition(_anchorLook));
      if (!ctx.throwHeld && a.t > 0.06) {
        this.anchor = null;
        this.beginReturn('snap');
        return;
      }
    } else {
      this.root.rotation.y += dt * 0.4;
    }
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
    const now = this._sfxClock;
    // pinball guard: ricochet storms wreck the mix and feel broken — three
    // bounces inside 0.4s means it's wedged in geometry; it comes home.
    this._bounceTimes = (this._bounceTimes || []).filter((t) => now - t < 0.4);
    this._bounceTimes.push(now);
    if (this._bounceTimes.length >= 3) {
      if (this.mode === 'outbound') this.beginReturn('auto');
      else if (this.mode === 'returning') {
        // Let _updateFlight perform the catch with its real input context on
        // this frame instead of allowing a returning skull to machine-gun the
        // compressor from inside a collider.
        this.returnStuck = FEEL_PROFILE.returnStuckFallback + 0.001;
      }
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

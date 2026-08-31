// skull.js — the cursed skull: throw / return / fetch / latch / grow.
// The return law is ported from kick-ball's FEEL_PROFILE (the law): exponential
// velocity bend, never decelerates on approach, monotonic clocks, duration-only
// quick call. Scaled for interiors.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep, TAU } from './util.js';
import { LAYER_HELD } from './mirrors.js';
import { handSkinTexture } from './textures.js';

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
    // A late, wordless wayfinding nudge. The director owns WHAT is useful and
    // WHEN the player has been without progress long enough to deserve help;
    // the skull owns only this bounded viewmodel lean. It never touches aim,
    // launch vectors, charge, collision, range, return or target checks.
    this.guideDir = new THREE.Vector3(0, 0, -1);
    this.guideStrength = 0;
    this._guideX = 0;
    this._guideY = 0;
    this._guideShown = 0;
    this._gazeWander = 0;
    this._idleT = 0;
    this._jawSnapT = 2.5;
    this._spin = 0;

    // bedroom-arrival state. _absentLights records where the parked lights
    // live (bootAbsent/arriveRestore); introFlicker is the human-head strobe
    // that runs in the hands right after the window catch (beginIntroFlicker,
    // driven in _updateHeld). Both presentation-side: no FEEL constant reads
    // or writes either.
    this._absentLights = null;
    this.introFlicker = null;

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
    // Darker than they were (0x5d3f36 / 0x4b3029 / 0x6b5046). In the reference
    // image the skull is the pale thing in the frame and the hands are
    // weathered mid-dark; here both were sitting near the top of the range,
    // because the viewmodel light is most of what either of them is lit by and
    // a lit MeshStandard compresses albedo differences as it saturates. The
    // albedo cut does not buy a proportional pixel cut (the shore lip measured
    // 5x albedo for 1.4x pixels), but it is free, and it puts the skull back on
    // top of the value order where it belongs.
    // ...and then round eight gave them a SURFACE. These were the last flat
    // materials in the game: one value, one hue, smooth shading over a shape,
    // on the object the player looks at in every frame from the first to the
    // last. Every wall, coffin, headstone and car in FETCH is a canvas painted
    // at boot; the hands were plastic.
    //
    // The map multiplies rather than replaces, so the value work survives: it
    // is authored around white, pulled to a mean of 0.85 (textures.js
    // skinPaint), and these two colours are lifted by the reciprocal — same
    // hands, same place in the value order, every pixel of them different.
    // It is the bumpMap as well, which is most of the point: the light the
    // player carries moves, and a hand it cannot rake across is a shape.
    const skinTex = handSkinTexture();
    // vertexColors carries what geometry used to: the darkened folds at the
    // finger hinges and the contact shadow on the fingertip pads are painted
    // into the skinned mesh's colour attribute, exactly at the joints.
    const skin = new THREE.MeshStandardMaterial({
      color: 0x51362f, roughness: 0.97, metalness: 0, vertexColors: true,
      map: skinTex, bumpMap: skinTex, bumpScale: 0.30,
    });
    // No flesh uses `crease` since the skinned rebuild (hinge shadow moved to
    // vertex colour), but it stays: _handSkin's shape is load-bearing —
    // becomeBone retints it and the playthrough's ending beat reads _handSkin.
    const crease = new THREE.MeshStandardMaterial({
      color: 0x3f2822, roughness: 1.0, metalness: 0,
      map: skinTex, bumpMap: skinTex, bumpScale: 0.30,
    });
    // Nails now face the camera (they used to sit on the palm side, unseen), so
    // their roughness is suddenly load-bearing: at 0.82 under a lamp this close
    // they came back as pale chips of wood glued to the fingertips. A nail is
    // only a shade lighter than the finger it caps, and barely glossier.
    const nailMat = new THREE.MeshStandardMaterial({ color: 0x4a352e, roughness: 0.93, metalness: 0 });
    // held so the last room can change what they are made of
    this._handSkin = { skin, crease, nail: nailMat };
    // The sleeves are load-bearing story (playtest 2: without arms rooted off
    // the bottom of the frame, the hands read as the SKULL's — "hands making
    // glasses around its eyes"), but at 0x090b0e with no map they photographed
    // as featureless black boxes — his exact question. Cloth needs folds:
    // borrow the curtain sheet the game already paints (vertical fold strokes
    // that wrap a cylinder as creases running down the sleeve), lift the base
    // a step so the folds can shade, and let the multiply keep it well under
    // the skin in the value order.
    const curtainTex = this.mats?.curtain?.map || null;
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x2c3036, roughness: 1.0, metalness: 0,
      map: curtainTex, bumpMap: curtainTex, bumpScale: 0.22,
      // open-ended tubes: a capped cylinder shows its end disc when the
      // camera looks down the arm, and a flat dark polygon under the wrist
      // was his "black boxes" read. DoubleSide so the cuff opening shows
      // cloth lining instead of a see-through hole.
      side: THREE.DoubleSide,
    });
    // The forearms are the same cloth but OUTSIDE the cradle lamps' reach
    // (probe-black-quad.mjs: hiding them, not the sleeves, removed the black
    // wedge he asked about) — inverse-square leaves them several times dimmer
    // than the wrists, so their curvature never shaded and they stayed flat
    // black at any sleeve value. The lamps cannot be moved (calibrated), so
    // the value is baked into a lifted clone instead, with the folds tiled to
    // arm scale. Material clone = same program; texture clone = one more 256
    // canvas upload at boot, warmed with everything else.
    const foreTex = curtainTex ? curtainTex.clone() : null;
    if (foreTex) { foreTex.repeat.set(2, 3); foreTex.needsUpdate = true; }
    const foreMat = new THREE.MeshStandardMaterial({
      color: 0x41464e, roughness: 1.0, metalness: 0,
      map: foreTex, bumpMap: foreTex, bumpScale: 0.22,
      side: THREE.DoubleSide,
    });

    // "they must be actually bones like a skeleton. right now they don't look
    // like that." They did not, and no recolour could make them: becomeBone
    // used to retint the SAME fat capsules, webbing and fingernails, which is
    // a bone-coloured glove. So the whole rig exists twice — flesh, and a real
    // hand of phalanx shafts and condyles built INSIDE the same k1/k2 groups,
    // hidden until the last room. The animation contract never notices.
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xbcb2a0, roughness: 0.62, metalness: 0 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0xa89d8b, roughness: 0.7, metalness: 0 });
    this._handBoneMat = boneMat;
    this._handJointMat = jointMat;
    const flesh = this._handFlesh = [];
    const bones = this._handBone = [];
    const fleshy = (m) => { flesh.push(m); return m; };
    const bony = (m) => { m.visible = false; bones.push(m); return m; };
    // THREE shared geometries for eighty bones. Building one per bone put the
    // mirror act at 1515 geometries against a 1500 gate; a capsule scaled
    // unevenly is an ellipsoid-capped shaft, which is what a phalanx is.
    const SHAFT = new THREE.CapsuleGeometry(0.006, 0.03, 3, 7);
    const JOINT = new THREE.SphereGeometry(0.01, 8, 6);
    const BLOCK = new THREE.BoxGeometry(1, 1, 1);
    // The FLESH used to be assembled from shared primitives too — one capsule
    // and one ball scaled into every segment, knuckle and pad. Round eight
    // retired the idea entirely, on his exact words: "we keep just making
    // hands that have all these weird giant joints and balls that don't look
    // like hands." That was structural, not a tuning miss: an assembly of
    // solids cannot stop reading as an assembly of solids, because every
    // capsule shades as its own tube with its own terminator, and every
    // knuckle ball exists to hide the seam between two capsules — the balls
    // ARE the seam-hiding, so the joints inflate. The flesh is now ONE skinned
    // surface per hand (buildHandFlesh below); only the bone twin and the
    // nails are still primitives, because bones and nails really are separate
    // hard parts.
    const shaft = (parent, r, len, z, s, mat = boneMat, droop = 0) => {
      const m = bony(new THREE.Mesh(SHAFT, mat));
      m.rotation.x = Math.PI / 2 + droop;
      m.position.z = z * s;
      m.scale.set((r / 0.006) * s, (len / 0.03) * s, (r / 0.006) * s);
      parent.add(m);
      return m;
    };
    const condyle = (parent, r, z, s) => {
      const m = bony(new THREE.Mesh(JOINT, jointMat));
      m.position.z = z * s;
      const k = (r / 0.01) * s;
      m.scale.set(k * 1.3, k * 1.05, k * 0.95);
      parent.add(m);
      return m;
    };

    // The finger is a BONE CHAIN now, not a stack of capsules. THREE.Bone is a
    // plain Object3D, so k1/k2 keep the exact animation contract — update()
    // ASSIGNS k1.rotation.x / k2.rotation.x every frame, the pose blends move
    // the hand roots, raiseHands and the sink still work, and the finale still
    // captures hold.children[0]/[1] — while the flesh becomes vertices these
    // bones DRIVE instead of solids they carry. The distal bend stays baked on
    // d (update never touches it), the nail stays a plain mesh child of d, and
    // the bone twin hangs off the same chain unchanged, hidden until
    // becomeBone. Proportions carried from round eight: proximal 0.0100 with a
    // 24-34% taper, lengths untouched.
    const mkFinger = (parent, skBones, x, y, z, scale, yaw, droop = 0, knuckle = 1) => {
      const k1 = new THREE.Bone();
      k1.position.set(x, y, z);
      k1.rotation.y = yaw;
      const k2 = new THREE.Bone();
      k2.position.set(0, 0, 0.042 * scale);
      const d = new THREE.Bone();
      d.position.set(0, -0.001, 0.034 * scale);
      d.rotation.x = -0.35;
      const i1 = skBones.push(k1) - 1;
      const i2 = skBones.push(k2) - 1;
      const i3 = skBones.push(d) - 1;
      // NO NAILS. They were flat BLOCK chips sized for the old capsule
      // fingertips, and on the curved skinned tube their corners stood off the
      // surface — his read of the result: "an odd little square thing sticking
      // out... they're not part of the hands." He is right twice over: at
      // cradle distance a nail is four pixels, and a box on a curved surface
      // can only ever be a box. If nails ever come back they are a painted
      // patch in the skin sheet, not geometry. (nailMat itself survives in
      // _handSkin — becomeBone retints it and the shape of that object is
      // load-bearing.)
      k2.add(d);
      k1.add(k2);
      parent.add(k1);
      // the same finger in bone: three shafts, a knuckle and a joint, and a
      // flared tuft where a fingertip has no pad to hide behind. The shaft
      // radii were already under the OLD flesh; they have to stay under the
      // new, thinner flesh too, so they come in with it — and they take the
      // same droop, or the bone hand walks out of the skin at the knuckles.
      shaft(k1, 0.0050, 0.032, 0.021, scale, boneMat, droop);
      condyle(k1, 0.0078, 0.047, scale);
      shaft(k2, 0.0042, 0.025, 0.015, scale, boneMat, droop * 0.6);
      condyle(k2, 0.0064, 0.0335, scale);
      shaft(d, 0.0034, 0.015, 0.012, scale, boneMat);
      const tuft = bony(new THREE.Mesh(JOINT, boneMat));
      tuft.position.set(0, 0, 0.0245 * scale);
      const tk = 0.62 * scale;
      tuft.scale.set(tk * 1.25, tk * 0.72, tk * 1.15);
      d.add(tuft);
      return { k1, k2, d, i1, i2, i3, s: scale, kn: knuckle };
    };

    // ---- the flesh, as ONE surface --------------------------------------
    // A tapered elliptical tube per finger and a sculpted blob for the palm,
    // all in one BufferGeometry, skinned to the bones above. Joints become
    // half-weighted rings — a bend folds the surface into a crease instead of
    // breaking it between two solids — and knuckles become millimetre swells
    // on the dorsal side of a continuous tube. The hinge rings are darkened in
    // vertex colour (a fold is in its own shadow), the distal palm side
    // carries the contact darkening the pads used to, and the whole flesh of
    // a hand is TWO draw calls instead of fifty-six.
    const RN = 12; // segments around a finger
    const buildHandFlesh = (hand, skBones, handFingers) => {
      const P = [], NM = [], UVA = [], CL = [], SI = [], SW = [], IX = [];
      const M = new THREE.Matrix4();
      const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
      const c = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
      const push = (nx, ny, nz, u, v, col, ia, wa, ib, wb) => {
        P.push(p.x, p.y, p.z); NM.push(nx, ny, nz); UVA.push(u, v);
        CL.push(col, col, col); SI.push(ia, ib, 0, 0); SW.push(wa, wb, 0, 0);
        return P.length / 3 - 1;
      };
      // One elliptical ring in `bone`'s frame at local z. `swell` fattens the
      // dorsal (-y) half only — a knuckle is a bump on the BACK of a finger —
      // and `dark` multiplies the palm-side vertex colour: the fingertip pad
      // pressed on bone is in its own shadow.
      const ring = (bone, z, r, rf, v, col, ia, wa, ib, wb, swell, dark) => {
        M.copy(bone.matrixWorld);
        bx.setFromMatrixColumn(M, 0).normalize();
        by.setFromMatrixColumn(M, 1).normalize();
        c.set(0, 0, z).applyMatrix4(M);
        const rx = r * 1.06 * rf, ry0 = r * 0.85 * rf;
        const first = P.length / 3;
        for (let k = 0; k <= RN; k++) {
          const th = (k / RN) * TAU;
          const co = Math.cos(th), si = Math.sin(th);
          const ry = ry0 * (1 + (swell || 0) * Math.max(0, -si));
          p.copy(c).addScaledVector(bx, co * rx).addScaledVector(by, si * ry);
          n.copy(bx).multiplyScalar(co / rx).addScaledVector(by, si / ry).normalize();
          const cc = col * ((dark && si > 0.25) ? 0.78 : 1);
          push(n.x, n.y, n.z, k / RN, v, cc, ia, wa, ib, wb);
        }
        return first;
      };
      const weld = (a, b) => {
        for (let k = 0; k < RN; k++) {
          IX.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
        }
      };
      const pole = (bone, z, v, col, ia, flip) => {
        M.copy(bone.matrixWorld);
        bz.setFromMatrixColumn(M, 2).normalize();
        if (flip) bz.negate();
        p.set(0, 0, z).applyMatrix4(M);
        return push(bz.x, bz.y, bz.z, 0.5, v, col, ia, 1, 0, 0);
      };
      const cap = (ringStart, poleIdx, flip) => {
        for (let k = 0; k < RN; k++) {
          if (flip) IX.push(ringStart + k + 1, ringStart + k, poleIdx);
          else IX.push(ringStart + k, ringStart + k + 1, poleIdx);
        }
      };
      // Station rows: [bone, localZ, radius, boneA, wA, boneB, wB, swell,
      // colour, dark]. Hinge rings sit AT the next bone's origin weighted
      // half-and-half — that is what turns a bend into a crease instead of a
      // break — and are darkened, because a crease is a fold in shadow.
      for (let fi = 0; fi < handFingers.length; fi++) {
        const f = handFingers[fi];
        const s = f.s, kn = f.kn, rf = f.rf || 1;
        // The v column is authored so the sheet's dense crease bands (skinPaint
        // paints them at v 0.13 and 0.87, tiling every 1.0) land ON the two
        // hinges — the first shot let v run free and every finger came back
        // wrapped in seven bands like a bandaged hand.
        const st = [
          [f.k1, -0.008 * s, 0.0100, 0.00, f.i1, 1, 0, 0, 0, 1, 0],
          [f.k1, 0.006 * s, 0.0104, 0.22, f.i1, 1, 0, 0, 0, 1, 0],
          [f.k1, 0.018 * s, 0.0100, 0.45, f.i1, 1, 0, 0, 0, 1, 0],
          [f.k1, 0.030 * s, 0.0097, 0.68, f.i1, 1, 0, 0, 0, 1, 0],
          [f.k1, 0.038 * s, 0.0096, 0.80, f.i1, 0.8, f.i2, 0.2, 0.10 * kn, 0.92, 0],
          [f.k1, 0.042 * s, 0.0090, 0.87, f.i1, 0.5, f.i2, 0.5, 0, 0.80, 0],
          [f.k2, 0.005 * s, 0.0088, 0.94, f.i2, 0.8, f.i1, 0.2, 0, 0.92, 0],
          [f.k2, 0.016 * s, 0.0085, 1.02, f.i2, 1, 0, 0, 0, 1, 0],
          [f.k2, 0.028 * s, 0.0084, 1.09, f.i2, 0.8, f.i3, 0.2, 0.08 * kn, 0.93, 0],
          [f.k2, 0.034 * s, 0.0078, 1.13, f.i2, 0.5, f.i3, 0.5, 0, 0.82, 0],
          [f.d, 0.004 * s, 0.0074, 1.20, f.i3, 0.8, f.i2, 0.2, 0, 0.93, 0],
          [f.d, 0.012 * s, 0.0070, 1.32, f.i3, 1, 0, 0, 0, 1, 1],
          [f.d, 0.019 * s, 0.0063, 1.44, f.i3, 1, 0, 0, 0, 1, 1],
          [f.d, 0.024 * s, 0.0048, 1.54, f.i3, 1, 0, 0, 0, 0.96, 1],
        ];
        let prev = -1, firstRing = -1;
        for (let idx = 0; idx < st.length; idx++) {
          const [bone, z, r, v, ia, wa, ib, wb, swell, col, dark] = st[idx];
          const start = ring(bone, z, r * s, rf, v, col, ia, wa, ib, wb, swell, dark);
          if (prev >= 0) weld(prev, start);
          if (idx === 0) firstRing = start;
          prev = start;
        }
        // root cap hidden inside the palm; a rounded pad at the fingertip
        cap(firstRing, pole(f.k1, -0.014 * s, 0, 1, f.i1, true), true);
        cap(prev, pole(f.d, 0.0285 * s, 1.62, 0.9, f.i3, false), false);
      }
      // The palm and the wrist heel: sculpted lat-long blobs. A plain
      // flattened sphere came back as "a flat circle instead of the palm part
      // of a hand" — his words, and right: a real hand-back is not a disc. So
      // the blob dooms toward the knuckles (both faces deepen with +z, the
      // pads on the palm side and the metacarpal rise on the back), tapers in
      // width toward the wrist, and stays flatter on the palm (+y) side.
      // Round-eight dimensions still hold: ~90 x 33 x 111 mm at the knuckles.
      const blob = (cx, cy, cz, ra, rb, rc, flatten, tiles, sculpt) => {
        const W = 20, H = 14;
        const rows = [];
        for (let iy = 0; iy <= H; iy++) {
          const vphi = iy / H, phi = vphi * Math.PI;
          const row = [];
          for (let ix = 0; ix <= W; ix++) {
            const u = ix / W, th = u * TAU;
            const ux = -Math.cos(th) * Math.sin(phi);
            const uy = Math.cos(phi);
            const uz = Math.sin(th) * Math.sin(phi);
            // dome toward the knuckles, pinch toward the wrist
            const depth = sculpt ? 1 + 0.38 * Math.max(0, uz) : 1;
            const width = sculpt ? 1 - 0.26 * Math.max(0, -uz) : 1;
            const be = (uy > 0 ? rb * flatten : rb) * depth;
            p.set(cx + ux * ra * width, cy + uy * be, cz + uz * rc);
            n.set(ux / (ra * width), uy / be, uz / rc).normalize();
            row.push(push(n.x, n.y, n.z, u * tiles, vphi * tiles, 1, 0, 1, 0, 0));
          }
          rows.push(row);
        }
        for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
          const a = rows[iy][ix + 1], b = rows[iy][ix], c2 = rows[iy + 1][ix], d2 = rows[iy + 1][ix + 1];
          if (iy !== 0) IX.push(a, b, d2);
          if (iy !== H - 1) IX.push(b, c2, d2);
        }
      };
      // tiles 3 on the palm: at 2 the sheet's crease bands appeared as eight
      // broad latitude rings and the heel read as wrapped in bandages; finer
      // tiling turns the same bands into skin-scale wrinkle texture
      blob(0, 0.002, 0.004, 0.0500, 0.0165, 0.0620, 0.8, 3, true);
      blob(0, -0.004, -0.040, 0.0350, 0.0150, 0.0310, 0.9, 2.2, false);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(NM, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(UVA, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(CL, 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
      geo.setIndex(IX);
      const mesh = new THREE.SkinnedMesh(geo, skin);
      // the held pass never culls, and a posed skeleton walks outside the
      // bind-pose bounding sphere
      mesh.frustumCulled = false;
      hand.add(mesh);
      hand.updateMatrixWorld(true);
      mesh.bind(new THREE.Skeleton(skBones.slice()));
      // which finger each bone drives — the measurement tools group skinned
      // vertices by dominant bone to answer per-finger questions
      const fingerOfBone = new Array(skBones.length).fill(-1);
      handFingers.forEach((f, fi) => {
        fingerOfBone[f.i1] = fi; fingerOfBone[f.i2] = fi; fingerOfBone[f.i3] = fi;
      });
      mesh.userData.fingerOfBone = fingerOfBone;
      fleshy(mesh);
      return mesh;
    };

    this._fingers = [];
    const mkHand = (side) => {
      // Round eight first measured the mitten (palm 116 x 52 mm against a real
      // 90 x 28 — thickness is what decides hand vs sock), then replaced the
      // assembly outright: palm, heel and fingers are ONE skinned surface,
      // built in buildHandFlesh above with the corrected dimensions.
      const hand = new THREE.Group();
      // the skeleton root — every vertex that is not on a finger weights here
      const palmBone = new THREE.Bone();
      hand.add(palmBone);
      const skBones = [palmBone];
      const handFingers = [];
      // and the hand under the hand: a carpal block and a fan of four
      // metacarpals reaching out to the finger roots. No palm sphere, no
      // webbing — the gaps between the bones ARE the read.
      const carpal = bony(new THREE.Mesh(BLOCK, jointMat));
      carpal.position.set(0, 0.001, -0.026);
      carpal.rotation.x = 0.1;
      carpal.scale.set(0.062, 0.019, 0.036);
      hand.add(carpal);
      for (let i = 0; i < 4; i++) {
        // the metacarpal fan follows the finger roots to their new spacing,
        // or the bone hand reaches out to where the fingers used to be
        const tipX = [-0.0355, -0.0120, 0.0125, 0.0355][i], tipZ = 0.062;
        const rootX = (i - 1.5) * 0.0125, rootZ = -0.014;
        const mc = bony(new THREE.Mesh(SHAFT, boneMat));
        mc.position.set((tipX + rootX) / 2, 0.003, (tipZ + rootZ) / 2);
        mc.rotation.x = Math.PI / 2;
        mc.rotation.z = -Math.atan2(tipX - rootX, tipZ - rootZ);
        mc.scale.set(1.03, 1.93, 1.03);
        hand.add(mc);
        const head = bony(new THREE.Mesh(JOINT, jointMat));
        head.position.set(tipX * 0.94, 0.004, tipZ - 0.008);
        head.scale.set(1.06, 0.87, 0.92);
        hand.add(head);
      }
      const thumbMc = bony(new THREE.Mesh(SHAFT, boneMat));
      thumbMc.position.set(side * -0.032, 0.017, -0.008);
      thumbMc.rotation.set(Math.PI / 2, 0, side * 0.85);
      thumbMc.scale.set(1.2, 1.4, 1.2);
      hand.add(thumbMc);
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
      // EVENNESS IS THE OTHER HALF OF "SAUSAGES". Four digits at one spacing,
      // one yaw step and one girth read as a row of organ pipes however well
      // each is modelled — so nothing below is a multiple of anything.
      //
      // Roots: a uniform 0.028 step spanned 84 mm, which was already wide and
      // reads splayed once the fingers are thin. These are accumulated from
      // uneven gaps and span 71.
      const rootX = [-0.0355, -0.0120, 0.0125, 0.0355];
      // Yaw: was (i-1.5) x 0.105, a perfect fan. The pinky splays, the ring is
      // nearly straight, the index comes out a touch. Mirrored the same way the
      // scales are, so the index stays nearest each thumb.
      // ...but the SPREAD came down by a third in round eight. Four fingers at
      // 19 degrees of fan, laid on a skull, let the room show through between
      // every pair, and four separated tubes with daylight between them read as
      // a rake. Fingers on bone lie close enough to touch each other. The
      // unevenness is what round seven was after and it is all still here.
      const yawFan = side < 0
        ? [-0.112, -0.034, 0.019, 0.084]     // pinky, ring, middle, index
        : [-0.084, -0.019, 0.034, 0.112];    // index, middle, ring, pinky
      // Droop: a few degrees of tilt baked into the meshes inside k1/k2 (never
      // the groups — update() assigns their rotation.x outright).
      const droopSet = side < 0
        ? [0.085, 0.032, 0.048, 0.06]
        : [0.06, 0.048, 0.032, 0.085];
      // and which knuckle sits proudest. The spread used to be 0.78 to 1.15,
      // which was a third of a finger's width and read as four different-sized
      // beads; now it modulates a 12% swelling, so it varies the knuckle line
      // by a millimetre or two the way real ones do.
      const knuckleSet = side < 0
        ? [0.94, 1.0, 1.08, 1.03]
        : [1.03, 1.08, 1.0, 0.94];
      for (let i = 0; i < 4; i++) {
        const f = mkFinger(
          palmBone, skBones,
          rootX[i],
          0.006 + (i & 1 ? 0.0012 : -0.0009),
          0.062 + rootArc[i],
          fingerScale[i],
          yawFan[i],
          droopSet[i],
          knuckleSet[i],
        );
        f.phase = i * 0.9;
        this._fingers.push(f);
        handFingers.push(f);
      }
      // The thumb is the single strongest "this is a hand" cue, and it used to
      // point straight into the gap between the two hands, where the other
      // hand's fingers hid it completely. Raised onto the top of the palm and
      // swung further across so it breaks the finger line in silhouette.
      // Tucked back and swung less far across than round seven left it. That
      // thumb was aimed at a cradle 32 mm wider than this one; with the hands
      // seated where they can actually touch the skull, the two thumbs met in
      // the middle and crossed the jaw as a pair of blobs under the chin. In
      // the reference the thumbs are behind the bone, not in front of it.
      const thumb = mkFinger(palmBone, skBones, side * -0.056, 0.022, -0.012, 1.12, side * -0.60);
      // A thumb is a short, thick opposing mass, not a fifth long finger. The
      // bone scale is part of the BIND pose, so skinning cancels it for the
      // flesh — the thumb tube gets its girth from rf instead — while the nail
      // and the bone twin, plain children of the bone, inherit the scale
      // exactly the way the old rig's meshes did.
      thumb.k1.scale.set(1.22, 1.12, 0.72);
      thumb.rf = 1.18;
      thumb.phase = 4.2;
      thumb.thumb = true;
      this._fingers.push(thumb);
      handFingers.push(thumb);
      // bind pose is final: one surface over the whole skeleton
      hand.updateMatrixWorld(true);
      buildHandFlesh(hand, skBones, handFingers);
      // and the cuff comes in with the wrist it sits on: a 91 mm sleeve mouth
      // on a 63 mm wrist was most of what made the bottom of the frame a sock
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.062, 0.24, 16, 1, true), sleeveMat);
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
    // TRAP: these rotations do NOT reach the mirror room. finale.js's
    // _updatePressure rewrites both hand rotations every frame, after
    // skull.update in the loop order, from its own RAISED_L/RAISED_R — so a
    // pose change here moves every act EXCEPT the one with the raised hands,
    // and a pose fix aimed at the finale passes its probe and changes nothing
    // on screen. Edit finale.js for that beat.
    this._handPose = {
      hands: [L, R],
      // THE GRIP. "in this whole game, the hands are facing so the palm side
      // is against the skull, so it doesn't look like he's holding the skull.
      // its fine after the skull goes and we got it right in the last room of
      // the game." He is right about both halves of that: EMPTY already turns
      // over (see below) and finale.js's RAISED_L/R already read as hands.
      //
      // The old cradle was rx -0.58, ry 0.71, rz 0.27, and what that produced
      // was two upturned palms with the fingers pointing back at the camera —
      // the skull presented on them rather than held. mkHand grows the fingers
      // along local +Z and curls them toward local +Y, so +Y is the palm
      // normal: pointing +Y at the CAMERA is the whole bug.
      //
      // These numbers are not hand-guessed. tools/shot-grip-sweep.mjs aims the
      // hand instead — finger axis up and a little forward, palm INWARD at the
      // skull — and reads the Euler back off the basis, which works because
      // _applyHandPose applies (rx, -side*ry, -side*rz), so the stored numbers
      // ARE the applied angles for the left hand. Palm inward puts the backs
      // and the knuckle line toward the camera and wraps the fingers round the
      // cheek, which is the grip in the reference image he posted.
      //
      // NOTE the half-turn alone is not the fix, though it is where this
      // started (finale.js documents +-PI about the finger axis as the way to
      // turn a hand over without mirroring it). Rolling PI and changing
      // nothing else inverts the CURL as well, and the shot came back with
      // both hands folded down out of the bottom of the frame.
      //
      // SECOND PASS, from his screenshot: "those hands look nasty. and clip
      // through. we need to have actual human hands holding a skull." Both
      // halves of that were true and they had different causes.
      //
      // CLIPPING was measurable and is now measured. probe-grip-clip.mjs puts
      // each hand's box at 0.355 x 0.365 x 0.296 in hold space against a skull
      // of 0.212 x 0.257 x 0.29 — the hands are as big as the thing they hold —
      // and the palm-inward pass seated them at |x| 0.115 when the skull's own
      // half-width is 0.106. They were inside it. shot-grip-sweep.mjs now
      // samples every hand vertex against the skull's ellipsoid and reports the
      // percentage buried; this seat measures ZERO, deepest zero.
      //
      // NASTY was the finger direction. Fingers pointing up and curling round
      // the far side show the camera four proximal lumps and no hand at all.
      //
      // THEN HE POSTED THE REFERENCE IMAGE, and it settled it. What it shows:
      // wrists at the very bottom edge, fingers pointing UP the sides of the
      // cranium and nearly straight, laid ON the bone and following its curve;
      // backs of the hands and backs of the fingers to the camera; thumbs
      // hidden behind; fingertips at about eye-socket height. Not curled round
      // anything, and not laid across the face either.
      //
      // Two things had to be true at once for that to work. The fingers must
      // rise near-VERTICALLY: angled inward they converge into the cranium
      // exactly as they pass its widest point (measured, 7-13% buried). And
      // they must be much straighter while held, which is what the finger
      // constants in _updateHands now do.
      //
      // ROUND EIGHT MEASURED IT, and the answer was not an angle. He has said
      // twice that they do not look like hands, and the number nobody had
      // taken is the one tools/probe-grip-contact.mjs prints: how far each
      // finger is from the nearest bone. At this seat it was 12 to 70 mm,
      // MEAN 38 -- a finger's length of air between the hands and the thing
      // they are holding. Of course it did not look like he was holding it.
      //
      // The old sweep could not see that, because it scored candidates on how
      // much of the hand was INSIDE an ellipsoid inscribed in the skull's
      // AABB, and that box is tall (the jaw hangs off the bottom) so the
      // ellipsoid it inscribes pinches in exactly where the fingers pass.
      // Zero buried against it meant nothing. sweep-grip-contact scores the
      // gap and the burial against the skull's OWN surface instead, at both
      // growth stages, and it says the gap was mostly in Z: seated at z 0.122
      // against a skull whose front face is at 0.117, the hands were never
      // beside the skull at all. They were in front of it, reaching back.
      //
      // Two more things the sweep settled. The fingers must SPLAY very
      // slightly outward as they rise, not lean in: the cranium widens toward
      // the brow, so the aim that hugs it is the one that opens with it, and
      // every inward lean drove the fingertips through the eye sockets
      // (10-20% buried, 20 mm deep) on the way to closing the gap. And the
      // curl stays where round seven put it -- more curl hooks the tips over
      // the cheekbone, which reads as clutching a face, not cradling a skull.
      //
      // 38 mm mean gap -> 11. The fingers touch the bone.
      cradle: { x: 0.124, y: -0.118, z: 0.100, rx: -1.691, ry: -0.060, rz: -1.343 },
      // Untouched. "its fine after the skull goes": the hands drop, open
      // outward and roll until the backs, the knuckle line and both thumbs are
      // in frame, and they have read as hands since round two. The cradle now
      // starts from a turned-over pose too, so the release is a smaller
      // gesture than it was, not a bigger one.
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
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.07, len, 14, 1, true), foreMat);
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
    if (this._handRaise > 0) this._handRaise -= dt;
    const goneBlend = damp(this._handPose ? this._handPose.g : 0,
      (this.mode === 'gone' && !(this._handRaise > 0)) ? 1 : 0, 2.2, dt);
    this._applyHandPose(damp(this._handPose ? this._handPose.t : 0, held ? 0 : 1, held ? 7 : 3.4, dt), goneBlend);
    this._handT = (this._handT || 0) + dt;
    const tremble = held && this.threat > 0.05 ? Math.sin(this._handT * (10 + this.threat * 18)) * 0.05 * this.threat : 0;
    for (const f of this._fingers) {
      const wave = Math.sin(this._handT * 0.7 + f.phase) * 0.03;   // idle micro-life
      const curl = this._grip * (f.thumb ? 0.9 : 1.25) + wave + tremble;
      // Fingers wrapped round a skull are not fingers closed on nothing. The
      // held pose rests them FLATTER so they drape over the bone instead of
      // curling into the air in front of it — which is what let the seat come
      // close enough to read as a grip while still measuring zero buried.
      // The amount is driven by the pose's own blend, so the empty hand keeps
      // exactly the curl it was tuned with (it is the pose he says already
      // works), and `_grip` — with its threat tightening and its catch feel —
      // is not touched at all.
      // Both the rest bend AND the grip's contribution shrink while holding.
      // The reference image's fingers are nearly straight, laid flat along the
      // cranium; a 37-degree first joint reads as a fist closed on air no
      // matter where the hand is seated. Threat still tightens them, the
      // tremble is untouched, and `_grip` itself is never written here.
      const held01 = 1 - (this._handPose ? this._handPose.t : 1);
      f.k1.rotation.x = -(0.35 - 0.20 * held01 + curl * (0.75 - 0.30 * held01));
      f.k2.rotation.x = -(0.3 - 0.16 * held01 + curl * (0.95 - 0.38 * held01));
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
    // The arrival flicker owns the stage machinery outright for its 3.6s —
    // no growth request may interleave with the strobe. It ends by settling
    // to setStage(0), which also zeroes pendingStage (boot state).
    if (this.introFlicker) return;
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
  // THE LAST ROOM. The hands you have watched all game are bone, and always
  // were — and Alex: "they must be actually bones like a skeleton. right now
  // they don't look like that." They didn't, because this used to be a
  // material swap: the same fat capsules, the same webbing between the finger
  // roots, the same fingernails, painted bone. A glove.
  // The flesh goes out and the skeleton underneath comes on: phalanx shafts
  // and condyles inside the same k1/k2 groups, four metacarpals and a carpal
  // block where the palm sphere was. Same rig, same authored poses, and the
  // gaps between the bones are the read. Colour and surface are taken off the
  // SKULL's own bone so the two are one body, which is the whole point — and
  // _handSkin.skin keeps its identity and its copied colour, because that is
  // the thing the playthrough compares.
  becomeBone(boneMat) {
    if (this._handsBone || !this._handSkin || !boneMat) return false;
    this._handsBone = true;
    const { skin, crease, nail } = this._handSkin;
    skin.color.copy(boneMat.color);
    skin.roughness = boneMat.roughness ?? 0.9;
    crease.color.copy(boneMat.color).multiplyScalar(0.55);
    crease.roughness = 1.0;
    nail.color.copy(boneMat.color).multiplyScalar(0.82);
    if (this._handBoneMat) {
      for (const [mat, k] of [[this._handBoneMat, 1], [this._handJointMat, 0.84]]) {
        mat.color.copy(boneMat.color).multiplyScalar(k);
        mat.map = boneMat.map || null;
        mat.bumpMap = boneMat.bumpMap || null;
        mat.bumpScale = boneMat.bumpScale ?? 1;
        mat.roughness = boneMat.roughness ?? 0.62;
        mat.needsUpdate = true;
      }
    }
    for (const m of (this._handFlesh || [])) m.visible = false;
    for (const m of (this._handBone || [])) m.visible = true;
    return true;
  }

  // Bring the sunken hands back up for a beat. 'gone' is permanent and the
  // hands stopped waiting for a catch long ago; this is not a catch, it is
  // being shown something. Camera and movement stay live throughout.
  raiseHands(seconds = 6) {
    this._handRaise = Math.max(this._handRaise || 0, seconds);
  }

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

  bootAbsent() {
    // THE NEW OPENING: a fresh run wakes empty-handed — the skull is not in
    // the world yet; it arrives later by shattering the bedroom window.
    // This is exactly vanish()'s proven census-safe parking pattern (root
    // removed, every light in the subtree parked in the pinned census root
    // and muted) minus the waterfall connotations — and, unlike vanish(),
    // recoverable: each light's home parent and local transform is recorded
    // so arriveRestore() can put everything back. Must only run AFTER
    // World.pinLightCensus (the pin counts these lights with skull.root as a
    // carrier FIRST; parking via lightRoot keeps the census constant).
    this.mode = 'gone';
    this.anchor = null;
    this._catchFx = null;
    this.introFlicker = null;
    const lightRoot = this.world?.lightRoot;
    if (lightRoot) {
      this._absentLights = this._absentLights || [];
      const carried = [];
      this.root.traverse((o) => { if (o.isLight) carried.push(o); });
      for (const light of carried) {
        if (!this._absentLights.some((r) => r.light === light)) {
          this._absentLights.push({
            light,
            parent: light.parent,
            position: light.position.clone(),
            quaternion: light.quaternion.clone(),
            scale: light.scale.clone(),
          });
        }
        lightRoot.attach(light);
        light.visible = false;   // World.pinLight mutes to black, never hides
      }
    }
    if (this.root.parent) this.root.parent.remove(this.root);
    this.tether.visible = false;
    this.audio.skullMoanStop();
  }

  arriveRestore() {
    // The restore half of bootAbsent(): root back under the scene, lights back
    // in their home sockets, unmuted. Mode STAYS 'gone' — the bedroom arrival
    // script owns the scripted inbound flight (in 'gone' no _collide and no
    // _checkTargets can ever run, which is the key guard) and calls holdNow()
    // itself at the catch. Teleport's instant completion calls this too, then
    // holdNow() immediately. Order matters: the root joins the scene BEFORE
    // the lights re-enter it, so no light ever sits in a detached subtree
    // (which would drop it from the census and recompile every lit material).
    if (!this.root.parent) this.scene.add(this.root);
    this.root.traverse((o) => { if (!o.isLight) o.layers.set(0); });
    this.root.position.copy(this.pos);
    this.root.scale.setScalar(1);
    for (const r of this._absentLights || []) {
      r.parent.add(r.light);
      r.light.position.copy(r.position);
      r.light.quaternion.copy(r.quaternion);
      r.light.scale.copy(r.scale);
      r.light.visible = true;   // the pinLight setter unmutes colour; the count never moves
    }
    this._absentLights = null;
  }

  beginIntroFlicker() {
    // The arrival script calls this right after holdNow(): for ~3.6s the
    // caught thing strobes human head <-> bone before settling as the skull
    // we know. Opens ON the head — the shock lands the same frame as the
    // catch. Driven per-frame in _updateHeld; presentation only.
    this.introFlicker = {
      t: 0, dur: 3.6,
      next: 0.09 + Math.random() * 0.1,
      showHead: true,
      snapT: 0.3, snapHold: 0,
    };
    this.setStage(5);
  }

  setThreat(level, dir) {
    this.threat = clamp(level, 0, 1);
    if (dir) this.threatDir.copy(dir);
  }

  setGuide(dir, strength = 0) {
    this.guideStrength = clamp(strength, 0, 1);
    if (dir && dir.lengthSq() > 1e-8) this.guideDir.copy(dir).normalize();
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

    // The pull is deliberately smaller than the ordinary charging pose and
    // slower than hand sway. Camera matrix columns are its world-space right
    // and up vectors, so these two dots turn the objective direction into a
    // stable screen-space lean without worldToLocal allocations or eye jitter.
    const me = this.camera.matrixWorld.elements;
    const wantGuide = this.mode === 'held' && !this.charging && c < 0.02 && !this.introFlicker
      ? this.guideStrength : 0;
    const gx = (this.guideDir.x * me[0] + this.guideDir.y * me[1] + this.guideDir.z * me[2]) * wantGuide;
    const gy = (this.guideDir.x * me[4] + this.guideDir.y * me[5] + this.guideDir.z * me[6]) * wantGuide;
    this._guideX = damp(this._guideX, clamp(gx, -1, 1), 3.8, dt);
    this._guideY = damp(this._guideY, clamp(gy, -0.8, 0.8), 3.8, dt);
    this._guideShown = damp(this._guideShown, wantGuide, 4.2, dt);
    this.hold.position.x += this._guideX * 0.026;
    this.hold.position.y += this._guideY * 0.012;
    this.hold.rotation.z -= this._guideX * 0.075;
    this.hold.rotation.x += this._guideY * 0.035;

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

    // THE FLICKER (bedroom arrival): for ~3.6s after the window catch the
    // thing in your hands strobes human head <-> bone. Irregular 80-220ms
    // swaps — shape/brightness/timing carry the read, never hue — with the
    // intervals lengthening over the last 1.2s so the head visibly LOSES and
    // it settles as the skull. While it runs, the jaw mashes (~11 Hz) with
    // hard bite snaps and the radar voice plays at maximum from the hold pos:
    // the loudest chatter in the game, in your own hands, teaching the threat
    // sound in the same stroke. Presentation plus one input gate in main.js;
    // every FEEL constant untouched.
    if (this.introFlicker) {
      const f = this.introFlicker;
      f.t += dt;
      if (f.t >= f.dur) {
        this.setStage(0);      // it becomes the skull we know; pendingStage 0 = boot state
        this.jaw.rotation.x = 0;
        this.introFlicker = null;
      } else {
        if (f.t >= f.next) {
          f.showHead = !f.showHead;
          this.setStage(f.showHead ? 5 : 0);
          let interval = 0.08 + Math.random() * 0.14;          // irregular strobe
          const settle = smoothstep(f.dur - 1.2, f.dur, f.t);  // the last 1.2s
          interval *= 1 + settle * 2.2;                        // it slows...
          if (!f.showHead) interval *= 1 + settle * 0.8;       // ...and bone holds longest
          f.next = f.t + interval;
        }
        // menacing jaw mash with irregular hard bite snaps
        f.snapT -= dt;
        if (f.snapT <= 0) { f.snapT = 0.26 + Math.random() * 0.42; f.snapHold = 0.055; }
        if (f.snapHold > 0) { f.snapHold -= dt; this.jaw.rotation.x = 0; }
        else this.jaw.rotation.x = Math.max(0, Math.sin(f.t * 11 * TAU)) * 0.34;
        this.audio.skullChatter(1.0, this.root.getWorldPosition(V.c));
      }
    } else {
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

    // ceiling — the same contract as the ground, at the other end. Without it
    // a throw at the roof left the house entirely and the room answered with
    // nothing at all, which is the one thing a gameplay surface may never do.
    if (w.ceilingHeightAt) {
      const ch = w.ceilingHeightAt(this.pos.x, this.pos.z, this.pos.y);
      if (ch < Infinity && this.pos.y + r > ch) {
        this.pos.y = ch - r;
        if (this.vel.y > 0) {
          this.vel.y *= -0.62;
          this.vel.x *= 0.96; this.vel.z *= 0.96;
          this._bounceFx(Math.abs(this.vel.y));
        }
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

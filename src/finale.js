// finale.js — the room at the end. Much like the first. Locked. No skull.
// The walls are mirrors and they do not stop. The reflection wears the skull
// from the beginning — it lives on LAYER_DOUBLE, so it exists only in glass.
import * as THREE from 'three';
import { clamp, lerp, damp, smoothstep } from './util.js';
import { Mirror, Mirrors, LAYER_DOUBLE } from './mirrors.js';

const CX = 500, CZ = 500;
const ROOM_H = 2.7;

export class Finale {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.t = 0;
    this.half = 3.0;                  // wall half-extent, shrinks to 0.36
    this.phase = 'idle';
    this._build();
  }

  _build() {
    const g = this.game;
    const M = g.mats;
    const scene = g.scene;

    // floor + ceiling
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 6.6), M.woodFloor);
    floor.position.set(CX, -0.1, CZ);
    scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 6.6), M.ceiling);
    ceil.position.set(CX, ROOM_H + 0.1, CZ);
    scene.add(ceil);
    g.world.rooms.push({ id: 'mirrorRoom', level: 'mirror', floorY: 0, x0: CX - 3.3, z0: CZ - 3.3, x1: CX + 3.3, z1: CZ + 3.3 });
    g.world.addZone('mirror', CX - 4, CZ - 4, CX + 4, CZ + 4, -1, 4);
    g.world.addSurface('wood', CX - 4, CZ - 4, CX + 4, CZ + 4, -1, 4);

    // furniture — the bedroom's, but wrong: same shapes, faded
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), M.woodDark);
    bed.position.set(CX + 1.9, 0.25, CZ + 1.7);
    scene.add(bed);
    this.bed = bed;
    const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.5), M.woodDark);
    dresser.position.set(CX - 1.6, 0.45, CZ + 2.4);
    scene.add(dresser);
    this.dresser = dresser;
    // a door shape that leads nowhere and a window shape that is shut
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.06), M.woodDark);
    doorPanel.position.set(CX - 2.94, 1.1, CZ - 1);
    doorPanel.rotation.y = Math.PI / 2;
    scene.add(doorPanel);
    this.doorPanel = doorPanel;
    g.world.registerInteract(doorPanel, 'finaleDoor', () => {
      g.audio.lockedRattle({ pos: doorPanel.position, gain: 0.8 });
      g.shake(0.15);
    });
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.1), M.woodDark);
    winFrame.position.set(CX + 1, 1.7, CZ + 2.95);
    scene.add(winFrame);
    this.winFrame = winFrame;

    // dim cold light — enough to find your own face
    const lamp = new THREE.PointLight(0x9fb2c5, 45, 9, 1.6);
    lamp.position.set(CX, ROOM_H - 0.3, CZ);
    scene.add(lamp);
    this.lamp = lamp;

    // ---- the four walls: pooled planar mirrors ----
    this.mirrors = new Mirrors(g.renderer, { budget: 4, size: 1024, maxDist: 18, fogColor: 0x05060c, fogDensity: 0.012 });
    this.panes = [];
    for (let i = 0; i < 4; i++) {
      const m = new Mirror(6.6, ROOM_H, { tint: 0xb8c2c8 });
      this.mirrors.add(m);
      scene.add(m.mesh);
      this.panes.push(m);
      m.setActive(false);
    }
    this.walls = [];
    for (let i = 0; i < 4; i++) this.walls.push(g.world.addCollider(0, 0, 0, 0, 0, 0));
    this._placeWalls();

    // ---- the reflection ----
    this.figure = this._makeReflection(M);
    this.figure.visible = false;
    scene.add(this.figure);
  }

  _makeReflection(M) {
    const g = new THREE.Group();
    const cloth = new THREE.MeshLambertMaterial({ color: 0x181a1f });
    const handMat = new THREE.MeshLambertMaterial({ color: 0x8a7d72 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.6, 4, 8), cloth);
    torso.position.y = 1.08;
    const legs = [];
    for (const s of [-1, 1]) {
      const legP = new THREE.Group();
      legP.position.set(s * 0.1, 0.78, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.66, 3, 6), cloth);
      leg.position.y = -0.38;
      legP.add(leg);
      legs.push(legP);
      g.add(legP);
      const armP = new THREE.Group();
      armP.position.set(s * 0.24, 1.42, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.55, 3, 6), cloth);
      arm.position.y = -0.32;
      armP.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), handMat);
      hand.position.y = -0.62;
      armP.add(hand);
      g.add(armP);
    }
    g.userData.legs = legs;

    // the head: the skull from the beginning. bare bone.
    const head = new THREE.Group();
    const bone = M.bone;
    const cr = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), bone);
    cr.scale.set(1, 0.92, 1.12);
    head.add(cr);
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x030303 });
    for (const s of [-1, 1]) {
      const so = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), socketMat);
      so.position.set(s * 0.045, 0, 0.093);
      so.scale.set(1, 1.2, 0.5);
      head.add(so);
    }
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.016, 6, 12, Math.PI * 1.1), bone);
    jaw.rotation.x = Math.PI / 2;
    jaw.position.set(0, -0.085, 0.03);
    head.add(jaw);
    head.position.y = 1.72;
    g.add(head, torso);
    g.traverse((o) => o.layers.set(LAYER_DOUBLE));
    return g;
  }

  _placeWalls() {
    const h = this.half;
    const defs = [
      [CX, CZ - h, 0],
      [CX, CZ + h, Math.PI],
      [CX - h, CZ, Math.PI / 2],
      [CX + h, CZ, -Math.PI / 2],
    ];
    this.panes.forEach((m, i) => {
      const [x, z, ry] = defs[i];
      m.place(x, ROOM_H / 2, z, ry);
    });
    const T = 0.3;
    const boxes = [
      [CX - h - 1, CZ - h - T, CX + h + 1, CZ - h],
      [CX - h - 1, CZ + h, CX + h + 1, CZ + h + T],
      [CX - h - T, CZ - h - 1, CX - h, CZ + h + 1],
      [CX + h, CZ - h - 1, CX + h + T, CZ + h + 1],
    ];
    this.walls.forEach((c, i) => {
      const [x0, z0, x1, z1] = boxes[i];
      c.min.x = x0; c.min.y = -0.5; c.min.z = z0;
      c.max.x = x1; c.max.y = ROOM_H; c.max.z = z1;
    });
  }

  begin() {
    const g = this.game;
    this.active = true;
    this.t = 0;
    this.phase = 'still';
    this.half = 3.0;
    this._placeWalls();
    g.player.pos.set(CX, 0, CZ - 0.6);
    g.player.yaw = 0;
    g.act = 'mirror';
    g.audio.setZone('mirror');
    g.checkpoint('mirror');
    for (const m of this.panes) m.setActive(true);
    this.figure.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    this.t += dt;

    // ---- the Approach, made visible: the reflection runs late. the lag closes
    // as the walls do. in the last half-meter it crosses zero — the double leads.
    if (!this.poses) this.poses = [];
    this.poses.push({ t: this.t, x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw, ph: g.player.bobPhase, sr: g.player.speedRatio });
    if (this.poses.length > 400) this.poses.shift();
    const closeness = 1 - clamp((this.half - 0.36) / (3.0 - 0.36), 0, 1);
    let lag = (1 - closeness) * 0.45;
    if (this.half < 0.55) lag = -((0.55 - this.half) / 0.19) * 0.07;   // it moves first
    let pose;
    if (lag <= 0) {
      // extrapolate: the double is already where you are about to be
      pose = {
        x: g.player.pos.x + g.player.vel.x * -lag,
        z: g.player.pos.z + g.player.vel.z * -lag,
        yaw: g.player.yaw + g.player.yawVel * -lag * 0.5,
        ph: g.player.bobPhase, sr: g.player.speedRatio,
      };
    } else {
      const want = this.t - lag;
      pose = this.poses[0];
      for (let i = this.poses.length - 1; i >= 0; i--) {
        if (this.poses[i].t <= want) { pose = this.poses[i]; break; }
      }
    }
    const f = this.figure;
    f.position.set(pose.x, g.player.pos.y, pose.z);
    f.rotation.y = pose.yaw + Math.PI;       // it faces where you face
    const legs = f.userData.legs;
    legs[0].rotation.x = Math.sin(pose.ph) * 0.45 * pose.sr;
    legs[1].rotation.x = -Math.sin(pose.ph) * 0.45 * pose.sr;

    switch (this.phase) {
      case 'still':
        if (this.t > 3 && !this._rattled) {
          this._rattled = true;
          g.audio.lockedRattle({ pos: this.doorPanel.position, gain: 0.6 });
        }
        if (this.t > 7) {
          this.phase = 'closing';
          g.audio.stoneGrind({ gain: 0.4, rate: 0.5 });
        }
        break;
      case 'closing': {
        const elapsed = this.t - 7;
        const speed = 0.05 * (1 + elapsed * 0.06);
        this.half = Math.max(0.36, this.half - speed * dt);
        this._placeWalls();
        // furniture obeys the room: it slides ahead of the glass
        const clampIn = (m, r) => {
          m.position.x = clamp(m.position.x, CX - this.half + r, CX + this.half - r);
          m.position.z = clamp(m.position.z, CZ - this.half + r, CZ + this.half - r);
        };
        clampIn(this.bed, 0.9);
        clampIn(this.dresser, 0.5);
        this.doorPanel.position.x = Math.max(this.doorPanel.position.x, CX - this.half + 0.05);
        this.winFrame.position.z = Math.min(this.winFrame.position.z, CZ + this.half - 0.07);
        // the room tightens in your ears too
        g.baseTension = clamp(1 - (this.half - 0.36) / 2.6, 0, 1) * 0.9;
        g.audio.setTension(g.baseTension);
        if (!this._grind || this.t > this._grind) {
          this._grind = this.t + 2.6;
          g.audio.stoneGrind({ gain: 0.3 + (1 - this.half / 3) * 0.4, rate: 0.5 + (1 - this.half / 3) * 0.3 });
          g.shake(0.05 + (1 - this.half / 3) * 0.1);
        }
        // squeeze the player between the glass
        g.player.pos.x = clamp(g.player.pos.x, CX - this.half + 0.34, CX + this.half - 0.34);
        g.player.pos.z = clamp(g.player.pos.z, CZ - this.half + 0.34, CZ + this.half - 0.34);
        if (this.half <= 0.37) {
          this.phase = 'end';
          g.player.frozen = true;
          g.fadeOut(5, () => g.showEnd(), true);
          g.audio.duck(0.0, 12);
        }
        break;
      }
      case 'end':
        break;
    }
  }

  render(scene, camera) {
    if (!this.active) return false;
    this.mirrors.update(scene, camera);
    return true;
  }
}

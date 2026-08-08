// finale.js — the room at the end. Much like the first. Locked. No skull.
// The walls are mirrors and they do not stop. The reflection wears the exact
// beginning skull on LAYER_DOUBLE, so it exists only in glass.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './util.js';
import { Mirror, Mirrors, LAYER_DOUBLE } from './mirrors.js';

const CX = 500, CZ = 500;
const ROOM_H = 2.7;

// Four mirror renders make every draw matter. The finale therefore uses a
// bounded authored kit: shared materials, compact furniture groups, and an
// exact shared-geometry clone of the live skull rather than duplicate assets.
function addMesh(parent, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function addBox(parent, material, sx, sy, sz, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  return addMesh(parent, new THREE.BoxGeometry(sx, sy, sz), material, x, y, z, rx, ry, rz);
}

function addCylinder(parent, material, r0, r1, h, x = 0, y = 0, z = 0, segments = 10, rx = 0, ry = 0, rz = 0) {
  return addMesh(parent, new THREE.CylinderGeometry(r0, r1, h, segments), material,
    x, y, z, rx, ry, rz);
}

function makeDrapeGeometry(width, height, side) {
  const geo = new THREE.PlaneGeometry(width, height, 5, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / height + 0.5;
    const x = p.getX(i);
    const gathered = 0.72 + Math.abs(y - 0.56) * 0.5;
    p.setX(i, x * gathered + side * Math.sin(y * Math.PI) * 0.035);
    p.setZ(i, Math.sin((x / width + 0.5) * Math.PI * 5) * 0.025);
  }
  geo.computeVertexNormals();
  return geo;
}

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
    const mapOf = (m) => m && m.map ? m.map : null;

    const wood = new THREE.MeshStandardMaterial({
      map: mapOf(M.woodDark), color: 0xa49a8d, roughness: 0.82, metalness: 0.02,
    });
    const woodEdge = new THREE.MeshStandardMaterial({
      map: mapOf(M.woodDark), color: 0x665f58, roughness: 0.9,
    });
    const linen = new THREE.MeshStandardMaterial({ color: 0x777b7b, roughness: 0.98 });
    const blanket = new THREE.MeshStandardMaterial({ color: 0x343d48, roughness: 0.96 });
    const brass = new THREE.MeshStandardMaterial({
      color: 0xb6a46e, roughness: 0.35, metalness: 0.72,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x24313a, emissive: 0x101820, emissiveIntensity: 0.32,
      roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.82,
    });
    const curtain = new THREE.MeshStandardMaterial({
      map: mapOf(M.curtain), color: 0x5d6062, roughness: 1,
      side: THREE.DoubleSide,
    });
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x29323b, roughness: 1 });
    this.finaleMats = { wood, woodEdge, linen, blanket, brass, glass, curtain, rugMat };

    // The first room's floor and ceiling establish recognition. A faded rug
    // makes the playable center legible before any mirror is exposed.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 6.6), M.woodFloor);
    floor.position.set(CX, -0.1, CZ);
    floor.receiveShadow = true;
    scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 6.6), M.ceiling);
    ceil.position.set(CX, ROOM_H + 0.1, CZ);
    ceil.receiveShadow = true;
    scene.add(ceil);
    const rug = addMesh(scene, new THREE.PlaneGeometry(3.35, 4.35), rugMat,
      CX - 0.15, 0.012, CZ + 0.15, -Math.PI / 2);
    rug.receiveShadow = true;

    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0xa8b9c1, emissive: 0x607985, emissiveIntensity: 0.38,
      roughness: 0.32, metalness: 0.16,
    });
    addCylinder(scene, fixtureMat, 0.31, 0.31, 0.055,
      CX, ROOM_H - 0.025, CZ, 20);
    addMesh(scene, new THREE.TorusGeometry(0.36, 0.025, 6, 24), brass,
      CX, ROOM_H - 0.055, CZ, Math.PI / 2);

    g.world.rooms.push({
      id: 'mirrorRoom', level: 'mirror', floorY: 0,
      x0: CX - 3.3, z0: CZ - 3.3, x1: CX + 3.3, z1: CZ + 3.3,
    });
    g.world.addZone('mirror', CX - 4, CZ - 4, CX + 4, CZ + 4, -1, 4);
    g.world.addSurface('wood', CX - 4, CZ - 4, CX + 4, CZ + 4, -1, 4);

    // A recognizable bed, but with proportions just wrong enough to feel
    // remembered rather than copied.
    const bed = new THREE.Group();
    bed.position.set(CX + 1.72, 0, CZ + 1.62);
    addBox(bed, woodEdge, 1.52, 0.22, 2.08, 0, 0.22, 0);
    addBox(bed, linen, 1.38, 0.26, 1.92, 0, 0.45, -0.03);
    addBox(bed, blanket, 1.4, 0.075, 1.08, 0, 0.615, -0.37);
    const pillow = addMesh(bed, new THREE.CapsuleGeometry(0.16, 0.48, 4, 10), linen,
      0, 0.64, 0.62, Math.PI / 2);
    pillow.scale.set(1.45, 1, 0.72);
    for (const sx of [-1, 1]) {
      for (const z of [-0.99, 0.99]) {
        addCylinder(bed, wood, 0.045, 0.055, z > 0 ? 1.28 : 0.72,
          sx * 0.72, z > 0 ? 0.64 : 0.36, z, 10);
        addMesh(bed, new THREE.SphereGeometry(0.07, 10, 7), brass,
          sx * 0.72, z > 0 ? 1.31 : 0.75, z);
      }
    }
    addBox(bed, wood, 1.34, 0.5, 0.075, 0, 0.91, 0.985);
    addBox(bed, woodEdge, 1.18, 0.055, 0.09, 0, 1.19, 0.96);
    scene.add(bed);
    this.bed = bed;

    // The original dresser and lamp, rebuilt with real fronts, feet, hardware,
    // glass, and a weak dying practical instead of a featureless block.
    const dresser = new THREE.Group();
    dresser.position.set(CX - 1.7, 0, CZ + 2.34);
    addBox(dresser, woodEdge, 1.28, 0.86, 0.5, 0, 0.48, 0);
    addBox(dresser, wood, 1.38, 0.075, 0.59, 0, 0.95, 0);
    for (let i = 0; i < 3; i++) {
      addBox(dresser, wood, 1.08, 0.205, 0.035, 0, 0.25 + i * 0.25, -0.27);
    }
    const knobGeo = new THREE.SphereGeometry(0.027, 8, 6);
    const knobs = new THREE.InstancedMesh(knobGeo, brass, 6);
    const km = new THREE.Matrix4();
    let ki = 0;
    for (let i = 0; i < 3; i++) {
      for (const sx of [-1, 1]) {
        km.makeTranslation(sx * 0.25, 0.25 + i * 0.25, -0.295);
        knobs.setMatrixAt(ki++, km);
      }
    }
    knobs.castShadow = true;
    dresser.add(knobs);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      addBox(dresser, woodEdge, 0.075, 0.18, 0.075,
        sx * 0.52, 0.09, sz * 0.17);
    }
    const lampBase = addCylinder(dresser, brass, 0.105, 0.14, 0.08,
      0.25, 1.025, 0, 12);
    lampBase.castShadow = false;
    const lampGlass = addMesh(dresser, new THREE.SphereGeometry(0.12, 12, 9), glass,
      0.25, 1.16, 0);
    lampGlass.scale.set(0.78, 1.18, 0.78);
    addCylinder(dresser, glass, 0.06, 0.075, 0.24, 0.25, 1.34, 0, 12);
    this.dresserGlow = new THREE.PointLight(0xd0b17b, 4.5, 3.2, 2);
    this.dresserGlow.position.set(0.25, 1.22, -0.08);
    dresser.add(this.dresserGlow);
    scene.add(dresser);
    this.dresser = dresser;

    // Complete physical door language: knob, inside bolt, frame, and panels.
    // It still leads nowhere and keeps the existing finaleDoor interaction.
    const doorPanel = new THREE.Group();
    doorPanel.position.set(CX - 2.96, 0, CZ - 1.0);
    doorPanel.rotation.y = Math.PI / 2;
    const doorHit = addBox(doorPanel, woodEdge, 1.18, 2.16, 0.075, 0, 1.08, 0);
    for (const y of [0.58, 1.53]) {
      addBox(doorPanel, wood, 0.82, 0.56, 0.035, 0, y, 0.055);
    }
    for (const sx of [-1, 1]) {
      addBox(doorPanel, wood, 0.105, 2.36, 0.12, sx * 0.69, 1.16, 0);
    }
    for (const y of [0.02, 2.3]) {
      addBox(doorPanel, wood, 1.48, 0.105, 0.12, 0, y, 0);
    }
    addCylinder(doorPanel, brass, 0.075, 0.075, 0.035,
      0.38, 1.03, 0.095, 14, Math.PI / 2);
    addMesh(doorPanel, new THREE.SphereGeometry(0.065, 12, 8), brass,
      0.38, 1.03, 0.14);
    addBox(doorPanel, brass, 0.18, 0.07, 0.025, 0, 1.78, 0.11);
    scene.add(doorPanel);
    this.doorPanel = doorPanel;
    this.doorHit = doorHit;
    g.world.registerInteract(doorHit, 'finaleDoor', () => {
      const at = doorHit.getWorldPosition(new THREE.Vector3());
      g.audio.lockedRattle({ pos: at, gain: 0.8 });
      g.shake(0.15);
    });

    // The opening window is shut here. Crossed muntins and pale glass seams
    // remain legible by value even after its surrounding wall becomes glass.
    const winFrame = new THREE.Group();
    winFrame.position.set(CX + 0.82, 0, CZ + 2.96);
    addBox(winFrame, glass, 1.5, 1.52, 0.035, 0, 1.67, 0);
    for (const sx of [-1, 1]) {
      addBox(winFrame, wood, 0.105, 1.78, 0.12, sx * 0.82, 1.67, -0.01);
    }
    for (const y of [0.78, 2.56]) {
      addBox(winFrame, wood, 1.74, 0.105, 0.12, 0, y, -0.01);
    }
    addBox(winFrame, wood, 0.075, 1.52, 0.09, 0, 1.67, -0.045);
    addBox(winFrame, wood, 1.5, 0.075, 0.09, 0, 1.67, -0.045);
    for (const side of [-1, 1]) {
      addMesh(winFrame, makeDrapeGeometry(0.52, 1.88, side), curtain,
        side * 1.02, 1.58, -0.1);
      addMesh(winFrame, new THREE.TorusGeometry(0.09, 0.014, 6, 12), brass,
        side * 0.98, 1.42, -0.13, Math.PI / 2);
    }
    scene.add(winFrame);
    this.winFrame = winFrame;

    // Cold motivated light holds a readable middle value. It intensifies only
    // slightly as the room closes; the skull, not a hue shift, is the focal cue.
    const lamp = new THREE.PointLight(0xb3c9d3, 54, 9, 1.65);
    lamp.position.set(CX, ROOM_H - 0.3, CZ);
    scene.add(lamp);
    this.lamp = lamp;

    // Four pooled planar mirrors: public budget and behavior preserved.
    this.mirrors = new Mirrors(g.renderer, {
      budget: 4, size: 1024, maxDist: 18,
      fogColor: 0x05060c, fogDensity: 0.009,
    });
    this.panes = [];
    for (let i = 0; i < 4; i++) {
      const m = new Mirror(6.6, ROOM_H, { tint: 0xc1ccd1 });
      this.mirrors.add(m);
      scene.add(m.mesh);
      this.panes.push(m);
      m.setActive(false);
    }

    // The room begins with a faded wallpaper skin. When movement starts, that
    // skin drains away over already-live mirrors. No camera move is required.
    this.veilMat = new THREE.MeshStandardMaterial({
      map: mapOf(M.wallpaper), color: 0x747a79, roughness: 0.97,
      transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide,
    });
    this.wallVeils = [];
    const veilGeo = new THREE.PlaneGeometry(6.6, ROOM_H);
    for (let i = 0; i < 4; i++) {
      const veil = new THREE.Mesh(veilGeo, this.veilMat);
      veil.receiveShadow = true;
      scene.add(veil);
      this.wallVeils.push(veil);
    }

    this.walls = [];
    for (let i = 0; i < 4; i++) {
      this.walls.push(g.world.addCollider(0, 0, 0, 0, 0, 0));
    }
    this._placeWalls();

    this.figure = this._makeReflection(M);
    this.figure.visible = false;
    scene.add(this.figure);

    this.resetProps = [bed, dresser, doorPanel, winFrame];
    for (const o of this.resetProps) {
      o.userData.homePosition = o.position.clone();
      o.userData.homeRotation = o.rotation.clone();
    }
  }

  _makeReflection(M) {
    const figure = new THREE.Group();
    figure.name = 'the-reflection';
    const cloth = new THREE.MeshStandardMaterial({
      color: 0x242b34, emissive: 0x05080c, emissiveIntensity: 0.22,
      roughness: 0.94,
    });
    const clothDark = new THREE.MeshStandardMaterial({ color: 0x101419, roughness: 0.98 });
    const seam = new THREE.MeshStandardMaterial({
      color: 0x73808a, emissive: 0x182129, emissiveIntensity: 0.18, roughness: 0.82,
    });
    const handMat = new THREE.MeshStandardMaterial({ color: 0x91867d, roughness: 0.83 });

    const torso = new THREE.Group();
    torso.position.y = 0;
    const chest = addMesh(torso, new THREE.CapsuleGeometry(0.19, 0.5, 5, 10), cloth,
      0, 1.2, 0);
    chest.scale.set(1.32, 1, 0.74);
    const shoulders = addMesh(torso, new THREE.CapsuleGeometry(0.085, 0.36, 4, 8), cloth,
      0, 1.47, 0, 0, 0, Math.PI / 2);
    shoulders.scale.z = 0.82;
    const hips = addMesh(torso, new THREE.CapsuleGeometry(0.13, 0.18, 4, 8), clothDark,
      0, 0.86, 0);
    hips.scale.set(1.28, 1, 0.82);
    addBox(torso, clothDark, 0.19, 0.58, 0.07, -0.12, 1.12, -0.13, 0, 0, -0.055);
    addBox(torso, clothDark, 0.19, 0.58, 0.07, 0.12, 1.12, -0.13, 0, 0, 0.055);
    addBox(torso, seam, 0.045, 0.72, 0.026, 0, 1.17, 0.145);
    addBox(torso, seam, 0.17, 0.055, 0.03, -0.08, 1.48, 0.14, 0, 0, -0.55);
    addBox(torso, seam, 0.17, 0.055, 0.03, 0.08, 1.48, 0.14, 0, 0, 0.55);
    figure.add(torso);

    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.105, 0.82, 0);
      const upper = addMesh(hip, new THREE.CapsuleGeometry(0.073, 0.35, 4, 8), clothDark,
        0, -0.22, 0);
      upper.scale.z = 0.82;
      const knee = new THREE.Group();
      knee.position.set(0, -0.45, 0.005);
      const lower = addMesh(knee, new THREE.CapsuleGeometry(0.062, 0.37, 4, 8), cloth,
        0, -0.23, 0);
      lower.scale.z = 0.8;
      addBox(knee, clothDark, 0.14, 0.1, 0.28, 0, -0.49, 0.07);
      hip.add(knee);
      figure.add(hip);
      legs.push({ hip, knee });
    }

    const arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.27, 1.44, 0);
      shoulder.rotation.z = s * -0.08;
      const upper = addMesh(shoulder, new THREE.CapsuleGeometry(0.058, 0.3, 4, 8), cloth,
        0, -0.19, 0);
      upper.scale.z = 0.84;
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.39, 0);
      const lower = addMesh(elbow, new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), clothDark,
        0, -0.19, 0);
      lower.scale.z = 0.82;
      const hand = addMesh(elbow, new THREE.CapsuleGeometry(0.043, 0.09, 4, 8), handMat,
        0, -0.43, 0.015);
      hand.scale.set(0.9, 1, 0.72);
      shoulder.add(elbow);
      figure.add(shoulder);
      arms.push({ shoulder, elbow });
    }

    const headMount = new THREE.Group();
    headMount.position.y = 1.78;
    headMount.userData.baseY = 1.78;
    const fallback = this._makeFallbackSkull(M);
    headMount.add(fallback);
    figure.add(headMount);

    // This light is visible only to mirror cameras. It supplies a pale rim to
    // the exact bone geometry without creating a hue-only gameplay signal.
    const headLight = new THREE.PointLight(0xc8dce3, 7, 2.5, 2);
    headLight.position.set(0, 1.79, 0.34);
    figure.add(headLight);

    figure.userData = {
      legs, arms, torso, headMount, fallback, exactHead: null, headLight,
    };
    figure.traverse((o) => o.layers.set(LAYER_DOUBLE));
    return figure;
  }

  _makeFallbackSkull(M) {
    // Construction-time fallback only. begin() replaces this with a clone of
    // the live selected sculpt at stage zero, so the reflected silhouette is
    // exactly the skull the player learned at the opening.
    const skull = new THREE.Group();
    const bone = M.bone;
    const dark = new THREE.MeshBasicMaterial({ color: 0x020304 });
    const cranium = addMesh(skull, new THREE.SphereGeometry(0.13, 18, 14), bone,
      0, 0.025, 0);
    cranium.scale.set(0.92, 1.02, 1.06);
    const face = addMesh(skull, new THREE.SphereGeometry(0.092, 14, 10), bone,
      0, -0.065, 0.035);
    face.scale.set(0.9, 0.8, 0.92);
    for (const s of [-1, 1]) {
      const socket = addMesh(skull, new THREE.SphereGeometry(0.036, 9, 7), dark,
        s * 0.048, -0.025, 0.108);
      socket.scale.set(1.08, 1.28, 0.48);
      const cheek = addMesh(skull, new THREE.SphereGeometry(0.026, 8, 6), bone,
        s * 0.075, -0.076, 0.075);
      cheek.scale.set(0.8, 1.1, 0.8);
    }
    const nose = addMesh(skull, new THREE.ConeGeometry(0.016, 0.036, 4), dark,
      0, -0.07, 0.122, Math.PI);
    nose.castShadow = false;
    const jaw = addMesh(skull,
      new THREE.TorusGeometry(0.068, 0.014, 7, 14, Math.PI * 1.12), bone,
      0, -0.14, 0.04, Math.PI / 2, 0, -Math.PI * 0.06);
    jaw.scale.x = 1.05;
    return skull;
  }

  _mountExactSkull() {
    const data = this.figure.userData;
    if (data.exactHead) return;
    const live = this.game.skull;
    if (!live || !live.root || typeof live.setStage !== 'function') return;

    // Clone while the live sculpt is in its opening state, then restore the
    // player's current stage before the frame can render. Geometry/materials
    // remain shared, so even a selected variant adds no duplicate asset cost.
    const oldStage = live.stage;
    live.setStage(0);
    const exact = live.root.clone(true);
    live.setStage(oldStage);
    exact.name = 'the-exact-beginning-skull';
    exact.position.set(0, 0, 0);
    exact.rotation.set(0, 0, 0);
    exact.scale.setScalar(1.72);
    exact.traverse((o) => {
      o.layers.set(LAYER_DOUBLE);
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    data.headMount.remove(data.fallback);
    data.headMount.add(exact);
    data.exactHead = exact;
  }

  _placeWalls() {
    const h = this.half;
    const defs = [
      [CX, CZ - h, 0, 0, 1],
      [CX, CZ + h, Math.PI, 0, -1],
      [CX - h, CZ, Math.PI / 2, 1, 0],
      [CX + h, CZ, -Math.PI / 2, -1, 0],
    ];
    this.panes.forEach((m, i) => {
      const [x, z, ry] = defs[i];
      m.place(x, ROOM_H / 2, z, ry);
      const veil = this.wallVeils && this.wallVeils[i];
      if (veil) {
        const nx = defs[i][3], nz = defs[i][4];
        veil.position.set(x + nx * 0.014, ROOM_H / 2, z + nz * 0.014);
        veil.rotation.set(0, ry, 0);
      }
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
    this._rattled = false;
    this._grind = 0;
    this.poses = [];
    this._mountExactSkull();

    for (const o of this.resetProps) {
      o.position.copy(o.userData.homePosition);
      o.rotation.copy(o.userData.homeRotation);
    }
    this.veilMat.opacity = 1;
    for (const veil of this.wallVeils) veil.visible = true;
    this.lamp.intensity = 54;
    this.dresserGlow.intensity = 4.5;
    this.figure.userData.headLight.intensity = 7;
    this._placeWalls();

    // enterMirrorRoom invokes begin at full black. Reorient only during that
    // hidden transition; a visible debug entry preserves the current look.
    g.player.pos.set(CX, 0, CZ - 0.6);
    const frameHidden = !g.el || !g.el.fade ||
      Number.parseFloat(g.el.fade.style.opacity || '1') >= 0.99;
    if (frameHidden) g.player.yaw = 0;
    // Route the transition through the Director so old cave beats are scoped
    // out and the mirror's fog, growth, tension, and audio state stay coherent.
    g.director.setAct('mirror', true);
    g.checkpoint('mirror');
    for (const m of this.panes) m.setActive(true);
    this.figure.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    this.t += dt;

    // The Approach, made visible: the reflection runs late. The lag closes as
    // the walls do; in the last half-meter it crosses zero and the double leads.
    this.poses.push({
      t: this.t, x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw,
      ph: g.player.bobPhase, sr: g.player.speedRatio,
    });
    if (this.poses.length > 400) this.poses.shift();
    const closeness = 1 - clamp((this.half - 0.36) / (3.0 - 0.36), 0, 1);
    let lag = (1 - closeness) * 0.45;
    if (this.half < 0.55) {
      lag = -((0.55 - this.half) / 0.19) * 0.07;
    }
    let pose;
    if (lag <= 0) {
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
        if (this.poses[i].t <= want) {
          pose = this.poses[i];
          break;
        }
      }
    }

    const f = this.figure;
    const fd = f.userData;
    f.position.set(pose.x, g.player.pos.y, pose.z);
    f.rotation.y = pose.yaw + Math.PI;
    const stride = Math.sin(pose.ph) * 0.46 * pose.sr;
    fd.legs[0].hip.rotation.x = stride;
    fd.legs[1].hip.rotation.x = -stride;
    fd.legs[0].knee.rotation.x = Math.max(0, -stride) * 0.28;
    fd.legs[1].knee.rotation.x = Math.max(0, stride) * 0.28;
    fd.arms[0].shoulder.rotation.x = -stride * 0.52;
    fd.arms[1].shoulder.rotation.x = stride * 0.52;
    fd.arms[0].elbow.rotation.x = 0.08 + Math.max(0, stride) * 0.14;
    fd.arms[1].elbow.rotation.x = 0.08 + Math.max(0, -stride) * 0.14;
    fd.torso.rotation.z = Math.sin(pose.ph * 2) * 0.012 * pose.sr;
    fd.headMount.position.y = fd.headMount.userData.baseY +
      Math.abs(Math.sin(pose.ph)) * 0.012 * pose.sr;
    fd.headLight.intensity = lerp(7, 18, smoothstep(0.15, 1, closeness));
    this.lamp.intensity = lerp(54, 68, smoothstep(0.25, 1, closeness));

    const closingElapsed = Math.max(0, this.t - 7);
    const practicalLife = 1 - smoothstep(2, 18, closingElapsed);
    this.dresserGlow.intensity = 4.5 * practicalLife *
      (0.93 + Math.sin(this.t * 17.3) * 0.05 + Math.sin(this.t * 7.1) * 0.02);

    switch (this.phase) {
      case 'still':
        this.veilMat.opacity = 1;
        if (this.t > 3 && !this._rattled) {
          this._rattled = true;
          const at = this.doorHit.getWorldPosition(new THREE.Vector3());
          g.audio.lockedRattle({ pos: at, gain: 0.6 });
        }
        if (this.t > 7) {
          this.phase = 'closing';
          g.audio.stoneGrind({ gain: 0.4, rate: 0.5 });
        }
        break;
      case 'closing': {
        const elapsed = this.t - 7;
        this.veilMat.opacity = 1 - smoothstep(0.08, 1.7, elapsed);
        if (this.veilMat.opacity <= 0.005) {
          for (const veil of this.wallVeils) veil.visible = false;
        }

        const speed = 0.05 * (1 + elapsed * 0.06);
        this.half = Math.max(0.36, this.half - speed * dt);
        this._placeWalls();

        // Furniture obeys the room: it scrapes and leans ahead of the glass.
        const clampIn = (m, r) => {
          m.position.x = clamp(m.position.x, CX - this.half + r, CX + this.half - r);
          m.position.z = clamp(m.position.z, CZ - this.half + r, CZ + this.half - r);
        };
        clampIn(this.bed, 0.9);
        clampIn(this.dresser, 0.5);
        this.doorPanel.position.x = Math.max(
          this.doorPanel.position.x, CX - this.half + 0.05);
        this.winFrame.position.z = Math.min(
          this.winFrame.position.z, CZ + this.half - 0.07);
        const crush = smoothstep(0.25, 1, closeness);
        this.bed.rotation.z = this.bed.userData.homeRotation.z +
          Math.sin(elapsed * 0.61) * 0.018 * crush;
        this.dresser.rotation.x = this.dresser.userData.homeRotation.x -
          0.035 * crush;
        this.doorPanel.rotation.z = this.doorPanel.userData.homeRotation.z +
          0.025 * crush;
        this.winFrame.rotation.z = this.winFrame.userData.homeRotation.z -
          0.02 * crush;

        g.baseTension = clamp(1 - (this.half - 0.36) / 2.6, 0, 1) * 0.9;
        g.audio.setTension(g.baseTension);
        if (!this._grind || this.t > this._grind) {
          this._grind = this.t + 2.6;
          g.audio.stoneGrind({
            gain: 0.3 + (1 - this.half / 3) * 0.4,
            rate: 0.5 + (1 - this.half / 3) * 0.3,
          });
          g.shake(0.05 + (1 - this.half / 3) * 0.1);
        }

        // Physical wall pressure constrains translation but never camera yaw.
        g.player.pos.x = clamp(
          g.player.pos.x, CX - this.half + 0.34, CX + this.half - 0.34);
        g.player.pos.z = clamp(
          g.player.pos.z, CZ - this.half + 0.34, CZ + this.half - 0.34);
        if (this.half <= 0.37) {
          this.phase = 'end';
          // Look input remains live through the visible fade. Freeze only once
          // the screen is fully black and control no longer has visible meaning.
          g.fadeOut(5, () => {
            g.player.frozen = true;
            g.showEnd();
          }, true);
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

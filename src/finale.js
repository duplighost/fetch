// finale.js — the room at the end. Much like the first. Locked. No skull.
// The walls are mirrors and they do not stop. The reflection wears the exact
// beginning skull on LAYER_DOUBLE, so it exists only in glass.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './util.js';
import { Mirror, Mirrors, LAYER_DOUBLE } from './mirrors.js';

const CX = 500, CZ = 500;
const ROOM_H = 2.7;
const CONTACT_HALF = 0.37;
const CONTACT_TIME = 2.35;

// THE RAISED HANDS, authored here because _updatePressure owns them (it rewrites
// both rotations every frame, after skull.update). Roughly (-PI/2, 0, ±PI) —
// fingers up, backs of the hands to the camera, thumbs lateral — softened by
// the splay the hold pose already carries. The ±PI about each hand's own local
// Z is the finger axis: it turns the hand over without mirroring it, which
// matters because mkHand puts the handedness in the GEOMETRY (right thumb at
// local -X, left at +X). Negating thumb offsets instead would put a left hand
// on the right wrist.
const RAISED_L = Object.freeze({ x: -1.24, y: 0.30, z: Math.PI - 0.10 });
const RAISED_R = Object.freeze({ x: -1.24, y: -0.30, z: -(Math.PI - 0.10) });

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

// A seven-ring torso gives the reflected body an actual ribcage, waist, pelvis
// transition, and sloped shoulders. It is still deliberately low-poly, but its
// silhouette now comes from anatomy and tailoring instead of a scaled pill.
function makeTailoredTorsoGeometry() {
  const rings = [
    // y, half-width, half-depth, slight front/back offset, shoulder drop
    [0.79, 0.17, 0.105, -0.004, 0],
    [0.88, 0.205, 0.125, 0, 0],
    [1.03, 0.155, 0.102, 0.004, 0],
    [1.22, 0.19, 0.118, 0.006, 0],
    [1.38, 0.245, 0.137, 0.002, 0],
    [1.5, 0.282, 0.143, -0.002, 0.075],
    [1.54, 0.122, 0.086, -0.008, 0],
  ];
  const segments = 12;
  const verts = [];
  const indices = [];
  for (const [y, rx, rz, zBias, shoulderDrop] of rings) {
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      // Flatten the back fractionally and leave more cloth over the sternum.
      const s = Math.sin(a);
      const z = s * rz * (s > 0 ? 1.06 : 0.9) + zBias;
      // A human shoulder line falls away from the neck. Applying that fall to
      // the outer x-axis vertices avoids a horizontal top face under the light.
      const ringY = y - shoulderDrop * Math.pow(Math.abs(Math.cos(a)), 1.35);
      verts.push(Math.cos(a) * rx, ringY, z);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + next;
      const c = (i + 1) * segments + j;
      const d = (i + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  const bottomCenter = verts.length / 3;
  verts.push(0, rings[0][0], rings[0][3]);
  const topCenter = verts.length / 3;
  verts.push(0, rings.at(-1)[0], rings.at(-1)[3]);
  for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments;
    indices.push(bottomCenter, j, next);
    const top = (rings.length - 1) * segments;
    indices.push(topCenter, top + next, top + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function makeLapelGeometry() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    0.025, 1.49, 0.151,
    0.165, 1.445, 0.143,
    0.108, 1.17, 0.137,
    0.035, 1.305, 0.148,
  ], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

function makeCoatPanelGeometry() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    0.012, 1.2, 0.13,
    0.16, 1.17, 0.125,
    0.145, 0.79, 0.112,
    0.085, 0.735, 0.108,
    0.018, 0.78, 0.12,
  ], 3));
  geo.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

// Shared, blunt-toed shoe geometry. The sloped vamp and squared heel keep the
// feet planted without reintroducing another toy-like capsule.
function makeShoeGeometry() {
  const w = 0.065;
  const verts = [
    -w, 0, -0.085, w, 0, -0.085, -w, 0, 0.18, w, 0, 0.18,
    -w, 0.105, -0.085, w, 0.105, -0.085, -w, 0.062, 0.18, w, 0.062, 0.18,
  ];
  const indices = [
    0, 2, 1, 1, 2, 3,
    4, 5, 6, 5, 7, 6,
    0, 1, 4, 1, 5, 4,
    2, 6, 3, 3, 6, 7,
    0, 4, 2, 2, 4, 6,
    1, 3, 5, 3, 7, 5,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// One deterministic fracture shared by all four panes. Four LineSegments are
// still only four cheap draws, including in the mirror pass, and the branching
// silhouette reads by brightness rather than hue. It stays invisible until a
// hand presses the glass or the returning sound reaches the room.
function makeFractureGeometry() {
  const verts = [];
  const branch = (x0, y0, angle, length, bends, seed) => {
    let x = x0, y = y0, a = angle;
    for (let i = 0; i < bends; i++) {
      const nx = x + Math.cos(a) * length;
      const ny = y + Math.sin(a) * length;
      verts.push(x, y, 0, nx, ny, 0);
      if (i === 1 || i === 3) {
        const ba = a + (i % 2 ? 0.72 : -0.65) + seed * 0.03;
        const bx = nx + Math.cos(ba) * length * 0.62;
        const by = ny + Math.sin(ba) * length * 0.62;
        verts.push(nx, ny, 0, bx, by, 0);
      }
      x = nx; y = ny;
      a += Math.sin(seed * 1.7 + i * 2.13) * 0.24;
      length *= 0.84;
    }
  };
  for (let i = 0; i < 11; i++) {
    branch(0, 0.02, (i / 11) * Math.PI * 2 + 0.13, 0.18 + (i % 3) * 0.025, 5, i + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeBoundingSphere();
  return geo;
}

export class Finale {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.t = 0;
    this.half = 3.0;                  // wall half-extent, shrinks to contact at 0.37
    this.phase = 'idle';
    this.contactT = 0;
    this._contactPane = 0;
    this._recallActive = false;
    this._blackStarted = false;
    this._pressSoundT = 0;
    this._handPressure = 0;
    this._wallPressure = [0, 0, 0, 0];
    this._paneBaseTint = new THREE.Color(0xc1ccd1);
    this._paneHotTint = new THREE.Color(0xf4fbff);
    this._v0 = new THREE.Vector3();
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._recallFar = new THREE.Vector3();
    this._recallPos = new THREE.Vector3();
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
    this.rug = rug;
    this.rugHomeScale = rug.scale.clone();
    this.rugHomePosition = rug.position.clone();

    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x59666b, emissive: 0x182328, emissiveIntensity: 0.13,
      roughness: 0.72, metalness: 0.12,
    });
    this.fixtureMat = fixtureMat;
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
    const lamp = new THREE.PointLight(0xb3c9d3, 46, 8.2, 1.7);
    lamp.position.set(CX, ROOM_H - 0.48, CZ);
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

    const fractureGeo = makeFractureGeometry();
    this.fractures = [];
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.LineBasicMaterial({
        color: 0xe8f2f5, transparent: true, opacity: 0,
        depthWrite: false, toneMapped: false,
      });
      const cracks = new THREE.LineSegments(fractureGeo, mat);
      cracks.visible = false;
      cracks.renderOrder = 5;
      scene.add(cracks);
      this.fractures.push(cracks);
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
      o.userData.homeScale = o.scale.clone();
      o.userData.homeVisible = o.visible;
    }

    // The large props cannot remain whole inside the last metre without either
    // projecting through the opposite pane or popping out of existence. Small,
    // non-colliding remnants make that consumption physical: bed slats, drawer
    // rails, a muntin and torn dark cloth are pushed into the player's remaining
    // square of floor. Shared geometry keeps the four reflection passes cheap.
    const debris = new THREE.Group();
    debris.name = 'finale-crush-remnants';
    debris.position.set(CX, 0, CZ);
    const splinterGeo = new THREE.BoxGeometry(0.34, 0.045, 0.065);
    const clothGeo = new THREE.BoxGeometry(0.28, 0.028, 0.16);
    const splinterMat = woodEdge.clone();
    splinterMat.color.setHex(0x3f3934);
    const debrisSpecs = [
      [1.84, 0.055, 1.68, 0.22, 0.045, 0.2, -0.2, 0.65, 0],
      [1.48, 0.085, 2.2, 0.08, 0.075, 0.25, 0.12, -0.92, 0],
      [-1.72, 0.055, 2.18, -0.2, 0.045, 0.19, 0.16, 0.78, 0],
      [-2.18, 0.075, 1.62, -0.08, 0.065, 0.27, -0.1, -0.58, 0],
      [0.82, 0.095, 2.78, 0.24, 0.08, 0.02, 0.05, 1.12, 0],
      [-2.7, 0.09, -0.92, -0.24, 0.075, -0.06, -0.18, 0.5, 0],
      [1.25, 0.035, 1.05, 0.13, 0.035, -0.2, 0.08, -0.32, 1],
      [-1.45, 0.04, 1.48, -0.14, 0.04, -0.21, -0.06, 0.28, 1],
    ];
    const remnants = [];
    for (let i = 0; i < debrisSpecs.length; i++) {
      const [sx, sy, sz, ex, ey, ez, rx, rz, clothPiece] = debrisSpecs[i];
      const piece = addMesh(debris, clothPiece ? clothGeo : splinterGeo,
        clothPiece ? blanket : splinterMat, sx, sy, sz, rx, i * 0.31, rz);
      piece.visible = false;
      piece.userData.start = new THREE.Vector3(sx, sy, sz);
      piece.userData.end = new THREE.Vector3(ex, ey, ez);
      piece.userData.startRotation = piece.rotation.clone();
      piece.userData.spin = new THREE.Vector3(
        (i % 2 ? -1 : 1) * (0.3 + i * 0.04),
        (i % 3 - 1) * 0.55,
        (i % 2 ? 1 : -1) * (0.42 + i * 0.03));
      remnants.push(piece);
    }
    scene.add(debris);
    this.crushDebris = { group: debris, remnants };
  }

  _makeReflection(M) {
    const figure = new THREE.Group();
    figure.name = 'the-reflection';
    const cloth = new THREE.MeshStandardMaterial({
      color: 0x0a0d0e, emissive: 0x000000, emissiveIntensity: 0,
      roughness: 0.97,
    });
    const clothDark = new THREE.MeshStandardMaterial({
      color: 0x020303, roughness: 1, side: THREE.DoubleSide,
    });
    const clothRaised = new THREE.MeshStandardMaterial({
      color: 0x252a2b, roughness: 0.9, side: THREE.DoubleSide,
    });
    const seam = new THREE.MeshStandardMaterial({ color: 0x343a3b, roughness: 0.92 });
    const handMat = new THREE.MeshStandardMaterial({ color: 0x69635e, roughness: 0.9 });

    // Every bilateral body part shares geometry. The mirror renders four
    // times, so articulation is authored from a small fixed kit rather than
    // allocating unique primitives for each limb.
    const torsoGeo = makeTailoredTorsoGeometry();
    const neckGeo = new THREE.CylinderGeometry(0.072, 0.087, 0.15, 10);
    const pelvisGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.235, 10);
    const lapelGeo = makeLapelGeometry();
    const coatPanelGeo = makeCoatPanelGeometry();
    const thighGeo = new THREE.CylinderGeometry(0.067, 0.077, 0.36, 9);
    const kneeGeo = new THREE.SphereGeometry(0.064, 9, 7);
    const calfGeo = new THREE.CylinderGeometry(0.05, 0.063, 0.32, 9);
    const shoeGeo = makeShoeGeometry();
    const deltoidGeo = new THREE.SphereGeometry(0.068, 9, 7);
    const upperArmGeo = new THREE.CylinderGeometry(0.048, 0.062, 0.3, 9);
    const elbowGeo = new THREE.SphereGeometry(0.052, 9, 7);
    const forearmGeo = new THREE.CylinderGeometry(0.038, 0.052, 0.285, 9);
    const cuffGeo = new THREE.CylinderGeometry(0.044, 0.047, 0.07, 8);
    const palmGeo = new THREE.CapsuleGeometry(0.032, 0.062, 3, 7);
    const digitGeo = new THREE.CapsuleGeometry(0.009, 0.045, 2, 6);

    const torso = new THREE.Group();
    torso.position.y = 0;
    const chest = addMesh(torso, torsoGeo, cloth);
    chest.name = 'reflection-tailored-ribcage';
    const pelvis = addMesh(torso, pelvisGeo, clothDark, 0, 0.82, -0.004);
    pelvis.name = 'reflection-pelvis';
    pelvis.scale.set(1.27, 1, 0.76);
    const neck = addMesh(torso, neckGeo, clothDark, 0, 1.595, -0.01);
    neck.name = 'reflection-neck-collar';
    neck.scale.z = 0.78;

    // Raised lapels describe collarbones and sternum without the bright,
    // uniform-like V that made the old body read as a mannequin. Torn coat
    // fronts break the lower silhouette asymmetrically while remaining static.
    for (const s of [-1, 1]) {
      const lapel = addMesh(torso, lapelGeo, clothRaised);
      lapel.name = 'reflection-lapel';
      lapel.scale.x = s;
      const panel = addMesh(torso, coatPanelGeo, s < 0 ? clothDark : cloth);
      panel.name = 'reflection-torn-coat-front';
      panel.scale.x = s;
      panel.rotation.z = s * (s < 0 ? 0.018 : -0.01);
    }
    addBox(torso, seam, 0.025, 0.49, 0.018, 0, 1.08, 0.145);
    addBox(torso, seam, 0.09, 0.024, 0.018, -0.1, 0.87, 0.136, 0, 0, -0.08);
    figure.add(torso);

    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.105, 0.82, -0.002);
      const upper = addMesh(hip, thighGeo, clothDark, 0, -0.19, 0);
      upper.name = 'reflection-thigh';
      upper.scale.z = 0.82;
      const knee = new THREE.Group();
      knee.position.set(0, -0.41, 0.004);
      const kneeCap = addMesh(knee, kneeGeo, s < 0 ? cloth : clothDark, 0, 0, 0.012);
      kneeCap.name = 'reflection-knee';
      kneeCap.scale.set(0.93, 0.8, 0.72);
      const lower = addMesh(knee, calfGeo, cloth, 0, -0.2, -0.003);
      lower.name = 'reflection-calf';
      lower.scale.z = 0.78;
      const shoe = addMesh(knee, shoeGeo, clothDark, 0, -0.405, 0.018);
      shoe.name = 'reflection-planted-shoe';
      shoe.rotation.y = s * 0.025;
      hip.add(knee);
      figure.add(hip);
      legs.push({ hip, knee });
    }

    const arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.268, 1.445, -0.002);
      shoulder.rotation.z = s * -0.08;
      const deltoid = addMesh(shoulder, deltoidGeo, cloth, 0, -0.025, 0);
      deltoid.name = 'reflection-deltoid';
      deltoid.scale.set(0.9, 1.24, 0.76);
      const upper = addMesh(shoulder, upperArmGeo, s < 0 ? cloth : clothDark,
        0, -0.18, 0);
      upper.name = 'reflection-upper-arm';
      upper.scale.z = 0.82;
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.375, 0.002);
      const joint = addMesh(elbow, elbowGeo, s < 0 ? cloth : clothDark, 0, 0, 0);
      joint.name = 'reflection-elbow';
      joint.scale.set(0.9, 0.76, 0.72);
      const lower = addMesh(elbow, forearmGeo, clothDark, 0, -0.17, 0.002);
      lower.name = 'reflection-forearm';
      lower.scale.z = 0.8;
      const cuff = addMesh(elbow, cuffGeo, seam, 0, -0.337, 0.002);
      cuff.name = 'reflection-cuff';
      cuff.scale.z = 0.78;

      const hand = new THREE.Group();
      hand.name = 'reflection-articulated-hand';
      hand.position.set(0, -0.37, 0.012);
      const palm = addMesh(hand, palmGeo, handMat, 0, -0.045, 0);
      palm.name = 'reflection-palm';
      palm.scale.set(0.92, 1, 0.68);
      const fingers = new THREE.InstancedMesh(digitGeo, handMat, 4);
      fingers.name = 'reflection-fingers';
      fingers.castShadow = true;
      fingers.receiveShadow = true;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      for (let i = 0; i < 4; i++) {
        position.set((i - 1.5) * 0.017, -0.125 + Math.abs(i - 1.5) * 0.006, 0.003);
        rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (i - 1.5) * -0.035);
        scale.set(0.92, 1 - Math.abs(i - 1.5) * 0.1, 0.72);
        matrix.compose(position, rotation, scale);
        fingers.setMatrixAt(i, matrix);
      }
      fingers.instanceMatrix.needsUpdate = true;
      hand.add(fingers);
      const thumb = addMesh(hand, digitGeo, handMat,
        s * 0.046, -0.077, 0.006, 0, 0, s * -0.72);
      thumb.name = 'reflection-thumb';
      thumb.scale.set(1, 0.86, 0.76);
      elbow.add(hand);
      shoulder.add(elbow);
      figure.add(shoulder);
      arms.push({ shoulder, elbow, hand });
    }

    const contactShadow = addMesh(figure, new THREE.CircleGeometry(0.24, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.34,
        depthWrite: false, side: THREE.DoubleSide,
      }), 0, 0.008, 0.025, -Math.PI / 2);
    contactShadow.name = 'reflection-contact-shadow';
    contactShadow.castShadow = false;
    contactShadow.receiveShadow = false;

    const headMount = new THREE.Group();
    headMount.position.y = 1.78;
    headMount.userData.baseY = 1.78;
    const fallback = this._makeFallbackSkull(M);
    headMount.add(fallback);
    figure.add(headMount);

    // This light is visible only to mirror cameras. It supplies a pale rim to
    // the exact bone geometry without creating a hue-only gameplay signal.
    const headLight = new THREE.PointLight(0xb6c9cb, 1.45, 2.2, 2);
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
    const sourceNodes = [];
    live.root.traverse((o) => sourceNodes.push(o));
    const exact = live.root.clone(true);
    live.setStage(oldStage);
    const exactNodes = [];
    exact.traverse((o) => exactNodes.push(o));
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
    const jawIndex = sourceNodes.indexOf(live.jaw);
    data.exactJaw = jawIndex >= 0 ? exactNodes[jawIndex] : null;
    if (data.exactJaw) {
      // The waterfall throw may have left the live jaw open. The thing in the
      // glass begins composed, then opens deliberately at contact.
      data.exactJaw.rotation.x = 0;
      data.exactJawHomeX = 0;
    }
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
      const cracks = this.fractures && this.fractures[i];
      if (cracks) {
        const nx = defs[i][3], nz = defs[i][4];
        cracks.position.set(x + nx * 0.018, ROOM_H * 0.58, z + nz * 0.018);
        cracks.rotation.set(0, ry, 0);
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
    this.contactT = 0;
    this._contactPane = 0;
    this._recallActive = false;
    this._blackStarted = false;
    this._pressSoundT = 0;
    this._handPressure = 0;
    this._wallPressure.fill(0);
    this._rattled = false;
    this._grind = 0;
    this._bedSnap = false;
    this._dresserSnap = false;
    this.poses = [];
    this._mountExactSkull();
    // The swap happens behind the fade, at the door, long before anything is
    // raised — it is invisible until the hands come up, so the earliest moment
    // is the safest one.
    g.skull.becomeBone?.(g.mats?.bone);

    for (const o of this.resetProps) {
      o.position.copy(o.userData.homePosition);
      o.rotation.copy(o.userData.homeRotation);
      o.scale.copy(o.userData.homeScale);
      o.visible = o.userData.homeVisible;
    }
    const fd = this.figure.userData;
    fd.headMount.position.set(0, fd.headMount.userData.baseY, 0);
    fd.headMount.rotation.set(0, 0, 0);
    fd.headMount.scale.setScalar(1);
    fd.torso.rotation.x = 0;
    this.figure.scale.set(1, 1, 1);
    if (fd.exactJaw) fd.exactJaw.rotation.x = fd.exactJawHomeX || 0;
    this.veilMat.opacity = 1;
    for (const veil of this.wallVeils) veil.visible = true;
    for (let i = 0; i < this.panes.length; i++) {
      this.panes[i].setFlare(0);
      this.panes[i].material.uniforms.uTint.value.copy(this._paneBaseTint);
      this.fractures[i].visible = false;
      this.fractures[i].material.opacity = 0;
    }
    this.lamp.intensity = 46;
    this.dresserGlow.intensity = 4.5;
    fd.headLight.intensity = 1.45;
    fd.headLight.distance = 2.2;
    this.fixtureMat.emissiveIntensity = 0.13;
    this.rug.position.copy(this.rugHomePosition);
    this.rug.scale.copy(this.rugHomeScale);
    for (const piece of this.crushDebris.remnants) {
      piece.visible = false;
      piece.position.copy(piece.userData.start);
      piece.rotation.copy(piece.userData.startRotation);
      piece.scale.set(1, 1, 1);
    }
    this._placeWalls();

    this._captureEmptyHands();
    this._restoreEmptyHands(1);

    // enterMirrorRoom invokes begin at full black. Reorient only during that
    // hidden transition; a visible debug entry preserves the current look.
    // Stand in the narrow gap between the remembered dresser and window. From
    // here the first revealed reflection is not hidden behind either prop.
    g.player.pos.set(CX - 0.65, 0, CZ - 0.6);
    const frameHidden = !g.el || !g.el.fade ||
      Number.parseFloat(g.el.fade.style.opacity || '1') >= 0.99;
    // The original spawn faced a blank wallpaper slab for the entire seven
    // second stillness. During the already-black transition, face the remembered
    // bed/window composition so recognition lands before the room betrays it.
    if (frameHidden) g.player.yaw = Math.PI;
    g.player.frozen = false;
    g.player._sync(0);
    // Route the transition through the Director so old cave beats are scoped
    // out and the mirror's fog, growth, tension, and audio state stay coherent.
    g.director.setAct('mirror', true);
    g.checkpoint('mirror');
    for (const m of this.panes) m.setActive(true);
    this.figure.visible = true;
  }

  _captureEmptyHands() {
    if (this.emptyHands) return;
    const hold = this.game.skull && this.game.skull.hold;
    if (!hold || hold.children.length < 2) return;
    const left = hold.children[0], right = hold.children[1];
    this.emptyHands = {
      hold, left, right,
      holdPos: hold.position.clone(),
      holdRot: hold.rotation.clone(),
      holdScale: hold.scale.clone(),
      leftRot: left.rotation.clone(),
      rightRot: right.rotation.clone(),
    };
  }

  _restoreEmptyHands(immediate = 0) {
    const h = this.emptyHands;
    if (!h) return;
    if (immediate) {
      h.hold.position.copy(h.holdPos);
      h.hold.rotation.copy(h.holdRot);
      h.hold.scale.copy(h.holdScale);
      h.left.rotation.copy(h.leftRot);
      h.right.rotation.copy(h.rightRot);
    }
  }

  _updatePressure(dt, enabled) {
    const g = this.game;
    const p = g.player.pos;
    const v = g.player.vel;
    const inset = Math.max(0.01, this.half - 0.34);
    const gaps = [
      p.z - (CZ - inset), (CZ + inset) - p.z,
      p.x - (CX - inset), (CX + inset) - p.x,
    ];
    const outward = [-v.z, v.z, -v.x, v.x];
    let strongest = 0, strongestI = 0;
    for (let i = 0; i < 4; i++) {
      const touching = enabled ? 1 - clamp(gaps[i] / 0.18, 0, 1) : 0;
      const pressure = touching * clamp(outward[i] / 3.8, 0, 1);
      this._wallPressure[i] = pressure;
      if (pressure > strongest) { strongest = pressure; strongestI = i; }
    }

    // Hands only rise when the player is both pushing and looking into that
    // wall. Pushing backward still makes the glass complain, but it does not
    // paste a pair of palms over a view that is facing elsewhere.
    g.camera.getWorldDirection(this._v0);
    this._v0.y = 0;
    if (this._v0.lengthSq() > 1e-6) this._v0.normalize();
    const facing = strongestI === 0 ? -this._v0.z
      : strongestI === 1 ? this._v0.z
        : strongestI === 2 ? -this._v0.x : this._v0.x;
    const handTarget = strongest * smoothstep(0.18, 0.72, facing);
    const handRate = handTarget > this._handPressure ? 12 : 7;
    this._handPressure = lerp(
      this._handPressure, handTarget, 1 - Math.exp(-dt * handRate));

    const h = this.emptyHands;
    if (h) {
      const k = smoothstep(0, 1, this._handPressure);
      this._v1.set(0, -0.11, -0.43);
      h.hold.position.lerpVectors(h.holdPos, this._v1, k);
      h.hold.rotation.x = lerp(h.holdRot.x, -0.08, k);
      h.hold.rotation.y = lerp(h.holdRot.y, 0, k);
      h.hold.rotation.z = lerp(h.holdRot.z, 0, k);
      h.hold.scale.copy(h.holdScale).multiplyScalar(1 + k * 0.09);
      // The raise is authored HERE, not in skull.js. This block rewrites both
      // hand rotations every frame after skull.update, so a pose fix over there
      // passes its probe and changes nothing on screen.
      //
      // The k=0 end used to alias skull.js's `lowered` row through
      // _captureEmptyHands, which is why the raised hands came up rolled 180°
      // about their own finger axis — palms out, backs to the glass, reading as
      // somebody else's hands reaching in at Alex rather than his own coming up.
      // RAISED_L/RAISED_R sever that coupling. BOTH endpoints carry the roll:
      // rolling only k=1 spins each hand through palm-toward-camera during a
      // press. Handedness is in the geometry (mkHand builds the thumbs on
      // opposite sides), so this is a rigid roll of the group, never a mirror.
      h.left.rotation.set(
        lerp(RAISED_L.x, -1.28, k),
        lerp(RAISED_L.y, 0.22, k),
        lerp(RAISED_L.z, Math.PI - 0.05, k));
      h.right.rotation.set(
        lerp(RAISED_R.x, -1.28, k),
        lerp(RAISED_R.y, -0.22, k),
        lerp(RAISED_R.z, -(Math.PI - 0.05), k));
    }

    this._pressSoundT = Math.max(0, this._pressSoundT - dt);
    if (strongest > 0.38 && this._pressSoundT <= 0) {
      const at = this.panes[strongestI].mesh.position;
      g.audio.glassTink({ pos: at, gain: 0.12 + strongest * 0.12,
        rate: 0.48 + strongest * 0.2, verb: 0.72 });
      g.shake(0.025 + strongest * 0.035);
      this._pressSoundT = 0.42 + (1 - strongest) * 0.32;
    }
  }

  _updatePaneEffects(closeness, contactU = 0) {
    const pressureGlow = smoothstep(0.48, 1, closeness) * 0.022;
    const pulse = contactU > 0
      ? 0.82 + Math.sin(this.contactT * (6 + contactU * 8)) * 0.18
      : 1;
    for (let i = 0; i < this.panes.length; i++) {
      const local = this._wallPressure[i] || 0;
      const chosen = i === this._contactPane ? contactU : 0;
      const flare = clamp(
        pressureGlow + local * 0.11 + contactU * 0.07 + chosen * 0.07,
        0, 0.22) * pulse;
      this.panes[i].setFlare(flare);
      const tint = clamp(contactU * 0.52 + chosen * 0.22 + local * 0.14, 0, 0.82);
      this.panes[i].material.uniforms.uTint.value
        .copy(this._paneBaseTint).lerp(this._paneHotTint, tint * pulse);

      const cracks = this.fractures[i];
      // At contact the old version lit all four fracture fields equally. Their
      // reflections stacked into a bright CAD wireframe and erased both jaw and
      // hands. Keep pressure local and let the viewed pane own the final break;
      // the other walls retain only a hairline echo.
      const crackOpacity = clamp(
        local * 0.24 + contactU * 0.035 + chosen * 0.62,
        0, 0.74) * pulse;
      cracks.material.opacity = crackOpacity;
      cracks.visible = crackOpacity > 0.006;
    }
  }

  _updateCrushedProps(elapsed, closeness) {
    const h = this.half;
    const bedHome = this.bed.userData.homePosition;
    const bedScale = this.bed.userData.homeScale;
    const bedEat = 1 - smoothstep(1.12, 2.74, h);
    const bedMove = Math.sqrt(clamp(bedEat, 0, 1));
    const bedEdge = Math.max(0.14, h - 0.16);
    this.bed.position.x = lerp(bedHome.x, CX + bedEdge, bedMove);
    this.bed.position.z = lerp(bedHome.z, CZ + Math.min(0.22, bedEdge), bedEat * 0.72);
    this.bed.rotation.x = this.bed.userData.homeRotation.x - bedEat * 0.16;
    this.bed.rotation.z = this.bed.userData.homeRotation.z + bedEat * 1.18;
    this.bed.scale.set(
      bedScale.x * (1 - bedEat * 0.58),
      bedScale.y * (1 - bedEat * 0.5),
      bedScale.z * (1 - bedEat * 0.7));
    this.bed.visible = true;

    const dresserHome = this.dresser.userData.homePosition;
    const dresserScale = this.dresser.userData.homeScale;
    const dresserEat = 1 - smoothstep(1.08, 2.68, h);
    const dresserMove = Math.sqrt(clamp(dresserEat, 0, 1));
    const dresserEdge = Math.max(0.13, h - 0.15);
    this.dresser.position.x = lerp(dresserHome.x, CX - dresserEdge, dresserMove);
    this.dresser.position.z = lerp(
      dresserHome.z, CZ + Math.min(0.2, dresserEdge), dresserMove);
    this.dresser.rotation.x = this.dresser.userData.homeRotation.x - dresserEat * 0.72;
    this.dresser.rotation.z = this.dresser.userData.homeRotation.z - dresserEat * 0.16;
    this.dresser.scale.set(
      dresserScale.x * (1 - dresserEat * 0.52),
      dresserScale.y * (1 - dresserEat * 0.48),
      dresserScale.z * (1 - dresserEat * 0.64));
    this.dresser.visible = true;

    if (!this._bedSnap && bedEat > 0.52) {
      this._bedSnap = true;
      this.bed.getWorldPosition(this._v2);
      this.game.audio.creak({ pos: this._v2, gain: 0.62, rate: 0.48, verb: 0.64 });
      this.game.shake(0.075);
    }
    if (!this._dresserSnap && dresserEat > 0.68) {
      this._dresserSnap = true;
      this.dresser.getWorldPosition(this._v2);
      this.game.audio.knock({ pos: this._v2, gain: 0.46, rate: 0.62, verb: 0.7 });
      this.game.audio.metalDrop({ pos: this._v2, gain: 0.22, rate: 1.36, verb: 0.66 });
      this.game.shake(0.09);
    }

    const debrisU = smoothstep(0.42, 0.84, closeness);
    const debrisLimit = Math.max(0.16, h - 0.075);
    for (let i = 0; i < this.crushDebris.remnants.length; i++) {
      const piece = this.crushDebris.remnants[i];
      piece.visible = debrisU > 0.015;
      piece.position.lerpVectors(piece.userData.start, piece.userData.end, debrisU);
      piece.position.x = clamp(piece.position.x, -debrisLimit, debrisLimit);
      piece.position.z = clamp(piece.position.z, -debrisLimit, debrisLimit);
      piece.position.y += Math.sin(elapsed * 1.8 + i * 1.7) * 0.018 * (1 - debrisU);
      const home = piece.userData.startRotation, spin = piece.userData.spin;
      piece.rotation.set(
        home.x + spin.x * debrisU,
        home.y + spin.y * debrisU,
        home.z + spin.z * debrisU);
      const squash = 1 - debrisU * 0.22;
      piece.scale.set(squash, 1 - debrisU * 0.35, squash);
    }

    // The rug cannot remain four metres long in a 74cm room. It bunches into a
    // raised dark patch under the last playable square rather than extending
    // invisibly through all four mirrors.
    const rugX = clamp((h * 2 - 0.12) / 3.35, 0.1, 1);
    const rugZ = clamp((h * 2 - 0.12) / 4.35, 0.08, 1);
    this.rug.scale.set(this.rugHomeScale.x * rugX, this.rugHomeScale.y * rugZ, 1);
    this.rug.position.x = lerp(this.rugHomePosition.x, CX, closeness);
    this.rug.position.y = this.rugHomePosition.y + closeness * 0.026;
    this.rug.position.z = lerp(this.rugHomePosition.z, CZ, closeness);

    // The door and window belong to their walls. They stay usable/readable as
    // long as possible, but their frames squeeze to the remaining span instead
    // of projecting through the opposite glass at the last meter.
    const innerSpan = Math.max(0.18, h * 2 - 0.12);
    const frameCrush = smoothstep(0.38, 0.9, closeness);
    const doorHome = this.doorPanel.userData.homePosition;
    const doorScale = this.doorPanel.userData.homeScale;
    this.doorPanel.position.x = Math.max(doorHome.x, CX - h + 0.05);
    this.doorPanel.scale.set(
      doorScale.x * clamp(innerSpan / 1.48, 0.16, 1),
      doorScale.y * (1 - frameCrush * 0.62), doorScale.z);
    this.doorPanel.rotation.z = this.doorPanel.userData.homeRotation.z +
      smoothstep(0.18, 1, closeness) * 0.22;

    const winHome = this.winFrame.userData.homePosition;
    const winScale = this.winFrame.userData.homeScale;
    this.winFrame.position.z = Math.min(winHome.z, CZ + h - 0.07);
    this.winFrame.scale.set(
      winScale.x * clamp(innerSpan / 1.74, 0.14, 1),
      winScale.y * (1 - frameCrush * 0.72), winScale.z);
    this.winFrame.rotation.z = this.winFrame.userData.homeRotation.z -
      smoothstep(0.18, 1, closeness) * 0.2;
  }

  _beginContact() {
    if (this.phase === 'contact' || this.phase === 'black' || this.phase === 'end') return;
    const g = this.game;
    this.phase = 'contact';
    this.contactT = 0;
    this.half = CONTACT_HALF;
    this._contactCrack = false;
    this._contactSurge = false;
    this._placeWalls();

    // THE LAST THING YOU SEE IS YOUR OWN HANDS. They come up once — nothing is
    // coming back to them, so this is not a catch, it is being shown something
    // — and they are bone. The tree in the graveyard held a skeleton with an
    // empty cradle where a head should be; this is the other half of that
    // sentence, and the game never says either half out loud.
    g.skull.becomeBone?.(g.mats?.bone);
    g.skull.raiseHands?.(7);

    g.camera.updateMatrixWorld(true);
    g.camera.getWorldDirection(this._v0);
    this._v0.y = 0;
    if (this._v0.lengthSq() < 1e-6) this._v0.set(0, 0, -1);
    else this._v0.normalize();
    let best = -Infinity;
    for (let i = 0; i < this.panes.length; i++) {
      this._v1.copy(this.panes[i].mesh.position).sub(g.camera.position);
      this._v1.y = 0;
      if (this._v1.lengthSq() < 1e-6) continue;
      this._v1.normalize();
      const score = this._v0.dot(this._v1);
      if (score > best) { best = score; this._contactPane = i; }
    }

    this._v1.copy(this.panes[this._contactPane].mesh.position)
      .sub(g.camera.position);
    this._v1.y = 0;
    if (this._v1.lengthSq() < 1e-6) this._v1.copy(this._v0);
    else this._v1.normalize();
    this._recallFar.copy(g.camera.position).addScaledVector(this._v1, 78);
    this._recallFar.y = g.camera.position.y + 0.35;
    this._recallPos.copy(this._recallFar);
    g.audio.skullMoanStart(this._recallFar);
    this._recallActive = true;
    g.audio.duck(0.12, 3.5);
    g.audio.glassTink({ pos: this.panes[this._contactPane].mesh.position,
      gain: 0.42, rate: 0.72, verb: 0.9 });
    g.shake(0.13);
  }

  _updateContact(dt) {
    const g = this.game;
    const fd = this.figure.userData;
    this.contactT += dt;
    const u = clamp(this.contactT / CONTACT_TIME, 0, 1);
    const open = smoothstep(0.03, 0.56, u);
    const lunge = smoothstep(0.48, 1, u);

    if (fd.exactJaw) {
      fd.exactJaw.rotation.x = (fd.exactJawHomeX || 0) + open * 0.98;
    }
    fd.headMount.position.y = fd.headMount.userData.baseY +
      0.015 * open + 0.065 * lunge;
    // The skull may approach the glass, but it must never cross its clip plane.
    // The old 20cm lunge plus 1.38x scale split the face into inverted chunks in
    // the last playable frame. Jaw, tilt, arms and light now carry the attack.
    fd.headMount.position.z = 0.025 * lunge;
    fd.headMount.rotation.x = -0.08 * open - 0.16 * lunge;
    fd.headMount.rotation.y = Math.sin(this.contactT * 12.5) * 0.026 * lunge;
    fd.headMount.rotation.z = -0.075 * lunge;
    fd.headMount.scale.setScalar(1 + lunge * 0.13);
    fd.torso.rotation.x = -0.11 * lunge;
    fd.torso.rotation.z += Math.sin(this.contactT * 9.5) * 0.006 * lunge;
    fd.arms[0].shoulder.rotation.x = lerp(fd.arms[0].shoulder.rotation.x, -0.3, lunge);
    fd.arms[1].shoulder.rotation.x = lerp(fd.arms[1].shoulder.rotation.x, -0.3, lunge);
    fd.arms[0].shoulder.rotation.z = lerp(0.08, 0.42, lunge);
    fd.arms[1].shoulder.rotation.z = lerp(-0.08, -0.42, lunge);
    fd.arms[0].elbow.rotation.x = lerp(fd.arms[0].elbow.rotation.x, -0.12, lunge);
    fd.arms[1].elbow.rotation.x = lerp(fd.arms[1].elbow.rotation.x, -0.12, lunge);
    // Contact begins in the same already-compressed body state as the last
    // closing frame. Expanding back to unit scale here made elbows and shins
    // cross the last 74cm room even though the final attack pose happened to
    // tuck them in again.
    this.figure.scale.set(0.92 - u * 0.08, 1.018 + u * 0.02, 0.9 - u * 0.08);
    const pulse = 0.84 + Math.sin(this.contactT * (8 + u * 12)) * 0.16;
    // Pull the rim inward as it brightens. A huge-range point light turned the
    // whole torso into a flat white cutout; a tight bone light keeps the jaw and
    // sockets legible while the body remains a silhouette.
    fd.headLight.intensity = lerp(3.55, 4.2, u) * pulse;
    fd.headLight.distance = lerp(0.92, 0.5, u);
    this.lamp.intensity = lerp(25, 13, u) * (0.94 + pulse * 0.06);
    g.baseTension = 1;
    g.audio.setTension(1);

    // Cubic travel makes the old voice spend long enough impossibly far away
    // to be recognized, then cross the whole soundstage in the final breath.
    const travel = u * u * u;
    this._recallPos.lerpVectors(this._recallFar, g.camera.position, travel);
    this._recallPos.y = lerp(this._recallFar.y, g.camera.position.y - 0.08, travel);
    if (this._recallActive) {
      g.audio.skullMoanUpdate(this._recallPos, lerp(7, 72, u * u), u);
    }

    if (!this._contactCrack && u >= 0.3) {
      this._contactCrack = true;
      g.audio.glassTink({ pos: this.panes[this._contactPane].mesh.position,
        gain: 0.72, rate: 0.9, verb: 0.95 });
      g.shake(0.22);
    }
    if (!this._contactSurge && u >= 0.68) {
      this._contactSurge = true;
      g.audio.stoneGrind({ pos: this.panes[this._contactPane].mesh.position,
        gain: 0.52, rate: 1.1, verb: 0.85 });
      g.shake(0.3);
    }
    if (u >= 1) this._hardBlack();
    return u;
  }

  _hardBlack() {
    if (this._blackStarted) return;
    this._blackStarted = true;
    const g = this.game;
    this.phase = 'black';
    if (this._recallActive) {
      g.audio.skullMoanStop();
      this._recallActive = false;
    }
    g.audio.duck(0, 12);
    // The image now earns its cut. This is intentionally almost instantaneous,
    // not the old five seconds of watching a CSS layer become opaque.
    g.fadeOut(0.045, () => {
      g.player.frozen = true;
      // Hold the impossible absence for one breath. The prior version exposed
      // the title in the same instant the image vanished, turning the cut into
      // a menu transition. Controls die only now, behind hard black; the known
      // catch and the stranger's gasp then arrive from showEnd in their existing
      // tested order.
      g.after(0.72, () => {
        if (this.phase !== 'black') return;
        this.phase = 'end';
        // The last playable image has already cut to hard black. Retire the
        // mirror renderer here so the finished game does not keep allocating
        // poses and drawing four 1024px reflection targets behind the title.
        this.active = false;
        g.showEnd();
      });
    });
  }

  update(dt) {
    // Once contact has cut to black there is no remaining visual simulation;
    // the delayed catch/title is owned by Game.after above. Freezing this
    // subsystem preserves the last authored frame without background churn.
    if (!this.active || this.phase === 'black' || this.phase === 'end') return;
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
    // The predictive double may lead the player into a wall they are actively
    // pushing. Keep its body just inside the mirrored volume: without this the
    // head crossed the oblique mirror clip plane and vanished precisely when
    // the player struggled hardest.
    const bodySqueeze = smoothstep(0.68, 1, closeness);
    const figureRoom = Math.max(0.025, this.half - lerp(0.3, 0.315, bodySqueeze));
    f.position.set(
      clamp(pose.x, CX - figureRoom, CX + figureRoom),
      g.player.pos.y,
      clamp(pose.z, CZ - figureRoom, CZ + figureRoom));
    f.rotation.y = pose.yaw + Math.PI;
    f.scale.set(
      1 - bodySqueeze * 0.08,
      1 + bodySqueeze * 0.018,
      1 - bodySqueeze * 0.1);
    // A running gait is readable while there is room to run. In the final
    // square it becomes a braced, nearly stationary struggle so the reflected
    // body cannot scissor its limbs through the mirror planes.
    const strideRoom = 1 - smoothstep(0.72, 1, closeness) * 0.92;
    const stride = Math.sin(pose.ph) * 0.46 * pose.sr * strideRoom;
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
    fd.headLight.intensity = lerp(1.45, 3.4, smoothstep(0.15, 1, closeness));
    this.lamp.intensity = lerp(46, 25, smoothstep(0.25, 1, closeness));
    this.fixtureMat.emissiveIntensity = lerp(0.13, 0.045, smoothstep(0.3, 1, closeness));

    const closingElapsed = Math.max(0, this.t - 7);
    const practicalLife = 1 - smoothstep(2, 18, closingElapsed);
    this.dresserGlow.intensity = 4.5 * practicalLife *
      (0.93 + Math.sin(this.t * 17.3) * 0.05 + Math.sin(this.t * 7.1) * 0.02);

    let contactU = this.phase === 'black' || this.phase === 'end' ? 1 : 0;
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
          g.audio.stoneGrind({ pos: this.panes[0].mesh.position,
            gain: 0.4, rate: 0.5, verb: 0.68 });
          // "In the final room of the game, have the player raise their hands
          // earlier." Here: the beat the mirrors wake and the walls begin to
          // come in. Infinity survives the per-frame decay, so they stay up
          // for the whole closing — which is also what finally makes the
          // glass-press pose something anyone can see.
          g.skull.raiseHands?.(Infinity);
        }
        break;
      case 'closing': {
        const elapsed = this.t - 7;
        this.veilMat.opacity = 1 - smoothstep(0.08, 1.7, elapsed);
        if (this.veilMat.opacity <= 0.005) {
          for (const veil of this.wallVeils) veil.visible = false;
        }

        const speed = 0.05 * (1 + elapsed * 0.06);
        this.half = Math.max(CONTACT_HALF, this.half - speed * dt);
        this._placeWalls();

        const closeNow = 1 - clamp(
          (this.half - 0.36) / (3.0 - 0.36), 0, 1);
        this._updateCrushedProps(elapsed, closeNow);

        g.baseTension = clamp(1 - (this.half - 0.36) / 2.6, 0, 1) * 0.9;
        g.audio.setTension(g.baseTension);
        if (!this._grind || this.t > this._grind) {
          this._grind = this.t + 2.6;
          const wall = Math.floor(elapsed / 2.6) % this.panes.length;
          g.audio.stoneGrind({
            pos: this.panes[wall].mesh.position,
            gain: 0.3 + (1 - this.half / 3) * 0.4,
            rate: 0.5 + (1 - this.half / 3) * 0.3,
            verb: 0.72,
          });
          g.shake(0.05 + (1 - this.half / 3) * 0.1);
        }

        // Physical wall pressure constrains translation but never camera yaw.
        g.player.pos.x = clamp(
          g.player.pos.x, CX - this.half + 0.34, CX + this.half - 0.34);
        g.player.pos.z = clamp(
          g.player.pos.z, CZ - this.half + 0.34, CZ + this.half - 0.34);
        if (this.half <= CONTACT_HALF) this._beginContact();
        break;
      }
      case 'contact':
        this._updateCrushedProps(this.t - 7, 1);
        g.player.pos.x = clamp(
          g.player.pos.x, CX - this.half + 0.34, CX + this.half - 0.34);
        g.player.pos.z = clamp(
          g.player.pos.z, CZ - this.half + 0.34, CZ + this.half - 0.34);
        contactU = this._updateContact(dt);
        break;
      case 'black':
      case 'end':
        break;
    }

    const currentClose = 1 - clamp(
      (this.half - 0.36) / (3.0 - 0.36), 0, 1);
    this._updatePressure(dt, this.phase === 'closing' || this.phase === 'contact');
    this._updatePaneEffects(currentClose, contactU);
    // Wall pressure is resolved after Player.update. Keep the camera on the
    // resolved capsule for this same rendered frame instead of letting it lag
    // one wall-step outside the glass.
    if (this.phase === 'closing' || this.phase === 'contact') g.player._sync(0);
  }

  render(scene, camera) {
    if (!this.active || this.phase === 'black' || this.phase === 'end') return false;
    this.mirrors.update(scene, camera);
    return true;
  }
}

// enemies.js — walkers, the Resident, the horde. Announced by footsteps and the
// skull's chatter long before they're seen. Faster than you. Stun is quiet;
// popping is LOUD and the dark answers it.
import * as THREE from 'three';
import { clamp, lerp, damp, hash2, isPhysicalHouseInterior, smoothstep, TAU } from './util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KIND = {
  walker: {
    h: 2.05, r: 0.3, chase: 5.6, stalk: 1.1, hp: 1, stun: 2.8, scale: 1,
    windup: 1.1, strike: 0.66, strikeRadius: 0.96, recovery: 0.42, lunge: 0.72,
    hit: { y0: 0.22, y1: 1.58, r: 0.32, shoulderY: 1.48, shoulderR: 0.42, headY: 1.79, headR: 0.23 },
  },
  resident: {
    h: 2.5, r: 0.38, chase: 4.9, stalk: 0.9, hp: Infinity, stun: 1.6, scale: 1.22,
    windup: 0.8, strike: 0.74, strikeRadius: 1.05, recovery: 0.58, lunge: 0.92,
    hit: { y0: 0.24, y1: 2.02, r: 0.46, shoulderY: 1.72, shoulderR: 0.62, headY: 2.14, headR: 0.3 },
  },
  kneeler: {
    h: 4.4, r: 0.9, chase: 6.2, stalk: 0, hp: Infinity, stun: 0.4, scale: 2.4,
    windup: 2.2, strike: 1.02, strikeRadius: 1.48, recovery: 0.9, lunge: 1.16,
    hit: { y0: 0.22, y1: 3.58, r: 0.9, shoulderY: 3.12, shoulderR: 1.15, headY: 3.38, headR: 0.68 },
  },
};

// Post-waterfall law: this is not another body to hit. The skull is gone, so
// the cave threat has to be escaped, misdirected, or washed back by pressure.
// It follows the last sound it was given, commits attacks to a fixed point,
// and runs slower than a committed sprint. Those are its three fairness rails.
// Alex: "The enemy inside the waterfall should be more difficult and should
// spawn way in front of you."
//
// THE ONE NUMBER THAT MAY NOT MOVE IS heardSpeed. It sits under RUN (4.7), and
// that inequality is the entire escape: running away from this thing has to
// work, or the chapter stops being a chase and becomes a coin flip. Everything
// else got harder. The contract the walking bot proves every playthrough:
// WALK (2.7) x attackCommit (0.92) = 2.48 m of travel inside the commit window
// against a 1.30 m strike radius — a margin of 1.9x. A player who keeps walking
// still always escapes; a player who stops still dies. That is the design.
const DROWNED_CHOIR = Object.freeze({
  h: 2.75,
  r: 0.42,
  warning: 2.20,          // 2.65 — shorter fuse, only safe with the far spawn
  drySpeed: 2.60,         // 1.55 — unheard pursuit +45%, still under a walk
  heardSpeed: 4.35,       // UNTOUCHED. Under RUN. This is the escape rail.
  attackRange: 2.30,      // 1.85 — it commits from further out
  attackCommit: 0.92,     // 1.05 — and gets there sooner
  attackRadius: 1.30,     // 1.18
  recovery: 0.95,         // 1.25 — a miss costs it less
});

// HIS NOTE, ROUND SIX: "in the under waterfall cave area make that enemy
// teleport in front of you, a few times. but not so close that it instantly
// gets you."
//
// This is the SECOND asking. The comment at the top of this file already
// carries the first — "should spawn way in front of you" — and that was built
// as one far spawn at the start of the act. He is asking for it to happen
// again, during the run. It is placement, not lethality: not one number in
// DROWNED_CHOIR moves, and the fairness proof the walking bot re-runs every
// playthrough is untouched.
//
// The guards are what keep "in front of you" from becoming "on top of you":
// it only ever surfaces while it is genuinely BEHIND and you are walking away
// from it, never nearer than ten metres, never in a corridor narrow enough for
// its body to plug (running past it IS the escape), and never on the last
// stretch before the hatch, where a body across the way out is not a scare but
// a wall. It arrives in a fresh warning, so the 2.2 s fuse has to burn before it can
// move at all.
const CHOIR_SURFACE = Object.freeze({
  max: 3,             // "a few times"
  firstDelay: 12,     // the act opens with its own far spawn; let that land first
  cooldown: 25,
  ahead: [10.5, 11.5, 12.5, 13.5],   // metres further along the main route
  minStraight: 10.0,  // "not so close that it instantly gets you"
  // MEASURED, not guessed. The first build asked for twelve metres of gap
  // behind before it would surface, and probe-choir-surfacing walked the whole
  // 125 m route without one firing: this thing does not trail you by twelve
  // metres, it trails you by three to seven, all chapter. The number that
  // matters is only that a surfacing must never cancel a strike that was about
  // to land — so: outside attackRange (2.30) with margin, and 'stalk' only.
  minBehind: 4.5,
  minWidth: 1.05,     // half-width: body r is 0.42, so this always leaves a way past
  keepClear: 6.0,     // never surface inside this much of the hatch
  hush: 1.15,         // the loop goes out first. the SILENCE is the tell.
});

// Kneeler crosses the player in the forest's darkest value range. Its old
// near-black violet body merged with trunks even inside the skull's 11.5 m
// lantern, leaving only two eyes and a pale jaw. Lift the neutral surface just
// enough for the malformed silhouette and planted limbs to exist; eye motion
// and the long windup still carry state, so no meaning depends on this value.
const BASE_COLOR = { walker: 0x29262d, resident: 0x252127, kneeler: 0x2b2930 };
const STAIN_GEO = new THREE.CircleGeometry(0.55, 10);
const STAIN_MAT = new THREE.MeshBasicMaterial({ color: 0x0b0910, transparent: true, opacity: 0.85, depthWrite: false });
// More than the whole authored graveyard fight, with room for the house and
// forest to keep their marks too. Once full, the oldest mark is overwritten:
// the world remembers violence without adding one draw call forever per retry.
const STAIN_CAP = 48;
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

// A one-time shared warp pass keeps the low-poly bodies from resolving into
// clean capsules and spheres under the skull light. These buffers are built
// once, then reused by every Resident and Kneeler; no spawn-time geometry and
// no per-frame vertex work. The deformation is deliberately modest because
// silhouette and pose do the heavy lifting, while collision remains authored.
function malformShared(source, amount, seed) {
  const geometry = source.clone();
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ripple = Math.sin(x * 8.7 + seed * 1.3)
      * Math.cos(y * 6.1 - seed * 0.7)
      * Math.sin(z * 9.3 + seed * 2.1);
    const crooked = Math.sin(y * 4.9 + seed) * 0.55
      + Math.sin((x - z) * 7.4 + seed * 0.37) * 0.3;
    const radial = 1 + amount * (ripple + crooked);
    p.setXYZ(
      i,
      x * radial + Math.sin(y * 5.3 + seed) * amount * 0.035,
      y * (1 + ripple * amount * 0.22),
      z * (1 + amount * (ripple - crooked * 0.45)),
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

FIGURE_GEO.malformedCapsule = malformShared(FIGURE_GEO.capsule, 0.14, 3.1);
FIGURE_GEO.malformedLimb = malformShared(FIGURE_GEO.limb, 0.19, 7.7);
FIGURE_GEO.malformedSphere = malformShared(FIGURE_GEO.sphere, 0.17, 12.4);
FIGURE_GEO.malformedSlab = malformShared(FIGURE_GEO.slab, 0.12, 18.2);
{
  // One shared pall gives the walker a corpse under cloth, not a tombstone.
  // The shoulder line breaks twice, the waist caves inward, and the hem forks
  // into burial strips. All of that silhouette costs one draw call per body.
  const cloth = new THREE.Shape();
  cloth.moveTo(-0.08, 0.94);
  cloth.lineTo(-0.33, 0.86);
  cloth.lineTo(-0.59, 0.61);
  cloth.lineTo(-0.52, 0.31);
  cloth.lineTo(-0.39, 0.04);
  cloth.lineTo(-0.49, -0.3);
  cloth.lineTo(-0.39, -0.78);
  cloth.lineTo(-0.25, -0.96);
  cloth.lineTo(-0.12, -0.79);
  cloth.lineTo(-0.02, -1.04);
  cloth.lineTo(0.11, -0.86);
  cloth.lineTo(0.27, -0.98);
  cloth.lineTo(0.4, -0.74);
  cloth.lineTo(0.34, -0.24);
  cloth.lineTo(0.47, 0.05);
  cloth.lineTo(0.4, 0.34);
  cloth.lineTo(0.56, 0.58);
  cloth.lineTo(0.31, 0.79);
  cloth.lineTo(0.12, 0.87);
  cloth.closePath();
  FIGURE_GEO.walkerShroud = new THREE.ExtrudeGeometry(cloth, {
    depth: 0.13, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.02, bevelThickness: 0.02,
  });
  FIGURE_GEO.walkerShroud.center();

  // A second, darker winding-sheet fold breaks the broad front plane. Its
  // diagonal overlap implies ribs and a twisted pelvis under the pall without
  // turning the body into a stack of mannequin capsules.
  const fold = new THREE.Shape();
  fold.moveTo(-0.16, 0.76);
  fold.lineTo(-0.34, 0.5);
  fold.lineTo(-0.2, 0.16);
  fold.lineTo(-0.29, -0.3);
  fold.lineTo(-0.13, -0.82);
  fold.lineTo(0.015, -0.67);
  fold.lineTo(0.14, -0.94);
  fold.lineTo(0.25, -0.4);
  fold.lineTo(0.13, 0.02);
  fold.lineTo(0.29, 0.43);
  fold.lineTo(0.12, 0.7);
  fold.closePath();
  FIGURE_GEO.walkerPallFold = new THREE.ShapeGeometry(fold, 3);

  const hook = new THREE.Shape();
  hook.moveTo(-0.055, 0.17);
  hook.lineTo(0.04, 0.06);
  hook.lineTo(0.085, -0.11);
  hook.lineTo(0.045, -0.25);
  hook.lineTo(-0.045, -0.34);
  hook.lineTo(-0.1, -0.27);
  hook.lineTo(-0.055, -0.15);
  hook.lineTo(-0.09, -0.015);
  hook.closePath();
  FIGURE_GEO.walkerHook = new THREE.ShapeGeometry(hook, 2);

  // A dimensional funeral mask built from cheek, brow and nose planes. The
  // missing triangles are its two recessed sockets; a narrow split between
  // the crown halves runs into the left brow. This avoids both a white ring
  // and the paper-flat Halloween-mask read without adding another mesh.
  const P = {
    a: [-0.03, 0.48, 0], b: [0.025, 0.46, 0.025],
    lc: [-0.22, 0.42, -0.015], rc: [0.17, 0.43, 0.01],
    lt: [-0.34, 0.22, -0.035], rt: [0.3, 0.24, -0.02],
    lto: [-0.25, 0.2, 0.025], lti: [-0.07, 0.2, 0.115],
    lbo: [-0.24, 0.025, 0.02], lbi: [-0.075, 0.035, 0.105],
    rti: [0.07, 0.19, 0.115], rto: [0.235, 0.17, 0.02],
    rbi: [0.075, 0.03, 0.105], rbo: [0.22, 0.015, 0.02],
    nb: [0, 0.18, 0.16], nm: [0.005, 0.07, 0.195], nt: [0.015, -0.06, 0.205],
    lo: [-0.3, -0.06, -0.025], ro: [0.275, -0.04, -0.01],
    lci: [-0.115, -0.09, 0.12], rci: [0.125, -0.08, 0.115],
    ul: [-0.105, -0.16, 0.075], ur: [0.115, -0.16, 0.07],
    lju: [-0.13, -0.25, 0.04], rju: [0.13, -0.26, 0.035],
    lj: [-0.22, -0.32, -0.03], rj: [0.18, -0.35, -0.02],
    c: [-0.035, -0.48, 0],
  };
  const faces = [
    ['lc', 'a', 'lti'], ['lc', 'lti', 'lto'], ['lc', 'lto', 'lt'],
    ['b', 'rc', 'rti'], ['rc', 'rto', 'rti'], ['rc', 'rt', 'rto'],
    ['a', 'lti', 'nb'], ['b', 'nb', 'rti'],
    ['lt', 'lo', 'lbo'], ['lt', 'lbo', 'lto'],
    ['lo', 'lci', 'lbo'], ['lbo', 'lci', 'lbi'],
    ['lti', 'nb', 'lbi'], ['nb', 'nm', 'lbi'],
    ['rt', 'rto', 'rbo'], ['rt', 'rbo', 'ro'],
    ['rbo', 'rbi', 'rci'], ['rbo', 'rci', 'ro'],
    ['nb', 'rti', 'rbi'], ['nb', 'rbi', 'nm'],
    ['nm', 'nt', 'lbi'], ['nm', 'rbi', 'nt'],
    ['lbi', 'nt', 'lci'], ['rbi', 'rci', 'nt'],
    ['lci', 'nt', 'ul'], ['nt', 'ur', 'ul'], ['nt', 'rci', 'ur'],
    ['lo', 'lci', 'lju'], ['lci', 'ul', 'lju'],
    ['ro', 'rju', 'rci'], ['rci', 'rju', 'ur'],
    ['lo', 'lju', 'lj'], ['lj', 'lju', 'c'],
    ['lju', 'rju', 'c'], ['rj', 'c', 'rju'], ['ro', 'rj', 'rju'],
  ];
  const maskPositions = [];
  for (const face of faces) {
    for (const key of face) maskPositions.push(...P[key]);
  }
  FIGURE_GEO.walkerMask = new THREE.BufferGeometry();
  FIGURE_GEO.walkerMask.setAttribute('position', new THREE.Float32BufferAttribute(maskPositions, 3));
  FIGURE_GEO.walkerMask.computeVertexNormals();

  const mouth = new THREE.Shape();
  mouth.moveTo(-0.13, 0.035);
  mouth.lineTo(-0.025, 0.065);
  mouth.lineTo(0.075, 0.025);
  mouth.lineTo(0.14, -0.04);
  mouth.lineTo(0.07, -0.12);
  mouth.lineTo(-0.02, -0.07);
  mouth.lineTo(-0.085, -0.145);
  mouth.lineTo(-0.14, -0.055);
  mouth.closePath();
  FIGURE_GEO.walkerMouth = new THREE.ShapeGeometry(mouth, 2);

  const jaw = new THREE.Shape();
  jaw.moveTo(-0.045, 0.07);
  jaw.lineTo(0.105, 0.085);
  jaw.lineTo(0.16, 0.005);
  jaw.lineTo(0.105, -0.09);
  jaw.lineTo(0.005, -0.12);
  jaw.lineTo(-0.055, -0.035);
  jaw.closePath();
  FIGURE_GEO.walkerJaw = new THREE.ShapeGeometry(jaw, 2);

  // One shared, merged lower body per walker: two mismatched shins and feet
  // break the old floating-poncho silhouette without multiplying graveyard
  // draw calls or entering the gait/hit-volume contracts.
  const leftShin = new THREE.CylinderGeometry(0.075, 0.11, 0.72, 5);
  leftShin.rotateZ(-0.1);
  leftShin.translate(-0.17, 0.34, -0.015);
  const rightShin = new THREE.CylinderGeometry(0.09, 0.12, 0.62, 5);
  rightShin.rotateZ(0.16);
  rightShin.translate(0.16, 0.29, -0.035);
  const leftFoot = new THREE.BoxGeometry(0.19, 0.1, 0.34);
  leftFoot.rotateY(-0.14);
  leftFoot.translate(-0.2, 0.045, 0.1);
  const rightFoot = new THREE.BoxGeometry(0.22, 0.11, 0.29);
  rightFoot.rotateY(0.2);
  rightFoot.translate(0.19, 0.05, 0.075);
  FIGURE_GEO.walkerLegs = mergeGeometries([leftShin, rightShin, leftFoot, rightFoot]);
}
const GLINT_MAT = new THREE.MeshBasicMaterial({ color: 0xe8ecef });
const WALKER_BONE_MAT = new THREE.MeshStandardMaterial({
  color: 0x55554f, roughness: 0.96, metalness: 0, flatShading: true,
  side: THREE.DoubleSide,
});
const WALKER_WRAP_MAT = new THREE.MeshLambertMaterial({ color: 0x39343b });
const WALKER_FOLD_MAT = new THREE.MeshLambertMaterial({ color: 0x17151c, side: THREE.DoubleSide });
const WALKER_VOID_MAT = new THREE.MeshBasicMaterial({ color: 0x000000 });

// One corpse-mass, three drowned faces. All geometry is shared across the one
// live Choir instance and retries. Spray reveals planes already present in the
// body; it never recolors the threat or turns mouths into luminous UI rings.
const CHOIR_GEO = {
  headMass: new THREE.SphereGeometry(0.5, 9, 7),
  bodyMass: new THREE.SphereGeometry(0.5, 10, 8),
};
{
  // A single shoulder-to-hem outline. It has no legs: soaked cloth narrows,
  // tears, and hangs from the fused torsos like something dredged in a net.
  const veil = new THREE.Shape();
  veil.moveTo(-0.08, 1.13);
  veil.lineTo(-0.38, 1.02);
  veil.lineTo(-0.71, 0.79);
  veil.lineTo(-0.96, 0.38);
  veil.lineTo(-0.82, 0.08);
  veil.lineTo(-0.94, -0.27);
  veil.lineTo(-0.7, -0.55);
  veil.lineTo(-0.79, -0.92);
  veil.lineTo(-0.55, -1.11);
  veil.lineTo(-0.36, -1.36);
  veil.lineTo(-0.14, -1.2);
  veil.lineTo(0.025, -1.46);
  veil.lineTo(0.18, -1.21);
  veil.lineTo(0.42, -1.34);
  veil.lineTo(0.54, -1.03);
  veil.lineTo(0.77, -0.88);
  veil.lineTo(0.66, -0.56);
  veil.lineTo(0.91, -0.3);
  veil.lineTo(0.75, 0.02);
  veil.lineTo(0.95, 0.29);
  veil.lineTo(0.7, 0.57);
  veil.lineTo(0.58, 0.86);
  veil.lineTo(0.25, 1.04);
  veil.closePath();
  CHOIR_GEO.veil = new THREE.ShapeGeometry(veil, 5);

  // A diagonal inner fold keeps the body from reading as a flat geometric
  // plaque while remaining part of the same continuous burial silhouette.
  const fold = new THREE.Shape();
  fold.moveTo(-0.36, 0.82);
  fold.lineTo(-0.58, 0.49);
  fold.lineTo(-0.33, 0.12);
  fold.lineTo(-0.48, -0.34);
  fold.lineTo(-0.25, -0.92);
  fold.lineTo(-0.04, -0.72);
  fold.lineTo(0.14, -1.12);
  fold.lineTo(0.34, -0.55);
  fold.lineTo(0.2, -0.08);
  fold.lineTo(0.48, 0.4);
  fold.lineTo(0.21, 0.74);
  fold.closePath();
  CHOIR_GEO.veilFold = new THREE.ShapeGeometry(fold, 4);

  // Faceted drowned flesh: unequal sockets are absent triangles, the nose is
  // crushed left, one cheek collapses backward, and the chin hangs too low.
  // A dark head mass behind this one mesh supplies real recessed hollows.
  const F = {
    crown: [-0.02, 0.47, -0.025], ul: [-0.23, 0.4, -0.04], ur: [0.18, 0.38, -0.005],
    lt: [-0.33, 0.18, -0.085], rt: [0.29, 0.2, -0.055],
    lto: [-0.255, 0.185, 0.025], lti: [-0.07, 0.19, 0.115],
    lbo: [-0.235, 0.005, 0.005], lbi: [-0.06, 0.025, 0.1],
    rti: [0.06, 0.17, 0.095], rto: [0.235, 0.14, 0.005],
    rbi: [0.05, -0.015, 0.085], rbo: [0.22, -0.045, -0.025],
    nb: [-0.01, 0.16, 0.16], nm: [-0.055, 0.04, 0.2], nt: [-0.12, -0.09, 0.17],
    lo: [-0.3, -0.075, -0.045], ro: [0.28, -0.105, -0.07],
    lci: [-0.13, -0.12, 0.095], rci: [0.12, -0.135, 0.075],
    lipL: [-0.135, -0.19, 0.055], lipR: [0.095, -0.205, 0.035],
    lju: [-0.145, -0.29, 0.005], rju: [0.1, -0.31, -0.005],
    lj: [-0.23, -0.37, -0.065], rj: [0.15, -0.42, -0.075],
    chin: [-0.065, -0.55, -0.065],
  };
  const faceTriangles = [
    ['ul', 'crown', 'lti'], ['ul', 'lti', 'lto'], ['ul', 'lto', 'lt'],
    ['crown', 'ur', 'rti'], ['ur', 'rto', 'rti'], ['ur', 'rt', 'rto'],
    ['crown', 'lti', 'nb'], ['crown', 'nb', 'rti'],
    ['lt', 'lo', 'lbo'], ['lt', 'lbo', 'lto'], ['lo', 'lci', 'lbo'],
    ['lbo', 'lci', 'lbi'], ['lti', 'nb', 'lbi'], ['nb', 'nm', 'lbi'],
    ['rt', 'rto', 'rbo'], ['rt', 'rbo', 'ro'], ['rbo', 'rbi', 'rci'],
    ['rbo', 'rci', 'ro'], ['nb', 'rti', 'rbi'], ['nb', 'rbi', 'nm'],
    ['nm', 'nt', 'lbi'], ['nm', 'rbi', 'nt'],
    ['lbi', 'nt', 'lci'], ['rbi', 'rci', 'nt'],
    ['lci', 'nt', 'lipL'], ['nt', 'lipR', 'lipL'], ['nt', 'rci', 'lipR'],
    ['lo', 'lci', 'lju'], ['lci', 'lipL', 'lju'],
    ['ro', 'rju', 'rci'], ['rci', 'rju', 'lipR'],
    ['lo', 'lju', 'lj'], ['lj', 'lju', 'chin'],
    ['lju', 'rju', 'chin'], ['rj', 'chin', 'rju'], ['ro', 'rj', 'rju'],
  ];
  const faceKeys = Object.keys(F);
  const faceIndex = new Map(faceKeys.map((key, index) => [key, index]));
  const facePositions = faceKeys.flatMap((key) => F[key]);
  const faceIndices = faceTriangles.flatMap((triangle) => triangle.map((key) => faceIndex.get(key)));
  CHOIR_GEO.drownedFace = new THREE.BufferGeometry();
  CHOIR_GEO.drownedFace.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
  CHOIR_GEO.drownedFace.setIndex(faceIndices);
  CHOIR_GEO.drownedFace.computeVertexNormals();

  const mouth = new THREE.Shape();
  mouth.moveTo(-0.13, 0.035);
  mouth.lineTo(-0.035, 0.075);
  mouth.lineTo(0.08, 0.025);
  mouth.lineTo(0.14, -0.055);
  mouth.lineTo(0.055, -0.16);
  mouth.lineTo(-0.035, -0.095);
  mouth.lineTo(-0.105, -0.19);
  mouth.lineTo(-0.15, -0.06);
  mouth.closePath();
  CHOIR_GEO.mouthVoid = new THREE.ShapeGeometry(mouth, 3);

  const jaw = new THREE.Shape();
  jaw.moveTo(-0.08, 0.075);
  jaw.lineTo(0.105, 0.09);
  jaw.lineTo(0.16, 0.005);
  jaw.lineTo(0.09, -0.12);
  jaw.lineTo(-0.025, -0.16);
  jaw.lineTo(-0.095, -0.04);
  jaw.closePath();
  CHOIR_GEO.jawFragment = new THREE.ShapeGeometry(jaw, 2);

  // Five broken ribs and a snapped sternum share one geometry/draw call. They
  // are deliberately incomplete and off-balance, never a glowing ladder.
  const ribPositions = [];
  const ribbon = (x0, y0, x1, y1, w = 0.025) => {
    const dx = x1 - x0, dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const px = -dy / d * w, py = dx / d * w;
    ribPositions.push(
      x0 + px, y0 + py, 0, x1 + px, y1 + py, 0, x1 - px, y1 - py, 0,
      x0 + px, y0 + py, 0, x1 - px, y1 - py, 0, x0 - px, y0 - py, 0,
    );
  };
  ribbon(-0.03, 0.28, -0.53, 0.17, 0.024);
  ribbon(0.02, 0.22, 0.43, 0.11, 0.022);
  ribbon(-0.025, 0.04, -0.46, -0.08, 0.023);
  ribbon(0.015, -0.04, 0.34, -0.15, 0.021);
  ribbon(-0.01, -0.18, -0.31, -0.31, 0.02);
  ribbon(-0.015, 0.35, 0.005, -0.35, 0.018);
  CHOIR_GEO.ribCage = new THREE.BufferGeometry();
  CHOIR_GEO.ribCage.setAttribute('position', new THREE.Float32BufferAttribute(ribPositions, 3));
  CHOIR_GEO.ribCage.computeVertexNormals();
}
{
  const drops = [];
  for (let i = 0; i < 54; i++) {
    const a = i * 2.3999632297;
    const ring = 0.34 + (i % 7) * 0.065;
    drops.push(
      Math.cos(a) * ring,
      0.18 + ((i * 17) % 53) / 53 * 2.55,
      Math.sin(a) * ring * 0.58,
    );
  }
  CHOIR_GEO.drops = new THREE.BufferGeometry();
  CHOIR_GEO.drops.setAttribute('position', new THREE.Float32BufferAttribute(drops, 3));
}

function addPart(parent, geometry, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

function addEyes(head, spread, y, z, sx = 0.025, sy = 0.018) {
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(addPart(head, FIGURE_GEO.smallSphere, GLINT_MAT, s * spread, y, z, sx, sy, 0.012));
  }
  return eyes;
}

// Deterministic held noise: a secondary bone snaps to a slightly wrong pose,
// holds it, then snaps again. Root movement and attack clocks never see this.
export function steppedJerk(time, serial, rate, channel = 0) {
  const step = Math.floor(time * rate + serial * 0.731 + channel * 3.17);
  const n = Math.sin(step * 12.9898 + serial * 78.233 + channel * 37.719) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
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
  // Exhumed pallbearer/corpse effigy: the pall is one broken outline, but an
  // offset ribcage, hunch, and two separately sloped shoulders make a body push
  // against it. Forearms live outside that outline even before the lunge.
  const shroud = addPart(g, FIGURE_GEO.walkerShroud, mat,
    0, 0.91, -0.17, 1.06, 1.05, 2.25, -0.13, 0, -0.035);
  addPart(g, FIGURE_GEO.walkerLegs, WALKER_WRAP_MAT,
    0, 0, -0.055, 1, 1, 1, 0, 0, -0.035);
  addPart(g, FIGURE_GEO.walkerPallFold, WALKER_FOLD_MAT,
    -0.035, 0.91, -0.073, 1.06, 1.02, 1, -0.03, 0, -0.07);
  addPart(g, FIGURE_GEO.sphere, mat,
    -0.075, 1.36, -0.2, 0.4, 0.29, 0.27, -0.14, 0, -0.12);
  const shoulders = [
    addPart(g, FIGURE_GEO.sphere, mat,
      -0.35, 1.43, -0.2, 0.36, 0.22, 0.28, -0.12, 0, 0.11),
    addPart(g, FIGURE_GEO.sphere, mat,
      0.315, 1.37, -0.18, 0.31, 0.2, 0.26, -0.04, 0, -0.08),
  ];

  const head = new THREE.Group();
  head.position.set(0.045, 1.75, 0.16);
  head.rotation.set(-0.14, 0, 0.19);
  addPart(head, FIGURE_GEO.walkerMask, WALKER_BONE_MAT,
    0, 0, 0, 0.78, 0.8, 1.04, 0, 0.03, -0.025);
  const mouth = addPart(head, FIGURE_GEO.walkerMouth, WALKER_VOID_MAT,
    0.005, -0.145, 0.045, 0.64, 0.48, 1, 0, 0, -0.08);
  const jaw = addPart(head, FIGURE_GEO.walkerJaw, WALKER_BONE_MAT,
    0.035, -0.235, 0.052, 0.67, 0.72, 1, 0, 0, 0.18);
  const eyes = [
    addPart(head, FIGURE_GEO.smallSphere, GLINT_MAT,
      -0.115, 0.082, 0.055, 0.011, 0.008, 0.007),
    addPart(head, FIGURE_GEO.smallSphere, GLINT_MAT,
      0.108, 0.07, 0.055, 0.009, 0.007, 0.006),
  ];
  g.add(head);

  for (const s of [-1, 1]) {
    const armP = new THREE.Group();
    armP.position.set(s * (s < 0 ? 0.48 : 0.46), s < 0 ? 1.42 : 1.39, 0.19);
    armP.rotation.z = s < 0 ? 0.15 : -0.075;
    addPart(armP, FIGURE_GEO.limb, WALKER_WRAP_MAT,
      0, s < 0 ? -0.53 : -0.59, 0.09,
      0.102, s < 0 ? 0.58 : 0.64, 0.09, s * 0.035);
    addPart(armP, FIGURE_GEO.walkerHook, WALKER_BONE_MAT,
      s * 0.018, s < 0 ? -1.08 : -1.2, 0.145,
      s * (s < 0 ? 0.78 : 0.9), s < 0 ? 0.72 : 0.82, 1,
      0, 0, s < 0 ? -0.08 : 0.12);
    limbs.arms.push(armP);
    g.add(armP);

    // The pall supplies the visible lower-body silhouette. Empty pivots retain
    // the shared gait contract without spending meshes on hidden mannequin legs.
    const legP = new THREE.Group();
    legP.position.set(s * 0.105, 0.72, -0.045);
    limbs.legs.push(legP);
    g.add(legP);
  }
  mouth.userData.baseScale = mouth.scale.clone();
  jaw.userData.basePosition = jaw.position.clone();
  jaw.userData.baseRotation = jaw.rotation.clone();
  for (const eye of eyes) eye.userData.baseScale = eye.scale.clone();
  for (const shoulder of shoulders) {
    shoulder.userData.baseScale = shoulder.scale.clone();
    shoulder.userData.baseRotation = shoulder.rotation.clone();
  }
  head.userData.walker = {
    head, shroud, shoulders, mouth, jaw, eyes,
    headBase: head.position.clone(),
    headRot: head.rotation.clone(),
  };
  return head;
}

function buildResident(g, mat, limbs) {
  // The house's owner is built like a doorway that learned to walk: an uneven
  // lintel of shoulders, one wall-reaching arm, one shortened arm, and a face
  // wedged under the high side rather than centred on a mannequin torso.
  addPart(g, FIGURE_GEO.coat, mat, 0, 0.78, -0.02, 0.74, 1.4, 0.57, 0, 0, -0.035);
  addPart(g, FIGURE_GEO.malformedCapsule, mat,
    -0.04, 1.3, -0.12, 0.5, 0.54, 0.35, -0.2, 0, 0.055);
  const yoke = addPart(g, FIGURE_GEO.malformedCapsule, mat,
    -0.035, 1.54, -0.055, 0.27, 0.62, 0.31, 0, 0, Math.PI / 2 + 0.11);
  const hump = addPart(g, FIGURE_GEO.malformedSphere, mat,
    -0.18, 1.59, -0.24, 0.7, 0.43, 0.35, -0.12, 0.04, 0.11);

  // At range this is only a coat seam. The skull light finds that the seam has
  // depth and a crooked hard latch inside it; attack posture parts it slightly.
  // Two shared meshes buy the close-range horror without adding glow or a cue.
  const seam = addPart(g, FIGURE_GEO.slab, WALKER_VOID_MAT,
    0.055, 1.03, 0.36, 0.09, 0.48, 0.018, 0, 0, -0.075);
  const latch = addPart(g, FIGURE_GEO.malformedLimb, WALKER_BONE_MAT,
    0.075, 1.04, 0.382, 0.042, 0.14, 0.035, 0, 0, Math.PI / 2 - 0.19);

  const head = new THREE.Group();
  head.position.set(0.09, 1.75, 0.1);
  head.rotation.set(-0.18, 0.06, -0.2);
  addPart(head, FIGURE_GEO.malformedSphere, mat, 0, 0, 0, 0.23, 0.28, 0.2, 0.02);
  addPart(head, FIGURE_GEO.malformedSlab, mat, 0.015, -0.2, 0.045, 0.2, 0.13, 0.15, -0.04, 0, 0.08);
  // The old two dots on a black pebble were unreadable at the distance this
  // first appears. A crooked funerary face is now physically wedged under the
  // lintel: the same shared dimensional mask as the walkers, smaller, split by
  // a real void and lit only by the player's existing skull lamp.
  addPart(head, FIGURE_GEO.walkerMask, WALKER_BONE_MAT,
    0.01, -0.02, 0.17, 0.51, 0.57, 0.74, 0.01, 0.05, -0.1);
  addPart(head, FIGURE_GEO.walkerMouth, WALKER_VOID_MAT,
    0.015, -0.12, 0.305, 0.41, 0.3, 0.7, 0, 0.02, -0.12);
  addEyes(head, 0.064, 0.025, 0.31, 0.011, 0.008);
  g.add(head);

  for (const s of [-1, 1]) {
    const armP = new THREE.Group();
    const longSide = s < 0;
    armP.position.set(s * (longSide ? 0.45 : 0.4), longSide ? 1.53 : 1.45, 0.09);
    armP.rotation.z = longSide ? 0.2 : -0.34;
    addPart(armP, FIGURE_GEO.malformedLimb, mat,
      0, longSide ? -0.61 : -0.49, 0.065,
      longSide ? 0.12 : 0.15, longSide ? 0.66 : 0.53, longSide ? 0.1 : 0.13,
      s * 0.04);
    const handY = longSide ? -1.2 : -0.98;
    addPart(armP, FIGURE_GEO.malformedSphere, mat,
      0, handY, 0.11, longSide ? 0.18 : 0.22, longSide ? 0.22 : 0.19, 0.11);
    for (let i = -1; i <= 1; i++) {
      addPart(armP, FIGURE_GEO.spike, WALKER_BONE_MAT,
        i * (longSide ? 0.075 : 0.09), handY - (longSide ? 0.24 : 0.22), 0.145,
        0.038, (longSide ? 0.29 : 0.25) + (i === 0 ? 0.055 : 0), 0.038,
        0, 0, Math.PI + i * 0.08);
    }
    limbs.arms.push(armP);
    g.add(armP);

    const legP = new THREE.Group();
    legP.position.set(s * 0.2, 0.58, -0.05);
    addPart(legP, FIGURE_GEO.malformedLimb, mat,
      0, -0.32, 0, s < 0 ? 0.14 : 0.18, 0.36, s < 0 ? 0.16 : 0.13, s * 0.055);
    addPart(legP, FIGURE_GEO.malformedSlab, mat,
      s * 0.025, -0.68, 0.13, s < 0 ? 0.19 : 0.24, 0.1, s < 0 ? 0.37 : 0.31,
      -0.08, s * 0.05, s * -0.04);
    limbs.legs.push(legP);
    g.add(legP);
  }

  for (const shoulder of [yoke, hump]) {
    shoulder.userData.baseScale = shoulder.scale.clone();
    shoulder.userData.baseRotation = shoulder.rotation.clone();
  }
  seam.userData.baseScale = seam.scale.clone();
  latch.userData.baseRotation = latch.rotation.clone();
  latch.userData.basePosition = latch.position.clone();
  head.userData.anatomy = {
    kind: 'resident', head, yoke, hump, seam, latch,
    headBase: head.position.clone(), headRot: head.rotation.clone(),
  };
  return head;
}

function buildKneeler(g, mat, limbs) {
  // A load-bearing animal silhouette rather than a scaled walker. Its weight
  // has collapsed to one side, the shoulder yoke is broader than its pelvis,
  // and two crooked forelimb joints plant ahead of a face hung underneath it.
  addPart(g, FIGURE_GEO.malformedCapsule, mat,
    -0.04, 1.07, -0.12, 0.48, 0.54, 0.42, -0.34, 0, -0.05);
  const hump = addPart(g, FIGURE_GEO.malformedSphere, mat,
    -0.09, 1.48, -0.25, 0.66, 0.52, 0.46, -0.08, 0.03, 0.1);
  const yoke = addPart(g, FIGURE_GEO.malformedCapsule, mat,
    0.035, 1.39, -0.035, 0.3, 0.82, 0.32, 0.02, 0.04, Math.PI / 2 - 0.08);
  const spineDefs = [
    [-0.29, 1.72, 0.1, 0.36, -0.48],
    [0.015, 1.87, 0.115, 0.5, -0.29],
    [0.31, 1.69, 0.09, 0.32, -0.12],
  ];
  for (const [x, y, width, height, lean] of spineDefs) {
    addPart(g, FIGURE_GEO.spike, WALKER_BONE_MAT,
      x, y, -0.3, width, height, width, lean, 0, x * -0.24);
  }

  const head = new THREE.Group();
  head.position.set(0.1, 1.32, 0.38);
  head.rotation.set(-0.28, 0.07, 0.24);
  addPart(head, FIGURE_GEO.malformedSphere, mat, 0, 0, 0, 0.31, 0.25, 0.32, 0.03);
  addPart(head, FIGURE_GEO.malformedSlab, mat,
    0.015, -0.15, 0.17, 0.27, 0.13, 0.32, -0.2, 0, 0.08);
  const mouth = addPart(head, FIGURE_GEO.slab, WALKER_VOID_MAT,
    0.015, -0.18, 0.345, 0.18, 0.055, 0.016, -0.08, 0, 0.06);
  const jaw = addPart(head, FIGURE_GEO.malformedSlab, WALKER_BONE_MAT,
    0.045, -0.255, 0.32, 0.25, 0.08, 0.13, -0.13, 0.04, 0.14);
  addPart(head, FIGURE_GEO.spike, WALKER_BONE_MAT,
    -0.07, -0.19, 0.375, 0.024, 0.105, 0.024, 0, 0, Math.PI + 0.12);
  addEyes(head, 0.095, 0.025, 0.29, 0.035, 0.015);
  g.add(head);

  const forearms = [];
  for (const s of [-1, 1]) {
    const armP = new THREE.Group();
    armP.position.set(s * (s < 0 ? 0.43 : 0.37), s < 0 ? 1.35 : 1.29, 0.045);
    armP.rotation.z = s < 0 ? 0.13 : -0.25;
    addPart(armP, FIGURE_GEO.malformedLimb, mat,
      0, -0.32, 0.1, s < 0 ? 0.17 : 0.2, 0.37, 0.16, -0.28, 0, s * 0.05);
    const elbow = new THREE.Group();
    elbow.position.set(s * 0.035, -0.62, 0.2);
    elbow.rotation.set(-0.46, s * 0.08, s * 0.22);
    armP.add(elbow);
    addPart(elbow, FIGURE_GEO.malformedLimb, mat,
      0, -0.27, 0.11, 0.15, 0.34, 0.14, -0.22, 0, s * -0.09);
    addPart(elbow, FIGURE_GEO.malformedSphere, mat,
      s * 0.025, -0.56, 0.25, s < 0 ? 0.27 : 0.31, 0.16, s < 0 ? 0.35 : 0.31,
      0, s * 0.06, s * 0.08);
    elbow.userData.baseRotation = elbow.rotation.clone();
    forearms.push(elbow);
    limbs.arms.push(armP);
    g.add(armP);

    const legP = new THREE.Group();
    legP.position.set(s * 0.25, 0.72, -0.28);
    legP.rotation.z = s * 0.2;
    addPart(legP, FIGURE_GEO.malformedLimb, mat,
      0, -0.3, -0.08, s < 0 ? 0.22 : 0.18, 0.34, s < 0 ? 0.17 : 0.21,
      0.42, s * 0.06);
    addPart(legP, FIGURE_GEO.malformedSlab, mat,
      s * 0.035, -0.62, 0.18, s < 0 ? 0.31 : 0.26, 0.11, s < 0 ? 0.39 : 0.45,
      -0.08, s * 0.05, s * -0.06);
    limbs.legs.push(legP);
    g.add(legP);
  }

  for (const shoulder of [yoke, hump]) {
    shoulder.userData.baseScale = shoulder.scale.clone();
    shoulder.userData.baseRotation = shoulder.rotation.clone();
  }
  mouth.userData.baseScale = mouth.scale.clone();
  jaw.userData.basePosition = jaw.position.clone();
  jaw.userData.baseRotation = jaw.rotation.clone();
  head.userData.anatomy = {
    kind: 'kneeler', head, yoke, hump, mouth, jaw, forearms,
    headBase: head.position.clone(), headRot: head.rotation.clone(),
  };
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
  g.userData = { mat, head, limbs, walker: head.userData.walker || null };
  return g;
}

function makeDrownedChoir(world) {
  const g = new THREE.Group();
  const voidMat = new THREE.MeshLambertMaterial({
    color: 0x010305, transparent: true, opacity: 0.015, depthWrite: false,
    side: THREE.DoubleSide,
  });
  const skinMat = new THREE.MeshLambertMaterial({
    color: 0x465255, transparent: true, opacity: 0.001,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const wetMat = new THREE.MeshLambertMaterial({
    color: 0x69777a, transparent: true, opacity: 0.001,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const rimMat = new THREE.MeshLambertMaterial({
    color: 0x172124, transparent: true, opacity: 0.001,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const mouthVoidMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.001,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const dropMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0.001 },
      uSize: { value: 0.035 },
    },
    vertexShader: `
      uniform float uSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, uSize * 120.0 / max(1.0, -mv.z));
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float edge = 1.0 - smoothstep(0.24, 0.5, d);
        gl_FragColor = vec4(0.92, 0.975, 1.0, edge * uOpacity);
      }
    `,
  });

  // Three overlapping cloth layers preserve the established test/debug
  // contract while reading as one corpse veil: rear silhouette, outer pall,
  // and a diagonal front fold. None is a separate segmented body anymore.
  const curtains = [];
  const veilSpecs = [
    { geometry: CHOIR_GEO.veil, pos: [0, 1.29, -0.2], scale: [1.02, 0.96], rot: -0.035 },
    { geometry: CHOIR_GEO.veil, pos: [0.018, 1.27, -0.075], scale: [0.91, 0.92], rot: 0.025 },
    { geometry: CHOIR_GEO.veilFold, pos: [-0.04, 1.22, 0.015], scale: [0.94, 0.9], rot: -0.08 },
  ];
  for (const spec of veilSpecs) {
    const curtain = new THREE.Mesh(spec.geometry, voidMat);
    curtain.position.set(...spec.pos);
    curtain.scale.set(spec.scale[0], spec.scale[1], 1);
    curtain.rotation.z = spec.rot;
    curtain.userData.basePos = curtain.position.clone();
    curtain.userData.baseScale = curtain.scale.clone();
    curtain.userData.baseRot = curtain.rotation.z;
    g.add(curtain);
    curtains.push(curtain);
  }

  const outline = new THREE.Mesh(CHOIR_GEO.veil, rimMat);
  outline.position.set(-0.01, 1.29, -0.225);
  outline.scale.set(1.065, 0.98, 1);
  outline.rotation.z = -0.045;
  outline.userData.basePos = outline.position.clone();
  outline.userData.baseScale = outline.scale.clone();
  outline.userData.baseRot = outline.rotation.z;
  g.add(outline);
  const outlines = [outline];

  const mass = new THREE.Mesh(CHOIR_GEO.bodyMass, voidMat);
  mass.position.set(-0.025, 1.22, -0.13);
  mass.scale.set(0.83, 1.24, 0.46);
  mass.userData.basePos = mass.position.clone();
  mass.userData.baseScale = mass.scale.clone();
  g.add(mass);

  const mouths = [];
  const jaws = [];
  const faceSpecs = [
    {
      pos: [-0.39, 1.72, 0.13], scale: [0.63, 0.67], rot: [-0.08, 0.3, -0.29],
      thrust: [-0.1, -0.04, 0.12], recoil: [-0.04, -0.1, -0.05], phase: 0.7,
    },
    {
      pos: [0.035, 1.9, 0.205], scale: [0.76, 0.78], rot: [-0.04, -0.08, 0.055],
      thrust: [0.015, 0.11, 0.24], recoil: [0.015, -0.14, -0.08], phase: 2.2,
    },
    {
      pos: [0.35, 1.5, 0.075], scale: [0.58, 0.62], rot: [0.06, -0.34, 0.25],
      thrust: [0.12, -0.015, 0.14], recoil: [0.05, -0.12, -0.06], phase: 4.5,
    },
  ];

  for (let i = 0; i < faceSpecs.length; i++) {
    const spec = faceSpecs[i];
    const face = new THREE.Group();
    face.position.set(...spec.pos);
    face.scale.set(spec.scale[0], spec.scale[1], 1);
    face.rotation.set(...spec.rot);
    face.userData.base = face.position.clone();
    face.userData.baseScale = face.scale.clone();
    face.userData.baseRotation = face.rotation.clone();
    face.userData.motion = spec;

    const headMass = new THREE.Mesh(CHOIR_GEO.headMass, voidMat);
    headMass.position.set(0, -0.025, -0.075);
    headMass.scale.set(0.56, 0.79, 0.33);
    const drownedFace = new THREE.Mesh(CHOIR_GEO.drownedFace, skinMat);
    const hole = new THREE.Mesh(CHOIR_GEO.mouthVoid, mouthVoidMat);
    hole.position.set(-0.015, -0.225, 0.045);
    hole.scale.set(0.72, 0.62, 1);
    const jaw = new THREE.Mesh(CHOIR_GEO.jawFragment, skinMat);
    jaw.position.set(0.025, -0.36, 0.055);
    jaw.scale.set(0.8, 0.76, 1);
    jaw.rotation.z = [0.16, -0.11, 0.24][i];
    hole.userData.baseScale = hole.scale.clone();
    jaw.userData.basePos = jaw.position.clone();
    jaw.userData.baseRot = jaw.rotation.z;
    headMass.userData.baseScale = headMass.scale.clone();
    face.add(headMass, drownedFace, hole, jaw);
    g.add(face);
    mouths.push(face);
    jaws.push({ jaw, hole, headMass, drownedFace });
  }

  const ribCage = new THREE.Mesh(CHOIR_GEO.ribCage, wetMat);
  ribCage.position.set(-0.015, 1.12, 0.09);
  ribCage.scale.set(0.94, 0.88, 1);
  ribCage.rotation.z = -0.09;
  ribCage.userData.baseScale = ribCage.scale.clone();
  ribCage.userData.baseRot = ribCage.rotation.z;
  g.add(ribCage);
  const ribs = [ribCage];

  const droplets = new THREE.Points(CHOIR_GEO.drops, dropMat);
  droplets.frustumCulled = false;
  g.add(droplets);
  // Borrowed, never built. A lamp that arrives with the creature and leaves
  // with it moves the shader light census twice, and every move recompiles
  // every lit material in the game — a multi-second freeze landing exactly on
  // the reveal this creature exists to deliver. world.loanLight() reparents a
  // light that has been in the scene since boot, which the census cannot see.
  // If the reserve is somehow empty the Choir simply has no lamp; it must not
  // fall back to constructing one.
  const light = world?.loanLight?.(g, { colour: 0xddecef, distance: 6, decay: 1.8 }) || null;
  if (light) light.position.set(0, 1.45, 0.2);
  g.userData = {
    drownedChoir: true,
    voidMat, skinMat, wetMat, rimMat, mouthVoidMat, dropMat,
    curtains, outlines, mass, mouths, jaws, ribs, ribCage, droplets, light,
    ownedMaterials: [voidMat, skinMat, wetMat, rimMat, mouthVoidMat, dropMat],
  };
  return g;
}

export class Enemies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this._spawnSerial = 0;
    this._graveClaimRecovery = 0;

    // One dynamic instance pool owns every pop stain for this game lifecycle.
    // It deliberately survives ordinary death/respawn so the graveyard keeps
    // the player's history; resetStains() is the explicit full-reset boundary.
    this.stainPool = new THREE.InstancedMesh(STAIN_GEO, STAIN_MAT, STAIN_CAP);
    this.stainPool.name = 'bounded enemy pop stains';
    this.stainPool.userData.fetchEnemyStainPool = true;
    this.stainPool.count = 0;
    this.stainPool.frustumCulled = false;
    this.stainPool.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    game.scene.add(this.stainPool);
    this._stainCursor = 0;
    this._stainVisible = 0;
    this._stainTotal = 0;
    this._stainMatrix = new THREE.Matrix4();
    this._stainPosition = new THREE.Vector3();
    this._stainQuaternion = new THREE.Quaternion();
    this._stainScale = new THREE.Vector3();
    this._stainEuler = new THREE.Euler();
  }

  stainState() {
    return {
      capacity: STAIN_CAP,
      visible: this._stainVisible,
      totalPlaced: this._stainTotal,
      nextSlot: this._stainCursor,
    };
  }

  resetStains() {
    this._stainCursor = 0;
    this._stainVisible = 0;
    this._stainTotal = 0;
    this.stainPool.count = 0;
    this.stainPool.instanceMatrix.needsUpdate = true;
    return this.stainState();
  }

  _placeStain(pos) {
    const ground = this.game.world.groundHeightAt(pos.x, pos.z, pos.y + 1);
    const y = Number.isFinite(ground) ? ground + 0.015 : pos.y + 0.015;
    this._stainQuaternion.setFromEuler(
      this._stainEuler.set(-Math.PI / 2, 0, Math.random() * Math.PI),
    );
    this._stainMatrix.compose(
      this._stainPosition.set(pos.x, y, pos.z),
      this._stainQuaternion,
      this._stainScale.set(0.8 + Math.random() * 0.5, 1 + Math.random() * 0.6, 1),
    );
    this.stainPool.setMatrixAt(this._stainCursor, this._stainMatrix);
    this._stainCursor = (this._stainCursor + 1) % STAIN_CAP;
    this._stainVisible = Math.min(STAIN_CAP, this._stainVisible + 1);
    this._stainTotal++;
    this.stainPool.count = this._stainVisible;
    this.stainPool.instanceMatrix.needsUpdate = true;
  }

  spawn(kind, x, z, state = 'stalk', yHint = 3) {
    // yHint picks the STOREY: groundHeightAt resolves the highest floor at or
    // below it (a basement spawn with the default hint lands on the stairs above)
    const spec = KIND[kind];
    const mesh = makeFigure(kind);
    const serial = this._spawnSerial++;
    const e = {
      kind, spec, mesh, state,
      pos: new THREE.Vector3(x, this.game.world.groundHeightAt(x, z, yHint), z),
      phase: Math.random() * TAU,
      stunT: 0, windT: 0, stepT: 0,
      strikeT: 0, recoverT: 0, strikePos: new THREE.Vector3(),
      loop: this.game.audio.ready ? this.game.audio.enemyLoop(kind) : null,
      hits: 0,
      serial,
      // WHERE IT STANDS, NOT WHEN IT WAS MADE.
      //
      // These two decide how a figure circles you — the angle it holds and the
      // direction it walks the ring — and they used to be `serial * 2.399963`
      // and `serial % 2`, off a counter that EVERY spawn in the game shares.
      // The graveyard's eight sites and their jitter are fully authored (no
      // Math.random anywhere in the wave spawner), so that counter was the only
      // variation the fight had: one extra spawn anywhere earlier in the run —
      // a basement walker, a house resident — shifted every serial by one,
      // flipped every orbitSign, and re-rolled the entire horde.
      //
      // Proved by changing `this._spawnSerial = 0` to `= 1` and nothing else:
      // all six seeded fights changed outcome (guards 86/84/74/38/72/66 ->
      // 75/89/63/60/101/90), and the seed that had started losing at wave two
      // survived all three waves again. Round nine read that as a basement
      // enemy eating the arena's attack tokens; it was this.
      //
      // A hash of the spawn point is the fight's OWN dice: authored, distinct
      // per site, and untouchable by anything that spawns elsewhere.
      orbitAngle: (hash2(Math.round(x * 64), Math.round(z * 64)) / 4294967296) * TAU,
      orbitSign: hash2(Math.round(z * 64), Math.round(x * 64)) & 1 ? 1 : -1,
    };
    mesh.position.copy(e.pos);
    this.game.scene.add(mesh);
    this.list.push(e);
    (this.game.spawnLog ||= []).push([kind, state, Math.round(x), Math.round(z), +this.game.time.toFixed(1)]);
    // EVERY active body arrives by dragging itself out of the ground. Alex's
    // two favourite enemy moments are both partial bodies — hands through a
    // wall, "slowly coming up from the floor... that was cool" — and his
    // verdict on the fully-revealed shape is that it isn't scary. So the
    // reveal is now the default entrance, not a graveyard special case:
    // popped into existence at full height is the one thing a body never
    // does. Dormant spawns skip it (they are furniture until noticed), and
    // callers that stage their own arrival (the arena's waves, the nursery's
    // slow rise) override the fields after spawn returns.
    if (state !== 'dormant' && state !== 'standing') {
      e.graveRiseDur = 1.15;
      e.graveRiseT = e.graveRiseDur;
      if (this.game.act !== 'graveyard' && this.game.audio.ready) {
        this.game.audio.walkerRise({ pos: e.pos, gain: 0.3, rate: 0.86, verb: 0.5 });
      }
    }
    return e;
  }

  // Public contract for the cave/director and future authored spray volumes.
  // `pos` is where the sound begins; `heardPos` is the last place the player
  // made a noise. Keeping those separate lets the thing be audible before it
  // is visible and prevents it from reading the player's live coordinates.
  beginDrownedChoir({ pos = null, heardPos = null } = {}) {
    this.endDrownedChoir('replace');
    const game = this.game;
    const source = pos || game.player.pos;
    const y = source.y != null
      ? source.y
      : game.world.groundHeightAt(source.x, source.z, game.player.pos.y + 2);
    const mesh = makeDrownedChoir(game.world);
    const e = {
      kind: 'choir',
      spec: DROWNED_CHOIR,
      mesh,
      state: 'warning',
      pos: new THREE.Vector3(source.x, y, source.z),
      phase: 0,
      age: 0,
      stateT: 0,
      revealT: 0,
      wetT: 0,
      memoryT: 3.5,
      heardStrength: 0.35,
      heardPos: new THREE.Vector3(
        heardPos?.x ?? game.player.pos.x,
        heardPos?.y ?? game.player.pos.y,
        heardPos?.z ?? game.player.pos.z,
      ),
      strikePos: new THREE.Vector3(),
      washV: new THREE.Vector3(),
      warned: false,
      loop: null,
      nav: null,
      surfacings: 0,
      surfaceCd: CHOIR_SURFACE.firstDelay,
      hushT: 0,
    };
    const underfalls = game.underfalls;
    if (underfalls) {
      underfalls.clamp?.(e.pos, 0);
      e.pos.y = underfalls.groundAt(e.pos.x, e.pos.z);
      underfalls.clamp?.(e.heardPos, 0);
      e.heardPos.y = underfalls.groundAt(e.heardPos.x, e.heardPos.z);
    }
    e.loop = game.audio.drownedChoirLoop(e.pos);
    mesh.position.copy(e.pos);
    game.scene.add(mesh);
    this.list.push(e);
    this.choir = e;
    (game.spawnLog ||= []).push(['choir', 'warning', Math.round(e.pos.x), Math.round(e.pos.z), +game.time.toFixed(1)]);
    game.audio.drownedCall({ pos: e.pos, gain: 0.34, distant: true });
    return e;
  }

  endDrownedChoir(reason = 'leave') {
    let removed = 0;
    for (const e of this.list.slice()) {
      if (e.kind !== 'choir') continue;
      e.endReason = reason;
      this._remove(e);
      removed++;
    }
    this.choir = null;
    return removed;
  }

  drownedChoirHear(pos, intensity = 0.5, source = 'step') {
    const e = this.choir;
    if (!e || e.state === 'spent') return null;
    e.heardPos.set(pos.x, pos.y ?? this.game.player.pos.y, pos.z);
    const underfalls = this.game.underfalls;
    if (underfalls) {
      underfalls.clamp?.(e.heardPos, 0);
      e.heardPos.y = underfalls.groundAt(e.heardPos.x, e.heardPos.z);
    }
    e.nav = null;
    e.heardStrength = Math.max(e.heardStrength || 0, clamp(intensity, 0, 1.25));
    e.memoryT = Math.max(e.memoryT || 0, 1.4 + clamp(intensity, 0, 1.25) * 2.2);
    if (source === 'call') {
      e.revealT = Math.max(e.revealT, 0.45);
      this.game.audio.drownedCall({ pos: e.pos, gain: 0.68, rate: 1.08 });
    }
    return e;
  }

  // Future under-falls geometry can call this from any real spray/sluice
  // volume: game.enemies.caveSpray(worldPos, radius, strength). It reveals the
  // displaced-water outline, cancels a committed pressure strike, and washes
  // away the first-strike mark. No dependency on outside.js is required.
  caveSpray(pos, radius = 5.5, strength = 1) {
    let caught = 0;
    for (const e of this.list) {
      if (e.kind !== 'choir' || e.state === 'spent') continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const exposure = clamp(1 - d / Math.max(0.01, radius), 0, 1) * clamp(strength, 0.1, 2);
      e.wetT = Math.max(e.wetT, 0.55 + exposure * 0.85);
      e.revealT = Math.max(e.revealT, 1.4 + exposure * 1.8);
      e.warned = false;
      let awayX = d > 0.04 ? dx / d : e.pos.x - this.game.player.pos.x;
      let awayZ = d > 0.04 ? dz / d : e.pos.z - this.game.player.pos.z;
      let al = Math.hypot(awayX, awayZ);
      // Exact overlap is possible at the center of a pressure volume. It must
      // still repel instead of producing a zero-vector "successful" defense.
      if (al < 0.001) {
        awayX = Math.sin(e.phase * 0.73 + 0.91);
        awayZ = Math.cos(e.phase * 0.73 + 0.91);
        al = 1;
      }
      e.washV.x += awayX / al * (2.2 + exposure * 3.6);
      e.washV.z += awayZ / al * (2.2 + exposure * 3.6);
      if (e.state !== 'warning') {
        e.state = 'recoil';
        e.stateT = 0;
      }
      if (e.loop?.douse) e.loop.douse(exposure);
      this.game.audio.sprayReveal({ pos: e.pos, gain: 0.42 + exposure * 0.45 });
      caught++;
    }
    return caught;
  }

  // The Choir crossing a spray curtain on its OWN pursuit line (underfalls
  // installBeats owns the edge detection). Reveal + positional audio only:
  // unlike caveSpray there is no wetT slow, no wash push, and no
  // strike-cancel, so pursuit behavior is bit-identical to a dry walk.
  drownedChoirDrench() {
    const e = this.choir;
    if (!e || e.state === 'spent') return null;
    e.revealT = Math.max(e.revealT, 1.6);
    this.game.audio.sprayReveal({ pos: e.pos, gain: 0.5 });
    return e;
  }

  getDrownedChoirState() {
    const e = this.choir;
    if (!e) return null;
    return {
      state: e.state,
      age: e.age,
      revealT: e.revealT,
      wetT: e.wetT,
      memoryT: e.memoryT,
      warned: e.warned,
      pos: [e.pos.x, e.pos.y, e.pos.z],
      heardPos: [e.heardPos.x, e.heardPos.y, e.heardPos.z],
    };
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
    // Generic figures own one dark material each; anatomy accents are shared.
    // The Choir owns five per-lifecycle transparent materials. Dispose only
    // what the entity owns so three-wave retries do not grow GPU memory.
    if (e.kind === 'choir') {
      // Hand the lamp back before the body goes. Removing the mesh with the
      // light still parented to it would take the light out of the scene and
      // move the census, which is the whole thing loaning exists to prevent.
      this.game.world.returnLight?.(e.mesh.userData.light);
      for (const material of e.mesh.userData.ownedMaterials || []) material.dispose();
    } else if (e.mesh.userData.mat) {
      e.mesh.userData.mat.dispose();
    }
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
    if (this.choir === e) this.choir = null;
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
      if (e.kind === 'choir') continue; // there is no skull here in story; debug throws do not rewrite that law
      if (e.state === 'dying') continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const alreadyStunned = e.state === 'stunned' && (e.stunT || 0) > 0.08;
      if (this.game.act === 'graveyard' && alreadyStunned
        && (e.graveArena || e.gravePressure) && e.spec.hp !== Infinity) {
        this._layToRest(e);
        caught++;
        continue;
      }
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
    const graveArenaActive = !!graveArena && !graveArena.done;
    const graveWave = graveArena?.wave ?? 0;
    const graveClaimBudget = graveWave >= 2 ? 2 : 1;
    const claimableState = (e) => e.state === 'standing' || e.state === 'wind' ||
      e.state === 'chase' || e.state === 'strike';
    const graveCandidates = graveArenaActive
      ? this.list.filter((e) => e.graveArena && e.kind === 'walker' && claimableState(e))
      : [];
    const candidateSet = new Set(graveCandidates);
    this._graveClaimRecovery = Math.max(0, this._graveClaimRecovery - dt);
    for (const e of this.list) {
      if (!e.graveClaimed || candidateSet.has(e)) continue;
      e.graveClaimed = false;
      if (graveArenaActive) {
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
      if (e.kind === 'choir') {
        const choirThreat = this._updateDrownedChoir(e, dt, camPos, camFwd);
        if (choirThreat.level > maxThreat) {
          maxThreat = choirThreat.level;
          threatDir = choirThreat.dir;
        }
        continue;
      }
      const toP = V.c.set(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z);
      const dist = toP.length();
      // no hunting through floors: a storey of separation makes you unreachable
      const sameLevel = Math.abs(player.pos.y - e.pos.y) < 1.8;

      // The Resident YIELDS while the skull is anchored in a puzzle. The
      // house's required verbs include long anchored commitments (the window
      // relay is ~10 s of held walking with the light and the weapon both
      // away), and a hunter that presses during them turns a required verb
      // into a death sentence. So while the house's own machinery is working
      // it watches instead: it holds a ring outside arm's reach, backing off
      // if you carry the anchor toward it, and the chatter never stops. The
      // moment the anchor releases, it presses again — the pressure is real,
      // the sentence is not.
      if (e.kind === 'resident' && e.state !== 'stunned' && e.state !== 'dying'
        && game.skull.mode === 'anchored' && game.skull.anchor?.puzzleId) {
        if (sameLevel && dist < 4.4) {
          toP.normalize();
          this._moveWithPush(e, -toP.x * e.spec.stalk * 0.85 * dt, -toP.z * e.spec.stalk * 0.85 * dt);
        }
        e.phase += dt * 2.2;
        e.stepT -= dt;
        if (e.stepT <= 0) {
          e.stepT = 0.7 + Math.random() * 0.12;
          game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.4, rate: 0.72 });
        }
        if (sameLevel && dist < 8) {
          const level = 0.55 + (1 - dist / 8) * 0.3;
          if (level > maxThreat) { maxThreat = level; threatDir = toP.clone().normalize(); }
        }
        continue;
      }

      // ---- state machine ----
      switch (e.state) {
        case 'dormant':
          // statue-still until you have PASSED it, or it hears you.
          // A body whose rise an author is pacing (riseFrozen) cannot be
          // startled awake half out of the floor.
          if (e.riseFrozen) break;
          if (sameLevel && dist < 3.2 && player.noise > 0.5) { e.state = 'wind'; e.windT = 0; }
          break;
        case 'standing': {
          if (!sameLevel) break;
          if (e.gravePressure && graveArenaActive && !graveClaims.has(e)) {
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
          const d2 = Math.hypot(e.pos.x - camPos.x, e.pos.z - camPos.z);
          const observed = this._isObserved(e, dt, camPos, camFwd);
          // e.tether (opt-in, metres from e.home) bounds the unobserved creep:
          // a tethered Standing One closes while your back is turned but never
          // leaves its post. The ossuary resident uses it — the corridor's
          // baffles break line of sight constantly, and an unbounded creep
          // would convert every look-away into a corridor-length pursuit.
          const tethered = e.tether
            && Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z) >= e.tether;
          if (!observed && d2 < 30 && dist > 0.9 && !tethered) {
            toP.normalize();
            this._moveWithPush(e, toP.x * 0.85 * dt, toP.z * 0.85 * dt);
            e.phase += dt * 2.2;                 // silent gait — no footsteps. worse.
          } else if (dist <= 0.9 && !game.dead) {
            // Its silence gets it close; lifted arms and breath still give the
            // player one physical answer instead of converting overlap into an
            // invisible first-frame death.
            if (!this._beginCommittedStrike(e, player)) {
              if (e.gravePressure) this._releaseGraveClaim(e, 0.34);
              e.state = 'recover';
              e.recoverT = 0;
            }
          }
          break;
        }
        case 'stalk': {
          if (dist > 1 && sameLevel) {
            if (e._stalkVia) {
              // back on your storey: pure pursuit again, drop the climb plan
              e._stalkVia = false;
              e._via = null;
              e._route = null;
            }
            toP.normalize();
            this._moveWithPush(e, toP.x * e.spec.stalk * dt, toP.z * e.spec.stalk * dt);
            // A body that now inhabits the whole act must be audible while it
            // paces: slower and softer than the chase cadence, but there. The
            // law is "you hear things before you see them", and the skull's
            // chatter radar keys off the same presence.
            e.stepT -= dt;
            if (e.stepT <= 0) {
              e.stepT = 0.62 + Math.random() * 0.1;
              game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.42, rate: 0.78 });
            }
          } else if (dist > 1 && !sameLevel
            && isPhysicalHouseInterior(game)) {
            // The stalk climbs now — quietly. Stalk pace, stalk cadence, the
            // stairs' own wood underfoot as the tell; the wind-up mercy-tell
            // below still cannot begin until it shares your storey.
            e._navT = (e._navT || 0) - dt;
            if (e._navT <= 0) {
              e._navT = 0.9;
              let route = this._houseRoute(e, { exclude: e._viaLast });
              if (!route && e._viaLast) route = this._houseRoute(e);
              if (route?.length) { e._route = route; e._via = route[0]; e._stalkVia = true; }
              else { e._route = null; e._via = null; }
            }
            if (this._viaReached(e)) {
              e._viaLast = e._via.door || e._viaLast;
              e._route?.shift();
              e._via = e._route?.[0] || null;
            }
            if (e._via) {
              const dl = Math.hypot(e._via.x - e.pos.x, e._via.z - e.pos.z) || 1;
              this._moveWithPush(e, (e._via.x - e.pos.x) / dl * e.spec.stalk * dt,
                (e._via.z - e.pos.z) / dl * e.spec.stalk * dt);
              e.stepT -= dt;
              if (e.stepT <= 0) {
                e.stepT = 0.62 + Math.random() * 0.1;
                game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.42, rate: 0.78 });
              }
              // a stalking Resident still works a knob the same way it always
              // has — the rattle-tell precedes the panel, unchanged grammar
              if (e.kind === 'resident') this._tryOpenDoor(e, dt);
            }
          }
          if (sameLevel && dist < 9 && (player.noise > 0.3 || dist < 5)) { e.state = 'wind'; e.windT = 0; }
          break;
        }
        case 'wind': {
          // the wind-up IS the mercy: sound tells you it's coming before it moves
          e.windT += dt;
          // seed the chase acceleration clock: windT and the ramp used to be
          // one number; in the house windT now means "seconds of genuinely
          // failing", so the speed curve rides _chaseT from the same start
          e._chaseT = e.windT;
          if (e.windT === dt && !game.audio.enemyTell?.(e.kind, { pos: e.pos })) {
            game.audio.whisper({ pos: e.pos, gain: 0.7, rate: 0.6 });
          }
          e.mesh.userData.limbs.arms.forEach((a) => { a.rotation.x = -1.08 * Math.min(1, e.windT / e.spec.windup); });
          if (e.windT >= e.spec.windup) e.state = 'chase';
          break;
        }
        case 'chase': {
          // Storeys used to be a hard wall for the AI, which in the house
          // meant a statue at the foot of the stairs — or worse, ON them —
          // whenever you climbed. Indoors the graph now spans the storeys,
          // so only the outdoor acts keep the patient wait.
          const inHouse = isPhysicalHouseInterior(game);
          if (!sameLevel && !inHouse) { e.windT += dt; break; }   // it waits below. it hears you.
          e._besiegeHold = false;
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
            // The acceleration ramp and the lose-interest clock used to be
            // one number (windT). Split: _chaseT carries the ramp, seeded in
            // the wind-up so the old curve is preserved; in the house windT
            // now accrues ONLY while genuinely failing to progress, so the
            // director's windT>9 beat reads "nine seconds of getting
            // nowhere", never "nine seconds of you being upstairs".
            // Outdoors both tick together, exactly as they always did.
            const sp = e.spec.chase * arenaPace
              * Math.min(1, 0.35 + Math.max(e.windT, e._chaseT || 0) * 0.4);
            e._chaseT = (e._chaseT || 0) + dt;
            if (!inHouse) e.windT += dt;
            // door-node steering: straight lines end at shut doors. When
            // progress stalls, route through the doorway that best closes on
            // the player. The Resident goes further: it does doors (below).
            let tx = player.pos.x, tz = player.pos.z;
            let holding = false;
            const graveExit = (e.graveArena || e.gravePressure)
              ? this._graveEscapeTarget(e, player.pos)
              : null;
            if (graveExit) {
              tx = graveExit.x;
              tz = graveExit.z;
            } else if (e._besiege) {
              // THE BESIEGE: the graph proved the player sealed away behind a
              // door this body cannot work. Grinding the panel forever looked
              // exactly like the bug it was. Now it holds just off the door
              // and paws it on a slow cadence — audible, answerable, and
              // still only one opened door away from a real chase.
              const bd = e._besiege.door;
              e._navT = (e._navT || 0) - dt;
              if (bd.open) {
                e._besiege = null;
                e._navT = 0;
              } else if (e._navT <= 0) {
                e._navT = 0.9;
                const route = this._houseRoute(e, { exclude: e._viaLast });
                if (route?.length) { e._route = route; e._via = route[0]; e._besiege = null; }
              }
              if (e._besiege) {
                tx = e._besiege.x; tz = e._besiege.z;
                if (Math.hypot(tx - e.pos.x, tz - e.pos.z) < 0.35) {
                  holding = true;
                  e._pawT = (e._pawT ?? 1.1) - dt;
                  if (e._pawT <= 0) {
                    e._pawT = 2.4 + Math.random() * 0.7;
                    bd.rattleT = Math.max(bd.rattleT || 0, 0.5);
                    game.audio.lockedRattle({ pos: bd.group.position, gain: 0.32, rate: 0.62 });
                  }
                }
              } else if (e._via) { tx = e._via.x; tz = e._via.z; }
            } else if (e._via) {
              if (this._viaReached(e)) {
                // waypoint consumed: remember its door (the one-entry
                // exclusion that prevents oscillating straight back through
                // it) and SHIFT to the next leg instead of beelining
                e._viaLast = e._via.door || e._viaLast;
                e._route?.shift();
                e._via = e._route?.[0] || null;
              }
              if (e._via) { tx = e._via.x; tz = e._via.z; }
            } else if (!e.graveArena && !e.gravePressure) {
              // In the house, plan proactively rather than only after 0.8 s of
              // grinding into a shut door. Throttled; BFS on the cell graph.
              e._navT = (e._navT || 0) - dt;
              if (e._navT <= 0) {
                e._navT = 0.9;
                let route = this._houseRoute(e, { exclude: e._viaLast });
                // cross-storey the exclusion can wall off the ONLY path (one
                // door guards the stairbay) — waiting politely there is the
                // freeze Alex reported. Same-storey keeps the 0.8 s stall
                // damping before the exclusion is dropped.
                if (!route && !sameLevel && e._viaLast) route = this._houseRoute(e);
                if (route?.length) { e._route = route; e._via = route[0]; }
                else if (route) { e._route = null; e._via = null; }   // same room: beeline
                else if (inHouse && e.kind !== 'resident') this._besiegeSetup(e);
              }
              if (e._via) { tx = e._via.x; tz = e._via.z; }
            }
            if (inHouse && !sameLevel && !e._via && !e._besiege) {
              // a storey away with no route to it (the cellar flights are
              // authored off-graph): genuine failure. The lose-interest
              // clock runs; the body does not grind at the ceiling.
              e.windT += dt;
              break;
            }
            const preX = e.pos.x, preZ = e.pos.z;
            if (!holding) {
              const dl = Math.hypot(tx - e.pos.x, tz - e.pos.z) || 1;
              const dirX = (tx - e.pos.x) / dl, dirZ = (tz - e.pos.z) / dl;
              this._moveWithPush(e, dirX * sp * dt, dirZ * sp * dt);
            }
            const moved = Math.hypot(e.pos.x - preX, e.pos.z - preZ);
            if (inHouse) {
              // Marrow's best-approach rule: progress means closing on the
              // CURRENT steering target. Corner-jitter (pushed out, walks
              // back in, never past the corner) now reads as the stall it
              // is, and an honest slow grind past furniture does not.
              const tKey = e._via ? (e._via.x + '|' + e._via.z)
                : (e._besiege ? 'besiege' : 'player');
              const approach = Math.hypot(tx - e.pos.x, tz - e.pos.z);
              if (e._bestKey !== tKey) {
                e._bestKey = tKey; e._bestApproach = approach; e._noGainT = 0;
              } else if (approach < (e._bestApproach ?? Infinity) - 0.005) {
                e._bestApproach = approach; e._noGainT = 0;
              } else {
                e._noGainT = (e._noGainT || 0) + dt;
              }
              if (holding) {
                e._stallT = 0; e._noGainT = 0;   // the besiege stands still on purpose
              } else if (e._noGainT > 0.25) {
                e._stallT = (e._stallT || 0) + dt;
                e.windT += dt;
              } else {
                e._stallT = Math.max(0, (e._stallT || 0) - dt * 2);
                e.windT = Math.max(0, e.windT - dt * 2);
              }
            } else if (moved < sp * dt * 0.35) e._stallT = (e._stallT || 0) + dt;
            else e._stallT = Math.max(0, (e._stallT || 0) - dt * 2);
            if (e._stallT <= 0 && (e._unstuck1 || e._unstuck2)) {
              e._unstuck1 = false; e._unstuck2 = false;
            }
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
                e._stallT = 0;
              } else if (!inHouse) {
                // Stalled anyway (furniture, another body): re-plan on the
                // graph, dropping the exclusion if it is all that blocks us.
                const route = this._houseRoute(e, { exclude: e._viaLast })
                  || this._houseRoute(e)
                  || null;
                if (route?.length) { e._route = route; e._via = route[0]; }
                else e._via = this._bestDoorNode(e);   // outside the graph
                e._stallT = 0;
              } else if (!holding) {
                // The house's escalating unstick ladder (Marrow's watchdog):
                // re-plan, then ONE in-room side-step, then — only unseen,
                // only onto ground the graph already proved walkable, and
                // always announced by a footstep from the new spot —
                // relocate. An observed stall keeps straining instead: a
                // body fighting the house, never a teleport in view.
                if (!e._unstuck1) {
                  e._unstuck1 = true;
                  const route = this._houseRoute(e, { exclude: e._viaLast })
                    || this._houseRoute(e)
                    || null;
                  if (route?.length) { e._route = route; e._via = route[0]; }
                  else if (!e._via) e._via = this._bestDoorNode(e);
                }
                if (e._stallT > 2.5 && !e._unstuck2) {
                  e._unstuck2 = true;
                  const room = game.world.rooms.find((r) =>
                    Math.abs(r.floorY - e.pos.y) < 1.2
                    && e.pos.x >= r.x0 && e.pos.x <= r.x1
                    && e.pos.z >= r.z0 && e.pos.z <= r.z1);
                  if (room) {
                    const pl = Math.hypot(tx - e.pos.x, tz - e.pos.z) || 1;
                    e._avoidSign = -(e._avoidSign || 1);
                    const side = {
                      x: clamp(e.pos.x - (tz - e.pos.z) / pl * e._avoidSign * 1.6,
                        room.x0 + 0.4, room.x1 - 0.4),
                      z: clamp(e.pos.z + (tx - e.pos.x) / pl * e._avoidSign * 1.6,
                        room.z0 + 0.4, room.z1 - 0.4),
                    };
                    e._route = [side, ...(e._route || [])];
                    e._via = e._route[0];
                    e._bestKey = null;
                  }
                }
                if (e._stallT > 6 && e._via && (e._via.door || e._via.stair)
                  && game.time - (e._lastReloc ?? -99) > 8
                  && !this._isObserved(e, dt, camPos, camFwd)) {
                  e._lastReloc = game.time;
                  e.pos.x = e._via.x; e.pos.z = e._via.z;
                  const floorHint = e._via.y ?? (e._via.door ? e._via.door.floor : e.pos.y);
                  e.pos.y = game.world.groundHeightAt(e.pos.x, e.pos.z, floorHint + 1);
                  game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.7, rate: 0.9 });
                  e._stallT = 0; e._noGainT = 0; e._bestKey = null;
                  e._unstuck1 = false; e._unstuck2 = false;
                }
              }
            }
            e._besiegeHold = holding;
            if (e.kind === 'resident') this._tryOpenDoor(e, dt);
            if (!holding) {
              e.stepT -= dt;
              if (e.stepT <= 0) {
                e.stepT = 0.26 + Math.random() * 0.06;
                game.audio.footstep(game.world.surfaceAt(e.pos), { pos: e.pos, gain: 0.85, rate: 1.25 });
              }
            }
          } else if (!game.dead) {
            // Every body obeys the same contact law: contact begins a readable,
            // fixed-point commitment. Resident, walker, and Kneeler remain
            // one-hit lethal, but a sidestep, door, sprint or skull hit can beat
            // the action the player actually saw begin.
            if (!this._beginCommittedStrike(e, player)) {
              if (e.graveArena || e.gravePressure) this._releaseGraveClaim(e, 0.34);
              e.state = 'recover';
              e.recoverT = 0;
            } else {
              const toward = V.d.copy(e.strikePos).sub(e.pos).setY(0);
              if (toward.lengthSq() > 0.001) toward.normalize();
              e.strikeDirX = toward.x;
              e.strikeDirZ = toward.z;
            }
          }
          break;
        }
        case 'strike': {
          // The one-hit consequence is still severe; now every body earns it
          // with a visible fixed-point commitment. The target coordinate never
          // updates after contact, so movement and doors are actual answers.
          if ((e.graveArena || e.gravePressure) && !graveClaims.has(e)) {
            e.state = e.standing ? 'standing' : 'wind';
            e.windT = e.spec.windup * 0.62;
            e.strikeT = 0;
            break;
          }
          const olderStrike = this.list.some((other) => other !== e
            && other.state === 'strike' && (other.serial ?? 0) < (e.serial ?? 0));
          if (olderStrike) {
            if (e.graveArena || e.gravePressure) this._releaseGraveClaim(e, 0.34);
            e.state = 'recover';
            e.recoverT = 0;
            break;
          }
          if (!sameLevel) {
            if (e.graveArena || e.gravePressure) this._releaseGraveClaim(e, 0.34);
            e.state = 'recover';
            e.recoverT = 0;
            break;
          }
          e.strikeT = (e.strikeT || 0) + dt;
          if (e.strikeT === dt) {
            const rate = e.kind === 'kneeler' ? 0.52 : (e.kind === 'resident' ? 0.74 : 0.96);
            const gain = e.kind === 'kneeler' ? 1.0 : (e.kind === 'resident' ? 0.94 : 0.88);
            game.audio.walkerStrike({ pos: e.pos, gain, rate,
              verb: e.kind === 'resident' ? 0.5 : 0.38 });
            if (e.kind === 'kneeler') game.shake(0.09);
          }
          const duration = e.spec.strike || 0.66;
          const lift = Math.min(1, e.strikeT / Math.max(0.18, duration * 0.46));
          e.mesh.userData.limbs.arms.forEach((a) => { a.rotation.x = -1.46 * lift; });
          const lungeWindow = smoothstep(duration * 0.42, duration * 0.82, e.strikeT)
            * (1 - smoothstep(duration * 0.82, duration, e.strikeT));
          if (lungeWindow > 0) {
            this._moveWithPush(e, (e.strikeDirX || 0) * e.spec.lunge * lungeWindow * dt,
              (e.strikeDirZ || 0) * e.spec.lunge * lungeWindow * dt);
          }
          if (e.strikeT >= duration) {
            const missDistance = Math.hypot(player.pos.x - e.strikePos.x,
              player.pos.z - e.strikePos.z);
            const blocked = this._segmentBlocked(
              e.pos.x, e.pos.y + Math.min(1.25, e.spec.h * 0.55), e.pos.z,
              player.pos.x, player.pos.y + 0.9, player.pos.z,
            );
            const landed = missDistance <= e.spec.strikeRadius
              && Math.abs(player.pos.y - e.strikePos.y) <= 0.72 && !blocked;
            if (landed && !game.dead) {
              game.director.death(e);
            } else {
              if (e.graveArena || e.gravePressure) this._releaseGraveClaim(e, 0.42);
              e.state = 'recover';
              e.recoverT = 0;
              game.audio.walkerMiss({ pos: e.pos, gain: e.kind === 'kneeler' ? 0.72 : 0.5,
                rate: e.kind === 'kneeler' ? 0.58 : 0.94, verb: 0.25 });
            }
          }
          break;
        }
        case 'recover': {
          e.recoverT = (e.recoverT || 0) + dt;
          const u = clamp(e.recoverT / Math.max(0.1, e.spec.recovery), 0, 1);
          e.mesh.userData.limbs.arms.forEach((a, i) => {
            a.rotation.x = lerp(-1.18, i ? -0.08 : 0.08, smoothstep(0, 1, u));
          });
          if (u >= 1) {
            e.state = e.standing ? 'standing' : 'wind';
            e.windT = e.standing ? 0 : e.spec.windup * 0.52;
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
          if (e.quietRest) {
            e.deadT -= dt;
            const u = 1 - clamp(e.deadT / 0.9, 0, 1);
            e.pos.y = e.restGround - u * u * 0.72;
            e.mesh.rotation.x = u * 0.42;
            e.mesh.scale.set(e.spec.scale * (1 - u * 0.22),
              e.spec.scale * (1 - u * 0.58), e.spec.scale * (1 - u * 0.22));
            if (e.deadT <= 0) this._remove(e);
            break;
          }
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
      // a besieging body holds STILL at the door — pumping legs on a planted
      // figure read as the grind it replaced. The paw cadence is its motion.
      if ((e.state === 'chase' && !e._besiegeHold) || e.state === 'stalk') {
        const rate = e.state === 'chase' ? 11 : 3.5;
        e.phase += dt * rate;
        const L = e.mesh.userData.limbs;
        L.legs[0].rotation.x = Math.sin(e.phase) * 0.6;
        L.legs[1].rotation.x = -Math.sin(e.phase) * 0.6;
        if (e.state === 'chase') {
          L.arms[0].rotation.x = -1.02 + Math.sin(e.phase * 2) * 0.12;   // reaching for you
          L.arms[1].rotation.x = -1.02 - Math.sin(e.phase * 2) * 0.12;
        } else {
          L.arms[0].rotation.x = -Math.sin(e.phase) * 0.35;
          L.arms[1].rotation.x = Math.sin(e.phase) * 0.35;
        }
      }
      if (e.kind === 'walker') this._poseWalker(e, dt, graveClaims.has(e));
      else this._poseMalformed(e);
      if (e.state !== 'dying') e.pos.y = game.world.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1);
      e.mesh.position.copy(e.pos);
      if (e.graveRiseT > 0 && e.state !== 'dying') {
        // The emerge, not an elevator. Position alone read as riding a
        // platform; a body dragging itself out of the ground is compressed
        // and fighting: it starts squashed and unfolds, it shudders
        // laterally with the effort, and the jaw hangs open until it is out.
        // riseFrozen lets an author (the nursery) own the clock.
        if (!e.riseFrozen) e.graveRiseT = Math.max(0, e.graveRiseT - dt);
        const remaining = e.graveRiseT / Math.max(0.001, e.graveRiseDur || 1.1);
        const up = 1 - remaining;
        // squash-only bodies (the nursery: its floor is someone's ceiling)
        // grow from a crouch instead of sinking through the storey below
        if (!e.riseSquashOnly) e.mesh.position.y -= remaining * remaining * 1.35;
        e.mesh.scale.y = e.spec.scale * ((e.riseSquashOnly ? 0.06 : 0.34) + (e.riseSquashOnly ? 0.94 : 0.66) * up);
        e.mesh.position.x = e.pos.x + Math.sin(up * 31 + e.serial) * 0.055 * remaining;
        e.mesh.position.z = e.pos.z + Math.cos(up * 24 + e.serial) * 0.04 * remaining;
        const w = e.mesh.userData.walker;
        if (w?.jaw) w.jaw.rotation.x = w.jaw.userData.baseRotation.x + 0.5 * remaining;
      } else if (e.mesh.scale.y !== e.spec.scale) {
        e.mesh.scale.y = e.spec.scale;
      }
      if (e.state !== 'dormant' && e.state !== 'dying' && dist > 0.1) {
        // Face of travel: a routed body walking a doorway or a flight looks
        // where it is going (Marrow's rule) — hard-facing the player through
        // a floor while marching the other way read as broken. Near the
        // player, or unrouted, it locks eyes exactly as before.
        const via = (e.state === 'chase' || e.state === 'stalk') && dist > 2 ? e._via : null;
        const fx = via ? via.x : player.pos.x;
        const fz = via ? via.z : player.pos.z;
        if (Math.hypot(fx - e.pos.x, fz - e.pos.z) > 0.1) {
          e.mesh.rotation.y = Math.atan2(fx - e.pos.x, fz - e.pos.z);
        }
      }
      // a stunned Standing One resumes standing, not chasing
      if (e.state === 'wind' && e.kind === 'walker' && e.standing) { e.state = 'standing'; }

      // ---- skull contact ----
      // iframes: without them the return flight sweeps back through the body it
      // just stunned and auto-pops it — making the quiet option impossible.
      // A hit grants 0.6s immunity; popping takes a deliberate second THROW.
      e.iframes = Math.max(0, (e.iframes || 0) - dt);
      // game.skullPower (the iron canine, the optional graveyard pickup)
      // sharpens the bite: slower contacts still count, stuns hold longer,
      // blows land harder — and at power 2 an ORDINARY body is PIERCED. The
      // stun-then-deliberate-second-throw grammar is still the game's law at
      // power 1, and still the only way anything unkillable is ever handled;
      // the fang is what buying out of it costs, and it is optional.
      const power = game.skullPower || 1;
      if (e.state !== 'dying' && e.iframes <= 0 && (skull.mode === 'outbound' || skull.mode === 'returning') && skull.vel.length() > 8 / power) {
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
          if (power >= 2 && e.spec.hp !== Infinity) {
            // PIERCE. The fang goes THROUGH: the body drops on the first
            // contact and the skull is neither deflected nor sent home, so one
            // throw can take the body standing behind this one, and the one
            // behind that. Speed is bled, never zeroed — it drags, it does not
            // stop. No flight clock is touched and no FEEL constant is read;
            // this is a hit-resolution branch, exactly like the two below it.
            this._pop(e, travX / travL, travZ / travL, speed);
            skull.vel.multiplyScalar(0.86);
            skull.jaw.rotation.x = 0.72;             // it does not even close its mouth
            skull._flourishT = 0.5;
          } else if (e.state === 'stunned' && e.spec.hp !== Infinity) {
            this._pop(e, travX / travL, travZ / travL, speed);
            skull.vel.copy(away).multiplyScalar(speed * 0.5);
            skull.jaw.rotation.x = 0.65;             // it comes back grinning
            skull.beginReturn('hit');
          } else if (e.state !== 'stunned') {
            // QUIET tier: it staggers, gives ground, and its voice gasps
            this._releaseGraveClaim(e, 0.65);
            e.state = 'stunned';
            e.stunT = e.spec.stun * power;
            e.recoilT = 0.12;
            if (!e.knockV) e.knockV = new THREE.Vector3();
            e.knockV.set(travX / travL, 0, travZ / travL)
              .multiplyScalar(clamp(speed * 0.03 * power, 0.45, 0.9 * power));
            game.impact('hurt', skull.pos);
            game.audio.thud({ pos: e.pos, gain: 0.55 + hitInt * 0.35, rate: 0.9 + hitInt * 0.3, intensity: hitInt, crack: true });
            if (e.loop && e.loop.choke) e.loop.choke();
            skull._flourishT = 0.3 + (power - 1) * 0.2;   // the tooth CLACK is the hit marker
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

  resetGraveClaims() {
    this._graveClaimRecovery = 0;
    for (const e of this.list) e.graveClaimed = false;
  }

  _beginCommittedStrike(e, player) {
    // Contact reserves one authored attack at a time. The committed footprint
    // is copied once and never tracks the player through the tell.
    const busy = this.list.some((other) => other !== e && other.state === 'strike');
    if (busy) return false;
    e.state = 'strike';
    e.strikeT = 0;
    e.recoverT = 0;
    e.strikePos.copy(player.pos);
    const dx = e.strikePos.x - e.pos.x;
    const dz = e.strikePos.z - e.pos.z;
    const length = Math.hypot(dx, dz) || 1;
    e.strikeDirX = dx / length;
    e.strikeDirZ = dz / length;
    return true;
  }

  _choirRouteEdgeClear(e, a, b) {
    // Movement resolves the Choir as a horizontal body against every live AABB.
    // Navigation must test that same swept footprint, not an eye-height ray:
    // the low pump altar can stop its feet while remaining below its "vision".
    const underfalls = this.game.underfalls;
    const radius = e?.spec?.r ?? DROWNED_CHOIR.r;
    const ax = a.x, az = a.z;
    const ay = Number.isFinite(a.y) ? a.y : underfalls?.groundAt?.(a.x, a.z) ?? 0;
    const dx = b.x - ax, dz = b.z - az;
    const by = Number.isFinite(b.y) ? b.y : underfalls?.groundAt?.(b.x, b.z) ?? ay;
    const dy = by - ay;
    for (const c of this.game.world.colliders) {
      if (c.max.y <= c.min.y) continue;
      let near = 0.002, far = 0.998;

      const minX = c.min.x - radius, maxX = c.max.x + radius;
      if (Math.abs(dx) < 1e-8) {
        if (ax < minX || ax > maxX) continue;
      } else {
        let t0 = (minX - ax) / dx, t1 = (maxX - ax) / dx;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        near = Math.max(near, t0); far = Math.min(far, t1);
        if (near > far) continue;
      }

      const minZ = c.min.z - radius, maxZ = c.max.z + radius;
      if (Math.abs(dz) < 1e-8) {
        if (az < minZ || az > maxZ) continue;
      } else {
        let t0 = (minZ - az) / dz, t1 = (maxZ - az) / dz;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        near = Math.max(near, t0); far = Math.min(far, t1);
        if (near > far) continue;
      }

      // _moveWithPush collides while [ground + .5, ground + 1.8] overlaps.
      const minY = c.min.y - 1.8, maxY = c.max.y - 0.5;
      if (Math.abs(dy) < 1e-8) {
        if (ay < minY || ay > maxY) continue;
      } else {
        let t0 = (minY - ay) / dy, t1 = (maxY - ay) / dy;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        near = Math.max(near, t0); far = Math.min(far, t1);
        if (near > far) continue;
      }
      return false;
    }
    return true;
  }

  _choirLineClear(a, b, pad = 0.16) {
    const underfalls = this.game.underfalls;
    if (!underfalls?.lineOfSight?.(a, b, { pad })) return false;
    // Route-union visibility owns the cave walls and storeys; the ordinary
    // world segment test adds the chapel's real pillars, pump altar, and hatch
    // shell. Pressure therefore cannot pass through either kind of geometry.
    return !this._segmentBlocked(
      a.x, a.y + 1.12, a.z,
      b.x, b.y + 1.12, b.z,
    );
  }

  _choirRoute(e, target, dt = 0) {
    const underfalls = this.game.underfalls;
    if (!underfalls?.route) return null;
    if (e.nav) e.nav.ttl -= dt;
    const targetMoved = !e.nav || Math.hypot(
      target.x - e.nav.target.x,
      target.z - e.nav.target.z,
      (target.y || 0) - (e.nav.target.y || 0),
    ) > 0.28;
    let routeInvalid = false;
    if (e.nav && e.nav.ttl <= 0 && !targetMoved) {
      const waypoint = e.nav.route?.points?.[e.nav.index] || null;
      const exhaustedFar = !waypoint
        && Math.hypot(target.x - e.pos.x, target.z - e.pos.z) > 0.35;
      routeInvalid = !e.nav.route?.reachable || exhaustedFar || (waypoint && (
        !underfalls.lineOfSight(e.pos, waypoint, { pad: 0.2 })
        || !this._choirRouteEdgeClear(e, e.pos, waypoint)
      ));
      // A fixed heard target owns one stable authored path. Periodically verify
      // the current edge for a spray displacement or changed collider, but do
      // not choose a new equally-short side every 0.22s and manufacture jitter.
      if (!routeInvalid) e.nav.ttl = 0.22;
    }
    if (!e.nav || targetMoved || routeInvalid) {
      const route = underfalls.route(e.pos, target, {
        pad: 0.2,
        edgeAllowed: (a, b) => this._choirRouteEdgeClear(e, a, b),
      });
      e.nav = {
        route,
        target: { x: target.x, y: target.y, z: target.z },
        origin: { x: e.pos.x, y: e.pos.y, z: e.pos.z },
        index: 0,
        ttl: 0.22,
      };
    }
    const nav = e.nav;
    while (nav.route?.points?.[nav.index]
      && Math.hypot(
        nav.route.points[nav.index].x - e.pos.x,
        nav.route.points[nav.index].z - e.pos.z,
      ) < 0.3) nav.index++;
    return nav;
  }

  _choirPlayerRoute(e, player, dt = 0) {
    const underfalls = this.game.underfalls;
    if (!underfalls?.route) return null;
    const cache = e.acousticNav;
    if (cache) cache.ttl -= dt;
    const targetMoved = !cache || Math.hypot(
      player.pos.x - cache.target.x,
      player.pos.z - cache.target.z,
      player.pos.y - cache.target.y,
    ) > 0.85;
    const originMoved = !cache || Math.hypot(
      e.pos.x - cache.origin.x,
      e.pos.z - cache.origin.z,
      e.pos.y - cache.origin.y,
    ) > 0.85;
    if (!cache || cache.ttl <= 0 || targetMoved || originMoved) {
      e.acousticNav = {
        route: underfalls.route(e.pos, player.pos, {
          pad: 0.16,
          edgeAllowed: (a, b) => this._choirRouteEdgeClear(e, a, b),
        }),
        target: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
        origin: { x: e.pos.x, y: e.pos.y, z: e.pos.z },
        // At 120 Hz this caps the acoustic solve near seven per second. Together
        // with the movement route's five, one live Choir remains below 15.
        ttl: 0.14,
      };
    }
    return e.acousticNav.route;
  }

  // It comes up in front of you. See CHOIR_SURFACE for why each guard is here.
  _maybeSurfaceChoir(e, dt) {
    const game = this.game;
    const underfalls = game.underfalls;
    if (!underfalls?.projectMain) return;
    if (e.hushT > 0) {
      e.hushT -= dt;
      if (e.hushT <= 0) this._surfaceChoirAt(e);
      return;
    }
    e.surfaceCd -= dt;
    if (e.surfacings >= CHOIR_SURFACE.max || e.surfaceCd > 0) return;
    // never out of a committed strike or a recoil: those beats are the
    // contract the player is currently reading
    if (e.state !== 'stalk') return;
    const player = game.player;
    const here = underfalls.projectMain(player.pos.x, player.pos.z);
    const there = underfalls.projectMain(e.pos.x, e.pos.z);
    if (!here || !there) return;
    if (here.routeDistance - there.routeDistance < CHOIR_SURFACE.minBehind) return;
    // and you have to be WALKING AWAY from it. Surfacing ahead of a player who
    // has turned round to face it is just a spawn in the face.
    const vx = player.vel?.x || 0, vz = player.vel?.z || 0;
    const vl = Math.hypot(vx, vz);
    if (vl < 0.8) return;
    const probe = underfalls.projectMain(player.pos.x + vx / vl * 0.8, player.pos.z + vz / vl * 0.8);
    if (!probe || probe.routeDistance <= here.routeDistance) return;

    if (!this._choirSurfacePoint()) return;
    e.hushT = CHOIR_SURFACE.hush;
  }

  // WHERE it comes up is decided when it comes up, not when the hush starts.
  // The first build chose the point at trigger time and the probe caught it:
  // the player walks three metres during the beat of silence, so a surfacing
  // measured at ten metres arrived at 7.4. Everything here is re-asked against
  // the live player. (What is NOT re-asked is whether they are still walking —
  // the silence is designed to stop them, and aborting on that would mean the
  // better the tell works, the less often the beat fires.)
  _choirSurfacePoint() {
    const game = this.game;
    const underfalls = game.underfalls;
    const player = game.player;
    const here = underfalls?.projectMain?.(player.pos.x, player.pos.z);
    if (!here) return null;
    // Two passes. The first will only take a point you cannot currently see,
    // so the thing is THERE when the corridor opens rather than appearing in
    // front of your eyes — a hard cut you are watching is the cheapest version
    // of this beat. If the whole reach ahead is visible, the second pass takes
    // it anyway: the silence and the call have already announced it, and a
    // surfacing that never fires is worth less than one you half-see.
    let fallback = null;
    for (const hidden of [true, false]) {
      for (const ahead of CHOIR_SURFACE.ahead) {
        const p = underfalls.mainPointAt(here.routeDistance + ahead);
        if (!p || p.remaining < CHOIR_SURFACE.keepClear) continue;
        if (p.w < CHOIR_SURFACE.minWidth) continue;
        if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < CHOIR_SURFACE.minStraight) continue;
        const candidate = { x: p.x, z: p.z, w: p.w, ahead };
        if (!hidden) { fallback ||= candidate; continue; }
        const seen = underfalls.lineOfSight?.(
          { x: player.pos.x, y: player.pos.y + 1.5, z: player.pos.z },
          { x: p.x, y: p.y + 1.4, z: p.z }, { pad: 0.2 });
        if (!seen) return candidate;
      }
    }
    return fallback;
  }

  _surfaceChoirAt(e) {
    const target = this._choirSurfacePoint();
    // The corridor moved under the beat: hold the counter, try again shortly.
    if (!target) { e.surfaceCd = 4; return; }
    const game = this.game;
    const underfalls = game.underfalls;
    e.pos.set(target.x, e.pos.y, target.z);
    underfalls?.clamp?.(e.pos, 0);
    if (underfalls) e.pos.y = underfalls.groundAt(e.pos.x, e.pos.z);
    e.mesh.position.copy(e.pos);
    // every cached route through the old position is now a lie
    e.nav = null;
    e.acousticNav = null;
    e.washV.set(0, 0, 0);
    e.wetT = 0;
    // It surfaces and STARTS AGAIN: the warning fuse has to burn before it can
    // move, which is what makes ten metres ahead a scare instead of a death.
    e.state = 'warning';
    e.stateT = 0;
    e.memoryT = 3.5;
    e.heardStrength = 0.35;
    e.surfacings++;
    e.surfaceCd = CHOIR_SURFACE.cooldown;
    if (e.loop) e.loop.setPos(e.pos.x, e.pos.y + 1.4, e.pos.z);
    // and it announces itself as it comes up, at the sound you just made
    this.drownedChoirHear(game.player.pos, 0.5, 'call');
    e.revealT = Math.max(e.revealT, 2.6);
    (game.spawnLog ||= []).push(['choir', 'surface', Math.round(e.pos.x), Math.round(e.pos.z), +game.time.toFixed(1)]);
    (this.choirSurfaceLog ||= []).push({
      n: e.surfacings,
      x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2),
      w: +(target.w ?? 0).toFixed(2), ahead: target.ahead ?? null,
      playerDist: +Math.hypot(e.pos.x - game.player.pos.x, e.pos.z - game.player.pos.z).toFixed(2),
      t: +game.time.toFixed(1),
    });
  }

  _updateDrownedChoir(e, dt, camPos, camFwd) {
    const game = this.game;
    const player = game.player;
    if (game.act !== 'cave') {
      this._remove(e);
      return { level: 0, dir: null };
    }

    e.age += dt;
    e.stateT += dt;
    e.phase += dt;
    // reveals decay slower than they used to: a sighting that lasts a second
    // and a third is a sighting you can miss by blinking
    e.revealT = Math.max(0, e.revealT - dt * 0.62);
    e.wetT = Math.max(0, e.wetT - dt);
    e.memoryT = Math.max(0, e.memoryT - dt);
    e.heardStrength = Math.max(0, e.heardStrength - dt * 0.24);

    // Spray applies momentum instead of teleporting the threat. The player can
    // hear and watch it wash away, and authored water volumes can stack pushes.
    if (e.washV.lengthSq() > 0.0001) {
      this._moveWithPush(e, e.washV.x * dt, e.washV.z * dt);
      game.underfalls?.clamp?.(e.pos, dt);
      e.washV.multiplyScalar(Math.exp(-4.2 * dt));
    }

    // before anything reads its position this frame
    this._maybeSurfaceChoir(e, dt);

    let dx = player.pos.x - e.pos.x;
    let dz = player.pos.z - e.pos.z;
    let dist = Math.hypot(dx, dz);

    switch (e.state) {
      case 'warning':
        // Audio owns the whole opening beat. An authored sluice/spray hook may
        // expose it during that warning, but pursuit never begins early.
        if (e.stateT >= DROWNED_CHOIR.warning) {
          e.state = 'stalk';
          e.stateT = 0;
          // the moment it starts to move is the one sighting the whole rest of
          // the district is built on — make it long enough to turn toward
          e.revealT = Math.max(e.revealT, 2.4);
          game.audio.drownedSurge({ pos: e.pos, gain: 0.58, rate: 0.82 });
        }
        break;

      case 'stalk': {
        // It goes to the last sound, never the live player coordinate. When the
        // memory thins, it still finishes that dry interval at a slower creep.
        // The next point comes from Underfalls' authored route union: it can
        // take the dry-return shortcut, but never cut across the rock between
        // two nearby corridors or climb through a different floor.
        const nav = this._choirRoute(e, e.heardPos, dt);
        const waypoint = nav?.route?.points?.[nav.index] || null;
        const hx = waypoint ? waypoint.x - e.pos.x : 0;
        const hz = waypoint ? waypoint.z - e.pos.z : 0;
        const hd = Math.hypot(hx, hz);
        if (hd > 0.12) {
          const heard = clamp(e.heardStrength, 0, 1);
          // A player-thrown curtain of spray used to cut it to 8% — a
          // ninety-two per cent stop, on a thing that already trails you by
          // design. The counterplay survives at a third; being un-catchable
          // does not, because a predator you can never meet is scenery.
          const speed = lerp(DROWNED_CHOIR.drySpeed, DROWNED_CHOIR.heardSpeed, heard)
            * (e.wetT > 0 ? 0.55 : 1);
          this._moveWithPush(e, hx / hd * speed * dt, hz / hd * speed * dt);
          game.underfalls?.clamp?.(e.pos, dt);
        }
        // 0.72 -> 1.05: the vertical gallery was a free zone you could stand in
        // and watch it fail to reach you. lineOfSight still vetoes genuinely
        // different storeys (the real gaps are 1.25 and 1.60).
        const sameReachableSpace = Math.abs(player.pos.y - e.pos.y) < 1.05
          && this._choirLineClear(e.pos, player.pos);
        if (dist < DROWNED_CHOIR.attackRange && sameReachableSpace
          && e.stateT > 0.22 && e.wetT <= 0.4) {
          e.state = 'pressure';
          e.stateT = 0;
          e.strikePos.copy(player.pos); // commitment: this point never tracks after the warning begins
          e.revealT = Math.max(e.revealT, DROWNED_CHOIR.attackCommit + 0.5);
          game.audio.drownedSurge({ pos: e.pos, gain: 0.82, rate: 0.64, pressure: true });
        }
        break;
      }

      case 'pressure': {
        if (e.stateT >= DROWNED_CHOIR.attackCommit) {
          const miss = Math.hypot(player.pos.x - e.strikePos.x, player.pos.z - e.strikePos.z)
            > DROWNED_CHOIR.attackRadius
            || Math.abs(player.pos.y - e.strikePos.y) > 1.05
            || !this._choirLineClear(e.pos, player.pos);
          if (!miss && !e.warned) {
            // The first caught wave teaches the consequence without killing.
            // There is no HUD mark: choking audio, full-value camera fear, and
            // the Choir physically recoiling carry the state.
            e.warned = true;
            e.state = 'recover';
            e.stateT = 0;
            const ax = e.pos.x - player.pos.x, az = e.pos.z - player.pos.z;
            const al = Math.hypot(ax, az) || 1;
            e.washV.x += ax / al * 3.8;
            e.washV.z += az / al * 3.8;
            game.fx.fear = 1;
            game.shake(0.42);
            game.audio.drownedImpact({
              pos: new THREE.Vector3(player.pos.x, player.pos.y + 1.25, player.pos.z),
              gain: 0.86,
            });
          } else if (!miss && !game.dead) {
            // IT CATCHES YOU AND IT LETS YOU GO. His call, 2026-08-19, on the
            // last walk before the mirror room: "i find myself debating whether
            // this last cave waterfall area needs the enemy in it... if we do
            // make him apear and not attack, that would be awesome."
            //
            // So the second catch is no longer a death. It is the same beat as
            // the first — the recoil, the choking impact, the full-value fear —
            // and then the thing is SPENT and stops pursuing. The apparition he
            // asked for in round six survives intact (it still rises, still
            // stands across the chapel, still teleports ahead of you); what
            // goes is the kill. The walk before the ending is now suspicion
            // rather than a lottery, which is what he said it should be.
            //
            // Restoring the death is this branch and nothing else: put back
            // game.director.death(e) and delete the beat below.
            e.state = 'spent';
            e.stateT = 0;
            const sx = e.pos.x - player.pos.x, sz = e.pos.z - player.pos.z;
            const sl = Math.hypot(sx, sz) || 1;
            e.washV.x += sx / sl * 4.6;
            e.washV.z += sz / sl * 4.6;
            game.fx.fear = 1;
            game.shake(0.5);
            game.audio.drownedImpact({
              pos: new THREE.Vector3(player.pos.x, player.pos.y + 1.25, player.pos.z),
              gain: 0.95,
            });
          } else {
            e.state = 'recover';
            e.stateT = 0;
          }
        }
        break;
      }

      case 'recover':
        if (e.stateT >= DROWNED_CHOIR.recovery) {
          e.state = 'stalk';
          e.stateT = 0;
        }
        break;

      case 'recoil':
        if (e.stateT >= 0.9) {
          e.state = 'stalk';
          e.stateT = 0;
        }
        break;

      case 'spent':
        break;
    }

    const caveGround = game.underfalls?.groundAt?.(e.pos.x, e.pos.z);
    e.pos.y = Number.isFinite(caveGround)
      ? caveGround
      : game.world.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1.5);
    e.mesh.position.copy(e.pos);
    dx = player.pos.x - e.pos.x;
    dz = player.pos.z - e.pos.z;
    dist = Math.hypot(dx, dz);
    if (dist > 0.05) e.mesh.rotation.y = Math.atan2(dx, dz);

    // Visibility is a pressure event, not a hue swap. Dry stalking keeps the
    // shroud almost a hole in the cave, but the displaced-water glints hold a
    // permanent faint floor — the one honest standing tell that something is
    // moving the water; spray and attack reveal cheek planes, socket depth,
    // broken ribs, displaced water and the one continuous burial silhouette.
    const pressure = e.state === 'pressure'
      ? smoothstep(0, 1, clamp(e.stateT / DROWNED_CHOIR.attackCommit, 0, 1))
      : 0;
    const recoil = e.state === 'recoil' ? 1 - clamp(e.stateT / 0.9, 0, 1) : 0;
    const reveal = clamp(Math.max(
      e.revealT / 1.35,
      e.wetT / 1.15,
      pressure,
      recoil,
    ), 0, 1);
    const U = e.mesh.userData;
    // THE DRY FLOORS WERE THE BUG. At 0.001-0.02 a standing Choir is not dim,
    // it is absent — a walking player heard ambience and saw nothing, which is
    // the whole of "I still do not see any of those old enemies". The floors
    // carry a real silhouette now: a hole in the cave with wet glints on it,
    // still far below a revealed one, and still value and motion only.
    U.voidMat.opacity = 0.075 + reveal * 0.75;
    U.skinMat.opacity = 0.018 + reveal * 0.42;
    U.wetMat.opacity = 0.012 + reveal * 0.24;
    U.rimMat.opacity = 0.014 + reveal * 0.19;
    U.mouthVoidMat.opacity = 0.05 + reveal * 0.88;
    U.dropMat.uniforms.uOpacity.value = 0.19 + reveal * 0.56;
    U.dropMat.uniforms.uSize.value = 0.062 + reveal * 0.03;
    if (U.light) {
      U.light.intensity = reveal * (2.5 + pressure * 5.6);
      U.light.distance = 4.2 + reveal * 2.3;
    }
    U.droplets.rotation.y = e.phase * (0.22 + pressure * 0.9);
    U.droplets.position.y = Math.sin(e.phase * 2.7) * 0.055;

    // The three retained curtain layers breathe as one soaked mass. Their tiny
    // relative slips expose folds, never three stacked geometric bodies.
    const bodySway = Math.sin(e.phase * 1.37) * (0.018 + pressure * 0.035);
    for (let i = 0; i < U.curtains.length; i++) {
      const shell = U.curtains[i];
      const shellBase = shell.userData.basePos;
      shell.position.set(
        shellBase.x + bodySway * (0.7 + i * 0.16) + pressure * (i === 2 ? 0.025 : -0.012),
        shellBase.y + pressure * (i === 1 ? 0.045 : -0.018) - recoil * (0.05 + i * 0.015),
        shellBase.z + pressure * (i === 2 ? 0.055 : i === 1 ? 0.025 : -0.015),
      );
      shell.rotation.z = shell.userData.baseRot + bodySway * (1.1 + i * 0.2)
        + pressure * (i === 2 ? -0.045 : 0.02) - recoil * (i === 2 ? 0.08 : 0.025);
      const width = 1 + pressure * (i === 0 ? 0.11 : i === 1 ? 0.08 : 0.14) - recoil * 0.09;
      const height = 1 + pressure * (i === 1 ? 0.09 : 0.045) - recoil * 0.07;
      shell.scale.set(
        shell.userData.baseScale.x * width,
        shell.userData.baseScale.y * height,
        shell.userData.baseScale.z,
      );
    }
    const outline = U.outlines[0];
    const outlineBase = outline.userData.basePos;
    outline.position.set(
      outlineBase.x + bodySway * 0.62,
      outlineBase.y + pressure * 0.015 - recoil * 0.055,
      outlineBase.z - pressure * 0.01,
    );
    outline.rotation.z = outline.userData.baseRot + bodySway * 0.85 - recoil * 0.025;
    outline.scale.set(
      outline.userData.baseScale.x * (1 + pressure * 0.1 - recoil * 0.08),
      outline.userData.baseScale.y * (1 + pressure * 0.055 - recoil * 0.07),
      outline.userData.baseScale.z,
    );
    U.mass.position.set(
      U.mass.userData.basePos.x + bodySway * 0.45,
      U.mass.userData.basePos.y + pressure * 0.035 - recoil * 0.08,
      U.mass.userData.basePos.z + pressure * 0.035,
    );
    U.mass.scale.set(
      U.mass.userData.baseScale.x * (1 + pressure * 0.09 - recoil * 0.1),
      U.mass.userData.baseScale.y * (1 + pressure * 0.06 - recoil * 0.08),
      U.mass.userData.baseScale.z,
    );

    // Each face owns a different depth, angle, damaged plane and thrust path.
    // Mouths do not sing as oval meters; jaws slacken only as the fixed-point
    // pressure commits, while spray pushes all three back into the veil.
    for (let i = 0; i < U.mouths.length; i++) {
      const face = U.mouths[i];
      const faceBase = face.userData.base;
      const faceScale = face.userData.baseScale;
      const faceRot = face.userData.baseRotation;
      const motion = face.userData.motion;
      const drownedTwitch = Math.sin(e.phase * (1.15 + i * 0.08) + motion.phase);
      face.position.set(
        faceBase.x + motion.thrust[0] * pressure + motion.recoil[0] * recoil + drownedTwitch * 0.008,
        faceBase.y + motion.thrust[1] * pressure + motion.recoil[1] * recoil + drownedTwitch * 0.006,
        faceBase.z + motion.thrust[2] * pressure + motion.recoil[2] * recoil,
      );
      face.scale.set(
        faceScale.x * (1 + pressure * (i === 1 ? 0.08 : 0.045) - recoil * 0.045),
        faceScale.y * (1 + pressure * (i === 1 ? 0.11 : 0.065) - recoil * 0.065),
        1,
      );
      face.rotation.set(
        faceRot.x + drownedTwitch * 0.012 - pressure * (i === 1 ? 0.05 : 0.025),
        faceRot.y + pressure * [0.08, -0.035, -0.1][i] - recoil * [0.04, -0.02, -0.05][i],
        faceRot.z + drownedTwitch * 0.018 + pressure * [-0.045, 0.025, 0.06][i],
      );

      const anatomy = U.jaws[i];
      const gap = pressure * [0.075, 0.145, 0.095][i]
        + Math.max(0, drownedTwitch) ** 8 * 0.008;
      anatomy.jaw.position.set(
        anatomy.jaw.userData.basePos.x + pressure * [0.012, -0.015, 0.02][i],
        anatomy.jaw.userData.basePos.y - gap,
        anatomy.jaw.userData.basePos.z + pressure * 0.025,
      );
      anatomy.jaw.rotation.z = anatomy.jaw.userData.baseRot
        + pressure * [0.11, -0.16, 0.2][i] - recoil * 0.08;
      anatomy.jaw.rotation.x = pressure * (0.12 + i * 0.045);
      anatomy.hole.scale.set(
        anatomy.hole.userData.baseScale.x * (1 + pressure * 0.08),
        anatomy.hole.userData.baseScale.y * (1 + pressure * [0.45, 0.7, 0.52][i]),
        1,
      );
      anatomy.headMass.scale.set(
        anatomy.headMass.userData.baseScale.x * (1 + pressure * 0.025),
        anatomy.headMass.userData.baseScale.y * (1 + pressure * 0.045 - recoil * 0.03),
        anatomy.headMass.userData.baseScale.z,
      );
    }

    // One broken cage expands with the fused lung and folds under spray.
    const rib = U.ribCage;
    rib.scale.set(
      rib.userData.baseScale.x * (1 + pressure * 0.2 - recoil * 0.17),
      rib.userData.baseScale.y * (1 + pressure * 0.1 - recoil * 0.08),
      1,
    );
    rib.rotation.z = rib.userData.baseRot + pressure * 0.035 - recoil * 0.1;
    e.mesh.scale.setScalar(1 + pressure * 0.2 - recoil * 0.08);

    const playerRoute = this._choirPlayerRoute(e, player, dt);
    const pressureDistance = playerRoute?.reachable ? playerRoute.distance : Infinity;
    const level = clamp(1 - (pressureDistance - 1) / 19, 0, 1)
      * (e.state === 'warning' ? 0.36 : e.state === 'spent' ? 0.15 : 0.82 + pressure * 0.18);
    const toE = V.d.set(e.pos.x - camPos.x, 0, e.pos.z - camPos.z);
    const el = toE.length() || 1;
    toE.divideScalar(el);
    const rear = this._choirLineClear(e.pos, player.pos)
      ? clamp(-camFwd.dot(toE), 0, 1) * clamp(1 - pressureDistance / 10, 0, 1)
      : 0;
    if (e.loop) {
      e.loop.setPos(e.pos.x, e.pos.y + 1.4, e.pos.z);
      // THE SILENCE IS THE TELL. No new sound announces a surfacing — the loop
      // that has followed you the whole chapter simply stops, and when it comes
      // back it is in front of you. (Adding a cue here would be the third time
      // this project answered a state change with more noise instead of a
      // legible one.)
      const hush = e.hushT > 0 ? 0 : 1;
      e.loop.setState(level * hush, reveal * hush, pressure * hush, rear * hush);
    }
    return { level, dir: toE.clone() };
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
    // The house keeps score, but a long night cannot grow the scene forever.
    // The bounded ring preserves every normal grave fight and recycles only the
    // oldest history after exceptional repeat deaths or long debug sessions.
    this._placeStain(e.pos);
    game.flag('firstPop');
    // popping is loud. everything nearby turns toward the sound.
    this.wakeAll(e.pos.x, e.pos.z, 30);
    if (game.director) game.director.onPop(e);
  }

  _layToRest(e) {
    if (!e || e.state === 'dying') return false;
    const game = this.game;
    this._releaseGraveClaim(e, 0.78);
    e.state = 'dying';
    e.quietRest = true;
    e.deadT = 0.9;
    e.restGround = game.world.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1);
    e.pos.y = e.restGround;
    e.deadV = new THREE.Vector3();
    if (e.loop) { e.loop.stop(); e.loop = null; }
    game.flag('firstRest');
    game.audio.stoneGrind({ pos: e.pos, gain: 0.26, rate: 1.9, verb: 0.7 });
    game.audio.walkerMiss({ pos: e.pos, gain: 0.32, rate: 0.62, verb: 0.55 });
    return true;
  }

  // Real routing over the house's own cell graph (world.houseNav), replacing
  // blind steering toward whichever door happened to be open. BFS on a grid
  // this small (a few hundred cells) costs nothing, runs only on re-plan, and
  // returns the first few DOORWAYS along the path — the only waypoints a
  // straight-line steerer needs. The storeys are one graph now: a registered
  // stair link is one extra passable edge, and crossing it emits BOTH of the
  // flight's centreline waypoints so the body walks the axis of the run while
  // groundHeightAt carries its y — the same ground-height walk the player
  // uses. `exclude` is the one-entry memory that stops a body oscillating
  // back through the door it just used; stair edges never carry doors, so the
  // exclusion passes through them untouched.
  _houseRoute(e, { exclude = null } = {}) {
    const world = this.game.world;
    const player = this.game.player;
    const from = world.houseCellAt(e.pos.x, e.pos.z, e.pos.y);
    const to = world.houseCellAt(player.pos.x, player.pos.z, player.pos.y);
    if (!from || !to) return null;
    const nav = world.houseNav;
    const canOpen = e.kind === 'resident';
    const start = from.lv + '|' + from.cx + ',' + from.cz;
    const goal = to.lv + '|' + to.cx + ',' + to.cz;
    if (start === goal) return [];
    const prev = new Map([[start, null]]);
    const queue = [start];
    const DIRS = [['N', 0, -1], ['S', 0, 1], ['W', -1, 0], ['E', 1, 0]];
    let found = false;
    while (queue.length && !found) {
      const key = queue.shift();
      const [lv, cell] = key.split('|');
      const [cx, cz] = cell.split(',').map(Number);
      for (const [dir, dx, dz] of DIRS) {
        if (!world.housePassable(lv, cx, cz, dir, canOpen, exclude)) continue;
        const nk = lv + '|' + (cx + dx) + ',' + (cz + dz);
        if (prev.has(nk)) continue;
        prev.set(nk, key);
        if (nk === goal) { found = true; break; }
        queue.push(nk);
      }
      if (found) break;
      // the stair edge: when this cell is a registered flight end, the far
      // end of the flight is one more neighbour
      const links = nav.levels[lv]?.stairAt?.get(cell);
      if (!links) continue;
      for (const link of links) {
        const here = link.lo.lv === lv && link.lo.cx + ',' + link.lo.cz === cell;
        const other = here ? link.hi : link.lo;
        const nk = other.lv + '|' + other.cx + ',' + other.cz;
        if (prev.has(nk)) continue;
        prev.set(nk, key);
        if (nk === goal) { found = true; break; }
        queue.push(nk);
      }
    }
    if (!found) return null;
    // walk the path back and collect the doorways and flights it crosses,
    // nearest first
    const path = [];
    for (let k = goal; k; k = prev.get(k)) path.push(k);
    path.reverse();
    const waypoints = [];
    for (let i = 1; i < path.length && waypoints.length < 4; i++) {
      const [alv, acell] = path[i - 1].split('|');
      const [blv, bcell] = path[i].split('|');
      if (alv !== blv) {
        // a stair hop: emit both centreline waypoints in traversal order —
        // unless the body is ALREADY on this flight, in which case only the
        // far end matters (walking back to the near end first read as the
        // dithering it was)
        const link = (nav.levels[alv].stairAt.get(acell) || []).find((l) =>
          (l.lo.lv === alv && l.lo.cx + ',' + l.lo.cz === acell && l.hi.lv === blv && l.hi.cx + ',' + l.hi.cz === bcell)
          || (l.hi.lv === alv && l.hi.cx + ',' + l.hi.cz === acell && l.lo.lv === blv && l.lo.cx + ',' + l.lo.cz === bcell));
        if (!link) continue;
        const ascending = link.lo.lv === alv && link.lo.cx + ',' + link.lo.cz === acell;
        const near = ascending ? link.lo : link.hi;
        const far = ascending ? link.hi : link.lo;
        const onThisFlight = i === 1 && from.stair === link.id;
        if (!onThisFlight) {
          waypoints.push({ x: near.pos.x, z: near.pos.z, y: near.y, stair: link.id });
        }
        if (waypoints.length < 4) {
          waypoints.push({ x: far.pos.x, z: far.pos.z, y: far.y, stair: link.id });
        }
        continue;
      }
      const [ax, az] = acell.split(',').map(Number);
      const [bx, bz] = bcell.split(',').map(Number);
      const o = az === bz ? 'V' : 'H';
      const ex = o === 'V' ? Math.max(ax, bx) : ax;
      const ez = o === 'H' ? Math.max(az, bz) : az;
      const door = nav.levels[alv].doorAt.get(o + '|' + ex + ',' + ez);
      if (door) {
        waypoints.push({ x: door.center.x, z: door.center.z, door });
        if (waypoints.length < 4) {
          // the punch-through point: 0.7 m past the plane on the exit side.
          // The 0.9 m consume radius can claim a door's centre from the
          // WRONG side of the wall; without this the next leg aimed
          // diagonally through the plaster beside the aperture and the body
          // pinned there, replanned around, and orbited the room forever —
          // Alex's "can't find his way to you", reproduced verbatim.
          waypoints.push({
            x: door.center.x + (o === 'V' ? Math.sign(bx - ax) * 0.7 : 0),
            z: door.center.z + (o === 'H' ? Math.sign(bz - az) * 0.7 : 0),
            door, exit: true,
            nx: o === 'V' ? Math.sign(bx - ax) : 0,
            nz: o === 'H' ? Math.sign(bz - az) : 0,
          });
        }
      }
    }
    return waypoints;
  }

  // A door closed in a pursuer's face is a purchase, not a wall. Clear the
  // route (it was planned through a doorway that no longer passes) and put
  // the knob-turn on a stagger so the slam visibly bought time.
  onDoorClosed(door) {
    for (const e of this.list) {
      if (e.state !== 'chase' && e.state !== 'stalk') continue;
      if (Math.abs(door.floor - e.pos.y) > 1.8) continue;
      if (Math.hypot(door.center.x - e.pos.x, door.center.z - e.pos.z) > 2.2) continue;
      e._doorT = -0.6;
      e._doorTold = false;
      e._route = null;
      e._via = null;
      e._viaLast = door;
    }
  }

  // Has the body reached its current steering waypoint? Plain waypoints use
  // the 0.9 m radius. Door EXIT points are directional: they count only once
  // the body is genuinely THROUGH the plane — a radius that large can claim
  // a point on the far side of a wall from the near side, and a door marked
  // "crossed" while the body still stands outside it poisons both the next
  // leg and the one-entry exclusion memory.
  _viaReached(e) {
    const via = e._via;
    if (!via) return false;
    if (via.exit && via.door) {
      return (e.pos.x - via.door.center.x) * (via.nx || 0)
        + (e.pos.z - via.door.center.z) * (via.nz || 0) >= 0.35;
    }
    return Math.hypot(via.x - e.pos.x, via.z - e.pos.z) < 0.9;
  }

  // The Standing Kind's observed test, shared: the view cone, then a
  // throttled structural line-of-sight (shut doors and walls freeze sight;
  // an open door's collapsed collider or an open window does not), with the
  // per-enemy hysteresis fields. The house watchdog's unseen-only relocate
  // uses this SAME machinery — one law for "it never moves while seen".
  _isObserved(e, dt, camPos, camFwd) {
    const toE = V.d.set(e.pos.x - camPos.x, 0, e.pos.z - camPos.z);
    const d2 = toE.length();
    const inView = d2 < 42 && camFwd.dot(toE.divideScalar(Math.max(d2, 0.001))) > 0.28;
    if (!inView) {
      e._losT = 0;
      e._losClear = false;
      return false;
    }
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
    return !!e._losClear;
  }

  // A walker whose route to the player is provably sealed (every path ends
  // at a door it cannot work) stops grinding the panel and besieges instead:
  // it will hold just off the nearest shut door and paw it on a slow cadence.
  // Only called when _houseRoute returned null; only arms when both bodies
  // actually resolve on the graph — outside the house nothing changes.
  _besiegeSetup(e) {
    const world = this.game.world;
    const player = this.game.player;
    if (!world.houseCellAt(e.pos.x, e.pos.z, e.pos.y)) return;
    if (!world.houseCellAt(player.pos.x, player.pos.z, player.pos.y)) return;
    let best = null, bestD = 4;
    for (const d of world.doors) {
      if (d.open) continue;
      if (Math.abs(d.floor - e.pos.y) > 1.8) continue;
      const dd = Math.hypot(d.center.x - e.pos.x, d.center.z - e.pos.z);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    if (!best) return;
    // hold 0.6 m off the panel, on this body's own side of the wall
    const H = best.edge?.orient === 'H';
    const side = H
      ? Math.sign(e.pos.z - best.center.z) || 1
      : Math.sign(e.pos.x - best.center.x) || 1;
    e._besiege = {
      door: best,
      x: best.center.x + (H ? 0 : side * 0.6),
      z: best.center.z + (H ? side * 0.6 : 0),
    };
    e._route = null;
    e._via = null;
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
      // A slam in its face sets _doorT negative (onDoorClosed): the shut is a
      // purchased delay, so the commitment restarts from further back.
      e._doorT = (e._doorT || 0) + dt;
      // The tell Alex asked for and only half received (playtest 2: "you shut
      // the door, silence, then the knob turns"): silence, THEN the knob
      // visibly works before the panel moves. Motion + sound, no words.
      if (e._doorT > 0.55 && !e._doorTold) {
        e._doorTold = true;
        door.rattleT = Math.max(door.rattleT || 0, 0.5);
        this.game.audio.lockedRattle({ pos: door.group.position, gain: 0.6, rate: 0.7 });
      }
      if (e._doorT > 1.15) {
        e._doorT = 0;
        e._doorTold = false;
        door.setOpen(true);
        this.game.audio.doorOpen(true, { pos: door.group.position });
      }
    } else {
      e._doorT = Math.min(e._doorT || 0, 0);   // keep a slam's stagger ticking down
      e._doorTold = false;
    }
  }

  _poseWalker(e, dt, claimed) {
    const W = e.mesh.userData.walker;
    if (!W) return;
    const striking = e.state === 'strike'
      ? smoothstep(0, 1, clamp((e.strikeT || 0) / (e.spec.strike || 0.66), 0, 1))
      : 0;
    const winding = e.state === 'wind'
      ? clamp((e.windT || 0) / Math.max(0.001, e.spec.windup), 0, 1)
      : 0;
    const stunned = e.state === 'stunned' ? 1 : 0;
    const awake = e.state !== 'dormant' && e.state !== 'dying' ? 1 : 0;
    const attacker = claimed && awake ? 1 : 0;
    const twitchRate = e.state === 'strike' ? 14 : e.state === 'chase' ? 10 : e.state === 'wind' ? 6 : 3.5;
    const twitch = awake ? steppedJerk(this.game.time, e.serial, twitchRate, 0) : 0;
    const shoulderJerk = awake ? steppedJerk(this.game.time, e.serial, twitchRate * 0.72, 1) : 0;
    const sway = Math.sin(e.phase * 1.73 + e.serial * 0.91);
    const chatter = awake * Math.max(0, Math.sin(e.phase * 3.1 + e.serial)) ** 5;

    // An assigned attacker uncocks its mask and broadens the corpse's two
    // uneven shoulders. The rest keep the sideways death-mask angle, so the
    // token can be read through posture and tiny socket glints, never color.
    // The rest keep the sideways corpse angle, so the token can be read through
    // posture and brightness without an outline, marker, or color swap.
    W.head.position.set(
      W.headBase.x + twitch * 0.012,
      W.headBase.y - stunned * 0.16 + striking * 0.035,
      W.headBase.z + winding * 0.05 + striking * 0.15,
    );
    W.head.rotation.set(
      W.headRot.x - winding * 0.08 - striking * 0.22 + stunned * 0.24,
      twitch * (0.035 + attacker * 0.025),
      W.headRot.z * (1 - attacker * 0.78) + twitch * 0.025 + stunned * 0.22,
    );
    W.mouth.scale.set(
      W.mouth.userData.baseScale.x * (1 + striking * 0.24),
      W.mouth.userData.baseScale.y * (1 + chatter * 0.25 + winding * 0.35 + striking * 1.85),
      W.mouth.userData.baseScale.z,
    );
    W.jaw.position.set(
      W.jaw.userData.basePosition.x + striking * 0.018,
      W.jaw.userData.basePosition.y - winding * 0.012 - striking * 0.075,
      W.jaw.userData.basePosition.z + striking * 0.025,
    );
    W.jaw.rotation.set(
      W.jaw.userData.baseRotation.x + striking * 0.12,
      W.jaw.userData.baseRotation.y,
      W.jaw.userData.baseRotation.z + winding * 0.08 + striking * 0.2,
    );
    for (const eye of W.eyes) {
      eye.scale.set(
        eye.userData.baseScale.x * (1 + attacker * 0.68 + striking * 0.3),
        eye.userData.baseScale.y * (1 + attacker * 0.22 + striking * 0.48),
        eye.userData.baseScale.z,
      );
    }
    for (const [index, shoulder] of W.shoulders.entries()) {
      shoulder.scale.set(
        shoulder.userData.baseScale.x * (1 + attacker * (index ? 0.12 : 0.18) + striking * 0.16),
        shoulder.userData.baseScale.y * (1 + attacker * 0.06),
        shoulder.userData.baseScale.z,
      );
      const base = shoulder.userData.baseRotation;
      shoulder.rotation.set(
        base.x + shoulderJerk * (0.012 + attacker * 0.014),
        base.y,
        base.z + shoulderJerk * (index ? -0.026 : 0.036) * (1 + attacker * 0.5),
      );
    }
    // Pressure bodies keep their forearms below and outside the pall. Only the
    // committed strike snaps them fully at the camera; the hooks are therefore
    // readable before impact instead of materializing on the lethal frame.
    if (e.state === 'chase') {
      const arms = e.mesh.userData.limbs.arms;
      arms[0].rotation.x = -0.58 + Math.sin(e.phase * 2) * 0.08;
      arms[1].rotation.x = -0.68 - Math.sin(e.phase * 2) * 0.08;
    } else if (e.state === 'wind') {
      const arms = e.mesh.userData.limbs.arms;
      arms[0].rotation.x = -0.32 - winding * 0.22;
      arms[1].rotation.x = -0.42 - winding * 0.2;
    }
    // Cloth keeps a slow secondary sway; only the head and shoulder bones use
    // held stop-motion snaps, so locomotion never inherits fake frame drops.
    W.shroud.rotation.z = sway * (0.018 + (e.state === 'chase' ? 0.04 : 0.012));
    W.shroud.rotation.x = -0.08 - striking * 0.1;
  }

  _poseMalformed(e) {
    const A = e.mesh.userData.head?.userData.anatomy;
    if (!A) return;
    const striking = e.state === 'strike'
      ? smoothstep(0, 1, clamp((e.strikeT || 0) / (e.spec.strike || 0.66), 0, 1))
      : 0;
    const winding = e.state === 'wind'
      ? clamp((e.windT || 0) / Math.max(0.001, e.spec.windup), 0, 1)
      : 0;
    const stunned = e.state === 'stunned' ? 1 : 0;
    const awake = e.state !== 'dormant' && e.state !== 'dying' ? 1 : 0;
    const aggressive = e.state === 'chase' || e.state === 'wind' || e.state === 'strike' ? 1 : 0;
    const rate = e.state === 'strike' ? 13 : e.state === 'chase' ? 8.5 : e.state === 'wind' ? 5.5 : 3;
    const headJerk = awake ? steppedJerk(this.game.time, e.serial, rate, 2) : 0;
    const shoulderJerk = awake ? steppedJerk(this.game.time, e.serial, rate * 0.68, 3) : 0;

    if (A.kind === 'resident') {
      // The face remains trapped under the high shoulder until commitment,
      // when it pushes forward and the apparently ordinary coat seam parts.
      A.head.position.set(
        A.headBase.x + headJerk * 0.012,
        A.headBase.y - stunned * 0.1 + striking * 0.025,
        A.headBase.z + winding * 0.045 + striking * 0.115,
      );
      A.head.rotation.set(
        A.headRot.x - winding * 0.055 - striking * 0.16 + stunned * 0.2,
        A.headRot.y + headJerk * (0.025 + aggressive * 0.022),
        A.headRot.z + headJerk * 0.038 + stunned * 0.16,
      );

      const yokeScale = A.yoke.userData.baseScale;
      A.yoke.scale.set(
        yokeScale.x * (1 + winding * 0.04 + striking * 0.09),
        yokeScale.y * (1 + striking * 0.08),
        yokeScale.z,
      );
      const yokeRot = A.yoke.userData.baseRotation;
      A.yoke.rotation.set(
        yokeRot.x + shoulderJerk * 0.016,
        yokeRot.y,
        yokeRot.z + shoulderJerk * 0.025 - striking * 0.08,
      );
      const humpScale = A.hump.userData.baseScale;
      A.hump.scale.set(
        humpScale.x * (1 + winding * 0.05 + striking * 0.12),
        humpScale.y * (1 + striking * 0.07),
        humpScale.z,
      );
      const humpRot = A.hump.userData.baseRotation;
      A.hump.rotation.set(
        humpRot.x + shoulderJerk * 0.02,
        humpRot.y,
        humpRot.z - shoulderJerk * 0.03 + striking * 0.06,
      );

      const open = winding * 0.24 + striking;
      const seamScale = A.seam.userData.baseScale;
      A.seam.scale.set(
        seamScale.x * (1 + open * 0.95),
        seamScale.y * (1 + open * 0.28),
        seamScale.z,
      );
      const latchBase = A.latch.userData.basePosition;
      A.latch.position.set(
        latchBase.x + open * 0.025,
        latchBase.y - open * 0.018,
        latchBase.z + open * 0.006,
      );
      const latchRot = A.latch.userData.baseRotation;
      A.latch.rotation.set(latchRot.x, latchRot.y, latchRot.z - open * 0.62);
      return;
    }

    if (A.kind === 'kneeler') {
      // The Kneeler does not become a faster animation when angry. Its hanging
      // head advances, its shoulder burden torques, and the sideways jaw opens;
      // the lethal root lunge remains wholly owned by the existing state machine.
      A.head.position.set(
        A.headBase.x + headJerk * 0.01,
        A.headBase.y - stunned * 0.075 - winding * 0.025 + striking * 0.025,
        A.headBase.z + winding * 0.05 + striking * 0.13,
      );
      A.head.rotation.set(
        A.headRot.x - winding * 0.08 - striking * 0.21 + stunned * 0.16,
        A.headRot.y + headJerk * (0.02 + aggressive * 0.025),
        A.headRot.z + headJerk * 0.045 + stunned * 0.11,
      );

      const yokeScale = A.yoke.userData.baseScale;
      A.yoke.scale.set(
        yokeScale.x * (1 + winding * 0.05 + striking * 0.1),
        yokeScale.y * (1 + striking * 0.07),
        yokeScale.z,
      );
      const yokeRot = A.yoke.userData.baseRotation;
      A.yoke.rotation.set(
        yokeRot.x + shoulderJerk * 0.018,
        yokeRot.y,
        yokeRot.z + shoulderJerk * 0.028 - striking * 0.07,
      );
      const humpScale = A.hump.userData.baseScale;
      A.hump.scale.set(
        humpScale.x * (1 + winding * 0.04 + striking * 0.1),
        humpScale.y * (1 + striking * 0.09),
        humpScale.z,
      );
      const humpRot = A.hump.userData.baseRotation;
      A.hump.rotation.set(
        humpRot.x - shoulderJerk * 0.018,
        humpRot.y,
        humpRot.z - shoulderJerk * 0.024 + striking * 0.055,
      );

      const open = winding * 0.22 + striking;
      const mouthScale = A.mouth.userData.baseScale;
      A.mouth.scale.set(
        mouthScale.x * (1 + open * 0.42),
        mouthScale.y * (1 + open * 1.35),
        mouthScale.z,
      );
      const jawBase = A.jaw.userData.basePosition;
      A.jaw.position.set(
        jawBase.x + open * 0.018,
        jawBase.y - open * 0.055,
        jawBase.z + open * 0.018,
      );
      const jawRot = A.jaw.userData.baseRotation;
      A.jaw.rotation.set(
        jawRot.x + open * 0.2,
        jawRot.y,
        jawRot.z + open * 0.18,
      );
      for (const [index, forearm] of A.forearms.entries()) {
        const base = forearm.userData.baseRotation;
        forearm.rotation.set(
          base.x - open * (index ? 0.22 : 0.29),
          base.y,
          base.z + (index ? -1 : 1) * open * 0.1,
        );
      }
    }
  }

  _graveMausoleumAt(pos) {
    // outside.js exposes the authored landmark groups. Identify the two hollow
    // groups by the flag it sets on them instead of duplicating their
    // coordinates here; pits are meshes and therefore cannot be mistaken for
    // rooms. (The flag replaced a child count, which stopped telling the truth
    // once the pair were batched down to two meshes each.)
    for (const landmark of this.game.graveLandmarks || []) {
      if (!landmark.isGroup || !landmark.userData.mausoleumRoom) continue;
      if (Math.abs(pos.x - landmark.position.x) < 1.38
        && pos.z > landmark.position.z - 1.34
        && pos.z < landmark.position.z + 1.38) return landmark;
    }
    return null;
  }

  _graveEscapeTarget(e, playerPos) {
    const inside = this._graveMausoleumAt(e.pos);
    const playerInside = this._graveMausoleumAt(playerPos);
    if (inside && playerInside === inside) {
      e._graveEscape = null;
      return null;
    }
    if (inside && (!e._graveEscape || e._graveEscape.room !== inside)) {
      const dx = playerPos.x - inside.position.x;
      e._graveEscape = {
        room: inside,
        phase: 'door',
        side: Math.abs(dx) > 0.3 ? Math.sign(dx) : (e.orbitSign || 1),
      };
      e._via = null;
    }
    const route = e._graveEscape;
    if (!route) return null;
    const center = route.room.position;
    let target;
    if (route.phase === 'door') {
      target = { x: center.x, z: center.z - 2.22 };
      if (Math.hypot(e.pos.x - target.x, e.pos.z - target.z) < 0.48) route.phase = 'front';
    }
    if (route.phase === 'front') {
      target = { x: center.x + route.side * 2.35, z: center.z - 2.24 };
      if (Math.hypot(e.pos.x - target.x, e.pos.z - target.z) < 0.55) {
        if (playerPos.z > center.z + 1.35) route.phase = 'rear';
        else {
          e._graveEscape = null;
          return null;
        }
      }
    }
    if (route.phase === 'rear') {
      target = { x: center.x + route.side * 2.38, z: center.z + 2.25 };
      if (Math.hypot(e.pos.x - target.x, e.pos.z - target.z) < 0.58) {
        e._graveEscape = null;
        return null;
      }
    }
    return target;
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

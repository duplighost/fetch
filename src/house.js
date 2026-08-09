// house.js — Acts 0-2: the bedroom, the house, the basement.
// Declarative tables for the world compiler + furnishing + the act-gating props.
// Grid: origin (-12,-14), 12x10 cells of 2m. Backyard begins at world z=6.
import * as THREE from 'three';
import { clamp, TAU } from './util.js';
import { Mirror, Mirrors, LAYER_DOUBLE, MASK_DOUBLE } from './mirrors.js';

export const HOUSE_TABLES = {
  origin: [-12, -14],
  levels: {
    basement: { floor: -3.0, ceil: -0.55 },
    ground: { floor: 0, ceil: 3.3 },
    first: { floor: 3.6, ceil: 6.4 },
  },
  rooms: [
    // ---- ground ----
    ['living',   0, 0, 3, 4, 'ground', { wall: 'wallpaper', floor: 'woodFloor' }],
    ['study',    0, 5, 3, 9, 'ground', { wall: 'wallpaperRot', floor: 'woodFloor' }],
    ['foyer',    4, 0, 5, 5, 'ground', { wall: 'wallpaper', floor: 'woodFloor' }],
    ['entry',    6, 0, 7, 1, 'ground', { wall: 'wallpaper', floor: 'woodFloor' }],
    ['stairbay', 6, 2, 7, 5, 'ground', { wall: 'wallpaper', floor: 'woodFloor' }],
    ['backhall', 4, 6, 7, 9, 'ground', { wall: 'wallpaperRot', floor: 'woodFloor' }],
    ['dining',   8, 0, 11, 3, 'ground', { wall: 'wallpaper', floor: 'woodFloor' }],
    ['kitchen',  8, 4, 11, 7, 'ground', { wall: 'plaster', floor: 'stone' }],
    ['scullery', 8, 8, 9, 9, 'ground', { wall: 'plaster', floor: 'stone' }],
    ['cellarShaft', 10, 8, 11, 9, 'ground', { wall: 'plaster', floor: 'stone' }],
    // ---- first ----
    ['nursery',  0, 6, 3, 9, 'first', { wall: 'wallpaperRot', floor: 'woodFloor' }],
    ['landing',  4, 7, 7, 9, 'first', { wall: 'wallpaper', floor: 'woodFloor' }],
    ['stairwell', 6, 2, 7, 6, 'first', { wall: 'wallpaper', floor: 'woodFloor' }],
    ['guest',    8, 2, 11, 5, 'first', { wall: 'wallpaperRot', floor: 'woodFloor' }],
    ['bedroom',  8, 6, 11, 9, 'first', { wall: 'wallpaper', floor: 'woodFloor' }],
    // ---- basement ----
    ['bcorr',    4, 8, 11, 9, 'basement', { wall: 'stone', floor: 'dirt' }],
    ['storeroom', 4, 4, 7, 7, 'basement', { wall: 'brick', floor: 'dirt' }],
    ['boiler',   8, 4, 11, 7, 'basement', { wall: 'brick', floor: 'stone' }],
    ['crawl',    0, 2, 3, 7, 'basement', { wall: 'stone', floor: 'dirt' }],
    ['hatchbay', 0, 8, 3, 9, 'basement', { wall: 'stone', floor: 'dirt' }],
    // The under-house did not stop at the foundation. A flooded pump gallery
    // and blind archive run west beneath ground that looks empty from outside.
    ['pumpGallery', -4, 2, -1, 7, 'basement', { wall: 'brick', floor: 'stone' }],
    ['blindArchive', -4, 8, -1, 9, 'basement', { wall: 'stone', floor: 'stone' }],
  ],
  doors: [
    // ground
    ['ground', 5, 0, 'N', { id: 'frontDoor', locked: 'never', heavy: true }],
    ['ground', 4, 2, 'W', {}],                    // foyer -> living (closed: scare fodder)
    ['ground', 4, 7, 'W', {}],                    // backhall -> study (closed)
    ['ground', 6, 1, 'W', { ajar: true }],        // entry -> foyer
    ['ground', 8, 1, 'W', { ajar: true }],        // dining -> entry
    ['ground', 6, 2, 'N', { ajar: true }],        // entry -> stairbay (foot of the stairs)
    ['ground', 5, 6, 'N', { ajar: true }],        // foyer -> backhall
    ['ground', 8, 6, 'W', { ajar: true }],        // kitchen -> backhall
    ['ground', 8, 8, 'W', {}],                    // scullery -> backhall (closed)
    ['ground', 9, 4, 'N', { ajar: true }],        // kitchen -> dining
    ['ground', 10, 8, 'N', { id: 'cellarDoor', locked: 'boards', heavy: true }], // kitchen -> cellar stairs
    // first
    ['first', 8, 7, 'W', { id: 'bedroomDoor', locked: 'bedroomKey' }],  // bedroom -> landing
    ['first', 4, 7, 'W', { ajar: true }],         // landing -> nursery
    ['first', 6, 7, 'N', { id: 'stairDoor', locked: 'stairKey' }],      // landing -> stairwell
    ['first', 8, 3, 'W', { id: 'voidDoor' }],     // guest -> the door over the stair void
    // basement
    ['basement', 5, 8, 'N', { ajar: true }],      // bcorr -> storeroom
    ['basement', 8, 5, 'W', { heavy: true }],     // storeroom -> boiler (closed: the key room)
    ['basement', 4, 5, 'W', { ajar: true }],      // storeroom -> crawl
    ['basement', 1, 8, 'N', { ajar: true }],      // crawl -> hatchbay
    ['basement', 0, 5, 'W', { ajar: true, heavy: true, id: 'pumpGalleryDoor' }], // crawl -> old pump works
    ['basement', -4, 8, 'N', { ajar: true }],     // far bank -> blind archive
  ],
  windows: [
    ['ground', 1, 0, 'N', {}],
    ['ground', 0, 2, 'W', { open: true, id: 'livingRelayWindow' }],
    ['ground', 0, 7, 'W', { open: true, id: 'studyRelayWindow' }],
    ['ground', 11, 1, 'E', {}], ['ground', 11, 5, 'E', {}],
    ['ground', 9, 9, 'S', {}],
    ['first', 1, 9, 'S', {}], ['first', 11, 3, 'E', {}],
    ['first', 9, 9, 'S', { open: true, w: 1.7, id: 'bedroomWindow' }],   // THE window
    ['first', 5, 9, 'S', {}],
  ],
  ramps: [
    { id: 'mainStairs', x0: 6, x1: 7, z0: 2, z1: 5, axis: 'z', y0: 0, y1: 3.6, mat: 'woodDark' },   // main stairs (up toward the back)
    {
      id: 'cellarStairs', x0: 10, x1: 11, z0: 8, z1: 8.25,
      axis: 'z', y0: 0, y1: -2.0, mat: 'stone', guardMat: 'metal',
      openUnder: true, edgeGuards: true, guardHeight: 0.78, edgeOpenAtEnd: 2,
    },   // thin hanging flight to an honest side landing
    {
      id: 'cellarReturn', x0: 8, x1: 9, z0: 9, z1: 9,
      axis: 'x', y0: -3.0, y1: -2.0, mat: 'stone',
    },   // westbound return flight reaches basement floor instead of a side-drop exploit
  ],
  floorHoles: [
    ['first', 6, 2, 7, 5],       // main stair shaft through first floor
    ['ground', 10, 8, 11, 9],    // cellar stair shaft through ground floor
  ],
  ceilHoles: [
    ['ground', 6, 2, 7, 5],      // stairbay looks up the shaft
    ['basement', 10, 8, 11, 9],  // bcorr east end looks up the cellar shaft
    ['basement', 8, 9, 9, 9],    // headroom above the lower return flight
  ],
};

// ---------------------------------------------------------------- furnishing kit
// The first pass used one box per piece of furniture.  This kit keeps the
// donor games' cheap primitive vocabulary, but assembles it into furniture
// with an actual silhouette: turned legs, posts, rails, panels, cushions,
// handles, moulding, fabric folds and lived-in surface clutter.  Box pieces go
// through World.box so the whole house still merges to a handful of draws.
function createFurnitureKit(game) {
  const { world, scene, mats: M } = game;
  const tint = (base, hex) => {
    const m = base.clone();
    m.color.setHex(hex);
    return m;
  };
  const D = {
    wood: M.woodDark,
    woodMid: tint(M.woodDark, 0x8a6a4b),
    woodPale: tint(M.woodDark, 0xb09670),
    linen: tint(M.curtain, 0xb7ad9d),
    linenDirty: tint(M.curtain, 0x817b70),
    upholstery: tint(M.curtain, 0x535f62),
    upholsteryDark: tint(M.curtain, 0x30383b),
    rug: tint(M.carpet, 0x667174),
    rugEdge: tint(M.carpet, 0x252c30),
    brass: new THREE.MeshStandardMaterial({ color: 0xa98748, roughness: 0.34, metalness: 0.78 }),
    iron: M.metal,
    // Soot, not polished iron: the carried point light is intentionally fierce
    // and made an ordinary metal flue flare back into Alex's pale ceiling fang.
    flue: new THREE.MeshBasicMaterial({ color: 0x070909 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9aa8aa, roughness: 0.16, metalness: 0.12, transparent: true, opacity: 0.46 }),
    black: new THREE.MeshLambertMaterial({ color: 0x030303 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xb4aa91, roughness: 0.94 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xb7b1a2, roughness: 0.72 }),
    books: [0x554238, 0x283f45, 0x6b6249, 0x342f36, 0x78654e].map((color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.86 })),
  };
  const Y_AXIS = new THREE.Vector3(0, 1, 0);

  const frame = (x, y, z, ry = 0) => ({ x, y, z, ry });
  const worldXZ = (f, x, z) => ({
    x: f.x + Math.cos(f.ry) * x + Math.sin(f.ry) * z,
    z: f.z - Math.sin(f.ry) * x + Math.cos(f.ry) * z,
  });
  const box = (f, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) => {
    const p = worldXZ(f, x, z);
    world.box(mat, p.x, f.y + y, p.z, w, h, d, f.ry + ry);
  };
  const mesh = (f, geometry, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true) => {
    const o = new THREE.Mesh(geometry, mat);
    const p = worldXZ(f, x, z);
    o.position.set(p.x, f.y + y, p.z);
    const base = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, f.ry);
    const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    o.quaternion.copy(base).multiply(local);
    o.castShadow = cast;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  };
  const cylinder = (f, r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 8, rx = 0, ry = 0, rz = 0) =>
    mesh(f, new THREE.CylinderGeometry(r0, r1, h, seg), mat, x, y, z, rx, ry, rz);
  const sphere = (f, r, mat, x, y, z, sx = 1, sy = 1, sz = 1, seg = 10) => {
    const o = mesh(f, new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  };

  const makePaintingMaterial = (seed) => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 160;
    const g = c.getContext('2d');
    let s = seed >>> 0;
    const r = () => { s = Math.imul(s ^ (s >>> 15), 1 | s); s ^= s + Math.imul(s ^ (s >>> 7), 61 | s); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; };
    const sky = g.createLinearGradient(0, 0, 0, 160);
    sky.addColorStop(0, '#1a2328'); sky.addColorStop(0.58, '#4b4b43'); sky.addColorStop(1, '#181714');
    g.fillStyle = sky; g.fillRect(0, 0, 128, 160);
    g.fillStyle = 'rgba(214,205,178,.22)';
    g.beginPath(); g.arc(84 + r() * 18, 40 + r() * 15, 13 + r() * 8, 0, Math.PI * 2); g.fill();
    for (let layer = 0; layer < 4; layer++) {
      g.fillStyle = ['#4a4a43', '#353b37', '#242c29', '#171c1b'][layer];
      g.beginPath(); g.moveTo(0, 92 + layer * 15);
      for (let x = 0; x <= 128; x += 16) g.lineTo(x, 74 + layer * 16 + r() * 24);
      g.lineTo(128, 160); g.lineTo(0, 160); g.closePath(); g.fill();
    }
    g.globalAlpha = 0.12; g.fillStyle = '#d8ccb0';
    for (let i = 0; i < 180; i++) g.fillRect(r() * 128, r() * 160, 1, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88 });
  };
  const art = [31, 71, 131, 251, 509].map(makePaintingMaterial);

  function rug(x, y, z, w, d, ry = 0) {
    const f = frame(x, y, z, ry);
    box(f, w, 0.018, d, D.rug, 0, 0.012, 0);
    box(f, w, 0.01, 0.09, D.rugEdge, 0, 0.025, -d / 2 + 0.055);
    box(f, w, 0.01, 0.09, D.rugEdge, 0, 0.025, d / 2 - 0.055);
    box(f, 0.09, 0.01, d, D.rugEdge, -w / 2 + 0.055, 0.025, 0);
    box(f, 0.09, 0.01, d, D.rugEdge, w / 2 - 0.055, 0.025, 0);
    for (let i = 0; i < Math.max(4, Math.round(w / 0.22)); i++) {
      const fx = -w / 2 + 0.12 + i * ((w - 0.24) / Math.max(1, Math.round(w / 0.22) - 1));
      box(f, 0.018, 0.008, 0.14, D.linenDirty, fx, 0.011, -d / 2 - 0.05);
      box(f, 0.018, 0.008, 0.14, D.linenDirty, fx, 0.011, d / 2 + 0.05);
    }
  }

  function bed(x, y, z, ry = 0, w = 1.55, len = 2.15) {
    const f = frame(x, y, z, ry);
    box(f, w, 0.2, len, D.wood, 0, 0.3, 0);
    box(f, w - 0.08, 0.19, len - 0.12, D.linenDirty, 0, 0.48, 0.02);
    box(f, w - 0.12, 0.08, len * 0.58, D.linen, 0, 0.625, 0.38);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const h = sz < 0 ? 1.62 : 1.25;
      cylinder(f, 0.045, 0.06, h, D.wood, sx * (w / 2 + 0.025), h / 2, sz * (len / 2 + 0.025), 9);
      sphere(f, 0.075, D.woodMid, sx * (w / 2 + 0.025), h + 0.035, sz * (len / 2 + 0.025), 1, 1.15, 1, 9);
    }
    box(f, w + 0.1, 0.08, 0.08, D.woodMid, 0, 1.36, -len / 2);
    box(f, w - 0.08, 0.07, 0.07, D.woodMid, 0, 0.82, -len / 2);
    for (let i = -3; i <= 3; i++) box(f, 0.035, 0.52, 0.04, D.woodPale, i * (w - 0.18) / 7, 1.08, -len / 2 + 0.035);
    sphere(f, 0.28, D.linen, -w * 0.23, 0.68, -len * 0.31, 1.25, 0.34, 0.72, 12);
    sphere(f, 0.28, D.linen, w * 0.23, 0.68, -len * 0.31, 1.25, 0.34, 0.72, 12);
    return f;
  }

  function wardrobe(x, y, z, ry = 0, w = 1.42, h = 2.18) {
    const f = frame(x, y, z, ry);
    box(f, w, h, 0.11, D.wood, 0, h / 2, -0.25);
    box(f, 0.1, h, 0.62, D.wood, -w / 2 + 0.05, h / 2, 0);
    box(f, 0.1, h, 0.62, D.wood, w / 2 - 0.05, h / 2, 0);
    box(f, w, 0.1, 0.62, D.wood, 0, 0.08, 0);
    box(f, w + 0.14, 0.1, 0.7, D.woodMid, 0, h + 0.035, 0);
    box(f, w + 0.08, 0.12, 0.68, D.woodMid, 0, 0.12, 0);
    for (const sx of [-1, 1]) {
      box(f, w * 0.43, h - 0.3, 0.055, D.woodMid, sx * w * 0.23, h / 2 + 0.02, 0.325);
      box(f, w * 0.33, h * 0.36, 0.025, D.woodPale, sx * w * 0.23, h * 0.7, 0.36);
      box(f, w * 0.33, h * 0.35, 0.025, D.woodPale, sx * w * 0.23, h * 0.29, 0.36);
      sphere(f, 0.035, D.brass, sx * 0.075, h * 0.51, 0.39, 1, 1, 0.65, 8);
    }
    return f;
  }

  function dresser(x, y, z, ry = 0, w = 1.25, h = 0.94) {
    const f = frame(x, y, z, ry);
    box(f, w, h - 0.1, 0.52, D.wood, 0, h / 2, 0);
    box(f, w + 0.08, 0.07, 0.58, D.woodMid, 0, h + 0.015, 0);
    box(f, w + 0.04, 0.08, 0.56, D.woodMid, 0, 0.08, 0);
    for (let i = 0; i < 3; i++) {
      const cy = 0.27 + i * 0.245;
      box(f, w - 0.16, 0.19, 0.035, D.woodMid, 0, cy, 0.285);
      for (const sx of [-1, 1]) sphere(f, 0.025, D.brass, sx * w * 0.22, cy, 0.325, 1, 1, 0.7, 7);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(f, 0.035, 0.045, 0.15, D.wood, sx * (w / 2 - 0.08), 0.075, sz * 0.18, 7);
    return { ...f, top: y + h + 0.06 };
  }

  function nightstand(x, y, z, ry = 0) { return dresser(x, y, z, ry, 0.58, 0.62); }

  function table(x, y, z, w = 1.5, d = 0.85, ry = 0, h = 0.78) {
    const f = frame(x, y, z, ry);
    box(f, w, 0.075, d, D.woodMid, 0, h, 0);
    box(f, w - 0.12, 0.13, 0.07, D.wood, 0, h - 0.11, -d / 2 + 0.07);
    box(f, w - 0.12, 0.13, 0.07, D.wood, 0, h - 0.11, d / 2 - 0.07);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      cylinder(f, 0.035, 0.06, h - 0.05, D.wood, sx * (w / 2 - 0.12), (h - 0.05) / 2, sz * (d / 2 - 0.12), 8);
      cylinder(f, 0.055, 0.055, 0.05, D.woodMid, sx * (w / 2 - 0.12), h * 0.55, sz * (d / 2 - 0.12), 8);
    }
    return { ...f, top: y + h + 0.04 };
  }

  function chair(x, y, z, ry = 0, upholstered = false) {
    const f = frame(x, y, z, ry);
    box(f, 0.48, 0.07, 0.46, upholstered ? D.upholstery : D.woodMid, 0, 0.47, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      cylinder(f, 0.025, 0.04, sz < 0 ? 0.94 : 0.47, D.wood, sx * 0.19, (sz < 0 ? 0.94 : 0.47) / 2, sz * 0.18, 7);
    for (let i = -1; i <= 1; i++) box(f, 0.04, 0.38, 0.035, D.woodPale, i * 0.13, 0.72, -0.19);
    box(f, 0.5, 0.075, 0.055, D.woodMid, 0, 0.95, -0.19);
    return f;
  }

  function rockingChair(x, y, z, ry = 0) {
    const f = frame(x, y, z, ry);
    box(f, 0.56, 0.07, 0.55, D.upholsteryDark, 0, 0.53, 0);
    for (const sx of [-1, 1]) {
      cylinder(f, 0.025, 0.04, 1.0, D.wood, sx * 0.23, 0.5, -0.21, 8);
      cylinder(f, 0.025, 0.035, 0.54, D.wood, sx * 0.23, 0.27, 0.19, 8);
    }
    for (let i = -2; i <= 2; i++) box(f, 0.035, 0.44, 0.035, D.woodPale, i * 0.095, 0.79, -0.21);
    box(f, 0.58, 0.07, 0.06, D.woodMid, 0, 1.02, -0.21);
    box(f, 0.72, 0.06, 0.07, D.woodMid, 0, 0.73, 0.03);
    const railCurve = () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.42, 0.02, -0.38), new THREE.Vector3(-0.18, -0.01, -0.12),
      new THREE.Vector3(0.18, -0.01, 0.14), new THREE.Vector3(0.42, 0.04, 0.36),
    ]);
    for (const sx of [-1, 1]) {
      const rail = mesh(f, new THREE.TubeGeometry(railCurve(), 18, 0.028, 6, false), D.woodMid, 0, 0.09, sx * 0.24, 0, Math.PI / 2, 0);
      rail.castShadow = true;
    }
    return f;
  }

  function crib(x, y, z, ry = 0) {
    const f = frame(x, y, z, ry);
    const w = 1.38, d = 0.82;
    box(f, w - 0.08, 0.12, d - 0.08, D.linenDirty, 0, 0.43, 0);
    box(f, w, 0.08, d, D.wood, 0, 0.31, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      cylinder(f, 0.035, 0.05, 1.15, D.wood, sx * w / 2, 0.575, sz * d / 2, 8);
      sphere(f, 0.06, D.woodMid, sx * w / 2, 1.18, sz * d / 2, 1, 1.1, 1, 8);
    }
    for (const sz of [-1, 1]) {
      box(f, w, 0.06, 0.06, D.woodMid, 0, 0.98, sz * d / 2);
      for (let i = -5; i <= 5; i++) box(f, 0.026, 0.57, 0.035, D.woodPale, i * (w - 0.14) / 11, 0.7, sz * d / 2);
    }
    for (const sx of [-1, 1]) {
      box(f, 0.06, 0.06, d, D.woodMid, sx * w / 2, 0.98, 0);
      for (let i = -2; i <= 2; i++) box(f, 0.035, 0.57, 0.026, D.woodPale, sx * w / 2, 0.7, i * (d - 0.12) / 5);
    }
    sphere(f, 0.25, D.linen, 0.3, 0.56, -0.05, 1.35, 0.28, 0.6, 10);
    return f;
  }

  function sofa(x, y, z, ry = 0, w = 2.15) {
    const f = frame(x, y, z, ry);
    box(f, w, 0.3, 0.82, D.upholsteryDark, 0, 0.34, 0);
    box(f, w - 0.2, 0.58, 0.18, D.upholstery, 0, 0.7, -0.32);
    for (const sx of [-1, 1]) {
      cylinder(f, 0.14, 0.14, 0.72, D.upholstery, sx * (w / 2 - 0.12), 0.58, 0, 12, Math.PI / 2, 0, 0);
      cylinder(f, 0.035, 0.05, 0.2, D.wood, sx * (w / 2 - 0.16), 0.1, -0.22, 8);
      cylinder(f, 0.035, 0.05, 0.2, D.wood, sx * (w / 2 - 0.16), 0.1, 0.22, 8);
    }
    for (const sx of [-0.27, 0.27]) sphere(f, 0.42, D.upholstery, sx * w, 0.59, 0.03, 1.2, 0.35, 0.82, 12);
    return f;
  }

  function bookshelf(x, y, z, ry = 0, w = 1.5, h = 2.08) {
    const f = frame(x, y, z, ry);
    box(f, w, h, 0.08, D.wood, 0, h / 2, -0.18);
    box(f, 0.09, h, 0.42, D.woodMid, -w / 2 + 0.045, h / 2, 0);
    box(f, 0.09, h, 0.42, D.woodMid, w / 2 - 0.045, h / 2, 0);
    box(f, w + 0.1, 0.09, 0.48, D.woodMid, 0, h + 0.025, 0);
    for (let row = 0; row < 5; row++) {
      const sy = 0.18 + row * 0.39;
      box(f, w, 0.06, 0.44, D.woodMid, 0, sy, 0);
      let cursor = -w / 2 + 0.12;
      for (let i = 0; i < 8; i++) {
        const bw = 0.075 + ((row * 7 + i * 3) % 4) * 0.012;
        const bh = 0.23 + ((row * 5 + i * 2) % 5) * 0.018;
        box(f, bw, bh, 0.22, D.books[(row + i) % D.books.length], cursor + bw / 2, sy + 0.04 + bh / 2, 0.035, ((i + row) % 5 === 0) ? 0.08 : 0);
        cursor += bw + 0.025;
      }
    }
    return f;
  }

  function desk(x, y, z, ry = 0) {
    const f = frame(x, y, z, ry);
    box(f, 1.55, 0.075, 0.78, D.woodMid, 0, 0.79, 0);
    for (const sx of [-1, 1]) {
      box(f, 0.46, 0.7, 0.68, D.wood, sx * 0.5, 0.39, 0);
      for (let i = 0; i < 3; i++) {
        box(f, 0.36, 0.16, 0.03, D.woodMid, sx * 0.5, 0.2 + i * 0.2, 0.36);
        sphere(f, 0.02, D.brass, sx * 0.5, 0.2 + i * 0.2, 0.39, 1, 1, 0.7, 7);
      }
    }
    box(f, 0.5, 0.1, 0.66, D.upholsteryDark, 0, 0.81, 0);
    return { ...f, top: y + 0.83 };
  }

  function consoleTable(x, y, z, ry = 0, w = 1.15) {
    const f = frame(x, y, z, ry);
    box(f, w, 0.07, 0.38, D.woodMid, 0, 0.82, 0);
    box(f, w - 0.08, 0.16, 0.3, D.wood, 0, 0.7, 0);
    for (const sx of [-1, 1]) cylinder(f, 0.03, 0.055, 0.72, D.wood, sx * (w / 2 - 0.1), 0.36, 0, 8);
    sphere(f, 0.025, D.brass, 0, 0.71, 0.185, 1, 1, 0.7, 7);
    return { ...f, top: y + 0.86 };
  }

  function counter(x, y, z, ry = 0, len = 3.4) {
    const f = frame(x, y, z, ry);
    box(f, 0.64, 0.9, len, D.wood, 0, 0.45, 0);
    box(f, 0.72, 0.07, len + 0.06, M.stone, 0, 0.94, 0);
    const n = Math.max(2, Math.round(len / 0.82));
    for (let i = 0; i < n; i++) {
      const pz = -len / 2 + (i + 0.5) * len / n;
      box(f, 0.035, 0.67, len / n - 0.08, D.woodMid, -0.335, 0.48, pz);
      sphere(f, 0.018, D.brass, -0.36, 0.52, pz, 0.7, 1, 1, 7);
    }
    return { ...f, top: y + 0.98 };
  }

  function stove(x, y, z, ry = 0) {
    const f = frame(x, y, z, ry);
    box(f, 0.92, 0.92, 0.72, D.iron, 0, 0.46, 0);
    box(f, 0.68, 0.48, 0.035, D.black, 0, 0.44, 0.38);
    box(f, 0.72, 0.045, 0.04, D.brass, 0, 0.68, 0.405);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      cylinder(f, 0.12, 0.12, 0.025, D.black, sx * 0.2, 0.94, sz * 0.17, 12);
    cylinder(f, 0.11, 0.13, 1.55, D.iron, 0.26, 1.74, -0.15, 10);
    return f;
  }

  function fireplace(x, y, z, ry = 0) {
    const f = frame(x, y, z, ry);
    box(f, 1.95, 0.22, 0.5, M.brick, 0, 0.12, 0);
    box(f, 0.4, 1.35, 0.5, M.brick, -0.76, 0.77, 0);
    box(f, 0.4, 1.35, 0.5, M.brick, 0.76, 0.77, 0);
    box(f, 1.35, 0.34, 0.5, M.brick, 0, 1.27, 0);
    box(f, 2.12, 0.12, 0.64, D.woodMid, 0, 1.5, 0);
    box(f, 1.18, 0.86, 0.025, D.black, 0, 0.61, 0.265);
    for (const sx of [-0.28, 0.28]) cylinder(f, 0.055, 0.075, 0.78, D.wood, sx, 0.3, 0.3, 7, Math.PI / 2, 0, Math.PI / 2);
    return { ...f, top: y + 1.56 };
  }

  function coatStand(x, y, z) {
    const f = frame(x, y, z);
    cylinder(f, 0.035, 0.19, 1.82, D.wood, 0, 0.91, 0, 9);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const arm = cylinder(f, 0.018, 0.025, 0.42, D.woodMid, Math.cos(a) * 0.12, 1.66, Math.sin(a) * 0.12, 7, 0, 0, Math.PI / 2);
      arm.rotation.y += -a;
    }
    sphere(f, 0.065, D.woodMid, 0, 1.86, 0, 1, 1.15, 1, 8);
    return f;
  }

  function shelf(x, y, z, ry = 0, w = 2.3, h = 1.75) {
    const f = frame(x, y, z, ry);
    for (const sx of [-1, 1]) box(f, 0.09, h, 0.5, D.wood, sx * (w / 2 - 0.045), h / 2, 0);
    for (let i = 0; i < 4; i++) box(f, w, 0.08, 0.52, D.woodMid, 0, 0.12 + i * (h - 0.12) / 3, 0);
    return f;
  }

  function crate(x, y, z, ry = 0, s = 0.74) {
    const f = frame(x, y, z, ry);
    box(f, s, s * 0.72, s, D.woodMid, 0, s * 0.36, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(f, 0.055, s * 0.75, 0.055, D.wood, sx * (s / 2 - 0.05), s * 0.38, sz * (s / 2 - 0.05));
    box(f, s + 0.03, 0.06, s + 0.03, D.wood, 0, 0.08, 0);
    box(f, s + 0.03, 0.06, s + 0.03, D.wood, 0, s * 0.7, 0);
    return f;
  }

  function barrel(x, y, z, ry = 0) {
    const f = frame(x, y, z, ry);
    cylinder(f, 0.31, 0.27, 0.86, D.woodMid, 0, 0.43, 0, 12);
    for (const sy of [0.14, 0.43, 0.72]) cylinder(f, 0.323, 0.323, 0.035, D.iron, 0, sy, 0, 12);
    return f;
  }

  function boiler(x, y, z, ry = 0) {
    const f = frame(x, y, z, ry);
    const parts = [];
    const part = (object, id) => {
      object.name = `boiler-${id}`;
      object.userData.fixture = 'boiler';
      parts.push(object);
      return object;
    };
    part(cylinder(f, 0.52, 0.52, 1.18, D.iron, 0, 0.63, 0, 14), 'tank');
    part(cylinder(f, 0.38, 0.52, 0.22, D.iron, 0, 1.33, 0, 14), 'shoulder');
    box(f, 0.58, 0.5, 0.035, D.black, 0, 0.56, 0.53);
    box(f, 0.44, 0.045, 0.04, D.brass, 0, 0.8, 0.56);
    for (const sx of [-1, 1]) part(
      cylinder(f, 0.035, 0.05, 0.18, D.iron, sx * 0.28, 0.09, 0, 8),
      sx < 0 ? 'foot-left' : 'foot-right');
    // The old 1.15m flue ended at y=-0.425: 12.5cm through the authored
    // basement ceiling. Besides looking like a white fang, it could disappear
    // and reappear with the camera. Terminate it below the plane and swallow the
    // end in a broad soot-black collar/ceiling pocket.
    part(cylinder(f, 0.12, 0.14, 0.88, D.flue, 0.24, 1.9, -0.12, 10), 'flue');
    part(cylinder(f, 0.2, 0.24, 0.1, D.black, 0.24, 2.36, -0.12, 12), 'flue-pocket');
    game.houseFixtures ||= {};
    game.houseFixtures.boiler = {
      parts, ceilingY: HOUSE_TABLES.levels.basement.ceil,
      clearance: 0.025,
    };
    return { ...f, parts };
  }

  function waterTank(x, y, z) {
    const f = frame(x, y, z);
    cylinder(f, 0.34, 0.34, 1.48, D.iron, 0, 0.78, 0, 14);
    cylinder(f, 0.28, 0.34, 0.16, D.iron, 0, 1.58, 0, 14);
    cylinder(f, 0.025, 0.035, 0.62, D.iron, -0.26, 1.72, 0, 8);
    cylinder(f, 0.025, 0.035, 0.75, D.iron, 0.26, 1.78, 0, 8);
    return f;
  }

  function oilLamp(x, y, z) {
    const f = frame(x, y, z);
    cylinder(f, 0.085, 0.12, 0.08, D.brass, 0, 0.04, 0, 10);
    sphere(f, 0.1, D.glass, 0, 0.17, 0, 0.8, 1.2, 0.8, 10);
    cylinder(f, 0.055, 0.07, 0.22, D.glass, 0, 0.34, 0, 10);
    const flame = sphere(f, 0.035, new THREE.MeshBasicMaterial({ color: 0xffc36c }), 0, 0.22, 0, 0.65, 1.8, 0.65, 8);
    flame.castShadow = false;
    return f;
  }

  function framedArt(x, y, z, ry = 0, seed = 0, w = 0.68, h = 0.88) {
    const f = frame(x, y, z, ry);
    box(f, w + 0.13, 0.07, 0.055, D.wood, 0, h / 2 + 0.065, 0);
    box(f, w + 0.13, 0.07, 0.055, D.wood, 0, -h / 2 - 0.065, 0);
    box(f, 0.07, h, 0.055, D.wood, -w / 2 - 0.065, 0, 0);
    box(f, 0.07, h, 0.055, D.wood, w / 2 + 0.065, 0, 0);
    mesh(f, new THREE.PlaneGeometry(w, h), art[seed % art.length], 0, 0, 0.036, 0, 0, 0, false);
    return f;
  }

  function blackMirror(x, y, z, ry = 0, w = 0.74, h = 1.25) {
    const f = frame(x, y, z, ry);
    box(f, w + 0.14, h + 0.14, 0.06, D.woodMid, 0, 0, 0);
    box(f, w, h, 0.025, D.black, 0, 0, 0.045);
    return f;
  }

  function drapePanel(parent, px, w, h, mat) {
    const geo = new THREE.PlaneGeometry(w, h, 8, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ny = p.getY(i) / h + 0.5;
      const pinch = 0.55 + 0.45 * Math.min(1, Math.abs(ny - 0.56) / 0.44);
      const ox = p.getX(i) * pinch;
      p.setX(i, ox);
      p.setZ(i, Math.sin((p.getX(i) / w + 0.5) * Math.PI * 7) * 0.045);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, h / 2 + 0.12, 0);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function curtains(x, y, z, ry = 0, w = 1.8, h = 2.25) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry;
    scene.add(g);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, w + 0.48, 8), D.brass);
    rod.rotation.z = Math.PI / 2; rod.position.y = h + 0.28; rod.castShadow = true; g.add(rod);
    for (const sx of [-1, 1]) {
      drapePanel(g, sx * (w / 2 + 0.06), w * 0.42, h, D.linenDirty);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 10), D.brass);
      tie.position.set(sx * (w / 2 + 0.06), h * 0.56, 0.02); tie.rotation.y = Math.PI / 2; g.add(tie);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), D.brass);
      cap.position.set(sx * (w / 2 + 0.22), h + 0.28, 0); g.add(cap);
    }
    return g;
  }

  function book(x, y, z, ry = 0, i = 0) {
    const f = frame(x, y, z, ry);
    box(f, 0.24, 0.045, 0.32, D.books[i % D.books.length], 0, 0.025, 0);
  }
  function paper(x, y, z, ry = 0, w = 0.25, d = 0.32) {
    const f = frame(x, y, z, ry);
    box(f, w, 0.008, d, D.paper, 0, 0.005, 0);
  }
  function plate(x, y, z, i = 0) {
    const f = frame(x, y, z);
    cylinder(f, 0.105, 0.105, 0.018, D.ceramic, 0, 0.01, 0, 14);
    if (i % 2) cylinder(f, 0.03, 0.034, 0.08, D.glass, 0.14, 0.045, 0, 9);
  }
  function bottle(x, y, z, s = 1) {
    const f = frame(x, y, z);
    cylinder(f, 0.035 * s, 0.045 * s, 0.16 * s, D.glass, 0, 0.08 * s, 0, 9);
    cylinder(f, 0.014 * s, 0.014 * s, 0.07 * s, D.glass, 0, 0.19 * s, 0, 7);
  }

  return {
    D, bed, wardrobe, dresser, nightstand, table, chair, rockingChair, crib, sofa,
    bookshelf, desk, consoleTable, counter, stove, fireplace, coatStand, shelf,
    crate, barrel, boiler, waterTank, oilLamp, framedArt, blackMirror, curtains,
    rug, book, paper, plate, bottle,
  };
}

export function buildHouse(game) {
  const { world, scene, mats: M } = game;
  world.buildHouse(HOUSE_TABLES);

  // route doors hang ajar — a house where every door stands open just enough
  for (const d of world.doors) {
    if (d.opts.ajar) { d.setOpen(true); d.update(5); }
  }

  // foundation skirt: the band between basement ceiling (-0.55) and ground
  // floor (0) has no wall — levels build floor..ceil — and the cellar stair
  // shaft cuts both slabs, so descending you could see clean out of the house
  // through the seam (playtest 3). A stone footing seals it and reads right
  // from the yard too.
  {
    const gcells = new Set();
    for (const [id, x0, z0, x1, z1, lv] of HOUSE_TABLES.rooms) {
      if (lv !== 'ground') continue;
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) gcells.add(cx + ',' + cz);
    }
    for (const key of gcells) {
      const [cx, cz] = key.split(',').map(Number);
      if (!gcells.has(cx + ',' + (cz - 1))) world.box(M.brick, -12 + cx * 2 + 1, -0.38, -14 + cz * 2, 2.04, 0.8, 0.5);
      if (!gcells.has(cx + ',' + (cz + 1))) world.box(M.brick, -12 + cx * 2 + 1, -0.38, -14 + (cz + 1) * 2, 2.04, 0.8, 0.5);
      if (!gcells.has((cx - 1) + ',' + cz)) world.box(M.brick, -12 + cx * 2, -0.38, -14 + cz * 2 + 1, 0.5, 0.8, 2.04);
      if (!gcells.has((cx + 1) + ',' + cz)) world.box(M.brick, -12 + (cx + 1) * 2, -0.38, -14 + cz * 2 + 1, 0.5, 0.8, 2.04);
    }
  }

  // roof slabs: over ground cells with no first-floor room, and over first
  const firstCells = new Set();
  for (const [id, x0, z0, x1, z1, lv] of HOUSE_TABLES.rooms) {
    if (lv !== 'first') continue;
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) firstCells.add(cx + ',' + cz);
  }
  for (const [id, x0, z0, x1, z1, lv] of HOUSE_TABLES.rooms) {
    if (lv !== 'ground') continue;
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      if (firstCells.has(cx + ',' + cz)) continue;
      world.box(M.woodDark, -12 + cx * 2 + 1, 3.62, -14 + cz * 2 + 1, 2.02, 0.16, 2.02);
    }
  }
  for (const c of firstCells) {
    const [cx, cz] = c.split(',').map(Number);
    world.box(M.woodDark, -12 + cx * 2 + 1, 6.72, -14 + cz * 2 + 1, 2.02, 0.16, 2.02);
  }

  // ---- zones + surfaces ----
  world.addZone('bedroom', 4, -2, 12, 6, 3.0, 7);
  world.addZone('basement', -20.5, -12, 12, 6.5, -3.6, -0.4);
  world.addZone('house', -12.5, -14.5, 12.5, 6.5, -0.4, 7.2);
  world.addSurface('wood', -12, -14, 12, 6, -0.5, 7.2);
  world.addSurface('stone', 4, -6, 12, 6, -0.5, 3.4);   // kitchen flags
  world.addSurface('dirt', -20, -14, 12, 6, -3.6, -0.5); // cellar earth
  world.addSurface('stone', -20, -10, -12, 6, -3.6, -0.5); // flooded works + archive

  furnish(game);
  bedroomAct(game);
  nurseryAct(game);
  voidDoorAct(game);
  buildWindowRelay(game);
  buildHouseLagMirror(game);
  cellarBoards(game);
  basementAct(game);
  buildPumpGallery(game);
}

// ---------------------------------------------------------------- dressing
function furnish(game) {
  const { world, scene, mats: M } = game;
  const K = createFurnitureKit(game);
  const F = HOUSE_TABLES.levels.first.floor;

  // Bedroom: a real bed silhouette, paneled wardrobe, drawer-front dresser,
  // bedside table and tied-back curtains. The route to the open window stays
  // deliberately clear: the furniture gives the room edges, not a maze.
  K.rug(9.25, F, 3.25, 4.3, 3.0);
  K.bed(10.55, F, 3.35, 0, 1.58, 2.18);
  K.wardrobe(5.15, F, 4.92, Math.PI, 1.48, 2.22);
  const bedroomDresser = K.dresser(9.35, F, 5.52, Math.PI, 1.28, 0.94);
  K.nightstand(8.68, F, 3.98, -0.08);
  K.oilLamp(9.35, bedroomDresser.top + 0.01, 5.45);
  K.book(8.68, F + 0.68, 3.98, 0.18, 2);
  K.curtains(7, F + 0.02, 5.84, Math.PI, 1.9, 2.2);
  K.framedArt(4.17, F + 1.48, 2.35, Math.PI / 2, 0, 0.65, 0.82);
  world.candles.push({ x: 9.4, y: F + 1.35, z: 5.5, intensity: 1.7, r: 4 });

  // Landing: runner, carved console, art and the curtained end window.
  K.rug(-1.45, F, 2.45, 1.45, 5.0);
  const hallTable = K.consoleTable(-3.42, F, 4.78, Math.PI / 2, 1.08);
  K.oilLamp(-3.42, hallTable.top, 4.78);
  K.framedArt(-3.82, F + 1.55, 3.3, Math.PI / 2, 3, 0.58, 0.74);
  K.curtains(-1, F + 0.02, 5.84, Math.PI, 1.55, 2.12);
  world.candles.push({ x: -3.4, y: F + 1.15, z: 4.9, intensity: 1.4, r: 4 });

  // nursery: crib, rocking chair, dresser — and the mobile turning with no wind
  K.rug(-8.35, F, 3.0, 4.8, 3.35, -0.04);
  K.crib(-10.4, F, 4.6, 0);
  K.rockingChair(-6.3, F, 5.0, 0.38);
  const nurseryDresser = K.dresser(-10.2, F, 1.05, 0, 1.24, 0.92);
  K.book(-10.42, nurseryDresser.top, 1.02, -0.17, 0);
  // backed to the landing wall SOUTH of the doorway — its old spot put a
  // corner into the door approach (furnishing audit: BLOCKS-DOOR first:4,7,W)
  K.wardrobe(-4.44, F, -0.8, -Math.PI / 2, 1.25, 2.0);
  K.crate(-6.15, F, 0.18, -0.14, 0.56);
  K.curtains(-9, F + 0.02, 5.84, Math.PI, 1.6, 2.12);
  K.framedArt(-11.82, F + 1.48, 1.8, Math.PI / 2, 1, 0.56, 0.7);
  world.candles.push({ x: -6.5, y: F + 0.5, z: 1.0, intensity: 0.8, r: 3.5 });

  // Guest bedroom: previously empty. Its ordinary, complete furnishing is
  // what makes the rest of the house's behavior feel wrong instead of cheap.
  K.rug(8.55, F, -6.1, 4.25, 3.35);
  K.bed(10.45, F, -5.1, Math.PI, 1.48, 2.05);
  K.wardrobe(11.28, F, -8.62, -Math.PI / 2, 1.28, 2.08);
  const guestStand = K.nightstand(8.95, F, -5.25, Math.PI);
  K.oilLamp(8.95, guestStand.top, -5.25);
  K.chair(5.2, F, -8.8, 0.65, true);
  K.curtains(11.84, F + 0.02, -7, -Math.PI / 2, 1.55, 2.12);
  K.framedArt(5.0, F + 1.48, -9.82, 0, 2, 0.7, 0.86);

  const G = 0;
  // Living room: upholstered seating around a built-up fireplace, with enough
  // open floor for the first Resident reveal to remain legible.
  K.rug(-8.1, G, -8.75, 5.4, 4.15, 0.03);
  K.sofa(-7.15, G, -10.9, 0.12, 2.25);
  K.chair(-6.0, G, -7.1, -2.2, true);
  const coffee = K.table(-8.2, G, -8.8, 1.15, 0.62, 0.08, 0.49);
  K.book(-8.36, coffee.top, -8.8, 0.2, 4);
  // chimney breast between the window and the study wall — at z -8 it sat
  // straight across the west window's opening, under its own curtains
  // (furnishing audit: BLOCKS-WINDOW ground:0,2,W)
  const hearth = K.fireplace(-11.7, G, -6.5, Math.PI / 2);
  K.oilLamp(-11.58, hearth.top, -6.2);
  K.curtains(-9, G + 0.02, -13.84, 0, 1.55, 2.28);
  K.curtains(-11.84, G + 0.02, -9, Math.PI / 2, 1.55, 2.28);
  K.framedArt(-5.0, 1.75, -13.82, 0, 4, 0.8, 1.0);
  world.candles.push({ x: -11.1, y: G + 0.5, z: -6.5, intensity: 1.2, r: 4.5 });
  // Dining: long table, six spindle-back chairs and abandoned settings.
  K.rug(9.2, G, -10.0, 4.7, 5.75);
  const diningTable = K.table(9.35, G, -10.05, 1.45, 4.0, 0, 0.79);
  for (const z of [-11.45, -10.05, -8.65]) {
    K.chair(8.25, G, z, -Math.PI / 2, false);
    K.chair(10.45, G, z, Math.PI / 2, false);
  }
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const row = Math.floor(i / 2);
    K.plate(9.35 + side * 0.4, diningTable.top, -11.35 + row * 1.3, i);
  }
  K.bottle(9.35, diningTable.top, -10.05, 1.08);
  K.consoleTable(11.5, G, -7.0, -Math.PI / 2, 1.25);
  K.curtains(11.84, G + 0.02, -11, -Math.PI / 2, 1.55, 2.28);
  K.framedArt(4.16, 1.78, -8.9, Math.PI / 2, 0, 0.76, 0.95);
  // Kitchen and scullery: paneled cabinets, stone tops, iron range, open
  // shelves and practical clutter. The direct route to the cellar stays open.
  const counter = K.counter(11.35, G, -2.6, 0, 4.9);
  K.stove(9.75, G, -5.35, 0);
  const prep = K.table(6.0, G, -1.4, 1.25, 0.72, 0.06, 0.82);
  K.plate(5.8, prep.top, -1.45, 0);
  K.bottle(6.2, prep.top, -1.35, 0.9);
  K.shelf(11.55, G + 1.18, 0.3, -Math.PI / 2, 1.38, 1.02);
  K.curtains(11.84, G + 0.02, -3, -Math.PI / 2, 1.55, 2.16);
  K.framedArt(5.0, 1.62, -5.82, 0, 3, 0.58, 0.7);
  K.barrel(6.65, G, 4.85);
  K.shelf(5.15, G, 5.45, Math.PI, 1.25, 1.55);
  K.bottle(11.35, counter.top, -3.3, 0.8);
  world.candles.push({ x: 10, y: G + 1.3, z: -2, intensity: 1.1, r: 4 });
  // Study: a wall of books, proper pedestal desk, reading chair, papers and
  // family landscapes. Dense at the perimeter, navigable in the middle.
  K.rug(-8.1, G, 1.0, 5.4, 4.35, -0.04);
  K.bookshelf(-11.72, G, -1.4, Math.PI / 2, 1.65, 2.18);
  K.bookshelf(-11.72, G, -3.3, Math.PI / 2, 1.65, 2.18);
  const studyDesk = K.desk(-8.85, G, 2.25, 0.18);
  K.chair(-8.5, G, 1.25, Math.PI + 0.18, true);
  K.paper(-9.08, studyDesk.top, 2.15, 0.05, 0.28, 0.35);
  K.book(-8.72, studyDesk.top, 2.35, -0.25, 1);
  K.sofa(-6.25, G, -1.15, -Math.PI / 2, 1.72);
  K.curtains(-11.84, G + 0.02, 1, Math.PI / 2, 1.55, 2.2);
  K.framedArt(-7.75, 1.76, 5.82, Math.PI, 1, 0.76, 0.94);
  K.framedArt(-4.17, 1.62, 3.7, -Math.PI / 2, 4, 0.58, 0.74);   // on the backhall wall — was floating 0.8m off it (audit: FLOATING)
  world.candles.push({ x: -9, y: G + 1.0, z: 2.2, intensity: 1.3, r: 4 });
  // foyer: coat stand, mirror frame (dark glass — the house mirror is elsewhere)
  K.rug(-1.9, G, -8.1, 1.25, 7.8);
  K.coatStand(-3.35, G, -12.65);
  const foyerConsole = K.consoleTable(-3.48, G, -7.7, Math.PI / 2, 1.05);
  K.bottle(-3.42, foyerConsole.top, -7.82, 0.65);
  K.framedArt(-3.8, 1.72, -5.1, Math.PI / 2, 2, 0.55, 0.72);
  K.rug(1.8, G, -12.0, 2.1, 2.6);
  K.consoleTable(3.45, G, -12.6, -Math.PI / 2, 0.9);
  K.rug(-0.2, G, 2.5, 1.35, 5.2);
  K.framedArt(-3.82, 1.68, -1.2, Math.PI / 2, 0, 0.55, 0.7);

  const B = -3.0;
  // boiler room: tank, boiler, pipes, pilot ember glow
  K.waterTank(10.6, B, -3.4);
  K.boiler(9.0, B, -5.0);
  world.candles.push({ x: 9, y: B + 0.55, z: -5, intensity: 1.6, r: 3.5, }); // pilot
  // storeroom: open shelving, slatted crates, barrels and bottle silhouettes
  K.shelf(-2.55, B, -4.65, 0, 2.45, 1.72);
  K.crate(2.15, B, -2.05, 0.3, 0.82);
  K.crate(1.35, B, -0.95, 0.9, 0.68);
  K.barrel(-2.8, B, -1.15);
  K.barrel(2.75, B, -5.25);
  K.bottle(-3.0, B + 0.62, -4.58, 0.85);
  K.bottle(-2.72, B + 1.18, -4.58, 0.7);

  // the dropcloths: human-adjacent shapes under sheets, mid-lunge poses.
  // one of them is real. which one is decided at boot. no one can warn you.
  const sheetSpots = [[-2.8, -1.2, 0.7], [0.6, -4.6, 2.4], [2.6, -4.2, 4.4], [-1.2, -5.2, 5.6]];
  const realIdx = Math.floor(Math.random() * sheetSpots.length);
  sheetSpots.forEach(([x, z, ry], i) => {
    const sheet = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.9, 8), M.curtain);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), M.curtain);
    head.position.set(0, 1.85, 0.08);
    sheet.add(body, head);
    sheet.rotation.z = 0.12;                      // mid-lunge lean
    if (i === realIdx) {
      const e = game.enemies.spawn('walker', x, z, 'standing', B + 1);   // the BASEMENT storey
      e.standing = true;
      sheet.position.y = 0;
      e.mesh.add(sheet);                          // it wears its cloth when it comes
    } else {
      sheet.position.set(x, B, z);
      sheet.rotation.y = ry;
      scene.add(sheet);
    }
  });

  // webs across the basement corridor — real strand geometry, not cartoon
  // planes (playtest 3b): radial spokes, sagging spiral rings, a couple of
  // torn gaps, and dew strands that catch the skull light. Brushed aside as
  // you pass, same as before.
  const strandMat = new THREE.LineBasicMaterial({ color: 0xb4bac0, transparent: true, opacity: 0.26, depthWrite: false });
  const dewMat = new THREE.LineBasicMaterial({ color: 0xd8dde2, transparent: true, opacity: 0.5, depthWrite: false });
  const mkWeb = (seed) => {
    let s = seed >>> 0;
    const r = () => { s = Math.imul(s ^ (s >>> 15), 1 | s); s ^= s + Math.imul(s ^ (s >>> 7), 61 | s); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; };
    const main = [], dew = [];
    const spokes = 9 + Math.floor(r() * 3);
    const angles = [];
    for (let i = 0; i < spokes; i++) angles.push((i / spokes) * TAU + (r() - 0.5) * 0.22);
    const R = 0.95 + r() * 0.25;
    const torn = Math.floor(r() * spokes);                  // one ragged sector
    for (const a of angles) {
      main.push(0, 0, 0, Math.cos(a) * R * (0.85 + r() * 0.3), Math.sin(a) * R * (0.85 + r() * 0.3), (r() - 0.5) * 0.05);
    }
    for (let ring = 0.18; ring < R; ring += 0.13 + r() * 0.05) {
      for (let i = 0; i < spokes; i++) {
        if (i === torn && ring > R * 0.45 && r() < 0.75) continue;   // the tear
        const a0 = angles[i], a1 = angles[(i + 1) % spokes];
        const sag = 0.04 + ring * 0.06;
        const r0 = ring * (0.92 + r() * 0.16), r1 = ring * (0.92 + r() * 0.16);
        const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0;
        const x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1;
        const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2 - sag;
        const bucket = r() < 0.07 ? dew : main;
        bucket.push(x0, y0, 0, xm, ym, (r() - 0.5) * 0.03);
        bucket.push(xm, ym, (r() - 0.5) * 0.03, x1, y1, 0);
      }
    }
    // anchor lines running off-frame
    for (let i = 0; i < 4; i++) {
      const a = r() * TAU;
      main.push(Math.cos(a) * R, Math.sin(a) * R, 0, Math.cos(a) * (R + 0.8), Math.sin(a) * (R + 0.8) + 0.3, (r() - 0.5) * 0.3);
    }
    const g = new THREE.Group();
    for (const [arr, mat] of [[main, strandMat], [dew, dewMat]]) {
      if (!arr.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.add(new THREE.LineSegments(geo, mat));
    }
    return g;
  };

  // unlit near-black: a spider is a silhouette that moves, not a lit object
  const spiderBody = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const mkSpider = (scale = 1) => {
    const sp = new THREE.Group();
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.042 * scale, 8, 6), spiderBody);
    abdomen.scale.set(0.85, 0.75, 1.15);
    abdomen.position.z = -0.045 * scale;
    sp.add(abdomen);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.024 * scale, 7, 5), spiderBody);
    head.position.z = 0.012 * scale;
    sp.add(head);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      const leg = new THREE.Group();
      leg.position.set(side * 0.02 * scale, 0, (k - 1.4) * 0.02 * scale);
      leg.rotation.z = side * (0.7 + k * 0.12);
      leg.rotation.y = side * (k - 1.5) * 0.35;
      const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0035 * scale, 0.0025 * scale, 0.075 * scale, 4), spiderBody);
      seg1.position.y = 0.034 * scale;
      leg.add(seg1);
      const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0025 * scale, 0.0015 * scale, 0.07 * scale, 4), spiderBody);
      seg2.position.set(0, 0.068 * scale, 0.01 * scale);
      seg2.rotation.x = 1.25;
      leg.add(seg2);
      sp.add(leg);
    }
    return sp;
  };

  for (let i = 0; i < 5; i++) {
    const w = mkWeb(0x1234 + i * 977);
    w.position.set(6.5 - i * 2.1, B + 1.2, 3.05 + (i % 2) * 0.5);
    w.rotation.y = Math.PI / 2 + (i - 2) * 0.12;
    scene.add(w);
    game.webs.push(w);
    // every other web is occupied. the occupant minds you coming.
    if (i % 2 === 0) {
      const sp = mkSpider(0.8 + (i % 3) * 0.25);
      sp.position.set((i - 2) * 0.11, 0.25 + (i % 2) * 0.3, 0.02);
      sp.rotation.z = (i - 2) * 0.9;
      w.add(sp);
      const home = sp.position.clone();
      let darted = 0, trembleT = 2 + i;
      game.tickers.push((dt, t) => {
        if (w.scale.y < 0.5) { sp.visible = false; return; }   // web brushed away: it's gone. somewhere.
        trembleT -= dt;
        if (trembleT <= 0) {
          trembleT = 2.5 + Math.random() * 4;
          sp.position.x = home.x + (Math.random() - 0.5) * 0.03;
        }
        const wp = w.getWorldPosition(_vDread);
        const d = Math.hypot(wp.x - game.player.pos.x, wp.z - game.player.pos.z);
        if (d < 1.7 && darted <= 0) {
          darted = 6;                                          // it FLEES you — motion is the scare
          const a = Math.random() * TAU;
          home.set(home.x + Math.cos(a) * 0.45, Math.min(0.9, home.y + 0.3), 0.02);
        }
        darted -= dt;
        sp.position.lerp(home, Math.min(1, dt * 9));
      });
    }
  }
}

// ---------------------------------------------------------------- act 0
function bedroomAct(game) {
  const { world, scene, mats: M } = game;
  const F = HOUSE_TABLES.levels.first.floor;

  // the tree outside the open window, key hanging from a low branch
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 8), M.bark);
  trunk.position.set(5.5, 4.5, 11.5);
  scene.add(trunk);
  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), M.bark);
  canopy.position.set(5.5, 9.6, 11.5);
  canopy.scale.set(1.3, 0.8, 1.3);
  scene.add(canopy);
  // the branch reaches toward the window; the key hangs FROM it on a string
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 4.4, 6), M.bark);
  branch.position.set(6.35, 6.35, 9.9);
  branch.lookAt(7.2, 6.6, 8.0);
  branch.rotateX(Math.PI / 2);
  scene.add(branch);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4),
    new THREE.MeshLambertMaterial({ color: 0x6b6255 }));
  string.position.set(7.2, 5.98, 8.2);
  scene.add(string);

  const key = makeKey(M);
  key.position.set(7.2, 5.68, 8.2);
  key.scale.setScalar(1.7);   // must be findable from the window at 7m
  scene.add(key);
  // key and string sway together in the night air
  game.tickers.push((dt, t) => {
    if (key.parent !== scene) { string.visible = false; return; }
    const sway = Math.sin(t * 1.3) * 0.22;
    key.rotation.z = sway;
    string.rotation.z = sway * 0.5;
  });

  world.addFetchTarget({
    id: 'treeKey', object: key, radius: 0.85,
    onHit(skull) {
      this.enabled = false;
      skull.grab('bedroomKey', key);
      game.audio.glassTink({ pos: key.getWorldPosition(new THREE.Vector3()), gain: 0.5 });
      game.flag('gotBedroomKey');
      return 'return';
    },
  });

  // ---- the locket -----------------------------------------------------
  // A second glint hangs DEEPER in the canopy, past where any straight
  // throw can go — the front boughs knock the skull back. Throw out the
  // window, HOLD, and steer it around under the leaves: the poise grammar's
  // first real lesson, taught in a safe sky. And this one isn't a fetch:
  // the skull KEEPS it. It wears it on its jaw for the rest of the game.
  // (Playtest 3: "not everything has to be a fucking key.")
  world.addCollider(2.2, 6.3, 8.6, 8.8, 11.5, 12.0);   // the front boughs, solid to a thrown thing
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xb9a06a, metalness: 0.85, roughness: 0.3, emissive: 0x4a3c14, emissiveIntensity: 0.6 });
  const locket = new THREE.Group();
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.9, 5), M.bark);
  twig.position.y = 0.62;
  locket.add(twig);
  const chainL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 4),
    new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
  chainL.position.y = 0.05;
  locket.add(chainL);
  const oval = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), brassMat);
  oval.scale.set(0.8, 1, 0.34);
  oval.position.y = -0.16;
  locket.add(oval);
  locket.position.set(5.2, 7.55, 13.85);
  scene.add(locket);
  // it glints and chimes faintly in the night air — the eye finds it from the window
  let chimeT = 4;
  game.tickers.push((dt, t) => {
    if (game.flags.has('keepsake')) return;
    brassMat.emissiveIntensity = 0.45 + Math.max(0, Math.sin(t * 2.1)) * 0.75;
    locket.rotation.y = Math.sin(t * 0.7) * 0.5;
    chimeT -= dt;
    if (chimeT <= 0) {
      chimeT = 5 + Math.random() * 4;
      game.audio.glassTink({ pos: locket.position, gain: 0.16, rate: 1.9 });
    }
  });
  world.addFetchTarget({
    id: 'locket', object: oval, radius: 0.6,
    onHit(skull) {
      if (!game.flags.has('gotBedroomKey')) return 'continue';
      this.enabled = false;
      scene.remove(locket);
      // it clamps the chain in its teeth and never lets go
      const dangle = new THREE.Group();
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 4),
        new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
      c1.position.y = -0.02;
      dangle.add(c1);
      const worn = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), brassMat);
      worn.scale.set(0.8, 1, 0.34);
      worn.position.y = -0.055;
      dangle.add(worn);
      dangle.position.set(0.048, -0.04, 0.055);
      skull.jaw.add(dangle);
      game.locketDangle = dangle;
      game.flag('keepsake');
      game.audio.glassTink({ pos: skull.pos, gain: 0.55, rate: 1.4 });
      game.audio.catchThud({ pos: skull.pos, gain: 0.3, rate: 1.5 });
      return 'return';
    },
  });

  // the locked bedroom door takes the key from the skull's teeth
  const door = world.doorById.bedroomDoor;
  world.addFetchTarget({
    id: 'bedroomLock', pos: door.group.position.clone(), radius: 1.0,
    onHit(skull) {
      if (!skull.carry || skull.carry.id !== 'bedroomKey') return 'return';
      this.enabled = false;
      const c = skull.dropCarry();
      c.mesh.visible = false;
      door.unlock(game);
      game.after(0.7, () => { door.setOpen(true); game.audio.doorOpen(false, { pos: door.group.position }); });
      game.flag('bedroomOpen');
      return 'return';
    },
  });
}

// ---------------------------------------------------------------- act 1
function nurseryAct(game) {
  const { world, scene, mats: M } = game;
  const F = HOUSE_TABLES.levels.first.floor;

  // stair key hangs FROM the mobile on a string — it spins with the toys.
  // someone hung it there where only a thrown thing could take it.
  const key = makeKey(M);
  key.scale.setScalar(1.4);
  world.addFetchTarget({
    id: 'stairKey', object: key, radius: 0.7,
    onHit(skull) {
      this.enabled = false;
      skull.grab('stairKey', key);
      game.flag('gotStairKey');
      return 'return';
    },
  });

  const door = world.doorById.stairDoor;
  world.addFetchTarget({
    id: 'stairLock', pos: door.group.position.clone(), radius: 1.0,
    onHit(skull) {
      if (!skull.carry || skull.carry.id !== 'stairKey') return 'return';
      this.enabled = false;
      const c = skull.dropCarry();
      c.mesh.visible = false;
      door.unlock(game);
      game.after(0.7, () => { door.setOpen(true); game.audio.doorOpen(false, { pos: door.group.position }); });
      game.flag('stairsOpen');
      return 'return';
    },
  });

  // the mobile over the crib, turning with no wind. while it turns you are safe.
  // when it slows, the corner is closer. hit it with the skull to spin it back up.
  const mobile = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), M.woodDark);
  bar.rotation.z = Math.PI / 2;
  mobile.add(bar);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), M.bone);
    s.position.set(-0.28 + i * 0.28, -0.16 - (i % 2) * 0.05, 0);
    mobile.add(s);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 3), M.woodDark);
    string.position.set(-0.28 + i * 0.28, -0.08, 0);
    mobile.add(string);
  }
  // the key hangs among the toys, on its own string, and turns with them
  const keyString = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4),
    new THREE.MeshLambertMaterial({ color: 0x6b6255 }));
  keyString.position.set(0.35, -0.15, 0);
  mobile.add(keyString);
  key.position.set(0.35, -0.42, 0);
  mobile.add(key);
  mobile.position.set(-10.4, F + 2.05, 4.6);   // hanging above the crib
  scene.add(mobile);
  game.musicBox = { mesh: mobile, wound: 1, thing: null };
  game.tickers.push((dt) => { mobile.rotation.y += dt * (0.2 + game.musicBox.wound * 1.6); });
  world.addFetchTarget({
    id: 'mobile', object: mobile, radius: 0.7,
    onHit(skull) {
      game.musicBox.wound = 1;
      game.audio.glassTink({ pos: mobile.position, gain: 0.45, rate: 1.3 });
      game.flag('woundBox');
      return 'return';
    },
  });
}

function cellarBoards(game) {
  const { world, scene, mats: M } = game;
  const door = world.doorById.cellarDoor;
  const p = door.group.position;
  game.boards = [];
  // boards on the KITCHEN face (z-), pale rough wood: the player must SEE
  // what's nailing the door shut to know to throw at it (playtest 2 — they
  // were on the stair side, invisible, and the door was a mystery)
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x97815f, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.24, 0.08), boardMat);
    b.position.set(p.x + 0.65, 0.6 + i * 0.75, p.z - 0.16);
    b.rotation.z = (i - 1) * 0.16;
    scene.add(b);
    game.boards.push(b);
    world.addFetchTarget({
      id: 'board' + i, object: b, radius: 0.55,
      onHit(skull, at) {
        this.enabled = false;
        // the board tears free and clatters — LOUD. the house hears it.
        game.impact('break', at);
        game.audio.pop({ pos: b.position, gain: 0.5, rate: 1.5 });
        game.detachBoard(b);
        if (game.boards.every((bb) => bb.userData.off)) {
          door.locked = null;
          door.unlockedOnce = true;
          game.flag('cellarOpen');
        }
        game.residentHeard(1);
        return 'return';
      },
    });
  }
}

// ---------------------------------------------------------------- act 2
function basementAct(game) {
  const { world, scene, mats: M } = game;
  const B = HOUSE_TABLES.levels.basement.floor;

  buildCrawlCounterweightSecret(game, B);

  // ---- the incinerator (Alex, playtest 3: "the player should try to burn
  // the skull down there but it doesn't work") -------------------------------
  // The one warm thing in the basement: a squat iron furnace against the
  // boiler room's east wall, ember light breathing through the door slits.
  // Feeding it the skull IS the basement's beat — the fire roars, chokes,
  // dies, the skull comes back untouched, and the backdraft pops the jammed
  // ash pan open. The hatch key was in the ash all along.
  const brass = new THREE.MeshStandardMaterial({ color: 0xa98748, roughness: 0.34, metalness: 0.78 });
  const soot = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.62, metalness: 0.55 });
  const sootDark = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.7, metalness: 0.5 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff8438 });
  const inc = new THREE.Group();
  inc.position.set(11.2, B, -1.5);
  inc.rotation.y = -Math.PI / 2;             // mouth faces -x, into the room
  scene.add(inc);
  const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.44, 0.95), soot);
  bodyBox.position.y = 0.84;
  inc.add(bodyBox);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(1.23, 0.1, 1.03), sootDark);
  crown.position.y = 1.6;
  inc.add(crown);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), sootDark);
    leg.position.set(sx * 0.46, 0.07, sz * 0.36);
    inc.add(leg);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 10), sootDark);
  collar.position.set(0.22, 1.7, -0.12);
  inc.add(collar);
  // flue ends inside the ceiling slab — it was poking a pale tip clean
  // through into the kitchen floor (playtest 3b: "that thing in the wall")
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.72, 10), soot);
  flue.position.set(0.22, 2.12, -0.12);
  inc.add(flue);
  // firebox cavity + ember bed, visible when the door swings
  const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x0a0503 }));
  cavity.position.set(0, 0.9, 0.26);
  inc.add(cavity);
  const embers = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.34), emberMat);
  embers.position.set(0, 0.62, 0.3);
  inc.add(embers);
  // the fire door, hinged at its left edge; vent slits glow while it's shut
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.78, 0.06), sootDark);
  doorFrame.position.set(0, 0.9, 0.475);
  inc.add(doorFrame);
  const hinge = new THREE.Group();
  hinge.position.set(-0.31, 0.9, 0.51);
  inc.add(hinge);
  const fireDoor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.64, 0.05), soot);
  fireDoor.position.x = 0.29;
  hinge.add(fireDoor);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), sootDark);
    rivet.position.set(0.29 + sx * 0.24, sy * 0.26, 0.03);
    hinge.add(rivet);
  }
  const slits = [];
  for (let i = 0; i < 3; i++) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.02), emberMat);
    slit.position.set(0.29, -0.17 + i * 0.17, 0.032);
    hinge.add(slit);
    slits.push(slit);
  }
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), brass);
  handle.position.set(0.52, 0, 0.05);
  hinge.add(handle);
  // ash pan drawer, jammed shut until the backdraft
  const pan = new THREE.Group();
  pan.position.set(0, 0.2, 0.32);
  inc.add(pan);
  const panBox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.5), M.metal);
  pan.add(panBox);
  const panAsh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 }));
  panAsh.position.y = 0.06;
  pan.add(panAsh);
  const panHandle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), brass);
  panHandle.position.set(0, 0, 0.27);
  panHandle.scale.set(1.6, 0.8, 0.8);
  pan.add(panHandle);

  // the key sleeps in the ash until the fire dies
  const key = makeKey(M);
  key.scale.setScalar(1.4);
  key.position.set(0.05, 0.11, 0.05);
  key.rotation.set(-Math.PI / 2, 0, 0.6);
  key.visible = false;
  pan.add(key);

  // breathing ember glow (candle descriptor; intensity is live-animated)
  const glow = { x: 10.55, y: B + 0.95, z: -1.5, intensity: 1.3, r: 4.5 };
  world.candles.push(glow);

  const incin = { doorOpen: false, offered: false, refused: false, glowTarget: 1.3 };
  game.incinerator = incin;
  const incPos = new THREE.Vector3(11.0, B + 0.9, -1.5);

  world.registerInteract(fireDoor, 'incineratorDoor', () => {
    if (incin.doorOpen) return;
    incin.doorOpen = true;
    game.audio.creak({ pos: incPos, gain: 0.7 });
    incin.glowTarget = 2.4;                      // the mouth opens; the room warms
    fireboxTarget.enabled = true;
  });
  world.registerInteract(panBox, 'ashPan', () => {
    if (incin.refused) return;                   // open and empty-able by skull now
    game.audio.lockedRattle({ pos: incPos, gain: 0.6, rate: 1.4 });   // jammed
    game.shake(0.08);
  });

  const fireboxTarget = world.addFetchTarget({
    id: 'firebox', pos: incPos.clone(), radius: 0.55,
    onHit(skull) {
      if (incin.offered) return 'return';
      incin.offered = true;
      this.enabled = false;
      // the skull sits IN the fire. the fire tries. the fire loses.
      skull.anchorAt(incPos, { maxHold: 2.3 });
      game.flag('skullOffered');
      game.audio.fireRoar({ pos: incPos, gain: 0.9 });
      incin.glowTarget = 5.5;                                    // it LIKES it
      game.after(1.3, () => {
        game.audio.fireChoke({ pos: incPos, gain: 0.9 });
        incin.glowTarget = 0.08;                                 // ...it didn't
      });
      game.after(1.9, () => game.audio.skullChatter(0.5, incPos));
      game.after(2.7, () => {
        incin.refused = true;
        game.flag('fireRefused');
        game.audio.metalDrop({ pos: incPos, gain: 0.8 });
        key.visible = true;
        keyTarget.enabled = true;
      });
      return 'anchor';
    },
  });

  const keyTarget = world.addFetchTarget({
    id: 'hatchKey', object: key, radius: 0.7, enabled: false,
    onHit(skull) {
      this.enabled = false;
      skull.grab('hatchKey', key);
      game.flag('gotHatchKey');
      return 'return';
    },
  });
  keyTarget.enabled = false;

  // ash pan slides open after the refusal; slits/embers/glow all die together
  game.tickers.push((dt) => {
    glow.intensity += (incin.glowTarget - glow.intensity) * Math.min(1, dt * 3.5);
    const lit = clamp(glow.intensity / 1.3, 0.05, 2.2);
    emberMat.color.setRGB(1 * lit * 0.55 + 0.03, 0.3 * lit * 0.45 + 0.01, 0.08 * lit * 0.3);
    if (incin.doorOpen && hinge.rotation.y > -1.85) hinge.rotation.y = Math.max(-1.85, hinge.rotation.y - dt * 3.2);
    if (incin.refused && pan.position.z < 0.66) pan.position.z = Math.min(0.66, pan.position.z + dt * 1.4);
    // the skull dreads the open mouth: chatter spikes as you carry it close
    if (incin.doorOpen && !incin.refused && game.skull.mode === 'held') {
      const cam = game.camera.getWorldPosition(_vDread);
      const d = cam.distanceTo(incPos);
      if (d < 3.4) {
        const dread = 0.45 * (1 - d / 3.4) + 0.15;
        if (game.skull.threat < dread) {
          game.skull.threat = dread;
          game.skull.threatDir.copy(incPos).sub(cam).normalize();
        }
      }
    }
  });

  // ---- the hatch: sloped bilco doors, now VISIBLY chained shut --------------
  // (Alex, playtest 3: "the basement hatch doesn't look like its locked at all")
  const hatch = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.9), M.metal);
  panel.rotation.x = -0.5;
  hatch.add(panel);
  hatch.position.set(-10, B + 2.1, 4.4);
  scene.add(hatch);

  // an X of chain draped flat on the panel, meeting at a hasp + fat padlock —
  // it must read SEALED from across the room
  const chainGroup = new THREE.Group();
  scene.add(chainGroup);
  const linkGeo = new THREE.TorusGeometry(0.05, 0.016, 6, 10);
  const panelTilt = new THREE.Euler(-0.5, 0, 0);
  const onPanel = (u, v) => new THREE.Vector3(u, 0.06, v).applyEuler(panelTilt).add(hatch.position);
  // two chain runs from the panel's top corners down to a hasp at the lip —
  // an inverted V the player walks straight into
  for (const dirU of [1, -1]) {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p = onPanel(dirU * 0.66 * (1 - t), 0.8 - 1.58 * t);
      const link = new THREE.Mesh(linkGeo, sootDark);
      link.position.copy(p);
      link.lookAt(onPanel(dirU * 0.66 * (1 - t - 0.08), 0.8 - 1.58 * (t + 0.08)));
      link.rotateY(Math.PI / 2);
      if (i % 2) link.rotateX(Math.PI / 2);
      chainGroup.add(link);
    }
  }
  const haspP = onPanel(0, -0.8);
  const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.18), sootDark);
  hasp.position.copy(haspP);
  hasp.rotation.copy(panelTilt);
  chainGroup.add(hasp);
  // the padlock hangs off the lip, face-on to whoever walks in
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.11), brass);
  lockBody.position.set(-10, B + 1.56, 3.56);
  lockBody.rotation.x = -0.12;
  chainGroup.add(lockBody);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 8, 10, Math.PI), sootDark);
  shackle.position.set(-10, B + 1.74, 3.59);
  shackle.rotation.x = -0.12;
  chainGroup.add(shackle);
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 8),
    new THREE.MeshBasicMaterial({ color: 0x050505 }));
  keyhole.position.set(-10, B + 1.5, 3.63);
  keyhole.rotation.x = Math.PI / 2 - 0.12;
  chainGroup.add(keyhole);
  game.hatch = { group: hatch, panel, lock: lockBody, open: false };

  let chainFalling = 0;
  world.addFetchTarget({
    id: 'hatchLock', object: lockBody, radius: 0.9,
    onHit(skull) {
      if (!skull.carry || skull.carry.id !== 'hatchKey') return 'return';
      this.enabled = false;
      const c = skull.dropCarry();
      c.mesh.visible = false;
      game.audio.unlock({ pos: lockBody.position });
      chainFalling = 1;
      game.after(0.55, () => game.audio.metalDrop({ pos: lockBody.position, gain: 0.9 }));
      game.flag('hatchUnlocked');
      return 'return';
    },
  });
  game.tickers.push((dt) => {
    if (!chainFalling) return;
    if (chainGroup.position.y > -1.62) {
      chainGroup.position.y -= dt * 3.4;
      chainGroup.rotation.z += dt * 0.4;
    } else chainFalling = 0;                     // it lies where it fell
  });

  world.registerInteract(panel, 'hatch', () => {
    if (!game.flags.has('hatchUnlocked')) {
      game.audio.lockedRattle({ pos: hatch.position, gain: 0.85 });
      game.shake(0.14);
      // the chain takes the shake
      chainGroup.position.x = (Math.random() - 0.5) * 0.05;
      game.after(0.25, () => { chainGroup.position.x = 0; });
      return;
    }
    if (!game.hatch.open) {
      game.hatch.open = true;
      game.audio.stoneGrind({ pos: hatch.position });
      game.flag('hatchOpen');
      game.exitBasement();   // fade + climb out to the graveyard
    }
  });
}

// The crawl wing used to be twelve metres of dirt with nothing to learn in it.
// This optional kennel is a miniature statement of FETCH's real grammar: the
// player cannot fit through the bars, but the skull can; a tap makes the weight
// twitch, while holding the throw keeps the skull in the cradle long enough to
// lift and latch the shutter. No key, prompt, meter or mandatory route gate.
function buildCrawlCounterweightSecret(game, B) {
  const { world, scene, mats: M } = game;
  const iron = M.metal;
  const cageIron = new THREE.MeshStandardMaterial({
    color: 0x242829, roughness: 0.72, metalness: 0.52,
  });
  const wornIron = new THREE.MeshStandardMaterial({
    color: 0x747774, roughness: 0.48, metalness: 0.72,
    emissive: 0x151817, emissiveIntensity: 0.65,
  });
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0x9a895e, roughness: 0.5, metalness: 0.72,
  });
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0x292b2b, roughness: 0.94, metalness: 0,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xe2e7e2, transparent: true, opacity: 0.035,
  });

  const cage = new THREE.Group();
  cage.name = 'crawl-secret-kennel';
  cage.userData.stableId = 'crawlCounterweight';
  scene.add(cage);

  // A corner cage: the room's west/south stone walls close two sides, these
  // bars close the east and north. The broad player colliders deliberately let
  // the skull pass; the rendered gaps are the affordance, not fake collision.
  const frontX = -8.25;
  const zSouth = -9.7, zNorth = -6.25;
  const xWest = -11.72;
  const barY = B + 1.16;
  const barH = 2.32;
  const barPoints = [];
  for (let z = zSouth + 0.18; z <= zNorth - 0.08; z += 0.34) barPoints.push([frontX, z]);
  for (let x = xWest + 0.22; x <= frontX - 0.18; x += 0.34) barPoints.push([x, zNorth]);
  const barGeo = new THREE.CylinderGeometry(0.027, 0.034, barH, 7);
  const bars = new THREE.InstancedMesh(barGeo, cageIron, barPoints.length);
  bars.name = 'crawl-secret-bars';
  const barMatrix = new THREE.Matrix4();
  barPoints.forEach(([x, z], i) => {
    barMatrix.makeTranslation(x, barY, z);
    bars.setMatrixAt(i, barMatrix);
  });
  bars.instanceMatrix.needsUpdate = true;
  bars.castShadow = true;
  bars.receiveShadow = true;
  cage.add(bars);
  for (const y of [B + 0.12, B + 1.14, B + 2.25]) {
    world.box(cageIron, frontX, y, (zSouth + zNorth) / 2, 0.09, 0.09, zNorth - zSouth + 0.12);
    world.box(cageIron, (xWest + frontX) / 2, y, zNorth, frontX - xWest + 0.12, 0.09, 0.09);
  }
  const frontCollider = world.addCollider(
    frontX - 0.07, B - 0.05, zSouth,
    frontX + 0.07, B + 2.42, zNorth,
    { id: 'crawlCageFront', skullPass: true, secretId: 'crawlCounterweight' });
  const sideCollider = world.addCollider(
    xWest, B - 0.05, zNorth - 0.07,
    frontX, B + 2.42, zNorth + 0.07,
    { id: 'crawlCageSide', skullPass: true, secretId: 'crawlCounterweight' });

  // The cable makes the causal chain readable in one glance: skull-sized
  // cradle -> two pulleys -> shutter. Everything the player needs is a shape.
  const cradleBase = new THREE.Vector3(-9.48, B + 1.05, -7.78);
  const cradle = new THREE.Group();
  cradle.name = 'crawl-counterweight-cradle';
  cradle.position.copy(cradleBase);
  scene.add(cradle);
  const cradleRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 7, 22), wornIron);
  cradleRing.rotation.x = Math.PI / 2;
  cradle.add(cradleRing);
  const cradleDish = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.32, 0.07, 12), iron);
  cradleDish.position.y = -0.09;
  cradle.add(cradleDish);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.48, 6), wornIron);
    const a = i / 3 * TAU;
    arm.position.set(Math.cos(a) * 0.27, 0.2, Math.sin(a) * 0.27);
    arm.rotation.z = Math.cos(a) * 0.22;
    arm.rotation.x = Math.sin(a) * 0.22;
    cradle.add(arm);
  }
  const targetGlow = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.012, 5, 20), coreMat);
  targetGlow.rotation.x = Math.PI / 2;
  targetGlow.position.y = 0.015;
  cradle.add(targetGlow);

  const shutterBaseY = B + 1.06;
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.62, 1.76), cageIron);
  shutter.name = 'crawl-secret-shutter';
  shutter.position.set(-11.15, shutterBaseY, -7.78);
  shutter.castShadow = true;
  shutter.receiveShadow = true;
  scene.add(shutter);
  world.box(M.stone, -11.55, B + 0.25, -7.78, 0.55, 0.5, 2.18);
  world.box(cageIron, -11.14, B + 1.08, -8.72, 0.16, 2.18, 0.12);
  world.box(cageIron, -11.14, B + 1.08, -6.84, 0.16, 2.18, 0.12);
  world.box(cageIron, -11.14, B + 2.18, -7.78, 0.16, 0.12, 2.0);

  const pulleyGeo = new THREE.TorusGeometry(0.17, 0.035, 7, 18);
  for (const x of [cradleBase.x, -11.12]) {
    const pulley = new THREE.Mesh(pulleyGeo, wornIron);
    pulley.position.set(x, B + 2.23, cradleBase.z);
    scene.add(pulley);
  }
  const cableGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 5);
  const cradleCable = new THREE.Mesh(cableGeo, wornIron);
  cradleCable.name = 'crawl-counterweight-cable';
  scene.add(cradleCable);
  const topCable = new THREE.Mesh(cableGeo, wornIron);
  topCable.rotation.z = Math.PI / 2;
  topCable.scale.y = Math.abs(-11.12 - cradleBase.x);
  topCable.position.set((cradleBase.x - 11.12) / 2, B + 2.23, cradleBase.z);
  scene.add(topCable);
  const shutterCable = new THREE.Mesh(cableGeo, wornIron);
  scene.add(shutterCable);

  // Behind the shutter: not a reward icon, but an authored reason to have
  // looked. A small dog died curled around the ball it was never allowed to
  // fetch. Bone/value contrast and silhouette carry it in Alex's color vision.
  const remains = new THREE.Group();
  remains.name = 'crawl-secret-remains';
  remains.position.set(-11.38, B + 0.5, -7.74);    // west of the opaque shutter, on the hidden stone shelf
  scene.add(remains);
  const boneBetween = (a, b, radius = 0.025) => {
    const d = b.clone().sub(a);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.86, d.length(), 6), M.bone);
    bone.position.copy(a).add(b).multiplyScalar(0.5);
    bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    remains.add(bone);
    return bone;
  };
  boneBetween(new THREE.Vector3(0, 0.34, -0.42), new THREE.Vector3(0, 0.42, 0.28), 0.034);
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.18 + i * 0.012, 0.018, 5, 13, Math.PI * 1.55), M.bone);
    rib.position.set(0, 0.34 + i * 0.018, -0.27 + i * 0.13);
    rib.rotation.y = Math.PI / 2;
    rib.rotation.z = -0.78;
    remains.add(rib);
  }
  const dogSkull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), M.bone);
  dogSkull.name = 'crawl-secret-dog-skull';
  dogSkull.position.set(0.01, 0.39, 0.47);
  dogSkull.scale.set(0.78, 0.72, 1.05);
  remains.add(dogSkull);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.2), M.bone);
  muzzle.position.set(0.01, 0.34, 0.62);
  remains.add(muzzle);
  for (const side of [-1, 1]) {
    boneBetween(new THREE.Vector3(0, 0.3, -0.2), new THREE.Vector3(side * 0.03, 0.1, 0.12), 0.022);
    boneBetween(new THREE.Vector3(side * 0.03, 0.1, 0.12), new THREE.Vector3(side * 0.02, 0.08, 0.48), 0.018);
    boneBetween(new THREE.Vector3(0, 0.3, -0.34), new THREE.Vector3(side * 0.04, 0.09, -0.54), 0.022);
    boneBetween(new THREE.Vector3(side * 0.04, 0.09, -0.54), new THREE.Vector3(side * 0.02, 0.07, -0.22), 0.018);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.021, 6, 14), collarMat);
  collar.position.set(0, 0.39, 0.34);
  remains.add(collar);
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 10), collarMat);
  tag.position.set(0.01, 0.24, 0.36);
  tag.rotation.z = Math.PI / 2;
  remains.add(tag);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 9), ballMat);
  ball.name = 'crawl-secret-ball';
  ball.position.set(0.02, 0.14, 0.82);
  remains.add(ball);
  for (const a of [0, Math.PI / 2]) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.141, 0.008, 5, 18), wornIron);
    seam.position.copy(ball.position);
    seam.rotation.set(a, 0, a ? 0 : Math.PI / 2);
    remains.add(seam);
  }

  const lampCore = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), coreMat.clone());
  lampCore.name = 'crawl-secret-lamp';
  lampCore.position.set(-10.86, B + 1.82, -7.1);
  scene.add(lampCore);
  const lamp = new THREE.PointLight(0xd9e2de, 0, 5.5, 1.8);
  lamp.position.copy(lampCore.position);
  scene.add(lamp);

  const puzzle = {
    id: 'crawlCounterweight', state: 'idle', solved: false,
    holdTime: 0, progress: 0, requiredHold: 1.25,
    cage, cradle, shutter, remains, lamp,
    colliders: [frontCollider, sideCollider], target: null,
  };
  game.crawlSecret = puzzle;       // deterministic white-box/debug observability

  const anchorPos = new THREE.Vector3();
  const target = world.addFetchTarget({
    id: 'crawlCounterweightCradle', object: cradle, radius: 0.56,
    onHit(skull) {
      if (puzzle.solved) return 'return';
      if (skull.mode !== 'outbound') return 'continue';
      this.enabled = false; // release must leave the clamp before a retry can arm
      puzzle.state = 'weighing';
      game.flag('crawlCounterweightTouched');
      cradle.getWorldPosition(anchorPos);
      skull.anchorAt(anchorPos, {
        swing: true, maxHold: 4.5,
        puzzleId: puzzle.id,
      });
      game.impact('locked', anchorPos);
      game.audio.creak({ pos: anchorPos, gain: 0.55, rate: 0.72 });
      return 'anchor';
    },
  });
  puzzle.target = target;

  const solvePos = new THREE.Vector3(-11.12, B + 1.15, -7.78);
  game.tickers.push((dt, time) => {
    const skull = game.skull;
    const weighing = skull && skull.mode === 'anchored'
      && skull.anchor && skull.anchor.puzzleId === puzzle.id;

    if (!puzzle.solved) {
      if (!weighing && skull && skull.mode === 'held') target.enabled = true;
      if (weighing) {
        puzzle.state = 'weighing';
        puzzle.holdTime = Math.min(puzzle.requiredHold, puzzle.holdTime + dt);
      } else {
        puzzle.holdTime = Math.max(0, puzzle.holdTime - dt * 1.8);
        puzzle.state = puzzle.holdTime > 0 ? 'resetting' : 'idle';
      }
      puzzle.progress = clamp(puzzle.holdTime / puzzle.requiredHold, 0, 1);
      if (puzzle.progress >= 1) {
        puzzle.solved = true;
        puzzle.state = 'latched';
        target.enabled = false;
        game.flag('crawlSecretSolved');
        game.audio.unlock({ pos: solvePos, gain: 0.85, rate: 0.72 });
        game.audio.metalDrop({ pos: solvePos, gain: 0.7, rate: 0.62 });
        game.after(0.62, () => game.audio.knock({ pos: remains.position, gain: 0.34, rate: 0.76 }));
        game.after(1.15, () => game.audio.whisper({ pos: remains.position, gain: 0.28, rate: 0.7, verb: 0.85 }));
      }
    } else {
      puzzle.progress = 1;
    }

    const p = puzzle.progress;
    const eased = p * p * (3 - 2 * p);
    cradle.position.y = cradleBase.y - eased * 0.58;
    shutter.position.y = shutterBaseY + eased * 2.0;    // fully swallowed by the ceiling pocket when latched

    if (weighing) {
      cradle.getWorldPosition(anchorPos);
      skull.pos.copy(anchorPos);
      skull.root.position.copy(anchorPos);
      skull.anchor.point.copy(anchorPos);
    }

    const cableTop = B + 2.23;
    const cradleCableBottom = cradle.position.y + 0.36;
    cradleCable.scale.y = Math.max(0.03, cableTop - cradleCableBottom);
    cradleCable.position.set(cradleBase.x, (cableTop + cradleCableBottom) / 2, cradleBase.z);
    const shutterCableBottom = shutter.position.y + 0.72;
    const shutterCableLength = cableTop - shutterCableBottom;
    shutterCable.visible = shutterCableLength > 0.04;
    shutterCable.scale.y = Math.max(0.03, shutterCableLength);
    shutterCable.position.set(-11.12, (cableTop + shutterCableBottom) / 2, cradleBase.z);

    const lit = puzzle.solved ? 1 : 0;
    lamp.intensity += ((lit ? 18 + Math.sin(time * 13) * 1.3 : 0) - lamp.intensity) * Math.min(1, dt * 2.5);
    lampCore.material.opacity += ((lit ? 0.92 : 0.035) - lampCore.material.opacity) * Math.min(1, dt * 3.5);
    coreMat.opacity = 0.035 + (weighing ? 0.28 + Math.sin(time * 17) * 0.04 : 0);
  });
}
// ------------------------------------------------ window-to-window relay
// The two west windows teach the return leg as a tool. Throw through the
// living-room aperture and HOLD: the skull bites the bright exterior mooring.
// Carry the tether through the house, then release beside the study window.
// Its real return trajectory enters the second window and strikes a bell that
// cannot be reached from inside because an iron backplate guards it.
function buildWindowRelay(game) {
  const { world, scene, mats: M } = game;
  const G = HOUSE_TABLES.levels.ground.floor;
  const iron = new THREE.MeshStandardMaterial({
    color: 0x4c5557, roughness: 0.46, metalness: 0.78,
    emissive: 0x171d1f, emissiveIntensity: 0.8,
  });
  const boneWhite = new THREE.MeshStandardMaterial({
    color: 0x8d9692, roughness: 0.48, metalness: 0.42,
    emissive: 0x111718, emissiveIntensity: 0.42,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xe8f0ee, transparent: true, opacity: 0.12,
    depthWrite: false, toneMapped: false,
  });

  const mooring = new THREE.Group();
  mooring.name = 'living-window-skull-mooring';
  mooring.position.set(-12.67, G + 1.72, -9);
  scene.add(mooring);
  const mooringRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.055, 8, 24), iron);
  mooringRing.rotation.y = Math.PI / 2;
  mooring.add(mooringRing);
  const mooringHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), iron);
  mooringHub.rotation.z = Math.PI / 2;
  mooring.add(mooringHub);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.54, 6), iron);
    const sa = i / 4 * TAU;
    spoke.position.set(0, Math.cos(sa) * 0.13, Math.sin(sa) * 0.13);
    spoke.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, Math.cos(sa), Math.sin(sa)));
    mooring.add(spoke);
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.3, 6), boneWhite);
    const a = i / 4 * TAU;
    tooth.position.set(0, Math.sin(a) * 0.3, Math.cos(a) * 0.3);
    tooth.rotation.x = a + Math.PI / 2;
    mooring.add(tooth);
  }
  const mooringCore = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glowMat);
  mooring.add(mooringCore);
  // A continuous exterior rail makes the causal chain readable from either
  // room. While the skull is clamped, its trolley follows the player's progress
  // along the west hall; release at the study end gives it a clean line home.
  world.box(iron, -12.69, G + 2.68, -4, 0.08, 0.08, 10.65);
  for (const z of [-8.9, -6.4, -3.9, -1.4, 0.9]) {
    world.box(iron, -12.6, G + 2.54, z, 0.25, 0.32, 0.075);
    world.box(iron, -12.7, G + 2.36, z, 0.06, 0.42, 0.075);
  }
  const railWheelGeo = new THREE.TorusGeometry(0.16, 0.028, 6, 16);
  for (const z of [-9, 1]) {
    const pulley = new THREE.Mesh(railWheelGeo, iron);
    pulley.position.set(-12.69, G + 2.68, z);
    pulley.rotation.y = Math.PI / 2;
    scene.add(pulley);
  }
  const trolleyCable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.96, 5), iron);
  trolleyCable.position.set(-12.69, G + 2.2, -9);
  scene.add(trolleyCable);

  // The receiver is a shallow one-way cage: returning from outdoors touches
  // the bell before the plate; a throw from the study hits the plate first.
  const receiver = new THREE.Group();
  receiver.name = 'study-window-return-bell';
  receiver.position.set(-11.57, G + 1.7, 1);
  scene.add(receiver);
  const bellMetal = new THREE.MeshStandardMaterial({
    color: 0x30383a, roughness: 0.68, metalness: 0.68,
    emissive: 0x070a0b, emissiveIntensity: 0.2,
  });
  const oldBrass = new THREE.MeshStandardMaterial({
    color: 0x74694d, roughness: 0.58, metalness: 0.72,
    emissive: 0x0c0b07, emissiveIntensity: 0.2,
  });
  const bellRingMat = new THREE.MeshStandardMaterial({
    color: 0x3d4644, roughness: 0.66, metalness: 0.62,
    emissive: 0x0b0e0d, emissiveIntensity: 0.16,
  });
  const bellBack = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.52, 0.38), bellMetal);
  bellBack.position.set(0.13, 0.08, 0);
  receiver.add(bellBack);
  // A hanging servant bell gives the receiver an unmistakably physical side
  // silhouette. The earlier face-on disc read as a glowing UI bullseye.
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.24, 0.3, 16), oldBrass);
  bell.position.set(-0.02, -0.03, 0);
  receiver.add(bell);
  const bellMouth = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.026, 7, 24), bellRingMat);
  bellMouth.position.set(-0.02, -0.18, 0);
  bellMouth.rotation.x = Math.PI / 2;
  receiver.add(bellMouth);
  const bellRing = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 7, 24, Math.PI), bellRingMat);
  bellRing.rotation.y = Math.PI / 2;
  bellRing.position.y = -0.02;
  receiver.add(bellRing);
  for (const z of [-0.31, 0.31]) {
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.38, 6), bellMetal);
    hanger.position.set(0.09, -0.2, z);
    receiver.add(hanger);
  }
  for (const [y, z] of [[0.25, -0.14], [0.25, 0.14], [-0.12, -0.14], [-0.12, 0.14]]) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 5), oldBrass);
    rivet.position.set(0.185, y, z);
    receiver.add(rivet);
  }
  const striker = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), oldBrass);
  striker.position.set(-0.16, 0.03, 0.2);
  receiver.add(striker);
  const clapperRod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.27, 6), oldBrass);
  clapperRod.position.set(-0.02, -0.27, 0);
  receiver.add(clapperRod);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), oldBrass);
  clapper.position.set(-0.02, -0.43, 0);
  receiver.add(clapper);
  const grimeMat = new THREE.MeshBasicMaterial({
    color: 0x080a09, transparent: true, opacity: 0.62,
    depthWrite: false, toneMapped: false,
  });
  for (const [y, z, sx, sy] of [[0.11, -0.08, 1.2, 0.45], [-0.1, 0.07, 0.65, 1.1], [0.03, 0.13, 0.55, 0.42]]) {
    const grime = new THREE.Mesh(new THREE.CircleGeometry(0.07, 7), grimeMat);
    grime.position.set(0.112, y, z);
    grime.rotation.y = Math.PI / 2;
    grime.scale.set(sx, sy, 1);
    receiver.add(grime);
  }
  for (const [y, z, h, d] of [
    [G + 0.98, 1, 0.09, 1.42], [G + 2.55, 1, 0.09, 1.42],
    [G + 1.76, 0.31, 1.52, 0.08], [G + 1.76, 1.69, 1.52, 0.08],
  ]) world.box(iron, -11.52, y, z, 0.09, h, d);

  const plateBase = new THREE.Vector3(-10.94, G + 1.75, 1);
  const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.65, 1.18), iron);
  backplate.name = 'study-window-one-way-backplate';
  backplate.position.copy(plateBase);
  backplate.castShadow = true;
  backplate.receiveShadow = true;
  scene.add(backplate);
  const plateCollider = world.addCollider(
    -11.02, G + 0.9, 0.39, -10.86, G + 2.6, 1.61,
    { id: 'windowRelayBackplate' });

  const relay = {
    id: 'windowRelay', state: 'idle', armed: false, solved: false,
    mooring, receiver, backplate, plateCollider,
    departureTarget: null, receiverTarget: null, dropT: 0, ringT: 0,
  };
  game.windowRelay = relay;
  const openings = Object.fromEntries(world.windowOpenings.map((o) => [o.id, o]));
  const flashWindows = (amount = 1) => {
    if (openings.livingRelayWindow) openings.livingRelayWindow.hot = Math.max(openings.livingRelayWindow.hot, amount);
    if (openings.studyRelayWindow) openings.studyRelayWindow.hot = Math.max(openings.studyRelayWindow.hot, amount);
  };

  const anchorPos = new THREE.Vector3();
  relay.departureTarget = world.addFetchTarget({
    id: 'livingWindowMooring', object: mooring, radius: 0.52,
    onHit(skull) {
      if (relay.solved) return 'return';
      if (skull.mode !== 'outbound') return 'continue';
      // The return leg must be allowed to leave the clamp. Re-arm only after a
      // missed attempt has actually reached the player's hands again.
      this.enabled = false;
      relay.armed = true;
      relay.state = 'moored';
      mooring.getWorldPosition(anchorPos);
      skull.anchorAt(anchorPos, {
        swing: true, maxHold: 22,
        puzzleId: relay.id,
      });
      flashWindows(1);
      game.flag('windowRelayMooring');
      game.impact('locked', anchorPos);
      game.audio.metalDrop({ pos: anchorPos, gain: 0.54, rate: 1.45 });
      game.audio.glassTink({ pos: anchorPos, gain: 0.45, rate: 0.82 });
      return 'anchor';
    },
  });

  relay.receiverTarget = world.addFetchTarget({
    // Broad enough to accept the sacred return leg's retained lateral arc, but
    // still entirely protected from an interior throw by the backplate.
    id: 'studyWindowReceiver', object: receiver, radius: 0.9,
    onHit(skull) {
      if (relay.solved || !relay.armed || skull.mode !== 'returning') return 'continue';
      relay.solved = true;
      relay.armed = false;
      relay.state = 'rung';
      relay.dropT = 0.001;
      relay.ringT = 1.6;
      relay.departureTarget.enabled = false;
      this.enabled = false;
      // Remove the blocker at the instant the returning skull earns the route;
      // the animated plate remains visible while the return leg stays flawless.
      plateCollider.min.y = -20;
      plateCollider.max.y = -19;
      flashWindows(1);
      game.flag('windowRelaySolved');
      game.impact('pop', receiver.position);
      game.audio.metalDrop({ pos: receiver.position, gain: 0.86, rate: 1.18 });
      game.audio.unlock({ pos: receiver.position, gain: 0.72, rate: 1.34 });
      game.after(0.28, () => game.audio.knock({ pos: mooring.position, gain: 0.42, rate: 0.76 }));
      if (game.voidDoorBeat) game.voidDoorBeat.open('windowRelay');
      if (game.houseMirror) game.houseMirror.signalRelay();
      return 'continue';
    },
  });

  game.tickers.push((dt, time) => {
    const skull = game.skull;
    const anchored = skull && skull.mode === 'anchored'
      && skull.anchor && skull.anchor.puzzleId === relay.id;
    if (anchored) {
      relay.state = 'moored';
      const wantZ = clamp(game.player.pos.z, -9, 1);
      mooring.position.z += clamp(wantZ - mooring.position.z, -dt * 3.25, dt * 3.25);
      mooring.getWorldPosition(anchorPos);
      skull.pos.copy(anchorPos);
      skull.root.position.copy(anchorPos);
      skull.anchor.point.copy(anchorPos);
      flashWindows(0.42);
    } else if (relay.armed && skull) {
      relay.state = skull.mode === 'returning' ? 'returning-through-house' : relay.state;
      if (skull.mode === 'held') {
        relay.armed = false;
        relay.state = 'idle';
        relay.departureTarget.enabled = true;
      }
    } else if (!relay.solved && skull && skull.mode === 'held') {
      mooring.position.z += clamp(-9 - mooring.position.z, -dt * 4.5, dt * 4.5);
    }
    trolleyCable.position.z = mooring.position.z;
    mooring.rotation.x = Math.sin(time * (anchored ? 11 : 1.7)) * (anchored ? 0.055 : 0.012);
    mooringCore.material.opacity = 0.08 + (anchored ? 0.5 + Math.sin(time * 19) * 0.12 : 0.04);
    bellRingMat.emissiveIntensity = 0.12
      + (relay.solved ? 0.2 + Math.sin(time * 13) * 0.045 : relay.armed ? 0.27 + Math.sin(time * 9) * 0.06 : 0);
    if (relay.ringT > 0) {
      relay.ringT = Math.max(0, relay.ringT - dt);
      receiver.rotation.x = Math.sin(time * 34) * relay.ringT * 0.045;
      clapper.position.z = Math.sin(time * 38) * relay.ringT * 0.07;
    } else {
      receiver.rotation.x *= Math.exp(-dt * 12);
      clapper.position.z *= Math.exp(-dt * 12);
    }
    if (relay.dropT > 0) {
      relay.dropT += dt;
      backplate.rotation.z = Math.min(1.35, relay.dropT * 1.5);
      backplate.position.y = plateBase.y - Math.max(0, relay.dropT - 0.18) * 3.1;
      backplate.position.z = plateBase.z + Math.sin(relay.dropT * 5) * 0.05;
      if (backplate.position.y < G - 1.2) {
        backplate.visible = false;
        relay.dropT = 0;
      }
    }
  });
}

// ------------------------------------------------------- the lag mirror
// This is a real planar reflection from THE LAG's pooled renderer, but the only
// human shape it reflects follows the player's pose from roughly a second ago.
// It is deliberately featureless: the finale's skull-wearing reflection remains
// the game's one unspoiled ending. The beat never takes the camera or controls.
function buildHouseLagMirror(game) {
  const { world, scene, renderer, mats: M } = game;
  // Clear of the living-room door's swing and the foyer console: the previous
  // decorative mirror was half swallowed by an open panel from the main route.
  const pos = new THREE.Vector3(-3.765, 1.7, -11.25);
  const rotY = Math.PI / 2;
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x76634e, roughness: 0.62, metalness: 0.18,
    emissive: 0x120e0a, emissiveIntensity: 0.28,
  });
  world.box(frameMat, pos.x, pos.y + 0.7, pos.z, 0.08, 0.09, 0.96);
  world.box(frameMat, pos.x, pos.y - 0.7, pos.z, 0.08, 0.09, 0.96);
  world.box(frameMat, pos.x, pos.y, pos.z - 0.48, 0.08, 1.48, 0.09);
  world.box(frameMat, pos.x, pos.y, pos.z + 0.48, 0.08, 1.48, 0.09);
  const innerFrameMat = new THREE.MeshStandardMaterial({
    color: 0x2c2924, roughness: 0.72, metalness: 0.34,
  });
  world.box(innerFrameMat, pos.x + 0.018, pos.y + 0.655, pos.z, 0.055, 0.035, 0.83);
  world.box(innerFrameMat, pos.x + 0.018, pos.y - 0.655, pos.z, 0.055, 0.035, 0.83);
  world.box(innerFrameMat, pos.x + 0.018, pos.y, pos.z - 0.415, 0.055, 1.34, 0.035);
  world.box(innerFrameMat, pos.x + 0.018, pos.y, pos.z + 0.415, 0.055, 1.34, 0.035);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.027, 6, 18, Math.PI), frameMat);
  crown.position.set(pos.x + 0.015, pos.y + 0.76, pos.z);
  crown.rotation.set(0, Math.PI / 2, Math.PI / 2);
  scene.add(crown);

  const pool = new Mirrors(renderer, {
    budget: 1, size: 384, maxDist: 7,
    fogColor: 0x080a0b, fogDensity: 0.075,
  });
  const pane = pool.add(new Mirror(0.78, 1.3, {
    tint: 0xaab2b3, edge: 0.035, reflectMask: MASK_DOUBLE,
  }));
  pane.place(pos.x + 0.012, pos.y, pos.z, rotY);
  scene.add(pane.mesh);

  // The reflection renderer is allowed to go nearly black with the room, but
  // century-old silver never reads as an empty portal. A low, smoked wash sits
  // over it before the irregular loss layer and preserves a glassy value plane.
  const silverWash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.775, 1.295),
    new THREE.MeshBasicMaterial({
      color: 0x53605e, transparent: true, opacity: 0.17,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }));
  silverWash.position.set(pos.x + 0.02, pos.y, pos.z);
  silverWash.rotation.y = rotY;
  silverWash.renderOrder = 2;
  scene.add(silverWash);

  // Procedural foxing: edge loss, damp blooms, pinholes and hairline scratches
  // in the old silver. It keeps the surface architectural rather than a clean
  // black UI rectangle and costs one transparent draw.
  const foxCanvas = document.createElement('canvas');
  foxCanvas.width = 128;
  foxCanvas.height = 192;
  const fg = foxCanvas.getContext('2d');
  let foxSeed = 0x6f782d1;
  const foxRand = () => {
    foxSeed = Math.imul(foxSeed ^ (foxSeed >>> 15), 1 | foxSeed);
    foxSeed ^= foxSeed + Math.imul(foxSeed ^ (foxSeed >>> 7), 61 | foxSeed);
    return ((foxSeed ^ (foxSeed >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 88; i++) {
    const edge = foxRand() < 0.72;
    let x = foxRand() * 128, y = foxRand() * 192;
    if (edge) {
      const side = (foxRand() * 4) | 0;
      if (side === 0) x *= 0.18;
      else if (side === 1) x = 128 - x * 0.18;
      else if (side === 2) y *= 0.16;
      else y = 192 - y * 0.16;
    }
    const r = 2 + foxRand() * (edge ? 14 : 7);
    const grad = fg.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.12 + foxRand() * 0.34;
    grad.addColorStop(0, `rgba(92,82,67,${a})`);
    grad.addColorStop(0.55, `rgba(52,58,57,${a * 0.75})`);
    grad.addColorStop(1, 'rgba(12,15,15,0)');
    fg.fillStyle = grad;
    fg.beginPath();
    fg.ellipse(x, y, r, r * (0.35 + foxRand()), foxRand() * Math.PI, 0, TAU);
    fg.fill();
  }
  fg.lineWidth = 0.65;
  for (let i = 0; i < 22; i++) {
    fg.strokeStyle = `rgba(176,180,169,${0.05 + foxRand() * 0.12})`;
    fg.beginPath();
    const x = foxRand() * 128, y = foxRand() * 192;
    fg.moveTo(x, y);
    fg.lineTo(x + (foxRand() - 0.5) * 24, y + 8 + foxRand() * 35);
    fg.stroke();
  }
  const foxTexture = new THREE.CanvasTexture(foxCanvas);
  foxTexture.colorSpace = THREE.SRGBColorSpace;
  const foxing = new THREE.Mesh(
    new THREE.PlaneGeometry(0.775, 1.295),
    new THREE.MeshBasicMaterial({
      map: foxTexture, transparent: true, opacity: 0.78,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    }));
  foxing.position.set(pos.x + 0.024, pos.y, pos.z);
  foxing.rotation.y = rotY;
  foxing.renderOrder = 3;
  scene.add(foxing);

  const double = new THREE.Group();
  double.name = 'house-mirror-delayed-inhabitant';
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x111416, roughness: 0.92 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x5b5b57, roughness: 0.88 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.72, 4, 8), coatMat);
  torso.position.y = 1.02;
  torso.scale.set(0.82, 1, 0.62);
  double.add(torso);
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.63;
  double.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skinMat);
  head.scale.set(0.82, 1.08, 0.86);
  headPivot.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.58, 3, 6), coatMat);
    arm.position.set(side * 0.29, 1.03, -0.01);
    arm.rotation.z = side * 0.12;
    double.add(arm);
  }
  double.traverse((o) => o.layers.set(LAYER_DOUBLE));
  double.visible = false;
  scene.add(double);

  // Old silver clings to the glass as a second, flatter read of the delayed
  // body. It keeps the beat legible even when the reflected room is almost
  // black: a moving value/silhouette signal, never a hue-only trick.
  const echo = new THREE.Group();
  echo.name = 'house-mirror-silver-echo';
  echo.position.set(pos.x + 0.026, pos.y - 0.05, pos.z);
  echo.rotation.y = Math.PI / 2;
  const echoMat = new THREE.MeshBasicMaterial({
    color: 0x87918f, transparent: true, opacity: 0.15,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const echoShape = new THREE.Shape();
  echoShape.moveTo(-0.15, -0.52);
  echoShape.quadraticCurveTo(-0.22, -0.22, -0.19, 0.01);
  echoShape.lineTo(-0.34, 0.16);       // one shoulder held too high
  echoShape.quadraticCurveTo(-0.26, 0.3, -0.12, 0.34);
  echoShape.lineTo(-0.055, 0.35);
  echoShape.lineTo(0.075, 0.32);
  echoShape.lineTo(0.14, 0.29);
  echoShape.quadraticCurveTo(0.3, 0.22, 0.28, 0.09);
  echoShape.lineTo(0.18, -0.03);
  echoShape.quadraticCurveTo(0.24, -0.25, 0.12, -0.52);
  echoShape.closePath();
  const echoTorso = new THREE.Mesh(new THREE.ShapeGeometry(echoShape, 4), echoMat);
  echoTorso.renderOrder = 4;
  echo.add(echoTorso);
  const echoHead = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), echoMat);
  echoHead.position.set(-0.025, 0.49, 0);
  echoHead.scale.set(0.88, 1.14, 1);
  echoHead.renderOrder = 4;
  echo.add(echoHead);
  const neck = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.13), echoMat);
  neck.position.y = 0.36;
  neck.renderOrder = 4;
  echo.add(neck);
  const echoVoidMat = new THREE.MeshBasicMaterial({
    color: 0x030506, transparent: true, opacity: 0.58,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const faceLossShape = new THREE.Shape();
  faceLossShape.moveTo(-0.055, -0.085);
  faceLossShape.quadraticCurveTo(0.025, -0.11, 0.07, -0.025);
  faceLossShape.lineTo(0.045, 0.07);
  faceLossShape.quadraticCurveTo(-0.012, 0.11, -0.07, 0.055);
  faceLossShape.lineTo(-0.035, 0.005);
  faceLossShape.closePath();
  const faceVoid = new THREE.Mesh(new THREE.ShapeGeometry(faceLossShape), echoVoidMat);
  faceVoid.position.set(-0.006, 0.49, 0.002);
  faceVoid.renderOrder = 5;
  echo.add(faceVoid);
  const legVoid = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.28), echoVoidMat);
  legVoid.position.set(0, -0.405, 0.002);
  legVoid.rotation.z = -0.035;
  legVoid.renderOrder = 5;
  echo.add(legVoid);
  const echoArms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side < 0 ? -0.285 : 0.245, side < 0 ? 0.16 : 0.095, 0.001);
    const upper = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.28), echoMat);
    upper.position.y = -0.13;
    upper.renderOrder = 4;
    arm.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.26;
    const forearm = new THREE.Mesh(new THREE.PlaneGeometry(0.078, 0.27), echoMat);
    forearm.position.y = -0.13;
    forearm.renderOrder = 4;
    elbow.add(forearm);
    const hand = new THREE.Mesh(new THREE.CircleGeometry(0.047, 12), echoMat);
    hand.position.y = -0.29;
    hand.scale.set(0.72, 1.16, 1);
    hand.renderOrder = 4;
    elbow.add(hand);
    elbow.rotation.z = side < 0 ? -0.72 : 0.18;
    arm.add(elbow);
    arm.rotation.z = side < 0 ? 0.16 : -0.22;
    arm.userData.elbow = elbow;
    echo.add(arm);
    echoArms.push(arm);
  }
  echo.visible = false;
  scene.add(echo);

  const beat = {
    id: 'houseLagMirror', pool, pane, double, headPivot, echo, foxing, silverWash, echoArms,
    awakened: false, relay: false, active: false, watched: 0,
    poses: [], pos: pos.clone(),
    signalRelay() {
      this.relay = true;
      this.awakened = true;
      pane.setFlare(0.32);
      game.audio.glassTink({ pos, gain: 0.56, rate: 0.56 });
      game.after(0.42, () => game.audio.knock({ pos, gain: 0.34, rate: 0.58 }));
    },
    render(sceneArg, cameraArg) {
      const near = this.awakened && game.act === 'house'
        && game.player.pos.y > -0.35 && game.player.pos.y < 2.95
        && game.player.pos.distanceTo(pos) < 7;
      this.active = near;
      double.visible = near;
      echo.visible = near;
      if (!near) {
        pane.setActive(false);
        return false;
      }
      pool.setFog(Math.min(0.11, sceneArg.fog?.density ?? 0.075), sceneArg.fog?.color ?? 0x080a0b);
      pool.update(sceneArg, cameraArg);
      return pool._activeCount > 0;
    },
  };
  game.houseMirror = beat;

  const fwd = new THREE.Vector3();
  const toMirror = new THREE.Vector3();
  game.tickers.push((dt, time) => {
    const p = game.player;
    // The lag buffer belongs to the house act, including both storeys. Once
    // progression leaves the house there is no reflected image to service, so
    // stop allocating/shifting 120 pose records a second through every later
    // act. Do not use visibility or storey height here: walking upstairs must
    // not erase the continuous 1.05-second betrayal waiting downstairs.
    if (game.act !== 'house') {
      beat.watched = 0;
      if (beat.poses.length) beat.poses.length = 0;
      return;
    }
    const inHouse = p.pos.y > -0.35 && p.pos.y < 2.95;
    p.camera.getWorldDirection(fwd);
    toMirror.copy(pos).sub(p.camera.position);
    const dist = toMirror.length();
    const looking = inHouse && dist < 4.8 && p.pos.x > pos.x
      && fwd.dot(toMirror.normalize()) > 0.73;
    beat.watched = looking ? beat.watched + dt : Math.max(0, beat.watched - dt * 1.7);
    if (!beat.awakened && beat.watched > 0.38) {
      beat.awakened = true;
      game.flag('houseMirrorAwake');
      game.audio.glassTink({ pos, gain: 0.48, rate: 0.72 });
      game.after(0.68, () => game.audio.whisper({
        pos: new THREE.Vector3(-3.96, 1.45, -11.25), gain: 0.2, rate: 0.67, verb: 0.85,
      }));
    }

    beat.poses.push({ t: time, x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch });
    while (beat.poses.length > 2 && beat.poses[1].t < time - 2.4) beat.poses.shift();
    const delay = beat.relay ? 1.05 : 0.58;
    let pose = beat.poses[0];
    for (const candidate of beat.poses) {
      if (candidate.t <= time - delay) pose = candidate;
      else break;
    }
    double.position.set(pose.x, pose.y, pose.z);
    double.rotation.y = pose.yaw;
    const delayedDx = pose.x - p.pos.x;
    const delayedDz = pose.z - p.pos.z;
    echo.position.z = pos.z + clamp(delayedDz * 0.065, -0.23, 0.23);
    const echoScale = clamp(1 + delayedDx * 0.055, 0.78, 1.22);
    echo.scale.set(echoScale, 1 + clamp((pose.y - p.pos.y) * 0.08, -0.08, 0.08), echoScale);
    echo.rotation.x = clamp((pose.yaw - p.yaw) * 0.08, -0.09, 0.09);
    echoMat.opacity = 0.1 + (beat.relay ? 0.075 : 0.035) + (looking ? 0.035 : 0);
    echoVoidMat.opacity = 0.42 + (beat.relay ? 0.24 : 0);
    echoArms[0].rotation.z = 0.16 + (beat.relay ? Math.max(0, Math.sin(time * 0.31)) * 0.34 : 0);
    echoArms[0].userData.elbow.rotation.z = -0.72
      - (beat.relay ? Math.max(0, Math.sin(time * 0.27 + 0.9)) * 0.26 : 0);
    echoArms[1].rotation.z = -0.22 + clamp((pose.yaw - p.yaw) * 0.08, -0.13, 0.13);
    // Once the window circuit has rung, the reflected inhabitant sometimes
    // looks toward the study before the player does. The body still lags; only
    // this small betrayal is independent, and it is entirely inside glass.
    headPivot.rotation.y = beat.relay
      ? Math.sin(time * 0.43) * 0.18 + Math.max(0, Math.sin(time * 0.19)) * 0.42
      : pose.pitch * 0.12;
    pane.setFlare(0.035 + (beat.relay ? 0.09 : 0) + (looking ? 0.08 : 0));
  });
}

// ---------------------------------------------- flooded pump-gallery route
// A second basement district, optional and authored around continuous hold.
// The skull becomes the counterweight; the player keeps LMB down while the
// bridge pays out and crosses under their own control. Stepping onto the far
// bank drops a physical pawl, after which release recalls the skull and leaves
// a permanent return route. The channel is a sealed shallow machinery trough:
// no missing floor, fall-through, or respawn exploit is possible.
function buildPumpGallery(game) {
  const { world, scene, mats: M } = game;
  const B = HOUSE_TABLES.levels.basement.floor;
  const iron = new THREE.MeshStandardMaterial({
    color: 0x252c2d, roughness: 0.64, metalness: 0.72,
  });
  const worn = new THREE.MeshStandardMaterial({
    color: 0x404846, roughness: 0.62, metalness: 0.64,
    emissive: 0x070a09, emissiveIntensity: 0.24,
  });
  const pale = new THREE.MeshStandardMaterial({
    color: 0x858b85, roughness: 0.64, metalness: 0.28,
    emissive: 0x121615, emissiveIntensity: 0.34,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x070c0e, roughness: 0.22, metalness: 0.52,
    transparent: true, opacity: 0.86, depthWrite: false,
  });

  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.28, 11.35, 1, 10), waterMat);
  water.name = 'pump-gallery-sealed-channel';
  water.rotation.x = -Math.PI / 2;
  water.position.set(-16.08, B + 0.018, -4.05);
  water.receiveShadow = true;
  scene.add(water);
  for (const x of [-17.27, -14.89]) world.box(M.brick, x, B + 0.14, -4.05, 0.18, 0.28, 11.55);

  // Water occupies the whole trench visually. These two rail-backed blockers
  // close the non-bridge portions to the player while remaining skull-passable.
  const waterBarriers = [
    world.addCollider(-17.2, B - 0.1, -9.82, -14.96, B + 2.4, -4.18,
      { id: 'pumpChannelNorth', skullPass: true, routeId: 'pumpGallery' }),
    world.addCollider(-17.2, B - 0.1, -1.82, -14.96, B + 2.4, 1.82,
      { id: 'pumpChannelSouth', skullPass: true, routeId: 'pumpGallery' }),
  ];
  for (const z of [-4.17, -1.83]) {
    world.box(iron, -16.08, B + 1.04, z, 2.38, 0.08, 0.08);
    for (const x of [-17.18, -16.62, -16.06, -15.5, -14.98])
      world.box(iron, x, B + 0.53, z, 0.065, 1.04, 0.065);
  }

  const gate = new THREE.Group();
  gate.name = 'pump-gallery-near-gate';
  gate.position.set(-14.84, B, -3);
  scene.add(gate);
  const gateBarGeo = new THREE.BoxGeometry(0.08, 1.95, 0.08);
  for (let z = -0.92; z <= 0.92; z += 0.23) {
    const bar = new THREE.Mesh(gateBarGeo, iron);
    bar.position.set(0, 1.0, z);
    gate.add(bar);
  }
  const gateCollider = world.addCollider(
    -14.94, B - 0.05, -4.08, -14.74, B + 2.25, -1.92,
    { id: 'pumpBridgeGate', skullPass: true, routeId: 'pumpGallery' });

  const bridgeSegments = [];
  const bridgeGeo = new THREE.BoxGeometry(0.5, 0.12, 2.04);
  for (let i = 0; i < 5; i++) {
    const segment = new THREE.Mesh(bridgeGeo, i % 2 ? worn : iron);
    segment.name = `pump-bridge-segment-${i}`;
    segment.castShadow = true;
    segment.receiveShadow = true;
    scene.add(segment);
    bridgeSegments.push({
      mesh: segment,
      home: new THREE.Vector3(-14.63, B - 0.28 - i * 0.025, -3),
      goal: new THREE.Vector3(-15.12 - i * 0.51, B + 0.075, -3),
    });
  }

  const winch = new THREE.Group();
  winch.name = 'pump-gallery-skull-winch';
  winch.position.set(-13.55, B, -6.8);
  scene.add(winch);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 12), iron);
  drum.position.y = 0.72;
  drum.rotation.z = Math.PI / 2;
  winch.add(drum);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.055, 8, 24), worn);
  wheel.position.set(-0.42, 0.72, 0);
  wheel.rotation.y = Math.PI / 2;
  winch.add(wheel);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.88, 6), worn);
    spoke.position.copy(wheel.position);
    spoke.rotation.z = i / 6 * Math.PI;
    winch.add(spoke);
  }
  world.addCollider(-14.05, B, -7.35, -13.05, B + 1.42, -6.25,
    { id: 'pumpWinchBody', skullPass: true });

  const cradleBase = new THREE.Vector3(-14.18, B + 1.62, -6.8);
  const cradle = new THREE.Group();
  cradle.name = 'pump-gallery-counterweight-cradle';
  cradle.position.copy(cradleBase);
  scene.add(cradle);
  const cradleRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.047, 8, 24), worn);
  cradleRing.rotation.x = Math.PI / 2;
  cradle.add(cradleRing);
  const cradleDish = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.31, 0.08, 12), iron);
  cradleDish.position.y = -0.1;
  cradle.add(cradleDish);
  const cradleGlow = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.014, 6, 22),
    new THREE.MeshBasicMaterial({ color: 0xe5ece7, transparent: true, opacity: 0.16, depthWrite: false }));
  cradleGlow.rotation.x = Math.PI / 2;
  cradle.add(cradleGlow);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), iron);
  scene.add(cable);

  const pawl = new THREE.Group();
  pawl.name = 'pump-gallery-far-pawl';
  // Clamp the north bridge rail, never the player's centerline. The first pass
  // put this dramatic jaw exactly where the camera crossed and let the player
  // walk through its teeth.
  pawl.position.set(-17.48, B + 0.42, -4.66);
  scene.add(pawl);
  const jawTop = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.13, 1.45), pale);
  jawTop.position.y = 0.28;
  pawl.add(jawTop);
  const jawBottom = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.13, 1.45), pale);
  jawBottom.position.y = -0.28;
  pawl.add(jawBottom);
  for (const jaw of [jawTop, jawBottom]) for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 5), pale);
    tooth.position.set(-0.31, jaw === jawTop ? -0.12 : 0.12, i * 0.25);
    tooth.rotation.z = jaw === jawTop ? 0 : Math.PI;
    jaw.add(tooth);
  }

  // The blind archive is the reward: an inventory of incompatible generations
  // of pump hardware. It should feel like a room whose machinery was repaired
  // for a century and then abandoned in one night, not a lineup of identical
  // props. Shelves pinch the edges and force the skull-light across the gauges.
  for (const x of [-19.45, -13.0]) {
    world.box(M.woodDark, x, B + 1.15, 4.25, 0.3, 2.15, 3.1);
    world.addCollider(x - 0.17, B, 2.72, x + 0.17, B + 2.25, 5.82,
      { id: `blindArchiveShelf:${x}` });
    for (const y of [B + 0.45, B + 1.05, B + 1.65])
      world.box(M.woodDark, x + (x < -16 ? 0.18 : -0.18), y, 4.25, 0.48, 0.08, 3.0);
  }
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x202728, roughness: 0.74, metalness: 0.68,
  });
  const oldBrass = new THREE.MeshStandardMaterial({
    color: 0x5f5741, roughness: 0.68, metalness: 0.62,
  });
  const oldEnamel = new THREE.MeshStandardMaterial({
    color: 0x343b3a, roughness: 0.82, metalness: 0.34,
  });
  const gaugeFaceMat = new THREE.MeshStandardMaterial({
    color: 0x8d8c7e, roughness: 0.82, metalness: 0.08,
    emissive: 0x10110e, emissiveIntensity: 0.22,
  });
  const needleMat = new THREE.MeshBasicMaterial({ color: 0x171514, toneMapped: false });
  const pipeBetween = (a, b, radius = 0.045, material = pipeMat, radial = 8) => {
    const d = b.clone().sub(a);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.04, d.length(), radial), material);
    pipe.position.copy(a).add(b).multiplyScalar(0.5);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    pipe.castShadow = true;
    scene.add(pipe);
    return pipe;
  };

  // A straight ceiling main and its squared-off drops give the room a readable
  // structure. A second corroded run along the bridge bank connects the reward
  // to the machine that earned it without becoming a bright ceiling scribble.
  pipeBetween(new THREE.Vector3(-19.15, B + 2.28, 5.58),
    new THREE.Vector3(-13.42, B + 2.28, 5.58), 0.075);
  pipeBetween(new THREE.Vector3(-19.55, B + 2.12, -8.65),
    new THREE.Vector3(-19.55, B + 2.12, 1.45), 0.07);
  for (const z of [-7.4, -4.9, -2.2, 0.55]) {
    pipeBetween(new THREE.Vector3(-19.55, B + 2.12, z),
      new THREE.Vector3(-19.55, B + 1.62, z), 0.046);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.022, 6, 16), oldBrass);
    collar.position.set(-19.55, B + 1.63, z);
    collar.rotation.y = Math.PI / 2;
    scene.add(collar);
  }
  // The opposite main breaks around the doorway so the open route remains the
  // strongest silhouette from the bridge. Its brackets and old drip shadows
  // put believable depth on what used to be an empty brick end wall.
  pipeBetween(new THREE.Vector3(-12.22, B + 2.08, -9.35),
    new THREE.Vector3(-12.22, B + 2.08, -4.48), 0.065);
  pipeBetween(new THREE.Vector3(-12.22, B + 2.08, -1.52),
    new THREE.Vector3(-12.22, B + 2.08, 1.45), 0.065);
  const bridgeDampMat = new THREE.MeshBasicMaterial({
    color: 0x0b0d0d, transparent: true, opacity: 0.3,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  for (const [z, y, w, h] of [
    [-5.28, 1.18, 0.33, 1.36], [-4.74, 1.52, 0.16, 0.82],
    [-1.29, 1.33, 0.24, 1.08], [-0.76, 1.58, 0.12, 0.7],
  ]) {
    const drip = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bridgeDampMat);
    drip.position.set(-12.055, B + y, z);
    drip.rotation.y = Math.PI / 2;
    scene.add(drip);
  }

  // Water has climbed and dried down this wall many times. The transparent
  // canvas is deliberately low-value; silhouette and streak density do the
  // environmental storytelling, not a green/brown hue distinction.
  const stainCanvas = document.createElement('canvas');
  stainCanvas.width = 256;
  stainCanvas.height = 128;
  const sg = stainCanvas.getContext('2d');
  let stainSeed = 0x51a17e;
  const stainRand = () => ((stainSeed = Math.imul(stainSeed ^ (stainSeed >>> 13), 1597334677)) >>> 0) / 4294967296;
  for (let i = 0; i < 34; i++) {
    const x = 4 + stainRand() * 248;
    const y = stainRand() * 86;
    const w = 2 + stainRand() * 13;
    const h = 20 + stainRand() * 78;
    const grad = sg.createLinearGradient(x, y, x, y + h);
    const alpha = 0.08 + stainRand() * 0.2;
    grad.addColorStop(0, `rgba(16,18,17,${alpha * 0.2})`);
    grad.addColorStop(0.3, `rgba(23,20,17,${alpha})`);
    grad.addColorStop(1, 'rgba(9,11,11,0)');
    sg.fillStyle = grad;
    sg.beginPath();
    sg.ellipse(x, y + h * 0.35, w, h * 0.52, (stainRand() - 0.5) * 0.16, 0, TAU);
    sg.fill();
  }
  const stainTexture = new THREE.CanvasTexture(stainCanvas);
  stainTexture.colorSpace = THREE.SRGBColorSpace;
  const wallStains = new THREE.Mesh(new THREE.PlaneGeometry(6.12, 2.15), new THREE.MeshBasicMaterial({
    map: stainTexture, transparent: true, opacity: 0.78, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  }));
  wallStains.position.set(-16.25, B + 1.18, 5.94);
  wallStains.renderOrder = 2;
  scene.add(wallStains);

  const archiveLamp = new THREE.Group();
  archiveLamp.name = 'blind-archive-caged-lamp';
  archiveLamp.position.set(-16.25, B + 2.12, 4.72);
  scene.add(archiveLamp);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.25, 12, 1, true), iron);
  shade.rotation.x = Math.PI;
  shade.position.y = -0.08;
  archiveLamp.add(shade);
  const archiveLampCore = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 7), new THREE.MeshBasicMaterial({
    color: 0xd8c9a5, transparent: true, opacity: 0.62, toneMapped: false,
  }));
  archiveLampCore.position.y = -0.21;
  archiveLamp.add(archiveLampCore);
  for (let k = 0; k < 4; k++) {
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 5), oldBrass);
    const a = k / 4 * TAU;
    cage.position.set(Math.cos(a) * 0.095, -0.22, Math.sin(a) * 0.095);
    archiveLamp.add(cage);
  }
  world.candles.push({ x: -16.25, y: B + 1.91, z: 4.72, intensity: 0.72, r: 4.7 });

  const tankGeo = new THREE.CylinderGeometry(0.25, 0.28, 1, 12);
  const capGeo = new THREE.SphereGeometry(0.26, 12, 7);
  const baseGeo = new THREE.BoxGeometry(0.64, 0.14, 0.52);
  const riserGeo = new THREE.CylinderGeometry(0.055, 0.064, 0.58, 8);
  const flangeGeo = new THREE.TorusGeometry(0.22, 0.029, 7, 20);
  const spokeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.36, 5);
  const gaugeRimGeo = new THREE.TorusGeometry(0.115, 0.018, 7, 18);
  const gaugeFaceGeo = new THREE.CircleGeometry(0.105, 18);
  const pumpStands = [];
  const pumpSpecs = [
    { x: -18.72, z: 5.28, h: 1.12, r: 0.22, lean: -0.035, variant: 0, broken: -1 },
    { x: -17.73, z: 5.43, h: 0.86, r: 0.3, lean: 0.018, variant: 1, broken: 2 },
    { x: -16.75, z: 5.22, h: 0.76, r: 0.2, lean: -0.02, variant: 2, broken: -1 },
    { x: -15.72, z: 5.4, h: 1.02, r: 0.24, lean: 0.045, variant: 3, broken: 1 },
    { x: -14.7, z: 5.2, h: 0.94, r: 0.26, lean: -0.075, variant: 4, broken: 0 },
    { x: -13.72, z: 5.42, h: 1.34, r: 0.18, lean: 0.025, variant: 5, broken: -1 },
  ];
  const addValve = (parent, x, y, z, radius, broken = -1) => {
    const valve = new THREE.Group();
    valve.position.set(x, y, z);
    const ring = new THREE.Mesh(flangeGeo, oldBrass);
    ring.scale.setScalar(radius / 0.22);
    valve.add(ring);
    for (let k = 0; k < 3; k++) {
      if (k === broken) continue;
      const spoke = new THREE.Mesh(spokeGeo, oldBrass);
      spoke.scale.y = radius / 0.22;
      spoke.rotation.z = k / 3 * Math.PI;
      valve.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.075, 8), oldBrass);
    hub.rotation.x = Math.PI / 2;
    valve.add(hub);
    parent.add(valve);
    return valve;
  };
  const addGauge = (parent, x, y, z, scale = 1) => {
    const gauge = new THREE.Group();
    gauge.position.set(x, y, z);
    gauge.scale.setScalar(scale);
    const face = new THREE.Mesh(gaugeFaceGeo, gaugeFaceMat);
    gauge.add(face);
    const rim = new THREE.Mesh(gaugeRimGeo, oldBrass);
    rim.position.z = 0.006;
    gauge.add(rim);
    const needle = new THREE.Group();
    needle.position.z = 0.012;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.009, 0.007), needleMat);
    bar.position.x = 0.038;
    needle.add(bar);
    gauge.add(needle);
    parent.add(gauge);
    return needle;
  };

  for (let i = 0; i < pumpSpecs.length; i++) {
    const spec = pumpSpecs[i];
    const stand = new THREE.Group();
    stand.name = `archive-pump-${i}`;
    stand.position.set(spec.x, B, spec.z);
    stand.rotation.z = spec.lean;
    scene.add(stand);
    const base = new THREE.Mesh(baseGeo, i % 2 ? iron : worn);
    base.position.y = 0.08;
    base.scale.set(0.82 + spec.r, 1, 0.88 + spec.r * 0.25);
    base.castShadow = true;
    stand.add(base);
    for (const sx of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.028, 7, 5), oldBrass);
      bolt.position.set(sx * 0.22, 0.16, -0.17);
      stand.add(bolt);
    }

    const tank = new THREE.Mesh(tankGeo, i === 3 ? oldEnamel : (i % 2 ? worn : iron));
    tank.position.y = 0.19 + spec.h / 2;
    tank.scale.set(spec.r / 0.28, spec.h, spec.r / 0.28);
    tank.castShadow = true;
    tank.receiveShadow = true;
    stand.add(tank);
    const cap = new THREE.Mesh(capGeo, i === 3 ? oldEnamel : (i % 2 ? worn : iron));
    cap.position.y = 0.18 + spec.h;
    cap.scale.set(spec.r / 0.26, 0.34 + (i % 3) * 0.08, spec.r / 0.26);
    cap.castShadow = true;
    stand.add(cap);
    const riser = new THREE.Mesh(riserGeo, pipeMat);
    riser.position.y = spec.h + 0.48;
    riser.scale.y = 0.54 + (i % 2) * 0.25;
    stand.add(riser);

    const wheelSide = i % 2 ? 1 : -1;
    const valve = addValve(stand, wheelSide * (spec.r + 0.17),
      0.45 + spec.h * (0.42 + (i % 3) * 0.08), -spec.r * 0.72,
      0.14 + (i % 3) * 0.025, spec.broken);
    valve.rotation.y = wheelSide * 0.12;
    const valveStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, spec.r + 0.16, 7), pipeMat);
    valveStem.rotation.z = Math.PI / 2;
    valveStem.position.set(wheelSide * (spec.r + 0.03) / 2,
      valve.position.y, -spec.r * 0.72 + 0.02);
    stand.add(valveStem);
    const gaugeNeedles = [addGauge(stand, 0, spec.h + 0.67, -0.075, 0.86 + (i % 2) * 0.12)];

    // Every survivor has different anatomy and damage rather than a randomized
    // rescale of one prop: hand pump, pressure globe, twin piston, control box,
    // ruptured collar, and high expansion canister.
    if (spec.variant === 0) {
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.055), oldBrass);
      lever.position.set(0.18, spec.h + 0.82, 0);
      lever.rotation.z = 0.22;
      stand.add(lever);
    } else if (spec.variant === 1) {
      const globe = new THREE.Mesh(capGeo, worn);
      globe.position.set(0, spec.h + 0.46, 0.01);
      globe.scale.set(1.28, 1.08, 1.2);
      globe.castShadow = true;
      stand.add(globe);
    } else if (spec.variant === 2) {
      for (const sx of [-1, 1]) {
        const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.78, 9), oldEnamel);
        piston.position.set(sx * 0.19, 0.68, -0.04);
        stand.add(piston);
      }
      const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.09, 0.14), oldBrass);
      yoke.position.y = 1.08;
      stand.add(yoke);
    } else if (spec.variant === 3) {
      const controls = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.43, 0.22), oldEnamel);
      controls.position.set(0, 1.18, -0.24);
      controls.rotation.z = -0.04;
      stand.add(controls);
      gaugeNeedles.push(addGauge(stand, -0.13, 1.22, -0.356, 0.62));
      gaugeNeedles.push(addGauge(stand, 0.13, 1.22, -0.356, 0.62));
    } else if (spec.variant === 4) {
      const rupture = new THREE.Mesh(new THREE.TorusGeometry(spec.r * 0.76, 0.034, 6, 13), oldBrass);
      rupture.position.set(0.04, spec.h + 0.42, -0.02);
      rupture.rotation.x = Math.PI / 2;
      rupture.rotation.z = 0.18;
      stand.add(rupture);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(spec.r * 0.58, 11), needleMat);
      hole.position.set(0.04, spec.h + 0.43, -0.02);
      hole.rotation.x = -Math.PI / 2;
      stand.add(hole);
    } else {
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.72, 10), oldEnamel);
      hanger.position.set(0.02, 1.82, 0.03);
      hanger.scale.y = 0.82;
      stand.add(hanger);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.12), oldBrass);
      brace.position.set(0.02, 2.14, 0.03);
      stand.add(brace);
    }

    const feedX = spec.x + ((i % 2) * 2 - 1) * 0.12;
    pipeBetween(new THREE.Vector3(feedX, B + 2.28, 5.58),
      new THREE.Vector3(feedX, B + spec.h + 0.82, 5.58), 0.035 + (i % 2) * 0.008);
    pipeBetween(new THREE.Vector3(feedX, B + spec.h + 0.82, 5.58),
      new THREE.Vector3(spec.x, B + spec.h + 0.82, spec.z + 0.02), 0.035 + (i % 2) * 0.008);
    pumpStands.push({ group: stand, wheel: valve, needles: gaugeNeedles, phase: i * 0.76 });
  }

  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x070a0a, roughness: 0.16, metalness: 0.5,
    transparent: true, opacity: 0.52, depthWrite: false,
  });
  for (const [x, z, sx, sz] of [
    [-18.25, 4.76, 0.8, 0.34], [-16.55, 5.02, 0.58, 0.24],
    [-15.15, 4.69, 0.72, 0.3], [-13.86, 5.02, 0.46, 0.22],
  ]) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, B + 0.012, z);
    puddle.scale.set(sx, sz, 1);
    scene.add(puddle);
  }

  // Rivets and offset wear bands keep the paid-out bridge from reading as five
  // pristine slabs under the skull light.
  const rivetGeo = new THREE.SphereGeometry(0.025, 7, 5);
  for (let i = 0; i < bridgeSegments.length; i++) {
    const segment = bridgeSegments[i].mesh;
    for (const z of [-0.82, 0.82]) for (const x of [-0.18, 0.18]) {
      const rivet = new THREE.Mesh(rivetGeo, oldBrass);
      rivet.position.set(x, 0.067, z);
      segment.add(rivet);
    }
    const scar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 1.66 - i * 0.08), pipeMat);
    scar.position.set((i % 2 ? -1 : 1) * 0.13, 0.067, 0.03 * (i - 2));
    segment.add(scar);
  }
  world.candles.push({ x: -13.75, y: B + 1.7, z: -6.8, intensity: 1.3, r: 5 });
  world.candles.push({ x: -17.55, y: B + 0.75, z: -3, intensity: 0.8, r: 4 });

  const route = {
    id: 'pumpGallery', state: 'idle', progress: 0, latched: false, armed: false,
    gateOpen: false, heard: false, winch, cradle, pawl, water,
    archiveWake: 0, archivePumps: pumpStands,
    bridgeSegments: bridgeSegments.map((b) => b.mesh),
    gate, gateCollider, waterBarriers, target: null,
  };
  game.pumpGallery = route;

  // This district looks east beneath the entire furnished house. WebGL has no
  // occlusion culling, so without a sector mask it submitted hundreds of fully
  // ceiling-hidden props whenever the player faced the bridge. Capture the
  // already-built, wholly-above-cellar renderables once and remove only their
  // world layer while the player is deep in the sealed western works. Their
  // original masks are restored verbatim at the doorway, preserving puzzle
  // visibility and the mirror-only layer.
  scene.updateMatrixWorld(true);
  const upperSector = [];
  const upperBounds = new THREE.Box3();
  scene.traverse((object) => {
    if (!object.isMesh && !object.isLine && !object.isPoints) return;
    upperBounds.setFromObject(object, false);
    if (upperBounds.min.y > B + 2.42) {
      // Only this compact world-space window can be seen through the cellar
      // stair/return-flight openings (table cells x8..11,z7..9 after origin
      // conversion). Keep those local rails/walls/furnishings while culling
      // the rest of the furnished house behind solid basement ceilings.
      const cellarSightline = upperBounds.max.x >= 5.8 && upperBounds.min.x <= 13.0
        && upperBounds.max.z >= -0.2 && upperBounds.min.z <= 7.2;
      upperSector.push({ object, mask: object.layers.mask, cellarSightline });
    }
  });
  route.upperSector = upperSector;
  let upperSectorCulled = false;
  const setUpperSectorCulled = (culled) => {
    if (culled === upperSectorCulled) return;
    upperSectorCulled = culled;
    for (const entry of upperSector) {
      entry.object.layers.mask = culled && !entry.cellarSightline
        ? (entry.mask & ~1) : entry.mask;
    }
  };
  const anchorPos = new THREE.Vector3();
  route.target = world.addFetchTarget({
    id: 'pumpWinchCradle', object: cradle, radius: 0.56,
    onHit(skull) {
      if (route.latched) return 'return';
      if (skull.mode !== 'outbound') return 'continue';
      this.enabled = false;
      route.armed = true;
      route.state = 'paying-out';
      cradle.getWorldPosition(anchorPos);
      skull.anchorAt(anchorPos, {
        swing: true, maxHold: 24,
        puzzleId: route.id,
      });
      game.flag('pumpWinchTouched');
      game.impact('locked', anchorPos);
      game.audio.creak({ pos: anchorPos, gain: 0.67, rate: 0.62 });
      game.audio.metalDrop({ pos: winch.position, gain: 0.42, rate: 0.7 });
      return 'anchor';
    },
  });

  const setGateOpen = (open) => {
    if (route.gateOpen === open) return;
    route.gateOpen = open;
    if (open) {
      gateCollider.min.y = -20;
      gateCollider.max.y = -19;
    } else {
      gateCollider.min.y = B - 0.05;
      gateCollider.max.y = B + 2.25;
    }
  };
  game.tickers.push((dt, time) => {
    const skull = game.skull;
    setUpperSectorCulled(game.act === 'basement' && game.player.pos.y < -0.7);
    // The authored archive machinery is hidden behind two turns and a solid
    // doorway while the player works the bridge. Cull its many small valves,
    // gauges, and bolts until the player reaches that final approach; this
    // keeps the bridge composition comfortably inside the scene draw budget
    // without changing what can ever be seen from either side.
    // The archive is two solid turns west of the default cellar spawn.  Its
    // small valves/gauges have no business submitting through those walls;
    // reveal them only after the player actually reaches the west archive
    // approach.  The previous z-only test made the entire optional room render
    // from the ordinary basement start at x=9.
    const archiveDetailVisible = game.act === 'basement'
      && game.player.pos.x < -11.45 && game.player.pos.z > 0.35;
    for (const pump of pumpStands) pump.group.visible = archiveDetailVisible;
    const holding = skull && skull.mode === 'anchored'
      && skull.anchor && skull.anchor.puzzleId === route.id;
    if (!route.latched) {
      if (!holding && skull && skull.mode === 'held') {
        route.armed = false;
        route.target.enabled = true;
      }
      if (holding) {
        route.progress = Math.min(1, route.progress + dt / 2.05);
        route.state = route.progress >= 0.995 ? 'crossing-ready' : 'paying-out';
      } else {
        route.progress = Math.max(0, route.progress - dt * 0.34);
        route.state = route.progress > 0 ? 'rewinding' : 'idle';
      }
      const inBridgeLane = Math.abs(game.player.pos.z + 3) < 1.12;
      if (inBridgeLane && game.player.pos.x < -17.28 && route.progress > 0.9) {
        route.latched = true;
        route.progress = 1;
        route.state = 'latched';
        route.target.enabled = false;
        game.flag('pumpGalleryLatched');
        game.audio.metalDrop({ pos: pawl.position, gain: 0.94, rate: 0.58 });
        game.audio.stoneGrind({ pos: winch.position, gain: 0.42, rate: 1.35 });
        game.after(0.48, () => game.audio.knock({ pos: pumpStands[2].group.position, gain: 0.45, rate: 0.55 }));
        game.after(1.05, () => game.audio.whisper({ pos: pumpStands[4].group.position, gain: 0.3, rate: 0.65, verb: 0.9 }));
      }
    } else {
      route.progress = 1;
      route.state = 'latched';
    }

    const eased = route.progress * route.progress * (3 - 2 * route.progress);
    cradle.position.y = cradleBase.y - eased * 0.82;
    if (holding) {
      cradle.getWorldPosition(anchorPos);
      skull.pos.copy(anchorPos);
      skull.root.position.copy(anchorPos);
      skull.anchor.point.copy(anchorPos);
    }
    wheel.rotation.x = eased * TAU * 3.2;
    drum.rotation.x = eased * TAU * 2.1;
    const cableTop = B + 2.35;
    const cableBottom = cradle.position.y + 0.32;
    cable.scale.y = Math.max(0.04, cableTop - cableBottom);
    cable.position.set(cradleBase.x, (cableTop + cableBottom) / 2, cradleBase.z);
    cradleGlow.material.opacity = 0.12 + (holding ? 0.52 + Math.sin(time * 18) * 0.1 : 0);

    bridgeSegments.forEach((segment, i) => {
      const q = clamp(route.progress * 1.28 - i * 0.07, 0, 1);
      const e = q * q * (3 - 2 * q);
      segment.mesh.position.lerpVectors(segment.home, segment.goal, e);
      segment.mesh.rotation.z = (1 - e) * (0.3 + i * 0.04);
    });
    setGateOpen(route.latched || route.progress > 0.94);
    const gateGoal = route.gateOpen ? B - 2.3 : B;
    gate.position.y += (gateGoal - gate.position.y) * Math.min(1, dt * 4.2);
    jawTop.position.y += ((route.latched ? 0.08 : 0.28) - jawTop.position.y) * Math.min(1, dt * 7);
    jawBottom.position.y += ((route.latched ? -0.08 : -0.28) - jawBottom.position.y) * Math.min(1, dt * 7);
    water.material.opacity = 0.78 + Math.sin(time * 0.8) * 0.035;
    archiveLampCore.material.opacity = 0.5 + Math.sin(time * 17.3) * 0.055
      + Math.sin(time * 6.1) * 0.035;

    if (!route.heard && game.act === 'basement'
      && game.player.pos.distanceTo(new THREE.Vector3(-12.2, B, -3)) < 5.2) {
      route.heard = true;
      game.audio.knock({ pos: winch.position, gain: 0.38, rate: 0.54 });
      game.after(0.34, () => game.audio.creak({ pos: cradle.position, gain: 0.32, rate: 0.58 }));
    }
    if (route.latched) {
      route.archiveWake += dt;
      for (let i = 0; i < pumpStands.length; i++) {
        const pump = pumpStands[i];
        const wake = clamp((route.archiveWake - i * 0.16) * 1.3, 0, 1);
        // Pressure wakes in a staggered mechanical sentence: wheels creep and
        // needles argue with them. Nothing tracks the player like an enemy, but
        // the whole archive starts working only after the player enters it.
        pump.wheel.rotation.z += dt * wake * (i % 2 ? -0.22 : 0.28);
        for (let n = 0; n < pump.needles.length; n++) {
          pump.needles[n].rotation.z = -1.95 + wake * (1.12
            + Math.sin(time * (1.4 + i * 0.11) + pump.phase + n) * 0.16);
        }
      }
    }
  });
}

const _vDread = new THREE.Vector3();

// -------------------------------------------------- the door over the void
// Alex (playtest 3): "that random door is also perfect for a puzzle... the
// one you can open but not get into. not everything has to be a fucking key."
// The guest room's only door hangs over the stair shaft, out of any hand's
// reach. The skull is your hand: knock it open with a throw, and a candle
// flame waits in the doorway's light — steal it, and the skull carries fire
// in its sockets from then on. The room itself you never get.
function voidDoorAct(game) {
  const { world, scene, mats: M } = game;
  const F = HOUSE_TABLES.levels.first.floor;
  const door = world.doorById.voidDoor;

  // a tall iron candle-stand just inside, dead in line with the doorway —
  // from the stairs below, its flame floats in the open door's glow
  const stand = new THREE.Group();
  stand.position.set(5.3, F, -7);
  scene.add(stand);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.05, 1.28, 8), game.mats.metal);
  pole.position.y = 0.64;
  stand.add(pole);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.055, 0.05, 10), game.mats.metal);
  dish.position.y = 1.3;
  stand.add(dish);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.6 }));
  candle.position.y = 1.4;
  stand.add(candle);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc36c }));
  flame.position.y = 1.52;
  flame.scale.set(0.65, 1.8, 0.65);
  stand.add(flame);
  const glow = { x: 5.3, y: F + 1.55, z: -7, intensity: 1.6, r: 5 };
  world.candles.push(glow);

  const doorPos = new THREE.Vector3(4, F + 1.15, -7);
  const flameTarget = world.addFetchTarget({
    id: 'guestFlame', object: flame, radius: 0.6, enabled: false,
    onHit(skull) {
      this.enabled = false;
      flame.visible = false;
      const gi = world.candles.indexOf(glow);
      if (gi >= 0) world.candles.splice(gi, 1);
      game.audio.fireChoke({ pos: stand.position, gain: 0.4 });   // the flame dies into it
      game.audio.glassTink({ pos: stand.position, gain: 0.5, rate: 0.7 });
      // ember sockets: from now on it carries fire behind its eyes
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });
      const sockets = skull.sockets || [];
      const embersOn = [];
      for (const s of sockets.slice(0, 2)) {
        const p = s.getWorldPosition(new THREE.Vector3());
        skull.root.worldToLocal(p);
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 6), emberMat);
        ember.position.copy(p);
        ember.position.z += 0.012;
        skull.root.add(ember);
        embersOn.push([ember, s]);
      }
      game.tickers.push(() => {
        for (const [e, s] of embersOn) e.visible = s.visible;   // hide under the stage-5 face
      });
      // and your carried light warms and reaches further — brightness, not hue,
      // carries the upgrade (colorblind law)
      game.skullLight.intensity = 62;
      game.skullLight.distance = 12.5;
      game.skullLight.color.setHex(0xd8c8a4);
      game.flag('ateFlame');
      return 'return';
    },
  });
  flameTarget.enabled = false;

  let doorTarget = null;
  const openDoor = (source = 'skull') => {
    if (game.flags.has('voidDoorOpen')) return false;
    if (doorTarget) doorTarget.enabled = false;
    door.setOpen(true);
    game.audio.doorOpen(false, { pos: door.group.position });
    game.flag('voidDoorOpen');
    if (source === 'windowRelay') game.flag('voidDoorOpenedByRelay');
    flameTarget.enabled = true;
    return true;
  };
  doorTarget = world.addFetchTarget({
    id: 'voidDoor', pos: doorPos.clone(), radius: 0.8,
    onHit() {
      openDoor('skull');
      return 'return';
    },
  });
  game.voidDoorBeat = { door, target: doorTarget, flameTarget, open: openDoor };
}

export function makeKey(M) {
  const g = new THREE.Group();
  const bowMat = new THREE.MeshStandardMaterial({ color: 0xf0c55b, metalness: 0.9, roughness: 0.35, emissive: 0x6e4f10, emissiveIntensity: 1.15 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12), bowMat);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6), bowMat);
  stem.position.y = -0.1;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.012), bowMat);
  bit.position.set(0.02, -0.15, 0);
  g.add(bow, stem, bit);
  return g;
}

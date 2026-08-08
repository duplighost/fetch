// house.js — Acts 0-2: the bedroom, the house, the basement.
// Declarative tables for the world compiler + furnishing + the act-gating props.
// Grid: origin (-12,-14), 12x10 cells of 2m. Backyard begins at world z=6.
import * as THREE from 'three';
import { clamp } from './util.js';

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
    ['first', 8, 3, 'W', {}],                     // guest -> stairwell (closed)
    // basement
    ['basement', 5, 8, 'N', { ajar: true }],      // bcorr -> storeroom
    ['basement', 8, 5, 'W', { heavy: true }],     // storeroom -> boiler (closed: the key room)
    ['basement', 4, 5, 'W', { ajar: true }],      // storeroom -> crawl
    ['basement', 1, 8, 'N', { ajar: true }],      // crawl -> hatchbay
  ],
  windows: [
    ['ground', 1, 0, 'N', {}],
    ['ground', 0, 2, 'W', {}], ['ground', 0, 7, 'W', {}],
    ['ground', 11, 1, 'E', {}], ['ground', 11, 5, 'E', {}],
    ['ground', 9, 9, 'S', {}],
    ['first', 1, 9, 'S', {}], ['first', 11, 3, 'E', {}],
    ['first', 9, 9, 'S', { open: true, w: 1.7, id: 'bedroomWindow' }],   // THE window
    ['first', 5, 9, 'S', {}],
  ],
  ramps: [
    { x0: 6, x1: 7, z0: 2, z1: 5, axis: 'z', y0: 0, y1: 3.6, mat: 'woodDark' },   // main stairs (up toward the back)
    { x0: 10, x1: 11, z0: 8, z1: 9, axis: 'z', y0: 0, y1: -3.0, mat: 'stone' },   // cellar stairs
  ],
  floorHoles: [
    ['first', 6, 2, 7, 5],       // main stair shaft through first floor
    ['ground', 10, 8, 11, 9],    // cellar stair shaft through ground floor
  ],
  ceilHoles: [
    ['ground', 6, 2, 7, 5],      // stairbay looks up the shaft
    ['basement', 10, 8, 11, 9],  // bcorr east end looks up the cellar shaft
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
    cylinder(f, 0.52, 0.52, 1.18, D.iron, 0, 0.63, 0, 14);
    cylinder(f, 0.38, 0.52, 0.22, D.iron, 0, 1.33, 0, 14);
    box(f, 0.58, 0.5, 0.035, D.black, 0, 0.56, 0.53);
    box(f, 0.44, 0.045, 0.04, D.brass, 0, 0.8, 0.56);
    for (const sx of [-1, 1]) cylinder(f, 0.035, 0.05, 0.18, D.iron, sx * 0.28, 0.09, 0, 8);
    cylinder(f, 0.12, 0.14, 1.15, D.iron, 0.24, 2.0, -0.12, 10);
    return f;
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
  world.addZone('basement', -12, -12, 12, 6, -3.6, -0.4);
  world.addZone('house', -12.5, -14.5, 12.5, 6.5, -0.4, 7.2);
  world.addSurface('wood', -12, -14, 12, 6, -0.5, 7.2);
  world.addSurface('stone', 4, -6, 12, 6, -0.5, 3.4);   // kitchen flags
  world.addSurface('dirt', -12, -14, 12, 6, -3.6, -0.5); // cellar earth

  furnish(game);
  bedroomAct(game);
  nurseryAct(game);
  cellarBoards(game);
  basementAct(game);
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
  K.wardrobe(-5.0, F, 0.12, Math.PI / 2, 1.25, 2.0);
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
  const hearth = K.fireplace(-11.7, G, -8.0, Math.PI / 2);
  K.oilLamp(-11.58, hearth.top, -7.7);
  K.curtains(-9, G + 0.02, -13.84, 0, 1.55, 2.28);
  K.curtains(-11.84, G + 0.02, -9, Math.PI / 2, 1.55, 2.28);
  K.framedArt(-5.0, 1.75, -13.82, 0, 4, 0.8, 1.0);
  world.candles.push({ x: -11.1, y: G + 0.5, z: -8, intensity: 1.2, r: 4.5 });
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
  K.framedArt(4.16, 1.78, -9.8, Math.PI / 2, 0, 0.76, 0.95);
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
  K.bookshelf(-11.72, G, 1.1, Math.PI / 2, 1.65, 2.18);
  const studyDesk = K.desk(-8.85, G, 2.25, 0.18);
  K.chair(-8.5, G, 1.25, Math.PI + 0.18, true);
  K.paper(-9.08, studyDesk.top, 2.15, 0.05, 0.28, 0.35);
  K.book(-8.72, studyDesk.top, 2.35, -0.25, 1);
  K.sofa(-6.25, G, -1.15, -Math.PI / 2, 1.72);
  K.curtains(-11.84, G + 0.02, 1, Math.PI / 2, 1.55, 2.2);
  K.framedArt(-7.75, 1.76, 5.82, Math.PI, 1, 0.76, 0.94);
  K.framedArt(-5.2, 1.62, 3.7, -Math.PI / 2, 4, 0.58, 0.74);
  world.candles.push({ x: -9, y: G + 1.0, z: 2.2, intensity: 1.3, r: 4 });
  // foyer: coat stand, mirror frame (dark glass — the house mirror is elsewhere)
  K.rug(-1.9, G, -8.1, 1.25, 7.8);
  K.coatStand(-3.35, G, -12.65);
  const foyerConsole = K.consoleTable(-3.48, G, -7.7, Math.PI / 2, 1.05);
  K.bottle(-3.42, foyerConsole.top, -7.82, 0.65);
  K.blackMirror(-3.79, 1.7, -10.0, Math.PI / 2, 0.62, 1.05);
  K.framedArt(-3.8, 1.72, -5.1, Math.PI / 2, 2, 0.55, 0.72);
  K.rug(1.8, G, -12.0, 2.1, 2.6);
  K.consoleTable(3.45, G, -12.6, -Math.PI / 2, 0.9);
  K.rug(-0.2, G, 2.5, 1.35, 5.2);
  K.framedArt(-3.82, 1.68, 1.2, Math.PI / 2, 0, 0.55, 0.7);

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

  // webs across the basement corridor — brushed aside as you pass
  const webGeo = new THREE.PlaneGeometry(1.9, 2.2);
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(webGeo, game.mats.web);
    w.position.set(6.5 - i * 2.1, B + 1.2, 3.05 + (i % 2) * 0.5);
    w.rotation.y = Math.PI / 2 + (i - 2) * 0.12;
    scene.add(w);
    game.webs.push(w);
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
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.24, 0.08), M.woodDark);
    b.position.set(p.x + 0.65, 0.6 + i * 0.75, p.z + 0.16);
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

  // hatch key on the boiler tank — a pale glint in the dark
  const key = makeKey(M);
  key.position.set(10.6, B + 1.62, -3.4);
  scene.add(key);
  world.addFetchTarget({
    id: 'hatchKey', object: key, radius: 0.7,
    onHit(skull) {
      this.enabled = false;
      skull.grab('hatchKey', key);
      game.flag('gotHatchKey');
      return 'return';
    },
  });

  // the hatch: sloped bilco doors in the hatchbay ceiling corner, padlocked
  const hatch = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.9), M.metal);
  panel.rotation.x = -0.5;
  hatch.add(panel);
  hatch.position.set(-10, B + 2.1, 4.4);
  scene.add(hatch);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.08), M.metal);
  lock.position.set(-10, B + 1.75, 3.6);
  scene.add(lock);
  game.hatch = { group: hatch, panel, lock, open: false };

  world.addFetchTarget({
    id: 'hatchLock', object: lock, radius: 0.8,
    onHit(skull) {
      if (!skull.carry || skull.carry.id !== 'hatchKey') return 'return';
      this.enabled = false;
      const c = skull.dropCarry();
      c.mesh.visible = false;
      lock.visible = false;
      game.audio.unlock({ pos: lock.position });
      game.flag('hatchUnlocked');
      return 'return';
    },
  });

  world.registerInteract(panel, 'hatch', () => {
    if (!game.flags.has('hatchUnlocked')) {
      game.audio.lockedRattle({ pos: hatch.position });
      game.shake(0.12);
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

export function makeKey(M) {
  const g = new THREE.Group();
  const bowMat = new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.9, roughness: 0.35, emissive: 0x6e4f10, emissiveIntensity: 0.5 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12), bowMat);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6), bowMat);
  stem.position.y = -0.1;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.012), bowMat);
  bit.position.set(0.02, -0.15, 0);
  g.add(bow, stem, bit);
  return g;
}

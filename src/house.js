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
    // The 1.9 m opening admits the authored lower-stair skull arc before it
    // meets the frame; the stock 1.3 m doorway bounced that honest throw and
    // made the candle reachable only on the uncommitted return leg.
    ['first', 8, 3, 'W', { id: 'voidDoor', w: 1.9 }], // guest -> the door over the stair void
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
    // The tiny graveyard-facing scullery window is a real aperture. It remains
    // player-blocking, but the watched crawler and the skull can cross it.
    ['ground', 9, 9, 'S', { open: true, id: 'sculleryCrawlerWindow' }],
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

  // Most furniture is merged into the house's static material batches. A few
  // authored hero props need to be capable of changing between visits without
  // turning the whole room into loose draw calls. Passing `dynamic` builds the
  // exact same primitive rig under one transformable root instead.
  const frame = (x, y, z, ry = 0, dynamic = false) => {
    const f = { x, y, z, ry, root: null };
    if (dynamic) {
      f.root = new THREE.Group();
      f.root.position.set(x, y, z);
      f.root.rotation.y = ry;
      scene.add(f.root);
    }
    return f;
  };
  const worldXZ = (f, x, z) => ({
    x: f.x + Math.cos(f.ry) * x + Math.sin(f.ry) * z,
    z: f.z - Math.sin(f.ry) * x + Math.cos(f.ry) * z,
  });
  const box = (f, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) => {
    if (f.root) {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      o.position.set(x, y, z);
      o.rotation.y = ry;
      o.castShadow = true;
      o.receiveShadow = true;
      f.root.add(o);
      return o;
    }
    const p = worldXZ(f, x, z);
    world.box(mat, p.x, f.y + y, p.z, w, h, d, f.ry + ry);
    return null;
  };
  const mesh = (f, geometry, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true) => {
    const o = new THREE.Mesh(geometry, mat);
    if (f.root) {
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      f.root.add(o);
    } else {
      const p = worldXZ(f, x, z);
      o.position.set(p.x, f.y + y, p.z);
      const base = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, f.ry);
      const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
      o.quaternion.copy(base).multiply(local);
      scene.add(o);
    }
    o.castShadow = cast;
    o.receiveShadow = true;
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

  function chair(x, y, z, ry = 0, upholstered = false, dynamic = false) {
    const f = frame(x, y, z, ry, dynamic);
    box(f, 0.48, 0.07, 0.46, upholstered ? D.upholstery : D.woodMid, 0, 0.47, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      cylinder(f, 0.025, 0.04, sz < 0 ? 0.94 : 0.47, D.wood, sx * 0.19, (sz < 0 ? 0.94 : 0.47) / 2, sz * 0.18, 7);
    for (let i = -1; i <= 1; i++) box(f, 0.04, 0.38, 0.035, D.woodPale, i * 0.13, 0.72, -0.19);
    box(f, 0.5, 0.075, 0.055, D.woodMid, 0, 0.95, -0.19);
    return f;
  }

  function rockingChair(x, y, z, ry = 0, dynamic = false) {
    const f = frame(x, y, z, ry, dynamic);
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

  function framedArt(x, y, z, ry = 0, seed = 0, w = 0.68, h = 0.88, dynamic = false) {
    const f = frame(x, y, z, ry, dynamic);
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
  buildSculleryCrawler(game);
  buildHouseReturnHorror(game);
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
  const returnRockingChair = K.rockingChair(-6.3, F, 5.0, 0.38, true);
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
  let returnDiningChair = null;
  for (const z of [-11.45, -10.05, -8.65]) {
    if (z === -8.65) returnDiningChair = K.chair(8.25, G, z, -Math.PI / 2, false, true);
    else K.chair(8.25, G, z, -Math.PI / 2, false);
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
  const returnDiningPortrait = K.framedArt(4.16, 1.78, -8.9, Math.PI / 2, 0, 0.76, 0.95, true);
  game.houseReturnProps = {
    rockingChair: returnRockingChair.root,
    diningChair: returnDiningChair.root,
    diningPortrait: returnDiningPortrait.root,
  };
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
function wireCarriedKeyDoor(game, door, {
  keyId, targetId, flag, radius = 1.15,
}) {
  let target = null;
  const unlock = () => {
    const carry = game.skull.carry;
    if (!carry || carry.id !== keyId) return false;
    if (target) target.enabled = false;
    const dropped = game.skull.dropCarry();
    if (dropped?.mesh) dropped.mesh.visible = false;
    door.unlock(game);
    game.flag(flag);
    // The key turning is the irreversible commit. Door motion is a global,
    // idempotent consequence so a life-scope change can never leave the key
    // consumed while the visible panel remains inexplicably locked shut.
    game.after(0.42, () => {
      if (door.open) return;
      door.setOpen(true);
      game.audio.doorOpen(false, { pos: door.group.position });
    }, { global: true });
    return true;
  };
  const reject = (at) => {
    door.rattleT = Math.max(door.rattleT || 0, 0.45);
    game.impact('locked', at || door.panel.getWorldPosition(new THREE.Vector3()));
    game.audio.lockedRattle({ pos: door.group.position, gain: 0.82, rate: 0.9 });
    game.shake(0.1);
  };
  target = game.world.addFetchTarget({
    id: targetId,
    // Door.group is the hinge. The panel is the thing the player sees and
    // throws at; object-owned targeting follows its rotated world silhouette.
    object: door.panel,
    radius,
    onHit(skull, at) {
      if (skull.mode !== 'outbound') return 'continue';
      if (!unlock()) reject(at);
      return 'return';
    },
  });
  door.carriedUnlock = unlock;
  door.carriedUnlockTarget = target;
  return target;
}

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
      if (skull.mode !== 'outbound') return 'continue';
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
  wireCarriedKeyDoor(game, door, {
    keyId: 'bedroomKey', targetId: 'bedroomLock', flag: 'bedroomOpen', radius: 1.2,
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
  wireCarriedKeyDoor(game, door, {
    keyId: 'stairKey', targetId: 'stairLock', flag: 'stairsOpen', radius: 1.2,
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
      if (skull.mode !== 'outbound') return 'continue';
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
  // The bell circuit owns a second, plainly mechanical latch behind the wood.
  // The old build let three early board hits admit the player to a basement
  // whose required flame circuit had not been rung. Now the boards reveal this
  // bolt; the same physical bell that opens the guest flame room retracts it
  // and makes the basement pilot a deliberate second branch. The authored
  // route cannot run backwards, but it does not pretend one flame is mandatory.
  const latch = new THREE.Group();
  latch.name = 'cellar-bell-circuit-latch';
  latch.position.set(p.x + 0.65, 0, p.z - 0.235);
  scene.add(latch);
  const latchBrass = new THREE.MeshStandardMaterial({
    color: 0x9d7f43, roughness: 0.34, metalness: 0.84,
    emissive: 0x211707, emissiveIntensity: 0.24,
  });
  const latchIron = new THREE.MeshStandardMaterial({
    color: 0x2a3031, roughness: 0.58, metalness: 0.72,
  });
  const latchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.07), latchIron);
  latchPlate.name = 'cellar-bell-latch-striker';
  latchPlate.position.set(0, 1.48, 0);
  latch.add(latchPlate);
  const latchBell = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.19, 0.22, 14), latchBrass);
  latchBell.position.set(0, 1.61, -0.075);
  latchBell.rotation.x = Math.PI / 2;
  latch.add(latchBell);
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.15, 0.13), latchIron);
  bolt.name = 'cellar-bell-bolt';
  bolt.position.set(0, 1.1, 0);
  latch.add(bolt);
  for (const sx of [-1, 1]) {
    const guide = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14), latchBrass);
    guide.position.set(sx * 0.52, 1.1, -0.08);
    guide.rotation.x = Math.PI / 2;
    latch.add(guide);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 7), latchBrass);
  rod.position.set(0, 1.32, -0.04);
  latch.add(rod);

  let latchTarget = null;
  const circuitLatch = {
    group: latch, plate: latchPlate, bolt,
    engaged: true, releaseT: 0,
    release() {
      if (!this.engaged) return false;
      this.engaged = false;
      this.releaseT = 0.001;
      if (latchTarget) latchTarget.enabled = false;
      game.flag('cellarBellLatchReleased');
      game.audio.unlock({ pos: latch.position, gain: 0.68, rate: 0.72 });
      if (game.boards.every((board) => board.userData.off)) {
        door.locked = null;
        door.unlockedOnce = true;
        game.flag('cellarOpen');
      }
      return true;
    },
  };
  game.cellarRelayLatch = circuitLatch;
  latchTarget = world.addFetchTarget({
    id: 'cellarRelayLatch', object: latchPlate, radius: 0.62,
    onHit(skull, at) {
      if (skull.mode !== 'outbound') return 'continue';
      if (!circuitLatch.engaged) return 'continue';
      game.impact('locked', at || latchPlate.getWorldPosition(new THREE.Vector3()));
      game.audio.lockedRattle({ pos: latch.position, gain: 0.76, rate: 0.7 });
      game.windowRelay?.nudge?.();
      return 'return';
    },
  });
  // It is physically behind the planks. Enabling this target early let the
  // invisible latch steal centre-board throws before the visible wood could.
  latchTarget.enabled = false;
  game.tickers.push((dt, time) => {
    if (!circuitLatch.engaged) {
      circuitLatch.releaseT += dt;
      const q = clamp(circuitLatch.releaseT / 0.72, 0, 1);
      bolt.position.x = -q * 1.25;
      rod.rotation.z = -q * 1.1;
      latchBell.rotation.z = Math.sin(q * Math.PI * 4) * (1 - q) * 0.22;
    } else {
      latchBell.rotation.z = Math.sin(time * 0.55) * 0.008;
    }
  });
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
    // Three small points trace the whole 1.7 m silhouette. The old single
    // centre sphere left both visible ends inert; one shared commit now makes
    // left, centre, and right equally honest without permitting multi-breaks.
    const boardTargets = [];
    const breakBoard = (skull, at) => {
      // A returning skull can sweep back through the stacked boards. Only the
      // committed outbound contact owns destruction: one throw, one plank.
      if (skull.mode !== 'outbound' || b.userData.off) return 'continue';
      for (const target of boardTargets) target.enabled = false;
      // the board tears free and clatters — LOUD. the house hears it.
      game.impact('break', at);
      game.audio.pop({ pos: b.position, gain: 0.5, rate: 1.5 });
      game.detachBoard(b);
      if (game.boards.every((bb) => bb.userData.off)) {
        game.flag('cellarBoardsCleared');
        const circuitReleased = !circuitLatch.engaged
          || game.flags.has('windowRelaySolved');
        if (circuitReleased) {
          circuitLatch.release();
          door.locked = null;
          door.unlockedOnce = true;
          game.flag('cellarOpen');
        } else {
          door.locked = 'bellCircuit';
          door.unlockedOnce = false;
          latchTarget.enabled = true;
          game.audio.lockedRattle({ pos: latch.position, gain: 0.72, rate: 0.72 });
          game.windowRelay?.nudge?.();
        }
      }
      game.residentHeard(1);
      return 'return';
    };
    for (const [segment, x] of [['left', -0.58], ['center', 0], ['right', 0.58]]) {
      const point = new THREE.Object3D();
      point.name = `cellar-board-${i}-${segment}-target`;
      // Sit just proud of the timber/door plane so a correct visual hit is
      // committed before the underlying heavy-door collider can bounce it.
      point.position.set(x, 0, -0.42);
      b.add(point);
      const target = world.addFetchTarget({
        id: segment === 'center' ? `board${i}` : `board${i}:${segment}`,
        object: point, radius: 0.3, onHit: breakBoard,
      });
      boardTargets.push(target);
    }
    b.userData.fetchTargets = boardTargets;
  }
}

// The required bell deliberately feeds two visible flames: the unreachable
// guest candle above and this pilot on the first basement landing below. The
// player chooses which branch to steal from, but neither is a timeout or free
// state mutation: the skull must physically cross a flame. If an old checkpoint
// or geometry edge somehow enters the basement before the bell, this same
// tactile pilot safely trips the circuit instead of leaving a dead save.
function buildBasementPilot(game, B) {
  const { world, scene } = game;
  // These circuit fixtures sit directly in the skull lamp's near field. Unlit
  // iron/brass values preserve their silhouette there instead of blooming into
  // the featureless white bullseyes that the former metal materials produced.
  const brass = new THREE.MeshBasicMaterial({ color: 0x8c6d31, toneMapped: false });
  const brassEdge = new THREE.MeshBasicMaterial({ color: 0xb28e45, toneMapped: false });
  const iron = new THREE.MeshBasicMaterial({ color: 0x202526, toneMapped: false });
  const bellDark = new THREE.MeshBasicMaterial({ color: 0x171714, toneMapped: false });
  const porcelain = new THREE.MeshBasicMaterial({ color: 0x736956, toneMapped: false });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xe9a84a, transparent: true, opacity: 0.98,
    toneMapped: false,
  });
  const pilot = new THREE.Group();
  pilot.name = 'basement-required-pilot-bell';
  pilot.position.set(7, B, 5.48);
  scene.add(pilot);

  // A waist-to-ceiling brass line visibly belongs to the house-wide bell and
  // furnace circuit rather than reading as one more anonymous basement prop.
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.32, 8), brass);
  riser.position.set(0.42, 1.28, 0.08);
  pilot.add(riser);
  const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 7, 16, Math.PI / 2), brass);
  elbow.position.set(0.16, 2.44, 0.08);
  elbow.rotation.set(Math.PI / 2, 0, Math.PI);
  pilot.add(elbow);
  const header = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.78, 8), brass);
  header.position.set(-0.22, 2.44, 0.08);
  header.rotation.z = Math.PI / 2;
  pilot.add(header);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.22, 0.11), iron);
  back.position.set(0, 1.23, 0.03);
  pilot.add(back);
  const bellHanger = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.023, 0.25, 6), brassEdge);
  bellHanger.position.set(0, 2.04, -0.11);
  pilot.add(bellHanger);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.205, 0.28, 14), brass);
  cup.name = 'basement-pilot-servant-bell';
  cup.position.set(0, 1.82, -0.11);
  pilot.add(cup);
  const bellMouth = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 6, 20), brassEdge);
  bellMouth.position.set(0, 1.675, -0.11);
  bellMouth.rotation.x = Math.PI / 2;
  pilot.add(bellMouth);
  const clapperStem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.16, 6), bellDark);
  clapperStem.position.set(0, 1.61, -0.11);
  pilot.add(clapperStem);
  const clapper = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045, 0), brassEdge);
  clapper.position.set(0, 1.52, -0.11);
  pilot.add(clapper);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.58, 14, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x9eab9f, transparent: true, opacity: 0.28,
      roughness: 0.08, metalness: 0.12, depthWrite: false,
    }));
  glass.position.set(0, 0.99, -0.17);
  pilot.add(glass);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.28, 7), porcelain);
  wick.position.set(0, 0.88, -0.17);
  pilot.add(wick);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), flameMat);
  flame.name = 'basement-pilot-flame';
  flame.position.set(0, 1.08, -0.18);
  flame.scale.set(0.72, 1.42, 0.72);
  pilot.add(flame);
  for (let i = -2; i <= 2; i++) {
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.66, 6), brass);
    guard.position.set(i * 0.095, 1.0, -0.24);
    pilot.add(guard);
  }
  for (const y of [0.67, 1.33]) {
    const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 6, 18), brassEdge);
    cageRing.position.set(0, y, -0.2);
    cageRing.rotation.x = Math.PI / 2;
    pilot.add(cageRing);
  }
  const pilotGlow = { x: 7, y: B + 1.08, z: 5.3, intensity: 1.0, r: 4.8 };
  world.candles.push(pilotGlow);

  const source = { id: 'basement-pilot', flame, glow: pilotGlow, target: null };
  const target = world.addFetchTarget({
    id: 'basementPilotFlame', object: flame, radius: 0.76,
    onHit(skull, at) {
      if (skull.mode !== 'outbound') return 'continue';
      if (game.flags.has('ateFlame')) return 'return';
      game.windowRelay?.complete?.('basement-pilot', at || flame.getWorldPosition(new THREE.Vector3()));
      const absorbed = game.flameCircuit?.absorb?.(skull, source);
      if (!absorbed) return 'return';
      game.flag('basementPilotUsed');
      game.audio.fireChoke({ pos: flame.getWorldPosition(new THREE.Vector3()), gain: 0.52, rate: 0.72 });
      game.audio.metalDrop({ pos: pilot.position, gain: 0.5, rate: 1.35 });
      return 'return';
    },
  });
  source.target = target;
  game.flameCircuit?.register?.(source);
  const state = {
    group: pilot, flame, target, source,
    wasVisible: flame.visible, cueT: 0.8, pulse: 0,
    nudge() {
      if (game.flags.has('ateFlame')) return;
      this.pulse = 1.35;
      this.cueT = Math.max(this.cueT, 2.8);
      game.audio.glassTink({ pos: flame.getWorldPosition(new THREE.Vector3()), gain: 0.5, rate: 0.62 });
    },
  };
  game.basementPilot = state;
  game.tickers.push((dt, time) => {
    const active = !game.flags.has('ateFlame') && target.enabled;
    state.pulse = Math.max(0, state.pulse - dt);
    flame.scale.set(0.7, 1.32 + Math.sin(time * 15) * 0.13, 0.7);
    flame.material.opacity = active
      ? 0.88 + Math.sin(time * 19) * 0.08
      : 0;
    pilotGlow.intensity = active
      ? 0.94 + Math.sin(time * 9) * 0.12 + state.pulse * 0.7
      : 0;
    if (game.act !== 'basement' || !active || game.dead) return;
    state.cueT -= dt;
    if (state.cueT <= 0) {
      state.cueT = 5.2;
      game.audio.glassTink({ pos: flame.getWorldPosition(new THREE.Vector3()), gain: 0.2, rate: 0.78 });
    }
  });
}

// ---------------------------------------------------------------- act 2
function basementAct(game) {
  const { world, scene, mats: M } = game;
  const B = HOUSE_TABLES.levels.basement.floor;

  buildCrawlCounterweightSecret(game, B);
  buildBasementPilot(game, B);

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
  // BackSide, and this is the whole of "it never shows the fire". The cavity
  // was a solid FrontSide box, so the face nearest the player -- the one right
  // behind the open fire door -- was a black wall drawn in front of everything
  // it was supposed to contain. The ember bed has been sitting inside it,
  // invisible, since it was written. Rendering only the interior turns the box
  // back into what it is called: a cavity you can see into.
  const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x0a0503, side: THREE.BackSide }));
  cavity.position.set(0, 0.9, 0.26);
  inc.add(cavity);
  const embers = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.34), emberMat);
  embers.position.set(0, 0.62, 0.3);
  inc.add(embers);
  // ACTUAL FIRE. Alex: "This thing in the basement has a puzzle that is
  // supposed to turn it on with fire. it never shows the fire" -- and he was
  // right, literally: the firebox held a black cavity and a flat ember slab,
  // and the only thing that ever changed was that slab's COLOUR. He is
  // colourblind, so a hue ramp on a motionless box is not a state he can read
  // at all; it stayed a black rectangle in his screenshot, captioned "after
  // the puzzle, fire should be here".
  //
  // These are real tongues that grow out of the bed, lean, and flicker at
  // different rates. Height, motion and brightness carry the whole read, which
  // is the only kind that reaches him. They cost no light: the furnace already
  // owns a world.candles entry, so its illumination runs through the pooled
  // candle lights and cannot disturb the pinned shader light census.
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.26, 6), flameMat);
    f.position.set(-0.16 + i * 0.08, 0.66, 0.3 + ((i % 2) - 0.5) * 0.07);
    f.scale.setScalar(0.0001);
    f.visible = false;
    inc.add(f);
    flames.push(f);
  }
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
  // The pump gallery owns the furnace draft. A face-on pressure dial turns
  // that dependency into a visible sentence: dead needle before the far pawl,
  // a hard mechanical sweep when the under-house line finally takes pressure.
  const draftGauge = new THREE.Group();
  draftGauge.position.set(-0.37, 1.35, 0.515);
  inc.add(draftGauge);
  const gaugeFace = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 16), brass);
  gaugeFace.rotation.x = Math.PI / 2;
  draftGauge.add(gaugeFace);
  const gaugeVoid = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16),
    new THREE.MeshBasicMaterial({ color: 0x12100d }));
  gaugeVoid.position.z = 0.022;
  draftGauge.add(gaugeVoid);
  const gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.1, 0.012), brass);
  gaugeNeedle.position.set(0, 0.045, 0.035);
  gaugeNeedle.geometry.translate(0, -0.045, 0);
  gaugeNeedle.rotation.z = 1.18;
  draftGauge.add(gaugeNeedle);
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
  // Cold until a flame-bearing skull enters its circuit. Both authored flame
  // branches are therefore a visible cause of the furnace response rather than
  // optional decoration before an unrelated basement key.
  const glow = { x: 10.55, y: B + 0.95, z: -1.5, intensity: 0.035, r: 4.5 };
  world.candles.push(glow);

  const incin = {
    doorOpen: false, offered: false, refused: false,
    awake: false, wakePlayed: false, glowTarget: 0.035,
  };
  game.incinerator = incin;
  const incPos = new THREE.Vector3(11.0, B + 0.9, -1.5);
  game.incineratorPosition = incPos;
  let keyTarget = null;

  // One idempotent commit owns the irreversible refusal. Death changes a life
  // scope; it cannot turn a completed physical offering into a half-disabled
  // firebox with no key. Keeping every correlated field here also prevents a
  // late global timer from replaying the drop or resurrecting a collected key.
  const commitRefusal = () => {
    if (incin.refused) return false;
    incin.refused = true;
    incin.glowTarget = 0.08;
    game.flag('fireRefused');
    const collected = game.flags.has('gotHatchKey');
    key.visible = !collected;
    if (keyTarget) keyTarget.enabled = !collected;
    game.audio.metalDrop({ pos: incPos, gain: 0.8 });
    return true;
  };

  world.registerInteract(fireDoor, 'incineratorDoor', () => {
    if (incin.doorOpen) return;
    incin.doorOpen = true;
    game.audio.creak({ pos: incPos, gain: 0.7 });
    if (game.flags.has('ateFlame') && game.flags.has('pumpGalleryLatched')) {
      incin.awake = true;
      incin.glowTarget = 2.4;                    // the mouth recognizes what the skull carries
      fireboxTarget.enabled = true;
    } else {
      incin.glowTarget = 0.035;
      // An open mouth always accepts the player's throw. If the line has no
      // pressure yet, the throw answers physically and points back toward the
      // pump instead of passing through a gameplay-looking dead prop.
      fireboxTarget.enabled = true;
      game.audio.thud({ pos: incPos, gain: 0.42, rate: 0.56 });
      if (!game.flags.has('ateFlame')) game.after(0.18, () => game.basementPilot?.nudge?.());
    }
  });
  world.registerInteract(panBox, 'ashPan', () => {
    if (incin.refused) return;                   // open and empty-able by skull now
    game.audio.lockedRattle({ pos: incPos, gain: 0.6, rate: 1.4 });   // jammed
    game.shake(0.08);
  });

  const fireboxTarget = world.addFetchTarget({
    id: 'firebox', pos: incPos.clone(), radius: 0.55, enabled: false,
    onHit(skull) {
      if (skull.mode !== 'outbound') return 'continue';
      if (!game.flags.has('ateFlame')) {
        game.impact('locked', incPos);
        game.audio.fireChoke({ pos: incPos, gain: 0.22, rate: 0.58 });
        game.basementPilot?.nudge?.();
        return 'return';
      }
      if (!game.flags.has('pumpGalleryLatched')) {
        game.flag('incineratorNeedsDraft');
        game.impact('locked', incPos);
        game.audio.lockedRattle({ pos: draftGauge.getWorldPosition(new THREE.Vector3()), gain: 0.72, rate: 0.64 });
        game.pumpGallery?.nudge?.();
        return 'return';
      }
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
      }, { global: true });
      game.after(1.9, () => game.audio.skullChatter(0.5, incPos), { global: true });
      game.after(2.7, commitRefusal, { global: true });
      return 'anchor';
    },
  });
  fireboxTarget.enabled = false;

  keyTarget = world.addFetchTarget({
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
  game.tickers.push((dt, t) => {
    const hasDraft = game.flags.has('ateFlame') && game.flags.has('pumpGalleryLatched');
    if (!incin.awake && hasDraft) {
      incin.awake = true;
      game.flag('incineratorAwake');
      incin.glowTarget = incin.doorOpen ? 2.4 : 1.3;
      fireboxTarget.enabled = incin.doorOpen && !incin.offered;
      if (!incin.wakePlayed) {
        incin.wakePlayed = true;
        game.audio.knock({ pos: incPos, gain: 0.42, rate: 0.62 });
        game.after(0.18, () => game.audio.fireRoar({ pos: incPos, gain: 0.2, rate: 0.56 }));
      }
    }
    glow.intensity += (incin.glowTarget - glow.intensity) * Math.min(1, dt * 3.5);
    const gaugeGoal = game.flags.has('pumpGalleryLatched') ? -1.02 : 1.18;
    gaugeNeedle.rotation.z += (gaugeGoal - gaugeNeedle.rotation.z) * Math.min(1, dt * 4.6);
    const lit = clamp(glow.intensity / 1.3, 0.05, 2.2);
    emberMat.color.setRGB(1 * lit * 0.55 + 0.03, 0.3 * lit * 0.45 + 0.01, 0.08 * lit * 0.3);
    // The fire itself, driven off the same one number the glow is. Each tongue
    // runs its own two-rate flicker so the mass never pulses as one object.
    const fire = clamp((glow.intensity - 0.09) / 2.3, 0, 1.55);
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const flick = 0.74 + Math.sin(t * (7.3 + i * 2.1) + i * 1.7) * 0.19
        + Math.sin(t * (16.5 + i * 3.4)) * 0.07;
      const h = fire * flick;
      f.visible = h > 0.03;
      if (!f.visible) continue;
      f.scale.set(0.72 + h * 0.42, h, 0.72 + h * 0.42);
      f.position.y = 0.655 + h * 0.115;
      f.rotation.z = Math.sin(t * (3.1 + i * 0.8) + i) * 0.15 * h;
    }
    flameMat.opacity = clamp(0.5 + fire * 0.45, 0, 0.96);
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
      if (skull.mode !== 'outbound') return 'continue';
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
    }
    // Also retries a previously committed transition if an old save/test state
    // ever presents an already-open hatch in the basement.
    game.exitBasement();     // fade + climb out to the graveyard
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
  const backplateMat = iron.clone();
  backplateMat.color.setHex(0x181d1e);
  backplateMat.roughness = 0.8;
  backplateMat.emissive.setHex(0x020303);
  backplateMat.emissiveIntensity = 0.05;
  const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.65, 1.18), backplateMat);
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
    departureTarget: null, receiverTarget: null, directTarget: null, directTargets: [],
    dropT: 0, ringT: 0, nudgeT: 0, solveSource: null,
  };
  game.windowRelay = relay;
  const openings = Object.fromEntries(world.windowOpenings.map((o) => [o.id, o]));
  const flashWindows = (amount = 1) => {
    if (openings.livingRelayWindow) openings.livingRelayWindow.hot = Math.max(openings.livingRelayWindow.hot, amount);
    if (openings.studyRelayWindow) openings.studyRelayWindow.hot = Math.max(openings.studyRelayWindow.hot, amount);
  };
  relay.nudge = () => {
    if (relay.solved) return;
    relay.nudgeT = 1.25;
    flashWindows(1.2);
    // A strike on the unreachable door answers along the whole mechanism:
    // first the rail beside the player, then the far servant bell. The house
    // points spatially without a prompt, arrow, or magic highlight.
    game.audio.metalDrop({ pos: mooring.position, gain: 0.34, rate: 1.7 });
    game.after(0.18, () => game.audio.knock({ pos: receiver.position, gain: 0.42, rate: 1.42 }));
  };

  // One idempotent commit owns every legitimate way to ring the physical
  // servant bell. The old callback duplicated half this state and used only
  // generic metal/unlock noises, so an earned solve could look and sound like
  // another dead prop. bellRing is the dedicated positional one-shot supplied
  // by Audio; metal and door hardware remain secondary consequences.
  relay.complete = (source = 'trolley-return', at = null) => {
    if (relay.solved) return false;
    relay.solved = true;
    relay.armed = false;
    relay.state = 'rung';
    relay.solveSource = source;
    if (relay.visitor) relay.visitor.dismissed = true;
    relay.dropT = 0.001;
    relay.ringT = 1.9;
    if (relay.departureTarget) relay.departureTarget.enabled = false;
    if (relay.receiverTarget) relay.receiverTarget.enabled = false;
    for (const target of relay.directTargets) target.enabled = false;
    plateCollider.min.y = -20;
    plateCollider.max.y = -19;
    flashWindows(1.35);
    game.flag('windowRelaySolved');
    if (source === 'direct-bell') game.flag('windowRelayDirect');
    if (source === 'basement-pilot') game.flag('windowRelayBasementPilot');
    game.impact('pop', at || receiver.position);
    game.audio.bellRing?.({ pos: receiver.position, gain: 0.96, rate: 0.94 });
    game.audio.metalDrop({ pos: receiver.position, gain: 0.72, rate: 1.18 });
    game.after(0.16, () => game.audio.unlock({ pos: receiver.position, gain: 0.72, rate: 1.34 }));
    game.after(0.32, () => game.audio.knock({ pos: mooring.position, gain: 0.42, rate: 0.76 }));
    game.voidDoorBeat?.open?.('windowRelay');
    game.houseMirror?.signalRelay?.();
    game.cellarRelayLatch?.release?.();
    return true;
  };

  // Human-primary path: the study side now presents a brass striker in front
  // of the one-way plate. A normal outbound throw at the thing that plainly
  // looks like a bell rings it. The exterior mooring/trolley remains a richer
  // alternate solution, but it is no longer a secret ten-second prerequisite.
  const directStriker = new THREE.Group();
  directStriker.name = 'study-bell-direct-striker';
  directStriker.position.set(-10.72, G + 1.75, 1);
  scene.add(directStriker);
  // This fixture is close enough to the carried skull light that ordinary
  // metal shades bleach white. Stable unlit values keep the bell mouth,
  // clapper, bracket, and pull readable by form rather than glare.
  const strikerBrass = new THREE.MeshBasicMaterial({ color: 0x896c32, toneMapped: false });
  const strikerEdge = new THREE.MeshBasicMaterial({ color: 0xb18b43, toneMapped: false });
  const strikerDark = new THREE.MeshBasicMaterial({ color: 0x191713, toneMapped: false });
  const strikerCup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.07, 12), strikerEdge);
  strikerCup.name = 'study-bell-wall-rosette';
  strikerCup.rotation.z = Math.PI / 2;
  strikerCup.position.set(0.02, 0.22, 0);
  directStriker.add(strikerCup);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.07), strikerBrass);
  bracket.position.set(0.04, 0.04, 0);
  bracket.rotation.z = -0.16;
  directStriker.add(bracket);
  const strikerHanger = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.18, 6), strikerEdge);
  strikerHanger.position.set(0.07, -0.18, 0);
  directStriker.add(strikerHanger);
  const strikerBell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.265, 0.32, 14), strikerBrass);
  strikerBell.name = 'study-bell-mouth-body';
  strikerBell.position.set(0.07, -0.41, 0);
  directStriker.add(strikerBell);
  const strikerMouth = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.028, 6, 20), strikerEdge);
  strikerMouth.position.set(0.07, -0.575, 0);
  strikerMouth.rotation.x = Math.PI / 2;
  directStriker.add(strikerMouth);
  const strikerClapperStem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.2, 6), strikerDark);
  strikerClapperStem.position.set(0.07, -0.61, 0);
  directStriker.add(strikerClapperStem);
  const strikerClapper = new THREE.Mesh(new THREE.DodecahedronGeometry(0.052, 0), strikerEdge);
  strikerClapper.position.set(0.07, -0.735, 0);
  directStriker.add(strikerClapper);
  const pullCord = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.78, 6), strikerDark);
  pullCord.position.set(0.045, -0.45, 0.36);
  directStriker.add(pullCord);
  const pullHandle = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 14), strikerEdge);
  pullHandle.position.set(0.045, -0.87, 0.36);
  directStriker.add(pullHandle);
  relay.directStriker = directStriker;
  // Target the actual visible silhouette, not the group's empty pivot. The
  // original pivot sphere stopped just above the bell mouth and far above the
  // pull, recreating the exact “I threw at the bell and nothing happened” bug.
  const directHit = (skull, at) => {
    if (skull.mode !== 'outbound') return 'continue';
    relay.complete('direct-bell', at || directStriker.position);
    return 'return';
  };
  for (const [id, local, radius] of [
    ['studyBellRosette', [0.02, 0.22, 0], 0.14],
    ['studyBellMouth', [0.07, -0.48, 0], 0.25],
    ['studyBellClapper', [0.07, -0.735, 0], 0.11],
    ['studyBellPull', [0.045, -0.87, 0.36], 0.14],
  ]) {
    const point = new THREE.Object3D();
    point.name = `${id}-target`;
    point.position.set(...local);
    directStriker.add(point);
    const target = world.addFetchTarget({ id, object: point, radius, onHit: directHit });
    relay.directTargets.push(target);
    if (id === 'studyBellMouth') relay.directTarget = target;
  }

  // The relay has an inhabitant. Mooring the skull at the living-room window
  // puts a bright guard on the sill; carrying that light down the outside rail
  // lets something climb in behind it. Direct sight freezes each authored
  // silhouette. Ringing the receiver dismisses the body but not the wet proof
  // that it crossed the aperture. This is causal horror, never a random timer.
  const visitorRoot = new THREE.Group();
  visitorRoot.name = 'window-relay-visitor';
  visitorRoot.position.set(-12.04, G, -9);
  scene.add(visitorRoot);
  const visitorSkin = new THREE.MeshStandardMaterial({
    color: 0x777973, roughness: 0.96,
    emissive: 0x090a09, emissiveIntensity: 0.15,
  });
  const visitorCloth = new THREE.MeshStandardMaterial({
    color: 0x0a0c0d, roughness: 0.98,
  });
  const visitorWet = new THREE.MeshStandardMaterial({
    color: 0x080b0b, roughness: 0.18, metalness: 0.06,
    transparent: true, opacity: 0.72, depthWrite: false,
  });
  const visitorStages = [];
  const stage0 = new THREE.Group();
  for (const side of [-1, 1]) {
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.13, 0.16), visitorSkin);
    palm.position.set(0.015, 1.08, side * 0.22);
    palm.rotation.z = side * 0.08;
    stage0.add(palm);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.24 + i * 0.014, 6), visitorSkin);
      finger.position.set(0.065, 0.97 - i * 0.006, side * 0.22 + (i - 1.5) * 0.034);
      finger.rotation.z = 0.13 + i * 0.035;
      stage0.add(finger);
    }
  }
  visitorRoot.add(stage0);
  visitorStages.push(stage0);

  const stage1 = new THREE.Group();
  const shoulder = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.66, 3, 8), visitorCloth);
  shoulder.position.set(-0.28, 1.32, 0.02);
  shoulder.rotation.z = 0.68;
  shoulder.scale.set(0.78, 1, 0.56);
  stage1.add(shoulder);
  const outsideHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), visitorSkin);
  outsideHead.position.set(-0.18, 1.88, 0.03);
  outsideHead.scale.set(0.7, 1.15, 0.82);
  outsideHead.rotation.z = 0.22;
  stage1.add(outsideHead);
  for (const z of [-0.19, -0.06, 0.07, 0.2]) {
    const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.016, 0.29, 6), visitorSkin);
    finger.position.set(0.055, 1.06, z);
    finger.rotation.z = 0.18;
    stage1.add(finger);
  }
  visitorRoot.add(stage1);
  visitorStages.push(stage1);

  const stage2 = new THREE.Group();
  const crawlingTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.7, 3, 8), visitorCloth);
  crawlingTorso.position.set(0.31, 1.25, 0);
  crawlingTorso.rotation.z = Math.PI / 2.35;
  crawlingTorso.scale.set(0.82, 1, 0.58);
  stage2.add(crawlingTorso);
  const crawlingHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), visitorSkin);
  crawlingHead.position.set(0.5, 1.43, -0.02);
  crawlingHead.scale.set(0.72, 1.13, 0.82);
  stage2.add(crawlingHead);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.52, 3, 6), visitorSkin);
    arm.position.set(0.35, 1.03, side * 0.28);
    arm.rotation.z = 1.18;
    arm.rotation.x = side * 0.2;
    stage2.add(arm);
  }
  visitorRoot.add(stage2);
  visitorStages.push(stage2);

  const stage3 = new THREE.Group();
  const insideTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.88, 3, 8), visitorCloth);
  insideTorso.position.set(0.72, 0.86, 0.04);
  insideTorso.rotation.z = 0.38;
  insideTorso.scale.set(0.72, 1, 0.54);
  stage3.add(insideTorso);
  const insideHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), visitorSkin);
  insideHead.position.set(0.57, 1.55, -0.02);
  insideHead.scale.set(0.7, 1.16, 0.8);
  insideHead.rotation.z = -0.28;
  stage3.add(insideHead);
  const floorHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.22), visitorSkin);
  floorHand.position.set(1.04, 0.08, -0.29);
  stage3.add(floorHand);
  visitorRoot.add(stage3);
  visitorStages.push(stage3);
  for (const stage of visitorStages) stage.visible = false;

  const wetProof = new THREE.Group();
  wetProof.name = 'window-visitor-wet-proof';
  wetProof.visible = false;
  scene.add(wetProof);
  for (let i = 0; i < 5; i++) {
    const heel = new THREE.Mesh(new THREE.CircleGeometry(0.085, 10), visitorWet);
    heel.position.set(-11.28 + i * 0.36, G + 0.006, -9 + (i % 2 ? 0.17 : -0.12));
    heel.rotation.x = -Math.PI / 2;
    heel.scale.set(0.72, 1.35, 1);
    wetProof.add(heel);
  }
  for (const z of [-0.18, 0.18]) {
    const smear = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), visitorWet);
    smear.position.set(-11.93, G + 1.05, -9 + z);
    smear.rotation.y = Math.PI / 2;
    smear.scale.set(0.55, 1.5, 1);
    wetProof.add(smear);
  }

  // The apparently empty guest room receives the later echo Alex asked for.
  // It starts only after the player has a genuine view of the window; missing
  // it is allowed, and it never takes the camera or deals damage.
  const guestCrossing = new THREE.Group();
  guestCrossing.name = 'guest-window-crossing';
  const crossBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.94, 3, 8), visitorCloth);
  crossBody.position.y = 0.86;
  crossBody.scale.set(0.62, 1, 0.45);
  guestCrossing.add(crossBody);
  const crossHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), visitorSkin);
  crossHead.position.set(0, 1.56, 0);
  crossHead.scale.set(0.66, 1.15, 0.78);
  guestCrossing.add(crossHead);
  guestCrossing.position.set(11.72, HOUSE_TABLES.levels.first.floor, -8.05);
  guestCrossing.visible = false;
  scene.add(guestCrossing);

  const visitor = {
    progress: 0, stage: -1, active: false, entered: false,
    dismissed: false, watched: false, lit: true,
    crossed: false, crossT: 0,
    root: visitorRoot, stages: visitorStages, proof: wetProof,
    guestCrossing,
  };
  relay.visitor = visitor;
  const visitorFocus = new THREE.Vector3(-11.86, G + 1.55, -9);
  const guestFocus = new THREE.Vector3(11.72, HOUSE_TABLES.levels.first.floor + 1.45, -7);
  const visitorEye = new THREE.Vector3();
  const visitorDir = new THREE.Vector3();
  const visitorTo = new THREE.Vector3();
  const isWatched = (point, minDot, maxDistance) => {
    const eye = game.camera.getWorldPosition(visitorEye);
    const distance = visitorTo.copy(point).sub(eye).length();
    if (distance > maxDistance || distance < 0.1) return false;
    game.camera.getWorldDirection(visitorDir);
    return visitorDir.dot(visitorTo.multiplyScalar(1 / distance)) > minDot;
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
      visitor.active = true;
      visitor.progress = Math.max(visitor.progress, 0.06);
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
    onHit(skull, at) {
      if (relay.solved || !relay.armed || skull.mode !== 'returning') return 'continue';
      relay.complete('trolley-return', at || receiver.position);
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
      // Once the player has physically carried the trolley to the study end,
      // releasing there is itself an unambiguous strike. This plane-level
      // qualification accepts ordinary retained return arcs that skim the
      // small receiver sphere by a few centimetres.
      if (skull.mode === 'returning' && mooring.position.z >= 0.18) {
        relay.complete('trolley-release', receiver.position);
      }
      if (skull.mode === 'held') {
        relay.armed = false;
        relay.state = 'idle';
        relay.departureTarget.enabled = true;
      }
    } else if (!relay.solved && skull && skull.mode === 'held') {
      mooring.position.z += clamp(-9 - mooring.position.z, -dt * 4.5, dt * 4.5);
    }
    trolleyCable.position.z = mooring.position.z;
    relay.nudgeT = Math.max(0, relay.nudgeT - dt);
    const nudge = relay.nudgeT > 0 ? Math.sin(time * 38) * relay.nudgeT : 0;
    trolleyCable.rotation.x = nudge * 0.055;
    mooring.rotation.x = Math.sin(time * (anchored ? 11 : 1.7)) * (anchored ? 0.055 : 0.012)
      + nudge * 0.025;
    mooringCore.material.opacity = 0.08
      + (anchored ? 0.5 + Math.sin(time * 19) * 0.12 : 0.04)
      + relay.nudgeT * 0.22;
    bellRingMat.emissiveIntensity = 0.12
      + (relay.solved ? 0.2 + Math.sin(time * 13) * 0.045 : relay.armed ? 0.27 + Math.sin(time * 9) * 0.06 : 0);
    if (relay.ringT > 0) {
      relay.ringT = Math.max(0, relay.ringT - dt);
      receiver.rotation.x = Math.sin(time * 34) * relay.ringT * 0.045;
      clapper.position.z = Math.sin(time * 38) * relay.ringT * 0.07;
      directStriker.rotation.x = Math.sin(time * 31) * relay.ringT * 0.055;
      strikerBell.rotation.z = Math.sin(time * 39) * relay.ringT * 0.16;
    } else {
      receiver.rotation.x *= Math.exp(-dt * 12);
      clapper.position.z *= Math.exp(-dt * 12);
      directStriker.rotation.x *= Math.exp(-dt * 12);
      strikerBell.rotation.z *= Math.exp(-dt * 12);
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

    // Window visitor state. The living-room aperture itself is the only valid
    // sightline for the outside stages, preventing psychic through-wall gaze.
    const p = game.player.pos;
    const inLiving = game.act === 'house' && p.y < 2.95
      && p.x >= -12.2 && p.x <= -3.8 && p.z >= -14.2 && p.z <= -3.8;
    visitor.watched = inLiving && isWatched(visitorFocus, 0.935, 10.5);
    visitor.lit = game.skull.pos.distanceTo(visitorFocus) < 2.45;
    if (visitor.active && !visitor.dismissed && relay.armed && !game.dead) {
      if (!visitor.watched && !visitor.lit) visitor.progress = Math.min(3.35, visitor.progress + dt * 0.5);
      if (visitor.watched) game.flag('windowVisitorSeen');
    } else if (!relay.solved && (!relay.armed || game.dead)) {
      visitor.progress = Math.max(0, visitor.progress - dt * 1.8);
      if (visitor.progress <= 0.001) visitor.active = false;
    }
    if (visitor.dismissed) visitor.progress = Math.max(0, visitor.progress - dt * 3.6);

    const nextStage = visitor.progress <= 0.01 ? -1 : Math.min(3, Math.floor(visitor.progress / 0.82));
    if (nextStage !== visitor.stage) {
      const advancing = nextStage > visitor.stage;
      visitor.stage = nextStage;
      if (advancing && nextStage >= 0) {
        game.audio.creak({ pos: visitorFocus, gain: 0.16 + nextStage * 0.05, rate: 1.48 - nextStage * 0.17 });
        if (nextStage === 2) game.audio.glassTink({ pos: visitorFocus, gain: 0.22, rate: 0.48 });
      }
    }
    for (let i = 0; i < visitorStages.length; i++) visitorStages[i].visible = i === visitor.stage;
    if (!visitor.entered && visitor.progress >= 2.45) {
      visitor.entered = true;
      game.flag('windowVisitorEntered');
    }
    wetProof.visible = visitor.entered && (visitor.dismissed || visitor.stage >= 3);

    if (relay.solved && visitor.entered && !visitor.crossed && game.act === 'house'
      && p.y > 3.2 && p.x > 1.5 && p.z > -10.5 && p.z < -1.5
      && isWatched(guestFocus, 0.9, 11)) {
      visitor.crossed = true;
      visitor.crossT = 0.001;
      game.flag('guestWindowCrossing');
      game.audio.creak({ pos: guestFocus, gain: 0.31, rate: 0.74 });
    }
    if (visitor.crossT > 0) {
      visitor.crossT += dt;
      const q = clamp(visitor.crossT / 1.35, 0, 1);
      guestCrossing.visible = q < 1;
      guestCrossing.position.z = -8.05 + q * 2.2;
      guestCrossing.rotation.z = Math.sin(q * Math.PI) * 0.12;
      if (q >= 1) visitor.crossT = 0;
    } else guestCrossing.visible = false;
  });
}

// ----------------------------------------- watched scullery-window crossing
// The small south-facing scullery window in Alex's screenshot is its own
// authored scare, not the living-room relay visitor. Looking out through the
// real aperture invites a soaked figure to climb toward the gaze. Continued
// watching advances its weight from earth to sill to room; looking away freezes
// the crossing. The camera and player remain completely live throughout.
function buildSculleryCrawler(game) {
  const { world, scene } = game;
  const opening = world.windowOpenings.find((o) => o.id === 'sculleryCrawlerWindow');
  if (!opening) return;
  // The crawler approaches the skull lamp head-on. Unlit corpse/cloth values
  // stop that near-field light from flattening her into a white comedy mask;
  // the layered faceted anatomy and hair silhouette provide the modelling.
  const skin = new THREE.MeshBasicMaterial({ color: 0x4b4b45, toneMapped: false });
  const bruised = new THREE.MeshBasicMaterial({ color: 0x302f2c, toneMapped: false });
  const cloth = new THREE.MeshBasicMaterial({ color: 0x101313, toneMapped: false });
  const hair = new THREE.MeshBasicMaterial({ color: 0x070808, toneMapped: false, side: THREE.DoubleSide });
  const wet = new THREE.MeshStandardMaterial({
    color: 0x080c0d, roughness: 0.14, metalness: 0.04,
    transparent: true, opacity: 0.72, depthWrite: false,
  });
  const faceVoid = new THREE.MeshBasicMaterial({ color: 0x030303 });
  const eyeGlint = new THREE.MeshBasicMaterial({
    color: 0xbfc1b4, transparent: true, opacity: 0.54,
    toneMapped: false,
  });

  const root = new THREE.Group();
  root.name = 'scullery-window-watched-crawler';
  root.visible = false;
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);

  // Faceted, tapered volumes keep the silhouette anatomical without importing
  // another asset or falling back to the old orb/cylinder mannequin language.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.82, 7), cloth);
  torso.name = 'crawler-rib-waist-volume';
  torso.position.y = 0.62;
  torso.scale.z = 0.62;
  body.add(torso);
  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.32, 7), cloth);
  shoulders.name = 'crawler-shoulder-volume';
  shoulders.position.y = 0.94;
  shoulders.rotation.z = Math.PI / 2;
  shoulders.scale.z = 0.62;
  body.add(shoulders);
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.28, 7), cloth);
  pelvis.name = 'crawler-pelvis-volume';
  pelvis.position.set(0.02, 0.15, 0.01);
  pelvis.scale.z = 0.72;
  body.add(pelvis);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), skin);
  head.name = 'crawler-faceted-head';
  head.position.set(-0.025, 1.28, -0.02);
  head.scale.set(0.76, 1.22, 0.82);
  head.rotation.set(-0.08, 0.12, -0.12);
  body.add(head);
  const hairCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.155, 1), hair);
  hairCap.name = 'crawler-wet-hair-cap';
  hairCap.position.set(-0.02, 1.365, 0.045);
  hairCap.scale.set(0.86, 1.04, 0.82);
  hairCap.rotation.set(-0.05, 0.1, -0.14);
  body.add(hairCap);
  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.19, 6), bruised);
  jaw.position.set(-0.02, 1.11, -0.075);
  jaw.scale.z = 0.7;
  body.add(jaw);
  for (const sx of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.DodecahedronGeometry(0.043, 0), faceVoid);
    socket.position.set(sx * 0.061 - 0.025, 1.315, -0.148);
    socket.scale.set(1.16, 0.62, 0.4);
    body.add(socket);
    const glint = new THREE.Mesh(new THREE.DodecahedronGeometry(0.012, 0), eyeGlint);
    glint.position.set(sx * 0.061 - 0.025, 1.318, -0.171);
    body.add(glint);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 4), bruised);
  nose.position.set(-0.025, 1.255, -0.16);
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.z = Math.PI / 4;
  body.add(nose);
  for (const [x, a] of [[-0.045, -0.34], [0.01, 0.26]]) {
    const mouthCut = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.013, 0.014), faceVoid);
    mouthCut.position.set(x, 1.18, -0.169);
    mouthCut.rotation.z = a;
    body.add(mouthCut);
  }

  // Two ragged front curtains cross the cheeks asymmetrically. They keep the
  // eyes glimpsed through wet hair instead of presenting a centered mask.
  const fringeGeo = new THREE.BufferGeometry();
  fringeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.18, 1.48, -0.185, -0.045, 1.47, -0.205, -0.085, 0.93, -0.215,
    -0.18, 1.48, -0.185, -0.085, 0.93, -0.215, -0.205, 1.08, -0.175,
     0.035, 1.49, -0.205, 0.16, 1.43, -0.18, 0.13, 1.01, -0.205,
     0.035, 1.49, -0.205, 0.13, 1.01, -0.205, 0.055, 1.12, -0.225,
  ], 3));
  fringeGeo.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  fringeGeo.computeVertexNormals();
  const fringe = new THREE.Mesh(fringeGeo, hair);
  fringe.name = 'crawler-face-wet-hair-curtains';
  body.add(fringe);

  // Long wet hair hangs in asymmetric planar ropes. Each strip has its own
  // length and cant, keeping the head readable while breaking primitive symmetry.
  for (let i = 0; i < 9; i++) {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.055 + (i % 3) * 0.012,
      0.55 + (i % 4) * 0.11, 5), hair);
    const side = i < 5 ? -1 : 1;
    lock.position.set(side * (0.09 + (i % 3) * 0.045), 1.11 - (i % 2) * 0.08,
      -0.005 + (i % 4) * 0.025);
    lock.rotation.z = side * (0.16 + (i % 3) * 0.08);
    lock.rotation.x = 0.08 + (i % 2) * 0.1;
    body.add(lock);
  }

  const between = (name, a, b, ra, rb, material, parent = body, radial = 7) => {
    const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, delta.length(), radial), material);
    mesh.name = name;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    parent.add(mesh);
    return mesh;
  };
  const joints = {};
  for (const side of [-1, 1]) {
    const tag = side < 0 ? 'left' : 'right';
    const shoulder = new THREE.Vector3(side * 0.31, 0.91, 0);
    const elbow = new THREE.Vector3(side * (0.48 + (side < 0 ? 0.04 : -0.02)), 0.48,
      side < 0 ? -0.06 : 0.1);
    const wrist = new THREE.Vector3(side * (0.37 + (side > 0 ? 0.1 : 0)), 0.02,
      side < 0 ? -0.18 : 0.2);
    joints[`${tag}UpperArm`] = between(`crawler-${tag}-upper-arm`, shoulder, elbow, 0.075, 0.058, skin);
    joints[`${tag}Forearm`] = between(`crawler-${tag}-forearm`, elbow, wrist, 0.063, 0.038, skin);
    const hand = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 0), skin);
    hand.name = `crawler-${tag}-hand`;
    hand.position.copy(wrist);
    hand.scale.set(0.82, 0.42, 1.15);
    body.add(hand);
    for (let finger = 0; finger < 4; finger++) {
      const base = wrist.clone().add(new THREE.Vector3(
        side * ((finger - 1.5) * 0.018), -0.055, (finger - 1.5) * 0.028));
      const tip = base.clone().add(new THREE.Vector3(
        side * (0.02 + finger * 0.006), -0.16 - finger * 0.013, -0.015));
      between(`crawler-${tag}-finger-${finger}`, base, tip, 0.014, 0.006, skin);
    }
    const hip = new THREE.Vector3(side * 0.18, 0.17, 0.02);
    const knee = new THREE.Vector3(side * (0.29 + (side > 0 ? 0.05 : 0)), -0.31,
      side < 0 ? 0.16 : -0.13);
    const ankle = new THREE.Vector3(side * (0.34 + (side < 0 ? 0.07 : 0)), -0.74,
      side < 0 ? -0.04 : 0.18);
    joints[`${tag}Thigh`] = between(`crawler-${tag}-thigh`, hip, knee, 0.105, 0.075, cloth);
    joints[`${tag}Shin`] = between(`crawler-${tag}-shin`, knee, ankle, 0.078, 0.042, bruised);
    const foot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), bruised);
    foot.name = `crawler-${tag}-foot`;
    foot.position.copy(ankle).add(new THREE.Vector3(0, -0.04, -0.11));
    foot.scale.set(0.65, 0.42, 1.35);
    body.add(foot);
  }

  // Torn cloth panels and one displaced shoulder make body orientation legible
  // as its weight rolls over the sill.
  const tearGeo = new THREE.BufferGeometry();
  tearGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.25, 0.7, 0.05, 0.02, 0.72, 0.12, -0.13, -0.08, 0.16,
    0.06, 0.76, 0.11, 0.29, 0.66, 0.02, 0.24, -0.22, 0.13,
  ], 3));
  tearGeo.setIndex([0, 1, 2, 3, 4, 5]);
  tearGeo.computeVertexNormals();
  const tears = new THREE.Mesh(tearGeo, cloth);
  tears.name = 'crawler-asymmetric-torn-coat';
  body.add(tears);

  const proof = new THREE.Group();
  proof.name = 'scullery-crawler-wet-contact';
  scene.add(proof);
  const sillSmear = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), wet);
  sillSmear.position.set(opening.center.x, 1.02, 5.935);
  sillSmear.rotation.x = -Math.PI / 2;
  sillSmear.visible = false;
  proof.add(sillSmear);
  const floorSmear = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.46), wet);
  floorSmear.position.set(opening.center.x - 0.08, 0.012, 5.05);
  floorSmear.rotation.x = -Math.PI / 2;
  floorSmear.visible = false;
  proof.add(floorSmear);
  for (const side of [-1, 1]) {
    const print = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 0), wet);
    print.position.set(opening.center.x + side * 0.28, 1.04, 5.91);
    print.scale.set(0.72, 0.22, 1.18);
    print.visible = false;
    proof.add(print);
  }

  // Every body material is local to this apparition. Keep its authored base
  // opacity so a close-range recoil can visibly dissolve the whole silhouette
  // without fading the wet contact evidence with it.
  const dissolveMaterials = new Map();
  body.traverse((part) => {
    if (!part.isMesh) return;
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const material of materials) {
      if (material && !dissolveMaterials.has(material)) {
        dissolveMaterials.set(material, material.opacity ?? 1);
      }
    }
  });

  const focus = opening.center.clone().add(new THREE.Vector3(0, 0.02, 0.34));
  const eye = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const toFocus = new THREE.Vector3();
  const crawler = {
    root, body, proof, focus,
    triggered: false, entered: false, watched: false,
    gazeT: 0, progress: 0, stage: -1, stageHistory: [],
    settledT: 0, lookAwayT: 0, vanished: false, deathReset: false,
    resolving: false, resolved: false, resolveT: 0, resolveReason: null,
    resolveAtDistance: null, resolveProgress: null,
    proximityThreshold: 1.48, safeClearance: 1.05,
    playerDistance: Infinity, minPlayerDistance: Infinity,
    reset() {
      // A recoil is a committed encounter, including when the player forces it
      // while the body is still outside/on the sill. Death may pause it, but
      // cannot rewind the creature through the player or replay the crawl.
      if (this.entered || this.resolving || this.resolved) return;
      this.triggered = false;
      this.watched = false;
      this.gazeT = 0;
      this.progress = 0;
      this.stage = -1;
      this.stageHistory.length = 0;
      this.settledT = 0;
      this.lookAwayT = 0;
      this.vanished = false;
      this.resolveT = 0;
      this.resolveReason = null;
      this.resolveAtDistance = null;
      this.resolveProgress = null;
      this.playerDistance = Infinity;
      this.minPlayerDistance = Infinity;
      root.visible = false;
      root.scale.set(1, 1, 1);
      for (const mark of proof.children) mark.visible = false;
    },
  };
  game.sculleryCrawler = crawler;

  const beginProximityResolution = (distance) => {
    if (crawler.resolving || crawler.resolved || crawler.vanished) return false;
    crawler.resolving = true;
    crawler.resolveT = 0;
    crawler.resolveReason = 'proximity-recoil';
    crawler.resolveAtDistance = distance;
    crawler.resolveProgress = crawler.progress;
    game.flag('sculleryCrawlerRecoiled');
    for (const mark of proof.children) mark.visible = true;
    for (const [material] of dissolveMaterials) {
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    }
    // A close human inhale and a low frame scrape occupy the crawler's actual
    // position. Nothing touches the camera or feet; the body chooses retreat.
    game.audio.gasp({ pos: root.position, gain: 0.54, verb: 0.45 });
    game.audio.creak({ pos: root.position, gain: 0.42, rate: 0.46, verb: 0.58 });
    return true;
  };

  const watchedThroughAperture = () => {
    const p = game.player.pos;
    const inScullery = game.act === 'house' && p.y > -0.35 && p.y < 2.95
      && p.x > 4.05 && p.x < 8.05 && p.z > 1.95 && p.z < 5.92;
    if (!inScullery) return false;
    game.camera.updateMatrixWorld(true);
    game.camera.getWorldPosition(eye);
    const distance = toFocus.copy(focus).sub(eye).length();
    if (distance > 5.4 || distance < 0.25) return false;
    game.camera.getWorldDirection(forward);
    return forward.dot(toFocus.multiplyScalar(1 / distance)) > 0.955;
  };

  game.tickers.push((dt, time) => {
    if (game.dead) {
      if (!crawler.deathReset && !crawler.entered) crawler.reset();
      crawler.deathReset = true;
      root.visible = false;
      return;
    }
    crawler.deathReset = false;
    crawler.watched = watchedThroughAperture();
    if (!crawler.entered && crawler.watched && !crawler.resolving) {
      crawler.gazeT = Math.min(0.6, crawler.gazeT + dt);
      if (!crawler.triggered && crawler.gazeT >= 0.32) {
        crawler.triggered = true;
        crawler.stage = 0;
        crawler.stageHistory.push(0);
        root.visible = true;
        game.flag('sculleryCrawlerTriggered');
        game.audio.whisper({ pos: focus, gain: 0.28, rate: 0.58, verb: 1.1 });
      }
      if (crawler.triggered) crawler.progress = Math.min(1, crawler.progress + dt / 4.15);
    } else if (!crawler.triggered) {
      crawler.gazeT = Math.max(0, crawler.gazeT - dt * 1.6);
    }

    root.visible = game.act === 'house' && crawler.triggered && !crawler.vanished;
    if (!crawler.triggered) return;
    const q = clamp(crawler.progress, 0, 1);
    let y, z, rx;
    if (q < 0.26) {
      const u = q / 0.26;
      y = 0.04 + u * 0.66;
      z = 6.88 - u * 0.23;
      rx = -u * 0.16;
    } else if (q < 0.68) {
      const u = (q - 0.26) / 0.42;
      y = 0.7 + Math.sin(u * Math.PI) * 0.26;
      // Rotation, rather than a camera-ward root lunge, carries the head and
      // hands across the sill. That preserves readable human scale up close.
      z = 6.65 - u * 0.3;
      rx = -0.16 - u * 1.22;
    } else {
      const u = (q - 0.68) / 0.32;
      y = 0.7 - u * 0.37;
      // Clear the sill, plant both hands inside, then rise into a low crouch.
      // The old final pose stayed horizontal and vanished behind the held
      // skull; this weight shift leaves the head and shoulders visibly in-room.
      z = 6.35 - u * 0.6;
      rx = -1.38 + u;
    }
    const lateralCrawl = 0.14 + Math.max(0, (q - 0.35) / 0.65) * 0.42;
    root.position.set(opening.center.x - lateralCrawl + Math.sin(q * Math.PI * 2.4) * 0.035, y, z);
    root.rotation.set(rx, Math.sin(q * Math.PI) * 0.08, Math.sin(q * Math.PI * 3) * 0.035);
    root.scale.set(1, 1, 1);
    body.rotation.y = Math.sin(time * 0.83) * 0.025;
    const reach = Math.sin(q * Math.PI * 5);
    joints.leftForearm.rotation.y = reach * 0.12;
    joints.rightForearm.rotation.y = -reach * 0.12;
    joints.leftShin.rotation.x = -reach * 0.09;
    joints.rightShin.rotation.x = reach * 0.09;

    const nextStage = Math.min(4, Math.floor(q * 5));
    if (nextStage !== crawler.stage) {
      crawler.stage = nextStage;
      crawler.stageHistory.push(nextStage);
      if (nextStage === 1) game.audio.creak({ pos: focus, gain: 0.28, rate: 0.64 });
      if (nextStage === 2) game.audio.glassTink({ pos: opening.center, gain: 0.38, rate: 0.44 });
      if (nextStage === 3) game.audio.thud({ pos: opening.center, gain: 0.38, rate: 0.52 });
      if (nextStage === 4) game.audio.whisper({ pos: root.position, gain: 0.35, rate: 0.48, verb: 0.85 });
    }
    sillSmear.visible = crawler.stage >= 2;
    for (const print of proof.children.slice(2)) print.visible = crawler.stage >= 2;
    floorSmear.visible = crawler.stage >= 4;
    if (!crawler.entered && q >= 0.999) {
      crawler.entered = true;
      game.flag('sculleryCrawlerEntered');
    }
    if (crawler.entered && !crawler.vanished) {
      // Entry owns a full watched tableau before the apparition is permitted
      // to leave. It can only disappear behind a genuine look-away; the wet
      // hand/floor proof remains, so no indefinite walk-through mannequin is
      // left standing in the room and no cheap on-camera pop is possible.
      if (crawler.watched) {
        crawler.settledT = Math.min(2, crawler.settledT + dt);
        crawler.lookAwayT = 0;
      } else if (crawler.settledT >= 1.05) {
        crawler.lookAwayT += dt;
        if (crawler.lookAwayT >= 0.38) {
          crawler.resolved = true;
          crawler.resolveReason = 'look-away';
          crawler.vanished = true;
          root.visible = false;
          game.flag('sculleryCrawlerVanished');
          game.audio.whisper({ pos: root.position, gain: 0.28, rate: 0.42, verb: 1.15 });
        }
      }
    }

    // Before recoil begins, the authored pose is the visible pose and owns the
    // tripwire. Once recoil is active, the base crawl transform below is only
    // an animation origin; do not record it as player clearance because it is
    // displaced again before this tick can render.
    if (!crawler.vanished && !crawler.resolving) {
      const distance = Math.hypot(game.player.pos.x - root.position.x,
        game.player.pos.z - root.position.z);
      // The 1.48 m tripwire encloses the 0.34 m player capsule plus the
      // crawler's forward-projected head/shoulders with a visible safety beat.
      // It is stage-independent, so walking up during the outside/sill crawl
      // cannot put those long limbs through the player either.
      if (distance <= crawler.proximityThreshold) beginProximityResolution(distance);
      else {
        crawler.playerDistance = distance;
        crawler.minPlayerDistance = Math.min(crawler.minPlayerDistance, distance);
      }
    }

    if (crawler.resolving && !crawler.vanished) {
      crawler.resolveT += dt;
      const r = clamp(crawler.resolveT / 0.48, 0, 1);
      const ease = r * r * (3 - 2 * r);
      // Recoil away from the room faster than the player's maximum run, then
      // collapse upward through the aperture as the silhouette thins out.
      root.position.z += ease * 3.0;
      root.position.y += Math.sin(r * Math.PI) * 0.18 + ease * 0.34;
      root.rotation.x -= ease * 0.48;
      root.scale.set(1 - ease * 0.18, 1 + Math.sin(r * Math.PI) * 0.08, 1 - ease * 0.18);
      for (const mark of proof.children) mark.visible = true;
      for (const [material, baseOpacity] of dissolveMaterials) {
        material.opacity = baseOpacity * (1 - ease);
      }
      const retreatedDistance = Math.hypot(game.player.pos.x - root.position.x,
        game.player.pos.z - root.position.z);
      // This is the final transform for the tick and therefore the only recoil
      // distance that the renderer/player can actually observe.
      crawler.playerDistance = retreatedDistance;
      crawler.minPlayerDistance = Math.min(crawler.minPlayerDistance, retreatedDistance);
      if (r >= 1) {
        crawler.resolving = false;
        crawler.resolved = true;
        crawler.vanished = true;
        root.visible = false;
        game.flag('sculleryCrawlerVanished');
        game.flag('sculleryCrawlerProximityResolved');
      }
    }
  });
}

// -------------------------------------------- the house remembers the return
// Solving the window relay and stealing the unreachable flame are the player's
// two loudest insults to the house. On the return to the cellar, those causes
// become one deterministic physical answer: a second set of footsteps takes a
// coherent route through rooms the player already learned, familiar furniture
// is different only after it leaves the frame, and a harmless unlocked side
// door gives a few inches before the Resident takes over. Nothing here moves
// the player or camera, schedules a wall-clock callback, or unlocks progression.
function buildHouseReturnHorror(game) {
  const { world, camera } = game;
  const F = HOUSE_TABLES.levels.first.floor;
  const props = game.houseReturnProps;

  // The backhall/scullery door is a real ordinary door immediately west of the
  // cellar shaft: unlocked from frame one, closed by default, and unrelated to
  // any progression lock. Its crack remains collidable until the player uses
  // the knob and opens it normally.
  const returnDoor = world.doors.find((d) => d.floor === 0 && !d.id && !d.locked
    && Math.abs(d.center.x - 4) < 0.01 && Math.abs(d.center.z - 3) < 0.01);

  const route = [
    { id: 'living-aperture', pos: new THREE.Vector3(-11.28, 0.08, -9.0), wait: 0.16, surface: 'wood' },
    { id: 'living-door', pos: new THREE.Vector3(-4.18, 0.08, -8.95), wait: 0.42, surface: 'wood', creak: true },
    { id: 'stair-foot', pos: new THREE.Vector3(1.15, 0.08, -8.2), wait: 0.44, surface: 'wood' },
    { id: 'guest-threshold', pos: new THREE.Vector3(4.22, F + 0.08, -7.0), wait: 0.48, surface: 'wood' },
    { id: 'landing-turn', pos: new THREE.Vector3(0.8, F + 0.08, 1.0), wait: 0.46, surface: 'wood', creak: true },
    { id: 'stair-descent', pos: new THREE.Vector3(1.05, 2.15, -3.8), wait: 0.34, surface: 'wood', gate: 'descending' },
    { id: 'dining-return', pos: new THREE.Vector3(5.05, 0.08, -8.9), wait: 0.38, surface: 'wood', gate: 'ground' },
    { id: 'kitchen-door', pos: new THREE.Vector3(4.0, 0.08, 3.0), wait: 0.42, surface: 'stone', creak: true, gate: 'kitchen', door: true },
    { id: 'cellar-boards', pos: new THREE.Vector3(9.0, 0.08, 1.82), wait: 0.46, surface: 'stone', creak: true, gate: 'cellar' },
  ];

  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();
  const toPoint = new THREE.Vector3();
  const rockerFocus = new THREE.Vector3(-6.3, F + 0.72, 5.0);
  const diningFocus = new THREE.Vector3(6.2, 1.05, -8.8);
  const initial = {
    rockerPos: props.rockingChair.position.clone(),
    rockerRot: props.rockingChair.rotation.clone(),
    chairPos: props.diningChair.position.clone(),
    chairRot: props.diningChair.rotation.clone(),
    portraitPos: props.diningPortrait.position.clone(),
    portraitRot: props.diningPortrait.rotation.clone(),
  };
  const state = {
    id: 'houseReturnHorror', active: false, complete: false,
    index: 0, clock: 0, completionCount: 0, handoffCount: 0,
    route, events: [], mutations: [], props, initial, returnDoor,
    visits: { rocker: false, rockerLeft: false, dining: false, diningLeft: false },
    moved: { rocker: false, dining: false },
    doorCreep: 'pending', residentSerial: null,
  };
  game.houseReturnHorror = state;

  const isWatched = (point, minDot = 0.91, maxDistance = 8.5) => {
    camera.getWorldPosition(eye);
    // A floor or ceiling is an authored occluder. This also prevents a player
    // facing the right compass direction downstairs from psychically freezing
    // an upstairs change through two slabs and a wall.
    if (Math.abs(eye.y - point.y) > 2.15) return false;
    const distance = toPoint.copy(point).sub(eye).length();
    if (distance < 0.12 || distance > maxDistance) return false;
    camera.getWorldDirection(look);
    return look.dot(toPoint.multiplyScalar(1 / distance)) > minDot;
  };

  const routeGate = (beat) => {
    const p = game.player.pos;
    if (!beat.gate) return true;
    if (beat.gate === 'descending') return p.y < 3.15;
    if (beat.gate === 'ground') return p.y < 1.15;
    if (beat.gate === 'kitchen') return p.y < 1.15 && p.x > 3.25 && p.z > -6.65;
    if (beat.gate === 'cellar') return p.y < 1.15
      && Math.hypot(p.x - 9, p.z - 2) < 7.0;
    return false;
  };

  const mutateRocker = () => {
    if (state.moved.rocker) return;
    state.moved.rocker = true;
    props.rockingChair.position.set(initial.rockerPos.x + 0.34, initial.rockerPos.y, initial.rockerPos.z - 0.28);
    props.rockingChair.rotation.set(initial.rockerRot.x, initial.rockerRot.y - 0.56, -0.045);
    state.mutations.push({ id: 'rocking-chair', at: state.index });
    game.flag('houseReturnRockingMoved');
    game.audio.creak({ pos: rockerFocus, gain: 0.34, rate: 0.58, verb: 0.52 });
  };

  const mutateDining = () => {
    if (state.moved.dining) return;
    state.moved.dining = true;
    props.diningChair.position.set(initial.chairPos.x - 0.38, initial.chairPos.y, initial.chairPos.z + 0.16);
    props.diningChair.rotation.set(initial.chairRot.x, initial.chairRot.y + 0.62, initial.chairRot.z);
    props.diningPortrait.rotation.set(initial.portraitRot.x, initial.portraitRot.y - 0.08, 0.19);
    state.mutations.push({ id: 'dining-chair-and-portrait', at: state.index });
    game.flag('houseReturnDiningMoved');
    game.audio.creak({ pos: diningFocus, gain: 0.28, rate: 1.16, verb: 0.44 });
  };

  const emitBeat = (beat) => {
    game.audio.footstep(beat.surface, {
      pos: beat.pos, gain: beat.surface === 'stone' ? 0.66 : 0.58,
      rate: 0.76 + state.index * 0.025, verb: beat.pos.y > 2.8 ? 0.48 : 0.32,
    });
    if (beat.creak) game.audio.creak({
      pos: beat.pos, gain: beat.door ? 0.43 : 0.26,
      rate: beat.door ? 0.64 : 0.82, verb: 0.5,
    });
    state.events.push({
      id: beat.id, ordinal: state.index,
      pos: [beat.pos.x, beat.pos.y, beat.pos.z],
      sound: beat.creak ? 'footstep+creak' : 'footstep',
    });
    game.flag(`houseReturnBeat${state.index + 1}`);

    if (beat.door) {
      if (returnDoor && !returnDoor.locked && !returnDoor.open) {
        // Deliberately do not call setOpen: a crack is not a passable opening.
        // `tryUse` remains the one valid action that drops the collider.
        returnDoor.target = Math.max(returnDoor.target, 0.14);
        state.doorCreep = 'cracked';
      } else if (returnDoor?.open) state.doorCreep = 'player-opened';
      else state.doorCreep = 'unavailable';
    }

    state.index++;
    state.clock = 0;
    if (state.index !== route.length) return;

    state.complete = true;
    state.completionCount++;
    state.handoffCount++;
    game.flag('houseReturnCompleted');
    // The boards still require the authored skull hits. The final footfall only
    // tells the existing Resident system exactly what made the noise.
    game.residentHeard(0.34);
    const resident = game.director.resident;
    if (resident) {
      resident.state = 'wind';
      resident.windT = 0;
      state.residentSerial = resident.serial ?? null;
    }
  };

  game.tickers.push((dt) => {
    const p = game.player.pos;
    const rockerDistance = Math.hypot(p.x - rockerFocus.x, p.z - rockerFocus.z);
    const diningDistance = Math.hypot(p.x - diningFocus.x, p.z - diningFocus.z);
    if (game.act === 'house' && !game.dead) {
      if (p.y > 3.0 && rockerDistance < 8.0) state.visits.rocker = true;
      if (state.visits.rocker && (p.y < 2.75 || rockerDistance > 9.0)) state.visits.rockerLeft = true;
      if (p.y < 1.35 && diningDistance < 7.2) state.visits.dining = true;
      if (state.visits.dining && (p.y > 2.2 || diningDistance > 7.8)) state.visits.diningLeft = true;
    }

    const prerequisites = game.flags.has('windowRelaySolved') && game.flags.has('ateFlame');
    if (!prerequisites || state.complete) return;
    if (!state.active) {
      state.active = true;
      game.flag('houseReturnStarted');
    }
    if (game.act !== 'house' || game.dead) {
      // Never carry a nearly-expired beat through a death or act transition.
      // Progress is retained; pending time is not.
      state.clock = 0;
      return;
    }

    // These are permanent between-visit changes, not animations the player can
    // catch. Each waits for a real prior visit, a real departure, its matching
    // visitor beat, and a camera that is genuinely elsewhere on the same floor.
    if (!state.moved.rocker && state.visits.rocker && state.visits.rockerLeft
      && state.index >= 5 && !isWatched(rockerFocus, 0.9, 9.0)) mutateRocker();
    if (!state.moved.dining && state.visits.dining && state.visits.diningLeft
      && state.index >= 7 && !isWatched(diningFocus, 0.9, 9.0)) mutateDining();

    const beat = route[state.index];
    if (!beat || !routeGate(beat) || isWatched(beat.pos, 0.925, 7.5)) {
      state.clock = 0;
      return;
    }
    state.clock += dt;
    if (state.clock >= beat.wait) emitBeat(beat);
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
    dispose() {
      this.active = false;
      double.visible = false;
      echo.visible = false;
      pane.setActive(false);
      pool.dispose();
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
// The basement's second required district, authored around continuous hold.
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
    gate, gateCollider, waterBarriers, target: null, clue: 0,
  };
  game.pumpGallery = route;
  route.nudge = () => {
    route.clue = 1;
    game.audio.metalDrop({ pos: winch.position, gain: 0.46, rate: 0.62 });
    game.after(0.22, () => game.audio.knock({ pos: cradle.getWorldPosition(new THREE.Vector3()),
      gain: 0.52, rate: 0.58 }));
  };

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
    // approach. The previous z-only test made the far archive machinery render
    // from the ordinary basement start at x=9, long before the required route.
    const archiveDetailVisible = game.act === 'basement'
      && game.player.pos.x < -11.45 && game.player.pos.z > 0.35;
    for (const pump of pumpStands) pump.group.visible = archiveDetailVisible;
    const holding = skull && skull.mode === 'anchored'
      && skull.anchor && skull.anchor.puzzleId === route.id;
    route.clue = Math.max(0, route.clue - dt * 0.58);
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
        if (game.incineratorPosition) {
          game.after(0.26, () => game.audio.knock({ pos: game.incineratorPosition,
            gain: 0.7, rate: 0.48 }));
          game.after(0.62, () => game.audio.fireRoar({ pos: game.incineratorPosition,
            gain: 0.28, rate: 0.54 }));
        }
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
    cradleGlow.material.opacity = 0.12
      + (holding ? 0.52 + Math.sin(time * 18) * 0.1 : 0)
      + route.clue * (0.26 + Math.sin(time * 11) * 0.08);
    if (!holding) cradle.rotation.z = Math.sin(time * 8.2) * route.clue * 0.055;

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
  // DARK until the door opens. This glow used to be born at 1.6, and pool
  // candles are unshadowed point lights, so the candle's light leaked through
  // the closed door into the stair shaft from the first minute of the game --
  // meaning the bell "opening" the door produced literally zero light change
  // anywhere the player could stand. Alex, on his third time asking about this
  // beat: "it is unclear what this does." The candle now lights BECAUSE the
  // door opened: climb the stairs after the bell and there is a lit doorway
  // where there was a dark one. Brightness and motion, never hue.
  const glow = { x: 5.3, y: F + 1.55, z: -7, intensity: 0, r: 5 };
  world.candles.push(glow);
  const unlitFlameScale = flame.scale.clone();
  flame.scale.setScalar(0.0001);           // no flame on a dead candle
  game.voidDoorGlow = glow;                // deterministic observability

  // The upstairs candle and basement pilot feed one required flame circuit.
  // Whichever visible source the player uses first atomically extinguishes
  // every duplicate, seats one pair of socket embers, and establishes the
  // exact same `ateFlame` dependency for the furnace.
  const flameCircuit = {
    sources: [], source: null, embers: [],
    register(source) {
      this.sources.push(source);
      return source;
    },
    absorb(skull, source) {
      if (game.flags.has('ateFlame')) {
        if (source?.target) source.target.enabled = false;
        if (source?.flame) source.flame.visible = false;
        return false;
      }
      this.source = source?.id || 'unknown';
      for (const candidate of this.sources) {
        if (candidate.target) candidate.target.enabled = false;
        if (candidate.flame) candidate.flame.visible = false;
        if (candidate.glow) {
          // Extinguish the descriptor and any currently assigned pool light in
          // this exact hit, rather than waiting up to the pool's 0.4 s resort.
          candidate.glow.intensity = 0;
          for (const light of world.candlePool || []) {
            if (light.userData.c !== candidate.glow) continue;
            light.intensity = 0;
            light.userData.c = null;
          }
          const i = world.candles.indexOf(candidate.glow);
          if (i >= 0) world.candles.splice(i, 1);
        }
      }
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });
      for (const socket of (skull.sockets || []).slice(0, 2)) {
        const local = socket.getWorldPosition(new THREE.Vector3());
        skull.root.worldToLocal(local);
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 6), emberMat);
        ember.position.copy(local);
        ember.position.z += 0.012;
        skull.root.add(ember);
        this.embers.push([ember, socket]);
      }
      game.tickers.push(() => {
        for (const [ember, socket] of this.embers) ember.visible = socket.visible;
      });
      game.skullLight.intensity = 62;
      game.skullLight.distance = 12.5;
      game.skullLight.color.setHex(0xd8c8a4);
      game.flag('ateFlame');
      return true;
    },
  };
  game.flameCircuit = flameCircuit;

  const doorPos = new THREE.Vector3(4, F + 1.15, -7);
  const guestSource = { id: 'guest-candle', flame, glow, target: null };
  const flameTarget = world.addFetchTarget({
    // The visible flame is narrow, but the throw arrives from the stairwell
    // below at a steep retained arc. Own the whole candle-dish silhouette so a
    // clean aimed throw cannot slip through the mathematically tiny fireball.
    id: 'guestFlame', object: flame, radius: 0.9, enabled: false,
    onHit(skull) {
      // Both natural approaches now cross the widened real doorway while the
      // skull is outbound. A retained return may still pass the candle, but it
      // cannot spend a second interaction credit or grant progression.
      if (skull.mode !== 'outbound') return 'continue';
      if (!flameCircuit.absorb(skull, guestSource)) return 'return';
      game.audio.fireChoke({ pos: stand.position, gain: 0.4 });   // the flame dies into it
      game.audio.glassTink({ pos: stand.position, gain: 0.5, rate: 0.7 });
      return 'return';
    },
  });
  guestSource.target = flameTarget;
  flameCircuit.register(guestSource);
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
    // The candle catches as the door swings: a breath of delay, then the
    // flame grows in and the glow ramps. From the stairwell this is the
    // point of the beat -- the door you cannot reach now has light behind
    // it, and the light was not there before you rang the bell.
    game.after(0.55, () => {
      game.audio.fireRoar({ pos: stand.position, gain: 0.16, rate: 1.35 });
      const grow = { t: 0 };
      game.tickers.push((dt) => {
        // absorb() extinguishes this candle by hiding the flame and zeroing
        // the glow; if that happens mid-ramp the ramp must lose, not refight.
        if (grow.t >= 1 || !flame.visible) { grow.t = 1; return; }
        grow.t = Math.min(1, grow.t + dt / 1.6);
        glow.intensity = 1.6 * grow.t;
        const s = 0.25 + 0.75 * grow.t;
        flame.scale.set(unlitFlameScale.x * s, unlitFlameScale.y * s, unlitFlameScale.z * s);
      });
    }, { global: true });
    return true;
  };
  const rattleDoor = (at = null) => {
    if (game.flags.has('voidDoorOpen')) return false;
    door.rattleT = Math.max(door.rattleT || 0, 0.58);
    game.flag('voidDoorTried');
    if (at) game.impact('locked', at);
    else game.shake(0.08);
    game.audio.lockedRattle({ pos: door.group.position, gain: 0.78, rate: 0.82 });
    game.windowRelay?.nudge?.();
    return true;
  };
  doorTarget = world.addFetchTarget({
    id: 'voidDoor', pos: doorPos.clone(), radius: 0.8,
    onHit(skull, at) {
      if (skull.mode !== 'outbound') return 'continue';
      if (game.flags.has('voidDoorOpen')) return 'return';
      rattleDoor(at || doorPos);
      return 'return';
    },
  });
  // Door interaction registration deliberately dispatches through the live
  // method, so this override gives E the exact same causal law as a skull hit.
  // Before the relay it can only rattle/nudge the window mechanism; afterwards
  // it remains physically open so an ordinary use cannot contradict the
  // solved flag by closing the required flame behind an inert panel.
  door.tryUse = () => {
    if (game.flags.has('voidDoorOpen')) return;
    rattleDoor();
  };
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

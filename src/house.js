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

// ---------------------------------------------------------------- helpers
function prop(scene, mat, x, y, z, w, h, d, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  m.castShadow = true;
  scene.add(m);
  return m;
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
  const F = HOUSE_TABLES.levels.first.floor;

  // bedroom: the bed you woke on, wardrobe, dresser, the oil lamp
  prop(scene, M.woodDark, 10.6, F, 3.4, 1.6, 0.55, 2.1);            // bed frame
  prop(scene, M.curtain, 10.6, F + 0.55, 3.4, 1.5, 0.25, 2.0);      // mattress+sheet
  prop(scene, M.woodDark, 5.4, F, 4.9, 1.4, 2.2, 0.6);              // wardrobe
  prop(scene, M.woodDark, 9.4, F, 5.5, 1.2, 0.9, 0.5);              // dresser
  const lamp = prop(scene, M.metal, 9.4, F + 0.9, 5.5, 0.16, 0.3, 0.16);
  world.candles.push({ x: 9.4, y: F + 1.35, z: 5.5, intensity: 1.7, r: 4 });

  // landing: runner carpet, hall table, candle
  prop(scene, M.carpet, -1.5, F + 0.005, 2.2, 1.4, 0.012, 5.2);
  prop(scene, M.woodDark, -3.4, F, 4.9, 1.0, 0.85, 0.45);
  world.candles.push({ x: -3.4, y: F + 1.15, z: 4.9, intensity: 1.4, r: 4 });

  // nursery: crib, rocking chair, dresser — and the mobile turning with no wind
  prop(scene, M.woodDark, -10.4, F, 4.6, 1.3, 0.9, 0.8);            // crib box
  for (let i = 0; i < 6; i++)
    prop(scene, M.woodDark, -10.95 + i * 0.22, F + 0.9, 4.6, 0.04, 0.5, 0.04); // bars
  prop(scene, M.woodDark, -6.4, F, 5.2, 0.6, 1.0, 0.6, 0.4);        // rocking chair
  prop(scene, M.woodDark, -10.2, F, 1.1, 1.2, 0.95, 0.5);           // dresser
  world.candles.push({ x: -6.5, y: F + 0.5, z: 1.0, intensity: 0.8, r: 3.5 });

  const G = 0;
  // living: sofa, hearth, mantel clock
  prop(scene, M.curtain, -8, G, -10.5, 2.2, 0.8, 0.9);
  prop(scene, M.brick, -11.6, G, -8, 0.7, 2.6, 1.8);
  world.candles.push({ x: -11.1, y: G + 0.5, z: -8, intensity: 1.2, r: 4.5 });
  // dining: long table, chairs askew
  prop(scene, M.woodDark, 10, G, -10, 1.2, 0.78, 3.4);
  for (let i = 0; i < 4; i++)
    prop(scene, M.woodDark, 9 + (i % 2) * 2, G, -11.4 + Math.floor(i / 2) * 2.6, 0.45, 0.95, 0.45, (i * 1.3) % 1 - 0.5);
  // kitchen: counters, stove, hanging pans
  prop(scene, M.woodDark, 11.3, G, -3, 0.7, 0.92, 3.6);
  prop(scene, M.metal, 8.6, G, -5.2, 0.8, 0.95, 0.7);
  world.candles.push({ x: 10, y: G + 1.3, z: -2, intensity: 1.1, r: 4 });
  // study: desk, shelves
  prop(scene, M.woodDark, -10.8, G, -1, 0.7, 1.9, 2.6);
  prop(scene, M.woodDark, -9, G, 2.2, 1.5, 0.78, 0.7, 0.2);
  world.candles.push({ x: -9, y: G + 1.0, z: 2.2, intensity: 1.3, r: 4 });
  // foyer: coat stand, mirror frame (dark glass — the house mirror is elsewhere)
  prop(scene, M.woodDark, -3.4, G, -12.8, 0.3, 1.8, 0.3);

  const B = -3.0;
  // boiler room: tank, boiler, pipes, pilot ember glow
  prop(scene, M.metal, 10.6, B, -3.4, 0.66, 1.5, 0.66);             // hot water tank
  prop(scene, M.metal, 9, B, -5, 1.1, 1.4, 1.1);                    // boiler
  prop(scene, M.metal, 9, B + 2.0, -5, 0.28, 0.9, 0.28);            // flue
  world.candles.push({ x: 9, y: B + 0.55, z: -5, intensity: 1.6, r: 3.5, }); // pilot
  // storeroom: shelving + crates
  prop(scene, M.woodDark, -2.5, B, -4.5, 2.6, 1.7, 0.5);
  prop(scene, M.woodDark, 2.2, B, -2, 0.9, 0.7, 0.9, 0.3);
  prop(scene, M.woodDark, 1.4, B, -1, 0.8, 0.5, 0.8, 0.9);

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
